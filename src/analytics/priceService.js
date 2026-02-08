/**
 * Price Service Module
 * Fetches cryptocurrency prices from CoinGecko API
 * Includes caching to avoid rate limits
 */

class PriceService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 60000; // 1 minute cache
        this.baseURL = 'https://api.coingecko.com/api/v3';
        this.apiKey = process.env.COINGECKO_API_KEY || null;
        this.rateLimit = 1000; // 1 second between requests
        this.lastRequestTime = 0;

        // Log API status
        if (this.apiKey) {
            console.log('CoinGecko API: Using Pro API key');
        } else {
            console.log('CoinGecko API: Using free tier (no API key)');
        }

        // Token address to CoinGecko ID mapping
        this.tokenMapping = {
            // Ethereum mainnet
            '0x514910771af9ca656af840dff83e8264ecf986ca': 'chainlink', // LINK
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'usd-coin', // USDC
            '0xdac17f958d2ee523a2206206994597c13d831ec7': 'tether', // USDT
            '0x6b175474e89094c44da98b954eedeac495271d0f': 'dai', // DAI
            '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin', // WBTC
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'weth', // WETH
            '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'uniswap', // UNI
            '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 'matic-network', // MATIC
            '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'aave', // AAVE

            // Sepolia testnet (use mainnet equivalents for pricing)
            '0x779877a7b0d9e8603169ddbd7836e478b4624789': 'chainlink', // LINK (Sepolia)
        };

        this.nativeTokenMapping = {
            'ethereum': 'ethereum',
            'sepolia': 'ethereum',
            'mainnet': 'ethereum',
            'polygon': 'matic-network',
            'bsc': 'binancecoin',
        };
    }

    /**
     * Get price for a token by address
     * @param {string} tokenAddress - Token contract address
     * @param {string} currency - Currency for price (default: 'usd')
     * @returns {Object} - Price data with USD value and 24h change
     */
    async getTokenPrice(tokenAddress, currency = 'usd') {
        const address = tokenAddress.toLowerCase();
        const cacheKey = `${address}_${currency}`;

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        // Map address to CoinGecko ID
        const coinId = this.tokenMapping[address];
        if (!coinId) {
            console.warn(`No CoinGecko mapping for token: ${tokenAddress}`);
            return null;
        }

        try {
            await this.respectRateLimit();

            const url = `${this.baseURL}/simple/price?ids=${coinId}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status}`);
            }

            const data = await response.json();

            if (data[coinId]) {
                const priceData = {
                    price: data[coinId][currency],
                    change24h: data[coinId][`${currency}_24h_change`] || 0,
                    marketCap: data[coinId][`${currency}_market_cap`] || 0,
                    currency: currency.toUpperCase(),
                    symbol: this.getSymbolFromId(coinId),
                    timestamp: Date.now()
                };

                // Cache the result
                this.cache.set(cacheKey, {
                    data: priceData,
                    timestamp: Date.now()
                });

                return priceData;
            }

            return null;
        } catch (error) {
            console.error('Failed to fetch token price:', error.message);
            return null;
        }
    }

    /**
     * Get ETH price
     * @param {string} network - Network name (ethereum, sepolia, etc.)
     * @param {string} currency - Currency for price
     * @returns {Object} - Price data
     */
    async getNativeTokenPrice(network = 'ethereum', currency = 'usd') {
        const cacheKey = `native_${network}_${currency}`;

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        const coinId = this.nativeTokenMapping[network.toLowerCase()] || 'ethereum';

        try {
            await this.respectRateLimit();

            const url = `${this.baseURL}/simple/price?ids=${coinId}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true`;
            const headers = this.apiKey ? { 'x-cg-pro-api-key': this.apiKey } : {};
            const response = await fetch(url, { headers });

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status}`);
            }

            const data = await response.json();

            if (data[coinId]) {
                const priceData = {
                    price: data[coinId][currency],
                    change24h: data[coinId][`${currency}_24h_change`] || 0,
                    marketCap: data[coinId][`${currency}_market_cap`] || 0,
                    currency: currency.toUpperCase(),
                    symbol: network === 'ethereum' || network === 'sepolia' ? 'ETH' : this.getSymbolFromId(coinId),
                    timestamp: Date.now()
                };

                // Cache the result
                this.cache.set(cacheKey, {
                    data: priceData,
                    timestamp: Date.now()
                });

                return priceData;
            }

            return null;
        } catch (error) {
            console.error('Failed to fetch native token price:', error.message);
            return null;
        }
    }

    /**
     * Calculate USD value for a token amount
     * @param {string} tokenAddress - Token address (or 'ETH' for native)
     * @param {string|number} amount - Token amount
     * @param {string} network - Network name
     * @returns {Object} - USD value and price info
     */
    async calculateUSDValue(tokenAddress, amount, network = 'ethereum') {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount === 0) {
            return { usdValue: 0, price: null };
        }

        let priceData;

        if (tokenAddress === 'ETH' || tokenAddress === 'native') {
            priceData = await this.getNativeTokenPrice(network);
        } else {
            priceData = await this.getTokenPrice(tokenAddress);
        }

        if (!priceData || !priceData.price) {
            return { usdValue: null, price: null };
        }

        const usdValue = numAmount * priceData.price;

        return {
            usdValue,
            price: priceData.price,
            change24h: priceData.change24h,
            currency: priceData.currency,
            formatted: this.formatUSD(usdValue)
        };
    }

    /**
     * Format USD value with proper decimals and commas
     */
    formatUSD(value) {
        if (value === null || value === undefined) return 'N/A';
        if (value === 0) return '$0.00';

        const absValue = Math.abs(value);
        const sign = value < 0 ? '-' : '';

        if (absValue < 0.01) {
            return `${sign}$${absValue.toFixed(6)}`;
        } else if (absValue < 1) {
            return `${sign}$${absValue.toFixed(4)}`;
        } else {
            return `${sign}$${absValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    }

    /**
     * Get symbol from CoinGecko ID
     */
    getSymbolFromId(coinId) {
        const symbolMap = {
            'chainlink': 'LINK',
            'usd-coin': 'USDC',
            'tether': 'USDT',
            'dai': 'DAI',
            'wrapped-bitcoin': 'WBTC',
            'weth': 'WETH',
            'ethereum': 'ETH',
            'uniswap': 'UNI',
            'matic-network': 'MATIC',
            'aave': 'AAVE',
            'binancecoin': 'BNB'
        };
        return symbolMap[coinId] || coinId.toUpperCase();
    }

    /**
     * Add custom token mapping
     */
    addTokenMapping(address, coinGeckoId) {
        this.tokenMapping[address.toLowerCase()] = coinGeckoId;
    }

    /**
     * Rate limiting to avoid API throttling
     */
    async respectRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.rateLimit) {
            const waitTime = this.rateLimit - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Clear cache (useful for testing or manual refresh)
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

export default PriceService;
