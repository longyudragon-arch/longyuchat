import { ApiError, handleRouteError } from "@/server/http/api-error";
import { jsonWithRequestId } from "@/server/http/api-response";
import { getDailyIssueBySlug } from "@/server/services/daily-issue-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const issue = await getDailyIssueBySlug(slug);

    if (!issue) {
      throw new ApiError(404, "The requested record was not found.", {
        reasonCode: "record_not_found",
        retryable: false,
      });
    }

    return jsonWithRequestId(request, { issue });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
