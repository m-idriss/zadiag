export interface AdherenceReportExportInput {
  title: string;
  subject: string;
  period: string;
  generatedOn: string;
  summary: Array<{ label: string; value: string }>;
  routineHeading: string;
  routineColumns: [string, string, string];
  routines: Array<[string, string, string]>;
  historyHeading: string;
  historyColumns: [string, string, string];
  history: Array<[string, string, string]>;
  privacyNote: string;
}

const safeFilenamePart = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();

export const adherenceReportFilename = (subject: string, extension: 'pdf' | 'csv') =>
  `zadiag-bilan-${safeFilenamePart(subject) || 'suivi'}.${extension}`;

export const deliverReportFile = async (blob: Blob, filename: string, title: string) => {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};
