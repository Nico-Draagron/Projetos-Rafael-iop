# Mind Blast 🧠⚡

**Aprenda. Jogue. Evolua.** App de estudos para alunos do 6º ao 9º ano, com quizzes por ano e matéria, pontos, loja de personagem e um **tutor de IA** que ensina sem entregar a resposta.

## O que o app faz

- **Quizzes** de 10 perguntas por ano, matéria e conteúdo (Matemática, Português, Ciências, História, Geografia, Artes, Ensino Religioso, Inglês e Espanhol), seguindo os conteúdos da BNCC.
- **Perguntas geradas por IA**: os conteúdos que ainda não têm perguntas prontas são gerados na hora pela Groq.
- **Tutor de IA** (Groq): ajuda durante a pergunta sem revelar a alternativa certa; depois que o aluno responde, explica o raciocínio passo a passo. Também tem o modo "Aprender com o tutor", livre, por matéria.
- **Pontos e loja**: cada acerto vale 100 pontos, que compram cabelos, roupas, acessórios, fundos e papéis de parede para o personagem.
- **Perfil**: saldo, quizzes feitos, % de acertos e progresso por matéria.
- O progresso fica salvo no próprio aparelho (localStorage).

## Estrutura

```
public/            → o site (HTML, CSS e JS, mesmo design do protótipo)
  index.html
  css/estilo.css
  js/dados.js      → anos, conteúdos, perguntas e itens da loja
  js/app.js        → telas e lógica do app
api/               → funções de servidor (rodam na Vercel)
  chat.js          → POST /api/chat  — tutor (resposta em streaming)
  quiz.js          → POST /api/quiz  — gera 10 perguntas
lib/groq.js        → conexão com a Groq, validação e limite de pedidos
server.js          → servidor para testar no seu computador
```

A chave da Groq fica **só no servidor** (variável `GROQ_API_KEY`) e nunca aparece no navegador. As instruções do tutor também são montadas no servidor, e o gabarito só é enviado à IA depois que o aluno responde.

## Publicar na Vercel

1. Acesse https://vercel.com/new e entre com o GitHub.
2. Importe o repositório **Projetos-Rafael-iop**.
3. Em **Framework Preset**, deixe **Other** (o `vercel.json` já configura o resto, não precisa de build).
4. Em **Environment Variables**, adicione:
   - `GROQ_API_KEY` = sua chave da Groq (crie em https://console.groq.com/keys)
   - (opcional) `GROQ_MODEL` = outro modelo da Groq. O padrão é `openai/gpt-oss-120b`.
5. Clique em **Deploy**.

Se você adicionar ou trocar a chave depois do deploy, vá em **Deployments → ⋯ → Redeploy** para ela valer.

> ⚠️ Nunca coloque a chave no código nem em commits. Se ela vazar, apague em https://console.groq.com/keys e crie outra.

## Testar no seu computador

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo. Não há dependências para instalar.

```bash
cp .env.example .env.local     # e coloque sua chave em GROQ_API_KEY
npm run dev                    # abre em http://localhost:3000
```

Sem a chave, o app funciona normalmente com as perguntas prontas; só o tutor e as perguntas geradas avisam que não estão configurados.

## Trocar o modelo da Groq

A Groq desativa modelos de tempos em tempos. Se o tutor parar de responder, confira os modelos de produção em https://console.groq.com/docs/models e defina `GROQ_MODEL` na Vercel com o novo nome.
