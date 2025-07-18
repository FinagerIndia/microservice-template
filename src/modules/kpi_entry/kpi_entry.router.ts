import { Router } from 'express';
import { KpiEntryHandler } from './kpi_entry.handler';

const router = Router();

router.post('/', KpiEntryHandler.createKpiEntry);
router.put('/:id', KpiEntryHandler.updateKpiEntry);
router.post('/generate-report', KpiEntryHandler.generateReportByDepartment);
router.get('/', KpiEntryHandler.getKpiEntries);
router.get('/user', KpiEntryHandler.getKpiEntriesByUser);
router.get(
  '/statistics',
  KpiEntryHandler.getKpiEntriesStatisticsByDepartmentAndRole
);

export default router;
