-- Host dashboard + team experience overhaul
begin;

-- 1) Games now behave like reusable decks -----------------------------------
alter table public.games
  add column if not exists title text not null default 'Untitled Game',
  add column if not exists description text not null default '',
  add column if not exists status text not null default 'draft',
  add column if not exists lobby_code text not null default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  add column if not exists max_teams integer not null default 4,
  add column if not exists max_players_per_team integer;

create unique index if not exists games_lobby_code_key on public.games (lobby_code);

alter table public.games
  drop constraint if exists games_status_check;
alter table public.games
  add constraint games_status_check
  check (status in ('draft', 'ready', 'live', 'completed', 'archived'));

-- 2) Challenges catalogue per game -----------------------------------------
create table if not exists public.game_challenges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id uuid not null references public.games(id) on delete cascade,
  position integer not null,
  title text not null,
  description text,
  participants_per_team integer,
  constraint game_challenges_position_uniq unique (game_id, position),
  constraint game_challenges_participants_positive
    check (participants_per_team is null or participants_per_team > 0)
);
create index if not exists game_challenges_game_id_idx on public.game_challenges (game_id);

-- 3) Game-specific teams ----------------------------------------------------
create table if not exists public.game_teams (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  game_id uuid not null references public.games(id) on delete cascade,
  template_team_id uuid references public.teams(id) on delete set null,
  slug text,
  name text not null,
  color_hex text not null,
  position integer not null,
  is_active boolean not null default true,
  leader_participant_id uuid references public.participants(id) on delete set null,
  constraint game_teams_position_uniq unique (game_id, position)
);
create index if not exists game_teams_game_id_idx on public.game_teams (game_id);

-- 4) Participants can belong to a game team ---------------------------------
alter table public.participants
  add column if not exists game_team_id uuid references public.game_teams(id) on delete set null;

-- 5) Round lineups per challenge -------------------------------------------
create table if not exists public.round_lineups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  round_id uuid not null references public.game_rounds(id) on delete cascade,
  team_id uuid not null references public.game_teams(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  constraint round_lineups_unique unique (round_id, team_id, participant_id)
);
create index if not exists round_lineups_round_id_idx on public.round_lineups (round_id);

-- 6) Votes now reference game specific teams --------------------------------
alter table public.round_votes
  add column if not exists game_team_id uuid references public.game_teams(id) on delete cascade;

with vote_team_mapping as (
  select
    rv.id as round_vote_id,
    gt.id as game_team_id
  from public.round_votes rv
  join public.game_rounds gr on gr.id = rv.round_id
  join public.games g on g.id = gr.game_id
  join public.game_teams gt on gt.game_id = g.id
  join public.teams t on t.id = rv.team_id
  where gt.template_team_id = t.id
)
update public.round_votes rv
set game_team_id = vtm.game_team_id
from vote_team_mapping vtm
where rv.id = vtm.round_vote_id
  and rv.game_team_id is null;

drop view if exists public.game_results;
drop view if exists public.team_scores;

alter table public.round_votes drop constraint if exists round_votes_team_id_fkey;
alter table public.round_votes drop column if exists team_id;

alter table public.round_votes drop constraint if exists round_votes_game_team_id_fkey;

alter table public.round_votes
  add constraint round_votes_game_team_id_fkey
  foreign key (game_team_id) references public.game_teams(id) on delete cascade;
alter table public.round_votes
  alter column game_team_id set not null;

-- 7) Rounds store losing game team -----------------------------------------
alter table public.game_rounds
  add column if not exists losing_game_team_id uuid references public.game_teams(id) on delete set null;
alter table public.game_rounds
  add column if not exists challenge_id uuid references public.game_challenges(id) on delete set null;

with losing_team_mapping as (
  select
    gr.id as round_id,
    gt.id as new_losing_team_id
  from public.game_rounds gr
  join public.games g on g.id = gr.game_id
  join public.game_teams gt on gt.game_id = g.id
  join public.teams t on t.id = gr.losing_team_id
  where gt.template_team_id = t.id
    and gr.losing_team_id is not null
)
update public.game_rounds gr
set losing_game_team_id = ltm.new_losing_team_id
from losing_team_mapping ltm
where gr.id = ltm.round_id
  and gr.losing_game_team_id is null;

