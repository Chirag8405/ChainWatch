/**
 * ChainWatch - Main Entry Point
 * Real-time ERC20 Transfer event indexer with Telegram notifications
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import modules
import BlockchainListener from './listener.js';
import TransferFilter from './filter.js';
import TelegramNotifier from './notifier.js';
import ConfigWatcher, { getDefaultConfigPath } from './configWatcher.js';
import WebSocketBroadcaster from './websocket.js';
import { createRoutes } from './routes.js';
import storage from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Application state
const eventEmitter = new EventEmitter();
const recentEvents = []; // In-memory event storage (also persisted via storage module)
const MAX_RECENT_EVENTS = 100;

/**
 * Main application class
 */
class ChainWatch {
  constructor() {
    this.app = express();
    this.server = null;
    this.listener = null;
    this.filter = null;
    this.notifier = null;
    this.configWatcher = null;
    this.wsServer = null;
  }

  /**
   * Initialize all components
   */
  async initialize() {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     ChainWatch - Blockchain Event Indexer             ║
║                                                       ║
║   Real-time ERC20 Transfer monitoring for Sepolia     ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);

    // 1. Load configuration
    console.log('Loading configuration...');
    this.configWatcher = new ConfigWatcher(getDefaultConfigPath(), eventEmitter);
    const config = this.configWatcher.loadConfig();
    
    if (!config) {
      console.error('Failed to load configuration. Exiting.');
      process.exit(1);
    }

    // 2. Initialize storage (persistent event history)
    console.log('Initializing storage...');
    storage.initialize();
    
    // Load stored events into memory
    const storedEvents = storage.getEvents(100);
    storedEvents.reverse().forEach(e => recentEvents.push(e));

    // 3. Initialize filter
    console.log('Initializing filter...');
    this.filter = new TransferFilter(config);

    // 4. Initialize Telegram notifier
    console.log('Initializing Telegram notifier...');
    this.notifier = new TelegramNotifier(config);
    this.notifier.initialize();

    // 5. Setup Express server
    console.log('Setting up HTTP server...');
    this.setupExpressServer();

    // 6. Setup WebSocket server (with config provider for welcome message)
    console.log('Setting up WebSocket server...');
    this.wsServer = new WebSocketBroadcaster(this.server, () => this.configWatcher.getConfig());

    // 7. Initialize blockchain listener
    console.log('Initializing blockchain listener...');
    this.listener = new BlockchainListener(config, eventEmitter);

    // 8. Setup event handlers
    this.setupEventHandlers();

    // 9. Start config file watcher
    this.configWatcher.startWatching();

    // 10. Connect to blockchain
    const connected = await this.listener.connect();
    if (connected) {
      await this.listener.subscribe();
    }

    // 10. Setup graceful shutdown
    this.setupGracefulShutdown();

    console.log(`
ChainWatch is running!

Dashboard:     http://localhost:${PORT}
WebSocket:     ws://localhost:${PORT}/ws
API Status:    http://localhost:${PORT}/api/status

Waiting for Transfer events...
    `);
  }

  /**
   * Setup Express server with routes
   */
  setupExpressServer() {
    // Middleware
    this.app.use(express.json());
    
    // CORS for UI
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // API routes
    const context = {
      listener: this.listener,
      filter: this.filter,
      notifier: this.notifier,
      configWatcher: this.configWatcher,
      wsServer: this.wsServer,
      storage,
      recentEvents
    };
    
    // Delayed route setup (listener not yet initialized)
    this.app.use('/api', (req, res, next) => {
      context.listener = this.listener;
      context.wsServer = this.wsServer;
      next();
    }, createRoutes(context));

    // Serve static UI (for production)
    this.app.use(express.static(join(__dirname, '..', 'ui', 'dist')));
    
    // Fallback to index.html for SPA routing
    this.app.get('*', (req, res) => {
      res.sendFile(join(__dirname, '..', 'ui', 'dist', 'index.html'));
    });

    // Create HTTP server
    this.server = createServer(this.app);
    
    this.server.listen(PORT, HOST, () => {
      console.log(`Server listening on http://${HOST}:${PORT}`);
    });
  }

  /**
   * Setup event handlers for the event-driven architecture
   */
  setupEventHandlers() {
    // Handle blockchain connection status changes
    eventEmitter.on('connection', (status) => {
      console.log(`Connection status: ${status.status}`);
      this.wsServer?.broadcastConnectionStatus(status);
    });

    // Handle incoming transfer events
    eventEmitter.on('transfer', async (event) => {
      // Apply filter
      const filterResult = this.filter.filter(event);
      
      // Skip duplicates entirely
      if (filterResult.reason === 'duplicate') {
        return;
      }
      
      // ONLY process events that match watched wallet
      if (!filterResult.passed) {
        // Silently skip non-watched wallet events
        return;
      }
      
      // Create event with metadata
      const eventWithMeta = {
        ...event,
        filterResult,
        processedAt: Date.now()
      };
      
      // Store event in memory (ONLY wallet events)
      recentEvents.push(eventWithMeta);
      
      // Keep only recent events in memory
      if (recentEvents.length > MAX_RECENT_EVENTS) {
        recentEvents.shift();
      }
      
      // Persist to storage (JSON file)
      storage.addEvent(eventWithMeta);

      // Broadcast ONLY wallet events to UI
      this.wsServer?.broadcastTransfer(event, filterResult);

      // Log result
      console.log(`Event MATCHED: ${event.amount} ${event.tokenSymbol}`);
      
      // Send Telegram alert
      const alertResult = await this.notifier.sendAlert(event);
      
      if (alertResult.success) {
        this.wsServer?.broadcastAlertSent({
          transactionHash: event.transactionHash,
          amount: event.amount,
          timestamp: Date.now()
        });
      }
    });

    // Handle subscription confirmation
    eventEmitter.on('subscribed', (data) => {
      console.log(`Subscribed to token: ${data.tokenAddress}`);
      this.wsServer?.broadcast('subscribed', data);
    });

    // Handle config changes
    eventEmitter.on('configChange', ({ oldConfig, newConfig, changedFields }) => {
      console.log(`Config changed: ${changedFields.join(', ')}`);
      
      // Update all modules with new config
      this.listener?.updateConfig(newConfig);
      this.filter?.updateConfig(newConfig);
      this.notifier?.updateConfig(newConfig);
      
      // Broadcast to UI
      this.wsServer?.broadcastConfigChange({
        changedFields,
        newConfig: {
          tokenContract: newConfig.tokenContract,
          trackingMode: newConfig.trackingMode || 'all',
          thresholdAmount: newConfig.thresholdAmount,
          watchedWallets: newConfig.watchedWallets || [],
          watchedWalletsCount: newConfig.watchedWallets?.length || 0,
          cooldownSeconds: newConfig.cooldownSeconds
        }
      });
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      
      // Stop config watcher
      this.configWatcher?.stopWatching();
      
      // Disconnect from blockchain
      await this.listener?.disconnect();
      
      // Close WebSocket server
      this.wsServer?.close();
      
      // Close HTTP server
      this.server?.close(() => {
        console.log('ChainWatch stopped.');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection:', reason);
    });
  }
}

// Start the application
const app = new ChainWatch();
app.initialize().catch((error) => {
  console.error('Failed to start ChainWatch:', error);
  process.exit(1);
});
