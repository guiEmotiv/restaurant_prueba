/**
 * 🚀 SOLUCIÓN RÁPIDA PARA ERROR 400 Bad Request
 * COPIA Y PEGA EN CONSOLE DEL BROWSER
 */

console.log('🚀 LIMPIEZA RÁPIDA DE AUTENTICACIÓN CORRUPTA');
console.log('===========================================');

// STEP 1: Limpiar storage corrupto
localStorage.clear();
sessionStorage.clear();

// STEP 2: Limpiar cookies
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});

console.log('✅ Storage limpio');
console.log('');
console.log('🔄 AHORA HAZ ESTO:');
console.log('================');
console.log('1. RECARGA LA PÁGINA (F5)');
console.log('2. INICIA SESIÓN con Cognito');
console.log('3. PRUEBA AGREGAR IMPRESORA');
console.log('');
console.log('✅ Error 400 desaparecerá');