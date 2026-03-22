export class PIDController {
  private kP: number;
  private kI: number;
  private kD: number;
  private iLimit: number;
  private outputLimit: number;
  private integral = 0;
  private prevError = 0;
  private prevDerivative = 0;
  private dFilterAlpha: number;

  constructor(params: {
    kP: number;
    kI: number;
    kD: number;
    iLimit?: number;
    outputLimit?: number;
    dFilterAlpha?: number;
  }) {
    this.kP = params.kP;
    this.kI = params.kI;
    this.kD = params.kD;
    this.iLimit = params.iLimit ?? 0.3;
    this.outputLimit = params.outputLimit ?? 1.0;
    this.dFilterAlpha = params.dFilterAlpha ?? 0.8;
  }

  update(error: number, dt: number): number {
    if (dt <= 0) return 0;

    // Proportional
    const pTerm = this.kP * error;

    // Integral with anti-windup clamp
    this.integral += error * dt;
    this.integral = Math.max(
      -this.iLimit,
      Math.min(this.iLimit, this.integral),
    );
    const iTerm = this.kI * this.integral;

    // Derivative with low-pass filter to reduce noise
    const rawDerivative = (error - this.prevError) / dt;
    const filteredDerivative = this.dFilterAlpha * this.prevDerivative +
      (1 - this.dFilterAlpha) * rawDerivative;
    const dTerm = this.kD * filteredDerivative;

    this.prevError = error;
    this.prevDerivative = filteredDerivative;

    // Sum and clamp output
    const output = pTerm + iTerm + dTerm;
    return Math.max(-this.outputLimit, Math.min(this.outputLimit, output));
  }

  reset(): void {
    this.integral = 0;
    this.prevError = 0;
    this.prevDerivative = 0;
  }
}
