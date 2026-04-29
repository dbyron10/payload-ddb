import type { CreateGlobalVersion } from 'payload'

import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'

import type { DynamoAdapter } from './types.js'

import { flipPreviousLatest } from './utilities/flipPreviousLatest.js'

/**
 * Like `createVersion` but for global singletons: there's no `parent`, and
 * the "latest" scope is the entire versions table (each global gets its
 * own).
 */
export const createGlobalVersion: CreateGlobalVersion = async function createGlobalVersion(
  this: DynamoAdapter,
  {
    autosave,
    createdAt,
    globalSlug,
    publishedLocale,
    returning,
    snapshot,
    updatedAt,
    versionData,
  },
) {
  const docClient = this.docClient
  if (!docClient) {
    throw new Error('payload-ddb: docClient is not initialized — call connect() first.')
  }

  const tableName = this.resolveVersionsTableName(globalSlug)

  await flipPreviousLatest(this, tableName, { latest: { equals: true } })

  const item: Record<string, unknown> = {
    id: randomUUID(),
    version: versionData,
    createdAt,
    updatedAt,
    latest: true,
    autosave,
    ...(snapshot ? { snapshot: true } : {}),
    ...(publishedLocale !== undefined ? { publishedLocale } : {}),
  }

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    }),
  )

  return returning === false ? (null as never) : (item as never)
}
