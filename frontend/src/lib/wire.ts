// TypeScript contract for the /api/stream/ws wire format, derived from
// neurolink_v2/domain/stream/broadcaster.py and the DSP pipeline payload it
// attaches to EEG frames. See docs/ports/wire-format-sample.json for samples.

export interface BandPowers {
  delta: number
  theta: number
  alpha: number
  beta: number
  gamma: number
}

export interface BandQuality {
  status: string
  reason?: string
  guidance?: string
}

export interface PipelinePayload {
  bands?: Partial<BandPowers>
  bad_channels?: string[]
  artifact_rejected?: boolean
  artifact_reasons?: string[]
  baseline_phase?: string
  faa?: number | null
  fmt?: number | null
}

export interface StreamHealth {
  frames_total: number
  frames_rejected: number
  frames_clean: number
  packet_loss_pct: number
  last_frame_ts: number
  avg_tick_ms: number
}

export interface EegFrame {
  type: 'eeg'
  ts?: number[]
  timestamps?: number[]
  eeg?: Record<string, number[]>
  channel_names?: string[]
  band_powers?: Record<string, Partial<BandPowers>>
  band_debug?: Record<string, unknown>
  band_quality?: Record<string, BandQuality>
  pipeline?: PipelinePayload
  stream_health?: StreamHealth
  battery?: number | null
  // Per-frame derived hardware/state metrics (frame_metrics.py). Keyed by
  // channel name; absent until the first EEG frame carries usable samples.
  contact?: Record<string, number>
  impedance?: Record<string, number>
  focus_state?: string
  focus_score?: number
  fatigue?: number
}

export interface OpticalFrame {
  type: 'optical'
  timestamps?: number[]
  optical?: Record<string, number[]>
  battery?: number | null
}

export interface ImuFrame {
  type: 'imu'
  timestamps?: number[]
  accel?: { x: number[]; y: number[]; z: number[] }
  gyro?: { x: number[]; y: number[]; z: number[] }
  battery?: number | null
}

export interface PingFrame {
  type: 'ping'
}

export type WireFrame = EegFrame | OpticalFrame | ImuFrame | PingFrame

export interface DeviceStatus {
  is_streaming: boolean
  board_id: string
  has_board: boolean
  channel_names: string[]
  preset?: string
  transport_metadata?: Record<string, string>
  battery?: number | null
}
