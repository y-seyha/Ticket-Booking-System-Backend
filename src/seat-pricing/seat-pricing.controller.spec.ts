import { Test, TestingModule } from '@nestjs/testing';
import { SeatPricingController } from './seat-pricing.controller';

describe('SeatPricingController', () => {
  let controller: SeatPricingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeatPricingController],
    }).compile();

    controller = module.get<SeatPricingController>(SeatPricingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
