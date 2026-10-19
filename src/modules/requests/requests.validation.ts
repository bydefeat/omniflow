import { z } from "zod";

export const MAX_QUANTITY = 99_999_999.99;
export const MAX_AMOUNT = 9_999_999_999_999;

const hasAtMostTwoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

export const toCents = (value: number) => Math.round(value * 100);

export const lineAmountCents = (quantity: number, unitPrice: number) =>
  Math.round((toCents(quantity) * toCents(unitPrice)) / 100);

export const lineItemInput = z
  .object({
    name: z.string().trim().min(1, "Nhập tên hạng mục").max(200),
    unit: z.string().trim().min(1, "Nhập đơn vị tính").max(20),
    quantity: z
      .number("Nhập số lượng")
      .positive("Số lượng phải lớn hơn 0")
      .max(MAX_QUANTITY)
      .refine(hasAtMostTwoDecimals, "Số lượng có tối đa 2 chữ số thập phân"),
    unitPrice: z
      .number("Nhập đơn giá")
      .min(0, "Đơn giá không âm")
      .max(MAX_AMOUNT)
      .refine(hasAtMostTwoDecimals, "Đơn giá có tối đa 2 chữ số thập phân"),
  })
  .refine((item) => lineAmountCents(item.quantity, item.unitPrice) <= MAX_AMOUNT * 100, {
    message: "Thành tiền vượt quá giới hạn cho phép",
    path: ["unitPrice"],
  });

const draftFields = {
  title: z.string().trim().min(1, "Vui lòng nhập tiêu đề").max(200),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do").max(5000),
  formData: z.record(z.string(), z.unknown()).default({}),
  items: z
    .array(lineItemInput)
    .max(100, "Tối đa 100 hạng mục")
    .refine(
      (items) => items.reduce((sum, i) => sum + lineAmountCents(i.quantity, i.unitPrice), 0) <= MAX_AMOUNT * 100,
      "Tổng tiền vượt quá giới hạn cho phép",
    )
    .default([]),
};

export const requestDraftInput = z.object({
  ...draftFields,
  requestTypeId: z.string().min(1, "Vui lòng chọn loại đơn"),
});

export const requestDraftUpdateInput = z.object({
  ...draftFields,
  id: z.string().min(1),
});

export const requestIdInput = z.object({ requestId: z.string().min(1) });

export const attachmentUploadInput = z.object({
  requestId: z.string().min(1),
  file: z.instanceof(File),
});

export const attachmentIdInput = z.object({ attachmentId: z.string().min(1) });

export type LineItemInput = z.infer<typeof lineItemInput>;
export type RequestDraftInput = z.input<typeof requestDraftInput>;
