import { MemberCreate, MemberModel } from './members.model';
import { db } from '@/configs/db/mongodb';
import { ObjectId } from 'mongodb';
import { KpiEntryModel } from '../kpi_entry/kpi_entry.model';
import logger from '@/configs/logger';

export class MemberService {
  static async createMember(member: MemberCreate) {
    const newMember = await MemberModel.create(member);
    return newMember;
  }

  static async getMember(id: string) {
    const member = await MemberModel.findOne({ userId: id }).lean();
    const user = await db.collection('user').findOne({ _id: new ObjectId(id) });

    return {
      ...member,
      user,
    };
  }

  static async getMembers({
    page = 1,
    limit = 10,
    name,
    email,
    department,
    role,
  }: {
    page?: number | string;
    limit?: number | string;
    name?: string;
    email?: string;
    department?: string;
    role?: string;
  }) {
    try {
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build user query conditions (only if name or email is provided)
      const userConditions = [];
      if (name && name.trim()) {
        userConditions.push({ name: { $regex: name.trim(), $options: 'i' } });
      }
      if (email && email.trim()) {
        userConditions.push({ email: { $regex: email.trim(), $options: 'i' } });
      }

      // Get user IDs if we're searching by name or email
      let userIds: string[] = [];
      if (userConditions.length > 0) {
        const users = await db
          .collection('user')
          .find({
            $or: userConditions,
          })
          .toArray();
        userIds = users.map((user) => user._id.toString());

        // If searching by name/email but no users found, return empty results
        if (userIds.length === 0) {
          return {
            docs: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          };
        }
      }

      // Build member query conditions
      const memberConditions = [];

      // Add user ID condition if we found matching users
      if (userIds.length > 0) {
        memberConditions.push({ userId: { $in: userIds } });
      }

      // Add department condition if provided
      if (department && department.trim()) {
        memberConditions.push({
          departmentSlug: department.trim(),
        });
      }

      // Add role condition if provided
      if (role && role.trim()) {
        memberConditions.push({ role: role.trim() });
      }

      // Build the final query
      let query = {};

      if (memberConditions.length > 0) {
        // If we have user ID conditions, we need to handle them separately
        const userConditions = memberConditions.filter(
          (condition) => condition.userId
        );
        const otherConditions = memberConditions.filter(
          (condition) => !condition.userId
        );

        if (userConditions.length > 0 && otherConditions.length > 0) {
          // We have both user conditions and other conditions
          query = {
            $and: [{ $or: userConditions }, { $and: otherConditions }],
          };
        } else if (userConditions.length > 0) {
          // Only user conditions
          query = { $or: userConditions };
        } else if (otherConditions.length > 0) {
          // Only other conditions (department/role) - use $and to require both
          query = { $and: otherConditions };
        }
      }

      logger.debug(`Query: ${JSON.stringify(query)}`);

      const [members, total] = await Promise.all([
        MemberModel.find(query).skip(skip).limit(limitNum).lean(),
        MemberModel.countDocuments(query),
      ]);

      // Get user details for the found members
      const memberUserIds = members.map((member) => member.userId);
      const users = await db
        .collection('user')
        .find({
          _id: { $in: memberUserIds.map((id) => new ObjectId(id)) },
        })
        .toArray();
      const userMap = new Map(users.map((user) => [user._id.toString(), user]));

      // Check if the user's kpi entries are filled for this month
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const kpiEntries = await KpiEntryModel.find({
        createdFor: { $in: memberUserIds },
        createdAt: {
          $gte: new Date(currentYear, currentMonth, 1),
          $lte: new Date(currentYear, currentMonth + 1, 0),
        },
      });

      const kpiEntriesMap = new Map(
        kpiEntries.map((kpiEntry) => [kpiEntry.createdFor.toString(), kpiEntry])
      );

      const docs = members.map((member) => ({
        ...member,
        user: userMap.get(member.userId.toString()),
        isKpiEntryFilledForCurrentMonth: kpiEntriesMap.has(
          member.userId.toString()
        ),
      }));

      return {
        docs,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPreviousPage: pageNum > 1,
      };
    } catch (error) {
      throw error;
    }
  }

  static async updateMember(id: string, member: MemberCreate) {
    const updatedMember = await MemberModel.findByIdAndUpdate(id, member, {
      new: true,
    }).lean();
    return updatedMember;
  }

  static async deleteMember(id: string) {
    const deletedMember = await MemberModel.findByIdAndDelete(id);
    return deletedMember;
  }
}
