import type { UpdateVersion } from 'payload'

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from './types.js'

import { findFirst } from './utilities/findFirst.js'

/**
 * Read-merge-write against the versions table. `versionData` is splatted onto
 * the existing row, which means Payload-passed metadata (`createdAt`,
 * `updatedAt`, `latest`, `parent`, `publishedLocale`) and the inner `version`
 * payload all overlay correctly.
 *
 * The adapter does not cascade `latest=true` flips — Payload is responsible
 * for clearing the previous latest by issuing a separate `updateVersion`
 * call. This matches the `createVersion` boundary: `createVersion` owns the
 * cascade because it knows it's making a new latest; `updateVersion` writes
 * exactly what it's told.
 */
export const updateVersion: UpdateVersion = async function updateVersion(
  this: DynamoAdapter,
  args,
) {
  const docClient = this.docClient
  if (!docClient) {
    throw new Error('payload-ddb: docClient is not initialized — call connect() first.')
  }

  const tableName = this.resolveVersionsTableName(args.collection)

  let target: null | Record<string, unknown> = null

  if (args.id !== undefined && args.id !== null) {
    const result = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { id: args.id },
      }),
    )
    target = result.Item ?? null
  } else if (args.where) {
    target = await findFirst(this, { tableName, where: args.where })
  }

  if (!target) {
    return null as never
  }

  const merged: Record<string, unknown> = {
    ...target,
    ...args.versionData,
    id: target['id'],
  }

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: merged,
    }),
  )

  if (args.returning === false) {
    return null as never
  }
  return merged as never
}
