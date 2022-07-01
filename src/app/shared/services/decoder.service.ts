import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "src/environments/environment";

@Injectable(
  { providedIn: "root" }
)
export class DecoderService {


  constructor(private http: HttpClient) {}

  public decode(file: File): Observable<JSON> {
    const formData = new FormData();
    formData.append("file", file);
    return this.http.post<JSON>(environment.backend + "/decode", formData);
  }
}
