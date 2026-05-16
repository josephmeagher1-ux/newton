import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { getProviderAsync } from '../providers/registry';
import { deepseek } from '../providers/registry';
import { getRole, getRoleToolDefs } from '../prompts';
import type { LLMProvider } from '../providers/types';
import { generateId } from '../storage/db';
import { listPdfs, type StoredPdf } from '../storage/pdf-store';
import { ArrowLeft, Send, ClipboardList } from 'lucide-react';

export function ScenarioPage() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [threadId] = useState(() => generateId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ resolve: (v: boolean) => void; tool: string; preview: string } | null>(null);
  const [sources, setSources] = useState<Omit<StoredPdf, 'blob'>[]>([]);
  const [provider, setProvider] = useState<LLMProvider>(deepseek);

  const scenarioRole = useMemo(() => getRole('scenario_builder')!, []);

  useEffect(() => {
    getProviderAsync(scenarioRole.provider).then(setProvider);
    listPdfs().then(setSources);
  }, [scenarioRole.provider]);

  const sourcesSummary = useMemo(() => {
    if (sources.length === 0) return '(No sources in library yet)';
    return sources
      .sort((a, b) => a.tier - b.tier || (b.publicationYear ?? 0) - (a.publicationYear ?? 0))
      .map(s => `- [Tier ${s.tier}] ${s.name}${s.authority ? ` (${s.authority})` : ''}${s.publicationYear ? ` ${s.publicationYear}` : ''} — ${s.sourceType}, ${s.pageCount}pp, id=${s.id}`)
      .join('\n');
  }, [sources]);

  const confirmHandler = useCallback((proposal: { tool: string; preview: string }) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirm({ ...proposal, resolve });
    });
  }, []);

  const systemPrompt = useMemo(
    () => scenarioRole.buildSystemPrompt({ sourcesSummary }),
    [scenarioRole, sourcesSummary],
  );

  const tools = useMemo(() => getRoleToolDefs(scenarioRole), [scenarioRole]);

  const chat = useChat({
    provider,
    systemPrompt,
    tools,
    threadId,
    onToolConfirm: confirmHandler,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [chat.messages]);

  const handleSend = () => {
    if (!input.trim() || chat.streaming) return;
    chat.sendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <header className="flex items-center gap-3 p-4 border-b border-border shrink-0">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-surface-hover rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <ClipboardList size={20} className="text-accent" />
        <div className="flex-1">
          <h1 className="text-lg font-medium">Compile Scenario</h1>
          <p className="text-xs text-muted">{sources.length} sources available</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3">
        {chat.messages.length === 0 && (
          <div className="text-muted text-sm text-center mt-12 px-4">
            <p>Ask me to compile a clinical scenario from your library.</p>
            <p className="mt-2 italic">e.g. "Build a scenario about acute pancreatitis using NICE and the Oxford Handbook."</p>
          </div>
        )}
        {chat.messages.filter(m => m.role !== 'system' && m.role !== 'tool').map((msg) => (
          <div key={msg.id} className={`max-w-[90%] ${msg.role === 'user' ? 'ml-auto' : ''}`}>
            <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-accent/20' : 'bg-surface'}`}>
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
            </div>
          </div>
        ))}
        {chat.streaming && <span className="text-muted animate-pulse text-sm">Searching corpus...</span>}
        {chat.error && <span className="text-grade-red text-sm">{chat.error}</span>}
      </div>

      {pendingConfirm && (
        <div className="border-t border-border p-4 bg-surface space-y-3">
          <p className="text-xs text-muted font-mono">Tool: {pendingConfirm.tool}</p>
          <pre className="text-xs overflow-auto max-h-32 bg-bg rounded-lg p-2">{pendingConfirm.preview.slice(0, 1000)}</pre>
          <div className="flex gap-2">
            <button
              onClick={() => { pendingConfirm.resolve(false); setPendingConfirm(null); }}
              className="px-4 py-2 rounded-lg border border-border text-sm"
            >
              Skip
            </button>
            <button
              onClick={() => { pendingConfirm.resolve(true); setPendingConfirm(null); }}
              className="px-4 py-2 rounded-lg bg-accent text-bg text-sm font-medium"
            >
              Run
            </button>
          </div>
        </div>
      )}

      <div className="shrink-0 p-4 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Describe the scenario you want..."
          className="flex-1 bg-surface rounded-xl px-4 py-3 text-sm outline-none placeholder:text-muted"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || chat.streaming}
          className="p-3 rounded-xl bg-accent text-bg disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
