import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  CSSProperties,
  FormEvent,
  ReactNode,
} from 'react'
import {
  getArrivalsForConnection,
  getRouteName,
  getRoutes,
  getStopsForRoute,
  getStopName,
  getStops,
  hasApiKey,
  searchTransit,
} from './lib/bkkApi'
import { BkkApiError } from './lib/bkkApi'
import { createId, loadState, saveState } from './lib/storage'
import {
  getModeColor,
  getModeLabel,
  REFRESH_INTERVAL_OPTIONS,
} from './constants'
import type {
  Arrival,
  CommuteGroup,
  ConnectionDepartures,
  GroupDepartures,
  RouteReference,
  RouteStopOption,
  SavedConnection,
  TransportMode,
} from './types'

type ViewMode = 'all' | 'grouped'
type ModalType = 'group' | 'connection' | null

type IconName =
  | 'arrow'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'dots'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'spark'
  | 'trash'
  | 'train'

function Icon({
  name,
  size = 20,
}: {
  name: IconName
  size?: number
}) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    dots: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: (
      <path d="M20 11a8.1 8.1 0 0 0-14.9-3L3 11m0 0V6m0 5h5m-5 1a8.1 8.1 0 0 0 14.9 3L21 13m0 0v5m0-5h-5" />
    ),
    search: (
      <>
        <circle cx="10.7" cy="10.7" r="6.2" />
        <path d="m16 16 4 4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.6v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.5-1H6.3v-2.6h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2H15v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.2 5.8L19 10l-5.8 1.2L12 17l-1.2-5.8L5 10l5.8-1.2L12 3Z" />
        <path d="m19 16 .5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5L19 16Z" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M10 11v5m4-5v5M6 7l1 13h10l1-13M9 7V4h6v3" />
      </>
    ),
    train: (
      <>
        <rect x="5" y="3.5" width="14" height="14" rx="3" />
        <path d="M8 17.5 6 21m10-3.5 2 3.5M5 12.5h14M8 7.5h.01M16 7.5h.01" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  )
}

