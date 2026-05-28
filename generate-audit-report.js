const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
} = require("docx");
const fs = require("fs");

// ── helpers ──────────────────────────────────────────────────────────────────

const FONT = "Arial";
const DARK_BLUE = "1e3a5f";
const WHITE = "FFFFFF";
const LIGHT_BLUE = "dce6f1";
const LIGHT_GRAY = "f5f5f5";
const MED_GRAY = "e0e0e0";
const ACCENT = "2e6da4";

// Page: A4 portrait (11906 × 16838 DXA), margins 1440 each side
// Content width = 11906 - 1440 - 1440 = 9026 DXA
const CONTENT_W = 9026;

const cellBorder = (color = "CCCCCC") => ({
  top: { style: BorderStyle.SINGLE, size: 4, color },
  bottom: { style: BorderStyle.SINGLE, size: 4, color },
  left: { style: BorderStyle.SINGLE, size: 4, color },
  right: { style: BorderStyle.SINGLE, size: 4, color },
});

const noBorder = () => ({
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
});

function hCell(text, w, span = 1) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    columnSpan: span,
    borders: cellBorder("1e3a5f"),
    shading: { fill: DARK_BLUE, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 150, right: 150 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, font: FONT, size: 20, bold: true, color: WHITE })],
    })],
  });
}

function dCell(text, w, opts = {}) {
  const { bold = false, center = false, fill = null, color = "1a1a1a" } = opts;
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: cellBorder("AAAAAA"),
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 130, right: 130 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.RIGHT,
      bidirectional: true,
      children: [new TextRun({ text, font: FONT, size: 18, bold, color })],
    })],
  });
}

function p(text, opts = {}) {
  const {
    size = 20, bold = false, color = "1a1a1a", center = false,
    spaceBefore = 80, spaceAfter = 80, italic = false,
  } = opts;
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: spaceBefore, after: spaceAfter },
    children: [new TextRun({ text, font: FONT, size, bold, color, italics: italic })],
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    pageBreakBefore: true,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: DARK_BLUE })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: ACCENT })],
  });
}

function heading3(text) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, font: FONT, size: 22, bold: true, color: "2c4770" })],
  });
}

function bullet(text) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 40, after: 40 },
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun({ text, font: FONT, size: 19, color: "1a1a1a" })],
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 1 } },
    children: [],
  });
}

function spacer(lines = 1) {
  return new Paragraph({ spacing: { before: 80 * lines, after: 0 }, children: [] });
}

// ── Permission Matrix ─────────────────────────────────────────────────────────

const CHECK = "✓";   // ✓
const HALF  = "◑";   // ◑
const CROSS = "✗";   // ✗

const matrixRows = [
  // [Feature, GM, BM, EMP]
  ["عرض لوحة الإحصائيات الرئيسية",         CHECK, CHECK, CROSS],
  ["عرض إحصائيات كل الفروع",               CHECK, CROSS, CROSS],
  ["إضافة عميل جديد",                       CHECK, CHECK, CHECK],
  ["تعديل ملف عميل",                        CHECK, CHECK, HALF],
  ["عرض عملاء الفرع كاملاً",               CHECK, CHECK, CROSS],
  ["عرض عملاء الموظف فقط",                 CHECK, CHECK, CHECK],
  ["إغلاق ملف عميل (تمت صفقة / فاقد)",    CHECK, CHECK, CROSS],
  ["تعديل استثنائي على ملف مغلق",          CHECK, CROSS, CROSS],
  ["حذف عميل",                              CROSS, CROSS, CROSS],
  ["عرض المخزون",                           CHECK, CHECK, CHECK],
  ["إضافة / تعديل مخزون",                  CHECK, CHECK, CROSS],
  ["استيراد مخزون (Excel)",                 CHECK, CHECK, CROSS],
  ["تقرير الإدارة",                         CHECK, CHECK, CROSS],
  ["تصدير تقرير الإدارة",                   CHECK, CHECK, CROSS],
  ["إدارة المعارض (إنشاء / إغلاق)",        CHECK, CROSS, CROSS],
  ["ربط واتساب بالمعرض",                   CHECK, CROSS, CROSS],
  ["إرسال رسالة واتساب للعملاء",           CHECK, CHECK, CROSS],
  ["إدارة الموظفين (دعوة / تعيين دور)",    CHECK, HALF,  CROSS],
  ["عرض قائمة الموظفين",                   CHECK, CHECK, CROSS],
  ["إدارة الأجندة الشخصية",                CHECK, CHECK, CHECK],
  ["عرض أجندة الموظفين الآخرين",           CHECK, CHECK, CROSS],
  ["المتابعات المتأخرة (كل الفرع)",        CHECK, CHECK, CROSS],
  ["التنبيهات والإشعارات",                 CHECK, CHECK, CHECK],
  ["بوت تيليغرام – استقبال إشعارات",      CHECK, CHECK, CROSS],
  ["بوت تيليغرام – إضافة عميل (Mini App)",CHECK, CHECK, CHECK],
  ["بوت تيليغرام – تقرير صباحي يومي",    CHECK, CHECK, CROSS],
  ["البحث الشامل في النظام",               CHECK, CHECK, HALF],
  ["سجل تدقيق customer_logs",             CHECK, CHECK, CROSS],
  ["إرسال توجيه جماعي للعملاء",           CHECK, CHECK, CROSS],
];

