import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LabExploreClient from "../explore/LabExploreClient";
import { hasLabAccess } from "@/lib/lab-access";

export const dynamic = "force-dynamic";

export default async function LabDoramasPage() {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) redirect("/login");

    const isAdmin = session?.user?.role === "ADMIN";
    const access = await hasLabAccess(session.user.id, session.user.role);
    if (!access) redirect("/subscribe");

    return <LabExploreClient isLoggedIn={true} isAdmin={isAdmin} initialCategory="dorama" />;
}
