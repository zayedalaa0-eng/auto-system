"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Info, ShoppingCart, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { upsertCustomerAction } from "@/app/dashboard/actions";
import type { CustomerFormOptions } from "@/lib/data";

type CustomerWizardProps = {
  options: CustomerFormOptions;
  errorMessage?: string | null;
  successMessage?: string | null;
  savedCustomerId?: string | null;
};

type InventoryChoice = {
  id: string;
  label: string;
};

type OperationType = "buyer" | "buyer_tradein_pending" | "buyer_tradein_evaluated" | "sell_on_behalf";

const PAYMENT_OPTIONS = ["كاش", "تقسيط / بنك", "تأجير تمويلي", "شيكات شخصية"];

function defaultReminderDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function CustomerWizard({ options, errorMessage, successMessage, savedCustomerId }: CustomerWizardProps) {
  const router = useRouter();
  const currentProfile = options.profile;
  const canChooseBranch = options.capabilities.isGeneralManager;
  const shouldAutoAssignCurrentUser = !options.capabilities.isManager && Boolean(currentProfile?.id);

  const [step, setStep] = useState<1 | 3>(1);
  const [operationType, setOperationType] = useState<OperationType>("buyer");
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappPrefix, setWhatsappPrefix] = useState("+970");
  const [address, setAddress] = useState("");
  const [branchId, setBranchId] = useState(currentProfile?.branch_id ?? "");

  const [hasTradeIn, setHasTradeIn] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<string>("استبدال (بانتظار التقييم)");
  const [tradeModel, setTradeModel] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeChassis, setTradeChassis] = useState("");
  const [tradeColor, setTradeColor] = useState("");
  const [tradeYear, setTradeYear] = useState("");
  const [tradeMileage, setTradeMileage] = useState("");
  const [tradeSpecs, setTradeSpecs] = useState("");
  const [tradeInspection, setTradeInspection] = useState("");
  const [tradeLicenseExpiry, setTradeLicenseExpiry] = useState("");
  const [tradeNotes, setTradeNotes] = useState("");
  const [tradeGear, setTradeGear] = useState("اوتوماتيك");
  const [tradeFuel, setTradeFuel] = useState("بنزين");

  const [editRequestedCars, setEditRequestedCars] = useState(false);
  const [useInventory, setUseInventory] = useState(true);
  const [useCustomRequest, setUseCustomRequest] = useState(false);
  const [inventoryToAdd, setInventoryToAdd] = useState("");
  const [selectedCars, setSelectedCars] = useState<InventoryChoice[]>([]);
  const [customType, setCustomType] = useState("");
  const [customYear, setCustomYear] = useState("");
  const [customNegotiation, setCustomNegotiation] = useState("");
  const [negotiations, setNegotiations] = useState<Record<string, string>>({});

  const [buyerStatus, setBuyerStatus] = useState<string>("قيد المتابعة");
  const [inventoryForStatus, setInventoryForStatus] = useState("");
  const [paymentPlan, setPaymentPlan] = useState("");
  const [followUpDate, setFollowUpDate] = useState(defaultReminderDate());
  const [rejectReason, setRejectReason] = useState("");
  const isSoldStatus = buyerStatus.includes("تم البيع");
  const isReservedStatus = buyerStatus.includes("حجز");
  const isRejectedStatus = buyerStatus.includes("رفض");
  const [generalNotes, setGeneralNotes] = useState("");
  const workflowType = operationType === "sell_on_behalf" ? "sell" : "buy";

  useEffect(() => {
    if (operationType === "buyer") {
      setHasTradeIn(false);
      setTradeStatus("شراء السيارة للمعرض");
      return;
    }

    setHasTradeIn(true);
    if (operationType === "buyer_tradein_pending") {
      setTradeStatus("استبدال (بانتظار التقييم)");
      return;
    }
    if (operationType === "buyer_tradein_evaluated") {
      setTradeStatus("استبدال (تمت عملية التقييم)");
      return;
    }
    setTradeStatus("عرض سيارة (برسم البيع)");
  }, [operationType]);

  const requestedCarText = useMemo(() => {
    const labels = selectedCars.map((item) => item.label);
    if (useCustomRequest && customType.trim()) {
      labels.push(customYear.trim() ? `(طلب خاص) ${customType.trim()} - موديل ${customYear.trim()}` : `(طلب خاص) ${customType.trim()}`);
    }
    return labels.join(" | ");
  }, [customType, customYear, selectedCars, useCustomRequest]);

  const showMissingRequestedCarNote = hasTradeIn && tradeStatus.includes("برسم البيع") && !requestedCarText.trim();

  const compiledNotes = useMemo(() => {
    const blocks: string[] = [];

    if (selectedCars.length > 0) {
      const lines = selectedCars
        .map((item) => {
          const note = negotiations[item.id]?.trim();
          return note ? `التفاوض على ${item.label}: ${note}` : "";
        })
        .filter(Boolean);
      if (lines.length > 0) blocks.push(lines.join("\n"));
    }

    if (useCustomRequest && customType.trim()) {
      const customLabel = customYear.trim() ? `${customType.trim()} - موديل ${customYear.trim()}` : customType.trim();
      blocks.push(`طلب خاص: ${customLabel}`);
      if (customNegotiation.trim()) {
        blocks.push(`تفاصيل التفاوض للطلب الخاص: ${customNegotiation.trim()}`);
      }
    }

    if (rejectReason.trim()) blocks.push(`سبب الرفض: ${rejectReason.trim()}`);
    if (tradeNotes.trim()) blocks.push(`ملاحظات سيارة العميل: ${tradeNotes.trim()}`);
    if (generalNotes.trim()) blocks.push(generalNotes.trim());

    return blocks.join("\n\n");
  }, [customNegotiation, customType, customYear, generalNotes, negotiations, rejectReason, selectedCars, tradeNotes, useCustomRequest]);

  function addInventoryChoice() {
    if (!inventoryToAdd) return;
    const item = options.inventoryOptions.find((choice) => choice.id === inventoryToAdd);
    if (!item) return;
    setSelectedCars((current) => (current.some((entry) => entry.id === item.id) ? current : [...current, item]));
    setInventoryToAdd("");
  }

  function removeInventoryChoice(id: string) {
    setSelectedCars((current) => current.filter((item) => item.id !== id));
    setNegotiations((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function handleContinueFromStepOne() {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (fullName.trim().length < 3) {
      setPhoneError("اسم العميل يجب أن يكون 3 أحرف على الأقل.");
      return;
    }
    if (normalizedPhone.length < 8) {
      setPhoneError("أدخل رقم هاتف صحيحًا قبل المتابعة.");
      return;
    }

    setPhoneError("");
    setCheckingPhone(true);
    try {
      const response = await fetch(`/api/customers/check-phone?phone=${encodeURIComponent(normalizedPhone)}`);
      const payload = (await response.json()) as { exists?: boolean; customer?: { id: string } | null };
      if (payload.exists && payload.customer?.id) {
        router.push(`/dashboard/management?customer=${payload.customer.id}&mode=view`);
        return;
      }
      setStep(3);
    } catch {
      setPhoneError("تعذر فحص الهاتف الآن. حاول مرة أخرى.");
    } finally {
      setCheckingPhone(false);
    }
  }

  return (
    <form action={upsertCustomerAction} className="legacy-wizard-panel">
      <input type="hidden" name="full_name" value={fullName} />
      <input type="hidden" name="nickname" value={nickname} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="whatsapp_prefix" value={whatsappPrefix} />
      <input type="hidden" name="address" value={address} />
      <input type="hidden" name="branch_id" value={branchId} />
      {shouldAutoAssignCurrentUser ? <input type="hidden" name="assigned_user_id" value={currentProfile?.id ?? ""} /> : null}
      <input type="hidden" name="workflow_type" value={workflowType} />
      <input type="hidden" name="operation_type" value={operationType} />
      <input type="hidden" name="requested_car" value={requestedCarText} />
      <input type="hidden" name="notes" value={compiledNotes} />
      <input type="hidden" name="source" value="المعرض" />
      <input type="hidden" name="is_active" value="on" />

      <div className="legacy-wizard-head">
        <h4 className="legacy-wizard-title">
          <UserPlus className="h-7 w-7" />
          نظام إدخال وتأسيس العملاء
        </h4>
        <div className="legacy-step-track" aria-label="progress">
          <div className={`legacy-step-indicator ${step === 1 ? "active" : "done"}`}>1</div>
          <div className={`legacy-step-indicator ${step === 3 ? "active" : ""}`}>2</div>
          <div className={`legacy-step-indicator ${step === 3 ? "done" : ""}`}>3</div>
        </div>
      </div>

      {errorMessage ? <div className="legacy-server-error">{errorMessage}</div> : null}
      {step === 1 ? (
        <section className="legacy-section-box">
          <h5 className="legacy-section-title">الخطوة الأولى: بيانات العميل الأساسية</h5>

          {canChooseBranch ? (
            <div className="legacy-highlight-box legacy-highlight-box--warning">
              <label className="legacy-label">
                <Building2 className="h-4 w-4" />
                إسناد العميل إلى معرض
              </label>
              <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="legacy-select">
                <option value="">اختر المعرض</option>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="legacy-label">الاسم الكامل</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="legacy-input" placeholder="اسم العميل (3 أحرف على الأقل)" />
            </label>
            <label className="space-y-2">
              <span className="legacy-label">الكنية / المدينة</span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} className="legacy-input" placeholder="أبو فلان..." />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[0.32fr_0.68fr]">
            <label className="space-y-2">
              <span className="legacy-label">الواتساب</span>
              <select value={whatsappPrefix} onChange={(event) => setWhatsappPrefix(event.target.value)} className="legacy-select">
                <option value="+970">+970</option>
                <option value="+972">+972</option>
                <option value="+962">+962</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="legacy-label">الهاتف</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="legacy-input" maxLength={10} placeholder="10 أرقام..." />
            </label>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="legacy-label">العنوان</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} className="legacy-input" placeholder="العنوان بالتفصيل" />
          </label>

          {phoneError ? <div className="legacy-error-note">{phoneError}</div> : null}

          <button type="button" className="legacy-btn legacy-btn-primary legacy-btn-block mt-5" onClick={handleContinueFromStepOne} disabled={checkingPhone}>
            {checkingPhone ? "جاري الفحص..." : "التالي: بيانات الشراء والتفاوض"}
          </button>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="legacy-section-box">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <h5 className="legacy-section-title mb-0 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              بيانات الشراء والتفاوض
            </h5>
          </div>

          <div className="space-y-5 pt-5">
            <div className="legacy-highlight-box legacy-highlight-box--warning">
              <label className="legacy-label">نوع العملية</label>
              <select
                value={operationType}
                onChange={(event) => setOperationType(event.target.value as OperationType)}
                className="legacy-select"
              >
                <option value="buyer">مشتري</option>
                <option value="buyer_tradein_pending">مشتري + استبدال</option>
                <option value="buyer_tradein_evaluated">استبدال (تمت عملية التقييم)</option>
                <option value="sell_on_behalf">عرض سيارة للبيع</option>
              </select>
            </div>

            <div className="legacy-profile-section legacy-profile-section--soft">
              <div className="legacy-section-headline">
                <div className="legacy-profile-section__title">عرض سيارة العميل (استبدال/برسم البيع)</div>
                <label className="legacy-checkline legacy-checkline--card">
                  <input type="checkbox" name="has_trade_in" checked={hasTradeIn} onChange={(event) => setHasTradeIn(event.target.checked)} />
                  <span>{hasTradeIn ? "تم تفعيل إدخال سيارة العميل" : "تفعيل إدخال سيارة العميل"}</span>
                </label>
              </div>

              {hasTradeIn ? (
                <div className="legacy-subpanel">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="legacy-field xl:col-span-2">
                      <span className="legacy-field__label">نوع السيارة</span>
                      <input name="trade_in_model" value={tradeModel} onChange={(event) => setTradeModel(event.target.value)} className="legacy-input" placeholder="نوع السيارة" />
                    </label>
                    <label className="legacy-field">
                      <span className="legacy-field__label">سعر التقييم ($)</span>
                      <input name="trade_in_price" value={tradePrice} onChange={(event) => setTradePrice(event.target.value)} className="legacy-input" type="number" placeholder="سعر التقييم ($)" />
                    </label>
                    <label className="legacy-field">
                      <span className="legacy-field__label">رقم الشاصي</span>
                      <input name="trade_in_chassis" value={tradeChassis} onChange={(event) => setTradeChassis(event.target.value)} className="legacy-input" placeholder="رقم الشاصي" />
                    </label>
                    <label className="legacy-field">
                      <span className="legacy-field__label">اللون</span>
                      <input name="trade_in_color" value={tradeColor} onChange={(event) => setTradeColor(event.target.value)} className="legacy-input" placeholder="اللون" />
                    </label>
                    <label className="legacy-field">
                      <span className="legacy-field__label">سنة الموديل</span>
                      <input name="trade_in_year" value={tradeYear} onChange={(event) => setTradeYear(event.target.value)} className="legacy-input" type="number" placeholder="الموديل (سنة)" />
                    </label>
                    <label className="legacy-field">
                      <span className="legacy-field__label">العداد</span>
                      <input name="trade_in_mileage" value={tradeMileage} onChange={(event) => setTradeMileage(event.target.value)} className="legacy-input" placeholder="العداد" />
                    </label>
                    <label className="legacy-field xl:col-span-2">
                      <span className="legacy-field__label">المواصفات</span>
                      <input name="trade_in_specs" value={tradeSpecs} onChange={(event) => setTradeSpecs(event.target.value)} className="legacy-input" placeholder="المواصفات" />
                    </label>
                    <label className="legacy-field xl:col-span-2">
                      <span className="legacy-field__label">الفحص</span>
                      <input name="trade_in_inspection" value={tradeInspection} onChange={(event) => setTradeInspection(event.target.value)} className="legacy-input" placeholder="الفحص" />
                    </label>
                    <label className="legacy-field">
                      <span className="legacy-field__label">ناقل الحركة</span>
                      <select name="trade_in_gear" value={tradeGear} onChange={(event) => setTradeGear(event.target.value)} className="legacy-select">
                        <option value="اوتوماتيك">اوتوماتيك</option>
                        <option value="يدوي">يدوي</option>
                      </select>
                    </label>
                    <label className="legacy-field">
                      <span className="legacy-field__label">نوع الوقود</span>
                      <select name="trade_in_fuel" value={tradeFuel} onChange={(event) => setTradeFuel(event.target.value)} className="legacy-select">
                        <option value="بنزين">بنزين</option>
                        <option value="سولار">سولار</option>
                        <option value="هايبرد">هايبرد</option>
                        <option value="كهربائية بالكامل">كهربائية بالكامل</option>
                        <option value="بلِك أن">بلِك أن</option>
                      </select>
                    </label>
                    <label className="legacy-field">
                      <span className="legacy-field__label">تاريخ انتهاء الرخصة</span>
                      <input name="trade_in_license_expiry" value={tradeLicenseExpiry} onChange={(event) => setTradeLicenseExpiry(event.target.value)} className="legacy-input" type="date" />
                    </label>
                    <input type="hidden" name="trade_in_status" value={tradeStatus} />
                    <label className="legacy-field">
                      <span className="legacy-field__label">حالة السيارة في المعرض</span>
                      <div className="legacy-input flex items-center">{tradeStatus}</div>
                    </label>
                    <label className="legacy-field xl:col-span-4">
                      <span className="legacy-field__label">ملاحظات سيارة العميل</span>
                      <textarea name="trade_in_notes" value={tradeNotes} onChange={(event) => setTradeNotes(event.target.value)} className="legacy-textarea" rows={3} placeholder="ملاحظات سيارة العميل..." />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="legacy-label">صور</label>
                      <input type="file" name="trade_files_photos" className="legacy-input" accept="image/*,.pdf" multiple />
                    </div>
                    <div>
                      <label className="legacy-label">فحص</label>
                      <input type="file" name="trade_files_inspection" className="legacy-input" accept="image/*,.pdf" multiple />
                    </div>
                    <div>
                      <label className="legacy-label">رخصة</label>
                      <input type="file" name="trade_files_license" className="legacy-input" accept="image/*,.pdf" multiple />
                    </div>
                    <div>
                      <label className="legacy-label">تأمين</label>
                      <input type="file" name="trade_files_insurance" className="legacy-input" accept="image/*,.pdf" multiple />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="legacy-info-note">
                  <Info className="h-4 w-4" />
                  فعّل خيار سيارة العميل لإدخال بيانات الاستبدال/برسم البيع.
                </div>
              )}
            </div>

            <div className="legacy-profile-section legacy-profile-section--outlined">
              <div className="legacy-section-headline">
                <div className="legacy-profile-section__title">السيارة المطلوبة للعميل</div>
                <label className="legacy-checkline legacy-checkline--card">
                  <input type="checkbox" checked={editRequestedCars} onChange={(event) => setEditRequestedCars(event.target.checked)} />
                  <span>{editRequestedCars ? "إغلاق تعديل السيارة المطلوبة" : "تفعيل تعديل السيارة المطلوبة"}</span>
                </label>
              </div>

              <div className="legacy-request-box">
                <div className="legacy-request-chip">{requestedCarText || "بدون سيارات محددة"}</div>
                {showMissingRequestedCarNote ? (
                  <div className="legacy-highlight-box legacy-highlight-box--warning mt-3">
                    لا توجد سيارة مطلوبة للعميل مرتبطة بهذا الملف.
                  </div>
                ) : null}

                {editRequestedCars ? (
                  <div className="mt-4 space-y-3">
                    <label className="legacy-checkline legacy-checkline--card">
                      <input type="checkbox" checked={useInventory} onChange={(event) => setUseInventory(event.target.checked)} />
                      <span>اختيار سيارة مطلوبة من المخزون المتوفر</span>
                    </label>

                    {useInventory ? (
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <select className="legacy-select" value={inventoryToAdd} onChange={(event) => setInventoryToAdd(event.target.value)}>
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

                    <label className="legacy-checkline legacy-checkline--card">
                      <input type="checkbox" checked={useCustomRequest} onChange={(event) => setUseCustomRequest(event.target.checked)} />
                      <span>إدخال سيارة غير متوفرة حاليًا (طلب خاص)</span>
                    </label>

                    {useCustomRequest ? (
                      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                        <input value={customType} onChange={(event) => setCustomType(event.target.value)} className="legacy-input" placeholder="نوع السيارة (مثال: كيا بيكانتو)" />
                        <input value={customYear} onChange={(event) => setCustomYear(event.target.value)} className="legacy-input" type="number" placeholder="الموديل (سنة)" />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selectedCars.length > 0 ? (
                  <div className="legacy-chip-row mt-3">
                    {selectedCars.map((item) => (
                      <button key={item.id} type="button" className="legacy-chip" onClick={() => removeInventoryChoice(item.id)}>
                        {item.label}
                        <span className="legacy-chip-x">×</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="legacy-subpanel-title">تفاصيل التفاوض لكل سيارة</div>
              {selectedCars.map((item) => (
                <div key={item.id} className="legacy-negotiation-box">
                  <div className="legacy-negotiation-box__label">التفاوض على: {item.label}</div>
                  <textarea
                    value={negotiations[item.id] ?? ""}
                    onChange={(event) => setNegotiations((current) => ({ ...current, [item.id]: event.target.value }))}
                    className="legacy-textarea"
                    rows={3}
                    placeholder="اكتب تفاصيل التفاوض..."
                  />
                </div>
              ))}
              {useCustomRequest && customType.trim() ? (
                <div className="legacy-negotiation-box legacy-negotiation-box--info">
                  <div className="legacy-negotiation-box__label">
                    التفاوض على: (طلب خاص) {customType}
                    {customYear.trim() ? ` - موديل ${customYear}` : ""}
                  </div>
                  <textarea
                    value={customNegotiation}
                    onChange={(event) => setCustomNegotiation(event.target.value)}
                    className="legacy-textarea"
                    rows={3}
                    placeholder="تفاصيل التفاوض للطلب الخاص..."
                  />
                </div>
              ) : null}
              {selectedCars.length === 0 && !(useCustomRequest && customType.trim()) ? (
                <div className="legacy-info-note">
                  <Info className="h-4 w-4" />
                  عند اختيار سيارة مطلوبة ستظهر هنا تفاصيل التفاوض.
                </div>
              ) : null}
            </div>

            <div className="legacy-status-panel">
              <label className="legacy-label">الحالة النهائية للعميل</label>
              <select name="status" value={buyerStatus} onChange={(event) => setBuyerStatus(event.target.value)} className="legacy-select">
                {options.statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              {isSoldStatus ? (
                <select name="payment_plan" value={paymentPlan} onChange={(event) => setPaymentPlan(event.target.value)} className="legacy-select mt-3">
                  <option value="">اختر آلية الدفع...</option>
                  {PAYMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : null}

              {isRejectedStatus ? (
                <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="legacy-input mt-3" placeholder="سبب الرفض..." />
              ) : null}

              {(isSoldStatus || isReservedStatus) ? (
                <>
                  <label className="legacy-label mt-3">اختيار الشاصي (إلزامي)</label>
                  <select name="inventory_id_for_status" value={inventoryForStatus} onChange={(event) => setInventoryForStatus(event.target.value)} className="legacy-select" required>
                    <option value="">اختر السيارة / الشاصي</option>
                    {options.inventoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              <label className="legacy-label mt-3">تاريخ المراجعة الجديد / الحجز</label>
              <input name="next_follow_up_at" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className="legacy-input" type="date" />
            </div>

            <label className="block space-y-2">
              <span className="legacy-label">ملاحظات السجل</span>
              <textarea value={generalNotes} onChange={(event) => setGeneralNotes(event.target.value)} className="legacy-textarea" rows={4} placeholder="اكتب التفاصيل والملاحظات الجديدة هنا..." />
            </label>

            <div className="grid gap-3 md:grid-cols-[0.25fr_0.75fr]">
              <button type="button" className="legacy-btn legacy-btn-secondary" onClick={() => setStep(1)}>
                رجوع
              </button>
              <button type="submit" className="legacy-btn legacy-btn-primary">
                حفظ واعتماد العميل
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </form>
  );
}
