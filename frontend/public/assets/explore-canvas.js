// Explore Canvas (ported from halvaa/script.js)
// Important: this module is fully scoped to #exploreCanvas and does NOT attach global touch/mouse listeners.
// It also cooperates with the main tabs swiper by disabling swipe while dragging the canvas.

(() => {
  class ExploreCanvas {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');

      this.getPeople = opts.getPeople || (() => []);
      this.onPersonClick = opts.onPersonClick || (() => {});
      this.onDragStateChange = opts.onDragStateChange || (() => {});

      // Tunables (close to original)
      this.HORIZONTAL = opts.HORIZONTAL ?? 20;
      this.VERTICAL = opts.VERTICAL ?? 20;
      this.RADIUS = opts.RADIUS ?? 58;
      this.PADDINGX = opts.PADDINGX ?? 6;
      this.PADDINGY = opts.PADDINGY ?? 6;
      this.SCALE_FACTOR = opts.SCALE_FACTOR ?? 420;

      this.offsetX = 0;
      this.offsetY = 0;
      this.oldOffsetX = 0;
      this.oldOffsetY = 0;
      this.centerX = 0;
      this.centerY = 0;

      this.pointerDown = false;
      this.dragging = false;
      this.startX = 0;
      this.startY = 0;
      this.lastX = 0;
      this.lastY = 0;
      this.dragThreshold = 6;

      this.circles = [];
      this.loadedImages = [];
      this.raf = null;
      this.active = true;

      this._onPointerDown = this._onPointerDown.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp = this._onPointerUp.bind(this);
      this._onResize = this._onResize.bind(this);

      this._attach();
      this._onResize();
      this.rebuild();
      this.start();
    }

    _attach() {
      this.canvas.style.touchAction = 'none'; // prevent browser gestures on the canvas area
      this.canvas.addEventListener('pointerdown', this._onPointerDown);
      this.canvas.addEventListener('pointermove', this._onPointerMove);
      this.canvas.addEventListener('pointerup', this._onPointerUp);
      this.canvas.addEventListener('pointercancel', this._onPointerUp);
      window.addEventListener('resize', this._onResize, { passive: true });
    }

    destroy() {
      this.stop();
      window.removeEventListener('resize', this._onResize);
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
      this.canvas.removeEventListener('pointerup', this._onPointerUp);
      this.canvas.removeEventListener('pointercancel', this._onPointerUp);
      this.circles = [];
      this.loadedImages = [];
    }

    setActive(isActive) {
      this.active = !!isActive;
      if (this.active) this.start();
      else this.stop();
    }

    start() {
      if (this.raf) return;
      const loop = () => {
        this.raf = requestAnimationFrame(loop);
        if (!this.active) return;
        this.draw();
      };
      this.raf = requestAnimationFrame(loop);
    }

    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    _onResize() {
      // Size the canvas to its container
      const shell = this.canvas.parentElement;
      const rect = shell ? shell.getBoundingClientRect() : this.canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      // HiDPI
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.centerX = width / 2;
      this.centerY = height / 2;

      this._recenterOffsets(width, height);
    }

    _recenterOffsets(width, height) {
      // Similar to original: center the overall grid
      const gridW =
        this.RADIUS * 2 * this.HORIZONTAL +
        this.PADDINGX * (this.HORIZONTAL - 1) +
        this.RADIUS +
        this.PADDINGX / 2;
      const gridH = this.RADIUS * 2 * this.VERTICAL + this.PADDINGY * (this.VERTICAL - 1);

      this.offsetX = (width - gridW) / 2 + this.RADIUS;
      this.offsetY = (height - gridH) / 2 + this.RADIUS;
      this.oldOffsetX = this.offsetX;
      this.oldOffsetY = this.offsetY;
    }

    rebuild() {
      this.circles = [];
      this.loadedImages = [];

      const people = this.getPeople() || [];
      const total = this.HORIZONTAL * this.VERTICAL;

      // Preload images
      for (let idx = 0; idx < total; idx++) {
        const img = new Image();
        const person = people[idx % Math.max(1, people.length)] || {};
        const src = person.image || person.photo || `https://i.pravatar.cc/300?img=${(idx % 70) + 1}`;
        img.src = src;
        this.loadedImages.push(img);
      }

      // Build circle grid (ported logic)
      let localX = 0;
      let localY = 0;

      for (let row = 0; row < this.VERTICAL; row++) {
        for (let col = 0; col < this.HORIZONTAL; col++) {
          const i = row * this.HORIZONTAL + col;
          const person = people[i % Math.max(1, people.length)] || {};
          this.circles.push({
            x: localX,
            y: localY,
            image: this.loadedImages[i],
            person,
            id: person.id ?? i,
          });
          localX += this.RADIUS * 2 + this.PADDINGX;
        }

        if (row % 2 === 0) localX = this.PADDINGX / 2 + this.RADIUS;
        else localX = 0;
        localY += this.RADIUS * 2 + this.PADDINGY;
      }
    }

    _getScale(circle) {
      const dx = circle.x - this.centerX + this.offsetX;
      const dy = circle.y - this.centerY + this.offsetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let scale = 1 - dist / this.SCALE_FACTOR;
      if (scale < 0) scale = 0;
      return scale;
    }

    draw() {
      const ctx = this.ctx;
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.translate(this.offsetX, this.offsetY);

      for (let i = 0; i < this.circles.length; i++) {
        const c = this.circles[i];
        const scale = this._getScale(c);
        if (scale <= 0) continue;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(scale, scale);

        // circular clip
        ctx.beginPath();
        ctx.arc(0, 0, this.RADIUS, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const img = c.image;
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -this.RADIUS, -this.RADIUS, this.RADIUS * 2, this.RADIUS * 2);
        } else {
          ctx.fillStyle = '#f2f2f2';
          ctx.fillRect(-this.RADIUS, -this.RADIUS, this.RADIUS * 2, this.RADIUS * 2);
        }

        ctx.restore();
      }

      ctx.restore();
    }

    _canvasToWorld(px, py) {
      // translate to grid space (before offset)
      return { x: px - this.offsetX, y: py - this.offsetY };
    }

    _hitTest(px, py) {
      const p = this._canvasToWorld(px, py);
      for (let i = 0; i < this.circles.length; i++) {
        const c = this.circles[i];
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = this._getScale(c);
        const r = this.RADIUS * scale;
        if (dist <= r && c.person && (c.person.name || c.person.id)) {
          return c.person;
        }
      }
      return null;
    }

    _onPointerDown(e) {
      this.pointerDown = true;
      this.dragging = false;
      const rect = this.canvas.getBoundingClientRect();
      this.startX = e.clientX - rect.left;
      this.startY = e.clientY - rect.top;
      this.lastX = this.startX;
      this.lastY = this.startY;
      this.oldOffsetX = this.offsetX;
      this.oldOffsetY = this.offsetY;
      this.canvas.setPointerCapture(e.pointerId);
      this.onDragStateChange(true);
    }

    _onPointerMove(e) {
      if (!this.pointerDown) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const dx = x - this.startX;
      const dy = y - this.startY;
      if (!this.dragging && (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold)) {
        this.dragging = true;
      }

      this.offsetX = this.oldOffsetX + dx;
      this.offsetY = this.oldOffsetY + dy;

      this.lastX = x;
      this.lastY = y;
    }

    _onPointerUp(e) {
      if (!this.pointerDown) return;
      this.pointerDown = false;
      this.onDragStateChange(false);
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}

      // click (no drag)
      if (!this.dragging) {
        const person = this._hitTest(this.lastX, this.lastY);
        if (person) this.onPersonClick(person);
      }
    }
  }

  // Public hookup used by halvaa-app.js
  window.HalvaaExploreCanvas = {
    instance: null,
    init({ memorials, onPersonClick, onDragStateChange }) {
      const canvas = document.getElementById('exploreCanvas');
      if (!canvas) return;
      if (this.instance) this.instance.destroy();

      this.instance = new ExploreCanvas(canvas, {
        getPeople: () => memorials || [],
        onPersonClick,
        onDragStateChange,
      });

      // Start paused by default; main app will activate on Explore tab.
      this.instance.setActive(false);
    },
    setActive(isActive) {
      if (this.instance) this.instance.setActive(isActive);
    },
    rebuild(memorials) {
      if (this.instance) {
        this.instance.getPeople = () => memorials || [];
        this.instance.rebuild();
      }
    },
  };
})();



