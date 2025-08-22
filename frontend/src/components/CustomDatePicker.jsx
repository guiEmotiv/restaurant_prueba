import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const CustomDatePicker = ({ selectedDate, onDateChange, maxDate }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Parsear la fecha sin conversión de zona horaria
    const [year, month, day] = selectedDate.split('-').map(Number);
    return { year: year, month: month - 1 }; // month - 1 porque Date usa 0-based months
  });

  const monthNames = useMemo(() => [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ], []);

  const dayNames = useMemo(() => 
    ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], 
    []
  );

  // Actualizar currentMonth cuando selectedDate cambie desde el exterior
  useEffect(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    setCurrentMonth({ year: year, month: month - 1 });
  }, [selectedDate]);

  const formatDateForDisplay = useCallback((dateStr) => {
    // Parsear la fecha como string YYYY-MM-DD sin conversión de zona horaria
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }, []);

  const generateCalendar = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    // Parse maxDate as YYYY-MM-DD to avoid timezone issues
    const [maxYear, maxMonth, maxDay] = maxDate.split('-').map(Number);
    const maxDateObj = new Date(maxYear, maxMonth - 1, maxDay);
    
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = currentDate.getMonth() === month;
      const currentDateStr = currentDate.toISOString().split('T')[0];
      const isSelected = currentDateStr === selectedDate;
      const isToday = currentDate.toDateString() === new Date().toDateString();
      const isDisabled = currentDate > maxDateObj;
      
      days.push({
        date: currentDate,
        day: currentDate.getDate(),
        isCurrentMonth,
        isSelected,
        isToday,
        isDisabled
      });
    }
    
    return days;
  }, [currentMonth, selectedDate, maxDate]);

  const handleDateClick = useCallback((date) => {
    if (!date.isDisabled) {
      const dateStr = date.date.toISOString().split('T')[0];
      onDateChange(dateStr);
      setShowPicker(false);
    }
  }, [onDateChange]);

  const navigateMonth = useCallback((direction) => {
    setCurrentMonth(prev => {
      const newMonth = prev.month + direction;
      if (newMonth < 0) {
        return { year: prev.year - 1, month: 11 };
      } else if (newMonth > 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { ...prev, month: newMonth };
    });
  }, []);

  const togglePicker = useCallback(() => {
    setShowPicker(prev => !prev);
  }, []);

  const closePicker = useCallback(() => {
    setShowPicker(false);
  }, []);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={togglePicker}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-50 transition-colors"
      >
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-sm">{formatDateForDisplay(selectedDate)}</span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
      </button>

      {/* Calendar Dropdown */}
      {showPicker && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={closePicker}
          />
          
          {/* Calendar Panel */}
          <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-4 w-80">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
              
              <span className="font-medium text-gray-900">
                {monthNames[currentMonth.month]} {currentMonth.year}
              </span>
              
              <button
                onClick={() => navigateMonth(1)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-xs font-medium text-gray-500 text-center p-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {generateCalendar.map((day, index) => (
                <button
                  key={index}
                  onClick={() => handleDateClick(day)}
                  disabled={day.isDisabled}
                  className={`
                    p-2 text-sm rounded hover:bg-blue-50 transition-colors
                    ${!day.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                    ${day.isSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                    ${day.isToday && !day.isSelected ? 'bg-blue-100 text-blue-700' : ''}
                    ${day.isDisabled ? 'text-gray-300 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer'}
                  `}
                >
                  {day.day}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomDatePicker;