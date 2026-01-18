import { describe as vitestDescribe, it as vitestIt, beforeEach, afterEach, beforeAll, afterAll, expect } from 'vitest';

// RSpec-style aliases
export const context = vitestDescribe;
export const describe = vitestDescribe;
export const it = vitestIt;
export const specify = vitestIt;

// Re-export hooks and expect
export { beforeEach, afterEach, beforeAll, afterAll, expect };

// Subject helper for RSpec-style subject definitions
export function subject<T>(factory: () => T): () => T {
	let value: T;
	let initialized = false;

	beforeEach(() => {
		initialized = false;
	});

	return () => {
		if (!initialized) {
			value = factory();
			initialized = true;
		}
		return value;
	};
}

// Let helper for lazy-evaluated variables
export function let_<T>(factory: () => T): () => T {
	return subject(factory);
}
