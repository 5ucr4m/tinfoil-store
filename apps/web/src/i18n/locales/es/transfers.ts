import type { Messages } from "../..";
import type en from "../en/transfers";

const transfers: Messages<typeof en> = {
  done: "{name} ahora está en {to}.",
  moveFailed: "No se pudo mover {name}: {error}",
  copyFailed: "No se pudo copiar {name}: {error}",
  noTargets: "No hay otro destino conectado.",
  queued: "En cola para {to}",
  copying: "Copiando a {to} · {done} de {total}",
  moving: "Moviendo a {to} · {done} de {total}",
  finishing: "Finalizando en {to}",
  canceledToast: "Transferencia de {name} cancelada.",
  queue: {
    title: "Copias y movimientos",
    summary: "{done} de {total} · {speed}/s · faltan {remaining}",
    calculating: "calculando",
    clearFinished: "Limpiar terminadas",
    cancel: "Cancelar transferencia",
    mode: { copy: "Copia", move: "Movimiento" },
    state: { queued: "En cola", copying: "Copiando", moving: "Moviendo", finishing: "Finalizando", done: "Terminada", error: "Falló", canceled: "Cancelada" },
    progress: "{done} de {total} · {speed}/s · {remaining}",
    doneIn: "Ahora en {to}",
  },
};

export default transfers;
