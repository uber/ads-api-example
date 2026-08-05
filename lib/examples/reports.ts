/**
 * Both reporting endpoints.
 *
 * Sync (`POST /reporting/sync`) returns rows in the response body but is capped
 * at `HOURLY`/`DAILY` over a short window. Async (`POST /reporting/report` then
 * `GET /reporting/{report_id}`) queues a job and returns a CSV URL — needed for
 * long ranges, `WEEKLY`/`MONTHLY`/`SUMMARY`, and report types sync rejects.
 *
 * @see https://developer.uber.com/docs/ads/reporting-metrics/overview
 */
import { uberAds } from '@/lib/api';
import { toReportTimestamp } from '@/lib/reporting';
import type {
  CreateReportRequest,
  ReportStatusResponse,
  SyncReportRequest,
  SyncReportResponse,
} from '@/types/api';

type Filter = NonNullable<SyncReportRequest['filters']>[number];
type SyncTimeUnit = SyncReportRequest['time_unit'];
type AsyncTimeUnit = CreateReportRequest['time_unit'];

export function filterBy(
  column: string,
  values: string[],
  operator: Filter['operator'] = values.length > 1 ? 'IN' : 'EQUAL'
): Filter {
  return { column, operator, values };
}

/* -------------------------------------------------------------------------- */
/* Sync                                                                       */
/* -------------------------------------------------------------------------- */

export interface SyncReportExample {
  accountId: string;
  /** Not every report type supports sync. */
  reportType: string;
  start: Date;
  end: Date;
  columns: string[];
  timeUnit?: SyncTimeUnit;
  filters?: Filter[];
}

export async function runSyncReportExample({
  accountId,
  reportType,
  start,
  end,
  columns,
  timeUnit = 'DAILY',
  filters,
}: SyncReportExample): Promise<SyncReportResponse> {
  return uberAds.runSyncReport(accountId, {
    report_type: reportType,
    time_range: {
      start_time: toReportTimestamp(start),
      end_time: toReportTimestamp(end),
    },
    columns,
    time_unit: timeUnit,
    ...(filters?.length ? { filters } : {}),
  });
}

/**
 * Rows are positional and the API prepends a `day_of` column, so names have to
 * come from the response schema rather than the requested columns.
 */
export function toRecords(
  report: SyncReportResponse
): Array<Record<string, string>> {
  const names = (report.schema?.columns ?? []).map(
    (column, index) => column.name ?? `column_${index}`
  );

  return (report.data?.rows ?? []).map((row) =>
    Object.fromEntries(
      names.map((name, index) => [name, row.values?.[index] ?? ''])
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Async                                                                      */
/* -------------------------------------------------------------------------- */

/** The status endpoint allows one request every ten seconds. */
export const REPORT_POLL_INTERVAL_MS = 10_000;

export interface AsyncReportExample {
  accountId: string;
  reportType: string;
  start: Date;
  end: Date;
  columns: string[];
  /**
   * `WEEKLY` needs a Monday-to-Monday range and `MONTHLY` needs first-of-month
   * to first-of-next-month. `SUMMARY` collapses the range into one row.
   */
  timeUnit?: AsyncTimeUnit;
  filters?: Filter[];
  fileFormat?: string;
}

export interface CompletedReport {
  reportId: string;
  /** Expiring link to the CSV. */
  reportUrl: string;
  schema: string[];
  fileSizeBytes?: number;
  urlExpiresAt?: string;
}

export interface AsyncReportProgress {
  reportId: string;
  status: string;
  attempt: number;
}

export async function submitAsyncReport({
  accountId,
  reportType,
  start,
  end,
  columns,
  timeUnit = 'DAILY',
  filters,
  fileFormat = 'CSV',
}: AsyncReportExample): Promise<string> {
  const { report_id } = await uberAds.createReport(accountId, {
    report_type: reportType,
    time_range: {
      start_time: toReportTimestamp(start),
      end_time: toReportTimestamp(end),
    },
    columns,
    time_unit: timeUnit,
    file_format: fileFormat,
    ...(filters?.length ? { filters } : {}),
  });

  if (!report_id) {
    throw new Error(
      'The reporting API accepted the job but returned no report_id.'
    );
  }

  return report_id;
}

function readResult(response: ReportStatusResponse) {
  const result = response.result;
  if (!result) return {};

  return {
    success: 'success_result' in result ? result.success_result : undefined,
    failure: 'failure_result' in result ? result.failure_result : undefined,
  };
}

export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
  onProgress?: (progress: AsyncReportProgress) => void;
  signal?: AbortSignal;
}

export async function waitForReport(
  accountId: string,
  reportId: string,
  {
    timeoutMs = 15 * 60_000,
    intervalMs = REPORT_POLL_INTERVAL_MS,
    onProgress,
    signal,
  }: PollOptions = {}
): Promise<CompletedReport> {
  const deadline = Date.now() + timeoutMs;

  for (let attempt = 1; ; attempt += 1) {
    if (signal?.aborted) throw new Error('Report polling was cancelled.');

    const response = await uberAds.getReport(accountId, reportId);
    const status = response.status ?? 'PROCESSING';
    onProgress?.({ reportId, status, attempt });

    if (status === 'COMPLETED') {
      const { success } = readResult(response);
      if (!success?.report_url) {
        throw new Error('The report completed but returned no download URL.');
      }

      return {
        reportId,
        reportUrl: success.report_url,
        schema: success.report_schema ?? [],
        fileSizeBytes: success.file_size
          ? Number(success.file_size)
          : undefined,
        urlExpiresAt: success.url_expires_at,
      };
    }

    if (status === 'FAILED') {
      const { failure } = readResult(response);
      throw new Error(
        `Report ${reportId} failed: ${failure?.failure_reason ?? 'no reason given'}`
      );
    }

    if (Date.now() + intervalMs > deadline) {
      throw new Error(
        `Report ${reportId} was still ${status} after ${Math.round(timeoutMs / 1000)}s.`
      );
    }

    await sleep(intervalMs, signal);
  }
}

export async function runAsyncReportExample(
  example: AsyncReportExample,
  options?: PollOptions
): Promise<CompletedReport> {
  const reportId = await submitAsyncReport(example);
  return waitForReport(example.accountId, reportId, options);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new Error('Report polling was cancelled.'));
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
