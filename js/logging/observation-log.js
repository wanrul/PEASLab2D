/**
 * PEASLab2D - Personal Observation Log
 * Records expected, mismatched and uncertain robot behavior for one learner.
 */

import { appState } from '../state.js';

export class ObservationLogger {
  constructor(containerElement) {
    this.container = containerElement;
    appState.on('observationAdded', () => this.render());
  }

  render() {
    if (!this.container) return;
    const logs = appState.observationLogs;

    this.container.innerHTML = `
      <div class="observation-log-panel">
        <div class="observation-log-header">
          <div class="title-row">
            <h4>📋 Observation Log</h4>
            <span class="badge badge-neutral">${logs.length} observations</span>
          </div>
          <p class="subtitle">Record whether robot behavior matches your specification.</p>
        </div>
        <div class="stamp-controls">
          <div class="btn-group">
            <button class="btn btn-stamp pass" data-stamp="✓" title="Behavior matches specification">✓ Pass</button>
            <button class="btn btn-stamp fail" data-stamp="✗" title="Behavior violated expected specification">✗ Mismatch</button>
            <button class="btn btn-stamp query" data-stamp="?" title="Uncertain / Needs Review">? Uncertain</button>
          </div>
        </div>
        <div class="log-col">
          <div class="col-header">Your observations</div>
          <div class="log-list">
            ${logs.length === 0 ? '<div class="empty-log">No observations yet</div>' : ''}
            ${logs.map(entry => `
              <div class="log-item stamp-${entry.stamp === '✓' ? 'pass' : entry.stamp === '✗' ? 'fail' : 'query'}">
                <span class="stamp-badge">${entry.stamp}</span>
                <div class="log-body">
                  <span class="log-time">${entry.timestamp} (Tick ${entry.tick})</span>
                  <span class="log-comment">${entry.comment || 'Observation logged'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.container.querySelectorAll('.btn-stamp').forEach(btn => {
      btn.onclick = () => {
        appState.addObservationStamp(btn.getAttribute('data-stamp'), 'Observed during simulation run');
      };
    });
  }
}
