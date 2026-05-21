// ╔══════════════════════════════════════════════════════════════════╗

// ║ أوتو سيستم ERP v9.0 - النسخة المستقرة والمطورة بالكامل ║

// ╚══════════════════════════════════════════════════════════════════╝

const CONFIG = {

TELEGRAM_TOKEN: "8747814363:AAFzLUhI2edVJSwzeP0kKDQlpAugNdCqd8o",

DRIVE_FOLDER_ID: "1H90ZJfRJ5VRdLuWPsn7Z30x_Kymg2kF6",

MANAGER_CHAT_ID: "1307035068",

SHEET_URL: "https://docs.google.com/spreadsheets/d/18qtlMdEe3rMSEt3DZLBv8Kr4dISoDmmJnAJYMEjNp_Q/edit",

WEB_APP_URL: "https://script.google.com/macros/s/AKfycbwXaNWm2n6pyeB770MjvvyObMh2aso_7oaWzDRiPoCdaMKwm6FPztSVfTcg8i_h8deX/exec",

CACHE_DURATION: 900,

TIMEZONE: "GMT+3",

MAX_REPORT_ITEMS: 25,

MAX_FILE_SIZE: 25 * 1024 * 1024,

TELEGRAM_API_BASE: "https://api.telegram.org/bot"

};

const SHEETS = { CUSTOMERS: "customers", INVENTORY: "inventory", STAFF: "staff", SETTINGS: "settings", NOTIFICATIONS: "notifications", AUDIT_LOG: "audit_log", CUSTOMER_LOGS: "customer_logs", REQUESTS: "requests", PRICE_HISTORY: "price_history", BOT_LOGS: "bot_logs" };

const STATUS = { SOLD: "تم البيع ✅", FOLLOW_UP: "قيد المتابعة ⏳", RESERVED: "حجز السيارة 🕒", REJECTED_CLIENT: "الرفض من قبل العميل ❌", REJECTED_COMPANY: "الرفض من قبل الشركة ⛔", INACTIVE: "العميل غير فعال" };

function getDatabaseSpreadsheet() {

try {

const active = SpreadsheetApp.getActiveSpreadsheet();

if (active) return active;

} catch (e) {}

return SpreadsheetApp.openByUrl(CONFIG.SHEET_URL);

}

function getScriptCacheSafe() {
try {
return CacheService.getScriptCache();
} catch (e) {
return null;
}
}

function getScriptPropertiesSafe() {
try {
return PropertiesService.getScriptProperties();
} catch (e) {
return null;
}
}

function getDataVersionKey(name) {
return `DATA_VERSION_${String(name || "").toUpperCase()}`;
}

function getDataVersion(name) {
const props = getScriptPropertiesSafe();
if (!props) return "1";
return props.getProperty(getDataVersionKey(name)) || "1";
}

function bumpDataVersion(names) {
const props = getScriptPropertiesSafe();
if (!props) return;
const keys = Array.isArray(names) ? names : [names];
keys.forEach(function(name) {
if (!name) return;
const propKey = getDataVersionKey(name);
const current = parseInt(props.getProperty(propKey) || "1", 10);
props.setProperty(propKey, String(current + 1));
});
}

function buildCacheKey(group, suffix) {
return ["autosys", group, getDataVersion(group), suffix || "default"].join(":");
}

function getCachedJson(key) {
const cache = getScriptCacheSafe();
if (!cache) return null;
try {
const raw = cache.get(key);
return raw ? JSON.parse(raw) : null;
} catch (e) {
return null;
}
}

function putCachedJson(key, value, ttlSeconds) {
const cache = getScriptCacheSafe();
if (!cache) return value;
try {
cache.put(key, JSON.stringify(value), ttlSeconds || CONFIG.CACHE_DURATION);
} catch (e) {}
return value;
}

function withVersionedCache(group, suffix, ttlSeconds, producer) {
const key = buildCacheKey(group, suffix);
const cached = getCachedJson(key);
if (cached !== null) return cached;
const value = producer();
return putCachedJson(key, value, ttlSeconds);
}

function getCachedStaffRows() {
return withVersionedCache("staff", "rows", CONFIG.CACHE_DURATION, function() {
const sheet = getSheet(SHEETS.STAFF);
return sheet ? sheet.getDataRange().getValues() : [];
});
}

function getCachedRoomList() {
return withVersionedCache("settings", "rooms", CONFIG.CACHE_DURATION, function() {
const sheet = getSheet(SHEETS.SETTINGS);
if (!sheet) return [];
return sheet.getRange("A2:A").getValues().filter(function(row) {
return row[0] !== "";
}).map(function(row) {
return row[0];
});
});
}

function getUserScopeKey(identifier, staffInfo) {
if (isGeneralManager(identifier, staffInfo)) return "gm";
if (!staffInfo) return "anonymous";
return [
String(staffInfo.role || "").trim(),
String(staffInfo.room || "").trim(),
String(staffInfo.name || "").trim()
].join("|");
}

function getCustomerPhoneIndex() {
return withVersionedCache("customers", "phone-index", CONFIG.CACHE_DURATION, function() {
const sheet = getSheet(SHEETS.CUSTOMERS);
if (!sheet) return {};
const data = sheet.getDataRange().getValues();
const index = {};
for (let i = 1; i < data.length; i++) {
const phone = String(data[i][4] || "").trim();
if (!phone) continue;
index[phone] = i + 1;
const normalized = phone.replace(/^'/, "");
if (normalized) index[normalized] = i + 1;
}
return index;
});
}

// ==========================================

// الدوال المساعدة والأساسية

// ==========================================

function checkAndCreateSheet(sheetName) {

const ss = getDatabaseSpreadsheet();

let sheet = ss.getSheetByName(sheetName);

if (!sheet) {

sheet = ss.insertSheet(sheetName);

if (sheetName === SHEETS.NOTIFICATIONS) { sheet.appendRow(["Timestamp", "TargetRoleOrRoom", "Message", "Status"]);
sheet.getRange("A1:D1").setFontWeight("bold"); }

if (sheetName === SHEETS.AUDIT_LOG) { sheet.appendRow(["Timestamp", "Actor", "Role", "Action", "Entity", "EntityId", "Details"]);
sheet.getRange("A1:G1").setFontWeight("bold"); }

if (sheetName === SHEETS.CUSTOMER_LOGS) { sheet.appendRow(["Timestamp", "CustomerRowId", "CustomerName", "Actor", "Action", "NextFollowUp", "Details"]);
sheet.getRange("A1:G1").setFontWeight("bold"); }

if (sheetName === SHEETS.REQUESTS) { sheet.appendRow(["Timestamp", "CustomerName", "Phone", "RequestedCar", "Budget", "Source", "Status", "Owner"]);
sheet.getRange("A1:H1").setFontWeight("bold"); }

if (sheetName === SHEETS.PRICE_HISTORY) { sheet.appendRow(["Timestamp", "CarModel", "Chassis", "OldPrice", "NewPrice", "Actor", "Reason"]);
sheet.getRange("A1:G1").setFontWeight("bold"); }

if (sheetName === SHEETS.BOT_LOGS) { sheet.appendRow(["Timestamp", "ChatId", "Kind", "Text", "Details"]);
sheet.getRange("A1:E1").setFontWeight("bold"); }

}

return sheet;

}

function normalizeNumbers(str) { return !str ? "" : String(str).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim(); }

function stripStatusCarId(status) {
return String(status || "").replace(/\s*\(ID:\s*[^)]+\)\s*/gi, "").trim();
}

function extractCarIdFromText(value) {
const match = String(value || "").match(/\(ID:\s*([^)]+)\)/i);
return match ? normalizeNumbers(match[1]) : "";
}

function buildStatusWithCarId(status, carId) {
const cleanStatus = stripStatusCarId(status);
const cleanId = normalizeNumbers(carId);
return cleanId ? `${cleanStatus} (ID: ${cleanId})` : cleanStatus;
}

function isLegacyCustomerCarStatus(status) {
const s = String(status || "");
return s.includes("السيارة معروضة") ||
       s.includes("معروضة للبيع من قبل العميل") ||
       s.includes("تم بيع السيارة") ||
       s.includes("تراجع الزبون") ||
       s.includes("تراجع العميل عن البيع") ||
       s.includes("شراء السيارة للمعرض");
}

function mapLegacyCustomerCarStatus(status) {
const s = String(status || "");
if (s.includes("تم بيع السيارة")) return "تم بيع السيارة لعميل خارجي";
if (s.includes("تراجع الزبون") || s.includes("تراجع العميل عن البيع")) return "تراجع العميل عن البيع";
if (s.includes("شراء السيارة للمعرض")) return "شراء السيارة للمعرض";
return "عرض سيارة (برسم البيع)";
}

function buildLegacyCustomerCarTradeIn(rowData) {
if (!rowData || !isLegacyCustomerCarStatus(rowData[9])) return null;
const rawCar = String(rowData[5] || "").trim();
const model = rawCar.replace(/\s*\(ID:\s*[^)]+\)\s*/gi, "").trim();
if (!model || model === "-") return null;
return {
active: true,
model: model,
price: "",
id: extractCarIdFromText(rawCar),
color: "",
year: "",
mileage: "",
specs: "",
inspection: "",
status: mapLegacyCustomerCarStatus(rowData[9]),
condition: "مستعملة",
dealType: "برسم البيع",
owner: rowData[3] || "",
licenseExp: "",
notes: "تم تحويل هذا السجل من آلية البائع القديمة إلى بند سيارة العميل."
};
}

function getTradeInClosureReason(status) {
const s = String(status || "");
if (s.includes(STATUS.INACTIVE)) return "إغلاق بطاقة سيارة العميل";
if (s.includes("شراء السيارة للمعرض") || s.includes("تم شراء السيارة للمعرض")) return "تم شراء سيارة العميل للمعرض";
if (s.includes("تم بيع السيارة لعميل خارجي") || s.includes("تم بيع السيارة")) return "تم بيع سيارة العميل لزبون خارجي";
if (s.includes("تراجع العميل عن البيع") || s.includes("تراجع الزبون")) return "تراجع العميل عن بيع السيارة";
if (s.includes("رفض من قبل المعرض") || s.includes("الرفض من قبل المعرض") || s.includes("الرفض من قبل الشركة")) return "رفض المعرض سيارة العميل";
if (s.includes("تم الاتفاق والاستبدال")) return "تمت صفقة استبدال";
return "";
}

function shouldCloseCustomerFromStatus(status) {
const s = String(status || "");
return s.includes("تم البيع") || s.includes("الرفض من قبل المعرض") || s === STATUS.INACTIVE;
}

function getCustomerClosureReasonFromStatus(status) {
const s = String(status || "");
if (s === STATUS.INACTIVE) return "إغلاق ملف العميل";
if (s.includes("الرفض من قبل المعرض")) return "رفض المعرض العملية";
if (s.includes("تم البيع")) return "تم بيع سيارة للعميل";
return "";
}

function buildArchivedTradeIn(tradeIn, reason, actorName, closedAt) {
const archived = Object.assign({}, tradeIn || {});
archived.active = false;
archived.archived = true;
archived.closed = true;
archived.closedAt = closedAt || "";
archived.closedBy = actorName || "";
archived.closureReason = reason || getTradeInClosureReason(archived.status);
archived.previousStatus = archived.status || "";
return archived;
}

function getSheet(sheetName) {

try {

let sheet = getDatabaseSpreadsheet().getSheetByName(sheetName);

if (!sheet && [SHEETS.NOTIFICATIONS, SHEETS.AUDIT_LOG, SHEETS.CUSTOMER_LOGS, SHEETS.REQUESTS, SHEETS.PRICE_HISTORY, SHEETS.BOT_LOGS].indexOf(sheetName) !== -1) sheet = checkAndCreateSheet(sheetName);

return sheet || null;

} catch (e) { return null; }

}

function logAudit(actor, role, action, entity, entityId, details) {

try {

const sheet = checkAndCreateSheet(SHEETS.AUDIT_LOG);

sheet.appendRow([new Date(), actor || "-", role || "-", action || "-", entity || "-", entityId || "-", details || "-"]);

} catch (e) {}

}

function logCustomerAction(rowId, customerName, actor, action, nextFollowUp, details) {

try {

const sheet = checkAndCreateSheet(SHEETS.CUSTOMER_LOGS);

sheet.appendRow([new Date(), rowId || "-", customerName || "-", actor || "-", action || "-", nextFollowUp || "-", details || "-"]);

} catch (e) {}

}

function ensureSystemSheets() {

[SHEETS.NOTIFICATIONS, SHEETS.AUDIT_LOG, SHEETS.CUSTOMER_LOGS, SHEETS.REQUESTS, SHEETS.PRICE_HISTORY, SHEETS.BOT_LOGS].forEach(function(name) {

checkAndCreateSheet(name);

});

return { success: true, msg: "تم تجهيز صفحات النظام بنجاح" };

}

function formatArabicDate(dateObj, formatStr) {

if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime()))
return "غير محدد";

return Utilities.formatDate(dateObj, CONFIG.TIMEZONE, formatStr).replace("AM", "ص").replace("PM", "م");

}

function uploadFileToDrive(base64Data, fileName, mimeType) {
  if (!base64Data || !fileName) return "";
  try {
    let cleanBase64 = base64Data;
    if (base64Data.includes(",")) { cleanBase64 = base64Data.split(",")[1]; }
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType || "application/octet-stream", fileName);
    const file = folder.createFile(blob);

    // إضافة إجبارية لصلاحيات العرض لتظهر الصورة للمستخدم
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}

    return file.getUrl();
  } catch (e) {
    Logger.log("Drive Upload Error: " + e.message);
    return "";
  }
}

