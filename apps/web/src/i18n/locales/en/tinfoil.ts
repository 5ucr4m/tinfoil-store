export default {
  title: "Connect Tinfoil",
  meta: "Add the store once on the console. After that, everything in the library shows up in Tinfoil.",
  access: {
    title: "Your Tinfoil access",
    description:
      "Turn it on to open this store on a Switch. On the console you sign in with the same user and password you use here.",
    toggle: "Tinfoil access",
    off: "The values for your console appear here once Tinfoil access is on.",
    turnedOn: "Tinfoil access on. Add the store on the console with the values on the card.",
    turnedOff: "Tinfoil access off. Consoles signed in with your account lose the store.",
    lastUsed: "A console last opened the store {when}.",
    never: "No console has opened the store with your account yet.",
  },
  console: {
    title: "On the console",
    step1: "Open Tinfoil and go to <b>File Browser</b>.",
    step2: "Press <b>−</b> (minus) to add a new location.",
    step3: "Fill in the fields as shown on the card. For the password, use the one you sign in to the panel with.",
    step4: "Press <b>X</b> to save and go back. Games show up in <b>New Games</b> and in the store itself.",
    httpNote:
      "The store is answering over <b>http</b>. Away from home, publish it behind HTTPS (Dokploy's Traefik does this) and set the public address below.",
  },
  card: {
    title: "Values for Tinfoil",
    passwordHint: "the password you sign in with",
    loopback:
      "The Switch can't reach \"{host}\": that address points to the console itself. Use this computer's IP on the network (e.g. 192.168.x.x). Open the panel through that IP or fill in the public address below.",
  },
  store: {
    title: "Store",
    description: "The address that goes into the index and the message Tinfoil shows when it opens.",
    publicUrl: "Public address",
    publicUrlHint:
      "Empty = detect from the request (now: {url}). Set it when you're behind a proxy or on your own domain.",
    publicUrlPlaceholder: "https://store.yourdomain.com",
    welcome: "Welcome message",
    welcomeHint: "Shows up in a pop-up every time the store loads. Empty = no pop-up.",
    welcomePlaceholder: "E.g. Welcome back!",
    save: "Save store",
    saved: "Store settings saved.",
  },
  direct: {
    title: "Google Drive direct mode",
    description:
      "The console downloads straight from Drive with your Google account, without going through the server. Useful when you're away from home or on a VPS with little bandwidth.",
    experimental: "experimental",
    step1: "In Google Cloud, create another OAuth client ID of type <b>Desktop app</b> and download the JSON.",
    step2: "Save it on the SD card as <code>/switch/tinfoil/credentials.json</code> and sign in to Google from Tinfoil.",
    step3:
      "Add a second store with the path below. Drive files come out as gdrive: links, and the others keep going through the server.",
    note: "The gdrive: format and the credentials.json location change between Tinfoil versions. Test with a small game first.",
  },
  titledb: {
    title: "Names and covers",
    description:
      "They come from titledb, a public database with game metadata. The download is about 90 MB and runs in the background.",
    refreshing: "Updating",
    refresh: "Update now",
    done: { one: "{total} title · updated {when}", other: "{total} titles · updated {when}" },
    running: "Downloading and indexing…",
    failed: "Failed: {error}",
    idle: "Not downloaded yet.",
  },
  fields: { protocol: "Protocol", host: "Host", port: "Port", path: "Path", username: "Username", password: "Password", title: "Title", url: "URL" },
};
