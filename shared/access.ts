export const PUBLIC_PAGES = [
  "/",
  "/try",
  "/check",
  "/states",
  "/how-it-works",
  "/help",
  "/proof",
  "/share",
  "/for-navigators",
  "/about",
  "/privacy",
  "/terms",
  "/accessibility",
  "/security",
] as const;
export function isPublicPage(path: string): boolean {
  return (
    (PUBLIC_PAGES as readonly string[]).includes(path) ||
    /^\/states\/[a-z]{2}$/i.test(path)
  );
}
export function isMemberPage(path: string): boolean {
  return [
    "/months",
    "/add",
    "/review",
    "/plan",
    "/notice",
    "/settings",
    "/navigator",
    "/admin",
    "/proof/packets",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
export function isStaticFile(path: string): boolean {
  return (
    path.startsWith("/assets/") ||
    [
      "/favicon.svg",
      "/icon-180.svg",
      "/robots.txt",
      "/sitemap.xml",
      "/proof/answer-key.md",
      "/proof/answer-cases.json",
    ].includes(path)
  );
}
export function isAllowedService(path: string): boolean {
  return (
    path === "/_agent-native/health" ||
    [
      "/_agent-native/auth/session",
      "/_agent-native/auth/ba/get-session",
      "/_agent-native/auth/ba/sign-in/email",
      "/_agent-native/auth/ba/sign-out",
    ].includes(path)
  );
}
export function isAllowedRequest(path: string, method: string): boolean {
  if (
    (isPublicPage(path) || isStaticFile(path)) &&
    (method === "GET" || method === "HEAD")
  )
    return true;
  return isMemberPage(path) || isAllowedService(path);
}
