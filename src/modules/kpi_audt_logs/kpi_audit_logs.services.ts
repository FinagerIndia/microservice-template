import {
  KpiAuditLogModel,
  KpiAuditLog,
  KpiAuditLogCreate,
} from './kpi_audit_logs.model';

export class KpiAuditLogService {
  /**
   * Create a new audit log entry
   */
  static async create(auditLogData: KpiAuditLogCreate): Promise<KpiAuditLog> {
    const auditLog = new KpiAuditLogModel(auditLogData);
    return await auditLog.save();
  }

  /**
   * Get audit logs with pagination and filtering
   */
  static async find(
    filter: any = {},
    page: number = 1,
    limit: number = 50,
    sort: Record<string, 1 | -1> = { createdAt: -1 }
  ): Promise<{
    logs: KpiAuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      KpiAuditLogModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      KpiAuditLogModel.countDocuments(filter),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get audit logs by user ID
   */
  static async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    logs: KpiAuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return await KpiAuditLogService.find({ userId }, page, limit);
  }

  /**
   * Get audit logs by type (template or entry)
   */
  static async findByType(
    type: 'template' | 'entry',
    page: number = 1,
    limit: number = 50
  ): Promise<{
    logs: KpiAuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return await KpiAuditLogService.find({ type }, page, limit);
  }

  /**
   * Get audit logs by action (create, update, delete)
   */
  static async findByAction(
    action: 'create' | 'update' | 'delete',
    page: number = 1,
    limit: number = 50
  ): Promise<{
    logs: KpiAuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return await KpiAuditLogService.find({ action }, page, limit);
  }

  /**
   * Get audit log by ID
   */
  static async findById(id: string): Promise<KpiAuditLog | null> {
    return await KpiAuditLogModel.findById(id).lean();
  }

  /**
   * Get audit logs within a date range
   */
  static async findByDateRange(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    logs: KpiAuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const filter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    return await KpiAuditLogService.find(filter, page, limit);
  }

  /**
   * Delete audit log by ID
   */
  static async deleteById(id: string): Promise<boolean> {
    const result = await KpiAuditLogModel.findByIdAndDelete(id);
    return result !== null;
  }

  /**
   * Delete audit logs older than a specific date
   */
  static async deleteOlderThan(date: Date): Promise<number> {
    const result = await KpiAuditLogModel.deleteMany({
      createdAt: { $lt: date },
    });
    return result.deletedCount || 0;
  }

  /**
   * Get audit statistics
   */
  static async getStatistics(): Promise<{
    totalLogs: number;
    logsByType: { template: number; entry: number };
    logsByAction: { create: number; update: number; delete: number };
    recentActivity: number;
  }> {
    const [totalLogs, logsByType, logsByAction, recentActivity] =
      await Promise.all([
        KpiAuditLogModel.countDocuments(),
        KpiAuditLogModel.aggregate([
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
            },
          },
        ]),
        KpiAuditLogModel.aggregate([
          {
            $group: {
              _id: '$action',
              count: { $sum: 1 },
            },
          },
        ]),
        KpiAuditLogModel.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        }),
      ]);

    const logsByTypeResult = {
      template: logsByType.find((item) => item._id === 'template')?.count || 0,
      entry: logsByType.find((item) => item._id === 'entry')?.count || 0,
    };

    const logsByActionResult = {
      create: logsByAction.find((item) => item._id === 'create')?.count || 0,
      update: logsByAction.find((item) => item._id === 'update')?.count || 0,
      delete: logsByAction.find((item) => item._id === 'delete')?.count || 0,
    };

    return {
      totalLogs,
      logsByType: logsByTypeResult,
      logsByAction: logsByActionResult,
      recentActivity,
    };
  }

  /**
   * Helper method to create audit log for template changes
   */
  static async logTemplateChange(
    userId: string,
    action: 'create' | 'update' | 'delete',
    changes: Array<{ field: string; oldValue: string; newValue: string }>
  ): Promise<KpiAuditLog> {
    return await KpiAuditLogService.create({
      type: 'template',
      userId,
      action,
      changes,
    });
  }

  /**
   * Helper method to create audit log for entry changes
   */
  static async logEntryChange(
    userId: string,
    action: 'create' | 'update' | 'delete',
    changes: Array<{ field: string; oldValue: string; newValue: string }>
  ): Promise<KpiAuditLog> {
    return await KpiAuditLogService.create({
      type: 'entry',
      userId,
      action,
      changes,
    });
  }
}
