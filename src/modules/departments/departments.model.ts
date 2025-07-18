import { model, Schema } from 'mongoose';
import { z } from 'zod';

const zDepartment = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  logo: z.string().optional(),
  metadata: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
const zDepartmentCreate = zDepartment.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Department = z.infer<typeof zDepartment>;
export type DepartmentCreate = z.infer<typeof zDepartmentCreate>;

const departmentSchema = new Schema<Department>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    logo: { type: String, required: false },
    metadata: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

export const DepartmentModel = model<Department>(
  'tbl_departments',
  departmentSchema
);
