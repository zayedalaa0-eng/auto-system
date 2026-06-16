"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CAR_MAKES } from "@/lib/suggestions";

type Branch = { id: string; name: string };

const DEAL_TYPES = ["شراء", "استبدال", "برسم البيع"];
const CONDITION_LABELS = ["جديدة", "مستعملة", "شبه جديدة"];
const GEARBOX_OPTIONS = ["اتوماتيك", "يدوي"];
const FUEL_OPTIONS = ["بنزين", "ديزل", "هايبرد", "كهربائية بالكامل", "بلك أن"];
const STATUS_OPTIONS = ["متوفرة", "محجوزة", "مباعة"];

export function AddInventoryForm({
  isGeneralManager,
  branches,
  branchId,
  employeeBranchName,
}: {
  isGeneralManager: boolean;
  branches: Branch[];
  branchId: string | null;
  employeeBranchName?: string | null;
}) {
  const router = useRouter();

  const [model,           setModel]          = useState("");
  const [year,            setYear]           = useState("");
  const [color,           setColor]          = useState("");
  const [price,           setPrice]          = useState("");
  const [chassis,         setChassis]        = useState("");
  const [mileage,         setMileage]        = useState("");
  const [gearbox,         setGearbox]        = useState("اتوماتيك");
  const [fuel,            setFuel]           = useState("بنزين");
  const [condition,       setCondition]      = useState("مستعملة");
  const [dealType,        setDealType]       = useState("شراء");
  const [status,          setStatus]         = useState("متوفرة");
  const [ownerName,       setOwnerName]      = useState(employeeBranchName ?? "");
  const [specs,           setSpecs]          = useState("");
  const [inspection,      setInspection]     = useState("");
  const [notes,           setNotes]          = useState("");
  const [selectedBranch,  setSelectedBranch] = useState(branchId ?? "");

  // تعبئة حقل المالك تلقائياً باسم معرض المدير العام عند اختياره — فقط إذا لم يُعدّله المستخدم يدوياً
  const lastAutoOwner = useRef(employeeBranchName ?? "");
  useEffect(() => {
    if (!isGeneralManager) return;
    const branchName = branches.find((b) => b.id === selectedBranch)?.name ?? "";
    if (ownerName === lastAutoOwner.current) {
      setOwnerName(branchName);
      lastAutoOwner.current = branchName;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const consign = dealType === "برسم البيع";
  const isValid = model.trim() && chassis.trim() && (!consign || ownerName.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!model.trim()) { setError("نوع السيارة مطلوب"); return; }
    if (!chassis.trim()) { setError("رقم الشاصي مطلوب"); return; }
    if (consign && !ownerName.trim()) { setError("اسم المالك مطلوب عند اختيار برسم البيع"); return; }
    setSaving(true); setError(null);

    const res = await fetch("/api/inventory/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.trim(),
        production_year: year ? Number(year) : null,
        color: color.trim() || null,
        price: price ? Number(price) : null,
        chassis_no: chassis.trim() || null,
        mileage: mileage ? Number(mileage) : null,
        gearbox, fuel_type: fuel,
        condition_label: condition,
        deal_type: dealType,
        availability_status: status,
        owner_name: ownerName.trim() || null,
        specs: specs.trim() || null,
        inspection: inspection.trim() || null,
        notes: notes.trim() || null,
        branch_id: isGeneralManager ? (selectedBranch || null) : null,
      }),
    });

    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "حدث خطأ"); return; }

    setSuccess(true);
    // إعادة تعيين الحقول
    setModel(""); setYear(""); setColor(""); setPrice(""); setChassis("");
    setMileage(""); setOwnerName(lastAutoOwner.current); setSpecs(""); setInspection(""); setNotes("");
    setGearbox("اتوماتيك"); setFuel("بنزين"); setCondition("مستعملة");
    setDealType("شراء"); setStatus("متوفرة");
    setTimeout(() => setSuccess(false), 3000);
    router.refresh();
  }

  const labelClass = "block text-xs font-semibold text-slate-500 mb-1";
  const inputClass = "legacy-input w-full";

  return (
    <form onSubmit={handleSubmit} className="legacy-card flex flex-col gap-5">

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700">
          ✅ تم إضافة السيارة بنجاح! يمكنك إضافة سيارة أخرى.
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {/* نوع الصفقة */}
      <div>
        <label className={labelClass}>نوع الصفقة</label>
        <div className="flex flex-wrap gap-2">
          {DEAL_TYPES.map(d => (
            <button key={d} type="button"
              onClick={() => setDealType(d)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
                dealType === d
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
              }`}
            >{d}</button>
          ))}
        </div>
      </div>

      {/* البيانات الأساسية */}
      <div className="grid gap-4 sm:grid-cols-2">

        <div className="sm:col-span-2">
          <label className={labelClass}>نوع السيارة *</label>
          <input value={model} onChange={e => setModel(e.target.value)}
            className={inputClass} placeholder="مثال: تويوتا كامري"
            list="inv-cars-list" autoComplete="off" required />
          <datalist id="inv-cars-list">
            {CAR_MAKES.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label className={labelClass}>سنة الصنع</label>
          <input type="number" value={year} onChange={e => setYear(e.target.value)}
            className={inputClass} placeholder="2022" min={1990} max={2030} />
        </div>

        <div>
          <label className={labelClass}>السعر (₪)</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)}
            className={inputClass} placeholder="0" min={0} />
        </div>

        <div>
          <label className={labelClass}>رقم الشاصي *</label>
          <input value={chassis} onChange={e => setChassis(e.target.value)}
            className={`${inputClass}${!chassis.trim() ? " border-rose-300" : ""}`}
            placeholder="مطلوب" dir="ltr" required />
        </div>

        <div>
          <label className={labelClass}>اللون</label>
          <input value={color} onChange={e => setColor(e.target.value)}
            className={inputClass} placeholder="أبيض، أسود..." />
        </div>

        <div>
          <label className={labelClass}>العداد (كم)</label>
          <input type="number" value={mileage} onChange={e => setMileage(e.target.value)}
            className={inputClass} placeholder="0" min={0} />
        </div>

        <div>
          <label className={labelClass}>المالك {consign && <span className="text-rose-500">*</span>}</label>
          <input value={ownerName} onChange={e => setOwnerName(e.target.value)}
            className={`${inputClass}${consign && !ownerName.trim() ? " border-rose-300" : ""}`}
            placeholder={consign ? "مطلوب عند برسم البيع" : "اختياري"} />
        </div>

        <div>
          <label className={labelClass}>الحالة</label>
          <select value={condition} onChange={e => setCondition(e.target.value)} className={inputClass}>
            {CONDITION_LABELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>ناقل الحركة</label>
          <select value={gearbox} onChange={e => setGearbox(e.target.value)} className={inputClass}>
            {GEARBOX_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>نوع الوقود</label>
          <select value={fuel} onChange={e => setFuel(e.target.value)} className={inputClass}>
            {FUEL_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>حالة التوفر</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* المعرض — للمدير العام فقط */}
        {isGeneralManager && branches.length > 0 && (
          <div>
            <label className={labelClass}>المعرض</label>
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className={inputClass}>
              <option value="">— اختر المعرض —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={labelClass}>المواصفات</label>
          <input value={specs} onChange={e => setSpecs(e.target.value)}
            className={inputClass} placeholder="اختياري" />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>الفحص</label>
          <input value={inspection} onChange={e => setInspection(e.target.value)}
            className={inputClass} placeholder="اختياري" />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>ملاحظات</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            className={inputClass} rows={2} placeholder="اختياري" />
        </div>
      </div>

      {/* أزرار */}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => router.push("/dashboard/inventory")}
          className="legacy-btn border flex-1">
          إلغاء
        </button>
        <button type="submit" disabled={saving || !isValid}
          className="legacy-btn legacy-btn-primary flex-[2]">
          {saving ? "⏳ جاري الحفظ..." : "✅ إضافة السيارة"}
        </button>
      </div>

    </form>
  );
}
