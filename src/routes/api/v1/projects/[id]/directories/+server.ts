import { json } from '@sveltejs/kit';
import { addDirectorySchema } from '$lib/server/api-schemas';
import { getDb, dbError, parseJsonBody } from '$lib/server/api';
import { validatePathRestrictions } from '$lib/server/path-security';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const db = await getDb();
		const directories = await db.getDirectories(params.id);
		return json(directories);
	} catch (e) {
		return dbError(e);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const db = await getDb();
		const body = await parseJsonBody(request, addDirectorySchema);
		const directory = await db.addDirectory(params.id, {
			path: validatePathRestrictions(body.path),
			git_remote: body.git_remote ?? undefined,
			is_primary: body.is_primary,
			instructions: body.instructions ?? undefined,
		});
		return json(directory, { status: 201 });
	} catch (e) {
		return dbError(e);
	}
};
