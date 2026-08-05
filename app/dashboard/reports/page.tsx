'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ErrorState from '@/components/ui/ErrorState';
import type { ReportColumnDefinition, SyncReportResponse } from '@/types/api';
import {
  ASYNC_TIME_UNITS,
  FILTER_OPERATORS,
  HOURLY_SAFE_METRICS,
  REPORT_TYPES,
  SYNC_MAX_RANGE_DAYS,
  SYNC_TIME_UNITS,
  daysAgo,
} from '@/lib/reporting';
import {
  ASYNC_REPORTING_SCOPE,
  SYNC_REPORTING_SCOPE,
} from '@/lib/uber/scopes';
import {
  filterBy,
  runSyncReportExample,
  submitAsyncReport,
  waitForReport,
  type AsyncReportProgress,
  type CompletedReport,
} from '@/lib/examples/reports';
import { uberAds } from '@/lib/api';
import type { Campaign } from '@/types/api';

type Mode = 'sync' | 'async';
type FilterOperator = (typeof FILTER_OPERATORS)[number];

interface FilterRow {
  id: number;
  column: string;
  operator: FilterOperator;
  /** Comma-separated; `IN` takes several, the others take one. */
  values: string;
}
type SyncTimeUnit = (typeof SYNC_TIME_UNITS)[number];
type AsyncTimeUnit = (typeof ASYNC_TIME_UNITS)[number];
type TimeUnit = SyncTimeUnit | AsyncTimeUnit;

