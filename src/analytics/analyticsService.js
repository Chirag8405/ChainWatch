/**
 * Analytics Module
 * Advanced transaction search, filtering, and export functionality
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

class AnalyticsService {
    constructor(storage) {
        this.storage = storage;
    }

    /**
     * Search transactions with advanced filters
     */
    searchTransactions(filters = {}) {
        const {
            startDate,
            endDate,
            type,           // 'eth' or 'token'
            minAmount,
            maxAmount,
            walletAddress,
            category,
            keyword,
            limit = 100
        } = filters;

        let events = this.storage.getEvents(10000); // Get large batch

        // Filter by date range
        if (startDate) {
            const startTime = new Date(startDate).getTime();
            events = events.filter(e => e.timestamp >= startTime);
        }

        if (endDate) {
            const endTime = new Date(endDate).getTime();
            events = events.filter(e => e.timestamp <= endTime);
        }

        // Filter by type
        if (type) {
            events = events.filter(e => e.type === type);
        }

        // Filter by amount range
        if (minAmount !== undefined) {
            events = events.filter(e => parseFloat(e.amount) >= parseFloat(minAmount));
        }

        if (maxAmount !== undefined) {
            events = events.filter(e => parseFloat(e.amount) <= parseFloat(maxAmount));
        }

        // Filter by wallet address
        if (walletAddress) {
            const addr = walletAddress.toLowerCase();
            events = events.filter(e =>
                e.from?.toLowerCase() === addr || e.to?.toLowerCase() === addr
            );
        }

        // Filter by category
        if (category) {
            events = events.filter(e => e.category?.category === category);
        }

        // Keyword search (in addresses, tx hash, description)
        if (keyword) {
            const kw = keyword.toLowerCase();
            events = events.filter(e =>
                e.from?.toLowerCase().includes(kw) ||
                e.to?.toLowerCase().includes(kw) ||
                e.transactionHash?.toLowerCase().includes(kw) ||
                e.category?.description?.toLowerCase().includes(kw)
            );
        }

        // Limit results
        events = events.slice(0, limit);

        return events;
    }

    /**
     * Get transaction statistics
     */
    getStatistics(filters = {}) {
        const events = this.searchTransactions({ ...filters, limit: 10000 });

        const stats = {
            total: events.length,
            byType: {},
            byCategory: {},
            totalVolume: 0,
            totalVolumeUSD: 0,
            averageAmount: 0,
            largestTransaction: null,
            timeRange: {
                first: null,
                last: null
            },
            uniqueAddresses: new Set()
        };

        events.forEach(event => {
            // Count by type
            stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

            // Count by category
            if (event.category) {
                const cat = event.category.category;
                stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
            }

            // Calculate volumes
            const amount = parseFloat(event.amount) || 0;
            stats.totalVolume += amount;

            if (event.priceInfo && event.priceInfo.usdValue) {
                stats.totalVolumeUSD += event.priceInfo.usdValue;
            }

            // Track largest transaction
            if (!stats.largestTransaction || amount > parseFloat(stats.largestTransaction.amount)) {
                stats.largestTransaction = event;
            }

            // Track unique addresses
            if (event.from) stats.uniqueAddresses.add(event.from.toLowerCase());
            if (event.to) stats.uniqueAddresses.add(event.to.toLowerCase());

            // Track time range
            if (!stats.timeRange.first || event.timestamp < stats.timeRange.first) {
                stats.timeRange.first = event.timestamp;
            }
            if (!stats.timeRange.last || event.timestamp > stats.timeRange.last) {
                stats.timeRange.last = event.timestamp;
            }
        });

        stats.averageAmount = stats.total > 0 ? stats.totalVolume / stats.total : 0;
        stats.uniqueAddressCount = stats.uniqueAddresses.size;
        delete stats.uniqueAddresses; // Remove Set before JSON serialization

        return stats;
    }

    /**
     * Export transactions to CSV
     */
    exportToCSV(transactions) {
        const headers = [
            'Timestamp',
            'Type',
            'From',
            'To',
            'Amount',
            'Symbol',
            'USD Value',
            'Category',
            'Transaction Hash',
            'Block Number'
        ];

        const rows = transactions.map(tx => [
            new Date(tx.timestamp).toISOString(),
            tx.type || '',
            tx.from || '',
            tx.to || '',
            tx.amount || '',
            tx.tokenSymbol || tx.symbol || '',
            tx.priceInfo?.usdValue || '',
            tx.category?.label || '',
            tx.transactionHash || '',
            tx.blockNumber || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csvContent;
    }

    /**
     * Export transactions to JSON
     */
    exportToJSON(transactions) {
        return JSON.stringify(transactions, null, 2);
    }

    /**
     * Get transaction timeline (grouped by time intervals)
     */
    getTimeline(filters = {}, interval = 'hour') {
        const events = this.searchTransactions({ ...filters, limit: 10000 });

        const intervalMs = {
            'minute': 60000,
            'hour': 3600000,
            'day': 86400000,
            'week': 604800000,
            'month': 2592000000
        }[interval] || 3600000;

        const timeline = {};

        events.forEach(event => {
            const bucket = Math.floor(event.timestamp / intervalMs) * intervalMs;
            const key = new Date(bucket).toISOString();

            if (!timeline[key]) {
                timeline[key] = {
                    timestamp: bucket,
                    count: 0,
                    volume: 0,
                    volumeUSD: 0,
                    events: []
                };
            }

            timeline[key].count++;
            timeline[key].volume += parseFloat(event.amount) || 0;
            timeline[key].volumeUSD += event.priceInfo?.usdValue || 0;
            timeline[key].events.push(event);
        });

        return Object.values(timeline).sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Get top wallets by transaction volume
     */
    getTopWallets(filters = {}, limit = 10) {
        const events = this.searchTransactions({ ...filters, limit: 10000 });

        const walletStats = {};

        events.forEach(event => {
            const addresses = [event.from, event.to].filter(Boolean);
            const amount = parseFloat(event.amount) || 0;
            const usdValue = event.priceInfo?.usdValue || 0;

            addresses.forEach(addr => {
                const key = addr.toLowerCase();
                if (!walletStats[key]) {
                    walletStats[key] = {
                        address: addr,
                        txCount: 0,
                        volume: 0,
                        volumeUSD: 0,
                        sentCount: 0,
                        receivedCount: 0
                    };
                }

                walletStats[key].txCount++;
                walletStats[key].volume += amount;
                walletStats[key].volumeUSD += usdValue;

                if (event.from?.toLowerCase() === key) {
                    walletStats[key].sentCount++;
                }
                if (event.to?.toLowerCase() === key) {
                    walletStats[key].receivedCount++;
                }
            });
        });

        return Object.values(walletStats)
            .sort((a, b) => b.volumeUSD - a.volumeUSD)
            .slice(0, limit);
    }
}

export default AnalyticsService;
