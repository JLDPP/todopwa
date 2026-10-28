
import { api } from "../api";

import {
  getOutbox,
  removeOutbox,
  setMapping,
  getMapping,
  removeTaskLocal,
  promoteLocalToServer,
  getAllTasksLocal,
  putTaskLocal,
  type OutboxOp,
} from "./db";

// Evita sincronizaciones simultáneas
let syncing: Promise<void> | null = null;

async function performSync(): Promise<void> {
  if (!navigator.onLine) return;

  const ops = (await getOutbox()).sort(
    (a, b) => a.ts - b.ts
  );

  if (!ops.length) return;

  // Agrupar operaciones por tarea
  const groups = new Map<string, OutboxOp[]>();

  for (const op of ops) {
    const id = op.clienteId ?? op.serverId;

    if (!id) continue;

    if (!groups.has(id)) {
      groups.set(id, []);
    }

    groups.get(id)!.push(op);
  }

  // Procesar cada tarea
  for (const [id, taskOps] of groups) {
    try {
      const createOp = taskOps.find(
        (op) => op.op === "create"
      );

      const deleteOp = taskOps.find(
        (op) => op.op === "delete"
      );

      const updates = taskOps.filter(
        (op) => op.op === "update"
      );

      // Combinar los cambios pendientes
      const changes: Record<string, any> = {};

      for (const op of updates) {
        if (op.op === "update") {
          Object.assign(changes, op.data);
        }
      }

      const mappedId = await getMapping(id);

      let serverId =
        taskOps.find((op) => op.serverId)?.serverId ??
        mappedId;

      if (createOp && deleteOp && !serverId) {
        await removeTaskLocal(id);

        for (const op of taskOps) {
          await removeOutbox(op.id);
        }

        continue;
      }


      if (createOp?.op === "create" && !serverId) {
        const payload = {
          ...createOp.data,
          ...changes,
          clienteId: createOp.clienteId,
          description:
            changes.description ??
            createOp.data.description ??
            "",
          status:
            changes.status ??
            createOp.data.status ??
            "Pendiente",
        };

        const { data } = await api.post(
          "/tasks/bulksync",
          {
            tasks: [payload],
          }
        );

        const mapping = data?.mapping?.find(
          (m: any) =>
            m.clienteId === createOp.clienteId
        );

        if (!mapping?.serverId) {
          throw new Error(
            "No se recibió el ID de MongoDB"
          );
        }

        serverId = mapping.serverId;

        // Guardar mapeo antes de continuar.
        // Así evitamos duplicaciones al reintentar.
        await setMapping(
          createOp.clienteId,
          serverId
        );
      }

      

      if (deleteOp) {
        if (!serverId) {
          throw new Error(
            "No se encontró el ID para eliminar"
          );
        }

        await api.delete(`/tasks/${serverId}`);

        await removeTaskLocal(id);
        await removeTaskLocal(serverId);

        // Limpiar únicamente operaciones exitosas
        for (const op of taskOps) {
          await removeOutbox(op.id);
        }

        continue;
      }

      

      if (!serverId) {
        throw new Error(
          "No se encontró el ID de la tarea"
        );
      }

      if (createOp?.op === "create") {
        // Garantiza el estado final de una tarea
        // creada y modificada sin conexión.
        await api.put(`/tasks/${serverId}`, {
          title:
            changes.title ?? createOp.data.title,
          description:
            changes.description ??
            createOp.data.description ??
            "",
          status:
            changes.status ??
            createOp.data.status ??
            "Pendiente",
        });

        await promoteLocalToServer(
          createOp.clienteId,
          serverId
        );
      } else if (updates.length > 0) {
        // Actualizar tarea existente
        await api.put(
          `/tasks/${serverId}`,
          changes
        );
      }

      

      const localTasks = await getAllTasksLocal();

      const local = localTasks.find(
        (t: any) =>
          t._id === id ||
          t._id === serverId
      );

      if (local) {
        // Quitar antiguo registro local,
        // evitando duplicados.
        if (id !== serverId) {
          await removeTaskLocal(id);
        }

        await putTaskLocal({
          ...local,
          ...changes,
          _id: serverId,
          pending: false,
        });
      }

      

      for (const op of taskOps) {
        await removeOutbox(op.id);
      }

      console.log(
        `Tarea ${serverId} sincronizada correctamente`
      );
    } catch (error) {
      console.error(
        `Error sincronizando tarea ${id}:`,
        error
      );

      // No eliminamos la cola si falla.
      // Se reintentará en otra sincronización.
    }
  }
}


export function syncNow(): Promise<void> {
  if (!navigator.onLine) {
    return Promise.resolve();
  }

  // Si ya se está sincronizando,
  // esperar a la misma ejecución.
  if (syncing) return syncing;

  const run = performSync().finally(() => {
    syncing = null;
  });

  syncing = run;

  return run;
}



export function setupOnlineSync() {
  const handler = () => {
    void syncNow();
  };

  window.addEventListener("online", handler);

  return () => {
    window.removeEventListener("online", handler);
  };
}
