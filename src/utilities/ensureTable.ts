import {
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'

import type { DynamoAdapter } from '../types.js'

/**
 * Idempotently provision a DynamoDB table with our standard schema:
 * `id` String partition key, on-demand (`PAY_PER_REQUEST`) billing.
 *
 * Behavior:
 *  - DescribeTable first; return early if the table already exists.
 *  - Otherwise CreateTable + wait until ACTIVE (up to 60s).
 *
 * Limitations:
 *  - Always uses String for the `id` attribute. Collections that opt into
 *    Number IDs will need pre-provisioned tables until v2 of this helper.
 *  - No GSIs are created. Wire those up here when we add Query routing.
 */
export async function ensureTable(adapter: DynamoAdapter, tableName: string): Promise<void> {
  const client = adapter.client
  if (!client) {
    throw new Error('payload-ddb: client is not initialized — call connect() first.')
  }

  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }))
    return
  } catch (err) {
    if (!(err instanceof Error) || err.name !== 'ResourceNotFoundException') {
      throw err
    }
  }

  adapter.payload.logger.info(`payload-ddb: creating table \`${tableName}\``)

  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    }),
  )

  await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: tableName })
}
