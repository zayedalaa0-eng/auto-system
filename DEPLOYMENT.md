# Auto System Apps Script Deployment

## الملفات

- `Code.gs`: كود الخادم والبوت وربط Google Sheets وGoogle Drive وTelegram.
- `MiniApp.html`: واجهة Telegram Web App المختصرة.
- `Dashboard.html`: لوحة التحكم الكاملة.
- `appsscript.json`: صلاحيات وتشغيل مشروع Google Apps Script.

## طريقة التركيب

1. ارفع `cars.xlsx` إلى Google Drive.
2. افتحه بواسطة Google Sheets حتى يتحول إلى ملف Google Sheet.
3. من داخل ملف Google Sheet افتح `Extensions > Apps Script`.
4. أنشئ أو استبدل ملف الخادم بمحتوى `Code.gs`.
5. أنشئ ملف HTML باسم `MiniApp` وضع داخله محتوى `MiniApp.html`.
6. أنشئ ملف HTML باسم `Dashboard` وضع داخله محتوى `Dashboard.html`.
7. افتح إعدادات المشروع وفعل عرض ملف manifest، ثم ضع محتوى `appsscript.json`.
8. عدل القيم داخل `CONFIG` في `Code.gs` عند الحاجة:
   - `DRIVE_FOLDER_ID`
   - `WEB_APP_URL`
   - `TELEGRAM_TOKEN`
   - `MANAGER_CHAT_ID`
9. انشر المشروع كـ Web App بصلاحية تنفيذ باسمك، ووصول `Anyone`.
10. بعد أخذ رابط النشر الجديد، حدّث `WEB_APP_URL` ثم شغل دالة `setupWebhook` مرة واحدة.
11. افتح الداشبورد من رابط الويب آب بهذه الصيغة:
    `WEB_APP_URL?page=Dashboard`

> ملاحظة: إذا كان السكربت مربوطًا مباشرة بملف Google Sheet الناتج من `cars.xlsx`، سيستخدمه النظام تلقائيًا. إذا كان السكربت مستقلًا، سيستخدم الرابط الموجود في `CONFIG.SHEET_URL`.

## طريقة بديلة

1. افتح مشروع Google Apps Script المرتبط بملف Google Sheet.
2. أنشئ أو استبدل ملف الخادم بمحتوى `Code.gs`.
3. أنشئ ملف HTML باسم `MiniApp` وضع داخله محتوى `MiniApp.html`.
4. أنشئ ملف HTML باسم `Dashboard` وضع داخله محتوى `Dashboard.html`.
5. افتح إعدادات المشروع وفعل عرض ملف manifest، ثم ضع محتوى `appsscript.json`.
6. عدل القيم داخل `CONFIG` في `Code.gs` عند الحاجة:
   - `SHEET_URL`
   - `DRIVE_FOLDER_ID`
   - `WEB_APP_URL`
   - `TELEGRAM_TOKEN`
   - `MANAGER_CHAT_ID`
7. انشر المشروع كـ Web App بصلاحية تنفيذ باسمك، ووصول `Anyone`.
8. بعد أخذ رابط النشر الجديد، حدّث `WEB_APP_URL` ثم شغل دالة `setupWebhook` مرة واحدة.

## صفحات Google Sheet المطلوبة

- `customers`
- `inventory`
- `staff`
- `settings`
- `notifications`

صفحة `notifications` يتم إنشاؤها تلقائيًا إذا لم تكن موجودة.
