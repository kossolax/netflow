import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Subject, map, Observable } from "rxjs";
import { environment } from "src/environments/environment";
import { Network } from "../models/network.model";
import { GenericNode } from "../models/node.model";
import { AbstractLink } from "../models/layers/physical.model";

@Injectable(
  { providedIn: "root" }
)
export class NetworkService {
  private _network$ = new Subject<Network>();
  private _node$ = new Subject<GenericNode|AbstractLink|null>();
  get network$(): Observable<Network> {
    return this._network$.asObservable();
  }
  get node$(): Observable<GenericNode|AbstractLink|null> {
    return this._node$.asObservable();
  }

  constructor(private http: HttpClient) {}

  public decode(file: File): Observable<Network> {
    const formData = new FormData();
    formData.append("file", file);

    return this.http.post<JSON>(`${environment.backend}/decode`, formData).pipe(
      map(json => Network.fromPacketTracer(json))
    );
  }
  public setNetwork(network: Network): void {
    this._network$.next(network);
  }
  public setNode(node: GenericNode|AbstractLink|null) {
    this._node$.next(node);
  }
}
