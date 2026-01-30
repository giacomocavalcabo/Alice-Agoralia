'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Phone, 
  ArrowLeft, 
  RefreshCw,
  Clock,
  Users,
  PhoneIncoming,
  PhoneOutgoing,
  Activity,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface ActiveCall {
  id: number;
  call_id: string;
  tenant_id: number;
  workspace_name: string;
  started_at: string;
  duration_seconds: number;
  direction: string;
  status: string;
  from_number: string;
  to_number: string;
  agent_name: string;
}

interface CallStats {
  total_calls_today: number;
  total_calls_week: number;
  total_calls_month: number;
  total_duration_minutes_today: number;
  total_duration_minutes_month: number;
  avg_duration_seconds: number;
}

export default function CallsMonitor() {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/monitoring');
      if (res.ok) {
        const data = await res.json();
        setActiveCalls(data.active_calls?.calls || []);
        setStats(data.call_stats || null);
        setConnected(data.connected || false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setConnected(false);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds for live calls
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-progress':
        return 'bg-green-500';
      case 'ringing':
        return 'bg-yellow-500';
      case 'initiated':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
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
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Call Monitoring</h1>
              <p className="text-xs text-gray-500">Live call tracking</p>
            </div>
          </div>
        </header>
        
        <div className="p-6 max-w-2xl mx-auto text-center">
          <div className="bg-[#111] border border-yellow-500/30 rounded-xl p-8">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Database Not Connected</h2>
            <p className="text-gray-400 mb-4">
              To view live calls and statistics, you need to configure the App database connection.
            </p>
            <div className="bg-[#0a0a0a] rounded-lg p-4 text-left">
              <p className="text-sm text-gray-500 mb-2">Add to your <code className="text-[#ccff00]">.env.local</code>:</p>
              <code className="text-sm text-[#ccff00]">
                APP_DATABASE_URL=postgresql://...
              </code>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Get the connection string from Railway: Agoralia project → Postgres → Connect
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
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Call Monitoring</h1>
              <p className="text-xs text-gray-500">Live call tracking</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-600"
            />
            Auto-refresh
          </label>
          
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-sm text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-green-400" />
              <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded animate-pulse">Live</span>
            </div>
            <p className="text-4xl font-bold">{activeCalls.length}</p>
            <p className="text-sm text-gray-500 mt-1">Active Calls</p>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-4xl font-bold">{stats?.total_calls_today || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Calls Today</p>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-4xl font-bold">{stats?.total_duration_minutes_today || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Minutes Today</p>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-[#ccff00]" />
            </div>
            <p className="text-4xl font-bold">{formatDuration(stats?.avg_duration_seconds || 0)}</p>
            <p className="text-sm text-gray-500 mt-1">Avg Duration</p>
          </div>
        </div>

        {/* Active Calls Table */}
        <div className="bg-[#111] border border-[#222] rounded-xl">
          <div className="p-4 border-b border-[#222] flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Active Calls
              {activeCalls.length > 0 && (
                <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                  {activeCalls.length}
                </span>
              )}
            </h2>
          </div>

          {activeCalls.length === 0 ? (
            <div className="p-12 text-center">
              <Phone className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No active calls at the moment</p>
              <p className="text-sm text-gray-500 mt-1">Calls will appear here in real-time</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#222] text-left text-xs text-gray-500 uppercase">
                    <th className="p-4">Status</th>
                    <th className="p-4">Workspace</th>
                    <th className="p-4">Direction</th>
                    <th className="p-4">From</th>
                    <th className="p-4">To</th>
                    <th className="p-4">Agent</th>
                    <th className="p-4">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCalls.map((call) => (
                    <tr key={call.id} className="border-b border-[#222] hover:bg-[#1a1a1a]">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(call.status)} animate-pulse`} />
                          <span className="text-sm capitalize">{call.status}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{call.workspace_name || `Workspace ${call.tenant_id}`}</span>
                      </td>
                      <td className="p-4">
                        {call.direction === 'inbound' ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <PhoneIncoming className="w-4 h-4" />
                            <span className="text-sm">Inbound</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-blue-400">
                            <PhoneOutgoing className="w-4 h-4" />
                            <span className="text-sm">Outbound</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-mono text-gray-400">{call.from_number || '-'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-mono text-gray-400">{call.to_number || '-'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{call.agent_name || '-'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-mono text-[#ccff00]">
                          {formatDuration(call.duration_seconds)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Monthly Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <h3 className="text-sm text-gray-500 mb-2">This Week</h3>
            <p className="text-2xl font-bold">{stats?.total_calls_week || 0}</p>
            <p className="text-xs text-gray-500">calls</p>
          </div>
          
          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <h3 className="text-sm text-gray-500 mb-2">This Month</h3>
            <p className="text-2xl font-bold">{stats?.total_calls_month || 0}</p>
            <p className="text-xs text-gray-500">calls</p>
          </div>
          
          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <h3 className="text-sm text-gray-500 mb-2">Total Minutes (Month)</h3>
            <p className="text-2xl font-bold">{stats?.total_duration_minutes_month || 0}</p>
            <p className="text-xs text-gray-500">minutes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
