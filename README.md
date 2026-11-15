# Crew Doctor

Prototipo de monitoreo de salud para astronautas (Next.js). Datos simulados; no es un dispositivo médico.

## Abrir la app (sin terminal)

1. Instala [Node.js](https://nodejs.org) (versión LTS) una sola vez.
2. Copia `.env.example` a `.env.local` y pon tu `GEMINI_API_KEY` si quieres la voz de Gemini para BUZZ.
3. Haz doble clic en **`Abrir Crew Doctor.cmd`**. La primera vez instala dependencias y prepara la app (unos minutos); después abre en segundos en `http://localhost:3333`.
4. Para cerrar la app, cierra la ventana minimizada «Crew Doctor - servidor».

Para tener un acceso directo con el logo en el escritorio, ejecuta una vez `scripts/crear-acceso-directo.ps1` (clic derecho → «Ejecutar con PowerShell»).

## Desarrollo

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
