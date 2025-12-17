-- Relax lineup RLS to let leaders (and hosts) manage entries while still enforcing team membership
begin;

drop policy if exists "Leaders manage lineups" on public.round_lineups;

create policy "Leaders manage lineups" on public.round_lineups
  for all
  using (
    exists (
      select 1
      from public.game_rounds gr
      join public.games g on g.id = gr.game_id
      join public.game_teams gt on gt.id = round_lineups.team_id and gt.game_id = g.id
      left join public.participants leaders on leaders.id = gt.leader_participant_id
      where gr.id = round_lineups.round_id
        and (
          g.host_user_id = auth.uid() or
          (leaders.user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1
      from public.game_rounds gr
      join public.games g on g.id = gr.game_id
      join public.game_teams gt on gt.id = round_lineups.team_id and gt.game_id = g.id
      left join public.participants leaders on leaders.id = gt.leader_participant_id
      where gr.id = round_lineups.round_id
        and (
          g.host_user_id = auth.uid() or
          (leaders.user_id = auth.uid())
        )
    )
    and exists (
      select 1
      from public.participants p
      where p.id = round_lineups.participant_id
        and p.game_team_id = round_lineups.team_id
    )
  );

commit;
