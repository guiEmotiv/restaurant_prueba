import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../../components/common/Button';

const OrderReceiptMinimal = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  return (
    <div className="space-y-6">
      {/* Header básico */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate('/payment-history')}
          variant="secondary"
          size="sm"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recibo de Pago</h1>
          <p className="text-gray-600">Orden #{id}</p>
        </div>
      </div>

      {/* Contenido mínimo */}
      <div className="bg-white p-4 rounded-lg shadow">
        <p>Orden ID: {id}</p>
        <p>Versión mínima para debugging</p>
      </div>
    </div>
  );
};

export default OrderReceiptMinimal;