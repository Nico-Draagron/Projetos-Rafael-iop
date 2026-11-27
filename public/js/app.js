/* Mind Blast — lógica do app (telas, quiz, loja, perfil e tutor).
   O tutor e a geração de perguntas usam as funções do servidor em /api,
   que falam com a Groq. A chave nunca fica no navegador. */

const $=id=>document.getElementById(id),A=$("app");

/* ---------- Estado e progresso salvo no aparelho ---------- */
let P={xp:0,q:0,r:0,t:0,m:{},spent:0,inv:[],eq:{}};
try{Object.assign(P,JSON.parse(localStorage.getItem("mb2")||"{}"))}catch(e){}
const sv=()=>{try{localStorage.setItem("mb2",JSON.stringify(P))}catch(e){}};
let st={s:0,m:"",t:-1,tn:"",qs:[],i:0,pts:0,sel:-1,ch:[],opts:[],rev:false,free:false,busy:false};
const G={}; // perguntas geradas nesta sessão (cache)

/* ---------- Utilitários ---------- */
const shuf=a=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]);
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const R=(h,c)=>{document.body.className=c||"";const w=gi(P.eq,'papel')[4];document.body.style.background=c==="dk"?"":w[0];document.body.style.color=c==="dk"?"":w[1];A.innerHTML=h;window.scrollTo(0,0);menu(false)};
const hdr=b=>`<div class="top"><button class="ic" aria-label="Voltar" onclick="${b}">←</button><div class="lg">${LOGO}<span>MIND BLAST</span></div><button class="ic" aria-label="Menu" onclick="menu(true)">☰</button></div>`;
const wait=ms=>new Promise(z=>setTimeout(z,ms));
async function api(path,body){
  return fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}

/* ---------- Navegação ---------- */
function menu(o){$("mn").hidden=!o;if(o)$("mlg").innerHTML=LOGO+"<span>MIND BLAST</span>"}
function avail(m){return TOP.map((x,i)=>[x,i]).filter(([x])=>x[0]===m&&st.s>=x[2][0]&&st.s<=x[2][1])}
function welcome(){R(`<section class="wel">${LOGO}<h1><span>MIND</span><span class="p">BLAST</span></h1><p>Aprenda. Jogue. Evolua.</p><button class="btn" onclick="serie()">Começar</button><small>Transforme seu conhecimento em grandes conquistas!</small></section>`,"dk")}
function serie(){R(hdr("welcome()")+`<div class="pg"><h2>Em qual ano você está?</h2>`+S.map((n,i)=>`<button class="row" onclick="st.s=${i};mat()">${n}</button>`).join("")+`</div>`)}
function mat(){R(hdr("serie()")+`<div class="pg"><button class='me' onclick='loja()'>${av(P.eq,44)}<span>⭐ ${P.xp-P.spent} pontos<small>Personalizar personagem e papel de parede</small></span></button><h2>Escolha a matéria que você quer estudar:</h2><div class="g">`+Object.keys(COL).map(m=>`<button class="tl" style="background:${PAS[m]}" onclick="topics('${m}')"><span>${ICO[m]}</span>${m}</button>`).join("")+`</div></div>`)}
function topics(m){st.m=m;R(hdr("mat()")+`<div class="pg"><h2>${m}<br><small style="color:var(--mut);font-weight:400">${S[st.s]} · escolha o conteúdo</small></h2><button class="btn" style="margin:0 0 16px" onclick="learn('${m}')">📘 Aprender com o tutor</button>`+avail(m).map(([x,i])=>`<button class="row" onclick="start('${m}',${i})"><span style="font-size:1.6rem">${ICO[m]}</span><span>${x[1]}<small>10 perguntas</small></span></button>`).join("")+`<button class="row" onclick="start('${m}',-1)"><span style="font-size:1.6rem">🔀</span><span>Revisão geral<small>Mistura os conteúdos da matéria</small></span></button></div>`)}

