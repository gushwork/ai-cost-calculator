export function normalizeModelId(model: string): string {
  return model.trim().toLowerCase();
}

export function stripProviderPrefix(modelId: string): string {
  const idx = modelId.indexOf("/");
  return idx >= 0 ? modelId.slice(idx + 1) : modelId;
}
