"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import type { Agent, AuditEvent, Client, Device, KnowledgeArticle, RemoteSupportSession, SessionUser, TenantConfig, Ticket, UserAccount, UserRole } from "@/lib/nexera/contracts";
import { ServiceDeskConsole } from "./ServiceDeskConsole";
import { SessionExpiryTicker } from "./SessionExpiryTicker";

type WorkspaceView =
  | "dashboard"
  | "tickets"
  | "clients"
  | "devices"
  | "alerts"
  | "patches"
  | "assets"
  | "networks"
  | "reports"
  | "knowledge"
  | "integrations"
  | "ai"
  | "admin";

type WorkspaceProps = {
  initialAuditEvents: AuditEvent[];
  initialKnowledgeArticles: KnowledgeArticle[];
  initialRemoteSessions: RemoteSupportSession[];
  initialSession: SessionUser;
  initialTickets: Ticket[];
  initialView?: WorkspaceView;
};

const navItems: Array<{ icon: string; label: string; view: WorkspaceView }> = [
  { icon: "grid", label: "Panel de control", view: "dashboard" },
  { icon: "ticket", label: "Tickets", view: "tickets" },
  { icon: "users", label: "Clientes", view: "clients" },
  { icon: "monitor", label: "Dispositivos", view: "devices" },
  { icon: "alert", label: "Alertas", view: "alerts" },
  { icon: "patch", label: "Gestión de parches", view: "patches" },
  { icon: "layers", label: "Inventario de activos", view: "assets" },
  { icon: "network", label: "Descubrimiento de redes", view: "networks" },
  { icon: "chart", label: "Informes", view: "reports" },
  { icon: "book", label: "Base de conocimiento", view: "knowledge" },
  { icon: "plug", label: "Integraciones", view: "integrations" },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    alert: <><path d="M12 3 2.7 19h18.6L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></>,
    chart: <><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></>,
    network: <><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5M5 17l7-5 7 5"/></>,
    patch: <><path d="M8 3v3M16 3v3M8 18v3M16 18v3M3 8h3M18 8h3M3 16h3M18 16h3"/><rect x="6" y="6" width="12" height="12" rx="2"/><path d="m9 12 2 2 4-5"/></>,
    plug: <><path d="M12 22v-5"/><path d="M9 8V2M15 8V2"/><path d="M18 8v4a6 6 0 0 1-12 0V8h12Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    ticket: <><path d="M3 8a2 2 0 0 0 0 4v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0 0-4V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3Z"/><path d="M13 5v2M13 10v2M13 15v2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  };
  return <svg aria-hidden="true" className="nxIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.grid}</svg>;
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="nxEmpty"><span className="nxEmptyIcon"><Icon name={icon} /></span><h3>{title}</h3><p>{text}</p></div>;
}

