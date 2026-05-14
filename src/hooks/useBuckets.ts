import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Bucket, BucketDraft } from '../types';
import { formatCurrency } from '../lib/format';

export interface UseBucketsResult {
  buckets: Bucket[];
  loading: boolean;
  saveBuckets: (next: BucketDraft[]) => Promise<{ error?: string }>;
}

export function useBuckets(roomId: string | null): UseBucketsResult {
  const { user } = useAuth();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBuckets = useCallback(async () => {
    if (!roomId || !user) { setBuckets([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('buckets')
      .select('*')
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .order('position', { ascending: true });
    setLoading(false);
    if (!error) setBuckets(data ?? []);
  }, [roomId, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBuckets();
  }, [fetchBuckets]);

  async function saveBuckets(next: BucketDraft[]): Promise<{ error?: string }> {
    if (!user || !roomId) return { error: 'Not authenticated or no room' };

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
        return { error: `Bucket targets exceed your main goal of ${formatCurrency(goalTarget)}.` };
      }
    }

    const currentIds = buckets.map(b => b.id);
    const nextIds = next.filter(d => d.id !== undefined).map(d => d.id as string);

    // Detect deletes
    const toDelete = currentIds.filter(id => !nextIds.includes(id));

    // Check if deleted buckets have logs
    for (const id of toDelete) {
      const { count, error: countErr } = await supabase
        .from('savings_logs')
        .select('id', { count: 'exact', head: true })
        .eq('bucket_id', id);
      if (countErr) return { error: countErr.message };
      const logCount = count ?? 0;
      if (logCount > 0) {
        const bName = buckets.find(b => b.id === id)?.name ?? id;
        return { error: `Bucket "${bName}" has ${logCount} log${logCount !== 1 ? 's' : ''}; reassign or delete those first.` };
      }
    }

    // Execute deletes
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('buckets')
        .delete()
        .in('id', toDelete);
      if (delErr) return { error: delErr.message };
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
    }));

    const inserts = next.filter(d => d.id === undefined).map((d, i) => ({
      user_id: user.id,
      room_id: roomId,
      name: d.name,
      target_amount: d.target_amount,
      category: d.category ?? 'other',
      position: i + updates.length,
    }));

    // Execute updates
    if (updates.length > 0) {
      const { error: upErr } = await supabase
        .from('buckets')
        .upsert(updates, { onConflict: 'id' });
      if (upErr) return { error: upErr.message };
    }

    // Execute inserts
    if (inserts.length > 0) {
      const { error: insErr } = await supabase
        .from('buckets')
        .insert(inserts);
      if (insErr) return { error: insErr.message };
    }

    await fetchBuckets();
    return {};
  }

  return { buckets, loading, saveBuckets };
}
