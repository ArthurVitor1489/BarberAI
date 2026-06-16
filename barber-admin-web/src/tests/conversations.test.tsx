import React from 'react';
import { render, screen } from '@testing-library/react';
import ConversationsPage from '../app/(app)/conversations/page';
import { useQuery } from '@tanstack/react-query';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(() => ({ isPending: false, mutate: jest.fn() })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

jest.mock('../lib/auth/AuthProvider', () => ({
  useAuth: jest.fn(() => ({ user: { name: 'Owner User', role: 'OWNER' } })),
}));

describe('ConversationsPage', () => {
  it('renders conversations list and status badges', () => {
    (useQuery as jest.Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === 'conversations') {
        return {
          data: [
            {
              id: 'conv-1',
              customerId: 'client-1',
              client: { id: 'client-1', name: 'Arthur Dent', phone: '5511999999999', aiEnabled: true },
              status: 'HUMAN_HANDOFF',
              handoffActive: true,
              lastMessageAt: '2026-06-16T10:00:00.000Z',
              startedAt: '2026-06-16T09:00:00.000Z',
            },
          ],
          isLoading: false,
        };
      }
      if (queryKey[0] === 'messages') {
        return { data: [], isLoading: false };
      }
      return { data: [], isLoading: false };
    });

    render(<ConversationsPage />);

    expect(screen.getByText('Arthur Dent')).toBeInTheDocument();
    expect(screen.getByText('5511999999999')).toBeInTheDocument();
    expect(screen.getByText('Humano Ativo')).toBeInTheDocument();
  });
});
