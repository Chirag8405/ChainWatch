/**
 * Portfolio Tracker Module
 * Tracks wallet holdings and calculates portfolio value over time
 */

import { ethers } from 'ethers';
import PriceService from './priceService.js';

const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
];

class PortfolioTracker {
    constructor(provider) {
        this.provider = provider;
        this.priceService = new PriceService();
        this.holdings = new Map(); // wallet -> { [token]: balance }
        this.balanceHistory = []; // { timestamp, totalValue, holdings: [] }
        this.maxHistoryPoints = 100;
    }

    /**
     * Get current portfolio for a wallet
     * @param {string} walletAddress - Wallet address to track
     * @param {Array} tokenAddresses - Array of token addresses to track
     * @returns {Object} - Portfolio data with USD values
     */
    async getPortfolio(walletAddress, tokenAddresses = []) {
        const portfolio = {
            wallet: walletAddress,
            timestamp: Date.now(),
            holdings: [],
            totalValue: 0,
            totalValue24hChange: 0
        };

        try {
            // Get ETH balance
            const ethBalance = await this.provider.getBalance(walletAddress);
            const ethAmount = parseFloat(ethers.formatEther(ethBalance));

            if (ethAmount > 0) {
                const ethPriceData = await this.priceService.getNativeTokenPrice('ethereum');
                const ethUsdValue = ethAmount * (ethPriceData?.price || 0);

                portfolio.holdings.push({
                    token: 'ETH',
                    symbol: 'ETH',
                    name: 'Ethereum',
                    address: 'native',
                    balance: ethAmount,
                    decimals: 18,
                    price: ethPriceData?.price || 0,
                    usdValue: ethUsdValue,
                    change24h: ethPriceData?.change24h || 0,
                    type: 'native'
                });

                portfolio.totalValue += ethUsdValue;
            }

            // Get token balances
            for (const tokenAddress of tokenAddresses) {
                try {
                    const tokenData = await this.getTokenBalance(walletAddress, tokenAddress);
                    if (tokenData && tokenData.balance > 0) {
                        portfolio.holdings.push(tokenData);
                        portfolio.totalValue += tokenData.usdValue || 0;
                    }
                } catch (error) {
                    console.error(`Failed to get balance for token ${tokenAddress}:`, error.message);
                }
            }

            // Calculate weighted 24h change
            if (portfolio.totalValue > 0) {
                let weightedChange = 0;
                for (const holding of portfolio.holdings) {
                    const weight = holding.usdValue / portfolio.totalValue;
                    weightedChange += weight * (holding.change24h || 0);
                }
                portfolio.totalValue24hChange = weightedChange;
            }

            // Sort by USD value
            portfolio.holdings.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));

