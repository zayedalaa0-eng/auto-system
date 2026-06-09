# 🚗 نظام إدارة معارض السيارات — مجموعة المعلم

توثيق شامل للمشروع: المعمارية، الميزات، النشر، والصيانة.

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [التقنيات المستخدمة](#التقنيات-المستخدمة)
3. [هيكل المشروع](#هيكل-المشروع)
4. [قاعدة البيانات](#قاعدة-البيانات)
5. [الأدوار والصلاحيات](#الأدوار-والصلاحيات)
6. [الميزات الرئيسية](#الميزات-الرئيسية)
7. [بوت تيليجرام والمني-آب](#بوت-تيليجرام-والمني-آب)
8. [المهام المجدولة (Cron)](#المهام-المجدولة-cron)
9. [متغيرات البيئة](#متغيرات-البيئة)
10. [النشر والصيانة](#النشر-والصيانة)
11. [إدارة المستخدمين](#إدارة-المستخدمين)
12. [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## نظرة عامة

نظام متكامل لإدارة معارض السيارات يخدم عدة فروع، يتيح:
- إدارة العملاء ومتابعتهم (مشتري / استبدال / بيع بالوكالة)
- إدارة مخزون السيارات لكل معرض
- تقارير وإحصائيات يومية
- بوت تيليجرام مع تطبيقات مصغّرة (Mini-Apps) للموظفين
- إشعارات فورية ومجدولة

**الدومين الرئيسي:** `https://auto-system-1982.vercel.app`

---

## التقنيات المستخدمة

| الطبقة | التقنية |
|--------|---------|
| **Framework** | Next.js 16 (App Router) + Turbopack |
| **اللغة** | TypeScript |
| **التنسيق** | Tailwind CSS + CSS مخصص |
| **قاعدة البيانات** | Supabase (PostgreSQL) |
| **المصادقة** | Supabase Auth |
| **التخزين** | Supabase Storage (صور السيارات والمرفقات) |
| **الاستضافة** | Vercel |
| **البوت** | Telegram Bot API + Web Apps |
| **Excel** | مكتبة xlsx (توليد client-side) |

---

## هيكل المشروع

```
auto-system/
├── web/                          # تطبيق Next.js الرئيسي
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/         # لوحة التحكم (الويب)
│   │   │   │   ├── customers/     # العملاء + تقرير عملائي
│   │   │   │   ├── inventory/     # المخزون (+ /new, /[id]/edit)
│   │   │   │   ├── management/    # الإدارة
│   │   │   │   ├── staff/         # الموظفون
│   │   │   │   ├── branches/      # المعارض
│   │   │   │   ├── search/        # البحث
│   │   │   │   ├── notifications/ # التنبيهات
│   │   │   │   └── layout.tsx     # الشريط الجانبي + الأجندة
│   │   │   ├── bot-app/           # تطبيقات المني-آب (تيليجرام)
│   │   │   │   ├── customer/      # بطاقة العميل
│   │   │   │   ├── add-customer/  # إضافة عميل
│   │   │   │   ├── agenda/        # الأجندة
│   │   │   │   ├── search/        # البحث
│   │   │   │   ├── inventory-add/ # إضافة سيارة
│   │   │   │   ├── send-message/  # إرسال رسالة لموظف
│   │   │   │   └── eval-card/     # بطاقة التقييم
│   │   │   └── api/
│   │   │       ├── bot-app/       # واجهات المني-آب
│   │   │       ├── inventory/     # add, update, delete, export, import, template
│   │   │       ├── customers/     # search, check-phone, export
│   │   │       ├── reports/       # daily-morning, overdue-escalation
│   │   │       └── telegram/      # webhook, setup
│   │   ├── components/            # مكوّنات React
│   │   ├── lib/
│   │   │   ├── data.ts            # استعلامات قاعدة البيانات
│   │   │   ├── roles.ts           # الأدوار والصلاحيات
│   │   │   ├── statuses.ts        # حالات العملاء
│   │   │   ├── format.ts          # تنسيق التواريخ والعملة
│   │   │   ├── suggestions.ts     # قوائم المدن والسيارات
│   │   │   ├── supabase/          # عملاء Supabase
│   │   │   └── telegram/          # api, handlers, push, queries
│   │   └── app/globals.css        # التنسيقات العامة
│   ├── next.config.ts
│   └── vercel.json                # المهام المجدولة
└── supabase/                      # ملفات SQL (migrations)
    ├── 001_initial_schema.sql
    ├── 002_enable_rls.sql
    └── ...
```

---

## قاعدة البيانات

### الجداول الرئيسية

| الجدول | الوصف |
|--------|-------|
| `branches` | المعارض/الفروع |
| `app_users` | الموظفون والمديرون |
| `customers` | العملاء |
| `trade_ins` | سيارات الاستبدال / البيع بالوكالة |
| `inventory` | مخزون السيارات |
| `customer_attachments` | المرفقات (صور، تسجيلات صوتية) |
| `customer_logs` | السجل التاريخي لكل عميل |
| `reminders` | التذكيرات والمتابعات |
| `notifications` | الإشعارات داخل النظام |
| `car_requests` | طلبات السيارات |
| `audit_logs` | سجل العمليات |
| `price_history` | تاريخ تغيّر الأسعار |

### حقول `customers` المهمة
- `full_name`, `phone`, `nickname`, `address`, `whatsapp_prefix`
- `status`, `operation_type`, `requested_car`
- `next_follow_up_at`, `last_contact_at`, `visit_count`
- `branch_id`, `assigned_user_id`, `is_active`
- `metadata` (jsonb): `operation_type_code`, `deal_value`, `payment_method`, `selected_inventory_id`

### حقول `inventory` المهمة
- `model`, `chassis_no`, `color`, `production_year`, `mileage`
- `price`, `gearbox`, `fuel_type`, `condition_label`
- `deal_type` (شراء / استبدال / برسم البيع), `availability_status`
- `owner_name`, `branch_id`, `source_customer_id`

---

## الأدوار والصلاحيات

تُحدَّد في `src/lib/roles.ts`:

| الدور (role) | الصلاحية |
|--------------|----------|
| `مدير عام` / `general_manager` | يرى كل الفروع، كل البيانات |
| `مدير معرض` / `manager` | يرى فرعه فقط |
| `موظف مبيعات` / `employee` | عملاء فرعه |

### دالة الكشف
```typescript
getRoleCapabilities(role, full_name)
// تُرجع: { isGeneralManager, isManager }
```

تقبل الأسماء العربية والإنجليزية للتوافق.

### RLS (Row Level Security)
- `app_users` له SELECT + UPDATE فقط — **الإضافة تتم عبر admin client** (service role)
- باقي الجداول مقيّدة بالفرع عبر دوال `current_user_branch_id()` و`is_manager()`

---

## الميزات الرئيسية

### 1. إدارة العملاء
- **3 أنواع عمليات:** مشتري / مشتري + استبدال / بيع بالوكالة
- السيارة المطلوبة (اختيار من المخزون أو طلب خاص + تفاوض)
- سيارة الاستبدال بحقول كاملة + صور
- السجل التاريخي لكل تغيير
- التذكيرات والمتابعات

### 2. المخزون
- **تبويبان:** 🏢 مخزون المعرض | 👤 مخزون العملاء
- **تعديل inline:** السعر، الشاصي، اللون، العداد، القير، الوقود (بأيقونة قلم عند المرور)
- إضافة سيارة واحدة (ويب + مني-آب) — متاح لجميع الموظفين
- تعديل/حذف من صفحة مستقلة أو من بطاقة السيارة
- استيراد Excel + قالب جاهز
- **تصدير** Excel/PDF مع فلاتر (متوفرة/محجوزة/مباعة/مسحوبة/ناقصة)
- دائرة/ليبل ملوّن لكل لون سيارة

#### معرض المعلم (خاص)
- يرى افتراضياً سيارات فرعه + سيارات المعارض الأخرى **برسم البيع فقط**
- سيارات عملاء المعارض الأخرى تظهر في تبويب "مخزون العملاء"

### 3. التقارير
- **تقرير عملائي / الإدارة:** جدول بأعمدة (المعرض/الموظف، العميل، السيارة، الحالة، آخر تواصل، الإجراءات)
- فلاتر ذكية + بحث
- تصدير Excel/PDF (كل/نشطون/مغلقون)

### 4. الإشعارات
- إشعار المدير عند إضافة/تحديث عميل (مع السجل التاريخي + زر مراسلة الموظف)
- الموظف يُشعر الموظف المسؤول أو مدير الفرع (مع معاينة الرسالة قبل الإرسال)

### 5. التواريخ والأرقام
- جميع التواريخ بصيغة **DD/MM/YYYY** ميلادية (أرقام لاتينية)
- العملة بالشيقل (₪) بأرقام إنجليزية

---

## بوت تيليجرام والمني-آب

### الرسالة الترحيبية (`/start`)
تعرض: الاسم، الصلاحية (مدير عام/مدير معرض/موظف)، اسم المعرض.

### أزرار القائمة
`📅 الأجندة | 👥 عملائي | 🔍 بحث | 👤 بطاقة عميل | 📦 المخزون | 🔔 تنبيهاتي`
- للمديرين: `📊 التقرير | 📢 رسالة للموظفين | 👨‍💼 الموظفون`
- لمدير المعلم: `🔍 طلبات التقييم`

### المني-آب (صفحات تفاعلية داخل تيليجرام)
| الصفحة | المسار |
|--------|--------|
| بطاقة العميل | `/bot-app/customer` |
| إضافة عميل | `/bot-app/add-customer` |
| الأجندة | `/bot-app/agenda` |
| البحث | `/bot-app/search` |
| إضافة سيارة | `/bot-app/inventory-add` |
| إرسال رسالة | `/bot-app/send-message` |
| بطاقة التقييم | `/bot-app/eval-card` |

### إعداد الـ Webhook
```
https://auto-system-1982.vercel.app/api/telegram/setup?key=auto-system-secret-2025
```

### ميزات المني-آب
- إضافة عميل: حقول منفصلة (الكنية، المدينة) + مقدمة واتساب + autocomplete للمدن والسيارات
- بطاقة العميل: رابط واتساب مباشر، قيمة الصفقة، السجل بلون مميز
- مجلد الصور دائماً مرئي داخل قسم سيارة العميل
- أزرار "✅ تم" للتذكيرات في الأجندة

---

## المهام المجدولة (Cron)

في `web/vercel.json`:

```json
{
  "crons": [
    { "path": "/api/reports/daily-morning",      "schedule": "0 5 * * *" },
    { "path": "/api/reports/overdue-escalation",  "schedule": "0 9 * * *" }
  ]
}
```

| المهمة | التوقيت (UTC) | الوصف |
|--------|---------------|-------|
| `daily-morning` | 5:00 (8 ص فلسطين) | تقرير صباحي للمديرين والموظفين + زر الأجندة |
| `overdue-escalation` | 9:00 (12 ظ فلسطين) | تنبيه المتابعات المتأخرة + رخص المخزون المنتهية خلال 7 أيام |

**مهم:** Vercel Cron يرسل **GET** — الـ routes تُصدّر `GET` و`POST` معاً، مؤمّنة بـ `Authorization: Bearer {CRON_SECRET}`.

---

## متغيرات البيئة

تُضبط في Vercel (Settings → Environment Variables) لـ **All Environments**:

| المتغير | الوصف |
|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | المفتاح العام |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح الخدمة (admin) |
| `NEXT_PUBLIC_APP_URL` | `https://auto-system-1982.vercel.app` |
| `TELEGRAM_BOT_TOKEN` | توكن البوت |
| `TELEGRAM_SETUP_KEY` | مفتاح الحماية الخاص برابط الإعداد (Webhook setup URL key) |
| `TELEGRAM_WEBHOOK_SECRET` | المعرّف السري للتحقق من طلبات webhook وتأمينها (إلزامي في الإنتاج) |
| `CRON_SECRET` | سر المهام المجدولة (Sensitive) |

---

## النشر والصيانة

### النشر التلقائي
```bash
git add -A
git commit -m "..."
git push          # Vercel يبني تلقائياً على الدومين الرئيسي
```

### النشر اليدوي (من مجلد الجذر — وليس web)
```bash
cd auto-system        # المجلد الجذر
vercel --prod
```
> ⚠️ Vercel مضبوط على Root Directory = `web`، فشغّل الأمر من الجذر لا من `web`.

### ملاحظة OneDrive
البناء المحلي قد يفشل بخطأ `EPERM: unlink .next/...` بسبب قفل OneDrive — هذا **لا يؤثر** على بناء Vercel (يبني على Linux). التحقق من الأنواع يكفي:
```bash
cd web && npm run build   # ✓ Compiled successfully
```

---

## إدارة المستخدمين

### إضافة موظف (SQL)
```sql
INSERT INTO public.app_users (full_name, role, branch_id, status, is_active, metadata)
VALUES (
  'اسم الموظف',
  'موظف مبيعات',                                       -- أو 'مدير معرض' / 'مدير عام'
  (SELECT id FROM public.branches WHERE name ILIKE '%اسم المعرض%' LIMIT 1),
  'active', true,
  jsonb_build_object('invite_email', 'email@example.com')
);
```
> المدير العام: `branch_id = NULL`

### إنشاء حساب دخول وربطه
1. **Supabase → Authentication → Users → Add user** (Email + Password + Auto Confirm)
2. ربط الحساب:
```sql
UPDATE public.app_users
SET auth_user_id = 'USER_UID_من_Auth'
WHERE full_name = 'اسم الموظف';
```

### تغيير كلمة المرور (SQL)
```sql
UPDATE auth.users
SET encrypted_password = crypt('كلمة_السر_الجديدة', gen_salt('bf'))
WHERE email = 'email@example.com';
```

### تفريغ البيانات التجريبية (مع الحفاظ على المعارض والموظفين)
```sql
TRUNCATE TABLE
  public.bot_sessions, public.audit_logs, public.notifications,
  public.car_requests, public.customer_logs, public.customer_attachments,
  public.reminders, public.trade_ins, public.customers,
  public.inventory, public.price_history
CASCADE;
```

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| **زر الأجندة لا يستجيب** | تأكد من `getAgendaData` لا يرمي خطأ — يوجد try-catch |
| **CRON_SECRET لا يعمل** | تأكد أن الـ route يُصدّر `GET` (Vercel يرسل GET) |
| **فشل بناء Vercel — متغيرات Supabase** | تأكد أن المتغيرات على "All Environments" وليس Production فقط |
| **prerender error /dashboard** | `export const dynamic = "force-dynamic"` في layout |
| **violates RLS على app_users** | استخدم `admin` client للإضافة |
| **فشل التصدير 500** | xlsx يُولَّد client-side الآن (API يُرجع JSON) |
| **التحديثات لا تظهر** | `vercel --prod` من الجذر + `Ctrl+Shift+R` |
| **تعديل inline لا يُحفظ** | الـ route يدعم partial update (حقل واحد) |

---

## ملاحظات تقنية مهمة

1. **التوقيت:** كل حسابات "اليوم" بتوقيت UTC+3 (فلسطين)
2. **تصفير المتابعة:** عند حفظ عميل، إذا كان `next_follow_up_at` اليوم أو الماضي → يُصفَّر (يختفي من الأجندة)
3. **تحويل ملكية الاستبدال:** "شراء من قبل المعرض" → `deal_type = "شراء"` + `owner_name = اسم المعرض`
4. **الألوان:** خريطة ألوان عربية في `inventory-inline-edit.tsx` (فيراني = رمادي مخضر #7a8a7a)
5. **callback_data:** محدود بـ 64 بايت في تيليجرام — نُخزّن المعرّفات فقط

---

*آخر تحديث: يونيو 2026*
🤖 نظام المعرض الذكي — مجموعة المعلم للسيارات
