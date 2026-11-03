import { createError } from "h3";

export const MAX_DECODES = 2;
export const DECODE_WAIT_MS = 30_000;

type Waiter = { grant: () => void; timer: ReturnType<typeof setTimeout> };

let running = 0;
const queue: Waiter[] = [];

export function decodeSlotState() {
  return { running, waiting: queue.length };
}

function acquire(waitMs: number): Promise<void> {
  if (running < MAX_DECODES && !queue.length) {
    running++;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const waiter: Waiter = {
      grant: () => {
        clearTimeout(waiter.timer);
        resolve();
      },
      timer: setTimeout(() => {
        queue.splice(queue.indexOf(waiter), 1);
        reject(
          createError({
            statusCode: 503,
            statusMessage:
              "The server is busy reading other files. Try again in a minute.",
          }),
        );
      }, waitMs),
    };
    queue.push(waiter);
  });
}

function release() {
  const next = queue.shift();
  if (next) next.grant();
  else running--;
}

export async function withDecodeSlot<T>(
  fn: () => Promise<T> | T,
  options: { waitMs?: number } = {},
): Promise<T> {
  await acquire(options.waitMs ?? DECODE_WAIT_MS);
  try {
    return await fn();
  } finally {
    release();
  }
}
