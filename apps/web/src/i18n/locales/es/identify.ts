import type { Messages } from "../..";
import type en from "../en/identify";

const identify: Messages<typeof en> = {
  title: "Identificar",
  meta: "Archivos sin title ID en el nombre. Revisa las sugerencias y renómbralos para que Tinfoil y la biblioteca reconozcan el juego.",
  reanalyze: "Analizar de nuevo",
  confidence: { high: "Alta", medium: "Media", low: "Baja" },
  counts: { high: "<b>{count}</b> alta", medium: "<b>{count}</b> media", low: "<b>{count}</b> baja" },
  source: {
    name: "ya estaba en el nombre",
    cnmt: "leído dentro del archivo",
    ticket: "leído dentro del archivo",
    fuzzy: "por el nombre del archivo",
    none: "sin coincidencia",
  },
  allDone: {
    title: "Todos los archivos están identificados",
    body: "Cada archivo de la biblioteca tiene un title ID en el nombre.",
    back: "Volver a la biblioteca",
  },
  analyzing: "Leyendo cabeceras y comparando con titledb…",
  selection: { clear: "Limpiar selección", selectReady: "Seleccionar todos los listos" },
  rename: "Renombrar {count}",
  renamed: { one: "{count} archivo renombrado.", other: "{count} archivos renombrados." },
  row: {
    select: "Seleccionar {name}",
    pickedByYou: "elegido por ti",
    noMatch: "No hay una coincidencia confiable. Elige el juego manualmente.",
    notAnalyzed: "Aún no analizado.",
    change: "Cambiar",
    choose: "Elegir",
    fileType: "Tipo de archivo",
    base: "Juego base",
    update: "Actualización",
    version: "Versión",
    versionPlaceholder: "p. ej.: 196608",
    versionIs: "= actualización {number}",
    versionHint: "cada actualización suma 65536",
  },
  picker: {
    placeholder: "Buscar en titledb (p. ej.: {example})",
    label: "Buscar un juego",
    searching: "Buscando…",
    empty: "No se encontró nada. Prueba con otras palabras.",
    game: "juego",
    dlc: "DLC",
  },
  done: {
    title: "Renombrados recién",
    undo: "Deshacer",
    restored: "Se restauró el nombre original: {name}",
  },
};

export default identify;
