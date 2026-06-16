import React from 'react';
import { render, screen } from '@testing-library/react';
import AppointmentsPage from '../app/(app)/appointments/page';
import { useQuery } from '@tanstack/react-query';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

describe('AppointmentsPage', () => {
  it('renders time slot calendar list', () => {
    (useQuery as jest.Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'appointments') {
        return {
          data: {
            items: [
              {
                id: 'appt-1',
                dateTime: '2026-06-16T10:00:00.000Z',
                status: 'CONFIRMED',
                client: { name: 'Arthur Dent', phone: '5511999999999' },
                service: { name: 'Barba Completa', price: 40 },
                barber: { name: 'João' },
              },
            ],
            total: 1,
          },
          isLoading: false,
        };
      }
      if (queryKey[0] === 'barbers') {
        return { data: [{ id: 'barber-1', name: 'João' }], isLoading: false };
      }
      if (queryKey[0] === 'services') {
        return { data: [{ id: 'service-1', name: 'Barba Completa', price: 40 }], isLoading: false };
      }
      if (queryKey[0] === 'clientsList') {
        return { data: { items: [{ id: 'client-1', name: 'Arthur Dent' }] }, isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    render(<AppointmentsPage />);

    expect(screen.getByText('Arthur Dent')).toBeInTheDocument();
    expect(screen.getByText('Barba Completa (R$ 40,00) • Barbeiro: João')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });
});