function App() {
  const [appState, setAppState] = useState(loadState)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    () => loadState().groups[0]?.id ?? null,
  )
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [modal, setModal] = useState<ModalType>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [departures, setDepartures] = useState<Record<string, GroupDepartures>>(
    {},
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const refreshInFlight = useRef(false)

  const activeGroup = useMemo(
    () =>
      appState.groups.find((group) => group.id === activeGroupId) ??
      appState.groups[0],
    [activeGroupId, appState.groups],
  )

  useEffect(() => {
    saveState(appState)
  }, [appState])

  useEffect(() => {
    if (activeGroup && activeGroup.id !== activeGroupId) {
      setActiveGroupId(activeGroup.id)
    }
  }, [activeGroup, activeGroupId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => window.clearInterval(timer)
  }, [])

  const refreshAll = useCallback(async () => {
    if (refreshInFlight.current || appState.groups.length === 0) {
      return
    }

    if (!hasApiKey(appState.settings.apiKey)) {
      setFetchError('A valós idejű adatokhoz add meg a BKK API-kulcsot.')
      return
    }

    refreshInFlight.current = true
    setIsRefreshing(true)
    setFetchError('')

    try {
      const refreshedGroups = await Promise.all(
        appState.groups.map(async (group): Promise<GroupDepartures> => {
          const connectionResults = await Promise.all(
            group.connections.map(
              async (connection): Promise<ConnectionDepartures> => {
                try {
                  const response = await getArrivalsForConnection(
                    connection,
                    appState.settings.apiKey,
                  )
                  const entry = response.data?.entry
                  const route = getRoutes(response.data?.references).find(
                    (candidate) => candidate.id === connection.routeId,
                  )
                  const stop = getStops(response.data?.references).find(
                    (candidate) => candidate.id === connection.stopId,
                  )
                  const serverNow =
                    response.currentTime && response.currentTime > 100_000_000_000
                      ? response.currentTime / 1000
                      : Date.now() / 1000
                  const arrivals = (entry?.stopTimes ?? [])
                    .map((stopTime): Arrival | null => {
                      const timestamp =
                        stopTime.predictedArrivalTime ??
                        stopTime.arrivalTime ??
                        stopTime.predictedDepartureTime ??
                        stopTime.departureTime

                      if (!timestamp || timestamp < serverNow - 15) {
                        return null
                      }

                      const realtime =
                        stopTime.predictedArrivalTime !== undefined ||
                        stopTime.predictedDepartureTime !== undefined

                      return {
                        id: `${connection.id}-${stopTime.tripId}`,
                        connectionId: connection.id,
                        routeId: connection.routeId,
                        routeName: route
                          ? getRouteName(route)
                          : connection.routeName,
                        routeType: route?.type ?? connection.routeType,
                        routeColor:
                          route?.style?.color ??
                          route?.color ??
                          connection.routeColor,
                        routeTextColor:
                          route?.style?.icon?.textColor ??
                          route?.textColor ??
                          connection.routeTextColor,
                        stopId: connection.stopId,
                        stopName: stop ? getStopName(stop) : connection.stopName,
                        destination:
                          stopTime.stopHeadsign ||
                          route?.description?.split('|')[1]?.trim() ||
                          'Célállomás nélkül',
                        timestamp,
                        minutes: Math.max(
                          0,
                          Math.round((timestamp - serverNow) / 60),
                        ),
                        isRealtime: realtime,
                        uncertain: stopTime.uncertain ?? false,
                      }
                    })
                    .filter((arrival): arrival is Arrival => arrival !== null)
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .slice(0, 3)

                  return { connection, arrivals }
                } catch (error) {
                  return {
                    connection,
                    arrivals: [],
                    error: getErrorMessage(error),
                  }
                }
              },
            ),
          )

          return {
            groupId: group.id,
            updatedAt: Date.now(),
            connections: connectionResults,
            allArrivals: connectionResults
              .flatMap((result) => result.arrivals)
              .sort((a, b) => a.timestamp - b.timestamp),
            error:
              connectionResults.length > 0 &&
              connectionResults.every((result) => result.error)
                ? 'A csoport adatai nem tölthetők be.'
                : undefined,
          }
        }),
      )

      setDepartures((current) => {
        const next = { ...current }
        refreshedGroups.forEach((group) => {
          next[group.groupId] = group
        })
        return next
      })
    } catch (error) {
      setFetchError(getErrorMessage(error))
    } finally {
      refreshInFlight.current = false
      setIsRefreshing(false)
    }
  }, [appState.groups, appState.settings.apiKey])

  useEffect(() => {
    if (appState.groups.length > 0 && hasApiKey(appState.settings.apiKey)) {
      void refreshAll()
    }
  }, [appState.groups.length, appState.settings.apiKey, refreshAll])

  useEffect(() => {
    if (
      appState.groups.length === 0 ||
      !hasApiKey(appState.settings.apiKey)
    ) {
      return
    }

    const timer = window.setInterval(
      () => void refreshAll(),
      appState.settings.refreshInterval * 1000,
    )
    return () => window.clearInterval(timer)
  }, [
    appState.groups.length,
    appState.settings.apiKey,
    appState.settings.refreshInterval,
    refreshAll,
  ])

  function updateSettings(
    settings: Partial<typeof appState.settings>,
  ): void {
    setAppState((current) => ({
      ...current,
      settings: { ...current.settings, ...settings },
    }))
  }

  function createGroup(name: string): void {
    const group: CommuteGroup = {
      id: createId('group'),
      name: name.trim(),
      connections: [],
    }

    setAppState((current) => ({
      ...current,
      groups: [...current.groups, group],
    }))
    setActiveGroupId(group.id)
    setModal(null)
  }

  function addConnection(connection: SavedConnection): boolean {
    if (!activeGroup) {
      return false
    }

    if (
      activeGroup.connections.some(
        (existing) =>
          existing.routeId === connection.routeId &&
          existing.stopId === connection.stopId,
      )
    ) {
      return false
    }

    setAppState((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === activeGroup.id
          ? { ...group, connections: [...group.connections, connection] }
          : group,
      ),
    }))
    setModal(null)
    return true
  }

  function removeConnection(connectionId: string): void {
    if (!activeGroup) {
      return
    }

    setAppState((current) => ({
      ...current,
      groups: current.groups.map((group) =>
        group.id === activeGroup.id
          ? {
              ...group,
              connections: group.connections.filter(
                (connection) => connection.id !== connectionId,
              ),
            }
          : group,
      ),
    }))
  }

  function removeGroup(groupId: string): void {
    const group = appState.groups.find((candidate) => candidate.id === groupId)
    if (!group || !window.confirm(`Törlöd a(z) „${group.name}” csoportot?`)) {
      return
    }

    const remaining = appState.groups.filter((candidate) => candidate.id !== groupId)
    setAppState((current) => ({
      ...current,
      groups: current.groups.filter((candidate) => candidate.id !== groupId),
    }))
    setActiveGroupId(remaining[0]?.id ?? null)
    setDepartures((current) => {
      const next = { ...current }
      delete next[groupId]
      return next
    })
  }

  const activeDepartures = activeGroup
    ? departures[activeGroup.id]
    : undefined

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <div className="brand-name">BKK Figyelő</div>
              <div className="brand-caption">Indulás előtt egy pillantás</div>
            </div>
          </div>
          <button
            aria-label="Beállítások"
            className="icon-button icon-button-on-dark"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <main className="main-content">
        {settingsOpen ? (
          <SettingsView
            apiKey={appState.settings.apiKey}
            onApiKeyChange={(apiKey) => updateSettings({ apiKey })}
            onClose={() => setSettingsOpen(false)}
            onRefreshIntervalChange={(refreshInterval) =>
              updateSettings({ refreshInterval })
            }
            refreshInterval={appState.settings.refreshInterval}
          />
        ) : (
          <>
            <section className="intro-row">
              <div>
                <p className="eyebrow">Budapesti közlekedés</p>
                <h1>Merre indulj?</h1>
              </div>
              <button
                className={`refresh-button ${isRefreshing ? 'is-spinning' : ''}`}
                disabled={isRefreshing || appState.groups.length === 0}
                onClick={() => void refreshAll()}
                type="button"
              >
                <Icon name="refresh" size={17} />
                <span>Frissítés</span>
              </button>
            </section>

            {appState.groups.length > 0 && (
              <GroupTabs
                activeGroupId={activeGroup?.id}
                groups={appState.groups}
                onAdd={() => setModal('group')}
                onSelect={setActiveGroupId}
              />
            )}

            {fetchError && (
              <div className="notice notice-warning" role="alert">
                <div className="notice-icon">
                  <Icon name="spark" size={17} />
                </div>
                <div>
                  <strong>Az adatok frissítése megakadt</strong>
                  <p>{fetchError}</p>
                </div>
                <button
                  aria-label="Értesítés bezárása"
                  className="notice-close"
                  onClick={() => setFetchError('')}
                  type="button"
                >
                  <Icon name="close" size={17} />
                </button>
              </div>
            )}

            {!hasApiKey(appState.settings.apiKey) && appState.groups.length > 0 && (
              <ApiKeyNotice onOpenSettings={() => setSettingsOpen(true)} />
            )}

            {appState.groups.length === 0 ? (
              <EmptyDashboard onAdd={() => setModal('group')} />
            ) : activeGroup ? (
              <GroupDashboard
                departures={activeDepartures}
                group={activeGroup}
                isRefreshing={isRefreshing}
                now={now}
                onAddConnection={() => setModal('connection')}
                onDeleteConnection={removeConnection}
                onDeleteGroup={() => removeGroup(activeGroup.id)}
                onViewModeChange={setViewMode}
                viewMode={viewMode}
              />
            ) : null}
          </>
        )}
      </main>

      <footer className="app-footer">
        <span>Adatok: BKK FUTÁR</span>
        <span className="footer-dot" />
        <span>Csak ezen az eszközön tárolva</span>
      </footer>

      {modal === 'group' && (
        <GroupModal onClose={() => setModal(null)} onSave={createGroup} />
      )}
      {modal === 'connection' && (
        <ConnectionModal
          apiKey={appState.settings.apiKey}
          existingConnections={activeGroup?.connections ?? []}
          onAdd={addConnection}
          onClose={() => setModal(null)}
          onOpenSettings={() => {
            setModal(null)
            setSettingsOpen(true)
          }}
        />
      )}
    </div>
  )
}

