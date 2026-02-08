/**
 * User Management Module
 * Simple file-based user storage with bcrypt password hashing
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USERS_FILE = join(__dirname, '../../data/users.json');
const SALT_ROUNDS = 10;

class UserManager {
    constructor() {
        this.users = this.loadUsers();
    }

    /**
     * Load users from file
     */
    loadUsers() {
        try {
            if (existsSync(USERS_FILE)) {
                const data = readFileSync(USERS_FILE, 'utf8');
                return JSON.parse(data);
            }
            return {};
        } catch (error) {
            console.error('Error loading users:', error);
            return {};
        }
    }

    /**
     * Save users to file
     */
    saveUsers() {
        try {
            const data = JSON.stringify(this.users, null, 2);
            writeFileSync(USERS_FILE, data, 'utf8');
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }

    /**
     * Create a new user
     */
    async createUser(username, password, email = null) {
        if (this.users[username]) {
            throw new Error('Username already exists');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.users[username] = {
            userId,
            username,
            password: hashedPassword,
            email,
            watchlists: [], // User-specific watchlists
            alertRules: [], // User-specific alert rules
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        this.saveUsers();

        return {
            userId,
            username,
            email,
            createdAt: this.users[username].createdAt
        };
    }

    /**
     * Authenticate user
     */
    async authenticateUser(username, password) {
        const user = this.users[username];

        if (!user) {
            throw new Error('Invalid username or password');
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            throw new Error('Invalid username or password');
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        this.saveUsers();

        return {
            userId: user.userId,
            username: user.username,
            email: user.email,
            lastLogin: user.lastLogin
        };
    }

    /**
     * Get user by username
     */
    getUser(username) {
        const user = this.users[username];
        if (!user) return null;

        return {
            userId: user.userId,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            watchlistCount: user.watchlists?.length || 0,
            alertRuleCount: user.alertRules?.length || 0
        };
    }

    /**
     * Get user by ID
     */
    getUserById(userId) {
        const username = Object.keys(this.users).find(
            key => this.users[key].userId === userId
        );

        return username ? this.getUser(username) : null;
    }

    /**
     * Update user watchlist
     */
    updateWatchlist(username, watchlist) {
        if (!this.users[username]) {
            throw new Error('User not found');
        }

        this.users[username].watchlists = watchlist;
        this.saveUsers();
    }

    /**
     * Get user watchlist
     */
    getWatchlist(username) {
        if (!this.users[username]) {
            throw new Error('User not found');
        }

        return this.users[username].watchlists || [];
    }

    /**
     * Add alert rule for user
     */
    addAlertRule(username, rule) {
        if (!this.users[username]) {
            throw new Error('User not found');
        }

        if (!this.users[username].alertRules) {
            this.users[username].alertRules = [];
        }

        this.users[username].alertRules.push({
            ...rule,
            id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString()
        });

        this.saveUsers();
        return this.users[username].alertRules[this.users[username].alertRules.length - 1];
    }

    /**
     * Get user alert rules
     */
    getAlertRules(username) {
        if (!this.users[username]) {
            throw new Error('User not found');
        }

        return this.users[username].alertRules || [];
    }

    /**
     * Delete alert rule
     */
    deleteAlertRule(username, ruleId) {
        if (!this.users[username]) {
            throw new Error('User not found');
        }

        this.users[username].alertRules = (this.users[username].alertRules || []).filter(
            rule => rule.id !== ruleId
        );

        this.saveUsers();
    }

    /**
     * Change user password
     */
    async changePassword(username, oldPassword, newPassword) {
        const user = this.users[username];

        if (!user) {
            throw new Error('User not found');
        }

        const isValid = await bcrypt.compare(oldPassword, user.password);

        if (!isValid) {
            throw new Error('Current password is incorrect');
        }

        user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        this.saveUsers();
    }

    /**
     * Delete user
     */
    deleteUser(username) {
        if (!this.users[username]) {
            throw new Error('User not found');
        }

        delete this.users[username];
        this.saveUsers();
    }

    /**
     * Get all users (admin only)
     */
    getAllUsers() {
        return Object.values(this.users).map(user => ({
            userId: user.userId,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            watchlistCount: user.watchlists?.length || 0,
            alertRuleCount: user.alertRules?.length || 0
        }));
    }
}

// Export singleton instance
const userManager = new UserManager();
export default userManager;
