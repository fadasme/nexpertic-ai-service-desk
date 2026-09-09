import { env } from "cloudflare:workers";
import { knowledgeArticles } from "./demo-data";
import type { CreateKnowledgeArticleInput, KnowledgeArticle, UpdateKnowledgeArticleInput } from "./contracts";
import { DEFAULT_TENANT_ID } from "./tenant-context";

type ArticleRow = { id: string; tenant_id: string; title: string; domain: string; quality_score: number; uses: number; status: KnowledgeArticle["status"]; summary: string };
const memory = globalThis as typeof globalThis & { nexeraKnowledge?: KnowledgeArticle[] };

function getMemory() { memory.nexeraKnowledge ??= [...knowledgeArticles]; return memory.nexeraKnowledge; }
function map(row: ArticleRow): KnowledgeArticle { return { id: row.id, title: row.title, domain: row.domain, qualityScore: row.quality_score, uses: row.uses, status: row.status, summary: row.summary }; }

function hasDatabase() { return Boolean(env.DB); }

export async function listStoredKnowledge(tenantId = DEFAULT_TENANT_ID) {
  try {
    if (hasDatabase()) {
      const rows = await env.DB.prepare("select * from knowledge_articles where tenant_id = ? order by quality_score desc, uses desc").bind(tenantId).all<ArticleRow>();
      return rows.results.map(map);
    }
  } catch { /* Use memory fallback when D1 is unavailable. */ }
  return getMemory();
}

export async function createKnowledgeArticle(input: CreateKnowledgeArticleInput, tenantId = DEFAULT_TENANT_ID) {
  const article: KnowledgeArticle = { id: `KB-${Date.now()}`, title: input.title.trim(), domain: input.domain.trim(), qualityScore: 0, uses: 0, status: "En revision", summary: input.summary.trim() };
  if (!article.title || !article.domain || !article.summary) throw new Error("title, domain and summary are required");
  try {
    if (hasDatabase()) {
      await env.DB.prepare("insert into knowledge_articles (id, tenant_id, title, domain, quality_score, uses, status, summary) values (?, ?, ?, ?, ?, ?, ?, ?)").bind(article.id, tenantId, article.title, article.domain, article.qualityScore, article.uses, article.status, article.summary).run();
      return article;
    }
  } catch { /* Fall through to the local store. */ }
  getMemory().unshift(article);
  return article;
}

export async function updateKnowledgeArticle(id: string, input: UpdateKnowledgeArticleInput, tenantId = DEFAULT_TENANT_ID) {
  try {
    if (hasDatabase()) {
      const current = await env.DB.prepare("select * from knowledge_articles where id = ? and tenant_id = ?").bind(id, tenantId).first<ArticleRow>();
      if (!current) return null;
      const next = { ...map(current), ...input };
      await env.DB.prepare("update knowledge_articles set title = ?, domain = ?, status = ?, summary = ? where id = ? and tenant_id = ?").bind(next.title, next.domain, next.status, next.summary, id, tenantId).run();
      return next;
    }
  } catch { /* Fall through to the local store. */ }
  const store = getMemory();
  const index = store.findIndex((item) => item.id === id);
  if (index < 0) return null;
  store[index] = { ...store[index], ...input };
  return store[index];
}
