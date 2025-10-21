import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast } from '@/components/Toast';
import type { Toast as ToastType } from '@/hooks/useToast';

describe('Toast Component', () => {
  const mockDismiss = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    mockDismiss.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const createToast = (overrides?: Partial<ToastType>): ToastType => ({
    id: 'test-toast-1',
    type: 'info',
    message: 'Test message',
    duration: 5000,
    ...overrides,
  });

  it('should render toast with message', () => {
    const toast = createToast({ message: 'Hello World' });
    render(<Toast toast={toast} onDismiss={mockDismiss} />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should render success toast with green colors', () => {
    const toast = createToast({ type: 'success', message: 'Success!' });
    const { container } = render(<Toast toast={toast} onDismiss={mockDismiss} />);

    const toastElement = container.querySelector('[role="alert"]');
    expect(toastElement).toHaveClass('bg-emerald-50');
    expect(toastElement).toHaveClass('border-emerald-200');
  });

  it('should render error toast with red colors', () => {
    const toast = createToast({ type: 'error', message: 'Error!' });
    const { container } = render(<Toast toast={toast} onDismiss={mockDismiss} />);

    const toastElement = container.querySelector('[role="alert"]');
    expect(toastElement).toHaveClass('bg-rose-50');
    expect(toastElement).toHaveClass('border-rose-200');
  });

  it('should render warning toast with amber colors', () => {
    const toast = createToast({ type: 'warning', message: 'Warning!' });
    const { container } = render(<Toast toast={toast} onDismiss={mockDismiss} />);

    const toastElement = container.querySelector('[role="alert"]');
    expect(toastElement).toHaveClass('bg-amber-50');
    expect(toastElement).toHaveClass('border-amber-200');
  });

  it('should render info toast with blue colors', () => {
    const toast = createToast({ type: 'info', message: 'Info!' });
    const { container } = render(<Toast toast={toast} onDismiss={mockDismiss} />);

    const toastElement = container.querySelector('[role="alert"]');
    expect(toastElement).toHaveClass('bg-blue-50');
    expect(toastElement).toHaveClass('border-blue-200');
  });

  it('should have proper ARIA attributes', () => {
    const toast = createToast();
    render(<Toast toast={toast} onDismiss={mockDismiss} />);

    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveAttribute('aria-live', 'polite');
    expect(toastElement).toHaveAttribute('aria-atomic', 'true');
  });

  it('should call onDismiss when dismiss button clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const toast = createToast({ id: 'toast-123' });
    render(<Toast toast={toast} onDismiss={mockDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss notification/i });
    await user.click(dismissButton);

    // Wait for animation
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockDismiss).toHaveBeenCalledWith('toast-123');
  });

  it('should add exit animation class when dismissing', async () => {
    const user = userEvent.setup({ delay: null });
    const toast = createToast();
    const { container } = render(<Toast toast={toast} onDismiss={mockDismiss} />);

    const toastElement = container.querySelector('[role="alert"]');
    expect(toastElement).not.toHaveClass('translate-x-full');

    const dismissButton = screen.getByRole('button', { name: /dismiss notification/i });
    await user.click(dismissButton);

    expect(toastElement).toHaveClass('translate-x-full');
    expect(toastElement).toHaveClass('opacity-0');
  });

  it('should delay onDismiss call for animation', async () => {
    const user = userEvent.setup({ delay: null });
    const toast = createToast({ id: 'delayed-toast' });
    render(<Toast toast={toast} onDismiss={mockDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss notification/i });
    await user.click(dismissButton);

    // Should not be called immediately
    expect(mockDismiss).not.toHaveBeenCalled();

    // Should be called after 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockDismiss).toHaveBeenCalledWith('delayed-toast');
  });

  it('should render different icons for each type', () => {
    const types: Array<ToastType['type']> = ['success', 'error', 'warning', 'info'];

    types.forEach((type) => {
      const toast = createToast({ type });
      const { container, unmount } = render(<Toast toast={toast} onDismiss={mockDismiss} />);

      // Each type should have an SVG icon
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();

      unmount();
    });
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup({ delay: null });
    const toast = createToast({ id: 'keyboard-toast' });
    render(<Toast toast={toast} onDismiss={mockDismiss} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss notification/i });

    // Focus the button
    dismissButton.focus();
    expect(dismissButton).toHaveFocus();

    // Press Enter
    await user.keyboard('{Enter}');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockDismiss).toHaveBeenCalledWith('keyboard-toast');
  });
});
