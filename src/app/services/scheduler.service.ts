import { Injectable, Injector, Optional, SkipSelf } from "@angular/core";
import { BehaviorSubject, map, Observable, switchMap, tap, timer } from "rxjs";

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
  private static instance: SchedulerService;
  private currentState: SchedulerState = SchedulerState.REAL_TIME;
  private transmissionMultiplier: number = 1;
  private speedOfLightMultiplier: number = 1;
  private startTime: number = new Date().getTime();
  private startPause: number = 0;
  private listener: {delay: number, callback: BehaviorSubject<number>}[] = [];

  public get Transmission(): number {
    return this.transmissionMultiplier;
  }
  public get SpeedOfLight(): number {
    return this.speedOfLightMultiplier;
  }
  public get Speed(): SchedulerState {
    return this.currentState;
  }
  public set Speed(delay: SchedulerState) {
    let delta = this.getDeltaTime();

    switch (delay) {
      case SchedulerState.FASTER: {
        this.transmissionMultiplier = (100*1000);
        this.speedOfLightMultiplier = 10;
        break;
      }
      case SchedulerState.REAL_TIME: {
        this.transmissionMultiplier = 1;
        this.speedOfLightMultiplier = 1;
        break;
      }
      case SchedulerState.SLOWER: {
        this.transmissionMultiplier = 1 / (100*1000);
        this.speedOfLightMultiplier = 1 / 10;
        break;
      }
      case SchedulerState.PAUSED: {
        this.transmissionMultiplier = 0;
        this.speedOfLightMultiplier = 0;
        break;
      }
    }

    this.currentState = delay;
    // recalculate start time to compensate for the change in speed
    if( delay === SchedulerState.PAUSED ) {
      this.startTime = (new Date().getTime()) - delta;
      this.startPause = new Date().getTime();
    }
    else {
      this.startTime = (new Date().getTime()) - delta / this.speedOfLightMultiplier;
    }

    this.reset();
  }
  public get Timer$(): Observable<string> {
    return timer(1, 10).pipe(
      map(() => this.calculateStringTime()),
    );
  }

  public static get Instance(): SchedulerService {
    // TODO: check l'injection de dépendance dans les tests unitaires
    if( !SchedulerService.instance )
      SchedulerService.instance = new SchedulerService();
    return SchedulerService.instance;
  }
  constructor(@Optional() @SkipSelf() shared?: SchedulerService) {
    if (shared)
      throw new Error("SchedulerService is already provided");
    if( SchedulerService.instance )
      throw new Error("SchedulerService is already instancied");

    this.Speed = SchedulerState.SLOWER;
    SchedulerService.instance = this;
  }

  private calculateStringTime(): string {
    let deltaTime = this.getDeltaTime();
    let time = Math.floor(deltaTime / 100);
    let seconds = Math.floor(deltaTime / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    let str_miliseconds = (time % 10).toString().padStart(1, '0');
    let str_seconds = (seconds % 60).toString().padStart(2, '0');
    let str_minutes = (minutes % 60).toString().padStart(2, '0');
    let str_hours = (hours).toString().padStart(2, '0');

    let formated_string = '';
    if( hours > 0 )
      formated_string += `${str_hours}:`;

    formated_string += `${str_minutes}:${str_seconds}`;
    formated_string += `.${str_miliseconds}`;

    return formated_string;
  }

  private getDeltaTime(): number {
    if( this.currentState == SchedulerState.PAUSED ) {
      const timeSincePause = new Date().getTime() - this.startPause;

      return (new Date().getTime() - this.startTime) - timeSincePause;
    }
    return (new Date().getTime() - this.startTime) * this.speedOfLightMultiplier;
  }

  private getDelay(delay: number): number {
    if( this.currentState == SchedulerState.PAUSED )
      return 99999999999999; // Number.MAX_SAFE_INTEGER and Number.MAX_VALUE seems too big.
    return delay / this.speedOfLightMultiplier * 1000;
  }

  public once(delay: number): Observable<0> {
    return timer(this.getDelay(delay));
  }
  public repeat(delay: number): Observable<0> {
    const interval$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
    this.listener.push({delay: delay, callback: interval$});

    return interval$.pipe(
      switchMap((duration) => timer(duration)),
      tap(() =>  interval$.next(this.getDelay(delay)))
    );
  }
  private reset() {
    this.listener.map( i => {
      i.callback.next(  this.getDelay(i.delay)  );
    });
  }
}
