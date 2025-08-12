/**
 * Tests for Button component
 * Testing button variants, states, and interactions
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../../components/common/Button';

describe('Button Component', () => {
  test('renders button with text', () => {
    render(<Button>Click me</Button>);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  test('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    
    render(
      <Button onClick={handleClick} disabled>
        Disabled Button
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('renders primary variant correctly', () => {
    render(<Button variant="primary">Primary Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-blue-600');
  });

  test('renders secondary variant correctly', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gray-600');
  });

  test('renders danger variant correctly', () => {
    render(<Button variant="danger">Danger Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-600');
  });

  test('renders success variant correctly', () => {
    render(<Button variant="success">Success Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-green-600');
  });

  test('renders small size correctly', () => {
    render(<Button size="sm">Small Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-2', 'py-1', 'text-sm');
  });

  test('renders large size correctly', () => {
    render(<Button size="lg">Large Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-6', 'py-3', 'text-lg');
  });

  test('renders loading state correctly', () => {
    render(<Button loading>Loading Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('renders with custom className', () => {
    render(<Button className="custom-class">Custom Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  test('renders as submit type', () => {
    render(<Button type="submit">Submit Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  test('renders full width correctly', () => {
    render(<Button fullWidth>Full Width Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
  });

  test('handles multiple props together', () => {
    const handleClick = jest.fn();
    
    render(
      <Button
        variant="danger"
        size="lg"
        disabled
        onClick={handleClick}
        className="custom-class"
        fullWidth
      >
        Complex Button
      </Button>
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('bg-red-600', 'px-6', 'py-3', 'text-lg', 'custom-class', 'w-full');
    
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('renders with icon', () => {
    const Icon = () => <span data-testid="icon">📧</span>;
    
    render(
      <Button icon={<Icon />}>
        Button with Icon
      </Button>
    );
    
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Button with Icon')).toBeInTheDocument();
  });

  test('shows only icon when iconOnly is true', () => {
    const Icon = () => <span data-testid="icon">📧</span>;
    
    render(
      <Button icon={<Icon />} iconOnly aria-label="Icon only button">
        Hidden Text
      </Button>
    );
    
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.queryByText('Hidden Text')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Icon only button')).toBeInTheDocument();
  });

  test('handles form submission', () => {
    const handleSubmit = jest.fn((e) => e.preventDefault());
    
    render(
      <form onSubmit={handleSubmit}>
        <Button type="submit">Submit</Button>
      </form>
    );
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  test('supports ref forwarding', () => {
    const ref = React.createRef();
    
    render(<Button ref={ref}>Button with Ref</Button>);
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});