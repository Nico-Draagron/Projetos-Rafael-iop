// Servidor local para testar o Mind Blast no seu computador (sem instalar nada).
// Uso: npm run dev  →  http://localhost:3000
// Na Vercel este arquivo não é usado: ela serve a pasta public/ e as funções de api/.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = join(ROOT, "public");

// Carrega .env.local / .env (formato CHAVE=valor), sem sobrescrever variáveis já definidas.
for (const f of [".env.local", ".env"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const routes = {
  "/api/chat": () => import("./api/chat.js"),
  "/api/quiz": () => import("./api/quiz.js"),
};
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (routes[url.pathname]) {
      let raw = "";
      for await (const c of req) { raw += c; if (raw.length > 100_000) break; }
      try { req.body = raw ? JSON.parse(raw) : undefined; } catch { req.body = raw; }
      const { default: handler } = await routes[url.pathname]();
      return await handler(req, res);
    }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    const file = join(PUBLIC, path);
    if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end(); }
    const data = await readFile(file);
    res.setHeader("Content-Type", TYPES[extname(file)] || "application/octet-stream");
    res.end(data);
  } catch (e) {
    if (!res.headersSent) res.statusCode = e.code === "ENOENT" ? 404 : 500;
    res.end(e.code === "ENOENT" ? "Não encontrado" : "Erro no servidor");
    if (e.code !== "ENOENT") console.error(e);
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Mind Blast rodando em http://localhost:${port}`);
  if (!process.env.GROQ_API_KEY) console.log("Aviso: GROQ_API_KEY não definida — o tutor e o gerador de quiz vão avisar que não estão configurados.");
});
