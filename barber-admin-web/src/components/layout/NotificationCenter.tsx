'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api/axios';
import { Bell, Calendar, MessageSquare, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: 'appointment_created' | 'appointment_cancelled' | 'message_waiting';
  title: string;
  description: string;
  time: string;
  link: string;
}

const EMPTY_ARRAY: any[] = [];

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // 1. Fetch conversations to check for customers waiting response
  const { data: conversations = EMPTY_ARRAY } = useQuery<any[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/conversations');
      return res.data;
    },
    refetchInterval: 10000, // Refresh every 10s
  });

  // 2. Fetch recent appointments
  const { data: appointmentsData } = useQuery<any>({
    queryKey: ['dashboardAppointments'],
    queryFn: async () => {
      const res = await api.get('/appointments', { params: { limit: 10 } });
      return res.data;
    },
    refetchInterval: 15000,
  });

  // Build notifications list dynamically based on database state
  useEffect(() => {
    const list: Notification[] = [];

    // Add WAITING_CUSTOMER notifications
    conversations.forEach((conv) => {
      if (conv.status === 'WAITING_CUSTOMER') {
        list.push({
          id: `waiting-${conv.id}`,
          type: 'message_waiting',
          title: 'Cliente aguardando resposta',
          description: `${conv.client?.name} enviou uma mensagem e aguarda retorno.`,
          time: 'Ação necessária',
          link: '/conversations',
        });
      }
    });

    // Add recent appointments (e.g. created recently)
    if (appointmentsData?.items) {
      appointmentsData.items.slice(0, 5).forEach((appt: any) => {
        const isCancelled = appt.status === 'CANCELLED';
        const dateObj = new Date(appt.dateTime);
        const dateStr = dateObj.toLocaleDateString();
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isCancelled) {
          list.push({
            id: `cancelled-${appt.id}`,
            type: 'appointment_cancelled',
            title: 'Agendamento cancelado',
            description: `${appt.client?.name} cancelou o horário de ${dateStr} às ${timeStr}.`,
            time: 'Recente',
            link: '/appointments',
          });
        } else {
          list.push({
            id: `created-${appt.id}`,
            type: 'appointment_created',
            title: 'Novo agendamento',
            description: `${appt.client?.name} agendou ${appt.service?.name} com ${appt.barber?.name} para ${dateStr} às ${timeStr}.`,
            time: 'Recente',
            link: '/appointments',
          });
        }
      });
    }

    setNotifications(list);
  }, [conversations, appointmentsData]);

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors focus:outline-none border border-zinc-800/40 bg-zinc-950/40"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Overlay to close on outside click */}
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 z-40 w-80 rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <h4 className="text-xs font-bold text-zinc-300">Central de Alertas ({unreadCount})</h4>
              <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2.5 divide-y divide-zinc-900/40">
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-zinc-600 text-xs">
                  Sem novas notificações.
                </div>
              ) : (
                notifications.map((notif) => {
                  return (
                    <Link
                      key={notif.id}
                      href={notif.link}
                      onClick={() => setIsOpen(false)}
                      className="block pt-2.5 first:pt-0 hover:bg-zinc-900/20 rounded-md transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {notif.type === 'message_waiting' && (
                            <MessageSquare className="h-4 w-4 text-sky-400" />
                          )}
                          {notif.type === 'appointment_created' && (
                            <Calendar className="h-4 w-4 text-emerald-400" />
                          )}
                          {notif.type === 'appointment_cancelled' && (
                            <AlertCircle className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{notif.title}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                            {notif.description}
                          </p>
                          <span className="text-[9px] font-medium text-amber-500 mt-1 block">
                            {notif.time}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
