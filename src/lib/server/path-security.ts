import { basename, dirname, isAbsolute, resolve, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import { HttpError } from './api.js';

const DENIED_PATHS = process.platform === 'darwin'
  ? ['/etc', '/var', '/tmp', '/root', '/proc', '/sys', '/private/etc', '/private/var', '/private/tmp']
  : ['/etc', '/var', '/tmp', '/root', '/proc', '/sys'];

function hasParentTraversal(rawPath: string): boolean {
  return rawPath.split(/[\\/]+/).includes('..');
}

function canonicalizeForValidation(targetPath: string): string {
  try {
    return realpathSync(targetPath);
  } catch {
    const suffix: string[] = [];
    let cursor = targetPath;

    while (true) {
      try {
        const canonicalBase = realpathSync(cursor);
        return resolve(canonicalBase, ...suffix.reverse());
      } catch {
        const parent = dirname(cursor);
        if (parent === cursor) {
          return targetPath;
        }
        suffix.push(basename(cursor));
        cursor = parent;
      }
    }
  }
}

function isWithinPath(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);
}

function parseAllowedRoots(): string[] {
  const raw = process.env.MANIFEST_ALLOWED_ROOTS;
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (!isAbsolute(entry)) {
        throw new HttpError(500, 'MANIFEST_ALLOWED_ROOTS entries must be absolute paths');
      }
      return canonicalizeForValidation(resolve(entry));
    });
}

export function validatePathRestrictions(rawPath: string): string {
  if (!isAbsolute(rawPath)) {
    throw new HttpError(400, 'Path must be absolute');
  }
  if (hasParentTraversal(rawPath)) {
    throw new HttpError(400, "Path must not contain '..' components");
  }

  const resolved = resolve(rawPath);
  const canonical = canonicalizeForValidation(resolved);

  for (const denied of DENIED_PATHS) {
    if (isWithinPath(canonical, denied)) {
      throw new HttpError(403, `Access to ${denied} is not allowed`);
    }
  }

  const allowedRoots = parseAllowedRoots();
  if (allowedRoots.length > 0 && !allowedRoots.some((root) => isWithinPath(canonical, root))) {
    throw new HttpError(403, `Path must be under one of: ${allowedRoots.join(', ')}`);
  }

  return resolved;
}
