import React from 'react'

export function FormattedText({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null

  // Process text to identify lists group for better semantics if possible, 
  // but for simplicity we will render line by line with proper styling.
  
  return (
    <div className={`space-y-1 text-left ${className}`}>
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim()
        
        // Bullet list
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
           return (
             <div key={i} className="flex gap-2 ml-4">
               <span className="text-emerald-400">•</span>
               <span>{parseBold(trimmed.substring(2))}</span>
             </div>
           )
        }
        
        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
        if (numMatch) {
           return (
             <div key={i} className="flex gap-2 ml-4">
               <span className="text-emerald-400 font-bold">{numMatch[1]}.</span>
               <span>{parseBold(numMatch[2])}</span>
             </div>
           )
        }
        
        // Header (simple support for #)
        if (trimmed.startsWith('# ')) {
          return <h3 key={i} className="text-xl font-bold pt-2 text-emerald-300">{parseBold(trimmed.substring(2))}</h3>
        }

        // Empty line
        if (trimmed === '') return <div key={i} className="h-2" />

        // Normal paragraph
        return <p key={i}>{parseBold(line)}</p>
      })}
    </div>
  )
}

function parseBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>
    }
    return part
  })
}
