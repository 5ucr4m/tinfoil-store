import type { Messages } from "../..";
import type en from "../en/tinfoil";

const tinfoil: Messages<typeof en> = {
  title: "Conectar Tinfoil",
  meta: "Agrega la tienda una sola vez en la consola. Después, todo lo que entre en la biblioteca aparece en Tinfoil.",
  access: {
    title: "Tu acceso a Tinfoil",
    description:
      "Actívalo para abrir esta tienda en una Switch. En la consola entras con el mismo usuario y contraseña que usas aquí.",
    toggle: "Acceso a Tinfoil",
    off: "Los valores de tu consola aparecen aquí cuando el acceso a Tinfoil esté activado.",
    turnedOn: "Acceso a Tinfoil activado. Agrega la tienda en la consola con los valores de la tarjeta.",
    turnedOff: "Acceso a Tinfoil desactivado. Las consolas que entraban con tu cuenta pierden la tienda.",
    lastUsed: "Una consola abrió la tienda {when}.",
    never: "Ninguna consola abrió la tienda con tu cuenta todavía.",
  },
  console: {
    title: "En la consola",
    step1: "Abre Tinfoil y ve a <b>File Browser</b>.",
    step2: "Pulsa <b>−</b> (menos) para agregar una nueva ubicación.",
    step3: "Completa los campos como en la tarjeta. Para la contraseña, usa la misma con la que entras al panel.",
    step4: "Pulsa <b>X</b> para guardar y vuelve. Los juegos aparecen en <b>New Games</b> y en la propia tienda.",
    httpNote:
      "La tienda está respondiendo por <b>http</b>. Fuera de casa, publícala detrás de HTTPS (el Traefik de Dokploy lo hace) y ajusta la dirección pública abajo.",
  },
  card: {
    title: "Valores para Tinfoil",
    passwordHint: "la misma contraseña con la que entras",
    loopback:
      "La Switch no llega a \"{host}\": esa dirección apunta a la propia consola. Usa la IP de esta computadora en la red (ej.: 192.168.x.x). Abre el panel por esa IP o completa la dirección pública abajo.",
  },
  store: {
    title: "Tienda",
    description: "La dirección que va en el índice y el mensaje que Tinfoil muestra al abrirse.",
    publicUrl: "Dirección pública",
    publicUrlHint:
      "Vacío = detectar por la solicitud (ahora: {url}). Defínela cuando estés detrás de un proxy o en un dominio propio.",
    publicUrlPlaceholder: "https://tienda.tudominio.com",
    welcome: "Mensaje de bienvenida",
    welcomeHint: "Aparece en una ventana emergente cada vez que la tienda carga. Vacío = sin ventana.",
    welcomePlaceholder: "Ej.: ¡Bienvenido de nuevo!",
    save: "Guardar tienda",
    saved: "Configuración de la tienda guardada.",
  },
  direct: {
    title: "Modo directo de Google Drive",
    description:
      "La consola descarga directo desde Drive con tu cuenta de Google, sin pasar por el servidor. Útil cuando estás fuera de casa o en un VPS con poco ancho de banda.",
    experimental: "experimental",
    step1: "En Google Cloud, crea otro ID de cliente OAuth, de tipo <b>App de escritorio</b>, y descarga el JSON.",
    step2: "Guárdalo en la tarjeta SD como <code>/switch/tinfoil/credentials.json</code> e inicia sesión en Google desde Tinfoil.",
    step3:
      "Agrega una segunda tienda con la ruta de abajo. Los archivos de Drive salen como enlaces gdrive:, y los demás siguen pasando por el servidor.",
    note: "El formato gdrive: y la ubicación de credentials.json cambian entre versiones de Tinfoil. Prueba antes con un juego pequeño.",
  },
  titledb: {
    title: "Nombres y portadas",
    description:
      "Vienen de titledb, una base pública con los metadatos de los juegos. La descarga ocupa unos 90 MB y se hace en segundo plano.",
    refreshing: "Actualizando",
    refresh: "Actualizar ahora",
    done: { one: "{total} título · actualizado {when}", other: "{total} títulos · actualizado {when}" },
    running: "Descargando e indexando…",
    failed: "Falló: {error}",
    idle: "Todavía no descargado.",
  },
  fields: { protocol: "Protocol", host: "Host", port: "Port", path: "Path", username: "Username", password: "Password", title: "Title", url: "URL" },
};

export default tinfoil;
