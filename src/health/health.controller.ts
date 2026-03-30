import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../core/decorators/public.decorator';
import { PrismaService } from '../core/prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check (database + memory)' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'ok',
        info: {
          database: { status: 'up' },
          memory_heap: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          memory_heap: { status: 'up' },
        },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  check() {
    return this.health.check([
      async () => {
        await this.prisma.$queryRawUnsafe('SELECT 1');
        return { database: { status: 'up' } };
      },
      () => this.memory.checkHeap('memory_heap', 256 * 1024 * 1024),
    ]);
  }
}
