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
      this.stylusMoveSvg = document.getElementById('stylusMoveSvg');
      this.stylusNwseResizeSvg = document.getElementById('stylusNwseResizeSvg');
      this.stylusNeswResizeSvg = document.getElementById('stylusNeswResizeSvg');
      this.stylusClickRippleEl = document.getElementById('stylusClickRipple');
      this.stylusPenTip = document.getElementById('stylusPenTip');
      this.stylusPenCap = document.getElementById('stylusPenCap');
      this.stylusHighlighterTip = document.getElementById('stylusHighlighterTip');
      this.stylusHighlighterBand = document.getElementById('stylusHighlighterBand');
      this.stylusHighlighterGlow = document.getElementById('stylusHighlighterGlow');
      this.stylusColorBand = document.getElementById('stylusColorBand');
      this._syncStylusTipColors();
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
        '#modalProPricing',
        '#modalNAxisStudio',
        '#modalNAxisSetupNotice',
        '#modalMathToolkitLauncher',
        '#wrapStealthRecordDot',
        '#panelAudioRecordActions',
        '#panelStealthRecordActions'
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
        el.closest('.math-toolkit-backdrop') ||
        el.closest('.pw-region-popover') ||
        el.closest('.audio-rec-side-menu') ||
        el.closest('#wrapStealthRecordDot') ||
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
          minRawDistPen: 0.55,           // 유리면 정지 센서 노이즈 차단 + 소수점·단획 보존 (와콤원 동급 정밀도)
          minRawDistMouse: 1.5,
          minCardDistPen: 0.50,          // 카드 내부 아이패드 필기 최소 점 간격 (px)
          minCardDistMouse: 1.2,
          touchDownSettleDist: 1.85,     // 입필 첫 1.85px 유리면 착지 미끄러짐 흡수
          touchDownHookMaxLen: 4.80,     // 첫 구간(<=4.8px)이 본선과 >38° 꺾인 유리면 입필 삐침(Hook) 정밀 절제
          forwardGuardMaxDist: 1.80,     // 1.8px 이내 미세 역주행 스파이크 차단 (직각·예각 코너 100% 보존)
          forwardGuardMinCos: -0.40,
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
        (this._lastPenActiveTime && (nowT - this._lastPenActiveTime < 220))
      );
      const isWithinSingleTouchPenGuard = Boolean(
        this._lastPenActiveTime && (nowT - this._lastPenActiveTime < 450)
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
          this.isPdfToGraphCropMode ||
          isWithinSingleTouchPenGuard
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
          // 🛡️ 이미 두 손가락(id1, id2) 핀치가 안정적으로 작동 중일 때 손날/약지(3번째 터치)가 스치더라도
          // 진행 중인 핀치가 끊기거나 좌표쌍이 뒤바뀌어 화면이 튀지 않도록 추가 터치를 완벽 무시!
          if (
            this._pinchState &&
            this._pinchState.id1 !== undefined &&
            this._pinchState.id2 !== undefined &&
            this.activePointers.has(this._pinchState.id1) &&
            this.activePointers.has(this._pinchState.id2) &&
            e.pointerId !== this._pinchState.id1 &&
            e.pointerId !== this._pinchState.id2
          ) {
            e._touchIgnoreChecked = true;
            return true;
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
            this._pinchWasActiveInGesture = true;
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
        if (this._pinchState && this._pinchState._hasPendingMove && typeof this._applyPendingTwoFingerPinchStep === 'function') {
          this._applyPendingTwoFingerPinchStep();
        }
        if (this._pinchState && (this._pinchState.panUnlocked || this._pinchState.zoomUnlocked)) {
          this._pinchHadActiveMoveInGesture = true;
        }
        const wasPinchStateActive = Boolean(this._pinchState);
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
          if (!this._pinchState && (wasPinchStateActive || this._pinchHadActiveMoveInGesture || allFingersUp)) {
            if (allFingersUp) {
              this._pinchHadActiveMoveInGesture = false;
            }
            if (this.isGraphCovered) {
              this.updateProblemCardPosition(false);
            }
            this._hasSceneFreeze = false;
            this.requestRender();
            if (this._inkBakeDirty) {
              this._scheduleIdleInkCacheRebuild(90);
            }
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
          if (
            this.isAudioRecording &&
            e &&
            (typeof window === 'undefined' || !window.PointerEvent) &&
            !this.isDrawingInk &&
            !this._isDrawingCardInk &&
            !this.isStylusDrawing
          ) {
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

      // 🚀 [DOM Style Mutation 최소화]: 아이콘 종류가 바뀌었거나 숨겨진 상태에서 다시 켜질 때만 12개 SVG의 display 속성을 갱신!
      const needSvgSync = (
        this._lastVirtualStylusKind !== activeKind ||
        this.virtualStylusEl.style.display !== 'block' ||
        (this.stylusArrowSvg && this.stylusArrowSvg.style.display !== 'none') ||
        (this.stylusMoveSvg && this.stylusMoveSvg.style.display !== 'none') ||
        (this.stylusNwseResizeSvg && this.stylusNwseResizeSvg.style.display !== 'none') ||
        (this.stylusNeswResizeSvg && this.stylusNeswResizeSvg.style.display !== 'none')
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
        if (this.stylusMoveSvg) this.stylusMoveSvg.style.display = 'none';
        if (this.stylusNwseResizeSvg) this.stylusNwseResizeSvg.style.display = 'none';
        if (this.stylusNeswResizeSvg) this.stylusNeswResizeSvg.style.display = 'none';
        this.virtualStylusEl.style.display = 'block';
      }

      // 캔버스 내부 범위로 클램핑하여 마지막 위치 보존
      const clampedX = Math.max(0, Math.min(this.screenWidth || 1920, x));
      const clampedY = Math.max(0, Math.min(this.screenHeight || 1080, y));

      this.stylusPenPos = { x: clampedX, y: clampedY };
      if (
        this.isAudioRecording &&
        e &&
        (typeof window === 'undefined' || !window.PointerEvent) &&
        !this.isDrawingInk &&
        !this._isDrawingCardInk &&
        !this.isStylusDrawing
      ) {
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
          'ink-cursor-grabbing',
          'is-hover-selection',
          'is-hover-resize-nwse',
          'is-hover-resize-nesw'
        );
        this.canvas.style.cursor = 'default';
        if (this.virtualStylusEl) {
          this.virtualStylusEl.style.display = 'none';
        }
      }
      if (document.body) {
        document.body.classList.toggle('ink-laser-tool-active', Boolean(this.isInkMode && this.activeInkTool === 'laser'));
        document.body.classList.toggle('ink-sticker-tool-active', Boolean(this.isInkMode && this.activeInkTool === 'sticker'));
        document.body.classList.toggle('ink-lasso-tool-active', Boolean(this.isInkMode && this.activeInkTool === 'lasso'));
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
          const restoreDlTool = this._preDropLineInkTool;
          this._preDropLineInkTool = null;
          if (restoreDlTool && restoreDlTool !== 'select' && this.isInkMode && this.activeInkTool === 'select' && !this.isGraphSnapMode) {
            this.setActiveInkTool(restoreDlTool);
          }
        } else {
          this._preDropLineInkTool = null;
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

    _hexToRgbaForStylus(colorStr, alpha = 0.28) {
      if (typeof colorStr !== 'string') return `rgba(250, 204, 21, ${alpha})`;
      const s = colorStr.trim();
      const m6 = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(s);
      if (m6) {
        return `rgba(${parseInt(m6[1], 16)}, ${parseInt(m6[2], 16)}, ${parseInt(m6[3], 16)}, ${alpha})`;
      }
      const m3 = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
      if (m3) {
        return `rgba(${parseInt(m3[1] + m3[1], 16)}, ${parseInt(m3[2] + m3[2], 16)}, ${parseInt(m3[3] + m3[3], 16)}, ${alpha})`;
      }
      return `rgba(250, 204, 21, ${alpha})`;
    }

    _syncStylusTipColors(overrideColor = null, overrideTool = null) {
      if (typeof document === 'undefined') return;
      const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || { isLight: true };
      const isLight = Boolean(curTheme.isLight || this.isMonochromeMode);

      const penTipEl = this.stylusPenTip || (this.stylusPenTip = document.getElementById('stylusPenTip'));
      const penCapEl = this.stylusPenCap || (this.stylusPenCap = document.getElementById('stylusPenCap'));
      const hlTipEl = this.stylusHighlighterTip || (this.stylusHighlighterTip = document.getElementById('stylusHighlighterTip'));
      const hlBandEl = this.stylusHighlighterBand || (this.stylusHighlighterBand = document.getElementById('stylusHighlighterBand'));
      const hlGlowEl = this.stylusHighlighterGlow || (this.stylusHighlighterGlow = document.getElementById('stylusHighlighterGlow'));

      if (overrideTool === 'pen') {
        const rawPen = overrideColor || this.currentInkColor || (isLight ? '#1e293b' : '#ffffff');
        const penFill = this.isMonochromeMode ? '#000000' : rawPen;
        if (this._appliedPenStylusFill !== penFill) {
          this._appliedPenStylusFill = penFill;
          if (penTipEl) penTipEl.setAttribute('fill', penFill);
          if (penCapEl) penCapEl.setAttribute('fill', penFill);
          if (this.stylusColorBand) this.stylusColorBand.setAttribute('fill', penFill);
        }
        return;
      }

      if (overrideTool === 'highlighter') {
        const rawHl = overrideColor || this.currentInkColor || (isLight ? '#1e293b' : '#ffffff');
        const hlFill = this.isMonochromeMode ? '#cbd5e1' : this.resolveHighlighterStrokeColor(rawHl, Boolean(curTheme.isLight));
        const hlGlow = this._hexToRgbaForStylus(hlFill, this.isMonochromeMode ? 0.22 : (curTheme.isLight ? 0.28 : 0.30));
        const hlSig = `${hlFill}|${hlGlow}`;
        if (this._appliedHlStylusFill !== hlSig) {
          this._appliedHlStylusFill = hlSig;
          if (hlTipEl) hlTipEl.setAttribute('fill', hlFill);
          if (hlBandEl) hlBandEl.setAttribute('fill', hlFill);
          if (hlGlowEl) hlGlowEl.setAttribute('fill', hlGlow);
        }
        return;
      }

      const defaultNeutral = curTheme.isLight ? '#1e293b' : '#ffffff';
      let rawPen = (this.activeInkTool === 'pen' ? this.currentInkColor : (this.savedPenColor || this.currentInkColor)) || defaultNeutral;
      const rawPenLower = String(rawPen).toLowerCase();
      if (!curTheme.isLight && !this.isMonochromeMode && rawPenLower === '#1e293b') {
        rawPen = '#ffffff';
      } else if (curTheme.isLight && rawPenLower === '#ffffff') {
        rawPen = '#1e293b';
      }
      const penFill = this.isMonochromeMode ? '#000000' : rawPen;
      if (this._appliedPenStylusFill !== penFill) {
        this._appliedPenStylusFill = penFill;
        if (penTipEl) penTipEl.setAttribute('fill', penFill);
        if (penCapEl) penCapEl.setAttribute('fill', penFill);
        if (this.stylusColorBand) this.stylusColorBand.setAttribute('fill', penFill);
      }

      const rawHl = (this.activeInkTool === 'highlighter' ? this.currentInkColor : (this.savedHighlighterColor || this.currentInkColor)) || defaultNeutral;
      const hlFill = this.isMonochromeMode ? '#cbd5e1' : this.resolveHighlighterStrokeColor(rawHl, Boolean(curTheme.isLight));
      const hlGlow = this._hexToRgbaForStylus(hlFill, this.isMonochromeMode ? 0.22 : (curTheme.isLight ? 0.28 : 0.30));
      const hlSig = `${hlFill}|${hlGlow}`;
      if (this._appliedHlStylusFill !== hlSig) {
        this._appliedHlStylusFill = hlSig;
        if (hlTipEl) hlTipEl.setAttribute('fill', hlFill);
        if (hlBandEl) hlBandEl.setAttribute('fill', hlFill);
        if (hlGlowEl) hlGlowEl.setAttribute('fill', hlGlow);
      }
    }

    _applyCurrentToolColorUI(color) {
      if (!color) return;
      const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || { isLight: true };
      const isLight = Boolean(curTheme.isLight);
      let effColor = color;
      const rawLower = String(color).toLowerCase();
      if (!isLight && rawLower === '#1e293b') {
        effColor = '#ffffff';
      } else if (isLight && rawLower === '#ffffff') {
        effColor = '#1e293b';
      }
      this.currentInkColor = effColor;
      const isHl = (this.activeInkTool === 'highlighter');
      const effLower = effColor.toLowerCase();
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.ink-color-dot, .pill-color-dot').forEach(dot => {
          const dsCol = (dot.dataset.color || '').toLowerCase();
          dot.classList.toggle('active', dsCol === effLower);
          // 형광펜 모드에서는 1번 기본 도트(라이트 #1e293b / 다크 #ffffff)의 시각적 색상을 노란 형광색으로 표시하여 직관성 극대화
          if (dsCol === '#1e293b') {
            dot.style.background = isHl ? '#facc15' : '#1e293b';
          } else if (dsCol === '#ffffff') {
            dot.style.background = isHl ? '#fde047' : '#ffffff';
          } else if (dot.dataset.color) {
            dot.style.background = dot.dataset.color;
          }
        });
      }
      const displayCol = this.isMonochromeMode
        ? (isHl ? '#cbd5e1' : '#000000')
        : (isHl ? this.resolveHighlighterStrokeColor(effColor, isLight) : effColor);
      this._syncStylusTipColors();
      if (typeof document !== 'undefined') {
        const previewDot = document.getElementById('inkSizePreviewDot');
        if (previewDot) previewDot.style.background = displayCol;
        const tbDot = document.getElementById('inkSizeToolbarDot');
        if (tbDot) tbDot.style.background = displayCol;
      }
    }

    setActiveInkTool(tool) {
      if (!this._isSwitchingForDropLine) {
        this._preDropLineInkTool = null;
      }
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
        document.body.classList.toggle('ink-lasso-tool-active', Boolean(this.isInkMode && this.activeInkTool === 'lasso'));
      }

      if (tool !== 'lasso') {
        const hadLassoVisual = Boolean(
          this.isLassoSelecting ||
          this.lassoBoundingBox ||
          (this.selectedInkStrokes && this.selectedInkStrokes.length > 0) ||
          (this.selectedTextLabels && this.selectedTextLabels.length > 0)
        );
        if (this.isAudioRecording && this._activeRecLassoOp && typeof this._commitAudioLassoTransformOp === 'function') {
          try { this._commitAudioLassoTransformOp(); } catch (_) { }
        }
        this.selectedInkStrokes = [];
        this.selectedTextLabels = [];
        this.lassoBoundingBox = null;
        this.isLassoSelecting = false;
        this.isDraggingLassoSelection = false;
        this.isResizingLassoSelection = false;
        this.lassoResizeStart = null;
        this.lassoPoints = [];
        if (this.canvas && this.canvas.classList) {
          this.canvas.classList.remove('is-hover-selection', 'is-hover-resize-nwse', 'is-hover-resize-nesw');
        }
        if (this._lassoExcludedBakeSet) {
          this._lassoExcludedBakeSet = null;
          this._inkBakeDirty = true;
        }
        if (typeof this.clearCardLassoSelection === 'function') {
          this.clearCardLassoSelection();
        }
        this.syncLassoActionBarUI();
        if (hadLassoVisual && this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
          try { this._recordAudioWorkspaceStateIfNeeded(true); } catch (_) { }
        }
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
      const clamped = Math.max(12, Math.min(52, Math.round(Number(size) || 20)));
      this.textLabelFontSize = clamped;
      this._preferredTextLabelFontSize = clamped;
      try { localStorage.setItem('graphly_text_label_size_v1', String(clamped)); } catch (_) { }
      const slider = document.getElementById('sliderTextLabelSize');
      if (slider) slider.value = clamped;
      const lbl = document.getElementById('lblTextLabelSize');
      if (lbl) lbl.textContent = `${clamped}`;
      const curUnitScale = typeof this.getCurrentMathUnitScale === 'function' ? this.getCurrentMathUnitScale() : 90;
      if (this.selectedTextLabelId) {
        const sel = this.textLabels.find(t => t.id === this.selectedTextLabelId);
        if (sel) {
          sel.fontSize = clamped;
          sel.baseUnitScale = curUnitScale;
        }
      } else {
        this.textLabels.forEach(t => {
          t.fontSize = clamped;
          t.baseUnitScale = curUnitScale;
        });
      }
      if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
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
      const clamped = Math.max(12, Math.min(48, Math.round(Number(size) || 22)));
      this.axisLabelFontSize = clamped;
      this._preferredAxisLabelFontSize = clamped;
      try { localStorage.setItem('graphly_axis_label_size_v1', String(clamped)); } catch (_) { }
      const slider = document.getElementById('sliderAxisLabelSize');
      if (slider) slider.value = clamped;
      const lbl = document.getElementById('lblAxisLabelSize');
      if (lbl) lbl.textContent = `${clamped}`;
      if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
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
        const recSnapMain = (this.isAudioRecording && typeof this._snapshotInkListForReconcile === 'function')
          ? this._snapshotInkListForReconcile(this.inkStrokes)
          : null;
        if (Array.isArray(this.inkStrokes)) {
          this.inkStrokes.forEach(st => {
            if (st && !st.isHighlighter && !st.isGraphStamp) st.softBlur = clamped;
          });
        }
        if (recSnapMain && this.isAudioRecording && typeof this._reconcileInkStrokesForAudioRecording === 'function') {
          this._reconcileInkStrokesForAudioRecording(recSnapMain, this.inkStrokes);
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
            this._syncStylusTipColors();
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
            this._syncStylusTipColors();
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
      const hasErasableBoardStickers = Boolean(
        this.boardStickers &&
        this.boardStickers.some(s => s && !s.isStampedCardSticker)
      );
      const hasAnyStampedSticker = Boolean(
        this.boardStickers &&
        this.boardStickers.some(s => s && s.isStampedCardSticker)
      );
      const hasErasableBoardInk = Boolean(
        Array.isArray(this.inkStrokes) &&
        this.inkStrokes.some(s => s && !s.isGraphStamp)
      );
      const hasAnyGraphStamp = Boolean(
        Array.isArray(this.inkStrokes) &&
        this.inkStrokes.some(s => s && s.isGraphStamp)
      );
      if (!hasErasableBoardInk && !hasCardInk && !hasErasableBoardStickers) {
        if (hasAnyGraphStamp || hasAnyStampedSticker) {
          this.showToast('ℹ️ 박제된 스탬프는 유지됩니다. (방금 찍은 스탬프 취소: 되돌리기 ↺)');
        }
        return;
      }
      this.pushHistoryState();
      const isRecClear = Boolean(this.isAudioRecording && typeof this._archiveStrokeRemovedDuringRecording === 'function');
      const recTClear = isRecClear ? Math.max(0, Math.round(this.getAudioRecordElapsedMs())) : 0;
      const prevMainInkSnap = (isRecClear && typeof this._snapshotInkListForReconcile === 'function')
        ? this._snapshotInkListForReconcile(this.inkStrokes)
        : null;
      if (hasCardInk) {
        if (isRecClear) {
          (this.problemInkStrokes || []).forEach(st => this._archiveStrokeRemovedDuringRecording(st, recTClear, { cardKey: 'problem_main' }));
          (this.graphInkStrokes || []).forEach(st => this._archiveStrokeRemovedDuringRecording(st, recTClear, { cardKey: 'graph_main' }));
          if (this.extraProblemCards) {
            this.extraProblemCards.forEach(c => {
              const ck = c && c.el && typeof this.getAudioCardKey === 'function' ? this.getAudioCardKey(c.el) : null;
              if (ck && Array.isArray(c.el._cardInkStrokes)) {
                c.el._cardInkStrokes.forEach(st => this._archiveStrokeRemovedDuringRecording(st, recTClear, { cardKey: ck }));
              }
            });
          }
          if (this.extraGraphCards) {
            this.extraGraphCards.forEach(c => {
              const ck = c && c.el && typeof this.getAudioCardKey === 'function' ? this.getAudioCardKey(c.el) : null;
              if (ck && Array.isArray(c.el._cardInkStrokes)) {
                c.el._cardInkStrokes.forEach(st => this._archiveStrokeRemovedDuringRecording(st, recTClear, { cardKey: ck }));
              }
            });
          }
        }
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
      if (hasErasableBoardStickers) {
        if (this.isGraphCovered && !this.pdfPageBoardData) {
          this.boardStickers = (this.boardStickers || []).filter(s => Boolean(s && s.isStampedCardSticker) || (s.target || 'board') !== 'board');
        } else if (this.pdfPageBoardData) {
          this.boardStickers = (this.boardStickers || []).filter(s => Boolean(s && s.isStampedCardSticker) || (!s.onPdfBoard && (s.target || 'board') !== 'board'));
        } else {
          this.boardStickers = (this.boardStickers || []).filter(s => Boolean(s && s.isStampedCardSticker) || (s.target || 'board') !== 'graph' || Boolean(s.onPdfBoard));
        }
      }

      // 🌟 [대표님 기획: 3대 판서 분리 관리] 🌟
      // 문제 창이 켜져 있고 바깥창 풀이 필기가 있을 때 1차 클릭: 바깥 칠판 풀이 필기만 깔끔히 비움! (그래프 수식 주석은 보존)
      // 2차 클릭 (바깥창 필기가 없을 때): 그래프 창 내부 주석까지 모두 비움!
      if (this.isGraphCovered && !this.pdfPageBoardData) {
        this.inkStrokes = (this.inkStrokes || []).filter(s => s && (Boolean(s.isGraphStamp) || (s.target || 'board') !== 'board'));
        this.showToast('🧹 필기 모드 필기를 깔끔하게 비웠습니다.');
      } else if (this.pdfPageBoardData) {
        this.inkStrokes = (this.inkStrokes || []).filter(s => s && (Boolean(s.isGraphStamp) || (!s.onPdfBoard && (s.target || 'board') !== 'board')));
        this.showToast('🧹 PDF 페이지 위 필기를 깔끔하게 비웠습니다.');
      } else {
        this.inkStrokes = (this.inkStrokes || []).filter(s => s && (Boolean(s.isGraphStamp) || (s.target || 'board') !== 'graph' || Boolean(s.onPdfBoard)));
        this.showToast('🧹 그래프 모드 필기를 비웠습니다.');
      }
      if (prevMainInkSnap && isRecClear && typeof this._reconcileInkStrokesForAudioRecording === 'function') {
        this._reconcileInkStrokesForAudioRecording(prevMainInkSnap, this.inkStrokes, recTClear);
      }
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        try { this._recordAudioWorkspaceStateIfNeeded(true); } catch (_) { }
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
      if (typeof document !== 'undefined' && document.body && document.body.classList.contains('viewer-graph-touch-mode')) return null;
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
      if (!stk || stk.isStampedCardSticker || !Array.isArray(this.boardStickers)) return false;
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
              const isEraserNow = Boolean((this.isInkMode && this.activeInkTool === 'eraser') || (typeof this.isStylusEraserEvent === 'function' && this.isStylusEraserEvent(ev)));
              if (isEraserNow) {
                if (stk.isStampedCardSticker) return;
                ev.preventDefault();
                ev.stopPropagation();
                this.removeBoardStickerById(stk.id);
                return;
              }
              ev.preventDefault();
              ev.stopPropagation();
              downPt = { x: ev.clientX, y: ev.clientY };
            });
            itemEl.addEventListener('pointerenter', (ev) => {
              if (stk.isStampedCardSticker) return;
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
          if (!stk) continue;
          if (isExport && this._activeExportFilter) {
            const ef = this._activeExportFilter;
            const allowStk = (stk.fromProblemStamp || stk.onPdfBoard)
              ? (ef.includeProblem !== false)
              : (((stk.isStampedCardSticker && !stk.fromProblemStamp) || stk.target === 'graph')
                ? (ef.includeGraph !== false)
                : (ef.includeInk !== false));
            if (!allowStk) continue;
          }
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
        if (stroke.isGraphStamp) {
          remaining.push(stroke);
          continue;
        }
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

    // 🌟 [아이패드 애플펜슬 입필·종필 삐침(Hook) 및 제자리 뭉침(Cluster) 무결점 정밀 분리 직선 추출기]:
    // - 반듯하게 그은 직선은 양 끝을 단 0.0px도 축소하지 않고 100% 보존(Zero-Shrinkage Extension)하며,
    // - 강화유리 착지 순간 발생하는 사선/수직/역방향 첫 시작점 삐침·뭉침과 정지 감속 갈고리만 정확히 꼭짓점까지 도려냅니다.
    // - 원·사각형·삼각형·포물선·삼차함수·'ㄴ'·'ㄱ'·'3' 등 곡선/다변 도형은 주축 비율(>=0.66) 및 이탈 한도로 100% 배제합니다.
    _extractOptimalLineEndpoints(rawScreenPts) {
      if (!Array.isArray(rawScreenPts) || rawScreenPts.length < 2) return null;
      const L = rawScreenPts.length;

      let rawMinX = rawScreenPts[0].x, rawMaxX = rawScreenPts[0].x;
      let rawMinY = rawScreenPts[0].y, rawMaxY = rawScreenPts[0].y;
      const cumArc = new Float64Array(L);
      cumArc[0] = 0;
      for (let i = 1; i < L; i++) {
        const pPrev = rawScreenPts[i - 1];
        const rp = rawScreenPts[i];
        if (rp.x < rawMinX) rawMinX = rp.x;
        if (rp.x > rawMaxX) rawMaxX = rp.x;
        if (rp.y < rawMinY) rawMinY = rp.y;
        if (rp.y > rawMaxY) rawMaxY = rp.y;
        cumArc[i] = cumArc[i - 1] + Math.hypot(rp.x - pPrev.x, rp.y - pPrev.y);
      }

      const totalArc = cumArc[L - 1];
      const rawW = rawMaxX - rawMinX;
      const rawH = rawMaxY - rawMinY;
      const rawMaxDim = Math.max(1, rawW, rawH);
      const rawDiag = Math.hypot(rawW, rawH);
      if (totalArc < 6.5 || rawDiag < 6.5) return null;

      // 시작점·끝점 갈고리/뭉침 탐색 허용 반경 (단거리 분수선 2~5px 착지 삐침 커버 + 'ㄴ'/'ㄱ' 제2변 보호 상한)
      const maxStartHookDist = Math.min(7.0, Math.max(3.4, rawMaxDim * 0.34));
      const maxEndHookDist = Math.min(7.5, Math.max(3.5, rawMaxDim * 0.35));

      const rawFirst = rawScreenPts[0];
      const rawLast = rawScreenPts[L - 1];

      // 1) 시작 후보 수집 (첫 접촉 반경 클러스터 내부에서만 수집 후 본선 이탈 시 즉시 중단 -> 닫힌 루프 끝점 혼입 차단)
      const startRawCands = [0];
      for (let i = 1; i < L - 1; i++) {
        const d0 = Math.hypot(rawScreenPts[i].x - rawFirst.x, rawScreenPts[i].y - rawFirst.y);
        if (d0 <= maxStartHookDist) {
          startRawCands.push(i);
        } else if (d0 > maxStartHookDist + 3.0) {
          break;
        }
      }
      const startCands = (startRawCands.length <= 18) ? startRawCands : [0];
      if (startRawCands.length > 18) {
        const tailKeepFrom = startRawCands.length - 6;
        for (let c = 1; c < startRawCands.length; c++) {
          const idx = startRawCands[c];
          const prevKept = rawScreenPts[startCands[startCands.length - 1]];
          const curPt = rawScreenPts[idx];
          if (c >= tailKeepFrom || Math.hypot(curPt.x - prevKept.x, curPt.y - prevKept.y) >= 0.70) {
            startCands.push(idx);
          }
        }
      }

      // 2) 끝 후보 수집 (종필 정지 클러스터 내부에서만 역순 수집 후 본선 진입 시 즉시 중단)
      const endRawCands = [L - 1];
      for (let j = L - 2; j > 0; j--) {
        const dEnd = Math.hypot(rawScreenPts[j].x - rawLast.x, rawScreenPts[j].y - rawLast.y);
        if (dEnd <= maxEndHookDist) {
          endRawCands.push(j);
        } else if (dEnd > maxEndHookDist + 3.0) {
          break;
        }
      }
      const endCands = (endRawCands.length <= 18) ? endRawCands : [L - 1];
      if (endRawCands.length > 18) {
        const tailKeepFrom = endRawCands.length - 6;
        for (let c = 1; c < endRawCands.length; c++) {
          const idx = endRawCands[c];
          const prevKept = rawScreenPts[endCands[endCands.length - 1]];
          const curPt = rawScreenPts[idx];
          if (c >= tailKeepFrom || Math.hypot(curPt.x - prevKept.x, curPt.y - prevKept.y) >= 0.70) {
            endCands.push(idx);
          }
        }
      }

      // 3) 후보 쌍 (i, j) 중 직선 불변 조건을 만족하면서 기하 오차 비용이 최소인 코어 본선 탐색
      let best = null;
      const minDominantChord = Math.max(6.5, rawMaxDim * 0.66);

      for (let si = 0; si < startCands.length; si++) {
        const i = startCands[si];
        const pA = rawScreenPts[i];
        const trimStartDist = (i === 0) ? 0 : Math.hypot(pA.x - rawFirst.x, pA.y - rawFirst.y);

        for (let ej = 0; ej < endCands.length; ej++) {
          const j = endCands[ej];
          if (j <= i) continue;
          const pB = rawScreenPts[j];
          const chord = Math.hypot(pB.x - pA.x, pB.y - pA.y);
          if (chord < minDominantChord) continue;

          const rStep = (chord < 30) ? 1.5 : 2.5;
          let resampledArc = 0;
          let lastR = pA;
          let maxDev = 0;
          for (let k = i + 1; k < j; k++) {
            const pk = rawScreenPts[k];
            const dev = this.distToSegment(pk, pA, pB);
            if (dev > maxDev) maxDev = dev;
            const dR = Math.hypot(pk.x - lastR.x, pk.y - lastR.y);
            if (dR >= rStep) {
              resampledArc += dR;
              lastR = pk;
            }
          }
          resampledArc += Math.hypot(pB.x - lastR.x, pB.y - lastR.y);
          const straightness = chord / Math.max(chord, resampledArc);

          // 단거리(6.5~30px) <-> 장거리(30px+) 절벽 없는 연속 허용 오차 곡선
          const isShort = (chord < 30);
          const devLimit = isShort
            ? Math.max(2.4, 1.8 + chord * 0.10)
            : Math.max(4.8, chord * 0.085);

          const passesLine = isShort
            ? (straightness >= 0.885 && maxDev <= devLimit)
            : (maxDev <= devLimit &&
              (straightness >= 0.90 || (straightness >= 0.85 && maxDev <= Math.max(3.8, chord * 0.065))));

          if (!passesLine) continue;

          const trimEndDist = (j === L - 1) ? 0 : Math.hypot(rawLast.x - pB.x, rawLast.y - pB.y);
          const trimSpan = trimStartDist + trimEndDist;
          const normDev = maxDev / Math.max(10.0, chord * 0.25);
          const cost = normDev * 10.0 + (1.0 - straightness) * 20.0 + trimSpan * 0.16;

          if (!best || cost < best.cost) {
            best = { i, j, chord, cost };
          }
        }
      }

      if (!best) return null;

      // 4) Zero-Shrinkage Extension: 코어 본선의 국소 진행 방향과 일직선상에 놓인 정방향 감속 양 끝점은 100% 길이 복원!
      let finalI = best.i;
      let finalJ = best.j;

      if (finalI > 0 || finalJ < L - 1) {
        const coreA = rawScreenPts[finalI];
        const coreB = rawScreenPts[finalJ];
        const coreDx = coreB.x - coreA.x;
        const coreDy = coreB.y - coreA.y;
        const coreLen = Math.max(1e-6, Math.hypot(coreDx, coreDy));
        const globalUx = coreDx / coreLen;
        const globalUy = coreDy / coreLen;

        // 시작부 국소 접선 벡터 (완만한 긴 밑줄 양끝 복원 지원)
        let refStartIdx = finalI + 1;
        while (refStartIdx < finalJ && Math.hypot(rawScreenPts[refStartIdx].x - coreA.x, rawScreenPts[refStartIdx].y - coreA.y) < Math.min(12.0, coreLen * 0.5)) {
          refStartIdx++;
        }
        const sVecX = rawScreenPts[refStartIdx].x - coreA.x;
        const sVecY = rawScreenPts[refStartIdx].y - coreA.y;
        const sVecLen = Math.hypot(sVecX, sVecY);
        const startUx = sVecLen > 0.5 ? (sVecX / sVecLen) : globalUx;
        const startUy = sVecLen > 0.5 ? (sVecY / sVecLen) : globalUy;
        const maxExtPerp = Math.max(1.25, Math.min(2.4, coreLen * 0.022));

        while (finalI > 0) {
          const candPt = rawScreenPts[finalI - 1];
          const curStart = rawScreenPts[finalI];
          const segX = curStart.x - candPt.x;
          const segY = curStart.y - candPt.y;
          const segLen = Math.hypot(segX, segY);
          if (segLen < 0.08) {
            finalI--;
            continue;
          }
          const cosLocal = (segX * startUx + segY * startUy) / segLen;
          const perpFromLocal = Math.abs((candPt.x - coreA.x) * startUy - (candPt.y - coreA.y) * startUx);
          if (cosLocal >= 0.89 && perpFromLocal <= maxExtPerp) {
            finalI--;
          } else {
            break;
          }
        }

        // 종료부 국소 접선 벡터
        let refEndIdx = finalJ - 1;
        while (refEndIdx > finalI && Math.hypot(coreB.x - rawScreenPts[refEndIdx].x, coreB.y - rawScreenPts[refEndIdx].y) < Math.min(12.0, coreLen * 0.5)) {
          refEndIdx--;
        }
        const eVecX = coreB.x - rawScreenPts[refEndIdx].x;
        const eVecY = coreB.y - rawScreenPts[refEndIdx].y;
        const eVecLen = Math.hypot(eVecX, eVecY);
        const endUx = eVecLen > 0.5 ? (eVecX / eVecLen) : globalUx;
        const endUy = eVecLen > 0.5 ? (eVecY / eVecLen) : globalUy;

        while (finalJ < L - 1) {
          const candPt = rawScreenPts[finalJ + 1];
          const curEnd = rawScreenPts[finalJ];
          const segX = candPt.x - curEnd.x;
          const segY = candPt.y - curEnd.y;
          const segLen = Math.hypot(segX, segY);
          if (segLen < 0.08) {
            finalJ++;
            continue;
          }
          const cosLocal = (segX * endUx + segY * endUy) / segLen;
          const perpFromLocal = Math.abs((candPt.x - coreB.x) * endUy - (candPt.y - coreB.y) * endUx);
          if (cosLocal >= 0.89 && perpFromLocal <= maxExtPerp) {
            finalJ++;
          } else {
            break;
          }
        }
      }

      const pStart = rawScreenPts[finalI];
      const pEnd = rawScreenPts[finalJ];
      const finalChord = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
      if (finalChord < 6.5) return null;

      return {
        pStart,
        pEnd,
        chordLen: finalChord,
        startIdx: finalI,
        endIdx: finalJ
      };
    }

    // 🌟 Draw & Hold 기하 도형 & 수학 함수 개형 인식 엔진 (Line, Circle, Ellipse, Rect, Triangle, Parabola, Cubic/Sine Wave) 🌟
    recognizeInkShape(stroke) {
      if (!stroke || !stroke.points || stroke.points.length < 2) return null;

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

      // --- [1. 직선 판별 (Straight Line & Axis Magnet Snap — 6.5px+ 초단거리 분수선 & 입·종필 삐침/뭉침 정밀 제거)] ---
      const lineMatch = this._extractOptimalLineEndpoints(rawScreenPts);
      if (lineMatch) {
        const lStart = lineMatch.pStart;
        let endX = lineMatch.pEnd.x;
        let endY = lineMatch.pEnd.y;
        const lChord = lineMatch.chordLen;

        const dx = endX - lStart.x;
        const dy = endY - lStart.y;
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
        const absAngle = Math.abs(angleDeg);

        const snapAngleThresh = 4.5;
        const diagAngleThresh = 2.0;
        const isShortHorizSnap = (lChord < 32 && Math.abs(dy) <= 2.6 && Math.abs(dx) >= 5.5);
        const isShortVertSnap = (lChord < 32 && Math.abs(dx) <= 2.6 && Math.abs(dy) >= 5.5);

        let snapped = null;
        if (absAngle < snapAngleThresh || absAngle > (180 - snapAngleThresh) || isShortHorizSnap) {
          endY = lStart.y;
          snapped = 'horizontal';
        } else if (Math.abs(absAngle - 90) < snapAngleThresh || isShortVertSnap) {
          endX = lStart.x;
          snapped = 'vertical';
        } else if (Math.abs(absAngle - 45) < diagAngleThresh || Math.abs(absAngle - 135) < diagAngleThresh) {
          const dist = Math.hypot(dx, dy);
          const signX = dx >= 0 ? 1 : -1;
          const signY = dy >= 0 ? 1 : -1;
          endX = lStart.x + signX * dist * Math.SQRT1_2;
          endY = lStart.y + signY * dist * Math.SQRT1_2;
          snapped = 'diagonal';
        }

        const lineShape = {
          type: 'line',
          start: toTargetCoord(lStart),
          end: toTargetCoord({ x: endX, y: endY }),
          snapped: snapped
        };
        try {
          Object.defineProperty(lineShape, '_coreRange', {
            value: [lineMatch.startIdx, lineMatch.endIdx],
            enumerable: false,
            configurable: true
          });
        } catch (_) { }
        return lineShape;
      }

      // 🌟 [직선 외 곡선·닫힌 도형(삼차개형, 포물선, 삼각형, 원, 타원, 직사각형) 판별 경로 — 기존 로직 100% 원형 유지]:
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
      const startTrimRadius = Math.min(3.5, Math.max(1.8, rawMaxDim * 0.10));
      const endTrimRadius = Math.min(4.5, Math.max(2.6, rawMaxDim * 0.16));

      const rawFirst = rawScreenPts[0];
      let trimStartIdx = 0;
      while (trimStartIdx < rawScreenPts.length - 2 && Math.hypot(rawScreenPts[trimStartIdx + 1].x - rawFirst.x, rawScreenPts[trimStartIdx + 1].y - rawFirst.y) <= startTrimRadius) {
        trimStartIdx++;
      }
      const rawLast = rawScreenPts[rawScreenPts.length - 1];
      let trimEndIdx = rawScreenPts.length - 1;
      while (trimEndIdx > trimStartIdx + 1 && Math.hypot(rawScreenPts[trimEndIdx - 1].x - rawLast.x, rawScreenPts[trimEndIdx - 1].y - rawLast.y) <= endTrimRadius) {
        if (rawMaxDim < 24 && trimEndIdx - 1 > trimStartIdx) {
          const cand = rawScreenPts[trimEndIdx - 1];
          const dFromStart = Math.hypot(cand.x - rawFirst.x, cand.y - rawFirst.y);
          const dToLast = Math.hypot(rawLast.x - cand.x, rawLast.y - cand.y);
          if (dFromStart >= 4.0 && dToLast >= 2.8) {
            const vx1 = cand.x - rawFirst.x, vy1 = cand.y - rawFirst.y;
            const vx2 = rawLast.x - cand.x, vy2 = rawLast.y - cand.y;
            const cosTurn = (vx1 * vx2 + vy1 * vy2) / (dFromStart * dToLast);
            if (cosTurn > -0.35 && cosTurn < 0.45) {
              break;
            }
          }
        }
        trimEndIdx--;
      }

      const coreFirst = rawScreenPts[trimStartIdx];
      const coreLast = rawScreenPts[trimEndIdx];
      const coreDx = coreLast.x - coreFirst.x;
      const coreDy = coreLast.y - coreFirst.y;
      const coreLen = Math.hypot(coreDx, coreDy);
      let keepRawFirst = (trimStartIdx === 0);
      let keepRawLast = (trimEndIdx === rawScreenPts.length - 1);
      if (coreLen >= 4) {
        const ux = coreDx / coreLen;
        const uy = coreDy / coreLen;
        if (!keepRawFirst) {
          const fx = rawFirst.x - coreFirst.x;
          const fy = rawFirst.y - coreFirst.y;
          const fAlong = -(fx * ux + fy * uy);
          const fPerp = Math.abs(fx * uy - fy * ux);
          if (fAlong >= 0 && fPerp <= 1.4) keepRawFirst = true;
        }
        if (!keepRawLast) {
          const lx = rawLast.x - coreLast.x;
          const ly = rawLast.y - coreLast.y;
          const lAlong = lx * ux + ly * uy;
          const lPerp = Math.abs(lx * uy - ly * ux);
          if (lAlong >= 0 && lPerp <= 1.4) keepRawLast = true;
        }
      }
      const middlePts = rawScreenPts.slice(trimStartIdx + 1, trimEndIdx);
      const trimmedPts = [
        ...(trimStartIdx === 0 ? [rawFirst] : (keepRawFirst ? [rawFirst, coreFirst] : [coreFirst])),
        ...middlePts,
        ...(trimEndIdx === rawScreenPts.length - 1 ? [rawLast] : (keepRawLast ? [coreLast, rawLast] : [coreLast]))
      ];

      const resampleStep = rawMaxDim < 30 ? 1.5 : 2.5;
      const screenPts = [trimmedPts[0]];
      for (let i = 1; i < trimmedPts.length - 1; i++) {
        const prev = screenPts[screenPts.length - 1];
        if (Math.hypot(trimmedPts[i].x - prev.x, trimmedPts[i].y - prev.y) >= resampleStep) {
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

      const W = Math.max(1, maxX - minX);
      const H = Math.max(1, maxY - minY);
      const maxDim = Math.max(W, H);
      const minDim = Math.min(W, H);

      // 직선 외 곡선·닫힌 도형(삼차개형, 포물선, 삼각형, 원, 타원, 직사각형)은 최소 크기(점 4개 · 30px) 유지
      if (stroke.points.length < 4 || arcLen < 30) return null;

      // 🌟 [PaleoSketch + CALI 표준 위상 기하학 분석기: 자기교차 · 회전수 · 볼록 껍질 충실도(Solidity)]
      // 1) 몸통 자기교차 검사 (양 끝 18% 여밈 오버랩 꼬리는 허용하고, '8'·'∞'·'α' 등 내부 X자 교차는 100% 검출)
      const cumScreenArc = new Float64Array(N);
      cumScreenArc[0] = 0;
      for (let i = 1; i < N; i++) {
        cumScreenArc[i] = cumScreenArc[i - 1] + Math.hypot(screenPts[i].x - screenPts[i - 1].x, screenPts[i].y - screenPts[i - 1].y);
      }
      const totalScreenArc = Math.max(1, cumScreenArc[N - 1]);
      const ccw = (A, B, C) => (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
      const segProperIntersect = (A, B, C, D) => {
        const d1 = ccw(A, B, C);
        const d2 = ccw(A, B, D);
        const d3 = ccw(C, D, A);
        const d4 = ccw(C, D, B);
        return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
      };
      let hasBodySelfIntersection = false;
      let closingCrossInfo = null;
      for (let i = 0; i < N - 3 && !hasBodySelfIntersection; i++) {
        const sA = cumScreenArc[i + 1];
        for (let j = i + 2; j < N - 1; j++) {
          const sB = cumScreenArc[j];
          if (segProperIntersect(screenPts[i], screenPts[i + 1], screenPts[j], screenPts[j + 1])) {
            // 원·사각형을 한 획으로 닫을 때 생기는 정상적인 시작(<=18%)↔끝(>=82%) 여밈 교차는 허용하되, 삐져나온 꼬리 제거용 교점 기록
            if (sA <= totalScreenArc * 0.18 && sB >= totalScreenArc * 0.82) {
              if (!closingCrossInfo) {
                const A = screenPts[i], B = screenPts[i + 1];
                const C = screenPts[j], D = screenPts[j + 1];
                const denom = (B.x - A.x) * (D.y - C.y) - (B.y - A.y) * (D.x - C.x);
                const tCross = Math.abs(denom) > 1e-6
                  ? Math.max(0, Math.min(1, ((C.x - A.x) * (D.y - C.y) - (C.y - A.y) * (D.x - C.x)) / denom))
                  : 0.5;
                closingCrossInfo = {
                  i,
                  j,
                  pt: { x: A.x + (B.x - A.x) * tCross, y: A.y + (B.y - A.y) * tCross }
                };
              }
              continue;
            }
            hasBodySelfIntersection = true;
            break;
          }
        }
      }
      if (hasBodySelfIntersection) return null;

      const horizSpan = Math.abs(pEnd.x - pStart.x);
      const gap = chordLen;
      const closedGapRatioLimit = stroke.isHighlighter ? 0.36 : 0.30;
      const closedArcRatioLimit = stroke.isHighlighter ? 0.24 : 0.24;
      const isClosedCandidate = Boolean(closingCrossInfo) || (
        gap <= Math.max(11.0, maxDim * closedGapRatioLimit) &&
        gap <= totalScreenArc * closedArcRatioLimit
      );

      // --- [2. 열린 수학 함수 곡선 판별: 삼차함수(Cubic Wave) & 이차함수/반원 아치(Parabola)] ---
      if (!isClosedCandidate && W >= 24 && H >= 22 && maxDim >= 34 && horizSpan >= W * 0.52) {
        // 필기 진행 방향을 좌->우로 정렬한 점열 생성
        const ptsLR = (pStart.x <= pEnd.x) ? screenPts : screenPts.slice().reverse();
        const pLeft = ptsLR[0];
        const pRight = ptsLR[N - 1];

        // 🛡️ [함수 그래프 필수 조건: X축 단조 전진성 (y = f(x) 검증 — '2', '3', '5', 'S', 'Z', 'ㄷ', 'ㄹ', '?' 100% 차단)]
        const trimMargin = Math.max(1, Math.floor(N * 0.08));
        let backwardXSum = 0;
        let maxBacktrackX = 0;
        let runningMaxX = ptsLR[trimMargin].x;
        for (let i = trimMargin; i < N - trimMargin; i++) {
          const curX = ptsLR[i].x;
          if (curX > runningMaxX) {
            runningMaxX = curX;
          } else if (runningMaxX - curX > maxBacktrackX) {
            maxBacktrackX = runningMaxX - curX;
          }
          if (i > trimMargin && ptsLR[i].x < ptsLR[i - 1].x) {
            backwardXSum += (ptsLR[i - 1].x - ptsLR[i].x);
          }
        }
        const isMonotonicXFunction = (
          backwardXSum <= W * 0.10 &&
          maxBacktrackX <= Math.max(4.0, W * 0.09)
        );

        if (isMonotonicXFunction) {
          // 유의미한 Y 방향 스윙(진폭 >= 0.18*H) 구간 수 카운트 (4차 W자·다중 물결 오인식 방지)
          const countSignificantYSwings = (minSwingH) => {
            let dir = 0;
            let anchorY = ptsLR[0].y;
            let extremumY = ptsLR[0].y;
            let swings = 0;
            for (let i = 1; i < N; i++) {
              const y = ptsLR[i].y;
              if (dir === 0) {
                if (y - anchorY >= minSwingH) {
                  dir = 1;
                  extremumY = y;
                  swings = 1;
                } else if (anchorY - y >= minSwingH) {
                  dir = -1;
                  extremumY = y;
                  swings = 1;
                }
              } else if (dir === 1) {
                if (y > extremumY) extremumY = y;
                else if (extremumY - y >= minSwingH) {
                  dir = -1;
                  extremumY = y;
                  swings++;
                }
              } else {
                if (y < extremumY) extremumY = y;
                else if (y - extremumY >= minSwingH) {
                  dir = 1;
                  extremumY = y;
                  swings++;
                }
              }
            }
            return swings;
          };
          const ySwingCount = countSignificantYSwings(0.18 * H);

          // (A) 극점 2개짜리 삼차함수 개형 (변곡점 점대칭 도형: ↗↘↗ 또는 ↘↗↘) 판별
          let bestUpDownUp = { swing: -1, i1: -1, i2: -1 };
          let bestDownUpDown = { swing: -1, i1: -1, i2: -1 };

          if (horizSpan >= W * 0.55 && ySwingCount === 3) {
            let minYIdxSoFar = 1;
            let maxYIdxSoFar = 1;
            for (let i2 = 2; i2 < N - 1; i2++) {
              if (ptsLR[i2 - 1].y < ptsLR[minYIdxSoFar].y) minYIdxSoFar = i2 - 1;
              if (ptsLR[i2 - 1].y > ptsLR[maxYIdxSoFar].y) maxYIdxSoFar = i2 - 1;

              // 1) ↗ ↘ ↗ (최고차항 양수 삼차함수: 극대 minYIdxSoFar -> 극소 i2, 좌->우 순서 필수!)
              const e1U = ptsLR[minYIdxSoFar];
              const e2U = ptsLR[i2];
              const sw1U = pLeft.y - e1U.y;
              const sw2U = e2U.y - e1U.y;
              const sw3U = e2U.y - pRight.y;
              if (sw1U >= 0.22 * H && sw2U >= 0.26 * H && sw3U >= 0.22 * H && (e2U.x - e1U.x) >= 0.14 * W) {
                const totalSw = sw1U + sw2U + sw3U;
                if (totalSw > bestUpDownUp.swing) {
                  bestUpDownUp = { swing: totalSw, i1: minYIdxSoFar, i2: i2 };
                }
              }

              // 2) ↘ ↗ ↘ (최고차항 음수 삼차함수: 극소 maxYIdxSoFar -> 극대 i2, 좌->우 순서 필수!)
              const e1D = ptsLR[maxYIdxSoFar];
              const e2D = ptsLR[i2];
              const sw1D = e1D.y - pLeft.y;
              const sw2D = e1D.y - e2D.y;
              const sw3D = pRight.y - e2D.y;
              if (sw1D >= 0.22 * H && sw2D >= 0.26 * H && sw3D >= 0.22 * H && (e2D.x - e1D.x) >= 0.14 * W) {
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

          // (B) 이차함수 포물선 및 반원 아치 (Parabola: 아래로 볼록 U / 위로 볼록 ∩) 판별
          if (ySwingCount === 2) {
            let botIdx = 1;
            let topIdx = 1;
            for (let i = 1; i < N - 1; i++) {
              if (ptsLR[i].y > ptsLR[botIdx].y) botIdx = i;
              if (ptsLR[i].y < ptsLR[topIdx].y) topIdx = i;
            }
            const botPeak = ptsLR[botIdx];
            const topPeak = ptsLR[topIdx];

            let preBotMinY = ptsLR[0].y;
            for (let i = 0; i < botIdx; i++) {
              if (ptsLR[i].y < preBotMinY) preBotMinY = ptsLR[i].y;
            }
            let postBotMinY = ptsLR[N - 1].y;
            for (let i = botIdx + 1; i < N; i++) {
              if (ptsLR[i].y < postBotMinY) postBotMinY = ptsLR[i].y;
            }

            let preTopMaxY = ptsLR[0].y;
            for (let i = 0; i < topIdx; i++) {
              if (ptsLR[i].y > preTopMaxY) preTopMaxY = ptsLR[i].y;
            }
            let postTopMaxY = ptsLR[N - 1].y;
            for (let i = topIdx + 1; i < N; i++) {
              if (ptsLR[i].y > postTopMaxY) postTopMaxY = ptsLR[i].y;
            }

            // 꼭짓점이 한쪽 끝에 쏠린 'L', 'J', 체크('✓') 차단 (가로 중앙 16%~84% 이내)
            const botInsideX = (botPeak.x >= minX + 0.16 * W && botPeak.x <= maxX - 0.16 * W);
            const topInsideX = (topPeak.x >= minX + 0.16 * W && topPeak.x <= maxX - 0.16 * W);

            const cupDownSwing = botPeak.y - preBotMinY;
            const cupUpSwing = botPeak.y - postBotMinY;
            const capUpSwing = preTopMaxY - topPeak.y;
            const capDownSwing = postTopMaxY - topPeak.y;

            const isCupCand = botInsideX &&
              (cupDownSwing >= 0.45 * H) && (cupUpSwing >= 0.45 * H) &&
              (Math.max(cupDownSwing, cupUpSwing) >= 0.70 * H);
            const isCapCand = topInsideX &&
              (capUpSwing >= 0.45 * H) && (capDownSwing >= 0.45 * H) &&
              (Math.max(capUpSwing, capDownSwing) >= 0.70 * H);

            if (isCupCand || isCapCand) {
              const peakPt = isCupCand ? botPeak : topPeak;
              const vy = isCupCand ? maxY : minY;
              const endY = isCupCand ? Math.min(preBotMinY, postBotMinY) : Math.max(preTopMaxY, postTopMaxY);
              const vx = (minX + maxX) / 2;
              const halfW = Math.max(1, W / 2);
              const evalCleanParaY = (x) => {
                const u = (x - vx) / halfW;
                return vy + (endY - vy) * (u * u);
              };

              // 1) 각진 사각 그릇('凵' / '冂' — 평평한 바닥이 가로 폭의 50% 이상 지속) 차단
              let flatMinX = Infinity, flatMaxX = -Infinity;
              for (let i = 0; i < N; i++) {
                if (Math.abs(ptsLR[i].y - vy) <= 0.08 * H) {
                  if (ptsLR[i].x < flatMinX) flatMinX = ptsLR[i].x;
                  if (ptsLR[i].x > flatMaxX) flatMaxX = ptsLR[i].x;
                }
              }
              const isFlatBottomBox = (flatMaxX > flatMinX) && ((flatMaxX - flatMinX) >= 0.50 * W);

              // 2) 뾰족한 'V'자 / '∧'자(절댓값 꺾은선) 차단 & 포물선/반원 피팅 오차 검증
              const sampleCount = 48;
              const paraScreenPts = [];
              for (let s = 0; s <= sampleCount; s++) {
                const sx = minX + W * (s / sampleCount);
                const sy = evalCleanParaY(sx);
                paraScreenPts.push({ x: sx, y: sy });
              }
              let distToParaSum = 0;
              let distToVSum = 0;
              for (let i = 0; i < N; i++) {
                const p = ptsLR[i];
                // 포물선 폴리라인까지의 최단 거리
                let bestDP = Infinity;
                for (let s = 0; s < sampleCount; s++) {
                  const d = this.distToSegment(p, paraScreenPts[s], paraScreenPts[s + 1]);
                  if (d < bestDP) bestDP = d;
                }
                distToParaSum += bestDP;
                const dV = Math.min(
                  this.distToSegment(p, pLeft, peakPt),
                  this.distToSegment(p, peakPt, pRight)
                );
                distToVSum += dV;
              }
              const avgDistToPara = distToParaSum / N;
              const avgDistToV = distToVSum / N;
              const isSharpVShape = (avgDistToV < maxDim * 0.032) && (avgDistToV < avgDistToPara * 0.68);

              if (!isFlatBottomBox && !isSharpVShape && avgDistToPara <= Math.max(4.5, 0.15 * H)) {
                return {
                  type: 'parabola',
                  closed: false,
                  pts: paraScreenPts.map(toTargetCoord)
                };
              }
            }
          }
        }
      }

      // --- [3. 닫힌 도형 판별: 단순 볼록 폐곡선 게이트 + 삼각형 · 정원 · 타원 · 직사각형] ---
      if (isClosedCandidate && arcLen >= 45 && minDim >= 18) {
        const loopPts = (closingCrossInfo && (closingCrossInfo.j - closingCrossInfo.i) >= 4)
          ? [closingCrossInfo.pt, ...screenPts.slice(closingCrossInfo.i + 1, closingCrossInfo.j + 1)]
          : screenPts;
        const NL = loopPts.length;
        if (NL < 4) return null;

        let lMinX = loopPts[0].x, lMaxX = loopPts[0].x;
        let lMinY = loopPts[0].y, lMaxY = loopPts[0].y;
        let loopArcLen = 0;
        for (let i = 0; i < NL; i++) {
          const lp = loopPts[i];
          if (lp.x < lMinX) lMinX = lp.x;
          if (lp.x > lMaxX) lMaxX = lp.x;
          if (lp.y < lMinY) lMinY = lp.y;
          if (lp.y > lMaxY) lMaxY = lp.y;
          if (i > 0) {
            loopArcLen += Math.hypot(lp.x - loopPts[i - 1].x, lp.y - loopPts[i - 1].y);
          }
        }
        const lW = Math.max(1, lMaxX - lMinX);
        const lH = Math.max(1, lMaxY - lMinY);
        const lMaxDim = Math.max(lW, lH);
        const lMinDim = Math.min(lW, lH);
        if (loopArcLen < 40 || lMinDim < 16) return null;

        // 🛡️ [위상 게이트 A: PaleoSketch 누적 회전각(Winding Angle) 검사 — '8'자(순회전 ~0°), '3'자(역회전 유턴), 2바퀴 나선 차단]
        const turnStep = Math.max(3.5, lMaxDim * 0.065);
        const turnPts = [loopPts[0]];
        for (let i = 1; i < NL - 1; i++) {
          const prev = turnPts[turnPts.length - 1];
          if (Math.hypot(loopPts[i].x - prev.x, loopPts[i].y - prev.y) >= turnStep) {
            turnPts.push(loopPts[i]);
          }
        }
        const lEnd = loopPts[NL - 1];
        if (Math.hypot(lEnd.x - turnPts[turnPts.length - 1].x, lEnd.y - turnPts[turnPts.length - 1].y) >= turnStep * 0.45) {
          turnPts.push(lEnd);
        }
        if (turnPts.length < 4) return null;

        let signedTurnSum = 0;
        let absTurnSum = 0;
        for (let i = 1; i < turnPts.length - 1; i++) {
          const vx1 = turnPts[i].x - turnPts[i - 1].x;
          const vy1 = turnPts[i].y - turnPts[i - 1].y;
          const vx2 = turnPts[i + 1].x - turnPts[i].x;
          const vy2 = turnPts[i + 1].y - turnPts[i].y;
          const l1 = Math.hypot(vx1, vy1);
          const l2 = Math.hypot(vx2, vy2);
          if (l1 < 0.5 || l2 < 0.5) continue;
          const dTheta = Math.atan2(vx1 * vy2 - vy1 * vx2, vx1 * vx2 + vy1 * vy2);
          signedTurnSum += dTheta;
          absTurnSum += Math.abs(dTheta);
        }
        const absNetTurn = Math.abs(signedTurnSum);
        // 삼각형(2꼭짓점 경유 ~225~240° = 3.9~4.2rad), 사각형(3꼭짓점 ~270° = 4.71rad), 원(~360° = 6.28rad) 허용 / '8'자(~0rad) 및 역회전('3') 차단
        if (absNetTurn < 3.30 || absNetTurn > 8.40) return null;
        if (absTurnSum > absNetTurn * 1.48 + 0.65) return null;

        // 🛡️ [위상 게이트 B: CALI 볼록 껍질(Convex Hull) 면적 충실도(Solidity) — 오목하게 파인 닫힌 '3', 'B', 'ㄷ', 하트, 초승달 100% 차단]
        let polyArea2 = 0;
        for (let i = 0; i < NL; i++) {
          const p1 = loopPts[i];
          const p2 = loopPts[(i + 1) % NL];
          polyArea2 += (p1.x * p2.y - p2.x * p1.y);
        }
        const polyArea = Math.abs(polyArea2) * 0.5;

        const sortedPts = loopPts.slice().sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
        const lower = [];
        for (let i = 0; i < sortedPts.length; i++) {
          while (lower.length >= 2 && ccw(lower[lower.length - 2], lower[lower.length - 1], sortedPts[i]) <= 0) {
            lower.pop();
          }
          lower.push(sortedPts[i]);
        }
        const upper = [];
        for (let i = sortedPts.length - 1; i >= 0; i--) {
          while (upper.length >= 2 && ccw(upper[upper.length - 2], upper[upper.length - 1], sortedPts[i]) <= 0) {
            upper.pop();
          }
          upper.push(sortedPts[i]);
        }
        lower.pop();
        upper.pop();
        const hull = lower.concat(upper);
        if (hull.length < 3) return null;

        let hullArea2 = 0;
        let hullPerim = 0;
        for (let i = 0; i < hull.length; i++) {
          const h1 = hull[i];
          const h2 = hull[(i + 1) % hull.length];
          hullArea2 += (h1.x * h2.y - h2.x * h1.y);
          hullPerim += Math.hypot(h2.x - h1.x, h2.y - h1.y);
        }
        const hullArea = Math.max(1, Math.abs(hullArea2) * 0.5);
        const solidity = polyArea / hullArea;
        if (solidity < 0.78) return null;
        if (loopArcLen < hullPerim * 0.76 || loopArcLen > hullPerim * 1.36) return null;

        const cx = (lMinX + lMaxX) / 2;
        const cy = (lMinY + lMaxY) / 2;
        const aspect = lMinDim / lMaxDim;
        const boxArea = lW * lH;
        const boxFillRatio = hullArea / Math.max(1, boxArea);

        // (A) 타원/원 오차 및 360° 8방위 커버리지 계산
        const rx = Math.max(1, lW / 2);
        const ry = Math.max(1, lH / 2);
        let rSum = 0;
        let uSum = 0;
        const radii = [];
        const uVals = [];
        let octantMask = 0;
        for (let i = 0; i < NL; i++) {
          const dxC = loopPts[i].x - cx;
          const dyC = loopPts[i].y - cy;
          const r = Math.hypot(dxC, dyC);
          radii.push(r);
          rSum += r;
          const u = Math.hypot(dxC / rx, dyC / ry);
          uVals.push(u);
          uSum += u;
          const oct = Math.floor(((Math.atan2(dyC, dxC) + Math.PI) / (Math.PI * 2)) * 8) & 7;
          octantMask |= (1 << oct);
        }
        let coveredOctants = 0;
        for (let b = 0; b < 8; b++) {
          if (octantMask & (1 << b)) coveredOctants++;
        }
        const avgR = rSum / NL;
        const avgU = uSum / NL;
        let varSum = 0;
        let uVarSum = 0;
        let maxUDev = 0;
        let distToEllipseSum = 0;
        for (let i = 0; i < NL; i++) {
          varSum += (radii[i] - avgR) ** 2;
          const uDiff = Math.abs(uVals[i] - avgU);
          if (uDiff > maxUDev) maxUDev = uDiff;
          uVarSum += uDiff * uDiff;
          distToEllipseSum += Math.abs(uVals[i] - 1.0) * ((rx + ry) / 2);
        }
        const stdDev = Math.sqrt(varSum / NL);
        const roundness = stdDev / (avgR || 1);
        const ellipseStd = Math.sqrt(uVarSum / NL) / (avgU || 1);
        const avgDistToEllipse = distToEllipseSum / NL;

        // (B) 직사각형 양방향 검증 (정규화 타원 공간 대각/축 방향 반경비 diagToCardRatio로 원·타원 오변환 100% 원천 차단)
        let distToBoxSum = 0;
        let maxDistToBox = 0;
        const edgeBand = Math.max(6.5, lMinDim * 0.24);
        let topBuckets = 0, botBuckets = 0, leftBuckets = 0, rightBuckets = 0;
        let minCornerTL = Infinity, minCornerTR = Infinity, minCornerBR = Infinity, minCornerBL = Infinity;
        let maxU_Q1 = 0, maxU_Q2 = 0, maxU_Q3 = 0, maxU_Q4 = 0;
        let diagUSum = 0, diagUCount = 0;
        let cardUSum = 0, cardUCount = 0;

        const markRectEdgeSample = (sx, sy) => {
          const dL = Math.abs(sx - lMinX);
          const dR = Math.abs(sx - lMaxX);
          const dT = Math.abs(sy - lMinY);
          const dB = Math.abs(sy - lMaxY);
          const uX = (sx - lMinX) / lW;
          const uY = (sy - lMinY) / lH;
          if (uX >= 0.16 && uX <= 0.84) {
            const bIdx = Math.min(2, Math.floor(((uX - 0.16) / 0.68) * 3));
            if (dT <= edgeBand) topBuckets |= (1 << bIdx);
            if (dB <= edgeBand) botBuckets |= (1 << bIdx);
          }
          if (uY >= 0.16 && uY <= 0.84) {
            const bIdx = Math.min(2, Math.floor(((uY - 0.16) / 0.68) * 3));
            if (dL <= edgeBand) leftBuckets |= (1 << bIdx);
            if (dR <= edgeBand) rightBuckets |= (1 << bIdx);
          }
          const nxE = (sx - cx) / rx;
          const nyE = (sy - cy) / ry;
          const uE = Math.hypot(nxE, nyE);
          if (nxE >= 0 && nyE < 0) { if (uE > maxU_Q1) maxU_Q1 = uE; }
          else if (nxE < 0 && nyE < 0) { if (uE > maxU_Q2) maxU_Q2 = uE; }
          else if (nxE < 0 && nyE >= 0) { if (uE > maxU_Q3) maxU_Q3 = uE; }
          else { if (uE > maxU_Q4) maxU_Q4 = uE; }

          const anx = Math.abs(nxE);
          const any = Math.abs(nyE);
          if (anx >= 0.42 && any >= 0.42) {
            diagUSum += uE;
            diagUCount++;
          } else if (anx <= 0.28 || any <= 0.28) {
            cardUSum += uE;
            cardUCount++;
          }
        };

        for (let i = 0; i < NL; i++) {
          const px = loopPts[i].x;
          const py = loopPts[i].y;
          const dLeft = Math.abs(px - lMinX);
          const dRight = Math.abs(px - lMaxX);
          const dTop = Math.abs(py - lMinY);
          const dBottom = Math.abs(py - lMaxY);
          const dMin = Math.min(dLeft, dRight, dTop, dBottom);
          distToBoxSum += dMin;
          if (dMin > maxDistToBox) maxDistToBox = dMin;

          markRectEdgeSample(px, py);
          if (i < NL - 1) {
            const nx = loopPts[i + 1].x;
            const ny = loopPts[i + 1].y;
            const segLen = Math.hypot(nx - px, ny - py);
            if (segLen > 4.0) {
              const subSteps = Math.min(24, Math.ceil(segLen / 4.0));
              for (let s = 1; s < subSteps; s++) {
                const t = s / subSteps;
                const ix = px + (nx - px) * t;
                const iy = py + (ny - py) * t;
                markRectEdgeSample(ix, iy);
                const idMin = Math.min(Math.abs(ix - lMinX), Math.abs(ix - lMaxX), Math.abs(iy - lMinY), Math.abs(iy - lMaxY));
                if (idMin > maxDistToBox) maxDistToBox = idMin;
              }
            }
          }

          const dTL = Math.hypot(px - lMinX, py - lMinY);
          const dTR = Math.hypot(px - lMaxX, py - lMinY);
          const dBR = Math.hypot(px - lMaxX, py - lMaxY);
          const dBL = Math.hypot(px - lMinX, py - lMaxY);
          if (dTL < minCornerTL) minCornerTL = dTL;
          if (dTR < minCornerTR) minCornerTR = dTR;
          if (dBR < minCornerBR) minCornerBR = dBR;
          if (dBL < minCornerBL) minCornerBL = dBL;
        }
        const avgDistToBox = distToBoxSum / NL;
        const countBits3 = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
        const edgeBucketSum = countBits3(topBuckets) + countBits3(botBuckets) + countBits3(leftBuckets) + countBits3(rightBuckets);
        const hasAllFourRectEdges = (
          countBits3(topBuckets) >= 1 &&
          countBits3(botBuckets) >= 1 &&
          countBits3(leftBuckets) >= 1 &&
          countBits3(rightBuckets) >= 1 &&
          edgeBucketSum >= 6
        );
        const cornerLimit = Math.max(10.0, lMinDim * 0.42);
        const sortedCorners = [minCornerTL, minCornerTR, minCornerBR, minCornerBL].sort((a, b) => a - b);
        const hasAllFourCorners = (
          sortedCorners[2] <= cornerLimit &&
          sortedCorners[3] <= Math.max(12.0, lMinDim * 0.48)
        );
        const avgCornerU = (maxU_Q1 + maxU_Q2 + maxU_Q3 + maxU_Q4) * 0.25;
        const avgDiagU = diagUCount > 0 ? (diagUSum / diagUCount) : avgCornerU;
        const avgCardU = cardUCount > 0 ? (cardUSum / cardUCount) : 1.0;
        const diagToCardRatio = avgDiagU / Math.max(0.70, avgCardU);
        const hasRectCornerBulge = (
          (avgCornerU >= 1.125 && diagToCardRatio >= 1.105) ||
          diagToCardRatio >= 1.135
        );
        const isValidAxisRect = (
          boxFillRatio >= 0.62 &&
          hasAllFourRectEdges &&
          hasAllFourCorners &&
          avgDistToBox < lMaxDim * 0.125 &&
          maxDistToBox <= Math.max(10.0, lMinDim * 0.36)
        );

        // (C) 삼각형(Triangle) 3꼭짓점 추출 + CALI 면적비(triArea/hullArea) + 세 변 밀착도 계산
        const calcTriStats = (v0, v1, v2) => {
          let sum = 0;
          let maxD = 0;
          for (let i = 0; i < NL; i++) {
            const d0 = this.distToSegment(loopPts[i], v0, v1);
            const d1 = this.distToSegment(loopPts[i], v1, v2);
            const d2 = this.distToSegment(loopPts[i], v2, v0);
            const dm = Math.min(d0, d1, d2);
            sum += dm;
            if (dm > maxD) maxD = dm;
          }
          return { avg: sum / NL, max: maxD };
        };

        const findTriFromSeed = (seedPt) => {
          let v1 = loopPts[0], maxD1 = -1;
          for (let i = 0; i < NL; i++) {
            const d = Math.hypot(loopPts[i].x - seedPt.x, loopPts[i].y - seedPt.y);
            if (d > maxD1) { maxD1 = d; v1 = loopPts[i]; }
          }
          let v2 = loopPts[0], maxD2 = -1;
          for (let i = 0; i < NL; i++) {
            const d = this.distToSegment(loopPts[i], seedPt, v1);
            if (d > maxD2) { maxD2 = d; v2 = loopPts[i]; }
          }
          let v0 = seedPt, maxD0 = -1;
          for (let i = 0; i < NL; i++) {
            const d = this.distToSegment(loopPts[i], v1, v2);
            if (d > maxD0) { maxD0 = d; v0 = loopPts[i]; }
          }
          return [v0, v1, v2];
        };

        const seedStart = { x: (loopPts[0].x + lEnd.x) / 2, y: (loopPts[0].y + lEnd.y) / 2 };
        let farFromCenter = loopPts[0], maxDC = -1;
        for (let i = 0; i < NL; i++) {
          const d = Math.hypot(loopPts[i].x - cx, loopPts[i].y - cy);
          if (d > maxDC) { maxDC = d; farFromCenter = loopPts[i]; }
        }

        const triA = findTriFromSeed(seedStart);
        const triB = findTriFromSeed(farFromCenter);
        const stTriA = calcTriStats(triA[0], triA[1], triA[2]);
        const stTriB = calcTriStats(triB[0], triB[1], triB[2]);
        const bestTri = (stTriA.avg <= stTriB.avg) ? triA : triB;
        const bestTriStats = (stTriA.avg <= stTriB.avg) ? stTriA : stTriB;
        const avgDistToTri = bestTriStats.avg;
        const maxDistToTri = bestTriStats.max;

        const triArea = Math.abs(ccw(bestTri[0], bestTri[1], bestTri[2])) * 0.5;
        const triHullFill = triArea / hullArea;
        const s01 = Math.hypot(bestTri[1].x - bestTri[0].x, bestTri[1].y - bestTri[0].y);
        const s12 = Math.hypot(bestTri[2].x - bestTri[1].x, bestTri[2].y - bestTri[1].y);
        const s20 = Math.hypot(bestTri[0].x - bestTri[2].x, bestTri[0].y - bestTri[2].y);
        const triValidSides = (Math.min(s01, s12, s20) >= lMaxDim * 0.34);

        if (
          triValidSides &&
          triHullFill >= 0.80 &&
          avgDistToTri < lMaxDim * 0.064 &&
          maxDistToTri < lMaxDim * 0.16 &&
          avgDistToTri < avgDistToBox * 0.82 &&
          avgDistToTri < avgDistToEllipse * 0.82
        ) {
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

        // 비회전 정책: 마름모(◇)나 회전된 각진 사각형(바운딩 4극점 직선 사각형에 밀착)이 원/타원으로 뭉개지지 않도록 보호
        let pTopExt = loopPts[0], pBotExt = loopPts[0], pLeftExt = loopPts[0], pRightExt = loopPts[0];
        for (let i = 1; i < NL; i++) {
          const sp = loopPts[i];
          if (sp.y < pTopExt.y) pTopExt = sp;
          if (sp.y > pBotExt.y) pBotExt = sp;
          if (sp.x < pLeftExt.x) pLeftExt = sp;
          if (sp.x > pRightExt.x) pRightExt = sp;
        }
        let distToDiamondSum = 0;
        for (let i = 0; i < NL; i++) {
          const sp = loopPts[i];
          distToDiamondSum += Math.min(
            this.distToSegment(sp, pTopExt, pRightExt),
            this.distToSegment(sp, pRightExt, pBotExt),
            this.distToSegment(sp, pBotExt, pLeftExt),
            this.distToSegment(sp, pLeftExt, pTopExt)
          );
        }
        const avgDistToDiamond = distToDiamondSum / NL;
        const isSharpTiltedQuad = !isValidAxisRect &&
          (avgDistToDiamond < lMaxDim * 0.042) &&
          (avgDistToDiamond < avgDistToEllipse * 0.65);

        const isBetterRectThanCircle = isValidAxisRect && (
          hasRectCornerBulge ||
          avgDistToBox <= avgDistToEllipse * 1.15
        );

        if (
          !isBetterRectThanCircle &&
          !hasRectCornerBulge &&
          !isSharpTiltedQuad &&
          coveredOctants >= 7 &&
          ellipseStd < 0.165 &&
          maxUDev <= 0.32 &&
          avgDistToEllipse < avgDistToBox * 0.90
        ) {
          if (aspect >= 0.76 && roundness < 0.19) {
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

        if (isValidAxisRect) {
          if (isCardPixel) {
            return {
              type: 'rect',
              min: { x: lMinX, y: lMinY },
              max: { x: lMaxX, y: lMaxY },
              aspect: aspect
            };
          }
          if (isBoard) {
            return {
              type: 'rect',
              min: this.screenToBoard(lMinX, lMinY),
              max: this.screenToBoard(lMaxX, lMaxY),
              aspect: aspect
            };
          }
          const m1 = this.screenToMath(lMinX, lMinY);
          const m2 = this.screenToMath(lMaxX, lMaxY);
          return {
            type: 'rect',
            min: { x: Math.min(m1.x, m2.x), y: Math.min(m1.y, m2.y) },
            max: { x: Math.max(m1.x, m2.x), y: Math.max(m1.y, m2.y) }
          };
        }
      }

      return null;
    }

    // 🌟 [도형 자동완성 실측 굵기 매칭]: 입필 삐침(0~18%)과 정지 홀드 떨림(82~100%)을 제외한
    // 실제 획 몸통 구간의 거리 가중 중앙값 필압(Trimmed Arc-Length Weighted Median Pressure) 추출
    _computeRepresentativeShapePressure(points, penStyle = 'ballpen', options = {}) {
      if (!penStyle || penStyle === 'ballpen' || penStyle === 'flat') return 0.5;
      if (options.isShiftLine) {
        if (options.hasHwP && typeof options.initialHwPressure === 'number' && options.initialHwPressure > 0) {
          const boosted = Math.pow(Math.max(0, options.initialHwPressure - 0.03) / 0.73, penStyle === 'brush' ? 0.80 : 0.88);
          return Math.round(Math.max(0.18, Math.min(0.95, boosted)) * 1000) / 1000;
        }
        return penStyle === 'brush' ? 0.58 : 0.60;
      }
      if (!Array.isArray(points) || points.length === 0) return 0.48;
      const L = points.length;
      if (L === 1) return 0.48;

      const cardW = options.cardW || 0;
      const cardH = options.cardH || 0;
      const toScreen = typeof options.toScreen === 'function' ? options.toScreen : null;
      const coords = new Array(L);
      for (let i = 0; i < L; i++) {
        const pt = points[i] || {};
        let sx = 0, sy = 0;
        if (cardW > 0 && cardH > 0 && pt.nx !== undefined) {
          sx = pt.nx * cardW;
          sy = pt.ny * cardH;
        } else if (toScreen && pt.x !== undefined) {
          const s = toScreen(pt);
          sx = s.x;
          sy = s.y;
        } else {
          sx = pt.x !== undefined ? pt.x : (pt.nx || 0) * 480;
          sy = pt.y !== undefined ? pt.y : (pt.ny || 0) * 360;
        }
        coords[i] = {
          x: sx,
          y: sy,
          p: (typeof pt.p === 'number' && !isNaN(pt.p)) ? pt.p : 0.48
        };
      }

      const segLens = new Array(L - 1);
      let totalLen = 0;
      for (let i = 0; i < L - 1; i++) {
        const d = Math.hypot(coords[i + 1].x - coords[i].x, coords[i + 1].y - coords[i].y);
        segLens[i] = d;
        totalLen += d;
      }
      if (totalLen < 1e-3) {
        return Math.round(Math.max(0.08, Math.min(0.98, coords[L - 1].p)) * 1000) / 1000;
      }

      const loDist = totalLen * 0.18;
      const hiDist = totalLen * 0.82;
      const samples = [];
      let cum = 0;
      for (let i = 0; i < L - 1; i++) {
        const ds = segLens[i];
        const d0 = cum;
        const d1 = cum + ds;
        cum = d1;
        if (ds < 1e-5) continue;
        const ov0 = Math.max(d0, loDist);
        const ov1 = Math.min(d1, hiDist);
        if (ov1 <= ov0) continue;
        const pA = coords[i].p;
        const pB = coords[i + 1].p;
        let pSeg;
        if (i === 0) {
          // 첫 점(pointerdown)의 인위적 입필 감쇠가 짧은 2~3점 분수선을 가늘게 만들지 않도록 보정
          pSeg = (!options.hasHwP && L <= 3) ? Math.max(pB, 0.45) : pB;
        } else {
          const u = (((ov0 + ov1) * 0.5) - d0) / ds;
          pSeg = pA + (pB - pA) * u;
          if (!options.hasHwP && L <= 3) {
            pSeg = Math.max(pSeg, 0.45);
          }
        }
        samples.push({ p: pSeg, w: ov1 - ov0 });
      }

      if (samples.length === 0) {
        const fallbackP = (!options.hasHwP && L <= 3) ? Math.max(coords[L - 1].p, 0.45) : coords[L >> 1].p;
        return Math.round(Math.max(0.08, Math.min(0.98, fallbackP)) * 1000) / 1000;
      }

      samples.sort((a, b) => a.p - b.p);
      let totalW = 0;
      for (let i = 0; i < samples.length; i++) totalW += samples[i].w;
      const halfW = totalW * 0.5;
      let accW = 0;
      let medP = samples[samples.length - 1].p;
      for (let i = 0; i < samples.length; i++) {
        accW += samples[i].w;
        if (accW >= halfW) {
          medP = samples[i].p;
          break;
        }
      }
      return Math.round(Math.max(0.08, Math.min(0.98, medP)) * 1000) / 1000;
    }

    getRecognizedShapePressure(stroke) {
      if (!stroke) return 0.5;
      const penStyle = stroke.isHighlighter ? 'ballpen' : (stroke.penStyle || 'ballpen');
      if (penStyle === 'ballpen' || penStyle === 'flat') return 0.5;
      if (typeof stroke.shapePressure === 'number' && !isNaN(stroke.shapePressure)) {
        return stroke.shapePressure;
      }
      if (stroke.shape && typeof stroke.shape.p === 'number' && !isNaN(stroke.shape.p)) {
        return stroke.shape.p;
      }
      if (stroke.cardShape && typeof stroke.cardShape.p === 'number' && !isNaN(stroke.cardShape.p)) {
        return stroke.cardShape.p;
      }
      const isInstantShift = Boolean(
        stroke._isShiftLine ||
        (typeof stroke.shapeSnapAt === 'number' && typeof stroke.tStart === 'number' && stroke.shapeSnapAt <= stroke.tStart + 1)
      );
      if (isInstantShift) return penStyle === 'brush' ? 0.58 : 0.60;
      return this._computeRepresentativeShapePressure(stroke.points, penStyle, { hasHwP: Boolean(stroke._hasHwP) });
    }

    // 🌟 [Shift + 드래그 직선 실측 굵기 1:1 매칭 전용 격리 헬퍼]:
    // 일반 필기 전역 상태를 전혀 건드리지 않고, 해당 Shift 스트로크의 비열거(_shiftTrack) 로컬 버퍼에서만
    // computeDynamicStrokePressure + _computeRepresentativeShapePressure(몸통 18~82% 가중 중앙값)를 수행합니다.
    _initShiftLinePressure(stroke, e, startScreenX, startScreenY, hasHwP = false) {
      if (!stroke) return 0.5;
      try {
        const penStyle = stroke.isHighlighter ? 'ballpen' : (stroke.penStyle || 'ballpen');
        if (penStyle === 'ballpen' || penStyle === 'flat') return 0.5;
        const rawP = (e && typeof e.pressure === 'number' && Number.isFinite(e.pressure) && e.pressure > 0)
          ? e.pressure
          : 0.5;
        const realHw = Boolean(hasHwP || (rawP > 0 && Math.abs(rawP - 0.5) > 0.01));
        if (realHw) stroke._hasHwP = true;
        const entryP = this._mapInitialStrokePressure(rawP, penStyle, realHw);
        const initialShapeP = this._computeRepresentativeShapePressure(
          null,
          penStyle,
          { isShiftLine: true, hasHwP: realHw, initialHwPressure: rawP }
        );
        const sx = Number.isFinite(startScreenX) ? startScreenX : 0;
        const sy = Number.isFinite(startScreenY) ? startScreenY : 0;
        const evTs = (e && typeof e.timeStamp === 'number' && Number.isFinite(e.timeStamp) && e.timeStamp > 0)
          ? e.timeStamp
          : 0;
        Object.defineProperty(stroke, '_shiftTrack', {
          value: {
            startX: sx,
            startY: sy,
            lastX: sx,
            lastY: sy,
            lastTs: evTs,
            lastP: entryP,
            hasHwP: realHw,
            maxRadialDist: 0,
            samples: [{ x: sx, y: sy, p: entryP }]
          },
          writable: true,
          configurable: true,
          enumerable: false
        });
        return initialShapeP;
      } catch (_) {
        return 0.5;
      }
    }

    _updateShiftLinePressure(stroke, e, curScreenX, curScreenY, eventToScreenFn = null) {
      if (!stroke || !stroke._shiftTrack) return;
      try {
        const penStyle = stroke.isHighlighter ? 'ballpen' : (stroke.penStyle || 'ballpen');
        if (penStyle === 'ballpen' || penStyle === 'flat') return;
        const tr = stroke._shiftTrack;
        if (!Array.isArray(tr.samples)) return;

        let events = null;
        if (typeof eventToScreenFn === 'function' && e && typeof e.getCoalescedEvents === 'function') {
          const inkProfile = (typeof this.getDeviceInkProfile === 'function') ? this.getDeviceInkProfile() : null;
          if (inkProfile && inkProfile.deviceType === 'pc' && typeof this._selectPcCoalescedEvents === 'function') {
            events = this._selectPcCoalescedEvents(e, inkProfile);
          } else if (inkProfile && inkProfile.useCoalescedEvents) {
            const c = e.getCoalescedEvents();
            if (c && c.length > 0) events = c;
          }
        }

        let updatedSamples = false;
        const pushStep = (ev, sx, sy) => {
          if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
          const stepDist = Math.hypot(sx - tr.lastX, sy - tr.lastY);
          if (stepDist < 1.2) return;

          const rawP = (ev && typeof ev.pressure === 'number' && Number.isFinite(ev.pressure) && ev.pressure > 0)
            ? ev.pressure
            : 0.5;
          if (!tr.hasHwP && rawP > 0 && Math.abs(rawP - 0.5) > 0.01) {
            tr.hasHwP = true;
            stroke._hasHwP = true;
          }
          const evTs = (ev && typeof ev.timeStamp === 'number' && Number.isFinite(ev.timeStamp) && ev.timeStamp > 0)
            ? ev.timeStamp
            : 0;
          const dtMs = (evTs > 0 && tr.lastTs > 0 && evTs > tr.lastTs) ? (evTs - tr.lastTs) : null;
          tr.lastX = sx;
          tr.lastY = sy;
          if (evTs > 0) tr.lastTs = evTs;

          let prevPForCalc = tr.lastP;
          if (tr.hasHwP && tr.samples.length === 1 && rawP > 0) {
            // 첫 접촉(pointerdown)의 미세 입필 압력이 본 드래그 압력보다 약할 때 짧은 분수선이 가늘어지지 않도록 정렬
            const boostedFirstMove = Math.min(1.0, Math.max(0.04, Math.pow(Math.max(0, rawP - 0.03) / 0.73, penStyle === 'brush' ? 0.80 : 0.88)));
            if (boostedFirstMove > prevPForCalc) {
              prevPForCalc = boostedFirstMove;
            }
          }

          const moveP = this.computeDynamicStrokePressure(
            rawP,
            tr.hasHwP,
            stepDist,
            penStyle,
            prevPForCalc,
            tr.samples.length,
            0,
            dtMs
          );
          tr.lastP = moveP;

          const radialDist = Math.hypot(sx - tr.startX, sy - tr.startY);
          // 선이 뻗어나가는 전진 확장 구간만 샘플링하여 끝점 스냅 미세 조준(저속 이동) 시 마우스 선 부풀림 원천 차단
          if (radialDist > tr.maxRadialDist + 1.0 && tr.samples.length < 320) {
            tr.maxRadialDist = radialDist;
            tr.samples.push({ x: sx, y: sy, p: moveP });
            updatedSamples = true;
          }
        };

        if (events && events.length > 1 && typeof eventToScreenFn === 'function') {
          for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            const sp = (i === events.length - 1 && Number.isFinite(curScreenX) && Number.isFinite(curScreenY))
              ? { x: curScreenX, y: curScreenY }
              : eventToScreenFn(ev);
            if (sp) pushStep(ev, sp.x, sp.y);
          }
        } else {
          pushStep(e, curScreenX, curScreenY);
        }

        if (updatedSamples && tr.samples.length >= 2) {
          const nextShapeP = this._computeRepresentativeShapePressure(
            tr.samples,
            penStyle,
            { hasHwP: tr.hasHwP }
          );
          if (typeof nextShapeP === 'number' && Number.isFinite(nextShapeP)) {
            stroke.shapePressure = nextShapeP;
            if (stroke.shape) stroke.shape.p = nextShapeP;
            if (stroke.cardShape) stroke.cardShape.p = nextShapeP;
          }
        }
      } catch (_) { }
    }

    _finalizeShiftLinePressure(stroke, e, endScreenX, endScreenY, isDotFallback = false) {
      if (!stroke) return;
      try {
        if (!isDotFallback && stroke._shiftTrack && Number.isFinite(endScreenX) && Number.isFinite(endScreenY)) {
          if (stroke._shiftTrack.samples && stroke._shiftTrack.samples.length < 2) {
            this._updateShiftLinePressure(stroke, e, endScreenX, endScreenY, null);
          }
        }
        delete stroke._shiftTrack;
        if (isDotFallback) {
          delete stroke.shapePressure;
          return;
        }
        const penStyle = stroke.isHighlighter ? 'ballpen' : (stroke.penStyle || 'ballpen');
        if (penStyle !== 'ballpen' && penStyle !== 'flat') {
          const finalP = this.getRecognizedShapePressure(stroke);
          if (typeof finalP === 'number' && Number.isFinite(finalP)) {
            stroke.shapePressure = finalP;
            if (stroke.shape) stroke.shape.p = finalP;
            if (stroke.cardShape) stroke.cardShape.p = finalP;
          }
        }
      } catch (_) {
        try { delete stroke._shiftTrack; } catch (__e) { }
      }
    }

    _createInkHoldTrackState(startX, startY) {
      const sx = Number(startX) || 0;
      const sy = Number(startY) || 0;
      return {
        startX: sx,
        startY: sy,
        lastMoveX: sx,
        lastMoveY: sy,
        anchorX: sx,
        anchorY: sy,
        maxReach: 0
      };
    }

    _shouldResetInkHoldOnMove(holdState, curX, curY, isTimerActive) {
      if (!holdState) return false;
      const stepDist = Math.hypot(curX - holdState.lastMoveX, curY - holdState.lastMoveY);
      holdState.lastMoveX = curX;
      holdState.lastMoveY = curY;

      const reach = Math.hypot(curX - holdState.startX, curY - holdState.startY);
      if (reach > holdState.maxReach) {
        holdState.maxReach = reach;
      }

      const dHold = Math.hypot(curX - holdState.anchorX, curY - holdState.anchorY);
      const slopRadius = !isTimerActive ? 1.8 : (holdState.maxReach < 16.0 ? 2.8 : 3.8);
      if (stepDist > 2.8 || dHold > slopRadius) {
        holdState.anchorX = curX;
        holdState.anchorY = curY;
        return true;
      }
      return false;
    }

    _isCleanRawTipForwardExtension(points, toScreenFn, rawTip) {
      if (!rawTip || !Array.isArray(points) || points.length === 0) return false;
      const sLast = toScreenFn(points[points.length - 1]);
      const tailGap = Math.hypot(rawTip.x - sLast.x, rawTip.y - sLast.y);
      if (tailGap < 0.25) return false;
      if (points.length === 1) {
        return tailGap <= 5.0;
      }
      if (tailGap > 3.5) return false;
      let backIdx = points.length - 2;
      while (backIdx > 0) {
        const cand = toScreenFn(points[backIdx]);
        if (Math.hypot(sLast.x - cand.x, sLast.y - cand.y) >= 4.0) break;
        backIdx--;
      }
      const sBack = toScreenFn(points[backIdx]);
      const vx = sLast.x - sBack.x;
      const vy = sLast.y - sBack.y;
      const vLen = Math.hypot(vx, vy);
      if (vLen < 0.5) return false;
      const tx = rawTip.x - sLast.x;
      const ty = rawTip.y - sLast.y;
      const cosAng = (vx * tx + vy * ty) / (vLen * tailGap);
      const perp = Math.abs(vx * ty - vy * tx) / vLen;
      return cosAng >= 0.88 && perp <= 1.1;
    }

    getShapeHoldDelayMs() {
      return 800;
    }

    _startInkHoldTimer() {
      if (this._inkHoldTimer) {
        clearTimeout(this._inkHoldTimer);
        this._inkHoldTimer = null;
      }
      if (!this.isDrawingInk || !this.currentInkStroke) return;

      const holdMs = this.getShapeHoldDelayMs();
      const checkHold = () => {
        this._inkHoldTimer = null;
        if (!this.isDrawingInk || !this.currentInkStroke || this._inkHoldDetected) return;
        const idleMs = Date.now() - (this._lastSignificantMoveTime || 0);
        if (idleMs < holdMs - 5) {
          this._inkHoldTimer = setTimeout(checkHold, Math.max(16, holdMs - idleMs));
          return;
        }
        this._onInkHoldTriggered();
      };

      this._inkHoldTimer = setTimeout(checkHold, holdMs);
    }

    // 🌟 [아이패드 강화유리 홀드 대기(600ms) 중 애플펜슬 미세 미끄러짐·틸트 흔들림 점 정밀 분리]:
    // 정지 홀드 타이머가 시작되기 전 실제 필기 구간의 궤적과 코너('ㄴ', '3')는 100% 보존하고,
    // 멈춰서 대기하는 홀드 구간(ageMs < holdMs - 5) 동안 정지 지점 주변(6.5px 이내)에서 맴돈 떨림·대각선 틸트 점열만 제거합니다.
    _stripHoldDwellTailPoints(points, ptTimes, toScreenFn, nowPerf) {
      if (!Array.isArray(points) || points.length < 3 || !Array.isArray(ptTimes) || ptTimes.length !== points.length) {
        return { points, trimmedDwell: false };
      }
      const M = points.length;
      const holdMs = this.getShapeHoldDelayMs();
      const dwellWindowMs = holdMs - 5;
      if (typeof ptTimes[M - 1] !== 'number' || (nowPerf - ptTimes[M - 1]) >= holdMs + 15) {
        return { points, trimmedDwell: false };
      }
      const sPts = points.map(toScreenFn);

      // 홀드 대기 구간 진입 직전의 마지막 실제 필기 인덱스 탐색
      let splitIdx = M - 1;
      while (splitIdx > 1 && typeof ptTimes[splitIdx] === 'number' && (nowPerf - ptTimes[splitIdx]) < dwellWindowMs) {
        splitIdx--;
      }

      // 초단거리 획 전체가 통째로 잘리지 않도록 시작점 기준 최소 5.0px 전진 이후 지점만 홀드 꼬리 후보로 검사
      while (splitIdx < M - 1 && Math.hypot(sPts[splitIdx].x - sPts[0].x, sPts[splitIdx].y - sPts[0].y) < 5.0) {
        splitIdx++;
      }

      // 홀드 진입 직후 일직선 정방향 관성 전진만 한 끝점은 보존하고, 대각선/수직 틸트 흔들림 및 지그재그 뭉침은 제거
      while (splitIdx < M - 1) {
        const anchor = sPts[splitIdx];
        let backIdx = splitIdx - 1;
        while (backIdx > 0 && Math.hypot(anchor.x - sPts[backIdx].x, anchor.y - sPts[backIdx].y) < 4.5) {
          backIdx--;
        }
        const refPt = sPts[backIdx];
        const cDx = anchor.x - refPt.x;
        const cDy = anchor.y - refPt.y;
        const cLen = Math.hypot(cDx, cDy);

        let maxClusterR = 0;
        let maxForwardProj = 0;
        let maxPerpDev = 0;
        let tailArc = 0;
        for (let j = splitIdx + 1; j < M; j++) {
          const dx = sPts[j].x - anchor.x;
          const dy = sPts[j].y - anchor.y;
          const d = Math.hypot(dx, dy);
          if (d > maxClusterR) maxClusterR = d;
          tailArc += Math.hypot(sPts[j].x - sPts[j - 1].x, sPts[j].y - sPts[j - 1].y);
          if (cLen > 0.8) {
            const proj = (dx * cDx + dy * cDy) / cLen;
            const perp = Math.abs(dx * cDy - dy * cDx) / cLen;
            if (proj > maxForwardProj) maxForwardProj = proj;
            if (perp > maxPerpDev) maxPerpDev = perp;
          }
        }
        const isCleanForwardInertia = (
          cLen > 0.8 &&
          maxForwardProj > 1.5 &&
          maxPerpDev <= 1.25 &&
          tailArc <= Math.max(1.8, maxForwardProj * 1.22)
        );
        if (maxClusterR <= 6.5 && !isCleanForwardInertia) {
          return {
            points: points.slice(0, splitIdx + 1),
            trimmedDwell: true
          };
        }
        splitIdx++;
      }
      return { points, trimmedDwell: false };
    }

    _onInkHoldTriggered() {
      if (!this.isDrawingInk || !this.currentInkStroke) return;
      const nowPerf = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
      const isGraphTarget = (this.currentInkStroke.target !== 'board');
      const toScr = (pt) => isGraphTarget ? this.mathToScreen(pt.x, pt.y) : this.boardToScreen(pt.x, pt.y);
      const fromScr = (sp) => isGraphTarget ? this.screenToMath(sp.x, sp.y) : this.screenToBoard(sp.x, sp.y);

      let strokeForHold = this.currentInkStroke;
      if (this._pcMainStrokeFairer && typeof this._pcMainStrokeFairer.peekPendingTail === 'function') {
        const extraScreenPts = this._pcMainStrokeFairer.peekPendingTail(this._lastRawInkScreenPos);
        if (extraScreenPts.length > 0) {
          const mergedPts = this.currentInkStroke.points.concat(
            extraScreenPts.map(sp => {
              const c = fromScr(sp);
              return { x: c.x, y: c.y, p: sp.p, t: sp.t };
            })
          );
          strokeForHold = { ...this.currentInkStroke, points: mergedPts };
        }
      } else if (Array.isArray(this.currentInkStroke.points) && this.currentInkStroke.points.length >= 1) {
        // 아이패드(비-Fairer) 경로: 홀드 대기 중 쌓인 유리면 미세 떨림 제거 + 스트림라인으로 뒤처진 일직선 전진 끝점 복원
        const stripped = this._stripHoldDwellTailPoints(
          this.currentInkStroke.points,
          this.currentInkStroke._ptTimes,
          toScr,
          nowPerf
        );
        let cleanPts = stripped.points;
        if (!stripped.trimmedDwell && this._isCleanRawTipForwardExtension(cleanPts, toScr, this._lastRawInkScreenPos)) {
          const cEnd = fromScr(this._lastRawInkScreenPos);
          const lastPtObj = cleanPts[cleanPts.length - 1];
          cleanPts = cleanPts.concat([{ x: cEnd.x, y: cEnd.y, p: lastPtObj.p, t: lastPtObj.t }]);
        }
        if (cleanPts !== this.currentInkStroke.points) {
          strokeForHold = { ...this.currentInkStroke, points: cleanPts };
        }
      }
      const shape = this.recognizeInkShape(strokeForHold);
      if (shape) {
        const ptsForPressure = (
          shape.type === 'line' &&
          Array.isArray(shape._coreRange) &&
          shape._coreRange[1] > shape._coreRange[0]
        )
          ? strokeForHold.points.slice(shape._coreRange[0], shape._coreRange[1] + 1)
          : strokeForHold.points;
        const shapeP = this._computeRepresentativeShapePressure(
          ptsForPressure,
          strokeForHold.penStyle || 'ballpen',
          {
            hasHwP: Boolean(this._strokeHasRealPressure),
            toScreen: toScr
          }
        );
        shape.p = shapeP;
        if (strokeForHold !== this.currentInkStroke) {
          this.currentInkStroke.points = strokeForHold.points;
        }
        this._pcMainStrokeFairer = null;
        this._inkHoldDetected = true;
        this.currentInkStroke.shapePressure = shapeP;
        this.currentInkStroke.shape = shape;
        this.currentInkStroke.isShape = true;
        if (this.isAudioRecording) {
          const recT = this.getAudioRecordElapsedMs();
          this.currentInkStroke.tEnd = recT;
          this.currentInkStroke.shapeSnapAt = recT;
          if (shape && shape.type === 'line' && shape.end) {
            shape.endTrack = [{ t: Math.round(recT), x: shape.end.x, y: shape.end.y }];
          }
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
      const dist = Math.hypot(dx, dy);
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      const absAngle = Math.abs(angleDeg);

      // 홀드 드래그 중 수평·수직·45° 히스테리시스 스냅 (이미 스냅된 축은 5.0°까지 안정 유지하여 분수선 길이 조절 시 풀림 방지)
      const horizThresh = (shape.snapped === 'horizontal') ? 5.0 : 4.0;
      const vertThresh = (shape.snapped === 'vertical') ? 5.0 : 4.0;
      const diagAngleThresh = (shape.snapped === 'diagonal') ? 2.4 : 1.8;
      const shortHorizAssist = (dist < 28 && Math.abs(dy) <= (shape.snapped === 'horizontal' ? 2.5 : 2.0) && Math.abs(dx) >= 7.0);
      const shortVertAssist = (dist < 28 && Math.abs(dx) <= (shape.snapped === 'vertical' ? 2.5 : 2.0) && Math.abs(dy) >= 7.0);

      if (absAngle < horizThresh || absAngle > (180 - horizThresh) || shortHorizAssist) {
        endY = sStart.y;
        shape.snapped = 'horizontal';
      } else if (Math.abs(absAngle - 90) < vertThresh || shortVertAssist) {
        endX = sStart.x;
        shape.snapped = 'vertical';
      } else if (Math.abs(absAngle - 45) < diagAngleThresh || Math.abs(absAngle - 135) < diagAngleThresh) {
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
    _buildNormalizedPointsFromCardShape(cardShape, tStart, tEnd, shapePressure) {
      if (!cardShape) return [];
      const ts = (typeof tStart === 'number') ? tStart : undefined;
      const te = (typeof tEnd === 'number') ? tEnd : ts;
      const makeTime = (u) => (ts !== undefined && te !== undefined) ? Math.round(ts + (te - ts) * u) : undefined;
      const ptP = (typeof shapePressure === 'number' && !isNaN(shapePressure))
        ? shapePressure
        : ((cardShape && typeof cardShape.p === 'number' && !isNaN(cardShape.p)) ? cardShape.p : 0.5);
      const out = [];

      if (cardShape.type === 'line' && cardShape.start && cardShape.end) {
        const steps = 24;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          out.push({
            nx: cardShape.start.nx + (cardShape.end.nx - cardShape.start.nx) * u,
            ny: cardShape.start.ny + (cardShape.end.ny - cardShape.start.ny) * u,
            p: ptP,
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
            p: ptP,
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
              p: ptP,
              t: makeTime(uAll)
            });
          }
        }
        out.push({ nx: corners[4].nx, ny: corners[4].ny, p: ptP, t: makeTime(1) });
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
                p: ptP,
                t: makeTime(uAll)
              });
            }
          }
          const lastV = vertices[vertices.length - 1];
          out.push({ nx: lastV.nx, ny: lastV.ny, p: ptP, t: makeTime(1) });
          return out;
        }
        const len = vertices.length;
        for (let i = 0; i < len; i++) {
          const u = len > 1 ? (i / (len - 1)) : 1;
          out.push({
            nx: vertices[i].nx,
            ny: vertices[i].ny,
            p: ptP,
            t: makeTime(u)
          });
        }
        return out;
      }
      return out;
    }

    recognizeAndApplyCardStrokeShape(cardStroke, cardW, cardH) {
      if (!cardStroke || !Array.isArray(cardStroke.points)) return false;
      const nowPerf = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
      const w = Math.max(1, cardW || 480);
      const h = Math.max(1, cardH || 360);
      let ptsForHold = cardStroke.points.map(pt => ({ x: pt.nx * w, y: pt.ny * h, p: pt.p }));
      if (cardStroke._pcFairer && typeof cardStroke._pcFairer.peekPendingTail === 'function') {
        const extra = cardStroke._pcFairer.peekPendingTail(cardStroke._lastRawPx);
        if (extra.length > 0) {
          ptsForHold = ptsForHold.concat(extra.map(sp => ({ x: sp.x, y: sp.y, p: sp.p })));
        }
      } else if (ptsForHold.length >= 1) {
        const stripped = this._stripHoldDwellTailPoints(
          ptsForHold,
          cardStroke._ptTimes,
          (pt) => pt,
          nowPerf
        );
        ptsForHold = stripped.points;
        if (!stripped.trimmedDwell && this._isCleanRawTipForwardExtension(ptsForHold, (pt) => pt, cardStroke._lastRawPx)) {
          const sLast = ptsForHold[ptsForHold.length - 1];
          const rawTip = cardStroke._lastRawPx;
          ptsForHold = ptsForHold.concat([{ x: rawTip.x, y: rawTip.y, p: sLast.p }]);
        }
      }
      if (ptsForHold.length < 2) return false;
      const pixelStroke = {
        _isCardPixelSpace: true,
        isHighlighter: Boolean(cardStroke.isHighlighter),
        points: ptsForHold
      };
      const shape = this.recognizeInkShape(pixelStroke);
      if (!shape) return false;
      const cardPtsForPressure = (
        shape.type === 'line' &&
        Array.isArray(shape._coreRange) &&
        shape._coreRange[1] > shape._coreRange[0]
      )
        ? ptsForHold.slice(shape._coreRange[0], shape._coreRange[1] + 1)
        : ptsForHold;
      const shapeP = this._computeRepresentativeShapePressure(
        cardPtsForPressure,
        cardStroke.penStyle || 'ballpen',
        { hasHwP: Boolean(cardStroke._hasHwP) }
      );
      cardStroke._pcFairer = null;

      let cardShape = null;
      if (shape.type === 'line' && shape.start && shape.end) {
        cardShape = {
          type: 'line',
          start: { nx: shape.start.x / w, ny: shape.start.y / h },
          end: { nx: shape.end.x / w, ny: shape.end.y / h },
          snapped: shape.snapped || null,
          p: shapeP
        };
      } else if (shape.type === 'circle' && shape.center) {
        cardShape = {
          type: 'circle',
          center: { nx: shape.center.x / w, ny: shape.center.y / h },
          rx: shape.radius / w,
          ry: shape.radius / h,
          p: shapeP
        };
      } else if (shape.type === 'ellipse' && shape.center) {
        cardShape = {
          type: 'ellipse',
          center: { nx: shape.center.x / w, ny: shape.center.y / h },
          rx: shape.rx / w,
          ry: shape.ry / h,
          p: shapeP
        };
      } else if (shape.type === 'rect' && shape.min && shape.max) {
        cardShape = {
          type: 'rect',
          min: { nx: Math.min(shape.min.x, shape.max.x) / w, ny: Math.min(shape.min.y, shape.max.y) / h },
          max: { nx: Math.max(shape.min.x, shape.max.x) / w, ny: Math.max(shape.min.y, shape.max.y) / h },
          p: shapeP
        };
      } else if (Array.isArray(shape.pts) && shape.pts.length >= 2) {
        cardShape = {
          type: shape.type,
          closed: Boolean(shape.closed),
          pts: shape.pts.map(p => ({ nx: p.x / w, ny: p.y / h })),
          p: shapeP
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
      cardStroke.shapePressure = shapeP;
      cardStroke.cardShape = cardShape;
      cardStroke.points = this._buildNormalizedPointsFromCardShape(cardShape, cardStroke.tStart, recT, shapeP);
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
      const dist = Math.hypot(dx, dy);
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      const absAngle = Math.abs(angleDeg);

      const horizThresh = (sh.snapped === 'horizontal') ? 5.0 : 4.0;
      const vertThresh = (sh.snapped === 'vertical') ? 5.0 : 4.0;
      const diagAngleThresh = (sh.snapped === 'diagonal') ? 2.4 : 1.8;
      const shortHorizAssist = (dist < 28 && Math.abs(dy) <= (sh.snapped === 'horizontal' ? 2.5 : 2.0) && Math.abs(dx) >= 7.0);
      const shortVertAssist = (dist < 28 && Math.abs(dx) <= (sh.snapped === 'vertical' ? 2.5 : 2.0) && Math.abs(dy) >= 7.0);

      if (absAngle < horizThresh || absAngle > (180 - horizThresh) || shortHorizAssist) {
        endY = sStartY;
        sh.snapped = 'horizontal';
      } else if (Math.abs(absAngle - 90) < vertThresh || shortVertAssist) {
        endX = sStartX;
        sh.snapped = 'vertical';
      } else if (Math.abs(absAngle - 45) < diagAngleThresh || Math.abs(absAngle - 135) < diagAngleThresh) {
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
      const shapeP = this.getRecognizedShapePressure(cardStroke);
      cardStroke.points = this._buildNormalizedPointsFromCardShape(sh, cardStroke.tStart, recT, shapeP);
      return true;
    }

    drawCardRecognizedShape(ctx, stroke, ox, oy, w, h, baseSize) {
      if (!ctx || !stroke || !stroke.isShape || !stroke.cardShape) return false;
      const sh = stroke.cardShape;
      const isHighlighter = Boolean(stroke.isHighlighter);
      const penStyle = isHighlighter ? 'ballpen' : (stroke.penStyle || 'ballpen');
      const blurVal = isHighlighter
        ? 0
        : Math.max(0, Math.min(5.0, (typeof stroke.softBlur === 'number' && !isNaN(stroke.softBlur)) ? stroke.softBlur : (this.inkSoftBlur || 0)));
      const effBaseSize = (blurVal > 0) ? baseSize * Math.max(0.76, 1.0 - blurVal * 0.038) : baseSize;
      const dpr = (typeof this.getCanvasDpr === 'function') ? this.getCanvasDpr() : (window.devicePixelRatio || 1);
      const isFlatNib = (!isHighlighter && penStyle === 'flat');
      const nibX = isFlatNib ? 1.38 : 1.0;
      const nibY = isFlatNib ? 0.68 : 1.0;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (!isHighlighter) {
        const shapeP = this.getRecognizedShapePressure(stroke);
        ctx.lineWidth = this.computePenStyleWidth(effBaseSize, shapeP, penStyle);
        if (blurVal > 0) {
          ctx.shadowColor = ctx.strokeStyle || '#1e293b';
          ctx.shadowBlur = blurVal * dpr * 0.65;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowBlur = 0;
        }
      }
      if (isFlatNib) {
        ctx.scale(nibX, nibY);
      }

      if (sh.type === 'line' && sh.start && sh.end) {
        ctx.beginPath();
        ctx.moveTo((ox + sh.start.nx * w) / nibX, (oy + sh.start.ny * h) / nibY);
        ctx.lineTo((ox + sh.end.nx * w) / nibX, (oy + sh.end.ny * h) / nibY);
        ctx.stroke();
        ctx.restore();
        return true;
      }
      if ((sh.type === 'circle' || sh.type === 'ellipse') && sh.center) {
        const cx = ox + sh.center.nx * w;
        const cy = oy + sh.center.ny * h;
        const rx = Math.max(2, Math.abs((sh.rx || 0) * w));
        const ry = Math.max(2, Math.abs((sh.ry || sh.rx || 0) * h));
        ctx.beginPath();
        ctx.ellipse(cx / nibX, cy / nibY, rx / nibX, ry / nibY, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return true;
      }
      if (sh.type === 'rect' && sh.min && sh.max) {
        const x1 = ox + sh.min.nx * w;
        const y1 = oy + sh.min.ny * h;
        const x2 = ox + sh.max.nx * w;
        const y2 = oy + sh.max.ny * h;
        ctx.beginPath();
        ctx.rect(Math.min(x1, x2) / nibX, Math.min(y1, y2) / nibY, Math.abs(x2 - x1) / nibX, Math.abs(y2 - y1) / nibY);
        ctx.stroke();
        ctx.restore();
        return true;
      }
      if (Array.isArray(sh.pts) && sh.pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo((ox + sh.pts[0].nx * w) / nibX, (oy + sh.pts[0].ny * h) / nibY);
        for (let i = 1; i < sh.pts.length; i++) {
          ctx.lineTo((ox + sh.pts[i].nx * w) / nibX, (oy + sh.pts[i].ny * h) / nibY);
        }
        if (sh.closed) ctx.closePath();
        ctx.stroke();
        ctx.restore();
        return true;
      }
      ctx.restore();
      return false;
    }

    // 🌟 [굿노트/삼성노트 표준] 올가미(Lasso) 핵심 연산 및 바운딩 박스 렌더러 🌟
    _getLassoViewSignature() {
      return `${this.boardPanX || 0}|${this.boardPanY || 0}|${this.boardZoom || 1}|${this.boardZoomOffsetX || 0}|${this.boardZoomOffsetY || 0}|${this.panX || 0}|${this.panY || 0}|${this.zoomLevel || 1}|${this.screenWidth || 0}|${this.screenHeight || 0}`;
    }

    _ensureFreshLassoBoundingBox() {
      const hasSelection = (this.selectedInkStrokes && this.selectedInkStrokes.length > 0) ||
        (this.selectedTextLabels && this.selectedTextLabels.length > 0);
      if (!hasSelection) return null;
      const viewSig = this._getLassoViewSignature();
      if (!this.lassoBoundingBox || this._lassoBBoxViewSig !== viewSig) {
        this.lassoBoundingBox = this.calculateStrokesBoundingBox(this.selectedInkStrokes, this.selectedTextLabels);
      }
      return this.lassoBoundingBox;
    }

    isPointInLassoSelection(pos) {
      if (!pos) return false;
      const bbox = this._ensureFreshLassoBoundingBox();
      if (!bbox) return false;
      const pad = 10;
      return (
        pos.x >= bbox.minX - pad &&
        pos.x <= bbox.maxX + pad &&
        pos.y >= bbox.minY - pad &&
        pos.y <= bbox.maxY + pad
      );
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

      this._lassoBBoxViewSig = this._getLassoViewSignature();
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
      if (!stroke || stroke.isGraphStamp || !lassoPoly || lassoPoly.length < 3) return false;
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
      if (prev && prev.widgetEl && prev.widgetEl.dataset) {
        delete prev.widgetEl.dataset.lassoCursor;
      }
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

      if (hasSel && cl.bboxNorm) {
        const pad = 8;
        const x1 = cl.bboxNorm.minNx * w - pad;
        const y1 = cl.bboxNorm.minNy * h - pad;
        const x2 = cl.bboxNorm.maxNx * w + pad;
        const y2 = cl.bboxNorm.maxNy * h + pad;

        ctx.save();
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        ctx.setLineDash([]);
        const corners = [
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x1, y: y2 },
          { x: x2, y: y2 }
        ];
        corners.forEach(c => {
          ctx.beginPath();
          ctx.arc(c.x, c.y, 5.0, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = '#0284c7';
          ctx.stroke();
        });
        ctx.restore();
      }

      this.syncLassoActionBarUI();
    }

    syncLassoActionBarUI() {
      const bar = document.getElementById('lassoActionFloatingBar');
      if (!bar) return;

      if (this._isAudioReplayActive) {
        const rLasso = (this.audioReplayViewMode !== 'note' && this._currentAppliedAudioKeyframe)
          ? this._currentAppliedAudioKeyframe.lassoState
          : null;
        if (!rLasso || !rLasso.showBar || !Array.isArray(rLasso.bbox) || rLasso.bbox.length < 4) {
          bar.style.display = 'none';
          return;
        }
        const [minX, minY, maxX, maxY] = rLasso.bbox;
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
      const recColorSnap = (hasStrokes && this.isAudioRecording && typeof this._snapshotInkListForReconcile === 'function')
        ? this._snapshotInkListForReconcile(this.inkStrokes)
        : null;
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
      if (recColorSnap && this.isAudioRecording && typeof this._reconcileInkStrokesForAudioRecording === 'function') {
        this._reconcileInkStrokesForAudioRecording(recColorSnap, this.inkStrokes);
      }
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        try { this._recordAudioWorkspaceStateIfNeeded(true); } catch (_) { }
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
        const recCardDupT = (this.isAudioRecording && typeof this.getAudioRecordElapsedMs === 'function')
          ? Math.max(0, Math.round(this.getAudioRecordElapsedMs()))
          : null;
        cl.selectedStrokes.forEach(orig => {
          const clone = JSON.parse(JSON.stringify(orig));
          this.translateCardStrokeNorm(clone, dnx, dny);
          if (recCardDupT !== null && typeof this._stampStrokeAppearedAtRecordingTime === 'function') {
            this._stampStrokeAppearedAtRecordingTime(clone, recCardDupT);
          }
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
          if (this.isAudioRecording && typeof this._stampStrokeAppearedAtRecordingTime === 'function') {
            this._stampStrokeAppearedAtRecordingTime(clone);
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
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        try { this._recordAudioWorkspaceStateIfNeeded(true); } catch (_) { }
      }
      this._inkBakeDirty = true;
      this.render();
      this.showToast('📋 선택한 필기/도형이 복제되었습니다! 바로 드래그하여 이동하세요.');
    }

    getLassoResizeHandleAt(pos) {
      if (!pos) return null;
      const bbox = this._ensureFreshLassoBoundingBox();
      if (!bbox) return null;

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
        if (this.isAudioRecording && typeof this._archiveStrokeRemovedDuringRecording === 'function') {
          const ck = cl.widgetEl && typeof this.getAudioCardKey === 'function' ? this.getAudioCardKey(cl.widgetEl) : null;
          const recDelT = Math.max(0, Math.round(this.getAudioRecordElapsedMs()));
          cl.selectedStrokes.forEach(st => this._archiveStrokeRemovedDuringRecording(st, recDelT, ck ? { cardKey: ck } : null));
        }
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
        if (this.isAudioRecording && typeof this._archiveStrokeRemovedDuringRecording === 'function') {
          const recDelT = Math.max(0, Math.round(this.getAudioRecordElapsedMs()));
          this.selectedInkStrokes.forEach(st => this._archiveStrokeRemovedDuringRecording(st, recDelT));
        }
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
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        try { this._recordAudioWorkspaceStateIfNeeded(true); } catch (_) { }
      }
      if (this.activeInkTool === 'lasso') {
        this.setActiveInkTool('pen');
        return;
      }
      this.syncLassoActionBarUI();
      this.render();
    }

    drawLassoOverlay(ctx) {
      if (this._isAudioReplayActive) {
        const rLasso = (this.audioReplayViewMode !== 'note' && this._currentAppliedAudioKeyframe)
          ? this._currentAppliedAudioKeyframe.lassoState
          : null;
        if (rLasso) {
          if (rLasso.selecting && Array.isArray(rLasso.pts) && rLasso.pts.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(rLasso.pts[0][0], rLasso.pts[0][1]);
            for (let i = 1; i < rLasso.pts.length; i++) {
              ctx.lineTo(rLasso.pts[i][0], rLasso.pts[i][1]);
            }
            ctx.strokeStyle = '#00d2d3';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([6, 5]);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.restore();
          }
          if (Array.isArray(rLasso.bbox) && rLasso.bbox.length >= 4) {
            const pad = 10;
            const x1 = rLasso.bbox[0] - pad;
            const y1 = rLasso.bbox[1] - pad;
            const x2 = rLasso.bbox[2] + pad;
            const y2 = rLasso.bbox[3] + pad;
            ctx.save();
            ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            ctx.setLineDash([]);
            const corners = [
              { x: x1, y: y1 },
              { x: x2, y: y1 },
              { x: x1, y: y2 },
              { x: x2, y: y2 }
            ];
            corners.forEach(c => {
              ctx.beginPath();
              ctx.arc(c.x, c.y, 5.5, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.lineWidth = 2.0;
              ctx.strokeStyle = '#0284c7';
              ctx.stroke();
            });
            ctx.restore();
          }
        }
        this.syncLassoActionBarUI();
        return;
      }

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

      // 2. 선택 완료 및 드래그/리사이즈 중인 바운딩 박스 + 균일한 4모서리 크기조절 핸들
      const bbox = this._ensureFreshLassoBoundingBox();
      if (bbox) {
        const pad = 10;
        const x1 = bbox.minX - pad;
        const y1 = bbox.minY - pad;
        const x2 = bbox.maxX + pad;
        const y2 = bbox.maxY + pad;
        const w = x2 - x1;
        const h = y2 - y1;

        ctx.save();
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(x1, y1, w, h);

        ctx.setLineDash([]);
        const corners = [
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x1, y: y2 },
          { x: x2, y: y2 }
        ];
        corners.forEach(c => {
          ctx.beginPath();
          ctx.arc(c.x, c.y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = '#0284c7';
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
            const topGuard = (typeof this._getIosTopGuardPx === 'function') ? this._getIosTopGuardPx() : 0;
            const clampedL = Math.max(58, Math.min((window.innerWidth || 1440) - pillW - 58, rawL));
            const clampedT = Math.max(12 + topGuard, Math.min((window.innerHeight || 900) - pillH - 12, rawT));
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
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
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
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
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
          if (typeof this.scheduleSaveUserPreferences === 'function') {
            this.scheduleSaveUserPreferences();
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
        if (typeof this.scheduleSaveUserPreferences === 'function') {
          this.scheduleSaveUserPreferences();
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
        if (typeof this.scheduleSaveUserPreferences === 'function') {
          this.scheduleSaveUserPreferences();
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
            const topGuard = (typeof this._getIosTopGuardPx === 'function') ? this._getIosTopGuardPx() : 0;
            const pillW = remote.offsetWidth || 98;
            const clampedL = Math.max(58, Math.min((window.innerWidth || 1440) - pillW - 58, saved.left));
            const clampedT = Math.max(12 + topGuard, Math.min((window.innerHeight || 900) - 80, saved.top));
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
          const topGuard = (typeof this._getIosTopGuardPx === 'function') ? this._getIosTopGuardPx() : 0;
          const pillW = remote.offsetWidth || 98;
          const nextL = Math.max(58, Math.min((window.innerWidth || 1920) - pillW - 58, initialLeft + dx));
          const nextT = Math.max(8 + topGuard, Math.min((window.innerHeight || 1080) - 56, initialTop + dy));
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
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
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
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
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
      const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
      let padX = isIOS ? Math.min(220, Math.round(sw * 0.20)) : Math.min(520, Math.round(sw * 0.38));
      let padY = isIOS ? Math.min(220, Math.round(sh * 0.24)) : Math.min(520, Math.round(sh * 0.48));
      const maxSidePx = Math.max(Math.round(sw * dpr) + 160, Math.round(sh * dpr) + 160, isIOS ? 3200 : 4000);
      if (Math.round((sw + padX * 2) * dpr) > maxSidePx) {
        padX = Math.max(80, Math.floor((maxSidePx / dpr - sw) / 2));
      }
      if (Math.round((sh + padY * 2) * dpr) > maxSidePx) {
        padY = Math.max(80, Math.floor((maxSidePx / dpr - sh) / 2));
      }
      const maxTotalPixels = isIOS ? 6400000 : 12500000;
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
      if (this._canvasHasLowResCameraFrame) {
        this._hasSceneFreeze = false;
        this.render();
      }
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
          if (
            e.pointerType === 'pen' &&
            inkProfile.touchDownSettleDist > 0 &&
            stroke.points.length === 1 &&
            !stroke.isHighlighter &&
            rawStepDist < inkProfile.touchDownSettleDist
          ) {
            const rawPress0 = (typeof ev.pressure === 'number') ? ev.pressure : 0.5;
            if (rawPress0 <= 0.24 && stroke.points[0]) {
              const sx0 = lastRaw.x * 0.55 + rawPxX * 0.45;
              const sy0 = lastRaw.y * 0.55 + rawPxY * 0.45;
              stroke.points[0].nx = Math.max(0, Math.min(1, sx0 / rw));
              stroke.points[0].ny = Math.max(0, Math.min(1, sy0 / rh));
              stroke._lastRawPx = { x: sx0, y: sy0 };
              stroke._prevRawPx = { x: sx0, y: sy0 };
            }
            continue;
          }
          if (rawStepDist < minDist) continue;
          const rawPressSample = (typeof ev.pressure === 'number') ? ev.pressure : 0.5;
          if (stroke._prevRawPx) {
            const vxPrev = lastRaw.x - stroke._prevRawPx.x;
            const vyPrev = lastRaw.y - stroke._prevRawPx.y;
            const vxNew = rawPxX - lastRaw.x;
            const vyNew = rawPxY - lastRaw.y;
            const lenPrev = Math.hypot(vxPrev, vyPrev);
            if (lenPrev > 0.35) {
              const cosAngle = (vxPrev * vxNew + vyPrev * vyNew) / (lenPrev * rawStepDist);
              if (rawStepDist < inkProfile.forwardGuardMaxDist && cosAngle < inkProfile.forwardGuardMinCos) {
                continue;
              }
              // 펜을 떼는 순간 압력이 거의 0으로 빠지며 옆/뒤로 튀는 호버 스파이크 차단
              if (e.pointerType === 'pen' && rawPressSample > 0 && rawPressSample <= 0.12 && rawStepDist < 4.2 && cosAngle < 0.65) {
                continue;
              }
            }
          }
          // ✂️ [아이패드 유리면 입필 삐침(Touch-Down Hook) 1회 정밀 절제]:
          // 첫 착지 구간(p0 -> p1 <= 4.8px)이 실제 획 진행 방향(p1 -> p2)과 38° 이상(cos < 0.78) 꺾여 있으면
          // 유리면 미끄러짐/틸트 수렴 오차로 생긴 p0 꼬리를 잘라내고 p1을 깔끔한 새 시작점(points[0])으로 재고정!
          if (
            e.pointerType === 'pen' &&
            inkProfile.touchDownHookMaxLen > 0 &&
            !stroke.isHighlighter &&
            !stroke._didTouchDownHookTrim &&
            stroke.points.length === 2 &&
            rawStepDist >= 1.35
          ) {
            const c0x = stroke.points[0].nx * rw;
            const c0y = stroke.points[0].ny * rh;
            const c1x = stroke.points[1].nx * rw;
            const c1y = stroke.points[1].ny * rh;
            const v01x = c1x - c0x;
            const v01y = c1y - c0y;
            const len01 = Math.hypot(v01x, v01y);
            if (len01 > 0.25 && len01 <= inkProfile.touchDownHookMaxLen) {
              const v12x = rawPxX - c1x;
              const v12y = rawPxY - c1y;
              const len12 = Math.hypot(v12x, v12y);
              if (len12 >= 1.35) {
                const cosHook = (v01x * v12x + v01y * v12y) / (len01 * len12);
                if (cosHook < 0.78) {
                  stroke.points[0] = stroke.points[1];
                  stroke.points.pop();
                  if (Array.isArray(stroke._ptTimes) && stroke._ptTimes.length >= 2) {
                    stroke._ptTimes[0] = stroke._ptTimes[1];
                    stroke._ptTimes.pop();
                  }
                  stroke._prevRawPx = { x: c1x, y: c1y };
                  try {
                    Object.defineProperty(stroke, '_didTouchDownHookTrim', {
                      value: true,
                      writable: true,
                      configurable: true,
                      enumerable: false
                    });
                  } catch (_) { }
                }
              }
            }
          }
        }

        const curLastPt = stroke.points[stroke.points.length - 1];

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
          const sampleNow = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
          for (let k = 0; k < readyPts.length; k++) {
            const fPt = readyPts[k];
            stroke.points.push({
              nx: Math.max(0, Math.min(1, fPt.x / rw)),
              ny: Math.max(0, Math.min(1, fPt.y / rh)),
              p: fPt.p,
              t: fPt.t
            });
            if (Array.isArray(stroke._ptTimes)) stroke._ptTimes.push(sampleNow);
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
        if (Array.isArray(stroke._ptTimes)) {
          stroke._ptTimes.push((typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now());
        }
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
        let isLiftOffKick = false;
        if (!stroke.isHighlighter && stroke.points.length >= 2 && tailDist < 4.5) {
          const prevEndPt = stroke.points[stroke.points.length - 2];
          const vxPrev = lastX - prevEndPt.nx * rw;
          const vyPrev = lastY - prevEndPt.ny * rh;
          const lenPrev = Math.hypot(vxPrev, vyPrev);
          if (lenPrev > 0.35 && tailDist > 1e-4) {
            const cosTail = (vxPrev * (rawEnd.x - lastX) + vyPrev * (rawEnd.y - lastY)) / (lenPrev * tailDist);
            if (cosTail < 0.55) isLiftOffKick = true;
          }
        }
        const minCardTailDist = (stroke.points.length === 1 && !stroke.isHighlighter) ? 1.60 : 0.25;
        if (tailDist >= minCardTailDist && !isLiftOffKick) {
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
      const dt = hasValidDt ? Math.min(50, Math.max(2.5, dtMs)) : null;
      const normSpd = (dt !== null)
        ? Math.min(1, Math.max(0, ((moveStepDist / dt) - (isBrush ? 0.12 : 0.15)) / (isBrush ? 2.28 : 2.70)))
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

    // 🖊️ [굿노트 펜끝 선명도(~65%) 동급 볼펜 무구슬(Zero-Bead) 원추 테이퍼 연산기]:
    // 시작점(s=0) 0.36x에서 rampLen(>=0.85*lineW)까지 1.00x로 매끄럽게 증가시켜,
    // 뒤따르는 본선(1.00x round cap)의 반지름(0.50*lineW)이 입필 끝단 밖으로 절대 역돌출하지 않도록 수학적으로 보장합니다.
    _ballpenWidthAtArc(lineW, arcS) {
      const rampLen = Math.max(2.8, lineW * 0.85);
      if (arcS >= rampLen) return lineW;
      const t = Math.max(0, arcS / rampLen);
      return Math.max(0.65, lineW * (0.36 + 0.64 * t));
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
        if (penStyle === 'ballpen') {
          const lineW = this.computePenStyleWidth(effBaseSize, p0.p, penStyle);
          const seg01 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (seg01 < 0.05) {
            ctx.beginPath();
            ctx.arc(p0.x, p0.y, lineW / 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (typeof ctx.globalAlpha === 'number' && ctx.globalAlpha < 0.999) {
            ctx.lineWidth = Math.max(0.65, lineW * 0.65);
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          } else {
            const w0 = this._ballpenWidthAtArc(lineW, 0);
            const wMid = this._ballpenWidthAtArc(lineW, seg01 * 0.5);
            const wEnd = Math.max(0.65, lineW * 0.44);
            this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, mx, my, w0, wMid);
            this.drawVariableWidthLineSegment(ctx, mx, my, p1.x, p1.y, wMid, wEnd);
          }
        } else if (penStyle === 'flat') {
          const lineW = this.computePenStyleWidth(effBaseSize, p0.p, penStyle);
          ctx.lineWidth = lineW;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 0.05) {
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
        if (typeof ctx.globalAlpha === 'number' && ctx.globalAlpha < 0.999) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x / nibX, pts[0].y / nibY);
          ctx.lineTo(firstMidX / nibX, firstMidY / nibY);
          for (let i = 1; i < pts.length - 1; i++) {
            const midX = (pts[i].x + pts[i + 1].x) * 0.5;
            const midY = (pts[i].y + pts[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(pts[i].x / nibX, pts[i].y / nibY, midX / nibX, midY / nibY);
          }
          ctx.lineTo(last.x / nibX, last.y / nibY);
          ctx.stroke();
        } else if (blurVal > 0 && penStyle === 'flat') {
          let prevMidX = firstMidX;
          let prevMidY = firstMidY;
          ctx.beginPath();
          ctx.moveTo(pts[0].x / nibX, pts[0].y / nibY);
          ctx.lineTo(firstMidX / nibX, firstMidY / nibY);
          ctx.stroke();
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
          // 🌟 [드로우콜 35배 압축 패스트패스 + 굿노트 선명도(~65%) 무구슬 원추 테이퍼]:
          // 입필 rampLen(>=0.85*lineW) 구간만 원추 테이퍼(0.36x -> 1.00x)로 매끄럽게 올리고,
          // 나머지 본선 98% 전체는 단 1회의 연속 2차 베지어 ctx.stroke()로 초고속 렌더링한 뒤 끝단만 0.44x로 마감!
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
          } else if (penStyle === 'ballpen') {
            const rampLen = Math.max(2.8, lineW * 0.85);
            const d01 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
            const w0 = this._ballpenWidthAtArc(lineW, 0);
            const wFM = this._ballpenWidthAtArc(lineW, d01 * 0.5);
            this.drawVariableWidthLineSegment(ctx, pts[0].x, pts[0].y, firstMidX, firstMidY, w0, wFM);

            let cumPrev = 0;
            let cumCur = d01;
            let prevMidX = firstMidX;
            let prevMidY = firstMidY;
            let wAtLastMid = wFM;
            let bodyStartIdx = pts.length - 1;

            for (let i = 1; i < pts.length - 1; i++) {
              const pCur = pts[i];
              const pNext = pts[i + 1];
              const sMid1 = 0.5 * (cumPrev + cumCur);
              if (sMid1 >= rampLen) {
                bodyStartIdx = i;
                break;
              }
              const dNext = Math.hypot(pNext.x - pCur.x, pNext.y - pCur.y);
              const cumNext = cumCur + dNext;
              const sMid2 = 0.5 * (cumCur + cumNext);
              const midX = (pCur.x + pNext.x) * 0.5;
              const midY = (pCur.y + pNext.y) * 0.5;
              const wM1 = this._ballpenWidthAtArc(lineW, sMid1);
              const wM2 = this._ballpenWidthAtArc(lineW, sMid2);
              this.drawVariableWidthQuadSegment(ctx, prevMidX, prevMidY, pCur.x, pCur.y, midX, midY, wM1, wM2);
              prevMidX = midX;
              prevMidY = midY;
              wAtLastMid = wM2;
              cumPrev = cumCur;
              cumCur = cumNext;
            }

            if (bodyStartIdx < pts.length - 1) {
              ctx.lineWidth = lineW;
              if (blurVal > 0) {
                for (let i = bodyStartIdx; i < pts.length - 1; i++) {
                  const pCur = pts[i];
                  const pNext = pts[i + 1];
                  const midX = (pCur.x + pNext.x) * 0.5;
                  const midY = (pCur.y + pNext.y) * 0.5;
                  ctx.beginPath();
                  ctx.moveTo(prevMidX, prevMidY);
                  ctx.quadraticCurveTo(pCur.x, pCur.y, midX, midY);
                  ctx.stroke();
                  prevMidX = midX;
                  prevMidY = midY;
                }
              } else {
                ctx.beginPath();
                ctx.moveTo(prevMidX, prevMidY);
                for (let i = bodyStartIdx; i < pts.length - 1; i++) {
                  const pCur = pts[i];
                  const pNext = pts[i + 1];
                  const midX = (pCur.x + pNext.x) * 0.5;
                  const midY = (pCur.y + pNext.y) * 0.5;
                  ctx.quadraticCurveTo(pCur.x, pCur.y, midX, midY);
                  prevMidX = midX;
                  prevMidY = midY;
                }
                ctx.stroke();
              }
              wAtLastMid = lineW;
            }

            const wEnd = Math.max(0.65, lineW * 0.44);
            this.drawVariableWidthLineSegment(ctx, prevMidX, prevMidY, last.x, last.y, wAtLastMid, wEnd);
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

      const pVal = (pt) => (pt && typeof pt.p === 'number' && !isNaN(pt.p)) ? pt.p : 0.5;
      const firstMidX = (pts[0].x + pts[1].x) * 0.5;
      const firstMidY = (pts[0].y + pts[1].y) * 0.5;
      const w0 = this.computePenStyleWidth(effBaseSize, pVal(pts[0]), penStyle);
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, w0 / 2, 0, Math.PI * 2);
      ctx.fill();
      let prevMidW = this.computePenStyleWidth(effBaseSize, (pVal(pts[0]) + pVal(pts[1])) * 0.5, penStyle);
      this.drawVariableWidthLineSegment(ctx, pts[0].x, pts[0].y, firstMidX, firstMidY, w0, prevMidW);
      let prevMidX = firstMidX;
      let prevMidY = firstMidY;
      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) * 0.5;
        const midY = (pts[i].y + pts[i + 1].y) * 0.5;
        const nextMidW = this.computePenStyleWidth(effBaseSize, (pVal(pts[i]) + pVal(pts[i + 1])) * 0.5, penStyle);
        this.drawVariableWidthQuadSegment(ctx, prevMidX, prevMidY, pts[i].x, pts[i].y, midX, midY, prevMidW, nextMidW);
        prevMidX = midX;
        prevMidY = midY;
        prevMidW = nextMidW;
      }
      const last = pts[pts.length - 1];
      const wLast = this.computePenStyleWidth(effBaseSize, pVal(last), penStyle);
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

      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
      const isLight = Boolean(curTheme.isLight || this.isMonochromeMode);
      const rawStrokeColor = stroke.color || '#1e293b';
      const rawStrokeLower = rawStrokeColor.toLowerCase();
      const strokeColor = this.isMonochromeMode
        ? '#000000'
        : ((stroke.onPdfBoard && !isLight && (rawStrokeLower === '#ffffff' || rawStrokeLower === '#fff')) ? '#0f172a' : rawStrokeColor);
      const isFlatNib = (penStyle === 'flat');
      const nibX = isFlatNib ? 1.38 : 1.0;
      const nibY = isFlatNib ? 0.68 : 1.0;

      const hadLiveFirstHalf = Boolean(stroke._drewLiveFirstHalf);
      const inkProf = this.getDeviceInkProfile();
      const deferL2HookWindow = (
        L === 2 &&
        !isFinalTail &&
        !stroke._pcFairer &&
        inkProf.touchDownHookMaxLen > 0 &&
        Math.hypot(screenPts[1].x - screenPts[0].x, screenPts[1].y - screenPts[0].y) <= 5.2
      );
      if (deferL2HookWindow) return;

      const rampLen = (penStyle === 'ballpen') ? Math.max(2.8, lineW * 0.85) : 0;
      let d01 = 0;
      let sMid1 = rampLen + 1;
      let sMid2 = rampLen + 1;
      if (penStyle === 'ballpen' && L >= 3) {
        d01 = Math.hypot(screenPts[1].x - screenPts[0].x, screenPts[1].y - screenPts[0].y);
        if (!stroke._entryRampDone) {
          let cumPrev = 0;
          let cumB = 0;
          let cumC = 0;
          let acc = 0;
          for (let k = 1; k < L; k++) {
            acc += Math.hypot(screenPts[k].x - screenPts[k - 1].x, screenPts[k].y - screenPts[k - 1].y);
            if (k === L - 3) cumPrev = acc;
            if (k === L - 2) cumB = acc;
            if (k === L - 1) cumC = acc;
          }
          sMid1 = 0.5 * (cumPrev + cumB);
          sMid2 = 0.5 * (cumB + cumC);
        }
      }

      let markDrewFirstHalf = false;
      let markEntryRampDone = false;

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
          if (isFinalTail) {
            ctx.beginPath();
            ctx.arc(lastPt.x / nibX, lastPt.y / nibY, lineW / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (L === 2) {
          const p0 = screenPts[0];
          const p1 = screenPts[1];
          const seg01 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          const midX = (p0.x + p1.x) * 0.5;
          const midY = (p0.y + p1.y) * 0.5;
          if (!isFinalTail) {
            markDrewFirstHalf = true;
          }
          if (penStyle === 'ballpen') {
            if (isFinalTail && seg01 < 0.05) {
              ctx.beginPath();
              ctx.arc(p0.x, p0.y, lineW / 2, 0, Math.PI * 2);
              ctx.fill();
            } else {
              const w0 = this._ballpenWidthAtArc(lineW, 0);
              const wMid = this._ballpenWidthAtArc(lineW, seg01 * 0.5);
              const wEnd = Math.max(0.65, lineW * 0.44);
              if (!isFinalTail) {
                this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, midX, midY, w0, wMid);
              } else {
                if (!hadLiveFirstHalf) {
                  this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, midX, midY, w0, wMid);
                }
                this.drawVariableWidthLineSegment(ctx, midX, midY, p1.x, p1.y, wMid, wEnd);
              }
            }
          } else if (penStyle === 'flat') {
            const fromX = (isFinalTail && hadLiveFirstHalf) ? midX : p0.x;
            const fromY = (isFinalTail && hadLiveFirstHalf) ? midY : p0.y;
            const toX = isFinalTail ? p1.x : midX;
            const toY = isFinalTail ? p1.y : midY;
            ctx.lineWidth = lineW;
            ctx.beginPath();
            ctx.moveTo(fromX / nibX, fromY / nibY);
            ctx.lineTo(toX / nibX, toY / nibY);
            ctx.stroke();
          } else {
            const pOf = (pt) => (pt && typeof pt.p === 'number' && !isNaN(pt.p)) ? pt.p : 0.5;
            const w0 = this.computePenStyleWidth(baseSize, pOf(p0), penStyle);
            const wMid = this.computePenStyleWidth(baseSize, (pOf(p0) + pOf(p1)) * 0.5, penStyle);
            const w1 = this.computePenStyleWidth(baseSize, pOf(p1), penStyle);
            if (!isFinalTail) {
              this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, midX, midY, w0, wMid);
            } else {
              if (!hadLiveFirstHalf) {
                this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, midX, midY, w0, wMid);
              }
              this.drawVariableWidthLineSegment(ctx, midX, midY, p1.x, p1.y, wMid, w1);
            }
          }
        } else {
          const pA = screenPts[L - 3];
          const pB = screenPts[L - 2];
          const pC = screenPts[L - 1];
          const mid1X = (pA.x + pB.x) * 0.5;
          const mid1Y = (pA.y + pB.y) * 0.5;
          const mid2X = (pB.x + pC.x) * 0.5;
          const mid2Y = (pB.y + pC.y) * 0.5;

          if (!hadLiveFirstHalf && L === 3) {
            const p0 = screenPts[0];
            const p1 = screenPts[1];
            const fmx = (p0.x + p1.x) * 0.5;
            const fmy = (p0.y + p1.y) * 0.5;
            markDrewFirstHalf = true;
            if (penStyle === 'ballpen') {
              const w0 = this._ballpenWidthAtArc(lineW, 0);
              const wFM = this._ballpenWidthAtArc(lineW, d01 * 0.5);
              this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, fmx, fmy, w0, wFM);
            } else if (penStyle === 'flat') {
              ctx.lineWidth = lineW;
              ctx.beginPath();
              ctx.moveTo(p0.x / nibX, p0.y / nibY);
              ctx.lineTo(fmx / nibX, fmy / nibY);
              ctx.stroke();
            } else {
              const pOf0 = (pt) => (pt && typeof pt.p === 'number' && !isNaN(pt.p)) ? pt.p : 0.5;
              const w0 = this.computePenStyleWidth(baseSize, pOf0(p0), penStyle);
              const wFM = this.computePenStyleWidth(baseSize, (pOf0(p0) + pOf0(p1)) * 0.5, penStyle);
              this.drawVariableWidthLineSegment(ctx, p0.x, p0.y, fmx, fmy, w0, wFM);
            }
          }

          if (penStyle === 'ballpen') {
            if (isFinalTail) {
              const wM2 = this._ballpenWidthAtArc(lineW, sMid2);
              const wEnd = Math.max(0.65, lineW * 0.44);
              this.drawVariableWidthLineSegment(ctx, mid2X, mid2Y, pC.x, pC.y, wM2, wEnd);
            } else if (sMid1 < rampLen) {
              const wM1 = this._ballpenWidthAtArc(lineW, sMid1);
              const wM2 = this._ballpenWidthAtArc(lineW, sMid2);
              this.drawVariableWidthQuadSegment(ctx, mid1X, mid1Y, pB.x, pB.y, mid2X, mid2Y, wM1, wM2);
              if (sMid2 >= rampLen) {
                markEntryRampDone = true;
              }
            } else {
              markEntryRampDone = true;
              ctx.lineWidth = lineW;
              ctx.beginPath();
              ctx.moveTo(mid1X, mid1Y);
              ctx.quadraticCurveTo(pB.x, pB.y, mid2X, mid2Y);
              ctx.stroke();
            }
          } else if (penStyle === 'flat') {
            ctx.lineWidth = lineW;
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
            const pOf = (pt) => (pt && typeof pt.p === 'number' && !isNaN(pt.p)) ? pt.p : 0.5;
            const wMid1 = this.computePenStyleWidth(baseSize, (pOf(pA) + pOf(pB)) * 0.5, penStyle);
            const wMid2 = this.computePenStyleWidth(baseSize, (pOf(pB) + pOf(pC)) * 0.5, penStyle);
            if (isFinalTail) {
              const wEnd = this.computePenStyleWidth(baseSize, pOf(pC), penStyle);
              this.drawVariableWidthLineSegment(ctx, mid2X, mid2Y, pC.x, pC.y, wMid2, wEnd);
            } else {
              this.drawVariableWidthQuadSegment(ctx, mid1X, mid1Y, pB.x, pB.y, mid2X, mid2Y, wMid1, wMid2);
            }
          }
        }
        ctx.restore();
      };

      drawPathOnCtx(strokeColor);

      // 다크 테마에서 흰색 문제 카드 및 고정 문제 스탬프 영역 위 흰색 펜 자동 반전 처리
      if (isBoardInk && !isLight && !this.isMonochromeMode && (rawStrokeLower === '#ffffff' || rawStrokeLower === '#fff')) {
        const cardRects = this._getVisibleWhiteProblemCardScreenRects(false);
        if (cardRects.length > 0) {
          const i0 = Math.max(0, L - 3);
          let sMinX = lastPt.x, sMaxX = lastPt.x, sMinY = lastPt.y, sMaxY = lastPt.y;
          for (let i = i0; i < L - 1; i++) {
            const p = screenPts[i];
            if (p.x < sMinX) sMinX = p.x;
            else if (p.x > sMaxX) sMaxX = p.x;
            if (p.y < sMinY) sMinY = p.y;
            else if (p.y > sMaxY) sMaxY = p.y;
          }
          const pad = Math.max(10, lineW * 2);
          let clipped = false;
          for (let rIdx = 0; rIdx < cardRects.length; rIdx++) {
            const r = cardRects[rIdx];
            if (sMaxX >= r.x - pad && sMinX <= r.x + r.w + pad && sMaxY >= r.y - pad && sMinY <= r.y + r.h + pad) {
              if (!clipped) {
                ctx.save();
                ctx.beginPath();
                clipped = true;
              }
              ctx.rect(r.x, r.y, r.w, r.h);
            }
          }
          if (clipped) {
            ctx.clip();
            drawPathOnCtx('#0f172a');
            ctx.restore();
          }
        }
      }

      if (markDrewFirstHalf && !stroke._drewLiveFirstHalf) {
        try {
          Object.defineProperty(stroke, '_drewLiveFirstHalf', {
            value: true,
            writable: true,
            configurable: true,
            enumerable: false
          });
        } catch (_) { }
      }
      if (markEntryRampDone && !stroke._entryRampDone) {
        try {
          Object.defineProperty(stroke, '_entryRampDone', {
            value: true,
            writable: true,
            configurable: true,
            enumerable: false
          });
        } catch (_) { }
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

      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
      const isLight = Boolean(curTheme.isLight || this.isMonochromeMode);
      const rawStrokeColor = stroke.color || '#1e293b';
      const rawStrokeLower = rawStrokeColor.toLowerCase();
      const strokeColor = this.isMonochromeMode
        ? '#000000'
        : ((stroke.onPdfBoard && !isLight && (rawStrokeLower === '#ffffff' || rawStrokeLower === '#fff')) ? '#0f172a' : rawStrokeColor);
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

      if (isBoardInk && !isLight && !this.isMonochromeMode && (rawStrokeLower === '#ffffff' || rawStrokeLower === '#fff')) {
        const cardRects = this._getVisibleWhiteProblemCardScreenRects(false);
        if (cardRects.length > 0) {
          let clipped = false;
          for (let rIdx = 0; rIdx < cardRects.length; rIdx++) {
            const r = cardRects[rIdx];
            if (maxX >= r.x - 10 && minX <= r.x + r.w + 10 && maxY >= r.y - 10 && minY <= r.y + r.h + 10) {
              if (!clipped) {
                ctx.save();
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.beginPath();
                clipped = true;
              }
              ctx.rect(r.x, r.y, r.w, r.h);
            }
          }
          if (clipped) {
            ctx.clip();
            renderTipCurve('#0f172a');
            ctx.restore();
          }
        }
      }
    }

    _getStrokeRenderPass(stroke) {
      if (!stroke) return -1;
      if (stroke.isGraphStamp) {
        return (stroke.graphStamp && stroke.graphStamp.kind === 'image') ? 0 : 2;
      }
      return stroke.isHighlighter ? 1 : 3;
    }

    rebuildInkCache() {
      this.clearInkCache();
      if (!this.inkStrokes || this.inkStrokes.length === 0) {
        this._inkBakeDirty = false;
        return;
      }

      const { padX, padY } = this._getInkBakeMetrics();

      // 🌟 [4-Pass 베이킹]: 0(불투명 이미지 스탬프) ➔ 1(형광펜 언더레이) ➔ 2(투명 벡터 스탬프) ➔ 3(일반 펜 최상단)
      for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < this.inkStrokes.length; i++) {
          const stroke = this.inkStrokes[i];
          if (!stroke || stroke === this.currentInkStroke) continue;
          if (this._lassoExcludedBakeSet && this._lassoExcludedBakeSet.has(stroke)) continue;
          if (this._getStrokeRenderPass(stroke) !== pass) continue;
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

    _getOrAssignSlideLruId(slideRef) {
      if (!slideRef || typeof slideRef !== 'object') return '';
      if (slideRef._inkLruId) return slideRef._inkLruId;
      const newId = 'slru_' + (++this._slideLruSeqCounter || (this._slideLruSeqCounter = 1));
      try {
        Object.defineProperty(slideRef, '_inkLruId', {
          value: newId,
          writable: true,
          configurable: true,
          enumerable: false
        });
      } catch (_) {
        return '';
      }
      return newId;
    }

    _computeCurrentSlideInkBakeSignature() {
      const strokes = Array.isArray(this.inkStrokes) ? this.inkStrokes : [];
      if (strokes.length === 0) return '';
      const { dpr, width, height, padX, padY } = this._getInkBakeMetrics();
      let hash = 2166136261 >>> 0;
      const mix = (n) => {
        hash ^= (n | 0);
        hash = Math.imul(hash, 16777619) >>> 0;
      };
      const mixStr = (str) => {
        if (!str) return;
        const len = str.length;
        mix(len);
        const step = len > 16 ? Math.floor(len / 8) : 1;
        for (let i = 0; i < len; i += step) {
          mix(str.charCodeAt(i));
        }
      };
      let hasBoard = false;
      let hasGraph = false;
      let hasStamp = false;
      for (let i = 0; i < strokes.length; i++) {
        const s = strokes[i];
        if (!s) continue;
        const isBoard = (s.target || 'board') === 'board';
        if (isBoard) hasBoard = true;
        else hasGraph = true;
        if (s.isGraphStamp) {
          hasStamp = true;
          if (s.graphStamp && s.graphStamp.kind === 'image') {
            const c = s._stampCache;
            if (!c || !c.img || !c.img.complete || !(c.img.naturalWidth > 0)) {
              return '';
            }
            mix(c.img.naturalWidth);
          }
          mix(Array.isArray(s.graphStamp && s.graphStamp.cardStrokes) ? s.graphStamp.cardStrokes.length : 0);
        }
        mixStr(s.id || '');
        mixStr(s.color || '');
        mix(Math.round((s.size || 4) * 100));
        mix(s.isHighlighter ? 1 : 0);
        const pts = s.points;
        const pLen = Array.isArray(pts) ? pts.length : 0;
        mix(pLen);
        if (pLen > 0) {
          const p0 = pts[0];
          const pN = pts[pLen - 1];
          mix(Math.round((p0.x || 0) * 20));
          mix(Math.round((p0.y || 0) * 20));
          mix(Math.round((pN.x || 0) * 20));
          mix(Math.round((pN.y || 0) * 20));
        }
        if (s.shape && s.shape.type) {
          mixStr(s.shape.type);
        }
      }
      if (!hasStamp && strokes.length < 8) return '';
      const curThemeKey = this.currentThemeKey || 'white_paper';
      const curTheme = (this.canvasThemes && this.canvasThemes[curThemeKey]) || { isLight: true };
      const isLight = Boolean(curTheme.isLight || this.isMonochromeMode);
      let darkProbClip = '';
      if (!isLight && !this.isMonochromeMode && typeof this.hasActiveProblemCard === 'function' && this.hasActiveProblemCard()) {
        if (typeof this.syncProblemCardRectFromWidget === 'function') {
          this.syncProblemCardRectFromWidget();
        }
        if (this.problemCardRect) {
          const r = this.problemCardRect;
          darkProbClip = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`;
        }
      }
      return [
        strokes.length,
        hash.toString(36),
        hasBoard ? 1 : 0,
        hasGraph ? 1 : 0,
        curThemeKey,
        this.isMonochromeMode ? 1 : 0,
        this.pdfPageBoardData ? 1 : 0,
        darkProbClip,
        width,
        height,
        Math.round(dpr * 100),
        padX,
        padY,
        Math.round((this.panX || 0) * 10),
        Math.round((this.panY || 0) * 10),
        Math.round((this.zoomLevel || 1.0) * 1000),
        Math.round((this.boardPanX || 0) * 10),
        Math.round((this.boardPanY || 0) * 10),
        Math.round((this.boardZoom || 1.0) * 1000),
        Math.round((this.boardZoomOffsetX || 0) * 10),
        Math.round((this.boardZoomOffsetY || 0) * 10)
      ].join('|');
    }

    _disposeSlideInkBakeLruEntry(entry) {
      if (!entry) return;
      if (entry.boardCanvas) {
        try { entry.boardCanvas.width = 1; entry.boardCanvas.height = 1; } catch (_) { }
        entry.boardCanvas = null;
      }
      if (entry.graphCanvas) {
        try { entry.graphCanvas.width = 1; entry.graphCanvas.height = 1; } catch (_) { }
        entry.graphCanvas = null;
      }
    }

    _clearAllSlideInkBakeLruCache() {
      if (!this._slideInkBakeLruMap) return;
      for (const entry of this._slideInkBakeLruMap.values()) {
        this._disposeSlideInkBakeLruEntry(entry);
      }
      this._slideInkBakeLruMap.clear();
    }

    _saveCurrentSlideInkBakeToLru(slideRef) {
      if (!slideRef || this._isCapturingExportSnapshots || this._isAudioReplayActive) return false;
      if (Array.isArray(this._pendingIncrementalBakeStrokes) && this._pendingIncrementalBakeStrokes.length > 0 && !this._inkBakeDirty) {
        this._flushPendingIncrementalBakes();
      }
      if (this._inkBakeDirty || !this._hasBakedStrokes || !this._inkBakeCamera) return false;
      if (this._lassoExcludedBakeSet && this._lassoExcludedBakeSet.size > 0) return false;
      const sig = this._computeCurrentSlideInkBakeSignature();
      if (!sig) return false;
      const lruId = this._getOrAssignSlideLruId(slideRef);
      if (!lruId) return false;

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

      if (!this._slideInkBakeLruMap) this._slideInkBakeLruMap = new Map();
      const existing = this._slideInkBakeLruMap.get(lruId);
      if (existing && existing.sig === sig) {
        this._slideInkBakeLruMap.delete(lruId);
        this._slideInkBakeLruMap.set(lruId, existing);
        return true;
      }
      if (existing) {
        this._disposeSlideInkBakeLruEntry(existing);
        this._slideInkBakeLruMap.delete(lruId);
      }

      const strokes = this.inkStrokes || [];
      let needBoard = false;
      let needGraph = false;
      for (let i = 0; i < strokes.length; i++) {
        const s = strokes[i];
        if (!s) continue;
        if ((s.target || 'board') === 'board') needBoard = true;
        else if (Boolean(s.onPdfBoard) === Boolean(this.pdfPageBoardData)) needGraph = true;
      }
      if (!needBoard && !needGraph) return false;

      let boardCv = null;
      let graphCv = null;
      if (needBoard && this.inkBakeCanvas && this.inkBakeCanvas.width > 4 && this.inkBakeCanvas.height > 4) {
        boardCv = document.createElement('canvas');
        boardCv.width = this.inkBakeCanvas.width;
        boardCv.height = this.inkBakeCanvas.height;
        const bCtx = boardCv.getContext('2d');
        if (bCtx) bCtx.drawImage(this.inkBakeCanvas, 0, 0);
      }
      if (needGraph && this.inkGraphBakeCanvas && this.inkGraphBakeCanvas.width > 4 && this.inkGraphBakeCanvas.height > 4) {
        graphCv = document.createElement('canvas');
        graphCv.width = this.inkGraphBakeCanvas.width;
        graphCv.height = this.inkGraphBakeCanvas.height;
        const gCtx = graphCv.getContext('2d');
        if (gCtx) gCtx.drawImage(this.inkGraphBakeCanvas, 0, 0);
      }

      const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
      const isCompactMem = Boolean(
        isIOS ||
        (typeof window !== 'undefined' && (window.innerWidth <= 900 || window.innerHeight <= 600))
      );
      const maxEntries = isIOS ? 1 : (isCompactMem ? 2 : 4);
      while (this._slideInkBakeLruMap.size >= maxEntries) {
        const oldestKey = this._slideInkBakeLruMap.keys().next().value;
        if (oldestKey === undefined) break;
        const oldEntry = this._slideInkBakeLruMap.get(oldestKey);
        this._slideInkBakeLruMap.delete(oldestKey);
        this._disposeSlideInkBakeLruEntry(oldEntry);
      }

      this._slideInkBakeLruMap.set(lruId, {
        sig,
        boardCanvas: boardCv,
        graphCanvas: graphCv,
        camera: { ...cam }
      });
      return true;
    }

    _tryRestoreSlideInkBakeFromLru(slideRef) {
      if (!slideRef || !this._slideInkBakeLruMap || this._isCapturingExportSnapshots || this._isAudioReplayActive) return false;
      const lruId = slideRef._inkLruId;
      if (!lruId) return false;
      const entry = this._slideInkBakeLruMap.get(lruId);
      if (!entry) return false;

      const sig = this._computeCurrentSlideInkBakeSignature();
      if (!sig || entry.sig !== sig) return false;

      this.clearInkCache();
      if (entry.boardCanvas && this.inkBakeCtx && this.inkBakeCanvas) {
        if (entry.boardCanvas.width !== this.inkBakeCanvas.width || entry.boardCanvas.height !== this.inkBakeCanvas.height) {
          return false;
        }
        this.inkBakeCtx.save();
        this.inkBakeCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.inkBakeCtx.drawImage(entry.boardCanvas, 0, 0);
        this.inkBakeCtx.restore();
      }
      if (entry.graphCanvas && this.inkGraphBakeCtx && this.inkGraphBakeCanvas) {
        if (entry.graphCanvas.width !== this.inkGraphBakeCanvas.width || entry.graphCanvas.height !== this.inkGraphBakeCanvas.height) {
          return false;
        }
        this.inkGraphBakeCtx.save();
        this.inkGraphBakeCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.inkGraphBakeCtx.drawImage(entry.graphCanvas, 0, 0);
        this.inkGraphBakeCtx.restore();
      }

      this._hasBakedStrokes = true;
      this._inkBakeDirty = false;
      this._inkBakeCamera = { ...entry.camera };

      this._slideInkBakeLruMap.delete(lruId);
      this._slideInkBakeLruMap.set(lruId, entry);
      return true;
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
        if (this._needsRenderAfterInkStroke) {
          this._needsRenderAfterInkStroke = false;
          this.requestRender();
        }
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
        if (this._getStrokeRenderPass(s) === 0) continue;
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
          for (let pass = 0; pass < 4; pass++) {
            for (let i = 0; i < this.inkStrokes.length; i++) {
              const st = this.inkStrokes[i];
              if (!st || st === this.currentInkStroke) continue;
              if (this._lassoExcludedBakeSet && this._lassoExcludedBakeSet.has(st)) continue;
              if (this._getStrokeRenderPass(st) !== pass) continue;
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
          for (let pass = 0; pass < 4; pass++) {
            for (let i = 0; i < this.inkStrokes.length; i++) {
              const st = this.inkStrokes[i];
              if (!st || st === this.currentInkStroke) continue;
              if (this._lassoExcludedBakeSet && this._lassoExcludedBakeSet.has(st)) continue;
              if (this._getStrokeRenderPass(st) !== pass) continue;
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

    _renderGraphStampStroke(targetCtx, stroke) {
      if (!targetCtx || !stroke || !stroke.graphStamp || !Array.isArray(stroke.points) || stroke.points.length < 2) return;
      const isBoardInk = (stroke.target || 'board') === 'board';
      const p0 = stroke.points[0];
      const p1 = stroke.points[1];
      if (!p0 || !p1) return;

      const s0 = isBoardInk ? this.boardToScreen(p0.x, p0.y) : this.mathToScreen(p0.x, p0.y);
      const s1 = isBoardInk ? this.boardToScreen(p1.x, p1.y) : this.mathToScreen(p1.x, p1.y);
      if (!s0 || !s1 || !Number.isFinite(s0.x) || !Number.isFinite(s0.y) || !Number.isFinite(s1.x) || !Number.isFinite(s1.y)) {
        return;
      }

      const bx = Math.min(s0.x, s1.x);
      const by = Math.min(s0.y, s1.y);
      const bw = Math.abs(s1.x - s0.x);
      const bh = Math.abs(s1.y - s0.y);
      if (!(bw >= 2 && bh >= 2)) return;

      if (targetCtx === this.ctx || targetCtx === this.inkBakeCtx || targetCtx === this.inkGraphBakeCtx) {
        const isBakeTarget = (targetCtx === this.inkBakeCtx || targetCtx === this.inkGraphBakeCtx);
        const sw = this.screenWidth || 1280;
        const sh = this.screenHeight || 720;
        const padX = isBakeTarget ? 540 : 0;
        const padY = isBakeTarget ? 540 : 0;
        const margin = 32;
        if (
          bx + bw < -padX - margin ||
          bx > sw + padX + margin ||
          by + bh < -padY - margin ||
          by > sh + padY + margin
        ) {
          return;
        }
      }

      let ctxScale = (typeof this.getCanvasDpr === 'function')
        ? this.getCanvasDpr()
        : ((typeof window !== 'undefined' && window.devicePixelRatio) || 2);
      if (typeof targetCtx.getTransform === 'function') {
        const tr = targetCtx.getTransform();
        if (tr && Number.isFinite(tr.a) && Number.isFinite(tr.b)) {
          const mScale = Math.hypot(tr.a, tr.b);
          if (mScale > 0.1) ctxScale = mScale;
        }
      }
      const rawThemeKey = this.currentThemeKey || 'white_paper';
      const rawThemeObj = (this.canvasThemes && this.canvasThemes[rawThemeKey]) || { isLight: true };
      const isExportPass = Boolean(
        this._activeExportFilter &&
        targetCtx !== this.ctx &&
        targetCtx !== this.inkBakeCtx &&
        targetCtx !== this.inkGraphBakeCtx
      );
      const isIOSMobile = Boolean(
        (typeof this.isIOSOrIPad === 'function' && this.isIOSOrIPad()) ||
        (typeof window !== 'undefined' && (window.innerWidth <= 768 || window.innerHeight <= 500))
      );
      const effScale = Math.min(isExportPass ? 5.0 : 4.0, Math.max(2.0, ctxScale));
      const rawPxW = Math.max(4, bw * effScale);
      const rawPxH = Math.max(4, bh * effScale);
      const liveMaxArea = isIOSMobile ? 6800000 : 10000000;
      const MAX_STAMP_SIDE = isExportPass ? (isIOSMobile ? 3840 : 4096) : (isIOSMobile ? 2880 : 3584);
      const MAX_STAMP_AREA = isExportPass ? (isIOSMobile ? 12500000 : 15500000) : liveMaxArea;
      let clampRatio = 1.0;
      if (rawPxW > MAX_STAMP_SIDE || rawPxH > MAX_STAMP_SIDE) {
        clampRatio = Math.min(clampRatio, MAX_STAMP_SIDE / Math.max(rawPxW, rawPxH));
      }
      if (rawPxW * rawPxH > MAX_STAMP_AREA) {
        clampRatio = Math.min(clampRatio, Math.sqrt(MAX_STAMP_AREA / (rawPxW * rawPxH)));
      }
      const pxW = Math.max(4, Math.round((rawPxW * clampRatio) / 2) * 2);
      const pxH = Math.max(4, Math.round((rawPxH * clampRatio) / 2) * 2);

      const forceLightSurface = Boolean(
        stroke.onPdfBoard ||
        this.isMonochromeMode ||
        (isExportPass && this.exportTransparent && !rawThemeObj.isLight)
      );
      const effThemeKey = (forceLightSurface && !rawThemeObj.isLight && this.canvasThemes && this.canvasThemes.white_paper)
        ? 'white_paper'
        : rawThemeKey;
      const effThemeObj = (this.canvasThemes && this.canvasThemes[effThemeKey]) || { isLight: true };
      const effIsLight = Boolean(effThemeObj.isLight || this.isMonochromeMode || forceLightSurface);

      let cache = stroke._stampCache;
      if (!cache && typeof document !== 'undefined') {
        cache = { canvas: document.createElement('canvas'), key: '', img: null, imgUrl: '' };
        try {
          Object.defineProperty(stroke, '_stampCache', {
            value: cache,
            writable: true,
            configurable: true,
            enumerable: false
          });
        } catch (_) {
          return;
        }
      }
      if (!cache || !cache.canvas) return;

      const gs = stroke.graphStamp;
      const omitStampCardInk = Boolean(isExportPass && this._activeExportFilter && this._activeExportFilter.includeInk === false);
      const useTempExportCanvas = Boolean(isExportPass && (pxW * pxH > liveMaxArea) && typeof document !== 'undefined');
      const workCanvas = useTempExportCanvas ? document.createElement('canvas') : cache.canvas;
      const cacheKey = `${pxW}x${pxH}|${effThemeKey}|${this.isMonochromeMode ? 1 : 0}|${forceLightSurface ? 1 : 0}|${omitStampCardInk ? 0 : (Array.isArray(gs.cardStrokes) ? gs.cardStrokes.length : 0)}`;
      if (useTempExportCanvas || cache.key !== cacheKey || workCanvas.width !== pxW || workCanvas.height !== pxH) {
        if (workCanvas.width !== pxW) workCanvas.width = pxW;
        if (workCanvas.height !== pxH) workCanvas.height = pxH;
        const sCtx = workCanvas.getContext('2d');
        if (!sCtx) return;

        const logicalW = Math.max(80, Number(gs.logicalW) || (gs.snap && Number(gs.snap._pipCardW)) || 360);
        const logicalH = Math.max(50, Number(gs.logicalH) || (gs.snap && Number(gs.snap._pipCardH)) || 295);

        sCtx.save();
        sCtx.setTransform(1, 0, 0, 1, 0, 0);
        sCtx.clearRect(0, 0, pxW, pxH);
        sCtx.setTransform(pxW / logicalW, 0, 0, pxH / logicalH, 0, 0);

        const prevThemeKey = this.currentThemeKey;
        let readyToCache = true;
        try {
          this.currentThemeKey = effThemeKey;
          if (gs.kind === 'vector' && gs.snap && typeof this._withPipCardGraphState === 'function') {
            if (Array.isArray(gs.snap.graphs) && typeof window !== 'undefined' && window.SafeMathCompiler) {
              gs.snap.graphs.forEach(g => {
                if (g && g.type === 'general_expr' && Array.isArray(g.handles)) {
                  g.handles.forEach(h => {
                    if (h && !h.fn && h.rawExpr) {
                      const comp = window.SafeMathCompiler.compile(h.rawExpr);
                      if (comp && comp.success) h.fn = comp.fn;
                    }
                  });
                }
              });
            }
            this._withPipCardGraphState(gs.snap, logicalW, logicalH, () => {
              if (gs.snap.showGuides !== undefined) this.showGuides = Boolean(gs.snap.showGuides);
              if (gs.snap.showAsymptotes !== undefined) this.showAsymptotes = Boolean(gs.snap.showAsymptotes);
              if (gs.snap.showGridNumbers !== undefined) this.showGridNumbers = Boolean(gs.snap.showGridNumbers);
              this.isCurveSelected = false;
              this.selectedHandleIdx = null;
              this.draggedHandleIdx = null;
              this.isDropLineMode = false;
              this.dropLineHoverCandidate = null;
              this.dropLineHoverScissors = null;

              if (this.showGuides) this.drawGuides(sCtx, this._snapshotCropBounds);
              if (this.showInverseGuide) this.drawInverseGuide(sCtx);
              if (this.showAsymptotes) this.drawAllAsymptotes(sCtx);
              if (this.showAxes) this.drawAxes(sCtx, this._snapshotCropBounds);
              if (this.showAxes && this.showGridNumbers) this.drawGridNumbers(sCtx, this._snapshotCropBounds);
              this.drawAllCurves(sCtx, true);
              if (this.usePiecewise && this.graphs.length >= 1) {
                this.drawPiecewiseBoundaries(sCtx, true);
              }
              this.drawDropLines(sCtx, true);
              this.drawTextLabels(sCtx, true);
            });
          } else if (gs.kind === 'image' && gs.dataUrl && typeof Image !== 'undefined') {
            if (!cache.img || cache.imgUrl !== gs.dataUrl) {
              const imgObj = new Image();
              cache.img = imgObj;
              cache.imgUrl = gs.dataUrl;
              imgObj.onload = () => {
                cache.key = '';
                this._inkBakeDirty = true;
                this.requestRender();
              };
              const safeUrl = (typeof this._sanitizeCardImageUrl === 'function')
                ? this._sanitizeCardImageUrl(gs.dataUrl)
                : gs.dataUrl;
              if (safeUrl) imgObj.src = safeUrl;
            }
            const decodedImgReady = Boolean(cache.img && cache.img.complete && cache.img.naturalWidth > 0);
            const liveFallbackReady = Boolean(
              !decodedImgReady &&
              cache.liveDrawable &&
              ((cache.liveDrawable.tagName === 'CANVAS' && !cache.liveDrawable._evicted && cache.liveDrawable.width > 4) ||
                (cache.liveDrawable.complete && cache.liveDrawable.naturalWidth > 0))
            );
            const drawSrc = decodedImgReady ? cache.img : (liveFallbackReady ? cache.liveDrawable : null);
            if (drawSrc) {
              sCtx.save();
              if (this.isMonochromeMode) {
                sCtx.filter = 'grayscale(100%) contrast(108%)';
              }
              sCtx.imageSmoothingEnabled = true;
              try { sCtx.imageSmoothingQuality = 'high'; } catch (_) { }
              sCtx.drawImage(drawSrc, 0, 0, logicalW, logicalH);
              sCtx.restore();
              if (!decodedImgReady) {
                readyToCache = false;
              } else {
                cache.liveDrawable = null;
              }
            } else {
              readyToCache = false;
            }
          }

          if (!omitStampCardInk && Array.isArray(gs.cardStrokes) && gs.cardStrokes.length > 0 && typeof this._renderSingleCardInkStroke === 'function') {
            const isProbCardStamp = Boolean(gs.isProblemCard);
            const sizeScale = isProbCardStamp
              ? Math.max(0.6, logicalW / (Number(gs.refCardW) || 520))
              : ((typeof this.getPipCardFinePenScale === 'function')
                ? this.getPipCardFinePenScale('primary', logicalW, logicalH)
                : 1.0);
            const resolveCardStrokeForSurface = (cs) => {
              if (!cs || cs.isHighlighter || this.isMonochromeMode) return cs;
              const cLow = (cs.color || '').toLowerCase();
              if (isProbCardStamp) {
                if (cLow === '#ffffff' || cLow === '#fff') {
                  return { ...cs, color: '#1e293b' };
                }
                return cs;
              }
              if (effIsLight && (cLow === '#ffffff' || cLow === '#fff' || cLow === '#f8fafc')) {
                return { ...cs, color: '#1e293b' };
              }
              if (!effIsLight && (cLow === '#1e293b' || cLow === '#0f172a' || cLow === '#000000' || cLow === '#2d3436')) {
                return { ...cs, color: '#f8fafc' };
              }
              return cs;
            };
            const cardDrawOpts = isProbCardStamp
              ? {
                isProbCard: true,
                applyStreamline: true,
                minPenWidth: 0,
                minHlWidth: 4,
                defaultHlMin: 10
              }
              : {
                isProbCard: effIsLight,
                applyStreamline: true,
                minPenWidth: 0.85,
                minHlWidth: 3,
                defaultHlMin: 8
              };
            for (let pass = 0; pass < 2; pass++) {
              const wantHl = (pass === 0);
              for (let i = 0; i < gs.cardStrokes.length; i++) {
                const cs = gs.cardStrokes[i];
                if (!cs || Boolean(cs.isHighlighter) !== wantHl) continue;
                this._renderSingleCardInkStroke(
                  sCtx,
                  resolveCardStrokeForSurface(cs),
                  logicalW,
                  logicalH,
                  sizeScale,
                  cardDrawOpts
                );
              }
            }
          }
        } finally {
          this.currentThemeKey = prevThemeKey;
          sCtx.restore();
        }
        if (!useTempExportCanvas) {
          cache.key = readyToCache ? cacheKey : '';
        }
      }

      const ghostMul = (typeof stroke._ghostAlpha === 'number') ? stroke._ghostAlpha : 1.0;
      targetCtx.save();
      try {
        if (ghostMul < 0.999) {
          targetCtx.globalAlpha = (targetCtx.globalAlpha || 1.0) * ghostMul;
        }
        targetCtx.imageSmoothingEnabled = true;
        try { targetCtx.imageSmoothingQuality = 'high'; } catch (_) { }
        targetCtx.drawImage(workCanvas, bx, by, bw, bh);
      } finally {
        targetCtx.restore();
        if (useTempExportCanvas) {
          try { workCanvas.width = 1; workCanvas.height = 1; } catch (_) { }
        }
      }
    }

    renderSingleStroke(targetCtx, stroke, forceColor = null, isLiveDrawing = false) {
      if (!stroke || !stroke.points || stroke.points.length === 0) return;
      if (stroke.isGraphStamp && stroke.graphStamp) {
        this._renderGraphStampStroke(targetCtx, stroke);
        return;
      }

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
      const isPdfWhiteSurface = Boolean(
        stroke.onPdfBoard &&
        !this.isMonochromeMode &&
        !(this._activeExportFilter && this._activeExportFilter.includeProblem === false && !this.exportTransparent)
      );
      const isLight = Boolean(curTheme.isLight || this.isMonochromeMode || isPdfWhiteSurface);

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
      } else if (!forceColor && isPdfWhiteSurface && !curTheme.isLight) {
        const rawPenLower = (strokeColor || '').toLowerCase();
        if (rawPenLower === '#ffffff' || rawPenLower === '#fff') {
          strokeColor = '#0f172a';
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
        const shapeBaseSize = (stroke.size || 4.2) * zoomRatio;
        const shapePenStyle = stroke.isHighlighter ? 'ballpen' : (stroke.penStyle || 'ballpen');
        const blurVal = stroke.isHighlighter
          ? 0
          : Math.max(0, Math.min(5.0, (typeof stroke.softBlur === 'number' && !isNaN(stroke.softBlur)) ? stroke.softBlur : (this.inkSoftBlur || 0)));
        const effShapeBase = (blurVal > 0) ? shapeBaseSize * Math.max(0.76, 1.0 - blurVal * 0.038) : shapeBaseSize;
        const dpr = (typeof this.getCanvasDpr === 'function') ? this.getCanvasDpr() : (window.devicePixelRatio || 1);
        const hlShapeBase = stroke.highlighterSize ? (stroke.highlighterSize * zoomRatio) : Math.max(8, shapeBaseSize * 2.5);
        const shapeP = stroke.isHighlighter ? 0.5 : this.getRecognizedShapePressure(stroke);
        targetCtx.lineWidth = stroke.isHighlighter
          ? Math.max(4, hlShapeBase)
          : this.computePenStyleWidth(effShapeBase, shapeP, shapePenStyle);
        targetCtx.strokeStyle = strokeColor;
        if (blurVal > 0) {
          targetCtx.shadowColor = strokeColor;
          targetCtx.shadowBlur = blurVal * dpr * 0.65;
          targetCtx.shadowOffsetX = 0;
          targetCtx.shadowOffsetY = 0;
        } else {
          targetCtx.shadowBlur = 0;
        }
        const isFlatNib = (!stroke.isHighlighter && shapePenStyle === 'flat');
        const nibX = isFlatNib ? 1.38 : 1.0;
        const nibY = isFlatNib ? 0.68 : 1.0;
        if (isFlatNib) {
          targetCtx.scale(nibX, nibY);
        }

        if (stroke.shape.type === 'line') {
          const s1 = isBoardInk ? this.boardToScreen(stroke.shape.start.x, stroke.shape.start.y) : this.mathToScreen(stroke.shape.start.x, stroke.shape.start.y);
          const s2 = isBoardInk ? this.boardToScreen(stroke.shape.end.x, stroke.shape.end.y) : this.mathToScreen(stroke.shape.end.x, stroke.shape.end.y);
          targetCtx.beginPath();
          targetCtx.moveTo(s1.x / nibX, s1.y / nibY);
          targetCtx.lineTo(s2.x / nibX, s2.y / nibY);
          targetCtx.stroke();
          targetCtx.restore();
          return;
        } else if (stroke.shape.type === 'circle') {
          const sc = isBoardInk ? this.boardToScreen(stroke.shape.center.x, stroke.shape.center.y) : this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y);
          const sr = Math.max(2, isBoardInk ? (stroke.shape.radius * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x + stroke.shape.radius, stroke.shape.center.y).x - sc.x));
          targetCtx.beginPath();
          if (isFlatNib) {
            targetCtx.ellipse(sc.x / nibX, sc.y / nibY, sr / nibX, sr / nibY, 0, 0, Math.PI * 2);
          } else {
            targetCtx.arc(sc.x, sc.y, sr, 0, Math.PI * 2);
          }
          targetCtx.stroke();
          targetCtx.restore();
          return;
        } else if (stroke.shape.type === 'ellipse') {
          const sc = isBoardInk ? this.boardToScreen(stroke.shape.center.x, stroke.shape.center.y) : this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y);
          const srx = Math.max(2, isBoardInk ? (stroke.shape.rx * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x + stroke.shape.rx, stroke.shape.center.y).x - sc.x));
          const sry = Math.max(2, isBoardInk ? (stroke.shape.ry * bz) : Math.abs(this.mathToScreen(stroke.shape.center.x, stroke.shape.center.y + stroke.shape.ry).y - sc.y));
          targetCtx.beginPath();
          targetCtx.ellipse(sc.x / nibX, sc.y / nibY, srx / nibX, sry / nibY, 0, 0, Math.PI * 2);
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
          targetCtx.rect(rx / nibX, ry / nibY, rw / nibX, rh / nibY);
          targetCtx.stroke();
          targetCtx.restore();
          return;
        } else if (stroke.shape.pts && stroke.shape.pts.length >= 2) {
          const sPts = stroke.shape.pts.map(pt => isBoardInk ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y));
          targetCtx.beginPath();
          targetCtx.moveTo(sPts[0].x / nibX, sPts[0].y / nibY);
          for (let i = 1; i < sPts.length; i++) {
            targetCtx.lineTo(sPts[i].x / nibX, sPts[i].y / nibY);
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
      const allStrokes = Array.isArray(this.inkStrokes) ? this.inkStrokes : [];
      let probStampSig = '';
      let hasProbStamp = false;
      for (let i = 0; i < allStrokes.length; i++) {
        const st = allStrokes[i];
        if (st && st.isProblemStamp && (st.target || 'board') === 'board' && Array.isArray(st.points) && st.points.length >= 2) {
          hasProbStamp = true;
          const p0 = st.points[0];
          const p1 = st.points[1];
          probStampSig += `|S:${st.id || i},${Math.round((p0.x || 0) * 10)},${Math.round((p0.y || 0) * 10)},${Math.round((p1.x || 0) * 10)},${Math.round((p1.y || 0) * 10)}`;
        }
      }
      if (!hasPrimaryProb && !hasExtraProb && !hasProbStamp) {
        return rects;
      }

      // 🌟 [강제 동기 레이아웃 리플로우(Forced Reflow) 0회 캐시]:
      // 지우개/렌더링 매 프레임마다 getBoundingClientRect()를 호출하면 브라우저가 DOM 전체 레이아웃을 강제 재계산하므로,
      // 카드 이동/리사이즈 중이 아닐 때는 순수 JS 스타일 시그니처가 바뀌었을 때만 측정하고 평소에는 0.000ms 캐시를 반환!
      if (!isExport && !this._isDraggingOrResizingAnyCard) {
        const pWidget = (hasPrimaryProb && typeof document !== 'undefined') ? document.getElementById('problemCardWidget') : null;
        let layoutSig = `${this.screenWidth || 0}|${this.screenHeight || 0}|${this.boardPanX || 0}|${this.boardPanY || 0}|${this.boardZoom || 1}|${this.boardZoomOffsetX || 0}|${this.boardZoomOffsetY || 0}${probStampSig}`;
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

      if (hasProbStamp) {
        for (let i = 0; i < allStrokes.length; i++) {
          const st = allStrokes[i];
          if (!st || !st.isProblemStamp || (st.target || 'board') !== 'board' || !Array.isArray(st.points) || st.points.length < 2) continue;
          const s0 = this.boardToScreen(st.points[0].x, st.points[0].y);
          const s1 = this.boardToScreen(st.points[1].x, st.points[1].y);
          const w = Math.abs(s1.x - s0.x);
          const h = Math.abs(s1.y - s0.y);
          if (w > 2 && h > 2) {
            rects.push({
              x: Math.min(s0.x, s1.x),
              y: Math.min(s0.y, s1.y),
              w,
              h
            });
          }
        }
      }

      if (hasPrimaryProb || hasExtraProb) {
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
      }
      if (!isExport && this._whiteCardRectsCacheSig) {
        this._whiteCardRectsCacheVal = rects;
      }
      return rects;
    }

    _isWhiteBoardContrastStroke(s) {
      if (!s || s.isGraphStamp || (s.target || 'board') !== 'board' || s.isHighlighter) return false;
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
        const expFilter = this._activeExportFilter || { includeProblem: true, includeGraph: true, includeInk: true };
        const allowProbExp = expFilter.includeProblem !== false;
        const allowStampExp = expFilter.includeGraph !== false;
        const allowInkExp = expFilter.includeInk !== false;
        const strokesToDraw = this.inkStrokes.filter(s => {
          if (!s) return false;
          if (s.isProblemStamp ? !allowProbExp : (s.isGraphStamp ? !allowStampExp : !allowInkExp)) return false;
          if (!filterTarget) return true;
          const t = s.target || 'board';
          if (t !== filterTarget) return false;
          if (t === 'graph' && Boolean(s.onPdfBoard) !== Boolean(this.pdfPageBoardData)) return false;
          return true;
        });
        for (let pass = 0; pass < 4; pass++) {
          for (let i = 0; i < strokesToDraw.length; i++) {
            const stroke = strokesToDraw[i];
            if (!stroke || this._getStrokeRenderPass(stroke) !== pass) continue;
            const expOverride = (pass === 3) ? resolveExpOverride(stroke) : null;
            this.renderSingleStroke(ctx, stroke, expOverride, false);
          }
        }
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
