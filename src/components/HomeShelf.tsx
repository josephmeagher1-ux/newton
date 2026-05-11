import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPdfs, savePdf, deletePdf, type StoredPdf } from '../storage/pdf-store';
import { loadPdfDocument } from '../lib/pdf';
import { Settings as SettingsIcon, Terminal, Upload, Trash2, BookOpen } from 'lucide-react';

export function HomeShelf() {
  const [pdfs, setPdfs] = useState<Omit<StoredPdf, 'blob'>[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    setPdfs(await listPdfs());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setLoading(true);
    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') continue;
      const doc = await loadPdfDocument(file);
      await savePdf(file, doc.numPages);
      doc.destroy();
    }
    await refresh();
    setLoading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deletePdf(id);
    await refresh();
  };

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
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {pdfs.map((pdf) => (
              <div
                key={pdf.id}
                onClick={() => navigate(`/pdf/${pdf.id}`)}
                className="relative bg-surface rounded-xl p-4 cursor-pointer hover:bg-surface-hover transition-colors"
              >
                <BookOpen size={24} className="text-accent mb-2" />
                <p className="font-medium text-sm line-clamp-2">{pdf.name}</p>
                <p className="text-xs text-muted mt-1">{pdf.pageCount} pages</p>
                <button
                  onClick={(e) => handleDelete(pdf.id, e)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-border transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 size={14} className="text-muted" />
                </button>
              </div>
            ))}
          </div>

          <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors">
            <Upload size={18} className="text-muted" />
            <span className="text-sm text-muted">Add textbook</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </>
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
