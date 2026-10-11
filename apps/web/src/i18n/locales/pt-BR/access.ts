import type { Messages } from "../..";
import type en from "../en/access";

const access: Messages<typeof en> = {
  title: "Acesso",
  meta: "Quem pode abrir a store no Tinfoil e quais consoles já se conectaram.",
  users: {
    title: "Usuários da store",
    description: "O login que você digita no Tinfoil. Crie um para você e outros para quem você quiser liberar.",
    removed: "Usuário removido. Consoles que usavam esse login perdem o acesso.",
    revealTitle: "Senha de {username}",
    revealNote: "Anote agora. Ela não aparece de novo, mas você pode gerar outra.",
    readabilityNote:
      "Os espaços são só para facilitar a leitura e não fazem parte da senha. No Switch, digite tudo junto; o botão de copiar já copia sem espaços.",
    done: "Já anotei",
    username: "Usuário",
    password: "Senha",
    lastUsed: "último acesso {when}",
    newPassword: "Nova senha",
    removeLabel: "Remover {username}",
    empty: "Sem usuários, a store recusa qualquer acesso. Crie o primeiro abaixo.",
    placeholder: "nome do usuário, ex.: switch-sala",
    newUserLabel: "Nome do novo usuário",
    create: "Criar usuário",
  },
  consoles: {
    title: "Consoles",
    description:
      "O Tinfoil envia um identificador do console (UID) a cada acesso. Aprove só os seus para bloquear logins vazados.",
    approvedOnly: "Só consoles aprovados",
    toastApprovedOnly: "Agora só consoles aprovados abrem a store.",
    toastAnyone: "Qualquer console com login abre a store.",
    empty: "Nenhum console conectou ainda. Ele aparece aqui depois do primeiro acesso pelo Tinfoil.",
    namePlaceholder: "Dar um nome (ex.: Switch da sala)",
    nameLabel: "Nome do console",
    approved: "Aprovado",
    notApproved: "Não aprovado",
    seen: "visto {when}",
    hits: { one: "{count} acesso", other: "{count} acessos" },
    forget: "Esquecer console",
  },
  panelPassword: {
    title: "Senha do painel",
    description: "Trocar a senha desconecta todos os navegadores, menos este.",
    changed: "Senha do painel alterada. Outras sessões foram desconectadas.",
    current: "Senha atual",
    next: "Nova senha",
    submit: "Trocar senha",
  },
};

export default access;
