import logger from '@/configs/logger';
import APIError from '@/lib/errors/APIError';
import { AUTHORIZATION_ERRORS } from '@/lib/errors/AUTHORIZATION_ERRORS';
import { Request, Response, NextFunction } from 'express';

const requireAdmin = (req: Request, _: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new APIError(AUTHORIZATION_ERRORS.AUTHORIZATION_ERROR);
  }
  next();
};

export default requireAdmin;
