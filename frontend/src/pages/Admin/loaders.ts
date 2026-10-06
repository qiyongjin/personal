import { redirect } from "react-router-dom";
import { request } from "../../lib/api";
import type { ResumeRecord } from "../../../shared/resume";

export const resumeLoader = () => request<ResumeRecord>("/api/resume");
export async function adminLoader() {
  const session = await request<{ authenticated: boolean }>(
    "/api/auth/session",
  );
  if (!session.authenticated) return redirect("/admin/login");
  return resumeLoader();
}
