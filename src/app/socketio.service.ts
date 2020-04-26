import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';

export interface Coordinate {
  x: number;
  y: number;
}
@Injectable({
  providedIn: 'root'
})
export class SocketIOService {

  public data$ = this.socket.fromEvent<{data: Coordinate[]}>('drawing');

  constructor(private socket: Socket) {}

  sendData(data: Coordinate[]): void {
    this.socket.emit('drawing', {data});
  }
}
