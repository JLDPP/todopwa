// src/offline/sync.ts
// Envía la outbox al servidor.
// Patrón "outbox": la UI nunca llama directamente a la API
// para modificar datos; solo encola operaciones.

import axios from "axios";
import { api } from "../api";
import { getOutbox, removeOp, setMapping } from "./db";

let running: Promise<boolean> | null = null;
let again = false;

/**
 * Sincroniza la outbox.
 * Si ya existe una sincronización en curso,
 * programa otra ejecución al finalizar.
 *
 * Devuelve true si la outbox queda vacía.
 */
export function syncNow(): Promise<boolean> {
  if (running) {
    again = true;
    return running;
  }

  running = (async () => {
    try {
      let ok = true;

      do {
        again = false;
        ok = await runOnce();
      } while (
        again &&
        ok &&
        navigator.onLine
      );

      return ok;
    } finally {
      running = null;
    }
  })();

  return running;
}

/**
 * Determina si un error HTTP es permanente.
 *
 * Los errores 401, 408 y 429 no se consideran
 * permanentes porque pueden resolverse después.
 */
function isPermanent(error: unknown): boolean {
  if (
    !axios.isAxiosError(error) ||
    !error.response
  ) {
    return false;
  }

  const status = error.response.status;

  return (
    status >= 400 &&
    status < 500 &&
    ![401, 408, 429].includes(status)
  );
}

/**
 * Ejecuta una sincronización de la outbox.
 */
async function runOnce(): Promise<boolean> {
  // Comprobar conexión a internet
  if (!navigator.onLine) {
    return false;
  }

  // Obtener operaciones pendientes
  const ops = await getOutbox();

  if (ops.length === 0) {
    return true;
  }

  try {
    /**
     * PASO 1:
     * Sincronizar todas las tareas nuevas.
     */

    const creates = ops.filter(
      (
        op
      ): op is Extract<
        (typeof ops)[number],
        { op: "create" }
      > => op.op === "create"
    );

    if (creates.length > 0) {
      const { data } = await api.post<{
        mapping: {
          clienteId: string;
          serverId: string;
        }[];
      }>(
        "/tasks/bulksync",
        {
          tasks: creates.map((op) => ({
            ...op.data,
            clienteId: op.clienteId,
          })),
        }
      );

      // Guardar IDs asignados por el servidor
      for (const mapping of data.mapping ?? []) {
        await setMapping(
          mapping.clienteId,
          mapping.serverId
        );
      }

      // Eliminar operaciones sincronizadas
      for (const op of creates) {
        await removeOp(op);
      }
    }

    /**
     * PASO 2:
     * Procesar actualizaciones y eliminaciones.
     */

    for (const op of ops) {
      // Las creaciones ya fueron procesadas
      if (op.op === "create") {
        continue;
      }

      try {
        switch (op.op) {
          case "update": {
            await api.put(
              `/tasks/${op.serverId}`,
              op.data
            );

            await removeOp(op);
            break;
          }

          case "delete": {
            await api.delete(
              `/tasks/${op.serverId}`
            );

            await removeOp(op);
            break;
          }

          default:
            break;
        }
      } catch (error: unknown) {
        if (isPermanent(error)) {
          // Descartar operaciones rechazadas
          // permanentemente por el servidor
          await removeOp(op);
        } else {
          // Detener ante errores temporales
          // para reintentar más adelante
          throw error;
        }
      }
    }

    

    const pendingOps = await getOutbox();

    return pendingOps.length === 0;
  } catch (error: unknown) {
    console.error(
      "Error al sincronizar la outbox:",
      error
    );

    return false;
  }
}