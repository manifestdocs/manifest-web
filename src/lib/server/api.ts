/**
 * Server-side API helpers.
 *
 * getDb() returns a singleton Database instance.
 * dbError() maps DB errors to HTTP responses.
 */

import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { mkdirSync } from 'node:fs';
import { json } from '@sveltejs/kit';
import { ZodError, type ZodType } from 'zod';
import { Database, NotFoundError, ConflictError, ValidationError, DbError } from './db.js';

function defaultDbPath(): string {
  const home = homedir();
  if (platform() === 'darwin') {
    return join(home, 'Library', 'Application Support', 'manifest', 'manifest.db');
  }
  return join(process.env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'manifest', 'manifest.db');
}

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!_db) {
    const dbPath = process.env.MANIFEST_DB ?? defaultDbPath();

    mkdirSync(join(dbPath, '..'), { recursive: true });
    _db = await Database.open(dbPath);
  }
  return _db;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new HttpError(400, 'Invalid JSON request body');
    }
    throw err;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, 'Validation failed', parsed.error.flatten());
  }
  return parsed.data;
}

interface IntSearchParamOptions {
  min?: number;
  max?: number;
  defaultValue?: number;
}

function parseStrictInteger(value: string, name: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new HttpError(400, `${name} must be an integer`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new HttpError(400, `${name} is out of range`);
  }

  return parsed;
}

export function parseOptionalIntSearchParam(
  url: URL,
  name: string,
  options: IntSearchParamOptions = {},
): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') {
    return options.defaultValue;
  }

  const parsed = parseStrictInteger(raw, name);
  if (options.min !== undefined && parsed < options.min) {
    throw new HttpError(400, `${name} must be >= ${options.min}`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new HttpError(400, `${name} must be <= ${options.max}`);
  }
  return parsed;
}

export function parseRequiredStringSearchParam(
  url: URL,
  name: string,
  options: { maxLength?: number } = {},
): string {
  const raw = url.searchParams.get(name);
  const value = raw?.trim();
  if (!value) {
    throw new HttpError(400, `Missing required query parameter: ${name}`);
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new HttpError(400, `${name} exceeds maximum length of ${options.maxLength}`);
  }
  return value;
}

export function parseOptionalEnumSearchParam<T extends readonly string[]>(
  url: URL,
  name: string,
  allowed: T,
): T[number] | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') {
    return undefined;
  }

  if (!allowed.includes(raw)) {
    throw new HttpError(400, `${name} must be one of: ${allowed.join(', ')}`);
  }

  return raw as T[number];
}

export function parseOptionalIsoDateTimeSearchParam(url: URL, name: string): string | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') {
    return undefined;
  }

  if (Number.isNaN(Date.parse(raw))) {
    throw new HttpError(400, `${name} must be a valid ISO date-time`);
  }

  return raw;
}

export function dbError(err: unknown): Response {
  if (err instanceof HttpError) {
    return json(
      err.details === undefined
        ? { error: err.message }
        : { error: err.message, details: err.details },
      { status: err.status },
    );
  }

  if (err instanceof NotFoundError) {
    return json({ error: err.message }, { status: 404 });
  }
  if (err instanceof ConflictError) {
    return json({ error: err.message, ...err.details }, { status: 409 });
  }
  if (err instanceof ValidationError) {
    return json({ error: err.message }, { status: 422 });
  }
  if (err instanceof DbError) {
    console.error('[DB Error]', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
  if (err instanceof ZodError) {
    return json(
      { error: 'Validation failed', details: err.flatten() },
      { status: 422 },
    );
  }

  console.error('[Unhandled API Error]', err);
  return json({ error: 'Internal server error' }, { status: 500 });
}
