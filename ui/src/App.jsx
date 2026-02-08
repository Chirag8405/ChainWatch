import { useState, useEffect, useRef } from 'react'
import { Activity, Wallet, X, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import Portfolio from './Portfolio'
import WalletConnect from './components/WalletConnect'
import TransactionExecutor from './components/TransactionExecutor'
import ContractVerifier from './components/ContractVerifier'
import AlertRulesManager from './components/AlertRulesManager'
import HistoricalAnalytics from './components/HistoricalAnalytics'
import Sidebar from './components/Sidebar'
import WelcomePage from './components/WelcomePage'
import DashboardPage from './components/DashboardPage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3002' : '')
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws'

function App() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)

  // Wallet state
  const [connectedWallet, setConnectedWallet] = useState(null)
  const [connectedChainId, setConnectedChainId] = useState(null)
  const [watchedWallets, setWatchedWallets] = useState([])
  const [newWalletAddress, setNewWalletAddress] = useState('')
  const [showWatchForm, setShowWatchForm] = useState(false)

  // Events state
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('all')

  // UI state
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  // WebSocket Connection
  useEffect(() => {
    connectWebSocket()
    fetchWallets()

    return () => {
      if (wsRef.current) wsRef.current.close()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }
  }, [])

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setReconnectAttempt(0)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'event') {
            setEvents(prev => [data.event, ...prev])
          } else if (data.type === 'config_update' && data.config) {
            setWatchedWallets(data.config.watchedWallets || [])
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)

        // Attempt to reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt(prev => prev + 1)
          connectWebSocket()
        }, 5000)
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }

  const fetchWallets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/config`)
      const data = await response.json()
      setWatchedWallets(data.watchedWallets || [])
    } catch (error) {
      console.error('Failed to fetch wallets:', error)
    }
  }

  const handleWalletChange = (account, chainId) => {
    setConnectedWallet(account)
    setConnectedChainId(chainId)
    if (account) {
      setCurrentPage('dashboard')
    } else {
      // Reset to welcome page when wallet is disconnected
      setCurrentPage('dashboard')
    }
  }

  const addWallet = async () => {
    if (!newWalletAddress) return

    if (!/^0x[a-fA-F0-9]{40}$/.test(newWalletAddress)) {
      alert('Invalid Ethereum address format')
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: newWalletAddress })
      })

      if (response.ok) {
        setNewWalletAddress('')
        setShowWatchForm(false)
        await fetchWallets()
      }
    } catch (error) {
      console.error('Failed to add wallet:', error)
    }
  }

  const removeWallet = async (address) => {
    if (!confirm('Remove this wallet from watchlist?')) return

    try {
      const response = await fetch(`${API_URL}/api/wallets/${encodeURIComponent(address)}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchWallets()
      }
    } catch (error) {
      console.error('Failed to remove wallet:', error)
    }
  }

  // Filter events
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true
    return event.direction === filter
  })

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp)
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Show Welcome Page if no wallet connected */}
      {!connectedWallet ? (
        <WelcomePage onWalletConnect={handleWalletChange} />
      ) : (
        <>
          {/* Sidebar */}
          <Sidebar
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            connectedWallet={connectedWallet}
          />

          {/* Main Content */}
          <div className="lg:pl-64">
            {/* Top Header */}
            <header className="sticky top-0 z-20 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {currentPage === 'dashboard' && 'Dashboard'}
                    {currentPage === 'transactions' && 'Send Transaction'}
                    {currentPage === 'verify' && 'Verify Contract'}
                    {currentPage === 'alerts' && 'Alert Rules'}
                    {currentPage === 'analytics' && 'Analytics'}
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {isConnected ? 'Connected to Sepolia' : 'Disconnected'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* Connection Status */}
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-zinc-400">
                      {isConnected ? 'Live' : 'Offline'}
                    </span>
                  </div>
                  <WalletConnect onWalletChange={handleWalletChange} />
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="p-6">
              {/* Dashboard Page */}
              {currentPage === 'dashboard' && (
                <>
                  <DashboardPage
                    connectedWallet={connectedWallet}
                    watchedWallets={watchedWallets}
                    events={sortedEvents}
                    stats={{
                      totalEvents: sortedEvents.length,
                      incomingCount: sortedEvents.filter(e => e.direction === 'incoming').length,
                      outgoingCount: sortedEvents.filter(e => e.direction === 'outgoing').length,
                    }}
                    setCurrentPage={setCurrentPage}
                  />

                  {/* Watched Wallets Manager */}
                  <div className="mt-6">
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-white">Watched Wallets</CardTitle>
                            <CardDescription className="text-zinc-400">
                              Monitor these addresses for activity
                            </CardDescription>
                          </div>
                          <Button
                            onClick={() => setShowWatchForm(!showWatchForm)}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {showWatchForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            {showWatchForm ? 'Cancel' : 'Add Wallet'}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {showWatchForm && (
                          <div className="mb-4 p-4 rounded-lg bg-zinc-800 border border-zinc-700">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="0x... wallet address"
                                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={newWalletAddress}
                                onChange={(e) => setNewWalletAddress(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addWallet()}
                              />
                              <Button onClick={addWallet} className="bg-blue-600 hover:bg-blue-700">
                                Add
                              </Button>
                            </div>
                          </div>
                        )}

                        {watchedWallets.length === 0 ? (
                          <div className="text-center py-8 text-zinc-500">
                            <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No wallets being monitored</p>
                            <p className="text-sm mt-1">Add wallet addresses to start tracking transactions</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {watchedWallets.map((wallet) => {
                              const address = typeof wallet === 'string' ? wallet : wallet.address;
                              const label = typeof wallet === 'object' ? wallet.label : null;
                              return (
                                <div
                                  key={address}
                                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="h-8 w-8 rounded-full bg-blue-600/10 flex items-center justify-center shrink-0">
                                      <Wallet className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      {label && <p className="text-xs text-zinc-500">{label}</p>}
                                      <span className="font-mono text-sm text-white truncate block">{address}</span>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeWallet(address)}
                                    className="shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Live Events Feed */}
                  <div className="mt-6">
                    <Card className="bg-zinc-900 border-zinc-800">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-white flex items-center gap-2">
                              <Activity className="h-5 w-5" />
                              Live Transaction Feed
                            </CardTitle>
                            <CardDescription className="text-zinc-400">
                              Real-time blockchain activity
                            </CardDescription>
                          </div>
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            {sortedEvents.length} events
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Filters */}
                        <div className="mb-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={filter === 'all' ? 'default' : 'outline'}
                            onClick={() => setFilter('all')}
                            className={filter === 'all' ? 'bg-blue-600 hover:bg-blue-700' : 'border-zinc-700 text-zinc-400'}
                          >
                            All
                          </Button>
                          <Button
                            size="sm"
                            variant={filter === 'incoming' ? 'default' : 'outline'}
                            onClick={() => setFilter('incoming')}
                            className={filter === 'incoming' ? 'bg-green-600 hover:bg-green-700' : 'border-zinc-700 text-zinc-400'}
                          >
                            Incoming
                          </Button>
                          <Button
                            size="sm"
                            variant={filter === 'outgoing' ? 'default' : 'outline'}
                            onClick={() => setFilter('outgoing')}
                            className={filter === 'outgoing' ? 'bg-orange-600 hover:bg-orange-700' : 'border-zinc-700 text-zinc-400'}
                          >
                            Outgoing
                          </Button>
                        </div>

                        {/* Events List */}
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {sortedEvents.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500">
                              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p>No transactions yet</p>
                              <p className="text-sm mt-1">Start monitoring wallets to see live activity</p>
                            </div>
                          ) : (
                            sortedEvents.map((event, index) => (
                              <div
                                key={event.hash || event.timestamp || index}
                                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                              >
                                <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${event.direction === 'incoming' ? 'bg-green-500/10' : 'bg-orange-500/10'
                                  }`}>
                                  <div className={`h-2 w-2 rounded-full ${event.direction === 'incoming' ? 'bg-green-500' : 'bg-orange-500'
                                    }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge className={
                                      event.direction === 'incoming'
                                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                        : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                    }>
                                      {event.direction}
                                    </Badge>
                                    <span className="text-xs text-zinc-500">{event.timestamp}</span>
                                  </div>
                                  <p className="text-sm font-mono text-white">{event.value} ETH</p>
                                  <p className="text-xs text-zinc-400 truncate">
                                    {event.direction === 'incoming' ? 'From' : 'To'}: {event.counterparty}
                                  </p>
                                </div>
                                <a
                                  href={`https://sepolia.etherscan.io/tx/${event.hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
                                >
                                  View →
                                </a>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Portfolio Component */}
                  <div className="mt-6">
                    <Portfolio
                      events={sortedEvents}
                      watchedWallets={watchedWallets}
                      connectedWallet={connectedWallet}
                    />
                  </div>
                </>
              )}

              {/* Transactions Page */}
              {currentPage === 'transactions' && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white">Send Transaction</CardTitle>
                    <CardDescription className="text-zinc-400">
                      Execute ETH or token transfers from your wallet
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TransactionExecutor connectedWallet={connectedWallet} chainId={connectedChainId} />
                  </CardContent>
                </Card>
              )}

              {/* Verify Page */}
              {currentPage === 'verify' && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white">Verify Contract</CardTitle>
                    <CardDescription className="text-zinc-400">
                      Verify smart contracts on Etherscan
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ContractVerifier chainId={connectedChainId} />
                  </CardContent>
                </Card>
              )}

              {/* Alerts Page */}
              {currentPage === 'alerts' && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white">Alert Rules</CardTitle>
                    <CardDescription className="text-zinc-400">
                      Configure custom conditions for notifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertRulesManager />
                  </CardContent>
                </Card>
              )}

              {/* Analytics Page */}
              {currentPage === 'analytics' && (
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white">Historical Analytics</CardTitle>
                    <CardDescription className="text-zinc-400">
                      Search and export transaction history
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HistoricalAnalytics />
                  </CardContent>
                </Card>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  )
}

export default App
