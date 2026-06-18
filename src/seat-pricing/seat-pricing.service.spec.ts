import { Test, TestingModule } from '@nestjs/testing';
import { SeatPricingService } from './seat-pricing.service';

describe('SeatPricingService', () => {
  let service: SeatPricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeatPricingService],
    }).compile();

    service = module.get<SeatPricingService>(SeatPricingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
