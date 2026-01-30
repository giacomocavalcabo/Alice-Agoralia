'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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
  content: {
    padding: '24px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '1px solid #222222',
    paddingBottom: '16px',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: '#111111',
    border: '1px solid #222222',
    borderRadius: '12px',
    padding: '20px',
  },
  languageTable: {
    backgroundColor: '#111111',
    border: '1px solid #222222',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '40px 200px 100px 120px 100px 100px',
    gap: '16px',
    padding: '12px 20px',
    backgroundColor: '#0a0a0a',
    borderBottom: '1px solid #222222',
    fontSize: '12px',
    color: '#666666',
    textTransform: 'uppercase' as const,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '40px 200px 100px 120px 100px 100px',
    gap: '16px',
    padding: '12px 20px',
    borderBottom: '1px solid #1a1a1a',
    alignItems: 'center',
    fontSize: '14px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
  },
  progressBar: {
    width: '100%',
    height: '6px',
    backgroundColor: '#222222',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s',
  },
};

interface LanguageStatus {
  code: string;
  name: string;
  flag: string;
  status: 'complete' | 'partial' | 'missing';
  keyCount: number;
  sourceKeyCount: number;
  progress: number;
  estimatedCost: number;
  files: string[];
}

interface ProjectStatus {
  projectId: string;
  projectName: string;
  sourceLocale: string;
  sourceKeyCount: number;
  languages: LanguageStatus[];
  totalLanguages: number;
  translatedLanguages: number;
  missingLanguages: number;
  totalEstimatedCost: number;
}

