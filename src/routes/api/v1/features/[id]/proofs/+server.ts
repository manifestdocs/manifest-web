import { json } from '@sveltejs/kit';
import { createProofSchema } from '$lib/server/api-schemas';
import { getDb, dbError } from '$lib/server/api';
import { parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const proofs = await db.getProofsForFeature(resolvedId);
		return json(proofs);
	} catch (e) {
		return dbError(e);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const resolvedId = await db.resolveFeatureId(params.id);
		if (!resolvedId) return json({ error: 'Feature not found' }, { status: 404 });

		const body = await parseJsonBody(request, createProofSchema);
		const proof = await db.createProof(resolvedId, {
			command: body.command,
			exit_code: body.exit_code,
			output: body.output,
			tests: body.tests,
			test_suites: body.test_suites,
			evidence: body.evidence,
			commit_sha: body.commit_sha,
		});

		return json(proof, { status: 201 });
	} catch (e) {
		return dbError(e);
	}
};
