'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api/axios';
import { formatCurrency, formatDate, formatTime } from '../../../lib/utils';
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Smartphone,
  Bot,
  Zap,
  Scissors,
  Briefcase,
  AlertTriangle,
  Play,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardSummary {
  appointmentsToday: number;
  customers: number;
  barbers: number;
  services: number;
  revenueMonth: number;
}

interface Appointment {
  id: string;
  dateTime: string;
  status: string;
  client: { name: string; phone: string };
  service: { name: string; price: number };
  barber: { name: string };
}

interface AppointmentsResponse {
  items: Appointment[];
  total: number;
}

interface Barbershop {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  workingHours: string;
  timezone: string;
}

interface WhatsAppInstance {
  id: string;
  instanceName: string;
  status: 'CONNECTED' | 'DISCONNECTED';
  qrCode: string | null;
}

interface HealthStatus {
  status: string;
  redis?: string;
  openai?: string;
  db?: string;
}

export default function DashboardPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const queryClient = useQueryClient();

  // Onboarding form state
  const [shopForm, setShopForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    workingHours: '09:00-18:00',
    timezone: 'America/Sao_Paulo',
  });
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    price: 50,
    durationMinutes: 30,
  });
  const [barberForm, setBarberForm] = useState({
    name: '',
    specialty: '',
  });

  // Queries
  const { data: summary, isLoading: isSummaryLoading, error: summaryError } = useQuery<DashboardSummary>({
    queryKey: ['dashboardSummary'],
    queryFn: async () => {
      const res = await api.get('/dashboard');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: appointmentsData, isLoading: isAppointmentsLoading } = useQuery<AppointmentsResponse>({
    queryKey: ['dashboardAppointments'],
    queryFn: async () => {
      const res = await api.get('/appointments', { params: { limit: 5 } });
      return res.data;
    },
  });

  const { data: barbershop } = useQuery<Barbershop>({
    queryKey: ['barbershop'],
    queryFn: async () => {
      const res = await api.get('/barbershop');
      return res.data;
    },
  });

  const { data: instances = [] } = useQuery<WhatsAppInstance[]>({
    queryKey: ['whatsapp-instances'],
    queryFn: async () => {
      const res = await api.get('/whatsapp/instances');
      return res.data;
    },
  });

  const { data: conversations = [] } = useQuery<any[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/conversations');
      return res.data;
    },
  });

  const { data: health } = useQuery<HealthStatus>({
    queryKey: ['health-status'],
    queryFn: async () => {
      try {
        const res = await api.get('/health');
        return res.data;
      } catch (err) {
        return { status: 'error', redis: 'error', openai: 'error', db: 'error' };
      }
    },
    refetchInterval: 15000, // Poll system health
  });

  // Wizard mutations
  const updateShopMutation = useMutation({
    mutationFn: async (values: typeof shopForm) => api.put('/barbershop', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barbershop'] });
      setWizardStep(2);
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (values: typeof serviceForm) => api.post('/services', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setWizardStep(3);
    },
  });

  const createBarberMutation = useMutation({
    mutationFn: async (values: typeof barberForm) => api.post('/barbers', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setWizardStep(4);
    },
  });

  // Checklist completion checks
  const isProfileDone = !!barbershop?.address;
  const isServiceDone = (summary?.services || 0) > 0;
  const isBarberDone = (summary?.barbers || 0) > 0;
  const isWhatsappConnected = instances.some((inst) => inst.status === 'CONNECTED');
  const isMessageReceived = conversations.length > 0;

  const checklistItems = [
    { label: 'Completar perfil da barbearia', done: isProfileDone, path: '/settings' },
    { label: 'Cadastrar primeiro serviço', done: isServiceDone, path: '/services' },
    { label: 'Cadastrar primeiro barbeiro', done: isBarberDone, path: '/barbers' },
    { label: 'Conectar WhatsApp', done: isWhatsappConnected, path: '/settings' },
    { label: 'Receber primeira mensagem', done: isMessageReceived, path: '/conversations' },
  ];

  const completedStepsCount = checklistItems.filter((item) => item.done).length;
  const isSetupComplete = completedStepsCount === checklistItems.length;

  // AI virtual assistant status
  let aiStatus: 'online' | 'degraded' | 'offline' = 'offline';
  if (isWhatsappConnected) {
    if (health?.openai === 'error' || health?.openai === 'down') {
      aiStatus = 'degraded';
    } else {
      aiStatus = 'online';
    }
  }

  // Pre-fill wizard if barbershop details are retrieved
  const handleStartWizard = () => {
    if (barbershop) {
      setShopForm({
        name: barbershop.name,
        phone: barbershop.phone,
        email: barbershop.email,
        address: barbershop.address || '',
        workingHours: barbershop.workingHours || '09:00-18:00',
        timezone: barbershop.timezone || 'America/Sao_Paulo',
      });
    }
    setWizardStep(1);
    setShowWizard(true);
  };

  const isLoading = isSummaryLoading || isAppointmentsLoading;

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-amber-500">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-4 text-red-500">
        <AlertCircle className="h-12 w-12" />
        <h3 className="text-lg font-bold">Erro ao carregar dados do Dashboard</h3>
        <p className="text-sm text-zinc-400">Verifique se o backend está ativo ou tente novamente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertas Operacionais de Infraestrutura */}
      <div className="space-y-2">
        {!isWhatsappConnected && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400 flex items-start gap-3 shadow-md">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">WhatsApp Desconectado:</strong>
              <p className="text-zinc-400 mt-0.5">
                Nenhum número de WhatsApp está pareado. Escaneie o QR Code nas{' '}
                <Link href="/settings" className="text-amber-500 hover:underline font-semibold">
                  Configurações
                </Link>{' '}
                para que a recepcionista IA possa atender os clientes.
              </p>
            </div>
          </div>
        )}

        {health?.redis === 'error' && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-400 flex items-start gap-3 shadow-md">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Serviço de Fila (Redis) Indisponível:</strong>
              <p className="text-zinc-400 mt-0.5">
                O banco de agendamentos em segundo plano oscilou. O sistema operará em modo de contingência local.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Visão geral e status operacional do negócio.</p>
        </div>

        {/* AI Status Widget */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center gap-3">
          <div className="rounded-full bg-zinc-900 p-2 text-amber-500">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-zinc-500 block uppercase tracking-wider">
              Recepcionista IA
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  aiStatus === 'online'
                    ? 'bg-emerald-500 animate-pulse'
                    : aiStatus === 'degraded'
                    ? 'bg-amber-500'
                    : 'bg-zinc-700'
                }`}
              />
              <span
                className={`text-xs font-bold ${
                  aiStatus === 'online'
                    ? 'text-emerald-400'
                    : aiStatus === 'degraded'
                    ? 'text-amber-400'
                    : 'text-zinc-500'
                }`}
              >
                {aiStatus === 'online' && 'Online'}
                {aiStatus === 'degraded' && 'Degradado (OpenAI)'}
                {aiStatus === 'offline' && 'Offline (WhatsApp)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna Esquerda: Métricas e Agenda */}
        <div className="lg:col-span-2 space-y-6">
          {/* Métricas Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Receita */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500">Faturamento Mês</span>
                <DollarSign className="h-4.5 w-4.5 text-amber-500" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-black text-white">
                  {formatCurrency(summary?.revenueMonth || 0)}
                </span>
                <p className="text-[10px] text-zinc-500 mt-1">Agendados ativos no mês</p>
              </div>
            </div>

            {/* Agendamentos */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500">Cortes Hoje</span>
                <Calendar className="h-4.5 w-4.5 text-amber-500" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-black text-white">{summary?.appointmentsToday || 0}</span>
                <p className="text-[10px] text-zinc-500 mt-1">Total de slots ativos de hoje</p>
              </div>
            </div>

            {/* Clientes */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500">Clientes Ativos</span>
                <Users className="h-4.5 w-4.5 text-amber-500" />
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-black text-white">{summary?.customers || 0}</span>
                <p className="text-[10px] text-zinc-500 mt-1">Inscritos e monitorados CRM</p>
              </div>
            </div>
          </div>

          {/* Quick Actions (Ações Rápidas) */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-white mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link
                href="/appointments"
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-850 bg-zinc-900/40 hover:bg-zinc-900 hover:border-amber-500/50 text-center gap-2 transition-all group"
              >
                <Calendar className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-zinc-300">Novo Agendamento</span>
              </Link>
              <Link
                href="/customers"
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-850 bg-zinc-900/40 hover:bg-zinc-900 hover:border-amber-500/50 text-center gap-2 transition-all group"
              >
                <Users className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-zinc-300">Visualizar Clientes</span>
              </Link>
              <Link
                href="/barbers"
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-850 bg-zinc-900/40 hover:bg-zinc-900 hover:border-amber-500/50 text-center gap-2 transition-all group"
              >
                <Scissors className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-zinc-300">Adicionar Barbeiro</span>
              </Link>
              <Link
                href="/services"
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-zinc-850 bg-zinc-900/40 hover:bg-zinc-900 hover:border-amber-500/50 text-center gap-2 transition-all group"
              >
                <Briefcase className="h-5 w-5 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-zinc-300">Adicionar Serviço</span>
              </Link>
            </div>
          </div>

          {/* Próximos Agendamentos */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Próximos Agendamentos</h3>
              <Link href="/appointments" className="text-xs text-amber-500 hover:underline flex items-center gap-1 font-semibold">
                Ver agenda <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {appointmentsData?.items && appointmentsData.items.length > 0 ? (
                appointmentsData.items.slice(0, 4).map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between p-3.5 rounded-lg bg-zinc-900 border border-zinc-850 flex-col sm:flex-row gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{appt.client?.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{appt.service?.name} • {appt.barber?.name}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-bold text-amber-500">{formatDate(appt.dateTime)}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{formatTime(appt.dateTime)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-zinc-600 text-xs border border-dashed border-zinc-850 rounded-lg">
                  Nenhum agendamento futuro marcado.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna Direita: Setup Checklist */}
        <div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-md flex flex-col justify-between h-full">
            <div>
              <h3 className="text-md font-bold text-white mb-1">Configuração da Barbearia</h3>
              <p className="text-xs text-zinc-500 mb-5">
                Complete os passos abaixo para liberar sua recepcionista automatizada.
              </p>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-2">
                  <span>Progresso do setup</span>
                  <span className="text-amber-500">{completedStepsCount} de {checklistItems.length} concluído</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-500"
                    style={{ width: `${(completedStepsCount / checklistItems.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Checklist items */}
              <div className="space-y-4">
                {checklistItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {item.done ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-zinc-800 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className={`text-xs ${item.done ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                        {item.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch CTA */}
            <div className="border-t border-zinc-850 pt-5 mt-6">
              {isSetupComplete ? (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3.5 text-center">
                  <CheckCircle className="h-6 w-6 text-emerald-400 mx-auto mb-1.5" />
                  <h4 className="text-xs font-bold text-emerald-400">Tudo Pronto para Operar!</h4>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Seu sistema BarberAI está completamente configurado e a IA está respondendo no WhatsApp.
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleStartWizard}
                  className="w-full rounded-lg bg-amber-500 py-3 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Iniciar Configuração Assistida
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-6">
            {/* Header Wizard */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Bot className="h-5 w-5 text-amber-500" />
                Configuração Assistida (Passo {wizardStep} de 5)
              </h3>
              <button
                onClick={() => setShowWizard(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-semibold"
              >
                Sair
              </button>
            </div>

            {/* Step Content */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">Passo 1: Dados da Barbearia</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Mantenha seu perfil comercial completo.</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase">Nome Comercial</label>
                    <input
                      type="text"
                      value={shopForm.name}
                      onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                      className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase">Telefone</label>
                    <input
                      type="text"
                      value={shopForm.phone}
                      onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                      placeholder="Ex: 5511999999999"
                      className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase">E-mail</label>
                    <input
                      type="text"
                      value={shopForm.email}
                      onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })}
                      className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase">Endereço Completo</label>
                    <input
                      type="text"
                      value={shopForm.address}
                      onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                      className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => updateShopMutation.mutate(shopForm)}
                    disabled={updateShopMutation.isPending || !shopForm.name || !shopForm.phone}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
                  >
                    {updateShopMutation.isPending ? 'Salvando...' : 'Avançar'}
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">Passo 2: Cadastro de Serviços</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Cadastre o seu primeiro serviço de corte ou barba.</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase">Nome do Serviço</label>
                    <input
                      type="text"
                      placeholder="Corte Degradê, Barba Completa..."
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                      className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase">Descrição</label>
                    <input
                      type="text"
                      placeholder="Corte moderno com finalização..."
                      value={serviceForm.description}
                      onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                      className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-400 uppercase">Preço (R$)</label>
                      <input
                        type="number"
                        value={serviceForm.price}
                        onChange={(e) => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) })}
                        className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-400 uppercase">Duração (Minutos)</label>
                      <input
                        type="number"
                        value={serviceForm.durationMinutes}
                        onChange={(e) => setServiceForm({ ...serviceForm, durationMinutes: parseInt(e.target.value) })}
                        className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-between gap-2 pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => createServiceMutation.mutate(serviceForm)}
                    disabled={createServiceMutation.isPending || !serviceForm.name}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
                  >
                    {createServiceMutation.isPending ? 'Salvando...' : 'Avançar'}
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">Passo 3: Cadastro de Barbeiros</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Cadastre o profissional que atenderá seus clientes.</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase">Nome do Barbeiro</label>
                    <input
                      type="text"
                      placeholder="Ex: João da Silva"
                      value={barberForm.name}
                      onChange={(e) => setBarberForm({ ...barberForm, name: e.target.value })}
                      className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase">Especialidade</label>
                    <input
                      type="text"
                      placeholder="Ex: Barbas Clássicas, Cortes Degradê..."
                      value={barberForm.specialty}
                      onChange={(e) => setBarberForm({ ...barberForm, specialty: e.target.value })}
                      className="w-full rounded-lg bg-zinc-900 py-2 px-3 text-xs text-zinc-100 border border-zinc-800 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-between gap-2 pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => createBarberMutation.mutate(barberForm)}
                    disabled={createBarberMutation.isPending || !barberForm.name}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50"
                  >
                    {createBarberMutation.isPending ? 'Salvando...' : 'Avançar'}
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">Passo 4: Conexão WhatsApp</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Sincronize o canal WhatsApp para agendamentos por IA.</p>
                </div>
                <div className="flex flex-col items-center justify-center p-4 border border-dashed border-zinc-850 rounded-lg bg-zinc-900/10">
                  {isWhatsappConnected ? (
                    <div className="text-center py-4">
                      <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2 animate-bounce" />
                      <p className="text-xs font-bold text-emerald-400">WhatsApp Conectado com Sucesso!</p>
                      <p className="text-[10px] text-zinc-500 mt-1">Sua instância está ativa e respondendo.</p>
                    </div>
                  ) : (
                    <div className="text-center py-4 flex flex-col items-center">
                      {instances[0]?.qrCode ? (
                        <>
                          <div className="bg-white p-2.5 rounded-lg mb-2 shadow-md">
                            <img src={instances[0].qrCode} alt="WhatsApp QR Code Connection" className="h-40 w-40" />
                          </div>
                          <p className="text-[10px] text-zinc-400 max-w-xs font-medium">
                            Escaneie o QR Code no seu aplicativo WhatsApp. O sistema avançará automaticamente ao parear.
                          </p>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-zinc-500">
                          <Smartphone className="h-10 w-10 text-zinc-800 mb-2" />
                          <p className="text-xs font-semibold">QR Code não disponível</p>
                          <p className="text-[10px] text-zinc-650 mt-1 max-w-[200px]">
                            Consulte as configurações do WhatsApp para carregar a instância.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-between gap-2 pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => setWizardStep(3)}
                    className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => setWizardStep(5)}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors"
                  >
                    Avançar
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3 animate-pulse" />
                  <h4 className="text-lg font-bold text-white">Parabéns! Setup Concluído!</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    Sua barbearia está configurada. A recepcionista IA começará a receber, responder e agendar seus clientes pelo WhatsApp automaticamente.
                  </p>
                </div>
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
                      setShowWizard(false);
                    }}
                    className="rounded-lg bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition-colors"
                  >
                    Começar a Operar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
