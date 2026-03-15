/**
 * Database layer wrapping @libsql/client.
 *
 * Raw SQL queries — no ORM. Mirrors the Rust server's db/mod.rs.
 * All IDs are UUIDs stored as TEXT, all dates are RFC3339 strings.
 */

import { createClient, type Client, type InStatement, type InValue } from '@libsql/client';
import { SCHEMA, DEFAULT_SPEC_TEMPLATE } from './schema.js';

// ============================================================
// Core domain types (self-contained, no external deps)
// ============================================================

export interface Project {
  id: string;
  slug: string;
  name: string;
  key_prefix: string;
  description?: string | null;
  instructions?: string | null;
  current_version_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDirectory {
  id: string;
  project_id: string;
  path: string;
  git_remote?: string | null;
  is_primary: boolean;
  instructions?: string | null;
  created_at: string;
}

export interface ProjectWithDirectories extends Project {
  directories: ProjectDirectory[];
}

export type FeatureState = 'proposed' | 'blocked' | 'in_progress' | 'implemented' | 'archived';

export interface Version {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  released_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureSummaryContext {
  id: string;
  display_id?: string | null;
  title: string;
  state: string;
}

export interface BreadcrumbItem {
  id: string;
  display_id?: string | null;
  title: string;
  details?: string | null;
}

export interface FeatureWithContext {
  id: string;
  display_id?: string | null;
  title: string;
  details?: string | null;
  desired_details?: string | null;
  state: string;
  priority: number;
  target_version_id?: string | null;
  parent?: FeatureSummaryContext | null;
  siblings: FeatureSummaryContext[];
  children: FeatureSummaryContext[];
  breadcrumb: BreadcrumbItem[];
}

export interface FeatureHistory {
  id: string;
  feature_id: string;
  summary: string;
  author: string;
  created_at: string;
}

export interface FeatureTreeNode extends FeatureRow {
  children: FeatureTreeNode[];
  is_root?: boolean;
}

// ============================================================
// Feature row (full DB shape including claim/verification fields)
// ============================================================

export interface FeatureRow {
  id: string;
  project_id: string;
  parent_id?: string | null;
  title: string;
  details?: string | null;
  desired_details?: string | null;
  details_summary?: string | null;
  state: FeatureState;
  priority: number;
  feature_number?: number | null;
  target_version_id?: string | null;
  verification_result?: string | null;
  verified_at?: string | null;
  claimed_by?: string | null;
  claimed_at?: string | null;
  claim_metadata?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Input types
// ============================================================

export interface CreateProjectInput {
  name: string;
  slug?: string;
  key_prefix?: string;
  description?: string;
  instructions?: string;
  directory_path?: string;
  skip_default_versions?: boolean;
}

export interface UpdateProjectInput {
  name?: string;
  slug?: string;
  key_prefix?: string;
  description?: string | null;
  instructions?: string | null;
}

export interface CreateFeatureDbInput {
  id?: string;
  parent_id?: string | null;
  title: string;
  details?: string | null;
  state?: string;
  priority?: number;
  target_version_id?: string | null;
}

export interface UpdateFeatureDbInput {
  parent_id?: string | null;
  title?: string;
  details?: string | null;
  desired_details?: string | null;
  details_summary?: string | null;
  state?: string;
  priority?: number;
  target_version_id?: string | null;
  clear_version?: boolean;
  blocked_by?: string[];
}

export interface ClaimOpts {
  agent_type: string;
  metadata?: string;
  force?: boolean;
}

export interface CreateProofInput {
  command: string;
  exit_code: number;
  output?: string;
  tests?: unknown[];
  test_suites?: unknown[];
  evidence?: unknown[];
  commit_sha?: string;
}

export interface CompleteInput {
  summary: string;
  commits?: unknown[];
  backfill?: boolean;
}

export interface CreateVersionInput {
  name: string;
  description?: string | null;
}

export interface UpdateVersionInput {
  name?: string;
  description?: string | null;
  released_at?: string | null;
}

export interface CreateHistoryInput {
  summary: string;
  commits?: unknown[];
  version_id?: string;
}

// ============================================================
// Return types
// ============================================================

export interface Proof {
  id: string;
  feature_id: string;
  history_id?: string | null;
  command: string;
  exit_code: number;
  output?: string | null;
  tests?: string | null;
  evidence?: string | null;
  commit_sha?: string | null;
  agent_type?: string | null;
  created_at: string;
}

export interface SpecTemplate {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectFocus {
  project_id: string;
  feature_id: string;
  feature_title: string;
  feature_state: string;
}

export interface CompletionResult {
  feature: FeatureRow;
  history: FeatureHistory;
  warnings: string[];
}

export interface PortfolioProject {
  id: string;
  name: string;
  slug: string;
  next_version?: { id: string; name: string; feature_count: number; implemented_count: number } | null;
  next_feature?: { id: string; title: string; in_version: boolean } | null;
  in_progress: Array<{ id: string; title: string }>;
  in_progress_total: number;
  blocked: Array<{ id: string; title: string }>;
  blocked_count: number;
  recent_completions: Array<{ id: string; title: string; created_at: string }>;
  last_activity_at?: string | null;
}

// ============================================================
// Error types
// ============================================================

export class DbError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'DbError';
  }
}

export class NotFoundError extends DbError {
  constructor(entity: string) {
    super(`${entity} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DbError {
  constructor(message: string) {
    super(message, 'VALIDATION');
    this.name = 'ValidationError';
  }
}

export class ConflictError extends DbError {
  constructor(
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// ============================================================
// Helpers
// ============================================================

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function deriveKeyPrefix(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }
  return words
    .map((w) => w[0])
    .join('')
    .slice(0, 5)
    .toUpperCase();
}

function escapeLikePattern(query: string): string {
  return query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function deriveState(childStates: string[]): FeatureRow['state'] | null {
  const nonArchived = childStates.filter((s) => s !== 'archived');
  if (nonArchived.length === 0) return null;
  if (nonArchived.every((s) => s === 'proposed')) return 'proposed';
  if (nonArchived.every((s) => s === 'implemented')) return 'implemented';
  return 'in_progress';
}

const MAX_BULK_FEATURES = 200;

// ============================================================
// Database class
// ============================================================

export class Database {
  private client: Client;

  private constructor(client: Client) {
    this.client = client;
  }

  static async open(path: string): Promise<Database> {
    const client = createClient({ url: `file:${path}` });
    const db = new Database(client);
    await db.migrate();
    return db;
  }

  static async openMemory(): Promise<Database> {
    const client = createClient({ url: ':memory:' });
    const db = new Database(client);
    await db.migrate();
    return db;
  }

  async close(): Promise<void> {
    this.client.close();
  }

  async migrate(): Promise<void> {
    await this.client.execute('PRAGMA journal_mode=WAL');
    await this.client.execute('PRAGMA foreign_keys=ON');
    const statements = SCHEMA.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await this.client.execute(stmt);
    }
  }

  // ============================================================
  // Projects
  // ============================================================

  async getAllProjects(): Promise<Project[]> {
    const rs = await this.client.execute(
      'SELECT id, slug, name, description, instructions, current_version_id, key_prefix, created_at, updated_at FROM projects ORDER BY name',
    );
    return rs.rows.map(rowToProject);
  }

  async getProject(id: string): Promise<Project | null> {
    const rs = await this.client.execute({
      sql: 'SELECT id, slug, name, description, instructions, current_version_id, key_prefix, created_at, updated_at FROM projects WHERE id = ?',
      args: [id],
    });
    return rs.rows.length > 0 ? rowToProject(rs.rows[0]) : null;
  }

  async getProjectBySlug(slug: string): Promise<Project | null> {
    const rs = await this.client.execute({
      sql: 'SELECT id, slug, name, description, instructions, current_version_id, key_prefix, created_at, updated_at FROM projects WHERE slug = ?',
      args: [slug],
    });
    return rs.rows.length > 0 ? rowToProject(rs.rows[0]) : null;
  }

  async getProjectWithDirectories(id: string): Promise<ProjectWithDirectories | null> {
    const project = await this.getProject(id);
    if (!project) return null;
    const dirs = await this.getDirectories(id);
    return { ...project, directories: dirs };
  }

  async getProjectByDirectory(path: string): Promise<ProjectWithDirectories | null> {
    const rs = await this.client.execute({
      sql: 'SELECT project_id FROM project_directories WHERE path = ?',
      args: [path],
    });
    if (rs.rows.length === 0) return null;
    return this.getProjectWithDirectories(rs.rows[0].project_id as string);
  }

  async createProject(input: CreateProjectInput): Promise<ProjectWithDirectories> {
    const projectId = uuid();
    const rootFeatureId = uuid();
    const templateId = uuid();
    const timestamp = now();
    const slug = input.slug ?? slugify(input.name);
    const keyPrefix = input.key_prefix ?? deriveKeyPrefix(input.name);

    const stmts: InStatement[] = [
      {
        sql: `INSERT INTO projects (id, slug, name, description, instructions, root_feature_id, key_prefix, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [projectId, slug, input.name, input.description ?? null, input.instructions ?? null, rootFeatureId, keyPrefix, timestamp, timestamp],
      },
      {
        sql: `INSERT INTO features (id, project_id, parent_id, title, details, state, priority, created_at, updated_at)
              VALUES (?, ?, NULL, ?, ?, 'implemented', 0, ?, ?)`,
        args: [rootFeatureId, projectId, input.name, input.instructions ?? null, timestamp, timestamp],
      },
      {
        sql: `INSERT INTO spec_templates (id, project_id, name, description, content, is_default, created_at, updated_at)
              VALUES (?, ?, 'Default', 'General-purpose feature specification template', ?, 1, ?, ?)`,
        args: [templateId, projectId, DEFAULT_SPEC_TEMPLATE, timestamp, timestamp],
      },
    ];

    if (!input.skip_default_versions) {
      for (const vName of ['0.1.0', '0.2.0', '0.3.0']) {
        stmts.push({
          sql: `INSERT INTO versions (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          args: [uuid(), projectId, vName, timestamp, timestamp],
        });
      }
    }

    let directoryId: string | null = null;
    if (input.directory_path) {
      directoryId = uuid();
      stmts.push({
        sql: `INSERT INTO project_directories (id, project_id, path, is_primary, created_at) VALUES (?, ?, ?, 1, ?)`,
        args: [directoryId, projectId, input.directory_path, timestamp],
      });
    }

    await this.client.batch(stmts, 'write');

    const directories: ProjectDirectory[] = [];
    if (directoryId && input.directory_path) {
      directories.push({
        id: directoryId,
        project_id: projectId,
        path: input.directory_path,
        is_primary: true,
        created_at: timestamp,
      });
    }

    return {
      id: projectId,
      slug,
      name: input.name,
      key_prefix: keyPrefix,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      created_at: timestamp,
      updated_at: timestamp,
      directories,
    };
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project | null> {
    const existing = await this.getProject(id);
    if (!existing) return null;

    const timestamp = now();
    const name = input.name ?? existing.name;
    const slug = input.slug ?? (existing.name !== name ? slugify(name) : existing.slug);
    const keyPrefix = input.key_prefix ?? existing.key_prefix;
    const description = input.description !== undefined ? input.description : existing.description;
    const instructions = input.instructions !== undefined ? input.instructions : existing.instructions;

    await this.client.execute({
      sql: `UPDATE projects SET name = ?, slug = ?, key_prefix = ?, description = ?, instructions = ?, updated_at = ? WHERE id = ?`,
      args: [name, slug, keyPrefix, description ?? null, instructions ?? null, timestamp, id],
    });

    // Sync root feature title
    if (input.name) {
      const rootRs = await this.client.execute({
        sql: 'SELECT root_feature_id FROM projects WHERE id = ?',
        args: [id],
      });
      const rootId = rootRs.rows[0]?.root_feature_id;
      if (rootId) {
        await this.client.execute({
          sql: 'UPDATE features SET title = ?, updated_at = ? WHERE id = ?',
          args: [name, timestamp, rootId],
        });
      }
    }

    return this.getProject(id);
  }

  async deleteProject(id: string): Promise<boolean> {
    const rs = await this.client.execute({
      sql: 'DELETE FROM projects WHERE id = ?',
      args: [id],
    });
    return (rs.rowsAffected ?? 0) > 0;
  }

  // ============================================================
  // Directories
  // ============================================================

  async getDirectories(projectId: string): Promise<ProjectDirectory[]> {
    const rs = await this.client.execute({
      sql: 'SELECT id, project_id, path, git_remote, is_primary, instructions, created_at FROM project_directories WHERE project_id = ? ORDER BY is_primary DESC, path',
      args: [projectId],
    });
    return rs.rows.map(rowToDirectory);
  }

  async addDirectory(projectId: string, input: { path: string; git_remote?: string; is_primary?: boolean; instructions?: string }): Promise<ProjectDirectory> {
    const id = uuid();
    const timestamp = now();
    await this.client.execute({
      sql: 'INSERT INTO project_directories (id, project_id, path, git_remote, is_primary, instructions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, projectId, input.path, input.git_remote ?? null, input.is_primary ? 1 : 0, input.instructions ?? null, timestamp],
    });
    return { id, project_id: projectId, path: input.path, git_remote: input.git_remote, is_primary: input.is_primary ?? false, instructions: input.instructions, created_at: timestamp };
  }

  async deleteDirectory(id: string): Promise<boolean> {
    const rs = await this.client.execute({ sql: 'DELETE FROM project_directories WHERE id = ?', args: [id] });
    return (rs.rowsAffected ?? 0) > 0;
  }

  // ============================================================
  // Focus
  // ============================================================

  async getFocus(projectId: string): Promise<ProjectFocus | null> {
    const rs = await this.client.execute({
      sql: `SELECT pf.project_id, pf.feature_id, f.title as feature_title, f.state as feature_state
            FROM project_focus pf JOIN features f ON f.id = pf.feature_id
            WHERE pf.project_id = ?`,
      args: [projectId],
    });
    if (rs.rows.length === 0) return null;
    const row = rs.rows[0];
    return {
      project_id: row.project_id as string,
      feature_id: row.feature_id as string,
      feature_title: row.feature_title as string,
      feature_state: row.feature_state as string,
    };
  }

  async setFocus(projectId: string, featureId: string | null): Promise<void> {
    if (!featureId) {
      await this.client.execute({ sql: 'DELETE FROM project_focus WHERE project_id = ?', args: [projectId] });
      return;
    }
    const timestamp = now();
    // Upsert
    await this.client.execute({
      sql: `INSERT INTO project_focus (project_id, feature_id, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET feature_id = ?, updated_at = ?`,
      args: [projectId, featureId, timestamp, featureId, timestamp],
    });
  }

  // ============================================================
  // Features — Query
  // ============================================================

  async getFeature(id: string): Promise<FeatureRow | null> {
    const rs = await this.client.execute({
      sql: `SELECT id, project_id, parent_id, title, details, desired_details, details_summary,
                   state, priority, feature_number, target_version_id,
                   verification_result, verified_at,
                   claimed_by, claimed_at, claim_metadata,
                   created_at, updated_at
            FROM features WHERE id = ?`,
      args: [id],
    });
    return rs.rows.length > 0 ? rowToFeature(rs.rows[0]) : null;
  }

  async getAllFeatures(opts?: { version_id?: string; limit?: number; offset?: number }): Promise<FeatureRow[]> {
    let sql = 'SELECT id, project_id, parent_id, title, details, desired_details, details_summary, state, priority, feature_number, target_version_id, verification_result, verified_at, claimed_by, claimed_at, claim_metadata, created_at, updated_at FROM features';
    const args: InValue[] =[];

    if (opts?.version_id) {
      sql += ' WHERE target_version_id = ?';
      args.push(opts.version_id);
    }

    sql += ' ORDER BY priority, title';

    if (opts?.limit) {
      sql += ' LIMIT ?';
      args.push(opts.limit);
    }
    if (opts?.offset) {
      sql += ' OFFSET ?';
      args.push(opts.offset);
    }

    const rs = await this.client.execute({ sql, args });
    return rs.rows.map(rowToFeature);
  }

  async getFeaturesByProject(projectId: string, opts?: { version_id?: string; state?: string; limit?: number; offset?: number }): Promise<FeatureRow[]> {
    let sql = 'SELECT id, project_id, parent_id, title, details, desired_details, details_summary, state, priority, feature_number, target_version_id, verification_result, verified_at, claimed_by, claimed_at, claim_metadata, created_at, updated_at FROM features WHERE project_id = ?';
    const args: InValue[] =[projectId];

    if (opts?.version_id) {
      sql += ' AND target_version_id = ?';
      args.push(opts.version_id);
    }
    if (opts?.state) {
      sql += ' AND state = ?';
      args.push(opts.state);
    }

    sql += ' ORDER BY priority, title';

    if (opts?.limit) {
      sql += ' LIMIT ?';
      args.push(opts.limit);
    }
    if (opts?.offset) {
      sql += ' OFFSET ?';
      args.push(opts.offset);
    }

    const rs = await this.client.execute({ sql, args });
    return rs.rows.map(rowToFeature);
  }

  async resolveFeatureId(idOrDisplayId: string): Promise<string | null> {
    if (isUuid(idOrDisplayId)) {
      const f = await this.getFeature(idOrDisplayId);
      return f ? f.id : null;
    }

    // Display ID format (KEY-123)
    const match = idOrDisplayId.match(/^([A-Za-z]+)-(\d+)$/);
    if (match) {
      const prefix = match[1].toUpperCase();
      const num = parseInt(match[2], 10);
      const prs = await this.client.execute({
        sql: 'SELECT id FROM projects WHERE UPPER(key_prefix) = ?',
        args: [prefix],
      });
      if (prs.rows.length > 0) {
        const projectId = prs.rows[0].id as string;
        const frs = await this.client.execute({
          sql: 'SELECT id FROM features WHERE project_id = ? AND feature_number = ?',
          args: [projectId, num],
        });
        if (frs.rows.length > 0) return frs.rows[0].id as string;
      }
    }

    // UUID prefix match
    const rs = await this.client.execute({
      sql: 'SELECT id FROM features WHERE id LIKE ?',
      args: [`${idOrDisplayId}%`],
    });
    if (rs.rows.length === 1) return rs.rows[0].id as string;
    return null;
  }

  async resolveFeatureByPrefix(prefix: string, projectId?: string): Promise<FeatureRow | null> {
    let sql = 'SELECT id, project_id, parent_id, title, details, desired_details, details_summary, state, priority, feature_number, target_version_id, verification_result, verified_at, claimed_by, claimed_at, claim_metadata, created_at, updated_at FROM features WHERE id LIKE ?';
    const args: InValue[] =[`${prefix}%`];

    if (projectId) {
      sql += ' AND project_id = ?';
      args.push(projectId);
    }
    sql += ' LIMIT 2';

    const rs = await this.client.execute({ sql, args });
    if (rs.rows.length === 0) return null;
    if (rs.rows.length > 1) throw new ValidationError('Ambiguous feature ID prefix');
    return rowToFeature(rs.rows[0]);
  }

  async getChildren(parentId: string): Promise<FeatureRow[]> {
    const rs = await this.client.execute({
      sql: `SELECT id, project_id, parent_id, title, details, desired_details, details_summary,
                   state, priority, feature_number, target_version_id,
                   verification_result, verified_at,
                   claimed_by, claimed_at, claim_metadata,
                   created_at, updated_at
            FROM features WHERE parent_id = ? ORDER BY priority, title`,
      args: [parentId],
    });
    return rs.rows.map(rowToFeature);
  }

  async getRootFeatures(projectId: string): Promise<FeatureRow[]> {
    const rootRs = await this.client.execute({
      sql: 'SELECT root_feature_id FROM projects WHERE id = ?',
      args: [projectId],
    });
    const rootId = rootRs.rows[0]?.root_feature_id as string | null;
    if (rootId) {
      return this.getChildren(rootId);
    }
    // Legacy projects without root
    const rs = await this.client.execute({
      sql: `SELECT id, project_id, parent_id, title, details, desired_details, details_summary,
                   state, priority, feature_number, target_version_id,
                   verification_result, verified_at,
                   claimed_by, claimed_at, claim_metadata,
                   created_at, updated_at
            FROM features WHERE project_id = ? AND parent_id IS NULL ORDER BY priority, title`,
      args: [projectId],
    });
    return rs.rows.map(rowToFeature);
  }

  async isLeaf(featureId: string): Promise<boolean> {
    const rs = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM features WHERE parent_id = ?',
      args: [featureId],
    });
    return (rs.rows[0].count as number) === 0;
  }

  // ============================================================
  // Features — Search
  // ============================================================

  async searchFeatures(query: string, opts?: { project_id?: string; state?: string; limit?: number }): Promise<FeatureRow[]> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      throw new ValidationError('Search query is required');
    }
    if (trimmedQuery.length > 1000) {
      throw new ValidationError('Search query cannot exceed 1000 characters');
    }

    const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
    const escaped = escapeLikePattern(trimmedQuery);
    const pattern = `%${escaped}%`;

    // Try to extract feature number
    let featureNumber: number | null = null;
    const numMatch = trimmedQuery.match(/^(?:[A-Za-z]+-)?(\d+)$/);
    if (numMatch) featureNumber = parseInt(numMatch[1], 10);

    let sql: string;
    const args: InValue[] =[];

    if (opts?.project_id && featureNumber !== null) {
      sql = `SELECT id, project_id, parent_id, title, details, desired_details, details_summary,
                    state, priority, feature_number, target_version_id,
                    verification_result, verified_at,
                    claimed_by, claimed_at, claim_metadata, created_at, updated_at
             FROM features
             WHERE project_id = ? AND (feature_number = ? OR title LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\')`;
      args.push(opts.project_id, featureNumber, pattern, pattern);
      if (opts?.state) {
        sql += ' AND state = ?';
        args.push(opts.state);
      }
      sql += ` ORDER BY CASE WHEN feature_number = ? THEN 0 WHEN title LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END, priority, title LIMIT ?`;
      args.push(featureNumber, pattern, limit);
    } else if (opts?.project_id) {
      sql = `SELECT id, project_id, parent_id, title, details, desired_details, details_summary,
                    state, priority, feature_number, target_version_id,
                    verification_result, verified_at,
                    claimed_by, claimed_at, claim_metadata, created_at, updated_at
             FROM features
             WHERE project_id = ? AND (title LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\')`;
      args.push(opts.project_id, pattern, pattern);
      if (opts?.state) {
        sql += ' AND state = ?';
        args.push(opts.state);
      }
      sql += ` ORDER BY CASE WHEN title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, priority, title LIMIT ?`;
      args.push(pattern, limit);
    } else if (featureNumber !== null) {
      sql = `SELECT id, project_id, parent_id, title, details, desired_details, details_summary,
                    state, priority, feature_number, target_version_id,
                    verification_result, verified_at,
                    claimed_by, claimed_at, claim_metadata, created_at, updated_at
             FROM features
             WHERE feature_number = ? OR title LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\'`;
      args.push(featureNumber, pattern, pattern);
      if (opts?.state) {
        sql += ' AND state = ?';
        args.push(opts.state);
      }
      sql += ` ORDER BY CASE WHEN feature_number = ? THEN 0 WHEN title LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END, priority, title LIMIT ?`;
      args.push(featureNumber, pattern, limit);
    } else {
      sql = `SELECT id, project_id, parent_id, title, details, desired_details, details_summary,
                    state, priority, feature_number, target_version_id,
                    verification_result, verified_at,
                    claimed_by, claimed_at, claim_metadata, created_at, updated_at
             FROM features
             WHERE title LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\'`;
      args.push(pattern, pattern);
      if (opts?.state) {
        sql += ' AND state = ?';
        args.push(opts.state);
      }
      sql += ` ORDER BY CASE WHEN title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, priority, title LIMIT ?`;
      args.push(pattern, limit);
    }

    const rs = await this.client.execute({ sql, args });
    return rs.rows.map(rowToFeature);
  }

  // ============================================================
  // Features — Context
  // ============================================================

  async getFeatureContext(featureId: string): Promise<FeatureWithContext | null> {
    const feature = await this.getFeature(featureId);
    if (!feature) return null;

    // Breadcrumb (ancestors via recursive CTE)
    const breadcrumbRs = await this.client.execute({
      sql: `WITH RECURSIVE ancestors AS (
              SELECT id, parent_id, title, details, details_summary, 0 as depth
              FROM features WHERE id = ?
              UNION ALL
              SELECT f.id, f.parent_id, f.title, f.details, f.details_summary, a.depth + 1
              FROM features f
              INNER JOIN ancestors a ON f.id = a.parent_id
            )
            SELECT id, title,
              CASE WHEN parent_id IS NULL AND details_summary IS NOT NULL
                   THEN details_summary
                   ELSE details
              END as details
            FROM ancestors ORDER BY depth DESC`,
      args: [featureId],
    });
    const breadcrumb: BreadcrumbItem[] = breadcrumbRs.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      details: row.details as string | null,
    }));

    // Parent
    let parent: FeatureSummaryContext | null = null;
    if (feature.parent_id) {
      const parentRs = await this.client.execute({
        sql: 'SELECT id, title, state FROM features WHERE id = ?',
        args: [feature.parent_id],
      });
      if (parentRs.rows.length > 0) {
        const row = parentRs.rows[0];
        parent = { id: row.id as string, title: row.title as string, state: row.state as string };
      }
    }

    // Siblings
    let siblingsRs;
    if (feature.parent_id) {
      siblingsRs = await this.client.execute({
        sql: 'SELECT id, title, state FROM features WHERE parent_id = ? AND id != ? ORDER BY priority, title',
        args: [feature.parent_id, featureId],
      });
    } else {
      siblingsRs = await this.client.execute({
        sql: 'SELECT id, title, state FROM features WHERE project_id = ? AND parent_id IS NULL AND id != ? ORDER BY priority, title',
        args: [feature.project_id, featureId],
      });
    }
    const siblings: FeatureSummaryContext[] = siblingsRs.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      state: row.state as string,
    }));

