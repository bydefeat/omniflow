import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { Role } from "@/shared/constants/role.constant";
import { hasRole } from "@/shared/libs/role.lib";
import { getSession } from "@/shared/libs/session.lib";
import { logger } from "@/shared/libs/logger.lib";

export type ActionErrorCode =
  | "INPUT_PARSE_ERROR"
  | "NOT_AUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "UNPROCESSABLE_CONTENT"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_SERVER_ERROR";

export class ActionError extends Error {
  constructor(
    readonly code: ActionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type ActionFailure = {
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[];
};

export type ActionResult<T> = readonly [T, null] | readonly [null, ActionFailure];

type InputType = "json" | "formData";
type InputOptions = { type?: InputType };

async function run<Ctx, Input, Output>(
  resolveContext: () => Promise<Ctx>,
  schema: z.ZodType<Input> | null,
  options: InputOptions,
  handler: (args: { input: Input; ctx: Ctx }) => Promise<Output>,
  raw: unknown,
): Promise<ActionResult<Output>> {
  try {
    const ctx = await resolveContext();
    let input = undefined as Input;
    if (schema) {
      const value = options.type === "formData" && raw instanceof FormData ? Object.fromEntries(raw) : raw;
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        const { fieldErrors, formErrors } = z.flattenError(parsed.error);
        return [
          null,
          {
            code: "INPUT_PARSE_ERROR",
            message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ",
            fieldErrors: fieldErrors as Record<string, string[] | undefined>,
            formErrors,
          },
        ];
      }
      input = parsed.data;
    }
    return [await handler({ input, ctx }), null];
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError) return [null, { code: error.code, message: error.message }];
    logger.error("action.failed", { error });
    return [null, { code: "INTERNAL_SERVER_ERROR", message: "Đã có lỗi xảy ra, vui lòng thử lại" }];
  }
}

function createProcedure<Ctx>(resolveContext: () => Promise<Ctx>) {
  return {
    createServerAction() {
      return {
        input<S extends z.ZodType, T extends InputType = "json">(schema: S, options: { type?: T } = {}) {
          return {
            handler<Output>(handler: (args: { input: z.output<S>; ctx: Ctx }) => Promise<Output>) {
              return async (input: T extends "formData" ? FormData : z.input<S>) =>
                run<Ctx, z.output<S>, Output>(resolveContext, schema as z.ZodType<z.output<S>>, options, handler, input);
            },
          };
        },
        handler<Output>(handler: (args: { ctx: Ctx }) => Promise<Output>) {
          return async () => run<Ctx, undefined, Output>(resolveContext, null, {}, handler, undefined);
        },
      };
    },
  };
}

async function requireActionSession() {
  const session = await getSession();
  if (!session) throw new ActionError("NOT_AUTHORIZED", "Phiên đăng nhập đã hết hạn");
  return { user: session.user, session: session.session };
}

export const authedProcedure = createProcedure(requireActionSession);

export const roleProcedure = (role: Role) =>
  createProcedure(async () => {
    const ctx = await requireActionSession();
    if (!hasRole(ctx.user.role, role)) {
      throw new ActionError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này");
    }
    return ctx;
  });
