import type { PilotReadiness, SecretPosture } from "@/lib/nexera/contracts";

type PilotCommandCenterProps = {
  authMode: string;
  readiness: PilotReadiness;
  securityAlerts: number;
  secretPosture: SecretPosture;
};

function healthTone(readiness: PilotReadiness, secretPosture: SecretPosture, securityAlerts: number) {
  if (readiness.mode === "pilot_ready" && secretPosture.mode === "ready" && securityAlerts === 0) return "ok";
  if (readiness.summary.blockers > 0 || secretPosture.summary.critical > 0) return "danger";
  return "warning";
}

function executiveRecommendation(readiness: PilotReadiness, secretPosture: SecretPosture, securityAlerts: number) {
  const nextSecret = secretPosture.items.find((item) => item.risk !== "ok") ?? null;
  const nextReadiness = readiness.items.find((item) => item.status !== "ready") ?? null;

  if (secretPosture.summary.critical > 0 && nextSecret) {
    return {
      action: "Cerrar secreto crítico",
      detail: `${nextSecret.label} exige validacion antes de ampliar el piloto.`,
      href: "#admin-ia",
    };
  }

  if (readiness.summary.blockers > 0 && nextReadiness) {
    return {
      action: "Resolver bloqueante",
      detail: `${nextReadiness.label} sigue pendiente y bloquea el avance del piloto.`,
      href: nextReadiness.key === "glpi" || nextReadiness.key === "oidc" ? "#api" : "#estado-producto",
    };
  }

  if (securityAlerts > 0) {
    return {
      action: "Revisar alertas",
      detail: "Hay eventos de seguridad que conviene revisar antes de seguir ampliando el alcance.",
      href: "#admin-ia",
    };
  }

  return {
    action: "Escalar siguiente hito",
    detail: "La base operativa esta lista para ampliar alcance o preparar el piloto externo.",
    href: "#estado-producto",
  };
}

