import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Tooltip from '@/components/Tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
  });

  it('shows tooltip on mouse enter', async () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button');
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText('Help text')).toBeInTheDocument();
    });
  });

  it('hides tooltip on mouse leave', async () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button');
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    fireEvent.mouseLeave(trigger);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows tooltip on focus', async () => {
    render(
      <Tooltip content="Help text">
        <button>Focus me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button');
    fireEvent.focus(trigger);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  it('hides tooltip on blur', async () => {
    render(
      <Tooltip content="Help text">
        <button>Focus me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button');
    fireEvent.focus(trigger);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    fireEvent.blur(trigger);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('renders complex content', async () => {
    const content = (
      <div>
        <p>Title</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    );

    render(
      <Tooltip content={content}>
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button');
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  it('applies custom maxWidth', () => {
    render(
      <Tooltip content="Help text" maxWidth="500px">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button');
    fireEvent.mouseEnter(trigger);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveStyle({ maxWidth: '500px' });
  });

  it('does not show tooltip initially', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
