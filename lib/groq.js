// Funções compartilhadas pelas rotas /api: chamada à Groq, leitura do corpo,
// respostas JSON, limite de pedidos e validação de textos.

const BASE_URL = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
export const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export function hasKey() {
  return Boolean(process.env.GROQ_API_KEY);
}

/** Chama o endpoint de chat da Groq (compatível com a API da OpenAI). */
export async function groqChat({ messages, stream = false, json = false, maxTokens = 1024, temperature = 0.6 }) {
  const body = {
    model: MODEL,
    messages,
    stream,
    temperature,
    max_completion_tokens: maxTokens,
  };
  // Modelos gpt-oss "pensam" antes de responder; esforço baixo deixa o tutor rápido.
  if (MODEL.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";
  if (json) body.response_format = { type: "json_object" };

  return fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55_000),
  });
}

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

/** Lê o corpo JSON (a Vercel já entrega em req.body; o servidor local também). */
export function readBody(req) {
  let b = req.body;
  if (typeof b === "string") {
    try { b = JSON.parse(b); } catch { b = null; }
  }
  return b && typeof b === "object" ? b : null;
}

/** Aceita só POST; responde 405 nos outros métodos. */
export function onlyPost(req, res) {
  if (req.method === "POST") return true;
  res.setHeader("Allow", "POST");
  sendJson(res, 405, { erro: "metodo" });
  return false;
}

/** Texto limpo e com tamanho máximo. */
export function text(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Limite simples por IP (por instância do servidor): protege a sua cota da Groq
// contra cliques repetidos. Não substitui um limitador distribuído.
const hits = new Map();
export function rateLimited(req, { limit = 20, windowMs = 60_000 } = {}) {
  const fwd = req.headers["x-forwarded-for"];
  const ip = (typeof fwd === "string" ? fwd.split(",")[0] : "") || req.socket?.remoteAddress || "?";
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > limit;
}

/** Converte o status de erro da Groq numa resposta para o app. */
export function upstreamError(res, status) {
  if (status === 429) return sendJson(res, 429, { erro: "limite" });
  if (status === 401 || status === 403) return sendJson(res, 500, { erro: "chave_invalida" });
  return sendJson(res, 502, { erro: "ia_indisponivel" });
}
