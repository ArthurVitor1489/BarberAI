import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from '../app/(app)/dashboard/page';
import { useQuery } from '@tanstack/react-query';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

jest.mock('../lib/auth/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ user: { name: 'Owner User', role: 'OWNER' } })),
}));

describe('DashboardPage', () => {
  it('renders metrics cards correctly', () => {
    (useQuery as jest.Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'dashboardSummary') {
        return {
          data: {
            appointmentsToday: 5,
            customers: 120,
            barbers: 3,
            services: 8,
            revenueMonth: 2500,
          },
          isLoading: false,
        };
      }
      if (queryKey[0] === 'dashboardAppointments') {
        return { data: { items: [], total: 0 }, isLoading: false };
      }
      if (queryKey[0] === 'whatsapp-instances') {
        return { data: [{ status: 'CONNECTED', instanceName: 'Instance 1' }], isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    render(<DashboardPage />);

    expect(screen.getByText('Faturamento Mês')).toBeInTheDocument();
    expect(screen.getByText('R$ 2.500,00')).toBeInTheDocument();
    expect(screen.getByText('Cortes Hoje')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Clientes Ativos')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });
});
