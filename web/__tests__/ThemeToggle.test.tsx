import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
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

// Test component that uses the theme
function TestComponent() {
  const { theme, effectiveTheme } = useTheme();
  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <div data-testid="effective-theme">{effectiveTheme}</div>
      <ThemeToggle />
    </div>
  );
}

describe('Theme System', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should render theme toggle button', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: /switch theme/i })).toBeInTheDocument();
  });

  it('should cycle through themes when clicked', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /switch theme/i });
    const currentThemeDiv = screen.getByTestId('current-theme');

    // Should start with system
    expect(currentThemeDiv).toHaveTextContent('system');

    // Click to go to light
    fireEvent.click(button);
    await waitFor(() => {
      expect(currentThemeDiv).toHaveTextContent('light');
    });

    // Click to go to dark
    fireEvent.click(button);
    await waitFor(() => {
      expect(currentThemeDiv).toHaveTextContent('dark');
    });

    // Click to go back to system
    fireEvent.click(button);
    await waitFor(() => {
      expect(currentThemeDiv).toHaveTextContent('system');
    });
  });

  it('should persist theme to localStorage', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /switch theme/i });

    // Click to set light theme
    fireEvent.click(button);
    await waitFor(() => {
      expect(localStorageMock.getItem('theme')).toBe('light');
    });

    // Click to set dark theme
    fireEvent.click(button);
    await waitFor(() => {
      expect(localStorageMock.getItem('theme')).toBe('dark');
    });
  });

  it('should apply dark class to document when dark theme is active', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /switch theme/i });
    
    // Initially should not have dark class (system defaults to light in our mock)
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Click twice to get to dark theme
    fireEvent.click(button); // system -> light
    fireEvent.click(button); // light -> dark

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    // Click to go back to system (which is light in our mock)
    fireEvent.click(button); // dark -> system
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
