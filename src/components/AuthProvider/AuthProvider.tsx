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
    setUser(prev => (prev?.id === u?.id ? prev : u));
    // Instant profile from JWT metadata — no extra DB call
    setProfile(prev => {
      if (!u) return null;
      const next = profileFromUser(u);
      if (
        prev?.id === next.id
        && prev.display_name === next.display_name
        && prev.avatar_url === next.avatar_url
      ) {
        return prev;
      }
      return next;
    });
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) applySession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // One-shot DB backfill of the Google avatar onto profiles.avatar_url.
  // The handle_new_user() trigger (migration 0018) writes it for new
  // signups, but existing users created before 0018 have NULL in the DB,
  // so the head-to-head / activity feed / bucket rows render the
  // fallback initial. This effect writes the URL exactly once per
  // session and only when the DB row is currently NULL (preserving any
  // future user-uploaded avatar). Guarded by .is('avatar_url', null).
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata as { avatar_url?: string };
    const url = meta.avatar_url?.trim();
    if (!url) return;
    supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', user.id)
      .is('avatar_url', null)
      .then(({ error }) => {
        if (error && typeof console !== 'undefined') {
          console.warn('[AuthProvider] avatar backfill failed', error);
        }
      });
  }, [user]);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    applySession(null);
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
