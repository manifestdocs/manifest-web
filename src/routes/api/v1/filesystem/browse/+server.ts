import { json } from '@sveltejs/kit';
import { dbError, HttpError } from '$lib/server/api';
import type { RequestHandler } from './$types';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { validatePathRestrictions } from '$lib/server/path-security';

const FILTERED_DIRS = new Set([
	'node_modules',
	'.git',
	'.svelte-kit',
	'target',
	'dist',
	'build',
	'.next',
	'__pycache__',
	'.venv',
	'vendor',
	'.idea',
	'.vscode',
]);

const MAX_ENTRIES = 500;

function hasSubdirectories(dirPath: string): boolean {
	try {
		const entries = readdirSync(dirPath, { withFileTypes: true });
		return entries.some((e) => e.isDirectory());
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const path = url.searchParams.get('path');
		if (!path) {
			throw new HttpError(400, 'path query parameter is required');
		}

		const restrictedPath = validatePathRestrictions(path);
		const resolved = resolve(restrictedPath);

		const stat = statSync(resolved);
		if (!stat.isDirectory()) {
			throw new HttpError(404, 'path is not a directory');
		}

		const dirents = readdirSync(resolved, { withFileTypes: true });

		const entries = dirents
			.filter((d) => d.isDirectory() && !FILTERED_DIRS.has(d.name))
			.sort((a, b) => a.name.localeCompare(b.name))
			.slice(0, MAX_ENTRIES)
			.map((d) => {
				const entryPath = join(resolved, d.name);
				return {
					name: d.name,
					path: entryPath,
					has_children: hasSubdirectories(entryPath),
				};
			});

		return json({
			path: resolved,
			parent: dirname(resolved),
			entries,
		});
	} catch (err: unknown) {
		if (err instanceof HttpError) {
			return dbError(err);
		}
		const code = (err as NodeJS.ErrnoException).code;
		if (code === 'ENOENT') {
			return dbError(new HttpError(404, 'path does not exist'));
		}
		if (code === 'EACCES') {
			return dbError(new HttpError(403, 'permission denied'));
		}
		return dbError(new HttpError(500, 'failed to read directory'));
	}
};
