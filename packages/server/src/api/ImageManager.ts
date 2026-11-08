export class ImageManager {
  currentImageUrl: string | null = null;
  currentWord: string | null = null;

  private nextImageUrl: string | null = null;
  private nextWord: string | null = null;

  // The Node host supplies disk storage; the browser keeps images in memory.
  constructor(private saveImage?: (base64: string) => string) {}

  /** Queue an image for the next round (URL or base64) */
  setNextImage(imageUrl: string | null, word: string, imageBase64?: string): string {
    this.nextWord = word;

    if (imageBase64) {
      this.nextImageUrl = this.saveImage
        ? this.saveImage(imageBase64)
        : `data:image/png;base64,${imageBase64}`;
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
