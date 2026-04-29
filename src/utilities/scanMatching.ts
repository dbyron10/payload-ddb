import type { Where } from 'payload'

import { ScanCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from '../types.js'

import { matchesWhere } from './matchesWhere.js'

/**
 * Walk a collection's table via paginated `Scan`, applying `matchesWhere`
 * in JS, and return every matching item. Materializes the full result set —
 * suitable for callers that need it whole (sort, paginate, bulk-mutate).
 *
 * Use `findFirst` instead when you only need the first match: that helper
 * stops scanning on the first hit.
 */
export async function scanMatching(
  adapter: DynamoAdapter,
  tableName: string,
  where: undefined | Where,
): Promise<Record<string, unknown>[]> {
  const docClient = adapter.docClient
  if (!docClient) {
    throw new Error('payload-ddb: docClient is not initialized — call connect() first.')
  }

  const matched: Record<string, unknown>[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )
    for (const item of result.Items ?? []) {
      if (matchesWhere(item, where)) matched.push(item)
    }
    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return matched
}
