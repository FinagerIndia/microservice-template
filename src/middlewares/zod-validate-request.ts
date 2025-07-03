import APIError from '@/lib/errors/APIError';
import { AUTHORIZATION_ERRORS } from '@/lib/errors/AUTHORIZATION_ERRORS';
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validateRequest = ({ body, query, params }: { body?: AnyZodObject, query?: AnyZodObject, params?: AnyZodObject }) => {
  return async (req: Request, _: Response, next: NextFunction) => {
    try {
      await Promise.all([
        body && body.parseAsync(req.body),
        query && query.parseAsync(req.query),
        params && params.parseAsync(req.params),
      ]);
    next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new APIError({
          ...AUTHORIZATION_ERRORS.VALIDATION_ERROR,
          ERRORS: error.errors,
        });
      }
      throw error;
    }
  };
};