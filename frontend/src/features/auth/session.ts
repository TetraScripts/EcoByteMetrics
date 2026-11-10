import { authenticatedRequest, login, loginErrorMessage, logoutSession, registerAccount, registrationErrorMessage, restoreSession, validateRegistration } from "./api.ts";
import type { AuthSession, Credentials, Registration, RegistrationErrors } from "./api.ts";
import { RequestError } from "../../shared/lib/http.ts";

export interface AuthState {
  session: AuthSession | null;
  pending: boolean;
  restoring: boolean;
  error: string | null;
  invalidCredentials: boolean;
  notice: "expired" | "registered" | "signed-out" | null;
  registeredEmail: string | null;
  fieldErrors: RegistrationErrors;
}

export function createAuthStore(restoreOnStart = false) {
  const initial: AuthState = { session: null, pending: false, restoring: false, error: null, invalidCredentials: false, notice: null,
    registeredEmail: null, fieldErrors: {} };
  let state = {...initial, restoring: restoreOnStart};
  let pending: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const update = (next: AuthState) => { state = next; listeners.forEach(listener => listener()); };
  const clear = (notice: AuthState["notice"] = null) => {
    pending?.abort(); pending = null;
    clearTimeout(timer); timer = undefined;
    update({ ...initial, notice });
  };
  const checkExpiration = () => {
    if (state.session && state.session.expiresAt <= Date.now()) clear("expired");
    return state.session;
  };
  const scheduleExpiration = () => {
    clearTimeout(timer);
    if (checkExpiration()) timer = setTimeout(scheduleExpiration, Math.min(state.session!.expiresAt - Date.now(), 2_147_483_647));
  };

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    checkExpiration,
    async restore() {
      if (pending || state.session) return;
      const controller = new AbortController();
      pending = controller;
      update({...state, restoring: true});
      try {
        const session = await restoreSession(controller.signal);
        if (pending !== controller || controller.signal.aborted) return;
        update({...initial, session});
        scheduleExpiration();
      } catch {
        if (pending === controller && !controller.signal.aborted)
          update({...initial, error: "Não foi possível verificar sua sessão. Tente recarregar ou entre novamente."});
      } finally { if (pending === controller) pending = null; }
    },
    async signIn(credentials: Credentials): Promise<boolean> {
      if (pending) return false;
      const controller = new AbortController();
      pending = controller;
      clearTimeout(timer);
      update({ ...initial, pending: true });
      try {
        const session = await login(credentials, controller.signal);
        if (pending !== controller || controller.signal.aborted) return false;
        update({ ...initial, session });
        scheduleExpiration();
        return true;
      } catch (error) {
        if (pending === controller && !controller.signal.aborted) update({ ...initial, error: loginErrorMessage(error),
          invalidCredentials: error instanceof RequestError && (error.status === 401 || error.status === 400) });
        return false;
      } finally {
        if (pending === controller) pending = null;
      }
    },
    async signUp(input: Registration): Promise<boolean> {
      if (pending || state.session) return false;
      const fieldErrors = validateRegistration(input);
      if (Object.keys(fieldErrors).length) {
        update({ ...initial, error: "Confira os campos indicados para criar sua conta.", fieldErrors });
        return false;
      }
      const controller = new AbortController();
      pending = controller;
      update({ ...initial, pending: true });
      try {
        const account = await registerAccount(input, controller.signal);
        if (pending !== controller || controller.signal.aborted) return false;
        update({ ...initial, notice: "registered", registeredEmail: account.email });
        return true;
      } catch (error) {
        if (pending === controller && !controller.signal.aborted) {
          const message = registrationErrorMessage(error);
          update({ ...initial, error: message,
            fieldErrors: error instanceof RequestError && error.status === 409 ? { email: message } : {} });
        }
        return false;
      } finally {
        if (pending === controller) pending = null;
      }
    },
    cancelLogin() {
      if (state.restoring) return;
      pending?.abort(); pending = null;
      if (state.pending || state.error) update({ ...state, pending: false, error: null, invalidCredentials: false, fieldErrors: {} });
    },
    async logout(): Promise<boolean> {
      if (!state.session) { clear(); return true; }
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      update({...state, pending: true, error: null});
      try {
        await logoutSession(controller.signal);
        if (pending !== controller || controller.signal.aborted) return false;
        clear("signed-out");
        return true;
      } catch {
        if (pending === controller && !controller.signal.aborted)
          update({...state, pending: false, error: "Não foi possível encerrar a sessão no servidor. Tente sair novamente."});
        return false;
      } finally { if (pending === controller) pending = null; }
    },
    dispose: () => clear(),
    async request(path: string, options?: { signal?: AbortSignal }) {
      const session = checkExpiration();
      if (!session) throw new RequestError("http", "Entre para continuar.", 401);
      try {
        const result = await authenticatedRequest(path, session, options);
        if (checkExpiration() !== session) throw new DOMException("Sessão encerrada", "AbortError");
        return result;
      }
      catch (error) {
        if (error instanceof RequestError && error.status === 401 && state.session === session) clear("expired");
        throw error;
      }
    },
  };
}

export type AuthStore = ReturnType<typeof createAuthStore>;
