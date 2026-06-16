'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCircle, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] text-slate-100 p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-amber-500 mx-auto animate-bounce">
          <HelpCircle className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">404 - Página Não Encontrada</h1>
          <p className="text-sm text-zinc-500">
            Desculpe, o caminho que você está tentando acessar não existe ou foi movido.
          </p>
        </div>

        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-xs font-bold text-zinc-950 transition-colors"
          >
            Voltar para o Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
