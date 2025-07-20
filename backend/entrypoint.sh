#!/usr/bin/env bash
set -e

echo "🚀 Iniciando aplicación Django..."

# Variables de entorno por defecto
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-restaurant_db}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres123}

echo "📋 Configuración de base de datos:"
echo "  Host: $DB_HOST"
echo "  Puerto: $DB_PORT"
echo "  Base de datos: $DB_NAME"
echo "  Usuario: $DB_USER"
echo "  Password configurado: $([ -n "$DB_PASSWORD" ] && echo "Sí" || echo "No")"

# ─── Verificar que estamos en el directorio correcto ─────────────────
echo "📁 Directorio actual: $(pwd)"
echo "📂 Contenido del directorio:"
ls -la

# ─── Verificar que manage.py existe ──────────────────────────────────
if [ -f "manage.py" ]; then
    echo "✅ Encontrado manage.py en la raíz"
    MANAGE_PATH="manage.py"
elif [ -f "backend/manage.py" ]; then
    echo "✅ Encontrado manage.py en backend/"
    MANAGE_PATH="backend/manage.py"
else
    echo "❌ Error: No se encuentra manage.py"
    echo "📂 Archivos Python encontrados:"
    find . -name "*.py" -type f | head -10
    exit 1
fi

# ─── Espera a PostgreSQL ─────────────────────────────────────────────
echo "⏳ Esperando a que PostgreSQL esté disponible..."

max_attempts=60
attempt=1

while [ $attempt -le $max_attempts ]; do
    echo "Intento $attempt/$max_attempts..."
    
    # Probar conexión con password
    if PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -q; then
        echo "✅ PostgreSQL está listo!"
        
        # Verificar que podemos conectarnos realmente
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -c "SELECT 1;" > /dev/null 2>&1; then
            echo "✅ Conexión a la base de datos verificada!"
            break
        else
            echo "⚠️ pg_isready OK pero no se puede conectar a la BD"
        fi
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Error: No se pudo conectar a PostgreSQL después de $max_attempts intentos"
        echo "🔍 Información de debug:"
        echo "  - Verificar que el servicio 'db' esté corriendo"
        echo "  - Verificar credenciales en archivo .env"
        echo "  - Logs del contenedor de BD: docker-compose logs db"
        exit 1
    fi
    
    sleep 2
    attempt=$((attempt + 1))
done

# ─── Ejecutar migraciones ────────────────────────────────────────────
echo "🔄 Ejecutando migraciones de Django..."
python $MANAGE_PATH migrate --noinput

# ─── Recopilar archivos estáticos ───────────────────────────────────
echo "📁 Recopilando archivos estáticos..."
python $MANAGE_PATH collectstatic --noinput --clear || echo "⚠️  Advertencia: No se pudieron recopilar archivos estáticos"

# ─── Iniciar servidor ────────────────────────────────────────────────
echo "🌟 Iniciando servidor Django en 0.0.0.0:8000..."
exec python $MANAGE_PATH runserver 0.0.0.0:8000