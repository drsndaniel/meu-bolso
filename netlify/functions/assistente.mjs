// Meu Bolso — assistente (função da Netlify, sem dependências)
// Recebe uma frase ou a foto de um cupom, pede ao Gemini que escolha uma ação
// e grava ou consulta a tabela gastos com o login da própria pessoa.

// Copiados de app/configuracao.js (são públicos).
const SUPABASE_URL = "https://tcqqxgkirxqpzchhaylm.supabase.co";
const SUPABASE_CHAVE_PUBLICA = "sb_publishable_QZz5Jb0100pubbTTGhLoIg_3htwlpBv";

const MODELO = "gemini-3.5-flash-lite";
const CATEGORIAS_PADRAO = ["Outros"];
const MIMES_ACEITOS = ["image/jpeg", "image/png", "image/webp"];

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ---------- Utilidades ----------

function responder(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function erro(status, mensagem) {
  return responder(status, { erro: mensagem });
}

// Data de hoje em São Paulo, no formato AAAA-MM-DD
function hojeSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function dataValida(texto) {
  return typeof texto === "string" && /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(texto));
}

function dataBR(iso) {
  const [a, m, d] = iso.split("-");
  return d + "/" + m + "/" + a;
}

function lerCategorias(lista) {
  if (!Array.isArray(lista)) return CATEGORIAS_PADRAO;
  const limpas = lista.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim().slice(0, 60)).slice(0, 30);
  return limpas.length ? limpas : CATEGORIAS_PADRAO;
}

// Escolhe a categoria da lista que bate com o que o modelo disse; senão, "Outros"
function ajustarCategoria(texto, categorias) {
  const alvo = String(texto || "").trim().toLowerCase();
  const achada = categorias.find((c) => c.toLowerCase() === alvo);
  if (achada) return achada;
  return categorias.find((c) => c.toLowerCase() === "outros") || categorias[categorias.length - 1];
}

// ---------- Supabase (sempre com o token da pessoa) ----------

function cabecalhosSupabase(token) {
  return {
    apikey: SUPABASE_CHAVE_PUBLICA,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };
}

async function conferirLogin(token) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: cabecalhosSupabase(token) });
  if (!r.ok) return null;
  return r.json();
}

// Transforma a resposta de erro do banco numa frase em português
async function erroDoBanco(r) {
  let detalhe = {};
  try { detalhe = await r.json(); } catch { /* sem corpo */ }
  const codigo = String(detalhe.code || "");
  const texto = String(detalhe.message || "").toLowerCase();
  if (r.status === 401 || texto.includes("jwt")) {
    return erro(401, "A sua entrada expirou. Toque em Sair e entre de novo.");
  }
  if (codigo === "PGRST205" || codigo === "42P01" || texto.includes("does not exist") || texto.includes("could not find the table")) {
    return erro(500, "A tabela gastos não existe no Supabase. Crie a tabela e tente de novo.");
  }
  if (codigo === "42501" || texto.includes("row-level security")) {
    return erro(403, "O banco não deixou gravar este dado. Saia e entre de novo; se continuar, confira a proteção por linha da tabela no Supabase.");
  }
  if (r.status === 429) {
    return erro(429, "O banco atingiu o limite de pedidos. Espere um minuto e tente de novo.");
  }
  return erro(500, "O banco não respondeu como esperado. Tente de novo em alguns segundos.");
}

async function registrarGasto(token, usuario, args, categorias, origem) {
  const valor = Math.round(Number(args.valor) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0) {
    return responder(200, { resposta: "Não entendi o valor. Diga quanto foi, por exemplo: mercado 50 hoje." });
  }
  const data = dataValida(args.data) ? args.data : hojeSaoPaulo();
  const categoria = ajustarCategoria(args.categoria, categorias);
  const descricao = String(args.descricao || "").trim().slice(0, 120) || null;

  const r = await fetch(SUPABASE_URL + "/rest/v1/gastos", {
    method: "POST",
    headers: { ...cabecalhosSupabase(token), Prefer: "return=representation" },
    body: JSON.stringify({ dono: usuario.id, data, descricao, valor, categoria, origem })
  });
  if (!r.ok) return erroDoBanco(r);

  const [gravado] = await r.json();
  const texto = "Lancei " + moeda.format(Number(gravado.valor)) + " em " + gravado.categoria +
    ": " + (gravado.descricao || "sem descrição") + ", " + dataBR(gravado.data) + ".";
  return responder(200, { resposta: texto, lancou: true });
}

