import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Payslip } from '../types';
import { useApi } from '../hooks/useApi';
import { getPayslips } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PdfPreview from '../components/PdfPreview';

const SEEN_KEY = 'hr_payslips_seen';

const getSeenIds = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch { return new Set(); }
};

const markSeen = (id: string): Set<string> => {
  const seen = getSeenIds();
  seen.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  return seen;
};

const PayslipScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [selectedSlip, setSelectedSlip] = useState<Payslip | null>(null);
  const [pdfPreviewDataUrl, setPdfPreviewDataUrl] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [seenIds, setSeenIds] = useState<Set<string>>(getSeenIds);
  const { data: rawPayslips, loading } = useApi(() => getPayslips(authUser?.id || ''), [authUser?.id]);

  // Map DB fields to frontend Payslip type
  const payslips: Payslip[] = (rawPayslips || []).map((p: any) => ({
    id: String(p.id),
    employeeId: p.employee_id,
    employeeName: p.employee_name,
    month: p.month,
    year: p.year,
    amount: p.amount,
    status: p.status,
    sentAt: p.sent_at,
    imageUrl: p.image_url,
  }));

  const handleSlipClick = useCallback((slip: Payslip) => {
    setSelectedSlip(slip);
    setPdfPreviewDataUrl(null);
    // Mark as seen in localStorage
    const updated = markSeen(slip.id);
    setSeenIds(new Set(updated));
  }, []);

  const openZoom = () => { setZoomLevel(1); setIsZoomed(true); };
  const closeZoom = () => setIsZoomed(false);
  const zoomIn = () => setZoomLevel((z) => Math.min(z + 0.5, 4));
  const zoomOut = () => setZoomLevel((z) => Math.max(z - 0.5, 1));

  const isNew = (slip: Payslip) => !seenIds.has(slip.id);

  const isPdf = (url: string) => /\.pdf($|\?)/i.test(url);

  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const [meta, base64] = dataUrl.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] || 'image/png';
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], filename, { type: mime });
  };

  const handleDownload = (slip: Payslip) => {
    const usingPngPreview = isPdf(slip.imageUrl) && pdfPreviewDataUrl;
    const a = document.createElement('a');
    a.href = usingPngPreview ? pdfPreviewDataUrl! : slip.imageUrl;
    a.download = `สลิปเงินเดือน_${slip.month}_${Number(slip.year) + 543}${usingPngPreview ? '.png' : ''}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShare = async (slip: Payslip) => {
    const usingPngPreview = isPdf(slip.imageUrl) && pdfPreviewDataUrl;
    const title = `สลิปเงินเดือน ${slip.month}`;

    if (usingPngPreview) {
      const file = dataUrlToFile(pdfPreviewDataUrl!, `payslip_${slip.month}_${slip.year}.png`);
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ title, files: [file] });
        } catch { /* user cancelled */ }
        return;
      }
    }

    const shareUrl = new URL(slip.imageUrl, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative">
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-100 dark:border-gray-800 pt-4 md:pt-4 sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">สลิปเงินเดือน</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        {/* Banner / Info */}
        <div className="bg-primary/10 rounded-2xl p-4 flex items-start gap-4 mb-6 border border-primary/20">
          <div className="p-2 bg-primary rounded-lg text-white">
            <span className="material-icons-round text-xl">lock</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary mb-1">เอกสารลับเฉพาะบุคคล</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">กรุณาเก็บรักษาข้อมูลนี้เป็นความลับ ห้ามเผยแพร่ต่อบุคคลภายนอก</p>
          </div>
        </div>

        {/* List grouped by year (Buddhist Era) */}
        {(() => {
          const grouped = payslips.reduce<Record<string, Payslip[]>>((acc, slip) => {
            const y = String(slip.year);
            if (!acc[y]) acc[y] = [];
            acc[y].push(slip);
            return acc;
          }, {});
          const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));
          return years.map((y) => (
            <div key={y}>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">ปี {Number(y) + 543}</h2>
              <div className="space-y-3 mb-6">
                {grouped[y].map((slip) => {
                  const slipIsNew = isNew(slip);
                  return (
                    <button
                      key={slip.id}
                      onClick={() => handleSlipClick(slip)}
                      className="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all group relative overflow-hidden"
                    >
                      {/* New Indicator */}
                      {slipIsNew && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-red-500 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg shadow-sm">ใหม่</div>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-600 shrink-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{slip.month}</span>
                          <span className="material-icons-round text-gray-400 text-lg">receipt</span>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900 dark:text-white text-base">เงินเดือน {slip.month}</p>
                          <p className="text-xs text-gray-500">ส่งเมื่อ: {new Date(slip.sentAt).toLocaleDateString('th-TH')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {slipIsNew ? (
                          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                        ) : (
                          <span className="material-icons-round text-green-500 text-lg">check_circle</span>
                        )}
                        <span className="material-icons-round text-gray-300 group-hover:text-primary transition-colors">chevron_right</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </main>

      {/* Image Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">สลิปเงินเดือน: {selectedSlip.month} {Number(selectedSlip.year) + 543}</h3>
                <p className="text-xs text-gray-500">{selectedSlip.employeeName}</p>
              </div>
              <button onClick={() => setSelectedSlip(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <span className="material-icons-round text-gray-500">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 p-4 flex items-center justify-center">
              <button onClick={openZoom} className="w-full cursor-zoom-in" aria-label="ขยายรูปสลิป">
                {isPdf(selectedSlip.imageUrl) ? (
                  <PdfPreview url={selectedSlip.imageUrl} className="w-full h-auto shadow-lg rounded" onRendered={setPdfPreviewDataUrl} />
                ) : (
                  <img src={selectedSlip.imageUrl} alt="Payslip" className="w-full h-auto shadow-lg rounded" />
                )}
              </button>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
              <button onClick={() => handleDownload(selectedSlip)} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <span className="material-icons-round text-lg">download</span>
                บันทึกไฟล์
              </button>
              <button onClick={() => handleShare(selectedSlip)} className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
                <span className="material-icons-round text-lg">share</span>
                แชร์
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Overlay */}
      {isZoomed && selectedSlip && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in">
          <div className="flex items-center justify-between p-3 bg-black/60 shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={zoomOut} disabled={zoomLevel <= 1} className="p-2 rounded-full bg-white/10 text-white disabled:opacity-30">
                <span className="material-icons-round">remove</span>
              </button>
              <span className="text-white text-sm font-semibold w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
              <button onClick={zoomIn} disabled={zoomLevel >= 4} className="p-2 rounded-full bg-white/10 text-white disabled:opacity-30">
                <span className="material-icons-round">add</span>
              </button>
            </div>
            <button onClick={closeZoom} className="p-2 rounded-full bg-white/10 text-white">
              <span className="material-icons-round">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto" onDoubleClick={() => setZoomLevel((z) => (z > 1 ? 1 : 2))}>
            {/* overflow-auto + justify-center clips unreachable scroll on one side once
                content overflows, so only center while it still fits (zoom === 1). */}
            <div className={`min-h-full flex p-2 ${zoomLevel > 1 ? 'items-start justify-start' : 'items-center justify-center'}`}>
              <img
                src={isPdf(selectedSlip.imageUrl) ? (pdfPreviewDataUrl || selectedSlip.imageUrl) : selectedSlip.imageUrl}
                alt="Payslip"
                style={{ width: `${zoomLevel * 100}%` }}
                className="max-w-none transition-[width] duration-150 select-none"
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayslipScreen;