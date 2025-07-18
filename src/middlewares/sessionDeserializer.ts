import { Request, Response, NextFunction } from 'express';
import { auth } from '@/lib/auth';
import { fromNodeHeaders } from 'better-auth/node';
import { User } from 'better-auth';
import { MemberService } from '@/modules/members/members.service';

export const sessionDeserializer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  req.session = session?.session;
  const user = session?.user as User & {
    role: string;
    department: string;
    departmentRole: string;
  };
  if (user) {
    const member = await MemberService.getMember(user.id);
    if (member) {
      req.user = {
        ...user,
        role: user.role,
        department: member.departmentSlug || '',
        departmentRole: member.role || '',
      };
    }
  }
  next();
};