const SYNC_REPORT_TYPES = REPORT_TYPES.filter((type) => type.supportsSync);

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Filter values are stored as one comma-separated string. */
function splitValues(values: string): string[] {
  return values
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isNumericColumn(column: ReportColumnDefinition): boolean {
  return (
    column.type === 'COLUMN_TYPE_INT64' || column.type === 'COLUMN_TYPE_DOUBLE'
  );
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`;
}

/** WEEKLY and MONTHLY rollups only accept aligned date ranges. */
function alignmentError(
  timeUnit: TimeUnit,
  start: Date,
  end: Date
): string | null {
  if (timeUnit === 'WEEKLY') {
    return start.getUTCDay() === 1 && end.getUTCDay() === 1
      ? null
      : 'WEEKLY reports must start on a Monday and end on a Monday.';
  }
  if (timeUnit === 'MONTHLY') {
    return start.getUTCDate() === 1 && end.getUTCDate() === 1
      ? null
      : 'MONTHLY reports must run from the first of a month to the first of the next.';
  }
  return null;
}

export default function ReportsPage() {
  const { selectedAdAccount, hasScope, grantedScopes } = useAuth();

  const [mode, setMode] = useState<Mode>('sync');

  // Sync and async reporting are gated behind different scopes.
  const requiredScope =
    mode === 'sync' ? SYNC_REPORTING_SCOPE : ASYNC_REPORTING_SCOPE;
  const canReport = hasScope(requiredScope);

  const [reportTypeId, setReportTypeId] = useState(SYNC_REPORT_TYPES[0].id);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('DAILY');
  const [startDate, setStartDate] = useState(toDateInput(daysAgo(7)));
  const [endDate, setEndDate] = useState(toDateInput(new Date()));
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'campaign_id',
    'impressions',
    'clicks',
    'ad_spend',
  ]);

  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const [report, setReport] = useState<SyncReportResponse | null>(null);
  const [completedReport, setCompletedReport] =
    useState<CompletedReport | null>(null);
  const [progress, setProgress] = useState<AsyncReportProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Filter values are raw IDs, so offer the account's campaigns by name rather
  // than making people paste UUIDs.
  const accountId = selectedAdAccount?.ad_account_id;
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    // One page only: these are autocomplete hints, not a source of truth, and
    // paging a large account would cost many requests for no real benefit.
    uberAds
      .getCampaigns(accountId, { pageLimit: 200 })
      .then((response) => {
        if (!cancelled) setCampaigns(response.campaigns ?? []);
      })
      .catch(() => {
        // A failed lookup only costs the suggestions, so ignore it.
      });

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const availableReportTypes = mode === 'sync' ? SYNC_REPORT_TYPES : REPORT_TYPES;
  const availableTimeUnits = mode === 'sync' ? SYNC_TIME_UNITS : ASYNC_TIME_UNITS;

  const reportType = useMemo(
    () =>
      availableReportTypes.find((type) => type.id === reportTypeId) ??
      availableReportTypes[0],
    [availableReportTypes, reportTypeId]
  );

  // At HOURLY granularity the API only serves a subset of metrics.
  const availableColumns = useMemo(() => {
    const metrics =
      timeUnit === 'HOURLY'
        ? reportType.metrics.filter((metric) =>
            HOURLY_SAFE_METRICS.includes(metric)
          )
        : reportType.metrics;
    return [...reportType.dimensions, ...metrics];
  }, [reportType, timeUnit]);

  // Filtering applies to dimensions, not metrics.
  const filterableColumns = reportType.dimensions;

  // Report types expose different dimensions, so drop rows that no longer
  // reference a real column after a switch.
  useEffect(() => {
    setFilters((current) => {
      const kept = current.filter((row) =>
        filterableColumns.includes(row.column)
      );
      return kept.length === current.length ? current : kept;
    });
  }, [filterableColumns]);

  const activeFilters = useMemo(
    () =>
      filters
        .map((row) => ({ row, values: splitValues(row.values) }))
        .filter(({ values }) => values.length > 0)
        .map(({ row, values }) => filterBy(row.column, values, row.operator)),
    [filters]
  );

  const start = new Date(startDate);
  const end = new Date(endDate);
  const rangeDays = Math.round(
    (end.getTime() - start.getTime()) / 86_400_000
  );
  const maxRangeDays =
    mode === 'sync'
      ? SYNC_MAX_RANGE_DAYS[timeUnit as SyncTimeUnit]
      : Infinity;

  const validationError = !canReport
    ? `This Uber token was not granted the ${requiredScope} scope.`
    : !selectedAdAccount
      ? 'Select an ad account first.'
      : selectedColumns.length === 0
        ? 'Select at least one column.'
        : rangeDays < 0
          ? 'End date must be on or after the start date.'
          : rangeDays > maxRangeDays
            ? `Sync reports allow at most ${maxRangeDays} day(s) at ${timeUnit} granularity.`
            : alignmentError(timeUnit, start, end);

  const switchMode = (next: Mode) => {
    setMode(next);
    setReport(null);
    setCompletedReport(null);
    setProgress(null);
    setError(null);

    const types = next === 'sync' ? SYNC_REPORT_TYPES : REPORT_TYPES;
    if (!types.some((type) => type.id === reportTypeId)) {
      setReportTypeId(types[0].id);
    }
    const units = next === 'sync' ? SYNC_TIME_UNITS : ASYNC_TIME_UNITS;
    if (!units.includes(timeUnit as never)) setTimeUnit('DAILY');
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column]
    );
  };

  const addFilter = () =>
    setFilters((current) => [
      ...current,
      {
        id: Date.now(),
        column: filterableColumns[0] ?? 'campaign_id',
        operator: 'EQUAL',
        values: '',
      },
    ]);

  const updateFilter = (id: number, patch: Partial<FilterRow>) =>
    setFilters((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );

  const removeFilter = (id: number) =>
    setFilters((current) => current.filter((row) => row.id !== id));

  const runReport = async () => {
    if (!accountId || validationError) return;

    const columns = selectedColumns.filter((column) =>
      availableColumns.includes(column)
    );

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setError(null);
    setReport(null);
    setCompletedReport(null);
    setProgress(null);

    try {
      if (mode === 'sync') {
        setReport(
          await runSyncReportExample({
            accountId,
            reportType: reportTypeId,
            start,
            end,
            columns,
            timeUnit: timeUnit as SyncTimeUnit,
            filters: activeFilters,
          })
        );
      } else {
        const reportId = await submitAsyncReport({
          accountId,
          reportType: reportTypeId,
          start,
          end,
          columns,
          timeUnit: timeUnit as AsyncTimeUnit,
          filters: activeFilters,
        });
        setProgress({ reportId, status: 'PROCESSING', attempt: 0 });
        setCompletedReport(
          await waitForReport(accountId, reportId, {
            onProgress: setProgress,
            signal: controller.signal,
          })
        );
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          cause instanceof Error ? cause.message : 'Failed to run the report.'
        );
      }
    } finally {
      if (!controller.signal.aborted) setIsRunning(false);
    }
  };

  const cancelReport = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
    setProgress(null);
  };

  const columns = report?.schema?.columns ?? [];
  const rows = report?.data?.rows ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="mt-1 text-sm text-gray-500 font-mono">
            {mode === 'sync'
              ? 'POST /v1/ads/{account_id}/reporting/sync'
              : 'POST /v1/ads/{account_id}/reporting/report → GET /reporting/{report_id}'}
          </p>
        </div>

        {!canReport && (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-medium">
              {mode === 'sync' ? 'Sync' : 'Async'} reporting is not available on
              this token
            </p>
            <p className="mt-1">
              Uber granted this session{' '}
              <code className="text-xs">
                {grantedScopes.join(', ') || 'no scopes'}
              </code>
              , which does not include{' '}
              <code className="text-xs">{requiredScope}</code>. Enable it on your
              app at developer.uber.com, then sign out and back in to receive a
              new token.
            </p>
            <p className="mt-1">
              Sync and async reporting use different scopes:{' '}
              <code className="text-xs">{SYNC_REPORTING_SCOPE}</code> and{' '}
              <code className="text-xs">{ASYNC_REPORTING_SCOPE}</code>{' '}
              respectively.
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
          <div className="flex gap-2" role="tablist">
            {(
              [
                ['sync', 'Sync', 'Rows in the response'],
                ['async', 'Async', 'Queued job, CSV download'],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                disabled={isRunning}
                className={`flex-1 rounded-md border px-4 py-3 text-left transition-colors disabled:opacity-40 ${
                  mode === value
                    ? 'border-black bg-black text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <span className="block text-sm font-medium">{label}</span>
                <span
                  className={`block text-xs ${
                    mode === value ? 'text-gray-300' : 'text-gray-500'
                  }`}
                >
                  {hint}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Report type
              </span>
              <select
                value={reportTypeId}
                onChange={(event) => {
                  setReportTypeId(event.target.value);
                  setReport(null);
                  setCompletedReport(null);
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {availableReportTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Granularity
              </span>
              <select
                value={timeUnit}
                onChange={(event) => setTimeUnit(event.target.value as TimeUnit)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {availableTimeUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Start date
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                End date
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-gray-700">
              Columns
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableColumns.map((column) => {
                const selected = selectedColumns.includes(column);
                return (
                  <button
                    key={column}
                    type="button"
                    onClick={() => toggleColumn(column)}
                    aria-pressed={selected}
                    className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                      selected
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {column}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <div className="flex items-center justify-between">
              <legend className="text-sm font-medium text-gray-700">
                Filters
              </legend>
              <button
                type="button"
                onClick={addFilter}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Add filter
              </button>
            </div>

            {filters.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                No filters — the report covers the whole ad account.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {filters.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center gap-2">
                    <select
                      value={row.column}
                      onChange={(event) =>
                        updateFilter(row.id, { column: event.target.value })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm font-mono"
                    >
                      {filterableColumns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>

                    <select
                      value={row.operator}
                      onChange={(event) =>
                        updateFilter(row.id, {
                          operator: event.target.value as FilterOperator,
                        })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {FILTER_OPERATORS.map((operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ))}
                    </select>

                    {/* Campaigns are pickable by name; every other dimension
                        is a raw ID the API gives no lookup for. */}
                    {row.column === 'campaign_id' && campaigns.length > 0 ? (
                      <select
                        multiple={row.operator === 'IN'}
                        value={
                          row.operator === 'IN'
                            ? splitValues(row.values)
                            : (splitValues(row.values)[0] ?? '')
                        }
                        onChange={(event) =>
                          updateFilter(row.id, {
                            values:
                              row.operator === 'IN'
                                ? Array.from(event.target.selectedOptions)
                                    .map((option) => option.value)
                                    .join(', ')
                                : event.target.value,
                          })
                        }
                        className="flex-1 min-w-56 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        {row.operator !== 'IN' && (
                          <option value="">Select a campaign…</option>
                        )}
                        {campaigns.map((campaign) => (
                          <option
                            key={campaign.campaign_id}
                            value={campaign.campaign_id}
                          >
                            {campaign.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={row.values}
                        onChange={(event) =>
                          updateFilter(row.id, { values: event.target.value })
                        }
                        placeholder={
                          row.operator === 'IN' ? 'id-1, id-2, id-3' : 'value'
                        }
                        className="flex-1 min-w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => removeFilter(row.id)}
                      aria-label="Remove filter"
                      className="px-2 py-1 text-sm text-gray-400 hover:text-gray-900"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <p className="text-sm text-gray-500">
                  <code className="text-xs">IN</code> takes several values
                  (ctrl- or cmd-click to select more than one campaign); the
                  others take one. Rows with no value are ignored.
                </p>
              </div>
            )}
          </fieldset>

          <div className="flex items-center gap-4">
            <button
              onClick={() => void runReport()}
              disabled={isRunning || Boolean(validationError)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 disabled:opacity-40"
            >
              {isRunning ? 'Running…' : 'Run report'}
            </button>
            {isRunning && mode === 'async' && (
              <button
                onClick={cancelReport}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Stop polling
              </button>
            )}
            {validationError && (
              <span className="text-sm text-gray-500">{validationError}</span>
            )}
          </div>
        </div>

        {progress && !completedReport && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p>
              Job <code className="text-xs">{progress.reportId}</code> is{' '}
              <span className="font-medium">{progress.status}</span>
              {progress.attempt > 0 && ` · checked ${progress.attempt}×`}
            </p>
            <p className="mt-1 text-gray-500">
              Polling every 10s, the fastest the status endpoint allows.
            </p>
          </div>
        )}

        {error && (
          <ErrorState
            title="Report failed"
            message={error}
            onRetry={() => void runReport()}
          />
        )}

        {completedReport && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
            <h2 className="text-sm font-medium text-gray-900">Report ready</h2>
            <p className="text-sm text-gray-600">
              {completedReport.schema.length} column
              {completedReport.schema.length === 1 ? '' : 's'}
              {completedReport.fileSizeBytes
                ? ` · ${formatBytes(completedReport.fileSizeBytes)}`
                : ''}
              {completedReport.urlExpiresAt
                ? ` · link expires ${new Date(completedReport.urlExpiresAt).toLocaleString()}`
                : ''}
            </p>
            <a
              href={completedReport.reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800"
            >
              Download CSV
            </a>
          </div>
        )}

        {report && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {rows.length === 0 ? (
              <p className="p-6 text-sm text-gray-600">
                The report ran successfully but returned no rows for this date
                range.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column.name}
                          className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                            isNumericColumn(column) ? 'text-right' : 'text-left'
                          }`}
                        >
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {(row.values ?? []).map((value, valueIndex) => (
                          <td
                            key={valueIndex}
                            className={`px-4 py-2 text-sm text-gray-900 whitespace-nowrap ${
                              columns[valueIndex] &&
                              isNumericColumn(columns[valueIndex])
                                ? 'text-right font-mono'
                                : 'text-left'
                            }`}
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
              {rows.length} row{rows.length === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
