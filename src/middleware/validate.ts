import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject, ZodEffects } from 'zod';

export const validateBody = (schema: AnyZodObject | ZodEffects<AnyZodObject>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
};

export const validateQuery = (schema: AnyZodObject | ZodEffects<AnyZodObject>) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query);
    next();
  };
};
