/**
 * Storage Module
 * Persists event history to JSON file
 * Simple file-based storage for demo purposes
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STORAGE_FILE = join(__dirname, '..', '..', 'data', 'events.json');
const MAX_EVENTS = 500; // Keep last 500 events

class EventStorage {
  constructor() {
    this.events = [];
    this.initialized = false;
    this.saveTimeout = null;
  }

  /**
   * Initialize storage - load existing events from file
   */
  initialize() {
    try {
      // Ensure data directory exists
      const dataDir = dirname(STORAGE_FILE);
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      // Load existing events
      if (existsSync(STORAGE_FILE)) {
        const data = readFileSync(STORAGE_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        this.events = parsed.events || [];
        console.log(`Loaded ${this.events.length} events from storage`);
      } else {
        this.events = [];
        this.save(); // Create empty file
        console.log('Created new event storage file');
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize storage:', error.message);
      this.events = [];
      this.initialized = true;
      return false;
    }
  }

  /**
   * Add a new event to storage
   */
  addEvent(event) {
    const storageEvent = {
      ...event,
      storedAt: Date.now()
    };

    // Add to beginning (newest first)
    this.events.unshift(storageEvent);

    // Trim to max size
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(0, MAX_EVENTS);
    }

    // Save to file (async, debounced)
    this.saveAsync();

    return storageEvent;
  }

  /**
   * Get all events
   */
  getEvents(limit = 100) {
    return this.events.slice(0, limit);
  }

  /**
   * Get events for specific wallet
   */
  getEventsForWallet(walletAddress, limit = 100) {
    const normalized = walletAddress.toLowerCase();
    return this.events
      .filter(e =>
        e.from?.toLowerCase() === normalized ||
        e.to?.toLowerCase() === normalized
      )
      .slice(0, limit);
  }

  /**
   * Get event statistics
   */
  getStats() {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const eventsLast24h = this.events.filter(e => e.timestamp > oneDayAgo);
    const eventsLastHour = this.events.filter(e => e.timestamp > oneHourAgo);

    const ethEvents = this.events.filter(e => e.type === 'eth');
    const tokenEvents = this.events.filter(e => e.type === 'token');

    // Calculate total volume
    const ethVolume = ethEvents.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const tokenVolume = tokenEvents.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    return {
      totalEvents: this.events.length,
      eventsLast24h: eventsLast24h.length,
      eventsLastHour: eventsLastHour.length,
      ethEvents: ethEvents.length,
      tokenEvents: tokenEvents.length,
      ethVolume: ethVolume.toFixed(6),
      tokenVolume: tokenVolume.toFixed(6),
      oldestEvent: this.events.length > 0 ? this.events[this.events.length - 1].timestamp : null,
      newestEvent: this.events.length > 0 ? this.events[0].timestamp : null
    };
  }

  /**
   * Save events to file (synchronous)
   */
  save() {
    try {
      const dataDir = dirname(STORAGE_FILE);
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      const data = JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        count: this.events.length,
        events: this.events
      }, null, 2);

      writeFileSync(STORAGE_FILE, data, 'utf-8');
      return true;
    } catch (error) {
      console.error('Failed to save events:', error.message);
      return false;
    }
  }

  /**
   * Save events to file (async, debounced)
   */
  saveAsync() {
    // Debounce saves to avoid excessive disk writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.save();
    }, 1000); // Save at most once per second
  }

  /**
   * Clear all events
   */
  clear() {
    this.events = [];
    this.save();
    console.log('Event storage cleared');
  }
}

// Singleton instance
const storage = new EventStorage();

export default storage;
