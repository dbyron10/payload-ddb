import type { Where } from 'payload'

import { SUPPORTED_OPERATORS, unsupportedOperatorError } from './operators.js'

/**
 * Compile a Payload `Where` into a DynamoDB `FilterExpression` plus its
 * companion `ExpressionAttributeNames` / `ExpressionAttributeValues` maps.
 *
 * Returns `undefined` when there's nothing to filter on (empty/missing
 * `where`, or only no-op clauses like `and: []`). Throws on any operator
 * outside `operators.ts`'s supported set, identical to `matchesWhere` —
 * coverage is enforced from one source so the in-JS path and the pushdown
 * path can never disagree.
 *
 * Implementation notes:
 *  - Every field path segment becomes an `#nN` placeholder, sidestepping
 *    DynamoDB's reserved-word list entirely. Segments are deduped per-call so
 *    repeated fields produce one `#name` entry rather than many.
 *  - Every value becomes a `:vN` placeholder. We don't dedupe values because
 *    array members and repeated literals are cheap and the placeholder count
 *    keeps the expression readable.
 *  - Dotted paths in `where` keys are split on `.` so DynamoDB document-path
 *    syntax (`#a.#b`) is produced for nested fields.
 *  - `in: []` throws — DynamoDB rejects empty `IN ()` and the empty-set
 *    semantics are ambiguous enough that loud failure beats silent surprise.
 *  - `not_in: []` is treated as no constraint (the complement of an empty
 *    set is everything, so omitting it from the expression matches semantics).
 */
export type FilterExpression = {
  expression: string
  names: Record<string, string>
  values: Record<string, unknown>
}

type Ctx = {
  nameByPlaceholder: Record<string, string>
  nameCounter: number
  placeholderBySegment: Map<string, string>
  valueCounter: number
  values: Record<string, unknown>
}

export function buildFilterExpression(where: undefined | Where): FilterExpression | undefined {
  if (!where) return undefined

  const ctx: Ctx = {
    nameByPlaceholder: {},
    nameCounter: 0,
    placeholderBySegment: new Map(),
    valueCounter: 0,
    values: {},
  }

  const expression = compile(where, ctx)
  if (!expression) return undefined

  return {
    expression,
    names: ctx.nameByPlaceholder,
    values: ctx.values,
  }
}

function compile(where: Where, ctx: Ctx): string {
  const parts: string[] = []

  for (const [key, raw] of Object.entries(where)) {
    if (key === 'and') {
      const inner = compileGroup(raw, ctx, 'AND')
      if (inner) parts.push(inner)
      continue
    }
    if (key === 'or') {
      const inner = compileGroup(raw, ctx, 'OR')
      if (inner) parts.push(inner)
      continue
    }

    if (!raw || typeof raw !== 'object') continue

    const path = pathRef(ctx, key)
    const operators = raw as Record<string, unknown>

    for (const [operator, expected] of Object.entries(operators)) {
      if (!SUPPORTED_OPERATORS.has(operator)) {
        throw unsupportedOperatorError(operator, key)
      }
      const expr = operatorToExpression(operator, path, expected, ctx)
      if (expr) parts.push(expr)
    }
  }

  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!
  return parts.join(' AND ')
}

function compileGroup(raw: unknown, ctx: Ctx, joiner: 'AND' | 'OR'): string {
  if (!Array.isArray(raw)) return ''
  const subs: string[] = []
  for (const sub of raw) {
    if (!sub || typeof sub !== 'object') continue
    const expr = compile(sub as Where, ctx)
    if (expr) subs.push(expr)
  }
  if (subs.length === 0) return ''
  if (subs.length === 1) return subs[0]!
  return `(${subs.join(` ${joiner} `)})`
}

function pathRef(ctx: Ctx, path: string): string {
  return path
    .split('.')
    .map((segment) => segmentRef(ctx, segment))
    .join('.')
}

function segmentRef(ctx: Ctx, segment: string): string {
  const cached = ctx.placeholderBySegment.get(segment)
  if (cached) return cached
  const placeholder = `#n${ctx.nameCounter++}`
  ctx.nameByPlaceholder[placeholder] = segment
  ctx.placeholderBySegment.set(segment, placeholder)
  return placeholder
}

function valueRef(ctx: Ctx, value: unknown): string {
  const placeholder = `:v${ctx.valueCounter++}`
  ctx.values[placeholder] = value
  return placeholder
}

function operatorToExpression(
  operator: string,
  path: string,
  expected: unknown,
  ctx: Ctx,
): string {
  switch (operator) {
    case 'equals':
      return `${path} = ${valueRef(ctx, expected)}`
    case 'not_equals':
      return `${path} <> ${valueRef(ctx, expected)}`
    case 'exists':
      return expected ? `attribute_exists(${path})` : `attribute_not_exists(${path})`
    case 'in': {
      if (!Array.isArray(expected)) return ''
      if (expected.length === 0) {
        throw new Error(
          'payload-ddb: `in` operator requires a non-empty array — DynamoDB rejects empty IN clauses.',
        )
      }
      const refs = expected.map((v) => valueRef(ctx, v))
      return `${path} IN (${refs.join(', ')})`
    }
    case 'not_in': {
      if (!Array.isArray(expected) || expected.length === 0) return ''
      const refs = expected.map((v) => valueRef(ctx, v))
      return `NOT (${path} IN (${refs.join(', ')}))`
    }
    default:
      // Unreachable — gated by SUPPORTED_OPERATORS check above. Belt-and-braces.
      throw unsupportedOperatorError(operator, path)
  }
}
