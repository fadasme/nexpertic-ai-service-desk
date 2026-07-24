import type { KnowledgeArticle } from "./contracts";

function searchTerms(text: string) {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((term) => term.length >= 3);
}

export function searchKnowledgeArticles(articles: KnowledgeArticle[], filters?: { domain?: string; q?: string }) {
  const query = filters?.q?.trim().toLowerCase();
  const terms = query ? searchTerms(query) : [];
  const domain = filters?.domain?.trim().toLowerCase();

  return articles
    .filter((article) => {
      const matchesDomain = !domain || article.domain.toLowerCase() === domain;
      const haystack = [article.id, article.title, article.domain, article.summary]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !terms.length || terms.every((term) => haystack.includes(term));

      return matchesDomain && matchesQuery;
    })
    .sort((left, right) => {
      if (right.qualityScore !== left.qualityScore) return right.qualityScore - left.qualityScore;
      return right.uses - left.uses;
    });
}

export function suggestKnowledgeArticle(articles: KnowledgeArticle[], text: string) {
  const terms = searchTerms(text);
  if (!terms.length) return null;

  const scored = articles
    .map((article) => {
      const haystack = [article.id, article.title, article.domain, article.summary]
        .join(" ")
        .toLowerCase();
      const matches = terms.filter((term) => haystack.includes(term)).length;

      return {
        article,
        score: matches * 100 + article.qualityScore + article.uses / 100,
      };
    })
    .filter((entry) => entry.score >= 100)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.article ?? null;
}
