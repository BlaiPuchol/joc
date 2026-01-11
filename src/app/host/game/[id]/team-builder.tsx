import { GameTeam, Participant } from '@/types/types'
import type { DragEvent } from 'react'
import { useState, useEffect, useRef } from 'react'

export default function TeamBuilder({
  teams,
  participants,
  onAssign,
  onSetLeader,
  onBegin,
}: {
  teams: GameTeam[]
  participants: Participant[]
  onAssign: (participantId: string, teamId: string | null) => void
  onSetLeader: (teamId: string, participantId: string | null) => void
  onBegin: () => void
}) {
  const activeTeams = teams.filter((team) => team.is_active)
  const unassigned = participants.filter((participant) => !participant.game_team_id)

  const assignedCountByTeam = (teamId: string) =>
    participants.filter((participant) => participant.game_team_id === teamId)

  const ready =
    activeTeams.length >= 2 &&
    activeTeams.every((team) => assignedCountByTeam(team.id).length > 0 && team.leader_participant_id)

  const UNASSIGNED_ZONE = 'unassigned'
  const [dragParticipantId, setDragParticipantId] = useState<string | null>(null)
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null)

  // Random assignment logic
  const [isRandomizing, setIsRandomizing] = useState(false)
  const [queue, setQueue] = useState<{ p: Participant; t: GameTeam }[]>([])
  const [currentInfo, setCurrentInfo] = useState<{ name: string } | null>(null)
  const [rotation, setRotation] = useState(0)
  const rotationRef = useRef(0)

  useEffect(() => {
    if (!isRandomizing) {
      rotationRef.current = 0
      setRotation(0)
    }
  }, [isRandomizing])

  useEffect(() => {
    if (!isRandomizing || queue.length === 0) {
      if (isRandomizing && queue.length === 0) {
        const t = setTimeout(() => setIsRandomizing(false), 2000)
        return () => clearTimeout(t)
      }
      return
    }

    const item = queue[0]
    setCurrentInfo({ name: item.p.nickname })

    const teamIndex = activeTeams.findIndex((t) => t.id === item.t.id)
    if (teamIndex === -1) return

    const segmentAngle = 360 / activeTeams.length
    // Center of target segment needs to be at 0deg (top)
    const targetAngle = -(teamIndex * segmentAngle + segmentAngle / 2)

    const spins = 4 + Math.floor(Math.random() * 2)
    const spinDegrees = spins * 360
    const current = rotationRef.current
    let next = current + spinDegrees

    const normalize = (deg: number) => ((deg % 360) + 360) % 360
    const targetNormalized = normalize(targetAngle)
    const currentNormalized = normalize(next)
    const diff = targetNormalized - currentNormalized
    const adjustment = diff >= 0 ? diff : 360 + diff
    
    next += adjustment
    rotationRef.current = next

    const spinTimer = setTimeout(() => {
      setRotation(next)
    }, 50)

    const assignTimer = setTimeout(() => {
      onAssign(item.p.id, item.t.id)
      setQueue((prev) => prev.slice(1))
    }, 3500)

    return () => {
      clearTimeout(spinTimer)
      clearTimeout(assignTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, isRandomizing]) // Only trigger on step change

  const handleRandomize = () => {
    const unassignedMembers = participants.filter((p) => !p.game_team_id)
    if (unassignedMembers.length === 0) return

    const counts: Record<string, number> = {}
    activeTeams.forEach((t) => (counts[t.id] = participants.filter((p) => p.game_team_id === t.id).length))

    const shuffled = [...unassignedMembers].sort(() => Math.random() - 0.5)
    const newQueue: { p: Participant; t: GameTeam }[] = []

    shuffled.forEach((p) => {
      let min = Infinity
      let cand: GameTeam[] = []
      activeTeams.forEach((t) => {
        if (counts[t.id] < min) {
          min = counts[t.id]
          cand = [t]
        } else if (counts[t.id] === min) cand.push(t)
      })
      const target = cand[Math.floor(Math.random() * cand.length)]
      counts[target.id]++
      newQueue.push({ p, t: target })
    })

    setQueue(newQueue)
    setIsRandomizing(true)
  }

  const handleDragStart = (participantId: string) => (event: DragEvent<HTMLDivElement>) => {
    setDragParticipantId(participantId)
    event.dataTransfer.setData('text/plain', participantId)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDragParticipantId(null)
    setActiveDropZone(null)
  }

  const handleDragOverZone = (zoneId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (activeDropZone !== zoneId) {
      setActiveDropZone(zoneId)
    }
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnterZone = (zoneId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (activeDropZone !== zoneId) {
      setActiveDropZone(zoneId)
    }
  }

  const handleDragLeaveZone = (zoneId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (activeDropZone === zoneId) {
      setActiveDropZone(null)
    }
  }

  const handleDropOnZone = (teamId: string | null) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const dataId = event.dataTransfer.getData('text/plain')
    const participantId = dataId || dragParticipantId
    if (!participantId) return
    onAssign(participantId, teamId)
    setDragParticipantId(null)
    setActiveDropZone(null)
  }

  return (
    <section className="min-h-screen bg-slate-900 text-white px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-white/40">Organitzador d&apos;equips</p>
          <h1 className="text-4xl font-semibold">Distribuïx els jugadors als seus equips</h1>
          <p className="text-white/70 max-w-2xl">
            Assigna tothom a un equip i tria un líder per a cada grup. Les persones líders decidiran qui competix en
            cada repte físic.
          </p>
        </header>

        <div
          className={`bg-black/40 border rounded-3xl p-5 transition ${
            activeDropZone === UNASSIGNED_ZONE ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-white/10'
          }`}
          onDragOver={handleDragOverZone(UNASSIGNED_ZONE)}
          onDragEnter={handleDragEnterZone(UNASSIGNED_ZONE)}
          onDragLeave={handleDragLeaveZone(UNASSIGNED_ZONE)}
          onDrop={handleDropOnZone(null)}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-semibold">Jugadors en espera ({unassigned.length})</h2>
            <button
              onClick={handleRandomize}
              disabled={unassigned.length === 0}
              className="text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50 px-3 py-1.5 rounded-lg transition border border-white/10"
            >
              Assignació aleatòria ✨
            </button>
          </div>
          <p className="text-sm text-white/60 mb-3">Arrossega&apos;ls fins a un equip per a assignar-los.</p>
          <div className="flex flex-wrap gap-2 min-h-[64px]">
            {unassigned.map((participant) => (
              <div
                key={participant.id}
                draggable
                onDragStart={handleDragStart(participant.id)}
                onDragEnd={handleDragEnd}
                className="inline-flex items-center cursor-grab active:cursor-grabbing bg-white/10 border border-white/15 rounded-full px-4 py-2 text-sm font-medium"
              >
                {participant.nickname}
              </div>
            ))}
            {unassigned.length === 0 && (
              <p className="text-white/60">Tothom ja té equip 🎉</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {activeTeams.map((team) => {
            const members = assignedCountByTeam(team.id)
            const dropIsActive = activeDropZone === team.id
            return (
              <article
                key={team.id}
                className={`bg-black/40 border rounded-3xl p-5 space-y-4 transition ${
                  dropIsActive ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-white/10'
                }`}
                style={{ boxShadow: `0 0 30px ${team.color_hex}22` }}
                onDragOver={handleDragOverZone(team.id)}
                onDragEnter={handleDragEnterZone(team.id)}
                onDragLeave={handleDragLeaveZone(team.id)}
                onDrop={handleDropOnZone(team.id)}
              >
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-white/40">Equip</p>
                    <h3 className="text-2xl font-semibold" style={{ color: team.color_hex }}>
                      {team.name}
                    </h3>
                  </div>
                  <span className="text-white/60 text-sm">{members.length} {members.length === 1 ? 'jugador' : 'jugadors'}</span>
                </header>
                <div className="space-y-2">
                  {members.map((member) => {
                    const isLeader = team.leader_participant_id === member.id
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-2 cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={handleDragStart(member.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <span className="font-medium">{member.nickname}</span>
                        {isLeader && (
                          <span className="text-xs uppercase tracking-[0.3em] text-emerald-300">Líder</span>
                        )}
                        <div className="ml-auto flex gap-2 text-sm">
                          {!isLeader && (
                            <button
                              onClick={() => onSetLeader(team.id, member.id)}
                              className="px-3 py-1 rounded-full border border-white/20"
                            >
                              Liderar
                            </button>
                          )}
                          <button
                            onClick={() => onAssign(member.id, null)}
                            className="px-3 py-1 rounded-full border border-white/20 text-white/70"
                          >
                            Traure
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {members.length === 0 && (
                    <div className="text-white/50 text-sm bg-white/5 rounded-2xl px-4 py-3">
                      Assigna jugadors ací per a completar la plantilla.
                    </div>
                  )}
                </div>
                {members.length > 0 && !team.leader_participant_id && (
                  <p className="text-sm text-amber-300">Assigna una persona líder per a continuar.</p>
                )}
              </article>
            )
          })}
        </div>

        <footer className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <button
            onClick={onBegin}
            disabled={!ready}
            className="flex-1 bg-emerald-400 text-black font-semibold rounded-2xl py-4 text-lg disabled:opacity-50"
          >
            Tanca equips i comença el primer repte
          </button>
          {!ready && (
            <p className="text-white/60 text-sm">
              Cada equip actiu necessita almenys un jugador i una persona líder abans de començar.
            </p>
          )}
        </footer>
      </div>

      {isRandomizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
          <div className="flex flex-col items-center gap-12 text-center p-6 w-full max-w-4xl">
            <div className="space-y-4 animate-in fade-in zoom-in duration-500">
              <p className="text-white/60 text-lg uppercase tracking-widest">Assignant</p>
              <h2 className="text-6xl md:text-8xl font-bold bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent transform transition-all">
                {currentInfo?.name}
              </h2>
            </div>

            <div className="relative scale-125 md:scale-150 py-10">
              {/* Pointer */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 text-emerald-400 text-5xl drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
                ▼
              </div>

              {/* Wheel */}
              <div
                className="w-64 h-64 md:w-80 md:h-80 rounded-full border-4 border-white/10 shadow-2xl overflow-hidden relative"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 3s cubic-bezier(0.25, 1, 0.5, 1)',
                }}
              >
                <div
                  className="absolute inset-0 w-full h-full"
                  style={{
                    background: `conic-gradient(${activeTeams
                      .map((t, i) => {
                        const items = activeTeams.length
                        const start = (i / items) * 100
                        const end = ((i + 1) / items) * 100
                        return `${t.color_hex} ${start}% ${end}%`
                      })
                      .join(', ')})`,
                  }}
                />
              </div>
            </div>

            {queue.length > 1 && (
              <p className="text-white/40 animate-pulse text-lg mt-8">
                {queue.length - 1} jugadors restants...
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
