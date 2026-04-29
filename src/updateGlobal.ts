import type { UpdateGlobal } from 'payload'

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from './types.js'

/**
 * Read-merge-write for the global's singleton row. Per Payload's contract,
 * if the global doesn't exist callers should use `createGlobal` first — we
 * surface the missing case as `null` cast (matching `updateOne`) rather than
 * silently upserting, which would mask programmer errors.
 */
export const updateGlobal: UpdateGlobal = async function updateGlobal(
  this: DynamoAdapter,
  { slug, data, returning },
) {
  const docClient = this.docClient
  if (!docClient) {
    throw new Error('payload-ddb: docClient is not initialized — call connect() first.')
  }

  const tableName = this.resolveTableName(slug)

  const existing = (
    await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { id: slug },
      }),
    )
  ).Item

  if (!existing) {
    return null as never
  }

  const merged: Record<string, unknown> = { ...existing, ...data, id: slug }

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: merged,
    }),
  )

  return returning === false ? (null as never) : (merged as never)
}
