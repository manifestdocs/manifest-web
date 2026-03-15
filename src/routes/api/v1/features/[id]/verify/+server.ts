import { json } from '@sveltejs/kit';
import { verifyFeatureSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

const SKIP_PATTERNS = [
	'Cargo.lock',
	'package-lock.json',
	'pnpm-lock.yaml',
	'yarn.lock',
	'node_modules/',
	'.min.js',
	'.min.css',
];

const MAX_DIFF_LENGTH = 50000;

function filterDiff(diff: string): { filtered: string; truncated: boolean } {
	const lines = diff.split('\n');
	const filtered: string[] = [];
	let skipping = false;

	for (const line of lines) {
		if (line.startsWith('diff --git') || line.startsWith('--- ') || line.startsWith('+++ ')) {
			skipping = SKIP_PATTERNS.some((pattern) => line.includes(pattern));
		}
		if (!skipping) {
			filtered.push(line);
		}
	}

	const result = filtered.join('\n');
	const truncated = result.length > MAX_DIFF_LENGTH;
	return {
		filtered: truncated ? result.slice(0, MAX_DIFF_LENGTH) : result,
		truncated,
	};
}

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const body = await parseJsonBody(request, verifyFeatureSchema);

		const context = await db.getFeatureContext(resolvedId);
		if (!context) return json({ error: 'Feature not found' }, { status: 404 });

		// Build spec from breadcrumb
		const specParts: string[] = [];
		for (const crumb of context.breadcrumb) {
			specParts.push(`## ${crumb.title}`);
		}
		specParts.push(`## ${context.title}`);
		if (context.details) {
			specParts.push(context.details);
		}
		const spec = specParts.join('\n\n');

		// Filter and truncate diff
		let diff: string | null = null;
		let diff_truncated = false;

		if (body.diff) {
			const result = filterDiff(body.diff);
			diff = result.filtered;
			diff_truncated = result.truncated;
		}

		const instructions =
			'Verify the implementation matches the specification. Check that all requirements are met and the code changes are correct.';

		return json({ spec, diff, diff_truncated, instructions });
	} catch (e) {
		return dbError(e);
	}
};
