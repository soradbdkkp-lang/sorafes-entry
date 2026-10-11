import type { SaveRequest, SaveResult } from './contract';

export async function sendTestEntry(request: SaveRequest): Promise<SaveResult> {
  const response = await fetch('/api/test-entry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error('UNKNOWN');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('ok' in data)) throw Error('UNKNOWN');
  const result = data as SaveResult;
  if (result.ok !== true && result.ok !== false) throw Error('UNKNOWN');
  if (result.ok && (result.requestId !== request.requestId || typeof result.savedId !== 'string' || !/^TEST-/.test(result.savedId))) throw Error('UNKNOWN');
  if (!result.ok && typeof result.code !== 'string') throw Error('UNKNOWN');
  return result;
}
