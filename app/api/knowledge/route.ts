import { requirePermission } from "@/lib/nexera/auth-store";
import { listKnowledgeArticles } from "@/lib/nexera/service";
import { createKnowledgeArticle, listStoredKnowledge } from "@/lib/nexera/knowledge-store";
import { tenantIdFromRequest } from "@/lib/nexera/tenant-context";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "knowledge:read");
  if (!authorization.allowed) return authorization.response;

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const stored = await listStoredKnowledge(await tenantIdFromRequest(request));
  const data = listKnowledgeArticles({ domain, q });
  return Response.json({ data: [...stored, ...data.filter((item) => !stored.some((storedItem) => storedItem.id === item.id))] });
}

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "knowledge:write");
  if (!authorization.allowed) return authorization.response;
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; domain?: unknown; summary?: unknown };
  try {
    const article = await createKnowledgeArticle({ title: typeof body.title === "string" ? body.title : "", domain: typeof body.domain === "string" ? body.domain : "", summary: typeof body.summary === "string" ? body.summary : "" }, await tenantIdFromRequest(request));
    return Response.json({ data: article }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create article" }, { status: 400 });
  }
}
