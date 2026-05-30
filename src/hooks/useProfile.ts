import { useEffect, useState } from 'react';
import { DEFAULT_THEME, type ThemeSwatch } from '../lib/theme';
import { supabase } from '../lib/supabase';
import type { Profile, ProfileLanguage } from '../types';
import { useAuth } from './useAuth';

interface ProfileUpdateValues {
  display_name: string;
  theme_color: ThemeSwatch;
}

const DEFAULT_QUICK_AMOUNTS = [100, 500, 1000, 2000];

function mergeProfileWithAuthProfile(profile: Profile | null, authProfile: Profile | null): Profile | null {
  if (!profile) return authProfile;
  if (!authProfile || profile.id !== authProfile.id) return profile;

  const identitySetupIncomplete = !profile.identity_setup_completed_at;
  const displayName = identitySetupIncomplete
    ? authProfile.display_name?.trim() || profile.display_name?.trim() || authProfile.display_name
    : profile.display_name?.trim() || authProfile.display_name;
  const avatarUrl = identitySetupIncomplete
    ? authProfile.avatar_url?.trim() || profile.avatar_url?.trim() || null
    : profile.avatar_url?.trim() || authProfile.avatar_url || null;

  return {
    ...profile,
    display_name: displayName,
    avatar_url: avatarUrl,
    created_at: profile.created_at || authProfile.created_at,
  };
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
      .select('id, display_name, avatar_url, theme_color, quick_add_amounts, ui_language, bucket_drag_hint_seen_at, identity_setup_completed_at, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError.message);
      setProfile(authProfile);
    } else {
      setProfile(mergeProfileWithAuthProfile((data as Profile | null) ?? null, authProfile));
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
        .select('id, display_name, avatar_url, theme_color, quick_add_amounts, ui_language, bucket_drag_hint_seen_at, identity_setup_completed_at, created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setProfile(authProfile);
      } else {
        setProfile(mergeProfileWithAuthProfile((data as Profile | null) ?? null, authProfile));
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, authProfile]);

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
      quick_add_amounts: prev?.quick_add_amounts ?? DEFAULT_QUICK_AMOUNTS,
      identity_setup_completed_at: prev?.identity_setup_completed_at ?? null,
      created_at: prev?.created_at ?? authProfile?.created_at ?? user.created_at,
    }));
    return {};
  }

  /**
   * Uploads a new avatar image to the public `avatars` storage bucket
   * and updates profiles.avatar_url with the resulting public URL.
   * The path is namespaced by user id so users can only overwrite
   * their own avatar (in line with Supabase Storage object-policy
   * defaults). Returns the new URL on success.
   */
  async function uploadAvatar(file: File): Promise<{ error?: string; url?: string }> {
    if (!user) return { error: 'Not authenticated' };
    if (!file.type.startsWith('image/')) return { error: 'Please choose an image file.' };
    if (file.size > 5 * 1024 * 1024) return { error: 'Image must be smaller than 5 MB.' };

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
    if (uploadError) return { error: uploadError.message };

    const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = publicUrl.publicUrl;

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', user.id);
    if (dbError) return { error: dbError.message };

    setProfile(prev => prev ? { ...prev, avatar_url: url } : prev);
    return { url };
  }

  async function updateLanguage(language: ProfileLanguage): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ ui_language: language })
      .eq('id', user.id);

    if (updateError) return { error: updateError.message };

    setProfile(prev => prev ? { ...prev, ui_language: language } : prev);
    return {};
  }

  /**
   * Marks the one-time bucket-drag hint as seen. Idempotent: once
   * `bucket_drag_hint_seen_at` is set the hint never reopens for this
   * account, even on a fresh device. Optimistic — UI is updated
   * immediately and the row write happens in the background.
   * (Task 40 / Sprint 40.9.)
   */
  async function markBucketDragHintSeen(): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };
    if (profile?.bucket_drag_hint_seen_at) return {};

    const seenAt = new Date().toISOString();
    setProfile(prev => prev ? { ...prev, bucket_drag_hint_seen_at: seenAt } : prev);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ bucket_drag_hint_seen_at: seenAt })
      .eq('id', user.id);
    if (updateError) return { error: updateError.message };
    return {};
  }

  async function updateQuickAmounts(amounts: number[]): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };

    const cleaned = Array.from(new Set(amounts.map(Number)))
      .filter(amount => Number.isInteger(amount) && amount > 0)
      .slice(0, 6);

    if (cleaned.length === 0) return { error: 'Add at least one quick amount.' };

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ quick_add_amounts: cleaned })
      .eq('id', user.id);

    if (updateError) return { error: updateError.message };

    setProfile(prev => prev ? { ...prev, quick_add_amounts: cleaned } : prev);
    return {};
  }

  async function completeIdentitySetup(): Promise<{ error?: string }> {
    if (!user) return { error: 'Not authenticated' };

    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ identity_setup_completed_at: completedAt })
      .eq('id', user.id);

    if (updateError) return { error: updateError.message };

    setProfile(prev => prev ? { ...prev, identity_setup_completed_at: completedAt } : prev);
    return {};
  }

  return {
    profile,
    loading,
    error,
    themeColor: profile?.theme_color ?? DEFAULT_THEME,
    quickAmounts: profile?.quick_add_amounts?.length ? profile.quick_add_amounts : DEFAULT_QUICK_AMOUNTS,
    refetch: fetchProfile,
    updateProfile,
    updateQuickAmounts,
    updateLanguage,
    uploadAvatar,
    completeIdentitySetup,
    markBucketDragHintSeen,
  };
}