export function NexperticWorkspace({
  initialAuditEvents,
  initialKnowledgeArticles,
  initialRemoteSessions,
  initialSession,
  initialTickets,
  initialView = "dashboard",
}: WorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authPending, startAuthTransition] = useTransition();
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const clients = Array.from(new Set(initialTickets.map((ticket) => ticket.requester))).filter(Boolean);
  const filteredTickets = initialTickets.filter((ticket) => [ticket.id, ticket.title, ticket.requester, ticket.category, ticket.status].join(" ").toLowerCase().includes(deferredQuery));
  const filteredEvents = initialAuditEvents.filter((event) => [event.actor, event.action, event.detail, event.ticketId].join(" ").toLowerCase().includes(deferredQuery));

  const changeView = (next: WorkspaceView) => {
    setView(next);
    setQuery("");
    setSidebarOpen(false);
  };

  function lockSession() {
    startAuthTransition(async () => {
      const response = await fetch("/api/auth/lock", { method: "POST" });
      if (response.ok) window.location.href = "/signin?mode=unlock&returnTo=/";
    });
  }

  function logout() {
    startAuthTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/signin";
    });
  }

  return (
    <main className="nxWorkspace">
      <aside className={`nxSidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="nxBrand" onClick={() => changeView("dashboard")} type="button" aria-label="Ir al panel">
          <span className="nxBrandMark">N</span><strong>NEXPERTIC</strong>
        </button>
        <nav className="nxNav" aria-label="Módulos de Nexpertic">
          {navItems.map((item) => (
            <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => changeView(item.view)} type="button">
              <Icon name={item.icon} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="nxNavBottom">
          <button className={view === "ai" ? "active" : ""} onClick={() => changeView("ai")} type="button"><span className="nxSpark">✦</span><span>Centro de IA</span><small>Nuevo</small></button>
          <button className={view === "admin" ? "active" : ""} onClick={() => changeView("admin")} type="button"><Icon name="patch"/><span>Administración</span></button>
        </div>
      </aside>
      {sidebarOpen && <button className="nxSidebarScrim" onClick={() => setSidebarOpen(false)} type="button" aria-label="Cerrar navegación" />}

      <section className="nxStage">
        <header className="nxTopbar">
          <button className="nxMenuButton" onClick={() => setSidebarOpen((value) => !value)} type="button" aria-label="Abrir navegación">☰</button>
          <div className="nxGlobalSearch"><Icon name="search"/><input aria-label="Buscar en el módulo" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en Nexpertic" value={query}/></div>
          <div className="nxTopActions"><button type="button">Instalar agente</button><SessionExpiryTicker className="warning" expiresAt={initialSession.expiresAt} mode="badge"/><button disabled={authPending} onClick={lockSession} type="button">Bloquear</button><button disabled={authPending} onClick={logout} type="button">Salir</button><button className="nxCircle" type="button" aria-label="Notificaciones">●</button><button className="nxCircle" type="button" aria-label="Ayuda">?</button><span className="nxAvatar">{initialSession.name.slice(0, 2).toUpperCase()}</span></div>
        </header>
        <div className="nxStatusBar"><span>Nexpertic AI Service Desk · operación conectada</span><button onClick={() => changeView("ai")} type="button">Abrir Centro de IA</button></div>
        <section className="nxContent">
          {view === "dashboard" && <Dashboard tickets={initialTickets} events={initialAuditEvents} remote={initialRemoteSessions} onNavigate={changeView} />}
          {view === "tickets" && <TicketsView tickets={filteredTickets} audit={initialAuditEvents} knowledge={initialKnowledgeArticles} remote={initialRemoteSessions} session={initialSession} />}
          {view === "clients" && <ClientsView clients={clients.filter((client) => client.toLowerCase().includes(deferredQuery))} tickets={initialTickets} />}
          {view === "devices" && <DevicesView remote={initialRemoteSessions} />}
          {view === "alerts" && <AlertsView events={filteredEvents} />}
          {view === "patches" && <PatchesView remote={initialRemoteSessions} />}
          {view === "assets" && <AssetsView remote={initialRemoteSessions} />}
          {view === "networks" && <NetworksView tickets={initialTickets} />}
          {view === "reports" && <ReportsView tickets={initialTickets} events={initialAuditEvents} />}
          {view === "knowledge" && <KnowledgeView articles={initialKnowledgeArticles.filter((article) => [article.title, article.domain, article.summary].join(" ").toLowerCase().includes(deferredQuery))} />}
          {view === "integrations" && <IntegrationsView remote={initialRemoteSessions} />}
          {view === "ai" && <AiView tickets={initialTickets} articles={initialKnowledgeArticles} />}
          {view === "admin" && <AdminView session={initialSession} />}
        </section>
      </section>
    </main>
  );
}

function PageTitle({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return <div className="nxPageTitle"><div><h1>{title}</h1>{text && <p>{text}</p>}</div>{action}</div>;
}

function Dashboard({ tickets, events, remote, onNavigate }: { tickets: Ticket[]; events: AuditEvent[]; remote: RemoteSupportSession[]; onNavigate: (view: WorkspaceView) => void }) {
  const stats = [
    ["Sin resolver", tickets.filter((t) => t.status !== "Resuelto").length, "blue"],
    ["Vencidos", tickets.filter((t) => t.sla !== "Normal").length, "orange"],
    ["Abiertos", tickets.filter((t) => t.status === "Nuevo").length, "green"],
    ["En proceso", tickets.filter((t) => ["Asignado", "En diagnostico", "Escalado"].includes(t.status)).length, "teal"],
  ] as const;
  return <>
    <PageTitle title="Panel de control" text="Estado operativo del service desk en tiempo real." action={<div className="nxTitleActions"><button onClick={() => onNavigate("tickets")} type="button">Ver tickets</button><button className="primary" onClick={() => onNavigate("ai")} type="button">Perspectivas IA</button></div>}/>
    <div className="nxMetricGrid">{stats.map(([label, value, tone]) => <article className={`nxMetric ${tone}`} key={label}><span>{label}</span><strong>{value}</strong><small>Actualizado ahora</small></article>)}</div>
    <div className="nxDashboardGrid">
      <article className="nxPanel nxPanelWide"><div className="nxPanelHeader"><h2>Tickets sin asignar</h2><button onClick={() => onNavigate("tickets")} type="button">Ver todos</button></div><div className="nxTableWrap"><table><thead><tr><th>Ticket</th><th>Detalle</th><th>Prioridad</th><th>SLA</th></tr></thead><tbody>{tickets.slice(0, 6).map((ticket) => <tr key={ticket.id}><td><b>{ticket.id}</b></td><td>{ticket.title}</td><td><span className={`nxPill ${ticket.priority.toLowerCase()}`}>{ticket.priority}</span></td><td>{ticket.sla}</td></tr>)}</tbody></table></div></article>
      <article className="nxPanel"><div className="nxPanelHeader"><h2>Actividad reciente</h2><span>{events.length}</span></div><div className="nxActivityList">{events.slice(0, 6).map((event) => <div key={event.id}><span className="nxActivityDot"/><div><strong>{event.action}</strong><p>{event.detail}</p><small>{event.actor}</small></div></div>)}</div></article>
      <article className="nxPanel"><div className="nxPanelHeader"><h2>Soporte remoto</h2><span>{remote.length}</span></div><div className="nxDonutRow"><div className="nxDonut" style={{"--value": `${Math.min(100, remote.filter((item) => item.consentGrantedAt).length * 20)}%`} as React.CSSProperties}><strong>{remote.filter((item) => item.consentGrantedAt).length}</strong></div><div><strong>Sesiones autorizadas</strong><p>RustDesk con consentimiento y trazabilidad.</p></div></div></article>
      <article className="nxPanel"><div className="nxPanelHeader"><h2>Salud del servicio</h2><span className="nxGood">Operativo</span></div><div className="nxHealthBars"><label>API Nexpertic <progress max="100" value="96"/></label><label>Base de conocimiento <progress max="100" value="88"/></label><label>Automatización <progress max="100" value="72"/></label></div></article>
    </div>
  </>;
}

function TicketsView({ tickets, audit, knowledge, remote, session }: { tickets: Ticket[]; audit: AuditEvent[]; knowledge: KnowledgeArticle[]; remote: RemoteSupportSession[]; session: SessionUser }) {
  return <><PageTitle title="Tickets" text={`${tickets.length} solicitudes encontradas`} action={<button className="nxPrimaryAction" onClick={() => document.getElementById("command-center")?.scrollIntoView({ behavior: "smooth", block: "start" })} type="button">+ Nuevo ticket</button>}/><div className="nxModuleTabs"><button className="active" type="button">Entradas</button><button type="button">Programa</button><span>Vista operativa completa</span></div><div className="nxConsoleHost"><ServiceDeskConsole initialAuditEvents={audit} initialKnowledgeArticles={knowledge} initialRemoteSessions={remote} initialSession={session} initialTickets={tickets}/></div></>;
}

function ClientsView({ clients, tickets }: { clients: string[]; tickets: Ticket[] }) {
  const [directory, setDirectory] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "" });

  useEffect(() => {
    fetch("/api/clients").then(async (response) => {
      const payload = (await response.json()) as { data?: Client[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar los clientes.");
      setDirectory(payload.data ?? []);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  async function saveClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const payload = (await response.json()) as { data?: Client; error?: string };
    if (!response.ok || !payload.data) { setMessage(payload.error ?? "No se pudo crear el cliente."); return; }
    setDirectory((current) => [...current, payload.data as Client].sort((left, right) => left.name.localeCompare(right.name)));
    setDraft({ name: "", email: "" });
    setShowForm(false);
    setMessage("Cliente creado correctamente.");
  }

  const rows = directory.length ? directory : clients.map((name) => ({ id: name, tenantId: "", name, email: name.includes("@") ? name : "", status: "Activo" as const, createdAt: "" }));
  return <><PageTitle title="Clientes" text="Solicitantes y organizaciones vinculadas a la mesa de servicio." action={<button className="nxPrimaryAction" onClick={() => setShowForm((value) => !value)} type="button">{showForm ? "Cerrar" : "+ Nuevo cliente"}</button>}/>{showForm ? <form className="nxPanel nxClientForm" onSubmit={saveClient}><h2>Nuevo cliente</h2><div className="nxFormGrid"><label>Nombre<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label><label>Correo<input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })}/></label></div><button className="nxPrimaryAction" type="submit">Guardar cliente</button></form> : null}<div className="nxToolbar"><button type="button">País</button><button type="button">Región</button><button type="button">Rango</button></div><div className="nxPanel nxDataPanel">{message ? <p className="nxAdminMessage">{message}</p> : null}<div className="nxTableWrap"><table><thead><tr><th>Nombre</th><th>Tickets</th><th>Última categoría</th><th>Contacto</th><th>Estado</th></tr></thead><tbody>{rows.map((client) => { const own = tickets.filter((ticket) => ticket.requester === client.name); return <tr key={client.id}><td><span className="nxInitial">{client.name.slice(0, 1)}</span><b>{client.name}</b></td><td>{own.length}</td><td>{own[0]?.category ?? "General"}</td><td>{client.email || "Sin correo registrado"}</td><td><span className={client.status === "Activo" ? "nxOnline" : "nxPending"}>{client.status}</span></td></tr>; })}</tbody></table></div>{rows.length === 0 && <EmptyState icon="users" title="No hay clientes para mostrar" text="Crea el primer cliente para comenzar."/>}</div></>;
}

function DevicesView({ remote }: { remote: RemoteSupportSession[] }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ name: "", clientName: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/agents")
      .then(async (response) => {
        const payload = (await response.json()) as { data?: Agent[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar los agentes.");
        setAgents(payload.data ?? []);
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    fetch("/api/devices").then(async (response) => {
      const payload = (await response.json()) as { data?: Device[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar los dispositivos.");
      setDevices(payload.data ?? []);
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  async function saveDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const payload = (await response.json()) as { data?: Device; error?: string };
    if (!response.ok || !payload.data) { setMessage(payload.error ?? "No se pudo crear el dispositivo."); return; }
    setDevices((current) => [...current, payload.data as Device].sort((left, right) => left.name.localeCompare(right.name)));
    setDraft({ name: "", clientName: "" });
    setShowForm(false);
    setMessage("Dispositivo creado correctamente.");
  }

  return <><PageTitle title="Dispositivos" text="Inventario técnico y acceso remoto desde una sola vista." action={<button className="nxPrimaryAction" onClick={() => setShowForm((value) => !value)} type="button">{showForm ? "Cerrar" : "+ Nuevo dispositivo"}</button>}/>{showForm ? <form className="nxPanel nxClientForm" onSubmit={saveDevice}><h2>Nuevo dispositivo</h2><div className="nxFormGrid"><label>Nombre<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label><label>Cliente<input required value={draft.clientName} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })}/></label></div><button className="nxPrimaryAction" type="submit">Guardar dispositivo</button></form> : null}<div className="nxToolbar"><button type="button">Clientes</button><button type="button">Favoritos</button><button type="button">Filtros</button></div><div className="nxPanel nxDataPanel"><h2>Inventario registrado</h2>{devices.length ? <div className="nxTableWrap"><table><thead><tr><th>Dispositivo</th><th>Cliente</th><th>Estado</th><th>Creado</th></tr></thead><tbody>{devices.map((device) => <tr key={device.id}><td><b>{device.name}</b></td><td>{device.clientName}</td><td><span className="nxOnline">{device.status}</span></td><td>{new Date(device.createdAt).toLocaleDateString("es-CL")}</td></tr>)}</tbody></table></div> : <EmptyState icon="monitor" title="Todavía no hay dispositivos registrados" text="Crea el primero para comenzar el inventario."/>}</div><div className="nxPanel nxDataPanel"><h2>Sesiones remotas</h2><div className="nxTableWrap"><table><thead><tr><th>Dispositivo</th><th>Disponibilidad</th><th>Cliente</th><th>Alertas</th><th>Acceso remoto</th></tr></thead><tbody>{remote.slice(0, 8).map((item) => <tr key={item.id}><td><b>{item.code}</b><small>{item.provider}</small></td><td><span className={item.status === "Conectado" ? "nxOnline" : "nxPending"}>{item.status}</span></td><td>{item.ticketId}</td><td>{item.consentGrantedAt ? 0 : 1}</td><td><a href={item.launchUrl}>Conectar</a></td></tr>)}</tbody></table></div>{remote.length === 0 && <EmptyState icon="monitor" title="Todavía no hay sesiones remotas" text="Prepara una sesión desde un ticket para comenzar."/>}</div><div className="nxPanel nxDataPanel"><h2>Agentes Nexpertic</h2>{message ? <p className="nxAdminMessage">{message}</p> : <div className="nxTableWrap"><table><thead><tr><th>Agente</th><th>Objetivo</th><th>Herramientas</th><th>Score</th><th>Revisión humana</th></tr></thead><tbody>{agents.map((agent) => <tr key={agent.id}><td><b>{agent.name}</b></td><td>{agent.goal}</td><td>{agent.tools.length}</td><td>{agent.score}</td><td>{agent.humanApprovalRequired ? "Requerida" : "No"}</td></tr>)}</tbody></table></div>}</div></>;
}

function AlertsView({ events }: { events: AuditEvent[] }) {
  return <><PageTitle title="Alertas" text="Eventos que requieren atención operativa o de seguridad."/><div className="nxToolbar"><button type="button">Guardar vista</button><button type="button">Estado</button><button type="button">Categoría</button></div><div className="nxPanel nxDataPanel"><div className="nxTableWrap"><table><thead><tr><th>Detalle</th><th>Origen</th><th>Ticket</th><th>Creado</th><th>Estado</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><b>{event.action}</b><small>{event.detail}</small></td><td>{event.actor}</td><td>{event.ticketId}</td><td>{new Date(event.at).toLocaleString("es-CL")}</td><td><span className="nxPending">Revisar</span></td></tr>)}</tbody></table></div>{events.length === 0 && <EmptyState icon="alert" title="No hay alertas" text="Los nuevos eventos aparecerán aquí automáticamente."/>}</div></>;
}

function PatchesView({ remote }: { remote: RemoteSupportSession[] }) {
  const connected = remote.filter((item) => item.status === "Conectado").length;
  return <><PageTitle title="Gestión de parches" text="Resumen de cumplimiento para estaciones y servidores."/><div className="nxToolbar"><button type="button">Clientes</button><button type="button">Tipos de dispositivo</button><button type="button">Disponibilidad</button><button type="button">Clasificaciones</button></div><div className="nxPatchGrid"><article className="nxPanel nxPatchSummary"><h2>Estado de parcheo del SO</h2><strong>{connected > 0 ? 75 : 0}%</strong><progress max="100" value={connected > 0 ? 75 : 0}/><div className="nxOsGrid">{["Windows PC", "Windows Server", "macOS", "Linux"].map((os) => <div key={os}><span>0</span><small>{os}</small></div>)}</div></article><article className="nxPanel"><h2>Dispositivos</h2><div className="nxMiniMetricGrid"><div><strong>0</strong><span>Parches críticos faltantes</span></div><div><strong>0</strong><span>Reinicios pendientes</span></div><div><strong>0</strong><span>Actualizaciones de software</span></div><div><strong>0</strong><span>Parches disponibles</span></div></div></article></div></>;
}

function AssetsView({ remote }: { remote: RemoteSupportSession[] }) {
  return <><PageTitle title="Inventario de activos" text="Activos y sesiones técnicas vinculadas al tenant." action={<button className="nxPrimaryAction" type="button">+ Nuevo activo</button>}/><div className="nxPanel nxDataPanel"><div className="nxTableWrap"><table><thead><tr><th>Activo</th><th>Tipo</th><th>Ticket asociado</th><th>Estado</th><th>Garantía</th></tr></thead><tbody>{remote.map((item) => <tr key={item.id}><td><b>{item.code}</b></td><td>Estación remota</td><td>{item.ticketId}</td><td>{item.status}</td><td>{item.expiresInMinutes} min</td></tr>)}</tbody></table></div>{remote.length === 0 && <EmptyState icon="layers" title="Conoce tu inventario de activos" text="Los dispositivos y servidores aparecerán cuando instales el primer agente."/>}</div></>;
}

function NetworksView({ tickets }: { tickets: Ticket[] }) {
  const categories = Array.from(new Set(tickets.map((ticket) => ticket.category)));
  return <><PageTitle title="Descubrimiento de redes" text="Señales de conectividad detectadas desde solicitudes y dispositivos."/><div className="nxPanel nxDataPanel"><div className="nxTableWrap"><table><thead><tr><th>Segmento</th><th>Tickets</th><th>Estaciones/servidores</th><th>Riesgo</th><th>Estado del análisis</th></tr></thead><tbody>{categories.map((category) => { const count = tickets.filter((ticket) => ticket.category === category).length; return <tr key={category}><td><b>{category}</b></td><td>{count}</td><td>{Math.max(1, Math.ceil(count / 2))}</td><td>{tickets.some((ticket) => ticket.category === category && ticket.sla !== "Normal") ? "Atención" : "Normal"}</td><td><span className="nxOnline">Analizado</span></td></tr>; })}</tbody></table></div></div></>;
}

function ReportsView({ tickets, events }: { tickets: Ticket[]; events: AuditEvent[] }) {
  const categories = Array.from(new Set(tickets.map((ticket) => ticket.category)));
  return <><PageTitle title="Informes operativos" text="Rendimiento, carga, técnicos y satisfacción."/><div className="nxReportGrid">{["General", "Monitoreo", "Técnicos", "Cumplimiento", "Satisfacción"].map((group, index) => <article className="nxPanel" key={group}><h2>{group}</h2><div className="nxReportValue">{index === 0 ? tickets.length : index === 1 ? events.length : index === 2 ? new Set(tickets.map((ticket) => ticket.owner)).size : index === 3 ? `${Math.round((tickets.filter((ticket) => ticket.sla === "Normal").length / Math.max(1, tickets.length)) * 100)}%` : "92%"}</div><p>{index === 0 ? "Tickets procesados" : index === 1 ? "Eventos auditados" : index === 2 ? "Equipos responsables" : index === 3 ? "SLA saludable" : "Índice estimado"}</p></article>)}</div><div className="nxPanel nxChartPanel"><h2>Tickets por categoría</h2><div className="nxBarChart">{categories.map((category) => { const value = tickets.filter((ticket) => ticket.category === category).length; return <div key={category}><span>{category}</span><i style={{ width: `${Math.max(8, (value / Math.max(1, tickets.length)) * 100)}%` }}/><strong>{value}</strong></div>; })}</div></div></>;
}

function KnowledgeView({ articles }: { articles: KnowledgeArticle[] }) {
  const [items, setItems] = useState(articles);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ title: "", domain: "", summary: "" });
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/knowledge").then(async (response) => { const payload = (await response.json()) as { data?: KnowledgeArticle[] }; if (response.ok) setItems(payload.data ?? []); }).catch(() => setMessage("No se pudo actualizar la base de conocimiento.")); }, []);
  async function saveArticle(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const response = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }); const payload = (await response.json()) as { data?: KnowledgeArticle; error?: string }; if (!response.ok || !payload.data) { setMessage(payload.error ?? "No se pudo crear el artículo."); return; } setItems((current) => [payload.data as KnowledgeArticle, ...current]); setDraft({ title: "", domain: "", summary: "" }); setShowForm(false); setMessage("Artículo creado correctamente."); }
  return <><PageTitle title="Base de conocimiento" text="Artículos validados para soporte y respuesta asistida." action={<button className="nxPrimaryAction" onClick={() => setShowForm((value) => !value)} type="button">{showForm ? "Cerrar" : "+ Nuevo artículo"}</button>}/>{showForm ? <form className="nxPanel nxClientForm" onSubmit={saveArticle}><h2>Nuevo artículo</h2><div className="nxFormGrid"><label>Título<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></label><label>Categoría<input required value={draft.domain} onChange={(event) => setDraft({ ...draft, domain: event.target.value })}/></label><label className="wide">Resumen<textarea required value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })}/></label></div><button className="nxPrimaryAction" type="submit">Guardar artículo</button></form> : null}<div className="nxToolbar"><button type="button">Categoría</button><button type="button">Sección</button><button type="button">Estado</button><button type="button">Palabras clave</button></div><div className="nxPanel nxDataPanel">{message ? <p className="nxAdminMessage">{message}</p> : null}<div className="nxTableWrap"><table><thead><tr><th>Artículo</th><th>Estado</th><th>Categoría</th><th>Calidad</th><th>Usos</th></tr></thead><tbody>{items.map((article) => <tr key={article.id}><td><b>{article.title}</b><small>{article.summary}</small></td><td><span className={article.status === "Validado" ? "nxOnline" : "nxPending"}>{article.status}</span></td><td>{article.domain}</td><td>{article.qualityScore}%</td><td>{article.uses}</td></tr>)}</tbody></table></div>{items.length === 0 && <EmptyState icon="book" title="No hay artículos" text="Crea el primer artículo para alimentar la asistencia IA."/>}</div></>;
}

function IntegrationsView({ remote }: { remote: RemoteSupportSession[] }) {
  const [glpiStatus, setGlpiStatus] = useState("Consultando...");
  const [rustdeskStatus, setRustdeskStatus] = useState(remote.length ? "Conectado" : "Listo para configurar");

  async function refreshStatuses() {
    const [glpiResponse, rustdeskResponse] = await Promise.all([fetch("/api/integrations/glpi/status"), fetch("/api/integrations/rustdesk")]);
    const glpiPayload = (await glpiResponse.json()) as { data?: { configured?: boolean } };
    const rustdeskPayload = (await rustdeskResponse.json()) as { data?: Array<{ status?: string }> };
    setGlpiStatus(glpiPayload.data?.configured ? "Configurado" : "Pendiente de configuración");
    setRustdeskStatus(rustdeskPayload.data?.some((item) => item.status === "Conectado") ? "Conectado" : "Listo para configurar");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshStatuses(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const cards = [
    ["GLPI", "Sincronización ITSM", glpiStatus],
    ["RustDesk", "Acceso remoto", rustdeskStatus],
    ["Microsoft Entra ID", "Acceso corporativo", "Configuración requerida"],
    ["API Nexpertic", "Automatización", "Activa"],
    ["Correo", "Creación de tickets", "En preparación"],
    ["Webhooks", "Eventos operativos", "Disponible"],
  ];
  return <><PageTitle title="Centro de aplicaciones" text="Conecta Nexpertic con las herramientas que ya utiliza tu operación." action={<button className="nxPrimaryAction" onClick={() => void refreshStatuses()} type="button">Actualizar estados</button>}/><div className="nxIntegrationGrid">{cards.map(([name, category, status]) => <article className="nxIntegrationCard" key={name}><span className="nxAppLogo">{name.slice(0, 2)}</span><div><small>{category}</small><h2>{name}</h2></div><p>Integra datos, acciones y trazabilidad sin salir del service desk.</p><footer><span>{status}</span><button disabled={!['GLPI', 'RustDesk'].includes(name)} onClick={() => void refreshStatuses()} type="button">{['GLPI', 'RustDesk'].includes(name) ? "Actualizar" : "Próximamente"}</button></footer></article>)}</div></>;
}

function AiView({ tickets, articles }: { tickets: Ticket[]; articles: KnowledgeArticle[] }) {
  const available = tickets.filter((ticket) => ticket.confidence >= 80).length;
  return <><PageTitle title="Perspectivas accionables" text="Recomendaciones de IA priorizadas para acelerar la operación."/><div className="nxAiStats"><article className="active"><strong>{available}</strong><span>Disponible</span></article><article><strong>{tickets.length - available}</strong><span>Guardado para más tarde</span></article><article><strong>{articles.filter((article) => article.status === "Validado").length}</strong><span>Implementado</span></article></div><div className="nxPanel nxAiList"><h2>Disponible</h2>{tickets.filter((ticket) => ticket.confidence >= 80).slice(0, 8).map((ticket) => <div key={ticket.id}><span className="nxSpark">✦</span><div><strong>{ticket.id}: {ticket.title}</strong><p>{ticket.aiSummary}</p></div><button type="button">Aplicar</button></div>)}</div></>;
}

function AdminView({ session }: { session: SessionUser }) {
  const [selected, setSelected] = useState("Resumen de administración");
  const groups = [
    ["Mi cuenta", ["Configuración de la cuenta", "Mi perfil", "Sesión y seguridad"]],
    ["Usuarios y seguridad", ["Técnicos", "Grupos de técnicos", "Roles y permisos", "Registro de auditoría"]],
    ["Asistencia y tickets", ["Reglas de automatización", "Configuración de tickets", "Plantillas", "Integración del calendario"]],
    ["Gestión de datos", ["Campos personalizados", "API", "Importar datos", "Integraciones"]],
    ["Administración comercial", ["Contratos", "SLA", "Horario comercial", "Productos y gastos"]],
  ] as const;
  return <>
    <PageTitle title="Administración" text={`Sesión activa: ${session.name} · ${session.role}`} action={<span className="nxAdminBadge">Acceso administrador</span>}/>
    <label className="nxAdminMobilePicker">Sección administrativa<select value={selected} onChange={(event) => setSelected(event.target.value)}><option>Resumen de administración</option>{groups.flatMap(([, items]) => items).map((item) => <option key={item}>{item}</option>)}</select></label>
    <div className="nxAdminLayout">
      <aside className="nxPanel nxAdminMenu" aria-label="Opciones de administración">
        <button className={selected === "Resumen de administración" ? "active" : ""} onClick={() => setSelected("Resumen de administración")} type="button"><span>Resumen</span><b>›</b></button>
        {groups.map(([group, items]) => <div key={group}><h2>{group}</h2>{items.map((item) => <button className={selected === item ? "active" : ""} key={item} onClick={() => setSelected(item)} type="button"><span>{item}</span><b>›</b></button>)}</div>)}
      </aside>
      <AdminDetail selected={selected} session={session}/>
    </div>
  </>;
}

function AdminDetail({ selected, session }: { selected: string; session: SessionUser }) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [usersMessage, setUsersMessage] = useState("");
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [tenantMessage, setTenantMessage] = useState("");
  const [summaryUsers, setSummaryUsers] = useState<UserAccount[]>([]);
  const [summaryAuditCount, setSummaryAuditCount] = useState<number | null>(null);
  const descriptions: Record<string, string> = {
    "Resumen de administración": "Control central de configuración, seguridad, datos y operación comercial.",
    "Configuración de la cuenta": "Define el nombre del tenant, zona horaria, idioma y preferencias generales.",
    "Mi perfil": "Actualiza los datos y preferencias del administrador conectado.",
    "Sesión y seguridad": "Revisa sesiones activas, autenticación y políticas de acceso.",
    "Técnicos": "Administra técnicos, disponibilidad, especialidades y asignaciones.",
    "Grupos de técnicos": "Organiza equipos para enrutar tickets y responsabilidades.",
    "Roles y permisos": "Controla qué puede consultar y modificar cada perfil.",
    "Registro de auditoría": "Consulta las acciones administrativas y cambios sensibles.",
    "Reglas de automatización": "Crea reglas para clasificar, asignar y notificar tickets.",
    "Configuración de tickets": "Configura estados, prioridades, categorías y campos de atención.",
    "Plantillas": "Centraliza respuestas, notas y mensajes reutilizables.",
    "Integración del calendario": "Sincroniza disponibilidad y compromisos de los equipos.",
    "Campos personalizados": "Define información adicional para tickets, clientes y activos.",
    API: "Gestiona claves, permisos y endpoints de integración.",
    "Importar datos": "Carga clientes, activos y tickets desde archivos estructurados.",
    Integraciones: "Conecta Nexpertic con las herramientas de tu operación.",
    Contratos: "Administra contratos vigentes, clientes asociados y renovaciones.",
    SLA: "Define objetivos de respuesta y resolución por servicio y prioridad.",
    "Horario comercial": "Configura calendarios de atención, feriados y zonas horarias.",
    "Productos y gastos": "Mantén el catálogo de productos, servicios y costos operativos.",
  };
  const title = selected === "Resumen de administración" ? "Centro de administración" : selected;
  const description = descriptions[selected] ?? "Configura este módulo para adaptar Nexpertic a tu operación.";
  const isAudit = selected === "Registro de auditoría";
  const isRoles = selected === "Roles y permisos";
  const usersLoading = (selected === "Técnicos" || isRoles) && users.length === 0 && !usersMessage;
  useEffect(() => {
    if (selected !== "Técnicos" && selected !== "Roles y permisos") return;
    let cancelled = false;
    fetch("/api/users")
      .then(async (response) => {
        const payload = (await response.json()) as { data?: UserAccount[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar los usuarios.");
        if (!cancelled) setUsers(payload.data ?? []);
      })
      .catch((error: Error) => { if (!cancelled) setUsersMessage(error.message); });
    return () => { cancelled = true; };
  }, [selected]);


  useEffect(() => {
    if (selected !== "Configuración de la cuenta") return;
    let cancelled = false;
    fetch("/api/tenants")
      .then(async (response) => {
        const payload = (await response.json()) as { data?: TenantConfig[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar la configuración.");
        if (!cancelled) setTenant(payload.data?.[0] ?? null);
      })
      .catch((error: Error) => { if (!cancelled) setTenantMessage(error.message); });
    return () => { cancelled = true; };
  }, [selected]);

  useEffect(() => {
    if (selected !== "Resumen de administración") return;
    let cancelled = false;
    Promise.all([fetch("/api/users"), fetch("/api/audit")])
      .then(async ([usersResponse, auditResponse]) => {
        const usersPayload = (await usersResponse.json()) as { data?: UserAccount[] };
        const auditPayload = (await auditResponse.json()) as { data?: AuditEvent[] };
        if (!usersResponse.ok || !auditResponse.ok) throw new Error("No se pudo cargar el resumen.");
        if (!cancelled) {
          setSummaryUsers(usersPayload.data ?? []);
          setSummaryAuditCount(auditPayload.data?.length ?? 0);
        }
      })
      .catch(() => { if (!cancelled) setSummaryAuditCount(null); });
    return () => { cancelled = true; };
  }, [selected]);

  async function changeRole(user: UserAccount, role: UserRole) {
    setUsersMessage("");
    const response = await fetch(`/api/users/${user.id}/role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    const payload = (await response.json()) as { data?: UserAccount; error?: string };
    if (!response.ok) { setUsersMessage(payload.error ?? "No se pudo actualizar el rol."); return; }
    setUsers((current) => current.map((item) => item.id === user.id ? payload.data ?? { ...item, role } : item));
    setUsersMessage(`Rol de ${user.name} actualizado.`);
  }
  async function saveTenant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/tenants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: String(form.get("name") ?? ""), region: String(form.get("region") ?? ""), policies: { requireRemoteConsent: form.get("requireRemoteConsent") === "on", requireSso: form.get("requireSso") === "on" } }) });
    const payload = (await response.json()) as { data?: TenantConfig; error?: string };
    setTenantMessage(response.ok ? "Configuración guardada correctamente." : payload.error ?? "No se pudo guardar la configuración.");
    if (response.ok && payload.data) setTenant(payload.data);
  }
  if (selected === "Registro de auditoría") {
    return <AdminAuditView/>;
  }
  if (selected === "Sesión y seguridad") {
    return <AdminSessionSecurity session={session}/>;
  }
  return <section className="nxAdminDetail">
    <div className="nxPanel nxAdminHero"><span className="nxAdminDetailIcon"><Icon name="patch"/></span><div><p className="nxEyebrow">Administración / {selected === "Resumen de administración" ? "Inicio" : selected}</p><h2>{title}</h2><p>{description}</p></div><span className="nxAdminBadge">Vista administrativa</span></div>
    {selected === "Resumen de administración" ? <div className="nxAdminCards"><article className="nxPanel"><span>Usuarios activos</span><strong>{summaryUsers.length || "-"}</strong><small>Datos actuales del tenant</small></article><article className="nxPanel"><span>Eventos auditados</span><strong>{summaryAuditCount ?? "-"}</strong><small>Registros de actividad disponibles</small></article><article className="nxPanel"><span>Configuración</span><strong>{tenant ? "Lista" : "-"}</strong><small>Estado de configuración del tenant</small></article><article className="nxPanel"><span>Última actividad</span><strong>Ahora</strong><small>{session.name} abrió el centro de administración</small></article></div> : <div className="nxPanel nxAdminContent">
      {selected === "Configuración de la cuenta" ? <form className="nxAdminForm" onSubmit={saveTenant}><h3>Configuración del tenant</h3>{tenant ? <><div className="nxFormGrid"><label>Nombre visible<input defaultValue={tenant.name} name="name"/></label><label>Región<input defaultValue={tenant.region} name="region"/></label></div><div className="nxToggleList"><label><span><b>Solicitar consentimiento remoto</b><small>RustDesk debe contar con autorización antes de conectar.</small></span><input defaultChecked={tenant.policies.requireRemoteConsent} name="requireRemoteConsent" type="checkbox"/></label><label><span><b>Requerir SSO</b><small>Obliga el acceso corporativo cuando OIDC está configurado.</small></span><input defaultChecked={tenant.policies.requireSso} name="requireSso" type="checkbox"/></label></div><button className="nxPrimaryAction" type="submit">Guardar configuración</button></> : <p className="nxAdminLoading">Cargando configuración del tenant...</p>}{tenantMessage && <p className="nxAdminMessage">{tenantMessage}</p>}</form> : selected === "Técnicos" ? <><h3>Técnicos y usuarios</h3>{usersLoading ? <p className="nxAdminLoading">Cargando usuarios del tenant...</p> : <div className="nxTableWrap"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><b>{user.name}</b></td><td>{user.email}</td><td><select className="nxRoleSelect" value={user.role} onChange={(event) => void changeRole(user, event.target.value as UserRole)}><option>Usuario</option><option>Analista</option><option>Ejecutivo</option><option>Admin</option></select></td><td><span className="nxOnline">{user.status}</span></td><td>{user.lastAccessAt ? new Date(user.lastAccessAt).toLocaleString("es-CL") : "Sin acceso"}</td></tr>)}</tbody></table></div>}{usersMessage && <p className="nxAdminMessage">{usersMessage}</p>}</> : isAudit ? <><h3>Actividad reciente</h3><div className="nxTableWrap"><table><thead><tr><th>Actor</th><th>Acción</th><th>Fecha</th><th>Resultado</th></tr></thead><tbody><tr><td>{session.name}</td><td>Abrió {selected.toLowerCase()}</td><td>Ahora</td><td><span className="nxOnline">Registrado</span></td></tr><tr><td>Sistema</td><td>Sincronización de tickets</td><td>Hoy, 09:42</td><td><span className="nxOnline">Correcto</span></td></tr></tbody></table></div></> : isRoles ? <><h3>Roles configurados</h3>{usersLoading ? <p className="nxAdminLoading">Cargando usuarios del tenant...</p> : <div className="nxRoleList">{users.map((user) => <label key={user.id}><span><b>{user.name}</b><small>{user.email} · {user.role}</small></span><input checked={user.status === "Activo"} readOnly type="checkbox"/></label>)}</div>}{usersMessage && <p className="nxAdminMessage">{usersMessage}</p>}</> : <><h3>Configuración de {title.toLowerCase()}</h3><div className="nxFormGrid"><label>Nombre visible<input defaultValue={title}/></label><label>Estado<select defaultValue="Activo"><option>Activo</option><option>Pendiente</option><option>Deshabilitado</option></select></label><label className="wide">Descripción<textarea defaultValue={description}/></label></div><div className="nxAdminNotice"><span className="nxOnline">Listo para configurar</span><p>Los cambios de este módulo quedarán registrados en la auditoría administrativa.</p></div></>}
    </div>}
  </section>;
}

