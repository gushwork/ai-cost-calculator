const BERRI_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";
const HELICONE_URL = "https://www.helicone.ai/api/llm-costs";
const PORTKEY_PRICING_BASE = "https://configs.portkey.ai/pricing";

const PORTKEY_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "meta",
  "cohere",
  "deepseek",
  "jina",
] as const;

let cachePromise: Promise<Record<string, string>> | null = null;

function normalize(id: string): string {
  return id.trim().toLowerCase();
}

function stripProvider(modelId: string): string | null {
  const idx = modelId.indexOf("/");
  if (idx < 0) return null;
  return modelId.slice(idx + 1);
}

function addAlias(
  map: Record<string, string>,
  alias: string,
  canonical: string,
): void {
  const key = normalize(alias);
  if (key && canonical && !map[key]) {
    map[key] = canonical;
  }
}

async function extractFromLiteLLM(
  aliases: Record<string, string>,
): Promise<void> {
  const res = await fetch(BERRI_URL);
  if (!res.ok) return;
  const payload = (await res.json()) as Record<string, Record<string, unknown>>;

  for (const key of Object.keys(payload)) {
    if (key === "sample_spec") continue;
    const normalizedKey = normalize(key);

    const bare = stripProvider(normalizedKey);
    if (bare) {
      addAlias(aliases, normalizedKey, bare);
    } else {
      addAlias(aliases, normalizedKey, normalizedKey);
    }
  }
}

async function extractFromOpenRouter(
  aliases: Record<string, string>,
): Promise<void> {
  const headers: Record<string, string> = {};
  if (process.env.OPENROUTER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  const res = await fetch(OPENROUTER_URL, { headers });
  if (!res.ok) return;
  const payload = (await res.json()) as {
    data?: Array<{ id?: string; canonical_slug?: string }>;
  };

  for (const model of payload.data ?? []) {
    const id = typeof model.id === "string" ? normalize(model.id) : null;
    const slug =
      typeof model.canonical_slug === "string"
        ? normalize(model.canonical_slug)
        : null;

    const canonical = slug ? stripProvider(slug) ?? slug : null;
    const idBare = id ? stripProvider(id) ?? id : null;
    const resolvedCanonical = canonical ?? idBare ?? id;
    if (!resolvedCanonical) continue;

    if (id) addAlias(aliases, id, resolvedCanonical);
    if (slug) addAlias(aliases, slug, resolvedCanonical);
    if (idBare && idBare !== resolvedCanonical)
      addAlias(aliases, idBare, resolvedCanonical);
  }
}

async function extractFromHelicone(
  aliases: Record<string, string>,
): Promise<void> {
  const res = await fetch(HELICONE_URL);
  if (!res.ok) return;
  const payload = (await res.json()) as {
    data?: Array<{
      provider?: string;
      model?: string;
      operator?: string;
    }>;
  };

  for (const entry of payload.data ?? []) {
    if (!entry.model || entry.operator !== "equals") continue;
    const modelId = normalize(entry.model);
    const bare = stripProvider(modelId);
    if (bare) {
      addAlias(aliases, modelId, bare);
    } else {
      addAlias(aliases, modelId, modelId);
    }
  }
}

async function extractFromPortkey(
  aliases: Record<string, string>,
): Promise<void> {
  const fetches = PORTKEY_PROVIDERS.map(async (provider) => {
    try {
      const res = await fetch(`${PORTKEY_PRICING_BASE}/${provider}.json`);
      if (!res.ok) return;
      const payload = (await res.json()) as Record<string, unknown>;

      for (const key of Object.keys(payload)) {
        if (key === "default") continue;
        const modelId = normalize(key);
        addAlias(aliases, modelId, modelId);
      }
    } catch {
      // skip unavailable providers
    }
  });
  await Promise.all(fetches);
}

async function buildAliasMap(): Promise<Record<string, string>> {
  const aliases: Record<string, string> = {};

  const results = await Promise.allSettled([
    extractFromLiteLLM(aliases),
    extractFromOpenRouter(aliases),
    extractFromHelicone(aliases),
    extractFromPortkey(aliases),
  ]);

  const allFailed = results.every((r) => r.status === "rejected");
  if (allFailed) {
    return aliases;
  }

  return aliases;
}

export async function getAliasMap(): Promise<Record<string, string>> {
  if (!cachePromise) {
    cachePromise = buildAliasMap();
  }
  return cachePromise;
}

export function clearAliasCache(): void {
  cachePromise = null;
}
