/** Single learner event stream. CSV contains only the five research fields. */
import { appState } from '../state.js';

export class SessionLogger {
  constructor(state = appState) {
    this.state = state;
    this.events = [];
    state.on('sessionEvent', ({ event, target, detail, step }) => this.record(event, target, detail, step));
  }

  record(event, target = '', detail = '', step = this.state.currentStep) {
    const row = { timestamp: new Date().toISOString(), step, event, target_id: target,
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail) };
    this.events.push(row);
    return row;
  }

  log(event, target = '', detail = '') { return this.record(event, target, detail); }

  exportCSV() {
    const columns = ['timestamp', 'step', 'event', 'target_id', 'detail'];
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [columns.join(','), ...this.events.map(row => columns.map(key => quote(row[key])).join(','))].join('\r\n');
  }

  exportCsv() {
    const csv = this.exportCSV();
    if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
      link.setAttribute('download', `PEASLab2D_Session_Log_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    return csv;
  }

  getSummaryStats() { return { totalEvents: this.events.length }; }
}

export const sessionLogger = new SessionLogger();
export const sessionLog = sessionLogger;
