import { describe, context, it, expect } from '../../tests/rspec';
import { cn } from './cn';

describe('cn', () => {
  context('when given a single class', () => {
    it('returns the class unchanged', () => {
      expect(cn('foo')).toBe('foo');
    });
  });

  context('when given multiple classes', () => {
    it('merges them together', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });
  });

  context('when given conflicting tailwind classes', () => {
    it('uses the last one (tailwind-merge behavior)', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('handles different axes separately', () => {
      expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
    });
  });

  context('when given conditional classes', () => {
    it('filters out falsy values', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('includes truthy values', () => {
      expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz');
    });
  });

  context('when given undefined or null', () => {
    it('ignores them', () => {
      expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
    });
  });
});
