import { DEFAULT_APP_STATE } from '../constants'
import type { AppState, CommuteGroup, SavedConnection } from '../types'

const STORAGE_KEY = 'bkv-watch-state-v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeConnection(value: unknown): SavedConnection | null {
  if (!isRecord(value)) {
    return null
  }

  const requiredFields = [
    'id',
    'routeId',
    'routeName',
    'routeType',
    'stopId',
    'stopName',
  ]

  if (
    requiredFields.some(
      (field) => typeof value[field] !== 'string' || value[field] === '',
    )
  ) {
    return null
  }

  return {
    id: value.id as string,
    routeId: value.routeId as string,
    routeName: value.routeName as string,
    routeType: value.routeType as string,
    routeColor:
      typeof value.routeColor === 'string' ? value.routeColor : undefined,
    routeTextColor:
      typeof value.routeTextColor === 'string'
        ? value.routeTextColor
        : undefined,
    stopId: value.stopId as string,
    stopName: value.stopName as string,
    stopDirection:
      typeof value.stopDirection === 'string'
        ? value.stopDirection
        : undefined,
  }
}

function normalizeGroup(value: unknown): CommuteGroup | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null
  }

  const connections = Array.isArray(value.connections)
    ? value.connections
        .map(normalizeConnection)
        .filter((connection): connection is SavedConnection => connection !== null)
    : []

  return {
    id: value.id,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : 'Új csoport',
    connections,
  }
}

export function loadState(): AppState {
  const envApiKey = import.meta.env.VITE_BKK_API_KEY?.trim() ?? ''

  if (typeof localStorage === 'undefined') {
    return {
      ...DEFAULT_APP_STATE,
      settings: { ...DEFAULT_APP_STATE.settings, apiKey: envApiKey },
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        ...DEFAULT_APP_STATE,
        settings: { ...DEFAULT_APP_STATE.settings, apiKey: envApiKey },
      }
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      throw new Error('Invalid local state')
    }

    const groups = Array.isArray(parsed.groups)
      ? parsed.groups
          .map(normalizeGroup)
          .filter((group): group is CommuteGroup => group !== null)
      : []

    const savedSettings = isRecord(parsed.settings) ? parsed.settings : {}
    const savedApiKey =
      typeof savedSettings.apiKey === 'string'
        ? savedSettings.apiKey
        : envApiKey
    const refreshInterval =
      typeof savedSettings.refreshInterval === 'number' &&
      [15, 30, 60, 120].includes(savedSettings.refreshInterval)
        ? savedSettings.refreshInterval
        : DEFAULT_APP_STATE.settings.refreshInterval

    return {
      groups,
      settings: {
        apiKey: savedApiKey || envApiKey,
        refreshInterval,
      },
    }
  } catch {
    return {
      ...DEFAULT_APP_STATE,
      settings: { ...DEFAULT_APP_STATE.settings, apiKey: envApiKey },
    }
  }
}

export function saveState(state: AppState): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // The app remains usable in private browsing even if storage is blocked.
  }
}

export function clearStoredState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
