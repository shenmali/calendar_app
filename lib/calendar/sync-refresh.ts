export type SyncRefreshResult = {
  state: 'success' | 'partial' | 'error';
  shouldRefresh: boolean;
};

type SyncPayload = {
  summary?: {
    connections?: { attempted?: unknown; succeeded?: unknown; failed?: unknown };
  };
};

function isAcceptedSummary(payload: SyncPayload): payload is Required<SyncPayload> & { summary: { connections: { attempted: number; succeeded: number; failed: number } } } {
  const connections = payload.summary?.connections;
  return typeof connections?.attempted === 'number' && typeof connections.succeeded === 'number' && typeof connections.failed === 'number';
}

export async function readManualSyncResult(response: Response): Promise<SyncRefreshResult> {
  if (response.status !== 202) return { state: 'error', shouldRefresh: false };
  try {
    const payload = await response.json() as SyncPayload;
    if (!isAcceptedSummary(payload)) return { state: 'error', shouldRefresh: false };
    return { state: payload.summary.connections.failed > 0 ? 'partial' : 'success', shouldRefresh: true };
  } catch {
    return { state: 'error', shouldRefresh: false };
  }
}
