import { useState, useEffect } from 'react'
import { Bell, Plus, Trash2, Power, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const AlertRulesManager = () => {
    const [rules, setRules] = useState([])
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showAddForm, setShowAddForm] = useState(false)
    const [newRule, setNewRule] = useState({
        type: 'gas_price',
        operator: '>',
        threshold: '',
        description: ''
    })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3002' : '')

    useEffect(() => {
        fetchRules()
    }, [])

    const fetchRules = async () => {
        try {
            const response = await fetch(`${API_URL}/api/alert-rules`)
            const data = await response.json()

            if (data.success) {
                setRules(data.rules || [])
                setSummary(data.summary)
            }
        } catch (err) {
            console.error('Failed to fetch rules:', err)
        } finally {
            setLoading(false)
        }
    }

    const createRule = async () => {
        setError('')
        setSaving(true)

        try {
            if (!newRule.threshold || isNaN(newRule.threshold)) {
                throw new Error('Please enter a valid threshold value')
            }

            const response = await fetch(`${API_URL}/api/alert-rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newRule,
                    threshold: parseFloat(newRule.threshold)
                })
            })

            const data = await response.json()

            if (!data.success) {
                throw new Error(data.error || 'Failed to create rule')
            }

            // Refresh rules
            await fetchRules()

            // Reset form
            setNewRule({
                type: 'gas_price',
                operator: '>',
                threshold: '',
                description: ''
            })
            setShowAddForm(false)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteRule = async (ruleId) => {
        if (!confirm('Delete this alert rule?')) return

        try {
            const response = await fetch(`${API_URL}/api/alert-rules/${ruleId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                await fetchRules()
            }
        } catch (err) {
            console.error('Failed to delete rule:', err)
        }
    }

    const toggleRule = async (ruleId, currentEnabled) => {
        try {
            await fetch(`${API_URL}/api/alert-rules/${ruleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !currentEnabled })
            })
            await fetchRules()
        } catch (err) {
            console.error('Failed to toggle rule:', err)
        }
    }

    const getRuleTypeLabel = (type) => {
        const labels = {
            gas_price: { label: 'Gas Price Alert', icon: '⛽', color: 'orange' },
            amount: { label: 'Amount Threshold', icon: '💰', color: 'green' },
            token_price: { label: 'Token Price Alert', icon: '📈', color: 'blue' },
            wallet_balance: { label: 'Balance Alert', icon: '👛', color: 'purple' },
            tx_count: { label: 'Transaction Count', icon: '🔢', color: 'pink' }
        }
        return labels[type] || { label: type, icon: '🔔', color: 'gray' }
    }

    const getUnit = (type) => {
        switch (type) {
            case 'gas_price': return 'Gwei'
            case 'token_price': return 'USD'
            case 'wallet_balance': return 'ETH'
            case 'tx_count': return 'txs'
            default: return ''
        }
    }

    if (loading) {
        return (
            <Card className="border-border/50">
                <CardContent className="p-16 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Loading alert rules...</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-border/50">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Bell className="w-5 h-5" />
                            Custom Alert Rules
                        </CardTitle>
                        <CardDescription>
                            Create custom conditions to trigger alerts
                        </CardDescription>
                    </div>
                    <Button
                        onClick={() => setShowAddForm(!showAddForm)}
                        size="sm"
                        className="bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Rule
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Summary */}
                {summary && (
                    <div className="grid grid-cols-3 gap-2 ">
                        <div className="p-3 bg-white/5 border border-white/10 rounded-md text-center">
                            <div className="text-2xl font-bold text-foreground">{summary.total}</div>
                            <div className="text-xs text-muted-foreground">Total Rules</div>
                        </div>
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md text-center">
                            <div className="text-2xl font-bold text-green-400">{summary.enabled}</div>
                            <div className="text-xs text-green-400">Active</div>
                        </div>
                        <div className="p-3 bg-gray-500/10 border border-gray-500/20 rounded-md text-center">
                            <div className="text-2xl font-bold text-gray-400">{summary.disabled}</div>
                            <div className="text-xs text-gray-400">Disabled</div>
                        </div>
                    </div>
                )}

                {/* Add Rule Form */}
                {showAddForm && (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-md space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Create New Alert Rule
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium mb-1">Rule Type</label>
                                <select
                                    value={newRule.type}
                                    onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                                    className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="gas_price">Gas Price Alert</option>
                                    <option value="amount">Amount Threshold</option>
                                    <option value="token_price">Token Price Alert</option>
                                    <option value="wallet_balance">Wallet Balance Alert</option>
                                    <option value="tx_count">Transaction Count</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">Operator</label>
                                <select
                                    value={newRule.operator}
                                    onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                                    className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value=">">Greater than (&gt;)</option>
                                    <option value="<">Less than (&lt;)</option>
                                    <option value=">=">Greater or equal (≥)</option>
                                    <option value="<=">Less or equal (≤)</option>
                                    <option value="==">Equals (=)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1">
                                Threshold ({getUnit(newRule.type)})
                            </label>
                            <input
                                type="number"
                                step="any"
                                placeholder="Enter threshold value"
                                value={newRule.threshold}
                                onChange={(e) => setNewRule({ ...newRule, threshold: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium mb-1">Description (optional)</label>
                            <input
                                type="text"
                                placeholder="e.g., Alert when gas is expensive"
                                value={newRule.description}
                                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-md">
                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                <div className="text-xs text-red-400">{error}</div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button
                                onClick={createRule}
                                disabled={saving}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                size="sm"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                <span className="ml-2">{saving ? 'Creating...' : 'Create Rule'}</span>
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowAddForm(false)
                                    setError('')
                                }}
                                variant="ghost"
                                size="sm"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                {/* Rules List */}
                <div className="space-y-2">
                    {rules.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No alert rules configured</p>
                            <p className="text-xs mt-1">Create your first rule to get custom alerts</p>
                        </div>
                    ) : (
                        rules.map((rule) => {
                            const typeInfo = getRuleTypeLabel(rule.type)
                            return (
                                <div
                                    key={rule.id}
                                    className={`flex items-center gap-3 p-3 border rounded-md transition-colors ${rule.enabled
                                            ? 'border-border bg-card'
                                            : 'border-muted bg-muted/50 opacity-60'
                                        }`}
                                >
                                    <div className="text-2xl">{typeInfo.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-sm">{typeInfo.label}</span>
                                            <Badge variant={rule.enabled ? 'success' : 'secondary'} className="text-xs">
                                                {rule.enabled ? 'Active' : 'Disabled'}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Alert when value {rule.operator} {rule.threshold} {getUnit(rule.type)}
                                        </div>
                                        {rule.description && (
                                            <div className="text-xs text-muted-foreground italic mt-1">
                                                {rule.description}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => toggleRule(rule.id, rule.enabled)}
                                            title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                                            className="p-2 rounded-md hover:bg-secondary transition-colors"
                                        >
                                            <Power className={`w-4 h-4 ${rule.enabled ? 'text-green-400' : 'text-gray-400'}`} />
                                        </button>
                                        <button
                                            onClick={() => deleteRule(rule.id)}
                                            title="Delete rule"
                                            className="p-2 rounded-md hover:bg-red-500/20 text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export default AlertRulesManager
