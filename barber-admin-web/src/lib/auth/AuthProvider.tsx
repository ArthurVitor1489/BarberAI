'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '../api/axios';
import { getCookie, setCookie, eraseCookie } from './cookies';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  barbershopId: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function loadUser() {
      const token = getCookie('accessToken');
      if (token) {
        try {
          // Obtém sessões para verificar se o token é válido
          const response = await api.get('/auth/sessions');
          // Se retornar sucesso, podemos carregar o usuário a partir do token
          // O JWT contém o payload decodificado, ou podemos obter o usuário no /auth/sessions (ou decodificar o token)
          // Vamos fazer uma decodificação simples do payload base64 do JWT para ler o usuário.
          const payloadBase64 = token.split('.')[1];
          const payloadJson = JSON.parse(atob(payloadBase64));
          
          setUser({
            id: payloadJson.sub,
            name: payloadJson.name || 'Administrador',
            email: payloadJson.email || '',
            role: payloadJson.role || 'OWNER',
            barbershopId: payloadJson.barbershopId || '',
          });
          
          // Garante que o cookie barbershopId está sincronizado
          setCookie('barbershopId', payloadJson.barbershopId);
        } catch (error: any) {
          // 401 é um status esperado caso a sessão tenha expirado, não precisa de console.error
          if (error?.response?.status !== 401) {
            console.error('Falha ao autenticar sessão inicial:', error);
          } else {
            console.log('Sessão expirada ou inválida. Usuário precisa fazer login.');
          }
          logoutClient();
        }
      } else {
        setIsLoading(false);
      }
      setIsLoading(false);
    }
    loadUser();
  }, []);

  // Redirecionamentos automáticos de segurança (Protected Routes)
  useEffect(() => {
    if (isLoading) return;

    const isPublicPath = pathname === '/login' || pathname.startsWith('/api/');
    const hasToken = !!getCookie('accessToken');

    if (!hasToken && !isPublicPath) {
      router.push('/login');
    } else if (hasToken && isPublicPath) {
      router.push('/dashboard');
    }
  }, [pathname, isLoading, user]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user: loggedUser } = response.data;

      // Persiste nos cookies
      setCookie('accessToken', accessToken);
      setCookie('refreshToken', refreshToken);
      setCookie('barbershopId', loggedUser.barbershopId);

      setUser({
        id: loggedUser.id,
        name: loggedUser.name,
        email: loggedUser.email,
        role: loggedUser.role,
        barbershopId: loggedUser.barbershopId,
      });

      router.push('/dashboard');
    } catch (error: any) {
      setIsLoading(false);
      throw new Error(error.response?.data?.message || 'Falha ao autenticar. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const logoutClient = () => {
    setUser(null);
    eraseCookie('accessToken');
    eraseCookie('refreshToken');
    eraseCookie('barbershopId');
    router.push('/login');
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const refreshToken = getCookie('refreshToken');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Erro ao deslogar no servidor:', error);
    } finally {
      logoutClient();
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
