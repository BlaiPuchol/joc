-- Allow any authenticated host session to manage games regardless of UID
begin;

drop policy if exists "Host can update their games" on public.games;
create policy "Hosts manage games" on public.games
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Allow host sessions to delete or take over management of existing decks
drop policy if exists "Host can delete their games" on public.games;
create policy "Hosts delete games" on public.games
  for delete
  using (auth.role() = 'authenticated');

drop policy if exists "Hosts manage game challenges" on public.game_challenges;
create policy "Hosts manage game challenges" on public.game_challenges
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Hosts manage game teams" on public.game_teams;
create policy "Hosts manage game teams" on public.game_teams
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

commit;
