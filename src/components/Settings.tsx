import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSetting, setSetting } from '../providers/settings-helper';
import { getStorageEstimate } from '../storage/persist';
import { ArrowLeft, Key, HardDrive, Trash2, Sun, Eye, EyeOff, FolderOpen, FolderX } from 'lucide-react';
import { hasLinkedFolder, linkFolder, unlinkFolder, getLinkedFolder } from '../storage/folder-access';

export function Settings() {
  const navigate = useNavigate();
  const [deepseekKey, setDeepseekKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [storage, setStorage] = useState<{ usageMB: number; quotaMB: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system');
  const [showKeys, setShowKeys] = useState(false);
  const [folderLinked, setFolderLinked] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [folderSupported] = useState(() => 'showDirectoryPicker' in window);

  useEffect(() => {
    (async () => {
      const dk = await getSetting<string>('api_key_deepseek');
      const ak = await getSetting<string>('api_key_anthropic');
      const savedTheme = await getSetting<'system' | 'dark' | 'light'>('theme');
      if (dk) setDeepseekKey(dk);
      if (ak) setAnthropicKey(ak);
      if (savedTheme) setTheme(savedTheme);
      setStorage(await getStorageEstimate());
      const linked = await hasLinkedFolder();
      setFolderLinked(linked);
      if (linked) {
        const handle = await getLinkedFolder();
        if (handle) setFolderName(handle.name);
      }
    })();
  }, []);

  const handleThemeChange = async (newTheme: 'system' | 'dark' | 'light') => {
    setTheme(newTheme);
    await setSetting('theme', newTheme);
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    if (newTheme !== 'system') root.classList.add(`theme-${newTheme}`);
  };

  const handleSave = async () => {
    await setSetting('api_key_deepseek', deepseekKey);
    await setSetting('api_key_anthropic', anthropicKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testKeys = async () => {
    setTesting(true);
    try {
      if (deepseekKey) {
        const resp = await fetch('https://api.deepseek.com/v1/models', {
          headers: { Authorization: `Bearer ${deepseekKey}` },
        });
        if (!resp.ok) throw new Error(`DeepSeek: ${resp.status}`);
      }
      if (anthropicKey) {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
        });
        if (!resp.ok && resp.status !== 400) throw new Error(`Anthropic: ${resp.status}`);
      }
      alert('Keys validated successfully');
    } catch (e) {
      alert(`Validation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setTesting(false);
  };

  const clearAll = async () => {
    if (!confirm('This will delete ALL data including PDFs and conversations. Continue?')) return;
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    window.location.reload();
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-auto">
      <header className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-surface-hover rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold">Settings</h1>
      </header>

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
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text').trim();
                  setDeepseekKey(pasted);
                }}
                placeholder="sk-..."
                autoComplete="off"
                className="w-full bg-surface rounded-xl px-4 py-3 pr-12 text-sm outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKeys(!showKeys)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              >
                {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">Anthropic</label>
            <div className="relative">
              <input
                type={showKeys ? 'text' : 'password'}
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text').trim();
                  setAnthropicKey(pasted);
                }}
                placeholder="sk-ant-..."
                autoComplete="off"
                className="w-full bg-surface rounded-xl px-4 py-3 pr-12 text-sm outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKeys(!showKeys)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              >
                {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-accent text-bg text-sm font-medium"
          >
            {saved ? 'Saved' : 'Save Keys'}
          </button>
          <button
            onClick={testKeys}
            disabled={testing}
            className="px-4 py-2 rounded-xl border border-border text-sm disabled:opacity-40"
          >
            {testing ? 'Testing...' : 'Test Keys'}
          </button>
        </div>
      </section>

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
              <div
                className="h-full bg-accent rounded-full"
                style={{ width: `${Math.min(100, (storage.usageMB / storage.quotaMB) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4 mb-8">
        <div className="flex items-center gap-2 text-muted mb-2">
          <Sun size={16} />
          <h2 className="text-sm font-medium uppercase tracking-wide">Display</h2>
        </div>
        <div className="bg-surface rounded-xl p-1 flex gap-1">
          {([['system', 'System'], ['dark', 'Dark'], ['light', 'E Ink']] as const).map(([id, label]) => (
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
        <p className="text-xs text-muted">
          E Ink mode uses high-contrast black-on-white for e-paper displays.
        </p>
      </section>

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
                  onClick={async () => {
                    await unlinkFolder();
                    setFolderLinked(false);
                    setFolderName(null);
                  }}
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
                onClick={async () => {
                  const handle = await linkFolder();
                  if (handle) {
                    setFolderLinked(true);
                    setFolderName(handle.name);
                  }
                }}
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
