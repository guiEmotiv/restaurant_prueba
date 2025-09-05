import { useState, useMemo } from 'react';

const MenuCatalog = ({ 
  recipes, 
  groups, 
  onAddToCart, 
  onOpenNoteModal 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Contar recetas por grupo
  const recipeCountByGroup = useMemo(() => {
    if (!recipes || !groups) {
      return {};
    }
    
    return recipes.reduce((acc, recipe) => {
      const groupId = recipe.group_id || recipe.group?.id;
      if (groupId) {
        acc[groupId] = (acc[groupId] || 0) + 1;
      }
      return acc;
    }, {});
  }, [recipes, groups]);

  // Filtrar recetas según búsqueda y grupo seleccionado
  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      // Filtro por término de búsqueda
      if (searchTerm && !recipe.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filtro por grupo
      if (selectedGroup && (recipe.group_id !== selectedGroup && recipe.group?.id !== selectedGroup)) {
        return false;
      }
      
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes, searchTerm, selectedGroup]);

  return (
    <div className="space-y-6">
      {/* Buscador más grande */}
      <input
        type="text"
        placeholder="Buscar plato..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-6 text-xl border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
      />

      {/* Filtro de grupo con botones más grandes */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setSelectedGroup(null)}
          className={`px-6 py-3 rounded-xl font-medium text-lg transition-colors ${
            selectedGroup === null
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Todos ({recipes.length})
        </button>
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => setSelectedGroup(group.id)}
            className={`px-6 py-3 rounded-xl font-medium text-lg transition-colors ${
              selectedGroup === group.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {group.name} ({recipeCountByGroup[group.id] || recipeCountByGroup[group.pk] || 0})
          </button>
        ))}
      </div>

      {/* Grid de recetas responsive */}
      <div className="mb-20">
        {filteredRecipes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || selectedGroup ? 'No se encontraron platos con los filtros aplicados' : 'No hay platos disponibles'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredRecipes.map(recipe => (
              <div key={recipe.id} className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6 space-y-4">
                  {/* Botón principal clickeable con nombre y precio */}
                  <button
                    onClick={() => onAddToCart(recipe)}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all duration-200 group"
                  >
                    {/* Nombre del plato */}
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 text-xl leading-tight mb-3">
                      {recipe.name}
                    </h3>
                    
                    {/* Precio */}
                    <div className="text-2xl font-bold text-blue-600 group-hover:text-blue-700">
                      S/ {recipe.price || recipe.base_price || '0.00'}
                    </div>
                  </button>
                  
                  {/* Botón de nota separado */}
                  <button
                    onClick={() => onOpenNoteModal(recipe)}
                    className="w-full py-3 px-4 text-gray-600 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-lg flex items-center justify-center gap-2"
                    title="Agregar con nota"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Agregar nota
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuCatalog;