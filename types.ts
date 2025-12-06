export enum WingmanAlertType {
  RISK = 'RISK',
  BLUFF = 'BLUFF',
  OPPORTUNITY = 'OPPORTUNITY',
  COUNTER = 'COUNTER',
  INFO = 'INFO'
}

export interface WingmanMessage {
  id: string;
  type: WingmanAlertType;
  text: string;
  timestamp: number;
}

export interface StreamConfig {
  sampleRate: number;
  frameRate: number;
}

export interface AudioContexts {
  input: AudioContext;
  output: AudioContext;
}
