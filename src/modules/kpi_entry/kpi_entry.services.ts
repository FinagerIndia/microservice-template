import { FilterQuery } from 'mongoose';
import { KpiEntry, KpiEntryModel } from './kpi_entry.model';
import { KpiEntryCreate } from './kpi_entry.model';
import { KpiTemplateService } from '../kpi_template/kpi_template.services';
import logger from '@/configs/logger';
import { MemberService } from '../members/members.service';
import APIError from '@/lib/errors/APIError';
import { KpiAuditLogService } from '../kpi_audt_logs/kpi_audit_logs.services';
import { db } from '@/configs/db/mongodb';

interface ScoringRule {
  min?: number;
  max?: number;
  value?: number | string;
  score: number;
}

interface TemplateItem {
  name: string;
  description?: string;
  maxMarks: number;
  kpiType: 'quantitative' | 'percentage' | 'binary' | 'qualitative' | 'score';
  kpiUnit?: string;
  isDynamic: boolean;
  scoringRules: ScoringRule[];
}

export class KpiEntryService {
  /**
   * Check if a KPI entry already exists for the given frequency period
   */
  static async checkFrequencyValidation(
    kpiTemplateId: string,
    createdFor: string,
    frequency: string,
    currentDate: Date = new Date()
  ): Promise<boolean> {
    try {
      let startDate: Date;
      let endDate: Date;

      // Calculate the start and end dates based on frequency
      switch (frequency) {
        case 'daily':
          startDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate()
          );
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          const dayOfWeek = currentDate.getDay();
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday is start of week
          startDate = new Date(
            currentDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000
          );
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
          );
          endDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0
          );
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'quarterly':
          const quarter = Math.floor(currentDate.getMonth() / 3);
          startDate = new Date(currentDate.getFullYear(), quarter * 3, 1);
          endDate = new Date(currentDate.getFullYear(), (quarter + 1) * 3, 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'yearly':
          startDate = new Date(currentDate.getFullYear(), 0, 1);
          endDate = new Date(currentDate.getFullYear(), 11, 31);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          throw new Error(`Invalid frequency: ${frequency}`);
      }

      // Check if an entry already exists for this period
      const existingEntry = await KpiEntryModel.findOne({
        kpiTemplateId,
        createdFor,
        createdAt: { $gte: startDate, $lte: endDate },
      });

