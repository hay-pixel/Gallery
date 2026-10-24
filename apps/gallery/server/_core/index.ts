import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerGoogleDriveRoutes } from "../googleDriveRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, process.env.HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0"), () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

export async function startServer() {
  const app = express();
  const server = createServer(app);

  // Native clients have no Origin header. Browser origins must be explicitly owned.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const configured = new Set((process.env.GALLERY_WEB_RETURN_ORIGINS ?? "").split(",").map((value: string) => value.trim().replace(/\/$/, "")).filter(Boolean));
    if (process.env.NODE_ENV !== "production") { configured.add("http://localhost:8081"); configured.add("http://127.0.0.1:8081"); }
    if (origin && !configured.has(origin.replace(/\/$/, ""))) { res.status(403).send("Unapproved Gallery origin"); return; }
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerGoogleDriveRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = process.env.NODE_ENV === "production" ? preferredPort : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, process.env.HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0"), () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
