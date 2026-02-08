/**
 * Express Routes Module
 * API endpoints for status and health checks
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create API routes
 * @param {Object} context - Application context with all modules
 */
export function createRoutes(context) {
  const router = Router();

  /**
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now()
    });
  });

  /**
   * Get current system status
   */
  router.get('/status', (req, res) => {
    const { listener, filter, notifier, wsServer, configWatcher } = context;

    res.json({
      blockchain: listener.getStatus(),
      filter: filter.getStats(),
      telegram: notifier.getStatus(),
      websocket: {
        connectedClients: wsServer.getClientCount()
      },
      config: configWatcher.getConfig(),
      uptime: process.uptime()
    });
  });

  /**
   * Get current configuration (without sensitive data)
   */
  router.get('/config', (req, res) => {
    const config = context.configWatcher.getConfig();

    res.json({
      tokenContract: config.tokenContract,
      trackingMode: config.trackingMode || 'all',
      thresholdAmount: config.thresholdAmount,
      watchedWallets: config.watchedWallets || [],
      watchedWalletsCount: config.watchedWallets?.length || 0,
      cooldownSeconds: config.cooldownSeconds,
      confirmationDepth: config.confirmationDepth,
      telegramConfigured: !!config.telegramChatId
    });
  });

  /**
   * Get recent events (from memory + storage)
   */
  router.get('/events', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const wallet = req.query.wallet;

    // Try to get events from storage first (persistent)
    if (context.storage) {
      const events = wallet
        ? context.storage.getEventsForWallet(wallet, limit)
        : context.storage.getEvents(limit);
      res.json({
        count: events.length,
        events,
        source: 'storage'
      });
    } else {
      // Fall back to memory
      const events = context.recentEvents || [];
      res.json({
        count: events.length,
        events: events.slice(-limit),
        source: 'memory'
      });
    }
  });

  /**
   * Get storage stats
   */
  router.get('/storage/stats', (req, res) => {
    if (context.storage) {
      res.json(context.storage.getStats());
    } else {
      res.json({ totalEvents: 0, wallets: {} });
    }
  });

  /**
   * Send test Telegram notification
   */
  router.post('/test-telegram', async (req, res) => {
    try {
      const result = await context.notifier.sendTestMessage();
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * Get filter statistics
   */
  router.get('/stats', (req, res) => {
    const stats = context.filter.getStats();
    const notifierStatus = context.notifier.getStatus();
    const storageStats = context.storage ? context.storage.getStats() : { totalEvents: 0 };

    res.json({
      filter: stats,
      alerts: {
        total: notifierStatus.alertCount,
        lastAlert: notifierStatus.lastAlert
      },
      storage: storageStats,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  });

  /**
   * Get watched wallets
   */
  router.get('/wallets', (req, res) => {
    const config = context.configWatcher.getConfig();
    res.json({
      wallets: config.watchedWallets || [],
      count: config.watchedWallets?.length || 0
    });
  });

  /**
   * Add a watched wallet
   */
  router.post('/wallets', (req, res) => {
    const { address, label } = req.body;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }

    try {
      const configPath = path.join(__dirname, '..', '..', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      // Normalize address to lowercase
      const normalizedAddress = address.toLowerCase();

      // Check if already exists
      const existingWallets = config.watchedWallets || [];
      const alreadyExists = existingWallets.some(w =>
        (typeof w === 'string' ? w : w.address).toLowerCase() === normalizedAddress
      );

      if (alreadyExists) {
        return res.status(400).json({
          success: false,
          error: 'Wallet already being watched'
        });
      }

      // Add wallet with optional label
      const walletEntry = label
        ? { address: normalizedAddress, label, enabled: true }
        : { address: normalizedAddress, label: `Wallet ${existingWallets.length + 1}`, enabled: true };

      config.watchedWallets = [...existingWallets, walletEntry];

      // Write back to config file (triggers hot reload)
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      res.json({
        success: true,
        message: 'Wallet added successfully',
        wallet: walletEntry,
        totalWallets: config.watchedWallets.length
      });
    } catch (error) {
      console.error('Error adding wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Remove a watched wallet
   */
  router.delete('/wallets/:address', (req, res) => {
    const { address } = req.params;

    try {
      const configPath = path.join(__dirname, '..', '..', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      const normalizedAddress = address.toLowerCase();
      const existingWallets = config.watchedWallets || [];

      const newWallets = existingWallets.filter(w =>
        (typeof w === 'string' ? w : w.address).toLowerCase() !== normalizedAddress
      );

      if (newWallets.length === existingWallets.length) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      config.watchedWallets = newWallets;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      res.json({
        success: true,
        message: 'Wallet removed successfully',
        totalWallets: newWallets.length
      });
    } catch (error) {
      console.error('Error removing wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Toggle wallet enabled/disabled
   */
  router.patch('/wallets/:address', (req, res) => {
    const { address } = req.params;
    const { enabled, label } = req.body;

    try {
      const configPath = path.join(__dirname, '..', '..', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      const normalizedAddress = address.toLowerCase();
      const existingWallets = config.watchedWallets || [];

      let found = false;
      const newWallets = existingWallets.map(w => {
        const walletAddr = typeof w === 'string' ? w : w.address;
        if (walletAddr.toLowerCase() === normalizedAddress) {
          found = true;
          const wallet = typeof w === 'string' ? { address: w, label: 'Wallet', enabled: true } : w;
          return {
            ...wallet,
            ...(enabled !== undefined && { enabled }),
            ...(label !== undefined && { label })
          };
        }
        return w;
      });

      if (!found) {
        return res.status(404).json({
          success: false,
          error: 'Wallet not found'
        });
      }

      config.watchedWallets = newWallets;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      res.json({
        success: true,
        message: 'Wallet updated successfully'
      });
    } catch (error) {
      console.error('Error updating wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get portfolio for a wallet
   */
  router.get('/portfolio/:address', async (req, res) => {
    const { address } = req.params;
    const { portfolioTracker, configWatcher } = context;

    if (!portfolioTracker) {
      return res.status(503).json({
        success: false,
        error: 'Portfolio tracker not initialized (blockchain not connected)'
      });
    }

    try {
      const config = configWatcher.getConfig();
      const tokenAddresses = config.tokenContract ? [config.tokenContract] : [];

      const portfolio = await portfolioTracker.getPortfolio(address, tokenAddresses);
      const stats = portfolioTracker.getStatistics(portfolio);

      res.json({
        success: true,
        portfolio,
        stats
      });
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get portfolio history
   */
  router.get('/portfolio/:address/history', (req, res) => {
    const { portfolioTracker } = context;

    if (!portfolioTracker) {
      return res.status(503).json({
        success: false,
        error: 'Portfolio tracker not initialized'
      });
    }

    try {
      const history = portfolioTracker.getHistory();
      res.json({
        success: true,
        history,
        count: history.length
      });
    } catch (error) {
      console.error('Error fetching portfolio history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get price for a token
   */
  router.get('/price/:tokenAddress', async (req, res) => {
    const { tokenAddress } = req.params;
    const { priceService } = context;

    if (!priceService) {
      return res.status(503).json({
        success: false,
        error: 'Price service not initialized'
      });
    }

    try {
      const price = tokenAddress.toLowerCase() === 'eth' || tokenAddress.toLowerCase() === 'native'
        ? await priceService.getNativeTokenPrice('ethereum')
        : await priceService.getTokenPrice(tokenAddress);

      if (!price) {
        return res.status(404).json({
          success: false,
          error: 'Price not found for this token'
        });
      }

      res.json({
        success: true,
        price
      });
    } catch (error) {
      console.error('Error fetching price:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /alert-rules
   * Get all alert rules
   */
  router.get('/alert-rules', (req, res) => {
    const { alertRulesEngine } = context;

    if (!alertRulesEngine) {
      return res.status(503).json({
        success: false,
        error: 'Alert rules engine not initialized'
      });
    }

    const rules = alertRulesEngine.getRules();
    const summary = alertRulesEngine.getRulesSummary();

    res.json({
      success: true,
      rules,
      summary
    });
  });

  /**
   * POST /alert-rules
   * Create a new alert rule
   */
  router.post('/alert-rules', (req, res) => {
    const { alertRulesEngine } = context;

    if (!alertRulesEngine) {
      return res.status(503).json({
        success: false,
        error: 'Alert rules engine not initialized'
      });
    }

    try {
      const { type, operator, threshold, description, walletAddress, timeframe } = req.body;

      if (!type || !operator || threshold === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: type, operator, threshold'
        });
      }

      const rule = alertRulesEngine.addRule({
        type,
        operator,
        threshold,
        description,
        walletAddress,
        timeframe
      });

      res.status(201).json({
        success: true,
        rule
      });
    } catch (error) {
      console.error('Error creating alert rule:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PATCH /alert-rules/:ruleId
   * Update an alert rule
   */
  router.patch('/alert-rules/:ruleId', (req, res) => {
    const { alertRulesEngine } = context;
    const { ruleId } = req.params;

    if (!alertRulesEngine) {
      return res.status(503).json({
        success: false,
        error: 'Alert rules engine not initialized'
      });
    }

    try {
      const rule = alertRulesEngine.updateRule(ruleId, req.body);

      if (!rule) {
        return res.status(404).json({
          success: false,
          error: 'Rule not found'
        });
      }

      res.json({
        success: true,
        rule
      });
    } catch (error) {
      console.error('Error updating alert rule:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /analytics/search
   * Search transactions with advanced filters
   */
  router.post('/analytics/search', (req, res) => {
    const { analyticsService } = context;

    if (!analyticsService) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not initialized'
      });
    }

    try {
      const results = analyticsService.searchTransactions(req.body);

      res.json({
        success: true,
        count: results.length,
        transactions: results
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /analytics/stats
   * Get statistical analysis of transactions
   */
  router.post('/analytics/stats', (req, res) => {
    const { analyticsService } = context;

    if (!analyticsService) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not initialized'
      });
    }

    try {
      const stats = analyticsService.getStatistics(req.body);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /analytics/export
   * Export transactions to CSV or JSON
   */
  router.post('/analytics/export', (req, res) => {
    const { analyticsService } = context;
    const { format = 'csv', ...filters } = req.body;

    if (!analyticsService) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not initialized'
      });
    }

    try {
      const transactions = analyticsService.searchTransactions(filters);

      let content, contentType, filename;

      if (format === 'json') {
        content = analyticsService.exportToJSON(transactions);
        contentType = 'application/json';
        filename = `chainwatch-export-${Date.now()}.json`;
      } else {
        content = analyticsService.exportToCSV(transactions);
        contentType = 'text/csv';
        filename = `chainwatch-export-${Date.now()}.csv`;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /analytics/timeline
   * Get transaction timeline data
   */
  router.post('/analytics/timeline', (req, res) => {
    const { analyticsService } = context;
    const { interval = 'hour', ...filters } = req.body;

    if (!analyticsService) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not initialized'
      });
    }

    try {
      const timeline = analyticsService.getTimeline(filters, interval);

      res.json({
        success: true,
        timeline
      });
    } catch (error) {
      console.error('Timeline error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /** 
   * POST /analytics/top-wallets
   * Get top wallets by volume
   */
  router.post('/analytics/top-wallets', (req, res) => {
    const { analyticsService } = context;
    const { limit = 10, ...filters } = req.body;

    if (!analyticsService) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not initialized'
      });
    }

    try {
      const topWallets = analyticsService.getTopWallets(filters, limit);

      res.json({
        success: true,
        wallets: topWallets
      });
    } catch (error) {
      console.error('Top wallets error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /alert-rules/:ruleId
   * Delete an alert rule
   */
  router.delete('/alert-rules/:ruleId', (req, res) => {
    const { alertRulesEngine } = context;
    const { ruleId } = req.params;

    if (!alertRulesEngine) {
      return res.status(503).json({
        success: false,
        error: 'Alert rules engine not initialized'
      });
    }

    try {
      alertRulesEngine.removeRule(ruleId);

      res.json({
        success: true,
        message: 'Rule deleted'
      });
    } catch (error) {
      console.error('Error deleting alert rule:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createRoutes;
