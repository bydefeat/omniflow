import { z } from "zod";

import { ASSIGNABLE_ROLES } from "@/shared/constants/role.constant";
import { passwordSchema } from "@/shared/libs/password.lib";

const nullableId = z
  .string()
  .nullish()
  .transform((value) => value || null);

const userFields = {
  name: z.string().trim().min(1, "Vui lòng nhập họ tên").max(100, "Tối đa 100 ký tự"),
  employeeCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Vui lòng nhập mã nhân viên")
    .max(20, "Tối đa 20 ký tự")
    .regex(/^[A-Z0-9_]+$/, "Chỉ gồm chữ in hoa, số và dấu _"),
  departmentId: z.string().min(1, "Vui lòng chọn phòng ban"),
  managerId: nullableId,
  roles: z
    .array(z.string().refine((role) => ASSIGNABLE_ROLES.includes(role), "Vai trò không hợp lệ"))
    .default([]),
};

export const userCreateInput = z.object({
  ...userFields,
  email: z.email("Email không hợp lệ").trim().toLowerCase(),
  password: passwordSchema,
});

export const userUpdateInput = z.object({
  ...userFields,
  id: z.string().min(1),
});

export const userIdInput = z.object({ userId: z.string().min(1) });

export const userBanInput = z.object({
  userId: z.string().min(1),
  banned: z.boolean(),
  reason: z.string().trim().max(200).optional(),
});

export const userPasswordInput = z.object({
  userId: z.string().min(1),
  newPassword: passwordSchema,
});

export type UserCreateValues = z.input<typeof userCreateInput>;
export type UserUpdateValues = z.input<typeof userUpdateInput>;
