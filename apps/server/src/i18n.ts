import type { Context } from "hono";

/**
 * Server-side messages: API errors for the panel and errors shown on the console by
 * Tinfoil. English is the source; the other locales are typed against it, so a
 * missing key fails `tsc`. Strings use `{name}` placeholders.
 */

export type Locale = "en" | "pt-BR" | "es";
export const DEFAULT_LOCALE: Locale = "en";

const en = {
  errors: {
    routeNotFound: "Route not found.",
    storePathNotFound: "Store path not found. Use /tinfoil.",
    sessionExpired: "Your session expired. Sign in again.",
    alreadySetUp: "The panel is already set up.",
    wrongCredentials: "Wrong user or password.",
    adminOnly: "Only an admin can do that.",
    cannotChangeOwnRole: "You can't change your own role. Ask another admin.",
    cannotRemoveSelf: "You can't remove your own account.",
    lastAdmin: "This is the only admin. Promote someone else first.",
    currentPasswordMismatch: "The current password doesn't match.",
    tooManyAttempts: "Too many attempts. Try again in {seconds}s.",
    passwordTooShort: "Use at least 8 characters.",
    invalidData: "Invalid data.",

    integrationNotFound: "Integration not found.",
    integrationTypeInvalid: "Invalid integration type.",
    unknownIntegrationType: "Unknown integration type: {type}",
    folderRequired: "Enter the folder.",
    bucketRequired: "Enter the bucket.",
    accessKeyRequired: "Enter the access key.",
    secretKeyRequired: "Enter the secret key.",
    clientIdRequired: "Enter the Client ID.",
    clientSecretRequired: "Enter the Client Secret.",
    googleDenied: "Google denied access ({reason}).",
    googleNoRefreshToken: "Google didn't return a refresh token.",
    googleNotConnected: "Google account not connected.",
    googleRefreshFailed: "Couldn't renew access to Google Drive.",
    googleUploadRejected: "Google Drive rejected the upload: {detail}",
    driveFileMissingAfterUpload: "File not found on Drive after the upload.",
    invalidPath: "Invalid path.",
    uploadIncomplete: "Incomplete upload: {received} of {expected} bytes.",
    s3EmptyObject: "The object has no content.",
    s3MissingEtag: "The bucket didn't return an ETag for part {part}.",
    s3NoParts: "Empty part list.",

    userTooShort: "Use at least 2 characters.",
    userTooLong: "Use at most 32 characters.",
    userInvalidChars: "Use only letters, numbers, dot, hyphen or underscore.",
    userExists: "A user with that name already exists.",
    userNotFound: "User not found.",
    publicUrlInvalid: "Use a URL starting with http(s)://",

    uploadInvalid: "Invalid upload data.",
    uploadFileType: "Upload .nsp, .nsz, .xci or .xcz files.",
    uploadNoDestination: "Choose a connected destination.",
    destinationPendingUpload: "Finish connecting this destination before uploading.",
    destinationPendingMove: "Finish connecting this destination before moving files to it.",
    uploadNotFound: "Upload not found.",
    emptyChunk: "Empty chunk.",

    fileNotFound: "File not found.",
    fileDestinationRemoved: "The file's destination was removed.",
    titleIdInvalid: "Invalid title ID.",
    fileNameRequired: "Enter the file name.",
    updateVersionRequired: "Enter the update version.",
    nothingToUndo: "Nothing to undo.",
    chooseDestination: "Choose the destination.",
    destinationNotFound: "Destination not found.",
    providerDeleteFailed: "Couldn't delete it on the provider: {detail}",

    collectionNameRequired: "Give the collection a name.",
    collectionNameTooLong: "Use at most 40 characters for the collection name.",
    keywordTooLong: "Each keyword can have at most 60 characters.",
    tooManyKeywords: "Use at most 30 keywords.",
    welcomeTooLong: "Keep the welcome message under 500 characters.",
    collectionExists: "A collection with that name already exists.",

    alreadyInDestination: "The file is already in that destination.",
    replicaExists: "A copy of this file already exists in {name}.",
    removedDuringCopy: "The file or destination was removed during the copy.",
    diskOutOfOrder: "Out-of-order write on disk.",
    driveStatus: "Google Drive responded {status}.",
    copyIncomplete: "Incomplete copy: {copied} of {total} bytes.",
    sizeMismatch: "The size at the destination doesn't match. The source was kept.",
    transferNotRunning: "This transfer has already finished.",

    titledbStatus: "titledb responded {status}.",
  },
  store: {
    badCredentials: "Wrong store username or password.",
    noTinfoilUsers: "No account has Tinfoil access turned on. Turn it on in the panel, under Connect Tinfoil.",
    tooManyAttempts: "Too many attempts with a wrong password. Try again in {seconds}s.",
    consoleNotApproved: "This console hasn't been approved yet.",
    consoleNotApprovedUid: "This console hasn't been approved yet. Approve console {uid}… in the panel, under Access.",
    consoleAskAdmin: "This console hasn't been approved yet. Ask an admin to approve it in the panel.",
    consoleAskAdminUid: "This console hasn't been approved yet. Ask an admin to approve console {uid}… in the panel.",
    imageLinkInvalid: "Invalid or expired image link.",
    downloadLinkInvalid: "Invalid or expired download link. Open the store again in Tinfoil.",
    readFailed: "Couldn't read the file. {detail}",
    destinationRemoved: "Destination removed.",
    updateSuffix: "(update)",
  },
  names: {
    local: "Server folder",
    s3: "S3 bucket",
    gdrive: "Google Drive",
  },
};

