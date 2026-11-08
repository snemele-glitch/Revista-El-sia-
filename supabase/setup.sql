-- =====================================================================
-- Loja da Elisa: banco de dados no Supabase (plano gratuito)
-- Cole tudo no SQL Editor do Supabase e clique em "Run".
-- Antes, troque o e-mail na seção 5 pelo e-mail da Elisa.
-- Pode rodar de novo sem problema: nada é duplicado.
-- =====================================================================

-- 1. Tabelas -----------------------------------------------------------
create table if not exists public.produtos (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique,
  nome        text not null check (char_length(nome) between 2 and 80),
  marca       text,
  categorias  text[] not null default '{}',
  preco       numeric(10,2) check (preco is null or preco > 0),
  preco_de    numeric(10,2),
  selo        text,
  descricao   text,
  itens       text[] not null default '{}',
  foto_url    text,
  disponivel  boolean not null default true,
  ordem       int not null default 0,
  criado_em   timestamptz not null default now()
);

create table if not exists public.pedidos (
  id                uuid primary key default gen_random_uuid(),
  codigo            text,
  criado_em         timestamptz not null default now(),
  cliente_nome      text not null check (char_length(cliente_nome) between 2 and 80),
  cliente_telefone  text not null check (char_length(cliente_telefone) between 8 and 20),
  entrega           text check (char_length(entrega) <= 80),
  endereco          text check (char_length(endereco) <= 200),
  pagamento         text check (char_length(pagamento) <= 40),
  observacao        text check (char_length(observacao) <= 300),
  itens             jsonb not null,
  total             numeric(10,2),
  status            text not null default 'novo'
);

create table if not exists public.ajustes (
  id          int primary key default 1 check (id = 1),
  whatsapp    text,
  pix_tipo    text,
  pix_chave   text,
  pix_nome    text,
  pix_cidade  text
);

-- Quem pode entrar no painel
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 2. Pedido: o banco confere preços e total (o cliente não consegue alterar) -
create or replace function public.pedido_confere()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  novos jsonb := '[]'::jsonb;
  it jsonb;
  p record;
  q int;
  tot numeric := 0;
begin
  if jsonb_typeof(new.itens) <> 'array' or jsonb_array_length(new.itens) = 0 or jsonb_array_length(new.itens) > 50 then
    raise exception 'Pedido sem itens';
  end if;
  for it in select * from jsonb_array_elements(new.itens) loop
    select id, nome, preco into p from public.produtos
      where id = (it ->> 'id')::uuid and disponivel and preco is not null;
    if not found then
      raise exception 'Produto indisponível';
    end if;
    q := greatest(1, least(20, coalesce((it ->> 'qtd')::int, 1)));
    novos := novos || jsonb_build_object('id', p.id, 'nome', p.nome, 'preco', p.preco, 'qtd', q);
    tot := tot + p.preco * q;
  end loop;
  new.itens := novos;
  new.total := tot;
  new.status := 'novo';
  new.criado_em := now();
  return new;
end $$;

drop trigger if exists pedido_confere on public.pedidos;
create trigger pedido_confere before insert on public.pedidos
  for each row execute function public.pedido_confere();

-- 3. Regras de acesso (RLS) --------------------------------------------
-- Permissões básicas (funciona com "Expor automaticamente novas tabelas" ligado ou desligado;
-- quem decide o que cada um vê são as políticas RLS logo abaixo)
grant usage on schema public to anon, authenticated;
grant select on public.produtos to anon, authenticated;
grant insert, update, delete on public.produtos to authenticated;
grant insert on public.pedidos to anon, authenticated;
grant select, update, delete on public.pedidos to authenticated;
grant select on public.ajustes to anon, authenticated;
grant insert, update, delete on public.ajustes to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.produtos enable row level security;
alter table public.pedidos  enable row level security;
alter table public.ajustes  enable row level security;
alter table public.admins   enable row level security;

