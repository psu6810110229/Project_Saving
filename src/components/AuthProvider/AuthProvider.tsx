import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import { AuthContext } from './AuthContext';

function firstText(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function profileFromUser(user: User): Profile {
  const meta = user.user_metadata as {
    full_name?: string;
    name?: string;
    email?: string;
    avatar_url?: string;
    picture?: string;
    user_name?: string;
  };
  const identities = Array.isArray((user as { identities?: unknown[] }).identities)
    ? ((user as { identities?: Array<{ identity_data?: Record<string, unknown> | null }> }).identities ?? [])
    : [];
  const identityData = identities
    .map(identity => identity.identity_data ?? undefined)
    .find(Boolean);

  const displayName = firstText(
    meta.full_name,
    meta.name,
    meta.user_name,
    identityData?.full_name,
    identityData?.name,
    identityData?.user_name,
    user.email?.split('@')[0],
    'User',
  ) ?? 'User';

  const avatarUrl = firstText(
    meta.avatar_url,
    meta.picture,
    identityData?.avatar_url,
    identityData?.picture,
    identityData?.picture_url,
    identityData?.photo_url,
  ) ?? null;

  return {
    id: user.id,
    display_name: displayName,
    avatar_url: avatarUrl,
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

  // Backfill missing Google identity fields onto the profile row once the
  // session is known. The UI already reads from JWT metadata instantly, but
  // persisting missing name/photo fields keeps later DB-backed views aligned.
  useEffect(() => {
    if (!user) return;
    const nextProfile = profileFromUser(user);
    const nextName = nextProfile.display_name?.trim();
    const nextAvatar = nextProfile.avatar_url?.trim();
    if (!nextName && !nextAvatar) return;

    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error) {
          if (typeof console !== 'undefined') {
            console.warn('[AuthProvider] identity preload failed', error);
          }
          return;
        }

        const currentName = data?.display_name?.trim();
        const currentAvatar = data?.avatar_url?.trim();
        const patch: { display_name?: string; avatar_url?: string } = {};
        if (!currentName && nextName) patch.display_name = nextName;
        if (!currentAvatar && nextAvatar) patch.avatar_url = nextAvatar;
        if (!patch.display_name && !patch.avatar_url) return;

        const { error: updateError } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', user.id);

        if (updateError && typeof console !== 'undefined') {
          console.warn('[AuthProvider] identity backfill failed', updateError);
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
