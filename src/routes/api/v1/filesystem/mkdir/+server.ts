import { json } from '@sveltejs/kit';
import { mkdirSync } from 'node:fs';
import { mkdirSchema } from '$lib/server/api-schemas';
import { HttpError, dbError, parseJsonBody } from '$lib/server/api';
import { validatePathRestrictions } from '$lib/server/path-security';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await parseJsonBody(request, mkdirSchema);
		const path = validatePathRestrictions(body.path);

		mkdirSync(path, { recursive: true });
		return json({ path });
	} catch (err: unknown) {
		if (err instanceof HttpError) {
			return dbError(err);
		}
		const code = (err as NodeJS.ErrnoException).code;
		if (code === 'EACCES') {
			return dbError(new HttpError(403, 'permission denied'));
		}
		return dbError(new HttpError(500, 'failed to create directory'));
	}
};
