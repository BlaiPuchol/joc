-- 3. Relax round_outcomes policies
-- Problem: Selecting losers creates round_outcomes, but the policy was restricted to the original host_user_id.
-- Solution: Allow any authenticated user to manage round outcomes.
alter table public.round_outcomes enable row level security;

drop policy if exists "Hosts manage round outcomes" on public.round_outcomes;

create policy "Authenticated users manage round outcomes" on public.round_outcomes
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