function buildMatrix() {
  const cols = [Math.round(CONTENT_W * 0.52), Math.round(CONTENT_W * 0.16), Math.round(CONTENT_W * 0.16), Math.round(CONTENT_W * 0.16)];
  const header = new TableRow({
    tableHeader: true,
    children: [
      hCell("الوظيفة", cols[0]),
      hCell("المدير العام", cols[1]),
      hCell("مدير المعرض", cols[2]),
      hCell("الموظف", cols[3]),
    ],
  });
  const rows = matrixRows.map((row, i) => {
    const fill = i % 2 === 0 ? LIGHT_GRAY : "FFFFFF";
    const [feat, gm, bm, emp] = row;
    const iconColor = (v) => v === CHECK ? "1a7a3c" : v === HALF ? "b8860b" : "c0392b";
    return new TableRow({
      children: [
        dCell(feat, cols[0], { fill }),
        dCell(gm,   cols[1], { fill, center: true, bold: true, color: iconColor(gm) }),
        dCell(bm,   cols[2], { fill, center: true, bold: true, color: iconColor(bm) }),
        dCell(emp,  cols[3], { fill, center: true, bold: true, color: iconColor(emp) }),
      ],
    });
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [header, ...rows],
  });
}

// ── Risk Matrix ───────────────────────────────────────────────────────────────

const risks = [
  ["غياب المصادقة الثنائية (2FA)", "4", "5", "20", "تطبيق 2FA فوراً لجميع الأدوار"],
  ["لا يوجد تسجيل لمحاولات تسجيل الدخول الفاشلة", "4", "4", "16", "تطبيق rate limiting وتسجيل محاولات الدخول"],
  ["Access Token واتساب في ملف .env فقط", "3", "5", "15", "استخدام Secrets Manager أو Vault مشفر"],
  ["لا حماية صريحة من حذف العملاء عبر API", "2", "5", "10", "إضافة RLS + soft-delete policy في Supabase"],
  ["تقرير الإدارة يعرض كل عملاء الفرع بلا فلترة", "3", "3", "9", "إضافة فلتر حسب الموظف لمدير المعرض"],
  ["غياب سياسة انتهاء صلاحية الجلسة", "3", "3", "9", "تحديد session timeout بـ 8 ساعات"],
  ["لا توجد نسخ احتياطية مؤتمتة موثقة", "2", "5", "10", "جدولة daily backup + اختبار restore شهري"],
  ["بيانات حساسة في Telegram messages", "3", "3", "9", "تشفير البيانات الحساسة في الإشعارات"],
  ["لا يوجد audit log لعمليات المخزون", "3", "3", "9", "إضافة جدول inventory_logs"],
  ["غياب الفصل بين بيئة الاختبار والإنتاج", "2", "4", "8", "إنشاء بيئة staging مستقلة"],
  ["لا يوجد نظام تنبيه عند خطأ حرج في API", "2", "4", "8", "ربط Sentry أو Datadog للمراقبة"],
  ["صلاحية مدير المعرض غير محدودة داخل الفرع", "2", "3", "6", "مراجعة الصلاحيات ووضع قيود إضافية"],
];

