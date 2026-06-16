'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api/axios';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { Search, User, Phone, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  phone: string;
  customerProfile?: {
    id: string;
    totalVisits: number;
    lifetimeValue: number;
    lastVisit: string | null;
  };
}

interface CustomersResponse {
  items: Customer[];
  total: number;
  pages: number;
}

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFrequency, setSelectedFrequency] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ['customers', searchTerm, selectedFrequency, page],
    queryFn: async () => {
      const params: any = {
        page,
        limit: 10,
      };
      if (searchTerm) {
        if (searchTerm.match(/^\d+$/)) {
          params.phone = searchTerm;
        } else {
          params.name = searchTerm;
        }
      }
      if (selectedFrequency) {
        params.frequency = selectedFrequency;
      }
      const res = await api.get('/customers', { params });
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Clientes</h1>
        <p className="text-zinc-400">Gerenciamento de clientes e perfis de consumo CRM.</p>
      </div>

      {/* Busca e Filtros */}
      <div className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <select
            value={selectedFrequency}
            onChange={(e) => {
              setSelectedFrequency(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="">Frequência de Visitas (Todos)</option>
            <option value="VIP">VIP (Mais de 10 visitas)</option>
            <option value="RECURRENT">Recorrente (3 a 10 visitas)</option>
            <option value="LOW">Esporádico (Menos de 3 visitas)</option>
          </select>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-amber-500">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-zinc-300">
              <thead className="bg-zinc-900 text-xs font-semibold uppercase text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Telefone</th>
                  <th className="px-6 py-4">Visitas</th>
                  <th className="px-6 py-4">Última Visita</th>
                  <th className="px-6 py-4">LTV</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {data?.items && data.items.length > 0 ? (
                  data.items.map((client) => (
                    <tr key={client.id} className="hover:bg-zinc-900/20">
                      <td className="px-6 py-4 font-semibold text-white flex items-center gap-2">
                        <User className="h-4 w-4 text-zinc-500" />
                        {client.name}
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-zinc-600" />
                          {client.phone}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center md:text-left">
                        {client.customerProfile?.totalVisits || 0}
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                          {client.customerProfile?.lastVisit
                            ? formatDate(client.customerProfile.lastVisit)
                            : 'Nunca'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-400">
                        {formatCurrency(client.customerProfile?.lifetimeValue || 0)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/customers/${client.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:text-amber-400"
                        >
                          Ver Perfil <ArrowRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-zinc-600">
                      Nenhum cliente cadastrado ou correspondente aos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-zinc-500 font-medium">
            Página {page} de {data.pages}
          </span>
          <button
            disabled={page === data.pages}
            onClick={() => setPage(page + 1)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
