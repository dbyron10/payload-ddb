import type { CountGlobalVersions } from 'payload'

import type { DynamoAdapter } from './types.js'

import { scanCount } from './utilities/scanCount.js'

export const countGlobalVersions: CountGlobalVersions = async function countGlobalVersions(
  this: DynamoAdapter,
  { global, where },
) {
  const totalDocs = await scanCount(this, this.resolveVersionsTableName(global), where)
  return { totalDocs }
}
