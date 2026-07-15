import { describe, expect, it } from 'vitest';
import { createAdherenceReportCsv } from './reportCsv';
import { adherenceReportFilename } from './reportExport';

describe('adherence report CSV', () => {
  it('creates an Excel-compatible UTF-8 report with localized delimiters and escaped cells', async () => {
    const blob = createAdherenceReportCsv({
      title: 'Bilan de suivi',
      subject: 'Profil suivi : Maïa',
      period: 'Période : 7 derniers jours',
      generatedOn: 'Généré le : 15/07/2026',
      summary: [{ label: 'Taux de suivi', value: '80%' }],
      routineHeading: 'Résultats par routine',
      routineColumns: ['Routine', 'Réussis', 'Taux'],
      routines: [['Élastiques; nuit', '4/5', '80%']],
      historyHeading: 'Historique',
      historyColumns: ['Date', 'Routine', 'Statut'],
      history: [['15/07/2026', 'Élastiques; nuit', 'Validé']],
      privacyNote: 'Aucune photo de preuve.',
    }, ';');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const content = await blob.text();
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(Array.from(bytes.slice(0, 3))).toEqual([239, 187, 191]);
    expect(content.startsWith('Bilan de suivi')).toBe(true);
    expect(content).toContain('Routine;Réussis;Taux');
    expect(content).toContain('"Élastiques; nuit";4/5;80%');
    expect(adherenceReportFilename('Maïa Dupont', 'csv')).toBe('zadiag-bilan-maia-dupont.csv');
  });
});