function buildRiskTable() {
  const cols = [
    Math.round(CONTENT_W * 0.32),
    Math.round(CONTENT_W * 0.10),
    Math.round(CONTENT_W * 0.10),
    Math.round(CONTENT_W * 0.12),
    Math.round(CONTENT_W * 0.36),
  ];
  // Adjust last col to fill exactly
  cols[4] = CONTENT_W - cols[0] - cols[1] - cols[2] - cols[3];

  const header = new TableRow({
    tableHeader: true,
    children: [
      hCell("المخاطرة", cols[0]),
      hCell("الاحتمالية", cols[1]),
      hCell("الأثر", cols[2]),
      hCell("درجة الخطر", cols[3]),
      hCell("الإجراء المقترح", cols[4]),
    ],
  });

  const riskColor = (score) => {
    const n = parseInt(score);
    if (n >= 15) return "c0392b";
    if (n >= 10) return "e67e22";
    if (n >= 6)  return "f0c040";
    return "1a7a3c";
  };

  const rows = risks.map((row, i) => {
    const fill = i % 2 === 0 ? LIGHT_GRAY : "FFFFFF";
    const [risk, prob, impact, score, action] = row;
    return new TableRow({
      children: [
        dCell(risk,   cols[0], { fill }),
        dCell(prob,   cols[1], { fill, center: true }),
        dCell(impact, cols[2], { fill, center: true }),
        dCell(score,  cols[3], { fill, center: true, bold: true, color: riskColor(score) }),
        dCell(action, cols[4], { fill }),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [header, ...rows],
  });
}

// ── Gaps Table ────────────────────────────────────────────────────────────────

const gaps = [
  ["المصادقة الثنائية (2FA)", "غير موجودة", "إلزامية لجميع المستخدمين", "عاجل"],
  ["تسجيل محاولات الدخول الفاشلة", "غير موجود", "Log + تنبيه + حظر مؤقت", "عاجل"],
  ["حماية حذف العملاء من API", "غير موجودة صراحةً", "RLS policy + soft-delete", "عاجل"],
  ["إدارة الأسرار (Secrets)", ".env فقط", "Secrets Manager مشفر", "قصير المدى"],
  ["فلتر تقرير الإدارة", "كل عملاء الفرع", "فلتر حسب الموظف لمدير الفرع", "قصير المدى"],
  ["انتهاء الجلسة التلقائي", "غير محدد", "Session timeout 8 ساعات", "قصير المدى"],
  ["نسخ احتياطي مؤتمت موثق", "غير محدد", "Daily backup + monthly restore test", "قصير المدى"],
  ["audit log للمخزون", "غير موجود", "جدول inventory_logs", "متوسط المدى"],
  ["بيئة staging مستقلة", "غير موجودة", "بيئة اختبار منفصلة عن الإنتاج", "متوسط المدى"],
  ["مراقبة الأخطاء الحرجة (APM)", "غير موجودة", "Sentry / Datadog", "متوسط المدى"],
  ["سياسة كلمة المرور", "غير محددة", "8 أحرف + رمز + رقم + انتهاء 90 يوم", "متوسط المدى"],
  ["توثيق الإجراءات التشغيلية", "غير موجود", "SOP لكل دور", "طويل المدى"],
  ["اختبار الاختراق الدوري", "غير موجود", "اختبار نصف سنوي", "طويل المدى"],
  ["تشفير البيانات الحساسة في الإشعارات", "جزئي", "تشفير تام + redaction", "طويل المدى"],
];

const priorityColor = (p) => {
  if (p === "عاجل") return "c0392b";
  if (p === "قصير المدى") return "e67e22";
  if (p === "متوسط المدى") return "2e6da4";
  return "1a7a3c";
};

function buildGapsTable() {
  const cols = [
    Math.round(CONTENT_W * 0.22),
    Math.round(CONTENT_W * 0.23),
    Math.round(CONTENT_W * 0.33),
    Math.round(CONTENT_W * 0.22),
  ];
  cols[3] = CONTENT_W - cols[0] - cols[1] - cols[2];

  const header = new TableRow({
    tableHeader: true,
    children: [
      hCell("الوظيفة", cols[0]),
      hCell("الحالة الحالية", cols[1]),
      hCell("المطلوب", cols[2]),
      hCell("الأولوية", cols[3]),
    ],
  });

  const rows = gaps.map((row, i) => {
    const fill = i % 2 === 0 ? LIGHT_GRAY : "FFFFFF";
    const [feat, curr, req, prio] = row;
    return new TableRow({
      children: [
        dCell(feat, cols[0], { fill }),
        dCell(curr, cols[1], { fill }),
        dCell(req,  cols[2], { fill }),
        dCell(prio, cols[3], { fill, center: true, bold: true, color: priorityColor(prio) }),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [header, ...rows],
  });
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

const scenarios = [
  {
    title: "السيناريو 1 – إضافة عميل جديد من قِبَل موظف",
    type: "يومي",
    desc: "يقوم الموظف بإدخال بيانات عميل جديد عبر معالج إدخال العملاء أو Mini App التيليغرام.",
    risk: "إدخال بيانات ناقصة أو مكررة.",
    current: "التحقق من الحقول الإلزامية + فحص رقم الهاتف المكرر.",
    gap: "لا يوجد تحقق من تكرار السجل على مستوى الاسم + رقم الهيكل في آنٍ واحد.",
  },
  {
    title: "السيناريو 2 – تسجيل تمت عملية البيع",
    type: "يومي",
    desc: "يقوم مدير المعرض بإغلاق ملف عميل كـ 'تمت الصفقة' مع تفاصيل البيع.",
    risk: "إغلاق ملف عميل بالخطأ أو بدون موافقة.",
    current: "تأكيد نصي (كتابة 'تأكيد') + إشعار فوري للمدير العام عبر تيليغرام.",
    gap: "لا يوجد توقيع رقمي أو موافقة ثنائية من مدير ثانٍ.",
  },
  {
    title: "السيناريو 3 – تعديل استثنائي على ملف مغلق",
    type: "استثنائي",
    desc: "المدير العام يفتح ملفاً مغلقاً لتصحيح خطأ في بيانات العميل أو الصفقة.",
    risk: "تزوير سجل أو تعديل غير مشروع لبيانات تاريخية.",
    current: "تأكيد نصي + تسجيل في customer_logs مع اسم المستخدم والتوقيت.",
    gap: "لا يوجد إشعار مستقل لجهة خارجية (مثل مدقق داخلي).",
  },
  {
    title: "السيناريو 4 – إغلاق معرض",
    type: "استثنائي",
    desc: "المدير العام يقوم بإغلاق أحد فروع المعرض نهائياً أو مؤقتاً من لوحة الإدارة.",
    risk: "إغلاق معرض نشط بالخطأ مما يوقف العمليات الكاملة.",
    current: "تأكيد نصي إلزامي + إشعار تيليغرام.",
    gap: "لا يوجد تأجيل مؤتمت أو فترة تراجع (undo window).",
  },
  {
    title: "السيناريو 5 – تغيير رقم واتساب المعرض",
    type: "استثنائي",
    desc: "ربط رقم واتساب جديد بالمعرض بعد تغيير الخط.",
    risk: "تحويل الرسائل إلى رقم خاطئ أو خارجي.",
    current: "تأكيد نصي + تسجيل التغيير.",
    gap: "لا يوجد فحص ملكية الرقم الجديد قبل الربط.",
  },
  {
    title: "السيناريو 6 – إرسال توجيه جماعي للعملاء",
    type: "استثنائي",
    desc: "مدير المعرض يرسل رسالة جماعية لجميع عملاء الفرع عبر واتساب.",
    risk: "إرسال رسائل غير لائقة أو إرهاق العملاء بالرسائل.",
    current: "تأكيد نصي إلزامي قبل الإرسال.",
    gap: "لا يوجد سجل محتوى الرسائل المرسلة أو حد يومي للإرسال.",
  },
  {
    title: "السيناريو 7 – موظف يحاول الوصول إلى عملاء زميله",
    type: "سوء استخدام",
    desc: "موظف يحاول عرض أو تعديل ملفات عملاء مسجلين باسم موظف آخر.",
    risk: "اختراق خصوصية البيانات والتلاعب بسجلات الزملاء.",
    current: "RLS في Supabase يقيد العرض لعملاء الموظف فقط.",
    gap: "يجب التحقق من فعالية RLS policy دورياً وإجراء اختبار اختراق.",
  },
  {
    title: "السيناريو 8 – محاولات تسجيل دخول متكررة فاشلة",
    type: "أمني",
    desc: "جهة خارجية تحاول اختراق حساب مستخدم بمحاولات متعددة (Brute Force).",
    risk: "اختراق حساب مستخدم والوصول إلى بيانات العملاء.",
    current: "لا يوجد أي آلية حماية حالياً.",
    gap: "ثغرة حرجة: يجب تطبيق rate limiting وحظر مؤقت وتسجيل المحاولات.",
  },
  {
    title: "السيناريو 9 – خطأ بشري في إدخال بيانات السيارة",
    type: "خطأ بشري",
    desc: "موظف يدخل رقم هيكل خاطئ أو سعراً غلطاً لسيارة في المخزون.",
    risk: "اتخاذ قرارات بيع على أساس بيانات غير صحيحة.",
    current: "لا يوجد audit log للمخزون حالياً.",
    gap: "يجب إضافة سجل تعديلات المخزون مع إمكانية التراجع.",
  },
  {
    title: "السيناريو 10 – متابعة متأخرة (48 ساعة+)",
    type: "يومي",
    desc: "النظام يكتشف أن موظفاً لم يتابع عميلاً منذ أكثر من 48 ساعة.",
    risk: "فقدان عميل محتمل بسبب إهمال المتابعة.",
    current: "تنبيه تلقائي عبر تيليغرام للموظف وللمدير.",
    gap: "لا يوجد تصعيد تلقائي إذا لم يستجب الموظف للتنبيه.",
  },
  {
    title: "السيناريو 11 – استقالة موظف وإبقاء حسابه نشطاً",
    type: "إداري",
    desc: "موظف يستقيل لكن حسابه لا يُعطَّل فوراً في النظام.",
    risk: "وصول غير مصرح به لبيانات العملاء والمعرض بعد انتهاء العقد.",
    current: "المدير يعطّل الحساب يدوياً من لوحة إدارة الموظفين.",
    gap: "لا يوجد إجراء مؤتمت أو تنبيه عند انتهاء عقد موظف.",
  },
  {
    title: "السيناريو 12 – انقطاع خدمة واتساب Business API",
    type: "تشغيلي",
    desc: "Meta تُوقف أو تعلّق رقم واتساب المعرض بسبب شكاوى أو انتهاك سياسات.",
    risk: "توقف كامل لقناة التواصل مع العملاء.",
    current: "لا يوجد آلية fallback أو إشعار تلقائي عند الانقطاع.",
    gap: "يجب تطبيق مراقبة حالة API + fallback عبر SMS أو قناة بديلة.",
  },
];

// ── Main document builder ─────────────────────────────────────────────────────

function buildDoc() {
  const children = [];

  // ─── Cover Page ───────────────────────────────────────────────────────────
  children.push(
    spacer(6),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: "أوتو سيستم", font: FONT, size: 64, bold: true, color: DARK_BLUE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [new TextRun({ text: "نظام إدارة معارض السيارات", font: FONT, size: 40, color: ACCENT })],
    }),
    divider(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: "تقرير التدقيق الإداري والتشغيلي الشامل", font: FONT, size: 36, bold: true, color: "2c3e50" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
      children: [new TextRun({ text: "Comprehensive Administrative & Operational Audit Report", font: FONT, size: 22, color: "666666", italics: true })],
    }),
    spacer(4),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: "التاريخ: 27 مايو 2026", font: FONT, size: 22, color: "444444" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: "إصدار: 1.0", font: FONT, size: 22, color: "444444" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: "السرية: للاستخدام الداخلي فقط", font: FONT, size: 22, bold: true, color: "c0392b" })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ─── Section 1: Executive Summary ────────────────────────────────────────
  children.push(
    heading1("1. الملخص التنفيذي"),
    p("يُقدِّم هذا التقرير تدقيقاً شاملاً لنظام إدارة معارض السيارات 'أوتو سيستم'، المبني على تقنية Next.js 14 App Router، مع قاعدة بيانات Supabase، وتكامل مع بوت تيليغرام وواتساب Business API. يهدف النظام إلى تحويل العمليات التقليدية لمعارض السيارات إلى بيئة رقمية متكاملة تشمل إدارة العملاء والمخزون والموظفين والفروع.", { size: 20, spaceBefore: 100, spaceAfter: 80 }),
    p("يضم النظام ثلاثة أدوار رئيسية: المدير العام، ومدير المعرض، والموظف؛ ويشمل أحد عشر وحدة تشغيلية رئيسية. يُلاحَظ أن النظام يحتوي على ضوابط رقابية جيدة تشمل التأكيد النصي للإجراءات الحساسة وسجل تدقيق شامل لتغييرات ملفات العملاء وإشعارات تيليغرام الفورية للمديرين.", { size: 20, spaceBefore: 60, spaceAfter: 80 }),
    p("غير أن التقرير رصد عدداً من الثغرات الأمنية والتشغيلية الجوهرية في مقدمتها: غياب المصادقة الثنائية (2FA)، وعدم تسجيل محاولات تسجيل الدخول الفاشلة، وتخزين رموز الوصول الحساسة في ملفات البيئة فقط دون تشفير مناسب. كما رُصدت فجوات في سجلات تدقيق المخزون وفي آليات التصعيد التلقائي لحالات عدم الاستجابة.", { size: 20, spaceBefore: 60, spaceAfter: 80 }),
    p("يوصي هذا التقرير باتخاذ إجراءات عاجلة خلال أسبوع لمعالجة الثغرات الأمنية الحرجة، وجملة من التحسينات على المدى القصير والمتوسط لرفع مستوى الحوكمة والرقابة التشغيلية إلى معايير الصناعة.", { size: 20, spaceBefore: 60, spaceAfter: 120 }),

    // Summary stats table
    (() => {
      const cols = [Math.round(CONTENT_W / 3), Math.round(CONTENT_W / 3), CONTENT_W - Math.round(CONTENT_W / 3) * 2];
      return new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: cols,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: cols[0], type: WidthType.DXA },
                borders: cellBorder("AAAAAA"),
                shading: { fill: DARK_BLUE, type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 150, right: 150 },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "11", font: FONT, size: 56, bold: true, color: WHITE })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "وحدة تشغيلية", font: FONT, size: 20, color: LIGHT_BLUE })] }),
                ],
              }),
              new TableCell({
                width: { size: cols[1], type: WidthType.DXA },
                borders: cellBorder("AAAAAA"),
                shading: { fill: ACCENT, type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 150, right: 150 },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "12", font: FONT, size: 56, bold: true, color: WHITE })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ثغرة مرصودة", font: FONT, size: 20, color: LIGHT_BLUE })] }),
                ],
              }),
              new TableCell({
                width: { size: cols[2], type: WidthType.DXA },
                borders: cellBorder("AAAAAA"),
                shading: { fill: "c0392b", type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 150, right: 150 },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "4", font: FONT, size: 56, bold: true, color: WHITE })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ثغرات حرجة عاجلة", font: FONT, size: 20, color: "ffcccc" })] }),
                ],
              }),
            ],
          }),
        ],
      });
    })(),
  );

  // ─── Section 2: User Guide per Role ──────────────────────────────────────
  children.push(heading1("2. دليل المستخدم لكل دور"));

  // 2.1 General Manager
  children.push(
    heading2("2.1 المدير العام (General Manager)"),
    heading3("ماذا يرى؟"),
    bullet("لوحة إحصائيات شاملة لجميع الفروع: إجمالي العملاء، الصفقات المُنجزة، المتابعات المتأخرة"),
    bullet("تقرير الإدارة لجميع الفروع مع فلاتر متقدمة"),
    bullet("قائمة كاملة بالموظفين والمعارض وحالتها"),
    bullet("سجل تدقيق كامل لجميع العمليات (customer_logs)"),
    bullet("جميع التنبيهات والإشعارات من جميع الفروع"),
    bullet("تقرير صباحي يومي عبر تيليغرام"),
    heading3("ماذا يفعل؟"),
    bullet("إنشاء فروع جديدة وإغلاق الفروع الحالية (بتأكيد نصي)"),
    bullet("ربط أرقام واتساب بالفروع وتعديلها (بتأكيد نصي)"),
    bullet("دعوة موظفين وتعيين الأدوار وإدارة الصلاحيات"),
    bullet("تعديل استثنائي على الملفات المغلقة (بتأكيد نصي)"),
    bullet("إرسال توجيهات جماعية لعملاء أي فرع"),
    bullet("مراجعة وتصدير تقارير الأداء"),
    heading3("ما حدوده؟"),
    bullet("لا يملك وصولاً لحذف السجلات نهائياً من الواجهة"),
    bullet("لا يملك الوصول لبيانات المستخدمين الحساسة (كلمات المرور)"),
    bullet("خاضع لسجل التدقيق في جميع إجراءاته الحساسة"),
  );

  // 2.2 Branch Manager
  children.push(
    heading2("2.2 مدير المعرض (Branch Manager)"),
    heading3("ماذا يرى؟"),
    bullet("لوحة إحصائيات فرعه فقط"),
    bullet("جميع عملاء فرعه بغض النظر عن الموظف المسؤول"),
    bullet("تقرير الإدارة لعملاء فرعه"),
    bullet("قائمة موظفي فرعه"),
    bullet("المتابعات المتأخرة لجميع موظفي الفرع"),
    bullet("التنبيهات والإشعارات المتعلقة بفرعه"),
    heading3("ماذا يفعل؟"),
    bullet("إدارة ملفات جميع عملاء الفرع: إضافة، تعديل، متابعة"),
    bullet("إغلاق ملفات العملاء (تمت الصفقة / فاقد)"),
    bullet("إرسال رسائل واتساب للعملاء عبر رقم الفرع"),
    bullet("إرسال توجيهات جماعية (بتأكيد نصي)"),
    bullet("إدارة أجندة الفرع والمتابعات"),
    bullet("تصدير تقرير الإدارة"),
    heading3("ما حدوده؟"),
    bullet("لا يملك صلاحية إنشاء فروع أو إغلاقها"),
    bullet("لا يملك صلاحية تعديل ملفات مغلقة"),
    bullet("لا يرى إحصائيات الفروع الأخرى"),
    bullet("لا يملك صلاحية تعديل واتساب الفرع"),
  );

  // 2.3 Employee
  children.push(
    heading2("2.3 الموظف (Employee)"),
    heading3("ماذا يرى؟"),
    bullet("عملاؤه الشخصيون فقط (RLS مطبّق)"),
    bullet("المخزون العام للفرع (قراءة فقط)"),
    bullet("أجندته الشخصية ومتابعاته"),
    bullet("التنبيهات المتعلقة به"),
    heading3("ماذا يفعل؟"),
    bullet("إضافة عميل جديد (عبر المعالج أو Mini App تيليغرام)"),
    bullet("تعديل ملفات عملائه الشخصيين"),
    bullet("تسجيل ملاحظات ورسائل واتساب على ملف العميل"),
    bullet("إدارة أجندته الشخصية: تذكيرات ومتابعات"),
    bullet("إضافة ملاحظات صوتية عبر بوت تيليغرام"),
    heading3("ما حدوده؟"),
    bullet("لا يرى عملاء الزملاء أو إحصائيات الفرع"),
    bullet("لا يستطيع إغلاق ملف عميل أو تعديل ملف مغلق"),
    bullet("لا يملك وصولاً لتقرير الإدارة"),
    bullet("لا يستطيع تعديل المخزون أو إرسال رسائل جماعية"),
  );

  // ─── Section 3: Role Analysis ─────────────────────────────────────────────
  children.push(heading1("3. تحليل الأدوار بعمق"));

  // GM
  children.push(
    heading2("3.1 تحليل دور المدير العام"),
    heading3("نقاط القوة"),
    bullet("رؤية شاملة بلا قيود تمكّنه من اتخاذ قرارات مبنية على بيانات حقيقية"),
    bullet("تأكيد نصي للإجراءات الحساسة يقلل الأخطاء غير المقصودة"),
    bullet("سجل تدقيق كامل يُمكّن من التتبع الكامل للعمليات"),
    bullet("إشعارات فورية بكل إجراء مهم في أي فرع"),
    heading3("نقاط الضعف"),
    bullet("لا يوجد فصل بين صلاحيات المدير العام الواحد (لا يوجد دور Super Admin منفصل)"),
    bullet("لا يوجد 2FA يحمي الحساب ذا الصلاحيات الأعلى"),
    bullet("قدرة التعديل الاستثنائي على الملفات المغلقة تفتقر لموافقة ثنائية"),
    heading3("المخاطر"),
    bullet("اختراق حساب المدير العام يعني الوصول الكامل لجميع بيانات النظام"),
    bullet("إساءة استخدام التعديل الاستثنائي بدون رقابة خارجية"),
  );

  // BM
  children.push(
    heading2("3.2 تحليل دور مدير المعرض"),
    heading3("نقاط القوة"),
    bullet("نطاق عمل محدود بفرعه يقلل خطر التأثير على الفروع الأخرى"),
    bullet("رؤية كاملة لعملاء فرعه تمكّنه من الإشراف الفعال"),
    bullet("صلاحية إرسال واتساب مقيدة برقم فرعه فقط"),
    heading3("نقاط الضعف"),
    bullet("تقرير الإدارة يعرض كل عملاء الفرع دون إمكانية الفلترة حسب الموظف"),
    bullet("لا توجد آلية تصعيد تلقائية عند عدم استجابته للتنبيهات"),
    bullet("صلاحية إدارة الموظفين (قراءة) قد تكشف بيانات الموظفين لحالات غير مبررة"),
    heading3("المخاطر"),
    bullet("رؤية بيانات عملاء جميع الموظفين قد تُستخدم للمقارنة غير العادلة"),
    bullet("إرسال الرسائل الجماعية دون سجل المحتوى"),
  );

  // Employee
  children.push(
    heading2("3.3 تحليل دور الموظف"),
    heading3("نقاط القوة"),
    bullet("مبدأ الصلاحية الأدنى مطبّق بشكل جيد – الموظف يرى عملاءه فقط"),
    bullet("سجل تدقيق لجميع تعديلاته على الملفات"),
    bullet("Mini App تيليغرام يوفر واجهة مبسطة للعمل خارج المكتب"),
    heading3("نقاط الضعف"),
    bullet("لا يستطيع الموظف الوصول لتاريخ عميل نُقل إليه من موظف آخر"),
    bullet("لا يوجد آلية للتحقق من هوية العميل قبل إضافته"),
    heading3("المخاطر"),
    bullet("الموظف قد يُنشئ سجلات عملاء مكررة عن غير قصد"),
    bullet("عدم متابعة التنبيهات قد يتسبب في فقدان عملاء محتملين"),
  );

  // ─── Section 4: Permission Matrix ────────────────────────────────────────
  children.push(
    heading1("4. مصفوفة الصلاحيات"),
    p("الجدول التالي يوضح الصلاحيات الكاملة لكل دور في النظام:", { spaceBefore: 80, spaceAfter: 120 }),
    buildMatrix(),
    spacer(1),
    // Legend
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({ text: CHECK + " كامل   ", font: FONT, size: 18, color: "1a7a3c", bold: true }),
        new TextRun({ text: HALF + " جزئي   ", font: FONT, size: 18, color: "b8860b", bold: true }),
        new TextRun({ text: CROSS + " ممنوع", font: FONT, size: 18, color: "c0392b", bold: true }),
      ],
    }),
  );

  // ─── Section 5: Scenarios ─────────────────────────────────────────────────
  children.push(heading1("5. السيناريوهات التشغيلية"));

  scenarios.forEach((sc, idx) => {
    const typeColor = sc.type === "يومي" ? ACCENT : sc.type === "استثنائي" ? "8e44ad" : sc.type === "أمني" ? "c0392b" : sc.type === "سوء استخدام" ? "e67e22" : "555555";
    children.push(
      heading2(sc.title),
      // Type badge via table
      (() => {
        const w = 1500;
        return new Table({
          width: { size: w, type: WidthType.DXA },
          columnWidths: [w],
          rows: [new TableRow({ children: [new TableCell({
            width: { size: w, type: WidthType.DXA },
            borders: noBorder(),
            shading: { fill: typeColor, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "النوع: " + sc.type, font: FONT, size: 16, bold: true, color: WHITE })] })],
          })]})],
        });
      })(),
      spacer(0.5),
      (() => {
        const labelW = 1600;
        const valW = CONTENT_W - labelW;
        const rows = [
          ["الوصف",         sc.desc],
          ["الخطر",         sc.risk],
          ["الإجراء الحالي", sc.current],
          ["الفجوة",        sc.gap],
        ];
        return new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [labelW, valW],
          rows: rows.map((r, i) => new TableRow({ children: [
            new TableCell({
              width: { size: labelW, type: WidthType.DXA },
              borders: cellBorder("AAAAAA"),
              shading: { fill: LIGHT_BLUE, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true, children: [new TextRun({ text: r[0], font: FONT, size: 18, bold: true, color: DARK_BLUE })] })],
            }),
            new TableCell({
              width: { size: valW, type: WidthType.DXA },
              borders: cellBorder("AAAAAA"),
              shading: { fill: i % 2 === 0 ? LIGHT_GRAY : "FFFFFF", type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true, children: [new TextRun({ text: r[1], font: FONT, size: 18, color: "1a1a1a" })] })],
            }),
          ]})),
        });
      })(),
      spacer(1),
    );
  });

  // ─── Section 6: Vulnerabilities ──────────────────────────────────────────
  children.push(heading1("6. الثغرات ونقاط الضعف"));

  const vulnSections = [
    {
      title: "6.1 الثغرات الأمنية",
      items: [
        "غياب المصادقة الثنائية (2FA) لجميع الأدوار بما فيها المدير العام",
        "لا يوجد تسجيل أو رصد لمحاولات تسجيل الدخول الفاشلة أو المتكررة",
        "لا يوجد حد أقصى لمحاولات تسجيل الدخول (Brute Force غير محمية)",
        "Access Token واتساب Business API مخزن في .env فقط دون Secrets Manager",
        "لا يوجد سياسة انتهاء صلاحية الجلسة (Session Expiry)",
        "لا حماية صريحة من حذف العملاء عبر API مباشرة (دون واجهة)",
      ],
    },
    {
      title: "6.2 الثغرات التشغيلية",
      items: [
        "لا يوجد سجل تدقيق لعمليات المخزون (inventory_logs)",
        "لا يوجد آلية fallback عند انقطاع خدمة واتساب Business API",
        "لا يوجد مراقبة تلقائية لأخطاء API الحرجة (APM)",
        "لا يوجد بيئة staging مستقلة للاختبار قبل النشر",
        "لا يوجد نسخ احتياطي مؤتمت موثق مع اختبار الاستعادة الدوري",
        "لا يوجد تصعيل تلقائي عند عدم استجابة موظف للتنبيهات",
      ],
    },
    {
      title: "6.3 الثغرات الرقابية",
      items: [
        "تقرير الإدارة يعرض كل عملاء الفرع بلا تصفية حسب الموظف لمدير الفرع",
        "لا يوجد سجل لمحتوى الرسائل الجماعية المرسلة عبر واتساب",
        "لا يوجد تنبيه تلقائي لمدقق خارجي عند التعديل الاستثنائي على الملفات المغلقة",
        "لا يوجد تدقيق دوري للصلاحيات للتحقق من أن RLS policies فعالة",
        "لا يوجد تقرير دوري عن أنماط الاستخدام الشاذة (anomaly detection)",
      ],
    },
    {
      title: "6.4 الثغرات الإدارية",
      items: [
        "لا يوجد إجراء مؤتمت لتعطيل حساب الموظف المستقيل",
        "لا توجد سياسة موثقة لكلمات المرور (الحد الأدنى، الانتهاء، التاريخ)",
        "لا يوجد توثيق للإجراءات التشغيلية المعيارية (SOP) لكل دور",
        "لا يوجد اختبار اختراق دوري للنظام",
        "لا يوجد خطة استجابة للحوادث الأمنية (Incident Response Plan)",
        "التدريب على الأمن السيبراني للموظفين غير موثق",
      ],
    },
  ];

  vulnSections.forEach(vs => {
    children.push(heading2(vs.title));
    vs.items.forEach(item => children.push(bullet(item)));
    children.push(spacer(0.5));
  });

  // ─── Section 7: Gaps Table ────────────────────────────────────────────────
  children.push(
    heading1("7. الموجود مقابل المطلوب"),
    p("الجدول التالي يقارن الوضع الحالي بالمتطلبات المُوصى بها:", { spaceBefore: 80, spaceAfter: 120 }),
    buildGapsTable(),
  );

  // ─── Section 8: Risk Register ─────────────────────────────────────────────
  children.push(
    heading1("8. سجل المخاطر"),
    p("يُصنَّف الخطر بضرب الاحتمالية × الأثر (1-5). درجة الخطر: 1-4 منخفض | 5-9 متوسط | 10-14 مرتفع | 15+ حرج.", { spaceBefore: 80, spaceAfter: 120 }),
    buildRiskTable(),
    spacer(1),
    // Color legend
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 100, after: 60 },
      children: [
        new TextRun({ text: "مفتاح الألوان: ", font: FONT, size: 18, bold: true }),
        new TextRun({ text: "حرج (15+)   ", font: FONT, size: 18, bold: true, color: "c0392b" }),
        new TextRun({ text: "مرتفع (10-14)   ", font: FONT, size: 18, bold: true, color: "e67e22" }),
        new TextRun({ text: "متوسط (5-9)   ", font: FONT, size: 18, bold: true, color: "b8860b" }),
        new TextRun({ text: "منخفض (1-4)", font: FONT, size: 18, bold: true, color: "1a7a3c" }),
      ],
    }),
  );

  // ─── Section 9: Recommendations ──────────────────────────────────────────
  children.push(heading1("9. التوصيات وخطة التحسين"));

  const recommendations = [
    {
      phase: "عاجل – خلال أسبوع",
      color: "c0392b",
      items: [
        "تطبيق المصادقة الثنائية (2FA) إلزامياً لجميع الأدوار، مع الأولوية لحسابات المديرين",
        "تطبيق Rate Limiting وتسجيل محاولات تسجيل الدخول الفاشلة مع تنبيه فوري عند 5 محاولات فاشلة",
        "إضافة Row Level Security policy صريحة تمنع حذف سجلات العملاء من أي مستوى",
        "نقل Access Token واتساب إلى Secrets Manager أو متغير بيئة مشفر خارج الكود",
      ],
    },
    {
      phase: "قصير المدى – خلال شهر",
      color: "e67e22",
      items: [
        "تحديد Session Timeout بـ 8 ساعات مع تجديد تلقائي عند النشاط",
        "إضافة فلتر حسب الموظف في تقرير الإدارة لمدير الفرع",
        "إنشاء جدول inventory_logs لتسجيل جميع تعديلات المخزون",
        "توثيق سجل الرسائل الجماعية المرسلة عبر واتساب",
        "تطبيق سياسة كلمات مرور (8 أحرف+ رمز+ رقم، انتهاء كل 90 يوم)",
        "إعداد نسخ احتياطي يومي مؤتمت مع اختبار استعادة شهري",
      ],
    },
    {
      phase: "متوسط المدى – خلال 3 أشهر",
      color: "2e6da4",
      items: [
        "إنشاء بيئة staging مستقلة تماماً عن الإنتاج",
        "ربط نظام مراقبة أخطاء APM (Sentry أو Datadog)",
        "تطبيق آلية fallback عند انقطاع خدمة واتساب Business API",
        "بناء نظام تصعيد تلقائي للمتابعات المتأخرة (موظف → مدير فرع → مدير عام)",
        "إضافة تنبيه خارجي عند التعديل الاستثنائي على الملفات المغلقة",
        "توثيق إجراءات SOP لكل دور وتحديثها مع كل إصدار",
      ],
    },
    {
      phase: "طويل المدى – خلال 6 أشهر+",
      color: "1a7a3c",
      items: [
        "إجراء اختبار اختراق (Penetration Test) نصف سنوي من جهة خارجية متخصصة",
        "تطوير نظام Anomaly Detection لرصد أنماط الاستخدام الشاذة",
        "إنشاء إجراء مؤتمت لتعطيل حسابات الموظفين المنتهية عقودهم",
        "تطبيق تشفير كامل للبيانات الحساسة في إشعارات تيليغرام (redaction)",
        "إنشاء خطة استجابة للحوادث الأمنية (Incident Response Plan) وتدريب الفريق عليها",
        "تطوير برنامج تدريب دوري للوعي بالأمن السيبراني لجميع المستخدمين",
      ],
    },
  ];

  recommendations.forEach(rec => {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        children: [new TextRun({ text: rec.phase, font: FONT, size: 24, bold: true, color: rec.color })],
      }),
    );
    rec.items.forEach(item => {
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 60, after: 60 },
        numbering: { reference: "numbers", level: 0 },
        children: [new TextRun({ text: item, font: FONT, size: 19, color: "1a1a1a" })],
      }));
    });
    children.push(spacer(0.5));
  });

  // ─── Closing ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    spacer(8),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [new TextRun({ text: "نهاية التقرير", font: FONT, size: 32, bold: true, color: DARK_BLUE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: "أوتو سيستم — نظام إدارة معارض السيارات", font: FONT, size: 22, color: ACCENT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: "27 مايو 2026 | إصدار 1.0 | للاستخدام الداخلي فقط", font: FONT, size: 18, color: "888888", italics: true })],
    }),
  );

  // ─── Build Document ───────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.RIGHT,
            style: {
              paragraph: {
                indent: { left: 720, hanging: 360 },
                bidirectional: true,
              },
            },
          }],
        },
        {
          reference: "numbers",
          levels: [{
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.RIGHT,
            style: {
              paragraph: {
                indent: { left: 720, hanging: 360 },
                bidirectional: true,
              },
            },
          }],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: FONT, size: 20 } },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: FONT, color: DARK_BLUE },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0, bidirectional: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: FONT, color: ACCENT },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, bidirectional: true },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: DARK_BLUE, space: 1 } },
              children: [
                new TextRun({ text: "أوتو سيستم — تقرير التدقيق الشامل", font: FONT, size: 16, color: DARK_BLUE }),
                new TextRun({ text: "   |   27 مايو 2026", font: FONT, size: 16, color: "888888" }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 6, color: DARK_BLUE, space: 1 } },
              children: [
                new TextRun({ text: "صفحة ", font: FONT, size: 16, color: "666666" }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: DARK_BLUE, bold: true }),
                new TextRun({ text: " | للاستخدام الداخلي فقط", font: FONT, size: 16, color: "666666" }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });

  return doc;
}

// ── Run ───────────────────────────────────────────────────────────────────────
const doc = buildDoc();
Packer.toBuffer(doc).then(buffer => {
  const outPath = "C:\\Users\\a0zay\\OneDrive\\Desktop\\auto-system\\audit-report.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Done: " + outPath + " (" + buffer.length + " bytes)");
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
