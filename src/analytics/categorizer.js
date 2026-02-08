/**
 * Transaction Categorizer Module
 * Auto-detects transaction types: Swaps, Transfers, NFT purchases, Contract calls, etc.
 */

import { ethers } from 'ethers';

// Known DEX router addresses (lowercase for comparison)
const DEX_ROUTERS = {
    // Uniswap V2
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2',
    // Uniswap V3
    '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3',
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3 Router 2',
    // SushiSwap
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap',
    // PancakeSwap (BSC)
    '0x10ed43c718714eb63d5aa57b78b54704e256024e': 'PancakeSwap',
    // QuickSwap (Polygon)
    '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff': 'QuickSwap',
};

// Known NFT marketplace addresses
const NFT_MARKETPLACES = {
    '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b': 'OpenSea',
    '0x7f268357a8c2552623316e2562d90e642bb538e5': 'OpenSea (Wyvern)',
    '0x00000000006c3852cbef3e08e8df289169ede581': 'OpenSea (Seaport)',
    '0x59728544b08ab483533076417fbbb2fd0b17ce3a': 'LooksRare',
    '0x74312363e45dcaba76c59ec49a7aa8a65a67eed3': 'X2Y2',
    '0x00000000000001ad428e4906ae43d8f9852d0dd6': 'Blur',
};

// Common function signatures
const FUNCTION_SIGNATURES = {
    // DEX Swaps
    '0x38ed1739': 'swapExactTokensForTokens',
    '0x8803dbee': 'swapTokensForExactTokens',
    '0x7ff36ab5': 'swapExactETHForTokens',
    '0x18cbafe5': 'swapExactTokensForETH',
    '0xfb3bdb41': 'swapETHForExactTokens',
    '0x5c11d795': 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    '0xb6f9de95': 'swapExactETHForTokensSupportingFeeOnTransferTokens',
    '0x791ac947': 'swapExactTokensForETHSupportingFeeOnTransferTokens',

    // Token operations
    '0x095ea7b3': 'approve',
    '0xa9059cbb': 'transfer',
    '0x23b872dd': 'transferFrom',

    // Staking/Farming
    '0xe2bbb158': 'deposit',
    '0x2e1a7d4d': 'withdraw',
    '0x3ccfd60b': 'withdraw',
    '0xe2e40317': 'stake',
    '0x379607f5': 'claim',

    // NFT
    '0x42842e0e': 'safeTransferFrom',
    '0xb88d4fde': 'safeTransferFrom',
    '0xf242432a': 'safeTransferFrom(ERC1155)',
    '0xa22cb465': 'setApprovalForAll',

    // Lending
    '0xe8e33700': 'mint',
    '0xdb006a75': 'redeem',
    '0xc5ebeaec': 'borrow',
    '0x573ade81': 'repayBorrow',
};

class TransactionCategorizer {
    constructor() {
        this.provider = null;
    }

    /**
     * Set provider for transaction data fetching
     */
    setProvider(provider) {
        this.provider = provider;
    }

    /**
     * Categorize a transaction event
     * @param {Object} event - Event object with transaction details
     * @returns {Object} - Category information
     */
    async categorize(event) {
        // If it's native ETH transfer (no contract interaction)
        if (event.type === 'eth') {
            return this.categorizeETHTransfer(event);
        }

        // For token transfers, we need to check the transaction context
        if (event.transactionHash && this.provider) {
            try {
                const tx = await this.provider.getTransaction(event.transactionHash);
                if (tx && tx.to) {
                    return this.categorizeTokenTransaction(event, tx);
                }
            } catch (error) {
                console.error('Failed to fetch transaction for categorization:', error.message);
            }
        }

        // Default: Simple token transfer
        return {
            category: 'transfer',
            label: 'Token Transfer',
            description: 'ERC20 token transfer',
            color: '#10B981', // green
            icon: '💸',
            protocol: null
        };
    }

    /**
     * Categorize ETH transfers
     */
    categorizeETHTransfer(event) {
        return {
            category: 'eth_transfer',
            label: 'ETH Transfer',
            description: 'Native ETH transfer',
            color: '#627EEA', // ethereum blue
            icon: '⚡',
            protocol: 'Ethereum'
        };
    }

