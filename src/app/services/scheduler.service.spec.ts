import { SchedulerService, SchedulerState } from './scheduler.service';
import { bufferCount, map, mapTo, take, timeout, zip } from 'rxjs';

describe('scheduler', () => {
  let service: SchedulerService;
  const delay = 0.1;

  beforeEach(() => {
    service = SchedulerService.Instance;
    service.Speed = SchedulerState.REAL_TIME;
  });

  it('should be slower than realtime', (done) => {
    service.Speed = SchedulerState.SLOWER;

    const start = new Date().getTime();
    service.once(delay).subscribe( (data) => {
      const delta = new Date().getTime() - start;
      expect(delta).toBeGreaterThan(delay*1000);
      expect(service.SpeedOfLight).toBeLessThan(1);
      expect(service.Transmission).toBeLessThan(1);
      expect(service.Speed).toBe(SchedulerState.SLOWER);

      done();
    });


  });

  it('should be realtime', (done) => {
    service.Speed = SchedulerState.REAL_TIME;

    const start = new Date().getTime();
    service.once(delay).subscribe( () => {
      const delta = new Date().getTime() - start;
      expect(delta).toBeGreaterThan(delay * 1000 * 0.75);
      expect(delta).toBeLessThan(delay * 1000 * 1.25);
      expect(service.SpeedOfLight).toBe(1);
      expect(service.Transmission).toBe(1);
      expect(service.Speed).toBe(SchedulerState.REAL_TIME);

      done();
    });
  });

  it('should be faster than realtime', (done) => {
    service.Speed = SchedulerState.FASTER;

    const start = new Date().getTime();
    service.once(delay).subscribe( () => {
      const delta = new Date().getTime() - start;
      expect(delta).toBeLessThan(delay * 1000);
      expect(service.SpeedOfLight).toBeGreaterThan(1);
      expect(service.Transmission).toBeGreaterThan(1);
      expect(service.Speed).toBe(SchedulerState.FASTER);

      done();
    });
  });

  it('should be paused', (done) => {

    service.Speed = SchedulerState.REAL_TIME;
    service.Speed = SchedulerState.PAUSED;

    service
      .once(delay)
      .pipe(timeout(delay * 2 * 1000))
      .subscribe(  {
        next: () => {
          expect(true).toBeFalsy();
        },
        error: (err) => {
          expect(err).toBeTruthy();
          expect(service.SpeedOfLight).toBe(0);
          expect(service.Transmission).toBe(0);
          expect(service.Speed).toBe(SchedulerState.PAUSED);
          done();
        },
      });
  });

  it('should be able to pause and resume', (done) => {
    service.Speed = SchedulerState.PAUSED;

    service.once(delay).subscribe( () => {
      expect(true).toBeTruthy();
      done();
    });

    service.Speed = SchedulerState.REAL_TIME;
  });

  it('should have an interval faster than a second', (done) => {
    service.Speed = SchedulerState.FASTER;

    service.Timer$.pipe(
      take(2),
      map( (time: string) => {
        const split = time.split(':');
        return parseInt(split[0], 10) * 60 + parseFloat(split[1]);
      }),
      bufferCount(2),
    ).subscribe( (deltas) => {
      const delta = deltas[1] - deltas[0];
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeLessThan(1);
      done();
    });
  });


});