function GroupTabs({
  groups,
  activeGroupId,
  onSelect,
  onAdd,
}: {
  groups: CommuteGroup[]
  activeGroupId?: string
  onSelect: (groupId: string) => void
  onAdd: () => void
}) {
  return (
    <div className="group-tabs-wrap">
      <div className="group-tabs" role="tablist" aria-label="Csoportok">
        {groups.map((group) => (
          <button
            aria-selected={group.id === activeGroupId}
            className={`group-tab ${group.id === activeGroupId ? 'is-active' : ''}`}
            key={group.id}
            onClick={() => onSelect(group.id)}
            role="tab"
            type="button"
          >
            <span className="group-tab-name">{group.name}</span>
            <span className="group-tab-count">{group.connections.length}</span>
          </button>
        ))}
        <button
          aria-label="Új csoport"
          className="add-tab"
          onClick={onAdd}
          type="button"
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  )
}

function EmptyDashboard({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="empty-dashboard">
      <div className="empty-illustration">
        <div className="empty-sun" />
        <div className="empty-route empty-route-one" />
        <div className="empty-route empty-route-two" />
        <div className="empty-stop">
          <span />
          <span />
        </div>
      </div>
      <p className="eyebrow">Saját indulási táblád</p>
      <h2>Még nincs csoportod</h2>
      <p className="empty-copy">
        Hozz létre egy csoportot, például „Munkába menet”, majd add hozzá a
        használni kívánt járatokat és megállókat.
      </p>
      <button className="primary-button" onClick={onAdd} type="button">
        <Icon name="plus" size={18} />
        Első csoport létrehozása
      </button>
    </section>
  )
}

