import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { uuidv7 } from "uuidv7";

import { env } from "@/shared/libs/env.lib";

type Driver = {
  write(key: string, data: Uint8Array): Promise<void>;
  read(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
};

function localDriver(): Driver {
  const root = path.join(process.cwd(), "uploads");
  return {
    async write(key, data) {
      await mkdir(root, { recursive: true });
      await writeFile(path.join(root, key), data);
    },
    read: (key) => readFile(path.join(root, key)),
    remove: (key) => unlink(path.join(root, key)),
  };
}

function s3Driver(bucket: string): Driver {
  const client = new S3Client({
    region: env.DEFEAT_S3_REGION,
    endpoint: env.DEFEAT_S3_ENDPOINT_URL,
    forcePathStyle: Boolean(env.DEFEAT_S3_ENDPOINT_URL),
    credentials:
      env.DEFEAT_S3_ACCESS_KEY_ID && env.DEFEAT_S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.DEFEAT_S3_ACCESS_KEY_ID, secretAccessKey: env.DEFEAT_S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  return {
    async write(key, data) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data }));
    },
    async read(key) {
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return object.Body!.transformToByteArray();
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

const driver = env.DEFEAT_S3_BUCKET_NAME ? s3Driver(env.DEFEAT_S3_BUCKET_NAME) : localDriver();

function checkKey(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error("Invalid storage key");
  return key;
}

export async function saveFile(data: Uint8Array) {
  const key = uuidv7();
  await driver.write(checkKey(key), data);
  return key;
}

export async function readStoredFile(key: string) {
  return driver.read(checkKey(key));
}

export async function deleteStoredFile(key: string) {
  await driver.remove(checkKey(key)).catch(() => undefined);
}
