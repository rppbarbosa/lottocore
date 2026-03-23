import { WebSocketServer } from 'ws';
import { isUuid } from './utils/uuid.js';

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const subscribersByEvent = new Map();

/**
 * @param {import('ws').WebSocket} ws
 * @param {string} eventId
 */
function subscribe(eventId, ws) {
  if (!subscribersByEvent.has(eventId)) {
    subscribersByEvent.set(eventId, new Set());
  }
  subscribersByEvent.get(eventId).add(ws);
}

/**
 * @param {string} eventId
 * @param {import('ws').WebSocket} ws
 */
function unsubscribe(eventId, ws) {
  const set = subscribersByEvent.get(eventId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) subscribersByEvent.delete(eventId);
}

/**
 * @param {string} eventId
 * @param {Record<string, unknown>} message
 */
export function broadcastToEvent(eventId, message) {
  const set = subscribersByEvent.get(eventId);
  if (!set?.size) return;
  const data = JSON.stringify(message);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(data);
  }
}

/**
 * WebSocket em `/ws?eventId=<uuid>`. Mensagens: JSON com `type` e `payload`.
 * @param {import('http').Server} httpServer
 */
export function attachWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host ?? 'localhost';
      const url = new URL(request.url ?? '', `http://${host}`);
      if (url.pathname !== '/ws') {
        socket.destroy();
        return;
      }
      const eventId = url.searchParams.get('eventId');
      if (!eventId || !isUuid(eventId)) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        subscribe(eventId, ws);
        ws.send(JSON.stringify({ type: 'connected', payload: { eventId } }));
        ws.on('close', () => unsubscribe(eventId, ws));
        ws.on('error', () => unsubscribe(eventId, ws));
      });
    } catch {
      socket.destroy();
    }
  });

  return wss;
}
