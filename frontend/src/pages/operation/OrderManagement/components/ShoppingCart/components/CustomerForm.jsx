const CustomerForm = ({ 
  customerName, 
  partySize, 
  onCustomerNameChange, 
  onPartySizeChange,
  show = true 
}) => {
  if (!show) return null;

  return (
    <div className="p-6 bg-blue-50 border-b border-blue-100">
      <h3 className="font-semibold text-blue-900 mb-4 text-lg">Información del Cliente</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-lg font-medium text-blue-700 mb-2">
            Nombre del Cliente
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
            placeholder="Ingrese el nombre del cliente"
            className="w-full px-4 py-3 text-lg border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoComplete="off"
          />
        </div>
        
        <div>
          <label className="block text-lg font-medium text-blue-700 mb-2">
            Número de Personas
          </label>
          <input
            type="number"
            value={partySize}
            onChange={(e) => onPartySizeChange(e.target.value)}
            placeholder="Número de comensales"
            min="1"
            max="20"
            className="w-full px-4 py-3 text-lg border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerForm;