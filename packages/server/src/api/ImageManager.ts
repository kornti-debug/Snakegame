import fs from 'fs';
import path from 'path';

export class ImageManager {
  currentImageUrl: string | null = null;
  currentWord: string | null = null;

  private nextImageUrl: string | null = null;
  private nextWord: string | null = null;

  // Directory for storing uploaded images
  private uploadDir: string;

  constructor(uploadDir: string) {
    this.uploadDir = uploadDir;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }

  /** Queue an image for the next round (URL or base64) */
  setNextImage(imageUrl: string | null, word: string, imageBase64?: string): string {
    this.nextWord = word;

    if (imageBase64) {
      // Save base64 image to disk and serve locally
      const filename = `round-${Date.now()}.png`;
      const filepath = path.join(this.uploadDir, filename);
      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(filepath, buffer);
      this.nextImageUrl = `/uploads/${filename}`;
    } else if (imageUrl) {
      this.nextImageUrl = imageUrl;
    }

    return this.nextImageUrl ?? '';
  }

  /** Called when a new round starts — promote queued image to current */
  startRound(): { imageUrl: string; word: string } {
    if (this.nextImageUrl) {
      this.currentImageUrl = this.nextImageUrl;
      this.currentWord = this.nextWord;
      this.nextImageUrl = null;
      this.nextWord = null;
    }
    // If no image was queued, keep the current one (or empty)
    return {
      imageUrl: this.currentImageUrl ?? '',
      word: this.currentWord ?? '',
    };
  }

  /** Check a guess against the current word (case-insensitive, trimmed) */
  checkGuess(guess: string): boolean {
    if (!this.currentWord) return false;
    return guess.trim().toLowerCase() === this.currentWord.trim().toLowerCase();
  }

  getCurrentState(): { imageUrl: string | null; word: string | null; hasNext: boolean } {
    return {
      imageUrl: this.currentImageUrl,
      word: this.currentWord,
      hasNext: this.nextImageUrl !== null,
    };
  }
}
