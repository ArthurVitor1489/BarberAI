'use client';

import React, { useEffect } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Application Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] text-slate-100 p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-red-500 mx-auto">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">500 - Instabilidade do Sistema</h1>
          <p className="text-sm text-zinc-500">
            Encontramos um erro temporário no processamento. Nossa telemetria já registrou o evento para análise.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-xs font-bold text-zinc-950 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </button>
        </div>
      </div>
    </div>
  );
}