/* ---------- Quiz ---------- */
// Gera 10 perguntas com IA quando o conteúdo ainda não tem perguntas prontas.
async function gen(m,t){
  const conteudos=t>=0?TOP[t][1]:avail(m).map(([x])=>x[1]).join("; ");
  let r;
  for(let n=0;;n++){
    r=await api("/api/quiz",{materia:m,ano:S[st.s],conteudos});
    if(r.status===429&&n<2){await wait(2000*(n+1));continue}
    break;
  }
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw{code:d.erro||"http"};
  const a=(Array.isArray(d.perguntas)?d.perguntas:[]).filter(x=>Array.isArray(x)&&typeof x[0]==="string"&&Array.isArray(x[1])&&x[1].length===4&&Number.isInteger(x[2])&&x[2]>=0&&x[2]<4);
  if(a.length<5)throw{code:"invalida"};
  return a;
}
async function load(m,t){
  const key=t>=0?"t"+t:"r"+m+st.s;let q=t>=0&&TOP[t][3]?TOP[t][3]:G[key];
  if(!q&&t<0){const k=avail(m).flatMap(([x])=>x[3]||[]);if(k.length>=10)q=k}
  if(!q){
    R(hdr(`topics('${m}')`)+`<div class="pg" style="text-align:center"><div style="font-size:3rem">🧠</div><h2>Preparando suas perguntas…</h2><p>O Mind Blast está montando 10 perguntas sobre ${esc(st.tn)}.</p></div>`);
    try{q=await gen(m,t);G[key]=q}catch(e){
      const msg=e&&e.code==="sem_chave"?"O gerador de perguntas ainda não foi configurado.":e&&e.code==="limite"?"Muitos pedidos seguidos. Espere um pouco e tente de novo.":"Tente de novo em alguns segundos.";
      R(hdr(`topics('${m}')`)+`<div class="pg" style="text-align:center"><div style="font-size:3rem">😕</div><h2>Não consegui montar o quiz</h2><p>${msg}</p><button class="btn" onclick="start('${m}',${t})">Tentar de novo</button></div>`);return;
    }
  }
  st.qs=shuf(q).slice(0,10);quiz();
}
function start(m,t){st.m=m;st.t=t;st.tn=t>=0?TOP[t][1]:"Revisão geral";st.i=0;st.pts=0;load(m,t)}
function quiz(){
  const q=st.qs[st.i],n=st.qs.length;st.opts=shuf(q[1].map((t,k)=>({t,c:k===q[2]})));st.sel=-1;st.ch=[];st.rev=false;st.free=false;
  R(hdr(`topics('${st.m}')`)+`<div class="pg"><div class="mt"><div class="pb"><b style="width:${st.i/n*100}%"></b></div>Pergunta ${st.i+1} de ${n}</div><span class="chip">${st.m}</span><h2>${esc(q[0])}</h2>`
  +st.opts.map((o,k)=>`<button class="ans" onclick="pick(${k})"><i>${"ABCD"[k]}</i>${esc(o.t)}</button>`).join("")
  +`<button class="btn" id="cf" disabled onclick="conf()">Confirmar resposta</button><button class="lnk" onclick="tutor()">💡 Preciso de ajuda do tutor</button></div>`);
}
function pick(k){st.sel=k;A.querySelectorAll(".ans").forEach((b,j)=>b.classList.toggle("on",j===k));$("cf").disabled=false}
function conf(){
  if(st.sel<0)return;
  const q=st.qs[st.i],ok=st.opts[st.sel].c,ci=st.opts.findIndex(o=>o.c),L="ABCD"[ci];
  st.rev=true;P.t++;const b=P.m[st.m]||[0,0];b[1]++;if(ok){P.r++;P.xp+=100;st.pts++;b[0]++}P.m[st.m]=b;sv();
  const last=st.i===st.qs.length-1;
  R(hdr(`topics('${st.m}')`)+`<div class="pg"><div class="fb ${ok?"ok":"bad"}"><div class="bd">${ok?"✓":"✕"}</div><h2>${ok?"Mandou bem!":"Quase!"}</h2><p>${ok?"Você acertou!":"A resposta correta é a letra "+L+"."}</p></div><div class="ex"><b>${esc(q[0])}</b><br>${L}) ${esc(st.opts[ci].t)}</div><button class="btn" onclick="next()">${last?"Ver resultado":"Próxima pergunta"}</button><button class="lnk" onclick="tutor()">💡 Entender melhor com o tutor</button></div>`);
}
function next(){st.i++;st.i<st.qs.length?quiz():end()}
function end(){P.q++;sv();R(hdr(`topics('${st.m}')`)+`<div class="pg" style="text-align:center"><div style="font-size:4rem">🏆</div><h2>Quiz concluído!</h2><p>Você acertou ${st.pts} de ${st.qs.length} perguntas em ${st.m}.</p><div class="box">Sua pontuação<div class="big">${st.pts*100} pontos</div></div><button class="btn" onclick="start(st.m,st.t)">Jogar novamente</button><button class="btn alt" onclick="mat()">Voltar para matérias</button><button class="lnk" onclick="loja()">🛍️ Gastar pontos na loja (saldo: ${P.xp-P.spent})</button></div>`)}

