import { Home, Send, Shield, Bell, BarChart3, Menu, X, Wallet } from 'lucide-react';
import { Card } from './ui/card';

export default function Sidebar({ currentPage, setCurrentPage, sidebarOpen, setSidebarOpen, connectedWallet }) {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'transactions', label: 'Send Transaction', icon: Send },
        { id: 'verify', label: 'Verify Contract', icon: Shield },
        { id: 'alerts', label: 'Alert Rules', icon: Bell },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ];

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
            >
                {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full bg-zinc-900 border-r border-zinc-800 transition-transform duration-300 z-40 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } lg:translate-x-0 w-64`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="p-6 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-linear-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                                <Wallet className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">ChainWatch</h1>
                                <p className="text-xs text-zinc-400">Web3 Monitor</p>
                            </div>
                        </div>
                    </div>

                    {/* Connection Status */}
                    {connectedWallet && (
                        <div className="p-4 border-b border-zinc-800">
                            <Card className="p-3 bg-zinc-800/50 border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-zinc-400">Connected</p>
                                        <p className="text-sm font-mono text-white truncate">
                                            {connectedWallet.substring(0, 6)}...{connectedWallet.substring(38)}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = currentPage === item.id;
                            const isDisabled = !connectedWallet && item.id !== 'dashboard';

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => !isDisabled && setCurrentPage(item.id)}
                                    disabled={isDisabled}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                            : isDisabled
                                                ? 'text-zinc-600 cursor-not-allowed'
                                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                        }`}
                                >
                                    <Icon className="h-5 w-5 shrink-0" />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 text-center">
                            Real-time blockchain monitoring
                        </p>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden fixed inset-0 bg-black/50 z-30"
                />
            )}
        </>
    );
}
