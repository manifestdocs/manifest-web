import { z } from 'zod';

export const featureStateSchema = z.enum([
  'proposed',
  'blocked',
  'in_progress',
  'implemented',
  'archived',
]);

const uuidSchema = z.string().uuid();

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  key_prefix: z.string().trim().min(1).max(5).optional(),
  description: z.string().max(10_000).nullable().optional(),
  instructions: z.string().max(100_000).nullable().optional(),
  directory_path: z.string().trim().min(1).max(4096).optional(),
  skip_default_versions: z.boolean().optional(),
}).strict();

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  key_prefix: z.string().trim().min(1).max(5).optional(),
  description: z.string().max(10_000).nullable().optional(),
  instructions: z.string().max(100_000).nullable().optional(),
}).strict();

export const addDirectorySchema = z.object({
  path: z.string().trim().min(1).max(4096),
  git_remote: z.string().max(1000).nullable().optional(),
  is_primary: z.boolean().optional(),
  instructions: z.string().max(10_000).nullable().optional(),
}).strict();

export const mkdirSchema = z.object({
  path: z.string().trim().min(1).max(4096),
}).strict();

export const createFeatureSchema = z.object({
  parent_id: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1).max(500),
  details: z.string().max(100_000).nullable().optional(),
  state: featureStateSchema.optional(),
  priority: z.number().int().optional(),
  target_version_id: uuidSchema.nullable().optional(),
}).strict();

export const updateFeatureSchema = z.object({
  parent_id: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1).max(500).optional(),
  details: z.string().max(100_000).nullable().optional(),
  desired_details: z.string().max(100_000).nullable().optional(),
  details_summary: z.string().max(100_000).nullable().optional(),
  state: featureStateSchema.optional(),
  priority: z.number().int().optional(),
  target_version_id: uuidSchema.nullable().optional(),
  clear_version: z.boolean().optional(),
  blocked_by: z.array(uuidSchema).optional(),
}).strict();

export const createVersionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(5_000).nullable().optional(),
}).strict();

export const updateVersionSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(5_000).nullable().optional(),
  released_at: z.string().datetime().nullable().optional(),
}).strict();

export const setFeatureVersionSchema = z.object({
  version_id: uuidSchema.nullable().optional(),
}).strict();

export const setFocusSchema = z.object({
  feature_id: uuidSchema.nullable().optional(),
}).strict();

export const upsertTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(1_000).nullable().optional(),
  content: z.string().min(1).max(10_000).optional(),
}).strict();

export const claimFeatureSchema = z.object({
  agent_type: z.string().trim().min(1).max(100).optional(),
  force: z.boolean().optional(),
  claim_metadata: z.string().max(10_000).nullable().optional(),
}).strict();

export const completeFeatureSchema = z.object({
  summary: z.string().trim().min(1).max(10_000),
  commits: z.array(z.unknown()).max(200).optional(),
  backfill: z.boolean().optional(),
}).strict();

export const createHistorySchema = z.object({
  summary: z.string().trim().min(1).max(10_000),
  commits: z.array(z.unknown()).max(200).optional(),
  version_id: uuidSchema.optional(),
}).strict();

export const recordVerificationSchema = z.object({
  comments: z.array(z.unknown()).max(200),
}).strict();

export const verifyFeatureSchema = z.object({
  diff: z.string().max(250_000).optional(),
}).strict();

export const createProofSchema = z.object({
  command: z.string().trim().min(1).max(2_000),
  exit_code: z.number().int(),
  output: z.string().max(10_000).optional(),
  tests: z.array(z.unknown()).optional(),
  test_suites: z.array(z.unknown()).optional(),
  evidence: z.array(z.unknown()).max(200).optional(),
  commit_sha: z.string().max(100).optional(),
  agent_type: z.string().max(50).optional(),
  history_id: uuidSchema.optional(),
}).strict();

export const settingsUpdateSchema = z.object({
  database_path: z.string().max(4096).nullable().optional(),
  default_agent: z.enum(['claude', 'gemini', 'copilot', 'codex']).nullable().optional(),
}).strict();

type BulkFeatureNode = {
  title: string;
  details?: string | null;
  state?: z.infer<typeof featureStateSchema>;
  priority?: number;
  children?: BulkFeatureNode[];
};

const bulkFeatureNodeSchema: z.ZodType<BulkFeatureNode> = z.lazy(() => z.object({
  title: z.string().trim().min(1).max(500),
  details: z.string().max(100_000).nullable().optional(),
  state: featureStateSchema.optional(),
  priority: z.number().int().optional(),
  children: z.array(bulkFeatureNodeSchema).optional(),
}).strict());

export const bulkCreateFeaturesSchema = z.object({
  target_version_id: uuidSchema.optional(),
  features: z.array(bulkFeatureNodeSchema).min(1).max(200),
  confirm: z.boolean().optional(),
}).strict();
