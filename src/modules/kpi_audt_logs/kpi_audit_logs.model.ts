import { model, Schema } from 'mongoose';
import z from 'zod';

const zKpiAuditLog = z.object({
  id: z.string().min(1),
  type: z.enum(['template', 'entry']),
  userId: z.string(),
  action: z.enum(['create', 'update', 'delete', 'generate_report']),
  changes: z.array(
    z.object({
      field: z.string(),
      oldValue: z.any(),
      newValue: z.any(),
    })
  ),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const zKpiAuditLogCreate = zKpiAuditLog.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type KpiAuditLog = z.infer<typeof zKpiAuditLog>;
export type KpiAuditLogCreate = z.infer<typeof zKpiAuditLogCreate>;

const changeSchema = new Schema({
  field: { type: String, required: true },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed, required: true },
});

const kpiAuditLogSchema = new Schema<KpiAuditLog>(
  {
    type: { type: String, required: true },
    userId: { type: String, required: true },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'generate_report'],
      required: true,
    },
    changes: { type: [changeSchema], required: true },
  },
  {
    timestamps: true,
  }
);

export const KpiAuditLogModel = model<KpiAuditLog>(
  'tbl_kpi_audit_logs',
  kpiAuditLogSchema
);
