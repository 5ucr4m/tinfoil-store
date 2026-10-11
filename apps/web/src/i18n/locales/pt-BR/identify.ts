import type { Messages } from "../..";
import type en from "../en/identify";

const identify: Messages<typeof en> = {
  title: "Identificar",
  meta: "Arquivos sem title ID no nome. Confira as sugestões e renomeie: o Tinfoil e a biblioteca passam a reconhecer o jogo.",
  reanalyze: "Analisar de novo",
  confidence: { high: "Alta", medium: "Média", low: "Baixa" },
  counts: { high: "<b>{count}</b> alta", medium: "<b>{count}</b> média", low: "<b>{count}</b> baixa" },
  source: {
    name: "já estava no nome",
    cnmt: "lido de dentro do arquivo",
    ticket: "lido de dentro do arquivo",
    fuzzy: "pelo nome do arquivo",
    none: "sem correspondência",
  },
  allDone: {
    title: "Todos os arquivos estão identificados",
    body: "Cada arquivo da biblioteca tem um title ID no nome.",
    back: "Voltar para a biblioteca",
  },
  analyzing: "Lendo cabeçalhos e comparando com o titledb…",
  selection: { clear: "Limpar seleção", selectReady: "Selecionar todos prontos" },
  rename: "Renomear {count}",
  renamed: { one: "{count} arquivo renomeado.", other: "{count} arquivos renomeados." },
  row: {
    select: "Selecionar {name}",
    pickedByYou: "escolhido por você",
    noMatch: "Nenhuma correspondência confiável. Escolha o jogo manualmente.",
    notAnalyzed: "Ainda não analisado.",
    change: "Trocar",
    choose: "Escolher",
    fileType: "Tipo do arquivo",
    base: "Jogo base",
    update: "Atualização",
    version: "Versão",
    versionPlaceholder: "ex.: 196608",
    versionIs: "= atualização {number}",
    versionHint: "cada atualização soma 65536",
  },
  picker: {
    placeholder: "Buscar no titledb (ex.: {example})",
    label: "Buscar jogo",
    searching: "Buscando…",
    empty: "Nada encontrado. Tente outras palavras.",
    game: "jogo",
    dlc: "DLC",
  },
  done: {
    title: "Renomeados agora",
    undo: "Desfazer",
    restored: "Nome original de volta: {name}",
  },
};

export default identify;
