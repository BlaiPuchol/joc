'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Game, GameChallenge, GameTeam, supabase } from '@/types/types'

const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316']
const STATUSES: Game['status'][] = ['draft', 'ready', 'live', 'completed', 'archived']

export default function GameEditor({ params: { id } }: { params: { id: string } }) {
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [challenges, setChallenges] = useState<GameChallenge[]>([])
  const [teams, setTeams] = useState<GameTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    maxPlayersPerTeam: 'all' as string,
    status: 'draft' as Game['status'],
    maxTeams: '4',
  })

  const ensureHostSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw error
  }, [])

  const loadGame = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureHostSession()
      const [{ data: gameData, error: gameError }, { data: challengeData }, { data: teamData }] =
        await Promise.all([
          supabase.from('games').select('*').eq('id', id).single(),
          supabase
            .from('game_challenges')
            .select('*')
            .eq('game_id', id)
            .order('position', { ascending: true }),
          supabase
            .from('game_teams')
            .select('*')
            .eq('game_id', id)
            .order('position', { ascending: true }),
        ])

      if (gameError || !gameData) throw gameError ?? new Error('Game not found')

      setGame(gameData)
      setChallenges(challengeData ?? [])
      setTeams(teamData ?? [])
      setForm({
        title: gameData.title,
        description: gameData.description ?? '',
        maxPlayersPerTeam: gameData.max_players_per_team ? String(gameData.max_players_per_team) : 'all',
        status: gameData.status,
        maxTeams: String(gameData.max_teams ?? Math.max((teamData ?? []).length, 4)),
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load editor')
    } finally {
      setLoading(false)
    }
  }, [ensureHostSession, id])

  useEffect(() => {
    loadGame()
  }, [loadGame])

  const saveSettings = async () => {
    if (!game) return
    try {
      setSavingSettings(true)
      const payload = {
        title: form.title.trim() || 'Untitled Game',
        description: form.description,
        status: form.status,
        max_players_per_team: form.maxPlayersPerTeam === 'all' ? null : Number(form.maxPlayersPerTeam),
        max_teams: Number(form.maxTeams) || 4,
      }
      const { data, error } = await supabase
        .from('games')
        .update(payload)
        .eq('id', game.id)
        .select()
        .single()
      if (error || !data) throw error ?? new Error('Unable to save settings')
      setGame(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const addChallenge = async () => {
    if (!game) return
    const nextPosition = challenges.length === 0 ? 0 : Math.max(...challenges.map((c) => c.position)) + 1
    try {
      const { data, error } = await supabase
        .from('game_challenges')
        .insert({
          game_id: game.id,
          position: nextPosition,
          title: `Challenge ${nextPosition + 1}`,
          description: 'Describe the challenge goal and props.',
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error('Unable to add challenge')
      setChallenges((prev) => [...prev, data].sort((a, b) => a.position - b.position))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add challenge')
    }
  }

  const updateChallenge = async (challengeId: string, updates: Partial<GameChallenge>) => {
    try {
      const { data, error } = await supabase
        .from('game_challenges')
        .update(updates)
        .eq('id', challengeId)
        .select()
        .single()
      if (error || !data) throw error ?? new Error('Unable to save challenge')
      setChallenges((prev) => prev.map((item) => (item.id === challengeId ? data : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save challenge')
    }
  }

  const deleteChallenge = async (challengeId: string) => {
    if (!window.confirm('Remove this challenge?')) return
    try {
      const { error } = await supabase.from('game_challenges').delete().eq('id', challengeId)
      if (error) throw error
      setChallenges((prev) => prev.filter((item) => item.id !== challengeId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete challenge')
    }
  }

  const shiftChallenge = async (challengeId: string, direction: 'up' | 'down') => {
    const index = challenges.findIndex((c) => c.id === challengeId)
    if (index < 0) return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= challenges.length) return
    const current = challenges[index]
    const target = challenges[swapIndex]
    try {
      await Promise.all([
        supabase.from('game_challenges').update({ position: target.position }).eq('id', current.id),
        supabase.from('game_challenges').update({ position: current.position }).eq('id', target.id),
      ])
      setChallenges((prev) =>
        prev
          .map((item) => {
            if (item.id === current.id) {
              return { ...item, position: target.position }
            }
            if (item.id === target.id) {
              return { ...item, position: current.position }
            }
            return item
          })
          .sort((a, b) => a.position - b.position)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reorder challenge')
    }
  }

  const addTeam = async () => {
    if (!game) return
    const maxAllowed = Number(form.maxTeams) || game.max_teams || 8
    if (teams.length >= maxAllowed) {
      setError('You reached the maximum number of teams for this game.')
      return
    }
    const nextPosition = teams.length === 0 ? 0 : Math.max(...teams.map((t) => t.position)) + 1
    const color = TEAM_COLORS[nextPosition % TEAM_COLORS.length]
    try {
      const { data, error } = await supabase
        .from('game_teams')
        .insert({
          game_id: game.id,
          name: `Team ${nextPosition + 1}`,
          color_hex: color,
          position: nextPosition,
          slug: `team-${nextPosition + 1}`,
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error('Unable to add team')
      setTeams((prev) => [...prev, data].sort((a, b) => a.position - b.position))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add team')
    }
  }

  const updateTeam = async (teamId: string, updates: Partial<GameTeam>) => {
    try {
      const { data, error } = await supabase
        .from('game_teams')
        .update(updates)
        .eq('id', teamId)
        .select()
        .single()
      if (error || !data) throw error ?? new Error('Unable to update team')
      setTeams((prev) => prev.map((team) => (team.id === teamId ? data : team)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update team')
    }
  }

  const deleteTeam = async (teamId: string) => {
    if (teams.length <= 2) {
      setError('Keep at least two teams for the show.')
      return
    }
    if (!window.confirm('Remove this team?')) return
    try {
      const { error } = await supabase.from('game_teams').delete().eq('id', teamId)
      if (error) throw error
      setTeams((prev) => prev.filter((team) => team.id !== teamId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete team')
    }
  }

  const shiftTeam = async (teamId: string, direction: 'up' | 'down') => {
    const index = teams.findIndex((team) => team.id === teamId)
    if (index < 0) return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= teams.length) return
    const current = teams[index]
    const target = teams[swapIndex]
    try {
      await Promise.all([
        supabase.from('game_teams').update({ position: target.position }).eq('id', current.id),
        supabase.from('game_teams').update({ position: current.position }).eq('id', target.id),
      ])
      setTeams((prev) =>
        prev
          .map((team) => {
            if (team.id === current.id) {
              return { ...team, position: target.position }
            }
            if (team.id === target.id) {
              return { ...team, position: current.position }
            }
            return team
          })
          .sort((a, b) => a.position - b.position)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reorder team')
    }
  }

  const readyForShow = useMemo(() => {
    return Boolean(game && challenges.length > 0 && teams.filter((team) => team.is_active).length >= 2)
  }, [game, challenges.length, teams])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-white/60 text-lg">Loading editor…</p>
      </main>
    )
  }

  if (!game) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-red-400">{error ?? 'Game not found'}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-sm text-white/60">
            <button onClick={() => router.back()} className="text-emerald-300 hover:text-emerald-200">
              ← Back to dashboard
            </button>
            <span>•</span>
            <span>Game ID: {game.id.slice(0, 8)}</span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="uppercase text-xs tracking-[0.4em] text-white/40">Game deck</p>
              <h1 className="text-4xl font-semibold mt-2">{game.title}</h1>
              <p className="text-white/70">Created {new Date(game.created_at).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                  readyForShow ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-white/10 text-white/70 border border-white/15'
                }`}
              >
                {readyForShow ? 'Ready for showtime' : 'Add more content'}
              </span>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="bg-black/40 border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Challenges</h2>
                <p className="text-white/60 text-sm">Add titles, descriptions and roster sizes for each challenge.</p>
              </div>
              <button
                onClick={addChallenge}
                className="bg-emerald-400 text-black font-semibold rounded-2xl px-5 py-2 hover:bg-emerald-300"
              >
                Add challenge
              </button>
            </div>
            <div className="space-y-4">
              {challenges.map((challenge, index) => (
                <article key={challenge.id} className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <input
                      className="text-2xl font-semibold bg-transparent border-b border-white/20 focus:outline-none"
                      value={challenge.title}
                      onChange={(event) =>
                        setChallenges((prev) =>
                          prev.map((item) =>
                            item.id === challenge.id ? { ...item, title: event.target.value } : item
                          )
                        )
                      }
                      onBlur={(event) => updateChallenge(challenge.id, { title: event.target.value })}
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={index === 0}
                        onClick={() => shiftChallenge(challenge.id, 'up')}
                        className="px-3 py-1 rounded-xl text-sm border border-white/15 disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        disabled={index === challenges.length - 1}
                        onClick={() => shiftChallenge(challenge.id, 'down')}
                        className="px-3 py-1 rounded-xl text-sm border border-white/15 disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="w-full bg-black/30 border border-white/10 rounded-2xl p-3 text-sm"
                    rows={3}
                    value={challenge.description ?? ''}
                    onChange={(event) =>
                      setChallenges((prev) =>
                        prev.map((item) =>
                          item.id === challenge.id ? { ...item, description: event.target.value } : item
                        )
                      )
                    }
                    onBlur={(event) => updateChallenge(challenge.id, { description: event.target.value })}
                  />
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="uppercase tracking-[0.3em] text-white/50">Players / team</label>
                    <select
                      className="bg-black/30 border border-white/10 rounded-xl px-3 py-2"
                      value={challenge.participants_per_team ? String(challenge.participants_per_team) : 'all'}
                      onChange={(event) =>
                        updateChallenge(challenge.id, {
                          participants_per_team: event.target.value === 'all' ? null : Number(event.target.value),
                        })
                      }
                    >
                      <option value="all">All teammates</option>
                      {[1, 2, 3, 4, 5, 6].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <button className="text-red-400 ml-auto" onClick={() => deleteChallenge(challenge.id)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
              {challenges.length === 0 && (
                <div className="border border-dashed border-white/20 rounded-3xl p-8 text-center text-white/60">
                  No challenges yet. Add one to outline your show.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
              <h2 className="text-xl font-semibold">Game settings</h2>
              <div className="space-y-3">
                <label className="text-sm uppercase tracking-[0.3em] text-white/50">Title</label>
                <input
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-2"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm uppercase tracking-[0.3em] text-white/50">Description</label>
                <textarea
                  rows={3}
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-2"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="space-y-2">
                  <label className="uppercase tracking-[0.3em] text-white/50">Roster size</label>
                  <select
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2"
                    value={form.maxPlayersPerTeam}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxPlayersPerTeam: event.target.value }))}
                  >
                    <option value="all">All teammates</option>
                    {[2, 3, 4, 5, 6].map((value) => (
                      <option key={value} value={value}>
                        {value} players
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="uppercase tracking-[0.3em] text-white/50">Status</label>
                  <select
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2"
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Game['status'] }))}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="uppercase tracking-[0.3em] text-white/50">Max teams</label>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2"
                    value={form.maxTeams}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxTeams: event.target.value }))}
                  />
                </div>
              </div>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="w-full rounded-2xl bg-emerald-400 text-black font-semibold py-3 disabled:opacity-60"
              >
                {savingSettings ? 'Saving…' : 'Save settings'}
              </button>
            </section>

            <section className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Teams</h2>
                  <p className="text-white/60 text-sm">Customize team names, colors, and active status.</p>
                </div>
                <button
                  onClick={addTeam}
                  className="bg-emerald-400/80 text-black font-semibold rounded-xl px-3 py-1"
                >
                  Add team
                </button>
              </div>
              <div className="space-y-3">
                {teams.map((team, index) => (
                  <div key={team.id} className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex gap-2 items-center">
                      <input
                        className="flex-1 bg-transparent border-b border-white/20 focus:outline-none text-lg font-semibold"
                        value={team.name}
                        onChange={(event) =>
                          setTeams((prev) =>
                            prev.map((item) => (item.id === team.id ? { ...item, name: event.target.value } : item))
                          )
                        }
                        onBlur={(event) => updateTeam(team.id, { name: event.target.value })}
                      />
                      <input
                        type="color"
                        value={team.color_hex}
                        className="w-10 h-10 rounded-xl border border-white/10"
                        onChange={(event) => updateTeam(team.id, { color_hex: event.target.value })}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={team.is_active}
                          onChange={(event) => updateTeam(team.id, { is_active: event.target.checked })}
                        />
                        Active
                      </label>
                      <div className="ml-auto flex gap-2">
                        <button
                          disabled={index === 0}
                          onClick={() => shiftTeam(team.id, 'up')}
                          className="px-2 py-1 rounded-lg border border-white/20 disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          disabled={index === teams.length - 1}
                          onClick={() => shiftTeam(team.id, 'down')}
                          className="px-2 py-1 rounded-lg border border-white/20 disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button className="text-red-400" onClick={() => deleteTeam(team.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {teams.length === 0 && (
                  <div className="border border-dashed border-white/20 rounded-2xl p-6 text-center text-white/60">
                    No teams configured yet.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-black/40 border border-white/10 rounded-3xl p-5 space-y-3">
              <h3 className="text-lg font-semibold">Need to test with players?</h3>
              <p className="text-white/60 text-sm">
                Launch the lobby anytime from the dashboard. Players can join via QR, and you can keep editing this
                deck while they register.
              </p>
              <Link
                href={`/host/game/${game.id}`}
                className="inline-flex justify-center w-full bg-white/90 text-black font-semibold rounded-2xl py-3"
              >
                Open host screen
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
