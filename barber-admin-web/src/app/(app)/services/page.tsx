'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api/axios';
import { formatCurrency } from '../../../lib/utils';
import {
  Briefcase,
  Plus,
  X,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Clock,
  Tag,
} from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  active: boolean;
}

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeService, setActiveService] = useState<Service | null>(null);

  // Estados de Formulário
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [active, setActive] = useState(true);

  // Queries
  const { data: services, isLoading, error } = useQuery<Service[]>({
    queryKey: ['servicesList'],
    queryFn: async () => {
      const res = await api.get('/services');
      return res.data;
    },
  });

  // Mutações
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('/services', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicesList'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await api.put(`/services/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicesList'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicesList'] });
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice(0);
    setDurationMinutes(30);
    setActive(true);
    setActiveService(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service: Service) => {
    setActiveService(service);
    setName(service.name);
    setDescription(service.description || '');
    setPrice(service.price);
    setDurationMinutes(service.durationMinutes);
    setActive(service.active);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name,
      description: description || null,
      price: parseFloat(price.toString()),
      durationMinutes: parseInt(durationMinutes.toString()),
      active,
    };

    if (activeService) {
      updateMutation.mutate({ id: activeService.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Serviços</h1>
          <p className="text-zinc-400">Gerencie o cardápio de cortes, tratamentos e serviços da barbearia.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          <Plus className="h-5 w-5" />
          Adicionar Serviço
        </button>
      </div>

      {/* Grid de Serviços */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-amber-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-4 text-red-500">
          <AlertCircle className="h-10 w-10" />
          <h3 className="text-lg font-bold">Erro ao carregar serviços</h3>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services && services.length > 0 ? (
            services.map((service) => (
              <div
                key={service.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between shadow-sm relative overflow-hidden"
              >
                {/* Status Indicator */}
                <span
                  className={`absolute top-4 right-4 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    service.active
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {service.active ? 'Ativo' : 'Inativo'}
                </span>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-500 shrink-0">
                      <Tag className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base truncate max-w-[150px]">{service.name}</h3>
                      <span className="text-2xl font-bold text-emerald-400 block mt-1">
                        {formatCurrency(service.price)}
                      </span>
                    </div>
                  </div>

                  {service.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 h-8">{service.description}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Duração: {service.durationMinutes} minutos</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-zinc-900 pt-4 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEditModal(service)}
                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:text-white transition-colors text-zinc-400"
                    title="Editar Serviço"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja remover o serviço ${service.name}?`)) {
                        deleteMutation.mutate(service.id);
                      }
                    }}
                    className="p-2 rounded-lg bg-red-950/20 border border-red-900/40 hover:bg-red-950 hover:text-red-400 transition-colors text-red-500"
                    title="Remover Serviço"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-16 text-zinc-600 bg-zinc-950 border border-zinc-800 rounded-xl">
              <Briefcase className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
              Nenhum serviço catalogado.
            </div>
          )}
        </div>
      )}

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-6">
              {activeService ? `Editar Serviço: ${activeService.name}` : 'Adicionar Novo Serviço'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Nome do Serviço</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  placeholder="Ex: Corte Degradê Social"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none h-20 resize-none"
                  placeholder="Ex: Lavagem com shampoo especial e finalização com pomada modeladora"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Preço em R$</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Ex: 50.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Duração (Minutos)</label>
                  <input
                    type="number"
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Ex: 30"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-400">Serviço Disponível</span>
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

              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors flex items-center justify-center"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : activeService ? (
                  'Salvar Alterações'
                ) : (
                  'Cadastrar Serviço'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
