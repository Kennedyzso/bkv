import {
  BKK_API_BASE_URL,
} from '../constants'
import type {
  ArrivalsEntry,
  BkkReferences,
  BkkResponse,
  RouteDetails,
  RouteDirectionOption,
  RouteReference,
  RouteStopOption,
  RouteStopsResult,
  SavedConnection,
  ScheduleForStopEntry,
  ScheduleStopTime,
  SearchResponse,
  StopReference,
} from '../types'

const API_VERSION = '2'
const APP_VERSION = 'bkv-watch/0.1.0'
const tripRouteCache = new Map<
  string,
  Promise<Record<string, string>>
>()

export class BkkApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'BkkApiError'
    this.status = status
  }
}

function createUrl(
  path: string,
  apiKey: string,
  params: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(`${BKK_API_BASE_URL}/${path}`)
  url.searchParams.set('key', apiKey)

  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(name, String(value))
    }
  })

  return url.toString()
}

async function getJson<T>(url: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new BkkApiError(
      'A BKK FUTÁR nem érhető el. Ellenőrizd az internetkapcsolatot.',
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new BkkApiError(
      `A BKK API érvénytelen választ adott (${response.status}).`,
      response.status,
    )
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'text' in body &&
      typeof body.text === 'string'
        ? body.text
        : `A BKK API hibát adott (${response.status}).`
    throw new BkkApiError(message, response.status)
  }

  return body as T
}

export function hasApiKey(apiKey: string): boolean {
  return apiKey.trim().length > 0
}

export async function searchTransit(
  query: string,
  apiKey: string,
): Promise<SearchResponse> {
  if (!hasApiKey(apiKey)) {
    throw new BkkApiError('A kereséshez add meg a BKK API-kulcsot a beállításokban.')
  }

  const url = createUrl('search', apiKey, {
    version: API_VERSION,
    appVersion: APP_VERSION,
    query: query.trim(),
    minResult: 20,
    includeReferences: 'routes,stops',
  })

  return getJson<SearchResponse>(url)
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('hu-HU')
}

export function filterRoutesByQuery(
  routes: RouteReference[],
  query: string,
): RouteReference[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return routes
  }

  const exactMatches = routes.filter((route) =>
    [route.shortName, route.iconDisplayText, route.style?.icon?.text]
      .filter((value): value is string => Boolean(value))
      .some((value) => normalizeSearchText(value) === normalizedQuery),
  )

  return exactMatches.length > 0 ? exactMatches : routes
}

export async function getStopsForRoute(
  routeId: string,
  apiKey: string,
): Promise<RouteStopsResult> {
  if (!hasApiKey(apiKey)) {
    throw new BkkApiError(
      'A megállók lekéréséhez add meg a BKK API-kulcsot.',
    )
  }

  const url = createUrl('route-details', apiKey, {
    version: API_VERSION,
    appVersion: APP_VERSION,
    routeId,
    related: false,
    includeReferences: 'stops',
  })
  const response = await getJson<BkkResponse<RouteDetails>>(url)
  const route = response.data?.entry
  const stopsById = new Map(
    getStops(response.data?.references).map((stop) => [stop.id, stop]),
  )
  const options: RouteStopOption[] = []
  const directions: RouteDirectionOption[] = []
  const directionIds = new Set<string>()
  const seen = new Set<string>()

  route?.variants?.forEach((variant, variantIndex) => {
    const directionLabel =
      variant.headsign || variant.name || `Irány ${variantIndex + 1}`
    const directionKey = `${variant.direction ?? String(variantIndex)}:${normalizeSearchText(directionLabel)}`
    if (!directionIds.has(directionKey)) {
      directions.push({ id: directionKey, label: directionLabel })
      directionIds.add(directionKey)
    }

    variant.stopIds?.forEach((stopId) => {
      const stop = stopsById.get(stopId)
      const value = `${directionKey}:${stopId}`

      if (!stop || seen.has(value)) {
        return
      }

      seen.add(value)
      options.push({ value, stop, directionId: directionKey, directionLabel })
    })
  })

  return { directions, stops: options }
}

