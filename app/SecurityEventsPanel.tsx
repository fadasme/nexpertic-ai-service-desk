"use client";

import { useState } from "react";
import type { SecurityEvent, SecurityEventSeverity } from "@/lib/nexera/contracts";
import { formatUtcTime } from "@/lib/nexera/time-format";

type SecurityEventsPanelProps = {
  events: SecurityEvent[];
  summary: Record<SecurityEventSeverity, number>;
};

const severities: Array<SecurityEventSeverity | "all"> = ["all", "info", "warning", "critical"];
const sources: Array<SecurityEvent["source"] | "all"> = ["all", "rustdesk-consent", "auth", "glpi", "admin"];

export function SecurityEventsPanel({ events, summary }: SecurityEventsPanelProps) {
  const [severity, setSeverity] = useState<SecurityEventSeverity | "all">("all");
  const [source, setSource] = useState<SecurityEvent["source"] | "all">("all");
  const filteredEvents = events.filter((event) => {
    const matchesSeverity = severity === "all" || event.severity === severity;
    const matchesSource = source === "all" || event.source === source;
    return matchesSeverity && matchesSource;
  });
  const latestEvent = filteredEvents[0] ?? events[0] ?? null;
  const visibleCritical = filteredEvents.filter((event) => event.severity === "critical").length;
  const visibleWarnings = filteredEvents.filter((event) => event.severity === "warning").length;
  const visibleSources = new Set(filteredEvents.map((event) => event.source)).size;
  const visibleInfo = filteredEvents.filter((event) => event.severity === "info").length;

  return (
    <div className="securityPanel">
      <div className="ticketTopline">
        <strong>Eventos de seguridad</strong>
        <span className="badge">{filteredEvents.length} visibles</span>
      </div>
      <div className="securityExecutive">
        <div>
          <span>Criticos</span>
          <strong>{visibleCritical}</strong>
        </div>
        <div>
          <span>Warnings</span>
          <strong>{visibleWarnings}</strong>
        </div>
        <div>
          <span>Info</span>
          <strong>{visibleInfo}</strong>
        </div>
        <div>
          <span>Fuentes</span>
          <strong>{visibleSources}</strong>
        </div>
        <p>{latestEvent ? `${latestEvent.action} · ${formatUtcTime(latestEvent.at)}` : "Sin eventos recientes."}</p>
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
              <div className="securityEventHeader">
                <div className="securityEventIdentity">
                  <span className={`securityDot ${event.severity}`} />
                  <strong>{event.action}</strong>
                </div>
                <span>{event.source}{event.ticketId ? ` · ${event.ticketId}` : ""}</span>
              </div>
              <p>{event.detail}</p>
              <small>{formatUtcTime(event.at)}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="emptyState">Sin eventos para los filtros seleccionados.</p>
      )}
    </div>
  );
}
