import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import {
  findUserByEmail,
  createGoogleUser,
  linkGoogle,
  userIdOf,
  userDisplayName,
  isAdminRole,
  verifyPassword,
} from "@/lib/db/repo/userRepo";
import { downloadAvatarToLocal, getAvatarUrl } from "@/lib/utils/avatar";
import { generateShortId } from "@/lib/utils/utils";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Tài khoản",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Mật khẩu", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Meteor stores emails in an array; users.email / users.emails (citext) hold them in PG
        const user = await findUserByEmail(credentials.email.toLowerCase());

        if (!user || !user.password_hash) {
          return null; // Không tìm thấy user hoặc user không có password
        }

        // Meteor client hashes the password with SHA256 before bcrypt (verifyPassword does sha256 + bcrypt)
        if (!verifyPassword(credentials.password, user.password_hash)) {
          return null;
        }

        // Kiểm tra role: nếu là admin
        const isAdmin = isAdminRole(user.roles);

        return {
          id: userIdOf(user),
          name: userDisplayName(user) || credentials.email,
          email: credentials.email,
          image: user.profile?.avatar || null,
          role: isAdmin ? "admin" : "user"
        };
      }
    }),
    // Google One Tap: receives JWT credential token directly (no OAuth redirect)
    CredentialsProvider({
      id: "google-onetap",
      name: "Google One Tap",
      credentials: {
        credential: { label: "Credential", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.credential) return null;

        try {
          // Verify the Google JWT via Google tokeninfo endpoint
          const res = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${credentials.credential}`
          );
          if (!res.ok) return null;
          const payload = await res.json();

          // Validate audience matches our client ID
          const clientId = process.env.GOOGLE_CLIENT_ID || "";
          if (payload.aud !== clientId) return null;
          if (!payload.email_verified) return null;

          const email = payload.email?.toLowerCase();
          const name  = payload.name || payload.email;
          const image = payload.picture || null;
          const googleId = payload.sub;

          let dbUser = await findUserByEmail(email);

          if (!dbUser) {
            // Auto-create user
            dbUser = await createGoogleUser(generateShortId(6), { googleId, email, name, picture: image });
          } else if (!dbUser.google_id) {
            await linkGoogle(dbUser.id, { googleId, email, name, picture: image });
          }

          if (!dbUser) return null;

          const isAdmin = isAdminRole(dbUser.roles);
          return {
            id: userIdOf(dbUser),
            name,
            email,
            image,
            role: isAdmin ? "admin" : "user"
          };
        } catch (err) {
          console.error("[OneTap] credential verify error:", err);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const gEmail = user.email?.toLowerCase();
        if (!gEmail) return true;
        const g = { googleId: account.providerAccountId, email: gEmail, name: user.name, picture: user.image };

        // Check if user exists by email
        const existingUser = await findUserByEmail(gEmail);

        if (!existingUser) {
          // Create new user (Meteor-compatible shape)
          const newUser = await createGoogleUser(generateShortId(6), g);
          // Download avatar to local storage
          if (user.image) {
            downloadAvatarToLocal(user.image, userIdOf(newUser)).catch(() => {});
          }
        } else {
          // Link Google service to existing user if not already linked
          if (!existingUser.google_id) {
            await linkGoogle(existingUser.id, g);
          }
          // Download avatar if not yet cached
          if (!existingUser.profile?.avatarCached && user.image) {
            downloadAvatarToLocal(user.image, userIdOf(existingUser)).catch(() => {});
          }
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.role = (user as any).role || "user";
        token.id = user.id;
      }
      
      // For Google login, fetch the real DB ID and local avatar if not present
      if (account?.provider === "google" && token.email) {
        const dbUser = await findUserByEmail(token.email.toLowerCase());
        if (dbUser) {
          token.id = userIdOf(dbUser);
          token.role = dbUser.roles?.includes("admin") ? "admin" : "user";
          // Use local avatar if cached, otherwise keep Google URL
          if (dbUser.profile?.avatarId) {
            token.picture = getAvatarUrl(dbUser.profile.avatarId);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Custom login page (optional)
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
