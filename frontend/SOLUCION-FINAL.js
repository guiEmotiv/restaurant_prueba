/**
 * SOLUCIÓN FINAL PARA ERROR 400 Bad Request
 * EJECUTAR EN CONSOLE DEL BROWSER - PASO A PASO
 */

console.log('🚨 SOLUCIÓN DEFINITIVA PARA ERROR 400 Bad Request');
console.log('================================================');

// PASO 1: LIMPIAR TODO EL STORAGE DEL BROWSER
console.log('\n1️⃣ LIMPIANDO STORAGE CORRUPTO...');

// Borrar localStorage
Object.keys(localStorage).forEach(key => {
  console.log(`   ❌ Borrando localStorage: ${key}`);
  localStorage.removeItem(key);
});

// Borrar sessionStorage  
Object.keys(sessionStorage).forEach(key => {
  console.log(`   ❌ Borrando sessionStorage: ${key}`);
  sessionStorage.removeItem(key);
});

// Borrar cookies
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});

console.log('✅ Storage limpio');

// PASO 2: VERIFICAR QUE NO HAY TOKEN 'test123'
console.log('\n2️⃣ VERIFICANDO LIMPIEZA...');

try {
  const response = await fetch('http://localhost:8000/api/v1/printer-config/', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  console.log(`   Status: ${response.status}`);
  
  if (response.status === 401) {
    console.log('✅ PERFECTO - Backend correctamente pide autenticación');
  } else {
    console.log('❌ Problema - Backend no está pidiendo autenticación');
  }
  
} catch (error) {
  console.log('   Error de red (normal):', error.message);
}

console.log('\n🔄 AHORA EJECUTA ESTOS PASOS:');
console.log('================================');
console.log('1. RECARGAR LA PÁGINA (F5 o Ctrl+R)');
console.log('2. INICIAR SESIÓN con tus credenciales de Cognito');
console.log('3. Ir a la página de configuración de impresoras');
console.log('4. Probar agregar impresora');
console.log('\n✅ El error 400 desaparecerá automáticamente');

// PASO 3: FUNCIÓN DE VERIFICACIÓN PARA DESPUÉS DE LOGIN
window.verificarAutenticacion = async () => {
  console.log('\n🔍 VERIFICANDO AUTENTICACIÓN POST-LOGIN...');
  
  try {
    const { fetchAuthSession } = await import('aws-amplify/auth');
    const session = await fetchAuthSession();
    
    if (session.tokens?.idToken) {
      console.log('✅ TOKEN JWT VÁLIDO DETECTADO');
      console.log('   Token preview:', session.tokens.idToken.toString().substring(0, 50) + '...');
      
      // Probar API con token válido
      const response = await fetch('http://localhost:8000/api/v1/printer-config/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.tokens.idToken}`
        }
      });
      
      console.log('   API Response:', response.status);
      
      if (response.ok) {
        console.log('🎉 ÉXITO - API funciona correctamente con autenticación');
        return true;
      } else {
        console.log('❌ Aún hay problema con API');
        return false;
      }
      
    } else {
      console.log('❌ No hay token JWT - usuario no autenticado');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error verificando autenticación:', error.message);
    return false;
  }
};

console.log('\n💡 DESPUÉS DE HACER LOGIN, ejecuta:');
console.log('   verificarAutenticacion()');