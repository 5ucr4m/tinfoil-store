import type { Messages } from "../..";
import type en from "../en/tinfoil";

const tinfoil: Messages<typeof en> = {
  title: "Conectar Tinfoil",
  meta: "Agrega la tienda una sola vez en la consola. Después, todo lo que entre en la biblioteca aparece en Tinfoil.",
  console: {
    title: "En la consola",
    step1: "Abre Tinfoil y ve a <b>File Browser</b>.",
    step2: "Pulsa <b>−</b> (menos) para agregar una nueva ubicación.",
    step3: "Completa los campos como en la tarjeta. Para la contraseña, usa la del usuario de la tienda.",
    step4: "Pulsa <b>X</b> para guardar y vuelve. Los juegos aparecen en <b>New Games</b> y en la propia tienda.",
    noUser: "Todavía no tienes un usuario de la tienda. <link>Crea uno en Acceso</link> antes de conectar.",
    httpNote:
      "La tienda está respondiendo por <b>http</b>. Fuera de casa, publícala detrás de HTTPS (el Traefik de Dokploy lo hace) y ajusta la dirección pública abajo.",
  },
  card: {
    title: "Valores para Tinfoil",
    createInAccess: "crea uno en Acceso",
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
  fields: { protocol: "Protocol", host: "Host", port: "Port", path: "Path", username: "Username", title: "Title", url: "URL" },
};

export default tinfoil;