function AdminAuditView() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/audit")
      .then(async (response) => {
        const payload = (await response.json()) as { data?: AuditEvent[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar la auditoría.");
        if (!cancelled) setEvents(payload.data ?? []);
      })
      .catch((error: Error) => { if (!cancelled) setMessage(error.message); });
    return () => { cancelled = true; };
  }, []);

  return <section className="nxAdminDetail">
    <div className="nxPanel nxAdminHero"><span className="nxAdminDetailIcon"><Icon name="patch"/></span><div><p className="nxEyebrow">Administración / Registro de auditoría</p><h2>Actividad registrada</h2><p>Consulta las acciones operativas y administrativas guardadas para este tenant.</p></div><span className="nxAdminBadge">Datos reales</span></div>
    <div className="nxPanel nxAdminContent"><h3>Eventos recientes</h3>{message ? <p className="nxAdminMessage">{message}</p> : events.length === 0 ? <p className="nxAdminLoading">No hay eventos registrados todavía.</p> : <div className="nxTableWrap"><table><thead><tr><th>Actor</th><th>Acción</th><th>Detalle</th><th>Fecha</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.actor}</td><td><b>{event.action}</b></td><td>{event.detail}</td><td>{new Date(event.at).toLocaleString("es-CL")}</td></tr>)}</tbody></table></div>}</div>
  </section>;
}

