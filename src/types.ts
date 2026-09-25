export type TransportMode =
  | 'BUS'
  | 'TRAM'
  | 'TROLLEYBUS'
  | 'SUBWAY'
  | 'RAIL'
  | 'SUBURBAN_RAILWAY'
  | 'FERRY'
  | 'CABLE_CAR'
  | 'FUNICULAR'
  | 'GONDOLA'
  | 'COACH'
  | string

export interface SavedConnection {
  id: string
  routeId: string
  routeName: string
  routeType: TransportMode
  routeColor?: string
  routeTextColor?: string
  stopId: string
  stopName: string
  stopDirection?: string
  destinationStopId?: string
  destinationStopName?: string
}

export interface CommuteGroup {
  id: string
  name: string
  connections: SavedConnection[]
  hiddenConnectionIds?: string[]
}

export interface AppSettings {
  apiKey: string
  refreshInterval: number
  arrivalsPerConnection: number
}

export interface AppState {
  groups: CommuteGroup[]
  settings: AppSettings
}

export interface RouteReference {
  id: string
  shortName?: string
  longName?: string
  description?: string
  iconDisplayText?: string
  type?: TransportMode
  color?: string
  textColor?: string
  style?: {
    color?: string
    icon?: {
      text?: string
      textColor?: string
      type?: string
    }
  }
}

export interface RouteVariant {
  direction?: string
  headsign?: string
  name?: string
  stopIds?: string[]
}

export interface RouteDetails extends RouteReference {
  variants?: RouteVariant[]
}

export interface StopReference {
  id: string
  name: string
  description?: string
  direction?: string
  lat?: number
  lon?: number
  platformCode?: string
  routeIds?: string[]
}

export interface RouteStopOption {
  value: string
  stop: StopReference
  directionId: string
  directionLabel?: string
}

export interface RouteDirectionOption {
  id: string
  label: string
}

export interface RouteStopsResult {
  directions: RouteDirectionOption[]
  stops: RouteStopOption[]
}

export interface BkkReferences {
  routes?: Record<string, RouteReference> | RouteReference[]
  stops?: Record<string, StopReference> | StopReference[]
}

export interface ScheduleStopTime {
  tripId: string
  routeId?: string
  stopId?: string
  arrivalTime?: number
  departureTime?: number
  predictedArrivalTime?: number
  predictedDepartureTime?: number
  stopHeadsign?: string
  uncertain?: boolean
  vehicle?: {
    label?: string
    routeId?: string
    status?: string
  }
}

export interface ScheduleForStopDirection {
  stopTimes: ScheduleStopTime[]
}

export interface ScheduleForStopRoute {
  routeId: string
  directions: ScheduleForStopDirection[]
}

export interface ScheduleForStopEntry {
  stopId: string
  serviceDate?: string
  schedules: ScheduleForStopRoute[]
}

export interface ArrivalsEntry {
  stopId: string
  stopTimes: ScheduleStopTime[]
  routeIds?: string[]
}

export interface BkkResponse<T> {
  code?: number
  currentTime?: number
  text?: string
  data?: {
    entry?: T
    references?: BkkReferences
  }
}

export interface SearchEntry {
  query?: string
  routeIds?: string[]
  stopIds?: string[]
}

export interface SearchResponse extends BkkResponse<SearchEntry> {
  data?: {
    entry?: SearchEntry
    references?: BkkReferences
  }
}

export interface Arrival {
  id: string
  connectionId: string
  tripId: string
  routeId: string
  routeName: string
  routeType: TransportMode
  routeColor?: string
  routeTextColor?: string
  stopId: string
  stopName: string
  destination: string
  destinationStopName?: string
  destinationTimestamp?: number
  timestamp: number
  minutes: number
  isRealtime: boolean
  uncertain: boolean
}

export interface PinnedArrival extends Arrival {
  pinnedAt: number
}

export interface ConnectionDepartures {
  connection: SavedConnection
  arrivals: Arrival[]
  destinationArrivals?: Arrival[]
  error?: string
}

export interface GroupDepartures {
  groupId: string
  updatedAt: number
  connections: ConnectionDepartures[]
  allArrivals: Arrival[]
  error?: string
}