function formatCustomerDataForWeb(rowData, rowIndex) {

let rawDate = new Date(rowData[0]);

if (isNaN(rawDate.getTime())) rawDate = new Date();

let lastContactDate = rawDate;

if (rowData[15] && rowData[15] !== "-") {

let parsed = new Date(rowData[15]);

if (!isNaN(parsed.getTime())) lastContactDate = parsed;

}

let tradeInObj = null;

if (rowData[16] && String(rowData[16]).trim().startsWith("{")) { try { tradeInObj = JSON.parse(rowData[16]); } catch(e) {} }

if ((!tradeInObj || !tradeInObj.active) && isLegacyCustomerCarStatus(rowData[9])) {
tradeInObj = buildLegacyCustomerCarTradeIn(rowData);
}

let safeResDate = "-";

if (rowData[13] && rowData[13] !== "-") {

if (rowData[13] instanceof Date && !isNaN(rowData[13].getTime())) {

safeResDate = Utilities.formatDate(rowData[13], CONFIG.TIMEZONE, "yyyy-MM-dd");

} else {

let strDate = String(rowData[13]).trim();

if (strDate.match(/^\d{2}-\d{2}-\d{4}$/)) {

let p = strDate.split('-'); safeResDate = `${p[2]}-${p[1]}-${p[0]}`;

} else if (strDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {

let p = strDate.split('/'); safeResDate = `${p[2]}-${p[1]}-${p[0]}`;

} else { safeResDate = strDate.substring(0, 10); }

}

}

const selectedCarId = (isLegacyCustomerCarStatus(rowData[9]) || String(rowData[9] || "").includes(STATUS.INACTIVE)) ? "" : (extractCarIdFromText(rowData[9]) || extractCarIdFromText(rowData[5]));

return {

id: rowIndex, timestamp: rawDate.getTime(), date: formatArabicDate(rawDate, "yyyy/MM/dd hh:mm a"),

lastContactTs: lastContactDate.getTime(), lastContactStr: formatArabicDate(lastContactDate, "yyyy/MM/dd hh:mm a"),

room: String(rowData[1] || "").trim(), empName: String(rowData[2] || "").trim(), custName: rowData[3] || "",

phone: rowData[4] || "", car: rowData[5] || "", payment: rowData[6] || "", photos: rowData[7] || "-",

agreement: rowData[8] || "", status: rowData[9] || STATUS.FOLLOW_UP, nickname: rowData[10] || "",

address: rowData[11] || "-", waPrefix: rowData[12] || "+970", resDate: safeResDate, visits: rowData[14] || 1, tradeInObj: tradeInObj,

selectedCarId: selectedCarId, selectedCarLabel: selectedCarId ? `${rowData[5] || "السيارة المحددة"} | شاصي: ${selectedCarId}` : ""

};

}

// ==========================================

// دوال تيليجرام والإشعارات

// ==========================================

function sendTextSafe(chatId, text) {

if (!chatId || !text) return false;

try {

const url = `${CONFIG.TELEGRAM_API_BASE}${CONFIG.TELEGRAM_TOKEN}/sendMessage`;

const options = { method: "post", payload: { chat_id: chatId.toString(), text: text.substring(0, 4000), parse_mode: "Markdown" }, muteHttpExceptions: true };

return JSON.parse(UrlFetchApp.fetch(url, options).getContentText()).ok;

} catch (e) { return false; }

}

function sendKeyboard(chatId, text, keys) {

if (!chatId || !text) return false;

try {

let kb = [];

if (Array.isArray(keys)) { if (Array.isArray(keys[0])) kb = keys; else kb = [keys]; }

const payload = { chat_id: chatId.toString(), text: text.substring(0, 4000), parse_mode: "Markdown", reply_markup: JSON.stringify({ keyboard: kb, resize_keyboard: true }) };

UrlFetchApp.fetch(`${CONFIG.TELEGRAM_API_BASE}${CONFIG.TELEGRAM_TOKEN}/sendMessage`, { method: "post", payload: payload, muteHttpExceptions: true });

return true;

} catch (e) { return false; }

}

function sendTextWithInline(chatId, text, inlineKeys) {

if (!chatId || !text) return false;

try {

const payload = { chat_id: chatId.toString(), text: text.substring(0, 4000), parse_mode: "Markdown", reply_markup: JSON.stringify({ inline_keyboard: inlineKeys }) };

UrlFetchApp.fetch(`${CONFIG.TELEGRAM_API_BASE}${CONFIG.TELEGRAM_TOKEN}/sendMessage`, { method: "post", payload: payload, muteHttpExceptions: true });

return true;

} catch (e) { return false; }

}

function logBotEvent(chatId, kind, text, details) {
try {
const sheet = checkAndCreateSheet(SHEETS.BOT_LOGS);
let detailText = "-";
if (details !== undefined && details !== null && details !== "") {
detailText = typeof details === "string" ? details : JSON.stringify(details);
}
sheet.appendRow([new Date(), chatId || "-", kind || "-", String(text || "").substring(0, 500), detailText.substring(0, 1200)]);
} catch (e) {}
}

function normalizeBotText(text) {
return normalizeNumbers(text || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function isBotCommand(text, aliases) {
const raw = String(text || "").trim();
const normalized = normalizeBotText(raw);
return aliases.some(function(alias) {
const a = normalizeBotText(alias);
return raw === alias || normalized === a || (a.length > 5 && normalized.indexOf(a) !== -1);
});
}

function sendBotSearchPrompt(chatId) {
sendTextWithInline(chatId, "🔍 اكتب اسم العميل، رقم الهاتف، السيارة، أو رقم الشاصي:", [[
{ text: "إلغاء", callback_data: "BOT_CANCEL" }
]]);
}

function sendBotQuickActions(chatId) {
sendTextWithInline(chatId, "اختصارات سريعة:", [
[
{ text: "مركز اليوم", callback_data: "BOT_TODAY" },
{ text: "بحث العملاء", callback_data: "BOT_SEARCH" }
],
[
{ text: "المخزون", callback_data: "BOT_INVENTORY" },
{ text: "تقريري", callback_data: "BOT_MY" }
]
]);
}

function buildMiniAppUrl(chatId, action, params) {
const mode = params && params.mode ? params.mode : "standalone";
let query = `page=MiniApp&action=${encodeURIComponent(action || "add_wizard")}&mode=${encodeURIComponent(mode)}&chatId=${encodeURIComponent(chatId || "")}`;
if (params) {
Object.keys(params).forEach(k => {
if (k === "mode") return;
if (params[k] !== undefined && params[k] !== null && params[k] !== "") query += `&${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`;
});
}
return `${CONFIG.WEB_APP_URL}?${query}`;
}

function getWhatsappUrl(phone, prefix) {
const clean = normalizeNumbers(phone || "").replace(/\D/g, "");
const cleanPrefix = String(prefix || "+970").replace(/\D/g, "") || "970";
if (!clean) return "";
if (clean.indexOf(cleanPrefix) === 0) return `https://wa.me/${clean}`;
if (clean.length === 10 && clean[0] === "0") return `https://wa.me/${cleanPrefix}${clean.substring(1)}`;
if (clean.length === 9) return `https://wa.me/${cleanPrefix}${clean}`;
return `https://wa.me/${clean}`;
}

function formatBotCustomerCard(rowData, rowIndex) {
const name = rowData[3] || "-";
const phone = rowData[4] || "-";
const car = rowData[5] || "-";
const status = rowData[9] || STATUS.FOLLOW_UP;
const room = rowData[1] || "-";
const emp = rowData[2] || "-";
const visits = rowData[14] || 1;
const resDate = rowData[13] && rowData[13] !== "-" ? rowData[13] : "-";
return `👤 *${name}*\n📞 \`${phone}\`\n🚗 ${car}\n📊 *الحالة:* ${status}\n🏢 ${room} | 👨‍💼 ${emp}\n📅 الموعد: ${resDate}\n🔁 الزيارات: ${visits}`;
}

function sendCustomerBotCard(chatId, rowData, rowIndex) {
const phone = rowData[4] || "";
const waPrefix = rowData[12] || "+970";
const waUrl = getWhatsappUrl(phone, waPrefix);
const inline = [
[{ text: "فتح ملف العميل", web_app: { url: buildMiniAppUrl(chatId, "update_cust", { rowId: rowIndex }) } }],
[
{ text: "واتساب", url: waUrl || "https://wa.me/" },
{ text: "بحث العملاء", web_app: { url: buildMiniAppUrl(chatId, "search") } }
]
];
sendTextWithInline(chatId, formatBotCustomerCard(rowData, rowIndex), inline);
}

function normalizeDateForBot(value) {
if (!value || value === "-") return "";
if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, CONFIG.TIMEZONE, "yyyy-MM-dd");
const s = String(value).trim();
if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const p = s.split("/"); return `${p[2]}-${p[1]}-${p[0]}`; }
if (/^\d{2}-\d{2}-\d{4}/.test(s)) { const p = s.split("-"); return `${p[2]}-${p[1]}-${p[0]}`; }
return s.substring(0, 10);
}

function isRowVisibleForStaff(rowData, chatId, staffInfo) {
const isGen = isGeneralManager(chatId, staffInfo);
const isMgr = isShowroomManager(staffInfo);
if (isGen) return true;
if (!staffInfo) return false;
if (isMgr) return String(rowData[1] || "").trim() === String(staffInfo.room || "").trim();
return String(rowData[2] || "").trim() === String(staffInfo.name || "").trim();
}

function sendDailyWorkCenter(chatId, staffInfo) {
const sheet = getSheet(SHEETS.CUSTOMERS);
if (!sheet) return sendTextSafe(chatId, "تعذر قراءة بيانات العملاء حالياً.");
const data = sheet.getDataRange().getValues();
const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
let agenda = 0, overdue = 0, reservations = 0, inactive = 0, licenseDue = 0, waitingEval = 0;
let examples = [];
for (let i = data.length - 1; i >= 1; i--) {
if (!data[i][0] || !isRowVisibleForStaff(data[i], chatId, staffInfo)) continue;
const status = String(data[i][9] || "");
const resDate = normalizeDateForBot(data[i][13]);
if ((status.includes("متابعة") || status.includes("حجز")) && resDate === today) agenda++;
if (status.includes("حجز")) reservations++;
if (status.includes(STATUS.INACTIVE)) inactive++;
let tr = null;
try { if (data[i][16] && String(data[i][16]).trim().startsWith("{")) tr = JSON.parse(data[i][16]); } catch(e) {}
if (tr && tr.active && tr.licenseExp) {
const days = Math.ceil((new Date(tr.licenseExp).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
if (days >= 0 && days <= 7) licenseDue++;
}
if (tr && tr.active) {
const trStatus = String(tr.status || "");
if ((trStatus.includes("دراسة") || trStatus.includes("تقييم")) && !trStatus.includes("تم التقييم")) waitingEval++;
}
if (examples.length < 3 && !status.includes(STATUS.INACTIVE) && (resDate === today || status.includes("حجز") || (tr && tr.active))) examples.push({ row: data[i], idx: i + 1 });
}
const msg = `🧭 *مركز اليوم*\n\n📌 متابعات اليوم: *${agenda}*\n⏸️ الحجوزات المفتوحة: *${reservations}*\n🧾 سيارات بانتظار التقييم: *${waitingEval}*\n💳 رخص تنتهي خلال أسبوع: *${licenseDue}*\n🔒 ملفات غير فعالة محفوظة: *${inactive}*\n\nاختر إجراءً سريعاً أو افتح إحدى البطاقات المهمة أدناه.`;
sendTextWithInline(chatId, msg, [[
{ text: "فتح مهامي", web_app: { url: buildMiniAppUrl(chatId, "my_cust") } },
{ text: "بحث سريع", web_app: { url: buildMiniAppUrl(chatId, "search") } }
],[{ text: "المخزون", web_app: { url: buildMiniAppUrl(chatId, "inv") } }]]);
examples.forEach(item => sendCustomerBotCard(chatId, item.row, item.idx));
}

function sendInventoryBotSummary(chatId, staffInfo) {
const sheet = getSheet(SHEETS.INVENTORY);
if (!sheet) return sendTextSafe(chatId, "تعذر قراءة المخزون حالياً.");
const data = sheet.getDataRange().getValues();
let available = 0, sold = 0, reserved = 0;
for (let i = 1; i < data.length; i++) {
const st = String(data[i][5] || "");
if (st.includes("متوفر")) available++;
else if (st.includes("مباع")) sold++;
else if (st.includes("محجوز")) reserved++;
}
sendTextWithInline(chatId, `🚗 *ملخص المخزون*\n\n✅ متوفرة: *${available}*\n⏸️ محجوزة: *${reserved}*\n🏁 مباعة: *${sold}*`, [[{ text: "فتح المخزون", web_app: { url: buildMiniAppUrl(chatId, "inv") } }]]);
}

function sendTelegramMediaSafe(chatId, base64Data, fileName, mimeType, caption) {

if (!chatId || !base64Data) return false;

try {

let cleanBase64 = base64Data;

if (base64Data.includes(",")) { cleanBase64 = base64Data.split(",")[1]; }

const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType || 'application/octet-stream', fileName);

const endpoint = (mimeType && mimeType.includes("image")) ? "sendPhoto" : "sendDocument";

const url = `${CONFIG.TELEGRAM_API_BASE}${CONFIG.TELEGRAM_TOKEN}/${endpoint}`;

const payload = { chat_id: chatId.toString(), caption: caption || "" };

if (endpoint === "sendPhoto") payload.photo = blob; else payload.document = blob;

const options = { method: "post", payload: payload, muteHttpExceptions: true };

const response = UrlFetchApp.fetch(url, options);

const json = JSON.parse(response.getContentText());

if (!json.ok) {

sendTextSafe(chatId, `⚠️ تم حفظ إحدى الصور في السجل بنجاح، لكن تعذر إرسالها هنا بسبب قيود تيليجرام.`);

return false;

}

function extractDriveFileId(url) {
const text = String(url || "");
let match = text.match(/\/d\/([^\/?]+)/);
if (match) return match[1];
match = text.match(/[?&]id=([^&]+)/);
return match ? match[1] : "";
}

function sendTelegramDriveFileSafe(chatId, url, caption) {
if (!chatId || !url) return false;
try {
const fileId = extractDriveFileId(url);
if (!fileId) return false;
const file = DriveApp.getFileById(fileId);
const blob = file.getBlob();
const endpoint = String(blob.getContentType() || "").indexOf("image/") === 0 ? "sendPhoto" : "sendDocument";
const payload = { chat_id: chatId.toString(), caption: caption || "" };
payload[endpoint === "sendPhoto" ? "photo" : "document"] = blob;
UrlFetchApp.fetch(`${CONFIG.TELEGRAM_API_BASE}${CONFIG.TELEGRAM_TOKEN}/${endpoint}`, { method: "post", payload: payload, muteHttpExceptions: true });
return true;
} catch (e) { return false; }
}

return true;

} catch (e) {

return false;

}

}

function logNotification(target, msg) {

try { const sheet = getSheet(SHEETS.NOTIFICATIONS); if (sheet) { sheet.appendRow([new Date(), target, msg, "Unread"]); bumpDataVersion("notifications"); } } catch (e) {}

}

function sendAppraisalAlert(custName, custPhone, custNick, staffName, tradeIn, files, roomName) {

if (!tradeIn || !tradeIn.active) return;

try {

let msg = `🚨 *طلب تقييم سيارة استبدال* 🚨\n\n👤 العميل: ${custName}\n🏷️ الكنية: ${custNick || "-"}\n📞 الهاتف: \`${custPhone || "-"}\`\n👨💼 الموظف: ${staffName}\n🏢 المعرض: ${roomName}\n🚗 السيارة: ${tradeIn.model}\n💰 السعر المقترح: ${tradeIn.price || "غير محدد"}$\n🔢 الشاصي: ${tradeIn.id || "غير محدد"}\n🎨 اللون: ${tradeIn.color || "-"}\n📅 سنة التصنيع: ${tradeIn.year || "-"}\n⏱️ العداد: ${tradeIn.mileage || "-"}\n📋 المواصفات: ${tradeIn.specs || "-"}\n🛠️ الفحص: ${tradeIn.inspection || "-"}\n`;

logNotification(roomName, msg);

const managers = [CONFIG.MANAGER_CHAT_ID.toString()];

const staffSheet = getSheet(SHEETS.STAFF);

if (staffSheet) {

const staffData = staffSheet.getDataRange().getValues();

for (let i = 1; i < staffData.length; i++) {

if (staffData[i][2] === roomName && staffData[i][3].toString().includes("مدير معرض")) {

const managerId = staffData[i][0].toString(); if (!managers.includes(managerId)) managers.push(managerId);

}

}

}

managers.forEach(managerId => {

sendTextSafe(managerId, msg);

if (files && files.length > 0) {

files.forEach((file) => {

sendTelegramMediaSafe(managerId, file.data, file.name, file.mimeType, "");

Utilities.sleep(3000);

});

}

});

} catch (e) {}

}

function checkAndNotifyRequestedCars(newCarModel) {

try {

const custSheet = getSheet(SHEETS.CUSTOMERS); const staffSheet = getSheet(SHEETS.STAFF); if (!custSheet || !staffSheet) return;

const custData = custSheet.getDataRange().getValues(); const staffData = staffSheet.getDataRange().getValues();

const cleanModel = newCarModel.toLowerCase().trim();

const gmIds = [CONFIG.MANAGER_CHAT_ID.toString()];

staffData.forEach(s => { if (s[3].toString().includes("مدير عام") && !s[3].toString().includes("مستقيل")) gmIds.push(s[0].toString()); });

for (let i = 1; i < custData.length; i++) {

const status = String(custData[i][9]);

if (String(custData[i][5]).toLowerCase().includes(cleanModel) && !status.includes("بيع") && !status.includes("رفض")) {

const empName = custData[i][2]; const room = custData[i][1]; let empChatId = null; const showMgrs = [];

staffData.forEach(s => {

if (s[3].toString().includes("مستقيل")) return;

if (s[1] === empName) empChatId = s[0].toString();

if (s[3].toString().includes("مدير معرض") && s[2] === room) showMgrs.push(s[0].toString());

});

const msg = `🚨 *تنبيه توفر سيارة مطلوبة!*\n🚗 *السيارة:* ${newCarModel}\n👤 *العميل:* ${custData[i][3]}\n📞 *الهاتف:* \`${custData[i][4]}\`\n👨💼 *الموظف:* ${empName}`;

logNotification(empName, msg);

if (empChatId) sendTextSafe(empChatId, msg);

[...new Set(showMgrs)].forEach(id => { if (id !== empChatId) sendTextSafe(id, msg); });

[...new Set(gmIds)].forEach(id => { if (id !== empChatId && !showMgrs.includes(id)) sendTextSafe(id, msg); });

}

}

} catch (e) {}

}

function notifyMatchingTradeIn(tradeInModel, sellerName, sellerPhone, sellerRoom) {

try {

if (!tradeInModel) return;

return sendTradeInOpportunityAlert({
tradeIn: { model: tradeInModel },
sellerName: sellerName,
sellerPhone: sellerPhone,
sellerRoom: sellerRoom
});

} catch (e) {}

}

function matchesRequestedCarForTradeIn(requestedCar, offeredModel) {

const requested = String(requestedCar || "").toLowerCase().trim();
const offered = String(offeredModel || "").toLowerCase().trim();

if (!requested || !offered || requested === "-") return false;
if (requested.includes(offered) || offered.includes(requested)) return true;

const offeredTokens = offered.split(/[\s،,\/\\\-]+/).filter(t => t.length >= 3);

for (let i = 0; i < offeredTokens.length; i++) {
if (requested.includes(offeredTokens[i])) return true;
}

return false;

}

function buildTradeInOpportunityMessage(payload, matches) {

const tradeIn = payload.tradeIn || {};
const missing = [];
const sellerWhatsappUrl = getWhatsappUrl(payload.sellerPhone || "", payload.sellerWaPrefix || "+970");

if (!tradeIn.year) missing.push("السنة");
if (!tradeIn.color) missing.push("اللون");
if (!tradeIn.id) missing.push("الشاصي");
if (!tradeIn.price) missing.push("السعر/التقييم");
if (!tradeIn.inspection) missing.push("الفحص");
if (!tradeIn.licenseExp) missing.push("الرخصة");

let msg = `🚗 *فرصة استبدال جديدة*\n\n` +
`👤 صاحب السيارة: ${payload.sellerName || "-"}\n` +
`🏷️ الكنية: ${payload.sellerNick || "-"}\n` +
`📞 الهاتف: \`${payload.sellerPhone || "-"}\`\n` +
`🟢 واتساب: ${sellerWhatsappUrl || "-"}\n` +
`👨‍💼 الموظف: ${payload.staffName || "-"}\n` +
`🏢 المعرض: ${payload.sellerRoom || "-"}\n\n` +
`🚘 *السيارة المعروضة:*\n` +
`${tradeIn.model || "-"}\n` +
`📅 السنة: ${tradeIn.year || "-"}\n` +
`🎨 اللون: ${tradeIn.color || "-"}\n` +
`🔢 الشاصي: ${tradeIn.id || "-"}\n` +
`💰 السعر/التقييم: ${tradeIn.price || "-"}${tradeIn.price ? "$" : ""}\n` +
`🛠️ الفحص: ${tradeIn.inspection || "-"}\n` +
`⚙️ الجير: ${tradeIn.gear || "-"}\n` +
`⛽ الوقود: ${tradeIn.fuel || "-"}\n` +
`📄 الرخصة: ${tradeIn.licenseExp || "-"}\n` +
`📝 ملاحظات: ${tradeIn.notes || "-"}\n` +
`⚠️ النواقص: ${missing.length ? missing.join("، ") : "لا يوجد نواقص أساسية"}\n\n` +
`🔎 *عملاء يبحثون عن نفس السيارة أو سيارة مشابهة:*\n`;

if (!matches || matches.length === 0) {
msg += "\nلا يوجد عملاء مطابقون حاليًا.";
return msg;
}

matches.slice(0, 12).forEach(function(match, index) {
msg += `\n${index + 1}. ${match.name || "-"} - \`${match.phone || "-"}\`\n` +
`   المطلوب: ${match.requestedCar || "-"}\n` +
`   الحالة: ${match.status || "-"}\n` +
`   الموظف: ${match.employee || "-"} | ${match.room || "-"}\n`;
});

if (matches.length > 12) msg += `\n...و ${matches.length - 12} عميل إضافي مطابق.`;

return msg;

}

function sendTradeInOpportunityAlert(payload) {

try {

payload = payload || {};
const tradeIn = payload.tradeIn || {};
const tradeInModel = tradeIn.model || payload.tradeInModel;

if (!tradeInModel) return;

const custSheet = getSheet(SHEETS.CUSTOMERS); const staffSheet = getSheet(SHEETS.STAFF); if (!custSheet || !staffSheet) return;

const custData = custSheet.getDataRange().getValues(); const staffData = staffSheet.getDataRange().getValues();
const activeStaff = {};
const recipientIds = [CONFIG.MANAGER_CHAT_ID.toString()];
const matches = [];

staffData.forEach(function(s) {
const role = String(s[3] || "");
const chatId = s[0] ? s[0].toString() : "";
if (!chatId || role.includes("مستقيل") || role.includes("قيد الانتظار")) return;
if (s[1]) activeStaff[String(s[1]).trim()] = chatId;
if (role.includes("مدير عام") || (role.includes("مدير معرض") && String(s[2] || "").trim() === String(payload.sellerRoom || "").trim())) recipientIds.push(chatId);
});

for (let i = 1; i < custData.length; i++) {

const status = String(custData[i][9]);

if (payload.sellerRowId && (i + 1).toString() === payload.sellerRowId.toString()) continue;

if (matchesRequestedCarForTradeIn(custData[i][5], tradeInModel) && !status.includes("بيع") && !status.includes("رفض") && !status.includes(STATUS.INACTIVE)) {

const buyerEmp = String(custData[i][2] || "").trim();
const empChatId = activeStaff[buyerEmp];
if (empChatId) recipientIds.push(empChatId);

matches.push({
name: custData[i][3],
phone: custData[i][4],
requestedCar: custData[i][5],
status: custData[i][9],
employee: buyerEmp,
room: custData[i][1],
rowId: i + 1
});

}

}

const msg = buildTradeInOpportunityMessage(payload, matches);

logNotification(payload.sellerRoom || "الكل", msg);
logBotEvent("SYSTEM", "trade_in_opportunity", tradeInModel, "matches: " + matches.length);

[...new Set(recipientIds)].forEach(function(chatId) {
sendTextSafe(chatId, msg);
});

} catch (e) {}

}

// ==========================================

// دوال الصلاحيات والإدارة

// ==========================================

function getAllStaffNames() { try { const data = getCachedStaffRows(); return data.filter((d, i) => i > 0 && d[1] && !d[3].toString().includes("مستقيل")).map(d => d[1]); } catch (e) { return []; } }

function getRoomsList() { try {
return getCachedRoomList();
} catch (e) { return []; } }

function getEmployeesByShowroom(room) { try { const sheet = getSheet(SHEETS.STAFF); if (!sheet) return []; const emps = [];
sheet.getDataRange().getValues().forEach((d, i) => { if (i > 0 && !d[3].toString().includes("مستقيل") && (room === "" || d[2] === room)) emps.push(d[1]); }); return [...new Set(emps)]; } catch (e) { return []; } }

function getStaffDirectory() {
try {
return withVersionedCache("staff", "directory", CONFIG.CACHE_DURATION, function() {
const data = getCachedStaffRows();
const byName = {};
const byChatId = {};
const managersByRoom = {};
for (let i = 1; i < data.length; i++) {
const name = String(data[i][1] || "").trim();
const chatId = data[i][0] ? data[i][0].toString().trim() : "";
const room = String(data[i][2] || "").trim();
const role = String(data[i][3] || "").trim();
if (!name || role.includes("مستقيل") || role.includes("قيد الانتظار")) continue;
const record = { chatId, name, room, role };
byName[name] = record;
if (chatId) byChatId[chatId] = Object.assign({ row: i + 1 }, record);
if (role.includes("مدير معرض") && room) managersByRoom[room] = record;
}
return { byName, byChatId, managersByRoom };
});
} catch (e) { return {}; }
}

function getStaffInfoFromSheet(chatId) {

if (!chatId) return null;

try {
const directory = getStaffDirectory();
return directory && directory.byChatId ? (directory.byChatId[chatId.toString().trim()] || null) : null;

} catch (e) { return null; }

}

function isGeneralManager(chatId, staffInfo) { 
  return (chatId && chatId.toString() === CONFIG.MANAGER_CHAT_ID.toString()) || 
         (staffInfo && staffInfo.role && staffInfo.role.toString().includes("مدير عام")); 
}

function isShowroomManager(staffInfo) { 
  return staffInfo && staffInfo.role && staffInfo.role.toString().includes("مدير معرض"); 
}

function isAnyManager(chatId, staffInfo) { return isGeneralManager(chatId, staffInfo) || isShowroomManager(staffInfo); }

function resolveUser(identifier) { return (typeof identifier === 'object' && identifier !== null) ? identifier : getStaffInfoFromSheet(identifier); }

// ==========================================

// دوال المخزون والاستبدال

// ==========================================

function cleanInventoryKey(value) {

return normalizeNumbers(value).replace(/\s+/g, "").toLowerCase();

}

function isBlankChassis(value) {

const key = cleanInventoryKey(value);

return !key || key === "بدونشاصي" || key === "-" || key === "null" || key === "undefined";

}

function normalizeInventoryOwner(owner, fallbackRoom) {

const value = String(owner || "").trim();

if (!value || value === "الكل" || value === "الشركة" || value === "غير محدد") return fallbackRoom || "معرض المعلم";

return value;

}

function findInventoryRow(data, model, chassis, owner) {

const modelKey = cleanInventoryKey(model);

const chassisKey = cleanInventoryKey(chassis);

const ownerKey = cleanInventoryKey(owner);

if (!modelKey) return -1;

if (!isBlankChassis(chassis)) {

for (let i = 1; i < data.length; i++) {

if (cleanInventoryKey(data[i][3]) === chassisKey) return i + 1;

}

}

for (let i = 1; i < data.length; i++) {

const rowDeal = String(data[i][2] || "").trim();

if (cleanInventoryKey(data[i][0]) === modelKey &&
    cleanInventoryKey(data[i][1]) === ownerKey &&
    (rowDeal === "استبدال" || rowDeal === "برسم البيع" || rowDeal === "حيازة")) {

return i + 1;

}

}

return -1;

}

function writeInventoryRow(sheet, rowNumber, rowValues, photosStr) {

const existingPhotos = rowNumber > 1 ? String(sheet.getRange(rowNumber, 17).getValue() || "").trim() : "";

if (photosStr && existingPhotos && existingPhotos !== "-") rowValues[16] = existingPhotos + "\n" + photosStr;

else if (photosStr) rowValues[16] = photosStr;

else if (existingPhotos) rowValues[16] = existingPhotos;

sheet.getRange(rowNumber, 1, 1, 17).setValues([rowValues]);
bumpDataVersion(["inventory", "dashboard"]);

}

function updateSellerInventoryStatus(invSheet, invData, customerName, carModel, chassis, status, transferRoom) {

const rowByExact = findInventoryRow(invData, carModel, chassis, customerName);

let rowNumber = rowByExact;

if (rowNumber === -1) {

for (let i = 1; i < invData.length; i++) {

if (String(invData[i][1] || "").trim() === String(customerName || "").trim() && String(invData[i][2] || "").trim() === "برسم البيع") {

rowNumber = i + 1;

break;

}

}

}

if (rowNumber === -1) return false;

if (status.includes("تم بيع السيارة")) {

invSheet.getRange(rowNumber, 6).setValue("مباعة ✅");
bumpDataVersion(["inventory", "dashboard"]);

return true;

}

if (status.includes("تراجع الزبون")) {

invSheet.getRange(rowNumber, 6).setValue("مسحوبة من العرض");
bumpDataVersion(["inventory", "dashboard"]);

return true;

}

if (status.includes("شراء السيارة للمعرض") || status.includes("تم شراء السيارة للمعرض")) {

const owner = normalizeInventoryOwner(transferRoom, "");

if (owner) invSheet.getRange(rowNumber, 2).setValue(owner);

invSheet.getRange(rowNumber, 3).setValue("حيازة");

invSheet.getRange(rowNumber, 6).setValue("متوفرة");
bumpDataVersion(["inventory", "dashboard"]);

return true;

}

if (status.includes("معروضة")) {

invSheet.getRange(rowNumber, 2).setValue(customerName || "عميل غير محدد");

invSheet.getRange(rowNumber, 3).setValue("برسم البيع");

invSheet.getRange(rowNumber, 6).setValue("متوفرة");
bumpDataVersion(["inventory", "dashboard"]);

return true;

}

return false;

}

function createSellerInventoryRow(invSheet, customerName, carModel, status, transferRoom) {

if (!invSheet || !carModel) return false;

const newRow = new Array(17).fill("");
const cleanStatus = String(status || "");
let owner = customerName || "عميل غير محدد";
let dealType = "برسم البيع";
let stockStatus = "متوفرة";

if (cleanStatus.includes("تم بيع السيارة")) stockStatus = "مباعة ✅";
else if (cleanStatus.includes("تراجع الزبون")) stockStatus = "مسحوبة من العرض";
else if (cleanStatus.includes("شراء السيارة للمعرض") || cleanStatus.includes("تم شراء السيارة للمعرض")) {
owner = normalizeInventoryOwner(transferRoom, "معرض المعلم");
dealType = "حيازة";
stockStatus = "متوفرة";
}

newRow[0] = carModel;
newRow[1] = owner;
newRow[2] = dealType;
newRow[3] = "بدون شاصي";
newRow[4] = "مستعملة";
newRow[5] = stockStatus;

invSheet.insertRowBefore(2);
invSheet.getRange(2, 1, 1, 17).setValues([newRow]);
bumpDataVersion(["inventory", "dashboard"]);
return true;

}

function processTradeInToInventory(tradeIn, staffRoom, custName, photosStr) {
  if (!tradeIn || !tradeIn.active || !tradeIn.model) return false;
  try {
    const sheet = getSheet(SHEETS.INVENTORY);
    if (!sheet) return false;
    const data = sheet.getDataRange().getValues();
    const inputId = normalizeNumbers(tradeIn.id) || "بدون شاصي";

    let owner = custName || "عميل غير محدد";
    let dealType = "برسم البيع";
    let stockStatus = "متوفرة";
    const tradeStatus = String(tradeIn.status || "").trim();

    // المنطق الجديد لتحديد الملكية ونوع الصفقة بناءً على خيار الموظف
    if (tradeStatus === "تم الاتفاق والاستبدال") { 
      owner = normalizeInventoryOwner(tradeIn.owner || staffRoom, staffRoom);
      dealType = "استبدال"; 
    } else if (tradeStatus === "شراء السيارة للمعرض" || tradeStatus === "تم شراء السيارة للمعرض 🏢") {
      owner = normalizeInventoryOwner(tradeIn.owner || staffRoom, staffRoom);
      dealType = "حيازة";
      stockStatus = "متوفرة";
    } else if (tradeStatus === "تم بيع السيارة لعميل خارجي" || tradeStatus === "تم بيع السيارة ✅") {
      owner = custName || "عميل غير محدد";
      dealType = "برسم البيع";
      stockStatus = "مباعة ✅";
    } else if (tradeStatus === "تراجع العميل عن البيع" || tradeStatus === "تراجع الزبون عن البيع ❌") {
      owner = custName || "عميل غير محدد";
      dealType = "برسم البيع";
      stockStatus = "مسحوبة من العرض";
    } else if (tradeStatus === "رفض من قبل المعرض" || tradeStatus === "رفض من قبل المعرض ⛔") {
      owner = custName || "عميل غير محدد";
      dealType = "برسم البيع";
      stockStatus = "مسحوبة من العرض";
    } else if (tradeStatus === "استبدال (دراسة وتقييم)" || tradeStatus === "تحت الدراسة والتقييم" || tradeStatus === "تم التقييم") {
      owner = custName || "عميل غير محدد";
      dealType = "استبدال";
    } else if (tradeStatus === "عرض سيارة (برسم البيع)" || tradeStatus === "عرض سيارة (تحت رسم البيع)") {
      owner = custName || "عميل غير محدد";
      dealType = "برسم البيع";
    }

    let foundRow = findInventoryRow(data, tradeIn.model, inputId, owner);
    
    // البحث العميق عن نفس الصف حتى لو تغيرت الملكية من العميل إلى المعرض أو العكس.
    if (foundRow === -1) {
      const fallbackOwners = [custName, tradeIn.previousOwner, staffRoom];
      for (let i = 0; i < fallbackOwners.length; i++) {
        if (!fallbackOwners[i] || String(fallbackOwners[i]).trim() === String(owner).trim()) continue;
        foundRow = findInventoryRow(data, tradeIn.model, inputId, fallbackOwners[i]);
        if (foundRow !== -1) break;
      }
    }

    const newRow = new Array(17).fill("");
    newRow[0] = tradeIn.model; newRow[1] = owner; newRow[2] = dealType;
    newRow[3] = tradeIn.id || "بدون شاصي";
    newRow[4] = tradeIn.condition || "مستعملة";
    newRow[5] = stockStatus;
    newRow[6] = tradeIn.price || 0;
    newRow[7] = tradeIn.gear || "اتوماتيك"; newRow[8] = tradeIn.fuel || "بنزين";
    newRow[9] = tradeIn.licenseExp || "";
    newRow[10] = tradeIn.notes || ""; newRow[11] = tradeIn.color || "";
    newRow[12] = tradeIn.year || "";
    newRow[13] = tradeIn.mileage || ""; newRow[14] = tradeIn.specs || "";
    newRow[15] = tradeIn.inspection || "";
    newRow[16] = photosStr || "";

    if (foundRow > -1) {
      writeInventoryRow(sheet, foundRow, newRow, photosStr);
      return true;
    }
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, 17).setValues([newRow]);
    bumpDataVersion(["inventory", "dashboard"]);
    return true;
  } catch (e) { return false; }
}

function markAsSold(id) {

if (!id || id === "") return null;

try {

const sheet = getSheet(SHEETS.INVENTORY); if (!sheet) return null;

const data = sheet.getDataRange().getValues(); const inputId = normalizeNumbers(id);

for (let i = 1; i < data.length; i++) {

const stockStatus = String(data[i][5] || "").trim();

if (normalizeNumbers(data[i][3]) === inputId && (stockStatus.includes("متوفر") || stockStatus.includes("محجوز"))) {

sheet.getRange(i + 1, 6).setValue("مباعة ✅");
bumpDataVersion(["inventory", "dashboard"]);
return data[i][0];

}

}

return null;

} catch (e) { return null; }

}

function markAsReserved(id) {

if (!id || id === "") return null;

try {

const sheet = getSheet(SHEETS.INVENTORY); if (!sheet) return null;

const data = sheet.getDataRange().getValues(); const inputId = normalizeNumbers(id);

for (let i = 1; i < data.length; i++) {

const stockStatus = String(data[i][5] || "").trim();

if (normalizeNumbers(data[i][3]) === inputId && (stockStatus.includes("متوفر") || stockStatus.includes("محجوز"))) {

sheet.getRange(i + 1, 6).setValue("محجوزة 🕒");
bumpDataVersion(["inventory", "dashboard"]);
return data[i][0];

}

}

return null;

} catch (e) { return null; }

}

function releaseReservedCar(id) {

if (!id || id === "") return false;

try {

const sheet = getSheet(SHEETS.INVENTORY); if (!sheet) return false;

const data = sheet.getDataRange().getValues(); const inputId = normalizeNumbers(id);

for (let i = 1; i < data.length; i++) {

if (normalizeNumbers(data[i][3]) === inputId && String(data[i][5] || "").trim().includes("محجوز")) {

sheet.getRange(i + 1, 6).setValue("متوفرة");
bumpDataVersion(["inventory", "dashboard"]);
return true;

}

}

return false;

} catch (e) { return false; }

}

function getCarsByShowroomList(room) {

try {

const sheet = getSheet(SHEETS.INVENTORY); if (!sheet) return [];

const data = sheet.getDataRange().getValues(); const cars = [];

for (let i = 1; i < data.length; i++) {

if (data[i][5] === "متوفرة") {

const owner = data[i][1];

const dealType = data[i][2];

const condition = String(data[i][4] || "").trim();

const effectiveRoom = condition.includes("مستعمل") ? "معرض المعلم" : owner;

let canView = false;

let displayDealType = dealType;

if (room === "" || room === "الكل") {

canView = true;

} else if (room === "معرض المعلم") {

if (effectiveRoom === "معرض المعلم" || dealType === "استبدال" || dealType === "برسم البيع") {

canView = true;

if (effectiveRoom !== "معرض المعلم" && (dealType === "استبدال" || dealType === "برسم البيع")) displayDealType = "برسم البيع";

}

} else {

if (effectiveRoom === room || owner === room) canView = true;

}

if (canView) cars.push({ id: data[i][3], model: data[i][0], price: data[i][6], dealType: displayDealType });

}

}

return cars;

} catch (e) { return []; }

}

// ==========================================

// دوال تطبيق الويب (الداش بورد والتطبيق المصغر)

// ==========================================

function doGet(e) {

try {

let pageName = 'MiniApp';

if (e && e.parameter && e.parameter.page) {

pageName = e.parameter.page;

}

const pageAliases = { Dashboard1: "Dashboard", dashboard1: "Dashboard", Dashboard: "Dashboard", dashboard: "Dashboard", Dash: "Dashboard", dash: "Dashboard" };

pageName = pageAliases[pageName] || pageName;

const allowedPages = ["MiniApp", "Dashboard"];

if (allowedPages.indexOf(pageName) === -1) {

pageName = "MiniApp";

}

let template = HtmlService.createTemplateFromFile(pageName);

if (e && e.parameter) {

for (let key in e.parameter) {

template[key] = e.parameter[key];

}

}

if(typeof template.chatId === 'undefined') template.chatId = "";

if(typeof template.action === 'undefined') template.action = "";

if(typeof template.mode === 'undefined') template.mode = "";

if(typeof template.rowId === 'undefined') template.rowId = "";

let html = template.evaluate();

html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

html.addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');

html.setTitle('أوتو سيستم الإداري');

return html;

} catch (error) {

let htmlError = HtmlService.createHtmlOutput("<div style='text-align:center;font-family:sans-serif;margin-top:50px;direction:rtl;padding:20px;'><h3>عذراً، يوجد خطأ برمجي:</h3><p style='color:red;'>" + error.message + "</p></div>");

htmlError.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

htmlError.addMetaTag('viewport', 'width=device-width, initial-scale=1');

return htmlError;

}

}

function webStandaloneInit() {

try {
return withVersionedCache("bootstrap", "standalone-init", CONFIG.CACHE_DURATION, function() {
return { staff: getAllStaffNames(), rooms: getRoomsList() };
});

} catch (e) {

return { staff: [], rooms: [] };

}

}

function webStandaloneInitInit(chatId) {

try {

if (!chatId) return { staff: [], rooms: [], cars: [], isGen: false, user: null };

const staffInfo = getStaffInfoFromSheet(chatId);

const isGen = isGeneralManager(chatId, staffInfo);

return {

staff: getAllStaffNames(),

rooms: getRoomsList(),

cars: getCarsByShowroomList(isGen ? "" : (staffInfo ? staffInfo.room : "")),

isGen: isGen,

user: staffInfo

};

} catch(e) { return { staff: [], rooms: [], cars: [], isGen: false, user: null }; }

}

function webStandaloneLogin(username, pass) {
  try {
    pass = String(pass || "");
    const data = getCachedStaffRows();
    if (!data || data.length === 0) return { success: false, error: "خطأ في النظام" };
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === username) {
        if (data[i][3].toString().includes("مستقيل")) return { success: false, error: "حساب موقوف" };
        if (data[i][3].toString().includes("قيد الانتظار")) return { success: false, error: "حسابك لا يزال قيد المراجعة" };
        const storedPass = data[i][4] ? data[i][4].toString().trim() : "";
        if (pass.trim() !== storedPass) return { success: false, error: "كلمة المرور غير صحيحة!" };
        
        // التصحيح هنا: استخدام trim() لتنظيف البيانات قبل حفظها في الجلسة
        return { 
          success: true, 
          user: { 
            name: data[i][1] ? data[i][1].toString().trim() : "", 
            room: data[i][2] ? data[i][2].toString().trim() : "غير محدد", 
            role: data[i][3] ? data[i][3].toString().trim() : "موظف عادي", 
            isStandalone: true 
          } 
        };
      }
    }
    return { success: false, error: "المستخدم غير موجود" };
  } catch (e) { return { success: false, error: "حدث خطأ في النظام" }; }
}

