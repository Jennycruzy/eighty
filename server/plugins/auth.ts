import { createToolkitAuthPlugin } from "@agent-native/toolkit/app/auth/server";

import {
  EXAMPLE_ENTER_PATH,
  PUBLIC_PAGES,
  PUBLIC_DATA_PATHS,
} from "../../shared/access.ts";

export default createToolkitAuthPlugin({
  // The example sign-in checks its own one-time ticket (server/lib/example-accounts.ts).
  publicPaths: [
    ...PUBLIC_PAGES,
    ...PUBLIC_DATA_PATHS,
    "/states/*",
    EXAMPLE_ENTER_PATH,
    "/send-verification-link",
  ],
  workspaceAppPublicPaths: [...PUBLIC_PAGES, ...PUBLIC_DATA_PATHS, "/states/*"],
  betterAuth: {
    plugins: [
      {
        id: "eighty-verification",
        init: () => ({
          options: { emailVerification: { expiresIn: 24 * 60 * 60 } },
        }),
      },
    ],
  },
  rootAuth: false,
  marketing: false,
});
