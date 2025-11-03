import { createTRPCRouter, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "~/server/db";
import fs from "fs";
import path from "path";
export const registerRouter = createTRPCRouter({
  UserRegister: publicProcedure
    .input(
      z.object({
        email: z.string(),
        name: z.string().min(2).max(100),
        password: z.string().min(0).max(15),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await db.user.create({
        data: {
          email: input.email,
          name: input.name,
          password: input.password,
        },
      });
      return user;
    }),
  getUser: publicProcedure.input(z.string()).query(async ({ input }) => {
    // Buscar usuario por email
    const user = await db.user.findUnique({
      where: { email: input },
    });

    if (!user) return null; // o {} según prefieras

    // Retornar solo name y email
    return {
      name: user.name,
      email: user.email,
    };
  }),
  isUser: publicProcedure.input(z.string()).query(async ({ input }) => {
    const user = await db.user.findUnique({
      where: { email: input },
    });
    return user ? true : false;
  }),
  saveString: publicProcedure
    .input(z.string()) // solo un string
    .mutation(({ input }) => {
      const filePath = path.join(process.cwd(), "src/user.json");

      // Guardar el string en un JSON
      fs.writeFileSync(
        filePath,
        JSON.stringify({ email: input }, null, 2),
        "utf-8",
      );

      return { success: true };
    }),
  getEmail: publicProcedure.query(() => {
    const filePath = path.join(process.cwd(), "src/user.json");

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(fileContent);

    // Retorna directamente el string
    return data.email;
  }),
});
