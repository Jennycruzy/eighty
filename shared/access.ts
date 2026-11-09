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
  "/example",
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
  return (
    path === HEALTH_PATH ||
    servicePaths().includes(path) ||
    isHelperPath(path) ||
    isMonthStatePath(path)
  );
}
// The health check is for the container only; Caddy keeps it closed from outside.
export const HEALTH_PATH = "/_agent-native/health";
export function staticFiles(): string[] {
  return [
    ...EXAMPLE_SAMPLE_FILES,
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
      "save_coverage_answer",
      "inspect_document",
      "upload_document",
      "list_documents",
      "get_document",
      "remove_document",
      "extract_evidence",
      "try_read_document",
      "telegram_link",
      "do_my_month",
      "proof_packet",
      "notice_date",
    ].map((name) => `/_agent-native/actions/${name}`),
    ...TELEGRAM_PATHS,
    "/send-verification-link",
    "/_agent-native/agent-engine/status",
    ...HELPER_PATHS,
    "/_agent-native/actions/propose_evidence",
    ...EXAMPLE_ACTIONS.map((name) => `/_agent-native/actions/${name}`),
    EXAMPLE_ENTER_PATH,
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

// The example. A example account may use only what a member uses on their own
// record. Everything else, including paths open to real members, is refused.
export const EXAMPLE_ENTER_PATH = "/enter-example";
export const EXAMPLE_SAMPLE_FILES = [
  "/example/maria-earnings-sample.png",
  "/example/maria-earnings-sample.pdf",
];
export const EXAMPLE_ACTIONS = [
  "start_example",
  "example_status",
  "example_month",
  "add_example_sample",
];
const EXAMPLE_MEMBER_ACTIONS = [
  "telegram_link",
  "do_my_month",
  "proof_packet",
  "notice_date",
  "extract_evidence",
  "propose_evidence",
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
const EXAMPLE_PAGES = ["/example", "/months", "/add", "/review"];
export function isExampleAllowedRequest(path: string, method: string): boolean {
  if (
    (isPublicPage(path) || isPublicData(path) || isStaticFile(path)) &&
    (method === "GET" || method === "HEAD")
  )
    return true;
  if (
    EXAMPLE_PAGES.some(
      (page) =>
        path === page ||
        path === `${page}.data` ||
        (page !== "/example" && path.startsWith(`${page}/`)),
    )
  )
    return method === "GET" || method === "HEAD";
  return (
    path === "/_agent-native/agent-engine/status" ||
    isMonthStatePath(path) ||
    isHelperPath(path) ||
    path === EXAMPLE_ENTER_PATH ||
    path === "/_agent-native/health" ||
    path === "/_agent-native/ui-capability" ||
    path === "/_agent-native/auth/session" ||
    path === "/_agent-native/auth/ba/get-session" ||
    path === "/_agent-native/auth/ba/sign-out" ||
    [...EXAMPLE_ACTIONS, ...EXAMPLE_MEMBER_ACTIONS].some(
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

// Telegram posts updates here, and the framework hands each queued message to
// its processor with a signed token. Both check their own secret.
export const TELEGRAM_PATHS = [
  "/_agent-native/integrations/telegram/webhook",
  "/_agent-native/integrations/process-task",
];
export function isTelegramPath(path: string): boolean {
  return TELEGRAM_PATHS.includes(path);
}
export const HELPER_PATHS = ["/_agent-native/month-helper"];
export function isHelperPath(path: string): boolean {
  return (
    path === HELPER_PATHS[0] ||
    /^\/_agent-native\/month-helper\/(threads(?:\/[a-zA-Z0-9_-]+)?|runs\/(?:active|latest|[a-zA-Z0-9_-]+\/(?:events|abort)))$/.test(
      path,
    )
  );
}

/**
 * The helper reads the same two page-state keys in one request
 * (?keys=navigate:<id>,guided-questions:<id>). Only a read, and only those keys.
 */
export const MONTH_STATE_BULK_PATH = "/_agent-native/application-state";
export function isMonthStateBulk(path: string, method: string, search: string): boolean {
  if (path !== MONTH_STATE_BULK_PATH || (method !== "GET" && method !== "HEAD")) return false;
  const keys = new URLSearchParams(search).get("keys");
  if (!keys) return false;
  const list = keys.split(",");
  return (
    list.length > 0 &&
    list.length <= 4 &&
    list.every((key) => isMonthStatePath(`${MONTH_STATE_BULK_PATH}/${key}`))
  );
}

export function isMonthStatePath(path: string): boolean {
  return /^\/_agent-native\/application-state\/(?:(?:navigation|navigate):[A-Za-z0-9_-]{1,96}|guided-questions(?::[A-Za-z0-9_-]{1,96})?)$/.test(
    path,
  );
}
