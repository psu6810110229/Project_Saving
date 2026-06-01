import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const roomId = process.env.ROOM_ID;

if (!url || !anonKey || !accessToken || !roomId) {
  console.error('Missing required env vars: VITE_SUPABASE_URL/SUPABASE_URL, VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN, ROOM_ID');
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  global: {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function summarize(rows, nameKey = 'display_name') {
  const summary = new Map();
  for (const row of rows) {
    const key = row.user_id;
    const current = summary.get(key) ?? {
      user_id: row.user_id,
      display_name: row[nameKey] ?? '(unknown)',
      total: 0,
      count: 0,
      latest_at: null,
    };
    current.total += Number(row.amount ?? 0);
    current.count += 1;
    if (!current.latest_at || String(row.created_at).localeCompare(current.latest_at) > 0) {
      current.latest_at = String(row.created_at);
    }
    summary.set(key, current);
  }
  return Array.from(summary.values()).sort((a, b) => b.total - a.total);
}

const [
  rpcLogsRes,
  directLogsRes,
  membersRes,
  goalsRes,
] = await Promise.all([
  supabase.rpc('room_savings_logs_for_room', { p_room_id: roomId }),
  supabase
    .from('savings_logs')
    .select('id, user_id, amount, created_at, room_id, bucket_id, note')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false }),
  supabase.rpc('room_members_for_room', { p_room_id: roomId }),
  supabase
    .from('goals')
    .select('user_id, target_amount')
    .eq('room_id', roomId),
]);

if (rpcLogsRes.error) {
  console.error('RPC log read failed:', rpcLogsRes.error);
  process.exit(1);
}

if (directLogsRes.error) {
  console.error('Direct savings_logs read failed:', directLogsRes.error);
}

if (membersRes.error) {
  console.error('room_members_for_room failed:', membersRes.error);
}

if (goalsRes.error) {
  console.error('goals read failed:', goalsRes.error);
}

const rpcRows = Array.isArray(rpcLogsRes.data) ? rpcLogsRes.data : [];
const directRows = Array.isArray(directLogsRes.data) ? directLogsRes.data : [];
const members = Array.isArray(membersRes.data) ? membersRes.data : [];
const goals = Array.isArray(goalsRes.data) ? goalsRes.data : [];

console.log('=== Room members ===');
console.table(members.map(member => ({
  user_id: member.user_id,
  display_name: member.display_name,
  joined_at: member.joined_at,
  goal_target: goals.find(goal => goal.user_id === member.user_id)?.target_amount ?? null,
})));

console.log('=== RPC member totals ===');
console.table(summarize(rpcRows));

console.log('=== Direct savings_logs member totals ===');
console.table(summarize(directRows, 'display_name'));

console.log('=== Visibility diff by member ===');
const diffRows = members.map(member => {
  const rpcSummary = summarize(rpcRows).find(row => row.user_id === member.user_id);
  const directSummary = summarize(directRows, 'display_name').find(row => row.user_id === member.user_id);
  return {
    user_id: member.user_id,
    display_name: member.display_name,
    rpc_total: rpcSummary?.total ?? 0,
    direct_total: directSummary?.total ?? 0,
    rpc_count: rpcSummary?.count ?? 0,
    direct_count: directSummary?.count ?? 0,
  };
});
console.table(diffRows);

console.log('=== Raw RPC logs ===');
for (const row of rpcRows) {
  console.log(JSON.stringify({
    created_at: row.created_at,
    user_id: row.user_id,
    display_name: row.display_name,
    amount: Number(row.amount ?? 0),
    bucket_id: row.bucket_id,
    bucket_name: row.bucket_name,
    note: row.note,
  }));
}
