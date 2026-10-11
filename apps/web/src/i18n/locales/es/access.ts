import type { Messages } from "../..";
import type en from "../en/access";

const access: Messages<typeof en> = {
  title: "Acceso",
  meta: "Quién puede abrir la tienda en Tinfoil y qué consolas ya se conectaron.",
  users: {
    title: "Usuarios de la tienda",
    description: "El login que escribes en Tinfoil. Crea uno para ti y otros para quien quieras dar acceso.",
    removed: "Usuario eliminado. Las consolas que usaban ese login pierden el acceso.",
    revealTitle: "Contraseña de {username}",
    revealNote: "Anótala ahora. No se vuelve a mostrar, pero puedes generar otra.",
    readabilityNote:
      "Los espacios solo están para facilitar la lectura y no forman parte de la contraseña. En la Switch, escríbela toda junta; el botón de copiar ya la copia sin espacios.",
    done: "Ya la anoté",
    username: "Usuario",
    password: "Contraseña",
    lastUsed: "último acceso {when}",
    newPassword: "Nueva contraseña",
    removeLabel: "Eliminar {username}",
    empty: "Sin usuarios, la tienda rechaza cualquier acceso. Crea el primero abajo.",
    placeholder: "nombre de usuario, ej.: switch-sala",
    newUserLabel: "Nombre del nuevo usuario",
    create: "Crear usuario",
  },
  consoles: {
    title: "Consolas",
    description:
      "Tinfoil envía un identificador de la consola (UID) en cada acceso. Aprueba solo las tuyas para bloquear logins filtrados.",
    approvedOnly: "Solo consolas aprobadas",
    toastApprovedOnly: "Ahora solo las consolas aprobadas abren la tienda.",
    toastAnyone: "Cualquier consola con login abre la tienda.",
    empty: "Ninguna consola se ha conectado todavía. Aparece aquí después de su primer acceso desde Tinfoil.",
    namePlaceholder: "Ponle un nombre (ej.: Switch de la sala)",
    nameLabel: "Nombre de la consola",
    approved: "Aprobada",
    notApproved: "No aprobada",
    seen: "vista {when}",
    hits: { one: "{count} acceso", other: "{count} accesos" },
    forget: "Olvidar consola",
  },
  panelPassword: {
    title: "Contraseña del panel",
    description: "Cambiar la contraseña cierra la sesión en todos los navegadores, excepto este.",
    changed: "Contraseña del panel cambiada. Las demás sesiones se cerraron.",
    current: "Contraseña actual",
    next: "Nueva contraseña",
    submit: "Cambiar contraseña",
  },
};

export default access;
