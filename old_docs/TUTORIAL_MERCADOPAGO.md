# 📚 Tutorial Completo: Obtener Credenciales de MercadoPago

## 🎯 Lo que necesitamos obtener:
1. **Access Token** (tu clave privada)
2. **Public Key** (tu clave pública)  
3. **Webhook Secret** (para validar notificaciones)

---

## 📝 PASO 1: Acceder al Panel de Desarrolladores

### 1.1 Ingresa a MercadoPago Developers
🔗 **URL**: https://www.mercadopago.com.ar/developers/es

### 1.2 Inicia Sesión
- Click en **"Iniciar sesión"** (esquina superior derecha)
- Usa tus credenciales de MercadoPago normales
- Si te pide verificación, complétala

---

## 🏗️ PASO 2: Crear una Aplicación

### 2.1 Accede a "Tus integraciones"
- Una vez logueado, en la esquina superior derecha verás **"Tus integraciones"**
- Haz click ahí

### 2.2 Crear nueva aplicación
- Click en el botón **"Crear aplicación"**
- **Nombre**: Pon algo descriptivo como "Sistema de Rifas 2025"
- **Solución de pago**: Selecciona **"Pagos online"**
- Click en **"Crear aplicación"**

> ⚠️ **NOTA**: Si te pide verificación de identidad, tendrás que completarla subiendo tu DNI

---

## 🔑 PASO 3: Obtener las Credenciales

### 3.1 Credenciales de Prueba (Sandbox)
Una vez creada la aplicación:
1. En el menú lateral izquierdo, click en **"Credenciales de prueba"**
2. Aquí verás:
   - **Public Key**: `TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Access Token**: `TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
3. **COPIA ESTOS VALORES** (los usaremos primero para probar)

### 3.2 Credenciales de Producción
1. En el menú lateral, click en **"Credenciales de producción"**
2. Si es la primera vez, tendrás que **activarlas**:
   - **Industria**: Selecciona "Educación" o "ONGs"
   - **Sitio web**: Pon la URL de tu app (ej: `https://sistema-ventas-rifas.vercel.app`)
   - Acepta términos y condiciones
   - Completa el reCAPTCHA
   - Click en **"Activar credenciales de producción"**
3. Una vez activadas verás:
   - **Public Key**: `APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Access Token**: `APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## 🔔 PASO 4: Configurar Webhooks (para recibir notificaciones)

### 4.1 Acceder a configuración de Webhooks
1. En tu aplicación, busca en el menú lateral **"Webhooks"**
2. Click en **"Configurar notificaciones"**

### 4.2 Configurar URL de notificaciones
1. **Modo**: Selecciona "Producción" (o "Prueba" si estás testeando)
2. **URL de producción**: 
   ```
   https://sistema-ventas-rifas.vercel.app/api/webhooks/mercadopago
   ```
3. **Eventos a recibir**: Marca:
   - ✅ Pagos (payment)
   - ✅ Orden de pago (merchant_order)

### 4.3 Obtener el Webhook Secret
1. Una vez guardada la configuración, MercadoPago **generará automáticamente** un **Secret Key**
2. Este aparecerá en la misma página
3. Se verá algo así: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
4. **GUARDA ESTE VALOR** - es tu webhook secret

### 4.4 Probar la configuración
1. En la misma página, busca el botón **"Simular notificación"**
2. Selecciona:
   - URL: La que configuraste
   - Tipo de evento: "payment"
   - ID: Cualquier número (ej: 123456)
3. Click en **"Enviar prueba"**
4. Deberías ver que se envió correctamente

---

## 📋 RESUMEN: Valores que debes tener ahora

### Para DESARROLLO (Sandbox):
```env
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MERCADO_PAGO_PUBLIC_KEY=TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MERCADO_PAGO_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Para PRODUCCIÓN:
```env
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MERCADO_PAGO_PUBLIC_KEY=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MERCADO_PAGO_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🚨 IMPORTANTE - Próximos Pasos:

1. **GUARDA ESTAS CREDENCIALES DE FORMA SEGURA**
2. **NUNCA** las subas a GitHub
3. Actualiza tu archivo `.env.local` con estos valores
4. En Vercel, configura estas variables de entorno en Settings → Environment Variables

---

## 🆘 Troubleshooting

### Si no encuentras alguna sección:
- Asegúrate de haber creado la aplicación
- Verifica que estés en el panel correcto: https://www.mercadopago.com.ar/developers/panel
- Puede que algunas opciones requieran verificación de identidad

### Si las credenciales de producción no se activan:
- Necesitas tener tu cuenta de MercadoPago verificada
- Debes tener al menos una venta o movimiento en tu cuenta MP
- El sitio web debe ser una URL válida (no localhost)

### Si el webhook no funciona:
- La URL debe ser HTTPS (no HTTP)
- La URL debe ser accesible públicamente
- No puede ser localhost

---

## 📞 Soporte

Si tienes problemas:
- Soporte MercadoPago: https://www.mercadopago.com.ar/ayuda
- Documentación oficial: https://www.mercadopago.com.ar/developers/es/docs

---

**¡Listo! Con estos datos ya podemos integrar MercadoPago real en tu sistema de rifas** 🎉