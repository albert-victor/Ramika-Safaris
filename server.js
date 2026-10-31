const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const PID_FILE = path.join(ROOT, ".server.pid");
const URL = `http://127.0.0.1:${PORT}/`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function readPid() {
  if (!fs.existsSync(PID_FILE)) return null;
  const pid = Number(fs.readFileSync(PID_FILE, "utf8"));
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function stop() {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    console.log("Server is already stopped.");
    return;
  }
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    process.kill(pid, "SIGTERM");
  }
  if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  console.log(`Server stopped (pid ${pid}).`);
}

function resolveFile(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent((urlPath || "/").split("?")[0]);
  } catch {
    return null;
  }
  if (pathname.includes("\0")) return null;
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(ROOT, requested);
  const relative = path.relative(ROOT, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (relative.split(path.sep).some((part) => part.startsWith("."))) return null;
  return file;
}

function expandIncludes(html, fromFile, depth = 0) {
  if (depth > 6) return html;
  return html.replace(/<!--\s*@include\s+([^\s]+)\s*-->/g, (_, rel) => {
    const target = path.resolve(path.dirname(fromFile), rel);
    const relative = path.relative(ROOT, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return "";
    if (!fs.existsSync(target)) return "";
    const nested = fs.readFileSync(target, "utf8");
    return expandIncludes(nested, target, depth + 1);
  });
}

function start() {
  const existing = readPid();
  if (existing && isAlive(existing)) {
    console.log(`Server is already running at ${URL}`);
    return;
  }

  const server = http.createServer((request, response) => {
    const file = resolveFile(request.url || "/");
    if (!file) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad request");
      return;
    }

    fs.stat(file, (error, stat) => {
      const target = !error && stat.isDirectory() ? path.join(file, "index.html") : file;
      fs.readFile(target, (readError, body) => {
        if (readError) {
          response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          response.end("Not found");
          return;
        }
        const ext = path.extname(target).toLowerCase();
        if (ext === ".html") body = Buffer.from(expandIncludes(body.toString("utf8"), target));
        const type = TYPES[ext] || "application/octet-stream";
        response.writeHead(200, {
          "Content-Type": type,
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Private-Network": "true",
        });
        response.end(body);
      });
    });
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Stop the other server, or set PORT to a free port.`);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  });

  // 0.0.0.0 so phones on the same Wi‑Fi can open the LAN IP
  server.listen(PORT, "0.0.0.0", () => {
    fs.writeFileSync(PID_FILE, String(process.pid));
    console.log(`Ramika preview running at ${URL}`);
    console.log(`On your phone (same Wi‑Fi): http://<this-pc-ip>:${PORT}/`);
    console.log("Stop it with: npm stop");
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv.includes("--stop")) stop();
else start();
