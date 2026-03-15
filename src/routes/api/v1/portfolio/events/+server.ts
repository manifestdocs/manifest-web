import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(': heartbeat\n\n');
			const interval = setInterval(() => {
				try {
					controller.enqueue(': heartbeat\n\n');
				} catch {
					clearInterval(interval);
				}
			}, 30000);
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		},
	});
};
