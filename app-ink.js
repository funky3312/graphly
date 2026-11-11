/**
 * Graph Master Web - Live Handwriting, Shape Recognition, Lasso & 144Hz Ink Baking Engine (app-ink.js)
 */
{
  const _desc = Object.getOwnPropertyDescriptors(class {
    // --- [✍️ 실시간 무한 칠판 필기 & 주석 (Live Handwriting & Infinite Annotation Engine)] ---
    initInkControls() {
      const btnHeader = document.getElementById('btnInkMode');
      const btnQuick = document.getElementById('btnQuickInk');
      const btnClose = document.getElementById('btnInkClose');
      const btnToPill = document.getElementById('btnInkToPillRemote');

      if (btnHeader) btnHeader.onclick = () => this.toggleBottomInkBar();
      if (btnQuick) btnQuick.onclick = () => this.toggleBottomInkBar();
      if (btnClose) btnClose.onclick = () => this.toggleBottomInkBar(false);
      if (btnToPill) {
        btnToPill.onclick = (e) => {
          e.stopPropagation();
          this.switchToQuickPillRemote();
        };
      }

      // 테마 연동 잉크 팔레트 초기 셋팅
      this.updateInkPaletteUI();

      // 툴 선택 버튼
      const btnSelect = document.getElementById('btnInkSelect');
      const btnPen = document.getElementById('btnInkPen');
      const btnHighlighter = document.getElementById('btnInkHighlighter');
      const btnEraser = document.getElementById('btnInkEraser');
      const btnLasso = document.getElementById('btnInkLasso');
      const btnLaser = document.getElementById('btnInkLaser');
      const btnSticker = document.getElementById('btnInkSticker');
      const btnAxes = document.getElementById('btnInkToggleAxes');

      if (btnSelect) btnSelect.onclick = () => this.setActiveInkTool('select');
      if (btnPen) btnPen.onclick = () => this.setActiveInkTool('pen');
      if (btnHighlighter) btnHighlighter.onclick = () => this.setActiveInkTool('highlighter');
      if (btnEraser) btnEraser.onclick = () => this.setActiveInkTool('eraser');
      if (btnLasso) btnLasso.onclick = () => this.setActiveInkTool('lasso');
      if (btnLaser) btnLaser.onclick = () => this.setActiveInkTool('laser');
      if (btnSticker) btnSticker.onclick = () => this.setActiveInkTool('sticker');
      if (btnAxes) btnAxes.onclick = () => this.toggleAxes();
      this.updateAxesUI();

      // 색상 선택
      document.querySelectorAll('.ink-color-dot').forEach(dot => {
        dot.onclick = (e) => {
          const color = e.currentTarget.dataset.color;
          this.setInkColor(color);
        };
      });
      this._applyCurrentToolColorUI(this.currentInkColor || '#1e293b');

      // 굵기 선택
      document.querySelectorAll('.ink-size-btn').forEach(btn => {
        btn.onclick = (e) => {
          const size = parseFloat(e.currentTarget.dataset.size);
          this.setInkSize(size);
        };
      });

      // 🌟 [대표님 피드백]: 글씨 굵기/크기 ◀ ▶ 화살표 0.2 단위 직관 조절 & 영구 기억 🌟
      try {
        const savedInkSize = parseFloat(localStorage.getItem('graphly_ink_size_v1'));
        if (!isNaN(savedInkSize) && savedInkSize >= 1.0 && savedInkSize <= 24.0) {
          this.setInkSize(savedInkSize);
        }
      } catch (err) { }

      const btnInkSizeDown = document.getElementById('btnInkSizeDown');
      if (btnInkSizeDown) {
        btnInkSizeDown.onclick = (e) => {
          e.stopPropagation();
          const cur = this.currentInkSize || 4.2;
          const target = Math.max(1.0, parseFloat((cur - 0.2).toFixed(1)));
          this.setInkSize(target);
        };
      }

      const btnInkSizeUp = document.getElementById('btnInkSizeUp');
      if (btnInkSizeUp) {
        btnInkSizeUp.onclick = (e) => {
          e.stopPropagation();
          const cur = this.currentInkSize || 4.2;
          const target = Math.min(18.0, parseFloat((cur + 0.2).toFixed(1)));
          this.setInkSize(target);
        };
      }

      const btnInkSizePicker = document.getElementById('btnInkSizePicker');
      const inkSizeFlyout = document.getElementById('inkSizeFlyout');
      if (btnInkSizePicker && inkSizeFlyout) {
        let lastToggleTime = 0;
        btnInkSizePicker.onclick = (e) => {
          e.stopPropagation();
          const now = performance.now();
          if (now - lastToggleTime < 45) return;
          lastToggleTime = now;
          const isOpen = inkSizeFlyout.style.display !== 'none';
          inkSizeFlyout.style.display = isOpen ? 'none' : 'block';
          btnInkSizePicker.classList.toggle('open', !isOpen);
          if (document.activeElement && document.activeElement !== document.body) {
            try { document.activeElement.blur(); } catch (err) { }
          }
        };

        document.addEventListener('pointerdown', (e) => {
          if (inkSizeFlyout.style.display === 'none') return;
          if (!inkSizeFlyout.contains(e.target) && !btnInkSizePicker.contains(e.target)) {
            inkSizeFlyout.style.display = 'none';
            btnInkSizePicker.classList.remove('open');
          }
        }, true);
      }

      const sliderInkSize = document.getElementById('sliderInkSize');
      if (sliderInkSize) {
        sliderInkSize.oninput = (e) => {
          const val = parseFloat(e.target.value);
          this.setInkSize(val);
        };
        sliderInkSize.onchange = () => {
          try { sliderInkSize.blur(); } catch (err) { }
        };

        const previewRow = sliderInkSize.closest('.ink-size-preview-row') || sliderInkSize.parentElement;
        const updateSliderFromPointer = (clientX) => {
          const rect = sliderInkSize.getBoundingClientRect();
          if (!rect || rect.width <= 0) return;
          const pad = 7;
          const effWidth = Math.max(1, rect.width - pad * 2);
          const ratio = Math.max(0, Math.min(1, (clientX - (rect.left + pad)) / effWidth));
          const min = parseFloat(sliderInkSize.min) || 1.0;
          const max = parseFloat(sliderInkSize.max) || 18.0;
          const step = parseFloat(sliderInkSize.step) || 0.2;
          const raw = min + ratio * (max - min);
          const stepped = Math.round(raw / step) * step;
          const finalVal = Math.max(min, Math.min(max, parseFloat(stepped.toFixed(1))));
          sliderInkSize.value = finalVal;
          this.setInkSize(finalVal);
        };

        let isDraggingInkSlider = false;
        const onSliderPointerDown = (e) => {
          if (e.button && e.button !== 0) return;
          if (e.target && e.target.closest && e.target.closest('button')) return;
          const rect = sliderInkSize.getBoundingClientRect();
          if (rect && rect.width > 0 && e.clientX >= rect.left - 8 && e.clientX <= rect.right + 12) {
            e.preventDefault();
            e.stopPropagation();
            isDraggingInkSlider = true;
            if (e.pointerId !== undefined && sliderInkSize.setPointerCapture) {
              try { sliderInkSize.setPointerCapture(e.pointerId); } catch (err) { }
            }
            updateSliderFromPointer(e.clientX);
            if (document.activeElement && document.activeElement !== document.body) {
              try { document.activeElement.blur(); } catch (err) { }
            }
          }
        };

        const onSliderPointerMove = (e) => {
          if (!isDraggingInkSlider) return;
          e.preventDefault();
          e.stopPropagation();
          updateSliderFromPointer(e.clientX);
        };

        const onSliderPointerUp = (e) => {
          if (!isDraggingInkSlider) return;
          isDraggingInkSlider = false;
          if (e.pointerId !== undefined && sliderInkSize.releasePointerCapture) {
            try {
              if (!sliderInkSize.hasPointerCapture || sliderInkSize.hasPointerCapture(e.pointerId)) {
                sliderInkSize.releasePointerCapture(e.pointerId);
              }
            } catch (err) { }
          }
          try { sliderInkSize.blur(); } catch (err) { }
        };

        if (previewRow) {
          previewRow.addEventListener('pointerdown', onSliderPointerDown, { passive: false });
        } else {
          sliderInkSize.addEventListener('pointerdown', onSliderPointerDown, { passive: false });
        }
        window.addEventListener('pointermove', onSliderPointerMove, { passive: false });
        window.addEventListener('pointerup', onSliderPointerUp);
        window.addEventListener('pointercancel', onSliderPointerUp);
      }

      // 🖍️ 블러 · 형광펜 크기 · 🧼 지우개 크기 슬라이더/스테퍼 연동 (스타일 메뉴 통합)
      const bindSmoothStyleSlider = (sliderEl, applyFn) => {
        if (!sliderEl) return;
        sliderEl.oninput = (e) => {
          applyFn(parseFloat(e.target.value));
        };
        sliderEl.onchange = () => {
          try { sliderEl.blur(); } catch (err) { }
        };
        const rowEl = sliderEl.closest('.ink-size-preview-row') || sliderEl.parentElement;
        const updateFromX = (clientX) => {
          const rect = sliderEl.getBoundingClientRect();
          if (!rect || rect.width <= 0) return;
          const pad = 7;
          const effWidth = Math.max(1, rect.width - pad * 2);
          const ratio = Math.max(0, Math.min(1, (clientX - (rect.left + pad)) / effWidth));
          const parsedMin = parseFloat(sliderEl.min);
          const min = Number.isFinite(parsedMin) ? parsedMin : 4;
          const parsedMax = parseFloat(sliderEl.max);
          const max = Number.isFinite(parsedMax) ? parsedMax : 44;
          const parsedStep = parseFloat(sliderEl.step);
          const step = (Number.isFinite(parsedStep) && parsedStep > 0) ? parsedStep : 2;
          const raw = min + ratio * (max - min);
          const stepped = Math.round(raw / step) * step;
          const finalVal = Math.max(min, Math.min(max, parseFloat(stepped.toFixed(2))));
          sliderEl.value = finalVal;
          applyFn(finalVal);
        };
        let dragging = false;
        const onDown = (e) => {
          if (e.button && e.button !== 0) return;
          if (e.target && e.target.closest && e.target.closest('button')) return;
          const rect = sliderEl.getBoundingClientRect();
          if (rect && rect.width > 0 && e.clientX >= rect.left - 8 && e.clientX <= rect.right + 12) {
            e.preventDefault();
            e.stopPropagation();
            dragging = true;
            if (e.pointerId !== undefined && sliderEl.setPointerCapture) {
              try { sliderEl.setPointerCapture(e.pointerId); } catch (err) { }
            }
            updateFromX(e.clientX);
          }
        };
        const onMove = (e) => {
          if (!dragging) return;
          e.preventDefault();
          e.stopPropagation();
          updateFromX(e.clientX);
        };
        const onUp = (e) => {
          if (!dragging) return;
          dragging = false;
          if (e.pointerId !== undefined && sliderEl.releasePointerCapture) {
            try { sliderEl.releasePointerCapture(e.pointerId); } catch (err) { }
          }
        };
        (rowEl || sliderEl).addEventListener('pointerdown', onDown, { passive: false });
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      };

      try {
        const savedSoftBlur = parseFloat(localStorage.getItem('graphly_ink_soft_blur_v1'));
        if (!isNaN(savedSoftBlur) && savedSoftBlur >= 0 && savedSoftBlur <= 5.0) {
          this.setInkSoftBlur(savedSoftBlur, false);
        } else {
          this.setInkSoftBlur(this.inkSoftBlur || 0, false);
        }
      } catch (err) { }

      const btnBlurDown = document.getElementById('btnInkBlurDown');
      if (btnBlurDown) {
        btnBlurDown.onclick = (e) => {
          e.stopPropagation();
          const cur = typeof this.inkSoftBlur === 'number' ? this.inkSoftBlur : 0;
          this.setInkSoftBlur(Math.max(0, parseFloat((cur - 0.5).toFixed(1))));
        };
      }
      const btnBlurUp = document.getElementById('btnInkBlurUp');
      if (btnBlurUp) {
        btnBlurUp.onclick = (e) => {
          e.stopPropagation();
          const cur = typeof this.inkSoftBlur === 'number' ? this.inkSoftBlur : 0;
          this.setInkSoftBlur(Math.min(5.0, parseFloat((cur + 0.5).toFixed(1))));
        };
      }
      bindSmoothStyleSlider(document.getElementById('sliderInkBlur'), (val) => this.setInkSoftBlur(val));

      try {
        const savedHlSize = parseFloat(localStorage.getItem('graphly_highlighter_size_v1'));
        if (!isNaN(savedHlSize) && savedHlSize >= 6 && savedHlSize <= 48) {
          this.setHighlighterSize(savedHlSize);
        } else {
          this.setHighlighterSize(this.currentHighlighterSize || 16);
        }
      } catch (err) { }

      const btnHlDown = document.getElementById('btnHighlighterSizeDown');
      if (btnHlDown) {
        btnHlDown.onclick = (e) => {
          e.stopPropagation();
          this.setHighlighterSize((this.currentHighlighterSize || 16) - 2);
        };
      }
      const btnHlUp = document.getElementById('btnHighlighterSizeUp');
      if (btnHlUp) {
        btnHlUp.onclick = (e) => {
          e.stopPropagation();
          this.setHighlighterSize((this.currentHighlighterSize || 16) + 2);
        };
      }
      bindSmoothStyleSlider(document.getElementById('sliderHighlighterSize'), (val) => this.setHighlighterSize(val));

      try {
        const savedErSize = parseFloat(localStorage.getItem('graphly_eraser_size_v1'));
        if (!isNaN(savedErSize) && savedErSize >= 4 && savedErSize <= 48) {
          this.setEraserSize(savedErSize);
        } else {
          this.setEraserSize(this.currentEraserSize || 14);
        }
      } catch (err) { }

      const btnErDown = document.getElementById('btnEraserSizeDown');
      if (btnErDown) {
        btnErDown.onclick = (e) => {
          e.stopPropagation();
          this.setEraserSize((this.currentEraserSize || 14) - 2);
        };
      }
      const btnErUp = document.getElementById('btnEraserSizeUp');
      if (btnErUp) {
        btnErUp.onclick = (e) => {
          e.stopPropagation();
          this.setEraserSize((this.currentEraserSize || 14) + 2);
        };
      }
      bindSmoothStyleSlider(document.getElementById('sliderEraserSize'), (val) => this.setEraserSize(val));

      // 전체 지우기
      const btnClearAll = document.getElementById('btnInkClearAll');
      if (btnClearAll) {
        btnClearAll.onclick = () => this.clearAllInk();
      }

      // 🔍 펜 툴바 일체형 큼직한 퀵 줌 [− | +] (판서 모드에서는 판서 글씨만 독립 줌, 그래프 모드에서는 그래프 줌!)
      const btnInkZoomOut = document.getElementById('btnInkZoomOut');
      const btnInkZoomIn = document.getElementById('btnInkZoomIn');
      if (btnInkZoomOut) btnInkZoomOut.onclick = () => { this.zoomByStep(-0.12); };
      if (btnInkZoomIn) btnInkZoomIn.onclick = () => { this.zoomByStep(0.12); };

      // 🖐️ 좌측 레일 툴바 엄지 전용 큼직한 위/아래 줌 [+] / [−] (양손 멀티태스킹 최적화)
      const btnRailZoomIn = document.getElementById('btnRailZoomIn');
      const btnRailZoomOut = document.getElementById('btnRailZoomOut');
      if (btnRailZoomIn) btnRailZoomIn.onclick = () => { this.zoomByStep(0.12); };
      if (btnRailZoomOut) btnRailZoomOut.onclick = () => { this.zoomByStep(-0.12); };

      // 독 드래그 이동 및 액정타블렛 전용 알약 리모컨 초기화
      this.initInkDockDraggable();
      this.initQuickPillRemote();

      // 🌟 [액정타블렛 특화]: 가상 연필 & 지우개 인디케이터 초기화
      this.virtualStylusEl = document.getElementById('virtualStylusPen');
      this.stylusPenSvg = document.getElementById('stylusPenSvg');
      this.stylusEraserSvg = document.getElementById('stylusEraserSvg');
      this.stylusHighlighterSvg = document.getElementById('stylusHighlighterSvg');
      this.stylusLaserSvg = document.getElementById('stylusLaserSvg');
      this.stylusArrowSvg = document.getElementById('stylusArrowSvg');
      this.stylusPointerSvg = document.getElementById('stylusPointerSvg');
      this.stylusGrabSvg = document.getElementById('stylusGrabSvg');
      this.stylusGrabbingSvg = document.getElementById('stylusGrabbingSvg');
      this.stylusCrosshairSvg = document.getElementById('stylusCrosshairSvg');
      this.stylusClickRippleEl = document.getElementById('stylusClickRipple');
      this.stylusColorBand = document.getElementById('stylusColorBand');
      if (this.stylusColorBand) {
        this.stylusColorBand.setAttribute('fill', this.currentInkColor || '#00d2d3');
      }
      this._isPointerInsideWindow = true;

      // 🌟 [대표님 피드백 반영]: 액정타블렛에서 설명 중 펜이 액정에서 멀어져도(pointerleave)
      // 이동 손바닥·십자 커서와 동일하게 가상 펜(펜·형광펜·지우개·레이저)이 깜빡이며 사라지지 않고 마지막 칠판 위치에 그대로 유지되도록 고정!
      this._windowPointerLeaveBound = true;

      // 🌟 [대표님 킬러 UX]: 메뉴/툴바/슬라이드바/카드 위로 마우스가 올라갔을 때 가상 펜 즉시 숨김 -> 해당 요소 고유 커서(손가락/손바닥) 노출!
      const menuContainerSelectors = [
        'header',
        '#headerShowTab',
        '#sidebarRail',
        '#railDock',
        '#railDrawer',
        '#rightActionToolbar',
        '#inkFloatingToolbar',
        '#lassoActionFloatingBar',
        '#quickPillRemote',
        '.canvas-quick-toolbar',
        '#boardModeBar',
        '#nAxisModeBar',
        '#audioSyncFloatingBar',
        '#sharedResetBar',
        '#lessonPlaylistNavBar',
        '#pdfBoardNavBar',
        '#topSlideBarMiniTab',
        '#curveContextBar',
        '#graphSnapFloatingBar',
        '#problemCardHeader',
        '#graphCardHeader',
        '#problemCardResizeHandle',
        '#graphCardResizeHandle',
        '#modalSmartInput',
        '#modalShare',
        '#modalPdfViewer',
        '#modalCloudHub',
        '#modalNAxisStudio',
        '#modalMathToolkitLauncher'
      ];
      menuContainerSelectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) {
          el.addEventListener('pointerenter', () => {
            if (this.virtualStylusEl && !this.isAudioPlaying) this.virtualStylusEl.style.display = 'none';
          });
        }
      });
    }

    isPointerOverMenu(e) {
      if (this._isPointerInsideWindow === false) return true;
      if (!e) return false;
      if (e._overMenuChecked !== undefined) return e._overMenuResult;
      const res = this._evalIsPointerOverMenu(e);
      e._overMenuChecked = true;
      e._overMenuResult = res;
      return res;
    }

    _evalIsPointerOverMenu(e) {
      const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
      const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
      if (clientX === null || clientY === null) return false;
      if (clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight) return true;

      // e.target이 명확한 DOM 엘리먼트이면 비용이 큰 document.elementFromPoint 호출을 생략!
      const targetEl = (e.target && e.target !== window && e.target !== document && typeof e.target.closest === 'function')
        ? e.target
        : null;

      // 메인 캔버스 위에서 움직이는 경우
      if (targetEl && (targetEl === this.canvas || targetEl.id === 'graphCanvas')) {
        if (this.isDrawingInk || this.isStylusDrawing) {
          return false;
        }
        const rect = this.canvasRect || this.updateCanvasRect();
        if (rect && (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom)) {
          return true;
        }
        return false;
      }

      const el = targetEl || document.elementFromPoint(clientX, clientY);
      if (!el || typeof el.closest !== 'function') return true; // 뷰포트 바깥

      // 🌟 [대표님 킬러 기획: 카드 위 [✒️ 필기] ON 또는 [🔴 레이저] 도구 활성 시 카드 몸통 위에서도 가상 펜/레이저 포인터 표시!]
      const cardBodyEl = el.closest('.problem-card-body');
      if (cardBodyEl && !el.closest('.problem-card-header, .problem-card-resize-handle, button, .card-btn')) {
        const parentCard = cardBodyEl.closest('.problem-card-widget, .graph-card-widget, .extra-problem-card-widget, .extra-graph-card-widget');
        if (parentCard && !parentCard.classList.contains('minimized')) {
          const isGlobalLaser = Boolean(this.isInkMode && this.activeInkTool === 'laser');
          const isCardInkOn = Boolean(
            parentCard.classList.contains('card-ink-active') &&
            this.isInkMode &&
            (this.activeInkTool === 'pen' || this.activeInkTool === 'highlighter' || this.activeInkTool === 'eraser')
          );
          if (isGlobalLaser || isCardInkOn) {
            return false;
          }
        }
        return true;
      }

      // 1. 명시적인 메뉴/툴바/문제카드/그래프카드/버튼/헤더/입력창 체크 -> 가상 펜 즉시 숨김 & 해당 아이콘(손가락/손바닥) 커서 노출!
      const isExplicitMenu = !!(
        el.closest('header') ||
        el.closest('.header-show-tab') ||
        el.closest('.sidebar-rail') ||
        el.closest('#railDock') ||
        el.closest('.rail-dock') ||
        el.closest('#railDrawer') ||
        el.closest('.rail-drawer') ||
        el.closest('#rightActionToolbar') ||
        el.closest('.ink-floating-toolbar') ||
        el.closest('#inkFloatingToolbar') ||
        el.closest('.lasso-action-floating-bar') ||
        el.closest('#lassoActionFloatingBar') ||
        el.closest('.quick-pill-remote') ||
        el.closest('#quickPillRemote') ||
        el.closest('.canvas-quick-toolbar') ||
        el.closest('.quick-flyout-panel') ||
        el.closest('.board-mode-bar') ||
        el.closest('.n-axis-mode-bar') ||
        el.closest('.audio-sync-floating-bar') ||
        el.closest('#audioSyncFloatingBar') ||
        el.closest('.shared-reset-bar') ||
        el.closest('.lesson-playlist-nav-bar') ||
        el.closest('#lessonPlaylistNavBar') ||
        el.closest('.pdf-board-nav-bar') ||
        el.closest('.top-slide-bar-mini-tab') ||
        el.closest('.curve-context-bar') ||
        el.closest('#curveContextBar') ||
        el.closest('.graph-snap-floating-bar') ||
        el.closest('#graphSnapFloatingBar') ||
        el.closest('.problem-card-widget') ||
        el.closest('.graph-card-widget') ||
        el.closest('.extra-problem-card-widget') ||
        el.closest('.extra-graph-card-widget') ||
        el.closest('.problem-card-header') ||
        el.closest('.problem-card-body') ||
        el.closest('.problem-card-resize-handle') ||
        el.closest('.smart-modal-backdrop') ||
        el.closest('.smart-modal-card') ||
        el.closest('.pdf-modal-backdrop') ||
        el.closest('#modalPdfViewer') ||
        el.closest('.pdf-modal-container') ||
        el.closest('.n-axis-studio-backdrop') ||
        el.closest('.pw-region-popover') ||
        el.closest('.btn-exit-fullscreen') ||
        el.closest('.drop-line-label-input') ||
        el.closest('.canvas-text-input') ||
        el.closest('button') ||
        el.closest('a') ||
        el.closest('label') ||
        el.closest('input') ||
        el.closest('select') ||
        el.closest('textarea') ||
        el.closest('[role="button"]') ||
        el.closest('.modal-overlay') ||
        el.closest('.card-btn') ||
        el.closest('.slide-num-chip')
      );
      if (isExplicitMenu) return true;

      // 2. 판서 가능 서피스(오직 메인 칠판 캔버스만!)인지 확인
      const isCanvasSurface = (
        el === this.canvas ||
        el.id === 'graphCanvas' ||
        (el.classList && el.classList.contains('canvas-container'))
      );

      if (!isCanvasSurface) return true;

      if (this.canvas) {
        const rect = this.canvasRect || this.updateCanvasRect();
        const insideMainCanvas = rect && (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
        if (!insideMainCanvas) return true;
      }

      return false;
    }

    /**
     * 🛡️ [스마트 팜 리젝션(손바닥 차단) vs 적외선 전자칠판(IR 터치 펜) 자동 판별 엔진]
     * - 아이패드(iPadOS/iOS)이거나, 애플펜슬·S펜·서피스펜 등 전용 스타일러스(e.pointerType === 'pen')가
     *   단 한 번이라도 감지된 태블릿 환경에서는 true를 반환하여 손바닥/손가락(touch) 필기를 100% 차단합니다.
     * - 반면 전용 pen 신호 없이 플라스틱 펜을 touch 신호로 보내는 대형 적외선 전자칠판·터치 모니터에서는
     *   false를 반환하여 [✒️ 필기] 모드에서 1포인트 touch로 글씨·형광펜·지우개·올가미·레이저·수선·캡처가
     *   마우스/펜과 동일하게 작동하고, 두 손가락(2-finger) 터치 시에는 즉시 핀치 줌이 작동하도록 지원합니다.
     */
    isIOSOrIPad() {
      if (this._isIOSOrIPadDevice === undefined) {
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
        const plat = (typeof navigator !== 'undefined' && navigator.platform) ? navigator.platform : '';
        const maxTP = (typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number') ? navigator.maxTouchPoints : 0;
        this._isIOSOrIPadDevice = /iPad|iPhone|iPod/i.test(ua) || (plat === 'MacIntel' && maxTP > 1);
      }
      return Boolean(this._isIOSOrIPadDevice);
    }

    /**
     * 🎛️ [PC(액정타블렛·전자칠판) vs 아이패드(iPadOS WebKit) 이원화 필기 프로파일]
     * - PC와 아이패드의 샘플 수집 방식·보정치·감도를 완벽히 분리하여, 한쪽 기기 튜닝이 다른 기기에 절대 영향을 주지 않도록 관리합니다.
     */
    getDeviceInkProfile() {
      if (this._inkProfileCache) return this._inkProfileCache;
      if (this.isIOSOrIPad()) {
        this._inkProfileCache = {
          deviceType: 'ipad',
          useCoalescedEvents: (() => {
            try { return localStorage.getItem('graphly_ipad_coalesced') === '1'; } catch (_) { return false; }
          })(),
          minRawDistPen: 0.2,            // ink-diag 100% 동일 기준: 단획(ㄴ, ㅡ, ㅣ, 받침, 점) pointermove 누락 원천 차단
          minRawDistMouse: 1.5,
          minCardDistPen: 0.2,           // 카드 내부 아이패드 필기 최소 점 간격 (px)
          minCardDistMouse: 1.2,
          forwardGuardMaxDist: 0,        // 아이패드는 단일 확정 이벤트([e])만 사용하므로 역주행 컷오프 비활성화 (작은 꺾임 획 증발 원천 차단)
          forwardGuardMinCos: -1.0,
          streamlineWeight: 0.14,        // 아이패드 강화유리 맞춤 1차 EMA 보정 강도 (단획 축소 방지)
          streamlineDecayDist: 16.0      // 빠른 원/곡선에서 보정이 0으로 감쇠되는 거리 (px)
        };
        return this._inkProfileCache;
      }
      this._inkProfileCache = {
        deviceType: 'pc',
        useCoalescedEvents: true,        // PC 액정타블렛 240Hz 서브 샘플 수집 (빠른 원·작은 곡선 제어점 보존)
        coalescedMergeMaxSpan: 1.4,      // 펜이 거의 멈춘 초저속(<1.4px/frame) 제자리 코일 진동일 때만 프레임 내 가중 평균 병합
        minRawDistPen: 0.45,             // 원시 중복 샘플 컷오프 (px) — 세밀한 모서리 감지를 위해 240Hz 원시 궤적 보존
        minRawDistMouse: 0.85,           // 마우스/전자칠판 원시 최소 점 간격 (px)
        minCardDistPen: 0.40,            // 카드 내부 PC 액정타블렛 원시 최소 점 간격 (px)
        minCardDistMouse: 0.75,
        pcFairStepPen: 1.95,             // 칠판 PC 2차 다항식 다림질 기준 등간격 리샘플 보폭 (px) — 6~12px 격자 물결 제거 최적 스팬
        pcFairStepMouse: 2.10,
        pcFairCardStepPen: 1.65,         // 카드 내부 작은 수식용 PC 2차 다항식 다림질 보폭 (px)
        pcFairCardStepMouse: 1.80,
        forwardGuardMaxDist: 1.5,        // 펜 정지 직전 1.5px 이내 미세 역주행 스파이크만 차단
        forwardGuardMinCos: -0.55,       // 직각·예각 글씨 꺾임은 100% 통과시키고 123° 이상 역방향 튐만 폐기
        streamlineWeight: 0.14,          // 형광펜/보조 경로용 표준 경량값
        streamlineDecayDist: 15.0
      };
      return this._inkProfileCache;
    }

    /**
     * 🎯 [PC 액정타블렛 전용 무수축 2차 곡선 다림질 엔진 (Zero-Shrinkage Quadratic Savitzky-Golay Streaming Fairer)]
     * - 아이패드(deviceType === 'ipad')에서는 단 1줄도 호출되지 않으며, 오직 PC 환경에서만 작동합니다.
     * - 왜 단방향 EMA(streamline) 대신 대칭형 2차 다항식 필터인가?
     *   1) 액정타블렛(Wacom/Huion/XP-Pen EMR) 대각선·곡선 필기 시 발생하는 파장 6~12px의 센서 격자 물결(Wobble)은
     *      단방향 EMA로 잡으려 하면 위상 지연 때문에 글씨가 짧아지고 작은 고리('6, 8, 9, 0')가 안쪽으로 쪼그라듭니다.
     *   2) 반면 시작점·끝점·급격한 모서리('7, ㄱ, ㄴ, ㄹ')를 Pin(고정)한 상태에서 내부 제어점에 대칭 5/7점 2차(Quadratic)
     *      Savitzky-Golay 필터([-3,12,17,12,-3]/35, [-2,3,6,7,6,3,-2]/21)를 스트리밍 적용하면:
     *      - 포물선·원호(2차 곡률)를 수학적으로 100% 보존하여 작은 원 반지름 수축 0% 달성
     *      - 시작점과 끝점 고정(Pinning)으로 짧은 획·받침·점 잘림(짤뚱해짐) 0.00px 보장
     *      - 모서리 고정(Corner Pinning)으로 '7'의 꺾임 각도를 칼날처럼 보존하면서 대각선·곡선 표면 물결만 매끄럽게 제거합니다.
     */
    _selectPcCoalescedEvents(e, inkProfile) {
      if (!inkProfile || !inkProfile.useCoalescedEvents || typeof e.getCoalescedEvents !== 'function') {
        return [e];
      }
      const coalesced = e.getCoalescedEvents();
      if (!coalesced || coalesced.length <= 1) {
        return (coalesced && coalesced.length === 1) ? coalesced : [e];
      }
      if (inkProfile.deviceType !== 'pc') {
        return coalesced;
      }
      const maxSpan = inkProfile.coalescedMergeMaxSpan || 1.4;
      let subPathLen = 0;
      for (let i = 1; i < coalesced.length; i++) {
        const p0 = coalesced[i - 1];
        const p1 = coalesced[i];
        subPathLen += Math.hypot((p1.clientX || 0) - (p0.clientX || 0), (p1.clientY || 0) - (p0.clientY || 0));
        if (subPathLen >= maxSpan) {
          return coalesced;
        }
      }
      let sumX = 0;
      let sumY = 0;
      let sumW = 0;
      for (let i = 0; i < coalesced.length; i++) {
        const cEv = coalesced[i];
        const w = i + 1;
        sumX += (typeof cEv.clientX === 'number' ? cEv.clientX : e.clientX) * w;
        sumY += (typeof cEv.clientY === 'number' ? cEv.clientY : e.clientY) * w;
        sumW += w;
      }
      const lastEv = coalesced[coalesced.length - 1] || e;
      return [{
        clientX: sumX / sumW,
        clientY: sumY / sumW,
        pointerType: e.pointerType,
        pressure: (typeof lastEv.pressure === 'number') ? lastEv.pressure : e.pressure,
        timeStamp: (typeof lastEv.timeStamp === 'number' && lastEv.timeStamp > 0) ? lastEv.timeStamp : e.timeStamp
      }];
    }

    _createPcStrokeFairer(minStep = 1.95) {
      const stepPx = Math.max(1.1, Number(minStep) || 1.95);
      const buf = [];
      const rawHist = [];
      let segRaws = [];
      let emittedIdx = -1;
      let lastRaw = null;

      const findBackAnchor = (fromRawIdx, minDist = 1.25) => {
        const origin = rawHist[fromRawIdx];
        if (!origin) return null;
        const minScanIdx = Math.max(0, fromRawIdx - 24);
        for (let j = fromRawIdx - 1; j >= minScanIdx; j--) {
          const cand = rawHist[j];
          if (Math.hypot(origin.x - cand.x, origin.y - cand.y) >= minDist) {
            return cand;
          }
        }
        return fromRawIdx > 0 ? rawHist[minScanIdx] : null;
      };

      const fairAt = (idx) => {
        const pt = buf[idx];
        if (!pt) return null;
        if (pt.pinned || idx <= 0 || idx >= buf.length - 1) {
          return { x: pt.x, y: pt.y, p: pt.p, t: pt.t };
        }

        let usableR = 0;
        for (let r = 1; r <= 3; r++) {
          if (idx - r < 0 || idx + r >= buf.length) break;
          // 모서리/끝점 Pin을 경계로 삼는 것은 허용하되, Pin 너머 다른 획 구간을 침범하지 않도록 차단
          if (r >= 2 && (buf[idx - r + 1].pinned || buf[idx + r - 1].pinned)) break;

          const pL = buf[idx - r];
          const pR = buf[idx + r];
          const vx1 = pt.x - pL.x;
          const vy1 = pt.y - pL.y;
          const vx2 = pR.x - pt.x;
          const vy2 = pR.y - pt.y;
          const dL = Math.hypot(vx1, vy1);
          const dR = Math.hypot(vx2, vy2);
          if (dL < 0.05 || dR < 0.05) break;

          if (r >= 2) {
            // 급가속/급감속 비대칭 보폭 또는 초소형 루프('6' 하단 작은 고리 등 >93° 회전) 과스팬 보호
            if (dL > 11.5 || dR > 11.5) break;
            if (Math.max(dL, dR) > Math.min(dL, dR) * 2.35 + 2.5) break;
            const spanCos = (vx1 * vx2 + vy1 * vy2) / (dL * dR);
            if (spanCos < -0.05) break;
          } else {
            const turnCos = (vx1 * vx2 + vy1 * vy2) / (dL * dR);
            if (turnCos < 0.35) break;
          }
          usableR = r;
        }

        let fx = pt.x;
        let fy = pt.y;
        if (usableR === 3) {
          const m3 = buf[idx - 3], m2 = buf[idx - 2], m1 = buf[idx - 1];
          const p1 = buf[idx + 1], p2 = buf[idx + 2], p3 = buf[idx + 3];
          fx = (-2 * (m3.x + p3.x) + 3 * (m2.x + p2.x) + 6 * (m1.x + p1.x) + 7 * pt.x) / 21;
          fy = (-2 * (m3.y + p3.y) + 3 * (m2.y + p2.y) + 6 * (m1.y + p1.y) + 7 * pt.y) / 21;
        } else if (usableR === 2) {
          const m2 = buf[idx - 2], m1 = buf[idx - 1];
          const p1 = buf[idx + 1], p2 = buf[idx + 2];
          fx = (-3 * (m2.x + p2.x) + 12 * (m1.x + p1.x) + 17 * pt.x) / 35;
          fy = (-3 * (m2.y + p2.y) + 12 * (m1.y + p1.y) + 17 * pt.y) / 35;
        } else if (usableR === 1) {
          const m1 = buf[idx - 1];
          const p1 = buf[idx + 1];
          fx = 0.16 * (m1.x + p1.x) + 0.68 * pt.x;
          fy = 0.16 * (m1.y + p1.y) + 0.68 * pt.y;
        }

        let fp = pt.p;
        if (usableR >= 1) {
          const m1 = buf[idx - 1];
          const p1 = buf[idx + 1];
          if (typeof m1.p === 'number' && typeof pt.p === 'number' && typeof p1.p === 'number') {
            fp = 0.20 * m1.p + 0.60 * pt.p + 0.20 * p1.p;
          }
        }
        return { x: fx, y: fy, p: fp, t: pt.t };
      };

      const maybeMarkBufTurnPinned = (nx, ny) => {
        if (buf.length < 2) return;
        const bPrev = buf[buf.length - 2];
        const bLast = buf[buf.length - 1];
        if (bLast.pinned) return;
        const vx1 = bLast.x - bPrev.x;
        const vy1 = bLast.y - bPrev.y;
        const vx2 = nx - bLast.x;
        const vy2 = ny - bLast.y;
        const l1 = Math.hypot(vx1, vy1);
        const l2 = Math.hypot(vx2, vy2);
        if (l1 > 0.35 && l2 > 0.35) {
          const cosB = (vx1 * vx2 + vy1 * vy2) / (l1 * l2);
          if (cosB < 0.44) {
            bLast.pinned = true;
          }
        }
      };

      const checkIntermediateCornerPin = (nx, ny) => {
        if (segRaws.length < 2 || buf.length === 0) return;
        const startPt = buf[buf.length - 1];
        const cdx = nx - startPt.x;
        const cdy = ny - startPt.y;
        const cLen = Math.hypot(cdx, cdy);

        let bestIdx = -1;
        let bestScore = 0;
        for (let i = 1; i < segRaws.length; i++) {
          const cand = segRaws[i];
          const dFromStart = Math.hypot(cand.x - startPt.x, cand.y - startPt.y);
          const dToNew = Math.hypot(nx - cand.x, ny - cand.y);
          if (dFromStart < 0.30 || dToNew < 0.85) continue;

          const backPt = findBackAnchor(cand.rawIdx, 1.20) || startPt;
          const vx1 = cand.x - backPt.x;
          const vy1 = cand.y - backPt.y;
          const vx2 = nx - cand.x;
          const vy2 = ny - cand.y;
          const l1 = Math.hypot(vx1, vy1);
          const l2 = Math.hypot(vx2, vy2);
          if (l1 < 0.70 || l2 < 0.85) continue;

          const cosTurn = (vx1 * vx2 + vy1 * vy2) / (l1 * l2);
          if (cosTurn >= 0.44) continue;

          const perpDev = cLen > 0.25
            ? Math.abs(cdx * (cand.y - startPt.y) - cdy * (cand.x - startPt.x)) / cLen
            : dFromStart;
          if (perpDev >= 0.34 && perpDev * (1 - cosTurn) > bestScore) {
            bestScore = perpDev * (1 - cosTurn);
            bestIdx = i;
          }
        }

        if (bestIdx >= 1) {
          const apex = segRaws[bestIdx];
          maybeMarkBufTurnPinned(apex.x, apex.y);
          buf.push({ x: apex.x, y: apex.y, p: apex.p, t: apex.t, pinned: true });
          segRaws = segRaws.slice(bestIdx);
        }
      };

      return {
        start(x, y, p, t) {
          buf.length = 0;
          rawHist.length = 0;
          const p0 = { x, y, p, t, rawIdx: 0 };
          rawHist.push(p0);
          segRaws = [p0];
          buf.push({ x, y, p, t, pinned: true });
          emittedIdx = 0;
          lastRaw = { x, y, p, t };
        },

        pushRaw(x, y, p, t) {
          if (buf.length === 0) {
            this.start(x, y, p, t);
            return [];
          }

          if (!lastRaw || Math.hypot(x - lastRaw.x, y - lastRaw.y) >= 0.05) {
            // 1) 리샘플 보폭 이내에 숨어 있는 급격한 꼭짓점('7, ㄱ, ㄴ, ㄹ, 4' — 감속 2~5샘플 회전 포함) 정밀 Pin 고정
            checkIntermediateCornerPin(x, y);
            const rawEntry = { x, y, p, t, rawIdx: rawHist.length };
            rawHist.push(rawEntry);
            segRaws.push(rawEntry);
            lastRaw = { x, y, p, t };
          }

          // 2) 균일 보폭(stepPx) 리샘플링으로 고밀도 격자 계단 노이즈 제거
          const lastAdded = buf[buf.length - 1];
          const dStep = Math.hypot(x - lastAdded.x, y - lastAdded.y);
          if (dStep >= stepPx) {
            maybeMarkBufTurnPinned(x, y);
            buf.push({ x, y, p, t, pinned: false });
            if (rawHist.length > 36) {
              rawHist.splice(0, rawHist.length - 16);
              for (let rIdx = 0; rIdx < rawHist.length; rIdx++) {
                rawHist[rIdx].rawIdx = rIdx;
              }
            }
            segRaws = [rawHist[rawHist.length - 1]];
          }

          // 3) 4샘플(~7.8px, 약 10ms) 룩어헤드가 확보된 제어점을 순차 다림질 후 즉시 방출
          const out = [];
          const safeEnd = buf.length - 5;
          while (emittedIdx < safeEnd) {
            const nextIdx = emittedIdx + 1;
            const faired = fairAt(nextIdx);
            if (faired) out.push(faired);
            emittedIdx = nextIdx;
          }
          return out;
        },

        peekLiveTipPoints(rawPos, rawP) {
          if (buf.length === 0) return [];
          const cand = (rawPos && Number.isFinite(rawPos.x) && Number.isFinite(rawPos.y)) ? rawPos : lastRaw;
          const baseIdx = Math.max(0, emittedIdx - 2);
          const local = [];
          for (let i = baseIdx; i < buf.length; i++) {
            const b = buf[i];
            local.push({ x: b.x, y: b.y, p: b.p, t: b.t, pinned: Boolean(b.pinned) });
          }
          const emitLocalIdx = emittedIdx - baseIdx;
          if (cand && local.length > 0) {
            const lastLocal = local[local.length - 1];
            const tipDist = Math.hypot(cand.x - lastLocal.x, cand.y - lastLocal.y);
            const tipP = (typeof rawP === 'number' && !Number.isNaN(rawP)) ? rawP : lastLocal.p;
            if (tipDist >= stepPx * 0.45) {
              local.push({ x: cand.x, y: cand.y, p: tipP, t: lastLocal.t, pinned: true });
            } else if (tipDist >= 0.12) {
              if (local.length - 1 > emitLocalIdx && !lastLocal.pinned) {
                lastLocal.x = cand.x;
                lastLocal.y = cand.y;
                lastLocal.p = tipP;
                lastLocal.pinned = true;
              } else {
                local.push({ x: cand.x, y: cand.y, p: tipP, t: lastLocal.t, pinned: true });
              }
            } else {
              lastLocal.pinned = true;
            }
          } else if (local.length > 0) {
            local[local.length - 1].pinned = true;
          }

          if (local.length - 1 <= emitLocalIdx) return [];
          const out = [];
          for (let k = emitLocalIdx + 1; k < local.length; k++) {
            const pt = local[k];
            if (pt.pinned || k <= 0 || k >= local.length - 1) {
              out.push({ x: pt.x, y: pt.y, p: pt.p });
              continue;
            }
            let fx = pt.x;
            let fy = pt.y;
            if (k >= 2 && k + 2 < local.length && !local[k - 1].pinned && !local[k + 1].pinned) {
              const m2 = local[k - 2], m1 = local[k - 1], p1 = local[k + 1], p2 = local[k + 2];
              const vx1 = pt.x - m2.x, vy1 = pt.y - m2.y;
              const vx2 = p2.x - pt.x, vy2 = p2.y - pt.y;
              const dL = Math.hypot(vx1, vy1), dR = Math.hypot(vx2, vy2);
              if (dL >= 0.05 && dR >= 0.05 && dL <= 11.5 && dR <= 11.5 && ((vx1 * vx2 + vy1 * vy2) / (dL * dR)) >= -0.05) {
                fx = (-3 * (m2.x + p2.x) + 12 * (m1.x + p1.x) + 17 * pt.x) / 35;
                fy = (-3 * (m2.y + p2.y) + 12 * (m1.y + p1.y) + 17 * pt.y) / 35;
              } else {
                fx = 0.16 * (m1.x + p1.x) + 0.68 * pt.x;
                fy = 0.16 * (m1.y + p1.y) + 0.68 * pt.y;
              }
            } else {
              const m1 = local[k - 1], p1 = local[k + 1];
              const vx1 = pt.x - m1.x, vy1 = pt.y - m1.y;
              const vx2 = p1.x - pt.x, vy2 = p1.y - pt.y;
              const dL = Math.hypot(vx1, vy1), dR = Math.hypot(vx2, vy2);
              if (dL >= 0.05 && dR >= 0.05 && ((vx1 * vx2 + vy1 * vy2) / (dL * dR)) >= 0.35) {
                fx = 0.16 * (m1.x + p1.x) + 0.68 * pt.x;
                fy = 0.16 * (m1.y + p1.y) + 0.68 * pt.y;
              }
            }
            out.push({ x: fx, y: fy, p: pt.p });
          }
          return out;
        },

        peekPendingTail(rawPos) {
          if (buf.length === 0) return [];
          const out = [];
          for (let i = emittedIdx + 1; i < buf.length; i++) {
            const pt = buf[i];
            out.push({ x: pt.x, y: pt.y, p: pt.p, t: pt.t });
          }
          const cand = (rawPos && Number.isFinite(rawPos.x) && Number.isFinite(rawPos.y)) ? rawPos : lastRaw;
          if (cand) {
            const ref = out.length > 0 ? out[out.length - 1] : buf[buf.length - 1];
            if (ref && Math.hypot(cand.x - ref.x, cand.y - ref.y) >= 0.40) {
              out.push({ x: cand.x, y: cand.y, p: ref.p, t: ref.t });
            }
          }
          return out;
        },

        finish(endX, endY, endP, endT) {
          if (buf.length === 0) return [];
          const prelimLast = buf[buf.length - 1];
          const fx = (Number.isFinite(endX)) ? endX : (lastRaw ? lastRaw.x : prelimLast.x);
          const fy = (Number.isFinite(endY)) ? endY : (lastRaw ? lastRaw.y : prelimLast.y);
          const fp = (typeof endP === 'number' && !Number.isNaN(endP)) ? endP : (lastRaw ? lastRaw.p : prelimLast.p);
          const ft = (endT !== undefined) ? endT : (lastRaw ? lastRaw.t : prelimLast.t);

          checkIntermediateCornerPin(fx, fy);

          const lastAdded = buf[buf.length - 1];
          const tailDist = Math.hypot(fx - lastAdded.x, fy - lastAdded.y);

          if (buf.length === 1) {
            if (tailDist >= 0.15) {
              buf.push({ x: fx, y: fy, p: fp, t: ft, pinned: true });
            } else {
              lastAdded.pinned = true;
            }
          } else if (tailDist >= stepPx * 0.55) {
            maybeMarkBufTurnPinned(fx, fy);
            buf.push({ x: fx, y: fy, p: fp, t: ft, pinned: true });
          } else if (tailDist >= 0.05) {
            if (!lastAdded.pinned) {
              // 끝점 직전 미세 잔여 구간(<0.55*step)은 이중 제어점 꺾임을 막기 위해 마지막 점을 실제 펜 끝으로 연장 고정
              lastAdded.x = fx;
              lastAdded.y = fy;
              lastAdded.p = fp;
              lastAdded.t = ft;
              lastAdded.pinned = true;
            } else if (tailDist >= 0.25) {
              buf.push({ x: fx, y: fy, p: fp, t: ft, pinned: true });
            }
          } else {
            lastAdded.p = fp;
            lastAdded.pinned = true;
          }

          buf[buf.length - 1].pinned = true;

          const out = [];
          while (emittedIdx < buf.length - 1) {
            const nextIdx = emittedIdx + 1;
            const faired = fairAt(nextIdx);
            if (faired) out.push(faired);
            emittedIdx = nextIdx;
          }
          return out;
        }
      };
    }

    isStylusPalmRejectionActive() {
      if (this._hasDetectedStylusPen) return true;
      return this.isIOSOrIPad();
    }

    _cancelAllActiveCardDrags() {
      this._isDraggingOrResizingAnyCard = false;
      const pWidget = document.getElementById('problemCardWidget');
      if (pWidget && typeof pWidget._cancelCardDrag === 'function') pWidget._cancelCardDrag();
      if (pWidget && typeof pWidget._cancelCardResize === 'function') pWidget._cancelCardResize('pen_or_pinch');
      const gWidget = document.getElementById('graphCardWidget');
      if (gWidget && typeof gWidget._cancelCardDrag === 'function') gWidget._cancelCardDrag();
      if (gWidget && typeof gWidget._cancelCardResize === 'function') gWidget._cancelCardResize('pen_or_pinch');
      if (Array.isArray(this.extraProblemCards)) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el && typeof c.el._cancelCardDrag === 'function') c.el._cancelCardDrag();
          if (c && c.el && typeof c.el._cancelCardResize === 'function') c.el._cancelCardResize('pen_or_pinch');
        });
      }
      if (Array.isArray(this.extraGraphCards)) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el && typeof c.el._cancelCardDrag === 'function') c.el._cancelCardDrag();
          if (c && c.el && typeof c.el._cancelCardResize === 'function') c.el._cancelCardResize('pen_or_pinch');
        });
      }
    }

    _shouldIgnoreCanvasTouchPointer(e) {
      if (!e || this.isPdfModalOpen || this.isStudentAudioVideoOnlyMode) return true;
      if (e.type === 'pointerdown' && e._touchIgnoreChecked !== undefined) {
        return e._touchIgnoreChecked;
      }
      const nowT = Date.now();
      const isPenDrawingNow = Boolean(
        (this.isDrawingInk || this.isStylusDrawing || this.isLassoSelecting || this.isDrawingSticker) &&
        this._activeDrawingPointerType === 'pen'
      );
      const isWithinPenGuard = Boolean(
        isPenDrawingNow ||
        (this._lastPenActiveTime && (nowT - this._lastPenActiveTime < 650))
      );
      const palmRejectionActive = this.isStylusPalmRejectionActive();
      // 🛡️ [아이패드/스타일러스 태블릿 표준 고정]:
      // 판서 모드(칠판) 및 필기/정밀도구 활성 시 한 손가락/손날(touch 1점)은 100% 무시하고,
      // 오직 두 손가락(touch 2점)으로만 화면 이동·확대/축소가 작동합니다!
      const shouldBlockSingleTouch = Boolean(
        palmRejectionActive && (
          this.isGraphCovered ||
          (this.isInkMode && this.activeInkTool !== 'select') ||
          this.isDropLineMode ||
          this.isTextToolMode ||
          this.isGraphSnapMode ||
          this.isPdfToGraphCropMode
        )
      );

      if (e.type === 'pointerdown') {
        if (isWithinPenGuard) {
          if (this.activePointers) this.activePointers.clear();
          this._pinchState = null;
          this._pinchWasActiveInGesture = false;
          e._touchIgnoreChecked = true;
          return true;
        }
        if (this.activePointers) {
          for (const [k, v] of this.activePointers.entries()) {
            if (nowT - (v.time || 0) > 1200) this.activePointers.delete(k);
          }
          this.activePointers.set(e.pointerId, {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            type: 'touch',
            time: nowT
          });
          if (this.activePointers.size >= 3) {
            this._pinchState = null;
            this._pinchWasActiveInGesture = false;
            this.isPanning = false;
            this.isBoardPanning = false;
            e._touchIgnoreChecked = true;
            return true;
          }
          if (this.activePointers.size === 2) {
            this.isPanning = false;
            this.isBoardPanning = false;
            this._cancelAllActiveCardDrags();
            this._pinchWasActiveInGesture = true;
            this._pinchHadActiveMoveInGesture = false;
            const pts = Array.from(this.activePointers.values());
            this._startCanvasTwoFingerPinch(pts[0], pts[1]);
            e._touchIgnoreChecked = true;
            return true;
          }
          this._pinchWasActiveInGesture = false;
          this._pinchHadActiveMoveInGesture = false;
          this._pinchState = null;
          this._activePanPointerId = e.pointerId;
        }
        if (shouldBlockSingleTouch) {
          e._touchIgnoreChecked = true;
          return true;
        }
        e._touchIgnoreChecked = false;
        return false;
      }

      if (e.type === 'pointermove') {
        if (isWithinPenGuard) {
          if (this.activePointers) this.activePointers.clear();
          this._pinchState = null;
          this._pinchWasActiveInGesture = false;
          return true;
        }
        if (this.activePointers && this.activePointers.has(e.pointerId)) {
          this.activePointers.set(e.pointerId, {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            type: 'touch',
            time: nowT
          });
          if (this.activePointers.size === 2 && this._pinchState) {
            this.isPanning = false;
            this.isBoardPanning = false;
            const pts = Array.from(this.activePointers.values());
            this._moveCanvasTwoFingerPinch(pts[0], pts[1]);
            return true;
          }
        }
        if (this._pinchWasActiveInGesture || (this.activePointers && this.activePointers.size >= 2)) {
          return true;
        }
        if (shouldBlockSingleTouch) {
          return true;
        }
        return false;
      }

      if (e.type === 'pointerup' || e.type === 'pointercancel') {
        if (this._pinchState && (this._pinchState.panUnlocked || this._pinchState.zoomUnlocked)) {
          this._pinchHadActiveMoveInGesture = true;
        }
        const hadPinchGesture = Boolean(this._pinchState || this._pinchWasActiveInGesture);
        if (this.activePointers && e.pointerId !== undefined) {
          this.activePointers.delete(e.pointerId);
        }
        if (!this.activePointers || this.activePointers.size < 2) {
          this._pinchState = null;
        }
        const allFingersUp = (!this.activePointers || this.activePointers.size === 0);
        if (allFingersUp) {
          this._pinchWasActiveInGesture = false;
        }
        if (hadPinchGesture) {
          this.isPanning = false;
          this.isBoardPanning = false;
          if (this._pinchHadActiveMoveInGesture && !this._pinchState) {
            if (allFingersUp) {
              this._pinchHadActiveMoveInGesture = false;
            }
            if (this.isGraphCovered) {
              this.updateProblemCardPosition(false);
            }
            this._scheduleIdleInkCacheRebuild(120);
          }
          return true;
        }
        if (isWithinPenGuard || isPenDrawingNow || shouldBlockSingleTouch) {
          return true;
        }
        return false;
      }

      return true;
    }

    _clearInkHoldTimer() {
      if (this._inkHoldTimer) {
        clearTimeout(this._inkHoldTimer);
        this._inkHoldTimer = null;
      }
    }

    _markStylusPenDetected() {
      if (!this._hasDetectedStylusPen) {
        this._hasDetectedStylusPen = true;
        // 펜 최초 감지 직전에 손바닥(touch)으로 시작된 진행 중인 오작동 획이 있다면 즉시 롤백 제거!
        if (this.isDrawingInk && this._activeDrawingPointerType === 'touch' && this.currentInkStroke) {
          const badIdx = this.inkStrokes.indexOf(this.currentInkStroke);
          if (badIdx !== -1) this.inkStrokes.splice(badIdx, 1);
          this.currentInkStroke = null;
          this.isDrawingInk = false;
          this.isStylusDrawing = false;
          this._clearInkHoldTimer();
          this.requestRender();
        }
      }
    }

    updateStylusPenPosition(x, y, e = null) {
      if (!this.virtualStylusEl) return;
      if (this.isStudentAudioVideoOnlyMode || this._isAudioReplayActive) {
        return;
      }

      // 🌟 [아이패드(iPadOS) 물리 펜슬 필기 시 가상 펜 DOM 오버레이 & 메뉴 히트테스트 100% 생략]:
      // 아이패드에서는 실제 펜촉이 화면 유리에 직접 닿으므로 펜촉 아래에서 매 프레임 DOM 스타일 11개와
      // isPointerOverMenu()를 실행하는 가상 펜 요소를 즉시 숨기고(음성 리플레이 재생 중 제외) 0.000ms 만에 반환합니다!
      if (this.isIOSOrIPad() && !this.isAudioPlaying) {
        if (this.virtualStylusEl.style.display !== 'none') {
          this.virtualStylusEl.style.display = 'none';
        }
        if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
          const clampedX = Math.max(0, Math.min(this.screenWidth || 1920, x));
          const clampedY = Math.max(0, Math.min(this.screenHeight || 1080, y));
          this.stylusPenPos = { x: clampedX, y: clampedY };
          if (this.isAudioRecording && !this.isDrawingInk) {
            this.recordAudioCursorPoint(clampedX, clampedY, this.currentInkColor, false);
          }
        }
        return;
      }

      if (!this.showVirtualStylus || !this.isInkMode || this.isDropLineMode || this.isTextToolMode || this.isSpacePressed || this.isPanning || this.isBoardPanning) {
        if (this.virtualStylusEl.style.display !== 'none') {
          this.virtualStylusEl.style.display = 'none';
        }
        return;
      }

      if (this.activeInkTool !== 'pen' && this.activeInkTool !== 'highlighter' && this.activeInkTool !== 'eraser' && this.activeInkTool !== 'laser') {
        if (this.virtualStylusEl.style.display !== 'none') {
          this.virtualStylusEl.style.display = 'none';
        }
        return;
      }

      // e가 없으면 최근 저장된 포인터 이벤트 활용
      if (!e && this._lastPointerEvent) {
        e = this._lastPointerEvent;
      }

      // 🌟 [아이패드/태블릿 손가락 터치 시 가상 펜 아이콘 숨김]
      if (e && e.pointerType === 'touch') {
        if (this.virtualStylusEl.style.display !== 'none') {
          this.virtualStylusEl.style.display = 'none';
        }
        return;
      }

      // 🌟 [대표님 킬러 UX]: 화면 밖이거나 메뉴/툴바/슬라이드바/비필기 카드 위로 올라갔을 때 가상 펜을 즉시 숨김!
      // (단, 현재 캔버스에 필기 획을 그리는 중에는 메뉴 히트테스트를 생략하여 240Hz 프레임 드랍 원천 차단)
      const isActivelyDrawingOnBoard = Boolean(this.isDrawingInk || this.isStylusDrawing);
      if (this._isPointerInsideWindow === false || (!isActivelyDrawingOnBoard && e && this.isPointerOverMenu(e))) {
        if (this.virtualStylusEl.style.display !== 'none') {
          this.virtualStylusEl.style.display = 'none';
        }
        return;
      }

      if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return;
      if (x < 0 || y < 0 || x > (window.innerWidth || 1920) || y > (window.innerHeight || 1080)) {
        if (this.virtualStylusEl.style.display !== 'none') {
          this.virtualStylusEl.style.display = 'none';
        }
        return;
      }

      // 메뉴 위가 아니고 정상 필기 영역이면 즉시 표출 (펜 / 형광펜 / 지우개 / 레이저 아이콘 자동 전환)
      const isEraserNow = (this.activeInkTool === 'eraser') || Boolean(this._isTemporaryStylusEraser) || Boolean(e && this.isStylusEraserEvent && this.isStylusEraserEvent(e));
      const isLaserNow = !isEraserNow && (this.activeInkTool === 'laser');
      const isHighlighterNow = !isEraserNow && !isLaserNow && (this.activeInkTool === 'highlighter');
      const isPenNow = !isEraserNow && !isLaserNow && !isHighlighterNow;
      const activeKind = isEraserNow ? 'eraser' : (isLaserNow ? 'laser' : (isHighlighterNow ? 'highlighter' : 'pen'));

      // 🚀 [DOM Style Mutation 최소화]: 아이콘 종류가 바뀌었거나 숨겨진 상태에서 다시 켜질 때만 10개 SVG의 display 속성을 갱신!
      const needSvgSync = (
        this._lastVirtualStylusKind !== activeKind ||
        this.virtualStylusEl.style.display !== 'block' ||
        (this.stylusArrowSvg && this.stylusArrowSvg.style.display !== 'none')
      );
      if (needSvgSync) {
        this._lastVirtualStylusKind = activeKind;
        if (this.stylusPenSvg) this.stylusPenSvg.style.display = isPenNow ? 'block' : 'none';
        if (this.stylusHighlighterSvg) {
          this.stylusHighlighterSvg.style.display = isHighlighterNow ? 'block' : 'none';
        }
        if (this.stylusEraserSvg) this.stylusEraserSvg.style.display = isEraserNow ? 'block' : 'none';
        if (this.stylusLaserSvg) this.stylusLaserSvg.style.display = isLaserNow ? 'block' : 'none';
        if (this.stylusArrowSvg) this.stylusArrowSvg.style.display = 'none';
        if (this.stylusPointerSvg) this.stylusPointerSvg.style.display = 'none';
        if (this.stylusGrabSvg) this.stylusGrabSvg.style.display = 'none';
        if (this.stylusGrabbingSvg) this.stylusGrabbingSvg.style.display = 'none';
        if (this.stylusCrosshairSvg) this.stylusCrosshairSvg.style.display = 'none';
        this.virtualStylusEl.style.display = 'block';
      }

      // 캔버스 내부 범위로 클램핑하여 마지막 위치 보존
      const clampedX = Math.max(0, Math.min(this.screenWidth || 1920, x));
      const clampedY = Math.max(0, Math.min(this.screenHeight || 1080, y));

      this.stylusPenPos = { x: clampedX, y: clampedY };
      if (this.isAudioRecording && !this.isDrawingInk) {
        this.recordAudioCursorPoint(clampedX, clampedY, this.currentInkColor, false);
      }

      // 랙 없는 144Hz 초고속 GPU 변환 & 드로잉 시 번쩍임 없이 살짝 눌리는 물리적 필기감
      const scale = this.isStylusDrawing ? 0.94 : 1.0;
      this.virtualStylusEl.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0) scale(${scale})`;
    }

    toggleInkMode(forceVal = null) {
      const nextState = (forceVal !== null) ? forceVal : !this.isInkMode;
      if (this.isInkMode === nextState) return;

      this.isInkMode = nextState;

      if (typeof this.syncInkUiVisibility === 'function') {
        this.syncInkUiVisibility({ clampPillPosition: Boolean(this.isInkMode && this.isQuickPillRemoteOpen) });
      } else {
        const btnHeader = document.getElementById('btnInkMode');
        const btnQuick = document.getElementById('btnQuickInk');
        const dock = document.getElementById('inkFloatingToolbar');
        if (btnQuick) btnQuick.classList.toggle('active', this.isInkMode);
        if (dock) dock.style.display = (this.isInkMode && !this.isBottomInkBarHidden) ? 'flex' : 'none';
        if (btnHeader) btnHeader.classList.toggle('active', Boolean(this.isInkMode && !this.isBottomInkBarHidden));
      }

      if (this.isInkMode) {
        // 🌟 [대표님 기획]: 필기 모드로 진입하는 순간 그래프 조작 모드를 즉시 프리징(동결)!
        // 핸들러 깜빡임 펄스 루프 즉각 취소 & 선택된 핸들/곡선 해제하여 CPU 100% 필기에 집중
        this.selectedHandleIdx = null;
        this.isCurveSelected = false;
        this.selectedPwBoundaryIdx = null;
        if (this.pulseAnimId) {
          cancelAnimationFrame(this.pulseAnimId);
          this.pulseAnimId = null;
        }
        if (this.activeInkTool === 'select') {
          this.setActiveInkTool('pen');
        } else {
          this.updateInkCursor();
        }
        // 필기모드 진입 시 마지막 위치(또는 기본 위치)로 가상 펜 즉시 표출 및 위치 동기화
        if (this.stylusPenPos) {
          this.updateStylusPenPosition(this.stylusPenPos.x, this.stylusPenPos.y);
        }
      } else {
        this.canvas.classList.remove(
          'ink-cursor-pen',
          'ink-cursor-highlighter',
          'ink-cursor-eraser',
          'ink-cursor-lasso',
          'ink-cursor-grab',
          'ink-cursor-grabbing'
        );
        this.canvas.style.cursor = 'default';
        if (this.virtualStylusEl) {
          this.virtualStylusEl.style.display = 'none';
        }
      }
      if (document.body) {
        document.body.classList.toggle('ink-laser-tool-active', Boolean(this.isInkMode && this.activeInkTool === 'laser'));
        document.body.classList.toggle('ink-sticker-tool-active', Boolean(this.isInkMode && this.activeInkTool === 'sticker'));
      }

      this.syncCurveContextBar();
      this.render();
    }

    toggleAxes(forceVal = null) {
      if (forceVal !== null) {
        this.showAxes = Boolean(forceVal);
      } else {
        const anyVisible = (this.showXAxis !== false || this.showYAxis !== false);
        const nextState = !anyVisible;
        this.showXAxis = nextState;
        this.showYAxis = nextState;
        this.showAxes = true;
      }
      this.updateAxesUI();
      if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
      if (this.isGraphCovered && typeof this._applyAxisVisibilityToTargetPipCard === 'function') {
        this._applyAxisVisibilityToTargetPipCard(this.showXAxis, this.showYAxis);
      }
      this.render();
      const showAny = Boolean(this.showAxes && (this.showXAxis !== false || this.showYAxis !== false));
      this.showToast(showAny ? '📐 좌표축 표시 On (x·y축)' : '🪵 좌표축 숨김 (x·y축 Off)');
    }

    updateAxesUI() {
      this.syncAxisVisibilityUI();
    }

    syncAxisVisibilityUI() {
      const xOn = this.showXAxis !== false;
      const yOn = this.showYAxis !== false;
      const bothAxesOff = !xOn && !yOn;

      const btnX = document.getElementById('btnToggleXAxis');
      if (btnX) {
        btnX.classList.toggle('active', xOn);
        btnX.setAttribute('aria-pressed', xOn ? 'true' : 'false');
      }
      const btnY = document.getElementById('btnToggleYAxis');
      if (btnY) {
        btnY.classList.toggle('active', yOn);
        btnY.setAttribute('aria-pressed', yOn ? 'true' : 'false');
      }

      const btnInkAxes = document.getElementById('btnInkToggleAxes');
      if (btnInkAxes) {
        btnInkAxes.classList.toggle('active', Boolean(this.showAxes && !bothAxesOff));
      }

      // 두 축이 모두 꺼진 경우: 보조 수선 모드를 자동 해제하고 수선 버튼을 자동으로 숨김
      if (bothAxesOff) {
        if (this.isDropLineMode) {
          this.isDropLineMode = false;
          this.dropLineHoverCandidate = null;
          this._isAimingDropLine = false;
          const container = this.canvas && this.canvas.parentElement;
          if (container) container.classList.remove('drop-line-active');
        }
        if (this.pipGraphLiveSnap && this.pipGraphLiveSnap.isPipDropLineMode) {
          this.pipGraphLiveSnap.isPipDropLineMode = false;
          this.pipGraphLiveSnap._pipDropLineHoverCand = null;
          this.pipGraphLiveSnap._pipDropLineHoverScissors = null;
        }
        if (Array.isArray(this.extraGraphCards)) {
          this.extraGraphCards.forEach(c => {
            const s = c && (c.pipLiveSnap || (c.el && c.el._pipLiveSnap));
            if (s && s.isPipDropLineMode) {
              s.isPipDropLineMode = false;
              s._pipDropLineHoverCand = null;
              s._pipDropLineHoverScissors = null;
            }
          });
        }
      }

      const btnQuickDl = document.getElementById('btnQuickDropLine');
      if (btnQuickDl) {
        btnQuickDl.classList.toggle('active', Boolean(this.isDropLineMode && !bothAxesOff));
        if (!this.isGraphCovered) {
          btnQuickDl.style.display = bothAxesOff ? 'none' : '';
        }
      }

      if (typeof this.syncPipCardLockUI === 'function') {
        const gWidget = document.getElementById('graphCardWidget');
        if (gWidget) {
          gWidget._lastPipLockUiSig = '';
          this.syncPipCardLockUI('primary');
        }
        if (Array.isArray(this.extraGraphCards)) {
          this.extraGraphCards.forEach(c => {
            if (c && c.el) {
              c.el._lastPipLockUiSig = '';
              this.syncPipCardLockUI(c);
            }
          });
        }
      }
    }

    resolveHighlighterStrokeColor(rawColor, isLight = true) {
      const rawLower = (rawColor || '').toLowerCase();
      if (rawLower === '#1e293b' || rawLower === '#000000' || rawLower === '#0f172a' || rawLower === '#2d3436' || rawLower === '#ffffff' || rawLower === '#fff') {
        return isLight ? '#facc15' : '#fde047';
      } else if (rawLower === '#2563eb') {
        return '#38bdf8';
      } else if (rawLower === '#dc2626') {
        return '#fb7185';
      } else if (rawLower === '#16a34a') {
        return '#4ade80';
      } else if (rawLower === '#7c3aed') {
        return '#c084fc';
      }
      return rawColor || '#facc15';
    }

    _applyCurrentToolColorUI(color) {
      if (!color) return;
      this.currentInkColor = color;
      const isHl = (this.activeInkTool === 'highlighter');
      document.querySelectorAll('.ink-color-dot, .pill-color-dot').forEach(dot => {
        const dsCol = (dot.dataset.color || '').toLowerCase();
        dot.classList.toggle('active', dsCol === (color || '').toLowerCase());
        // 형광펜 모드에서는 1번 기본 도트(#1e293b)의 시각적 색상을 노란색(#facc15)으로 표시하여 직관성 극대화
        if (dsCol === '#1e293b') {
          dot.style.background = isHl ? '#facc15' : '#1e293b';
        } else if (dot.dataset.color) {
          dot.style.background = dot.dataset.color;
        }
      });
      const displayCol = isHl ? this.resolveHighlighterStrokeColor(color, true) : color;
      if (this.stylusColorBand) {
        this.stylusColorBand.setAttribute('fill', displayCol);
      }
      const previewDot = document.getElementById('inkSizePreviewDot');
      if (previewDot) previewDot.style.background = displayCol;
      const tbDot = document.getElementById('inkSizeToolbarDot');
      if (tbDot) tbDot.style.background = displayCol;
    }

    setActiveInkTool(tool) {
      this.activeInkTool = tool;

      // 🌟 [대표님 피드백 반영]: 펜(pen)과 형광펜(highlighter) 전환 시 각자 기억된 전용 색상으로 자동 스왑!
      if (tool === 'highlighter') {
        this._applyCurrentToolColorUI(this.savedHighlighterColor || '#1e293b');
      } else if (tool === 'pen') {
        this._applyCurrentToolColorUI(this.savedPenColor || '#1e293b');
      } else {
        this._applyCurrentToolColorUI(this.savedPenColor || this.currentInkColor || '#1e293b');
      }

      const btnSelect = document.getElementById('btnInkSelect');
      const btnPen = document.getElementById('btnInkPen');
      const btnHighlighter = document.getElementById('btnInkHighlighter');
      const btnEraser = document.getElementById('btnInkEraser');
      const btnLasso = document.getElementById('btnInkLasso');
      const btnLaser = document.getElementById('btnInkLaser');
      const btnSticker = document.getElementById('btnInkSticker');

      if (btnSelect) btnSelect.classList.toggle('active', tool === 'select');
      if (btnPen) btnPen.classList.toggle('active', tool === 'pen');
      if (btnHighlighter) btnHighlighter.classList.toggle('active', tool === 'highlighter');
      if (btnEraser) btnEraser.classList.toggle('active', tool === 'eraser');
      if (btnLasso) btnLasso.classList.toggle('active', tool === 'lasso');
      if (btnLaser) btnLaser.classList.toggle('active', tool === 'laser');
      if (btnSticker) btnSticker.classList.toggle('active', tool === 'sticker');

      this.syncQuickPillRemoteUI();
      this.syncCurveContextBar();
      if (tool !== 'select') {
        // 🌟 [대표님 기획]: 펜/형광펜/지우개/레이저 버튼을 누르는 즉시 그래프 조작 핸들러 및 분할선 조작 즉시 해제 및 프리징!
        this.selectedHandleIdx = null;
        this.isCurveSelected = false;
        this.selectedPwBoundaryIdx = null;
        if (this.pulseAnimId) {
          cancelAnimationFrame(this.pulseAnimId);
          this.pulseAnimId = null;
        }
        if (this.isDropLineMode) {
          this.isDropLineMode = false;
          this.dropLineHoverCandidate = null;
          this._isAimingDropLine = false;
          const btnDl = document.getElementById('btnQuickDropLine');
          if (btnDl) btnDl.classList.remove('active');
          const container = this.canvas && this.canvas.parentElement;
          if (container) container.classList.remove('drop-line-active');
        }
        if (this.isTextToolMode) {
          this.isTextToolMode = false;
          const btnTxt = document.getElementById('btnQuickText');
          if (btnTxt) btnTxt.classList.remove('active');
          const container = this.canvas && this.canvas.parentElement;
          if (container) container.classList.remove('text-tool-active');
        }
      }

      if (!this.isInkMode && (tool === 'pen' || tool === 'highlighter' || tool === 'eraser' || tool === 'lasso' || tool === 'laser' || tool === 'sticker' || tool === 'select')) {
        this.toggleInkMode(true);
      }
      if (document.body) {
        document.body.classList.toggle('ink-laser-tool-active', Boolean(this.isInkMode && this.activeInkTool === 'laser'));
        document.body.classList.toggle('ink-sticker-tool-active', Boolean(this.isInkMode && this.activeInkTool === 'sticker'));
      }

      if (tool !== 'lasso') {
        this.selectedInkStrokes = [];
        this.selectedTextLabels = [];
        this.lassoBoundingBox = null;
        this.isLassoSelecting = false;
        this.isDraggingLassoSelection = false;
        this.isResizingLassoSelection = false;
        this.lassoResizeStart = null;
        this.lassoPoints = [];
        if (this._lassoExcludedBakeSet) {
          this._lassoExcludedBakeSet = null;
          this._inkBakeDirty = true;
        }
        if (typeof this.clearCardLassoSelection === 'function') {
          this.clearCardLassoSelection();
        }
        this.syncLassoActionBarUI();
      }

      this.updateInkCursor();
      this.render();
    }

    setInkColor(color) {
      if (this.activeInkTool === 'highlighter') {
        this.savedHighlighterColor = color;
        try {
          localStorage.setItem('graphly_highlighter_color_v1', color);
        } catch (err) { }
      } else {
        this.savedPenColor = color;
        try {
          localStorage.setItem('graphly_pen_color_v1', color);
        } catch (err) { }
      }
      this._applyCurrentToolColorUI(color);
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }
      // 색상을 바꾸면 지우개, 올가미, 레이저, 선택 모드였을 때 자동으로 펜으로 전환
      if (this.activeInkTool === 'eraser' || this.activeInkTool === 'select' || this.activeInkTool === 'lasso' || this.activeInkTool === 'laser' || this.activeInkTool === 'sticker') {
        this.setActiveInkTool('pen');
      }
    }


    setTextLabelFontSize(size) {
      this.textLabelFontSize = size;
      const slider = document.getElementById('sliderTextLabelSize');
      if (slider) slider.value = size;
      const lbl = document.getElementById('lblTextLabelSize');
      if (lbl) lbl.textContent = `${size}`;
      const curUnitScale = typeof this.getCurrentMathUnitScale === 'function' ? this.getCurrentMathUnitScale() : 90;
      if (this.selectedTextLabelId) {
        const sel = this.textLabels.find(t => t.id === this.selectedTextLabelId);
        if (sel) {
          sel.fontSize = size;
          sel.baseUnitScale = curUnitScale;
        }
      } else {
        this.textLabels.forEach(t => {
          t.fontSize = size;
          t.baseUnitScale = curUnitScale;
        });
      }
      this.render();
    }

    setDropLineFontSize(size) {
      this.dropLineFontSize = size;
      const slider = document.getElementById('sliderDropLineFontSize');
      if (slider) slider.value = size;
      const lbl = document.getElementById('lblDropLineFontSize');
      if (lbl) lbl.textContent = `${size}`;
      this.render();
    }

    setAxisLabelFontSize(size) {
      this.axisLabelFontSize = size;
      const slider = document.getElementById('sliderAxisLabelSize');
      if (slider) slider.value = size;
      const lbl = document.getElementById('lblAxisLabelSize');
      if (lbl) lbl.textContent = `${size}`;
      this.render();
    }

    setInkSoftBlur(val, triggerRender = true) {
      const num = Number(val);
      const clamped = Math.max(0.0, Math.min(5.0, parseFloat((Number.isFinite(num) ? num : 0).toFixed(1))));
      this.inkSoftBlur = clamped;
      try {
        localStorage.setItem('graphly_ink_soft_blur_v1', String(clamped));
      } catch (err) { }

      const lbl = document.getElementById('lblCurrentInkBlur');
      if (lbl) lbl.textContent = clamped.toFixed(1);

      const slider = document.getElementById('sliderInkBlur');
      if (slider) slider.value = clamped;

      if (triggerRender) {
        if (Array.isArray(this.inkStrokes)) {
          this.inkStrokes.forEach(st => {
            if (st && !st.isHighlighter) st.softBlur = clamped;
          });
        }
        if (Array.isArray(this.problemInkStrokes)) {
          this.problemInkStrokes.forEach(st => {
            if (st && !st.isHighlighter) st.softBlur = clamped;
          });
        }
        if (Array.isArray(this.graphInkStrokes)) {
          this.graphInkStrokes.forEach(st => {
            if (st && !st.isHighlighter) st.softBlur = clamped;
          });
        }
        document.querySelectorAll('.extra-problem-card-widget, .extra-graph-card-widget').forEach(el => {
          if (Array.isArray(el._cardInkStrokes)) {
            el._cardInkStrokes.forEach(st => {
              if (st && !st.isHighlighter) st.softBlur = clamped;
            });
            if (typeof el._renderCardInkCanvas === 'function') {
              el._renderCardInkCanvas();
            }
          }
        });
        this._inkBakeDirty = true;
        if (typeof this.renderProblemCardCanvas === 'function') this.renderProblemCardCanvas();
        if (typeof this.renderGraphCardCanvas === 'function') this.renderGraphCardCanvas();
        this.requestRender();
      }

      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }
    }

    setInkSize(size) {
      const clamped = Math.max(1.0, Math.min(24.0, parseFloat(Number(size).toFixed(1))));
      this.currentInkSize = clamped;
      try {
        localStorage.setItem('graphly_ink_size_v1', String(clamped));
      } catch (err) { }

      const lblVal = document.getElementById('lblCurrentInkSize');
      if (lblVal) lblVal.textContent = clamped.toFixed(1);

      const lblFlyout = document.getElementById('lblFlyoutSizeVal');
      if (lblFlyout) lblFlyout.textContent = `${clamped} pt`;

      const slider = document.getElementById('sliderInkSize');
      if (slider) slider.value = clamped;

      const previewDot = document.getElementById('inkSizePreviewDot');
      if (previewDot) {
        const dotPx = Math.min(30, Math.max(3, clamped * 2.2));
        previewDot.style.width = `${dotPx}px`;
        previewDot.style.height = `${dotPx}px`;
        previewDot.style.background = this.currentInkColor || '#ffffff';
      }

      const tbDot = document.getElementById('inkSizeToolbarDot');
      if (tbDot) {
        const tbPx = Math.min(10, Math.max(3, clamped * 1.1));
        tbDot.style.width = `${tbPx}px`;
        tbDot.style.height = `${tbPx}px`;
        tbDot.style.background = this.currentInkColor || '#ffffff';
      }

      document.querySelectorAll('.ink-size-btn').forEach(btn => {
        const btnSize = parseFloat(btn.dataset.size);
        btn.classList.toggle('active', Math.abs(btnSize - clamped) < 0.2);
      });
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }
    }

    setHighlighterSize(size) {
      const clamped = Math.max(6, Math.min(44, Math.round(Number(size) || 16)));
      this.currentHighlighterSize = clamped;
      try {
        localStorage.setItem('graphly_highlighter_size_v1', String(clamped));
      } catch (err) { }
      const lbl = document.getElementById('lblCurrentHighlighterSize');
      if (lbl) lbl.textContent = String(clamped);
      const slider = document.getElementById('sliderHighlighterSize');
      if (slider) slider.value = clamped;
      const hlGlow = document.getElementById('stylusHighlighterGlow');
      if (hlGlow) {
        hlGlow.setAttribute('r', String(Math.max(4, Math.min(15, +(clamped * 0.42).toFixed(1)))));
      }
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }
    }

    setEraserSize(size) {
      const clamped = Math.max(4, Math.min(44, Math.round(Number(size) || 14)));
      this.currentEraserSize = clamped;
      try {
        localStorage.setItem('graphly_eraser_size_v1', String(clamped));
      } catch (err) { }
      const lbl = document.getElementById('lblCurrentEraserSize');
      if (lbl) lbl.textContent = String(clamped);
      const slider = document.getElementById('sliderEraserSize');
      if (slider) slider.value = clamped;
      const erRing = document.getElementById('stylusEraserRing') || (this.stylusEraserSvg ? this.stylusEraserSvg.querySelector('circle') : null);
      if (erRing) {
        erRing.setAttribute('r', String(Math.max(2.5, Math.min(22, +(clamped * 0.45).toFixed(1)))));
      }
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }
    }

    updateInkCursor() {
      this.canvas.classList.remove(
        'ink-cursor-pen',
        'ink-cursor-highlighter',
        'ink-cursor-eraser',
        'ink-cursor-lasso',
        'ink-cursor-grab',
        'ink-cursor-grabbing'
      );
      if (this.isWaitingForFilePicker) {
        this.canvas.style.cursor = 'default';
        if (this.virtualStylusEl && !this.isAudioPlaying) this.virtualStylusEl.style.display = 'none';
        return;
      }
      if (this.isGraphSnapMode || this.isPdfToGraphCropMode) {
        this.canvas.classList.add('graph-snap-crosshair');
        this.canvas.style.cursor = 'crosshair';
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        return;
      }
      if (this.isSpacePressed || this.isPanning || this.isBoardPanning) {
        this.canvas.classList.add((this.isPanning || this.isBoardPanning) ? 'ink-cursor-grabbing' : 'ink-cursor-grab');
        this.canvas.style.cursor = 'move';
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        return;
      }
      if (!this.isInkMode) {
        this.canvas.style.cursor = 'default';
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        return;
      }

      if (this.activeInkTool === 'pen') {
        if (this.showVirtualStylus) {
          this.canvas.classList.add('ink-cursor-pen');
          if (this.virtualStylusEl) {
            if (this.stylusColorBand) this.stylusColorBand.setAttribute('fill', this.currentInkColor || '#00d2d3');
            this.updateStylusPenPosition(this.stylusPenPos.x, this.stylusPenPos.y, this._lastPointerEvent);
          }
        } else {
          if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
          this.canvas.style.cursor = 'crosshair';
        }
      } else if (this.activeInkTool === 'highlighter') {
        if (this.showVirtualStylus) {
          this.canvas.classList.add('ink-cursor-highlighter');
          if (this.virtualStylusEl) {
            if (this.stylusColorBand) this.stylusColorBand.setAttribute('fill', this.currentInkColor || '#00d2d3');
            this.updateStylusPenPosition(this.stylusPenPos.x, this.stylusPenPos.y, this._lastPointerEvent);
          }
        } else {
          if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
          this.canvas.style.cursor = 'crosshair';
        }
      } else if (this.activeInkTool === 'eraser') {
        if (this.showVirtualStylus) {
          this.canvas.classList.add('ink-cursor-eraser');
          if (this.virtualStylusEl) {
            this.updateStylusPenPosition(this.stylusPenPos.x, this.stylusPenPos.y, this._lastPointerEvent);
          }
        } else {
          if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
          this.canvas.style.cursor = 'crosshair';
        }
      } else if (this.activeInkTool === 'laser') {
        if (this.showVirtualStylus) {
          this.canvas.classList.add('ink-cursor-pen');
          if (this.virtualStylusEl) {
            this.updateStylusPenPosition(this.stylusPenPos.x, this.stylusPenPos.y, this._lastPointerEvent);
          }
        } else {
          if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
          this.canvas.style.cursor = 'crosshair';
        }
      } else if (this.activeInkTool === 'sticker') {
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        this.canvas.style.cursor = 'crosshair';
      } else if (this.activeInkTool === 'lasso') {
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        if (this.isDraggingLassoSelection) {
          this.canvas.classList.add('ink-cursor-grabbing');
        } else {
          this.canvas.classList.add('ink-cursor-lasso');
        }
      } else if (this.activeInkTool === 'select') {
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        this.canvas.style.cursor = 'default';
      } else {
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        this.canvas.style.cursor = 'default';
      }
    }

    clearAllInk() {
      const hasCardInk = Boolean(
        (this.problemInkStrokes && this.problemInkStrokes.length > 0) ||
        (this.graphInkStrokes && this.graphInkStrokes.length > 0) ||
        (this.problemCardStickers && this.problemCardStickers.length > 0) ||
        (this.graphCardStickers && this.graphCardStickers.length > 0) ||
        (this.extraProblemCards && this.extraProblemCards.some(c => c && c.el && ((c.el._cardInkStrokes && c.el._cardInkStrokes.length > 0) || (c.el._cardStickers && c.el._cardStickers.length > 0)))) ||
        (this.extraGraphCards && this.extraGraphCards.some(c => c && c.el && ((c.el._cardInkStrokes && c.el._cardInkStrokes.length > 0) || (c.el._cardStickers && c.el._cardStickers.length > 0))))
      );
      const hasBoardStickers = Boolean(this.boardStickers && this.boardStickers.length > 0);
      if ((!this.inkStrokes || this.inkStrokes.length === 0) && !hasCardInk && !hasBoardStickers) return;
      this.pushHistoryState();
      if (hasCardInk) {
        this.problemInkStrokes = [];
        this.graphInkStrokes = [];
        this.problemCardStickers = [];
        this.graphCardStickers = [];
        this.renderProblemCardCanvas();
        this.renderGraphCardCanvas();
        const pW = document.getElementById('problemCardWidget');
        if (pW && typeof pW._renderCardStickers === 'function') pW._renderCardStickers();
        const gW = document.getElementById('graphCardWidget');
        if (gW && typeof gW._renderCardStickers === 'function') gW._renderCardStickers();
        if (this.extraProblemCards) {
          this.extraProblemCards.forEach(c => {
            if (c && c.el) {
              c.el._cardInkStrokes = [];
              c.el._cardStickers = [];
              if (typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
              if (typeof c.el._renderCardStickers === 'function') c.el._renderCardStickers();
            }
          });
        }
        if (this.extraGraphCards) {
          this.extraGraphCards.forEach(c => {
            if (c && c.el) {
              c.el._cardInkStrokes = [];
              c.el._cardStickers = [];
              if (typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
              if (typeof c.el._renderCardStickers === 'function') c.el._renderCardStickers();
            }
          });
        }
      }
      if (hasBoardStickers) {
        if (this.isGraphCovered && !this.pdfPageBoardData) {
          this.boardStickers = (this.boardStickers || []).filter(s => (s.target || 'board') !== 'board');
        } else if (this.pdfPageBoardData) {
          this.boardStickers = (this.boardStickers || []).filter(s => !s.onPdfBoard && (s.target || 'board') !== 'board');
        } else {
          this.boardStickers = (this.boardStickers || []).filter(s => (s.target || 'board') !== 'graph' || Boolean(s.onPdfBoard));
        }
      }

      // 🌟 [대표님 기획: 3대 판서 분리 관리] 🌟
      // 문제 창이 켜져 있고 바깥창 풀이 필기가 있을 때 1차 클릭: 바깥 칠판 풀이 필기만 깔끔히 비움! (그래프 수식 주석은 보존)
      // 2차 클릭 (바깥창 필기가 없을 때): 그래프 창 내부 주석까지 모두 비움!
      if (this.isGraphCovered && !this.pdfPageBoardData) {
        this.inkStrokes = this.inkStrokes.filter(s => (s.target || 'board') !== 'board');
        this.showToast('🧹 필기 모드 필기를 깔끔하게 비웠습니다.');
      } else if (this.pdfPageBoardData) {
        this.inkStrokes = this.inkStrokes.filter(s => !s.onPdfBoard && (s.target || 'board') !== 'board');
        this.showToast('🧹 PDF 페이지 위 필기를 깔끔하게 비웠습니다.');
      } else {
        this.inkStrokes = this.inkStrokes.filter(s => (s.target || 'board') !== 'graph' || Boolean(s.onPdfBoard));
        this.showToast('🧹 그래프 모드 필기를 비웠습니다.');
      }
      this._inkBakeDirty = true;
      this.render();
    }

    // 🌟 [액정 타블렛 하드웨어 펜 지우개 감지 엔진] 🌟
    // 1) W3C 표준 펜 지우개 버튼 / 펜 뒤통수 팁: (e.buttons & 32) !== 0 또는 e.button === 5
    // 2) 펜 사이드 배럴 버튼 (우클릭 연동): e.pointerType === 'pen' && (e.button === 2 || (e.buttons & 2) !== 0)
    isStylusEraserEvent(e) {
      if (!e) return false;
      if (typeof e.buttons === 'number' && (e.buttons & 32) !== 0) return true;
      if (e.button === 5) return true;
      const isPen = (e.pointerType === 'pen' || (!e.pointerType && (e.button === 2 || (e.buttons & 2))));
      if (isPen) {
        if (e.button === 2) return true;
        if (typeof e.buttons === 'number' && (e.buttons & 2) !== 0) return true;
      }
      return false;
    }

    getCardStickersArray(cardWidgetEl) {
      if (!cardWidgetEl) return [];
      if (cardWidgetEl.id === 'problemCardWidget') {
        if (!Array.isArray(this.problemCardStickers)) this.problemCardStickers = [];
        return this.problemCardStickers;
      }
      if (cardWidgetEl.id === 'graphCardWidget') {
        if (!Array.isArray(this.graphCardStickers)) this.graphCardStickers = [];
        return this.graphCardStickers;
      }
      if (!Array.isArray(cardWidgetEl._cardStickers)) {
        cardWidgetEl._cardStickers = [];
      }
      return cardWidgetEl._cardStickers;
    }

    getBoardStickerScreenRect(stk) {
      if (!stk) return null;
      const stkTarget = stk.target || 'board';
      if (this.isGraphCovered && !this.pdfPageBoardData && stkTarget !== 'board') return null;
      if ((!this.isGraphCovered || this.pdfPageBoardData) && stkTarget !== 'graph') return null;
      if (stkTarget === 'graph' && Boolean(stk.onPdfBoard) !== Boolean(this.pdfPageBoardData)) return null;
      if (this._isAudioReplayActive && this.audioSyncData && this.audioReplayViewMode === 'video') {
        if (typeof stk.tStart === 'number' && stk.tStart > (this.audioPlayCurrentMs || 0)) {
          return null;
        }
      }
      const isBoard = (stkTarget === 'board');
      const p1 = isBoard ? this.boardToScreen(stk.x1, stk.y1) : this.mathToScreen(stk.x1, stk.y1);
      const p2 = isBoard ? this.boardToScreen(stk.x2, stk.y2) : this.mathToScreen(stk.x2, stk.y2);
      if (!p1 || !p2 || !Number.isFinite(p1.x) || !Number.isFinite(p2.x)) return null;
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      return { x, y, w, h };
    }

    findBoardStickerAtScreenPos(pos, radius = 0) {
      if (!pos || !Array.isArray(this.boardStickers) || this.boardStickers.length === 0) return null;
      const r = (typeof radius === 'number' && radius > 0) ? radius : 0;
      for (let i = this.boardStickers.length - 1; i >= 0; i--) {
        const stk = this.boardStickers[i];
        const rect = this.getBoardStickerScreenRect(stk);
        if (!rect || rect.w < 4 || rect.h < 4) continue;
        if (
          pos.x >= rect.x - r &&
          pos.x <= rect.x + rect.w + r &&
          pos.y >= rect.y - r &&
          pos.y <= rect.y + rect.h + r
        ) {
          return { sticker: stk, index: i, rect, isDeleteBtn: false };
        }
      }
      return null;
    }

    deleteBoardSticker(stk) {
      if (!stk || !Array.isArray(this.boardStickers)) return false;
      const idx = this.boardStickers.findIndex(s => s === stk || (s && stk && s.id && s.id === stk.id));
      if (idx === -1) return false;
      const removed = this.boardStickers.splice(idx, 1)[0];
      this.undoStack.push({ type: 'sticker_delete', sticker: removed });
      if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
      this.redoStack = [];
      this.updateUndoRedoUI();
      if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
      this.render();
      return true;
    }

    removeBoardStickerById(stickerId) {
      if (!stickerId || !Array.isArray(this.boardStickers)) return false;
      const stk = this.boardStickers.find(s => s && s.id === stickerId);
      if (!stk) return false;
      return this.deleteBoardSticker(stk);
    }

    eraseCardStickerAtNormalizedPoint(cardWidgetEl, nx, ny, w = 1, h = 1, radiusPx = null) {
      if (!cardWidgetEl) return false;
      const curArr = this.getCardStickersArray(cardWidgetEl);
      if (!Array.isArray(curArr) || curArr.length === 0) return false;
      const rPx = (typeof radiusPx === 'number' && !isNaN(radiusPx)) ? radiusPx : Math.max(6, (this.currentEraserSize || 14) * 1.25);
      const rx = rPx / Math.max(1, w);
      const ry = rPx / Math.max(1, h);
      let erased = false;
      for (let i = curArr.length - 1; i >= 0; i--) {
        const stk = curArr[i];
        if (!stk) continue;
        if (
          nx >= stk.nx - rx &&
          nx <= stk.nx + stk.nw + rx &&
          ny >= stk.ny - ry &&
          ny <= stk.ny + stk.nh + ry
        ) {
          const removed = curArr.splice(i, 1)[0];
          this.undoStack.push({
            type: 'card_sticker_delete',
            cardEl: cardWidgetEl,
            stickersArr: curArr,
            sticker: removed,
            renderFn: () => {
              if (typeof cardWidgetEl._renderCardStickers === 'function') cardWidgetEl._renderCardStickers();
            }
          });
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];
          this.updateUndoRedoUI();
          erased = true;
        }
      }
      if (erased) {
        if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
        if (typeof cardWidgetEl._renderCardStickers === 'function') cardWidgetEl._renderCardStickers();
      }
      return erased;
    }

    syncWorkspaceStickerOverlay() {
      if (typeof document === 'undefined') return;
      const overlay = document.getElementById('workspaceStickerOverlay');
      if (!overlay) return;
      if (this._omitStickersForViewerSnapshot) {
        overlay.innerHTML = '';
        return;
      }
      const hasStickers = Array.isArray(this.boardStickers) && this.boardStickers.length > 0;
      const hasDraft = Boolean(this.isDrawingSticker && this.stickerDraftStart && this.stickerDraftCurrent);
      if (!hasStickers && !hasDraft) {
        overlay.innerHTML = '';
        return;
      }

      const existingMap = new Map();
      Array.from(overlay.querySelectorAll('.workspace-sticker-item')).forEach(el => {
        if (el.dataset && el.dataset.stickerId) {
          existingMap.set(el.dataset.stickerId, el);
        } else {
          el.remove();
        }
      });
      const activeIds = new Set();

      if (hasStickers) {
        for (let i = 0; i < this.boardStickers.length; i++) {
          const stk = this.boardStickers[i];
          if (!stk) continue;
          if (!stk.id) {
            stk.id = 'stk_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 6);
          }
          const rect = this.getBoardStickerScreenRect(stk);
          if (!rect || rect.w < 4 || rect.h < 4) continue;
          activeIds.add(stk.id);

          let itemEl = existingMap.get(stk.id);
          let badgeEl = itemEl ? itemEl.querySelector('.card-sticker-badge') : null;
          if (!itemEl) {
            itemEl = document.createElement('div');
            itemEl.className = 'card-sticker-item workspace-sticker-item' + (stk.revealed ? ' revealed' : '');
            itemEl.dataset.stickerId = stk.id;

            badgeEl = document.createElement('span');
            badgeEl.className = 'card-sticker-badge';
            itemEl.appendChild(badgeEl);

            let downPt = null;
            itemEl.addEventListener('pointerdown', (ev) => {
              if (this.isInkMode && this.activeInkTool === 'sticker') return;
              ev.preventDefault();
              ev.stopPropagation();
              if ((this.isInkMode && this.activeInkTool === 'eraser') || (typeof this.isStylusEraserEvent === 'function' && this.isStylusEraserEvent(ev))) {
                this.removeBoardStickerById(stk.id);
                return;
              }
              downPt = { x: ev.clientX, y: ev.clientY };
            });
            itemEl.addEventListener('pointerenter', (ev) => {
              if (((this.isInkMode && this.activeInkTool === 'eraser') || (typeof this.isStylusEraserEvent === 'function' && this.isStylusEraserEvent(ev))) && ev.buttons > 0) {
                this.removeBoardStickerById(stk.id);
              }
            });
            itemEl.addEventListener('pointerup', (ev) => {
              if (this.isInkMode && this.activeInkTool === 'sticker') return;
              if (!downPt) return;
              const dist = Math.hypot(ev.clientX - downPt.x, ev.clientY - downPt.y);
              downPt = null;
              if (dist <= 14) {
                ev.preventDefault();
                ev.stopPropagation();
                const curStk = (this.boardStickers || []).find(s => s && s.id === stk.id) || stk;
                curStk.revealed = !curStk.revealed;
                if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
                this.render();
              }
            });

            overlay.appendChild(itemEl);
          }

          itemEl.classList.toggle('revealed', Boolean(stk.revealed));
          itemEl.style.left = `${rect.x.toFixed(1)}px`;
          itemEl.style.top = `${rect.y.toFixed(1)}px`;
          itemEl.style.width = `${rect.w.toFixed(1)}px`;
          itemEl.style.height = `${rect.h.toFixed(1)}px`;
          if (badgeEl) {
            badgeEl.textContent = stk.revealed ? '🔓' : ((rect.w >= 64 && rect.h >= 24) ? '🔒 터치' : '🔒');
          }
        }
      }

      existingMap.forEach((el, id) => {
        if (!activeIds.has(id)) el.remove();
      });

      let draftEl = overlay.querySelector('.workspace-sticker-draft');
      if (hasDraft) {
        const s = this.stickerDraftStart;
        const c = this.stickerDraftCurrent;
        const dx = Math.min(s.x, c.x);
        const dy = Math.min(s.y, c.y);
        const dw = Math.abs(c.x - s.x);
        const dh = Math.abs(c.y - s.y);
        if (dw >= 2 && dh >= 2) {
          if (!draftEl) {
            draftEl = document.createElement('div');
            draftEl.className = 'workspace-sticker-draft';
            overlay.appendChild(draftEl);
          }
          draftEl.style.left = `${dx.toFixed(1)}px`;
          draftEl.style.top = `${dy.toFixed(1)}px`;
          draftEl.style.width = `${dw.toFixed(1)}px`;
          draftEl.style.height = `${dh.toFixed(1)}px`;
        } else if (draftEl) {
          draftEl.remove();
        }
      } else if (draftEl) {
        draftEl.remove();
      }
    }

    drawBoardStickers(ctx, isExport = false) {
      if (!isExport) {
        this.syncWorkspaceStickerOverlay();
        return;
      }
      if (this._omitStickersForViewerSnapshot) return;
      const hasStickers = Array.isArray(this.boardStickers) && this.boardStickers.length > 0;
      const hasDraft = false;
      if (!hasStickers) return;

      if (hasStickers) {
        for (let i = 0; i < this.boardStickers.length; i++) {
          const stk = this.boardStickers[i];
          const rect = this.getBoardStickerScreenRect(stk);
          if (!rect || rect.w < 4 || rect.h < 4) continue;
          const { x, y, w, h } = rect;
          const r = Math.min(7, w / 3, h / 3);

          if (stk.revealed) {
            if (isExport) continue; // 내보내기 이미지에서는 열린 스티커의 점선 테두리를 숨겨 깔끔하게 출력
            ctx.save();
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
            else ctx.rect(x, y, w, h);
            ctx.fillStyle = 'rgba(250, 204, 21, 0.06)';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = 'rgba(202, 138, 4, 0.72)';
            ctx.stroke();
            ctx.setLineDash([]);
            if (w >= 28 && h >= 18) {
              ctx.font = '700 10px "Pretendard", sans-serif';
              ctx.fillStyle = '#ca8a04';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              ctx.fillText('🔓', x + 5, y + 4);
            }
            ctx.restore();
          } else {
            ctx.save();
            ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            const grad = ctx.createLinearGradient(x, y, x + w, y + h);
            grad.addColorStop(0, '#fef08a');
            grad.addColorStop(0.68, '#fde047');
            grad.addColorStop(1, '#facc15');
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
            else ctx.rect(x, y, w, h);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#eab308';
            ctx.stroke();

            // 우하단 포스트잇 접힌 모서리 포인트
            if (w >= 24 && h >= 18) {
              const fold = Math.min(10, w * 0.2, h * 0.25);
              ctx.beginPath();
              ctx.moveTo(x + w - fold, y + h);
              ctx.lineTo(x + w, y + h - fold);
              ctx.lineTo(x + w, y + h);
              ctx.closePath();
              ctx.fillStyle = 'rgba(202, 138, 4, 0.34)';
              ctx.fill();
            }

            if (!isExport && w >= 32 && h >= 20) {
              const labelText = (w >= 68 && h >= 26) ? '🔒 터치' : '🔒';
              ctx.font = '800 11px "Pretendard", sans-serif';
              const tw = ctx.measureText(labelText).width;
              const pw = tw + 12;
              const ph = 18;
              const px = x + (w - pw) / 2;
              const py = y + (h - ph) / 2;
              ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 9);
              else ctx.rect(px, py, pw, ph);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
              ctx.fill();
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(202, 138, 4, 0.28)';
              ctx.stroke();
              ctx.fillStyle = '#854d0e';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, x + w / 2, y + h / 2 + 0.5);
            }
            ctx.restore();
          }
        }
      }

      if (hasDraft) {
        const s = this.stickerDraftStart;
        const c = this.stickerDraftCurrent;
        const dx = Math.min(s.x, c.x);
        const dy = Math.min(s.y, c.y);
        const dw = Math.abs(c.x - s.x);
        const dh = Math.abs(c.y - s.y);
        if (dw >= 4 && dh >= 4) {
          ctx.save();
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(dx, dy, dw, dh, 7);
          else ctx.rect(dx, dy, dw, dh);
          ctx.fillStyle = 'rgba(250, 204, 21, 0.68)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ca8a04';
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    _distSegmentToSegment(a0, a1, b0, b1) {
      if (!a0 || !a1 || !b0 || !b1) return Infinity;
      const d1x = a1.x - a0.x;
      const d1y = a1.y - a0.y;
      const d2x = b1.x - b0.x;
      const d2y = b1.y - b0.y;
      const cross = (px, py, qx, qy) => px * qy - py * qx;
      const c1 = cross(d1x, d1y, b0.x - a0.x, b0.y - a0.y);
      const c2 = cross(d1x, d1y, b1.x - a0.x, b1.y - a0.y);
      const c3 = cross(d2x, d2y, a0.x - b0.x, a0.y - b0.y);
      const c4 = cross(d2x, d2y, a1.x - b0.x, a1.y - b0.y);
      if (((c1 <= 0 && c2 >= 0) || (c1 >= 0 && c2 <= 0)) && ((c3 <= 0 && c4 >= 0) || (c3 >= 0 && c4 <= 0))) {
        if (Math.abs(cross(d1x, d1y, d2x, d2y)) > 1e-9) {
          return 0;
        }
      }
      return Math.min(
        this.distToSegment(a0, b0, b1),
        this.distToSegment(a1, b0, b1),
        this.distToSegment(b0, a0, a1),
        this.distToSegment(b1, a0, a1)
      );
    }

    eraseInkAtPoint(screenX, screenY, eraseRadius = null, deferRender = false, prevScreenPos = null) {
      eraseRadius = (typeof eraseRadius === 'number' && !isNaN(eraseRadius)) ? eraseRadius : (this.currentEraserSize || 14);
      let stickerErased = false;
      if (Array.isArray(this.boardStickers) && this.boardStickers.length > 0) {
        const hitStk = this.findBoardStickerAtScreenPos({ x: screenX, y: screenY }, eraseRadius);
        if (hitStk && hitStk.sticker) {
          if (this.deleteBoardSticker(hitStk.sticker)) {
            stickerErased = true;
          }
        }
      }
      if (!this.inkStrokes || this.inkStrokes.length === 0) return stickerErased;

      const cullPad = eraseRadius + 24;
      const cursorPt = { x: screenX, y: screenY };
      const hasSweep = Boolean(
        prevScreenPos &&
        Number.isFinite(prevScreenPos.x) &&
        Number.isFinite(prevScreenPos.y) &&
        Math.hypot(screenX - prevScreenPos.x, screenY - prevScreenPos.y) >= 1.5
      );
      const sweepMinX = hasSweep ? Math.min(prevScreenPos.x, screenX) : screenX;
      const sweepMaxX = hasSweep ? Math.max(prevScreenPos.x, screenX) : screenX;
      const sweepMinY = hasSweep ? Math.min(prevScreenPos.y, screenY) : screenY;
      const sweepMaxY = hasSweep ? Math.max(prevScreenPos.y, screenY) : screenY;
      const segHit = (pA, pB) => hasSweep
        ? (this._distSegmentToSegment(prevScreenPos, cursorPt, pA, pB) <= eraseRadius)
        : (this.distToSegment(cursorPt, pA, pB) <= eraseRadius);

      let modified = false;
      const totalLen = this.inkStrokes.length;
      const remaining = [];
      const removedBatch = [];

      for (let sIdx = 0; sIdx < totalLen; sIdx++) {
        const stroke = this.inkStrokes[sIdx];
        if (!stroke) continue;
        const strokeTarget = stroke.target || 'board';
        if (this.isGraphCovered && !this.pdfPageBoardData && strokeTarget !== 'board') {
          remaining.push(stroke);
          continue;
        }
        if ((!this.isGraphCovered || this.pdfPageBoardData) && strokeTarget !== 'graph') {
          remaining.push(stroke);
          continue;
        }
        if (strokeTarget === 'graph' && Boolean(stroke.onPdfBoard) !== Boolean(this.pdfPageBoardData)) {
          remaining.push(stroke);
          continue;
        }

        const isBoard = strokeTarget === 'board';
        const bz = this.boardZoom || 1.0;
        let hit = false;

        // 🌟 기하 도형(Shape) 최단거리 검사
        if (stroke.shape) {
          let s1 = null, s2 = null;
          if (stroke.shape.start && stroke.shape.end) {
            if (isBoard) {
              s1 = this.boardToScreen(stroke.shape.start.x, stroke.shape.start.y);
              s2 = this.boardToScreen(stroke.shape.end.x, stroke.shape.end.y);
            } else {
              s1 = this.mathToScreen(stroke.shape.start.x, stroke.shape.start.y);
              s2 = this.mathToScreen(stroke.shape.end.x, stroke.shape.end.y);
            }
          }

          if (stroke.shape.type === 'line') {
            if (segHit(s1, s2)) hit = true;
          } else if (stroke.shape.type === 'circle') {
            const sc = isBoard ? this.boardToScreen(stroke.shape.center.x, stroke.shape.center.y) : this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y);
            const sr = isBoard ? (stroke.shape.radius * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x + stroke.shape.radius, stroke.shape.center.y).x - sc.x);
            const dToCenter = Math.hypot(screenX - sc.x, screenY - sc.y);
            if (Math.abs(dToCenter - sr) <= eraseRadius) {
              hit = true;
            } else if (hasSweep) {
              const dSegCenter = this.distToSegment(sc, prevScreenPos, cursorPt);
              const dPrevCenter = Math.hypot(prevScreenPos.x - sc.x, prevScreenPos.y - sc.y);
              const minC = dSegCenter;
              const maxC = Math.max(dPrevCenter, dToCenter);
              if (minC <= sr + eraseRadius && maxC >= Math.max(0, sr - eraseRadius)) hit = true;
            }
          } else if (stroke.shape.type === 'ellipse') {
            const sc = isBoard ? this.boardToScreen(stroke.shape.center.x, stroke.shape.center.y) : this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y);
            const srx = isBoard ? (stroke.shape.rx * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x + stroke.shape.rx, stroke.shape.center.y).x - sc.x);
            const sry = isBoard ? (stroke.shape.ry * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y + stroke.shape.ry).y - sc.y);
            const normD = Math.hypot((screenX - sc.x) / Math.max(1, srx), (screenY - sc.y) / Math.max(1, sry));
            const avgR = (srx + sry) / 2;
            if (Math.abs(normD - 1) * avgR <= eraseRadius) hit = true;
          } else if (stroke.shape.type === 'rect') {
            const rs1 = isBoard ? this.boardToScreen(stroke.shape.min.x, stroke.shape.min.y) : this.mathToScreen(stroke.shape.min.x, stroke.shape.min.y);
            const rs2 = isBoard ? this.boardToScreen(stroke.shape.max.x, stroke.shape.max.y) : this.mathToScreen(stroke.shape.max.x, stroke.shape.max.y);
            const rx = Math.min(rs1.x, rs2.x), ry = Math.min(rs1.y, rs2.y);
            const rw = Math.abs(rs2.x - rs1.x), rh = Math.abs(rs2.y - rs1.y);
            const p1 = { x: rx, y: ry }, p2 = { x: rx + rw, y: ry };
            const p3 = { x: rx + rw, y: ry + rh }, p4 = { x: rx, y: ry + rh };
            if (segHit(p1, p2) || segHit(p2, p3) || segHit(p3, p4) || segHit(p4, p1)) {
              hit = true;
            }
          } else if (stroke.shape.pts && stroke.shape.pts.length >= 2) {
            const sPts = stroke.shape.pts.map(pt => isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y));
            for (let i = 0; i < sPts.length - 1; i++) {
              if (segHit(sPts[i], sPts[i + 1])) {
                hit = true;
                break;
              }
            }
            if (!hit && stroke.shape.closed && sPts.length >= 3) {
              if (segHit(sPts[sPts.length - 1], sPts[0])) {
                hit = true;
              }
            }
          }
        }

        if (hit) {
          modified = true;
          removedBatch.push({ stroke, index: sIdx });
          continue;
        }

        if (!stroke.points || stroke.points.length === 0) continue;

        // 🌟 [O(1) AABB 바운딩박스 프리컬링 (고속 스윕 캡슐 포함)]:
        if (!stroke.shape) {
          const sb = this._getStrokeScreenBounds(stroke, isBoard);
          if (
            sb &&
            (sweepMaxX < sb.minX - cullPad ||
              sweepMinX > sb.maxX + cullPad ||
              sweepMaxY < sb.minY - cullPad ||
              sweepMinY > sb.maxY + cullPad)
          ) {
            remaining.push(stroke);
            continue;
          }
        }

        // 바운딩박스가 겹치는 소수의 후보 획에 대해서만 단일 패스 점·선분 정밀 판정 수행
        const pts = stroke.points;
        let prevS = isBoard ? this.boardToScreen(pts[0].x, pts[0].y) : this.mathToScreen(pts[0].x, pts[0].y);
        if (hasSweep ? (this.distToSegment(prevS, prevScreenPos, cursorPt) <= eraseRadius) : (Math.hypot(prevS.x - screenX, prevS.y - screenY) <= eraseRadius)) {
          modified = true;
          removedBatch.push({ stroke, index: sIdx });
          continue;
        }
        for (let i = 1; i < pts.length; i++) {
          const curS = isBoard ? this.boardToScreen(pts[i].x, pts[i].y) : this.mathToScreen(pts[i].x, pts[i].y);
          if (segHit(prevS, curS)) {
            hit = true;
            break;
          }
          prevS = curS;
        }

        if (hit) {
          modified = true;
          removedBatch.push({ stroke, index: sIdx });
        } else {
          remaining.push(stroke);
        }
      }

      if (this.isAudioRecording && !this.isAudioRecordPaused) {
        this.recordAudioCursorPoint(screenX, screenY, '#f43f5e', true, { cursorKind: 'eraser' });
      }

      if (modified) {
        if (this.isAudioRecording && !this.isAudioRecordPaused) {
          const eraseTimeMs = this.getAudioRecordElapsedMs();
          if (!this.audioErasedStrokes) this.audioErasedStrokes = [];
          for (let i = 0; i < removedBatch.length; i++) {
            const st = removedBatch[i].stroke;
            this.audioErasedStrokes.push({ ...st, erasedAt: eraseTimeMs });
          }
        }

        if (removedBatch.length > 0) {
          if (!this._erasedInCurrentStroke || !this._currentEraseUndoEntry) {
            const eraseEntry = {
              type: 'strokes_erase',
              batches: [removedBatch]
            };
            this._currentEraseUndoEntry = eraseEntry;
            this._erasedInCurrentStroke = true;
            this.undoStack.push(eraseEntry);
            if (this.undoStack.length > this.maxHistory) {
              this.undoStack.shift();
            }
            this.redoStack = [];
            this.updateUndoRedoUI();
          } else {
            this._currentEraseUndoEntry.batches.push(removedBatch);
          }
        }

        this.inkStrokes = remaining;
        this._hasSceneFreeze = false;
        if (!this._patchInkCacheForRemovedStrokes(removedBatch)) {
          this._inkBakeDirty = true;
        }
        if (deferRender && typeof this.requestRender === 'function') {
          this.requestRender();
        } else {
          this.render();
        }
      }
      return Boolean(modified || stickerErased);
    }

    // 🌟 Draw & Hold 기하 도형 & 수학 함수 개형 인식 엔진 (Line, Circle, Ellipse, Rect, Triangle, Parabola, Cubic/Sine Wave) 🌟
    recognizeInkShape(stroke) {
      if (!stroke || !stroke.points || stroke.points.length < 4) return null;

      const isCardPixel = Boolean(stroke._isCardPixelSpace);
      const isBoard = !isCardPixel && (stroke.target || 'board') === 'board';
      const bz = isCardPixel ? 1.0 : (this.boardZoom || 1.0);
      const rawScreenPts = isCardPixel
        ? stroke.points.map(pt => ({ x: pt.x, y: pt.y }))
        : (isBoard
          ? stroke.points.map(pt => this.boardToScreen(pt.x, pt.y))
          : stroke.points.map(pt => this.mathToScreen(pt.x, pt.y)));

      const toTargetCoord = (pt) => {
        if (isCardPixel) {
          return { x: pt.x, y: pt.y };
        }
        if (isBoard) {
          return this.screenToBoard(pt.x, pt.y);
        }
        const m = this.screenToMath(pt.x, pt.y);
        return { x: m.x, y: m.y };
      };

      // 🌟 [시작점·끝점 정지 미세 노이즈만 제한적으로 제거 (작은 글씨 `3`, `ㄴ` 곡선/모서리 훼손 원천 방지!)]:
      // 기존 10px/12px 무조건 삭제는 20~28px 크기의 숫자 `3`이나 `ㄴ`의 곡선·모서리를 통째로 잘라내어 직선으로 둔갑시켰음.
      // 따라서 전체 바운딩 크기 대비 최대 7~8%(최대 3.0~3.5px) 이내에 제자리 뭉친 정지 떨림 점만 제거합니다.
      let rawMinX = rawScreenPts[0].x, rawMaxX = rawScreenPts[0].x;
      let rawMinY = rawScreenPts[0].y, rawMaxY = rawScreenPts[0].y;
      for (let i = 1; i < rawScreenPts.length; i++) {
        const rp = rawScreenPts[i];
        if (rp.x < rawMinX) rawMinX = rp.x;
        if (rp.x > rawMaxX) rawMaxX = rp.x;
        if (rp.y < rawMinY) rawMinY = rp.y;
        if (rp.y > rawMaxY) rawMaxY = rp.y;
      }
      const rawMaxDim = Math.max(1, rawMaxX - rawMinX, rawMaxY - rawMinY);
      const startTrimRadius = Math.min(3.0, rawMaxDim * 0.07);
      const endTrimRadius = Math.min(3.5, rawMaxDim * 0.08);

      const rawFirst = rawScreenPts[0];
      let trimStartIdx = 0;
      while (trimStartIdx < rawScreenPts.length - 3 && Math.hypot(rawScreenPts[trimStartIdx + 1].x - rawFirst.x, rawScreenPts[trimStartIdx + 1].y - rawFirst.y) <= startTrimRadius) {
        trimStartIdx++;
      }
      const rawLast = rawScreenPts[rawScreenPts.length - 1];
      let trimEndIdx = rawScreenPts.length - 1;
      while (trimEndIdx > trimStartIdx + 2 && Math.hypot(rawScreenPts[trimEndIdx - 1].x - rawLast.x, rawScreenPts[trimEndIdx - 1].y - rawLast.y) <= endTrimRadius) {
        trimEndIdx--;
      }
      const trimmedPts = [rawFirst, ...rawScreenPts.slice(trimStartIdx + 1, trimEndIdx), rawLast];

      // 2) 공간 거리(2.5px) 기준으로 균일하게 리샘플링하여 240Hz 중복 점으로 인한 arcLen 부풀림 차단 및 세밀한 굴곡 보존
      const screenPts = [trimmedPts[0]];
      for (let i = 1; i < trimmedPts.length - 1; i++) {
        const prev = screenPts[screenPts.length - 1];
        if (Math.hypot(trimmedPts[i].x - prev.x, trimmedPts[i].y - prev.y) >= 2.5) {
          screenPts.push(trimmedPts[i]);
        }
      }
      if (trimmedPts.length > 1) {
        screenPts.push(trimmedPts[trimmedPts.length - 1]);
      }

      const N = screenPts.length;
      if (N < 2) return null;
      const pStart = screenPts[0];
      const pEnd = screenPts[N - 1];

      const chordLen = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
      let arcLen = 0;
      let minX = screenPts[0].x, maxX = screenPts[0].x;
      let minY = screenPts[0].y, maxY = screenPts[0].y;

      for (let i = 0; i < N - 1; i++) {
        arcLen += Math.hypot(screenPts[i + 1].x - screenPts[i].x, screenPts[i + 1].y - screenPts[i].y);
        if (screenPts[i + 1].x < minX) minX = screenPts[i + 1].x;
        if (screenPts[i + 1].x > maxX) maxX = screenPts[i + 1].x;
        if (screenPts[i + 1].y < minY) minY = screenPts[i + 1].y;
        if (screenPts[i + 1].y > maxY) maxY = screenPts[i + 1].y;
      }

      if (arcLen < 30) return null;

      const W = Math.max(1, maxX - minX);
      const H = Math.max(1, maxY - minY);
      const maxDim = Math.max(W, H);
      const minDim = Math.min(W, H);
      const straightness = chordLen / Math.max(1, arcLen);

      // 시작점-끝점 직선으로부터의 최대 수직 이탈 거리 계산
      let maxLineDev = 0;
      for (let i = 1; i < N - 1; i++) {
        const dev = this.distToSegment(screenPts[i], pStart, pEnd);
        if (dev > maxLineDev) maxLineDev = dev;
      }

      // --- [1. 직선 판별 (Straight Line & Axis Magnet Snap)] ---
      // 🌟 작은 손글씨(`ㄴ`, `3` 등)가 직선으로 오판되지 않도록 최소 직선 거리(chordLen >= 30),
      // 엄격한 직선도(straightness >= 0.89), 비례 이탈 허용치(maxLineDev <= max(4.5, chordLen * 0.075)) 적용!
      const isStraightLine = (chordLen >= 30) &&
        (maxLineDev <= Math.max(4.5, chordLen * 0.075)) &&
        (straightness >= 0.89 || (straightness >= 0.85 && maxLineDev <= Math.max(3.5, chordLen * 0.055)));

      if (isStraightLine) {
        let endX = pEnd.x;
        let endY = pEnd.y;

        const dx = endX - pStart.x;
        const dy = endY - pStart.y;
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
        const absAngle = Math.abs(angleDeg);

        const snapAngleThresh = 4.0;
        const diagAngleThresh = 1.5;

        let snapped = null;
        if (absAngle < snapAngleThresh || absAngle > (180 - snapAngleThresh)) {
          endY = pStart.y;
          snapped = 'horizontal';
        } else if (Math.abs(absAngle - 90) < snapAngleThresh) {
          endX = pStart.x;
          snapped = 'vertical';
        } else if (Math.abs(absAngle - 45) < diagAngleThresh || Math.abs(absAngle - 135) < diagAngleThresh) {
          const dist = Math.hypot(dx, dy);
          const signX = dx >= 0 ? 1 : -1;
          const signY = dy >= 0 ? 1 : -1;
          endX = pStart.x + signX * dist * Math.SQRT1_2;
          endY = pStart.y + signY * dist * Math.SQRT1_2;
          snapped = 'diagonal';
        }

        return {
          type: 'line',
          start: toTargetCoord(pStart),
          end: toTargetCoord({ x: endX, y: endY }),
          snapped: snapped
        };
      }

      // --- [2. 열린 수학 함수 곡선 판별: 삼차함수(Cubic Wave) & 이차함수 포물선(Parabola)] ---
      const horizSpan = Math.abs(pEnd.x - pStart.x);
      const gap = chordLen;
      // 진짜 닫힌 도형은 시작점과 끝점이 전체 궤적 길이의 16% 이내로 만나는 루프일 때만 해당!
      const isActuallyClosedLoop = (gap <= arcLen * 0.16) || (gap <= 24);

      if (!isActuallyClosedLoop && W >= 24 && H >= 24 && maxDim >= 34 && horizSpan >= W * 0.28) {
        // 필기 진행 방향을 좌->우로 정렬한 점열 생성
        const ptsLR = (pStart.x <= pEnd.x) ? screenPts : screenPts.slice().reverse();
        const pLeft = ptsLR[0];
        const pRight = ptsLR[N - 1];

        // (A) 극점 2개짜리 삼차함수 개형 (100% 완벽한 변곡점 점대칭 도형) 판별
        // 🌟 이차함수 끝단 미세 갈고리가 삼차함수로 오판되지 않도록 3개 구간 스윙(sw1, sw2, sw3) 모두 최소 0.22*H 이상 요구!
        let bestUpDownUp = { swing: -1, i1: -1, i2: -1 };
        let bestDownUpDown = { swing: -1, i1: -1, i2: -1 };

        if (horizSpan >= W * 0.40) {
          let minYIdxSoFar = 1;
          let maxYIdxSoFar = 1;
          for (let i2 = 2; i2 < N - 1; i2++) {
            if (ptsLR[i2 - 1].y < ptsLR[minYIdxSoFar].y) minYIdxSoFar = i2 - 1;
            if (ptsLR[i2 - 1].y > ptsLR[maxYIdxSoFar].y) maxYIdxSoFar = i2 - 1;

            // 1) ↗ ↘ ↗ (최고차항 양수 삼차함수: 극대 minYIdxSoFar -> 극소 i2)
            const e1U = ptsLR[minYIdxSoFar];
            const e2U = ptsLR[i2];
            const sw1U = pLeft.y - e1U.y;
            const sw2U = e2U.y - e1U.y;
            const sw3U = e2U.y - pRight.y;
            if (sw1U >= 0.22 * H && sw2U >= 0.25 * H && sw3U >= 0.22 * H && (e2U.x - e1U.x) >= -0.55 * W) {
              const totalSw = sw1U + sw2U + sw3U;
              if (totalSw > bestUpDownUp.swing) {
                bestUpDownUp = { swing: totalSw, i1: minYIdxSoFar, i2: i2 };
              }
            }

            // 2) ↘ ↗ ↘ (최고차항 음수 삼차함수: 극소 maxYIdxSoFar -> 극대 i2)
            const e1D = ptsLR[maxYIdxSoFar];
            const e2D = ptsLR[i2];
            const sw1D = e1D.y - pLeft.y;
            const sw2D = e1D.y - e2D.y;
            const sw3D = pRight.y - e2D.y;
            if (sw1D >= 0.22 * H && sw2D >= 0.25 * H && sw3D >= 0.22 * H && (e2D.x - e1D.x) >= -0.55 * W) {
              const totalSw = sw1D + sw2D + sw3D;
              if (totalSw > bestDownUpDown.swing) {
                bestDownUpDown = { swing: totalSw, i1: maxYIdxSoFar, i2: i2 };
              }
            }
          }
        }

        const isUpDownUp = (bestUpDownUp.swing > 0 && bestUpDownUp.swing >= bestDownUpDown.swing);
        const isDownUpDown = (!isUpDownUp && bestDownUpDown.swing > 0);

        if (isUpDownUp || isDownUpDown) {
          const chosen = isUpDownUp ? bestUpDownUp : bestDownUpDown;
          const e1 = ptsLR[chosen.i1];
          const e2 = ptsLR[chosen.i2];

          const cy = (e1.y + e2.y) / 2;
          const amp = Math.max(H * 0.28, Math.abs(e2.y - e1.y) / 2);
          const dir = isUpDownUp ? 1 : -1;

          const leftTailRatio = Math.abs(pLeft.y - cy) / Math.max(1, amp);
          const rightTailRatio = Math.abs(pRight.y - cy) / Math.max(1, amp);
          const avgTailRatio = (leftTailRatio + rightTailRatio) / 2;
          const sMax = (avgTailRatio < 0.35) ? 1.75 : Math.min(2.02, Math.max(1.85, 1.75 + avgTailRatio * 0.22));

          const sampleCount = 64;
          const waveScreenPts = [];
          for (let k = 0; k <= sampleCount; k++) {
            const u = k / sampleCount;
            const s = -sMax + 2 * sMax * u;
            const sx = minX + W * u;
            const gVal = (3 * s - s * s * s) / 2;
            const sy = cy + dir * amp * gVal;
            waveScreenPts.push({ x: sx, y: sy });
          }
          return {
            type: 'cubic_wave',
            closed: false,
            pts: waveScreenPts.map(toTargetCoord)
          };
        }

        // (B) 이차함수 포물선 (Parabola: 아래로 볼록 U / 위로 볼록 ∩) 판별
        // 🌟 아이패드에서 삼차함수가 100% 잘 인식된 것과 동일한 '필기 순서 극점 스윙(↘↗ 또는 ↗↘)' 알고리즘 적용!
        // (손으로 그린 둥근 U자/∩자 개형이 u^2 템플릿 오차나 좌우 비대칭 때문에 탈락하지 않도록 직관화)
        let botIdx = 1;
        let topIdx = 1;
        for (let i = 1; i < N - 1; i++) {
          if (ptsLR[i].y > ptsLR[botIdx].y) botIdx = i;
          if (ptsLR[i].y < ptsLR[topIdx].y) topIdx = i;
        }
        const botPeak = ptsLR[botIdx];
        const topPeak = ptsLR[topIdx];

        // botIdx 전후의 최고점(최소 y) 탐색 -> 아래로 볼록(U) 스윙 측정
        let preBotMinY = ptsLR[0].y;
        for (let i = 0; i < botIdx; i++) {
          if (ptsLR[i].y < preBotMinY) preBotMinY = ptsLR[i].y;
        }
        let postBotMinY = ptsLR[N - 1].y;
        for (let i = botIdx + 1; i < N; i++) {
          if (ptsLR[i].y < postBotMinY) postBotMinY = ptsLR[i].y;
        }

        // topIdx 전후의 최저점(최대 y) 탐색 -> 위로 볼록(∩) 스윙 측정
        let preTopMaxY = ptsLR[0].y;
        for (let i = 0; i < topIdx; i++) {
          if (ptsLR[i].y > preTopMaxY) preTopMaxY = ptsLR[i].y;
        }
        let postTopMaxY = ptsLR[N - 1].y;
        for (let i = topIdx + 1; i < N; i++) {
          if (ptsLR[i].y > postTopMaxY) postTopMaxY = ptsLR[i].y;
        }

        const botInsideX = (botPeak.x >= minX + 0.08 * W && botPeak.x <= maxX - 0.08 * W);
        const topInsideX = (topPeak.x >= minX + 0.08 * W && topPeak.x <= maxX - 0.08 * W);

        const cupDownSwing = botPeak.y - preBotMinY;
        const cupUpSwing = botPeak.y - postBotMinY;
        const capUpSwing = preTopMaxY - topPeak.y;
        const capDownSwing = postTopMaxY - topPeak.y;

        // 열린 포물선 조건: 양쪽 날개가 모두 꼭짓점 대비 42% 이상 뻗어 올라가거나(U) 내려가고(∩),
        // 원/타원처럼 입구가 좁게 오므라든 도형이 아닐 것(gap > maxDim * 0.30 또는 horizSpan >= W * 0.45)
        const isOpenArch = (gap > maxDim * 0.30) || (horizSpan >= W * 0.45);
        const isCupParabola = isOpenArch && botInsideX &&
          (cupDownSwing >= 0.42 * H) && (cupUpSwing >= 0.42 * H) &&
          (Math.max(cupDownSwing, cupUpSwing) >= 0.65 * H);

        const isCapParabola = isOpenArch && topInsideX &&
          (capUpSwing >= 0.42 * H) && (capDownSwing >= 0.42 * H) &&
          (Math.max(capUpSwing, capDownSwing) >= 0.65 * H);

        if (isCupParabola || isCapParabola) {
          // 사각형(ㄷ자/ㅁ자)과 구분하기 위해 꼭짓점 부근이 평평한 직선 바닥인지 간단히 체크 (타원/포물선은 매끄럽게 통과)
          const vy = isCupParabola ? maxY : minY;
          const endY = isCupParabola ? Math.min(preBotMinY, postBotMinY) : Math.max(preTopMaxY, postTopMaxY);
          const vx = (minX + maxX) / 2;
          const halfW = Math.max(1, W / 2);
          const evalCleanParaY = (x) => {
            const u = (x - vx) / halfW;
            return vy + (endY - vy) * (u * u);
          };
          const sampleCount = 48;
          const paraScreenPts = [];
          for (let s = 0; s <= sampleCount; s++) {
            const sx = minX + W * (s / sampleCount);
            const sy = evalCleanParaY(sx);
            paraScreenPts.push({ x: sx, y: sy });
          }
          return {
            type: 'parabola',
            closed: false,
            pts: paraScreenPts.map(toTargetCoord)
          };
        }
      }

      // --- [3. 닫힌 도형 판별: 삼각형(Triangle), 정원(Circle), 타원(Ellipse), 직사각형(Rect)] ---
      const closedRatioLimit = stroke.isHighlighter ? 0.56 : 0.44;
      const isClosed = (gap / maxDim <= closedRatioLimit);

      if (isClosed && arcLen >= 45 && minDim >= 18) {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const aspect = minDim / maxDim;

        // (A) 타원/원 오차 계산
        const rx = Math.max(1, W / 2);
        const ry = Math.max(1, H / 2);
        let rSum = 0;
        let uSum = 0;
        const radii = [];
        const uVals = [];
        for (let i = 0; i < N; i++) {
          const r = Math.hypot(screenPts[i].x - cx, screenPts[i].y - cy);
          radii.push(r);
          rSum += r;
          const u = Math.hypot((screenPts[i].x - cx) / rx, (screenPts[i].y - cy) / ry);
          uVals.push(u);
          uSum += u;
        }
        const avgR = rSum / N;
        const avgU = uSum / N;
        let varSum = 0;
        let uVarSum = 0;
        let distToEllipseSum = 0;
        for (let i = 0; i < N; i++) {
          varSum += (radii[i] - avgR) ** 2;
          uVarSum += (uVals[i] - avgU) ** 2;
          distToEllipseSum += Math.abs(uVals[i] - 1.0) * ((rx + ry) / 2);
        }
        const stdDev = Math.sqrt(varSum / N);
        const roundness = stdDev / (avgR || 1);
        const ellipseStd = Math.sqrt(uVarSum / N) / (avgU || 1);
        const avgDistToEllipse = distToEllipseSum / N;

        // (B) 직사각형 오차(네 변 밀착도) 계산
        let distToBoxSum = 0;
        for (let i = 0; i < N; i++) {
          const px = screenPts[i].x;
          const py = screenPts[i].y;
          const dLeft = Math.abs(px - minX);
          const dRight = Math.abs(px - maxX);
          const dTop = Math.abs(py - minY);
          const dBottom = Math.abs(py - maxY);
          distToBoxSum += Math.min(dLeft, dRight, dTop, dBottom);
        }
        const avgDistToBox = distToBoxSum / N;

        // (C) 삼각형(Triangle) 3꼭짓점 추출 및 세 변 밀착도 계산
        const calcTriError = (v0, v1, v2) => {
          let sum = 0;
          for (let i = 0; i < N; i++) {
            const d0 = this.distToSegment(screenPts[i], v0, v1);
            const d1 = this.distToSegment(screenPts[i], v1, v2);
            const d2 = this.distToSegment(screenPts[i], v2, v0);
            sum += Math.min(d0, d1, d2);
          }
          return sum / N;
        };

        const findTriFromSeed = (seedPt) => {
          let v1 = screenPts[0], maxD1 = -1;
          for (let i = 0; i < N; i++) {
            const d = Math.hypot(screenPts[i].x - seedPt.x, screenPts[i].y - seedPt.y);
            if (d > maxD1) { maxD1 = d; v1 = screenPts[i]; }
          }
          let v2 = screenPts[0], maxD2 = -1;
          for (let i = 0; i < N; i++) {
            const d = this.distToSegment(screenPts[i], seedPt, v1);
            if (d > maxD2) { maxD2 = d; v2 = screenPts[i]; }
          }
          let v0 = seedPt, maxD0 = -1;
          for (let i = 0; i < N; i++) {
            const d = this.distToSegment(screenPts[i], v1, v2);
            if (d > maxD0) { maxD0 = d; v0 = screenPts[i]; }
          }
          return [v0, v1, v2];
        };

        const seedStart = { x: (pStart.x + pEnd.x) / 2, y: (pStart.y + pEnd.y) / 2 };
        let farFromCenter = screenPts[0], maxDC = -1;
        for (let i = 0; i < N; i++) {
          const d = Math.hypot(screenPts[i].x - cx, screenPts[i].y - cy);
          if (d > maxDC) { maxDC = d; farFromCenter = screenPts[i]; }
        }

        const triA = findTriFromSeed(seedStart);
        const triB = findTriFromSeed(farFromCenter);
        const errTriA = calcTriError(triA[0], triA[1], triA[2]);
        const errTriB = calcTriError(triB[0], triB[1], triB[2]);
        const bestTri = (errTriA <= errTriB) ? triA : triB;
        const avgDistToTri = Math.min(errTriA, errTriB);

        const s01 = Math.hypot(bestTri[1].x - bestTri[0].x, bestTri[1].y - bestTri[0].y);
        const s12 = Math.hypot(bestTri[2].x - bestTri[1].x, bestTri[2].y - bestTri[1].y);
        const s20 = Math.hypot(bestTri[0].x - bestTri[2].x, bestTri[0].y - bestTri[2].y);
        const triValidSides = (Math.min(s01, s12, s20) >= maxDim * 0.34);

        if (triValidSides && avgDistToTri < maxDim * 0.068 && avgDistToTri < avgDistToBox * 0.82 && avgDistToTri < avgDistToEllipse * 0.82) {
          const snappedTri = bestTri.map(p => ({ x: p.x, y: p.y }));
          for (let k = 0; k < 3; k++) {
            const pA = snappedTri[k];
            const pB = snappedTri[(k + 1) % 3];
            const dx = pB.x - pA.x;
            const dy = pB.y - pA.y;
            const len = Math.hypot(dx, dy) || 1;
            if (Math.abs(dy) / len < 0.06) {
              const avgY = (pA.y + pB.y) / 2;
              pA.y = avgY;
              pB.y = avgY;
            } else if (Math.abs(dx) / len < 0.06) {
              const avgX = (pA.x + pB.x) / 2;
              pA.x = avgX;
              pB.x = avgX;
            }
          }
          return {
            type: 'triangle',
            closed: true,
            pts: snappedTri.map(toTargetCoord)
          };
        }

        const isBetterRectThanCircle = (avgDistToBox < maxDim * 0.085) && (avgDistToBox < stdDev * 0.95) && (avgDistToBox < avgDistToEllipse * 0.92);

        if (!isBetterRectThanCircle && ellipseStd < 0.21) {
          if (aspect >= 0.76 && roundness < 0.22) {
            if (isCardPixel) {
              return {
                type: 'circle',
                center: { x: cx, y: cy },
                radius: avgR,
                aspect: aspect
              };
            }
            if (isBoard) {
              return {
                type: 'circle',
                center: this.screenToBoard(cx, cy),
                radius: avgR / bz,
                aspect: aspect
              };
            }
            const mCenter = this.screenToMath(cx, cy);
            const mEdge = this.screenToMath(cx + avgR, cy);
            return {
              type: 'circle',
              center: { x: mCenter.x, y: mCenter.y },
              radius: Math.abs(mEdge.x - mCenter.x),
              aspect: aspect
            };
          } else if (aspect >= 0.22) {
            if (isCardPixel) {
              return {
                type: 'ellipse',
                center: { x: cx, y: cy },
                rx: rx,
                ry: ry
              };
            }
            if (isBoard) {
              return {
                type: 'ellipse',
                center: this.screenToBoard(cx, cy),
                rx: rx / bz,
                ry: ry / bz
              };
            }
            const mCenter = this.screenToMath(cx, cy);
            const mEdgeX = this.screenToMath(cx + rx, cy);
            const mEdgeY = this.screenToMath(cx, cy + ry);
            return {
              type: 'ellipse',
              center: { x: mCenter.x, y: mCenter.y },
              rx: Math.abs(mEdgeX.x - mCenter.x),
              ry: Math.abs(mEdgeY.y - mCenter.y)
            };
          }
        }

        if (avgDistToBox < maxDim * 0.14) {
          if (isCardPixel) {
            return {
              type: 'rect',
              min: { x: minX, y: minY },
              max: { x: maxX, y: maxY },
              aspect: aspect
            };
          }
          if (isBoard) {
            return {
              type: 'rect',
              min: this.screenToBoard(minX, minY),
              max: this.screenToBoard(maxX, maxY),
              aspect: aspect
            };
          }
          const m1 = this.screenToMath(minX, minY);
          const m2 = this.screenToMath(maxX, maxY);
          return {
            type: 'rect',
            min: { x: Math.min(m1.x, m2.x), y: Math.min(m1.y, m2.y) },
            max: { x: Math.max(m1.x, m2.x), y: Math.max(m1.y, m2.y) }
          };
        }
      }

      return null;
    }

    _startInkHoldTimer() {
      if (this._inkHoldTimer) {
        clearTimeout(this._inkHoldTimer);
        this._inkHoldTimer = null;
      }
      if (!this.isDrawingInk || !this.currentInkStroke) return;

      const checkHold = () => {
        this._inkHoldTimer = null;
        if (!this.isDrawingInk || !this.currentInkStroke || this._inkHoldDetected) return;
        const idleMs = Date.now() - (this._lastSignificantMoveTime || 0);
        if (idleMs < 330) {
          this._inkHoldTimer = setTimeout(checkHold, Math.max(40, 340 - idleMs));
          return;
        }
        this._onInkHoldTriggered();
      };

      this._inkHoldTimer = setTimeout(checkHold, 340);
    }

    _onInkHoldTriggered() {
      if (!this.isDrawingInk || !this.currentInkStroke) return;
      let strokeForHold = this.currentInkStroke;
      if (this._pcMainStrokeFairer && typeof this._pcMainStrokeFairer.peekPendingTail === 'function') {
        const extraScreenPts = this._pcMainStrokeFairer.peekPendingTail(this._lastRawInkScreenPos);
        if (extraScreenPts.length > 0) {
          const isGraphTarget = (this.currentInkStroke.target !== 'board');
          const mergedPts = this.currentInkStroke.points.concat(
            extraScreenPts.map(sp => {
              const c = isGraphTarget ? this.screenToMath(sp.x, sp.y) : this.screenToBoard(sp.x, sp.y);
              return { x: c.x, y: c.y, p: sp.p, t: sp.t };
            })
          );
          strokeForHold = { ...this.currentInkStroke, points: mergedPts };
        }
      }
      const shape = this.recognizeInkShape(strokeForHold);
      if (shape) {
        if (strokeForHold !== this.currentInkStroke) {
          this.currentInkStroke.points = strokeForHold.points;
        }
        this._pcMainStrokeFairer = null;
        this._inkHoldDetected = true;
        this.currentInkStroke.shape = shape;
        this.currentInkStroke.isShape = true;
        if (this.isAudioRecording) {
          const recT = this.getAudioRecordElapsedMs();
          this.currentInkStroke.tEnd = recT;
          this.currentInkStroke.shapeSnapAt = recT;
        }
        this.render();
      }
    }

    _updateHeldShape(pos) {
      if (!this.currentInkStroke || !this.currentInkStroke.shape) return;
      const shape = this.currentInkStroke.shape;

      // 🌟 [대표님 지시]: 직선(line)은 홀드 후 펜을 움직여 길이/각도 조절 및 수평·수직·45° 마그네틱 스냅 지원!
      // (원, 타원, 사각형, 삼각형, 포물선, 삼차함수 등 나머지 도형은 그린 크기 그대로 고정!)
      if (shape.type !== 'line') return;

      const isBoard = (this.currentInkStroke.target || 'board') === 'board';
      const sStart = isBoard
        ? this.boardToScreen(shape.start.x, shape.start.y)
        : this.mathToScreen(shape.start.x, shape.start.y);

      let endX = pos.x;
      let endY = pos.y;

      const dx = endX - sStart.x;
      const dy = endY - sStart.y;
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      const absAngle = Math.abs(angleDeg);

      // 홀드 상태에서 직선을 돌릴 때 수평(0°, 180°), 수직(90°), 대각선(45°)에 마그네틱 자석 스냅! (자석 범위 슬림화: 1.5° / 1.2°)
      const snapAngleThresh = 1.5;
      const diagAngleThresh = 1.2;

      if (absAngle < snapAngleThresh || absAngle > (180 - snapAngleThresh)) {
        endY = sStart.y;
        shape.snapped = 'horizontal';
      } else if (Math.abs(absAngle - 90) < snapAngleThresh) {
        endX = sStart.x;
        shape.snapped = 'vertical';
      } else if (Math.abs(absAngle - 45) < diagAngleThresh || Math.abs(absAngle - 135) < diagAngleThresh) {
        const dist = Math.hypot(dx, dy);
        const signX = dx >= 0 ? 1 : -1;
        const signY = dy >= 0 ? 1 : -1;
        endX = sStart.x + signX * dist * Math.SQRT1_2;
        endY = sStart.y + signY * dist * Math.SQRT1_2;
        shape.snapped = 'diagonal';
      } else {
        shape.snapped = null;
      }

      if (isBoard) {
        shape.end = this.screenToBoard(endX, endY);
      } else {
        const mEnd = this.screenToMath(endX, endY);
        shape.end = { x: mEnd.x, y: mEnd.y };
      }
    }

    // 🌟 [문제 카드 & 그래프 보관 카드 통합 Draw & Hold 도형 자동 인식 엔진] 🌟
    _buildNormalizedPointsFromCardShape(cardShape, tStart, tEnd) {
      if (!cardShape) return [];
      const ts = (typeof tStart === 'number') ? tStart : undefined;
      const te = (typeof tEnd === 'number') ? tEnd : ts;
      const makeTime = (u) => (ts !== undefined && te !== undefined) ? Math.round(ts + (te - ts) * u) : undefined;
      const out = [];

      if (cardShape.type === 'line' && cardShape.start && cardShape.end) {
        const steps = 24;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          out.push({
            nx: cardShape.start.nx + (cardShape.end.nx - cardShape.start.nx) * u,
            ny: cardShape.start.ny + (cardShape.end.ny - cardShape.start.ny) * u,
            p: 0.55,
            t: makeTime(u)
          });
        }
        return out;
      }
      if ((cardShape.type === 'circle' || cardShape.type === 'ellipse') && cardShape.center) {
        const steps = 48;
        const rx = cardShape.rx || 0.05;
        const ry = cardShape.ry || rx;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const ang = u * Math.PI * 2;
          out.push({
            nx: cardShape.center.nx + Math.cos(ang) * rx,
            ny: cardShape.center.ny + Math.sin(ang) * ry,
            p: 0.55,
            t: makeTime(u)
          });
        }
        return out;
      }
      if (cardShape.type === 'rect' && cardShape.min && cardShape.max) {
        const corners = [
          { nx: cardShape.min.nx, ny: cardShape.min.ny },
          { nx: cardShape.max.nx, ny: cardShape.min.ny },
          { nx: cardShape.max.nx, ny: cardShape.max.ny },
          { nx: cardShape.min.nx, ny: cardShape.max.ny },
          { nx: cardShape.min.nx, ny: cardShape.min.ny }
        ];
        const segSteps = 10;
        const totalSteps = 4 * segSteps;
        for (let s = 0; s < 4; s++) {
          const cA = corners[s];
          const cB = corners[s + 1];
          for (let k = 0; k < segSteps; k++) {
            const uSeg = k / segSteps;
            const uAll = (s * segSteps + k) / totalSteps;
            out.push({
              nx: cA.nx + (cB.nx - cA.nx) * uSeg,
              ny: cA.ny + (cB.ny - cA.ny) * uSeg,
              p: 0.55,
              t: makeTime(uAll)
            });
          }
        }
        out.push({ nx: corners[4].nx, ny: corners[4].ny, p: 0.55, t: makeTime(1) });
        return out;
      }
      if (Array.isArray(cardShape.pts) && cardShape.pts.length >= 2) {
        const vertices = cardShape.closed ? [...cardShape.pts, cardShape.pts[0]] : cardShape.pts;
        if (cardShape.closed && vertices.length <= 5) {
          const segCount = vertices.length - 1;
          const segSteps = 12;
          const total = segCount * segSteps;
          for (let s = 0; s < segCount; s++) {
            const pA = vertices[s];
            const pB = vertices[s + 1];
            for (let k = 0; k < segSteps; k++) {
              const uSeg = k / segSteps;
              const uAll = (s * segSteps + k) / total;
              out.push({
                nx: pA.nx + (pB.nx - pA.nx) * uSeg,
                ny: pA.ny + (pB.ny - pA.ny) * uSeg,
                p: 0.55,
                t: makeTime(uAll)
              });
            }
          }
          const lastV = vertices[vertices.length - 1];
          out.push({ nx: lastV.nx, ny: lastV.ny, p: 0.55, t: makeTime(1) });
          return out;
        }
        const len = vertices.length;
        for (let i = 0; i < len; i++) {
          const u = len > 1 ? (i / (len - 1)) : 1;
          out.push({
            nx: vertices[i].nx,
            ny: vertices[i].ny,
            p: 0.55,
            t: makeTime(u)
          });
        }
        return out;
      }
      return out;
    }

    recognizeAndApplyCardStrokeShape(cardStroke, cardW, cardH) {
      if (!cardStroke || !Array.isArray(cardStroke.points)) return false;
      const w = Math.max(1, cardW || 480);
      const h = Math.max(1, cardH || 360);
      let ptsForHold = cardStroke.points.map(pt => ({ x: pt.nx * w, y: pt.ny * h }));
      if (cardStroke._pcFairer && typeof cardStroke._pcFairer.peekPendingTail === 'function') {
        const extra = cardStroke._pcFairer.peekPendingTail(cardStroke._lastRawPx);
        if (extra.length > 0) {
          ptsForHold = ptsForHold.concat(extra.map(sp => ({ x: sp.x, y: sp.y })));
        }
      }
      if (ptsForHold.length < 4) return false;
      const pixelStroke = {
        _isCardPixelSpace: true,
        isHighlighter: Boolean(cardStroke.isHighlighter),
        points: ptsForHold
      };
      const shape = this.recognizeInkShape(pixelStroke);
      if (!shape) return false;
      cardStroke._pcFairer = null;

      let cardShape = null;
      if (shape.type === 'line' && shape.start && shape.end) {
        cardShape = {
          type: 'line',
          start: { nx: shape.start.x / w, ny: shape.start.y / h },
          end: { nx: shape.end.x / w, ny: shape.end.y / h },
          snapped: shape.snapped || null
        };
      } else if (shape.type === 'circle' && shape.center) {
        cardShape = {
          type: 'circle',
          center: { nx: shape.center.x / w, ny: shape.center.y / h },
          rx: shape.radius / w,
          ry: shape.radius / h
        };
      } else if (shape.type === 'ellipse' && shape.center) {
        cardShape = {
          type: 'ellipse',
          center: { nx: shape.center.x / w, ny: shape.center.y / h },
          rx: shape.rx / w,
          ry: shape.ry / h
        };
      } else if (shape.type === 'rect' && shape.min && shape.max) {
        cardShape = {
          type: 'rect',
          min: { nx: Math.min(shape.min.x, shape.max.x) / w, ny: Math.min(shape.min.y, shape.max.y) / h },
          max: { nx: Math.max(shape.min.x, shape.max.x) / w, ny: Math.max(shape.min.y, shape.max.y) / h }
        };
      } else if (Array.isArray(shape.pts) && shape.pts.length >= 2) {
        cardShape = {
          type: shape.type,
          closed: Boolean(shape.closed),
          pts: shape.pts.map(p => ({ nx: p.x / w, ny: p.y / h }))
        };
      }
      if (!cardShape) return false;

      const recT = this.isAudioRecording
        ? this.getAudioRecordElapsedMs()
        : (cardStroke.tEnd !== undefined ? cardStroke.tEnd : cardStroke.tStart);
      if (recT !== undefined) {
        cardStroke.tEnd = recT;
        cardStroke.shapeSnapAt = recT;
      }
      cardStroke._shapeHoldDetected = true;
      cardStroke.isShape = true;
      cardStroke.cardShape = cardShape;
      cardStroke.points = this._buildNormalizedPointsFromCardShape(cardShape, cardStroke.tStart, recT);
      return true;
    }

    updateHeldCardStrokeShape(cardStroke, nx, ny, cardW, cardH) {
      if (!cardStroke || !cardStroke.cardShape || cardStroke.cardShape.type !== 'line') return false;
      const w = Math.max(1, cardW || 480);
      const h = Math.max(1, cardH || 360);
      const sh = cardStroke.cardShape;
      const sStartX = sh.start.nx * w;
      const sStartY = sh.start.ny * h;
      let endX = nx * w;
      let endY = ny * h;

      const dx = endX - sStartX;
      const dy = endY - sStartY;
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      const absAngle = Math.abs(angleDeg);

      const snapAngleThresh = 1.8;
      const diagAngleThresh = 1.2;

      if (absAngle < snapAngleThresh || absAngle > (180 - snapAngleThresh)) {
        endY = sStartY;
        sh.snapped = 'horizontal';
      } else if (Math.abs(absAngle - 90) < snapAngleThresh) {
        endX = sStartX;
        sh.snapped = 'vertical';
      } else if (Math.abs(absAngle - 45) < diagAngleThresh || Math.abs(absAngle - 135) < diagAngleThresh) {
        const dist = Math.hypot(dx, dy);
        const signX = dx >= 0 ? 1 : -1;
        const signY = dy >= 0 ? 1 : -1;
        endX = sStartX + signX * dist * Math.SQRT1_2;
        endY = sStartY + signY * dist * Math.SQRT1_2;
        sh.snapped = 'diagonal';
      } else {
        sh.snapped = null;
      }

      sh.end = {
        nx: Math.max(0, Math.min(1, endX / w)),
        ny: Math.max(0, Math.min(1, endY / h))
      };
      const recT = this.isAudioRecording
        ? this.getAudioRecordElapsedMs()
        : (cardStroke.tEnd !== undefined ? cardStroke.tEnd : cardStroke.tStart);
      if (recT !== undefined) {
        cardStroke.tEnd = recT;
      }
      cardStroke.points = this._buildNormalizedPointsFromCardShape(sh, cardStroke.tStart, recT);
      return true;
    }

    drawCardRecognizedShape(ctx, stroke, ox, oy, w, h, baseSize) {
      if (!ctx || !stroke || !stroke.isShape || !stroke.cardShape) return false;
      const sh = stroke.cardShape;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (!stroke.isHighlighter) {
        ctx.lineWidth = Math.max(1.4, baseSize * 0.96);
      }
      if (sh.type === 'line' && sh.start && sh.end) {
        ctx.beginPath();
        ctx.moveTo(ox + sh.start.nx * w, oy + sh.start.ny * h);
        ctx.lineTo(ox + sh.end.nx * w, oy + sh.end.ny * h);
        ctx.stroke();
        return true;
      }
      if ((sh.type === 'circle' || sh.type === 'ellipse') && sh.center) {
        const cx = ox + sh.center.nx * w;
        const cy = oy + sh.center.ny * h;
        const rx = Math.max(2, Math.abs((sh.rx || 0) * w));
        const ry = Math.max(2, Math.abs((sh.ry || sh.rx || 0) * h));
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        return true;
      }
      if (sh.type === 'rect' && sh.min && sh.max) {
        const x1 = ox + sh.min.nx * w;
        const y1 = oy + sh.min.ny * h;
        const x2 = ox + sh.max.nx * w;
        const y2 = oy + sh.max.ny * h;
        ctx.beginPath();
        ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        ctx.stroke();
        return true;
      }
      if (Array.isArray(sh.pts) && sh.pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(ox + sh.pts[0].nx * w, oy + sh.pts[0].ny * h);
        for (let i = 1; i < sh.pts.length; i++) {
          ctx.lineTo(ox + sh.pts[i].nx * w, oy + sh.pts[i].ny * h);
        }
        if (sh.closed) ctx.closePath();
        ctx.stroke();
        return true;
      }
      return false;
    }

    // 🌟 [굿노트/삼성노트 표준] 올가미(Lasso) 핵심 연산 및 점선 추종 렌더러 🌟
    isPointInLassoSelection(pos) {
      const hasSelection = (this.selectedInkStrokes && this.selectedInkStrokes.length > 0) ||
        (this.selectedTextLabels && this.selectedTextLabels.length > 0);
      if (!hasSelection) return false;

      // 1. 점선 루프가 있으면 무조건 실제 점선 루프 내부 판정을 최우선 적용!
      if (this.lassoPoints && this.lassoPoints.length >= 3) {
        if (this.isPointInPolygon(pos, this.lassoPoints)) {
          return true;
        }
        // 사용자가 선택된 획/도형 위를 콕 찍었는지도 검사 (획/도형 접촉 시 드래그 허용)
        const bPx = (this.boardPanX || 0);
        const bPy = (this.boardPanY || 0);
        for (const stroke of this.selectedInkStrokes) {
          if (stroke.shape) {
            const shapePts = this.getShapeSampleScreenPoints(stroke);
            for (const s of shapePts) {
              if (Math.hypot(s.x - pos.x, s.y - pos.y) <= 16) {
                return true;
              }
            }
          }
          if (!stroke.points) continue;
          const isBoard = (stroke.target || 'board') === 'board';
          for (const pt of stroke.points) {
            const s = isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y);
            if (Math.hypot(s.x - pos.x, s.y - pos.y) <= 14) {
              return true;
            }
          }
        }
        return false; // 점선 루프 밖이고 획 위도 아니면 100% 바깥 터치 (즉시 해제 대상)!
      }

      // 2. 점선 루프가 없고 바운딩 박스만 존재하는 경우의 폴백
      if (this.lassoBoundingBox) {
        const pad = 8;
        const bbox = this.lassoBoundingBox;
        return (pos.x >= bbox.minX - pad && pos.x <= bbox.maxX + pad &&
          pos.y >= bbox.minY - pad && pos.y <= bbox.maxY + pad);
      }

      return false;
    }

    calculateStrokesBoundingBox(strokes, texts = []) {
      const hasStrokes = strokes && strokes.length > 0;
      const hasTexts = texts && texts.length > 0;
      if (!hasStrokes && !hasTexts) return null;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      const bz = this.boardZoom || 1.0;

      if (hasStrokes) {
        strokes.forEach(stroke => {
          const isBoard = (stroke.target || 'board') === 'board';
          if (stroke.shape) {
            if (stroke.shape.type === 'line') {
              const s1 = isBoard ? this.boardToScreen(stroke.shape.start.x, stroke.shape.start.y) : this.mathToScreen(stroke.shape.start.x, stroke.shape.start.y);
              const s2 = isBoard ? this.boardToScreen(stroke.shape.end.x, stroke.shape.end.y) : this.mathToScreen(stroke.shape.end.x, stroke.shape.end.y);
              minX = Math.min(minX, s1.x, s2.x); maxX = Math.max(maxX, s1.x, s2.x);
              minY = Math.min(minY, s1.y, s2.y); maxY = Math.max(maxY, s1.y, s2.y);
            } else if (stroke.shape.type === 'circle') {
              const sc = isBoard ? this.boardToScreen(stroke.shape.center.x, stroke.shape.center.y) : this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y);
              const sr = isBoard ? (stroke.shape.radius * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x + stroke.shape.radius, stroke.shape.center.y).x - sc.x);
              minX = Math.min(minX, sc.x - sr); maxX = Math.max(maxX, sc.x + sr);
              minY = Math.min(minY, sc.y - sr); maxY = Math.max(maxY, sc.y + sr);
            } else if (stroke.shape.type === 'ellipse') {
              const sc = isBoard ? this.boardToScreen(stroke.shape.center.x, stroke.shape.center.y) : this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y);
              const srx = isBoard ? (stroke.shape.rx * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x + stroke.shape.rx, stroke.shape.center.y).x - sc.x);
              const sry = isBoard ? (stroke.shape.ry * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y + stroke.shape.ry).y - sc.y);
              minX = Math.min(minX, sc.x - srx); maxX = Math.max(maxX, sc.x + srx);
              minY = Math.min(minY, sc.y - sry); maxY = Math.max(maxY, sc.y + sry);
            } else if (stroke.shape.type === 'rect') {
              const s1 = isBoard ? this.boardToScreen(stroke.shape.min.x, stroke.shape.min.y) : this.mathToScreen(stroke.shape.min.x, stroke.shape.min.y);
              const s2 = isBoard ? this.boardToScreen(stroke.shape.max.x, stroke.shape.max.y) : this.mathToScreen(stroke.shape.max.x, stroke.shape.max.y);
              minX = Math.min(minX, s1.x, s2.x); maxX = Math.max(maxX, s1.x, s2.x);
              minY = Math.min(minY, s1.y, s2.y); maxY = Math.max(maxY, s1.y, s2.y);
            } else if (stroke.shape.pts && stroke.shape.pts.length > 0) {
              stroke.shape.pts.forEach(pt => {
                const s = isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y);
                if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x;
                if (s.y < minY) minY = s.y; if (s.y > maxY) maxY = s.y;
              });
            }
          } else if (stroke.points) {
            stroke.points.forEach(pt => {
              const s = isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y);
              if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x;
              if (s.y < minY) minY = s.y; if (s.y > maxY) maxY = s.y;
            });
          }
        });
      }

      if (hasTexts) {
        texts.forEach(t => {
          const s = this.mathToScreen(t.mathX, t.mathY);
          minX = Math.min(minX, s.x - 20); maxX = Math.max(maxX, s.x + 60);
          minY = Math.min(minY, s.y - 20); maxY = Math.max(maxY, s.y + 20);
        });
      }

      if (minX === Infinity || !isFinite(minX)) return null;

      return {
        minX,
        maxX,
        minY,
        maxY,
        width: Math.max(10, maxX - minX),
        height: Math.max(10, maxY - minY)
      };
    }

    isPointInPolygon(pt, polygon) {
      if (!pt || !polygon || polygon.length < 3) return false;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
          (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    getShapeSampleScreenPoints(stroke) {
      if (!stroke || !stroke.shape) return [];
      const sh = stroke.shape;
      const isBoard = (stroke.target || 'board') === 'board';
      const bz = this.boardZoom || 1.0;
      const pts = [];

      if (sh.type === 'line' && sh.start && sh.end) {
        const s1 = isBoard ? this.boardToScreen(sh.start.x, sh.start.y) : this.mathToScreen(sh.start.x, sh.start.y);
        const s2 = isBoard ? this.boardToScreen(sh.end.x, sh.end.y) : this.mathToScreen(sh.end.x, sh.end.y);
        const steps = 16;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          pts.push({ x: s1.x + (s2.x - s1.x) * t, y: s1.y + (s2.y - s1.y) * t });
        }
      } else if (sh.type === 'circle' && sh.center) {
        const sc = isBoard ? this.boardToScreen(sh.center.x, sh.center.y) : this.mathToScreen(sh.center.x, sh.center.y);
        const sr = isBoard ? (sh.radius * bz) : Math.abs(this.mathToScreen(sh.center.x + sh.radius, sh.center.y).x - sc.x);
        pts.push(sc);
        const steps = 24;
        for (let k = 0; k < steps; k++) {
          const ang = (k / steps) * Math.PI * 2;
          pts.push({ x: sc.x + sr * Math.cos(ang), y: sc.y + sr * Math.sin(ang) });
        }
      } else if (sh.type === 'ellipse' && sh.center) {
        const sc = isBoard ? this.boardToScreen(sh.center.x, sh.center.y) : this.mathToScreen(sh.center.x, sh.center.y);
        const srx = isBoard ? (sh.rx * bz) : Math.abs(this.mathToScreen(sh.center.x + sh.rx, sh.center.y).x - sc.x);
        const sry = isBoard ? (sh.ry * bz) : Math.abs(this.mathToScreen(sh.center.x, sh.center.y + sh.ry).y - sc.y);
        pts.push(sc);
        const steps = 24;
        for (let k = 0; k < steps; k++) {
          const ang = (k / steps) * Math.PI * 2;
          pts.push({ x: sc.x + srx * Math.cos(ang), y: sc.y + sry * Math.sin(ang) });
        }
      } else if (sh.type === 'rect' && sh.min && sh.max) {
        const s1 = isBoard ? this.boardToScreen(sh.min.x, sh.min.y) : this.mathToScreen(sh.min.x, sh.min.y);
        const s2 = isBoard ? this.boardToScreen(sh.max.x, sh.max.y) : this.mathToScreen(sh.max.x, sh.max.y);
        const x1 = Math.min(s1.x, s2.x);
        const x2 = Math.max(s1.x, s2.x);
        const y1 = Math.min(s1.y, s2.y);
        const y2 = Math.max(s1.y, s2.y);
        // 중심점 + 네 꼭짓점(좌상, 우상, 우하, 좌하) + 4변 테두리 촘촘 샘플링
        pts.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 });
        const edgeSteps = 10;
        for (let k = 0; k <= edgeSteps; k++) {
          const t = k / edgeSteps;
          const x = x1 + (x2 - x1) * t;
          const y = y1 + (y2 - y1) * t;
          pts.push({ x, y: y1 }); // 상단 변 (좌상 ~ 우상)
          pts.push({ x, y: y2 }); // 하단 변 (좌하 ~ 우하)
          pts.push({ x: x1, y }); // 좌측 변 (좌상 ~ 좌하)
          pts.push({ x: x2, y }); // 우측 변 (우상 ~ 우하)
        }
      } else if (sh.pts && sh.pts.length > 0) {
        const sPts = sh.pts.map(pt => isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y));
        let cx = 0, cy = 0;
        sPts.forEach(p => {
          pts.push(p);
          cx += p.x;
          cy += p.y;
        });
        pts.push({ x: cx / sPts.length, y: cy / sPts.length });
        // 삼각형 등 꼭짓점 개수가 적은 다각형은 각 변 위에도 샘플점 추가
        if (sPts.length <= 8) {
          const segSteps = 8;
          const count = sh.closed ? sPts.length : (sPts.length - 1);
          for (let i = 0; i < count; i++) {
            const a = sPts[i];
            const b = sPts[(i + 1) % sPts.length];
            for (let k = 1; k < segSteps; k++) {
              const t = k / segSteps;
              pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            }
          }
        }
      }
      return pts;
    }

    isStrokeInLasso(stroke, lassoPoly) {
      if (!stroke || !lassoPoly || lassoPoly.length < 3) return false;
      const isBoard = (stroke.target || 'board') === 'board';
      if (this.isGraphCovered && !this.pdfPageBoardData && !isBoard) return false;
      if (!this.isGraphCovered && isBoard) return false;
      if (!isBoard && Boolean(stroke.onPdfBoard) !== Boolean(this.pdfPageBoardData)) return false;
      const bPx = (this.boardPanX || 0);
      const bPy = (this.boardPanY || 0);

      // 1. 도형인 경우: 네 꼭짓점(좌상·우상·우하·좌하), 테두리 둘레 샘플점, 중심점 전수 검사!
      if (stroke.shape) {
        const samplePts = this.getShapeSampleScreenPoints(stroke);
        for (let i = 0; i < samplePts.length; i++) {
          if (this.isPointInPolygon(samplePts[i], lassoPoly)) {
            return true;
          }
        }
        return false;
      }

      if (!stroke.points || stroke.points.length === 0) return false;

      // 2. 일반 손글씨 획: 대표 점(시작, 중간, 끝) 및 샘플 점 포함 여부 검사
      const totalPts = stroke.points.length;
      const step = Math.max(1, Math.floor(totalPts / 12));
      let insideCount = 0;
      let samples = 0;

      for (let i = 0; i < totalPts; i += step) {
        samples++;
        const s = isBoard ? this.boardToScreen(stroke.points[i].x, stroke.points[i].y) : this.mathToScreen(stroke.points[i].x, stroke.points[i].y);
        if (this.isPointInPolygon(s, lassoPoly)) {
          insideCount++;
        }
      }

      const sStart = isBoard ? this.boardToScreen(stroke.points[0].x, stroke.points[0].y) : this.mathToScreen(stroke.points[0].x, stroke.points[0].y);
      const sEnd = isBoard ? this.boardToScreen(stroke.points[totalPts - 1].x, stroke.points[totalPts - 1].y) : this.mathToScreen(stroke.points[totalPts - 1].x, stroke.points[totalPts - 1].y);
      const midIdx = Math.floor(totalPts / 2);
      const sMid = isBoard ? this.boardToScreen(stroke.points[midIdx].x, stroke.points[midIdx].y) : this.mathToScreen(stroke.points[midIdx].x, stroke.points[midIdx].y);

      if (this.isPointInPolygon(sStart, lassoPoly) || this.isPointInPolygon(sEnd, lassoPoly) || this.isPointInPolygon(sMid, lassoPoly)) {
        return true;
      }

      return (insideCount > 0 && (insideCount / samples >= 0.10));
    }

    initLassoActionBar() {
      const bar = document.getElementById('lassoActionFloatingBar');
      if (!bar) return;

      bar.querySelectorAll('.lasso-color-dot').forEach(dot => {
        dot.onclick = (e) => {
          e.stopPropagation();
          const color = e.currentTarget.dataset.color;
          if (color) this.changeSelectedLassoColor(color);
        };
      });

      const btnDup = document.getElementById('btnLassoDuplicate');
      if (btnDup) {
        btnDup.onclick = (e) => {
          e.stopPropagation();
          this.duplicateSelectedLassoStrokes();
        };
      }

      const btnDel = document.getElementById('btnLassoDelete');
      if (btnDel) {
        btnDel.onclick = (e) => {
          e.stopPropagation();
          this.deleteSelectedInkStrokes();
        };
      }
    }

    clearCardLassoSelection(skipRender = false) {
      const prev = this._activeCardLasso;
      this._activeCardLasso = null;
      if (prev && !skipRender && typeof prev.renderFn === 'function') {
        prev.renderFn();
      }
      this.syncLassoActionBarUI();
    }

    computeCardStrokesNormBBox(strokes) {
      if (!Array.isArray(strokes) || strokes.length === 0) return null;
      let minNx = Infinity, maxNx = -Infinity, minNy = Infinity, maxNy = -Infinity;
      const addPt = (nx, ny) => {
        if (typeof nx !== 'number' || typeof ny !== 'number' || isNaN(nx) || isNaN(ny)) return;
        if (nx < minNx) minNx = nx;
        if (nx > maxNx) maxNx = nx;
        if (ny < minNy) minNy = ny;
        if (ny > maxNy) maxNy = ny;
      };
      strokes.forEach(st => {
        if (!st) return;
        if (st.isShape && st.cardShape) {
          const sh = st.cardShape;
          if (sh.start && sh.end) {
            addPt(sh.start.nx, sh.start.ny);
            addPt(sh.end.nx, sh.end.ny);
          } else if (sh.center) {
            const rx = Math.abs(sh.rx || 0);
            const ry = Math.abs(sh.ry || sh.rx || 0);
            addPt(sh.center.nx - rx, sh.center.ny - ry);
            addPt(sh.center.nx + rx, sh.center.ny + ry);
          } else if (sh.min && sh.max) {
            addPt(sh.min.nx, sh.min.ny);
            addPt(sh.max.nx, sh.max.ny);
          } else if (Array.isArray(sh.pts)) {
            sh.pts.forEach(p => p && addPt(p.nx, p.ny));
          }
        }
        if (Array.isArray(st.points)) {
          st.points.forEach(pt => pt && addPt(pt.nx, pt.ny));
        }
      });
      if (!isFinite(minNx) || !isFinite(minNy)) return null;
      return { minNx, maxNx, minNy, maxNy };
    }

    translateCardStrokeNorm(st, dnx, dny) {
      if (!st) return;
      if (Array.isArray(st.points)) {
        st.points.forEach(pt => {
          if (!pt) return;
          pt.nx = (pt.nx || 0) + dnx;
          pt.ny = (pt.ny || 0) + dny;
          delete pt.mx;
          delete pt.my;
        });
      }
      if (st.isShape && st.cardShape) {
        const sh = st.cardShape;
        if (sh.start) { sh.start.nx += dnx; sh.start.ny += dny; delete sh.start.mx; delete sh.start.my; }
        if (sh.end) { sh.end.nx += dnx; sh.end.ny += dny; delete sh.end.mx; delete sh.end.my; }
        if (sh.center) { sh.center.nx += dnx; sh.center.ny += dny; delete sh.center.mx; delete sh.center.my; }
        if (sh.min) { sh.min.nx += dnx; sh.min.ny += dny; delete sh.min.mx; delete sh.min.my; }
        if (sh.max) { sh.max.nx += dnx; sh.max.ny += dny; delete sh.max.mx; delete sh.max.my; }
        if (Array.isArray(sh.pts)) {
          sh.pts.forEach(p => {
            if (!p) return;
            p.nx += dnx;
            p.ny += dny;
            delete p.mx;
            delete p.my;
          });
        }
        if (typeof sh.x1 === 'number') {
          sh.x1 += dnx; sh.y1 += dny;
          sh.x2 += dnx; sh.y2 += dny;
          delete sh.mx1; delete sh.my1; delete sh.mx2; delete sh.my2;
        }
      }
    }

    drawCardLassoOverlay(ctx, w, h, cardWidgetEl) {
      const cl = this._activeCardLasso;
      if (!cl || cl.widgetEl !== cardWidgetEl || this.activeInkTool !== 'lasso') return;

      if (cl.isSelecting && Array.isArray(cl.lassoPts) && cl.lassoPts.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cl.lassoPts[0].nx * w, cl.lassoPts[0].ny * h);
        for (let i = 1; i < cl.lassoPts.length; i++) {
          ctx.lineTo(cl.lassoPts[i].nx * w, cl.lassoPts[i].ny * h);
        }
        ctx.strokeStyle = '#00d2d3';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 5]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      const hasSel = Array.isArray(cl.selectedStrokes) && cl.selectedStrokes.length > 0;
      if (hasSel && !cl.bboxNorm) {
        cl.bboxNorm = this.computeCardStrokesNormBBox(cl.selectedStrokes);
      }

      if (hasSel && Array.isArray(cl.lassoPts) && cl.lassoPts.length >= 3) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cl.lassoPts[0].nx * w, cl.lassoPts[0].ny * h);
        for (let i = 1; i < cl.lassoPts.length; i++) {
          ctx.lineTo(cl.lassoPts[i].nx * w, cl.lassoPts[i].ny * h);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 210, 211, 0.045)';
        ctx.fill();
        ctx.strokeStyle = '#00d2d3';
        ctx.lineWidth = 1.9;
        ctx.setLineDash([7, 5]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      if (hasSel && cl.bboxNorm) {
        const pad = 8;
        const x1 = cl.bboxNorm.minNx * w - pad;
        const y1 = cl.bboxNorm.minNy * h - pad;
        const x2 = cl.bboxNorm.maxNx * w + pad;
        const y2 = cl.bboxNorm.maxNy * h + pad;

        ctx.save();
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.55)';
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        ctx.setLineDash([]);
        const corners = [
          { x: x1, y: y1, r: 5.0 },
          { x: x2, y: y1, r: 5.0 },
          { x: x1, y: y2, r: 5.0 },
          { x: x2, y: y2, r: 6.5, isMain: true }
        ];
        corners.forEach(c => {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.fillStyle = c.isMain ? '#0284c7' : '#ffffff';
          ctx.fill();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = c.isMain ? '#ffffff' : '#0284c7';
          ctx.stroke();
        });
        ctx.restore();
      }

      this.syncLassoActionBarUI();
    }

    syncLassoActionBarUI() {
      const bar = document.getElementById('lassoActionFloatingBar');
      if (!bar) return;

      const cl = this._activeCardLasso;
      const hasCardSelection = Boolean(
        cl &&
        cl.widgetEl &&
        cl.widgetEl.style.display !== 'none' &&
        Array.isArray(cl.selectedStrokes) &&
        cl.selectedStrokes.length > 0 &&
        cl.bboxNorm
      );

      if (hasCardSelection && this.isInkMode && this.activeInkTool === 'lasso') {
        if (cl.isSelecting || cl.isDragging || cl.isResizing) {
          bar.style.display = 'none';
          return;
        }
        const bodyEl = cl.widgetEl.querySelector('.problem-card-body') || cl.widgetEl;
        const rect = bodyEl.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          const minX = rect.left + cl.bboxNorm.minNx * rect.width;
          const maxX = rect.left + cl.bboxNorm.maxNx * rect.width;
          const minY = rect.top + cl.bboxNorm.minNy * rect.height;
          const maxY = rect.top + cl.bboxNorm.maxNy * rect.height;
          const pad = 10;
          bar.style.display = 'flex';
          const screenW = this.screenWidth || window.innerWidth || 1280;
          const barW = Math.max(264, bar.offsetWidth || 276);
          const minLeft = 64;
          const maxLeft = Math.max(minLeft, screenW - barW - 64);
          const idealLeft = ((minX + maxX) / 2) - (barW / 2);
          const clampedLeft = Math.max(minLeft, Math.min(maxLeft, idealLeft));
          const topEdge = minY - pad;
          const bottomEdge = maxY + pad;

          bar.style.left = `${Math.round(clampedLeft)}px`;
          if (topEdge >= 64) {
            bar.style.top = `${Math.round(topEdge - 10)}px`;
            bar.style.transform = 'translate(0, -100%)';
          } else {
            bar.style.top = `${Math.round(bottomEdge + 10)}px`;
            bar.style.transform = 'translate(0, 0)';
          }
          return;
        }
      }

      const hasSelection = (this.selectedInkStrokes && this.selectedInkStrokes.length > 0) ||
        (this.selectedTextLabels && this.selectedTextLabels.length > 0);

      if (
        !this.isInkMode ||
        this.activeInkTool !== 'lasso' ||
        !hasSelection ||
        !this.lassoBoundingBox ||
        this.isLassoSelecting ||
        this.isDraggingLassoSelection ||
        this.isResizingLassoSelection
      ) {
        bar.style.display = 'none';
        return;
      }

      const bbox = this.lassoBoundingBox;
      const pad = 10;
      bar.style.display = 'flex';
      const screenW = this.screenWidth || window.innerWidth || 1280;
      const barW = Math.max(264, bar.offsetWidth || 276);
      const minLeft = 64;
      const maxLeft = Math.max(minLeft, screenW - barW - 64);
      const idealLeft = ((bbox.minX + bbox.maxX) / 2) - (barW / 2);
      const clampedLeft = Math.max(minLeft, Math.min(maxLeft, idealLeft));
      const topEdge = bbox.minY - pad;
      const bottomEdge = bbox.maxY + pad;

      bar.style.left = `${Math.round(clampedLeft)}px`;
      if (topEdge >= 64) {
        bar.style.top = `${Math.round(topEdge - 10)}px`;
        bar.style.transform = 'translate(0, -100%)';
      } else {
        bar.style.top = `${Math.round(bottomEdge + 10)}px`;
        bar.style.transform = 'translate(0, 0)';
      }
    }

    changeSelectedLassoColor(color) {
      const cl = this._activeCardLasso;
      if (cl && Array.isArray(cl.selectedStrokes) && cl.selectedStrokes.length > 0) {
        cl.selectedStrokes.forEach(s => {
          if (s) s.color = color;
        });
        if (typeof cl.renderFn === 'function') cl.renderFn();
        return;
      }

      const hasStrokes = this.selectedInkStrokes && this.selectedInkStrokes.length > 0;
      const hasTexts = this.selectedTextLabels && this.selectedTextLabels.length > 0;
      if (!hasStrokes && !hasTexts) return;

      this.pushHistoryState();
      if (hasStrokes) {
        this.selectedInkStrokes.forEach(s => {
          s.color = color;
        });
      }
      if (hasTexts) {
        this.selectedTextLabels.forEach(t => {
          t.color = color;
        });
      }
      this._inkBakeDirty = true;
      this.render();
    }

    duplicateSelectedLassoStrokes() {
      const cl = this._activeCardLasso;
      if (cl && Array.isArray(cl.selectedStrokes) && cl.selectedStrokes.length > 0 && typeof cl.getStrokes === 'function') {
        const arr = cl.getStrokes();
        const dnx = 0.045;
        const dny = 0.045;
        const newClones = [];
        cl.selectedStrokes.forEach(orig => {
          const clone = JSON.parse(JSON.stringify(orig));
          this.translateCardStrokeNorm(clone, dnx, dny);
          arr.push(clone);
          newClones.push(clone);
        });
        if (cl.widgetEl && cl.widgetEl.classList.contains('graph-card-widget') && typeof this._ensurePipCardInkMathCoordsByWidget === 'function') {
          this._ensurePipCardInkMathCoordsByWidget(cl.widgetEl, true);
        }
        cl.selectedStrokes = newClones;
        if (Array.isArray(cl.lassoPts)) {
          cl.lassoPts = cl.lassoPts.map(p => ({ nx: p.nx + dnx, ny: p.ny + dny }));
        }
        cl.bboxNorm = this.computeCardStrokesNormBBox(newClones);
        if (typeof cl.renderFn === 'function') cl.renderFn();
        this.syncLassoActionBarUI();
        return;
      }

      const hasStrokes = this.selectedInkStrokes && this.selectedInkStrokes.length > 0;
      const hasTexts = this.selectedTextLabels && this.selectedTextLabels.length > 0;
      if (!hasStrokes && !hasTexts) return;

      this.pushHistoryState();
      const offsetPx = 28;
      const bz = this.boardZoom || 1.0;
      const dBoardX = offsetPx / bz;
      const dBoardY = offsetPx / bz;
      const m0 = this.screenToMath(0, 0);
      const m1 = this.screenToMath(offsetPx, offsetPx);
      const dMathX = m1.x - m0.x;
      const dMathY = m1.y - m0.y;

      const newStrokes = [];
      if (hasStrokes) {
        this.selectedInkStrokes.forEach(orig => {
          const clone = JSON.parse(JSON.stringify(orig));
          clone.id = 'ink_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const isBoard = (clone.target || 'board') === 'board';
          const dx = isBoard ? dBoardX : dMathX;
          const dy = isBoard ? dBoardY : dMathY;

          if (clone.points) {
            clone.points.forEach(pt => {
              pt.x += dx;
              pt.y += dy;
            });
          }
          if (clone.shape) {
            if (clone.shape.type === 'line') {
              clone.shape.start.x += dx; clone.shape.start.y += dy;
              clone.shape.end.x += dx; clone.shape.end.y += dy;
            } else if (clone.shape.type === 'circle' || clone.shape.type === 'ellipse') {
              clone.shape.center.x += dx; clone.shape.center.y += dy;
            } else if (clone.shape.type === 'rect') {
              clone.shape.min.x += dx; clone.shape.min.y += dy;
              clone.shape.max.x += dx; clone.shape.max.y += dy;
            } else if (clone.shape.pts) {
              clone.shape.pts.forEach(pt => {
                pt.x += dx;
                pt.y += dy;
              });
            }
          }
          this.inkStrokes.push(clone);
          newStrokes.push(clone);
        });
      }

      const newTexts = [];
      if (hasTexts) {
        this.selectedTextLabels.forEach(origT => {
          const cloneT = JSON.parse(JSON.stringify(origT));
          cloneT.id = 'txt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          cloneT.mathX += dMathX;
          cloneT.mathY += dMathY;
          this.textLabels.push(cloneT);
          newTexts.push(cloneT);
        });
      }

      this.selectedInkStrokes = newStrokes;
      this.selectedTextLabels = newTexts;
      if (this.lassoPoints && this.lassoPoints.length > 0) {
        this.lassoPoints = this.lassoPoints.map(pt => ({ x: pt.x + offsetPx, y: pt.y + offsetPx }));
      }
      this.lassoBoundingBox = this.calculateStrokesBoundingBox(newStrokes, newTexts);
      this._inkBakeDirty = true;
      this.render();
      this.showToast('📋 선택한 필기/도형이 복제되었습니다! 바로 드래그하여 이동하세요.');
    }

    getLassoResizeHandleAt(pos) {
      const hasSelection = (this.selectedInkStrokes && this.selectedInkStrokes.length > 0) ||
        (this.selectedTextLabels && this.selectedTextLabels.length > 0);
      if (!hasSelection || !this.lassoBoundingBox) return null;

      const bbox = this.lassoBoundingBox;
      const pad = 10;
      const x1 = bbox.minX - pad;
      const y1 = bbox.minY - pad;
      const x2 = bbox.maxX + pad;
      const y2 = bbox.maxY + pad;

      const corners = [
        { key: 'br', x: x2, y: y2 },
        { key: 'tr', x: x2, y: y1 },
        { key: 'bl', x: x1, y: y2 },
        { key: 'tl', x: x1, y: y1 }
      ];
      for (const c of corners) {
        if (Math.hypot(pos.x - c.x, pos.y - c.y) <= 15) {
          return c.key;
        }
      }
      return null;
    }

    deleteSelectedInkStrokes() {
      const cl = this._activeCardLasso;
      if (cl && Array.isArray(cl.selectedStrokes) && cl.selectedStrokes.length > 0 && typeof cl.getStrokes === 'function' && typeof cl.setStrokes === 'function') {
        const set = new Set(cl.selectedStrokes);
        const nextArr = cl.getStrokes().filter(s => !set.has(s));
        cl.setStrokes(nextArr);
        const renderFn = cl.renderFn;
        this._activeCardLasso = null;
        if (typeof renderFn === 'function') renderFn();
        if (this.activeInkTool === 'lasso') {
          this.setActiveInkTool('pen');
          return;
        }
        this.syncLassoActionBarUI();
        return;
      }

      const hasStrokes = this.selectedInkStrokes && this.selectedInkStrokes.length > 0;
      const hasTexts = this.selectedTextLabels && this.selectedTextLabels.length > 0;
      if (!hasStrokes && !hasTexts) return;

      this.pushHistoryState();
      if (hasStrokes) {
        const set = new Set(this.selectedInkStrokes);
        this.inkStrokes = this.inkStrokes.filter(s => !set.has(s));
        this.selectedInkStrokes = [];
      }
      if (hasTexts) {
        const setT = new Set(this.selectedTextLabels);
        this.textLabels = this.textLabels.filter(t => !setT.has(t));
        this.selectedTextLabels = [];
      }
      this.lassoBoundingBox = null;
      this.lassoPoints = [];
      this._inkBakeDirty = true;
      if (this.activeInkTool === 'lasso') {
        this.setActiveInkTool('pen');
        return;
      }
      this.syncLassoActionBarUI();
      this.render();
    }

    drawLassoOverlay(ctx) {
      // 1. 드로잉 중인 올가미는 마우스/펜 끝을 매끄럽게 따라가는 깔끔한 점선으로 표시
      if (this.isLassoSelecting && this.lassoPoints && this.lassoPoints.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
        for (let i = 1; i < this.lassoPoints.length; i++) {
          ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
        }
        ctx.strokeStyle = '#00d2d3';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 5]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // 2. 선택 완료 및 드래그/리사이즈 중인 올가미 오버레이 + 4모서리 크기조절 핸들
      const hasSelection = (this.selectedInkStrokes && this.selectedInkStrokes.length > 0) ||
        (this.selectedTextLabels && this.selectedTextLabels.length > 0);

      if (hasSelection && !this.lassoBoundingBox) {
        this.lassoBoundingBox = this.calculateStrokesBoundingBox(this.selectedInkStrokes, this.selectedTextLabels);
      }

      if (hasSelection && this.lassoPoints && this.lassoPoints.length >= 3) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
        for (let i = 1; i < this.lassoPoints.length; i++) {
          ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
        }
        ctx.closePath();

        ctx.fillStyle = 'rgba(0, 210, 211, 0.045)';
        ctx.fill();

        ctx.strokeStyle = '#00d2d3';
        ctx.lineWidth = 1.9;
        ctx.setLineDash([7, 5]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      if (hasSelection && this.lassoBoundingBox) {
        const bbox = this.lassoBoundingBox;
        const pad = 10;
        const x1 = bbox.minX - pad;
        const y1 = bbox.minY - pad;
        const x2 = bbox.maxX + pad;
        const y2 = bbox.maxY + pad;
        const w = x2 - x1;
        const h = y2 - y1;

        ctx.save();
        ctx.strokeStyle = 'rgba(2, 132, 199, 0.55)';
        ctx.lineWidth = 1.25;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x1, y1, w, h);

        // 4모서리 크기 조절 핸들 렌더링 (우하단 메인 핸들 강조)
        ctx.setLineDash([]);
        const corners = [
          { x: x1, y: y1, r: 5.5 },
          { x: x2, y: y1, r: 5.5 },
          { x: x1, y: y2, r: 5.5 },
          { x: x2, y: y2, r: 7.0, isMain: true }
        ];
        corners.forEach(c => {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
          ctx.fillStyle = c.isMain ? '#0284c7' : '#ffffff';
          ctx.fill();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = c.isMain ? '#ffffff' : '#0284c7';
          ctx.stroke();
        });
        ctx.restore();
      }

      this.syncLassoActionBarUI();
    }

    setInkDockPosition(pos, showMsg = true, savePref = true) {
      const validPos = ['left', 'bottom', 'right'].includes(pos) ? pos : 'bottom';
      this.inkDockPosition = validPos;
      try {
        localStorage.setItem('graphly_ink_dock_pos_v1', validPos);
      } catch (_) { }

      const dock = document.getElementById('inkFloatingToolbar');
      if (dock) {
        dock.dataset.dockPos = validPos;
        dock.style.left = '';
        dock.style.right = '';
        dock.style.top = '';
        dock.style.bottom = '';
        dock.style.transform = '';
      }

      document.querySelectorAll('.ink-dock-pos-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dockPos === validPos);
      });

      if (savePref && typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }

      if (showMsg) {
        const labels = {
          left: '✍️ 필기 바: 왼쪽 세로 도킹',
          bottom: '✍️ 필기 바: 아래쪽 가로 도킹',
          right: '✍️ 필기 바: 오른쪽 세로 도킹'
        };
        this.showToast(labels[validPos] || '✍️ 필기 바 위치 변경');
      }
    }

    initInkDockDraggable() {
      const dock = document.getElementById('inkFloatingToolbar');
      const handle = document.getElementById('inkDockDragHandle');

      // 저장된 필기 바 위치 복원 (기본값: bottom)
      let savedPos = 'bottom';
      try {
        const raw = localStorage.getItem('graphly_ink_dock_pos_v1');
        if (raw && ['left', 'bottom', 'right'].includes(raw)) {
          savedPos = raw;
        }
      } catch (_) { }
      this.setInkDockPosition(savedPos, false, false);

      // [⚙️ 설정] 패널 내 필기 바 위치 버튼 바인딩
      document.querySelectorAll('.ink-dock-pos-chip').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const targetPos = btn.dataset.dockPos;
          if (targetPos) {
            this.setInkDockPosition(targetPos, true, true);
          }
        };
      });

      if (!dock || !handle) return;

      let isDraggingDock = false;
      let hasMoved = false;
      let startX = 0, startY = 0;
      let initialLeft = 0, initialTop = 0;
      let activePointerId = null;

      const getNearestDockPos = (clientX, clientY) => {
        const W = Math.max(320, window.innerWidth || 1440);
        const H = Math.max(240, window.innerHeight || 900);
        const distLeft = clientX / W;
        const distRight = (W - clientX) / W;
        const distBottom = (H - clientY) / H;
        if (distLeft < 0.28 && distLeft <= distRight && distLeft <= distBottom + 0.06) {
          return 'left';
        }
        if (distRight < 0.28 && distRight < distLeft && distRight <= distBottom + 0.06) {
          return 'right';
        }
        if (distBottom <= distLeft && distBottom <= distRight) {
          return 'bottom';
        }
        return distLeft < distRight ? 'left' : 'right';
      };

      handle.addEventListener('pointerdown', (e) => {
        if (e.button && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        isDraggingDock = true;
        hasMoved = false;
        activePointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        const rect = dock.getBoundingClientRect();
        const parentRect = dock.parentElement ? dock.parentElement.getBoundingClientRect() : { left: 0, top: 0 };
        initialLeft = rect.left - parentRect.left;
        initialTop = rect.top - parentRect.top;
        if (handle.setPointerCapture && e.pointerId !== undefined) {
          try { handle.setPointerCapture(e.pointerId); } catch (_) { }
        }
      });

      window.addEventListener('pointermove', (e) => {
        if (!isDraggingDock) return;
        if (activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!hasMoved && Math.hypot(dx, dy) < 6) return;
        hasMoved = true;
        dock.style.transform = 'none';
        dock.style.left = `${initialLeft + dx}px`;
        dock.style.top = `${initialTop + dy}px`;
        dock.style.right = 'auto';
        dock.style.bottom = 'auto';
      });

      const finishDockDrag = (e) => {
        if (!isDraggingDock) return;
        if (activePointerId !== null && e && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
        isDraggingDock = false;
        if (handle.releasePointerCapture && activePointerId !== null) {
          try { handle.releasePointerCapture(activePointerId); } catch (_) { }
        }
        activePointerId = null;

        if (!hasMoved) {
          // 톡 클릭 시: 아래 ➔ 오른쪽 ➔ 왼쪽 순환
          const order = ['bottom', 'right', 'left'];
          const curIdx = order.indexOf(this.inkDockPosition || 'bottom');
          const nextPos = order[(curIdx + 1) % order.length];
          this.setInkDockPosition(nextPos, true, true);
        } else {
          const snapPos = getNearestDockPos(e ? e.clientX : startX, e ? e.clientY : startY);
          this.setInkDockPosition(snapPos, true, true);
        }
      };

      window.addEventListener('pointerup', finishDockDrag);
      window.addEventListener('pointercancel', finishDockDrag);
    }

    // ==========================================================================
    // [💊 액정타블렛 전용 초직관 알약 리모컨 & 기본 필기바 양방향 원클릭 통합 엔진]
    // - 필기바 내 [#btnInkToPillRemote] ⇄ 미니 리모컨 상단 [#btnPillToFullBar] 양방향 1클릭 스왑
    // - 우측 [✒️ 필기](#btnInkMode) 및 단축키가 직전에 쓰던 모드('bar' | 'pill')를 자동 기억하여 복원
    // - 켜짐 여부 · 선호 모드 · 위치(left, top) · 모듈 폴딩을 localStorage에 자동 기억
    // ==========================================================================
    syncInkUiVisibility(opts = {}) {
      if (this.isQuickPillRemoteOpen) {
        this.isBottomInkBarHidden = true;
      }
      const showPill = Boolean(this.isInkMode && this.isQuickPillRemoteOpen);
      const showBar = Boolean(this.isInkMode && !this.isQuickPillRemoteOpen && !this.isBottomInkBarHidden);

      if (!showBar) {
        const inkSizeFlyout = document.getElementById('inkSizeFlyout');
        const btnInkSizePicker = document.getElementById('btnInkSizePicker');
        if (inkSizeFlyout && inkSizeFlyout.style.display !== 'none') {
          inkSizeFlyout.style.display = 'none';
        }
        if (btnInkSizePicker) {
          btnInkSizePicker.classList.remove('open');
        }
      }

      const dock = document.getElementById('inkFloatingToolbar');
      if (dock) {
        dock.style.display = showBar ? 'flex' : 'none';
      }

      const remote = document.getElementById('quickPillRemote');
      if (remote) {
        remote.style.display = showPill ? 'flex' : 'none';
        if (showPill) {
          if (opts.clampPillPosition) {
            const parsedL = parseFloat(remote.style.left);
            const parsedT = parseFloat(remote.style.top);
            const rect = remote.getBoundingClientRect();
            const pillW = Math.max(98, (rect && rect.width) || remote.offsetWidth || 98);
            const pillH = Math.max(54, (rect && rect.height) || remote.offsetHeight || 220);
            const rawL = Number.isFinite(parsedL) ? parsedL : ((rect && rect.left > 0) ? rect.left : 605);
            const rawT = Number.isFinite(parsedT) ? parsedT : ((rect && rect.top > 0) ? rect.top : 76);
            const clampedL = Math.max(58, Math.min((window.innerWidth || 1440) - pillW - 58, rawL));
            const clampedT = Math.max(12, Math.min((window.innerHeight || 900) - pillH - 12, rawT));
            remote.style.left = `${Math.round(clampedL)}px`;
            remote.style.top = `${Math.round(clampedT)}px`;
          }
          if (typeof this.syncQuickPillRemoteUI === 'function') {
            this.syncQuickPillRemoteUI();
          }
        }
      }

      const btnHeader = document.getElementById('btnInkMode');
      if (btnHeader) {
        btnHeader.classList.toggle('active', Boolean(showBar || showPill));
      }
      const btnQuick = document.getElementById('btnQuickInk');
      if (btnQuick) {
        btnQuick.classList.toggle('active', Boolean(this.isInkMode));
      }
      const btnRail = document.getElementById('btnRailQuickRemote');
      if (btnRail) {
        btnRail.classList.toggle('active', showPill);
      }
    }

    switchToQuickPillRemote(opts = {}) {
      this.preferredInkUiMode = 'pill';
      this.isBottomInkBarHidden = true;
      this.isQuickPillRemoteOpen = true;
      if (!this.isInkMode) {
        this.toggleInkMode(true);
      } else {
        this.syncInkUiVisibility({ clampPillPosition: true });
      }
      if (typeof this._saveQuickPillRemoteSettings === 'function') {
        this._saveQuickPillRemoteSettings();
      }
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      if (!opts.silentToast && typeof this.showToast === 'function') {
        this.showToast('🎛️ 미니 리모컨 모드로 전환했습니다.');
      }
    }

    switchToFullInkToolbar(opts = {}) {
      this.preferredInkUiMode = 'bar';
      this.isQuickPillRemoteOpen = false;
      this.isBottomInkBarHidden = false;
      if (!this.isInkMode) {
        this.toggleInkMode(true);
      } else {
        this.syncInkUiVisibility();
      }
      if (typeof this._saveQuickPillRemoteSettings === 'function') {
        this._saveQuickPillRemoteSettings();
      }
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      if (!opts.silentToast && typeof this.showToast === 'function') {
        this.showToast('✍️ 기본 필기바로 전환했습니다.');
      }
    }

    toggleBottomInkBar(showVal = null) {
      if (showVal === null) {
        const anyInkUiVisible = Boolean(this.isInkMode && (this.isQuickPillRemoteOpen || !this.isBottomInkBarHidden));
        if (anyInkUiVisible) {
          const wasPill = Boolean(this.isQuickPillRemoteOpen);
          this.preferredInkUiMode = wasPill ? 'pill' : 'bar';
          this.isQuickPillRemoteOpen = false;
          this.isBottomInkBarHidden = true;
          this.syncInkUiVisibility();
          if (typeof this._saveQuickPillRemoteSettings === 'function') {
            this._saveQuickPillRemoteSettings();
          }
          if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
          this.showToast(wasPill ? '🎛️ 미니 리모컨을 숨겼습니다.' : '✍️ 필기 바를 숨겼습니다.');
          return;
        }

        const wantPill = (this.preferredInkUiMode === 'pill');
        this.isQuickPillRemoteOpen = wantPill;
        this.isBottomInkBarHidden = wantPill;
        if (!this.isInkMode) {
          this.toggleInkMode(true);
        } else {
          this.syncInkUiVisibility({ clampPillPosition: wantPill });
        }
        if (typeof this._saveQuickPillRemoteSettings === 'function') {
          this._saveQuickPillRemoteSettings();
        }
        if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        this.showToast(wantPill ? '🎛️ 미니 리모컨이 다시 표시되었습니다.' : '✍️ 필기 바가 다시 표시되었습니다.');
        return;
      }

      if (Boolean(showVal)) {
        this.switchToFullInkToolbar({ silentToast: true });
        this.showToast('✍️ 필기 바가 다시 표시되었습니다.');
      } else {
        this.preferredInkUiMode = 'bar';
        this.isQuickPillRemoteOpen = false;
        this.isBottomInkBarHidden = true;
        this.syncInkUiVisibility();
        if (typeof this._saveQuickPillRemoteSettings === 'function') {
          this._saveQuickPillRemoteSettings();
        }
        if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        this.showToast('✍️ 필기 바를 숨겼습니다.');
      }
    }

    initQuickPillRemote() {
      const remote = document.getElementById('quickPillRemote');
      const handle = document.getElementById('pillRemoteDragHandle');
      const btnRail = document.getElementById('btnRailQuickRemote');
      const btnExpand = document.getElementById('btnPillToFullBar');
      const btnSwap = document.getElementById('btnPillSwapPenSelect');
      const btnEraser = document.getElementById('btnPillEraser');
      const btnLasso = document.getElementById('btnPillLasso');
      const btnLaser = document.getElementById('btnPillLaser');
      const btnSticker = document.getElementById('btnPillSticker');
      const btnZoomOut = document.getElementById('btnPillZoomOut');
      const btnZoomIn = document.getElementById('btnPillZoomIn');
      const btnHighlighter = document.getElementById('btnPillHighlighter');
      const btnClearAll = document.getElementById('btnPillClearAll');
      const btnModTools = document.getElementById('btnPillModTools');
      const btnModZoom = document.getElementById('btnPillModZoom');
      const btnModColor = document.getElementById('btnPillModColor');
      const btnModExtra = document.getElementById('btnPillModExtra');
      const btnClose = document.getElementById('btnPillClose');

      if (!remote) return;

      const STORAGE_KEY = 'graphly_pill_remote_v1';
      this.preferredInkUiMode = 'bar';
      this.isQuickPillRemoteOpen = false;
      this.isBottomInkBarHidden = false;
      this.pillModules = {
        tools: true,
        zoom: true,
        color: false,
        extra: false
      };

      const saveRemoteSettings = () => {
        try {
          const parsedL = parseFloat(remote.style.left);
          const parsedT = parseFloat(remote.style.top);
          const rect = (!Number.isFinite(parsedL) || !Number.isFinite(parsedT)) ? remote.getBoundingClientRect() : null;
          const savedL = Number.isFinite(parsedL) ? parsedL : ((rect && rect.left > 0) ? rect.left : 605);
          const savedT = Number.isFinite(parsedT) ? parsedT : ((rect && rect.top > 0) ? rect.top : 76);
          const payload = {
            preferredUiMode: (this.preferredInkUiMode === 'pill') ? 'pill' : 'bar',
            isOpen: Boolean(this.isQuickPillRemoteOpen),
            hideBottomBar: Boolean(this.isBottomInkBarHidden),
            modTools: Boolean(this.pillModules.tools),
            modZoom: Boolean(this.pillModules.zoom),
            modColor: Boolean(this.pillModules.color),
            modExtra: Boolean(this.pillModules.extra),
            left: Math.round(savedL),
            top: Math.round(savedT)
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (err) { }
      };
      this._saveQuickPillRemoteSettings = saveRemoteSettings;

      // 저장된 세팅 복원 (구버전 동시 열림 세팅도 단일 배타 모드로 자동 마이그레이션)
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (typeof saved.modTools === 'boolean') this.pillModules.tools = saved.modTools;
          if (typeof saved.modZoom === 'boolean') this.pillModules.zoom = saved.modZoom;
          if (typeof saved.modColor === 'boolean') this.pillModules.color = saved.modColor;
          if (typeof saved.modExtra === 'boolean') this.pillModules.extra = saved.modExtra;
          if (saved.preferredUiMode === 'pill' || saved.preferredUiMode === 'bar') {
            this.preferredInkUiMode = saved.preferredUiMode;
          }
          if (typeof saved.hideBottomBar === 'boolean') {
            this.isBottomInkBarHidden = saved.hideBottomBar;
          }
          if (typeof saved.left === 'number' && typeof saved.top === 'number') {
            const pillW = remote.offsetWidth || 98;
            const clampedL = Math.max(58, Math.min((window.innerWidth || 1440) - pillW - 58, saved.left));
            const clampedT = Math.max(12, Math.min((window.innerHeight || 900) - 80, saved.top));
            remote.style.left = `${clampedL}px`;
            remote.style.top = `${clampedT}px`;
          }
          if (saved.isOpen) {
            this.isQuickPillRemoteOpen = true;
            this.isBottomInkBarHidden = true;
            this.preferredInkUiMode = 'pill';
          }
        }
      } catch (err) { }

      this.syncInkUiVisibility({ clampPillPosition: Boolean(this.isQuickPillRemoteOpen) });

      if (btnRail) {
        btnRail.onclick = (e) => {
          e.stopPropagation();
          this.toggleQuickPillRemote();
        };
      }

      if (btnExpand) {
        btnExpand.onclick = (e) => {
          e.stopPropagation();
          this.switchToFullInkToolbar();
        };
      }

      if (btnClose) {
        btnClose.onclick = (e) => {
          e.stopPropagation();
          this.toggleQuickPillRemote(false);
        };
      }

      // 0단 기본: 초대형 메인 원버튼 [✒️ 필기 ⇄ ↖ 이동] 무한 반복 스왑!
      if (btnSwap) {
        btnSwap.onclick = (e) => {
          e.stopPropagation();
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'pen') {
            this.setActiveInkTool('select');
          } else {
            this.setActiveInkTool('pen');
          }
        };
      }

      // 모듈 1 [도구]: 지우개 & 올가미 (한 번 더 누르면 즉시 필기로 복귀!)
      if (btnEraser) {
        btnEraser.onclick = (e) => {
          e.stopPropagation();
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'eraser') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('eraser');
          }
        };
      }

      if (btnLasso) {
        btnLasso.onclick = (e) => {
          e.stopPropagation();
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'lasso') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('lasso');
          }
        };
      }

      if (btnLaser) {
        btnLaser.onclick = (e) => {
          e.stopPropagation();
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'laser') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('laser');
          }
        };
      }

      if (btnSticker) {
        btnSticker.onclick = (e) => {
          e.stopPropagation();
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'sticker') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('sticker');
          }
        };
      }

      // 모듈 2 [줌]: [－] / [＋] 줌 버튼 (단타 클릭 + 0.3초 이상 꾹 누르면 연속 줌!)
      const bindHoldZoom = (btn, delta) => {
        if (!btn) return;
        let holdTimer = null;
        let holdInterval = null;
        let didHold = false;

        const clearHold = () => {
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
          if (holdInterval) { clearInterval(holdInterval); holdInterval = null; }
        };

        btn.addEventListener('pointerdown', (e) => {
          if (e.button && e.button !== 0) return;
          e.stopPropagation();
          didHold = false;
          clearHold();
          holdTimer = setTimeout(() => {
            didHold = true;
            holdInterval = setInterval(() => {
              this.zoomByStep(delta * 0.65);
            }, 55);
          }, 300);
        });

        window.addEventListener('pointerup', clearHold, { capture: true });
        window.addEventListener('pointercancel', clearHold, { capture: true });
        btn.addEventListener('pointerleave', clearHold);

        btn.onclick = (e) => {
          e.stopPropagation();
          if (didHold) {
            didHold = false;
            return;
          }
          this.zoomByStep(delta);
        };
      };

      bindHoldZoom(btnZoomOut, -0.12);
      bindHoldZoom(btnZoomIn, 0.12);

      // 모듈 3 [색상]: 5색 컬러 도트 + 형광펜 + 필기 비우기
      document.querySelectorAll('.pill-color-dot').forEach(dot => {
        dot.onclick = (e) => {
          e.stopPropagation();
          const color = e.currentTarget.dataset.color;
          if (color) {
            this.setInkColor(color);
          }
        };
      });

      if (btnHighlighter) {
        btnHighlighter.onclick = (e) => {
          e.stopPropagation();
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'highlighter') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('highlighter');
          }
        };
      }

      if (btnClearAll) {
        btnClearAll.onclick = (e) => {
          e.stopPropagation();
          this.clearAllInk();
        };
      }

      // 하단 레고 모듈 스위치 ([도구] · [줌] · [색상] 개별 ON/OFF 폴딩!)
      if (btnModTools) {
        btnModTools.onclick = (e) => {
          e.stopPropagation();
          this.togglePillModule('tools');
        };
      }
      if (btnModZoom) {
        btnModZoom.onclick = (e) => {
          e.stopPropagation();
          this.togglePillModule('zoom');
        };
      }
      if (btnModColor) {
        btnModColor.onclick = (e) => {
          e.stopPropagation();
          this.togglePillModule('color');
        };
      }
      if (btnModExtra) {
        btnModExtra.onclick = (e) => {
          e.stopPropagation();
          this.togglePillModule('extra');
        };
      }

      // 상단 드래그 손잡이(⋮⋮⋮) 및 리모컨 빈 배경 영역 PointerEvent 이동 (뒷창 캔버스 필기 누수 100% 원천 차단!)
      if (remote) {
        let isDraggingPill = false;
        let dragPointerId = null;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        const startPillDrag = (e) => {
          if (e.button && e.button !== 0) return;
          // 닫기 버튼이나 기능 버튼을 누른 경우에는 버튼 클릭으로 동작 (단, 드래그 시작 플래그는 UI로 고정하여 캔버스 필기 차단!)
          if (e.target && e.target.closest && e.target.closest('button')) {
            this._activeGestureStartedOnUI = true;
            return;
          }
          e.preventDefault();
          e.stopPropagation();

          isDraggingPill = true;
          this.isDraggingPillRemote = true;
          this._activeGestureStartedOnUI = true;
          this.isDrawingInk = false;
          this.isStylusDrawing = false;
          this.currentInkStroke = null;
          dragPointerId = e.pointerId;
          if (remote.setPointerCapture && e.pointerId !== undefined) {
            try { remote.setPointerCapture(e.pointerId); } catch (err) { }
          }
          startX = e.clientX;
          startY = e.clientY;
          const rect = remote.getBoundingClientRect();
          initialLeft = rect.left;
          initialTop = rect.top;
        };

        remote.addEventListener('pointerdown', startPillDrag);

        window.addEventListener('pointermove', (e) => {
          if (!isDraggingPill) return;
          if (dragPointerId !== null && e.pointerId !== undefined && e.pointerId !== dragPointerId) return;
          e.preventDefault();
          e.stopPropagation();
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          const pillW = remote.offsetWidth || 98;
          const nextL = Math.max(58, Math.min((window.innerWidth || 1920) - pillW - 58, initialLeft + dx));
          const nextT = Math.max(8, Math.min((window.innerHeight || 1080) - 56, initialTop + dy));
          remote.style.left = `${Math.round(nextL)}px`;
          remote.style.top = `${Math.round(nextT)}px`;
          if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
            this._recordAudioWorkspaceStateIfNeeded(false);
          }
        }, { capture: true, passive: false });

        const endPillDrag = (e) => {
          if (!isDraggingPill) return;
          if (dragPointerId !== null && e && e.pointerId !== undefined && e.pointerId !== dragPointerId) return;
          isDraggingPill = false;
          this.isDraggingPillRemote = false;
          if (remote.releasePointerCapture && dragPointerId !== null && dragPointerId !== undefined) {
            try { remote.releasePointerCapture(dragPointerId); } catch (err) { }
          }
          dragPointerId = null;
          saveRemoteSettings();
          if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        };
        window.addEventListener('pointerup', endPillDrag, { capture: true });
        window.addEventListener('pointercancel', endPillDrag, { capture: true });
      }

      this.updateInkPaletteUI();
      this.syncQuickPillRemoteUI();
    }

    togglePillModule(modKey, forceVal = null) {
      if (!this.pillModules || !(modKey in this.pillModules)) return;
      this.pillModules[modKey] = (forceVal !== null) ? Boolean(forceVal) : !this.pillModules[modKey];
      this.syncQuickPillRemoteUI();
      if (typeof this._saveQuickPillRemoteSettings === 'function') {
        this._saveQuickPillRemoteSettings();
      }
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    toggleQuickPillRemote(forceVal = null) {
      const remote = document.getElementById('quickPillRemote');
      if (!remote) return;

      const nextState = (forceVal !== null) ? Boolean(forceVal) : !this.isQuickPillRemoteOpen;
      if (nextState) {
        this.switchToQuickPillRemote({ silentToast: Boolean(forceVal !== null) });
        return;
      }

      this.preferredInkUiMode = 'pill';
      this.isQuickPillRemoteOpen = false;
      this.isBottomInkBarHidden = true;
      this.syncInkUiVisibility();

      if (typeof this._saveQuickPillRemoteSettings === 'function') {
        this._saveQuickPillRemoteSettings();
      }
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      if (typeof this.showToast === 'function') {
        this.showToast('🎛️ 미니 리모컨을 숨겼습니다.');
      }
    }

    syncQuickPillRemoteUI() {
      const btnSwap = document.getElementById('btnPillSwapPenSelect');
      const lblSwap = document.getElementById('pillSwapLabel');
      const iconSwap = document.getElementById('pillSwapIcon');
      const btnEraser = document.getElementById('btnPillEraser');
      const btnLasso = document.getElementById('btnPillLasso');
      const btnLaser = document.getElementById('btnPillLaser');
      const btnSticker = document.getElementById('btnPillSticker');
      const btnHighlighter = document.getElementById('btnPillHighlighter');
      const secTools = document.getElementById('pillSecTools');
      const secZoom = document.getElementById('pillSecZoom');
      const secColor = document.getElementById('pillSecColor');
      const secExtra = document.getElementById('pillSecExtra');
      const btnModTools = document.getElementById('btnPillModTools');
      const btnModZoom = document.getElementById('btnPillModZoom');
      const btnModColor = document.getElementById('btnPillModColor');
      const btnModExtra = document.getElementById('btnPillModExtra');
      if (!btnSwap) return;

      const tool = this.activeInkTool || 'pen';
      const isSelect = (tool === 'select');
      const isPen = (tool === 'pen');

      btnSwap.classList.toggle('mode-pen', isPen);
      btnSwap.classList.toggle('mode-select', isSelect);
      btnSwap.classList.toggle('mode-subtool', !isPen && !isSelect);

      if (lblSwap) {
        lblSwap.textContent = isSelect ? '이동' : '필기';
      }

      if (iconSwap) {
        if (isSelect) {
          iconSwap.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>`;
        } else {
          iconSwap.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
        }
      }

      if (btnEraser) btnEraser.classList.toggle('active', tool === 'eraser');
      if (btnLasso) btnLasso.classList.toggle('active', tool === 'lasso');
      if (btnLaser) btnLaser.classList.toggle('active', tool === 'laser');
      if (btnSticker) btnSticker.classList.toggle('active', tool === 'sticker');
      if (btnHighlighter) btnHighlighter.classList.toggle('active', tool === 'highlighter');

      const mods = this.pillModules || { tools: true, zoom: true, color: false, extra: false };
      if (secTools) secTools.style.display = mods.tools ? 'flex' : 'none';
      if (secZoom) secZoom.style.display = mods.zoom ? 'flex' : 'none';
      if (secColor) secColor.style.display = mods.color ? 'flex' : 'none';
      if (secExtra) secExtra.style.display = mods.extra ? 'flex' : 'none';

      if (btnModTools) btnModTools.classList.toggle('active', Boolean(mods.tools));
      if (btnModZoom) btnModZoom.classList.toggle('active', Boolean(mods.zoom));
      if (btnModColor) btnModColor.classList.toggle('active', Boolean(mods.color));
      if (btnModExtra) btnModExtra.classList.toggle('active', Boolean(mods.extra));
    }

    // 🌟 [초고속 144Hz 2-레이어 오프스크린 잉크 베이킹 엔진 & 상하좌우 오버스캔(Overscan) 버퍼 계산기] 🌟
    _getInkBakeMetrics() {
      const dpr = this.getCanvasDpr();
      const sw = Math.max(1, this.screenWidth || (this.canvas ? Math.round(this.canvas.width / dpr) : 1280) || 1280);
      const sh = Math.max(1, this.screenHeight || (this.canvas ? Math.round(this.canvas.height / dpr) : 720) || 720);
      // 화면 상하좌우 바깥 영역(Overscan Margin)까지 넉넉히 베이크하여
      // 두 손가락 패닝/핀치 중 화면 위·아래·좌·우에서 내려오거나 들어오는 글씨가 절대 잘리지 않도록 보장
      // (단, iPadOS Safari의 단일 캔버스 픽셀 한도 16.7M 픽셀 및 변 길이를 초과하지 않도록 안전 캡 적용)
      let padX = Math.min(520, Math.round(sw * 0.38));
      let padY = Math.min(520, Math.round(sh * 0.48));
      const maxSidePx = Math.max(Math.round(sw * dpr) + 160, Math.round(sh * dpr) + 160, 4000);
      if (Math.round((sw + padX * 2) * dpr) > maxSidePx) {
        padX = Math.max(80, Math.floor((maxSidePx / dpr - sw) / 2));
      }
      if (Math.round((sh + padY * 2) * dpr) > maxSidePx) {
        padY = Math.max(80, Math.floor((maxSidePx / dpr - sh) / 2));
      }
      const maxTotalPixels = 12500000;
      let totalW = Math.round((sw + padX * 2) * dpr);
      let totalH = Math.round((sh + padY * 2) * dpr);
      if (totalW * totalH > maxTotalPixels) {
        const scale = Math.sqrt(maxTotalPixels / (totalW * totalH));
        const targetCssW = Math.max(sw + 160, Math.floor((totalW * scale) / dpr));
        const targetCssH = Math.max(sh + 160, Math.floor((totalH * scale) / dpr));
        padX = Math.max(80, Math.floor((targetCssW - sw) / 2));
        padY = Math.max(80, Math.floor((targetCssH - sh) / 2));
        totalW = Math.round((sw + padX * 2) * dpr);
        totalH = Math.round((sh + padY * 2) * dpr);
      }
      return { dpr, sw, sh, padX, padY, width: totalW, height: totalH };
    }

    clearInkCache() {
      this._hasSceneFreeze = false;
      this._hasLiveTipPatch = false;
      this._hasBakedStrokes = false;
      this._inkBakeDirty = true;
      this._inkBakeCamera = null;
      this._pendingIncrementalBakeStrokes = [];
      if (this._pendingIncrementalBakeTimer) {
        clearTimeout(this._pendingIncrementalBakeTimer);
        this._pendingIncrementalBakeTimer = null;
      }
      const { dpr, padX, padY, width, height } = this._getInkBakeMetrics();
      if (this.inkBakeCanvas && this.inkBakeCtx) {
        if (this.inkBakeCanvas.width !== width || this.inkBakeCanvas.height !== height) {
          this.inkBakeCanvas.width = width;
          this.inkBakeCanvas.height = height;
        } else {
          this.inkBakeCtx.setTransform(1, 0, 0, 1, 0, 0);
          this.inkBakeCtx.clearRect(0, 0, this.inkBakeCanvas.width, this.inkBakeCanvas.height);
        }
        this.inkBakeCtx.setTransform(dpr, 0, 0, dpr, padX * dpr, padY * dpr);
      }
      if (this.inkGraphBakeCanvas && this.inkGraphBakeCtx) {
        if (this.inkGraphBakeCanvas.width !== width || this.inkGraphBakeCanvas.height !== height) {
          this.inkGraphBakeCanvas.width = width;
          this.inkGraphBakeCanvas.height = height;
        } else {
          this.inkGraphBakeCtx.setTransform(1, 0, 0, 1, 0, 0);
          this.inkGraphBakeCtx.clearRect(0, 0, this.inkGraphBakeCanvas.width, this.inkGraphBakeCanvas.height);
        }
        this.inkGraphBakeCtx.setTransform(dpr, 0, 0, dpr, padX * dpr, padY * dpr);
      }
    }

    // 🌟 [iCanScreen 급 0ms 필기 엔진]: 펜이 닿는 순간 배경(칠판 + 수학 그래프 + 기존 필기)을 1장의 GPU 텍스처로 스냅샷 동결!
    // 필기 도중(pointermove)에는 520단계 함수 수식 계산, 격자, 축, 수선 렌더링을 100% 생략하고 이 텍스처만 0.01ms 만에 Blit합니다.
    captureSceneFreeze() {
      if (!this.canvas || !this.sceneFreezeCanvas || !this.sceneFreezeCtx) return;
      const dpr = this.getCanvasDpr();
      if (this.sceneFreezeCanvas.width !== this.canvas.width || this.sceneFreezeCanvas.height !== this.canvas.height) {
        this.sceneFreezeCanvas.width = this.canvas.width;
        this.sceneFreezeCanvas.height = this.canvas.height;
        this.sceneFreezeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      this.sceneFreezeCtx.save();
      this.sceneFreezeCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.sceneFreezeCtx.drawImage(this.canvas, 0, 0);
      this.sceneFreezeCtx.restore();
      this._hasSceneFreeze = true;
    }

    // ✒️ [4종 필기 펜 스타일(볼펜 · 납작펜 · 만년필 · 붓펜) 전환 및 아이캔스크린 소프트 블러/모퉁이 보정 엔진]
    setInkPenStyle(styleKey, showMsg = true) {
      if (!['ballpen', 'flat', 'fountain', 'brush'].includes(styleKey)) return;
      this.inkPenStyle = styleKey;
      try {
        localStorage.setItem('graphly_ink_pen_style_v1', styleKey);
      } catch (err) { }
      document.querySelectorAll('.ink-pen-style-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.penStyle === styleKey);
      });
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }
      if (showMsg) {
        const labels = {
          ballpen: '🖊️ 볼펜 스타일 (일정한 굵기)',
          flat: '📏 납작펜 스타일 (가로획은 얇고 세로획은 도톰한 납작 닙)',
          fountain: '✒️ 만년필 스타일 (부드러운 필압 · 날렵한 삐침)',
          brush: '🖌️ 붓펜 스타일 (강한 필압 대비 · 붓 터치)'
        };
        this.showToast(labels[styleKey] || '펜 스타일 변경');
      }
    }

    computePenStyleWidth(baseSize, p, penStyle = 'ballpen') {
      if (!penStyle || penStyle === 'ballpen' || penStyle === 'flat') {
        return Math.max(0.8, baseSize * 0.98);
      }
      const clampedP = Math.max(0.03, Math.min(1.0, (typeof p === 'number' && !isNaN(p)) ? p : 0.5));
      // 🌟 [굿노트·노타빌리티 급 글씨 크기(baseSize) 연동 다이나믹 레인지 증폭]:
      // 글씨 크기를 크게 올릴수록(4.2 -> 12+) 끝단 삐침(minFactor)은 더 날렵하게 유지하면서
      // 힘주어 누르는 몸통(maxFactor)은 훨씬 더 넓게 벌어져, 별도의 세부 슬라이더 없이도
      // [볼펜 ➔ 납작펜 ➔ 만년필 ➔ 붓펜] 전환 및 글씨 크기 확대 시 극적인 필감 차이를 체감할 수 있습니다!
      const sizeRatio = Math.max(0, Math.min(1.0, (baseSize - 3.5) / 8.5));
      if (penStyle === 'fountain') {
        // ✒️ 만년필: 단정한 닙 탄성 — 날렵한 삐침(0.24x~0.28x) ~ 힘준 획(1.52x~1.72x, 약 6~7배 다이나믹 레인지)
        const minF = 0.28 - 0.04 * sizeRatio;
        const maxF = 1.52 + 0.20 * sizeRatio;
        const factor = minF + (maxF - minF) * Math.pow(clampedP, 0.80);
        return Math.max(0.48, baseSize * factor);
      }
      if (penStyle === 'brush') {
        // 🖌️ 붓펜: 모필(붓털) 탄성 — 바늘 끝 삐침(0.08x~0.13x) ~ 묵직한 붓 획(2.15x~2.85x, 최대 30배 다이나믹 레인지!)
        const minF = 0.13 - 0.05 * sizeRatio;
        const maxF = 2.15 + 0.70 * sizeRatio;
        const factor = minF + (maxF - minF) * Math.pow(clampedP, 1.25);
        return Math.max(0.32, baseSize * factor);
      }
      return Math.max(0.8, baseSize * 0.98);
    }

    drawVariableWidthQuadSegment(ctx, x0, y0, cx, cy, x1, y1, w0, w1) {
      const diffW = Math.abs(w1 - w0);
      if (diffW < 0.32) {
        ctx.lineWidth = (w0 + w1) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
        ctx.stroke();
        return;
      }
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      const subSteps = Math.max(2, Math.min(6, Math.ceil(Math.min(diffW * 1.2, Math.max(2, segLen * 0.35)))));
      let prevX = x0;
      let prevY = y0;
      for (let s = 1; s <= subSteps; s++) {
        const t = s / subSteps;
        const invT = 1 - t;
        const nx = invT * invT * x0 + 2 * invT * t * cx + t * t * x1;
        const ny = invT * invT * y0 + 2 * invT * t * cy + t * t * y1;
        const tMid = (s - 0.5) / subSteps;
        ctx.lineWidth = w0 + (w1 - w0) * tMid;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        prevX = nx;
        prevY = ny;
      }
    }

    drawVariableWidthLineSegment(ctx, x0, y0, x1, y1, w0, w1) {
      const diffW = Math.abs(w1 - w0);
      if (diffW < 0.32) {
        ctx.lineWidth = (w0 + w1) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        return;
      }
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      const subSteps = Math.max(2, Math.min(6, Math.ceil(Math.min(diffW * 1.2, Math.max(2, segLen * 0.35)))));
      let prevX = x0;
      let prevY = y0;
      for (let s = 1; s <= subSteps; s++) {
        const t = s / subSteps;
        const nx = x0 + (x1 - x0) * t;
        const ny = y0 + (y1 - y0) * t;
        const tMid = (s - 0.5) / subSteps;
        ctx.lineWidth = w0 + (w1 - w0) * tMid;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        prevX = nx;
        prevY = ny;
      }
    }

    // 🌟 [문제/그래프 카드 PC vs 아이패드 이원화 샘플 수집 (PC: 무수축 2차 곡선 다림질 / 아이패드: 1차 스트림라인 그대로 보존)]:
    _appendCardStrokeSamplesFromMoveEvent(stroke, e, rect, w, h, recT) {
      if (!stroke || !Array.isArray(stroke.points) || !e) return false;
      const rLeft = rect ? rect.left : 0;
      const rTop = rect ? rect.top : 0;
      const rw = Math.max(1, w || (rect && rect.width) || 1);
      const rh = Math.max(1, h || (rect && rect.height) || 1);
      const inkProfile = this.getDeviceInkProfile();
      const minDist = (e.pointerType === 'pen') ? inkProfile.minCardDistPen : inkProfile.minCardDistMouse;

      let events = [e];
      if (inkProfile.deviceType === 'pc') {
        events = this._selectPcCoalescedEvents(e, inkProfile);
        if (!stroke.isHighlighter && !stroke._pcFairer && typeof this._createPcStrokeFairer === 'function') {
          const fairStep = (e.pointerType === 'pen') ? (inkProfile.pcFairCardStepPen || 1.65) : (inkProfile.pcFairCardStepMouse || 1.80);
          stroke._pcFairer = this._createPcStrokeFairer(fairStep);
          const p0 = stroke.points[0];
          if (p0) {
            stroke._pcFairer.start(p0.nx * rw, p0.ny * rh, p0.p, p0.t);
          }
        }
      } else if (inkProfile.useCoalescedEvents && typeof e.getCoalescedEvents === 'function') {
        const coalesced = e.getCoalescedEvents();
        if (coalesced && coalesced.length > 0) {
          events = coalesced;
        }
      }

      let added = false;
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const evTs = (typeof ev.timeStamp === 'number' && ev.timeStamp > 0) ? ev.timeStamp : 0;
        if (evTs > 0) {
          if (events.length > 1 && typeof stroke._lastSampleTs === 'number' && evTs < stroke._lastSampleTs) {
            continue;
          }
          stroke._lastSampleTs = evTs;
        }

        const rawNx = Math.max(0, Math.min(1, (ev.clientX - rLeft) / rw));
        const rawNy = Math.max(0, Math.min(1, (ev.clientY - rTop) / rh));
        const rawPxX = rawNx * rw;
        const rawPxY = rawNy * rh;

        const prevPt = stroke.points[stroke.points.length - 1];
        const lastRaw = stroke._lastRawPx || (prevPt ? { x: prevPt.nx * rw, y: prevPt.ny * rh } : null);
        if (lastRaw) {
          const rawStepDist = Math.hypot(rawPxX - lastRaw.x, rawPxY - lastRaw.y);
          if (rawStepDist < minDist) continue;
          if (stroke._prevRawPx && rawStepDist < inkProfile.forwardGuardMaxDist) {
            const vxPrev = lastRaw.x - stroke._prevRawPx.x;
            const vyPrev = lastRaw.y - stroke._prevRawPx.y;
            const vxNew = rawPxX - lastRaw.x;
            const vyNew = rawPxY - lastRaw.y;
            const lenPrev = Math.hypot(vxPrev, vyPrev);
            if (lenPrev > 0.35) {
              const cosAngle = (vxPrev * vxNew + vyPrev * vyNew) / (lenPrev * rawStepDist);
              if (cosAngle < inkProfile.forwardGuardMinCos) continue;
            }
          }
        }

        const moveRawDist = lastRaw ? Math.hypot(rawPxX - lastRaw.x, rawPxY - lastRaw.y) : 0;
        stroke._prevRawPx = lastRaw ? { x: lastRaw.x, y: lastRaw.y } : { x: rawPxX, y: rawPxY };
        stroke._lastRawPx = { x: rawPxX, y: rawPxY };
        stroke._inPlaceStreamlined = true;

        const rawP = (typeof ev.pressure === 'number') ? ev.pressure : 0.5;
        if (rawP > 0 && Math.abs(rawP - 0.5) > 0.01) stroke._hasHwP = true;

        const dtMs = (evTs > 0 && typeof stroke._lastAcceptedTs === 'number' && stroke._lastAcceptedTs > 0)
          ? (evTs - stroke._lastAcceptedTs)
          : null;
        if (evTs > 0) stroke._lastAcceptedTs = evTs;

        if (inkProfile.deviceType === 'pc' && stroke._pcFairer) {
          const prevMoveP = (typeof stroke._lastMoveP === 'number') ? stroke._lastMoveP : (prevPt ? prevPt.p : 0.5);
          const moveP = this.computeDynamicStrokePressure(
            rawP || 0.5,
            Boolean(stroke._hasHwP),
            moveRawDist,
            stroke.penStyle || 'ballpen',
            prevMoveP,
            stroke.points.length,
            0,
            dtMs
          );
          stroke._lastMoveP = moveP;
          const readyPts = stroke._pcFairer.pushRaw(rawPxX, rawPxY, moveP, recT);
          for (let k = 0; k < readyPts.length; k++) {
            const fPt = readyPts[k];
            stroke.points.push({
              nx: Math.max(0, Math.min(1, fPt.x / rw)),
              ny: Math.max(0, Math.min(1, fPt.y / rh)),
              p: fPt.p,
              t: fPt.t
            });
            added = true;
          }
          if (typeof stroke._pcFairer.peekLiveTipPoints === 'function') {
            const tipPxPts = stroke._pcFairer.peekLiveTipPoints({ x: rawPxX, y: rawPxY }, moveP);
            if (tipPxPts && tipPxPts.length > 0) {
              const tipNorm = new Array(tipPxPts.length);
              for (let tIdx = 0; tIdx < tipPxPts.length; tIdx++) {
                const tp = tipPxPts[tIdx];
                tipNorm[tIdx] = {
                  nx: Math.max(0, Math.min(1, tp.x / rw)),
                  ny: Math.max(0, Math.min(1, tp.y / rh)),
                  p: tp.p
                };
              }
              stroke._pcLiveTipNormPts = tipNorm;
              added = true;
            } else {
              stroke._pcLiveTipNormPts = null;
            }
          }
          continue;
        }

        let sx = rawPxX;
        let sy = rawPxY;
        if (!stroke.isHighlighter && prevPt) {
          const p1x = prevPt.nx * rw;
          const p1y = prevPt.ny * rh;
          const stepD = Math.hypot(rawPxX - p1x, rawPxY - p1y);
          const weight = inkProfile.streamlineWeight * Math.max(0, 1 - stepD / inkProfile.streamlineDecayDist);
          if (weight > 0.005) {
            sx = rawPxX * (1 - weight) + p1x * weight;
            sy = rawPxY * (1 - weight) + p1y * weight;
          }
        }

        const stepDist = prevPt ? Math.hypot(sx - prevPt.nx * rw, sy - prevPt.ny * rh) : 0;
        if (prevPt && stepDist < 0.20) continue;

        const moveP = this.computeDynamicStrokePressure(
          rawP || 0.5,
          Boolean(stroke._hasHwP),
          stepDist,
          stroke.penStyle || 'ballpen',
          prevPt ? prevPt.p : 0.5,
          stroke.points.length,
          0,
          dtMs
        );

        stroke.points.push({
          nx: Math.max(0, Math.min(1, sx / rw)),
          ny: Math.max(0, Math.min(1, sy / rh)),
          p: moveP,
          t: recT
        });
        added = true;
      }
      return added;
    }

    // 🌟 [문제/그래프 카드 펜 뗄 때(pointerup) 끝점 마감]
    _finishCardStrokeTail(stroke, e, rect, w, h, recT) {
      if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) return;
      stroke._pcLiveTipNormPts = null;
      if (stroke.isShape || stroke._shapeHoldDetected) return;
      const rw = Math.max(1, w || (rect && rect.width) || 430);
      const rh = Math.max(1, h || (rect && rect.height) || 353);

      let rawEnd = stroke._lastRawPx || null;
      const isCancelOrZero = !e || e.type === 'pointercancel' || (e.clientX === 0 && e.clientY === 0);
      if (!isCancelOrZero && typeof e.clientX === 'number' && typeof e.clientY === 'number' && rect && rect.width > 0) {
        const endNx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rw));
        const endNy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rh));
        rawEnd = { x: endNx * rw, y: endNy * rh };
      }

      if (this.getDeviceInkProfile().deviceType === 'pc' && stroke._pcFairer) {
        const lastPt = stroke.points[stroke.points.length - 1];
        let p = (typeof stroke._lastMoveP === 'number') ? stroke._lastMoveP : ((typeof lastPt.p === 'number') ? lastPt.p : 0.5);
        const curPenStyle = stroke.penStyle || 'ballpen';
        if (curPenStyle === 'fountain') {
          p = Math.max(0.10, p * 0.55);
        } else if (curPenStyle === 'brush') {
          p = Math.max(0.06, p * 0.45);
        }
        const ex = rawEnd ? rawEnd.x : (lastPt.nx * rw);
        const ey = rawEnd ? rawEnd.y : (lastPt.ny * rh);
        const tailPts = stroke._pcFairer.finish(ex, ey, p, recT !== undefined ? recT : lastPt.t);
        for (let k = 0; k < tailPts.length; k++) {
          const fPt = tailPts[k];
          stroke.points.push({
            nx: Math.max(0, Math.min(1, fPt.x / rw)),
            ny: Math.max(0, Math.min(1, fPt.y / rh)),
            p: fPt.p,
            t: fPt.t
          });
        }
        stroke._pcFairer = null;
        return;
      }

      if (rawEnd && stroke.points.length >= 1) {
        const lastPt = stroke.points[stroke.points.length - 1];
        const lastX = lastPt.nx * rw;
        const lastY = lastPt.ny * rh;
        const tailDist = Math.hypot(rawEnd.x - lastX, rawEnd.y - lastY);
        if (tailDist >= 0.25) {
          const tailKeep = 0.18;
          const endX = stroke.isHighlighter ? rawEnd.x : (lastX * tailKeep + rawEnd.x * (1 - tailKeep));
          const endY = stroke.isHighlighter ? rawEnd.y : (lastY * tailKeep + rawEnd.y * (1 - tailKeep));
          let p = (typeof lastPt.p === 'number') ? lastPt.p : 0.5;
          const curPenStyle = stroke.penStyle || 'ballpen';
          if (curPenStyle === 'fountain') {
            p = Math.max(0.10, p * 0.55);
          } else if (curPenStyle === 'brush') {
            p = Math.max(0.06, p * 0.45);
          }
          stroke.points.push({
            nx: Math.max(0, Math.min(1, endX / rw)),
            ny: Math.max(0, Math.min(1, endY / rh)),
            p,
            t: recT !== undefined ? recT : lastPt.t
          });
        }
      }
    }

    // 🌟 [메인 칠판 및 카드 3곳 공통 입필(첫 점) 필압 매핑 헬퍼]
    _mapInitialStrokePressure(rawP, penStyle = 'ballpen', hasHwP = null) {
      const isRealHw = (typeof hasHwP === 'boolean')
        ? hasHwP
        : (typeof rawP === 'number' && rawP > 0 && Math.abs(rawP - 0.5) > 0.01);
      if (isRealHw) {
        if (penStyle === 'brush') return Math.max(0.12, rawP * 0.65);
        if (penStyle === 'fountain') return Math.max(0.20, rawP * 0.78);
        return rawP;
      }
      if (penStyle === 'brush') return 0.22;
      if (penStyle === 'fountain') return 0.34;
      return 0.5;
    }

    // 🌟 [굿노트 6 · 노타빌리티 급 하이브리드 필압·속도·코너 감응 연산기]
    // 하드웨어 필압(애플펜슬/S펜/와콤)의 S-커브 감도 증폭 + 마우스/전자칠판의 속도·꺾임(Corner Dwell) 역산 융합!
    computeDynamicStrokePressure(rawPressure, hasRealPressure, moveStepDist, penStyle = 'ballpen', prevPressure = 0.5, ptCount = 1, cornerBoost = 0, dtMs = null) {
      if (!penStyle || penStyle === 'ballpen' || penStyle === 'flat') return 0.5;
      const isBrush = (penStyle === 'brush');
      const hasValidDt = (typeof dtMs === 'number' && Number.isFinite(dtMs) && dtMs > 0);
      const dt = hasValidDt ? Math.min(50, Math.max(1, dtMs)) : null;
      const normSpd = (dt !== null)
        ? Math.min(1, Math.max(0, ((moveStepDist / dt) - (isBrush ? 0.48 : 0.60)) / (isBrush ? 9.1 : 10.8)))
        : Math.min(1.0, Math.max(0, (moveStepDist - (isBrush ? 2.0 : 2.5)) / (isBrush ? 38 : 45)));
      const velP = isBrush
        ? Math.max(0.05, Math.min(0.98, 0.96 - Math.pow(normSpd, 0.76) * 0.91 + cornerBoost * 0.18))
        : Math.max(0.15, Math.min(0.92, 0.88 - Math.pow(normSpd, 0.84) * 0.72 + cornerBoost * 0.10));

      let targetP = velP;
      if (hasRealPressure && typeof rawPressure === 'number' && rawPressure > 0) {
        // 일반 필기 압력(0.12 ~ 0.72)만으로도 화면을 세게 누르지 않고 0.05 ~ 1.00 전 구간을 쓰도록 S-Curve 게인 증폭
        const boostedHw = Math.min(1.0, Math.max(0.04, Math.pow(Math.max(0, rawPressure - 0.03) / 0.73, isBrush ? 0.80 : 0.88)));
        targetP = isBrush
          ? (boostedHw * 0.85 + velP * 0.15)
          : (boostedHw * 0.88 + velP * 0.12);
      }

      // 입필(Entry Ramp): 첫 1~2포인트에서 붓끝이 뭉툭하게 찍히지 않고 부드럽게 번지며 시작
      if (ptCount <= 2) {
        const rampCap = isBrush ? (ptCount === 1 ? 0.42 : 0.74) : (ptCount === 1 ? 0.58 : 0.84);
        targetP = Math.min(targetP, rampCap);
      }

      const smoothPrev = (typeof prevPressure === 'number' && !isNaN(prevPressure)) ? prevPressure : targetP;
      const tau = isBrush ? 10.8 : 12.7;
      const alpha = (dt !== null) ? (1 - Math.exp(-dt / tau)) : (isBrush ? 0.32 : 0.28);
      return Math.max(0.04, Math.min(1.0, smoothPrev * (1 - alpha) + targetP * alpha));
    }

    drawPenStyledPointArray(ctx, rawPts, baseSize, penStyle = 'ballpen', softBlur = null, isHighlighter = false) {
      if (!ctx || !rawPts || rawPts.length === 0) return;
      const blurVal = isHighlighter
        ? 0
        : Math.max(0, Math.min(5.0, (typeof softBlur === 'number' && !isNaN(softBlur)) ? softBlur : (this.inkSoftBlur || 0)));
      const pts = rawPts;
      const effBaseSize = (blurVal > 0) ? baseSize * Math.max(0.76, 1.0 - blurVal * 0.038) : baseSize;
      const dpr = (typeof this.getCanvasDpr === 'function') ? this.getCanvasDpr() : (window.devicePixelRatio || 1);
      const strokeCol = ctx.strokeStyle || '#1e293b';

      ctx.save();
      if (blurVal > 0) {
        ctx.shadowColor = strokeCol;
        ctx.shadowBlur = blurVal * dpr * 0.65;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // 📏 [납작펜('flat') 모드]: 타원형 납작 닙 스케일 변환(가로 1.38x · 세로 0.68x) + 좌표 역보정으로 1:1 위치 일치!
      const isFlatNib = (!isHighlighter && penStyle === 'flat');
      const nibX = isFlatNib ? 1.38 : 1.0;
      const nibY = isFlatNib ? 0.68 : 1.0;
      if (isFlatNib) {
        ctx.scale(nibX, nibY);
      }

      // 형광펜(isHighlighter)은 반투명 중첩 자국이 생기지 않도록 단일 연속 패스로 렌더링
      if (isHighlighter) {
        if (pts.length === 1) {
          const w0 = Math.max(4, effBaseSize);
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, w0 / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }
        ctx.lineWidth = Math.max(4, effBaseSize);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 2) {
          ctx.lineTo(pts[1].x, pts[1].y);
        } else {
          const firstMidX = (pts[0].x + pts[1].x) * 0.5;
          const firstMidY = (pts[0].y + pts[1].y) * 0.5;
          ctx.lineTo(firstMidX, firstMidY);
          for (let i = 1; i < pts.length - 1; i++) {
            const midX = (pts[i].x + pts[i + 1].x) * 0.5;
            const midY = (pts[i].y + pts[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
          }
          const last = pts[pts.length - 1];
          ctx.lineTo(last.x, last.y);
        }
        ctx.stroke();
        ctx.restore();
        return;
      }

      // 🌟 [실시간 드로잉(drawLiveBezierStep)과 캐시 베이킹(drawPenStyledPointArray) 100.000% 픽셀 단위 일치]:
      // 도형 자동완성 등으로 인해 render()가 호출될 때 이전에 쓴 글씨가 얇아지거나 변하지 않도록,
      // 볼펜·납작펜·만년필·붓펜 모두 실시간 드로잉과 100% 동일한 세그먼트 단위 스트로크로 렌더링합니다!
      if (pts.length === 1) {
        const w0 = this.computePenStyleWidth(effBaseSize, pts[0].p, penStyle);
        ctx.beginPath();
        ctx.arc(pts[0].x / nibX, pts[0].y / nibY, w0 / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      if (pts.length === 2) {
        const p0 = pts[0];
        const p1 = pts[1];
        const mx = (p0.x + p1.x) * 0.5;
        const my = (p0.y + p1.y) * 0.5;
        if (penStyle === 'ballpen' || penStyle === 'flat') {
          const lineW = this.computePenStyleWidth(effBaseSize, p0.p, penStyle);
          ctx.lineWidth = lineW;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (blurVal > 0 || (typeof ctx.globalAlpha === 'number' && ctx.globalAlpha < 0.999)) {
            ctx.beginPath();
            ctx.arc(p0.x / nibX, p0.y / nibY, lineW / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(p0.x / nibX, p0.y / nibY);
            ctx.lineTo(mx / nibX, my / nibY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p0.x / nibX, p0.y / nibY);
            ctx.lineTo(p1.x / nibX, p1.y / nibY);
            ctx.stroke();
          } else if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.05) {
            ctx.beginPath();
            ctx.arc(p0.x / nibX, p0.y / nibY, lineW / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(p0.x / nibX, p0.y / nibY);
            ctx.lineTo(p1.x / nibX, p1.y / nibY);
            ctx.stroke();
          }
        } else {
          const w0 = this.computePenStyleWidth(effBaseSize, p0.p, penStyle);
          const wMid = this.computePenStyleWidth(effBaseSize, (p0.p + p1.p) * 0.5, penStyle);
          const w1 = this.computePenStyleWidth(effBaseSize, p1.p, penStyle);
          ctx.beginPath();
          ctx.arc(p0.x, p0.y, w0 / 2, 0, Math.PI * 2);
          ctx.fill();
          this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, mx, my, w0, wMid);
          this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, p1.x, p1.y, w0, w1);
        }
        ctx.restore();
        return;
      }
      if (penStyle === 'ballpen' || penStyle === 'flat') {
        const lineW = this.computePenStyleWidth(effBaseSize, pts[pts.length - 1].p, penStyle);
        ctx.lineWidth = lineW;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const firstMidX = (pts[0].x + pts[1].x) * 0.5;
        const firstMidY = (pts[0].y + pts[1].y) * 0.5;
        const last = pts[pts.length - 1];
        if (blurVal > 0 || (typeof ctx.globalAlpha === 'number' && ctx.globalAlpha < 0.999)) {
          ctx.beginPath();
          ctx.arc(pts[0].x / nibX, pts[0].y / nibY, lineW / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(pts[0].x / nibX, pts[0].y / nibY);
          ctx.lineTo(firstMidX / nibX, firstMidY / nibY);
          ctx.stroke();
          let prevMidX = firstMidX;
          let prevMidY = firstMidY;
          for (let i = 1; i < pts.length - 1; i++) {
            const midX = (pts[i].x + pts[i + 1].x) * 0.5;
            const midY = (pts[i].y + pts[i + 1].y) * 0.5;
            ctx.beginPath();
            ctx.moveTo(prevMidX / nibX, prevMidY / nibY);
            ctx.quadraticCurveTo(pts[i].x / nibX, pts[i].y / nibY, midX / nibX, midY / nibY);
            ctx.stroke();
            prevMidX = midX;
            prevMidY = midY;
          }
          ctx.beginPath();
          ctx.moveTo(prevMidX / nibX, prevMidY / nibY);
          ctx.lineTo(last.x / nibX, last.y / nibY);
          ctx.stroke();
        } else {
          // 🌟 [드로우콜 35배 압축 패스트패스]: 불투명 균일 굵기(ballpen / flat, blurVal === 0) 획을
          // 점 단위 ctx.stroke() 대신 단 1회의 연속 2차 베지어 Path로 일괄 렌더링!
          let hasMotion = (Math.hypot(last.x - pts[0].x, last.y - pts[0].y) >= 0.05);
          if (!hasMotion) {
            for (let i = 1; i < pts.length; i++) {
              if (Math.hypot(pts[i].x - pts[0].x, pts[i].y - pts[0].y) >= 0.05) {
                hasMotion = true;
                break;
              }
            }
          }
          if (!hasMotion) {
            ctx.beginPath();
            ctx.arc(pts[0].x / nibX, pts[0].y / nibY, lineW / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(pts[0].x / nibX, pts[0].y / nibY);
            ctx.lineTo(firstMidX / nibX, firstMidY / nibY);
            for (let i = 1; i < pts.length - 1; i++) {
              const pCur = pts[i];
              const pNext = pts[i + 1];
              const midX = (pCur.x + pNext.x) * 0.5;
              const midY = (pCur.y + pNext.y) * 0.5;
              ctx.quadraticCurveTo(pCur.x / nibX, pCur.y / nibY, midX / nibX, midY / nibY);
            }
            ctx.lineTo(last.x / nibX, last.y / nibY);
            ctx.stroke();
          }
        }
        ctx.restore();
        return;
      }

      const firstMidX = (pts[0].x + pts[1].x) * 0.5;
      const firstMidY = (pts[0].y + pts[1].y) * 0.5;
      const w0 = this.computePenStyleWidth(effBaseSize, pts[0].p, penStyle);
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, w0 / 2, 0, Math.PI * 2);
      ctx.fill();
      let prevMidW = this.computePenStyleWidth(effBaseSize, (pts[0].p + pts[1].p) * 0.5, penStyle);
      this.drawVariableWidthLineSegment(ctx, pts[0].x, pts[0].y, firstMidX, firstMidY, w0, prevMidW);
      let prevMidX = firstMidX;
      let prevMidY = firstMidY;
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) * 0.5;
        const midY = (pts[i].y + pts[i + 1].y) * 0.5;
        const nextMidW = this.computePenStyleWidth(effBaseSize, (pts[i].p + pts[i + 1].p) * 0.5, penStyle);
        this.drawVariableWidthQuadSegment(ctx, prevMidX, prevMidY, pts[i].x, pts[i].y, midX, midY, prevMidW, nextMidW);
        prevMidX = midX;
        prevMidY = midY;
        prevMidW = nextMidW;
      }
      const last = pts[pts.length - 1];
      const wLast = this.computePenStyleWidth(effBaseSize, last.p, penStyle);
      this.drawVariableWidthLineSegment(ctx, prevMidX, prevMidY, last.x, last.y, prevMidW, wLast);
      ctx.restore();
    }

    // 🌟 [서브프레임 0.00ms 즉각 잉크 타격]: requestAnimationFrame 대기조차 없이 pointermove 즉시 캔버스에 증분 캡슐을 박아넣어 펜 끝 지연 0ms 달성!
    drawLiveBezierStep(screenPts, stroke = this.currentInkStroke, isFinalTail = false) {
      if (!stroke || stroke.isHighlighter || !this.ctx || !screenPts || screenPts.length === 0) return;
      const ctx = this.ctx;
      const isBoardInk = (stroke.target || 'board') === 'board';
      const zoomRatio = isBoardInk
        ? ((this.boardZoom || 1.0) / (stroke.boardZoom || 1.0))
        : (stroke.zoom ? (this.zoomLevel / stroke.zoom) : 1.0);
      const rawBaseSize = (stroke.size || 4.2) * zoomRatio;
      const penStyle = stroke.penStyle || 'ballpen';
      const blurVal = Math.max(0, Math.min(5.0, (typeof stroke.softBlur === 'number' && !isNaN(stroke.softBlur)) ? stroke.softBlur : (this.inkSoftBlur || 0)));
      const baseSize = (blurVal > 0) ? rawBaseSize * Math.max(0.76, 1.0 - blurVal * 0.038) : rawBaseSize;
      const dpr = (typeof this.getCanvasDpr === 'function') ? this.getCanvasDpr() : (window.devicePixelRatio || 1);

      const L = screenPts.length;
      const lastPt = screenPts[L - 1];
      const lineW = this.computePenStyleWidth(baseSize, lastPt.p, penStyle);

      const strokeColor = this.isMonochromeMode ? '#000000' : (stroke.color || '#1e293b');
      const isFlatNib = (penStyle === 'flat');
      const nibX = isFlatNib ? 1.38 : 1.0;
      const nibY = isFlatNib ? 0.68 : 1.0;

      const drawPathOnCtx = (color) => {
        ctx.save();
        if (this.isGraphCovered && this.pdfPageBoardData && this._lastPdfPageScreenRect && this._lastPdfPageScreenRect.w > 2) {
          const pr = this._lastPdfPageScreenRect;
          ctx.beginPath();
          ctx.rect(pr.x, pr.y, pr.w, pr.h);
          ctx.clip();
        }
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lineW;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (blurVal > 0) {
          ctx.shadowColor = color;
          ctx.shadowBlur = blurVal * dpr * 0.65;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowBlur = 0;
        }
        if (isFlatNib) {
          ctx.scale(nibX, nibY);
        }

        if (L === 1) {
          ctx.beginPath();
          ctx.arc(lastPt.x / nibX, lastPt.y / nibY, lineW / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (L === 2) {
          const p0 = screenPts[0];
          const p1 = screenPts[1];
          const mx = isFinalTail ? p1.x : (p0.x + p1.x) * 0.5;
          const my = isFinalTail ? p1.y : (p0.y + p1.y) * 0.5;
          if (penStyle === 'ballpen' || penStyle === 'flat') {
            ctx.beginPath();
            ctx.moveTo(p0.x / nibX, p0.y / nibY);
            ctx.lineTo(mx / nibX, my / nibY);
            ctx.stroke();
          } else {
            const w0 = this.computePenStyleWidth(baseSize, p0.p, penStyle);
            const w1 = this.computePenStyleWidth(baseSize, isFinalTail ? p1.p : (p0.p + p1.p) * 0.5, penStyle);
            this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, mx, my, w0, w1);
          }
        } else {
          const pA = screenPts[L - 3];
          const pB = screenPts[L - 2];
          const pC = screenPts[L - 1];
          const mid1X = (pA.x + pB.x) * 0.5;
          const mid1Y = (pA.y + pB.y) * 0.5;
          const mid2X = (pB.x + pC.x) * 0.5;
          const mid2Y = (pB.y + pC.y) * 0.5;
          if (penStyle === 'ballpen' || penStyle === 'flat') {
            ctx.beginPath();
            if (isFinalTail) {
              ctx.moveTo(mid2X / nibX, mid2Y / nibY);
              ctx.lineTo(pC.x / nibX, pC.y / nibY);
            } else {
              ctx.moveTo(mid1X / nibX, mid1Y / nibY);
              ctx.quadraticCurveTo(pB.x / nibX, pB.y / nibY, mid2X / nibX, mid2Y / nibY);
            }
            ctx.stroke();
          } else {
            const wMid1 = this.computePenStyleWidth(baseSize, (pA.p + pB.p) * 0.5, penStyle);
            const wMid2 = this.computePenStyleWidth(baseSize, (pB.p + pC.p) * 0.5, penStyle);
            if (isFinalTail) {
              const wEnd = this.computePenStyleWidth(baseSize, pC.p, penStyle);
              this.drawVariableWidthLineSegment(ctx, mid2X, mid2Y, pC.x, pC.y, wMid2, wEnd);
            } else {
              this.drawVariableWidthQuadSegment(ctx, mid1X, mid1Y, pB.x, pB.y, mid2X, mid2Y, wMid1, wMid2);
            }
          }
        }
        ctx.restore();
      };

      drawPathOnCtx(strokeColor);

      // 다크 테마에서 흰색 문제 카드 영역 위 흰색 펜 자동 반전 처리
      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
      const isLight = curTheme.isLight || this.isMonochromeMode;
      if (isBoardInk && this.hasActiveProblemCard() && !isLight && !this.isMonochromeMode && this.problemCardRect) {
        const c = (stroke.color || '').toLowerCase();
        if (c === '#ffffff' || c === '#fff') {
          const r = this.problemCardRect;
          if (lastPt.x >= r.x - 10 && lastPt.x <= r.x + r.w + 10 && lastPt.y >= r.y - 10 && lastPt.y <= r.y + r.h + 10) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(r.x, r.y, r.w, r.h);
            ctx.clip();
            drawPathOnCtx('#0f172a');
            ctx.restore();
          }
        }
      }
    }

    // 🌟 [PC Savitzky-Golay 룩어헤드(~10px) 시각적 유격 0.00px 제거용 초소형 마이크로 패치 브릿지]:
    // 확정된 다림질 제어점(drawLiveBezierStep) 뒤쪽의 미방출 펜끝 구간(~9px)만 40x40px급 초소형 백업 패치 위에
    // 실시간 연결 렌더링했다가 다음 이벤트에서 0.002ms 만에 복원하여, 완성 곡선 품질은 100% 보존하면서 펜촉 지연을 0ms로 제거!
    _restoreLiveTipPatch() {
      if (!this._hasLiveTipPatch || !this._liveTipPatchCanvas || !this.ctx) {
        this._hasLiveTipPatch = false;
        return;
      }
      const r = this._liveTipPatchRect;
      if (r && r.w > 0 && r.h > 0) {
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(r.x, r.y, r.w, r.h);
        ctx.drawImage(this._liveTipPatchCanvas, 0, 0, r.w, r.h, r.x, r.y, r.w, r.h);
        ctx.restore();
      }
      this._hasLiveTipPatch = false;
    }

    drawLiveTipBridge(committedScreenPts, tipPts, stroke = this.currentInkStroke) {
      if (!stroke || stroke.isHighlighter || !this.canvas || !this.ctx || !committedScreenPts || committedScreenPts.length === 0 || !tipPts || tipPts.length === 0) {
        return;
      }
      const ctx = this.ctx;
      const L = committedScreenPts.length;
      const chain = (L === 1)
        ? [committedScreenPts[0], ...tipPts]
        : [committedScreenPts[L - 2], committedScreenPts[L - 1], ...tipPts];
      if (chain.length < 2) return;

      const isBoardInk = (stroke.target || 'board') === 'board';
      const zoomRatio = isBoardInk
        ? ((this.boardZoom || 1.0) / (stroke.boardZoom || 1.0))
        : (stroke.zoom ? (this.zoomLevel / stroke.zoom) : 1.0);
      const rawBaseSize = (stroke.size || 4.2) * zoomRatio;
      const penStyle = stroke.penStyle || 'ballpen';
      const blurVal = Math.max(0, Math.min(5.0, (typeof stroke.softBlur === 'number' && !isNaN(stroke.softBlur)) ? stroke.softBlur : (this.inkSoftBlur || 0)));
      const baseSize = (blurVal > 0) ? rawBaseSize * Math.max(0.76, 1.0 - blurVal * 0.038) : rawBaseSize;
      const dpr = (typeof this.getCanvasDpr === 'function') ? this.getCanvasDpr() : (window.devicePixelRatio || 1);

      let minX = chain[0].x, maxX = chain[0].x, minY = chain[0].y, maxY = chain[0].y;
      let maxW = this.computePenStyleWidth(baseSize, chain[0].p !== undefined ? chain[0].p : 0.5, penStyle);
      for (let i = 1; i < chain.length; i++) {
        const pt = chain[i];
        if (pt.x < minX) minX = pt.x;
        else if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        else if (pt.y > maxY) maxY = pt.y;
        const wCand = this.computePenStyleWidth(baseSize, pt.p !== undefined ? pt.p : 0.5, penStyle);
        if (wCand > maxW) maxW = wCand;
      }

      const padCss = Math.ceil(maxW * 1.55 + blurVal * 2.2 + 6);
      const px0 = Math.max(0, Math.floor((minX - padCss) * dpr));
      const py0 = Math.max(0, Math.floor((minY - padCss) * dpr));
      const px1 = Math.min(this.canvas.width, Math.ceil((maxX + padCss) * dpr));
      const py1 = Math.min(this.canvas.height, Math.ceil((maxY + padCss) * dpr));
      const pw = px1 - px0;
      const ph = py1 - py0;
      if (pw <= 0 || ph <= 0) return;

      if (!this._liveTipPatchCanvas && typeof document !== 'undefined' && typeof document.createElement === 'function') {
        this._liveTipPatchCanvas = document.createElement('canvas');
        this._liveTipPatchCanvas.width = Math.max(256, pw);
        this._liveTipPatchCanvas.height = Math.max(256, ph);
        this._liveTipPatchCtx = this._liveTipPatchCanvas.getContext('2d');
      }
      if (!this._liveTipPatchCanvas || !this._liveTipPatchCtx) return;
      if (this._liveTipPatchCanvas.width < pw || this._liveTipPatchCanvas.height < ph) {
        this._liveTipPatchCanvas.width = Math.max(this._liveTipPatchCanvas.width, pw + 128);
        this._liveTipPatchCanvas.height = Math.max(this._liveTipPatchCanvas.height, ph + 128);
      }
      const pCtx = this._liveTipPatchCtx;
      pCtx.setTransform(1, 0, 0, 1, 0, 0);
      pCtx.clearRect(0, 0, pw, ph);
      pCtx.drawImage(this.canvas, px0, py0, pw, ph, 0, 0, pw, ph);
      this._liveTipPatchRect = { x: px0, y: py0, w: pw, h: ph };
      this._hasLiveTipPatch = true;

      const strokeColor = this.isMonochromeMode ? '#000000' : (stroke.color || '#1e293b');
      const isFlatNib = (penStyle === 'flat');
      const nibX = isFlatNib ? 1.38 : 1.0;
      const nibY = isFlatNib ? 0.68 : 1.0;
      const isUniform = (penStyle === 'ballpen' || penStyle === 'flat');
      const tipPt = chain[chain.length - 1];
      const uniformW = this.computePenStyleWidth(baseSize, tipPt.p !== undefined ? tipPt.p : 0.5, penStyle);

      const renderTipCurve = (color) => {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (this.isGraphCovered && this.pdfPageBoardData && this._lastPdfPageScreenRect && this._lastPdfPageScreenRect.w > 2) {
          const pr = this._lastPdfPageScreenRect;
          ctx.beginPath();
          ctx.rect(pr.x, pr.y, pr.w, pr.h);
          ctx.clip();
        }
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (blurVal > 0) {
          ctx.shadowColor = color;
          ctx.shadowBlur = blurVal * dpr * 0.65;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowBlur = 0;
        }
        if (isFlatNib) {
          ctx.scale(nibX, nibY);
        }

        const M = chain.length;
        if (isUniform) {
          ctx.lineWidth = uniformW;
          ctx.beginPath();
          if (L === 1) {
            ctx.moveTo(chain[0].x / nibX, chain[0].y / nibY);
            if (M === 2) {
              ctx.lineTo(chain[1].x / nibX, chain[1].y / nibY);
            } else {
              ctx.lineTo(((chain[0].x + chain[1].x) * 0.5) / nibX, ((chain[0].y + chain[1].y) * 0.5) / nibY);
              for (let i = 1; i < M - 1; i++) {
                const mx = (chain[i].x + chain[i + 1].x) * 0.5;
                const my = (chain[i].y + chain[i + 1].y) * 0.5;
                ctx.quadraticCurveTo(chain[i].x / nibX, chain[i].y / nibY, mx / nibX, my / nibY);
              }
              ctx.lineTo(chain[M - 1].x / nibX, chain[M - 1].y / nibY);
            }
          } else {
            const startMx = (chain[0].x + chain[1].x) * 0.5;
            const startMy = (chain[0].y + chain[1].y) * 0.5;
            ctx.moveTo(startMx / nibX, startMy / nibY);
            for (let i = 1; i < M - 1; i++) {
              const mx = (chain[i].x + chain[i + 1].x) * 0.5;
              const my = (chain[i].y + chain[i + 1].y) * 0.5;
              ctx.quadraticCurveTo(chain[i].x / nibX, chain[i].y / nibY, mx / nibX, my / nibY);
            }
            ctx.lineTo(chain[M - 1].x / nibX, chain[M - 1].y / nibY);
          }
          ctx.stroke();
        } else {
          if (L === 1) {
            if (M === 2) {
              const w0 = this.computePenStyleWidth(baseSize, chain[0].p, penStyle);
              const w1 = this.computePenStyleWidth(baseSize, chain[1].p, penStyle);
              this.drawVariableWidthLineSegment(ctx, chain[0].x, chain[0].y, chain[1].x, chain[1].y, w0, w1);
            } else {
              const w0 = this.computePenStyleWidth(baseSize, chain[0].p, penStyle);
              let prevMx = (chain[0].x + chain[1].x) * 0.5;
              let prevMy = (chain[0].y + chain[1].y) * 0.5;
              let prevMw = this.computePenStyleWidth(baseSize, (chain[0].p + chain[1].p) * 0.5, penStyle);
              this.drawVariableWidthLineSegment(ctx, chain[0].x, chain[0].y, prevMx, prevMy, w0, prevMw);
              for (let i = 1; i < M - 1; i++) {
                const mx = (chain[i].x + chain[i + 1].x) * 0.5;
                const my = (chain[i].y + chain[i + 1].y) * 0.5;
                const mw = this.computePenStyleWidth(baseSize, (chain[i].p + chain[i + 1].p) * 0.5, penStyle);
                this.drawVariableWidthQuadSegment(ctx, prevMx, prevMy, chain[i].x, chain[i].y, mx, my, prevMw, mw);
                prevMx = mx;
                prevMy = my;
                prevMw = mw;
              }
              const wEnd = this.computePenStyleWidth(baseSize, chain[M - 1].p, penStyle);
              this.drawVariableWidthLineSegment(ctx, prevMx, prevMy, chain[M - 1].x, chain[M - 1].y, prevMw, wEnd);
            }
          } else {
            let prevMx = (chain[0].x + chain[1].x) * 0.5;
            let prevMy = (chain[0].y + chain[1].y) * 0.5;
            let prevMw = this.computePenStyleWidth(baseSize, (chain[0].p + chain[1].p) * 0.5, penStyle);
            for (let i = 1; i < M - 1; i++) {
              const mx = (chain[i].x + chain[i + 1].x) * 0.5;
              const my = (chain[i].y + chain[i + 1].y) * 0.5;
              const mw = this.computePenStyleWidth(baseSize, (chain[i].p + chain[i + 1].p) * 0.5, penStyle);
              this.drawVariableWidthQuadSegment(ctx, prevMx, prevMy, chain[i].x, chain[i].y, mx, my, prevMw, mw);
              prevMx = mx;
              prevMy = my;
              prevMw = mw;
            }
            const wEnd = this.computePenStyleWidth(baseSize, chain[M - 1].p, penStyle);
            this.drawVariableWidthLineSegment(ctx, prevMx, prevMy, chain[M - 1].x, chain[M - 1].y, prevMw, wEnd);
          }
        }
        ctx.restore();
      };

      renderTipCurve(strokeColor);

      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
      const isLight = curTheme.isLight || this.isMonochromeMode;
      if (isBoardInk && this.hasActiveProblemCard() && !isLight && !this.isMonochromeMode && this.problemCardRect) {
        const c = (stroke.color || '').toLowerCase();
        if (c === '#ffffff' || c === '#fff') {
          const r = this.problemCardRect;
          if (maxX >= r.x - 10 && minX <= r.x + r.w + 10 && maxY >= r.y - 10 && minY <= r.y + r.h + 10) {
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.beginPath();
            ctx.rect(r.x, r.y, r.w, r.h);
            ctx.clip();
            renderTipCurve('#0f172a');
            ctx.restore();
          }
        }
      }
    }

    rebuildInkCache() {
      this.clearInkCache();
      if (!this.inkStrokes || this.inkStrokes.length === 0) {
        this._inkBakeDirty = false;
        return;
      }

      const { padX, padY } = this._getInkBakeMetrics();

      // 🌟 [대표님 피드백: 형광펜 언더레이 2-Pass 베이킹 (검은 글씨 절대 가리지 않음!)] 🌟
      // Pass 1 (하단 레이어): 모든 형광펜(isHighlighter === true) 획을 먼저 바닥에 렌더링
      // Pass 2 (상단 레이어): 일반 펜(!isHighlighter) 획을 그 위에 선명하게 렌더링
      for (let pass = 0; pass < 2; pass++) {
        const wantHighlighter = (pass === 0);
        for (let i = 0; i < this.inkStrokes.length; i++) {
          const stroke = this.inkStrokes[i];
          if (!stroke || stroke === this.currentInkStroke) continue;
          if (this._lassoExcludedBakeSet && this._lassoExcludedBakeSet.has(stroke)) continue;
          if (Boolean(stroke.isHighlighter) !== wantHighlighter) continue;
          const isBoard = (stroke.target || 'board') === 'board';
          if (!isBoard && Boolean(stroke.onPdfBoard) !== Boolean(this.pdfPageBoardData)) continue;
          const targetCtx = isBoard ? this.inkBakeCtx : this.inkGraphBakeCtx;
          if (targetCtx) {
            this.renderSingleStroke(targetCtx, stroke, null, false);
          }
        }
      }

      this._hasBakedStrokes = true;
      this._inkBakeDirty = false;
      this._inkBakeCamera = {
        panX: this.panX || 0,
        panY: this.panY || 0,
        zoomLevel: this.zoomLevel || 1.0,
        boardPanX: this.boardPanX || 0,
        boardPanY: this.boardPanY || 0,
        boardZoom: this.boardZoom || 1.0,
        boardZoomOffsetX: this.boardZoomOffsetX || 0,
        boardZoomOffsetY: this.boardZoomOffsetY || 0,
        padX,
        padY
      };
    }

    _scheduleIdleInkCacheRebuild(delayMs = 350) {
      if (this._idleInkCacheRebuildTimer) {
        clearTimeout(this._idleInkCacheRebuildTimer);
      }
      this._idleInkCacheRebuildTimer = setTimeout(() => {
        this._idleInkCacheRebuildTimer = null;
        if (!this._inkBakeDirty) return;
        const nowT = Date.now();
        if (
          (typeof this.isActivelyWritingOrInteracting === 'function' && this.isActivelyWritingOrInteracting()) ||
          this.isDrawingInk ||
          this._isDrawingCardInk ||
          this.isStylusDrawing ||
          this.isErasingInk ||
          this.isPanning ||
          this.isBoardPanning ||
          this._pinchState ||
          this._isZoomAnimating ||
          this._isWheelZooming ||
          (this._lastPenActiveTime && (nowT - this._lastPenActiveTime < 300))
        ) {
          this._scheduleIdleInkCacheRebuild(180);
          return;
        }
        this.requestRender();
      }, delayMs);
    }

    // 🌟 [pointerup 0.01ms 무차단 반환을 위한 비동기 증분 베이킹 큐]:
    // 빠른 연속 필기(`ㄴ` 받침, `=`, `+` 등) 시 pointerup 내부나 획과 획 사이(100~500ms)에서
    // 오프스크린 캔버스 렌더링과 DOM 버튼(updateUndoRedoUI) 갱신이 다음 획의 pointerdown 수집을 절대 방해하지 않도록,
    // 펜 입력이 완전히 멈춘 유휴 시점(1000ms) 또는 화면 이동/줌(drawInkStrokes) 시점에만 일괄 반영합니다!
    _queueIncrementalStrokeBake(stroke) {
      if (!stroke) return;
      if (!Array.isArray(this._pendingIncrementalBakeStrokes)) {
        this._pendingIncrementalBakeStrokes = [];
      }
      this._pendingIncrementalBakeStrokes.push(stroke);
      if (this.undoStack && this.undoStack.length === 1) {
        this._needsDeferredUndoRedoUiSync = false;
        this.updateUndoRedoUI();
      } else {
        this._needsDeferredUndoRedoUiSync = true;
      }
      if (this._pendingIncrementalBakeTimer) {
        clearTimeout(this._pendingIncrementalBakeTimer);
      }
      const isIPad = this.isIOSOrIPad();
      const idleGuardMs = isIPad ? 900 : 750;
      const retryDelayMs = isIPad ? 600 : 450;
      const initialDelayMs = isIPad ? 1000 : 850;
      const flushWhenIdle = () => {
        this._pendingIncrementalBakeTimer = null;
        const sincePen = this._lastPenActiveTime ? (Date.now() - this._lastPenActiveTime) : 99999;
        const isBusyNow = (typeof this.isActivelyWritingOrInteracting === 'function' && this.isActivelyWritingOrInteracting()) ||
          this.isDrawingInk ||
          this._isDrawingCardInk ||
          this.isStylusDrawing ||
          this.isErasingInk;
        if (isBusyNow || sincePen < idleGuardMs) {
          this._pendingIncrementalBakeTimer = setTimeout(flushWhenIdle, retryDelayMs);
          return;
        }
        this._flushPendingIncrementalBakes();
      };
      this._pendingIncrementalBakeTimer = setTimeout(flushWhenIdle, initialDelayMs);
    }

    _flushPendingIncrementalBakes() {
      if (this._pendingIncrementalBakeTimer) {
        clearTimeout(this._pendingIncrementalBakeTimer);
        this._pendingIncrementalBakeTimer = null;
      }
      if (this._needsDeferredUndoRedoUiSync) {
        this._needsDeferredUndoRedoUiSync = false;
        this.updateUndoRedoUI();
      }
      const queue = this._pendingIncrementalBakeStrokes;
      if (!Array.isArray(queue) || queue.length === 0) return;
      this._pendingIncrementalBakeStrokes = [];

      const { dpr, padX, padY, width: bakeW, height: bakeH } = this._getInkBakeMetrics();
      const needResizeBake = Boolean(
        (this.inkBakeCanvas && (this.inkBakeCanvas.width !== bakeW || this.inkBakeCanvas.height !== bakeH)) ||
        (this.inkGraphBakeCanvas && (this.inkGraphBakeCanvas.width !== bakeW || this.inkGraphBakeCanvas.height !== bakeH))
      );
      if (needResizeBake && this._hasBakedStrokes) {
        this.rebuildInkCache();
        return;
      }
      if (this.inkBakeCanvas && (this.inkBakeCanvas.width !== bakeW || this.inkBakeCanvas.height !== bakeH)) {
        this.inkBakeCanvas.width = bakeW;
        this.inkBakeCanvas.height = bakeH;
        this.inkBakeCtx.setTransform(dpr, 0, 0, dpr, padX * dpr, padY * dpr);
      }
      if (this.inkGraphBakeCanvas && (this.inkGraphBakeCanvas.width !== bakeW || this.inkGraphBakeCanvas.height !== bakeH)) {
        this.inkGraphBakeCanvas.width = bakeW;
        this.inkGraphBakeCanvas.height = bakeH;
        this.inkGraphBakeCtx.setTransform(dpr, 0, 0, dpr, padX * dpr, padY * dpr);
      }

      // 🌟 [필기 직후 2손가락 화면 이동 시 문단 증발 방지]:
      // 이미 베이크된 오프스크린 버퍼(_inkBakeCamera)가 존재하는 상태에서 2손가락 패닝(_inkBakeDirty = true)이 시작되면,
      // 대기열(queue)의 획들을 폐기하지 않고 _inkBakeCamera 기준 좌표계로 오프스크린 버퍼에 즉시 합류시켜
      // 패닝 도중에도 방금 쓴 문단이 단 1프레임도 사라지지 않고 함께 이동하도록 보장합니다!
      const cam = this._inkBakeCamera;
      const savedCam = cam ? {
        panX: this.panX,
        panY: this.panY,
        zoomLevel: this.zoomLevel,
        boardPanX: this.boardPanX,
        boardPanY: this.boardPanY,
        boardZoom: this.boardZoom,
        boardZoomOffsetX: this.boardZoomOffsetX,
        boardZoomOffsetY: this.boardZoomOffsetY
      } : null;

      if (cam) {
        this.panX = cam.panX;
        this.panY = cam.panY;
        this.zoomLevel = cam.zoomLevel;
        this.boardPanX = cam.boardPanX;
        this.boardPanY = cam.boardPanY;
        this.boardZoom = cam.boardZoom;
        this.boardZoomOffsetX = cam.boardZoomOffsetX;
        this.boardZoomOffsetY = cam.boardZoomOffsetY;
      }

      try {
        const strokeSet = this.inkStrokes ? new Set(this.inkStrokes) : null;
        for (let i = 0; i < queue.length; i++) {
          const st = queue[i];
          if (!st || (strokeSet && !strokeSet.has(st))) continue;
          const isBoard = (st.target || 'board') === 'board';
          const targetCtx = isBoard ? this.inkBakeCtx : this.inkGraphBakeCtx;
          if (targetCtx) {
            this.renderSingleStroke(targetCtx, st, null, false);
            this._hasBakedStrokes = true;
          }
        }
      } finally {
        if (savedCam) {
          this.panX = savedCam.panX;
          this.panY = savedCam.panY;
          this.zoomLevel = savedCam.zoomLevel;
          this.boardPanX = savedCam.boardPanX;
          this.boardPanY = savedCam.boardPanY;
          this.boardZoom = savedCam.boardZoom;
          this.boardZoomOffsetX = savedCam.boardZoomOffsetX;
          this.boardZoomOffsetY = savedCam.boardZoomOffsetY;
        }
      }

      if (this._hasBakedStrokes && !this._inkBakeCamera) {
        this._inkBakeCamera = {
          panX: this.panX || 0,
          panY: this.panY || 0,
          zoomLevel: this.zoomLevel || 1.0,
          boardPanX: this.boardPanX || 0,
          boardPanY: this.boardPanY || 0,
          boardZoom: this.boardZoom || 1.0,
          boardZoomOffsetX: this.boardZoomOffsetX || 0,
          boardZoomOffsetY: this.boardZoomOffsetY || 0,
          padX,
          padY
        };
      }
    }

    // 🌟 [메인 칠판·PDF 형광펜 pointerup 0.05ms 단획 증분 합성 판별기]:
    // 완료된 형광펜 획이 기존 일반 펜(!isHighlighter) 획과 화면상 전혀 겹치지 않는 경우(예: PDF 지문 형광펜 밑줄),
    // 수백 개 기존 펜 획을 처음부터 재렌더링(rebuildInkCache)하지 않고 해당 형광펜 1획만 즉시 오프스크린 버퍼에 합성합니다.
    // 단, 일반 펜 획과 바운딩박스가 1px이라도 근접하면 기존 2-Pass 언더레이(형광펜 바닥 깔기)를 100% 그대로 실행합니다!
    _canFastBakeCompletedHighlighter(stroke) {
      if (!stroke || !stroke.isHighlighter || stroke.isShape || stroke.shape) return false;
      if (this._inkBakeDirty || !this._hasBakedStrokes || !this._inkBakeCamera) return false;
      const cam = this._inkBakeCamera;
      if (
        cam.panX !== (this.panX || 0) ||
        cam.panY !== (this.panY || 0) ||
        cam.zoomLevel !== (this.zoomLevel || 1.0) ||
        cam.boardPanX !== (this.boardPanX || 0) ||
        cam.boardPanY !== (this.boardPanY || 0) ||
        cam.boardZoom !== (this.boardZoom || 1.0) ||
        cam.boardZoomOffsetX !== (this.boardZoomOffsetX || 0) ||
        cam.boardZoomOffsetY !== (this.boardZoomOffsetY || 0)
      ) {
        return false;
      }
      const target = stroke.target || 'board';
      const isBoard = (target === 'board');
      const hb = this._getStrokeScreenBounds(stroke, isBoard);
      if (!hb) return false;
      const bz = this.boardZoom || 1.0;
      const hlZoomRatio = isBoard
        ? (bz / (stroke.boardZoom || 1.0))
        : (stroke.zoom ? ((this.zoomLevel || 1.0) / stroke.zoom) : 1.0);
      const hlBase = stroke.highlighterSize ? stroke.highlighterSize : Math.max(10, (stroke.size || 4.2) * 2.6);
      const basePad = Math.max(32, hlBase * hlZoomRatio * 0.6 + 16);
      const strokes = this.inkStrokes || [];
      for (let i = 0; i < strokes.length; i++) {
        const s = strokes[i];
        if (!s || s === stroke || s.isHighlighter) continue;
        const sTarget = s.target || 'board';
        if (sTarget !== target) continue;
        if (!isBoard && Boolean(s.onPdfBoard) !== Boolean(this.pdfPageBoardData)) continue;
        if (s.shape || s.isShape) return false;
        const sb = this._getStrokeScreenBounds(s, isBoard);
        if (!sb) return false;
        const sZoomRatio = isBoard
          ? (bz / (s.boardZoom || 1.0))
          : (s.zoom ? ((this.zoomLevel || 1.0) / s.zoom) : 1.0);
        const pad = basePad + Math.max(8, (s.size || 4.2) * sZoomRatio * 1.4);
        if (
          hb.maxX + pad >= sb.minX &&
          hb.minX - pad <= sb.maxX &&
          hb.maxY + pad >= sb.minY &&
          hb.minY - pad <= sb.maxY
        ) {
          return false;
        }
      }
      return true;
    }

    _getStrokeScreenBounds(stroke, isBoardInk) {
      if (!stroke || !stroke.points || stroke.points.length === 0) return null;
      const pts = stroke.points;
      const n = pts.length;
      const pFirst = pts[0];
      const pMid = pts[n >> 1];
      const pLast = pts[n - 1];
      let rb = stroke._rawBounds;
      if (
        !rb ||
        rb.len !== n ||
        rb.fx !== pFirst.x ||
        rb.fy !== pFirst.y ||
        rb.mx !== pMid.x ||
        rb.my !== pMid.y ||
        rb.lx !== pLast.x ||
        rb.ly !== pLast.y
      ) {
        let minX = pFirst.x, maxX = pFirst.x, minY = pFirst.y, maxY = pFirst.y;
        for (let i = 1; i < n; i++) {
          const px = pts[i].x;
          const py = pts[i].y;
          if (px < minX) minX = px;
          else if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          else if (py > maxY) maxY = py;
        }
        rb = {
          minX, maxX, minY, maxY,
          len: n, fx: pFirst.x, fy: pFirst.y, mx: pMid.x, my: pMid.y, lx: pLast.x, ly: pLast.y
        };
        Object.defineProperty(stroke, '_rawBounds', {
          value: rb,
          writable: true,
          configurable: true,
          enumerable: false
        });
      }
      if (isBoardInk) {
        const bz = this.boardZoom || 1.0;
        const offX = (this.boardZoomOffsetX || 0) + (this.boardPanX || 0);
        const offY = (this.boardZoomOffsetY || 0) + (this.boardPanY || 0);
        return {
          minX: rb.minX * bz + offX,
          maxX: rb.maxX * bz + offX,
          minY: rb.minY * bz + offY,
          maxY: rb.maxY * bz + offY
        };
      }
      const s1 = this.mathToScreen(rb.minX, rb.minY);
      const s2 = this.mathToScreen(rb.maxX, rb.maxY);
      return {
        minX: Math.min(s1.x, s2.x),
        maxX: Math.max(s1.x, s2.x),
        minY: Math.min(s1.y, s2.y),
        maxY: Math.max(s1.y, s2.y)
      };
    }

    _getStrokeVisualScreenBounds(stroke, isBoardInk) {
      if (!stroke) return null;
      const bz = this.boardZoom || 1.0;
      const zoomRatio = isBoardInk
        ? (bz / (stroke.boardZoom || 1.0))
        : (stroke.zoom ? ((this.zoomLevel || 1.0) / stroke.zoom) : 1.0);
      const baseSize = (stroke.size || 4.2) * zoomRatio;
      const dpr = (typeof this.getCanvasDpr === 'function') ? this.getCanvasDpr() : 1;
      const blurVal = (!stroke.isHighlighter && typeof stroke.softBlur === 'number' && stroke.softBlur > 0) ? stroke.softBlur : 0;
      const blurPad = blurVal > 0 ? (blurVal * dpr * 1.5 + 6) : 0;

      let widthPad = baseSize * 1.15;
      if (stroke.isHighlighter) {
        const hlBase = stroke.highlighterSize ? stroke.highlighterSize : Math.max(10, (stroke.size || 4.2) * 2.6);
        widthPad = Math.max(4, hlBase * zoomRatio) * 0.75;
      } else if (stroke.penStyle === 'brush') {
        widthPad = baseSize * 2.1;
      } else if (stroke.penStyle === 'fountain') {
        widthPad = baseSize * 1.35;
      }
      const pad = Math.ceil(widthPad + blurPad + 10);

      if (stroke.shape) {
        const sh = stroke.shape;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const addPt = (pt) => {
          if (!pt) return;
          const sp = isBoardInk ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y);
          if (sp.x < minX) minX = sp.x;
          if (sp.x > maxX) maxX = sp.x;
          if (sp.y < minY) minY = sp.y;
          if (sp.y > maxY) maxY = sp.y;
        };
        if (sh.type === 'line' && sh.start && sh.end) {
          addPt(sh.start);
          addPt(sh.end);
        } else if (sh.type === 'circle' && sh.center) {
          const sc = isBoardInk ? this.boardToScreen(sh.center.x, sh.center.y) : this.mathToScreen(sh.center.x, sh.center.y);
          const sr = isBoardInk ? (sh.radius * bz) : Math.abs(this.mathToScreen(sh.center.x + sh.radius, sh.center.y).x - sc.x);
          minX = sc.x - sr; maxX = sc.x + sr;
          minY = sc.y - sr; maxY = sc.y + sr;
        } else if (sh.type === 'ellipse' && sh.center) {
          const sc = isBoardInk ? this.boardToScreen(sh.center.x, sh.center.y) : this.mathToScreen(sh.center.x, sh.center.y);
          const srx = isBoardInk ? (sh.rx * bz) : Math.abs(this.mathToScreen(sh.center.x + sh.rx, sh.center.y).x - sc.x);
          const sry = isBoardInk ? (sh.ry * bz) : Math.abs(this.mathToScreen(sh.center.x, sh.center.y + sh.ry).y - sc.y);
          minX = sc.x - srx; maxX = sc.x + srx;
          minY = sc.y - sry; maxY = sc.y + sry;
        } else if (sh.type === 'rect' && sh.min && sh.max) {
          addPt(sh.min);
          addPt(sh.max);
        } else if (Array.isArray(sh.pts)) {
          for (let i = 0; i < sh.pts.length; i++) addPt(sh.pts[i]);
        }
        if (Number.isFinite(minX) && Number.isFinite(maxX)) {
          return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
        }
      }

      const sb = this._getStrokeScreenBounds(stroke, isBoardInk);
      if (!sb) return null;
      return {
        minX: sb.minX - pad,
        maxX: sb.maxX + pad,
        minY: sb.minY - pad,
        maxY: sb.maxY + pad
      };
    }

    // 🌟 [다량 필기 시 지우개 0.2ms 국소 클립 패치 엔진 (Dirty-Rect Scissor Cache Patch)]:
    // 수백~수천 획이 쌓인 상태에서 지우개로 문지를 때 매 프레임 2,500만 픽셀 전체를 지우고 전수 리빌드하지 않고,
    // 방금 지워진 획의 바운딩박스 영역만 오프스크린 베이크 버퍼에서 국소 clearRect + 겹치는 이웃 획만 2-Pass 재합성!
    _patchInkCacheForRemovedStrokes(removedBatch) {
      if (!Array.isArray(removedBatch) || removedBatch.length === 0) return true;

      if (Array.isArray(this._pendingIncrementalBakeStrokes) && this._pendingIncrementalBakeStrokes.length > 0) {
        const removedSet = new Set();
        for (let i = 0; i < removedBatch.length; i++) {
          if (removedBatch[i] && removedBatch[i].stroke) removedSet.add(removedBatch[i].stroke);
        }
        this._pendingIncrementalBakeStrokes = this._pendingIncrementalBakeStrokes.filter(st => st && !removedSet.has(st));
        if (this._pendingIncrementalBakeStrokes.length > 0 && !this._inkBakeDirty) {
          this._flushPendingIncrementalBakes();
        }
      }

      if (!this.inkStrokes || this.inkStrokes.length === 0) {
        this.clearInkCache();
        this._inkBakeDirty = false;
        return true;
      }

      if (this._inkBakeDirty || !this._hasBakedStrokes || !this._inkBakeCamera) {
        return false;
      }

      const { dpr, sw, sh, padX, padY, width: bakeW, height: bakeH } = this._getInkBakeMetrics();
      const cam = this._inkBakeCamera;
      if (
        cam.panX !== (this.panX || 0) ||
        cam.panY !== (this.panY || 0) ||
        cam.zoomLevel !== (this.zoomLevel || 1.0) ||
        cam.boardPanX !== (this.boardPanX || 0) ||
        cam.boardPanY !== (this.boardPanY || 0) ||
        cam.boardZoom !== (this.boardZoom || 1.0) ||
        cam.boardZoomOffsetX !== (this.boardZoomOffsetX || 0) ||
        cam.boardZoomOffsetY !== (this.boardZoomOffsetY || 0) ||
        cam.padX !== padX ||
        cam.padY !== padY ||
        !this.inkBakeCanvas || this.inkBakeCanvas.width !== bakeW || this.inkBakeCanvas.height !== bakeH ||
        !this.inkGraphBakeCanvas || this.inkGraphBakeCanvas.width !== bakeW || this.inkGraphBakeCanvas.height !== bakeH
      ) {
        return false;
      }

      let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
      let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
      let hasBoardRemoved = false;
      let hasGraphRemoved = false;

      for (let i = 0; i < removedBatch.length; i++) {
        const st = removedBatch[i] && removedBatch[i].stroke;
        if (!st) continue;
        const isBoard = (st.target || 'board') === 'board';
        if (!isBoard && Boolean(st.onPdfBoard) !== Boolean(this.pdfPageBoardData)) continue;
        const vb = this._getStrokeVisualScreenBounds(st, isBoard);
        if (!vb) return false;
        if (isBoard) {
          hasBoardRemoved = true;
          if (vb.minX < bMinX) bMinX = vb.minX;
          if (vb.maxX > bMaxX) bMaxX = vb.maxX;
          if (vb.minY < bMinY) bMinY = vb.minY;
          if (vb.maxY > bMaxY) bMaxY = vb.maxY;
        } else {
          hasGraphRemoved = true;
          if (vb.minX < gMinX) gMinX = vb.minX;
          if (vb.maxX > gMaxX) gMaxX = vb.maxX;
          if (vb.minY < gMinY) gMinY = vb.minY;
          if (vb.maxY > gMaxY) gMaxY = vb.maxY;
        }
      }

      const minLimX = -padX - 2;
      const maxLimX = sw + padX + 2;
      const minLimY = -padY - 2;
      const maxLimY = sh + padY + 2;

      if (hasBoardRemoved && this.inkBakeCtx) {
        const cx0 = Math.max(minLimX, Math.floor(bMinX));
        const cy0 = Math.max(minLimY, Math.floor(bMinY));
        const cx1 = Math.min(maxLimX, Math.ceil(bMaxX));
        const cy1 = Math.min(maxLimY, Math.ceil(bMaxY));
        if (cx1 > cx0 && cy1 > cy0) {
          const bCtx = this.inkBakeCtx;
          bCtx.save();
          bCtx.setTransform(dpr, 0, 0, dpr, padX * dpr, padY * dpr);
          bCtx.beginPath();
          bCtx.rect(cx0, cy0, cx1 - cx0, cy1 - cy0);
          bCtx.clip();
          bCtx.clearRect(cx0 - 1, cy0 - 1, (cx1 - cx0) + 2, (cy1 - cy0) + 2);
          for (let pass = 0; pass < 2; pass++) {
            const wantHl = (pass === 0);
            for (let i = 0; i < this.inkStrokes.length; i++) {
              const st = this.inkStrokes[i];
              if (!st || st === this.currentInkStroke) continue;
              if (this._lassoExcludedBakeSet && this._lassoExcludedBakeSet.has(st)) continue;
              if (Boolean(st.isHighlighter) !== wantHl) continue;
              if ((st.target || 'board') !== 'board') continue;
              const vb = this._getStrokeVisualScreenBounds(st, true);
              if (vb && (vb.maxX < cx0 || vb.minX > cx1 || vb.maxY < cy0 || vb.minY > cy1)) continue;
              this.renderSingleStroke(bCtx, st, null, false);
            }
          }
          bCtx.restore();
        }
      }

      if (hasGraphRemoved && this.inkGraphBakeCtx) {
        const cx0 = Math.max(minLimX, Math.floor(gMinX));
        const cy0 = Math.max(minLimY, Math.floor(gMinY));
        const cx1 = Math.min(maxLimX, Math.ceil(gMaxX));
        const cy1 = Math.min(maxLimY, Math.ceil(gMaxY));
        if (cx1 > cx0 && cy1 > cy0) {
          const gCtx = this.inkGraphBakeCtx;
          gCtx.save();
          gCtx.setTransform(dpr, 0, 0, dpr, padX * dpr, padY * dpr);
          gCtx.beginPath();
          gCtx.rect(cx0, cy0, cx1 - cx0, cy1 - cy0);
          gCtx.clip();
          gCtx.clearRect(cx0 - 1, cy0 - 1, (cx1 - cx0) + 2, (cy1 - cy0) + 2);
          for (let pass = 0; pass < 2; pass++) {
            const wantHl = (pass === 0);
            for (let i = 0; i < this.inkStrokes.length; i++) {
              const st = this.inkStrokes[i];
              if (!st || st === this.currentInkStroke) continue;
              if (this._lassoExcludedBakeSet && this._lassoExcludedBakeSet.has(st)) continue;
              if (Boolean(st.isHighlighter) !== wantHl) continue;
              if ((st.target || 'board') !== 'graph') continue;
              if (Boolean(st.onPdfBoard) !== Boolean(this.pdfPageBoardData)) continue;
              const vb = this._getStrokeVisualScreenBounds(st, false);
              if (vb && (vb.maxX < cx0 || vb.minX > cx1 || vb.maxY < cy0 || vb.minY > cy1)) continue;
              this.renderSingleStroke(gCtx, st, null, false);
            }
          }
          gCtx.restore();
        }
      }

      return true;
    }

    _getScratchPointArray(len, slot = 0) {
      if (!this._scratchPtSlots) {
        this._scratchPtSlots = [
          { pool: [], view: [] },
          { pool: [], view: [] },
          { pool: [], view: [] }
        ];
      }
      const entry = this._scratchPtSlots[slot] || (this._scratchPtSlots[slot] = { pool: [], view: [] });
      const pool = entry.pool;
      while (pool.length < len) {
        pool.push({ x: 0, y: 0, p: 0.5 });
      }
      const view = entry.view;
      view.length = len;
      for (let i = 0; i < len; i++) {
        view[i] = pool[i];
      }
      return view;
    }

    renderSingleStroke(targetCtx, stroke, forceColor = null, isLiveDrawing = false) {
      if (!stroke || !stroke.points || stroke.points.length === 0) return;

      const isBoardInk = (stroke.target || 'board') === 'board';
      const bz = this.boardZoom || 1.0;
      const zoomRatio = isBoardInk
        ? (bz / (stroke.boardZoom || 1.0))
        : (stroke.zoom ? (this.zoomLevel / stroke.zoom) : 1.0);
      const baseSize = (stroke.size || 4.2) * zoomRatio;

      // 🌟 [화면/오버스캔 영역 밖 필기 0.001ms 즉시 스킵 (Viewport Bounding-Box Culling)]:
      // 칠판을 넓게 쓰거나 확대했을 때 현재 화면(또는 오버스캔 베이크 영역) 바깥에 있는 획은
      // 배열 할당 및 베지어 드로우콜을 100% 생략하여 필기가 수백 획 쌓여도 일정한 속도를 보장합니다.
      if (!isLiveDrawing && !stroke.shape && (targetCtx === this.ctx || targetCtx === this.inkBakeCtx || targetCtx === this.inkGraphBakeCtx)) {
        const sb = this._getStrokeScreenBounds(stroke, isBoardInk);
        if (sb) {
          const isBakeTarget = (targetCtx === this.inkBakeCtx || targetCtx === this.inkGraphBakeCtx);
          const sw = this.screenWidth || 1280;
          const sh = this.screenHeight || 720;
          const padX = isBakeTarget ? 540 : 0;
          const padY = isBakeTarget ? 540 : 0;
          const margin = Math.max(48, baseSize * 4);
          if (
            sb.maxX < -padX - margin ||
            sb.minX > sw + padX + margin ||
            sb.maxY < -padY - margin ||
            sb.minY > sh + padY + margin
          ) {
            return;
          }
        }
      }

      targetCtx.save();
      targetCtx.lineCap = 'round';
      targetCtx.lineJoin = 'round';

      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
      const isLight = curTheme.isLight || this.isMonochromeMode;

      let strokeColor = forceColor || stroke.color;
      if (this.isMonochromeMode) {
        strokeColor = stroke.isHighlighter ? '#cbd5e1' : '#000000';
      } else if (stroke.isHighlighter) {
        // 🌟 [스마트 형광펜 컬러 매핑]: 검은 펜(#1e293b)으로 필기하다 형광펜만 눌러도 즉시 영롱한 노란 형광펜(#facc15) 발색!
        const rawLower = (strokeColor || '').toLowerCase();
        if (rawLower === '#1e293b' || rawLower === '#000000' || rawLower === '#0f172a' || rawLower === '#2d3436' || rawLower === '#ffffff' || rawLower === '#fff') {
          strokeColor = isLight ? '#facc15' : '#fde047';
        } else if (rawLower === '#2563eb') {
          strokeColor = '#38bdf8';
        } else if (rawLower === '#dc2626') {
          strokeColor = '#fb7185';
        } else if (rawLower === '#16a34a') {
          strokeColor = '#4ade80';
        } else if (rawLower === '#7c3aed') {
          strokeColor = '#c084fc';
        }
      }

      targetCtx.strokeStyle = strokeColor;

      const ghostMul = (typeof stroke._ghostAlpha === 'number') ? stroke._ghostAlpha : 1.0;
      if (stroke.isHighlighter) {
        targetCtx.globalAlpha = (isLight ? 0.36 : 0.34) * ghostMul;
        if (isLight && !this.isMonochromeMode) {
          targetCtx.globalCompositeOperation = 'multiply';
        }
        const hlBase = stroke.highlighterSize ? stroke.highlighterSize : Math.max(10, (stroke.size || 4.2) * 2.6);
        targetCtx.lineWidth = Math.max(4, hlBase * zoomRatio);
      } else {
        targetCtx.globalAlpha = 1.0 * ghostMul;
      }

      // 🌟 Draw & Hold 기하 도형 & 수학 곡선 렌더링 (직선, 정원, 타원, 직사각형, 삼각형, 이차함수 포물선, 삼차/삼각 개형) 🌟
      if (stroke.shape) {
        const shapeBaseSize = (stroke.size || 3) * zoomRatio;
        // PC · 아이패드 통일된 펜 굵기(1.0x)와 이질감 없이 매칭되는 도형 선 굵기(0.95배)
        const hlShapeBase = stroke.highlighterSize ? (stroke.highlighterSize * zoomRatio) : Math.max(8, shapeBaseSize * 2.5);
        targetCtx.lineWidth = stroke.isHighlighter ? Math.max(4, hlShapeBase) : Math.max(1.2, shapeBaseSize * 0.95);
        targetCtx.strokeStyle = strokeColor;

        if (stroke.shape.type === 'line') {
          const s1 = isBoardInk ? this.boardToScreen(stroke.shape.start.x, stroke.shape.start.y) : this.mathToScreen(stroke.shape.start.x, stroke.shape.start.y);
          const s2 = isBoardInk ? this.boardToScreen(stroke.shape.end.x, stroke.shape.end.y) : this.mathToScreen(stroke.shape.end.x, stroke.shape.end.y);
          targetCtx.beginPath();
          targetCtx.moveTo(s1.x, s1.y);
          targetCtx.lineTo(s2.x, s2.y);
          targetCtx.stroke();
          targetCtx.restore();
          return;
        } else if (stroke.shape.type === 'circle') {
          const sc = isBoardInk ? this.boardToScreen(stroke.shape.center.x, stroke.shape.center.y) : this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y);
          const sr = isBoardInk ? (stroke.shape.radius * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x + stroke.shape.radius, stroke.shape.center.y).x - sc.x);
          targetCtx.beginPath();
          targetCtx.arc(sc.x, sc.y, Math.max(2, sr), 0, Math.PI * 2);
          targetCtx.stroke();
          targetCtx.restore();
          return;
        } else if (stroke.shape.type === 'ellipse') {
          const sc = isBoardInk ? this.boardToScreen(stroke.shape.center.x, stroke.shape.center.y) : this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y);
          const srx = isBoardInk ? (stroke.shape.rx * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x + stroke.shape.rx, stroke.shape.center.y).x - sc.x);
          const sry = isBoardInk ? (stroke.shape.ry * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y + stroke.shape.ry).y - sc.y);
          targetCtx.beginPath();
          targetCtx.ellipse(sc.x, sc.y, Math.max(2, srx), Math.max(2, sry), 0, 0, Math.PI * 2);
          targetCtx.stroke();
          targetCtx.restore();
          return;
        } else if (stroke.shape.type === 'rect') {
          const s1 = isBoardInk ? this.boardToScreen(stroke.shape.min.x, stroke.shape.min.y) : this.mathToScreen(stroke.shape.min.x, stroke.shape.min.y);
          const s2 = isBoardInk ? this.boardToScreen(stroke.shape.max.x, stroke.shape.max.y) : this.mathToScreen(stroke.shape.max.x, stroke.shape.max.y);
          const rx = Math.min(s1.x, s2.x);
          const ry = Math.min(s1.y, s2.y);
          const rw = Math.abs(s2.x - s1.x);
          const rh = Math.abs(s2.y - s1.y);
          targetCtx.beginPath();
          targetCtx.rect(rx, ry, rw, rh);
          targetCtx.stroke();
          targetCtx.restore();
          return;
        } else if (stroke.shape.pts && stroke.shape.pts.length >= 2) {
          const sPts = stroke.shape.pts.map(pt => isBoardInk ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y));
          targetCtx.beginPath();
          targetCtx.moveTo(sPts[0].x, sPts[0].y);
          for (let i = 1; i < sPts.length; i++) {
            targetCtx.lineTo(sPts[i].x, sPts[i].y);
          }
          if (stroke.shape.closed) {
            targetCtx.closePath();
          }
          targetCtx.stroke();
          targetCtx.restore();
          return;
        }
      }

      const srcPts = stroke.points;
      const nPts = srcPts.length;
      const pts = this._getScratchPointArray(nPts, 0);
      if (isBoardInk) {
        const offX = (this.boardZoomOffsetX || 0) + (this.boardPanX || 0);
        const offY = (this.boardZoomOffsetY || 0) + (this.boardPanY || 0);
        for (let i = 0; i < nPts; i++) {
          const pt = srcPts[i];
          const outPt = pts[i];
          outPt.x = pt.x * bz + offX;
          outPt.y = pt.y * bz + offY;
          outPt.p = (pt.p !== undefined ? pt.p : 0.5);
        }
      } else {
        const orig = this.mathToScreen(0, 0);
        const unit = this.mathToScreen(1, 1);
        const scaleX = unit.x - orig.x;
        const scaleY = unit.y - orig.y;
        for (let i = 0; i < nPts; i++) {
          const pt = srcPts[i];
          const outPt = pts[i];
          outPt.x = orig.x + pt.x * scaleX;
          outPt.y = orig.y + pt.y * scaleY;
          outPt.p = (pt.p !== undefined ? pt.p : 0.5);
        }
      }

      const penStyle = stroke.isHighlighter ? 'ballpen' : (stroke.penStyle || 'ballpen');

      if (!stroke.isHighlighter) {
        targetCtx.lineWidth = this.computePenStyleWidth(baseSize, pts[0].p, penStyle);
      }

      targetCtx.fillStyle = strokeColor;
      targetCtx.strokeStyle = strokeColor;
      targetCtx.lineCap = 'round';
      targetCtx.lineJoin = 'round';
      targetCtx.shadowBlur = 0;
      targetCtx.shadowOffsetX = 0;
      targetCtx.shadowOffsetY = 0;

      this.drawPenStyledPointArray(
        targetCtx,
        pts,
        stroke.isHighlighter ? targetCtx.lineWidth : baseSize,
        penStyle,
        stroke.softBlur,
        Boolean(stroke.isHighlighter)
      );

      targetCtx.restore();
    }

    _getVisibleWhiteProblemCardScreenRects(isExport = false) {
      const rects = [];
      if (isExport && this._activeExportFilter && this._activeExportFilter.includeProblem === false) {
        return rects;
      }
      const hasPrimaryProb = (typeof this.hasActiveProblemCard === 'function') && this.hasActiveProblemCard();
      const hasExtraProb = Array.isArray(this.extraProblemCards) && this.extraProblemCards.length > 0;
      if (!hasPrimaryProb && !hasExtraProb) {
        return rects;
      }

      // 🌟 [강제 동기 레이아웃 리플로우(Forced Reflow) 0회 캐시]:
      // 지우개/렌더링 매 프레임마다 getBoundingClientRect()를 호출하면 브라우저가 DOM 전체 레이아웃을 강제 재계산하므로,
      // 카드 이동/리사이즈 중이 아닐 때는 순수 JS 스타일 시그니처가 바뀌었을 때만 측정하고 평소에는 0.000ms 캐시를 반환!
      if (!isExport && !this._isDraggingOrResizingAnyCard) {
        const pWidget = (hasPrimaryProb && typeof document !== 'undefined') ? document.getElementById('problemCardWidget') : null;
        let layoutSig = `${this.screenWidth || 0}|${this.screenHeight || 0}|${this.boardPanX || 0}|${this.boardPanY || 0}|${this.boardZoom || 1}`;
        if (pWidget) {
          const pMin = (pWidget.classList && pWidget.classList.contains('minimized')) ? 1 : 0;
          const pr = this.problemCardRect;
          layoutSig += `|P:${pWidget.style ? pWidget.style.display : ''},${pWidget.style ? pWidget.style.left : ''},${pWidget.style ? pWidget.style.top : ''},${pWidget.style ? pWidget.style.width : ''},${pWidget.style ? pWidget.style.transform : ''},${pMin},${pr ? Math.round(pr.h) : 0}`;
        }
        if (hasExtraProb) {
          for (let i = 0; i < this.extraProblemCards.length; i++) {
            const ep = this.extraProblemCards[i];
            const el = ep && ep.el;
            if (!el) continue;
            const eMin = (el.classList && el.classList.contains('minimized')) ? 1 : 0;
            layoutSig += `|E${i}:${el.style ? el.style.display : ''},${el.style ? el.style.left : ''},${el.style ? el.style.top : ''},${el.style ? el.style.width : ''},${el.style ? el.style.transform : ''},${eMin}`;
          }
        }
        if (this._whiteCardRectsCacheSig === layoutSig && Array.isArray(this._whiteCardRectsCacheVal)) {
          return this._whiteCardRectsCacheVal;
        }
        this._whiteCardRectsCacheSig = layoutSig;
      } else if (!isExport) {
        this._whiteCardRectsCacheSig = null;
      }

      const offX = (isExport && this._exportCropOffset && typeof this._exportCropOffset.x === 'number') ? this._exportCropOffset.x : 0;
      const offY = (isExport && this._exportCropOffset && typeof this._exportCropOffset.y === 'number') ? this._exportCropOffset.y : 0;
      const canvasRect = (this.canvas && typeof this.canvas.getBoundingClientRect === 'function')
        ? this.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };

      const addBodyRect = (widgetEl, fallbackRect = null) => {
        if (widgetEl && typeof document !== 'undefined') {
          if (widgetEl.style && widgetEl.style.display === 'none') return;
          if (widgetEl.classList && widgetEl.classList.contains('minimized')) return;
          const bodyEl = widgetEl.querySelector ? widgetEl.querySelector('.problem-card-body') : null;
          if (bodyEl && typeof bodyEl.getBoundingClientRect === 'function') {
            const bRect = bodyEl.getBoundingClientRect();
            if (bRect.width > 2 && bRect.height > 2) {
              rects.push({
                x: bRect.left - canvasRect.left - offX,
                y: bRect.top - canvasRect.top - offY,
                w: bRect.width,
                h: bRect.height
              });
              return;
            }
          }
        }
        if (fallbackRect && fallbackRect.w > 2 && fallbackRect.h > 2) {
          rects.push({
            x: fallbackRect.x - offX,
            y: fallbackRect.y - offY,
            w: fallbackRect.w,
            h: fallbackRect.h
          });
        }
      };

      if (hasPrimaryProb) {
        const pWidget = (typeof document !== 'undefined') ? document.getElementById('problemCardWidget') : null;
        addBodyRect(pWidget, this.problemCardRect);
      }
      if (hasExtraProb) {
        for (let i = 0; i < this.extraProblemCards.length; i++) {
          const ep = this.extraProblemCards[i];
          if (ep && ep.el) addBodyRect(ep.el, ep.rect || null);
        }
      }
      if (!isExport && this._whiteCardRectsCacheSig) {
        this._whiteCardRectsCacheVal = rects;
      }
      return rects;
    }

    _isWhiteBoardContrastStroke(s) {
      if (!s || (s.target || 'board') !== 'board' || s.isHighlighter) return false;
      const c = s.color;
      if (!c) return false;
      if (c === '#ffffff' || c === '#fff' || c === '#FFFFFF' || c === '#FFF') return Boolean(s.points && s.points.length > 0);
      const col = c.toLowerCase();
      return (col === '#ffffff' || col === '#fff') && Boolean(s.points && s.points.length > 0);
    }

    _drawWhiteBoardInkContrastOverProblemCards(ctx, strokesList, isExport = false, extraLiveStroke = null) {
      const hasList = Array.isArray(strokesList) && strokesList.length > 0;
      const hasExtra = this._isWhiteBoardContrastStroke(extraLiveStroke);
      if (!hasList && !hasExtra) return;

      const hasPrimaryProb = (typeof this.hasActiveProblemCard === 'function') && this.hasActiveProblemCard();
      const hasExtraProb = Array.isArray(this.extraProblemCards) && this.extraProblemCards.length > 0;
      if (!hasPrimaryProb && !hasExtraProb) return;

      let anyWhite = hasExtra;
      if (!anyWhite && hasList) {
        for (let i = 0; i < strokesList.length; i++) {
          if (this._isWhiteBoardContrastStroke(strokesList[i])) {
            anyWhite = true;
            break;
          }
        }
      }
      if (!anyWhite) return;

      const cardRects = this._getVisibleWhiteProblemCardScreenRects(isExport);
      if (cardRects.length === 0) return;

      for (let rIdx = 0; rIdx < cardRects.length; rIdx++) {
        const r = cardRects[rIdx];
        let clipped = false;
        const drawIfOverlaps = (st, forceLive = false) => {
          if (!this._isWhiteBoardContrastStroke(st)) return;
          if (typeof this._getStrokeScreenBounds === 'function') {
            const sb = this._getStrokeScreenBounds(st, true);
            if (sb && (sb.maxX < r.x || sb.minX > r.x + r.w || sb.maxY < r.y || sb.minY > r.y + r.h)) {
              return;
            }
          }
          if (!clipped) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(r.x, r.y, r.w, r.h);
            ctx.clip();
            clipped = true;
          }
          this.renderSingleStroke(ctx, st, '#0f172a', forceLive || (!isExport && st === this.currentInkStroke));
        };
        if (hasList) {
          for (let i = 0; i < strokesList.length; i++) {
            const st = strokesList[i];
            if (extraLiveStroke && st === extraLiveStroke) continue;
            drawIfOverlaps(st, false);
          }
        }
        if (hasExtra) {
          drawIfOverlaps(extraLiveStroke, true);
        }
        if (clipped) {
          ctx.restore();
        }
      }
    }

    drawInkStrokes(ctx, isExport = false, filterTarget = null) {
      if (isExport) {
        if (!this.inkStrokes || this.inkStrokes.length === 0) return;
        const curThemeExp = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || { isLight: false };
        const isLightExp = Boolean(curThemeExp.isLight || this.isMonochromeMode);
        const darkTransparentContrast = Boolean(this.exportTransparent && !isLightExp && !this.isMonochromeMode);
        const resolveExpOverride = (stroke) => {
          if (!darkTransparentContrast || !stroke || stroke.isHighlighter) return null;
          const c = (stroke.color || '').toLowerCase();
          return (c === '#ffffff' || c === '#fff') ? '#1e293b' : null;
        };
        const strokesToDraw = filterTarget
          ? this.inkStrokes.filter(s => {
            const t = s.target || 'board';
            if (t !== filterTarget) return false;
            if (t === 'graph' && Boolean(s.onPdfBoard) !== Boolean(this.pdfPageBoardData)) return false;
            return true;
          })
          : this.inkStrokes;
        strokesToDraw.filter(s => s && s.isHighlighter).forEach(stroke => this.renderSingleStroke(ctx, stroke, null, false));
        strokesToDraw.filter(s => s && !s.isHighlighter).forEach(stroke => this.renderSingleStroke(ctx, stroke, resolveExpOverride(stroke), false));
        if ((!filterTarget || filterTarget === 'board') && !isLightExp && !this.isMonochromeMode && !this.exportTransparent) {
          this._drawWhiteBoardInkContrastOverProblemCards(ctx, strokesToDraw, true);
        }
        return;
      }

      // 🌟 [실시간 음성·필기·펜포인터 동기화 리플레이 패스] 🌟
      if (this._isAudioReplayActive && this.audioSyncData) {
        this._drawAudioReplayInkStrokes(ctx, filterTarget);
        return;
      }

      // 🌟 [초기 빈 화면 / 필기 없음 0.000ms 패스트패스]:
      // 완료된 필기 획(inkStrokes)도 없고 실시간 드로잉 중(currentInkStroke)도 아닐 때는
      // 오프스크린 캔버스 전체 화면 clearRect 및 GPU 텍스처 Blit(drawImage)을 100% 생략!
      const hasCompletedStrokes = Boolean(this.inkStrokes && this.inkStrokes.length > 0);
      const hasLiveStroke = Boolean(this.isDrawingInk && this.currentInkStroke);
      if (!hasCompletedStrokes && !hasLiveStroke) {
        if (this._hasBakedStrokes) {
          this.clearInkCache();
        }
        this._inkBakeDirty = false;
        return;
      }

      // 올가미 드래그/리사이즈가 어떤 경로로든 종료된 경우 제외 집합을 자동 해제하여 누락 가능성을 0%로 차단
      if (this._lassoExcludedBakeSet && !this.isDraggingLassoSelection && !this.isResizingLassoSelection) {
        this._lassoExcludedBakeSet = null;
        this._inkBakeDirty = true;
      }

      // 🌟 [오프스크린 오버스캔(Overscan) 베이크 버퍼 리빌드 & 팬/핀치/줌 중 0.02ms GPU 텍스처 변환 패스트패스] 🌟
      // 두 손가락 이동/핀치나 화면 패닝/휠 줌 도중에는 rebuildInkCache()를 중간에 동기 호출하지 않고
      // GPU 텍스처 행렬(setTransform + drawImage)만으로 60~120fps 무렉 변환하며, 손을 떼거나 줌이 멈추는 순간 선명하게 리빌드합니다!
      const isActivelyMovingCamera = Boolean(
        this._pinchState ||
        this.isPanning ||
        this.isBoardPanning ||
        this._isZoomAnimating ||
        this._isWheelZooming
      );
      const { dpr, sw, sh, padX: curPadX, padY: curPadY } = this._getInkBakeMetrics();
      const needRebakeNow = Boolean(this._inkBakeDirty && (!isActivelyMovingCamera || !this._hasBakedStrokes || !this._inkBakeCamera));
      if (needRebakeNow) {
        this.rebuildInkCache();
      } else if (this._pendingIncrementalBakeStrokes && this._pendingIncrementalBakeStrokes.length > 0) {
        this._flushPendingIncrementalBakes();
      }

      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
      const isLight = curTheme.isLight || this.isMonochromeMode;
      const bakeCam = this._inkBakeCamera;
      const bPadX = (bakeCam && typeof bakeCam.padX === 'number') ? bakeCam.padX : curPadX;
      const bPadY = (bakeCam && typeof bakeCam.padY === 'number') ? bakeCam.padY : curPadY;
      const hasLassoLiveOverlay = Boolean(
        this._lassoExcludedBakeSet &&
        this._lassoExcludedBakeSet.size > 0 &&
        Array.isArray(this.selectedInkStrokes) &&
        this.selectedInkStrokes.length > 0
      );

      // 🌟 [144Hz 초고속 0.02ms GPU Blit]: 칠판 바깥창 판서 ('board')
      if (!filterTarget || filterTarget === 'board') {
        if (this.inkBakeCanvas) {
          if (ctx === this.ctx) {
            ctx.save();
            if (bakeCam && this._inkBakeDirty) {
              const bz0 = bakeCam.boardZoom || 1.0;
              const bz1 = this.boardZoom || 1.0;
              const sB = bz1 / bz0;
              const txB = ((this.boardPanX || 0) + (this.boardZoomOffsetX || 0)) - ((bakeCam.boardPanX || 0) + (bakeCam.boardZoomOffsetX || 0)) * sB;
              const tyB = ((this.boardPanY || 0) + (this.boardZoomOffsetY || 0)) - ((bakeCam.boardPanY || 0) + (bakeCam.boardZoomOffsetY || 0)) * sB;
              ctx.setTransform(sB, 0, 0, sB, (txB - bPadX * sB) * dpr, (tyB - bPadY * sB) * dpr);
            } else {
              ctx.setTransform(1, 0, 0, 1, -bPadX * dpr, -bPadY * dpr);
            }
            ctx.drawImage(this.inkBakeCanvas, 0, 0);
            ctx.restore();
          } else {
            ctx.drawImage(this.inkBakeCanvas, -bPadX, -bPadY, sw + bPadX * 2, sh + bPadY * 2);
          }
        }
        if (hasLassoLiveOverlay) {
          for (let pass = 0; pass < 2; pass++) {
            const wantHl = (pass === 0);
            for (let i = 0; i < this.selectedInkStrokes.length; i++) {
              const st = this.selectedInkStrokes[i];
              if (!st || (st.target || 'board') !== 'board' || Boolean(st.isHighlighter) !== wantHl) continue;
              this.renderSingleStroke(ctx, st, null, true);
            }
          }
        }
        // 실시간 드로잉 중인 획이 보드 타깃인 경우 가벼운 1개 획만 즉시 렌더링!
        if (this.isDrawingInk && this.currentInkStroke && (this.currentInkStroke.target || 'board') === 'board') {
          this.renderSingleStroke(ctx, this.currentInkStroke, null, true);
        }
      }

      // 🌟 [144Hz 초고속 0.02ms GPU Blit]: 그래프 내부 판서 ('graph')
      if (!filterTarget || filterTarget === 'graph') {
        if (this.inkGraphBakeCanvas) {
          if (ctx === this.ctx) {
            ctx.save();
            if (bakeCam && this._inkBakeDirty) {
              const z0 = bakeCam.zoomLevel || 1.0;
              const z1 = this.zoomLevel || 1.0;
              const sG = z1 / z0;
              const halfW = sw / 2;
              const halfH = sh / 2;
              const txG = (halfW + (this.panX || 0)) - (halfW + (bakeCam.panX || 0)) * sG;
              const tyG = (halfH + (this.panY || 0)) - (halfH + (bakeCam.panY || 0)) * sG;
              ctx.setTransform(sG, 0, 0, sG, (txG - bPadX * sG) * dpr, (tyG - bPadY * sG) * dpr);
            } else {
              ctx.setTransform(1, 0, 0, 1, -bPadX * dpr, -bPadY * dpr);
            }
            ctx.drawImage(this.inkGraphBakeCanvas, 0, 0);
            ctx.restore();
          } else {
            ctx.drawImage(this.inkGraphBakeCanvas, -bPadX, -bPadY, sw + bPadX * 2, sh + bPadY * 2);
          }
        }
        if (hasLassoLiveOverlay) {
          for (let pass = 0; pass < 2; pass++) {
            const wantHl = (pass === 0);
            for (let i = 0; i < this.selectedInkStrokes.length; i++) {
              const st = this.selectedInkStrokes[i];
              if (!st || st.target !== 'graph' || Boolean(st.isHighlighter) !== wantHl) continue;
              if (Boolean(st.onPdfBoard) !== Boolean(this.pdfPageBoardData)) continue;
              this.renderSingleStroke(ctx, st, null, true);
            }
          }
        }
        // 실시간 드로잉 중인 획이 그래프 타깃인 경우 가벼운 1개 획만 즉시 렌더링!
        if (this.isDrawingInk && this.currentInkStroke && this.currentInkStroke.target === 'graph') {
          this.renderSingleStroke(ctx, this.currentInkStroke, null, true);
        }
      }

      // 2차 패스: [스마트 오토 컨트라스트] 다크 칠판에서 기본 흰색 펜(#ffffff)으로 흰색 문제 카드(#1 및 추가 문제 카드) 위에 필기했을 때
      if ((!filterTarget || filterTarget === 'board') && !isLight && !this.isMonochromeMode) {
        const extraLive = (this.isDrawingInk && this.currentInkStroke && (this.currentInkStroke.target || 'board') === 'board')
          ? this.currentInkStroke
          : null;
        this._drawWhiteBoardInkContrastOverProblemCards(ctx, this.inkStrokes || [], false, extraLive);
      }

      // drawLassoOverlay는 최상단 렌더링 파이프라인(render)에서 일괄 수행
    }
  }.prototype);
  delete _desc.constructor;
  Object.defineProperties(GraphApp.prototype, _desc);
}
