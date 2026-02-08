/**
 * Authentication Middleware
 * JWT-based authentication for protecting routes
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chainwatch-secret-key-change-in-production';
const JWT_EXPIRY = '7d'; // 7 days

/**
 * Generate JWT token for a user
 */
export function generateToken(userId, username) {
    return jwt.sign(
        { userId, username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Authentication middleware
 * Protects routes by requiring valid JWT token
 */
export function authenticate(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Attach user info to request
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
}

/**
 * Optional authentication middleware
 * Adds user info if token is present, but doesn't require it
 */
export function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);

            if (decoded) {
                req.user = decoded;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
}

export default {
    authenticate,
    optionalAuth,
    generateToken,
    verifyToken
};
