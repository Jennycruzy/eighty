import en from "../../../locales/en-US.json";
import es from "../../../locales/es-US.json";

export function readerCopy(spanish: boolean) {
  return (spanish ? es : en).reader;
}
export function fillIn(text: string, values: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}
