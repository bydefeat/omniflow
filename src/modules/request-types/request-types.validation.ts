import { z } from "zod";

import { FUNCTIONAL_ROLES } from "@/shared/constants/role.constant";

export const FIELD_TYPES = ["text", "textarea", "number", "date", "dateRange", "select"] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

const FUNCTIONAL_ROLE_VALUES: readonly string[] = FUNCTIONAL_ROLES.map((r) => r.value);

export const formFieldSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z][a-zA-Z0-9_]{0,39}$/, "Mã trường bắt đầu bằng chữ thường, chỉ gồm chữ, số, _"),
    label: z.string().trim().min(1, "Vui lòng nhập nhãn").max(100),
    type: z.enum(FIELD_TYPES),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1)).max(50).optional(),
  })
  .refine((f) => f.type !== "select" || (f.options?.length ?? 0) > 0, {
    message: "Trường lựa chọn cần ít nhất một giá trị",
    path: ["options"],
  });

export type FormField = z.infer<typeof formFieldSchema>;

export const formSchemaInput = z.object({
  requestTypeId: z.string().min(1),
  fields: z
    .array(formFieldSchema)
    .max(30, "Tối đa 30 trường")
    .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, {
      message: "Mã trường bị trùng",
    }),
});

export const requestTypeInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Vui lòng nhập mã")
    .max(30)
    .regex(/^[A-Z0-9_]+$/, "Chỉ gồm chữ in hoa, số và dấu _"),
  name: z.string().trim().min(1, "Vui lòng nhập tên").max(100),
  description: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
  slaHours: z.number().int().min(1, "Tối thiểu 1 giờ").max(720, "Tối đa 720 giờ"),
  hasLineItems: z.boolean(),
});

export const requestTypeUpdateInput = requestTypeInput.extend({ id: z.string().min(1) });

export const requestTypeActiveInput = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export const approvalStepInput = z
  .object({
    name: z.string().trim().min(1, "Vui lòng nhập tên bước").max(100),
    approverType: z.enum(["MANAGER", "ROLE"]),
    approverRole: z
      .string()
      .nullish()
      .transform((v) => v || null),
  })
  .refine(
    (s) =>
      s.approverType === "MANAGER"
        ? s.approverRole === null
        : s.approverRole !== null && FUNCTIONAL_ROLE_VALUES.includes(s.approverRole),
    { message: "Bước theo vai trò cần chọn vai trò chức năng", path: ["approverRole"] },
  );

export const approvalStepsInput = z.object({
  requestTypeId: z.string().min(1),
  steps: z.array(approvalStepInput).min(1, "Cần ít nhất một bước duyệt").max(10),
});

export type RequestTypeFormValues = z.input<typeof requestTypeInput>;
export type ApprovalStepValues = z.input<typeof approvalStepInput>;

const requiredMessage = "Vui lòng nhập trường này";

export function buildFormValidator(fields: FormField[], options: { partial?: boolean } = {}) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    const required = field.required && !options.partial;
    let schema: z.ZodType;
    switch (field.type) {
      case "text":
      case "textarea": {
        const base = z.string().trim().max(field.type === "text" ? 500 : 5000);
        schema = required ? base.min(1, requiredMessage) : base.nullish();
        break;
      }
      case "number":
        schema = required ? z.number(requiredMessage) : z.number().nullish();
        break;
      case "date":
        schema = required ? z.iso.date(requiredMessage) : z.iso.date().nullish();
        break;
      case "dateRange": {
        const range = z
          .tuple([z.iso.date(), z.iso.date()])
          .refine(([from, to]) => from <= to, "Ngày kết thúc phải sau ngày bắt đầu");
        schema = required ? range : range.nullish();
        break;
      }
      case "select": {
        const choice = z.enum((field.options ?? [""]) as [string, ...string[]]);
        schema = required ? choice : choice.nullish();
        break;
      }
    }
    shape[field.key] = schema;
  }
  return z.object(shape);
}
