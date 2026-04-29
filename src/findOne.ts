import type { FindOne } from 'payload'

import type { DynamoAdapter } from './types.js'

import { findFirst } from './utilities/findFirst.js'

export const findOne: FindOne = async function findOne(
  this: DynamoAdapter,
  { collection, where },
) {
  const found = await findFirst(this, { tableName: this.resolveTableName(collection), where })
  return (found ?? null) as never
}