async function consultarGastos(token, args, categorias) {
  const hoje = hojeSaoPaulo();
  const desde = dataValida(args.desde) ? args.desde : hoje.slice(0, 8) + "01";
  const ate = dataValida(args.ate) ? args.ate : hoje;

  const filtro = new URLSearchParams();
  filtro.append("select", "valor");
  filtro.append("data", "gte." + desde);
  filtro.append("data", "lte." + ate);
  let categoria = null;
  if (args.categoria) {
    categoria = ajustarCategoria(args.categoria, categorias);
    filtro.append("categoria", "eq." + categoria);
  }

  const r = await fetch(SUPABASE_URL + "/rest/v1/gastos?" + filtro.toString(), {
    headers: cabecalhosSupabase(token)
  });
  if (!r.ok) return erroDoBanco(r);

  // O total é a soma das linhas do banco, em centavos para não perder precisão
  const linhas = await r.json();
  const centavos = linhas.reduce((soma, g) => soma + Math.round(Number(g.valor) * 100), 0);
  const total = moeda.format(centavos / 100);
  const quantos = linhas.length === 1 ? "1 gasto" : linhas.length + " gastos";
  const onde = categoria ? " em " + categoria : "";
  const texto = "De " + dataBR(desde) + " a " + dataBR(ate) + ", você gastou " + total + onde + " (" + quantos + ").";
  return responder(200, { resposta: texto });
}

// ---------- Gemini ----------

function promptDoSistema(hoje, categorias) {
  return [
    "Você é o assistente do app Meu Bolso, de gastos pessoais. Responda sempre em português do Brasil, em uma ou duas frases.",
    "Hoje é " + hoje + " (horário de São Paulo). Use esta data para entender 'hoje', 'ontem', 'este mês' e parecidos.",
    "Categorias permitidas (use exatamente um destes nomes): " + categorias.join(", ") + ".",
    "Se a pessoa descrever um gasto, chame registrar_gasto. Se perguntar quanto gastou, chame consultar_gastos com o período certo.",
    "Nunca calcule totais você mesmo: os números vêm do banco.",
    "Se faltar o valor de um gasto, não chame ferramenta nenhuma e pergunte o valor.",
    "Quando vier a foto de um cupom fiscal: use o VALOR TOTAL do cupom (não um item isolado), a data de emissão do cupom e o nome da loja como descrição.",
    "Se a foto não for um cupom ou estiver ilegível, não chame ferramenta e peça outra foto."
  ].join("\n");
}

const FERRAMENTAS = [{
  function_declarations: [
    {
      name: "registrar_gasto",
      description: "Lança um gasto na conta da pessoa.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data do gasto, no formato AAAA-MM-DD." },
          descricao: { type: "string", description: "Onde ou com o quê (no cupom, o nome da loja)." },
          valor: { type: "number", description: "Valor em reais, maior que zero (no cupom, o valor total)." },
          categoria: { type: "string", description: "Uma das categorias permitidas." }
        },
        required: ["data", "descricao", "valor", "categoria"]
      }
    },
    {
      name: "consultar_gastos",
      description: "Consulta o total gasto num período, opcionalmente numa categoria.",
      parameters: {
        type: "object",
        properties: {
          desde: { type: "string", description: "Primeiro dia do período, AAAA-MM-DD." },
          ate: { type: "string", description: "Último dia do período, AAAA-MM-DD." },
          categoria: { type: "string", description: "Uma das categorias permitidas (opcional)." }
        },
        required: ["desde", "ate"]
      }
    }
  ]
}];

