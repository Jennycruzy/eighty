// Page layouts for the made-up documents. Each returns { sheets, regions }:
// sheets are page descriptions (see draw.mjs) and regions are named boxes, in points,
// that the hard-case effects use to blur or crop exactly the parts the answers say are unreadable.
import { LETTER, SAMPLE_MARK, page, textWidth } from "./draw.mjs";
import { amount, dayFirst, hours, longDate, money, monthName, shortDate, usDate, weekday } from "./format.mjs";

const RED = "#b00020";
const GREY = "#555555";
const LIGHT = "#e8e8e8";

const PAY_WORDS = {
  en: {
    statement: "Earnings Statement",
    employee: "Employee",
    id: "Employee ID",
    period: "Pay period",
    payDate: "Pay date",
    frequencyLabel: "Pay frequency",
    frequency: { weekly: "Weekly", biweekly: "Every two weeks", monthly: "Monthly" },
    description: "Description",
    hours: "Hours",
    rate: "Rate",
    current: "This period",
    ytd: "Year to date",
    earnings: "Earnings",
    pretax: "Pre-tax deductions",
    taxes: "Taxes",
    after: "After-tax deductions",
    gross: "Gross pay",
    net: "Net pay",
    total: "Total",
    none: "None",
    notReal: "Not a real pay record.",
    continued: "Continued on page 2",
    pageOf: (n, of) => `Page ${n} of ${of}`,
    summary: "Pay summary",
    hoursEarnings: "Hours and earnings",
    deductions: "Deductions",
    check: "NON-NEGOTIABLE - THIS IS NOT A CHECK",
    payTo: "Pay to the order of",
    amountLabel: "Amount",
  },
  es: {
    statement: "Talón de pago",
    employee: "Empleado",
    id: "N.º de empleado",
    period: "Periodo de pago",
    payDate: "Fecha de pago",
    frequencyLabel: "Frecuencia de pago",
    frequency: { weekly: "Semanal", biweekly: "Cada dos semanas", monthly: "Mensual" },
    description: "Concepto",
    hours: "Horas",
    rate: "Tarifa",
    current: "Este periodo",
    ytd: "Acumulado del año",
    earnings: "Ingresos",
    pretax: "Deducciones antes de impuestos",
    taxes: "Impuestos",
    after: "Deducciones después de impuestos",
    gross: "Pago bruto",
    net: "Pago neto",
    total: "Total",
    none: "Ninguna",
    notReal: "No es un registro de pago real.",
    continued: "Continúa en la página 2",
    pageOf: (n, of) => `Página ${n} de ${of}`,
    summary: "Resumen de pago",
    hoursEarnings: "Horas e ingresos",
    deductions: "Deducciones",
    check: "NO NEGOCIABLE - ESTO NO ES UN CHEQUE",
    payTo: "Páguese a la orden de",
    amountLabel: "Importe",
  },
};

const dateFor = (iso, language) => (language === "es" ? shortDate(iso, "es") : usDate(iso));
const rateText = (line) => (line.rateCents == null ? "" : amount(line.rateCents));
const hoursText = (line) => (line.hours == null ? "" : hours(line.hours));

async function wrap(text, size, width, bold = false) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if ((await textWidth(next, size, bold)) > width && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}
async function paragraph(sheet, x, y, text, { size = 10.5, width = 532, leading = 15, ...rest } = {}) {
  for (const line of await wrap(text, size, width, rest.bold)) {
    sheet.text(x, y, line, { size, ...rest });
    y += leading;
  }
  return y;
}
function mark(sheet, x, y, align = "right", size = 9) {
  sheet.text(x, y, SAMPLE_MARK, { size, bold: true, color: RED, align });
}

