import { json } from '@sveltejs/kit';
import { settingsUpdateSchema } from '$lib/server/api-schemas';
import { dbError, parseJsonBody } from '$lib/server/api';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	return json({
		database_path: null,
		database_path_resolved: env.MANIFEST_DB || '~/.local/share/manifest/manifest.db',
		config_file: null,
		default_agent: env.MANIFEST_DEFAULT_AGENT || 'claude',
	});
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = await parseJsonBody(request, settingsUpdateSchema);

		return json({
			database_path: body.database_path ?? null,
			database_path_resolved: env.MANIFEST_DB || '~/.local/share/manifest/manifest.db',
			config_file: null,
			default_agent: body.default_agent ?? env.MANIFEST_DEFAULT_AGENT ?? 'claude',
			restart_required: false,
		});
	} catch (e) {
		return dbError(e);
	}
};