type Messages<T = typeof en> = { [K in keyof T]: T[K] extends string ? string : Messages<T[K]> };

const ptBR: Messages = {
  errors: {
    routeNotFound: "Rota não encontrada.",
    storePathNotFound: "Caminho da store não encontrado. Use /tinfoil.",
    sessionExpired: "Sua sessão expirou. Entre novamente.",
    alreadySetUp: "O painel já está configurado.",
    wrongCredentials: "Usuário ou senha incorretos.",
    adminOnly: "Só um administrador pode fazer isso.",
    cannotChangeOwnRole: "Você não pode mudar seu próprio papel. Peça a outro administrador.",
    cannotRemoveSelf: "Você não pode remover a sua própria conta.",
    lastAdmin: "Este é o único administrador. Promova outra pessoa primeiro.",
    currentPasswordMismatch: "A senha atual não confere.",
    tooManyAttempts: "Muitas tentativas. Tente de novo em {seconds}s.",
    passwordTooShort: "Use pelo menos 8 caracteres.",
    invalidData: "Dados inválidos.",

    integrationNotFound: "Integração não encontrada.",
    integrationTypeInvalid: "Tipo de integração inválido.",
    unknownIntegrationType: "Tipo de integração desconhecido: {type}",
    folderRequired: "Informe a pasta.",
    bucketRequired: "Informe o bucket.",
    accessKeyRequired: "Informe a access key.",
    secretKeyRequired: "Informe a secret key.",
    clientIdRequired: "Informe o Client ID.",
    clientSecretRequired: "Informe o Client Secret.",
    googleDenied: "O Google recusou o acesso ({reason}).",
    googleNoRefreshToken: "O Google não devolveu um refresh token.",
    googleNotConnected: "Conta Google não conectada.",
    googleRefreshFailed: "Falha ao renovar o acesso ao Google Drive.",
    googleUploadRejected: "O Google Drive recusou o upload: {detail}",
    driveFileMissingAfterUpload: "Arquivo não encontrado no Drive após o upload.",
    invalidPath: "Caminho inválido.",
    uploadIncomplete: "Upload incompleto: {received} de {expected} bytes.",
    s3EmptyObject: "O objeto está sem conteúdo.",
    s3MissingEtag: "O bucket não devolveu ETag da parte {part}.",
    s3NoParts: "Lista de partes vazia.",

    userTooShort: "Use pelo menos 2 caracteres.",
    userTooLong: "Use no máximo 32 caracteres.",
    userInvalidChars: "Use só letras, números, ponto, hífen ou sublinhado.",
    userExists: "Já existe um usuário com esse nome.",
    userNotFound: "Usuário não encontrado.",
    publicUrlInvalid: "Use uma URL começando com http(s)://",

    uploadInvalid: "Dados de upload inválidos.",
    uploadFileType: "Envie arquivos .nsp, .nsz, .xci ou .xcz.",
    uploadNoDestination: "Escolha um destino conectado.",
    destinationPendingUpload: "Termine de conectar esse destino antes de enviar.",
    destinationPendingMove: "Termine de conectar esse destino antes de mover arquivos para ele.",
    uploadNotFound: "Upload não encontrado.",
    emptyChunk: "Chunk vazio.",

    fileNotFound: "Arquivo não encontrado.",
    fileDestinationRemoved: "O destino do arquivo foi removido.",
    titleIdInvalid: "Title ID inválido.",
    fileNameRequired: "Informe o nome do arquivo.",
    updateVersionRequired: "Informe a versão da atualização.",
    nothingToUndo: "Nada para desfazer.",
    chooseDestination: "Escolha o destino.",
    destinationNotFound: "Destino não encontrado.",
    providerDeleteFailed: "Não foi possível apagar no provider: {detail}",

    collectionNameRequired: "Dê um nome à coleção.",
    collectionNameTooLong: "Use no máximo 40 caracteres no nome da coleção.",
    keywordTooLong: "Cada palavra-chave pode ter no máximo 60 caracteres.",
    tooManyKeywords: "Use no máximo 30 palavras-chave.",
    welcomeTooLong: "A mensagem de boas-vindas deve ter menos de 500 caracteres.",
    collectionExists: "Já existe uma coleção com esse nome.",

    alreadyInDestination: "O arquivo já está nesse destino.",
    replicaExists: "Já existe uma cópia desse arquivo em {name}.",
    removedDuringCopy: "Arquivo ou destino removido durante a cópia.",
    diskOutOfOrder: "Escrita fora de ordem no disco.",
    driveStatus: "O Google Drive respondeu {status}.",
    copyIncomplete: "Cópia incompleta: {copied} de {total} bytes.",
    sizeMismatch: "O tamanho no destino não confere. A origem foi mantida.",
    transferNotRunning: "Essa transferência já terminou.",

    titledbStatus: "O titledb respondeu {status}.",
  },
  store: {
    badCredentials: "Usuário ou senha da store incorretos.",
    noTinfoilUsers: "Nenhuma conta tem o acesso ao Tinfoil ligado. Ligue no painel, em Conectar Tinfoil.",
    tooManyAttempts: "Muitas tentativas com senha errada. Tente de novo em {seconds}s.",
    consoleNotApproved: "Este console ainda não foi aprovado.",
    consoleNotApprovedUid: "Este console ainda não foi aprovado. Aprove o console {uid}… no painel, em Acesso.",
    consoleAskAdmin: "Este console ainda não foi aprovado. Peça a um administrador para aprovar no painel.",
    consoleAskAdminUid: "Este console ainda não foi aprovado. Peça a um administrador para aprovar o console {uid}… no painel.",
    imageLinkInvalid: "Link de imagem inválido ou expirado.",
    downloadLinkInvalid: "Link de download inválido ou expirado. Abra a store de novo no Tinfoil.",
    readFailed: "Falha ao ler o arquivo. {detail}",
    destinationRemoved: "Destino removido.",
    updateSuffix: "(atualização)",
  },
  names: {
    local: "Pasta no servidor",
    s3: "Bucket S3",
    gdrive: "Google Drive",
  },
};

