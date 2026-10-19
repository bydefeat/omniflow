import { flushMailOutbox, isMailConfigured } from "@/shared/libs/mail.lib";

async function main() {
  if (!isMailConfigured) {
    console.info("SMTP chưa được cấu hình, bỏ qua");
    process.exit(0);
  }
  let total = { sent: 0, failed: 0 };
  for (;;) {
    const result = await flushMailOutbox();
    total = { sent: total.sent + result.sent, failed: total.failed + result.failed };
    if (result.sent + result.failed === 0) break;
  }
  console.info(`Đã gửi ${total.sent} email, lỗi ${total.failed}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
