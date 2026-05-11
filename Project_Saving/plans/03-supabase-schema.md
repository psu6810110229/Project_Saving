# Task 3 — Supabase Project + Schema + RLS

## Goal
Stand up the Supabase backend that all later tasks depend on: auth-linked user profiles, per-user goals, savings logs, and reactions — with row-level security so Fan and Art only mutate their own rows but can read each other's.

## Deliverables
- A Supabase project (free tier).
- SQL migration file checked into repo: `supabase/migrations/0001_init.sql`.
- `.env.local` populated with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `.env.local.example` updated with the two keys (no values).
- README snippet: how to apply migration via Supabase SQL editor.

## Tables

### `profiles`
| col | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | references `auth.users(id)` ON DELETE CASCADE |
| `display_name` | `text` not null | "Fan" or "Art" |
| `created_at` | `timestamptz` default `now()` |

Trigger: on `auth.users` insert → insert matching `profiles` row with `display_name = email local-part` (editable later).

### `goals`
| col | type | notes |
| --- | --- | --- |
| `user_id` | `uuid` PK | FK → `profiles.id` |
| `target_amount` | `numeric(12,2)` not null check (>0) |
| `start_date` | `date` not null |
| `end_date` | `date` not null check (`end_date >= start_date`) |
| `updated_at` | `timestamptz` default `now()` |

One row per user (PK = user_id). Upsert on save.

### `savings_logs`
| col | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK default `gen_random_uuid()` |
| `user_id` | `uuid` not null FK → `profiles.id` |
| `amount` | `numeric(12,2)` not null check (>0) |
| `note` | `text` |
| `created_at` | `timestamptz` default `now()` |

Index: `(user_id, created_at desc)` for feed queries; `(created_at desc)` for shared feed.

### `reactions`
| col | type | notes |
| --- | --- | --- |
| `log_id` | `uuid` FK → `savings_logs.id` ON DELETE CASCADE |
| `user_id` | `uuid` FK → `profiles.id` |
| `emoji` | `text` check in (`'fire'`, `'heart'`, `'clap'`) |
| PK | `(log_id, user_id, emoji)` |

## RLS Policies
Enable RLS on all four tables.

- `profiles`:
  - SELECT: any authenticated user (both partners need to see each other's name).
  - UPDATE: `auth.uid() = id`.
- `goals`:
  - SELECT: any authenticated user.
  - INSERT/UPDATE: `auth.uid() = user_id`.
- `savings_logs`:
  - SELECT: any authenticated user.
  - INSERT: `auth.uid() = user_id`.
  - UPDATE/DELETE: `auth.uid() = user_id` (allows correcting typos).
- `reactions`:
  - SELECT: any authenticated user.
  - INSERT/DELETE: `auth.uid() = user_id`.

## Realtime
- Enable Supabase Realtime publication on `savings_logs` and `reactions`.

## Seed (optional, dev only)
- After both Fan and Art sign up once, manually insert a baseline goal each via SQL editor.

## Risks
- Forgetting RLS = open database. Verify with: log in as Fan, attempt to insert a row with `user_id = Art's uuid` → must fail.
- Numeric vs integer: use `numeric(12,2)` to keep cents accurate; never `float`.
- Time zones: `created_at` is `timestamptz`. Streak math (Task 9) must convert to user's local TZ explicitly.
- Migration idempotency: wrap each `create table` with `if not exists` to allow re-running safely.

## Acceptance Criteria
- [ ] Migration runs cleanly on a fresh project.
- [ ] All four tables exist with correct constraints.
- [ ] RLS is enabled on all four; manual cross-user write attempt fails.
- [ ] Realtime publication includes `savings_logs` and `reactions`.
- [ ] `.env.local` has working URL + anon key (verified by a one-off `curl` to the REST endpoint).
- [ ] Migration SQL is committed; secrets are NOT.
