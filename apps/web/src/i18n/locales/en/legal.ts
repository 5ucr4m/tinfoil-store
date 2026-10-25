export default {
  updated: "Last updated {date}",
  back: "Back to Cartucho",
  links: { privacy: "Privacy policy", terms: "Terms of use" },
  notice:
    "Cartucho is a private project. It isn't a commercial service, it has no public sign-up and only people invited by its owner can use it.",
  privacy: {
    title: "Privacy policy",
    about: {
      title: "Who runs this",
      body: "Cartucho is self-hosted software that one person runs on their own server to organize their Nintendo Switch backups and serve them to their own consoles through Tinfoil. In this policy, “the owner” is the person who runs this instance. There is no company behind it and nothing is sold.",
    },
    data: {
      title: "What is stored",
      body: "The panel password, as a salted hash. The Tinfoil users the owner creates, and their passwords. The settings of each storage integration (local folder, S3 or Google Drive), encrypted on the server. The name, size and location of each game file, plus game details downloaded from the public titledb list. For each console that opens the store: the ID Tinfoil sends, its Tinfoil version, its last IP address and when it was seen. The server log keeps one line per store request, without passwords.",
    },
    google: {
      title: "Google user data",
      body: "When the owner connects a Google Drive account, Cartucho asks Google for the account's email address and for access to Google Drive. The email is only shown in the panel, so the owner knows which account is connected. Drive access is used only to create the folder chosen in the panel and to list, read, upload, rename, move and delete the game files inside it, as the owner asks. Cartucho stores the refresh token Google returns, encrypted with AES-256-GCM, and nothing else from the account.",
    },
    limitedUse:
      "Cartucho's use and transfer of information received from Google APIs to any other app will adhere to the <policy>Google API Services User Data Policy</policy>, including the Limited Use requirements.",
    use: {
      title: "How the data is used",
      body: "Only to run the store: sign in to the panel, show the library, move files between storages and serve them to the owner's consoles. There are no ads, no analytics, no tracking and no profiling. Google user data is never used to train AI or machine learning models.",
    },
    sharing: {
      title: "Sharing",
      body: "No data is sold, rented or shared with anyone. Files only travel between the server and the storage the owner configured (their own Google Drive, S3 bucket or server folder) and to the consoles they authorize. The panel loads its fonts from Google Fonts, so your browser contacts Google when it opens the page.",
    },
    storage: {
      title: "Where data lives and how long",
      body: "Everything stays in a database on the owner's server. Removing an integration in the panel deletes its settings and its Google token right away. Removing a console or a Tinfoil user deletes its record. The panel saves your language and theme choice in your browser, and a session cookie keeps you signed in.",
    },
    revoke: {
      title: "Revoking Google access",
      body: "Remove the integration in the panel, or revoke Cartucho's access at any time in your <google>Google Account permissions</google>. Either one stops all access to your Drive.",
    },
    contact: {
      title: "Changes and contact",
      body: "If this policy changes, the date at the top changes too. For questions, or to have your data deleted, email the owner of this instance at <email>{email}</email>.",
    },
  },
  terms: {
    title: "Terms of use",
    about: {
      title: "A private project",
      body: "Cartucho is personal software run by its owner for their own use. It isn't a product or a service offered to the public, it has no public sign-up and it isn't affiliated with, endorsed by or sponsored by Nintendo, Google or the Tinfoil developers.",
    },
    access: {
      title: "Access",
      body: "Only people the owner invites may use this instance. Don't share your password or your Tinfoil user. The owner can change or remove any access at any time, without notice.",
    },
    content: {
      title: "Content",
      body: "Cartucho stores files; it doesn't provide them. Whoever adds a file is responsible for having the right to keep it, such as backups of games they own. Don't use Cartucho to distribute content you don't have rights to.",
    },
    google: {
      title: "Google Drive",
      body: "When you connect a Google Drive account, you authorize Cartucho to manage the files in the folder you chose. Your use of Google Drive stays subject to Google's own terms. How Cartucho handles that data is described in the <privacy>privacy policy</privacy>.",
    },
    warranty: {
      title: "No warranty",
      body: "Cartucho is provided as is, without warranties of any kind. It can go offline, lose data or stop working at any time. Keep your own copies of anything that matters to you.",
    },
    liability: {
      title: "Liability",
      body: "To the extent the law allows, the owner isn't liable for any loss or damage that comes from using, or being unable to use, this instance.",
    },
    changes: {
      title: "Changes",
      body: "These terms can change at any time; the date at the top shows the latest version. Using Cartucho after a change means you accept it. For questions, email <email>{email}</email>.",
    },
  },
};
