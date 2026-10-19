import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "node:net";

export const MAILBOX = path.resolve(__dirname, "../../test-results/mailbox.jsonl");

export function startMailSink(port: number) {
  mkdirSync(path.dirname(MAILBOX), { recursive: true });
  writeFileSync(MAILBOX, "");
  const server = createServer((socket) => {
    let buffer = "";
    let inData = false;
    let message = { from: "", to: [] as string[], data: "" };
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply("220 omniflow-e2e ESMTP");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index;
      while ((index = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            appendFileSync(MAILBOX, `${JSON.stringify(message)}\n`);
            message = { from: "", to: [], data: "" };
            reply("250 OK");
          } else {
            message.data += `${line.startsWith("..") ? line.slice(1) : line}\n`;
          }
          continue;
        }
        const command = line.slice(0, 4).toUpperCase();
        if (command === "MAIL") message.from = line.slice(10);
        if (command === "RCPT") message.to.push(line.slice(8).replace(/[<>]/g, ""));
        if (command === "DATA") inData = true;
        if (command === "EHLO" || command === "HELO") reply("250 omniflow-e2e");
        else if (command === "DATA") reply("354 End data with <CR><LF>.<CR><LF>");
        else if (command === "QUIT") {
          reply("221 Bye");
          socket.end();
        } else reply("250 OK");
      }
    });
  });
  return new Promise<() => Promise<void>>((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve(() => new Promise((done) => server.close(() => done())))),
  );
}
