import type { Messages } from "../..";
import type en from "../en/auth";

const auth: Messages<typeof en> = {
  setupTitle: "Crea la contraseña del panel",
  loginTitle: "Inicia sesión en el panel",
  setupBody: "Esta contraseña protege tu biblioteca y tus integraciones. Tinfoil usa otros usuarios, que creas después.",
  loginBody: "Usa la contraseña que definiste la primera vez.",
  password: "Contraseña",
  repeat: "Repite la contraseña",
  repeatHint: "Al menos 8 caracteres.",
  mismatch: "Las contraseñas no coinciden.",
  failed: "No se pudo iniciar sesión.",
  submitSetup: "Crear contraseña y entrar",
  submitLogin: "Iniciar sesión",
};

export default auth;
