import { requireAdmin } from "@/lib/admin";
import SignOutButton from "../sign-out-button";
import NavLinks from "./nav-links";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();

  return (
    <>
      <header className="topbar">
        <span className="brand">Humor Admin</span>
        <NavLinks />
        <div className="who">
          <span className="muted small">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
