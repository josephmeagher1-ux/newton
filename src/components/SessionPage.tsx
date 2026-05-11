import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPdf, touchPdf } from '../storage/pdf-store';
import { generateId } from '../storage/db';
import { loadPdfDocument, extractOutline } from '../lib/pdf';
import { buildSectionsFromOutline, getSectionsForPdf, extractSectionContent, type ParsedSection, type PageContent } from '../lib/pdf-sections';
import { useChat } from '../hooks/useChat';
import { deepseek } from '../providers/registry';
import { getToolDefs } from '../tools';
import { getTutorSystemPrompt } from '../prompts/tutorSystem';
import { QuestionRenderer } from './questions';
import { InkCanvas } from './InkCanvas';
import { ArrowLeft, Send, PenTool, Download, Image as ImageIcon } from 'lucide-react';
import type { Question } from '../lib/question-schemas';
import { exportProgressToFolder, readProgressFromFolder } from '../lib/session-progress';

function parseQuestionFromContent(content: string): Question | null {
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]!);
    if (parsed && typeof parsed.modality === 'string') return parsed as Question;
  } catch { /* ignore */ }
  return null;
}

export function SessionPage() {
  const { pdfId, sectionId } = useParams<{ pdfId: string; sectionId?: string }>();
  const navigate = useNavigate();
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const [pdfName, setPdfName] = useState('');
  const [threadId] = useState(() => generateId());
  const [pageText, setPageText] = useState('');
  const [pageContents, setPageContents] = useState<PageContent[]>([]);
  const [currentSection, setCurrentSection] = useState<ParsedSection | null>(null);
  const [input, setInput] = useState('');
  const [showCanvas, setShowCanvas] = useState(false);
  const [showPageImages, setShowPageImages] = useState(false);
  const [priorProgress, setPriorProgress] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{ resolve: (v: boolean) => void; tool: string; preview: string } | null>(null);

  const sectionHeading = currentSection?.heading ?? 'Introduction';

  const confirmHandler = useCallback((proposal: { tool: string; preview: string }) => {
    return new Promise<boolean>((resolve) => {
      setPendingConfirm({ ...proposal, resolve });
    });
  }, []);

  const systemPrompt = useMemo(() => {
    let prompt = getTutorSystemPrompt(sectionHeading, pageText);
    if (priorProgress) {
      prompt += `\n\nPRIOR STUDY PROGRESS (from previous sessions):\n${priorProgress}\n\nUse this to tailor difficulty and focus on weak areas. Don't repeat topics the student has mastered unless reviewing.`;
    }
    return prompt;
  }, [sectionHeading, pageText, priorProgress]);

  const chat = useChat({
    provider: deepseek,
    systemPrompt,
    tools: getToolDefs('read'),
    threadId,
    onToolConfirm: confirmHandler,
  });

  useEffect(() => {
    return () => {
      pageContents.forEach(p => { if (p.imageUrl) URL.revokeObjectURL(p.imageUrl); });
    };
  }, [pageContents]);

  useEffect(() => {
    if (!pdfId) return;
    (async () => {
      const pdf = await getPdf(pdfId);
      if (!pdf) return;
      setPdfName(pdf.name);
      await touchPdf(pdfId);

      const progress = await readProgressFromFolder(pdf.name);
      if (progress) setPriorProgress(progress);

      let existingSections = await getSectionsForPdf(pdfId);
      if (existingSections.length === 0) {
        const doc = await loadPdfDocument(pdf.blob);
        const outline = await extractOutline(doc);
        if (outline.length > 0) {
          existingSections = await buildSectionsFromOutline(doc, pdfId, outline);
        }
        doc.destroy();
      }
      setSections(existingSections);

      if (sectionId && existingSections.length > 0) {
        const idx = parseInt(sectionId, 10);
        const section = existingSections[idx];
        if (section) {
          setCurrentSection(section);
          const doc = await loadPdfDocument(pdf.blob);
          const contents = await extractSectionContent(doc, pdfId, section);
          setPageContents(contents);
          const pagesWithImages = contents.filter(p => p.hasImages).map(p => p.pageNum);
          let text = contents.map(p => p.text).join('\n\n--- Page Break ---\n\n');
          if (pagesWithImages.length > 0) {
            text += `\n\n[NOTE: Pages ${pagesWithImages.join(', ')} contain figures/diagrams. The student can see these images alongside the text.]`;
          }
          setPageText(text);
          doc.destroy();
        }
      }
    })();
  }, [pdfId, sectionId]);

  const handleSend = () => {
    if (!input.trim()) return;
    chat.sendMessage(input.trim());
    setInput('');
  };

  const handleCanvasSubmit = async (pngBlob: Blob) => {
    setShowCanvas(false);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      chat.sendMessage('Here is my handwritten answer:', base64);
    };
    reader.readAsDataURL(pngBlob);
  };

  const handleQuestionAnswer = (answer: unknown) => {
    const answerStr = typeof answer === 'string' ? answer : JSON.stringify(answer);
    chat.sendMessage(`My answer: ${answerStr}`);
  };

  // Section picker view
  if (!sectionId && sections.length > 0) {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-auto">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-surface-hover rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-xl font-semibold">{pdfName}</h1>
          <button
            onClick={async () => {
              if (!pdfId) return;
              setExporting(true);
              const ok = await exportProgressToFolder(pdfId, pdfName);
              setExporting(false);
              if (!ok) alert('Link a study folder in Settings first');
            }}
            disabled={exporting}
            className="p-2 hover:bg-surface-hover rounded-lg text-muted hover:text-fg transition-colors"
            aria-label="Export progress"
            title="Save progress to folder"
          >
            <Download size={20} />
          </button>
        </header>
        <div className="space-y-2">
          {sections.map((section, i) => (
            <button
              key={section.id}
              onClick={() => navigate(`/pdf/${pdfId}/section/${i}`)}
              className="w-full text-left p-4 bg-surface rounded-xl hover:bg-surface-hover transition-colors"
            >
              <p className="font-medium">{section.heading}</p>
              <p className="text-sm text-muted mt-1">
                Pages {section.pageStart}–{section.pageEnd} · ~{section.estimatedMinutes} min
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Check if user already answered the last question
  const lastAssistantIdx = chat.messages.findLastIndex((m) => m.role === 'assistant');
  const answeredLastQuestion = lastAssistantIdx >= 0 && chat.messages.slice(lastAssistantIdx + 1).some((m) => m.role === 'user');

  return (
    <div className="flex-1 flex flex-col h-full">
      <header className="flex items-center gap-3 p-4 border-b border-border shrink-0">
        <button
          onClick={() => {
            if (pdfId && pdfName) exportProgressToFolder(pdfId, pdfName).catch(() => {});
            navigate(sectionId ? `/pdf/${pdfId}` : '/');
          }}
          className="p-2 hover:bg-surface-hover rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 truncate">
          <h1 className="text-lg font-medium truncate">{pdfName}</h1>
          {currentSection && (
            <p className="text-xs text-muted truncate">{currentSection.heading}</p>
          )}
        </div>
        {pageContents.some(p => p.hasImages) && (
          <button
            onClick={() => setShowPageImages(!showPageImages)}
            className={`p-2 rounded-lg transition-colors ${showPageImages ? 'bg-accent/20 text-accent' : 'hover:bg-surface-hover text-muted'}`}
            aria-label="Toggle page images"
            title="View page figures"
          >
            <ImageIcon size={20} />
          </button>
        )}
      </header>

      {showPageImages && (
        <div className="shrink-0 border-b border-border p-4 overflow-x-auto">
          <div className="flex gap-4">
            {pageContents.filter(p => p.hasImages && p.imageUrl).map(p => (
              <div key={p.pageNum} className="shrink-0">
                <img
                  src={p.imageUrl}
                  alt={`Page ${p.pageNum}`}
                  className="max-h-64 rounded-lg border border-border"
                />
                <p className="text-xs text-muted text-center mt-1">Page {p.pageNum}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {chat.messages.filter(m => m.role !== 'system' && m.role !== 'tool').map((msg) => {
          const questionInMsg = msg.role === 'assistant' ? parseQuestionFromContent(msg.content) : null;
          const textWithoutJson = msg.content.replace(/```json[\s\S]*?```/g, '').trim();

          return (
            <div key={msg.id} className={`max-w-[85%] ${msg.role === 'user' ? 'ml-auto' : ''}`}>
              <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-accent/20 text-fg' : 'bg-surface'}`}>
                {textWithoutJson && (
                  <p className="whitespace-pre-wrap text-sm">{textWithoutJson}</p>
                )}
                {questionInMsg && msg === chat.messages[lastAssistantIdx] && !answeredLastQuestion && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <QuestionRenderer
                      question={questionInMsg}
                      onSubmit={handleQuestionAnswer}
                      disabled={chat.streaming}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {chat.streaming && (
          <div className="text-muted text-sm animate-pulse">Thinking...</div>
        )}
        {chat.error && (
          <div className="text-grade-red text-sm">{chat.error}</div>
        )}
      </div>

      {pendingConfirm && (
        <div className="fixed inset-0 bg-bg/80 flex items-end justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md space-y-4">
            <p className="font-medium">Tool: {pendingConfirm.tool}</p>
            <pre className="text-xs text-muted overflow-auto max-h-40 bg-bg rounded-lg p-3">{pendingConfirm.preview}</pre>
            <div className="flex gap-3">
              <button
                onClick={() => { pendingConfirm.resolve(false); setPendingConfirm(null); }}
                className="flex-1 py-3 rounded-xl border border-border text-muted"
              >
                Skip
              </button>
              <button
                onClick={() => { pendingConfirm.resolve(true); setPendingConfirm(null); }}
                className="flex-1 py-3 rounded-xl bg-accent text-bg font-medium"
              >
                Run
              </button>
            </div>
          </div>
        </div>
      )}

      {showCanvas && (
        <InkCanvas onSubmit={handleCanvasSubmit} onCancel={() => setShowCanvas(false)} />
      )}

      <div className="shrink-0 p-4 border-t border-border flex gap-2 items-end">
        <button
          onClick={() => setShowCanvas(true)}
          className="p-3 rounded-xl hover:bg-surface-hover transition-colors"
          aria-label="Draw answer"
        >
          <PenTool size={20} className="text-muted" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask the tutor..."
          className="flex-1 bg-surface rounded-xl px-4 py-3 text-sm outline-none placeholder:text-muted"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || chat.streaming}
          className="p-3 rounded-xl bg-accent text-bg disabled:opacity-40 transition-opacity"
          aria-label="Send"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
