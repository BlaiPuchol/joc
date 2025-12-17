-- Allow hosts to purge participants and rounds for a game
begin;

drop policy if exists "Host can reset participants" on public.participants;
create policy "Host can reset participants" on public.participants
  for delete
  using (
    exists (
      select 1 from public.games g
      where g.id = participants.game_id
        and g.host_user_id = auth.uid()
    )
  );

drop policy if exists "Hosts reset their rounds" on public.game_rounds;
create policy "Hosts reset their rounds" on public.game_rounds
  for delete
  using (
    exists (
      select 1 from public.games g
      where g.id = game_rounds.game_id
        and g.host_user_id = auth.uid()
    )
  );

commit;
