// POST /api/chat — Tutor Mind Blast.
// Recebe o contexto da pergunta e a conversa, monta as instruções do tutor aqui no
// servidor e devolve a resposta da Groq em streaming (texto puro, pedaço a pedaço).

import { groqChat, hasKey, onlyPost, rateLimited, readBody, sendJson, text, upstreamError } from "../lib/groq.js";

function systemPrompt(d) {
  const base = `Você é o Tutor do Mind Blast, um professor particular simpático para alunos do ${d.ano} do Ensino Fundamental. Seu objetivo é fazer o aluno ENTENDER de verdade.
Como explicar: use linguagem simples e frases curtas; se usar um termo técnico, explique em uma frase. Comece pelo mais básico e vá passo a passo. Dê um exemplo do dia a dia ou uma analogia e mostre um exemplo parecido já resolvido, com outros números ou outro caso. Termine com uma pergunta curta para checar se o aluno entendeu. Se ele errar ou disser que não entendeu, explique de outro jeito, mais simples. Elogie o esforço. Português do Brasil. Até 6 frases curtas; use passos numerados (1, 2, 3) quando ajudar, sem asteriscos nem markdown.
Fale só sobre estudos e sobre o assunto da escola. Se o aluno pedir algo fora disso ou inadequado para a idade, recuse com gentileza e volte para o conteúdo.`;

  if (d.modo === "livre") {
    return `${base}
ASSUNTO: ${d.materia} (${d.ano}). O aluno quer aprender ou tirar dúvidas. Siga o assunto que ele pedir. Se pedir exercícios, proponha um de cada vez e não entregue a resposta antes de ele tentar.`;
  }

  const alts = d.alternativas.map((o, k) => `${"ABCD"[k]}) ${o}`).join(" | ");
  const regra = d.revelada
    ? `O aluno já respondeu e viu o gabarito (alternativa ${"ABCD"[d.correta]}). Explique o raciocínio completo e por que ela está certa, passo a passo.`
    : `REGRA: nunca diga qual alternativa é a correta, nem o resultado final do cálculo, nem confirme ou negue uma alternativa que o aluno sugerir. Ensine o conceito e um exemplo parecido com outros dados, e deixe o aluno chegar à resposta. Se ele pedir a resposta, recuse com gentileza e dê uma dica.`;

  return `${base}
O aluno está em uma pergunta de ${d.materia} (conteúdo: ${d.conteudo}).
PERGUNTA: ${d.pergunta}
ALTERNATIVAS: ${alts}
${regra}`;
}

function parse(body) {
  if (!body) return null;
  const d = {
    modo: body.modo === "livre" ? "livre" : "quiz",
    ano: text(body.ano, 40) || "Ensino Fundamental",
    materia: text(body.materia, 60),
    conteudo: text(body.conteudo, 120),
    pergunta: text(body.pergunta, 600),
    alternativas: Array.isArray(body.alternativas) ? body.alternativas.slice(0, 4).map((o) => text(o, 200)) : [],
    revelada: body.revelada === true,
    correta: Number.isInteger(body.correta) && body.correta >= 0 && body.correta < 4 ? body.correta : -1,
  };
  if (!d.materia) return null;
  if (d.modo === "quiz" && (!d.pergunta || d.alternativas.length !== 4)) return null;
  if (d.revelada && d.correta < 0) d.revelada = false;

  const msgs = (Array.isArray(body.mensagens) ? body.mensagens : [])
    .slice(-9)
    .map((m) => ({ role: m && m.r === "u" ? "user" : "assistant", content: text(m && m.t, 1000) }))
    .filter((m) => m.content);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  d.mensagens = msgs;
  return d;
}

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;
  if (!hasKey()) return sendJson(res, 500, { erro: "sem_chave" });
  if (rateLimited(req, { limit: 20 })) return sendJson(res, 429, { erro: "limite" });

  const d = parse(readBody(req));
  if (!d) return sendJson(res, 400, { erro: "dados_invalidos" });

  let up;
  try {
    up = await groqChat({
      messages: [{ role: "system", content: systemPrompt(d) }, ...d.mensagens],
      stream: true,
      maxTokens: 1200,
      temperature: 0.6,
    });
  } catch {
    return sendJson(res, 502, { erro: "ia_indisponivel" });
  }
  if (!up.ok || !up.body) return upstreamError(res, up.status);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  // Lê o streaming da Groq (Server-Sent Events) e repassa só o texto da resposta.
  const dec = new TextDecoder();
  let buf = "";
  try {
    for await (const chunk of up.body) {
      buf += dec.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const piece = JSON.parse(data).choices?.[0]?.delta?.content;
          if (piece) res.write(piece);
        } catch { /* linha incompleta ou de controle: ignora */ }
      }
    }
  } catch { /* conexão interrompida: entrega o que já chegou */ }
  res.end();
}
