import type { Where } from 'payload'

import { ScanCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from '../types.js'

import { buildFilterExpression } from './buildFilterExpression.js'

/**
 * Paginated count over a table, with optional `FilterExpression` pushdown.
 * Always uses `Select: 'COUNT'` so DynamoDB skips item bytes — only the
 * post-filter `Count` per page comes back over the wire.
 */
export async function scanCount(
  adapter: DynamoAdapter,
  tableName: string,
  where: undefined | Where,
): Promise<number> {
  const docClient = adapter.docClient
  if (!docClient) {
    throw new Error('payload-ddb: docClient is not initialized — call connect() first.')
  }

  const filter = buildFilterExpression(where)
  let totalDocs = 0
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        Select: 'COUNT',
        ...(filter
          ? {
              ExpressionAttributeNames: filter.names,
              ExpressionAttributeValues: filter.values,
              FilterExpression: filter.expression,
            }
          : {}),
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )

    totalDocs += result.Count ?? 0

    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return totalDocs
}
