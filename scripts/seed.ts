import { eq } from "drizzle-orm";

import { departments, user } from "@/modules/schema";
import { ROLES } from "@/shared/constants/role.constant";
import { auth } from "@/shared/libs/auth.lib";
import { db } from "@/shared/libs/db.lib";

async function seedDepartment() {
  const [existing] = await db
    .select()
    .from(departments)
    .where(eq(departments.code, "PB_BGD"));
  if (existing) return existing;

  const [created] = await db
    .insert(departments)
    .values({ code: "PB_BGD", name: "Ban Giám đốc" })
    .returning();
  return created;
}

async function seedAdmin(departmentId: string) {
  const email = process.env.DEFEAT_SEED_ADMIN_EMAIL;
  const password = process.env.DEFEAT_SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Thiếu DEFEAT_SEED_ADMIN_EMAIL hoặc DEFEAT_SEED_ADMIN_PASSWORD trong .env",
    );
  }

  const [existing] = await db.select().from(user).where(eq(user.email, email));
  if (existing) return console.info(`Admin đã tồn tại: ${email}`);

  await auth.api.createUser({
    body: {
      email,
      password,
      name: "Quản trị viên",
      data: {
        role: [ROLES.EMPLOYEE, ROLES.ADMIN],
        employeeCode: "ADMIN",
        departmentId,
      },
    },
  });
  console.info(`Đã tạo admin: ${email}`);
}

async function main() {
  const department = await seedDepartment();
  await seedAdmin(department.id);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
