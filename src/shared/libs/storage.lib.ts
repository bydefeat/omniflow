import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { uuidv7 } from "uuidv7";

import { env } from "@/shared/libs/env.lib";

const root = path.resolve(process.cwd(), env.DEFEAT_UPLOAD_DIRECTORY);

function resolveKey(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error("Invalid storage key");
  return path.join(root, key);
}

export async function saveFile(data: Uint8Array) {
  await mkdir(root, { recursive: true });
  const key = uuidv7();
  await writeFile(resolveKey(key), data);
  return key;
}

export async function readStoredFile(key: string) {
  return readFile(resolveKey(key));
}

export async function deleteStoredFile(key: string) {
  await unlink(resolveKey(key)).catch(() => undefined);
}
