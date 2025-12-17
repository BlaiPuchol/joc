-- Allow hosts to delete their own games from the dashboard
begin;

drop policy if exists "Host can delete their games" on public.games;
create policy "Host can delete their games" on public.games
  for delete
  using (
    auth.uid() = host_user_id
    or host_user_id is null
  );

commit;
