'use client'

import { supabase } from '@/types/types'
import { useState } from 'react'

export default function HostDashboard() {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startGame = async () => {
    setIsCreating(true)
    setError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      const { error: anonError } = await supabase.auth.signInAnonymously()
      if (anonError) {
        setError(anonError.message)
        setIsCreating(false)
        return
      }
    }

    const { data, error: gameError } = await supabase
      .from('games')
      .insert({})
      .select()
      .single()

    if (gameError || !data) {
      setError(gameError?.message ?? 'Failed to start game')
      setIsCreating(false)
      return
    }

    window.open(`/host/game/${data.id}`, '_blank', 'noopener,noreferrer')
    setIsCreating(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4">
      <div className="bg-black/70 border border-white/10 rounded-3xl p-10 w-full max-w-3xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-white/40">Live Betting Game</p>
          <h1 className="text-4xl font-bold mt-3">Launch a new room</h1>
          <p className="text-white/70 mt-3">
            Create a fresh room for your audience. Each round walks through leader
            selection, betting, action, and resolution.
          </p>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={startGame}
          disabled={isCreating}
          className="w-full bg-green-500 text-black font-bold py-4 rounded-2xl text-xl hover:bg-green-400 disabled:opacity-60"
        >
          {isCreating ? 'Creating room...' : 'Create game room'}
        </button>
      </div>
    </div>
  )
}
