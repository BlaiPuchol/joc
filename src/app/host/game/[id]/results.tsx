import { GameResult, supabase } from '@/types/types'
import { useEffect, useState } from 'react'
import Confetti from 'react-confetti'
import useWindowSize from 'react-use/lib/useWindowSize'

export default function Results({ gameId }: { gameId: string }) {
  const [gameResults, setGameResults] = useState<GameResult[]>([])
  const { width, height } = useWindowSize()

  useEffect(() => {
    const getResults = async () => {
      const { data, error } = await supabase
        .from('game_results')
        .select('*')
        .eq('game_id', gameId)
        .order('total_score', { ascending: false })
      if (error) {
        alert(error.message)
        return
      }
      setGameResults(data ?? [])
    }
    getResults()
  }, [gameId])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="text-center pt-12 pb-6 px-4">
        <p className="text-sm uppercase tracking-[0.4em] text-white/50">Classificació final</p>
        <h1 className="text-4xl font-bold mt-3">Taula de lideratge</h1>
        <p className="mt-3 text-white/70">
          Cada persona del públic ha guanyat un punt per cada predicció encertada de l&apos;equip perdedor.
        </p>
      </div>
      <div className="flex justify-center">
        <div className="w-full max-w-3xl px-4 pb-16">
          {gameResults.map((gameResult, index) => (
            <div
              key={gameResult.participant_id}
              className={`flex items-center justify-between px-5 py-4 my-3 rounded-2xl border transition ${
                index < 3 ? 'border-white bg-white/10 shadow-lg shadow-black/40' : 'border-white/10 bg-white/5'
              }`}
            >
              <div className={`text-3xl font-bold w-14 ${index < 3 ? 'text-white' : 'text-white/60'}`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <p className={`font-semibold text-2xl ${index < 3 ? 'text-white' : 'text-white/80'}`}>
                  {gameResult.nickname}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{gameResult.total_score}</p>
                <p className="text-xs uppercase tracking-widest text-white/60">punts</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Confetti width={width} height={height} recycle={false} />
    </div>
  )
}
