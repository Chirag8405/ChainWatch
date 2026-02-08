/**
 * Authentication Routes
 * User registration, login, and profile management
 */

import { Router } from 'express';
import userManager from '../core/userManager.js';
import { generateToken, authenticate } from '../core/auth.js';

export function createAuthRoutes() {
    const router = Router();

    /**
     * POST /auth/register
     * Register a new user
     */
    router.post('/register', async (req, res) => {
        try {
            const { username, password, email } = req.body;

            // Validation
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }

            if (username.length < 3) {
                return res.status(400).json({ error: 'Username must be at least 3 characters' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            // Create user
            const user = await userManager.createUser(username, password, email);

            // Generate token
            const token = generateToken(user.userId, user.username);

            res.status(201).json({
                message: 'User created successfully',
                user,
                token
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(400).json({ error: error.message || 'Registration failed' });
        }
    });

    /**
     * POST /auth/login
     * Login user
     */
    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;

            // Validation
            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password are required' });
            }

            // Authenticate user
            const user = await userManager.authenticateUser(username, password);

            // Generate token
            const token = generateToken(user.userId, user.username);

            res.json({
                message: 'Login successful',
                user,
                token
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(401).json({ error: 'Invalid username or password' });
        }
    });

    /**
     * GET /auth/profile
     * Get current user profile (protected)
     */
    router.get('/profile', authenticate, (req, res) => {
        try {
            const user = userManager.getUserById(req.user.userId);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ user });
        } catch (error) {
            console.error('Profile error:', error);
            res.status(500).json({ error: 'Failed to fetch profile' });
        }
    });

    /**
     * POST /auth/change-password
     * Change user password (protected)
     */
    router.post('/change-password', authenticate, async (req, res) => {
        try {
            const { oldPassword, newPassword } = req.body;

            if (!oldPassword || !newPassword) {
                return res.status(400).json({ error: 'Old and new passwords are required' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'New password must be at least 6 characters' });
            }

            await userManager.changePassword(req.user.username, oldPassword, newPassword);

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            console.error('Password change error:', error);
            res.status(400).json({ error: error.message || 'Password change failed' });
        }
    });

    /**
     * DELETE /auth/account
     * Delete user account (protected)
     */
    router.delete('/account', authenticate, async (req, res) => {
        try {
            await userManager.deleteUser(req.user.username);
            res.json({ message: 'Account deleted successfully' });
        } catch (error) {
            console.error('Account deletion error:', error);
            res.status(500).json({ error: 'Failed to delete account' });
        }
    });

    /**
     * GET /auth/watchlist
     * Get user's watchlist (protected)
     */
    router.get('/watchlist', authenticate, (req, res) => {
        try {
            const watchlist = userManager.getWatchlist(req.user.username);
            res.json({ watchlist });
        } catch (error) {
            console.error('Watchlist error:', error);
            res.status(500).json({ error: 'Failed to fetch watchlist' });
        }
    });

    /**
     * PUT /auth/watchlist
     * Update user's watchlist (protected)
     */
    router.put('/watchlist', authenticate, (req, res) => {
        try {
            const { watchlist } = req.body;

            if (!Array.isArray(watchlist)) {
                return res.status(400).json({ error: 'Watchlist must be an array' });
            }

            userManager.updateWatchlist(req.user.username, watchlist);
            res.json({ message: 'Watchlist updated', watchlist });
        } catch (error) {
            console.error('Watchlist update error:', error);
            res.status(500).json({ error: 'Failed to update watchlist' });
        }
    });

    return router;
}

export default createAuthRoutes;
