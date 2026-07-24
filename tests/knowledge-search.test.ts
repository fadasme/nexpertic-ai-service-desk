import assert from "node:assert/strict";
import test from "node:test";
import type { KnowledgeArticle } from "../lib/nexera/contracts.ts";
import { searchKnowledgeArticles, suggestKnowledgeArticle } from "../lib/nexera/knowledge-search.ts";

const articles: KnowledgeArticle[] = [
  {
    domain: "Endpoint",
    id: "KB-003",
    qualityScore: 81,
    status: "En revision",
    summary: "Diagnostico endpoint, telemetria y limpieza segura.",
    title: "Notebook lento",
    uses: 29,
  },
  {
    domain: "Conectividad",
    id: "KB-001",
    qualityScore: 92,
    status: "Validado",
    summary: "Runbook validado para perfil, MFA y conectividad VPN.",
    title: "VPN corporativa",
    uses: 42,
  },
  {
    domain: "Identidad",
    id: "KB-002",
    qualityScore: 89,
    status: "Validado",
    summary: "Recuperacion de acceso, licencias y bloqueo condicional.",
    title: "Microsoft 365",
    uses: 37,
  },
];

test("filters knowledge articles by query", () => {
  const results = searchKnowledgeArticles(articles, { q: "vpn mfa" });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, "KB-001");
});

test("filters knowledge articles by domain", () => {
  const results = searchKnowledgeArticles(articles, { domain: "Identidad" });

  assert.deepEqual(results.map((article) => article.id), ["KB-002"]);
});

test("orders knowledge articles by quality and usage", () => {
  const results = searchKnowledgeArticles(articles);

  assert.deepEqual(results.map((article) => article.id), ["KB-001", "KB-002", "KB-003"]);
});

test("suggests the best knowledge article for ticket text", () => {
  const suggestion = suggestKnowledgeArticle(articles, "usuario sin vpn despues de MFA");

  assert.equal(suggestion?.id, "KB-001");
});
