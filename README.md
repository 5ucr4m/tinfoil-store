# Cartucho

Store privada para o Tinfoil, com painel web para gerenciar a biblioteca. Os arquivos ficam no Google Drive, num bucket S3 (AWS, R2, B2, MinIO) ou numa pasta do servidor, e a store junta tudo num índice só.

## Rodar local

```bash
docker compose up -d --build              # só o app, em http://localhost:3080
docker compose --profile s3 up -d --build # app + MinIO para testar o driver S3
```

- A porta do host muda com `HOST_PORT` (padrão 3080).
- `./games` é montada em `/data/games`, então dá para usar como destino "Pasta no servidor".
- MinIO de teste: endpoint `http://minio:9000`, endpoint público `http://localhost:9000`, bucket `switch`, usuário `cartucho`, senha `cartucho-secret`, path-style ligado.

Para começar do zero: `docker compose down -v && rm -rf games/*`.

## Desenvolvimento

```bash
pnpm install
pnpm --filter @cartucho/server dev                            # API em :3000
API_URL=http://localhost:3000 pnpm --filter @cartucho/web dev # painel em :5173
```

## Imagem Docker

O workflow `.github/workflows/docker.yml` publica a imagem no GitHub Container Registry a cada push:

| Tag | Quando |
|---|---|
| `ghcr.io/5ucr4m/tinfoil-store:latest` | push na `main` |
| `ghcr.io/5ucr4m/tinfoil-store:sha-xxxxxxx` | todo build (para fixar versão ou voltar) |
| `ghcr.io/5ucr4m/tinfoil-store:1.2.3` | tag `v1.2.3` |

A imagem é só `linux/amd64` (VPS). No primeiro publish, confira em **GitHub → Packages → tinfoil-store → Package settings** se a visibilidade está como **Public**; senão o Dokploy precisa de login no `ghcr.io`.

## Deploy no Dokploy

1. Crie uma aplicação **Docker Compose** apontando para este repositório, com o arquivo `docker-compose.prod.yml`.
2. Em **Environment**, defina:
   - `PUBLIC_URL=https://store.seudominio.com`
   - `APP_SECRET=` um valor fixo gerado com `openssl rand -hex 32`. Ele criptografa os tokens das integrações e assina os links de download; se mudar, é preciso reconectar as integrações.
   - `GAMES_PATH=/caminho/no/servidor` (opcional) para guardar os jogos da "Pasta no servidor" num disco do host. A pasta precisa ser gravável pelo usuário `1000` do container. Sem essa variável, os jogos ficam no volume `cartucho-games`.
   - `CARTUCHO_TAG=sha-xxxxxxx` (opcional) para fixar uma versão em vez de `latest`.
3. Em **Domains**, adicione o domínio com HTTPS apontando para o serviço `app`, porta `3000`.
4. Para atualizar, use **Redeploy** (puxa a `latest`), ou ligue o webhook de deploy automático do Dokploy.
5. No Google Cloud, o URI de redirecionamento passa a ser `https://store.seudominio.com/api/integrations/gdrive/callback`.

## Como a store funciona

| Rota | Para quê |
|---|---|
| `GET /tinfoil` | Índice JSON do Tinfoil (Basic Auth + registro do UID do console) |
| `GET /tinfoil/gdrive` | Mesmo índice, com arquivos do Drive como `gdrive:` (modo direto, experimental) |
| `GET /tinfoil/f/:id/:nome` | Download com `Range`. Proxy (Drive/local) ou 302 para URL assinada (S3 em modo redirect) |

Os uploads vão do navegador direto para o destino: sessão resumable no Drive, multipart pré-assinado no S3, ou chunks de 16 MB para a pasta local.
