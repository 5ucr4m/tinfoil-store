import type { Messages } from "../..";
import type en from "../en/upload";

const upload: Messages<typeof en> = {
  title: "Enviar",
  meta: "Os arquivos vão direto do navegador para o destino escolhido, sem passar pelo servidor (exceto na pasta local).",
  noTarget: {
    title: "Conecte um destino primeiro",
    body: "Os arquivos vão direto do seu navegador para o Google Drive, para um bucket S3 ou para uma pasta do servidor.",
    action: "Conectar um destino",
  },
  target: {
    label: "Destino",
    manage: "Gerenciar integrações",
    groupLabel: "Destino do envio",
    free: "{size} livres",
  },
  slot: {
    drop: "Solte para gravar em {name}",
    drag: "Arraste os arquivos até o slot",
    pick: "ou <pick>escolha no computador</pick> · .nsp, .nsz, .xci, .xcz",
  },
  autofix: {
    label: "Corrigir nomes automaticamente",
    hint: 'Arquivos sem title ID no nome sobem como "Jogo [ID][vN]" quando a identificação é confiável.',
    identifying: { one: "Identificando {count} arquivo…", other: "Identificando {count} arquivos…" },
  },
  toasts: {
    ignored: {
      one: "{count} arquivo ignorado: use .nsp, .nsz, .xci ou .xcz.",
      other: "{count} arquivos ignorados: use .nsp, .nsz, .xci ou .xcz.",
    },
    renamed: { one: "{count} nome corrigido antes do envio.", other: "{count} nomes corrigidos antes do envio." },
    skipped: {
      one: "{count} arquivo já está em {target} e foi pulado.",
      other: "{count} arquivos já estão em {target} e foram pulados.",
    },
  },
  queue: {
    title: "Fila",
    summary: "{sent} de {total} · {speed}/s",
    remaining: "faltam {time}",
    calculating: "calculando",
    clearFinished: "Limpar concluídos",
    uploadsAs: "sobe como {name}",
    originalName: "Nome original: {name}",
    progress: "{sent} de {total} · {speed}/s",
    retry: "nova tentativa {attempt}",
  },
  state: {
    queued: "Na fila",
    starting: "Abrindo sessão",
    uploading: "Gravando",
    paused: "Pausado",
    finishing: "Finalizando",
    done: "Na biblioteca",
    error: "Falhou",
    canceled: "Cancelado",
  },
  actions: {
    pause: "Pausar",
    resume: "Continuar",
    retry: "Tentar de novo",
    dismiss: "Tirar da lista",
    cancel: "Cancelar envio",
  },
  errors: {
    network: "Falha de rede.",
    status: "Erro {status}.",
    driveExpired: "A sessão de envio do Google expirou. Remova o arquivo e envie de novo.",
    driveStatus: "O Google Drive respondeu {status}.",
    partRejected: "O bucket recusou a parte {part} ({status}).",
    noEtag: "O bucket não expôs o header ETag. Libere ETag em ExposeHeaders na configuração de CORS do bucket.",
  },
};

export default upload;
