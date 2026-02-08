import { Wallet, Shield, Bell, BarChart3, Zap, Eye } from 'lucide-react';
import { Card } from './ui/card';
import WalletConnect from './WalletConnect';

export default function WelcomePage({ onWalletConnect }) {
    const features = [
        {
            icon: Eye,
            title: 'Real-time Monitoring',
            description: 'Track wallet transactions as they happen on the blockchain',
        },
        {
            icon: Bell,
            title: 'Custom Alert Rules',
            description: 'Set up intelligent alerts for specific transaction patterns',
        },
        {
            icon: Shield,
            title: 'Contract Verification',
            description: 'Verify smart contracts directly on Etherscan',
        },
        {
            icon: BarChart3,
            title: 'Historical Analytics',
            description: 'Search and analyze transaction history with powerful filters',
        },
        {
            icon: Zap,
            title: 'Execute Transactions',
            description: 'Send ETH and tokens directly from the dashboard',
        },
        {
            icon: Wallet,
            title: 'Portfolio Tracking',
            description: 'Monitor your portfolio value and transaction activity',
        },
    ];

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="max-w-6xl w-full">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-3 mb-6">
                        <div className="h-16 w-16 rounded-2xl bg-linear-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <Wallet className="h-10 w-10 text-white" />
                        </div>
                    </div>
                    <h1 className="text-5xl font-bold text-white mb-4">
                        Welcome to <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-500">ChainWatch</span>
                    </h1>
                    <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
                        Your comprehensive Web3 monitoring platform. Track wallets, execute transactions,
                        and stay informed with real-time blockchain alerts.
                    </p>

                    {/* CTA */}
                    <div className="flex justify-center">
                        <WalletConnect onWalletChange={onWalletConnect} />
                    </div>
                    <p className="text-sm text-zinc-500 mt-4">
                        Connect your MetaMask wallet to get started
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        return (
                            <Card
                                key={index}
                                className="p-6 bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-lg hover:shadow-blue-500/10"
                            >
                                <div className="h-12 w-12 rounded-lg bg-blue-600/10 flex items-center justify-center mb-4">
                                    <Icon className="h-6 w-6 text-blue-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                                <p className="text-sm text-zinc-400">{feature.description}</p>
                            </Card>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="mt-16 text-center">
                    <p className="text-sm text-zinc-500">
                        Powered by Ethereum • Real-time WebSocket Updates • Alchemy API
                    </p>
                </div>
            </div>
        </div>
    );
}
