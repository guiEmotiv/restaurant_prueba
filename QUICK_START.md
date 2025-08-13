# 🚀 QUICK START - Ambiente de Desarrollo

## 📋 Pre-requisitos
- Node.js 18+ 
- Python 3.8+
- AWS CLI configurado
- Git

## ⚡ Inicio Rápido (2 minutos)

### 1. Verificar Configuración
```bash
# Ejecutar diagnóstico automático
./dev-diagnostics.sh
```

### 2. Levantar Backend
```bash
cd backend
python manage.py runserver 0.0.0.0:8000 &
```

### 3. Levantar Frontend
```bash
cd frontend
npm run dev
```

### 4. Login de Prueba
- **URL**: http://localhost:5173
- **Usuario Admin**: Fernando
- **Usuarios Meseros**: Andy, Enrique, Brayan, Keyla  
- **Usuario Cocinero**: Rodrigo

## 🛠️ Solución Rápida de Problemas

### Frontend no carga
```bash
npm run reset
```

### Backend no responde
```bash
cd backend && python manage.py runserver 0.0.0.0:8000
```

### "Mock logout" en consola
```bash
# Verificar que esté configurado correctamente
grep VITE_FORCE_COGNITO frontend/.env
# Debe mostrar: VITE_FORCE_COGNITO=true
```

## 📖 Documentación Completa
Ver `CLAUDE.md` para documentación completa del proyecto.

## 🔧 Scripts Útiles
- `./dev-diagnostics.sh` - Diagnóstico completo
- `npm run reset` - Reset completo del frontend
- `npm run dev:force` - Forzar inicio limpio