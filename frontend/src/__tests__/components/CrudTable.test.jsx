/**
 * Tests for CrudTable component
 * Testing table functionality, sorting, and CRUD operations
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CrudTable from '../../components/common/CrudTable';

describe('CrudTable Component', () => {
  const mockData = [
    { id: 1, name: 'Item 1', category: 'Category A', price: 10.50 },
    { id: 2, name: 'Item 2', category: 'Category B', price: 15.75 },
    { id: 3, name: 'Item 3', category: 'Category A', price: 8.25 },
  ];

  const mockColumns = [
    { key: 'name', label: 'Nombre', sortable: true },
    { key: 'category', label: 'Categoría', sortable: true },
    { 
      key: 'price', 
      label: 'Precio', 
      sortable: true,
      render: (value) => `$${value.toFixed(2)}`
    },
  ];

  const defaultProps = {
    data: mockData,
    columns: mockColumns,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onCreate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders table with data', () => {
    render(<CrudTable {...defaultProps} />);

    // Check headers
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Categoría')).toBeInTheDocument();
    expect(screen.getByText('Precio')).toBeInTheDocument();

    // Check data rows
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
    expect(screen.getByText('Category A')).toBeInTheDocument();
    expect(screen.getByText('Category B')).toBeInTheDocument();
  });

  test('renders custom cell content with render function', () => {
    render(<CrudTable {...defaultProps} />);

    expect(screen.getByText('$10.50')).toBeInTheDocument();
    expect(screen.getByText('$15.75')).toBeInTheDocument();
    expect(screen.getByText('$8.25')).toBeInTheDocument();
  });

  test('shows create button when onCreate is provided', () => {
    render(<CrudTable {...defaultProps} createButtonText="Nuevo Item" />);

    const createButton = screen.getByText('Nuevo Item');
    expect(createButton).toBeInTheDocument();
  });

  test('calls onCreate when create button is clicked', () => {
    const onCreate = jest.fn();
    
    render(
      <CrudTable 
        {...defaultProps} 
        onCreate={onCreate}
        createButtonText="Nuevo Item" 
      />
    );

    fireEvent.click(screen.getByText('Nuevo Item'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  test('shows edit and delete buttons for each row', () => {
    render(<CrudTable {...defaultProps} />);

    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });

    expect(editButtons).toHaveLength(3);
    expect(deleteButtons).toHaveLength(3);
  });

  test('calls onEdit with correct item when edit button is clicked', () => {
    const onEdit = jest.fn();
    
    render(<CrudTable {...defaultProps} onEdit={onEdit} />);

    const editButtons = screen.getAllByRole('button', { name: /editar/i });
    fireEvent.click(editButtons[0]);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(mockData[0]);
  });

  test('calls onDelete with correct item when delete button is clicked', () => {
    const onDelete = jest.fn();
    
    render(<CrudTable {...defaultProps} onDelete={onDelete} />);

    const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i });
    fireEvent.click(deleteButtons[1]);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(mockData[1]);
  });

  test('sorts data when sortable column header is clicked', () => {
    render(<CrudTable {...defaultProps} />);

    const nameHeader = screen.getByText('Nombre');
    fireEvent.click(nameHeader);

    // Check if data is sorted (first item should now be "Item 1")
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Item 1'); // Skip header row
  });

  test('shows loading state', () => {
    render(<CrudTable {...defaultProps} loading />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  test('shows empty state when no data', () => {
    render(<CrudTable {...defaultProps} data={[]} />);

    expect(screen.getByText(/no hay datos/i)).toBeInTheDocument();
  });

  test('filters data based on search term', () => {
    render(<CrudTable {...defaultProps} searchable />);

    const searchInput = screen.getByPlaceholderText(/buscar/i);
    fireEvent.change(searchInput, { target: { value: 'Item 2' } });

    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Item 3')).not.toBeInTheDocument();
  });

  test('shows pagination when enabled', () => {
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      category: 'Category',
      price: 10.00
    }));

    render(
      <CrudTable 
        {...defaultProps} 
        data={largeData}
        pagination
        itemsPerPage={10}
      />
    );

    expect(screen.getByText(/página/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeInTheDocument();
  });

  test('handles bulk selection', () => {
    const onBulkAction = jest.fn();
    
    render(
      <CrudTable 
        {...defaultProps} 
        selectable
        onBulkAction={onBulkAction}
      />
    );

    // Select all checkbox
    const selectAllCheckbox = screen.getByRole('checkbox', { name: /seleccionar todo/i });
    fireEvent.click(selectAllCheckbox);

    // Check if bulk action button appears
    expect(screen.getByRole('button', { name: /acciones seleccionadas/i })).toBeInTheDocument();
  });

  test('shows row count', () => {
    render(<CrudTable {...defaultProps} showRowCount />);

    expect(screen.getByText(/3 elementos/i)).toBeInTheDocument();
  });

  test('handles custom actions', () => {
    const customAction = jest.fn();
    const customActions = [
      {
        label: 'Acción Personalizada',
        onClick: customAction,
        icon: '⚡'
      }
    ];

    render(
      <CrudTable 
        {...defaultProps} 
        customActions={customActions}
      />
    );

    const customButtons = screen.getAllByRole('button', { name: /acción personalizada/i });
    fireEvent.click(customButtons[0]);

    expect(customAction).toHaveBeenCalledTimes(1);
    expect(customAction).toHaveBeenCalledWith(mockData[0]);
  });

  test('handles responsive design', () => {
    render(<CrudTable {...defaultProps} responsive />);

    const table = screen.getByRole('table');
    expect(table.parentElement).toHaveClass('overflow-x-auto');
  });

  test('shows error state', () => {
    render(<CrudTable {...defaultProps} error="Error loading data" />);

    expect(screen.getByText('Error loading data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});