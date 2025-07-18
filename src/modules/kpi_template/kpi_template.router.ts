import { createRouter } from '@/configs/server.config';
import { KpiTemplateHandler } from './kpi_template.handler';
import { validateRequest } from '@/middlewares/zod-validate-request';
import { zKpiTemplateCreate } from './kpi_template.model';

const router = createRouter();

router.post(
  '/',
  validateRequest({ body: zKpiTemplateCreate }),
  KpiTemplateHandler.createKpiTemplate
);
router.get('/', KpiTemplateHandler.getKpiTemplates);
router.get('/:id', KpiTemplateHandler.getKpiTemplate);

export default router;
