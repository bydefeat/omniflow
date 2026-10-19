import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

import { startMailSink } from "./mail-sink";
import { s3Credentials } from "./helpers";

export default async function globalSetup() {
  const smtp = process.env.DEFEAT_SMTP_CONNECTION_URL;
  const stopMail = smtp ? await startMailSink(Number(new URL(smtp).port || 25)) : null;

  const bucket = process.env.DEFEAT_S3_BUCKET_NAME;
  if (bucket) {
    const client = new S3Client({
      region: process.env.DEFEAT_S3_REGION || "auto",
      endpoint: process.env.DEFEAT_S3_ENDPOINT_URL || undefined,
      forcePathStyle: Boolean(process.env.DEFEAT_S3_ENDPOINT_URL),
      credentials: s3Credentials(),
    });
    await client.send(new CreateBucketCommand({ Bucket: bucket })).catch((error) => {
      if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(error.name)) throw error;
    });
  }

  return async () => {
    await stopMail?.();
  };
}
