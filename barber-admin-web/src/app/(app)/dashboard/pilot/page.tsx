'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../lib/api/axios';
import {
  TrendingUp,
  Bot,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Clock,
  DollarSign,
  Users,
  Star,
  ThumbsUp,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/utils';

interface PilotMetrics {
  conversations: {
    total: number;
    resolvedByAI: number;
    handoffCount: number;
  };
  rates: {
    iaResolutionRate: number;
    humanHandoffRate: number;
    bookingConversionRate: number;
    noShowRate: number;
  };
  funnel: {
    started: number;
    qualified: number;
    converted: number;
    attended: number;
  };
  escalationStats: {
    HUMAN_REQUEST: number;
    COMPLEX_REQUEST: number;
    NOT_UNDERSTOOD: number;
    COMPLAINT: number;
    OTHER: number;
  };
  crm: {
    recoveredClients: number;
    recoveredRevenue: number;
  };
  feedback: {
    total: number;
    nps: number;
    ratings: {
      agenda: number;
      whatsapp: number;
      ia: number;
      dashboard: number;
      support: number;
    };
  };
  hoursSaved: number;
  estimatedRevenue: number;
}

export default function PilotDashboardPage() {
  const { data: metrics, isLoading, error } = useQuery<PilotMetrics>({
    queryKey: ['pilotMetrics'],
    queryFn: async () => {
      const res = await api.get('/admin/pilot-metrics');
      return res.data;
    },
    refetchInterval: 15000, // Atualização em tempo real a cada 15 segundos
  });

  if (isLoading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center text-amber-500">
        <Loader2 className="h-10 w-10 animate-spin mb-4" />
        <p className="text-sm text-zinc-400">Carregando painel de métricas do piloto...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-xl border border-red-900 bg-red-950/20 p-6 text-center text-red-400 space-y-4">
        <AlertCircle className="h-12 w-12 mx-auto" />
        <h3 className="text-lg font-bold">Erro ao carregar telemetria</h3>
        <p className="text-sm">Não foi possível conectar ao backend para obter os indicadores do piloto.</p>
      </div>
    );
  }

  // Critérios de Sucesso
  const autonomyPassed = metrics.rates.iaResolutionRate >= 70;
  const conversionPassed = metrics.rates.bookingConversionRate >= 50;
  const noShowPassed = metrics.rates.noShowRate <= 10;
  const npsPassed = metrics.feedback.nps >= 8;
  const allCriteriaPassed = autonomyPassed && conversionPassed && noShowPassed && npsPassed;

  // Handoff reasons total for percentage calculation
  const totalEscalations = Object.values(metrics.escalationStats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-amber-500" />
            Painel Executivo do Piloto 01
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Métricas comerciais, satisfação e telemetria de validação do BarberAI.
          </p>
        </div>
        <div className="text-xs bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-400 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Atualizado em tempo real (15s)
        </div>
      </div>

      {/* Grid de KPIs principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Autonomia IA */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-950/40 p-5 space-y-3 transition-colors hover:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Autonomia da IA</span>
            <Bot className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h4 className="text-2xl font-bold text-white">{metrics.rates.iaResolutionRate.toFixed(1)}%</h4>
            <div className="flex items-center gap-1 mt-1 text-[11px]">
              {autonomyPassed ? (
                <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
                  <CheckCircle className="h-3 w-3" /> Aprovado (Alvo: &gt;=70%)
                </span>
              ) : (
                <span className="text-red-400 font-semibold flex items-center gap-0.5">
                  <AlertCircle className="h-3 w-3" /> Crítico (Alvo: &gt;=70%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Conversão Comercial */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-950/40 p-5 space-y-3 transition-colors hover:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Conversão de Vendas</span>
            <TrendingUp className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-2xl font-bold text-white">{metrics.rates.bookingConversionRate.toFixed(1)}%</h4>
            <div className="flex items-center gap-1 mt-1 text-[11px]">
              {conversionPassed ? (
                <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
                  <CheckCircle className="h-3 w-3" /> Aprovado (Alvo: &gt;=50%)
                </span>
              ) : (
                <span className="text-red-400 font-semibold flex items-center gap-0.5">
                  <AlertCircle className="h-3 w-3" /> Crítico (Alvo: &gt;=50%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* No-Show Rate */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-950/40 p-5 space-y-3 transition-colors hover:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">No-Show (Absenteísmo)</span>
            <Users className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <h4 className="text-2xl font-bold text-white">{metrics.rates.noShowRate.toFixed(1)}%</h4>
            <div className="flex items-center gap-1 mt-1 text-[11px]">
              {noShowPassed ? (
                <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
                  <CheckCircle className="h-3 w-3" /> Aprovado (Alvo: &lt;=10%)
                </span>
              ) : (
                <span className="text-red-400 font-semibold flex items-center gap-0.5">
                  <AlertCircle className="h-3 w-3" /> Crítico (Alvo: &lt;=10%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* NPS */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-950/40 p-5 space-y-3 transition-colors hover:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">NPS de Clientes</span>
            <ThumbsUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-2xl font-bold text-white">{metrics.feedback.nps.toFixed(1)}/10</h4>
            <div className="flex items-center gap-1 mt-1 text-[11px]">
              {npsPassed ? (
                <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
                  <CheckCircle className="h-3 w-3" /> Aprovado (Alvo: &gt;=8.0)
                </span>
              ) : (
                <span className="text-red-400 font-semibold flex items-center gap-0.5">
                  <AlertCircle className="h-3 w-3" /> Crítico (Alvo: &gt;=8.0)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Secundário: Funil de Vendas & Critérios de Lançamento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funil de Agendamento */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-850 bg-zinc-950/40 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              📊 Funil de Conversão Comercial (Booking Funnel)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Mapeamento de conversão das conversas iniciadas via WhatsApp.</p>
          </div>

          <div className="space-y-4">
            {/* Iniciadas */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300">1. Conversas Iniciadas</span>
                <span className="text-white">{metrics.funnel.started} conversas (100.0%)</span>
              </div>
              <div className="h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 w-full overflow-hidden flex items-center px-3">
                <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-600 rounded-lg w-full transition-all duration-500" />
              </div>
            </div>

            {/* Qualificadas */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300">2. Qualificadas (Demonstraram Intenção)</span>
                <span className="text-white">
                  {metrics.funnel.qualified} conversas ({metrics.funnel.started > 0 ? ((metrics.funnel.qualified / metrics.funnel.started) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="h-6 rounded-lg bg-zinc-900 w-full overflow-hidden flex items-center">
                <div 
                  className="h-full bg-yellow-500/80 rounded-lg transition-all duration-500" 
                  style={{ width: `${metrics.funnel.started > 0 ? (metrics.funnel.qualified / metrics.funnel.started) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Convertidas */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300">3. Convertidas (Agendadas)</span>
                <span className="text-white">
                  {metrics.funnel.converted} agendamentos ({metrics.funnel.started > 0 ? ((metrics.funnel.converted / metrics.funnel.started) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="h-6 rounded-lg bg-zinc-900 w-full overflow-hidden flex items-center">
                <div 
                  className="h-full bg-emerald-500/80 rounded-lg transition-all duration-500" 
                  style={{ width: `${metrics.funnel.started > 0 ? (metrics.funnel.converted / metrics.funnel.started) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Comparecidas */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300">4. Comparecidas (Serviços Finalizados)</span>
                <span className="text-white">
                  {metrics.funnel.attended} clientes ({metrics.funnel.converted > 0 ? ((metrics.funnel.attended / metrics.funnel.converted) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="h-6 rounded-lg bg-zinc-900 w-full overflow-hidden flex items-center">
                <div 
                  className="h-full bg-cyan-500/80 rounded-lg transition-all duration-500" 
                  style={{ width: `${metrics.funnel.started > 0 ? (metrics.funnel.attended / metrics.funnel.started) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Critérios de Lançamento */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-950/40 p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                🎯 Critérios de Lançamento (Go-Live)
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Conformidade obrigatória do Piloto 01 para go-live geral.</p>
            </div>

            <div className="space-y-3">
              {/* Autonomia */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-900/60 bg-zinc-950/20">
                <span className="text-xs text-zinc-300">Autonomia da IA (&gt;=70%)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${autonomyPassed ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/40 text-red-400 border border-red-900/50'}`}>
                  {metrics.rates.iaResolutionRate.toFixed(1)}%
                </span>
              </div>

              {/* Conversão */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-900/60 bg-zinc-950/20">
                <span className="text-xs text-zinc-300">Conversão de Vendas (&gt;=50%)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${conversionPassed ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/40 text-red-400 border border-red-900/50'}`}>
                  {metrics.rates.bookingConversionRate.toFixed(1)}%
                </span>
              </div>

              {/* No-show */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-900/60 bg-zinc-950/20">
                <span className="text-xs text-zinc-300">Absenteísmo (No-Show &lt;=10%)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${noShowPassed ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/40 text-red-400 border border-red-900/50'}`}>
                  {metrics.rates.noShowRate.toFixed(1)}%
                </span>
              </div>

              {/* NPS */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-900/60 bg-zinc-950/20">
                <span className="text-xs text-zinc-300">NPS de Satisfação (&gt;=8.0)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${npsPassed ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 'bg-red-950/40 text-red-400 border border-red-900/50'}`}>
                  {metrics.feedback.nps.toFixed(1)}/10
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-4 mt-4 text-center">
            {allCriteriaPassed ? (
              <div className="rounded-xl bg-emerald-950/40 border border-emerald-900/50 p-4 text-emerald-400 space-y-1">
                <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold">Piloto Pronto para Go-Live!</h4>
                <p className="text-[10px] text-zinc-400">Todos os critérios comerciais foram validados e aprovados.</p>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-950/40 border border-amber-900/50 p-4 text-amber-400 space-y-1">
                <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold">Ajustes Necessários</h4>
                <p className="text-[10px] text-zinc-400">Alguns alvos comerciais ainda estão abaixo do limite aceitável.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Adicional: Escalabilidade do Handoff & Satisfação do Painel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Handoff Reasons */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-950/40 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              🚨 Motivos de Escalabilidade da IA (Handoff Reasons)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Quais fatores causaram a transferência de conversas para atendimento humano?</p>
          </div>

          <div className="space-y-4">
            {/* HUMAN_REQUEST */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">Solicitação Direta de Humano</span>
                <span className="text-zinc-400 font-semibold">{metrics.escalationStats.HUMAN_REQUEST} acionamentos</span>
              </div>
              <div className="h-2 rounded bg-zinc-900 w-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded transition-all" 
                  style={{ width: `${totalEscalations > 0 ? (metrics.escalationStats.HUMAN_REQUEST / totalEscalations) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* COMPLEX_REQUEST */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">Dúvidas Complexas / Procedimentos</span>
                <span className="text-zinc-400 font-semibold">{metrics.escalationStats.COMPLEX_REQUEST} acionamentos</span>
              </div>
              <div className="h-2 rounded bg-zinc-900 w-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded transition-all" 
                  style={{ width: `${totalEscalations > 0 ? (metrics.escalationStats.COMPLEX_REQUEST / totalEscalations) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* NOT_UNDERSTOOD */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">IA Não Compreendeu Mensagem</span>
                <span className="text-zinc-400 font-semibold">{metrics.escalationStats.NOT_UNDERSTOOD} acionamentos</span>
              </div>
              <div className="h-2 rounded bg-zinc-900 w-full overflow-hidden">
                <div 
                  className="h-full bg-rose-500 rounded transition-all" 
                  style={{ width: `${totalEscalations > 0 ? (metrics.escalationStats.NOT_UNDERSTOOD / totalEscalations) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* COMPLAINT */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300">Reclamações / Insatisfação</span>
                <span className="text-zinc-400 font-semibold">{metrics.escalationStats.COMPLAINT} acionamentos</span>
              </div>
              <div className="h-2 rounded bg-zinc-900 w-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded transition-all" 
                  style={{ width: `${totalEscalations > 0 ? (metrics.escalationStats.COMPLAINT / totalEscalations) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Satisfação do Módulo */}
        <div className="rounded-2xl border border-zinc-850 bg-zinc-950/40 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              ⭐ Nível de Satisfação por Módulos
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Aproveitamento e notas de usabilidade do painel e integrações.</p>
          </div>

          <div className="space-y-4">
            {/* Agenda */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300 font-medium">🗓️ Agenda &amp; Horários</span>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-white font-bold">{metrics.feedback.ratings.agenda.toFixed(1)}/5.0</span>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300 font-medium">💬 Integração WhatsApp</span>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-white font-bold">{metrics.feedback.ratings.whatsapp.toFixed(1)}/5.0</span>
              </div>
            </div>

            {/* IA */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300 font-medium">🤖 IA Recepcionista</span>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-white font-bold">{metrics.feedback.ratings.ia.toFixed(1)}/5.0</span>
              </div>
            </div>

            {/* Dashboard */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300 font-medium">📊 Dashboard &amp; Relatórios</span>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-white font-bold">{metrics.feedback.ratings.dashboard.toFixed(1)}/5.0</span>
              </div>
            </div>

            {/* Suporte */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300 font-medium">📞 Suporte Técnico</span>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-white font-bold">{metrics.feedback.ratings.support.toFixed(1)}/5.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROI & CRM Section */}
      <div className="rounded-2xl border border-zinc-850 bg-gradient-to-br from-zinc-950 to-zinc-900/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            💰 Retorno sobre o Investimento (Valor Gerado)
          </h3>
          <p className="text-xs text-zinc-400 max-w-xl">
            Calculado com base na economia de tempo operacional do assistente virtual (2 minutos por mensagem IA) e agendamentos diretos bem-sucedidos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-550 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-cyan-400" /> Horas Salvas
            </span>
            <h4 className="text-2xl font-black text-white">{metrics.hoursSaved.toFixed(1)}h</h4>
          </div>
          <div className="h-10 w-px bg-zinc-800 hidden md:block" />
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-550 flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> Receita Estimada
            </span>
            <h4 className="text-2xl font-black text-emerald-400">{formatCurrency(metrics.estimatedRevenue)}</h4>
          </div>
        </div>
      </div>
    </div>
  );
}
