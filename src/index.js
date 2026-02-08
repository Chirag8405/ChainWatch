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

// Import modules - Feature-based organization
import BlockchainListener from './blockchain/listener.js';
import TransferFilter from './blockchain/filter.js';
import TelegramNotifier from './notifications/notifier.js';
import ConfigWatcher, { getDefaultConfigPath } from './core/configWatcher.js';
import WebSocketBroadcaster from './api/websocket.js';
import { createRoutes } from './api/routes.js';
import { createAuthRoutes } from './api/authRoutes.js';
import storage from './core/storage.js';
import TransactionCategorizer from './analytics/categorizer.js';
import PriceService from './analytics/priceService.js';
import PortfolioTracker from './analytics/portfolio.js';
import AlertRulesEngine from './core/alertRules.js';
import AnalyticsService from './analytics/analyticsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3002;
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
    this.categorizer = null;
    this.priceService = null;
    this.portfolioTracker = null;
    this.alertRulesEngine = null;
    this.analyticsService = null;
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

    // Initialize analytics service
    console.log('Initializing analytics service...');
    this.analyticsService = new AnalyticsService(storage);

    // 3. Initialize filter
    console.log('Initializing filter...');
    this.filter = new TransferFilter(config);

    // 4. Initialize transaction categorizer
    console.log('Initializing transaction categorizer...');
    this.categorizer = new TransactionCategorizer();

    // 5. Initialize price service
    console.log('Initializing price service...');
    this.priceService = new PriceService();

    // 6. Initialize Telegram notifier
    console.log('Initializing Telegram notifier...');
    this.notifier = new TelegramNotifier(config);
    this.notifier.initialize();

    // 7. Create HTTP server first (needed by WebSocket)
    console.log('Creating HTTP server...');
    this.app = express();
    this.server = createServer(this.app);

    // 8. Setup WebSocket server (with config provider for welcome message)
    console.log('Setting up WebSocket server...');
    this.wsServer = new WebSocketBroadcaster(this.server, () => this.configWatcher.getConfig());

    // 9. Initialize blockchain listener
    console.log('Initializing blockchain listener...');
    this.listener = new BlockchainListener(config, eventEmitter);

    // 10. Initialize portfolio tracker (needs provider from listener)
    console.log('Initializing portfolio tracker...');
    // Will be set after connection is established
    this.portfolioTracker = null;

    // 11. Setup event handlers
    this.setupEventHandlers();

    // 12. Start config file watcher
    this.configWatcher.startWatching();

    // 13. Connect to blockchain
    const connected = await this.listener.connect();
    if (connected) {
      // Set provider for categorizer and portfolio tracker
      this.categorizer.setProvider(this.listener.provider);
      this.portfolioTracker = new PortfolioTracker(this.listener.provider);

      // Initialize alert rules engine
      console.log('Initializing alert rules engine...');
      this.alertRulesEngine = new AlertRulesEngine(this.listener.provider, this.priceService);

      await this.listener.subscribe();
    }

    // 14. Setup Express routes (now that all components are initialized)
    console.log('Setting up API routes...');
    this.setupExpressServer();

    // 15. Setup graceful shutdown
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
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });

    // API routes (all components now initialized)
    const context = {
      listener: this.listener,
      filter: this.filter,
      notifier: this.notifier,
      configWatcher: this.configWatcher,
      wsServer: this.wsServer,
      categorizer: this.categorizer,
      priceService: this.priceService,
      portfolioTracker: this.portfolioTracker,
      alertRulesEngine: this.alertRulesEngine,
      analyticsService: this.analyticsService,
      storage,
      recentEvents
    };

    const apiRouter = createRoutes(context);
    console.log('createRoutes returned:', apiRouter);
    console.log('Router stack:', apiRouter.stack ? apiRouter.stack.length + ' routes' : 'NO STACK');
    this.app.use('/api', apiRouter);
    console.log('API routes registered under /api');

    // Authentication routes
    const authRouter = createAuthRoutes();
    this.app.use('/auth', authRouter);
    console.log('Auth routes registered under /auth');

    // Serve static UI (for production)
    this.app.use(express.static(join(__dirname, '..', 'ui', 'dist')));

    // Fallback to index.html for SPA routing
    this.app.get('*', (req, res) => {
      res.sendFile(join(__dirname, '..', 'ui', 'dist', 'index.html'));
    });

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

      // Categorize the transaction
      let category = null;
      if (this.categorizer) {
        try {
          category = await this.categorizer.categorize(event);
        } catch (error) {
          console.error('Failed to categorize transaction:', error.message);
        }
      }

      // Get USD value
      let priceInfo = null;
      if (this.priceService) {
        try {
          const tokenAddress = event.type === 'eth' ? 'ETH' : event.tokenAddress;
          priceInfo = await this.priceService.calculateUSDValue(
            tokenAddress,
            event.amount,
            'sepolia'
          );
        } catch (error) {
          console.error('Failed to get price info:', error.message);
        }
      }

      // Evaluate custom alert rules
      let triggeredRules = [];
      if (this.alertRulesEngine) {
        try {
          triggeredRules = await this.alertRulesEngine.evaluateRules(event);
          if (triggeredRules.length > 0) {
            console.log(`${triggeredRules.length} alert rule(s) triggered`);
          }
        } catch (error) {
          console.error('Failed to evaluate alert rules:', error.message);
        }
      }

      // Update portfolio tracker
      const watchedWallets = this.configWatcher.getConfig().watchedWallets || [];
      for (const wallet of watchedWallets) {
        const address = typeof wallet === 'string' ? wallet : wallet.address;
        if (address && this.portfolioTracker) {
          try {
            await this.portfolioTracker.updateFromEvent(event, address);
          } catch (error) {
            console.error('Failed to update portfolio:', error.message);
          }
        }
      }

      // Create event with metadata
      const eventWithMeta = {
        ...event,
        filterResult,
        category,
        priceInfo,
        triggeredRules,
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
      this.wsServer?.broadcastTransfer(eventWithMeta, filterResult);

      // Log result with category and price
      let logMsg = `Event MATCHED: ${event.amount} ${event.tokenSymbol}`;
      if (category) {
        logMsg += ` [${category.label}]`;
      }
      if (priceInfo && priceInfo.usdValue) {
        logMsg += ` ${priceInfo.formatted}`;
      }
      console.log(logMsg);

      // Send Telegram alert (with enhanced info)
      const alertResult = await this.notifier.sendAlert(eventWithMeta);

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
