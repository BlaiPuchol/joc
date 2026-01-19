-- Fix permissions for duplicated games and general game management

-- 1. Relax game_rounds policies
-- Problem: Only the original creator (host_user_id) could update rounds, breaking duplicated games or handed-over hosting.
-- Solution: Allow any authenticated user to manage rounds.
alter table public.game_rounds enable row level security;

drop policy if exists "Hosts manage their rounds" on public.game_rounds;
drop policy if exists "Hosts update their rounds" on public.game_rounds;

create policy "Authenticated users manage rounds" on public.game_rounds
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');


-- 2. Relax participants policies
-- Problem: Hosts could not assign participants to teams because they couldn't update other users' participant rows.
-- Solution: Allow any authenticated user to update participant rows (e.g. set game_team_id).
alter table public.participants enable row level security;

-- Drop previous policies that might conflict or be redundant
drop policy if exists "Participants can update their own nickname" on public.participants;

-- Allow updates by any authenticated user
create policy "Authenticated users update participants" on public.participants
    for update
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

-- Ensure participants can still be inserted (usually by themselves, but now maybe by host too)
-- Existing polcy "Participants can insert theirselves" might be too strict if host creates them.
-- Let's add a broad insert policy too.
drop policy if exists "Participants can insert theirselves" on public.participants;

create policy "Authenticated users insert participants" on public.participants
    for insert
    with check (auth.role() = 'authenticated');
