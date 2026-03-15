/**
 * SQLite schema for the Manifest database.
 *
 * Copied from manifest-core/migrations/20240101000000_initial.sql.
 * Only the tables needed for the spike are included.
 * Uses CREATE TABLE IF NOT EXISTS for idempotency.
 */

export const SCHEMA = `
-- Core entities

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    current_version_id TEXT,
    root_feature_id TEXT,
    owner_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    default_feature_destination TEXT NOT NULL DEFAULT 'backlog',
    testing_policy TEXT NOT NULL DEFAULT 'advisory',
    test_adapter TEXT,
    context_budget INTEGER,
    key_prefix TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_root_feature ON projects(root_feature_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);

CREATE TABLE IF NOT EXISTS spec_templates (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_spec_templates_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_spec_templates_project ON spec_templates(project_id);

CREATE TABLE IF NOT EXISTS project_directories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    path TEXT NOT NULL,
    git_remote TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    instructions TEXT,
    created_at TEXT NOT NULL,
    CONSTRAINT fk_project_directories_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_directories_project ON project_directories(project_id);

CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    released_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_versions_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_versions_project ON versions(project_id);

CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    parent_id TEXT,
    title TEXT NOT NULL,
    details TEXT,
    desired_details TEXT,
    details_summary TEXT,
    state TEXT NOT NULL DEFAULT 'proposed',
    priority INTEGER NOT NULL DEFAULT 0,
    feature_number INTEGER,
    target_version_id TEXT,
    verification_result TEXT,
    verified_at TEXT,
    claimed_by TEXT,
    claimed_at TEXT,
    claim_metadata TEXT,
    state_updated_at TEXT,
    details_updated_at TEXT,
    parent_id_updated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_features_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_features_parent FOREIGN KEY (parent_id) REFERENCES features(id) ON DELETE CASCADE,
    CONSTRAINT fk_features_version FOREIGN KEY (target_version_id) REFERENCES versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_features_project ON features(project_id);
CREATE INDEX IF NOT EXISTS idx_features_parent ON features(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_features_number ON features(project_id, feature_number);

CREATE TABLE IF NOT EXISTS feature_blockers (
    feature_id TEXT NOT NULL,
    blocker_feature_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (feature_id, blocker_feature_id),
    CONSTRAINT fk_feature_blockers_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    CONSTRAINT fk_feature_blockers_blocker FOREIGN KEY (blocker_feature_id) REFERENCES features(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feature_history (
    id TEXT PRIMARY KEY,
    feature_id TEXT,
    version_id TEXT,
    summary TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL,
    CONSTRAINT fk_history_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    CONSTRAINT fk_history_version FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_history_feature ON feature_history(feature_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON feature_history(created_at DESC);

CREATE TABLE IF NOT EXISTS proofs (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    history_id TEXT,
    command TEXT NOT NULL,
    exit_code INTEGER NOT NULL,
    output TEXT,
    tests TEXT,
    evidence TEXT,
    commit_sha TEXT,
    agent_type TEXT,
    created_at TEXT NOT NULL,
    CONSTRAINT fk_proofs_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    CONSTRAINT fk_proofs_history FOREIGN KEY (history_id) REFERENCES feature_history(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_proofs_feature ON proofs(feature_id);
CREATE INDEX IF NOT EXISTS idx_proofs_history ON proofs(history_id);

CREATE TABLE IF NOT EXISTS project_focus (
    project_id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_focus_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_focus_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
);
`;

export const DEFAULT_SPEC_TEMPLATE = `As a [user type], I can [capability] so that [benefit].

[Describe the feature behavior, interactions, and key details.]

## Acceptance Criteria

- [ ] [First verifiable criterion]
- [ ] [Second verifiable criterion]
`;
