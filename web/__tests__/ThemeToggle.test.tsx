import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeToggle } from '@/components/ThemeToggle';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.classList.remove('dark');
    
    // Reset matchMedia to default (prefer light mode)
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  it('renders the theme toggle button', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /switch to/i });
      expect(button).toBeInTheDocument();
    });
  });

  it('initializes with light theme by default', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(button).toBeInTheDocument();
    });
    
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles to dark mode when clicked', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(button).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /switch to dark mode/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    await waitFor(() => {
      const updatedButton = screen.getByRole('button', { name: /switch to light mode/i });
      expect(updatedButton).toBeInTheDocument();
    });
  });

  it('toggles back to light mode when clicked again', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    
    // Toggle to dark
    fireEvent.click(button);
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    // Toggle back to light
    fireEvent.click(button);
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('persists theme preference to localStorage', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(localStorageMock.getItem('theme')).toBe('dark');
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(localStorageMock.getItem('theme')).toBe('light');
    });
  });

  it('initializes from localStorage if available', async () => {
    localStorageMock.setItem('theme', 'dark');
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /switch to light mode/i });
      expect(button).toBeInTheDocument();
    });
  });

  it('respects system preference when no localStorage value', async () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /switch to light mode/i });
      expect(button).toBeInTheDocument();
    });
  });

  it('applies dark class to document root when dark mode is active', async () => {
    // Explicitly set to light mode first
    localStorageMock.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    // Wait for component to mount and apply theme
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('removes dark class from document root when light mode is active', async () => {
    document.documentElement.classList.add('dark');
    localStorageMock.setItem('theme', 'dark');
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('has proper accessibility attributes', async () => {
    // Explicitly set to light mode
    localStorageMock.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    });
  });

  it('updates aria-label when theme changes', async () => {
    // Explicitly set to light mode
    localStorageMock.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(button).toBeInTheDocument();
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
    });
  });
});
