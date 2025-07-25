import { useState, useImperativeHandle, forwardRef } from 'react';
import { Edit, Trash2, Plus } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

const CrudTable = forwardRef(({ 
  title, 
  data, 
  columns, 
  onAdd, 
  onEdit, 
  onDelete, 
  loading = false,
  addButtonText = "Agregar",
  hideAddButton = false,
  hideTitle = false,
  useCustomModals = false
}, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const handleAdd = () => {
    if (useCustomModals) {
      // When using custom modals, delegate to parent
      onAdd && onAdd();
    } else {
      // Use built-in modal
      setEditingItem(null);
      setIsModalOpen(true);
    }
  };

  useImperativeHandle(ref, () => ({
    handleAdd
  }));

  const handleEdit = (item) => {
    if (useCustomModals) {
      // When using custom modals, delegate to parent
      onEdit && onEdit(item);
    } else {
      // Use built-in modal
      setEditingItem(item);
      setIsModalOpen(true);
    }
  };

  const handleModalSubmit = (formData) => {
    if (editingItem) {
      onEdit(editingItem.id, formData);
    } else {
      onAdd(formData);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (item) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este elemento?')) {
      onDelete(item.id);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {!hideTitle && (
        <div className="px-4 md:px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">{title}</h2>
            {!hideAddButton && (
              <Button onClick={handleAdd} className="flex items-center gap-2 w-full sm:w-auto justify-center">
                <Plus className="h-4 w-4" />
                {addButtonText}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.title}
                </th>
              ))}
              <th className="px-6 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-4 text-center text-gray-500">
                  No hay datos disponibles
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {column.render ? column.render(item[column.key], item) : item[column.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-600 hover:text-blue-900 p-3 rounded-md hover:bg-blue-50"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-red-600 hover:text-red-900 p-3 rounded-md hover:bg-red-50"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        {data.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">📄</div>
            <p className="text-lg font-medium">No hay datos disponibles</p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {data.map((item) => (
              <div key={item.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="space-y-3">
                  {columns.map((column) => (
                    <div key={column.key} className="flex justify-between items-start">
                      <div className="flex-1">
                        <dt className="text-sm font-medium text-gray-500">{column.title}</dt>
                        <dd className="mt-1 text-base text-gray-900">
                          {column.render ? column.render(item[column.key], item) : item[column.key] || '-'}
                        </dd>
                      </div>
                    </div>
                  ))}
                  
                  {/* Action buttons for mobile */}
                  <div className="flex gap-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleEdit(item)}
                      className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Edit className="h-4 w-4 inline mr-2" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 inline mr-2" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!useCustomModals && isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingItem ? `Editar ${title.slice(0, -1)}` : `Agregar ${title.slice(0, -1)}`}
          onSubmit={handleModalSubmit}
          initialData={editingItem}
          columns={columns}
        />
      )}
    </div>
  );
});

export default CrudTable;