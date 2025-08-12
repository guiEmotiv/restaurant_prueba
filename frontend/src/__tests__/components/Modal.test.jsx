/**
 * Tests for Modal component
 * Testing modal functionality and form handling
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Modal from '../../components/common/Modal';

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    size: 'md'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders modal when isOpen is true', () => {
    render(
      <Modal {...defaultProps}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  test('does not render modal when isOpen is false', () => {
    render(
      <Modal {...defaultProps} isOpen={false}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    
    render(
      <Modal {...defaultProps} onClose={onClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    
    render(
      <Modal {...defaultProps} onClose={onClose}>
        <div>Modal Content</div>
      </Modal>
    );

    // Click on the backdrop (overlay)
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does not close when clicking inside modal content', () => {
    const onClose = jest.fn();
    
    render(
      <Modal {...defaultProps} onClose={onClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const modalContent = screen.getByText('Modal Content');
    fireEvent.click(modalContent);

    expect(onClose).not.toHaveBeenCalled();
  });

  test('handles escape key press', () => {
    const onClose = jest.fn();
    
    render(
      <Modal {...defaultProps} onClose={onClose}>
        <div>Modal Content</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('renders with different sizes', () => {
    const { rerender } = render(
      <Modal {...defaultProps} size="sm">
        <div>Small Modal</div>
      </Modal>
    );

    let modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toHaveClass('max-w-md'); // Small size class

    rerender(
      <Modal {...defaultProps} size="lg">
        <div>Large Modal</div>
      </Modal>
    );

    modalContent = screen.getByTestId('modal-content');
    expect(modalContent).toHaveClass('max-w-4xl'); // Large size class
  });

  test('renders form variant correctly', () => {
    const onSubmit = jest.fn();
    
    render(
      <Modal 
        {...defaultProps} 
        variant="form" 
        onSubmit={onSubmit}
        submitText="Save"
        cancelText="Cancel"
      >
        <input data-testid="form-input" />
      </Modal>
    );

    expect(screen.getByTestId('form-input')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('handles form submission', async () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    
    render(
      <Modal 
        {...defaultProps} 
        variant="form" 
        onSubmit={onSubmit}
        onClose={onClose}
        submitText="Save"
      >
        <input data-testid="form-input" />
      </Modal>
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('shows loading state during form submission', () => {
    render(
      <Modal 
        {...defaultProps} 
        variant="form" 
        onSubmit={jest.fn()}
        submitText="Save"
        loading={true}
      >
        <input data-testid="form-input" />
      </Modal>
    );

    const saveButton = screen.getByText('Save');
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  test('displays error message when provided', () => {
    const errorMessage = 'Something went wrong';
    
    render(
      <Modal 
        {...defaultProps} 
        variant="form" 
        error={errorMessage}
      >
        <input data-testid="form-input" />
      </Modal>
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('clears error when modal is reopened', () => {
    const { rerender } = render(
      <Modal 
        {...defaultProps} 
        variant="form" 
        error="Previous error"
        isOpen={false}
      >
        <input data-testid="form-input" />
      </Modal>
    );

    rerender(
      <Modal 
        {...defaultProps} 
        variant="form" 
        error="Previous error"
        isOpen={true}
      >
        <input data-testid="form-input" />
      </Modal>
    );

    // Error should be cleared when modal reopens
    expect(screen.queryByText('Previous error')).not.toBeInTheDocument();
  });

  test('focuses on modal when opened', () => {
    render(
      <Modal {...defaultProps}>
        <button>First focusable element</button>
      </Modal>
    );

    const modal = screen.getByRole('dialog');
    expect(modal).toHaveFocus();
  });

  test('traps focus within modal', () => {
    render(
      <Modal {...defaultProps}>
        <button data-testid="first-button">First</button>
        <button data-testid="second-button">Second</button>
      </Modal>
    );

    const firstButton = screen.getByTestId('first-button');
    const secondButton = screen.getByTestId('second-button');

    // Tab should move focus between elements
    fireEvent.keyDown(firstButton, { key: 'Tab' });
    expect(secondButton).toHaveFocus();

    // Shift+Tab should move focus backwards
    fireEvent.keyDown(secondButton, { key: 'Tab', shiftKey: true });
    expect(firstButton).toHaveFocus();
  });
});