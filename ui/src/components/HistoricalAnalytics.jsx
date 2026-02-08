import { useState } from 'react'
import { Search, Download, Calendar, Filter, TrendingUp, Wallet as WalletIcon, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const HistoricalAnalytics = () => {
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        type: '',
        minAmount: '',
        maxAmount: '',
        walletAddress: '',
        keyword: ''
    })
    const [results, setResults] = useState([])
    const [stats, setStats] = useState(null)
    const [searching, setSearching] = useState(false)
    const [exporting, setExporting] = useState(false)

    const API_URL = import.meta.env.DEV ? 'http://localhost:3002' : ''

    const handleSearch = async () => {
        setSearching(true)

        try {
            // Clean filters (remove empty values)
            const cleanFilters = Object.entries(filters).reduce((acc, [key, value]) => {
                if (value !== '' && value !== null && value !== undefined) {
                    acc[key] = value
                }
                return acc
            }, {})

            // Search transactions
            const searchResponse = await fetch(`${API_URL}/api/analytics/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanFilters)
            })

            const searchData = await searchResponse.json()

            if (searchData.success) {
                setResults(searchData.transactions || [])
            }

            // Get statistics
            const statsResponse = await fetch(`${API_URL}/api/analytics/stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanFilters)
            })

            const statsData = await statsResponse.json()

            if (statsData.success) {
                setStats(statsData.stats)
            }
        } catch (error) {
            console.error('Search error:', error)
        } finally {
            setSearching(false)
        }
    }

    const handleExport = async (format) => {
        setExporting(true)

        try {
            const cleanFilters = Object.entries(filters).reduce((acc, [key, value]) => {
                if (value !== '' && value !== null && value !== undefined) {
                    acc[key] = value
                }
                return acc
            }, {})

            const response = await fetch(`${API_URL}/api/analytics/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...cleanFilters, format })
            })

            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `chainwatch-export-${Date.now()}.${format}`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
            }
        } catch (error) {
            console.error('Export error:', error)
        } finally {
            setExporting(false)
        }
    }

    const formatAddress = (addr) => {
        if (!addr) return ''
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }

    const formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString()
    }

    return (
        <div className="space-y-4">
            <Card className="border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Historical Analytics
                    </CardTitle>
                    <CardDescription>
                        Search, filter, and export transaction history
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Filters  */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium mb-1">Start Date</label>
                            <input
                                type="datetime-local"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1">End Date</label>
                            <input
                                type="datetime-local"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1">Type</label>
                            <select
                                value={filters.type}
                                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">All Types</option>
                                <option value="eth">ETH Transfers</option>
                                <option value="token">Token Transfers</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1">Min Amount</label>
                            <input
                                type="number"
                                step="any"
                                placeholder="0.0"
                                value={filters.minAmount}
                                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1">Max Amount</label>
                            <input
                                type="number"
                                step="any"
                                placeholder="1000.0"
                                value={filters.maxAmount}
                                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1">Wallet Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                value={filters.walletAddress}
                                onChange={(e) => setFilters({ ...filters, walletAddress: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                            />
                        </div>

                        <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-xs font-medium mb-1">Keyword Search</label>
                            <input
                                type="text"
                                placeholder="Search addresses, tx hash, etc..."
                                value={filters.keyword}
                                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button
                            onClick={handleSearch}
                            disabled={searching}
                            className="bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        >
                            <Search className="w-4 h-4 mr-2" />
                            {searching ? 'Searching...' : 'Search'}
                        </Button>

                        <Button
                            onClick={() => handleExport('csv')}
                            disabled={exporting || results.length === 0}
                            variant="outline"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                        </Button>

                        <Button
                            onClick={() => handleExport('json')}
                            disabled={exporting || results.length === 0}
                            variant="outline"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export JSON
                        </Button>
                    </div>

                    {/* Statistics */}
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-3 bg-white/5 border border-white/10 rounded-md">
                                <div className="text-xs text-muted-foreground mb-1">Total Transactions</div>
                                <div className="text-2xl font-bold">{stats.total}</div>
                            </div>
                            <div className="p-3 bg-white/5 border border-white/10 rounded-md">
                                <div className="text-xs text-muted-foreground mb-1">Total Volume</div>
                                <div className="text-2xl font-bold">{stats.totalVolume.toFixed(2)}</div>
                            </div>
                            <div className="p-3 bg-white/5 border border-white/10 rounded-md">
                                <div className="text-xs text-muted-foreground mb-1">USD Value</div>
                                <div className="text-2xl font-bold">${stats.totalVolumeUSD.toFixed(2)}</div>
                            </div>
                            <div className="p-3 bg-white/5 border border-white/10 rounded-md">
                                <div className="text-xs text-muted-foreground mb-1">Unique Addresses</div>
                                <div className="text-2xl font-bold">{stats.uniqueAddressCount}</div>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-sm">Results ({results.length})</h3>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {results.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Filter className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No transactions found</p>
                                    <p className="text-xs mt-1">Try adjusting your filters</p>
                                </div>
                            ) : (
                                results.map((tx, idx) => (
                                    <div
                                        key={tx.transactionHash + idx}
                                        className="p-3 bg-white/5 border border-white/10 rounded-md hover:border-primary/30 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant={tx.type === 'eth' ? 'info' : 'success'} className="text-xs">
                                                        {tx.type?.toUpperCase()}
                                                    </Badge>
                                                    {tx.category && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {tx.category.label}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm space-y-1">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-muted-foreground">From:</span>
                                                        <code className="text-blue-400">{formatAddress(tx.from)}</code>
                                                        <span className="text-muted-foreground">→</span>
                                                        <code className="text-green-400">{formatAddress(tx.to)}</code>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span>{formatDate(tx.timestamp)}</span>
                                                        <span>•</span>
                                                        <span className="font-mono">{tx.amount} {tx.tokenSymbol || tx.symbol}</span>
                                                        {tx.priceInfo?.formatted && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{tx.priceInfo.formatted}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default HistoricalAnalytics
