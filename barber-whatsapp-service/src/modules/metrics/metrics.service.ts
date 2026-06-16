import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private requestCount = 0;
  private totalRequestDuration = 0;
  private openaiRequests = 0;
  private openaiFailures = 0;
  private appointmentsCreated = 0;

  incrementRequestCount() {
    this.requestCount++;
  }

  addRequestDuration(durationMs: number) {
    this.totalRequestDuration += durationMs;
  }

  incrementOpenAIRequests() {
    this.openaiRequests++;
  }

  incrementOpenAIFailures() {
    this.openaiFailures++;
  }

  incrementAppointmentsCreated() {
    this.appointmentsCreated++;
  }

  getMetrics() {
    return {
      request_count: this.requestCount,
      average_request_duration_ms: this.requestCount > 0 ? Math.round(this.totalRequestDuration / this.requestCount) : 0,
      openai_requests: this.openaiRequests,
      openai_failures: this.openaiFailures,
      appointments_created: this.appointmentsCreated,
    };
  }
}
