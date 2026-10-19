import { z } from "zod";

export const delegationInput = z
  .object({
    delegateId: z.string().min(1, "Vui lòng chọn người được ủy quyền"),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(1, "Vui lòng nhập lý do").max(255, "Tối đa 255 ký tự"),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "Thời điểm kết thúc phải sau thời điểm bắt đầu",
    path: ["endsAt"],
  });

export const delegationIdInput = z.object({ id: z.string().min(1) });

export type DelegationInput = z.infer<typeof delegationInput>;