const es: Messages = {
  errors: {
    routeNotFound: "Ruta no encontrada.",
    storePathNotFound: "Ruta de la tienda no encontrada. Usa /tinfoil.",
    sessionExpired: "Tu sesión expiró. Inicia sesión de nuevo.",
    alreadySetUp: "El panel ya está configurado.",
    wrongCredentials: "Usuario o contraseña incorrectos.",
    adminOnly: "Solo un administrador puede hacer eso.",
    cannotChangeOwnRole: "No puedes cambiar tu propio rol. Pídeselo a otro administrador.",
    cannotRemoveSelf: "No puedes eliminar tu propia cuenta.",
    lastAdmin: "Es el único administrador. Primero promueve a otra persona.",
    currentPasswordMismatch: "La contraseña actual no coincide.",
    tooManyAttempts: "Demasiados intentos. Vuelve a intentarlo en {seconds}s.",
    passwordTooShort: "Usa al menos 8 caracteres.",
    invalidData: "Datos no válidos.",

    integrationNotFound: "Integración no encontrada.",
    integrationTypeInvalid: "Tipo de integración no válido.",
    unknownIntegrationType: "Tipo de integración desconocido: {type}",
    folderRequired: "Indica la carpeta.",
    bucketRequired: "Indica el bucket.",
    accessKeyRequired: "Indica la access key.",
    secretKeyRequired: "Indica la secret key.",
    clientIdRequired: "Indica el Client ID.",
    clientSecretRequired: "Indica el Client Secret.",
    googleDenied: "Google denegó el acceso ({reason}).",
    googleNoRefreshToken: "Google no devolvió un refresh token.",
    googleNotConnected: "Cuenta de Google no conectada.",
    googleRefreshFailed: "No se pudo renovar el acceso a Google Drive.",
    googleUploadRejected: "Google Drive rechazó la subida: {detail}",
    driveFileMissingAfterUpload: "Archivo no encontrado en Drive después de la subida.",
    invalidPath: "Ruta no válida.",
    uploadIncomplete: "Subida incompleta: {received} de {expected} bytes.",
    s3EmptyObject: "El objeto no tiene contenido.",
    s3MissingEtag: "El bucket no devolvió el ETag de la parte {part}.",
    s3NoParts: "Lista de partes vacía.",

    userTooShort: "Usa al menos 2 caracteres.",
    userTooLong: "Usa como máximo 32 caracteres.",
    userInvalidChars: "Usa solo letras, números, punto, guion o guion bajo.",
    userExists: "Ya existe un usuario con ese nombre.",
    userNotFound: "Usuario no encontrado.",
    publicUrlInvalid: "Usa una URL que empiece por http(s)://",

    uploadInvalid: "Datos de subida no válidos.",
    uploadFileType: "Sube archivos .nsp, .nsz, .xci o .xcz.",
    uploadNoDestination: "Elige un destino conectado.",
    destinationPendingUpload: "Termina de conectar este destino antes de subir.",
    destinationPendingMove: "Termina de conectar este destino antes de mover archivos a él.",
    uploadNotFound: "Subida no encontrada.",
    emptyChunk: "Fragmento vacío.",

    fileNotFound: "Archivo no encontrado.",
    fileDestinationRemoved: "Se eliminó el destino del archivo.",
    titleIdInvalid: "Title ID no válido.",
    fileNameRequired: "Indica el nombre del archivo.",
    updateVersionRequired: "Indica la versión de la actualización.",
    nothingToUndo: "No hay nada que deshacer.",
    chooseDestination: "Elige el destino.",
    destinationNotFound: "Destino no encontrado.",
    providerDeleteFailed: "No se pudo eliminar en el proveedor: {detail}",

    collectionNameRequired: "Ponle un nombre a la colección.",
    collectionNameTooLong: "Usa como máximo 40 caracteres en el nombre de la colección.",
    keywordTooLong: "Cada palabra clave puede tener como máximo 60 caracteres.",
    tooManyKeywords: "Usa como máximo 30 palabras clave.",
    welcomeTooLong: "El mensaje de bienvenida debe tener menos de 500 caracteres.",
    collectionExists: "Ya existe una colección con ese nombre.",

    alreadyInDestination: "El archivo ya está en ese destino.",
    replicaExists: "Ya existe una copia de este archivo en {name}.",
    removedDuringCopy: "Se eliminó el archivo o el destino durante la copia.",
    diskOutOfOrder: "Escritura fuera de orden en el disco.",
    driveStatus: "Google Drive respondió {status}.",
    copyIncomplete: "Copia incompleta: {copied} de {total} bytes.",
    sizeMismatch: "El tamaño en el destino no coincide. Se conservó el original.",
    transferNotRunning: "Esta transferencia ya terminó.",

    titledbStatus: "titledb respondió {status}.",
  },
  store: {
    badCredentials: "Usuario o contraseña de la tienda incorrectos.",
    noTinfoilUsers: "Ninguna cuenta tiene el acceso a Tinfoil activado. Actívalo en el panel, en Conectar Tinfoil.",
    tooManyAttempts: "Demasiados intentos con contraseña incorrecta. Vuelve a intentarlo en {seconds}s.",
    consoleNotApproved: "Esta consola aún no ha sido aprobada.",
    consoleNotApprovedUid: "Esta consola aún no ha sido aprobada. Aprueba la consola {uid}… en el panel, en Acceso.",
    consoleAskAdmin: "Esta consola aún no ha sido aprobada. Pídele a un administrador que la apruebe en el panel.",
    consoleAskAdminUid: "Esta consola aún no ha sido aprobada. Pídele a un administrador que apruebe la consola {uid}… en el panel.",
    imageLinkInvalid: "Enlace de imagen no válido o caducado.",
    downloadLinkInvalid: "Enlace de descarga no válido o caducado. Abre la tienda de nuevo en Tinfoil.",
    readFailed: "No se pudo leer el archivo. {detail}",
    destinationRemoved: "Destino eliminado.",
    updateSuffix: "(actualización)",
  },
  names: {
    local: "Carpeta del servidor",
    s3: "Bucket S3",
    gdrive: "Google Drive",
  },
};

