import type { Messages } from "../..";
import type en from "../en/shell";

const shell: Messages<typeof en> = {
  nav: {
    label: "Principal",
    library: "Biblioteca",
    upload: "Subir",
    integrations: "Integraciones",
    access: "Acceso",
    tinfoil: "Conectar Tinfoil",
    tinfoilShort: "Tinfoil",
    account: "Cuenta",
  },
  account: "Tu cuenta",
  signOut: "Cerrar sesión",
  dock: { writing: "Grabando {count}" },
};

export default shell;
