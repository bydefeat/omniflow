import { canViewRequest } from "@/modules/approvals/approvals.query";
import { getAttachment } from "@/modules/requests/requests.query";
import { getSession } from "@/shared/libs/session.lib";
import { readStoredFile } from "@/shared/libs/storage.lib";

export async function GET(_request: Request, { params }: RouteContext<"/api/files/[fileId]">) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { fileId } = await params;
  const attachment = await getAttachment(fileId);
  if (!attachment || !(await canViewRequest(attachment.requestId, session.user.id))) {
    return new Response("Not found", { status: 404 });
  }

  const data = await readStoredFile(attachment.storageKey).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });

  const inline = attachment.mimeType === "application/pdf" || attachment.mimeType.startsWith("image/");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
