const BASE_URL = 'http://localhost:3001/api';

async function testConcurrency() {
  console.log('🧪 TEST SIMPLE DE CONCURRENCIA\n');
  
  // Primero resetear el número 50
  const resetResponse = await fetch(`${BASE_URL}/test/reset-numbers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numbers: [50] })
  });
  console.log('✅ Número 50 reseteado\n');
  
  // Preparar datos de compra para ambos usuarios
  const purchaseData1 = {
    buyerName: 'Usuario 1',
    studentName: 'Hijo 1',
    division: 'A',
    course: '5to',
    email: 'user1@test.com',
    phone: '1111111111',
    numbers: [50],
    totalAmount: 2000
  };
  
  const purchaseData2 = {
    buyerName: 'Usuario 2',
    studentName: 'Hijo 2',
    division: 'B',
    course: '4to',
    email: 'user2@test.com',
    phone: '2222222222',
    numbers: [50],
    totalAmount: 2000
  };
  
  console.log('🏁 Iniciando compras simultáneas del número 50...\n');
  
  // Ejecutar ambas compras en paralelo
  const [result1, result2] = await Promise.all([
    fetch(`${BASE_URL}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData1)
    }).then(r => r.json()),
    
    fetch(`${BASE_URL}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData2)
    }).then(r => r.json())
  ]);
  
  console.log('📊 RESULTADOS:\n');
  console.log('Usuario 1:', result1.success ? `✅ ÉXITO - ID: ${result1.purchaseId}` : `❌ FALLO - ${result1.error || result1.message}`);
  console.log('Usuario 2:', result2.success ? `✅ ÉXITO - ID: ${result2.purchaseId}` : `❌ FALLO - ${result2.error || result2.message}`);
  
  // Analizar
  const successCount = [result1, result2].filter(r => r.success).length;
  
  console.log('\n' + '='.repeat(50));
  if (successCount === 1) {
    console.log('✅ PRUEBA EXITOSA: Solo UN usuario pudo comprar');
  } else if (successCount === 2) {
    console.log('❌ PROBLEMA CRÍTICO: AMBOS compraron el mismo número!');
  } else {
    console.log('⚠️  Ninguno pudo comprar - verificar errores');
  }
  console.log('='.repeat(50));
}

testConcurrency().catch(console.error);
