import {
  DepartmentModel,
  DepartmentCreate,
} from '../modules/departments/departments.model';

const departmentsData: DepartmentCreate[] = [
  {
    name: 'Revenue Department',
    slug: 'revenue-department',
    logo: '💰',
    metadata: JSON.stringify({
      description: 'Revenue collection and financial management',
      color: '#10B981',
      category: 'Finance',
    }),
  },
  {
    name: 'Collector Office',
    slug: 'collector-office',
    logo: '📋',
    metadata: JSON.stringify({
      description: 'Administrative services',
      color: '#3B82F6',
      category: 'Administration',
    }),
  },
];

export class DepartmentSeeder {
  constructor(private readonly departmentModel: typeof DepartmentModel) {}

  /**
   * Seed departments data
   */
  async seed(): Promise<void> {
    try {
      console.log('🌱 Starting department seeding...');

      // Check if departments already exist
      const existingCount = await this.departmentModel.countDocuments();
      if (existingCount > 0) {
        console.log(
          `⚠️  ${existingCount} departments already exist. Skipping seeding.`
        );
        return;
      }

      // Insert departments
      const result = await this.departmentModel.insertMany(departmentsData);
      console.log(`✅ Successfully seeded ${result.length} departments`);

      // Log created departments
      result.forEach((dept) => {
        console.log(`  - ${dept.name} (${dept.slug})`);
      });
    } catch (error) {
      console.error('❌ Error seeding departments:', error);
      throw error;
    }
  }

  /**
   * Clear all departments data
   */
  async clear(): Promise<void> {
    try {
      console.log('🗑️  Clearing departments...');
      const result = await this.departmentModel.deleteMany({});
      console.log(`✅ Cleared ${result.deletedCount} departments`);
    } catch (error) {
      console.error('❌ Error clearing departments:', error);
      throw error;
    }
  }

  /**
   * Reset departments (clear and reseed)
   */
  async reset(): Promise<void> {
    try {
      console.log('🔄 Resetting departments...');
      await this.clear();
      await this.seed();
      console.log('✅ Departments reset completed');
    } catch (error) {
      console.error('❌ Error resetting departments:', error);
      throw error;
    }
  }

  /**
   * Get sample department data for testing
   */
  getSampleData(): DepartmentCreate[] {
    return departmentsData;
  }
}

// Export a default instance for easy use
export const departmentSeeder = new DepartmentSeeder(DepartmentModel);
