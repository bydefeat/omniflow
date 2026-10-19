import { eq } from "drizzle-orm";

import type { FormField } from "@/modules/request-types/request-types.validation";
import { approvalSteps, departments, requestTypes, user } from "@/modules/schema";
import { ROLES } from "@/shared/constants/role.constant";
import { auth } from "@/shared/libs/auth.lib";
import { db } from "@/shared/libs/db.lib";

async function ensureDepartment(code: string, name: string) {
  const [existing] = await db.select().from(departments).where(eq(departments.code, code));
  if (existing) return existing.id;
  const [created] = await db.insert(departments).values({ code, name }).returning();
  return created.id;
}

async function ensureUser(input: {
  email: string;
  password: string;
  name: string;
  employeeCode: string;
  departmentId: string;
  managerId?: string | null;
  roles: string[];
}) {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, input.email));
  if (existing) return existing.id;

  const result = await auth.api.createUser({
    body: {
      email: input.email,
      password: input.password,
      name: input.name,
      data: {
        role: [ROLES.EMPLOYEE, ...input.roles],
        employeeCode: input.employeeCode,
        departmentId: input.departmentId,
        managerId: input.managerId ?? null,
      },
    },
  });
  console.info(`  + ${input.email}`);
  return result.user.id;
}

type StepSeed = { name: string; approverType: "MANAGER" | "ROLE"; approverRole?: string };

async function ensureRequestType(input: {
  code: string;
  name: string;
  description: string;
  slaHours: number;
  hasLineItems: boolean;
  formSchema: FormField[];
  steps: StepSeed[];
}) {
  const [existing] = await db.select().from(requestTypes).where(eq(requestTypes.code, input.code));
  if (existing) return;
  const { steps, ...values } = input;
  const [created] = await db.insert(requestTypes).values(values).returning();
  await db.insert(approvalSteps).values(
    steps.map((step, index) => ({
      requestTypeId: created.id,
      stepOrder: index + 1,
      name: step.name,
      approverType: step.approverType,
      approverRole: step.approverRole ?? null,
    })),
  );
  console.info(`  + loại đơn ${input.code}`);
}

async function seedAdmin(departmentId: string) {
  const email = process.env.DEFEAT_SEED_ADMIN_EMAIL;
  const password = process.env.DEFEAT_SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Thiếu DEFEAT_SEED_ADMIN_EMAIL hoặc DEFEAT_SEED_ADMIN_PASSWORD trong .env");
  }
  await ensureUser({
    email,
    password,
    name: "Quản trị viên",
    employeeCode: "ADMIN",
    departmentId,
    roles: [ROLES.ADMIN],
  });
}

async function seedDemo(boardId: string) {
  const password = process.env.DEFEAT_SEED_DEMO_PASSWORD || "Omniflow@123";
  const itId = await ensureDepartment("PB_IT", "Công nghệ thông tin");
  const accountingId = await ensureDepartment("PB_KT", "Kế toán");

  const ceo = await ensureUser({
    email: "ceo@omniflow.local",
    password,
    name: "Trần Minh Quân",
    employeeCode: "NV0001",
    departmentId: boardId,
    roles: [ROLES.APPROVER, "ceo"],
  });
  const cfo = await ensureUser({
    email: "cfo@omniflow.local",
    password,
    name: "Lê Thu Hà",
    employeeCode: "NV0002",
    departmentId: boardId,
    managerId: ceo,
    roles: [ROLES.APPROVER, "cfo"],
  });
  const itLead = await ensureUser({
    email: "truongphong.it@omniflow.local",
    password,
    name: "Phạm Đức Anh",
    employeeCode: "NV0003",
    departmentId: itId,
    managerId: ceo,
    roles: [ROLES.APPROVER],
  });
  await ensureUser({
    email: "ketoan@omniflow.local",
    password,
    name: "Ngô Thị Lan",
    employeeCode: "NV0004",
    departmentId: accountingId,
    managerId: cfo,
    roles: ["accountant"],
  });
  await ensureUser({
    email: "nhanvien.it@omniflow.local",
    password,
    name: "Võ Hoàng Nam",
    employeeCode: "NV0005",
    departmentId: itId,
    managerId: itLead,
    roles: [],
  });

  await ensureRequestType({
    code: "LEAVE",
    name: "Nghỉ phép",
    description: "Gửi trước ít nhất 3 ngày làm việc, trừ trường hợp nghỉ ốm.",
    slaHours: 24,
    hasLineItems: false,
    formSchema: [
      {
        key: "leaveKind",
        label: "Loại nghỉ",
        type: "select",
        required: true,
        options: ["Nghỉ phép năm", "Nghỉ ốm", "Nghỉ việc riêng"],
      },
      { key: "leaveDates", label: "Thời gian nghỉ", type: "dateRange", required: true },
      { key: "handover", label: "Người nhận bàn giao", type: "text", required: false },
    ],
    steps: [{ name: "Quản lý trực tiếp duyệt", approverType: "MANAGER" }],
  });
  await ensureRequestType({
    code: "EXPENSE",
    name: "Thanh toán công tác",
    description: "Đính kèm hóa đơn VAT và vé cho từng khoản chi.",
    slaHours: 48,
    hasLineItems: true,
    formSchema: [
      { key: "destination", label: "Nơi công tác", type: "text", required: true },
      { key: "tripDates", label: "Thời gian công tác", type: "dateRange", required: true },
    ],
    steps: [
      { name: "Quản lý trực tiếp duyệt", approverType: "MANAGER" },
      { name: "Kế toán kiểm tra chứng từ", approverType: "ROLE", approverRole: "accountant" },
      { name: "Giám đốc tài chính duyệt", approverType: "ROLE", approverRole: "cfo" },
    ],
  });
  await ensureRequestType({
    code: "ASSET_BUY",
    name: "Mua sắm thiết bị IT",
    description: "Đính kèm ít nhất một báo giá.",
    slaHours: 48,
    hasLineItems: true,
    formSchema: [
      { key: "neededBy", label: "Cần trước ngày", type: "date", required: true },
      { key: "supplier", label: "Nhà cung cấp đề xuất", type: "text", required: false },
    ],
    steps: [
      { name: "Quản lý trực tiếp duyệt", approverType: "MANAGER" },
      { name: "Tổng giám đốc duyệt", approverType: "ROLE", approverRole: "ceo" },
    ],
  });

  console.info(`Tài khoản demo dùng mật khẩu: ${password}`);
}

async function main() {
  const boardId = await ensureDepartment("PB_BGD", "Ban Giám đốc");
  await seedAdmin(boardId);
  if (process.argv.includes("--demo")) await seedDemo(boardId);
  console.info("Seed xong");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
