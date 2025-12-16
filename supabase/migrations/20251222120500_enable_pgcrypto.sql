-- Ensure pgcrypto extension exists for gen_random_bytes usage
begin;

create extension if not exists pgcrypto with schema public;

commit;
