# Sprint 40.3 — Bucket Transfer RPC Verification Notes

These probes verify the security and balance behavior of the four
functions added in `0059_bucket_transfer_rpcs.sql`:

- `bucket_balance(bucket_id)`
- `transfer_bucket_money(source, destination, amount, note, client_request_id)`
- `archive_bucket(bucket_id)`
- `transfer_and_archive_bucket(source, destination, note, client_request_id)`

Run them in Supabase Studio's SQL Editor after the migration applies.
Each block is self-contained and uses `set local role` to simulate a
specific authenticated user (replace the JWT-style sub uuids with
real ones from `auth.users`).

> **Working pattern.** Open two Postgres sessions when you need to
> impersonate two different users. The simplest way is
> `select set_config('request.jwt.claim.sub', '<user-uuid>', true);`
> immediately followed by the RPC call. PostgREST does this for you
> over HTTP; you must do it manually in `psql`.

## Setup fixtures (paste once)

```sql
-- Two users in the same room with two active buckets each.
do $$
declare
  v_room  uuid;
  v_user_a uuid := '00000000-0000-0000-0000-00000000aaaa';
  v_user_b uuid := '00000000-0000-0000-0000-00000000bbbb';
  v_other_room uuid;
begin
  insert into auth.users (id, email) values
    (v_user_a, 'a@test'),
    (v_user_b, 'b@test')
  on conflict (id) do nothing;

  insert into public.profiles (id, display_name) values
    (v_user_a, 'Alice'),
    (v_user_b, 'Bob')
  on conflict (id) do nothing;

  -- Two rooms: A+B share `v_room`; A is the only member of `v_other_room`.
  insert into public.rooms (id, name, owner_id) values
    (gen_random_uuid(), 'Shared room', v_user_a)
  returning id into v_room;

  insert into public.rooms (id, name, owner_id) values
    (gen_random_uuid(), 'Solo room A', v_user_a)
  returning id into v_other_room;

  insert into public.room_members (room_id, user_id) values
    (v_room, v_user_a),
    (v_room, v_user_b),
    (v_other_room, v_user_a);

  insert into public.goals (user_id, room_id, target_amount, start_date, end_date) values
    (v_user_a, v_room, 100000, current_date, current_date + 365),
    (v_user_b, v_room, 100000, current_date, current_date + 365),
    (v_user_a, v_other_room, 100000, current_date, current_date + 365);

  insert into public.buckets (id, user_id, room_id, name, target_amount, position) values
    ('aaaa1111-0000-0000-0000-000000000001', v_user_a, v_room,       'A-Flight', 40000, 0),
    ('aaaa1111-0000-0000-0000-000000000002', v_user_a, v_room,       'A-Hotel',  40000, 1),
    ('bbbb1111-0000-0000-0000-000000000001', v_user_b, v_room,       'B-Flight', 40000, 0),
    ('aaaa2222-0000-0000-0000-000000000001', v_user_a, v_other_room, 'A-Solo',   40000, 0);

  insert into public.savings_logs (user_id, room_id, bucket_id, amount, created_at) values
    (v_user_a, v_room, 'aaaa1111-0000-0000-0000-000000000001', 1000, now()),
    (v_user_a, v_room, 'aaaa1111-0000-0000-0000-000000000001',  500, now()),
    (v_user_b, v_room, 'bbbb1111-0000-0000-0000-000000000001',  300, now());
end $$;
```

Helper for the rest of the doc:

```sql
-- Impersonate Alice for the next statement.
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-00000000aaaa', true);

-- Impersonate Bob.
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-00000000bbbb', true);
```

## bucket_balance

```sql
-- Expect 1500 (sum of two deposits).
select public.bucket_balance('aaaa1111-0000-0000-0000-000000000001'::uuid);

-- Empty bucket -> 0 (function should never return NULL).
select public.bucket_balance('aaaa1111-0000-0000-0000-000000000002'::uuid);
```

## transfer_bucket_money — happy path

```sql
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-00000000aaaa', true);

-- 1) Move 400 from A-Flight (1500) into A-Hotel (0).
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  400,
  'first transfer',
  'cccccccc-0000-0000-0000-000000000001'::uuid
);
-- Expect: source_balance_after = 1100, destination_balance_after = 400,
-- reused = false, activity_id not null.

-- 2) Replay the same request id — idempotent, no extra movement.
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  400,
  'first transfer',
  'cccccccc-0000-0000-0000-000000000001'::uuid
);
-- Expect: same row, reused = true. Balances unchanged.

-- 3) Different payload + same client_request_id -> error.
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  900,
  null,
  'cccccccc-0000-0000-0000-000000000001'::uuid
);
-- Expect ERROR with hint = transfer_invalid_request.
```

