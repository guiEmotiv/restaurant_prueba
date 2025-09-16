import { useCallback, useEffect } from 'react';

const TableSelection = ({
  tables,
  onTableSelect,
  getTableStatus,
  getTableSummary
}) => {

  // DEBUG: Log cuando cambian las mesas
  useEffect(() => {
    console.log('🟨 [TABLE-SELECTION] Tables prop changed:', {
      tablesCount: tables?.length || 0,
      tables: tables?.map(t => ({ id: t.id, table_number: t.table_number, zone: t.zone_name || t.zone }))
    });
  }, [tables]);

  // Manejar selección de mesa
  const handleTableClick = useCallback((table) => {
    console.log('🟨 [TABLE-SELECTION] Table clicked:', {
      id: table.id,
      table_number: table.table_number
    });
    onTableSelect(table);
  }, [onTableSelect]);

  return (
    <div className="fixed inset-0 p-1 overflow-y-auto">
      {/* Lista de Mesas - Usando toda la vista disponible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1 min-h-0">
        {tables.map(table => {
          const status = getTableStatus(table.id);
          const summary = getTableSummary(table.id);
          
          return (
            <button
              key={table.id}
              onClick={() => handleTableClick(table)}
              className={`p-2 rounded-md text-left border transition-all duration-200 hover:scale-[1.02] ${
                status === 'occupied' 
                  ? 'border-orange-300 bg-orange-50 hover:border-orange-400' 
                  : 'border-green-300 bg-green-50 hover:border-green-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm text-gray-900">
                  Mesa {table.table_number}
                </h3>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  status === 'occupied' 
                    ? 'bg-orange-200 text-orange-800' 
                    : 'bg-green-200 text-green-800'
                }`}>
                  {status === 'occupied' ? 'Ocupada' : 'Libre'}
                </span>
              </div>
              
              <div className="text-xs text-gray-600 space-y-0.5">
                <div>{table.zone}</div>
                <div>{table.seats} pers.</div>
                
                {summary && (
                  <div className="mt-1 pt-1 border-t border-gray-200 space-y-0.5">
                    <div className="text-xs">
                      <span className="font-medium">{summary.orderCount}</span> ped.
                    </div>
                    <div className="text-xs">
                      <span className="font-medium">{summary.totalItems}</span> items
                    </div>
                    <div className="text-xs">
                      <span className="font-medium">S/ {summary.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      {tables.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No hay mesas disponibles
        </div>
      )}
    </div>
  );
};

export default TableSelection;