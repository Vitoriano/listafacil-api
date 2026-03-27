import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          url: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
        }),
        ttl: 60_000,
      }),
      isGlobal: true,
    }),
  ],
})
export class RedisModule {}
