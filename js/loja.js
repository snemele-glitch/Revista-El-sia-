/*
  Camada de dados da loja da Elisa.
  Usa o Supabase quando js/config.js está preenchido; senão, modo demonstração
  com os dados guardados no próprio navegador (localStorage).
*/
(function(){
const CFG = window.ELISA_CONFIG || {};
const temSupabase = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
let sb = null;
if (temSupabase){
  if (window.supabase && window.supabase.createClient){
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  } else {
    console.error("Biblioteca do Supabase não carregou.");
  }
}

const MARCAS = [
  {id:"boticario", nome:"O Boticário"},
  {id:"natura", nome:"Natura"},
  {id:"avon", nome:"Avon"},
  {id:"eudora", nome:"Eudora"},
  {id:"outros", nome:"Outras marcas"}
];

/* produtos de exemplo (modo demonstração) */
const EXEMPLO = [
  {id:"d-avon", slug:"avon", nome:"Kit Avon Care", marca:"Avon", categorias:["avon"], preco:59.9, preco_de:null, selo:"Mais pedido",
   descricao:"Caixa com visor com a loção desodorante corporal Avon Care Leite de Amêndoas 200 ml e dois sabonetes embalados.",
   itens:["Loção Avon Care 200 ml","2 sabonetes embalados","Caixa com visor, celofane e laço"], foto_url:"img/kit-avon-care.jpg", disponivel:true, ordem:1},
  {id:"d-ekos", slug:"ekos", nome:"Ekos Maracujá e Avon Care", marca:"Natura · Avon", categorias:["natura","avon"], preco:119.9, preco_de:139.9, selo:"Combinação",
   descricao:"A caixa de sabonetes Natura Ekos Maracujá junto do kit Avon Care.",
   itens:["Caixa Natura Ekos Maracujá","Kit Avon Care com loção e sabonetes","Laço e cartão"], foto_url:"img/kit-ekos-maracuja.jpg", disponivel:true, ordem:2},
  {id:"d-floral", slug:"floral", nome:"Presente Especial", marca:"Natura · O Boticário", categorias:["natura","boticario"], preco:null, preco_de:null, selo:"Embrulho floral",
   descricao:"Caixa em papel floral com flores secas, laço e cartão. O conteúdo varia conforme o estoque da semana.",
   itens:["Produtos lacrados de fábrica","Flores secas decorativas","Cartão “Presente especial pra você”"], foto_url:"img/presente-laco-vermelho.jpg", disponivel:true, ordem:3},
  {id:"d-nativa", slug:"nativa", nome:"Cesta Nativa SPA", marca:"O Boticário", categorias:["boticario"], preco:149.9, preco_de:null, selo:"Cesta",
   descricao:"Cesta com alça, hidratante O Boticário Nativa SPA, esponja de banho e flores secas.",
   itens:["Hidratante Nativa SPA","Esponja de banho","Cesta com alça, celofane e laço"], foto_url:"img/cesta-nativa-spa.jpg", disponivel:true, ordem:4}
];

/* armazenamento local seguro */
const ls = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
const demo = {
  produtos(){ return ls.get("elisa-demo-produtos", EXEMPLO); },
  salvar(l){ ls.set("elisa-demo-produtos", l); },
  pedidos(){ return ls.get("elisa-demo-pedidos", []); },
  ajustes(){ return ls.get("elisa-demo-ajustes", {}); }
};

function falha(r){ if (r && r.error) throw new Error(r.error.message || "Erro no servidor"); return r ? r.data : null; }
function exigeSb(){ if (!sb) throw new Error("A conexão com o banco de dados não carregou. Verifique a internet e recarregue a página."); }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "x" + Date.now() + Math.random().toString(16).slice(2));

const Loja = {
  modo: temSupabase ? "supabase" : "demo",
  MARCAS,
  cfg: CFG,

  /* ---------- produtos ---------- */
  async produtos(opts){
    const todos = opts && opts.todos;
    if (!temSupabase){
      const l = demo.produtos().slice().sort((a,b) => (a.ordem||0) - (b.ordem||0));
      return todos ? l : l.filter(p => p.disponivel);
    }
    exigeSb();
    let q = sb.from("produtos").select("*").order("ordem", {ascending:true}).order("criado_em", {ascending:false});
    if (!todos) q = q.eq("disponivel", true);
    return falha(await q) || [];
  },
  async salvarProduto(p){
    const dados = Object.assign({}, p);
    if (!temSupabase){
      const l = demo.produtos();
      if (!dados.id) dados.id = "d-" + uid();
      const i = l.findIndex(x => x.id === dados.id);
      if (i >= 0) l[i] = dados; else l.push(dados);
      demo.salvar(l); return dados;
    }
    exigeSb();
    if (!dados.id) delete dados.id;
    delete dados.criado_em;
    const r = await sb.from("produtos").upsert(dados).select().single();
    return falha(r);
  },
  async removerProduto(id){
    if (!temSupabase){ demo.salvar(demo.produtos().filter(p => p.id !== id)); return; }
    exigeSb(); falha(await sb.from("produtos").delete().eq("id", id));
  },
  async enviarFoto(file){
    const blob = await reduzirFoto(file, 1400);
    if (!temSupabase){
      return await new Promise((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = erro; fr.readAsDataURL(blob); });
    }
    exigeSb();
    const caminho = "produtos/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
    falha(await sb.storage.from("fotos").upload(caminho, blob, {contentType:"image/jpeg", cacheControl:"31536000"}));
    return sb.storage.from("fotos").getPublicUrl(caminho).data.publicUrl;
  },

  /* ---------- pedidos ---------- */
  async criarPedido(p){
    const id = uid();
    const codigo = id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
    const reg = {
      id, codigo,
      cliente_nome: p.nome, cliente_telefone: p.telefone,
      entrega: p.entrega, endereco: p.endereco || null,
      pagamento: p.pagamento, observacao: p.observacao || null,
      itens: p.itens.map(i => ({id:i.id, nome:i.nome, preco:i.preco, qtd:i.qtd})),
      total: p.itens.reduce((s,i) => s + i.preco * i.qtd, 0)
    };
    if (!temSupabase){
      const l = demo.pedidos(); l.unshift(Object.assign({criado_em:new Date().toISOString(), status:"novo"}, reg));
      ls.set("elisa-demo-pedidos", l); return reg;
    }
    exigeSb();
    falha(await sb.from("pedidos").insert(reg));
    return reg;
  },
  async pedidos(){
    if (!temSupabase) return demo.pedidos();
    exigeSb();
    return falha(await sb.from("pedidos").select("*").order("criado_em", {ascending:false}).limit(200)) || [];
  },
  async atualizarPedido(id, campos){
    if (!temSupabase){
      const l = demo.pedidos(); const p = l.find(x => x.id === id); if (p) Object.assign(p, campos);
      ls.set("elisa-demo-pedidos", l); return;
    }
    exigeSb(); falha(await sb.from("pedidos").update(campos).eq("id", id));
  },

  /* ---------- ajustes da loja ---------- */
  async ajustes(){
    let a = {};
    try {
      if (!temSupabase) a = demo.ajustes();
      else { exigeSb(); a = falha(await sb.from("ajustes").select("*").eq("id", 1).maybeSingle()) || {}; }
    } catch(e){ console.warn(e); }
    if (!a.whatsapp) a.whatsapp = CFG.whatsapp || "";
    return a;
  },
  async salvarAjustes(a){
    const dados = Object.assign({}, a, {id:1});
    if (!temSupabase){ ls.set("elisa-demo-ajustes", dados); return; }
    exigeSb(); falha(await sb.from("ajustes").upsert(dados));
  },

  /* ---------- login da Elisa ---------- */
  async sessao(){
    if (!temSupabase) return ls.get("elisa-demo-sessao", null);
    exigeSb();
    const r = await sb.auth.getSession();
    return r.data && r.data.session ? {email:r.data.session.user.email} : null;
  },
  async entrar(email, senha){
    if (!temSupabase){
      if (!email || !senha) throw new Error("Informe e-mail e senha.");
      const s = {email}; ls.set("elisa-demo-sessao", s); return s;
    }
    exigeSb();
    const r = await sb.auth.signInWithPassword({email, password:senha});
    if (r.error) throw new Error(r.error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : r.error.message);
    return {email:r.data.user.email};
  },
  async sair(){
    if (!temSupabase){ try { localStorage.removeItem("elisa-demo-sessao"); } catch(e){} return; }
    exigeSb(); await sb.auth.signOut();
  },
  async esqueciSenha(email){
    if (!temSupabase) throw new Error("No modo demonstração qualquer senha funciona.");
    exigeSb();
    const r = await sb.auth.resetPasswordForEmail(email, {redirectTo: location.href.split("#")[0]});
    if (r.error) throw new Error(r.error.message);
  },
  async trocarSenha(nova){
    if (!temSupabase) return;
    exigeSb();
    const r = await sb.auth.updateUser({password:nova});
    if (r.error) throw new Error(r.error.message);
  },
  aoMudarSessao(fn){
    if (sb) sb.auth.onAuthStateChange((evento, s) => fn(evento, s ? {email:s.user.email} : null));
  },

  /* ---------- utilidades ---------- */
  moeda(n){ return Number(n).toLocaleString("pt-BR", {style:"currency", currency:"BRL"}); },
  waUrl(numero, msg){ return "https://api.whatsapp.com/send?phone=" + String(numero || "").replace(/\D/g, "") + "&text=" + encodeURIComponent(msg); },
  ls,
  pix
};

/* Reduz a foto no celular antes de enviar (economiza espaço e deixa o site rápido) */
function reduzirFoto(file, max){
  return new Promise((ok, erro) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? ok(b) : erro(new Error("Não foi possível ler a foto.")), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new Error("Arquivo de imagem inválido.")); };
    img.src = url;
  });
}