function ApiKeyNotice({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="api-key-banner">
      <div className="api-key-banner-icon">
        <Icon name="settings" size={18} />
      </div>
      <div>
        <strong>Kapcsolódj a BKK élő adataihoz</strong>
        <p>A járatok érkezéséhez API-kulcs szükséges.</p>
      </div>
      <button onClick={onOpenSettings} type="button">
        Beállítás
        <Icon name="arrow" size={16} />
      </button>
    </div>
  )
}

function GroupDashboard({
  group,
  departures,
  viewMode,
  now,
  isRefreshing,
  onAddConnection,
  onDeleteConnection,
  onDeleteGroup,
  onViewModeChange,
}: {
  group: CommuteGroup
  departures?: GroupDepartures
  viewMode: ViewMode
  now: number
  isRefreshing: boolean
  onAddConnection: () => void
  onDeleteConnection: (connectionId: string) => void
  onDeleteGroup: () => void
  onViewModeChange: (viewMode: ViewMode) => void
}) {
  const hasData = departures !== undefined

  return (
    <section className="group-dashboard">
      <div className="group-heading">
        <div>
          <p className="eyebrow">Aktív csoport</p>
          <div className="group-title-row">
            <h2>{group.name}</h2>
            <button
              aria-label="Csoport törlése"
              className="subtle-icon-button danger-on-hover"
              onClick={onDeleteGroup}
              type="button"
            >
              <Icon name="trash" size={17} />
            </button>
          </div>
          <p className="group-meta">
            {group.connections.length === 0
              ? 'Adj hozzá járatokat és megállókat'
              : `${group.connections.length} figyelt járat és megálló`}
          </p>
        </div>
        <button className="add-connection-button" onClick={onAddConnection} type="button">
          <Icon name="plus" size={17} />
          <span>Járat hozzáadása</span>
        </button>
      </div>

      {group.connections.length === 0 ? (
        <div className="empty-group">
          <div className="empty-group-icon">
            <Icon name="train" size={24} />
          </div>
          <h3>Ez a csoport még üres</h3>
          <p>
            Válassz egy járatot és egy megállót. Ezután mindig látni fogod a
            következő három érkezést.
          </p>
          <button className="secondary-button" onClick={onAddConnection} type="button">
            <Icon name="plus" size={17} />
            Járat és megálló hozzáadása
          </button>
        </div>
      ) : (
        <>
          <div className="view-switcher" role="tablist" aria-label="Nézet">
            <button
              aria-selected={viewMode === 'all'}
              className={viewMode === 'all' ? 'is-active' : ''}
              onClick={() => onViewModeChange('all')}
              role="tab"
              type="button"
            >
              <span className="view-switcher-icon">≡</span>
              Összes érkezés
            </button>
            <button
              aria-selected={viewMode === 'grouped'}
              className={viewMode === 'grouped' ? 'is-active' : ''}
              onClick={() => onViewModeChange('grouped')}
              role="tab"
              type="button"
            >
              <span className="view-switcher-icon">▦</span>
              Járatonként
            </button>
          </div>

          <DataStatus
            departures={departures}
            hasData={hasData}
            isRefreshing={isRefreshing}
          />

          {viewMode === 'all' ? (
            <AllArrivalsView
              arrivals={departures?.allArrivals ?? []}
              isRefreshing={isRefreshing || !hasData}
              now={now}
            />
          ) : (
            <GroupedArrivalsView
              connections={departures?.connections ?? []}
              isRefreshing={isRefreshing || !hasData}
              now={now}
              onDeleteConnection={onDeleteConnection}
            />
          )}
        </>
      )}
    </section>
  )
}

function DataStatus({
  departures,
  hasData,
  isRefreshing,
}: {
  departures?: GroupDepartures
  hasData: boolean
  isRefreshing: boolean
}) {
  return (
    <div className="data-status">
      <span className={`status-dot ${isRefreshing ? 'is-loading' : ''}`} />
      <span>
        {isRefreshing
          ? 'Adatok frissítése…'
          : hasData && departures
            ? `Frissítve ${formatRelativeUpdate(departures.updatedAt)}`
            : 'Élő indulások betöltése'}
      </span>
      <span className="status-separator">·</span>
      <span>Automatikusan frissül</span>
    </div>
  )
}

