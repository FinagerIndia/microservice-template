import { NextFunction, Request, Response } from 'express';
import { KpiTemplateModel } from './kpi_template.model';
import { KpiTemplateService } from './kpi_template.services';
import { KpiAuditLogService } from '../kpi_audt_logs/kpi_audit_logs.services';
import { User } from 'better-auth';
import Respond from '@/lib/respond';
import { KpiAuditLogModel } from '../kpi_audt_logs/kpi_audit_logs.model';
import logger from '@/configs/logger';

export class KpiTemplateHandler {
  static async createKpiTemplate(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      const user = request.user as User;
      const body = request.body;

      // Create a new kpi template
      const kpiTemplate = await KpiTemplateService.createKpiTemplate(body);
      KpiAuditLogService.create({
        action: 'create',
        changes: [
          {
            field: 'body',
            oldValue: null,
            newValue: body,
          },
        ],
        type: 'template',
        userId: user.id,
      });

      return Respond(
        response,
        {
          message: 'KPI template created successfully',
          data: kpiTemplate,
        },
        201
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async getKpiTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const kpiTemplate = await KpiTemplateService.getKpiTemplate(id);
      Respond(
        res,
        { kpiTemplate, message: 'KPI template fetched successfully' },
        200
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async getKpiTemplates(req: Request, res: Response) {
    try {
      const { page, limit, search } = req.query;
      const kpiTemplates = await KpiTemplateService.getKpiTemplates({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
      });
      Respond(
        res,
        { kpiTemplates, message: 'KPI templates fetched successfully' },
        200
      );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
