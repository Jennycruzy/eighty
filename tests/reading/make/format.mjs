// Number and date formats used on the made-up documents.
const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
};
const SHORT = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};
const parts = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
};
export function money(cents, symbol = "$") {
  const negative = cents < 0;
  const value = Math.abs(cents);
  const whole = Math.floor(value / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${symbol}${whole}.${String(value % 100).padStart(2, "0")}`;
}
export const amount = (cents) => money(cents, "");
export function hours(value, places = 2) {
  return value.toFixed(places);
}
// 10/05/2026
export function usDate(iso) {
  const { year, month, day } = parts(iso);
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
}
// 05/10/2026, used on the documents from outside the United States
export function dayFirst(iso) {
  const { year, month, day } = parts(iso);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}
// Oct 5, 2026 or 5 oct 2026
export function shortDate(iso, language) {
  const { year, month, day } = parts(iso);
  return language === "es"
    ? `${day} ${SHORT.es[month - 1]} ${year}`
    : `${SHORT.en[month - 1]} ${day}, ${year}`;
}
// October 5, 2026 or 5 de octubre de 2026
export function longDate(iso, language) {
  const { year, month, day } = parts(iso);
  return language === "es"
    ? `${day} de ${MONTHS.es[month - 1]} de ${year}`
    : `${MONTHS.en[month - 1]} ${day}, ${year}`;
}
export function monthName(month, language) {
  const [year, number] = month.split("-").map(Number);
  return language === "es" ? `${MONTHS.es[number - 1]} de ${year}` : `${MONTHS.en[number - 1]} ${year}`;
}
export function weekday(iso, language) {
  const names = {
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    es: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
  };
  return names[language][new Date(`${iso}T00:00:00Z`).getUTCDay()];
}
