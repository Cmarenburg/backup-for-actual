import "dotenv/config";
import fetch from "node-fetch";
import Fastify from "fastify";
import { pipeline } from "stream";
import util from "util";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const pump = util.promisify(pipeline);

const S3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const fastify = Fastify({
  logger: false,
});

fastify.get("/", async function handler(request, reply) {
  if (request.headers.authorization !== process.env.AUTH_TOKEN) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  console.log("Export: Logging in with password");

  const tokenResponse = await fetch(
    process.env.ACTUAL_INSTANCE_URL + "/account/login",
    {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({
        loginMethod: "password",
        password: process.env.ACTUAL_INSTANCE_PASSWORD,
      }),
    }
  );

  if (!tokenResponse.ok) {
    reply.code(500).send({ error: "Failed to authenticate with the backend" });
    return;
  }

  const {
    data: { token },
  } = await tokenResponse.json();

  console.log("Export: Getting files");

  const filesResponse = await fetch(
    process.env.ACTUAL_INSTANCE_URL + "/sync/list-user-files",
    {
      headers: { "X-ACTUAL-TOKEN": token },
    }
  );

  if (!filesResponse.ok) {
    reply.code(500).send({ error: "Failed to list files from the backend" });
    return;
  }

  const { data: files } = await filesResponse.json();
  const file = files.find(
    (file) => file.groupId === process.env.ACTUAL_BUDGET_ID
  );

  if (!file) {
    reply.code(404).send({ error: "File not found" });
    return;
  }

  console.log("Export: Downloading file");
  const fileResponse = await fetch(
    process.env.ACTUAL_INSTANCE_URL + "/sync/download-user-file",
    {
      headers: {
        "X-ACTUAL-TOKEN": token,
        "X-ACTUAL-FILE-ID": file.fileId,
      },
    }
  );

  console.log("Export: File downloaded");

  if (!fileResponse.ok) {
    reply
      .code(500)
      .send({ error: `Failed to download file: ${fileResponse.statusText}` });
    return;
  }

  //file name it should be format of sunrise or sunset based on current time {sunrise|sunset}-{date}.zip
  function getFileName() {
    const date = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const time = `${hours}-${minutes}-${seconds}`;
    const dateStr = `${year}-${month}-${day}`;
    // if time is between 6am and 6pm then sunrise else sunset

    if(request.query.name) {
      return `${request.query.name}-${dateStr}.zip`;
    }

    if (hours >= 6 && hours < 18) {
      return `sunrise-${dateStr}.zip`;
    }
    return `sunset-${dateStr}.zip`;
  }

  // upload to s3 bucket
  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: getFileName(),
    Body: fileResponse.body,
  };

  try {
    // const data = await S3.send(new PutObjectCommand(uploadParams));
    const upload =  new Upload({
      client: new S3Client({
        region: "auto",
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      }),
      params: uploadParams,
    });
    
    upload.on("httpUploadProgress", (progress) => {
      console.log(progress);
    });

    await upload.done();

  } catch (err) {
    console.log("Error", err);
  } finally {
    fileResponse.body.destroy();
  }
});

try {
  await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
  console.log(`Server listening on ${fastify.server.address().port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
