export const DEFAULT_TEMPLATE = `## Goal

<!-- One or two sentences: what capability this adds and why it matters.
     Focus on the outcome, not the implementation. -->

## Rules

<!-- Business logic, constraints, and edge cases the agent won't discover from
     code alone. Don't repeat what's in parent features or project instructions.
     Examples: validation rules, rate limits, ordering guarantees, error behavior. -->

## Acceptance Criteria

<!-- Each criterion should be a specific, verifiable outcome an agent can assert
     in a test. Use concrete values. The more precise, the better the tests. -->

- [ ] [Specific, verifiable outcome with concrete values]
- [ ] [Edge case or error handling expectation]
- [ ] [Additional criteria as needed]`;
