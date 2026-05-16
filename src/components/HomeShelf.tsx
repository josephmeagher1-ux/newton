import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPdfs, savePdf, deletePdf, inferMetadataFromFilename, type StoredPdf } from '../storage/pdf-store';
import type { SourceType } from '../storage/db';
import { loadPdfDocument } from '../lib/pdf';
import { Settings as SettingsIcon, Terminal, Upload, Trash2, BookOpen, ClipboardList } from 'lucide-react';

interface PendingFile {
  file: File;
  inferred: ReturnType<typeof inferMetadataFromFilename>;
}

const TIER_BADGE: Record<1 | 2 | 3, { label: string; className: string }> = {
  1: { label: 'Current', className: 'bg-grade-green/20 text-grade-green' },
  2: { label: 'Standard', className: 'bg-accent/20 text-accent' },
  3: { label: 'Reference', className: 'bg-muted/20 text-muted' },
};

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: 'guideline', label: 'Guideline' },
  { value: 'handbook', label: 'Handbook' },
  { value: 'paper', label: 'Paper' },
  { value: 'notes', label: 'Notes' },
  { value: 'other', label: 'Other' },
];

export function HomeShelf() {
  const [pdfs, setPdfs] = useState<Omit<StoredPdf, 'blob'>[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    setPdfs(await listPdfs());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const queueFiles = (files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfs.length === 0) return;
    setPendingFiles(pdfs.map(file => ({ file, inferred: inferMetadataFromFilename(file.name) })));
  };

  const updatePending = (idx: number, patch: Partial<PendingFile['inferred']>) => {
    setPendingFiles(prev => prev.map((p, i) => i === idx ? { ...p, inferred: { ...p.inferred, ...patch } } : p));
  };

  const confirmUpload = async () => {
    setLoading(true);
    for (const pending of pendingFiles) {
      const doc = await loadPdfDocument(pending.file);
      await savePdf(pending.file, doc.numPages, pending.inferred);
      doc.destroy();
    }
    setPendingFiles([]);
    await refresh();
    setLoading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    queueFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deletePdf(id);
    await refresh();
  };

  const sortedPdfs = [...pdfs].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return (b.publicationYear ?? 0) - (a.publicationYear ?? 0);
  });

  return (
    <div
      className="flex-1 flex flex-col p-6 overflow-auto"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Newton</h1>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/scenario')}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
            aria-label="Compile Scenario"
            title="Compile Scenario"
          >
            <ClipboardList size={20} className="text-muted" />
          </button>
          <button
            onClick={() => navigate('/dev')}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
            aria-label="Dev Console"
          >
            <Terminal size={20} className="text-muted" />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
            aria-label="Settings"
          >
            <SettingsIcon size={20} className="text-muted" />
          </button>
        </div>
      </header>

      {pdfs.length === 0 && !dragging ? (
        <label className="flex-1 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:border-accent transition-colors">
          <Upload size={48} className="text-muted" />
          <p className="text-muted text-center">
            Drop a PDF here or tap to upload
          </p>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            multiple
            onChange={(e) => queueFiles(e.target.files)}
          />
        </label>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {sortedPdfs.map((pdf) => {
              const badge = TIER_BADGE[pdf.tier];
              return (
                <div
                  key={pdf.id}
                  onClick={() => navigate(`/pdf/${pdf.id}`)}
                  className="relative bg-surface rounded-xl p-4 cursor-pointer hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <BookOpen size={24} className="text-accent" />
                    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="font-medium text-sm line-clamp-2">{pdf.name}</p>
                  <p className="text-xs text-muted mt-1">
                    {pdf.pageCount} pp
                    {pdf.publicationYear ? ` · ${pdf.publicationYear}` : ''}
                    {pdf.authority ? ` · ${pdf.authority}` : ''}
                  </p>
                  <button
                    onClick={(e) => handleDelete(pdf.id, e)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-border transition-colors opacity-0 hover:opacity-100"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} className="text-muted" />
                  </button>
                </div>
              );
            })}
          </div>

          <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors">
            <Upload size={18} className="text-muted" />
            <span className="text-sm text-muted">Add source</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              multiple
              onChange={(e) => queueFiles(e.target.files)}
            />
          </label>
        </>
      )}

      {pendingFiles.length > 0 && (
        <div className="fixed inset-0 bg-bg/80 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-medium">Source metadata</h2>
            <p className="text-sm text-muted">Auto-filled from filename — adjust if needed.</p>

            {pendingFiles.map((pending, idx) => (
              <div key={idx} className="border border-border rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium truncate">{pending.file.name}</p>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted block">
                    Type
                    <select
                      value={pending.inferred.sourceType}
                      onChange={(e) => updatePending(idx, { sourceType: e.target.value as SourceType })}
                      className="mt-1 w-full bg-bg rounded-lg px-3 py-2 text-sm text-fg outline-none"
                    >
                      {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-muted block">
                    Year
                    <input
                      type="number"
                      value={pending.inferred.publicationYear ?? ''}
                      onChange={(e) => updatePending(idx, { publicationYear: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="2024"
                      className="mt-1 w-full bg-bg rounded-lg px-3 py-2 text-sm text-fg outline-none"
                    />
                  </label>
                </div>

                <label className="text-xs text-muted block">
                  Authority
                  <input
                    value={pending.inferred.authority ?? ''}
                    onChange={(e) => updatePending(idx, { authority: e.target.value || null })}
                    placeholder="NICE, BMJ, Oxford…"
                    className="mt-1 w-full bg-bg rounded-lg px-3 py-2 text-sm text-fg outline-none"
                  />
                </label>

                <label className="text-xs text-muted block">
                  Tier (1 = current guideline, 2 = standard handbook, 3 = older reference)
                  <select
                    value={pending.inferred.tier}
                    onChange={(e) => updatePending(idx, { tier: parseInt(e.target.value) as 1 | 2 | 3 })}
                    className="mt-1 w-full bg-bg rounded-lg px-3 py-2 text-sm text-fg outline-none"
                  >
                    <option value={1}>Tier 1 — Current authoritative</option>
                    <option value={2}>Tier 2 — Standard reference</option>
                    <option value={3}>Tier 3 — Older/auxiliary</option>
                  </select>
                </label>
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPendingFiles([])}
                className="flex-1 py-3 rounded-xl border border-border text-muted"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpload}
                className="flex-1 py-3 rounded-xl bg-accent text-bg font-medium"
              >
                Add {pendingFiles.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {dragging && (
        <div className="fixed inset-0 bg-bg/80 flex items-center justify-center z-50 pointer-events-none">
          <div className="border-2 border-accent border-dashed rounded-2xl p-12">
            <p className="text-accent text-lg">Drop PDF to upload</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-bg/60 flex items-center justify-center z-50">
          <p className="text-fg animate-pulse">Processing PDF...</p>
        </div>
      )}
    </div>
  );
}
