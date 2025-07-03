import { Response } from 'express';
import { format } from 'date-fns';

export default function Respond(
  res: Response,
  data = {},
  status: number,
  cache: boolean = false
) {
  const timestamp = new Date();

  return res.status(status).json({
    ...data,
    success: true,
    status,
    timestamp: format(timestamp, 'PPP p'),
    cache,
  });
}