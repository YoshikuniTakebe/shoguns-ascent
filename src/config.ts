const hostname = window.location.hostname;
const port = '3001';
export const API_BASE = `http://${hostname}:${port}`;
export const WS_BASE = `ws://${hostname}:${port}`;
