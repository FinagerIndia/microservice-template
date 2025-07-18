#!/usr/bin/env ts-node

import { DatabaseSeeder } from '../seeders';
import '../configs/env'; // Load environment variables
import connectDB from '../configs/db/mongodb';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    // Connect to database first
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected successfully!\n');
    switch (command) {
      case 'seed':
        await DatabaseSeeder.runAll();
        break;

      case 'reset':
        await DatabaseSeeder.runAll({ reset: true });
        break;

      case 'clear':
        await DatabaseSeeder.runAll({ clear: true });
        break;

      case 'departments':
        const subCommand = args[1];
        switch (subCommand) {
          case 'seed':
            await DatabaseSeeder.seedDepartments();
            break;
          case 'reset':
            await DatabaseSeeder.resetDepartments();
            break;
          case 'clear':
            await DatabaseSeeder.clearDepartments();
            break;
          default:
            console.log('❌ Invalid subcommand for departments');
            console.log('Usage: npm run seed:departments [seed|reset|clear]');
            process.exit(1);
        }
        break;

      default:
        console.log('🌱 KPI Central Database Seeder');
        console.log('');
        console.log('Usage:');
        console.log('  npm run seed                    - Seed all data');
        console.log(
          '  npm run seed:reset              - Reset all data (clear + seed)'
        );
        console.log(
          '  npm run seed:clear              - Clear all seeded data'
        );
        console.log(
          '  npm run seed:departments seed   - Seed only departments'
        );
        console.log(
          '  npm run seed:departments reset  - Reset only departments'
        );
        console.log(
          '  npm run seed:departments clear  - Clear only departments'
        );
        console.log('');
        console.log('Examples:');
        console.log('  npm run seed');
        console.log('  npm run seed:departments reset');
        process.exit(0);
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeder
main()
  .then(() => {
    console.log('\n🎉 Seeding process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
