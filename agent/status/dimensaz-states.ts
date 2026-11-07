// Dimensaz mascot states. Import and map your agent events to a face.
export type DimensazState = 'idle' | 'listening' | 'thinking' | 'planning' | 'creating' | 'rendering' | 'done' | 'excited' | 'confused' | 'error' | 'needs-approval' | 'sleeping';

export const DIMENSAZ_STATES: Record<DimensazState, { label: string; meaning: string }> = {
  'idle': { label: "Idle", meaning: "Waiting for a prompt" },
  'listening': { label: "Listening", meaning: "Reading your script or request" },
  'thinking': { label: "Thinking", meaning: "Reasoning about the edit" },
  'planning': { label: "Planning", meaning: "Breaking the script into scenes and timing" },
  'creating': { label: "Creating", meaning: "Generating images, icons and assets" },
  'rendering': { label: "Rendering", meaning: "Encoding and exporting the video" },
  'done': { label: "Done", meaning: "Export finished successfully" },
  'excited': { label: "Excited", meaning: "Result is ready and looks great" },
  'confused': { label: "Confused", meaning: "Request is unclear, asking a question" },
  'error': { label: "Error", meaning: "A step failed, retrying or reporting" },
  'needs-approval': { label: "Needs you", meaning: "Waiting for your approval or input" },
  'sleeping': { label: "Sleeping", meaning: "Idle for a long time" },
};

/** Path to a face image, e.g. faceUrl('rendering', 256) */
export function faceUrl(state: DimensazState, size: 128 | 256 | 512 = 256, base = '/assets/brand/expressions/png'): string {
  return `${base}/mascot-${state}-${size}.png`;
}

/** Map common agent events to a state. Adjust to your own event names. */
export function stateFromEvent(event: string): DimensazState {
  const map: Record<string, DimensazState> = {
    waiting: 'idle', input: 'listening', reasoning: 'thinking', plan: 'planning',
    generate: 'creating', render: 'rendering', success: 'done', great: 'excited',
    clarify: 'confused', failure: 'error', approval: 'needs-approval', idle_long: 'sleeping',
  };
  return map[event] ?? 'idle';
}
