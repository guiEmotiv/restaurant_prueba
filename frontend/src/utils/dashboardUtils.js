/**
 * Utilities compartidas para los dashboards
 */

// Función para obtener fecha de Perú (UTC-5)
export const getPeruDate = () => {
  const now = new Date();
  const peruDate = new Date(now.getTime() - (5 * 60 * 60 * 1000)); // UTC-5
  return peruDate.toISOString().split('T')[0];
};

// Función memoizada para formatear moneda
export const formatCurrency = (() => {
  const formatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  });
  
  return (amount) => formatter.format(amount || 0);
})();

// Mapas de colores y nombres constantes
export const STATUS_NAMES = {
  'CREATED': 'Creados',
  'PREPARING': 'En Preparación',
  'SERVED': 'Entregados',
  'PAID': 'Pagados'
};

export const STATUS_COLORS = {
  'CREATED': 'bg-yellow-500',
  'PREPARING': 'bg-blue-500',
  'SERVED': 'bg-indigo-500', 
  'PAID': 'bg-green-500'
};

export const PAYMENT_METHOD_NAMES = {
  'CASH': 'Efectivo',
  'CARD': 'Tarjeta',
  'TRANSFER': 'Transferencia',
  'YAPE_PLIN': 'Yape/Plin'
};

export const PAYMENT_METHOD_COLORS = {
  'CASH': 'bg-green-100 text-green-800 border-green-200',
  'CARD': 'bg-blue-100 text-blue-800 border-blue-200',
  'TRANSFER': 'bg-purple-100 text-purple-800 border-purple-200',
  'YAPE_PLIN': 'bg-orange-100 text-orange-800 border-orange-200'
};

export const CATEGORY_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500'];

// Función para obtener color de categoría
export const getCategoryColor = (index) => CATEGORY_COLORS[index % CATEGORY_COLORS.length];

// Función para obtener color de ranking de platos
export const getRankingColor = (index) => {
  if (index === 0) return 'bg-yellow-500';
  if (index === 1) return 'bg-gray-400';
  if (index === 2) return 'bg-orange-600';
  return 'bg-gray-300';
};