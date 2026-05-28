"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ActionFeedbackModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  // ضروري لتفادي mismatch بين SSR و client
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const message = useMemo(() => {
    const notice = searchParams.get("notice");
    return notice ?? "";
  }, [searchParams]);

  // إعادة تعيين dismissed عند تغيير الرسالة
  useEffect(() => {
    if (message) setDismissed(false);
  }, [message]);

  if (!mounted || !message || dismissed) return null;

  const clearParams = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("notice");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const dismiss = () => {
    setDismissed(true);
    clearParams();
  };

  // createPortal → يُدرج مباشرة في document.body خارج أي stacking context
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/45 p-4"
      style={{ zIndex: 99999 }}
    >
      <div className="feedback-modal">
        <div className="feedback-modal__icon">✅</div>
        <div className="feedback-modal__title">تمت العملية بنجاح</div>
        <p className="feedback-modal__body">{decodeURIComponent(message)}</p>
        <div className="feedback-modal__actions">
          <button type="button" className="feedback-modal__btn feedback-modal__btn--secondary" onClick={dismiss}>
            إغلاق
          </button>
          <button type="button" className="feedback-modal__btn feedback-modal__btn--primary" onClick={dismiss}>
            إكمال
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
