# Cotizador Casa Limpia

## Tarifas comerciales v4

Paquetes de departamentos: general/profunda desde 37.000/45.000 CLP hasta 82.000/100.000 CLP. Entrega vacía: 55.000, 70.000 y 85.000 CLP para las tres primeras tipologías. Superficies fuera de tabla, casas/oficinas y entregas grandes requieren evaluación previa. Los precios son preliminares, no una garantía de rentabilidad.

La migración v4 actualiza configuraciones anteriores al leerlas en cliente y servidor; las personalizaciones posteriores se conservan. Las cotizaciones históricas no se recalculan. Se elimina el adicional de mudanza y se excluyen del cobro los muebles vacíos y el balcón pequeño ya incluidos en entrega.

Cada servicio admite una o dos personas y cantidades enteras de adicionales. Las horas-persona se conservan al cambiar el equipo; el rendimiento aún requiere calibración con trabajos reales. Capacidad teórica limitada a dos propiedades diarias, sin agenda ni verificación de traslados.

El objetivo inicial editable es 20.000 CLP totales disponibles para los propietarios después de gastos, distinto de utilidad tras remunerar su tiempo. Costos, margen y rentabilidad permanecen pendientes hasta confirmar gastos y costo por hora. La configuración tributaria está pendiente, no representa una exención. Las membresías conservan su modelo previo de horas mensuales.

Validación: `npm run check`. Pruebas de paquetes, cantidades, personal, migración idempotente y borradores, además de regresión existente. Antes de producción: comprobar en escritorio y móvil registro/login, guardar y recargar configuración, sincronización entre dispositivos, resumen e historial y casos de superficies fuera de tabla. No se han ejecutado esas pruebas autenticadas en producción para esta versión.

Aplicación web interna para calcular servicios de limpieza, costos, jornadas, rentabilidad, descuentos y membresías.

## Tecnologías

- Next.js 16 y TypeScript
- Clerk para autenticación
- MongoDB Atlas para configuraciones y cotizaciones aisladas por usuario
- Vercel para producción

## Funciones implementadas

- Cálculo compartido entre navegador y servidor; el servidor no confía en totales enviados por el cliente.
- Configuración sincronizada con control de revisiones y detección de conflictos.
- Historial paginado, nombres editables y validación de registros leídos.
- Guardado idempotente, límites de escritura y cola offline por usuario.
- Borradores locales aislados por cuenta y recuperación de sesión con Clerk.
- Cabeceras de seguridad, CSP, foco visible y objetivos táctiles de 44 px.

## Configuración local

1. Duplica `.env.example` con el nombre `.env.local`.
2. Completa las variables de Clerk y MongoDB sin compartirlas ni subirlas a GitHub.
3. Instala y ejecuta:

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Variables requeridas

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
MONGODB_URI=
# Opcionales
QUOTE_WRITE_LIMIT_PER_MINUTE=20
MAX_QUOTES_PER_USER=10000
```

La clave secreta de Clerk y la conexión de MongoDB son exclusivamente del servidor. Los archivos `.env*` reales están excluidos del repositorio.

`MONGODB_URI` debe usar un usuario de aplicación con `readWrite` limitado a la base `casa_limpia`, no una cuenta administradora de Atlas.

## Verificación local

```bash
npm run check
```

`check` ejecuta lint, pruebas unitarias y build de producción. También se pueden ejecutar por separado con `npm run lint`, `npm test` y `npm run build`.

## Persistencia y concurrencia

- `user_settings`: un documento por usuario, índice único y campo `revision`.
- `quotes`: índice único por `(userId, idempotencyKey)`.
- `write_rate_limits`: buckets temporales con índice TTL.
- Las cotizaciones inválidas o corruptas no se envían a la interfaz y se contabilizan en `invalidCount`.

## Despliegue

Vercel debe contener las tres variables requeridas en Production. Después de cada push a `main`, comprobar:

1. estado **Ready**;
2. registro, login y logout de Clerk;
3. cabecera `Content-Security-Policy` sin bloquear Clerk;
4. guardado, recarga, renombrado y paginación;
5. cola offline y sincronización al recuperar la red.

## Limitaciones conocidas

- No existe aplicación móvil nativa ni PWA; solo web responsive.
- Los roles de administrador/operador/lector requieren una decisión de negocio y metadatos de Clerk.
- Los planes con cero horas quedan bloqueados hasta configurar horas mensuales reales.
