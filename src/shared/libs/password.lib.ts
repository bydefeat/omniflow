import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_HINT = `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, gồm cả chữ và số`;

export function passwordProblem(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Mật khẩu tối đa ${PASSWORD_MAX_LENGTH} ký tự`;
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) return "Mật khẩu cần có cả chữ và số";
  return null;
}

export const passwordSchema = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

export const passwordFormRule = {
  validator: (_: unknown, value: string | undefined) => {
    const problem = value ? passwordProblem(value) : null;
    return problem ? Promise.reject(new Error(problem)) : Promise.resolve();
  },
};
