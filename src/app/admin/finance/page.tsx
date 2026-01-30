'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, 
  ArrowLeft, 
  RefreshCw,
  DollarSign,
  Users,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';

interface RevenueStats {
  total_revenue_cents_month: number;
  total_cost_cents_month: number;
  active_subscriptions: number;
  total_users: number;
  total_workspaces: number;
}

export default function FinanceDashboard() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/monitoring?type=revenue');
      if (res.ok) {
        const data = await res.json();
        setStats(data.revenue || null);
        setConnected(data.connected || false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  const margin = stats 
    ? stats.total_revenue_cents_month - stats.total_cost_cents_month 
    : 0;
  
  const marginPercent = stats && stats.total_revenue_cents_month > 0
    ? ((margin / stats.total_revenue_cents_month) * 100).toFixed(1)
    : '0';

  if (!connected && !loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <header className="h-16 bg-[#111] border-b border-[#222] flex items-center px-6">
          <Link href="/admin" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mr-4">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Finance</h1>
              <p className="text-xs text-gray-500">Revenue and costs</p>
            </div>
          </div>
        </header>
        
        <div className="p-6 max-w-2xl mx-auto text-center">
          <div className="bg-[#111] border border-yellow-500/30 rounded-xl p-8">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Database Not Connected</h2>
            <p className="text-gray-400 mb-4">
              To view financial data, you need to configure the App database connection.
            </p>
            <div className="bg-[#0a0a0a] rounded-lg p-4 text-left">
              <p className="text-sm text-gray-500 mb-2">Add to your <code className="text-[#ccff00]">.env.local</code>:</p>
              <code className="text-sm text-[#ccff00]">
                APP_DATABASE_URL=postgresql://...
              </code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="h-16 bg-[#111] border-b border-[#222] flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Finance</h1>
              <p className="text-xs text-gray-500">Revenue, costs and analytics</p>
            </div>
          </div>
        </div>
        
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-sm text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <div className="p-6">
        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Revenue */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Monthly Revenue</span>
              <div className="flex items-center gap-1 text-green-400 text-xs">
                <ArrowUpRight className="w-3 h-3" />
                <span>This month</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-green-400">
              {formatCurrency(stats?.total_revenue_cents_month || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              From {stats?.active_subscriptions || 0} active subscriptions
            </p>
          </div>

          {/* Costs */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Monthly Costs</span>
              <div className="flex items-center gap-1 text-red-400 text-xs">
                <ArrowDownRight className="w-3 h-3" />
                <span>This month</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-red-400">
              {formatCurrency(stats?.total_cost_cents_month || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              OpenAI, Telephony, etc.
            </p>
          </div>

          {/* Margin */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Net Margin</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                margin >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {marginPercent}%
              </span>
            </div>
            <p className={`text-3xl font-bold ${margin >= 0 ? 'text-[#ccff00]' : 'text-red-400'}`}>
              {formatCurrency(margin)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Revenue - Costs
            </p>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-2xl font-bold">{stats?.active_subscriptions || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Active Subscriptions</p>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold">{stats?.total_users || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total Users</p>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold">{stats?.total_workspaces || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Workspaces</p>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-[#ccff00]" />
            </div>
            <p className="text-2xl font-bold">
              {stats && stats.total_users > 0 
                ? formatCurrency(Math.round((stats.total_revenue_cents_month || 0) / stats.total_users))
                : '€0'
              }
            </p>
            <p className="text-xs text-gray-500 mt-1">ARPU (Monthly)</p>
          </div>
        </div>

        {/* Placeholder for charts */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Charts coming soon</p>
              <p className="text-sm mt-1">Historical data visualization will be added here</p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-[#111] border border-[#222] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Data Sources</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5" />
              <div>
                <p className="font-medium">Revenue</p>
                <p className="text-gray-500">From <code className="text-xs bg-[#0a0a0a] px-1 rounded">billing_transactions</code> table (completed payments)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-red-400 rounded-full mt-1.5" />
              <div>
                <p className="font-medium">Costs</p>
                <p className="text-gray-500">From <code className="text-xs bg-[#0a0a0a] px-1 rounded">cost_events</code> table (API usage, telephony)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5" />
              <div>
                <p className="font-medium">Subscriptions</p>
                <p className="text-gray-500">From <code className="text-xs bg-[#0a0a0a] px-1 rounded">subscriptions</code> table (active status)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
