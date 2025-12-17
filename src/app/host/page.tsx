'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-2xl">
        <p className="text-sm uppercase tracking-[0.5em] text-white/50">Mode amfitrió</p>
        <h1 className="text-4xl sm:text-5xl font-semibold">Gestiona els teus espectacles en directe</h1>
        <p className="text-white/70 text-lg">
          Accedeix al tauler per crear jocs, preparar equips i projectar l&apos;experiència completa a pantalla gran.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/host/dashboard"
            className="tactile-button bg-emerald-400 text-black text-lg px-8 py-3"
          >
            Obrir tauler
          </Link>
          <Link
            href="/host/dashboard/how-to"
            className="tactile-button border border-white/30 text-white text-lg px-8 py-3"
          >
            Guia ràpida
          </Link>
        </div>
      </div>
    </div>
  )
}
