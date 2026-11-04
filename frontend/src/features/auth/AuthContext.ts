import { createContext } from "react";
import type { AuthStore } from "./session";

export const AuthContext = createContext<AuthStore | null>(null);