async function chamarGemini(chave, sistema, partes) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODELO + ":generateContent";
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: sistema }] },
      contents: [{ role: "user", parts: partes }],
      tools: FERRAMENTAS,
      generationConfig: { temperature: 0 }
    })
  });
}

// ---------- Entrada da função ----------

export default async (req) => {
  if (req.method !== "POST") {
    return erro(405, "Use o app para falar com o assistente.");
  }

  const chave = process.env.CHAVE_GEMINI;
  if (!chave) {
    return erro(500, "O assistente está sem a chave do Gemini. Cadastre CHAVE_GEMINI nas variáveis de ambiente da Netlify e publique de novo.");
  }

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return erro(401, "Você não está conectado. Entre no app e tente de novo.");
  }

  let usuario;
  try {
    usuario = await conferirLogin(token);
  } catch {
    return erro(502, "Não consegui falar com o Supabase. Verifique a internet e tente de novo.");
  }
  if (!usuario || !usuario.id) {
    return erro(401, "A sua entrada expirou. Toque em Sair e entre de novo.");
  }

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return erro(400, "Não entendi o pedido. Recarregue a página e tente de novo.");
  }

  const mensagem = String(corpo.mensagem || "").trim().slice(0, 500);
  const imagem = typeof corpo.imagem === "string" ? corpo.imagem : "";
  const mime = MIMES_ACEITOS.includes(corpo.mime) ? corpo.mime : "image/jpeg";
  const categorias = lerCategorias(corpo.categorias);

  if (!mensagem && !imagem) {
    return erro(400, "Escreva um gasto ou uma pergunta, ou mande a foto do cupom.");
  }

  const partes = [];
  if (imagem) partes.push({ inline_data: { mime_type: mime, data: imagem } });
  partes.push({ text: mensagem || "Lance o gasto deste cupom fiscal." });

  let r;
  try {
    r = await chamarGemini(chave, promptDoSistema(hojeSaoPaulo(), categorias), partes);
  } catch {
    return erro(502, "Não consegui falar com o Gemini. Tente de novo em alguns segundos.");
  }

  if (r.status === 429) {
    return erro(429, "O assistente atingiu o limite de uso do Gemini. Espere um minuto e tente de novo, ou lance à mão.");
  }
  if (r.status === 400 || r.status === 401 || r.status === 403) {
    const texto = (await r.text()).toLowerCase();
    if (texto.includes("api key") || texto.includes("api_key") || r.status !== 400) {
      return erro(500, "A chave do Gemini foi recusada. Confira CHAVE_GEMINI nas variáveis de ambiente da Netlify.");
    }
    return erro(400, "O Gemini não aceitou este pedido. Se mandou foto, tente uma foto mais nítida.");
  }
  if (!r.ok) {
    return erro(502, "O Gemini não respondeu agora. Tente de novo em alguns segundos.");
  }

  const resposta = await r.json();
  const partesResposta = (resposta.candidates && resposta.candidates[0] && resposta.candidates[0].content &&
    resposta.candidates[0].content.parts) || [];
  const chamada = partesResposta.find((p) => p.functionCall);

  try {
    if (chamada && chamada.functionCall.name === "registrar_gasto") {
      return await registrarGasto(token, usuario, chamada.functionCall.args || {}, categorias, imagem ? "foto" : "texto");
    }
    if (chamada && chamada.functionCall.name === "consultar_gastos") {
      return await consultarGastos(token, chamada.functionCall.args || {}, categorias);
    }
  } catch {
    return erro(502, "Não consegui falar com o Supabase. Verifique a internet e tente de novo.");
  }

  // Sem ferramenta: devolve o que o modelo escreveu (por exemplo, perguntando o valor)
  const texto = partesResposta.map((p) => p.text || "").join("").trim();
  return responder(200, { resposta: texto || "Não entendi. Tente algo como: mercado 50 hoje." });
};

export const config = { path: "/api/assistente" };
