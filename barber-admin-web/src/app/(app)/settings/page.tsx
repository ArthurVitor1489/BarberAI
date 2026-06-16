'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api/axios';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import {
  Settings,
  Phone,
  Mail,
  MapPin,
  Clock,
  Globe,
  QrCode,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Send,
  HelpCircle,
} from 'lucide-react';

// Form validation schema
const barbershopSchema = zod.object({
  name: zod.string().min(2, 'Nome deve conter pelo menos 2 caracteres'),
  phone: zod.string().min(8, 'Telefone inválido'),
  email: zod.string().email('E-mail inválido'),
  address: zod.string().min(5, 'Endereço deve conter pelo menos 5 caracteres'),
  workingHours: zod.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, 'Formato deve ser HH:MM-HH:MM'),
  timezone: zod.string().min(2, 'Timezone é obrigatório'),
});

type BarbershopFormValues = zod.infer<typeof barbershopSchema>;

interface Barbershop {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  address: string;
  workingHours: string;
  timezone: string;
}

interface WhatsAppInstance {
  id: string;
  instanceName: string;
  instanceId: string | null;
  status: 'CONNECTED' | 'DISCONNECTED';
  qrCode: string | null;
}

export default function SettingsPage() {
  const [testPhone, setTestPhone] = useState('');
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 1. Fetch Barbershop Settings
  const { data: barbershop, isLoading: isShopLoading } = useQuery<Barbershop>({
    queryKey: ['barbershop'],
    queryFn: async () => {
      const res = await api.get('/barbershop');
      return res.data;
    },
  });

  // 2. Fetch WhatsApp Instances
  const { data: instances = [], isLoading: isInstancesLoading } = useQuery<WhatsAppInstance[]>({
    queryKey: ['whatsapp-instances'],
    queryFn: async () => {
      const res = await api.get('/whatsapp/instances');
      return res.data;
    },
    refetchInterval: (data) => {
      // Poll instances every 5s if any instance is disconnected to watch for connection QR scanning
      const anyDisconnected = data?.state?.data?.some((inst: any) => inst.status === 'DISCONNECTED');
      return anyDisconnected ? 5000 : 30000;
    },
  });

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BarbershopFormValues>({
    resolver: zodResolver(barbershopSchema),
    values: barbershop
      ? {
          name: barbershop.name,
          phone: barbershop.phone,
          email: barbershop.email,
          address: barbershop.address || '',
          workingHours: barbershop.workingHours || '09:00-18:00',
          timezone: barbershop.timezone || 'America/Sao_Paulo',
        }
      : undefined,
  });

  // Mutations
  const updateShopMutation = useMutation({
    mutationFn: async (values: BarbershopFormValues) => {
      return api.put('/barbershop', values);
    },
    onSuccess: () => {
      setSaveSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['barbershop'] });
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const testSendMutation = useMutation({
    mutationFn: async (phone: string) => {
      return api.post('/conversations/test-send', { phone });
    },
    onSuccess: () => {
      setTestSuccess('Mensagem de teste enviada com sucesso! Verifique seu WhatsApp.');
      setTestPhone('');
      setTestError(null);
      setTimeout(() => setTestSuccess(null), 5000);
    },
    onError: (err: any) => {
      setTestError(err.response?.data?.message || 'Falha ao enviar mensagem de teste.');
      setTestSuccess(null);
    },
  });

  const onSubmit = (values: BarbershopFormValues) => {
    updateShopMutation.mutate(values);
  };

  const handleTestSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim() || testSendMutation.isPending) return;
    testSendMutation.mutate(testPhone);
  };

  if (isShopLoading) {
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
          <Settings className="h-6 w-6 text-amber-500" />
          Configurações do Sistema
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gerencie os dados da sua barbearia, visualize o status das conexões do WhatsApp e teste a integração operacional.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Form Dados da Barbearia */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-md">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              Perfil da Barbearia
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Nome da Barbearia</label>
                  <input
                    type="text"
                    {...register('name')}
                    className="w-full rounded-lg bg-zinc-900 py-2.5 px-3.5 text-sm text-zinc-100 border border-zinc-800 focus:border-amber-500 focus:outline-none"
                  />
                  {errors.name && (
                    <p className="text-[11px] text-red-500 font-medium">{errors.name.message}</p>
                  )}
                </div>

                {/* Slug / Link (Read-Only) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Slug identificador (Link)</label>
                  <input
                    type="text"
                    disabled
                    value={barbershop?.slug || ''}
                    className="w-full rounded-lg bg-zinc-900/40 py-2.5 px-3.5 text-sm text-zinc-500 border border-zinc-850 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-zinc-600">
                    Utilizado internamente para roteamento multi-tenant.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Telefone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Telefone de Contato
                  </label>
                  <input
                    type="text"
                    {...register('phone')}
                    placeholder="Ex: 5511999999999"
                    className="w-full rounded-lg bg-zinc-900 py-2.5 px-3.5 text-sm text-zinc-100 border border-zinc-800 focus:border-amber-500 focus:outline-none"
                  />
                  {errors.phone && (
                    <p className="text-[11px] text-red-500 font-medium">{errors.phone.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <Mail className="h-3 w-3" /> E-mail Comercial
                  </label>
                  <input
                    type="text"
                    {...register('email')}
                    className="w-full rounded-lg bg-zinc-900 py-2.5 px-3.5 text-sm text-zinc-100 border border-zinc-800 focus:border-amber-500 focus:outline-none"
                  />
                  {errors.email && (
                    <p className="text-[11px] text-red-500 font-medium">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Endereço Completo
                </label>
                <input
                  type="text"
                  {...register('address')}
                  className="w-full rounded-lg bg-zinc-900 py-2.5 px-3.5 text-sm text-zinc-100 border border-zinc-800 focus:border-amber-500 focus:outline-none"
                />
                {errors.address && (
                  <p className="text-[11px] text-red-500 font-medium">{errors.address.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Horário de Funcionamento */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Horário de Funcionamento
                  </label>
                  <input
                    type="text"
                    {...register('workingHours')}
                    placeholder="Ex: 09:00-18:00"
                    className="w-full rounded-lg bg-zinc-900 py-2.5 px-3.5 text-sm text-zinc-100 border border-zinc-800 focus:border-amber-500 focus:outline-none"
                  />
                  {errors.workingHours && (
                    <p className="text-[11px] text-red-500 font-medium">{errors.workingHours.message}</p>
                  )}
                </div>

                {/* Timezone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Timezone (Fuso Horário)
                  </label>
                  <input
                    type="text"
                    {...register('timezone')}
                    className="w-full rounded-lg bg-zinc-900 py-2.5 px-3.5 text-sm text-zinc-100 border border-zinc-800 focus:border-amber-500 focus:outline-none"
                  />
                  {errors.timezone && (
                    <p className="text-[11px] text-red-500 font-medium">{errors.timezone.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                {saveSuccess && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mr-auto">
                    <CheckCircle className="h-4 w-4" /> Configurações salvas com sucesso!
                  </div>
                )}
                <button
                  type="submit"
                  disabled={updateShopMutation.isPending}
                  className="rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {updateShopMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>

          {/* Testar WhatsApp Module */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-md">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              Ferramenta de Teste: Disparar WhatsApp
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Use este recurso para verificar a comunicação com a API Evolution. Um cliente de teste será gerado e uma mensagem enviada.
            </p>
            <form onSubmit={handleTestSend} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Número de telefone (ex: 5511999999999)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="flex-1 rounded-lg bg-zinc-900 py-2.5 px-3.5 text-sm text-zinc-100 border border-zinc-800 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={testSendMutation.isPending || !testPhone.trim()}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {testSendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                ) : (
                  <Send className="h-4 w-4 text-amber-500" />
                )}
                Testar WhatsApp
              </button>
            </form>
            {testSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>{testSuccess}</span>
              </div>
            )}
            {testError && (
              <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{testError}</span>
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp Instances status */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-md flex flex-col h-full justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                Instância WhatsApp
              </h2>
              <p className="text-xs text-zinc-500 mb-4">
                Sincronize a recepcionista virtual com o celular da sua barbearia.
              </p>

              {isInstancesLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                </div>
              ) : instances.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-zinc-500">
                  <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold">Nenhuma instância WhatsApp vinculada</p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Fale com o suporte técnico para ativar a sua instância no sistema.
                  </p>
                </div>
              ) : (
                instances.map((inst) => {
                  const isConnected = inst.status === 'CONNECTED';
                  return (
                    <div key={inst.id} className="space-y-4">
                      {/* Connection status badge */}
                      <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 border border-zinc-800">
                        <span className="text-xs font-semibold text-zinc-300 truncate">
                          {inst.instanceName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                            }`}
                          />
                          <span
                            className={`text-xs font-semibold ${
                              isConnected ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isConnected ? 'Conectado' : 'Desconectado'}
                          </span>
                        </div>
                      </div>

                      {/* Connection QR Code */}
                      {!isConnected && (
                        <div className="flex flex-col items-center justify-center p-4 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/20">
                          {inst.qrCode ? (
                            <>
                              <div className="bg-white p-3 rounded-lg mb-2">
                                <img
                                  src={inst.qrCode}
                                  alt="WhatsApp QR Code Connection"
                                  className="h-44 w-44 object-contain"
                                />
                              </div>
                              <p className="text-[11px] text-zinc-400 text-center font-medium flex items-center gap-1">
                                <QrCode className="h-3.5 w-3.5 text-amber-500" />
                                Escaneie este QR Code para conectar.
                              </p>
                              <p className="text-[9px] text-zinc-600 text-center mt-0.5">
                                A tela será atualizada automaticamente após a conexão.
                              </p>
                            </>
                          ) : (
                            <div className="py-6 text-center text-zinc-500 flex flex-col items-center">
                              <HelpCircle className="h-8 w-8 text-zinc-700 mb-2 animate-bounce" />
                              <p className="text-xs font-semibold">QR Code pendente</p>
                              <p className="text-[10px] text-zinc-600 max-w-[180px] mt-1">
                                Aguardando o servidor carregar a instância.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {isConnected && (
                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-4 text-center">
                          <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                          <h4 className="text-xs font-bold text-emerald-400">IA operacional e ativa!</h4>
                          <p className="text-[10px] text-zinc-500 mt-1 max-w-[200px] mx-auto">
                            Seu canal está sincronizado. Mensagens de clientes serão agendadas automaticamente.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-zinc-800 pt-4 mt-4 text-[10px] text-zinc-500 text-center flex items-center justify-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-zinc-600" />
              <span>Conexão direta segura com a API Evolution.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
