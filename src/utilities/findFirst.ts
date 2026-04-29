import type { Where } from 'payload'

import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from '../types.js'

import { matchesWhere } from './matchesWhere.js'
import { whereToId } from './whereToId.js'

/**
 * Locate the first item matching `where` in the given collection. Used by
 * `findOne` directly and by `deleteOne` to capture the doc before deletion.
 *
 * Fast path: if `where` is a pure id-equality, do a single `GetItem`.
 * Slow path: paginate `Scan` and filter in JS.
 */
export async function findFirst(
  adapter: DynamoAdapter,
  args: { tableName: string; where: undefined | Where },
): Promise<null | Record<string, unknown>> {
  const docClient = adapter.docClient
  if (!docClient) {
    throw new Error('payload-ddb: docClient is not initialized — call connect() first.')
  }

  const { tableName } = args
  const id = whereToId(args.where)

  if (id !== null) {
    const result = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { id },
      }),
    )
    return result.Item ?? null
  }

  let exclusiveStartKey: Record<string, unknown> | undefined
  while (true) {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )
    for (const item of result.Items ?? []) {
      if (matchesWhere(item, args.where)) {
        return item
      }
    }
    if (!result.LastEvaluatedKey) {
      return null
    }
    exclusiveStartKey = result.LastEvaluatedKey
  }
}
