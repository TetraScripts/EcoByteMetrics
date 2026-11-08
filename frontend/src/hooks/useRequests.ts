import { useContext } from "react";
import { RequestsContext } from "../contexts/RequestsContext";

export function useRequests() {
  const context = useContext(RequestsContext);
  if (!context) throw new Error("useRequests precisa de AppProviders.");
  return context;
}
