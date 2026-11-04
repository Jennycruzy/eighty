import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

import {
  DEMO_ENTER_PATH,
  PUBLIC_PAGES,
  PUBLIC_DATA_PATHS,
} from "../../shared/access.ts";

export default createToolkitAuthPlugin({
  // The demo sign-in checks its own one-time ticket (server/lib/demo-accounts.ts).
  publicPaths: [
    ...PUBLIC_PAGES,
    ...PUBLIC_DATA_PATHS,
    "/states/*",
    DEMO_ENTER_PATH,
  ],
  workspaceAppPublicPaths: [...PUBLIC_PAGES, ...PUBLIC_DATA_PATHS, "/states/*"],
  rootAuth: false,
  marketing: false,
});
