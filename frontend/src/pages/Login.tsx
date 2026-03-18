import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authLogin } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, User, Lock, ArrowRight, Clock, ArrowLeft } from 'lucide-react';

function ColorfulSlogan({ className = '' }: { className?: string }) {
  return (
    <p className={`leading-tight ${className}`}>
      <span className="text-[#2c5372]">&ldquo;&nbsp;Criando </span>
      <span className="text-[#e83948] font-black">conexões </span>
      <span className="text-[#2c5372]">entre </span>
      <span className="text-[#7B2D8E] font-black">pessoas, </span>
      <br />
      <span className="text-[#F5841F] font-black">alimentos </span>
      <span className="text-[#2c5372]">e </span>
      <span className="text-[#00857C] font-black">natureza</span>
      <span className="text-[#e83948]">&nbsp;&rdquo;</span>
    </p>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { authenticated, login } = useAuth();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);

  useEffect(() => {
    if (authenticated) navigate('/', { replace: true });
  }, [authenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = loginValue.trim();
    if (!trimmed || !password) return;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const isEmail = trimmed.includes('@');
    if (isEmail && !emailRegex.test(trimmed)) {
      setError('Formato de email inválido. Verifique e tente novamente.');
      return;
    }
    const usernameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!isEmail && !usernameRegex.test(trimmed)) {
      setError('Formato de usuário inválido. Use apenas letras, números, ponto, hífen ou underscore.');
      return;
    }

    setLoading(true);
    setError('');
    setPendingApproval(false);
    try {
      const res = await authLogin({ login: trimmed, password });
      if (res.status === 'pending_approval') {
        setPendingApproval(true);
      } else if (res.token && res.user) {
        login(res.token, res.user);
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Erro ao autenticar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 outline-none focus:border-[#2c5372] focus:ring-4 focus:ring-[#2c5372]/10 transition-all text-sm font-medium';

  if (pendingApproval) {
    return (
      <div className="min-h-screen flex">
        {/* Left brand panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#2c5372] via-[#1a3550] to-[#0c1a2a] relative overflow-hidden items-center justify-center">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#e83948] via-[#c7b475] to-[#2c5372]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(199,180,117,0.12),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(232,57,72,0.08),transparent_60%)]" />
          <div className="relative text-center px-12 max-w-lg">
            <img src="/minerva-logo-white.svg" alt="Minerva Foods" className="h-12 mx-auto mb-12 opacity-90" />
            <img src="/slogan-minerva.png" alt="Criando conexões entre pessoas, alimentos e natureza" className="max-w-sm mx-auto mb-10" />
            <div className="w-16 h-0.5 bg-gradient-to-r from-[#e83948] to-[#c7b475] mx-auto mb-6 rounded-full" />
            <p className="text-[#6d9dc0] text-sm font-medium leading-relaxed">
              Respeitosa. Dinâmica. Visionária.
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#c7b475]/10 border-2 border-[#c7b475]/30 mx-auto">
              <Clock size={36} className="text-[#c7b475]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Primeiro acesso detectado</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Suas credenciais do Active Directory foram validadas com sucesso. Um administrador precisa aprovar seu acesso para que você possa entrar na plataforma.
              </p>
            </div>
            <div className="p-4 bg-[#c7b475]/5 border-2 border-[#c7b475]/20 rounded-2xl">
              <div className="flex items-center justify-center gap-2 text-[#b5a060] text-sm font-bold">
                <Clock size={16} />
                Aguardando aprovação
              </div>
            </div>
            <button
              onClick={() => setPendingApproval(false)}
              className="inline-flex items-center gap-2 text-sm text-[#2c5372] hover:text-[#e83948] font-bold transition-colors"
            >
              <ArrowLeft size={14} /> Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-[#2c5372] via-[#1a3550] to-[#0c1a2a] relative overflow-hidden items-center justify-center">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#e83948] via-[#c7b475] to-[#2c5372]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(199,180,117,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(232,57,72,0.08),transparent_60%)]" />

        <div className="relative px-16 max-w-2xl">
          <img src="/minerva-logo-white.svg" alt="Minerva Foods" className="h-10 mb-16 opacity-80" />

          <img
            src="/slogan-minerva.png"
            alt="Criando conexões entre pessoas, alimentos e natureza"
            className="max-w-md mb-12 drop-shadow-2xl"
          />

          <div className="w-20 h-0.5 bg-gradient-to-r from-[#e83948] to-[#c7b475] mb-8 rounded-full" />

          <div className="space-y-4">
            <p className="text-white/80 text-sm leading-relaxed max-w-md">
              Onde há uma refeição, há conexão — e criar conexões é o que nos move.
            </p>
            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#c7b475]">
              <span>Respeitosa</span>
              <span className="w-1 h-1 bg-[#c7b475] rounded-full" />
              <span>Dinâmica</span>
              <span className="w-1 h-1 bg-[#c7b475] rounded-full" />
              <span>Visionária</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-16">
          <p className="text-white/20 text-[10px] font-bold tracking-[0.3em] uppercase">
            Levamos todo mundo pra mesa
          </p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(232,57,72,0.03),transparent_70%)]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[radial-gradient(circle,rgba(44,83,114,0.03),transparent_70%)]" />

        <div className="w-full max-w-md relative">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <img src="/minerva-logo.svg" alt="Minerva Foods" className="h-8 mb-4" />
            <ColorfulSlogan className="text-lg font-bold" />
          </div>

          <div className="mb-10">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bem-vindo!</h1>
            <p className="text-slate-500 mt-2 text-sm">Use seu usuário e senha corporativa do Minerva.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#eef3f8] flex items-center justify-center">
                <User size={16} className="text-[#2c5372]" />
              </div>
              <input
                type="text"
                placeholder="Usuário ou email"
                value={loginValue}
                onChange={e => setLoginValue(e.target.value)}
                className={inputCls}
                required
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#eef3f8] flex items-center justify-center">
                <Lock size={16} className="text-[#2c5372]" />
              </div>
              <input
                type="password"
                placeholder="Senha corporativa"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputCls}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-[#e83948] text-white font-black text-sm rounded-2xl shadow-xl shadow-[#e83948]/25 hover:shadow-[#e83948]/40 hover:bg-[#d42d3b] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wide"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {error && (
            <div className="mt-5 p-4 bg-[#e83948]/5 border-2 border-[#e83948]/15 rounded-2xl text-sm text-[#e83948] text-center font-semibold">
              {error}
            </div>
          )}

          <div className="mt-10 pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
              Autenticação via Active Directory
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
