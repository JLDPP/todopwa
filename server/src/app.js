
import express from "express";
import morgan from "morgan";
import cors from "cors";

import taskRoutes from "./routes/task.routes.js";
import authRoutes from "./routes/auth.routes.js";
import pushRoutes from "./routes/push.routes.js";
import cronRoutes from "./routes/cron.routes.js";
import { connectToDB } from "./db/connect.js";

const app = express();

// Orígenes autorizados del frontend.
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:5175",
  "https://todo-pwaa.vercel.app",
  "https://todo-pwaa-nuwox8mx9-jose-luis17.vercel.app",
  ...(process.env.FRONT_ORIGIN || "").split(","),
]
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Configuración CORS.
app.use(
  cors({
    origin: (origin, callback) => {
      // Solicitudes sin Origin (por ejemplo, herramientas de prueba).
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Permite previews del proyecto frontend en Vercel.
      if (
        /^https:\/\/todo-pwaa-[a-z0-9-]+-jose-luis17\.vercel\.app$/.test(
          origin
        )
      ) {
        return callback(null, true);
      }

      console.warn("Origen CORS no autorizado:", origin);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

// Middlewares.
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.VERCEL ? "tiny" : "dev"));

// Health check.
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "todo-pwa-api",
  });
});

// Conexión MongoDB cacheada.
app.use(async (_req, _res, next) => {
  try {
    await connectToDB();
    next();
  } catch (error) {
    next(error);
  }
});

// Rutas de la API.
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/cron", cronRoutes);

// Ruta no encontrada.
app.use((_req, res) => {
  res.status(404).json({
    message: "Ruta no encontrada",
  });
});

// Manejador central de errores.
app.use((err, _req, res, _next) => {
  let status = err.status || err.statusCode || 500;

  if (
    err.name === "ValidationError" ||
    err.name === "CastError"
  ) {
    status = 400;
  }

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    message:
      status >= 500
        ? "Error del servidor"
        : err.message,
  });
});

export default app;
