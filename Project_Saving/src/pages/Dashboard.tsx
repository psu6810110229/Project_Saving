import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGoal } from '../hooks/useGoal';
import { useLogs } from '../hooks/useLogs';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { useBattleStats } from '../hooks/useBattleStats';
import { useReactionBroadcast } from '../hooks/useReactionBroadcast';
import { CountdownCard } from '../components/CountdownCard/CountdownCard';
import { ForecastCard } from '../components/ForecastCard/ForecastCard';
import { BattleDashboard } from '../components/BattleDashboard/BattleDashboard';
import { BattleNudge } from '../components/BattleNudge/BattleNudge';
import { QuickLogBar } from '../components/QuickLogBar/QuickLogBar';
import { ManualLogForm } from '../components/ManualLogForm/ManualLogForm';
import { LogList } from '../components/LogList/LogList';
import { ReactionFloater } from '../components/ReactionFloater/ReactionFloater';

export function Dashboard() {
  const { profile, signOut } = useAuth();
  const { goal, loading: goalLoading } = useGoal();
  const { logs, loading: logsLoading, insert } = useLogs(30);
  const { total } = useSavingsTotal(profile?.id, logs);
  const battleStats = useBattleStats(logs);
  const { sendPing } = useReactionBroadcast(() => {});
  const [pendingAmount, setPendingAmount] = useState(0);

  const myPlayer = battleStats.players?.find(p => p.userId === profile?.id);
  const partnerPlayer = battleStats.players?.find(p => p.userId !== profile?.id);

  function handleInsert(amount: number, note?: string) {
    setPendingAmount(0);
    return insert(amount, note);
  }

  return (
    <div className="min-h-screen bg-canvas pb-10">
      <div className="max-w-sm mx-auto px-4 pt-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl text-ink font-semibold">
            Hey, {profile?.display_name ?? '…'} 👋
          </h1>
          <div className="flex items-center gap-3">
            <Link to="/settings" className="text-ink-muted text-sm">Settings</Link>
            <button onClick={signOut} className="text-ink-muted text-sm">Sign out</button>
          </div>
        </div>

        {/* Hero: Battle progress */}
        <BattleDashboard stats={battleStats} />

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
          {myPlayer && partnerPlayer && (
            <BattleNudge
              myTotal={myPlayer.saved}
              partnerTotal={partnerPlayer.saved}
              partnerName={partnerPlayer.displayName}
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

        {/* Activity feed */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-ink-muted uppercase tracking-widest">Recent activity</span>
          <div className="bg-surface border border-border rounded-xl px-4">
            <LogList logs={logs} loading={logsLoading} onSendPing={sendPing} />
          </div>
        </div>

      </div>
      <ReactionFloater onPing={() => {}} />
    </div>
  );
}