export function PilotCommandCenter({ authMode, readiness, securityAlerts, secretPosture }: PilotCommandCenterProps) {
  const tone = healthTone(readiness, secretPosture, securityAlerts);
  const score = Math.round((readiness.score + (secretPosture.summary.configured / secretPosture.summary.total) * 100) / 2);
  const readyItems = readiness.items.filter((item) => item.status === "ready");
  const pendingItems = readiness.items.filter((item) => item.status !== "ready");
  const nextFocus = pendingItems[0] ?? null;
  const secretRisk = secretPosture.items.find((item) => item.risk !== "ok") ?? null;
  const recommendation = executiveRecommendation(readiness, secretPosture, securityAlerts);
  const readinessRisk = readiness.summary.blockers > 0 ? "blocker" : pendingItems.length > 0 ? "pending" : "ready";
  const securityRisk = securityAlerts > 0 ? "alert" : "clear";
  const secretRiskState = secretPosture.summary.critical > 0 ? "critical" : secretPosture.summary.warnings > 0 ? "warning" : "clear";
  const targetHref = nextFocus ? (nextFocus.key === "glpi" || nextFocus.key === "oidc" ? "#api" : nextFocus.key === "demo-data" ? "#estado-producto" : "#admin-ia") : "#api";
  const targetLabel = nextFocus ? (nextFocus.key === "glpi" ? "Ir a GLPI" : nextFocus.key === "oidc" ? "Ir a OIDC" : nextFocus.key === "demo-data" ? "Ir a estado del producto" : "Ir a controles") : "Ir a APIs";
  const secretRiskAction =
    secretRiskState === "critical"
      ? { label: "Cerrar secreto crítico", detail: "Rotar o eliminar el secreto expuesto antes de ampliar el piloto.", href: "#admin-ia" }
      : secretRiskState === "warning"
        ? { label: "Revisar secreto", detail: "Confirmar si el fallback es temporal y reemplazarlo por un secreto real.", href: "#admin-ia" }
        : { label: "Ver postura", detail: "La postura de secretos está alineada con el piloto actual.", href: "#admin-ia" };
  const readinessAction =
    readinessRisk === "blocker"
      ? { label: "Resolver bloqueante", detail: "Atender el elemento que impide pasar a piloto externo.", href: targetHref }
      : readinessRisk === "pending"
        ? { label: "Completar cierre", detail: "Terminar el último ajuste funcional antes de formalizar la entrega.", href: targetHref }
        : { label: "Confirmar listo", detail: "La base operativa ya puede sostener el siguiente hito.", href: "#estado-producto" };
  const securityAction =
    securityRisk === "alert"
      ? { label: "Revisar alertas", detail: "Inspeccionar los eventos recientes y decidir si requieren contención.", href: "#admin-ia" }
      : { label: "Monitoreo estable", detail: "No se observan alertas activas que frenen el avance.", href: "#admin-ia" };
  const secretCriticalCount = secretPosture.summary.critical;
  const secretWarningCount = secretPosture.summary.warnings;
  const readinessBlockerCount = readiness.summary.blockers;
  const readinessPendingCount = pendingItems.length;
  const decisionCards = [
    {
      action: secretRiskAction.label,
      detail: secretRiskAction.detail,
      href: secretRiskAction.href,
      tone: secretRiskState,
      title: "Secretos",
    },
    {
      action: readinessAction.label,
      detail: readinessAction.detail,
      href: readinessAction.href,
      tone: readinessRisk,
      title: "Readiness",
    },
    {
      action: securityAction.label,
      detail: securityAction.detail,
      href: securityAction.href,
      tone: securityRisk,
      title: "Seguridad",
    },
  ];
  const dominantDecision =
    secretRiskState === "critical"
      ? { label: "Secreto crítico", tone: "critical" }
      : readinessRisk === "blocker"
        ? { label: "Readiness bloqueado", tone: "blocker" }
        : securityRisk === "alert"
          ? { label: "Alertas activas", tone: "alert" }
          : { label: "Plataforma estable", tone: "ready" };
  const executiveSummary =
    dominantDecision.tone === "critical"
      ? `Cerrar ahora: ${secretRiskAction.label.toLowerCase()} antes de seguir ampliando el piloto.`
      : dominantDecision.tone === "blocker"
        ? `Resolver ahora: ${readinessAction.label.toLowerCase()} para destrabar el avance.`
        : dominantDecision.tone === "alert"
          ? `Revisar ahora: ${securityAction.label.toLowerCase()} antes de ampliar el alcance.`
          : "Confirmar ahora: listo para preparar el siguiente hito.";
  const decisionLeadToneClass = dominantDecision.tone === "critical" || dominantDecision.tone === "blocker" || dominantDecision.tone === "alert" ? "pulseStrong" : "";

  return (
    <section className="pilotCommand" aria-label="Completitud y salud del piloto">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Comando del piloto</p>
          <h2>Completitud y salud operacional</h2>
        </div>
        <span className={`badge ${tone === "ok" ? "" : tone === "danger" ? "danger" : "warning"}`}>{score}% salud</span>
      </div>

      <div className={`pilotExecutiveSummary ${dominantDecision.tone} ${decisionLeadToneClass}`} key={dominantDecision.label}>
        <span>Resumen ejecutivo</span>
        <strong>{executiveSummary}</strong>
      </div>

      <div className="pilotCommandSummary">
        <div>
          <span>Auth</span>
          <strong>{authMode === "demo" ? "Controlado" : "Producción"}</strong>
        </div>
        <div>
          <span>Completitud</span>
          <strong>{readiness.score}%</strong>
        </div>
        <div>
          <span>Listo</span>
          <strong>{readyItems.length}</strong>
        </div>
        <div>
          <span>Pendiente</span>
          <strong>{pendingItems.length}</strong>
        </div>
        <div>
          <span>Secretos</span>
          <strong>{secretPosture.summary.configured}/{secretPosture.summary.total}</strong>
        </div>
        <div>
          <span>Alertas</span>
          <strong>{securityAlerts}</strong>
        </div>
        <p>
          {tone === "ok"
            ? "La plataforma tiene una base consistente para el piloto controlado."
            : nextFocus
              ? `Siguiente foco: ${nextFocus.label}.`
              : secretRisk
                ? `Revisar secreto: ${secretRisk.label}.`
                : "La plataforma requiere un cierre adicional antes de operar."}
        </p>
      </div>

      <div className="pilotCommandGrid">
        <div>
          <h3>Próximo foco</h3>
          <div className="healthCard">
            <strong>{nextFocus ? nextFocus.label : "Sin pendientes visibles"}</strong>
            <p>{nextFocus ? nextFocus.detail : "No quedan frentes operativos abiertos en la lectura actual."}</p>
            <a className="buttonLike primary" href={targetHref}>
              {targetLabel}
            </a>
          </div>
        </div>
        <div>
          <h3>Señal de riesgo</h3>
          <div className="healthCard">
            <strong>{secretRisk ? secretRisk.label : "Postura estable"}</strong>
            <p>{secretRisk ? `${secretRisk.configured ? "Configurado" : "Pendiente"} · ${secretRisk.key}` : "No hay riesgos críticos visibles en secretos."}</p>
            <a className="buttonLike" href="#admin-ia">
              Revisar secretos
            </a>
          </div>
        </div>
        <div>
          <h3>Listo / Pendiente</h3>
          <div className="healthCard">
            <strong>{readyItems.length} / {pendingItems.length}</strong>
            <p>{readiness.mode === "pilot_ready" ? "La lectura de readiness ya está lista para piloto." : readiness.summary.blockers ? "Hay bloqueantes que resolver antes de avanzar." : "Solo quedan cierres de configuración."}</p>
            <a className="buttonLike" href="#estado-producto">
              Ver completitud
            </a>
          </div>
        </div>
      </div>

      <div className="pilotCommandActions" aria-label="Acciones ejecutivas">
        <a className="buttonLike primary" href="#usuarios">Abrir consola de tickets</a>
        <a className="buttonLike" href="#ejecutivo">Revisar impacto</a>
        <a className="buttonLike" href="#admin-ia">Revisar controles</a>
        <a className="buttonLike" href="#api">Validar API</a>
      </div>

      <div className="pilotDecisionStrip" aria-label="Decisiones por semaforo">
        <div className={`pilotDecisionLead ${dominantDecision.tone} ${decisionLeadToneClass}`} key={`lead-${dominantDecision.label}`}>
          <span>Riesgo dominante</span>
          <strong>{dominantDecision.label}</strong>
          <p>La primera acción debe resolver este frente antes de ampliar el piloto.</p>
        </div>
        {decisionCards.map((card) => (
          <div className={`pilotDecisionCard ${card.tone} ${card.tone === dominantDecision.tone ? "focus" : ""}`} key={card.title}>
            <span>{card.title}</span>
            <strong>{card.action}</strong>
            <p>{card.detail}</p>
            <a className="buttonLike primary" href={card.href}>
              Ejecutar
            </a>
          </div>
        ))}
      </div>

      <div className="pilotRecommendation" aria-label="Recomendacion ejecutiva">
        <div>
          <span>Recomendacion</span>
          <strong>{recommendation.action}</strong>
        </div>
        <p>{recommendation.detail}</p>
        <a className="buttonLike primary" href={recommendation.href}>
          Ejecutar ahora
        </a>
      </div>

      <div className="pilotRiskBoard" aria-label="Mapa de riesgo ejecutivo">
        <div className={`pilotRiskCard ${secretRiskState}`}>
          <div className={`pilotRiskPill ${secretRiskState}`}>{secretRiskState === "critical" ? "rojo" : secretRiskState === "warning" ? "ámbar" : "verde"}</div>
          <span>Secretos</span>
          <strong>{secretRiskState === "critical" ? "Crítico" : secretRiskState === "warning" ? "Revisar" : "OK"}</strong>
          <small>{secretCriticalCount} críticos · {secretWarningCount} advertencias</small>
          <small>{secretPosture.summary.configured}/{secretPosture.summary.total} configurados</small>
          <p>{secretRisk ? secretRisk.label : "Sin riesgos visibles"}</p>
          <small>{secretRiskAction.detail}</small>
          <a className="buttonLike" href="#admin-ia">
            {secretRiskAction.label}
          </a>
        </div>
        <div className={`pilotRiskCard ${readinessRisk}`}>
          <div className={`pilotRiskPill ${readinessRisk}`}>{readinessRisk === "blocker" ? "bloqueado" : readinessRisk === "pending" ? "pendiente" : "listo"}</div>
          <span>Readiness</span>
          <strong>{readiness.mode === "pilot_ready" ? "Listo" : readinessRisk === "blocker" ? "Bloqueado" : "En progreso"}</strong>
          <small>{readinessBlockerCount} bloqueantes · {readinessPendingCount} pendientes</small>
          <small>{readyItems.length} listos · {readiness.score}% completado</small>
          <p>{nextFocus ? nextFocus.detail : "No quedan pendientes visibles"}</p>
          <small>{readinessAction.detail}</small>
          <a className="buttonLike" href={targetHref}>
            {readinessAction.label}
          </a>
        </div>
        <div className={`pilotRiskCard ${securityRisk}`}>
          <div className={`pilotRiskPill ${securityRisk}`}>{securityRisk === "alert" ? "alerta" : "estable"}</div>
          <span>Seguridad</span>
          <strong>{securityRisk === "alert" ? `${securityAlerts} alertas` : "Sin alertas"}</strong>
          <small>{securityAlerts} eventos visibles en el panel ejecutivo</small>
          <small>{securityRisk === "alert" ? "Requiere revision prioritaria" : "Sin necesidad de escalamiento inmediato"}</small>
          <p>{securityRisk === "alert" ? "Revisar eventos antes de ampliar el alcance." : "Señal de seguridad controlada."}</p>
          <small>{securityAction.detail}</small>
          <a className="buttonLike" href="#admin-ia">
            {securityAction.label}
          </a>
        </div>
      </div>
    </section>
  );
}
