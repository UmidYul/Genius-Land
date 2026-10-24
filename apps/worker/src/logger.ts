const levels = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof levels;

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/** One JSON line per event — easy to read in `docker logs` and to ship to a collector later. */
export function createLogger(minLevel: LogLevel = 'info'): Logger {
  const write = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
    if (levels[level] < levels[minLevel]) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...data });
    (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
  };
  return {
    debug: (m, d) => write('debug', m, d),
    info: (m, d) => write('info', m, d),
    warn: (m, d) => write('warn', m, d),
    error: (m, d) => write('error', m, d),
  };
}
