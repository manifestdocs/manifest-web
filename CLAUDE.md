# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ManifestWeb provides project and feature management for teams building software with AI agents. It's the planning and collaboration layer where feature specifications are written, reviewed, and tracked.

## Tech Stack

- **Framework**: SvelteKit 2.x with Svelte 5 (runes, snippets)
- **Styling**: Tailwind CSS 4.x via `@tailwindcss/vite`
- **Components**: Bits UI (headless/accessible) + Tailwind Variants
- **API Client**: `openapi-fetch` with types generated from OpenAPI spec
- **Testing**: Vitest with Testing Library and RSpec-style helpers
- **Package Manager**: pnpm

## Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm dev -- --open          # Start and open browser

# Build
pnpm build                  # Production build
pnpm preview                # Preview production build

# Testing
pnpm test                   # Watch mode
pnpm test:run               # Single run (CI)

# Type checking
pnpm check                  # svelte-check + TypeScript
pnpm check:watch            # Watch mode

# API types
pnpm api:generate           # Regenerate types from OpenAPI spec
```

## Architecture

### API Integration

The app consumes a Rust HTTP API running at `http://localhost:17010/api/v1`. The API contract is defined in `/design/openapi.yaml` and TypeScript types are generated from it.

```
src/lib/api/
├── client.ts      # openapi-fetch client instance
├── schema.d.ts    # Generated types (DO NOT EDIT)
└── index.ts       # Re-exports
```

To update API types after spec changes: `pnpm api:generate`

### Component Pattern

Components use Bits UI for accessible primitives with Tailwind Variants for styling:

```svelte
<script lang="ts" module>
  import { tv } from 'tailwind-variants';
  export const variants = tv({
    /* variants */
  });
</script>

<script lang="ts">
  import { cn } from '$lib/utils/cn.js';
  let { class: className, ...props }: Props = $props();
</script>

<element class={cn(variants({ variant }), className)} {...props}>
  {@render children?.()}
</element>
```

The `cn()` utility merges Tailwind classes with conflict resolution.

### Testing Style

Tests use RSpec-style helpers (`describe`, `context`, `it`, `subject`, `let_`) from `src/tests/rspec.ts`:

```typescript
import { describe, context, it, expect } from '../../tests/rspec';

describe('MyComponent', () => {
  context('when given props', () => {
    it('renders correctly', () => {
      expect(result).toBe(expected);
    });
  });
});
```

## Key Concepts

- **Feature**: A capability of the system (lives as documentation, not a work item to close)
- **Session**: A work session on a leaf feature (only one active per feature)
- **Task**: Work unit within a session, assigned to an AI agent
- **Feature States**: proposed → in_progress → implemented → archived

## Path Aliases

SvelteKit configures `$lib` to point to `src/lib/`. Use it for all internal imports:

```typescript
import { api } from '$lib/api';
import { cn } from '$lib/utils/cn';
import { Button } from '$lib/components/ui/button';
```

## Coding Guidelines

### Core Principles

- **Simplicity First**: Generate the most direct solution that meets requirements
- **Established Tech**: Default to proven technologies unless newer approaches requested
- **Explicit Code**: Write straightforward TypeScript; avoid clever one-liners
- **Reason Then Code**: Show logic before implementing complex solutions

### Implementation

- **Implement Only What's Asked**: No extra features or future-proofing unless requested
- **Start with Happy Path**: Handle edge cases later unless security concerns
- **Lean Code**: Skip retry logic and other complexity unless explicitly needed
- **Show Your Work**: Explain key decisions and non-obvious choices
- **Ask About Backwards Compatibility**: Always inquire rather than assume

### Code Structure

- **Limit Nesting**: Keep conditionals/loops under 3 layers
- **Function Length**: 25-30 lines max; break up longer functions
- **Favor Pure Functions**: Minimize side effects; prefer reactive derivations (`$derived`)
- **Concrete Over Abstract**: Avoid abstraction unless it adds real value
- **Unix Philosophy**: Each function should do one thing well; prefer composition
- **Feature-First Organization**: Group by functionality (e.g., `$lib/features/projects/`)

### TypeScript & Svelte Specifics

- Use strict TypeScript; avoid `any` except when interfacing with untyped APIs
- Prefer Svelte 5 runes (`$state`, `$derived`, `$effect`) over Svelte 4 stores
- Use `$props()` for component inputs; destructure with defaults when appropriate
- Keep components focused; extract logic to `.ts` files when it grows complex
- Use `@render` for snippet composition in components

### Best Practices

- **Choose Right Tools**: Use SvelteKit/Svelte built-ins when sufficient; add packages when they save significant time
- **Validate Inputs**: Include reasonable validation, especially for user/API data
- **Think Security**: Consider security implications even when not mentioned
- **Early Return**: Use guard clauses to reduce complexity

### Testing

- Use RSpec-style helpers (`describe`, `context`, `it`) for readable test structure
- Test behavior, not implementation; tests should describe what the code does
- Use Testing Library queries that reflect user interaction (`getByRole`, `getByText`)
- Keep test setup minimal; use `let_` for lazy evaluation of test data

### Response Approach

- **Plan Complex Tasks**: Outline approach before implementation
- **Ask Questions**: Clarify ambiguous requirements
- **Incremental Solutions**: Break down complex problems
- **Offer Alternatives**: Present options with trade-offs when appropriate

### Priority Framework

When principles conflict:

1. Security and correctness (never compromise)
2. Meeting explicit requirements
3. Simplicity
4. Performance (only when specified)
5. Future flexibility (only when requested)

### Context Recognition

- **Production/critical**: Emphasize validation and error handling
- **Prototypes**: Focus on core functionality
- **Learning**: Prioritize clarity and explanation
- **Security-sensitive**: Never compromise on validation

### Git Commits

NEVER include Claude Code attribution in git commit messages.
