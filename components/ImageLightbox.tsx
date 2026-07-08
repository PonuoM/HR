import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Image Lightbox (full-screen viewer with zoom) ──
const ImageLightbox: React.FC<{
  urls: string[];
  startIndex: number;
  onClose: () => void;
}> = ({ urls, startIndex, onClose }) => {
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // gesture refs
  const lastTap = useRef(0);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const resetZoom = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  const goTo = useCallback((next: number) => {
    if (next < 0 || next >= urls.length) return;
    setIndex(next);
    resetZoom();
  }, [urls.length, resetZoom]);

  // keyboard support (desktop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goTo(index - 1);
      else if (e.key === 'ArrowRight') goTo(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goTo, onClose]);

  const dist = (t: TouchList) => {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = { dist: dist(e.touches), scale };
      panStart.current = null;
      swipeStart.current = null;
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx, ty };
      } else {
        swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const next = Math.min(4, Math.max(1, pinchStart.current.scale * (dist(e.touches) / pinchStart.current.dist)));
      setScale(next);
      if (next === 1) { setTx(0); setTy(0); }
    } else if (e.touches.length === 1 && panStart.current && scale > 1) {
      setTx(panStart.current.tx + (e.touches[0].clientX - panStart.current.x));
      setTy(panStart.current.ty + (e.touches[0].clientY - panStart.current.y));
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    pinchStart.current = null;
    panStart.current = null;
    // swipe to change image (only when not zoomed)
    if (swipeStart.current && scale === 1) {
      const dx = e.changedTouches[0].clientX - swipeStart.current.x;
      const dy = e.changedTouches[0].clientY - swipeStart.current.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goTo(index + 1); else goTo(index - 1);
      }
    }
    swipeStart.current = null;
    // double-tap to zoom
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (scale > 1) resetZoom(); else setScale(2.5);
    }
    lastTap.current = now;
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center select-none"
      style={{ animation: 'lightboxFade 0.2s ease-out' }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent">
        {urls.length > 1 ? (
          <span className="text-white/90 text-sm font-medium">{index + 1} / {urls.length}</span>
        ) : <span />}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <span className="material-icons-round">close</span>
        </button>
      </div>

      {/* Image */}
      <img
        src={urls[index]}
        alt=""
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={(e) => { e.stopPropagation(); if (scale > 1) resetZoom(); else setScale(2.5); }}
        className="max-w-full max-h-full object-contain"
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          transition: pinchStart.current || panStart.current ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'none',
          cursor: scale > 1 ? 'grab' : 'zoom-in',
        }}
      />

      {/* Prev / Next (desktop / multi-image) */}
      {urls.length > 1 && (
        <>
          {index > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goTo(index - 1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 hidden md:flex items-center justify-center text-white transition-colors"
            >
              <span className="material-icons-round">chevron_left</span>
            </button>
          )}
          {index < urls.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goTo(index + 1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 hidden md:flex items-center justify-center text-white transition-colors"
            >
              <span className="material-icons-round">chevron_right</span>
            </button>
          )}
          {/* dots */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {urls.map((_, i) => (
              <span key={i} className={`rounded-full transition-all ${i === index ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageLightbox;
