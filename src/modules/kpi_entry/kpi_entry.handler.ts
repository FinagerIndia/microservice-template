import { Request, Response } from 'express';

import { KpiEntryService } from './kpi_entry.services';
import Respond from '@/lib/respond';
import { User } from 'better-auth';
import { KpiEntry } from './kpi_entry.model';
import { FilterQuery } from 'mongoose';
import APIError from '@/lib/errors/APIError';

export class KpiEntryHandler {
  static async createKpiEntry(request: Request, response: Response) {
    try {
      const body = request.body;
      const user = request.user as User;
      const kpiEntry = await KpiEntryService.createKpiEntry(body, user.id);

      return Respond(
        response,
        {
          message: 'KPI entry created successfully',
          data: kpiEntry,
        },
        201
      );
    } catch (error) {
      throw error;
    }
  }

  static async getKpiEntries(req: Request, res: Response) {
    const { page, limit, ...filter } = req.query;
    const kpiEntry = await KpiEntryService.getKpiEntriesByFilter({
      page: Number(page),
      limit: Number(limit),
      filter: filter as FilterQuery<KpiEntry>,
    });
    Respond(
      res,
      { ...kpiEntry, message: 'KPI entry fetched successfully' },
      200
    );
  }

  static async getKpiEntriesByUser(req: Request, res: Response) {
    const { page, limit, ...filter } = req.query;
    const user = req.user as User;
    const kpiEntry = await KpiEntryService.getKpiEntriesByFilter({
      page: Number(page),
      limit: Number(limit),
      filter: {
        ...filter,
        createdBy: user.id,
      } as FilterQuery<KpiEntry>,
    });
    Respond(res, { kpiEntry, message: 'KPI entry fetched successfully' }, 200);
  }

  static async updateKpiEntry(request: Request, response: Response) {
    try {
      const { id } = request.params;
      const body = request.body;
      const user = request.user as User;
      const kpiEntry = await KpiEntryService.updateKpiEntry(id, body, user.id);

      return Respond(
        response,
        {
          message: 'KPI entry updated successfully',
          data: kpiEntry,
        },
        200
      );
    } catch (error) {
      throw error;
    }
  }

  static async generateReportByDepartment(
    request: Request,
    response: Response
  ) {
    try {
      const { department, templateId } = request.body;
      const user = request.user as User;

      if (!department || !templateId) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Missing required fields',
          MESSAGE: 'Department and templateId are required',
        });
      }

      const report = await KpiEntryService.generateReportByDepartment(
        department,
        templateId,
        user.id
      );

      return Respond(
        response,
        {
          message: 'Department report generated successfully',
          data: report,
        },
        200
      );
    } catch (error) {
      throw error;
    }
  }

  static async getKpiEntriesStatisticsByDepartmentAndRole(
    req: Request,
    res: Response
  ) {
    try {
      const { page, limit, templateId, department, role } = req.query;
      if (!templateId || !department || !role) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Bad Request',
          MESSAGE: 'Template ID, department and role are required',
        });
      }

      const kpiEntriesStatistics =
        await KpiEntryService.getKpiEntriesStatisticsByDepartmentAndRole(
          page as string,
          limit as string,
          templateId as string,
          department as string,
          role as string
        );
      Respond(
        res,
        {
          kpiEntriesStatistics,
          message: 'KPI entries statistics fetched successfully',
        },
        200
      );
    } catch (error) {
      throw error;
    }
  }
}
