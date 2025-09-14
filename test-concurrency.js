/**
 * SCRIPT DE PRUEBA DE CONCURRENCIA
 * Simula múltiples usuarios tratando de comprar los mismos números simultáneamente
 */

const BASE_URL = 'http://localhost:3000/api';

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Función auxiliar para hacer peticiones
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Función para simular un usuario intentando comprar
async function simulateUser(userId, numbers, delayMs = 0) {
  const userColor = colors[['cyan', 'magenta', 'yellow', 'blue'][userId % 4]];
  const log = (msg) => console.log(`${userColor}[Usuario ${userId}]${colors.reset} ${msg}`);
  
  // Esperar el delay especificado
  if (delayMs > 0) {
    log(`⏱️  Esperando ${delayMs}ms antes de iniciar...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  log(`🎯 Intentando comprar números: ${numbers.join(', ')}`);
  
  // Paso 1: Verificar disponibilidad
  log('🔍 Verificando disponibilidad...');
  const verifyResult = await fetchAPI('/numbers/verify', {
    method: 'POST',
    body: JSON.stringify({ numbers })
  });
  
  if (!verifyResult.ok) {
    log(`❌ Error al verificar: ${verifyResult.data?.error || 'Error desconocido'}`);
    return { success: false, reason: 'verify_failed' };
  }
  
  if (!verifyResult.data.available) {
    log(`⚠️  Números no disponibles: ${verifyResult.data.unavailableNumbers?.join(', ')}`);
    return { success: false, reason: 'unavailable', unavailableNumbers: verifyResult.data.unavailableNumbers };
  }
  
  log('✅ Números disponibles, procediendo con la compra...');
  
  // Paso 2: Crear la compra
  const purchaseData = {
    buyerName: `Usuario Test ${userId}`,
    studentName: `Hijo Usuario ${userId}`,
    division: 'A',
    course: '5to',
    email: `usuario${userId}@test.com`,
    phone: `11${userId}0000000`,
    numbers: numbers,
    totalAmount: numbers.length * 2000
  };
  
  log('📝 Enviando datos de compra...');
  const purchaseResult = await fetchAPI('/purchase', {
    method: 'POST',
    body: JSON.stringify(purchaseData)
  });
  
  if (!purchaseResult.ok || !purchaseResult.data.success) {
    log(`❌ Error al crear compra: ${purchaseResult.data?.error || purchaseResult.data?.message || 'Error desconocido'}`);
    if (purchaseResult.data?.unavailableNumbers) {
      log(`🔴 Números que ya no estaban disponibles: ${purchaseResult.data.unavailableNumbers.join(', ')}`);
    }
    return { 
      success: false, 
      reason: 'purchase_failed', 
      error: purchaseResult.data?.error,
      unavailableNumbers: purchaseResult.data?.unavailableNumbers 
    };
  }
  
  log(`✅ Compra creada exitosamente! ID: ${purchaseResult.data.purchaseId}`);
  log(`📋 Números reservados: ${purchaseResult.data.reservedNumbers?.join(', ') || numbers.join(', ')}`);
  
  // Paso 3: Simular confirmación de pago
  log('💳 Simulando confirmación de pago...');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simular delay de procesamiento
  
  const confirmResult = await fetchAPI('/payment/confirm', {
    method: 'POST',
    body: JSON.stringify({ 
      purchaseId: purchaseResult.data.purchaseId 
    })
  });
  
  if (confirmResult.ok) {
    log(`🎉 ${colors.green}${colors.bright}¡COMPRA EXITOSA!${colors.reset} Números ${numbers.join(', ')} vendidos a Usuario ${userId}`);
    return { 
      success: true, 
      purchaseId: purchaseResult.data.purchaseId,
      numbers: numbers
    };
  } else {
    log(`⚠️  Error al confirmar pago: ${confirmResult.data?.error}`);
    return { success: false, reason: 'payment_failed' };
  }
}

// TEST 1: Dos usuarios intentan comprar el mismo número
async function test1_SameNumber() {
  console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}TEST 1: Dos usuarios intentan comprar el MISMO número${colors.reset}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const targetNumbers = [50]; // Ambos quieren el número 50
  
  // Ejecutar ambos usuarios en paralelo (verdadera concurrencia)
  const [result1, result2] = await Promise.all([
    simulateUser(1, targetNumbers, 0),    // Usuario 1 sin delay
    simulateUser(2, targetNumbers, 100)   // Usuario 2 con 100ms de delay
  ]);
  
  // Analizar resultados
  console.log(`\n${colors.bright}📊 RESULTADOS TEST 1:${colors.reset}`);
  
  const successCount = [result1, result2].filter(r => r.success).length;
  
  if (successCount === 1) {
    console.log(`${colors.green}✅ PRUEBA EXITOSA: Solo UN usuario pudo comprar el número 50${colors.reset}`);
    console.log(`   Usuario 1: ${result1.success ? '✅ Compró' : '❌ No pudo comprar'}`);
    console.log(`   Usuario 2: ${result2.success ? '✅ Compró' : '❌ No pudo comprar'}`);
  } else if (successCount === 0) {
    console.log(`${colors.yellow}⚠️  ADVERTENCIA: Ningún usuario pudo comprar (posible error de sistema)${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ FALLO CRÍTICO: ¡AMBOS usuarios compraron el mismo número!${colors.reset}`);
    console.log(`${colors.red}   ¡ESTO ES UN PROBLEMA DE SOBREVENTA!${colors.reset}`);
  }
}

// TEST 2: Múltiples usuarios compitiendo por varios números
async function test2_MultipleUsersMultipleNumbers() {
  console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}TEST 2: 4 usuarios compitiendo por números superpuestos${colors.reset}`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Configurar qué números quiere cada usuario
  const userRequests = [
    { userId: 1, numbers: [100, 101, 102] },      // Usuario 1 quiere 100, 101, 102
    { userId: 2, numbers: [101, 102, 103] },      // Usuario 2 quiere 101, 102, 103 (conflicto en 101, 102)
    { userId: 3, numbers: [102, 103, 104] },      // Usuario 3 quiere 102, 103, 104 (conflicto en 102, 103)
    { userId: 4, numbers: [100, 104, 105] },      // Usuario 4 quiere 100, 104, 105 (conflicto en 100, 104)
  ];
  
  console.log('📋 Configuración:');
  userRequests.forEach(req => {
    console.log(`   Usuario ${req.userId}: quiere números ${req.numbers.join(', ')}`);
  });
  console.log('\n🏁 Iniciando carrera de compra simultánea...\n');
  
  // Ejecutar todos en paralelo
  const results = await Promise.all(
    userRequests.map(req => 
      simulateUser(req.userId, req.numbers, Math.random() * 200) // Delays aleatorios 0-200ms
    )
  );
  
  // Analizar resultados
  console.log(`\n${colors.bright}📊 RESULTADOS TEST 2:${colors.reset}`);
  
  const successfulPurchases = results
    .map((r, i) => ({ ...r, userId: userRequests[i].userId, requestedNumbers: userRequests[i].numbers }))
    .filter(r => r.success);
  
  const allSoldNumbers = new Set();
  let hasConflict = false;
  
  successfulPurchases.forEach(purchase => {
    console.log(`${colors.green}✅ Usuario ${purchase.userId}: Compró números ${purchase.numbers.join(', ')}${colors.reset}`);
    
    purchase.numbers.forEach(num => {
      if (allSoldNumbers.has(num)) {
        console.log(`${colors.red}❌ ¡CONFLICTO! Número ${num} vendido múltiples veces${colors.reset}`);
        hasConflict = true;
      }
      allSoldNumbers.add(num);
    });
  });
  
  results.forEach((r, i) => {
    if (!r.success) {
      console.log(`${colors.yellow}❌ Usuario ${userRequests[i].userId}: No pudo comprar - ${r.reason}${colors.reset}`);
      if (r.unavailableNumbers) {
        console.log(`   Números no disponibles: ${r.unavailableNumbers.join(', ')}`);
      }
    }
  });
  
  if (!hasConflict) {
    console.log(`\n${colors.green}${colors.bright}✅ PRUEBA EXITOSA: No hubo sobreventa de números${colors.reset}`);
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ FALLO CRÍTICO: Se detectó sobreventa${colors.reset}`);
  }
}

// TEST 3: Usuario intenta comprar después de timeout
async function test3_TimeoutScenario() {
  console.log(`\n${colors.bright}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}TEST 3: Simulación de timeout de reserva${colors.reset}`);
  console.log(`${'='.repeat(60)}\n`);
  
  console.log('⏱️  Este test requiere esperar 15 minutos para el timeout...');
  console.log('📌 Por ahora, solo simularemos el escenario\n');
  
  // En un escenario real, harías:
  // 1. Usuario 1 reserva números pero no paga
  // 2. Esperar 15 minutos
  // 3. Usuario 2 intenta comprar los mismos números
  // 4. Verificar que Usuario 2 SÍ puede comprarlos
  
  console.log(`${colors.cyan}Escenario esperado:${colors.reset}`);
  console.log('1. Usuario 1 reserva números 200-202 pero abandona el pago');
  console.log('2. Después de 15 minutos, el sistema libera automáticamente los números');
  console.log('3. Usuario 2 puede comprar exitosamente los números 200-202');
  console.log(`\n${colors.yellow}Para probar esto manualmente:${colors.reset}`);
  console.log('- Inicia una compra en el navegador pero no completes el pago');
  console.log('- Espera 15 minutos');
  console.log('- Intenta comprar los mismos números con otro navegador/sesión');
}

// Función principal
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     PRUEBAS DE CONCURRENCIA - SISTEMA DE RIFAS        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  console.log('⚙️  Configuración:');
  console.log(`   URL Base: ${BASE_URL}`);
  console.log(`   Asegúrate de que el servidor esté corriendo en localhost:3000\n`);
  
  // Esperar confirmación
  console.log(`${colors.yellow}⚠️  IMPORTANTE: Esta prueba creará compras reales en la BD${colors.reset}`);
  console.log('Presiona Ctrl+C para cancelar o espera 3 segundos para continuar...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Ejecutar tests
    await test1_SameNumber();
    
    // Esperar un poco entre tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await test2_MultipleUsersMultipleNumbers();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await test3_TimeoutScenario();
    
  } catch (error) {
    console.error(`${colors.red}Error ejecutando tests:${colors.reset}`, error);
  }
  
  console.log(`\n${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║              PRUEBAS COMPLETADAS                       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  console.log('\n📝 Nota: Revisa la base de datos para confirmar el estado de los números');
  console.log('   Puedes usar Drizzle Studio: npm run db:studio\n');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { simulateUser, runTests };