## transfer_bucket_money — attack cases (plan §9, §17)

Each block expects an ERROR with the noted `hint`. Confirm by reading
`SQLSTATE`/`HINT` from the error output (`psql` shows the hint;
PostgREST returns `hint` in the JSON body).

```sql
-- (A) Same bucket.
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  10, null, gen_random_uuid());
-- hint = transfer_same_bucket

-- (B) Destination is a partner bucket.
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'bbbb1111-0000-0000-0000-000000000001'::uuid,
  10, null, gen_random_uuid());
-- hint = transfer_partner_destination

-- (C) Source is a partner bucket (Alice tries to move Bob's money).
select * from public.transfer_bucket_money(
  'bbbb1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  10, null, gen_random_uuid());
-- hint = transfer_partner_source

-- (D) Cross-room (A-Solo is in a different room).
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa2222-0000-0000-0000-000000000001'::uuid,
  10, null, gen_random_uuid());
-- hint = transfer_cross_room

-- (E) Zero / negative / non-numeric amounts.
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  0, null, gen_random_uuid());
-- hint = transfer_invalid_amount
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  -1, null, gen_random_uuid());
-- hint = transfer_invalid_amount

-- (F) Three-decimal amount rounds to two; round-down to 0 should fail.
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  0.004, null, gen_random_uuid());
-- hint = transfer_invalid_amount (rounded to 0.00)

-- (G) Missing client_request_id.
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  10, null, null);
-- hint = transfer_invalid_request

-- (H) Insufficient balance.
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  99999999, null, gen_random_uuid());
-- hint = transfer_insufficient_balance, detail includes available + requested

-- (I) Archived source / destination — manually archive first.
update public.buckets set archived_at = now(), archived_by = user_id
 where id = 'aaaa1111-0000-0000-0000-000000000002';
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  10, null, gen_random_uuid());
-- hint = transfer_destination_archived
-- Revert so the rest of the doc still works:
update public.buckets set archived_at = null, archived_by = null
 where id = 'aaaa1111-0000-0000-0000-000000000002';

-- (J) Note length cap.
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  10, repeat('x', 281), gen_random_uuid());
-- hint = transfer_invalid_request
```

## archive_bucket

```sql
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-00000000aaaa', true);

-- Make A-Hotel empty for archival (it has 400 from the happy-path test
-- if you ran section 4 above; transfer back first).
select * from public.transfer_bucket_money(
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  public.bucket_balance('aaaa1111-0000-0000-0000-000000000002'::uuid),
  null, gen_random_uuid());

-- (A) Happy path: zero balance, two active buckets exist, archive
-- the empty one.
select * from public.archive_bucket('aaaa1111-0000-0000-0000-000000000002'::uuid);
-- Expect archived_at not null, reused = false.

-- (B) Re-archive: idempotent.
select * from public.archive_bucket('aaaa1111-0000-0000-0000-000000000002'::uuid);
-- reused = true, archived_at unchanged.

-- (C) Attempt to archive the now-last active bucket A-Flight.
select * from public.archive_bucket('aaaa1111-0000-0000-0000-000000000001'::uuid);
-- hint = archive_last_active (A-Flight still has 1500 anyway).

-- (D) Cross-user attack: Bob tries to archive Alice's bucket.
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-00000000bbbb', true);
select * from public.archive_bucket('aaaa1111-0000-0000-0000-000000000001'::uuid);
-- hint = archive_partner_bucket

-- (E) Nonzero balance.
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-00000000aaaa', true);
-- Recreate a non-empty bucket if needed, then:
select * from public.archive_bucket('aaaa1111-0000-0000-0000-000000000001'::uuid);
-- hint = archive_nonzero_balance, detail includes the balance.
```

## transfer_and_archive_bucket

