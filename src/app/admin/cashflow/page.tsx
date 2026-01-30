'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  ArrowLeft, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Users,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  DollarSign,
  Repeat,
  UserMinus,
  UserPlus,
  Building2,
  Receipt,
} from 'lucide-react';

interface CashFlowStats {
  gross_revenue_cents: number;
  subscription_revenue_cents: number;
  topup_revenue_cents: number;
  refunds_cents: number;
  net_revenue_cents: number;
  mrr_cents: number;
  arr_cents: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  canceled_this_month: number;
  new_this_month: number;
  churn_rate_percent: number;
  core_subscriptions: number;
  pro_subscriptions: number;
  monthly_subscriptions: number;
  yearly_subscriptions: number;
  total_credit_balance_cents: number;
  total_consumption_this_month_cents: number;
}

interface MonthlyRevenue {
  month: string;
  gross_revenue_cents: number;
  subscription_revenue_cents: number;
  topup_revenue_cents: number;
  refunds_cents: number;
  net_revenue_cents: number;
  new_subscriptions: number;
  canceled_subscriptions: number;
}

interface SubscriptionBreakdown {
  plan: string;
  tier: string;
  interval: string;
  count: number;
  mrr_contribution_cents: number;
}

interface RevenueByCountry {
  country_code: string;
  gross_revenue_cents: number;
  net_revenue_cents: number;
  subscription_count: number;
  vat_collected_cents: number;
  avg_tax_rate: number;
  transaction_count: number;
}

interface RecentTransaction {
  id: number;
  tenant_id: string;
  purpose: string;
  amount_cents: number;
  currency: string;
  status: string;
  billing_country: string | null;
  tax_amount_cents: number | null;
  tax_rate_percent: number | null;
  refund_of_transaction_id: number | null;
  created_at: string;
}

