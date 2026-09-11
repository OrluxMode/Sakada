-- Notifications — Phase 8
-- Rows here are what a bell icon / notifications list reads from. Insert
-- one whenever something notification-worthy happens (a status trigger,
-- or application code) — see docs/SCHEMA.md for the event list.
create table
    notifications (
        id uuid primary key default gen_random_uuid (),
        user_id uuid not null references profiles (id) on delete cascade,
        delivery_id uuid references deliveries (id) on delete cascade,
        message text not null,
        is_read boolean not null default false,
        created_at timestamptz not null default now ()
    );

create index idx_notifications_user on notifications (user_id);

-- Ratings / feedback — Phase 9
-- One rating per (delivery, rater) pair — so both the requester and the
-- driver can each leave one rating about the other for the same delivery.
create table
    ratings (
        id uuid primary key default gen_random_uuid (),
        delivery_id uuid not null references deliveries (id) on delete cascade,
        rated_by uuid not null references profiles (id),
        rated_user_id uuid not null references profiles (id),
        rating smallint not null check (rating between 1 and 5),
        comment text,
        created_at timestamptz not null default now (),
        unique (delivery_id, rated_by)
    );

create index idx_ratings_rated_user on ratings (rated_user_id);