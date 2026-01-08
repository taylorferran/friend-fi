'use client';

import { useEffect, useState } from 'react';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'log' | 'error' | 'warn';
}

export function MobileDebugLogger() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Intercept console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (message: string, type: 'log' | 'error' | 'warn') => {
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prev => [...prev.slice(-50), { timestamp, message, type }]); // Keep last 50 logs
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog(args.map(a => String(a)).join(' '), 'log');
    };

    console.error = (...args) => {
      originalError(...args);
      addLog(args.map(a => String(a)).join(' '), 'error');
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog(args.map(a => String(a)).join(' '), 'warn');
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-20 right-4 z-50 w-12 h-12 bg-primary border-2 border-text rounded-full flex items-center justify-center shadow-lg"
        aria-label="Show debug logs"
      >
        <span className="material-symbols-outlined text-text">bug_report</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-text bg-primary">
        <h3 className="font-display font-bold text-text">Debug Logs</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1 bg-background border-2 border-text font-mono text-sm"
          >
            Clear
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="px-3 py-1 bg-background border-2 border-text font-mono text-sm"
          >
            Close
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
        {logs.length === 0 ? (
          <div className="text-accent">No logs yet...</div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className={`p-2 border-l-4 ${
                log.type === 'error' ? 'border-red-500 bg-red-50 text-red-900' :
                log.type === 'warn' ? 'border-yellow-500 bg-yellow-50 text-yellow-900' :
                'border-primary bg-surface text-text'
              }`}
            >
              <span className="text-accent">[{log.timestamp}]</span> {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

