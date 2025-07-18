import { Request, Response } from 'express';
import { MemberService } from './members.service';
import Respond from '@/lib/respond';
import logger from '@/configs/logger';

export class MemberHandler {
  static async getMembers(req: Request, res: Response) {
    try {
      const { page, limit, name, email, department, role } = req.query;
      const members = await MemberService.getMembers({
        page: Number(page),
        limit: Number(limit),
        name: name as string,
        email: email as string,
        department: department as string,
        role: role as string,
      });
      Respond(res, { members, message: 'Members fetched successfully' }, 200);
    } catch (error) {
      throw error;
    }
  }

  static async getMyMember(req: Request, res: Response) {
    const member = await MemberService.getMember(req.user?.id as string);
    Respond(res, { member, message: 'Member fetched successfully' }, 200);
  }
}
