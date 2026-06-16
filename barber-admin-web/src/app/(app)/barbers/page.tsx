'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api/axios';
import {
  Scissors,
  Plus,
  X,
  Edit,
  Trash2,
  Check,
  User,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface WorkingHour {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Barber {
  id: string;
  name: string;
  specialty: string;
  photo?: string;
  active: boolean;
  workingHours?: WorkingHour[];
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export default function BarbersPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeBarber, setActiveBarber] = useState<Barber | null>(null);

  // Estados de Formulário
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [photo, setPhoto] = useState('');
  const [active, setActive] = useState(true);
  const [selectedHours, setSelectedHours] = useState<Record<number, { checked: boolean; startTime: string; endTime: string }>>(
    Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((day) => [
        day,
        { checked: true, startTime: '09:00', endTime: '18:00' },
      ])
    )
  );

  // Queries
  const { data: barbers, isLoading, error } = useQuery<Barber[]>({
    queryKey: ['barbersList'],
    queryFn: async () => {
      const res = await api.get('/barbers');
      return res.data;
    },
  });

  // Mutações
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('/barbers', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barbersList'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await api.put(`/barbers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barbersList'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/barbers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barbersList'] });
    },
  });

  const resetForm = () => {
    setName('');
    setSpecialty('');
    setPhoto('');
    setActive(true);
    setActiveBarber(null);
    setSelectedHours(
      Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((day) => [
          day,
          { checked: true, startTime: '09:00', endTime: '18:00' },
        ])
      )
    );
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (barber: Barber) => {
    setActiveBarber(barber);
    setName(barber.name);
    setSpecialty(barber.specialty);
    setPhoto(barber.photo || '');
    setActive(barber.active);
    
    // Sincroniza horários operacionais existentes
    const hoursState = Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((day) => [
        day,
        { checked: false, startTime: '09:00', endTime: '18:00' },
      ])
    );

    if (barber.workingHours) {
      barber.workingHours.forEach((wh) => {
        hoursState[wh.dayOfWeek] = {
          checked: true,
          startTime: wh.startTime,
          endTime: wh.endTime,
        };
      });
    }

    setSelectedHours(hoursState);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const whData = Object.entries(selectedHours)
      .filter(([_, value]) => value.checked)
      .map(([day, value]) => ({
        dayOfWeek: parseInt(day),
        startTime: value.startTime,
        endTime: value.endTime,
      }));

    const payload = {
      name,
      specialty,
      photo: photo || null,
      active,
      workingHours: whData,
    };

    if (activeBarber) {
      updateMutation.mutate({ id: activeBarber.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Barbeiros</h1>
          <p className="text-zinc-400">Gerencie a equipe de profissionais da barbearia.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          <Plus className="h-5 w-5" />
          Adicionar Barbeiro
        </button>
      </div>

      {/* Grid de Profissionais */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-amber-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-4 text-red-500">
          <AlertCircle className="h-10 w-10" />
          <h3 className="text-lg font-bold">Erro ao carregar barbeiros</h3>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {barbers && barbers.length > 0 ? (
            barbers.map((barber) => (
              <div key={barber.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between shadow-sm relative overflow-hidden">
                {/* Status Indicator */}
                <span className={`absolute top-4 right-4 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  barber.active 
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {barber.active ? 'Ativo' : 'Inativo'}
                </span>

                <div className="flex items-center gap-4">
                  {barber.photo ? (
                    <img src={barber.photo} alt={barber.name} className="h-14 w-14 rounded-full border border-zinc-800 object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                      <User className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white text-base">{barber.name}</h3>
                    <p className="text-xs text-amber-500 font-medium">{barber.specialty}</p>
                  </div>
                </div>

                <div className="mt-6 border-t border-zinc-900 pt-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEditModal(barber)}
                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:text-white transition-colors text-zinc-400"
                    title="Editar Informações"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja remover ${barber.name}?`)) {
                        deleteMutation.mutate(barber.id);
                      }
                    }}
                    className="p-2 rounded-lg bg-red-950/20 border border-red-900/40 hover:bg-red-950 hover:text-red-400 transition-colors text-red-500"
                    title="Remover Profissional"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-16 text-zinc-600 bg-zinc-950 border border-zinc-800 rounded-xl">
              <Scissors className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
              Nenhum barbeiro registrado.
            </div>
          )}
        </div>
      )}

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl relative my-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-6">
              {activeBarber ? `Editar Barbeiro: ${activeBarber.name}` : 'Adicionar Novo Barbeiro'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Ex: João Silva"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Especialidade</label>
                  <input
                    type="text"
                    required
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Ex: Barba & Degradê"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">URL da Foto (Opcional)</label>
                <input
                  type="text"
                  value={photo}
                  onChange={(e) => setPhoto(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-400">Barbeiro Ativo</span>
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className="text-amber-500 focus:outline-none"
                >
                  {active ? (
                    <ToggleRight className="h-9 w-9 text-amber-500" />
                  ) : (
                    <ToggleLeft className="h-9 w-9 text-zinc-700" />
                  )}
                </button>
              </div>

              {/* Escala de Horários */}
              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-bold text-white mb-3">Dias de Trabalho e Horários</h4>
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {DAYS_OF_WEEK.map((day) => {
                    const state = selectedHours[day.value] || { checked: false, startTime: '09:00', endTime: '18:00' };
                    return (
                      <div key={day.value} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded bg-zinc-900/50 border border-zinc-800/40">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                          <input
                            type="checkbox"
                            checked={state.checked}
                            onChange={(e) =>
                              setSelectedHours({
                                ...selectedHours,
                                [day.value]: { ...state, checked: e.target.checked },
                              })
                            }
                            className="rounded border-zinc-800 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                          />
                          {day.label}
                        </label>

                        {state.checked && (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={state.startTime}
                              onChange={(e) =>
                                setSelectedHours({
                                  ...selectedHours,
                                  [day.value]: { ...state, startTime: e.target.value },
                                })
                              }
                              className="w-16 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-center text-xs text-white"
                              placeholder="09:00"
                            />
                            <span className="text-zinc-500 text-xs">até</span>
                            <input
                              type="text"
                              value={state.endTime}
                              onChange={(e) =>
                                setSelectedHours({
                                  ...selectedHours,
                                  [day.value]: { ...state, endTime: e.target.value },
                                })
                              }
                              className="w-16 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-center text-xs text-white"
                              placeholder="18:00"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full py-2.5 mt-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors flex items-center justify-center"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : activeBarber ? (
                  'Salvar Alterações'
                ) : (
                  'Cadastrar Barbeiro'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
