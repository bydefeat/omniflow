import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchesFileKind } from "./requests.service";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p, "latin1")] : p)));

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

describe("matchesFileKind", () => {
  it("accepts files whose content, type and extension agree", () => {
    assert.ok(matchesFileKind(bytes("%PDF-1.7\n"), "application/pdf", "hoa_don.PDF"));
    assert.ok(matchesFileKind(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png", "a.png"));
    assert.ok(matchesFileKind(bytes([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", "a.jpeg"));
    assert.ok(matchesFileKind(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "), "image/webp", "a.webp"));
    assert.ok(matchesFileKind(bytes([0x50, 0x4b, 0x03, 0x04], "....word/document.xml"), DOCX, "bao_gia.docx"));
    assert.ok(matchesFileKind(bytes([0x50, 0x4b, 0x03, 0x04], "....xl/workbook.xml"), XLSX, "bang_ke.xlsx"));
    assert.ok(matchesFileKind(bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), "application/vnd.ms-excel", "a.xls"));
  });

  it("rejects content that does not match the declared type", () => {
    assert.ok(!matchesFileKind(bytes("<html><script>"), "application/pdf", "hoa_don.pdf"));
    assert.ok(!matchesFileKind(bytes("MZ\x90\x00"), "image/png", "a.png"));
    assert.ok(!matchesFileKind(bytes([0x50, 0x4b, 0x03, 0x04], "evil/payload"), DOCX, "a.docx"));
  });

  it("rejects mismatched extensions and unknown types", () => {
    assert.ok(!matchesFileKind(bytes("%PDF-1.7"), "application/pdf", "hoa_don.exe"));
    assert.ok(!matchesFileKind(bytes("%PDF-1.7"), "application/pdf", "hoa_don"));
    assert.ok(!matchesFileKind(bytes("<svg>"), "image/svg+xml", "a.svg"));
  });
});
