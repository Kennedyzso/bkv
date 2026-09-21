import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  ReactNode,
} from 'react'
import {
  getArrivalsForConnection,
  filterRoutesByQuery,
  getRouteName,
  getRouteForStopTime,
  getRoutes,
  getStopsForRoute,
  getStopName,
  getStops,
  getTripRouteIdsForStop,
  hasApiKey,
  searchTransit,
} from './lib/bkkApi'
import { BkkApiError } from './lib/bkkApi'
import {
  createId,
  loadState,
  parseGroups,
  saveState,
  serializeGroups,
} from './lib/storage'
import {
  ARRIVALS_LOAD_MORE_STEP,
  ARRIVALS_PER_CONNECTION_OPTIONS,
  getModeColor,
  getModeLabel,
  REFRESH_INTERVAL_OPTIONS,
} from './constants'
import type {
  ArrivalsEntry,
  Arrival,
  BkkResponse,
  CommuteGroup,
  ConnectionDepartures,
  GroupDepartures,
  RouteReference,
  RouteStopOption,
  RouteStopsResult,
  SavedConnection,
  TransportMode,
} from './types'

type ViewMode = 'all' | 'grouped'
type SettingsTab = 'technical' | 'behavior'
type GroupedSortMode = 'earliest' | 'routeName'
type ModalType = 'group' | 'connection' | null

