"use client";

import { useRef, useState } from "react";
import { Building2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Branch = { id: string; name: string };

type Props = {
  isGeneralManager: boolean;
  branchId: string | null;
  branchName: string | null;
  branchObjects: Branch[];
};

type ImportResult = {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export function InventoryImportBtn({ isGeneralManager, branchId, branchName, branchObjects }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // مدير عام → يختار المعرض / مدير معرض → معرضه تلقائي
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branchId ?? "");
  const selectedBranch = isGeneralManager
    ? branchObjects.find((b) => b.id === selectedBranchId) ?? null
    : branchObjects.find((b) => b.id === branchId) ?? (branchName ? { id: branchId ?? "", name: branchName } : null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setImportError(null);
  }

  async function handleUpload() {
    if (!selectedBranch) {
      setImportError("يرجى اختيار المعرض أولاً.");
      return;
    }
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setImportError("يرجى اختيار ملف أولاً.");
      return;
    }

    setUploading(true);
    setResult(null);
    setImportError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("branch_id", selectedBranch.id);
      body.append("branch_name", selectedBranch.name);

      const res = await fetch("/api/inventory/import", { method: "POST", body });
      const json = await res.json() as ImportResult & { error?: string };

      if (!res.ok || json.error) {
        setImportError(json.error ?? "حدث خطأ أثناء المعالجة.");
        return;
      }

      setResult(json);
      if (json.added > 0 || json.updated > 0) router.refresh();
    } catch {
      setImportError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setImportError(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    setOpen(false);
    handleReset();
    if (isGeneralManager) setSelectedBranchId(branchId ?? "");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-400 shadow-sm transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-600"
        title="استيراد من Excel"
      >
        <FileSpreadsheet className="h-4 w-4" />
        استيراد Excel
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 shadow-2xl" dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                استيراد مخزون السيارات
              </h3>
              <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* ── اختيار المعرض ── */}
              {!result && (
                <div className={`rounded-xl border p-4 ${isGeneralManager ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className={`h-4 w-4 ${isGeneralManager ? "text-amber-600" : "text-emerald-600"}`} />
                    <span className={`text-sm font-bold ${isGeneralManager ? "text-amber-800" : "text-emerald-800"}`}>
                      {isGeneralManager ? "اختر المعرض الذي تريد الرفع إليه" : "المعرض المرتبط بحسابك"}
                    </span>
                  </div>

                  {isGeneralManager ? (
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="legacy-select w-full"
                    >
                      <option value="">— اختر المعرض —</option>
                      {branchObjects.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5">
                      <Building2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      <span className="font-bold text-emerald-900 text-sm">{selectedBranch?.name ?? "—"}</span>
                      <span className="text-xs text-emerald-600 mr-auto">سيُسجَّل تلقائياً كمالك السيارات</span>
                    </div>
                  )}

                  {selectedBranch && (
                    <p className="mt-2 text-xs text-slate-500">
                      ✅ جميع السيارات المرفوعة ستُسجَّل باسم: <strong>{selectedBranch.name}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* ── خطوات الاستخدام ── */}
              {!result && (
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-800 space-y-1.5">
                  <p className="font-bold text-sky-700">📋 آلية العمل:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>حمّل القالب الجاهز أدناه</li>
                    <li>أدخل بيانات السيارات في الورقة <strong>Data</strong></li>
                    <li>احفظ بصيغة <strong>.xlsx</strong> وارفعه هنا</li>
                  </ol>
                  <p className="text-xs text-sky-600 pt-1">
                    🔄 إذا كان الشاصي موجوداً سيتم <strong>تحديث</strong> السيارة تلقائياً<br />
                    📦 الحد الأقصى: 500 سيارة لكل ملف<br />
                    🏢 لا حاجة لكتابة اسم المعرض في الملف — يُملأ تلقائياً
                  </p>
                </div>
              )}

              {/* ── تحميل القالب ── */}
              {!result && (
                <a
                  href="/api/inventory/template"
                  download="inventory-template.xlsx"
                  className="flex items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-50 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  تحميل القالب الجاهز (inventory-template.xlsx)
                </a>
              )}

              {/* ── اختيار الملف ── */}
              {!result && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    اختر ملف Excel (.xlsx / .xls / .csv)
                  </label>
                  <div
                    className="flex items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 cursor-pointer hover:border-sky-400 hover:bg-sky-50 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-5 w-5 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-500 truncate">
                      {fileName ?? "انقر لاختيار الملف..."}
                    </span>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* ── رسالة خطأ ── */}
              {importError && (
                <div className="rounded-lg bg-rose-50 border border-rose-300 px-4 py-3 text-sm text-rose-700 font-semibold">
                  ⚠️ {importError}
                </div>
              )}

              {/* ── نتيجة الاستيراد ── */}
              {result && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 py-3">
                      <div className="text-2xl font-bold text-emerald-700">{result.added}</div>
                      <div className="text-xs text-emerald-600 mt-1">سيارة أُضيفت</div>
                    </div>
                    <div className="rounded-xl bg-sky-50 border border-sky-200 py-3">
                      <div className="text-2xl font-bold text-sky-700">{result.updated}</div>
                      <div className="text-xs text-sky-600 mt-1">سيارة حُدِّثت</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 py-3">
                      <div className="text-2xl font-bold text-amber-700">{result.skipped}</div>
                      <div className="text-xs text-amber-600 mt-1">صف تجاوز</div>
                    </div>
                  </div>

                  {selectedBranch && (
                    <p className="text-center text-sm text-slate-600">
                      🏢 المعرض: <strong>{selectedBranch.name}</strong>
                    </p>
                  )}

                  {result.errors.length > 0 && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                      <p className="text-sm font-bold text-rose-700 mb-2">أخطاء ({result.errors.length}):</p>
                      <ul className="space-y-1 text-xs text-rose-600 max-h-32 overflow-y-auto">
                        {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </div>
                  )}

                  <p className="text-center text-sm text-slate-500">
                    {result.added + result.updated > 0 ? "✅ تم تحديث المخزون بنجاح" : "⚠️ لم تتم إضافة أي سيارات"}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
              {result ? (
                <>
                  <button type="button" onClick={handleReset} className="legacy-btn legacy-btn-secondary">
                    استيراد ملف آخر
                  </button>
                  <button type="button" onClick={handleClose} className="legacy-btn legacy-btn-primary">
                    إغلاق
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={handleClose} className="legacy-btn legacy-btn-secondary">
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading || !fileName || (isGeneralManager && !selectedBranchId)}
                    className="legacy-btn legacy-btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {uploading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الاستيراد...</>
                      : <><Upload className="h-4 w-4" /> رفع واستيراد</>
                    }
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