            return portfolio;
        } catch (error) {
            console.error('Failed to get portfolio:', error.message);
            return portfolio;
        }
    }

    /**
     * Get balance for a specific token
     * @param {string} walletAddress - Wallet address
     * @param {string} tokenAddress - Token contract address
     * @returns {Object} - Token balance data
     */
    async getTokenBalance(walletAddress, tokenAddress) {
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

        try {
            const [balance, decimals, symbol, name] = await Promise.all([
                contract.balanceOf(walletAddress),
                contract.decimals().catch(() => 18),
                contract.symbol().catch(() => 'TOKEN'),
                contract.name().catch(() => 'Unknown Token')
            ]);

            const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));

            if (balanceFormatted === 0) {
                return null;
            }

            // Get price data
            const priceData = await this.priceService.getTokenPrice(tokenAddress);
            const usdValue = balanceFormatted * (priceData?.price || 0);

            return {
                token: symbol,
                symbol,
                name,
                address: tokenAddress,
                balance: balanceFormatted,
                decimals,
                price: priceData?.price || 0,
                usdValue,
                change24h: priceData?.change24h || 0,
                type: 'erc20'
            };
        } catch (error) {
            console.error(`Error fetching token balance for ${tokenAddress}:`, error.message);
            return null;
        }
    }

    /**
     * Update portfolio based on a new transaction event
     * @param {Object} event - Transaction event
     * @param {string} walletAddress - Wallet being tracked
     */
    async updateFromEvent(event, walletAddress) {
        const wallet = walletAddress.toLowerCase();

        if (!this.holdings.has(wallet)) {
            this.holdings.set(wallet, {});
        }

        const holdings = this.holdings.get(wallet);
        const token = event.type === 'eth' ? 'ETH' : event.tokenSymbol;
        const amount = parseFloat(event.amount);

        // Initialize if not exists
        if (!holdings[token]) {
            holdings[token] = 0;
        }

        // Update balance based on direction
        if (event.from.toLowerCase() === wallet) {
            // Outgoing - decrease balance
            holdings[token] -= amount;
        }

        if (event.to.toLowerCase() === wallet) {
            // Incoming - increase balance
            holdings[token] += amount;
        }

        // Clean up zero balances
        if (holdings[token] <= 0) {
            delete holdings[token];
        }
    }

    /**
     * Record portfolio snapshot for history tracking
     * @param {Object} portfolio - Portfolio data
     */
    recordSnapshot(portfolio) {
        this.balanceHistory.push({
            timestamp: portfolio.timestamp,
            totalValue: portfolio.totalValue,
            holdings: portfolio.holdings.map(h => ({
                symbol: h.symbol,
                balance: h.balance,
                usdValue: h.usdValue
            }))
        });

        // Limit history size
        if (this.balanceHistory.length > this.maxHistoryPoints) {
            this.balanceHistory.shift();
        }
    }

    /**
     * Get portfolio history for charting
     * @returns {Array} - Array of historical data points
     */
    getHistory() {
        return this.balanceHistory;
    }

    /**
     * Get portfolio statistics
     * @param {Object} portfolio - Current portfolio
     * @returns {Object} - Statistics
     */
    getStatistics(portfolio) {
        const stats = {
            totalHoldings: portfolio.holdings.length,
            totalValue: portfolio.totalValue,
            largestHolding: null,
            smallestHolding: null,
            diversification: 0
        };

        if (portfolio.holdings.length > 0) {
            stats.largestHolding = portfolio.holdings[0];
            stats.smallestHolding = portfolio.holdings[portfolio.holdings.length - 1];

            // Calculate diversification score (0-1, higher = more diversified)
            // Based on inverse of Herfindahl index
            let sumOfSquares = 0;
            for (const holding of portfolio.holdings) {
                const proportion = holding.usdValue / portfolio.totalValue;
                sumOfSquares += proportion * proportion;
            }
            stats.diversification = portfolio.holdings.length > 1 ? 1 - sumOfSquares : 0;
        }

        return stats;
    }

    /**
     * Format portfolio for display
     * @param {Object} portfolio - Portfolio data
     * @returns {string} - Formatted string
     */
    formatPortfolio(portfolio) {
        let output = `\n📊 Portfolio Summary\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `Total Value: ${this.priceService.formatUSD(portfolio.totalValue)}\n`;
        output += `24h Change: ${portfolio.totalValue24hChange >= 0 ? '+' : ''}${portfolio.totalValue24hChange.toFixed(2)}%\n\n`;

        if (portfolio.holdings.length > 0) {
            output += `Holdings:\n`;
            for (const holding of portfolio.holdings) {
                const percentage = portfolio.totalValue > 0 ? (holding.usdValue / portfolio.totalValue * 100).toFixed(1) : 0;
                output += `  ${holding.symbol}: ${holding.balance.toFixed(4)} (${this.priceService.formatUSD(holding.usdValue)}) - ${percentage}%\n`;
            }
        } else {
            output += `No holdings found.\n`;
        }

        return output;
    }

    /**
     * Clear all tracking data
     */
    reset() {
        this.holdings.clear();
        this.balanceHistory = [];
    }
}

export default PortfolioTracker;
