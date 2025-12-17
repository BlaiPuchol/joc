'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Game, supabase } from '@/types/types'

type GameWithCounts = Game & {
  challengeCount: number
  teamCount: number
  participantCount: number
}

const STATUS_LABELS: Record<Game['status'], string> = {
  draft: 'Esborrany',
  ready: 'Preparat',
  live: 'En directe',
  completed: 'Completat',
  archived: 'Arxivat',
}

export default function HostDashboard() {
  const [games, setGames] = useState<GameWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newGameTitle, setNewGameTitle] = useState('')

  const ensureHostSession = useCallback(async (): Promise<Session> => {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    if (data.session) return data.session

    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
    if (anonError) throw anonError
    if (!anonData.session) {
      throw new Error('No s\'ha pogut establir una sessió d\'amfitrió')
    }
    return anonData.session
  }, [])

  const fetchGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureHostSession()
      const { data, error } = await supabase
        .from('games')
        .select(
          `*,
          game_challenges(count),
          game_teams(count),
          participants(count)`
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      const normalized: GameWithCounts[] = (data ?? []).map((game: any) => ({
        ...(game as Game),
        challengeCount: game.game_challenges?.[0]?.count ?? 0,
        teamCount: game.game_teams?.[0]?.count ?? 0,
        participantCount: game.participants?.[0]?.count ?? 0,
      }))

      setGames(normalized)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'No s\'han pogut carregar els jocs')
    } finally {
      setLoading(false)
    }
  }, [ensureHostSession])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  const seedDefaultTeams = useCallback(async (gameId: string) => {
    const { data: catalog, error } = await supabase.from('teams').select('*').order('created_at')
    if (error) throw error
    const toInsert = (catalog ?? []).slice(0, 4).map((team, index) => ({
      game_id: gameId,
      template_team_id: team.id,
      slug: team.slug,
      name: team.name,
      color_hex: team.color_hex,
      position: index,
    }))
    if (toInsert.length === 0) return
    const { error: insertError } = await supabase.from('game_teams').insert(toInsert)
    if (insertError) throw insertError
  }, [])

  const seedDefaultChallenge = useCallback(async (gameId: string) => {
    const { error } = await supabase.from('game_challenges').insert({
      game_id: gameId,
      position: 0,
      title: "Repte d'escalfament",
      description: "Descriu el repte físic per a iniciar l'experiència.",
    })
    if (error) throw error
  }, [])

  const createGame = async () => {
    setCreating(true)
    setError(null)

    const attemptCreate = async (forceFreshSession = false) => {
      if (forceFreshSession) {
        await supabase.auth.signOut()
      }
      const session = await ensureHostSession()
      const hostUserId = session.user?.id
      if (!hostUserId) {
        throw new Error("No s'ha pogut identificar l'usuari amfitrió")
      }
      const { data, error } = await supabase
        .from('games')
        .insert({
          title: newGameTitle.trim() || 'Joc sense títol',
          status: 'draft',
          phase: 'lobby',
          host_user_id: hostUserId,
        })
        .select()
        .single()
      if (error || !data) throw error ?? new Error("No s'ha pogut crear el joc")

      await Promise.all([seedDefaultTeams(data.id), seedDefaultChallenge(data.id)])
    }

    try {
      await attemptCreate()
      setNewGameTitle('')
      await fetchGames()
      return
    } catch (err) {
      if (isHostForeignKeyError(err)) {
        try {
          await attemptCreate(true)
          setNewGameTitle('')
          await fetchGames()
          return
        } catch (retryErr) {
          console.error(retryErr)
          setError(
            retryErr instanceof Error ? retryErr.message : "No s'ha pogut crear el joc"
          )
          return
        }
      }

      console.error(err)
      setError(err instanceof Error ? err.message : "No s'ha pogut crear el joc")
    } finally {
      setCreating(false)
    }
  }

  const deleteGame = async (gameId: string) => {
    if (!window.confirm('Vols eliminar este joc i totes les seues dades?')) return
    try {
      await ensureHostSession()
      const { error } = await supabase.from('games').delete().eq('id', gameId)
      if (error) throw error
      await fetchGames()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut eliminar el joc")
    }
  }

  const launchGame = async (gameId: string) => {
    try {
      await ensureHostSession()
      await supabase.from('games').update({ status: 'live', phase: 'lobby' }).eq('id', gameId)
      window.open(`/host/game/${gameId}`, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut iniciar el joc")
    }
  }

  const draftGames = useMemo(() => games.filter((game) => game.status === 'draft'), [games])
  const activeGames = useMemo(() => games.filter((game) => game.status === 'live'), [games])
  const completedGames = useMemo(
    () => games.filter((game) => game.status === 'completed' || game.status === 'archived'),
    [games]
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <header className="space-y-4">
          <p className="text-sm uppercase tracking-[0.4em] text-emerald-300/70">Tauler de control d&apos;amfitrió</p>
          <h1 className="text-4xl sm:text-5xl font-semibold">Crea, edita i projecta els teus jocs</h1>
          <p className="text-white/70 max-w-3xl">
            Gestiona cada conjunt de reptes com si fora una llista de Kahoot. Prepara diversos jocs,
            ajusta l&apos;estructura dels equips i inicia l&apos;espectacle.
          </p>
        </header>

        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
            <div className="flex-1">
              <label className="text-sm uppercase tracking-[0.3em] text-white/40">Títol del joc</label>
              <input
                className="mt-2 w-full rounded-2xl bg-black/40 border border-white/10 px-5 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="Nit de jocs"
                value={newGameTitle}
                onChange={(event) => setNewGameTitle(event.target.value)}
              />
            </div>
            <button
              onClick={createGame}
              disabled={creating}
              className="bg-emerald-400 hover:bg-emerald-300 text-black font-semibold rounded-2xl px-8 py-3 text-lg transition disabled:opacity-60"
            >
              {creating ? 'Creant…' : 'Crear joc nou'}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </section>

        {loading && (
          <p className="text-white/60 text-lg">Carregant els teus jocs…</p>
        )}

        {!loading && games.length === 0 && (
          <div className="text-center py-16 border border-dashed border-white/20 rounded-3xl">
            <p className="text-xl text-white/70">Encara no hi ha cap joc. Crea&apos;n un per a començar.</p>
          </div>
        )}

        {!loading && games.length > 0 && (
          <div className="space-y-10">
            {activeGames.length > 0 && (
              <GameShelf title="Espectacles en directe" games={activeGames} onLaunch={launchGame} onDelete={deleteGame} />
            )}
            <GameShelf title="Esborranys" games={draftGames} onLaunch={launchGame} onDelete={deleteGame} />
            {completedGames.length > 0 && (
              <GameShelf title="Complets" games={completedGames} onLaunch={launchGame} onDelete={deleteGame} />
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function GameShelf({
  title,
  games,
  onLaunch,
  onDelete,
}: {
  title: string
  games: GameWithCounts[]
  onLaunch: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (games.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <span className="text-white/50 text-sm tracking-[0.2em]">{games.length} jocs</span>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {games.map((game) => (
          <article
            key={game.id}
            className="bg-black/40 border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-emerald-400/60 transition"
          >
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-white/40">{STATUS_LABELS[game.status] ?? game.status}</p>
              <h3 className="text-2xl font-semibold">{game.title}</h3>
              <p className="text-white/70 text-sm min-h-[3.5rem] overflow-hidden">
                {game.description || 'Sense descripció de moment.'}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <Stat label="Reptes" value={game.challengeCount} />
                <Stat label="Equips" value={game.teamCount} />
                <Stat label="Jugadors" value={game.participantCount} />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="flex-1 bg-emerald-400 text-black font-semibold rounded-2xl py-2"
                onClick={() => onLaunch(game.id)}
              >
                Començar espectacle
              </button>
              <Link
                href={`/host/dashboard/game/${game.id}`}
                className="flex-1 text-center border border-white/20 rounded-2xl py-2 hover:border-white/50"
              >
                Editar joc
              </Link>
              <button
                className="flex-none text-sm text-red-300 hover:text-red-200"
                onClick={() => onDelete(game.id)}
              >
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/5 rounded-2xl py-3">
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}

const isHostForeignKeyError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false
  }
  const maybePostgrest = error as { code?: string; message?: string }
  return (
    maybePostgrest.code === '23503' &&
    typeof maybePostgrest.message === 'string' &&
    maybePostgrest.message.includes('games_host_user_id_fkey')
  )
}
