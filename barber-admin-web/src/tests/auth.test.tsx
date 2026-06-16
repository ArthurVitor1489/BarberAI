import React from 'react';
import { render, screen } from '@testing-library/react';
import LoginPage from '../app/(auth)/login/page';
import { useAuth } from '../lib/auth/AuthProvider';

jest.mock('../lib/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

describe('LoginPage', () => {
  it('renders login form elements correctly', () => {
    (useAuth as jest.Mock).mockReturnValue({
      login: jest.fn(),
    });

    render(<LoginPage />);

    expect(screen.getByPlaceholderText('admin@barbearia.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar no Painel' })).toBeInTheDocument();
  });
});
