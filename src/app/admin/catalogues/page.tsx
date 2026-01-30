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
  categoryCard: {
    backgroundColor: '#111111',
    border: '1px solid #222222',
    borderRadius: '12px',
    marginBottom: '24px',
    overflow: 'hidden',
  },
  categoryHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #222222',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileRow: {
    padding: '12px 20px',
    borderBottom: '1px solid #1a1a1a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: '#111111',
    border: '1px solid #222222',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #222222',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBody: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
};

interface CatalogueFile {
  name: string;
  path: string;
  category: string;
  size: number;
  description?: string;
}

interface CatalogueCategory {
  name: string;
  description: string;
  files: CatalogueFile[];
}

interface CataloguesData {
  basePath: string;
  categories: CatalogueCategory[];
  totalFiles: number;
  readme: string;
}

export default function CataloguesPage() {
  const [data, setData] = useState<CataloguesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const fetchCatalogues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/catalogues');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogues();
  }, [fetchCatalogues]);

  const openFile = async (filePath: string) => {
    setSelectedFile(filePath);
    setLoadingFile(true);
    try {
      const res = await fetch(`/api/catalogues?file=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Failed to fetch file');
      const json = await res.json();
      setFileContent(json.content);
    } catch (err) {
      setFileContent({ error: String(err) });
    } finally {
      setLoadingFile(false);
    }
  };

  const closeModal = () => {
    setSelectedFile(null);
    setFileContent(null);
  };

  const getCategoryIcon = (name: string) => {
    const icons: Record<string, string> = {
      countries: '🌍',
      languages: '🗣️',
      voices: '🎙️',
      models: '🤖',
      billing: '💳',
      compliance: '📋',
      pricing: '💵',
      telephony: '📞',
    };
    return icons[name] || '📁';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
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
          <Link href="/admin/i18n" style={styles.navItem}>🌍 Translations</Link>
          <Link href="/admin/catalogues" style={{ ...styles.navItem, ...styles.navItemActive }}>📚 Catalogues</Link>
          <Link href="/admin/calls" style={styles.navItem}>📞 Monitoring</Link>
          <Link href="/admin/finance" style={styles.navItem}>📈 Finance</Link>
        </nav>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 600 }}>Catalogues</div>
            <div style={{ fontSize: '12px', color: '#666666' }}>
              Agoralia App configuration files
            </div>
          </div>
          <button
            onClick={fetchCatalogues}
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
        </header>

        <div style={styles.content}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#666666' }}>
              ⏳ Loading catalogues...
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
          ) : data && (
            <>
              {/* Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '24px',
              }}>
                <div style={{
                  backgroundColor: '#111111',
                  border: '1px solid #222222',
                  borderRadius: '12px',
                  padding: '20px',
                }}>
                  <div style={{ fontSize: '12px', color: '#666666', marginBottom: '8px' }}>Categories</div>
                  <div style={{ fontSize: '32px', fontWeight: 700 }}>{data.categories.length}</div>
                </div>
                <div style={{
                  backgroundColor: '#111111',
                  border: '1px solid #222222',
                  borderRadius: '12px',
                  padding: '20px',
                }}>
                  <div style={{ fontSize: '12px', color: '#666666', marginBottom: '8px' }}>Total Files</div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: '#ccff00' }}>{data.totalFiles}</div>
                </div>
                <div style={{
                  backgroundColor: '#111111',
                  border: '1px solid #222222',
                  borderRadius: '12px',
                  padding: '20px',
                }}>
                  <div style={{ fontSize: '12px', color: '#666666', marginBottom: '8px' }}>Source</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#888888', wordBreak: 'break-all' }}>
                    Agoralia/catalogues/
                  </div>
                </div>
              </div>

              {/* Categories */}
              {data.categories.map(category => (
                <div key={category.name} style={styles.categoryCard}>
                  <div style={styles.categoryHeader}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getCategoryIcon(category.name)} {category.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666666', marginTop: '4px' }}>
                        {category.description}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#1a1a1a',
                      fontSize: '12px',
                      color: '#888888',
                    }}>
                      {category.files.length} files
                    </div>
                  </div>
                  
                  {category.files.map(file => (
                    <div
                      key={file.path}
                      style={styles.fileRow}
                      onClick={() => openFile(file.path)}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a1a1a')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>
                          📄 {file.name}
                        </div>
                        {file.description && (
                          <div style={{ fontSize: '12px', color: '#666666', marginTop: '2px' }}>
                            {file.description}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666666' }}>
                        {formatSize(file.size)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Info box */}
              <div style={{
                backgroundColor: '#111111',
                border: '1px solid #222222',
                borderRadius: '12px',
                padding: '20px',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                  ℹ️ About Catalogues
                </h3>
                <div style={{ fontSize: '14px', color: '#888888', lineHeight: 1.6 }}>
                  <p style={{ marginBottom: '8px' }}>
                    Questi file JSON controllano liste e cataloghi dell'App Agoralia:
                  </p>
                  <ul style={{ marginLeft: '20px', marginBottom: '8px' }}>
                    <li><strong>languages/</strong> - Lingue UI e lingue voci (Retell/Vapi)</li>
                    <li><strong>voices/</strong> - Voci disponibili per le chiamate</li>
                    <li><strong>models/</strong> - Modelli LLM per gli agent</li>
                    <li><strong>countries/</strong> - Mapping nomi paese → ISO</li>
                    <li><strong>billing/</strong> - Metodi di pagamento locali (dLocal)</li>
                    <li><strong>compliance/</strong> - Regimi B2B e dati compliance per paese (quiet hours, DNC, AI disclosure)</li>
                    <li><strong>pricing/</strong> - Costi operativi RetellAI/Vapi (voice engines, LLM, telephony)</li>
                    <li><strong>telephony/</strong> - Copertura telefonica Telnyx (127 paesi, Local/Toll-Free/Mobile)</li>
                  </ul>
                  <p>
                    Modifica i file JSON per aggiornare l'app senza toccare il codice. Dati compliance e pricing provengono da KB Agoralia.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modal for file content */}
      {selectedFile && (
        <div style={styles.modal} onClick={closeModal}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>📄 {selectedFile}</div>
              </div>
              <button
                onClick={closeModal}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#1a1a1a',
                  color: '#888888',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                ✕ Close
              </button>
            </div>
            <div style={styles.modalBody}>
              {loadingFile ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666666' }}>
                  ⏳ Loading...
                </div>
              ) : (
                <pre style={{
                  margin: 0,
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: '#ccff00',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {JSON.stringify(fileContent, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
