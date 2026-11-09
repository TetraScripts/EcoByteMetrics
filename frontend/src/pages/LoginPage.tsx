import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
export function LoginPage({ register = false }: { register?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="login-page">
      <div className="landscape-background" />
      <div className="login-overlay" />
      <header className="login-header">
        <Brand />
        <Link className="text-link" to="/">
          <ArrowLeft size={16} />
          Voltar ao início
        </Link>
      </header>
      <main className="login-content">
        <div className="login-intro">
          <span className="pill-label">
            <Leaf size={15} />
            UM NOVO OLHAR PARA SEU SOFTWARE
          </span>
          <h1>
            Boas escolhas
            <br />
            começam com
            <br />
            <span>clareza.</span>
          </h1>
          <p>
            Uma visão mais consciente da energia
            <br />e do impacto das suas aplicações.
          </p>
        </div>
        <section className="login-card">
          <span className="icon-tile">
            <LockKeyhole size={24} />
          </span>
          <span className="eyebrow">BEM-VINDO AO ECOBYTEMETRICS</span>
          <h2>{register ? "Crie sua conta." : "Seu próximo passo."}</h2>
          <form onSubmit={(event) => event.preventDefault()}>
            {register && (
              <>
                <label htmlFor="name">Nome</label>
                <div className="input-with-icon">
                  <input
                    disabled
                    id="name"
                    autoComplete="name"
                    placeholder="Seu nome"
                    required
                  />
                </div>
              </>
            )}
            <label htmlFor="email">E-mail</label>
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                disabled
                id="email"
                type="email"
                autoComplete={register ? "email" : "username"}
                placeholder="voce@exemplo.com"
                required
              />
            </div>
            <label htmlFor="password">Senha</label>
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input
                disabled
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="Sua senha"
                required
                minLength={register ? 8 : 1}
              />
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="login-availability">
              Autenticação em breve. Nenhuma credencial é enviada ou armazenada.
            </p>
            <button disabled className="button button-dark" type="submit">
              {register ? "Cadastro indisponível" : "Login indisponível"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="login-divider">
            <span>
              {register ? "já tem uma conta?" : "ainda não tem conta?"}
            </span>
          </div>
          <Link
            className="button button-outline"
            to={register ? "/login" : "/pesquisa"}
          >
            {register ? "Fazer login" : "Criar conta"}
            <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
    </div>
  );
}
