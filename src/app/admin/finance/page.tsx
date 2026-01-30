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
  AlertCircle,
  Phone,
  Clock,
  Percent,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RevenueStats {
  total_revenue_cents_month: number;
  total_cost_cents_month: number;
  active_subscriptions: number;
  total_users: number;
  total_workspaces: number;
}

interface MarginStats {
  total_calls: number;
  total_minutes: number;
  user_paid_cents: number;
  ai_provider_cost_cents: number;
  margin_cents: number;
  margin_percent: number;
  retell_calls: number;
  retell_cost_cents: number;
  vapi_calls: number;
  vapi_cost_cents: number;
  avg_cost_per_minute_cents: number;
}

interface CampaignMargin {
  campaign_id: number;
  campaign_name: string;
  locked_cost_per_minute_cents: number;
  total_calls: number;
  total_minutes: number;
  revenue_cents: number;
  ai_cost_cents: number;
  margin_cents: number;
  margin_percent: number;
}

interface DailyMargin {
  day: string;
  calls: number;
  minutes: number;
  ai_cost_cents: number;
  revenue_cents: number;
  margin_cents: number;
}

export default function FinanceDashboard() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [margins, setMargins] = useState<MarginStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignMargin[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyMargin[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'margins' | 'campaigns'>('overview');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch revenue stats
      const revenueRes = await fetch('/api/monitoring?type=revenue');
      if (revenueRes.ok) {
        const revenueData = await revenueRes.json();
        setStats(revenueData.revenue || null);
        setConnected(revenueData.connected || false);
      }

      // Fetch margin stats
      const marginRes = await fetch('/api/monitoring?type=margins');
      if (marginRes.ok) {
        const marginData = await marginRes.json();
        setMargins(marginData.margins || null);
        setCampaigns(marginData.by_campaign || []);
        setDailyTrend(marginData.daily_trend || []);
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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('it-IT').format(num);
  };

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
              <h1 className="text-lg font-semibold">Finance & Margins</h1>
              <p className="text-xs text-gray-500">Revenue, costs and profitability</p>
            </div>
          </div>
        </header>
        
        <div className="p-6 max-w-2xl mx-auto text-center">
          <div className="bg-[#111] border border-yellow-500/30 rounded-xl p-8">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Database Not Connected</h2>
            <p className="text-gray-400 mb-4">
              To view financial data, configure the App database connection.
            </p>
            <div className="bg-[#0a0a0a] rounded-lg p-4 text-left">
              <p className="text-sm text-gray-500 mb-2">Add to <code className="text-[#ccff00]">.env.local</code>:</p>
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
              <h1 className="text-lg font-semibold">Finance & Margins</h1>
              <p className="text-xs text-gray-500">Last 30 days</p>
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
          {(['overview', 'margins', 'campaigns'] as const).map((tab) => (
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
              {tab === 'margins' && 'Margins'}
              {tab === 'campaigns' && 'By Campaign'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Main Margin Card */}
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#111] border border-[#333] rounded-2xl p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Net Margin</h2>
                  <p className="text-gray-500 text-sm mt-1">Revenue - AI Provider Costs</p>
                </div>
                <div className={`px-4 py-2 rounded-full text-lg font-bold ${
                  (margins?.margin_percent || 0) >= 0 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {margins?.margin_percent?.toFixed(1) || 0}%
                </div>
              </div>
              
              <p className={`text-5xl font-bold mb-8 ${
                (margins?.margin_cents || 0) >= 0 ? 'text-[#ccff00]' : 'text-red-400'
              }`}>
                {formatCurrency(margins?.margin_cents || 0)}
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#0a0a0a] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="text-sm font-medium">Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(margins?.user_paid_cents || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">What users paid</p>
                </div>
                
                <div className="bg-[#0a0a0a] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <ArrowDownRight className="w-4 h-4" />
                    <span className="text-sm font-medium">AI Provider Cost</span>
                  </div>
                  <p className="text-2xl font-bold text-red-400">
                    {formatCurrency(margins?.ai_provider_cost_cents || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Retell + Vapi</p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <Phone className="w-5 h-5 text-blue-400 mb-3" />
                <p className="text-2xl font-bold">{formatNumber(margins?.total_calls || 0)}</p>
                <p className="text-xs text-gray-500 mt-1">Total Calls</p>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <Clock className="w-5 h-5 text-purple-400 mb-3" />
                <p className="text-2xl font-bold">{formatNumber(Math.round(margins?.total_minutes || 0))}</p>
                <p className="text-xs text-gray-500 mt-1">Total Minutes</p>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <DollarSign className="w-5 h-5 text-amber-400 mb-3" />
                <p className="text-2xl font-bold">{(margins?.avg_cost_per_minute_cents || 0).toFixed(1)}¢</p>
                <p className="text-xs text-gray-500 mt-1">Avg Cost/Min</p>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <Users className="w-5 h-5 text-emerald-400 mb-3" />
                <p className="text-2xl font-bold">{formatNumber(stats?.active_subscriptions || 0)}</p>
                <p className="text-xs text-gray-500 mt-1">Subscribers</p>
              </div>
            </div>

            {/* Provider Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#111] border border-[#222] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h3 className="font-semibold">Retell</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Calls</span>
                    <span className="font-medium">{formatNumber(margins?.retell_calls || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cost</span>
                    <span className="font-medium text-red-400">{formatCurrency(margins?.retell_cost_cents || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#111] border border-[#222] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <h3 className="font-semibold">Vapi</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Calls</span>
                    <span className="font-medium">{formatNumber(margins?.vapi_calls || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cost</span>
                    <span className="font-medium text-red-400">{formatCurrency(margins?.vapi_cost_cents || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Stats */}
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Platform Stats</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-400">{stats?.active_subscriptions || 0}</p>
                  <p className="text-sm text-gray-500 mt-1">Active Subscriptions</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-400">{stats?.total_users || 0}</p>
                  <p className="text-sm text-gray-500 mt-1">Total Users</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-400">{stats?.total_workspaces || 0}</p>
                  <p className="text-sm text-gray-500 mt-1">Workspaces</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Margins Tab - Daily Trend */}
        {activeTab === 'margins' && (
          <>
            <div className="bg-[#111] border border-[#222] rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Daily Trend (Last 30 Days)</h3>
              
              {dailyTrend.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No data available</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-[#222]">
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium text-right">Calls</th>
                        <th className="pb-3 font-medium text-right">Minutes</th>
                        <th className="pb-3 font-medium text-right">Revenue</th>
                        <th className="pb-3 font-medium text-right">Cost</th>
                        <th className="pb-3 font-medium text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyTrend.slice(0, 14).map((day) => (
                        <tr key={day.day} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                          <td className="py-3 font-medium">{day.day}</td>
                          <td className="py-3 text-right">{day.calls}</td>
                          <td className="py-3 text-right">{Math.round(day.minutes)}</td>
                          <td className="py-3 text-right text-green-400">{formatCurrency(day.revenue_cents)}</td>
                          <td className="py-3 text-right text-red-400">{formatCurrency(day.ai_cost_cents)}</td>
                          <td className={`py-3 text-right font-medium ${
                            day.margin_cents >= 0 ? 'text-[#ccff00]' : 'text-red-400'
                          }`}>
                            {formatCurrency(day.margin_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Formula Explanation */}
            <div className="bg-[#111] border border-[#222] rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">How Margins are Calculated</h3>
              <div className="space-y-4 text-sm">
                <div className="bg-[#0a0a0a] rounded-lg p-4 font-mono">
                  <p className="text-[#ccff00] mb-2">MARGIN = Revenue - AI Provider Cost</p>
                  <p className="text-gray-500">
                    • Revenue = duration_minutes × locked_cost_per_minute (from campaign)<br/>
                    • AI Cost = call_cost_cents (from Retell/Vapi webhook)
                  </p>
                </div>
                <p className="text-gray-400">
                  <strong className="text-white">Note:</strong> Telephony costs (Twilio/Plivo) are already included 
                  in <code className="text-xs bg-[#0a0a0a] px-1 rounded">call_cost_cents</code> if using provider&apos;s built-in carrier.
                  For BYO carrier, add <code className="text-xs bg-[#0a0a0a] px-1 rounded">telco_cost_cents</code> separately.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="bg-[#111] border border-[#222] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Margin by Campaign</h3>
            
            {campaigns.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No campaign data available</p>
                  <p className="text-sm mt-1">Make sure campaigns have calls with costs recorded</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-[#222]">
                      <th className="pb-3 font-medium">Campaign</th>
                      <th className="pb-3 font-medium text-right">Price/Min</th>
                      <th className="pb-3 font-medium text-right">Calls</th>
                      <th className="pb-3 font-medium text-right">Minutes</th>
                      <th className="pb-3 font-medium text-right">Revenue</th>
                      <th className="pb-3 font-medium text-right">Cost</th>
                      <th className="pb-3 font-medium text-right">Margin</th>
                      <th className="pb-3 font-medium text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => (
                      <tr key={campaign.campaign_id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                        <td className="py-3">
                          <p className="font-medium truncate max-w-[200px]">{campaign.campaign_name}</p>
                          <p className="text-xs text-gray-500">ID: {campaign.campaign_id}</p>
                        </td>
                        <td className="py-3 text-right text-gray-400">
                          {campaign.locked_cost_per_minute_cents}¢
                        </td>
                        <td className="py-3 text-right">{campaign.total_calls}</td>
                        <td className="py-3 text-right">{Math.round(campaign.total_minutes)}</td>
                        <td className="py-3 text-right text-green-400">
                          {formatCurrency(campaign.revenue_cents)}
                        </td>
                        <td className="py-3 text-right text-red-400">
                          {formatCurrency(campaign.ai_cost_cents)}
                        </td>
                        <td className={`py-3 text-right font-medium ${
                          campaign.margin_cents >= 0 ? 'text-[#ccff00]' : 'text-red-400'
                        }`}>
                          {formatCurrency(campaign.margin_cents)}
                        </td>
                        <td className={`py-3 text-right ${
                          campaign.margin_percent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {campaign.margin_percent?.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Data Sources Info */}
        <div className="mt-8 bg-[#111] border border-[#222] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Data Sources</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5" />
              <div>
                <p className="font-medium">Revenue</p>
                <p className="text-gray-500">
                  <code className="text-xs bg-[#0a0a0a] px-1 rounded">cost_events.amount</code>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-red-400 rounded-full mt-1.5" />
              <div>
                <p className="font-medium">AI Costs</p>
                <p className="text-gray-500">
                  <code className="text-xs bg-[#0a0a0a] px-1 rounded">calls.call_cost_cents</code>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5" />
              <div>
                <p className="font-medium">Campaign Pricing</p>
                <p className="text-gray-500">
                  <code className="text-xs bg-[#0a0a0a] px-1 rounded">campaigns.locked_cost_per_minute_cents</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
