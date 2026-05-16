import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSetting, setSetting } from '../providers/settings-helper';
import { getStorageEstimate } from '../storage/persist';
import { fetchOpenRouterUsage, fetchOpenRouterModels, type OpenRouterModel, type OpenRouterUsage } from '../providers/openrouter';
import { fetchDeepSeekModels, type DeepSeekModel } from '../providers/deepseek';
import { ArrowLeft, Key, HardDrive, Trash2, Sun, Eye, EyeOff, FolderOpen, FolderX, DollarSign, Cpu, RefreshCw } from 'lucide-react';
import { hasLinkedFolder, linkFolder, unlinkFolder, getLinkedFolder } from '../storage/folder-access';

type ThemeId = 'system' | 'dark' | 'light' | 'eink';

export function Settings() {
  const navigate = useNavigate();
  const [deepseekKey, setDeepseekKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [braveKey, setBraveKey] = useState('');
  const [storage, setStorage] = useState<{ usageMB: number; quotaMB: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('system');
  const [showKeys, setShowKeys] = useState(false);
  const [folderLinked, setFolderLinked] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [folderSupported] = useState(() => 'showDirectoryPicker' in window);

  const [deepseekModel, setDeepseekModel] = useState('deepseek-chat');
  const [visionProvider, setVisionProvider] = useState<'openrouter' | 'deepseek'>('openrouter');
  const [orTextModel, setOrTextModel] = useState('');
  const [orVisionModel, setOrVisionModel] = useState('');
  const [dsModels, setDsModels] = useState<DeepSeekModel[]>([]);
  const [loadingDsModels, setLoadingDsModels] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [usage, setUsage] = useState<OpenRouterUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [modelFilter, setModelFilter] = useState('');

  useEffect(() => {
    (async () => {
      const dk = await getSetting<string>('api_key_deepseek');
      const ork = await getSetting<string>('api_key_openrouter');
      const bk = await getSetting<string>('api_key_brave');
      const savedTheme = await getSetting<ThemeId>('theme');
      const savedDsModel = await getSetting<string>('deepseek_model');
      const savedVisionProv = await getSetting<string>('vision_provider');
      const savedOrText = await getSetting<string>('openrouter_model_text');
      const savedOrVision = await getSetting<string>('openrouter_model_vision');
      if (dk) setDeepseekKey(dk);
      if (ork) setOpenrouterKey(ork);
      if (bk) setBraveKey(bk);
      if (savedTheme) setTheme(savedTheme);
      if (savedDsModel) setDeepseekModel(savedDsModel);
      if (savedVisionProv === 'deepseek') setVisionProvider('deepseek');
      if (savedOrText) setOrTextModel(savedOrText);
      if (savedOrVision) setOrVisionModel(savedOrVision);
      setStorage(await getStorageEstimate());
      const linked = await hasLinkedFolder();
      setFolderLinked(linked);
      if (linked) {
        const handle = await getLinkedFolder();
        if (handle) setFolderName(handle.name);
      }
      if (ork) {
        const u = await fetchOpenRouterUsage();
        if (u) setUsage(u);
      }
      if (dk) {
        const dm = await fetchDeepSeekModels();
        if (dm.length > 0) setDsModels(dm);
      }
    })();
  }, []);

  const handleThemeChange = async (newTheme: ThemeId) => {
    setTheme(newTheme);
    await setSetting('theme', newTheme);
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-eink');
    if (newTheme !== 'system') root.classList.add(`theme-${newTheme}`);
  };

  const handleSave = async () => {
    await setSetting('api_key_deepseek', deepseekKey);
    await setSetting('api_key_openrouter', openrouterKey);
    await setSetting('api_key_brave', braveKey);
    await setSetting('deepseek_model', deepseekModel);
    await setSetting('vision_provider', visionProvider);
    if (orTextModel) await setSetting('openrouter_model_text', orTextModel);
    if (orVisionModel) await setSetting('openrouter_model_vision', orVisionModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testKeys = async () => {
    setTesting(true);
    const errors: string[] = [];
    try {
      if (deepseekKey) {
        const resp = await fetch('https://api.deepseek.com/v1/models', {
          headers: { Authorization: `Bearer ${deepseekKey}` },
        });
        if (!resp.ok) errors.push(`DeepSeek: ${resp.status}`);
      }
      if (openrouterKey) {
        const resp = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${openrouterKey}` },
        });
        if (!resp.ok) errors.push(`OpenRouter: ${resp.status}`);
        else {
          const u = await fetchOpenRouterUsage();
          if (u) setUsage(u);
        }
      }
      if (errors.length > 0) throw new Error(errors.join(', '));
      alert('Keys validated successfully');
    } catch (e) {
      alert(`Validation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setTesting(false);
  };

  const loadModels = async () => {
    setLoadingModels(true);
    const m = await fetchOpenRouterModels();
    setModels(m);
    setLoadingModels(false);
  };

  const refreshUsage = async () => {
    setLoadingUsage(true);
    const u = await fetchOpenRouterUsage();
    if (u) setUsage(u);
    setLoadingUsage(false);
  };

  const clearAll = async () => {
    if (!confirm('This will delete ALL data including PDFs and conversations. Continue?')) return;
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    window.location.reload();
  };

  const filteredModels = modelFilter
    ? models.filter(m =>
        m.id.toLowerCase().includes(modelFilter.toLowerCase()) ||
        m.name.toLowerCase().includes(modelFilter.toLowerCase())
      )
    : models;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-auto">
      <header className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-surface-hover rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold">Settings</h1>
      </header>

      {/* API Keys */}
      <section className="space-y-4 mb-8">
        <div className="flex items-center gap-2 text-muted mb-2">
          <Key size={16} />
          <h2 className="text-sm font-medium uppercase tracking-wide">API Keys</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted block mb-1">DeepSeek</label>
            <div className="relative">
              <input
                type={showKeys ? 'text' : 'password'}
                value={deepseekKey}
                onChange={(e) => setDeepseekKey(e.target.value)}
                onPaste={(e) => { e.preventDefault(); setDeepseekKey(e.clipboardData.getData('text').trim()); }}
                placeholder="sk-..."
                autoComplete="off"
                className="w-full bg-surface rounded-xl px-4 py-3 pr-12 text-sm outline-none font-mono"
              />
              <button type="button" onClick={() => setShowKeys(!showKeys)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
                {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">OpenRouter <span className="text-xs">(optional)</span></label>
            <div className="relative">
              <input
                type={showKeys ? 'text' : 'password'}
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                onPaste={(e) => { e.preventDefault(); setOpenrouterKey(e.clipboardData.getData('text').trim()); }}
                placeholder="sk-or-..."
                autoComplete="off"
                className="w-full bg-surface rounded-xl px-4 py-3 pr-12 text-sm outline-none font-mono"
              />
              <button type="button" onClick={() => setShowKeys(!showKeys)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
                {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">Brave Search <span className="text-xs">(optional — enables web_search tool)</span></label>
            <div className="relative">
              <input
                type={showKeys ? 'text' : 'password'}
                value={braveKey}
                onChange={(e) => setBraveKey(e.target.value)}
                onPaste={(e) => { e.preventDefault(); setBraveKey(e.clipboardData.getData('text').trim()); }}
                placeholder="BSA..."
                autoComplete="off"
                className="w-full bg-surface rounded-xl px-4 py-3 pr-12 text-sm outline-none font-mono"
              />
              <button type="button" onClick={() => setShowKeys(!showKeys)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
                {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-accent text-bg text-sm font-medium">
            {saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={testKeys} disabled={testing} className="px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-40">
            {testing ? 'Testing...' : 'Test Keys'}
          </button>
        </div>
      </section>

      {/* DeepSeek Model */}
      <section className="space-y-4 mb-8">
        <div className="flex items-center gap-2 text-muted mb-2">
          <Cpu size={16} />
          <h2 className="text-sm font-medium uppercase tracking-wide">DeepSeek Model</h2>
        </div>
        <div>
          <input
            type="text"
            value={deepseekModel}
            onChange={(e) => setDeepseekModel(e.target.value)}
            placeholder="deepseek-chat"
            className="w-full bg-surface rounded-xl px-4 py-3 text-sm outline-none font-mono"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => { setSetting('deepseek_model', deepseekModel); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
              className="px-3 py-1.5 rounded-lg bg-accent text-bg text-xs font-medium"
            >
              {saved ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={async () => { setLoadingDsModels(true); const m = await fetchDeepSeekModels(); if (m.length > 0) setDsModels(m); setLoadingDsModels(false); }}
              disabled={loadingDsModels || !deepseekKey}
              className="flex items-center gap-1 text-xs text-muted hover:text-fg disabled:opacity-40"
            >
              <RefreshCw size={12} className={loadingDsModels ? 'animate-spin' : ''} />
              Refresh models
            </button>
          </div>
        </div>
        {dsModels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {dsModels.map(m => (
              <button
                key={m.id}
                onClick={() => { setDeepseekModel(m.id); setSetting('deepseek_model', m.id); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  deepseekModel === m.id ? 'bg-accent text-bg' : 'bg-surface text-muted hover:text-fg'
                }`}
              >
                {m.id}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted">Used for tutoring, questions, and text tasks. Type any model ID or pick from the list above.</p>
      </section>

      {/* Vision Provider */}
      <section className="space-y-4 mb-8">
        <div className="flex items-center gap-2 text-muted mb-2">
          <Cpu size={16} />
          <h2 className="text-sm font-medium uppercase tracking-wide">Vision / Grading</h2>
        </div>
        <div className="bg-surface rounded-xl p-1 flex gap-1">
          <button
            onClick={() => { setVisionProvider('deepseek'); setSetting('vision_provider', 'deepseek'); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              visionProvider === 'deepseek' ? 'bg-accent text-bg' : 'text-muted hover:text-fg'
            }`}
          >
            DeepSeek
          </button>
          <button
            onClick={() => { setVisionProvider('openrouter'); setSetting('vision_provider', 'openrouter'); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              visionProvider === 'openrouter' ? 'bg-accent text-bg' : 'text-muted hover:text-fg'
            }`}
          >
            OpenRouter
          </button>
        </div>
        <p className="text-xs text-muted">
          {visionProvider === 'deepseek'
            ? 'Uses your DeepSeek key and model for vision tasks.'
            : 'Pick an OpenRouter vision model below.'}
        </p>
      </section>

      {/* OpenRouter Cost */}
      {openrouterKey && (
        <section className="space-y-4 mb-8">
          <div className="flex items-center gap-2 text-muted mb-2">
            <DollarSign size={16} />
            <h2 className="text-sm font-medium uppercase tracking-wide">OpenRouter Usage</h2>
          </div>
          {usage ? (
            <div className="bg-surface rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Spent</span>
                <span className="font-mono">${usage.totalUsd.toFixed(4)}</span>
              </div>
              {usage.limitUsd != null && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Limit</span>
                    <span className="font-mono">${usage.limitUsd.toFixed(2)}</span>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, (usage.totalUsd / usage.limitUsd) * 100)}%` }} />
                  </div>
                </>
              )}
              {usage.rateLimitRequests != null && (
                <div className="flex justify-between text-sm text-muted">
                  <span>Rate limit</span>
                  <span>{usage.rateLimitRequests} req / {usage.rateLimitInterval}</span>
                </div>
              )}
              <button onClick={refreshUsage} disabled={loadingUsage} className="flex items-center gap-1 text-xs text-muted hover:text-fg mt-1">
                <RefreshCw size={12} className={loadingUsage ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">Loading...</p>
          )}
        </section>
      )}

      {/* OpenRouter Models */}
      {visionProvider === 'openrouter' && (
        <section className="space-y-4 mb-8">
          <div className="flex items-center gap-2 text-muted mb-2">
            <Cpu size={16} />
            <h2 className="text-sm font-medium uppercase tracking-wide">OpenRouter Models</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted block mb-1">Vision / Grading model</label>
              <input
                type="text"
                value={orVisionModel}
                onChange={(e) => setOrVisionModel(e.target.value)}
                placeholder="anthropic/claude-sonnet-4-5-20241022"
                className="w-full bg-surface rounded-xl px-4 py-3 text-sm outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">Text model override <span className="text-xs text-muted">(optional)</span></label>
              <input
                type="text"
                value={orTextModel}
                onChange={(e) => setOrTextModel(e.target.value)}
                placeholder="Leave empty to use DeepSeek direct"
                className="w-full bg-surface rounded-xl px-4 py-3 text-sm outline-none font-mono"
              />
            </div>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-accent text-bg text-sm font-medium">
              {saved ? 'Saved' : 'Save Models'}
            </button>
          </div>

          <div className="pt-2">
            <button onClick={loadModels} disabled={loadingModels} className="flex items-center gap-2 text-sm text-muted hover:text-fg">
              <RefreshCw size={14} className={loadingModels ? 'animate-spin' : ''} />
              {models.length > 0 ? 'Refresh model list' : 'Browse available models'}
            </button>
          </div>

          {models.length > 0 && (
            <div className="space-y-2">
              <input
                type="text"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                placeholder="Filter models..."
                className="w-full bg-surface rounded-xl px-4 py-2 text-sm outline-none"
              />
              <div className="max-h-64 overflow-auto space-y-1 bg-surface rounded-xl p-2">
                {filteredModels.slice(0, 50).map(m => (
                  <div key={m.id} className="flex items-start gap-2 px-2 py-1.5 hover:bg-surface-hover rounded-lg text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{m.name}</p>
                      <p className="text-muted font-mono truncate">{m.id}</p>
                      <p className="text-muted">
                        {(m.contextLength / 1000).toFixed(0)}k ctx
                        {m.promptPricing > 0 && ` · $${m.promptPricing.toFixed(2)}/$${m.completionPricing.toFixed(2)} per 1M`}
                        {m.supportsImages && ' · vision'}
                        {m.supportsTools && ' · tools'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => { setOrTextModel(m.id); handleSave(); }}
                        className="px-2 py-1 rounded bg-bg text-muted hover:text-fg text-[10px] uppercase"
                      >
                        Text
                      </button>
                      {m.supportsImages && (
                        <button
                          onClick={() => { setOrVisionModel(m.id); handleSave(); }}
                          className="px-2 py-1 rounded bg-bg text-muted hover:text-fg text-[10px] uppercase"
                        >
                          Vision
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredModels.length > 50 && (
                  <p className="text-xs text-muted text-center py-1">
                    {filteredModels.length - 50} more — refine your filter
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Display */}
      <section className="space-y-4 mb-8">
        <div className="flex items-center gap-2 text-muted mb-2">
          <Sun size={16} />
          <h2 className="text-sm font-medium uppercase tracking-wide">Display</h2>
        </div>
        <div className="bg-surface rounded-xl p-1 flex gap-1">
          {([['system', 'System'], ['light', 'Light'], ['dark', 'Dark'], ['eink', 'E Ink']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => handleThemeChange(id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === id ? 'bg-accent text-bg' : 'text-muted hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Storage */}
      <section className="space-y-4 mb-8">
        <div className="flex items-center gap-2 text-muted mb-2">
          <HardDrive size={16} />
          <h2 className="text-sm font-medium uppercase tracking-wide">Storage</h2>
        </div>
        {storage && (
          <div className="bg-surface rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span>Used</span>
              <span>{storage.usageMB} MB</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Quota</span>
              <span>{storage.quotaMB} MB</span>
            </div>
            <div className="mt-3 h-2 bg-bg rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, (storage.usageMB / storage.quotaMB) * 100)}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* Study Folder */}
      {folderSupported && (
        <section className="space-y-4 mb-8">
          <div className="flex items-center gap-2 text-muted mb-2">
            <FolderOpen size={16} />
            <h2 className="text-sm font-medium uppercase tracking-wide">Study Folder</h2>
          </div>
          {folderLinked ? (
            <div className="bg-surface rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{folderName ?? 'Linked folder'}</p>
                  <p className="text-xs text-muted">Progress files will be saved here</p>
                </div>
                <button
                  onClick={async () => { await unlinkFolder(); setFolderLinked(false); setFolderName(null); }}
                  className="p-2 text-muted hover:text-grade-red transition-colors"
                  aria-label="Unlink folder"
                >
                  <FolderX size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={async () => { const handle = await linkFolder(); if (handle) { setFolderLinked(true); setFolderName(handle.name); } }}
                className="w-full py-3 rounded-xl border border-border bg-surface text-sm text-muted hover:text-fg hover:border-accent transition-colors"
              >
                Link a folder on this device
              </button>
              <p className="text-xs text-muted">
                Create a folder for each textbook, put the PDF in it, then link it here.
                Newton will save progress markdown files to the same folder.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Danger Zone */}
      <section>
        <button
          onClick={clearAll}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-grade-red/30 text-grade-red text-sm hover:bg-grade-red/10 transition-colors"
        >
          <Trash2 size={16} />
          Clear All Data
        </button>
      </section>
    </div>
  );
}
