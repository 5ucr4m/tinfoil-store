import type { Messages } from "../..";
import type en from "../en/legal";

const legal: Messages<typeof en> = {
  updated: "Atualizado em {date}",
  back: "Voltar ao Cartucho",
  links: { privacy: "Política de privacidade", terms: "Termos de uso" },
  notice:
    "O Cartucho é um projeto privado. Não é um serviço comercial, não tem cadastro aberto e só quem foi convidado pelo dono pode usar.",
  privacy: {
    title: "Política de privacidade",
    about: {
      title: "Quem mantém",
      body: "O Cartucho é um software auto-hospedado que uma pessoa roda no próprio servidor para organizar os backups do Nintendo Switch e servi-los aos próprios consoles pelo Tinfoil. Nesta política, “o dono” é a pessoa que mantém esta instância. Não há empresa por trás e nada é vendido.",
    },
    data: {
      title: "O que fica guardado",
      body: "A senha do painel, como hash com salt. Os usuários do Tinfoil que o dono cria e as senhas deles. As configurações de cada integração de armazenamento (pasta local, S3 ou Google Drive), criptografadas no servidor. Nome, tamanho e local de cada arquivo de jogo, mais os dados dos jogos baixados da lista pública do titledb. De cada console que abre a store: o ID que o Tinfoil envia, a versão do Tinfoil, o último endereço IP e quando foi visto. O log do servidor guarda uma linha por requisição à store, sem senhas.",
    },
    google: {
      title: "Dados de usuário do Google",
      body: "Quando o dono conecta uma conta do Google Drive, o Cartucho pede ao Google o e-mail da conta e acesso ao Google Drive. O e-mail só aparece no painel, para o dono saber qual conta está conectada. O acesso ao Drive é usado apenas para criar a pasta escolhida no painel e para listar, ler, enviar, renomear, mover e apagar os arquivos de jogos dentro dela, quando o dono pede. O Cartucho guarda o refresh token que o Google devolve, criptografado com AES-256-GCM, e nada mais da conta.",
    },
    limitedUse:
      "O uso e a transferência, pelo Cartucho, de informações recebidas das APIs do Google para qualquer outro app seguem a <policy>Política de dados do usuário dos serviços de API do Google</policy>, incluindo os requisitos de uso limitado.",
    use: {
      title: "Como os dados são usados",
      body: "Só para fazer a store funcionar: entrar no painel, mostrar a biblioteca, mover arquivos entre armazenamentos e servi-los aos consoles do dono. Não há anúncios, análise de uso, rastreamento nem criação de perfil. Dados de usuário do Google nunca são usados para treinar modelos de IA ou de aprendizado de máquina.",
    },
    sharing: {
      title: "Compartilhamento",
      body: "Nenhum dado é vendido, alugado ou compartilhado com ninguém. Os arquivos só circulam entre o servidor, o armazenamento que o dono configurou (o próprio Google Drive, bucket S3 ou pasta do servidor) e os consoles que ele autoriza. O painel carrega as fontes do Google Fonts, então o seu navegador acessa o Google ao abrir a página.",
    },
    storage: {
      title: "Onde os dados ficam e por quanto tempo",
      body: "Tudo fica em um banco de dados no servidor do dono. Remover uma integração no painel apaga na hora as configurações dela e o token do Google. Remover um console ou um usuário do Tinfoil apaga o registro dele. O painel guarda no seu navegador o idioma e o tema que você escolheu, e um cookie de sessão mantém você conectado.",
    },
    revoke: {
      title: "Como revogar o acesso ao Google",
      body: "Remova a integração no painel ou revogue o acesso do Cartucho a qualquer momento nas <google>permissões da sua Conta do Google</google>. Qualquer uma das duas corta todo o acesso ao seu Drive.",
    },
    contact: {
      title: "Mudanças e contato",
      body: "Se esta política mudar, a data no topo muda junto. Para tirar dúvidas ou pedir que seus dados sejam apagados, escreva para o dono desta instância em <email>{email}</email>.",
    },
  },
  terms: {
    title: "Termos de uso",
    about: {
      title: "Um projeto privado",
      body: "O Cartucho é um software pessoal que o dono roda para uso próprio. Não é um produto nem um serviço oferecido ao público, não tem cadastro aberto e não tem vínculo, aval ou patrocínio da Nintendo, do Google ou dos desenvolvedores do Tinfoil.",
    },
    access: {
      title: "Acesso",
      body: "Só pessoas convidadas pelo dono podem usar esta instância. Não compartilhe sua senha nem seu usuário do Tinfoil. O dono pode mudar ou remover qualquer acesso a qualquer momento, sem aviso.",
    },
    content: {
      title: "Conteúdo",
      body: "O Cartucho guarda arquivos; ele não os fornece. Quem adiciona um arquivo é responsável por ter o direito de guardá-lo, como backups de jogos que possui. Não use o Cartucho para distribuir conteúdo sobre o qual você não tem direitos.",
    },
    google: {
      title: "Google Drive",
      body: "Ao conectar uma conta do Google Drive, você autoriza o Cartucho a gerenciar os arquivos da pasta escolhida. O uso do Google Drive continua sujeito aos termos do próprio Google. Como o Cartucho trata esses dados está descrito na <privacy>política de privacidade</privacy>.",
    },
    warranty: {
      title: "Sem garantia",
      body: "O Cartucho é oferecido no estado em que se encontra, sem garantias de nenhum tipo. Ele pode sair do ar, perder dados ou parar de funcionar a qualquer momento. Mantenha suas próprias cópias de tudo que importa para você.",
    },
    liability: {
      title: "Responsabilidade",
      body: "Na medida permitida pela lei, o dono não se responsabiliza por perdas ou danos que venham do uso, ou da impossibilidade de uso, desta instância.",
    },
    changes: {
      title: "Mudanças",
      body: "Estes termos podem mudar a qualquer momento; a data no topo mostra a versão mais recente. Continuar usando o Cartucho depois de uma mudança significa aceitá-la. Para tirar dúvidas, escreva para <email>{email}</email>.",
    },
  },
};

export default legal;
