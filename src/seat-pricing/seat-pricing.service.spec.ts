import { Test, TestingModule } from '@nestjs/testing';
import { SeatPricingService } from './seat-pricing.service';
import { RedisService } from '../redis/redis.service';

describe('SeatPricingService', () => {
  let service: SeatPricingService;

  const mockRedis = {
    isReady: jest.fn(() => true),
    getJson: jest.fn(async () => null),
    setJson: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
    getOrSet: jest.fn(async (_key: string, _ttl: number, loader: () => unknown) =>
      loader(),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatPricingService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SeatPricingService>(SeatPricingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
