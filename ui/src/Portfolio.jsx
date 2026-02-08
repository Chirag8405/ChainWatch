import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, RefreshCw, Wallet, DollarSign, Activity, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { cn } from './lib/utils'

const API_URL = import.meta.env.DEV ? 'http://localhost:3002' : ''

function Portfolio({ walletAddress, config }) {
    const [portfolio, setPortfolio] = useState(null)
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [history, setHistory] = useState([])

    useEffect(() => {
        if (walletAddress) {
            fetchPortfolio()
            const interval = setInterval(fetchPortfolio, 30000)
            return () => clearInterval(interval)
        }
    }, [walletAddress])

    const fetchPortfolio = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`${API_URL}/api/portfolio/${walletAddress}`)
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch portfolio')
            }

            setPortfolio(data.portfolio)
            setStats(data.stats)

            const historyResponse = await fetch(`${API_URL}/api/portfolio/${walletAddress}/history`)
            const historyData = await historyResponse.json()
            if (historyResponse.ok) {
                setHistory(historyData.history || [])
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const formatUSD = (value) => {
        if (!value) return '$0.00'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value)
    }

    const formatPercent = (value) => {
        if (!value) return '0.0%'
        const sign = value >= 0 ? '+' : ''
        return `${sign}${value.toFixed(2)}%`
    }

    const formatAddress = (address) => {
        if (!address) return ''
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    if (!walletAddress) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Select a wallet to view portfolio</p>
                </CardContent>
            </Card>
        )
    }

    if (loading && !portfolio) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <RefreshCw className="w-12 h-12 mx-auto text-muted-foreground mb-3 animate-spin" />
                    <p className="text-muted-foreground">Loading portfolio...</p>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card>
                <CardContent className="py-16 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-3" />
                    <p className="text-destructive">{error}</p>
                </CardContent>
            </Card>
        )
    }

    if (!portfolio) {
        return null
    }

    const chartData = history.map(h => ({
        time: new Date(h.timestamp).toLocaleTimeString(),
        value: h.totalValue
    }))

    return (
        <div className="space-y-4">
            {/* Total Value Card */}
            <Card className="border-primary/20">
                <CardContent className="pt-6">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
                            <h2 className="text-4xl font-bold text-foreground">{formatUSD(portfolio.totalValue)}</h2>
                            <div className="flex items-center gap-2">
                                {portfolio.totalValue24hChange >= 0 ? (
                                    <TrendingUp className="w-4 h-4 text-success" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-destructive" />
                                )}
                                <span className={cn(
                                    "text-sm font-semibold",
                                    portfolio.totalValue24hChange >= 0 ? "text-success" : "text-destructive"
                                )}>
                                    {formatPercent(portfolio.totalValue24hChange)} (24h)
                                </span>
                            </div>
                        </div>

                        {stats && (
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-foreground">{stats.totalHoldings}</div>
                                    <div className="text-xs text-muted-foreground">Assets</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary">{(stats.diversification * 100).toFixed(0)}%</div>
                                    <div className="text-xs text-muted-foreground">Diversified</div>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Holdings List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Holdings
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {portfolio.holdings.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                No holdings found for this wallet
                            </div>
                        ) : (
                            portfolio.holdings.map((holding, index) => {
                                const percentage = portfolio.totalValue > 0
                                    ? (holding.usdValue / portfolio.totalValue * 100).toFixed(1)
                                    : 0

                                return (
                                    <div
                                        key={index}
                                        className="border border-border rounded-md p-4 hover:border-primary/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-bold">{holding.symbol}</span>
                                                    <Badge variant="outline" className="text-xs">{holding.name}</Badge>
                                                </div>
                                                <div className="text-sm text-muted-foreground font-mono">
                                                    {holding.balance.toFixed(4)} {holding.symbol}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold">{formatUSD(holding.usdValue)}</div>
                                                <Badge variant="secondary" className="text-xs">{percentage}%</Badge>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                            <span>@ {formatUSD(holding.price)}</span>
                                            <span className={cn(
                                                "font-semibold",
                                                holding.change24h >= 0 ? "text-success" : "text-destructive"
                                            )}>
                                                {formatPercent(holding.change24h)}
                                            </span>
                                        </div>

                                        {holding.address !== 'native' && (
                                            <div className="text-xs text-muted-foreground font-mono mb-2">
                                                {formatAddress(holding.address)}
                                            </div>
                                        )}

                                        {/* Progress Bar */}
                                        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-primary h-full transition-all duration-300"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Portfolio Chart */}
            {chartData.length > 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5" />
                            Portfolio Value (24h)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="time"
                                    stroke="hsl(var(--muted-foreground))"
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    style={{ fontSize: '12px' }}
                                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '6px',
                                        color: 'hsl(var(--foreground))'
                                    }}
                                    formatter={(value) => formatUSD(value)}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Footer */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={fetchPortfolio}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm font-medium"
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <div className="text-xs text-muted-foreground">
                            Last updated: {new Date(portfolio.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default Portfolio

