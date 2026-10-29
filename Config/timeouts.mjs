/**
 * Central time settings. All values are milliseconds.
 * Initial defaults: tune against real devices before treating them as an SLA.
 * Callers must enforce the deadline; declaring a value alone does not time out work.
 */
export const TIMEOUTS = Object.freeze({
  findElement: 10_000,
  waitForVisible: 15_000,
  waitForHidden: 15_000,
  action: 10_000,              // Tap, input, clear, read and state commands.
  assertion: 15_000,           // Entire assertion, including repeated reads.
  findByScrolling: 30_000,     // Entire search; never restart after each scroll.
  contextSwitch: 15_000,
  sessionStart: 120_000,
  sessionClose: 30_000,
  appLaunch: 60_000,
  appTerminate: 15_000,
  evidenceCapture: 30_000,
  resultWrite: 10_000,
});

// Polling delay is distinct from a deadline. Not an automatic action retry.
export const POLL_INTERVAL_MS = 500;
