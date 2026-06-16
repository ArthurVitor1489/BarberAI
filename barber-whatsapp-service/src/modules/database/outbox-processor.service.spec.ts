import { OutboxProcessorService } from './outbox-processor.service';
import { PrismaService } from './prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('OutboxProcessorService', () => {
  let service: OutboxProcessorService;
  let prismaMock: any;
  let eventEmitterMock: any;

  beforeEach(() => {
    prismaMock = {
      eventOutbox: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    eventEmitterMock = {
      emitAsync: jest.fn(),
    };
    service = new OutboxProcessorService(
      prismaMock as unknown as PrismaService,
      eventEmitterMock as unknown as EventEmitter2,
    );
  });

  it('should process pending events successfully', async () => {
    const mockEvents = [
      {
        id: 'event-1',
        eventType: 'appointment.created.v1',
        payload: JSON.stringify({ appointmentId: 'appt-1' }),
        status: 'PENDING',
      },
    ];

    prismaMock.eventOutbox.findMany.mockResolvedValue(mockEvents);
    prismaMock.eventOutbox.update.mockResolvedValue({});
    eventEmitterMock.emitAsync.mockResolvedValue([]);

    await service.processOutbox();

    expect(prismaMock.eventOutbox.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });
    expect(eventEmitterMock.emitAsync).toHaveBeenCalledWith(
      'appointment.created.v1',
      { appointmentId: 'appt-1' },
    );
    expect(prismaMock.eventOutbox.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: expect.objectContaining({
        status: 'PROCESSED',
        processedAt: expect.any(Date),
      }),
    });
  });

  it('should mark events as FAILED if processing throws', async () => {
    const mockEvents = [
      {
        id: 'event-2',
        eventType: 'appointment.cancelled.v1',
        payload: JSON.stringify({ appointmentId: 'appt-2' }),
        status: 'PENDING',
      },
    ];

    prismaMock.eventOutbox.findMany.mockResolvedValue(mockEvents);
    eventEmitterMock.emitAsync.mockRejectedValue(new Error('Handler failed'));
    prismaMock.eventOutbox.update.mockResolvedValue({});

    await service.processOutbox();

    expect(eventEmitterMock.emitAsync).toHaveBeenCalled();
    expect(prismaMock.eventOutbox.update).toHaveBeenCalledWith({
      where: { id: 'event-2' },
      data: { status: 'FAILED' },
    });
  });
});
