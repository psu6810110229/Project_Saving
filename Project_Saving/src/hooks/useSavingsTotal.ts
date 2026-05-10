import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useSavingsTotal(userId: string | undefined) {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setTotal(0); setLoading(false); return; }
    supabase
      .from('savings_logs')
      .select('amount')
      .eq('user_id', userId)
      .then(({ data }) => {
        const sum = (data ?? []).reduce((acc, row) => acc + Number(row.amount), 0);
        setTotal(sum);
        setLoading(false);
      });
  }, [userId]);

  return { total, loading };
}
