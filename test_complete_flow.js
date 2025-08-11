#!/usr/bin/env node

/**
 * Diagnóstico Completo del Sistema - Restaurant Web
 * Simula el flujo completo de la aplicación desde frontend
 */

const API_BASE = 'https://www.xn--elfogndedonsoto-zrb.com/api/v1';

async function testCompleteFlow() {
    console.log('🔍 DIAGNÓSTICO COMPLETO DEL SISTEMA');
    console.log('=================================\n');
    
    try {
        // 1. Test Health Check
        console.log('1️⃣ Probando Health Check...');
        let response = await fetch(`${API_BASE}/health/`);
        let health = await response.json();
        console.log('✅ Health Check:', health.status, health.message);
        
        // 2. Test Tables Endpoint  
        console.log('\n2️⃣ Probando endpoint de Mesas...');
        response = await fetch(`${API_BASE}/tables/`);
        if (response.ok) {
            let tables = await response.json();
            console.log(`✅ Mesas cargadas: ${tables.length}`);
            
            // Encontrar una mesa con orden activa
            const activeTable = tables.find(t => t.active_orders_count > 0);
            if (activeTable) {
                console.log(`📍 Mesa con orden activa: ${activeTable.table_number} (${activeTable.active_orders_count} órdenes)`);
                
                // 3. Test buscar orden activa
                console.log('\n3️⃣ Probando buscar órdenes activas...');
                response = await fetch(`${API_BASE}/orders/?status=CREATED`);
                if (response.ok) {
                    let activeOrders = await response.json();
                    const tableOrder = activeOrders.find(o => o.table_number === activeTable.table_number);
                    
                    if (tableOrder) {
                        console.log(`✅ Orden encontrada: ID ${tableOrder.id}, ${tableOrder.items_count} items`);
                        
                        // 4. Test obtener detalles de la orden
                        console.log('\n4️⃣ Probando obtener detalles de orden...');
                        response = await fetch(`${API_BASE}/orders/${tableOrder.id}/`);
                        if (response.ok) {
                            let orderDetails = await response.json();
                            console.log(`✅ Detalles obtenidos: Total $${orderDetails.grand_total}, Items: ${orderDetails.items?.length || 0}`);
                            
                            // 5. Test obtener recetas disponibles
                            console.log('\n5️⃣ Probando obtener recetas...');
                            response = await fetch(`${API_BASE}/recipes/`);
                            if (response.ok) {
                                let recipes = await response.json();
                                console.log(`✅ Recetas disponibles: ${recipes.length}`);
                                
                                if (recipes.length > 0) {
                                    // 6. Test agregar item a orden existente
                                    console.log('\n6️⃣ Probando agregar item a orden...');
                                    const testRecipe = recipes[0];
                                    
                                    const addItemData = {
                                        recipe: testRecipe.id,
                                        quantity: 1,
                                        notes: `Test item - ${new Date().toISOString()}`
                                    };
                                    
                                    response = await fetch(`${API_BASE}/orders/${tableOrder.id}/add_item/`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify(addItemData)
                                    });
                                    
                                    if (response.ok) {
                                        let newItem = await response.json();
                                        console.log(`✅ Item agregado exitosamente: ${newItem.recipe_name} ($${newItem.total_price})`);
                                        
                                        // 7. Verificar que la orden se actualizó
                                        console.log('\n7️⃣ Verificando orden actualizada...');
                                        response = await fetch(`${API_BASE}/orders/${tableOrder.id}/`);
                                        if (response.ok) {
                                            let updatedOrder = await response.json();
                                            console.log(`✅ Orden actualizada: Items ${updatedOrder.items?.length || 0}, Total $${updatedOrder.grand_total}`);
                                            console.log(`✅ FLUJO COMPLETO EXITOSO - El sistema funciona correctamente`);
                                        } else {
                                            console.log(`❌ Error verificando orden: ${response.status}`);
                                        }
                                    } else {
                                        const errorText = await response.text();
                                        console.log(`❌ Error agregando item: ${response.status}`);
                                        console.log(`   Error details: ${errorText}`);
                                        
                                        // Análisis del error
                                        if (response.status === 500) {
                                            console.log('🔍 ANÁLISIS: Error 500 sugiere problema en backend Django');
                                        } else if (response.status === 401 || response.status === 403) {
                                            console.log('🔍 ANÁLISIS: Error de autenticación - frontend necesita token JWT');
                                        } else if (response.status === 404) {
                                            console.log('🔍 ANÁLISIS: Endpoint no encontrado - revisar URLs');
                                        }
                                    }
                                }
                            } else {
                                console.log(`❌ Error obteniendo recetas: ${response.status}`);
                            }
                        } else {
                            console.log(`❌ Error obteniendo detalles de orden: ${response.status}`);
                        }
                    } else {
                        console.log('❌ No se encontró orden para la mesa activa');
                    }
                } else {
                    console.log(`❌ Error obteniendo órdenes activas: ${response.status}`);
                }
            } else {
                console.log('⚠️ No hay mesas con órdenes activas para probar');
            }
        } else {
            console.log(`❌ Error obteniendo mesas: ${response.status}`);
            const errorText = await response.text();
            console.log(`   Error details: ${errorText.substring(0, 200)}`);
        }
        
    } catch (error) {
        console.log('❌ Error de red:', error.message);
        console.log('🔍 ANÁLISIS: Posible problema de CORS o conectividad');
    }
    
    console.log('\n=================================');
    console.log('🏁 Diagnóstico completado');
    console.log('=================================');
}

// Para Node.js, necesitamos fetch
if (typeof fetch === 'undefined') {
    console.log('⚠️ Este script necesita un entorno con fetch disponible');
    console.log('   Ejecutar en navegador o instalar node-fetch');
    process.exit(1);
}

testCompleteFlow();