export class ArrowMarker {
    constructor(time, price, direction, color = '#00FF00') {
        this._time = time;
        this._price = price;
        this._direction = direction;
        this._color = color;

        this._view = new ArrowMarkerView(this);
    }

    paneViews() {
        return [this._view];
    }

    priceAxisViews() {
        return [];
    }
}

class ArrowMarkerView {
    constructor(model) {
        this._model = model;
        this._renderer = new ArrowMarkerRenderer(model);
    }

    update(info) {
        this._renderer.update(info);
    }

    renderer() {
        return this._renderer;
    }
}

class ArrowMarkerRenderer {
    constructor(model) {
        this._model = model;
    }

    update(info) {
        this._info = info;
    }

    draw(target) {
        if (!this._info) return;

        const ctx = target.useBitmapCoordinateSpace();
        const { timeScale, priceScale } = this._info;

        const x = timeScale.timeToCoordinate(this._model._time);
        const y = priceScale.priceToCoordinate(this._model._price);

        if (x == null || y == null) return;

        ctx.save();
        ctx.fillStyle = this._model._color;

        const w = 8, h = 14;

        if (this._model._direction === 'up') {
            ctx.beginPath();
            ctx.moveTo(x, y - h);
            ctx.lineTo(x - w, y);
            ctx.lineTo(x + w, y);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(x, y + h);
            ctx.lineTo(x - w, y);
            ctx.lineTo(x + w, y);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}
