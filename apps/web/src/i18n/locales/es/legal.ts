import type { Messages } from "../..";
import type en from "../en/legal";

const legal: Messages<typeof en> = {
  updated: "Actualizado el {date}",
  back: "Volver a Cartucho",
  links: { privacy: "Política de privacidad", terms: "Términos de uso" },
  notice:
    "Cartucho es un proyecto privado. No es un servicio comercial, no tiene registro abierto y solo pueden usarlo las personas que invita su dueño.",
  privacy: {
    title: "Política de privacidad",
    about: {
      title: "Quién lo mantiene",
      body: "Cartucho es un software autoalojado que una persona ejecuta en su propio servidor para organizar sus copias de seguridad de Nintendo Switch y servirlas a sus propias consolas a través de Tinfoil. En esta política, “el dueño” es la persona que mantiene esta instancia. No hay ninguna empresa detrás y no se vende nada.",
    },
    data: {
      title: "Qué se guarda",
      body: "La contraseña del panel, como hash con salt. Los usuarios de Tinfoil que crea el dueño y sus contraseñas. La configuración de cada integración de almacenamiento (carpeta local, S3 o Google Drive), cifrada en el servidor. El nombre, el tamaño y la ubicación de cada archivo de juego, además de los datos de los juegos descargados de la lista pública de titledb. De cada consola que abre la tienda: el ID que envía Tinfoil, su versión de Tinfoil, su última dirección IP y cuándo se vio. El registro del servidor guarda una línea por solicitud a la tienda, sin contraseñas.",
    },
    google: {
      title: "Datos de usuario de Google",
      body: "Cuando el dueño conecta una cuenta de Google Drive, Cartucho le pide a Google el correo de la cuenta y acceso a Google Drive. El correo solo se muestra en el panel, para que el dueño sepa qué cuenta está conectada. El acceso a Drive se usa únicamente para crear la carpeta elegida en el panel y para listar, leer, subir, renombrar, mover y eliminar los archivos de juegos que contiene, cuando el dueño lo pide. Cartucho guarda el refresh token que devuelve Google, cifrado con AES-256-GCM, y nada más de la cuenta.",
    },
    limitedUse:
      "El uso y la transferencia, por parte de Cartucho, de la información recibida de las API de Google a cualquier otra app cumplen la <policy>Política de datos del usuario de los servicios de API de Google</policy>, incluidos los requisitos de uso limitado.",
    use: {
      title: "Cómo se usan los datos",
      body: "Solo para que la tienda funcione: iniciar sesión en el panel, mostrar la biblioteca, mover archivos entre almacenamientos y servirlos a las consolas del dueño. No hay anuncios, analítica, rastreo ni creación de perfiles. Los datos de usuario de Google nunca se usan para entrenar modelos de IA ni de aprendizaje automático.",
    },
    sharing: {
      title: "Compartir datos",
      body: "Ningún dato se vende, se alquila ni se comparte con nadie. Los archivos solo viajan entre el servidor, el almacenamiento que configuró el dueño (su propio Google Drive, bucket S3 o carpeta del servidor) y las consolas que autoriza. El panel carga sus fuentes desde Google Fonts, así que tu navegador se conecta con Google al abrir la página.",
    },
    storage: {
      title: "Dónde están los datos y por cuánto tiempo",
      body: "Todo queda en una base de datos en el servidor del dueño. Quitar una integración en el panel elimina al instante su configuración y su token de Google. Quitar una consola o un usuario de Tinfoil elimina su registro. El panel guarda en tu navegador el idioma y el tema que elegiste, y una cookie de sesión mantiene tu sesión iniciada.",
    },
    revoke: {
      title: "Cómo revocar el acceso a Google",
      body: "Quita la integración en el panel o revoca el acceso de Cartucho cuando quieras en los <google>permisos de tu cuenta de Google</google>. Cualquiera de las dos corta todo el acceso a tu Drive.",
    },
    contact: {
      title: "Cambios y contacto",
      body: "Si esta política cambia, la fecha de arriba también cambia. Para hacer preguntas o pedir que se eliminen tus datos, escríbele al dueño de esta instancia a <email>{email}</email>.",
    },
  },
  terms: {
    title: "Términos de uso",
    about: {
      title: "Un proyecto privado",
      body: "Cartucho es un software personal que su dueño ejecuta para uso propio. No es un producto ni un servicio ofrecido al público, no tiene registro abierto y no está afiliado, respaldado ni patrocinado por Nintendo, Google ni los desarrolladores de Tinfoil.",
    },
    access: {
      title: "Acceso",
      body: "Solo las personas que invita el dueño pueden usar esta instancia. No compartas tu contraseña ni tu usuario de Tinfoil. El dueño puede cambiar o quitar cualquier acceso en cualquier momento, sin aviso.",
    },
    content: {
      title: "Contenido",
      body: "Cartucho guarda archivos; no los proporciona. Quien agrega un archivo es responsable de tener derecho a guardarlo, como las copias de seguridad de juegos que posee. No uses Cartucho para distribuir contenido sobre el que no tienes derechos.",
    },
    google: {
      title: "Google Drive",
      body: "Al conectar una cuenta de Google Drive, autorizas a Cartucho a gestionar los archivos de la carpeta que elegiste. Tu uso de Google Drive sigue sujeto a los términos de Google. Cómo trata Cartucho esos datos se describe en la <privacy>política de privacidad</privacy>.",
    },
    warranty: {
      title: "Sin garantía",
      body: "Cartucho se ofrece tal cual, sin garantías de ningún tipo. Puede dejar de estar disponible, perder datos o dejar de funcionar en cualquier momento. Guarda tus propias copias de todo lo que te importe.",
    },
    liability: {
      title: "Responsabilidad",
      body: "En la medida en que la ley lo permita, el dueño no es responsable de pérdidas ni daños derivados del uso, o de la imposibilidad de uso, de esta instancia.",
    },
    changes: {
      title: "Cambios",
      body: "Estos términos pueden cambiar en cualquier momento; la fecha de arriba muestra la versión más reciente. Seguir usando Cartucho después de un cambio significa que lo aceptas. Para hacer preguntas, escribe a <email>{email}</email>.",
    },
  },
};

export default legal;
