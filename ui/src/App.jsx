import { useState, useEffect, useRef } from 'react'

// WebSocket URL - use relative path for production, full URL for development
const WS_URL = import.meta.env.DEV 
  ? 'ws://localhost:3001/ws' 
  : `ws://${window.location.host}/ws`

const API_URL = import.meta.env.DEV ? 'http://localhost:3001' : ''

// Token logos/icons
const TokenLogo = ({ type, size = 24 }) => {
  if (type === 'eth') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ verticalAlign: 'middle' }}>
        <g fill="none" fillRule="evenodd">
          <circle cx="16" cy="16" r="16" fill="#627EEA"/>
          <g fill="#FFF" fillRule="nonzero">
            <path fillOpacity=".602" d="M16.498 4v8.87l7.497 3.35z"/>
            <path d="M16.498 4L9 16.22l7.498-3.35z"/>
            <path fillOpacity=".602" d="M16.498 21.968v6.027L24 17.616z"/>
            <path d="M16.498 27.995v-6.028L9 17.616z"/>
            <path fillOpacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z"/>
            <path fillOpacity=".602" d="M9 16.22l7.498 4.353v-7.701z"/>
          </g>
        </g>
      </svg>
    )
  }
  // LINK logo
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ verticalAlign: 'middle' }}>
      <g fill="none">
        <circle cx="16" cy="16" r="16" fill="#2A5ADA"/>
        <path d="M16 6l-1.799 1.055L9 10.556l-1.799 1.055v8.778L9 21.444l5.201 3.5L16 26l1.799-1.056 5.201-3.5 1.799-1.055v-8.778L23 10.556l-5.201-3.5L16 6zm-3.6 14.389l-1.799-1.056v-6.666l1.799-1.056L16 8.778v4.944l-3.6 2.167v4.5zm7.2 0L16 23.222v-4.944l3.6-2.167v-4.5l1.799 1.056 1.799 1.056v6.666l-1.799 1.056L19.6 20.389z" fill="#FFF"/>
      </g>
    </svg>
  )
}

