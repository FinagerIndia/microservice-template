/* eslint-disable node/no-process-env */
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import path from 'path';
import { z } from 'zod';

expand(
  config({
    path: path.resolve(
      process.cwd(),
      process.env.NODE_ENV === 'test' ? '.env.test' : '.env'
    ),
  })
);

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3030),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('debug'),
  MONGO_INITDB_ROOT_DATABASE: z.string().default('admin'),
  MONGO_INITDB_ROOT_USERNAME: z.string().default('root'),
  MONGO_INITDB_ROOT_PASSWORD: z.string().default('root'),
  MONGO_HOST: z.string().default('localhost'),
  MONGO_PORT: z.coerce.number().default(27017),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default('root'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  BASE_URL: z.string(),
  // File compression settings
  ENABLE_FILE_COMPRESSION: z.coerce.boolean().default(true),
  COMPRESSION_QUALITY: z.coerce.number().min(0).max(100).default(85),
  COMPRESSION_THRESHOLD_SIZE: z.coerce.number().default(300000), // 300KB
  COMPRESS_IMAGE_TYPES: z.coerce.boolean().default(true),
  COMPRESS_PDF_TYPES: z.coerce.boolean().default(false),
  COMPRESS_TEXT_TYPES: z.coerce.boolean().default(true),
});

export type env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error('❌ Invalid env:');
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default env!;
