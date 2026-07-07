import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Vite-specific import: resolves to a hashed URL for the worker asset.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Some servers (Apache without an .mjs MIME mapping, etc.) serve this file with
// an empty/wrong Content-Type. The worker is a real ES module (`export {...}`),
// so strict module-script MIME checking then rejects it outright. Fetching the
// code ourselves and wrapping it in a Blob with an explicit type sidesteps the
// server's header entirely.
let workerReady: Promise<void> | null = null;
function ensureWorker(): Promise<void> {
  if (!workerReady) {
    workerReady = fetch(pdfWorkerUrl)
      .then((res) => res.text())
      .then((code) => {
        const blob = new Blob([code], { type: 'text/javascript' });
        pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      })
      .catch(() => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      });
  }
  return workerReady;
}

interface PdfPreviewProps {
  url: string;
  className?: string;
  onRendered?: (dataUrl: string) => void;
}

// Renders the first page of a PDF onto a <canvas> so it behaves like a normal
// image (downloadable as PNG, no dependency on the device's native PDF viewer).
const PdfPreview: React.FC<PdfPreviewProps> = ({ url, className, onRendered }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);

    (async () => {
      try {
        await ensureWorker();
        if (cancelled) return;
        const pdf = await pdfjsLib.getDocument({ url }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!cancelled) onRendered?.(canvas.toDataURL('image/png'));
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className={`${className || ''} flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400`}>
        <span className="material-icons-round text-4xl">picture_as_pdf</span>
      </div>
    );
  }

  return <canvas ref={canvasRef} className={className} />;
};

export default PdfPreview;
