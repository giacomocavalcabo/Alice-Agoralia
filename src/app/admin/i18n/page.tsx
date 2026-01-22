"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LanguageStatus {
  locale: string;
  name: string;
  exists: boolean;
  keys: number;
  translated: number;
  memory: number;
  lastModified?: string;
  costFull?: number;
  costMissing?: number;
}

interface TranslationMemory {
  [locale: string]: {
    [path: string]: any;
  };
}

interface Project {
  id: string;
  name: string;
}

export default function I18nDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('site');
  const [languages, setLanguages] = useState<LanguageStatus[]>([]);
  const [enSnapshot, setEnSnapshot] = useState<any>(null);
  const [currentEn, setCurrentEn] = useState<any>(null);
  const [memory, setMemory] = useState<TranslationMemory>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  const [jsonView, setJsonView] = useState<any>(null);
  const [selectedLocales, setSelectedLocales] = useState<Set<string>>(new Set());
  const [translationProgress, setTranslationProgress] = useState<Record<string, { current: number; total: number; percentage: number; block_name: string }>>({});

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadData();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/admin-translation/i18n/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (data.projects && data.projects.length > 0 && !selectedProject) {
          setSelectedProject(data.projects[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const projectParam = `?project=${selectedProject}`;
      const [langsRes, snapshotRes, enRes, memRes] = await Promise.all([
        fetch(`/api/admin-translation/i18n/languages${projectParam}`),
        fetch(`/api/admin-translation/i18n/snapshot${projectParam}`),
        fetch(`/api/admin-translation/i18n/en${projectParam}`),
        fetch(`/api/admin-translation/i18n/memory${projectParam}`)
      ]);

      if (langsRes.ok) {
        const langs = await langsRes.json();
        setLanguages(langs);
      } else {
        const err = await langsRes.json().catch(() => ({}));
        setLanguages([]);
        setError(err?.error || `Errore ${langsRes.status}`);
      }

      if (snapshotRes.ok) {
        const snapshot = await snapshotRes.json();
        setEnSnapshot(snapshot);
      }

      if (enRes.ok) {
        const en = await enRes.json();
        setCurrentEn(en);
      }

      if (memRes.ok) {
        const mem = await memRes.json();
        setMemory(mem);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setLanguages([]);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (v?: number) => {
    if (v === undefined || Number.isNaN(v)) return '–';
    return `$${v.toFixed(4)}`;
  };

  const totalCostFull = languages.reduce((sum, l) => sum + (l.costFull || 0), 0);
  const totalCostMissing = languages.reduce((sum, l) => sum + (l.costMissing || 0), 0);

  const translateLanguage = async (locale: string, createMissing: boolean = false) => {
    setTranslating(locale);
    setTranslationProgress(prev => ({ ...prev, [locale]: { current: 0, total: 0, percentage: 0, block_name: 'Inizio...' } }));
    
    // Avvia polling del progresso
    const progressInterval = setInterval(async () => {
      try {
        const progressRes = await fetch(`/api/admin-translation/i18n/progress?locale=${locale}&project=${selectedProject}`);
        if (progressRes.ok) {
          const progress = await progressRes.json();
          if (progress) {
            setTranslationProgress(prev => ({ ...prev, [locale]: progress }));
          } else {
            // Progresso null = traduzione completata
            clearInterval(progressInterval);
          }
        }
      } catch (error) {
        // Ignora errori di polling
      }
    }, 1000); // Poll ogni secondo
    
    try {
      const res = await fetch('/api/admin-translation/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, createMissing, project: selectedProject })
      });

      if (res.ok) {
        const result = await res.json();
        clearInterval(progressInterval);
        setTranslationProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[locale];
          return newProgress;
        });
        alert(`Traduzione ${locale}: ${result.success ? 'Completata' : 'Parziale'}`);
        loadData();
      } else {
        let errorMessage = 'Errore sconosciuto';
        try {
          const error = await res.json();
          errorMessage = error?.error || error?.message || JSON.stringify(error);
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        clearInterval(progressInterval);
        alert(`Errore: ${errorMessage}`);
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      const errorMessage = error?.message || error?.toString() || 'Errore di connessione';
      alert(`Errore: ${errorMessage}`);
    } finally {
      setTranslating(null);
    }
  };

  const toggleLocale = (locale: string) => {
    const newSet = new Set(selectedLocales);
    if (newSet.has(locale)) {
      newSet.delete(locale);
    } else {
      newSet.add(locale);
    }
    setSelectedLocales(newSet);
  };

  const selectAll = () => {
    setSelectedLocales(new Set(languages.map(l => l.locale)));
  };

  const deselectAll = () => {
    setSelectedLocales(new Set());
  };

  const translateSelected = async (createMissing: boolean = false) => {
    if (selectedLocales.size === 0) {
      alert('Seleziona almeno una lingua');
      return;
    }

    if (!confirm(`Traduci ${selectedLocales.size} lingua/e selezionata/e?`)) return;
    
    setTranslating('selected');
    const locales = Array.from(selectedLocales);
    let success = 0;
    let failed = 0;

    for (const locale of locales) {
      try {
        const res = await fetch('/api/admin-translation/i18n/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, createMissing, project: selectedProject })
        });

        if (res.ok) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }

    alert(`Completato: ${success} successi, ${failed} falliti`);
    setTranslating(null);
    loadData();
  };

  const translateAll = async () => {
    if (!confirm('Traduci tutte le lingue?')) return;
    
    setTranslating('all');
    try {
      const res = await fetch('/api/admin-translation/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: null, createMissing: true, project: selectedProject })
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Traduzione completata: ${result.success}/${result.total} lingue`);
        loadData();
      } else {
        let errorMessage = 'Errore sconosciuto';
        try {
          const error = await res.json();
          errorMessage = error?.error || error?.message || JSON.stringify(error);
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        alert(`Errore: ${errorMessage}`);
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Errore di connessione';
      alert(`Errore: ${errorMessage}`);
    } finally {
      setTranslating(null);
    }
  };

  const translateAllMissing = async () => {
    if (!confirm('Aggiorna (solo chiavi mancanti) tutte le lingue?')) return;
    
    setTranslating('all');
    try {
      const res = await fetch('/api/admin-translation/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: null, createMissing: false, project: selectedProject })
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Aggiornamento completato: ${result.success}/${result.total} lingue`);
        loadData();
      } else {
        let errorMessage = 'Errore sconosciuto';
        try {
          const error = await res.json();
          errorMessage = error?.error || error?.message || JSON.stringify(error);
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        alert(`Errore: ${errorMessage}`);
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Errore di connessione';
      alert(`Errore: ${errorMessage}`);
    } finally {
      setTranslating(null);
    }
  };

  const viewJson = async (locale: string) => {
    try {
        const res = await fetch(`/api/admin-translation/i18n/json?locale=${locale}&project=${selectedProject}`);
      if (res.ok) {
        const data = await res.json();
        setJsonView({ locale, data });
        setSelectedLocale(locale);
      }
    } catch (error) {
      console.error('Error loading JSON:', error);
    }
  };

  const getChanges = () => {
    if (!enSnapshot || !currentEn) return { added: [], changed: [], removed: [] };
    
    const snapshotKeys = new Set(Object.keys(enSnapshot));
    const currentKeys = new Set(Object.keys(currentEn));
    
    const added = Array.from(currentKeys).filter(k => !snapshotKeys.has(k));
    const removed = Array.from(snapshotKeys).filter(k => !currentKeys.has(k));
    const changed = Array.from(currentKeys).filter(k => {
      if (!snapshotKeys.has(k)) return false;
      return JSON.stringify(enSnapshot[k]) !== JSON.stringify(currentEn[k]);
    });

    return { added, changed, removed };
  };

  const changes = getChanges();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white p-8 flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 gap-4">
          <h1 className="text-4xl font-bold text-[#ccff00]">
            🌍 Dashboard Traduzioni i18n
          </h1>
          {projects.length > 0 && (
            <div className="flex items-center gap-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className={`px-4 py-2 rounded-lg border text-sm ${
                    selectedProject === project.id
                      ? 'border-[#ccff00] text-[#ccff00] bg-[#1a1a1a]'
                      : 'border-[#2a2a2a] text-white hover:border-[#ccff00]'
                  }`}
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Changes Alert */}
        {changes.added.length > 0 || changes.changed.length > 0 || changes.removed.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1a1a] border border-[#ccff00] rounded-lg p-4 mb-6"
          >
            <h2 className="text-xl font-bold mb-3 text-[#ccff00]">📝 Cambiamenti in EN.json</h2>
            {changes.added.length > 0 && (
              <div className="mb-2">
                <span className="text-green-400">+ {changes.added.length} nuove chiavi:</span>
                <div className="text-sm text-gray-400 ml-4 mt-1">
                  {changes.added.slice(0, 5).join(', ')}
                  {changes.added.length > 5 && ` ... +${changes.added.length - 5}`}
                </div>
              </div>
            )}
            {changes.changed.length > 0 && (
              <div className="mb-2">
                <span className="text-yellow-400">~ {changes.changed.length} chiavi modificate:</span>
                <div className="text-sm text-gray-400 ml-4 mt-1">
                  {changes.changed.slice(0, 5).join(', ')}
                  {changes.changed.length > 5 && ` ... +${changes.changed.length - 5}`}
                </div>
              </div>
            )}
            {changes.removed.length > 0 && (
              <div>
                <span className="text-red-400">- {changes.removed.length} chiavi rimosse:</span>
                <div className="text-sm text-gray-400 ml-4 mt-1">
                  {changes.removed.slice(0, 5).join(', ')}
                  {changes.removed.length > 5 && ` ... +${changes.removed.length - 5}`}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="bg-[#1a1a1a] border border-green-500 rounded-lg p-4 mb-6">
            ✅ Nessun cambiamento in EN.json dall'ultimo snapshot
          </div>
        )}

        {/* Actions */}
        <div className="space-y-4 mb-6">
          {/* Bulk Selection */}
          <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedLocales.size === languages.length && languages.length > 0}
                onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="text-sm">
                {selectedLocales.size > 0 
                  ? `${selectedLocales.size} lingua/e selezionata/e`
                  : 'Seleziona lingue'}
              </span>
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => translateSelected(false)}
                disabled={translating !== null || selectedLocales.size === 0}
                className="px-4 py-2 bg-[#ccff00] text-[#0f0f0f] rounded-lg font-bold hover:bg-[#b8e600] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {translating === 'selected' ? '⏳' : '🔄 Aggiorna Selezionate'}
              </button>
              <button
                onClick={() => translateSelected(true)}
                disabled={translating !== null || selectedLocales.size === 0}
                className="px-4 py-2 bg-[#ccff00] text-[#0f0f0f] rounded-lg font-bold hover:bg-[#b8e600] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {translating === 'selected' ? '⏳' : '➕ Crea/Traduci Selezionate'}
              </button>
            </div>
          </div>

          {/* Global Actions */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={translateAll}
                disabled={translating !== null}
                className="px-6 py-3 bg-[#ccff00] text-[#0f0f0f] rounded-lg font-bold hover:bg-[#b8e600] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {translating === 'all' ? '⏳ Traducendo...' : '🚀 Traduci tutte le lingue'}
              </button>
              <span className="text-sm text-gray-300">({formatCost(totalCostFull)})</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={translateAllMissing}
                disabled={translating !== null}
                className="px-6 py-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg font-bold hover:border-[#ccff00] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {translating === 'all' ? '⏳ Aggiornando...' : '🔁 Aggiorna tutte (chiavi mancanti)'}
              </button>
              <span className="text-sm text-gray-300">({formatCost(totalCostMissing)})</span>
            </div>

            <button
              onClick={loadData}
              className="px-6 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg font-bold hover:border-[#ccff00]"
            >
              🔄 Ricarica
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/40 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
            Errore: {error}
          </div>
        )}

        {/* Languages Table */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0f0f0f] border-b border-[#2a2a2a]">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedLocales.size === languages.length && languages.length > 0}
                      onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                      className="w-5 h-5 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-[#ccff00]">Lingua</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-[#ccff00]">Locale</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-[#ccff00]">Stato</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-[#ccff00]">Progresso</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-[#ccff00]">Chiavi</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-[#ccff00]">Tradotte</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-[#ccff00]">Memoria</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-[#ccff00]">Costo full</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-[#ccff00]">Costo update</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-[#ccff00]">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {languages.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-gray-400">
                      Nessuna lingua trovata per il progetto selezionato.
                    </td>
                  </tr>
                )}
                {languages.map((lang, idx) => {
                  const progress = lang.keys > 0 ? Math.floor((lang.translated / lang.keys) * 100 * 10) / 10 : 0;
                  const memCount = lang.memory || 0;
                  const isTranslating = translating === lang.locale;
                  const isSelected = selectedLocales.has(lang.locale);

                  return (
                    <motion.tr
                      key={lang.locale}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`border-b border-[#2a2a2a] hover:bg-[#1a2a1a] transition-colors ${
                        isSelected ? 'bg-[#1a2a1a]' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleLocale(lang.locale)}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{lang.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-gray-400 bg-[#0f0f0f] px-2 py-1 rounded">{lang.locale}</code>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {lang.exists ? (
                          <span className="text-green-400 text-lg">✓</span>
                        ) : (
                          <span className="text-gray-500 text-lg">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#0f0f0f] rounded-full h-2 min-w-[100px]">
                            {translationProgress[lang.locale] ? (
                              <>
                                <div
                                  className="bg-[#ccff00] h-2 rounded-full transition-all"
                                  style={{ width: `${translationProgress[lang.locale].percentage}%` }}
                                />
                                <div className="text-xs text-gray-500 mt-1 truncate">
                                  {translationProgress[lang.locale].current}/{translationProgress[lang.locale].total} - {translationProgress[lang.locale].block_name}
                                </div>
                              </>
                            ) : (
                              <div
                                className="bg-[#ccff00] h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            )}
                          </div>
                          <span className="text-sm text-gray-400 min-w-[3ch]">
                            {translationProgress[lang.locale] ? translationProgress[lang.locale].percentage : progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{lang.keys}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{lang.translated}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{memCount}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{formatCost(lang.costFull)}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{formatCost(lang.costMissing)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => translateLanguage(lang.locale, !lang.exists)}
                            disabled={isTranslating || (translating !== null && translating !== 'selected' && translating !== 'all')}
                            className="px-3 py-1 bg-[#ccff00] text-[#0f0f0f] rounded-lg font-bold hover:bg-[#b8e600] disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            title={lang.exists ? 'Aggiorna traduzione' : 'Crea e traduci'}
                          >
                            {isTranslating ? '⏳' : lang.exists ? '🔄' : '➕'}
                          </button>
                          <button
                            onClick={() => viewJson(lang.locale)}
                            className="px-3 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#ccff00] text-xs"
                            title="Visualizza JSON"
                          >
                            👁️
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* JSON Viewer Modal */}
        {jsonView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50"
            onClick={() => setJsonView(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] border border-[#ccff00] rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-[#ccff00]">
                  {jsonView.locale}.json
                </h2>
                <button
                  onClick={() => setJsonView(null)}
                  className="px-4 py-2 bg-[#0f0f0f] rounded-lg hover:bg-[#2a2a2a]"
                >
                  ✕
                </button>
              </div>
              <pre className="text-sm text-gray-300 overflow-auto bg-[#0f0f0f] p-4 rounded">
                {JSON.stringify(jsonView.data, null, 2)}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

