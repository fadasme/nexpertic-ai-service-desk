import { requirePermission } from "@/lib/nexera/auth-store";
import { listKnowledgeArticles } from "@/lib/nexera/service";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "knowledge:read");
  if (!authorization.allowed) return authorization.response;

  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  return Response.json({
    data: listKnowledgeArticles({ domain, q }),
  });
}
