/**
 * Config Watcher Module
 * Watches config.json for changes and triggers hot reload
 */

import { watch } from 'chokidar';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ConfigWatcher {
  constructor(configPath, eventEmitter) {
    this.configPath = configPath;
    this.eventEmitter = eventEmitter;
    this.watcher = null;
    this.config = null;
    this.debounceTimer = null;
    this.debounceMs = 500; // Prevent rapid reloads
  }

  /**
   * Load configuration from JSON file
   */
  loadConfig() {
    try {
      if (!existsSync(this.configPath)) {
        console.error(`Config file not found: ${this.configPath}`);
        return null;
      }

      const content = readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content);

      // Validate required fields
      this.validateConfig(config);

      this.config = config;
      console.log('Configuration loaded successfully');

      return config;
    } catch (error) {
      console.error('Failed to load config:', error.message);
      return this.config; // Return previous config on error
    }
  }

  /**
   * Validate configuration object
   */
  validateConfig(config) {
    const required = ['tokenContract'];
    const missing = required.filter(key => !config[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required config fields: ${missing.join(', ')}`);
    }

    // Set defaults for optional fields
    config.thresholdAmount = config.thresholdAmount ?? 0;
    config.watchedWallets = config.watchedWallets ?? [];
    config.cooldownSeconds = config.cooldownSeconds ?? 0;
    config.telegramChatId = config.telegramChatId ?? '';
    config.confirmationDepth = config.confirmationDepth ?? 0;

    return config;
  }

  /**
   * Start watching config file for changes
   */
  startWatching() {
    console.log(`Watching config file: ${this.configPath}`);

    this.watcher = watch(this.configPath, {
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('change', (path) => {
      this.handleConfigChange(path);
    });

    this.watcher.on('error', (error) => {
      console.error('Config watcher error:', error.message);
    });

    return this.watcher;
  }

  /**
   * Handle config file changes with debouncing
   */
  handleConfigChange(path) {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce to prevent rapid reloads
    this.debounceTimer = setTimeout(() => {
      console.log('Config file changed, reloading...');

      const oldConfig = { ...this.config };
      const newConfig = this.loadConfig();

      if (newConfig) {
        // Emit config change event with both old and new config
        this.eventEmitter.emit('configChange', {
          oldConfig,
          newConfig,
          changedFields: this.getChangedFields(oldConfig, newConfig)
        });
      }
    }, this.debounceMs);
  }

  /**
   * Get list of changed fields between configs
   */
  getChangedFields(oldConfig, newConfig) {
    if (!oldConfig) return Object.keys(newConfig);

    const changes = [];
    const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);

    for (const key of allKeys) {
      const oldVal = JSON.stringify(oldConfig[key]);
      const newVal = JSON.stringify(newConfig[key]);
      if (oldVal !== newVal) {
        changes.push(key);
      }
    }

    return changes;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Stop watching config file
   */
  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('Stopped watching config file');
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

/**
 * Get default config path
 */
export function getDefaultConfigPath() {
  return join(__dirname, '..', '..', 'config.json');
}

export default ConfigWatcher;
