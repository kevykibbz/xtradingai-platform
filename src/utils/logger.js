/**
 * Console Logger with File Export
 * Captures all console logs and allows exporting to file for debugging
 */

class ConsoleLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 logs
    this.startTime = Date.now();
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };
    
    this.interceptConsole();
  }

  formatValue(value) {
    try {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      
      // Handle Error objects specially
      if (value instanceof Error) {
        return JSON.stringify({
          name: value.name,
          message: value.message,
          stack: value.stack
        }, null, 2);
      }
      
      // Handle DOM elements
      if (value instanceof Element) {
        return `<${value.tagName.toLowerCase()}${value.id ? ` id="${value.id}"` : ''}${value.className ? ` class="${value.className}"` : ''}>`;
      }
      
      // Handle functions
      if (typeof value === 'function') {
        return `[Function: ${value.name || 'anonymous'}]`;
      }
      
      // Handle objects and arrays
      if (typeof value === 'object') {
        return JSON.stringify(value, (key, val) => {
          // Handle circular references
          if (val instanceof Element) {
            return `<${val.tagName}>`;
          }
          if (typeof val === 'function') {
            return `[Function]`;
          }
          return val;
        }, 2);
      }
      
      return String(value);
    } catch (e) {
      return `[Unserializable: ${e.message}]`;
    }
  }

  addLog(level, args) {
    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - this.startTime;
    
    const formattedArgs = Array.from(args).map(arg => this.formatValue(arg));
    
    const logEntry = {
      timestamp,
      elapsed: `${(elapsed / 1000).toFixed(3)}s`,
      level,
      message: formattedArgs.join(' ')
    };
    
    this.logs.push(logEntry);
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  interceptConsole() {
    console.log = (...args) => {
      this.addLog('LOG', args);
      this.originalConsole.log.apply(console, args);
    };

    console.warn = (...args) => {
      this.addLog('WARN', args);
      this.originalConsole.warn.apply(console, args);
    };

    console.error = (...args) => {
      this.addLog('ERROR', args);
      this.originalConsole.error.apply(console, args);
    };

    console.info = (...args) => {
      this.addLog('INFO', args);
      this.originalConsole.info.apply(console, args);
    };
  }

  getLogs() {
    return this.logs;
  }

  getLogsAsText() {
    return this.logs.map(log => 
      `[${log.timestamp}] [${log.elapsed}] [${log.level}] ${log.message}`
    ).join('\n');
  }

  getLogsAsJSON() {
    return JSON.stringify(this.logs, null, 2);
  }

  downloadLogs(format = 'txt') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `console-logs-${timestamp}.${format}`;
    
    let content;
    let mimeType;
    
    if (format === 'json') {
      content = this.getLogsAsJSON();
      mimeType = 'application/json';
    } else {
      content = this.getLogsAsText();
      mimeType = 'text/plain';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`[Logger] Downloaded ${this.logs.length} logs to ${filename}`);
  }

  clear() {
    this.logs = [];
    this.startTime = Date.now();
    console.log('[Logger] Logs cleared');
  }

  // Filter logs by level
  filterByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }

  // Filter logs by time range
  filterByTimeRange(startTime, endTime) {
    return this.logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= startTime && logTime <= endTime;
    });
  }

  // Search logs by keyword
  search(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return this.logs.filter(log => 
      log.message.toLowerCase().includes(lowerKeyword)
    );
  }

  // Get statistics
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {
        LOG: 0,
        WARN: 0,
        ERROR: 0,
        INFO: 0
      }
    };

    this.logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
    });

    return stats;
  }

  // Export specific logs
  exportFiltered(filterFn, filename = 'filtered-logs.txt') {
    const filtered = this.logs.filter(filterFn);
    const content = filtered.map(log => 
      `[${log.timestamp}] [${log.elapsed}] [${log.level}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`[Logger] Exported ${filtered.length} filtered logs to ${filename}`);
  }
}

// Create singleton instance
const logger = new ConsoleLogger();

// Add global access for debugging
window.logger = logger;
window.downloadLogs = () => logger.downloadLogs('txt');
window.downloadLogsJSON = () => logger.downloadLogs('json');
window.downloadErrorLogs = () => {
  logger.exportFiltered(
    log => log.level === 'ERROR',
    `error-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  );
};
window.downloadHigherLowerLogs = () => {
  logger.exportFiltered(
    log => log.message.includes('HigherLowerExecution') || log.message.includes('Proposal'),
    `higher-lower-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  );
};
window.downloadWebSocketLogs = () => {
  logger.exportFiltered(
    log => log.message.includes('WebSocket') || log.message.includes('DerivContext'),
    `websocket-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  );
};

// Add keyboard shortcut to download logs (Ctrl+Shift+L)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      logger.downloadLogs('txt');
    }
  });
}

export default logger;

// Initialize logger - called from main.jsx
export const initLogger = () => {
  console.log('[Logger] Console logging initialized. Use window.downloadLogs() to download logs.');
  console.log('[Logger] Keyboard shortcut: Ctrl+Shift+L to download logs');
  console.log('[Logger] Available functions:');
  console.log('  - window.downloadLogs() - Download all logs as TXT');
  console.log('  - window.downloadLogsJSON() - Download all logs as JSON');
  console.log('  - window.downloadErrorLogs() - Download only errors');
  console.log('  - window.downloadHigherLowerLogs() - Download Higher/Lower related logs');
  console.log('  - window.downloadWebSocketLogs() - Download WebSocket related logs');
};

// Helper functions for easy access
export const downloadLogs = (format = 'txt') => logger.downloadLogs(format);
export const downloadLogsJSON = () => logger.downloadLogs('json');
export const clearLogs = () => logger.clear();
export const searchLogs = (keyword) => logger.search(keyword);
export const getLogStats = () => logger.getStats();

// Export specific filters
export const downloadErrorLogs = () => {
  logger.exportFiltered(
    log => log.level === 'ERROR',
    `error-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  );
};

export const downloadHigherLowerLogs = () => {
  logger.exportFiltered(
    log => log.message.includes('HigherLowerExecution') || log.message.includes('Proposal'),
    `higher-lower-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  );
};

export const downloadWebSocketLogs = () => {
  logger.exportFiltered(
    log => log.message.includes('WebSocket') || log.message.includes('DerivContext'),
    `websocket-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  );
};
