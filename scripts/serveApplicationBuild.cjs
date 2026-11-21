const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "build");
const host = "127.0.0.1";
const port = 3100;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  const requested = path.resolve(root, `.${pathname}`);
  const safeRequested = requested.startsWith(`${root}${path.sep}`) ? requested : root;
  const candidate = fs.existsSync(safeRequested) && fs.statSync(safeRequested).isFile()
    ? safeRequested
    : path.join(root, "index.html");

  response.setHeader("Content-Type", mimeTypes[path.extname(candidate)] || "application/octet-stream");
  fs.createReadStream(candidate).pipe(response);
}).listen(port, host, () => {
  process.stdout.write(`Application emulator build available at http://${host}:${port}\n`);
});
