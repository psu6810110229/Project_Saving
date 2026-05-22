import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifyBucketTransferred } from '../lib/notifyEvents';
import type { TransferBucketMoneyResult } from '../types';

export type TransferErrorHint =
  | 'transfer_unauthenticated'
  | 'transfer_invalid_request'
  | 'transfer_invalid_amount'
  | 'transfer_same_bucket'
  | 'transfer_source_missing'
  | 'transfer_destination_missing'
  | 'transfer_partner_source'
  | 'transfer_partner_destination'
  | 'transfer_source_archived'
  | 'transfer_destination_archived'
  | 'transfer_cross_room'
  | 'transfer_not_room_member'
  | 'transfer_insufficient_balance'
  | 'transfer_unknown';

export interface TransferBucketMoneyArgs {
  sourceBucketId: string;
  destinationBucketId: string;
  amount: number;
  note?: string | null;
  /** Optional caller-supplied idempotency key. Omit to have one generated. */
  clientRequestId?: string;
}

export interface TransferBucketMoneyError {
  message: string;
  hint: TransferErrorHint;
  detail?: string;
}

export interface UseTransferBucketMoneyResult {
  /** Run the RPC. Returns `{ data }` on success or `{ error }` on failure. */
  transfer: (args: TransferBucketMoneyArgs) => Promise<{
    data?: TransferBucketMoneyResult;
    error?: TransferBucketMoneyError;
  }>;
  /** True while an RPC is in flight. UI should disable the submit button. */
  pending: boolean;
}

interface RawRpcRow {
  transfer_id: string;
  source_bucket_id: string;
  destination_bucket_id: string;
  amount: string | number;
  source_balance_after: string | number;
  destination_balance_after: string | number;
  activity_id: string | null;
  reused: boolean;
  created_at: string;
}

function normalize(row: RawRpcRow): TransferBucketMoneyResult {
  return {
    transfer_id: row.transfer_id,
    source_bucket_id: row.source_bucket_id,
    destination_bucket_id: row.destination_bucket_id,
    amount: Number(row.amount),
    source_balance_after: Number(row.source_balance_after),
    destination_balance_after: Number(row.destination_balance_after),
    activity_id: row.activity_id,
    reused: row.reused,
    created_at: row.created_at,
  };
}

/**
 * Wraps the `transfer_bucket_money` RPC (migration 0059). The RPC is
 * the only normal write path for bucket transfers — direct client
 * inserts into `bucket_transfers` are blocked by RLS. The server-side
 * function enforces same-user, same-room, both-active, sufficient
 * balance, and idempotency by `client_request_id`.
 *
 * The UI in slice 40.5 maps the returned `hint` token to user-facing
 * copy (e.g. `transfer_same_bucket` → "Choose a different bucket"). The
 * hint values are kept narrow on purpose; any new server hint will
 * surface as `transfer_unknown` here so the UI can show a generic
 * fallback while the typed union catches up.
 */
export function useTransferBucketMoney(): UseTransferBucketMoneyResult {
  const [pending, setPending] = useState(false);

  const transfer = useCallback(async (args: TransferBucketMoneyArgs) => {
    if (pending) {
      return {
        error: {
          message: 'Transfer already in progress',
          hint: 'transfer_invalid_request' as const,
        },
      };
    }

    setPending(true);
    try {
      const requestId = args.clientRequestId ?? crypto.randomUUID();
      const { data, error } = await supabase.rpc('transfer_bucket_money', {
        p_source_bucket_id: args.sourceBucketId,
        p_destination_bucket_id: args.destinationBucketId,
        p_amount: args.amount,
        p_note: args.note ?? null,
        p_client_request_id: requestId,
      });

      if (error) {
        const hint = (error.hint as TransferErrorHint | undefined) ?? 'transfer_unknown';
        return {
          error: {
            message: error.message,
            hint,
            detail: error.details ?? undefined,
          },
        };
      }

      const rows = (data ?? []) as RawRpcRow[];
      const row = rows[0];
      if (!row) {
        return {
          error: {
            message: 'Transfer RPC returned no row',
            hint: 'transfer_unknown' as const,
          },
        };
      }

      const normalized = normalize(row);
      // Fan out the in-app notification to other room members after the
      // money movement is durable. Skipped on the idempotency-reused
      // path because the original transfer already fired notifications;
      // `_insert_partner_notification` would dedupe anyway, but skipping
      // here avoids the extra round-trip.
      if (!normalized.reused) {
        notifyBucketTransferred(normalized.transfer_id);
      }
      return { data: normalized };
    } finally {
      setPending(false);
    }
  }, [pending]);

  return { transfer, pending };
}
