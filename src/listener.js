/**
 * Blockchain Listener Module
 * Connects to Ethereum Sepolia via WebSocket and subscribes to ERC20 Transfer events
 * Also supports native ETH transfer tracking via block subscription
 */

import { ethers } from 'ethers';

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = 'Transfer(address,address,uint256)';
const TRANSFER_TOPIC = ethers.id(TRANSFER_EVENT_SIGNATURE);

// ERC20 ABI for Transfer event parsing
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

// Tracking modes
const TRACKING_MODES = {
  TOKEN: 'token',   // Only ERC20 token transfers
  ETH: 'eth',       // Only native ETH transfers
  ALL: 'all'        // Both token and ETH transfers
};

class BlockchainListener {
  constructor(config, eventEmitter) {
    this.config = config;
    this.eventEmitter = eventEmitter;
    this.provider = null;
    this.contract = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.tokenDecimals = 18;
    this.tokenSymbol = 'TOKEN';
    this.tokenName = 'Unknown Token';
    this.processedBlocks = new Set(); // Prevent duplicate block processing
  }

  /**
   * Initialize WebSocket connection to Sepolia
   */
  async connect() {
    try {
      const rpcUrl = process.env.SEPOLIA_WS_RPC;
      
      if (!rpcUrl) {
        throw new Error('SEPOLIA_WS_RPC environment variable not set');
      }

      console.log('Connecting to Sepolia WebSocket RPC...');
      
      this.provider = new ethers.WebSocketProvider(rpcUrl);
      
      // Handle connection events
      this.provider.websocket.on('open', () => {
        console.log('WebSocket connected to Sepolia');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.eventEmitter.emit('connection', { status: 'connected' });
      });

      this.provider.websocket.on('close', () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.eventEmitter.emit('connection', { status: 'disconnected' });
        this.attemptReconnect();
      });

      this.provider.websocket.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        this.eventEmitter.emit('connection', { status: 'error', error: error.message });
      });

      // Wait for connection
      await this.provider.getNetwork();
      
      // Fetch token metadata
      await this.fetchTokenMetadata();
      
      return true;
    } catch (error) {
      console.error('Failed to connect:', error.message);
      this.eventEmitter.emit('connection', { status: 'error', error: error.message });
      this.attemptReconnect();
      return false;
    }
  }

  /**
   * Fetch token metadata (decimals, symbol, name)
   */
  async fetchTokenMetadata() {
    try {
      const tokenAddress = this.config.tokenContract;
      this.contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      
      const [decimals, symbol, name] = await Promise.all([
        this.contract.decimals().catch(() => 18),
        this.contract.symbol().catch(() => 'TOKEN'),
        this.contract.name().catch(() => 'Unknown Token')
      ]);
      
      this.tokenDecimals = Number(decimals);
      this.tokenSymbol = symbol;
      this.tokenName = name;
      
      console.log(`Token: ${this.tokenName} (${this.tokenSymbol}), Decimals: ${this.tokenDecimals}`);
    } catch (error) {
      console.warn('Could not fetch token metadata, using defaults');
    }
  }

  /**
   * Subscribe to Transfer events on the configured token contract
   */
  async subscribe() {
    if (!this.provider || !this.isConnected) {
      console.error('Cannot subscribe: not connected');
      return false;
    }

    const trackingMode = this.config.trackingMode || 'all';
    console.log(`Tracking mode: ${trackingMode.toUpperCase()}`);

    try {
      // Subscribe to ERC20 token transfers
      if (trackingMode === 'token' || trackingMode === 'all') {
        await this.subscribeToTokenTransfers();
      }

      // Subscribe to native ETH transfers
      if (trackingMode === 'eth' || trackingMode === 'all') {
        await this.subscribeToEthTransfers();
      }

      return true;
    } catch (error) {
      console.error('Failed to subscribe:', error.message);
      return false;
    }
  }

  /**
   * Subscribe to ERC20 token Transfer events
   */
  async subscribeToTokenTransfers() {
    const tokenAddress = this.config.tokenContract;
    
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      console.warn('Invalid token contract address, skipping token tracking');
      return;
    }

    console.log(`Subscribing to Token Transfer events on ${tokenAddress}`);
    
    // Create filter for Transfer events
    const filter = {
      address: tokenAddress,
      topics: [TRANSFER_TOPIC]
    };

    // Listen for events
    this.provider.on(filter, async (log) => {
      await this.handleTokenTransferEvent(log);
    });

    console.log('Subscribed to Token Transfer events');
    this.eventEmitter.emit('subscribed', { tokenAddress, type: 'token' });
  }

  /**
   * Subscribe to native ETH transfers via block subscription
   */
  async subscribeToEthTransfers() {
    console.log('Subscribing to native ETH transfers...');
    
    this.provider.on('block', async (blockNumber) => {
      // Prevent duplicate processing
      if (this.processedBlocks.has(blockNumber)) return;
      this.processedBlocks.add(blockNumber);
      
      // Clean old block numbers to prevent memory bloat
      if (this.processedBlocks.size > 100) {
        const oldest = Array.from(this.processedBlocks).slice(0, 50);
        oldest.forEach(b => this.processedBlocks.delete(b));
      }

      await this.processBlockForEthTransfers(blockNumber);
    });

    console.log('Subscribed to ETH transfers (via block monitoring)');
    this.eventEmitter.emit('subscribed', { type: 'eth' });
  }

  /**
   * Process a block to find ETH transfers
   */
  async processBlockForEthTransfers(blockNumber) {
    try {
      const block = await this.provider.getBlock(blockNumber, true);
      
      if (!block || !block.prefetchedTransactions) return;

      for (const tx of block.prefetchedTransactions) {
        // Only process transactions with ETH value
        if (tx.value > 0n) {
          await this.handleEthTransfer(tx, blockNumber);
        }
      }
    } catch (error) {
      // Silently ignore block fetch errors (common during reorgs)
      if (!error.message.includes('could not coalesce')) {
        console.error(`Error processing block ${blockNumber}:`, error.message);
      }
    }
  }

  /**
   * Check if address is a watched wallet
   * Handles both string and object wallet formats
   */
  isWatchedWallet(from, to) {
    const watchedWallets = this.config.watchedWallets || [];
    if (watchedWallets.length === 0) return true; // If no wallets configured, show all
    
    // Extract addresses from wallet objects (supports both string and object formats)
    // Only include enabled wallets
    const normalizedWatched = watchedWallets
      .filter(w => typeof w === 'string' || w.enabled !== false)
      .map(w => (typeof w === 'string' ? w : w.address).toLowerCase());
    
    const normalizedFrom = from?.toLowerCase();
    const normalizedTo = to?.toLowerCase();
    
    return normalizedWatched.includes(normalizedFrom) || normalizedWatched.includes(normalizedTo);
  }

  /**
   * Handle native ETH transfer
   */
  async handleEthTransfer(tx, blockNumber) {
    // Skip if not a watched wallet
    if (!this.isWatchedWallet(tx.from, tx.to)) {
      return;
    }
    
    const amount = ethers.formatEther(tx.value);
    
    const event = {
      type: 'eth',
      from: tx.from,
      to: tx.to || 'Contract Creation',
      amount,
      rawAmount: tx.value.toString(),
      blockNumber,
      transactionHash: tx.hash,
      tokenSymbol: 'ETH',
      tokenName: 'Ethereum',
      timestamp: Date.now()
    };

    console.log(`💎 ETH Transfer: ${amount} ETH from ${tx.from.slice(0, 8)}... to ${(tx.to || 'contract').slice(0, 8)}...`);
    
    this.eventEmitter.emit('transfer', event);
  }

  /**
   * Handle incoming ERC20 Token Transfer event
   */
  async handleTokenTransferEvent(log) {
    try {
      // Parse the event data
      const iface = new ethers.Interface(ERC20_ABI);
      const parsed = iface.parseLog({
        topics: log.topics,
        data: log.data
      });

      // Extract transfer details
      const from = parsed.args[0];
      const to = parsed.args[1];
      const rawAmount = parsed.args[2];
      
      // Skip if not a watched wallet
      if (!this.isWatchedWallet(from, to)) {
        return;
      }
      
      // Format amount using token decimals
      const amount = ethers.formatUnits(rawAmount, this.tokenDecimals);
      
      const event = {
        type: 'token',
        from,
        to,
        amount,
        rawAmount: rawAmount.toString(),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        tokenSymbol: this.tokenSymbol,
        tokenName: this.tokenName,
        timestamp: Date.now()
      };

      console.log(`🔗 Token Transfer: ${amount} ${this.tokenSymbol} from ${from.slice(0, 8)}... to ${to.slice(0, 8)}...`);
      
      // Emit the event for processing
      this.eventEmitter.emit('transfer', event);
      
    } catch (error) {
      console.error('Error parsing transfer event:', error.message);
    }
  }

  /**
   * Attempt to reconnect on connection loss
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.eventEmitter.emit('connection', { status: 'failed', error: 'Max reconnection attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(async () => {
      const connected = await this.connect();
      if (connected) {
        await this.subscribe();
      }
    }, delay);
  }

  /**
   * Update configuration (called when config.json changes)
   */
  async updateConfig(newConfig) {
    const tokenChanged = this.config.tokenContract !== newConfig.tokenContract;
    const modeChanged = this.config.trackingMode !== newConfig.trackingMode;
    this.config = newConfig;
    
    if ((tokenChanged || modeChanged) && this.provider) {
      console.log('Config changed, resubscribing...');
      // Remove old listeners and resubscribe
      this.provider.removeAllListeners();
      this.processedBlocks.clear();
      await this.fetchTokenMetadata();
      await this.subscribe();
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      tokenAddress: this.config.tokenContract,
      tokenSymbol: this.tokenSymbol,
      tokenName: this.tokenName,
      trackingMode: this.config.trackingMode || 'all',
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    console.log('Disconnecting from blockchain...');
    
    if (this.provider) {
      this.provider.removeAllListeners();
      await this.provider.destroy();
      this.provider = null;
    }
    
    this.isConnected = false;
    this.eventEmitter.emit('connection', { status: 'disconnected' });
  }
}

export default BlockchainListener;
