import { useState, useEffect } from 'react'
import { Wallet, LogOut, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'

const WalletConnect = ({ onWalletChange }) => {
    const [account, setAccount] = useState(null)
    const [chainId, setChainId] = useState(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const [error, setError] = useState(null)

    // Check if wallet is already connected on mount
    useEffect(() => {
        checkIfWalletIsConnected()

        // Listen for account changes
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged)
            window.ethereum.on('chainChanged', handleChainChanged)
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
                window.ethereum.removeListener('chainChanged', handleChainChanged)
            }
        }
    }, [])

    const checkIfWalletIsConnected = async () => {
        try {
            if (!window.ethereum) return

            // Don't auto-connect if user manually disconnected
            const manuallyDisconnected = localStorage.getItem('walletManuallyDisconnected')
            if (manuallyDisconnected === 'true') return

            const accounts = await window.ethereum.request({ method: 'eth_accounts' })
            if (accounts.length > 0) {
                const chainId = await window.ethereum.request({ method: 'eth_chainId' })
                setAccount(accounts[0])
                setChainId(chainId)
                onWalletChange?.(accounts[0], chainId)
            }
        } catch (err) {
            console.error('Error checking wallet connection:', err)
        }
    }

    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            // User disconnected wallet from MetaMask
            localStorage.setItem('walletManuallyDisconnected', 'true')
            setAccount(null)
            setChainId(null)
            onWalletChange?.(null, null)
        } else {
            // User switched accounts
            localStorage.removeItem('walletManuallyDisconnected')
            setAccount(accounts[0])
            onWalletChange?.(accounts[0], chainId)
        }
    }

    const handleChainChanged = (newChainId) => {
        setChainId(newChainId)
        onWalletChange?.(account, newChainId)
        // Reload to avoid stale state
        window.location.reload()
    }

    const connectWallet = async () => {
        if (!window.ethereum) {
            setError('MetaMask is not installed. Please install MetaMask to continue.')
            return
        }

        setIsConnecting(true)
        setError(null)

        try {
            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            })

            const chainId = await window.ethereum.request({
                method: 'eth_chainId'
            })

            // Clear the manual disconnect flag
            localStorage.removeItem('walletManuallyDisconnected')

            setAccount(accounts[0])
            setChainId(chainId)
            onWalletChange?.(accounts[0], chainId)
        } catch (err) {
            console.error('Error connecting wallet:', err)
            setError(err.message || 'Failed to connect wallet')
        } finally {
            setIsConnecting(false)
        }
    }

    const disconnectWallet = () => {
        // Set flag to prevent auto-reconnect
        localStorage.setItem('walletManuallyDisconnected', 'true')

        setAccount(null)
        setChainId(null)
        onWalletChange?.(null, null)
    }

    const getNetworkName = (chainId) => {
        const networks = {
            '0x1': 'Ethereum Mainnet',
            '0xaa36a7': 'Sepolia Testnet',
            '0x5': 'Goerli Testnet',
            '0x89': 'Polygon Mainnet',
            '0xa4b1': 'Arbitrum One',
            '0xa': 'Optimism',
            '0x38': 'BSC Mainnet'
        }
        return networks[chainId] || `Chain ${parseInt(chainId, 16)}`
    }

    const formatAddress = (address) => {
        if (!address) return ''
        return `${address.substring(0, 6)}...${address.substring(38)}`
    }

    if (error) {
        return (
            <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{error}</span>
                    </div>
                    <Button
                        onClick={() => setError(null)}
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-red-400 hover:text-red-300"
                    >
                        Dismiss
                    </Button>
                </CardContent>
            </Card>
        )
    }

    if (!account) {
        return (
            <Button
                onClick={connectWallet}
                disabled={isConnecting}
                className="bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
                <Wallet className="w-4 h-4 mr-2" />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
        )
    }

    return (
        <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400">
                {getNetworkName(chainId)}
            </Badge>
            <Card className="bg-white/5 border-white/10">
                <CardContent className="p-2 px-4">
                    <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-mono">{formatAddress(account)}</span>
                    </div>
                </CardContent>
            </Card>
            <Button
                onClick={disconnectWallet}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
            >
                <LogOut className="w-4 h-4" />
            </Button>
        </div>
    )
}

export default WalletConnect
