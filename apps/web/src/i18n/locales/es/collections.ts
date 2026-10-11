import type { Messages } from "../..";
import type en from "../en/collections";

const collections: Messages<typeof en> = {
  title: "Colecciones",
  manage: "Gestionar",
  auto: "auto",
  matchedBy: "Entró por las palabras clave: {keywords}",
  filter: {
    label: "Tipo",
    manage: "Colecciones",
    fewer: "Menos",
    moreGenres: { one: "+{count} género", other: "+{count} géneros" },
  },
  modal: {
    intro: "Los juegos entran solos cuando el nombre o la descripción mencionan una de las palabras clave. En el detalle de cada juego puedes agregarlo o quitarlo a mano.",
    newLabel: "Nueva colección",
    newPlaceholder: "Ej.: Favoritos",
    keywordsLabel: "Palabras clave (opcional)",
    keywordsPlaceholder: "separadas por comas",
    create: "Crear",
    created: "Colección {name} creada.",
    nameLabel: "Nombre de la colección",
    games: { one: "{count} juego", other: "{count} juegos" },
    delete: "Eliminar {name}",
    color: "Color",
    noKeywords: "Sin palabras clave: solo entra lo que agregues",
    keywordsOf: "Palabras clave de {name}",
  },
  colors: {
    "285": "Morado",
    "25": "Naranja",
    "355": "Rosa",
    "160": "Verde",
    "210": "Azul",
    "60": "Amarillo",
    "120": "Verde lima",
    "320": "Magenta",
  },
};

export default collections;
