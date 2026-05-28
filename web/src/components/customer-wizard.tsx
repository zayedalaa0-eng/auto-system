"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Info, ShoppingCart, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { openNewCycleAction, upsertCustomerAction } from "@/app/dashboard/actions";
import { VoiceRecorder } from "@/components/voice-recorder";
import type { CustomerFormOptions } from "@/lib/data";
import { STATUSES_BUYER, STATUSES_BUYER_TRADEIN, STATUSES_SELL_ON_BEHALF } from "@/lib/statuses";

type CustomerWizardProps = {
  options: CustomerFormOptions;
  errorMessage?: string | null;
  /** عميل عائد — الانتقال المباشر للخطوة الثانية */
  initialParentId?: string | null;
  initialFullName?: string | null;
  initialPhone?: string | null;
  initialOpType?: string | null;
  /** المعرض الافتراضي (من ملف العميل الأصلي) */
  initialBranchId?: string | null;
  /** هل المستخدم مدير؟ يحدد صفحة التوجيه عند وجود عميل */
  isManager?: boolean;
};

type InventoryChoice = {
  id: string;
  label: string;
};

type OperationType = "" | "buyer" | "buyer_tradein_pending" | "sell_on_behalf";

const PAYMENT_OPTIONS = ["كاش", "تقسيط / بنك", "تأجير تمويلي", "شيكات شخصية"];

function defaultReminderDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function CustomerWizard({ options, errorMessage, initialParentId, initialFullName, initialPhone, initialOpType, initialBranchId, isManager = false }: CustomerWizardProps) {
  const router = useRouter();
  const currentProfile = options.profile;
  const canChooseBranch = options.capabilities.isGeneralManager;
  const shouldAutoAssignCurrentUser = !options.capabilities.isManager && Boolean(currentProfile?.id);

  // إذا كانت هناك بيانات أولية (دورة جديدة) → ابدأ مباشرةً من الخطوة الثانية
  const isNewCycleMode = Boolean(initialParentId);
  const safeInitialOpType = (initialOpType === "buyer" || initialOpType === "buyer_tradein_pending" || initialOpType === "sell_on_behalf")
    ? initialOpType as OperationType
    : "";

  const [step, setStep] = useState<1 | 3>(isNewCycleMode ? 3 : 1);
  // مرحلة الهاتف: false = إدخال الهاتف فقط، true = إكمال باقي البيانات
  const [phoneConfirmed, setPhoneConfirmed] = useState(isNewCycleMode);
  const [operationType, setOperationType] = useState<OperationType>(isNewCycleMode ? safeInitialOpType : "");
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  type ExistingCustomer = { id: string; full_name: string; status: string };
  const [existingCustomer, setExistingCustomer] = useState<ExistingCustomer | null>(null);

  type ReturningCustomer = {
    id: string;
    full_name: string;
    status: string;
    cycle_number: number;
    operation_type: string;
  };
  const [returningCustomer, setReturningCustomer] = useState<ReturningCustomer | null>(
    isNewCycleMode && initialParentId
      ? { id: initialParentId, full_name: initialFullName ?? "", status: "", cycle_number: 0, operation_type: safeInitialOpType }
      : null
  );

  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [whatsappPrefix, setWhatsappPrefix] = useState("+970");
  const [address, setAddress] = useState("");
  const [branchId, setBranchId] = useState(
    isNewCycleMode && initialBranchId
      ? initialBranchId
      : (currentProfile?.branch_id ?? "")
  );

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
  const [negotiationError, setNegotiationError] = useState("");
  const [useInventory, setUseInventory] = useState(true);
  const [useCustomRequest, setUseCustomRequest] = useState(false);
  const [inventoryToAdd, setInventoryToAdd] = useState("");
  const [selectedCars, setSelectedCars] = useState<InventoryChoice[]>([]);
  const [customType, setCustomType] = useState("");
  const [customYear, setCustomYear] = useState("");
  const [customNegotiation, setCustomNegotiation] = useState("");
  const [negotiations, setNegotiations] = useState<Record<string, string>>({});

  const defaultCustomerStatus = options.statuses.includes("جديد") ? "جديد" : options.statuses[0] ?? "قيد المتابعة";
  const [buyerStatus, setBuyerStatus] = useState<string>(defaultCustomerStatus);
  const [inventoryForStatus, setInventoryForStatus] = useState("");
  const [paymentPlan, setPaymentPlan] = useState("");
  const [followUpDate, setFollowUpDate] = useState(defaultReminderDate());
  const [rejectReason, setRejectReason] = useState("");
  const isSoldStatus =
    buyerStatus.includes("تمت عملية البيع") || buyerStatus === "شراء من قبل المعرض";
  const isReservedStatus = buyerStatus.includes("حجز");
  const isRejectedStatus = buyerStatus.includes("رفض") || buyerStatus.includes("تراجع") || buyerStatus.includes("سحب") || buyerStatus === "إغلاق الملف";
  const [generalNotes, setGeneralNotes] = useState("");
  const statusListForType: string[] =
    operationType === "buyer"
      ? STATUSES_BUYER
      : operationType === "buyer_tradein_pending"
        ? STATUSES_BUYER_TRADEIN
        : operationType === "sell_on_behalf"
          ? STATUSES_SELL_ON_BEHALF
          : options.statuses;

  const workflowType = operationType === "sell_on_behalf" ? "sell" : operationType ? "buy" : "";
  const hasChosenOperation = operationType !== "";
  const showTradeCardSection = operationType === "buyer_tradein_pending" || operationType === "sell_on_behalf";
  const showRequestedCardSection = operationType === "buyer" || operationType === "buyer_tradein_pending";

  // ── فحص الهاتف تلقائياً بعد 600ms من توقف الكتابة ──────────────────────
  useEffect(() => {
    // لا نفحص في وضع الدورة الجديدة أو إذا تم تأكيد الهاتف مسبقاً
    if (isNewCycleMode || phoneConfirmed) return;
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 8) {
      setExistingCustomer(null);
      setPhoneError("");
      return;
    }
    setExistingCustomer(null);
    setPhoneError("");
    setCheckingPhone(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/check-phone?phone=${encodeURIComponent(normalized)}`);
        const payload = await res.json() as {
          exists?: boolean;
          customer?: { id: string; full_name?: string; status?: string } | null;
          returning?: boolean;
          previousCycle?: ReturningCustomer | null;
        };
        if (payload.exists && payload.customer?.id) {
          setExistingCustomer({
            id: payload.customer.id,
            full_name: payload.customer.full_name ?? "عميل موجود",
            status: payload.customer.status ?? "",
          });
        } else if (payload.returning && payload.previousCycle) {
          setReturningCustomer(payload.previousCycle);
          setFullName(payload.previousCycle.full_name);
          // عميل عائد → نؤكد الهاتف وننتقل لباقي البيانات مباشرة
          setPhoneConfirmed(true);
        }
      } catch {
        setPhoneError("تعذر فحص الهاتف، تحقق من الاتصال.");
      } finally {
        setCheckingPhone(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      setCheckingPhone(false);
    };
  }, [phone, phoneConfirmed, isNewCycleMode]);

  // في وضع الدورة الجديدة: منع الإغلاق العرضي للمتصفح قبل الحفظ
  useEffect(() => {
    if (!isNewCycleMode) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isNewCycleMode]);

  useEffect(() => {
    if (!operationType) {
      setHasTradeIn(false);
      setEditRequestedCars(false);
      setBuyerStatus("جديد");
      return;
    }

    if (operationType === "buyer") {
      setHasTradeIn(false);
      setTradeStatus("برسم البيع");
      setBuyerStatus(STATUSES_BUYER[0] ?? "جديد");
      return;
    }

    setHasTradeIn(true);
    if (operationType === "buyer_tradein_pending") {
      setTradeStatus("برسم البيع");
      setBuyerStatus(STATUSES_BUYER_TRADEIN[0] ?? "قيد المتابعة — بانتظار التقييم");
      return;
    }
    setTradeStatus("برسم البيع");
    setBuyerStatus(STATUSES_SELL_ON_BEHALF[0] ?? "عرض سيارة للبيع");
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
      const entries = selectedCars
        .map((item) => {
          const note = (negotiations[item.id] ?? "").trim();
          // اسم السيارة في سطر — التفاوض في السطر التالي
          return `🚗 ${item.label}\n${note || "(بدون تفاصيل تفاوض)"}`;
        });
      if (entries.length > 0) blocks.push(entries.join("\n\n"));
    }

    if (useCustomRequest && customType.trim()) {
      const customLabel = customYear.trim()
        ? `${customType.trim()} - موديل ${customYear.trim()}`
        : customType.trim();
      const customNote = customNegotiation.trim() || "(بدون تفاصيل تفاوض)";
      // طلب خاص: اسم السيارة ثم التفاوض في سطر منفصل
      blocks.push(`🚗 (طلب خاص) ${customLabel}\n${customNote}`);
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

  function handleContinueFromPhoneStep() {
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 8) {
      setPhoneError("أدخل رقم هاتف صحيحاً (8 أرقام على الأقل).");
      return;
    }
    if (existingCustomer) return; // منع المتابعة إذا كان موجوداً
    setPhoneError("");
    setPhoneConfirmed(true);
  }

  function handleContinueFromStepOne() {
    if (fullName.trim().length < 3) {
      setPhoneError("اسم العميل يجب أن يكون 3 أحرف على الأقل.");
      return;
    }
    setPhoneError("");
    setStep(3);
  }

  // حالة إظهار خيار "حفظ كغير مكتمل"
  const [showSaveIncomplete, setShowSaveIncomplete] = useState(false);
  // ref لتتبع ما إذا كنا نحفظ كـ "غير مكتمل" (ref لأن state لا يتحدث قبل submit)
  const incompleteRef = useRef(false);

  function handleFormSubmit(event: React.FormEvent) {
    setNegotiationError("");
    const isIncomplete = incompleteRef.current;

    // المعرض إلزامي للمدير العام دائماً
    if (canChooseBranch && !branchId) {
      event.preventDefault();
      setNegotiationError("⚠️ يجب اختيار المعرض قبل حفظ البيانات.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      incompleteRef.current = false;
      return;
    }

    // إذا لم يُختر نوع العملية ولسنا في وضع "غير مكتمل"
    if (!operationType && !isIncomplete) {
      event.preventDefault();
      setShowSaveIncomplete(true);
      setNegotiationError("يجب اختيار نوع العملية للمتابعة، أو يمكنك حفظ الملف كـ «غير مكتمل» الآن.");
      return;
    }

    // إذا كنا نحفظ كـ "غير مكتمل" → نسمح بالمتابعة بدون قيود إضافية
    if (isIncomplete) {
      incompleteRef.current = false;
      return;
    }

    // التفاوض إجباري لكل سيارة مختارة
    if (showRequestedCardSection && selectedCars.length > 0) {
      const missingCars = selectedCars.filter((item) => !(negotiations[item.id] ?? "").trim());
      if (missingCars.length > 0) {
        event.preventDefault();
        const names = missingCars.map((c) => c.label).join(" / ");
        setNegotiationError(`يرجى إدخال تفاصيل التفاوض لـ: ${names}`);
        document.getElementById("negotiation-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    if (showRequestedCardSection && useCustomRequest && customType.trim() && !customNegotiation.trim()) {
      event.preventDefault();
      setNegotiationError("يرجى إدخال تفاصيل التفاوض للطلب الخاص.");
      document.getElementById("negotiation-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // التحقق: يجب وجود سيارة أو ملاحظات إذا تم اختيار نوع العملية
    if (operationType) {
      const hasCar = selectedCars.length > 0 || (useCustomRequest && customType.trim().length > 0);
      const hasNotes = generalNotes.trim().length > 0;
      if (!hasCar && !hasNotes) {
        event.preventDefault();
        setNegotiationError("يرجى إضافة السيارة المطلوبة أو كتابة ملاحظات قبل الحفظ.");
        document.getElementById("negotiation-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
  }

  function handleSaveIncomplete() {
    incompleteRef.current = true;
    setShowSaveIncomplete(false);
    formRef.current?.requestSubmit();
  }

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={isNewCycleMode ? openNewCycleAction : upsertCustomerAction} className="legacy-wizard-panel" onSubmit={handleFormSubmit}>
      <input type="hidden" name="full_name" value={fullName} />
      <input type="hidden" name="nickname" value={nickname} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="whatsapp_prefix" value={whatsappPrefix} />
      <input type="hidden" name="address" value={address} />
      <input type="hidden" name="branch_id" value={branchId} />
      {shouldAutoAssignCurrentUser ? <input type="hidden" name="assigned_user_id" value={currentProfile?.id ?? ""} /> : null}
      <input type="hidden" name="workflow_type" value={workflowType} />
      {/* في وضع الدورة الجديدة: نضمن إرسال نوع العملية الصحيح حتى لو كان state فارغاً */}
      <input type="hidden" name="operation_type" value={isNewCycleMode ? (operationType || safeInitialOpType || "buyer") : operationType} />
      <input type="hidden" name="requested_car" value={requestedCarText} />
      <input type="hidden" name="notes" value={compiledNotes} />
      <input type="hidden" name="source" value="المعرض" />
      <input type="hidden" name="is_active" value="on" />
      {/* عند الحفظ كـ "غير مكتمل": نمرر حالة خاصة ونوع عملية فارغ */}
      {incompleteRef.current ? <input type="hidden" name="incomplete_save" value="1" /> : null}
      {/* parent_customer_id — أولوية لـ initialParentId (دورة جديدة مباشرة من الملف) ثم returningCustomer (عميل عائد عبر فحص الهاتف) */}
      {initialParentId
        ? <input type="hidden" name="parent_customer_id" value={initialParentId} />
        : returningCustomer?.id
          ? <input type="hidden" name="parent_customer_id" value={returningCustomer.id} />
          : null}

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

      {/* ── بانر الدورة الجديدة ── */}
      {isNewCycleMode && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-2">
          <div className="font-semibold">
            🔄 دورة جديدة للعميل: <span className="font-bold">{initialFullName}</span>
            {" — "}
            أدخل بيانات العملية الجديدة كاملةً ثم احفظ.
          </div>
          {/* منتقي المعرض — للمدير العام فقط */}
          {canChooseBranch && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200">
              <label className="text-xs font-bold text-amber-900 shrink-0">المعرض:</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="legacy-select flex-1 min-w-40 text-sm"
              >
                <option value="">— اختر المعرض —</option>
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              {!branchId && (
                <span className="text-xs font-bold text-rose-600">⚠️ يجب اختيار المعرض</span>
              )}
            </div>
          )}
        </div>
      )}

      {step === 1 && !phoneConfirmed ? (
        /* ── مرحلة 1أ: إدخال الهاتف فقط ── */
        <section className="legacy-section-box">
          <h5 className="legacy-section-title">الخطوة الأولى: رقم الهاتف</h5>

          <div className="space-y-4">
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
                <span className="legacy-label">رقم الهاتف</span>
                <div className="relative">
                  <input
                    autoFocus
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setExistingCustomer(null);
                      setPhoneError("");
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleContinueFromPhoneStep(); } }}
                    className="legacy-input"
                    maxLength={10}
                    placeholder="10 أرقام..."
                    inputMode="numeric"
                  />
                  {checkingPhone && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">⏳</span>
                  )}
                </div>
              </label>
            </div>

            {/* ── العميل موجود مسبقاً ── */}
            {existingCustomer ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 space-y-3">
                <p className="font-bold text-amber-800 text-sm">
                  ⚠️ هذا الرقم مسجل مسبقاً في النظام
                </p>
                <div className="text-sm text-amber-700">
                  <span className="font-semibold">{existingCustomer.full_name}</span>
                  {existingCustomer.status ? <span className="mr-2 text-xs text-amber-600">— {existingCustomer.status}</span> : null}
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    className="legacy-btn legacy-btn-primary flex-1"
                    onClick={() => {
                      const targetPage = isManager ? "/dashboard/management" : "/dashboard/customers";
                      router.push(`${targetPage}?customer=${existingCustomer.id}&mode=view`);
                    }}
                  >
                    فتح ملف العميل
                  </button>
                  <button
                    type="button"
                    className="legacy-btn legacy-btn-secondary"
                    onClick={() => {
                      setPhone("");
                      setExistingCustomer(null);
                      setPhoneError("");
                    }}
                  >
                    رجوع
                  </button>
                </div>
              </div>
            ) : null}

            {phoneError ? <div className="legacy-error-note">{phoneError}</div> : null}

            {!existingCustomer ? (
              <button
                type="button"
                className="legacy-btn legacy-btn-primary legacy-btn-block mt-2"
                onClick={handleContinueFromPhoneStep}
                disabled={checkingPhone || phone.replace(/\D/g, "").length < 8}
              >
                {checkingPhone ? "جاري الفحص..." : "التالي: بيانات العميل"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 1 && phoneConfirmed ? (
        /* ── مرحلة 1ب: باقي بيانات العميل ── */
        <section className="legacy-section-box">
          <h5 className="legacy-section-title">الخطوة الأولى: بيانات العميل الأساسية</h5>

          {/* رقم الهاتف المؤكد — للعرض فقط */}
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2 mb-4">
            <span className="font-bold">✓</span>
            <span>رقم الهاتف: <span className="font-semibold">{phone}</span></span>
          </div>

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
              <input autoFocus value={fullName} onChange={(event) => setFullName(event.target.value)} className="legacy-input" placeholder="اسم العميل (3 أحرف على الأقل)" />
            </label>
            <label className="space-y-2">
              <span className="legacy-label">الكنية / المدينة</span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} className="legacy-input" placeholder="أبو فلان..." />
            </label>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="legacy-label">العنوان</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} className="legacy-input" placeholder="العنوان بالتفصيل" />
          </label>

          {phoneError ? <div className="legacy-error-note">{phoneError}</div> : null}

          <div className="mt-5 grid gap-3 md:grid-cols-[0.25fr_0.75fr]">
            <button
              type="button"
              className="legacy-btn legacy-btn-secondary"
              onClick={() => {
                setPhoneConfirmed(false);
                setPhoneError("");
              }}
            >
              رجوع
            </button>
            <button type="button" className="legacy-btn legacy-btn-primary" onClick={handleContinueFromStepOne}>
              التالي: بيانات الشراء والتفاوض
            </button>
          </div>
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

          {returningCustomer ? (
            <div className="profile-notice profile-notice--warning mt-4">
              <p className="font-semibold text-amber-800">
                عميل عائد — الدورة #{returningCustomer.cycle_number} مغلقة بحالة «{returningCustomer.status}»
              </p>
              <p className="text-sm text-amber-700 mt-1">
                سيتم إنشاء دورة جديدة (#{returningCustomer.cycle_number + 1}) مرتبطة بالسجل السابق تلقائيًا.
              </p>
            </div>
          ) : null}

          <div className="space-y-5 pt-5">
            <div className="legacy-highlight-box legacy-highlight-box--warning">
              <label className="legacy-label">نوع العملية</label>
              {isNewCycleMode ? (
                /* في وضع الدورة الجديدة: القيمة ثابتة من الملف السابق — لا حاجة لـ select */
                <div className="legacy-select bg-amber-50 text-amber-900 font-semibold cursor-default">
                  {operationType === "sell_on_behalf" ? "بيع بالوكالة"
                    : operationType === "buyer_tradein_pending" ? "مشتري + استبدال"
                    : "مشتري"}
                </div>
              ) : (
                <select
                  value={operationType}
                  onChange={(event) => setOperationType(event.target.value as OperationType)}
                  className="legacy-select"
                  required
                >
                  <option value="">اختر نوع العملية</option>
                  <option value="buyer">مشتري</option>
                  <option value="buyer_tradein_pending">مشتري + استبدال</option>
                  <option value="sell_on_behalf">بيع بالوكالة</option>
                </select>
              )}
            </div>

            {showTradeCardSection ? (
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
            ) : null}

            {showRequestedCardSection ? (
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

                {/* السيارات المُضافة — صف خفيف بدون تكرار الـ chip الأزرق */}
                {editRequestedCars && selectedCars.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    {selectedCars.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
                        <span>✔ {item.label}</span>
                        <button
                          type="button"
                          onClick={() => removeInventoryChoice(item.id)}
                          className="mr-2 text-rose-400 hover:text-rose-600 font-bold text-base leading-none"
                          title="إزالة هذه السيارة"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            ) : null}

            {showRequestedCardSection ? (
            <div id="negotiation-section" className="space-y-3">
              <div className="legacy-subpanel-title">
                تفاصيل التفاوض لكل سيارة
                <span className="mr-1 text-rose-500 text-xs font-normal">(إجباري)</span>
              </div>

              {negotiationError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  ⚠️ {negotiationError}
                </div>
              ) : null}

              {selectedCars.map((item) => {
                const isEmpty = !(negotiations[item.id] ?? "").trim();
                return (
                  <div key={item.id} className={`legacy-negotiation-box${isEmpty && negotiationError ? " ring-2 ring-rose-300" : ""}`}>
                    <div className="legacy-negotiation-box__label">التفاوض على:</div>
                    <div className="text-sm font-bold text-blue-700 mb-1">{item.label}</div>
                    <textarea
                      value={negotiations[item.id] ?? ""}
                      onChange={(event) => {
                        setNegotiations((current) => ({ ...current, [item.id]: event.target.value }));
                        if (negotiationError) setNegotiationError("");
                      }}
                      className="legacy-textarea"
                      rows={3}
                      placeholder="اكتب تفاصيل التفاوض (السعر المقترح، الملاحظات...)"
                    />
                    <VoiceRecorder
                      name={`voice_negotiation_${item.id}`}
                      label={`تفاوض - ${item.label}`}
                      onRecorded={(dur) => {
                        setNegotiations((current) => ({
                          ...current,
                          [item.id]: current[item.id]?.trim() ? current[item.id] : dur,
                        }));
                        if (negotiationError) setNegotiationError("");
                      }}
                      onDeleted={() => {
                        setNegotiations((current) => {
                          const val = current[item.id] ?? "";
                          return { ...current, [item.id]: val.startsWith("🎤") ? "" : val };
                        });
                      }}
                    />
                  </div>
                );
              })}

              {useCustomRequest && customType.trim() ? (
                <div className={`legacy-negotiation-box legacy-negotiation-box--info${!customNegotiation.trim() && negotiationError ? " ring-2 ring-rose-300" : ""}`}>
                  <div className="legacy-negotiation-box__label">التفاوض على:</div>
                  <div className="text-sm font-bold text-amber-700 mb-1">
                    (طلب خاص) {customType}{customYear.trim() ? ` - موديل ${customYear}` : ""}
                  </div>
                  <textarea
                    value={customNegotiation}
                    onChange={(event) => {
                      setCustomNegotiation(event.target.value);
                      if (negotiationError) setNegotiationError("");
                    }}
                    className="legacy-textarea"
                    rows={3}
                    placeholder="تفاصيل التفاوض للطلب الخاص..."
                  />
                  <VoiceRecorder
                    name="voice_negotiation_custom"
                    label={`تفاوض - طلب خاص${customType.trim() ? ` (${customType.trim()})` : ""}`}
                    onRecorded={(dur) => {
                      setCustomNegotiation((v) => v.trim() ? v : dur);
                      if (negotiationError) setNegotiationError("");
                    }}
                    onDeleted={() => setCustomNegotiation((v) => v.startsWith("🎤") ? "" : v)}
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
            ) : null}

            <div className="legacy-status-panel">
              <label className="legacy-label">الحالة النهائية للعميل</label>
              <select name="status" value={buyerStatus} onChange={(event) => setBuyerStatus(event.target.value)} className="legacy-select">
                {statusListForType.map((status) => (
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

              {operationType !== "sell_on_behalf" && (isSoldStatus || isReservedStatus) ? (
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

            <div className="block space-y-2">
              <span className="legacy-label">ملاحظات السجل</span>
              <textarea value={generalNotes} onChange={(event) => setGeneralNotes(event.target.value)} className="legacy-textarea" rows={4} placeholder="اكتب التفاصيل والملاحظات الجديدة هنا..." />
              <VoiceRecorder
                name="voice_general_notes"
                label="ملاحظات عامة"
                onRecorded={(dur) => setGeneralNotes((v) => v.trim() ? v : dur)}
                onDeleted={() => setGeneralNotes((v) => v.startsWith("🎤") ? "" : v)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[0.25fr_0.75fr]">
              {isNewCycleMode ? (
                /* في وضع الدورة الجديدة: تحذير قبل الرجوع لأن الدورة لم تُحفظ بعد */
                <button
                  type="button"
                  className="legacy-btn legacy-btn-secondary"
                  onClick={() => {
                    if (window.confirm("⚠️ لم يتم حفظ الدورة الجديدة بعد.\nهل تريد المغادرة والتخلي عن البيانات المدخلة؟")) {
                      router.back();
                    }
                  }}
                >
                  رجوع
                </button>
              ) : (
                <button type="button" className="legacy-btn legacy-btn-secondary" onClick={() => setStep(1)}>
                  رجوع
                </button>
              )}
              <button type="submit" className="legacy-btn legacy-btn-primary">
                حفظ واعتماد العميل
              </button>
            </div>

            {/* ── خيار الحفظ كـ "غير مكتمل" ── */}
            {showSaveIncomplete && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800">
                  ⚠️ لم يتم اختيار نوع العملية
                </p>
                <p className="text-sm text-amber-700">
                  يمكنك اختيار نوع العملية أعلاه، أو حفظ الملف الآن كـ <strong>«غير مكتمل»</strong> وإكماله لاحقاً. سيظهر في الأجندة تذكيراً لإكماله.
                </p>
                <button
                  type="button"
                  className="legacy-btn legacy-btn-block"
                  style={{ background: "#f59e0b", color: "#fff", border: "none" }}
                  onClick={handleSaveIncomplete}
                >
                  💾 حفظ كـ «غير مكتمل» وإكمال لاحقاً
                </button>
              </div>
            )}

            {/* رسالة التحقق العامة */}
            {negotiationError && !showSaveIncomplete ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                ⚠️ {negotiationError}
              </div>
            ) : null}

            {/* تنبيه المعرض للمدير العام */}
            {canChooseBranch && !branchId && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                ⚠️ يجب اختيار المعرض أولاً قبل الحفظ
              </div>
            )}
          </div>
        </section>
      ) : null}
    </form>
  );
}