type IconName =
  | 'arrow'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'download'
  | 'dots'
  | 'eye'
  | 'edit'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'spark'
  | 'trash'
  | 'train'
  | 'upload'
  | 'menu'

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
    download: <path d="M12 4v11m-4-4 4 4 4-4M5 20h14" />,
    dots: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    eye: (
      <>
        <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    edit: (
      <>
        <path d="m4 16.5-.8 3.8 3.8-.8L18.2 8.3a2.1 2.1 0 0 0-3-3L4 16.5Z" />
        <path d="m13.8 6.2 3 3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    refresh: (
      <>
        <path d="M21 12a9 9 0 0 0-15.3-6.4L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 15.3 6.4L21 16" />
        <path d="M21 21v-5h-5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.7" cy="10.7" r="6.2" />
        <path d="m16 16 4 4" />
      </>
    ),
    settings: (
      <path
        d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.37-.31-.6-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98L14.5 2.42C14.47 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.5.42L9.12 5.07c-.61.25-1.17.58-1.69.98l-2.49-1c-.23-.08-.48 0-.6.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.08.48 0 .6-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
        fill="currentColor"
        fillRule="evenodd"
        stroke="none"
      />
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
    upload: <path d="M12 20V9m-4 4 4-4 4 4M5 4h14" />,
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

function TopbarMenu({
  onOpenQuickSearch,
  onOpenSettings,
}: {
  onOpenQuickSearch: () => void
  onOpenSettings: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="topbar-menu" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Menü"
        className={`icon-button icon-button-on-dark ${
          isOpen ? 'is-active' : ''
        }`}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Icon name="menu" />
      </button>
      {isOpen && (
        <div className="topbar-menu-panel" role="menu">
          <button
            className="topbar-menu-item"
            onClick={() => {
              setIsOpen(false)
              onOpenQuickSearch()
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="search" size={18} />
            <span>Gyors keresés</span>
          </button>
          <button
            className="topbar-menu-item"
            onClick={() => {
              setIsOpen(false)
              onOpenSettings()
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="settings" size={18} />
            <span>Beállítások</span>
          </button>
        </div>
      )}
    </div>
  )
}

function mapArrivalsForConnection(
  connection: SavedConnection,
  response: BkkResponse<ArrivalsEntry>,
  tripRouteIds: Record<string, string>,
): Arrival[] {
  const entry = response.data?.entry
  const routes = getRoutes(response.data?.references)
  const stop = getStops(response.data?.references).find(
    (candidate) => candidate.id === connection.stopId,
  )
  const serverNow =
    response.currentTime && response.currentTime > 100_000_000_000
      ? response.currentTime / 1000
      : Date.now() / 1000

  return (entry?.stopTimes ?? [])
    .map((stopTime): Arrival | null => {
      const timestamp =
        stopTime.predictedDepartureTime ?? stopTime.departureTime

      if (!timestamp || timestamp < serverNow - 15) {
        return null
      }

      const route = getRouteForStopTime(
        stopTime,
        routes,
        connection.routeId,
        tripRouteIds,
      )

      return {
        id: `${connection.id}-${stopTime.tripId}`,
        connectionId: connection.id,
        routeId: route?.id ?? connection.routeId,
        routeName: route ? getRouteName(route) : connection.routeName,
        routeType: route?.type ?? connection.routeType,
        routeColor:
          route?.style?.color ?? route?.color ?? connection.routeColor,
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
        isRealtime: stopTime.predictedDepartureTime !== undefined,
        uncertain: stopTime.uncertain ?? false,
      }
    })
    .filter((arrival): arrival is Arrival => arrival !== null)
    .sort((a, b) => a.timestamp - b.timestamp)
}

function App() {
  const [appState, setAppState] = useState(loadState)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    () => loadState().groups[0]?.id ?? null,
  )
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [modal, setModal] = useState<ModalType>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] =
    useState<SettingsTab>('behavior')
  const [departures, setDepartures] = useState<Record<string, GroupDepartures>>(
    {},
  )
  const [additionalArrivalsByGroup, setAdditionalArrivalsByGroup] = useState<
    Record<string, number>
  >({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [isPageVisible, setIsPageVisible] = useState(
    () =>
      typeof document === 'undefined' ||
      document.visibilityState === 'visible',
  )
  const refreshInFlight = useRef(new Set<string>())

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const refreshAll = useCallback(async () => {
    if (appState.groups.length === 0) {
      return
    }

    const groupToRefresh =
      appState.groups.find((group) => group.id === activeGroupId) ??
      appState.groups[0]
    if (!groupToRefresh || refreshInFlight.current.has(groupToRefresh.id)) {
      return
    }

    if (!hasApiKey(appState.settings.apiKey)) {
      setFetchError('A valós idejű adatokhoz add meg a BKK API-kulcsot.')
      return
    }

    refreshInFlight.current.add(groupToRefresh.id)
    setIsRefreshing(true)
    setFetchError('')

    try {
      const refreshedGroups = await Promise.all(
        [groupToRefresh].map(async (group): Promise<GroupDepartures> => {
          const hiddenConnectionIds = new Set(
            group.hiddenConnectionIds ?? [],
          )
          const connectionResults = await Promise.all(
            group.connections
              .filter((connection) => !hiddenConnectionIds.has(connection.id))
              .map(
                async (connection): Promise<ConnectionDepartures> => {
                  try {
                    const [response, tripRouteIds] = await Promise.all([
                      getArrivalsForConnection(
                        connection,
                        appState.settings.apiKey,
                      ),
                      getTripRouteIdsForStop(
                        connection.stopId,
                        appState.settings.apiKey,
                      ),
                    ])
                    const arrivals = mapArrivalsForConnection(
                      connection,
                      response,
                      tripRouteIds,
                    )

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
      refreshInFlight.current.delete(groupToRefresh.id)
      setIsRefreshing(refreshInFlight.current.size > 0)
    }
  }, [activeGroupId, appState.groups, appState.settings.apiKey])

  useEffect(() => {
    if (
      isPageVisible &&
      appState.groups.length > 0 &&
      hasApiKey(appState.settings.apiKey)
    ) {
      void refreshAll()
    }
  }, [
    appState.groups.length,
    appState.settings.apiKey,
    isPageVisible,
    refreshAll,
  ])

  useEffect(() => {
    if (
      !isPageVisible ||
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
    isPageVisible,
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

  function exportGroups(): void {
    if (appState.groups.length === 0) {
      return
    }

    const blob = new Blob([serializeGroups(appState.groups)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)

    link.href = url
    link.download = `bkv-figyelo-csoportok-${date}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  async function importGroups(file: File): Promise<number> {
    const importedGroups = parseGroups(await file.text())

    setAppState((current) => ({
      ...current,
      groups: [...current.groups, ...importedGroups],
    }))
    setActiveGroupId(importedGroups[0].id)

    return importedGroups.length
  }

  function loadMoreArrivals(groupId: string): void {
    setAdditionalArrivalsByGroup((current) => ({
      ...current,
      [groupId]: (current[groupId] ?? 0) + ARRIVALS_LOAD_MORE_STEP,
    }))
  }

  function openGroupModal(groupId: string | null = null): void {
    setEditingGroupId(groupId)
    setModal('group')
  }

  function closeGroupModal(): void {
    setEditingGroupId(null)
    setModal(null)
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

  function saveGroup(name: string): void {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    if (editingGroupId) {
      setAppState((current) => ({
        ...current,
        groups: current.groups.map((group) =>
          group.id === editingGroupId
            ? { ...group, name: trimmedName }
            : group,
        ),
      }))
      closeGroupModal()
      return
    }

    createGroup(trimmedName)
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

  function toggleConnectionVisibility(
    groupId: string,
    connectionId: string,
  ): void {
    setAppState((current) => ({
      ...current,
      groups: current.groups.map((group) => {
        if (group.id !== groupId) {
          return group
        }

        const hiddenConnectionIds = new Set(group.hiddenConnectionIds ?? [])
        if (hiddenConnectionIds.has(connectionId)) {
          hiddenConnectionIds.delete(connectionId)
        } else {
          hiddenConnectionIds.add(connectionId)
        }

        return {
          ...group,
          hiddenConnectionIds: Array.from(hiddenConnectionIds),
        }
      }),
    }))
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
              hiddenConnectionIds: group.hiddenConnectionIds?.filter(
                (hiddenId) => hiddenId !== connectionId,
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
    setAdditionalArrivalsByGroup((current) => {
      const next = { ...current }
      delete next[groupId]
      return next
    })
  }

  const activeDepartures = activeGroup
    ? departures[activeGroup.id]
    : undefined
  const isApiKeyMissing = !hasApiKey(appState.settings.apiKey)

  function openSettings(initialTab: SettingsTab = 'behavior'): void {
    setQuickSearchOpen(false)
    setSettingsInitialTab(initialTab)
    setSettingsOpen(true)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img
              alt="BKK"
              className="brand-logo"
              src={`${import.meta.env.BASE_URL}bkk-logo.jpg`}
            />
            <div>
              <div className="brand-name">BKK Figyelő</div>
              <div className="brand-caption">Indulás előtt egy pillantás</div>
            </div>
          </div>
          <div className="topbar-actions">
            {!settingsOpen && !quickSearchOpen && !isApiKeyMissing && (
              <button
                aria-label="Adatok frissítése"
                className={`header-refresh-button ${
                  isRefreshing ? 'is-spinning' : ''
                }`}
                disabled={isRefreshing || appState.groups.length === 0}
                onClick={() => void refreshAll()}
                type="button"
              >
                <Icon name="refresh" size={18} />
                <span>Frissítés</span>
              </button>
            )}
            <TopbarMenu
              onOpenQuickSearch={() => {
                setSettingsOpen(false)
                setQuickSearchOpen(true)
              }}
              onOpenSettings={() => openSettings()}
            />
          </div>
        </div>
      </header>

      <main className="main-content">
        {quickSearchOpen ? (
          <QuickSearchView
            apiKey={appState.settings.apiKey}
            arrivalsPerConnection={appState.settings.arrivalsPerConnection}
            onClose={() => setQuickSearchOpen(false)}
            onOpenSettings={() => openSettings('technical')}
          />
        ) : settingsOpen ? (
          <SettingsView
            apiKey={appState.settings.apiKey}
            arrivalsPerConnection={appState.settings.arrivalsPerConnection}
            groups={appState.groups}
            initialTab={settingsInitialTab}
            onApiKeyChange={(apiKey) => updateSettings({ apiKey })}
            onArrivalsPerConnectionChange={(arrivalsPerConnection) =>
              updateSettings({ arrivalsPerConnection })
            }
            onClose={() => setSettingsOpen(false)}
            onExportGroups={exportGroups}
            onImportGroups={importGroups}
            onRefreshIntervalChange={(refreshInterval) =>
              updateSettings({ refreshInterval })
            }
            refreshInterval={appState.settings.refreshInterval}
          />
        ) : isApiKeyMissing ? (
          <ApiKeyGate onOpenSettings={() => openSettings('technical')} />
        ) : (
          <>
            {appState.groups.length > 0 && (
              <GroupTabs
                activeGroupId={activeGroup?.id}
                groups={appState.groups}
                onAdd={() => openGroupModal()}
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

            {appState.groups.length === 0 ? (
              <EmptyDashboard onAdd={() => openGroupModal()} />
            ) : activeGroup ? (
              <GroupDashboard
                departures={activeDepartures}
                group={activeGroup}
                arrivalsPerConnection={appState.settings.arrivalsPerConnection}
                additionalArrivals={additionalArrivalsByGroup[activeGroup.id] ?? 0}
                isRefreshing={isRefreshing}
                now={now}
                onAddConnection={() => setModal('connection')}
                onDeleteConnection={removeConnection}
                onDeleteGroup={() => removeGroup(activeGroup.id)}
                onEditGroup={() => openGroupModal(activeGroup.id)}
                onLoadMoreArrivals={() => loadMoreArrivals(activeGroup.id)}
                onToggleConnectionVisibility={toggleConnectionVisibility}
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

      {!isApiKeyMissing && modal === 'group' && (
        <GroupModal
          initialName={
            editingGroupId
              ? appState.groups.find((group) => group.id === editingGroupId)
                  ?.name ?? ''
              : ''
          }
          isEditing={editingGroupId !== null}
          onClose={closeGroupModal}
          onSave={saveGroup}
        />
      )}
      {!isApiKeyMissing && modal === 'connection' && (
        <ConnectionModal
          apiKey={appState.settings.apiKey}
          existingConnections={activeGroup?.connections ?? []}
          onAdd={addConnection}
          onClose={() => setModal(null)}
          onOpenSettings={() => {
            setModal(null)
            openSettings('technical')
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
      <div className="empty-group-icon">
        <Icon name="train" size={28} />
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

function ApiKeyGate({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <section className="empty-dashboard api-key-gate">
      <div className="empty-group-icon api-key-gate-icon">
        <Icon name="settings" size={24} />
      </div>
      <p className="eyebrow">BKK FUTÁR kapcsolat</p>
      <h2>Először add meg az API-kulcsot</h2>
      <p className="empty-copy">
        Az alkalmazás használatához szükség van a BKK FUTÁR API-kulcsodra.
        Beállítás nélkül nem lehet csoportot vagy járatot hozzáadni.
      </p>
      <button className="primary-button" onClick={onOpenSettings} type="button">
        <Icon name="settings" size={17} />
        Beállítások megnyitása
        <Icon name="arrow" size={16} />
      </button>
    </section>
  )
}

function getAllArrivalsInWindow(
  connections: ConnectionDepartures[],
  arrivalsPerConnection: number,
): Arrival[] {
  const referenceArrivals = connections.flatMap((result) =>
    result.arrivals.slice(0, arrivalsPerConnection),
  )

  if (referenceArrivals.length === 0) {
    return []
  }

  const firstTimestamp = Math.min(
    ...referenceArrivals.map((arrival) => arrival.timestamp),
  )
  const lastTimestamp = Math.max(
    ...referenceArrivals.map((arrival) => arrival.timestamp),
  )

  return connections
    .flatMap((result) => result.arrivals)
    .filter(
      (arrival) =>
        arrival.timestamp >= firstTimestamp &&
        arrival.timestamp <= lastTimestamp,
    )
    .sort((a, b) => a.timestamp - b.timestamp)
}

function GroupDashboard({
  group,
  departures,
  arrivalsPerConnection,
  additionalArrivals,
  viewMode,
  now,
  isRefreshing,
  onAddConnection,
  onDeleteConnection,
  onDeleteGroup,
  onEditGroup,
  onLoadMoreArrivals,
  onToggleConnectionVisibility,
  onViewModeChange,
}: {
  group: CommuteGroup
  departures?: GroupDepartures
  arrivalsPerConnection: number
  additionalArrivals: number
  viewMode: ViewMode
  now: number
  isRefreshing: boolean
  onAddConnection: () => void
  onDeleteConnection: (connectionId: string) => void
  onDeleteGroup: () => void
  onEditGroup: () => void
  onLoadMoreArrivals: () => void
  onToggleConnectionVisibility: (
    groupId: string,
    connectionId: string,
  ) => void
  onViewModeChange: (viewMode: ViewMode) => void
}) {
  const hasData = departures !== undefined
  const [groupedSortMode, setGroupedSortMode] =
    useState<GroupedSortMode>('earliest')
  const hiddenConnectionIds = new Set(group.hiddenConnectionIds ?? [])
  const visibleDepartures = (departures?.connections ?? []).filter(
    (result) => !hiddenConnectionIds.has(result.connection.id),
  )
  const visibleArrivalsLimit = arrivalsPerConnection + additionalArrivals
  const visibleConnections = visibleDepartures.map((result) => ({
    ...result,
    arrivals: result.arrivals.slice(0, visibleArrivalsLimit),
  }))
  const visibleAllArrivals = getAllArrivalsInWindow(
    visibleDepartures,
    visibleArrivalsLimit,
  )
  const hasMoreArrivals =
    visibleDepartures.some(
      (result) => result.arrivals.length > visibleArrivalsLimit,
    ) ?? false

  return (
    <section className="group-dashboard">
      <div className="group-heading">
        <div>
          <p className="eyebrow">Aktív csoport</p>
          <div className="group-title-row">
            <h2>{group.name}</h2>
            <button
              aria-label="Csoport nevének szerkesztése"
              className="subtle-icon-button"
              onClick={onEditGroup}
              type="button"
            >
              <Icon name="edit" size={17} />
            </button>
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
            következő {arrivalsPerConnection} érkezést.
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

          <ConnectionVisibilityFilter
            connections={group.connections}
            hiddenConnectionIds={hiddenConnectionIds}
            onToggle={(connectionId) =>
              onToggleConnectionVisibility(group.id, connectionId)
            }
          />

          <DataStatus
            departures={departures}
            hasData={hasData}
            isRefreshing={isRefreshing}
          />

          {hasData && visibleDepartures.length === 0 ? (
            <div className="no-arrivals">
              <div className="no-arrivals-icon">
                <Icon name="eye" size={23} />
              </div>
              <strong>Minden járat el van rejtve</strong>
              <p>
                A lenyíló listában jelöld be azokat a járatokat, amelyeket
                látni szeretnél.
              </p>
            </div>
          ) : viewMode === 'all' ? (
            <AllArrivalsView
              arrivals={visibleAllArrivals}
              isRefreshing={isRefreshing || !hasData}
              now={now}
            />
          ) : (
            <GroupedArrivalsView
              connections={visibleConnections}
              isRefreshing={isRefreshing || !hasData}
              now={now}
              onDeleteConnection={onDeleteConnection}
              onSortModeChange={setGroupedSortMode}
              sortMode={groupedSortMode}
            />
          )}
          {hasMoreArrivals && (
            <button
              className="load-more-button"
              onClick={onLoadMoreArrivals}
              type="button"
            >
              <Icon name="plus" size={17} />
              További érkezések megjelenítése
            </button>
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
      <span>Automatikusan frissül, amíg nyitva van</span>
    </div>
  )
}

function AllArrivalsView({
  arrivals,
  heading = 'Legkorábban érkezik',
  now,
  isRefreshing,
}: {
  arrivals: Arrival[]
  heading?: string
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
        <span>{heading}</span>
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

function ConnectionVisibilityFilter({
  connections,
  hiddenConnectionIds,
  onToggle,
}: {
  connections: SavedConnection[]
  hiddenConnectionIds: Set<string>
  onToggle: (connectionId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const visibleCount = connections.filter(
    (connection) => !hiddenConnectionIds.has(connection.id),
  ).length
  const hiddenCount = connections.length - visibleCount

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !filterRef.current?.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="connection-filter" ref={filterRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`connection-filter-toggle ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Icon name="eye" size={16} />
        <span>Járatok megjelenítése</span>
        <span className="connection-filter-count">
          {visibleCount}/{connections.length}
        </span>
        <Icon name="chevron" size={15} />
      </button>
      {isOpen && (
        <div
          aria-label="Megjelenített járatok"
          className="connection-filter-menu"
          role="group"
        >
          <div className="connection-filter-heading">
            <span>Válaszd ki a listában látható járatokat</span>
            {hiddenCount > 0 && (
              <button
                className="connection-filter-reset"
                onClick={() =>
                  connections
                    .filter((connection) =>
                      hiddenConnectionIds.has(connection.id),
                    )
                    .forEach((connection) => onToggle(connection.id))
                }
                type="button"
              >
                Összes
              </button>
            )}
          </div>
          <div className="connection-filter-options">
            {connections.map((connection) => (
              <label
                className="connection-filter-option"
                key={connection.id}
              >
                <input
                  checked={!hiddenConnectionIds.has(connection.id)}
                  onChange={() => onToggle(connection.id)}
                  type="checkbox"
                />
                <span
                  aria-hidden="true"
                  className="connection-filter-color"
                  style={{
                    backgroundColor: getModeColor(
                      connection.routeType,
                      connection.routeColor,
                    ),
                  }}
                />
                <span className="connection-filter-copy">
                  <strong>{connection.routeName}</strong>
                  <span>
                    {connection.stopName}
                    {connection.stopDirection
                      ? ` · ${connection.stopDirection}`
                      : ''}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GroupedArrivalsView({
  connections,
  now,
  isRefreshing,
  onDeleteConnection,
  onSortModeChange,
  sortMode,
}: {
  connections: ConnectionDepartures[]
  now: number
  isRefreshing: boolean
  onDeleteConnection: (connectionId: string) => void
  onSortModeChange: (sortMode: GroupedSortMode) => void
  sortMode: GroupedSortMode
}) {
  if (isRefreshing && connections.length === 0) {
    return <LoadingList />
  }

  const sortedConnections = [...connections].sort((left, right) => {
    if (sortMode === 'routeName') {
      return left.connection.routeName.localeCompare(
        right.connection.routeName,
        'hu',
        { numeric: true, sensitivity: 'base' },
      )
    }

    return (
      (left.arrivals[0]?.timestamp ?? Number.POSITIVE_INFINITY) -
        (right.arrivals[0]?.timestamp ?? Number.POSITIVE_INFINITY) ||
      left.connection.routeName.localeCompare(right.connection.routeName, 'hu', {
        numeric: true,
        sensitivity: 'base',
      })
    )
  })

  return (
    <>
      <div className="grouped-sort-row">
        <label htmlFor="grouped-arrivals-sort">Rendezés</label>
        <span className="select-wrap grouped-sort-select">
          <select
            id="grouped-arrivals-sort"
            onChange={(event) =>
              onSortModeChange(event.target.value as GroupedSortMode)
            }
            value={sortMode}
          >
            <option value="earliest">Legkorábbi</option>
            <option value="routeName">Járat neve</option>
          </select>
          <Icon name="chevron" size={16} />
        </span>
      </div>
      <div className="connection-list">
        {sortedConnections.map((connectionResult) => (
          <ConnectionCard
            connectionResult={connectionResult}
            isRefreshing={isRefreshing}
            key={connectionResult.connection.id}
            now={now}
            onDelete={() => onDeleteConnection(connectionResult.connection.id)}
          />
        ))}
      </div>
    </>
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
        <span
          className={`arrival-mode ${
            arrival.isRealtime ? 'is-realtime' : 'is-scheduled'
          }`}
        >
          {arrival.isRealtime ? '● Valós idejű adat' : '○ Menetrend szerint'}
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
        <span
          className={`mini-arrival-status ${
            arrival.isRealtime ? 'is-realtime' : 'is-scheduled'
          }`}
        >
          {arrival.isRealtime ? '● Valós idő' : '○ Menetrend'}
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
        {type === 'TRAM' ? 'V' : type === 'SUBWAY' ? 'M' : type === 'TROLLEYBUS' ? 'TB' : 'B'}
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
  initialName,
  isEditing,
  onClose,
  onSave,
}: {
  initialName: string
  isEditing: boolean
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(initialName)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim()) {
      onSave(name.trim())
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={isEditing ? 'Csoport átnevezése' : 'Új csoport'}
    >
      <form autoComplete="off" className="modal-form" onSubmit={submit}>
        <p className="modal-intro">
          {isEditing
            ? 'Módosítsd a csoport nevét.'
            : 'Csoportosítsd azokat a járatokat, amelyeket ugyanazon az úton használsz.'}
        </p>
        <label className="field-label" htmlFor="group-label">
          Csoport neve
        </label>
        <input
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          className="text-input"
          id="group-label"
          name="group-label"
          onChange={(event) => setName(event.target.value)}
          placeholder="Például: Munkába menet"
          spellCheck={false}
          value={name}
        />
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Mégse
          </button>
          <button className="primary-button" disabled={!name.trim()} type="submit">
            {isEditing ? 'Mentés' : 'Létrehozás'}
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
  const [routeStops, setRouteStops] = useState<RouteStopsResult>()
  const [selectedDirectionId, setSelectedDirectionId] = useState('')
  const [selectedRoute, setSelectedRoute] = useState<RouteReference>()
  const [selectedStop, setSelectedStop] = useState<RouteStopOption>()
  const [searching, setSearching] = useState(false)
  const [loadingStops, setLoadingStops] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!selectedRoute || !hasApiKey(apiKey)) {
      setRouteStops(undefined)
      setSelectedDirectionId('')
      setSelectedStop(undefined)
      setLoadingStops(false)
      return
    }

    let cancelled = false
    setRouteStops(undefined)
    setSelectedDirectionId('')
    setSelectedStop(undefined)
    setLoadingStops(true)
    setError('')

    void getStopsForRoute(selectedRoute.id, apiKey)
      .then((result) => {
        if (!cancelled) {
          setRouteStops(result)
          if (result.directions.length === 0 || result.stops.length === 0) {
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

  const selectedDirectionStops = useMemo(
    () =>
      routeStops?.stops.filter(
        (option) => option.directionId === selectedDirectionId,
      ) ?? [],
    [routeStops, selectedDirectionId],
  )

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
      setRouteResults(
        filterRoutesByQuery(
          getRoutes(response.data?.references),
          query,
        ),
      )
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
      <form
        autoComplete="off"
        className="modal-form connection-form"
        onSubmit={submit}
      >
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
                      setRouteStops(undefined)
                      setSelectedDirectionId('')
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
              <RouteDirectionSelect
                directions={routeStops?.directions ?? []}
                loading={loadingStops}
                onChange={(value) => {
                  setSelectedDirectionId(value)
                  setSelectedStop(undefined)
                }}
                selectedValue={selectedDirectionId}
              />
            )}

            {selectedRoute && selectedDirectionId && (
              <RouteStopsSelect
                loading={loadingStops}
                onChange={(value) =>
                  setSelectedStop(
                    selectedDirectionStops.find(
                      (option) => option.value === value,
                    ),
                  )
                }
                options={selectedDirectionStops}
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
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          className="text-input"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSearch()
            }
          }}
          placeholder={placeholder}
          spellCheck={false}
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

function RouteDirectionSelect({
  directions,
  selectedValue,
  loading,
  onChange,
}: {
  directions: RouteStopsResult['directions']
  selectedValue: string
  loading: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="select-field">
      <span className="field-label">Irány / végállomás</span>
      {loading ? (
        <div className="select-loading">
          <Icon name="refresh" size={16} />
          Irányok betöltése…
        </div>
      ) : directions.length === 0 ? (
        <div className="select-empty">Nincs választható irány.</div>
      ) : (
        <span className="select-wrap">
          <select
            onChange={(event) => onChange(event.target.value)}
            value={selectedValue}
          >
            <option value="">Válassz végállomást…</option>
            {directions.map((direction) => (
              <option key={direction.id} value={direction.id}>
                {direction.label}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={17} />
        </span>
      )}
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
  const routeDescription = (route.description || route.longName)
    ?.split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ↔ ')

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
        <span>{getModeLabel(route.type ?? 'BUS')}</span>
        {routeDescription && (
          <span className="search-result-route">{routeDescription}</span>
        )}
      </span>
      {isSelected && <Icon name="check" size={17} />}
    </button>
  )
}

function useBodyScrollLock(): void {
  useEffect(() => {
    const scrollY = window.scrollY
    const body = document.body
    const documentElement = document.documentElement

    body.style.setProperty('--modal-scroll-top', `-${scrollY}px`)
    body.classList.add('modal-open')
    documentElement.classList.add('modal-open')

    return () => {
      body.classList.remove('modal-open')
      documentElement.classList.remove('modal-open')
      body.style.removeProperty('--modal-scroll-top')
      window.scrollTo(0, scrollY)
    }
  }, [])
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
  useBodyScrollLock()

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

function QuickSearchView({
  apiKey,
  arrivalsPerConnection,
  onClose,
  onOpenSettings,
}: {
  apiKey: string
  arrivalsPerConnection: number
  onClose: () => void
  onOpenSettings: () => void
}) {
  const [routeQuery, setRouteQuery] = useState('')
  const [routeResults, setRouteResults] = useState<RouteReference[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [routeStops, setRouteStops] = useState<RouteStopsResult>()
  const [selectedDirectionId, setSelectedDirectionId] = useState('')
  const [selectedRoute, setSelectedRoute] = useState<RouteReference>()
  const [selectedStop, setSelectedStop] = useState<RouteStopOption>()
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingStops, setLoadingStops] = useState(false)
  const [loadingArrivals, setLoadingArrivals] = useState(false)
  const [additionalArrivals, setAdditionalArrivals] = useState(0)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const visibleArrivalsLimit = arrivalsPerConnection + additionalArrivals
  const visibleArrivals = arrivals.slice(0, visibleArrivalsLimit)
  const hasMoreArrivals = arrivals.length > visibleArrivalsLimit

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedRoute || !hasApiKey(apiKey)) {
      setRouteStops(undefined)
      setSelectedDirectionId('')
      setSelectedStop(undefined)
      setLoadingStops(false)
      return
    }

    let cancelled = false
    setRouteStops(undefined)
    setSelectedDirectionId('')
    setSelectedStop(undefined)
    setLoadingStops(true)
    setError('')

    void getStopsForRoute(selectedRoute.id, apiKey)
      .then((result) => {
        if (!cancelled) {
          setRouteStops(result)
          if (result.directions.length === 0 || result.stops.length === 0) {
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

  const selectedDirectionStops = useMemo(
    () =>
      routeStops?.stops.filter(
        (option) => option.directionId === selectedDirectionId,
      ) ?? [],
    [routeStops, selectedDirectionId],
  )

  useEffect(() => {
    if (!selectedRoute || !selectedStop || !hasApiKey(apiKey)) {
      setArrivals([])
      setAdditionalArrivals(0)
      setLoadingArrivals(false)
      return
    }

    let cancelled = false
    const connection: SavedConnection = {
      id: `quick-search-${selectedRoute.id}-${selectedStop.stop.id}`,
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

    setArrivals([])
    setAdditionalArrivals(0)
    setLoadingArrivals(true)
    setError('')

    void Promise.all([
      getArrivalsForConnection(connection, apiKey),
      getTripRouteIdsForStop(connection.stopId, apiKey),
    ])
      .then(([response, tripRouteIds]) => {
        if (!cancelled) {
          setArrivals(
            mapArrivalsForConnection(connection, response, tripRouteIds),
          )
        }
      })
      .catch((arrivalError) => {
        if (!cancelled) {
          setError(getErrorMessage(arrivalError))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingArrivals(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [apiKey, selectedRoute, selectedStop])

  async function search(query: string): Promise<void> {
    if (!query.trim()) {
      setHasSearched(false)
      setRouteResults([])
      return
    }

    if (!hasApiKey(apiKey)) {
      setError('A kereséshez előbb add meg a BKK API-kulcsot a beállításokban.')
      return
    }

    setSearching(true)
    setHasSearched(true)
    setError('')
    try {
      const response = await searchTransit(query, apiKey)
      setRouteResults(
        filterRoutesByQuery(getRoutes(response.data?.references), query),
      )
    } catch (searchError) {
      setError(getErrorMessage(searchError))
    } finally {
      setSearching(false)
    }
  }

  return (
    <section className="settings-view quick-search-view">
      <div className="settings-heading">
        <button className="back-button" onClick={onClose} type="button">
          <Icon name="arrow" size={18} />
          Vissza
        </button>
        <p className="eyebrow">Gyors elérés</p>
        <h1>Gyors keresés</h1>
        <p>
          Keress egy járatot, válaszd ki az irányt és a megállót. A keresés
          eredményeit nem mentjük el csoportként.
        </p>
      </div>

      {!hasApiKey(apiKey) ? (
        <div className="settings-card quick-search-key-card">
          <div className="settings-card-heading">
            <div className="settings-card-icon">
              <Icon name="settings" size={19} />
            </div>
            <div>
              <h2>API-kulcs szükséges</h2>
              <p>A BKK élő adatainak lekéréséhez add meg az API-kulcsot.</p>
            </div>
          </div>
          <button
            className="primary-button"
            onClick={onOpenSettings}
            type="button"
          >
            Beállítások megnyitása
            <Icon name="arrow" size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="settings-card quick-search-form-card">
            <SearchField
              label="Járat keresése"
              onChange={setRouteQuery}
              onSearch={() => void search(routeQuery)}
              placeholder="Például: 4, M3 vagy 105"
              query={routeQuery}
              searching={searching}
            />
            {hasSearched && (
              <SearchResultList
                emptyLabel="Nem találtam járatot."
                items={routeResults}
                renderItem={(route) => (
                  <SearchRouteResult
                    isSelected={selectedRoute?.id === route.id}
                    onClick={() => {
                      setSelectedRoute(route)
                      setRouteStops(undefined)
                      setSelectedDirectionId('')
                      setSelectedStop(undefined)
                      setArrivals([])
                      setAdditionalArrivals(0)
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
              <RouteDirectionSelect
                directions={routeStops?.directions ?? []}
                loading={loadingStops}
                onChange={(value) => {
                  setSelectedDirectionId(value)
                  setSelectedStop(undefined)
                }}
                selectedValue={selectedDirectionId}
              />
            )}
            {selectedRoute && selectedDirectionId && (
              <RouteStopsSelect
                loading={loadingStops}
                onChange={(value) =>
                  setSelectedStop(
                    selectedDirectionStops.find(
                      (option) => option.value === value,
                    ),
                  )
                }
                options={selectedDirectionStops}
                selectedValue={selectedStop?.value ?? ''}
              />
            )}
          </div>

          {selectedStop && (
            <div className="settings-card quick-search-results-card">
              <div className="settings-card-heading">
                <div className="settings-card-icon muted">
                  <Icon name="train" size={19} />
                </div>
                <div>
                  <h2>Következő indulások</h2>
                  <p>
                    {getRouteName(selectedRoute!)} ·{' '}
                    {getStopName(selectedStop.stop)}
                  </p>
                </div>
              </div>
              <AllArrivalsView
                arrivals={visibleArrivals}
                heading="Következő indulások"
                isRefreshing={loadingArrivals}
                now={now}
              />
              {hasMoreArrivals && (
                <button
                  className="load-more-button"
                  onClick={() =>
                    setAdditionalArrivals(
                      (current) => current + ARRIVALS_LOAD_MORE_STEP,
                    )
                  }
                  type="button"
                >
                  <Icon name="plus" size={17} />
                  További indulások megjelenítése
                </button>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="form-error">{error}</p>}
    </section>
  )
}

function SettingsView({
  apiKey,
  arrivalsPerConnection,
  groups,
  initialTab,
  refreshInterval,
  onApiKeyChange,
  onArrivalsPerConnectionChange,
  onRefreshIntervalChange,
  onClose,
  onExportGroups,
  onImportGroups,
}: {
  apiKey: string
  arrivalsPerConnection: number
  groups: CommuteGroup[]
  initialTab: SettingsTab
  refreshInterval: number
  onApiKeyChange: (value: string) => void
  onArrivalsPerConnectionChange: (value: number) => void
  onRefreshIntervalChange: (value: number) => void
  onClose: () => void
  onExportGroups: () => void
  onImportGroups: (file: File) => Promise<number>
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
  const [isImporting, setIsImporting] = useState(false)
  const [transferNotice, setTransferNotice] = useState<{
    kind: 'error' | 'success'
    message: string
  } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  async function handleImportChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const input = event.currentTarget
    const file = input.files?.[0]

    if (!file) {
      return
    }

    setIsImporting(true)
    setTransferNotice(null)

    try {
      const importedCount = await onImportGroups(file)
      setTransferNotice({
        kind: 'success',
        message: `${importedCount} járatcsoport sikeresen importálva.`,
      })
    } catch (error) {
      setTransferNotice({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Az importálás nem sikerült.',
      })
    } finally {
      setIsImporting(false)
      input.value = ''
    }
  }

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

      <div className="settings-tabs" role="tablist" aria-label="Beállítások">
        <button
          aria-selected={activeTab === 'behavior'}
          className={activeTab === 'behavior' ? 'is-active' : ''}
          onClick={() => setActiveTab('behavior')}
          role="tab"
          type="button"
        >
          Megjelenítés
        </button>
        <button
          aria-selected={activeTab === 'technical'}
          className={activeTab === 'technical' ? 'is-active' : ''}
          onClick={() => setActiveTab('technical')}
          role="tab"
          type="button"
        >
          Konfiguráció
        </button>
      </div>

      {activeTab === 'technical' ? (
        <>
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
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              className="text-input"
              id="api-key"
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder="Illeszd be a BKK API-kulcsot"
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <p className="field-help">
              A kulcsot a böngésző localStorage-a tárolja. A GitHub Pages nem
              tudja titkosan kezelni a frontendbe bekerülő kulcsot.
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
          <div className="settings-card">
            <div className="settings-card-heading">
              <div className="settings-card-icon">
                <Icon name="download" size={19} />
              </div>
              <div>
                <h2>Járatcsoportok átvitele</h2>
                <p>Mentés fájlba vagy beolvasás másik eszközről</p>
              </div>
            </div>
            <div className="transfer-actions">
              <button
                className="secondary-button"
                disabled={groups.length === 0}
                onClick={onExportGroups}
                type="button"
              >
                <Icon name="download" size={17} />
                Járatok exportálása
              </button>
              <button
                className="secondary-button"
                disabled={isImporting}
                onClick={() => importInputRef.current?.click()}
                type="button"
              >
                <Icon name="upload" size={17} />
                Járatok importálása
              </button>
              <input
                ref={importInputRef}
                accept=".json,application/json"
                autoComplete="off"
                className="visually-hidden"
                onChange={(event) => void handleImportChange(event)}
                type="file"
              />
            </div>
            {transferNotice && (
              <p
                aria-live="polite"
                className={`transfer-status is-${transferNotice.kind}`}
                role={transferNotice.kind === 'error' ? 'alert' : 'status'}
              >
                {transferNotice.message}
              </p>
            )}
            <p className="field-help">
              Az exportált JSON csak a csoportokat és a mentett járatokat
              tartalmazza, az API-kulcsot nem.
            </p>
          </div>
        </>
      ) : (
        <div className="settings-card">
          <div className="settings-card-heading">
            <div className="settings-card-icon muted">
              <Icon name="train" size={19} />
            </div>
            <div>
              <h2>Megjelenített indulások</h2>
              <p>Ennyi érkezést mutassunk járatonként</p>
            </div>
          </div>
          <div className="interval-options">
            {ARRIVALS_PER_CONNECTION_OPTIONS.map((count) => (
              <button
                className={
                  arrivalsPerConnection === count ? 'is-active' : ''
                }
                key={count}
                onClick={() => onArrivalsPerConnectionChange(count)}
                type="button"
              >
                {count} db
              </button>
            ))}
          </div>
          <p className="field-help">
            A csoport nézetében a „További érkezések megjelenítése” gombbal
            ennél is több találatot kérhetsz.
          </p>
        </div>
      )}

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
