"use client";

import { useState } from "react";
import type { SecurityEvent, SecurityEventSeverity } from "@/lib/nexera/contracts";

type SecurityEventsPanelProps = {
  events: SecurityEvent[];
  summary: Record<SecurityEventSeverity, number>;
};

const severities: Array<SecurityEventSeverity | "all"> = ["all", "info", "warning", "critical"];
const sources: Array<SecurityEvent["source"] | "all"> = ["all", "rustdesk-consent", "auth", "glpi", "admin"];

function isoTime(value: string) {
  return `${value.slice(11, 16)} UTC`;
}

export function SecurityEventsPanel({ events, summary }: SecurityEventsPanelProps) {
  const [severity, setSeverity] = useState<SecurityEventSeverity | "all">("all");
  const [source, setSource] = useState<SecurityEvent["source"] | "all">("all");
  const filteredEvents = events.filter((event) => {
    const matchesSeverity = severity === "all" || event.severity === severity;
    const matchesSource = source === "all" || event.source === source;
    return matchesSeverity && matchesSource;
  });

  return (
    <div className="securityPanel">
      <div className="ticketTopline">
        <strong>Eventos de seguridad</strong>
        <span className="badge">{filteredEvents.length} visibles</span>
      </div>
      <div className="securitySummary">
        <span>Info {summary.info}</span>
        <span>Warning {summary.warning}</span>
        <span>Critical {summary.critical}</span>
      </div>
      <div className="securityFilters">
        <select aria-label="Filtrar severidad" onChange={(event) => setSeverity(event.target.value as SecurityEventSeverity | "all")} value={severity}>
          {severities.map((item) => (
            <option key={item} value={item}>{item === "all" ? "Todas las severidades" : item}</option>
          ))}
        </select>
        <select aria-label="Filtrar origen" onChange={(event) => setSource(event.target.value as SecurityEvent["source"] | "all")} value={source}>
          {sources.map((item) => (
            <option key={item} value={item}>{item === "all" ? "Todos los origenes" : item}</option>
          ))}
        </select>
      </div>
      {filteredEvents.length ? (
        <div className="securityList">
          {filteredEvents.map((event) => (
            <div className={`securityEvent ${event.severity}`} key={event.id}>
              <div>
                <strong>{event.action}</strong>
                <span>{event.source}{event.ticketId ? ` · ${event.ticketId}` : ""}</span>
              </div>
              <p>{event.detail}</p>
              <small>{isoTime(event.at)}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="emptyState">Sin eventos para los filtros seleccionados.</p>
      )}
    </div>
  );
}
