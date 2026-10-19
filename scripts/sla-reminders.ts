import { sendOverdueReminders } from "@/modules/approvals/approvals.notify";
import { flushMailOutbox, isMailConfigured } from "@/shared/libs/mail.lib";

async function main() {
  const reminded = await sendOverdueReminders();
  if (isMailConfigured) await flushMailOutbox();
  console.info(`Đã nhắc ${reminded} lượt duyệt quá hạn`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
