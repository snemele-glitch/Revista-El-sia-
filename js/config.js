/*
  Configuração da loja da Elisa.

  1. Crie um projeto gratuito em https://supabase.com e rode o arquivo supabase/setup.sql
     (passo a passo em COMO-CONFIGURAR.md).
  2. Em Project Settings → API, copie "Project URL" e a chave "anon public" e cole abaixo.

  Enquanto os dois campos estiverem vazios, o site funciona em MODO DEMONSTRAÇÃO:
  os produtos de exemplo aparecem, e o que for cadastrado no painel fica salvo
  só no navegador de quem cadastrou.

  A chave "anon public" pode ficar neste arquivo: ela é pública por natureza.
  As regras de segurança do banco (setup.sql) garantem que só a Elisa altera produtos.
  NUNCA cole aqui a chave "service_role".
*/
window.ELISA_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Número usado enquanto a Elisa não salvar outro no painel (com DDI 55 e DDD)
  whatsapp: "5531987276596"
};
