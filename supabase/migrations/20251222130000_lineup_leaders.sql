-- Allow team leaders to manage their own lineups and award challenge bonuses
begin;

drop policy if exists "Leaders manage lineups" on public.round_lineups;
create policy "Leaders manage lineups" on public.round_lineups
  for all
  using (
    exists (
      select 1
      from public.game_teams gt
      join public.participants leader on leader.id = gt.leader_participant_id
      join public.game_rounds gr on gr.id = round_lineups.round_id
      where gt.id = round_lineups.team_id
        and leader.user_id = auth.uid()
        and leader.game_team_id = gt.id
        and gr.state = 'leader_selection'
    )
    and exists (
      select 1
      from public.participants bench
      where bench.id = round_lineups.participant_id
        and bench.game_team_id = round_lineups.team_id
    )
  )
  with check (
    exists (
      select 1
      from public.game_teams gt
      join public.participants leader on leader.id = gt.leader_participant_id
      join public.game_rounds gr on gr.id = round_lineups.round_id
      where gt.id = round_lineups.team_id
        and leader.user_id = auth.uid()
        and leader.game_team_id = gt.id
        and gr.state = 'leader_selection'
    )
    and exists (
      select 1
      from public.participants bench
      where bench.id = round_lineups.participant_id
        and bench.game_team_id = round_lineups.team_id
    )
  );

-- Refresh team_scores view with winner bonus derived from round outcomes
drop view if exists public.team_scores;
create view public.team_scores as
with params as (
  select 5::int as win_bonus
),
round_totals as (
  select
    gr.game_id,
    gr.id as round_id,
    gr.losing_team_id,
    rv.participant_id,
    rv.game_team_id as predicted_team_id,
    p.game_team_id as origin_team_id
  from public.game_rounds gr
  left join public.round_votes rv on rv.round_id = gr.id
  left join public.participants p on p.id = rv.participant_id
),
vote_points as (
  select
    gt.game_id,
    gt.id as team_id,
    coalesce(sum(
      case
        when rt.losing_team_id is null or rt.origin_team_id is distinct from gt.id then 0
        when rt.predicted_team_id = rt.losing_team_id then 1
        else -1
      end
    ), 0) as vote_score
  from public.game_teams gt
  left join round_totals rt on rt.game_id = gt.game_id and rt.origin_team_id = gt.id
  where gt.is_active is true
  group by gt.game_id, gt.id
),
challenge_bonus as (
  select
    gt.game_id,
    gt.id as team_id,
    coalesce(sum(
      case
        when gr.losing_team_id is null then 0
        when gt.id = gr.losing_team_id then 0
        when exists (
          select 1
          from public.round_lineups rl
          where rl.round_id = gr.id and rl.team_id = gt.id
        ) then (select win_bonus from params)
        else 0
      end
    ), 0) as challenge_score
  from public.game_teams gt
  cross join params
  left join public.game_rounds gr on gr.game_id = gt.game_id
  where gt.is_active is true
  group by gt.game_id, gt.id, params.win_bonus
)
select
  gt.game_id,
  gt.id as team_id,
  gt.name,
  gt.color_hex,
  coalesce(vp.vote_score, 0) + coalesce(cb.challenge_score, 0) as total_score
from public.game_teams gt
left join vote_points vp on vp.team_id = gt.id
left join challenge_bonus cb on cb.team_id = gt.id and cb.game_id = gt.game_id
where gt.is_active is true
group by gt.game_id, gt.id, gt.name, gt.color_hex, vp.vote_score, cb.challenge_score;

commit;
