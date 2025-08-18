#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 DIAGNOSTIC SCRIPT - Desarrollo
# ═══════════════════════════════════════════════════════════════════════════════

echo "🔍 === DIAGNÓSTICO COMPLETO DEL AMBIENTE DE DESARROLLO ==="
echo ""

# Verificar puertos
echo "📡 === VERIFICANDO PUERTOS ==="
echo "Frontend (5173):"
lsof -i :5173 || echo "❌ Puerto 5173 libre"
echo "Backend (8000):"
lsof -i :8000 || echo "❌ Puerto 8000 libre"
echo ""

# Verificar procesos
echo "⚙️  === VERIFICANDO PROCESOS ==="
echo "Vite:"
ps aux | grep vite | grep -v grep || echo "❌ Vite no está corriendo"
echo "Django:"
ps aux | grep "manage.py runserver" | grep -v grep || echo "❌ Django no está corriendo"
echo ""

# Verificar variables de entorno
echo "🔐 === VERIFICANDO COGNITO ==="
if [ -f "frontend/.env" ]; then
    echo "✅ Archivo .env existe"
    echo "Variables clave:"
    grep -E "VITE_AWS_" frontend/.env
else
    echo "❌ Archivo frontend/.env no encontrado"
fi
echo ""

# Verificar usuarios de Cognito
echo "👥 === USUARIOS DE AWS COGNITO ==="
aws cognito-idp list-users --user-pool-id us-west-2_bdCwF60ZI --region us-west-2 --query 'Users[].Username' --output table 2>/dev/null || echo "❌ No se puede conectar a AWS Cognito"
echo ""

# Test de conectividad
echo "🌐 === TEST DE CONECTIVIDAD ==="
echo "Frontend:"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:5173/ || echo "❌ Frontend no responde"
echo "Backend:"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8000/api/v1/health/ || echo "❌ Backend no responde"
echo ""

echo "✅ === DIAGNÓSTICO COMPLETADO ==="