function webGetCustomerDetailsForApp(rowId) {
  try {
    const sheet = getSheet(SHEETS.CUSTOMERS);
    if (!sheet) return { success: false, msg: "خطأ في قاعدة البيانات" };
    const row = parseInt(rowId);
    if (isNaN(row) || row < 2) return { success: false, msg: "معرف العميل غير صحيح" };
    
    const data = sheet.getRange(row, 1, 1, 17).getValues()[0];
    let tradeInObj = { active: false };
    
    if (data[16] && String(data[16]).trim().startsWith("{")) { 
      try { 
        tradeInObj = JSON.parse(data[16]); 
      } catch(e) {} 
    }

    if ((!tradeInObj || !tradeInObj.active) && isLegacyCustomerCarStatus(data[9])) {
      tradeInObj = buildLegacyCustomerCarTradeIn(data) || { active: false };
    }

    const selectedCarId = (isLegacyCustomerCarStatus(data[9]) || String(data[9] || "").includes(STATUS.INACTIVE)) ? "" : (extractCarIdFromText(data[9]) || extractCarIdFromText(data[5]));
    return {
      success: true,
      data: {
        rowId: row, name: data[3], nickname: data[10], phone: data[4], address: data[11],
        car: data[5], status: data[9], payment: data[6], resDate: data[13],
        agreement: data[8], photos: data[7], tradeIn: tradeInObj,
        selectedCarId: selectedCarId, selectedCarLabel: selectedCarId ? `${data[5] || "السيارة المحددة"} | شاصي: ${selectedCarId}` : ""
      }
    };
  } catch(e) { return { success: false, msg: e.message }; }
}

