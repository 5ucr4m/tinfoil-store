import type { Messages } from "../..";
import type en from "../en/shell";

const shell: Messages<typeof en> = {
  nav: {
    label: "Principal",
    library: "Biblioteca",
    upload: "Enviar",
    integrations: "Integrações",
    access: "Acesso",
    tinfoil: "Conectar Tinfoil",
    tinfoilShort: "Tinfoil",
    account: "Conta",
  },
  account: "Sua conta",
  signOut: "Sair",
  dock: { writing: "Gravando {count}" },
};

export default shell;
