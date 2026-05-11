import { useEffect, useState } from 'react';
import { DEFAULT_THEME, type ThemeSwatch } from '../lib/theme';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { useAuth } from './useAuth';

interface ProfileUpdateValues {
  display_name: string;
  theme_color: ThemeSwatch;
}

export function useProfile() {
  const { user, profile: authProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(authProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchProfile() {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, theme_color, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setProfile(authProfile);
    } else {
      setProfile((data as Profile | null) ?? authProfile);
    }
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(async () => {
      if (!user) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, theme_color, created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setProfile(authProfile);
      } else {
        setProfile((data as Profile | null) ?? authProfile);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateProfile(values: ProfileUpdateValues): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: values.display_name.trim(),
        theme_color: values.theme_color,
      })
      .eq('id', user.id);

    if (updateError) return { error: updateError.message };

    setProfile(prev => ({
      id: user.id,
      display_name: values.display_name.trim(),
      avatar_url: prev?.avatar_url ?? authProfile?.avatar_url ?? null,
      theme_color: values.theme_color,
      created_at: prev?.created_at ?? authProfile?.created_at ?? user.created_at,
    }));
    return {};
  }

  return {
    profile,
    loading,
    error,
    themeColor: profile?.theme_color ?? DEFAULT_THEME,
    refetch: fetchProfile,
    updateProfile,
  };
}
