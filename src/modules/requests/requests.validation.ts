import { z } from "zod";

export const lineItemInput = z.object({
  name: z.string().trim().min(1, "Nhập tên hạng mục").max(200),
  unit: z.string().trim().min(1, "Nhập đơn vị tính").max(20),
  quantity: z.number("Nhập số lượng").positive("Số lượng phải lớn hơn 0").max(99_999_999),
  unitPrice: z.number("Nhập đơn giá").min(0, "Đơn giá không âm").max(9_999_999_999_999),
});

const draftFields = {
  title: z.string().trim().min(1, "Vui lòng nhập tiêu đề").max(200),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do").max(5000),
  formData: z.record(z.string(), z.unknown()).default({}),
  items: z.array(lineItemInput).max(100, "Tối đa 100 hạng mục").default([]),
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
