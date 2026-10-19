import { canViewRequest } from "@/modules/approvals/approvals.query";
import { getAttachment } from "@/modules/requests/requests.query";
import { getSession } from "@/shared/libs/session.lib";
import { readStoredFile } from "@/shared/libs/storage.lib";

export async function GET(_request: Request, { params }: RouteContext<"/api/files/[fileId]">) {
  const session = await getSession();
  if (!session) return new Response("Phiên đăng nhập đã hết hạn", { status: 401 });

  const { fileId } = await params;
  const attachment = await getAttachment(fileId);
  if (!attachment || !(await canViewRequest(attachment.requestId, session.user.id))) {
    return new Response("Không tìm thấy tệp", { status: 404 });
  }

  const data = await readStoredFile(attachment.storageKey).catch(() => null);
  if (!data) return new Response("Không tìm thấy tệp", { status: 404 });

  const inline = attachment.mimeType === "application/pdf" || attachment.mimeType.startsWith("image/");
  const sandbox = attachment.mimeType !== "application/pdf";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(sandbox ? { "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" } : {}),
    },
  });
}
