import express from 'express';
import connectDB from '@/configs/db/mongodb';
import logger from '@/configs/logger';
import env from '@/configs/env';
import createApp from '@/configs/server.config';

const app = createApp();

connectDB()
  .then(() => {
    logger.info('Running Status : Database connected');
  })
  .catch((err) => {
    logger.error('Database Connection Failed', err);
    process.exit();
  });

const server = app.listen(env.PORT, () => {
  logger.info(
    `Running Status : Server started on port http://localhost:${env.PORT}`
  );
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', err);
  server.close(() => process.exit(1));
});