function AllArrivalsView({
  arrivals,
  now,
  isRefreshing,
}: {
  arrivals: Arrival[]
  now: number
  isRefreshing: boolean
}) {
  if (isRefreshing && arrivals.length === 0) {
    return <LoadingList />
  }

  if (arrivals.length === 0) {
    return (
      <div className="no-arrivals">
        <div className="no-arrivals-icon">
          <Icon name="clock" size={23} />
        </div>
        <strong>Nincs közelgő érkezés</strong>
        <p>Az elkövetkező 90 percben nincs találat a figyelt járatokra.</p>
      </div>
    )
  }

  return (
    <div className="arrival-list">
      <div className="list-heading">
        <span>Legkorábban érkezik</span>
        <span>{arrivals.length} találat</span>
      </div>
      {arrivals.map((arrival, index) => (
        <ArrivalCard
          arrival={arrival}
          isFirst={index === 0}
          key={arrival.id}
          now={now}
        />
      ))}
    </div>
  )
}

function GroupedArrivalsView({
  connections,
  now,
  isRefreshing,
  onDeleteConnection,
}: {
  connections: ConnectionDepartures[]
  now: number
  isRefreshing: boolean
  onDeleteConnection: (connectionId: string) => void
}) {
  if (isRefreshing && connections.length === 0) {
    return <LoadingList />
  }

  return (
    <div className="connection-list">
      {connections.map((connectionResult) => (
        <ConnectionCard
          connectionResult={connectionResult}
          isRefreshing={isRefreshing}
          key={connectionResult.connection.id}
          now={now}
          onDelete={() => onDeleteConnection(connectionResult.connection.id)}
        />
      ))}
    </div>
  )
}

function ConnectionCard({
  connectionResult,
  now,
  isRefreshing,
  onDelete,
}: {
  connectionResult: ConnectionDepartures
  now: number
  isRefreshing: boolean
  onDelete: () => void
}) {
  const { connection, arrivals, error } = connectionResult
  const color = getModeColor(connection.routeType, connection.routeColor)

  return (
    <article className="connection-card">
      <div className="connection-card-heading">
        <div className="connection-identity">
          <RouteBadge
            color={color}
            name={connection.routeName}
            textColor={connection.routeTextColor}
            type={connection.routeType}
          />
          <div>
            <h3>{connection.routeName}</h3>
            <p>{connection.stopName}</p>
          </div>
        </div>
        <button
          aria-label={`${connection.routeName} törlése`}
          className="subtle-icon-button"
          onClick={() => {
            if (window.confirm('Törlöd ezt a figyelt járatot?')) {
              onDelete()
            }
          }}
          type="button"
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
      {connection.stopDirection && (
        <div className="direction-label">
          <Icon name="arrow" size={14} />
          {connection.stopDirection}
        </div>
      )}
      {error ? (
        <div className="connection-error">
          <span>{error}</span>
          <span>Frissítsd újra később.</span>
        </div>
      ) : isRefreshing && arrivals.length === 0 ? (
        <div className="mini-loading">
          <span />
          <span />
          <span />
        </div>
      ) : arrivals.length === 0 ? (
        <div className="connection-empty">Nincs közelgő indulás</div>
      ) : (
        <div className="mini-arrivals">
          {arrivals.map((arrival) => (
            <MiniArrival arrival={arrival} key={arrival.id} now={now} />
          ))}
        </div>
      )}
    </article>
  )
}

function ArrivalCard({
  arrival,
  now,
  isFirst,
}: {
  arrival: Arrival
  now: number
  isFirst: boolean
}) {
  const color = getModeColor(arrival.routeType, arrival.routeColor)

  return (
    <article className={`arrival-card ${isFirst ? 'is-first' : ''}`}>
      <div className="arrival-route-column">
        <RouteBadge
          color={color}
          name={arrival.routeName}
          textColor={arrival.routeTextColor}
          type={arrival.routeType}
        />
        {isFirst && <span className="first-label">Következő</span>}
      </div>
      <div className="arrival-details">
        <strong>{arrival.destination}</strong>
        <span>{arrival.stopName}</span>
        <span className="arrival-mode">
          {arrival.isRealtime ? '● Valós idejű adat' : 'Menetrend szerint'}
          {arrival.uncertain ? ' · bizonytalan' : ''}
        </span>
      </div>
      <TimeDisplay arrival={arrival} now={now} />
    </article>
  )
}

