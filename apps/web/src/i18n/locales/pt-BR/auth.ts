import type { Messages } from "../..";
import type en from "../en/auth";

const auth: Messages<typeof en> = {
  setupTitle: "Crie a senha do painel",
  loginTitle: "Entrar no painel",
  setupBody: "Essa senha protege a sua biblioteca e as integrações. O Tinfoil usa outros usuários, que você cria depois.",
  loginBody: "Use a senha que você definiu na primeira vez.",
  password: "Senha",
  repeat: "Repita a senha",
  repeatHint: "Pelo menos 8 caracteres.",
  mismatch: "As senhas não são iguais.",
  failed: "Não foi possível entrar.",
  submitSetup: "Criar senha e entrar",
  submitLogin: "Entrar",
};

export default auth;
