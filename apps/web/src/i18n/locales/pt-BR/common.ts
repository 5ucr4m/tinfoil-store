import type { Messages } from "../..";
import type en from "../en/common";

const common: Messages<typeof en> = {
  actions: {
    cancel: "Cancelar",
    close: "Fechar",
    copy: "Copiar {label}",
    copyValue: "Copiar valor",
    show: "Mostrar",
    download: "Baixar",
    clear: "Limpar",
  },
  kind: { base: "Jogo", update: "Atualização", dlc: "DLC", unknown: "Sem ID" },
  provider: { gdrive: "Google Drive", s3: "S3 compatível", local: "Pasta no servidor" },
  version: { patch: "v{version} · atualização {number}" },
  time: { never: "nunca" },
  theme: { label: "Tema", light: "Tema claro", system: "Seguir o sistema", dark: "Tema escuro" },
  language: { label: "Idioma" },
  errors: {
    generic: "A requisição falhou ({status}).",
  },
  genres: {
    Action: "Ação",
    Adventure: "Aventura",
    RPG: "RPG",
    "Role-Playing": "RPG",
    Sports: "Esportes",
    Racing: "Corrida",
    Puzzle: "Quebra-cabeça",
    Platformer: "Plataforma",
    Shooter: "Tiro",
    Fighting: "Luta",
    Simulation: "Simulação",
    Strategy: "Estratégia",
    Party: "Party",
    Music: "Música",
    Arcade: "Arcade",
    Education: "Educativo",
    Lifestyle: "Estilo de vida",
    Training: "Treino",
    Fitness: "Fitness",
    "Board Game": "Tabuleiro",
    Communication: "Comunicação",
    Study: "Estudo",
    Utility: "Utilitários",
    Practical: "Utilitários",
    Video: "Vídeo",
    Multiplayer: "Multijogador",
    Other: "Outros",
  },
};

export default common;
