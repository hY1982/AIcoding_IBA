import { Test, TestingModule } from '@nestjs/testing';
import { IntentionsService } from './intentions.service';

describe('IntentionsService', () => {
  let service: IntentionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IntentionsService],
    }).compile();

    service = module.get<IntentionsService>(IntentionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
