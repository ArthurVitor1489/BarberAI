import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('should start with all metrics at zero', () => {
    const metrics = service.getMetrics();
    expect(metrics.request_count).toBe(0);
    expect(metrics.average_request_duration_ms).toBe(0);
    expect(metrics.openai_requests).toBe(0);
    expect(metrics.openai_failures).toBe(0);
    expect(metrics.appointments_created).toBe(0);
  });

  it('should increment request count and calculate average duration', () => {
    service.incrementRequestCount();
    service.addRequestDuration(100);
    
    let metrics = service.getMetrics();
    expect(metrics.request_count).toBe(1);
    expect(metrics.average_request_duration_ms).toBe(100);

    service.incrementRequestCount();
    service.addRequestDuration(200);

    metrics = service.getMetrics();
    expect(metrics.request_count).toBe(2);
    expect(metrics.average_request_duration_ms).toBe(150); // (100 + 200) / 2
  });

  it('should increment OpenAI requests and failures', () => {
    service.incrementOpenAIRequests();
    service.incrementOpenAIFailures();

    const metrics = service.getMetrics();
    expect(metrics.openai_requests).toBe(1);
    expect(metrics.openai_failures).toBe(1);
  });

  it('should increment appointments created', () => {
    service.incrementAppointmentsCreated();
    
    const metrics = service.getMetrics();
    expect(metrics.appointments_created).toBe(1);
  });
});
