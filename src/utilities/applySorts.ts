import type { Sort } from 'payload'

import { getByPath } from './getByPath.js'

/**
 * Sort an array in place according to Payload's sort convention:
 * `'field'` ascending, `'-field'` descending. Multiple sort keys are applied
 * as tiebreakers in order.
 *
 * Sorts in JS because DynamoDB `Scan` returns rows in indeterminate order;
 * Query-on-GSI sort comes when we wire access patterns up later.
 */
export function applySorts(items: Record<string, unknown>[], sort: Sort | undefined): void {
  if (!sort) return
  const keys = Array.isArray(sort) ? sort : [sort]
  if (keys.length === 0) return

  items.sort((a, b) => {
    for (const raw of keys) {
      if (!raw) continue
      const descending = raw.startsWith('-')
      const path = descending ? raw.slice(1) : raw
      const av = getByPath(a, path)
      const bv = getByPath(b, path)
      const cmp = compare(av, bv)
      if (cmp !== 0) {
        return descending ? -cmp : cmp
      }
    }
    return 0
  })
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  // Nullish values sort before defined values, ascending. Matches Mongo's
  // default behavior and avoids undefined-vs-string comparison NaNs.
  const aMissing = a === undefined || a === null
  const bMissing = b === undefined || b === null
  if (aMissing && bMissing) return 0
  if (aMissing) return -1
  if (bMissing) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  // Fall back to lexicographic string compare for everything else (dates as
  // ISO strings, booleans, etc.).
  const as = String(a)
  const bs = String(b)
  return as < bs ? -1 : as > bs ? 1 : 0
}
