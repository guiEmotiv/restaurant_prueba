#!/bin/bash

# Script para corregir errores de sintaxis en .env.production

echo "🔧 Corrector de .env.production"
echo "================================"
echo

ENV_FILE="frontend/.env.production"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE no encontrado"
    exit 1
fi

echo "📋 Verificando formato actual..."

# Crear backup
cp "$ENV_FILE" "$ENV_FILE.backup"
echo "✅ Backup creado: $ENV_FILE.backup"

# Corregir errores comunes
echo "🔧 Corrigiendo errores comunes..."

# Corregir : por = (el error reportado)
sed -i.tmp 's/\([A-Z_]*\)[[:space:]]*:[[:space:]]*\(.*\)/\1=\2/' "$ENV_FILE"

# Corregir espacios alrededor del =
sed -i.tmp 's/\([A-Z_]*\)[[:space:]]\+=[[:space:]]\+\(.*\)/\1=\2/' "$ENV_FILE"
sed -i.tmp 's/\([A-Z_]*\)[[:space:]]*=[[:space:]]*\(.*\)/\1=\2/' "$ENV_FILE"

# Limpiar archivos temporales
rm -f "$ENV_FILE.tmp"

echo "✅ Correcciones aplicadas"

echo
echo "📋 Contenido corregido:"
echo "======================="
grep -E '^VITE_' "$ENV_FILE" || echo "No se encontraron variables VITE_"

echo
echo "🔍 Validando formato..."

# Validar formato simple
INVALID_LINES=$(grep -E '^VITE_' "$ENV_FILE" | grep -v -E '^VITE_[A-Z_]+=.*$' | wc -l)

if [ "$INVALID_LINES" -eq 0 ]; then
    echo "✅ Formato válido"
    echo
    echo "🚀 Ahora puedes ejecutar:"
    echo "./deploy/ec2-deploy.sh"
else
    echo "❌ Aún hay errores de formato"
    echo "Por favor revisa manualmente $ENV_FILE"
    echo
    echo "Formato esperado:"
    echo "VITE_AWS_REGION=us-east-1"
    echo "VITE_AWS_COGNITO_USER_POOL_ID=us-east-1_abc123"
    echo "(Sin espacios alrededor del =)"
    exit 1
fi