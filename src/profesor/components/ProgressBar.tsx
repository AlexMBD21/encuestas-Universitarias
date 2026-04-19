import React from 'react'

type Props = {
  value: number // 0-100
  height?: number
  showPercent?: boolean // show numeric percent (either inside or on the right)
  showInsideThreshold?: number // when to prefer showing percent inside the bar
  className?: string
  orientation?: 'horizontal' | 'vertical'
  color?: string // optional gradient override, e.g. '#ef4444'
}

export default function ProgressBar({ 
  value, 
  height = 12, 
  showPercent = true, 
  showInsideThreshold = 101, 
  className, 
  color,
  orientation = 'horizontal'
}: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  const isVertical = orientation === 'vertical'
  
  // showInsideThreshold default set high so by default percent is shown at the right
  const showInside = pct >= showInsideThreshold
  const [animatedPct, setAnimatedPct] = React.useState(0)

  React.useEffect(() => {
    // animate from 0 to pct after mount
    const t = setTimeout(() => setAnimatedPct(pct), 20)
    return () => clearTimeout(t)
  }, [pct])

  const barBackground = color
    ? `linear-gradient(${isVertical ? '0deg' : '90deg'}, ${color}cc 0%, ${color} 100%)`
    : `linear-gradient(${isVertical ? '0deg' : '90deg'}, #3b82f6 0%, #06b6d4 100%)`

  if (isVertical) {
    return (
      <div className={`flex flex-col items-center gap-2 h-full ${className || ''}`}>
        <div className="relative group w-full flex-1" style={{ width: height || 12 }}>
          <div 
             className="bg-slate-100/80 rounded-full overflow-hidden relative flex flex-col justify-end h-full" 
             style={{ borderRadius: 9999 }}
             aria-hidden
          >
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                height: `${animatedPct}%`,
                width: '100%',
                borderRadius: 9999,
                boxShadow: '0 -6px 18px rgba(0,0,0,0.05)',
                background: barBackground,
                transition: 'height 720ms cubic-bezier(.2,.9,.2,1)'
              }}
            />
          </div>
          {/* Tooltip on hover for vertical */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
            {pct}%
          </div>
        </div>
        {showPercent && (
          <span className="text-[10px] font-black text-slate-500 tabular-nums">{pct}%</span>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <div style={{ flex: 1 }}>
        <div style={{ background: '#f1f5f9', borderRadius: 9999, height, overflow: 'hidden', position: 'relative' }} aria-hidden>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
              width: `${animatedPct}%`,
              height: '100%',
              borderRadius: 9999,
              boxShadow: '0 6px 18px rgba(59,130,246,0.08)',
              background: barBackground,
              transition: 'width 720ms cubic-bezier(.2,.9,.2,1)'
            }}
          />

          {showPercent && showInside && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: Math.max(12, height - 2) }}>{pct}%</span>
            </div>
          )}
        </div>
      </div>

      {showPercent && !showInside && (
        <div style={{ width: 64, textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
          {pct}%
        </div>
      )}
    </div>
  )
}
