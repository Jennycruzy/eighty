// Everything Eighty's Telegram bot says, in one place: the bot sends these,
// and the landing page shows the same words.
export const SITE = "https://tryeighty.space";

export type Lang = "en" | "es";
export const STATUS: Record<Lang, Record<string, string>> = {
  en: {
    Meets: "Meets the rule",
    Short: "Below the line",
    Exempt: "The rule does not apply",
    Deemed: "Counted as meeting the rule",
    "Not sure yet": "Not sure yet",
  },
  es: {
    Meets: "Cumple la regla",
    Short: "Falta para llegar a la meta",
    Exempt: "La regla no le aplica",
    Deemed: "Se cuenta como que cumple",
    "Not sure yet": "Aún no sabemos",
  },
};
const KIND: Record<Lang, Record<string, string>> = {
  en: {
    work: "Work",
    service: "Volunteer service",
    "work-program": "Work program",
    education: "School",
    income: "Pay",
  },
  es: {
    work: "Trabajo",
    service: "Voluntariado",
    "work-program": "Programa de trabajo",
    education: "Estudios",
    income: "Pago",
  },
};
export const BOT_TEXT = {
  en: {
    welcome: `Hi, I'm Eighty. I keep your Medicaid work proof together.\n\nTo link this chat, open your month on ${SITE}, tap "Link Telegram" and send me the code you see there.`,
    linked: (name: string) =>
      `Linked. This chat now adds proof to ${name}.\n\nSend a photo or PDF of a pay stub, a timesheet or a volunteer letter. You can also send a voice note: "I volunteered 4 hours at the pantry on Saturday."\n\nNothing counts until you check it on your month page.`,
    badCode: `That code didn't work. Codes last 15 minutes and work once. Open your month on ${SITE} and tap "Link Telegram" for a new one.`,
    unlinked: `This chat isn't linked to a month yet. Open your month on ${SITE}, tap "Link Telegram" and send me the code.`,
    stopped: `Unlinked. This chat can no longer see or add to your month. Link again any time from ${SITE}.`,
    groups: "I only work in a private chat, so your proof stays private.",
    unsupported:
      "I can read photos, PDFs and voice notes. Videos, stickers, locations and contacts aren't proof I can use.",
    tooBig: "That file is too big. Send a file under 15 MB.",
    fileFailed:
      "I couldn't get that file from Telegram. Please send it again.",
    retake:
      "That photo is too dark or blurry to read. Take it again in good light, with the whole page in view.",
    notDocument:
      "I saved the file, but it doesn't look like a US pay, work, school or volunteer record. Check it on your month page.",
    nothingFound:
      "I saved the file, but found no dates, hours or pay I could use. You can type the facts on your month page.",
    unreadable:
      "I saved the file but couldn't read it. Try a clearer photo, or type the facts on your month page.",
    unavailable:
      "I saved the file. Reading is paused right now, so I'll leave it for you to check later.",
    budget:
      "The example's reading help is resting until tomorrow. You can still type lines on the month page.",
    read: (count: number) =>
      count === 1
        ? "I read it and found 1 line:"
        : `I read it and found ${count} lines:`,
    alreadyRead: "I've already read this file. Its lines:",
    check: "Check each line before it counts",
    voiceFailed:
      "I couldn't make out that voice note. Please try again, or type it.",
    heard: (text: string) => `I heard: "${text}"`,
    month: (status: string, hours: string | null, target: number) =>
      hours === null
        ? `This month: ${status}.`
        : `This month: ${status}. ${hours} of ${target} hours confirmed.`,
    short: (hours: string) => `${hours} hours still needed.`,
    rule: "Rule",
    state: "Your state decides.",
    help: `Send a photo or PDF of your proof, or a voice note about your hours. Send /status for this month, /month to have me do your month's paperwork, /packet for your proof PDF, /notice and the date printed on a letter from the state (like /notice 11/3) for your reply date, /checkins off to stop the weekly check-in, /espanol for Spanish, /stop to unlink this chat.`,
    language: `OK, I'll answer in English now. Send voice notes in English. For Spanish, send /espanol.`,
    rest: "The example helper is resting until tomorrow. You can still look around and type lines yourself.",
    packetSent: "Here is your proof packet. Check it, sign the cover, and send it to your state's Medicaid office.",
    noPacket: "No month is finished yet. Send /month and I'll show you what is left.",
    packetFailed: "I couldn't make the packet. Try again, or download it from your month page.",
    checkinsOn: "Check-ins are on. From the 10th, once a week, I'll send your plan if your month is short, and I'll remind you before a letter's reply date. Send /checkins off to stop.",
    checkinsOff: "Check-ins are off. I'll only answer when you write. Send /checkins on to start them again.",
    noticeHow: "Send the date printed on the letter, like /notice 11/3 or /notice 2026-11-03. If it came late, add the day it came: /notice 11/3 11/12.",
    noticeCleared: "OK, I removed the letter's dates.",
  },
  es: {
    welcome: `Hola, soy Eighty. Guardo juntas tus pruebas de trabajo para Medicaid.\n\nPara vincular este chat, abre tu mes en ${SITE}, toca "Vincular Telegram" y envíame el código que aparece.`,
    linked: (name: string) =>
      `Vinculado. Este chat ahora añade pruebas a ${name}.\n\nEnvía una foto o un PDF de un talón de pago, una hoja de horas o una carta de voluntariado. También puedes enviar una nota de voz: "Trabajé cuatro horas en la despensa el sábado."\n\nNada cuenta hasta que lo revises en tu mes.`,
    badCode: `Ese código no funcionó. Los códigos duran 15 minutos y sirven una vez. Abre tu mes en ${SITE} y toca "Vincular Telegram" para uno nuevo.`,
    unlinked: `Este chat aún no está vinculado a un mes. Abre tu mes en ${SITE}, toca "Vincular Telegram" y envíame el código.`,
    stopped: `Desvinculado. Este chat ya no puede ver ni añadir nada a tu mes. Puedes vincularlo otra vez desde ${SITE}.`,
    groups: "Solo funciono en un chat privado, para que tus pruebas sigan privadas.",
    unsupported:
      "Puedo leer fotos, PDF y notas de voz. Los videos, stickers, ubicaciones y contactos no son pruebas que pueda usar.",
    tooBig: "Ese archivo es muy grande. Envía uno de menos de 15 MB.",
    fileFailed: "No pude obtener ese archivo de Telegram. Envíalo otra vez.",
    retake:
      "La foto está muy oscura o borrosa para leerla. Tómala otra vez con buena luz y con toda la página.",
    notDocument:
      "Guardé el archivo, pero no parece un registro de pago, trabajo, estudios o voluntariado de EE. UU. Revísalo en tu mes.",
    nothingFound:
      "Guardé el archivo, pero no encontré fechas, horas ni pagos que pueda usar. Puedes escribir los datos en tu mes.",
    unreadable:
      "Guardé el archivo, pero no pude leerlo. Prueba con una foto más clara o escribe los datos en tu mes.",
    unavailable:
      "Guardé el archivo. La lectura está en pausa ahora, así que lo dejo para que lo revises luego.",
    budget:
      "La ayuda de lectura del ejemplo descansa hasta mañana. Aún puedes escribir líneas en tu mes.",
    read: (count: number) =>
      count === 1
        ? "Lo leí y encontré 1 línea:"
        : `Lo leí y encontré ${count} líneas:`,
    alreadyRead: "Ya leí este archivo. Sus líneas:",
    check: "Revisa cada línea antes de que cuente",
    voiceFailed:
      "No pude entender esa nota de voz. Inténtalo otra vez o escríbelo.",
    heard: (text: string) => `Escuché: "${text}"`,
    month: (status: string, hours: string | null, target: number) =>
      hours === null
        ? `Este mes: ${status}.`
        : `Este mes: ${status}. ${hours} de ${target} horas confirmadas.`,
    short: (hours: string) => `Faltan ${hours} horas.`,
    rule: "Regla",
    state: "Tu estado decide.",
    help: `Envía una foto o un PDF de tu prueba, o una nota de voz sobre tus horas. Envía /status para ver este mes, /month para que haga el papeleo de tu mes, /packet para el PDF de tu prueba, /notice y la fecha impresa en una carta del estado (como /notice 11/3) para saber cuándo responder, /checkins off para dejar la revisión semanal, /english para inglés y /stop para desvincular este chat.`,
    language: `Listo, ahora te respondo en español. Envía las notas de voz en español. Para inglés, envía /english.`,
    rest: "La ayuda del ejemplo descansa hasta mañana. Aún puedes mirar y escribir líneas por tu cuenta.",
    packetSent: "Aquí está tu paquete de prueba. Revísalo, firma la portada y envíalo a la oficina de Medicaid de tu estado.",
    noPacket: "Todavía no hay un mes completo. Envía /month y te muestro lo que falta.",
    packetFailed: "No pude hacer el paquete. Inténtalo otra vez o descárgalo en la página de tu mes.",
    checkinsOn: "La revisión está activada. Desde el día 10, una vez por semana, te mando tu plan si te faltan horas, y te recuerdo antes de la fecha para responder una carta. Envía /checkins off para dejarla.",
    checkinsOff: "La revisión está apagada. Solo respondo cuando me escribes. Envía /checkins on para activarla otra vez.",
    noticeHow: "Envía la fecha impresa en la carta, como /notice 11/3 o /notice 2026-11-03. Si llegó tarde, agrega el día que llegó: /notice 11/3 11/12.",
    noticeCleared: "Listo, borré las fechas de la carta.",
  },
} as const;

