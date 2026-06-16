'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api/axios';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MessageSquare,
  Search,
  User,
  Bot,
  Zap,
  Phone,
  Send,
  Loader2,
  AlertCircle,
  Menu,
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  phone: string;
  aiEnabled: boolean;
}

interface Conversation {
  id: string;
  customerId: string;
  client: Client;
  status: 'OPEN' | 'HUMAN_HANDOFF' | 'WAITING_CUSTOMER' | 'CLOSED';
  handoffActive: boolean;
  lastMessageAt: string;
  startedAt: string;
}

interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
}

export default function ConversationsPage() {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'human' | 'waiting' | 'closed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [mobileShowList, setMobileShowList] = useState(true);

  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const {
    data: conversations = [],
    isLoading: isConvsLoading,
    error: convsError,
  } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/conversations');
      return res.data;
    },
    refetchInterval: 5000, // Refresh list every 5s for realtime updates
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: isMessagesLoading } = useQuery<Message[]>({
    queryKey: ['messages', selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const res = await api.get(`/conversations/${selectedConvId}/messages`);
      return res.data;
    },
    enabled: !!selectedConvId,
    refetchInterval: selectedConvId ? 5000 : false, // Poll messages every 5s if active
  });

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  // Scroll to bottom when messages load/change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mutations
  const sendMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      return api.post(`/conversations/${id}/messages`, { text });
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const toggleHandoffMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      return api.patch(`/conversations/${id}/handoff`, { handoffActive: active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const toggleClientAIMutation = useMutation({
    mutationFn: async ({ phone, enabled }: { phone: string; enabled: boolean }) => {
      return api.patch(`/whatsapp/client/${phone}/toggle-ai`, { aiEnabled: enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return api.patch(`/conversations/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !messageText.trim() || sendMutation.isPending) return;
    sendMutation.mutate({ id: selectedConvId, text: messageText });
  };

  // Counters
  const counts = {
    all: conversations.length,
    open: conversations.filter((c) => c.status === 'OPEN').length,
    human: conversations.filter((c) => c.status === 'HUMAN_HANDOFF').length,
    waiting: conversations.filter((c) => c.status === 'WAITING_CUSTOMER').length,
    closed: conversations.filter((c) => c.status === 'CLOSED').length,
  };

  // Filter conversations
  const filteredConversations = conversations
    .filter((c) => {
      const nameMatch = c.client.name.toLowerCase().includes(searchTerm.toLowerCase());
      const phoneMatch = c.client.phone.includes(searchTerm);
      return nameMatch || phoneMatch;
    })
    .filter((c) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'open') return c.status === 'OPEN';
      if (activeTab === 'human') return c.status === 'HUMAN_HANDOFF';
      if (activeTab === 'waiting') return c.status === 'WAITING_CUSTOMER';
      if (activeTab === 'closed') return c.status === 'CLOSED';
      return true;
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">Recepcionista IA</span>;
      case 'HUMAN_HANDOFF':
        return <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">Humano Ativo</span>;
      case 'WAITING_CUSTOMER':
        return <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">Aguardando Cliente</span>;
      case 'CLOSED':
        return <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400 border border-zinc-700">Resolvido</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      {/* Coluna Esquerda: Listagem de Conversas */}
      <div
        className={`flex w-full flex-col border-r border-zinc-800 md:w-80 md:flex ${
          mobileShowList ? 'flex' : 'hidden'
        }`}
      >
        {/* Barra de Pesquisa */}
        <div className="p-4 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Pesquisar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 py-2 pl-9 pr-4 text-sm text-zinc-100 placeholder-zinc-500 border border-zinc-800 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Filtros / Abas com contadores */}
        <div className="flex overflow-x-auto border-b border-zinc-800 px-2 py-1 gap-1 scrollbar-none">
          {(['all', 'open', 'human', 'waiting', 'closed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-zinc-900 text-amber-500'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {tab === 'all' && 'Tudo'}
              {tab === 'open' && 'IA'}
              {tab === 'human' && 'Humano'}
              {tab === 'waiting' && 'Aguardando'}
              {tab === 'closed' && 'Arquivado'}
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
          {isConvsLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
              <p className="text-xs">Carregando conversas...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 p-4 text-center">
              <MessageSquare className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-sm font-semibold">Nenhuma conversa encontrada</p>
              <p className="text-xs text-zinc-600 mt-1">
                Clientes que entrarem em contato pelo WhatsApp aparecerão aqui.
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const formattedTime = formatDistanceToNow(new Date(conv.lastMessageAt), {
                addSuffix: true,
                locale: ptBR,
              });

              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConvId(conv.id);
                    setMobileShowList(false);
                  }}
                  className={`flex w-full flex-col gap-1.5 p-4 text-left transition-colors hover:bg-zinc-900/40 ${
                    isSelected ? 'bg-zinc-900/70 border-l-2 border-amber-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-100 truncate flex-1">
                      {conv.client.name}
                    </span>
                    <span className="text-[10px] text-zinc-500">{formattedTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-zinc-600" />
                    <span className="text-xs text-zinc-500">{conv.client.phone}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    {getStatusBadge(conv.status)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Coluna Direita: Detalhes da Conversa / Histórico */}
      <div
        className={`flex-1 flex flex-col bg-zinc-950/20 ${
          !mobileShowList ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedConv ? (
          <>
            {/* Header da Conversa */}
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileShowList(true)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-semibold text-zinc-300">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-100">{selectedConv.client.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Phone className="h-3 w-3" />
                    <span>{selectedConv.client.phone}</span>
                  </div>
                </div>
              </div>

              {/* Controles de Status (Handoff e IA) */}
              <div className="flex items-center gap-3">
                {/* AI receptor toggle */}
                <div className="hidden lg:flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 border border-zinc-800">
                  <Bot className={`h-4 w-4 ${selectedConv.client.aiEnabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className="text-xs font-medium text-zinc-300">Recepção IA</span>
                  <input
                    type="checkbox"
                    checked={selectedConv.client.aiEnabled}
                    onChange={(e) =>
                      toggleClientAIMutation.mutate({
                        phone: selectedConv.client.phone,
                        enabled: e.target.checked,
                      })
                    }
                    className="h-4 w-7 cursor-pointer appearance-none rounded-full bg-zinc-800 checked:bg-emerald-500 transition-colors relative before:content-[''] before:absolute before:h-3 before:w-3 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-3 before:transition-transform"
                  />
                </div>

                {/* Handoff Trigger Button */}
                {selectedConv.handoffActive ? (
                  <button
                    onClick={() => toggleHandoffMutation.mutate({ id: selectedConv.id, active: false })}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition-colors border border-zinc-700"
                  >
                    <Bot className="h-4 w-4 text-emerald-400" />
                    Devolver para IA
                  </button>
                ) : (
                  <button
                    onClick={() => toggleHandoffMutation.mutate({ id: selectedConv.id, active: true })}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors"
                  >
                    <Zap className="h-4 w-4" />
                    Assumir Conversa
                  </button>
                )}

                {/* Mark as Closed */}
                {selectedConv.status !== 'CLOSED' && (
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: selectedConv.id, status: 'CLOSED' })}
                    className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Arquivar
                  </button>
                )}
                {selectedConv.status === 'CLOSED' && (
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: selectedConv.id, status: 'OPEN' })}
                    className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </div>

            {/* Banner de Handoff Ativo */}
            {selectedConv.handoffActive && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between text-xs text-amber-400">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    <strong>Atendimento Humano Ativo:</strong> A inteligência artificial está silenciada. Responda diretamente no chat abaixo.
                  </span>
                </div>
              </div>
            )}

            {/* Histórico de Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/10">
              {isMessagesLoading ? (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-zinc-500">
                  <MessageSquare className="h-8 w-8 text-zinc-700 mb-2" />
                  <p className="text-sm">Nenhuma mensagem nesta conversa.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const date = new Date(msg.timestamp);
                  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isMe = msg.fromMe;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm shadow-md ${
                          isMe
                            ? 'bg-amber-500 text-zinc-950 rounded-br-none'
                            : 'bg-zinc-900 text-zinc-100 rounded-bl-none border border-zinc-800'
                        }`}
                      >
                        <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                        <div
                          className={`text-[9px] mt-1 text-right ${
                            isMe ? 'text-zinc-850' : 'text-zinc-500'
                          }`}
                        >
                          {timeStr}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Caixa de Entrada de Mensagem */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-800 bg-zinc-950">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={
                    selectedConv.handoffActive
                      ? "Digite a mensagem para enviar via WhatsApp..."
                      : "Assuma o controle humano para enviar uma mensagem..."
                  }
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={!selectedConv.handoffActive || sendMutation.isPending}
                  className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 border border-zinc-800 focus:border-amber-500 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={
                    !selectedConv.handoffActive ||
                    !messageText.trim() ||
                    sendMutation.isPending
                  }
                  className="rounded-lg bg-amber-500 px-4 py-2.5 text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
            <Bot className="h-16 w-16 text-zinc-800 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-zinc-300">Caixa de Entrada BarberAI</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm">
              Selecione um contato na lista ao lado para interagir, gerenciar a recepcionista virtual e alternar para atendimento humano.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
