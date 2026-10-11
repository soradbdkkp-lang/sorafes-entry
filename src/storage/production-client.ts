const tournamentId = 'frog-assemble-2026';
const receiptPattern = /^FAC-2026-\d{6}$/;
const actions = new Set(['settings', 'create', 'read', 'update', 'recover']);
const failureCodes = new Set([
  'CLOSED', 'DENIED', 'INVALID', 'CONFIG', 'BUSY', 'CONFLICT',
  'PENDING', 'UNKNOWN', 'DUPLICATE', 'POSSIBLE_DUPLICATE',
]);

export type ProductionPayload = Record<string, unknown> & { action: string };
export type ProductionResult = Record<string, unknown> & { ok: boolean };

type Runner = {
  withSuccessHandler(handler: (value: unknown) => void): Runner;
  withFailureHandler(handler: (error: unknown) => void): Runner;
  handleProduction(payload: Record<string, unknown>): void;
};

type ScriptHost = { script?: { run?: Runner } };
type Fetcher = typeof fetch;

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function validatedResult(payload: ProductionPayload, value: unknown): ProductionResult {
  if (!object(value) || (value.ok !== true && value.ok !== false)) throw Error('INVALID_RESPONSE');
  if (!actions.has(payload.action)) throw Error('INVALID_REQUEST');

  if (value.ok === false) {
    if (typeof value.code !== 'string' || !failureCodes.has(value.code)) throw Error('INVALID_RESPONSE');
    return { ok: false, code: value.code };
  }

  if (payload.action === 'settings') {
    if (value.mode !== 'production' || value.tournamentId !== tournamentId ||
        typeof value.deadline !== 'string' || !Number.isFinite(Date.parse(value.deadline))) {
      throw Error('INVALID_RESPONSE');
    }
    return { ok: true, mode: 'production', tournamentId, deadline: value.deadline };
  }

  if (typeof value.receipt !== 'string' || !receiptPattern.test(value.receipt) ||
      !Number.isSafeInteger(value.version) || Number(value.version) < 1 || value.status !== 'committed') {
    throw Error('INVALID_RESPONSE');
  }

  if (payload.action === 'read') {
    if (value.receipt !== payload.receipt || !object(value.draft)) throw Error('INVALID_RESPONSE');
    return { ok: true, receipt: value.receipt, version: value.version, status: 'committed', draft: value.draft };
  }

  if (typeof payload.requestId !== 'string' || value.requestId !== payload.requestId ||
      (payload.action === 'update' && value.receipt !== payload.receipt)) {
    throw Error('INVALID_RESPONSE');
  }
  return { ok: true, receipt: value.receipt, version: value.version, requestId: value.requestId, status: 'committed' };
}

/** Cloudflare本番サイトから同一オリジンのWorker APIだけを呼ぶ。 */
export async function sendProduction(payload: ProductionPayload, fetchImpl: Fetcher = fetch): Promise<ProductionResult> {
  const response = await fetchImpl('/api/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error('HTTP_FAILURE');
  let value: unknown;
  try { value = await response.json(); }
  catch { throw Error('INVALID_RESPONSE'); }
  return validatedResult(payload, value);
}

/** Apps Script HTML Serviceに残す運営検証画面専用の通信経路。 */
export function sendAppsScriptProduction(
  payload: ProductionPayload,
  host = (globalThis as { google?: ScriptHost }).google,
): Promise<ProductionResult> {
  return new Promise((resolve, reject) => {
    const runner = host?.script?.run;
    if (!runner) { reject(Error('NOT_AVAILABLE')); return; }

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => finish(() => reject(Error('TIMEOUT'))), 30000);

    try {
      runner
        .withSuccessHandler(value => finish(() => {
          try { resolve(validatedResult(payload, value)); }
          catch (error) { reject(error); }
        }))
        .withFailureHandler(error => finish(() => reject(error instanceof Error ? error : Error('SCRIPT_FAILURE'))))
        .handleProduction({ mode: 'production', tournamentId, ...payload });
    } catch (error) {
      finish(() => reject(error));
    }
  });
}
