"use client";

import { useId, useState } from "react";

type InventoryOption = {
  id: string;
  label: string;
  chassis_no?: string | null;
  category?: "showroom" | "customer";
};

export function RequestedCarField({
  defaultValue,
  inventoryOptions,
}: {
  defaultValue: string;
  inventoryOptions: InventoryOption[];
}) {
  const [value, setValue] = useState(defaultValue);
  const selectId = useId();

  const showroomOptions = inventoryOptions.filter((o) => o.category !== "customer");
  const customerOptions = inventoryOptions.filter((o) => o.category === "customer");

  return (
    <label className="space-y-2 md:col-span-2">
      <span className="text-sm font-medium text-slate-700">السيارة المطلوبة</span>
      <input
        name="requested_car"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="اكتب يدوياً أو اختر من القائمة بالأسفل"
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white"
      />
      <select
        id={selectId}
        value=""
        onChange={(event) => {
          if (event.target.value) setValue(event.target.value);
          event.target.value = "";
        }}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-sky-300"
      >
        <option value="">— اختر سيارة من المخزون لتعبئة الحقل أعلاه —</option>
        {showroomOptions.length > 0 && (
          <optgroup label={`🏢 مخزون المعرض (${showroomOptions.length})`}>
            {showroomOptions.map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
          </optgroup>
        )}
        {customerOptions.length > 0 && (
          <optgroup label={`👤 مخزون العملاء (${customerOptions.length})`}>
            {customerOptions.map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
