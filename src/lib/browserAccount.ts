import { isAdmin } from "@/lib/adminAuth";
import { getCurrentUser } from "@/lib/auth";

/** A shared, server-validated account identity for public navigation. */
export async function getBrowserAccount() {
  if (await isAdmin()) return { role: "admin", destination: "/admin", label: "Panou ADMIN" };
  const user = await getCurrentUser();
  if (user?.role === "firma") return { role: "firma", destination: "/firma", label: "Contul meu" };
  if (user?.role === "client") return { role: "client", destination: "/client", label: "Contul meu" };
  return { role: null, destination: "/login", label: null };
}
