import { departmentSeeder } from './departments.seeder';

export interface SeederOptions {
  clear?: boolean;
  reset?: boolean;
  departments?: boolean;
}

export class DatabaseSeeder {
  /**
   * Run all seeders
   */
  static async runAll(options: SeederOptions = {}): Promise<void> {
    console.log('🚀 Starting database seeding...\n');

    try {
      if (options.reset) {
        console.log('🔄 Reset mode: Clearing and reseeding all data...\n');
        await this.resetAll();
        return;
      }

      if (options.clear) {
        console.log('🗑️  Clear mode: Removing all seeded data...\n');
        await this.clearAll();
        return;
      }

      // Seed departments
      if (options.departments !== false) {
        await departmentSeeder.seed();
        console.log('');
      }

      console.log('✅ Database seeding completed successfully!');
    } catch (error) {
      console.error('❌ Database seeding failed:', error);
      throw error;
    }
  }

  /**
   * Clear all seeded data
   */
  static async clearAll(): Promise<void> {
    console.log('🗑️  Clearing all seeded data...\n');

    try {
      await departmentSeeder.clear();
      console.log('✅ All seeded data cleared successfully!');
    } catch (error) {
      console.error('❌ Error clearing seeded data:', error);
      throw error;
    }
  }

  /**
   * Reset all data (clear and reseed)
   */
  static async resetAll(): Promise<void> {
    console.log('🔄 Resetting all data...\n');

    try {
      await departmentSeeder.reset();
      console.log('✅ All data reset successfully!');
    } catch (error) {
      console.error('❌ Error resetting data:', error);
      throw error;
    }
  }

  /**
   * Seed only departments
   */
  static async seedDepartments(): Promise<void> {
    console.log('🌱 Seeding departments...\n');
    await departmentSeeder.seed();
    console.log('✅ Departments seeding completed!');
  }

  /**
   * Clear only departments
   */
  static async clearDepartments(): Promise<void> {
    console.log('🗑️  Clearing departments...\n');
    await departmentSeeder.clear();
    console.log('✅ Departments cleared!');
  }

  /**
   * Reset only departments
   */
  static async resetDepartments(): Promise<void> {
    console.log('🔄 Resetting departments...\n');
    await departmentSeeder.reset();
    console.log('✅ Departments reset!');
  }
}

// Export individual seeders for specific use cases
export { departmentSeeder } from './departments.seeder';
export { DatabaseSeeder as default };
