"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CarFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileClock,
  FolderOpen,
  MessageSquareShare,
  Paperclip,
  Pencil,
  Phone,
  RotateCcw,
  Save,
  Send,
  Share2,
  X,
} from "lucide-react";

import { convertToSellOnBehalfAction, convertToTradeInAction, deleteCustomerAction, saveCustomerProfileAction, sendQuickReminderAction, updateCustomerBasicInfoAction } from "@/app/dashboard/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusPill } from "@/components/status-pill";
import { VoiceRecorder } from "@/components/voice-recorder";
import type { CustomerAttachmentItem, CustomerDetail, CustomerFormOptions } from "@/lib/data";
import { PALESTINE_CITIES, CAR_MAKES } from "@/lib/suggestions";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/format";
import { PAYMENT_METHODS, needsPaymentMethod } from "@/lib/payment";

/* ─── Constants ─────────────────────────────────────────────── */
// الحالات التي تستوجب اختيار سيارة من المخزون (للمشتري فقط)
const SALE_OR_RESERVE_STATUSES = ["تمت عملية البيع", "حجز"];
const CLOSED_CUSTOMER_STATUS_HINTS = [
  "تمت عملية البيع",
  "شراء من قبل المعرض",
  "رفض من قبل العميل",
  "رفض من قبل المعرض",
  "تراجع العميل عن الاستبدال",
  "سحب السيارة من البيع",
  "إغلاق الملف",
];

const ACTION_ICONS: Record<string, string> = {
  customer_created: "✨",
  customer_updated: "📝",
  status_updated: "🔄",
  manual_reminder_created: "🔔",
  trade_in_saved: "🚗",
  trade_in_archived: "📦",
  sell_inventory_created: "🏷️",
  customer_reactivated: "♻️",
};

/* ─── Helpers ────────────────────────────────────────────────── */

function buildWhatsAppHref(prefix: string | null, phone: string) {
  const p = (prefix ?? "").replace(/\D/g, "");
  const n = phone.replace(/\D/g, "");
  return `https://wa.me/${p}${n}`;
}

function translateLogAction(action: string) {
  const map: Record<string, string> = {
    customer_created: "إنشاء ملف جديد",
    customer_updated: "تحديث ملف العميل",
    status_updated: "تحديث الحالة",
    manual_reminder_created: "إضافة تذكير",
    trade_in_saved: "حفظ سيارة العميل",
    trade_in_archived: "إيقاف سيارة العميل",
    sell_inventory_created: "إدخال سيارة برسم البيع",
    customer_reactivated: "تفعيل عملية جديدة",
  };
  return map[action] ?? action;
}

function isImageAttachment(fileName: string | null) {
  const n = (fileName ?? "").toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp") || n.endsWith(".gif");
}

function getCategoryLabel(category: string | null) {
  if (category === "trade_photo") return "صور السيارة";
  if (category === "trade_inspection") return "الفحص";
  if (category === "trade_license") return "الرخصة";
  if (category === "trade_insurance") return "التأمين";
  if (category === "voice_note") return "تسجيل صوتي";
  return "ملفات أخرى";
}

function isVoiceAttachment(att: { file_category: string | null; mime_type?: string | null }) {
  return att.file_category === "voice_note" ||
    (att.mime_type?.startsWith("audio/") ?? false);
}

function groupAttachments(attachments: CustomerAttachmentItem[]) {
  const grouped: Record<string, CustomerAttachmentItem[]> = {
    trade_photo: [],
    trade_inspection: [],
    trade_license: [],
    trade_insurance: [],
    other: [],
  };
  for (const item of attachments) {
    // التسجيلات الصوتية تظهر في السجل التاريخي — لا تُعرض هنا
    if (item.file_category === "voice_note" || item.mime_type?.startsWith("audio/")) continue;
    const key = item.file_category ?? "other";
    if (grouped[key]) grouped[key].push(item);
    else grouped.other.push(item);
  }
  return grouped;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function classifyLogKind(action: string) {
  if (action === "status_updated") return "status";
  if (action.includes("reminder") || action.includes("follow")) return "followup";
  if (action.includes("trade") || action.includes("inventory")) return "car";
  return "general";
}

function computeCustomerDataQuality(args: {
  operationType: "buyer" | "buyer_tradein_pending" | "sell_on_behalf";
  requestedCar: string;
  hasTradeData: boolean;
  tradeModel: string | null | undefined;
  tradeChassis: string | null | undefined;
  tradeLicenseExpiry: string | null | undefined;
  imageCount: number;
}) {
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: "السيارة المطلوبة", ok: args.operationType === "sell_on_behalf" ? true : Boolean(args.requestedCar.trim()) },
    { label: "بيانات سيارة العميل", ok: args.operationType === "buyer" ? true : args.hasTradeData && Boolean((args.tradeModel ?? "").trim()) },
    { label: "رقم الشاصي", ok: args.operationType === "buyer" ? true : Boolean((args.tradeChassis ?? "").trim()) },
    { label: "تاريخ الرخصة", ok: args.operationType === "buyer" ? true : Boolean((args.tradeLicenseExpiry ?? "").trim()) },
    { label: "صور مرفقة", ok: args.operationType === "buyer" ? true : args.imageCount > 0 },
  ];
  const okCount = checks.filter((c) => c.ok).length;
  const percent = Math.round((okCount / checks.length) * 100);
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  return { percent, missing };
}

function getClosureReason(status: string | null | undefined) {
  const s = (status ?? "").trim();
  if (!s) return null;
  if (s.includes("تمت عملية البيع")) return s;
  if (s.includes("شراء من قبل المعرض")) return "شراء من قبل المعرض";
  if (s.includes("رفض من قبل المعرض")) return "رفض من قبل المعرض";
  if (s.includes("رفض من قبل العميل")) return "رفض من قبل العميل";
  if (s.includes("تراجع العميل عن الاستبدال")) return "تراجع العميل عن الاستبدال";
  if (s.includes("سحب السيارة من البيع")) return "سحب السيارة من البيع";
  if (s === "إغلاق الملف") return "إغلاق الملف";
  return null;
}

