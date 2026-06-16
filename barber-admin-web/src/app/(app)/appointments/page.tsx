'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api/axios';
import { formatDate, formatTime, formatCurrency, cn } from '../../../lib/utils';
import {
  Calendar as CalendarIcon,
  User,
  Clock,
  Plus,
  X,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
} from 'lucide-react';

interface Barber {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

interface Client {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  dateTime: string;
  status: string;
  clientId: string;
  client: { name: string; phone: string };
  service: { name: string; price: number };
  barber: { name: string };
}

interface AppointmentsResponse {
  items: Appointment[];
  total: number;
}

const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  
  // Estados de Filtros
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Estados de Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);

  // Estados de Formulário
  const [formData, setFormData] = useState({
    clientId: '',
    barberId: '',
    serviceId: '',
    dateTime: '',
    notes: '',
  });

  const [rescheduleDateTime, setRescheduleDateTime] = useState('');

  // 1. Queries
  const { data: appointmentsData, isLoading: isApptsLoading } = useQuery<AppointmentsResponse>({
    queryKey: ['appointments', selectedDate, selectedBarberId, selectedStatus],
    queryFn: async () => {
      const params: any = { date: selectedDate };
      if (selectedBarberId) params.barberId = selectedBarberId;
      if (selectedStatus) params.status = selectedStatus;
      const res = await api.get('/appointments', { params });
      return res.data;
    },
  });

  const { data: barbers } = useQuery<Barber[]>({
    queryKey: ['barbers'],
    queryFn: async () => {
      const res = await api.get('/barbers');
      return res.data;
    },
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await api.get('/services');
      return res.data;
    },
  });

  const { data: clientsData } = useQuery<{ items: Client[] }>({
    queryKey: ['clientsList'],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { limit: 100 } });
      return res.data;
    },
  });

  // 2. Mutações
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await api.post('/appointments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, dateTime }: { id: string; dateTime: string }) => {
      await api.patch(`/appointments/${id}`, { dateTime });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsRescheduleModalOpen(false);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/appointments/${id}/status`, { status: 'CONFIRMED' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const resetForm = () => {
    setFormData({
      clientId: '',
      barberId: '',
      serviceId: '',
      dateTime: '',
      notes: '',
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeAppointment) {
      rescheduleMutation.mutate({
        id: activeAppointment.id,
        dateTime: rescheduleDateTime,
      });
    }
  };

  // Mapear os agendamentos nos horários do dia
  const appointmentMap = new Map<string, Appointment>();
  if (appointmentsData?.items) {
    appointmentsData.items.forEach((appt) => {
      // dateTime costuma vir como "2026-06-16T14:00:00.000Z"
      const dateObj = new Date(appt.dateTime);
      const hourStr = String(dateObj.getUTCHours()).padStart(2, '0') + ':00';
      appointmentMap.set(hourStr, appt);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">Agenda</h1>
          <p className="text-zinc-400">Gerencie os horários operacionais e agendamentos.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          <Plus className="h-5 w-5" />
          Novo Agendamento
        </button>
      </div>

      {/* Filtros */}
      <div className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Data</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Profissional</label>
          <select
            value={selectedBarberId}
            onChange={(e) => setSelectedBarberId(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">Todos os barbeiros</option>
            {barbers?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">Todos os status</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="PENDING">Pendente</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Grid de Agenda (Google Calendar Style) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-amber-500" />
            Agenda para o dia {formatDate(selectedDate)}
          </h3>
        </div>

        {isApptsLoading ? (
          <div className="flex h-64 items-center justify-center text-amber-500">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {HOURS.map((hour) => {
              const appt = appointmentMap.get(hour);
              return (
                <div key={hour} className="flex min-h-[70px] hover:bg-zinc-900/20 transition-colors">
                  {/* Hora */}
                  <div className="w-24 px-6 py-4 border-r border-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-400">
                    <Clock className="mr-1.5 h-4 w-4 text-zinc-500" />
                    {hour}
                  </div>

                  {/* Agendamento */}
                  <div className="flex-1 p-4 flex items-center justify-between">
                    {appt ? (
                      <div className="flex-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{appt.client?.name}</span>
                            <span
                              className={cn(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                                appt.status === 'CONFIRMED'
                                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                                  : appt.status === 'PENDING'
                                  ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                              )}
                            >
                              {appt.status === 'CONFIRMED' ? 'Confirmado' : appt.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">
                            {appt.service?.name} ({formatCurrency(appt.service?.price)}) • Barbeiro: {appt.barber?.name}
                          </p>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-2">
                          {appt.status === 'PENDING' && (
                            <button
                              onClick={() => confirmMutation.mutate(appt.id)}
                              className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 hover:bg-emerald-900 transition-colors border border-emerald-800"
                              title="Confirmar Agendamento"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          {appt.status !== 'CANCELLED' && (
                            <>
                              <button
                                onClick={() => {
                                  setActiveAppointment(appt);
                                  setRescheduleDateTime(appt.dateTime.split('T')[0] + ' 10:00');
                                  setIsRescheduleModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-amber-950 text-amber-400 hover:bg-amber-900 transition-colors border border-amber-800"
                                title="Reagendar"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Tem certeza que deseja cancelar este agendamento?')) {
                                    cancelMutation.mutate(appt.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-red-950 text-red-400 hover:bg-red-900 transition-colors border border-red-800"
                                title="Cancelar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600 font-medium">Horário Livre</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Criar Agendamento */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Novo Agendamento</h3>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Cliente</label>
                <select
                  required
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Selecione o cliente</option>
                  {clientsData?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Barbeiro</label>
                <select
                  required
                  value={formData.barberId}
                  onChange={(e) => setFormData({ ...formData, barberId: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Selecione o barbeiro</option>
                  {barbers?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Serviço</label>
                <select
                  required
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Selecione o serviço</option>
                  {services?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatCurrency(s.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Data & Hora (AAAA-MM-DD HH:MM)</label>
                <input
                  type="text"
                  required
                  placeholder={`${selectedDate} 14:00`}
                  value={formData.dateTime}
                  onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Observações (Opcional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none h-20 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors flex items-center justify-center"
              >
                {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar Agendamento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reagendar */}
      {isRescheduleModalOpen && activeAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsRescheduleModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Reagendar Agendamento</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Cliente: {activeAppointment.client?.name} <br />
              Atual: {formatDate(activeAppointment.dateTime)} às {formatTime(activeAppointment.dateTime)}
            </p>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Nova Data & Hora (AAAA-MM-DD HH:MM)</label>
                <input
                  type="text"
                  required
                  placeholder="2026-06-16 15:00"
                  value={rescheduleDateTime}
                  onChange={(e) => setRescheduleDateTime(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={rescheduleMutation.isPending}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors flex items-center justify-center"
              >
                {rescheduleMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar Alteração'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
