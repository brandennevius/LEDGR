import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getAuthedUser = async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return null;
  }

  const email = data.user.email;
  if (!email) {
    return null;
  }

  const name =
    (data.user.user_metadata?.full_name as string | undefined) ??
    (data.user.user_metadata?.name as string | undefined) ??
    null;

  const dbUser = await prisma.user.upsert({
    where: { id: data.user.id },
    update: {
      email,
      name,
    },
    create: {
      id: data.user.id,
      email,
      name,
      role: "CLIENT",
    },
  });

  return dbUser;
};

export const requireAuthedUser = async () => {
  const user = await getAuthedUser();
  if (!user) {
    redirect("/login");
  }
  return user;
};
