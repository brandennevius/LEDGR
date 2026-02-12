import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return { url, anonKey };
};

const resolveBearerToken = async () => {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
};

export const getAuthedUser = async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  let authedUser = !error ? data?.user ?? null : null;

  if (!authedUser) {
    const token = await resolveBearerToken();
    if (token) {
      const { url, anonKey } = getSupabaseConfig();
      const tokenClient = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: tokenData, error: tokenError } =
        await tokenClient.auth.getUser(token);
      if (!tokenError) {
        authedUser = tokenData?.user ?? null;
      }
    }
  }

  if (!authedUser) {
    return null;
  }

  const email = authedUser.email;
  if (!email) {
    return null;
  }

  const name =
    (authedUser.user_metadata?.full_name as string | undefined) ??
    (authedUser.user_metadata?.name as string | undefined) ??
    null;

  const dbUser = await prisma.user.upsert({
    where: { id: authedUser.id },
    update: {
      email,
      name,
    },
    create: {
      id: authedUser.id,
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
