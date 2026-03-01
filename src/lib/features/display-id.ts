/**
 * Display ID utilities for human-readable feature URLs.
 *
 * Display IDs have the format "PREFIX-NUMBER" (e.g., "MANIF-42").
 * They are composed from a project's key_prefix and a feature's feature_number.
 */

/** Check if a string looks like a display ID (e.g., "MANIF-42") */
export function isDisplayId(id: string): boolean {
  const dashIndex = id.lastIndexOf('-');
  if (dashIndex <= 0 || dashIndex === id.length - 1) return false;
  const prefix = id.slice(0, dashIndex);
  const num = id.slice(dashIndex + 1);
  return /^[A-Za-z]+$/.test(prefix) && /^\d+$/.test(num);
}

/** Build display ID from project prefix and feature number */
export function toDisplayId(
  keyPrefix: string,
  featureNumber: number | null | undefined,
): string | null {
  if (featureNumber == null) return null;
  return `${keyPrefix}-${featureNumber}`;
}
