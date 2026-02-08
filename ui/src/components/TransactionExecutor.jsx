import { useState } from 'react'
import { ethers } from 'ethers'
import { Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const TransactionExecutor = ({ connectedWallet, chainId }) => {
    const [recipient, setRecipient] = useState('')
    const [amount, setAmount] = useState('')
    const [tokenAddress, setTokenAddress] = useState('')
    const [txType, setTxType] = useState('eth') // 'eth' or 'token'
    const [sending, setSending] = useState(false)
    const [txHash, setTxHash] = useState(null)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const sendTransaction = async () => {
        setError(null)
        setSuccess(false)
        setTxHash(null)

        // Validation
        if (!connectedWallet) {
            setError('Please connect your wallet first')
            return
        }

        if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
            setError('Invalid recipient address')
            return
        }

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            setError('Invalid amount')
            return
        }

        if (txType === 'token' && (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress))) {
            setError('Invalid token contract address')
            return
        }

        setSending(true)

        try {
            if (txType === 'eth') {
                await sendETH()
            } else {
                await sendToken()
            }
        } catch (err) {
            console.error('Transaction error:', err)
            setError(err.message || 'Transaction failed')
        } finally {
            setSending(false)
        }
    }

    const sendETH = async () => {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            const tx = await signer.sendTransaction({
                to: recipient,
                value: ethers.parseEther(amount)
            })

            setTxHash(tx.hash)
            console.log('Transaction sent:', tx.hash)

            // Wait for confirmation
            const receipt = await tx.wait()
            console.log('Transaction confirmed:', receipt)

            setSuccess(true)

            // Clear form after success
            setTimeout(() => {
                setRecipient('')
                setAmount('')
                setSuccess(false)
                setTxHash(null)
            }, 5000)
        } catch (err) {
            throw err
        }
    }

    const sendToken = async () => {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            // ERC20 ABI for transfer
            const erc20ABI = [
                'function transfer(address to, uint256 amount) returns (bool)',
                'function decimals() view returns (uint8)'
            ]

            const contract = new ethers.Contract(tokenAddress, erc20ABI, signer)

            // Get decimals
            const decimals = await contract.decimals()
            const amountInWei = ethers.parseUnits(amount, decimals)

            // Send transfer transaction
            const tx = await contract.transfer(recipient, amountInWei)
            setTxHash(tx.hash)
            console.log('Token transfer sent:', tx.hash)

            // Wait for confirmation
            const receipt = await tx.wait()
            console.log('Token transfer confirmed:', receipt)

            setSuccess(true)

            // Clear form after success
            setTimeout(() => {
                setRecipient('')
                setAmount('')
                setTokenAddress('')
                setSuccess(false)
                setTxHash(null)
            }, 5000)
        } catch (err) {
            throw err
        }
    }

    const getEtherscanLink = (hash) => {
        const networks = {
            '0xaa36a7': 'sepolia',
            '0x1': '',
            '0x5': 'goerli'
        }
        const network = networks[chainId] || 'sepolia'
        const subdomain = network ? `${network}.` : ''
        return `https://${subdomain}etherscan.io/tx/${hash}`
    }

    if (!connectedWallet) {
        return (
            <Card className="border-orange-500/20 bg-orange-500/5">
                <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                    <p className="text-sm text-orange-400">
                        Connect your wallet to execute transactions
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-border/50">
            <CardHeader>
                <CardTitle className="text-lg font-semibold">Execute Transaction</CardTitle>
                <CardDescription>Send ETH or tokens from your connected wallet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Transaction Type Selector */}
                <div className="flex gap-2">
                    <Button
                        variant={txType === 'eth' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTxType('eth')}
                        className="flex-1"
                    >
                        Send ETH
                    </Button>
                    <Button
                        variant={txType === 'token' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTxType('token')}
                        className="flex-1"
                    >
                        Send Token
                    </Button>
                </div>

                {/* Recipient Address */}
                <div>
                    <label className="block text-sm font-medium mb-2">Recipient Address</label>
                    <input
                        type="text"
                        placeholder="0x..."
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                        disabled={sending}
                    />
                </div>

                {/* Token Address (if sending token) */}
                {txType === 'token' && (
                    <div>
                        <label className="block text-sm font-medium mb-2">Token Contract Address</label>
                        <input
                            type="text"
                            placeholder="0x... (ERC20 token address)"
                            value={tokenAddress}
                            onChange={(e) => setTokenAddress(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                            disabled={sending}
                        />
                    </div>
                )}

                {/* Amount */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Amount {txType === 'eth' ? '(ETH)' : '(Tokens)'}
                    </label>
                    <input
                        type="number"
                        step="0.000001"
                        placeholder="0.0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={sending}
                    />
                </div>

                {/* Send Button */}
                <Button
                    onClick={sendTransaction}
                    disabled={sending}
                    className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                    {sending ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Transaction
                        </>
                    )}
                </Button>

                {/* Error Message */}
                {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-red-400">{error}</div>
                    </div>
                )}

                {/* Success Message */}
                {success && txHash && (
                    <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                            <div className="text-sm text-green-400 font-medium">Transaction Confirmed!</div>
                            <a
                                href={getEtherscanLink(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 underline block break-all"
                            >
                                View on Etherscan: {txHash}
                            </a>
                        </div>
                    </div>
                )}

                {/* Pending Transaction */}
                {txHash && !success && (
                    <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                        <Loader2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5 animate-spin" />
                        <div className="flex-1 space-y-1">
                            <div className="text-sm text-blue-400 font-medium">Transaction Pending...</div>
                            <a
                                href={getEtherscanLink(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 underline block break-all"
                            >
                                {txHash}
                            </a>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default TransactionExecutor