/* ---------- Personagem, loja e perfil ---------- */
const gi=(eq,c)=>ITEMS.find(x=>x[0]===(eq[c]||DEF[c]))||ITEMS.find(x=>x[0]===DEF[c]);
function av(eq,s){
  const sk=gi(eq,'pele')[4],[hs,hc]=gi(eq,'cabelo')[4],[rc,bolt]=gi(eq,'roupa')[4],bg=gi(eq,'fundo')[4],ac=ACC[eq.acessorio]||'';
  const back=hs==='l'?`<path d='M26 46c0-20 10-30 24-30s24 10 24 30v24h-9V46H35v24h-9z' fill='${hc}'/>`:'';
  const extra=hs==='m'?`<path d='M41 27 45 8l5 11 5-11 4 19z' fill='${hc}'/>`:hs==='k'?`<circle cx='34' cy='29' r='9' fill='${hc}'/><circle cx='50' cy='23' r='10' fill='${hc}'/><circle cx='66' cy='29' r='9' fill='${hc}'/>`:'';
  const top=`<path d='M27 46c-1-18 9-27 23-27s24 9 23 27c-5-9-12-13-23-13S32 37 27 46z' fill='${hc}'/>`;
  const bl=bolt?"<path d='M52 80 44 92h6l-2 8 10-13h-6z' fill='#FDE047'/>":'';
  return `<svg class='av' viewBox='0 0 100 100' width='${s}' height='${s}' role='img' aria-label='Seu personagem'><defs><linearGradient id='gg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#7C3AED'/><stop offset='1' stop-color='#0E0C33'/></linearGradient></defs><rect width='100' height='100' fill='${bg}'/>${back}<rect x='44' y='62' width='12' height='14' fill='${sk}'/><path d='M16 100c0-17 15-27 34-27s34 10 34 27z' fill='${rc}'/>${bl}<circle cx='50' cy='48' r='22' fill='${sk}'/>${extra}${top}<circle cx='42' cy='50' r='2.6' fill='#1B1946'/><circle cx='58' cy='50' r='2.6' fill='#1B1946'/><path d='M43 59q7 6 14 0' stroke='#1B1946' stroke-width='2' fill='none' stroke-linecap='round'/>${ac}</svg>`;
}
function loja(){
  const bal=P.xp-P.spent,cat=st.tab||'cabelo',own=x=>x[3]===0||P.inv.includes(x[0]);
  const tabs={cabelo:'Cabelo',roupa:'Roupa',acessorio:'Acessório',fundo:'Fundo',papel:'Papel de parede',pele:'Pele'};
  R(hdr('perfil()')+`<div class='pg'><div class='bal'>⭐ ${bal} pontos</div>${av(P.eq,140)}<div class='tabs'>`
  +Object.keys(tabs).map(k=>`<button class='tab${k===cat?' on':''}' onclick='tab("${k}")'>${tabs[k]}</button>`).join('')+`</div><div class='g'>`
  +ITEMS.filter(x=>x[1]===cat).map(x=>{const id=x[0],eq=(P.eq[cat]||DEF[cat])===id;return `<div class='it2${eq?' eq':''}'>${cat==='papel'?`<div class='sw' style='background:${x[4][0]||"#F6F5FF"}'></div>`:av({...P.eq,[cat]:id},64)}<div>${x[2]}</div>`
  +(eq?`<button disabled>Equipado</button>`:own(x)?`<button onclick='eqp("${id}")'>Equipar</button>`:`<button ${bal<x[3]?'disabled':''} onclick='buy("${id}")'>${bal<x[3]?'Faltam '+(x[3]-bal):'Comprar · '+x[3]}</button>`)+`</div>`}).join('')+`</div></div>`);
}
function tab(k){st.tab=k;loja()}
function eqp(id){const it=ITEMS.find(x=>x[0]===id);if(!it||(it[3]>0&&!P.inv.includes(id)))return;P.eq[it[1]]=id;sv();loja()}
function buy(id){const it=ITEMS.find(x=>x[0]===id);if(!it||P.inv.includes(id)||P.xp-P.spent<it[3])return;P.spent+=it[3];P.inv.push(id);eqp(id)}
function perfil(){
  const ms=Object.keys(P.m);
  R(hdr("mat()")+`<div class="pg"><div style="text-align:center">${av(P.eq,110)}</div><h2>👤 Meu perfil</h2><button class="btn alt" style="margin:0 0 16px" onclick="loja()">🛍️ Loja e personagem</button><div class="st"><div><b>${P.xp-P.spent}</b>Saldo de pontos</div><div><b>${P.q}</b>Quizzes feitos</div><div><b>${P.t?Math.round(P.r/P.t*100):0}%</b>Acertos</div></div><h2 style="font-size:1rem">Seu progresso por matéria:</h2>`
  +(ms.length?ms.map(m=>{const p=Math.round(P.m[m][0]/P.m[m][1]*100);return `<div class="pr">${ICO[m]||""} ${m}<div><div class="pb"><b style="width:${p}%"></b></div>${p}%</div></div>`}).join(""):"<p>Faça um quiz para ver seu progresso aqui.</p>")+`</div>`);
}

