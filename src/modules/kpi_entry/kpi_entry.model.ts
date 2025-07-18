import { model, Schema } from 'mongoose';
import z from 'zod';

const zValue = z.object({
  name: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean()]),
  score: z.number(),
  comments: z.string().optional(),
  isByPassed: z.boolean().optional(),
});

const zKpiEntry = z.object({
  id: z.string().min(1),
  kpiTemplateId: z.string().min(1),
  values: z.array(zValue),
  totalScore: z.number(),
  status: z.enum(['initiated', 'generated']).default('initiated'),
  createdBy: z.string().min(1),
  createdFor: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const zKpiEntryCreate = zKpiEntry.omit({
  id: true,
  createdAt: true,
  totalScore: true,
  updatedAt: true,
  createdBy: true,
});

export type KpiEntry = z.infer<typeof zKpiEntry>;
export type KpiEntryCreate = z.infer<typeof zKpiEntryCreate>;

const valueSchema = new Schema({
  name: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  score: { type: Number, required: true },
  comments: { type: String, required: false },
  isByPassed: { type: Boolean, default: false },
});

const kpiEntrySchema = new Schema<KpiEntry>(
  {
    kpiTemplateId: { type: String, required: true },
    values: { type: [valueSchema], required: true },
    totalScore: { type: Number, required: true },
    status: {
      type: String,
      enum: ['initiated', 'generated'],
      default: 'initiated',
      required: true,
    },
    createdBy: { type: String, required: true },
    createdFor: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export const KpiEntryModel = model<KpiEntry>('tbl_kpi_entries', kpiEntrySchema);
