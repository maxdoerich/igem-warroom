/**
 * Cross-window link between the map and the registry window (same origin).
 * Selecting a team in either window selects it in the other.
 */
export type WarroomMessage = { type: 'select'; teamId: number | null; source: 'map' | 'registry' };

const NAME = 'igem-warroom';

export function openChannel(onMessage: (m: WarroomMessage) => void) {
  if (typeof BroadcastChannel === 'undefined') return { post: () => {}, close: () => {} };
  const ch = new BroadcastChannel(NAME);
  ch.onmessage = (e) => onMessage(e.data as WarroomMessage);
  return {
    post: (m: WarroomMessage) => ch.postMessage(m),
    close: () => ch.close(),
  };
}

let registryWin: Window | null = null;

/**
 * Open (or focus) the registry window. A window that is already open follows the selection via the
 * channel; a new one gets the team in its URL because it isn't listening yet.
 */
export function openRegistryWindow(teamId?: number | null) {
  if (registryWin && !registryWin.closed) {
    registryWin.focus();
    return;
  }
  const url = teamId ? `/registry.html?team=${teamId}` : '/registry.html';
  registryWin = window.open(url, 'igem-warroom-registry', 'popup,width=1500,height=950');
}
