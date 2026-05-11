import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import { AuthContext } from './AuthContext';

function profileFromUser(user: User): Profile {
  const meta = user.user_metadata as { full_name?: string; name?: string; email?: string; avatar_url?: string };
  return {
    id: user.id,
    display_name: meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? 'User',
    avatar_url: meta.avatar_url,
    created_at: user.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  function applySession(s: Session | null) {
    setSession(s);
    const u = s?.user ?? null;
    setUser(u);
    // Instant profile from JWT metadata — no extra DB call
    setProfile(u ? profileFromUser(u) : null);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s);
      // Sync display_name to profiles table in the background
      if (s?.user) {
        const u = s.user;
        const meta = u.user_metadata as { full_name?: string; name?: string };
        const display_name = meta.full_name ?? meta.name ?? u.email?.split('@')[0] ?? 'User';
        supabase.from('profiles').upsert({ id: u.id, display_name }, { onConflict: 'id' }).then(() => {});
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