/* ---------- Tutor (chat com IA) ---------- */
function learn(m){
  st.m=m;st.free=true;st.tn=m;st.qs=[['',['','','',''],0]];st.i=0;st.opts=[{t:'',c:true},{t:'',c:false},{t:'',c:false},{t:'',c:false}];st.rev=false;
  st.ch=[{r:'a',t:`Oi! Eu sou o tutor de ${m}. Sobre qual assunto do ${S[st.s]} você quer ajuda? Pode escrever, por exemplo: “explica de um jeito fácil”.`}];
  tutor();
}
function draw(){const m=$("ms");m.innerHTML=st.ch.map(x=>`<div class="m ${x.r}">${esc(x.t)}</div>`).join("");m.scrollTop=m.scrollHeight}
function tutor(){
  if(!st.ch.length)st.ch.push({r:"a",t:"Oi! Eu sou o tutor do Mind Blast. Eu não entrego a resposta, mas te ajudo a chegar nela. Em que parte você travou?"});
  $("sh").hidden=false;draw();$("ti").focus();
}
function closeT(){$("sh").hidden=true}
// Monta o que o servidor precisa para criar as instruções do tutor.
function tutorPayload(){
  const base={ano:S[st.s],materia:st.m,mensagens:st.ch.slice(0,-1).slice(-9)};
  if(st.free)return{...base,modo:"livre"};
  const q=st.qs[st.i],p={...base,modo:"quiz",conteudo:st.tn,pergunta:q[0],alternativas:st.opts.map(o=>o.t),revelada:st.rev};
  if(st.rev)p.correta=st.opts.findIndex(o=>o.c); // só envia o gabarito depois que o aluno respondeu
  return p;
}
async function send(){
  const inp=$("ti"),v=inp.value.trim();if(!v||st.busy)return;inp.value="";
  const msg={r:"a",t:"Pensando…"};
  st.ch.push({r:"u",t:v},msg);draw();
  const body=tutorPayload();
  // Atualiza só se a conversa ainda estiver na tela (o aluno pode ter mudado de pergunta).
  const show=t=>{msg.t=t;if(st.ch.includes(msg))draw()};
  st.busy=true;
  try{
    let r;
    for(let n=0;;n++){
      r=await api("/api/chat",body);
      if(r.status===429&&n<2){await wait(2000*(n+1));continue}
      break;
    }
    if(!r.ok){const d=await r.json().catch(()=>({}));throw{code:d.erro||"http"}}
    const rd=r.body.getReader(),dec=new TextDecoder();let txt="";
    for(;;){const{value,done}=await rd.read();if(done)break;txt+=dec.decode(value,{stream:true});if(txt.trim())show(txt)}
    txt+=dec.decode();
    if(!txt.trim())throw{code:"vazio"};
    show(txt.trim());
  }catch(e){
    show(e&&e.code==="sem_chave"?"O tutor ainda não foi configurado. Peça para quem cuida do app colocar a chave da Groq.":e&&e.code==="limite"?"Muitas perguntas seguidas. Espere um pouco e tente de novo.":"O tutor não está disponível agora. Tente reler a pergunta e pensar em um passo de cada vez.");
  }finally{st.busy=false}
}

welcome();
