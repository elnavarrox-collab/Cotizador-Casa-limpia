# Cotizador Casa Limpia

Aplicación web interna para calcular servicios de limpieza, costos, jornadas, rentabilidad, descuentos y membresías.

## Tecnologías

- Next.js 16 y TypeScript
- Clerk para autenticación
- MongoDB Atlas para persistencia (conexión preparada; implementación de datos en la siguiente etapa)
- Vercel para producción

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
```

La clave secreta de Clerk y la conexión de MongoDB son exclusivamente del servidor. Los archivos `.env*` reales están excluidos del repositorio.

## Verificación

```bash
npm run build
npm run lint
```
