"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import type { KnowledgeArticle } from "@/lib/nexera/contracts";

type KnowledgeSearchPanelProps = {
  initialArticles: KnowledgeArticle[];
};

const domains = ["Todos", "Conectividad", "Identidad", "Endpoint"];

export function KnowledgeSearchPanel({ initialArticles }: KnowledgeSearchPanelProps) {
  const [articles, setArticles] = useState(initialArticles);
  const [domain, setDomain] = useState("Todos");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let isActive = true;
    const params = new URLSearchParams();
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
    if (domain !== "Todos") params.set("domain", domain);

    startTransition(() => {
      void fetch(`/api/knowledge${params.size ? `?${params.toString()}` : ""}`, {
        headers: { "x-nexera-role": "Usuario" },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("No se pudo buscar conocimiento.");
          return response.json() as Promise<{ data: KnowledgeArticle[] }>;
        })
        .then((payload) => {
          if (!isActive) return;
          setArticles(payload.data);
          setNotice(null);
        })
        .catch(() => {
          if (isActive) setNotice("Busqueda no disponible. Mostrando conocimiento inicial.");
        });
    });

    return () => {
      isActive = false;
    };
  }, [deferredQuery, domain]);

  return (
    <>
      <div className="knowledgeSearch">
        <input aria-label="Buscar conocimiento" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar VPN, MFA, 365..." value={query} />
        <select aria-label="Filtrar dominio knowledge" onChange={(event) => setDomain(event.target.value)} value={domain}>
          {domains.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <span>{isPending ? "Buscando..." : `${articles.length} resultados`}</span>
      </div>
      {notice ? <p className="consoleNotice warning" role="status">{notice}</p> : null}
      <div className="knowledgeList">
        {articles.map((article) => (
          <div key={article.id}>
            <strong>{article.title}</strong>
            <p>{article.summary}</p>
            <span>{article.domain} · {article.status} · {article.uses} usos · Calidad {article.qualityScore}%</span>
          </div>
        ))}
        {!articles.length ? <p className="emptyState">Sin coincidencias. Prueba con VPN, MFA, 365 o notebook.</p> : null}
      </div>
    </>
  );
}
