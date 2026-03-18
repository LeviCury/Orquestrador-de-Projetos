import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="relative mb-8">
        <span className="text-[140px] font-black bg-gradient-to-br from-[#2c5372] via-[#4a7fa5] to-[#c7b475] bg-clip-text text-transparent leading-none select-none">
          404
        </span>
        <div className="absolute inset-0 bg-gradient-to-br from-[#2c5372]/10 via-[#4a7fa5]/10 to-[#c7b475]/10 rounded-3xl blur-3xl -z-10" />
      </div>

      <h1 className="text-2xl font-black text-slate-800 mb-2">Página não encontrada</h1>
      <p className="text-slate-500 max-w-md mb-8">
        A página que você está procurando não existe, foi movida ou está temporariamente indisponível.
      </p>

      <div className="flex gap-3">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-all hover:scale-[1.02] active:scale-[0.98]">
          <ArrowLeft size={16} /> Voltar
        </button>
        <button onClick={() => navigate('/')}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#e83948] text-white rounded-xl hover:bg-[#d42d3b] font-bold shadow-lg shadow-[#e83948]/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
          <Home size={16} /> Ir para Dashboard
        </button>
      </div>
    </div>
  );
}