const dictionaries: Record<Locale, Messages> = { en, "pt-BR": ptBR, es };

type Leaf<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaf<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaf<typeof en>;
export type Params = Record<string, string | number>;

function lookup(locale: Locale, key: string): string | undefined {
  let node: unknown = dictionaries[locale];
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === "string" ? node : undefined;
}

export const isMessageKey = (key: string): key is MessageKey => lookup(DEFAULT_LOCALE, key) !== undefined;

export function tr(locale: Locale, key: MessageKey, params?: Params): string {
  const text = lookup(locale, key) ?? lookup(DEFAULT_LOCALE, key) ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m)) : text;
}

/** Translates `text` when it is a message key (e.g. a zod issue message), otherwise returns it as is. */
/** Translates a message key; anything else (e.g. zod's built-in English text) becomes "invalid data". */
export const trMaybe = (locale: Locale, text: string) => tr(locale, isMessageKey(text) ? text : "errors.invalidData");

function normalize(value: string | undefined | null): Locale | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith("pt") || v.startsWith("portug")) return "pt-BR";
  if (v.startsWith("es") || v.startsWith("span")) return "es";
  if (v.startsWith("en")) return "en";
  return null;
}

/**
 * Request language: the panel's explicit header, then Tinfoil's `Language` header,
 * then Accept-Language, then English.
 */
