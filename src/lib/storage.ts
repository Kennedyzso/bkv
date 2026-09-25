import {
  ARRIVALS_PER_CONNECTION_OPTIONS,
  DEFAULT_APP_STATE,
} from '../constants'
import type {
  AppState,
  CommuteGroup,
  PinnedArrival,
  SavedConnection,
} from '../types'

const STORAGE_KEY = 'bkv-watch-state-v1'
const PINNED_STORAGE_KEY = 'bkv-watch-pinned-arrivals-v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const GROUP_EXPORT_FORMAT = 'bkv-figyelo-groups'
const GROUP_EXPORT_VERSION = 1

export function serializeGroups(groups: CommuteGroup[]): string {
  return JSON.stringify(
    {
      format: GROUP_EXPORT_FORMAT,
      version: GROUP_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      groups: groups.map(({ hiddenConnectionIds: _hiddenConnectionIds, ...group }) => group),
    },
    null,
    2,
  )
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
    destinationStopId:
      typeof value.destinationStopId === 'string'
        ? value.destinationStopId
        : undefined,
    destinationStopName:
      typeof value.destinationStopName === 'string'
        ? value.destinationStopName
        : undefined,
  }
}

function normalizePinnedArrival(value: unknown): PinnedArrival | null {
  if (!isRecord(value)) {
    return null
  }

  const requiredStrings = [
    'id',
    'connectionId',
    'tripId',
    'routeId',
    'routeName',
    'routeType',
    'stopId',
    'stopName',
    'destination',
  ]
  const requiredNumbers = ['timestamp', 'minutes', 'pinnedAt']

  if (
    requiredStrings.some(
      (field) => typeof value[field] !== 'string' || value[field] === '',
    ) ||
    requiredNumbers.some((field) => typeof value[field] !== 'number') ||
    typeof value.isRealtime !== 'boolean' ||
    typeof value.uncertain !== 'boolean'
  ) {
    return null
  }

  const normalizedArrival = {
    id: value.id as string,
    connectionId: value.connectionId as string,
    tripId: value.tripId as string,
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
    destination: value.destination as string,
    destinationStopName:
      typeof value.destinationStopName === 'string'
        ? value.destinationStopName
        : undefined,
    destinationTimestamp:
      typeof value.destinationTimestamp === 'number'
        ? value.destinationTimestamp
        : undefined,
    timestamp: value.timestamp as number,
    minutes: value.minutes as number,
    isRealtime: value.isRealtime as boolean,
    uncertain: value.uncertain as boolean,
  }

  return {
    ...normalizedArrival,
    pinnedAt: value.pinnedAt as number,
  } as PinnedArrival
}

export type PinnedArrivalsByGroup = Record<string, PinnedArrival[]>

export function loadPinnedArrivals(): PinnedArrivalsByGroup {
  if (typeof localStorage === 'undefined') {
    return {}
  }

  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([groupId, value]) => [
        groupId,
        Array.isArray(value)
          ? value
              .map(normalizePinnedArrival)
              .filter(
                (arrival): arrival is PinnedArrival => arrival !== null,
              )
          : [],
      ]),
    )
  } catch {
    return {}
  }
}

export function savePinnedArrivals(
  pinnedArrivals: PinnedArrivalsByGroup,
): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedArrivals))
  } catch {
    // The app remains usable if storage is blocked or full.
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
  const hiddenConnectionIds = Array.isArray(value.hiddenConnectionIds)
    ? value.hiddenConnectionIds.filter(
        (id): id is string => typeof id === 'string',
      )
    : undefined

  return {
    id: value.id,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : 'Új csoport',
    connections,
    hiddenConnectionIds,
  }
}

export function parseGroups(raw: string): CommuteGroup[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('A kiválasztott fájl nem érvényes JSON-fájl.')
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== GROUP_EXPORT_FORMAT ||
    parsed.version !== GROUP_EXPORT_VERSION ||
    !Array.isArray(parsed.groups)
  ) {
    throw new Error(
      'Ez nem a BKV Figyelő által exportált járatcsoport-fájl.',
    )
  }

  const groups = parsed.groups
    .map(normalizeGroup)
    .filter((group): group is CommuteGroup => group !== null)

  if (groups.length === 0) {
    throw new Error('A fájl nem tartalmaz beolvasható járatcsoportot.')
  }

  return groups.map((group) => {
    const connectionIds = new Map(
      group.connections.map((connection) => [
        connection.id,
        createId('connection'),
      ]),
    )

    return {
      ...group,
      id: createId('group'),
      connections: group.connections.map((connection) => ({
        ...connection,
        id: connectionIds.get(connection.id) ?? createId('connection'),
      })),
      hiddenConnectionIds: group.hiddenConnectionIds
        ?.map((id) => connectionIds.get(id))
        .filter((id): id is string => Boolean(id)),
    }
  })
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
    const arrivalsPerConnection =
      typeof savedSettings.arrivalsPerConnection === 'number' &&
      ARRIVALS_PER_CONNECTION_OPTIONS.includes(
        savedSettings.arrivalsPerConnection,
      )
        ? savedSettings.arrivalsPerConnection
        : DEFAULT_APP_STATE.settings.arrivalsPerConnection

    return {
      groups,
      settings: {
        apiKey: savedApiKey || envApiKey,
        refreshInterval,
        arrivalsPerConnection,
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
