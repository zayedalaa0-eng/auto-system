"use client";

import { useRef, useState } from "react";
import { Download, Phone, X, Share2 } from "lucide-react";
import html2canvas from "html2canvas";

type QuotationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  car: {
    id: string;
    label: string;
    price?: number | null;
  } | null;
  branchName?: string;
};

export function QuotationModal({ isOpen, onClose, customerName, car, branchName }: QuotationModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !car) return null;

  const parts = car.label.split(" — ");
  const model = parts[0] || "سيارة مميزة";
  const year = parts[1] || "";
  const condition = parts[2] || "";
  const color = parts[3] || "";

  async function downloadImage() {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await (html2canvas as any)(printRef.current, { scale: 2, useCORS: true });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `عرض-سعر-${customerName}-${model}.png`;
      link.click();
    } catch (error) {
      console.error("Export error:", error);
      alert("حدث خطأ أثناء تصدير الصورة");
    } finally {
      setIsExporting(false);
    }
  }

  async function shareViaWhatsApp() {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = await (html2canvas as any)(printRef.current, { scale: 2, useCORS: true });
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) return;
        const file = new File([blob], `عرض-سعر-${model}.png`, { type: "image/png" });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({
            title: "عرض سعر سيارة",
            text: `عرض سعر للعميل ${customerName} لسيارة ${model}`,
            files: [file],
          }).catch(console.error);
        } else {
          const text = encodeURIComponent(`مرحباً ${customerName}،\nنقدم لك عرض سعر لسيارة:\n*النوع:* ${model}\n${year ? `*الموديل:* ${year}\n` : ""}${car?.price ? `*السعر المقترح:* ${(car.price ?? 0).toLocaleString("en-US")} شيقل\n` : ""}\nنسعد بتواصلك معنا في ${branchName || "المعرض"}.`);
          window.open(`https://wa.me/?text=${text}`, "_blank");
        }
      }, "image/png");
    } catch (error) {
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-full w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold text-slate-800">إنشاء عرض سعر</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 bg-slate-50">
          <div ref={printRef} className="bg-white border rounded-xl overflow-hidden shadow-sm" style={{ direction: "rtl", fontFamily: "system-ui, sans-serif" }}>
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-center">
              <h1 className="text-2xl font-black text-white mb-1">{branchName || "معرض السيارات"}</h1>
              <div className="text-slate-300 text-sm">عرض سعر حصري</div>
            </div>
            
            <div className="p-6">
              <div className="mb-6 flex justify-between border-b pb-4">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">السيد / ة</div>
                  <div className="text-lg font-bold text-slate-800">{customerName}</div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">التاريخ</div>
                  <div className="text-sm font-semibold text-slate-700">{new Date().toLocaleDateString('ar-EG')}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-xs font-bold text-sky-500 uppercase tracking-wider mb-2">تفاصيل المركبة</div>
                <h2 className="text-2xl font-black text-slate-900 mb-4">{model}</h2>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                  {year && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">سنة الصنع</div>
                      <div className="font-semibold text-slate-800">{year}</div>
                    </div>
                  )}
                  {condition && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">الحالة</div>
                      <div className="font-semibold text-slate-800">{condition}</div>
                    </div>
                  )}
                  {color && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">اللون</div>
                      <div className="font-semibold text-slate-800">{color}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
                <div className="font-bold text-slate-500">إجمالي السعر</div>
                <div className="text-2xl font-black text-emerald-600" dir="ltr">
                  {car.price ? `${car.price.toLocaleString("en-US")} ₪` : "تواصل معنا"}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800 px-6 py-4 flex items-center justify-between text-slate-300">
              <div className="text-xs font-medium">نشكر لكم ثقتكم بنا!</div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Phone className="h-3.5 w-3.5" /> تواصل معنا
              </div>
            </div>
          </div>
        </div>

        <div className="border-t bg-white px-4 py-3 flex gap-2">
          <button 
            onClick={downloadImage} 
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
          >
            <Download className="h-4 w-4" /> تحميل كصورة
          </button>
          <button 
            onClick={shareViaWhatsApp} 
            disabled={isExporting}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#20bd5a] disabled:opacity-50 transition"
          >
            <Share2 className="h-4 w-4" /> مشاركة
          </button>
        </div>
      </div>
    </div>
  );
}
