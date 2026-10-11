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
  canceledToast: "Transferência de {name} cancelada.",
  queue: {
    title: "Cópias e movimentações",
    summary: "{done} de {total} · {speed}/s · faltam {remaining}",
    calculating: "calculando",
    clearFinished: "Limpar concluídas",
    cancel: "Cancelar transferência",
    mode: { copy: "Cópia", move: "Movimentação" },
    state: { queued: "Na fila", copying: "Copiando", moving: "Movendo", finishing: "Finalizando", done: "Concluída", error: "Falhou", canceled: "Cancelada" },
    progress: "{done} de {total} · {speed}/s · {remaining}",
    doneIn: "Agora em {to}",
  },
};

export default transfers;
