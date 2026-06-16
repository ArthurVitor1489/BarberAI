'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api/axios';
import {
  CreditCard,
  Check,
  AlertCircle,
  HelpCircle,
  Zap,
  ShieldAlert,
  Loader2,
  Sparkles,
  Award,
} from 'lucide-react';

interface Subscription {
  plan: 'STARTER' | 'PRO' | 'PREMIUM_AI';
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
}

export default function SubscriptionPage() {
  const { data: sub, isLoading } = useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await api.get('/subscription');
      return res.data;
    },
  });

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'STARTER':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-400 border border-zinc-750">
            STARTER
          </span>
        );
      case 'PRO':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500 border border-amber-500/20">
            <Award className="h-3.5 w-3.5" /> PRO
          </span>
        );
      case 'PREMIUM_AI':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-gradient-to-tr from-amber-500 to-yellow-600 px-2.5 py-1 text-xs font-bold text-white shadow-md">
            <Sparkles className="h-3.5 w-3.5" /> PREMIUM AI
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            Ativo
          </span>
        );
      case 'TRIAL':
        return (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
            Período de Teste
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/20">
            Expirado
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="rounded bg-zinc-850 px-2 py-0.5 text-xs font-semibold text-zinc-500 border border-zinc-800">
            Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  const features = {
    STARTER: [
      { text: '1 profissional (barbeiro)', active: true },
      { text: 'Menu de serviços ilimitados', active: true },
      { text: 'Agenda e marcação manual', active: true },
      { text: 'Histórico de agendamentos', active: true },
      { text: 'Recepcionista automática com IA', active: false },
      { text: 'Relatórios avançados e LTV', active: false },
      { text: 'Lembrete automático WhatsApp', active: false },
    ],
    PRO: [
      { text: 'Até 5 profissionais', active: true },
      { text: 'Menu de serviços ilimitados', active: true },
      { text: 'Agenda e marcação manual', active: true },
      { text: 'Histórico de agendamentos', active: true },
      { text: 'Relatórios avançados e LTV', active: true },
      { text: 'Lembrete automático WhatsApp', active: true },
      { text: 'Recepcionista automática com IA', active: false },
    ],
    PREMIUM_AI: [
      { text: 'Profissionais ilimitados', active: true },
      { text: 'Menu de serviços ilimitados', active: true },
      { text: 'Agenda e marcação manual', active: true },
      { text: 'Histórico de agendamentos', active: true },
      { text: 'Relatórios avançados e LTV', active: true },
      { text: 'Lembrete automático WhatsApp', active: true },
      { text: 'Recepcionista automática com IA', active: true },
    ],
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-zinc-500">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-amber-500" />
          Gerenciar Assinatura
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Acompanhe o status do seu plano ativo e confira os recursos liberados de acordo com sua categoria de serviço.
        </p>
      </div>

      {/* Cartão do Plano Atual */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-6 mb-6">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Plano de Assinatura
            </span>
            <div className="flex items-center gap-3">
              {getPlanBadge(sub?.plan || 'STARTER')}
              {getStatusBadge(sub?.status || 'TRIAL')}
            </div>
          </div>
          <div className="text-xs text-zinc-400">
            <span>Validade da assinatura: </span>
            <strong className="text-zinc-200">
              {sub?.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : 'N/A'}
            </strong>
          </div>
        </div>

        {/* Alerta de Plano Starter */}
        {sub?.plan === 'STARTER' && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-400 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong>Você está no plano de entrada (STARTER):</strong>
              <p className="text-zinc-400">
                Para desbloquear a recepcionista automática com Inteligência Artificial no WhatsApp e ter relatórios avançados de faturamento (LTV/CRM), faça upgrade para o plano **PREMIUM AI**.
              </p>
            </div>
          </div>
        )}

        {/* Recursos Liberados */}
        <div>
          <h3 className="text-sm font-bold text-white mb-4">Recursos Incluídos no seu Plano:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {features[sub?.plan || 'STARTER'].map((feat, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2.5 rounded-lg px-4 py-3 border text-xs ${
                  feat.active
                    ? 'border-zinc-800 bg-zinc-900/40 text-zinc-200'
                    : 'border-zinc-900 bg-zinc-950/20 text-zinc-600'
                }`}
              >
                <div
                  className={`rounded-full p-0.5 ${
                    feat.active ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-700'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span>{feat.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Upgrades */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Planos Disponíveis
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter Plan Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-md font-bold text-zinc-400">STARTER</h3>
              <p className="text-2xl font-black text-white mt-2">R$ 99<span className="text-xs font-normal text-zinc-500">/mês</span></p>
              <p className="text-xs text-zinc-500 mt-2">Ideal para barbeiros autônomos iniciando o negócio.</p>
              <div className="border-t border-zinc-850 my-4" />
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-zinc-500" /> 1 profissional</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-zinc-500" /> Agenda manual</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-zinc-500" /> Serviços ilimitados</li>
              </ul>
            </div>
            <button
              disabled={sub?.plan === 'STARTER'}
              className="w-full mt-6 rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sub?.plan === 'STARTER' ? 'Plano Ativo' : 'Mudar Plano'}
            </button>
          </div>

          {/* Pro Plan Card */}
          <div className="rounded-xl border border-amber-500/20 bg-zinc-950 p-6 flex flex-col justify-between relative shadow-lg">
            <span className="absolute -top-3 right-4 rounded-full bg-amber-500 px-3 py-0.5 text-[10px] font-bold text-zinc-950 shadow-md">
              Mais Vendido
            </span>
            <div>
              <h3 className="text-md font-bold text-amber-500 flex items-center gap-1">PRO</h3>
              <p className="text-2xl font-black text-white mt-2">R$ 199<span className="text-xs font-normal text-zinc-500">/mês</span></p>
              <p className="text-xs text-zinc-500 mt-2">Perfeito para equipes e barbearias em expansão.</p>
              <div className="border-t border-zinc-850 my-4" />
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-500" /> Até 5 profissionais</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-500" /> Relatórios de LTV / Ticket Médio</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-amber-500" /> Disparos WhatsApp</li>
              </ul>
            </div>
            <button
              disabled={sub?.plan === 'PRO'}
              className="w-full mt-6 rounded-lg bg-amber-500 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sub?.plan === 'PRO' ? 'Plano Ativo' : 'Mudar Plano'}
            </button>
          </div>

          {/* Premium AI Plan Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-md font-bold text-yellow-500 flex items-center gap-1">PREMIUM AI</h3>
              <p className="text-2xl font-black text-white mt-2">R$ 349<span className="text-xs font-normal text-zinc-500">/mês</span></p>
              <p className="text-xs text-zinc-500 mt-2">Automação com IA completa para dominar seu mercado.</p>
              <div className="border-t border-zinc-850 my-4" />
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-yellow-500" /> Profissionais ilimitados</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-yellow-500" /> Recepcionista virtual 24/7</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-yellow-500" /> IA integrada ao WhatsApp</li>
              </ul>
            </div>
            <button
              disabled={sub?.plan === 'PREMIUM_AI'}
              className="w-full mt-6 rounded-lg border border-zinc-850 bg-zinc-900 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sub?.plan === 'PREMIUM_AI' ? 'Plano Ativo' : 'Mudar Plano'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
