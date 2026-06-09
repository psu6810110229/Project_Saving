import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifyBucketPlanPaused, notifyBucketPlanResumed } from '../lib/notifyEvents';
import { useAuth } from './useAuth';
import type {
  BucketPauseStatus,
  BucketPlanPause,
  BucketPlanRevision,
  PauseBucketPlanResult,
  ResumeBucketPlanResult,
} from '../types';

interface RawPauseRow {
  id: string;
  bucket_id: string;
  room_id: string;
  user_id: string;
  paused_from: string;
  resumed_from: string | null;
  created_at: string;
  resumed_at: string | null;
  client_request_id: string | null;
  resume_client_request_id: string | null;
}

interface RawRevisionRow {
  id: string;
  bucket_id: string;
  room_id: string;
  user_id: string;
  effective_from_date: string;
  deadline: string | null;
  target_amount: string | number;
  saving_rule_type: BucketPlanRevision['saving_rule_type'];
  saving_rule_amount: string | number | null;
  saving_rule_start_amount: string | number | null;
  saving_rule_increment: string | number | null;
  saving_rule_cap: string | number | null;
  saving_rule_day_count: number | null;
  saving_rule_start_date: string | null;
  reminder_day: number | null;
  source: BucketPlanRevision['source'];
  created_at: string;
}

interface RawPauseMutationRow {
  pause_id: string;
  bucket_id: string;
  room_id: string;
  user_id: string;
  paused_from: string;
  resumed_from: string | null;
  created_at: string;
  resumed_at: string | null;
  reused: boolean;
}

export interface BucketPlanRuleSnapshotInput {
  deadline?: string | null;
  target_amount?: number;
  saving_rule_type?: BucketPlanRevision['saving_rule_type'];
  saving_rule_amount?: number | null;
  saving_rule_start_amount?: number | null;
  saving_rule_increment?: number | null;
  saving_rule_cap?: number | null;
  saving_rule_day_count?: number | null;
  saving_rule_start_date?: string | null;
  reminder_day?: number | null;
}

export interface BucketPlanPauseMutationResponse<T> {
  data?: T;
  error?: string;
  errorHint?: string;
}

export interface UseBucketPlanPausesResult {
  pauses: BucketPlanPause[];
  revisions: BucketPlanRevision[];
  statuses: BucketPauseStatus[];
  statusByBucketId: Map<string, BucketPauseStatus>;
  loading: boolean;
  error: string | null;
  pauseBucketPlan: (input: {
    bucketId: string;
    pausedFrom?: string | null;
    clientRequestId?: string | null;
  }) => Promise<BucketPlanPauseMutationResponse<PauseBucketPlanResult>>;
  resumeBucketPlan: (input: {
    bucketId: string;
    resumedFrom?: string | null;
    clientRequestId?: string | null;
    ruleSnapshot?: BucketPlanRuleSnapshotInput | null;
  }) => Promise<BucketPlanPauseMutationResponse<ResumeBucketPlanResult>>;
  refetch: () => Promise<void>;
}

function toNum(value: string | number | null): number | null {
  if (value === null) return null;
  return typeof value === 'number' ? value : Number(value);
}

function normalizePause(row: RawPauseRow): BucketPlanPause {
  return {
    id: row.id,
    bucket_id: row.bucket_id,
    room_id: row.room_id,
    user_id: row.user_id,
    paused_from: row.paused_from,
    resumed_from: row.resumed_from,
    created_at: row.created_at,
    resumed_at: row.resumed_at,
    client_request_id: row.client_request_id,
    resume_client_request_id: row.resume_client_request_id,
  };
}

function normalizeRevision(row: RawRevisionRow): BucketPlanRevision {
  return {
    id: row.id,
    bucket_id: row.bucket_id,
    room_id: row.room_id,
    user_id: row.user_id,
    effective_from_date: row.effective_from_date,
    deadline: row.deadline,
    target_amount: Number(row.target_amount),
    saving_rule_type: row.saving_rule_type,
    saving_rule_amount: toNum(row.saving_rule_amount),
    saving_rule_start_amount: toNum(row.saving_rule_start_amount),
    saving_rule_increment: toNum(row.saving_rule_increment),
    saving_rule_cap: toNum(row.saving_rule_cap),
    saving_rule_day_count: row.saving_rule_day_count,
    saving_rule_start_date: row.saving_rule_start_date,
    reminder_day: row.reminder_day,
    source: row.source,
    created_at: row.created_at,
  };
}

function normalizeMutation(row: RawPauseMutationRow): PauseBucketPlanResult {
  return {
    pause_id: row.pause_id,
    bucket_id: row.bucket_id,
    room_id: row.room_id,
    user_id: row.user_id,
    paused_from: row.paused_from,
    resumed_from: row.resumed_from,
    created_at: row.created_at,
    resumed_at: row.resumed_at,
    reused: row.reused,
  };
}

function normalizeStatuses(rows: unknown[] | null): BucketPauseStatus[] {
  return (rows ?? []).map(row => {
    const item = row as BucketPauseStatus;
    return {
      bucket_id: item.bucket_id,
      room_id: item.room_id,
      user_id: item.user_id,
      status: item.status === 'paused' ? 'paused' : 'active',
      is_paused: Boolean(item.is_paused),
    };
  });
}