with challenge_mapping as (
  select
    gr.id as round_id,
    gc.id as mapped_challenge_id
  from public.game_rounds gr
  join public.game_challenges gc
    on gc.game_id = gr.game_id
   and gc.position = gr.sequence
)
update public.game_rounds gr
set challenge_id = cm.mapped_challenge_id
from challenge_mapping cm
where gr.id = cm.round_id
  and gr.challenge_id is null;

alter table public.game_rounds drop constraint if exists game_round_state_check;
alter table public.game_rounds drop constraint if exists game_rounds_losing_team_id_fkey;
alter table public.game_rounds drop column if exists losing_team_id;
alter table public.game_rounds rename column losing_game_team_id to losing_team_id;

alter table public.game_rounds
  add constraint game_round_state_check
  check (state in ('team_setup','leader_selection','lineup','voting','action','resolution'));

alter table public.games drop constraint if exists check_game_phase;
alter table public.games
  add constraint check_game_phase
  check (phase in ('lobby','team_setup','leader_selection','lineup','voting','action','resolution','results'));

alter table public.game_rounds
  add constraint game_rounds_losing_team_id_fkey
  foreign key (losing_team_id) references public.game_teams(id) on delete set null;

-- 8) Scoreboard for teams ---------------------------------------------------
create view public.team_scores as
with round_totals as (
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
)
select
  gt.game_id,
  gt.id as team_id,
  gt.name,
  gt.color_hex,
  coalesce(sum(
    case when rt.losing_team_id is null or rt.origin_team_id is distinct from gt.id then 0
      else case when rt.predicted_team_id = rt.losing_team_id then 1 else -1 end
    end
  ), 0) as total_score
from public.game_teams gt
left join round_totals rt on rt.game_id = gt.game_id and rt.origin_team_id = gt.id
where gt.is_active is true
group by gt.game_id, gt.id, gt.name, gt.color_hex;

create view public.game_results as
select
  p.id as participant_id,
  p.nickname,
  p.game_id,
  coalesce(sum(
    case
      when gr.losing_team_id is null then 0
      when rv.game_team_id = gr.losing_team_id then 1
      else 0
    end
  ), 0) as total_score
from public.participants p
left join public.game_rounds gr on gr.game_id = p.game_id
left join public.round_votes rv on rv.round_id = gr.id and rv.participant_id = p.id
group by p.id, p.nickname, p.game_id;

-- 9) Row level security for new data surfaces ------------------------------
alter table public.game_challenges enable row level security;
drop policy if exists "Game challenges readable" on public.game_challenges;
create policy "Game challenges readable" on public.game_challenges
  for select using (true);
drop policy if exists "Hosts manage game challenges" on public.game_challenges;
create policy "Hosts manage game challenges" on public.game_challenges
  for all using (
    exists (
      select 1 from public.games g
      where g.id = game_challenges.game_id
        and g.host_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_challenges.game_id
        and g.host_user_id = auth.uid()
    )
  );

alter table public.game_teams enable row level security;
drop policy if exists "Game teams readable" on public.game_teams;
create policy "Game teams readable" on public.game_teams
  for select using (true);
drop policy if exists "Hosts manage game teams" on public.game_teams;
create policy "Hosts manage game teams" on public.game_teams
  for all using (
    exists (
      select 1 from public.games g
      where g.id = game_teams.game_id
        and g.host_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_teams.game_id
        and g.host_user_id = auth.uid()
    )
  );

alter table public.round_lineups enable row level security;
drop policy if exists "Round lineups readable" on public.round_lineups;
create policy "Round lineups readable" on public.round_lineups
  for select using (true);
drop policy if exists "Hosts manage round lineups" on public.round_lineups;
create policy "Hosts manage round lineups" on public.round_lineups
  for all using (
    exists (
      select 1 from public.game_rounds gr
      join public.games g on g.id = gr.game_id
      where gr.id = round_lineups.round_id
        and g.host_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.game_rounds gr
      join public.games g on g.id = gr.game_id
      where gr.id = round_lineups.round_id
        and g.host_user_id = auth.uid()
    )
  );

drop policy if exists "Host can manage participants" on public.participants;
create policy "Host can manage participants" on public.participants
  for update using (
    exists (
      select 1 from public.games g
      where g.id = participants.game_id
        and g.host_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.games g
      where g.id = participants.game_id
        and g.host_user_id = auth.uid()
    )
  );

commit;
