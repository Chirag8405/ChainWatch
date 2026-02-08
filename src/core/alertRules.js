/**
 * Alert Rules Engine
 * Evaluates custom alert conditions (gas price, amount thresholds, etc.)
 */

import { ethers } from 'ethers';

// Rule types
export const RULE_TYPES = {
    GAS_PRICE: 'gas_price',           // Alert when gas price exceeds threshold
    AMOUNT_THRESHOLD: 'amount',        // Alert when transfer amount exceeds threshold
    TOKEN_PRICE: 'token_price',        // Alert when token USD price hits target
    WALLET_BALANCE: 'wallet_balance',  // Alert when wallet balance changes significantly
    TRANSACTION_COUNT: 'tx_count'      // Alert after N transactions in timeframe
};

// Comparison operators
export const OPERATORS = {
    GT: '>',   // Greater than
    LT: '<',   // Less than
    GTE: '>=', // Greater than or equal
    LTE: '<=', // Less than or equal
    EQ: '==',  // Equal to
    NEQ: '!='  // Not equal to
};

class AlertRulesEngine {
    constructor(provider, priceService) {
        this.provider = provider;
        this.priceService = priceService;
        this.rules = [];
        this.transactionCounts = new Map(); // Track tx counts per wallet
    }

    /**
     * Add a new alert rule
     */
    addRule(rule) {
        const ruleWithId = {
            id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            enabled: true,
            createdAt: new Date().toISOString(),
            ...rule
        };

        this.rules.push(ruleWithId);
        return ruleWithId;
    }

    /**
     * Remove a rule
     */
    removeRule(ruleId) {
        this.rules = this.rules.filter(r => r.id !== ruleId);
    }

    /**
     * Get all rules
     */
    getRules() {
        return this.rules;
    }

    /**
     * Update a rule
     */
    updateRule(ruleId, updates) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            Object.assign(rule, updates);
        }
        return rule;
    }

    /**
     * Evaluate all rules for a transaction event
     * Returns array of triggered rules
     */
    async evaluateRules(event) {
        const triggeredRules = [];

        for (const rule of this.rules) {
            if (!rule.enabled) continue;

            try {
                const triggered = await this.evaluateRule(rule, event);
                if (triggered) {
                    triggeredRules.push(rule);
                }
            } catch (error) {
                console.error(`Error evaluating rule ${rule.id}:`, error.message);
            }
        }

        return triggeredRules;
    }

    /**
     * Evaluate a single rule
     */
    async evaluateRule(rule, event) {
        switch (rule.type) {
            case RULE_TYPES.GAS_PRICE:
                return await this.evaluateGasPriceRule(rule, event);

            case RULE_TYPES.AMOUNT_THRESHOLD:
                return this.evaluateAmountRule(rule, event);

            case RULE_TYPES.TOKEN_PRICE:
                return await this.evaluateTokenPriceRule(rule, event);

            case RULE_TYPES.WALLET_BALANCE:
                return await this.evaluateBalanceRule(rule, event);

            case RULE_TYPES.TRANSACTION_COUNT:
                return this.evaluateTransactionCountRule(rule, event);

            default:
                console.warn('Unknown rule type:', rule.type);
                return false;
        }
    }

    /**
     * Evaluate gas price rule
     */
    async evaluateGasPriceRule(rule, event) {
        if (!this.provider || !event.transactionHash) return false;

        try {
            const tx = await this.provider.getTransaction(event.transactionHash);
            if (!tx) return false;

            const gasPriceGwei = parseFloat(ethers.formatUnits(tx.gasPrice || 0n, 'gwei'));
            return this.compareValues(gasPriceGwei, rule.operator, rule.threshold);
        } catch (error) {
            console.error('Gas price rule error:', error);
            return false;
        }
    }

    /**
     * Evaluate amount threshold rule
     */
    evaluateAmountRule(rule, event) {
        const amount = parseFloat(event.amount);
        return this.compareValues(amount, rule.operator, rule.threshold);
    }

    /**
     * Evaluate token price rule
     */
    async evaluateTokenPriceRule(rule, event) {
        if (!this.priceService) return false;

        try {
            const tokenSymbol = event.symbol?.toLowerCase() || 'eth';
            const priceData = await this.priceService.getPrice(tokenSymbol);

            if (!priceData || !priceData.price) return false;

            return this.compareValues(priceData.price, rule.operator, rule.threshold);
        } catch (error) {
            console.error('Token price rule error:', error);
            return false;
        }
    }

    /**
     * Evaluate wallet balance rule
     */
    async evaluateBalanceRule(rule, event) {
        if (!this.provider || !rule.walletAddress) return false;

        try {
            const balance = await this.provider.getBalance(rule.walletAddress);
            const balanceEth = parseFloat(ethers.formatEther(balance));

            return this.compareValues(balanceEth, rule.operator, rule.threshold);
        } catch (error) {
            console.error('Balance rule error:', error);
            return false;
        }
    }

    /**
     * Evaluate transaction count rule
     */
    evaluateTransactionCountRule(rule, event) {
        const walletAddress = rule.walletAddress?.toLowerCase();
        if (!walletAddress) return false;

        const key = `${walletAddress}_${rule.timeframe || '1h'}`;

        if (!this.transactionCounts.has(key)) {
            this.transactionCounts.set(key, {
                count: 0,
                firstTx: Date.now()
            });
        }

        const data = this.transactionCounts.get(key);
        data.count++;

        // Check if timeframe has expired
        const timeframeMs = this.parseTimeframe(rule.timeframe || '1h');
        if (Date.now() - data.firstTx > timeframeMs) {
            // Reset counter
            data.count = 1;
            data.firstTx = Date.now();
        }

        return this.compareValues(data.count, rule.operator, rule.threshold);
    }

    /**
     * Compare two values using an operator
     */
    compareValues(value, operator, threshold) {
        switch (operator) {
            case OPERATORS.GT:
                return value > threshold;
            case OPERATORS.LT:
                return value < threshold;
            case OPERATORS.GTE:
                return value >= threshold;
            case OPERATORS.LTE:
                return value <= threshold;
            case OPERATORS.EQ:
                return value === threshold;
            case OPERATORS.NEQ:
                return value !== threshold;
            default:
                return false;
        }
    }

    /**
     * Parse timeframe string to milliseconds
     */
    parseTimeframe(timeframe) {
        const match = timeframe.match(/^(\d+)([smhd])$/);
        if (!match) return 3600000; // Default 1 hour

        const value = parseInt(match[1]);
        const unit = match[2];

        const multipliers = {
            s: 1000,
            m: 60000,
            h: 3600000,
            d: 86400000
        };

        return value * (multipliers[unit] || 3600000);
    }

    /**
     * Get triggered rules summary
     */
    getRulesSummary() {
        return {
            total: this.rules.length,
            enabled: this.rules.filter(r => r.enabled).length,
            disabled: this.rules.filter(r => !r.enabled).length,
            byType: this.rules.reduce((acc, rule) => {
                acc[rule.type] = (acc[rule.type] || 0) + 1;
                return acc;
            }, {})
        };
    }
}

export default AlertRulesEngine;