```sql
-- Reset: unarchive A-Hotel so we have two active buckets again.
update public.buckets set archived_at = null, archived_by = null
 where id = 'aaaa1111-0000-0000-0000-000000000002';

select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-00000000aaaa', true);

-- (A) Happy path: move A-Flight's remaining balance into A-Hotel
-- and archive A-Flight in one transaction.
select * from public.transfer_and_archive_bucket(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  'goodbye flight bucket',
  'dddddddd-0000-0000-0000-000000000001'::uuid
);
-- Expect: amount > 0 (= the source balance), transfer_activity_id and
-- archive_activity_id both not null, reused = false.

-- (B) Idempotent replay.
select * from public.transfer_and_archive_bucket(
  'aaaa1111-0000-0000-0000-000000000001'::uuid,
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  'goodbye flight bucket',
  'dddddddd-0000-0000-0000-000000000001'::uuid
);
-- reused = true. No additional bucket_transfers or activity_events
-- rows inserted; verify with the COUNT probe below.

select count(*) from public.bucket_transfers
 where client_request_id = 'dddddddd-0000-0000-0000-000000000001';
-- Expect 1.

-- (C) Cross-user attack via destination.
select set_config('request.jwt.claim.sub',
                  '00000000-0000-0000-0000-00000000aaaa', true);
select * from public.transfer_and_archive_bucket(
  'aaaa1111-0000-0000-0000-000000000002'::uuid,
  'bbbb1111-0000-0000-0000-000000000001'::uuid,
  null, gen_random_uuid()
);
-- hint = archive_partner_destination
```

## Balance invariants

After every successful transfer the total user-room balance must be
preserved. Run this after each test block to assert no money was
manufactured or destroyed:

```sql
-- Compare two viewpoints for Alice in the shared room. They must
-- match within 0.01 numeric error.
select
  (select coalesce(sum(amount), 0)
     from public.savings_logs
    where user_id = '00000000-0000-0000-0000-00000000aaaa'
      and room_id  = (select room_id from public.buckets
                       where id = 'aaaa1111-0000-0000-0000-000000000001'))
  as total_deposits,
  (select coalesce(sum(public.bucket_balance(id)), 0)
     from public.buckets
    where user_id = '00000000-0000-0000-0000-00000000aaaa'
      and room_id = (select room_id from public.buckets
                      where id = 'aaaa1111-0000-0000-0000-000000000001')
      and archived_at is null)
  as active_bucket_balance,
  (select coalesce(sum(public.bucket_balance(id)), 0)
     from public.buckets
    where user_id = '00000000-0000-0000-0000-00000000aaaa'
      and room_id = (select room_id from public.buckets
                      where id = 'aaaa1111-0000-0000-0000-000000000001'))
  as all_bucket_balance;
-- total_deposits must equal all_bucket_balance (active + archived).
-- active_bucket_balance + balance(archived_buckets) must also equal
-- total_deposits.
```

## Cleanup

```sql
delete from public.activity_events where actor_user_id in
  ('00000000-0000-0000-0000-00000000aaaa',
   '00000000-0000-0000-0000-00000000bbbb');
delete from public.bucket_transfers where user_id in
  ('00000000-0000-0000-0000-00000000aaaa',
   '00000000-0000-0000-0000-00000000bbbb');
delete from public.savings_logs where user_id in
  ('00000000-0000-0000-0000-00000000aaaa',
   '00000000-0000-0000-0000-00000000bbbb');
delete from public.buckets where user_id in
  ('00000000-0000-0000-0000-00000000aaaa',
   '00000000-0000-0000-0000-00000000bbbb');
delete from public.goals where user_id in
  ('00000000-0000-0000-0000-00000000aaaa',
   '00000000-0000-0000-0000-00000000bbbb');
delete from public.room_members where user_id in
  ('00000000-0000-0000-0000-00000000aaaa',
   '00000000-0000-0000-0000-00000000bbbb');
delete from public.rooms where owner_id in
  ('00000000-0000-0000-0000-00000000aaaa',
   '00000000-0000-0000-0000-00000000bbbb');
delete from public.profiles where id in
  ('00000000-0000-0000-0000-00000000aaaa',
   '00000000-0000-0000-0000-00000000bbbb');
delete from auth.users where id in
  ('00000000-0000-0000-0000-00000000aaaa',
   '00000000-0000-0000-0000-00000000bbbb');
```

## Coverage map

| Plan §9 attack case | Verified by |
| --- | --- |
| Destination = partner bucket | §6 (B) |
| Source = partner bucket | §6 (C) |
| Bucket from another room | §6 (D) |
| Archived bucket | §6 (I) |
| Retried request id (idempotent) | §5 (2), §8 (B) |
| Double-click `Move Money` | §5 (2) — same client_request_id |
| Amount = 0 / negative / too many decimals | §6 (E), (F) |
| Archive nonzero | §7 (E) |
| Archive last active | §7 (C) |
| Archive partner bucket | §7 (D) |

## Production notes

- Direct insert/update/delete on `bucket_transfers` and
  `activity_events` is denied by the policies in `0058`. Probing
  those is a no-op here but worth a session-without-service-role
  check during release QA.
- The frontend hook (Sprint 40.4) reads `hint` from the PostgREST
  error to drive copy. Any change to the hint tokens above must be
  mirrored there.