function webGetInventory(identifier) {

try {

const staffInfo = resolveUser(identifier); const isGen = isGeneralManager(identifier, staffInfo);
return withVersionedCache("inventory", getUserScopeKey(identifier, staffInfo), CONFIG.CACHE_DURATION, function() {
const sheet = getSheet(SHEETS.INVENTORY); if (!sheet) return [];
const data = sheet.getDataRange().getValues(); const result = [];

for (let i = 1; i < data.length; i++) {
if(!data[i][0]) continue;

const avail = String(data[i][5] || "").trim();
if (!avail.includes("متوفر")) continue;

const condition = String(data[i][4] || "").trim();
const owner = data[i][1];
const dealType = data[i][2];
const effectiveRoom = condition.includes("مستعمل") ? "معرض المعلم" : owner;
let canView = false;
let displayDealType = dealType;

if (isGen) {
canView = true;
} else if (staffInfo) {
if (staffInfo.room === "معرض المعلم") {
if (effectiveRoom === "معرض المعلم" || dealType === "استبدال" || dealType === "برسم البيع") {
canView = true;
if (effectiveRoom !== "معرض المعلم" && (dealType === "استبدال" || dealType === "برسم البيع")) displayDealType = "برسم البيع";
}
} else if (effectiveRoom === staffInfo.room || owner === staffInfo.room) {
canView = true;
}
}

if (!canView) continue;

let safeRowData = [];
for (let j = 0; j < data[i].length; j++) {
if (data[i][j] instanceof Date && !isNaN(data[i][j].getTime())) safeRowData.push(Utilities.formatDate(data[i][j], CONFIG.TIMEZONE, "yyyy-MM-dd"));
else safeRowData.push(data[i][j]);
}

result.push({
id: data[i][3],
model: data[i][0],
price: data[i][6],
room: effectiveRoom,
owner: owner,
condition: condition,
stock: avail,
dealType: displayDealType,
fullRowData: safeRowData
});
}

return result;
});

} catch (e) { return []; }

}

function webGetReports(identifier) {

try {

const staffInfo = resolveUser(identifier); const isGen = isGeneralManager(identifier, staffInfo);
return withVersionedCache("customers", getUserScopeKey(identifier, staffInfo), CONFIG.CACHE_DURATION, function() {
const sheet = getSheet(SHEETS.CUSTOMERS); if (!sheet) return [];
const data = sheet.getDataRange().getValues(); const result = [];

for (let i = data.length - 1; i >= 1; i--) {
if (!data[i][0] || data[i][0] === "") continue;
const rowRoom = String(data[i][1] || "").trim(); const userRoom = staffInfo ? String(staffInfo.room).trim() : "";
if (!isGen && (!staffInfo || rowRoom !== userRoom)) continue;
result.push(formatCustomerDataForWeb(data[i], i + 1));
}

return result;
});

} catch (e) { return []; }

}

