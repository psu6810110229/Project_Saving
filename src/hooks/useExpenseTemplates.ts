import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ExpenseTemplate } from '../types';

interface ExpenseTemplatesResult {
  templates: ExpenseTemplate[];
  loading: boolean;
  error: string | null;
}

interface ExpenseTemplatesState extends ExpenseTemplatesResult {
  roomId: string | null;
}

export function useExpenseTemplates(roomId: string | null): ExpenseTemplatesResult {
  const [state, setState] = useState<ExpenseTemplatesState>({
    roomId: null,
    templates: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!roomId) {
      return;
    }

    void Promise.resolve().then(() => {
      if (!cancelled) {
        setState(prev => ({
          ...prev,
          roomId,
          templates: prev.roomId === roomId ? prev.templates : [],
          loading: true,
          error: null,
        }));
      }
    });

    supabase
      .from('expense_templates')
      .select('*')
      .eq('room_id', roomId)
      .order('deadline', { ascending: true })
      .order('priority', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setState({ roomId, templates: [], loading: false, error: error.message });
          return;
        }
        setState({
          roomId,
          templates: (data ?? []) as ExpenseTemplate[],
          loading: false,
          error: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (!roomId) {
    return { templates: [], loading: false, error: null };
  }

  if (state.roomId !== roomId) {
    return { templates: [], loading: true, error: null };
  }

  return state;
}
