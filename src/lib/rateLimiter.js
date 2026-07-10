/**
 * Global API request queue — prevents rate limit errors while allowing
 * genuine parallel reads.
 *
 * Design:
 * - READ operations (list, filter, get) run fully in parallel — no queuing.
 *   The server handles concurrent reads fine; queuing them only adds latency.
 * - WRITE operations (create, update, delete, bulkCreate, bulkUpdate,
 *   updateMany, deleteMany) go through a queue with a 200ms gap to avoid
 *   race conditions and optimistic-concurrency conflicts.
 * - auth.me() is deduplicated: concurrent calls share one in-flight promise.
 */

const WRITE_METHODS = new Set(['create', 'update', 'delete', 'bulkCreate', 'bulkUpdate', 'updateMany', 'deleteMany']);
const SKIP_RATE_LIMIT = new Set(['subscribe', 'unsubscribe', 'schema']);
const WRITE_GAP_MS = 200;

// ── Write queue (sequential) ──────────────────────────────────────────────────
const writeQueue = [];
let writeProcessing = false;

function enqueueWrite(fn) {
  return new Promise((resolve, reject) => {
    writeQueue.push({ fn, resolve, reject });
    processWriteQueue();
  });
}

function processWriteQueue() {
  if (writeProcessing || writeQueue.length === 0) return;
  writeProcessing = true;
  const { fn, resolve, reject } = writeQueue.shift();
  let result;
  try { result = fn(); } catch (e) { reject(e); scheduleNextWrite(); return; }
  if (result && typeof result.then === 'function') {
    result.then(resolve).catch(reject).finally(scheduleNextWrite);
  } else {
    resolve(result);
    scheduleNextWrite();
  }
}

function scheduleNextWrite() {
  setTimeout(() => { writeProcessing = false; processWriteQueue(); }, WRITE_GAP_MS);
}

/**
 * rateLimit: used for auth.me() deduplication.
 * Concurrent calls within a 500ms window share the same in-flight promise.
 */
let _meInFlight = null;
let _meInFlightTs = 0;
export function rateLimit(fn) {
  return (...args) => {
    // Deduplicate /User/me calls: if one is already in-flight, return same promise
    const now = Date.now();
    if (_meInFlight && (now - _meInFlightTs) < 500) return _meInFlight;
    _meInFlightTs = now;
    _meInFlight = fn(...args).finally(() => { _meInFlight = null; });
    return _meInFlight;
  };
}

/**
 * Wraps entity SDK: reads run in parallel, writes are queued sequentially.
 */
export function rateLimitEntities(entities) {
  return new Proxy(entities, {
    get(target, entityName) {
      const entity = target[entityName];
      if (!entity || typeof entity !== 'object') return entity;
      return new Proxy(entity, {
        get(_, method) {
          const original = entity[method];
          if (typeof original !== 'function') return original;
          if (SKIP_RATE_LIMIT.has(method)) return original;
          if (WRITE_METHODS.has(method)) {
            // Write: go through sequential queue
            return (...args) => enqueueWrite(() => original(...args));
          }
          // Read (list, filter, get): run immediately in parallel
          return (...args) => original(...args);
        },
      });
    },
  });
}