export default function CashFlowDashboard() {
  const [stats, setStats] = useState<CashFlowStats | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [subscriptionBreakdown, setSubscriptionBreakdown] = useState<SubscriptionBreakdown[]>([]);
  const [revenueByCountry, setRevenueByCountry] = useState<RevenueByCountry[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'revenue' | 'transactions'>('overview');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/monitoring?type=cashflow');
      if (res.ok) {
        const data = await res.json();
        setStats(data.cashflow || null);
        setMonthlyRevenue(data.monthly_revenue || []);
        setSubscriptionBreakdown(data.subscription_breakdown || []);
        setRevenueByCountry(data.revenue_by_country || []);
        setRecentTransactions(data.recent_transactions || []);
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

  const formatCurrency = (cents: number, currency = 'EUR') => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency,
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('it-IT').format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPurposeColor = (purpose: string) => {
    switch (purpose) {
      case 'subscription_invoice': return 'text-blue-400';
      case 'topup': return 'text-green-400';
      case 'refund': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500/10 text-green-400';
      case 'pending': return 'bg-yellow-500/10 text-yellow-400';
      case 'failed': return 'bg-red-500/10 text-red-400';
      case 'refunded': return 'bg-purple-500/10 text-purple-400';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  if (!connected && !loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <header className="h-16 bg-[#111] border-b border-[#222] flex items-center px-6">
          <Link href="/admin" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mr-4">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Cash Flow</h1>
              <p className="text-xs text-gray-500">Revenue & Subscriptions</p>
            </div>
          </div>
        </header>
        
        <div className="p-6 max-w-2xl mx-auto text-center">
          <div className="bg-[#111] border border-yellow-500/30 rounded-xl p-8">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Database Not Connected</h2>
            <p className="text-gray-400 mb-4">
              Configure APP_DATABASE_URL to view cash flow data.
            </p>
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
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Cash Flow</h1>
              <p className="text-xs text-gray-500">Revenue, Subscriptions & Credits</p>
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

      {/* Tabs */}
      <div className="border-b border-[#222] bg-[#0a0a0a] sticky top-16 z-30">
        <div className="flex gap-1 px-6">
          {(['overview', 'subscriptions', 'revenue', 'transactions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#ccff00] text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'subscriptions' && 'Subscriptions'}
              {tab === 'revenue' && 'Revenue'}
              {tab === 'transactions' && 'Transactions'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* MRR/ARR Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 border border-emerald-500/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-emerald-400 text-sm font-medium">Monthly Recurring Revenue</span>
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-4xl font-bold text-white mb-2">
                  {formatCurrency(stats?.mrr_cents || 0)}
                </p>
                <p className="text-sm text-gray-400">
                  {stats?.active_subscriptions || 0} active subscriptions
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 border border-blue-500/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-blue-400 text-sm font-medium">Annual Recurring Revenue</span>
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-4xl font-bold text-white mb-2">
                  {formatCurrency(stats?.arr_cents || 0)}
                </p>
                <p className="text-sm text-gray-400">
                  MRR × 12
                </p>
              </div>
            </div>

            {/* Revenue This Month */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpRight className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(stats?.gross_revenue_cents || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Gross Revenue (This Month)</p>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats?.subscription_revenue_cents || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Subscription Revenue</p>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats?.topup_revenue_cents || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Credit Topups</p>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowDownRight className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-red-400">
                  {formatCurrency(stats?.refunds_cents || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Refunds</p>
              </div>
            </div>

            {/* Subscription Health */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold">{stats?.active_subscriptions || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Active Subscriptions</p>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-2xl font-bold text-green-400">+{stats?.new_this_month || 0}</p>
                <p className="text-xs text-gray-500 mt-1">New This Month</p>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <UserMinus className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-red-400">-{stats?.canceled_this_month || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Canceled This Month</p>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Repeat className="w-5 h-5 text-amber-400" />
                </div>
                <p className={`text-2xl font-bold ${(stats?.churn_rate_percent || 0) > 5 ? 'text-red-400' : 'text-amber-400'}`}>
                  {stats?.churn_rate_percent?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Churn Rate</p>
              </div>
            </div>

            {/* Credits Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#111] border border-[#222] rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Credit System</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Credit Balance</span>
                    <span className="font-bold text-emerald-400">
                      {formatCurrency(stats?.total_credit_balance_cents || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Consumption This Month</span>
                    <span className="font-bold text-red-400">
                      {formatCurrency(stats?.total_consumption_this_month_cents || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Plan Distribution</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-gray-400">Core</span>
                    </div>
                    <span className="font-bold">{stats?.core_subscriptions || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-gray-400">Pro</span>
                    </div>
                    <span className="font-bold">{stats?.pro_subscriptions || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-gray-400">Trialing</span>
                    </div>
                    <span className="font-bold">{stats?.trialing_subscriptions || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <p className="text-xs text-gray-500 mb-2">Monthly Plans</p>
                <p className="text-2xl font-bold">{stats?.monthly_subscriptions || 0}</p>
              </div>
              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <p className="text-xs text-gray-500 mb-2">Yearly Plans</p>
                <p className="text-2xl font-bold">{stats?.yearly_subscriptions || 0}</p>
              </div>
              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <p className="text-xs text-gray-500 mb-2">Core Plans</p>
                <p className="text-2xl font-bold">{stats?.core_subscriptions || 0}</p>
              </div>
              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <p className="text-xs text-gray-500 mb-2">Pro Plans</p>
                <p className="text-2xl font-bold">{stats?.pro_subscriptions || 0}</p>
              </div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Subscription Breakdown</h3>
              {subscriptionBreakdown.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No subscription data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-[#222]">
                        <th className="pb-3 font-medium">Plan</th>
                        <th className="pb-3 font-medium">Tier</th>
                        <th className="pb-3 font-medium">Interval</th>
                        <th className="pb-3 font-medium text-right">Count</th>
                        <th className="pb-3 font-medium text-right">MRR Contribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionBreakdown.map((sub, i) => (
                        <tr key={i} className="border-b border-[#1a1a1a]">
                          <td className="py-3 font-medium capitalize">{sub.plan}</td>
                          <td className="py-3 text-gray-400">{sub.tier}</td>
                          <td className="py-3 text-gray-400 capitalize">{sub.interval}</td>
                          <td className="py-3 text-right">{sub.count}</td>
                          <td className="py-3 text-right text-emerald-400">
                            {formatCurrency(sub.mrr_contribution_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <>
            {/* Monthly Trend */}
            <div className="bg-[#111] border border-[#222] rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Monthly Revenue Trend</h3>
              {monthlyRevenue.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No revenue data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-[#222]">
                        <th className="pb-3 font-medium">Month</th>
                        <th className="pb-3 font-medium text-right">Gross</th>
                        <th className="pb-3 font-medium text-right">Subscriptions</th>
                        <th className="pb-3 font-medium text-right">Topups</th>
                        <th className="pb-3 font-medium text-right">Refunds</th>
                        <th className="pb-3 font-medium text-right">Net</th>
                        <th className="pb-3 font-medium text-right">+Subs</th>
                        <th className="pb-3 font-medium text-right">-Subs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRevenue.map((month) => (
                        <tr key={month.month} className="border-b border-[#1a1a1a]">
                          <td className="py-3 font-medium">{month.month}</td>
                          <td className="py-3 text-right">{formatCurrency(month.gross_revenue_cents)}</td>
                          <td className="py-3 text-right text-blue-400">{formatCurrency(month.subscription_revenue_cents)}</td>
                          <td className="py-3 text-right text-purple-400">{formatCurrency(month.topup_revenue_cents)}</td>
                          <td className="py-3 text-right text-red-400">{formatCurrency(month.refunds_cents)}</td>
                          <td className="py-3 text-right font-medium text-emerald-400">{formatCurrency(month.net_revenue_cents)}</td>
                          <td className="py-3 text-right text-green-400">+{month.new_subscriptions}</td>
                          <td className="py-3 text-right text-red-400">-{month.canceled_subscriptions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Revenue by Country with VAT */}
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Revenue by Country (with VAT)</h3>
              {revenueByCountry.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No country data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-[#222]">
                        <th className="pb-3 font-medium">Country</th>
                        <th className="pb-3 font-medium text-right">Gross</th>
                        <th className="pb-3 font-medium text-right">VAT</th>
                        <th className="pb-3 font-medium text-right">Net</th>
                        <th className="pb-3 font-medium text-right">Tax Rate</th>
                        <th className="pb-3 font-medium text-right">Txns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueByCountry.map((country) => (
                        <tr key={country.country_code} className="border-b border-[#1a1a1a]">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">{country.country_code}</span>
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            {formatCurrency(country.gross_revenue_cents)}
                          </td>
                          <td className="py-3 text-right text-amber-400">
                            {formatCurrency(country.vat_collected_cents)}
                          </td>
                          <td className="py-3 text-right text-emerald-400">
                            {formatCurrency(country.net_revenue_cents)}
                          </td>
                          <td className="py-3 text-right text-gray-400">
                            {country.avg_tax_rate > 0 ? `${country.avg_tax_rate}%` : '—'}
                          </td>
                          <td className="py-3 text-right text-gray-500">
                            {country.transaction_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="bg-[#111] border border-[#222] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
            {recentTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No transactions available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-[#222]">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Country</th>
                      <th className="pb-3 font-medium">Purpose</th>
                      <th className="pb-3 font-medium text-right">Amount</th>
                      <th className="pb-3 font-medium text-right">VAT</th>
                      <th className="pb-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-[#1a1a1a]">
                        <td className="py-3 text-gray-400">{formatDate(tx.created_at)}</td>
                        <td className="py-3">
                          <span className="text-xs font-medium px-2 py-1 bg-[#1a1a1a] rounded">
                            {tx.billing_country || '—'}
                          </span>
                        </td>
                        <td className={`py-3 ${getPurposeColor(tx.purpose)}`}>
                          <div className="flex items-center gap-2">
                            {tx.purpose === 'subscription_invoice' && <Receipt className="w-4 h-4" />}
                            {tx.purpose === 'topup' && <DollarSign className="w-4 h-4" />}
                            {tx.purpose === 'refund' && <ArrowDownRight className="w-4 h-4" />}
                            <span className="capitalize">{tx.purpose.replace('_', ' ')}</span>
                            {tx.refund_of_transaction_id && (
                              <span className="text-xs text-gray-500">(of #{tx.refund_of_transaction_id})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right font-medium">
                          {formatCurrency(tx.amount_cents, tx.currency)}
                        </td>
                        <td className="py-3 text-right text-amber-400 text-xs">
                          {tx.tax_amount_cents 
                            ? `${formatCurrency(tx.tax_amount_cents, tx.currency)} (${tx.tax_rate_percent}%)`
                            : '—'
                          }
                        </td>
                        <td className="py-3 text-right">
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(tx.status)}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
