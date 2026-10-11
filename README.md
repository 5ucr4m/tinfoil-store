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

## Deploy no Dokploy

1. Crie uma aplicação do tipo Docker Compose apontando para este repositório (ou Dockerfile, com volume em `/data`).
2. Defina `PUBLIC_URL=https://store.seudominio.com` e um `APP_SECRET` fixo (ele criptografa os tokens das integrações; se mudar, é preciso reconectar).
3. Configure o domínio com HTTPS no Traefik, apontando para a porta 3000 do container.
4. No Google Cloud, o URI de redirecionamento passa a ser `https://store.seudominio.com/api/integrations/gdrive/callback`.

## Como a store funciona

| Rota | Para quê |
|---|---|
| `GET /tinfoil` | Índice JSON do Tinfoil (Basic Auth + registro do UID do console) |
| `GET /tinfoil/gdrive` | Mesmo índice, com arquivos do Drive como `gdrive:` (modo direto, experimental) |
| `GET /tinfoil/f/:id/:nome` | Download com `Range`. Proxy (Drive/local) ou 302 para URL assinada (S3 em modo redirect) |

Os uploads vão do navegador direto para o destino: sessão resumable no Drive, multipart pré-assinado no S3, ou chunks de 16 MB para a pasta local.
