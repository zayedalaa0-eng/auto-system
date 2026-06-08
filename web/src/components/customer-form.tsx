import { Save, UserPlus } from "lucide-react";

import { upsertCustomerAction } from "@/app/dashboard/actions";
import type { CustomerDetail, CustomerFormOptions } from "@/lib/data";
import { toDateTimeLocalValue } from "@/lib/format";

type CustomerFormProps = {
  customer?: CustomerDetail | null;
  options: CustomerFormOptions;
  returnPath?: string;
};

export function CustomerForm({ customer, options, returnPath }: CustomerFormProps) {
  const canChooseBranch = options.capabilities.isGeneralManager;
  const currentProfile = options.profile;
  const effectiveBranchId = customer?.branch_id ?? currentProfile?.branch_id ?? "";
  const shouldAutoAssignCurrentUser = !options.capabilities.isManager && Boolean(currentProfile?.id);
  const primaryTradeIn = customer?.tradeIns[0] ?? null;
  // اختيار قائمة الحالات بناءً على نوع العملية المخزن في metadata
  const operationType = (customer?.metadata?.operation_type as string | undefined) ?? "buyer";
  const statusList = options.statusesByType[operationType as keyof typeof options.statusesByType] ?? options.statuses;
  const branchScopedStaff = customer?.branch_id
    ? options.staff.filter((item) => item.branch_id === customer.branch_id || item.branch_id === null)
    : options.staff;

  return (
    <form action={upsertCustomerAction} className="space-y-6">
      {customer ? <input type="hidden" name="customer_id" value={customer.id} /> : null}
      {returnPath ? <input type="hidden" name="return_to" value={returnPath} /> : null}
      {primaryTradeIn ? <input type="hidden" name="trade_in_id" value={primaryTradeIn.id} /> : null}
      {!canChooseBranch ? <input type="hidden" name="branch_id" value={effectiveBranchId} /> : null}
      {shouldAutoAssignCurrentUser ? <input type="hidden" name="assigned_user_id" value={currentProfile?.id ?? ""} /> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{customer ? "تعديل ملف العميل" : "عميل جديد"}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              {customer ? "تحديث الملف دون الخروج من التشغيل" : "فتح ملف جديد جاهز للمتابعة والأجندة"}
            </h2>
          </div>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {customer ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {customer ? "حفظ التعديلات" : "إنشاء الملف"}
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <h3 className="text-lg font-semibold text-slate-950">بيانات العميل الأساسية</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">الاسم الكامل</span>
                <input
                  name="full_name"
                  required
                  defaultValue={customer?.full_name ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">رقم الهاتف</span>
                <input
                  name="phone"
                  required
                  defaultValue={customer?.phone ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">الاسم المختصر</span>
                <input
                  name="nickname"
                  defaultValue={customer?.nickname ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">مصدر العميل</span>
                <select
                  name="source"
                  defaultValue={customer?.source ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                >
                  <option value="">اختر المصدر</option>
                  {options.sources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">العنوان</span>
                <input
                  name="address"
                  defaultValue={customer?.address ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <h3 className="text-lg font-semibold text-slate-950">تشغيل الملف</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {canChooseBranch ? (
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">الفرع</span>
                  <select
                    name="branch_id"
                    defaultValue={customer?.branch_id ?? ""}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                  >
                    <option value="">بدون فرع</option>
                    {options.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">الفرع</span>
                  <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900">
                    {options.branches.find((branch) => branch.id === effectiveBranchId)?.name ?? customer?.branch_name ?? "معرضك الحالي"}
                  </div>
                </div>
              )}

              {shouldAutoAssignCurrentUser ? (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">الموظف المسؤول</span>
                  <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900">
                    {currentProfile?.full_name ?? customer?.assigned_user_name ?? "المستخدم الحالي"}
                  </div>
                </div>
              ) : (
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">الموظف المسؤول</span>
                  <select
                    name="assigned_user_id"
                    defaultValue={customer?.assigned_user_id ?? ""}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                  >
                    <option value="">بدون تعيين</option>
                    {branchScopedStaff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} - {member.role}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">الحالة</span>
                <select
                  name="status"
                  defaultValue={customer?.status ?? "قيد المتابعة"}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                >
                  {statusList.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">خطة الدفع</span>
                <input
                  name="payment_plan"
                  defaultValue={customer?.payment_plan ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">السيارة المطلوبة</span>
                <input
                  name="requested_car"
                  defaultValue={customer?.requested_car ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">بادئة واتساب</span>
                <input
                  name="whatsapp_prefix"
                  defaultValue={customer?.whatsapp_prefix ?? "+970"}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">موعد المتابعة القادم</span>
                <input
                  type="datetime-local"
                  name="next_follow_up_at"
                  defaultValue={toDateTimeLocalValue(customer?.next_follow_up_at ?? null)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">آخر تواصل</span>
                <input
                  type="datetime-local"
                  name="last_contact_at"
                  defaultValue={toDateTimeLocalValue(customer?.last_contact_at ?? null)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={customer?.is_active ?? true}
                  className="h-4 w-4 accent-sky-600"
                />
                <span className="text-sm font-medium text-slate-700">الملف نشط وقابل للظهور في التشغيل اليومي</span>
              </label>
            </div>
          </div>

          <div className="rounded-[26px] border border-sky-200 bg-sky-50/70 p-6 shadow-[0_16px_36px_rgba(14,116,144,0.07)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-950">سيارة العميل / ملف الاستبدال</h3>
              <label className="flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-800">
                <input
                  type="checkbox"
                  name="has_trade_in"
                  value="on"
                  defaultChecked={primaryTradeIn?.is_active ?? false}
                  className="h-4 w-4 accent-sky-600"
                />
                السيارة مفعلة داخل الملف
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 xl:col-span-2">
                <span className="text-sm font-medium text-slate-700">النوع والموديل</span>
                <input
                  name="trade_in_model"
                  defaultValue={primaryTradeIn?.model ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">رقم الشاصي</span>
                <input
                  name="trade_in_chassis"
                  defaultValue={primaryTradeIn?.chassis_no ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">سعر التقييم</span>
                <input
                  type="number"
                  name="trade_in_price"
                  defaultValue={primaryTradeIn?.price ?? undefined}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">اللون</span>
                <input
                  name="trade_in_color"
                  defaultValue={primaryTradeIn?.color ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">سنة التصنيع</span>
                <input
                  type="number"
                  name="trade_in_year"
                  defaultValue={primaryTradeIn?.production_year ?? undefined}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">العداد</span>
                <input
                  type="number"
                  name="trade_in_mileage"
                  defaultValue={primaryTradeIn?.mileage ?? undefined}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">تاريخ انتهاء الرخصة</span>
                <input
                  type="date"
                  name="trade_in_license_expiry"
                  defaultValue={primaryTradeIn?.license_expiry ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>

              <label className="space-y-2 xl:col-span-2">
                <span className="text-sm font-medium text-slate-700">المواصفات</span>
                <input
                  name="trade_in_specs"
                  defaultValue={primaryTradeIn?.specs ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>

              <label className="space-y-2 xl:col-span-2">
                <span className="text-sm font-medium text-slate-700">الفحص</span>
                <input
                  name="trade_in_inspection"
                  defaultValue={primaryTradeIn?.inspection ?? ""}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>

              <input name="trade_in_status" type="hidden" value={primaryTradeIn?.status ?? "استبدال (بانتظار التقييم)"} />

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">ناقل الحركة</span>
                <select
                  name="trade_in_gear"
                  defaultValue={typeof primaryTradeIn?.metadata?.gear === "string" ? primaryTradeIn.metadata.gear : "اتوماتيك"}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                >
                  <option value="اتوماتيك">اتوماتيك</option>
                  <option value="يدوي">يدوي</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">نوع الوقود</span>
                <select
                  name="trade_in_fuel"
                  defaultValue={typeof primaryTradeIn?.metadata?.fuel === "string" ? primaryTradeIn.metadata.fuel : "بنزين"}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition focus:border-sky-300"
                >
                  <option value="بنزين">بنزين</option>
                  <option value="ديزل">ديزل</option>
                  <option value="هايبرد">هايبرد</option>
                  <option value="كهربائية بالكامل">كهربائية بالكامل</option>
                  <option value="بلك أن">بلك أن</option>
                </select>
              </label>

              <label className="space-y-2 xl:col-span-4">
                <span className="text-sm font-medium text-slate-700">ملاحظات سيارة العميل</span>
                <textarea
                  name="trade_in_notes"
                  rows={4}
                  defaultValue={primaryTradeIn?.notes ?? ""}
                  className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-300"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <h3 className="text-lg font-semibold text-slate-950">ملاحظات الملف</h3>
            <div className="mt-5 space-y-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">ملاحظات تشغيلية</span>
                <textarea
                  name="notes"
                  rows={6}
                  defaultValue={customer?.notes ?? ""}
                  className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">ملاحظات المرفقات</span>
                <textarea
                  name="attachment_notes"
                  rows={5}
                  defaultValue={customer?.attachment_notes ?? ""}
                  className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-[var(--panel-soft)] p-6 shadow-[0_16px_36px_rgba(15,23,42,0.04)]">
            <h3 className="text-lg font-semibold text-slate-950">ملخص سريع</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>الملف سيبقى داخل نفس مسار الجدول أو النافذة المنبثقة بعد الحفظ، ولن يكسر تجربة التشغيل اليومية.</p>
              <p>سيارة العميل أصبحت جزءًا من نفس شاشة التعديل، حتى نقترب من منطق الداشبورد الأصلية بدل توزيع بيانات الصفقة على أماكن متفرقة.</p>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
}