export function useBucketPlanPauses(roomId: string | null): UseBucketPlanPausesResult {
  const { user } = useAuth();
  const userId = user?.id;
  const [pauses, setPauses] = useState<BucketPlanPause[]>([]);
  const [revisions, setRevisions] = useState<BucketPlanRevision[]>([]);
  const [statuses, setStatuses] = useState<BucketPauseStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!roomId || !userId) {
      setPauses([]);
      setRevisions([]);
      setStatuses([]);
      setLoading(false);
      setError(null);
      return;
    }

    const [pauseResult, revisionResult, statusResult] = await Promise.all([
      supabase
        .from('bucket_plan_pauses')
        .select('id, bucket_id, room_id, user_id, paused_from, resumed_from, created_at, resumed_at, client_request_id, resume_client_request_id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .order('paused_from', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('bucket_plan_revisions')
        .select('id, bucket_id, room_id, user_id, effective_from_date, deadline, target_amount, saving_rule_type, saving_rule_amount, saving_rule_start_amount, saving_rule_increment, saving_rule_cap, saving_rule_day_count, saving_rule_start_date, reminder_day, source, created_at')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .order('effective_from_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.rpc('room_bucket_pause_statuses', { p_room_id: roomId }),
    ]);

    const firstError = pauseResult.error ?? revisionResult.error ?? statusResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setPauses(((pauseResult.data ?? []) as RawPauseRow[]).map(normalizePause));
    setRevisions(((revisionResult.data ?? []) as RawRevisionRow[]).map(normalizeRevision));
    setStatuses(normalizeStatuses(statusResult.data as unknown[] | null));
    setError(null);
    setLoading(false);
  }, [roomId, userId]);

  useEffect(() => {
    if (!roomId || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPauses([]);
      setRevisions([]);
      setStatuses([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const guardedFetch = async () => {
      await fetchAll();
      if (cancelled) return;
    };

    setLoading(true);
    void guardedFetch();

    const channelId = `bucket-plan-pauses:${roomId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bucket_plan_pauses', filter: `room_id=eq.${roomId}` },
        () => { if (!cancelled) void fetchAll(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bucket_plan_revisions', filter: `room_id=eq.${roomId}` },
        () => { if (!cancelled) void fetchAll(); },
      )
      .on('system', {}, evt => {
        if ((evt as { status?: string }).status === 'SUBSCRIBED' && !cancelled) {
          void fetchAll();
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [fetchAll, roomId, userId]);

  const pauseBucketPlan = useCallback(async ({
    bucketId,
    pausedFrom,
    clientRequestId,
  }: {
    bucketId: string;
    pausedFrom?: string | null;
    clientRequestId?: string | null;
  }): Promise<BucketPlanPauseMutationResponse<PauseBucketPlanResult>> => {
    const { data, error: rpcError } = await supabase.rpc('pause_bucket_plan', {
      p_bucket_id: bucketId,
      p_paused_from: pausedFrom ?? null,
      p_client_request_id: clientRequestId ?? null,
    });
    if (rpcError) return { error: rpcError.message, errorHint: rpcError.hint ?? undefined };

    const row = (Array.isArray(data) ? data[0] : data) as RawPauseMutationRow | undefined;
    if (!row) return { error: 'No pause returned' };
    if (!row.reused) notifyBucketPlanPaused(row.pause_id);
    await fetchAll();
    return { data: normalizeMutation(row) };
  }, [fetchAll]);

  const resumeBucketPlan = useCallback(async ({
    bucketId,
    resumedFrom,
    clientRequestId,
    ruleSnapshot,
  }: {
    bucketId: string;
    resumedFrom?: string | null;
    clientRequestId?: string | null;
    ruleSnapshot?: BucketPlanRuleSnapshotInput | null;
  }): Promise<BucketPlanPauseMutationResponse<ResumeBucketPlanResult>> => {
    const { data, error: rpcError } = await supabase.rpc('resume_bucket_plan', {
      p_bucket_id: bucketId,
      p_resumed_from: resumedFrom ?? null,
      p_client_request_id: clientRequestId ?? null,
      p_rule_snapshot: ruleSnapshot ?? null,
    });
    if (rpcError) return { error: rpcError.message, errorHint: rpcError.hint ?? undefined };

    const row = (Array.isArray(data) ? data[0] : data) as RawPauseMutationRow | undefined;
    if (!row) return { error: 'No resume returned' };
    if (!row.reused) notifyBucketPlanResumed(row.pause_id);
    await fetchAll();
    return { data: normalizeMutation(row) };
  }, [fetchAll]);

  const statusByBucketId = useMemo(() => (
    new Map(statuses.map(status => [status.bucket_id, status]))
  ), [statuses]);

  return {
    pauses,
    revisions,
    statuses,
    statusByBucketId,
    loading,
    error,
    pauseBucketPlan,
    resumeBucketPlan,
    refetch: fetchAll,
  };
}
