# 🚀 Workflow Optimizado - Restaurant Web

## 📊 Estado Actual del Proyecto

### Servicios Corriendo:
1. **Puerto 3000**: Nginx sirviendo frontend build estático (Docker)
2. **Puerto 5173**: Vite dev server con hot-reload (proceso local)
3. **Puerto 8000**: Django backend API (Docker)

### Problema Identificado:
- Hay **duplicación** de servicios frontend
- El puerto 3000 sirve una versión **estática** del frontend
- El puerto 5173 es el servidor de **desarrollo** con hot-reload

## 🎯 Workflow Optimizado Propuesto

### 1. **Desarrollo Local Simplificado**

#### Opción A: Full Docker Development (Recomendado)
```bash
# Usar solo docker-compose.dev.yml con hot-reload
docker-compose -f docker-compose.dev.yml --profile dev-hot-reload up -d

# Esto levanta:
# - Backend Django: http://localhost:8000
# - Frontend Vite: http://localhost:5173 (con hot-reload)
# - Sin Nginx (no necesario en desarrollo)
```

#### Opción B: Híbrido (Backend Docker + Frontend Local)
```bash
# Backend en Docker
docker-compose -f docker-compose.dev.yml up -d web

# Frontend local con npm
cd frontend && npm run dev

# Servicios:
# - Backend: http://localhost:8000 (Docker)
# - Frontend: http://localhost:5173 (local)
```

### 2. **Scripts Optimizados**

Crear `/scripts/dev.sh`:
```bash
#!/bin/bash
# Script de desarrollo optimizado

echo "🚀 Iniciando ambiente de desarrollo..."

# Detener servicios anteriores
docker-compose -f docker-compose.dev.yml down
pkill -f "npm run dev" || true

# Opción de desarrollo
if [ "$1" = "docker" ]; then
    echo "📦 Modo: Full Docker"
    docker-compose -f docker-compose.dev.yml --profile dev-hot-reload up -d
    echo "✅ Frontend: http://localhost:5173"
    echo "✅ Backend: http://localhost:8000"
    
elif [ "$1" = "hybrid" ]; then
    echo "🔀 Modo: Híbrido"
    docker-compose -f docker-compose.dev.yml up -d web
    cd frontend && npm run dev &
    echo "✅ Frontend: http://localhost:5173 (local)"
    echo "✅ Backend: http://localhost:8000 (docker)"
    
else
    echo "🏠 Modo: Local (default)"
    # Backend local
    cd backend
    source venv/bin/activate 2>/dev/null || python -m venv venv && source venv/bin/activate
    pip install -r requirements-dev.txt
    python manage.py migrate
    python manage.py runserver &
    
    # Frontend local
    cd ../frontend
    npm install
    npm run dev &
    
    echo "✅ Frontend: http://localhost:5173"
    echo "✅ Backend: http://localhost:8000"
fi

echo "📝 Logs: tail -f backend/logs/dev.log"
```

### 3. **Docker Compose Optimizado**

Crear `docker-compose.dev-simple.yml`:
```yaml
version: '3.8'

services:
  # Backend API
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./data:/app/data
    environment:
      - DEBUG=True
      - DJANGO_SETTINGS_MODULE=backend.settings
    env_file:
      - ./backend/.env
    command: python manage.py runserver 0.0.0.0:8000

  # Frontend Dev Server
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run dev -- --host

  # Base de datos (opcional)
  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=restaurant_dev
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### 4. **Comandos Rápidos**

Agregar a `Makefile`:
```makefile
# Desarrollo
dev:
	./scripts/dev.sh

dev-docker:
	./scripts/dev.sh docker

dev-hybrid:
	./scripts/dev.sh hybrid

# Limpiar
clean:
	docker-compose -f docker-compose.dev.yml down
	docker-compose -f docker-compose.prod.yml down
	pkill -f "npm run dev" || true
	pkill -f "python manage.py runserver" || true

# Estado
status:
	@echo "🐳 Docker containers:"
	@docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
	@echo "\n🌐 Local processes:"
	@lsof -i:3000,5173,8000 | grep LISTEN || echo "No local services"

# Logs
logs:
	docker-compose -f docker-compose.dev.yml logs -f

logs-backend:
	docker-compose -f docker-compose.dev.yml logs -f web

logs-frontend:
	tail -f frontend/.vite/dev.log
```

## 🔧 Configuración Recomendada

### 1. **Variables de Entorno**

`.env.development`:
```bash
# Backend
DJANGO_DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Frontend
VITE_API_URL=http://localhost:8000
VITE_DEV_PORT=5173
```

### 2. **VS Code Settings**

`.vscode/settings.json`:
```json
{
  "terminal.integrated.env.osx": {
    "DOCKER_BUILDKIT": "1"
  },
  "launch": {
    "configurations": [
      {
        "name": "Django Backend",
        "type": "python",
        "request": "launch",
        "program": "${workspaceFolder}/backend/manage.py",
        "args": ["runserver"],
        "django": true
      },
      {
        "name": "React Frontend",
        "type": "chrome",
        "request": "launch",
        "url": "http://localhost:5173",
        "webRoot": "${workspaceFolder}/frontend/src"
      }
    ]
  }
}
```

## 📋 Checklist de Optimización

- [ ] Eliminar servicios duplicados
- [ ] Usar un solo puerto para frontend en desarrollo (5173)
- [ ] Simplificar docker-compose para desarrollo
- [ ] Crear scripts de inicio rápido
- [ ] Documentar workflow claramente
- [ ] Configurar hot-reload correctamente
- [ ] Optimizar tiempos de build
- [ ] Reducir uso de recursos

## 🚨 Acciones Inmediatas

1. **Detener Nginx en desarrollo** (puerto 3000 no necesario):
   ```bash
   docker stop restaurant-web-nginx-1
   ```

2. **Usar solo Vite dev server** (puerto 5173):
   ```bash
   # Ya está corriendo en http://localhost:5173
   ```

3. **Simplificar inicio**:
   ```bash
   # En lugar de múltiples comandos, usar:
   make dev
   ```

## 💡 Beneficios del Workflow Optimizado

1. **Más rápido**: Sin builds innecesarios
2. **Más simple**: Un comando para iniciar todo
3. **Menos recursos**: Sin servicios duplicados
4. **Hot-reload**: Cambios instantáneos
5. **Debugging mejorado**: Mejor integración con IDE

## 🎯 Próximos Pasos

1. Implementar scripts optimizados
2. Actualizar documentación
3. Configurar CI/CD para desarrollo
4. Agregar health checks
5. Optimizar Docker images