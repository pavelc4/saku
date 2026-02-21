import { describe, expect, test } from "bun:test";
import { errorResponse, paginatedResponse, successResponse } from "../../src/lib/response";

describe("Standard Response Format", () => {
  test("successResponse format", () => {
    const data = { id: 1, name: "Test" };
    const res = successResponse(data);
    expect(res).toEqual({
      success: true,
      data: { id: 1, name: "Test" }
    });
  });

  test("errorResponse format", () => {
    const res = errorResponse("NOT_FOUND", "Resource missing");
    expect(res).toEqual({
      success: false,
      error: "NOT_FOUND",
      message: "Resource missing"
    });
  });

  test("paginatedResponse format", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const res = paginatedResponse(data, "cursor123", true);
    expect(res).toEqual({
      success: true,
      data: [{ id: 1 }, { id: 2 }],
      pagination: {
        next_cursor: "cursor123",
        has_more: true
      }
    });
  });
});
