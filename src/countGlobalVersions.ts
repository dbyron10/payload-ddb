import type { CountGlobalVersions } from 'payload'

import { ScanCommand } from '@aws-sdk/lib-dynamodb'

import type { DynamoAdapter } from './types.js'

import { matchesWhere } from './utilities/matchesWhere.js'

export const countGlobalVersions: CountGlobalVersions = async function countGlobalVersions(
  this: DynamoAdapter,
  { global, where },
) {
  const docClient = this.docClient
  if (!docClient) {
    throw new Error('payload-ddb: docClient is not initialized — call connect() first.')
  }

  const tableName = this.resolveVersionsTableName(global)
  const hasFilter = !!where && Object.keys(where).length > 0

  let totalDocs = 0
  let exclusiveStartKey: Record<string, unknown> | undefined

  while (true) {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ...(hasFilter ? {} : { Select: 'COUNT' }),
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    )

    if (hasFilter) {
      for (const item of result.Items ?? []) {
        if (matchesWhere(item, where)) totalDocs += 1
      }
    } else {
      totalDocs += result.Count ?? 0
    }

    if (!result.LastEvaluatedKey) break
    exclusiveStartKey = result.LastEvaluatedKey
  }

  return { totalDocs }
}
