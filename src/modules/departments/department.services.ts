import { DepartmentModel } from './departments.model';
import { DepartmentCreate } from './departments.model';

export class DepartmentService {
  constructor(private readonly departmentModel: typeof DepartmentModel) {}

  async createDepartment(department: DepartmentCreate) {
    const newDepartment = await this.departmentModel.create(department);
    return newDepartment;
  }

  async getDepartment(id: string) {
    const department = await this.departmentModel.findById(id).lean();
    return department;
  }

  async getDepartments({
    page = 1,
    limit = 10,
    search = '',
  }: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const [departments, total] = await Promise.all([
      this.departmentModel
        .find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { slug: { $regex: search, $options: 'i' } },
          ],
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.departmentModel.countDocuments({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
        ],
      }),
    ]);

    return {
      docs: departments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  async updateDepartment(id: string, department: DepartmentCreate) {
    const updatedDepartment = await this.departmentModel
      .findByIdAndUpdate(id, department, { new: true })
      .lean();
    return updatedDepartment;
  }

  async deleteDepartment(id: string) {
    const deletedDepartment = await this.departmentModel.findByIdAndDelete(id);
    return deletedDepartment;
  }
}