export function localeOf(c: Context): Locale {
  const explicit = c.req.header("x-cartucho-locale");
  if (explicit === "en" || explicit === "pt-BR" || explicit === "es") return explicit;
  const tinfoil = normalize(c.req.header("language"));
  if (tinfoil) return tinfoil;
  for (const part of (c.req.header("accept-language") ?? "").split(",")) {
    const found = normalize(part.split(";")[0]);
    if (found) return found;
  }
  return DEFAULT_LOCALE;
}

/** Error with a translatable message, for code that has no request at hand (drivers, transfers). */
export class AppError extends Error {
  constructor(
    public key: MessageKey,
    public params?: Params,
    public status?: number,
  ) {
    super(tr(DEFAULT_LOCALE, key, params));
  }
}

/** Translatable form of an error, safe to persist and translate later per request. */
export interface StoredMessage {
  message?: string;
  messageKey?: MessageKey;
  params?: Params;
}

export function storeError(err: unknown): StoredMessage {
  if (err instanceof AppError) return { message: undefined, messageKey: err.key, params: err.params };
  return { message: err instanceof Error ? err.message : String(err), messageKey: undefined, params: undefined };
}

export function readStored(locale: Locale, stored: StoredMessage | undefined): string | undefined {
  if (!stored) return undefined;
  if (stored.messageKey && isMessageKey(stored.messageKey)) return tr(locale, stored.messageKey, stored.params);
  return stored.message;
}
