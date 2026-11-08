# Loja da Elisa: como ligar o painel e as vendas

O site tem duas partes:

- **Loja** (`index.html`): o cliente vê os produtos com preço, coloca na sacola e finaliza
  informando nome, WhatsApp, forma de receber (feira ou entrega) e pagamento (Pix, cartão ou dinheiro).
  No Pix, aparece na hora o código "copia e cola" e o QR Code com o valor. O pedido fica registrado
  e o cliente envia o resumo para o WhatsApp da Elisa com um toque.
- **Painel da Elisa** (`admin.html`, endereço `.../Revista-El-sia-/admin.html`): login com e-mail e senha.
  Nele a Elisa cadastra produtos tirando foto pelo celular, define preço, preço promocional, selo,
  descrição, oculta o que acabou, acompanha os pedidos e configura WhatsApp e chave Pix.

Enquanto o passo a passo abaixo não for feito, o site funciona em **modo demonstração**
(produtos e preços de exemplo; o que for cadastrado no painel fica só no navegador de quem cadastrou).

Os produtos ficam guardados no **Supabase**, um serviço com plano gratuito
(500 MB de banco e 1 GB de fotos, suficiente para milhares de produtos). Não precisa de cartão de crédito.

## Passo a passo (uns 15 minutos, uma única vez)

1. **Criar a conta**: acesse <https://supabase.com>, clique em *Start your project* e entre com uma conta
   do GitHub ou e-mail.
2. **Criar o projeto**: *New project* → nome `loja-elisa` → crie uma senha do banco (guarde) →
   região **South America (São Paulo)** → *Create new project*. Espere uns 2 minutos.
3. **Criar as tabelas**: no menu da esquerda, *SQL Editor* → *New query*. Abra o arquivo
   [`supabase/setup.sql`](supabase/setup.sql), copie tudo e cole. **Troque `email-da-elisa@exemplo.com`
   pelo e-mail real da Elisa** (seção 5 do arquivo) e clique em *Run*. Deve aparecer "Success".
4. **Criar o login da Elisa**: *Authentication* → *Users* → *Add user* → *Create new user* →
   e-mail da Elisa (o mesmo do passo 3) e uma senha → marque *Auto Confirm User* → *Create user*.
5. **Fechar o cadastro para estranhos**: *Authentication* → *Sign In / Providers* (ou *Settings*) →
   desligue **Allow new users to sign up** → *Save*. Assim só a Elisa tem conta.
6. **Endereço do site** (para o link de "esqueci minha senha"): *Authentication* → *URL Configuration* →
   em *Site URL* coloque `https://snemele-glitch.github.io/Revista-El-sia-/admin.html` → *Save*.
7. **Ligar o site ao banco**: *Project Settings* → *API* (ou *Data API*). Copie **Project URL** e a chave
   **anon public**. No GitHub, abra [`js/config.js`](js/config.js), clique no lápis e cole:

   ```js
   supabaseUrl: "https://xxxxxxxx.supabase.co",
   supabaseAnonKey: "eyJhbGciOi...",
   ```

   Clique em *Commit changes*. Em 1 ou 2 minutos o GitHub Pages atualiza o site.
   **Nunca** cole a chave `service_role` (ela é secreta).
8. **Primeiro acesso da Elisa**: ela abre `https://snemele-glitch.github.io/Revista-El-sia-/admin.html`
   no celular, entra com o e-mail e a senha, vai em **Ajustes** e preenche a chave Pix, depois em
   **Produtos** coloca os preços dos kits que já estão lá e cadastra os novos.

Dica: no celular, abra o painel e use *Adicionar à tela inicial* para ele virar um "aplicativo".

## Segurança, em resumo

- Só o e-mail cadastrado na tabela `admins` consegue alterar produtos, fotos, ajustes e ver pedidos.
- Os clientes só conseguem ver produtos disponíveis e criar pedidos.
- O banco recalcula o preço e o total de cada pedido com os preços cadastrados, então ninguém
  consegue mudar o valor pelo navegador.
- O pagamento não passa pelo site: o Pix cai direto na conta da Elisa, e cartão ou dinheiro são
  recebidos na entrega ou na feira. A Elisa confirma cada pedido pelo WhatsApp.

## Trocar a senha ou o e-mail da Elisa

- Senha: no painel, *Esqueci minha senha* envia um link para o e-mail dela.
- Outro e-mail: rode no SQL Editor `insert into admins (email) values ('novo@email.com');`
  e crie o usuário em *Authentication → Users*.
