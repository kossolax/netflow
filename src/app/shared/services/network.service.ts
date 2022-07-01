import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, map, Observable } from "rxjs";
import { environment } from "src/environments/environment";
import { Network } from "../models/network.model";

@Injectable(
  { providedIn: "root" }
)
export class NetworkService {
  private _network$ = new BehaviorSubject<Network|null>(null);
  get network$(): Observable<Network|null> {
    return this._network$.asObservable();
  }

  constructor(private http: HttpClient) {}

  public decode(file: File): Observable<Network> {
    const formData = new FormData();
    formData.append("file", file);

    return this.http.post<JSON>(environment.backend + "/decode", formData).pipe(
      map(json => Network.fromPacketTracer(json))
    );
  }
  public setNetwork(network: Network): void {
    this._network$.next(network);
  }
}
