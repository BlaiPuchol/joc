import { TeamScore } from '@/types/types'

export function TeamLeaderboard({
  scores,
  highlightTeamId,
  highlightLabel,
  title,
  subtitle,
  dense = false,
}: {
  scores: TeamScore[]
  highlightTeamId?: string | null
  highlightLabel?: string
  title?: string
  subtitle?: string
  dense?: boolean
}) {
  const ordered = [...scores].sort(
    (a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)
  )

  return (
    <section className={`text-white ${dense ? 'space-y-4' : 'space-y-6'}`}>
      {(title || subtitle) && (
        <header className="space-y-2 text-center">
          {title && <p className="text-sm uppercase tracking-[0.4em] text-white/50">{title}</p>}
          {subtitle && <p className="text-white/70 text-base">{subtitle}</p>}
        </header>
      )}
      <div className="space-y-3">
        {ordered.length === 0 && (
          <p className="text-center text-white/60 py-8 bg-white/5 rounded-2xl border border-white/10">
            Encara no hi ha puntuacions.
          </p>
        )}
        {ordered.map((score, index) => {
          const total = score.total_score ?? 0
          const isHighlighted = score.team_id && score.team_id === highlightTeamId
          return (
            <article
              key={score.team_id ?? index}
              className={`flex items-center gap-4 rounded-2xl border px-4 py-3 ${
                isHighlighted
                  ? 'border-emerald-400/70 bg-emerald-400/10 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
                  : index < 3
                    ? 'border-white/20 bg-white/10'
                    : 'border-white/10 bg-white/5'
              }`}
            >
              <div className={`text-3xl font-bold w-14 text-center flex justify-center ${index < 3 ? 'text-white' : 'text-white/60'}`}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
              </div>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span
                  className="h-4 w-4 rounded-full border border-white/50"
                  style={{ backgroundColor: score.color_hex ?? '#475569' }}
                ></span>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold truncate">
                    {score.name ?? 'Equip desconegut'}
                  </p>
                  {isHighlighted && highlightLabel && (
                    <p className="text-sm text-emerald-300">{highlightLabel}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold leading-none">{total}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">punts</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
