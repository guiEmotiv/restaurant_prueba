import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, UserPlus, Edit, Trash2, Shield,
  User, Calendar, Check, X, Key, Info
} from 'lucide-react';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    groups: [],
    is_staff: false,
    is_active: true
  });

  const availableGroups = [
    'Administradores',
    'Gerentes',
    'Meseros',
    'Cocineros',
    'Cajeros'
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fixed API call - now uses proxy correctly
      const response = await api.get('/auth/users/');
      // Ordenar usuarios por rol (grupo) y luego por username
      const sortedUsers = response.data.sort((a, b) => {
        // Definir orden de prioridad para roles
        const roleOrder = {
          'Administradores': 1,
          'Gerentes': 2,
          'Cajeros': 3,
          'Meseros': 4,
          'Cocineros': 5
        };

        // Obtener el primer rol de cada usuario (o 6 si no tiene rol)
        const aRole = a.groups && a.groups.length > 0 ? roleOrder[a.groups[0]] || 6 : 6;
        const bRole = b.groups && b.groups.length > 0 ? roleOrder[b.groups[0]] || 6 : 6;

        // Primero ordenar por rol, luego por username
        if (aRole !== bRole) {
          return aRole - bRole;
        }
        return a.username.localeCompare(b.username);
      });

      setUsers(sortedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      const response = await api.post('/auth/users/', formData);
      if (response.data.success) {
        setShowCreateModal(false);
        resetForm();
        fetchUsers();
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error.response?.data?.error || 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    try {
      setLoading(true);
      const response = await api.put(`/auth/users/${selectedUser.id}/`, formData);
      if (response.data.success) {
        setShowEditModal(false);
        setSelectedUser(null);
        resetForm();
        fetchUsers();
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error.response?.data?.error || 'Error al actualizar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return;

    try {
      setLoading(true);
      await api.delete(`/auth/users/${userId}/`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Error al eliminar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId, isActive) => {
    try {
      await api.patch(`/auth/users/${userId}/`, { is_active: !isActive });
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      setError('Error al cambiar estado del usuario');
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      groups: [],
      is_staff: false,
      is_active: true
    });
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '',
      groups: user.groups || [],
      is_staff: user.is_staff,
      is_active: user.is_active
    });
    setShowEditModal(true);
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      'Administradores': 'bg-red-500',
      'Gerentes': 'bg-blue-500',
      'Meseros': 'bg-green-500',
      'Cocineros': 'bg-yellow-500',
      'Cajeros': 'bg-purple-500'
    };
    return colors[role] || 'bg-gray-500';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Gestión de Usuarios
            </h1>
            <p className="text-gray-600 mt-1">Administra usuarios y permisos del sistema</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último Acceso</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                          {user.username}
                          {user.is_superuser && (
                            <Shield className="w-4 h-4 text-red-500" title="Superusuario" />
                          )}
                          {user.is_staff && !user.is_superuser && (
                            <Key className="w-4 h-4 text-blue-500" title="Staff - Acceso administrativo" />
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-1">
                      {user.groups && user.groups.length > 0 ? (
                        user.groups.map((group) => (
                          <span
                            key={group}
                            className={`px-2 py-1 text-xs rounded-full text-white ${getRoleBadgeColor(group)}`}
                          >
                            {group}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">Sin rol</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                      disabled={user.id === currentUser?.id}
                    >
                      {user.is_active ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Activo
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3 mr-1" />
                          Inactivo
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_login ? (
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(user.last_login).toLocaleString('es-PE')}
                      </div>
                    ) : (
                      'Nunca'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Editar"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      {user.id !== currentUser?.id && !user.is_superuser && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Crear Nuevo Usuario</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de Usuario *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol
                </label>
                <select
                  value={formData.groups[0] || ''}
                  onChange={(e) => setFormData({ ...formData, groups: e.target.value ? [e.target.value] : [] })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin rol</option>
                  {availableGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_staff}
                      onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Es Staff</span>
                  </label>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-blue-500 cursor-help" />
                    <div className="invisible group-hover:visible absolute left-0 top-5 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10">
                      <strong>Permisos de Staff:</strong>
                      <ul className="mt-1 space-y-1">
                        <li>• Acceso al panel de administración Django</li>
                        <li>• Gestión completa de usuarios</li>
                        <li>• Ver todos los reportes del sistema</li>
                        <li>• Configurar ajustes globales</li>
                        <li>• Modificar datos de cualquier mesa/orden</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Usuario Activo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreateUser}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Usuario'}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Editar Usuario</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de Usuario
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva Contraseña (dejar vacío para no cambiar)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dejar vacío para mantener la actual"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol
                </label>
                <select
                  value={formData.groups[0] || ''}
                  onChange={(e) => setFormData({ ...formData, groups: e.target.value ? [e.target.value] : [] })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={selectedUser?.is_superuser}
                >
                  <option value="">Sin rol</option>
                  {availableGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_staff}
                      onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                      className="mr-2"
                      disabled={selectedUser?.is_superuser}
                    />
                    <span className="text-sm font-medium">Es Staff</span>
                  </label>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-blue-500 cursor-help" />
                    <div className="invisible group-hover:visible absolute left-0 top-5 w-64 p-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10">
                      <strong>Permisos de Staff:</strong>
                      <ul className="mt-1 space-y-1">
                        <li>• Acceso al panel de administración Django</li>
                        <li>• Gestión completa de usuarios</li>
                        <li>• Ver todos los reportes del sistema</li>
                        <li>• Configurar ajustes globales</li>
                        <li>• Modificar datos de cualquier mesa/orden</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="mr-2"
                    disabled={selectedUser?.id === currentUser?.id}
                  />
                  <span className="text-sm">Usuario Activo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleUpdateUser}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Actualizando...' : 'Actualizar Usuario'}
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                  resetForm();
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;