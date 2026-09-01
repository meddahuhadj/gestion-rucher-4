import { buildApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./core/db.js";

const app = await buildApp();

// Render (et la plupart des PaaS) impose le port via $PORT — il a priorité
// sur API_PORT. En local, $PORT est absent → on garde API_PORT.
const port = process.env.PORT ? Number(process.env.PORT) : config.API_PORT;

try {
  await app.listen({ port, host: config.API_HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    app.log.info(`${signal} reçu — arrêt propre`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
