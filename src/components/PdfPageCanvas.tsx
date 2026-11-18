import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type {
  Highlight,
  HighlightColor,
  HighlightRect,
  ReaderTheme,
} from '../types/zentra';

interface PdfPageCanvasProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  targetWidth: number;
  readerTheme: ReaderTheme;
  highlights: Highlight[];
  onPageMeasured?: (pageNum: number, hasSelectableText: boolean) => void;
  onTextSelected?: (pageNum: number, text: string, rects: HighlightRect[]) => void;
}

const HIGHLIGHT_FILL: Record<HighlightColor, string> = {
  amber: 'bg-amber-300/45 border-b-2 border-amber-500/70',
  sky: 'bg-sky-300/45 border-b-2 border-sky-500/70',
  sage: 'bg-emerald-300/45 border-b-2 border-emerald-500/70',
  rose: 'bg-rose-300/45 border-b-2 border-rose-500/70',
};

export const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  pdfDoc,
  pageNumber,
  targetWidth,
  readerTheme,
  highlights,
  onPageMeasured,
  onTextSelected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: targetWidth,
    height: Math.round(targetWidth * 1.414),
  });
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let textLayerInstance: pdfjsLib.TextLayer | null = null;

    async function renderPage() {
      setIsRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.max(0.4, targetWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);

        const cssW = Math.round(viewport.width);
        const cssH = Math.round(viewport.height);
        setDimensions({ width: cssW, height: cssH });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        renderTask = page.render({
          canvasContext: ctx,
          canvas,
          viewport,
          transform,
        });
        await renderTask.promise;
        if (cancelled) return;

        const textContent = await page.getTextContent();
        if (cancelled) return;

        onPageMeasured?.(pageNumber, textContent.items.length > 0);

        const textEl = textLayerRef.current;
        if (textEl) {
          textEl.innerHTML = '';
          textEl.style.setProperty('--scale-factor', String(scale));
          textEl.style.width = `${cssW}px`;
          textEl.style.height = `${cssH}px`;
          textLayerInstance = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textEl,
            viewport,
          });
          await textLayerInstance.render();
        }
      } catch {
        // Cancelled or interrupted render
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // Ignore
      }
      try {
        textLayerInstance?.cancel();
      } catch {
        // Ignore
      }
    };
  }, [pdfDoc, pageNumber, targetWidth]);

  const handleSelectionEnd = () => {
    if (!onTextSelected || !containerRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (!text) return;

    const range = sel.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) return;

    const clientRects = Array.from(range.getClientRects()).filter(
      (r) => r.width > 2 && r.height > 2
    );

    const normalized: HighlightRect[] = clientRects.map((r) => ({
      x: Math.max(0, Math.min(1, (r.left - containerRect.left) / containerRect.width)),
      y: Math.max(0, Math.min(1, (r.top - containerRect.top) / containerRect.height)),
      width: Math.max(0.01, Math.min(1, r.width / containerRect.width)),
      height: Math.max(0.01, Math.min(1, r.height / containerRect.height)),
    }));

    if (normalized.length > 0) {
      onTextSelected(pageNumber, text, normalized);
    }
  };

  const canvasFilter =
    readerTheme === 'sepia'
      ? 'sepia(0.28) brightness(0.97) contrast(0.98)'
      : readerTheme === 'dark'
        ? 'invert(0.88) hue-rotate(180deg) brightness(0.95)'
        : 'none';

  return (
    <div
      ref={containerRef}
      onMouseUp={handleSelectionEnd}
      onTouchEnd={handleSelectionEnd}
      style={{ width: dimensions.width, height: dimensions.height }}
      className="zentra-pdf-page relative bg-white shadow-md select-text overflow-hidden shrink-0"
      data-page-number={pageNumber}
    >
      <canvas
        ref={canvasRef}
        style={{ filter: canvasFilter }}
        className="block"
        aria-label={`PDF Page ${pageNumber}`}
      />

      {/* Saved Highlights anchored via normalized PDF page coordinates */}
      <div className="absolute inset-0 pointer-events-none z-[1]" aria-hidden="true">
        {highlights.map((hl) =>
          hl.rects.map((rect, idx) => (
            <div
              key={`${hl.id}_${idx}`}
              className={`absolute rounded-[2px] ${HIGHLIGHT_FILL[hl.color]}`}
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
              }}
            />
          ))
        )}
      </div>

      {/* Selectable PDF Text Layer */}
      <div ref={textLayerRef} className="textLayer" />

      {isRendering && (
        <div className="absolute inset-0 bg-slate-100/60 dark:bg-slate-900/50 animate-pulse pointer-events-none z-[3]" />
      )}
    </div>
  );
};
