import { prisma } from "@/lib/db";

export const getDemoClient = async () => {
  return prisma.user.upsert({
    where: { email: "demo@arbor.app" },
    update: {},
    create: {
      email: "demo@arbor.app",
      name: "Alex Rivera",
      role: "CLIENT",
    },
  });
};
