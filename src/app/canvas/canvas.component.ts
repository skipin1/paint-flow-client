import { Coordinate } from './../socketio.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { fromEvent, merge, Subject } from 'rxjs';
import {
  bufferWhen,
  map,
  switchMap,
  takeUntil,
  takeWhile,
  pairwise,
} from 'rxjs/operators';
import { SocketIOService } from '../socketio.service';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent implements OnInit, OnDestroy {
  readonly limit = 2550;
  readonly lineCap = 'round';
  readonly maxWidth = 1024;
  readonly maxHeight = 768;
  // readonly scale = window.devicePixelRatio;
  readonly tmpCanvasName = 'tmp_canvas';
  lineWidth = 5;

  private tmpCanvas: HTMLCanvasElement;
  private tmpCtx: any;
  private ctx: any;

  private isComponentPresent: boolean;

  constructor(private socketService: SocketIOService) {

    this.socketService.data$
    .pipe(
      takeWhile(() => this.isComponentPresent)
    )
    .subscribe(({data}) => {
      // console.log('Get data is', data);
      if (data.length === 0) { return; }
      this.drawMe(this.tmpCtx, this.tmpCanvas, data, true);
      this.ctx.drawImage(this.tmpCanvas, 0, 0);
      this.tmpCtx.clearRect(0, 0, this.tmpCanvas.width, this.tmpCanvas.height);
    });
  }

  ngOnInit(): void {
    this.isComponentPresent = true;
    const canvas = this.initCanvas(false);
    canvas.width = this.maxWidth;
    canvas.height = this.maxHeight;
    this.ctx = this.initContext(canvas);
    // ctx.scale(this.scale, this.scale);
    const sketch = this.initSketch();
    this.tmpCanvas = this.initCanvas(true);
    this.tmpCtx = this.initContext(this.tmpCanvas);
    this.tmpCanvas.id = this.tmpCanvasName;
    this.tmpCanvas.width = canvas.width;
    this.tmpCanvas.height = canvas.height;
    this.tmpCanvas.style.position = 'absolute';
    this.tmpCanvas.style.left = '0';
    this.tmpCanvas.style.right = '0';
    this.tmpCanvas.style.bottom = '0';
    this.tmpCanvas.style.top = '0';
    this.tmpCanvas.style.cursor = 'crosshair';
    this.tmpCtx.lineJoin = this.tmpCtx.lineCap = this.lineCap;
    this.tmpCtx.lineWidth = this.lineWidth;
    sketch.appendChild(this.tmpCanvas);
    this.initMouseEvents(this.tmpCtx, this.tmpCanvas, this.ctx);
  }

  ngOnDestroy(): void {
    this.isComponentPresent = false;
  }

  initCanvas(create = false) {
    return create
      ? document.createElement('canvas')
      : document.querySelector('canvas');
  }

  initSketch() {
    return document.querySelector('#sketch');
  }

  initContext(canvas) {
    return canvas.getContext('2d');
  }

  initStream(mouseDown, mouseMove, mouseUp, mouseOut) {
    return mouseDown.pipe(
      switchMap(() => {
        return mouseMove.pipe(
          map((e: any) => ({
            x: e.touches ? e.touches[0].pageX : e.offsetX,
            y: e.touches ? e.touches[0].pageY : e.offsetY,
          })),
          takeUntil(mouseUp),
          takeUntil(mouseOut),
          pairwise(),
          map((e: [MouseEvent, MouseEvent]) => (this.updateCoordinates(e))),
        );
      })
    );
  }
  updateCoordinates(res) {
    const rect = this.tmpCanvas.getBoundingClientRect();
    const prevPos = {
      x: res[0].clientX - rect.left,
      y: res[0].clientY - rect.top
    };
    const currentPos = {
      x: res[1].clientX - rect.left,
      y: res[1].clientY - rect.top
    };
    return {
      prevPos,
      currentPos
    };
    // {
    //   x: e.touches ? e.touches[0].pageX : e.offsetX,
    //     y: e.touches ? e.touches[0].pageY : e.offsetY,
    // }
  }
  initBuffer(limitOfCount, mouseUp) {
    return new Subject().pipe(
      bufferWhen(() => merge(limitOfCount, mouseUp)),
      takeWhile(() => this.isComponentPresent)
    ) as Subject<Coordinate[]>;
  }

  initMouseEvents(context, canvas, realContext) {
    let points = [];
    const mouseMove = fromEvent(canvas, 'mousemove');
    const touchMove = fromEvent(canvas, 'touchmove', { passive: true });
    const mouseDown = fromEvent(canvas, 'mousedown');
    const touchDown = fromEvent(canvas, 'touchstart', { passive: true });
    const mouseUp = fromEvent(canvas, 'mouseup');
    const touchEnd = fromEvent(canvas, 'touchend');
    const mouseOut = fromEvent(canvas, 'mouseout');
    const touchOut = fromEvent(canvas, 'touchout');
    const mergeEventsStart = merge(mouseDown, touchDown);
    const mergeEventsMove = merge(mouseMove, touchMove);
    const mergeEventsUp = merge(mouseUp, touchEnd);
    const mergeEventOut = merge(mouseOut);
    const limitOfCount: Subject<boolean> = new Subject();
    const stream = this.initStream(
      mergeEventsStart,
      mergeEventsMove,
      mergeEventsUp,
      mergeEventOut
    );
    const dataBuffer = this.initBuffer(limitOfCount, mergeEventsUp);
    dataBuffer.pipe(
      takeWhile(() => this.isComponentPresent)
    ).subscribe((coordArr: Coordinate[]) => {
      this.socketService.sendData(coordArr);
      // points = this.clearCanvas(context, canvas, realContext);
    });

    mouseUp.pipe(
      takeWhile(() => this.isComponentPresent)
    ).subscribe(() => points = this.clearCanvas(context, canvas, realContext));

    stream.pipe(
      takeWhile(() => this.isComponentPresent)
    ).subscribe((res) => {
      points.push(res);
      if (points.length % this.limit === 0) {
        limitOfCount.next(true);
      }
      // console.log('Points is', points);
      this.drawMe(context, canvas, points);
      dataBuffer.next(res);
    });
  }
  drawMe(context, canvas, points, realContext = false) {
    context.beginPath();
    if (points.prevPos) {
      context.moveTo(points.prevPos.x, points.prevPos.y);
      context.lineTo(points.currentPos.x, points.currentPos.y);
      context.stroke();
    }
    if (realContext) {
      context.closePath();
      return this.clearCanvas(context, canvas, realContext);
    }
  }
  clearCanvas(context, canvas, realContext = null) {
    if (realContext !== null) {
      realContext.drawImage(canvas, 0, 0);
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    return [];
  }
}
