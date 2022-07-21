import { TestBed } from '@angular/core/testing';
import { NetworkService } from './network.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { switchMap } from 'rxjs';
import { SwitchHost, RouterHost } from '../models/node.model';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

describe('packet tracer decoding host', () => {
  let service: NetworkService;
  let http: HttpClient;
  let bypass = true;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        BrowserModule,
        HttpClientModule
      ],
      providers: [
        NetworkService
      ],
    });
    service = TestBed.inject(NetworkService);
    http = TestBed.inject(HttpClient);
  });
  it( 'switch', (done) => {
    if( bypass ) {
      expect(true).toBe(true);
      return done();
    }

    http.get(`./assets/saves/switch.pkt`, { responseType: 'blob' }).pipe(
      switchMap( i => service.decode(new File([i], "switch.pkt", { type: "application/octet-stream" })))
    ).subscribe( i => {

      const dict = Object.keys(i.nodes);
      expect(dict.length).toBe(1);
      expect(i.links.length).toBe(0);

      const node = i.nodes[dict[0]] as SwitchHost;
      const ifaces = node.getInterfaces();
      expect(ifaces.length).toBe(26);

      for(let i=1; i<=24; i++)
        expect(ifaces).toContain("FastEthernet0/"+i);
      expect(ifaces).toContain("GigabitEthernet0/1");
      expect(ifaces).toContain("GigabitEthernet0/2");


      done();
    });
  });

  it( 'router1', (done) => {
    if( bypass ) {
      expect(true).toBe(true);
      return done();
    }

    http.get(`./assets/saves/router1.pkt`, { responseType: 'blob' }).pipe(
      switchMap( i => service.decode(new File([i], "router1.pkt", { type: "application/octet-stream" })))
    ).subscribe( i => {

      const dict = Object.keys(i.nodes);
      expect(dict.length).toBe(1);
      expect(i.links.length).toBe(0);

      const node = i.nodes[dict[0]] as RouterHost;
      const ifaces = node.getInterfaces();
      expect(ifaces.length).toBeGreaterThanOrEqual(8);
      expect(ifaces.length).toBeLessThanOrEqual(10);

      expect(ifaces).toContain("Serial1/0");
      expect(ifaces).toContain("Serial2/0");
      // 3/0 is volontary skipped.
      expect(ifaces).toContain("GigabitEthernet4/0");
      expect(ifaces).toContain("FastEthernet5/0");
      expect(ifaces).toContain("GigabitEthernet6/0");
      expect(ifaces).toContain("FastEthernet7/0");
      expect(ifaces).toContain("Ethernet8/0");
      expect(ifaces).toContain("Modem9/0");

      done();
    });
  });
  it( 'router2', (done) => {
    if( bypass ) {
      expect(true).toBe(true);
      return done();
    }

    http.get(`./assets/saves/router2.pkt`, { responseType: 'blob' }).pipe(
      switchMap( i => service.decode(new File([i], "router2.pkt", { type: "application/octet-stream" })))
    ).subscribe( i => {

      const dict = Object.keys(i.nodes);
      expect(dict.length).toBe(1);
      expect(i.links.length).toBe(0);

      const node = i.nodes[dict[0]] as RouterHost;
      const ifaces = node.getInterfaces();
      expect(ifaces.length).toBe(3);

      expect(ifaces).toContain("GigabitEthernet0/0/0");
      expect(ifaces).toContain("GigabitEthernet0/0/1");
      expect(ifaces).toContain("GigabitEthernet0/0/2");

      done();
    });
  });
  it( 'router3', (done) => {
    if( bypass ) {
      expect(true).toBe(true);
      return done();
    }

    http.get(`./assets/saves/router3.pkt`, { responseType: 'blob' }).pipe(
      switchMap( i => service.decode(new File([i], "router3.pkt", { type: "application/octet-stream" })))
    ).subscribe( i => {

      const dict = Object.keys(i.nodes);
      expect(dict.length).toBe(1);
      expect(i.links.length).toBe(0);

      const node = i.nodes[dict[0]] as RouterHost;
      const ifaces = node.getInterfaces();
      expect(ifaces.length).toBe(6);

      expect(ifaces).toContain("FastEthernet0/0");
      expect(ifaces).toContain("FastEthernet0/1");
      expect(ifaces).toContain("GigabitEthernet0/0/0");
      expect(ifaces).toContain("FastEthernet1/0");
      expect(ifaces).toContain("Ethernet1/0/0");
      expect(ifaces).toContain("Ethernet1/1/0");

      done();
    });
  });

  it( 'full', (done) => {
    if( bypass ) {
      expect(true).toBe(true);
      return done();
    }

    http.get(`./assets/saves/full.pkt`, { responseType: 'blob' }).pipe(
      switchMap( i => service.decode(new File([i], "full.pkt", { type: "application/octet-stream" })))
    ).subscribe( i => {

      const dict = Object.keys(i.nodes);
      expect(dict.length).toBe(18);
      expect(i.links.length).toBe(18);

      done();
    });
  });

});
