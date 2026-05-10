import { useState, useMemo } from 'react';
import { Modal } from '../Modal/Modal';
import { SavingsChart } from '../SavingsChart/SavingsChart';
import { cumulativeSeries, compareSummary } from '../../lib/comparisonStats';
import { formatCurrency } from '../../lib/format';
import { localDateKey, APP_TZ } from '../../lib/streak';
import type { LeaderboardEntry } from '../../hooks/useLeaderboard';
import type { SavingsLog } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  me: LeaderboardEntry;
  others: LeaderboardEntry[];
  allLogs: SavingsLog[];
  defaultTargetId?: string;
}

function todayKey() {
  return localDateKey(new Date().toISOString(), APP_TZ);
}

export function ComparePopup({ open, onClose, me, others, allLogs, defaultTargetId }: Props) {
  const [targetId, setTargetId] = useState<string>(defaultTargetId ?? others[0]?.userId ?? '');

  const them = useMemo(
    () => others.find(o => o.userId === targetId) ?? others[0],
    [others, targetId],
  );

  const myLogs = useMemo(() => allLogs.filter(l => l.user_id === me.userId), [allLogs, me.userId]);
  const theirLogs = useMemo(() => allLogs.filter(l => l.user_id === them?.userId), [allLogs, them]);

  const today = todayKey();

  const mySummary = useMemo(() => compareSummary(myLogs, today, me.target), [myLogs, today, me.target]);
  const theirSummary = useMemo(() => compareSummary(theirLogs, today, them?.target ?? null), [theirLogs, today, them]);

  // Chart series — align to union date range
  const { mySeries, theirSeries } = useMemo(() => {
    const allDates = [
      ...myLogs.map(l => localDateKey(l.created_at, APP_TZ)),
      ...theirLogs.map(l => localDateKey(l.created_at, APP_TZ)),
    ];
    if (allDates.length === 0) return { mySeries: [], theirSeries: [] };
    const fromDate = allDates.reduce((a, b) => (a < b ? a : b));
    const toDate = today;
    return {
      mySeries: cumulativeSeries(myLogs, fromDate, toDate),
      theirSeries: cumulativeSeries(theirLogs, fromDate, toDate),
    };
  }, [myLogs, theirLogs, today]);

  if (!them) return null;

  const theirName = them.displayName;
  const myName = `${me.displayName} (you)`;

  return (
    <Modal open={open} onClose={onClose} title={`You vs ${theirName}`}>
      {/* Target selector (if multiple opponents) */}
      {others.length > 1 && (
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink">You vs</span>
            <select
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-terracotta"
            >
              {others.map(o => (
                <option key={o.userId} value={o.userId}>{o.displayName}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="px-5 py-4 flex flex-col gap-5">
        {/* Chart */}
        <SavingsChart
          myName={me.displayName}
          theirName={theirName}
          mySeries={mySeries}
          theirSeries={theirSeries}
        />

        {/* Stats table */}
        <div>
          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 mb-2">
            <div />
            <span className="text-xs text-ink-muted font-semibold text-right">{myName}</span>
            <span className="text-xs text-ink-muted font-semibold text-right">{theirName}</span>
          </div>

          <div className="flex flex-col gap-2">
            <StatRow
              label="Saved"
              myVal={formatCurrency(mySummary.saved)}
              theirVal={formatCurrency(theirSummary.saved)}
              myWins={mySummary.saved > theirSummary.saved}
              theirWins={theirSummary.saved > mySummary.saved}
            />
            <StatRow
              label="Started"
              myVal={mySummary.startedAt ?? '—'}
              theirVal={theirSummary.startedAt ?? '—'}
            />
            <StatRow
              label="Streak"
              myVal={mySummary.currentStreak > 0 ? ` ${mySummary.currentStreak}` : '—'}
              theirVal={theirSummary.currentStreak > 0 ? ` ${theirSummary.currentStreak}` : '—'}
              myWins={mySummary.currentStreak > theirSummary.currentStreak}
              theirWins={theirSummary.currentStreak > mySummary.currentStreak}
            />
            <StatRow
              label="Longest"
              myVal={mySummary.longestStreak > 0 ? ` ${mySummary.longestStreak}` : '—'}
              theirVal={theirSummary.longestStreak > 0 ? ` ${theirSummary.longestStreak}` : '—'}
              myWins={mySummary.longestStreak > theirSummary.longestStreak}
              theirWins={theirSummary.longestStreak > mySummary.longestStreak}
            />
            <StatRow
              label="Biggest"
              myVal={formatCurrency(mySummary.biggestSave)}
              theirVal={formatCurrency(theirSummary.biggestSave)}
              myWins={mySummary.biggestSave > theirSummary.biggestSave}
              theirWins={theirSummary.biggestSave > mySummary.biggestSave}
            />
            <StatRow
              label="Logs"
              myVal={String(mySummary.logCount)}
              theirVal={String(theirSummary.logCount)}
              myWins={mySummary.logCount > theirSummary.logCount}
              theirWins={theirSummary.logCount > mySummary.logCount}
            />
            <StatRow
              label="Predict"
              myVal={mySummary.predictedEnd ?? '—'}
              theirVal={theirSummary.predictedEnd ?? '—'}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface StatRowProps {
  label: string;
  myVal: string;
  theirVal: string;
  myWins?: boolean;
  theirWins?: boolean;
}

function StatRow({ label, myVal, theirVal, myWins, theirWins }: StatRowProps) {
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 items-center">
      <span className="text-xs text-ink-muted w-14">{label}</span>
      <span className={`text-sm font-semibold text-right ${myWins ? 'text-terracotta' : 'text-ink'}`}>
        {myVal}
      </span>
      <span className={`text-sm font-semibold text-right ${theirWins ? 'text-terracotta' : 'text-ink'}`}>
        {theirVal}
      </span>
    </div>
  );
}
