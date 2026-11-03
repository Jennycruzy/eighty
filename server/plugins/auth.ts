import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

import { PUBLIC_PAGES, PUBLIC_DATA_PATHS } from "../../shared/access.ts";

export default createToolkitAuthPlugin({
  publicPaths: [...PUBLIC_PAGES, ...PUBLIC_DATA_PATHS, "/states/*"],
  workspaceAppPublicPaths: [...PUBLIC_PAGES, ...PUBLIC_DATA_PATHS, "/states/*"],
  rootAuth: false,
  marketing: false,
});
