# Manifest Web

## Product Specification

**Version:** 0.1.0-draft  
**Date:** January 2026  
**Author:** Alastair Dawson

---

## Vision

Manifest Web is the browser-based companion to the Manifest desktop application. It provides project and feature management for teams and individuals who need to plan, review, and collaborate on features without being at their development machine.

**One-liner:** The planning layer for Manifest—features in, clarity out.

---

## Relationship to Desktop App

Manifest exists as two complementary applications:

| Capability | Desktop (GPUI/Rust) | Web (SvelteKit) |
|------------|---------------------|-----------------|
| Feature tree navigation | ✓ | ✓ |
| Feature editing | ✓ | ✓ |
| Feature diff computation | ✓ | Read-only |
| Session execution | ✓ | — |
| Multi-agent orchestration | ✓ | — |
| Terminal multiplexer | ✓ | — |
| Session history viewing | ✓ | ✓ |
| Project management | Basic | Full |
| Team collaboration | Future | ✓ |
| Mobile/tablet access | — | ✓ |

**The mental model:**
- **Desktop:** Where you *execute*—agents running, terminals active, real-time work
- **Web:** Where you *plan and review*—feature specs, history, team coordination

---

## Problem Statement

### Planning Happens Away From the Terminal

Not every moment of product work happens at a development machine. Product-engineers:

- Sketch features on the train
- Review session history in meetings
- Collaborate with teammates who don't have the desktop app
- Need to check feature state from a phone

The desktop app is optimized for execution. The web app is optimized for access.

### Teams Need a Shared View

Even solo developers eventually collaborate—with contractors, advisors, or future teammates. The web app provides:

- Shareable project URLs
- Read-only access for stakeholders
- Collaborative editing for team members
- No installation required

### The API Already Exists

The Manifest desktop app exposes a Rust HTTP API for its core operations. The web app is a natural consumer of this API, enabling:

- Consistent data model across platforms
- Single source of truth
- Offline-capable desktop with sync to web

---

## Core Features

### 1. Project Management

The web app is the primary interface for project-level operations.

**Project Dashboard:**
```
┌─────────────────────────────────────────────────────────┐
│ MANIFEST                              [+ New Project]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ manifest    │  │ client-app  │  │ api-service │     │
│  │             │  │             │  │             │     │
│  │ 12 features │  │ 8 features  │  │ 23 features │     │
│  │ 2 active    │  │ 0 active    │  │ 1 active    │     │
│  │ sessions    │  │ sessions    │  │ session     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Project Properties:**
- Name and description
- Git repository URL (for linking)
- Team members and permissions
- API connection settings (for desktop sync)
- Feature tree root configuration

### 2. Feature Tree Browser

Full navigation and visualization of the feature hierarchy.

**Tree View:**
```
┌──────────────────────┬──────────────────────────────────┐
│ manifest             │ MCP Server                       │
│                      │                                  │
│ ▼ Schema             │ State: specified                 │
│ ▼ Code Quality       │ Tasks: 4 pending, 2 completed    │
│ ▼ Collaboration      │ Last session: 2 hours ago        │
│ ▼ MCP Server    ←    │                                  │
│   ○ Complete Task    │ ────────────────────────────────│
│   ○ Create Session   │                                  │
│   ● Enriched Context │ ## Description                   │
│   ○ Feature Breakdown│                                  │
│ ▼ Task Management    │ The MCP Server feature exposes   │
│ ▶ Desktop App        │ Manifest's capabilities through  │
│ ▶ Remote Deployment  │ the Model Context Protocol...    │
│                      │                                  │
└──────────────────────┴──────────────────────────────────┘
```

**State Indicators:**
- `○` proposed (gray)
- `◐` specified (blue)
- `●` implemented (green)
- `◌` deprecated (faded)

**Tree Operations:**
- Create feature (with parent selection)
- Move feature (drag-and-drop or modal)
- Delete feature (with confirmation, moves to deprecated)
- Search/filter by name, state, or content

### 3. Feature Editor

Rich editing experience for feature specifications.

**Editor Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Enriched Task Context                    [Edit] [Save]  │
├─────────────────────────────────────────────────────────┤
│ State: [specified ▼]                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ## User Story                                           │
│                                                         │
│ As an AI agent, I want get_task_context to return       │
│ everything I need upfront so I have full context when   │
│ starting work.                                          │
│                                                         │
│ ## Details                                              │
│                                                         │
│ Enhance get_task_context response to include:           │
│ 1. Feature state (proposed/specified/implemented)       │
│ 2. Existing implementation notes on this task           │
│ 3. Feature history from previous sessions               │
│                                                         │
│ ## Constraints                                          │
│                                                         │
│ - Response must remain under 4KB for context windows    │
│ - Include parent feature context up to 2 levels         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Editor Features:**
- Markdown editing with preview
- Auto-save with conflict detection
- Version history (per-save snapshots)
- Templates for common feature types
- Keyboard shortcuts (Cmd+S save, Cmd+E toggle edit)

### 4. Session History

Read-only view of execution history from the desktop app.

**Session List:**
```
┌─────────────────────────────────────────────────────────┐
│ Sessions for: MCP Server / Enriched Task Context        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Session #12                         Jan 16, 7:05 AM │ │
│ │ Agent: claude-code                                  │ │
│ │ Tasks: 3/3 completed                                │ │
│ │ Duration: 4m 32s                                    │ │
│ │ Status: ✓ Squashed                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Session #11                         Jan 15, 3:22 PM │ │
│ │ Agent: codex                                        │ │
│ │ Tasks: 2/4 completed                                │ │
│ │ Status: ✗ Aborted (user cancelled)                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Session Detail:**
- Task breakdown with individual status
- Agent conversation log (collapsible)
- Commits/artifacts produced
- Diff that generated the session

