import { createServerActionProcedure, ZSAError } from "zsa";

import type { Role } from "@/shared/constants/role.constant";
import { hasRole } from "@/shared/libs/role.lib";
import { getSession } from "@/shared/libs/session.lib";

export const authedProcedure = createServerActionProcedure().handler(
  async () => {
    const session = await getSession();
    if (!session) {
      throw new ZSAError("NOT_AUTHORIZED", "Phiên đăng nhập đã hết hạn");
    }
    return { user: session.user, session: session.session };
  },
);

export const roleProcedure = (role: Role) =>
  createServerActionProcedure(authedProcedure).handler(async ({ ctx }) => {
    if (!hasRole(ctx.user.role, role)) {
      throw new ZSAError(
        "FORBIDDEN",
        "Bạn không có quyền thực hiện thao tác này",
      );
    }
    return ctx;
  });
