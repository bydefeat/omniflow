import { z } from "zod";

export const departmentInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Vui lòng nhập mã phòng ban")
    .max(20, "Tối đa 20 ký tự")
    .regex(/^[A-Z0-9_]+$/, "Chỉ gồm chữ in hoa, số và dấu _"),
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên phòng ban")
    .max(100, "Tối đa 100 ký tự"),
  phone: z
    .string()
    .trim()
    .max(15, "Tối đa 15 ký tự")
    .nullish()
    .transform((value) => value || null),
});

export const departmentUpdateInput = departmentInput.extend({
  id: z.string().min(1),
});

export const departmentIdInput = z.object({ id: z.string().min(1) });

export type DepartmentFormValues = z.input<typeof departmentInput>;
