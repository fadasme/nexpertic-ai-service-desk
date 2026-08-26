import { env } from "cloudflare:workers";
import { knowledgeArticles } from "./demo-data";
import type { CreateKnowledgeArticleInput, KnowledgeArticle } from "./contracts";
import { DEFAULT_TENANT_ID } from "./tenant-context";

type ArticleRow = { id: string; tenant_id: string; title: string; domain: string; quality_score: number; uses: number; status: KnowledgeArticle["status"]; summary: string };
const memory = globalThis as typeof globalThis & { nexeraKnowledge?: KnowledgeArticle[] };

function getMemory() { memory.nexeraKnowledge ??= [...knowledgeArticles]; return memory.nexeraKnowledge; }
function map(row: ArticleRow): KnowledgeArticle { return { id: row.id, title: row.title, domain: row.domain, qualityScore: row.quality_score, uses: row.uses, status: row.status, summary: row.summary }; }

async function ensureTable() {
  if (!env.DB) return false;
  await env.DB.prepare("create table if not exists knowledge_articles (id text primary key, tenant_id text not null, title text not null, domain text not null, quality_score integer not null, uses integer not null, status text not null, summary text not null)").run();
  return true;
}

export async function listStoredKnowledge(tenantId = DEFAULT_TENANT_ID) {
  try {
    if (await ensureTable()) {
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
    if (await ensureTable()) {
      await env.DB.prepare("insert into knowledge_articles (id, tenant_id, title, domain, quality_score, uses, status, summary) values (?, ?, ?, ?, ?, ?, ?, ?)").bind(article.id, tenantId, article.title, article.domain, article.qualityScore, article.uses, article.status, article.summary).run();
      return article;
    }
  } catch { /* Fall through to the local store. */ }
  getMemory().unshift(article);
  return article;
}
