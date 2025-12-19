-- Recreate reset_game_state with original parameter name so PostgREST RPC clients can find it
begin;

drop function if exists public.reset_game_state(uuid);
create function public.reset_game_state(game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games g
     set active_round_id = null,
         current_round_sequence = 0,
         phase = 'lobby',
         status = 'ready'
   where g.id = reset_game_state.game_id;

  delete from public.participants p
   where p.game_id = reset_game_state.game_id;

  delete from public.game_rounds gr
   where gr.game_id = reset_game_state.game_id;

  update public.game_teams gt
     set is_active = true,
         leader_participant_id = null
   where gt.game_id = reset_game_state.game_id;
end;
$$;

grant execute on function public.reset_game_state(uuid) to authenticated;

commit;
