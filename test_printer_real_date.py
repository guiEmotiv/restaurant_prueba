#!/usr/bin/env python3
"""Deep diagnostic of printer date/time output"""

import sys
import os
sys.path.insert(0, '/home/gsz/restaurant_prueba/backend')

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

from django.utils import timezone
from datetime import datetime
import pytz
from operation.models import PrinterConfig

def test_date_formats():
    """Test various date/time formats and sources"""

    print("=" * 60)
    print("DIAGNÓSTICO PROFUNDO DE FECHA Y HORA")
    print("=" * 60)

    # 1. Sistema operativo
    import subprocess
    system_date = subprocess.run(['date'], capture_output=True, text=True).stdout.strip()
    print(f"1. Fecha del SO: {system_date}")

    # 2. Python datetime
    python_now = datetime.now()
    print(f"2. Python datetime.now(): {python_now}")

    # 3. Django timezone
    django_now = timezone.now()
    print(f"3. Django timezone.now(): {django_now}")

    # 4. Perú timezone
    peru_tz = pytz.timezone('America/Lima')
    peru_now = django_now.astimezone(peru_tz)
    print(f"4. Perú timezone: {peru_now}")

    # 5. Función de corrección
    def get_corrected_peru_time():
        """Obtener hora correcta de Perú"""
        peru_tz = pytz.timezone('America/Lima')
        system_time = timezone.now().astimezone(peru_tz)

        if system_time.year == 2025:
            print(f"   ⚠️  Sistema detectado con fecha incorrecta: {system_time}")
            corrected_time = system_time.replace(year=2024)
            print(f"   ✅ Fecha corregida: {corrected_time}")
            return corrected_time

        return system_time

    corrected_time = get_corrected_peru_time()
    print(f"5. Fecha corregida: {corrected_time}")

    print("\n" + "=" * 60)
    print("FORMATOS DE SALIDA")
    print("=" * 60)

    test_formats = [
        ('%d/%m/%Y', 'DD/MM/YYYY'),
        ('%m/%d/%Y', 'MM/DD/YYYY (US)'),
        ('%Y-%m-%d', 'YYYY-MM-DD (ISO)'),
        ('%d-%m-%Y', 'DD-MM-YYYY'),
        ('%A, %d de %B de %Y', 'Formato extenso'),
    ]

    for fmt, desc in test_formats:
        formatted = corrected_time.strftime(fmt)
        print(f"{desc:20}: {formatted}")

    time_formats = [
        ('%H:%M:%S', '24h format'),
        ('%I:%M:%S %p', '12h format'),
        ('%H:%M', '24h sin segundos'),
    ]

    print("\nFormatos de hora:")
    for fmt, desc in time_formats:
        formatted = corrected_time.strftime(fmt)
        print(f"{desc:20}: {formatted}")

def test_printer_content():
    """Generate actual printer content to verify"""

    print("\n" + "=" * 60)
    print("CONTENIDO REAL DE IMPRESIÓN")
    print("=" * 60)

    # Simular lo que hace el test_connection
    from django.utils import timezone
    import pytz

    def get_corrected_peru_time():
        peru_tz = pytz.timezone('America/Lima')
        system_time = timezone.now().astimezone(peru_tz)

        if system_time.year == 2025:
            corrected_time = system_time.replace(year=2024)
            return corrected_time

        return system_time

    now_peru = get_corrected_peru_time()

    test_content = f"""
================================
      PRUEBA DE IMPRESORA
================================
Impresora: TEST_PRINTER
Puerto: /dev/usb/lp0
Fecha: {now_peru.strftime('%d/%m/%Y')}
Hora: {now_peru.strftime('%H:%M:%S')}
Zona: America/Lima (UTC-5)
================================
Test de conectividad exitoso
Sistema de Restaurant
================================

\\x1B\\x6D""".strip()

    print("CONTENIDO QUE SE ENVÍA A LA IMPRESORA:")
    print("-" * 40)
    print(test_content)
    print("-" * 40)

    # Verificar si existe la impresora
    try:
        printer = PrinterConfig.objects.first()
        if printer:
            print(f"\n📋 Impresora encontrada: {printer.name}")
            print(f"   Puerto: {printer.usb_port}")

            # Verificar si el puerto existe
            import os
            if os.path.exists(printer.usb_port):
                print(f"   ✅ Puerto USB existe: {printer.usb_port}")

                # Test real de escritura
                try:
                    with open(printer.usb_port, 'wb') as usb_printer:
                        usb_printer.write(test_content.encode('utf-8'))
                        usb_printer.flush()
                    print("   ✅ Test de escritura USB exitoso")
                    print("   📄 Revisa la impresora física para ver el resultado")
                except Exception as e:
                    print(f"   ❌ Error escribiendo a USB: {e}")
            else:
                print(f"   ❌ Puerto USB no existe: {printer.usb_port}")
        else:
            print("❌ No hay impresoras configuradas")
    except Exception as e:
        print(f"❌ Error accediendo a impresoras: {e}")

if __name__ == "__main__":
    test_date_formats()
    test_printer_content()

    print("\n" + "=" * 60)
    print("¿QUÉ DEBES VERIFICAR EN LA IMPRESORA FÍSICA?")
    print("=" * 60)
    print("1. ¿Muestra fecha 12/09/2024 o 12/09/2025?")
    print("2. ¿La hora coincide con la hora actual de Perú?")
    print("3. ¿El formato es DD/MM/YYYY o MM/DD/YYYY?")
    print("4. ¿Dice 'America/Lima (UTC-5)'?")
    print("=" * 60)