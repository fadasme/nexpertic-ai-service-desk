import { agents, executiveMetrics, knowledgeArticles, remoteSupportConnectors, tickets } from "./demo-data";
import { searchKnowledgeArticles } from "./knowledge-search";
import type { Ticket, TicketPriority } from "./contracts";

export function listTickets(filters?: { priority?: TicketPriority | "Todas"; q?: string }) {
  const query = filters?.q?.trim().toLowerCase();

  return tickets.filter((ticket) => {
    const matchesPriority = !filters?.priority || filters.priority === "Todas" || ticket.priority === filters.priority;
    const matchesQuery =
      !query ||
      [ticket.id, ticket.title, ticket.requester, ticket.status, ticket.owner, ticket.category]
        .join(" ")
        .toLowerCase()
        .includes(query);

    return matchesPriority && matchesQuery;
  });
}

export function getTicket(id: string) {
  return tickets.find((ticket) => ticket.id === id);
}

export function listAgents() {
  return agents;
}

export function listKnowledgeArticles(filters?: { domain?: string; q?: string }) {
  return searchKnowledgeArticles(knowledgeArticles, filters);
}

export function getExecutiveMetrics() {
  return executiveMetrics;
}

export function getOperationalMetrics() {
  const openTickets = tickets.filter((ticket) => ticket.status !== "Resuelto").length;
  const aiAverage = Math.round(tickets.reduce((total, ticket) => total + ticket.confidence, 0) / tickets.length);

  return [
    { label: "Tickets abiertos", value: String(openTickets), detail: "+12% esta semana" },
    { label: "SLA cumplimiento", value: "94%", detail: "Objetivo enterprise 95%" },
    { label: "Resueltos por IA", value: "31%", detail: "Nivel 1 automatizado" },
    { label: "Confianza IA", value: `${aiAverage}%`, detail: "Promedio clasificacion" },
  ];
}

export function getSlaSummary(sourceTickets: Ticket[] = tickets) {
  return [
    { label: "Critico", value: sourceTickets.filter((ticket) => ticket.sla === "Critico").length, tone: "danger" },
    { label: "En riesgo", value: sourceTickets.filter((ticket) => ticket.sla === "En riesgo").length, tone: "warning" },
    { label: "Normal", value: sourceTickets.filter((ticket) => ticket.sla === "Normal").length, tone: "ok" },
  ];
}

export function getMvpReadiness() {
  return [
    { label: "Frontend Nexpertic", progress: 76, status: "En curso" },
    { label: "Backend D1", progress: 78, status: "Activo" },
    { label: "Adaptador GLPI", progress: 38, status: "Pendiente" },
    { label: "RAG inicial", progress: 44, status: "Diseñado" },
    { label: "Auditoria IA", progress: 72, status: "Activa" },
  ];
}

export function listRemoteSupportConnectors() {
  return remoteSupportConnectors;
}
