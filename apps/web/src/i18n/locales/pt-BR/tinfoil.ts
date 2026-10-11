import type { Messages } from "../..";
import type en from "../en/tinfoil";

const tinfoil: Messages<typeof en> = {
  title: "Conectar Tinfoil",
  meta: "Cadastre a store uma vez no console. Depois disso, tudo o que entrar na biblioteca aparece no Tinfoil.",
  console: {
    title: "No console",
    step1: "Abra o Tinfoil e vá em <b>File Browser</b>.",
    step2: "Aperte <b>−</b> (menos) para adicionar um novo local.",
    step3: "Preencha os campos como no cartão ao lado. Para a senha, use a do usuário da store.",
    step4: "Aperte <b>X</b> para salvar e volte. Os jogos aparecem em <b>New Games</b> e na própria store.",
    noUser: "Você ainda não tem usuário da store. <link>Crie um em Acesso</link> antes de conectar.",
    httpNote:
      "A store está respondendo em <b>http</b>. Fora de casa, publique atrás de HTTPS (o Traefik do Dokploy faz isso) e ajuste o endereço público abaixo.",
  },
  card: {
    title: "Valores para o Tinfoil",
    createInAccess: "crie em Acesso",
    loopback:
      "O Switch não alcança \"{host}\": esse endereço aponta para o próprio console. Use o IP deste computador na rede (ex.: 192.168.x.x). Abra o painel por esse IP ou preencha o endereço público abaixo.",
  },
  store: {
    title: "Store",
    description: "O endereço que vai no índice e a mensagem que o Tinfoil mostra ao abrir.",
    publicUrl: "Endereço público",
    publicUrlHint:
      "Vazio = detectar pela requisição (hoje: {url}). Defina quando estiver atrás de proxy ou domínio próprio.",
    publicUrlPlaceholder: "https://store.seudominio.com",
    welcome: "Mensagem de boas-vindas",
    welcomeHint: "Aparece num pop-up toda vez que a store carrega. Vazio = sem pop-up.",
    welcomePlaceholder: "Ex.: Bem-vindo de volta!",
    save: "Salvar store",
    saved: "Configurações da store salvas.",
  },
  direct: {
    title: "Modo direto do Google Drive",
    description:
      "O console baixa direto do Drive com a sua conta Google, sem passar pelo servidor. Bom para quando você está fora de casa ou numa VPS com pouca banda.",
    experimental: "experimental",
    step1: "No Google Cloud, crie mais um ID do cliente OAuth, do tipo <b>App para computador</b>, e baixe o JSON.",
    step2: "Salve no cartão SD como <code>/switch/tinfoil/credentials.json</code> e faça login no Google pelo Tinfoil.",
    step3:
      "Cadastre uma segunda store com o caminho abaixo. Os arquivos do Drive saem como links gdrive:, e os outros continuam passando pelo servidor.",
    note: "O formato gdrive: e o local do credentials.json mudam entre versões do Tinfoil. Teste com um jogo pequeno antes.",
  },
  titledb: {
    title: "Nomes e capas",
    description:
      "Vêm do titledb, uma base pública com os metadados dos jogos. O arquivo tem cerca de 90 MB e é baixado em segundo plano.",
    refreshing: "Atualizando",
    refresh: "Atualizar agora",
    done: { one: "{total} título · atualizado {when}", other: "{total} títulos · atualizado {when}" },
    running: "Baixando e indexando…",
    failed: "Falhou: {error}",
    idle: "Ainda não baixado.",
  },
  fields: { protocol: "Protocol", host: "Host", port: "Port", path: "Path", username: "Username", title: "Title", url: "URL" },
};

export default tinfoil;
