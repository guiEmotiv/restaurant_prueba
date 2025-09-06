# 🥧 Proxy de Impresión - Raspberry Pi 4

## Instalación Rápida

1. **Transferir archivos al Raspberry Pi:**
   ```bash
   # Desde tu máquina local
   scp printer-proxy.tar.gz pi@192.168.1.100:/home/pi/
   ```

2. **Instalar en Raspberry Pi:**
   ```bash
   # En el Raspberry Pi
   cd /home/pi
   tar -xzf printer-proxy.tar.gz
   chmod +x install-raspberry.sh
   bash install-raspberry.sh
   ```

3. **Verificar funcionamiento:**
   ```bash
   curl http://localhost:3001/status
   pm2 status printer-proxy
   ```

## Comandos Útiles

### Control del servicio
```bash
# Ver estado
pm2 status printer-proxy

# Ver logs
pm2 logs printer-proxy

# Reiniciar
pm2 restart printer-proxy

# Detener
pm2 stop printer-proxy

# Iniciar
pm2 start printer-proxy
```

### Diagnóstico
```bash
# Probar conectividad con impresora
curl -X POST http://localhost:3001/test/kitchen

# Ver logs del sistema
sudo journalctl -u pm2-pi

# Verificar red
ping 192.168.1.23  # IP de la impresora
```

## Solución de Problemas

### 1. Servicio no inicia
```bash
# Verificar Node.js
node --version
npm --version

# Reinstalar dependencias
cd /home/pi/printer-proxy
npm install
pm2 restart printer-proxy
```

### 2. No se conecta a la impresora
```bash
# Verificar conectividad
ping 192.168.1.23
telnet 192.168.1.23 9100

# Revisar configuración
cat .env
```

### 3. Cliente no puede conectar al proxy
```bash
# Verificar firewall
sudo ufw status

# Permitir puerto 3001
sudo ufw allow 3001

# Verificar que escucha en todas las interfaces
netstat -tlnp | grep 3001
```

## Red

- **Raspberry Pi:** 192.168.1.100:3001
- **Impresora Cocina:** 192.168.1.23:9100
- **Tablets/PCs:** Acceden al proxy para imprimir

El proxy actúa como puente entre la aplicación en EC2 y la impresora local.