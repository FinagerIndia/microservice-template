# Database Seeders

This directory contains database seeders for populating the KPI Central application with initial data.

## Available Seeders

### Departments Seeder

Seeds common departments that organizations typically have:

- Engineering
- Marketing
- Sales
- Human Resources
- Finance
- Product Management
- Customer Support
- Design
- Operations
- Legal
- Research & Development
- Quality Assurance

Each department includes:

- Name and slug
- Emoji logo
- Metadata with description, color, and category

## Usage

### Using npm scripts (Recommended)

```bash
# Seed all data
npm run seed

# Reset all data (clear + seed)
npm run seed:reset

# Clear all seeded data
npm run seed:clear

# Seed only departments
npm run seed:departments seed

# Reset only departments
npm run seed:departments reset

# Clear only departments
npm run seed:departments clear
```

### Using the CLI script directly

```bash
# Seed all data
npx ts-node src/scripts/seed.ts seed

# Reset all data
npx ts-node src/scripts/seed.ts reset

# Clear all data
npx ts-node src/scripts/seed.ts clear

# Department-specific commands
npx ts-node src/scripts/seed.ts departments seed
npx ts-node src/scripts/seed.ts departments reset
npx ts-node src/scripts/seed.ts departments clear
```

### Using the seeder programmatically

```typescript
import { DatabaseSeeder, departmentSeeder } from './seeders';

// Seed all data
await DatabaseSeeder.runAll();

// Reset all data
await DatabaseSeeder.runAll({ reset: true });

// Clear all data
await DatabaseSeeder.runAll({ clear: true });

// Seed only departments
await DatabaseSeeder.seedDepartments();

// Use individual seeder
await departmentSeeder.seed();
await departmentSeeder.reset();
await departmentSeeder.clear();
```

## Seeder Behavior

### Smart Seeding

- Seeders check if data already exists before inserting
- If data exists, seeding is skipped to avoid duplicates
- Use `reset` mode to clear and reseed

### Error Handling

- All seeders include comprehensive error handling
- Failed operations are logged with clear error messages
- Process exits with appropriate error codes

### Logging

- Colorful console output with emojis for easy identification
- Progress indicators and success/failure messages
- Detailed logging of what data was created

## Adding New Seeders

1. Create a new seeder file in the `seeders/` directory
2. Follow the pattern of existing seeders
3. Add the seeder to `src/seeders/index.ts`
4. Update the CLI script if needed
5. Add npm scripts to `package.json`

### Example Seeder Structure

```typescript
export class NewSeeder {
  constructor(private readonly model: typeof Model) {}

  async seed(): Promise<void> {
    // Check if data exists
    // Insert data
    // Log results
  }

  async clear(): Promise<void> {
    // Clear data
  }

  async reset(): Promise<void> {
    // Clear and reseed
  }
}
```

## Environment Setup

Make sure your environment variables are properly configured before running seeders:

```bash
# Required environment variables
MONGODB_URI=your_mongodb_connection_string
NODE_ENV=development
```

## Notes

- Seeders are designed to be idempotent (safe to run multiple times)
- Data is inserted using `insertMany` for better performance
- All operations use proper error handling and logging
- Seeders can be used in development, testing, and staging environments
