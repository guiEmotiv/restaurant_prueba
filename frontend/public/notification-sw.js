// 🔔 Service Worker para notificaciones URGENTES de meseros
self.addEventListener('install', (event) => {
  console.log('🚀 Notification Service Worker instalado - Versión URGENTE');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Notification Service Worker activado - Listo para notificaciones urgentes');
  event.waitUntil(self.clients.claim());
});

// 🔊 Manejar notificaciones mostradas para asegurar que suenen
self.addEventListener('notificationshow', (event) => {
  console.log('🔔 NOTIFICACIÓN MOSTRADA:', event.notification.title);
  console.log('📋 Datos:', event.notification.data);
  
  // Si es urgente, reproducir sonido adicional
  if (event.notification.data && event.notification.data.urgent) {
    console.log('🚨 Notificación URGENTE detectada - activando alertas adicionales');
  }
});

// 👆 Manejar clics en notificaciones URGENTES
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  
  console.log('👆 CLIC EN NOTIFICACIÓN URGENTE');
  console.log('🎯 Acción:', action || 'clic general');
  console.log('📋 Datos:', notification.data);
  console.log('⏰ Hora del clic:', new Date().toLocaleTimeString());
  
  notification.close();

  if (action === 'acknowledge') {
    console.log('✅ Mesero confirmó recepción');
    // Enviar confirmación de recepción
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        console.log(`📡 Enviando confirmación a ${clients.length} clientes activos`);
        clients.forEach(client => {
          client.postMessage({
            action: 'acknowledge',
            data: notification.data
          });
        });
      })
    );
  } else if (action === 'view') {
    console.log('👀 Mesero quiere ver el pedido - abriendo aplicación');
    // Abrir/enfocar la aplicación
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        console.log(`🔍 Buscando ventanas abiertas: ${clients.length} encontradas`);
        
        // Si ya hay una ventana abierta, enfocarla
        for (const client of clients) {
          if (client.url.includes('/operation/')) {
            console.log('🎯 Enfocando ventana existente:', client.url);
            client.focus();
            client.postMessage({
              action: 'view',
              data: notification.data
            });
            return;
          }
        }
        
        // Si no hay ventana abierta, abrir una nueva
        console.log('🆕 Abriendo nueva ventana de la aplicación');
        return self.clients.openWindow('/operation/table-order');
      })
    );
  } else {
    console.log('🔄 Clic general - activando aplicación');
    // Clic general en la notificación - abrir aplicación
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          console.log('📱 Enfocando ventana existente');
          clients[0].focus();
        } else {
          console.log('🆕 Abriendo nueva ventana principal');
          return self.clients.openWindow('/');
        }
      })
    );
  }
});

// ❌ Manejar cierre de notificaciones
self.addEventListener('notificationclose', (event) => {
  console.log('❌ NOTIFICACIÓN CERRADA (sin acción)');
  console.log('🏷️ Tag:', event.notification.tag);
  console.log('📋 Datos:', event.notification.data);
  console.log('⏰ Hora de cierre:', new Date().toLocaleTimeString());
  
  // Si se cerró sin acción, podría indicar que el mesero no la vio
  if (event.notification.data && event.notification.data.urgent) {
    console.warn('⚠️ Notificación URGENTE cerrada sin confirmación - posible problema');
  }
});

// 📨 Escuchar mensajes del cliente
self.addEventListener('message', (event) => {
  console.log('📨 Mensaje recibido en SW:', event.data);
  
  if (event.data && event.data.command === 'SKIP_WAITING') {
    console.log('⏭️ Ejecutando SKIP_WAITING');
    self.skipWaiting();
  }
});