// Layout A: boxed table, current and year-to-date columns side by side.
export function payStubA(stub, { twoPages = false } = {}) {
  const w = PAY_WORDS[stub.language];
  const first = page();
  const header = (sheet, pageNumber, pages) => {
    mark(sheet, 572, 28);
    sheet.text(40, 50, stub.employer.name, { size: 16, bold: true });
    stub.employer.lines.forEach((line, i) => sheet.text(40, 65 + i * 12, line, { size: 9, color: GREY }));
    sheet.text(572, 50, w.statement.toUpperCase(), { size: 14, bold: true, align: "right" });
    if (pages > 1) sheet.text(572, 66, w.pageOf(pageNumber, pages), { size: 9, color: GREY, align: "right" });
    sheet.rect(40, 95, 532, 70, { stroke: "#333333" });
    sheet.text(52, 113, w.employee, { size: 8, color: GREY });
    sheet.text(52, 128, stub.employee.name, { size: 11, bold: true });
    sheet.text(52, 148, `${w.id}: ${stub.employee.id}`, { size: 9 });
    sheet.text(320, 113, w.period, { size: 8, color: GREY });
    sheet.text(320, 128, `${dateFor(stub.periodStart, stub.language)} - ${dateFor(stub.periodEnd, stub.language)}`, { size: 11, bold: true });
    sheet.text(320, 148, `${w.payDate}: ${dateFor(stub.payDate, stub.language)}`, { size: 9 });
    sheet.text(572, 180, `${w.frequencyLabel}: ${w.frequency[stub.frequency]}`, { size: 8, color: GREY, align: "right" });
  };
  header(first, 1, twoPages ? 2 : 1);
  const columns = (sheet, y, labels) => {
    sheet.rect(40, y - 12, 532, 16, { fill: LIGHT });
    sheet.text(46, y, labels[0], { size: 9, bold: true });
    if (labels[1]) sheet.text(290, y, labels[1], { size: 9, bold: true, align: "right" });
    if (labels[2]) sheet.text(360, y, labels[2], { size: 9, bold: true, align: "right" });
    sheet.text(460, y, labels[3], { size: 9, bold: true, align: "right" });
    sheet.text(566, y, labels[4], { size: 9, bold: true, align: "right" });
  };
  let y = 195;
  let sheet = first;
  sheet.text(40, y, w.earnings, { size: 11, bold: true });
  y += 20;
  columns(sheet, y, [w.description, w.hours, w.rate, w.current, w.ytd]);
  y += 18;
  for (const line of stub.earnings) {
    sheet.text(46, y, line.label, { size: 9.5 });
    sheet.text(290, y, hoursText(line), { size: 9.5, align: "right" });
    sheet.text(360, y, rateText(line), { size: 9.5, align: "right" });
    sheet.text(460, y, amount(line.cents), { size: 9.5, align: "right" });
    sheet.text(566, y, amount(line.ytd), { size: 9.5, align: "right" });
    y += 16;
  }
  if (!twoPages) {
    sheet.line(40, y - 10, 572, y - 10);
    sheet.text(46, y + 2, w.gross, { size: 9.5, bold: true });
    if (stub.hoursTotal != null) sheet.text(290, y + 2, hours(stub.hoursTotal), { size: 9.5, bold: true, align: "right" });
    sheet.text(460, y + 2, amount(stub.gross), { size: 9.5, bold: true, align: "right" });
    sheet.text(566, y + 2, amount(stub.ytd.gross), { size: 9.5, bold: true, align: "right" });
    y += 14;
  }
  const afterGross = y;
  if (twoPages) {
    sheet.text(306, 740, w.continued, { size: 10, italic: true, align: "center" });
    sheet.text(306, 770, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
    sheet = page();
    header(sheet, 2, 2);
    y = 195;
  } else y += 18;
  const block = (title, lines, totalLabel, total, ytd) => {
    sheet.text(40, y, title, { size: 11, bold: true });
    y += 20;
    columns(sheet, y, [w.description, "", "", w.current, w.ytd]);
    y += 18;
    if (!lines.length) {
      sheet.text(46, y, w.none, { size: 9.5, color: GREY });
      sheet.text(460, y, amount(0), { size: 9.5, align: "right" });
      sheet.text(566, y, amount(0), { size: 9.5, align: "right" });
      y += 16;
    }
    for (const line of lines) {
      sheet.text(46, y, line.label, { size: 9.5 });
      sheet.text(460, y, amount(line.cents), { size: 9.5, align: "right" });
      sheet.text(566, y, amount(line.ytd), { size: 9.5, align: "right" });
      y += 16;
    }
    sheet.line(40, y - 10, 572, y - 10);
    sheet.text(46, y + 2, totalLabel, { size: 9.5, bold: true });
    sheet.text(460, y + 2, amount(total), { size: 9.5, bold: true, align: "right" });
    sheet.text(566, y + 2, amount(ytd), { size: 9.5, bold: true, align: "right" });
    y += 34;
  };
  block(w.pretax, stub.pretax, `${w.total} ${w.pretax.toLowerCase()}`, stub.pretaxTotal, stub.ytd.pretax);
  block(w.taxes, stub.taxes, `${w.total} ${w.taxes.toLowerCase()}`, stub.taxTotal, stub.ytd.taxes);
  if (stub.after.length) block(w.after, stub.after, `${w.total} ${w.after.toLowerCase()}`, stub.afterTotal, stub.ytd.after);
  sheet.rect(40, y - 14, 532, 52, { stroke: "#333333", strokeWidth: 1.2 });
  sheet.text(52, y + 4, w.gross, { size: 9, color: GREY });
  sheet.text(52, y + 24, money(stub.gross), { size: 13, bold: true });
  sheet.text(330, y + 4, `${w.net} (${w.current.toLowerCase()})`, { size: 9, color: GREY });
  sheet.text(330, y + 24, money(stub.net), { size: 13, bold: true });
  sheet.text(566, y + 4, w.ytd, { size: 9, color: GREY, align: "right" });
  sheet.text(566, y + 24, money(stub.ytd.net), { size: 10, align: "right" });
  if (stub.footnote) sheet.text(40, 748, stub.footnote, { size: 6.5, color: "#777777" });
  sheet.text(306, 770, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
  return { sheets: twoPages ? [first, sheet] : [first], regions: { afterGross } };
}

// Layout B: coloured band, a summary box with large numbers, and a year-to-date box.
export function payStubB(stub) {
  const w = PAY_WORDS[stub.language];
  const sheet = page();
  sheet.rect(0, 0, 612, 70, { fill: "#1f4e79" });
  sheet.text(36, 36, stub.employer.name, { size: 18, bold: true, color: "#ffffff" });
  sheet.text(36, 56, stub.employer.lines.join(" · "), { size: 8.5, color: "#dbe6f2" });
  sheet.text(576, 42, w.statement, { size: 14, color: "#ffffff", align: "right" });
  mark(sheet, 576, 88);
  const info = [
    [w.employee, stub.employee.name],
    [w.id, stub.employee.id],
    [w.period, `${dateFor(stub.periodStart, stub.language)} - ${dateFor(stub.periodEnd, stub.language)}`],
    [w.payDate, dateFor(stub.payDate, stub.language)],
  ];
  info.forEach(([label, value], i) => {
    const x = [36, 180, 290, 470][i];
    sheet.text(x, 110, label, { size: 8, color: GREY });
    sheet.text(x, 125, value, { size: 10, bold: true });
  });
  sheet.text(36, 140, `${w.frequencyLabel}: ${w.frequency[stub.frequency]}`, { size: 8, color: GREY });
  // Summary box, this period only.
  sheet.rect(36, 160, 250, 170, { stroke: "#1f4e79", radius: 6 });
  sheet.text(48, 180, w.summary, { size: 11, bold: true, color: "#1f4e79" });
  const summary = [
    [w.gross, stub.gross, false],
    [w.pretax, -stub.pretaxTotal, false],
    [w.taxes, -stub.taxTotal, false],
    [w.after, -stub.afterTotal, false],
    [w.net, stub.net, true],
  ];
  summary.forEach(([label, cents, strong], i) => {
    const y = 205 + i * 24;
    sheet.text(48, y, label, { size: strong ? 10.5 : 9, bold: strong });
    sheet.text(276, y, money(cents), { size: strong ? 13 : 10.5, bold: true, align: "right" });
  });
  // Year-to-date box, the numbers a reader must not use for this period.
  sheet.rect(36, 350, 250, 120, { fill: "#f2f5f9", radius: 6 });
  sheet.text(48, 370, w.ytd, { size: 11, bold: true, color: "#1f4e79" });
  [
    [w.gross, stub.ytd.gross],
    [w.pretax, stub.ytd.pretax],
    [w.taxes, stub.ytd.taxes],
    [w.net, stub.ytd.net],
  ].forEach(([label, cents], i) => {
    const y = 394 + i * 20;
    sheet.text(48, y, label, { size: 9 });
    sheet.text(276, y, money(cents), { size: 12, bold: true, align: "right" });
  });
  // Earnings detail.
  sheet.text(306, 180, w.hoursEarnings, { size: 11, bold: true, color: "#1f4e79" });
  sheet.rect(306, 190, 270, 16, { fill: LIGHT });
  sheet.text(312, 202, w.description, { size: 8.5, bold: true });
  sheet.text(440, 202, w.hours, { size: 8.5, bold: true, align: "right" });
  sheet.text(500, 202, w.rate, { size: 8.5, bold: true, align: "right" });
  sheet.text(570, 202, w.current, { size: 8.5, bold: true, align: "right" });
  let y = 222;
  for (const line of stub.earnings) {
    sheet.text(312, y, line.label, { size: 9 });
    sheet.text(440, y, hoursText(line), { size: 9, align: "right" });
    sheet.text(500, y, rateText(line), { size: 9, align: "right" });
    sheet.text(570, y, amount(line.cents), { size: 9, align: "right" });
    y += 16;
  }
  sheet.line(306, y - 10, 576, y - 10);
  if (stub.hoursTotal != null) {
    sheet.text(312, y + 2, `${w.total} ${w.hours.toLowerCase()}`, { size: 9, bold: true });
    sheet.text(440, y + 2, hours(stub.hoursTotal), { size: 9, bold: true, align: "right" });
  }
  const earningsBottom = y + 8;
  y += 34;
  sheet.text(306, y, w.deductions, { size: 11, bold: true, color: "#1f4e79" });
  y += 20;
  const deductionsTop = y - 12;
  for (const [title, lines] of [
    [w.pretax, stub.pretax],
    [w.taxes, stub.taxes],
    [w.after, stub.after],
  ]) {
    sheet.text(312, y, title, { size: 8.5, bold: true, color: GREY });
    y += 15;
    if (!lines.length) {
      sheet.text(320, y, w.none, { size: 9, color: GREY });
      sheet.text(570, y, amount(0), { size: 9, align: "right" });
      y += 15;
    }
    for (const line of lines) {
      sheet.text(320, y, line.label, { size: 9 });
      sheet.text(570, y, amount(line.cents), { size: 9, align: "right" });
      y += 15;
    }
    y += 4;
  }
  if (stub.footnote) sheet.text(36, 748, stub.footnote, { size: 6.5, color: "#777777" });
  sheet.text(306, 770, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
  return {
    sheets: [sheet],
    regions: {
      money: [
        { x: 170, y: 190, w: 112, h: 130 },
        { x: 446, y: 208, w: 128, h: earningsBottom - 208 },
        { x: 170, y: 380, w: 112, h: 86 },
        { x: 500, y: deductionsTop, w: 74, h: y - deductionsTop },
      ],
    },
  };
}

// Layout C: plain ledger in capitals, current and year-to-date in every row.
export function payStubC(stub) {
  const w = PAY_WORDS[stub.language];
  const sheet = page();
  mark(sheet, 572, 30);
  sheet.text(40, 48, stub.employer.name.toUpperCase(), { size: 13, bold: true });
  stub.employer.lines.forEach((line, i) => sheet.text(40, 62 + i * 11, line.toUpperCase(), { size: 8 }));
  sheet.text(572, 48, stub.language === "es" ? "AVISO DE PAGO" : "PAY ADVICE", { size: 12, bold: true, align: "right" });
  sheet.line(40, 92, 572, 92, { width: 1.2 });
  const labels =
    stub.language === "es"
      ? ["INICIO DEL PERIODO", "FIN DEL PERIODO", "FECHA DEL CHEQUE"]
      : ["PERIOD BEGINNING", "PERIOD ENDING", "CHECK DATE"];
  [stub.periodStart, stub.periodEnd, stub.payDate].forEach((iso, i) => {
    sheet.text(40 + i * 180, 108, labels[i], { size: 7.5 });
    sheet.text(40 + i * 180, 121, usDate(iso), { size: 10, bold: true });
  });
  sheet.text(40, 140, `${w.employee.toUpperCase()}: ${stub.employee.name.toUpperCase()}   ${w.id.toUpperCase()}: ${stub.employee.id}`, { size: 8.5 });
  sheet.line(40, 150, 572, 150);
  // Earnings on the left.
  sheet.text(40, 168, w.earnings.toUpperCase(), { size: 9, bold: true });
  sheet.text(40, 182, "DESC", { size: 7.5 });
  sheet.text(170, 182, "HRS", { size: 7.5, align: "right" });
  sheet.text(230, 182, w.current.toUpperCase(), { size: 7.5, align: "right" });
  sheet.text(290, 182, "YTD", { size: 7.5, align: "right" });
  let y = 198;
  for (const line of stub.earnings) {
    sheet.text(40, y, line.label.toUpperCase(), { size: 8.5 });
    sheet.text(170, y, hoursText(line), { size: 8.5, align: "right" });
    sheet.text(230, y, amount(line.cents), { size: 8.5, align: "right" });
    sheet.text(290, y, amount(line.ytd), { size: 8.5, align: "right" });
    y += 14;
  }
  // Deductions on the right, pre-tax ones starred.
  sheet.text(320, 168, w.deductions.toUpperCase(), { size: 9, bold: true });
  sheet.text(320, 182, "DESC", { size: 7.5 });
  sheet.text(500, 182, w.current.toUpperCase(), { size: 7.5, align: "right" });
  sheet.text(572, 182, "YTD", { size: 7.5, align: "right" });
  let right = 198;
  for (const [lines, star] of [
    [stub.pretax, "*"],
    [stub.taxes, ""],
    [stub.after, ""],
  ])
    for (const line of lines) {
      sheet.text(320, right, `${star}${line.label.toUpperCase()}`, { size: 8.5 });
      sheet.text(500, right, amount(line.cents), { size: 8.5, align: "right" });
      sheet.text(572, right, amount(line.ytd), { size: 8.5, align: "right" });
      right += 14;
    }
  sheet.text(320, right + 6, stub.language === "es" ? "* DEDUCCIÓN ANTES DE IMPUESTOS" : "* PRE-TAX DEDUCTION", { size: 7.5 });
  y = Math.max(y, right + 20) + 20;
  sheet.line(40, y, 572, y, { width: 1.2 });
  const heads =
    stub.language === "es"
      ? ["", "BRUTO", "ANTES DE IMPUESTOS", "IMPUESTOS", "OTRAS", "NETO"]
      : ["", "GROSS", "PRE-TAX", "TAXES", "OTHER", "NET"];
  const xs = [40, 190, 290, 380, 460, 572];
  heads.forEach((head, i) => i && sheet.text(xs[i], y + 16, head, { size: 7.5, bold: true, align: "right" }));
  [
    ["CURRENT", stub.gross, stub.pretaxTotal, stub.taxTotal, stub.afterTotal, stub.net],
    ["YTD", stub.ytd.gross, stub.ytd.pretax, stub.ytd.taxes, stub.ytd.after, stub.ytd.net],
  ].forEach((row, r) => {
    const label = stub.language === "es" ? (r ? "ACUMULADO" : "ACTUAL") : row[0];
    sheet.text(40, y + 34 + r * 16, label, { size: 8.5, bold: true });
    row.slice(1).forEach((cents, i) => sheet.text(xs[i + 1], y + 34 + r * 16, amount(cents), { size: 9.5, bold: r === 0, align: "right" }));
  });
  if (stub.footnote) sheet.text(40, 748, stub.footnote, { size: 6.5, color: "#777777" });
  sheet.text(306, 770, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
  return { sheets: [sheet], regions: {} };
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function words(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${words(n % 100)}` : ""}`;
  return `${words(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${words(n % 1000)}` : ""}`;
}
const UNOS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CIENTOS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
function palabras(n) {
  if (n < 30) return UNOS[n];
  if (n < 100) return `${DECENAS[Math.floor(n / 10)]}${n % 10 ? ` y ${UNOS[n % 10]}` : ""}`;
  if (n === 100) return "cien";
  if (n < 1000) return `${CIENTOS[Math.floor(n / 100)]}${n % 100 ? ` ${palabras(n % 100)}` : ""}`;
  const thousands = Math.floor(n / 1000);
  return `${thousands === 1 ? "mil" : `${palabras(thousands)} mil`}${n % 1000 ? ` ${palabras(n % 1000)}` : ""}`;
}
function amountInWords(cents, language) {
  const dollars = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return language === "es"
    ? `${palabras(dollars)} dólares con ${rest}/100`
    : `${words(dollars)} and ${rest}/100 dollars`;
}

// Layout D: a check stub with earnings and deductions side by side, and a voucher below.
export function payStubD(stub) {
  const w = PAY_WORDS[stub.language];
  const sheet = page();
  mark(sheet, 572, 26);
  sheet.text(36, 44, stub.employer.name, { size: 14, bold: true });
  sheet.text(36, 58, stub.employer.lines.join(" · "), { size: 8, color: GREY });
  sheet.rect(36, 70, 540, 40, { fill: "#f4f1e8", stroke: "#999999" });
  [
    [w.employee, stub.employee.name],
    [w.period, `${dateFor(stub.periodStart, stub.language)} - ${dateFor(stub.periodEnd, stub.language)}`],
    [w.payDate, dateFor(stub.payDate, stub.language)],
    [w.frequencyLabel, w.frequency[stub.frequency]],
  ].forEach(([label, value], i) => {
    const x = [44, 190, 360, 470][i];
    sheet.text(x, 84, label, { size: 7.5, color: GREY });
    sheet.text(x, 100, value, { size: 9.5, bold: true });
  });
  // Earnings, left.
  sheet.text(36, 134, w.hoursEarnings, { size: 10, bold: true });
  sheet.rect(36, 140, 268, 15, { fill: LIGHT });
  sheet.text(40, 151, w.description, { size: 7.5, bold: true });
  sheet.text(150, 151, w.rate, { size: 7.5, bold: true, align: "right" });
  sheet.text(195, 151, w.hours, { size: 7.5, bold: true, align: "right" });
  sheet.text(250, 151, w.current, { size: 7.5, bold: true, align: "right" });
  sheet.text(300, 151, "YTD", { size: 7.5, bold: true, align: "right" });
  let y = 170;
  for (const line of stub.earnings) {
    sheet.text(40, y, line.label, { size: 8.5 });
    sheet.text(150, y, rateText(line), { size: 8.5, align: "right" });
    sheet.text(195, y, hoursText(line), { size: 8.5, align: "right" });
    sheet.text(250, y, amount(line.cents), { size: 8.5, align: "right" });
    sheet.text(300, y, amount(line.ytd), { size: 8.5, align: "right" });
    y += 14;
  }
  sheet.line(36, y - 9, 304, y - 9);
  sheet.text(40, y + 3, w.gross, { size: 8.5, bold: true });
  if (stub.hoursTotal != null) sheet.text(195, y + 3, hours(stub.hoursTotal), { size: 8.5, bold: true, align: "right" });
  sheet.text(250, y + 3, amount(stub.gross), { size: 8.5, bold: true, align: "right" });
  sheet.text(300, y + 3, amount(stub.ytd.gross), { size: 8.5, bold: true, align: "right" });
  // Deductions, right.
  sheet.text(316, 134, w.deductions, { size: 10, bold: true });
  sheet.rect(316, 140, 260, 15, { fill: LIGHT });
  sheet.text(320, 151, w.description, { size: 7.5, bold: true });
  sheet.text(520, 151, w.current, { size: 7.5, bold: true, align: "right" });
  sheet.text(572, 151, "YTD", { size: 7.5, bold: true, align: "right" });
  let right = 170;
  for (const [title, lines] of [
    [w.pretax, stub.pretax],
    [w.taxes, stub.taxes],
    [w.after, stub.after],
  ]) {
    if (!lines.length) continue;
    sheet.text(320, right, title, { size: 7.5, bold: true, color: GREY });
    right += 13;
    for (const line of lines) {
      sheet.text(326, right, line.label, { size: 8.5 });
      sheet.text(520, right, amount(line.cents), { size: 8.5, align: "right" });
      sheet.text(572, right, amount(line.ytd), { size: 8.5, align: "right" });
      right += 13;
    }
  }
  y = Math.max(y + 24, right + 14);
  sheet.rect(36, y, 540, 36, { stroke: "#333333" });
  [
    [w.gross, stub.gross],
    [w.pretax, stub.pretaxTotal],
    [w.taxes, stub.taxTotal],
    [w.net, stub.net],
  ].forEach(([label, cents], i) => {
    const x = 44 + i * 135;
    sheet.text(x, y + 13, label, { size: 7, color: GREY });
    sheet.text(x, y + 29, money(cents), { size: 11, bold: true });
  });
  if (stub.footnote) sheet.text(36, y + 52, stub.footnote, { size: 6.5, color: "#777777" });
  // Voucher.
  sheet.line(20, 470, 592, 470, { dash: "4 3", color: "#888888" });
  sheet.rect(36, 490, 540, 220, { fill: "#eef5ee", stroke: "#7a9a7a" });
  sheet.text(306, 520, w.check, { size: 11, bold: true, color: "#7a1f1f", align: "center" });
  sheet.text(56, 556, stub.employer.name, { size: 10, bold: true });
  sheet.text(556, 556, `${w.payDate}: ${dateFor(stub.payDate, stub.language)}`, { size: 9, align: "right" });
  sheet.text(56, 596, w.payTo, { size: 8, color: GREY });
  sheet.text(56, 612, stub.employee.name, { size: 11, bold: true });
  sheet.text(556, 612, money(stub.net), { size: 13, bold: true, align: "right" });
  sheet.text(56, 640, amountInWords(stub.net, stub.language), { size: 9, italic: true });
  sheet.text(306, 690, SAMPLE_MARK, { size: 22, bold: true, color: "#c8c8c8", align: "center" });
  sheet.text(306, 770, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
  return { sheets: [sheet], regions: {} };
}

export const payStubLayouts = { A: payStubA, B: payStubB, C: payStubC, D: payStubD };

const GIG_WORDS = {
  en: {
    weekly: "Weekly earnings summary",
    monthlySummary: "Monthly earnings summary",
    monthly: "Monthly driver statement",
    activeHours: "Active hours",
    drivingHours: "Hours driving",
    trips: "Trips",
    deliveries: "Deliveries",
    earnings: "Earnings",
    gross: "Gross earnings",
    fees: "Platform fees",
    totalFees: "Total fees",
    net: "Net payout",
    paidOn: "Paid to your bank on",
    miles: "Miles driven (for your records, not deducted)",
    expenses: "Expenses you reported",
    notReal: "Not a real earnings record.",
    pageOf: (n, of) => `Page ${n} of ${of}`,
    week: "Week",
    continued: "Totals are on page 2",
    totals: "Statement totals",
  },
  es: {
    weekly: "Resumen semanal de ganancias",
    monthlySummary: "Resumen mensual de ganancias",
    monthly: "Estado de cuenta mensual del conductor",
    activeHours: "Horas activas",
    drivingHours: "Horas manejando",
    trips: "Viajes",
    deliveries: "Entregas",
    earnings: "Ganancias",
    gross: "Ganancias brutas",
    fees: "Comisiones de la plataforma",
    totalFees: "Total de comisiones",
    net: "Pago neto",
    paidOn: "Depositado en su banco el",
    miles: "Millas recorridas (para sus registros, no se descuentan)",
    expenses: "Gastos que usted reportó",
    notReal: "No es un registro de ganancias real.",
    pageOf: (n, of) => `Página ${n} de ${of}`,
    week: "Semana",
    continued: "Los totales están en la página 2",
    totals: "Totales del estado de cuenta",
  },
};

// Gig weekly summary, drawn as an app screen. Net payout and payout date are at the bottom.
export function gigWeekly(gig, { width = 400, height = 760 } = {}) {
  const w = GIG_WORDS[gig.language];
  const sheet = page(width, height);
  const ink = "#111111";
  const soft = GREY;
  sheet.rect(0, 0, width, 64, { fill: gig.colour });
  sheet.text(20, 40, gig.platform, { size: 20, bold: true, color: "#ffffff" });
  mark(sheet, width - 16, 84, "right", 9);
  sheet.text(20, 108, gig.period === "monthly" ? w.monthlySummary : w.weekly, { size: 15, bold: true, color: ink });
  sheet.text(20, 128, `${shortDate(gig.periodStart, gig.language)} - ${shortDate(gig.periodEnd, gig.language)}`, { size: 11, color: soft });
  const row = (y, label, value, options = {}) => {
    sheet.text(20, y, label, { size: options.size ?? 11, bold: options.bold, color: ink });
    sheet.text(width - 20, y, value, { size: options.size ?? 11, bold: options.bold, color: ink, align: "right" });
  };
  row(160, w.activeHours, hours(gig.hours));
  row(182, gig.ride ? w.trips : w.deliveries, String(gig.count));
  sheet.line(20, 196, width - 20, 196, { color: soft });
  sheet.text(20, 218, w.earnings, { size: 12, bold: true, color: ink });
  let y = 240;
  for (const line of gig.lines) {
    row(y, line.label, money(line.cents));
    y += 22;
  }
  row(y, w.gross, money(gig.gross), { bold: true });
  y += 30;
  sheet.text(20, y, w.fees, { size: 12, bold: true, color: ink });
  y += 22;
  for (const fee of gig.fees) {
    row(y, fee.label, money(-fee.cents));
    y += 22;
  }
  row(y, w.totalFees, money(-gig.feeTotal), { bold: true });
  const afterFees = y + 12;
  y += 30;
  sheet.line(20, y - 12, width - 20, y - 12, { color: soft });
  row(y + 8, w.net, money(gig.net), { bold: true, size: 16 });
  y += 36;
  sheet.text(20, y, `${w.paidOn} ${shortDate(gig.paidOn, gig.language)}`, { size: 10, color: soft });
  y += 26;
  sheet.text(20, y, `${w.miles}: ${gig.miles.toFixed(1)}`, { size: 9, color: soft });
  sheet.text(width / 2, height - 18, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
  return { sheets: [sheet], regions: { afterFees } };
}

// Gig monthly statement on a letter page. With twoPages, the weekly detail is on page 1 and every total on page 2.
export function gigMonthly(gig, { twoPages = false } = {}) {
  const w = GIG_WORDS[gig.language];
  const pages = twoPages ? 2 : 1;
  const header = (sheet, n) => {
    mark(sheet, 572, 28);
    sheet.text(40, 54, gig.platform, { size: 20, bold: true, color: gig.colour });
    sheet.text(40, 76, w.monthly, { size: 13, bold: true });
    sheet.text(40, 94, `${monthName(gig.periodStart.slice(0, 7), gig.language)} · ${shortDate(gig.periodStart, gig.language)} - ${shortDate(gig.periodEnd, gig.language)}`, { size: 10, color: GREY });
    sheet.text(572, 54, gig.driver, { size: 10, bold: true, align: "right" });
    sheet.text(572, 68, gig.address, { size: 8.5, color: GREY, align: "right" });
    if (pages > 1) sheet.text(572, 94, w.pageOf(n, pages), { size: 9, color: GREY, align: "right" });
    sheet.line(40, 106, 572, 106, { width: 1.2, color: gig.colour });
  };
  const first = page();
  header(first, 1);
  let y = 134;
  first.text(40, y, `${w.week}`, { size: 9, bold: true });
  first.text(220, y, w.trips, { size: 9, bold: true, align: "right" });
  gig.lines.forEach((line, i) => first.text(320 + i * 90, y, line.label, { size: 9, bold: true, align: "right" }));
  y += 18;
  for (const week of gig.weeks) {
    first.text(40, y, `${shortDate(week.start, gig.language)} - ${shortDate(week.end, gig.language)}`, { size: 9.5 });
    first.text(220, y, String(week.count), { size: 9.5, align: "right" });
    week.cents.forEach((cents, i) => first.text(320 + i * 90, y, amount(cents), { size: 9.5, align: "right" }));
    y += 16;
  }
  let sheet = first;
  if (twoPages) {
    first.text(306, 720, w.continued, { size: 10, italic: true, align: "center" });
    first.text(306, 770, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
    sheet = page();
    header(sheet, 2);
    y = 140;
  } else y += 24;
  sheet.text(40, y, w.totals, { size: 12, bold: true });
  y += 22;
  const row = (label, value, bold = false) => {
    sheet.text(52, y, label, { size: 10, bold });
    sheet.text(400, y, value, { size: 10, bold, align: "right" });
    y += 18;
  };
  for (const line of gig.lines) row(line.label, money(line.cents));
  row(w.gross, money(gig.gross), true);
  y += 6;
  for (const fee of gig.fees) row(fee.label, money(-fee.cents));
  row(w.totalFees, money(-gig.feeTotal), true);
  y += 6;
  row(w.net, money(gig.net), true);
  row(`${w.paidOn}`, shortDate(gig.paidOn, gig.language));
  y += 10;
  row(w.drivingHours, hours(gig.hours));
  row(w.trips, String(gig.count));
  row(w.miles, gig.miles.toFixed(1));
  sheet.text(306, 770, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
  return { sheets: twoPages ? [first, sheet] : [first], regions: {} };
}

const SHEET_WORDS = {
  en: {
    title: "Volunteer Sign-In Sheet",
    date: "Date",
    name: "Volunteer name",
    in: "Time in",
    out: "Time out",
    hours: "Hours",
    task: "Activity",
    staff: "Staff initials",
    contact: "Volunteer coordinator",
    month: "Month",
    yearTotal: "Hours this year (all volunteers' running total for the program)",
    notReal: "Not a real record.",
  },
  es: {
    title: "Hoja de registro de voluntarios",
    date: "Fecha",
    name: "Nombre del voluntario",
    in: "Entrada",
    out: "Salida",
    hours: "Horas",
    task: "Actividad",
    staff: "Iniciales del personal",
    contact: "Coordinadora de voluntarios",
    month: "Mes",
    yearTotal: "Horas del año (total acumulado del programa)",
    notReal: "No es un registro real.",
  },
};

// Volunteer sign-in sheet. With hand set, the rows look hand-written in blue ink.
export function volunteerSheet(sheetData) {
  const w = SHEET_WORDS[sheetData.language];
  const sheet = page();
  mark(sheet, 572, 28);
  sheet.text(40, 54, sheetData.organization, { size: 17, bold: true });
  sheet.text(40, 70, sheetData.orgNote, { size: 9, color: GREY });
  sheet.text(40, 96, w.title, { size: 14, bold: true });
  sheet.text(572, 96, `${w.month}: ${monthName(sheetData.month, sheetData.language)}`, { size: 11, align: "right" });
  sheet.text(40, 114, `${w.contact}: ${sheetData.contact}`, { size: 9.5 });
  const xs = [40, 112, 262, 322, 382, 432, 532];
  const heads = [w.date, w.name, w.in, w.out, w.hours, w.task, w.staff];
  sheet.rect(40, 128, 532, 18, { fill: LIGHT, stroke: "#666666" });
  heads.forEach((head, i) => sheet.text(xs[i] + 3, 141, head, { size: i === 6 ? 6.5 : 8, bold: true }));
  let y = 146;
  const rowBoxes = [];
  sheetData.rows.forEach((row, index) => {
    sheet.rect(40, y, 532, 26, { stroke: "#999999" });
    xs.slice(1).forEach((x) => sheet.line(x, y, x, y + 26, { color: "#999999" }));
    const values = [
      sheetData.language === "es" ? dayFirst(row.date) : usDate(row.date),
      sheetData.volunteer,
      row.in,
      row.out,
      hours(row.hours, row.hours % 1 ? 2 : 0),
      row.task,
      row.staff,
    ];
    values.forEach((value, i) =>
      sheet.text(xs[i] + 4, y + 17, value, {
        size: sheetData.hand ? 10.5 : 9,
        color: sheetData.hand ? "#1d3f9a" : "#111111",
        ...(sheetData.hand ? { hand: (index + 1) * 97 + i * 13 + sheetData.seed } : {}),
      }),
    );
    rowBoxes.push({ x: xs[2], y, w: xs[5] - xs[2], h: 26 });
    y += 26;
  });
  for (let blank = sheetData.rows.length; blank < 14; blank++) {
    sheet.rect(40, y, 532, 26, { stroke: "#cccccc" });
    y += 26;
  }
  if (sheetData.yearTotal != null)
    sheet.text(40, y + 22, `${w.yearTotal}: ${sheetData.yearTotal}`, { size: 9, color: GREY });
  sheet.text(306, 770, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
  return { sheets: [sheet], regions: { timeCells: rowBoxes } };
}

const SCHOOL_WORDS = {
  en: {
    schedule: "Class schedule",
    student: "Student",
    id: "Student ID",
    term: "Term",
    begins: "Classes begin",
    ends: "Term ends",
    course: "Course",
    title: "Title",
    credits: "Credits",
    days: "Days",
    time: "Time",
    room: "Room",
    total: "Total credits",
    notReal: "Not a real school record.",
  },
  es: {
    schedule: "Horario de clases",
    student: "Estudiante",
    id: "N.º de estudiante",
    term: "Periodo",
    begins: "Inicio de clases",
    ends: "Fin del periodo",
    course: "Curso",
    title: "Nombre",
    credits: "Créditos",
    days: "Días",
    time: "Horario",
    room: "Salón",
    total: "Total de créditos",
    notReal: "No es un registro escolar real.",
  },
};

export function classSchedule(data) {
  const w = SCHOOL_WORDS[data.language];
  const sheet = page();
  mark(sheet, 572, 28);
  sheet.text(40, 56, data.school, { size: 17, bold: true, color: "#5b2a86" });
  sheet.text(40, 72, data.address, { size: 9, color: GREY });
  sheet.text(40, 104, w.schedule, { size: 14, bold: true });
  sheet.text(40, 124, `${w.student}: ${data.student}   ${w.id}: ${data.studentId}`, { size: 10 });
  sheet.text(40, 142, `${w.term}: ${data.termName}`, { size: 10, bold: true });
  sheet.text(40, 158, `${w.begins}: ${longDate(data.termStart, data.language)}   ${w.ends}: ${longDate(data.termEnd, data.language)}`, { size: 10 });
  const xs = [40, 110, 300, 350, 410, 520];
  sheet.rect(40, 176, 532, 18, { fill: "#efe7f6" });
  [w.course, w.title, w.credits, w.days, w.time, w.room].forEach((head, i) => sheet.text(xs[i] + 3, 189, head, { size: 8.5, bold: true }));
  let y = 212;
  for (const course of data.courses) {
    [course.code, course.title, String(course.credits), course.days, course.time, course.room].forEach((value, i) =>
      sheet.text(xs[i] + 3, y, value, { size: 9 }),
    );
    sheet.line(40, y + 7, 572, y + 7, { color: "#dddddd" });
    y += 20;
  }
  sheet.text(xs[2] + 3, y + 8, `${w.total}: ${data.courses.reduce((sum, c) => sum + c.credits, 0)}`, { size: 10, bold: true });
  sheet.text(306, 770, `${SAMPLE_MARK}. ${w.notReal}`, { size: 8, color: RED, align: "center" });
  return { sheets: [sheet], regions: {} };
}

export async function enrollmentLetter(data) {
  const sheet = page();
  mark(sheet, 572, 28);
  sheet.text(40, 58, data.school, { size: 18, bold: true, color: "#0f5c4d" });
  sheet.text(40, 74, `${data.office} · ${data.address}`, { size: 9, color: GREY });
  sheet.line(40, 84, 572, 84, { color: "#0f5c4d", width: 1.5 });
  sheet.text(40, 116, longDate(data.date, data.language), { size: 10.5 });
  let y = 150;
  for (const text of data.paragraphs) y = (await paragraph(sheet, 40, y, text)) + 10;
  y += 20;
  sheet.text(40, y, data.signature, { size: 14, italic: true, color: "#1d3f9a" });
  sheet.text(40, y + 18, data.signer, { size: 10 });
  sheet.text(40, y + 32, data.office, { size: 10 });
  sheet.text(306, 770, `${SAMPLE_MARK}. ${data.language === "es" ? "No es una carta real." : "Not a real letter."}`, { size: 8, color: RED, align: "center" });
  return { sheets: [sheet], regions: {} };
}

export async function stateNotice(data) {
  const sheet = page();
  mark(sheet, 572, 28);
  sheet.rect(40, 40, 532, 52, { stroke: "#2d4a6b", strokeWidth: 1.4 });
  sheet.text(54, 62, data.agency, { size: 14, bold: true, color: "#2d4a6b" });
  sheet.text(54, 80, data.agencyNote, { size: 8.5, color: GREY });
  sheet.text(40, 118, longDate(data.date, data.language), { size: 10 });
  sheet.text(40, 134, data.memberLine, { size: 10 });
  sheet.text(40, 166, data.title, { size: 14, bold: true });
  let y = 192;
  for (const text of data.paragraphs) y = (await paragraph(sheet, 40, y, text, { size: 10.5 })) + 9;
  sheet.text(306, 770, `${SAMPLE_MARK}. ${data.language === "es" ? "No es un aviso real." : "Not a real notice."}`, { size: 8, color: RED, align: "center" });
  return { sheets: [sheet], regions: {} };
}

// A store receipt on a narrow page.
export function receipt(data) {
  const width = 280;
  const height = 120 + data.items.length * 16 + 190;
  const sheet = page(width, height);
  sheet.background = "#fbfaf6";
  sheet.text(width / 2, 30, SAMPLE_MARK, { size: 9, bold: true, color: RED, align: "center" });
  sheet.text(width / 2, 54, data.store, { size: 15, bold: true, align: "center" });
  sheet.text(width / 2, 70, data.address, { size: 8, color: GREY, align: "center" });
  sheet.text(width / 2, 84, `${usDate(data.date)}  ${data.time}  #${data.number}`, { size: 8, align: "center" });
  let y = 110;
  for (const item of data.items) {
    sheet.text(20, y, item.label, { size: 9 });
    sheet.text(width - 20, y, amount(item.cents), { size: 9, align: "right" });
    y += 16;
  }
  const subtotal = data.items.reduce((sum, item) => sum + item.cents, 0);
  sheet.line(20, y - 6, width - 20, y - 6, { dash: "3 2" });
  const rows = [
    ["SUBTOTAL", subtotal],
    ["TAX", data.taxCents],
    ["TOTAL", subtotal + data.taxCents],
    [data.tender, subtotal + data.taxCents],
  ];
  y += 10;
  rows.forEach(([label, cents], i) => {
    sheet.text(20, y, label, { size: i === 2 ? 11 : 9, bold: i === 2 });
    sheet.text(width - 20, y, amount(cents), { size: i === 2 ? 11 : 9, bold: i === 2, align: "right" });
    y += 18;
  });
  y += 14;
  for (const line of data.footer) {
    sheet.text(width / 2, y, line, { size: 8, color: GREY, align: "center" });
    y += 13;
  }
  sheet.text(width / 2, height - 16, `${SAMPLE_MARK}. Not a real receipt.`, { size: 7.5, color: RED, align: "center" });
  return { sheets: [sheet], regions: {} };
}

// A pay slip from outside the United States, in a local layout and currency.
export function foreignPaySlip(data) {
  const sheet = page(595, 842);
  mark(sheet, 555, 28);
  sheet.text(40, 56, data.employer, { size: 16, bold: true });
  data.employerLines.forEach((line, i) => sheet.text(40, 72 + i * 12, line, { size: 9, color: GREY }));
  sheet.text(555, 56, data.title, { size: 15, bold: true, align: "right" });
  let y = 120;
  for (const [label, value] of data.facts) {
    sheet.text(40, y, label, { size: 9, color: GREY });
    sheet.text(200, y, value, { size: 10, bold: true });
    y += 16;
  }
  y += 14;
  sheet.rect(40, y - 12, 515, 16, { fill: LIGHT });
  sheet.text(46, y, data.columns[0], { size: 9, bold: true });
  sheet.text(400, y, data.columns[1], { size: 9, bold: true, align: "right" });
  sheet.text(549, y, data.columns[2], { size: 9, bold: true, align: "right" });
  y += 20;
  for (const line of data.lines) {
    sheet.text(46, y, line.label, { size: 9.5 });
    if (line.pay != null) sheet.text(400, y, line.pay, { size: 9.5, align: "right" });
    if (line.deduction != null) sheet.text(549, y, line.deduction, { size: 9.5, align: "right" });
    y += 16;
  }
  sheet.line(40, y - 8, 555, y - 8);
  y += 12;
  for (const [label, value] of data.totals) {
    sheet.text(300, y, label, { size: 10, bold: true });
    sheet.text(549, y, value, { size: 11, bold: true, align: "right" });
    y += 18;
  }
  sheet.text(297, 812, `${SAMPLE_MARK}. ${data.notReal}`, { size: 8, color: RED, align: "center" });
  return { sheets: [sheet], regions: {} };
}

// A plain note whose text tries to give the reader orders.
export async function instructionNote(data) {
  const sheet = page();
  mark(sheet, 572, 28);
  sheet.text(40, 60, data.heading, { size: 15, bold: true });
  sheet.text(40, 78, data.place, { size: 9, color: GREY });
  let y = 116;
  for (const text of data.paragraphs) y = (await paragraph(sheet, 40, y, text, { size: 11.5, leading: 17 })) + 12;
  sheet.text(306, 770, `${SAMPLE_MARK}. ${data.notReal}`, { size: 8, color: RED, align: "center" });
  return { sheets: [sheet], regions: {} };
}
