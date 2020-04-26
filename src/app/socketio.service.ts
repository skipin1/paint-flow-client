import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';

export interface Coordinate {
  x: number;
  y: number;
}

export interface Point {
  prevPos: Coordinate;
  currentPos: Coordinate;
}
@Injectable({
  providedIn: 'root'
})
export class SocketIOService {

  public data$ = this.socket.fromEvent<{data: Point}>('drawing');

  constructor(private socket: Socket) {}

  sendData(data: Point): void {
    this.socket.emit('drawing', {data});
  }
}
