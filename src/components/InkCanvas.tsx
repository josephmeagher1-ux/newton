import { useRef, useEffect, useCallback } from 'react';
import { X, Check } from 'lucide-react';

interface Props {
  onSubmit: (png: Blob) => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
  pressure: number;
}

export function InkCanvas({ onSubmit, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 2;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getPoint = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;
    e.preventDefault();
    drawingRef.current = true;
    pointsRef.current = [getPoint(e)];
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;
    e.preventDefault();

    const point = getPoint(e);
    pointsRef.current.push(point);

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const points = pointsRef.current;

    if (points.length < 2) return;
    const prev = points[points.length - 2]!;
    const curr = points[points.length - 1]!;

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.strokeStyle = '#1a1714';
    ctx.lineWidth = Math.max(1, curr.pressure * 4);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;
    drawingRef.current = false;
    pointsRef.current = [];
  }, []);

  const handleSubmit = async () => {
    const canvas = canvasRef.current!;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png'),
    );
    onSubmit(blob);
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col">
      <div className="flex items-center justify-between p-4">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-surface-hover">
          <X size={24} />
        </button>
        <p className="text-sm text-muted">Write your answer</p>
        <button onClick={handleSubmit} className="p-2 rounded-lg bg-accent text-bg">
          <Check size={24} />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="flex-1 touch-none select-none"
        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
