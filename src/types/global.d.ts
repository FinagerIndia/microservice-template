declare global {
  namespace Express {
    interface Request {
      session?: any;
      user?: any;
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
