import { useState } from 'react'
import { User, Lock, Mail, LogIn, UserPlus, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

const AuthModal = ({ onLogin, onClose }) => {
    const [isLogin, setIsLogin] = useState(true)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3002' : '')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register'
            const body = isLogin
                ? { username, password }
                : { username, password, email }

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed')
            }

            // Store token in localStorage
            localStorage.setItem('authToken', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))

            // Call parent callback
            onLogin(data.user, data.token)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const switchMode = () => {
        setIsLogin(!isLogin)
        setError('')
        setEmail('')
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md border-border/50">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            {isLogin ? <LogIn className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                            {isLogin ? 'Login' : 'Sign Up'}
                        </CardTitle>
                        <button
                            onClick={onClose}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                    <CardDescription>
                        {isLogin
                            ? 'Login to access your personalized watchlists and alerts'
                            : 'Create an account to start monitoring your wallets'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label className="flex text-sm font-medium mb-2 items-center gap-2">
                                <User className="w-4 h-4" />
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                required
                                minLength={3}
                                disabled={loading}
                            />
                        </div>

                        {/* Email (signup only) */}
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Email (optional)
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    disabled={loading}
                                />
                            </div>
                        )}

                        {/* Password */}
                        <div>
                            <label className="flex text-sm font-medium mb-2 items-center gap-2">
                                <Lock className="w-4 h-4" />
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                required
                                minLength={6}
                                disabled={loading}
                            />
                            {!isLogin && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Must be at least 6 characters
                                </p>
                            )}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-red-400">{error}</div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        >
                            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
                        </Button>

                        {/* Switch Mode */}
                        <div className="text-center text-sm">
                            <span className="text-muted-foreground">
                                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                            </span>
                            <button
                                type="button"
                                onClick={switchMode}
                                className="text-primary hover:underline font-medium"
                                disabled={loading}
                            >
                                {isLogin ? 'Sign Up' : 'Login'}
                            </button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

export default AuthModal
