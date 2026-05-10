import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGoal } from '../hooks/useGoal';
import { useLogs } from '../hooks/useLogs';
import { useBuckets } from '../hooks/useBuckets';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useReactionBroadcast } from '../hooks/useReactionBroadcast';
import { useAllLogs } from '../hooks/useAllLogs';
import { useRoom } from '../components/RoomContext/RoomContext';
import { CountdownCard } from '../components/CountdownCard/CountdownCard';
import { ForecastCard } from '../components/ForecastCard/ForecastCard';
import { Leaderboard } from '../components/Leaderboard/Leaderboard';
import { LogList } from '../components/LogList/LogList';
import { LogPopup } from '../components/LogPopup/LogPopup';
import { CompareButton } from '../components/CompareButton/CompareButton';
import { ComparePopup } from '../components/ComparePopup/ComparePopup';
import { RoomSwitcher } from '../components/RoomSwitcher/RoomSwitcher';
import { ReactionFloater } from '../components/ReactionFloater/ReactionFloater';
import { BucketGrid } from '../components/BucketGrid/BucketGrid';
import { LogAmountModal } from '../components/LogAmountModal/LogAmountModal';

export function BattlePage() {
  const { profile } = useAuth();
  const { activeRoomId, rooms } = useRoom();
  const navigate = useNavigate();

  const { goal, loading: goalLoading } = useGoal(activeRoomId);
  const { logs, loading: logsLoading, insert } = useLogs(5, activeRoomId);
  const { buckets } = useBuckets(activeRoomId);
  const { total } = useSavingsTotal(profile?.id, logs);
  const leaderboardState = useLeaderboard(logs, profile?.id, activeRoomId);
  const { sendPing } = useReactionBroadcast(() => {});
  const [logPopupOpen, setLogPopupOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedBucketForLog, setSelectedBucketForLog] = useState<any | null>(null);

  const { logs: allLogs } = useAllLogs(activeRoomId);

  function handleInsert(amount: number, bucketId: string, note?: string) {
    return insert(amount, bucketId, note);
  }

  const players = leaderboardState.entries.map(e => ({
    userId: e.userId,
    displayName: e.displayName,
  }));

  const myEntry = leaderboardState.entries.find(e => e.isYou);
  const otherEntries = leaderboardState.entries.filter(e => !e.isYou);
  const defaultTargetId = otherEntries.find(e => e.rank === 1)?.userId ?? otherEntries[0]?.userId;
  const canCompare = !leaderboardState.loading && !!myEntry && otherEntries.length > 0;

  // No room yet — direct to Goal tab
  if (!activeRoomId && rooms.length === 0 && !leaderboardState.loading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl"></span>
        <p className="text-lg font-semibold text-ink">No battle room yet</p>
        <p className="text-sm text-ink-muted">Create or join a room to start saving with friends.</p>
        <button
          onClick={() => navigate('/goal')}
          className="bg-terracotta text-white rounded-xl px-6 py-3 text-sm font-bold shadow-sm hover:shadow-md active:scale-95 transition-all"
        >
          Go to Goal tab
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-sm mx-auto px-4 pt-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 animate-fade-in-up">
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl text-ink font-semibold truncate">
              Hey, {profile?.display_name ?? '…'} 
            </h1>
            <RoomSwitcher />
          </div>
        </div>

        {/* 1. Timeline context (Japan trip) */}
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <CountdownCard goal={goal} />
        </div>

        {/* 2. Leaderboard */}
        <div className="flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Leaderboard state={leaderboardState} />
          <CompareButton onClick={() => setCompareOpen(true)} disabled={!canCompare} />
        </div>

        {/* 3. Progress (ForecastCard) */}
        {goalLoading ? (
          <div className="bg-surface border border-border rounded-xl p-5 flex justify-center animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <ForecastCard goal={goal} savedSoFar={total} />
          </div>
        )}

        {/* 4. Bucket Selection Grid */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-5 shadow-sm hover:shadow-md transition-shadow animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <BucketGrid 
            buckets={buckets} 
            allLogs={allLogs} 
            onSelect={setSelectedBucketForLog} 
          />
        </div>

        {/* 5. Activity feed */}
        <div className="flex flex-col gap-2 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <span className="text-xs text-ink-muted uppercase tracking-widest">Recent activity</span>
          <div className="bg-surface border border-border rounded-xl px-4">
            <LogList
              logs={logs}
              loading={logsLoading}
              onSendPing={sendPing}
              footer={
                <button
                  onClick={() => setLogPopupOpen(true)}
                  className="text-sm text-terracotta font-medium hover:underline"
                >
                  See all logs →
                </button>
              }
            />
          </div>
        </div>

      </div>

      {logPopupOpen && (
        <LogPopup
          open={logPopupOpen}
          onClose={() => setLogPopupOpen(false)}
          onSendPing={sendPing}
          players={players}
          roomId={activeRoomId}
        />
      )}

      {compareOpen && myEntry && (
        <ComparePopup
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          me={myEntry}
          others={otherEntries}
          allLogs={allLogs}
          defaultTargetId={defaultTargetId}
        />
      )}

      <ReactionFloater onPing={() => {}} />

      {/* Log Modal */}
      <LogAmountModal
        open={!!selectedBucketForLog}
        onClose={() => setSelectedBucketForLog(null)}
        bucket={selectedBucketForLog}
        onInsert={handleInsert}
        leaderboardState={leaderboardState}
      />
    </div>
  );
}
