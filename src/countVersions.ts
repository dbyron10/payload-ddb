import type { CountVersions } from 'payload'

import type { DynamoAdapter } from './types.js'

import { scanCount } from './utilities/scanCount.js'

export const countVersions: CountVersions = async function countVersions(
  this: DynamoAdapter,
  { collection, where },
) {
  const totalDocs = await scanCount(this, this.resolveVersionsTableName(collection), where)
  return { totalDocs }
}
