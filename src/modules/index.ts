import express from 'express';
import { createRouter } from '@/configs/server.config';
import kpiTemplateRouter from './kpi_template/kpi_template.router';
import requireAdmin from '@/middlewares/requireAdmin';
import kpiEntryRouter from './kpi_entry/kpi_entry.router';
import membersRouter from './members/members.route';
import filesRouter from './files/files.routes';
import requireUser from '@/middlewares/requireUser';

const router = createRouter();

router.use('/kpi-template', requireAdmin, kpiTemplateRouter);
router.use('/kpi-entry', requireAdmin, kpiEntryRouter);
router.use('/members', membersRouter);
router.use('/files', filesRouter);

export default router;
