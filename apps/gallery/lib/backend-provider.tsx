import { createContext, useContext, type ReactNode } from "react";
import { normaliseBackendUrl, setRuntimeBackend } from "./client-runtime";
// Operator-owned deployment configuration. Old user-entered endpoints are ignored.
const configured = normaliseBackendUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
);
setRuntimeBackend(configured);
const Context = createContext({ url: configured });
export const useBackend = () => useContext(Context);
export function BackendProvider({ children }: { children: ReactNode }) {
  return (
    <Context.Provider value={{ url: configured }}>{children}</Context.Provider>
  );
}
