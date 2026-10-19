import { z } from "zod";

export const approveInput = z.object({
  approvalId: z.string().min(1),
  comment: z
    .string()
    .trim()
    .max(500, "Tối đa 500 ký tự")
    .optional()
    .transform((v) => v || null),
});

export const rejectInput = z.object({
  approvalId: z.string().min(1),
  comment: z.string().trim().min(1, "Vui lòng nhập lý do từ chối").max(500, "Tối đa 500 ký tự"),
});

export const submitInput = z.object({ requestId: z.string().min(1) });

export const cancelInput = z.object({ requestId: z.string().min(1) });
