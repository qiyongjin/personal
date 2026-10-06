import { translate } from "../../shared/i18n";
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");

export function apiUrl(path: string) {
  return `${apiBase}${path}`;
}

export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(url), {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: {
        "Accept-Language": document.documentElement.lang,
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError("网络连接失败，请检查连接后重试。", 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.message ?? "操作失败，请稍后重试。",
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown) {
  return translate(
    error instanceof Error ? error.message : "操作失败，请稍后重试。",
    document.documentElement.lang === "en" ? "en" : "zh",
  );
}
