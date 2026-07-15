import { describe, expect, it } from 'vitest';
import { createAdherenceReportCsv } from './reportCsv';
import { adherenceReportFilename } from './reportExport';

describe('adherence report CSV', () => {
  it('creates one stable database-like row per event', async () => {
    const blob = createAdherenceReportCsv({
      participant: 'Maïa',
      period: 'week',
      exportedAt: '2026-07-15T12:00:00.000Z',
      events: [{
        eventId: 'event-1',
        sessionId: 'session-1',
        routineId: 'routine-1',
        routineName: 'Élastiques, nuit',
        requestedAt: '2026-07-15T08:00:00.000Z',
        expiresAt: '2026-07-15T10:00:00.000Z',
        capturedAt: '2026-07-15T08:05:00.000Z',
        status: 'detected',
        analysisSource: 'ai',
        confidence: .92,
        reason: '=unsafe formula',
        reviewStatus: 'approved',
        reviewedAt: '2026-07-15T08:10:00.000Z',
      }],
    });

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const lines = (await blob.text()).split('\r\n');
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(Array.from(bytes.slice(0, 3))).toEqual([239, 187, 191]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('participant,period,exported_at,event_id,session_id,routine_id,routine_name,requested_at,expires_at,captured_at,status,analysis_source,automated_status,confidence,image_quality,reason,review_status,reviewed_at,review_reason');
    expect(lines[1]).toContain('Maïa,week,2026-07-15T12:00:00.000Z,event-1,session-1,routine-1,"Élastiques, nuit"');
    expect(lines[1]).toContain("' =unsafe formula".replace(' ', ''));
    expect(lines.join('\n')).not.toContain('Aucune photo');
    expect(adherenceReportFilename('Maïa Dupont', 'csv')).toBe('zadiag-bilan-maia-dupont.csv');
  });
});
