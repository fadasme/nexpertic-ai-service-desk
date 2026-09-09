import { env } from "cloudflare:workers";
import type { AutomationRule } from "./contracts";
import { DEFAULT_TENANT_ID } from "./tenant-context";

const memory = globalThis as typeof globalThis & { nexeraRules?: AutomationRule[] };
function store() { memory.nexeraRules ??= []; return memory.nexeraRules; }
function hasDatabase() { return Boolean(env.DB); }
export async function listAutomationRules(tenantId = DEFAULT_TENANT_ID) { try { if (hasDatabase()) { const rows = await env.DB.prepare("select * from automation_rules where tenant_id = ? order by name").bind(tenantId).all<{ id: string; tenant_id: string; name: string; match_text: string; action: AutomationRule["action"]; enabled: number }>(); return rows.results.map((row) => ({ id: row.id, tenantId: row.tenant_id, name: row.name, matchText: row.match_text, action: row.action, enabled: Boolean(row.enabled) })); } } catch { /* Use memory fallback. */ } return store().filter((rule) => rule.tenantId === tenantId); }
export async function createAutomationRule(input: Pick<AutomationRule, "name" | "matchText" | "action">, tenantId = DEFAULT_TENANT_ID) { const rule: AutomationRule = { id: `rule-${crypto.randomUUID()}`, tenantId, name: input.name.trim(), matchText: input.matchText.trim(), action: input.action, enabled: true }; if (!rule.name || !rule.matchText) throw new Error("name and matchText are required"); try { if (hasDatabase()) { await env.DB.prepare("insert into automation_rules (id, tenant_id, name, match_text, action, enabled) values (?, ?, ?, ?, ?, 1)").bind(rule.id, tenantId, rule.name, rule.matchText, rule.action).run(); return rule; } } catch { /* Use memory fallback. */ } store().push(rule); return rule; }
