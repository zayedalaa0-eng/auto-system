"use client";

import { ChevronLeft, ChevronRight, ImageOff, Images, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Props = {
  photos: string[];
  files?: Array<{ url: string; fileName: string | null }>;
  carLabel?: string;
};

export function CarGalleryViewer({ photos, files = [], carLabel }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const validPhotos = photos.filter(Boolean);

  // ── حالة فارغة — لا توجد صور ──
  if (validPhotos.length === 0 && files.length === 0) {
    return (
      <div className="car-gallery">
        <div className="car-gallery__header">
          <Images className="h-4 w-4 text-sky-600" />
          <span className="car-gallery__title">مجلد الصور</span>
        </div>
        <div className="car-gallery__empty">
          <ImageOff className="h-8 w-8 text-slate-300" />
          <span className="car-gallery__empty-text">لا توجد صور مرفقة لهذه السيارة</span>
        </div>
      </div>
    );
  }

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + validPhotos.length) % validPhotos.length);
  }, [validPhotos.length]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % validPhotos.length);
  }, [validPhotos.length]);

  // keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") setLightboxOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, prev, next]);

  function openAt(index: number) {
    setActiveIndex(index);
    setLightboxOpen(true);
  }

  return (
    <>
      {/* ── معرض الصور المصغرة ── */}
      <div className="car-gallery">
        <div className="car-gallery__header">
          <Images className="h-4 w-4 text-sky-600" />
          <span className="car-gallery__title">
            مجلد الصور
            <span className="car-gallery__count">{validPhotos.length}</span>
          </span>
        </div>

        <div className="car-gallery__grid">
          {validPhotos.map((url, i) => (
            <button
              key={i}
              type="button"
              className="car-gallery__thumb"
              onClick={() => openAt(i)}
              aria-label={`عرض الصورة ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`صورة ${i + 1}${carLabel ? ` — ${carLabel}` : ""}`}
                className="car-gallery__thumb-img"
              />
              <span className="car-gallery__zoom-icon">
                <ZoomIn className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {files.length > 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-semibold text-slate-600 mb-2">ملفات مرفقة</div>
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <a
                key={`${file.url}-${i}`}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {file.fileName ?? `ملف ${i + 1}`}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── لايتبوكس ── */}
      {lightboxOpen ? (
        <div
          className="car-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="عارض الصور"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxOpen(false);
          }}
        >
          {/* إغلاق */}
          <button
            type="button"
            className="car-lightbox__close"
            onClick={() => setLightboxOpen(false)}
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>

          {/* عداد */}
          <div className="car-lightbox__counter">
            {activeIndex + 1} / {validPhotos.length}
            {carLabel ? <span className="car-lightbox__label">{carLabel}</span> : null}
          </div>

          {/* الصورة الرئيسية */}
          <div className="car-lightbox__stage">
            {validPhotos.length > 1 ? (
              <button
                type="button"
                className="car-lightbox__nav car-lightbox__nav--prev"
                onClick={prev}
                aria-label="السابق"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={validPhotos[activeIndex]}
              alt={`صورة ${activeIndex + 1}${carLabel ? ` — ${carLabel}` : ""}`}
              className="car-lightbox__img"
              draggable={false}
            />

            {validPhotos.length > 1 ? (
              <button
                type="button"
                className="car-lightbox__nav car-lightbox__nav--next"
                onClick={next}
                aria-label="التالي"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            ) : null}
          </div>

          {/* الشريط السفلي بالمصغرات */}
          {validPhotos.length > 1 ? (
            <div className="car-lightbox__strip">
              {validPhotos.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  className={`car-lightbox__strip-thumb${i === activeIndex ? " car-lightbox__strip-thumb--active" : ""}`}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`صورة ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="car-lightbox__strip-img" draggable={false} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
