import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { Tooltip } from '@/components/Tooltip';

describe('Tooltip', () => {
  it('renders child element', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
  });

  it('does not show tooltip initially', () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus', () => {
    jest.useFakeTimers();
    render(
      <Tooltip content="Tooltip text" delay={0}>
        <button>Focus me</button>
      </Tooltip>
    );

    const button = screen.getByRole('button');
    
    act(() => {
      button.focus();
      jest.advanceTimersByTime(0);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Tooltip text')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('hides tooltip on blur', () => {
    jest.useFakeTimers();
    render(
      <Tooltip content="Tooltip text" delay={0}>
        <button>Focus me</button>
      </Tooltip>
    );

    const button = screen.getByRole('button');
    
    act(() => {
      button.focus();
      jest.advanceTimersByTime(0);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    act(() => {
      button.blur();
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it('adds aria-describedby when tooltip is visible', () => {
    jest.useFakeTimers();
    render(
      <Tooltip content="Tooltip text" delay={0}>
        <button>Focus me</button>
      </Tooltip>
    );

    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('aria-describedby');

    act(() => {
      button.focus();
      jest.advanceTimersByTime(0);
    });

    expect(button).toHaveAttribute('aria-describedby', 'tooltip');

    jest.useRealTimers();
  });

  it('preserves child onFocus and onBlur handlers', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();

    render(
      <Tooltip content="Tooltip text">
        <button
          onFocus={onFocus}
          onBlur={onBlur}
        >
          Interactive
        </button>
      </Tooltip>
    );

    const button = screen.getByRole('button');

    button.focus();
    expect(onFocus).toHaveBeenCalledTimes(1);

    button.blur();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('renders correctly with disabled button', () => {
    render(
      <Tooltip content="Feature unavailable" delay={0}>
        <button disabled>Disabled button</button>
      </Tooltip>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toBeInTheDocument();
  });

  it('respects custom delay', () => {
    jest.useFakeTimers();
    render(
      <Tooltip content="Tooltip text" delay={500}>
        <button>Focus me</button>
      </Tooltip>
    );

    const button = screen.getByRole('button');
    
    act(() => {
      button.focus();
    });

    // Tooltip should not appear yet
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Now it should appear
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    jest.useRealTimers();
  });

  it('has tooltip with proper styling classes', () => {
    jest.useFakeTimers();
    render(
      <Tooltip content="Tooltip content" delay={0}>
        <button>Test button</button>
      </Tooltip>
    );

    const button = screen.getByRole('button');
    
    act(() => {
      button.focus();
      jest.advanceTimersByTime(0);
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveClass('pointer-events-none', 'fixed', 'z-50');

    jest.useRealTimers();
  });
});