function App() {
  // State
  const [connected, setConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [events, setEvents] = useState([])
  const [config, setConfig] = useState({
    threshold: 0,
    watchedWallets: [],
    watchedWalletsCount: 0,
    cooldown: 0,
    tokenContract: '',
    trackingMode: 'all'
  })
  const [lastAlert, setLastAlert] = useState(null)
  const [viewFilter, setViewFilter] = useState('all') // 'all', 'eth', 'token', or wallet address
  const [showWalletManager, setShowWalletManager] = useState(false)
  const [newWalletAddress, setNewWalletAddress] = useState('')
  const [newWalletLabel, setNewWalletLabel] = useState('')
  const [walletError, setWalletError] = useState('')
  const [addingWallet, setAddingWallet] = useState(false)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  // Connect to WebSocket
  useEffect(() => {
    connectWebSocket()
    fetchStatus()
    fetchWallets()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnected(true)
        setConnectionStatus('connected')
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setConnected(false)
        setConnectionStatus('disconnected')
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Reconnecting...')
          setConnectionStatus('connecting')
          connectWebSocket()
        }, 3000)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleMessage(message)
        } catch (e) {
          console.error('Failed to parse message:', e)
        }
      }
    } catch (error) {
      console.error('Failed to connect:', error)
      setConnectionStatus('disconnected')
    }
  }

  const handleMessage = (message) => {
    switch (message.type) {
      case 'welcome':
        console.log('Welcome message received', message.config)
        if (message.config) {
          setConfig(prev => ({
            ...prev,
            watchedWallets: message.config.watchedWallets || [],
            trackingMode: message.config.trackingMode || 'all',
            threshold: message.config.thresholdAmount || 0,
            cooldown: message.config.cooldownSeconds || 0,
            tokenContract: message.config.tokenContract || ''
          }))
        }
        break
        
      case 'transfer':
        setEvents(prev => {
          const newEvents = [{
            ...message.data.event,
            filterResult: message.data.filterResult,
            timestamp: message.timestamp
          }, ...prev]
          return newEvents.slice(0, 50)
        })
        break
        
      case 'connection':
        setConnectionStatus(message.data.status)
        break
        
      case 'configChange':
        setConfig(prev => ({
          ...prev,
          threshold: message.data.newConfig.thresholdAmount,
          watchedWallets: message.data.newConfig.watchedWallets || [],
          watchedWalletsCount: message.data.newConfig.watchedWalletsCount,
          cooldown: message.data.newConfig.cooldownSeconds,
          tokenContract: message.data.newConfig.tokenContract,
          trackingMode: message.data.newConfig.trackingMode || 'all'
        }))
        fetchWallets() // Refresh wallets on config change
        break
        
      case 'alertSent':
        setLastAlert({
          transactionHash: message.data.transactionHash,
          amount: message.data.amount,
          timestamp: message.data.timestamp
        })
        break
        
      default:
        console.log('Unknown message type:', message.type)
    }
  }

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/config`)
      if (response.ok) {
        const data = await response.json()
        setConfig({
          threshold: data.thresholdAmount,
          watchedWallets: data.watchedWallets || [],
          watchedWalletsCount: data.watchedWalletsCount,
          cooldown: data.cooldownSeconds,
          tokenContract: data.tokenContract,
          trackingMode: data.trackingMode || 'all'
        })
      }
    } catch (error) {
      console.error('Failed to fetch status:', error)
    }
  }

  const fetchWallets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/wallets`)
      if (response.ok) {
        const data = await response.json()
        setConfig(prev => ({
          ...prev,
          watchedWallets: data.wallets || [],
          watchedWalletsCount: data.count
        }))
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error)
    }
  }

  const addWallet = async () => {
    setWalletError('')
    
    if (!newWalletAddress) {
      setWalletError('Please enter a wallet address')
      return
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(newWalletAddress)) {
      setWalletError('Invalid Ethereum address format')
      return
    }

    setAddingWallet(true)
    
    try {
      const response = await fetch(`${API_URL}/api/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: newWalletAddress, 
          label: newWalletLabel || undefined 
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setWalletError(data.error || 'Failed to add wallet')
        return
      }
      
      // Success - clear form and refresh
      setNewWalletAddress('')
      setNewWalletLabel('')
      await fetchWallets()
    } catch (error) {
      setWalletError('Network error. Please try again.')
    } finally {
      setAddingWallet(false)
    }
  }

  const removeWallet = async (address) => {
    if (!confirm('Remove this wallet from watchlist?')) return
    
    try {
      const response = await fetch(`${API_URL}/api/wallets/${address}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await fetchWallets()
      }
    } catch (error) {
      console.error('Failed to remove wallet:', error)
    }
  }

  const toggleWallet = async (address, currentEnabled) => {
    try {
      await fetch(`${API_URL}/api/wallets/${address}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      })
      await fetchWallets()
    } catch (error) {
      console.error('Failed to toggle wallet:', error)
    }
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  // Get wallet address from wallet object (handles both string and object formats)
  const getWalletAddress = (wallet) => {
    return typeof wallet === 'string' ? wallet : wallet.address
  }

  // Check if event involves a specific wallet
  const isWalletEvent = (event, walletAddress) => {
    const addr = walletAddress.toLowerCase()
    return event.from?.toLowerCase() === addr || event.to?.toLowerCase() === addr
  }

  // Check if event involves any watched wallet
  const isWatchedWalletEvent = (event) => {
    if (!config.watchedWallets || config.watchedWallets.length === 0) return false
    return config.watchedWallets.some(w => {
      const addr = getWalletAddress(w).toLowerCase()
      return event.from?.toLowerCase() === addr || event.to?.toLowerCase() === addr
    })
  }

  // Filter events based on view filter
  const filteredEvents = events.filter(event => {
    if (viewFilter === 'all') return true
    if (viewFilter === 'eth') return event.type === 'eth'
    if (viewFilter === 'token') return event.type === 'token'
    // Filter by specific wallet address
    if (viewFilter.startsWith('0x')) {
      return isWalletEvent(event, viewFilter)
    }
    return true
  })

  // Count events by type
  const ethCount = events.filter(e => e.type === 'eth').length
  const tokenCount = events.filter(e => e.type === 'token').length

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>ChainWatch</h1>
        <p>Real-time ETH & Token Transfer Monitor • Sepolia Testnet</p>
      </header>

      {/* Section A: Connection Status */}
      <section className="status-section">
        <div className="section-header">Connection Status</div>
        <div className="status-row">
          <div className={`status-indicator ${connectionStatus}`}></div>
          <div className="status-text">
            {connectionStatus === 'connected' && (
              <><strong>Connected</strong> — Listening to Sepolia Transfers</>
            )}
            {connectionStatus === 'disconnected' && (
              <><strong>Disconnected</strong> — Attempting to reconnect...</>
            )}
            {connectionStatus === 'connecting' && (
              <><strong>Connecting</strong> — Establishing connection...</>
            )}
            {connectionStatus === 'error' && (
              <><strong>Error</strong> — Connection failed</>
            )}
          </div>
        </div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#8b949e', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            Mode: <strong style={{ color: '#58a6ff' }}>{config.trackingMode?.toUpperCase()}</strong>
          </span>
          {config.tokenContract && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <TokenLogo type="token" size={16} />
              <code style={{ color: '#58a6ff' }}>{formatAddress(config.tokenContract)}</code>
            </span>
          )}
        </div>
      </section>

      {/* Wallet Manager Section */}
      <section className="wallet-section">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Watched Wallets ({config.watchedWallets?.length || 0})</span>
          <button 
            className="toggle-btn"
            onClick={() => setShowWalletManager(!showWalletManager)}
          >
            {showWalletManager ? '▲ Hide' : '▼ Manage'}
          </button>
        </div>
        
        {showWalletManager && (
          <div className="wallet-manager">
            {/* Add Wallet Form */}
            <div className="add-wallet-form">
              <input
                type="text"
                placeholder="0x... wallet address"
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                className="wallet-input"
              />
              <input
                type="text"
                placeholder="Label (optional)"
                value={newWalletLabel}
                onChange={(e) => setNewWalletLabel(e.target.value)}
                className="wallet-input label-input"
              />
              <button 
                onClick={addWallet} 
                disabled={addingWallet}
                className="add-wallet-btn"
              >
                {addingWallet ? '...' : '+ Add'}
              </button>
            </div>
            {walletError && <div className="wallet-error">{walletError}</div>}
            
            {/* Wallet List */}
            <div className="wallet-list">
              {config.watchedWallets?.length === 0 ? (
                <div className="no-wallets">No wallets being watched</div>
              ) : (
                config.watchedWallets.map((wallet, index) => {
                  const addr = getWalletAddress(wallet)
                  const label = typeof wallet === 'object' ? wallet.label : `Wallet ${index + 1}`
                  const enabled = typeof wallet === 'object' ? wallet.enabled !== false : true
                  const eventCount = events.filter(e => isWalletEvent(e, addr)).length
                  
                  return (
                    <div key={addr} className={`wallet-item ${enabled ? '' : 'disabled'}`}>
                      <div className="wallet-info">
                        <div className="wallet-label">{label}</div>
                        <div className="wallet-address">
                          <code>{formatAddress(addr)}</code>
                          <span className="event-count">{eventCount} events</span>
                        </div>
                      </div>
                      <div className="wallet-actions">
                        <button 
                          className={`filter-btn ${viewFilter === addr ? 'active' : ''}`}
                          onClick={() => setViewFilter(viewFilter === addr ? 'all' : addr)}
                          title="Filter events by this wallet"
                        >
                          🔍
                        </button>
                        <button 
                          className={`toggle-wallet-btn ${enabled ? 'enabled' : 'disabled'}`}
                          onClick={() => toggleWallet(addr, enabled)}
                          title={enabled ? 'Disable wallet' : 'Enable wallet'}
                        >
                          {enabled ? '✓' : '○'}
                        </button>
                        <button 
                          className="remove-btn"
                          onClick={() => removeWallet(addr)}
                          title="Remove wallet"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </section>

      {/* Section C: Filter Display */}
      <section className="filter-section">
        <div className="section-header">Active Filters</div>
        <div className="filter-grid">
          <div className="filter-item">
            <div className="value">{config.threshold}</div>
            <div className="label">Min Threshold</div>
          </div>
          <div className="filter-item">
            <div className="value">{config.watchedWalletsCount || config.watchedWallets?.length || 0}</div>
            <div className="label">Watched Wallets</div>
          </div>
          <div className="filter-item">
            <div className="value">{config.cooldown}s</div>
            <div className="label">Cooldown</div>
          </div>
          <div className="filter-item">
            <div className="value">{events.length}</div>
            <div className="label">Events Received</div>
          </div>
        </div>
      </section>

      {/* Section B: Live Event Feed */}
      <section className="event-feed">
        <div className="event-feed-header">
          <div className="section-header" style={{ margin: 0 }}>Live Event Feed</div>
          <div className="filter-tabs">
            <button 
              className={`filter-tab ${viewFilter === 'all' ? 'active' : ''}`}
              onClick={() => setViewFilter('all')}
            >
              All ({events.length})
            </button>
            <button 
              className={`filter-tab eth ${viewFilter === 'eth' ? 'active' : ''}`}
              onClick={() => setViewFilter('eth')}
            >
              <TokenLogo type="eth" size={14} /> ETH ({ethCount})
            </button>
            <button 
              className={`filter-tab token ${viewFilter === 'token' ? 'active' : ''}`}
              onClick={() => setViewFilter('token')}
            >
              <TokenLogo type="token" size={14} /> LINK ({tokenCount})
            </button>
          </div>
        </div>
        <div className="event-list">
          {filteredEvents.length === 0 ? (
            <div className="no-events">
              <div style={{ fontSize: '24px', marginBottom: '10px' }}></div>
              <div>Waiting for Transfer events...</div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>
                {viewFilter !== 'all' ? `No ${viewFilter === 'eth' ? 'ETH' : viewFilter === 'token' ? 'Token' : 'wallet'} events yet` : 'No transactions for your watched wallet yet'}
              </div>
            </div>
          ) : (
            filteredEvents.map((event, index) => {
              const isMyWallet = isWatchedWalletEvent(event)
              return (
                <div 
                  key={event.transactionHash + index} 
                  className={`event-item ${event.filterResult?.passed ? 'matched' : 'ignored'} ${event.type || 'token'} ${isMyWallet ? 'my-wallet' : ''}`}
                >
                  <div className="event-row">
                    <span className="event-amount">
                      <span className="event-type-badge">
                        <TokenLogo type={event.type === 'eth' ? 'eth' : 'token'} size={18} />
                      </span>
                      {isMyWallet && <span className="wallet-badge"></span>}
                      {parseFloat(event.amount).toFixed(4)} {event.tokenSymbol || 'TOKEN'}
                    </span>
                    <span className={`event-status ${event.filterResult?.passed ? 'matched' : 'ignored'}`}>
                      {event.filterResult?.passed ? '✓ Alert Sent' : `⏭ ${event.filterResult?.reason || 'Ignored'}`}
                    </span>
                  </div>
                  <div className="event-addresses">
                    <span className={config.watchedWallets?.some(w => getWalletAddress(w).toLowerCase() === event.from?.toLowerCase()) ? 'my-address' : ''}>
                      {formatAddress(event.from)}
                    </span>
                    {' → '}
                    <span className={config.watchedWallets?.some(w => getWalletAddress(w).toLowerCase() === event.to?.toLowerCase()) ? 'my-address' : ''}>
                      {formatAddress(event.to)}
                    </span>
                  </div>
                  <div className="event-time">
                    Block {event.blockNumber} • {formatTime(event.timestamp)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Section D: Last Alert Sent */}
      <section className="alert-section">
        <div className="section-header">Last Telegram Alert</div>
        {lastAlert ? (
          <div>
            <div className="alert-success">
              <span style={{ fontSize: '20px' }}>✅</span>
              <span>Alert sent successfully</span>
            </div>
            <div className="alert-details">
              Amount: <strong>{parseFloat(lastAlert.amount).toFixed(4)}</strong> • 
              TX: <code>{formatAddress(lastAlert.transactionHash)}</code> • 
              {formatTime(lastAlert.timestamp)}
            </div>
          </div>
        ) : (
          <div className="alert-none">
            No alerts sent yet — waiting for matching events
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>
          ChainWatch v1.0 •{' '}
          <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer">
            Sepolia Etherscan
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
