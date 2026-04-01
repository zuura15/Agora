const DEBUG = import.meta.env.DEV || localStorage.getItem('agora_debug') === 'true';

type LogLevel = 'info' | 'warn' | 'error';

const COLORS: Record<string, string> = {
  Auth: '#6366f1',
  Sync: '#22c55e',
  Stream: '#f59e0b',
  API: '#3b82f6',
  App: '#8b5cf6',
  Access: '#ec4899',
  Admin: '#f97316',
};

function log(module: string, level: LogLevel, message: string, data?: unknown) {
  if (!DEBUG && level === 'info') return;

  const color = COLORS[module] || '#888';
  const prefix = `%c[${module}]`;
  const style = `color: ${color}; font-weight: bold`;

  if (level === 'error') {
    console.error(prefix, style, message, data !== undefined ? data : '');
  } else if (level === 'warn') {
    console.warn(prefix, style, message, data !== undefined ? data : '');
  } else {
    console.log(prefix, style, message, data !== undefined ? data : '');
  }
}

export const logger = {
  auth: {
    info: (msg: string, data?: unknown) => log('Auth', 'info', msg, data),
    warn: (msg: string, data?: unknown) => log('Auth', 'warn', msg, data),
    error: (msg: string, data?: unknown) => log('Auth', 'error', msg, data),
  },
  sync: {
    info: (msg: string, data?: unknown) => log('Sync', 'info', msg, data),
    warn: (msg: string, data?: unknown) => log('Sync', 'warn', msg, data),
    error: (msg: string, data?: unknown) => log('Sync', 'error', msg, data),
  },
  stream: {
    info: (msg: string, data?: unknown) => log('Stream', 'info', msg, data),
    warn: (msg: string, data?: unknown) => log('Stream', 'warn', msg, data),
    error: (msg: string, data?: unknown) => log('Stream', 'error', msg, data),
  },
  api: {
    info: (msg: string, data?: unknown) => log('API', 'info', msg, data),
    warn: (msg: string, data?: unknown) => log('API', 'warn', msg, data),
    error: (msg: string, data?: unknown) => log('API', 'error', msg, data),
  },
  app: {
    info: (msg: string, data?: unknown) => log('App', 'info', msg, data),
    warn: (msg: string, data?: unknown) => log('App', 'warn', msg, data),
    error: (msg: string, data?: unknown) => log('App', 'error', msg, data),
  },
  access: {
    info: (msg: string, data?: unknown) => log('Access', 'info', msg, data),
    warn: (msg: string, data?: unknown) => log('Access', 'warn', msg, data),
    error: (msg: string, data?: unknown) => log('Access', 'error', msg, data),
  },
  admin: {
    info: (msg: string, data?: unknown) => log('Admin', 'info', msg, data),
    warn: (msg: string, data?: unknown) => log('Admin', 'warn', msg, data),
    error: (msg: string, data?: unknown) => log('Admin', 'error', msg, data),
  },
};

// Enable debug logging in production by running in console:
// localStorage.setItem('agora_debug', 'true'); location.reload();
