import { Coordinate } from './../socketio.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { fromEvent, merge, Subject } from 'rxjs';
import {
  bufferWhen,
  map,
  switchMap,
  takeUntil,
  takeWhile,
} from 'rxjs/operators';
import { SocketIOService } from '../socketio.service';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent implements OnInit, OnDestroy {
  readonly limit = 50;
  readonly lineCap = 'round';
  readonly maxWidth = 1024;
  readonly maxHeight = 768;
  readonly scale = window.devicePixelRatio;
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
          takeUntil(mouseOut)
        );
      })
    );
  }

  initBuffer(limitOfCount: Subject<boolean>, mouseUp) {
    return new Subject()
    .pipe(
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

  drawMe(context, canvas, points, emitted = false) {
    if (!this.checkPointsArray(context, points.length, points[0])) {
      this.clearCanvas(context, canvas); // TODO implicit return.
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      let i = 0;
      for (i = 1; i < points.length - 2; i++) {
        const c = (points[i].x + points[i + 1].x) / 2;
        const d = (points[i].y + points[i + 1].y) / 2;
        context.quadraticCurveTo(points[i].x, points[i].y, c, d);
      }
      context.quadraticCurveTo(
        points[i].x,
        points[i].y,
        points[i + 1].x,
        points[i + 1].y
      );
      context.stroke();
    }
  }
  checkPointsArray(context, size, point) {
    if (size < 3) {
      context.beginPath();
      context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2, !0);
      context.fill();
      context.closePath();
      return true;
    }
    return false;
  }
  clearCanvas(context, canvas, realContext = null) {
    if (realContext !== null) {
      realContext.drawImage(canvas, 0, 0);
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    return [];
  }
}
