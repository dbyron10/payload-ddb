/**
 * The where-operator coverage shared by `matchesWhere` (in-JS evaluator) and
 * `buildFilterExpression` (DynamoDB pushdown). Keeping the set in one place
 * keeps the two paths honest — if an operator is supported in one, it should
 * be supported in the other, since callers can't know which path runs.
 */
export const SUPPORTED_OPERATORS = new Set([
  'equals',
  'exists',
  'in',
  'not_equals',
  'not_in',
])

export const SUPPORTED_OPERATORS_DESCRIPTION = `${[...SUPPORTED_OPERATORS].join(', ')}, and, or`

export function unsupportedOperatorError(operator: string, field: string): Error {
  return new Error(
    `payload-ddb: operator \`${operator}\` is not supported yet on field \`${field}\`. ` +
      `Supported: ${SUPPORTED_OPERATORS_DESCRIPTION}.`,
  )
}
