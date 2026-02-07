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
      const configPath = path.join(__dirname, '..', 'config.json');
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
      const configPath = path.join(__dirname, '..', 'config.json');
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
      const configPath = path.join(__dirname, '..', 'config.json');
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

  return router;
}

export default createRoutes;
