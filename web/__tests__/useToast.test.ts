import { renderHook, act } from '@testing-library/react';
import { useToast } from '@/hooks/useToast';

describe('useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('should initialize with empty toasts array', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toEqual([]);
  });

  it('should add a toast with showToast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message', 'info');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'info',
      message: 'Test message',
      duration: 5000,
    });
    expect(result.current.toasts[0].id).toMatch(/^toast-/);
  });

  it('should add multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First', 'info');
      result.current.showToast('Second', 'success');
      result.current.showToast('Third', 'error');
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0].message).toBe('First');
    expect(result.current.toasts[1].message).toBe('Second');
    expect(result.current.toasts[2].message).toBe('Third');
  });

  it('should dismiss a toast by id', () => {
    const { result } = renderHook(() => useToast());

    let toastId = '';
    act(() => {
      toastId = result.current.showToast('Test', 'info');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismissToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should auto-dismiss toast after duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test', 'info', 3000);
    });

    expect(result.current.toasts).toHaveLength(1);

    // Fast-forward time by 3 seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should not auto-dismiss when duration is 0', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test', 'info', 0);
    });

    expect(result.current.toasts).toHaveLength(1);

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Should still be there
    expect(result.current.toasts).toHaveLength(1);
  });

  it('should use default duration of 5000ms', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test', 'info');
    });

    expect(result.current.toasts[0].duration).toBe(5000);

    // Should still be there after 4 seconds
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(result.current.toasts).toHaveLength(1);

    // Should be dismissed after 5 seconds total
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('should generate unique IDs for each toast', () => {
    const { result } = renderHook(() => useToast());

    let id1 = '';
    let id2 = '';
    let id3 = '';
    act(() => {
      id1 = result.current.showToast('First', 'info');
      id2 = result.current.showToast('Second', 'info');
      id3 = result.current.showToast('Third', 'info');
    });

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('should provide success shorthand method', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Success message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Success message');
  });

  it('should provide error shorthand method', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.error('Error message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toasts[0].message).toBe('Error message');
  });

  it('should provide info shorthand method', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.info('Info message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('info');
    expect(result.current.toasts[0].message).toBe('Info message');
  });

  it('should provide warning shorthand method', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.warning('Warning message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('warning');
    expect(result.current.toasts[0].message).toBe('Warning message');
  });

  it('should allow custom duration in shorthand methods', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Test', 10000);
    });

    expect(result.current.toasts[0].duration).toBe(10000);
  });

  it('should handle dismissing non-existent toast gracefully', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test', 'info');
    });

    expect(result.current.toasts).toHaveLength(1);

    // Try to dismiss with wrong ID
    act(() => {
      result.current.dismissToast('non-existent-id');
    });

    // Should still have the toast
    expect(result.current.toasts).toHaveLength(1);
  });

  it('should dismiss only the specified toast when multiple exist', () => {
    const { result } = renderHook(() => useToast());

    let id1 = '';
    let id2 = '';
    let id3 = '';
    act(() => {
      id1 = result.current.showToast('First', 'info');
      id2 = result.current.showToast('Second', 'info');
      id3 = result.current.showToast('Third', 'info');
    });

    expect(result.current.toasts).toHaveLength(3);

    // Dismiss the middle one
    act(() => {
      result.current.dismissToast(id2);
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts.find(t => t.id === id1)).toBeDefined();
    expect(result.current.toasts.find(t => t.id === id2)).toBeUndefined();
    expect(result.current.toasts.find(t => t.id === id3)).toBeDefined();
  });
});
