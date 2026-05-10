import { useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGoal } from '../hooks/useGoal';
import { useLogs } from '../hooks/useLogs';
import { useStreak } from '../hooks/useStreak';
import { useRoom } from '../components/RoomContext/RoomContext';
import { GoalForm } from '../components/GoalForm/GoalForm';
import { BucketEditor } from '../components/BucketEditor/BucketEditor';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/format';
import {
  biggestSave,
  totalLogCount,
  longestStreak,
} from '../lib/userStats';

export function ProfilePage() {
  const { profile, signOut } = useAuth();
  const { activeRoomId } = useRoom();
  const { goal, loading: goalLoading, save: saveGoal } = useGoal(activeRoomId);
  const { logs, loading: logsLoading } = useLogs(500, activeRoomId); // load more for stats
  const myLogs = useMemo(
    () => logs.filter(l => l.user_id === profile?.id),
    [logs, profile?.id],
  );

  const { streak } = useStreak(profile?.id, logs);
  const longest = useMemo(() => longestStreak(myLogs), [myLogs]);
  const biggest = useMemo(() => biggestSave(myLogs), [myLogs]);
  const logCount = useMemo(() => totalLogCount(myLogs), [myLogs]);
  const total = useMemo(() => myLogs.reduce((s, l) => s + l.amount, 0), [myLogs]);

  // Display name editor
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);

  async function handleSaveName() {
    if (!profile) return;
    const trimmed = displayName.trim();
    if (!trimmed) { setNameError('Name cannot be empty'); return; }
    setNameSaving(true);
    setNameError('');
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', profile.id);
      
    await supabase.auth.updateUser({ data: { full_name: trimmed, name: trimmed } });
    setNameSaving(false);
    if (error) { setNameError(error.message); }
    else { setNameSaved(true); setTimeout(() => setNameSaved(false), 2000); }
  }

  // Goal editor toggle
  const [goalOpen, setGoalOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <div className="max-w-sm mx-auto px-4 pt-6 flex flex-col gap-5">

        {/* Header & Avatar */}
        <div className="flex items-center gap-4 animate-fade-in-up">
          <label className="relative cursor-pointer group">
            <div className="w-16 h-16 rounded-full overflow-hidden shadow-sm">
              <img 
                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=D4651A&color=fff`} 
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] text-white font-bold tracking-widest uppercase">Edit</span>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !profile) return;
                try {
                  const ext = file.name.split('.').pop();
                  const filePath = `${profile.id}/avatar_${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
                  if (upErr) throw upErr;
                  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                  await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } });
                  await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
                } catch (err: any) {
                  alert('Error uploading avatar: ' + err.message);
                }
              }} 
            />
          </label>
          <h1 className="text-2xl text-ink font-semibold">
            Hey, {profile?.display_name ?? '…'} 
          </h1>
        </div>

        {/* Display name */}
        <section className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <span className="text-xs text-ink-muted uppercase tracking-widest font-semibold">Display name</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setNameSaved(false); }}
              className="flex-1 bg-surface border-2 border-border rounded-xl px-4 py-3 text-ink text-base outline-none focus:border-terracotta transition-colors"
              placeholder="Your name"
            />
            <button
              onClick={handleSaveName}
              disabled={nameSaving}
              className="bg-terracotta text-white rounded-xl px-5 py-3 text-sm font-bold shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 transition-all"
            >
              {nameSaving ? '…' : nameSaved ? '✓' : 'Save'}
            </button>
          </div>
          {nameError && <p className="text-red-500 text-xs">{nameError}</p>}
        </section>

        {/* Goal */}
        <section className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted uppercase tracking-widest font-semibold">Your goal</span>
            <button
              onClick={() => setGoalOpen(o => !o)}
              className="text-xs text-terracotta font-medium"
            >
              {goalOpen ? 'Cancel' : 'Edit goal'}
            </button>
          </div>

          {goalLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
            </div>
          ) : goal ? (
            <>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Target</span>
                  <span className="text-ink font-semibold">{formatCurrency(goal.target_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Start</span>
                  <span className="text-ink">{goal.start_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">End</span>
                  <span className="text-ink">{goal.end_date}</span>
                </div>
              </div>
              {goalOpen && (
                <div className="border-t border-border pt-4">
                  <GoalForm initial={goal} onSave={async v => { const r = await saveGoal(v); if (!r.error) setGoalOpen(false); return r; }} />
                </div>
              )}
            </>
          ) : (
            <GoalForm initial={null} onSave={async v => { const r = await saveGoal(v); if (!r.error) setGoalOpen(false); return r; }} />
          )}
        </section>

        {/* Buckets */}
        {activeRoomId && goal && (
          <section className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <BucketEditor
              roomId={activeRoomId}
              goalTarget={goal.target_amount}
              logs={myLogs}
            />
          </section>
        )}

        {/* Stats */}
        <section className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <span className="text-xs text-ink-muted uppercase tracking-widest font-semibold">Your stats</span>
          {logsLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <StatRow label="Total saved" value={formatCurrency(total)} />
              <StatRow label="Current streak" value={` ${streak} day${streak !== 1 ? 's' : ''}`} />
              <StatRow label="Longest streak" value={` ${longest} day${longest !== 1 ? 's' : ''}`} />
              <StatRow label="Biggest single" value={formatCurrency(biggest)} />
              <StatRow label="Total logs" value={String(logCount)} />
            </div>
          )}
        </section>

        {/* Sign out */}
        <div className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
          <button
            onClick={signOut}
            className="w-full bg-surface border border-border rounded-xl py-3 text-sm font-medium text-ink-muted hover:text-red-500 hover:border-red-300 transition-colors"
          >
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink font-semibold">{value}</span>
    </div>
  );
}
