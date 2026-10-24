// Meu Bolso — lógica do app (sem framework, sem build)

(function () {
  "use strict";

  const config = window.MEU_BOLSO || {};
  const CATEGORIAS = config.CATEGORIAS || [];
  const $ = (id) => document.getElementById(id);

  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  let cliente = null;
  let usuario = null;
  let gastos = [];
  let categoriaEscolhida = null;
  let gastoPendente = null;

  // ---------- Utilidades ----------

  function hojeISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function limitesDoMes() {
    const d = new Date();
    const ano = d.getFullYear();
    const mes = d.getMonth();
    const inicio = ano + "-" + String(mes + 1).padStart(2, "0") + "-01";
    const prox = new Date(ano, mes + 1, 1);
    const fim = prox.getFullYear() + "-" + String(prox.getMonth() + 1).padStart(2, "0") + "-01";
    return { inicio, fim };
  }

  function dataBR(iso) {
    if (!iso) return "";
    const [a, m, d] = iso.slice(0, 10).split("-");
    return d + "/" + m + "/" + a;
  }

  // Aceita "45", "45,90", "1.234,56" e "45.90"
  function lerValor(texto) {
    let t = String(texto || "").trim().replace(/[R$\s]/g, "");
    if (!t) return NaN;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }

  function mostrar(el, texto) {
    el.textContent = texto;
    el.hidden = !texto;
  }

  // Todo erro vira uma frase em português dizendo o que fazer
  function traduzirErro(erro) {
    const msg = String((erro && (erro.message || erro.error_description)) || erro || "").toLowerCase();
    if (!navigator.onLine || msg.includes("failed to fetch") || msg.includes("network")) {
      return "Sem conexão com a internet. Verifique o Wi-Fi ou os dados móveis e tente de novo.";
    }
    if (msg.includes("invalid login credentials")) {
      return "E-mail ou senha incorretos. Confira os dois e tente de novo.";
    }
    if (msg.includes("already registered") || msg.includes("already exists")) {
      return "Este e-mail já tem conta. Toque em Entrar em vez de Criar conta.";
    }
    if (msg.includes("password") && (msg.includes("6") || msg.includes("short") || msg.includes("weak"))) {
      return "A senha precisa ter pelo menos 6 caracteres. Escolha uma senha maior.";
    }
    if (msg.includes("email") && msg.includes("invalid")) {
      return "Este e-mail não parece válido. Confira se digitou certo.";
    }
    if (msg.includes("email not confirmed")) {
      return "Este e-mail ainda não foi confirmado. Desligue a confirmação de e-mail no painel do Supabase e crie a conta de novo.";
    }
    if (msg.includes("rate limit") || msg.includes("too many")) {
      return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
    }
    if (msg.includes("jwt") || msg.includes("session") || msg.includes("not authenticated")) {
      return "A sua entrada expirou. Toque em Sair e entre de novo.";
    }
    if (msg.includes("row-level security") || msg.includes("permission denied")) {
      return "O banco não deixou gravar este dado. Saia e entre de novo; se continuar, confira a proteção por linha da tabela no Supabase.";
    }
    return "Algo deu errado. Tente de novo em alguns segundos; se continuar, saia e entre de novo.";
  }

  // ---------- Telas ----------

  function mostrarTela(nome) {
    $("carregando").hidden = true;
    $("tela-entrada").hidden = nome !== "entrada";
    $("tela-principal").hidden = nome !== "principal";
  }

  // ---------- Entrada ----------

  function lerCredenciais() {
    const email = $("email").value.trim();
    const senha = $("senha").value;
    if (!email || !senha) {
      mostrar($("erro-entrada"), "Preencha o e-mail e a senha.");
      return null;
    }
    if (senha.length < 6) {
      mostrar($("erro-entrada"), "A senha precisa ter pelo menos 6 caracteres.");
      return null;
    }
    return { email, password: senha };
  }

  function travarEntrada(travar) {
    $("botao-entrar").disabled = travar;
    $("botao-criar").disabled = travar;
  }

  async function entrar(evento) {
    evento.preventDefault();
    mostrar($("erro-entrada"), "");
    const cred = lerCredenciais();
    if (!cred) return;
    travarEntrada(true);
    try {
      const { error } = await cliente.auth.signInWithPassword(cred);
      if (error) throw error;
    } catch (e) {
      mostrar($("erro-entrada"), traduzirErro(e));
    } finally {
      travarEntrada(false);
    }
  }

  async function criarConta() {
    mostrar($("erro-entrada"), "");
    const cred = lerCredenciais();
    if (!cred) return;
    travarEntrada(true);
    try {
      const { data, error } = await cliente.auth.signUp(cred);
      if (error) throw error;
      if (!data.session) {
        // Sem sessão: a confirmação de e-mail ainda está ligada no Supabase
        mostrar($("erro-entrada"), "Conta criada, mas o Supabase pediu confirmação por e-mail. Desligue \"Confirm email\" no painel do Supabase e toque em Entrar.");
      }
    } catch (e) {
      mostrar($("erro-entrada"), traduzirErro(e));
    } finally {
      travarEntrada(false);
    }
  }

  async function sair() {
    await cliente.auth.signOut();
  }

  // ---------- Dados ----------

  async function carregarGastos() {
    const { inicio, fim } = limitesDoMes();
    const { data, error } = await cliente
      .from("gastos")
      .select("id, data, descricao, valor, categoria, origem, criado_em")
      .gte("data", inicio)
      .lt("data", fim)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false });
    if (error) {
      mostrar($("aviso-geral"), traduzirErro(error));
      return;
    }
    mostrar($("aviso-geral"), "");
    gastos = data || [];
    desenharTotais();
    desenharLista();
  }

  async function carregarResumo() {
    const { data, error } = await cliente
      .from("resumos")
      .select("texto, criado_em")
      .order("criado_em", { ascending: false })
      .limit(1);
    const resumo = !error && data && data[0];
    $("cartao-resumo").hidden = !(resumo && resumo.texto);
    if (resumo && resumo.texto) {
      $("texto-resumo").textContent = resumo.texto;
      $("data-resumo").textContent = "Gerado em " + dataBR(resumo.criado_em);
    }
  }

  // ---------- Desenho ----------

  function desenharCabecalho() {
    const d = new Date();
    $("data-hoje").textContent = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    $("nome-mes").textContent = MESES[d.getMonth()];
  }

  function desenharTotais() {
    const porCategoria = {};
    let total = 0;
    for (const g of gastos) {
      const v = Number(g.valor) || 0;
      total += v;
      porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + v;
    }
    $("total-mes").textContent = moeda.format(total);

    const lista = $("barras");
    lista.innerHTML = "";
    const ordem = Object.keys(porCategoria).sort((a, b) => porCategoria[b] - porCategoria[a]);
    const maior = ordem.length ? porCategoria[ordem[0]] : 0;
    for (const cat of ordem) {
      const li = document.createElement("li");
      const linha = document.createElement("div");
      linha.className = "barra-linha";
      const nome = document.createElement("span");
      nome.textContent = cat;
      const valor = document.createElement("strong");
      valor.textContent = moeda.format(porCategoria[cat]);
      linha.append(nome, valor);
      const fundo = document.createElement("div");
      fundo.className = "barra-fundo";
      const barra = document.createElement("div");
      barra.className = "barra";
      barra.style.width = (maior > 0 ? (porCategoria[cat] / maior) * 100 : 0) + "%";
      fundo.append(barra);
      li.append(linha, fundo);
      lista.append(li);
    }
  }

  function desenharLista() {
    const lista = $("lista-gastos");
    lista.innerHTML = "";
    $("lista-vazia").hidden = gastos.length > 0;
    for (const g of gastos) {
      const li = document.createElement("li");
      const info = document.createElement("div");
      info.className = "item-info";
      const desc = document.createElement("div");
      desc.className = "item-descricao";
      desc.textContent = g.descricao || g.categoria;
      const det = document.createElement("div");
      det.className = "item-detalhe";
      det.textContent = dataBR(g.data) + " · " + g.categoria;
      info.append(desc, det);
      const valor = document.createElement("span");
      valor.className = "item-valor";
      valor.textContent = moeda.format(Number(g.valor) || 0);
      const apagar = document.createElement("button");
      apagar.type = "button";
      apagar.className = "botao-apagar";
      apagar.textContent = "Apagar";
      apagar.setAttribute("aria-label", "Apagar " + (g.descricao || g.categoria) + " de " + moeda.format(Number(g.valor) || 0));
      apagar.addEventListener("click", () => apagarGasto(g));
      li.append(info, valor, apagar);
      lista.append(li);
    }
  }

  function desenharCategorias() {
    const caixa = $("categorias");
    caixa.innerHTML = "";
    for (const cat of CATEGORIAS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "categoria";
      b.textContent = cat;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(cat === categoriaEscolhida));
      b.addEventListener("click", () => {
        categoriaEscolhida = cat;
        desenharCategorias();
      });
      caixa.append(b);
    }
  }

  // ---------- Lançar à mão ----------

  function prepararRevisao(evento) {
    evento.preventDefault();
    mostrar($("erro-gasto"), "");
    const valor = lerValor($("valor").value);
    const data = $("data").value;
    const descricao = $("descricao").value.trim();

    if (!Number.isFinite(valor) || valor <= 0) {
      mostrar($("erro-gasto"), "Digite um valor maior que zero, por exemplo 45,90.");
      return;
    }
    if (!categoriaEscolhida) {
      mostrar($("erro-gasto"), "Escolha uma categoria tocando num dos botões.");
      return;
    }
    if (!data) {
      mostrar($("erro-gasto"), "Escolha a data do gasto.");
      return;
    }

    gastoPendente = { valor, descricao, categoria: categoriaEscolhida, data };
    $("rev-valor").textContent = moeda.format(valor);
    $("rev-descricao").textContent = descricao || "—";
    $("rev-categoria").textContent = categoriaEscolhida;
    $("rev-data").textContent = dataBR(data);
    $("form-gasto").hidden = true;
    $("revisao").hidden = false;
    $("botao-confirmar").focus();
  }

  function corrigir() {
    gastoPendente = null;
    $("revisao").hidden = true;
    $("form-gasto").hidden = false;
    $("valor").focus();
  }

  async function confirmar() {
    if (!gastoPendente) return;
    const botao = $("botao-confirmar");
    botao.disabled = true;
    try {
      const { error } = await cliente.from("gastos").insert({
        dono: usuario.id,
        data: gastoPendente.data,
        descricao: gastoPendente.descricao || null,
        valor: gastoPendente.valor,
        categoria: gastoPendente.categoria,
        origem: "manual"
      });
      if (error) throw error;

      // Formulário limpo e pronto para o próximo gasto (a data continua a mesma)
      gastoPendente = null;
      categoriaEscolhida = null;
      $("valor").value = "";
      $("descricao").value = "";
      desenharCategorias();
      $("revisao").hidden = true;
      $("form-gasto").hidden = false;
      await carregarGastos();
      mostrar($("aviso-geral"), "Gasto salvo.");
      setTimeout(() => mostrar($("aviso-geral"), ""), 2500);
    } catch (e) {
      corrigir();
      mostrar($("erro-gasto"), traduzirErro(e));
    } finally {
      botao.disabled = false;
    }
  }

  async function apagarGasto(g) {
    const ok = window.confirm("Apagar \"" + (g.descricao || g.categoria) + "\" de " + moeda.format(Number(g.valor) || 0) + "?");
    if (!ok) return;
    const { error } = await cliente.from("gastos").delete().eq("id", g.id);
    if (error) {
      mostrar($("aviso-geral"), traduzirErro(error));
      return;
    }
    await carregarGastos();
  }

  // ---------- Assistente ----------

  const LADO_MAXIMO = 1600;
  let seletorFoto = null;

  function travarAssistente(travar) {
    for (const el of $("form-assistente").querySelectorAll("input, button")) el.disabled = travar;
  }

  // Reduz a foto no aparelho (no máximo 1600 px, JPEG) e devolve só o base64.
  // A foto fica só na memória e não é guardada em lugar nenhum.
  function reduzirFoto(arquivo) {
    return new Promise((resolver, rejeitar) => {
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
        const tela = document.createElement("canvas");
        tela.width = Math.round(img.width * escala);
        tela.height = Math.round(img.height * escala);
        tela.getContext("2d").drawImage(img, 0, 0, tela.width, tela.height);
        URL.revokeObjectURL(url);
        resolver(tela.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        rejeitar(new Error("foto ilegível"));
      };
      img.src = url;
    });
  }

  async function falarComAssistente(pedido) {
    mostrar($("aviso-assistente"), pedido.imagem ? "Lendo o cupom…" : "Pensando…");
    travarAssistente(true);
    try {
      const { data } = await cliente.auth.getSession();
      if (!data.session) throw new Error("not authenticated");
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + data.session.access_token
        },
        body: JSON.stringify({ ...pedido, categorias: CATEGORIAS })
      });
      let corpo = {};
      try { corpo = await r.json(); } catch (_) { /* resposta sem JSON */ }
      if (!r.ok) {
        mostrar($("aviso-assistente"), corpo.erro || "O assistente não respondeu agora. Tente de novo em alguns segundos.");
        return;
      }
      mostrar($("aviso-assistente"), corpo.resposta || "");
      if (corpo.lancou) {
        $("frase").value = "";
        await carregarGastos();
      }
    } catch (e) {
      mostrar($("aviso-assistente"), traduzirErro(e));
    } finally {
      travarAssistente(false);
    }
  }

  function enviarFrase(evento) {
    evento.preventDefault();
    const mensagem = $("frase").value.trim();
    if (!mensagem) {
      mostrar($("aviso-assistente"), "Escreva um gasto, como \"mercado 50 hoje\", ou uma pergunta.");
      $("frase").focus();
      return;
    }
    falarComAssistente({ mensagem });
  }

  function escolherFoto() {
    if (!seletorFoto) {
      seletorFoto = document.createElement("input");
      seletorFoto.type = "file";
      seletorFoto.accept = "image/*";
      seletorFoto.setAttribute("capture", "environment");
      seletorFoto.hidden = true;
      seletorFoto.addEventListener("change", enviarFoto);
      document.body.append(seletorFoto);
    }
    seletorFoto.value = "";
    seletorFoto.click();
  }

  // ---------- Microfone (reconhecimento de voz do navegador) ----------

  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  let ouvinte = null;

  function prepararMicrofone() {
    if (!Reconhecimento) {
      // Sem reconhecimento de voz: o botão some e fica a dica do teclado
      $("botao-microfone").hidden = true;
      $("dica-microfone").hidden = false;
      return;
    }
    $("botao-microfone").hidden = false;
    $("botao-microfone").addEventListener("click", ouvir);
  }

  function ouvir() {
    if (ouvinte) {
      ouvinte.stop();
      return;
    }
    ouvinte = new Reconhecimento();
    ouvinte.lang = "pt-BR";
    ouvinte.interimResults = false;
    ouvinte.maxAlternatives = 1;
    let ouviu = false;

    ouvinte.onresult = (evento) => {
      const texto = evento.results[0][0].transcript.trim();
      if (!texto) return;
      ouviu = true;
      $("frase").value = texto;
    };
    ouvinte.onerror = (evento) => {
      const frases = {
        "not-allowed": "O navegador não deixou usar o microfone. Permita o microfone nas configurações do site e tente de novo.",
        "service-not-allowed": "O navegador não deixou usar o microfone. Permita o microfone nas configurações do site e tente de novo.",
        "no-speech": "Não ouvi nada. Toque no microfone e fale de novo.",
        "audio-capture": "Não encontrei um microfone neste aparelho. Use o microfone do teclado do celular.",
        "network": "Sem conexão para entender a fala. Verifique a internet e tente de novo."
      };
      if (evento.error !== "aborted") {
        mostrar($("aviso-assistente"), frases[evento.error] || "Não consegui ouvir agora. Tente de novo ou use o microfone do teclado do celular.");
      }
    };
    ouvinte.onend = () => {
      ouvinte = null;
      $("botao-microfone").classList.remove("ouvindo");
      $("botao-microfone").setAttribute("aria-label", "Falar");
      if (ouviu) falarComAssistente({ mensagem: $("frase").value.trim() });
      else if ($("aviso-assistente").textContent === "Ouvindo…") mostrar($("aviso-assistente"), "");
    };

    try {
      ouvinte.start();
    } catch (_) {
      ouvinte = null;
      mostrar($("aviso-assistente"), "Não consegui ligar o microfone. Tente de novo ou use o microfone do teclado do celular.");
      return;
    }
    $("botao-microfone").classList.add("ouvindo");
    $("botao-microfone").setAttribute("aria-label", "Parar de ouvir");
    mostrar($("aviso-assistente"), "Ouvindo…");
  }

  async function enviarFoto() {
    const arquivo = seletorFoto.files && seletorFoto.files[0];
    seletorFoto.value = "";
    if (!arquivo) return;
    let imagem;
    try {
      imagem = await reduzirFoto(arquivo);
    } catch (_) {
      mostrar($("aviso-assistente"), "Não consegui abrir esta foto. Tire outra foto do cupom e tente de novo.");
      return;
    }
    falarComAssistente({ mensagem: $("frase").value.trim(), imagem, mime: "image/jpeg" });
  }

  // ---------- Início ----------

  async function abrirPrincipal(sessao) {
    usuario = sessao.user;
    desenharCabecalho();
    desenharCategorias();
    $("data").value = hojeISO();
    mostrarTela("principal");
    await Promise.all([carregarGastos(), carregarResumo()]);
  }

  function abrirEntrada() {
    usuario = null;
    gastos = [];
    $("senha").value = "";
    mostrarTela("entrada");
  }

  function iniciar() {
    if (!window.supabase || !config.SUPABASE_URL || !config.SUPABASE_CHAVE_PUBLICA) {
      $("carregando").textContent = "Não foi possível carregar o app. Verifique a internet e recarregue a página.";
      return;
    }
    cliente = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_CHAVE_PUBLICA);

    $("form-entrada").addEventListener("submit", entrar);
    $("botao-criar").addEventListener("click", criarConta);
    $("botao-sair").addEventListener("click", sair);
    $("form-gasto").addEventListener("submit", prepararRevisao);
    $("botao-corrigir").addEventListener("click", corrigir);
    $("botao-confirmar").addEventListener("click", confirmar);
    $("form-assistente").addEventListener("submit", enviarFrase);
    $("botao-foto").addEventListener("click", escolherFoto);
    prepararMicrofone();

    let usuarioAtual = null;
    cliente.auth.onAuthStateChange((_evento, sessao) => {
      const id = sessao ? sessao.user.id : null;
      if (id === usuarioAtual) return;
      usuarioAtual = id;
      // Fora do callback, para não travar o cliente do Supabase
      setTimeout(() => (sessao ? abrirPrincipal(sessao) : abrirEntrada()), 0);
    });

    cliente.auth.getSession().then(({ data }) => {
      if (!data.session && usuarioAtual === null) abrirEntrada();
    });
  }

  iniciar();
})();
