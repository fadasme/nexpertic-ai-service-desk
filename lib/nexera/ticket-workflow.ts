import type { Ticket, TicketStatus } from "./contracts";

export type TicketWorkflowStep = {
  label: string;
  owner: string;
  status: TicketStatus;
  detail: string;
  tone: "ready" | "warning" | "danger";
};

const workflow: Record<TicketStatus, TicketWorkflowStep[]> = {
  Nuevo: [
    { label: "Asignar L1", owner: "Mesa L1", status: "Asignado", detail: "Preparar triage y primer contacto.", tone: "ready" },
    { label: "Escalar L2", owner: "Especialista L2", status: "Escalado", detail: "Enviar directo a soporte especializado.", tone: "warning" },
  ],
  Asignado: [
    { label: "Abrir diagnostico", owner: "Mesa L1", status: "En diagnostico", detail: "Comenzar analisis tecnico y recopilar evidencias.", tone: "ready" },
    { label: "Escalar L2", owner: "Especialista L2", status: "Escalado", detail: "Elevar cuando el alcance excede L1.", tone: "warning" },
  ],
  "En diagnostico": [
    { label: "Pedir usuario", owner: "Mesa L1", status: "Pendiente usuario", detail: "Esperar datos, aprobacion o prueba del usuario.", tone: "warning" },
    { label: "Resolver", owner: "Mesa L1", status: "Resuelto", detail: "Cerrar el caso con evidencia y trazabilidad.", tone: "ready" },
    { label: "Escalar L2", owner: "Especialista L2", status: "Escalado", detail: "Solicitar apoyo tecnico profundo.", tone: "warning" },
  ],
  "Pendiente usuario": [
    { label: "Retomar diagnostico", owner: "Mesa L1", status: "En diagnostico", detail: "Continuar cuando el usuario entregue lo requerido.", tone: "ready" },
    { label: "Resolver", owner: "Mesa L1", status: "Resuelto", detail: "Cerrar si la evidencia ya es suficiente.", tone: "warning" },
  ],
  Escalado: [
    { label: "Tomar diagnostico", owner: "Especialista L2", status: "En diagnostico", detail: "Volver al analisis tecnico profundo.", tone: "warning" },
    { label: "Resolver", owner: "Especialista L2", status: "Resuelto", detail: "Cerrar una vez validada la solucion.", tone: "ready" },
  ],
  Resuelto: [
    { label: "Reabrir diagnostico", owner: "Mesa L1", status: "En diagnostico", detail: "Reabrir si aparecen sintomas residuales.", tone: "danger" },
  ],
};

export function getTicketWorkflowSteps(ticket: Ticket): TicketWorkflowStep[] {
  return workflow[ticket.status] ?? [];
}

export function suggestNextTicketStep(ticket: Ticket) {
  return getTicketWorkflowSteps(ticket)[0] ?? null;
}

export function isValidTicketTransition(currentStatus: TicketStatus, nextStatus: TicketStatus) {
  return workflow[currentStatus]?.some((step) => step.status === nextStatus) ?? false;
}
