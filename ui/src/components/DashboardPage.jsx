import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Activity, TrendingUp, Bell, Send } from 'lucide-react';
import { Button } from './ui/button';

export default function DashboardPage({
    connectedWallet,
    watchedWallets,
    events,
    stats,
    setCurrentPage,
}) {
    const recentEvents = events.slice(0, 5);

    const quickActions = [
        { id: 'transactions', label: 'Send Transaction', icon: Send, color: 'blue' },
        { id: 'alerts', label: 'Create Alert', icon: Bell, color: 'purple' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
                <p className="text-zinc-400">Monitor your blockchain activity in real-time</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-zinc-400">Total Events</p>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.totalEvents}</p>
                    <p className="text-xs text-zinc-500 mt-1">All time</p>
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-zinc-400">Watched Wallets</p>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-white">{watchedWallets.length}</p>
                    <p className="text-xs text-zinc-500 mt-1">Active monitoring</p>
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-zinc-400">Incoming Txs</p>
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.incomingCount}</p>
                    <p className="text-xs text-zinc-500 mt-1">This session</p>
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-zinc-400">Outgoing Txs</p>
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.outgoingCount}</p>
                    <p className="text-xs text-zinc-500 mt-1">This session</p>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card className="p-6 bg-zinc-900 border-zinc-800">
                <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Button
                                key={action.id}
                                onClick={() => setCurrentPage(action.id)}
                                className={`bg-${action.color}-600 hover:bg-${action.color}-700`}
                            >
                                <Icon className="h-4 w-4 mr-2" />
                                {action.label}
                            </Button>
                        );
                    })}
                </div>
            </Card>

            {/* Recent Activity */}
            <Card className="p-6 bg-zinc-900 border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                    <Badge variant="outline" className="text-zinc-400">
                        Live
                    </Badge>
                </div>

                {recentEvents.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                        <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No recent transactions</p>
                        <p className="text-sm mt-1">Add wallets to watch for live updates</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentEvents.map((event, index) => (
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
                                    <p className="text-sm font-mono text-white truncate">
                                        {event.value} ETH
                                    </p>
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
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
