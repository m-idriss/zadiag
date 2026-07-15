import type { AdherenceReportExportInput } from './reportExport';

interface PdfLine {
  text: string;
  size: number;
  bold?: boolean;
  gapAfter?: number;
}

const windows1252: Record<string, number> = {
  '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135,
  'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142,
  '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151,
  '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159,
};

const pdfText = (value: string) => Array.from(value).map((character) => {
  const code = windows1252[character] ?? character.charCodeAt(0);
  if (character === '(' || character === ')' || character === '\\') return `\\${character}`;
  if (code >= 32 && code <= 126) return character;
  if (code <= 255) return `\\${code.toString(8).padStart(3, '0')}`;
  return '?';
}).join('');

const wrapText = (text: string, maxCharacters: number) => {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters || !current) {
      current = candidate;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const reportLines = (input: AdherenceReportExportInput): PdfLine[] => {
  const lines: PdfLine[] = [
    { text: 'Zadiag', size: 16, bold: true, gapAfter: 5 },
    { text: input.title, size: 22, bold: true, gapAfter: 8 },
    { text: input.subject, size: 10 },
    { text: input.period, size: 10 },
    { text: input.generatedOn, size: 10, gapAfter: 8 },
    ...input.summary.map(({ label, value }) => ({ text: `${label}: ${value}`, size: 11, bold: true })),
    { text: '', size: 5, gapAfter: 5 },
  ];
  if (input.routines.length) {
    lines.push({ text: input.routineHeading, size: 14, bold: true, gapAfter: 4 });
    lines.push({ text: input.routineColumns.join(' · '), size: 9, bold: true, gapAfter: 2 });
    input.routines.forEach(([routine, successful, rate]) => {
      lines.push({ text: `${routine} — ${successful} — ${rate}`, size: 10, gapAfter: 2 });
    });
    lines.push({ text: '', size: 5, gapAfter: 5 });
  }
  lines.push({ text: input.historyHeading, size: 14, bold: true, gapAfter: 4 });
  lines.push({ text: input.historyColumns.join(' · '), size: 9, bold: true, gapAfter: 2 });
  input.history.forEach(([date, routine, status]) => {
    lines.push({ text: `${date} — ${routine} — ${status}`, size: 10, gapAfter: 2 });
  });
  lines.push({ text: '', size: 5, gapAfter: 7 });
  lines.push({ text: input.privacyNote, size: 8 });
  return lines;
};

const pageStreams = (lines: PdfLine[]) => {
  const pageHeight = 842;
  const margin = 46;
  const bottom = 46;
  const pages: string[][] = [[]];
  let y = pageHeight - margin;
  lines.forEach((line) => {
    const maxCharacters = Math.max(28, Math.floor(96 * (10 / line.size)));
    wrapText(line.text, maxCharacters).forEach((text) => {
      const lineHeight = line.size * 1.35;
      if (y - lineHeight < bottom) {
        pages.push([]);
        y = pageHeight - margin;
      }
      pages.at(-1)?.push(`BT /F${line.bold ? 2 : 1} ${line.size} Tf 1 0 0 1 ${margin} ${y.toFixed(1)} Tm (${pdfText(text)}) Tj ET`);
      y -= lineHeight;
    });
    y -= line.gapAfter ?? 1.5;
  });
  return pages.map((commands) => commands.join('\n'));
};

const assemblePdf = (streams: string[]) => {
  const objects: string[] = [];
  const pageIds = streams.map((_, index) => 5 + index * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  streams.forEach((stream, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = '%PDF-1.4\n%Zadiag\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${offsets[id].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
};

export const createAdherenceReportPdf = (input: AdherenceReportExportInput) =>
  new Blob([assemblePdf(pageStreams(reportLines(input)))], { type: 'application/pdf' });
