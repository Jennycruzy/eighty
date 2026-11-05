export const PUBLIC_PAGES = [
  "/",
  "/try",
  "/check",
  "/check/account",
  "/check/sign-in",
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
export const PUBLIC_DATA_PATHS = PUBLIC_PAGES.map((path) =>
  path === "/" ? "/_.data" : `${path}.data`,
);
export function isPublicData(path: string): boolean {
  return (
    PUBLIC_DATA_PATHS.includes(path) || /^\/states\/[a-z]{2}\.data$/i.test(path)
  );
}
export function isPublicPage(path: string): boolean {
  return (
    (PUBLIC_PAGES as readonly string[]).includes(path) ||
    /^\/states\/[a-z]{2}$/i.test(path)
  );
}
export const MEMBER_PAGES = [
  "/demo",
  "/months",
  "/add",
  "/review",
  "/plan",
  "/notice",
  "/settings",
  "/navigator",
  "/admin",
  "/proof/packets",
] as const;
export function isMemberPage(path: string): boolean {
  return MEMBER_PAGES.some(
    (prefix) =>
      path === prefix ||
      path === `${prefix}.data` ||
      path.startsWith(`${prefix}/`),
  );
}
export function isStaticFile(path: string): boolean {
  return path.startsWith("/assets/") || staticFiles().includes(path);
}
export function isAllowedService(path: string): boolean {
  return path === HEALTH_PATH || servicePaths().includes(path);
}
// The health check is for the container only; Caddy keeps it closed from outside.
export const HEALTH_PATH = "/_agent-native/health";
export function staticFiles(): string[] {
  return [
    ...DEMO_SAMPLE_FILES,
    "/favicon.svg",
    "/icon-180.svg",
    "/robots.txt",
    "/sitemap.xml",
    "/proof/answer-key.md",
    "/proof/answer-cases.json",
  ];
}
export function servicePaths(): string[] {
  return [
    ...[
      "add_manual_evidence",
      "confirm_evidence",
      "edit_evidence",
      "reject_evidence",
      "list_evidence",
      "check_month",
      "inspect_document",
      "upload_document",
      "list_documents",
      "get_document",
      "remove_document",
      "extract_evidence",
      "try_read_document",
    ].map((name) => `/_agent-native/actions/${name}`),
    ...DEMO_ACTIONS.map((name) => `/_agent-native/actions/${name}`),
    DEMO_ENTER_PATH,
    "/_agent-native/actions/prepare_member_account",
    "/_agent-native/actions/finish_member_account",
    "/_agent-native/ui-capability",
    "/_agent-native/auth/ba/sign-up/email",
    "/_agent-native/auth/ba/verify-email",
    "/_agent-native/auth/email-link/landing",
    "/_agent-native/auth/session",
    "/_agent-native/auth/ba/get-session",
    "/_agent-native/auth/ba/sign-in/email",
    "/_agent-native/auth/ba/sign-out",
  ];
}
export function isAllowedRequest(path: string, method: string): boolean {
  if (
    (isPublicPage(path) || isPublicData(path) || isStaticFile(path)) &&
    (method === "GET" || method === "HEAD")
  )
    return true;
  return isMemberPage(path) || isAllowedService(path);
}

// The demo. A demo account may use only what a member uses on their own
// record. Everything else, including paths open to real members, is refused.
export const DEMO_ENTER_PATH = "/enter-demo";
export const DEMO_SAMPLE_FILES = [
  "/demo/maria-earnings-sample.png",
  "/demo/maria-earnings-sample.pdf",
];
export const DEMO_ACTIONS = [
  "start_demo",
  "demo_status",
  "demo_month",
  "add_demo_sample",
];
const DEMO_MEMBER_ACTIONS = [
  "add_manual_evidence",
  "confirm_evidence",
  "edit_evidence",
  "reject_evidence",
  "list_evidence",
  "inspect_document",
  "upload_document",
  "list_documents",
  "get_document",
  "remove_document",
];
const DEMO_PAGES = ["/demo", "/months", "/add", "/review"];
export function isDemoAllowedRequest(path: string, method: string): boolean {
  if (
    (isPublicPage(path) || isPublicData(path) || isStaticFile(path)) &&
    (method === "GET" || method === "HEAD")
  )
    return true;
  if (
    DEMO_PAGES.some(
      (page) =>
        path === page ||
        path === `${page}.data` ||
        (page !== "/demo" && path.startsWith(`${page}/`)),
    )
  )
    return method === "GET" || method === "HEAD";
  return (
    path === DEMO_ENTER_PATH ||
    path === "/_agent-native/health" ||
    path === "/_agent-native/ui-capability" ||
    path === "/_agent-native/auth/session" ||
    path === "/_agent-native/auth/ba/get-session" ||
    path === "/_agent-native/auth/ba/sign-out" ||
    [...DEMO_ACTIONS, ...DEMO_MEMBER_ACTIONS].some(
      (name) => path === `/_agent-native/actions/${name}`,
    )
  );
}

export function safeMemberNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || /[\\%\s]/.test(value)) return null;
  if (value.startsWith("//")) return null;
  const url = new URL(value, "https://member.invalid");
  if (url.origin !== "https://member.invalid" || url.pathname.endsWith(".data"))
    return null;
  return MEMBER_PAGES.some(
    (page) => url.pathname === page || url.pathname.startsWith(`${page}/`),
  )
    ? `${url.pathname}${url.search}${url.hash}`
    : null;
}
