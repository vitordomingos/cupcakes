# 🧁 Cupcakes Gourmet

Aplicação web monolítica (Next.js Pages Router + PostgreSQL) seguindo MVC:

```
db/schema.sql              → Script SQL (tabelas + seed de produtos)
scripts/init-db.js         → Cria o banco e as tabelas automaticamente (roda antes de dev/start)
src/models/                → MODEL: acesso a dados (SQL com `pg`)
src/controllers/           → CONTROLLER: regras de negócio + tratamento de erros HTTP
pages/api/                 → Rotas que apenas delegam aos controllers
src/components/, src/context/, pages/  → VIEW: Vitrine, Carrinho, Checkout, Rastreamento, Admin
__tests__/                 → Jest + RTL (View) e Jest + Supertest (Controller)
```

## Pré-requisitos
- Node.js 18+
- PostgreSQL rodando localmente (porta 5432)

## Configuração
Crie o arquivo `.env.local` na raiz (base: `.env.example`):

```env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=cupcakes
ADMIN_PASSWORD=admin123
```

> O usuário do Postgres precisa ter permissão para criar banco (`CREATEDB`), ou crie o banco `cupcakes` manualmente.

## Executar
```bash
npm install
npm run dev        # cria banco/tabelas se não existirem e sobe em http://localhost:3000
```
Para inicializar só o banco: `npm run db:init`.

## Telas
| Rota | Descrição |
|---|---|
| `/` | Vitrine (US01) — itens sem estoque mostram "Esgotado" |
| `/carrinho` | Carrinho (US02) — subtotal + taxa fixa de entrega (R$ 8,00) |
| `/checkout` | Checkout (US03) — Cartão ou PIX na entrega; pedido salvo como "Recebido" |
| `/pedido` e `/pedido/:id` | Rastreamento (US04) |
| `/admin` | Painel admin (US05) — login em `/admin/login` com `ADMIN_PASSWORD` |
| `/login` | Login do cliente (usuário + senha) |
| `/conta` | Área restrita: histórico de pedidos + "Repetir Pedido" |
| `/recuperar-senha` | Esqueci minha senha: usuário → confirmação do celular cadastrado → nova senha |

> A conta do cliente é criada no primeiro pedido (checkout). Depois disso ele já fica logado.
> Variável opcional `SESSION_SECRET` (recomendada): segredo usado para assinar a sessão do cliente e o token de redefinição de senha.

## API
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/produtos` | Lista produtos |
| POST | `/api/pedidos` | Cria pedido |
| GET | `/api/pedidos` | (admin) Lista pedidos do mais antigo ao mais recente |
| GET | `/api/pedidos/:id` | Consulta pedido |
| PATCH | `/api/pedidos/:id` | (admin) Avança status: Recebido → Em Preparo → Saiu para Entrega → Finalizado |
| POST/DELETE | `/api/admin/login` | Login/logout admin |
| POST/DELETE | `/api/clientes/login` | Login/logout do cliente |
| GET | `/api/clientes/me` | Cliente da sessão (ou `null`) |
| GET | `/api/clientes/pedidos` | (cliente) Histórico de pedidos |
| POST | `/api/clientes/pedidos/:id/repetir` | (cliente) Confere estoque; 409 com `esgotados` se algum item tiver estoque ≤ 0 |
| POST | `/api/clientes/recuperar-senha` | `{ usuario, telefone }` → token de redefinição (10 min, uso único) |
| POST | `/api/clientes/redefinir-senha` | `{ token, nova_senha, confirmacao }` |

## Testes
```bash
npm test
```
Os testes não precisam do banco (Models são mockados).

