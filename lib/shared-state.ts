"use client";

const writeQueues = new Map<string, Promise<void>>();

export async function readSharedState<T>(key: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`/api/state/${key}`, { cache: "no-store" });
    if (!response.ok) return fallback;
    return (await response.json()).value as T;
  } catch {
    return fallback;
  }
}

export function saveSharedState<T>(key: string, value: T) {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      const response = await fetch(`/api/state/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error(`Failed to save ${key}`);
    });
  writeQueues.set(key, next);
  return next;
}
