// POST /api/quiz — gera 10 perguntas de múltipla escolha com a Groq
// para conteúdos que ainda não têm perguntas prontas no app.
// Resposta: { perguntas: [[enunciado, [A, B, C, D], índiceCorreto], ...] }

import { groqChat, hasKey, onlyPost, rateLimited, readBody, sendJson, text, upstreamError } from "../lib/groq.js";

function prompt({ materia, ano, conteudos }) {
  return `Crie 10 perguntas de múltipla escolha de ${materia} para alunos do ${ano} do Ensino Fundamental, seguindo a BNCC, sobre: ${conteudos}. Regras: 4 alternativas por pergunta, só uma correta, enunciados claros e adequados à idade, nível variado, sem pegadinhas, conteúdo factual correto, em português do Brasil. Responda somente com JSON no formato {"perguntas":[{"q":"enunciado","o":["A","B","C","D"],"a":0}]} onde "a" é o índice (0 a 3) da alternativa correta, e a posição da correta deve variar entre as perguntas.`;
}

function validate(raw) {
  let v;
  try { v = JSON.parse(raw); } catch { return []; }
  const list = Array.isArray(v) ? v : Array.isArray(v?.perguntas) ? v.perguntas : [];
  return list
    .filter((x) => x && typeof x.q === "string" && x.q.trim() && Array.isArray(x.o) && x.o.length === 4 && Number.isInteger(x.a) && x.a >= 0 && x.a < 4)
    .map((x) => [x.q.trim().slice(0, 600), x.o.map((o) => String(o).trim().slice(0, 200)), x.a])
    .filter((x) => x[1].every(Boolean) && new Set(x[1]).size === 4)
    .slice(0, 10);
}

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  if (!hasKey()) return sendJson(res, 500, { erro: "sem_chave" });
  if (rateLimited(req, { limit: 6 })) return sendJson(res, 429, { erro: "limite" });

  const b = readBody(req);
  const d = { materia: text(b?.materia, 60), ano: text(b?.ano, 40), conteudos: text(b?.conteudos, 1500) };
  if (!d.materia || !d.ano || !d.conteudos) return sendJson(res, 400, { erro: "dados_invalidos" });

  // Até 2 tentativas: às vezes o modelo devolve um JSON incompleto.
  for (let n = 0; n < 2; n++) {
    let up;
    try {
      up = await groqChat({
        messages: [
          { role: "system", content: "Você é um professor que cria quizzes escolares. Responda sempre com JSON válido." },
          { role: "user", content: prompt(d) },
        ],
        json: true,
        maxTokens: 6000,
        temperature: 0.7,
      });
    } catch {
      return sendJson(res, 502, { erro: "ia_indisponivel" });
    }
    if (!up.ok) return upstreamError(res, up.status);

    const data = await up.json().catch(() => null);
    const perguntas = validate(data?.choices?.[0]?.message?.content || "");
    if (perguntas.length >= 5) return sendJson(res, 200, { perguntas });
  }
  return sendJson(res, 502, { erro: "invalida" });
}
