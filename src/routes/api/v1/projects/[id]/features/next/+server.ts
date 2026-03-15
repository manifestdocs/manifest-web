import { json } from '@sveltejs/kit';
import { getDb, dbError } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const id = params.id;

		const inProgress = await db.getInProgressLeafFeatures(id);
		if (inProgress.length > 0) {
			return json(
				{
					error: 'in_progress_features_exist',
					message: 'There are features currently in progress',
					features: inProgress.map((f) => ({
						id: f.id,
						title: f.title,
						display_id: f.feature_number
							? `${f.project_id}-${f.feature_number}`
							: undefined,
						state: f.state,
						priority: f.priority
					}))
				},
				{ status: 409 }
			);
		}

		const next = await db.getNextWorkableFeature(id);
		if (!next) {
			return json({ error: 'No workable features found' }, { status: 404 });
		}

		const context = await db.getFeatureContext(next.id);
		return json(context);
	} catch (e) {
		return dbError(e);
	}
};
