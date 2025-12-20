-- Allow participants to update their own nickname
create policy "Participants can update their own nickname" on public.participants
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
