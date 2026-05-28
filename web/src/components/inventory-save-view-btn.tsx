"use client";

export function InventorySaveViewBtn() {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(window.location.href).catch(() => {});
      }}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition-colors"
      title="نسخ الرابط الحالي"
    >
      💾 حفظ كعرض
    </button>
  );
}
