import logger from '@/configs/logger';
import { KpiTemplateCreate, KpiTemplateModel } from './kpi_template.model';

export class KpiTemplateService {
  static async createKpiTemplate(kpiTemplate: KpiTemplateCreate) {
    try {
      const newKpiTemplate = await KpiTemplateModel.create(kpiTemplate);
      return newKpiTemplate.toObject();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async getKpiTemplate(id: string) {
    try {
      const kpiTemplate = await KpiTemplateModel.findById(id).lean();
      return kpiTemplate;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async getKpiTemplates({
    page = 1,
    limit = 10,
    search = '',
  }: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    try {
      const [kpiTemplates, total] = await Promise.all([
        KpiTemplateModel.find({
          $or: [{ name: { $regex: search, $options: 'i' } }],
        })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        KpiTemplateModel.countDocuments({
          $or: [{ name: { $regex: search, $options: 'i' } }],
        }),
      ]);

      return {
        docs: kpiTemplates,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async updateKpiTemplate(id: string, kpiTemplate: KpiTemplateCreate) {
    try {
      const updatedKpiTemplate = await KpiTemplateModel.findByIdAndUpdate(
        id,
        kpiTemplate,
        {
          new: true,
        }
      );
      return updatedKpiTemplate;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  static async deleteKpiTemplate(id: string) {
    try {
      const deletedKpiTemplate = await KpiTemplateModel.findByIdAndDelete(id);
      return deletedKpiTemplate;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}
