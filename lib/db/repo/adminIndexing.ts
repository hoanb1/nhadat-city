import { sql } from '@/lib/db/pg';
import type { Doc } from '@/lib/db/pgUtil';
import { outRow } from './adminCommon';

/** indexing_logs.success (boolean column, migration 007; NULL only for rows that predate it -> false). */
export const LOG_SUCCESS = () => sql`COALESCE(success, FALSE)`;

export function indexingLogOut(r: Doc): Doc {
  const o = outRow(r, ['success']);
  o.success = !!r.success;
  return o;
}
