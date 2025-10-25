import NextAuth from "next-auth";
import { authOptions } from "~/server/auth/config";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// example usage of getServerAuthSession in a route
// import { getServerAuthSession } from "~/server/auth/config";

// export default async function Page() {
//   const session = await getServerAuthSession();
//   // session?.user.id / role / teamId are available
//   return null;
// }