    // Children
    const childrenRs = await this.client.execute({
      sql: 'SELECT id, title, state FROM features WHERE parent_id = ? ORDER BY priority, title',
      args: [featureId],
    });
    const children: FeatureSummaryContext[] = childrenRs.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      state: row.state as string,
    }));

    // Build display_id
    const project = await this.getProject(feature.project_id);
    const displayId = feature.feature_number && project
      ? `${project.key_prefix}-${feature.feature_number}`
      : undefined;

    return {
      id: feature.id,
      display_id: displayId,
      title: feature.title,
      details: feature.details,
      desired_details: feature.desired_details,
      state: feature.state,
      priority: feature.priority,
      target_version_id: feature.target_version_id,
      parent,
      siblings,
      children,
      breadcrumb,
    };
  }

  async getFeatureDiff(featureId: string): Promise<{ has_changes: boolean; current?: string | null; desired?: string | null } | null> {
    const feature = await this.getFeature(featureId);
    if (!feature) return null;
    return {
      has_changes: feature.desired_details != null && feature.desired_details !== feature.details,
      current: feature.details,
      desired: feature.desired_details,
    };
  }

  // ============================================================
  // Features — Create
  // ============================================================

  async createFeature(projectId: string, input: CreateFeatureDbInput): Promise<FeatureRow> {
    const project = await this.getProject(projectId);
    if (!project) throw new NotFoundError('Project');

    let parentId = input.parent_id;
    if (!parentId) {
      const rootRs = await this.client.execute({
        sql: 'SELECT root_feature_id FROM projects WHERE id = ?',
        args: [projectId],
      });
      parentId = rootRs.rows[0]?.root_feature_id as string | null;
    }
    if (!parentId) throw new ValidationError('Feature must have a parent');

    // Auto-assign feature_number
    const numRs = await this.client.execute({
      sql: 'SELECT COALESCE(MAX(feature_number), 0) + 1 as next_num FROM features WHERE project_id = ?',
      args: [projectId],
    });
    const featureNumber = numRs.rows[0].next_num as number;

    // Auto-assign version
    let versionId = input.target_version_id ?? null;
    const state = input.state ?? 'proposed';
    if (state === 'in_progress' || state === 'implemented') {
      versionId = await this.getNextVersionId(projectId);
    } else if (!versionId) {
      const projRs = await this.client.execute({
        sql: 'SELECT default_feature_destination FROM projects WHERE id = ?',
        args: [projectId],
      });
      const dest = projRs.rows[0]?.default_feature_destination as string;
      if (dest === 'next') {
        versionId = await this.getNextVersionId(projectId);
      }
    }

    const id = input.id ?? uuid();
    const timestamp = now();

    await this.client.execute({
      sql: `INSERT INTO features (id, project_id, parent_id, title, details, state, priority,
                                   feature_number, target_version_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, projectId, parentId, input.title, input.details ?? null, state, input.priority ?? 0, featureNumber, versionId, timestamp, timestamp],
    });

    return (await this.getFeature(id))!;
  }

  async createFeaturesBulk(projectId: string, inputs: CreateFeatureDbInput[]): Promise<FeatureRow[]> {
    if (inputs.length > MAX_BULK_FEATURES) {
      throw new ValidationError(`Cannot create more than ${MAX_BULK_FEATURES} features at once`);
    }

    const project = await this.getProject(projectId);
    if (!project) throw new NotFoundError('Project');

    // Get root feature
    const rootRs = await this.client.execute({
      sql: 'SELECT root_feature_id FROM projects WHERE id = ?',
      args: [projectId],
    });
    const rootFeatureId = rootRs.rows[0]?.root_feature_id as string | null;

    // Get starting feature_number
    const numRs = await this.client.execute({
      sql: 'SELECT COALESCE(MAX(feature_number), 0) as max_num FROM features WHERE project_id = ?',
      args: [projectId],
    });
    let nextNum = (numRs.rows[0].max_num as number) + 1;

    // Get project defaults
    const projRs = await this.client.execute({
      sql: 'SELECT default_feature_destination FROM projects WHERE id = ?',
      args: [projectId],
    });
    const dest = projRs.rows[0]?.default_feature_destination as string;
    const nextVersionId = await this.getNextVersionId(projectId);

    const timestamp = now();
    const stmts: InStatement[] = [];
    const ids: string[] = [];

    for (const input of inputs) {
      const id = input.id ?? uuid();
      ids.push(id);
      const parentId = input.parent_id ?? rootFeatureId;
      const state = input.state ?? 'proposed';

      let versionId = input.target_version_id ?? null;
      if (state === 'in_progress' || state === 'implemented') {
        versionId = nextVersionId;
      } else if (!versionId && dest === 'next') {
        versionId = nextVersionId;
      }

      stmts.push({
        sql: `INSERT INTO features (id, project_id, parent_id, title, details, state, priority,
                                     feature_number, target_version_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, projectId, parentId, input.title, input.details ?? null, state, input.priority ?? 0, nextNum++, versionId, timestamp, timestamp],
      });
    }

    await this.client.batch(stmts, 'write');

    // Fetch all created features
    const features: FeatureRow[] = [];
    for (const id of ids) {
      const f = await this.getFeature(id);
      if (f) features.push(f);
    }
    return features;
  }

  // ============================================================
  // Features — Update
  // ============================================================

  async updateFeature(id: string, input: UpdateFeatureDbInput): Promise<FeatureRow | null> {
    const feature = await this.getFeature(id);
    if (!feature) return null;

    const timestamp = now();
    const isLeaf = await this.isLeaf(id);

    // Resolve desired_details
    let details = input.details !== undefined ? input.details : feature.details;
    let desiredDetails = feature.desired_details;

    if (input.desired_details !== undefined) {
      if (feature.state !== 'implemented') {
        // Non-implemented: apply desired_details directly to details
        details = input.desired_details;
        desiredDetails = null;
      } else {
        desiredDetails = input.desired_details;
        // Clear if matches current details
        if (desiredDetails === details) desiredDetails = null;
      }
    }

    // State transition validation
    let newState = input.state ?? feature.state;

    if (input.state && input.state !== feature.state) {
      // Feature sets can only transition proposed ↔ blocked
      if (!isLeaf) {
        const allowedSetTransitions =
          (feature.state === 'proposed' && input.state === 'blocked') ||
          (feature.state === 'blocked' && input.state === 'proposed');
        if (!allowedSetTransitions) {
          throw new ValidationError('Feature sets can only transition between proposed and blocked');
        }
      }

      // Blocked state validation
      if (input.state === 'blocked') {
        if (feature.state !== 'proposed') {
          throw new ValidationError('Only proposed features can be blocked');
        }
        if (!input.blocked_by || input.blocked_by.length === 0) {
          throw new ValidationError('Blocked state requires at least one blocker');
        }
        // Validate blockers
        for (const blockerId of input.blocked_by) {
          if (blockerId === id) throw new ValidationError('Feature cannot block itself');
          const blocker = await this.getFeature(blockerId);
          if (!blocker) throw new NotFoundError('Blocker feature');
          if (blocker.project_id !== feature.project_id) {
            throw new ValidationError('Blocker must be in the same project');
          }
        }
      }

      // Unblocking: blocked → proposed only
      if (feature.state === 'blocked' && input.state !== 'proposed' && input.state !== 'blocked') {
        throw new ValidationError('Blocked features can only transition to proposed');
      }
    }

    // Version assignment
    let versionId = feature.target_version_id;
    if (input.clear_version) {
      versionId = null;
    } else if (input.target_version_id !== undefined) {
      versionId = input.target_version_id;
      // Validate not released
      if (versionId) {
        await this.validateVersionNotReleased(versionId);
      }
    }

    // Auto-assign version for in-progress/implemented
    if (newState === 'in_progress' && !versionId) {
      versionId = await this.getNextVersionId(feature.project_id);
    }
    if (newState === 'implemented' && !versionId) {
      versionId = await this.getNextVersionId(feature.project_id);
    }

    // Field-level timestamps
    const stateChanged = newState !== feature.state;
    const detailsChanged = details !== feature.details;
    const parentChanged = input.parent_id !== undefined && input.parent_id !== feature.parent_id;

    await this.client.execute({
      sql: `UPDATE features SET
              parent_id = ?, title = ?, details = ?, desired_details = ?,
              details_summary = ?, state = ?, priority = ?, target_version_id = ?,
              updated_at = ?,
              state_updated_at = CASE WHEN ? THEN ? ELSE state_updated_at END,
              details_updated_at = CASE WHEN ? THEN ? ELSE details_updated_at END,
              parent_id_updated_at = CASE WHEN ? THEN ? ELSE parent_id_updated_at END
            WHERE id = ?`,
      args: [
        (input.parent_id !== undefined ? input.parent_id : feature.parent_id) ?? null,
        input.title ?? feature.title,
        details ?? null,
        desiredDetails ?? null,
        (input.details_summary !== undefined ? input.details_summary : (feature.details_summary ?? null)) ?? null,
        newState,
        input.priority ?? feature.priority,
        versionId ?? null,
        timestamp,
        stateChanged ? 1 : 0, timestamp,
        detailsChanged ? 1 : 0, timestamp,
        parentChanged ? 1 : 0, timestamp,
        id,
      ],
    });

    // Handle blockers
    if (input.state === 'blocked' && input.blocked_by) {
      await this.setFeatureBlockers(id, input.blocked_by);
    }
    if (feature.state === 'blocked' && newState === 'proposed') {
      await this.clearFeatureBlockers(id);
    }

    // Auto-resolve blocked features when implemented
    if (newState === 'implemented' && feature.state !== 'implemented') {
      await this.autoResolveBlockedFeatures(id);
    }

    return this.getFeature(id);
  }

  // ============================================================
  // Features — Delete
  // ============================================================

  async deleteFeature(id: string): Promise<boolean> {
    // Delete history for descendants first
    await this.client.execute({
      sql: `DELETE FROM feature_history WHERE feature_id IN (
              WITH RECURSIVE descendants AS (
                SELECT id FROM features WHERE id = ?
                UNION ALL
                SELECT f.id FROM features f
                INNER JOIN descendants d ON f.parent_id = d.id
              )
              SELECT id FROM descendants
            )`,
      args: [id],
    });

    // Delete proofs for descendants
    await this.client.execute({
      sql: `DELETE FROM proofs WHERE feature_id IN (
              WITH RECURSIVE descendants AS (
                SELECT id FROM features WHERE id = ?
                UNION ALL
                SELECT f.id FROM features f
                INNER JOIN descendants d ON f.parent_id = d.id
              )
              SELECT id FROM descendants
            )`,
      args: [id],
    });

    // Delete features
    const rs = await this.client.execute({
      sql: `DELETE FROM features WHERE id IN (
              WITH RECURSIVE descendants AS (
                SELECT id FROM features WHERE id = ?
                UNION ALL
                SELECT f.id FROM features f
                INNER JOIN descendants d ON f.parent_id = d.id
              )
              SELECT id FROM descendants
            )`,
      args: [id],
    });

    return (rs.rowsAffected ?? 0) > 0;
  }

  // ============================================================
  // Features — Blockers
  // ============================================================

  async getFeatureBlockers(featureId: string): Promise<FeatureSummaryContext[]> {
    const rs = await this.client.execute({
      sql: `SELECT f.id, f.title, f.state
            FROM feature_blockers fb
            JOIN features f ON f.id = fb.blocker_feature_id
            WHERE fb.feature_id = ?
            ORDER BY f.priority, f.title`,
      args: [featureId],
    });
    return rs.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      state: row.state as string,
    }));
  }

  async getFeatureDependents(featureId: string): Promise<FeatureSummaryContext[]> {
    const rs = await this.client.execute({
      sql: `SELECT f.id, f.title, f.state
            FROM feature_blockers fb
            JOIN features f ON f.id = fb.feature_id
            WHERE fb.blocker_feature_id = ?
            ORDER BY f.priority, f.title`,
      args: [featureId],
    });
    return rs.rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      state: row.state as string,
    }));
  }

  async findBlockedAncestor(featureId: string): Promise<{ id: string; title: string } | null> {
    const rs = await this.client.execute({
      sql: `WITH RECURSIVE ancestors AS (
              SELECT parent_id FROM features WHERE id = ?
              UNION ALL
              SELECT f.parent_id FROM features f
              INNER JOIN ancestors a ON f.id = a.parent_id
              WHERE f.parent_id IS NOT NULL
            )
            SELECT f.id, f.title FROM features f
            INNER JOIN ancestors a ON f.id = a.parent_id
            WHERE f.state = 'blocked'
            LIMIT 1`,
      args: [featureId],
    });
    if (rs.rows.length === 0) return null;
    return { id: rs.rows[0].id as string, title: rs.rows[0].title as string };
  }

  async setFeatureBlockers(featureId: string, blockerIds: string[]): Promise<void> {
    const timestamp = now();
    const stmts: InStatement[] = [
      { sql: 'DELETE FROM feature_blockers WHERE feature_id = ?', args: [featureId] },
    ];
    for (const blockerId of blockerIds) {
      stmts.push({
        sql: 'INSERT INTO feature_blockers (feature_id, blocker_feature_id, created_at) VALUES (?, ?, ?)',
        args: [featureId, blockerId, timestamp],
      });
    }
    await this.client.batch(stmts, 'write');
  }

  async clearFeatureBlockers(featureId: string): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM feature_blockers WHERE feature_id = ?',
      args: [featureId],
    });
  }

  async autoResolveBlockedFeatures(implementedFeatureId: string): Promise<void> {
    // Find features blocked by this one
    const blockedRs = await this.client.execute({
      sql: 'SELECT feature_id FROM feature_blockers WHERE blocker_feature_id = ?',
      args: [implementedFeatureId],
    });

    const timestamp = now();
    for (const row of blockedRs.rows) {
      const fid = row.feature_id as string;
      // Check if ALL blockers are now implemented
      const remainingRs = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM feature_blockers fb
              JOIN features f ON f.id = fb.blocker_feature_id
              WHERE fb.feature_id = ? AND f.state != 'implemented'`,
        args: [fid],
      });
      if ((remainingRs.rows[0].count as number) === 0) {
        await this.client.execute({
          sql: `UPDATE features SET state = 'proposed', updated_at = ?, state_updated_at = ? WHERE id = ? AND state = 'blocked'`,
          args: [timestamp, timestamp, fid],
        });
        await this.clearFeatureBlockers(fid);
      }
    }
  }

  // ============================================================
  // Features — Claim & Complete
  // ============================================================

  async claimFeature(id: string, opts: ClaimOpts): Promise<FeatureRow> {
    const feature = await this.getFeature(id);
    if (!feature) throw new NotFoundError('Feature');

    if (feature.claimed_by && feature.state === 'in_progress' && !opts.force) {
      throw new ConflictError('Feature already claimed', {
        agent_type: feature.claimed_by,
        feature_id: feature.id,
        claimed_at: feature.claimed_at,
        claim_metadata: feature.claim_metadata,
      });
    }

    let newState = feature.state;
    if (feature.state === 'proposed' || feature.state === 'implemented') {
      newState = 'in_progress';
    }

    let versionId = feature.target_version_id;
    if (newState === 'in_progress') {
      versionId = (await this.getNextVersionId(feature.project_id)) ?? versionId;
    }

    const timestamp = now();
    await this.client.execute({
      sql: `UPDATE features SET state = ?, claimed_by = ?, claimed_at = ?, claim_metadata = ?,
                                target_version_id = ?, state_updated_at = ?, updated_at = ?
            WHERE id = ?`,
      args: [newState, opts.agent_type, timestamp, opts.metadata ?? null, versionId ?? null, timestamp, timestamp, id],
    });

    return (await this.getFeature(id))!;
  }

  async getInProgressLeafFeatures(projectId: string): Promise<FeatureRow[]> {
    const rs = await this.client.execute({
      sql: `SELECT f.id, f.project_id, f.parent_id, f.title, f.details, f.desired_details, f.details_summary,
                   f.state, f.priority, f.feature_number, f.target_version_id,
                   f.verification_result, f.verified_at,
                   f.claimed_by, f.claimed_at, f.claim_metadata, f.created_at, f.updated_at
            FROM features f
            WHERE f.project_id = ? AND f.state = 'in_progress'
              AND NOT EXISTS (SELECT 1 FROM features c WHERE c.parent_id = f.id)`,
      args: [projectId],
    });
    return rs.rows.map(rowToFeature);
  }

  async getNextWorkableFeature(projectId: string): Promise<FeatureRow | null> {
    const nextVersionId = await this.getNextVersionId(projectId);

    let sql = `SELECT f.id, f.project_id, f.parent_id, f.title, f.details, f.desired_details, f.details_summary,
                      f.state, f.priority, f.feature_number, f.target_version_id,
                      f.verification_result, f.verified_at,
                      f.claimed_by, f.claimed_at, f.claim_metadata, f.created_at, f.updated_at
               FROM features f
               WHERE f.project_id = ? AND f.state = 'proposed'
                 AND NOT EXISTS (SELECT 1 FROM features c WHERE c.parent_id = f.id)`;
    const args: InValue[] =[projectId];

    if (nextVersionId) {
      sql += ' AND (f.target_version_id = ? OR f.target_version_id IS NULL)';
      args.push(nextVersionId);
    }

    sql += ' ORDER BY f.priority DESC, f.created_at ASC LIMIT 1';

    const rs = await this.client.execute({ sql, args });
    return rs.rows.length > 0 ? rowToFeature(rs.rows[0]) : null;
  }

  async completeFeature(id: string, input: CompleteInput): Promise<CompletionResult> {
    const feature = await this.getFeature(id);
    if (!feature) throw new NotFoundError('Feature');

    // Must be a leaf
    if (!(await this.isLeaf(id))) {
      throw new ValidationError('Cannot complete a non-leaf feature');
    }

    const warnings: string[] = [];

    if (!input.backfill) {
      if (!feature.details || feature.details.trim() === '') {
        throw new ValidationError('Feature has no specification. Call update_feature to add details.');
      }

      const proof = await this.getLatestProof(id);
      if (!proof) {
        throw new ValidationError('No proof recorded. Call prove_feature first.');
      }
      if (proof.exit_code !== 0) {
        throw new ValidationError('Latest proof has failing tests (exit_code !== 0).');
      }

      // Advisory warnings
      if (proof.tests === null || proof.tests === '[]') {
        warnings.push('Proof recorded but has no structured test results.');
      }
      if (feature.claimed_at && feature.updated_at <= feature.claimed_at) {
        warnings.push('Feature spec not updated since work started.');
      }
    }

    const timestamp = now();
    const historyId = uuid();
    const commits = input.commits ? JSON.stringify(input.commits) : null;

    await this.client.execute({
      sql: `INSERT INTO feature_history (id, feature_id, version_id, summary, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [historyId, id, feature.target_version_id ?? null, input.summary, commits, timestamp],
    });

    await this.client.execute({
      sql: `UPDATE features SET state = 'implemented', desired_details = NULL,
                                claimed_by = NULL, claimed_at = NULL, claim_metadata = NULL,
                                state_updated_at = ?, updated_at = ?
            WHERE id = ?`,
      args: [timestamp, timestamp, id],
    });

    // Auto-resolve blocked features
    await this.autoResolveBlockedFeatures(id);

    const updated = (await this.getFeature(id))!;
    const history: FeatureHistory = {
      id: historyId,
      feature_id: id,
      summary: input.summary,
      author: feature.claimed_by ?? 'unknown',
      created_at: timestamp,
    };

    return { feature: updated, history, warnings };
  }

  // ============================================================
  // Features — Tree
  // ============================================================

  async getFeatureTree(projectId: string): Promise<FeatureTreeNode[]> {
    const project = await this.getProject(projectId);
    if (!project) throw new NotFoundError('Project');

    const rootRs = await this.client.execute({
      sql: 'SELECT root_feature_id FROM projects WHERE id = ?',
      args: [projectId],
    });
    const rootFeatureId = rootRs.rows[0]?.root_feature_id as string | null;

    const rs = await this.client.execute({
      sql: `SELECT id, project_id, parent_id, title, details, desired_details, details_summary,
                   state, priority, feature_number, target_version_id,
                   verification_result, verified_at,
                   claimed_by, claimed_at, claim_metadata,
                   created_at, updated_at
            FROM features WHERE project_id = ? ORDER BY priority, title`,
      args: [projectId],
    });

    const features = rs.rows.map(rowToFeature);
    const childrenMap = new Map<string | null, FeatureRow[]>();
    let rootFeature: FeatureRow | null = null;

    for (const f of features) {
      if (f.id === rootFeatureId) {
        rootFeature = f;
        continue;
      }
      const parentKey = f.parent_id ?? null;
      if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
      childrenMap.get(parentKey)!.push(f);
    }

    function buildSubtree(parentId: string | null): FeatureTreeNode[] {
      const children = childrenMap.get(parentId) ?? [];
      return children.map((f) => {
        const subtree = buildSubtree(f.id);
        const node: FeatureTreeNode = { ...f, children: subtree };
        if (subtree.length > 0) {
          const derived = deriveState(subtree.map((c) => c.state));
          if (derived) node.state = derived;
        }
        return node;
      });
    }

    if (rootFeature) {
      const children = buildSubtree(rootFeature.id);
      return [{ ...rootFeature, children, is_root: true }];
    }

    return buildSubtree(null);
  }

  // ============================================================
  // Features — Verification
  // ============================================================

  async recordVerification(featureId: string, result: unknown): Promise<void> {
    const timestamp = now();
    await this.client.execute({
      sql: 'UPDATE features SET verification_result = ?, verified_at = ?, updated_at = ? WHERE id = ?',
      args: [JSON.stringify(result), timestamp, timestamp, featureId],
    });
  }

  // ============================================================
  // Versions
  // ============================================================

  async getVersionsByProject(projectId: string): Promise<Version[]> {
    const rs = await this.client.execute({
      sql: 'SELECT id, project_id, name, description, released_at, created_at, updated_at FROM versions WHERE project_id = ? ORDER BY created_at',
      args: [projectId],
    });
    return rs.rows.map(rowToVersion);
  }

  async getVersion(id: string): Promise<Version | null> {
    const rs = await this.client.execute({
      sql: 'SELECT id, project_id, name, description, released_at, created_at, updated_at FROM versions WHERE id = ?',
      args: [id],
    });
    return rs.rows.length > 0 ? rowToVersion(rs.rows[0]) : null;
  }

  async getNextVersionId(projectId: string): Promise<string | null> {
    const rs = await this.client.execute({
      sql: 'SELECT id FROM versions WHERE project_id = ? AND released_at IS NULL ORDER BY created_at ASC LIMIT 1',
      args: [projectId],
    });
    return rs.rows.length > 0 ? (rs.rows[0].id as string) : null;
  }

  async createVersion(projectId: string, input: CreateVersionInput): Promise<Version> {
    // Check unreleased count (max 6)
    const countRs = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM versions WHERE project_id = ? AND released_at IS NULL',
      args: [projectId],
    });
    if ((countRs.rows[0].count as number) >= 6) {
      throw new ValidationError('Maximum 6 unreleased versions allowed');
    }

    const id = uuid();
    const timestamp = now();
    await this.client.execute({
      sql: 'INSERT INTO versions (id, project_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, projectId, input.name, input.description ?? null, timestamp, timestamp],
    });
    return (await this.getVersion(id))!;
  }

  async updateVersion(id: string, input: UpdateVersionInput): Promise<Version | null> {
    const existing = await this.getVersion(id);
    if (!existing) return null;

    const wasUnreleased = !existing.released_at;
    const timestamp = now();

    await this.client.execute({
      sql: 'UPDATE versions SET name = ?, description = ?, released_at = ?, updated_at = ? WHERE id = ?',
      args: [
        input.name ?? existing.name,
        (input.description !== undefined ? input.description : existing.description) ?? null,
        (input.released_at !== undefined ? input.released_at : existing.released_at) ?? null,
        timestamp,
        id,
      ],
    });

    // If releasing: create history on root feature + ensure min versions
    const releasedAt = input.released_at !== undefined ? input.released_at : existing.released_at;
    if (wasUnreleased && releasedAt) {
      // Create history entry on root feature
      const rootRs = await this.client.execute({
        sql: 'SELECT root_feature_id FROM projects WHERE id = ?',
        args: [existing.project_id],
      });
      const rootId = rootRs.rows[0]?.root_feature_id as string;
      if (rootId) {
        await this.client.execute({
          sql: 'INSERT INTO feature_history (id, feature_id, version_id, summary, created_at) VALUES (?, ?, ?, ?, ?)',
          args: [uuid(), rootId, id, `Released ${input.name ?? existing.name}`, timestamp],
        });
      }

      // Ensure minimum 4 unreleased versions
      await this.ensureMinimumVersions(existing.project_id, 4);
    }

    return this.getVersion(id);
  }

  async deleteVersion(id: string): Promise<boolean> {
    const rs = await this.client.execute({ sql: 'DELETE FROM versions WHERE id = ?', args: [id] });
    return (rs.rowsAffected ?? 0) > 0;
  }

  async releaseVersion(id: string): Promise<Version | null> {
    return this.updateVersion(id, { released_at: now() });
  }

  async setFeatureVersion(featureId: string, versionId: string | null): Promise<void> {
    if (versionId) {
      await this.validateVersionNotReleased(versionId);
    }
    const timestamp = now();
    await this.client.execute({
      sql: 'UPDATE features SET target_version_id = ?, updated_at = ? WHERE id = ?',
      args: [versionId, timestamp, featureId],
    });
  }

  async validateVersionNotReleased(versionId: string): Promise<void> {
    const v = await this.getVersion(versionId);
    if (!v) throw new NotFoundError('Version');
    if (v.released_at) throw new ValidationError('Cannot assign to a released version');
  }

  async ensureMinimumVersions(projectId: string, minCount: number): Promise<Version[]> {
    const countRs = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM versions WHERE project_id = ? AND released_at IS NULL',
      args: [projectId],
    });
    const current = countRs.rows[0].count as number;
    if (current >= minCount) return [];

    // Find highest version name to increment from (sort all versions, pick max)
    const allVersions = await this.getVersionsByProject(projectId);
    const sorted = allVersions
      .map((v) => v.name)
      .sort((a, b) => {
        const pa = a.replace(/^v/, '').split('.').map(Number);
        const pb = b.replace(/^v/, '').split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
        }
        return 0;
      });
    let lastVersion = sorted[sorted.length - 1] ?? '0.0.0';

    const created: Version[] = [];
    for (let i = current; i < minCount; i++) {
      const name = incrementVersion(lastVersion);
      lastVersion = name;
      const v = await this.createVersion(projectId, { name });
      created.push(v);
    }
    return created;
  }

  // ============================================================
  // Proofs
  // ============================================================

  async createProof(featureId: string, input: CreateProofInput): Promise<Proof> {
    const feature = await this.getFeature(featureId);
    if (!feature) throw new NotFoundError('Feature');

    const id = uuid();
    const timestamp = now();
    const tests = input.tests || input.test_suites ? JSON.stringify(input.tests ?? input.test_suites) : null;
    const evidence = input.evidence ? JSON.stringify(input.evidence) : null;
    // Truncate output to 10K chars
    const output = input.output ? input.output.slice(0, 10_000) : null;

    await this.client.execute({
      sql: `INSERT INTO proofs (id, feature_id, command, exit_code, output, tests, evidence, commit_sha, agent_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, featureId, input.command, input.exit_code, output, tests, evidence, input.commit_sha ?? null, feature.claimed_by ?? null, timestamp],
    });

    return { id, feature_id: featureId, command: input.command, exit_code: input.exit_code, output, tests, evidence, commit_sha: input.commit_sha ?? null, agent_type: feature.claimed_by ?? null, created_at: timestamp };
  }

  async getProof(id: string): Promise<Proof | null> {
    const rs = await this.client.execute({
      sql: 'SELECT id, feature_id, history_id, command, exit_code, output, tests, evidence, commit_sha, agent_type, created_at FROM proofs WHERE id = ?',
      args: [id],
    });
    return rs.rows.length > 0 ? rowToProof(rs.rows[0]) : null;
  }

  async getProofsForFeature(featureId: string): Promise<Proof[]> {
    const rs = await this.client.execute({
      sql: 'SELECT id, feature_id, history_id, command, exit_code, output, tests, evidence, commit_sha, agent_type, created_at FROM proofs WHERE feature_id = ? ORDER BY created_at DESC',
      args: [featureId],
    });
    return rs.rows.map(rowToProof);
  }

  async getLatestProof(featureId: string): Promise<Proof | null> {
    const rs = await this.client.execute({
      sql: 'SELECT id, feature_id, history_id, command, exit_code, output, tests, evidence, commit_sha, agent_type, created_at FROM proofs WHERE feature_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [featureId],
    });
    return rs.rows.length > 0 ? rowToProof(rs.rows[0]) : null;
  }

  // ============================================================
  // History
  // ============================================================

  async createHistoryEntry(featureId: string, input: CreateHistoryInput): Promise<FeatureHistory> {
    const feature = await this.getFeature(featureId);
    if (!feature) throw new NotFoundError('Feature');

    const id = uuid();
    const timestamp = now();
    const versionId = input.version_id ?? feature.target_version_id ?? null;
    const commits = input.commits ? JSON.stringify(input.commits) : null;

    await this.client.execute({
      sql: 'INSERT INTO feature_history (id, feature_id, version_id, summary, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, featureId, versionId, input.summary, commits, timestamp],
    });

    return { id, feature_id: featureId, summary: input.summary, author: feature.claimed_by ?? 'unknown', created_at: timestamp };
  }

  async getFeatureHistory(featureId: string): Promise<FeatureHistory[]> {
    const rs = await this.client.execute({
      sql: 'SELECT id, feature_id, summary, details, created_at FROM feature_history WHERE feature_id = ? ORDER BY created_at DESC',
      args: [featureId],
    });
    return rs.rows.map(rowToHistory);
  }

  async getProjectHistory(projectId: string, opts?: { version_id?: string; limit?: number; offset?: number; since?: string }): Promise<Array<{ id: string; feature_id: string; feature_title: string; feature_state: string; version_id?: string | null; version_name?: string | null; summary: string; details?: string | null; created_at: string }>> {
    let sql = `SELECT fh.id, fh.feature_id, f.title as feature_title, f.state as feature_state,
                      fh.version_id, v.name as version_name, fh.summary, fh.details, fh.created_at
               FROM feature_history fh
               JOIN features f ON fh.feature_id = f.id
               LEFT JOIN versions v ON fh.version_id = v.id
               WHERE f.project_id = ?`;
    const args: InValue[] =[projectId];

    if (opts?.version_id) {
      sql += ' AND fh.version_id = ?';
      args.push(opts.version_id);
    }
    if (opts?.since) {
      sql += ' AND fh.created_at > ?';
      args.push(opts.since);
    }

    sql += ' ORDER BY fh.created_at DESC';

    const limit = opts?.limit ?? 50;
    sql += ' LIMIT ?';
    args.push(limit);

    if (opts?.offset) {
      sql += ' OFFSET ?';
      args.push(opts.offset);
    }

    const rs = await this.client.execute({ sql, args });
    return rs.rows.map((row) => ({
      id: row.id as string,
      feature_id: row.feature_id as string,
      feature_title: row.feature_title as string,
      feature_state: row.feature_state as string,
      version_id: row.version_id as string | null,
      version_name: row.version_name as string | null,
      summary: row.summary as string,
      details: row.details as string | null,
      created_at: row.created_at as string,
    }));
  }

  // ============================================================
  // Templates
  // ============================================================

  async getDefaultTemplate(projectId: string): Promise<SpecTemplate | null> {
    const rs = await this.client.execute({
      sql: 'SELECT id, project_id, name, description, content, is_default, created_at, updated_at FROM spec_templates WHERE project_id = ? AND is_default = 1',
      args: [projectId],
    });
    return rs.rows.length > 0 ? rowToTemplate(rs.rows[0]) : null;
  }

  async upsertTemplate(projectId: string, input: { name?: string; description?: string; content?: string }): Promise<SpecTemplate> {
    const existing = await this.getDefaultTemplate(projectId);
    const timestamp = now();

    if (existing) {
      await this.client.execute({
        sql: 'UPDATE spec_templates SET name = ?, description = ?, content = ?, updated_at = ? WHERE id = ?',
        args: [
          input.name ?? existing.name,
          (input.description ?? existing.description) ?? null,
          input.content ?? existing.content,
          timestamp,
          existing.id,
        ],
      });
      return (await this.getDefaultTemplate(projectId))!;
    }

    const id = uuid();
    await this.client.execute({
      sql: 'INSERT INTO spec_templates (id, project_id, name, description, content, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      args: [id, projectId, input.name ?? 'Default', input.description ?? null, input.content ?? DEFAULT_SPEC_TEMPLATE, timestamp, timestamp],
    });
    return (await this.getDefaultTemplate(projectId))!;
  }

  // ============================================================
  // Portfolio
  // ============================================================

  async getPortfolio(): Promise<PortfolioProject[]> {
    const projects = await this.getAllProjects();
    const result: PortfolioProject[] = [];

    for (const project of projects) {
      // Next version
      const nvRs = await this.client.execute({
        sql: `SELECT v.id, v.name,
                COUNT(CASE WHEN f.state != 'archived' THEN 1 END) as feature_count,
                SUM(CASE WHEN f.state = 'implemented' THEN 1 ELSE 0 END) as implemented_count
              FROM versions v
              LEFT JOIN features f ON f.target_version_id = v.id AND f.project_id = ? AND f.parent_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM features c WHERE c.parent_id = f.id)
              WHERE v.project_id = ? AND v.released_at IS NULL
              GROUP BY v.id, v.name
              ORDER BY v.created_at ASC
              LIMIT 1`,
        args: [project.id, project.id],
      });
      const nextVersion = nvRs.rows.length > 0 ? {
        id: nvRs.rows[0].id as string,
        name: nvRs.rows[0].name as string,
        feature_count: (nvRs.rows[0].feature_count as number) ?? 0,
        implemented_count: (nvRs.rows[0].implemented_count as number) ?? 0,
      } : null;

      // Next feature
      const nfRs = await this.client.execute({
        sql: `SELECT f.id, f.title, f.target_version_id
              FROM features f
              LEFT JOIN versions v ON v.id = f.target_version_id AND v.released_at IS NULL
              WHERE f.project_id = ? AND f.state = 'proposed' AND f.parent_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM features c WHERE c.parent_id = f.id)
              ORDER BY CASE WHEN v.id IS NOT NULL THEN 0 ELSE 1 END, f.priority ASC, f.created_at ASC
              LIMIT 1`,
        args: [project.id],
      });
      const nextFeature = nfRs.rows.length > 0 ? {
        id: nfRs.rows[0].id as string,
        title: nfRs.rows[0].title as string,
        in_version: nfRs.rows[0].target_version_id != null,
      } : null;

      // In-progress
      const ipRs = await this.client.execute({
        sql: `SELECT f.id, f.title FROM features f
              WHERE f.project_id = ? AND f.state = 'in_progress' AND f.parent_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM features c WHERE c.parent_id = f.id)
              ORDER BY f.priority ASC, f.created_at ASC`,
        args: [project.id],
      });
      const inProgress = ipRs.rows.map((r) => ({ id: r.id as string, title: r.title as string }));

      // Blocked
      const blRs = await this.client.execute({
        sql: `SELECT f.id, f.title FROM features f
              WHERE f.project_id = ? AND f.state = 'blocked' AND f.parent_id IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM features c WHERE c.parent_id = f.id)
              ORDER BY f.priority ASC, f.created_at ASC`,
        args: [project.id],
      });
      const blocked = blRs.rows.map((r) => ({ id: r.id as string, title: r.title as string }));

      // Recent completions (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const rcRs = await this.client.execute({
        sql: `SELECT f.id, f.title, MAX(fh.created_at) as created_at
              FROM feature_history fh
              JOIN features f ON fh.feature_id = f.id
              WHERE f.project_id = ? AND fh.created_at > ?
              GROUP BY f.id, f.title
              ORDER BY created_at DESC
              LIMIT 5`,
        args: [project.id, sevenDaysAgo],
      });
      const recentCompletions = rcRs.rows.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        created_at: r.created_at as string,
      }));

      // Last activity
      const laRs = await this.client.execute({
        sql: `SELECT MAX(fh.created_at) as last_at
              FROM feature_history fh JOIN features f ON fh.feature_id = f.id
              WHERE f.project_id = ?`,
        args: [project.id],
      });
      const lastActivityAt = laRs.rows[0]?.last_at as string | null;

      result.push({
        id: project.id,
        name: project.name,
        slug: project.slug,
        next_version: nextVersion,
        next_feature: nextFeature,
        in_progress: inProgress.slice(0, 5),
        in_progress_total: inProgress.length,
        blocked: blocked.slice(0, 5),
        blocked_count: blocked.length,
        recent_completions: recentCompletions,
        last_activity_at: lastActivityAt,
      });
    }

    return result;
  }
}

// ============================================================
// Row mapping helpers
// ============================================================

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    key_prefix: row.key_prefix as string,
    description: row.description as string | null,
    instructions: row.instructions as string | null,
    current_version_id: row.current_version_id as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToDirectory(row: Record<string, unknown>): ProjectDirectory {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    path: row.path as string,
    git_remote: row.git_remote as string | null,
    is_primary: row.is_primary === 1,
    instructions: row.instructions as string | null,
    created_at: row.created_at as string,
  };
}

function rowToFeature(row: Record<string, unknown>): FeatureRow {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    parent_id: row.parent_id as string | null,
    title: row.title as string,
    details: row.details as string | null,
    desired_details: row.desired_details as string | null,
    details_summary: row.details_summary as string | null,
    state: row.state as FeatureRow['state'],
    priority: row.priority as number,
    feature_number: row.feature_number as number | null,
    target_version_id: row.target_version_id as string | null,
    verification_result: row.verification_result as string | null,
    verified_at: row.verified_at as string | null,
    claimed_by: row.claimed_by as string | null,
    claimed_at: row.claimed_at as string | null,
    claim_metadata: row.claim_metadata as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToVersion(row: Record<string, unknown>): Version {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    name: row.name as string,
    description: row.description as string | null,
    released_at: row.released_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToProof(row: Record<string, unknown>): Proof {
  return {
    id: row.id as string,
    feature_id: row.feature_id as string,
    history_id: row.history_id as string | null,
    command: row.command as string,
    exit_code: row.exit_code as number,
    output: row.output as string | null,
    tests: row.tests as string | null,
    evidence: row.evidence as string | null,
    commit_sha: row.commit_sha as string | null,
    agent_type: row.agent_type as string | null,
    created_at: row.created_at as string,
  };
}

function rowToTemplate(row: Record<string, unknown>): SpecTemplate {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    name: row.name as string,
    description: row.description as string | null,
    content: row.content as string,
    is_default: row.is_default === 1,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToHistory(row: Record<string, unknown>): FeatureHistory {
  return {
    id: row.id as string,
    feature_id: row.feature_id as string,
    summary: row.summary as string,
    author: 'system',
    created_at: row.created_at as string,
  };
}

function incrementVersion(name: string): string {
  const clean = name.replace(/^v/, '');
  const parts = clean.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return `${clean}.1`;
  }
  parts[1] += 1;
  parts[2] = 0;
  return parts.join('.');
}
