import { describe, it, expect } from '../../tests/rspec';
import { isDisplayId, toDisplayId } from './display-id';

describe('isDisplayId', () => {
  it('recognizes valid display IDs', () => {
    expect(isDisplayId('MANIF-42')).toBe(true);
    expect(isDisplayId('MAN-1')).toBe(true);
    expect(isDisplayId('A-99')).toBe(true);
    expect(isDisplayId('proj-123')).toBe(true);
  });

  it('rejects UUIDs', () => {
    expect(isDisplayId('abddab2c-1185-4c48-be77-465b6c75dac8')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isDisplayId('')).toBe(false);
  });

  it('rejects strings without a dash', () => {
    expect(isDisplayId('MANIF42')).toBe(false);
  });

  it('rejects strings with non-alpha prefix', () => {
    expect(isDisplayId('123-42')).toBe(false);
  });

  it('rejects strings with non-numeric suffix', () => {
    expect(isDisplayId('MANIF-abc')).toBe(false);
  });
});

describe('toDisplayId', () => {
  it('constructs display ID from prefix and number', () => {
    expect(toDisplayId('MANIF', 42)).toBe('MANIF-42');
    expect(toDisplayId('MAN', 1)).toBe('MAN-1');
  });

  it('returns null when feature_number is null', () => {
    expect(toDisplayId('MANIF', null)).toBe(null);
  });

  it('returns null when feature_number is undefined', () => {
    expect(toDisplayId('MANIF', undefined)).toBe(null);
  });
});
