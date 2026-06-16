import '@testing-library/jest-dom';

// Mock useRouter and navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
  usePathname() {
    return '/dashboard';
  },
  useParams() {
    return { id: 'test-id' };
  },
}));
