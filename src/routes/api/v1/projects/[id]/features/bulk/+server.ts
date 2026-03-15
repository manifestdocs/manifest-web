import { json } from '@sveltejs/kit';
import { bulkCreateFeaturesSchema } from '$lib/server/api-schemas';
import { HttpError, getDb, dbError, parseJsonBody } from '$lib/server/api';
import type { CreateFeatureDbInput, FeatureState } from '$lib/server/db';
import type { RequestHandler } from './$types';

const MAX_FEATURES = 200;

interface BulkFeatureNode {
	title: string;
	details?: string | null;
	state?: FeatureState;
	priority?: number;
	children?: BulkFeatureNode[];
}

function countFeatures(features: BulkFeatureNode[]): number {
	return features.reduce(
		(sum: number, f) => sum + 1 + (f.children ? countFeatures(f.children) : 0),
		0
	);
}

function flatten(
	features: BulkFeatureNode[],
	inputs: CreateFeatureDbInput[],
	parentId?: string,
	targetVersionId?: string
) {
	for (const f of features) {
		const id = crypto.randomUUID();
		inputs.push({
			id,
			parent_id: parentId,
			title: f.title,
			details: f.details,
			state: f.state ?? 'proposed',
			priority: f.priority ?? 0,
			target_version_id: targetVersionId
		});
		if (f.children?.length) {
			flatten(f.children, inputs, id, targetVersionId);
		}
	}
}

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const body = await parseJsonBody(request, bulkCreateFeaturesSchema);
		const features = body.features;
		const confirm = body.confirm ?? false;
		const targetVersionId = body.target_version_id;

		const total = countFeatures(features);
		if (total > MAX_FEATURES) {
			throw new HttpError(422, `Too many features: ${total} exceeds maximum of ${MAX_FEATURES}`);
		}

		if (!confirm) {
			return json({ preview: true, count: total, features });
		}

		const inputs: CreateFeatureDbInput[] = [];
		flatten(features, inputs, undefined, targetVersionId);

		const created = await db.createFeaturesBulk(params.id, inputs);
		return json({ created: created.length, features: created }, { status: 201 });
	} catch (e) {
		return dbError(e);
	}
};
