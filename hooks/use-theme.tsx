"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
    type UserTheme,
    type ThemeColorId,
    type BgModeId,
    DEFAULT_THEME,
    getColorTheme,
    getBgMode,
    COLOR_THEMES,
    BG_MODES
} from '@/lib/theme-config'

interface ThemeContextValue {
    theme: UserTheme
    setColorTheme: (id: ThemeColorId) => void
    setBgMode: (id: BgModeId) => void
    getGradientClass: () => string
    getBgClass: () => string
    getTextClass: () => string
    getCardClass: () => string
    colorThemes: typeof COLOR_THEMES
    bgModes: typeof BG_MODES
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const THEME_STORAGE_KEY = 'neon-user-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<UserTheme>(DEFAULT_THEME)
    const [mounted, setMounted] = useState(false)

    // Load theme from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY)
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as UserTheme
                setTheme(parsed)
            } catch {
                // Invalid JSON, use default
            }
        }
        setMounted(true)
    }, [])

    // Save theme to localStorage whenever it changes
    useEffect(() => {
        if (mounted) {
            localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme))

            // Toggle 'dark' class for Tailwind based on bgMode
            const root = window.document.documentElement
            if (theme.bgMode === 'dark') {
                root.classList.add('dark')
            } else {
                root.classList.remove('dark')
            }
        }
    }, [theme, mounted])

    const setColorTheme = (id: ThemeColorId) => {
        setTheme(prev => ({ ...prev, colorTheme: id }))
    }

    const setBgMode = (id: BgModeId) => {
        setTheme(prev => ({ ...prev, bgMode: id }))
    }

    const getGradientClass = () => {
        const colorTheme = getColorTheme(theme.colorTheme)
        return `bg-gradient-to-r from-${colorTheme.gradient.from} to-${colorTheme.gradient.to}`
    }

    const getBgClass = () => {
        const bgMode = getBgMode(theme.bgMode)
        return bgMode.bgClass
    }

    const getTextClass = () => {
        const bgMode = getBgMode(theme.bgMode)
        return bgMode.textClass
    }

    const getCardClass = () => {
        const bgMode = getBgMode(theme.bgMode)
        return bgMode.cardClass
    }

    const value: ThemeContextValue = {
        theme,
        setColorTheme,
        setBgMode,
        getGradientClass,
        getBgClass,
        getTextClass,
        getCardClass,
        colorThemes: COLOR_THEMES,
        bgModes: BG_MODES,
    }

    // Prevent hydration mismatch
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    return context
}
