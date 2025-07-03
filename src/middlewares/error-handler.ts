import logger from '@/configs/logger';
import APIError from '@/lib/errors/APIError';
import Respond from '@/lib/respond';
import { NextFunction, Request, Response } from 'express';

export function errorHandler(
  error: Error,
  _: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof APIError) {
    Respond(res, error.serializeError(), error.statusCode);
    return;
  }

  logger.error(error?.message);
  Respond(
    res,
    {
      success: false,
      status: 'error',
      title: 'Internal Server Error',
      message: error?.message,
    },
    500
  );
}