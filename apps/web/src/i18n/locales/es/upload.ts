import type { Messages } from "../..";
import type en from "../en/upload";

const upload: Messages<typeof en> = {
  title: "Subir",
  meta: "Los archivos van directo de tu navegador al destino elegido, sin pasar por el servidor (excepto en la carpeta del servidor).",
  noTarget: {
    title: "Conecta un destino primero",
    body: "Los archivos van directo de tu navegador a Google Drive, a un bucket S3 o a una carpeta del servidor.",
    action: "Conectar un destino",
  },
  target: {
    label: "Destino",
    manage: "Gestionar integraciones",
    groupLabel: "Destino de la subida",
    free: "{size} libres",
  },
  slot: {
    drop: "Suelta para grabar en {name}",
    drag: "Arrastra los archivos hasta la ranura",
    pick: "o <pick>elige desde tu computadora</pick> · .nsp, .nsz, .xci, .xcz",
  },
  autofix: {
    label: "Corregir nombres automáticamente",
    hint: 'Los archivos sin title ID en el nombre se suben como "Juego [ID][vN]" cuando la identificación es confiable.',
    identifying: { one: "Identificando {count} archivo…", other: "Identificando {count} archivos…" },
  },
  toasts: {
    ignored: {
      one: "{count} archivo ignorado: usa .nsp, .nsz, .xci o .xcz.",
      other: "{count} archivos ignorados: usa .nsp, .nsz, .xci o .xcz.",
    },
    renamed: { one: "{count} nombre corregido antes de subir.", other: "{count} nombres corregidos antes de subir." },
    skipped: {
      one: "{count} archivo ya está en {target} y se omitió.",
      other: "{count} archivos ya están en {target} y se omitieron.",
    },
  },
  queue: {
    title: "Cola",
    summary: "{sent} de {total} · {speed}/s",
    remaining: "faltan {time}",
    calculating: "calculando",
    clearFinished: "Limpiar terminados",
    uploadsAs: "se sube como {name}",
    originalName: "Nombre original: {name}",
    progress: "{sent} de {total} · {speed}/s",
    retry: "reintento {attempt}",
  },
  state: {
    queued: "En cola",
    starting: "Abriendo sesión",
    uploading: "Grabando",
    paused: "En pausa",
    finishing: "Finalizando",
    done: "En la biblioteca",
    error: "Falló",
    canceled: "Cancelado",
  },
  actions: {
    pause: "Pausar",
    resume: "Continuar",
    retry: "Reintentar",
    dismiss: "Quitar de la lista",
    cancel: "Cancelar subida",
  },
  errors: {
    network: "Error de red.",
    status: "Error {status}.",
    driveExpired: "La sesión de subida de Google expiró. Quita el archivo y súbelo de nuevo.",
    driveStatus: "Google Drive respondió {status}.",
    partRejected: "El bucket rechazó la parte {part} ({status}).",
    noEtag: "El bucket no expuso el header ETag. Agrega ETag a ExposeHeaders en la configuración CORS del bucket.",
  },
};

export default upload;
