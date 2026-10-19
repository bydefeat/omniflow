import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAttachmentType } from "./requests.service";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : p)));

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

describe("resolveAttachmentType", () => {
  it("returns the canonical type when extension and content agree", () => {
    assert.equal(resolveAttachmentType(bytes("%PDF-1.7\n"), "hoa_don.PDF"), "application/pdf");
    assert.equal(resolveAttachmentType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "a.png"), "image/png");
    assert.equal(resolveAttachmentType(bytes([0xff, 0xd8, 0xff, 0xe1]), "anh.jfif"), "image/jpeg");
    assert.equal(resolveAttachmentType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "), "a.webp"), "image/webp");
    assert.equal(
      resolveAttachmentType(bytes(ZIP, "....word/document.xml"), "bao_gia.docx"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    assert.equal(
      resolveAttachmentType(bytes(ZIP, "....xl/workbook.xml"), "bang_ke.xlsx"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("accepts common real-world variants", () => {
    assert.equal(resolveAttachmentType(bytes("\r\n  %PDF-1.4"), "scan.pdf"), "application/pdf");
    assert.equal(resolveAttachmentType(bytes(OLE), "bang_ke.xls"), "application/vnd.ms-excel");
    assert.equal(resolveAttachmentType(bytes([0xef, 0xbb, 0xbf], "<html><table>"), "sao_ke.xls"), "application/vnd.ms-excel");
    assert.equal(resolveAttachmentType(bytes('<?xml version="1.0"?><Workbook>'), "erp.xls"), "application/vnd.ms-excel");
    assert.equal(resolveAttachmentType(bytes("{\\rtf1\\ansi"), "to_trinh.doc"), "application/msword");
    assert.equal(resolveAttachmentType(bytes(OLE), "to_trinh.doc"), "application/msword");
  });

  it("rejects content that does not match the extension", () => {
    assert.equal(resolveAttachmentType(bytes("<html><script>"), "hoa_don.pdf"), null);
    assert.equal(resolveAttachmentType(bytes("MZ\x90\x00"), "a.png"), null);
    assert.equal(resolveAttachmentType(bytes(ZIP, "evil/payload"), "a.docx"), null);
    assert.equal(resolveAttachmentType(bytes("<html>"), "a.doc"), null);
  });

  it("rejects unknown or missing extensions", () => {
    assert.equal(resolveAttachmentType(bytes("%PDF-1.7"), "hoa_don.exe"), null);
    assert.equal(resolveAttachmentType(bytes("%PDF-1.7"), "hoa_don"), null);
    assert.equal(resolveAttachmentType(bytes("<svg>"), "a.svg"), null);
  });
});
