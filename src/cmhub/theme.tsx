'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  NETWORK_META, NETWORK_META_DARK,
  STATUS_META, STATUS_META_DARK,
  PRIORITY_META, PRIORITY_META_DARK,
  PROYECTO_ESTADO_META, PROYECTO_ESTADO_META_DARK,
} from './data'

type Theme = 'light' | 'dark'

interface ThemeCtx {
  theme: Theme
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'light',
  isDark: false,
  toggle: () => {},
})

const STORAGE_KEY = 'hub-theme'

export function HubThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved === 'dark' || saved === 'light') setTheme(saved)
    setMounted(true)
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const activeTheme = mounted ? theme : 'light'

  return (
    <ThemeContext.Provider value={{ theme: activeTheme, isDark: activeTheme === 'dark', toggle }}>
      <div data-hub-theme={activeTheme}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useHubTheme() {
  return useContext(ThemeContext)
}

/** Devuelve los META de colores correctos según el tema activo */
export function useHubMeta() {
  const { isDark } = useHubTheme()
  return {
    NETWORK_META:         isDark ? NETWORK_META_DARK         : NETWORK_META,
    STATUS_META:          isDark ? STATUS_META_DARK           : STATUS_META,
    PRIORITY_META:        isDark ? PRIORITY_META_DARK         : PRIORITY_META,
    PROYECTO_ESTADO_META: isDark ? PROYECTO_ESTADO_META_DARK  : PROYECTO_ESTADO_META,
  }
}
