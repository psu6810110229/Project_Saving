# Sprint 1: Bucket Pause Schema And RPCs

## Branch

`feat/bucket-pause-data`

## Goal

Add the bucket-level data primitives needed for pause/resume without touching UI behavior yet.

## Global Rules

- Run `npm run build`
- Do not run MCP Browser or in-app browser
- Add new migrations only, do not edit old migrations
- Do not remove or replace legacy `saving_plan_pauses`

## Required Context

- `supabase/migrations/0004_buckets.sql`
- latest migration number
- existing bucket RLS policies
- `src/types/index.ts`
- legacy pause migrations `0035_saving_plan_pauses.sql`, `0036_saving_plan_pauses_same_day_resume.sql`

## Data Model

### `bucket_plan_pauses`

Purpose: append-only pause history per bucket.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `bucket_id uuid not null references public.buckets(id) on delete cascade`
- `room_id uuid not null references public.rooms(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `paused_from date not null`
- `resumed_from date null`
- `created_at timestamptz not null default now()`
- `resumed_at timestamptz null`
- `client_request_id uuid null`
- `resume_client_request_id uuid null`

Indexes/constraints:

- unique open pause per bucket where `resumed_from is null`
- `resumed_from is null or resumed_from >= paused_from`
- index on `(bucket_id, paused_from)`
- optional unique `(user_id, client_request_id)` where request id is not null

### `bucket_plan_revisions`

Purpose: preserve historical saving rule semantics. This prevents resume recalculation from rewriting how old streak periods are interpreted.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `bucket_id uuid not null references public.buckets(id) on delete cascade`
- `room_id uuid not null`
- `user_id uuid not null`
- `effective_from_date date not null`
- `deadline date null`
- `target_amount numeric not null`
- `saving_rule_type text null`
- `saving_rule_amount numeric null`
- `saving_rule_start_amount numeric null`
- `saving_rule_increment numeric null`
- `saving_rule_cap numeric null`
- `saving_rule_day_count integer null`
- `saving_rule_start_date date null`
- `reminder_day integer null`
- `source text not null`
- `created_at timestamptz not null default now()`

Indexes:

- `(bucket_id, effective_from_date desc, created_at desc)`
- `(room_id, user_id)`

Backfill:

- Add one `migration_backfill` revision for existing buckets.
- Effective date should be based on the current bucket rule start semantics:
  - `saving_rule_start_date` when present
  - otherwise Bangkok date from `created_at`

## RPCs

### `pause_bucket_plan`

Inputs:

- `p_bucket_id uuid`
- `p_paused_from date default null`
- `p_client_request_id uuid default null`

Rules:

- auth required
- bucket must exist
- caller must own bucket
- caller must be room member
- bucket must not be archived
- default `paused_from` = Bangkok today
- no past pause in MVP
- fail if open pause exists unless same request id can be reused
- return pause row or pause id

### `resume_bucket_plan`

Inputs:

- `p_bucket_id uuid`
- `p_resumed_from date default null`
- recalculated rule snapshot fields, if Sprint 2 chooses client-side calculation
- `p_client_request_id uuid default null`

Rules:

- auth required
- caller must own bucket
- open pause required
- same-day resume allowed
- default `resumed_from` = Bangkok today
- close pause row
- update current `buckets` read-model rule fields only with explicit inputs
- append `bucket_plan_revisions` row with source `resume_recalculated`
- all writes happen atomically

## RLS

- Owner can select own pause/revision rows.
- Do not grant co-members direct select on full pause/revision history rows in the first release.
- Partner visibility is locked to paused/resumed status only; raw paused/resumed dates stay owner-only.
- If Sprint 1 needs partner-visible state, expose a sanitized status read model/RPC that returns bucket id, room id, owner id, and paused/resumed status without raw dates.
- Direct insert/update/delete disabled.
- Writes through RPCs only.

## Files Likely Touched

- `supabase/migrations/<new>_bucket_plan_pauses.sql`
- `supabase/migrations/<new>_bucket_plan_revisions.sql`
- `src/types/index.ts`

## Verification

- `npm run build`
- No MCP Browser

## Manual Test Checklist

- Pause own active bucket succeeds.
- Pause partner bucket fails.
- Pause archived bucket fails.
- Repeat pause with same request id is safe.
- Resume own paused bucket succeeds.
- Same-day resume creates no functional paused day.
- Direct table writes are blocked by RLS.

## Risks

- RLS may hide rows from UI.
- Backfill effective date can affect old streak if chosen incorrectly.
- RPC return shape must be stable before hooks are built.
