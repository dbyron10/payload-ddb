import type { Count } from 'payload'

import type { DynamoAdapter } from './types.js'

import { scanCount } from './utilities/scanCount.js'

export const count: Count = async function count(this: DynamoAdapter, { collection, where }) {
  const totalDocs = await scanCount(this, this.resolveTableName(collection), where)
  return { totalDocs }
}
