import type { Ticket, TicketStatus } from "./contracts";

export type TicketChangeEntry = {
  field: "status" | "owner" | "priority" | "externalRef";
  from: string;
  to: string;
};

function humanizeStatus(status: TicketStatus) {
  return status;
}

export function summarizeTicketChanges(previous: Ticket, next: Ticket) {
  const changes: TicketChangeEntry[] = [];

  if (previous.status !== next.status) {
    changes.push({ field: "status", from: humanizeStatus(previous.status), to: humanizeStatus(next.status) });
  }

  if (previous.owner !== next.owner) {
    changes.push({ field: "owner", from: previous.owner, to: next.owner });
  }

  if (previous.priority !== next.priority) {
    changes.push({ field: "priority", from: previous.priority, to: next.priority });
  }

  if (previous.externalRef !== next.externalRef) {
    changes.push({ field: "externalRef", from: previous.externalRef, to: next.externalRef });
  }

  if (!changes.length) {
    return "Sin cambios funcionales.";
  }

  const statusChange = changes.find((change) => change.field === "status");
  const ownerChange = changes.find((change) => change.field === "owner");
  const priorityChange = changes.find((change) => change.field === "priority");
  const externalRefChange = changes.find((change) => change.field === "externalRef");

  return [
    statusChange ? `Estado ${statusChange.from} -> ${statusChange.to}` : null,
    ownerChange ? `Responsable ${ownerChange.from} -> ${ownerChange.to}` : null,
    priorityChange ? `Prioridad ${priorityChange.from} -> ${priorityChange.to}` : null,
    externalRefChange ? `GLPI ${externalRefChange.from} -> ${externalRefChange.to}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
