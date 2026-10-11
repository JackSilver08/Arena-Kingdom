interface QueueState<Reservation> {
  status: string;
  reservation?: Reservation;
}
type QueueRequest<Reservation> = (method: 'POST' | 'GET' | 'DELETE', signal?: AbortSignal) => Promise<QueueState<Reservation>>;
interface JoinedRoom { leave(consented: boolean): Promise<unknown> }

function waitForPoll(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const aborted = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve(); }, ms);
    signal?.addEventListener('abort', aborted, { once: true });
  });
}

/** A queue belongs to this attempt only after enqueue succeeds. Release it on every failed handoff. */
export async function joinRanked<Reservation, Room extends JoinedRoom>(
  queue: QueueRequest<Reservation>,
  consume: (reservation: Reservation) => Promise<Room>,
  signal?: AbortSignal,
  pollMs = 1000,
) {
  let owned = false;
  let handedOff = false;
  try {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    // Do not abort enqueue after the server may have accepted it: await the ownership response first.
    let status = await queue('POST');
    owned = true;
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    while (!status.reservation) {
      if (status.status === 'idle') throw new Error('Your ranked queue expired. Please try again.');
      await waitForPoll(pollMs, signal);
      status = await queue('GET', signal);
    }
    const room = await consume(status.reservation);
    if (signal?.aborted) {
      await room.leave(true);
      throw new DOMException('Cancelled', 'AbortError');
    }
    handedOff = true;
    return room;
  } finally {
    if (owned && !handedOff) await queue('DELETE').catch(() => undefined);
  }
}