    /**
     * Categorize token transactions based on context
     */
    categorizeTokenTransaction(event, tx) {
        const toAddress = tx.to.toLowerCase();
        const inputData = tx.data;
        const methodId = inputData.slice(0, 10);

        // Check DEX interactions
        if (DEX_ROUTERS[toAddress]) {
            return {
                category: 'swap',
                label: 'DEX Swap',
                description: `Token swap on ${DEX_ROUTERS[toAddress]}`,
                color: '#F59E0B', // amber
                icon: '🔄',
                protocol: DEX_ROUTERS[toAddress]
            };
        }

        // Check NFT marketplace interactions
        if (NFT_MARKETPLACES[toAddress]) {
            return {
                category: 'nft',
                label: 'NFT Trade',
                description: `NFT transaction on ${NFT_MARKETPLACES[toAddress]}`,
                color: '#8B5CF6', // purple
                icon: '🖼️',
                protocol: NFT_MARKETPLACES[toAddress]
            };
        }

        // Check function signature
        const functionName = FUNCTION_SIGNATURES[methodId];

        if (functionName) {
            if (functionName.includes('swap') || functionName.includes('Swap')) {
                return {
                    category: 'swap',
                    label: 'Token Swap',
                    description: 'Decentralized exchange swap',
                    color: '#F59E0B', // amber
                    icon: '🔄',
                    protocol: 'DEX'
                };
            }

            if (functionName === 'approve') {
                return {
                    category: 'approval',
                    label: 'Token Approval',
                    description: 'Approved token spending',
                    color: '#6366F1', // indigo
                    icon: '✅',
                    protocol: null
                };
            }

            if (functionName.includes('stake') || functionName === 'deposit') {
                return {
                    category: 'defi',
                    label: 'DeFi Deposit',
                    description: 'Staking or liquidity provision',
                    color: '#14B8A6', // teal
                    icon: '🏦',
                    protocol: 'DeFi Protocol'
                };
            }

            if (functionName === 'withdraw' || functionName === 'claim') {
                return {
                    category: 'defi',
                    label: 'DeFi Withdrawal',
                    description: 'Unstaking or claiming rewards',
                    color: '#06B6D4', // cyan
                    icon: '💰',
                    protocol: 'DeFi Protocol'
                };
            }

            if (functionName.includes('mint')) {
                return {
                    category: 'mint',
                    label: 'Token Mint',
                    description: 'Minting new tokens/NFTs',
                    color: '#EC4899', // pink
                    icon: '🎨',
                    protocol: null
                };
            }

            if (functionName.includes('borrow') || functionName.includes('repay')) {
                return {
                    category: 'lending',
                    label: 'Lending',
                    description: 'Lending protocol interaction',
                    color: '#8B5CF6', // purple
                    icon: '🏦',
                    protocol: 'Lending Protocol'
                };
            }
        }

        // Check if it's a contract interaction (not just peer-to-peer transfer)
        if (inputData && inputData.length > 10) {
            return {
                category: 'contract',
                label: 'Contract Interaction',
                description: 'Smart contract call',
                color: '#64748B', // slate
                icon: '📝',
                protocol: null
            };
        }

        // Default: Simple transfer
        return {
            category: 'transfer',
            label: 'Token Transfer',
            description: event.direction === 'incoming' ? 'Received tokens' : 'Sent tokens',
            color: '#10B981', // green
            icon: event.direction === 'incoming' ? '📥' : '📤',
            protocol: null
        };
    }

    /**
     * Get category color for UI
     */
    getCategoryColor(category) {
        const colors = {
            'transfer': '#10B981',
            'eth_transfer': '#627EEA',
            'swap': '#F59E0B',
            'nft': '#8B5CF6',
            'approval': '#6366F1',
            'defi': '#14B8A6',
            'lending': '#8B5CF6',
            'mint': '#EC4899',
            'contract': '#64748B'
        };
        return colors[category] || '#94A3B8';
    }
}

export default TransactionCategorizer;
