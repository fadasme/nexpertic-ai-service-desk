"use client";

import { useState } from "react";

const operationSteps = [
  {
    title: "1. Crear solicitud",
    target: "Portal usuarios",
    talkTrack: "El usuario registra un incidente y Nexpertic crea el ticket con clasificacion inicial.",
  },
  {
    title: "2. Gestionar cola",
    target: "Cola inteligente",
    talkTrack: "El equipo revisa prioridad, categoria, confianza IA y resumen operativo desde Nexpertic.",
  },
  {
    title: "3. Resolver o escalar",
    target: "Copiloto L2",
    talkTrack: "El analista asigna, escala, resuelve o sincroniza con GLPI segun permisos.",
  },
  {
    title: "4. Soporte remoto",
    target: "Soporte remoto",
    talkTrack: "La sesion remota queda persistida y auditada, con invitacion y estado controlado.",
  },
  {
    title: "5. Gobierno",
    target: "Auditoria y Admin IA",
    talkTrack: "Cada accion relevante queda trazada para control, seguridad y mejora continua.",
  },
];

export function OperationsGuide() {
  const [step, setStep] = useState(0);
  const active = operationSteps[step];

  function nextStep() {
    setStep((current) => (current + 1) % operationSteps.length);
  }

  return (
    <section className="demoMode" aria-label="Guia operativa">
      <div>
        <p className="eyebrow">Operacion guiada</p>
        <h2>{active.title}</h2>
        <p>{active.talkTrack}</p>
      </div>
      <div className="guideMeta">
        <span className="badge">{active.target}</span>
        <button className="primary" onClick={nextStep} type="button">Avanzar</button>
      </div>
    </section>
  );
}
