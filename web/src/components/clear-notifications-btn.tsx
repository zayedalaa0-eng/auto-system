"use client";

import { clearNotificationsCenterAction } from "@/app/dashboard/actions";

export function ClearNotificationsBtn() {
  return (
    <form
      action={clearNotificationsCenterAction}
      onSubmit={(e) => {
        if (!confirm("هل تريد حذف جميع التنبيهات؟ لا يمكن التراجع عن هذا.")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="legacy-btn legacy-btn-secondary">
        حذف الكل
      </button>
    </form>
  );
}
