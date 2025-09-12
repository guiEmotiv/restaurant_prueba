const CartSummary = ({ cartTotal, orderTotal, grandTotal }) => {
  if (grandTotal === 0) return null;

  return (
    <div className="p-6 bg-gray-50 border-b border-gray-200">
      {/* Solo mostrar el total general */}
      <div className="flex justify-between items-center text-xl font-semibold">
        <span className="text-gray-900">Total General:</span>
        <span className="text-blue-600">S/ {grandTotal.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default CartSummary;