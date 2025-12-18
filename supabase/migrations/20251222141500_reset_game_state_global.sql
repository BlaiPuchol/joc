-- Ensure reset_game_state no longer depends on host ownership checks
begin;

drop function if exists public.reset_game_state(uuid);
create function public.reset_game_state(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games g
     set active_round_id = null,
         current_round_sequence = 0
   where g.id = p_game_id;

  delete from public.participants p
   where p.game_id = p_game_id;

  delete from public.game_rounds gr
   where gr.game_id = p_game_id;

  update public.game_teams gt
     set is_active = true,
         leader_participant_id = null
   where gt.game_id = p_game_id;

  update public.games g
     set phase = 'lobby',
         status = 'ready',
         active_round_id = null,
         current_round_sequence = 0
   where g.id = p_game_id;
end;
$$;

grant execute on function public.reset_game_state(uuid) to authenticated;

commit;
