import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, Subject, switchMap, tap, timer } from "rxjs";

export enum SchedulerState {
  FASTER,
  REAL_TIME,
  SLOWER,
  PAUSED
}

@Injectable(
  { providedIn: "root" }
)
export class SchedulerService {
  private static STATE: SchedulerState = SchedulerState.REAL_TIME;
  private static TRANSMISSION_MULTIPLIER: number = 1;
  private static SPEED_OF_LIGHT_MULTIPLIER: number = 1;
  private static startTime: number = new Date().getTime();

  public static get Transmission(): number {
    return SchedulerService.TRANSMISSION_MULTIPLIER;
  }
  public static get SpeedOfLight(): number {
    return SchedulerService.SPEED_OF_LIGHT_MULTIPLIER;
  }
  public static get Speed(): SchedulerState {
    return SchedulerService.STATE;
  }
  public static set Speed(delay: SchedulerState) {
    let delta = SchedulerService.Time;

    switch (delay) {
      case SchedulerState.FASTER: {
        SchedulerService.TRANSMISSION_MULTIPLIER = (1000*1000);
        SchedulerService.SPEED_OF_LIGHT_MULTIPLIER = 10;
        break;
      }
      case SchedulerState.REAL_TIME: {
        SchedulerService.TRANSMISSION_MULTIPLIER = 1;
        SchedulerService.SPEED_OF_LIGHT_MULTIPLIER = 1;
        break;
      }
      case SchedulerState.SLOWER: {
        SchedulerService.TRANSMISSION_MULTIPLIER = 1 / (1000*1000);
        SchedulerService.SPEED_OF_LIGHT_MULTIPLIER = 1 / 10;
        break;
      }
      case SchedulerState.PAUSED: {
        SchedulerService.TRANSMISSION_MULTIPLIER = 0;
        SchedulerService.SPEED_OF_LIGHT_MULTIPLIER = 0;
        break;
      }
    }

    SchedulerService.STATE = delay;
    SchedulerService.reset();
    // recalculate start time to compensate for the change in speed
    SchedulerService.startTime = (new Date().getTime()) - delta / SchedulerService.SPEED_OF_LIGHT_MULTIPLIER;

  }

  public static get Time(): number {
    let delta_time = (new Date().getTime() - SchedulerService.startTime) * SchedulerService.SPEED_OF_LIGHT_MULTIPLIER;

    return delta_time;
  }

  private static listener: {delay: number, callback: BehaviorSubject<number>}[] = [];

  constructor() {
  }

  private static getDelay(delay: number): number {
    if( SchedulerService.STATE == SchedulerState.PAUSED )
      return 99999999999999; // Number.MAX_SAFE_INTEGER and Number.MAX_VALUE seems too big.
    return delay / SchedulerService.SPEED_OF_LIGHT_MULTIPLIER * 1000;
  }

  public static once(delay: number): Observable<0> {
    return timer(SchedulerService.getDelay(delay));
  }
  public static repeat(delay: number): Observable<0> {
    const interval$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
    SchedulerService.listener.push({delay: delay, callback: interval$});

    return interval$.pipe(
      switchMap((duration) => timer(duration)),
      tap(() =>  interval$.next(SchedulerService.getDelay(delay)))
    );
  }
  private static reset() {
    SchedulerService.listener.map( i => {
      i.callback.next(  SchedulerService.getDelay(i.delay)  );
    });
  }
}
