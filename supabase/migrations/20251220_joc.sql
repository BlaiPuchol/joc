-- Live betting schema migration

-- 1. Teams catalog ---------------------------------------------------------
create table if not exists public.teams (
	id uuid default gen_random_uuid() primary key,
	created_at timestamptz not null default now(),
	slug text not null unique,
	name text not null,
	color_hex text not null
);

insert into public.teams (slug, name, color_hex)
values
	('red', 'Team Red', '#ef4444'),
	('blue', 'Team Blue', '#3b82f6'),
	('green', 'Team Green', '#22c55e'),
	('yellow', 'Team Yellow', '#eab308')
on conflict (slug) do update
set name = excluded.name,
	color_hex = excluded.color_hex;


-- 2. Game rounds -----------------------------------------------------------
create table if not exists public.game_rounds (
	id uuid default gen_random_uuid() primary key,
	created_at timestamptz not null default now(),
	game_id uuid not null references public.games(id) on delete cascade,
	sequence integer not null,
	state text not null default 'leader_selection',
	leader_notes text,
	losing_team_id uuid references public.teams(id) on delete set null,
	constraint game_round_state_check
		check (state in ('leader_selection', 'voting', 'action', 'resolution')),
	constraint game_round_sequence_unique unique (game_id, sequence)
);


-- 3. Round votes -----------------------------------------------------------
create table if not exists public.round_votes (
	id uuid default gen_random_uuid() primary key,
	created_at timestamptz not null default now(),
	round_id uuid not null references public.game_rounds(id) on delete cascade,
	participant_id uuid not null references public.participants(id) on delete cascade,
	team_id uuid not null references public.teams(id) on delete cascade,
	constraint round_votes_unique_participant unique (round_id, participant_id)
);


-- 4. Games table adjustments ----------------------------------------------
alter table public.games
	drop column if exists current_question_sequence,
	drop column if exists is_answer_revealed;

alter table public.games
	add column if not exists current_round_sequence integer not null default 0,
	add column if not exists active_round_id uuid references public.game_rounds(id);

alter table public.games
	alter column quiz_set_id drop not null;

update public.games
set phase = 'lobby'
where phase not in ('lobby', 'leader_selection', 'voting', 'action', 'resolution', 'results');

alter table public.games
	drop constraint if exists check_game_phase;

alter table public.games
	add constraint check_game_phase
		check (phase in ('lobby', 'leader_selection', 'voting', 'action', 'resolution', 'results'));


-- 5. Views -----------------------------------------------------------------
drop view if exists public.game_results;

create view public.game_results as
select
	p.id as participant_id,
	p.nickname,
	p.game_id,
	coalesce(sum(case when rv.team_id = gr.losing_team_id then 1 else 0 end), 0) as total_score
from public.participants p
left join public.game_rounds gr on gr.game_id = p.game_id
left join public.round_votes rv on rv.round_id = gr.id and rv.participant_id = p.id
group by p.id, p.nickname, p.game_id;


-- 6. Row level security ----------------------------------------------------
alter table public.teams enable row level security;
drop policy if exists "Teams readable by everyone" on public.teams;
create policy "Teams readable by everyone" on public.teams
	for select using (true);

alter table public.game_rounds enable row level security;
drop policy if exists "Rounds readable by everyone" on public.game_rounds;
create policy "Rounds readable by everyone" on public.game_rounds
	for select using (true);
drop policy if exists "Hosts manage their rounds" on public.game_rounds;
create policy "Hosts manage their rounds" on public.game_rounds
	for insert with check (
		auth.uid() = (
			select host_user_id from public.games g where g.id = game_rounds.game_id
		)
	);
drop policy if exists "Hosts update their rounds" on public.game_rounds;
create policy "Hosts update their rounds" on public.game_rounds
	for update using (
		auth.uid() = (
			select host_user_id from public.games g where g.id = game_rounds.game_id
		)
	)
	with check (
		auth.uid() = (
			select host_user_id from public.games g where g.id = game_rounds.game_id
		)
	);

alter table public.round_votes enable row level security;
drop policy if exists "Votes readable by everyone" on public.round_votes;
create policy "Votes readable by everyone" on public.round_votes
	for select using (true);
drop policy if exists "Participants can vote" on public.round_votes;
create policy "Participants can vote" on public.round_votes
	for insert with check (
		auth.uid() = (
			select user_id from public.participants p where p.id = round_votes.participant_id
		)
		and exists (
			select 1
			from public.game_rounds gr
			where gr.id = round_votes.round_id and gr.state = 'voting'
		)
	);
drop policy if exists "Participants can adjust vote while voting" on public.round_votes;
create policy "Participants can adjust vote while voting" on public.round_votes
	for update using (
		auth.uid() = (
			select user_id from public.participants p where p.id = round_votes.participant_id
		)
		and exists (
			select 1
			from public.game_rounds gr
			where gr.id = round_votes.round_id and gr.state = 'voting'
		)
	)
	with check (
		auth.uid() = (
			select user_id from public.participants p where p.id = round_votes.participant_id
		)
		and exists (
			select 1
			from public.game_rounds gr
			where gr.id = round_votes.round_id and gr.state = 'voting'
		)
	);


-- 7. Realtime publications -------------------------------------------------
alter publication supabase_realtime add table public.game_rounds;
alter publication supabase_realtime add table public.round_votes;
alter publication supabase_realtime add table public.teams;

