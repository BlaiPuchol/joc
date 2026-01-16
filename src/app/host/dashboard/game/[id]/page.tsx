'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Game, GameChallenge, GameTeam, supabase } from '@/types/types'

const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316']
const STATUSES: Game['status'][] = ['draft', 'ready', 'live', 'completed', 'archived']
const STATUS_LABELS: Record<Game['status'], string> = {
  draft: 'Esborrany',
  ready: 'Preparat',
  live: 'En directe',
  completed: 'Completat',
  archived: 'Arxivat',
}
const STATUS_COLORS: Record<Game['status'], string> = {
  draft: '#fbbf24',
  ready: '#34d399',
  live: '#22d3ee',
  completed: '#a78bfa',
  archived: '#94a3b8',
}

export default function GameEditor({ params: { id } }: { params: { id: string } }) {
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [challenges, setChallenges] = useState<GameChallenge[]>([])
  const [teams, setTeams] = useState<GameTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [resettingLobby, setResettingLobby] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({})
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

      if (gameError || !gameData) throw gameError ?? new Error('Joc no trobat')

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
      setError(err instanceof Error ? err.message : "No s'ha pogut carregar l'editor")
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
        title: form.title.trim() || 'Joc sense títol',
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
      if (error || !data) throw error ?? new Error("No s'ha pogut guardar la configuració")
      setGame(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut guardar la configuració")
    } finally {
      setSavingSettings(false)
    }
  }

  const resetLobby = async () => {
    if (!game) return
    if (!window.confirm('Això eliminarà tots els jugadors i rondes guardades. Vols continuar?')) return
    try {
      setResettingLobby(true)
      setError(null)
      await ensureHostSession()

      const { error: resetError } = await supabase.rpc('reset_game_state', { game_id: game.id })
      if (resetError) throw resetError

      setGame((prev) =>
        prev
          ? {
              ...prev,
              phase: 'lobby',
              status: 'ready',
              active_round_id: null,
              current_round_sequence: 0,
            }
          : prev
      )
      await loadGame()
    } catch (err) {
      console.error(err)
      setError(getErrorMessage(err, "No s'ha pogut reiniciar el joc"))
    } finally {
      setResettingLobby(false)
    }
  }

  const duplicateGame = async () => {
    if (!game) return
    if (!window.confirm('Vols duplicar aquest joc?')) return
    
    try {
      setLoading(true)
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          title: `${game.title} (Còpia)`,
          description: game.description,
          status: 'draft',
          max_players_per_team: game.max_players_per_team,
          max_teams: game.max_teams
        })
        .select()
        .single()
      
      if (gameError || !newGame) throw gameError ?? new Error("Error creant el joc")

      if (challenges.length > 0) {
        const { error: challengesError } = await supabase
          .from('game_challenges')
          .insert(
            challenges.map(c => ({
              game_id: newGame.id,
              title: c.title,
              description: c.description,
              position: c.position,
              participants_per_team: c.participants_per_team
            }))
          )
        if (challengesError) throw challengesError
      }

      if (teams.length > 0) {
        const { error: teamsError } = await supabase
          .from('game_teams')
          .insert(
            teams.map(t => ({
              game_id: newGame.id,
              name: t.name,
              color_hex: t.color_hex,
              position: t.position,
              slug: `team-${t.position + 1}-${newGame.id.slice(0, 4)}`,
              is_active: t.is_active
            }))
          )
        if (teamsError) throw teamsError
      }

      router.push(`/host/dashboard/game/${newGame.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut duplicar el joc")
      setLoading(false)
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
          title: `Repte ${nextPosition + 1}`,
          description: 'Descriu l\'objectiu del repte i els materials.',
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("No s'ha pogut afegir el repte")
      setChallenges((prev) => [...prev, data].sort((a, b) => a.position - b.position))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut afegir el repte")
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
      if (error || !data) throw error ?? new Error("No s'ha pogut guardar el repte")
      setChallenges((prev) => prev.map((item) => (item.id === challengeId ? data : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut guardar el repte")
    }
  }

  const deleteChallenge = async (challengeId: string) => {
    if (!window.confirm('Vols eliminar este repte?')) return
    try {
      const { error } = await supabase.from('game_challenges').delete().eq('id', challengeId)
      if (error) throw error
      setChallenges((prev) => prev.filter((item) => item.id !== challengeId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut eliminar el repte")
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
      setError(err instanceof Error ? err.message : "No s'ha pogut reordenar el repte")
    }
  }

  const addTeam = async () => {
    if (!game) return
    const maxAllowed = Number(form.maxTeams) || game.max_teams || 8
    if (teams.length >= maxAllowed) {
      setError('Has arribat al nombre màxim d\'equips per a este joc.')
      return
    }
    const nextPosition = teams.length === 0 ? 0 : Math.max(...teams.map((t) => t.position)) + 1
    const color = TEAM_COLORS[nextPosition % TEAM_COLORS.length]
    try {
      const { data, error } = await supabase
        .from('game_teams')
        .insert({
          game_id: game.id,
          name: `Equip ${nextPosition + 1}`,
          color_hex: color,
          position: nextPosition,
          slug: `team-${nextPosition + 1}`,
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("No s'ha pogut afegir l'equip")
      setTeams((prev) => [...prev, data].sort((a, b) => a.position - b.position))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut afegir l'equip")
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
      if (error || !data) throw error ?? new Error("No s'ha pogut actualitzar l'equip")
      setTeams((prev) => prev.map((team) => (team.id === teamId ? data : team)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut actualitzar l'equip")
    }
  }

  const deleteTeam = async (teamId: string) => {
    if (teams.length <= 2) {
      setError('Mantín almenys dos equips per a l\'espectacle.')
      return
    }
    if (!window.confirm('Vols eliminar este equip?')) return
    try {
      const { error } = await supabase.from('game_teams').delete().eq('id', teamId)
      if (error) throw error
      setTeams((prev) => prev.filter((team) => team.id !== teamId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut eliminar l'equip")
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
      setError(err instanceof Error ? err.message : "No s'ha pogut reordenar l'equip")
    }
  }

  const readyForShow = useMemo(() => {
    return Boolean(game && challenges.length > 0 && teams.filter((team) => team.is_active).length >= 2)
  }, [game, challenges.length, teams])

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-white/60 text-lg">Carregant l&apos;editor…</p>
      </main>
    )
  }

  if (!game) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-red-400">{error ?? 'Joc no trobat'}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-10 space-y-6 md:space-y-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-sm text-white/60">
            <button onClick={() => router.back()} className="text-emerald-300 hover:text-emerald-200">
              ← Tornar al tauler
            </button>
            <span className="hidden sm:inline">•</span>
            <span>ID del joc: {game.id.slice(0, 8)}</span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="uppercase text-xs tracking-[0.4em] text-white/40">Reptes del joc</p>
              <h1 className="text-3xl sm:text-4xl font-semibold mt-2">{game.title}</h1>
              <p className="text-white/70">Creat el {new Date(game.created_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
              <button 
                onClick={duplicateGame}
                className="text-sm text-white/60 hover:text-white underline decoration-white/30 underline-offset-4"
              >
                Duplicar joc
              </button>
              <span
                className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold w-full sm:w-auto justify-center ${
                  readyForShow ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-white/10 text-white/70 border border-white/15'
                }`}
              >
                {readyForShow ? 'A punt per a l\'espectacle' : 'Afig més contingut'}
              </span>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="bg-black/40 border border-white/10 rounded-3xl p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Reptes</h2>
                <p className="text-white/60 text-sm">Afig títols, descripcions i grandària d&apos;equip per a cada repte.</p>
              </div>
              <button
                onClick={addChallenge}
                className="bg-emerald-400 text-black font-semibold rounded-2xl px-5 py-2 hover:bg-emerald-300 w-full sm:w-auto"
              >
                Afegir repte
              </button>
            </div>
            <div className="space-y-4">
              {challenges.map((challenge, index) => (
                <article key={challenge.id} className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl sm:text-2xl font-bold text-white/30 select-none">#{index + 1}</span>
                      <input
                        className="text-xl sm:text-2xl font-semibold bg-transparent border-b border-white/20 focus:outline-none w-full"
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
                    </div>
                    <div className="flex gap-2 self-end sm:self-auto">
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

                  <div>
                    <button
                      onClick={() => setExpandedRules((prev) => ({ ...prev, [challenge.id]: !prev[challenge.id] }))}
                      className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 flex items-center gap-1 mb-2"
                    >
                      {expandedRules[challenge.id] ? '▼ Amagar regles' : '▶ Editar regles de la prova'}
                    </button>
                    {expandedRules[challenge.id] && (
                      <textarea
                        className="w-full bg-black/30 border border-emerald-400/30 rounded-2xl p-3 text-sm min-h-[150px] font-mono text-white/90 focus:outline-none focus:border-emerald-400/60 transition"
                        value={challenge.rules ?? ''}
                        placeholder={`Regles detallades (Markdown suportat):\n- Llista de normes\n- **Negreta**\n1. Passos numerats`}
                        onChange={(event) =>
                          setChallenges((prev) =>
                            prev.map((item) =>
                              item.id === challenge.id ? { ...item, rules: event.target.value } : item
                            )
                          )
                        }
                        onBlur={(event) => updateChallenge(challenge.id, { rules: event.target.value })}
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="uppercase tracking-[0.3em] text-white/50">Jugadors / equip</label>
                    <select
                      className="bg-black/30 border border-white/10 rounded-xl px-3 py-2"
                      value={challenge.participants_per_team ? String(challenge.participants_per_team) : 'all'}
                      onChange={(event) =>
                        updateChallenge(challenge.id, {
                          participants_per_team: event.target.value === 'all' ? null : Number(event.target.value),
                        })
                      }
                    >
                      <option value="all">Tota la plantilla</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <button className="text-red-400 ml-auto" onClick={() => deleteChallenge(challenge.id)}>
                      Llevar
                    </button>
                  </div>
                </article>
              ))}
              {challenges.length === 0 && (
                <div className="border border-dashed border-white/20 rounded-3xl p-8 text-center text-white/60">
                  Encara no hi ha reptes. Afig-ne un per a planificar l&apos;espectacle.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5 space-y-4">
              <h2 className="text-xl font-semibold">Configuració del joc</h2>
              <div className="space-y-3">
                <label className="text-sm uppercase tracking-[0.3em] text-white/50">Títol</label>
                <input
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-2"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm uppercase tracking-[0.3em] text-white/50">Descripció</label>
                <textarea
                  rows={3}
                  className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-2"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              <div className="space-y-3 text-sm">
                <div className="space-y-2">
                  <label className="uppercase tracking-[0.3em] text-white/50">Jugadors per equip</label>
                  <select
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2"
                    value={form.maxPlayersPerTeam}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxPlayersPerTeam: event.target.value }))}
                  >
                    <option value="all">Tota la plantilla</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                      <option key={value} value={value}>
                        {value} jugadors
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="uppercase tracking-[0.3em] text-white/50">Estat</label>
                  <select
                    className="w-full rounded-2xl bg-black/30 border border-white/10 px-3 py-2"
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as Game['status'] }))}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status} style={{ color: STATUS_COLORS[status] }}>
                        {STATUS_LABELS[status] ?? status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="uppercase tracking-[0.3em] text-white/50">Màxim d&apos;equips</label>
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
                {savingSettings ? 'Guardant…' : 'Guardar configuració'}
              </button>
            </section>

            <section className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Equips</h2>
                  <p className="text-white/60 text-sm">Personalitza noms, colors i estat actiu de cada equip.</p>
                </div>
                <button
                  onClick={addTeam}
                  className="bg-emerald-400/80 text-black font-semibold rounded-xl px-3 py-1 w-full sm:w-auto"
                >
                  Afegir equip
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
                        Actiu
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
                          Llevar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {teams.length === 0 && (
                  <div className="border border-dashed border-white/20 rounded-2xl p-6 text-center text-white/60">
                    Encara no hi ha equips configurats.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-black/40 border border-white/10 rounded-3xl p-4 sm:p-5 space-y-3">
              <h2 className="text-xl font-semibold text-red-200">Restablir lobby</h2>
              <p className="text-white/60 text-sm">
                Elimina tots els jugadors registrats i les rondes guardades per a tornar a començar des de zero. Esta acció
                no es pot desfer.
              </p>
              <button
                onClick={resetLobby}
                disabled={resettingLobby}
                className="w-full rounded-2xl border border-red-400/60 text-red-200 font-semibold py-3 hover:bg-red-400/10 disabled:opacity-60"
              >
                {resettingLobby ? 'Restablint…' : 'Buidar jugadors i rondes'}
              </button>
            </section>

            <section className="bg-black/40 border border-white/10 rounded-3xl p-5 space-y-3">
              <h3 className="text-lg font-semibold">Necessites provar amb jugadors?</h3>
              <p className="text-white/60 text-sm">
                Obri el lobby quan vulgues des del tauler. Els jugadors poden unir-se amb el QR i tu pots continuar
                editant esta baralla mentre es registren.
              </p>
              <Link
                href={`/host/game/${game.id}`}
                className="inline-flex justify-center w-full bg-white/90 text-black font-semibold rounded-2xl py-3"
              >
                Obrir pantalla d&apos;amfitrió
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const candidate = (error as { message?: unknown }).message
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }
  return fallback
}
