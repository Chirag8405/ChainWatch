/**
 * WebSocket Server Module
 * Broadcasts real-time events to connected UI clients
 */

import { WebSocketServer } from 'ws';

class WebSocketBroadcaster {
  constructor(server, configProvider = null) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.clients = new Set();
    this.configProvider = configProvider;
    
    this.setupConnectionHandler();
  }

  /**
   * Set the config provider (for getting current config)
   */
  setConfigProvider(configProvider) {
    this.configProvider = configProvider;
  }

  /**
   * Setup WebSocket connection handling
   */
  setupConnectionHandler() {
    this.wss.on('connection', (ws, req) => {
      console.log('UI client connected');
      this.clients.add(ws);
      
      // Get current config if provider is available
      const config = this.configProvider ? this.configProvider() : {};
      
      // Send welcome message with current state including watched wallets
      this.sendToClient(ws, {
        type: 'welcome',
        message: 'Connected to ChainWatch',
        config: {
          watchedWallets: config.watchedWallets || [],
          trackingMode: config.trackingMode || 'all',
          thresholdAmount: config.thresholdAmount || 0,
          cooldownSeconds: config.cooldownSeconds || 0,
          tokenContract: config.tokenContract || ''
        },
        timestamp: Date.now()
      });

      ws.on('close', () => {
        console.log('UI client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket client error:', error.message);
        this.clients.delete(ws);
      });

      // Handle ping/pong for keepalive
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });

    // Keepalive ping every 30 seconds
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          this.clients.delete(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  /**
   * Send message to a specific client
   */
  sendToClient(ws, data) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(type, data) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: Date.now()
    });

    this.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast transfer event
   */
  broadcastTransfer(event, filterResult) {
    this.broadcast('transfer', {
      event,
      filterResult
    });
  }

  /**
   * Broadcast connection status change
   */
  broadcastConnectionStatus(status) {
    this.broadcast('connection', status);
  }

  /**
   * Broadcast config change
   */
  broadcastConfigChange(configData) {
    this.broadcast('configChange', configData);
  }

  /**
   * Broadcast alert sent confirmation
   */
  broadcastAlertSent(alertData) {
    this.broadcast('alertSent', alertData);
  }

  /**
   * Get connected client count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Cleanup on shutdown
   */
  close() {
    clearInterval(this.pingInterval);
    
    this.clients.forEach((client) => {
      client.close(1000, 'Server shutting down');
    });
    
    this.wss.close();
    console.log('WebSocket server closed');
  }
}

export default WebSocketBroadcaster;