export default function I18nPage() {
  const [activeProject, setActiveProject] = useState<'site' | 'app' | 'compliance'>('site');
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'missing' | 'partial' | 'complete'>('all');
  const [translating, setTranslating] = useState(false);
  const [translateLog, setTranslateLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [config, setConfig] = useState<{ grokConfigured: boolean; githubConfigured: boolean; credits: number | null } | null>(null);
  const [sessionCost, setSessionCost] = useState(0); // Track cost spent in this session

  const fetchStatus = useCallback(async (project: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/i18n/status?project=${project}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch');
      }
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(activeProject);
  }, [activeProject, fetchStatus]);

  // Fetch config on mount
  const fetchConfig = useCallback(() => {
    fetch('/api/i18n/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(() => setConfig({ grokConfigured: false, githubConfigured: false, credits: null }));
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const translateSelected = async (dryRun: boolean = false) => {
    if (selectedLanguages.size === 0) return;
    
    setTranslating(true);
    setShowLog(true);
    setTranslateLog([`Starting ${dryRun ? 'cost estimate' : 'translation'} for ${selectedLanguages.size} languages...`]);

    let totalCost = 0;
    let totalKeys = 0;

    for (const locale of selectedLanguages) {
      setTranslateLog(prev => [...prev, `\n📍 Processing ${locale}...`]);
      
      try {
        const res = await fetch('/api/i18n/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: activeProject,
            targetLocale: locale,
            dryRun,
          }),
        });

        const data = await res.json();
        
        if (data.success) {
          totalCost += data.result.cost;
          totalKeys += data.result.keysTranslated;
          setTranslateLog(prev => [
            ...prev,
            `  ✓ ${locale}: ${data.result.keysTranslated} keys, $${data.result.cost.toFixed(4)}`,
            data.result.errors?.length > 0 ? `  ⚠ Warnings: ${data.result.errors.join(', ')}` : '',
          ].filter(Boolean));
        } else {
          setTranslateLog(prev => [...prev, `  ✗ ${locale}: ${data.error}`]);
        }
      } catch (err) {
        setTranslateLog(prev => [...prev, `  ✗ ${locale}: ${err instanceof Error ? err.message : 'Unknown error'}`]);
      }
    }

    setTranslateLog(prev => [
      ...prev,
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `✅ ${dryRun ? 'ESTIMATE' : 'COMPLETE'}: ${totalKeys} keys, Total cost: $${totalCost.toFixed(4)}`,
    ]);

    setTranslating(false);
    
    if (!dryRun) {
      // Update session cost
      setSessionCost(prev => prev + totalCost);
      // Refresh status after translation
      fetchStatus(activeProject);
    }
  };

  const toggleLanguage = (code: string) => {
    const newSelected = new Set(selectedLanguages);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedLanguages(newSelected);
  };

  const selectAllMissing = () => {
    if (!status) return;
    const missing = status.languages
      .filter(l => l.status === 'missing' || l.status === 'partial')
      .map(l => l.code);
    setSelectedLanguages(new Set(missing));
  };

  const filteredLanguages = status?.languages.filter(l => {
    if (filter === 'all') return true;
    return l.status === filter;
  }) || [];

  const selectedCost = status?.languages
    .filter(l => selectedLanguages.has(l.code))
    .reduce((sum, l) => sum + l.estimatedCost, 0) || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' };
      case 'partial': return { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308' };
      case 'missing': return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
      default: return { bg: '#222222', color: '#888888' };
    }
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>✦</div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>Alice</div>
              <div style={{ fontSize: '12px', color: '#666666' }}>Control Center</div>
            </div>
          </div>
        </div>

        <nav style={styles.nav}>
          <Link href="/admin" style={styles.navItem}>📊 Dashboard</Link>
          <Link href="/admin/pricing" style={styles.navItem}>💰 Pricing</Link>
          <Link href="/admin/i18n" style={{ ...styles.navItem, ...styles.navItemActive }}>🌍 Translations</Link>
          <Link href="/admin/calls" style={styles.navItem}>📞 Monitoring</Link>
          <Link href="/admin/finance" style={styles.navItem}>📈 Finance</Link>
        </nav>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 600 }}>Translations</div>
            <div style={{ fontSize: '12px', color: '#666666' }}>
              Manage i18n for {status?.projectName || 'loading...'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {selectedLanguages.size > 0 && (
              <>
                <button
                  onClick={() => translateSelected(true)}
                  disabled={translating}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#1a1a1a',
                    color: '#888888',
                    border: '1px solid #333333',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: translating ? 'not-allowed' : 'pointer',
                    opacity: translating ? 0.5 : 1,
                  }}
                >
                  💰 Estimate Cost
                </button>
                <button
                  onClick={() => translateSelected(false)}
                  disabled={translating}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: translating ? '#666600' : '#ccff00',
                    color: '#000000',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: translating ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {translating ? '⏳ Translating...' : `🚀 Translate ${selectedLanguages.size} languages`}
                </button>
              </>
            )}
            <button
              onClick={() => fetchStatus(activeProject)}
              disabled={loading}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#1a1a1a',
                color: '#888888',
                border: 'none',
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </header>

        <div style={styles.content}>
          {/* Project Tabs */}
          <div style={styles.tabs}>
            <button
              onClick={() => setActiveProject('site')}
              style={{
                ...styles.tab,
                backgroundColor: activeProject === 'site' ? '#ccff00' : '#1a1a1a',
                color: activeProject === 'site' ? '#000000' : '#888888',
              }}
            >
              🌐 Sito Agoralia
            </button>
            <button
              onClick={() => setActiveProject('app')}
              style={{
                ...styles.tab,
                backgroundColor: activeProject === 'app' ? '#ccff00' : '#1a1a1a',
                color: activeProject === 'app' ? '#000000' : '#888888',
              }}
            >
              📱 Agoralia App
            </button>
            <button
              onClick={() => setActiveProject('compliance')}
              style={{
                ...styles.tab,
                backgroundColor: activeProject === 'compliance' ? '#ccff00' : '#1a1a1a',
                color: activeProject === 'compliance' ? '#000000' : '#888888',
              }}
            >
              📋 Compliance (KB)
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#666666' }}>
              ⏳ Loading translation status...
            </div>
          ) : error ? (
            <div style={{
              padding: '24px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              color: '#ef4444',
            }}>
              ❌ {error}
            </div>
          ) : status && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={styles.statCard}>
                  <div style={{ fontSize: '12px', color: '#666666', marginBottom: '8px' }}>Total Languages</div>
                  <div style={{ fontSize: '32px', fontWeight: 700 }}>{status.totalLanguages}</div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ fontSize: '12px', color: '#666666', marginBottom: '8px' }}>Translated</div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: '#22c55e' }}>
                    {status.translatedLanguages}
                  </div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ fontSize: '12px', color: '#666666', marginBottom: '8px' }}>Partial</div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: '#eab308' }}>
                    {status.languages.filter(l => l.status === 'partial').length}
                  </div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ fontSize: '12px', color: '#666666', marginBottom: '8px' }}>Missing</div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444' }}>
                    {status.missingLanguages}
                  </div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ fontSize: '12px', color: '#666666', marginBottom: '8px' }}>Est. Cost (All)</div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: '#ccff00' }}>
                    ${status.totalEstimatedCost.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Source Info */}
              <div style={{
                backgroundColor: '#111111',
                border: '1px solid #222222',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ color: '#666666' }}>Source: </span>
                  <span style={{ fontWeight: 600 }}>{status.sourceLocale}</span>
                  <span style={{ color: '#666666', marginLeft: '16px' }}>Keys: </span>
                  <span style={{ fontWeight: 600 }}>{status.sourceKeyCount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={selectAllMissing}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#1a1a1a',
                      color: '#888888',
                      border: 'none',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Select all missing
                  </button>
                  <button
                    onClick={() => setSelectedLanguages(new Set())}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#1a1a1a',
                      color: '#888888',
                      border: 'none',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Clear selection
                  </button>
                </div>
              </div>

              {/* Filter */}
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                {(['all', 'missing', 'partial', 'complete'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: filter === f ? '#ccff00' : '#1a1a1a',
                      color: filter === f ? '#000000' : '#888888',
                      border: 'none',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {f} ({f === 'all' ? status.languages.length : status.languages.filter(l => l.status === f).length})
                  </button>
                ))}
              </div>

              {/* Languages Table */}
              <div style={styles.languageTable}>
                <div style={styles.tableHeader}>
                  <span>☐</span>
                  <span>Language</span>
                  <span>Status</span>
                  <span>Progress</span>
                  <span>Keys</span>
                  <span>Est. Cost</span>
                </div>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {filteredLanguages.map(lang => {
                    const statusColors = getStatusColor(lang.status);
                    const isSelected = selectedLanguages.has(lang.code);
                    return (
                      <div
                        key={lang.code}
                        style={{
                          ...styles.tableRow,
                          backgroundColor: isSelected ? 'rgba(204, 255, 0, 0.05)' : 'transparent',
                          cursor: 'pointer',
                        }}
                        onClick={() => toggleLanguage(lang.code)}
                      >
                        <span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{lang.flag}</span>
                          <div>
                            <div style={{ fontWeight: 500 }}>{lang.name}</div>
                            <div style={{ fontSize: '12px', color: '#666666' }}>{lang.code}</div>
                          </div>
                        </span>
                        <span>
                          <span style={{
                            ...styles.badge,
                            backgroundColor: statusColors.bg,
                            color: statusColors.color,
                          }}>
                            {lang.status === 'complete' ? '✓' : lang.status === 'partial' ? '◐' : '✗'} {lang.status}
                          </span>
                        </span>
                        <span>
                          <div style={styles.progressBar}>
                            <div style={{
                              ...styles.progressFill,
                              width: `${lang.progress}%`,
                              backgroundColor: statusColors.color,
                            }} />
                          </div>
                          <span style={{ fontSize: '11px', color: '#666666' }}>{lang.progress}%</span>
                        </span>
                        <span style={{ color: '#888888' }}>
                          {lang.keyCount.toLocaleString()}/{lang.sourceKeyCount.toLocaleString()}
                        </span>
                        <span style={{ color: lang.estimatedCost > 0 ? '#ccff00' : '#666666' }}>
                          ${lang.estimatedCost.toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Translation Log */}
              {showLog && translateLog.length > 0 && (
                <div style={{
                  marginTop: '24px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #222222',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 20px',
                    borderBottom: '1px solid #222222',
                    backgroundColor: '#111111',
                  }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600 }}>
                      📋 Translation Log
                    </h3>
                    <button
                      onClick={() => setShowLog(false)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#1a1a1a',
                        color: '#666666',
                        border: 'none',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Hide
                    </button>
                  </div>
                  <pre style={{
                    padding: '16px 20px',
                    margin: 0,
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: '#22c55e',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {translateLog.join('\n')}
                  </pre>
                </div>
              )}

              {/* Grok API Info */}
              <div style={{
                marginTop: '24px',
                backgroundColor: '#111111',
                border: '1px solid #222222',
                borderRadius: '12px',
                padding: '20px',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                  🤖 Grok API Translation
                </h3>
                <div style={{ fontSize: '14px', color: '#888888', lineHeight: 1.6 }}>
                  <p style={{ marginBottom: '8px' }}>
                    Using <code style={{ backgroundColor: '#0a0a0a', padding: '2px 6px', borderRadius: '4px' }}>grok-4-fast-non-reasoning</code> model
                  </p>
                  <p style={{ marginBottom: '8px' }}>
                    Pricing: <span style={{ color: '#ccff00' }}>$0.20</span>/1M input tokens + <span style={{ color: '#ccff00' }}>$0.50</span>/1M output tokens
                  </p>
                  <p>
                    {config?.grokConfigured ? (
                      <span style={{ color: '#22c55e' }}>✓ GROK_API_KEY configurata</span>
                    ) : (
                      <span style={{ color: '#eab308' }}>⚠ Aggiungi GROK_API_KEY in .env.local per abilitare le traduzioni</span>
                    )}
                  </p>
                  <p style={{ marginTop: '8px' }}>
                    {config?.githubConfigured ? (
                      <span style={{ color: '#22c55e' }}>✓ GITHUB_TOKEN configurato</span>
                    ) : (
                      <span style={{ color: '#eab308' }}>⚠ Aggiungi GITHUB_TOKEN per sincronizzare su GitHub</span>
                    )}
                  </p>
                  {config?.credits !== null && config?.credits !== undefined && (
                    <p style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #222222' }}>
                      💳 Credito disponibile: <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '18px' }}>${config.credits.toFixed(2)}</span>
                      <button
                        onClick={fetchConfig}
                        style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#1a1a1a',
                          color: '#666666',
                          border: 'none',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        🔄
                      </button>
                    </p>
                  )}
                  {sessionCost > 0 && (
                    <p style={{ marginTop: '8px' }}>
                      💰 Speso in sessione: <span style={{ color: '#eab308', fontWeight: 600 }}>${sessionCost.toFixed(4)}</span>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
