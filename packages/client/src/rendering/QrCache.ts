import QRCode from 'qrcode';

/** Generates a QR code for the phone-join URL and caches it as a canvas. */
export class QrCache {
  private canvas: HTMLCanvasElement | null = null;
  private pending = false;
  readonly url: string;

  constructor(url: string, size: number = 220) {
    this.url = url;
    this.generate(size);
  }

  private async generate(size: number): Promise<void> {
    if (this.pending) return;
    this.pending = true;
    try {
      const c = document.createElement('canvas');
      await QRCode.toCanvas(c, this.url, {
        width: size,
        margin: 1,
        color: { dark: '#0a0a1a', light: '#ffffff' },
      });
      this.canvas = c;
    } catch (err) {
      console.warn('[QR] Failed to generate:', err);
    } finally {
      this.pending = false;
    }
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
}
