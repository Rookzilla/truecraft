import { en } from './languages/en'
import { fr } from './languages/fr'
import { pl } from './languages/pl'
import type { Locale } from '../types/content'

export const translations = {
  en,
  fr,
  pl,
}

export const languageOptions: Array<{ locale: Locale; label: string; countries: string[] }> = [
  { locale: 'en', label: 'English', countries: ['GB'] },
  { locale: 'fr', label: 'Français', countries: ['FR'] },
  { locale: 'pl', label: 'Polski', countries: ['PL'] },
]

export type { Locale }