### 5. Feature Analytics

Insights into project health and documentation coverage.

**Dashboard Widgets:**

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Coverage    │ │ Activity    │ │ Staleness   │
│             │ │             │ │             │
│    78%      │ │ ████▃▂▁    │ │ 3 features  │
│  specified  │ │ last 7 days │ │ need review │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Metrics:**
- Feature coverage (% with complete specs)
- Activity heatmap (sessions over time)
- Staleness detection (features unchanged despite code activity)
- State distribution (proposed/specified/implemented/deprecated)

---

## Technical Architecture

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit 2.x |
| Components | shadcn-svelte |
| Styling | Tailwind CSS 4.x |
| State | Svelte stores + TanStack Query |
| API Client | Generated from OpenAPI spec |
| Auth | Clerk (headless) with Google + GitHub OAuth |
| Hosting | Vercel or Cloudflare Pages |

### Why shadcn-svelte

shadcn-svelte is the Svelte port of shadcn/ui—a copy-paste component approach rather than a traditional package dependency:

- **Open Code:** Components live in your codebase, fully modifiable
- **Composition:** Consistent API across all components (built on bits-ui primitives)
- **Tailwind Native:** Style with utility classes, supports CSS variables for theming
- **Accessible:** WCAG-compliant out of the box
- **AI-Friendly:** LLMs can read, understand, and extend components easily

Components are installed via CLI:

```bash
npx shadcn-svelte init
npx shadcn-svelte add button dialog tree-view
```

This gives us full control to customize components to match the desktop app's aesthetic while maintaining accessibility and consistency.

### API Integration

The web app consumes the existing Manifest HTTP API:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  SvelteKit  │────▶│  Rust API   │
│             │     │   Server    │     │  (Desktop)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Manifest   │
                    │   Cloud     │
                    │  (Future)   │
                    └─────────────┘
```

**API Endpoints (consumed):**

```
Projects
  GET    /api/projects
  POST   /api/projects
  GET    /api/projects/:id
  PUT    /api/projects/:id
  DELETE /api/projects/:id

Features
  GET    /api/projects/:id/features
  POST   /api/projects/:id/features
  GET    /api/features/:id
  PUT    /api/features/:id
  DELETE /api/features/:id
  GET    /api/features/:id/children
  PUT    /api/features/:id/move

Sessions (read-only)
  GET    /api/features/:id/sessions
  GET    /api/sessions/:id
  GET    /api/sessions/:id/tasks

History
  GET    /api/features/:id/history
