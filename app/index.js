


import "dotenv/config";
import fetch from "node-fetch";
import Fastify from "fastify";
import { pipeline } from 'stream';
import util from 'util';

const pump = util.promisify(pipeline);


const fastify = Fastify({
  logger: false,
});

fastify.get("/", async function handler(request, reply) {
  if (request.headers.authorization !== process.env.AUTH_TOKEN) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  console.log("Export: Logging in with password");

  const tokenResponse = await fetch(process.env.ACTUAL_INSTANCE_URL + "/account/login", {
    headers: { "Content-Type": "application/json" },
    method: "POST",
    body: JSON.stringify({
      loginMethod: "password",
      password: process.env.ACTUAL_INSTANCE_PASSWORD,
    }),
  });

  if (!tokenResponse.ok) {
    reply.code(500).send({ error: "Failed to authenticate with the backend" });
    return;
  }

  const { data: { token } } = await tokenResponse.json();

  console.log("Export: Getting files");

  const filesResponse = await fetch(process.env.ACTUAL_INSTANCE_URL + "/sync/list-user-files", {
    headers: { "X-ACTUAL-TOKEN": token },
  });

  if (!filesResponse.ok) {
    reply.code(500).send({ error: "Failed to list files from the backend" });
    return;
  }

  const { data: files } = await filesResponse.json();
  const file = files.find(file => file.groupId === process.env.ACTUAL_BUDGET_ID);

  if (!file) {
    reply.code(404).send({ error: "File not found" });
    return;
  }

  console.log("Export: Downloading file");
  const fileResponse = await fetch(process.env.ACTUAL_INSTANCE_URL + "/sync/download-user-file", {
    headers: {
      "X-ACTUAL-TOKEN": token,
      "X-ACTUAL-FILE-ID": file.fileId,
    },
  });

  if (!fileResponse.ok) {
    reply.code(500).send({ error: `Failed to download file: ${fileResponse.statusText}` });
    return;
  }

  // Set the appropriate headers for a zip file
  reply.header('Content-Type', 'application/zip');
  reply.header('Content-Disposition', 'attachment; filename="backupFile.zip"');

  console.log(fileResponse.body);

await pump(fileResponse.body, reply.raw).catch(err => {
    fastify.log.error(err);
    reply.code(500).send({ error: "Failed to stream the file" });
  });
});

(async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000 });
    console.log(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
})();