
import Task from "../models/Task.js";
import {
  pushEnabled,
  sendToUser,
} from "../services/push.service.js";

// Configuración de recordatorios
const WINDOW_MIN = Number(process.env.REMINDER_WINDOW_MIN || 60);
const TZ = process.env.APP_TIMEZONE || "America/Mexico_City";

// Controlador principal de recordatorios
export async function reminders(req, res) {
  try {
    const secret = process.env.CRON_SECRET;

    // Validar autorización del cron
    if (
      !secret ||
      req.get("authorization") !== `Bearer ${secret}`
    ) {
      return res.status(401).json({
        message: "No autorizado",
      });
    }

    // Verificar configuración de notificaciones push
    if (!pushEnabled()) {
      return res.status(503).json({
        message: "Push no configurado",
      });
    }

    const now = new Date();

    const limit = new Date(
      now.getTime() + WINDOW_MIN * 60_000
    );

    // Buscar tareas pendientes de recordatorio
    const tasks = await Task.find({
      deleted: false,
      status: { $ne: "Completada" },
      remindedAt: null,
      dueDate: {
        $ne: null,
        $lte: limit,
      },
    })
      .sort({ dueDate: 1 })
      .limit(500);

    // Agrupar tareas por usuario
    const byUser = new Map();

    for (const task of tasks) {
      if (!task.user) {
        console.warn(
          `Tarea ${task._id} sin usuario asignado`
        );
        continue;
      }

      const userId = String(task.user);

      if (!byUser.has(userId)) {
        byUser.set(userId, []);
      }

      byUser.get(userId).push(task);
    }

    // Formatear fecha y hora
    const fmt = new Intl.DateTimeFormat("es-MX", {
      timeZone: TZ,
      dateStyle: "medium",
      timeStyle: "short",
    });

    // Contadores de resultados
    const totals = {
      notified: 0,
      failed: 0,
      removed: 0,
      usersWithoutDevices: 0,
    };

    const remindedTaskIds = [];

    // Enviar recordatorios agrupados por usuario
    for (const [userId, list] of byUser) {
      try {
        let payload;

        if (list.length === 1) {
          const task = list[0];
          const overdue = task.dueDate < now;

          payload = {
            title: overdue
              ? "Tarea vencida"
              : "Tarea por vencer",

            body: `${task.title} — ${
              overdue ? "venció" : "vence"
            } el ${fmt.format(task.dueDate)}`,

            url: "/dashboard",
            tag: `task-${task._id}`,
          };
        } else {
          const overdueCount = list.filter(
            (task) => task.dueDate < now
          ).length;

          payload = {
            title: overdueCount > 0
              ? `Tienes ${list.length} tareas pendientes`
              : `Tienes ${list.length} tareas por vencer`,

            body:
              list
                .slice(0, 3)
                .map((task) => `• ${task.title}`)
                .join("\n") +
              (list.length > 3 ? "\n…" : ""),

            url: "/dashboard",
            tag: "reminders",
          };
        }

        // Enviar notificaciones
        const result = await sendToUser(
          userId,
          payload
        );

        totals.notified += result.sent || 0;
        totals.failed += result.failed || 0;
        totals.removed += result.removed || 0;

        // Usuario sin dispositivos registrados
        if (
          !result.sent &&
          !result.failed &&
          !result.removed
        ) {
          totals.usersWithoutDevices++;
        }

        // Registrar solamente tareas notificadas
        if (result.sent > 0) {
          remindedTaskIds.push(
            ...list.map((task) => task._id)
          );
        }
      } catch (error) {
        console.error(
          `Error notificando al usuario ${userId}:`,
          error
        );

        totals.failed++;
      }
    }

    // Actualizar recordatorios enviados
    if (remindedTaskIds.length > 0) {
      await Task.updateMany(
        {
          _id: { $in: remindedTaskIds },
          remindedAt: null,
        },
        {
          $set: {
            remindedAt: now,
          },
        }
      );
    }

    return res.json({
      ok: true,
      checked: tasks.length,
      users: byUser.size,
      remindersMarked: remindedTaskIds.length,
      ...totals,
    });

  } catch (error) {
    console.error(
      "Error ejecutando recordatorios:",
      error
    );

    return res.status(500).json({
      message: "Error interno al procesar recordatorios",
    });
  }
}

// Alias de compatibilidad con cron.routes.js
export const readme = reminders;
