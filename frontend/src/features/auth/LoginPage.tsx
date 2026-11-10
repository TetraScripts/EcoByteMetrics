import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Brand } from "@/shared/ui/Brand";
import { TopographicSides } from "@/features/monitoring/components/TopographicSides";
import { useAuth } from "./useAuth";
import { publicReturnPath, safeReturnPath, validateRegistration } from "./api";
import "./styles.css";

export function LoginPage({ register = false }: { register?: boolean }) {
  const { session, pending, restoring, error, invalidCredentials, notice, registeredEmail, fieldErrors, signIn, signUp, cancelLogin } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(!register ? registeredEmail ?? "" : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const publicReturn = publicReturnPath(params.get("retorno"));
  const returnTo = safeReturnPath(params.get("retorno"));
  const returnQuery = params.has("retorno") ? "?" + new URLSearchParams({ retorno: returnTo }) : "";
  useEffect(() => cancelLogin, [cancelLogin]);
  useEffect(() => {
    if (invalidCredentials || Object.keys(fieldErrors).length)
      form.current?.querySelector<HTMLInputElement>("input[aria-invalid='true']")?.focus();
  }, [fieldErrors, invalidCredentials]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (register) {
      const input = { name, email, password };
      const valid = !Object.keys(validateRegistration(input)).length;
      const created = await signUp(input);
      if (valid) { setPassword(""); setShowPassword(false); }
      if (created) navigate("/login" + returnQuery, { replace: true });
    } else {
      await signIn({ email, password });
      setPassword("");
      setShowPassword(false);
    }
  }
  if (session) return <Navigate to={returnTo} replace />;
  if (restoring) return <main className="login-content" role="status">Verificando sua sessão…</main>;
  return (
    <div className="login-page">
      <a className="skip-link" href="#login-content">Pular para o formulário</a>
      <TopographicSides />
      <header className="login-header">
        <Brand />
        <Link className="login-back" to={publicReturn} aria-label="Voltar ao monitoramento">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Voltar ao monitoramento</span>
        </Link>
      </header>

      <main className="login-content" id="login-content" tabIndex={-1}>
        <div className="login-shell">
          <section className="login-form-panel" aria-labelledby="login-title">
            <nav className="login-view-tabs" aria-label="Formulários de acesso">
              <Link to={"/login" + returnQuery} aria-current={!register ? "page" : undefined}>Entrar</Link>
              <Link to={"/cadastro" + returnQuery} aria-current={register ? "page" : undefined}>Criar conta</Link>
            </nav>

            <div className="login-form-intro">
              <span className="login-access-icon"><LockKeyhole size={22} strokeWidth={1.6} aria-hidden="true" /></span>
              <h1 id="login-title">{register ? "Crie sua conta." : "Bem-vindo de volta."}</h1>
              <p>{register ? "Crie sua conta para acessar as configurações do ambiente." : "Entre para acessar as configurações do seu ambiente."}</p>
            </div>

            {!register && notice === "registered" && <p className="login-notice" role="status">Conta criada com sucesso. Entre com sua senha para continuar.</p>}
            {!register && notice !== "registered" && (notice === "expired" || params.get("motivo") === "expirada") && <p className="login-notice" role="status">Sua sessão expirou. Entre novamente para continuar.</p>}
            <form ref={form} aria-label={register ? "Cadastro de conta" : "Acesso à administração"} aria-busy={pending} noValidate={register} onSubmit={submit}>
              {register && <div className="login-field">
                <label htmlFor="name">Nome</label>
                <div className="login-input"><input disabled={pending} id="name" name="name" autoComplete="name" placeholder="Seu nome" required value={name} onChange={event => setName(event.target.value)} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined} /></div>
                {fieldErrors.name && <p className="login-field-error" id="name-error">{fieldErrors.name}</p>}
              </div>}

              <div className="login-field">
                <label htmlFor="email">E-mail</label>
                <div className="login-input"><input disabled={pending} id="email" name="email" type="email" autoComplete={register ? "email" : "username"} autoCapitalize="none" spellCheck={false} placeholder="voce@exemplo.com" required maxLength={register ? 254 : undefined} value={email} onChange={event => setEmail(event.target.value)} aria-invalid={invalidCredentials || Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email && fieldErrors.email !== error ? "email-error" : error ? "login-error" : undefined} /></div>
                {fieldErrors.email && fieldErrors.email !== error && <p className="login-field-error" id="email-error">{fieldErrors.email}</p>}
              </div>

              <div className="login-field">
                <label htmlFor="password">Senha</label>
                <div className="login-input">
                  <input disabled={pending} id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} placeholder="Sua senha" required minLength={register ? 8 : 1} value={password} onChange={event => setPassword(event.target.value)} aria-invalid={invalidCredentials || Boolean(fieldErrors.password)} aria-describedby={[register ? "password-help" : "", fieldErrors.password ? "password-error" : error ? "login-error" : ""].filter(Boolean).join(" ") || undefined} />
                  <button type="button" disabled={pending} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} aria-controls="password" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
                </div>
                {register && <p className="login-field-help" id="password-help">Use pelo menos 8 caracteres.</p>}
                {fieldErrors.password && <p className="login-field-error" id="password-error">{fieldErrors.password}</p>}
              </div>

              {error && <p className="login-error" id="login-error" role="alert">{error}</p>}
              <button disabled={pending} className="login-submit" type="submit">
                <span role="status">{register ? pending ? "Criando conta…" : "Criar conta" : pending ? "Entrando…" : "Entrar no ambiente"}</span><ArrowRight size={17} aria-hidden="true" />
              </button>

            </form>
          </section>

          <div className="login-public-access">
            <Link to={publicReturn}>Explorar monitoramento<ArrowUpRight size={16} aria-hidden="true" /></Link>
            <p>Consulte os indicadores sem precisar entrar.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
