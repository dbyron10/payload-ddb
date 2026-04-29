import type { Where } from 'payload'

import { getByPath } from './getByPath.js'

const SUPPORTED_OPERATORS = new Set([
  'equals',
  'not_equals',
  'exists',
  'in',
  'not_in',
])

/**
 * In-memory predicate that evaluates a Payload `Where` against a fetched item.
 * Used as a fallback when the query cannot be reduced to a `GetItem` and we
 * have to `Scan` the table.
 *
 * Supports: `equals`, `not_equals`, `exists`, `in`, `not_in`, `and`, `or`.
 * Throws on any other operator so we surface coverage gaps instead of
 * silently returning wrong results.
 */
export function matchesWhere(item: Record<string, unknown>, where: Where | undefined): boolean {
  if (!where) {
    return true
  }

  for (const [key, raw] of Object.entries(where)) {
    if (key === 'and') {
      if (!Array.isArray(raw)) continue
      for (const sub of raw) {
        if (!matchesWhere(item, sub)) return false
      }
      continue
    }

    if (key === 'or') {
      if (!Array.isArray(raw)) continue
      let any = false
      for (const sub of raw) {
        if (matchesWhere(item, sub)) {
          any = true
          break
        }
      }
      if (!any) return false
      continue
    }

    if (!raw || typeof raw !== 'object') {
      continue
    }

    const fieldValue = getByPath(item, key)
    const operators = raw as Record<string, unknown>

    for (const [operator, expected] of Object.entries(operators)) {
      if (!SUPPORTED_OPERATORS.has(operator)) {
        throw new Error(
          `payload-ddb: operator \`${operator}\` is not supported yet on field \`${key}\`. ` +
            `Supported: ${[...SUPPORTED_OPERATORS].join(', ')}, and, or.`,
        )
      }

      if (!evaluate(fieldValue, operator, expected)) {
        return false
      }
    }
  }

  return true
}

function evaluate(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'equals':
      return actual === expected
    case 'not_equals':
      return actual !== expected
    case 'exists':
      return expected ? actual !== undefined && actual !== null : actual === undefined || actual === null
    case 'in':
      return Array.isArray(expected) && expected.includes(actual)
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual)
    default:
      return false
  }
}
