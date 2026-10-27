import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "./api";

const SessionContext = createContext<SessionUser | null>(null);

export const SessionProvider = ({ user, children }: { user: SessionUser; children: ReactNode }) => (
  <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
);

/** The signed-in account. Only the Shell's subtree renders it, so it is never null in a page. */
export function useSession() {
  const user = useContext(SessionContext)!;
  return { user, isAdmin: user.role === "admin" };
}
