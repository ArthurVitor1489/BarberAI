'use client';

import React, { useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import NotificationCenter from '../../components/layout/NotificationCenter';
import FeedbackWidget from '../../components/layout/FeedbackWidget';
import { useAuth } from '../../lib/auth/AuthProvider';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user && user.role === 'BARBER') {
      const forbiddenPaths = ['/barbers', '/services', '/settings', '/subscription'];
      const isForbidden = forbiddenPaths.some((path) => pathname === path || pathname.startsWith(path + '/'));
      if (isForbidden) {
        router.push('/dashboard');
      }
    }
  }, [user, isAuthenticated, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-amber-500">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  // Se não estiver autenticado, o AuthProvider irá redirecionar para o login
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-slate-100">
      {/* Sidebar Fixa */}
      <Sidebar />

      {/* Conteúdo Principal */}
      <div className="flex-1 pl-64 flex flex-col">
        {/* Header Superior */}
        <header className="h-16 border-b border-zinc-900 bg-zinc-950/20 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="text-xs text-zinc-550 font-medium flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Painel Administrativo V1
          </div>
          <div className="flex items-center gap-4">
            <NotificationCenter />
            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-300 border border-zinc-800">
              {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 max-w-7xl mx-auto space-y-6 w-full">
          {children}
        </main>
      </div>
      <FeedbackWidget />
    </div>
  );
}
