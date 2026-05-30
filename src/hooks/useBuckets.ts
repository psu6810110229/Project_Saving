import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { notifyBucketAdded, notifyBucketUpdated } from '../lib/notifyEvents';
import { useAuth } from './useAuth';
import type { Bucket, BucketCategory, BucketDraft } from '../types';
import { formatCurrency } from '../lib/format';
import { findDuplicateBucketName } from '../lib/buckets';

export interface SaveBucketsResult {
  error?: string;
  code?: 'duplicate_name';
  duplicateName?: string;
}

export interface UseBucketsResult {
  buckets: Bucket[];
  loading: boolean;
  saveBuckets: (next: BucketDraft[]) => Promise<SaveBucketsResult>;
  reviewBucketCategories: (updates: { id: string; category: BucketCategory }[]) => Promise<{ error?: string }>;
  /**
   * Refetch active buckets after server-side mutations the local cache
   * cannot observe directly (e.g. `archive_bucket` /
   * `transfer_and_archive_bucket` RPCs in slice 40.7).
   */
  refetch: () => Promise<void>;
}

export function useBuckets(roomId: string | null): UseBucketsResult {
  const { user } = useAuth();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBuckets = useCallback(async (opts?: { silent?: boolean }) => {
    if (!roomId || !user) { setBuckets([]); setLoading(false); return; }
    // Silent refetches (post-save / post-archive) skip the loading flag so
    // the bucket grid refreshes in place instead of flashing a loading state.
    if (!opts?.silent) setLoading(true);
    // Active screens hide archived buckets (Task 40 / migration 0058).
    // Historical surfaces that need archived rows must query without
    // this filter; this hook is the active-buckets path.
    const { data, error } = await supabase
      .from('buckets')
      .select('*')
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .is('archived_at', null)
      .order('position', { ascending: true });
    setLoading(false);
    if (!error) setBuckets(data ?? []);
  }, [roomId, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBuckets();
  }, [fetchBuckets]);

  async function saveBuckets(next: BucketDraft[]): Promise<SaveBucketsResult> {
    if (!user || !roomId) return { error: 'Not authenticated or no room' };

    const duplicateName = findDuplicateBucketName(next);
    if (duplicateName) {
      return {
        error: `You already have an active bucket named "${duplicateName}".`,
        code: 'duplicate_name',
        duplicateName,
      };
    }

    const { data: goal, error: goalErr } = await supabase
      .from('goals')
      .select('target_amount')
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .maybeSingle();
    if (goalErr) return { error: goalErr.message };

    if (goal) {
      const goalTarget = Number(goal.target_amount);
      const bucketTargetTotal = next.reduce((total, bucket) => total + Number(bucket.target_amount), 0);
      if (bucketTargetTotal > goalTarget) {
        return { error: `Bucket targets exceed your personal sub-goal of ${formatCurrency(goalTarget)}.` };
      }
    }

    const currentIds = buckets.map(b => b.id);
    const nextIds = next.filter(d => d.id !== undefined).map(d => d.id as string);

    // Task 40: removing a bucket must go through archive_bucket /
    // transfer_and_archive_bucket so history, activity, and transfer
    // math stay intact. Treat a missing existing id as a caller bug
    // instead of falling back to the legacy hard-delete path.
    const toRemove = currentIds.filter(id => !nextIds.includes(id));
    if (toRemove.length > 0) {
      return { error: 'Use Remove Bucket to archive buckets instead of deleting them.' };
    }

    // Separate updates (with IDs) and inserts (without IDs)
    const updates = next.filter(d => d.id !== undefined).map((d, i) => ({
      id: d.id as string,
      user_id: user.id,
      room_id: roomId,
      name: d.name,
      target_amount: d.target_amount,
      category: d.category ?? 'other',
      position: i,
      ...(d.deadline !== undefined && { deadline: d.deadline }),
      ...(d.saving_rule_type !== undefined && { saving_rule_type: d.saving_rule_type }),
      ...(d.saving_rule_amount !== undefined && { saving_rule_amount: d.saving_rule_amount }),
      ...(d.saving_rule_start_amount !== undefined && { saving_rule_start_amount: d.saving_rule_start_amount }),
      ...(d.saving_rule_increment !== undefined && { saving_rule_increment: d.saving_rule_increment }),
      ...(d.saving_rule_cap !== undefined && { saving_rule_cap: d.saving_rule_cap }),
      ...(d.saving_rule_day_count !== undefined && { saving_rule_day_count: d.saving_rule_day_count }),
      ...(d.saving_rule_start_date !== undefined && { saving_rule_start_date: d.saving_rule_start_date }),
      ...(d.reminder_day !== undefined && { reminder_day: d.reminder_day }),
      ...(d.payment_type !== undefined && { payment_type: d.payment_type }),
    }));

    const inserts = next.filter(d => d.id === undefined).map((d, i) => ({
      user_id: user.id,
      room_id: roomId,
      name: d.name,
      target_amount: d.target_amount,
      category: d.category ?? 'other',
      position: i + updates.length,
      ...(d.deadline !== undefined && { deadline: d.deadline }),
      ...(d.saving_rule_type !== undefined && { saving_rule_type: d.saving_rule_type }),
      ...(d.saving_rule_amount !== undefined && { saving_rule_amount: d.saving_rule_amount }),
      ...(d.saving_rule_start_amount !== undefined && { saving_rule_start_amount: d.saving_rule_start_amount }),
      ...(d.saving_rule_increment !== undefined && { saving_rule_increment: d.saving_rule_increment }),
      ...(d.saving_rule_cap !== undefined && { saving_rule_cap: d.saving_rule_cap }),
      ...(d.saving_rule_day_count !== undefined && { saving_rule_day_count: d.saving_rule_day_count }),
      ...(d.saving_rule_start_date !== undefined && { saving_rule_start_date: d.saving_rule_start_date }),
      ...(d.reminder_day !== undefined && { reminder_day: d.reminder_day }),
      ...(d.payment_type !== undefined && { payment_type: d.payment_type }),
    }));

    // Detect updates whose user-facing fields (not just position)
    // changed compared to the loaded state. Position-only changes
    // should not trigger a partner notification.
    const changedUpdateIds: string[] = [];
    for (const u of updates) {
      const before = buckets.find(b => b.id === u.id);
      if (!before) continue;
      const nameChanged = before.name !== u.name;
      const targetChanged = Number(before.target_amount) !== Number(u.target_amount);
      const categoryChanged = (before.category ?? 'other') !== u.category;
      if (nameChanged || targetChanged || categoryChanged) {
        changedUpdateIds.push(u.id);
      }
    }

    // Execute updates as per-row UPDATEs. An upsert runs as
    // INSERT ... ON CONFLICT, which fires the BEFORE INSERT
    // `enforce_bucket_limit` trigger for every row in the batch and
    // fails once the user has 10 active buckets — even though these
    // are all updates to existing rows.
    for (const { id, ...fields } of updates) {
      const { error: upErr } = await supabase
        .from('buckets')
        .update(fields)
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('room_id', roomId);
      if (upErr) {
        if (upErr.code === '23505') {
          return { error: 'Bucket names must be unique.', code: 'duplicate_name' };
        }
        return { error: upErr.message };
      }
    }

    // Execute inserts and capture the new ids so each added bucket
    // can fire a partner notification.
    let insertedIds: string[] = [];
    if (inserts.length > 0) {
      const { data: insertedRows, error: insErr } = await supabase
        .from('buckets')
        .insert(inserts)
        .select('id');
      if (insErr) {
        if (insErr.code === '23505') {
          return { error: 'Bucket names must be unique.', code: 'duplicate_name' };
        }
        return { error: insErr.message };
      }
      insertedIds = (insertedRows ?? []).map(row => row.id as string);
    }

    await fetchBuckets({ silent: true });

    // Fire-and-forget partner notifications. Bucket failures must
    // not block the save itself; the helpers swallow errors.
    for (const id of insertedIds) notifyBucketAdded(id);
    for (const id of changedUpdateIds) notifyBucketUpdated(id);

    return {};
  }

  async function reviewBucketCategories(
    updates: { id: string; category: BucketCategory }[],
  ): Promise<{ error?: string }> {
    if (!user || !roomId) return { error: 'Not authenticated or no room' };
    if (updates.length === 0) return {};

    const now = new Date().toISOString();
    for (const u of updates) {
      const { error } = await supabase
        .from('buckets')
        .update({
          category: u.category,
          category_source: 'user',
          category_confidence: 100,
          category_reviewed_at: now,
        })
        .eq('id', u.id)
        .eq('user_id', user.id)
        .eq('room_id', roomId);
      if (error) return { error: error.message };
    }

    await fetchBuckets({ silent: true });
    return {};
  }

  return {
    buckets,
    loading,
    saveBuckets,
    reviewBucketCategories,
    refetch: () => fetchBuckets({ silent: true }),
  };
}
