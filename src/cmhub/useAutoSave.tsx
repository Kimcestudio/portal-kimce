import React, { useEffect, useRef, useState } from 'react'

export type SaveState = 'idle' | 'saving' | 'saved'

/**
 * Debounced autosave. Increment `trigger` cada vez que un campo cambia.
 * La función `saveFn` siempre ve los valores más recientes gracias al ref.
 */
export function useAutoSave(
  trigger: number,
  saveFn: () => Promise<void>,
  delay = 800,
): SaveState {
  const [state, setState]     = useState<SaveState>('idle')
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFnRef             = useRef(saveFn)
  saveFnRef.current           = saveFn   // siempre apunta al closure más reciente

  useEffect(() => {
    if (trigger === 0) return            // ignorar montaje inicial
    setState('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setState('saving')
      try {
        await saveFnRef.current()
        setState('saved')
        setTimeout(() => setState('idle'), 2000)
      } catch {
        setState('idle')
      }
    }, delay)
  }, [trigger, delay])

  return state
}

/** Badge visual para mostrar en el header del modal */
export function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all"
      style={{
        background: state === 'saved'  ? '#dcfce7' : '#f3f4f6',
        color:      state === 'saved'  ? '#16a34a' : '#9ca3af',
      }}>
      {state === 'saving' ? 'Guardando…' : '✓ Guardado'}
    </span>
  )
}
