import { isAdmin } from "@/lib/adminAuth";
import { getCurrentUser } from "@/lib/auth";

/** A shared, server-validated account identity for public navigation. */
export async function getBrowserAccount(workspace?: string | null) {
  // A workspace hint selects a destination; it never grants a role or a session.
  if (workspace === "admin") {
    return await isAdmin()
      ? { role: "admin", destination: "/admin", label: "Panou ADMIN" }
      : { role: null, destination: "/admin", label: "Autentificare ADMIN" };
  }
  if (workspace === "firma" || workspace === "client") {
    const user = await getCurrentUser();
    return user?.role === workspace
      ? { role: workspace, destination: `/${workspace}`, label: workspace === "firma" ? "Panou PARTENER" : "Contul meu" }
      : { role: null, destination: `/login?role=${workspace}`, label: workspace === "firma" ? "Login firmă" : "Login client" };
  }
  if (await isAdmin()) return { role: "admin", destination: "/admin", label: "Panou ADMIN" };
  const user = await getCurrentUser();
  if (user?.role === "firma") return { role: "firma", destination: "/firma", label: "Contul meu" };
  if (user?.role === "client") return { role: "client", destination: "/client", label: "Contul meu" };
  return { role: null, destination: "/login", label: null };
}
