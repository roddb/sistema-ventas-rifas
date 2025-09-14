#!/usr/bin/env node

/**
 * EJECUTOR DE PRUEBAS DE CONCURRENCIA CON RESET AUTOMÁTICO
 * 
 * Este script:
 * 1. Resetea los números de prueba
 * 2. Ejecuta las pruebas de concurrencia
 * 3. Muestra los resultados
 */

const BASE_URL = 'http://localhost:3000/api';

// Función para resetear números antes de cada prueba
async function resetTestNumbers(numbers) {
  console.log(`\n🔄 Reseteando números ${numbers.join(', ')} para la prueba...`);
  
  try {
    const response = await fetch(`${BASE_URL}/test/reset-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ Números reseteados exitosamente`);
      return true;
    } else {
      console.error(`❌ Error al resetear:`, data.error);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error de conexión:`, error.message);
    return false;
  }
}

// Función principal
async function main() {
  console.log('\n🚀 INICIANDO PRUEBAS DE CONCURRENCIA\n');
  console.log('📋 Pre-requisitos:');
  console.log('   1. El servidor debe estar corriendo: npm run dev');
  console.log('   2. La BD debe estar configurada y accesible');
  console.log('   3. Este script solo funciona en desarrollo\n');
  
  // Verificar que el servidor esté corriendo
  try {
    const health = await fetch(`${BASE_URL}/numbers`);
    if (!health.ok) {
      throw new Error('El servidor no responde correctamente');
    }
    console.log('✅ Servidor verificado y funcionando\n');
  } catch (error) {
    console.error('❌ ERROR: El servidor no está disponible en http://localhost:3000');
    console.error('   Ejecuta "npm run dev" primero');
    process.exit(1);
  }
  
  // Preguntar qué test ejecutar
  console.log('Selecciona el test a ejecutar:');
  console.log('1. Test básico: 2 usuarios, 1 número');
  console.log('2. Test complejo: 4 usuarios, múltiples números');
  console.log('3. Ambos tests');
  console.log('4. Reset completo de la BD (todos los números)');
  
  // Para automatización, ejecutamos ambos tests
  console.log('\n➡️  Ejecutando ambos tests automáticamente...\n');
  
  // Importar las funciones de test
  const testModule = require('./test-concurrency.js');
  
  // TEST 1: Resetear y ejecutar
  console.log('═'.repeat(60));
  console.log('PREPARANDO TEST 1');
  console.log('═'.repeat(60));
  
  const test1Numbers = [50];
  const reset1 = await resetTestNumbers(test1Numbers);
  
  if (!reset1) {
    console.error('⚠️  No se pudo resetear, pero continuando con el test...');
  }
  
  // Esperar un poco para que la BD se actualice
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Ejecutar Test 1
  await testModule.simulateUser(1, test1Numbers, 0)
    .then(result => console.log('Test 1 Usuario 1:', result.success ? '✅' : '❌'));
    
  await testModule.simulateUser(2, test1Numbers, 100)
    .then(result => console.log('Test 1 Usuario 2:', result.success ? '✅' : '❌'));
  
  console.log('\n' + '═'.repeat(60));
  console.log('TEST 1 COMPLETADO - Revisa los resultados arriba');
  console.log('═'.repeat(60) + '\n');
  
  // Esperar antes del siguiente test
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // TEST 2: Resetear y ejecutar
  console.log('═'.repeat(60));
  console.log('PREPARANDO TEST 2');
  console.log('═'.repeat(60));
  
  const test2Numbers = [100, 101, 102, 103, 104, 105];
  const reset2 = await resetTestNumbers(test2Numbers);
  
  if (!reset2) {
    console.error('⚠️  No se pudo resetear, pero continuando con el test...');
  }
  
  // Esperar un poco
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Ejecutar Test 2 (4 usuarios en paralelo)
  const userConfigs = [
    { userId: 1, numbers: [100, 101, 102] },
    { userId: 2, numbers: [101, 102, 103] },
    { userId: 3, numbers: [102, 103, 104] },
    { userId: 4, numbers: [100, 104, 105] },
  ];
  
  console.log('\n🏁 Ejecutando 4 usuarios en paralelo...\n');
  
  const results = await Promise.all(
    userConfigs.map(config => 
      testModule.simulateUser(
        config.userId, 
        config.numbers, 
        Math.random() * 200
      )
    )
  );
  
  // Analizar resultados
  console.log('\n📊 ANÁLISIS DE RESULTADOS TEST 2:');
  console.log('─'.repeat(40));
  
  const soldNumbers = new Map(); // número -> userId
  let conflicts = [];
  
  results.forEach((result, index) => {
    const config = userConfigs[index];
    if (result.success) {
      console.log(`✅ Usuario ${config.userId}: Compró ${result.numbers.join(', ')}`);
      
      result.numbers.forEach(num => {
        if (soldNumbers.has(num)) {
          conflicts.push({
            number: num,
            users: [soldNumbers.get(num), config.userId]
          });
        }
        soldNumbers.set(num, config.userId);
      });
    } else {
      console.log(`❌ Usuario ${config.userId}: No pudo comprar (${result.reason})`);
    }
  });
  
  console.log('\n📈 RESUMEN FINAL:');
  console.log('─'.repeat(40));
  
  if (conflicts.length === 0) {
    console.log('✅ ¡EXCELENTE! No se detectaron conflictos de sobreventa');
    console.log(`   Total de números vendidos: ${soldNumbers.size}`);
    console.log(`   Usuarios exitosos: ${results.filter(r => r.success).length}`);
  } else {
    console.log('❌ ¡PROBLEMA CRÍTICO! Se detectaron conflictos:');
    conflicts.forEach(conflict => {
      console.log(`   Número ${conflict.number} vendido a usuarios ${conflict.users.join(' y ')}`);
    });
  }
  
  console.log('\n✨ PRUEBAS COMPLETADAS\n');
  console.log('💡 Sugerencias:');
  console.log('   - Revisa los logs del servidor para más detalles');
  console.log('   - Usa "npm run db:studio" para ver el estado de la BD');
  console.log('   - Ejecuta varias veces para probar diferentes timings\n');
}

// Ejecutar
main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});