import { useState } from 'react'
import { ethers } from 'ethers'
import { Search, CheckCircle2, XCircle, Loader2, ExternalLink, FileCode, Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const ContractVerifier = ({ chainId }) => {
    const [contractAddress, setContractAddress] = useState('')
    const [checking, setChecking] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    const checkVerification = async () => {
        setError(null)
        setResult(null)

        if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
            setError('Invalid contract address')
            return
        }

        setChecking(true)

        try {
            // Determine Etherscan API endpoint based on chain
            const networks = {
                '0xaa36a7': { name: 'Sepolia', apiUrl: 'https://api-sepolia.etherscan.io', explorerUrl: 'https://sepolia.etherscan.io' },
                '0x1': { name: 'Mainnet', apiUrl: 'https://api.etherscan.io', explorerUrl: 'https://etherscan.io' },
                '0x5': { name: 'Goerli', apiUrl: 'https://api-goerli.etherscan.io', explorerUrl: 'https://goerli.etherscan.io' }
            }

            const network = networks[chainId] || networks['0xaa36a7']

            // Check if contract is verified using Etherscan API
            // Note: You'll need an Etherscan API key for production
            const apiKey = 'YourApiKeyToken' // Replace with env variable in production
            const url = `${network.apiUrl}/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${apiKey}`

            const response = await fetch(url)
            const data = await response.json()

            if (data.status === '1' && data.result && data.result[0]) {
                const contractData = data.result[0]
                const isVerified = contractData.SourceCode !== ''

                setResult({
                    verified: isVerified,
                    contractName: contractData.ContractName || 'Unknown',
                    compiler: contractData.CompilerVersion || 'Unknown',
                    optimization: contractData.OptimizationUsed === '1',
                    license: contractData.LicenseType || 'None',
                    sourceCode: contractData.SourceCode,
                    abi: contractData.ABI,
                    network: network.name,
                    explorerUrl: `${network.explorerUrl}/address/${contractAddress}#code`
                })
            } else {
                setResult({
                    verified: false,
                    network: network.name,
                    explorerUrl: `${network.explorerUrl}/address/${contractAddress}`
                })
            }
        } catch (err) {
            console.error('Verification check error:', err)
            setError('Failed to check contract verification. Using alternative method...')

            // Fallback: Check if bytecode exists
            try {
                await checkBytecode()
            } catch (fallbackErr) {
                setError('Unable to verify contract')
            }
        } finally {
            setChecking(false)
        }
    }

    const checkBytecode = async () => {
        // Fallback method: check if contract has bytecode
        if (!window.ethereum) {
            throw new Error('No Web3 provider')
        }

        const provider = new ethers.BrowserProvider(window.ethereum)
        const code = await provider.getCode(contractAddress)

        if (code === '0x' || code === '0x0') {
            throw new Error('Not a contract address')
        }

        setResult({
            verified: null, // Unknown
            hasCode: true,
            codeLength: code.length,
            message: 'Contract exists but verification status unknown',
            explorerUrl: getEtherscanLink(contractAddress)
        })
    }

    const getEtherscanLink = (address) => {
        const networks = {
            '0xaa36a7': 'sepolia',
            '0x1': '',
            '0x5': 'goerli'
        }
        const network = networks[chainId] || 'sepolia'
        const subdomain = network ? `${network}.` : ''
        return `https://${subdomain}etherscan.io/address/${address}#code`
    }

    return (
        <Card className="border-border/50">
            <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Contract Verification
                </CardTitle>
                <CardDescription>Check if a smart contract is verified on Etherscan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Input */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="0x... contract address"
                        value={contractAddress}
                        onChange={(e) => setContractAddress(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && checkVerification()}
                        className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                        disabled={checking}
                    />
                    <Button
                        onClick={checkVerification}
                        disabled={checking}
                        className="bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                        {checking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Search className="w-4 h-4 mr-2" />
                                Check
                            </>
                        )}
                    </Button>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                        <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-red-400">{error}</div>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className="space-y-3">
                        {/* Verification Status */}
                        <div className={`flex items-start gap-3 p-4 rounded-lg border ${result.verified === true
                                ? 'bg-green-500/10 border-green-500/20'
                                : result.verified === false
                                    ? 'bg-red-500/10 border-red-500/20'
                                    : 'bg-yellow-500/10 border-yellow-500/20'
                            }`}>
                            {result.verified === true ? (
                                <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0" />
                            ) : result.verified === false ? (
                                <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                            ) : (
                                <FileCode className="w-6 h-6 text-yellow-400 shrink-0" />
                            )}

                            <div className="flex-1">
                                <div className={`font-semibold mb-1 ${result.verified === true
                                        ? 'text-green-400'
                                        : result.verified === false
                                            ? 'text-red-400'
                                            : 'text-yellow-400'
                                    }`}>
                                    {result.verified === true && '✓ Contract is Verified'}
                                    {result.verified === false && '✗ Contract is Not Verified'}
                                    {result.verified === null && '? Verification Status Unknown'}
                                </div>

                                {result.message && (
                                    <p className="text-sm text-muted-foreground">{result.message}</p>
                                )}

                                {/* Contract Details */}
                                {result.verified && (
                                    <div className="mt-3 space-y-2">
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Name:</span>
                                                <span className="ml-2 font-mono text-foreground">{result.contractName}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Compiler:</span>
                                                <span className="ml-2 font-mono text-foreground text-xs">{result.compiler}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Optimization:</span>
                                                <Badge variant={result.optimization ? 'success' : 'secondary'} className="ml-2">
                                                    {result.optimization ? 'Enabled' : 'Disabled'}
                                                </Badge>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">License:</span>
                                                <span className="ml-2 font-mono text-foreground text-xs">{result.license}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* View on Etherscan */}
                        {result.explorerUrl && (
                            <a
                                href={result.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md text-sm text-blue-400 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                View on Etherscan
                            </a>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default ContractVerifier