/* ─── TradeInEditor ──────────────────────────────────────────── */
function TradeInEditor({ primaryTrade }: { primaryTrade: CustomerDetail["tradeIns"][number] | null }) {
  return (
    <div className="profile-section__body" style={{ borderTop: "1px solid #f1f5f9" }}>
      <input type="hidden" name="trade_in_id" value={primaryTrade?.id ?? ""} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="legacy-field">
          <span className="legacy-field__label">نوع السيارة</span>
          <input name="trade_in_model" defaultValue={primaryTrade?.model ?? ""} className="legacy-input" placeholder="نوع السيارة" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">رقم الشاصي</span>
          <input name="trade_in_chassis" defaultValue={primaryTrade?.chassis_no ?? ""} className="legacy-input num-val" placeholder="رقم الشاصي" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">سعر التقييم</span>
          <input name="trade_in_price" defaultValue={primaryTrade?.price ?? undefined} type="number" className="legacy-input" placeholder="السعر" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">اللون</span>
          <input name="trade_in_color" defaultValue={primaryTrade?.color ?? ""} className="legacy-input" placeholder="اللون" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">سنة الموديل</span>
          <input name="trade_in_year" defaultValue={primaryTrade?.production_year ?? undefined} type="number" className="legacy-input" placeholder="السنة" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">العداد</span>
          <input name="trade_in_mileage" defaultValue={primaryTrade?.mileage ?? undefined} type="number" className="legacy-input" placeholder="العداد" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">المواصفات</span>
          <input name="trade_in_specs" defaultValue={primaryTrade?.specs ?? ""} className="legacy-input" placeholder="المواصفات" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">الفحص</span>
          <input name="trade_in_inspection" defaultValue={primaryTrade?.inspection ?? ""} className="legacy-input" placeholder="الفحص" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">ناقل الحركة</span>
          <select name="trade_in_gear" defaultValue={typeof primaryTrade?.metadata?.gear === "string" ? primaryTrade.metadata.gear : "اوتوماتيك"} className="legacy-select">
            <option value="اوتوماتيك">أوتوماتيك</option>
            <option value="يدوي">يدوي</option>
          </select>
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">نوع الوقود</span>
          <select name="trade_in_fuel" defaultValue={typeof primaryTrade?.metadata?.fuel === "string" ? primaryTrade.metadata.fuel : "بنزين"} className="legacy-select">
            <option value="بنزين">بنزين</option>
            <option value="ديزل">ديزل</option>
            <option value="هايبرد">هايبرد</option>
            <option value="كهربائية بالكامل">كهربائية بالكامل</option>
          </select>
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">تاريخ انتهاء الرخصة</span>
          <input name="trade_in_license_expiry" defaultValue={primaryTrade?.license_expiry ?? ""} type="date" className="legacy-input" />
        </label>
        <input name="trade_in_status" type="hidden" value={primaryTrade?.status ?? "استبدال (بانتظار التقييم)"} />
        <label className="legacy-field md:col-span-2">
          <span className="legacy-field__label">ملاحظات</span>
          <textarea name="trade_in_notes" defaultValue={primaryTrade?.notes ?? ""} rows={3} className="legacy-textarea" placeholder="ملاحظات..." />
        </label>
      </div>

      {/* File uploads */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-bold text-slate-500">مستندات سيارة العميل (اختياري) — حتى 20 ملف لكل خانة</p>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { name: "trade_files_photos", label: "📷 صور" },
            { name: "trade_files_inspection", label: "🔍 فحص" },
            { name: "trade_files_license", label: "📄 رخصة" },
            { name: "trade_files_insurance", label: "🛡️ تأمين" },
          ].map(({ name, label }) => (
            <label key={name} className="legacy-field">
              <span className="legacy-field__label">{label}</span>
              <input type="file" name={name} className="legacy-input" accept="image/*,.pdf,.doc,.docx" multiple />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Closed File Banner ────────────────────────────────────── */
function ClosedFileBanner({
  cycleIndex,
  showNewCycleForm,
  newCycleOpType,
  isSoldComplete,
  isPendingNewCycle,
  onOpenForm,
  onCancelForm,
  onChangeOpType,
  onSubmitNewCycle,
  onAllowEdit,
  compact = false,
}: {
  cycleIndex: number;
  showNewCycleForm: boolean;
  newCycleOpType: string;
  isSoldComplete: boolean;
  isPendingNewCycle: boolean;
  onOpenForm: () => void;
  onCancelForm: () => void;
  onChangeOpType: (v: string) => void;
  onSubmitNewCycle: () => void;
  onAllowEdit: () => void;
  compact?: boolean;
}) {
  const [editWarningStep, setEditWarningStep] = useState<"idle" | "confirm">("idle");

  if (!showNewCycleForm) {
    const bannerClass = compact
      ? "flex flex-col gap-2"
      : isSoldComplete
        ? "profile-notice profile-notice--sold"
        : "profile-notice profile-notice--warning";

    return (
      <div className={bannerClass}>
        {!compact && (
          <p className={`mb-2 font-bold ${isSoldComplete ? "text-rose-800" : "text-amber-800"}`}>
            {isSoldComplete
              ? "🔒 هذا الملف مغلق نهائياً — تمت عملية البيع"
              : `🔒 هذا الملف مغلق (الدورة #${cycleIndex}) — اختر أحد الخيارين:`}
          </p>
        )}

        {/* تحذير البيع المكتمل */}
        {isSoldComplete && !compact && (
          <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 font-medium">
            ⚠️ لا يمكن تعديل هذا الملف إلا في حالات استثنائية. أي تعديل سيُسجَّل في التاريخ.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onOpenForm} className="legacy-mini-btn legacy-mini-btn--primary">
            <RotateCcw className="h-4 w-4" /> فتح دورة جديدة
          </button>

          {/* زر التعديل — مع خطوة تأكيد إضافية للملفات المباعة */}
          {editWarningStep === "idle" ? (
            <button
              type="button"
              onClick={() => isSoldComplete ? setEditWarningStep("confirm") : onAllowEdit()}
              className={`legacy-mini-btn ${isSoldComplete ? "border-rose-300 text-rose-700 hover:bg-rose-50" : ""}`}
            >
              {isSoldComplete ? "⚠️ تعديل استثنائي" : "✏️ تعديل البيانات الموجودة"}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2">
              <span className="text-xs font-bold text-rose-700">
                ⚠️ تحذير: أنت على وشك تعديل ملف مباع. هل أنت متأكد؟
              </span>
              <button
                type="button"
                onClick={onAllowEdit}
                className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700"
              >
                نعم، تعديل
              </button>
              <button
                type="button"
                onClick={() => setEditWarningStep("idle")}
                className="legacy-mini-btn text-xs"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "profile-notice profile-notice--warning"}>
      {!compact && (
        <p className="mb-3 font-semibold text-amber-800">فتح دورة جديدة #{cycleIndex + 1}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={newCycleOpType}
          onChange={(e) => onChangeOpType(e.target.value)}
          className="legacy-select text-sm"
        >
          <option value="buyer">مشتري</option>
          <option value="buyer_tradein_pending">مشتري + استبدال</option>
          <option value="sell_on_behalf">بيع بالوكالة</option>
        </select>
        <button
          type="button"
          onClick={onSubmitNewCycle}
          disabled={isPendingNewCycle}
          className="legacy-mini-btn legacy-mini-btn--primary"
        >
          <RotateCcw className="h-4 w-4" />
          {isPendingNewCycle ? "جاري الفتح..." : `تأكيد فتح الدورة #${cycleIndex + 1}`}
        </button>
        <button type="button" onClick={onCancelForm} className="legacy-mini-btn">
          إلغاء
        </button>
      </div>
    </div>
  );
}

/* ─── WhatsApp Share Popup ───────────────────────────────────── */
function WhatsAppSharePopup({
  imageAttachments,
  customerName,
  tradeInModel,
  onClose,
}: {
  imageAttachments: CustomerAttachmentItem[];
  customerName?: string;
  tradeInModel?: string | null;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");

  function handleSend() {
    const lines: string[] = [];
    if (customerName) lines.push(`👤 العميل: ${customerName}`);
    if (tradeInModel) lines.push(`🚗 السيارة: ${tradeInModel}`);
    if (comment.trim()) lines.push(`\n💬 ${comment.trim()}`);
    if (imageAttachments.length > 0) {
      lines.push(`\n📷 الصور (${imageAttachments.length}):`);
      imageAttachments.forEach((att, i) => {
        lines.push(`${i + 1}. ${att.public_url ?? ""}`);
      });
    }
    const text = encodeURIComponent(lines.join("\n"));
    const cleanPhone = phone.replace(/\D/g, "");
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-green-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-bold text-green-700 text-sm">
          <Share2 className="h-4 w-4" />
          إرسال عبر واتساب
        </span>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {imageAttachments.length === 0 ? (
        <p className="text-xs text-slate-500 mb-3">لا توجد صور في المرفقات.</p>
      ) : (
        <p className="text-xs text-slate-500 mb-3">سيتم إرسال روابط {imageAttachments.length} صورة.</p>
      )}

      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">رقم الواتساب (اختياري)</label>
          <input
            type="tel"
            placeholder="مثال: 966501234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
            dir="ltr"
          />
          <p className="mt-0.5 text-xs text-slate-400">اتركه فارغاً لاختيار جهة الاتصال يدوياً</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">التعليق</label>
          <textarea
            rows={3}
            placeholder="أدخل التعليق هنا..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          className="w-full rounded-lg bg-green-500 px-3 py-2 text-sm font-bold text-white hover:bg-green-600 active:bg-green-700 flex items-center justify-center gap-2"
        >
          <Share2 className="h-4 w-4" />
          فتح واتساب
        </button>
      </div>
    </div>
  );
}

/* ─── Attachments Panel ──────────────────────────────────────── */
function AttachmentsPanel({
  attachmentCount,
  groupedAttachments,
  imageAttachments,
  fileAttachments,
  showAttachments,
  onToggle,
  openAlbumAt,
  standalone = false,
  customerName,
  tradeInModel,
}: {
  attachmentCount: number;
  groupedAttachments: ReturnType<typeof groupAttachments>;
  imageAttachments: CustomerAttachmentItem[];
  fileAttachments: CustomerAttachmentItem[];
  showAttachments: boolean;
  onToggle: () => void;
  openAlbumAt: (idx: number) => void;
  standalone?: boolean;
  customerName?: string;
  tradeInModel?: string | null;
}) {
  const [showWaPopup, setShowWaPopup] = useState(false);
  const waRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showWaPopup) return;
    function handleClick(e: MouseEvent) {
      if (waRef.current && !waRef.current.contains(e.target as Node)) {
        setShowWaPopup(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showWaPopup]);

  const inner = (
    <>
      <div className="profile-section__toggle-header">
        <button type="button" className="flex flex-1 items-center gap-2 text-start" onClick={onToggle}>
          <div className="profile-section__title">
            <FolderOpen className="h-4 w-4 text-amber-500" />
            المرفقات
            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold px-1.5">
              {attachmentCount}
            </span>
          </div>
          {showAttachments
            ? <ChevronUp className="profile-section__chevron h-4 w-4" />
            : <ChevronDown className="profile-section__chevron h-4 w-4" />
          }
        </button>
        {/* زر واتساب */}
        <div className="relative shrink-0" ref={waRef}>
          <button
            type="button"
            onClick={() => setShowWaPopup((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
            title="إرسال عبر واتساب"
          >
            <Share2 className="h-3.5 w-3.5" />
            واتساب
          </button>
          {showWaPopup ? (
            <WhatsAppSharePopup
              imageAttachments={imageAttachments}
              customerName={customerName}
              tradeInModel={tradeInModel}
              onClose={() => setShowWaPopup(false)}
            />
          ) : null}
        </div>
      </div>

      {showAttachments && attachmentCount > 0 && (
        <div className="profile-attachments">
          <div className="attachments-summary">
            {Object.entries(groupedAttachments).map(([key, items]) =>
              items.length > 0 ? (
                <span key={key} className="attachment-category-pill">
                  {getCategoryLabel(key)}
                  <span className="attachment-category-pill__count">{items.length}</span>
                </span>
              ) : null,
            )}
          </div>
          {imageAttachments.length > 0 && (
            <>
              <div className="attachments-thumb-grid">
                {imageAttachments.map((att, idx) => (
                  <button key={att.id} type="button" className="attachment-thumb-btn" onClick={() => openAlbumAt(idx)}>
                    <img src={att.public_url ?? ""} alt={att.file_name ?? "image"} className="attachment-thumb-img" />
                    <span className="attachment-thumb-name">{att.file_name ?? "صورة"}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="legacy-mini-btn legacy-mini-btn--primary" style={{ alignSelf: "flex-start" }} onClick={() => openAlbumAt(0)}>
                عرض الألبوم الكامل
              </button>
            </>
          )}
          {fileAttachments.length > 0 && (
            <div className="attachment-files-list">
              {fileAttachments.map((att) => (
                <a key={att.id} href={att.public_url ?? "#"} target="_blank" rel="noreferrer"
                  className={`attachment-file-link${att.public_url ? "" : " legacy-attachment-link--disabled"}`}
                >
                  <Paperclip className="h-4 w-4 flex-shrink-0" />
                  {getCategoryLabel(att.file_category)}: {att.file_name ?? "ملف"}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
      {showAttachments && attachmentCount === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">لا توجد مرفقات.</p>
      )}
    </>
  );

  if (standalone) {
    return <div className="profile-section">{inner}</div>;
  }
  // داخل بطاقة موجودة — نضيف فاصل علوي فقط
  return (
    <div style={{ borderTop: "1px solid #f1f5f9" }}>
      {inner}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export function CustomerProfileContent({
  customer,
  options,
  returnPath,
  initialOpenTradeEditor = false,
  compactTradeOnly = false,
  isManager = false,
}: {
  customer: CustomerDetail;
  options: CustomerFormOptions;
  returnPath?: string;
  initialOpenTradeEditor?: boolean;
  compactTradeOnly?: boolean;
  isManager?: boolean;
}) {
  type OperationTypeCode = "buyer" | "buyer_tradein_pending" | "sell_on_behalf";

  const [editCarsEnabled, setEditCarsEnabled] = useState(false);
  const [editTradeEnabled, setEditTradeEnabled] = useState(initialOpenTradeEditor);
  const [editOperationEnabled, setEditOperationEnabled] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(customer.status);
  const [showHistory, setShowHistory] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // تهيئة بالسيارة المرتبطة حالياً إن وُجدت (حتى لو كانت محجوزة وغير مدرجة في inventoryOptions)
  const initialLinkedInventoryId = typeof customer.metadata?.selected_inventory_id === "string"
    ? customer.metadata.selected_inventory_id
    : "";
  const [inventoryForStatus, setInventoryForStatus] = useState(initialLinkedInventoryId);
  // sell_on_behalf مع أكثر من سيارة: اختيار أي سيارة تنطبق عليها حالة الحجز/البيع
  const [selectedSellTradeId, setSelectedSellTradeId] = useState(customer.tradeIns[0]?.id ?? "");
  const [historyKindFilter, setHistoryKindFilter] = useState<"all" | "status" | "followup" | "car" | "general">("all");
  const [historyQuery, setHistoryQuery] = useState("");

  function markDirty() { setIsDirty(true); }
  const [showAlbum, setShowAlbum] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // ── مودال تأكيد الإجراءات الحرجة ──
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => void;
  }>(null);

  function requireConfirm(opts: NonNullable<typeof confirmAction>) {
    setConfirmAction(opts);
  }

  // ── مودال واتساب المعرض ──
  const [showWaModal, setShowWaModal] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [waSending, setWaSending] = useState(false);
  const [waResult, setWaResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const waTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Edit basic info modal ──
  const [showEditBasic, setShowEditBasic] = useState(false);
  const [editBasicName, setEditBasicName] = useState(customer.full_name ?? "");
  const [editBasicNickname, setEditBasicNickname] = useState(customer.nickname ?? "");
  const [editBasicPhone, setEditBasicPhone] = useState(customer.phone ?? "");
  const [editBasicAddress, setEditBasicAddress] = useState(customer.address ?? "");
  const [editBasicWaPrefix, setEditBasicWaPrefix] = useState(customer.whatsapp_prefix ?? "+970");
  const [editBasicError, setEditBasicError] = useState<string | null>(null);
  const [editBasicPending, startEditBasicTransition] = useTransition();

  const initialOperationType = (() => {
    const code = typeof customer.metadata?.operation_type_code === "string" ? customer.metadata.operation_type_code : "";
    if (code === "buyer" || code === "buyer_tradein_pending" || code === "sell_on_behalf") return code as OperationTypeCode;
    const label = (customer.operation_type ?? "").trim();
    if (label === "مشتري") return "buyer";
    if (label.includes("استبدال")) return "buyer_tradein_pending";
    if (label.includes("بيع بالوكالة")) return "sell_on_behalf";
    return "buyer";
  })();

  const [operationType, setOperationType] = useState<OperationTypeCode>(initialOperationType);
  const [detailUseInventory, setDetailUseInventory] = useState(true);
  const [detailUseCustomRequest, setDetailUseCustomRequest] = useState(false);
  const [detailInventoryToAdd, setDetailInventoryToAdd] = useState("");
  const [detailCustomType, setDetailCustomType] = useState("");
  const [detailCustomYear, setDetailCustomYear] = useState("");
  const [detailCustomNegotiation, setDetailCustomNegotiation] = useState("");
  const [countAsInteraction, setCountAsInteraction] = useState(true);
  const [detailNegotiations, setDetailNegotiations] = useState<Record<string, string>>({});
  const [detailUpdateNote, setDetailUpdateNote] = useState("");
  // تتبع ما إذا كان حقل التحديث يحتوي تسجيلاً صوتياً
  const [updateNoteHasVoice, setUpdateNoteHasVoice] = useState(false);
  const [detailSelectedCars, setDetailSelectedCars] = useState<Array<{ id: string; label: string }>>(() => {
    const requested = customer.requested_car ?? "";
    // تقسيم بـ "|" — لكل label نأخذ أول سيارة مطابقة فقط من المخزون
    const requestedLabels = requested.split("|").map((s) => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const result: Array<{ id: string; label: string }> = [];
    for (const label of requestedLabels) {
      if (seen.has(label)) continue; // تجاهل التكرار في حقل requested_car
      const match = options.inventoryOptions.find((item) => item.label === label);
      if (match) {
        result.push(match);
      } else {
        // label غير موجود في المخزون (طلب خاص أو سيارة محذوفة) — احتفظ به كـ id وهمي
        result.push({ id: `__custom__${label}`, label });
      }
      seen.add(label);
    }
    return result;
  });

  // السيارات الأصلية المحفوظة مسبقاً — التفاوض اختياري لها، إلزامي فقط للجديدة
  const [preExistingCarIds] = useState<Set<string>>(() => {
    const requested = customer.requested_car ?? "";
    const requestedLabels = requested.split("|").map((s) => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const ids = new Set<string>();
    for (const label of requestedLabels) {
      if (seen.has(label)) continue;
      seen.add(label);
      const match = options.inventoryOptions.find((item) => item.label === label);
      ids.add(match ? match.id : `__custom__${label}`);
    }
    return ids;
  });

  const primaryTrade = customer.tradeIns[0] ?? null;
  const logCount = customer.logs.length;
  const attachmentCount = customer.attachments.length;
  const groupedAttachments = useMemo(() => groupAttachments(customer.attachments), [customer.attachments]);
  const imageAttachments = useMemo(
    () => customer.attachments.filter((a) => a.public_url && isImageAttachment(a.file_name)),
    [customer.attachments],
  );
  const fileAttachments = useMemo(
    () => customer.attachments.filter((a) => !isVoiceAttachment(a) && (!a.public_url || !isImageAttachment(a.file_name))),
    [customer.attachments],
  );
  const voiceAttachments = useMemo(
    () => customer.attachments.filter((a) => isVoiceAttachment(a)),
    [customer.attachments],
  );

  // بيع بالوكالة → السيارة هي سيارة العميل، لا تحتاج اختيار من المخزون
  const needsInventoryChassis =
    operationType !== "sell_on_behalf" &&
    SALE_OR_RESERVE_STATUSES.some((s) => currentStatus.includes(s));
  const shouldShowReactivate =
    !customer.is_active ||
    CLOSED_CUSTOMER_STATUS_HINTS.some((hint) => (customer.status ?? "").includes(hint));
  // ملف مكتمل البيع — قفل كامل ويحتاج تحذير مزدوج للتعديل
  const isSoldComplete =
    !customer.is_active &&
    (customer.status ?? "").includes("تمت عملية البيع");
  // رقم الدورة من قاعدة البيانات مباشرة (أدق من عد logs)
  const cycleIndex = customer.cycle_number ?? 1;
  const router = useRouter();
  const [showNewCycleForm, setShowNewCycleForm] = useState(false);
  const [newCycleOpType, setNewCycleOpType] = useState("buyer");
  const [allowEditClosed, setAllowEditClosed] = useState(false);
  const [isPendingNewCycle, setIsPendingNewCycle] = useState(false);
  const [isPendingReminder, startReminderTransition] = useTransition();
  // نافذة معاينة الإشعار قبل الإرسال
  const [showNotifyModal,   setShowNotifyModal]   = useState(false);
  const [notifyMessage,     setNotifyMessage]     = useState("");
  const [notifySending,     setNotifySending]     = useState(false);
  const [notifyTarget,      setNotifyTarget]      = useState<"employee" | "manager">("employee");
  // accordion الدورات السابقة — Set من IDs المفتوحة
  const [openAncestorIds, setOpenAncestorIds] = useState<Set<string>>(new Set());

  function handleSubmitNewCycle() {
    if (isPendingNewCycle) return;
    setIsPendingNewCycle(true);
    // ننتقل لصفحة الويزارد مع بيانات العميل مسبقة التعبئة — بدلاً من استدعاء action مباشرة
    const params = new URLSearchParams({
      parent_id: customer.id,
      name: customer.full_name ?? "",
      phone: customer.phone ?? "",
      op_type: newCycleOpType,
    });
    if (customer.branch_id) params.set("branch_id", customer.branch_id);
    router.push(`/dashboard/customers/new?${params.toString()}`);
  }

  function handleSendReminder() {
    setNotifyTarget("employee");
    setNotifyMessage(
      `يرجى مراجعة ملف العميل ${customer.full_name} (${customer.phone}) — الحالة الحالية: ${currentStatus}`
    );
    setShowNotifyModal(true);
  }

  function handleNotifyManager() {
    setNotifyTarget("manager");
    setNotifyMessage(
      `يرجى مراجعة ملف العميل ${customer.full_name} (${customer.phone}) — الحالة الحالية: ${currentStatus}`
    );
    setShowNotifyModal(true);
  }

  function handleConfirmNotify() {
    if (!notifyMessage.trim()) return;
    setNotifySending(true);
    const fd = new FormData();
    if (notifyTarget === "manager") {
      // إشعار مدير الفرع
      fd.append("recipient_branch_id", customer.branch_id ?? "");
      fd.append("recipient_label", "مدير الفرع");
    } else {
      // إشعار الموظف المسؤول
      fd.append("recipient_user_id", customer.assigned_user_id ?? "");
      fd.append("recipient_branch_id", customer.branch_id ?? "");
      fd.append("recipient_label", customer.assigned_user_name ?? "الموظف المسؤول");
    }
    fd.append("title", `متابعة ملف: ${customer.full_name}`);
    fd.append("message", notifyMessage.trim());
    fd.append("redirect_to", returnPath ?? "/dashboard/management");
    startReminderTransition(async () => {
      try {
        await sendQuickReminderAction(fd);
      } catch (e: unknown) {
        const digest = (e as { digest?: string } | null)?.digest;
        if (digest && digest.startsWith("NEXT_REDIRECT")) return;
        console.error("[sendReminder] failed:", e);
      } finally {
        setNotifySending(false);
        setShowNotifyModal(false);
      }
    });
  }
  const closureReason = getClosureReason(customer.status);
  const imageCount = imageAttachments.length;
  const fileCount = fileAttachments.length;
  const linkedInventoryId = typeof customer.metadata?.selected_inventory_id === "string"
    ? customer.metadata.selected_inventory_id
    : null;
  const linkedInventoryChassis = typeof customer.metadata?.selected_inventory_chassis === "string"
    ? customer.metadata.selected_inventory_chassis
    : null;
  const latestStatusTransition = [...customer.logs]
    .reverse()
    .find((log) => log.action === "status_updated");
  const fallbackInventoryId = typeof customer.metadata?.selected_inventory_id === "string"
    ? customer.metadata.selected_inventory_id
    : "";
  const showTradeCard = operationType === "buyer_tradein_pending" || operationType === "sell_on_behalf";
  const showRequestedCarsCard = operationType === "buyer" || operationType === "buyer_tradein_pending";
  const isSaleOnBehalfFlow = Boolean(primaryTrade?.status?.includes("برسم البيع") || primaryTrade?.status?.includes("عرض سيارة"));

  useEffect(() => {
    if (operationType === "buyer") setEditTradeEnabled(false);
    if (operationType === "sell_on_behalf") setEditCarsEnabled(false);
  }, [operationType]);

  function handleOperationTypeChange(next: OperationTypeCode) {
    setOperationType(next);
    // تحديث الحالة الافتراضية بناءً على نوع العملية الجديد
    if (next === "buyer") {
      setCurrentStatus(options.statusesByType?.buyer?.[0] ?? "جديد");
      setEditTradeEnabled(false);
      return;
    }
    if (next === "buyer_tradein_pending") {
      setCurrentStatus(options.statusesByType?.buyer_tradein_pending?.[0] ?? "قيد المتابعة — بانتظار التقييم");
      setEditTradeEnabled(primaryTrade ? editTradeEnabled : true);
      setEditCarsEnabled(true);
      return;
    }
    if (next === "sell_on_behalf") {
      setCurrentStatus(options.statusesByType?.sell_on_behalf?.[0] ?? "عرض سيارة للبيع");
      setEditCarsEnabled(false);
      return;
    }
  }

  function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (compactTradeOnly) return;

    // ── التحقق من حقول التفاوض (إلزامي للسيارات الجديدة فقط) ──────
    const newlyAddedCars = detailSelectedCars.filter((item) => !preExistingCarIds.has(item.id));
    if (newlyAddedCars.length > 0) {
      const missing = newlyAddedCars.filter(
        (item) => !(detailNegotiations[item.id] ?? "").trim(),
      );
      if (missing.length > 0) {
        event.preventDefault();
        window.alert(
          `يرجى تعبئة حقل التفاوض للسيارات الجديدة التالية قبل الحفظ:\n${missing.map((c) => `• ${c.label}`).join("\n")}`,
        );
        return;
      }
    }

    // ── التحقق من اختيار سيارة/شاصي عند حالات البيع ────────────
    if (!needsInventoryChassis) {
      // ── تأكيد عند إتمام عملية البيع ──────────────────────────
      if (currentStatus.includes("تمت عملية البيع")) {
        event.preventDefault();
        const form = event.currentTarget;
        const dealInput = form.querySelector<HTMLInputElement>("[name='deal_value']");
        const dealVal = dealInput?.value ? `${Number(dealInput.value).toLocaleString("ar")} شيقل` : "غير محدد";
        requireConfirm({
          title: "إتمام عملية البيع",
          description: `سيتم تسجيل إتمام عملية البيع للعميل "${customer.full_name}"${dealInput?.value ? ` بقيمة ${dealVal}` : ""}. هذا الإجراء سيُغلق الملف نهائياً.`,
          confirmLabel: "تأكيد إتمام البيع",
          variant: "warning",
          onConfirm: () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: false })),
        });
      }
      return;
    }
    const selected = (inventoryForStatus || fallbackInventoryId).trim();
    if (!selected) {
      event.preventDefault();
      window.alert("هذه الحالة تحتاج اختيار سيارة/شاصي من المخزون قبل الحفظ.");
    } else if (currentStatus.includes("تمت عملية البيع")) {
      // ── تأكيد البيع مع سيارة مختارة ─────────────────────────
      event.preventDefault();
      const form = event.currentTarget;
      const dealInput = form.querySelector<HTMLInputElement>("[name='deal_value']");
      const dealVal = dealInput?.value ? `${Number(dealInput.value).toLocaleString("ar")} شيقل` : "غير محدد";
      requireConfirm({
        title: "إتمام عملية البيع",
        description: `سيتم تسجيل إتمام عملية البيع للعميل "${customer.full_name}"${dealInput?.value ? ` بقيمة ${dealVal}` : ""}. هذا الإجراء سيُغلق الملف نهائياً.`,
        confirmLabel: "تأكيد إتمام البيع",
        variant: "warning",
        onConfirm: () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: false })),
      });
    }
  }

  const filteredHistoryLogs = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return customer.logs.filter((log) => {
      if (historyKindFilter !== "all" && classifyLogKind(log.action) !== historyKindFilter) return false;
      if (!q) return true;
      const text = `${translateLogAction(log.action)} ${log.details ?? ""} ${log.actor_name ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [customer.logs, historyKindFilter, historyQuery]);
  const dataQuality = useMemo(
    () =>
      computeCustomerDataQuality({
        operationType,
        requestedCar: customer.requested_car || "",
        hasTradeData: Boolean(primaryTrade),
        tradeModel: primaryTrade?.model,
        tradeChassis: primaryTrade?.chassis_no,
        tradeLicenseExpiry: primaryTrade?.license_expiry,
        imageCount,
      }),
    [operationType, customer.requested_car, primaryTrade, imageCount],
  );

  const requestedCarFromDetails = [
    ...detailSelectedCars.map((item) => item.label),
    detailUseCustomRequest && detailCustomType.trim()
      ? detailCustomYear.trim()
        ? `(طلب خاص) ${detailCustomType.trim()} - موديل ${detailCustomYear.trim()}`
        : `(طلب خاص) ${detailCustomType.trim()}`
      : "",
  ].filter(Boolean).join(" | ");

  const hasRequestedCar = Boolean((requestedCarFromDetails || customer.requested_car || "").trim());

  const detailNegotiationSummary = [
    ...detailSelectedCars.map((item) => {
      const note = detailNegotiations[item.id]?.trim();
      return note ? `التفاوض لسيارة ${item.label}: ${note}` : "";
    }).filter(Boolean),
    detailUseCustomRequest && detailCustomType.trim() && detailCustomNegotiation.trim()
      ? `التفاوض للطلب الخاص (${detailCustomType.trim()}${detailCustomYear.trim() ? ` - موديل ${detailCustomYear.trim()}` : ""}): ${detailCustomNegotiation.trim()}`
      : "",
  ].filter(Boolean).join("\n");

  const composedNote = [detailUpdateNote.trim(), detailNegotiationSummary].filter(Boolean).join("\n\n");

  function addInventoryChoice() {
    if (!detailInventoryToAdd) return;
    const item = options.inventoryOptions.find((c) => c.id === detailInventoryToAdd);
    if (!item) return;
    setDetailSelectedCars((cur) => cur.some((e) => e.id === item.id) ? cur : [...cur, item]);
    setDetailInventoryToAdd("");
    markDirty();
  }

  function removeInventoryChoice(id: string) {
    setDetailSelectedCars((cur) => cur.filter((item) => item.id !== id));
    setDetailNegotiations((cur) => { const n = { ...cur }; delete n[id]; return n; });
    markDirty();
  }

  function openAlbumAt(index: number) { setActiveImageIndex(index); setShowAlbum(true); }
  function showNextImage() { setActiveImageIndex((p) => (p + 1) % imageAttachments.length); }
  function showPrevImage() { setActiveImageIndex((p) => (p - 1 + imageAttachments.length) % imageAttachments.length); }

  /* ── Compact mode (trade-only editing) ── */
  if (compactTradeOnly) {
    return (
      <form action={saveCustomerProfileAction} onSubmit={handleProfileSubmit}>
        <input type="hidden" name="customer_id" value={customer.id} />
        <input type="hidden" name="full_name" value={customer.full_name} />
        <input type="hidden" name="phone" value={customer.phone} />
        <input type="hidden" name="branch_id" value={customer.branch_id ?? ""} />
        <input type="hidden" name="assigned_user_id" value={customer.assigned_user_id ?? ""} />
        <input type="hidden" name="requested_car" value={customer.requested_car ?? ""} />
        <input type="hidden" name="status" value={currentStatus} />
        <input type="hidden" name="note" value="" />
        <input type="hidden" name="count_as_interaction" value="on" />
        {returnPath ? <input type="hidden" name="return_to" value={returnPath} /> : null}

        {/* compact header */}
        <div className="profile-header-card">
          <div className="profile-header-card__avatar">{getInitials(customer.full_name)}</div>
          <div className="profile-header-card__body">
            <div className="profile-header-card__top">
              <span className="profile-header-card__name">{customer.full_name}</span>
              <StatusPill value={customer.status} />
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${shouldShowReactivate ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                {shouldShowReactivate ? "دورة مغلقة" : "دورة نشطة"} #{cycleIndex}
              </span>
            </div>
            <div className="profile-header-card__meta">
              <span className="num-val">{customer.phone}</span>
            </div>
          </div>
        </div>

        <div className="profile-body">
          {shouldShowReactivate && !allowEditClosed && (
            <ClosedFileBanner
              cycleIndex={cycleIndex}
              showNewCycleForm={showNewCycleForm}
              newCycleOpType={newCycleOpType}
              isSoldComplete={isSoldComplete}
              isPendingNewCycle={isPendingNewCycle}
              onSubmitNewCycle={handleSubmitNewCycle}
              onOpenForm={() => setShowNewCycleForm(true)}
              onCancelForm={() => setShowNewCycleForm(false)}
              onChangeOpType={(v) => setNewCycleOpType(v)}
              onAllowEdit={() => {
                requireConfirm({
                  title: "تعديل استثنائي على ملف مغلق",
                  description: `ملف العميل "${customer.full_name}" مغلق نهائياً (تمت عملية البيع). التعديل على ملفات مغلقة إجراء استثنائي يُسجَّل في السجل.`,
                  confirmLabel: "فتح للتعديل",
                  variant: "danger",
                  onConfirm: () => { setAllowEditClosed(true); setShowNewCycleForm(false); },
                });
              }}
            />
          )}

          <div className="profile-section">
            <div className="profile-section__header">
              <div className="profile-section__title"><CarFront className="h-4 w-4 text-sky-500" /> سيارة العميل</div>
            </div>
            <TradeInEditor primaryTrade={primaryTrade} />
            <div className="profile-section__body" style={{ borderTop: "1px solid #f1f5f9" }}>
              <label className="legacy-field">
                <span className="legacy-field__label">تاريخ المراجعة / الحجز</span>
                <input type="date" name="next_follow_up_at" defaultValue={toDateTimeLocalValue(customer.next_follow_up_at).slice(0, 10)} className="legacy-input" />
              </label>
            </div>
          </div>
        </div>

        <div className="profile-sticky-footer">
          {returnPath && <Link href={returnPath} className="profile-footer-cancel">إغلاق</Link>}
          <button type="submit" className="profile-footer-save">
            <Save className="h-4 w-4" /> حفظ بيانات السيارة
          </button>
        </div>
      </form>
    );
  }

  /* ── Full profile view ── */
  return (
    <>
      <form action={saveCustomerProfileAction} onSubmit={handleProfileSubmit}>
        {/* ── Hidden inputs ── */}
        <input type="hidden" name="customer_id" value={customer.id} />
        <input type="hidden" name="full_name" value={customer.full_name} />
        <input type="hidden" name="phone" value={customer.phone} />
        <input type="hidden" name="branch_id" value={customer.branch_id ?? ""} />
        <input type="hidden" name="assigned_user_id" value={customer.assigned_user_id ?? ""} />
        <input type="hidden" name="operation_type" value={operationType} />
        <input type="hidden" name="note" value={composedNote} />
        {returnPath ? <input type="hidden" name="return_to" value={returnPath} /> : null}
        {isSoldComplete && allowEditClosed
          ? <input type="hidden" name="allow_exceptional_edit" value="true" />
          : null}

        {/* ══════════════════════════════════════
            CUSTOMER HEADER CARD
        ══════════════════════════════════════ */}
        <div className="profile-header-card">
          <div className="profile-header-card__avatar">{getInitials(customer.full_name)}</div>
          <div className="profile-header-card__body">
            <div className="profile-header-card__top">
              <span className="profile-header-card__name">{customer.full_name}</span>
              {customer.nickname && (
                <span className="profile-header-card__nickname">{customer.nickname}</span>
              )}
              <StatusPill value={customer.status} />
              <button
                type="button"
                title="تعديل البيانات الأساسية"
                onClick={() => {
                  setEditBasicName(customer.full_name ?? "");
                  setEditBasicNickname(customer.nickname ?? "");
                  setEditBasicPhone(customer.phone ?? "");
                  setEditBasicAddress(customer.address ?? "");
                  setEditBasicError(null);
                  setShowEditBasic(true);
                }}
                className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-slate-700 bg-transparent text-slate-400 transition hover:bg-slate-700 hover:text-white flex-shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="profile-header-card__meta">
              <span className="num-val">{customer.phone}</span>
              {customer.address && <><span className="sep">·</span><span>{customer.address}</span></>}
              {customer.branch_name && <><span className="sep">·</span><span>{customer.branch_name}</span></>}
              {customer.assigned_user_name && <><span className="sep">·</span><span>{customer.assigned_user_name}</span></>}
            </div>

            <div className="profile-header-card__stats">
              <span>تفاعلات: <strong>{customer.visit_count ?? logCount}</strong></span>
              <span>·</span>
              <span>مرفقات: <strong>{imageCount}</strong> صور | <strong>{fileCount}</strong> ملفات</span>
              {customer.last_contact_at && (
                <><span>·</span><span>آخر تواصل: {formatDate(customer.last_contact_at)}</span></>
              )}
              {customer.next_follow_up_at && (
                <span className="follow-up-chip">📅 {formatDate(customer.next_follow_up_at)}</span>
              )}
            </div>
            {shouldShowReactivate && closureReason ? (
              <div className="mt-2 inline-flex w-fit items-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                سبب الإغلاق: {closureReason}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 mt-1">
              {/* زر واتساب شخصي — يفتح المحادثة على هاتف الموظف */}
              <a
                href={buildWhatsAppHref(customer.whatsapp_prefix, customer.phone)}
                target="_blank"
                rel="noreferrer"
                className="profile-whatsapp-btn"
              >
                <Phone className="h-4 w-4" /> واتساب شخصي
              </a>

              {/* زر واتساب المعرض — يرسل عبر API من رقم المعرض الرسمي */}
              <button
                type="button"
                onClick={() => {
                  const branch = options.branches.find((b) => b.id === customer.branch_id);
                  setWaMessage(`السلام عليكم ${customer.full_name}،\nنتواصل معك من ${branch?.name ?? "المعرض"}.\n`);
                  setWaResult(null);
                  setShowWaModal(true);
                  setTimeout(() => waTextareaRef.current?.focus(), 100);
                }}
                className="profile-whatsapp-btn"
                style={{ background: "linear-gradient(135deg,#1da462,#128c7e)", color: "#fff" }}
              >
                <Phone className="h-4 w-4" /> واتساب المعرض
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            BODY — scrollable sections
        ══════════════════════════════════════ */}
        <div className="profile-body">

          {/* ── السجل التاريخي (timeline) ── */}
          <div className="profile-section">
            <button
              type="button"
              className="profile-section__toggle-header"
              onClick={() => setShowHistory((h) => !h)}
            >
              <div className="profile-section__title">
                <FileClock className="h-4 w-4 text-sky-500" />
                السجل التاريخي
                <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold px-1.5">
                  {logCount}
                </span>
              </div>
              {showHistory
                ? <ChevronUp className="profile-section__chevron h-4 w-4" />
                : <ChevronDown className="profile-section__chevron h-4 w-4" />
              }
            </button>

            {latestStatusTransition ? (
              <div className="px-4 pb-3">
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                  <strong>آخر انتقال حالة:</strong> {latestStatusTransition.details ?? "تم تحديث الحالة"}
                  <span className="mx-2">·</span>
                  <strong>بواسطة:</strong> {latestStatusTransition.actor_name ?? "النظام"}
                  <span className="mx-2">·</span>
                  <strong>التاريخ:</strong> {formatDate(latestStatusTransition.created_at)}
                </div>
              </div>
            ) : null}

            {showHistory && (
              <div className="profile-timeline">
                <div className="mb-3 grid gap-2 md:grid-cols-[180px_1fr_auto]">
                  <select
                    className="legacy-select"
                    value={historyKindFilter}
                    onChange={(e) => setHistoryKindFilter(e.target.value as "all" | "status" | "followup" | "car" | "general")}
                  >
                    <option value="all">كل الأحداث</option>
                    <option value="status">الحالات</option>
                    <option value="followup">المتابعات</option>
                    <option value="car">السيارة/المخزون</option>
                    <option value="general">عام</option>
                  </select>
                  <input
                    className="legacy-input"
                    placeholder="ابحث في السجل التاريخي..."
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                  />
                  <div className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                    {filteredHistoryLogs.length} نتيجة
                  </div>
                </div>
                {filteredHistoryLogs.length > 0 ? (() => {
                  // ── ربط كل تسجيل بالحدث الأقرب إليه زمنياً (مرة واحدة فقط) ──
                  const voiceByLogId = new Map<string, typeof voiceAttachments>();
                  for (const att of voiceAttachments) {
                    const attMs = new Date(att.created_at).getTime();
                    let closestLogId: string | null = null;
                    let minDiff = Infinity;
                    for (const log of filteredHistoryLogs) {
                      const diff = Math.abs(new Date(log.created_at).getTime() - attMs);
                      if (diff < minDiff) { minDiff = diff; closestLogId = log.id; }
                    }
                    // نربط فقط إذا كان الفرق أقل من 10 دقائق
                    if (closestLogId && minDiff <= 10 * 60 * 1000) {
                      const existing = voiceByLogId.get(closestLogId) ?? [];
                      voiceByLogId.set(closestLogId, [...existing, att]);
                    }
                  }

                  return filteredHistoryLogs.map((log) => {
                    const relatedVoice = voiceByLogId.get(log.id) ?? [];

                    return (
                      <div key={log.id} className="profile-timeline__entry">
                        <div className="profile-timeline__icon">{ACTION_ICONS[log.action] ?? "📌"}</div>
                        <div className="profile-timeline__content">
                          <div className="profile-timeline__head">
                            <span className="profile-timeline__action">{translateLogAction(log.action)}</span>
                            <span className="profile-timeline__date">{formatDate(log.created_at)}</span>
                          </div>
                          {log.details && <div className="profile-timeline__body">{log.details}</div>}

                          {/* ── التسجيلات الصوتية المرتبطة ── */}
                          {relatedVoice.length > 0 && (
                            <div className="mt-2 flex flex-col gap-2">
                              {relatedVoice.map((att) => {
                                const isRawName = !att.file_name || att.file_name.startsWith("voice-note-");
                                const displayLabel = isRawName ? "تسجيل صوتي" : att.file_name!;
                                const isNegotiation = displayLabel.includes("تفاوض");
                                return (
                                  <div
                                    key={att.id}
                                    className={`rounded-lg border px-3 py-2 ${
                                      isNegotiation
                                        ? "border-amber-200 bg-amber-50"
                                        : "border-sky-200 bg-sky-50"
                                    }`}
                                  >
                                    <div className="mb-1 flex items-center gap-1.5">
                                      <span className={`text-xs font-bold ${isNegotiation ? "text-amber-800" : "text-sky-800"}`}>
                                        {isNegotiation ? "🚗" : "🎤"} {displayLabel}
                                      </span>
                                    </div>
                                    {att.public_url
                                      ? <audio controls src={att.public_url} className="w-full h-8" style={{ maxWidth: 380 }} />
                                      : <span className="text-xs text-rose-500">⚠️ رابط التشغيل غير متاح</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })() : (
                  <p className="text-sm text-slate-400 text-center py-3">لا توجد نتائج مطابقة في السجل.</p>
                )}

                {/* ── الدورات السابقة — accordion ── */}
                {customer.ancestor_cycles.length > 0 && (
                  <div className="ancestor-cycles-section">
                    <div className="ancestor-cycles-section__label">
                      📚 الدورات السابقة ({customer.ancestor_cycles.length})
                    </div>
                    {customer.ancestor_cycles.map((cycle) => {
                      const isOpen = openAncestorIds.has(cycle.id);
                      return (
                        <div key={cycle.id} className="ancestor-cycle-block">
                          <button
                            type="button"
                            className="ancestor-cycle-block__header"
                            onClick={() =>
                              setOpenAncestorIds((prev) => {
                                const next = new Set(prev);
                                isOpen ? next.delete(cycle.id) : next.add(cycle.id);
                                return next;
                              })
                            }
                          >
                            <span className="ancestor-cycle-block__badge">
                              الدورة #{cycle.cycle_number}
                            </span>
                            <span className="ancestor-cycle-block__status">{cycle.status}</span>
                            <span className="ancestor-cycle-block__count">
                              {cycle.logs.length} حدث
                            </span>
                            <span className="ancestor-cycle-block__chevron">
                              {isOpen ? "▲" : "▼"}
                            </span>
                          </button>

                          {isOpen && (
                            <div className="ancestor-cycle-block__body">
                              {cycle.logs.length > 0 ? (
                                cycle.logs.map((log) => (
                                  <div key={log.id} className="profile-timeline__entry profile-timeline__entry--ancestor">
                                    <div className="profile-timeline__icon">{ACTION_ICONS[log.action] ?? "📌"}</div>
                                    <div className="profile-timeline__content">
                                      <div className="profile-timeline__head">
                                        <span className="profile-timeline__action">{translateLogAction(log.action)}</span>
                                        <span className="profile-timeline__date">{formatDate(log.created_at)}</span>
                                      </div>
                                      {log.details && <div className="profile-timeline__body">{log.details}</div>}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-slate-400 text-center py-2">لا توجد سجلات لهذه الدورة.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── نوع العملية + ربط المخزون ── (مخفي أثناء فتح دورة جديدة) */}
          {!showNewCycleForm && (
          <>
          <div className="profile-section">
            <div className="profile-section__header">
              <div className="profile-section__title">🔄 نوع العملية
                <span className="text-sm font-normal text-slate-500 mr-2">
                  {operationType === "buyer" ? "مشتري" : operationType === "buyer_tradein_pending" ? "مشتري + استبدال" : "بيع بالوكالة"}
                </span>
              </div>
              {/* بيع بالوكالة → نوع العملية مقفل ولا يمكن تعديله */}
              {operationType !== "sell_on_behalf" && (
                <label className="legacy-checkline legacy-checkline--card">
                  <input
                    type="checkbox"
                    checked={editOperationEnabled}
                    onChange={(e) => setEditOperationEnabled(e.target.checked)}
                  />
                  <span>{editOperationEnabled ? "إغلاق التعديل" : "تعديل"}</span>
                </label>
              )}
              {operationType === "sell_on_behalf" && (
                <span className="text-xs text-slate-400 italic">مقفل — بيع بالوكالة</span>
              )}
            </div>
            {editOperationEnabled && operationType !== "sell_on_behalf" && (
            <div className="profile-section__body">
              <select
                className="legacy-select"
                value={operationType}
                onChange={(e) => handleOperationTypeChange(e.target.value as OperationTypeCode)}
              >
                <option value="buyer">مشتري</option>
                <option value="buyer_tradein_pending">مشتري + استبدال</option>
                {/* بيع بالوكالة لا يظهر كخيار للتعديل */}
              </select>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">اكتمال البيانات</span>
                  <span className={`font-extrabold ${dataQuality.percent >= 80 ? "text-emerald-600" : dataQuality.percent >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                    {dataQuality.percent}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${dataQuality.percent >= 80 ? "bg-emerald-500" : dataQuality.percent >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${dataQuality.percent}%` }}
                  />
                </div>
                {dataQuality.missing.length > 0 ? (
                  <div className="mt-2 text-xs font-semibold text-rose-700">
                    النواقص: {dataQuality.missing.join("، ")}
                  </div>
                ) : (
                  <div className="mt-2 text-xs font-semibold text-emerald-700">البيانات مكتملة لهذه العملية.</div>
                )}
              </div>
            </div>
            )}
          </div>

          {(linkedInventoryId || linkedInventoryChassis) ? (
            <div className="profile-section">
              <div className="profile-section__header">
                <div className="profile-section__title">
                  <CarFront className="h-4 w-4 text-indigo-500" /> ربط المخزون
                </div>
              </div>
              <div className="profile-section__body">
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="text-sm text-slate-700">
                    <div><strong>رقم المخزون:</strong> <span className="num-val">{linkedInventoryId ?? "—"}</span></div>
                    <div><strong>الشاصي:</strong> <span className="num-val">{linkedInventoryChassis ?? "—"}</span></div>
                  </div>
                  {linkedInventoryId ? (
                    <Link href={`/dashboard/inventory?car=${linkedInventoryId}`} className="legacy-mini-btn legacy-mini-btn--primary">
                      فتح بطاقة السيارة
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          </>
          )}

          {/* ── تنبيه ملف مغلق ── */}
          {shouldShowReactivate && !allowEditClosed && (
            <ClosedFileBanner
              cycleIndex={cycleIndex}
              showNewCycleForm={showNewCycleForm}
              newCycleOpType={newCycleOpType}
              isSoldComplete={isSoldComplete}
              isPendingNewCycle={isPendingNewCycle}
              onSubmitNewCycle={handleSubmitNewCycle}
              onOpenForm={() => setShowNewCycleForm(true)}
              onCancelForm={() => setShowNewCycleForm(false)}
              onChangeOpType={(v) => setNewCycleOpType(v)}
              onAllowEdit={() => {
                requireConfirm({
                  title: "تعديل استثنائي على ملف مغلق",
                  description: `ملف العميل "${customer.full_name}" مغلق نهائياً (تمت عملية البيع). التعديل على ملفات مغلقة إجراء استثنائي يُسجَّل في السجل.`,
                  confirmLabel: "فتح للتعديل",
                  variant: "danger",
                  onConfirm: () => { setAllowEditClosed(true); setShowNewCycleForm(false); },
                });
              }}
            />
          )}

          {/* ── سيارة العميل ── (مخفي أثناء فتح دورة جديدة) */}
          {!showNewCycleForm && showTradeCard ? (
            <div className="profile-section">
              <div className="profile-section__header">
                <div className="profile-section__title">
                  <CarFront className="h-4 w-4 text-sky-500" /> سيارة العميل
                </div>
                <label className="legacy-checkline legacy-checkline--card">
                  <input
                    type="checkbox"
                    name="has_trade_in"
                    checked={editTradeEnabled}
                    onChange={(e) => setEditTradeEnabled(e.target.checked)}
                  />
                  <span>{editTradeEnabled ? "إغلاق التعديل" : "تعديل"}</span>
                </label>
              </div>

              {primaryTrade ? (
                <div className="trade-info-grid">
                  {[
                    { label: "النوع", value: primaryTrade.model },
                    { label: "السعر", value: formatCurrency(primaryTrade.price) },
                    { label: "الشاصي", value: primaryTrade.chassis_no, ltr: true },
                    { label: "اللون", value: primaryTrade.color },
                    { label: "السنة", value: primaryTrade.production_year?.toString() },
                    { label: "العداد", value: primaryTrade.mileage ? `${primaryTrade.mileage.toLocaleString("en-US")} كم` : null },
                    { label: "الرخصة", value: primaryTrade.license_expiry },
                    {
                      label: "الوقود / الجير",
                      value: [
                        typeof primaryTrade.metadata?.fuel === "string" ? primaryTrade.metadata.fuel : null,
                        typeof primaryTrade.metadata?.gear === "string" ? primaryTrade.metadata.gear : null,
                      ].filter(Boolean).join(" / ") || null,
                    },
                  ].map(({ label, value, ltr }) => (
                    <div key={label} className="trade-info-grid__item">
                      <span className="trade-info-grid__label">{label}</span>
                      <span className={`trade-info-grid__value${!value ? " trade-info-grid__value--empty" : ""}${ltr ? " num-val" : ""}`}>
                        {value ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="profile-section__body">
                  <p className="text-sm text-slate-400 text-center py-2">لا توجد سيارة عميل مرتبطة بهذا الملف.</p>
                </div>
              )}

              {shouldShowReactivate && !allowEditClosed && (
                <div className="profile-section__body" style={{ borderTop: "1px solid #f1f5f9" }}>
                  <ClosedFileBanner
                    cycleIndex={cycleIndex}
                    showNewCycleForm={showNewCycleForm}
                    newCycleOpType={newCycleOpType}
                          onOpenForm={() => setShowNewCycleForm(true)}
                    onCancelForm={() => setShowNewCycleForm(false)}
                    onChangeOpType={(v) => setNewCycleOpType(v)}
                          isSoldComplete={isSoldComplete}
              isPendingNewCycle={isPendingNewCycle}
              onSubmitNewCycle={handleSubmitNewCycle}
                    onAllowEdit={() => {
                requireConfirm({
                  title: "تعديل استثنائي على ملف مغلق",
                  description: `ملف العميل "${customer.full_name}" مغلق نهائياً (تمت عملية البيع). التعديل على ملفات مغلقة إجراء استثنائي يُسجَّل في السجل.`,
                  confirmLabel: "فتح للتعديل",
                  variant: "danger",
                  onConfirm: () => { setAllowEditClosed(true); setShowNewCycleForm(false); },
                });
              }}
                    compact
                  />
                </div>
              )}

              {editTradeEnabled
                ? <TradeInEditor primaryTrade={primaryTrade} />
                : <input type="hidden" name="trade_in_id" value={primaryTrade?.id ?? ""} />
              }

              {/* ── مرفقات سيارة العميل — داخل البطاقة ── */}
              <AttachmentsPanel
                attachmentCount={attachmentCount}
                groupedAttachments={groupedAttachments}
                imageAttachments={imageAttachments}
                fileAttachments={fileAttachments}
                showAttachments={showAttachments}
                onToggle={() => setShowAttachments((a) => !a)}
                openAlbumAt={openAlbumAt}
                customerName={customer.full_name}
                tradeInModel={primaryTrade?.model ?? null}
              />
            </div>
          ) : (
            <>
              <input type="hidden" name="has_trade_in" value="" />
              <input type="hidden" name="trade_in_id" value={primaryTrade?.id ?? ""} />
            </>
          )}

          {/* مجلد المرفقات لا يظهر للمشتري (buyer) — فقط داخل كرت سيارة العميل */}

          {/* ── السيارات المطلوبة ── (مخفي أثناء فتح دورة جديدة) */}
          {!showNewCycleForm && showRequestedCarsCard ? (
            <div className="profile-section">
              <div className="profile-section__header">
                <div className="profile-section__title">
                  <CarFront className="h-4 w-4 text-emerald-500" /> السيارات المطلوبة
                </div>
                <label className="legacy-checkline legacy-checkline--card">
                  <input
                    type="checkbox"
                    checked={editCarsEnabled}
                    onChange={(e) => setEditCarsEnabled(e.target.checked)}
                  />
                  <span>{editCarsEnabled ? "إغلاق التعديل" : "تعديل"}</span>
                </label>
              </div>

              {/* Current cars display — في وضع التعديل تُعرض كأزرار قابلة للحذف */}
              <div className="requested-cars-display">
                {editCarsEnabled && detailSelectedCars.length > 0 ? (
                  detailSelectedCars.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="requested-car-tag requested-car-tag--removable"
                      onClick={() => removeInventoryChoice(item.id)}
                    >
                      🚗 {item.label}
                      <span className="requested-car-tag__x" aria-hidden="true">×</span>
                    </button>
                  ))
                ) : hasRequestedCar ? (
                  (requestedCarFromDetails || customer.requested_car || "")
                    .split("|")
                    .filter(Boolean)
                    .map((car, i) => (
                      <span key={i} className="requested-car-tag">🚗 {car.trim()}</span>
                    ))
                ) : (
                  <span className="requested-car-tag requested-car-tag--empty">بدون سيارات محددة</span>
                )}
                {!hasRequestedCar && isSaleOnBehalfFlow && (
                  <div className="legacy-highlight-box legacy-highlight-box--warning mt-1">
                    لا توجد سيارة مطلوبة مرتبطة بهذا الملف.
                  </div>
                )}
              </div>

              {/* Edit section */}
              {editCarsEnabled ? (
                <div className="profile-section__body" style={{ borderTop: "1px solid #f1f5f9" }}>
                  <div className="legacy-toggle-row mb-3">
                    <button type="button" className={`legacy-toggle-btn ${detailUseInventory ? "active" : ""}`} onClick={() => setDetailUseInventory((c) => !c)}>
                      من المخزون
                    </button>
                    <button type="button" className={`legacy-toggle-btn ${detailUseCustomRequest ? "active" : ""}`} onClick={() => setDetailUseCustomRequest((c) => !c)}>
                      طلب خاص
                    </button>
                  </div>

                  {detailUseInventory && (
                    <div className="grid gap-2 md:grid-cols-[1fr_auto] mb-3">
                      <select className="legacy-select" value={detailInventoryToAdd} onChange={(e) => setDetailInventoryToAdd(e.target.value)}>
                        <option value="">اختر من المخزون</option>
                        {options.inventoryOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>
                      <button type="button" className="legacy-btn legacy-btn-info" onClick={addInventoryChoice}>إضافة</button>
                    </div>
                  )}

                  {detailUseCustomRequest && (
                    <div className="space-y-3 mb-3">
                      <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
                        <div>
                          <input value={detailCustomType} onChange={(e) => setDetailCustomType(e.target.value)} className="legacy-input" placeholder="ابحث أو اكتب نوع السيارة..." list="cars-datalist" autoComplete="off" />
                          <datalist id="cars-datalist">
                            {CAR_MAKES.map(c => <option key={c} value={c} />)}
                          </datalist>
                        </div>
                        <input value={detailCustomYear} onChange={(e) => setDetailCustomYear(e.target.value)} className="legacy-input" placeholder="الموديل (سنة)" />
                      </div>
                      {detailCustomType.trim() && (
                        <div className="legacy-negotiation-box legacy-negotiation-box--info">
                          <div className="legacy-negotiation-box__label">التفاوض: (طلب خاص) {detailCustomType.trim()}{detailCustomYear.trim() ? ` - موديل ${detailCustomYear.trim()}` : ""}</div>
                          <textarea value={detailCustomNegotiation} onChange={(e) => setDetailCustomNegotiation(e.target.value)} className="legacy-textarea" rows={3} placeholder="ما حدث في التفاوض..." />
                          <VoiceRecorder
                            customerId={customer.id}
                            label={`تفاوض - ${detailCustomType.trim() || "طلب خاص"}`}
                            onRecorded={(dur) => {
                              if (!detailCustomNegotiation.trim()) setDetailCustomNegotiation(dur);
                              markDirty();
                            }}
                            onDeleted={() => {
                              if (detailCustomNegotiation.startsWith("🎤")) setDetailCustomNegotiation("");
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {detailSelectedCars.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {detailSelectedCars.map((item) => {
                        const isNew = !preExistingCarIds.has(item.id);
                        const isEmpty = isNew && !(detailNegotiations[item.id] ?? "").trim();
                        return (
                          <div key={item.id} className="legacy-negotiation-box">
                            <div className="legacy-negotiation-box__label flex items-center gap-1">
                              التفاوض: {item.label}
                              {isNew && isEmpty && <span className="text-rose-500 text-xs font-bold">* مطلوب</span>}
                              {!isNew && <span className="text-slate-400 text-xs">(اختياري)</span>}
                            </div>
                            <textarea
                              value={detailNegotiations[item.id] ?? ""}
                              onChange={(e) => setDetailNegotiations((c) => ({ ...c, [item.id]: e.target.value }))}
                              className={`legacy-textarea${isEmpty ? " ring-2 ring-rose-400" : ""}`}
                              rows={3}
                              placeholder={isNew ? "ما حدث مع هذه السيارة... (مطلوب)" : "ما حدث مع هذه السيارة... (اختياري)"}
                            />
                            <VoiceRecorder
                              customerId={customer.id}
                              label={`تفاوض - ${item.label}`}
                              onRecorded={(dur) => {
                                setDetailNegotiations((c) => ({
                                  ...c,
                                  [item.id]: c[item.id]?.trim() ? c[item.id] : dur,
                                }));
                                markDirty();
                              }}
                              onDeleted={() => {
                                setDetailNegotiations((c) => {
                                  const val = c[item.id] ?? "";
                                  return { ...c, [item.id]: val.startsWith("🎤") ? "" : val };
                                });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <input type="hidden" name="requested_car" value={requestedCarFromDetails || customer.requested_car || ""} />
                </div>
              ) : (
                <input type="hidden" name="requested_car" value={customer.requested_car ?? ""} />
              )}
            </div>
          ) : (
            <input type="hidden" name="requested_car" value={customer.requested_car ?? ""} />
          )}

          {/* ══════════════════════════════════════
              UPDATE ZONE — highlighted action area
          ══════════════════════════════════════ */}
          <div className="profile-update-zone">
            <div className="profile-update-zone__header">
              <MessageSquareShare className="h-4 w-4" />
              إضافة تحديث جديد
            </div>
            <div className="profile-update-zone__body">
              <textarea
                value={detailUpdateNote}
                onChange={(e) => { setDetailUpdateNote(e.target.value); markDirty(); }}
                rows={4}
                placeholder="اكتب التفاصيل والملاحظات الجديدة هنا..."
                className="legacy-textarea"
              />
              <VoiceRecorder
                customerId={customer.id}
                label="ملاحظات عامة"
                onRecorded={(dur) => {
                  setUpdateNoteHasVoice(true);
                  if (!detailUpdateNote.trim()) {
                    setDetailUpdateNote(dur);
                    markDirty();
                  }
                }}
                onDeleted={() => {
                  setUpdateNoteHasVoice(false);
                  if (detailUpdateNote.startsWith("🎤")) {
                    setDetailUpdateNote("");
                  }
                }}
              />

              <label className="legacy-inline-toggle">
                <input
                  type="checkbox"
                  name="count_as_interaction"
                  checked={countAsInteraction}
                  onChange={(e) => setCountAsInteraction(e.target.checked)}
                />
                <span>{countAsInteraction ? "✓ احتساب كتواصل جديد" : "✗ لا تحتسب كتواصل"}</span>
                <span className="legacy-inline-toggle__dot" />
              </label>

              <div className="profile-status-block">
                <label className="legacy-label">تحديث الحالة النهائية</label>
                <select
                  name="status"
                  value={currentStatus}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__convert_to_tradein__") {
                      e.target.value = currentStatus;
                      requireConfirm({
                        title: "تحويل إلى مشتري + استبدال",
                        description: `سيتم تحويل ملف "${customer.full_name}" من "بيع بالوكالة" إلى "مشتري + استبدال". سيارة العميل الحالية ستُنقل تلقائياً لتعمل كسيارة استبدال. هذا الإجراء لا يمكن التراجع عنه.`,
                        confirmLabel: "تأكيد التحويل",
                        variant: "warning",
                        onConfirm: () => {
                          const fd = new FormData();
                          fd.append("customer_id", customer.id);
                          convertToTradeInAction(fd);
                        },
                      });
                      return;
                    }
                    if (val === "__convert_to_sell_on_behalf__") {
                      e.target.value = currentStatus;
                      requireConfirm({
                        title: "تحويل إلى بيع بالوكالة",
                        description: `سيتم تحويل ملف "${customer.full_name}" من "مشتري + استبدال" إلى "بيع بالوكالة". السيارات المطلوبة ستُفرَّغ وتُحفظ في السجل التاريخي فقط. هذا الإجراء لا يمكن التراجع عنه.`,
                        confirmLabel: "تأكيد التحويل",
                        variant: "warning",
                        onConfirm: () => {
                          const fd = new FormData();
                          fd.append("customer_id", customer.id);
                          convertToSellOnBehalfAction(fd);
                        },
                      });
                      return;
                    }
                    setCurrentStatus(val);
                    markDirty();
                  }}
                  className="legacy-select"
                >
                  {(options.statusesByType[operationType as keyof typeof options.statusesByType] ?? options.statuses).map((s) => <option key={s} value={s}>{s}</option>)}
                  {/* خيار التحويل — يظهر فقط لعملاء بيع بالوكالة */}
                  {operationType === "sell_on_behalf" && (
                    <option value="__convert_to_tradein__">🔄 تحويل إلى مشتري + استبدال</option>
                  )}
                  {/* خيار التحويل العكسي — يظهر فقط لعملاء مشتري + استبدال */}
                  {operationType === "buyer_tradein_pending" && (
                    <option value="__convert_to_sell_on_behalf__">🔄 تحويل إلى بيع بالوكالة</option>
                  )}
                </select>

                {needsInventoryChassis && (() => {
                  const selectedInvOpt = options.inventoryOptions.find((o) => o.id === inventoryForStatus);
                  return (
                    <>
                      <label className="legacy-label mt-1">السيارة / الشاصي — إلزامي عند الحجز/البيع</label>
                      <select
                        name="inventory_id_for_status"
                        className="legacy-select"
                        value={inventoryForStatus}
                        onChange={(e) => { setInventoryForStatus(e.target.value); markDirty(); }}
                      >
                        <option value="">اختر السيارة / الشاصي</option>
                        {/* السيارة المرتبطة حالياً (قد تكون محجوزة وغير مدرجة في القائمة العادية) */}
                        {fallbackInventoryId && !options.inventoryOptions.find((o) => o.id === fallbackInventoryId) && (
                          <option value={fallbackInventoryId}>
                            ✅ السيارة المحجوزة حالياً{linkedInventoryChassis ? ` — شاصي: ${linkedInventoryChassis}` : ""}
                          </option>
                        )}
                        {options.inventoryOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>

                      {/* رسالة التأكيد بعد الاختيار */}
                      {selectedInvOpt ? (
                        <div className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
                          <div className="font-bold text-emerald-700 mb-0.5">✅ سيتم ربط الملف بالسيارة التالية</div>
                          <div className="text-slate-700 font-medium">{selectedInvOpt.label}</div>
                          <div className="mt-1 text-xs text-emerald-600">
                            سيتم تحديث حالة هذه السيارة في المخزون تلقائياً عند الحفظ.
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          ⚠️ لم يتم اختيار سيارة بعد — الحفظ لن يكتمل بدون تحديد السيارة / الشاصي.
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* sell_on_behalf: اختيار السيارة المعنية عند الحجز/البيع إذا كان للعميل أكثر من سيارة */}
                {operationType === "sell_on_behalf" && customer.tradeIns.length > 1 && (
                  <>
                    <label className="legacy-label mt-1">السيارة المعنية — اختر من سيارات العميل</label>
                    <select
                      name="selected_trade_in_id"
                      className="legacy-select"
                      value={selectedSellTradeId}
                      onChange={(e) => { setSelectedSellTradeId(e.target.value); markDirty(); }}
                    >
                      {customer.tradeIns.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.model ?? "—"}
                          {t.chassis_no ? ` — شاصي: ${t.chassis_no}` : ""}
                        </option>
                      ))}
                    </select>
                    {/* تأكيد السيارة المختارة */}
                    {(() => {
                      const sel = customer.tradeIns.find((t) => t.id === selectedSellTradeId);
                      return sel ? (
                        <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
                          <div className="font-bold text-sky-700 mb-0.5">🚗 السيارة المعنية بهذا الإجراء</div>
                          <div className="text-slate-700 font-medium">
                            {sel.model ?? "—"}{sel.chassis_no ? ` — شاصي: ${sel.chassis_no}` : ""}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </>
                )}
                {operationType === "sell_on_behalf" && customer.tradeIns.length === 1 && customer.tradeIns[0] && (() => {
                  const t = customer.tradeIns[0];
                  return (
                    <>
                      <input type="hidden" name="selected_trade_in_id" value={t.id} />
                      {/* تأكيد السيارة الوحيدة */}
                      <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
                        <div className="font-bold text-sky-700 mb-0.5">🚗 السيارة المعنية بهذا الإجراء</div>
                        <div className="text-slate-700 font-medium">
                          {t.model ?? "—"}{t.chassis_no ? ` — شاصي: ${t.chassis_no}` : ""}
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* طريقة الدفع + قيمة الصفقة — تظهران عند حالات البيع/الحجز */}
                {needsPaymentMethod(currentStatus) && (
                  <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 space-y-3">
                    {/* طريقة الدفع */}
                    <div>
                      <label className="legacy-label text-emerald-800">💳 طريقة الدفع</label>
                      <select
                        name="payment_method"
                        defaultValue={
                          typeof (customer.metadata as Record<string, unknown> | null)?.payment_method === "string"
                            ? String((customer.metadata as Record<string, unknown>).payment_method)
                            : ""
                        }
                        onChange={markDirty}
                        className="legacy-select mt-1"
                      >
                        <option value="">— اختر طريقة الدفع —</option>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* قيمة الصفقة */}
                    <div>
                      <label className="legacy-label text-emerald-800">💰 قيمة الصفقة (شيقل) — اختياري</label>
                      <input
                        type="number"
                        name="deal_value"
                        min="0"
                        step="500"
                        placeholder="أدخل قيمة الصفقة..."
                        defaultValue={
                          typeof (customer.metadata as Record<string, unknown> | null)?.deal_value === "number"
                            ? String((customer.metadata as Record<string, unknown>).deal_value)
                            : ""
                        }
                        onChange={markDirty}
                        className="legacy-input"
                      />
                      <p className="text-xs text-emerald-600 mt-1">
                        ستظهر في إشعار المدير وتُستخدم في تقارير المبيعات.
                      </p>
                    </div>
                  </div>
                )}

                <label className="legacy-label mt-1">موعد المراجعة</label>
                <input
                  type="date"
                  name="next_follow_up_at"
                  defaultValue={toDateTimeLocalValue(customer.next_follow_up_at).slice(0, 10)}
                  className="legacy-input"
                />
              </div>
            </div>
          </div>

        </div>{/* end profile-body */}

        {/* ══════════════════════════════════════
            STICKY FOOTER
        ══════════════════════════════════════ */}
        <div className="profile-sticky-footer">
          {returnPath && (
            <Link href={returnPath} className="profile-footer-cancel">إغلاق</Link>
          )}

          {/* زر حذف العميل — للجميع */}
          <button
            type="button"
            onClick={() => requireConfirm({
              title: "حذف ملف العميل نهائياً",
              description: `سيتم حذف ملف "${customer.full_name}" وجميع بياناته بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.`,
              confirmLabel: "حذف نهائي",
              variant: "danger",
              onConfirm: () => {
                const fd = new FormData();
                fd.append("customer_id", customer.id);
                fd.append("return_to", returnPath ?? "/dashboard/customers");
                deleteCustomerAction(fd);
              },
            })}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
          >
            🗑 حذف العميل
          </button>

          {/* زر الإشعار:
              المدير → يُشعر الموظف المسؤول
              الموظف → يُشعر مدير الفرع */}
          {isManager
            ? (customer.assigned_user_id || customer.branch_id) && (
                <button
                  type="button"
                  onClick={handleSendReminder}
                  disabled={isPendingReminder}
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                  title={`إشعار ${customer.assigned_user_name ?? "الموظف المسؤول"} عبر تيليغرام`}
                >
                  <Send className="h-4 w-4" />
                  {isPendingReminder ? "جاري الإرسال..." : `إشعار ${customer.assigned_user_name ?? "الموظف"}`}
                </button>
              )
            : (
                <>
                  {/* إشعار الموظف المسؤول (صاحب الملف) */}
                  {customer.assigned_user_id && (
                    <button
                      type="button"
                      onClick={handleSendReminder}
                      disabled={isPendingReminder}
                      className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                      title={`إشعار ${customer.assigned_user_name ?? "الموظف المسؤول"} عبر تيليغرام`}
                    >
                      <Send className="h-4 w-4" />
                      {isPendingReminder ? "جاري الإرسال..." : `إشعار ${customer.assigned_user_name ?? "الموظف"}`}
                    </button>
                  )}
                  {/* إشعار مدير الفرع */}
                  {customer.branch_id && (
                    <button
                      type="button"
                      onClick={handleNotifyManager}
                      disabled={isPendingReminder}
                      className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
                      title="إشعار مدير الفرع عبر تيليغرام"
                    >
                      <Send className="h-4 w-4" />
                      {isPendingReminder ? "جاري الإرسال..." : "إشعار المدير"}
                    </button>
                  )}
                </>
              )
          }

          {showNewCycleForm ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
              🔄 جاري إعداد دورة جديدة — استخدم زر "تأكيد فتح الدورة" أعلاه
            </div>
          ) : isSoldComplete && !allowEditClosed ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600">
              🔒 الملف مقفل — فعّل التعديل الاستثنائي أولاً
            </div>
          ) : (
            <button
              type="submit"
              className={`profile-footer-save${isDirty ? " profile-footer-save--dirty" : ""}${isSoldComplete && allowEditClosed ? " profile-footer-save--exceptional" : ""}`}
              onClick={() => setIsDirty(false)}
            >
              <Save className="h-4 w-4" />
              {isSoldComplete && allowEditClosed ? "حفظ (تعديل استثنائي)" : "حفظ التعديلات"}
              {isDirty && <span className="profile-footer-dirty-dot" aria-label="يوجد تغييرات غير محفوظة" />}
            </button>
          )}
        </div>

      </form>

      {/* ── نافذة معاينة الإشعار قبل الإرسال ── */}
      {showNotifyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNotifyModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 flex flex-col gap-4">
            {/* رأس النافذة */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">📤 إشعار الموظف</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  سيُرسل إلى: <strong>{notifyTarget === "manager" ? "مدير الفرع" : (customer.assigned_user_name ?? "الموظف المسؤول")}</strong> عبر تيليغرام
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifyModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* نص الرسالة قابل للتعديل */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">نص الرسالة</label>
              <textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 resize-none focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                dir="rtl"
                placeholder="اكتب نص الرسالة..."
              />
              <p className="text-xs text-slate-400">{notifyMessage.length} حرف</p>
            </div>

            {/* أزرار */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNotifyModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmNotify}
                disabled={!notifyMessage.trim() || notifySending || isPendingReminder}
                className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {notifySending ? "جاري الإرسال..." : "إرسال الإشعار"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Album overlay ── */}
      {showAlbum && imageAttachments.length > 0 && (
        <div className="legacy-album-overlay" role="dialog" aria-modal="true">
          <div className="legacy-album-card">
            <div className="legacy-album-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>ألبوم المرفقات</span>
                <span className="album-counter">{activeImageIndex + 1} / {imageAttachments.length}</span>
              </div>
              <button type="button" className="legacy-album-close" onClick={() => setShowAlbum(false)} aria-label="إغلاق" style={{ position: "static", width: 34, height: 34 }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="legacy-album-body">
              <button type="button" className="legacy-album-arrow" onClick={showPrevImage} disabled={imageAttachments.length <= 1} aria-label="السابق">
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="legacy-album-image-wrap">
                <img src={imageAttachments[activeImageIndex].public_url ?? ""} alt={imageAttachments[activeImageIndex].file_name ?? "attachment"} className="legacy-album-image" />
                <div className="album-caption-bar">
                  <span className="album-caption-bar__name">{imageAttachments[activeImageIndex].file_name ?? "صورة"}</span>
                  {imageAttachments[activeImageIndex].public_url && (
                    <a href={imageAttachments[activeImageIndex].public_url ?? ""} download={imageAttachments[activeImageIndex].file_name ?? "image"} target="_blank" rel="noreferrer" className="album-caption-bar__download">
                      <Download className="h-3.5 w-3.5" /> تنزيل
                    </a>
                  )}
                </div>
              </div>
              <button type="button" className="legacy-album-arrow" onClick={showNextImage} disabled={imageAttachments.length <= 1} aria-label="التالي">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── مودال تأكيد الإجراءات الحرجة ── */}
      {confirmAction && (
        <ConfirmDialog
          open={true}
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          variant={confirmAction.variant}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            setConfirmAction(null);
            confirmAction.onConfirm();
          }}
        />
      )}

      {/* ── مودال إرسال رسالة واتساب من المعرض ── */}
      {showWaModal && (
        <div
          className="legacy-album-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowWaModal(false); }}
        >
          <div className="legacy-album-card" style={{ maxWidth: 480, width: "95%" }}>
            {/* Header */}
            <div className="legacy-album-head">
              <span style={{ fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <Phone className="h-4 w-4 text-emerald-600" />
                إرسال واتساب من المعرض
              </span>
              <button
                type="button"
                className="legacy-album-close"
                onClick={() => setShowWaModal(false)}
                aria-label="إغلاق"
                style={{ position: "static", width: 34, height: 34 }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                إلى: <strong style={{ color: "#0f172a" }}>{customer.full_name}</strong>
                {" · "}{(customer.whatsapp_prefix ?? "+966")} {customer.phone}
              </div>

              <textarea
                ref={waTextareaRef}
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                rows={5}
                className="legacy-input"
                placeholder="اكتب رسالتك هنا..."
                style={{ resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
                disabled={waSending}
              />

              {waResult && (
                <div
                  style={{
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    background: waResult.ok ? "#ecfdf5" : "#fff1f2",
                    color: waResult.ok ? "#065f46" : "#9f1239",
                    border: `1px solid ${waResult.ok ? "#6ee7b7" : "#fecdd3"}`,
                  }}
                >
                  {waResult.ok ? "✅ " : "⚠️ "}{waResult.msg}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="legacy-btn border"
                  onClick={() => setShowWaModal(false)}
                  disabled={waSending}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className="legacy-btn legacy-btn-info"
                  disabled={waSending || !waMessage.trim()}
                  onClick={async () => {
                    setWaSending(true);
                    setWaResult(null);
                    try {
                      const res = await fetch("/api/whatsapp-send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ customer_id: customer.id, message: waMessage }),
                      });
                      const json = await res.json();
                      if (res.ok) {
                        setWaResult({ ok: true, msg: "تم الإرسال بنجاح ✓" });
                        setTimeout(() => setShowWaModal(false), 1500);
                      } else {
                        setWaResult({ ok: false, msg: json.error ?? "فشل الإرسال" });
                      }
                    } catch {
                      setWaResult({ ok: false, msg: "تعذّر الاتصال بالسيرفر" });
                    } finally {
                      setWaSending(false);
                    }
                  }}
                >
                  {waSending ? "جاري الإرسال..." : (
                    <><Send className="h-4 w-4" /> إرسال</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── مودال تعديل البيانات الأساسية ── */}
      {showEditBasic && (
        <div
          className="legacy-album-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditBasic(false); }}
        >
          <div className="legacy-album-card" style={{ maxWidth: 440, width: "95%" }}>
            <div className="legacy-album-head">
              <span style={{ fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                <Pencil className="h-4 w-4 text-sky-600" />
                تعديل بيانات العميل
              </span>
              <button
                type="button"
                className="legacy-album-close"
                onClick={() => setShowEditBasic(false)}
                aria-label="إغلاق"
                style={{ position: "static", width: 34, height: 34 }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="legacy-field">
                <span className="legacy-field__label">الاسم الكامل <span style={{ color: "#ef4444" }}>*</span></span>
                <input
                  type="text"
                  value={editBasicName}
                  onChange={(e) => setEditBasicName(e.target.value)}
                  className="legacy-input"
                  placeholder="اسم العميل"
                  disabled={editBasicPending}
                />
              </label>

              <label className="legacy-field">
                <span className="legacy-field__label">الكنية</span>
                <input
                  type="text"
                  value={editBasicNickname}
                  onChange={(e) => setEditBasicNickname(e.target.value)}
                  className="legacy-input"
                  placeholder="أبو فلان..."
                  disabled={editBasicPending}
                />
              </label>

              <label className="legacy-field">
                <span className="legacy-field__label">رقم الهاتف <span style={{ color: "#ef4444" }}>*</span></span>
                <input
                  type="tel"
                  value={editBasicPhone}
                  onChange={(e) => setEditBasicPhone(e.target.value.replace(/\D/g, ""))}
                  className="legacy-input num-val"
                  placeholder="05XXXXXXXX"
                  maxLength={10}
                  disabled={editBasicPending}
                />
              </label>

              <label className="legacy-field">
                <span className="legacy-field__label">مقدمة الواتس آب</span>
                <select value={editBasicWaPrefix} onChange={e => setEditBasicWaPrefix(e.target.value)} className="legacy-input" disabled={editBasicPending}>
                  <option value="+970">🇵🇸 +970</option>
                  <option value="+972">🇮🇱 +972</option>
                  <option value="+962">🇯🇴 +962</option>
                  <option value="+966">🇸🇦 +966</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+20">🇪🇬 +20</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                </select>
              </label>

              <label className="legacy-field">
                <span className="legacy-field__label">المدينة / العنوان</span>
                <input
                  type="text"
                  value={editBasicAddress}
                  onChange={(e) => setEditBasicAddress(e.target.value)}
                  className="legacy-input"
                  placeholder="ابحث أو اكتب..."
                  list="cities-datalist"
                  autoComplete="off"
                  disabled={editBasicPending}
                />
                <datalist id="cities-datalist">
                  {PALESTINE_CITIES.map(c => <option key={c} value={c} />)}
                </datalist>
              </label>

              {editBasicError && (
                <div style={{ borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, background: "#fff1f2", color: "#9f1239", border: "1px solid #fecdd3" }}>
                  ⚠️ {editBasicError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="legacy-btn border" onClick={() => setShowEditBasic(false)} disabled={editBasicPending}>
                  إلغاء
                </button>
                <button
                  type="button"
                  className="legacy-btn legacy-btn-primary"
                  disabled={editBasicPending || !editBasicName.trim() || editBasicPhone.length !== 10}
                  onClick={() => {
                    setEditBasicError(null);
                    const fd = new FormData();
                    fd.set("customer_id", customer.id);
                    fd.set("full_name", editBasicName.trim());
                    fd.set("nickname", editBasicNickname.trim());
                    fd.set("phone", editBasicPhone.trim());
                    fd.set("address", editBasicAddress.trim());
                    fd.set("whatsapp_prefix", editBasicWaPrefix);
                    startEditBasicTransition(async () => {
                      const result = await updateCustomerBasicInfoAction(fd);
                      if (result?.error) {
                        setEditBasicError(result.error);
                      } else {
                        setShowEditBasic(false);
                        router.refresh();
                      }
                    });
                  }}
                >
                  {editBasicPending ? "جاري الحفظ..." : <><Save className="h-4 w-4" /> حفظ</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