export const ruleUrl = (citation: string) => {
  const section = citation.match(/435\.(\d{3})/)?.[1] ?? "552";
  return `https://www.ecfr.gov/current/title-42/section-435.${section}`;
};

const hoursText = (value: number, lang: Lang) =>
  value.toLocaleString(lang === "es" ? "es-US" : "en-US", {
    maximumFractionDigits: 2,
  });

export interface LineFields {
  kind: string;
  start?: string | null;
  end?: string | null;
  hours?: number | null;
  organization?: string | null;
  income?: { receivedOn?: string | null; grossPayCents?: number | null } | null;
}
export function lineText(fields: LineFields, lang: Lang): string {
  const parts = [KIND[lang][fields.kind] ?? fields.kind];
  if (fields.organization) parts.push(fields.organization);
  if (typeof fields.hours === "number")
    parts.push(`${hoursText(fields.hours, lang)} h`);
  if (typeof fields.income?.grossPayCents === "number")
    parts.push(
      new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
        style: "currency",
        currency: "USD",
      }).format(fields.income.grossPayCents / 100),
    );
  const date = fields.income?.receivedOn ?? fields.start ?? null;
  const end = fields.end && fields.end !== date ? fields.end : null;
  if (date) parts.push(end ? `${date} → ${end}` : date);
  return parts.join(" · ");
}

export interface MonthSummary {
  status: string;
  citation: string;
  hours: number | null;
  targetHours: number;
  explanation?: string;
  explanationEs?: string;
}
export function monthText(month: MonthSummary, lang: Lang): string {
  const words = BOT_TEXT[lang];
  const lines = [
    words.month(
      STATUS[lang][month.status] ?? month.status,
      month.hours === null ? null : hoursText(month.hours, lang),
      month.targetHours,
    ),
  ];
  const plain = lang === "es" ? month.explanationEs : month.explanation;
  if (plain) lines.push(plain);
  if (month.status === "Short" && typeof month.hours === "number")
    lines.push(
      words.short(hoursText(Math.max(0, month.targetHours - month.hours), lang)),
    );
  lines.push(`${words.rule}: ${month.citation} — ${ruleUrl(month.citation)}`);
  lines.push(words.state);
  return lines.join("\n");
}
