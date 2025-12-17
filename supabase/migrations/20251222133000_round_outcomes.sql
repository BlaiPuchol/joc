begin;

create table if not exists public.round_outcomes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  team_id uuid not null references public.game_teams(id) on delete cascade,
  is_loser boolean not null default false,
  challenge_points integer not null default 0,
  constraint round_outcomes_unique unique (round_id, team_id),
  constraint round_outcomes_points_non_negative check (challenge_points >= 0)
);

create index if not exists round_outcomes_round_id_idx on public.round_outcomes (round_id);
create index if not exists round_outcomes_team_id_idx on public.round_outcomes (team_id);

alter table public.round_outcomes enable row level security;
drop policy if exists "Round outcomes readable" on public.round_outcomes;
create policy "Round outcomes readable" on public.round_outcomes
  for select using (true);

drop policy if exists "Hosts manage round outcomes" on public.round_outcomes;
create policy "Hosts manage round outcomes" on public.round_outcomes
  for all using (
    exists (
      select 1
      from public.game_rounds gr
      join public.games g on g.id = gr.game_id
      where gr.id = round_outcomes.round_id
        and g.host_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.game_rounds gr
      join public.games g on g.id = gr.game_id
      where gr.id = round_outcomes.round_id
        and g.host_user_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.round_outcomes;

drop view if exists public.game_results;
drop view if exists public.team_scores;

create view public.team_scores as
with params as (
  select 3::int as vote_reward
),
correct_votes as (
  select
    gr.game_id,
    p.game_team_id as origin_team_id,
    count(*) as total_correct
  from public.round_votes rv
  join public.participants p on p.id = rv.participant_id
  join public.game_rounds gr on gr.id = rv.round_id
  where p.game_team_id is not null
    and exists (
      select 1
      from public.round_outcomes ro
      where ro.round_id = rv.round_id
        and ro.team_id = rv.game_team_id
        and ro.is_loser is true
    )
  group by gr.game_id, p.game_team_id
),
vote_points as (
  select
    gt.game_id,
    gt.id as team_id,
    coalesce(cv.total_correct, 0) * params.vote_reward as vote_score
  from public.game_teams gt
  left join correct_votes cv on cv.origin_team_id = gt.id and cv.game_id = gt.game_id
  cross join params
  where gt.is_active is true
),
challenge_points as (
  select
    gt.game_id,
    gt.id as team_id,
    coalesce(sum(ro.challenge_points), 0) as challenge_score
  from public.game_teams gt
  left join public.round_outcomes ro on ro.team_id = gt.id
  left join public.game_rounds gr on gr.id = ro.round_id
  where gt.is_active is true
    and (gr.game_id = gt.game_id or gr.id is null)
  group by gt.game_id, gt.id
)
select
  gt.game_id,
  gt.id as team_id,
  gt.name,
  gt.color_hex,
  coalesce(vp.vote_score, 0) + coalesce(cp.challenge_score, 0) as total_score
from public.game_teams gt
left join vote_points vp on vp.team_id = gt.id and vp.game_id = gt.game_id
left join challenge_points cp on cp.team_id = gt.id and cp.game_id = gt.game_id
where gt.is_active is true
group by gt.game_id, gt.id, gt.name, gt.color_hex, vp.vote_score, cp.challenge_score;

create view public.game_results as
with params as (
  select 3::int as vote_reward
),
participant_totals as (
  select
    p.id as participant_id,
    count(*) as total_correct
  from public.round_votes rv
  join public.participants p on p.id = rv.participant_id
  where exists (
    select 1
    from public.round_outcomes ro
    where ro.round_id = rv.round_id
      and ro.team_id = rv.game_team_id
      and ro.is_loser is true
  )
  group by p.id
)
select
  p.id as participant_id,
  p.nickname,
  p.game_id,
  coalesce(pt.total_correct, 0) * params.vote_reward as total_score
from public.participants p
left join participant_totals pt on pt.participant_id = p.id
cross join params;

commit;