function AdminSessionSecurity({ session }: { session: SessionUser }) {
  const [pending, startTransition] = useTransition();

  function lockSession() {
    startTransition(async () => {
      const response = await fetch("/api/auth/lock", { method: "POST" });
      if (response.ok) window.location.href = "/signin?mode=unlock&returnTo=/";
    });
  }

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/signin";
    });
  }

  return <section className="nxAdminDetail">
    <div className="nxPanel nxAdminHero"><span className="nxAdminDetailIcon"><Icon name="patch"/></span><div><p className="nxEyebrow">Administración / Sesión y seguridad</p><h2>Protege tu acceso</h2><p>Consulta el estado de tu sesión y controla su cierre desde un solo lugar.</p></div></div>
    <div className="nxPanel nxAdminContent nxSecurityPanel"><h3>Sesión actual</h3><p><b>{session.name}</b><br/>{session.email} · {session.role}<br/>Tenant: {session.tenant}</p><div className="nxAdminNotice"><span className="nxOnline">Sesión activa</span><SessionExpiryTicker className="warning" expiresAt={session.expiresAt}/><p>Al bloquearla, deberás volver a ingresar tus credenciales. Al cerrar sesión se eliminarán las cookies de acceso.</p></div><div className="nxTitleActions"><button disabled={pending} onClick={lockSession} type="button">Bloquear sesión</button><button className="nxPrimaryAction" disabled={pending} onClick={logout} type="button">Cerrar sesión</button></div></div>
  </section>;
}
