import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

import { PUBLIC_PAGES } from "../../shared/access.ts";

export default createToolkitAuthPlugin({
  publicPaths: [...PUBLIC_PAGES, "/states/*"],
  workspaceAppPublicPaths: [...PUBLIC_PAGES, "/states/*"],
  rootAuth: false,
  marketing: false,
});
