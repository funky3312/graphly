/* ============================================================================
   🎬 Graphly 첫 접속자 전용 3탭 핵심 가이드 애니메이션 모듈 (app-intro.js)
   - 기존 수학·필기·녹화·뷰어·클라우드 코어 엔진 개입 0% 완전 독립 샌드박스
   - 모달이 닫혀 있을 때 requestAnimationFrame 루프 완전 정지 (CPU/GPU 점유 0%)
   ============================================================================ */
(function () {
  'use strict';

  try {
    const INTRO_STORAGE_KEY = 'graphly_intro_seen_v1';

    // 이미 Graphly를 사용한 이력이 있는 기존 사용자 판별용 로컬 스토리지 키 목록
    const EXISTING_USER_TRACE_KEYS = [
      'graphly_active_session_user_v2',
      'graphly_last_auth_provider',
      'graphly_guest_device_id_v1',
      'graphly_custom_shortcuts_v1',
      'graphly_pen_color_v1',
      'graphly_highlighter_color_v1',
      'graphly_ink_size_v1',
      'graphly_ink_pen_style_v1',
      'graphly_board_paper_v1',
      'graphly_last_pdf_view_state_v1',
      'graphly_show_axis_labels_v1'
    ];

    function isSharedOrSpecialEntryUrl() {
      try {
        if (document.documentElement.classList.contains('shared-viewer-booting')) return true;
        const combined = (window.location.hash || '') + '&' + (window.location.search || '');
        if (/(?:#|&|\?)(?:cloud|share|student|view|paymentKey|orderId|auth)=/i.test(combined)) {
          return true;
        }
        if (window._isPureSharedViewerSession) return true;
      } catch (_) {}
      return false;
    }

    function hasPriorVisitOrUsageHistory() {
      try {
        if (localStorage.getItem(INTRO_STORAGE_KEY) === '1') return true;
        for (let i = 0; i < EXISTING_USER_TRACE_KEYS.length; i++) {
          const val = localStorage.getItem(EXISTING_USER_TRACE_KEYS[i]);
          if (val !== null && val !== '') {
            localStorage.setItem(INTRO_STORAGE_KEY, '1');
            return true;
          }
        }
      } catch (_) {
        // 시크릿/스토리지 차단 환경에서도 오류 없이 안전 동작
      }
      return false;
    }

    function markIntroAsSeen() {
      try {
        localStorage.setItem(INTRO_STORAGE_KEY, '1');
      } catch (_) {}
    }

    // 스크립트 로드 즉시(비동기 IDB 복원 등이 돌기 전) 최초 방문 여부를 스냅샷 판정
    const shouldAutoOpenOnBoot = !isSharedOrSpecialEntryUrl() && !hasPriorVisitOrUsageHistory();

    // 수학 & 이징 유틸리티
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeInOutCubic = (t) => {
      const x = clamp(t, 0, 1);
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    };
    const easeOutBack = (t) => {
      const x = clamp(t, 0, 1);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    };
    const subProgress = (t, t0, t1) => clamp((t - t0) / Math.max(0.0001, t1 - t0), 0, 1);

    function roundRectPath(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    const SVG_PATHS = typeof Path2D === 'function' ? {
      fPlusCurve: new Path2D('M13.6 4.6C12 3.6 9.9 4.4 9.4 6.8L7.4 17.2C6.9 19.5 5.2 20.3 3.6 19.4'),
      folder: new Path2D('M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'),
      cloud: new Path2D('M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'),
      fullscreen: new Path2D('M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'),
      exportTray: new Path2D('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'),
      penBody: new Path2D('M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'),
      lightning: new Path2D('M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 Z'),
      dropPin: new Path2D('M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z'),
      stampBody: new Path2D('M19 16v-1a2 2 0 0 0-2-2h-2.5a1.5 1.5 0 0 1-1.5-1.5V8a2 2 0 1 0-4 0v3.5A1.5 1.5 0 0 1 7.5 13H5a2 2 0 0 0-2 2v1h16Z')
    } : null;

    function drawGraphlyIcon(ctx, kind, cx, cy, size, color) {
      if (!SVG_PATHS) return;
      ctx.save();
      const s = (size || 16.5) / 24;
      ctx.translate(cx - 12 * s, cy - 12 * s);
      ctx.scale(s, s);
      ctx.strokeStyle = color || '#64748b';
      ctx.fillStyle = color || '#64748b';
      ctx.lineWidth = 1.9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (kind === 'fplus') {
        ctx.lineWidth = 2.1;
        ctx.stroke(SVG_PATHS.fPlusCurve);
        ctx.beginPath();
        ctx.moveTo(5.4, 11.2); ctx.lineTo(12.2, 11.2);
        ctx.moveTo(18.2, 4.5); ctx.lineTo(18.2, 10.1);
        ctx.moveTo(15.4, 7.3); ctx.lineTo(21.0, 7.3);
        ctx.stroke();
      } else if (kind === 'folder') {
        ctx.stroke(SVG_PATHS.folder);
      } else if (kind === 'cloud') {
        ctx.stroke(SVG_PATHS.cloud);
      } else if (kind === 'fullscreen') {
        ctx.stroke(SVG_PATHS.fullscreen);
      } else if (kind === 'export') {
        ctx.stroke(SVG_PATHS.exportTray);
        ctx.beginPath();
        ctx.moveTo(17, 8); ctx.lineTo(12, 3); ctx.lineTo(7, 8);
        ctx.moveTo(12, 3); ctx.lineTo(12, 15);
        ctx.stroke();
      } else if (kind === 'pen') {
        ctx.stroke(SVG_PATHS.penBody);
        ctx.beginPath();
        ctx.moveTo(15, 5); ctx.lineTo(19, 9);
        ctx.stroke();
      } else if (kind === 'intersect') {
        ctx.stroke(SVG_PATHS.lightning);
      } else if (kind === 'dropline') {
        ctx.stroke(SVG_PATHS.dropPin);
        ctx.beginPath();
        ctx.arc(12, 10, 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === 'stamp') {
        ctx.stroke(SVG_PATHS.stampBody);
        ctx.beginPath();
        ctx.moveTo(5, 21); ctx.lineTo(19, 21);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(12, 12, 3.2, 0, Math.PI * 2);
        ctx.globalAlpha = 0.35;
        ctx.fill();
      }
      ctx.restore();
    }

    function evalCursorTimeline(keyframes, t) {
      if (!keyframes.length) return { x: 400, y: 220, mode: 'arrow', down: false };
      if (t <= keyframes[0].t) return Object.assign({}, keyframes[0]);
      for (let i = 0; i < keyframes.length - 1; i++) {
        const a = keyframes[i];
        const b = keyframes[i + 1];
        if (t >= a.t && t <= b.t) {
          const u = easeInOutCubic((t - a.t) / Math.max(0.0001, b.t - a.t));
          return {
            x: lerp(a.x, b.x, u),
            y: lerp(a.y, b.y, u),
            mode: u > 0.85 ? (b.mode || 'arrow') : (a.mode || 'arrow'),
            down: Boolean(a.holdDrag)
          };
        }
      }
      return Object.assign({}, keyframes[keyframes.length - 1]);
    }

    function evalQuarticRaw(x, r1, r2, r3, a, c) {
      const s1 = r1 + r2 + r3;
      const s2 = r1 * r2 + r2 * r3 + r3 * r1;
      const s3 = r1 * r2 * r3;
      const x2 = x * x;
      const x3 = x2 * x;
      const x4 = x2 * x2;
      return a * (x4 - (4 / 3) * s1 * x3 + 2 * s2 * x2 - 4 * s3 * x) + c;
    }

    function findCurveLineIntersections(fnY, lineY, xMin, xMax) {
      const N = 800;
      const dx = (xMax - xMin) / N;
      const roots = [];
      let prevX = xMin;
      let prevD = fnY(prevX) - lineY(prevX);

      for (let i = 1; i <= N; i++) {
        const currX = xMin + i * dx;
        const currD = fnY(currX) - lineY(currX);

        if (Math.abs(currD) < 1e-5) {
          roots.push(currX);
        } else if (prevD * currD < 0) {
          let lo = prevX, hi = currX, dLo = prevD;
          for (let k = 0; k < 16; k++) {
            const mid = 0.5 * (lo + hi);
            const dMid = fnY(mid) - lineY(mid);
            if (dLo * dMid <= 0) hi = mid;
            else { lo = mid; dLo = dMid; }
          }
          roots.push(0.5 * (lo + hi));
        }
        prevX = currX;
        prevD = currD;
      }

      const merged = [];
      for (let j = 0; j < roots.length; j++) {
        const r = roots[j];
        if (!merged.length || Math.abs(r - merged[merged.length - 1]) > 0.04) {
          merged.push(r);
        }
      }
      return merged;
    }

    class GraphlyIntroTourController {
      constructor(modalEl) {
        this.modalEl = modalEl;
        this.canvas = document.getElementById('introTourCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.captionEl = document.getElementById('introTourCaptionText');
        this.btnTogglePlay = document.getElementById('btnIntroTogglePlay');

        this.W = 816;
        this.H = 469;
        this.currentTab = 0;
        this.tabDurations = [12.0, 11.4, 12.6];
        this.tabTime = 0;
        this.isPlaying = false;
        this.isOpen = false;
        this.rafId = null;
        this.openRafId = null;
        this.lastFrameMs = 0;
        this.lastCaption = '';
        this._pendingTooltips = [];

        this.bindEvents();
      }

      resize() {
        if (!this.canvas || !this.ctx || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        // 전 해상도(데스크톱·아이패드·스마트폰)에서 레이아웃 겹침 0%를 보장하는 816x469 벡터 등비 좌표계
        this.W = 816;
        this.H = 469;
        this.canvas.width = Math.round(rect.width * dpr);
        this.canvas.height = Math.round(rect.height * dpr);
        const sx = (rect.width * dpr) / this.W;
        const sy = (rect.height * dpr) / this.H;
        this.ctx.setTransform(sx, 0, 0, sy, 0, 0);
      }

      open() {
        if (!this.modalEl || !this.ctx) return;
        // 공유 뷰어나 리플레이가 실행 중이면 자동 오픈 차단
        const viewerEl = document.getElementById('smartNoteViewerOverlay');
        if (viewerEl && viewerEl.style.display !== 'none' && viewerEl.classList.contains('active')) {
          return;
        }
        markIntroAsSeen();
        this.isOpen = true;
        this.modalEl.style.display = 'flex';
        if (this.openRafId) cancelAnimationFrame(this.openRafId);
        // 다음 프레임에 트랜지션 활성화 및 리사이즈
        this.openRafId = requestAnimationFrame(() => {
          this.openRafId = null;
          if (!this.isOpen) return;
          this.modalEl.classList.remove('is-hidden');
          this.resize();
          this.selectTab(0, true);
          this.isPlaying = true;
          this.syncPlayBtn();
          this.startLoop();
        });
      }

      close() {
        if (!this.modalEl) return;
        markIntroAsSeen();
        this.isOpen = false;
        this.isPlaying = false;
        if (this.openRafId) {
          cancelAnimationFrame(this.openRafId);
          this.openRafId = null;
        }
        this.stopLoop();
        this.modalEl.classList.add('is-hidden');
        setTimeout(() => {
          if (!this.isOpen && this.modalEl) {
            this.modalEl.style.display = 'none';
          }
        }, 260);
      }

      startLoop() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.lastFrameMs = performance.now();
        const tick = (now) => {
          if (!this.isOpen) {
            this.rafId = null;
            return;
          }
          const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameMs) / 1000));
          this.lastFrameMs = now;

          const dur = this.tabDurations[this.currentTab];
          if (this.isPlaying) {
            this.tabTime += dt;
            if (this.tabTime >= dur) {
              this.selectTab(this.currentTab + 1, true);
            }
          }

          const progEl = document.getElementById('introTabProg' + this.currentTab);
          if (progEl) {
            progEl.style.width = clamp((this.tabTime / dur) * 100, 0, 100).toFixed(1) + '%';
          }

          try {
            this.render(now);
          } catch (_) {}

          this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
      }

      stopLoop() {
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      }

      setCaption(text) {
        if (this.captionEl && this.lastCaption !== text) {
          this.lastCaption = text;
          this.captionEl.textContent = text;
        }
      }

      selectTab(idx, resetTime) {
        this.currentTab = (idx + 3) % 3;
        if (resetTime) this.tabTime = 0;
        const btns = this.modalEl.querySelectorAll('.intro-tab-btn');
        btns.forEach((btn, i) => {
          const active = i === this.currentTab;
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-selected', String(active));
          const prog = document.getElementById('introTabProg' + i);
          if (prog && !active) prog.style.width = i < this.currentTab ? '100%' : '0%';
        });
      }

      syncPlayBtn() {
        if (this.btnTogglePlay) {
          this.btnTogglePlay.textContent = this.isPlaying ? '⏸ 일시정지' : '▶ 재생';
        }
      }

      bindEvents() {
        if (!this.modalEl) return;

        this.modalEl.querySelectorAll('.intro-tab-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.getAttribute('data-intro-tab') || 0);
            this.selectTab(idx, true);
            this.isPlaying = true;
            this.syncPlayBtn();
          });
        });

        if (this.btnTogglePlay) {
          this.btnTogglePlay.addEventListener('click', () => {
            this.isPlaying = !this.isPlaying;
            this.syncPlayBtn();
          });
        }

        const btnReplay = document.getElementById('btnIntroReplayTab');
        if (btnReplay) {
          btnReplay.addEventListener('click', () => {
            this.tabTime = 0;
            this.isPlaying = true;
            this.syncPlayBtn();
          });
        }

        const btnNext = document.getElementById('btnIntroNextTab');
        if (btnNext) {
          btnNext.addEventListener('click', () => {
            this.selectTab(this.currentTab + 1, true);
            this.isPlaying = true;
            this.syncPlayBtn();
          });
        }

        const btnSkip = document.getElementById('btnIntroSkipClose');
        if (btnSkip) btnSkip.addEventListener('click', () => this.close());

        const btnStart = document.getElementById('btnIntroStartNow');
        if (btnStart) btnStart.addEventListener('click', () => this.close());

        this.modalEl.addEventListener('click', (e) => {
          if (e.target === this.modalEl) this.close();
        });

        // 사용법 및 문의 모달 상단의 [▶ 핵심 가이드] 버튼 연결
        const btnOpenFromGuide = document.getElementById('btnOpenIntroFromGuide');
        if (btnOpenFromGuide) {
          btnOpenFromGuide.addEventListener('click', (e) => {
            e.stopPropagation();
            const guideModal = document.getElementById('modalGuideNotice');
            if (guideModal) guideModal.classList.remove('show');
            this.open();
          });
        }

        window.addEventListener('resize', () => {
          if (this.isOpen) this.resize();
        });

        // 모달이 열려 있는 동안에만 뒷배경 전역 단축키/붙여넣기 간섭 완벽 차단
        window.addEventListener('keydown', (e) => {
          if (!this.isOpen) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.close();
            return;
          }
          if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/i.test(e.key)) return;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.selectTab(this.currentTab + 1, true);
            this.isPlaying = true;
            this.syncPlayBtn();
            return;
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.selectTab(this.currentTab - 1, true);
            this.isPlaying = true;
            this.syncPlayBtn();
            return;
          }
          if (e.key === ' ') {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.isPlaying = !this.isPlaying;
            this.syncPlayBtn();
            return;
          }
          e.stopImmediatePropagation();
        }, true);
      }

      drawGraphlyWorkspaceFrame(opts) {
        const o = opts || {};
        const showLeftRail = o.showLeftRail !== false;
        const activeLeft = o.activeLeft || [];
        const pulseLeft = typeof o.pulseLeft === 'number' ? o.pulseLeft : -1;
        const pulseLeftAmt = o.pulseLeftAmt || 0;
        const leftTooltips = o.leftTooltips || {};
        const activeRight = o.activeRight || [];
        const pulseRight = typeof o.pulseRight === 'number' ? o.pulseRight : -1;
        const pulseRightAmt = o.pulseRightAmt || 0;
        const rightTooltips = o.rightTooltips || {};

        const ctx = this.ctx;
        const W = this.W, H = this.H;
        this._pendingTooltips = [];

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#e2e8f0';
        const step = 24;
        const gridStartX = showLeftRail ? 68 : 20;
        for (let x = gridStartX; x < W - 66; x += step) {
          for (let y = 20; y < H - 18; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, 1.05, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        const railW = 42;
        const slotGap = 40;

        const leftIcons = ['folder', 'cloud', 'fplus', 'dot'];
        const leftSlots = [];
        if (showLeftRail) {
          const lx = 12;
          const lh = leftIcons.length * slotGap + 18;
          const ly = (H - lh) / 2;

          ctx.save();
          ctx.shadowColor = 'rgba(15, 23, 42, 0.07)';
          ctx.shadowBlur = 16;
          ctx.shadowOffsetY = 4;
          roundRectPath(ctx, lx, ly, railW, lh, 13);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
          ctx.fill();
          ctx.restore();

          roundRectPath(ctx, lx, ly, railW, lh, 13);
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.stroke();

          for (let i = 0; i < leftIcons.length; i++) {
            const cx = lx + railW / 2;
            const cy = ly + 27 + i * slotGap;
            leftSlots.push({ x: cx, y: cy });

            const isAct = activeLeft.indexOf(i) !== -1;
            const isPulse = pulseLeft === i && pulseLeftAmt > 0;

            roundRectPath(ctx, cx - 14.5, cy - 14.5, 29, 29, 8.5);
            ctx.fillStyle = isAct ? '#eff6ff' : '#f8fafc';
            ctx.fill();
            ctx.strokeStyle = isAct ? '#3b82f6' : '#e2e8f0';
            ctx.lineWidth = isAct ? 1.5 : 1;
            ctx.stroke();

            const col = isAct ? '#2563eb' : (i === 2 ? '#334155' : '#94a3b8');
            drawGraphlyIcon(ctx, leftIcons[i], cx, cy, 16.5, col);

            if (isPulse) {
              ctx.beginPath();
              ctx.arc(cx, cy, 14 + pulseLeftAmt * 13, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(37, 99, 235, ' + ((1 - pulseLeftAmt) * 0.75) + ')';
              ctx.lineWidth = 2;
              ctx.stroke();
            }

            if (leftTooltips[i]) {
              this._pendingTooltips.push({ side: 'rightOfLeftRail', x: lx + railW + 8, y: cy, text: leftTooltips[i] });
            }
          }
        }

        const rightIcons = ['fullscreen', 'export', 'pen', 'intersect', 'dropline'];
        const rx = W - railW - 12;
        const rh = rightIcons.length * slotGap + 18;
        const ry = (H - rh) / 2;
        const rightSlots = [];

        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.07)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;
        roundRectPath(ctx, rx, ry, railW, rh, 13);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.fill();
        ctx.restore();

        roundRectPath(ctx, rx, ry, railW, rh, 13);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.stroke();

        for (let i = 0; i < rightIcons.length; i++) {
          const cx = rx + railW / 2;
          const cy = ry + 27 + i * slotGap;
          rightSlots.push({ x: cx, y: cy });

          const isAct = activeRight.indexOf(i) !== -1;
          const isPulse = pulseRight === i && pulseRightAmt > 0;

          roundRectPath(ctx, cx - 14.5, cy - 14.5, 29, 29, 8.5);
          ctx.fillStyle = isAct ? '#eff6ff' : '#f8fafc';
          ctx.fill();
          ctx.strokeStyle = isAct ? '#3b82f6' : '#e2e8f0';
          ctx.lineWidth = isAct ? 1.5 : 1;
          ctx.stroke();

          const col = isAct ? '#2563eb' : '#64748b';
          drawGraphlyIcon(ctx, rightIcons[i], cx, cy, 16, col);

          if (isPulse) {
            ctx.beginPath();
            ctx.arc(cx, cy, 14 + pulseRightAmt * 13, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(37, 99, 235, ' + ((1 - pulseRightAmt) * 0.75) + ')';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          if (rightTooltips[i]) {
            this._pendingTooltips.push({ side: 'leftOfRightRail', x: rx - 8, y: cy, text: rightTooltips[i] });
          }
        }

        return { leftSlots: leftSlots, rightSlots: rightSlots };
      }

      flushPendingTooltips() {
        const ctx = this.ctx;
        for (let i = 0; i < this._pendingTooltips.length; i++) {
          const tp = this._pendingTooltips[i];
          ctx.save();
          ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 3;
          ctx.font = '600 11px Pretendard, -apple-system, BlinkMacSystemFont, sans-serif';
          const tw = ctx.measureText(tp.text).width + 14;
          const tx = tp.side === 'leftOfRightRail' ? (tp.x - tw) : tp.x;
          const ty = tp.y - 11;
          roundRectPath(ctx, tx, ty, tw, 22, 6);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tp.text, tx + tw / 2, tp.y);
          ctx.restore();
        }
        this._pendingTooltips = [];
      }

      drawPulsingIntersectionRedDot(x, y, nowMs) {
        const ctx = this.ctx;
        const pulse = 0.5 + 0.5 * Math.sin(nowMs / 150);

        ctx.save();
        const outerR = 5.2 + pulse * 6.2;
        ctx.beginPath();
        ctx.arc(x, y, outerR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, ' + (0.14 + pulse * 0.16) + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(220, 38, 38, ' + (0.45 + pulse * 0.45) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const coreR = 3.3 + pulse * 1.8;
        ctx.shadowColor = 'rgba(220, 38, 38, 0.45)';
        ctx.shadowBlur = 4 + pulse * 5;
        ctx.beginPath();
        ctx.arc(x, y, coreR, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }

      drawCursor(x, y, mode, isDown, rippleProgress) {
        this.flushPendingTooltips();
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(x, y);

        if (rippleProgress >= 0 && rippleProgress <= 1) {
          const r = 6 + rippleProgress * 22;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(37, 99, 235, ' + ((1 - rippleProgress) * 0.85) + ')';
          ctx.lineWidth = 2.4;
          ctx.stroke();
        }

        if (isDown) {
          ctx.beginPath();
          ctx.arc(0, 0, 13, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(37, 99, 235, 0.16)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        const scale = isDown ? 0.91 : 1.0;
        ctx.scale(scale, scale);

        if (mode === 'pen') {
          ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 3;

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(7, 2.5);
          ctx.lineTo(18, 13.5);
          ctx.lineTo(13.5, 18);
          ctx.lineTo(2.5, 7);
          ctx.closePath();
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(6.2, 2.2);
          ctx.lineTo(2.2, 6.2);
          ctx.closePath();
          ctx.fillStyle = '#dc2626';
          ctx.fill();
        } else {
          ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, 18.5);
          ctx.lineTo(5.2, 14.2);
          ctx.lineTo(8.5, 21.2);
          ctx.lineTo(11.4, 19.8);
          ctx.lineTo(8.1, 12.8);
          ctx.lineTo(14.5, 12.8);
          ctx.closePath();
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.lineJoin = 'round';
          ctx.stroke();
        }

        ctx.restore();
      }

      render(nowMs) {
        if (this.currentTab === 0) this.renderTab1(this.tabTime, nowMs);
        else if (this.currentTab === 1) this.renderTab2(this.tabTime, nowMs);
        else this.renderTab3(this.tabTime, nowMs);
      }

      renderTab1(t, nowMs) {
        const ctx = this.ctx;
        const W = this.W, H = this.H;

        let pulseLeft = -1, pulseLeftAmt = 0;
        let pulseRight = -1, pulseRightAmt = 0;
        let ripple = -1;

        const leftFPlusClicks = [0.55, 5.55];
        for (let i = 0; i < leftFPlusClicks.length; i++) {
          const ct = leftFPlusClicks[i];
          if (t >= ct && t <= ct + 0.42) {
            pulseLeft = 2;
            pulseLeftAmt = (t - ct) / 0.42;
            ripple = pulseLeftAmt;
          }
        }
        const subClicks = [1.10, 4.05, 4.45, 6.05];
        for (let i = 0; i < subClicks.length; i++) {
          const ct = subClicks[i];
          if (t >= ct && t <= ct + 0.36) ripple = (t - ct) / 0.36;
        }
        if (t >= 7.65 && t <= 8.10) {
          pulseRight = 3;
          pulseRightAmt = (t - 7.65) / 0.45;
          ripple = pulseRightAmt;
        }

        const showDrawerQuartic = t >= 0.55 && t < 1.35;
        const showDrawerLine = t >= 5.55 && t < 6.25;

        const rails = this.drawGraphlyWorkspaceFrame({
          showLeftRail: true,
          activeLeft: (showDrawerQuartic || showDrawerLine) ? [2] : [],
          pulseLeft: pulseLeft,
          pulseLeftAmt: pulseLeftAmt,
          leftTooltips: (t < 0.85) ? { 2: '그래프 추가 (f+)' } : {},
          activeRight: t >= 7.65 ? [3] : [],
          pulseRight: pulseRight,
          pulseRightAmt: pulseRightAmt,
          rightTooltips: (t >= 7.25 && t < 8.25) ? { 3: '교점 표시' } : {}
        });

        if (t < 1.45) this.setCaption('① 좌측 [f+]에서 비대칭 4차함수를 불러옵니다');
        else if (t < 3.70) this.setCaption('② 극점 핸들을 드래그해 원하는 개형으로 즉시 조작합니다');
        else if (t < 5.30) this.setCaption('③ 상단 [절댓값 ▾]에서 |f(x)| 전체 절댓값을 씌웁니다');
        else if (t < 7.35) this.setCaption('④ 직선을 추가하고 중심점(고정점)을 기준으로 기울기를 변화시킵니다');
        else this.setCaption('⑤ 우측 [⚡ 교점 표시]를 켜고 기울기에 따른 교점 변화를 관찰합니다');

        const originX = W * 0.49;
        const originY = H * 0.69;
        const scaleX = Math.min(W, H) * 0.205;
        const scaleY = Math.min(W, H) * 0.16;
        const toSX = (mx) => originX + mx * scaleX;
        const toSY = (my) => originY - my * scaleY;

        const axisLeft = 74, axisRight = W - 74;
        const axisTop = 52, axisBottom = H - 52;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(axisLeft, originY);
        ctx.lineTo(axisRight, originY);
        ctx.moveTo(originX, axisBottom);
        ctx.lineTo(originX, axisTop);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 600 13px Georgia, serif';
        ctx.fillText('x', axisRight - 10, originY + 17);
        ctx.fillText('y', originX + 10, axisTop + 10);
        ctx.fillText('O', originX - 16, originY + 17);

        const drag1 = easeInOutCubic(subProgress(t, 1.75, 2.75));
        const drag2 = easeInOutCubic(subProgress(t, 2.85, 3.55));
        const r1 = -1.25;
        const r2 = lerp(-0.18, -0.10, drag2);
        const r3 = lerp(1.22, 1.42, drag1);
        const coeffA = lerp(0.19, 0.27, drag1);
        const coeffC = lerp(0.72, 1.28, drag2) - drag1 * 0.52;
        const absMorph = easeInOutCubic(subProgress(t, 4.45, 5.10));

        const fOrig = (x) => evalQuarticRaw(x, r1, r2, r3, coeffA, coeffC);
        const fCurr = (x) => {
          const v = fOrig(x);
          return lerp(v, Math.abs(v), absMorph);
        };

        if (t >= 1.10) {
          const appear = easeInOutCubic(subProgress(t, 1.10, 1.45));
          ctx.save();
          ctx.globalAlpha = appear;

          if (absMorph > 0.05) {
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(148, 163, 184, ' + (0.42 * absMorph) + ')';
            ctx.lineWidth = 1.4;
            let started = false;
            for (let mx = -2.25; mx <= 2.38; mx += 0.02) {
              const rawY = fOrig(mx);
              if (rawY < 0.02) {
                const sx = toSX(mx), sy = toSY(rawY);
                if (sy <= axisBottom + 18) {
                  if (!started) { ctx.moveTo(sx, sy); started = true; }
                  else ctx.lineTo(sx, sy);
                } else started = false;
              } else started = false;
            }
            ctx.stroke();
            ctx.restore();
          }

          ctx.beginPath();
          let first = true;
          for (let mx = -2.35; mx <= 2.45; mx += 0.012) {
            const my = fCurr(mx);
            const sx = toSX(mx), sy = toSY(my);
            if (sy < axisTop - 18 || sy > axisBottom + 20) {
              first = true;
              continue;
            }
            if (first) { ctx.moveTo(sx, sy); first = false; }
            else ctx.lineTo(sx, sy);
          }
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2.7;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();

          if (t < 5.55) {
            const pts = [
              { x: toSX(r1), y: toSY(fCurr(r1)) },
              { x: toSX(r2), y: toSY(fCurr(r2)) },
              { x: toSX(r3), y: toSY(fCurr(r3)) }
            ];
            pts.forEach((pt, idx) => {
              const dragging = (idx === 2 && t >= 1.70 && t <= 2.80) || (idx === 1 && t >= 2.82 && t <= 3.60);
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, dragging ? 6.4 : 4.8, 0, Math.PI * 2);
              ctx.fillStyle = dragging ? '#2563eb' : '#ffffff';
              ctx.fill();
              ctx.strokeStyle = '#2563eb';
              ctx.lineWidth = 2.2;
              ctx.stroke();
            });
          }

          ctx.restore();
        }

        const barW = 198, barH = 30;
        const barX = (W - barW) / 2, barY = 12;
        const absBtnCenter = { x: barX + 148, y: barY + 15 };
        const absSubBtnCenter = { x: barX + 148, y: barY + 49 };

        if (t >= 1.15 && t < 5.45) {
          ctx.save();
          ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 3;
          roundRectPath(ctx, barX, barY, barW, barH, 999);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(barX + 18, barY + 15, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#1e293b';
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 11.5px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('f1', barX + 27, barY + 15.5);

          ctx.strokeStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(barX + 48, barY + 7);
          ctx.lineTo(barX + 48, barY + 23);
          ctx.stroke();

          ctx.fillStyle = '#475569';
          ctx.font = '600 11.5px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('대칭 ▾', barX + 82, barY + 15.5);

          const absActive = t >= 4.05;
          if (absActive) {
            roundRectPath(ctx, barX + 114, barY + 4, 68, 22, 999);
            ctx.fillStyle = '#eff6ff';
            ctx.fill();
          }
          ctx.fillStyle = absActive ? '#2563eb' : '#334155';
          ctx.font = '700 11.5px Pretendard, -apple-system, sans-serif';
          ctx.fillText('절댓값 ▾', absBtnCenter.x, barY + 15.5);

          if (t >= 4.05 && t < 4.95) {
            const subX = barX + 90, subY = barY + 35, subW = 116, subH = 28;
            ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
            ctx.shadowBlur = 14;
            ctx.shadowOffsetY = 4;
            roundRectPath(ctx, subX, subY, subW, subH, 8);
            ctx.fillStyle = t >= 4.45 ? '#eff6ff' : '#ffffff';
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = t >= 4.45 ? '#3b82f6' : '#cbd5e1';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = t >= 4.45 ? '#1d4ed8' : '#0f172a';
            ctx.font = '700 11px Pretendard, -apple-system, sans-serif';
            ctx.fillText('|f(x)| 전체 절댓값', subX + subW / 2, subY + 14.5);
          }
          ctx.restore();
        }

        const drawerX = 62, drawerY = H / 2 - 48, cardS = 68;
        const qCardCenter = { x: drawerX + 10 + cardS / 2, y: drawerY + 10 + cardS / 2 };
        const lCardCenter = { x: drawerX + 10 + cardS + 8 + cardS / 2, y: drawerY + 10 + cardS / 2 };

        if (showDrawerQuartic || showDrawerLine) {
          ctx.save();
          ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetY = 6;
          roundRectPath(ctx, drawerX, drawerY, cardS * 2 + 28, cardS + 20, 13);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.stroke();

          const selQ = showDrawerQuartic && t >= 0.95;
          roundRectPath(ctx, drawerX + 10, drawerY + 10, cardS, cardS, 10);
          ctx.fillStyle = selQ ? '#eff6ff' : '#f8fafc';
          ctx.fill();
          ctx.strokeStyle = selQ ? '#2563eb' : '#e2e8f0';
          ctx.lineWidth = selQ ? 1.5 : 1;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(qCardCenter.x - 16, qCardCenter.y - 14);
          ctx.bezierCurveTo(qCardCenter.x - 11, qCardCenter.y + 8, qCardCenter.x - 5, qCardCenter.y + 6, qCardCenter.x - 1, qCardCenter.y - 4);
          ctx.bezierCurveTo(qCardCenter.x + 4, qCardCenter.y + 6, qCardCenter.x + 10, qCardCenter.y + 13, qCardCenter.x + 16, qCardCenter.y - 14);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#334155';
          ctx.font = '700 10px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('비대칭 4차', qCardCenter.x, drawerY + 10 + cardS - 10);

          const selL = showDrawerLine && t >= 5.90;
          const lx0 = drawerX + 10 + cardS + 8;
          roundRectPath(ctx, lx0, drawerY + 10, cardS, cardS, 10);
          ctx.fillStyle = selL ? '#eff6ff' : '#f8fafc';
          ctx.fill();
          ctx.strokeStyle = selL ? '#2563eb' : '#e2e8f0';
          ctx.lineWidth = selL ? 1.5 : 1;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(lCardCenter.x - 15, lCardCenter.y + 7);
          ctx.lineTo(lCardCenter.x + 15, lCardCenter.y - 11);
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2.1;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(lCardCenter.x - 5, lCardCenter.y + 1, 2.6, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.fillStyle = '#334155';
          ctx.font = '700 10px Pretendard, -apple-system, sans-serif';
          ctx.fillText('일차함수', lCardCenter.x, drawerY + 10 + cardS - 10);

          ctx.restore();
        }

        const pivotX = -2.05, pivotY = 0;
        let slopeM = 0.30;
        if (t >= 6.40 && t < 7.30) {
          slopeM = lerp(0.30, 0.46, easeInOutCubic(subProgress(t, 6.40, 7.30)));
        } else if (t >= 7.30 && t < 8.20) {
          slopeM = 0.46;
        } else if (t >= 8.20 && t < 9.90) {
          slopeM = lerp(0.46, 0.14, easeInOutCubic(subProgress(t, 8.20, 9.90)));
        } else if (t >= 9.90) {
          slopeM = lerp(0.14, 0.355, easeInOutCubic(subProgress(t, 9.90, 11.4)));
        }

        const lineFn = (mx) => pivotY + slopeM * (mx - pivotX);
        const slopeHandleMX = 2.05;
        const slopeHandlePos = { x: toSX(slopeHandleMX), y: toSY(lineFn(slopeHandleMX)) };
        const pivotPos = { x: toSX(pivotX), y: toSY(pivotY) };

        if (t >= 6.05) {
          const lineAppear = easeInOutCubic(subProgress(t, 6.05, 6.35));
          ctx.save();
          ctx.globalAlpha = lineAppear;

          ctx.beginPath();
          ctx.moveTo(toSX(-2.50), toSY(lineFn(-2.50)));
          ctx.lineTo(toSX(2.50), toSY(lineFn(2.50)));
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2.2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(pivotPos.x, pivotPos.y, 5.8, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          const draggingSlope = (t >= 6.40 && t <= 7.30) || (t >= 8.20 && t <= 11.4);
          ctx.beginPath();
          ctx.arc(slopeHandlePos.x, slopeHandlePos.y, draggingSlope ? 6.4 : 4.8, 0, Math.PI * 2);
          ctx.fillStyle = draggingSlope ? '#2563eb' : '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2.2;
          ctx.stroke();

          if (t >= 7.65) {
            const roots = findCurveLineIntersections(fCurr, lineFn, -2.35, 2.45);
            for (let i = 0; i < roots.length; i++) {
              const rx = roots[i];
              this.drawPulsingIntersectionRedDot(toSX(rx), toSY(lineFn(rx)), nowMs);
            }
          }

          ctx.restore();
        }

        const fPlusPos = rails.leftSlots[2];
        const intersectBtnPos = rails.rightSlots[3];
        const p3Start = { x: toSX(1.22), y: toSY(evalQuarticRaw(1.22, -1.25, -0.18, 1.22, 0.19, 0.72)) };
        const p3End   = { x: toSX(1.42), y: toSY(evalQuarticRaw(1.42, -1.25, -0.18, 1.42, 0.27, 0.20)) };
        const p2Start = { x: toSX(-0.18), y: toSY(evalQuarticRaw(-0.18, -1.25, -0.18, 1.42, 0.27, 0.20)) };
        const p2End   = { x: toSX(-0.10), y: toSY(evalQuarticRaw(-0.10, -1.25, -0.10, 1.42, 0.27, 0.76)) };

        const sh0 = { x: toSX(slopeHandleMX), y: toSY(0.30 * (slopeHandleMX - pivotX)) };
        const sh1 = { x: toSX(slopeHandleMX), y: toSY(0.46 * (slopeHandleMX - pivotX)) };
        const sh2 = { x: toSX(slopeHandleMX), y: toSY(0.14 * (slopeHandleMX - pivotX)) };
        const sh3 = { x: toSX(slopeHandleMX), y: toSY(0.355 * (slopeHandleMX - pivotX)) };

        const kfs = [
          { t: 0.0,  x: W * 0.42, y: H * 0.50 },
          { t: 0.53, x: fPlusPos.x, y: fPlusPos.y },
          { t: 0.70, x: fPlusPos.x, y: fPlusPos.y },
          { t: 1.08, x: qCardCenter.x, y: qCardCenter.y },
          { t: 1.25, x: qCardCenter.x, y: qCardCenter.y },
          { t: 1.72, x: p3Start.x, y: p3Start.y, holdDrag: true },
          { t: 2.75, x: p3End.x,   y: p3End.y },
          { t: 2.85, x: p2Start.x, y: p2Start.y, holdDrag: true },
          { t: 3.55, x: p2End.x,   y: p2End.y },
          { t: 4.03, x: absBtnCenter.x, y: absBtnCenter.y },
          { t: 4.43, x: absSubBtnCenter.x, y: absSubBtnCenter.y },
          { t: 4.65, x: absSubBtnCenter.x, y: absSubBtnCenter.y },
          { t: 5.53, x: fPlusPos.x, y: fPlusPos.y },
          { t: 5.68, x: fPlusPos.x, y: fPlusPos.y },
          { t: 6.03, x: lCardCenter.x, y: lCardCenter.y },
          { t: 6.40, x: sh0.x, y: sh0.y, holdDrag: true },
          { t: 7.30, x: sh1.x, y: sh1.y },
          { t: 7.63, x: intersectBtnPos.x, y: intersectBtnPos.y },
          { t: 7.85, x: intersectBtnPos.x, y: intersectBtnPos.y },
          { t: 8.20, x: sh1.x, y: sh1.y, holdDrag: true },
          { t: 9.90, x: sh2.x, y: sh2.y, holdDrag: true },
          { t: 11.4, x: sh3.x, y: sh3.y },
          { t: 12.0, x: sh3.x + 16, y: sh3.y + 10 }
        ];

        const cur = evalCursorTimeline(kfs, t);
        this.drawCursor(cur.x, cur.y, cur.mode, cur.down, ripple);
      }

      renderTab2(t) {
        const ctx = this.ctx;
        const W = this.W, H = this.H;

        let pulseLeft = -1, pulseLeftAmt = 0;
        let pulseRight = -1, pulseRightAmt = 0;
        let ripple = -1;

        if (t >= 0.55 && t <= 0.98) {
          pulseLeft = 2;
          pulseLeftAmt = (t - 0.55) / 0.43;
          ripple = pulseLeftAmt;
        }
        if (t >= 7.45 && t <= 7.90) {
          pulseRight = 2;
          pulseRightAmt = (t - 7.45) / 0.45;
          ripple = pulseRightAmt;
        }
        const stampClicks = [1.85, 3.35, 4.85, 6.35, 6.95];
        for (let i = 0; i < stampClicks.length; i++) {
          const ct = stampClicks[i];
          if (t >= ct && t <= ct + 0.38) ripple = (t - ct) / 0.38;
        }

        const rails = this.drawGraphlyWorkspaceFrame({
          showLeftRail: true,
          activeLeft: t >= 0.55 && t < 7.0 ? [2] : [],
          pulseLeft: pulseLeft,
          pulseLeftAmt: pulseLeftAmt,
          leftTooltips: t < 1.05 ? { 2: '그래프 추가 (f+)' } : {},
          activeRight: t >= 7.45 ? [2] : [],
          pulseRight: pulseRight,
          pulseRightAmt: pulseRightAmt,
          rightTooltips: (t >= 7.05 && t < 8.0) ? { 2: '필기 해설' } : {}
        });

        if (t < 1.3) this.setCaption('① 좌측 [f+]에서 그래프 창 하나를 불러옵니다');
        else if (t < 7.1) this.setCaption('② 개형을 변형해가며 [스탬프]로 캔버스에 4개 그래프를 연속 고정합니다');
        else this.setCaption('③ 스탬프로 고정된 그래프 위에서 경계 없이 바로 필기하며 해설합니다');

        const usableLeft = 68, usableRight = W - 68;
        const boardW = usableRight - usableLeft;
        const cellW = Math.min(262, (boardW - 36) / 2);
        const cellH = Math.min(156, (H - 96) / 2);
        const startX = usableLeft + (boardW - (cellW * 2 + 22)) / 2;
        const startY = 24;

        const cells = [
          { x: startX, y: startY, shift: 0.72, label: '(i)', stampTime: 1.85 },
          { x: startX + cellW + 22, y: startY, shift: 0.385, label: '(ii)', stampTime: 3.35 },
          { x: startX, y: startY + cellH + 16, shift: 0.0, label: '(iii)', stampTime: 4.85 },
          { x: startX + cellW + 22, y: startY + cellH + 16, shift: -0.385, label: '(iv)', stampTime: 6.35 }
        ];

        const drawMiniCubic = (bx, by, bw, bh, shiftVal, isCard) => {
          const ox = bx + bw * 0.5;
          const oy = by + bh * 0.57;
          const sx = bw * 0.25;
          const sy = bh * 0.34;

          ctx.strokeStyle = isCard ? '#94a3b8' : '#cbd5e1';
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(bx + 16, oy);
          ctx.lineTo(bx + bw - 16, oy);
          ctx.moveTo(ox, by + bh - 12);
          ctx.lineTo(ox, by + 26);
          ctx.stroke();

          ctx.beginPath();
          let first = true;
          for (let mx = -1.42; mx <= 1.42; mx += 0.03) {
            const my = (mx * mx * mx - mx) + shiftVal;
            const px = ox + mx * sx;
            const py = oy - my * sy;
            if (py < by + 22 || py > by + bh - 10) { first = true; continue; }
            if (first) { ctx.moveTo(px, py); first = false; }
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.2;
          ctx.stroke();

          return { minPt: { x: ox + 0.577 * sx, y: oy - (-0.385 + shiftVal) * sy } };
        };

        cells.forEach((c) => {
          if (t >= c.stampTime) {
            const pop = easeOutBack(subProgress(t, c.stampTime, c.stampTime + 0.30));
            ctx.save();
            const cx = c.x + cellW / 2, cy = c.y + cellH / 2;
            ctx.translate(cx, cy);
            ctx.scale(lerp(0.95, 1, clamp(pop, 0, 1.04)), lerp(0.95, 1, clamp(pop, 0, 1.04)));
            ctx.translate(-cx, -cy);

            roundRectPath(ctx, c.x, c.y, cellW, cellH, 12);
            ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
            ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.font = '700 11.5px Pretendard, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(c.label, c.x + 12, c.y + 18);

            drawMiniCubic(c.x, c.y, cellW, cellH, c.shift, false);
            ctx.restore();
          }
        });

        let cardX = cells[0].x, cardY = cells[0].y, currShift = 0.72;
        if (t >= 2.05 && t < 3.55) {
          const m = easeInOutCubic(subProgress(t, 2.05, 2.55));
          cardX = lerp(cells[0].x, cells[1].x, m);
          cardY = lerp(cells[0].y, cells[1].y, m);
          currShift = lerp(0.72, 0.385, easeInOutCubic(subProgress(t, 2.60, 3.10)));
        } else if (t >= 3.55 && t < 5.05) {
          const m = easeInOutCubic(subProgress(t, 3.55, 4.05));
          cardX = lerp(cells[1].x, cells[2].x, m);
          cardY = lerp(cells[1].y, cells[2].y, m);
          currShift = lerp(0.385, 0.0, easeInOutCubic(subProgress(t, 4.10, 4.60)));
        } else if (t >= 5.05 && t <= 7.15) {
          const m = easeInOutCubic(subProgress(t, 5.05, 5.55));
          cardX = lerp(cells[2].x, cells[3].x, m);
          cardY = lerp(cells[2].y, cells[3].y, m);
          currShift = lerp(0.0, -0.385, easeInOutCubic(subProgress(t, 5.60, 6.10)));
        }

        if (t >= 0.65 && t < 7.05) {
          const alpha = t > 6.90 ? 1 - subProgress(t, 6.90, 7.05) : easeInOutCubic(subProgress(t, 0.65, 1.0));
          ctx.save();
          ctx.globalAlpha = alpha;

          ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
          ctx.shadowBlur = 22;
          ctx.shadowOffsetY = 8;
          roundRectPath(ctx, cardX, cardY, cellW, cellH, 12);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.shadowColor = 'transparent';

          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          roundRectPath(ctx, cardX + 1, cardY + 1, cellW - 2, 28, 11);
          ctx.fillStyle = '#f8fafc';
          ctx.fill();

          ctx.fillStyle = '#0f172a';
          ctx.font = '800 11.5px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('#1', cardX + 12, cardY + 18.5);

          const sbX = cardX + cellW - 56, sbY = cardY + 15;
          roundRectPath(ctx, sbX - 28, sbY - 10, 56, 20, 6);
          ctx.fillStyle = '#eff6ff';
          ctx.fill();
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 1;
          ctx.stroke();
          drawGraphlyIcon(ctx, 'stamp', sbX - 16, sbY, 12, '#1d4ed8');
          ctx.fillStyle = '#1d4ed8';
          ctx.font = '700 10px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('스탬프', sbX - 7, sbY + 3.5);

          ctx.fillStyle = '#64748b';
          ctx.font = '700 11px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✕', cardX + cellW - 14, cardY + 18.5);

          const info = drawMiniCubic(cardX, cardY, cellW, cellH, currShift, true);

          ctx.beginPath();
          ctx.arc(info.minPt.x, info.minPt.y, 4.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.restore();
        }

        const drawAnimatedEllipse = (cx, cy, rx, ry, prog) => {
          if (prog <= 0) return;
          ctx.save();
          ctx.beginPath();
          const maxAng = Math.PI * 2.08 * clamp(prog, 0, 1);
          for (let a = -0.4; a <= -0.4 + maxAng; a += 0.12) {
            const px = cx + Math.cos(a) * rx;
            const py = cy + Math.sin(a) * ry - Math.sin(a * 2) * 0.8;
            if (a === -0.4) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 2.3;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore();
        };

        const drawCheckMark = (x, y, prog) => {
          if (prog <= 0) return;
          ctx.save();
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          const p1 = clamp(prog * 2, 0, 1);
          ctx.moveTo(x, y);
          ctx.lineTo(lerp(x, x + 6, p1), lerp(y, y + 7, p1));
          if (prog > 0.5) {
            const p2 = clamp((prog - 0.5) * 2, 0, 1);
            ctx.lineTo(lerp(x + 6, x + 17, p2), lerp(y + 7, y - 8, p2));
          }
          ctx.stroke();
          ctx.restore();
        };

        if (t >= 7.85) {
          const p = subProgress(t, 7.85, 8.35);
          ctx.save();
          ctx.globalAlpha = clamp(p * 2, 0, 1);
          ctx.fillStyle = '#64748b';
          ctx.font = '700 12.5px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('실근 1개 (✕)', cells[0].x + cellW - 14, cells[0].y + 36);
          ctx.restore();
        }
        const c2TangX = cells[1].x + cellW * 0.5 + 0.577 * (cellW * 0.25);
        const c2TangY = cells[1].y + cellH * 0.57;
        if (t >= 8.45) {
          drawAnimatedEllipse(c2TangX, c2TangY, 15, 10, subProgress(t, 8.45, 8.95));
          drawCheckMark(cells[1].x + cellW - 34, cells[1].y + 30, subProgress(t, 8.95, 9.25));
          if (t >= 8.95) {
            ctx.fillStyle = '#dc2626';
            ctx.font = '800 12px Pretendard, -apple-system, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('접함 · 실근 2개', cells[1].x + cellW - 42, cells[1].y + 35);
          }
        }
        if (t >= 9.35) {
          ctx.fillStyle = '#2563eb';
          ctx.font = '700 12.5px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('서로 다른 3실근', cells[2].x + cellW - 14, cells[2].y + 36);
        }
        const c4TangX = cells[3].x + cellW * 0.5 - 0.577 * (cellW * 0.25);
        const c4TangY = cells[3].y + cellH * 0.57;
        if (t >= 9.85) {
          drawAnimatedEllipse(c4TangX, c4TangY, 15, 10, subProgress(t, 9.85, 10.35));
          drawCheckMark(cells[3].x + cellW - 34, cells[3].y + 30, subProgress(t, 10.35, 10.70));
          if (t >= 10.35) {
            ctx.fillStyle = '#dc2626';
            ctx.font = '800 12px Pretendard, -apple-system, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('접함 · 실근 2개', cells[3].x + cellW - 42, cells[3].y + 35);
          }
        }

        const sBtn = (i) => ({ x: cells[i].x + cellW - 56, y: cells[i].y + 15 });
        const mHnd = (i, sh) => ({
          x: cells[i].x + cellW * 0.5 + 0.577 * (cellW * 0.25),
          y: cells[i].y + cellH * 0.57 - (-0.385 + sh) * (cellH * 0.34)
        });

        const kfs = [
          { t: 0.0,  x: W * 0.48, y: H * 0.50, mode: 'arrow' },
          { t: 0.55, x: rails.leftSlots[2].x, y: rails.leftSlots[2].y, mode: 'arrow' },
          { t: 0.85, x: rails.leftSlots[2].x, y: rails.leftSlots[2].y, mode: 'arrow' },
          { t: 1.80, x: sBtn(0).x, y: sBtn(0).y, mode: 'arrow' },
          { t: 2.00, x: sBtn(0).x, y: sBtn(0).y, mode: 'arrow', holdDrag: true },
          { t: 2.55, x: cells[1].x + 70, y: cells[1].y + 15, mode: 'arrow' },
          { t: 2.65, x: mHnd(1, 0.72).x, y: mHnd(1, 0.72).y, mode: 'arrow', holdDrag: true },
          { t: 3.10, x: mHnd(1, 0.385).x, y: mHnd(1, 0.385).y, mode: 'arrow' },
          { t: 3.35, x: sBtn(1).x, y: sBtn(1).y, mode: 'arrow' },
          { t: 3.50, x: sBtn(1).x, y: sBtn(1).y, mode: 'arrow', holdDrag: true },
          { t: 4.05, x: cells[2].x + 70, y: cells[2].y + 15, mode: 'arrow' },
          { t: 4.15, x: mHnd(2, 0.385).x, y: mHnd(2, 0.385).y, mode: 'arrow', holdDrag: true },
          { t: 4.60, x: mHnd(2, 0.0).x, y: mHnd(2, 0.0).y, mode: 'arrow' },
          { t: 4.85, x: sBtn(2).x, y: sBtn(2).y, mode: 'arrow' },
          { t: 5.00, x: sBtn(2).x, y: sBtn(2).y, mode: 'arrow', holdDrag: true },
          { t: 5.55, x: cells[3].x + 70, y: cells[3].y + 15, mode: 'arrow' },
          { t: 5.65, x: mHnd(3, 0.0).x, y: mHnd(3, 0.0).y, mode: 'arrow', holdDrag: true },
          { t: 6.10, x: mHnd(3, -0.385).x, y: mHnd(3, -0.385).y, mode: 'arrow' },
          { t: 6.35, x: sBtn(3).x, y: sBtn(3).y, mode: 'arrow' },
          { t: 6.55, x: sBtn(3).x, y: sBtn(3).y, mode: 'arrow' },
          { t: 6.95, x: cells[3].x + cellW - 14, y: cells[3].y + 15, mode: 'arrow' },
          { t: 7.45, x: rails.rightSlots[2].x, y: rails.rightSlots[2].y, mode: 'arrow' },
          { t: 7.65, x: rails.rightSlots[2].x, y: rails.rightSlots[2].y, mode: 'pen' },
          { t: 8.10, x: cells[0].x + cellW - 45, y: cells[0].y + 34, mode: 'pen', holdDrag: true },
          { t: 8.55, x: c2TangX + 12, y: c2TangY - 4, mode: 'pen', holdDrag: true },
          { t: 9.15, x: cells[1].x + cellW - 24, y: cells[1].y + 28, mode: 'pen', holdDrag: true },
          { t: 9.55, x: cells[2].x + cellW - 45, y: cells[2].y + 34, mode: 'pen', holdDrag: true },
          { t: 10.05, x: c4TangX + 12, y: c4TangY - 4, mode: 'pen', holdDrag: true },
          { t: 10.65, x: cells[3].x + cellW - 24, y: cells[3].y + 28, mode: 'pen', holdDrag: true },
          { t: 11.4, x: cells[3].x + cellW - 10, y: cells[3].y + 52, mode: 'pen' }
        ];

        const cur = evalCursorTimeline(kfs, t);
        this.drawCursor(cur.x, cur.y, cur.mode, cur.down, ripple);
      }

      renderTab3(t) {
        const ctx = this.ctx;
        const W = this.W, H = this.H;

        let pulseRight = -1, pulseRightAmt = 0, ripple = -1;
        if (t >= 2.45 && t <= 2.90) {
          pulseRight = 1;
          pulseRightAmt = (t - 2.45) / 0.45;
          ripple = pulseRightAmt;
        }
        const innerClicks = [3.35, 3.72, 4.08, 4.75, 5.95, 7.15, 7.50, 7.85, 8.50, 9.75];
        for (let i = 0; i < innerClicks.length; i++) {
          const ic = innerClicks[i];
          if (t >= ic && t <= ic + 0.34) ripple = (t - ic) / 0.34;
        }

        const rails = this.drawGraphlyWorkspaceFrame({
          showLeftRail: false,
          activeRight: t >= 2.45 ? [1] : [2],
          pulseRight: pulseRight,
          pulseRightAmt: pulseRightAmt,
          rightTooltips: (t >= 2.05 && t < 3.0) ? { 1: '내보내기' } : {}
        });

        if (t < 2.2) this.setCaption('① 문제 아래에 손글씨와 그래프로 풀이를 작성합니다');
        else if (t < 5.2) this.setCaption('② 내보내기(기본 전체 체크)에서 그래프·필기·음성을 지워 [문제]만 링크 복사합니다');
        else if (t < 6.8) this.setCaption('③ 채팅창에 보내면 학생에게 풀이 없이 깔끔한 문제만 먼저 전달됩니다');
        else if (t < 9.1) this.setCaption('④ 다시 모든 항목을 체크한 뒤 링크를 복사합니다');
        else this.setCaption('⑤ 채팅창에 보내면 손글씨 풀이·그래프·음성이 모두 담긴 해설본이 공유됩니다!');

        const availRight = W - 66;
        const gap = 10;
        const noteX = 16, noteY = 20;
        const totalInnerW = availRight - noteX - gap * 2;
        const noteW = Math.round(totalInnerW * 0.385);
        const modalW = Math.round(totalInnerW * 0.295);
        const chatW = totalInnerW - noteW - modalW;
        const noteH = H - 68;

        ctx.save();
        roundRectPath(ctx, noteX, noteY, noteW, noteH, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const probX = noteX + 12, probY = noteY + 12, probW = noteW - 24, probH = 100;
        roundRectPath(ctx, probX, probY, probW, probH, 10);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#2563eb';
        ctx.font = '800 10.5px Pretendard, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('문제 14', probX + 10, probY + 21);

        ctx.fillStyle = '#0f172a';
        ctx.font = '600 11.5px Pretendard, -apple-system, sans-serif';
        ctx.fillText('최고차항 계수가 1인 삼차함수 f(x)가', probX + 10, probY + 44, probW - 20);
        ctx.fillText('f(1) = f(3) = 0 을 만족시킬 때,', probX + 10, probY + 64, probW - 20);
        ctx.fillText('점 (4, f(4))에서의 접선의 기울기는?', probX + 10, probY + 84, probW - 20);

        const solY = probY + probH + 22;
        const w1 = subProgress(t, 0.18, 0.80);
        const w2 = subProgress(t, 0.80, 1.48);
        const w3 = subProgress(t, 1.48, 2.12);

        ctx.save();
        ctx.beginPath();
        ctx.rect(probX, solY - 12, (probW - 6) * w1, 36);
        ctx.clip();
        ctx.fillStyle = '#1d4ed8';
        ctx.font = 'italic 700 12px Georgia, Pretendard, serif';
        ctx.fillText('[풀이] f(x) = (x - 1)(x - 3)(x - k)', probX + 6, solY + 10, probW - 14);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.rect(probX, solY + 24, (probW - 6) * w2, 42);
        ctx.clip();
        ctx.fillStyle = '#334155';
        ctx.font = 'italic 600 11.8px Georgia, Pretendard, serif';
        ctx.fillText("f'(x) = 3x² - 8x + 3 ⇒ f'(4) = 19", probX + 6, solY + 46, probW - 14);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.rect(probX, solY + 62, (probW - 4) * w3, 60);
        ctx.clip();
        ctx.fillStyle = '#dc2626';
        ctx.font = '800 13.5px Pretendard, -apple-system, sans-serif';
        ctx.fillText('∴ 정답: 기울기 19  ✓', probX + 6, solY + 86);
        ctx.beginPath();
        ctx.moveTo(probX + 6, solY + 94);
        ctx.lineTo(probX + 138, solY + 93);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.1;
        ctx.stroke();
        ctx.restore();

        ctx.restore();

        const modalH = 194;
        const modalX = noteX + noteW + gap;
        const modalY = 20;

        const chkStates = [
          true,
          t < 3.35 || t >= 7.15,
          t < 3.72 || t >= 7.50,
          t < 4.08 || t >= 7.85
        ];
        const chipNames = ['문제', '그래프', '필기', '음성'];
        const chipCenters = [];
        let copyBtnCenter = { x: modalX + modalW / 2, y: modalY + 163 };

        if (t >= 2.48) {
          const mPop = easeOutBack(subProgress(t, 2.48, 2.80));
          ctx.save();
          ctx.translate(modalX + modalW / 2, modalY + modalH / 2);
          ctx.scale(clamp(mPop, 0, 1.02), clamp(mPop, 0, 1.02));
          ctx.translate(-(modalX + modalW / 2), -(modalY + modalH / 2));

          ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 6;
          roundRectPath(ctx, modalX, modalY, modalW, modalH, 14);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.shadowColor = 'transparent';

          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          drawGraphlyIcon(ctx, 'export', modalX + 20, modalY + 22, 14, '#0f172a');
          ctx.fillStyle = '#0f172a';
          ctx.font = '800 12.5px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('내보내기', modalX + 32, modalY + 26);

          ctx.fillStyle = '#64748b';
          ctx.font = '700 10.5px Pretendard, -apple-system, sans-serif';
          ctx.fillText('포함 항목', modalX + 12, modalY + 55);

          const cw = (modalW - 30) / 2;
          const ch = 28;
          for (let i = 0; i < 4; i++) {
            const col = i % 2, row = Math.floor(i / 2);
            const cx = modalX + 12 + col * (cw + 6);
            const cy = modalY + 68 + row * (ch + 6);
            chipCenters.push({ x: cx + cw / 2, y: cy + ch / 2 });

            const on = chkStates[i];
            roundRectPath(ctx, cx, cy, cw, ch, 8);
            ctx.fillStyle = on ? '#eff6ff' : '#f8fafc';
            ctx.fill();
            ctx.strokeStyle = on ? '#2563eb' : '#e2e8f0';
            ctx.lineWidth = on ? 1.5 : 1;
            ctx.stroke();

            ctx.fillStyle = on ? '#1d4ed8' : '#94a3b8';
            ctx.font = '700 11px Pretendard, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText((on ? '✓ ' : '') + chipNames[i], cx + cw / 2, cy + 18);
          }

          const copiedNow = (t >= 4.75 && t <= 5.45) || (t >= 8.50 && t <= 9.20);
          roundRectPath(ctx, modalX + 12, modalY + 146, modalW - 24, 34, 9);
          ctx.fillStyle = copiedNow ? '#059669' : '#0f172a';
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = '700 11.5px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(copiedNow ? '✓ 링크 복사 완료!' : '공유 링크 복사', modalX + modalW / 2, modalY + 167);
          copyBtnCenter = { x: modalX + modalW / 2, y: modalY + 163 };

          ctx.restore();
        } else {
          ctx.save();
          roundRectPath(ctx, modalX, modalY, modalW, modalH, 14);
          ctx.strokeStyle = '#e2e8f0';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#94a3b8';
          ctx.font = '600 11px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('우측 [내보내기] 클릭 시', modalX + modalW / 2, modalY + modalH / 2 - 8);
          ctx.fillText('포함 항목 선택 창이 열립니다', modalX + modalW / 2, modalY + modalH / 2 + 10);
          ctx.restore();
        }

        const chatX = modalX + modalW + gap;
        const chatY = 20;
        const chatH = H - 68;

        ctx.save();
        roundRectPath(ctx, chatX, chatY, chatW, chatH, 14);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        roundRectPath(ctx, chatX + 1, chatY + 1, chatW - 2, 34, 13);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 11.5px Pretendard, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('💬 고2 수학반 채팅방 (24)', chatX + 12, chatY + 22);

        if (t >= 5.95) {
          const bPop = easeOutBack(subProgress(t, 5.95, 6.28));
          ctx.save();
          const bx = chatX + 14, by = chatY + 46, bw = chatW - 24, bh = 112;
          ctx.translate(bx + bw, by);
          ctx.scale(clamp(bPop, 0, 1.03), clamp(bPop, 0, 1.03));
          ctx.translate(-(bx + bw), -by);

          roundRectPath(ctx, bx, by, bw, bh, 11);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          roundRectPath(ctx, bx, by, bw, 26, 11);
          ctx.fillStyle = '#fef08a';
          ctx.fill();
          ctx.fillStyle = '#713f12';
          ctx.font = '800 10.5px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('📤 1차 공유: [문제]만 전송됨', bx + 10, by + 17);

          roundRectPath(ctx, bx + 10, by + 33, bw - 20, 46, 6);
          ctx.fillStyle = '#f8fafc';
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#334155';
          ctx.font = '700 10px Pretendard, -apple-system, sans-serif';
          ctx.fillText('문제 14. 삼차함수 f(x)...', bx + 15, by + 50, bw - 30);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '600 9.5px Pretendard, -apple-system, sans-serif';
          ctx.fillText('(풀이 숨김 — 문제 선배포용)', bx + 15, by + 68, bw - 30);

          ctx.fillStyle = '#2563eb';
          ctx.font = '600 10px Pretendard, -apple-system, sans-serif';
          ctx.fillText('graphly.net/#share=prob_only', bx + 10, by + 98, bw - 20);
          ctx.restore();
        }

        if (t >= 9.75) {
          const bPop = easeOutBack(subProgress(t, 9.75, 10.08));
          ctx.save();
          const bx = chatX + 14, by = chatY + 168, bw = chatW - 24, bh = 124;
          ctx.translate(bx + bw, by);
          ctx.scale(clamp(bPop, 0, 1.03), clamp(bPop, 0, 1.03));
          ctx.translate(-(bx + bw), -by);

          roundRectPath(ctx, bx, by, bw, bh, 11);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1.4;
          ctx.stroke();

          roundRectPath(ctx, bx + 1, by + 1, bw - 2, 26, 10);
          ctx.fillStyle = '#dbeafe';
          ctx.fill();
          ctx.fillStyle = '#1e40af';
          ctx.font = '800 10.5px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('🎬 2차 공유: 풀이 · 음성 해설본', bx + 10, by + 17);

          roundRectPath(ctx, bx + 10, by + 33, bw - 20, 58, 6);
          ctx.fillStyle = '#f8fafc';
          ctx.fill();
          ctx.fillStyle = '#334155';
          ctx.font = '700 9.5px Pretendard, -apple-system, sans-serif';
          ctx.fillText('문제 14. 삼차함수 f(x)...', bx + 15, by + 48, bw - 30);
          ctx.fillStyle = '#1d4ed8';
          ctx.fillText("풀이: f'(4) = 19  ✓", bx + 15, by + 64, bw - 30);
          ctx.fillStyle = '#dc2626';
          ctx.fillText('▶ 음성·필기 영상 보기 포함', bx + 15, by + 80, bw - 30);

          ctx.fillStyle = '#2563eb';
          ctx.font = '600 10px Pretendard, -apple-system, sans-serif';
          ctx.fillText('graphly.net/#share=full_lesson', bx + 10, by + 110, bw - 20);
          ctx.restore();
        }

        const inputY = chatY + chatH - 38;
        roundRectPath(ctx, chatX + 8, inputY, chatW - 58, 30, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        const hasDraft1 = t >= 5.35 && t < 5.95;
        const hasDraft2 = t >= 9.15 && t < 9.75;
        if (hasDraft1 || hasDraft2) {
          ctx.fillStyle = '#2563eb';
          ctx.font = '600 10px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(hasDraft1 ? 'graphly.net/#share=prob...' : 'graphly.net/#share=full...', chatX + 14, inputY + 19, chatW - 68);
        } else {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '500 10px Pretendard, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('메시지 입력...', chatX + 14, inputY + 19);
        }

        const sendBtnCenter = { x: chatX + chatW - 27, y: inputY + 15 };
        roundRectPath(ctx, chatX + chatW - 46, inputY, 38, 30, 8);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 11px Pretendard, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('전송', sendBtnCenter.x, inputY + 19);

        ctx.restore();

        const cGraph = chipCenters[1] || { x: modalX + 145, y: modalY + 82 };
        const cInk   = chipCenters[2] || { x: modalX + 55,  y: modalY + 116 };
        const cAudio = chipCenters[3] || { x: modalX + 145, y: modalY + 116 };

        const kfs = [
          { t: 0.0,  x: probX + 20,  y: solY + 8,  mode: 'pen' },
          { t: 0.80, x: probX + 200, y: solY + 10, mode: 'pen', holdDrag: true },
          { t: 0.90, x: probX + 20,  y: solY + 44, mode: 'pen' },
          { t: 1.48, x: probX + 205, y: solY + 46, mode: 'pen', holdDrag: true },
          { t: 1.58, x: probX + 20,  y: solY + 86, mode: 'pen' },
          { t: 2.12, x: probX + 145, y: solY + 90, mode: 'pen', holdDrag: true },
          { t: 2.45, x: rails.rightSlots[1].x, y: rails.rightSlots[1].y, mode: 'arrow' },
          { t: 2.75, x: rails.rightSlots[1].x, y: rails.rightSlots[1].y, mode: 'arrow' },
          { t: 3.35, x: cGraph.x, y: cGraph.y, mode: 'arrow' },
          { t: 3.72, x: cInk.x,   y: cInk.y,   mode: 'arrow' },
          { t: 4.08, x: cAudio.x, y: cAudio.y, mode: 'arrow' },
          { t: 4.75, x: copyBtnCenter.x, y: copyBtnCenter.y, mode: 'arrow' },
          { t: 5.00, x: copyBtnCenter.x, y: copyBtnCenter.y, mode: 'arrow' },
          { t: 5.45, x: chatX + 75, y: inputY + 15, mode: 'arrow' },
          { t: 5.95, x: sendBtnCenter.x, y: sendBtnCenter.y, mode: 'arrow' },
          { t: 6.55, x: sendBtnCenter.x, y: sendBtnCenter.y, mode: 'arrow' },
          { t: 7.15, x: cGraph.x, y: cGraph.y, mode: 'arrow' },
          { t: 7.50, x: cInk.x,   y: cInk.y,   mode: 'arrow' },
          { t: 7.85, x: cAudio.x, y: cAudio.y, mode: 'arrow' },
          { t: 8.50, x: copyBtnCenter.x, y: copyBtnCenter.y, mode: 'arrow' },
          { t: 8.75, x: copyBtnCenter.x, y: copyBtnCenter.y, mode: 'arrow' },
          { t: 9.25, x: chatX + 75, y: inputY + 15, mode: 'arrow' },
          { t: 9.75, x: sendBtnCenter.x, y: sendBtnCenter.y, mode: 'arrow' },
          { t: 12.6, x: sendBtnCenter.x - 16, y: sendBtnCenter.y - 34, mode: 'arrow' }
        ];

        const cur = evalCursorTimeline(kfs, t);
        this.drawCursor(cur.x, cur.y, cur.mode, cur.down, ripple);
      }
    }

    function initGraphlyIntroTour() {
      const modalEl = document.getElementById('graphlyIntroModal');
      if (!modalEl) return;
      const controller = new GraphlyIntroTourController(modalEl);
      window.graphlyIntroTour = controller;

      // 첫 접속자이면서 공유 링크가 아닐 때만 자동 실행
      if (shouldAutoOpenOnBoot && !isSharedOrSpecialEntryUrl()) {
        controller.open();
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initGraphlyIntroTour, { once: true });
    } else {
      initGraphlyIntroTour();
    }
  } catch (err) {
    console.warn('[Graphly Intro Tour skipped safely]:', err);
  }
})();
