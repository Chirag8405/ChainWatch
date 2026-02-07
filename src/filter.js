/**
 * Filter Module
 * Applies filtering rules to incoming Transfer events
 * - Minimum amount threshold
 * - Watched wallet list (for Telegram alerts only)
 * - Cooldown timer
 * - Transaction deduplication
 */

class TransferFilter {
  constructor(config) {
    this.config = config;
    this.processedTxHashes = new Set();
    this.lastAlertTime = new Map(); // wallet -> timestamp
    this.maxCacheSize = 10000; // Prevent memory bloat
  }

  /**
   * Apply all filter rules to an event
   * Returns { passed: boolean, reason: string, showInUI: boolean }
   */
  filter(event) {
    // 1. Check for duplicate transaction
    if (this.isDuplicate(event.transactionHash)) {
      return { 
        passed: false, 
        showInUI: false,
        reason: 'duplicate',
        message: 'Transaction already processed'
      };
    }

    // Mark as processed
    this.markProcessed(event.transactionHash);

    // 2. Check minimum amount threshold
    const thresholdResult = this.checkThreshold(event.amount);
    if (!thresholdResult.passed) {
      return {
        ...thresholdResult,
        showInUI: true  // Still show in UI even if below threshold
      };
    }

    // 3. Check if wallet is in watched list (if list is not empty)
    const watchedResult = this.checkWatchedWallets(event.from, event.to);
    if (!watchedResult.passed) {
      return {
        ...watchedResult,
        showInUI: true  // Still show in UI even if not watched
      };
    }

    // 4. Check cooldown timer
    const cooldownResult = this.checkCooldown(event.from, event.to);
    if (!cooldownResult.passed) {
      return {
        ...cooldownResult,
        showInUI: true  // Still show in UI even if on cooldown
      };
    }

    // Event passed all filters - will trigger Telegram alert
    this.updateCooldown(event.from, event.to);
    
    return {
      passed: true,
      showInUI: true,
      reason: 'matched',
      message: 'Event matched all filter criteria'
    };
  }

  /**
   * Check if transaction was already processed
   */
  isDuplicate(txHash) {
    return this.processedTxHashes.has(txHash);
  }

  /**
   * Mark transaction as processed
   */
  markProcessed(txHash) {
    // Prevent memory bloat by clearing old hashes
    if (this.processedTxHashes.size >= this.maxCacheSize) {
      const toDelete = Array.from(this.processedTxHashes).slice(0, 1000);
      toDelete.forEach(hash => this.processedTxHashes.delete(hash));
    }
    this.processedTxHashes.add(txHash);
  }

  /**
   * Check if amount meets minimum threshold
   */
  checkThreshold(amount) {
    const threshold = parseFloat(this.config.thresholdAmount) || 0;
    const eventAmount = parseFloat(amount);
    
    if (eventAmount < threshold) {
      return {
        passed: false,
        reason: 'below_threshold',
        message: `Amount ${amount} below threshold ${threshold}`
      };
    }
    
    return { passed: true };
  }

  /**
   * Check if either from or to address is in watched list
   * If watched list is empty, all wallets pass
   * Handles both string and object wallet formats
   */
  checkWatchedWallets(from, to) {
    const watchedWallets = this.config.watchedWallets || [];
    
    // If no wallets configured, pass all
    if (watchedWallets.length === 0) {
      return { passed: true };
    }
    
    // Normalize addresses for comparison
    // Extract addresses from wallet objects (supports both string and object formats)
    // Only include enabled wallets
    const normalizedFrom = from.toLowerCase();
    const normalizedTo = to.toLowerCase();
    const normalizedWatched = watchedWallets
      .filter(w => typeof w === 'string' || w.enabled !== false)
      .map(w => (typeof w === 'string' ? w : w.address).toLowerCase());
    
    const fromWatched = normalizedWatched.includes(normalizedFrom);
    const toWatched = normalizedWatched.includes(normalizedTo);
    
    if (!fromWatched && !toWatched) {
      return {
        passed: false,
        reason: 'not_watched',
        message: 'Neither sender nor receiver is in watched list'
      };
    }
    
    return { passed: true };
  }

  /**
   * Check if cooldown period has passed for involved wallets
   */
  checkCooldown(from, to) {
    const cooldownSeconds = parseInt(this.config.cooldownSeconds) || 0;
    
    if (cooldownSeconds === 0) {
      return { passed: true };
    }
    
    const now = Date.now();
    const cooldownMs = cooldownSeconds * 1000;
    
    // Check cooldown for both addresses
    const addresses = [from.toLowerCase(), to.toLowerCase()];
    
    for (const addr of addresses) {
      const lastAlert = this.lastAlertTime.get(addr);
      if (lastAlert && (now - lastAlert) < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - (now - lastAlert)) / 1000);
        return {
          passed: false,
          reason: 'cooldown',
          message: `Cooldown active for ${addr.slice(0, 10)}..., ${remainingSeconds}s remaining`
        };
      }
    }
    
    return { passed: true };
  }

  /**
   * Update cooldown timestamp for wallets
   */
  updateCooldown(from, to) {
    const now = Date.now();
    this.lastAlertTime.set(from.toLowerCase(), now);
    this.lastAlertTime.set(to.toLowerCase(), now);
    
    // Clean old cooldown entries (older than 1 hour)
    const oneHourAgo = now - 3600000;
    for (const [addr, time] of this.lastAlertTime.entries()) {
      if (time < oneHourAgo) {
        this.lastAlertTime.delete(addr);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = newConfig;
    console.log('Filter config updated');
  }

  /**
   * Get current filter stats
   */
  getStats() {
    return {
      processedCount: this.processedTxHashes.size,
      cooldownWallets: this.lastAlertTime.size,
      threshold: this.config.thresholdAmount,
      watchedWallets: this.config.watchedWallets?.length || 0,
      cooldownSeconds: this.config.cooldownSeconds
    };
  }

  /**
   * Clear all caches (for testing/reset)
   */
  clearCache() {
    this.processedTxHashes.clear();
    this.lastAlertTime.clear();
  }
}

export default TransferFilter;