      return !!existingEntry; // Returns true if entry exists (conflict), false if no conflict
    } catch (error) {
      logger.error('Error checking frequency validation:', error);
      throw error;
    }
  }

  /**
   * Calculate score based on value and scoring rules
   */
  static calculateScore(
    value: number | string | boolean,
    scoringRules: ScoringRule[],
    kpiType?: string,
    kpiName?: string
  ): number {
    logger.debug(
      `Calculating score for KPI "${kpiName}" (${kpiType}): value=${value}, rules=${JSON.stringify(scoringRules)}`
    );

    // For score type, the value IS the score (direct score entry)
    if (kpiType === 'score' && typeof value === 'number') {
      logger.debug(`Direct score entry: ${value}`);
      return value;
    }

    // For percentage type, find the highest scoring rule where value >= rule.value
    if (kpiType === 'percentage' && typeof value === 'number') {
      // Sort rules by value in descending order to find the highest applicable score
      const sortedRules = [...scoringRules]
        .filter((rule) => rule.value !== undefined)
        .sort((a, b) => (b.value as number) - (a.value as number));

      for (const rule of sortedRules) {
        if (value >= (rule.value as number)) {
          logger.debug(
            `Percentage score calculated: ${rule.score} (${value}% >= ${rule.value}%)`
          );
          return rule.score;
        }
      }

      logger.warn(
        `No percentage rule matched for KPI "${kpiName}" with value ${value}%. Available rules: ${JSON.stringify(scoringRules)}`
      );
      return 0;
    }

    // For other types, use existing rule-based logic
    for (const rule of scoringRules) {
      // For range-based rules (min/max)
      if (rule.min !== undefined && rule.max !== undefined) {
        if (
          typeof value === 'number' &&
          value >= rule.min &&
          value <= rule.max
        ) {
          logger.debug(
            `Score calculated: ${rule.score} (range: ${rule.min}-${rule.max})`
          );
          return rule.score;
        }
      }
      // For exact value rules
      else if (rule.value !== undefined && value === rule.value) {
        logger.debug(
          `Score calculated: ${rule.score} (exact match: ${rule.value})`
        );
        return rule.score;
      }
    }

    logger.warn(
      `No scoring rule matched for KPI "${kpiName}" with value ${value}. Available rules: ${JSON.stringify(scoringRules)}`
    );
    return 0; // Default score if no rule matches
  }

  /**
   * Validate that all non-dynamic KPI items are provided in the entry
   */
  static validateRequiredValues(
    values: Array<{
      name: string;
      value: number | string | boolean;
      score?: number;
      comments?: string;
      isByPassed?: boolean;
    }>,
    templateItems: TemplateItem[]
  ): void {
    const providedKpiNames = values.map((v) => v.name);
    const missingNonDynamicKpis = templateItems
      .filter(
        (item) => !item.isDynamic && !providedKpiNames.includes(item.name)
      )
      .map((item) => item.name);

    if (missingNonDynamicKpis.length > 0) {
      throw new APIError({
        STATUS: 400,
        TITLE: 'Missing required values',
        MESSAGE:
          `Missing required values for non-dynamic KPIs: ${missingNonDynamicKpis.join(', ')}. ` +
          `All KPI items with isDynamic: false must be provided in the entry.`,
      });
    }

    // Warn about dynamic KPIs that are provided (they will be updated by server later)
    const providedDynamicKpis = values.filter((value) => {
      const templateItem = templateItems.find(
        (item) => item.name === value.name
      );
      return templateItem?.isDynamic;
    });

    if (providedDynamicKpis.length > 0) {
      logger.warn(
        `Dynamic KPIs provided in entry (will be updated by server later): ${providedDynamicKpis.map((k) => k.name).join(', ')}`
      );
    }
  }

  /**
   * Validate and calculate scores for KPI values
   */
  static validateAndCalculateScores(
    values: Array<{
      name: string;
      value: number | string | boolean;
      score?: number; // Optional score field for bypassed items
      comments?: string;
      isByPassed?: boolean;
    }>,
    templateItems: TemplateItem[]
  ): Array<{
    name: string;
    value: number | string | boolean;
    score: number;
    comments?: string;
    isByPassed?: boolean;
  }> {
    // First validate that all required non-dynamic KPIs are provided
    this.validateRequiredValues(values, templateItems);

    const validatedValues = [];

    for (const value of values) {
      const templateItem = templateItems.find(
        (item) => item.name === value.name
      );

      if (!templateItem) {
        logger.warn(`Template item not found for KPI: ${value.name}`);
        continue;
      }

      let score = 0;

      // For bypassed items, use the provided score field as final score
      if (value.isByPassed) {
        if (value.score === undefined) {
          throw new APIError({
            STATUS: 400,
            TITLE: 'Missing score field',
            MESSAGE: `Bypassed KPI ${value.name} must have a score field`,
          });
        }
        score = value.score;
      } else {
        // For non-bypassed items, ignore any provided score and calculate automatically
        if (value.score !== undefined) {
          logger.warn(
            `Score field ignored for non-bypassed KPI: ${value.name}. Score will be calculated automatically.`
          );
        }

        // Validate value type
        if (
          templateItem.kpiType === 'quantitative' ||
          templateItem.kpiType === 'percentage' ||
          templateItem.kpiType === 'score'
        ) {
          if (typeof value.value !== 'number') {
            throw new APIError({
              STATUS: 400,
              TITLE: 'Invalid value type',
              MESSAGE: `KPI ${value.name} expects numeric value, got ${typeof value.value}`,
            });
          }
        } else if (templateItem.kpiType === 'binary') {
          if (typeof value.value !== 'boolean') {
            throw new APIError({
              STATUS: 400,
              TITLE: 'Invalid value type',
              MESSAGE: `KPI ${value.name} expects boolean value, got ${typeof value.value}`,
            });
          }
        }

        // Calculate score based on scoring rules
        score = this.calculateScore(
          value.value,
          templateItem.scoringRules,
          templateItem.kpiType,
          value.name
        );
      }

      validatedValues.push({
        ...value,
        score,
      });
    }

    return validatedValues;
  }

  /**
   * Create KPI entry with automatic score calculation
   */
  static async createKpiEntry(kpiEntry: KpiEntryCreate, userId: string) {
    try {
      // Get the KPI template to validate against
      const template = await KpiTemplateService.getKpiTemplate(
        kpiEntry.kpiTemplateId
      );
      const member = await MemberService.getMember(kpiEntry.createdFor);
      if (!template || !member) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'KPI template or member not found',
          MESSAGE: `KPI template or member not found: ${kpiEntry.kpiTemplateId} or ${kpiEntry.createdFor}`,
        });
      }

      if (template.role !== member.role) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Template is not for this role',
          MESSAGE: `Template is not for ${member.role}`,
        });
      }

      // Check frequency validation - prevent multiple entries per frequency period
      const hasExistingEntry = await this.checkFrequencyValidation(
        kpiEntry.kpiTemplateId,
        kpiEntry.createdFor,
        template.frequency
      );

      if (hasExistingEntry) {
        throw new APIError({
          STATUS: 409,
          TITLE: 'KPI entry already exists for this period',
          MESSAGE: `A KPI entry already exists for ${template.frequency} period. Only one entry is allowed per ${template.frequency} period.`,
        });
      }

      // Check if there's already a generated entry for this period
      const existingGeneratedEntry = await KpiEntryModel.findOne({
        kpiTemplateId: kpiEntry.kpiTemplateId,
        createdFor: kpiEntry.createdFor,
        status: 'generated',
      });

      if (existingGeneratedEntry) {
        throw new APIError({
          STATUS: 409,
          TITLE: 'Generated KPI entry exists',
          MESSAGE:
            'A generated KPI entry already exists for this period. No new entries can be created after report generation.',
        });
      }

      // Log template scoring rules for debugging
      logger.info(`Template scoring rules for debugging:`, {
        templateId: kpiEntry.kpiTemplateId,
        templateName: template.name,
        scoringRules: template.template.map((item) => ({
          name: item.name,
          kpiType: item.kpiType,
          maxMarks: item.maxMarks,
          scoringRules: item.scoringRules,
        })),
      });

      // Validate and calculate scores
      const validatedValues = this.validateAndCalculateScores(
        kpiEntry.values,
        template.template
      );

      // Calculate total score
      const totalScore = validatedValues.reduce(
        (sum, value) => sum + value.score,
        0
      );

      // Log final scores for debugging
      logger.info(`Final scores calculated:`, {
        totalScore,
        individualScores: validatedValues.map((v) => ({
          name: v.name,
          value: v.value,
          score: v.score,
          isByPassed: v.isByPassed,
        })),
      });

      // Create the entry with calculated scores
      const newKpiEntry = await KpiEntryModel.create({
        ...kpiEntry,
        values: validatedValues,
        totalScore,
        createdBy: userId,
        createdFor: kpiEntry.createdFor,
      });

      KpiAuditLogService.create({
        type: 'entry',
        userId,
        action: 'create',
        changes: [
          { field: 'values', oldValue: kpiEntry.values, newValue: newKpiEntry },
          { field: 'totalScore', oldValue: totalScore, newValue: totalScore },
        ],
      });

      return newKpiEntry;
    } catch (error) {
      logger.error('Error creating KPI entry:', error);
      throw error;
    }
  }

  /**
   * Update KPI entry with frequency validation
   */
  static async updateKpiEntry(
    entryId: string,
    updateData: Partial<KpiEntryCreate>,
    userId: string
  ) {
    try {
      // Get the existing entry
      const existingEntry = await KpiEntryModel.findById(entryId);
      if (!existingEntry) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'KPI entry not found',
          MESSAGE: 'KPI entry not found',
        });
      }

      // Check if entry is already generated - prevent updates
      if (existingEntry.status === 'generated') {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Update not allowed',
          MESSAGE:
            'Cannot update KPI entries that have been generated. The entry has been finalized and locked.',
        });
      }

      // Get the template to check frequency
      const template = await KpiTemplateService.getKpiTemplate(
        existingEntry.kpiTemplateId
      );
      if (!template) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'KPI template not found',
          MESSAGE: 'KPI template not found',
        });
      }

      // Check if the entry is within the allowed update period
      const entryDate = new Date(existingEntry.createdAt);
      const currentDate = new Date();
      let isWithinUpdatePeriod = false;

      switch (template.frequency) {
        case 'daily':
          isWithinUpdatePeriod =
            entryDate.toDateString() === currentDate.toDateString();
          break;
        case 'weekly':
          const entryWeek = this.getWeekNumber(entryDate);
          const currentWeek = this.getWeekNumber(currentDate);
          isWithinUpdatePeriod =
            entryWeek === currentWeek &&
            entryDate.getFullYear() === currentDate.getFullYear();
          break;
        case 'monthly':
          isWithinUpdatePeriod =
            entryDate.getMonth() === currentDate.getMonth() &&
            entryDate.getFullYear() === currentDate.getFullYear();
          break;
        case 'quarterly':
          const entryQuarter = Math.floor(entryDate.getMonth() / 3);
          const currentQuarter = Math.floor(currentDate.getMonth() / 3);
          isWithinUpdatePeriod =
            entryQuarter === currentQuarter &&
            entryDate.getFullYear() === currentDate.getFullYear();
          break;
        case 'yearly':
          isWithinUpdatePeriod =
            entryDate.getFullYear() === currentDate.getFullYear();
          break;
      }

      if (!isWithinUpdatePeriod) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Update not allowed',
          MESSAGE: `Updates are not allowed after the ${template.frequency} period has ended.`,
        });
      }

      // Validate and calculate scores if values are being updated
      let validatedValues = existingEntry.values;
      if (updateData.values) {
        validatedValues = this.validateAndCalculateScores(
          updateData.values,
          template.template
        );
      }

      // Calculate total score
      const totalScore = validatedValues.reduce(
        (sum, value) => sum + value.score,
        0
      );

      // Update the entry
      const updatedEntry = await KpiEntryModel.findByIdAndUpdate(
        entryId,
        {
          ...updateData,
          values: validatedValues,
          totalScore,
        },
        { new: true }
      );

      // Log the update
      KpiAuditLogService.create({
        type: 'entry',
        userId,
        action: 'update',
        changes: [
          {
            field: 'values',
            oldValue: existingEntry.values,
            newValue: validatedValues,
          },
          {
            field: 'totalScore',
            oldValue: existingEntry.totalScore,
            newValue: totalScore,
          },
        ],
      });

      return updatedEntry;
    } catch (error) {
      logger.error('Error updating KPI entry:', error);
      throw error;
    }
  }

  /**
   * Helper method to get week number
   */
  private static getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Generate comprehensive report by department for all roles
   * Updates KPI entry status to 'generated' after report generation
   */
  static async generateReportByDepartment(
    department: string,
    templateId: string,
    generatedBy: string
  ) {
    try {
      logger.info(
        `Generating department report for ${department}, template ${templateId}`
      );

      // Get the KPI template
      const template = await KpiTemplateService.getKpiTemplate(templateId);
      if (!template) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'KPI template not found',
          MESSAGE: 'KPI template not found',
        });
      }

      // Get all members in the department (all roles)
      const allMembers = await MemberService.getMembers({
        department,
        page: 1,
        limit: 1000, // Get all members
      });

      // Get all KPI entries for the template in this department
      const kpiEntries = await KpiEntryModel.find({
        kpiTemplateId: templateId,
        createdFor: { $in: allMembers.docs.map((m) => m.userId) },
        status: { $ne: 'generated' }, // Only include non-generated entries
      }).lean();

      // Group members by role
      const membersByRole = new Map();
      allMembers.docs.forEach((member) => {
        if (!membersByRole.has(member.role)) {
          membersByRole.set(member.role, []);
        }
        membersByRole.get(member.role).push(member);
      });

      // Create a map of existing entries by member ID
      const entriesMap = new Map();
      kpiEntries.forEach((entry) => {
        entriesMap.set(entry.createdFor, entry);
      });

      // Generate report for each role
      const roleReports: any[] = [];
      const entriesToUpdate: string[] = [];

      for (const [role, members] of membersByRole) {
        // Create rankings array for this role
        const rankings: {
          memberId: string;
          memberName: string;
          memberEmail: string;
          memberDepartment: string;
          memberRole: string;
          ranking: number;
          totalScore: number;
          hasEntry: boolean;
          entryId?: string;
          status: string;
        }[] = [];

        // Process all members in this role
        members.forEach((member: any) => {
          const entry = entriesMap.get(member.userId);
          const totalScore = entry ? entry.totalScore : 0;

          rankings.push({
            memberId: member.userId,
            memberName: member.user?.name || 'Unknown',
            memberEmail: member.user?.email || 'Unknown',
            memberDepartment: member.departmentSlug,
            memberRole: member.role,
            ranking: 0, // Will be calculated after sorting
            totalScore,
            hasEntry: !!entry,
            entryId: entry?._id,
            status: entry?.status || 'no-entry',
          });

          // Add entry to update list if it exists and is not already generated
          if (entry && entry.status !== 'generated') {
            entriesToUpdate.push(entry._id);
          }
        });

        // Sort by total score (highest to lowest)
        rankings.sort((a, b) => b.totalScore - a.totalScore);

        // Assign rankings (handle ties)
        let currentRank = 1;
        let currentScore = rankings[0]?.totalScore;

        rankings.forEach((ranking, index) => {
          if (ranking.totalScore !== currentScore) {
            currentRank = index + 1;
            currentScore = ranking.totalScore;
          }
          ranking.ranking = currentRank;
        });

        // Calculate statistics for this role
        const totalMembers = rankings.length;
        const membersWithEntries = rankings.filter((r) => r.hasEntry).length;
        const membersWithoutEntries = totalMembers - membersWithEntries;
        const averageScore =
          membersWithEntries > 0
            ? rankings
                .filter((r) => r.hasEntry)
                .reduce((sum, r) => sum + r.totalScore, 0) / membersWithEntries
            : 0;
        const highestScore = rankings.length > 0 ? rankings[0].totalScore : 0;
        const lowestScore =
          membersWithEntries > 0
            ? rankings.filter((r) => r.hasEntry).slice(-1)[0]?.totalScore || 0
            : 0;

        roleReports.push({
          role,
          rankings,
          statistics: {
            totalMembers,
            membersWithEntries,
            membersWithoutEntries,
            averageScore: Math.round(averageScore * 100) / 100,
            highestScore,
            lowestScore,
            completionRate: Math.round(
              (membersWithEntries / totalMembers) * 100
            ),
          },
        });
      }

      // Update all KPI entries status to 'generated'
      if (entriesToUpdate.length > 0) {
        await KpiEntryModel.updateMany(
          { _id: { $in: entriesToUpdate } },
          {
            status: 'generated',
            updatedAt: new Date(),
          }
        );

        logger.info(
          `Updated ${entriesToUpdate.length} KPI entries to 'generated' status`
        );
      }

      // Calculate department-wide statistics
      const allRankings = roleReports.flatMap((report) => report.rankings);
      const departmentTotalMembers = allRankings.length;
      const departmentMembersWithEntries = allRankings.filter(
        (r) => r.hasEntry
      ).length;
      const departmentAverageScore =
        departmentMembersWithEntries > 0
          ? allRankings
              .filter((r) => r.hasEntry)
              .reduce((sum, r) => sum + r.totalScore, 0) /
            departmentMembersWithEntries
          : 0;

      // Create department report
      const departmentReport = {
        department,
        templateId,
        templateName: template.name,
        generatedAt: new Date(),
        generatedBy,
        roleReports,
        departmentStatistics: {
          totalMembers: departmentTotalMembers,
          membersWithEntries: departmentMembersWithEntries,
          membersWithoutEntries:
            departmentTotalMembers - departmentMembersWithEntries,
          averageScore: Math.round(departmentAverageScore * 100) / 100,
          completionRate: Math.round(
            (departmentMembersWithEntries / departmentTotalMembers) * 100
          ),
          totalRoles: roleReports.length,
        },
        entriesUpdated: entriesToUpdate.length,
      };

      // Log the report generation
      KpiAuditLogService.create({
        type: 'entry',
        userId: generatedBy,
        action: 'generate_report',
        changes: [
          {
            field: 'department_report',
            oldValue: null,
            newValue: {
              department,
              templateId,
              entriesUpdated: entriesToUpdate.length,
              roles: roleReports.map((r) => r.role),
            },
          },
        ],
      });

      logger.info(`Department report generated successfully for ${department}`);
      return departmentReport;
    } catch (error) {
      logger.error('Error generating department report:', error);
      throw error;
    }
  }

  /**
   * Create system-generated KPI entry
   */
  async createSystemGeneratedEntry(
    kpiTemplateId: string,
    userId: string,
    systemValues: Array<{
      name: string;
      value: number | string | boolean;
      source: string;
    }>
  ) {
    try {
      // Get the KPI template
      const template = await KpiTemplateService.getKpiTemplate(kpiTemplateId);
      if (!template) {
        throw new Error(`KPI template not found: ${kpiTemplateId}`);
      }

      // Convert system values to entry format
      const values = systemValues.map((sv) => ({
        name: sv.name,
        value: sv.value,
        comments: `System generated from ${sv.source}`,
        isByPassed: true,
      }));

      // Validate and calculate scores
      const validatedValues = KpiEntryService.validateAndCalculateScores(
        values,
        template.template
      );

      // Calculate total score
      const totalScore = validatedValues.reduce(
        (sum, value) => sum + value.score,
        0
      );

      // Create the entry
      const newKpiEntry = await KpiEntryModel.create({
        kpiTemplateId,
        userId,
        values: validatedValues,
        totalScore,
        createdBy: 'system',
      });

      logger.info(
        `System-generated KPI entry created for user ${userId}, template ${kpiTemplateId}`
      );
      return newKpiEntry;
    } catch (error) {
      logger.error('Error creating system-generated KPI entry:', error);
      throw error;
    }
  }

  /**
   * Bulk create system-generated entries
   */
  async bulkCreateSystemEntries(
    entries: Array<{
      kpiTemplateId: string;
      userId: string;
      systemValues: Array<{
        name: string;
        value: number | string | boolean;
        source: string;
      }>;
    }>
  ) {
    try {
      const createdEntries = [];

      for (const entry of entries) {
        const createdEntry = await this.createSystemGeneratedEntry(
          entry.kpiTemplateId,
          entry.userId,
          entry.systemValues
        );
        createdEntries.push(createdEntry);
      }

      logger.info(
        `Bulk created ${createdEntries.length} system-generated KPI entries`
      );
      return createdEntries;
    } catch (error) {
      logger.error('Error in bulk creating system entries:', error);
      throw error;
    }
  }

  async getKpiEntry(id: string) {
    const kpiEntry = await KpiEntryModel.findById(id).lean();
    return kpiEntry;
  }

  async getKpiEntries(
    filter: FilterQuery<KpiEntry> = {},
    page: number = 1,
    limit: number = 10
  ) {
    const [kpiEntries, total] = await Promise.all([
      KpiEntryModel.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      KpiEntryModel.countDocuments(filter),
    ]);

    return {
      docs: kpiEntries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  async updateKpiEntry(id: string, kpiEntry: KpiEntryCreate) {
    const updatedKpiEntry = await KpiEntryModel.findByIdAndUpdate(
      id,
      kpiEntry,
      {
        new: true,
      }
    ).lean();
    return updatedKpiEntry;
  }

  async deleteKpiEntry(id: string) {
    const deletedKpiEntry = await KpiEntryModel.findByIdAndDelete(id);
    return deletedKpiEntry;
  }

  static async getKpiEntriesByFilter({
    page = 1,
    limit = 10,
    filter = {},
  }: {
    page?: number;
    limit?: number;
    filter?: FilterQuery<KpiEntry>;
  }) {
    const [kpiEntries, total] = await Promise.all([
      KpiEntryModel.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      KpiEntryModel.countDocuments(filter),
    ]);
    return {
      docs: kpiEntries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  async getKpiEntriesByUser(userId: string) {
    const kpiEntries = await KpiEntryModel.find({ createdBy: userId }).lean();
    return kpiEntries;
  }

  async getKpiEntryStatistics(filter: FilterQuery<KpiEntry> = {}) {
    const [totalEntries, totalScores] = await Promise.all([
      KpiEntryModel.countDocuments(filter),
      KpiEntryModel.aggregate([
        { $match: filter },
        { $unwind: '$values' },
        { $group: { _id: null, totalScore: { $sum: '$values.score' } } },
      ]),
    ]);

    return {
      totalEntries,
      totalScores: totalScores[0]?.totalScore || 0,
    };
  }

  static async getKpiEntriesStatisticsByDepartmentAndRole(
    page: string,
    limit: string,
    templateId: string,
    department: string,
    role: string
  ) {
    try {
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      // Get All members in the department
      const members = await MemberService.getMembers({
        department,
        role,
        page: pageNum,
        limit: limitNum,
      });
      // Get All KPI entries for the template
      const kpiEntries = await KpiEntryModel.find({
        kpiTemplateId: templateId,
        createdFor: { $in: members.docs.map((m) => m.userId) },
      }).lean();

      // Create a map of existing entries by member ID
      const entriesMap = new Map();
      kpiEntries.forEach((entry) => {
        entriesMap.set(entry.createdFor, entry);
      });

      // Create rankings array with all members
      const rankings: {
        memberId: string;
        memberName: string;
        memberEmail: string;
        memberDepartment: string;
        memberRole: string;
        ranking: number;
        totalScore: number;
        hasEntry: boolean;
        entryId?: string;
        status: string;
      }[] = [];

      // Process all members
      members.docs.forEach((member, index) => {
        const entry = entriesMap.get(member.userId);
        const totalScore = entry ? entry.totalScore : 0;

        rankings.push({
          memberId: member.userId,
          memberName: member.user?.name || 'Unknown',
          memberEmail: member.user?.email || 'Unknown',
          memberDepartment: member.departmentSlug,
          memberRole: member.role,
          ranking: 0, // Will be calculated after sorting
          totalScore,
          hasEntry: !!entry,
          entryId: entry?._id,
          status: entry?.status || 'no-entry',
        });
      });

      // Sort by total score (highest to lowest)
      rankings.sort((a, b) => b.totalScore - a.totalScore);

      // Assign rankings (handle ties)
      let currentRank = 1;
      let currentScore = rankings[0]?.totalScore;

      rankings.forEach((ranking, index) => {
        if (ranking.totalScore !== currentScore) {
          currentRank = index + 1;
          currentScore = ranking.totalScore;
        }
        ranking.ranking = currentRank;
      });

      // Calculate statistics
      const totalMembers = rankings.length;
      const membersWithEntries = rankings.filter((r) => r.hasEntry).length;
      const membersWithoutEntries = totalMembers - membersWithEntries;
      const averageScore =
        membersWithEntries > 0
          ? rankings
              .filter((r) => r.hasEntry)
              .reduce((sum, r) => sum + r.totalScore, 0) / membersWithEntries
          : 0;
      const highestScore = rankings.length > 0 ? rankings[0].totalScore : 0;
      const lowestScore =
        membersWithEntries > 0
          ? rankings.filter((r) => r.hasEntry).slice(-1)[0]?.totalScore || 0
          : 0;

      return {
        rankings,
        statistics: {
          totalMembers,
          membersWithEntries,
          membersWithoutEntries,
          averageScore: Math.round(averageScore * 100) / 100,
          highestScore,
          lowestScore,
          completionRate: Math.round((membersWithEntries / totalMembers) * 100),
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalMembers,
          totalPages: Math.ceil(totalMembers / limitNum),
          hasNextPage: pageNum < Math.ceil(totalMembers / limitNum),
          hasPreviousPage: pageNum > 1,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getKpiEntryScores(filter: FilterQuery<KpiEntry> = {}) {
    const scores = await KpiEntryModel.aggregate([
      { $match: filter },
      { $unwind: '$values' },
      {
        $group: { _id: '$values.name', totalScore: { $sum: '$values.score' } },
      },
    ]);
    return scores;
  }

  async getKpiEntryScoresByUser(userId: string) {
    const scores = await KpiEntryModel.aggregate([
      { $match: { userId } },
      { $unwind: '$values' },
      {
        $group: { _id: '$values.name', totalScore: { $sum: '$values.score' } },
      },
    ]);
    return scores;
  }

  async getKpiEntryScoresByTemplate(templateId: string) {
    const scores = await KpiEntryModel.aggregate([
      { $match: { kpiTemplateId: templateId } },
      { $unwind: '$values' },
      {
        $group: { _id: '$values.name', totalScore: { $sum: '$values.score' } },
      },
    ]);
    return scores;
  }

  async getKpiEntryScoresByUserAndTemplate(userId: string, templateId: string) {
    const scores = await KpiEntryModel.aggregate([
      { $match: { userId, kpiTemplateId: templateId } },
      { $unwind: '$values' },
      {
        $group: { _id: '$values.name', totalScore: { $sum: '$values.score' } },
      },
    ]);
    return scores;
  }

  async getKpiEntryScoresByUserAndTemplateAndYear(
    userId: string,
    templateId: string,
    year: number
  ) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const scores = await KpiEntryModel.aggregate([
      {
        $match: {
          userId,
          kpiTemplateId: templateId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: '$values' },
      {
        $group: { _id: '$values.name', totalScore: { $sum: '$values.score' } },
      },
    ]);
    return scores;
  }

  async getKpiEntryScoresByUserAndTemplateAndYearAndMonth(
    userId: string,
    templateId: string,
    year: number,
    month: number
  ) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const scores = await KpiEntryModel.aggregate([
      {
        $match: {
          userId,
          kpiTemplateId: templateId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: '$values' },
      {
        $group: { _id: '$values.name', totalScore: { $sum: '$values.score' } },
      },
    ]);
    return scores;
  }

  async getKpiEntryScoresByUserAndTemplateAndYearAndMonthAndDay(
    userId: string,
    templateId: string,
    year: number,
    month: number,
    day: number
  ) {
    const startDate = new Date(year, month - 1, day);
    const endDate = new Date(year, month - 1, day + 1);
    const scores = await KpiEntryModel.aggregate([
      {
        $match: {
          userId,
          kpiTemplateId: templateId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: '$values' },
      {
        $group: { _id: '$values.name', totalScore: { $sum: '$values.score' } },
      },
    ]);
    return scores;
  }
}
