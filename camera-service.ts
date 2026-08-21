/* ═══════════════════════════════════════════════════════════════
   Kisan Store — src/ts/camera-service.ts
   A typed abstraction of the Daily Farm Check-in camera pipeline
   (Logic 5). The browser module assets/js/camera.js implements the
   same flow against the DOM; this service models it in a testable,
   DOM-free way and is reused by the Node CLI simulation.
   ═══════════════════════════════════════════════════════════════ */

import type { CheckinSubmission, CheckinValidation, UploadRecord } from './models.js';
import { validateCheckin, DEFAULT_RULES } from './reward-engine.js';

export interface CameraCapabilities {
  hasGetUserMedia: boolean;
  hasMediaRecorder: boolean;
  maxResolution: { width: number; height: number };
}

export class CameraService {
  private photos: Blob[] = [];
  private video: Blob | null = null;
  private videoSeconds = 0;
  private stream: MediaStream | null = null;

  constructor(
    private readonly rules = DEFAULT_RULES,
    private readonly media: Pick<Navigator, 'mediaDevices'> | null = null
  ) {}

  /** Probe what this device supports. */
  static detectCapabilities(nav?: Navigator): CameraCapabilities {
    return {
      hasGetUserMedia: !!nav?.mediaDevices?.getUserMedia,
      hasMediaRecorder: typeof MediaRecorder !== 'undefined',
      maxResolution: { width: 1280, height: 720 }
    };
  }

  async open(): Promise<void> {
    if (!this.media?.mediaDevices?.getUserMedia) {
      throw new Error('Camera API not supported on this device');
    }
    this.stream = await this.media.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 } },
      audio: true
    });
  }

  /** Capture a still frame from the live stream onto a canvas. */
  async capturePhoto(video: HTMLVideoElement): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Snapshot failed'))), 'image/jpeg', 0.85);
    });
    this.photos.push(blob);
    return blob;
  }

  acceptPhoto(blob: Blob): void {
    this.photos.push(blob);
  }

  acceptVideo(blob: Blob, seconds: number): void {
    this.video = blob;
    this.videoSeconds = seconds;
  }

  reset(): void {
    this.photos = [];
    this.video = null;
    this.videoSeconds = 0;
  }

  close(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  /** Build the submission object and validate it against the rules. */
  submission(description: string): { submission: CheckinSubmission; validation: CheckinValidation } {
    const submission: CheckinSubmission = {
      photos: [...this.photos],
      video: this.video,
      videoSeconds: this.videoSeconds,
      description
    };
    return { submission, validation: validateCheckin(submission, this.rules) };
  }

  /** Convert captured blobs into storable upload records. */
  toUploadRecords(description: string, now = Date.now()): Omit<UploadRecord, 'id'>[] {
    const records: Omit<UploadRecord, 'id'>[] = this.photos.map(blob => ({
      type: 'photo' as const,
      blob,
      description,
      createdAt: now,
      dateKey: new Date(now).toISOString().slice(0, 10),
      synced: false
    }));
    if (this.video) {
      records.push({
        type: 'video' as const,
        blob: this.video,
        description,
        createdAt: now,
        dateKey: new Date(now).toISOString().slice(0, 10),
        synced: false
      });
    }
    return records;
  }
}

/** Progress helper for the UI chips (photos x/3 · video · description). */
export function checkinProgress(
  photos: number,
  videoSeconds: number,
  description: string,
  rules = DEFAULT_RULES
): { photosOk: boolean; videoOk: boolean; descOk: boolean; complete: boolean } {
  const photosOk = photos >= rules.minPhotos;
  const videoOk = videoSeconds >= rules.minVideoSeconds;
  const descOk = description.trim().length >= rules.minDescriptionChars;
  return { photosOk, videoOk, descOk, complete: photosOk && videoOk && descOk };
}