export async function getArrivalsForConnection(
  connection: SavedConnection,
  apiKey: string,
): Promise<BkkResponse<ArrivalsEntry>> {
  if (!hasApiKey(apiKey)) {
    throw new BkkApiError('Az érkezések lekéréséhez add meg a BKK API-kulcsot.')
  }

  const url = createUrl('arrivals-and-departures-for-stop', apiKey, {
    version: API_VERSION,
    appVersion: APP_VERSION,
    stopId: connection.stopId,
    includeRouteId: connection.routeId,
    includeReferences: 'routes,stops',
    stopTimeType: 'ARRIVAL_AND_DEPARTURE',
    onlyDepartures: false,
    minutesBefore: 1,
    minutesAfter: 90,
    limit: 30,
    time: Math.floor(Date.now() / 1000),
  })

  return getJson<BkkResponse<ArrivalsEntry>>(url)
}

function getCurrentServiceDate(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Budapest',
    year: 'numeric',
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${values.year}${values.month}${values.day}`
}

export function getTripRouteIdsForStop(
  stopId: string,
  apiKey: string,
): Promise<Record<string, string>> {
  const cacheKey = `${stopId}:${getCurrentServiceDate()}`
  const cached = tripRouteCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const request = (async () => {
    try {
      const url = createUrl('schedule-for-stop', apiKey, {
        version: API_VERSION,
        appVersion: APP_VERSION,
        stopId,
        date: getCurrentServiceDate(),
        onlyDepartures: false,
      })
      const response = await getJson<BkkResponse<ScheduleForStopEntry>>(url)
      const tripRouteIds: Record<string, string> = {}

      response.data?.entry?.schedules.forEach((schedule) => {
        schedule.directions.forEach((direction) => {
          direction.stopTimes.forEach((stopTime) => {
            tripRouteIds[stopTime.tripId] = schedule.routeId
          })
        })
      })

      return tripRouteIds
    } catch {
      // Arrival data remains useful even if the optional route lookup fails.
      tripRouteCache.delete(cacheKey)
      return {}
    }
  })()

  tripRouteCache.set(cacheKey, request)
  return request
}

export function getRouteForStopTime(
  stopTime: ScheduleStopTime,
  routes: RouteReference[],
  fallbackRouteId: string,
  tripRouteIds: Record<string, string> = {},
): RouteReference | undefined {
  const routeId =
    stopTime.vehicle?.routeId ??
    stopTime.routeId ??
    tripRouteIds[stopTime.tripId]
  const routeById = routeId
    ? routes.find((route) => route.id === routeId)
    : undefined

  if (routeById) {
    return routeById
  }

  const normalizedHeadsign = normalizeSearchText(stopTime.stopHeadsign ?? '')
  if (normalizedHeadsign) {
    const routeByHeadsign = routes.find((route) =>
      [route.description, route.longName]
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => value.split('|'))
        .some(
          (endpoint) =>
            normalizeSearchText(endpoint) === normalizedHeadsign,
        ),
    )
    if (routeByHeadsign) {
      return routeByHeadsign
    }
  }

  return routes.find((route) => route.id === fallbackRouteId)
}

export function referenceValues<T extends { id?: string }>(
  references: Record<string, T> | T[] | undefined,
): T[] {
  if (!references) {
    return []
  }

  if (Array.isArray(references)) {
    return references
  }

  return Object.entries(references).map(([id, value]) => ({
    ...value,
    id: value.id ?? id,
  }))
}

export function getRoutes(references?: BkkReferences): RouteReference[] {
  return referenceValues(references?.routes)
}

export function getStops(references?: BkkReferences): StopReference[] {
  return referenceValues(references?.stops)
}

export function getRouteName(route: RouteReference): string {
  return (
    route.shortName ||
    route.description?.split('|')[0]?.trim() ||
    route.longName ||
    route.id
  )
}

export function getStopName(stop: StopReference): string {
  return stop.name || stop.description || stop.id
}
