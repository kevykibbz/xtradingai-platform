// lib/deriv-ws.js
import { getWebSocketEndpoint } from './config';

let ws = null;

export const createWS = () => {
  if (ws && ws.readyState === WebSocket.OPEN) return ws;
  const endpoint = getWebSocketEndpoint();
  console.log('[deriv-ws] Creating WebSocket to:', endpoint);
  ws = new WebSocket(endpoint);
  return ws;
};