/* Pix "copia e cola" (BR Code estático com valor), padrão do Banco Central */
function semAcento(s){ return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .\-]/g, "").trim(); }
function campo(id, v){ v = String(v); return id + String(v.length).padStart(2, "0") + v; }
function crc16(s){
  let c = 0xFFFF;
  for (let i = 0; i < s.length; i++){
    c ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
  }
  return c.toString(16).toUpperCase().padStart(4, "0");
}
function chavePix(tipo, chave){
  chave = String(chave || "").trim();
  if (tipo === "telefone"){ const d = chave.replace(/\D/g, ""); return "+" + (d.startsWith("55") && d.length > 11 ? d : "55" + d); }
  if (tipo === "cpf" || tipo === "cnpj") return chave.replace(/\D/g, "");
  if (tipo === "email") return chave.toLowerCase();
  return chave;
}
function pix(aj, valor, txid){
  if (!aj || !aj.pix_chave) return "";
  const nome = semAcento(aj.pix_nome || "ELISA").slice(0, 25) || "ELISA";
  const cidade = semAcento(aj.pix_cidade || "BELO HORIZONTE").slice(0, 15) || "BRASIL";
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chavePix(aj.pix_tipo, aj.pix_chave));
  let s = campo("00", "01") + campo("26", conta) + campo("52", "0000") + campo("53", "986");
  if (valor > 0) s += campo("54", Number(valor).toFixed(2));
  s += campo("58", "BR") + campo("59", nome) + campo("60", cidade);
  s += campo("62", campo("05", (String(txid || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25)) || "***"));
  s += "6304";
  return s + crc16(s);
}

window.Loja = Loja;
})();
