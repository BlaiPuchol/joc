begin;

drop function if exists public.reset_game_state(uuid);
create function public.reset_game_state(game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select g.id
    into v_game_id
  from public.games g
  where g.id = game_id
    and g.host_user_id = auth.uid();

  if v_game_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

      update public.games g
        set active_round_id = null,
          current_round_sequence = 0
      where g.id = game_id;

    delete from public.participants p
      where p.game_id = game_id;

    delete from public.game_rounds gr
      where gr.game_id = game_id;

    update public.game_teams gt
      set is_active = true,
        leader_participant_id = null
      where gt.game_id = game_id;

    update public.games g
      set phase = 'lobby',
        status = 'ready',
        active_round_id = null,
        current_round_sequence = 0
      where g.id = game_id;
end;
$$;

grant execute on function public.reset_game_state(uuid) to authenticated;

commit;
