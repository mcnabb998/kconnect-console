import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadingButton } from '@/components/LoadingButton';

describe('LoadingButton', () => {
  it('renders children when not loading', () => {
    render(<LoadingButton>Click Me</LoadingButton>);

    expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
  });

  it('shows loading spinner when loading is true', () => {
    render(<LoadingButton loading={true}>Click Me</LoadingButton>);

    const button = screen.getByRole('button');
    const spinner = button.querySelector('svg');

    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });

  it('shows loadingText when provided and loading', () => {
    render(
      <LoadingButton loading={true} loadingText="Saving...">
        Save
      </LoadingButton>
    );

    expect(screen.getByRole('button', { name: /Saving.../ })).toBeInTheDocument();
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('shows children when loading but no loadingText provided', () => {
    render(<LoadingButton loading={true}>Click Me</LoadingButton>);

    expect(screen.getByRole('button', { name: /Click Me/ })).toBeInTheDocument();
  });

  it('disables button when loading', () => {
    render(<LoadingButton loading={true}>Click Me</LoadingButton>);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables button when disabled prop is true', () => {
    render(<LoadingButton disabled={true}>Click Me</LoadingButton>);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick when clicked and not loading', () => {
    const handleClick = jest.fn();
    render(<LoadingButton onClick={handleClick}>Click Me</LoadingButton>);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when loading', () => {
    const handleClick = jest.fn();
    render(<LoadingButton loading={true} onClick={handleClick}>Click Me</LoadingButton>);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies primary variant classes by default', () => {
    render(<LoadingButton>Click Me</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-emerald-600');
    expect(button).toHaveClass('text-white');
  });

  it('applies secondary variant classes when variant is secondary', () => {
    render(<LoadingButton variant="secondary">Click Me</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('border-slate-200');
    expect(button).toHaveClass('bg-white');
  });

  it('applies danger variant classes when variant is danger', () => {
    render(<LoadingButton variant="danger">Click Me</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-rose-600');
  });

  it('applies ghost variant classes when variant is ghost', () => {
    render(<LoadingButton variant="ghost">Click Me</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-slate-700');
    expect(button).toHaveClass('hover:bg-slate-100');
  });

  it('merges custom className with default classes', () => {
    render(<LoadingButton className="custom-class">Click Me</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
    expect(button).toHaveClass('inline-flex'); // base class still present
  });

  it('forwards other button props', () => {
    render(
      <LoadingButton type="submit" aria-label="Submit form">
        Submit
      </LoadingButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('aria-label', 'Submit form');
  });

  it('hides spinner when not loading', () => {
    render(<LoadingButton loading={false}>Click Me</LoadingButton>);

    const button = screen.getByRole('button');
    const spinner = button.querySelector('svg');

    expect(spinner).not.toBeInTheDocument();
  });
});
