export type VerificationAttempt = { address: string; generation: number };

/** Connection-scoped async guard; never persists signatures or unlock state. */
export class VerificationSession {
  private address: string | null = null;
  private generation = 0;
  private attempted = false;
  private pending = false;
  sync(address: string | null) {
    if (address === this.address) return;
    this.address = address; this.generation++; this.attempted = false; this.pending = false;
  }
  begin(automatic: boolean): VerificationAttempt | null {
    if (!this.address || this.pending || automatic && this.attempted) return null;
    this.attempted = true; this.pending = true;
    return { address: this.address, generation: this.generation };
  }
  current(attempt: VerificationAttempt | null): boolean {
    return !!attempt && attempt.address === this.address && attempt.generation === this.generation;
  }
  finish(attempt: VerificationAttempt) { if (this.current(attempt)) this.pending = false; }
}
