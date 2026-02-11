export type ThemeColorId = 'dark' | 'cyan' | 'purple' | 'green' | 'orange'
export type BgModeId = 'white' | 'gray-50' | 'gray-100' | 'dark'

export interface ColorTheme {
    id: ThemeColorId
    name: string
    gradient: { from: string; to: string }
    previewClass: string
}

export interface BgMode {
    id: BgModeId
    name: string
    bgClass: string
    textClass: string
    cardClass: string
}

export const COLOR_THEMES: ColorTheme[] = [
    {
        id: 'dark',
        name: 'Oscuro Elegante',
        gradient: { from: 'gray-800', to: 'gray-900' },
        previewClass: 'bg-gradient-to-r from-gray-800 to-gray-900',
    },
    {
        id: 'cyan',
        name: 'Cyan Moderno',
        gradient: { from: 'cyan-500', to: 'blue-600' },
        previewClass: 'bg-gradient-to-r from-cyan-500 to-blue-600',
    },
    {
        id: 'purple',
        name: 'Púrpura Profesional',
        gradient: { from: 'purple-600', to: 'indigo-700' },
        previewClass: 'bg-gradient-to-r from-purple-600 to-indigo-700',
    },
    {
        id: 'green',
        name: 'Verde Empresarial',
        gradient: { from: 'green-600', to: 'emerald-700' },
        previewClass: 'bg-gradient-to-r from-green-600 to-emerald-700',
    },
    {
        id: 'orange',
        name: 'Naranja Energético',
        gradient: { from: 'orange-500', to: 'red-600' },
        previewClass: 'bg-gradient-to-r from-orange-500 to-red-600',
    },
]

export const BG_MODES: BgMode[] = [
    {
        id: 'white',
        name: 'Blanco',
        bgClass: 'bg-white',
        textClass: 'text-gray-900',
        cardClass: 'bg-white',
    },
    {
        id: 'gray-50',
        name: 'Gris Claro',
        bgClass: 'bg-gray-50',
        textClass: 'text-gray-900',
        cardClass: 'bg-white',
    },
    {
        id: 'gray-100',
        name: 'Gris Suave',
        bgClass: 'bg-gray-100',
        textClass: 'text-gray-900',
        cardClass: 'bg-white',
    },
    {
        id: 'dark',
        name: 'Oscuro',
        bgClass: 'bg-background', // Will use --background variable
        textClass: 'text-foreground', // Will use --foreground variable
        cardClass: 'bg-card', // Will use --card variable
    },
]

export interface UserTheme {
    colorTheme: ThemeColorId
    bgMode: BgModeId
}

export const DEFAULT_THEME: UserTheme = {
    colorTheme: 'dark',
    bgMode: 'white',
}

export function getColorTheme(id: ThemeColorId): ColorTheme {
    return COLOR_THEMES.find(t => t.id === id) || COLOR_THEMES[0]
}

export function getBgMode(id: BgModeId): BgMode {
    return BG_MODES.find(b => b.id === id) || BG_MODES[0]
}
