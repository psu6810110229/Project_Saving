import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IconArrowRight,
  IconBell,
  IconCalendar,
  IconEdit,
  IconPiggyBank,
  IconTrendingUp,
  IconUser,
  IconVault,
} from '../Icon/Icon';
import { useAuth } from '../../hooks/useAuth';
import { notificationIconKind, resolveNotificationTarget, shouldToastNotification } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import { useToast } from './InAppToastProvider';
import type { NotificationItem } from '../../types';

type NotificationInsertRow = Omit<NotificationItem, 'payload'> & {
  payload: Record<string, unknown> | null;
};

function normalizeNotification(row: NotificationInsertRow): NotificationItem {
  return {
    ...row,
    payload: row.payload ?? {},
  };
}

function iconForNotification(eventKey: string) {
  switch (notificationIconKind(eventKey)) {
    case 'piggy':
      return <IconPiggyBank size={18} />;
    case 'calendar':
      return <IconCalendar size={18} />;
    case 'vault':
      return <IconVault size={18} />;
    case 'edit':
      return <IconEdit size={18} />;
    case 'user':
      return <IconUser size={18} />;
    case 'trend':
      return <IconTrendingUp size={18} />;
    case 'transfer':
      return <IconArrowRight size={18} />;
    case 'bell':
    default:
      return <IconBell size={18} />;
  }
}

function toneForNotification(eventKey: string): 'neutral' | 'success' | 'warning' {
  switch (eventKey) {
    case 'goal_reached':
    case 'bucket_goal_reached':
    case 'streak_milestone':
      return 'success';
    case 'nudge_received':
    case 'room_joined':
    case 'room_left':
    case 'balance_checked':
    case 'goal_changed':
    case 'plan_created':
    case 'plan_changed':
    case 'plan_paused':
    case 'plan_resumed':
    case 'plan_started':
    case 'overtaking':
    default:
      return 'neutral';
  }
}

export function InAppNotificationBridge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`in-app-toast:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${user.id}`,
        },
        payload => {
          if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
          if (location.pathname.startsWith('/notifications')) return;

          const next = normalizeNotification(payload.new as NotificationInsertRow);
          if (!shouldToastNotification(next.event_key)) return;

          showToast({
            title: next.title,
            body: next.body,
            tone: toneForNotification(next.event_key),
            icon: iconForNotification(next.event_key),
            onPress: () => {
              void supabase.rpc('mark_notification_read', { p_notification_id: next.id });
              navigate(resolveNotificationTarget(next));
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [location.pathname, navigate, showToast, user?.id]);

  return null;
}
