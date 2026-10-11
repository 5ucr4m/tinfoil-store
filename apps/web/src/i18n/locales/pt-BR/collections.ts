import type { Messages } from "../..";
import type en from "../en/collections";

const collections: Messages<typeof en> = {
  title: "Coleções",
  manage: "Gerenciar",
  auto: "auto",
  matchedBy: "Entrou pelas palavras-chave: {keywords}",
  filter: {
    label: "Tipo",
    manage: "Coleções",
    fewer: "Menos",
    moreGenres: { one: "+{count} gênero", other: "+{count} gêneros" },
  },
  modal: {
    intro: "Jogos entram sozinhos quando o nome ou a descrição citam uma das palavras-chave. No detalhe de cada jogo você inclui ou tira manualmente.",
    newLabel: "Nova coleção",
    newPlaceholder: "Ex.: Favoritos",
    keywordsLabel: "Palavras-chave (opcional)",
    keywordsPlaceholder: "separe por vírgula",
    create: "Criar",
    created: "Coleção {name} criada.",
    nameLabel: "Nome da coleção",
    games: { one: "{count} jogo", other: "{count} jogos" },
    delete: "Apagar {name}",
    color: "Cor",
    noKeywords: "Sem palavras-chave: só entra quem você adicionar",
    keywordsOf: "Palavras-chave de {name}",
  },
  colors: {
    "285": "Roxo",
    "25": "Laranja",
    "355": "Rosa",
    "160": "Verde",
    "210": "Azul",
    "60": "Amarelo",
    "120": "Verde-limão",
    "320": "Magenta",
  },
};

export default collections;