function MiniArrival({ arrival, now }: { arrival: Arrival; now: number }) {
  return (
    <div className="mini-arrival">
      <div>
        <strong>{arrival.destination}</strong>
        <span className="mini-arrival-status">
          {arrival.isRealtime ? 'Valós idő' : 'Menetrend'}
        </span>
      </div>
      <TimeDisplay arrival={arrival} now={now} compact />
    </div>
  )
}

function TimeDisplay({
  arrival,
  now,
  compact = false,
}: {
  arrival: Arrival
  now: number
  compact?: boolean
}) {
  const minutes = Math.max(
    0,
    Math.round((arrival.timestamp - now / 1000) / 60),
  )

  return (
    <div className={`time-display ${compact ? 'is-compact' : ''}`}>
      <strong>{minutes === 0 ? 'Most' : `${minutes} perc`}</strong>
      <span>{formatTime(arrival.timestamp)}</span>
    </div>
  )
}

function RouteBadge({
  name,
  type,
  color,
  textColor,
}: {
  name: string
  type: TransportMode
  color: string
  textColor?: string
}) {
  const style = {
    '--route-color': color,
    '--route-text-color': textColor?.startsWith('#')
      ? textColor
      : textColor
        ? `#${textColor}`
        : '#ffffff',
  } as CSSProperties

  return (
    <div className="route-badge" style={style}>
      <span className="route-badge-icon">
        {type === 'TRAM' ? 'T' : type === 'SUBWAY' ? 'M' : type === 'TROLLEYBUS' ? 'TB' : 'B'}
      </span>
      <span>{name}</span>
    </div>
  )
}

function LoadingList() {
  return (
    <div className="loading-list" aria-label="Betöltés">
      {[1, 2, 3].map((item) => (
        <div className="loading-card" key={item}>
          <span className="loading-badge" />
          <span className="loading-lines">
            <i />
            <i />
            <i />
          </span>
          <span className="loading-time" />
        </div>
      ))}
    </div>
  )
}

function GroupModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim()) {
      onSave(name.trim())
    }
  }

  return (
    <Modal onClose={onClose} title="Új csoport">
      <form className="modal-form" onSubmit={submit}>
        <p className="modal-intro">
          Csoportosítsd azokat a járatokat, amelyeket ugyanazon az úton
          használsz.
        </p>
        <label className="field-label" htmlFor="group-name">
          Csoport neve
        </label>
        <input
          autoFocus
          className="text-input"
          id="group-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Például: Munkába menet"
          value={name}
        />
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Mégse
          </button>
          <button className="primary-button" disabled={!name.trim()} type="submit">
            Létrehozás
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ConnectionModal({
  apiKey,
  existingConnections,
  onAdd,
  onClose,
  onOpenSettings,
}: {
  apiKey: string
  existingConnections: SavedConnection[]
  onAdd: (connection: SavedConnection) => boolean
  onClose: () => void
  onOpenSettings: () => void
}) {
  const [routeQuery, setRouteQuery] = useState('')
  const [routeResults, setRouteResults] = useState<RouteReference[]>([])
  const [routeStopOptions, setRouteStopOptions] = useState<RouteStopOption[]>([])
  const [selectedRoute, setSelectedRoute] = useState<RouteReference>()
  const [selectedStop, setSelectedStop] = useState<RouteStopOption>()
  const [searching, setSearching] = useState(false)
  const [loadingStops, setLoadingStops] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!selectedRoute || !hasApiKey(apiKey)) {
      setRouteStopOptions([])
      setSelectedStop(undefined)
      setLoadingStops(false)
      return
    }

    let cancelled = false
    setRouteStopOptions([])
    setSelectedStop(undefined)
    setLoadingStops(true)
    setError('')

    void getStopsForRoute(selectedRoute.id, apiKey)
      .then((options) => {
        if (!cancelled) {
          setRouteStopOptions(options)
          if (options.length === 0) {
            setError('Ehhez a járathoz nem sikerült megállókat betölteni.')
          }
        }
      })
      .catch((routeError) => {
        if (!cancelled) {
          setError(getErrorMessage(routeError))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStops(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [apiKey, selectedRoute])

  async function search(query: string) {
    if (!query.trim()) {
      return
    }

    if (!hasApiKey(apiKey)) {
      setError('A kereséshez előbb add meg a BKK API-kulcsot a beállításokban.')
      return
    }

    setSearching(true)
    setError('')
    try {
      const response = await searchTransit(query, apiKey)
      setRouteResults(getRoutes(response.data?.references))
    } catch (searchError) {
      setError(getErrorMessage(searchError))
    } finally {
      setSearching(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRoute || !selectedStop) {
      setError('Válassz ki egy járatot és egy megállót is.')
      return
    }

    const connection: SavedConnection = {
      id: createId('connection'),
      routeId: selectedRoute.id,
      routeName: getRouteName(selectedRoute),
      routeType: selectedRoute.type ?? 'BUS',
      routeColor: selectedRoute.style?.color ?? selectedRoute.color,
      routeTextColor:
        selectedRoute.style?.icon?.textColor ?? selectedRoute.textColor,
      stopId: selectedStop.stop.id,
      stopName: getStopName(selectedStop.stop),
      stopDirection:
        selectedStop.directionLabel || selectedStop.stop.direction,
    }

    if (
      existingConnections.some(
        (existing) =>
          existing.routeId === connection.routeId &&
          existing.stopId === connection.stopId,
      )
    ) {
      setError('Ez a járat és megálló már szerepel ebben a csoportban.')
      return
    }

    if (onAdd(connection)) {
      onClose()
    }
  }

  return (
    <Modal onClose={onClose} title="Járat hozzáadása">
      <form className="modal-form connection-form" onSubmit={submit}>
        {!hasApiKey(apiKey) ? (
          <div className="modal-key-prompt">
            <div className="modal-key-prompt-icon">
              <Icon name="settings" size={20} />
            </div>
            <div>
              <strong>API-kulcs szükséges a kereséshez</strong>
              <p>A BKK FUTÁR adataihoz egyszer kell beállítani a kulcsot.</p>
              <button onClick={onOpenSettings} type="button">
                Beállítások megnyitása <Icon name="arrow" size={15} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="modal-intro">
              Keresd meg a járatot. A kiválasztás után a hozzá tartozó
              megállók közül választhatsz.
            </p>
            <SearchField
              label="Járat"
              onChange={setRouteQuery}
              onSearch={() => void search(routeQuery)}
              placeholder="Például: 4, M3 vagy 105"
              query={routeQuery}
              searching={searching}
            />
            {routeResults.length > 0 && (
              <SearchResultList
                emptyLabel="Nem találtam járatot."
                items={routeResults}
                renderItem={(route) => (
                  <SearchRouteResult
                    isSelected={selectedRoute?.id === route.id}
                    onClick={() => {
                      setSelectedRoute(route)
                      setRouteStopOptions([])
                      setSelectedStop(undefined)
                      setError('')
                    }}
                    route={route}
                  />
                )}
              />
            )}
            {selectedRoute && (
              <div className="selection-summary">
                <Icon name="check" size={15} />
                {getRouteName(selectedRoute)} kiválasztva
              </div>
            )}

            {selectedRoute && (
              <RouteStopsSelect
                loading={loadingStops}
                onChange={(value) =>
                  setSelectedStop(
                    routeStopOptions.find((option) => option.value === value),
                  )
                }
                options={routeStopOptions}
                selectedValue={selectedStop?.value ?? ''}
              />
            )}
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Mégse
          </button>
          {hasApiKey(apiKey) && (
            <button
              className="primary-button"
              disabled={!selectedRoute || !selectedStop}
              type="submit"
            >
              Hozzáadás
              <Icon name="plus" size={16} />
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}

function SearchField({
  label,
  query,
  placeholder,
  searching,
  onChange,
  onSearch,
}: {
  label: string
  query: string
  placeholder: string
  searching: boolean
  onChange: (value: string) => void
  onSearch: () => void
}) {
  return (
    <label className="search-field">
      <span className="field-label">{label}</span>
      <span className="search-input-wrap">
        <Icon name="search" size={17} />
        <input
          className="text-input"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSearch()
            }
          }}
          placeholder={placeholder}
          value={query}
        />
        <button
          className="search-submit"
          disabled={!query.trim() || searching}
          onClick={onSearch}
          type="button"
        >
          {searching ? 'Keresés…' : 'Keresés'}
        </button>
      </span>
    </label>
  )
}

function RouteStopsSelect({
  options,
  selectedValue,
  loading,
  onChange,
}: {
  options: RouteStopOption[]
  selectedValue: string
  loading: boolean
  onChange: (value: string) => void
}) {
  const groupedOptions = options.reduce<Map<string, RouteStopOption[]>>(
    (groups, option) => {
      const label = option.directionLabel || 'Megállók'
      const current = groups.get(label) ?? []
      current.push(option)
      groups.set(label, current)
      return groups
    },
    new Map(),
  )

  return (
    <label className="select-field">
      <span className="field-label">Megálló</span>
      {loading ? (
        <div className="select-loading">
          <Icon name="refresh" size={16} />
          Megállók betöltése…
        </div>
      ) : options.length === 0 ? (
        <div className="select-empty">Nincs választható megálló.</div>
      ) : (
        <span className="select-wrap">
          <select
            onChange={(event) => onChange(event.target.value)}
            value={selectedValue}
          >
            <option value="">Válassz megállót…</option>
            {Array.from(groupedOptions.entries()).map(([label, stops]) => (
              <optgroup key={label} label={`${label} felé`}>
                {stops.map((option) => (
                  <option key={option.value} value={option.value}>
                    {getStopName(option.stop)}
                    {option.stop.platformCode
                      ? ` · peron ${option.stop.platformCode}`
                      : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Icon name="chevron" size={17} />
        </span>
      )}
    </label>
  )
}

function SearchResultList<T>({
  items,
  emptyLabel,
  renderItem,
}: {
  items: T[]
  emptyLabel: string
  renderItem: (item: T) => ReactNode
}) {
  if (items.length === 0) {
    return <div className="search-empty">{emptyLabel}</div>
  }

  return (
    <div className="search-results">
      {items.map((item, index) => (
        <Fragment key={index}>{renderItem(item)}</Fragment>
      ))}
    </div>
  )
}

function SearchRouteResult({
  route,
  isSelected,
  onClick,
}: {
  route: RouteReference
  isSelected: boolean
  onClick: () => void
}) {
  const color = getModeColor(route.type ?? 'BUS', route.style?.color ?? route.color)
  return (
    <button
      className={`search-result ${isSelected ? 'is-selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      <RouteBadge
        color={color}
        name={getRouteName(route)}
        textColor={route.style?.icon?.textColor ?? route.textColor}
        type={route.type ?? 'BUS'}
      />
      <span className="search-result-detail">
        {getModeLabel(route.type ?? 'BUS')}
      </span>
      {isSelected && <Icon name="check" size={17} />}
    </button>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        aria-modal="true"
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            aria-label="Bezárás"
            className="subtle-icon-button"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SettingsView({
  apiKey,
  refreshInterval,
  onApiKeyChange,
  onRefreshIntervalChange,
  onClose,
}: {
  apiKey: string
  refreshInterval: number
  onApiKeyChange: (value: string) => void
  onRefreshIntervalChange: (value: number) => void
  onClose: () => void
}) {
  return (
    <section className="settings-view">
      <div className="settings-heading">
        <button className="back-button" onClick={onClose} type="button">
          <Icon name="arrow" size={18} />
          Vissza
        </button>
        <p className="eyebrow">Személyre szabás</p>
        <h1>Beállítások</h1>
        <p>
          Az itt megadott beállításokat az alkalmazás csak ezen az eszközön
          menti el.
        </p>
      </div>

      <div className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-card-icon">
            <Icon name="spark" size={19} />
          </div>
          <div>
            <h2>BKK FUTÁR kapcsolat</h2>
            <p>Élő érkezési és indulási adatok</p>
          </div>
        </div>
        <label className="field-label" htmlFor="api-key">
          API-kulcs
        </label>
        <input
          className="text-input"
          id="api-key"
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder="Illeszd be a BKK API-kulcsot"
          type="password"
          value={apiKey}
        />
        <p className="field-help">
          A kulcsot a böngésző localStorage-a tárolja. A GitHub Pages nem tudja
          titkosan kezelni a frontendbe bekerülő kulcsot.
        </p>
      </div>

      <div className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-card-icon muted">
            <Icon name="refresh" size={19} />
          </div>
          <div>
            <h2>Automatikus frissítés</h2>
            <p>Milyen gyakran kérjünk új adatot?</p>
          </div>
        </div>
        <div className="interval-options">
          {REFRESH_INTERVAL_OPTIONS.map((interval) => (
            <button
              className={refreshInterval === interval ? 'is-active' : ''}
              key={interval}
              onClick={() => onRefreshIntervalChange(interval)}
              type="button"
            >
              {interval} mp
            </button>
          ))}
        </div>
      </div>

      <div className="info-card">
        <Icon name="train" size={18} />
        <p>
          A járatok, csoportok és a beállítások nem kerülnek szerverre. Az
          adatokat a BKK FUTÁR API szolgáltatja.
        </p>
      </div>
    </section>
  )
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('hu-HU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000))
}

function formatRelativeUpdate(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 10) {
    return 'most'
  }
  if (seconds < 60) {
    return `${seconds} mp-e`
  }
  return `${Math.round(seconds / 60)} perce`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof BkkApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Ismeretlen hiba történt.'
}

export default App
