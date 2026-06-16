'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../../lib/api/axios';
import { formatCurrency, formatDate, formatTime } from '../../../../lib/utils';
import {
  User,
  Phone,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  aiEnabled: boolean;
  customerProfile?: {
    totalVisits: number;
    lifetimeValue: number;
    averageVisitInterval: number;
    averageTicket: number;
    lastVisit?: string;
    favoriteBarber?: { name: string };
    favoriteService?: { name: string };
  };
  appointments: Array<{
    id: string;
    dateTime: string;
    status: string;
    service: { name: string; price: number };
    barber: { name: string };
  }>;
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  // Query de dados do cliente específico
  const { data: customer, isLoading, error } = useQuery<CustomerDetail>({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await api.get(`/customers/${id}`);
      return res.data;
    },
  });

  // Mutação para alternar status da IA
  const toggleAIMutation = useMutation({
    mutationFn: async ({ phone, aiEnabled }: { phone: string; aiEnabled: boolean }) => {
      await api.patch(`/whatsapp/client/${phone}/toggle-ai`, { aiEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-amber-500">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-4 text-red-500">
        <AlertCircle className="h-12 w-12" />
        <h3 className="text-lg font-bold">Erro ao carregar perfil do cliente</h3>
        <p className="text-sm text-zinc-400">Verifique se o cliente existe ou tente novamente.</p>
        <Link href="/customers" className="text-xs text-amber-500 hover:underline">
          Voltar para listagem
        </Link>
      </div>
    );
  }

  const totalVisits = customer.customerProfile?.totalVisits || 0;
  const lastVisit = customer.customerProfile?.lastVisit;

  // Calcula se o cliente está inativo (mais de 30 dias desde o último atendimento)
  let isInactive = false;
  if (lastVisit) {
    const daysSince = (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) {
      isInactive = true;
    }
  }

  const getTags = () => {
    const tags = [];
    if (isInactive) {
      tags.push({ label: 'Inativo', className: 'bg-red-500/10 text-red-400 border-red-500/20' });
    }
    if (totalVisits > 10) {
      tags.push({ label: 'VIP', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' });
    } else if (totalVisits >= 3) {
      tags.push({ label: 'Recorrente', className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' });
    } else {
      tags.push({ label: 'Novo Cliente', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' });
    }
    return tags;
  };

  return (
    <div className="space-y-8">
      {/* Back navigation */}
      <div>
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Voltar para Clientes
        </Link>
      </div>

      {/* Header Info */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-zinc-800 flex items-center justify-center text-2xl font-bold text-amber-500 border border-zinc-700">
            {customer.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">{customer.name}</h1>
              <div className="flex items-center gap-1.5">
                {getTags().map((tag, idx) => (
                  <span key={idx} className={`rounded px-2 py-0.5 text-[10px] font-semibold border ${tag.className}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-1">
              <Phone className="h-4 w-4 text-zinc-600" />
              {customer.phone}
            </p>
          </div>
        </div>

        {/* AI Receptionist Control */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800/80">
          <div>
            <h4 className="text-sm font-semibold text-white">Recepcionista IA</h4>
            <p className="text-xs text-zinc-500">Permitir que a IA responda este cliente no WhatsApp.</p>
          </div>
          <button
            onClick={() =>
              toggleAIMutation.mutate({
                phone: customer.phone,
                aiEnabled: !customer.aiEnabled,
              })
            }
            disabled={toggleAIMutation.isPending}
            className="text-amber-500 disabled:opacity-50"
          >
            {customer.aiEnabled ? (
              <ToggleRight className="h-10 w-10 text-amber-500" />
            ) : (
              <ToggleLeft className="h-10 w-10 text-zinc-600" />
            )}
          </button>
        </div>
      </div>

      {/* CRM Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* LTV */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center justify-between text-zinc-400 text-sm font-medium">
            <span>Lifetime Value (LTV)</span>
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </div>
          <h3 className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(customer.customerProfile?.lifetimeValue || 0)}
          </h3>
        </div>

        {/* Total Visitas */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center justify-between text-zinc-400 text-sm font-medium">
            <span>Total de Visitas</span>
            <TrendingUp className="h-5 w-5 text-amber-500" />
          </div>
          <h3 className="mt-2 text-2xl font-bold text-white">
            {customer.customerProfile?.totalVisits || 0}
          </h3>
        </div>

        {/* Barbeiro Favorito */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center justify-between text-zinc-400 text-sm font-medium">
            <span>Barbeiro Favorito</span>
            <User className="h-5 w-5 text-amber-500" />
          </div>
          <h3 className="mt-2 text-lg font-bold text-white truncate">
            {customer.customerProfile?.favoriteBarber?.name || 'Não definido'}
          </h3>
        </div>

        {/* Serviço Favorito */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center justify-between text-zinc-400 text-sm font-medium">
            <span>Serviço Favorito</span>
            <Award className="h-5 w-5 text-amber-500" />
          </div>
          <h3 className="mt-2 text-lg font-bold text-white truncate">
            {customer.customerProfile?.favoriteService?.name || 'Não definido'}
          </h3>
        </div>
      </div>

      {/* Histórico de Agendamentos */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold text-white">Histórico de Visitas & Agendamentos</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/50 text-xs font-semibold uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Horário</th>
                <th className="px-6 py-3">Serviço</th>
                <th className="px-6 py-3">Barbeiro</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {customer.appointments && customer.appointments.length > 0 ? (
                customer.appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-zinc-900/20">
                    <td className="px-6 py-4 text-white font-medium">{formatDate(appt.dateTime)}</td>
                    <td className="px-6 py-4 text-zinc-400">{formatTime(appt.dateTime)}</td>
                    <td className="px-6 py-4 font-semibold text-white">{appt.service?.name}</td>
                    <td className="px-6 py-4 text-zinc-400">{appt.barber?.name}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          appt.status === 'CONFIRMED'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                            : appt.status === 'PENDING'
                            ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {appt.status === 'CONFIRMED' ? 'Confirmado' : appt.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-zinc-600">
                    Nenhum agendamento registrado para este cliente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
