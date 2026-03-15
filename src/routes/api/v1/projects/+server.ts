import { json } from '@sveltejs/kit';
import { basename } from 'node:path';
import { createProjectSchema } from '$lib/server/api-schemas';
import { HttpError, getDb, dbError, parseJsonBody } from '$lib/server/api';
import { validatePathRestrictions } from '$lib/server/path-security';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const db = await getDb();
		const projects = await db.getAllProjects();
		return json(projects);
	} catch (e) {
		return dbError(e);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const db = await getDb();
		const body = await parseJsonBody(request, createProjectSchema);

		const name = body.name ?? (body.directory_path ? basename(body.directory_path) : undefined);
		if (!name) {
			throw new HttpError(422, 'name is required when directory_path is not provided');
		}

		const project = await db.createProject({
			name,
			slug: body.slug,
			key_prefix: body.key_prefix,
			description: body.description ?? undefined,
			instructions: body.instructions ?? undefined,
			directory_path: body.directory_path ? validatePathRestrictions(body.directory_path) : undefined,
			skip_default_versions: body.skip_default_versions,
		});
		return json(project, { status: 201 });
	} catch (e) {
		return dbError(e);
	}
};
