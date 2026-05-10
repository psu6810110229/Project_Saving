import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Bucket, BucketDraft } from '../types';

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

  useEffect(() => { fetchBuckets(); }, [fetchBuckets]);

  async function saveBuckets(next: BucketDraft[]): Promise<{ error?: string }> {
    if (!user || !roomId) return { error: 'Not authenticated or no room' };

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

    // Upsert all remaining / new rows
    const rows = next.map((d, i) => ({
      ...(d.id ? { id: d.id } : {}),
      user_id: user.id,
      room_id: roomId,
      name: d.name,
      target_amount: d.target_amount,
      position: i,
    }));

    const { error: upsertErr } = await supabase
      .from('buckets')
      .upsert(rows, { onConflict: 'id' });

    if (upsertErr) return { error: upsertErr.message };
    await fetchBuckets();
    return {};
  }

  return { buckets, loading, saveBuckets };
}
