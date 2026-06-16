'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Briefcase,
  MessageSquare,
  CreditCard,
  Settings,
  LogOut,
  BarChart3,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['OWNER', 'MANAGER', 'BARBER'] },
  { href: '/dashboard/pilot', label: 'Métricas Piloto', icon: BarChart3, roles: ['OWNER', 'MANAGER'] },
  { href: '/appointments', label: 'Agenda', icon: Calendar, roles: ['OWNER', 'MANAGER', 'BARBER'] },
  { href: '/customers', label: 'Clientes', icon: Users, roles: ['OWNER', 'MANAGER', 'BARBER'] },
  { href: '/barbers', label: 'Barbeiros', icon: Scissors, roles: ['OWNER', 'MANAGER'] },
  { href: '/services', label: 'Serviços', icon: Briefcase, roles: ['OWNER', 'MANAGER'] },
  { href: '/conversations', label: 'Conversas', icon: MessageSquare, roles: ['OWNER', 'MANAGER', 'BARBER'] },
  { href: '/subscription', label: 'Assinatura', icon: CreditCard, roles: ['OWNER', 'MANAGER'] },
  { href: '/settings', label: 'Configurações', icon: Settings, roles: ['OWNER', 'MANAGER'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  
  // Filtra itens de navegação conforme papel do usuário
  const allowedItems = navItems.filter((item) => {
    const userRole = user?.role || 'OWNER';
    return item.roles.includes(userRole);
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-zinc-800 bg-zinc-950 px-4 py-6">
      <div className="flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-600 font-bold text-white">
          B
        </div>
        <div>
          <h1 className="text-sm font-bold text-white">BarberAI</h1>
          <p className="text-xs text-zinc-500">SaaS Multi-tenant</p>
        </div>
      </div>

      <nav className="mt-8 flex-1 space-y-1">
        {allowedItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-900 text-amber-500'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 pt-4">
        <div className="flex items-center gap-3 px-2 py-2 mb-4">
          <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300">
            {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="text-xs font-semibold text-white truncate">{user?.name}</h4>
            <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-red-950/30 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sair da Conta
        </button>
      </div>
    </aside>
  );
}
