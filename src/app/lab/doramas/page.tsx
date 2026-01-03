import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LabExploreClient from "../explore/LabExploreClient";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LabDoramasPage() {
    const session: any = await getServerSession(authOptions as any);
    if (!session) redirect("/login");

    const settings = await getSettings();
    const isAdmin = session?.user?.role === "ADMIN";
    const enabled = isAdmin || settings.labEnabled;

    if (!enabled) redirect("/");

    return <LabExploreClient isLoggedIn={true} isAdmin={isAdmin} initialCategory="dorama" />;
}
