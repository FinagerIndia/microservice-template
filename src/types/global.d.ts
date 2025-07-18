import { Session, User } from 'better-auth';

declare global {
  namespace Express {
    interface Request {
      session?: Session;
      user?: User & {
        role: string;
        department: string;
        departmentRole: string;
      };
    }
  }
}
export interface QueryOptions {
  page: number;
  limit: number;
  sort?: string;
}

export interface PaginatedResult<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  nextPage: boolean;
  prevPage: boolean;
}
