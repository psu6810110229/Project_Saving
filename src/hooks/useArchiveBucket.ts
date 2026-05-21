import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  ArchiveBucketResult,
  TransferAndArchiveBucketResult,
} from '../types';

export type ArchiveErrorHint =
  | 'archive_unauthenticated'
  | 'archive_invalid_request'
  | 'archive_bucket_missing'
  | 'archive_partner_bucket'
  | 'archive_not_room_member'
  | 'archive_nonzero_balance'
  | 'archive_last_active'
  | 'archive_same_bucket'
  | 'archive_source_missing'
  | 'archive_destination_missing'
  | 'archive_partner_source'
  | 'archive_partner_destination'
  | 'archive_source_archived'
  | 'archive_destination_archived'
  | 'archive_cross_room'
  | 'archive_unknown';

export interface ArchiveBucketError {
  message: string;
  hint: ArchiveErrorHint;
  detail?: string;
}

export interface ArchiveBucketArgs {
  bucketId: string;
}

export interface TransferAndArchiveBucketArgs {
  sourceBucketId: string;
  destinationBucketId: string;
  note?: string | null;
  /** Optional caller-supplied idempotency key. Omit to have one generated. */
  clientRequestId?: string;
}

export interface UseArchiveBucketResult {
  /** Archive an already-empty bucket (no money movement). */
  archive: (args: ArchiveBucketArgs) => Promise<{
    data?: ArchiveBucketResult;
    error?: ArchiveBucketError;
  }>;
  /**
   * Combined remove flow — move any remaining balance from source to
   * destination, then archive the source in the same transaction.
   * Safe to call when the source balance is zero; the RPC skips the
   * transfer step in that case.
   */
  transferAndArchive: (args: TransferAndArchiveBucketArgs) => Promise<{
    data?: TransferAndArchiveBucketResult;
    error?: ArchiveBucketError;
  }>;
  /** True while either RPC is in flight. */
  pending: boolean;
}

interface RawArchiveRow {
  bucket_id: string;
  archived_at: string;
  archived_by: string;
  activity_id: string | null;
  reused: boolean;
}

interface RawTransferArchiveRow {
  transfer_id: string | null;
  bucket_id: string;
  archived_at: string;
  archived_by: string;
  amount: string | number;
  source_balance_after: string | number;
  destination_balance_after: string | number;
  transfer_activity_id: string | null;
  archive_activity_id: string | null;
  reused: boolean;
}

function normalizeArchive(row: RawArchiveRow): ArchiveBucketResult {
  return {
    bucket_id: row.bucket_id,
    archived_at: row.archived_at,
    archived_by: row.archived_by,
    activity_id: row.activity_id,
    reused: row.reused,
  };
}

function normalizeTransferArchive(row: RawTransferArchiveRow): TransferAndArchiveBucketResult {
  return {
    transfer_id: row.transfer_id,
    bucket_id: row.bucket_id,
    archived_at: row.archived_at,
    archived_by: row.archived_by,
    amount: Number(row.amount),
    source_balance_after: Number(row.source_balance_after),
    destination_balance_after: Number(row.destination_balance_after),
    transfer_activity_id: row.transfer_activity_id,
    archive_activity_id: row.archive_activity_id,
    reused: row.reused,
  };
}

/**
 * Wraps the bucket-archive RPCs (migration 0059). Direct client
 * deletes on `buckets` will be removed in slice 40.7; this hook is
 * the preferred path even before that lands, so the new UI does not
 * need to fall back to the legacy hard-delete code path.
 */
export function useArchiveBucket(): UseArchiveBucketResult {
  const [pending, setPending] = useState(false);

  const archive = useCallback(async (args: ArchiveBucketArgs) => {
    if (pending) {
      return {
        error: {
          message: 'Archive already in progress',
          hint: 'archive_invalid_request' as const,
        },
      };
    }
    setPending(true);
    try {
      const { data, error } = await supabase.rpc('archive_bucket', {
        p_bucket_id: args.bucketId,
      });
      if (error) {
        const hint = (error.hint as ArchiveErrorHint | undefined) ?? 'archive_unknown';
        return {
          error: {
            message: error.message,
            hint,
            detail: error.details ?? undefined,
          },
        };
      }
      const rows = (data ?? []) as RawArchiveRow[];
      const row = rows[0];
      if (!row) {
        return {
          error: {
            message: 'Archive RPC returned no row',
            hint: 'archive_unknown' as const,
          },
        };
      }
      return { data: normalizeArchive(row) };
    } finally {
      setPending(false);
    }
  }, [pending]);

  const transferAndArchive = useCallback(async (args: TransferAndArchiveBucketArgs) => {
    if (pending) {
      return {
        error: {
          message: 'Archive already in progress',
          hint: 'archive_invalid_request' as const,
        },
      };
    }
    setPending(true);
    try {
      const requestId = args.clientRequestId ?? crypto.randomUUID();
      const { data, error } = await supabase.rpc('transfer_and_archive_bucket', {
        p_source_bucket_id: args.sourceBucketId,
        p_destination_bucket_id: args.destinationBucketId,
        p_note: args.note ?? null,
        p_client_request_id: requestId,
      });
      if (error) {
        const hint = (error.hint as ArchiveErrorHint | undefined) ?? 'archive_unknown';
        return {
          error: {
            message: error.message,
            hint,
            detail: error.details ?? undefined,
          },
        };
      }
      const rows = (data ?? []) as RawTransferArchiveRow[];
      const row = rows[0];
      if (!row) {
        return {
          error: {
            message: 'Transfer-and-archive RPC returned no row',
            hint: 'archive_unknown' as const,
          },
        };
      }
      return { data: normalizeTransferArchive(row) };
    } finally {
      setPending(false);
    }
  }, [pending]);

  return { archive, transferAndArchive, pending };
}
