"use client";

import { DeleteOutlined, InboxOutlined, PaperClipOutlined } from "@ant-design/icons";
import { Alert, App, Button, Popconfirm, Upload } from "antd";
import { useState } from "react";

import { deleteAttachment, uploadAttachment } from "../requests.action";
import { ATTACHMENT_MAX_BYTES } from "../requests.constant";
import { ATTACHMENT_ACCEPT, formatFileSize, isAllowedAttachmentName } from "../requests.service";

export type AttachmentItem = {
  id: string;
  fileName: string;
  sizeBytes: number;
};

type Props = {
  requestId?: string | null;
  attachments: AttachmentItem[];
  editable?: boolean;
};

export function AttachmentsPanel({ requestId, attachments, editable = false }: Props) {
  const { message } = App.useApp();
  const [items, setItems] = useState(attachments);
  const [uploading, setUploading] = useState(0);

  async function upload(file: File) {
    if (!requestId) return;
    if (file.size > ATTACHMENT_MAX_BYTES) return message.error(`${file.name}: vượt quá 10 MB`);
    if (!isAllowedAttachmentName(file.name)) {
      return message.error(`${file.name}: chỉ nhận PDF, ảnh, Word hoặc Excel`);
    }
    const body = new FormData();
    body.append("requestId", requestId);
    body.append("file", file);
    setUploading((n) => n + 1);
    const [created, error] = await uploadAttachment(body);
    setUploading((n) => n - 1);
    if (error) return message.error(`${file.name}: ${error.message}`);
    setItems((current) => [...current, created]);
  }

  async function remove(item: AttachmentItem) {
    const [, error] = await deleteAttachment({ attachmentId: item.id });
    if (error) return message.error(error.message);
    setItems((current) => current.filter((i) => i.id !== item.id));
  }

  return (
    <div className="space-y-3">
      {editable && !requestId && (
        <Alert type="info" showIcon title="Lưu nháp trước để đính kèm hóa đơn, báo giá..." />
      )}

      {editable && requestId && (
        <Upload.Dragger
          multiple
          accept={ATTACHMENT_ACCEPT}
          showUploadList={false}
          disabled={uploading > 0}
          customRequest={({ file }) => upload(file as File)}
        >
          <p className="text-3xl text-black/30">
            <InboxOutlined />
          </p>
          <p>{uploading > 0 ? "Đang tải lên..." : "Kéo thả hoặc bấm để chọn tệp"}</p>
          <p className="text-xs text-black/45">PDF, ảnh, Word, Excel · tối đa 10 MB mỗi tệp</p>
        </Upload.Dragger>
      )}

      {items.length === 0 && !editable && <p className="text-black/45">Không có tệp đính kèm</p>}

      {items.length > 0 && (
        <ul className="m-0 list-none divide-y divide-black/5 rounded-lg border border-black/10 p-0">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <PaperClipOutlined className="text-black/45" />
              <a
                href={`/api/files/${item.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate"
              >
                {item.fileName}
              </a>
              <span className="text-xs whitespace-nowrap text-black/45">{formatFileSize(item.sizeBytes)}</span>
              {editable && (
                <Popconfirm title="Xóa tệp này?" okText="Xóa" cancelText="Hủy" onConfirm={() => remove(item)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Xóa tệp" />
                </Popconfirm>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
