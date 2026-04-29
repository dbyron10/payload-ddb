import type { Init } from 'payload'

import type { DynamoAdapter } from './types.js'

import { ensureConnected } from './utilities/ensureConnected.js'
import { ensureTable } from './utilities/ensureTable.js'

/**
 * Lifecycle hook called once after the factory `init` returns the adapter.
 * Payload's order is `init → connect`, so we call `ensureConnected` here
 * to populate the client before any DynamoDB operations.
 *
 * Resolves table names for every configured collection and global, and (when
 * `ensureTables` is true) provisions any that don't yet exist.
 *
 * Provisioning is opt-in because real deployments typically manage tables
 * out-of-band (CDK, Terraform, CloudFormation). It's a meaningful dev-loop
 * convenience for local testing against DynamoDB Local.
 */
export const init: Init = async function (this: DynamoAdapter) {
  ensureConnected(this)

  const tableNames: string[] = []

  for (const collection of this.payload.config.collections) {
    if (!this.tableNames[collection.slug]) {
      this.tableNames[collection.slug] = `${this.tablePrefix}${collection.slug}`
    }
    tableNames.push(this.resolveTableName(collection.slug))
    if (collection.versions) {
      tableNames.push(this.resolveVersionsTableName(collection.slug))
    }
  }

  for (const global of this.payload.config.globals) {
    if (!this.tableNames[global.slug]) {
      this.tableNames[global.slug] = `${this.tablePrefix}${global.slug}`
    }
    tableNames.push(this.resolveTableName(global.slug))
    if (global.versions) {
      tableNames.push(this.resolveVersionsTableName(global.slug))
    }
  }

  this.payload.logger.debug(
    `payload-ddb: init resolved ${tableNames.length} table(s); ensureTables=${this.ensureTables}`,
  )

  if (this.ensureTables) {
    await Promise.all(tableNames.map((name) => ensureTable(this, name)))
    this.payload.logger.debug('payload-ddb: tables ready')
  }
}
