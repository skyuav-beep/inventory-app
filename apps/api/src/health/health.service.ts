import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    database: {
      status: 'up' | 'down';
      latencyMs?: number;
      message?: string;
    };
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    const timestamp = new Date();
    const status: HealthStatus = {
      status: 'ok',
      timestamp: timestamp.toISOString(),
      services: {
        database: {
          status: 'up',
        },
      },
    };

    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      status.services.database.latencyMs = Date.now() - startedAt;
    } catch (error) {
      status.status = 'degraded';
      status.services.database.status = 'down';
      status.services.database.message =
        error instanceof Error ? error.message : 'Database health check failed';
    }

    return status;
  }
}
