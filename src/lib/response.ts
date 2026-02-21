export type SuccessResponse<T> = {
  success: true;
  data: T;
};

export type ErrorResponse = {
  success: false;
  error: string;
  message: string;
};

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
};

export function successResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

export function errorResponse(error: string, message: string): ErrorResponse {
  return {
    success: false,
    error,
    message,
  };
}

export function paginatedResponse<T>(
  data: T[],
  nextCursor: string | null,
  hasMore: boolean
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
    },
  };
}
