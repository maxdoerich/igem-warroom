import { EventEmitter } from 'node:events';

/** In-process event bus: sync workers emit, the SSE route fans out to browsers. */
export const bus = new EventEmitter();
bus.setMaxListeners(100);
