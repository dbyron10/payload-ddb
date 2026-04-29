import type { PaginatedDocs, QueryDrafts } from 'payload'

import type { DynamoAdapter } from './types.js'

import { applySorts } from './utilities/applySorts.js'
import { matchesWhere } from './utilities/matchesWhere.js'
import { scanMatching } from './utilities/scanMatching.js'

/**
 * Return the latest version of every doc as a paginated, doc-shaped result.
 *
 * Strategy:
 *  1. Scan the versions table for `latest=true` rows (one per parent).
 *  2. Project each row's `version` payload up to top-level so the result
 *     looks like a doc — this lets the user's `where` / `sort` operate in
 *     doc-field terms instead of `version.x` paths.
 *  3. Apply `where` post-projection, sort, paginate.
 *
 * No `_status` filter is applied — `queryDrafts` returns the latest version
 * regardless of draft/published state. Payload's higher-level code decides
 * how to use the result.
 */
export const queryDrafts: QueryDrafts = async function queryDrafts(
  this: DynamoAdapter,
  { collection, limit = 10, page = 1, pagination = true, sort, where },
) {
  const tableName = this.resolveVersionsTableName(collection)
  const latestRows = await scanMatching(this, tableName, { latest: { equals: true } })

  const projected: Record<string, unknown>[] = []
  for (const row of latestRows) {
    const version = row['version']
    if (!version || typeof version !== 'object') continue
    projected.push({
      ...(version as Record<string, unknown>),
      id: row['parent'],
    })
  }

  const matched = where ? projected.filter((doc) => matchesWhere(doc, where)) : projected

  applySorts(matched, sort)

  const totalDocs = matched.length
  const useLimit = pagination && limit > 0
  const effectiveLimit = useLimit ? limit : totalDocs
  const totalPages = useLimit ? Math.max(1, Math.ceil(totalDocs / limit)) : 1
  const safePage = useLimit ? Math.max(1, page) : 1

  const start = useLimit ? (safePage - 1) * limit : 0
  const end = useLimit ? start + limit : totalDocs
  const docs = matched.slice(start, end)

  const hasNextPage = useLimit && safePage < totalPages
  const hasPrevPage = useLimit && safePage > 1

  const result: PaginatedDocs<Record<string, unknown>> = {
    docs,
    hasNextPage,
    hasPrevPage,
    limit: effectiveLimit,
    nextPage: hasNextPage ? safePage + 1 : null,
    page: safePage,
    pagingCounter: useLimit ? (safePage - 1) * limit + 1 : 1,
    prevPage: hasPrevPage ? safePage - 1 : null,
    totalDocs,
    totalPages,
  }
  return result as never
}
