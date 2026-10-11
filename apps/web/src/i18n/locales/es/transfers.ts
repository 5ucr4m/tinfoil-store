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
};

export default transfers;
