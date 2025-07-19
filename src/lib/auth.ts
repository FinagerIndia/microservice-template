import { betterAuth, BetterAuthOptions } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { db } from '@/configs/db/mongodb';
import { admin, createAuthMiddleware, openAPI } from 'better-auth/plugins';

import { MemberService } from '@/modules/members/members.service';
import env from '@/configs/env';

const betterAuthConfig: BetterAuthOptions = {
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith('/admin/create-user')) {
        const body = ctx.body;
        const returned = ctx.context.returned as any;
        await MemberService.createMember({
          userId: returned.user.id,
          departmentSlug: body.data.department,
          role: body.data.role,
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          return {
            data: {
              ...user,
              // @ts-ignore
              role: user?.role === 'admin' ? 'admin' : 'user',
            },
          };
        },
      },
    },
  },
  database: mongodbAdapter(db),
  plugins: [openAPI(), admin()],
  advanced: {
    cookiePrefix: 'kpi-central',
  },
  trustedOrigins:
    env.NODE_ENV === 'development' // TODO: Remove this after development
      ? []
      : [],
};

export const auth = betterAuth(betterAuthConfig);
