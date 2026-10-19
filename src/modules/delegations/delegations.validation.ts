import { z } from "zod";

const delegationFields = z.object({
  delegateId: z.string().min(1, "Vui lòng chọn người được ủy quyền"),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do").max(255, "Tối đa 255 ký tự"),
});

const validRange = (v: { startsAt: string; endsAt: string }) => new Date(v.endsAt) > new Date(v.startsAt);
const rangeError = { message: "Thời điểm kết thúc phải sau thời điểm bắt đầu", path: ["endsAt"] };

export const delegationInput = delegationFields.refine(validRange, rangeError);

export const adminDelegationInput = delegationFields
  .extend({ delegatorId: z.string().min(1, "Vui lòng chọn người ủy quyền") })
  .refine(validRange, rangeError);

export const delegationIdInput = z.object({ id: z.string().min(1) });

export type DelegationInput = z.infer<typeof delegationInput>;
