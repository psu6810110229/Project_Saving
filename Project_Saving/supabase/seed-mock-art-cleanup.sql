-- Removes the mock Art user and all related data
-- Run in Supabase SQL Editor when you no longer need mock data

DO $$
DECLARE
  art_id uuid := '00000000-0000-0000-0000-000000000art';
BEGIN
  DELETE FROM public.savings_logs WHERE user_id = art_id;
  DELETE FROM public.goals         WHERE user_id = art_id;
  DELETE FROM public.profiles      WHERE id = art_id;
  DELETE FROM auth.users           WHERE id = art_id;
END $$;