drop policy if exists "vitrine publica"       on public.produtos;
drop policy if exists "elisa edita produtos"  on public.produtos;
create policy "vitrine publica"      on public.produtos for select using (disponivel or public.is_admin());
create policy "elisa edita produtos" on public.produtos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "cliente faz pedido"   on public.pedidos;
drop policy if exists "elisa ve pedidos"     on public.pedidos;
drop policy if exists "elisa atualiza pedidos" on public.pedidos;
drop policy if exists "elisa apaga pedidos"  on public.pedidos;
create policy "cliente faz pedido"     on public.pedidos for insert to anon, authenticated with check (true);
create policy "elisa ve pedidos"       on public.pedidos for select to authenticated using (public.is_admin());
create policy "elisa atualiza pedidos" on public.pedidos for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "elisa apaga pedidos"    on public.pedidos for delete to authenticated using (public.is_admin());

drop policy if exists "ajustes publicos"     on public.ajustes;
drop policy if exists "elisa edita ajustes"  on public.ajustes;
create policy "ajustes publicos"    on public.ajustes for select using (true);
create policy "elisa edita ajustes" on public.ajustes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- (admins: sem política = ninguém lê pelo site; só pelo painel do Supabase)

-- 4. Fotos (Storage) ----------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "fotos publicas"       on storage.objects;
drop policy if exists "elisa envia fotos"    on storage.objects;
drop policy if exists "elisa altera fotos"   on storage.objects;
drop policy if exists "elisa apaga fotos"    on storage.objects;
create policy "fotos publicas"     on storage.objects for select using (bucket_id = 'fotos');
create policy "elisa envia fotos"  on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and public.is_admin());
create policy "elisa altera fotos" on storage.objects for update to authenticated using (bucket_id = 'fotos' and public.is_admin());
create policy "elisa apaga fotos"  on storage.objects for delete to authenticated using (bucket_id = 'fotos' and public.is_admin());

-- 5. E-mail da Elisa (TROQUE AQUI) --------------------------------------
insert into public.admins (email) values ('email-da-elisa@exemplo.com')
on conflict do nothing;

-- 6. Dados iniciais -----------------------------------------------------
insert into public.ajustes (id, whatsapp) values (1, '5531987276596')
on conflict (id) do nothing;

-- Os 4 kits que já estavam no site (sem preço: a Elisa preenche no painel)
insert into public.produtos (slug, nome, marca, categorias, selo, descricao, itens, foto_url, ordem) values
('avon',   'Kit Avon Care', 'Avon', '{avon}', 'Mais pedido',
  'Caixa com visor com a loção desodorante corporal Avon Care Leite de Amêndoas 200 ml e dois sabonetes embalados.',
  '{"Loção Avon Care 200 ml","2 sabonetes embalados","Caixa com visor, celofane e laço"}', 'img/kit-avon-care.jpg', 1),
('ekos',   'Ekos Maracujá e Avon Care', 'Natura · Avon', '{natura,avon}', 'Combinação',
  'A caixa de sabonetes Natura Ekos Maracujá junto do kit Avon Care.',
  '{"Caixa Natura Ekos Maracujá","Kit Avon Care com loção e sabonetes","Laço e cartão"}', 'img/kit-ekos-maracuja.jpg', 2),
('floral', 'Presente Especial', 'Natura · O Boticário', '{natura,boticario}', 'Embrulho floral',
  'Caixa em papel floral com flores secas, laço e cartão. O conteúdo varia conforme o estoque da semana.',
  '{"Produtos lacrados de fábrica","Flores secas decorativas","Cartão “Presente especial pra você”"}', 'img/presente-laco-vermelho.jpg', 3),
('nativa', 'Cesta Nativa SPA', 'O Boticário', '{boticario}', 'Cesta',
  'Cesta com alça, hidratante O Boticário Nativa SPA, esponja de banho e flores secas.',
  '{"Hidratante Nativa SPA","Esponja de banho","Cesta com alça, celofane e laço"}', 'img/cesta-nativa-spa.jpg', 4)
on conflict (slug) do nothing;
