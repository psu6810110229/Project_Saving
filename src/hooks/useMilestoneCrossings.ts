import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MilestoneAcknowledgement, MilestoneThreshold } from '../types';

/**
 * Computed-on-read milestone tracker for the shared room target.
 *
 * Loads the (room_id, user_id) slice of `milestone_acknowledgements`
 * on mount and keeps it in sync via a realtime subscription. The
 * exposed `pendingThreshold` is the highest 25 / 50 / 75 / 90 cut
 * the room has crossed (totalSaved / target) but the current user
 * has not acknowledged yet. `acknowledge()` calls the
 * `acknowledge_milestone` RPC and optimistically marks the highest
 * pending threshold (and every lower one) as acknowledged so the
 * modal does not flash a lower threshold on the next render.
 *
 * No row is ever written to `savings_logs`; acknowledgements live
 * only in their own table. The hook treats `roomId === null` /
 * `userId === undefined` / `target <= 0` as "not ready yet" and
 * stays idle in those states.
 */

export const MILESTONE_THRESHOLDS: readonly MilestoneThreshold[] = [25, 50, 75, 90] as const;

interface UseMilestoneCrossingsInput {
  roomId: string | null;
  userId: string | undefined;
  totalSaved: number;
  target: number;
}

interface UseMilestoneCrossingsResult {
  pendingThreshold: MilestoneThreshold | null;
  acknowledge: () => Promise<void>;
}

function crossedThresholds(totalSaved: number, target: number): MilestoneThreshold[] {
  if (target <= 0 || totalSaved <= 0) return [];
  const pct = (totalSaved / target) * 100;
  return MILESTONE_THRESHOLDS.filter(t => pct >= t);
}

export function useMilestoneCrossings({
  roomId,
  userId,
  totalSaved,
  target,
}: UseMilestoneCrossingsInput): UseMilestoneCrossingsResult {
  const [acknowledged, setAcknowledged] = useState<Set<MilestoneThreshold>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  // Tracks which acknowledgement keys we have optimistically applied so a
  // realtime echo for the same threshold does not roll the set back to an
  // unacknowledged state.
  const optimisticRef = useRef<Set<MilestoneThreshold>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      // Reset cached acks whenever the (room, user) pair changes so a
      // stale set from a previous room cannot mark thresholds as
      // already-acknowledged on a fresh load.
      setAcknowledged(new Set());
      setLoaded(false);
      optimisticRef.current = new Set();

      if (!roomId || !userId) {
        if (!cancelled) setLoaded(true);
        return;
      }

      const { data, error } = await supabase
        .from('milestone_acknowledgements')
        .select('id, room_id, user_id, threshold, acknowledged_at')
        .eq('room_id', roomId)
        .eq('user_id', userId);
      if (cancelled) return;
      if (error) {
        setLoaded(true);
        return;
      }
      const next = new Set<MilestoneThreshold>();
      for (const row of (data ?? []) as MilestoneAcknowledgement[]) {
        const t = Number(row.threshold) as MilestoneThreshold;
        if ((MILESTONE_THRESHOLDS as readonly number[]).includes(t)) next.add(t);
      }
      for (const t of optimisticRef.current) next.add(t);
      setAcknowledged(next);
      setLoaded(true);
    }

    void initialise();

    if (!roomId || !userId) return;

    const channelId = `milestone-acks:${roomId}:${userId}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'milestone_acknowledgements',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          const row = payload.new as MilestoneAcknowledgement;
          if (row.user_id !== userId) return;
          const t = Number(row.threshold) as MilestoneThreshold;
          if (!(MILESTONE_THRESHOLDS as readonly number[]).includes(t)) return;
          setAcknowledged(prev => {
            if (prev.has(t)) return prev;
            const next = new Set(prev);
            next.add(t);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  const crossed = useMemo(
    () => crossedThresholds(totalSaved, target),
    [totalSaved, target],
  );

  const pendingThreshold = useMemo<MilestoneThreshold | null>(() => {
    if (!loaded) return null;
    for (let i = crossed.length - 1; i >= 0; i--) {
      const t = crossed[i];
      if (!acknowledged.has(t)) return t;
    }
    return null;
  }, [crossed, acknowledged, loaded]);

  async function acknowledge(): Promise<void> {
    if (!roomId || !userId) return;
    if (pendingThreshold === null) return;
    // When multiple thresholds are pending we show the highest one
    // and silently acknowledge every lower crossed threshold so they
    // do not pop up later as stale milestones (e.g. a user joining
    // a room already past 50% should not see a 25% modal next time).
    const toAck = crossed.filter(t => t <= pendingThreshold && !acknowledged.has(t));
    if (toAck.length === 0) return;

    setAcknowledged(prev => {
      const next = new Set(prev);
      for (const t of toAck) {
        next.add(t);
        optimisticRef.current.add(t);
      }
      return next;
    });

    for (const t of toAck) {
      const { error } = await supabase.rpc('acknowledge_milestone', {
        p_room_id: roomId,
        p_threshold: t,
      });
      if (error) {
        // Roll back this threshold so a transient RPC failure does
        // not permanently suppress the celebration on this device.
        setAcknowledged(prev => {
          if (!prev.has(t)) return prev;
          const next = new Set(prev);
          next.delete(t);
          return next;
        });
        optimisticRef.current.delete(t);
        if (typeof console !== 'undefined') {
          console.warn('[useMilestoneCrossings] acknowledge_milestone failed', error);
        }
      }
    }
  }

  return { pendingThreshold, acknowledge };
}
