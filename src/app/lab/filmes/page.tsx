import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LabExploreClient from "../explore/LabExploreClient";
import { getSettings } from "@/lib/settings";
import { hasLabAccess } from "@/lib/lab-access";

export const dynamic = "force-dynamic";

export default async function LabFilmesPage() {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) redirect("/login");

    const isAdmin = session?.user?.role === "ADMIN";
    const access = await hasLabAccess(session.user.id, session.user.role);
    if (!access) redirect("/subscribe");

    const settings = await getSettings();
    if (!isAdmin && !settings.enableMovies) redirect("/");

    return <LabExploreClient isLoggedIn={true} isAdmin={isAdmin} initialCategory="movie" />;
}
