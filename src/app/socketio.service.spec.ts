import { TestBed } from '@angular/core/testing';

import { SocketIOService } from './socketio.service';

describe('SocketioService', () => {
  let service: SocketIOService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocketIOService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
