'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Simple inline styles to avoid CSS issues
const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    width: '256px',
    backgroundColor: '#111111',
    borderRight: '1px solid #222222',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'fixed' as const,
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 50,
  },
  sidebarHeader: {
    padding: '20px',
    borderBottom: '1px solid #222222',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #ccff00, #99cc00)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 700,
  },
  logoSub: {
    fontSize: '12px',
    color: '#666666',
  },
  nav: {
    flex: 1,
    padding: '16px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#888888',
    textDecoration: 'none',
    marginBottom: '4px',
    transition: 'all 0.2s',
  },
  navItemActive: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    color: '#ccff00',
    border: '1px solid rgba(204, 255, 0, 0.2)',
  },
  main: {
    marginLeft: '256px',
    flex: 1,
    minHeight: '100vh',
  },
  header: {
    height: '64px',
    backgroundColor: '#111111',
    borderBottom: '1px solid #222222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    position: 'sticky' as const,
    top: 0,
    zIndex: 40,
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 600,
  },
  headerSub: {
    fontSize: '12px',
    color: '#666666',
  },
  content: {
    padding: '24px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '32px',
  },
  statCard: {
    backgroundColor: '#111111',
    border: '1px solid #222222',
    borderRadius: '12px',
    padding: '20px',
  },
  statHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  statBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
  },
  statLabel: {
    fontSize: '12px',
    color: '#666666',
    marginTop: '4px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '32px',
  },
  actionCard: {
    backgroundColor: '#111111',
    border: '1px solid #222222',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    gap: '16px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.2s',
  },
  actionIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    flexShrink: 0,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  actionDesc: {
    fontSize: '14px',
    color: '#666666',
    marginBottom: '8px',
  },
  actionStat: {
    fontSize: '12px',
    color: '#ccff00',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  statusCard: {
    backgroundColor: '#111111',
    border: '1px solid #222222',
    borderRadius: '12px',
    padding: '20px',
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  statusIcon: {
    fontSize: '20px',
  },
  statusTitle: {
    fontSize: '14px',
    fontWeight: 500,
  },
  statusValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  statusSub: {
    fontSize: '12px',
    color: '#666666',
    marginTop: '8px',
  },
  dbStatus: {
    padding: '12px 16px',
    margin: '16px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
};

interface Stats {
  activeCalls: number;
  totalCallsToday: number;
  totalUsers: number;
  mrrCents: number;
  connected: boolean;
}

interface PricingInfo {
  version: number;
  plansCount: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    activeCalls: 0,
    totalCallsToday: 0,
    totalUsers: 0,
    mrrCents: 0,
    connected: false,
  });
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState('--:--:--');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [monitoringRes, pricingRes] = await Promise.all([
          fetch('/api/monitoring'),
          fetch('/api/pricing/admin'),
        ]);

        if (monitoringRes.ok) {
          const data = await monitoringRes.json();
          setStats({
            activeCalls: data.active_calls?.count || 0,
            totalCallsToday: data.call_stats?.total_calls_today || 0,
            totalUsers: data.revenue_stats?.total_users || 0,
            mrrCents: data.revenue_stats?.total_revenue_cents_month || 0,
            connected: data.connected || false,
          });
        }

        if (pricingRes.ok) {
          const data = await pricingRes.json();
          setPricing({
            version: data.version,
            plansCount: data.plans?.length || 0,
          });
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
        setTime(new Date().toLocaleTimeString('it-IT'));
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatEuro = (cents: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>✦</div>
            <div>
              <div style={styles.logoText}>Alice</div>
              <div style={styles.logoSub}>Control Center</div>
            </div>
          </div>
        </div>

        <nav style={styles.nav}>
          <Link href="/admin" style={{ ...styles.navItem, ...styles.navItemActive }}>
            📊 Dashboard
          </Link>
          <Link href="/admin/pricing" style={styles.navItem}>
            💰 Pricing
          </Link>
          <Link href="/admin/i18n" style={styles.navItem}>
            🌍 Translations
          </Link>
          <Link href="/admin/catalogues" style={styles.navItem}>
            📚 Catalogues
          </Link>
          <Link href="/admin/calls" style={styles.navItem}>
            📞 Monitoring
          </Link>
          <Link href="/admin/finance" style={styles.navItem}>
            📈 Finance
          </Link>
        </nav>

        <div
          style={{
            ...styles.dbStatus,
            backgroundColor: stats.connected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
            border: `1px solid ${stats.connected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`,
          }}
        >
          <div
            style={{
              ...styles.dot,
              backgroundColor: stats.connected ? '#22c55e' : '#eab308',
            }}
          />
          <span style={{ color: stats.connected ? '#22c55e' : '#eab308' }}>
            {stats.connected ? 'DB Connected' : 'DB Offline'}
          </span>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={styles.headerTitle}>Dashboard</div>
            <div style={styles.headerSub}>Overview of your Agoralia platform</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => window.location.reload()}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#1a1a1a',
                border: 'none',
                color: '#888888',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              🔄 Refresh
            </button>
            <span style={{ fontSize: '12px', color: '#666666' }}>🕐 {time}</span>
          </div>
        </header>

        <div style={styles.content}>
          {/* Stats */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={{ fontSize: '20px' }}>📞</span>
                <span style={{ ...styles.statBadge, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                  Live
                </span>
              </div>
              <div style={styles.statValue}>{stats.activeCalls}</div>
              <div style={styles.statLabel}>Active Calls</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={{ fontSize: '20px' }}>📊</span>
                <span style={{ ...styles.statBadge, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                  Today
                </span>
              </div>
              <div style={styles.statValue}>{stats.totalCallsToday}</div>
              <div style={styles.statLabel}>Calls Today</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={{ fontSize: '20px' }}>👥</span>
                <span style={{ ...styles.statBadge, backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                  Total
                </span>
              </div>
              <div style={styles.statValue}>{stats.totalUsers}</div>
              <div style={styles.statLabel}>Users</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statHeader}>
                <span style={{ fontSize: '20px' }}>💰</span>
                <span style={{ ...styles.statBadge, backgroundColor: 'rgba(204, 255, 0, 0.1)', color: '#ccff00' }}>
                  MRR
                </span>
              </div>
              <div style={styles.statValue}>{formatEuro(stats.mrrCents)}</div>
              <div style={styles.statLabel}>Monthly Revenue</div>
            </div>
          </div>

          {/* Quick Actions */}
          <h3 style={styles.sectionTitle}>Quick Actions</h3>
          <div style={styles.actionsGrid}>
            <Link href="/admin/pricing" style={styles.actionCard}>
              <div style={{ ...styles.actionIcon, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>💰</div>
              <div style={styles.actionContent}>
                <div style={styles.actionTitle}>Pricing</div>
                <div style={styles.actionDesc}>Manage plans and sync to Stripe</div>
                <div style={styles.actionStat}>
                  {pricing ? `v${pricing.version} • ${pricing.plansCount} plans` : 'Loading...'}
                </div>
              </div>
              <span style={{ color: '#666666' }}>→</span>
            </Link>

            <Link href="/admin/i18n" style={styles.actionCard}>
              <div style={{ ...styles.actionIcon, background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>🌍</div>
              <div style={styles.actionContent}>
                <div style={styles.actionTitle}>Translations</div>
                <div style={styles.actionDesc}>Manage i18n and sync to GitHub</div>
                <div style={styles.actionStat}>45 languages</div>
              </div>
              <span style={{ color: '#666666' }}>→</span>
            </Link>

            <Link href="/admin/calls" style={styles.actionCard}>
              <div style={{ ...styles.actionIcon, background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}>📞</div>
              <div style={styles.actionContent}>
                <div style={styles.actionTitle}>Monitoring</div>
                <div style={styles.actionDesc}>Live calls and system metrics</div>
                <div style={styles.actionStat}>{stats.activeCalls} active calls</div>
              </div>
              <span style={{ color: '#666666' }}>→</span>
            </Link>

            <Link href="/admin/finance" style={styles.actionCard}>
              <div style={{ ...styles.actionIcon, background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}>📈</div>
              <div style={styles.actionContent}>
                <div style={styles.actionTitle}>Finance</div>
                <div style={styles.actionDesc}>Revenue, costs and analytics</div>
                <div style={styles.actionStat}>{formatEuro(stats.mrrCents)}</div>
              </div>
              <span style={{ color: '#666666' }}>→</span>
            </Link>
          </div>

          {/* System Status */}
          <h3 style={styles.sectionTitle}>System Status</h3>
          <div style={styles.statusGrid}>
            <div style={styles.statusCard}>
              <div style={styles.statusHeader}>
                <span style={styles.statusIcon}>🗄️</span>
                <span style={styles.statusTitle}>App Database</span>
              </div>
              <div style={styles.statusValue}>
                <span style={{ color: stats.connected ? '#22c55e' : '#eab308' }}>
                  {stats.connected ? '✓ Connected' : '⚠ Not configured'}
                </span>
              </div>
              <div style={styles.statusSub}>Railway PostgreSQL</div>
            </div>

            <div style={styles.statusCard}>
              <div style={styles.statusHeader}>
                <span style={styles.statusIcon}>💰</span>
                <span style={styles.statusTitle}>Pricing Database</span>
              </div>
              <div style={styles.statusValue}>
                <span style={{ color: '#22c55e' }}>✓ Active</span>
              </div>
              <div style={styles.statusSub}>{pricing ? `Version ${pricing.version}` : 'Loading...'}</div>
            </div>

            <div style={styles.statusCard}>
              <div style={styles.statusHeader}>
                <span style={styles.statusIcon}>🐙</span>
                <span style={styles.statusTitle}>GitHub Sync</span>
              </div>
              <div style={styles.statusValue}>
                <span style={{ color: '#22c55e' }}>✓ Configured</span>
              </div>
              <div style={styles.statusSub}>giacomocavalcabo</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
