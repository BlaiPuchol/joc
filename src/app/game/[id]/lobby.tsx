import { Participant, supabase } from '@/types/types'
import { FormEvent, useEffect, useState } from 'react'

export default function Lobby({
  gameId,
  onRegisterCompleted,
}: {
  gameId: string
  onRegisterCompleted: (participant: Participant) => void
}) {
  const [participant, setParticipant] = useState<Participant | null>(null)

  useEffect(() => {
    const fetchParticipant = async () => {
      let userId: string | null = null

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionData.session) {
        userId = sessionData.session?.user.id ?? null
      } else {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error) console.error(error)
        userId = data?.user?.id ?? null
      }

      if (!userId) {
        return
      }

      const { data: participantData, error } = await supabase
        .from('participants')
        .select()
        .eq('game_id', gameId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        return alert(error.message)
      }

      if (participantData) {
        setParticipant(participantData)
        onRegisterCompleted(participantData)
      }
    }

    fetchParticipant()
  }, [gameId, onRegisterCompleted])

  const accentColor = '#38bdf8'
  const screenBackground = `radial-gradient(circle at 18% 20%, rgba(62,255,150,0.3), transparent 45%), #020617`
  const heroBackground = `linear-gradient(135deg, rgba(62,255,150,0.45), rgba(2,6,23,0.92))`

  return (
    <div className="min-h-screen" style={{ background: screenBackground }}>
      <div className="screen-frame min-h-screen flex items-center justify-center py-10 px-6 text-white">
        <div className="glow-panel w-full max-w-2xl p-8 md:p-12 space-y-10" style={{ background: heroBackground }}>
          <div className="text-center space-y-3">
            <p className="text-xs uppercase tracking-[0.5em] text-white/60">Sala d&apos;espera</p>
            <p className="text-5xl md:text-6xl font-black leading-tight">Hola!</p>
            <h2 className="text-3xl font-semibold text-white/85">Qui eres?</h2>
            <p className="text-base md:text-lg text-white/80">
              Escriu el teu nom.
            </p>
          </div>
          {!participant && (
            <Register
              gameId={gameId}
              onRegisterCompleted={(participant) => {
                onRegisterCompleted(participant)
                setParticipant(participant)
              }}
            />
          )}

          {participant && (
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-semibold">Benvingut/da, {participant.nickname}!</h1>
              <p className="text-white/80 text-lg">
                Ja estàs dins. Mira la pantalla principal i prepara el mòbil per a rebre el primer repte.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Register({
  onRegisterCompleted,
  gameId,
}: {
  onRegisterCompleted: (player: Participant) => void
  gameId: string
}) {
  const onFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSending(true)

    const trimmed = nickname.trim()
    if (!trimmed) {
      setSending(false)
      return
    }
    const { data: participant, error } = await supabase
      .from('participants')
      .insert({ nickname: trimmed, game_id: gameId })
      .select()
      .single()

    if (error) {
      setSending(false)

      return alert(error.message)
    }

    setSending(false)
    onRegisterCompleted(participant)
  }

  const [nickname, setNickname] = useState('')
  const [sending, setSending] = useState(false)

  return (
    <form onSubmit={(e) => onFormSubmit(e)} className="space-y-6 text-left">
      <label className="space-y-2 block">
        <span className="text-sm uppercase tracking-[0.4em] text-white/60">Nom</span>
        <input
          className="w-full rounded-3xl border border-white/30 bg-white/10 px-5 py-4 text-lg md:text-xl text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-offset-green-400"
          type="text"
          onChange={(val) => setNickname(val.currentTarget.value)}
          value={nickname}
          placeholder="Nom"
          maxLength={20}
          autoComplete="off"
          autoFocus
        />
      </label>
      <button
        disabled={sending}
        className="tactile-button w-full bg-green-600 text-black text-xl py-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? 'Enviant…' : 'Unir-me a la sala'}
      </button>
    </form>
  )
}
