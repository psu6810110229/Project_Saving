-- Seed script: create mock "Art" user for UI testing
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING / DO UPDATE)

DO $$
DECLARE
  art_id uuid := '00000000-0000-0000-0000-000000000a47';
BEGIN

  -- 1. Insert mock auth user for Art
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    raw_app_meta_data
  ) VALUES (
    art_id,
    'authenticated',
    'authenticated',
    'art.mock@project-saving.test',
    '',
    now(),
    now() - INTERVAL '90 days',
    now(),
    '{"full_name": "Art"}'::jsonb,
    '{"provider": "mock", "providers": ["mock"]}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- 2. Profile
  INSERT INTO public.profiles (id, display_name, created_at)
  VALUES (art_id, 'Art', now() - INTERVAL '90 days')
  ON CONFLICT (id) DO UPDATE SET display_name = 'Art';

  -- 3. Goal (฿50,000 target, same trip deadline)
  INSERT INTO public.goals (user_id, target_amount, start_date, end_date, updated_at)
  VALUES (art_id, 50000, '2025-01-01', '2027-11-01', now())
  ON CONFLICT (user_id) DO UPDATE
    SET target_amount = 50000,
        start_date    = '2025-01-01',
        end_date      = '2027-11-01',
        updated_at    = now();

  -- 4. Savings logs spread over the last 70 days (total ≈ ฿19,800)
  --    Art is behind but actively saving — gap is close and exciting
  INSERT INTO public.savings_logs (user_id, amount, note, created_at) VALUES
    (art_id, 1000, 'First deposit!',          now() - INTERVAL '70 days'),
    (art_id,  500, 'Skipped grab',             now() - INTERVAL '67 days'),
    (art_id,  500, NULL,                       now() - INTERVAL '64 days'),
    (art_id, 1000, 'Freelance bonus',          now() - INTERVAL '61 days'),
    (art_id,  100, NULL,                       now() - INTERVAL '59 days'),
    (art_id,  500, 'Cooked at home all week',  now() - INTERVAL '56 days'),
    (art_id, 1000, NULL,                       now() - INTERVAL '53 days'),
    (art_id,  500, 'Sold old headphones',      now() - INTERVAL '50 days'),
    (art_id,  100, NULL,                       now() - INTERVAL '48 days'),
    (art_id, 1000, 'Monthly bonus',            now() - INTERVAL '45 days'),
    (art_id,  500, NULL,                       now() - INTERVAL '42 days'),
    (art_id,  500, 'No coffee week',           now() - INTERVAL '39 days'),
    (art_id, 1000, NULL,                       now() - INTERVAL '36 days'),
    (art_id,  100, 'Small save',               now() - INTERVAL '34 days'),
    (art_id,  500, NULL,                       now() - INTERVAL '31 days'),
    (art_id, 1000, 'Overtime pay',             now() - INTERVAL '28 days'),
    (art_id,  500, NULL,                       now() - INTERVAL '25 days'),
    (art_id,  500, 'Packed lunch x5',          now() - INTERVAL '22 days'),
    (art_id, 1000, NULL,                       now() - INTERVAL '19 days'),
    (art_id,  100, NULL,                       now() - INTERVAL '17 days'),
    (art_id,  500, 'Weekend hustle',           now() - INTERVAL '14 days'),
    (art_id, 1000, NULL,                       now() - INTERVAL '11 days'),
    (art_id,  500, 'Cut subscriptions',        now() - INTERVAL '8 days'),
    (art_id,  500, NULL,                       now() - INTERVAL '5 days'),
    (art_id, 1000, 'Japan jar 🇯🇵',            now() - INTERVAL '3 days'),
    (art_id,  500, NULL,                       now() - INTERVAL '2 days'),
    (art_id,  100, 'Morning save',             now() - INTERVAL '1 day');

END $$;

-- Verify: check Art's total
SELECT
  p.display_name,
  COUNT(l.id)        AS log_count,
  SUM(l.amount)      AS total_saved,
  g.target_amount    AS target
FROM public.profiles p
LEFT JOIN public.savings_logs l ON l.user_id = p.id
LEFT JOIN public.goals g        ON g.user_id = p.id
WHERE p.display_name = 'Art'
GROUP BY p.display_name, g.target_amount;
