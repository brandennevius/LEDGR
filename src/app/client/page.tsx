import ClientOverviewClient from "@/components/ClientOverviewClient";
import { requireAuthedUser } from "@/lib/auth";
import { getClientOverviewData } from "@/lib/dashboardData";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const user = await requireAuthedUser();
  const data = await getClientOverviewData(user);
  return <ClientOverviewClient {...data} />;
}
