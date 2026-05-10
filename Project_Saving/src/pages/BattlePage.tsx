import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGoal } from '../hooks/useGoal';
import { useLogs } from '../hooks/useLogs';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useReactionBroadcast } from '../hooks/useReactionBroadcast';
import { CountdownCard } from '../components/CountdownCard/CountdownCard';
import { ForecastCard } from '../components/ForecastCard/ForecastCard';
import { Leaderboard } from '../components/Leaderboard/Leaderboard';
import { BattleNudge } from '../components/BattleNudge/BattleNudge';
import { QuickLogBar } from '../components/QuickLogBar/QuickLogBar';
import { ManualLogForm } from '../components/ManualLogForm/ManualLogForm';
import { LogList } from '../components/LogList/LogList';
import { LogPopup } from '../components/LogPopup/LogPopup';
import { CompareButton } from '../components/CompareButton/CompareButton';
import { ComparePopup } from '../components/ComparePopup/ComparePopup';
import { ReactionFloater } from '../components/ReactionFloater/ReactionFloater';
import { useAllLogs } from '../hooks/useAllLogs';

export function BattlePage() {
  const { profile } = useAuth();
  const { goal, loading: goalLoading } = useGoal();
  const { logs, loading: logsLoading, insert } = useLogs(5);
  const { total } = useSavingsTotal(profile?.id, logs);
  const leaderboardState = useLeaderboard(logs, profile?.id);
  const { sendPing } = useReactionBroadcast(() => {});
  const [pendingAmount, setPendingAmount] = useState(0);
  const [logPopupOpen, setLogPopupOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // For ComparePopup — all logs needed for chart + stats. Only mounted when compare is open.
  const { logs: allLogs } = useAllLogs();

  function handleInsert(amount: number, note?: string) {
    setPendingAmount(0);
    return insert(amount, note);
  }

  const players = leaderboardState.entries.map(e => ({
    userId: e.userId,
    displayName: e.displayName,
  }));

  // My leaderboard entry
  const myEntry = leaderboardState.entries.find(e => e.isYou);
  // Others = all entries except me
  const otherEntries = leaderboardState.entries.filter(e => !e.isYou);
  // Default compare target: the leader (if not me), else first other
  const defaultTargetId = otherEntries.find(e => e.rank === 1)?.userId ?? otherEntries[0]?.userId;

  const canCompare = !leaderboardState.loading && !!myEntry && otherEntries.length > 0;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-sm mx-auto px-4 pt-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl text-ink font-semibold">
            Hey, {profile?.display_name ?? '…'} 👋
          </h1>
          <CompareButton
            onClick={() => setCompareOpen(true)}
            disabled={!canCompare}
          />
        </div>

        {/* Leaderboard */}
        <Leaderboard state={leaderboardState} />

        {/* Log composer + Battle Nudge */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-5">
          <QuickLogBar
            onInsert={amount => handleInsert(amount)}
            onPreview={setPendingAmount}
          />
          <div className="border-t border-border" />
          <ManualLogForm
            onInsert={(amount, note) => handleInsert(amount, note)}
            onPreview={setPendingAmount}
          />
          {profile?.id && leaderboardState.entries.length > 0 && (
            <BattleNudge
              leaderboard={leaderboardState.entries}
              myUserId={profile.id}
              pendingAmount={pendingAmount}
            />
          )}
        </div>

        {/* Timeline context */}
        <CountdownCard />

        {goalLoading ? (
          <div className="bg-surface border border-border rounded-xl p-5 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
          </div>
        ) : (
          <ForecastCard goal={goal} savedSoFar={total} />
        )}

        {/* Activity feed — 5-log preview */}
        <div className="flex flex-col gap-2">
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

      {/* Full-history popup */}
      {logPopupOpen && (
        <LogPopup
          open={logPopupOpen}
          onClose={() => setLogPopupOpen(false)}
          onSendPing={sendPing}
          players={players}
        />
      )}

      {/* Compare popup — mounts allLogs subscription only while open */}
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
    </div>
  );
}
