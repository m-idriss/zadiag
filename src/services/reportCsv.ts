import type { AdherenceReportExportInput } from './reportExport';

const csvCell = (value: string, delimiter: string) => {
  if (!value.includes(delimiter) && !/["\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

export const createAdherenceReportCsv = (
  input: AdherenceReportExportInput,
  delimiter: ',' | ';',
) => {
  const rows: string[][] = [
    [input.title],
    [input.subject],
    [input.period],
    [input.generatedOn],
    [],
    ...input.summary.map(({ label, value }) => [label, value]),
    [],
  ];
  if (input.routines.length) {
    rows.push([input.routineHeading], input.routineColumns, ...input.routines, []);
  }
  rows.push([input.historyHeading], input.historyColumns, ...input.history, [], [input.privacyNote]);
  const content = rows.map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter)).join('\r\n');
  return new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
};
