import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		agent: 'claude',
		configured: true,
		config_file: null,
		setup_hint: null,
	});
};
