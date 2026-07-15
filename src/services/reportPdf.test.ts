import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAdherenceReportPdf,
} from './reportPdf';
import { adherenceReportFilename, deliverReportFile } from './reportExport';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('adherence report PDF', () => {
  it('creates a real PDF blob with a safe filename', () => {
    const blob = createAdherenceReportPdf({
      title: 'Bilan de suivi',
      subject: 'Profil suivi : Maïa',
      period: 'Période : 7 derniers jours',
      generatedOn: 'Généré le : 15/07/2026',
      summary: [{ label: 'Taux de suivi', value: '80%' }],
      routineHeading: 'Résultats par routine',
      routineColumns: ['Routine', 'Réussis', 'Taux'],
      routines: [['Élastiques', '4/5', '80%']],
      historyHeading: 'Historique',
      historyColumns: ['Date', 'Routine', 'Statut'],
      history: [['15/07/2026', 'Élastiques', 'Validé']],
      privacyNote: 'Aucune photo de preuve.',
    });

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(500);
    expect(adherenceReportFilename('Maïa Dupont', 'pdf')).toBe('zadiag-bilan-maia-dupont.pdf');
  });

  it('uses the mobile share sheet when PDF file sharing is supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share,
      canShare: vi.fn().mockReturnValue(true),
    });

    await deliverReportFile(new Blob(['pdf'], { type: 'application/pdf' }), 'bilan.pdf', 'Bilan');

    expect(share).toHaveBeenCalledOnce();
    expect(share.mock.calls[0]?.[0].files[0]).toMatchObject({ name: 'bilan.pdf', type: 'application/pdf' });
  });
});
