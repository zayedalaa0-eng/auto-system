"use client";

import { useMemo, useState } from "react";
import { CarFront, ChevronLeft, ChevronRight, FileClock, FolderOpen, MessageSquareShare, Paperclip, Phone, RotateCcw, X } from "lucide-react";

import { reactivateCustomerAction, saveCustomerProfileAction } from "@/app/dashboard/actions";
import type { CustomerAttachmentItem, CustomerDetail, CustomerFormOptions } from "@/lib/data";
import { formatCurrency, formatDate, toDateTimeLocalValue } from "@/lib/format";

const SALE_OR_RESERVE_STATUSES = ["تم البيع", "حجز"];

function buildWhatsAppHref(prefix: string | null, phone: string) {
  const normalizedPrefix = (prefix ?? "").replace(/\D/g, "");
  const normalizedPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${normalizedPrefix}${normalizedPhone}`;
}

function translateLogAction(action: string) {
  const map: Record<string, string> = {
    customer_created: "إنشاء ملف جديد",
    customer_updated: "تحديث ملف العميل",
    status_updated: "تحديث الحالة",
    manual_reminder_created: "إضافة تذكير جديد",
    trade_in_saved: "حفظ سيارة العميل",
    trade_in_archived: "إيقاف سيارة العميل",
    sell_inventory_created: "إدخال سيارة برسم البيع",
    customer_reactivated: "تفعيل عملية جديدة",
  };
  return map[action] ?? action;
}

function isImageAttachment(fileName: string | null) {
  const name = (fileName ?? "").toLowerCase();
  return name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".webp") || name.endsWith(".gif");
}

function getCategoryLabel(category: string | null) {
  if (category === "trade_photo") return "صور السيارة";
  if (category === "trade_inspection") return "الفحص";
  if (category === "trade_license") return "الرخصة";
  if (category === "trade_insurance") return "التأمين";
  return "ملفات أخرى";
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
    const key = item.file_category ?? "other";
    if (grouped[key]) grouped[key].push(item);
    else grouped.other.push(item);
  }
  return grouped;
}

function TradeInEditor({ primaryTrade }: { primaryTrade: CustomerDetail["tradeIns"][number] | null }) {
  return (
    <div className="legacy-subpanel mt-3">
      <input type="hidden" name="trade_in_id" value={primaryTrade?.id ?? ""} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="legacy-field">
          <span className="legacy-field__label">نوع السيارة</span>
          <input name="trade_in_model" defaultValue={primaryTrade?.model ?? ""} className="legacy-input" placeholder="نوع السيارة" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">رقم الشاصي</span>
          <input name="trade_in_chassis" defaultValue={primaryTrade?.chassis_no ?? ""} className="legacy-input" placeholder="رقم الشاصي" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">سعر التقييم ($)</span>
          <input name="trade_in_price" defaultValue={primaryTrade?.price ?? undefined} type="number" className="legacy-input" placeholder="سعر التقييم ($)" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">اللون</span>
          <input name="trade_in_color" defaultValue={primaryTrade?.color ?? ""} className="legacy-input" placeholder="اللون" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">سنة الموديل</span>
          <input name="trade_in_year" defaultValue={primaryTrade?.production_year ?? undefined} type="number" className="legacy-input" placeholder="سنة الموديل" />
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
            <option value="سولار">سولار</option>
            <option value="هايبرد">هايبرد</option>
            <option value="كهربائية بالكامل">كهربائية بالكامل</option>
          </select>
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">تاريخ انتهاء الرخصة</span>
          <input name="trade_in_license_expiry" defaultValue={primaryTrade?.license_expiry ?? ""} type="date" className="legacy-input" />
        </label>
        <label className="legacy-field">
          <span className="legacy-field__label">حالة السيارة في المعرض</span>
          <input name="trade_in_status" type="hidden" value={primaryTrade?.status ?? "استبدال (بانتظار التقييم)"} />
          <div className="legacy-input flex items-center">
            {primaryTrade?.status ?? "استبدال (بانتظار التقييم)"}
          </div>
        </label>
        <label className="legacy-field md:col-span-2">
          <span className="legacy-field__label">ملاحظات</span>
          <textarea name="trade_in_notes" defaultValue={primaryTrade?.notes ?? ""} rows={3} className="legacy-textarea" placeholder="ملاحظات..." />
        </label>
      </div>

      <div className="legacy-subpanel mt-3">
        <div className="legacy-subpanel-title">مستندات سيارة العميل (اختياري)</div>
        <p className="legacy-helper-text mb-2">يمكنك رفع أكثر من صورة أو ملف دفعة واحدة (حتى 20 ملف لكل خانة).</p>
        <label className="legacy-label">صور</label>
        <input type="file" name="trade_files_photos" className="legacy-input" accept="image/*,.pdf,.doc,.docx" multiple />
        <label className="legacy-label mt-3">فحص</label>
        <input type="file" name="trade_files_inspection" className="legacy-input" accept="image/*,.pdf,.doc,.docx" multiple />
        <label className="legacy-label mt-3">رخصة</label>
        <input type="file" name="trade_files_license" className="legacy-input" accept="image/*,.pdf,.doc,.docx" multiple />
        <label className="legacy-label mt-3">تأمين</label>
        <input type="file" name="trade_files_insurance" className="legacy-input" accept="image/*,.pdf,.doc,.docx" multiple />
      </div>
    </div>
  );
}

export function CustomerProfileContent({
  customer,
  options,
  returnPath,
  initialOpenTradeEditor = false,
  compactTradeOnly = false,
}: {
  customer: CustomerDetail;
  options: CustomerFormOptions;
  returnPath?: string;
  initialOpenTradeEditor?: boolean;
  compactTradeOnly?: boolean;
}) {
  const [editCarsEnabled, setEditCarsEnabled] = useState(false);
  const [editTradeEnabled, setEditTradeEnabled] = useState(initialOpenTradeEditor);
  const [currentStatus, setCurrentStatus] = useState(customer.status);
  const [detailUseInventory, setDetailUseInventory] = useState(true);
  const [detailUseCustomRequest, setDetailUseCustomRequest] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [detailInventoryToAdd, setDetailInventoryToAdd] = useState("");
  const [detailCustomType, setDetailCustomType] = useState("");
  const [detailCustomYear, setDetailCustomYear] = useState("");
  const [detailCustomNegotiation, setDetailCustomNegotiation] = useState("");
  const [countAsInteraction, setCountAsInteraction] = useState(true);
  const [detailNegotiations, setDetailNegotiations] = useState<Record<string, string>>({});
  const [detailUpdateNote, setDetailUpdateNote] = useState("");
  const [detailSelectedCars, setDetailSelectedCars] = useState<Array<{ id: string; label: string }>>(() => {
    const requested = customer.requested_car ?? "";
    return options.inventoryOptions.filter((item) => requested.includes(item.label));
  });

  const primaryTrade = customer.tradeIns[0] ?? null;
  const logCount = customer.logs.length;
  const attachmentCount = customer.attachments.length;
  const groupedAttachments = useMemo(() => groupAttachments(customer.attachments), [customer.attachments]);
  const imageAttachments = useMemo(
    () => customer.attachments.filter((item) => item.public_url && isImageAttachment(item.file_name)),
    [customer.attachments],
  );
  const fileAttachments = useMemo(
    () => customer.attachments.filter((item) => !item.public_url || !isImageAttachment(item.file_name)),
    [customer.attachments],
  );
  const needsInventoryChassis = SALE_OR_RESERVE_STATUSES.some((status) => currentStatus.includes(status));

  const requestedCarFromDetails = [
    ...detailSelectedCars.map((item) => item.label),
    detailUseCustomRequest && detailCustomType.trim()
      ? detailCustomYear.trim()
        ? `(طلب خاص) ${detailCustomType.trim()} - موديل ${detailCustomYear.trim()}`
        : `(طلب خاص) ${detailCustomType.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const hasRequestedCar = Boolean((requestedCarFromDetails || customer.requested_car || "").trim());
  const isSaleOnBehalfFlow = Boolean(
    primaryTrade?.status?.includes("برسم البيع") || primaryTrade?.status?.includes("عرض سيارة"),
  );

  const detailNegotiationSummary = [
    ...detailSelectedCars
      .map((item) => {
        const note = detailNegotiations[item.id]?.trim();
        return note ? `التفاوض لسيارة ${item.label}: ${note}` : "";
      })
      .filter(Boolean),
    detailUseCustomRequest && detailCustomType.trim() && detailCustomNegotiation.trim()
      ? `التفاوض للطلب الخاص (${detailCustomType.trim()}${detailCustomYear.trim() ? ` - موديل ${detailCustomYear.trim()}` : ""}): ${detailCustomNegotiation.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const composedNote = [detailUpdateNote.trim(), detailNegotiationSummary].filter(Boolean).join("\n\n");
  const customerNickname = customer.nickname?.trim() ? customer.nickname.trim() : "غير متوفر";
  const customerAddress = customer.address?.trim() ? customer.address.trim() : "غير مسجل";

  function addInventoryChoice() {
    if (!detailInventoryToAdd) return;
    const item = options.inventoryOptions.find((choice) => choice.id === detailInventoryToAdd);
    if (!item) return;
    setDetailSelectedCars((current) => (current.some((entry) => entry.id === item.id) ? current : [...current, item]));
    setDetailInventoryToAdd("");
  }

  function removeInventoryChoice(id: string) {
    setDetailSelectedCars((current) => current.filter((item) => item.id !== id));
    setDetailNegotiations((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function openAlbumAt(index: number) {
    setActiveImageIndex(index);
    setShowAlbum(true);
  }

  function showNextImage() {
    if (imageAttachments.length <= 1) return;
    setActiveImageIndex((prev) => (prev + 1) % imageAttachments.length);
  }

  function showPrevImage() {
    if (imageAttachments.length <= 1) return;
    setActiveImageIndex((prev) => (prev - 1 + imageAttachments.length) % imageAttachments.length);
  }

  if (compactTradeOnly) {
    return (
      <form action={saveCustomerProfileAction} className="legacy-profile-layout" encType="multipart/form-data">
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

        <section className="legacy-profile-head">
          <div className="legacy-profile-head__name">{customer.full_name}</div>
          <div className="legacy-profile-head__line"><strong>اسم العميل:</strong> {customer.full_name}</div>
          <div className="legacy-profile-head__line"><strong>الكنية:</strong> {customerNickname}</div>
          <div className="legacy-profile-head__line"><strong>رقم الهاتف:</strong> {customer.phone}</div>
          <div className="legacy-profile-head__line"><strong>العنوان:</strong> {customerAddress}</div>
          <div className="mt-3">
            <a href={buildWhatsAppHref(customer.whatsapp_prefix, customer.phone)} target="_blank" rel="noreferrer" className="legacy-mini-btn legacy-mini-btn--success">
              <Phone className="h-4 w-4" />
              تواصل واتساب
            </a>
          </div>
        </section>

        <section className="legacy-profile-section legacy-profile-section--soft">
          <div className="legacy-section-headline">
            <div className="legacy-profile-section__title">
              <CarFront className="h-4 w-4 text-sky-500" />
              سيارة العميل
            </div>
          </div>
          <TradeInEditor primaryTrade={primaryTrade} />
          <label className="legacy-label mt-3">تاريخ المراجعة الجديد / الحجز</label>
          <input type="date" name="next_follow_up_at" defaultValue={toDateTimeLocalValue(customer.next_follow_up_at).slice(0, 10)} className="legacy-input" />
          <button type="submit" className="legacy-save-strip mt-4">
            حفظ بيانات السيارة
          </button>
        </section>
      </form>
    );
  }

  return (
    <>
      <form action={saveCustomerProfileAction} className="legacy-profile-layout" encType="multipart/form-data">
        <input type="hidden" name="customer_id" value={customer.id} />
        <input type="hidden" name="full_name" value={customer.full_name} />
        <input type="hidden" name="phone" value={customer.phone} />
        <input type="hidden" name="branch_id" value={customer.branch_id ?? ""} />
        <input type="hidden" name="assigned_user_id" value={customer.assigned_user_id ?? ""} />
        {returnPath ? <input type="hidden" name="return_to" value={returnPath} /> : null}

        <section className="legacy-profile-head">
          <div className="legacy-profile-head__name">{customer.full_name}</div>
          <div className="legacy-profile-head__line"><strong>اسم العميل:</strong> {customer.full_name}</div>
          <div className="legacy-profile-head__line"><strong>الكنية:</strong> {customerNickname}</div>
          <div className="legacy-profile-head__line"><strong>رقم الهاتف:</strong> {customer.phone}</div>
          <div className="legacy-profile-head__line"><strong>العنوان:</strong> {customerAddress}</div>
          <div className="legacy-profile-head__line">آخر تحديث: {formatDate(customer.updated_at ?? customer.created_at ?? null)}</div>
          <div className="mt-3">
            <a href={buildWhatsAppHref(customer.whatsapp_prefix, customer.phone)} target="_blank" rel="noreferrer" className="legacy-mini-btn legacy-mini-btn--success">
              <Phone className="h-4 w-4" />
              تواصل واتساب
            </a>
          </div>
        </section>

        <section className="legacy-profile-section">
          <div className="legacy-profile-section__title">
            <FileClock className="h-4 w-4 text-sky-500" />
            السجل والمرفقات السابقة
          </div>

          <div className="legacy-history-box">
            {customer.logs.length > 0 ? (
              customer.logs.map((log) => (
                <div key={log.id} className="legacy-history-entry">
                  <div className="legacy-history-entry__head">
                    <span>{translateLogAction(log.action)}</span>
                    <span>{formatDate(log.created_at)}</span>
                  </div>
                  <div className="legacy-history-entry__body">{log.details ?? "بدون تفاصيل إضافية."}</div>
                </div>
              ))
            ) : (
              <div className="legacy-empty-lite">لا يوجد سجل سابق حتى الآن.</div>
            )}
          </div>

          <div className="legacy-attachment-actions">
            <button type="button" className="legacy-mini-btn legacy-mini-btn--warn" onClick={() => setShowAttachments((current) => !current)}>
              <FolderOpen className="h-4 w-4" />
              المرفقات ({attachmentCount}) {showAttachments ? "إخفاء" : "عرض"}
            </button>
          </div>

          {attachmentCount > 0 && showAttachments ? (
            <div className="legacy-attachments-panel mt-3">
              <div className="legacy-attachment-folder">
                <div className="legacy-attachment-folder__header">
                  <span className="legacy-attachment-folder__title">📁 مجلد المرفقات</span>
                  <span className="legacy-attachment-folder__meta">صور: {imageAttachments.length} | ملفات: {fileAttachments.length}</span>
                </div>

                {imageAttachments.length > 0 ? (
                  <>
                    <div className="legacy-attachments-grid">
                      {imageAttachments.map((attachment, index) => (
                        <button key={attachment.id} type="button" className="legacy-attachment-thumb-button" onClick={() => openAlbumAt(index)}>
                          <img src={attachment.public_url ?? ""} alt={attachment.file_name ?? "image"} className="legacy-attachment-thumb" />
                          <span className="legacy-attachment-thumb-name">{attachment.file_name ?? "صورة"}</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="legacy-mini-btn legacy-mini-btn--primary mt-3" onClick={() => openAlbumAt(0)}>
                      عرض الألبوم
                    </button>
                  </>
                ) : null}

                {fileAttachments.length > 0 ? (
                  <div className="legacy-attachments-files mt-3">
                    {fileAttachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.public_url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={`legacy-attachment-link ${attachment.public_url ? "" : "legacy-attachment-link--disabled"}`}
                      >
                        <Paperclip className="h-4 w-4" />
                        {getCategoryLabel(attachment.file_category)}: {attachment.file_name ?? "ملف"}
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="legacy-attachments-groups mt-3">
                  {Object.entries(groupedAttachments).map(([key, items]) =>
                    items.length > 0 ? (
                      <div key={key} className="legacy-attachments-group">
                        <div className="legacy-attachments-group__title">{getCategoryLabel(key)}</div>
                        <div className="legacy-attachments-group__count">{items.length}</div>
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="legacy-profile-section legacy-profile-section--soft">
          <div className="legacy-section-headline">
            <div className="legacy-profile-section__title">
              <CarFront className="h-4 w-4 text-sky-500" />
              سيارة العميل
            </div>
            <label className="legacy-checkline legacy-checkline--card">
              <input type="checkbox" name="has_trade_in" checked={editTradeEnabled} onChange={(event) => setEditTradeEnabled(event.target.checked)} />
              <span>{editTradeEnabled ? "إغلاق تعديل السيارة" : "إضافة / تعديل سيارة العميل"}</span>
            </label>
          </div>

          <div className="legacy-trade-box">
            {primaryTrade ? (
              <>
                <div className="legacy-trade-box__status">{primaryTrade.is_active ? primaryTrade.status ?? "سيارة عميل نشطة" : "العميل غير فعال"}</div>
                <div className="legacy-trade-box__meta">آخر إجراء: ملف صفقة السيارة | التاريخ: {formatDate(customer.updated_at ?? customer.created_at ?? null)}</div>
                <div className="legacy-trade-box__meta">سيارة العملية السابقة: {primaryTrade.model}</div>
                <div className="legacy-trade-grid">
                  <div>السعر: {formatCurrency(primaryTrade.price)}</div>
                  <div>الشاصي: {primaryTrade.chassis_no ?? "غير محدد"}</div>
                  <div>اللون: {primaryTrade.color ?? "غير محدد"}</div>
                  <div>السنة: {primaryTrade.production_year ?? "غير محدد"}</div>
                  <div>الرخصة: {primaryTrade.license_expiry ?? "غير محدد"}</div>
                  <div>
                    الوقود / الجير: {typeof primaryTrade.metadata?.fuel === "string" ? primaryTrade.metadata.fuel : "—"} /{" "}
                    {typeof primaryTrade.metadata?.gear === "string" ? primaryTrade.metadata.gear : "—"}
                  </div>
                </div>
              </>
            ) : (
              <div className="legacy-trade-box__meta">لا توجد سيارة عميل مرتبطة بهذا الملف.</div>
            )}

            {!customer.is_active || customer.status.includes("غير فعال") ? (
              <button formAction={reactivateCustomerAction} type="submit" className="legacy-mini-btn legacy-mini-btn--primary mt-3">
                <RotateCcw className="h-4 w-4" />
                تفعيل عملية جديدة
              </button>
            ) : null}
          </div>

          {editTradeEnabled ? <TradeInEditor primaryTrade={primaryTrade} /> : <input type="hidden" name="trade_in_id" value={primaryTrade?.id ?? ""} />}
        </section>

        <section className="legacy-profile-section legacy-profile-section--outlined">
          <div className="legacy-section-headline">
            <div className="legacy-profile-section__title">
              <CarFront className="h-4 w-4 text-sky-500" />
              السيارات المطلوبة للعميل
            </div>
            <label className="legacy-checkline legacy-checkline--card">
              <input type="checkbox" checked={editCarsEnabled} onChange={(event) => setEditCarsEnabled(event.target.checked)} />
              <span>{editCarsEnabled ? "إغلاق تعديل السيارات المطلوبة" : "إضافة / تعديل السيارات المطلوبة"}</span>
            </label>
          </div>
          <div className="legacy-request-box">
            <div className="legacy-request-box__label">السيارات المطلوبة للعميل:</div>
            <div className="legacy-request-chip">{hasRequestedCar ? requestedCarFromDetails || customer.requested_car : "بدون سيارات محددة"}</div>
            {!hasRequestedCar && isSaleOnBehalfFlow ? (
              <div className="legacy-highlight-box legacy-highlight-box--warning mt-3">
                لا توجد سيارة مطلوبة للعميل مرتبطة بهذا الملف.
              </div>
            ) : null}

            {editCarsEnabled ? (
              <div className="mt-3 space-y-3">
                <div className="legacy-toggle-row">
                  <button type="button" className={`legacy-toggle-btn ${detailUseInventory ? "active" : ""}`} onClick={() => setDetailUseInventory((current) => !current)}>
                    اختيار من المخزون المتوفر
                  </button>
                  <button type="button" className={`legacy-toggle-btn ${detailUseCustomRequest ? "active" : ""}`} onClick={() => setDetailUseCustomRequest((current) => !current)}>
                    طلب خاص (غير متوفر)
                  </button>
                </div>

                {detailUseInventory ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <select className="legacy-select" value={detailInventoryToAdd} onChange={(event) => setDetailInventoryToAdd(event.target.value)}>
                      <option value="">اختر من المخزون</option>
                      {options.inventoryOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="legacy-btn legacy-btn-info" onClick={addInventoryChoice}>
                      إضافة السيارة
                    </button>
                  </div>
                ) : null}

                {detailSelectedCars.length > 0 ? (
                  <div className="legacy-chip-row">
                    {detailSelectedCars.map((item) => (
                      <button key={item.id} type="button" className="legacy-chip" onClick={() => removeInventoryChoice(item.id)}>
                        {item.label}
                        <span className="legacy-chip-x">×</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {detailUseCustomRequest ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                      <input value={detailCustomType} onChange={(event) => setDetailCustomType(event.target.value)} className="legacy-input" placeholder="نوع السيارة (طلب خاص)" />
                      <input value={detailCustomYear} onChange={(event) => setDetailCustomYear(event.target.value)} className="legacy-input" placeholder="الموديل (سنة)" />
                    </div>
                    {detailCustomType.trim() ? (
                      <div className="legacy-negotiation-box legacy-negotiation-box--info">
                        <div className="legacy-negotiation-box__label">
                          التفاوض لسيارة: (طلب خاص) {detailCustomType.trim()}
                          {detailCustomYear.trim() ? ` - موديل ${detailCustomYear.trim()}` : ""}
                        </div>
                        <textarea
                          value={detailCustomNegotiation}
                          onChange={(event) => setDetailCustomNegotiation(event.target.value)}
                          className="legacy-textarea"
                          rows={3}
                          placeholder="اكتب ما حدث في التفاوض للطلب الخاص..."
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {detailSelectedCars.length > 0 ? (
                  <div className="space-y-3">
                    {detailSelectedCars.map((item) => (
                      <div key={item.id} className="legacy-negotiation-box">
                        <div className="legacy-negotiation-box__label">التفاوض لسيارة: {item.label}</div>
                        <textarea
                          value={detailNegotiations[item.id] ?? ""}
                          onChange={(event) => setDetailNegotiations((current) => ({ ...current, [item.id]: event.target.value }))}
                          className="legacy-textarea"
                          rows={3}
                          placeholder="اكتب ما حدث مع هذه السيارة..."
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                <input
                  name="requested_car"
                  value={requestedCarFromDetails || customer.requested_car || ""}
                  readOnly
                  className="legacy-input"
                  placeholder="سيتم حفظ السيارات المطلوبة هنا..."
                />
              </div>
            ) : (
              <input type="hidden" name="requested_car" value={customer.requested_car ?? ""} />
            )}
          </div>
        </section>

        <section className="legacy-profile-section">
          <div className="legacy-profile-section__title">
            <MessageSquareShare className="h-4 w-4 text-sky-500" />
            إضافة تحديث جديد (ملاحظات السجل):
          </div>
          <textarea
            value={detailUpdateNote}
            onChange={(event) => setDetailUpdateNote(event.target.value)}
            rows={4}
            placeholder="اكتب التفاصيل والملاحظات الجديدة هنا..."
            className="legacy-textarea"
          />
          <input type="hidden" name="note" value={composedNote} />

          <label className="legacy-inline-toggle">
            <input type="checkbox" name="count_as_interaction" checked={countAsInteraction} onChange={(event) => setCountAsInteraction(event.target.checked)} />
            <span>احتساب هذا التحديث كتواصل جديد</span>
            <span className="legacy-inline-toggle__dot" />
          </label>

          <div className="legacy-status-update-box">
            <label className="legacy-label">تحديث الحالة النهائية للعميل</label>
            <select name="status" defaultValue={customer.status} onChange={(event) => setCurrentStatus(event.target.value)} className="legacy-select">
              {options.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {needsInventoryChassis ? (
              <div className="mt-3">
                <label className="legacy-label">اختيار السيارة (الاسم + الشاصي) - إلزامي عند الحجز / تم البيع</label>
                <select name="inventory_id_for_status" className="legacy-select" defaultValue="">
                  <option value="">اختر السيارة / الشاصي</option>
                  {options.inventoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <label className="legacy-label mt-3">تاريخ المراجعة الجديد / الحجز</label>
            <input type="date" name="next_follow_up_at" defaultValue={toDateTimeLocalValue(customer.next_follow_up_at).slice(0, 10)} className="legacy-input" />
          </div>

          <button type="submit" className="legacy-save-strip">
            حفظ التعديلات واعتمادها
          </button>
        </section>

        <section className="legacy-profile-foot">
          <div className="legacy-foot-stat">التفاعلات: {customer.visit_count ?? logCount}</div>
        </section>
      </form>

      {showAlbum && imageAttachments.length > 0 ? (
        <div className="legacy-album-overlay" role="dialog" aria-modal="true">
          <div className="legacy-album-card">
            <button type="button" className="legacy-album-close" onClick={() => setShowAlbum(false)} aria-label="إغلاق">
              <X className="h-5 w-5" />
            </button>
            <div className="legacy-album-head">
              <span>ألبوم المرفقات</span>
              <span>
                {activeImageIndex + 1}/{imageAttachments.length}
              </span>
            </div>
            <div className="legacy-album-body">
              <button type="button" className="legacy-album-arrow" onClick={showPrevImage} aria-label="السابق">
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="legacy-album-image-wrap">
                <img src={imageAttachments[activeImageIndex].public_url ?? ""} alt={imageAttachments[activeImageIndex].file_name ?? "attachment"} className="legacy-album-image" />
                <div className="legacy-album-caption">{imageAttachments[activeImageIndex].file_name ?? "صورة"}</div>
              </div>
              <button type="button" className="legacy-album-arrow" onClick={showNextImage} aria-label="التالي">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
