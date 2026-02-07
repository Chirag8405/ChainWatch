/**
 * Telegram Notifier Module
 * Sends formatted alerts to Telegram chat
 */

import TelegramBot from 'node-telegram-bot-api';

class TelegramNotifier {
  constructor(config) {
    this.config = config;
    this.bot = null;
    this.isEnabled = false;
    this.lastAlertSent = null;
    this.alertCount = 0;
  }

  /**
   * Initialize Telegram bot
   */
  initialize() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      console.warn('TELEGRAM_BOT_TOKEN not set - notifications disabled');
      this.isEnabled = false;
      return false;
    }

    if (!this.config.telegramChatId) {
      console.warn('telegramChatId not configured - notifications disabled');
      this.isEnabled = false;
      return false;
    }

    try {
      // Initialize bot in polling mode (simpler, no webhook needed)
      this.bot = new TelegramBot(token, { polling: false });
      this.isEnabled = true;
      console.log('Telegram bot initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error.message);
      this.isEnabled = false;
      return false;
    }
  }

  /**
   * Send transfer alert to Telegram with retry logic
   */
  async sendAlert(event, retries = 5) {
    if (!this.isEnabled || !this.bot) {
      console.log('Telegram notifications disabled, skipping alert');
      return { success: false, reason: 'disabled' };
    }

    const message = this.formatAlertMessage(event);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.bot.sendMessage(this.config.telegramChatId, message, {
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });

        this.lastAlertSent = {
          timestamp: Date.now(),
          transactionHash: event.transactionHash,
          amount: event.amount
        };
        this.alertCount++;

        console.log(`Telegram alert sent for tx ${event.transactionHash.slice(0, 10)}...`);
        
        return { success: true };
      } catch (error) {
        const errorMsg = error.message || error.code || 'Unknown error';
        console.error(`Telegram attempt ${attempt}/${retries} failed: ${errorMsg}`);
        
        // Check if it's a network error (retry-able)
        const isNetworkError = errorMsg.includes('ECONNRESET') || 
                               errorMsg.includes('ETIMEDOUT') ||
                               errorMsg.includes('ENOTFOUND') ||
                               errorMsg.includes('socket hang up') ||
                               errorMsg.includes('network');
        
        if (attempt < retries) {
          // Longer delays for network errors (2s, 4s, 8s, 16s)
          const delay = isNetworkError 
            ? Math.pow(2, attempt) * 1000 
            : Math.pow(2, attempt - 1) * 1000;
          console.log(`Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`Failed to send Telegram alert after ${retries} attempts`);
    return { success: false, reason: 'max_retries_exceeded' };
  }

  /**
   * Format the alert message with nice formatting
   */
  formatAlertMessage(event) {
    const etherscanBase = 'https://sepolia.etherscan.io';
    
    return `<b>Transfer Alert</b>

<b>Amount:</b> ${this.formatAmount(event.amount)} ${event.tokenSymbol}

<b>From:</b>
<code>${event.from}</code>

<b>To:</b>
<code>${event.to}</code>

<b>Block:</b> ${event.blockNumber}

<a href="${etherscanBase}/tx/${event.transactionHash}">View on Etherscan</a>

${new Date(event.timestamp).toLocaleString()}`;
  }

  /**
   * Format amount with proper decimals
   */
  formatAmount(amount) {
    const num = parseFloat(amount);
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    } else if (num >= 1) {
      return num.toFixed(4);
    } else {
      return num.toFixed(8);
    }
  }

  /**
   * Send a test message to verify bot is working
   */
  async sendTestMessage() {
    if (!this.isEnabled || !this.bot) {
      return { success: false, reason: 'Bot not initialized' };
    }

    try {
      await this.bot.sendMessage(
        this.config.telegramChatId,
        '<b>ChainWatch Test</b>\n\nTelegram notifications are working!',
        { parse_mode: 'HTML' }
      );
      return { success: true };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    const chatIdChanged = this.config.telegramChatId !== newConfig.telegramChatId;
    this.config = newConfig;
    
    if (chatIdChanged) {
      console.log('Telegram chat ID updated');
    }
    
    // Re-check if bot should be enabled
    if (!this.isEnabled && newConfig.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
      this.initialize();
    }
  }

  /**
   * Get notifier status
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      chatId: this.config.telegramChatId ? '***configured***' : 'not configured',
      alertCount: this.alertCount,
      lastAlert: this.lastAlertSent
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.bot) {
      this.bot = null;
    }
    this.isEnabled = false;
  }
}

export default TelegramNotifier;
