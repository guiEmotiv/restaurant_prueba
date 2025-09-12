# 🔐 Sistema de Autenticación Django - Restaurant Management

## ✅ Sistema Implementado

Hemos implementado un **sistema completo de autenticación Django** que reemplaza AWS Cognito con:

### **🎯 Características:**
- ✅ Autenticación Django estándar (username/password)
- ✅ Sistema de grupos y permisos por rol
- ✅ Base de datos SQLite para desarrollo
- ✅ Setup automático de usuarios y grupos
- ✅ Frontend React integrado con Django auth
- ✅ API endpoints de autenticación

## 🚀 Inicio Rápido

### **1. Configurar Variables de Entorno:**
```bash
cp .env.example .env
```

### **2. Iniciar Sistema Completo:**
```bash
./start-dev.sh
```

**¡Eso es todo!** El script automáticamente:
- Configura el entorno virtual Python
- Instala dependencias backend y frontend
- Configura la base de datos SQLite
- Crea el usuario administrador
- Configura grupos y permisos
- Inicia ambos servidores

## 🎯 Acceso al Sistema

### **URLs:**
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/api/v1
- **Admin Panel:** http://localhost:8000/admin

### **Usuarios del Restaurante:**

#### **👨‍💼 Administradores:**
- **fernando** / `Theboss01@!` - Administrador principal
- **admin** / `admin123` - Usuario demo

#### **🍽️ Meseros:**
- **brayan** / `Mesero010@!` - Mesero
- **keyla** / `Mesero012@!` - Mesero  
- **enrique** / `Mesero013@!` - Mesero
- **andy** / `Mesero014@!` - Mesero

#### **👨‍🍳 Cocineros:**
- **rodrigo** / `Cusicusa02@!` - Cocinero

## 👥 Sistema de Roles

### **Roles Disponibles:**

#### **🔧 Administradores**
- Acceso completo al sistema
- Gestión de configuración, inventario, órdenes
- Acceso al panel de Django Admin
- Puede crear/editar usuarios

#### **👔 Gerentes**
- Dashboard y reportes
- Gestión de inventario y stock
- Supervisión de órdenes y pagos
- Sin acceso a configuración del sistema

#### **🍽️ Meseros**
- Gestión de pedidos y mesas
- Crear y modificar órdenes
- Ver estado de mesas
- Sin acceso a pagos

#### **👨‍🍳 Cocineros**
- Panel de cocina
- Ver órdenes para preparar
- Actualizar estado de preparación
- Gestión de cola de impresión

#### **💰 Cajeros**
- Procesamiento de pagos
- Historial de transacciones
- Sin acceso a gestión de órdenes

## 🛠️ Gestión de Usuarios

### **Crear Usuarios (Admin Panel):**
1. Ve a http://localhost:8000/admin
2. Login con `admin/admin123`
3. **Users** → **Add user**
4. Asignar al grupo correspondiente
5. Configurar permisos según el rol

### **Crear Usuarios (API):**
```bash
curl -X POST http://localhost:8000/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "mesero1",
    "password": "password123",
    "email": "mesero1@restaurant.com",
    "first_name": "Juan",
    "last_name": "Pérez",
    "groups": ["Meseros"]
  }'
```

## 🔧 API Endpoints de Autenticación

### **Login:**
```bash
POST /api/v1/auth/login/
{
  "username": "admin",
  "password": "admin123"
}
```

### **Logout:**
```bash
POST /api/v1/auth/logout/
```

### **Estado del Usuario:**
```bash
GET /api/v1/auth/status/
```

### **Lista de Usuarios (Admin):**
```bash
GET /api/v1/auth/users/
```

## 🏗️ Arquitectura Técnica

### **Backend:**
- **Django 5.2** con REST Framework
- **SQLite** para desarrollo
- **Session-based authentication**
- **Django Groups & Permissions**
- **Management commands** para setup

### **Frontend:**
- **React + Vite** con TailwindCSS
- **Axios** para llamadas API
- **Context API** para estado global
- **Session cookies** para autenticación

### **Estructura de Archivos:**
```
backend/
├── backend/auth_views.py       # Vistas de autenticación
├── backend/auth_urls.py        # URLs de auth
├── config/management/commands/
│   └── setup_groups.py         # Comando para grupos
frontend/src/
├── contexts/AuthContext.jsx    # Context de autenticación
└── components/auth/
    └── LoginForm.jsx           # Formulario de login
```

## 🔄 Comandos Útiles

### **Resetear Grupos y Permisos:**
```bash
cd backend/
python manage.py setup_groups
```

### **Crear Usuarios del Restaurante:**
```bash
cd backend/
python manage.py create_restaurant_users
```

### **Crear Superusuario:**
```bash
cd backend/
python manage.py createsuperuser
```

### **Ver Estado de Base de Datos:**
```bash
cd backend/
python manage.py shell -c "
from django.contrib.auth.models import User, Group
print(f'Users: {User.objects.count()}')
print(f'Groups: {Group.objects.count()}')
"
```

## 🛡️ Seguridad

### **Configuraciones Aplicadas:**
- ✅ CSRF Protection habilitado
- ✅ CORS configurado para desarrollo
- ✅ Session cookies seguros
- ✅ Validación de permisos por endpoint
- ✅ Sanitización de inputs

### **Para Producción (Futuro):**
- Usar PostgreSQL en lugar de SQLite
- Configurar HTTPS
- Variables de entorno seguras
- Rate limiting
- Backup de base de datos

## 🆘 Solución de Problemas

### **Error: "No module named 'django'"**
```bash
cd backend/
source venv/bin/activate  # o .\venv\Scripts\activate en Windows
pip install -r requirements.txt
```

### **Error: "Connection refused"**
```bash
# Verificar que ambos servidores estén corriendo
ps aux | grep python  # Backend en puerto 8000
ps aux | grep node    # Frontend en puerto 5173
```

### **Error: "CSRF token missing"**
```bash
# El frontend debe obtener el token CSRF primero
curl http://localhost:8000/csrf/
```

### **Reset Completo:**
```bash
rm backend/data/restaurant.sqlite3
./start-dev.sh
```

## 🎉 ¡Listo para Usar!

El sistema está completamente configurado y listo para desarrollo. Todos los componentes trabajan juntos:

1. **✅ Backend Django** con autenticación completa
2. **✅ Frontend React** integrado con login/logout
3. **✅ Base de datos SQLite** con datos de prueba
4. **✅ Sistema de roles** y permisos configurado
5. **✅ Usuario admin** creado automáticamente

**¡Simplemente ejecuta `./start-dev.sh` y comienza a desarrollar!** 🚀