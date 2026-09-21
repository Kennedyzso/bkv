import type { TransportMode } from './types'

export const BKK_API_BASE_URL =
  'https://futar.bkk.hu/api/query/v1/ws/otp/api/where'

export const DEFAULT_REFRESH_INTERVAL = 30
export const DEFAULT_ARRIVALS_PER_CONNECTION = 3

export const REFRESH_INTERVAL_OPTIONS = [15, 30, 60, 120]
export const ARRIVALS_PER_CONNECTION_OPTIONS = [3, 5, 10]
export const ARRIVALS_LOAD_MORE_STEP = 3

export const MODE_COLORS: Record<string, string> = {
  BUS: '#009fe3',
  TRAM: '#ffd800',
  TROLLEYBUS: '#e30613',
  SUBWAY: '#6c6f72',
  RAIL: '#6c6f72',
  SUBURBAN_RAILWAY: '#4ca22f',
  FERRY: '#0072bc',
  CABLE_CAR: '#7c3f8c',
  FUNICULAR: '#7c3f8c',
  COACH: '#009fe3',
}

export const MODE_LABELS: Record<string, string> = {
  BUS: 'Busz',
  TRAM: 'Villamos',
  TROLLEYBUS: 'Trolibusz',
  SUBWAY: 'Metró',
  RAIL: 'Vasút',
  SUBURBAN_RAILWAY: 'HÉV',
  FERRY: 'Hajó',
  CABLE_CAR: 'Libegő',
  FUNICULAR: 'Sikló',
  COACH: 'Távolsági busz',
}

export const DEFAULT_APP_STATE = {
  groups: [],
  settings: {
    apiKey: '',
    refreshInterval: DEFAULT_REFRESH_INTERVAL,
    arrivalsPerConnection: DEFAULT_ARRIVALS_PER_CONNECTION,
  },
}

export function getModeColor(
  mode: TransportMode,
  routeColor?: string,
): string {
  const normalizedRouteColor = routeColor?.replace(/^#/, '')

  if (normalizedRouteColor && /^[\da-f]{6}$/i.test(normalizedRouteColor)) {
    return `#${normalizedRouteColor}`
  }

  return MODE_COLORS[mode] ?? '#312783'
}

export function getModeLabel(mode: TransportMode): string {
  return MODE_LABELS[mode] ?? 'Közlekedés'
}
