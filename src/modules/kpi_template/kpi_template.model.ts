import { model, Schema } from 'mongoose';
import z from 'zod';

const zKpiTemplate = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  departmentId: z.string().min(1),
  role: z.string().min(1),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  template: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().min(1).optional(),
      maxMarks: z.number(),
      kpiType: z.enum([
        'quantitative',
        'percentage',
        'binary',
        'qualitative',
        'score',
      ]),
      kpiUnit: z.string().optional(),
      isDynamic: z.boolean().default(false),
      scoringRules: z.union([
        z.array(
          z.object({
            min: z.number().optional(),
            max: z.number().optional(),
            score: z.number(),
          })
        ), // Ranges
        z.array(z.object({ value: z.number(), score: z.number() })), // Exact values
        z.array(z.object({ value: z.string(), score: z.number() })), // Binary or qualitative
      ]),
    })
  ),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const zKpiTemplateCreate = zKpiTemplate.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type KpiTemplate = z.infer<typeof zKpiTemplate>;
export type KpiTemplateCreate = z.infer<typeof zKpiTemplateCreate>;

// Define sub-schema for scoring rules
const scoringRuleSchema = new Schema(
  {
    min: { type: Number, required: false },
    max: { type: Number, required: false },
    score: { type: Number, required: true },
    value: { type: Schema.Types.Mixed, required: false }, // Can be number or string
  },
  { _id: false }
);

// Define sub-schema for template items
const templateItemSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: false },
    maxMarks: { type: Number, required: true },
    kpiType: {
      type: String,
      enum: ['quantitative', 'percentage', 'binary', 'qualitative', 'score'],
      required: true,
    },
    kpiUnit: { type: String, required: false },
    isDynamic: { type: Boolean, default: false },
    scoringRules: { type: [scoringRuleSchema], required: true },
  },
  { _id: false }
);

const kpiTemplateSchema = new Schema<KpiTemplate>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: false },
    departmentId: { type: String, required: true },
    role: { type: String, required: true },
    frequency: { type: String, required: true },
    template: { type: [templateItemSchema], required: true },
  },
  {
    timestamps: true,
  }
);

export const KpiTemplateModel = model<KpiTemplate>(
  'tbl_kpi_templates',
  kpiTemplateSchema
);
