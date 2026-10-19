import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/shared/libs/auth.lib";

export const { GET, POST } = toNextJsHandler(auth);
