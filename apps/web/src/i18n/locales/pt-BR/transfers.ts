import type { Messages } from "../..";
import type en from "../en/transfers";

const transfers: Messages<typeof en> = {
  done: "{name} agora está em {to}.",
  moveFailed: "Não deu para mover {name}: {error}",
  copyFailed: "Não deu para copiar {name}: {error}",
  noTargets: "Nenhum outro destino conectado.",
  queued: "Na fila para {to}",
  copying: "Copiando para {to} · {done} de {total}",
  moving: "Movendo para {to} · {done} de {total}",
  finishing: "Finalizando em {to}",
};

export default transfers;