function webAddCustomer(identifier, req) {

try {

// 🌟 توحيد ملفات الميني آب مع الداش بورد 🌟

if (req.files && req.files.length > 0 && (!req.filesCar || req.filesCar.length === 0)) {

req.filesCar = req.files;

}

const staffInfo = resolveUser(identifier); if (!staffInfo && identifier !== CONFIG.MANAGER_CHAT_ID) return { success: false, msg: "غير مصرح لك" };

const sheet = getSheet(SHEETS.CUSTOMERS); if (!sheet) return { success: false, msg: "خطأ في الاتصال" };

const lock = LockService.getScriptLock(); if (!lock.tryLock(10000))
return { success: false, msg: "النظام مشغول" };

try {

const empName = staffInfo ? staffInfo.name : "المدير العام";

const empRoom = staffInfo ? staffInfo.room : "الشركة";

const assignedRoom = req.room && req.room !== "" ? req.room : empRoom;

const dtNow = formatArabicDate(new Date(), "dd/MM/yyyy hh:mm a");

const p = String(req.phone).trim();

const phoneIndex = getCustomerPhoneIndex();
let duplicateRowId = phoneIndex[p] || phoneIndex[`'${p}`] || null;

if (duplicateRowId) { lock.releaseLock(); return { success: false, isDuplicate: true, msg: "العميل مسجل مسبقاً", duplicateData: { id: duplicateRowId } }; }

let finalStatus = stripStatusCarId(req.status);
const saleClosureReason = shouldCloseCustomerFromStatus(finalStatus) ? getCustomerClosureReasonFromStatus(finalStatus) : "";
const tradeClosureReason = getTradeInClosureReason(req.tradeIn && req.tradeIn.status);

if (finalStatus.includes("تم البيع") && req.carId) {
markAsSold(req.carId);
finalStatus = buildStatusWithCarId(STATUS.SOLD, req.carId);
} else if (finalStatus.includes("حجز") && req.carId) {
markAsReserved(req.carId);
finalStatus = buildStatusWithCarId(finalStatus, req.carId);
}

let additions = `[إدخال ${dtNow} بواسطة ${empName}]:\n${req.agreement}`;

if (req.rejectReason) additions += `\n[سبب الرفض]: ${req.rejectReason}`;

let allUrls = []; let uploadLog = "";

if (req.filesCar && req.filesCar.length > 0) { uploadLog += "\n🔹 صور السيارة:"; req.filesCar.forEach(f => { let u = uploadFileToDrive(f.data, "صور_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

if (req.filesInspect && req.filesInspect.length > 0) { uploadLog += "\n🔹 شهادة الفحص:"; req.filesInspect.forEach(f => { let u = uploadFileToDrive(f.data, "فحص_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

if (req.filesLicense && req.filesLicense.length > 0) { uploadLog += "\n🔹 رخصة:"; req.filesLicense.forEach(f => { let u = uploadFileToDrive(f.data, "رخصة_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

if (req.filesInsurance && req.filesInsurance.length > 0) { uploadLog += "\n🔹 تأمين:"; req.filesInsurance.forEach(f => { let u = uploadFileToDrive(f.data, "تأمين_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

const urlsStr = allUrls.length > 0 ? allUrls.join("\n") : "-";

if (uploadLog !== "") additions += `\n\n🗂️ المستندات المرفقة:${uploadLog}`;

let tradeInStr = "";

if (req.tradeIn && req.tradeIn.active) { 
const inventoryTradeIn = Object.assign({}, req.tradeIn, { active: true });
const addTradeArchiveReason = tradeClosureReason || saleClosureReason;
tradeInStr = JSON.stringify(addTradeArchiveReason ? buildArchivedTradeIn(req.tradeIn, addTradeArchiveReason, empName, dtNow) : req.tradeIn);
additions += `\n[إدخال سيارة العميل ${dtNow} بواسطة ${empName}]: ${req.tradeIn.model} | الحالة: ${req.tradeIn.status || "-"} | السعر: ${req.tradeIn.price || "-"}$ | شاصي: ${req.tradeIn.id || "-"}`;
processTradeInToInventory(inventoryTradeIn, assignedRoom, req.name, urlsStr);
if (!tradeClosureReason) {
logNotification(assignedRoom, `تم تسجيل سيارة استبدال جديدة بانتظار المطابقة: ${req.tradeIn.model || "-"}`);
}

const targetChatIds = [CONFIG.MANAGER_CHAT_ID.toString()];
const staffSheetTemp = getSheet(SHEETS.STAFF);
if (staffSheetTemp) { const staffDataTemp = staffSheetTemp.getDataRange().getValues();
for (let i = 1; i < staffDataTemp.length; i++) { if (staffDataTemp[i][2] === assignedRoom && staffDataTemp[i][3].toString().includes("مدير معرض")) { targetChatIds.push(staffDataTemp[i][0].toString()); } } }
const uniqueChatIds = [...new Set(targetChatIds)];
uniqueChatIds.forEach(chatId => { let allMedia = [];
if (req.filesCar) req.filesCar.forEach(f => allMedia.push({file: f, type: 'car'}));
if (req.filesInspect) req.filesInspect.forEach(f => allMedia.push({file: f, type: 'inspect'}));
if (req.filesLicense) req.filesLicense.forEach(f => allMedia.push({file: f, type: 'license'}));
if (req.filesInsurance) req.filesInsurance.forEach(f => allMedia.push({file: f, type: 'insurance'}));
for (let idx = 0; idx < allMedia.length; idx++) { let item = allMedia[idx];
let cap = idx === 0 ? `📸 مرفقات استبدال: ${req.tradeIn.model}\nالمالك: ${req.name}` : "";
sendTelegramMediaSafe(chatId, item.file.data, item.file.name, item.file.mimeType, cap);
Utilities.sleep(3500); } }); } else if (allUrls.length > 0) { // إرسال الصور في حالة عدم وجود استبدال (بيع أو إضافة عميل جديد عادي)
const targetChatIds = [CONFIG.MANAGER_CHAT_ID.toString()];
const staffSheetTemp = getSheet(SHEETS.STAFF);
if (staffSheetTemp) { const staffDataTemp = staffSheetTemp.getDataRange().getValues();
for (let i = 1; i < staffDataTemp.length; i++) { if (staffDataTemp[i][2] === assignedRoom && staffDataTemp[i][3].toString().includes("مدير معرض")) { targetChatIds.push(staffDataTemp[i][0].toString()); } } }
const uniqueChatIds = [...new Set(targetChatIds)];
uniqueChatIds.forEach(chatId => { let allMedia = [];
if (req.filesCar) req.filesCar.forEach(f => allMedia.push({file: f, type: 'car'}));
if (req.filesInspect) req.filesInspect.forEach(f => allMedia.push({file: f, type: 'inspect'}));
if (req.filesLicense) req.filesLicense.forEach(f => allMedia.push({file: f, type: 'license'}));
if (req.filesInsurance) req.filesInsurance.forEach(f => allMedia.push({file: f, type: 'insurance'}));
for (let idx = 0; idx < allMedia.length; idx++) { let item = allMedia[idx];
let cap = idx === 0 ? `📸 مستندات جديدة للعميل: ${req.name}\nبواسطة: ${empName}` : "";
sendTelegramMediaSafe(chatId, item.file.data, item.file.name, item.file.mimeType, cap);
Utilities.sleep(3500); } }); }

if (saleClosureReason || tradeClosureReason) {
const closeReason = tradeClosureReason || saleClosureReason;
finalStatus = STATUS.INACTIVE;
req.resDate = "-";
additions += `\n[إغلاق ملف العميل ${dtNow} بواسطة ${empName}]: ${closeReason}. تم تحويل حالة العميل إلى (${STATUS.INACTIVE}) مع حفظ السجل والمرفقات.`;
}

sheet.appendRow([ new Date(), assignedRoom, empName, req.name, `'${req.phone}`, req.car, req.payment || "-", urlsStr, additions.trim(), finalStatus, req.nickname || "-", req.address || "-", req.waPrefix || "+970", req.resDate || "-", 1, new Date(), tradeInStr ]);
bumpDataVersion(["customers", "dashboard", "hr"]);

const newCustomerRow = sheet.getLastRow();

if (req.tradeIn && req.tradeIn.active && !tradeClosureReason) {
sendTradeInOpportunityAlert({
tradeIn: req.tradeIn,
sellerName: req.name,
sellerPhone: req.phone,
sellerNick: req.nickname,
sellerRoom: assignedRoom,
staffName: empName,
sellerRowId: newCustomerRow
});
}

logAudit(empName, staffInfo ? staffInfo.role : "-", "create_customer", "customers", newCustomerRow, `الحالة: ${finalStatus} | السيارة: ${req.car}`);

logCustomerAction(newCustomerRow, req.name, empName, "إنشاء عميل", req.resDate || "-", additions.trim());

notifyManagersOfAction(assignedRoom, empName, "إضافة عميل جديد 🆕", `👤 العميل: ${req.name}\n🚗 المطلوب: ${req.car}\n📊 الحالة: ${finalStatus}`);

lock.releaseLock(); return { success: true, msg: "✅ تم إضافة العميل بنجاح!" };

} catch (e) { lock.releaseLock(); throw e; }

} catch (e) { return { success: false, msg: e.message }; }

}

function webUpdateCustomer(identifier, req) {

try {

// 🌟 توحيد ملفات الميني آب مع الداش بورد 🌟

if (req.files && req.files.length > 0 && (!req.filesCar || req.filesCar.length === 0)) {

req.filesCar = req.files;

}

const staffInfo = resolveUser(identifier); if (!staffInfo && identifier !== CONFIG.MANAGER_CHAT_ID) return { success: false, msg: "غير مصرح لك" };

const sheet = getSheet(SHEETS.CUSTOMERS); const row = parseInt(req.rowId);

if (!sheet || !row || row < 2) return { success: false, msg: "خطأ في النظام" };

const lock = LockService.getScriptLock(); if (!lock.tryLock(10000))
return { success: false, msg: "النظام مشغول" };

try {

const updaterName = staffInfo ? staffInfo.name : "المدير العام"; const staffRoom = staffInfo ? staffInfo.room : "الشركة"; const dtNow = formatArabicDate(new Date(), "dd/MM/yyyy hh:mm a");

const customerRoom = String(sheet.getRange(row, 2).getValue() || "").trim();

const inventoryRoom = normalizeInventoryOwner(req.transferRoom || customerRoom || staffRoom, staffRoom);

const previousStatus = String(sheet.getRange(row, 10).getValue() || "");
const previousCarId = extractCarIdFromText(previousStatus);
let customerClosureReason = "";
const tradeClosureReason = getTradeInClosureReason(req.tradeIn && req.tradeIn.status);

if (req.status) {

let finalStatus = stripStatusCarId(req.status);
if (shouldCloseCustomerFromStatus(finalStatus)) customerClosureReason = getCustomerClosureReasonFromStatus(finalStatus);

const cleanNewCarId = normalizeNumbers(req.carId || "");
const cleanOldCarId = normalizeNumbers(previousCarId || "");

if (previousStatus.includes("حجز") && cleanOldCarId && (!cleanNewCarId || cleanNewCarId !== cleanOldCarId || !finalStatus.includes("حجز"))) {
releaseReservedCar(previousCarId);
}

if (finalStatus.includes("تم البيع") && req.carId) {
markAsSold(req.carId);
finalStatus = buildStatusWithCarId(STATUS.SOLD, req.carId);
} else if (finalStatus.includes("حجز") && req.carId) {
markAsReserved(req.carId);
finalStatus = buildStatusWithCarId(finalStatus, req.carId);
}

sheet.getRange(row, 10).setValue(finalStatus);
bumpDataVersion(["customers", "dashboard", "hr"]);

}

if (req.car && req.car.trim() !== "") sheet.getRange(row, 6).setValue(req.car);

if (req.payment) sheet.getRange(row, 7).setValue(req.payment);

if (req.resDate) sheet.getRange(row, 14).setValue(req.resDate);

const currentVisits = parseInt(sheet.getRange(row, 15).getValue()) || 1;
if (req.incrementVisit) sheet.getRange(row, 15).setValue(currentVisits + 1); sheet.getRange(row, 16).setValue(new Date());

let additions = ""; let allUrls = []; let uploadLog = "";
let shouldSendTradeInOpportunityAfterUpdate = false;

if (req.filesCar && req.filesCar.length > 0) { uploadLog += "\n🔹 صور:";
req.filesCar.forEach(f => { let u = uploadFileToDrive(f.data, "صور_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

if (req.filesInspect && req.filesInspect.length > 0) { uploadLog += "\n🔹 فحص:"; req.filesInspect.forEach(f => { let u = uploadFileToDrive(f.data, "فحص_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

if (req.filesLicense && req.filesLicense.length > 0) { uploadLog += "\n🔹 رخصة:"; req.filesLicense.forEach(f => { let u = uploadFileToDrive(f.data, "رخصة_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

if (req.filesInsurance && req.filesInsurance.length > 0) { uploadLog += "\n🔹 تأمين:"; req.filesInsurance.forEach(f => { let u = uploadFileToDrive(f.data, "تأمين_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

let urlsStr = "";

if (allUrls.length > 0) {

const oldUrls = sheet.getRange(row, 8).getValue(); urlsStr = allUrls.join("\n");

sheet.getRange(row, 8).setValue((!oldUrls || oldUrls === "-") ? urlsStr : oldUrls + "\n" + urlsStr);

additions += `\n[تم إضافة مستندات جديدة ${dtNow}]:${uploadLog}`;

}

if (req.tradeIn && req.tradeIn.edited) { if (req.tradeIn.active) { 
const inventoryTradeIn = Object.assign({}, req.tradeIn, { active: true });
if (tradeClosureReason) customerClosureReason = tradeClosureReason;
sheet.getRange(row, 17).setValue(JSON.stringify(tradeClosureReason ? buildArchivedTradeIn(req.tradeIn, tradeClosureReason, updaterName, dtNow) : req.tradeIn));
additions += `\n[تحديث سيارة العميل ${dtNow} بواسطة ${updaterName}]: ${req.tradeIn.model} | الحالة: ${req.tradeIn.status || "-"} | شاصي: ${req.tradeIn.id || "-"}`;
processTradeInToInventory(inventoryTradeIn, inventoryRoom, req.custName, urlsStr);
if (!tradeClosureReason) shouldSendTradeInOpportunityAfterUpdate = true;

const targetChatIds = [CONFIG.MANAGER_CHAT_ID.toString()];
const staffSheetTemp = getSheet(SHEETS.STAFF);
if (staffSheetTemp) { const staffDataTemp = staffSheetTemp.getDataRange().getValues();
for (let i = 1; i < staffDataTemp.length; i++) { if (staffDataTemp[i][2] === staffRoom && staffDataTemp[i][3].toString().includes("مدير معرض")) { targetChatIds.push(staffDataTemp[i][0].toString()); } } }
const uniqueChatIds = [...new Set(targetChatIds)];
uniqueChatIds.forEach(chatId => { let allMedia = [];
if (req.filesCar) req.filesCar.forEach(f => allMedia.push({file: f, type: 'car'}));
if (req.filesInspect) req.filesInspect.forEach(f => allMedia.push({file: f, type: 'inspect'}));
if (req.filesLicense) req.filesLicense.forEach(f => allMedia.push({file: f, type: 'license'}));
if (req.filesInsurance) req.filesInsurance.forEach(f => allMedia.push({file: f, type: 'insurance'}));
for (let idx = 0; idx < allMedia.length; idx++) { let item = allMedia[idx];
let cap = idx === 0 ? `📸 مستندات استبدال محدثة: ${req.tradeIn.model}\nالعميل: ${req.custName}` : "";
sendTelegramMediaSafe(chatId, item.file.data, item.file.name, item.file.mimeType, cap);
Utilities.sleep(3500); } }); } else { sheet.getRange(row, 17).setValue(""); } } else if (allUrls.length > 0) { // إرسال الصور في حالة عدم وجود استبدال (بيع أو تحديث عادي)
const targetChatIds = [CONFIG.MANAGER_CHAT_ID.toString()];
const staffSheetTemp = getSheet(SHEETS.STAFF);
if (staffSheetTemp) { const staffDataTemp = staffSheetTemp.getDataRange().getValues();
for (let i = 1; i < staffDataTemp.length; i++) { if (staffDataTemp[i][2] === staffRoom && staffDataTemp[i][3].toString().includes("مدير معرض")) { targetChatIds.push(staffDataTemp[i][0].toString()); } } }
const uniqueChatIds = [...new Set(targetChatIds)];
uniqueChatIds.forEach(chatId => { let allMedia = [];
if (req.filesCar) req.filesCar.forEach(f => allMedia.push({file: f, type: 'car'}));
if (req.filesInspect) req.filesInspect.forEach(f => allMedia.push({file: f, type: 'inspect'}));
if (req.filesLicense) req.filesLicense.forEach(f => allMedia.push({file: f, type: 'license'}));
if (req.filesInsurance) req.filesInsurance.forEach(f => allMedia.push({file: f, type: 'insurance'}));
for (let idx = 0; idx < allMedia.length; idx++) { let item = allMedia[idx];
let cap = idx === 0 ? `📸 مستندات جديدة للعميل: ${req.custName}\nبواسطة: ${updaterName}` : "";
sendTelegramMediaSafe(chatId, item.file.data, item.file.name, item.file.mimeType, cap);
Utilities.sleep(3500); } }); }

if (req.agreement) additions += `\n[تحديث ${dtNow} بواسطة ${updaterName}]: ${req.agreement}`;

if (req.rejectReason) additions += `\n[رفض ${dtNow} بواسطة ${updaterName}]: ${req.rejectReason}`;

if (customerClosureReason) {
sheet.getRange(row, 10).setValue(STATUS.INACTIVE);
sheet.getRange(row, 14).setValue("-");
try {
const currentTradeRaw = String(sheet.getRange(row, 17).getValue() || "").trim();
if (currentTradeRaw.startsWith("{")) {
const currentTrade = JSON.parse(currentTradeRaw);
if (currentTrade && currentTrade.active) {
sheet.getRange(row, 17).setValue(JSON.stringify(buildArchivedTradeIn(currentTrade, customerClosureReason, updaterName, dtNow)));
}
}
} catch(e) {}
additions += `\n[إغلاق ملف العميل ${dtNow} بواسطة ${updaterName}]: ${customerClosureReason}. تم تحويل حالة العميل إلى (${STATUS.INACTIVE}) مع حفظ السجل والمرفقات.`;
}

if (additions !== "") { const oldAgr = sheet.getRange(row, 9).getValue(); sheet.getRange(row, 9).setValue((!oldAgr || oldAgr === "-") ? additions.trim() : oldAgr + "\n\n" + additions.trim()); }

if (req.isSellerMode) {

const invSheet = getSheet(SHEETS.INVENTORY);

if (invSheet) {

const invData = invSheet.getDataRange().getValues();

const sellerUpdated = updateSellerInventoryStatus(invSheet, invData, req.custName, req.car, "", req.status || "", req.transferRoom || inventoryRoom);

if (!sellerUpdated && req.car && !String(req.status || "").includes("تراجع الزبون")) {
createSellerInventoryRow(invSheet, req.custName, req.car, req.status || "السيارة معروضة 🏷️", req.transferRoom || inventoryRoom);
}

}

}

if (shouldSendTradeInOpportunityAfterUpdate && !customerClosureReason) {
sendTradeInOpportunityAlert({
tradeIn: req.tradeIn,
sellerName: req.custName,
sellerPhone: sheet.getRange(row, 5).getValue(),
sellerNick: sheet.getRange(row, 11).getValue(),
sellerWaPrefix: sheet.getRange(row, 13).getValue(),
sellerRoom: customerRoom || inventoryRoom || staffRoom,
staffName: updaterName,
sellerRowId: row
});
}

logAudit(updaterName, staffInfo ? staffInfo.role : "-", "update_customer", "customers", row, `الحالة: ${req.status || "-"} | السيارة: ${req.car || "-"}`);

logCustomerAction(row, req.custName, updaterName, "تحديث عميل", req.resDate || "-", additions || req.agreement || "-");

notifyManagersOfAction(staffRoom, updaterName, "تحديث عميل ⚙️", `العميل: ${req.custName}`);

lock.releaseLock(); return { success: true, msg: "✅ تم التحديث بنجاح!" };

} catch (e) { lock.releaseLock(); throw e; }

} catch (e) { return { success: false, msg: e.message }; }

}

function webAddCarForSale(identifier, payload) {

try {

// 🌟 توحيد ملفات الميني آب مع الداش بورد 🌟

if (payload.files && payload.files.length > 0 && (!payload.filesCar || payload.filesCar.length === 0)) {

payload.filesCar = payload.files;

}

const staffInfo = resolveUser(identifier); const isGen = (identifier && identifier.toString() === CONFIG.MANAGER_CHAT_ID.toString()) || (staffInfo && staffInfo.role === "مدير عام");

if (!staffInfo && !isGen) return { success: false, msg: "خطأ في الصلاحيات" };

const invSheet = getSheet(SHEETS.INVENTORY); const custSheet = getSheet(SHEETS.CUSTOMERS);

if (!invSheet || !custSheet) return { success: false, msg: "خطأ في القواعد" };

const lock = LockService.getScriptLock(); if (!lock.tryLock(10000))
return { success: false, msg: "النظام مشغول حالياً، يرجى المحاولة بعد قليل" };

try {

const staffName = staffInfo ? staffInfo.name : "المدير العام";

const staffRoom = (isGen && payload.room && payload.room.trim() !== "") ? payload.room : (staffInfo ? staffInfo.room : "معرض المعلم");

const dtNow = formatArabicDate(new Date(), "dd/MM/yyyy hh:mm a");

const p = String(payload.phone).trim();

const phoneIndex = getCustomerPhoneIndex();
let duplicateRowId = phoneIndex[p] || phoneIndex[`'${p}`] || null;

if (duplicateRowId) {

lock.releaseLock();

return { success: false, isDuplicate: true, msg: "هذا العميل مسجل في النظام مسبقاً.", duplicateData: { id: duplicateRowId } };

}

let allUrls = []; let uploadLog = "";

if (payload.filesCar && payload.filesCar.length > 0) { uploadLog += "\n🔹 صور السيارة:"; payload.filesCar.forEach(f => { let u = uploadFileToDrive(f.data, "صور_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

if (payload.filesInspect && payload.filesInspect.length > 0) { uploadLog += "\n🔹 شهادة الفحص:"; payload.filesInspect.forEach(f => { let u = uploadFileToDrive(f.data, "فحص_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

if (payload.filesLicense && payload.filesLicense.length > 0) { uploadLog += "\n🔹 رخصة:"; payload.filesLicense.forEach(f => { let u = uploadFileToDrive(f.data, "رخصة_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

if (payload.filesInsurance && payload.filesInsurance.length > 0) { uploadLog += "\n🔹 تأمين:"; payload.filesInsurance.forEach(f => { let u = uploadFileToDrive(f.data, "تأمين_" + f.name, f.mimeType); if (u) { allUrls.push(u); uploadLog += "\n" + u; } }); }

let filesUrlsStr = allUrls.length > 0 ? allUrls.join("\n") : "-";

const newInvRow = new Array(17).fill("");

newInvRow[0] = payload.carModel; newInvRow[1] = payload.custName || "عميل غير محدد"; newInvRow[2] = "برسم البيع"; newInvRow[3] = normalizeNumbers(payload.carId) || "بدون شاصي";

newInvRow[4] = "مستعملة"; newInvRow[5] = "متوفرة"; newInvRow[6] = payload.price || 0; newInvRow[7] = payload.gear || "اتوماتيك";

newInvRow[8] = payload.fuel || "بنزين"; newInvRow[9] = payload.licenseExp || ""; newInvRow[10] = payload.notes || "";

newInvRow[11] = payload.color || ""; newInvRow[12] = payload.year || "";
newInvRow[13] = payload.mileage || "";

newInvRow[14] = payload.specs || ""; newInvRow[15] = payload.inspection || ""; newInvRow[16] = filesUrlsStr;

const invData = invSheet.getDataRange().getValues();

const existingInvRow = findInventoryRow(invData, payload.carModel, payload.carId, payload.custName);

if (existingInvRow > -1) {

writeInventoryRow(invSheet, existingInvRow, newInvRow, filesUrlsStr === "-" ? "" : filesUrlsStr);

} else {

invSheet.insertRowBefore(2); invSheet.getRange(2, 1, 1, 17).setValues([newInvRow]);
bumpDataVersion(["customers", "inventory", "dashboard", "hr"]);

}

let agreement = `[إدخال سيارة للبيع ${dtNow}]: السيارة: ${payload.carModel} | السعر: ${payload.price}$`;

if (uploadLog !== "") agreement += `\n\n🗂️ المرفقات:${uploadLog}`;

custSheet.appendRow([ new Date(), staffRoom, staffName, payload.custName, `'${payload.phone}`, payload.carModel, "-", filesUrlsStr, agreement, "السيارة معروضة 🏷️", payload.nickname || "-", payload.address || "-", payload.waPrefix || "+970", "-", 1, new Date(), "" ]);

bumpDataVersion(["customers", "hr"]);
const sellerCustomerRow = custSheet.getLastRow();

logAudit(staffName, staffInfo ? staffInfo.role : "-", "create_seller_car", "inventory", existingInvRow > -1 ? existingInvRow : 2, `المالك: ${payload.custName} | السيارة: ${payload.carModel}`);

logCustomerAction(sellerCustomerRow, payload.custName, staffName, "عرض سيارة للبيع", "-", agreement);

const targetChatIds = [CONFIG.MANAGER_CHAT_ID.toString()];

const staffSheet2 = getSheet(SHEETS.STAFF);

if (staffSheet2) {

const staffData2 = staffSheet2.getDataRange().getValues();

for (let i = 1; i < staffData2.length; i++) { if (staffData2[i][2] === staffRoom && staffData2[i][3].toString().includes("مدير معرض")) targetChatIds.push(staffData2[i][0].toString()); }

}

const uniqueChatIds = [...new Set(targetChatIds)];

uniqueChatIds.forEach(chatId => {

let allMedia = [];

if (payload.filesCar) payload.filesCar.forEach(f => allMedia.push({file: f, type: 'car'}));

if (payload.filesInspect) payload.filesInspect.forEach(f => allMedia.push({file: f, type: 'inspect'}));

if (payload.filesLicense) payload.filesLicense.forEach(f => allMedia.push({file: f, type: 'license'}));

if (payload.filesInsurance) payload.filesInsurance.forEach(f => allMedia.push({file: f, type: 'insurance'}));

for (let idx = 0; idx < allMedia.length; idx++) {

let item = allMedia[idx];

let cap = idx === 0 ? `📸 سيارة برسم البيع: ${payload.carModel}\nالمالك: ${payload.custName}` : "";

sendTelegramMediaSafe(chatId, item.file.data, item.file.name, item.file.mimeType, cap);

Utilities.sleep(3500);

}

});

notifyManagersOfAction(staffRoom, staffName, "عرض سيارة للبيع 🤝", `العميل: ${payload.custName}\nالسيارة: ${payload.carModel}`);

checkAndNotifyRequestedCars(payload.carModel);

lock.releaseLock();

return { success: true, msg: "تم إدخال السيارة والمستندات وعرضها بنجاح" };

} catch (e) { lock.releaseLock(); throw e; }

} catch (e) { return { success: false, msg: e.message }; }

}

function webAddInventory(identifier, carData) {

try {

const staffInfo = resolveUser(identifier); const isManager = isGeneralManager(identifier, staffInfo) || isShowroomManager(staffInfo);

if (!isManager) return { success: false, msg: "مخصص للمدراء فقط" };

const sheet = getSheet(SHEETS.INVENTORY); if (!sheet) return { success: false, msg: "خطأ بالنظام" };

const newRow = new Array(17).fill("");

newRow[0] = carData.model;

newRow[1] = carData.owner || "الشركة";

newRow[2] = carData.dealType || "حيازة";

newRow[3] = normalizeNumbers(carData.id);

newRow[4] = carData.condition || "صفر كيلو";

newRow[5] = "متوفرة";

newRow[6] = carData.price || 0;

newRow[7] = carData.gear || "اتوماتيك";

newRow[8] = carData.fuel || "بنزين";

newRow[9] = carData.licenseExp || "";

newRow[10] = carData.notes || "";

newRow[11] = carData.color || "";

newRow[12] = carData.year || "";

newRow[13] = carData.mileage || "";

newRow[14] = carData.specs || "";

newRow[15] = carData.inspection || "";

sheet.insertRowBefore(2);

sheet.getRange(2, 1, 1, 17).setValues([newRow]);
bumpDataVersion(["inventory", "dashboard"]);

logAudit(staffInfo ? staffInfo.name : "-", staffInfo ? staffInfo.role : "-", "create_inventory", "inventory", 2, `السيارة: ${carData.model} | الشاصي: ${carData.id || "-"}`);

checkAndNotifyRequestedCars(carData.model);

return { success: true, msg: "✅ تمت الإضافة للمخزون" };

} catch (e) { return { success: false, msg: e.message }; }

}

function webGetDashboardStats(identifier) {

try {

let showAll = false;

let staffInfo = null;

let isGen = false;

let isShowMgr = false;

if (!identifier || identifier === "الكل" || identifier === "المدير العام" || identifier === "undefined") {

showAll = true;

isGen = true;

} else {

staffInfo = resolveUser(identifier);

isGen = isGeneralManager(identifier, staffInfo);

isShowMgr = isShowroomManager(staffInfo);

}

return withVersionedCache("dashboard", getUserScopeKey(identifier, staffInfo), Math.min(CONFIG.CACHE_DURATION, 300), function() {
const custSheet = getSheet(SHEETS.CUSTOMERS); const invSheet = getSheet(SHEETS.INVENTORY);

if (!custSheet || !invSheet) return { totalCustomers: 0, totalSales: 0, totalFollowUp: 0, totalReject: 0, totalReserve: 0, totalInactive: 0, totalActive: 0, totalCars: 0, soldCars: 0, conversionRate: 0 };

const custData = custSheet.getDataRange().getValues(); const invData = invSheet.getDataRange().getValues();

let totalCustomers = 0; let totalSales = 0; let totalFollowUp = 0; let totalReject = 0; let totalReserve = 0; let totalInactive = 0;

for (let i = 1; i < custData.length; i++) {
if (!custData[i][0]) continue;

let canView = false;
if (showAll || isGen) canView = true;
else if (isShowMgr && staffInfo) canView = (String(custData[i][1]).trim() === String(staffInfo.room).trim());
else if (staffInfo) canView = (String(custData[i][2]).trim() === String(staffInfo.name).trim());

if (!canView) continue;

totalCustomers++;
const status = (custData[i][9] || "").toString();
const agreement = (custData[i][8] || "").toString();
const payment = (custData[i][6] || "").toString();

if (status.includes(STATUS.INACTIVE)) totalInactive++;
if (status.includes("تم البيع") || agreement.includes("تم بيع سيارة للعميل") || (payment && payment !== "-")) totalSales++;
else if (status.includes("متابعة")) totalFollowUp++;
else if (status.includes("الرفض")) totalReject++;
else if (status.includes("حجز")) totalReserve++;
}

let totalCars = 0; let soldCars = 0;
for (let i = 1; i < invData.length; i++) {
if (invData[i][5] === "متوفرة") totalCars++;
if (String(invData[i][5] || "").includes("مباعة")) soldCars++;
}

const totalActive = Math.max(0, totalCustomers - totalInactive);
return { totalCustomers, totalSales, totalFollowUp, totalReject, totalReserve, totalInactive, totalActive, totalCars, soldCars, conversionRate: totalCustomers > 0 ? Math.round((totalSales / totalCustomers) * 100) : 0 };
});

} catch (e) {

return { totalCustomers: 0, totalSales: 0, totalFollowUp: 0, totalReject: 0, totalReserve: 0, totalCars: 0, soldCars: 0, conversionRate: 0, error: e.toString() };

}

}

function webGetHRData(identifier) {

try {

const staffInfo = resolveUser(identifier); const isGen = isGeneralManager(identifier, staffInfo); const isShowMgr = isShowroomManager(staffInfo);

if (!isGen && !isShowMgr) return { staff: [] };

return withVersionedCache("hr", getUserScopeKey(identifier, staffInfo), Math.min(CONFIG.CACHE_DURATION, 300), function() {
const staffSheet = getSheet(SHEETS.STAFF); const custSheet = getSheet(SHEETS.CUSTOMERS);
if (!staffSheet || !custSheet) return { staff: [] };

const staffData = staffSheet.getDataRange().getValues(); const custData = custSheet.getDataRange().getValues(); const staffList = [];
const statsByEmployee = {};

for (let j = 1; j < custData.length; j++) {
const empName = String(custData[j][2] || "").trim();
if (!empName) continue;
if (!statsByEmployee[empName]) statsByEmployee[empName] = { total: 0, sold: 0 };
statsByEmployee[empName].total++;
if (custData[j][9].toString().includes("بيع")) statsByEmployee[empName].sold++;
}

for (let i = 1; i < staffData.length; i++) {
if (staffData[i][3].toString().includes("مستقيل") || staffData[i][1].includes("المدير العام") || staffData[i][1] === "المدير") continue;
if (!isGen && staffData[i][2] !== staffInfo.room) continue;
const empStats = statsByEmployee[String(staffData[i][1] || "").trim()] || { total: 0, sold: 0 };
staffList.push({ name: staffData[i][1], room: staffData[i][2], role: staffData[i][3], totalCustomers: empStats.total, totalSales: empStats.sold });
}

return { staff: staffList };
});

} catch (e) { return { staff: [] }; }

}

function webExecuteHRAction(adminUser, action, payload) {

try {

if (!adminUser || !adminUser.role || !adminUser.role.includes("مدير")) {

return { success: false, msg: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };

}

const sheet = getSheet(SHEETS.STAFF);

if (!sheet) return { success: false, msg: "تعذر الوصول إلى صفحة الموظفين." };

const data = sheet.getDataRange().getValues();

const empName = payload.empName;

let rowIndex = -1;

let empChatId = "";

for (let i = 1; i < data.length; i++) {

if (data[i][1] === empName) {

rowIndex = i + 1;

empChatId = data[i][0];

break;

}

}

if (action !== "message" && rowIndex === -1) {

return { success: false, msg: "لم يتم العثور على الموظف في قاعدة البيانات." };

}

let successMsg = "";

let notifyMsg = "";

function sendTgAlert(cId, txt) {

try {

UrlFetchApp.fetch(CONFIG.TELEGRAM_API_BASE + CONFIG.TELEGRAM_TOKEN + "/sendMessage", {

method: "post", contentType: "application/json",

payload: JSON.stringify({ chat_id: cId.toString(), text: txt, parse_mode: "Markdown" }), muteHttpExceptions: true

});

} catch(e){}

}

if (action === "message") {

if (empName === "الكل 👥") {

for (let i = 1; i < data.length; i++) {

if (data[i][0]) sendTgAlert(data[i][0], "📢 *توجيه إداري عام:*\n\n" + payload.message);

}

return { success: true, msg: "تم إرسال الرسالة لجميع الموظفين بنجاح." };

} else {

if (empChatId) sendTgAlert(empChatId, "📩 *رسالة إدارية لك:*\n\n" + payload.message);

return { success: true, msg: "تم إرسال الرسالة للموظف بنجاح." };

}

}

else if (action === "changeRole") {

sheet.getRange(rowIndex, 4).setValue(payload.newRole);

successMsg = "تم تعديل صلاحية الموظف إلى: " + payload.newRole;

notifyMsg = "🔄 *تحديث إداري:*\nتم تعديل صلاحيتك في النظام لتصبح: *" + payload.newRole + "*";

}

else if (action === "transfer") {

sheet.getRange(rowIndex, 3).setValue(payload.newRoom);

successMsg = "تم نقل الموظف إلى: " + payload.newRoom;

notifyMsg = "🏢 *تحديث إداري:*\nتم نقلك للعمل في: *" + payload.newRoom + "*\nيرجى إعادة فتح النظام لتحديث بياناتك.";

}

else if (action === "suspend") {

sheet.getRange(rowIndex, 4).setValue("مستقيل");

successMsg = "تم إيقاف حساب الموظف بنجاح.";

notifyMsg = "⛔ *تحديث إداري:*\nتم إيقاف حسابك في النظام مؤقتاً.";

}

else if (action === "setPassword") {

sheet.getRange(rowIndex, 5).setValue(payload.newPass);

successMsg = "تم تعيين كلمة المرور بنجاح.";

notifyMsg = "🔑 *تحديث إداري:*\nتم تعيين كلمة مرور جديدة لحسابك:\n`" + payload.newPass + "`";

}

else if (action === "approveNew") {

sheet.getRange(rowIndex, 3).setValue(payload.newRoom);

sheet.getRange(rowIndex, 4).setValue(payload.newRole);

sheet.getRange(rowIndex, 5).setValue(payload.newPass);

successMsg = "تم تفعيل الموظف بنجاح.";

notifyMsg = "✅ *تحديث إداري:*\nتم تفعيل حسابك بنجاح!\n\n🏢 المعرض: *" + payload.newRoom + "*\n🔰 الصلاحية: *" + payload.newRole + "*\n🔑 كلمة المرور: `" + payload.newPass + "`\n\nيمكنك الآن تسجيل الدخول للنظام.";

}

if (empChatId && notifyMsg) {

sendTgAlert(empChatId, notifyMsg);

}

bumpDataVersion("staff");

return { success: true, msg: successMsg };

} catch (error) {

return { success: false, msg: error.message };

}

}

function webGetNotifications(identifier, fetchAll = false) {

try {

const staffInfo = resolveUser(identifier);
return withVersionedCache("notifications", `${getUserScopeKey(identifier, staffInfo)}|${fetchAll ? "all" : "unread"}`, 120, function() {
const sheet = getSheet(SHEETS.NOTIFICATIONS); if (!sheet) return { list: [], unread: 0 };
const data = sheet.getDataRange().getValues(); const result = []; const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

let unreadCount = 0;
for (let i = data.length - 1; i >= 1; i--) {
const ts = new Date(data[i][0]).getTime(); if (ts < sevenDaysAgo) continue;
const target = data[i][1]; const status = data[i][3]; const msg = data[i][2];
let isForMe = false;

if (staffInfo && staffInfo.role.includes("مدير عام")) isForMe = true;
else if (staffInfo && (target === staffInfo.room || target === staffInfo.name)) isForMe = true;
else if (target === "الكل") isForMe = true;
else if (target === "مدير عام" && identifier === CONFIG.MANAGER_CHAT_ID) isForMe = true;

if (!isForMe) continue;
if (status === "Unread") unreadCount++;
if ((fetchAll || status === "Unread") && result.length < 30) result.push({ id: i + 1, time: formatArabicDate(new Date(data[i][0]), "MM/dd hh:mm a"), msg: msg, status: status });
}

return { list: result, unread: unreadCount };
});

} catch (e) { return { list: [], unread: 0 }; }

}

function webMarkNotificationRead(rowId, identifier) {

try { const sheet = getSheet(SHEETS.NOTIFICATIONS); if (sheet && rowId > 1) { sheet.getRange(rowId, 4).setValue("Read"); bumpDataVersion("notifications"); return webGetNotifications(identifier, false); } } catch (e) {} return { list: [], unread: 0 };

}

// ==========================================

// 🤖 Telegram Bot Flow (Webhook)

// ==========================================

function setupBotWebhook() {

try { const url = `${CONFIG.TELEGRAM_API_BASE}${CONFIG.TELEGRAM_TOKEN}/setWebhook?url=${encodeURIComponent(CONFIG.WEB_APP_URL)}`;
return { success: true, description: JSON.parse(UrlFetchApp.fetch(url).getContentText()).description }; }
catch (e) { return { success: false, error: e.message }; }

}

function fixGhostMessages() {

const token = CONFIG.TELEGRAM_TOKEN;

const webhookUrl = CONFIG.WEB_APP_URL;

try {

const deleteUrl = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;

UrlFetchApp.fetch(deleteUrl);

Utilities.sleep(2000);

const setUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

UrlFetchApp.fetch(setUrl);

} catch (e) {}

}

function showMainMenu(chatId) {

if (!chatId) return;

try {

const staffInfo = getStaffInfoFromSheet(chatId);

let isGen = false; let isShowMgr = false;

if (staffInfo && staffInfo.role) {

isGen = staffInfo.role.includes("مدير عام");

isShowMgr = staffInfo.role.includes("مدير معرض");

}

const miniAppPage = "MiniApp";

let keyboard = [];

keyboard.push(["مركز اليوم 🧭", "بحث عملاء المعرض 🔍"]);

keyboard.push([

{ text: "إدخال عميل 🪄", web_app: { url: buildMiniAppUrl(chatId, "add_wizard") } },

{ text: "تقرير عملائي 📋", web_app: { url: buildMiniAppUrl(chatId, "my_cust") } }

]);

keyboard.push([

{ text: "بحث متقدم 🔎", web_app: { url: buildMiniAppUrl(chatId, "search") } },

{ text: "عرض المخزون 🚗", web_app: { url: buildMiniAppUrl(chatId, "inv") } }

]);

let row3 = [];

if (isGen || isShowMgr) {

row3.push({ text: "إضافة سيارة للمخزون ➕", web_app: { url: buildMiniAppUrl(chatId, "add_inv") } });

}

if (row3.length > 0) keyboard.push(row3);

if (isGen || isShowMgr) {

keyboard.push([

{ text: "تقرير الإدارة 📊", web_app: { url: buildMiniAppUrl(chatId, "mgr_report") } },

{ text: "إدارة الموظفين ⚙️", web_app: { url: buildMiniAppUrl(chatId, "hr") } }

]);

}

keyboard.push([{ text: "🌍 النظام الشامل المطور", web_app: { url: buildMiniAppUrl(chatId, "add_wizard", { mode: "full" }) } }]);

const textMsg = staffInfo ? `مرحباً *${staffInfo.name}*\n🏢 المعرض: ${staffInfo.room}\n🧭 ابدأ من مركز اليوم أو افتح الإجراء المطلوب.` : "القائمة الرئيسية:";

const payload = {

chat_id: chatId.toString(),

text: textMsg,

parse_mode: "Markdown",

reply_markup: {

keyboard: keyboard,

resize_keyboard: true,

is_persistent: true

}

};

const options = {

method: "post",

contentType: "application/json",

payload: JSON.stringify(payload),

muteHttpExceptions: true

};

UrlFetchApp.fetch(`${CONFIG.TELEGRAM_API_BASE}${CONFIG.TELEGRAM_TOKEN}/sendMessage`, options);

sendBotQuickActions(chatId);

} catch (e) {

const errorPayload = {

chat_id: chatId.toString(),

text: "⚠️ حدث خطأ في بناء أزرار القائمة: " + e.message

};

UrlFetchApp.fetch(`${CONFIG.TELEGRAM_API_BASE}${CONFIG.TELEGRAM_TOKEN}/sendMessage`, { method: "post", contentType: "application/json", payload: JSON.stringify(errorPayload), muteHttpExceptions: true });

}

}

function generateEmployeeReport(chatId, staffInfo) {

try {

const sheet = getSheet(SHEETS.CUSTOMERS); if (!sheet) return;

const data = sheet.getDataRange().getValues(); let count = 0;
sendTextSafe(chatId, "📊 *يتم الاستخراج...*");

for (let i = data.length - 1; i >= 1; i--) {

if (staffInfo && data[i][2] === staffInfo.name) {

sendCustomerBotCard(chatId, data[i], i + 1);

count++; if (count >= CONFIG.MAX_REPORT_ITEMS) break;

}

}

if (count === 0) sendTextSafe(chatId, "📭 لا يوجد عملاء.");

showMainMenu(chatId);

} catch (e) {}

}

function searchCustomers(chatId, query, staffInfo) {

try {

const sheet = getSheet(SHEETS.CUSTOMERS); if (!sheet) return;

const data = sheet.getDataRange().getValues(); let count = 0; const cleanQ = normalizeBotText(query);
if (!cleanQ) {
sendBotSearchPrompt(chatId);
return;
}

for (let i = data.length - 1; i >= 1; i--) {

if (!isRowVisibleForStaff(data[i], chatId, staffInfo)) continue;

let tradeInSearch = "";
try {
if (data[i][16] && String(data[i][16]).trim().startsWith("{")) {
const tr = JSON.parse(data[i][16]);
tradeInSearch = [tr.model, tr.id, tr.color, tr.year, tr.status, tr.owner, tr.licenseExp, tr.notes].join(" ");
}
} catch (e) {}

const rowSearch = normalizeBotText([
data[i][1], data[i][2], data[i][3], data[i][4], data[i][5], data[i][6], data[i][8],
data[i][9], data[i][10], data[i][11], data[i][13], data[i][15], tradeInSearch
].join(" "));

if (rowSearch.indexOf(cleanQ) !== -1) {

sendCustomerBotCard(chatId, data[i], i + 1);

count++; if (count >= 10) break;

}

}

if (count === 0) sendTextSafe(chatId, "📭 لا توجد نتائج مطابقة.");

showMainMenu(chatId);

} catch (e) {}

}

function doPost(e) {
  let debugChatId = "";

  try {
    if (!e || !e.postData || !e.postData.contents) return ContentService.createTextOutput("OK");

    const contents = JSON.parse(e.postData.contents); 
    const cache = CacheService.getScriptCache();
    const updateId = contents.update_id;

    if (updateId) {
      if (cache.get("update_" + updateId)) return ContentService.createTextOutput("OK");
      cache.put("update_" + updateId, "1", 300);
    }

    let chatId; 
    let text = "";

    if (contents.callback_query) {
      chatId = contents.callback_query.message.chat.id.toString();
      text = contents.callback_query.data;
      try { 
        UrlFetchApp.fetch(`${CONFIG.TELEGRAM_API_BASE}${CONFIG.TELEGRAM_TOKEN}/answerCallbackQuery`, { 
          method: "post", 
          payload: { callback_query_id: contents.callback_query.id }, 
          muteHttpExceptions: true 
        }); 
      } catch (err) {}
    }
    else if (contents.message) {
      chatId = contents.message.chat.id.toString();
      text = contents.message.text || "";
    } else {
      return ContentService.createTextOutput("OK");
    }

    debugChatId = chatId;
    logBotEvent(chatId, contents.callback_query ? "callback" : "message", text, contents.message && contents.message.photo ? "photo" : "text");

    // 1. التحقق من هوية وصلاحية الموظف أولاً
    const staffInfo = getStaffInfoFromSheet(chatId);

    if (staffInfo && staffInfo.role.includes("مستقيل")) {
      sendTextSafe(chatId, "🚫 حسابك موقوف ومحجوب من النظام.");
      return ContentService.createTextOutput("OK");
    }

    if (staffInfo && staffInfo.role.includes("قيد الانتظار")) {
      sendTextSafe(chatId, "⏳ حسابك لا يزال قيد المراجعة والانتظار من قبل الإدارة العليا. سيتم إشعارك فور التفعيل.");
      return ContentService.createTextOutput("OK");
    }

    // 2. مسار تسجيل الموظفين الجدد إذا لم يكن مسجلاً
    if (!staffInfo) {
      if (text === "/start" || text.toLowerCase() === "start") {
        sendTextSafe(chatId, "👋 أهلاً بك في نظام أوتو سيستم الإداري.\n\n👤 يرجى إرسال اسمك الثلاثي أو الرباعي الحقيقي لتقديم طلب الانضمام للنظام وتفعيل حسابك:");
        return ContentService.createTextOutput("OK");
      }

      const fullName = text.trim();
      if (fullName.length < 5) {
        sendTextSafe(chatId, "⚠️ الاسم قصير جداً ليكون اسماً رسمياً. يرجى كتابة اسمك الثلاثي الحقيقي بشكل كامل:");
        return ContentService.createTextOutput("OK");
      }

      const sheet = getSheet(SHEETS.STAFF);
      if (!sheet) {
        sendTextSafe(chatId, "⚠️ عطل اتصال: تعذر على البوت قراءة قاعدة البيانات.");
        return ContentService.createTextOutput("OK");
      }

      const nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, 5).setValues([[chatId, fullName, "غير محدد", "قيد الانتظار ⏳", ""]]);
      sendTextSafe(chatId, "✅ تم استلام طلبك بنجاح يا " + fullName + ".\n\n⏳ يرجى الانتظار حتى تقوم الإدارة بمراجعة طلبك وتفعيل حسابك وتزويدك بكلمة المرور.");

      try { 
        notifyManagersOfAction("النظام الأساسي", fullName, "طلب انضمام جديد 👤", "الموظف (" + fullName + ") يطلب الانضمام للنظام."); 
      } catch(errN) {}

      return ContentService.createTextOutput("OK");
    }

    // 🌟 [التعديل الجديد والموحد]: التحقق من استقبال الصور وحفظها في صفحة المخزون
    if (contents.message && contents.message.photo) {
      let userState = {};
      
      // جلب حالة الجلسة الحالية بشكل آمن لمنع توقف الكود
      if (typeof getUserState === 'function') {
        userState = getUserState(chatId) || {};
      } else {
        userState = {
          state: cache.get(chatId + "_state"),
          lastActiveRow: cache.get(chatId + "_lastActiveRow") ? parseInt(cache.get(chatId + "_lastActiveRow")) : null,
          lastInventoryRow: cache.get(chatId + "_lastInventoryRow") ? parseInt(cache.get(chatId + "_lastInventoryRow")) : null
        };
      }

      // استدعاء الدالة الموحدة لحفظ الصورة في العامود 17 بالمخزون
      const success = saveCarPhotoToInventoryUnified(contents.message, userState);
      
      if (success) {
        sendTextSafe(chatId, "✅ تم حفظ صورة السيارة بنجاح وإضافتها للمخزون (العامود 17)!");
      } else {
        sendTextSafe(chatId, "⚠️ لم يتم التعرف على السطر الحالي للسيارة، تم حفظ الصورة في آخر سطر مضاف للمخزون كإجراء احتياطي.");
      }
      return ContentService.createTextOutput("OK");
    }
// 🌟 استقبال الصور من البوت وحفظها فوراً في الصف الثاني (أحدث سيارة في المخزون)
    if (contents.message && contents.message.photo) {
      try {
        var photoArray = contents.message.photo;
        var photo = photoArray[photoArray.length - 1]; // أعلى دقة
        var fileId = photo.file_id;
        var getFileUrl = CONFIG.TELEGRAM_API_BASE + CONFIG.TELEGRAM_TOKEN + "/getFile?file_id=" + fileId;
        var fileData = JSON.parse(UrlFetchApp.fetch(getFileUrl).getContentText());
        var downloadUrl = "https://api.telegram.org/file/bot" + CONFIG.TELEGRAM_TOKEN + "/" + fileData.result.file_path;
        var imageBlob = UrlFetchApp.fetch(downloadUrl).getBlob();
        imageBlob.setName("Car_" + new Date().getTime() + ".jpg");

        var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
        var file = folder.createFile(imageBlob);
        try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
        var fileUrl = file.getUrl();

        var invSheet = getSheet(SHEETS.INVENTORY);
        if (invSheet) {
          // استهداف الصف الثاني مباشرة كما لاحظت بعبقريتك!
          var cell = invSheet.getRange(2, 17); 
          var currentValues = cell.getValue().toString().trim();
          cell.setValue((currentValues && currentValues !== "-") ? currentValues + "\n" + fileUrl : fileUrl);
          sendTextSafe(chatId, "✅ تم حفظ الصورة بنجاح وربطها بأحدث سيارة في المخزون (الصف الثاني)!");
        }
      } catch (err) {
        sendTextSafe(chatId, "⚠️ فشل حفظ الصورة.");
      }
      return ContentService.createTextOutput("OK");
    }
    // 3. مسارات النصوص والأزرار التفاعلية المعتادة للبوت
    if (isBotCommand(text, ["🌍 النظام الشامل المطور (Super App)", "🌍 النظام الشامل المطور", "/start", "start", "BOT_MENU"])) {
      cache.remove(chatId + "_state");
      showMainMenu(chatId);
      return ContentService.createTextOutput("OK");
    }

    if (isBotCommand(text, ["مركز اليوم", "مركز اليوم 🧭", "/today", "/tasks", "مهامي", "مهامي اليوم", "BOT_TODAY"])) {
      sendDailyWorkCenter(chatId, staffInfo);
      return ContentService.createTextOutput("OK");
    }

    if (isBotCommand(text, ["تقرير عملائي", "تقرير عملائي 📋", "/my", "BOT_MY"])) {
      generateEmployeeReport(chatId, staffInfo);
      return ContentService.createTextOutput("OK");
    }

    if (isBotCommand(text, ["عرض المخزون", "عرض المخزون 🚗", "/inventory", "BOT_INVENTORY"])) {
      sendInventoryBotSummary(chatId, staffInfo);
      return ContentService.createTextOutput("OK");
    }

    if (isBotCommand(text, ["بحث عملاء المعرض", "بحث العملاء", "بحث عملاء المعرض 🔍", "/search", "BOT_SEARCH", "بحث"])) { 
      cache.put(chatId + "_state", "SEARCH"); 
      sendBotSearchPrompt(chatId); 
      return ContentService.createTextOutput("OK"); 
    }

    if (isBotCommand(text, ["إلغاء", "إلغاء ❌", "BOT_CANCEL", "/cancel"])) { 
      cache.remove(chatId + "_state");
      showMainMenu(chatId); 
      return ContentService.createTextOutput("OK"); 
    }

    const state = cache.get(chatId + "_state");
    if (state === "SEARCH") { 
      if (!String(text || "").trim()) {
        sendBotSearchPrompt(chatId);
        return ContentService.createTextOutput("OK");
      }
      searchCustomers(chatId, text, staffInfo);
      cache.remove(chatId + "_state"); 
      return ContentService.createTextOutput("OK"); 
    }

    if (String(text || "").trim()) {
      logBotEvent(chatId, "unknown", text, "أمر غير معروف");
      sendTextWithInline(chatId, "لم أفهم الأمر المطلوب. اختر من القائمة السريعة أو اكتب /start.", [[
        { text: "القائمة", callback_data: "BOT_MENU" },
        { text: "بحث العملاء", callback_data: "BOT_SEARCH" }
      ]]);
    }

    return ContentService.createTextOutput("OK");

  } catch (err) {
    logBotEvent(debugChatId, "error", "doPost", err.toString());
    if (debugChatId) {
      sendTextSafe(debugChatId, "⚠️ عطل برمجي داخلي في doPost: " + err.toString());
    }
    return ContentService.createTextOutput("OK");
  }
}

function notifyManagersOfAction(staffRoom, staffName, actionTitle, detailsStr) {

try {

const sheet = getSheet(SHEETS.STAFF);

if (!sheet) return;

const data = sheet.getDataRange().getValues();

const targetIds = new Set();

targetIds.add(CONFIG.MANAGER_CHAT_ID.toString());

for (let i = 1; i < data.length; i++) {

if (!data[i][0] || !data[i][3]) continue;

const role = data[i][3].toString();

const room = data[i][2] ? data[i][2].toString() : "";

const chatId = data[i][0].toString();

if (role.includes("مستقيل") || role.includes("قيد الانتظار")) continue;

if (role.includes("مدير عام")) {

targetIds.add(chatId);

} else if (role.includes("مدير معرض") && room === staffRoom) {

targetIds.add(chatId);

}

}

const msg = `📋 *إشعار حركة نظام آلي*\n📍 *المعرض:* ${staffRoom}\n👨💼 *الموظف:* ${staffName}\n⚙️ *نوع الإجراء:* ${actionTitle}\n\n${detailsStr}`;

targetIds.forEach(id => { sendTextSafe(id, msg); });

} catch(e) {}

}

function webSendCustomerAlert(identifier, payload) {

try {

const senderInfo = resolveUser(identifier);

if (!senderInfo && identifier !== CONFIG.MANAGER_CHAT_ID) return { success: false, msg: "غير مصرح" };
const dir = getStaffDirectory();
const recipient = dir.byName && dir.byName[payload.empName];

if (!recipient || !recipient.chatId) return { success: false, msg: "لم يتم العثور على حساب تيليجرام للموظف" };

const senderName = senderInfo ? senderInfo.name : "الإدارة العليا";

const msg = `🚨 *توجيه إداري عاجل*\n\n👤 *من:* ${senderName}\n📌 *بخصوص العميل:* ${payload.custName}\n\n💬 *الرسالة:*\n${payload.message}`;

const sent = sendTextSafe(recipient.chatId, msg);

logNotification(payload.empName, msg);

if (sent) return { success: true, msg: "تم إرسال التوجيه لتيليجرام الموظف بنجاح" };

else return { success: false, msg: "فشل الإرسال، قد يكون الموظف أوقف البوت" };

} catch (e) {

return { success: false, msg: e.message };

}

}

function webSendTaskReminder(identifier, payload) {

try {

const senderInfo = resolveUser(identifier);
if (!senderInfo && identifier !== CONFIG.MANAGER_CHAT_ID) return { success: false, msg: "غير مصرح" };

const isGen = isGeneralManager(identifier, senderInfo);
const isMgr = isShowroomManager(senderInfo);
if (!isGen && !isMgr) return { success: false, msg: "التذكير متاح للمدراء فقط." };

const rowId = parseInt(payload.rowId, 10);
const target = payload.target || "employee";
const custSheet = getSheet(SHEETS.CUSTOMERS);
if (!custSheet || !rowId || rowId < 2) return { success: false, msg: "تعذر قراءة المهمة." };

const row = custSheet.getRange(rowId, 1, 1, 17).getValues()[0];
const room = String(row[1] || "").trim();
const empName = String(row[2] || "").trim();
if (!isGen && room !== String(senderInfo.room || "").trim()) return { success: false, msg: "لا تملك صلاحية على هذه المهمة." };

const dir = getStaffDirectory();
let recipient = null;
if (target === "manager") {
if (!isGen) return { success: false, msg: "إرسال التذكير لمدير المعرض متاح للمدير العام فقط." };
recipient = dir.managersByRoom && dir.managersByRoom[room];
} else {
recipient = dir.byName && dir.byName[empName];
}

if (!recipient || !recipient.chatId) return { success: false, msg: "لا يوجد حساب تيليجرام للمستلم." };

let tradeIn = { active: false };
try { if (row[16] && String(row[16]).trim().startsWith("{")) tradeIn = JSON.parse(row[16]); } catch(e) {}
const tradeText = tradeIn && tradeIn.active ? `\n🚗 سيارة الاستبدال: ${tradeIn.model || "-"}\n📊 حالة الاستبدال: ${tradeIn.status || "-"}` : "";
const senderName = senderInfo ? senderInfo.name : "الإدارة العليا";
const msg = `⏰ *تذكير مهمة أجندة*\n\n👤 العميل: ${row[3] || "-"}\n👨‍💼 الموظف: ${empName || "-"}\n🏢 المعرض: ${room || "-"}\n📊 حالة العميل: ${row[9] || "-"}${tradeText}\n\nمرسل من: ${senderName}\nيرجى فتح الملف وتحديث الحالة.`;

const sent = sendTextSafe(recipient.chatId, msg);
logNotification(recipient.name || empName, msg);
return sent ? { success: true, msg: "تم إرسال التذكير عبر تيليجرام." } : { success: false, msg: "فشل إرسال التذكير." };

} catch(e) { return { success: false, msg: e.message }; }

}

function webSendCustomerAttachments(identifier, payload) {

try {
const senderInfo = resolveUser(identifier);
if (!senderInfo && identifier !== CONFIG.MANAGER_CHAT_ID) return { success: false, msg: "غير مصرح" };

const rowId = parseInt(payload.rowId, 10);
const target = payload.target || "manager";
const sheet = getSheet(SHEETS.CUSTOMERS);
if (!sheet || !rowId || rowId < 2) return { success: false, msg: "تعذر قراءة ملف العميل." };

const row = sheet.getRange(rowId, 1, 1, 17).getValues()[0];
const room = String(row[1] || "").trim();
const empName = String(row[2] || "").trim();

if (senderInfo && senderInfo.role && senderInfo.role.indexOf("مدير عام") === -1 && senderInfo.role.indexOf("مدير معرض") !== -1 && room !== senderInfo.room) return { success: false, msg: "لا تملك صلاحية على هذا الملف." };
if (senderInfo && senderInfo.role === "موظف عادي" && empName !== senderInfo.name) return { success: false, msg: "لا تملك صلاحية على هذا الملف." };

const dir = getStaffDirectory();
let recipient = null;
if (target === "employee") recipient = dir.byName && dir.byName[empName];
else if (target === "manager") recipient = dir.managersByRoom && dir.managersByRoom[room];
else recipient = { chatId: CONFIG.MANAGER_CHAT_ID.toString(), name: "الإدارة العامة" };

if (!recipient || !recipient.chatId) return { success: false, msg: "لا يوجد حساب تيليجرام للمستلم." };

const urls = String(row[7] || "").split(/[\n,]/).map(function(u) { return u.trim(); }).filter(function(u) { return u && u !== "-"; });
if (urls.length === 0) return { success: false, msg: "لا توجد مرفقات لإرسالها." };

sendTextSafe(recipient.chatId, `📎 *مرفقات ملف عميل*\n\n👤 العميل: ${row[3] || "-"}\n👨‍💼 الموظف: ${empName || "-"}\n🏢 المعرض: ${room || "-"}\nعدد المرفقات: ${urls.length}`);

let sentCount = 0;
for (let i = 0; i < urls.length; i++) {
if (sendTelegramDriveFileSafe(recipient.chatId, urls[i], i === 0 ? "مرفقات العميل: " + (row[3] || "-") : "")) sentCount++;
}

logNotification(recipient.name || target, `تم إرسال مرفقات ملف العميل ${row[3] || "-"} (${sentCount}/${urls.length}).`);
return { success: sentCount > 0, msg: sentCount > 0 ? "تم إرسال المرفقات عبر تيليجرام." : "تعذر إرسال المرفقات." };

} catch(e) { return { success: false, msg: e.message }; }

}

function webCheckPhoneExists(phone) {

try {

const sheet = getSheet(SHEETS.CUSTOMERS);

if (!sheet) return { exists: false };

const p = String(phone).trim();
const phoneIndex = getCustomerPhoneIndex();
const rowId = phoneIndex[p] || phoneIndex[`'${p}`] || null;
if (rowId) {
const rowData = sheet.getRange(rowId, 1, 1, 17).getValues()[0];
const item = formatCustomerDataForWeb(rowData, rowId);
return { exists: true, item: item };
}

return { exists: false };

} catch(e) {

return { exists: false };

}

}

function webGetManagerData(identifier) {

try {

return {

staff: getAllStaffNames(),

rooms: getRoomsList(),

staffRooms: {}

};

} catch (e) {

return { staff: [], rooms: [], staffRooms: {} };

}

}

function testDrivePermissions() {

try {

var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

Logger.log("✅ الاتصال ناجح بالمجلد: " + folder.getName());

var testFile = folder.createFile("test_connection.txt", "الاتصال يعمل والصلاحيات ممتازة");

Logger.log("✅ تم حفظ الملف في درايف بنجاح! رابط الملف: " + testFile.getUrl());

testFile.setTrashed(true);

Logger.log("✅ تم فحص الصلاحيات بالكامل والنظام جاهز لاستقبال الصور.");

} catch (e) {

Logger.log("❌ خطأ فادح: السكريبت لا يملك صلاحية للوصول للمجلد أو أن الـ ID خاطئ. التفاصيل: " + e.toString());

}

}
// دالة موحدة لحفظ صور السيارات (المعروضة والمستبدلة) في صفحة المخزون فقط (العامود 17)
function saveCarPhotoToInventoryUnified(message, userState) {
  try {
    var photoArray = message.photo;
    if (!photoArray || photoArray.length === 0) return false;
    
    // 1. جلب أعلى دقة للصورة المرفوعة
    var photo = photoArray[photoArray.length - 1];
    var fileId = photo.file_id;
    
    // 2. طلب مسار الملف من تليجرام
    var getFileUrl = CONFIG.TELEGRAM_API_BASE + CONFIG.TELEGRAM_TOKEN + "/getFile?file_id=" + fileId;
    var response = UrlFetchApp.fetch(getFileUrl);
    var fileData = JSON.parse(response.getContentText());
    if (!fileData.ok) return false;
    
    var filePath = fileData.result.file_path;
    var downloadUrl = "https://api.telegram.org/file/bot" + CONFIG.TELEGRAM_TOKEN + "/" + filePath;
    var imageBlob = UrlFetchApp.fetch(downloadUrl).getBlob();
    
    // 3. تسمية الصورة برقم فريد يعتمد على الوقت
    var fileName = "Car_" + new Date().getTime() + ".jpg";
    imageBlob.setName(fileName);
    
    // 4. حفظ الملف في مجلد جوجل درايف وتعديل صلاحية العرض
    var folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    var file = folder.createFile(imageBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl = file.getUrl();
    
    // 5. التوجيه الموحد إلى صفحة المخزون (inventory)
    var sheet = getSheet(SHEETS.INVENTORY);
    if (!sheet) return false;
    
    // 6. تحديد السطر المستهدف في صفحة المخزون بناءً على حالة المستخدم في البوت
    var rowNumber = userState.lastInventoryRow || userState.lastActiveRow;
    if (!rowNumber) {
      rowNumber = sheet.getLastRow(); // خيار احتياطي لآخر سطر مضاف
    }
    
    // العامود رقم 17 المحدد لصور المخزون
    var targetColumn = 17; 
    
    if (rowNumber > 1) {
      var cell = sheet.getRange(rowNumber, targetColumn);
      var currentValues = cell.getValue().toString().trim();
      
      // إذا كان السطر يحتوي مسبقاً على صور، يتم دمج الرابط الجديد في سطر منفصل
      if (currentValues && currentValues !== "-") {
        cell.setValue(currentValues + "\n" + fileUrl);
      } else {
        cell.setValue(fileUrl);
      }
      return true;
    }
  } catch (e) {
    Logger.log("خطأ في حفظ صورة السيارة بالمخزون: " + e.message);
  }
  return false;
}
