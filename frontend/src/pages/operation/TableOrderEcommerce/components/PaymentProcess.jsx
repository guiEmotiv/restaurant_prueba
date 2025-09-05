import { useState, useCallback, useMemo } from 'react';

const PaymentProcess = ({ 
  selectedOrder, 
  selectedTable,
  selectedItems,
  paymentMethod,
  paymentDescription,
  withPrinting,
  bluetoothConnected,
  connectingBluetooth,
  onItemSelection,
  onSelectAllServedItems,
  onPaymentMethodChange,
  onPaymentDescriptionChange,
  onPrintingToggle,
  onBluetoothToggle,
  onProcessPayment,
  onPrintFullReceipt,
  paymentProcessing,
  getItemStatusColor,
  areAllItemsPaid
}) => {
  const [localPaymentMethod, setLocalPaymentMethod] = useState(paymentMethod || 'CASH');

  const handleMethodChange = useCallback((method) => {
    setLocalPaymentMethod(method);
    onPaymentMethodChange(method);
  }, [onPaymentMethodChange]);

  // Calcular total de items seleccionados
  const selectedTotal = useMemo(() => {
    return selectedOrder.items
      .filter(item => selectedItems.includes(item.id))
      .reduce((sum, item) => sum + parseFloat(item.total_with_container || item.total_price || 0), 0);
  }, [selectedOrder.items, selectedItems]);

  // Items servidos disponibles para pago
  const servedItems = useMemo(() => 
    selectedOrder.items.filter(item => item.status === 'SERVED' && !item.is_fully_paid),
    [selectedOrder.items]
  );

  // Items ya pagados
  const paidItems = useMemo(() => 
    selectedOrder.items.filter(item => item.status === 'PAID' || item.is_fully_paid),
    [selectedOrder.items]
  );

  // Items en preparación
  const preparingItems = useMemo(() => 
    selectedOrder.items.filter(item => item.status === 'PREPARING'),
    [selectedOrder.items]
  );

  // Items creados/pendientes
  const createdItems = useMemo(() => 
    selectedOrder.items.filter(item => item.status === 'CREATED'),
    [selectedOrder.items]
  );

  const paymentMethods = [
    { value: 'CASH', label: 'Efectivo' },
    { value: 'CARD', label: 'Tarjeta' },
    { value: 'YAPE_PLIN', label: 'Yape' },
    { value: 'TRANSFER', label: 'Transfer' }
  ];

  if (!selectedOrder) {
    return <div>No hay orden seleccionada</div>;
  }

  return (
    <div className="space-y-3">
      {/* Información del pedido */}
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-gray-900">
          Pedido #{selectedOrder.id} - Mesa {selectedTable?.table_number}
        </span>
        <span className="text-gray-600">
          Total: S/ {selectedOrder.items
            ?.reduce((sum, item) => sum + parseFloat(item.total_with_container || item.total_price || 0), 0)
            .toFixed(2) || '0.00'}
        </span>
      </div>

      {/* Lista de items */}
      <div className="bg-white border border-gray-200">
        {servedItems.length > 0 && (
          <div className="p-2 border-b bg-gray-50 flex justify-between items-center">
            <span className="text-xs text-gray-600">Seleccionar para pago</span>
            <button
              onClick={onSelectAllServedItems}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {servedItems.every(item => selectedItems.includes(item.id))
                ? 'Deseleccionar' 
                : 'Seleccionar todos'
              }
            </button>
          </div>
        )}

        <div className="divide-y">
          {/* Items SERVED (disponibles para pago) */}
          {servedItems.map(item => (
            <div key={item.id} className="p-2 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={() => onItemSelection(item.id)}
                  className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                />
                <div 
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${getItemStatusColor('SERVED')}`} 
                  title="Servido"
                />
                <div className="flex-1 min-w-0 flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">
                      {item.quantity}x {item.recipe_name}
                      {item.is_takeaway && (
                        <span className="text-xs text-blue-600 ml-1">(delivery)</span>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-gray-500 italic truncate">{item.notes}</div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-900 ml-2">
                    S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Items ya PAID (bloqueados) */}
          {paidItems.map(item => (
            <div key={item.id} className="p-2 bg-gray-50 opacity-70">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  className="h-3 w-3 text-gray-400 border-gray-300 rounded opacity-50 cursor-not-allowed"
                />
                <div 
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${getItemStatusColor('PAID')}`} 
                  title="Pagado"
                />
                <div className="flex-1 min-w-0 flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-600 truncate">
                      {item.quantity}x {item.recipe_name}
                      {item.is_takeaway && (
                        <span className="text-xs text-blue-600 ml-1">(delivery)</span>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-gray-500 italic truncate">{item.notes}</div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-600 ml-2">
                    S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Items PREPARING (no disponibles) */}
          {preparingItems.map(item => (
            <div key={item.id} className="p-2 bg-gray-50 opacity-60">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  className="h-3 w-3 text-gray-400 border-gray-300 rounded opacity-50 cursor-not-allowed"
                />
                <div 
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${getItemStatusColor('PREPARING')}`} 
                  title="En Preparación"
                />
                <div className="flex-1 min-w-0 flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-600 truncate">
                      {item.quantity}x {item.recipe_name}
                      {item.is_takeaway && (
                        <span className="text-xs text-blue-600 ml-1">(delivery)</span>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-gray-500 italic truncate">{item.notes}</div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-600 ml-2">
                    S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Items CREATED (no disponibles) */}
          {createdItems.map(item => (
            <div key={item.id} className="p-2 bg-gray-50 opacity-60">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  className="h-3 w-3 text-gray-400 border-gray-300 rounded opacity-50 cursor-not-allowed"
                />
                <div 
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${getItemStatusColor('CREATED')}`} 
                  title="Pendiente"
                />
                <div className="flex-1 min-w-0 flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-600 truncate">
                      {item.quantity}x {item.recipe_name}
                      {item.is_takeaway && (
                        <span className="text-xs text-blue-600 ml-1">(delivery)</span>
                      )}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-gray-500 italic truncate">{item.notes}</div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-600 ml-2">
                    S/ {parseFloat(item.total_with_container || item.total_price || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {servedItems.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            {paidItems.length > 0 
              ? 'Todos los items disponibles ya han sido pagados'
              : 'No hay items listos para pago'
            }
          </div>
        )}
      </div>

      {/* Configuración de pago */}
      {selectedItems.length > 0 && (
        <div className="bg-white border border-gray-200 p-2 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">{selectedItems.length} item(s)</span>
            <span className="font-medium text-gray-900">
              S/ {selectedTotal.toFixed(2)}
            </span>
          </div>

          {/* Método de pago */}
          <div>
            <div className="flex gap-1">
              {paymentMethods.map(method => (
                <button
                  key={method.value}
                  onClick={() => handleMethodChange(method.value)}
                  className={`flex-1 py-2 px-3 text-sm border rounded ${
                    localPaymentMethod === method.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción/Notas */}
          <div>
            <textarea
              value={paymentDescription}
              onChange={(e) => onPaymentDescriptionChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>

          {/* Opciones */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="withPrinting"
                checked={withPrinting}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onPrintingToggle(checked);
                  onBluetoothToggle(checked);
                }}
                disabled={connectingBluetooth}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded disabled:opacity-50"
              />
              <label htmlFor="withPrinting" className="text-sm text-gray-700">
                Imprimir
              </label>
              {withPrinting && (
                <span className="text-xs">
                  {connectingBluetooth ? (
                    <span className="text-yellow-600">Conectando...</span>
                  ) : bluetoothConnected ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-red-600">✗</span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Botón procesar pago */}
          <button
            onClick={onProcessPayment}
            disabled={paymentProcessing}
            className="w-full bg-green-600 text-white py-3 px-4 text-base rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paymentProcessing ? 'Procesando...' : 'Procesar Pago'}
          </button>
        </div>
      )}

      {/* Botón imprimir comprobante completo */}
      {areAllItemsPaid(selectedOrder) && (
        <div className="mt-2">
          <button
            onClick={onPrintFullReceipt}
            className="w-full bg-blue-600 text-white py-2 px-3 text-sm hover:bg-blue-700"
          >
            Imprimir Comprobante Completo
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentProcess;