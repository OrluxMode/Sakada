-- 0017: store the route distance the fare was computed from (prep for N5).
-- Added on its own so the website can start sending it before 0018
-- starts requiring it. Safe to run any time; nothing reads it yet.

alter table deliveries
  add column if not exists distance_km numeric;