```

### Data Flow

**Online Mode:**
- Direct API calls to desktop app or cloud service
- Real-time updates via WebSocket (for session status)
- Optimistic UI with server reconciliation

**Offline Mode (Future):**
- IndexedDB for local feature cache
- Queue mutations for sync
- Conflict resolution UI

---

## User Flows

### Flow 1: Create a New Feature

```
1. User clicks [+ Feature] in tree
2. Modal: Select parent feature (or root)
3. Modal: Enter feature name
4. Feature created in `proposed` state
5. Editor opens automatically
6. User writes spec, saves
7. User changes state to `specified` when ready
```

### Flow 2: Review Session History

```
1. User navigates to feature in tree
2. Clicks "Sessions" tab in detail panel
3. Sees list of past sessions
4. Clicks session to expand
5. Views task breakdown, agent logs, commits
6. Optionally exports conversation for reference
```

### Flow 3: Collaborate on Feature Spec

```
1. User A writes initial spec
2. User A shares project link with User B
3. User B opens link, sees read-only view (if not team member)
4. User A invites User B to team
5. User B can now edit features
6. Both see real-time presence indicators
7. Edits sync automatically with conflict detection
```

### Flow 4: Mobile Review

```
1. User opens Manifest Web on phone
2. Responsive layout shows feature list
3. User taps feature to see spec
4. Read-only on mobile (editing disabled for small screens)
5. User can add comments/notes for later
```

---

## UI/UX Principles

### 1. Desktop App Familiarity

The web app should feel like a sibling of the desktop app:
- Same color palette and typography
- Similar tree navigation patterns
- Consistent iconography for states
- Keyboard shortcuts where applicable

### 2. Progressive Disclosure

- Start with feature tree and simple detail view
- Advanced features (analytics, history) revealed progressively
- Settings and configuration tucked away but accessible

### 3. Speed Over Chrome

- Minimal UI, maximum content
- Instant navigation (SvelteKit preloading)
- No loading spinners longer than 200ms
- Skeleton states for async content

### 4. Mobile-Aware, Not Mobile-First

- Fully functional on desktop/tablet
- Gracefully degraded on mobile (read-focused)
- No critical flows blocked on small screens

---

## Pages & Routes

```
/                           → Dashboard (project list)
/projects/new               → Create project
/projects/:id               → Project overview
/projects/:id/features      → Feature tree (main view)
/projects/:id/features/:fid → Feature detail (deep link)
/projects/:id/sessions      → All sessions for project
/projects/:id/analytics     → Project analytics
/projects/:id/settings      → Project settings
/settings                   → User settings
/team                       → Team management (future)
```

---

## Components

### shadcn-svelte Base Components

These components from shadcn-svelte form our foundation:

| Component | Usage |
|-----------|-------|
| `Button` | Actions, form submissions |
| `Card` | Project cards, feature cards, session cards |
| `Dialog` | Modals for create/edit/confirm |
| `DropdownMenu` | Context menus, state selectors |
| `Input` / `Textarea` | Form fields |
| `Tabs` | Feature detail sections |
| `Badge` | State indicators |
| `Tooltip` | Contextual help |
| `Command` | Command palette (Cmd+K) |
| `Separator` | Visual dividers |
| `Skeleton` | Loading states |
| `ScrollArea` | Scrollable containers |

### Custom Components (Built on shadcn-svelte)

| Component | Purpose |
|-----------|---------|
| `FeatureTree` | Hierarchical tree with state indicators, built on Tree primitive |
| `FeatureCard` | Compact feature summary, extends Card |
| `FeatureEditor` | Markdown editor with preview toggle |
| `SessionList` | Chronological session history |
| `SessionDetail` | Expanded session with tasks and logs |
| `StateSelector` | Feature state dropdown with color coding |
| `ProjectCard` | Project summary for dashboard |
| `StateBadge` | Colored badge for feature states (proposed/specified/implemented/deprecated) |
| `TimeAgo` | Relative time display |
| `Avatar` | User avatar with presence indicator |
| `MarkdownView` | Rendered markdown display |
| `MarkdownEdit` | Markdown textarea with formatting toolbar |

### Theming

CSS variables will be customized to match the desktop app's dark theme:

```css
:root {
  --background: 222 47% 11%;      /* Dark blue-gray */
  --foreground: 210 40% 98%;      /* Off-white */
  --primary: 142 76% 36%;         /* Green for implemented */
  --secondary: 217 91% 60%;       /* Blue for specified */
  --muted: 215 20% 65%;           /* Gray for proposed */
  --destructive: 0 84% 60%;       /* Red for errors */
  --accent: 45 93% 47%;           /* Amber for active sessions */
}
```

---

## Authentication & Authorization

### Auth Provider: Clerk (Headless)

Clerk provides OAuth, session management, and future API key support without building auth infrastructure. Using headless mode for full control over UI styling to match the desktop app aesthetic.

**Why Clerk:**
- Google + GitHub OAuth out of the box
- SvelteKit SDK with route protection hooks
- JWT templates for Rust API validation
- Organizations feature for teams (Phase 4)
- API key management when needed (CI/CD, integrations)

**Implementation:**
- Custom sign-in/sign-up pages using Clerk's headless components
- Styled with shadcn-svelte + Tailwind to match desktop app
- JWTs validated by Rust API via Clerk's JWKS endpoint

### Auth Model

| Role | Capabilities |
|------|--------------|
| Owner | Full access, can delete project, manage team |
| Editor | Create/edit features, view sessions |
| Viewer | Read-only access to features and sessions |
| Public | No access (unless project is public) |

### Auth Flow (MVP)

1. User clicks "Sign in with Google" or "Sign in with GitHub"
2. Clerk handles OAuth redirect and token exchange
3. User returned to app with Clerk session established
4. SvelteKit hooks validate session on protected routes
5. API requests include Clerk JWT for Rust backend validation

### Auth Flow (Future)

- Clerk Organizations for team management
- API tokens via Clerk for CI/CD integration
- Desktop app authentication handoff (shared Clerk session or token exchange)

---

## Roadmap

### Phase 1: Core Web App

- [ ] Project CRUD
- [ ] Feature tree navigation
- [ ] Feature viewing (read-only)
- [ ] Basic authentication
- [ ] Responsive layout

### Phase 2: Feature Editing

- [ ] Markdown editor integration
- [ ] Feature creation and editing
- [ ] State transitions
- [ ] Auto-save and conflict detection

### Phase 3: Session History

- [ ] Session list view
- [ ] Session detail view
- [ ] Task and log display
- [ ] Export functionality

### Phase 4: Collaboration

- [ ] Team invitations
- [ ] Role-based permissions
- [ ] Real-time presence
- [ ] Comments and annotations

### Phase 5: Analytics & Polish

- [ ] Coverage metrics
- [ ] Activity dashboard
- [ ] Staleness detection
- [ ] Mobile optimization
- [ ] Offline support

---

## Open Questions

1. **API hosting:** Does the Rust API run locally (desktop), self-hosted, or Manifest Cloud? Web app needs a stable endpoint.

2. **Real-time sync:** WebSockets for live updates, or polling? Desktop app is source of truth during active sessions.

3. **Public projects:** Should projects be shareable publicly (read-only) for open source use cases?

4. **Pricing model:** Free tier + paid teams? Usage-based? Bundled with desktop app?

5. **Mobile editing:** Disable entirely on small screens, or provide a simplified editor?

---

## Success Metrics

### For Launch

- Can I create and edit features entirely in the web app?
- Does session history provide useful context for review?
- Is the tree navigation as fast as the desktop app?

### For Growth

- Team adoption (>1 user per project)
- Feature edits from web vs desktop ratio
- Time spent in session history (engagement)
- Mobile session duration

---

## Appendix: Design References

- **Linear:** Clean project navigation, keyboard-first, dark theme aesthetic
- **Notion:** Flexible document editing, tree structure
- **GitHub:** Session/commit history patterns
- **Figma:** Real-time collaboration indicators
- **Manifest Desktop:** Color palette, typography, state iconography (source of truth for visual consistency)

---

*This specification covers the Manifest Web application. For the desktop application specification, see `manifest-product-spec.md`.*
