/**
 * Graph Master Web - Real-Time Audio Sync Replay, Fixed Video Stage, Shortcuts & Bootstrap (app.js)
 */
{
  const _desc = Object.getOwnPropertyDescriptors(class {
    // ==========================================================================
    // [🎙️ 실시간 음성 녹음 + 펜 포인터 1획1점(Point-by-Point) 필기·그래프 조작 동기화 리플레이 엔진]
    // 1) 녹음 시작 시 모든 필기 획(칠판, 그래프, 문제 카드, 그래프 보관 카드)의 모든 점마다 정밀 밀리초(pt.t) 기록!
    // 2) 펜 포인터(#virtualStylusPen) 이동 궤적과 실시간 그래프 조작(극점 드래그, 모드 전환, 카드 보관) 타임라인 기록!
    // 3) [🎬 영상 모드] 재생 시 미래의 필기는 감췄다가 선생님 음성에 맞춰 펜 포인터 끝에서 선이 주욱 그어지고 숫자가 한 획씩 써짐!
    // 4) [📝 노트 클릭 모드] 전환 시 완성된 필기노트를 한눈에 보다가 이해 안 되는 수식을 톡 클릭하면 즉시 그 부분 음성과 펜 재생!
    // ==========================================================================
    initAudioSyncControls() {
      this.isAudioRecording = false;
      this.isAudioRecordPaused = false;
      this.isAudioMicMuted = false;
      this._pendingSlideAudioFinalizers = [];
      this.audioRecordStartMs = 0;
      this.audioRecordPauseStartMs = 0;
      this.audioRecordTotalPausedMs = 0;
      this.audioMediaRecorder = null;
      this.audioMediaStream = null;
      this.audioRecordedChunks = [];
      this.audioTimeline = [];
      this.audioLaserStrokes = [];
      this.audioErasedStrokes = [];
      this.audioLaserStrokes = [];
      this.audioErasedStrokes = [];
      this.audioErasedStrokes = [];
      this.audioInitialState = null;
      this.audioFinalState = null;
      this.audioSyncData = null;
      this.isAudioPlaying = false;
      this._isAudioReplayActive = false;
      this._isAudioSyncPlayerVisible = false;
      this.audioReplayViewMode = 'video';
      this.audioPlayCurrentMs = 0;
      this.audioPlaybackRate = 1.0;
      this.audioPlayerEl = null;
      this._audioReplayRafId = null;
      this._audioRecordTimerId = null;
      this._lastAudioCursorRecordMs = -100;
      this._lastAudioStateRecordMs = -100;
      this._lastRecordedStateHash = '';
      this._enteredAudioFromViewerSlideIdx = null;
      this._isAudioRecMenuOpen = false;

      const btnFab = document.getElementById('btnAudioRecordToggle');
      const btnStealthDot = document.getElementById('btnStealthRecordDot');
      const btnMicMute = document.getElementById('btnAudioMicMuteToggle');
      const btnPauseRec = document.getElementById('btnAudioPauseRecord');
      const btnStopRec = document.getElementById('btnAudioStopRecord');
      const btnStealthPauseRec = document.getElementById('btnStealthPauseRecord');
      const btnStealthStopRec = document.getElementById('btnStealthStopRecord');
      const btnPlayPause = document.getElementById('btnAudioPlayPause');
      const scrubber = document.getElementById('audioSyncScrubber');
      const btnSpeed = document.getElementById('btnAudioSyncSpeed');
      const btnZoomReset = document.getElementById('btnAudioReplayZoomReset');
      const btnShowFinalNote = document.getElementById('btnAudioShowFinalNote');
      const btnReRecord = document.getElementById('btnAudioReRecord');
      const btnDelete = document.getElementById('btnAudioSyncDelete');
      const btnCloseBar = document.getElementById('btnAudioSyncCloseBar');

      if (btnFab) {
        btnFab.onclick = (e) => {
          e.stopPropagation();
          if (this.isAudioRecording) {
            this._isAudioRecMenuOpen = !this._isAudioRecMenuOpen;
            this.syncAudioRecordUI();
          } else {
            this._isAudioRecMenuOpen = false;
            this.startAudioRecording();
          }
        };
      }

      if (btnStealthDot) {
        btnStealthDot.onclick = (e) => {
          e.stopPropagation();
          if (this.isAudioRecording) {
            this._isAudioRecMenuOpen = !this._isAudioRecMenuOpen;
            this.syncAudioRecordUI();
          }
        };
      }

      if (!this._audioRecOutsideClickBound) {
        this._audioRecOutsideClickBound = true;
        window.addEventListener('pointerdown', (e) => {
          if (!this._isAudioRecMenuOpen) return;
          const t = e.target;
          if (t && typeof t.closest === 'function' && (
            t.closest('#wrapAudioRecordToggle') ||
            t.closest('#wrapStealthRecordDot')
          )) return;
          this._isAudioRecMenuOpen = false;
          this.syncAudioRecordUI();
        }, { passive: true });
      }

      if (btnMicMute) {
        btnMicMute.onclick = (e) => {
          e.stopPropagation();
          this.toggleAudioMicMute();
        };
      }

      if (btnPauseRec) {
        btnPauseRec.onclick = (e) => {
          e.stopPropagation();
          this._isAudioRecMenuOpen = false;
          this.togglePauseAudioRecording();
        };
      }

      if (btnStopRec) {
        btnStopRec.onclick = (e) => {
          e.stopPropagation();
          this._isAudioRecMenuOpen = false;
          this.stopAudioRecording();
        };
      }

      if (btnStealthPauseRec) {
        btnStealthPauseRec.onclick = (e) => {
          e.stopPropagation();
          this._isAudioRecMenuOpen = false;
          this.togglePauseAudioRecording();
        };
      }

      if (btnStealthStopRec) {
        btnStealthStopRec.onclick = (e) => {
          e.stopPropagation();
          this._isAudioRecMenuOpen = false;
          this.stopAudioRecording();
        };
      }

      if (btnPlayPause) {
        btnPlayPause.onclick = (e) => {
          e.stopPropagation();
          if (this.isAudioPlaying) {
            this.pauseAudioPlayback();
          } else {
            this.playAudioSync();
          }
        };
      }

      if (scrubber) {
        scrubber.addEventListener('input', (e) => {
          e.stopPropagation();
          const targetMs = Number(e.target.value) || 0;
          this.seekAudioSync(targetMs, false);
          this.showAudioPlayerBarTemporarily(2800);
        });
        const onScrubStart = () => {
          this._isScrubbingAudioBar = true;
          this.showAudioPlayerBarTemporarily(2800);
        };
        const onScrubEnd = () => {
          this._isScrubbingAudioBar = false;
          this.showAudioPlayerBarTemporarily(2800);
        };
        scrubber.addEventListener('pointerdown', onScrubStart, { passive: true });
        scrubber.addEventListener('touchstart', onScrubStart, { passive: true });
        window.addEventListener('pointerup', onScrubEnd, { passive: true });
        window.addEventListener('touchend', onScrubEnd, { passive: true });
        window.addEventListener('touchcancel', onScrubEnd, { passive: true });
      }

      if (btnSpeed) {
        const speeds = [1.0, 1.25, 1.5, 2.0, 0.8];
        btnSpeed.onclick = (e) => {
          e.stopPropagation();
          const idx = speeds.indexOf(this.audioPlaybackRate);
          this.audioPlaybackRate = speeds[(idx + 1) % speeds.length];
          btnSpeed.textContent = `${this.audioPlaybackRate}x`;
          if (this.audioPlayerEl) {
            this.audioPlayerEl.playbackRate = this.audioPlaybackRate;
          }
          this.showAudioPlayerBarTemporarily(2800);
        };
      }

      if (btnZoomReset) {
        btnZoomReset.onclick = (e) => {
          e.stopPropagation();
          this.resetReplayViewerZoom();
          this.showAudioPlayerBarTemporarily(2800);
        };
      }

      this._initReplayStageZoomPanInteractions();

      // 🌟 [영상 재생 중 하단 플레이바 자동 숨김 & 화면 터치/마우스 이동 시 즉시 깨우기 + 백그라운드 전환 시 음성 즉시 일시정지]
      if (!this._audioPlayerAutoHideAndLifecycleBound) {
        this._audioPlayerAutoHideAndLifecycleBound = true;
        const floatingBarEl = document.getElementById('audioSyncFloatingBar');
        if (floatingBarEl) {
          floatingBarEl.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'mouse') {
              this._isHoveringAudioBar = true;
              this.showAudioPlayerBarTemporarily(2800);
            }
          }, { passive: true });
          floatingBarEl.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'mouse') {
              this._isHoveringAudioBar = false;
              if (this.isAudioPlaying) this.showAudioPlayerBarTemporarily(2800);
            }
          }, { passive: true });
        }

        const wakeUpPlayerBar = (fromTouchOrClick = false) => {
          if (!this.isAudioPlaying && !this._isAudioReplayActive && !this.isStudentAudioVideoOnlyMode) return;
          const barEl = document.getElementById('audioSyncFloatingBar');
          const wasHidden = Boolean(barEl && barEl.classList.contains('player-bar-auto-hidden'));
          this.showAudioPlayerBarTemporarily(2800);
          if (wasHidden && fromTouchOrClick && barEl) {
            // 숨겨져 있던 바가 올라오는 첫 터치 순간에 바 내부 버튼이 오작동 클릭되는 현상 방지
            barEl.style.pointerEvents = 'none';
            if (this._audioBarWakePointerTimer) clearTimeout(this._audioBarWakePointerTimer);
            this._audioBarWakePointerTimer = setTimeout(() => {
              this._audioBarWakePointerTimer = null;
              if (barEl) barEl.style.pointerEvents = '';
            }, 220);
          }
        };

        window.addEventListener('touchstart', () => {
          wakeUpPlayerBar(true);
        }, { capture: true, passive: true });

        window.addEventListener('pointerdown', () => {
          wakeUpPlayerBar(true);
        }, { capture: true, passive: true });

        let lastWakeMoveX = 0;
        let lastWakeMoveY = 0;
        window.addEventListener('pointermove', (e) => {
          if (e.pointerType === 'touch') return;
          if (Math.hypot((e.clientX || 0) - lastWakeMoveX, (e.clientY || 0) - lastWakeMoveY) < 4) return;
          lastWakeMoveX = e.clientX || 0;
          lastWakeMoveY = e.clientY || 0;
          wakeUpPlayerBar(false);
        }, { capture: true, passive: true });

        const pauseAudioOnAppBackground = () => {
          if (this.isAudioPlaying) {
            this.pauseAudioPlayback(false);
          } else if (this.audioPlayerEl && !this.audioPlayerEl.paused) {
            try { this.audioPlayerEl.pause(); } catch (e) { }
          }
        };

        document.addEventListener('visibilitychange', () => {
          if (document.hidden || document.visibilityState === 'hidden') {
            pauseAudioOnAppBackground();
          }
        });

        window.addEventListener('pagehide', () => {
          pauseAudioOnAppBackground();
        });

        window.addEventListener('blur', () => {
          const ua = navigator.userAgent || '';
          const isMobileOrTabletOS = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
          if (isMobileOrTabletOS) {
            pauseAudioOnAppBackground();
          }
        });
      }

      if (btnShowFinalNote) {
        btnShowFinalNote.onclick = (e) => {
          e.stopPropagation();
          this.stopAudioPlayback(true);
        };
      }

      if (btnReRecord) {
        btnReRecord.onclick = (e) => {
          e.stopPropagation();
          this.stopAudioPlayback(true);
          this.startAudioRecording();
        };
      }

      if (btnDelete) {
        btnDelete.onclick = (e) => {
          e.stopPropagation();
          this.stopAudioPlayback(true);
          this.audioSyncData = null;
          this._isAudioSyncPlayerVisible = false;
          this.syncAudioRecordUI();
          this.render();
        };
      }

      const btnBackToViewer = document.getElementById('btnAudioBackToViewer');
      if (btnBackToViewer) {
        btnBackToViewer.onclick = async (e) => {
          e.stopPropagation();
          this.stopAudioPlayback(true);
          const curIdx = (this.isLessonPlaylistActive && typeof this.lessonPlaylistIndex === 'number')
            ? this.lessonPlaylistIndex
            : (this._viewerSlideIdx || 0);
          this.exitStudentAudioVideoOnlyMode();
          if (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides) && this._viewerPkg.playlistSlides.length > 0) {
            this._viewerPkg.currentIndex = Math.max(0, Math.min(this._viewerPkg.playlistSlides.length - 1, curIdx));
            await this.openSmartNoteViewer(this._viewerPkg, true);
          } else {
            await this.openCurrentWorkspaceInSmartViewer();
          }
        };
      }

      if (btnCloseBar) {
        btnCloseBar.onclick = (e) => {
          e.stopPropagation();
          if (this.isStudentAudioVideoOnlyMode) return;
          this.stopAudioPlayback(true);
          this._isAudioSyncPlayerVisible = false;
          this.syncAudioRecordUI();
        };
      }

      const btnHideRecBar = document.getElementById('btnAudioHideRecBar');
      if (btnHideRecBar) {
        btnHideRecBar.onclick = (e) => {
          e.stopPropagation();
          this._isRecBarStealthHidden = true;
          this.syncAudioRecordUI();
          this.showToast('🕵️ 상단 녹화 바를 숨겼습니다. 우측 [🎙️] 버튼을 누르면 녹음이 완료됩니다.');
        };
      }

      // 🌟 [전역 호버링 & 카드 위 포인팅 60fps 추적]:
      // 칠판 위뿐만 아니라 문제 카드(#problemCardWidget)·그래프 보관 카드(#graphCardWidget) 위에서
      // 펜을 띄운 채(호버링 모드) 동그라미를 치며 설명하는 모든 움직임을 빠짐없이 60fps로 기록합니다!
      if (!this._globalAudioHoverBound) {
        this._globalAudioHoverBound = true;
        const handleAudioPointerSample = (e, forceClickDown = false) => {
          if (e.pointerType === 'pen') this._markStylusPenDetected();
          if (!this.isAudioRecording || this.isAudioRecordPaused || this.isPdfModalOpen || this._isAudioWaitingForNextSlideSetup) return;
          if (this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser) {
            this._lastAudioInkActivePerfMs = performance.now();
          }
          // 필기 또는 레이저 드로잉 중에는 스트로크 자체 점 배열(pt.t)이 정밀 기록되므로 중복 호버 샘플링을 건너뛰어 녹화 중 필기 렉 0% 달성!
          if (!forceClickDown && (this.isDrawingInk || this.isStylusDrawing || this.isDrawingLaser)) return;
          if (e.pointerType === 'touch' && this.isStylusPalmRejectionActive()) return;
          if (e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight) {
            if (this._lastRecordedCursorKind !== 'hidden' && Array.isArray(this.audioTimeline)) {
              this._lastRecordedCursorKind = 'hidden';
              this.audioTimeline.push({
                t: this.getAudioRecordElapsedMs(),
                type: 'cursor',
                hidden: true
              });
            }
            return;
          }
          const tEl = e.target;
          // PDF 모달이나 녹화 컨트롤 버튼 자체 위에서는 포인터 숨김
          if (tEl && tEl.closest && (
            tEl.closest('.pdf-modal-backdrop') ||
            tEl.closest('#modalPdfViewer') ||
            tEl.closest('.audio-sync-floating-bar') ||
            tEl.closest('#audioSyncFloatingBar') ||
            tEl.closest('#wrapAudioRecordToggle') ||
            tEl.closest('#btnAudioRecordToggle') ||
            tEl.closest('#panelAudioRecordActions') ||
            tEl.closest('#wrapStealthRecordDot') ||
            tEl.closest('#btnStealthRecordDot') ||
            tEl.closest('#panelStealthRecordActions')
          )) {
            if (this._lastRecordedCursorKind !== 'hidden' && Array.isArray(this.audioTimeline)) {
              this._lastRecordedCursorKind = 'hidden';
              this.audioTimeline.push({
                t: this.getAudioRecordElapsedMs(),
                type: 'cursor',
                hidden: true
              });
            }
            return;
          }
          // 🌟 [대표님 핵심 UX]: 메뉴바 / 슬라이드 선택바 / 툴바 / 서랍 위로 마우스가 올라가면 펜이 사라지고 손가락(pointer) 또는 화살표(arrow) 아이콘으로 즉시 전환 기록!
          let directUiHit = Boolean(tEl && tEl.closest && (
            tEl.closest('.smart-modal-backdrop') ||
            tEl.closest('.n-axis-studio-backdrop') ||
            tEl.closest('.quick-pill-remote') ||
            tEl.closest('#quickPillRemote') ||
            tEl.closest('.sidebar-rail') ||
            tEl.closest('#sidebarRail') ||
            tEl.closest('.rail-dock') ||
            tEl.closest('#railDock') ||
            tEl.closest('.rail-drawer') ||
            tEl.closest('#railDrawer') ||
            tEl.closest('.canvas-quick-toolbar') ||
            tEl.closest('#rightActionToolbar') ||
            tEl.closest('.ink-floating-toolbar') ||
            tEl.closest('#inkFloatingToolbar') ||
            tEl.closest('.lesson-playlist-nav-bar') ||
            tEl.closest('#lessonPlaylistNavBar') ||
            tEl.closest('.curve-context-bar') ||
            tEl.closest('#curveContextBar') ||
            tEl.closest('.lasso-action-floating-bar') ||
            tEl.closest('#lassoActionFloatingBar') ||
            tEl.closest('.graph-snap-floating-bar') ||
            tEl.closest('#graphSnapFloatingBar') ||
            tEl.closest('#pdfToGraphCropFloatingBar') ||
            tEl.closest('.pw-region-popover') ||
            tEl.closest('#pwRegionPopover') ||
            tEl.closest('header')
          ));
          if (directUiHit) {
            const isDragHandle = Boolean(tEl && tEl.closest && tEl.closest('.ink-dock-drag-handle, .pill-drag-handle, .pill-remote-drag-handle'));
            const isInteractiveBtn = Boolean(tEl && tEl.closest && tEl.closest(
              'button, a, label, input, select, summary, [role="button"], .func-btn, .preset-card, .rail-btn, .ink-tool-btn, .ink-color-dot, .quick-fab-btn, .slide-num-chip, .cat-tab-btn, .card-btn, .ctx-btn, .lasso-action-btn, .pw-popover-item, .custom-preset-chip, .export-preset-btn'
            ));
            const isDownUI = forceClickDown || (typeof e.buttons === 'number' && e.buttons > 0);
            const uiCursorKind = isDragHandle
              ? (isDownUI ? 'grabbing' : 'grab')
              : (isInteractiveBtn ? 'pointer' : 'arrow');
            const uiMeta = this._extractAudioUiTargetMeta(tEl, e.clientX, e.clientY);
            this.recordAudioCursorPoint(
              e.clientX,
              e.clientY,
              this.currentInkColor || '#00d2d3',
              isDownUI,
              { ...uiMeta, cursorKind: uiCursorKind, uiScreen: true }
            );
            if (forceClickDown) {
              setTimeout(() => {
                if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
              }, 0);
              setTimeout(() => {
                if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
              }, 60);
            }
            return;
          }
          const cardEl = (this._isInteractingWithPipCard && this._activePipInteractionCardEl)
            ? this._activePipInteractionCardEl
            : ((tEl && tEl.closest)
              ? tEl.closest('#problemCardWidget, #graphCardWidget, .extra-problem-card-widget, .extra-graph-card-widget')
              : null);
          if (cardEl) {
            const isDownCard = Boolean(forceClickDown || this._isInteractingWithPipCard || (typeof e.buttons === 'number' && e.buttons > 0));
            // 카드 상단 버튼([대칭 ▾], [↕ x축 | ↔ y축 | ⤡ 원점], [|f|], [📍수선], [레이저], [⛶], [✕] 등) 위에서는 손가락(pointer) 아이콘!
            if (!this._isInteractingWithPipCard && tEl && tEl.closest && tEl.closest('button, .card-btn, .pip-pop-btn, .pip-hdr-popover, .problem-card-actions button')) {
              const uiMeta = this._extractAudioUiTargetMeta(tEl, e.clientX, e.clientY);
              this.recordAudioCursorPoint(
                e.clientX,
                e.clientY,
                this.currentInkColor || '#00d2d3',
                isDownCard,
                { ...uiMeta, cursorKind: 'pointer', uiScreen: true }
              );
              if (forceClickDown) {
                setTimeout(() => {
                  if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
                }, 0);
                setTimeout(() => {
                  if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
                }, 45);
              }
              return;
            }
            if (!cardEl.classList.contains('minimized')) {
              const bodyEl = cardEl.querySelector('.problem-card-body');
              if (bodyEl) {
                const nowPerf = performance.now();
                const layoutSig = `${cardEl.style.left}|${cardEl.style.top}|${cardEl.style.width}|${bodyEl.style.height}|${this.boardZoom || 1}|${this.boardPanX || 0}|${this.boardPanY || 0}`;
                let rect = cardEl._cachedAudioBodyRect;
                if (!rect || cardEl._cachedAudioBodyLayoutSig !== layoutSig || (nowPerf - (cardEl._cachedAudioBodyRectMs || 0) > 16)) {
                  rect = bodyEl.getBoundingClientRect();
                  cardEl._cachedAudioBodyRect = rect;
                  cardEl._cachedAudioBodyLayoutSig = layoutSig;
                  cardEl._cachedAudioBodyRectMs = nowPerf;
                }
                const inBodyRect = Boolean(
                  rect.width > 0 &&
                  rect.height > 0 &&
                  (this._isInteractingWithPipCard || (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom))
                );
                if (inBodyRect) {
                  const clampMin = this._isInteractingWithPipCard ? -0.25 : 0;
                  const clampMax = this._isInteractingWithPipCard ? 1.25 : 1;
                  const nx = Math.max(clampMin, Math.min(clampMax, (e.clientX - rect.left) / rect.width));
                  const ny = Math.max(clampMin, Math.min(clampMax, (e.clientY - rect.top) / rect.height));
                  const isLaser = Boolean((this.isInkMode && this.activeInkTool === 'laser') || cardEl.classList.contains('card-laser-active'));
                  const isCardInkOn = Boolean(
                    cardEl.classList.contains('card-ink-active') &&
                    this.isInkMode &&
                    (this.activeInkTool === 'pen' || this.activeInkTool === 'highlighter' || this.activeInkTool === 'eraser')
                  );
                  const cardBodyKind = isLaser
                    ? 'laser'
                    : (isCardInkOn ? this.activeInkTool : (isDownCard ? 'grabbing' : 'grab'));
                  this.recordAudioCursorPoint(
                    e.clientX,
                    e.clientY,
                    isLaser ? '#dc2626' : (this.currentInkColor || '#00d2d3'),
                    isDownCard,
                    { cardKey: this.getAudioCardKey(cardEl), nx, ny, isLaser, cursorKind: cardBodyKind }
                  );
                  return;
                }
              }
            }
            // 카드 헤더나 리사이즈 핸들을 잡고 이동/조작하는 경우 손바닥(grab/grabbing) 아이콘!
            this.recordAudioCursorPoint(
              e.clientX,
              e.clientY,
              this.currentInkColor || '#00d2d3',
              isDownCard,
              { cursorKind: isDownCard ? 'grabbing' : 'grab', uiScreen: true }
            );
            return;
          }
          // 일반 캔버스 위 호버링 및 그래프 극점 드래그/조작 모두 포함!
          const isDown = Boolean(
            forceClickDown ||
            this.isDrawingInk ||
            this.isStylusDrawing ||
            this.draggedHandleIdx !== null ||
            this.isDraggingCurve ||
            this.activePwDragIdx !== null ||
            this.isPanning ||
            this.isBoardPanning ||
            this._isInteractingWithPipCard ||
            (typeof e.buttons === 'number' && e.buttons > 0)
          );
          this.recordAudioCursorPoint(e.clientX, e.clientY, this.currentInkColor || '#00d2d3', isDown);
        };
        window.addEventListener('pointermove', (e) => handleAudioPointerSample(e, false), { passive: true, capture: true });
        window.addEventListener('pointerdown', (e) => handleAudioPointerSample(e, true), { passive: true, capture: true });
        const recordAfterUiInteraction = (e) => {
          if (!this.isAudioRecording || this.isAudioRecordPaused || this.isPdfModalOpen) return;
          if (this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser) {
            this._lastAudioInkActivePerfMs = performance.now();
            return;
          }
          const tEl = e && e.target;
          const isUiControlHit = Boolean(tEl && typeof tEl.closest === 'function' && tEl.closest(
            'button, a, label, input, select, summary, [role="button"], .func-btn, .preset-card, .rail-btn, .ink-tool-btn, .ink-color-dot, .quick-fab-btn, .slide-num-chip, .cat-tab-btn, .card-btn, .pip-pop-btn, .ctx-btn, .lasso-action-btn, .pw-popover-item, .custom-preset-chip, .export-preset-btn'
          ));
          if (!isUiControlHit && (performance.now() - (this._lastAudioInkActivePerfMs || 0) < 120)) {
            return;
          }
          if (this._postUiRecTimer0) clearTimeout(this._postUiRecTimer0);
          if (this._postUiRecTimer35) clearTimeout(this._postUiRecTimer35);
          this._postUiRecTimer0 = setTimeout(() => {
            this._postUiRecTimer0 = null;
            if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
          }, 0);
          this._postUiRecTimer35 = setTimeout(() => {
            this._postUiRecTimer35 = null;
            if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
          }, 35);
        };
        window.addEventListener('pointerup', recordAfterUiInteraction, { passive: true, capture: true });
        window.addEventListener('click', recordAfterUiInteraction, { passive: true, capture: true });
      }
    }

    getAudioRecordElapsedMs() {
      if (!this.isAudioRecording || !this.audioRecordStartMs) return 0;
      const now = this.isAudioRecordPaused
        ? (this.audioRecordPauseStartMs || performance.now())
        : performance.now();
      const pausedTotal = this.audioRecordTotalPausedMs || 0;
      return Math.max(0, Math.round(now - this.audioRecordStartMs - pausedTotal));
    }

    getAudioSessionElapsedMs() {
      if (!this.isAudioRecording || !this.audioSessionStartMs) return 0;
      const now = this.isAudioRecordPaused
        ? (this.audioRecordPauseStartMs || performance.now())
        : performance.now();
      const pausedTotal = this.audioSessionTotalPausedMs || 0;
      return Math.max(0, Math.round(now - this.audioSessionStartMs - pausedTotal));
    }

    getMaxAudioRecordDurationMs() {
      if (typeof this.getCurrentTierQuota === 'function') {
        const q = this.getCurrentTierQuota();
        if (q && q.maxRecordMs > 0) return q.maxRecordMs;
      }
      const cfg = (typeof this.getSubscriptionQuotaConfig === 'function')
        ? this.getSubscriptionQuotaConfig()
        : null;
      const isPro = (typeof this.isProSubscriber === 'function')
        ? this.isProSubscriber()
        : Boolean(this.isProUser);
      if (isPro) {
        return (cfg && cfg.proMaxRecordMs) ? cfg.proMaxRecordMs : (60 * 60 * 1000);
      }
      return (cfg && cfg.freeMaxRecordMs) ? cfg.freeMaxRecordMs : (3 * 60 * 1000);
    }

    _computeOtherSlidesRecordedDurationMs() {
      if (!Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length <= 1) return 0;
      const curIdx = (typeof this.lessonPlaylistIndex === 'number') ? this.lessonPlaylistIndex : -1;
      let sumMs = 0;
      for (let i = 0; i < this.lessonPlaylistSlides.length; i++) {
        if (i === curIdx) continue;
        const sl = this.lessonPlaylistSlides[i];
        if (!sl || !sl.audioSyncData) continue;
        const dur = Number(sl.audioSyncData.durationMs) || 0;
        if (dur > 0) sumMs += dur;
      }
      return Math.max(0, Math.round(sumMs));
    }

    getTotalLessonRecordedDurationMs() {
      const basePriorMs = this.isAudioRecording
        ? Math.max(0, Number(this._sessionBasePriorRecordedMs) || 0)
        : this._computeOtherSlidesRecordedDurationMs();
      return basePriorMs + this.getAudioSessionElapsedMs();
    }

    _updateAudioRecordProgressRings(forceSync = false) {
      const btnFab = document.getElementById('btnAudioRecordToggle');
      const btnStealthDot = document.getElementById('btnStealthRecordDot');
      const ringFab = document.getElementById('ringAudioRecordFab');
      const ringStealth = document.getElementById('ringStealthRecordDot');
      const cFab = 65.9734;     // 2 * Math.PI * 10.5
      const cStealth = 49.0088; // 2 * Math.PI * 7.8

      if (!this.isAudioRecording) {
        if (ringFab) ringFab.setAttribute('stroke-dashoffset', '0');
        if (ringStealth) ringStealth.setAttribute('stroke-dashoffset', '0');
        if (btnFab) btnFab.classList.remove('is-ending-soon');
        if (btnStealthDot) btnStealthDot.classList.remove('is-ending-soon');
        this._lastRingOffsetFab = 0;
        this._lastRingOffsetStealth = 0;
        this._lastRingEndingSoon = false;
        return;
      }

      const maxDurationMs = Math.max(1000, this.getMaxAudioRecordDurationMs());
      const maxMinutes = Math.max(1, Math.round(maxDurationMs / 60000));
      const totalElapsed = this.getTotalLessonRecordedDurationMs();

      // 제한 시간(무료 3분 / Pro·Premium 60분) 도달 시 데이터 보호를 위해 안전하게 자동 마감
      if (totalElapsed >= maxDurationMs && !this._isAutoStoppingByLimit) {
        this._isAutoStoppingByLimit = true;
        const isPaid = (typeof this.isProSubscriber === 'function') ? this.isProSubscriber() : Boolean(this.isProUser);
        this.stopAudioRecording({ silentToast: true }).then(() => {
          this._isAutoStoppingByLimit = false;
          this.showToast(
            isPaid
              ? `⏹ ${maxMinutes}분 녹화가 안전하게 자동 완료되었습니다.`
              : `⏹ 무료 플랜 ${maxMinutes}분 녹화가 자동 완료되었습니다. (Pro·Premium 구독 시 60분 녹화)`
          );
        }).catch(() => {
          this._isAutoStoppingByLimit = false;
        });
        return;
      }

      const remainMs = Math.max(0, maxDurationMs - totalElapsed);
      const isPaidNow = (typeof this.isProSubscriber === 'function') ? this.isProSubscriber() : Boolean(this.isProUser);
      const warnThresholdMs = isPaidNow ? 180000 : 30000;
      if (!this._warnedEndingSoonInSession && totalElapsed >= 5000 && remainMs > 0 && remainMs <= warnThresholdMs) {
        this._warnedEndingSoonInSession = true;
        const remainSec = Math.max(1, Math.ceil(remainMs / 1000));
        const remainLabel = remainSec >= 60 ? `약 ${Math.round(remainSec / 60)}분` : `${remainSec}초`;
        this.showToast(`⏳ 녹화 제한 시간(${maxMinutes}분) 종료까지 ${remainLabel} 남았습니다.`);
      }

      // 필기 획을 긋고 있는 도중에는 DOM 속성 갱신을 건너뛰어 필기 성능 영향 0% 보장
      if (!forceSync && (this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser || this.isErasingInk)) return;

      const elapsedRatio = Math.max(0, Math.min(1, totalElapsed / maxDurationMs));
      const remainRatio = 1 - elapsedRatio;
      const isEndingSoon = remainMs <= warnThresholdMs || remainRatio <= 0.10;

      const offFab = Math.round(elapsedRatio * cFab * 100) / 100;
      const offStealth = Math.round(elapsedRatio * cStealth * 100) / 100;

      if (forceSync || Math.abs(offFab - (this._lastRingOffsetFab || 0)) >= 0.04) {
        this._lastRingOffsetFab = offFab;
        if (ringFab) ringFab.setAttribute('stroke-dashoffset', String(offFab));
      }
      if (forceSync || Math.abs(offStealth - (this._lastRingOffsetStealth || 0)) >= 0.04) {
        this._lastRingOffsetStealth = offStealth;
        if (ringStealth) ringStealth.setAttribute('stroke-dashoffset', String(offStealth));
      }
      if (forceSync || isEndingSoon !== Boolean(this._lastRingEndingSoon)) {
        this._lastRingEndingSoon = isEndingSoon;
        if (btnFab) btnFab.classList.toggle('is-ending-soon', isEndingSoon);
        if (btnStealthDot) btnStealthDot.classList.toggle('is-ending-soon', isEndingSoon);
      }
    }

    togglePauseAudioRecording(forcePause = null) {
      if (!this.isAudioRecording) return false;
      const nextPaused = (typeof forcePause === 'boolean') ? forcePause : !this.isAudioRecordPaused;
      if (nextPaused === this.isAudioRecordPaused) return this.isAudioRecordPaused;

      if (nextPaused) {
        this._recordAudioWorkspaceStateIfNeeded(true);
        this.isAudioRecordPaused = true;
        this.audioRecordPauseStartMs = performance.now();
        if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'recording') {
          try { this.audioMediaRecorder.pause(); } catch (e) { }
        }
        this.showToast('⏸ 녹화가 일시정지되었습니다. [▶ 이어녹화]를 누르면 끊김 없이 이어집니다.');
      } else {
        const pausedDelta = Math.max(0, performance.now() - (this.audioRecordPauseStartMs || performance.now()));
        this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + pausedDelta;
        this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
        this.isAudioRecordPaused = false;
        this.audioRecordPauseStartMs = 0;
        if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'paused') {
          try { this.audioMediaRecorder.resume(); } catch (e) { }
        }
        this._recordAudioWorkspaceStateIfNeeded(true);
        this.showToast('▶ 녹화를 이어서 진행합니다!');
      }
      this.syncAudioRecordUI();
      return this.isAudioRecordPaused;
    }

    // 🎙️✨ [대표님 기획: 표준 인강 스튜디오급 실시간 음성 자동 보정 파이프라인 (Web Audio API)]
    // 노트북·태블릿 내장 마이크로 대충 녹화해도 '펜 타격 저음 컷 + 방울림 억제 + 자음 선명도 부스트 + 볼륨 균일화 컴프레서'가 0ms 지연으로 자동 적용!
    async _acquireProcessedAudioStream() {
      this._cleanupProcessedAudioStream();
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        return null;
      }
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        }
      });
      this.audioRawStream = rawStream;
      try {
        rawStream.getAudioTracks().forEach(tr => {
          tr.enabled = !this.isAudioMicMuted;
        });
      } catch (e) { }

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx({ latencyHint: 'interactive' });
          if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
            await ctx.resume().catch(() => { });
          }
          const source = ctx.createMediaStreamSource(rawStream);

          // 1. Low-Cut (High-Pass @ 90Hz): 에어컨·팬 소음 및 태블릿 유리에 펜촉 부딪히는 둔탁한 '툭툭' 저음 제거
          const hpFilter = ctx.createBiquadFilter();
          hpFilter.type = 'highpass';
          hpFilter.frequency.value = 90;
          hpFilter.Q.value = 0.707;

          // 2. Anti-Boxiness & Warmth: 내장 마이크 특유의 먹먹한 방울림(260Hz) 억제 및 목소리 중심 톤(155Hz) 보강
          const mudFilter = ctx.createBiquadFilter();
          mudFilter.type = 'peaking';
          mudFilter.frequency.value = 260;
          mudFilter.Q.value = 1.1;
          mudFilter.gain.value = -2.0;

          const warmthFilter = ctx.createBiquadFilter();
          warmthFilter.type = 'peaking';
          warmthFilter.frequency.value = 155;
          warmthFilter.Q.value = 0.9;
          warmthFilter.gain.value = 1.4;

          // 3. Vocal Presence EQ (3.3kHz +2.8dB): 한국어 자음·발음 명료도를 핀마이크 수준으로 또렷하게 부스트
          const presenceFilter = ctx.createBiquadFilter();
          presenceFilter.type = 'peaking';
          presenceFilter.frequency.value = 3300;
          presenceFilter.Q.value = 1.0;
          presenceFilter.gain.value = 2.8;

          // 4. De-Harshness Low-Pass (11.5kHz): 귀 피로한 고주파 화이트노이즈 및 치찰음('ㅅ/ㅊ') 정돈
          const lpFilter = ctx.createBiquadFilter();
          lpFilter.type = 'lowpass';
          lpFilter.frequency.value = 11500;
          lpFilter.Q.value = 0.707;

          // 5. Broadcast Soft-Knee Compressor: 판서하며 고개를 돌려 작아진 목소리는 키우고 큰 소리는 부드럽게 평준화
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -23;
          compressor.knee.value = 16;
          compressor.ratio.value = 3.2;
          compressor.attack.value = 0.004;
          compressor.release.value = 0.22;

          // 6. Make-up Gain & Brickwall Limiter: 전체 음량을 풍성하게 올리면서 클리핑(찢어짐) 100% 차단
          const makeupGain = ctx.createGain();
          makeupGain.gain.value = 1.22;

          const limiter = ctx.createDynamicsCompressor();
          limiter.threshold.value = -1.2;
          limiter.knee.value = 0;
          limiter.ratio.value = 20.0;
          limiter.attack.value = 0.001;
          limiter.release.value = 0.08;

          const dest = ctx.createMediaStreamDestination();
          source.connect(hpFilter);
          hpFilter.connect(mudFilter);
          mudFilter.connect(warmthFilter);
          warmthFilter.connect(presenceFilter);
          presenceFilter.connect(lpFilter);
          lpFilter.connect(compressor);
          compressor.connect(makeupGain);
          makeupGain.connect(limiter);
          limiter.connect(dest);

          if (dest.stream && dest.stream.getAudioTracks().length > 0) {
            this._audioVoiceContext = ctx;
            dest.stream.getAudioTracks().forEach(tr => {
              tr.enabled = !this.isAudioMicMuted;
            });
            return dest.stream;
          }
          try { ctx.close(); } catch (e) { }
        }
      } catch (e) { }

      return rawStream;
    }

    _cleanupProcessedAudioStream() {
      if (this.audioMediaStream) {
        try {
          this.audioMediaStream.getTracks().forEach(tr => tr.stop());
        } catch (e) { }
        this.audioMediaStream = null;
      }
      if (this.audioRawStream) {
        try {
          this.audioRawStream.getTracks().forEach(tr => tr.stop());
        } catch (e) { }
        this.audioRawStream = null;
      }
      if (this._audioVoiceContext) {
        try {
          if (this._audioVoiceContext.state !== 'closed') {
            this._audioVoiceContext.close().catch(() => { });
          }
        } catch (e) { }
        this._audioVoiceContext = null;
      }
    }

    toggleAudioMicMute(forceMuted = null) {
      this.isAudioMicMuted = (typeof forceMuted === 'boolean') ? forceMuted : !this.isAudioMicMuted;
      if (this.audioRawStream) {
        try {
          this.audioRawStream.getAudioTracks().forEach(tr => {
            tr.enabled = !this.isAudioMicMuted;
          });
        } catch (e) { }
      }
      if (this.audioMediaStream) {
        try {
          this.audioMediaStream.getAudioTracks().forEach(tr => {
            tr.enabled = !this.isAudioMicMuted;
          });
        } catch (e) { }
      }
      this.syncAudioRecordUI();
      return this.isAudioMicMuted;
    }

    // 🌟 [원테이크 통째 강의 녹음 + 슬라이드별 자동 챕터 분할 & 왕복(3번➔2번➔3번) 이어녹음 엔진]:
    // 선생님이 녹음 버튼을 한 번 켜고 1번 ➔ 2번 ➔ ... ➔ 10번 슬라이드를 넘기거나,
    // 3번에서 2번으로 돌아갔다가 다시 3번으로 넘어오며 통째로 강의를 찍을 때,
    // 슬라이드를 넘기는 순간 이전 슬라이드의 음성·필기·그래프 타임라인 세그먼트를 누적 보존하고
    // 다음(또는 재방문한) 슬라이드 녹음을 0.00초 딜레이로 즉시 이어갑니다!
    _finalizeCurrentSlideAudioSegmentBeforeSwitch(nextSlideIdx = null, explicitNextStartMs = null) {
      if (!this.isAudioRecording) return;
      const segStartMs = Math.max(0, Number(this._resumedSlideBaseOffsetMs) || 0);
      const durationMs = Math.max(segStartMs + 200, this.getAudioRecordElapsedMs());
      const segDurMs = Math.max(100, durationMs - segStartMs);
      this._recordAudioWorkspaceStateIfNeeded(true);
      const finalState = this._captureAudioWorkspaceKeyframe();
      const initialState = this.audioInitialState || finalState;
      const timeline = this.audioTimeline ? [...this.audioTimeline] : [];
      const laserStrokes = this.audioLaserStrokes ? [...this.audioLaserStrokes] : [];
      const erasedStrokes = this.audioErasedStrokes ? [...this.audioErasedStrokes] : [];
      const mimeType = this._audioMimeType || 'audio/wav';
      const fallbackSegSilentUrl = this._createSilentWavDataUrl(segDurMs);

      let resolvedNextStartMs = explicitNextStartMs;
      if (resolvedNextStartMs === null && typeof nextSlideIdx === 'number' && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides[nextSlideIdx]) {
        const targetSync = this.lessonPlaylistSlides[nextSlideIdx].audioSyncData;
        const isSameSession = !this._currentAudioRecordingSessionId || !targetSync || !targetSync.sessionId || targetSync.sessionId === this._currentAudioRecordingSessionId;
        resolvedNextStartMs = (isSameSession && targetSync && typeof targetSync.durationMs === 'number' && targetSync.durationMs > 0)
          ? targetSync.durationMs
          : 0;
      }

      const priorSegs = Array.isArray(this._priorSlideAudioSegments)
        ? JSON.parse(JSON.stringify(this._priorSlideAudioSegments))
        : [];
      const newSeg = {
        startMs: segStartMs,
        endMs: durationMs,
        durationMs: segDurMs,
        audioDataUrl: fallbackSegSilentUrl,
        mimeType,
        nextSlideIdx: typeof nextSlideIdx === 'number' ? nextSlideIdx : null,
        nextSlideStartMs: typeof resolvedNextStartMs === 'number' ? resolvedNextStartMs : 0
      };
      const audioSegments = [...priorSegs, newSeg];
      const segIdx = audioSegments.length - 1;
      const primaryAudioUrl = (audioSegments[0] && audioSegments[0].audioDataUrl) || fallbackSegSilentUrl;

      const recordedStageW = Math.round(
        (initialState && initialState.stageW) ||
        (finalState && finalState.stageW) ||
        this.screenWidth ||
        window.innerWidth ||
        1440
      );
      const recordedStageH = Math.round(
        (initialState && initialState.stageH) ||
        (finalState && finalState.stageH) ||
        this.screenHeight ||
        window.innerHeight ||
        900
      );
      const segAudioSyncData = {
        version: '1.2',
        sessionId: this._currentAudioRecordingSessionId || null,
        createdAt: Date.now(),
        stageW: recordedStageW,
        stageH: recordedStageH,
        durationMs,
        mimeType,
        audioDataUrl: primaryAudioUrl,
        audioSegments,
        initialState,
        finalState,
        timeline,
        laserStrokes,
        erasedStrokes
      };
      this.audioSyncData = segAudioSyncData;

      const prevRecorder = this.audioMediaRecorder;
      const prevChunksRef = (prevRecorder && Array.isArray(prevRecorder._localChunks))
        ? prevRecorder._localChunks
        : (this.audioRecordedChunks ? [...this.audioRecordedChunks] : []);
      const targetSlideIdx = this.lessonPlaylistIndex;
      const segCreatedAt = segAudioSyncData.createdAt;
      const wasMuted = Boolean(this.isAudioMicMuted);
      this.audioMediaRecorder = null;
      this.audioRecordedChunks = [];

      if (prevRecorder && prevRecorder.state !== 'inactive') {
        if (!this._pendingSlideAudioFinalizers) this._pendingSlideAudioFinalizers = [];
        const p = new Promise((resolve) => {
          prevRecorder.onstop = async () => {
            try {
              const finalChunks = (prevRecorder && Array.isArray(prevRecorder._localChunks) && prevRecorder._localChunks.length > 0)
                ? prevRecorder._localChunks
                : prevChunksRef;
              if (!wasMuted && finalChunks.length > 0) {
                const blob = new Blob(finalChunks, { type: mimeType });
                const dataUrl = await new Promise((res) => {
                  const reader = new FileReader();
                  reader.onloadend = () => res(reader.result || '');
                  reader.onerror = () => res('');
                  reader.readAsDataURL(blob);
                });
                if (dataUrl) {
                  if (segAudioSyncData.audioSegments && segAudioSyncData.audioSegments[segIdx]) {
                    segAudioSyncData.audioSegments[segIdx].audioDataUrl = dataUrl;
                  }
                  if (segIdx === 0) {
                    segAudioSyncData.audioDataUrl = dataUrl;
                  }
                  if (Array.isArray(this.lessonPlaylistSlides)) {
                    const applyUrlToSlideSync = (slideSync) => {
                      if (!slideSync) return;
                      if (Array.isArray(slideSync.audioSegments) && slideSync.audioSegments[segIdx]) {
                        slideSync.audioSegments[segIdx].audioDataUrl = dataUrl;
                      }
                      if (segIdx === 0) {
                        slideSync.audioDataUrl = dataUrl;
                      }
                    };
                    if (this.lessonPlaylistSlides[targetSlideIdx] && this.lessonPlaylistSlides[targetSlideIdx].audioSyncData) {
                      applyUrlToSlideSync(this.lessonPlaylistSlides[targetSlideIdx].audioSyncData);
                    }
                    this.lessonPlaylistSlides.forEach(sl => {
                      if (sl && sl.audioSyncData && sl.audioSyncData.createdAt === segCreatedAt) {
                        applyUrlToSlideSync(sl.audioSyncData);
                      }
                    });
                  }
                  if (this.lessonPlaylistIndex === targetSlideIdx && Array.isArray(this._priorSlideAudioSegments) && this._priorSlideAudioSegments[segIdx]) {
                    this._priorSlideAudioSegments[segIdx].audioDataUrl = dataUrl;
                  }
                }
              }
            } catch (e) { }
            resolve();
          };
          try {
            prevRecorder.stop();
          } catch (e) {
            resolve();
          }
        });
        this._lastRecorderStopPromise = p;
        this._pendingSlideAudioFinalizers.push(p);
      }
    }

    _beginNextSlideAudioSegmentAfterSwitch() {
      if (!this.isAudioRecording) return;
      const markPreExisting = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(st => {
          if (st && st.tStart === undefined) {
            st.preExisting = true;
          }
        });
      };
      markPreExisting(this.inkStrokes);
      markPreExisting(this.problemInkStrokes);
      markPreExisting(this.graphInkStrokes);
      if (this.extraProblemCards) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el && Array.isArray(c.el._cardInkStrokes)) markPreExisting(c.el._cardInkStrokes);
        });
      }
      if (this.extraGraphCards) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el && Array.isArray(c.el._cardInkStrokes)) markPreExisting(c.el._cardInkStrokes);
        });
      }

      const isSameSession = !this._currentAudioRecordingSessionId || !this.audioSyncData || !this.audioSyncData.sessionId || this.audioSyncData.sessionId === this._currentAudioRecordingSessionId;
      const prevSync = (isSameSession && this.audioSyncData && typeof this.audioSyncData.durationMs === 'number' && this.audioSyncData.durationMs > 0)
        ? this._expandAudioSyncData(this.audioSyncData)
        : null;

      const localChunks = [];
      this.audioSyncData = null;
      this.audioRecordedChunks = localChunks;
      const segToken = (this._audioSegmentToken = (this._audioSegmentToken || 0) + 1);

      if (prevSync) {
        const baseOffsetMs = Math.max(0, Number(prevSync.durationMs) || 0);
        this._resumedSlideBaseOffsetMs = baseOffsetMs;
        this._priorSlideAudioSegments = (Array.isArray(prevSync.audioSegments) && prevSync.audioSegments.length > 0)
          ? JSON.parse(JSON.stringify(prevSync.audioSegments))
          : (prevSync.audioDataUrl ? [{
            startMs: 0,
            endMs: baseOffsetMs,
            durationMs: baseOffsetMs,
            audioDataUrl: prevSync.audioDataUrl,
            mimeType: prevSync.mimeType || 'audio/wav',
            nextSlideIdx: null,
            nextSlideStartMs: 0
          }] : []);
        this.audioInitialState = prevSync.initialState
          ? JSON.parse(JSON.stringify(prevSync.initialState))
          : this._captureAudioWorkspaceKeyframe();
        this.audioTimeline = Array.isArray(prevSync.timeline) ? [...prevSync.timeline] : [];
        this.audioLaserStrokes = Array.isArray(prevSync.laserStrokes) ? [...prevSync.laserStrokes] : [];
        this.audioErasedStrokes = Array.isArray(prevSync.erasedStrokes) ? [...prevSync.erasedStrokes] : [];
        if (this.isAudioRecordPaused && this.audioRecordPauseStartMs) {
          this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + Math.max(0, performance.now() - this.audioRecordPauseStartMs);
        }
        this.audioRecordStartMs = performance.now() - baseOffsetMs;
        this.audioRecordPauseStartMs = this.isAudioRecordPaused ? performance.now() : 0;
        this.audioRecordTotalPausedMs = 0;
        this._lastAudioCursorRecordMs = baseOffsetMs - 100;
        this._lastAudioStateRecordMs = baseOffsetMs - 100;
        this._lastAudioStateCheckMs = baseOffsetMs - 100;
        this._wasActivelyDraggingGraph = false;
        this._lastRecordedStateHash = '';
        this._recordAudioWorkspaceStateIfNeeded(true);
      } else {
        if (this.isAudioRecordPaused && this.audioRecordPauseStartMs) {
          this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + Math.max(0, performance.now() - this.audioRecordPauseStartMs);
        }
        this._resumedSlideBaseOffsetMs = 0;
        this._priorSlideAudioSegments = [];
        this.audioTimeline = [];
        this.audioLaserStrokes = [];
        this.audioErasedStrokes = [];
        this.audioRecordStartMs = performance.now();
        this.audioRecordPauseStartMs = this.isAudioRecordPaused ? performance.now() : 0;
        this.audioRecordTotalPausedMs = 0;
        this._lastAudioCursorRecordMs = -100;
        this._lastAudioStateRecordMs = -100;
        this._lastAudioStateCheckMs = -100;
        this._wasActivelyDraggingGraph = false;
        this._lastRecordedStateHash = '';
        this.audioInitialState = this._captureAudioWorkspaceKeyframe();
        this._recordAudioWorkspaceStateIfNeeded(true);
      }

      if (window.MediaRecorder) {
        const startNextRecorder = async () => {
          if (this._lastRecorderStopPromise) {
            try { await this._lastRecorderStopPromise; } catch (e) { }
          }
          if (!this.isAudioRecording || this._audioSegmentToken !== segToken) return;
          try {
            const hasLiveTrack = Boolean(
              this.audioMediaStream &&
              typeof this.audioMediaStream.getAudioTracks === 'function' &&
              this.audioMediaStream.getAudioTracks().some(tr => tr.readyState === 'live')
            );
            if (!hasLiveTrack && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
              this.audioMediaStream = await this._acquireProcessedAudioStream();
            }
            if (!this.isAudioRecording || this._audioSegmentToken !== segToken || !this.audioMediaStream) return;
            this.audioMediaStream.getAudioTracks().forEach(tr => {
              tr.enabled = !this.isAudioMicMuted;
            });
            const chosenMime = this._audioMimeType && this._audioMimeType !== 'audio/wav' ? this._audioMimeType : '';
            const recOpts = chosenMime ? { mimeType: chosenMime, audioBitsPerSecond: 36000 } : { audioBitsPerSecond: 36000 };
            const recorder = new MediaRecorder(this.audioMediaStream, recOpts);
            recorder._localChunks = localChunks;
            recorder.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) {
                localChunks.push(ev.data);
              }
            };
            recorder.start(250);
            if (this.isAudioRecordPaused && recorder.state === 'recording') {
              try { recorder.pause(); } catch (e) { }
            }
            this.audioMediaRecorder = recorder;
          } catch (e) {
            this.audioMediaRecorder = null;
          }
        };
        this._pendingSlideRecorderStarter = startNextRecorder();
      }
      this.syncAudioRecordUI();
    }

    formatAudioTimeMmSs(ms) {
      const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    _createSilentWavDataUrl(durationMs = 1000) {
      // 🌟 [무음 폴백 WAV 초경량화 (1.28MB ➔ 1.1KB)]:
      // 재생 타임라인은 performance.now() 정밀 벽시계로 구동되므로, 무음 WAV는 브라우저 <audio> 초기화용 최소 샘플(800바이트)만 생성!
      const sampleRate = 4000;
      const numSamples = 800;
      const buffer = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buffer);
      const writeStr = (offset, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numSamples, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true); // 8-bit unsigned
      writeStr(36, 'data');
      view.setUint32(40, numSamples, true);
      for (let i = 0; i < numSamples; i++) {
        view.setUint8(44 + i, 128);
      }
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return 'data:audio/wav;base64,' + btoa(binary);
    }

    _extractCompactPipSnapForAudio(cardRef, fallbackW = 430, fallbackAspect = 0.82) {
      try {
        const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
        const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
        const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
        const cloneArr = (arr) => (Array.isArray(arr) && arr.length > 0) ? JSON.parse(JSON.stringify(arr)) : [];
        const raw = typeof this._getMutablePipCardSnapshot === 'function'
          ? this._getMutablePipCardSnapshot(cardRef)
          : null;
        if (!raw || typeof raw !== 'object') return null;
        const clonedGraphs = cloneArr(raw.graphs);
        clonedGraphs.forEach(g => {
          if (!g) return;
          delete g._screenPts;
          if (Array.isArray(g.handles)) {
            g.handles.forEach(h => {
              if (h && typeof h.x === 'number') h.x = r4(h.x);
              if (h && typeof h.y === 'number') h.y = r4(h.y);
            });
          }
          if (g.freezeOffset) {
            if (typeof g.freezeOffset.x === 'number') g.freezeOffset.x = r4(g.freezeOffset.x);
            if (typeof g.freezeOffset.y === 'number') g.freezeOffset.y = r4(g.freezeOffset.y);
          }
          if (Array.isArray(g.transforms)) {
            g.transforms.forEach(tr => {
              if (tr && tr.offset) {
                if (typeof tr.offset.x === 'number') tr.offset.x = r4(tr.offset.x);
                if (typeof tr.offset.y === 'number') tr.offset.y = r4(tr.offset.y);
              }
            });
          }
        });
        const w = r1(raw._pipCardW || fallbackW || 430);
        const aspect = r3(raw.aspect || fallbackAspect || 0.82);
        const h = r1(raw._pipCardH || Math.max(120, Math.round(w * aspect)));
        return {
          graphs: clonedGraphs,
          activeGraphIdx: typeof raw.activeGraphIdx === 'number' ? raw.activeGraphIdx : (clonedGraphs.length > 0 ? 0 : -1),
          isCurveSelected: Boolean(raw.isCurveSelected),
          selectedHandleIdx: raw.selectedHandleIdx ?? null,
          draggedHandleIdx: raw.draggedHandleIdx ?? null,
          panX: r1(raw.panX || 0),
          panY: r1(raw.panY || 0),
          zoomLevel: r3(raw.zoomLevel || 1.0),
          xSpan: r3(raw.xSpan || 8.5),
          ySpan: r3(raw.ySpan || 6.0),
          showAxes: raw.showAxes !== false,
          showGuides: Boolean(raw.showGuides),
          usePiecewise: Boolean(raw.usePiecewise),
          piecewiseBoundaries: (raw.piecewiseBoundaries || []).map(v => r4(v)),
          piecewiseFuncMap: cloneArr(raw.piecewiseFuncMap),
          piecewiseInclusions: cloneArr(raw.piecewiseInclusions),
          isPiecewisePeriodic: Boolean(raw.isPiecewisePeriodic),
          periodicStepY: typeof raw.periodicStepY === 'number' ? r3(raw.periodicStepY) : 0,
          isPiecewiseLocked: Boolean(raw.isPiecewiseLocked),
          dropLines: cloneArr(raw.dropLines),
          textLabels: cloneArr(raw.textLabels),
          isPipLocked: Boolean(raw.isPipLocked),
          isPipDropLineMode: Boolean(raw.isPipDropLineMode),
          isPipSymPopoverOpen: Boolean(raw.isPipSymPopoverOpen),
          _isDraggingCurve: Boolean(raw._isDraggingCurve),
          _pipDropLineHoverCand: raw._pipDropLineHoverCand
            ? {
              x: r4(raw._pipDropLineHoverCand.x),
              y: r4(raw._pipDropLineHoverCand.y),
              name: raw._pipDropLineHoverCand.name || '특이점',
              color: raw._pipDropLineHoverCand.color || '#00d2d3',
              isCandidate: Boolean(raw._pipDropLineHoverCand.isCandidate),
              type: raw._pipDropLineHoverCand.type || 'candidate'
            }
            : null,
          aspect,
          _isPipCardSnapshot: true,
          _pipCardW: w,
          _pipCardH: h
        };
      } catch (_) {
        return null;
      }
    }

    _captureAudioWorkspaceKeyframe() {
      const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
      const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
      const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
      const cloneArr = (arr) => (Array.isArray(arr) && arr.length > 0) ? JSON.parse(JSON.stringify(arr)) : [];
      const pWidget = document.getElementById('problemCardWidget');
      const gWidget = document.getElementById('graphCardWidget');
      const probW = pWidget ? (parseFloat(pWidget.style.width) || pWidget.offsetWidth || 520) : 520;
      const graphW = gWidget ? (parseFloat(gWidget.style.width) || gWidget.offsetWidth || 260) : 260;
      const extraGraphStates = (this.extraGraphCards || []).map(c => {
        const cw = r1((c && c.el) ? (parseFloat(c.el.style.width) || c.el.offsetWidth || 260) : 260);
        const cAspect = r3((c && typeof c.aspect === 'number') ? c.aspect : 0.82);
        return {
          baseX: r1(c && typeof c.baseX === 'number' ? c.baseX : 560),
          baseY: r1(c && typeof c.baseY === 'number' ? c.baseY : 68),
          pdfAnchor: (c && (c.el && c.el._pdfAnchor || c.pdfAnchor)) ? { ...(c.el && c.el._pdfAnchor || c.pdfAnchor) } : null,
          w: cw,
          aspect: cAspect,
          min: Boolean(c && (c.isMin || (c.el && c.el.classList.contains('minimized')))),
          inkActive: Boolean(c && c.el && c.el.classList.contains('card-ink-active')),
          stealth: Boolean(c && c.el && c.el.classList.contains('pip-stealth-locked')),
          pipSnap: c ? this._extractCompactPipSnapForAudio(c, cw, cAspect) : null
        };
      });
      const extraProbStates = (this.extraProblemCards || []).map(c => ({
        baseX: r1(c && typeof c.baseX === 'number' ? c.baseX : 72),
        baseY: r1(c && typeof c.baseY === 'number' ? c.baseY : 120),
        pdfAnchor: (c && (c.el && c.el._pdfAnchor || c.pdfAnchor)) ? { ...(c.el && c.el._pdfAnchor || c.pdfAnchor) } : null,
        w: r1((c && c.el) ? (parseFloat(c.el.style.width) || c.el.offsetWidth || 480) : 480),
        min: Boolean(c && (c.isMin || (c.el && c.el.classList.contains('minimized')))),
        inkActive: Boolean(c && c.el && c.el.classList.contains('card-ink-active')),
        locked: Boolean(c && c.el && c.el.classList.contains('pip-locked-mode')),
        stealth: Boolean(c && c.el && c.el.classList.contains('pip-stealth-locked'))
      }));
      const clonedGraphs = cloneArr(this.graphs);
      clonedGraphs.forEach(g => {
        if (!g) return;
        delete g._screenPts;
        if (Array.isArray(g.handles)) {
          g.handles.forEach(h => {
            if (h && typeof h.x === 'number') h.x = r4(h.x);
            if (h && typeof h.y === 'number') h.y = r4(h.y);
          });
        }
        if (g.freezeOffset) {
          if (typeof g.freezeOffset.x === 'number') g.freezeOffset.x = r4(g.freezeOffset.x);
          if (typeof g.freezeOffset.y === 'number') g.freezeOffset.y = r4(g.freezeOffset.y);
        }
      });
      const sidebarRailEl = document.getElementById('sidebarRail');
      const drawerOpen = Boolean(!this.isDrawerCollapsed && (!sidebarRailEl || !sidebarRailEl.classList.contains('drawer-collapsed')));
      const activeCatBtn = document.querySelector('#railDrawer .cat-tab-btn.active');
      const activePresetCat = this._currentCat || ((activeCatBtn && activeCatBtn.dataset && activeCatBtn.dataset.cat) ? activeCatBtn.dataset.cat : '');
      const cropChoiceBar = document.getElementById('pdfToGraphCropFloatingBar');
      const isPdfCropChoiceMenuOpen = Boolean(this._isPdfCropChoiceMenuOpen || (cropChoiceBar && cropChoiceBar.style.display !== 'none'));
      const pwPopoverEl = document.getElementById('pwRegionPopover');
      const pwPopover = (pwPopoverEl && pwPopoverEl.style.display !== 'none' && typeof this._openPwRegionIdx === 'number')
        ? {
          regionIdx: this._openPwRegionIdx,
          left: Math.round(parseFloat(pwPopoverEl.style.left) || 0),
          top: Math.round(parseFloat(pwPopoverEl.style.top) || 0)
        }
        : null;
      const snapDragRect = this._activeSnapDragRect ? { ...this._activeSnapDragRect } : null;
      const stickerDraft = (this.isDrawingSticker && this.stickerDraftStart && this.stickerDraftCurr)
        ? {
          isBoard: Boolean(this.isGraphCovered && !this.pdfPageBoardData),
          x1: r3(this.stickerDraftStart.x),
          y1: r3(this.stickerDraftStart.y),
          x2: r3(this.stickerDraftCurr.x),
          y2: r3(this.stickerDraftCurr.y)
        }
        : null;
      const cardStickerDraft = this._activeCardStickerDraft ? { ...this._activeCardStickerDraft } : null;
      const pillRemoteEl = document.getElementById('quickPillRemote');
      const pillRemoteOpen = Boolean(this.isQuickPillRemoteOpen || (pillRemoteEl && pillRemoteEl.style.display !== 'none'));
      const pillModSig = this.pillModules
        ? `${Boolean(this.pillModules.tools)}|${Boolean(this.pillModules.zoom)}|${Boolean(this.pillModules.color)}|${Boolean(this.pillModules.extra)}`
        : '';
      const needPillRect = Boolean(
        pillRemoteEl &&
        pillRemoteOpen &&
        typeof pillRemoteEl.getBoundingClientRect === 'function' &&
        (!this._lastKnownPillRemoteSize || this._lastPillRemoteModSig !== pillModSig || !pillRemoteEl.style.left || !pillRemoteEl.style.top)
      );
      const pillRect = needPillRect ? pillRemoteEl.getBoundingClientRect() : null;
      if (pillRect && pillRect.width > 20 && pillRect.height > 20) {
        this._lastKnownPillRemoteSize = { w: pillRect.width, h: pillRect.height };
        this._lastPillRemoteModSig = pillModSig;
      }
      const pillVw = window.innerWidth || this.screenWidth || 1440;
      const pillVh = window.innerHeight || this.screenHeight || 900;
      const pillRemW = (pillRect && pillRect.width > 20)
        ? pillRect.width
        : ((this._lastKnownPillRemoteSize && this._lastKnownPillRemoteSize.w) || 112);
      const pillRemH = (pillRect && pillRect.height > 20)
        ? pillRect.height
        : ((this._lastKnownPillRemoteSize && this._lastKnownPillRemoteSize.h) || 260);
      const pillRawL = pillRemoteEl
        ? (parseFloat(pillRemoteEl.style.left) || (pillRect && pillRect.left > 0 ? pillRect.left : 605))
        : 605;
      const pillRawT = pillRemoteEl
        ? (parseFloat(pillRemoteEl.style.top) || (pillRect && pillRect.top > 0 ? pillRect.top : 76))
        : 76;
      const pillAvailW = Math.max(100, pillVw - 68 - pillRemW);
      const pillAvailH = Math.max(100, pillVh - pillRemH);
      const pillRemoteNormX = r3(Math.max(0, Math.min(1, (pillRawL - 64) / pillAvailW)));
      const pillRemoteNormY = r3(Math.max(0, Math.min(1, pillRawT / pillAvailH)));
      const pillRemoteRightGap = Math.round(Math.max(8, pillVw - (pillRawL + pillRemW)));
      const pillRemoteModules = this.pillModules ? { ...this.pillModules } : null;
      const stageW = Math.round(this.screenWidth || window.innerWidth || 1440);
      const stageH = Math.round(this.screenHeight || window.innerHeight || 900);
      const graphCardAspectVal = r3(this.graphCardAspect || 0.82);
      const graphCardPipSnap = (this._hasPrimaryGraphCard && this.graphCardData)
        ? this._extractCompactPipSnapForAudio('primary', graphW, graphCardAspectVal)
        : null;
      return {
        stageW,
        stageH,
        isGraphCovered: Boolean(this.isGraphCovered),
        drawerOpen,
        activeDrawerPanel: this.activeDrawerPanel || '',
        activePresetCat,
        inkMode: Boolean(this.isInkMode),
        inkBarHidden: Boolean(this.isBottomInkBarHidden),
        inkDockPos: this.inkDockPosition || 'bottom',
        activeInkTool: this.activeInkTool || 'pen',
        currentInkColor: this.currentInkColor || '#00d2d3',
        pillRemoteOpen,
        pillRemoteLeft: Math.round(pillRawL),
        pillRemoteTop: Math.round(pillRawT),
        pillRemoteNormX,
        pillRemoteNormY,
        pillRemoteRightGap,
        pillRemoteModules,
        isGraphSnapMode: Boolean(this.isGraphSnapMode),
        isPdfToGraphCropMode: Boolean(this.isPdfToGraphCropMode),
        isPdfCropChoiceMenuOpen,
        pwPopover,
        snapDragRect,
        stickerDraft,
        cardStickerDraft,
        graphs: clonedGraphs,
        activeGraphIdx: this.activeGraphIdx,
        isCurveSelected: Boolean(this.isCurveSelected),
        selectedHandleIdx: this.selectedHandleIdx,
        draggedHandleIdx: this.draggedHandleIdx,
        panX: r1(this.panX || 0),
        panY: r1(this.panY || 0),
        zoomLevel: r3(this.zoomLevel || 1.0),
        xSpan: r3(this.xSpan || 8.5),
        ySpan: r3(this.ySpan || 6.0),
        boardPanX: r1(this.boardPanX || 0),
        boardPanY: r1(this.boardPanY || 0),
        boardZoom: r3(this.boardZoom || 1.0),
        boardZoomOffsetX: r1(this.boardZoomOffsetX || 0),
        boardZoomOffsetY: r1(this.boardZoomOffsetY || 0),
        showAxes: Boolean(this.showAxes),
        showXAxis: this.showXAxis !== false,
        showYAxis: this.showYAxis !== false,
        showGuides: Boolean(this.showGuides),
        usePiecewise: Boolean(this.usePiecewise),
        piecewiseBoundaries: (this.piecewiseBoundaries || []).map(v => r4(v)),
        piecewiseFuncMap: cloneArr(this.piecewiseFuncMap),
        piecewiseInclusions: cloneArr(this.piecewiseInclusions),
        isPiecewisePeriodic: Boolean(this.isPiecewisePeriodic),
        periodicStepY: typeof this.periodicStepY === 'number' ? r3(this.periodicStepY) : 0,
        isPiecewiseLocked: Boolean(this.isPiecewiseLocked),
        isDropLineMode: Boolean(this.isDropLineMode),
        dropLineHoverCandidate: this.dropLineHoverCandidate ? JSON.parse(JSON.stringify(this.dropLineHoverCandidate)) : null,
        dropLines: cloneArr(this.dropLines),
        textLabels: cloneArr(this.textLabels),
        probCardVisible: Boolean(pWidget && pWidget.style.display !== 'none' && this.problemCardData),
        probCardMin: Boolean(this.isProblemCardMinimized),
        probCardInkActive: Boolean(pWidget && pWidget.classList.contains('card-ink-active')),
        probCardLocked: Boolean(pWidget && pWidget.classList.contains('pip-locked-mode')),
        probCardStealth: Boolean(pWidget && pWidget.classList.contains('pip-stealth-locked')),
        probCardBaseX: typeof this.problemCardBaseX === 'number' ? r1(this.problemCardBaseX) : this.problemCardBaseX,
        probCardBaseY: typeof this.problemCardBaseY === 'number' ? r1(this.problemCardBaseY) : this.problemCardBaseY,
        probCardPdfAnchor: (pWidget && pWidget._pdfAnchor || this.problemCardPdfAnchor) ? { ...(pWidget && pWidget._pdfAnchor || this.problemCardPdfAnchor) } : null,
        probCardW: r1(probW),
        graphCardVisible: Boolean(gWidget && gWidget.style.display !== 'none' && this._hasPrimaryGraphCard && this.graphCardData),
        graphCardMin: Boolean(this.isGraphCardMinimized),
        graphCardBaseX: typeof this.graphCardBaseX === 'number' ? r1(this.graphCardBaseX) : this.graphCardBaseX,
        graphCardBaseY: typeof this.graphCardBaseY === 'number' ? r1(this.graphCardBaseY) : this.graphCardBaseY,
        graphCardPdfAnchor: (gWidget && gWidget._pdfAnchor || this.graphCardPdfAnchor) ? { ...(gWidget && gWidget._pdfAnchor || this.graphCardPdfAnchor) } : null,
        graphCardW: r1(graphW),
        graphCardAspect: graphCardAspectVal,
        graphCardInkActive: Boolean(gWidget && gWidget.classList.contains('card-ink-active')),
        graphCardStealth: Boolean(gWidget && gWidget.classList.contains('pip-stealth-locked')),
        graphCardPipSnap,
        extraGraphsCount: (this.extraGraphCards || []).length,
        extraGraphStates,
        extraProbsCount: (this.extraProblemCards || []).length,
        extraProbStates,
        boardStickers: cloneArr(this.boardStickers),
        problemCardStickers: cloneArr(this.problemCardStickers),
        graphCardStickers: cloneArr(this.graphCardStickers)
      };
    }

    _applyAudioWorkspaceKeyframe(kf) {
      if (!kf) return;
      this._currentAppliedAudioKeyframe = kf;
      this._isApplyingAudioTimelineState = true;
      try {
        const modeChanged = (Boolean(this.isGraphCovered) !== Boolean(kf.isGraphCovered));
        this.isGraphCovered = Boolean(kf.isGraphCovered);
        // 🌟 [페이지 모드 ↔ 실시간 그래프 모드 전환 리플레이 완벽 동기화]:
        // 그래프 모드(!isGraphCovered) 구간에서는 PDF 보드 데이터를 일시 보관(_suspendedPdfBoardState)하여 좌표평면과 그래프 필기만 깔끔하게 표시하고,
        // 판서 모드(isGraphCovered) 복귀 구간에서는 PDF 보드 데이터를 즉시 복원하여 PDF 페이지와 페이지 위 판서를 정확히 렌더링!
        if (!this.isGraphCovered && this.pdfPageBoardData) {
          this._suspendedPdfBoardState = {
            ...(this._suspendedPdfBoardState || {}),
            pdfPageBoardData: this.pdfPageBoardData
          };
          this.pdfPageBoardData = null;
          this._inkBakeDirty = true;
        } else if (this.isGraphCovered && !this.pdfPageBoardData && this._suspendedPdfBoardState && this._suspendedPdfBoardState.pdfPageBoardData) {
          this.pdfPageBoardData = this._suspendedPdfBoardState.pdfPageBoardData;
          this._inkBakeDirty = true;
        }
        this.graphs = JSON.parse(JSON.stringify(kf.graphs || []));
        if (this.engine && typeof this.engine.ensureCompiledFunctions === 'function') {
          this.engine.ensureCompiledFunctions(this.graphs);
        }
        if (kf.showInverseGuide !== undefined) {
          this.showInverseGuide = Boolean(kf.showInverseGuide);
        }
        this.activeGraphIdx = typeof kf.activeGraphIdx === 'number' ? kf.activeGraphIdx : (this.graphs.length > 0 ? 0 : -1);
        if (kf.isCurveSelected !== undefined) this.isCurveSelected = Boolean(kf.isCurveSelected);
        if (kf.selectedHandleIdx !== undefined) this.selectedHandleIdx = kf.selectedHandleIdx;
        if (kf.draggedHandleIdx !== undefined) this.draggedHandleIdx = kf.draggedHandleIdx;
        this.panX = kf.panX || 0;
        this.panY = kf.panY || 0;
        this.zoomLevel = kf.zoomLevel || 1.0;
        this.targetZoom = this.zoomLevel;
        this.xSpan = kf.xSpan || 8.5;
        this.ySpan = kf.ySpan || 6.0;
        this.boardPanX = kf.boardPanX || 0;
        this.boardPanY = kf.boardPanY || 0;
        this.boardZoom = kf.boardZoom || 1.0;
        this.boardZoomOffsetX = kf.boardZoomOffsetX || 0;
        this.boardZoomOffsetY = kf.boardZoomOffsetY || 0;
        this.showAxes = Boolean(kf.showAxes);
        if (kf.showXAxis !== undefined) this.showXAxis = Boolean(kf.showXAxis);
        if (kf.showYAxis !== undefined) this.showYAxis = Boolean(kf.showYAxis);
        this.showGuides = Boolean(kf.showGuides);
        this.usePiecewise = Boolean(kf.usePiecewise);
        this.piecewiseBoundaries = JSON.parse(JSON.stringify(kf.piecewiseBoundaries || []));
        this.piecewiseFuncMap = JSON.parse(JSON.stringify(kf.piecewiseFuncMap || []));
        this.piecewiseInclusions = JSON.parse(JSON.stringify(kf.piecewiseInclusions || []));
        if (kf.isPiecewisePeriodic !== undefined) this.isPiecewisePeriodic = Boolean(kf.isPiecewisePeriodic);
        if (typeof kf.periodicStepY === 'number') this.periodicStepY = kf.periodicStepY;
        if (kf.isPiecewiseLocked !== undefined) this.isPiecewiseLocked = Boolean(kf.isPiecewiseLocked);
        if (kf.isDropLineMode !== undefined) this.isDropLineMode = Boolean(kf.isDropLineMode);
        this.dropLineHoverCandidate = kf.dropLineHoverCandidate ? JSON.parse(JSON.stringify(kf.dropLineHoverCandidate)) : null;
        this.dropLines = JSON.parse(JSON.stringify(kf.dropLines || []));
        this.textLabels = JSON.parse(JSON.stringify(kf.textLabels || []));
        if (Array.isArray(kf.boardStickers)) {
          this.boardStickers = JSON.parse(JSON.stringify(kf.boardStickers));
        }
        if (Array.isArray(kf.problemCardStickers)) {
          this.problemCardStickers = JSON.parse(JSON.stringify(kf.problemCardStickers));
          const pW = document.getElementById('problemCardWidget');
          if (pW && typeof pW._renderCardStickers === 'function') pW._renderCardStickers();
        }
        if (Array.isArray(kf.graphCardStickers)) {
          this.graphCardStickers = JSON.parse(JSON.stringify(kf.graphCardStickers));
          const gW = document.getElementById('graphCardWidget');
          if (gW && typeof gW._renderCardStickers === 'function') gW._renderCardStickers();
        }

        const pWidget = document.getElementById('problemCardWidget');
        if (pWidget && this.problemCardData) {
          pWidget.style.display = kf.probCardVisible ? 'flex' : 'none';
          pWidget.classList.toggle('minimized', Boolean(kf.probCardMin));
          this.isProblemCardMinimized = Boolean(kf.probCardMin);
          if (kf.probCardInkActive !== undefined) {
            const pInkOn = Boolean(kf.probCardInkActive);
            pWidget.classList.toggle('card-ink-active', pInkOn);
            const btnPInk = pWidget.querySelector('.btn-card-laser');
            if (btnPInk) btnPInk.classList.toggle('active', pInkOn);
          }
          if (kf.probCardLocked !== undefined) {
            pWidget.classList.toggle('pip-locked-mode', Boolean(kf.probCardLocked));
            if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(pWidget);
          }
          if (kf.probCardStealth !== undefined) {
            if (typeof this.clearProblemCardStealthTimer === 'function') this.clearProblemCardStealthTimer(pWidget);
            pWidget.classList.toggle('pip-stealth-locked', Boolean(kf.probCardStealth));
          }
          if (kf.probCardPdfAnchor) {
            this.problemCardPdfAnchor = { ...kf.probCardPdfAnchor };
            pWidget._pdfAnchor = { ...kf.probCardPdfAnchor };
          }
          if (typeof kf.probCardBaseX === 'number') {
            this.problemCardBaseX = kf.probCardBaseX;
            pWidget.style.left = `${Math.round(kf.probCardBaseX)}px`;
          }
          if (typeof kf.probCardBaseY === 'number') {
            this.problemCardBaseY = kf.probCardBaseY;
            pWidget.style.top = `${Math.round(kf.probCardBaseY)}px`;
          }
          if (typeof kf.probCardW === 'number' && kf.probCardW >= 200 && !kf.probCardMin) {
            pWidget.style.width = `${Math.round(kf.probCardW)}px`;
            this.syncProblemCardRectFromWidget();
          }
        }

        const gWidget = document.getElementById('graphCardWidget');
        if (gWidget) {
          if (kf.graphCardVisible) {
            this._hasPrimaryGraphCard = true;
            if (!this.graphCardData) {
              this.graphCardData = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            }
          }
          if (this._hasPrimaryGraphCard && this.graphCardData) {
            gWidget.style.display = (kf.graphCardVisible && this.isGraphCovered) ? 'flex' : 'none';
            gWidget.classList.toggle('minimized', Boolean(kf.graphCardMin));
            this.isGraphCardMinimized = Boolean(kf.graphCardMin);
            if (kf.graphCardInkActive !== undefined) {
              const inkOn = Boolean(kf.graphCardInkActive);
              gWidget.classList.toggle('card-ink-active', inkOn);
              const btnInk = gWidget.querySelector('.btn-card-ink');
              if (btnInk) btnInk.classList.toggle('active', inkOn);
            }
            if (kf.graphCardPdfAnchor) {
              this.graphCardPdfAnchor = { ...kf.graphCardPdfAnchor };
              gWidget._pdfAnchor = { ...kf.graphCardPdfAnchor };
            }
            if (typeof kf.graphCardBaseX === 'number') {
              this.graphCardBaseX = kf.graphCardBaseX;
              gWidget.style.left = `${Math.round(kf.graphCardBaseX)}px`;
            }
            if (typeof kf.graphCardBaseY === 'number') {
              this.graphCardBaseY = kf.graphCardBaseY;
              gWidget.style.top = `${Math.round(kf.graphCardBaseY)}px`;
            }
            if (typeof kf.graphCardAspect === 'number' && kf.graphCardAspect > 0.1) {
              this.graphCardAspect = kf.graphCardAspect;
            }
            const targetCardW = (typeof kf.graphCardW === 'number' && kf.graphCardW >= 140)
              ? Math.round(kf.graphCardW)
              : (parseFloat(gWidget.style.width) || gWidget.offsetWidth || 360);
            if (!kf.graphCardMin) {
              gWidget.style.width = `${targetCardW}px`;
            }
            if (kf.graphCardPipSnap && typeof kf.graphCardPipSnap === 'object') {
              const clonedPipSnap = JSON.parse(JSON.stringify(kf.graphCardPipSnap));
              if (typeof clonedPipSnap.aspect === 'number' && clonedPipSnap.aspect > 0.1) {
                this.graphCardAspect = clonedPipSnap.aspect;
              }
              const effAspect = this.graphCardAspect || 0.82;
              const targetCardH = Math.max(120, Math.round(targetCardW * effAspect));
              clonedPipSnap._isPipCardSnapshot = true;
              clonedPipSnap._pipCardW = targetCardW;
              clonedPipSnap._pipCardH = targetCardH;
              this._savePipCardSnapshot('primary', clonedPipSnap);
              const bodyEl = document.getElementById('graphCardBody') || gWidget.querySelector('.problem-card-body');
              if (bodyEl && !kf.graphCardMin) {
                bodyEl.style.height = `${targetCardH}px`;
              }
              if (typeof this._reprojectPipCardInkFromMathCoords === 'function') {
                this._reprojectPipCardInkFromMathCoords('primary', targetCardW, targetCardH);
              }
            }
            if (typeof this.syncGraphCardRectFromWidget === 'function' && !kf.graphCardMin) {
              this.syncGraphCardRectFromWidget();
            }
            if (kf.graphCardStealth !== undefined) {
              this.clearPipGraphCardStealthTimer('primary');
              gWidget.classList.toggle('pip-stealth-locked', Boolean(kf.graphCardStealth));
            }
          } else {
            gWidget.style.display = 'none';
          }
        }

        const targetExtraGraphCount = typeof kf.extraGraphsCount === 'number'
          ? kf.extraGraphsCount
          : (Array.isArray(kf.extraGraphStates) ? kf.extraGraphStates.length : 0);
        if (targetExtraGraphCount > (this.extraGraphCards ? this.extraGraphCards.length : 0) && Array.isArray(kf.extraGraphStates)) {
          if (!this.extraGraphCards) this.extraGraphCards = [];
          for (let idx = this.extraGraphCards.length; idx < targetExtraGraphCount; idx++) {
            const st = kf.extraGraphStates[idx];
            if (!st || typeof this.spawnExtraGraphArchiveCard !== 'function') break;
            this.spawnExtraGraphArchiveCard(
              'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
              typeof st.w === 'number' ? st.w : 360,
              typeof st.aspect === 'number' ? st.aspect : 0.82,
              st.pipSnap ? JSON.parse(JSON.stringify(st.pipSnap)) : null,
              null,
              {
                directBasePos: {
                  x: typeof st.baseX === 'number' ? st.baseX : 560,
                  y: typeof st.baseY === 'number' ? st.baseY : 68
                }
              }
            );
          }
        }

        if (this.extraGraphCards && this.extraGraphCards.length > 0) {
          const visibleCount = typeof kf.extraGraphsCount === 'number' ? kf.extraGraphsCount : this.extraGraphCards.length;
          this.extraGraphCards.forEach((c, idx) => {
            if (c && c.el) {
              c.el.style.display = (!this.isGraphCovered || idx >= visibleCount) ? 'none' : 'flex';
              const st = Array.isArray(kf.extraGraphStates) ? kf.extraGraphStates[idx] : null;
              if (st) {
                if (st.pdfAnchor) {
                  c.pdfAnchor = { ...st.pdfAnchor };
                  c.el._pdfAnchor = { ...st.pdfAnchor };
                }
                if (typeof st.baseX === 'number') {
                  c.baseX = st.baseX;
                  c.el.style.left = `${Math.round(st.baseX)}px`;
                }
                if (typeof st.baseY === 'number') {
                  c.baseY = st.baseY;
                  c.el.style.top = `${Math.round(st.baseY)}px`;
                }
                if (st.inkActive !== undefined) {
                  const inkOn = Boolean(st.inkActive);
                  c.el.classList.toggle('card-ink-active', inkOn);
                  const btnInk = c.el.querySelector('.btn-card-ink');
                  if (btnInk) btnInk.classList.toggle('active', inkOn);
                }
                if (typeof st.aspect === 'number' && st.aspect > 0.1) {
                  c.aspect = st.aspect;
                }
                const cw = (typeof st.w === 'number' && st.w >= 140)
                  ? Math.round(st.w)
                  : (parseFloat(c.el.style.width) || c.el.offsetWidth || 360);
                if (!st.min) {
                  c.el.style.width = `${cw}px`;
                }
                if (st.pipSnap && typeof st.pipSnap === 'object') {
                  const clonedExtraSnap = JSON.parse(JSON.stringify(st.pipSnap));
                  if (typeof clonedExtraSnap.aspect === 'number' && clonedExtraSnap.aspect > 0.1) {
                    c.aspect = clonedExtraSnap.aspect;
                  }
                  const effAspect = c.aspect || 0.82;
                  const ch = Math.max(120, Math.round(cw * effAspect));
                  clonedExtraSnap._isPipCardSnapshot = true;
                  clonedExtraSnap._pipCardW = cw;
                  clonedExtraSnap._pipCardH = ch;
                  this._savePipCardSnapshot(c, clonedExtraSnap);
                  const bodyEl = c.el.querySelector('.problem-card-body');
                  if (bodyEl && !st.min) {
                    bodyEl.style.height = `${ch}px`;
                  }
                  if (typeof this._reprojectPipCardInkFromMathCoords === 'function') {
                    this._reprojectPipCardInkFromMathCoords(c, cw, ch);
                  }
                }
                if (!st.min) {
                  if (typeof this.renderPipGraphCard === 'function') this.renderPipGraphCard(c);
                  if (typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
                }
                if (st.stealth !== undefined) {
                  this.clearPipGraphCardStealthTimer(c);
                  c.el.classList.toggle('pip-stealth-locked', Boolean(st.stealth));
                }
                c.isMin = Boolean(st.min);
                c.el.classList.toggle('minimized', Boolean(st.min));
              }
            }
          });
        }

        if (this.extraProblemCards && this.extraProblemCards.length > 0) {
          const visibleProbCount = typeof kf.extraProbsCount === 'number'
            ? kf.extraProbsCount
            : (Array.isArray(kf.extraProbStates) ? kf.extraProbStates.length : this.extraProblemCards.length);
          this.extraProblemCards.forEach((c, idx) => {
            if (!c || !c.el) return;
            c.el.style.display = (!this.isGraphCovered || idx >= visibleProbCount) ? 'none' : 'flex';
            const st = Array.isArray(kf.extraProbStates) ? kf.extraProbStates[idx] : null;
            if (st) {
              if (st.pdfAnchor) {
                c.pdfAnchor = { ...st.pdfAnchor };
                c.el._pdfAnchor = { ...st.pdfAnchor };
              }
              if (typeof st.baseX === 'number') {
                c.baseX = st.baseX;
                c.el.style.left = `${Math.round(st.baseX)}px`;
              }
              if (typeof st.baseY === 'number') {
                c.baseY = st.baseY;
                c.el.style.top = `${Math.round(st.baseY)}px`;
              }
              if (typeof st.w === 'number' && st.w >= 180 && !st.min) {
                c.el.style.width = `${Math.round(st.w)}px`;
                if (typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
              }
              if (st.inkActive !== undefined) {
                const eInkOn = Boolean(st.inkActive);
                c.el.classList.toggle('card-ink-active', eInkOn);
                const btnEInk = c.el.querySelector('.btn-card-laser');
                if (btnEInk) btnEInk.classList.toggle('active', eInkOn);
              }
              if (st.locked !== undefined) {
                c.el.classList.toggle('pip-locked-mode', Boolean(st.locked));
                if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(c.el);
              }
              if (st.stealth !== undefined) {
                if (typeof this.clearProblemCardStealthTimer === 'function') this.clearProblemCardStealthTimer(c.el);
                c.el.classList.toggle('pip-stealth-locked', Boolean(st.stealth));
              }
              c.isMin = Boolean(st.min);
              c.el.classList.toggle('minimized', Boolean(st.min));
            }
          });
        }

        // 🌟 [상시 노출 UI & 서랍/도구/리모컨/팝오버/컨텍스트바 상태 100% 완벽 동기화]
        if (kf.inkDockPos && ['left', 'bottom', 'right'].includes(kf.inkDockPos)) {
          const inkToolbarEl = document.getElementById('inkFloatingToolbar');
          if (inkToolbarEl && inkToolbarEl.dataset.dockPos !== kf.inkDockPos) {
            inkToolbarEl.dataset.dockPos = kf.inkDockPos;
          }
        }
        if (kf.inkMode !== undefined) {
          this.isInkMode = Boolean(kf.inkMode);
          let effInkBarHidden = Boolean(this.isBottomInkBarHidden);
          if (kf.inkBarHidden !== undefined) {
            effInkBarHidden = Boolean(kf.inkBarHidden);
            this.isBottomInkBarHidden = effInkBarHidden;
          } else if (this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode) {
            const hasInkBarInteraction = Boolean(
              this.audioSyncData &&
              Array.isArray(this.audioSyncData.timeline) &&
              this.audioSyncData.timeline.some(ev => ev && ev.uiBarId === 'inkFloatingToolbar')
            );
            if (!hasInkBarInteraction || kf.pillRemoteOpen) {
              effInkBarHidden = true;
            }
          }
          document.body.classList.toggle('ink-mode-active', this.isInkMode);
          const effPillOpen = (kf.pillRemoteOpen !== undefined)
            ? Boolean(kf.pillRemoteOpen)
            : Boolean(this.isQuickPillRemoteOpen);
          const inkToolbarEl = document.getElementById('inkFloatingToolbar');
          if (inkToolbarEl) {
            inkToolbarEl.style.display = (this.isInkMode && !effInkBarHidden && !effPillOpen) ? 'flex' : 'none';
          }
          const btnHeader = document.getElementById('btnInkMode');
          if (btnHeader) btnHeader.classList.toggle('active', Boolean(this.isInkMode && (!effInkBarHidden || effPillOpen)));
          const btnQuick = document.getElementById('btnQuickInk');
          if (btnQuick) btnQuick.classList.toggle('active', this.isInkMode);
        }
        if (kf.pillRemoteModules && this.pillModules) {
          this.pillModules = { ...this.pillModules, ...kf.pillRemoteModules };
        }
        if (typeof this.syncQuickPillRemoteUI === 'function') {
          this.syncQuickPillRemoteUI();
        }
        if (kf.pillRemoteOpen !== undefined) {
          this.isQuickPillRemoteOpen = Boolean(kf.pillRemoteOpen);
          if (this.isQuickPillRemoteOpen) {
            this.preferredInkUiMode = 'pill';
            this.isBottomInkBarHidden = true;
          } else if (kf.inkBarHidden === false) {
            this.preferredInkUiMode = 'bar';
          }
          const pillRemoteEl = document.getElementById('quickPillRemote');
          if (pillRemoteEl) {
            pillRemoteEl.style.display = (this.isInkMode !== false && this.isQuickPillRemoteOpen) ? 'flex' : 'none';
            const isFixedStage = typeof this._isFixedReplayStageActive === 'function' && this._isFixedReplayStageActive();
            const vw = isFixedStage
              ? (this.screenWidth || 1440)
              : (window.innerWidth || this.screenWidth || 1440);
            const vh = isFixedStage
              ? (this.screenHeight || 900)
              : (window.innerHeight || this.screenHeight || 900);
            const pRect = this.isQuickPillRemoteOpen
              ? (typeof this._getStageElementRect === 'function' ? this._getStageElementRect(pillRemoteEl) : pillRemoteEl.getBoundingClientRect())
              : null;
            const remW = (pRect && pRect.width > 20)
              ? pRect.width
              : ((this._lastKnownPillRemoteSize && this._lastKnownPillRemoteSize.w) || 112);
            const remH = (pRect && pRect.height > 20)
              ? pRect.height
              : ((this._lastKnownPillRemoteSize && this._lastKnownPillRemoteSize.h) || 260);
            let targetL = typeof kf.pillRemoteLeft === 'number' ? kf.pillRemoteLeft : 605;
            let targetT = typeof kf.pillRemoteTop === 'number' ? kf.pillRemoteTop : 76;

            if (!isFixedStage) {
              if (typeof kf.pillRemoteNormX === 'number') {
                if (kf.pillRemoteNormX >= 0.72 && typeof kf.pillRemoteRightGap === 'number') {
                  targetL = vw - remW - kf.pillRemoteRightGap;
                } else if (kf.pillRemoteNormX <= 0.18 && typeof kf.pillRemoteLeft === 'number') {
                  targetL = kf.pillRemoteLeft;
                } else {
                  const availW = Math.max(100, vw - 68 - remW);
                  targetL = 64 + kf.pillRemoteNormX * availW;
                }
              }
              if (typeof kf.pillRemoteNormY === 'number') {
                const availH = Math.max(100, vh - remH);
                targetT = kf.pillRemoteNormY * availH;
              }
            }
            targetL = Math.max(64, Math.min(vw - remW - 8, targetL));
            targetT = Math.max(12, Math.min(vh - remH - 12, targetT));
            pillRemoteEl.style.left = `${Math.round(targetL)}px`;
            pillRemoteEl.style.top = `${Math.round(targetT)}px`;
          }
          const btnRailRemote = document.getElementById('btnRailQuickRemote');
          if (btnRailRemote) btnRailRemote.classList.toggle('active', this.isQuickPillRemoteOpen);
        }
        if (kf.activeInkTool) {
          this.activeInkTool = kf.activeInkTool;
          const toolToIdMap = {
            select: 'btnInkSelect',
            pen: 'btnInkPen',
            highlighter: 'btnInkHighlighter',
            eraser: 'btnInkEraser',
            lasso: 'btnInkLasso',
            laser: 'btnInkLaser',
            sticker: 'btnInkSticker'
          };
          Object.keys(toolToIdMap).forEach(tKey => {
            const b = document.getElementById(toolToIdMap[tKey]);
            if (b) b.classList.toggle('active', tKey === kf.activeInkTool);
          });
        }
        if (kf.currentInkColor) {
          this.currentInkColor = kf.currentInkColor;
          document.querySelectorAll('#inkFloatingToolbar .ink-color-dot[data-color]').forEach(dot => {
            dot.classList.toggle('active', (dot.dataset.color || '').toLowerCase() === String(kf.currentInkColor).toLowerCase());
          });
        }
        if (kf.isGraphSnapMode !== undefined) {
          this.isGraphSnapMode = Boolean(kf.isGraphSnapMode);
        }
        if (kf.isPdfToGraphCropMode !== undefined) {
          this.isPdfToGraphCropMode = Boolean(kf.isPdfToGraphCropMode);
        }
        if (kf.isPdfCropChoiceMenuOpen !== undefined) {
          this._isPdfCropChoiceMenuOpen = Boolean(kf.isPdfCropChoiceMenuOpen);
        }

        const sidebarRailEl = document.getElementById('sidebarRail');
        const railDrawerEl = document.getElementById('railDrawer');
        if (kf.drawerOpen !== undefined) {
          const isOpen = Boolean(kf.drawerOpen);
          this.isDrawerCollapsed = !isOpen;
          if (sidebarRailEl) {
            sidebarRailEl.classList.toggle('drawer-collapsed', !isOpen);
          }
          if (railDrawerEl) {
            railDrawerEl.classList.toggle('open', isOpen);
          }
          const iconToggle = document.getElementById('iconToggleDrawer');
          if (iconToggle) iconToggle.textContent = isOpen ? '◀' : '▶';
          const activePanelId = kf.activeDrawerPanel || this.activeDrawerPanel || 'panelPresets';
          if (kf.activeDrawerPanel) this.activeDrawerPanel = kf.activeDrawerPanel;
          const panelTitles = {
            panelPresets: '그래프 추가',
            panelTransform: '변환 & 대칭',
            panelPiecewise: '구간 분할',
            panelViewfinder: '캡처 규격',
            panelSettings: '환경 설정',
            panelStyle: '스타일 & 배경'
          };
          const titleLbl = document.getElementById('drawerTitle');
          if (titleLbl) {
            titleLbl.textContent = panelTitles[activePanelId] || '설정';
          }
          document.querySelectorAll('#sidebarRail .rail-btn[data-panel]').forEach(btn => {
            btn.classList.toggle('active', isOpen && btn.dataset.panel === activePanelId);
          });
          document.querySelectorAll('#railDrawer .drawer-panel').forEach(panel => {
            const isMatch = (panel.id === activePanelId);
            panel.classList.toggle('active', isMatch);
            panel.style.display = isMatch ? 'flex' : 'none';
          });
          if (kf.activePresetCat) {
            const curCatBtn = document.querySelector('#railDrawer .cat-tab-btn.active');
            const curCat = (curCatBtn && curCatBtn.dataset) ? curCatBtn.dataset.cat : '';
            if (curCat !== kf.activePresetCat || this._currentCat !== kf.activePresetCat) {
              this._currentCat = kf.activePresetCat;
              document.querySelectorAll('#railDrawer .cat-tab-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.cat === kf.activePresetCat);
              });
              if (typeof this.renderFuncList === 'function') {
                this.renderFuncList();
              }
            }
          }
        }

        const pwPopoverEl = document.getElementById('pwRegionPopover');
        if (pwPopoverEl) {
          if (kf.pwPopover && typeof kf.pwPopover.regionIdx === 'number') {
            this.openRegionFuncMenu(kf.pwPopover.regionIdx, kf.pwPopover.left || 100, kf.pwPopover.top || 100, true);
          } else {
            pwPopoverEl.style.display = 'none';
            this._openPwRegionIdx = null;
          }
        }

        // 🌟 [캡처 사각형 드래그(#graphSnapDragBox) 60fps 실시간 재현]
        const dragBox = document.getElementById('graphSnapDragBox');
        if (dragBox) {
          const sr = kf.snapDragRect;
          if (sr && (typeof sr.x1 === 'number' || typeof sr.nx1 === 'number' || typeof sr.mx1 === 'number')) {
            let sx1, sy1, sx2, sy2;
            if (typeof sr.x1 === 'number' && typeof sr.y1 === 'number' && typeof sr.x2 === 'number' && typeof sr.y2 === 'number') {
              sx1 = sr.x1;
              sy1 = sr.y1;
              sx2 = sr.x2;
              sy2 = sr.y2;
            } else if (typeof sr.mx1 === 'number' && typeof sr.my1 === 'number' && typeof sr.mx2 === 'number' && typeof sr.my2 === 'number' && (!this.isGraphCovered || this.pdfPageBoardData)) {
              const p1 = this.mathToScreen(sr.mx1, sr.my1);
              const p2 = this.mathToScreen(sr.mx2, sr.my2);
              sx1 = p1.x;
              sy1 = p1.y;
              sx2 = p2.x;
              sy2 = p2.y;
            } else {
              const vw = Math.max(1, this.screenWidth || window.innerWidth || 1280);
              const vh = Math.max(1, this.screenHeight || window.innerHeight || 720);
              sx1 = (sr.nx1 || 0) * vw;
              sy1 = (sr.ny1 || 0) * vh;
              sx2 = (sr.nx2 || 0) * vw;
              sy2 = (sr.ny2 || 0) * vh;
            }
            const left = Math.min(sx1, sx2);
            const top = Math.min(sy1, sy2);
            const width = Math.max(2, Math.abs(sx2 - sx1));
            const height = Math.max(2, Math.abs(sy2 - sy1));
            dragBox.style.display = 'block';
            dragBox.style.left = `${Math.round(left * 10) / 10}px`;
            dragBox.style.top = `${Math.round(top * 10) / 10}px`;
            dragBox.style.width = `${Math.round(width * 10) / 10}px`;
            dragBox.style.height = `${Math.round(height * 10) / 10}px`;
            if (sr.isPdfCrop) {
              dragBox.style.borderColor = '#7c3aed';
              dragBox.style.background = 'rgba(124, 58, 237, 0.12)';
            } else {
              dragBox.style.borderColor = '#2563eb';
              dragBox.style.background = 'rgba(37, 99, 235, 0.10)';
            }
          } else if (this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode) {
            dragBox.style.display = 'none';
          }
        }

        // 🌟 [카드 내부 블라인드 스티커 드래그 프리뷰 박스 재현]
        const csd = kf.cardStickerDraft;
        ['problem_main', 'graph_main'].forEach(cKey => {
          const cEl = this.getCardElementByAudioKey(cKey);
          const bodyEl = cEl ? cEl.querySelector('.problem-card-body') : null;
          if (!bodyEl) return;
          let draftEl = bodyEl.querySelector('.replay-card-sticker-draft');
          if (csd && csd.cardKey === cKey && typeof csd.nw === 'number' && csd.nw > 0.005) {
            if (!draftEl) {
              draftEl = document.createElement('div');
              draftEl.className = 'replay-card-sticker-draft';
              draftEl.style.cssText = 'position:absolute;border:2px dashed #f59e0b;background:rgba(254,243,199,0.55);border-radius:6px;pointer-events:none;z-index:28;';
              bodyEl.appendChild(draftEl);
            }
            draftEl.style.display = 'block';
            draftEl.style.left = `${(csd.nx * 100).toFixed(2)}%`;
            draftEl.style.top = `${(csd.ny * 100).toFixed(2)}%`;
            draftEl.style.width = `${(csd.nw * 100).toFixed(2)}%`;
            draftEl.style.height = `${(csd.nh * 100).toFixed(2)}%`;
          } else if (draftEl) {
            draftEl.style.display = 'none';
          }
        });

        // 🌟 [캔버스 블라인드 스티커 드래그 프리뷰 박스 재현]
        let canvasStickerDraftEl = document.getElementById('replayCanvasStickerDraftBox');
        if (kf.stickerDraft && typeof kf.stickerDraft.x1 === 'number') {
          const sd = kf.stickerDraft;
          const p1 = sd.isBoard ? this.boardToScreen(sd.x1, sd.y1) : this.mathToScreen(sd.x1, sd.y1);
          const p2 = sd.isBoard ? this.boardToScreen(sd.x2, sd.y2) : this.mathToScreen(sd.x2, sd.y2);
          if (!canvasStickerDraftEl) {
            canvasStickerDraftEl = document.createElement('div');
            canvasStickerDraftEl.id = 'replayCanvasStickerDraftBox';
            canvasStickerDraftEl.style.cssText = 'position:absolute;border:2px dashed #f59e0b;background:rgba(254,243,199,0.45);border-radius:6px;pointer-events:none;z-index:8400;';
            const stageDraftParent = (this.canvas && this.canvas.parentElement) || document.body;
            stageDraftParent.appendChild(canvasStickerDraftEl);
          }
          canvasStickerDraftEl.style.display = 'block';
          canvasStickerDraftEl.style.left = `${Math.round(Math.min(p1.x, p2.x))}px`;
          canvasStickerDraftEl.style.top = `${Math.round(Math.min(p1.y, p2.y))}px`;
          canvasStickerDraftEl.style.width = `${Math.max(2, Math.round(Math.abs(p2.x - p1.x)))}px`;
          canvasStickerDraftEl.style.height = `${Math.max(2, Math.round(Math.abs(p2.y - p1.y)))}px`;
        } else if (canvasStickerDraftEl) {
          canvasStickerDraftEl.style.display = 'none';
        }

        this.updateProblemCardPosition();
        this.syncWorkspaceModeUI();
        this.syncGraphSnapBarUI();
        this.isPointerDownOnCanvas = false;
        this.syncCurveContextBar();
        if (!this.isGraphCovered) {
          this.updateIntersections();
        }
      } finally {
        this._isApplyingAudioTimelineState = false;
      }
    }

    _recordAudioWorkspaceStateIfNeeded(force = false) {
      if (!this.isAudioRecording || this.isAudioRecordPaused || this.isPdfModalOpen || this._isAudioWaitingForNextSlideSetup || this._isApplyingAudioTimelineState) return;
      if (this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser) {
        this._lastAudioInkActivePerfMs = performance.now();
      }
      // 필기/레이저 드로잉 중에는 무거운 JSON.stringify 상태 스냅샷을 건너뛰어 녹화 중 필기 렉을 0%로 원천 차단!
      if (!force && (this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser)) return;
      const t = this.getAudioRecordElapsedMs();
      const sidebarRailEl = document.getElementById('sidebarRail');
      const curDrawerOpen = Boolean(!this.isDrawerCollapsed && (!sidebarRailEl || !sidebarRailEl.classList.contains('drawer-collapsed')));
      const uiDiscreteSig = `${Boolean(this.isGraphCovered)}|${curDrawerOpen}|${this.activeDrawerPanel || ''}|${this._currentCat || ''}|${Boolean(this.isInkMode)}|${Boolean(this.isBottomInkBarHidden)}|${this.inkDockPosition || 'bottom'}|${this.activeInkTool || ''}|${Boolean(this.isQuickPillRemoteOpen)}|${Boolean(this.isGraphSnapMode)}|${Boolean(this.isPdfToGraphCropMode)}|${Boolean(this._isPdfCropChoiceMenuOpen)}|${Boolean(this.isCurveSelected)}|${this._openPwRegionIdx ?? ''}`;
      const uiDiscreteChanged = (uiDiscreteSig !== this._lastRecordedUiDiscreteSig);

      const isActivelyDraggingGraph = Boolean(
        this.draggedHandleIdx !== null ||
        this.isDraggingCurve ||
        this.activePwDragIdx !== null ||
        this.isPanning ||
        this.isBoardPanning ||
        this._isZoomAnimating ||
        this._pinchState ||
        this.isGraphSnapDragging ||
        this.isPdfToGraphCropDragging ||
        this._isDraggingOrResizingAnyCard ||
        this._isInteractingWithPipCard ||
        this.isDrawingSticker ||
        Boolean(this._activeCardStickerDraft) ||
        this.isLassoSelecting
      );
      const dragStartedNow = Boolean(isActivelyDraggingGraph && !this._wasActivelyDraggingGraph);
      this._wasActivelyDraggingGraph = isActivelyDraggingGraph;
      const minInterval = isActivelyDraggingGraph ? 28 : 48;
      const lastCheckMs = (typeof this._lastAudioStateCheckMs === 'number') ? this._lastAudioStateCheckMs : this._lastAudioStateRecordMs;
      if (!force && !uiDiscreteChanged && !dragStartedNow && (t - lastCheckMs < minInterval)) return;
      this._lastAudioStateCheckMs = t;
      this._lastRecordedUiDiscreteSig = uiDiscreteSig;

      const kf = this._captureAudioWorkspaceKeyframe();
      const hash = JSON.stringify([
        kf.isGraphCovered,
        kf.drawerOpen,
        kf.activeDrawerPanel,
        kf.activePresetCat,
        kf.inkMode,
        kf.inkBarHidden,
        kf.inkDockPos,
        kf.activeInkTool,
        kf.currentInkColor,
        kf.pillRemoteOpen,
        kf.pillRemoteLeft,
        kf.pillRemoteTop,
        kf.pillRemoteNormX,
        kf.pillRemoteNormY,
        kf.pillRemoteRightGap,
        kf.pillRemoteModules,
        kf.isGraphSnapMode,
        kf.isPdfToGraphCropMode,
        kf.isPdfCropChoiceMenuOpen,
        kf.pwPopover,
        kf.snapDragRect,
        kf.stickerDraft,
        kf.cardStickerDraft,
        kf.graphs,
        kf.activeGraphIdx,
        kf.isCurveSelected,
        kf.selectedHandleIdx,
        kf.draggedHandleIdx,
        Math.round(kf.panX),
        Math.round(kf.panY),
        kf.zoomLevel,
        kf.xSpan,
        kf.ySpan,
        kf.showAxes,
        kf.showXAxis,
        kf.showYAxis,
        kf.showGuides,
        Math.round(kf.boardPanX),
        Math.round(kf.boardPanY),
        kf.boardZoom,
        Math.round(kf.boardZoomOffsetX || 0),
        Math.round(kf.boardZoomOffsetY || 0),
        kf.usePiecewise,
        kf.piecewiseBoundaries,
        kf.isPiecewisePeriodic,
        kf.periodicStepY,
        kf.isDropLineMode,
        kf.dropLineHoverCandidate ? `${Math.round(kf.dropLineHoverCandidate.x * 100)},${Math.round(kf.dropLineHoverCandidate.y * 100)}` : '',
        kf.dropLines.length,
        kf.textLabels,
        kf.probCardVisible,
        kf.probCardMin,
        kf.probCardBaseX,
        kf.probCardBaseY,
        Math.round(kf.probCardW || 0),
        kf.graphCardVisible,
        kf.graphCardMin,
        kf.graphCardBaseX,
        kf.graphCardBaseY,
        Math.round(kf.graphCardW || 0),
        kf.graphCardAspect,
        kf.graphCardInkActive,
        kf.graphCardPipSnap,
        kf.extraGraphsCount,
        kf.extraGraphStates,
        kf.extraProbStates,
        kf.boardStickers,
        kf.problemCardStickers,
        kf.graphCardStickers
      ]);
      if (!force && hash === this._lastRecordedStateHash) return;
      this._lastRecordedStateHash = hash;
      this._lastAudioStateRecordMs = t;
      this.audioTimeline.push({
        t,
        type: 'state',
        state: kf
      });
    }

    getAudioCardKey(cardEl) {
      if (!cardEl) return null;
      if (cardEl.id === 'problemCardWidget') return 'problem_main';
      if (cardEl.id === 'graphCardWidget') return 'graph_main';
      if (cardEl.id) return cardEl.id;
      if (Array.isArray(this.extraGraphCards)) {
        const gIdx = this.extraGraphCards.findIndex(c => c && c.el === cardEl);
        if (gIdx >= 0) return `graph_extra_${gIdx}`;
      }
      if (Array.isArray(this.extraProblemCards)) {
        const pIdx = this.extraProblemCards.findIndex(c => c && c.el === cardEl);
        if (pIdx >= 0) return `problem_extra_${pIdx}`;
      }
      return null;
    }

    getCardElementByAudioKey(cardKey) {
      if (!cardKey) return null;
      if (cardKey === 'problem_main') return document.getElementById('problemCardWidget');
      if (cardKey === 'graph_main') return document.getElementById('graphCardWidget');
      if (typeof cardKey === 'string' && cardKey.startsWith('graph_extra_')) {
        const idx = parseInt(cardKey.slice('graph_extra_'.length), 10);
        if (!isNaN(idx) && this.extraGraphCards && this.extraGraphCards[idx]) {
          return this.extraGraphCards[idx].el || null;
        }
      }
      if (typeof cardKey === 'string' && cardKey.startsWith('problem_extra_')) {
        const idx = parseInt(cardKey.slice('problem_extra_'.length), 10);
        if (!isNaN(idx) && this.extraProblemCards && this.extraProblemCards[idx]) {
          return this.extraProblemCards[idx].el || null;
        }
      }
      return document.getElementById(cardKey);
    }

    _detectCurrentAudioCursorKind(isDrawing = false, extraMeta = null) {
      if (extraMeta && extraMeta.cursorKind) return extraMeta.cursorKind;
      if (extraMeta && extraMeta.isLaser) return 'laser';
      if (this.isDropLineMode || this.isGraphSnapMode || this.isPdfToGraphCropMode) return 'crosshair';
      if (this.isTextToolMode) return 'arrow';

      const isDraggingNow = Boolean(
        isDrawing ||
        this.draggedHandleIdx !== null ||
        this.isDraggingCurve ||
        this.activePwDragIdx !== null ||
        this.isPanning ||
        this.isBoardPanning ||
        this._isInteractingWithPipCard ||
        this.isMovingStage ||
        this.isResizingStage
      );

      if (this.isInkMode) {
        if (this.activeInkTool === 'eraser' || this._isTemporaryStylusEraser) return 'eraser';
        if (this.activeInkTool === 'laser') return 'laser';
        if (this.activeInkTool === 'highlighter') return 'highlighter';
        if (this.activeInkTool === 'lasso') return isDraggingNow ? 'grabbing' : 'crosshair';
        if (this.activeInkTool === 'pen') return 'pen';
        // select 모드
        if (isDraggingNow) return 'grabbing';
        const curStyle = (this.canvas && this.canvas.style && this.canvas.style.cursor) || 'default';
        if (curStyle === 'grab' || curStyle === 'move' || curStyle === 'pointer' || curStyle === 'ew-resize') return 'grab';
        return 'arrow';
      }

      // 순수 그래프 조작 모드 (!this.isInkMode)
      if (isDraggingNow) return 'grabbing';
      const curStyle = (this.canvas && this.canvas.style && this.canvas.style.cursor) || 'default';
      if (curStyle === 'grab' || curStyle === 'move' || curStyle === 'pointer' || curStyle === 'ew-resize') return 'grab';
      return 'arrow';
    }

    _extractAudioUiTargetMeta(targetEl, clientX, clientY) {
      if (!targetEl || typeof targetEl.closest !== 'function') return {};
      const barSelectors = [
        { id: 'railDrawer', sel: '#railDrawer, .rail-drawer' },
        { id: 'railDock', sel: '#railDock, .rail-dock' },
        { id: 'sidebarRail', sel: '#sidebarRail, .sidebar-rail' },
        { id: 'inkFloatingToolbar', sel: '#inkFloatingToolbar, .ink-floating-toolbar' },
        { id: 'rightActionToolbar', sel: '#rightActionToolbar, .canvas-quick-toolbar' },
        { id: 'quickPillRemote', sel: '#quickPillRemote' },
        { id: 'graphSnapFloatingBar', sel: '#graphSnapFloatingBar, .graph-snap-floating-bar' },
        { id: 'pdfToGraphCropFloatingBar', sel: '#pdfToGraphCropFloatingBar' },
        { id: 'curveContextBar', sel: '#curveContextBar, .curve-context-bar' },
        { id: 'lassoActionFloatingBar', sel: '#lassoActionFloatingBar, .lasso-action-floating-bar' },
        { id: 'pwRegionPopover', sel: '#pwRegionPopover, .pw-region-popover' },
        { id: 'lessonPlaylistNavBar', sel: '#lessonPlaylistNavBar, .lesson-playlist-nav-bar' },
        { id: 'problemCardWidget', sel: '#problemCardWidget' },
        { id: 'graphCardWidget', sel: '#graphCardWidget' }
      ];
      let uiBarId = '';
      let barEl = null;
      for (let i = 0; i < barSelectors.length; i++) {
        const m = targetEl.closest(barSelectors[i].sel);
        if (m) {
          uiBarId = barSelectors[i].id;
          barEl = m;
          break;
        }
      }
      if (!barEl) {
        const extraCard = targetEl.closest('.extra-problem-card-widget, .extra-graph-card-widget');
        if (extraCard && extraCard.id) {
          uiBarId = extraCard.id;
          barEl = extraCard;
        }
      }
      const meta = {};
      if (uiBarId) meta.uiBarId = uiBarId;
      if (barEl && typeof barEl.getBoundingClientRect === 'function') {
        const br = barEl.getBoundingClientRect();
        if (br.width > 2 && br.height > 2) {
          meta.unx = Math.round(Math.max(0, Math.min(1, (clientX - br.left) / br.width)) * 10000) / 10000;
          meta.uny = Math.round(Math.max(0, Math.min(1, (clientY - br.top) / br.height)) * 10000) / 10000;
        }
      }
      const btnEl = targetEl.closest(
        'button, a, label, [role="button"], .preset-card, .func-btn, .rail-btn, .ink-tool-btn, .ink-color-dot, .quick-fab-btn, .slide-num-chip, .cat-tab-btn, .card-btn, .pip-pop-btn, .ctx-btn, .lasso-action-btn, .pw-popover-item, .custom-preset-chip, .export-preset-btn'
      );
      if (btnEl) {
        let uiBtnKey = '';
        const ds = btnEl.dataset || {};
        if (btnEl.id) {
          uiBtnKey = `id:${btnEl.id}`;
        } else if (ds.pipAct) {
          uiBtnKey = `pipAct:${ds.pipAct}`;
        } else if (ds.tool) {
          uiBtnKey = `tool:${ds.tool}`;
        } else if (ds.color) {
          uiBtnKey = `color:${ds.color}`;
        } else if (ds.panel) {
          uiBtnKey = `panel:${ds.panel}`;
        } else if (ds.cat) {
          uiBtnKey = `cat:${ds.cat}`;
        } else if (ds.preset) {
          uiBtnKey = `preset:${ds.preset}`;
        } else if (ds.customPresetId) {
          uiBtnKey = `customPreset:${ds.customPresetId}`;
        } else if (ds.action) {
          uiBtnKey = `action:${ds.action}`;
        } else if (ds.slideIdx !== undefined) {
          uiBtnKey = `slide:${ds.slideIdx}`;
        } else if (barEl) {
          const allBtns = Array.from(barEl.querySelectorAll('button, .preset-card, .func-btn, .rail-btn, .ink-tool-btn, .ink-color-dot, .card-btn, .pip-pop-btn, .ctx-btn'));
          const idx = allBtns.indexOf(btnEl);
          if (idx >= 0) uiBtnKey = `idx:${uiBarId}:${idx}`;
        }
        if (uiBtnKey) meta.uiBtnKey = uiBtnKey;
        if (typeof btnEl.getBoundingClientRect === 'function') {
          const r = btnEl.getBoundingClientRect();
          if (r.width > 2 && r.height > 2) {
            meta.bnx = Math.round(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * 10000) / 10000;
            meta.bny = Math.round(Math.max(0, Math.min(1, (clientY - r.top) / r.height)) * 10000) / 10000;
          }
        }
      }
      return meta;
    }

    _findAudioUiButtonByKey(uiBtnKey, uiBarId = '') {
      if (!uiBtnKey || typeof uiBtnKey !== 'string') return null;
      if (uiBtnKey.startsWith('id:')) {
        return document.getElementById(uiBtnKey.slice(3));
      }
      if (uiBtnKey.startsWith('pipAct:')) {
        const scope = uiBarId ? document.getElementById(uiBarId) : document;
        return (scope || document).querySelector(`[data-pip-act="${uiBtnKey.slice(7)}"]`);
      }
      if (uiBtnKey.startsWith('tool:')) {
        return document.querySelector(`#inkFloatingToolbar [data-tool="${uiBtnKey.slice(5)}"]`);
      }
      if (uiBtnKey.startsWith('color:')) {
        return document.querySelector(`#inkFloatingToolbar [data-color="${uiBtnKey.slice(6)}"]`);
      }
      if (uiBtnKey.startsWith('panel:')) {
        return document.querySelector(`#sidebarRail [data-panel="${uiBtnKey.slice(6)}"]`);
      }
      if (uiBtnKey.startsWith('cat:')) {
        return document.querySelector(`#railDrawer [data-cat="${uiBtnKey.slice(4)}"]`);
      }
      if (uiBtnKey.startsWith('preset:')) {
        return document.querySelector(`#railDrawer [data-preset="${uiBtnKey.slice(7)}"]`);
      }
      if (uiBtnKey.startsWith('customPreset:')) {
        return document.querySelector(`#railDrawer [data-custom-preset-id="${uiBtnKey.slice(13)}"]`);
      }
      if (uiBtnKey.startsWith('action:')) {
        const scope = uiBarId ? document.getElementById(uiBarId) : document;
        return (scope || document).querySelector(`[data-action="${uiBtnKey.slice(7)}"]`);
      }
      if (uiBtnKey.startsWith('slide:')) {
        return document.querySelector(`#lessonPlaylistNavBar [data-slide-idx="${uiBtnKey.slice(6)}"]`);
      }
      if (uiBtnKey.startsWith('idx:')) {
        const parts = uiBtnKey.split(':');
        const bId = parts[1];
        const idx = parseInt(parts[2], 10);
        const barEl = bId ? document.getElementById(bId) : null;
        if (barEl && Number.isFinite(idx) && idx >= 0) {
          const allBtns = barEl.querySelectorAll('button, .preset-card, .func-btn, .rail-btn, .ink-tool-btn, .ink-color-dot, .card-btn, .pip-pop-btn, .ctx-btn');
          return allBtns[idx] || null;
        }
      }
      return null;
    }

    recordAudioCursorPoint(screenX, screenY, color = null, isDrawing = false, extraMeta = null) {
      if (!this.isAudioRecording || this.isAudioRecordPaused || this.isPdfModalOpen || this._isAudioWaitingForNextSlideSetup) return;
      const t = this.getAudioRecordElapsedMs();
      const cursorKind = this._detectCurrentAudioCursorKind(isDrawing, extraMeta);
      const uiBtnKey = (extraMeta && extraMeta.uiBtnKey) ? extraMeta.uiBtnKey : '';
      const uiBarId = (extraMeta && extraMeta.uiBarId) ? extraMeta.uiBarId : '';
      const kindChanged = (
        cursorKind !== this._lastRecordedCursorKind ||
        uiBtnKey !== (this._lastRecordedUiBtnKey || '') ||
        uiBarId !== (this._lastRecordedUiBarId || '') ||
        Boolean(isDrawing) !== Boolean(this._lastRecordedCursorIsDrawing)
      );
      // 호버링은 28ms(약 35fps + 재생 시 60fps 보간) & 정지 시 중복 좌표 생략으로 용량은 절반 이하로 줄이면서 펜 깜빡임 없이 매끄럽게 연결!
      if (!kindChanged && !isDrawing && (t - this._lastAudioCursorRecordMs < 28)) return;
      if (!kindChanged && isDrawing && (t - this._lastAudioCursorRecordMs < 14)) return;
      if (!kindChanged && !isDrawing && this._lastRecordedCursorPos && Math.hypot(screenX - this._lastRecordedCursorPos.x, screenY - this._lastRecordedCursorPos.y) < 1.5) return;
      this._lastRecordedCursorPos = { x: screenX, y: screenY };
      this._lastAudioCursorRecordMs = t;
      this._lastRecordedCursorKind = cursorKind;
      this._lastRecordedUiBtnKey = uiBtnKey;
      this._lastRecordedUiBarId = uiBarId;
      this._lastRecordedCursorIsDrawing = Boolean(isDrawing);

      const entry = {
        t,
        type: 'cursor',
        x: Math.round(screenX * 10) / 10,
        y: Math.round(screenY * 10) / 10,
        color: color || this.currentInkColor || '#00d2d3',
        isDrawing: Boolean(isDrawing),
        cursorKind
      };

      if (extraMeta && extraMeta.uiScreen) {
        entry.uiScreen = true;
        if (extraMeta.uiBarId) entry.uiBarId = extraMeta.uiBarId;
        if (extraMeta.uiBtnKey) entry.uiBtnKey = extraMeta.uiBtnKey;
        if (typeof extraMeta.unx === 'number') entry.unx = extraMeta.unx;
        if (typeof extraMeta.uny === 'number') entry.uny = extraMeta.uny;
        if (typeof extraMeta.bnx === 'number') entry.bnx = extraMeta.bnx;
        if (typeof extraMeta.bny === 'number') entry.bny = extraMeta.bny;
      } else if (extraMeta && extraMeta.cardKey) {
        entry.cardKey = extraMeta.cardKey;
        entry.nx = Math.round((extraMeta.nx || 0) * 10000) / 10000;
        entry.ny = Math.round((extraMeta.ny || 0) * 10000) / 10000;
        if (extraMeta.isLaser) entry.isLaser = true;
      } else {
        const isBoard = Boolean(this.isGraphCovered && !this.pdfPageBoardData);
        entry.isBoard = isBoard;
        if (isBoard) {
          const bPt = this.screenToBoard(screenX, screenY);
          entry.bx = Math.round(bPt.x * 10) / 10;
          entry.by = Math.round(bPt.y * 10) / 10;
        } else {
          const mPt = this.screenToMath(screenX, screenY);
          entry.mx = Math.round(mPt.x * 1000) / 1000;
          entry.my = Math.round(mPt.y * 1000) / 1000;
        }
      }

      this.audioTimeline.push(entry);
    }

    async startAudioRecording() {
      if (this.isAudioRecording) return;
      const maxDurationMs = Math.max(1000, this.getMaxAudioRecordDurationMs());
      const priorOtherSlidesMs = this._computeOtherSlidesRecordedDurationMs();
      if (priorOtherSlidesMs >= maxDurationMs) {
        const maxMinutes = Math.max(1, Math.round(maxDurationMs / 60000));
        const isPaid = (typeof this.isProSubscriber === 'function') ? this.isProSubscriber() : Boolean(this.isProUser);
        if (!isPaid) {
          this.showToast(`⚠️ 무료 플랜 녹화 한도(${maxMinutes}분)를 모두 사용했습니다. Pro·Premium 업그레이드 시 60분까지 녹화 가능합니다.`);
          if (typeof this.openProPricingModal === 'function') this.openProPricingModal('pro');
        } else {
          this.showToast(`⚠️ 현재 수업 노트의 최대 녹화 시간(${maxMinutes}분)에 도달했습니다. 새 노트에서 녹화를 이어가 주세요.`);
        }
        return;
      }
      this.stopAudioPlayback(true);
      this._sessionBasePriorRecordedMs = priorOtherSlidesMs;
      this._warnedEndingSoonInSession = false;

      // 녹음 시작 전 이미 그려져 있던 스트로크들은 배경 스트로크(preExisting: true)로 마킹하여 영상 모드에서도 처음부터 보이게 유지
      const markPreExisting = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(st => {
          if (st && st.tStart === undefined) {
            st.preExisting = true;
          }
        });
      };
      markPreExisting(this.inkStrokes);
      markPreExisting(this.problemInkStrokes);
      markPreExisting(this.graphInkStrokes);

      this.audioRecordedChunks = [];
      this.audioTimeline = [];
      this.audioMediaStream = null;
      this.audioMediaRecorder = null;
      this._audioMimeType = 'audio/webm';

      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && window.MediaRecorder) {
        try {
          const stream = await this._acquireProcessedAudioStream();
          if (!stream) throw new Error('no_audio_stream');
          this.audioMediaStream = stream;
          const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus'
          ];
          let chosenMime = '';
          for (const m of candidates) {
            if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m)) {
              chosenMime = m;
              break;
            }
          }
          this._audioMimeType = chosenMime || 'audio/webm';
          const recOpts = chosenMime ? { mimeType: chosenMime, audioBitsPerSecond: 36000 } : { audioBitsPerSecond: 36000 };
          const recorder = new MediaRecorder(stream, recOpts);
          const localChunks = [];
          recorder._localChunks = localChunks;
          this.audioRecordedChunks = localChunks;
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              localChunks.push(ev.data);
            }
          };
          recorder.start(250);
          this.audioMediaRecorder = recorder;
        } catch (micErr) {
          // 마이크가 없거나 권한이 거부된 환경(또는 헤드리스 테스트)에서는 타이머 동기화 모드로 끊김 없이 진행!
          this._cleanupProcessedAudioStream();
          this.audioMediaRecorder = null;
        }
      }

      this.isAudioRecording = true;
      this._currentAudioRecordingSessionId = Date.now();
      this.isAudioRecordPaused = false;
      this._isAudioRecMenuOpen = false;
      this._isRecBarStealthHidden = true;
      this._isAudioWaitingForNextSlideSetup = false;
      this._alreadyArchivedBeforePdfModal = false;
      this._autoPausedByPdfModal = false;
      this._resumedSlideBaseOffsetMs = 0;
      this._priorSlideAudioSegments = [];
      const startPerfNow = performance.now();
      this.audioRecordStartMs = startPerfNow;
      this.audioSessionStartMs = startPerfNow;
      this.audioRecordPauseStartMs = 0;
      this.audioRecordTotalPausedMs = 0;
      this.audioSessionTotalPausedMs = 0;
      this._isAutoStoppingByLimit = false;
      this._lastAudioCursorRecordMs = -100;
      this._lastAudioStateRecordMs = -100;
      this._lastAudioStateCheckMs = -100;
      this._wasActivelyDraggingGraph = false;
      this._lastRecordedStateHash = '';
      this.audioInitialState = this._captureAudioWorkspaceKeyframe();
      this._recordAudioWorkspaceStateIfNeeded(true);

      // 칠판 모드(isGraphCovered)에서 녹음을 시작할 때만 자동으로 펜 도구를 켜주고,
      // 실시간 그래프 모드(!isGraphCovered)에서는 선생님이 그래프 극점 핸들을 바로 잡고 움직일 수 있도록 현재 도구 상태(선택/이동 또는 필기)를 그대로 존중!
      if (this.isGraphCovered) {
        if (!this.isInkMode) {
          this.toggleInkMode(true);
        }
        if (this.activeInkTool === 'select' || this.activeInkTool === 'eraser') {
          this.setActiveInkTool('pen');
        }
      }

      const lblTimer = document.getElementById('lblAudioRecordTimer');
      if (lblTimer) lblTimer.textContent = '00:00';
      this._updateAudioRecordProgressRings(true);
      if (this._audioRecordTimerId) clearInterval(this._audioRecordTimerId);
      this._audioRecordTimerId = setInterval(() => {
        if (!this.isAudioRecording) return;
        const isActivelyDrawingNow = Boolean(this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser || this.isErasingInk);
        if (!isActivelyDrawingNow && lblTimer) {
          const elapsed = this.getAudioRecordElapsedMs();
          const nextTimeStr = this.formatAudioTimeMmSs(elapsed);
          if (lblTimer.textContent !== nextTimeStr) {
            lblTimer.textContent = nextTimeStr;
          }
        }
        this._updateAudioRecordProgressRings(false);
        this._recordAudioWorkspaceStateIfNeeded(false);
      }, 200);

      this.syncAudioRecordUI();
      this.showToast('🎬 영상 녹화가 시작되었습니다. (다시 누르면 일시정지 / 종료)');
    }

    async stopAudioRecording(options = {}) {
      if (!this.isAudioRecording) return null;
      if (this._pendingSlideRecorderStarter) {
        await this._pendingSlideRecorderStarter.catch(() => { });
        this._pendingSlideRecorderStarter = null;
      }
      const segStartMs = Math.max(0, Number(this._resumedSlideBaseOffsetMs) || 0);
      const durationMs = Math.max(segStartMs + 300, this.getAudioRecordElapsedMs());
      const segDurMs = Math.max(100, durationMs - segStartMs);
      try {
        this._recordAudioWorkspaceStateIfNeeded(true);
        this.audioFinalState = this._captureAudioWorkspaceKeyframe();
      } catch (e) { }
      this.isAudioRecording = false;
      this.isAudioRecordPaused = false;
      this._isAudioRecMenuOpen = false;
      this.audioRecordPauseStartMs = 0;
      this.audioRecordTotalPausedMs = 0;
      this.audioSessionTotalPausedMs = 0;
      this._updateAudioRecordProgressRings(true);

      if (this._audioRecordTimerId) {
        clearInterval(this._audioRecordTimerId);
        this._audioRecordTimerId = null;
      }

      let audioDataUrl = '';
      const activeRec = this.audioMediaRecorder;
      const recChunks = (activeRec && Array.isArray(activeRec._localChunks))
        ? activeRec._localChunks
        : (this.audioRecordedChunks || []);
      if (activeRec && activeRec.state !== 'inactive') {
        await new Promise((resolve) => {
          activeRec.onstop = () => resolve();
          try {
            activeRec.stop();
          } catch (e) {
            resolve();
          }
        });
      }
      this._cleanupProcessedAudioStream();
      this.audioMediaRecorder = null;

      if (recChunks && recChunks.length > 0) {
        const blob = new Blob(recChunks, { type: this._audioMimeType || 'audio/webm' });
        audioDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      }

      if (this._pendingSlideAudioFinalizers && this._pendingSlideAudioFinalizers.length > 0) {
        await Promise.all(this._pendingSlideAudioFinalizers).catch(() => { });
        this._pendingSlideAudioFinalizers = [];
      }

      if (!audioDataUrl || this.isAudioMicMuted) {
        audioDataUrl = this._createSilentWavDataUrl(segDurMs);
      }

      const currentMime = this._audioMimeType || 'audio/wav';
      const priorSegs = Array.isArray(this._priorSlideAudioSegments)
        ? JSON.parse(JSON.stringify(this._priorSlideAudioSegments))
        : [];
      const newSeg = {
        startMs: segStartMs,
        endMs: durationMs,
        durationMs: segDurMs,
        audioDataUrl,
        mimeType: currentMime,
        nextSlideIdx: null,
        nextSlideStartMs: 0
      };
      const audioSegments = [...priorSegs, newSeg];
      const primaryAudioUrl = (audioSegments[0] && audioSegments[0].audioDataUrl) || audioDataUrl;

      const recordedStageW = Math.round(
        (this.audioInitialState && this.audioInitialState.stageW) ||
        (this.audioFinalState && this.audioFinalState.stageW) ||
        this.screenWidth ||
        window.innerWidth ||
        1440
      );
      const recordedStageH = Math.round(
        (this.audioInitialState && this.audioInitialState.stageH) ||
        (this.audioFinalState && this.audioFinalState.stageH) ||
        this.screenHeight ||
        window.innerHeight ||
        900
      );

      this.audioSyncData = {
        version: '1.2',
        sessionId: this._currentAudioRecordingSessionId || null,
        createdAt: Date.now(),
        stageW: recordedStageW,
        stageH: recordedStageH,
        durationMs,
        mimeType: currentMime,
        audioDataUrl: primaryAudioUrl,
        audioSegments,
        initialState: this.audioInitialState || this.audioFinalState,
        finalState: this.audioFinalState,
        timeline: this.audioTimeline,
        laserStrokes: this.audioLaserStrokes || [],
        erasedStrokes: this.audioErasedStrokes || []
      };

      this._resumedSlideBaseOffsetMs = 0;
      this._priorSlideAudioSegments = [];
      if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides[this.lessonPlaylistIndex]) {
        this.saveCurrentSlideIntoPlaylist();
      }
      this.audioPlayCurrentMs = durationMs;
      this._isAudioSyncPlayerVisible = false;
      this.audioReplayViewMode = 'video';
      this.syncAudioRecordUI();
      if (!options || !options.silentToast) {
        this.showToast('⏹ 영상 녹화가 완료되었습니다.');
      }
      return this.audioSyncData;
    }

    syncAudioRecordUI() {
      this._updateAudioRecordProgressRings(true);
      const btnFab = document.getElementById('btnAudioRecordToggle');
      const sideMenu = document.getElementById('panelAudioRecordActions');
      const wrapStealthDot = document.getElementById('wrapStealthRecordDot');
      const btnStealthDot = document.getElementById('btnStealthRecordDot');
      const stealthSideMenu = document.getElementById('panelStealthRecordActions');
      const bar = document.getElementById('audioSyncFloatingBar');
      const recGroup = document.getElementById('audioSyncRecordingGroup');
      const playGroup = document.getElementById('audioSyncPlayerGroup');
      const iconPlay = document.getElementById('iconAudioPlayPause');
      const lblPlayTime = document.getElementById('lblAudioPlayTime');
      const scrubber = document.getElementById('audioSyncScrubber');

      const hasAudio = Boolean(this.audioSyncData && this.audioSyncData.durationMs > 0);
      const isPaused = Boolean(this.isAudioRecordPaused);
      const isHiddenUI = Boolean(this.isAllUIHidden || document.body.classList.contains('ui-all-hidden-mode'));
      if (btnFab) {
        btnFab.classList.toggle('is-recording', Boolean(this.isAudioRecording));
        btnFab.classList.toggle('is-paused', Boolean(this.isAudioRecording && isPaused));
        btnFab.classList.toggle('has-audio', hasAudio && !this.isAudioRecording);
      }
      if (sideMenu) {
        sideMenu.style.display = (this.isAudioRecording && !isHiddenUI && this._isAudioRecMenuOpen) ? 'flex' : 'none';
      }
      if (wrapStealthDot) {
        wrapStealthDot.style.display = (this.isAudioRecording && isHiddenUI) ? 'flex' : 'none';
      }
      if (btnStealthDot) {
        btnStealthDot.classList.toggle('is-paused', Boolean(this.isAudioRecording && isPaused));
        btnStealthDot.title = isPaused
          ? '녹화 일시정지됨 (클릭 시 이어녹화 / 종료)'
          : '녹화 중 (클릭 시 일시정지 / 종료)';
      }
      if (stealthSideMenu) {
        stealthSideMenu.style.display = (this.isAudioRecording && isHiddenUI && this._isAudioRecMenuOpen) ? 'flex' : 'none';
      }

      if (!bar) return;
      if (this.isAudioRecording) {
        // 대표님 지침: 수업 중 거추장스러운 상단 녹음 바는 완전히 숨기고 우측 마이크 버튼 옆 2개 메뉴로 일원화!
        bar.style.display = 'none';
        if (recGroup) recGroup.style.display = 'none';
        if (playGroup) playGroup.style.display = 'none';
        const badgeEl = document.getElementById('badgeAudioRecState');
        const badgeTxt = document.getElementById('lblAudioRecBadgeText');
        const hintEl = document.getElementById('lblAudioRecHint');
        const btnPauseRec = document.getElementById('btnAudioPauseRecord');
        const iconPauseRec = document.getElementById('iconAudioPauseRecord');
        const lblPauseRec = document.getElementById('lblAudioPauseRecord');
        const btnStealthPauseRec = document.getElementById('btnStealthPauseRecord');
        const iconStealthPauseRec = document.getElementById('iconStealthPauseRecord');
        const lblStealthPauseRec = document.getElementById('lblStealthPauseRecord');
        if (badgeEl) badgeEl.classList.toggle('is-paused', isPaused);
        if (badgeTxt) badgeTxt.textContent = isPaused ? 'PAUSED' : 'REC';
        if (hintEl) {
          hintEl.textContent = isPaused
            ? '녹화 일시정지됨 (이어녹화 시 끊김 없이 연결)'
            : '음성·필기·펜포인터·그래프 실시간 동기화 중';
        }
        if (btnPauseRec) btnPauseRec.classList.toggle('is-paused', isPaused);
        if (iconPauseRec) iconPauseRec.textContent = isPaused ? '▶' : '⏸';
        if (lblPauseRec) lblPauseRec.textContent = isPaused ? '이어녹화' : '일시정지';
        if (btnStealthPauseRec) btnStealthPauseRec.classList.toggle('is-paused', isPaused);
        if (iconStealthPauseRec) iconStealthPauseRec.textContent = isPaused ? '▶' : '⏸';
        if (lblStealthPauseRec) lblStealthPauseRec.textContent = isPaused ? '이어녹화' : '일시정지';

        const btnMic = document.getElementById('btnAudioMicMuteToggle');
        const iconMic = document.getElementById('iconAudioMicMute');
        const lblMic = document.getElementById('lblAudioMicMute');
        const isMuted = Boolean(this.isAudioMicMuted);
        if (btnMic) btnMic.classList.toggle('is-muted', isMuted);
        if (iconMic) iconMic.textContent = isMuted ? '🔇' : '🎤';
        if (lblMic) lblMic.textContent = isMuted ? '무음 녹화' : '마이크 ON';
        return;
      }

      if (hasAudio && (this._isAudioSyncPlayerVisible || this.isStudentAudioVideoOnlyMode)) {
        bar.style.display = 'flex';
        if (recGroup) recGroup.style.display = 'none';
        if (playGroup) playGroup.style.display = 'flex';
        const dur = this.audioSyncData.durationMs || 1000;
        const cur = Math.max(0, Math.min(dur, this.audioPlayCurrentMs || 0));
        if (iconPlay) iconPlay.textContent = this.isAudioPlaying ? '⏸' : '▶';
        if (lblPlayTime) {
          lblPlayTime.textContent = `${this.formatAudioTimeMmSs(cur)} / ${this.formatAudioTimeMmSs(dur)}`;
        }
        if (scrubber) {
          scrubber.max = String(dur);
          scrubber.value = String(Math.round(cur));
        }
        const btnShowFinalNote = document.getElementById('btnAudioShowFinalNote');
        if (btnShowFinalNote) {
          btnShowFinalNote.style.display = 'none';
        }
        const btnBackToViewer = document.getElementById('btnAudioBackToViewer');
        if (btnBackToViewer) {
          btnBackToViewer.style.display = this.isStudentAudioVideoOnlyMode ? 'inline-flex' : 'none';
        }
        if (!this.isAudioPlaying) {
          bar.classList.remove('player-bar-auto-hidden');
        }
      } else {
        bar.classList.remove('player-bar-auto-hidden');
        bar.style.display = 'none';
      }
    }

    // =========================================================================
    // 🎬 [유튜브형 고정 프레임 영상 스테이지 (Fixed-Aspect Recorded Video Stage)]
    //   - 촬영 당시의 화면(stageW × stageH) 전체를 고정 비율 프레임으로 설정하고,
    //     모바일·태블릿·PC·와이드 모니터 어디서든 비율 왜곡 0%로 균일 스케일링(Contain)
    //   - 두 손가락 핀치 줌 / 마우스 휠 확대·축소(100%~450%) + 드래그 패닝 + 더블탭 줌 완벽 지원
    // =========================================================================
    _isFixedReplayStageActive() {
      return Boolean(
        (this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode) &&
        !this.isAudioRecording &&
        this.audioSyncData &&
        this.audioSyncData.durationMs > 0
      );
    }

    _getActiveAudioReplayStageSize(syncData = this.audioSyncData) {
      const initKf = (syncData && syncData.initialState) || null;
      const finalKf = (syncData && syncData.finalState) || null;
      const rawW = (syncData && syncData.stageW) || (initKf && initKf.stageW) || (finalKf && finalKf.stageW);
      const rawH = (syncData && syncData.stageH) || (initKf && initKf.stageH) || (finalKf && finalKf.stageH);
      if (typeof rawW === 'number' && rawW >= 320 && typeof rawH === 'number' && rawH >= 240) {
        return { w: Math.round(rawW), h: Math.round(rawH) };
      }
      if (syncData && syncData._solvedStageSize) {
        return syncData._solvedStageSize;
      }

      // 1. 구버전 녹화본(stageW/stageH 미기록)을 위한 수학 좌표(mx, my) ⇄ 화면 좌표(x, y) 연립방정식 정밀 역산
      const candidateSyncList = [syncData];
      if (Array.isArray(this.lessonSlides)) {
        this.lessonSlides.forEach(sl => {
          if (sl && sl.audioSyncData && sl.audioSyncData !== syncData) {
            candidateSyncList.push(sl.audioSyncData);
          }
        });
      }
      const shSamples = [];
      const swSamples = [];
      for (let sIdx = 0; sIdx < candidateSyncList.length; sIdx++) {
        const sd = candidateSyncList[sIdx];
        if (!sd) continue;
        this._expandAudioSyncData(sd);
        if (!Array.isArray(sd.timeline)) continue;
        let curKf = sd.initialState || null;
        for (let i = 0; i < sd.timeline.length; i++) {
          const ev = sd.timeline[i];
          if (!ev) continue;
          if (ev.type === 'state' && ev.state) {
            curKf = ev.state;
          } else if (
            ev.type === 'cursor' &&
            !ev.uiScreen &&
            !ev.cardKey &&
            !ev.isBoard &&
            typeof ev.x === 'number' &&
            typeof ev.y === 'number' &&
            typeof ev.mx === 'number' &&
            typeof ev.my === 'number' &&
            curKf
          ) {
            const panX = typeof curKf.panX === 'number' ? curKf.panX : 0;
            const panY = typeof curKf.panY === 'number' ? curKf.panY : 0;
            const zoomLevel = (typeof curKf.zoomLevel === 'number' && curKf.zoomLevel > 0) ? curKf.zoomLevel : 1.0;
            const ySpan = (typeof curKf.ySpan === 'number' && curKf.ySpan > 0) ? curKf.ySpan : 6.0;
            const effSpanY = ySpan / zoomLevel;
            const denomY = 1 - (ev.my / effSpanY);
            if (Math.abs(denomY) >= 0.35 && Math.abs(ev.y - panY) >= 50) {
              const shCand = (2 * (ev.y - panY)) / denomY;
              if (shCand >= 360 && shCand <= 2400) {
                const unitScale = (shCand / 2) / effSpanY;
                const swCand = 2 * (ev.x - panX - ev.mx * unitScale);
                if (swCand >= 480 && swCand <= 4000) {
                  shSamples.push(shCand);
                  swSamples.push(swCand);
                }
              }
            }
          }
        }
        if (shSamples.length >= 8 && swSamples.length >= 8) break;
      }

      if (shSamples.length > 0 && swSamples.length > 0) {
        shSamples.sort((a, b) => a - b);
        swSamples.sort((a, b) => a - b);
        const medH = Math.round(shSamples[Math.floor(shSamples.length / 2)]);
        const medW = Math.round(swSamples[Math.floor(swSamples.length / 2)]);
        const solved = { w: medW, h: medH };
        if (syncData) syncData._solvedStageSize = solved;
        return solved;
      }

      // 2. 순수 칠판 모드만 있는 구버전 녹화본을 위한 UI/포인터 바운딩 폴백
      let estW = 0;
      let estH = 0;
      const checkKf = (kf) => {
        if (!kf) return;
        if (typeof kf.pillRemoteLeft === 'number' && typeof kf.pillRemoteRightGap === 'number' && kf.pillRemoteLeft > 200) {
          estW = Math.max(estW, kf.pillRemoteLeft + 112 + kf.pillRemoteRightGap);
        }
        if (typeof kf.probCardBaseX === 'number' && typeof kf.probCardW === 'number') {
          estW = Math.max(estW, kf.probCardBaseX + kf.probCardW + 40);
        }
        if (typeof kf.graphCardBaseX === 'number' && typeof kf.graphCardW === 'number') {
          estW = Math.max(estW, kf.graphCardBaseX + kf.graphCardW + 40);
        }
      };
      checkKf(initKf);
      checkKf(finalKf);
      if (syncData && Array.isArray(syncData.timeline)) {
        for (let i = 0; i < syncData.timeline.length; i++) {
          const ev = syncData.timeline[i];
          if (!ev) continue;
          if (ev.type === 'cursor') {
            if (typeof ev.x === 'number') estW = Math.max(estW, ev.x + 36);
            if (typeof ev.y === 'number') estH = Math.max(estH, ev.y + 36);
          } else if (ev.type === 'state' && ev.state) {
            checkKf(ev.state);
          }
        }
      }
      const finalW = Math.max(1280, Math.min(2560, Math.round(estW || 1440)));
      const finalH = Math.max(720, Math.min(1600, Math.round(estH > 540 ? estH : (finalW * 9 / 16))));
      const fallback = { w: finalW, h: finalH };
      if (syncData) syncData._solvedStageSize = fallback;
      return fallback;
    }

    _getStageElementRect(el) {
      if (!el || typeof el.getBoundingClientRect !== 'function') return null;
      const r = el.getBoundingClientRect();
      if (!this.canvas || !this._isFixedReplayStageActive()) return r;
      const cRect = this.canvas.getBoundingClientRect();
      const sw = this.screenWidth || 1440;
      const sh = this.screenHeight || 900;
      const scaleX = (cRect.width > 10 && sw > 10) ? (cRect.width / sw) : (this._replayStageTotalScale || 1);
      const scaleY = (cRect.height > 10 && sh > 10) ? (cRect.height / sh) : scaleX;
      if (!Number.isFinite(scaleX) || scaleX <= 0.01) return r;
      const left = (r.left - cRect.left) / scaleX;
      const top = (r.top - cRect.top) / scaleY;
      const width = r.width / scaleX;
      const height = r.height / scaleY;
      return {
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        x: left,
        y: top
      };
    }

    _syncReplayFixedStageLayout() {
      const active = this._isFixedReplayStageActive();
      const wsEl = document.querySelector('.main-workspace');
      const btnZoom = document.getElementById('btnAudioReplayZoomReset');
      if (!active) {
        const wasActive = document.body.classList.contains('replay-fixed-stage');
        if (wasActive) {
          document.body.classList.remove('replay-fixed-stage');
          document.body.style.removeProperty('--replay-stage-w');
          document.body.style.removeProperty('--replay-stage-h');
          if (wsEl) {
            wsEl.style.transform = '';
            wsEl.style.width = '';
            wsEl.style.height = '';
          }
          this._replayViewerZoom = 1.0;
          this._replayViewerPanX = 0;
          this._replayViewerPanY = 0;
          this._replayStageTotalScale = 1.0;
          if (btnZoom) {
            btnZoom.textContent = '100%';
            btnZoom.classList.remove('is-zoomed');
          }
          this.resizeCanvas();
          if (typeof this.syncProblemCardRectFromWidget === 'function') this.syncProblemCardRectFromWidget();
          if (typeof this.syncGraphCardRectFromWidget === 'function') this.syncGraphCardRectFromWidget();
        }
        return;
      }

      const wasFixedStage = document.body.classList.contains('replay-fixed-stage');
      document.body.classList.add('replay-fixed-stage');
      const { w: stageW, h: stageH } = this._getActiveAudioReplayStageSize();
      document.body.style.setProperty('--replay-stage-w', `${stageW}px`);
      document.body.style.setProperty('--replay-stage-h', `${stageH}px`);
      if (wsEl) {
        wsEl.style.width = `${stageW}px`;
        wsEl.style.height = `${stageH}px`;
      }

      const stageResized = (Math.round(this.screenWidth || 0) !== stageW || Math.round(this.screenHeight || 0) !== stageH);
      if (stageResized) {
        this.resizeCanvas();
      }

      const vw = Math.max(240, window.innerWidth || 1280);
      const vh = Math.max(200, window.innerHeight || 720);
      const fitScale = Math.min(vw / stageW, vh / stageH);
      const userZoom = Math.max(1.0, Math.min(4.5, Number(this._replayViewerZoom) || 1.0));
      this._replayViewerZoom = userZoom;
      const totalScale = fitScale * userZoom;
      this._replayStageFitScale = fitScale;
      this._replayStageTotalScale = totalScale;

      const scaledW = stageW * totalScale;
      const scaledH = stageH * totalScale;
      const baseX = (vw - scaledW) * 0.5;
      const baseY = (vh - scaledH) * 0.5;

      if (userZoom <= 1.005) {
        this._replayViewerPanX = 0;
        this._replayViewerPanY = 0;
      } else {
        const maxPanX = Math.max(60, Math.abs(scaledW - vw) * 0.5 + Math.min(vw, scaledW) * 0.35);
        const maxPanY = Math.max(60, Math.abs(scaledH - vh) * 0.5 + Math.min(vh, scaledH) * 0.35);
        this._replayViewerPanX = Math.max(-maxPanX, Math.min(maxPanX, Number(this._replayViewerPanX) || 0));
        this._replayViewerPanY = Math.max(-maxPanY, Math.min(maxPanY, Number(this._replayViewerPanY) || 0));
      }

      const tx = baseX + (this._replayViewerPanX || 0);
      const ty = baseY + (this._replayViewerPanY || 0);
      this._replayStageTranslateX = tx;
      this._replayStageTranslateY = ty;

      if (wsEl) {
        wsEl.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) scale(${totalScale.toFixed(5)})`;
      }
      if (!wasFixedStage || stageResized) {
        if (typeof this.updateProblemCardPosition === 'function') this.updateProblemCardPosition();
        if (typeof this.syncProblemCardRectFromWidget === 'function') this.syncProblemCardRectFromWidget();
        if (typeof this.syncGraphCardRectFromWidget === 'function') this.syncGraphCardRectFromWidget();
        if (typeof this._refreshProblemCardImagesForReplayStage === 'function') {
          this._refreshProblemCardImagesForReplayStage();
        }
      }
      if (btnZoom) {
        const pct = Math.round(userZoom * 100);
        btnZoom.textContent = `${pct}%`;
        btnZoom.classList.toggle('is-zoomed', userZoom > 1.02);
      }
    }

    _refreshProblemCardImagesForReplayStage() {
      const imgs = document.querySelectorAll('#problemCardImg, .extra-problem-card-widget .problem-card-img');
      imgs.forEach((imgEl) => {
        if (!imgEl) return;
        const curSrc = imgEl.getAttribute('src') || imgEl.src || '';
        if (!curSrc) return;
        imgEl.style.transform = 'translateZ(0)';
        requestAnimationFrame(() => {
          if (!imgEl) return;
          imgEl.style.transform = '';
        });
      });
    }

    resetReplayViewerZoom() {
      this._replayViewerZoom = 1.0;
      this._replayViewerPanX = 0;
      this._replayViewerPanY = 0;
      this._syncReplayFixedStageLayout();
    }

    zoomReplayStageAtPoint(nextZoom, focalClientX = null, focalClientY = null) {
      if (!this._isFixedReplayStageActive()) return;
      const prevZoom = Math.max(1.0, Math.min(4.5, Number(this._replayViewerZoom) || 1.0));
      const clampedZoom = Math.max(1.0, Math.min(4.5, Number(nextZoom) || 1.0));
      const vw = Math.max(240, window.innerWidth || 1280);
      const vh = Math.max(200, window.innerHeight || 720);
      const fx = (typeof focalClientX === 'number') ? focalClientX : (vw * 0.5);
      const fy = (typeof focalClientY === 'number') ? focalClientY : (vh * 0.5);

      if (clampedZoom <= 1.005) {
        this._replayViewerZoom = 1.0;
        this._replayViewerPanX = 0;
        this._replayViewerPanY = 0;
        this._syncReplayFixedStageLayout();
        return;
      }

      const ratio = clampedZoom / prevZoom;
      const curPanX = Number(this._replayViewerPanX) || 0;
      const curPanY = Number(this._replayViewerPanY) || 0;
      // 기준점(fx, fy)이 확대/축소 전후에도 화면상의 동일한 위치에 머물도록 팬 오프셋 역산
      this._replayViewerPanX = (fx - vw * 0.5) * (1 - ratio) + curPanX * ratio;
      this._replayViewerPanY = (fy - vh * 0.5) * (1 - ratio) + curPanY * ratio;
      this._replayViewerZoom = clampedZoom;
      this._syncReplayFixedStageLayout();
    }

    _initReplayStageZoomPanInteractions() {
      if (this._replayStageZoomPanBound) return;
      this._replayStageZoomPanBound = true;
      this._replayViewerZoom = 1.0;
      this._replayViewerPanX = 0;
      this._replayViewerPanY = 0;

      const isOuterReplayControl = (target) => {
        if (!target || typeof target.closest !== 'function') return false;
        return Boolean(
          target.closest('#audioSyncFloatingBar') ||
          target.closest('#lessonPlaylistNavBar') ||
          target.closest('#topSlideBarMiniTab') ||
          target.closest('.slide-grid-popover') ||
          target.closest('.smart-modal-backdrop')
        );
      };

      // 1. PC 마우스 휠 확대/축소 (커서 위치 기준 줌)
      window.addEventListener('wheel', (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.14 : (1 / 1.14);
        this.zoomReplayStageAtPoint((this._replayViewerZoom || 1.0) * factor, e.clientX, e.clientY);
      }, { passive: false, capture: true });

      // 2. 모바일/태블릿 두 손가락 핀치 줌 & 패닝 + 확대 시 한 손가락 드래그 이동 + 더블탭 줌 토글
      let isPanningStage = false;
      let panStartX = 0;
      let panStartY = 0;
      let panBaseX = 0;
      let panBaseY = 0;
      let isPinchingStage = false;
      let pinchStartDist = 0;
      let pinchStartZoom = 1.0;
      let pinchPrevMidX = 0;
      let pinchPrevMidY = 0;
      let lastTapMs = 0;
      let lastTapX = 0;
      let lastTapY = 0;

      window.addEventListener('touchstart', (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        e.stopPropagation();
        if (e.touches && e.touches.length === 2) {
          isPanningStage = false;
          isPinchingStage = true;
          pinchStartDist = Math.max(10, Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          ));
          pinchStartZoom = this._replayViewerZoom || 1.0;
          pinchPrevMidX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
          pinchPrevMidY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
        } else if (e.touches && e.touches.length === 1) {
          const t0 = e.touches[0];
          const now = performance.now();
          if (now - lastTapMs < 280 && Math.hypot(t0.clientX - lastTapX, t0.clientY - lastTapY) < 36) {
            e.preventDefault();
            const targetZ = (this._replayViewerZoom || 1.0) > 1.15 ? 1.0 : 2.0;
            this.zoomReplayStageAtPoint(targetZ, t0.clientX, t0.clientY);
            lastTapMs = 0;
            return;
          }
          lastTapMs = now;
          lastTapX = t0.clientX;
          lastTapY = t0.clientY;
          if ((this._replayViewerZoom || 1.0) > 1.01) {
            isPanningStage = true;
            panStartX = t0.clientX;
            panStartY = t0.clientY;
            panBaseX = this._replayViewerPanX || 0;
            panBaseY = this._replayViewerPanY || 0;
          }
        }
      }, { passive: false, capture: true });

      window.addEventListener('touchmove', (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        e.stopPropagation();
        if (isPinchingStage && e.touches && e.touches.length === 2) {
          e.preventDefault();
          const dist = Math.max(10, Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          ));
          const midX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
          this._replayViewerPanX = (this._replayViewerPanX || 0) + (midX - pinchPrevMidX);
          this._replayViewerPanY = (this._replayViewerPanY || 0) + (midY - pinchPrevMidY);
          pinchPrevMidX = midX;
          pinchPrevMidY = midY;
          this.zoomReplayStageAtPoint(pinchStartZoom * (dist / pinchStartDist), midX, midY);
        } else if (isPanningStage && e.touches && e.touches.length === 1) {
          e.preventDefault();
          const t0 = e.touches[0];
          this._replayViewerPanX = panBaseX + (t0.clientX - panStartX);
          this._replayViewerPanY = panBaseY + (t0.clientY - panStartY);
          this._syncReplayFixedStageLayout();
        }
      }, { passive: false, capture: true });

      window.addEventListener('touchend', (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        e.stopPropagation();
        if (!e.touches || e.touches.length < 2) {
          isPinchingStage = false;
        }
        if (!e.touches || e.touches.length === 0) {
          isPanningStage = false;
        }
      }, { passive: true, capture: true });

      // 3. PC 마우스 드래그 패닝 (확대 상태일 때) & 더블클릭 줌 토글
      let isMousePanningStage = false;
      window.addEventListener('pointerdown', (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        if (e.pointerType === 'touch') {
          e.stopPropagation();
          return;
        }
        // 학생 영상 전용 모드이거나 재생/일시정지 중에는 스테이지 내부 클릭이 그래프/칠판을 변형시키지 않도록 보호
        e.stopPropagation();
        if (e.button === 0 && (this._replayViewerZoom || 1.0) > 1.01) {
          isMousePanningStage = true;
          panStartX = e.clientX;
          panStartY = e.clientY;
          panBaseX = this._replayViewerPanX || 0;
          panBaseY = this._replayViewerPanY || 0;
        }
      }, { capture: true });

      window.addEventListener('pointermove', (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        if (isMousePanningStage) {
          e.stopPropagation();
          this._replayViewerPanX = panBaseX + (e.clientX - panStartX);
          this._replayViewerPanY = panBaseY + (e.clientY - panStartY);
          this._syncReplayFixedStageLayout();
        }
      }, { capture: true });

      window.addEventListener('pointerup', () => {
        isMousePanningStage = false;
      }, { capture: true });

      window.addEventListener('click', (e) => {
        if (!this._isFixedReplayStageActive() && !this.isStudentAudioVideoOnlyMode && !this._isAudioReplayActive) return;
        if (isOuterReplayControl(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
      }, { capture: true });

      window.addEventListener('dblclick', (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        const targetZ = (this._replayViewerZoom || 1.0) > 1.15 ? 1.0 : 2.0;
        this.zoomReplayStageAtPoint(targetZ, e.clientX, e.clientY);
      }, { capture: true });
    }

    _interpolatePipSnapForAudio(snapA, snapB, alpha, lerp) {
      if (!snapA || typeof snapA !== 'object') return snapA;
      if (!snapB || typeof snapB !== 'object') return snapA;
      const mergedSnap = JSON.parse(JSON.stringify(snapA));
      const isDiscreteJump = (((snapA.graphs && snapA.graphs.length) || 0) !== ((snapB.graphs && snapB.graphs.length) || 0));
      if (!isDiscreteJump) {
        mergedSnap.panX = lerp(snapA.panX || 0, snapB.panX || 0);
        mergedSnap.panY = lerp(snapA.panY || 0, snapB.panY || 0);
        mergedSnap.zoomLevel = lerp(snapA.zoomLevel || 1.0, snapB.zoomLevel || 1.0);
        mergedSnap.xSpan = lerp(snapA.xSpan || 8.5, snapB.xSpan || 8.5);
        mergedSnap.ySpan = lerp(snapA.ySpan || 6.0, snapB.ySpan || 6.0);
      }
      if (typeof snapA.aspect === 'number' && typeof snapB.aspect === 'number') {
        mergedSnap.aspect = lerp(snapA.aspect, snapB.aspect);
      }
      if (typeof snapA._pipCardW === 'number' && typeof snapB._pipCardW === 'number') {
        mergedSnap._pipCardW = lerp(snapA._pipCardW, snapB._pipCardW);
      }
      if (typeof snapA._pipCardH === 'number' && typeof snapB._pipCardH === 'number') {
        mergedSnap._pipCardH = lerp(snapA._pipCardH, snapB._pipCardH);
      }
      mergedSnap.periodicStepY = lerp(snapA.periodicStepY || 0, snapB.periodicStepY || 0);
      if (
        Array.isArray(snapA.piecewiseBoundaries) &&
        Array.isArray(snapB.piecewiseBoundaries) &&
        snapA.piecewiseBoundaries.length === snapB.piecewiseBoundaries.length
      ) {
        mergedSnap.piecewiseBoundaries = snapA.piecewiseBoundaries.map((v, i) => lerp(v, snapB.piecewiseBoundaries[i]));
      }
      if (
        Array.isArray(snapA.graphs) &&
        Array.isArray(snapB.graphs) &&
        snapA.graphs.length === snapB.graphs.length
      ) {
        for (let gIdx = 0; gIdx < mergedSnap.graphs.length; gIdx++) {
          const gA = snapA.graphs[gIdx];
          const gB = snapB.graphs[gIdx];
          const gM = mergedSnap.graphs[gIdx];
          if (!gA || !gB || gA.type !== gB.type) continue;
          // 절댓값 단계 변경(접기/펴기) 또는 대칭 이동([↕ x축 | ↔ y축 | ⤡ 원점]) 버튼 클릭과 같은 불연속 이벤트에서는
          // 클릭 전 구간에서 곡선이 미리 찌그러지며 보간되지 않도록, 실제 핸들/곡선 드래그 중일 때만 연속 보간!
          const isContinuousPipDrag = Boolean(
            snapA.draggedHandleIdx !== null ||
            snapB.draggedHandleIdx !== null ||
            snapA._isDraggingCurve ||
            snapB._isDraggingCurve
          );
          const sameAbsStage = (
            Boolean(gA.isTransposedYX) === Boolean(gB.isTransposedYX) &&
            Boolean(gA.isAbsolute) === Boolean(gB.isAbsolute) &&
            ((gA.transforms && gA.transforms.length) || 0) === ((gB.transforms && gB.transforms.length) || 0)
          );
          if (!isContinuousPipDrag || !sameAbsStage) continue;
          if (gA.freezeOffset && gB.freezeOffset) {
            gM.freezeOffset = {
              x: lerp(gA.freezeOffset.x || 0, gB.freezeOffset.x || 0),
              y: lerp(gA.freezeOffset.y || 0, gB.freezeOffset.y || 0)
            };
          }
          if (Array.isArray(gA.transforms) && Array.isArray(gB.transforms) && gA.transforms.length === gB.transforms.length) {
            for (let tIdx = 0; tIdx < gM.transforms.length; tIdx++) {
              const tA = gA.transforms[tIdx];
              const tB = gB.transforms[tIdx];
              if (tA && tB && tA.offset && tB.offset) {
                gM.transforms[tIdx].offset = {
                  x: lerp(tA.offset.x || 0, tB.offset.x || 0),
                  y: lerp(tA.offset.y || 0, tB.offset.y || 0)
                };
              }
            }
          }
          if (Array.isArray(gA.handles) && Array.isArray(gB.handles) && gA.handles.length === gB.handles.length) {
            for (let hIdx = 0; hIdx < gM.handles.length; hIdx++) {
              gM.handles[hIdx].x = lerp(gA.handles[hIdx].x, gB.handles[hIdx].x);
              gM.handles[hIdx].y = lerp(gA.handles[hIdx].y, gB.handles[hIdx].y);
            }
          }
        }
      }
      return mergedSnap;
    }

    _interpolateAudioWorkspaceKeyframes(kfA, kfB, alpha) {
      if (!kfA) return kfB;
      if (!kfB || alpha <= 0) return kfA;
      if (alpha >= 1) return kfB;
      if (Boolean(kfA.isGraphCovered) !== Boolean(kfB.isGraphCovered)) return kfA;

      const merged = JSON.parse(JSON.stringify(kfA));
      const lerp = (a, b) => (typeof a === 'number' && typeof b === 'number') ? (a + (b - a) * alpha) : a;

      // 서랍 열림/닫힘, 그래프 추가/삭제, 삼각함수 화각 전환 등 메뉴 클릭에 의한 불연속 카메라 리셋 시에는
      // 클릭 전 구간에서 카메라(panX, zoomLevel, xSpan)가 미리 미끄러져 포인터 투영 좌표가 튀는 현상을 원천 차단!
      const isDiscreteMenuCameraJump = (
        Boolean(kfA.drawerOpen) !== Boolean(kfB.drawerOpen) ||
        ((kfA.graphs && kfA.graphs.length) || 0) !== ((kfB.graphs && kfB.graphs.length) || 0) ||
        (kfA.xSpan || 8.5) !== (kfB.xSpan || 8.5) ||
        (kfA.ySpan || 6.0) !== (kfB.ySpan || 6.0)
      );
      if (!isDiscreteMenuCameraJump) {
        merged.panX = lerp(kfA.panX, kfB.panX);
        merged.panY = lerp(kfA.panY, kfB.panY);
        merged.zoomLevel = lerp(kfA.zoomLevel, kfB.zoomLevel);
        merged.xSpan = lerp(kfA.xSpan || 8.5, kfB.xSpan || 8.5);
        merged.ySpan = lerp(kfA.ySpan || 6.0, kfB.ySpan || 6.0);
      }
      merged.boardPanX = lerp(kfA.boardPanX, kfB.boardPanX);
      merged.boardPanY = lerp(kfA.boardPanY, kfB.boardPanY);
      merged.boardZoom = lerp(kfA.boardZoom, kfB.boardZoom);
      merged.boardZoomOffsetX = lerp(kfA.boardZoomOffsetX || 0, kfB.boardZoomOffsetX || 0);
      merged.boardZoomOffsetY = lerp(kfA.boardZoomOffsetY || 0, kfB.boardZoomOffsetY || 0);
      merged.probCardBaseX = lerp(kfA.probCardBaseX, kfB.probCardBaseX);
      merged.probCardBaseY = lerp(kfA.probCardBaseY, kfB.probCardBaseY);
      merged.probCardW = lerp(kfA.probCardW || 520, kfB.probCardW || 520);
      merged.graphCardBaseX = lerp(kfA.graphCardBaseX, kfB.graphCardBaseX);
      merged.graphCardBaseY = lerp(kfA.graphCardBaseY, kfB.graphCardBaseY);
      merged.graphCardW = lerp(kfA.graphCardW || 260, kfB.graphCardW || 260);
      if (typeof kfA.graphCardAspect === 'number' && typeof kfB.graphCardAspect === 'number') {
        merged.graphCardAspect = lerp(kfA.graphCardAspect, kfB.graphCardAspect);
      }
      if (kfA.graphCardPipSnap && kfB.graphCardPipSnap) {
        merged.graphCardPipSnap = this._interpolatePipSnapForAudio(kfA.graphCardPipSnap, kfB.graphCardPipSnap, alpha, lerp);
      }
      merged.pillRemoteLeft = lerp(kfA.pillRemoteLeft || 605, kfB.pillRemoteLeft || 605);
      merged.pillRemoteTop = lerp(kfA.pillRemoteTop || 76, kfB.pillRemoteTop || 76);
      if (typeof kfA.pillRemoteNormX === 'number' && typeof kfB.pillRemoteNormX === 'number') {
        merged.pillRemoteNormX = lerp(kfA.pillRemoteNormX, kfB.pillRemoteNormX);
      }
      if (typeof kfA.pillRemoteNormY === 'number' && typeof kfB.pillRemoteNormY === 'number') {
        merged.pillRemoteNormY = lerp(kfA.pillRemoteNormY, kfB.pillRemoteNormY);
      }
      if (typeof kfA.pillRemoteRightGap === 'number' && typeof kfB.pillRemoteRightGap === 'number') {
        merged.pillRemoteRightGap = lerp(kfA.pillRemoteRightGap, kfB.pillRemoteRightGap);
      }
      merged.periodicStepY = lerp(kfA.periodicStepY || 0, kfB.periodicStepY || 0);
      if (Array.isArray(kfA.extraGraphStates) && Array.isArray(kfB.extraGraphStates) && kfA.extraGraphStates.length === kfB.extraGraphStates.length) {
        merged.extraGraphStates = kfA.extraGraphStates.map((stA, idx) => {
          const stB = kfB.extraGraphStates[idx] || stA;
          return {
            ...stA,
            baseX: lerp(stA.baseX, stB.baseX),
            baseY: lerp(stA.baseY, stB.baseY),
            w: lerp(stA.w || 260, stB.w || 260),
            aspect: (typeof stA.aspect === 'number' && typeof stB.aspect === 'number') ? lerp(stA.aspect, stB.aspect) : stA.aspect,
            pipSnap: (stA.pipSnap && stB.pipSnap) ? this._interpolatePipSnapForAudio(stA.pipSnap, stB.pipSnap, alpha, lerp) : stA.pipSnap
          };
        });
      }
      if (Array.isArray(kfA.extraProbStates) && Array.isArray(kfB.extraProbStates) && kfA.extraProbStates.length === kfB.extraProbStates.length) {
        merged.extraProbStates = kfA.extraProbStates.map((stA, idx) => {
          const stB = kfB.extraProbStates[idx] || stA;
          return {
            ...stA,
            baseX: lerp(stA.baseX, stB.baseX),
            baseY: lerp(stA.baseY, stB.baseY),
            w: lerp(stA.w || 480, stB.w || 480)
          };
        });
      }
      if (kfA.snapDragRect && kfB.snapDragRect) {
        merged.snapDragRect = {
          ...kfA.snapDragRect,
          x1: lerp(kfA.snapDragRect.x1, kfB.snapDragRect.x1),
          y1: lerp(kfA.snapDragRect.y1, kfB.snapDragRect.y1),
          x2: lerp(kfA.snapDragRect.x2, kfB.snapDragRect.x2),
          y2: lerp(kfA.snapDragRect.y2, kfB.snapDragRect.y2),
          nx1: lerp(kfA.snapDragRect.nx1, kfB.snapDragRect.nx1),
          ny1: lerp(kfA.snapDragRect.ny1, kfB.snapDragRect.ny1),
          nx2: lerp(kfA.snapDragRect.nx2, kfB.snapDragRect.nx2),
          ny2: lerp(kfA.snapDragRect.ny2, kfB.snapDragRect.ny2),
          mx1: lerp(kfA.snapDragRect.mx1, kfB.snapDragRect.mx1),
          my1: lerp(kfA.snapDragRect.my1, kfB.snapDragRect.my1),
          mx2: lerp(kfA.snapDragRect.mx2, kfB.snapDragRect.mx2),
          my2: lerp(kfA.snapDragRect.my2, kfB.snapDragRect.my2)
        };
      }
      if (kfA.stickerDraft && kfB.stickerDraft && Boolean(kfA.stickerDraft.isBoard) === Boolean(kfB.stickerDraft.isBoard)) {
        merged.stickerDraft = {
          ...kfA.stickerDraft,
          x1: lerp(kfA.stickerDraft.x1, kfB.stickerDraft.x1),
          y1: lerp(kfA.stickerDraft.y1, kfB.stickerDraft.y1),
          x2: lerp(kfA.stickerDraft.x2, kfB.stickerDraft.x2),
          y2: lerp(kfA.stickerDraft.y2, kfB.stickerDraft.y2)
        };
      }
      if (kfA.cardStickerDraft && kfB.cardStickerDraft && kfA.cardStickerDraft.cardKey === kfB.cardStickerDraft.cardKey) {
        merged.cardStickerDraft = {
          ...kfA.cardStickerDraft,
          nx: lerp(kfA.cardStickerDraft.nx, kfB.cardStickerDraft.nx),
          ny: lerp(kfA.cardStickerDraft.ny, kfB.cardStickerDraft.ny),
          nw: lerp(kfA.cardStickerDraft.nw, kfB.cardStickerDraft.nw),
          nh: lerp(kfA.cardStickerDraft.nh, kfB.cardStickerDraft.nh)
        };
      }

      if (
        Array.isArray(kfA.piecewiseBoundaries) &&
        Array.isArray(kfB.piecewiseBoundaries) &&
        kfA.piecewiseBoundaries.length === kfB.piecewiseBoundaries.length
      ) {
        merged.piecewiseBoundaries = kfA.piecewiseBoundaries.map((v, i) => lerp(v, kfB.piecewiseBoundaries[i]));
      }

      if (
        Array.isArray(kfA.graphs) &&
        Array.isArray(kfB.graphs) &&
        kfA.graphs.length === kfB.graphs.length
      ) {
        for (let gIdx = 0; gIdx < merged.graphs.length; gIdx++) {
          const gA = kfA.graphs[gIdx];
          const gB = kfB.graphs[gIdx];
          const gM = merged.graphs[gIdx];
          if (!gA || !gB || gA.type !== gB.type) continue;
          const sameAbsStage = (
            Boolean(gA.isTransposedYX) === Boolean(gB.isTransposedYX) &&
            Boolean(gA.isAbsolute) === Boolean(gB.isAbsolute) &&
            ((gA.transforms && gA.transforms.length) || 0) === ((gB.transforms && gB.transforms.length) || 0)
          );
          if (!sameAbsStage) continue;
          if (gA.freezeOffset && gB.freezeOffset) {
            gM.freezeOffset = {
              x: lerp(gA.freezeOffset.x || 0, gB.freezeOffset.x || 0),
              y: lerp(gA.freezeOffset.y || 0, gB.freezeOffset.y || 0)
            };
          }
          if (Array.isArray(gA.transforms) && Array.isArray(gB.transforms) && gA.transforms.length === gB.transforms.length) {
            for (let tIdx = 0; tIdx < gM.transforms.length; tIdx++) {
              const tA = gA.transforms[tIdx];
              const tB = gB.transforms[tIdx];
              if (tA && tB && tA.offset && tB.offset) {
                gM.transforms[tIdx].offset = {
                  x: lerp(tA.offset.x || 0, tB.offset.x || 0),
                  y: lerp(tA.offset.y || 0, tB.offset.y || 0)
                };
              }
            }
          }
          if (Array.isArray(gA.handles) && Array.isArray(gB.handles) && gA.handles.length === gB.handles.length) {
            for (let hIdx = 0; hIdx < gM.handles.length; hIdx++) {
              gM.handles[hIdx].x = lerp(gA.handles[hIdx].x, gB.handles[hIdx].x);
              gM.handles[hIdx].y = lerp(gA.handles[hIdx].y, gB.handles[hIdx].y);
            }
          }
        }
      }
      return merged;
    }

    _applyAudioTimelineStateAt(playMs) {
      if (!this.audioSyncData) return;
      this._expandAudioSyncData(this.audioSyncData);
      let prevEv = this.audioSyncData.initialState ? { t: 0, state: this.audioSyncData.initialState } : null;
      let nextEv = null;
      const timeline = this.audioSyncData.timeline || [];
      for (let i = 0; i < timeline.length; i++) {
        const ev = timeline[i];
        if (ev && ev.type === 'state' && ev.state) {
          if (ev.t <= playMs) {
            prevEv = ev;
          } else {
            nextEv = ev;
            break;
          }
        }
      }
      if (prevEv && nextEv && (nextEv.t - prevEv.t) > 0 && (nextEv.t - prevEv.t) <= 450) {
        const alpha = Math.max(0, Math.min(1, (playMs - prevEv.t) / (nextEv.t - prevEv.t)));
        const interpState = this._interpolateAudioWorkspaceKeyframes(prevEv.state, nextEv.state, alpha);
        this._lastAppliedAudioStateObj = null;
        this._applyAudioWorkspaceKeyframe(interpState);
      } else if (prevEv && prevEv.state) {
        if (this._lastAppliedAudioStateObj !== prevEv.state) {
          this._lastAppliedAudioStateObj = prevEv.state;
          this._applyAudioWorkspaceKeyframe(prevEv.state);
        }
      }
    }

    _projectCanvasCursorAtEventCamera(ev) {
      if (!ev) return null;
      let kf = null;
      if (this.audioSyncData && typeof ev.t === 'number') {
        kf = this.audioSyncData.initialState || null;
        const timeline = this.audioSyncData.timeline || [];
        for (let i = 0; i < timeline.length; i++) {
          const item = timeline[i];
          if (!item || item.type !== 'state' || !item.state) continue;
          if (item.t <= ev.t + 40) {
            kf = item.state;
          } else {
            break;
          }
        }
      }
      if (typeof ev.bx === 'number' && typeof ev.by === 'number') {
        const bz = (kf && typeof kf.boardZoom === 'number') ? kf.boardZoom : (this.boardZoom || 1.0);
        const bPanX = (kf && typeof kf.boardPanX === 'number') ? kf.boardPanX : (this.boardPanX || 0);
        const bPanY = (kf && typeof kf.boardPanY === 'number') ? kf.boardPanY : (this.boardPanY || 0);
        const bOffX = (kf && typeof kf.boardZoomOffsetX === 'number') ? kf.boardZoomOffsetX : (this.boardZoomOffsetX || 0);
        const bOffY = (kf && typeof kf.boardZoomOffsetY === 'number') ? kf.boardZoomOffsetY : (this.boardZoomOffsetY || 0);
        return {
          x: ev.bx * bz + bOffX + bPanX,
          y: ev.by * bz + bOffY + bPanY
        };
      }
      if (typeof ev.mx === 'number' && typeof ev.my === 'number') {
        const panX = (kf && typeof kf.panX === 'number') ? kf.panX : (this.panX || 0);
        const panY = (kf && typeof kf.panY === 'number') ? kf.panY : (this.panY || 0);
        const zoomLevel = (kf && typeof kf.zoomLevel === 'number' && kf.zoomLevel > 0) ? kf.zoomLevel : (this.zoomLevel || 1.0);
        const xSpan = (kf && typeof kf.xSpan === 'number' && kf.xSpan > 0) ? kf.xSpan : (this.xSpan || 8.5);
        const ySpan = (kf && typeof kf.ySpan === 'number' && kf.ySpan > 0) ? kf.ySpan : (this.ySpan || 6.0);
        const sw = this.screenWidth || window.innerWidth || 1280;
        const sh = this.screenHeight || window.innerHeight || 720;
        const cx = sw / 2 + panX;
        const cy = sh / 2 + panY;
        const effSpanY = ySpan / zoomLevel;
        const unitScale = (sh / 2) / effSpanY;
        const scaleX = this.lockAspect ? unitScale : ((sw / 2) / (xSpan / zoomLevel));
        const scaleY = unitScale;
        return {
          x: cx + ev.mx * scaleX,
          y: cy - ev.my * scaleY
        };
      }
      return { x: ev.x, y: ev.y };
    }

    _resolveCursorEventScreenPos(ev) {
      if (!ev) return null;
      if (ev.uiScreen) {
        // 고정 비율 스테이지(stageW × stageH)가 촬영 당시 해상도와 1:1로 일치하는 경우
        // 원본 화면 좌표(ev.x, ev.y)가 모든 UI 바와 버튼 위에서 1px 오차 없이 정확히 일치!
        if (this._isFixedReplayStageActive() && this.audioSyncData && this.audioSyncData.stageW && this.audioSyncData.stageH) {
          return { x: ev.x, y: ev.y };
        }
        // 좌측 독(#railDock)과 서랍(#railDrawer)은 좌상단 고정 픽셀(left: 18px/66px, top: 18px) 위치이므로
        // 원본 화면 좌표(ev.x, ev.y)를 그대로 사용하여 서랍 오픈/버튼-여백 간 점프를 원천 차단
        if (ev.uiBarId === 'railDrawer' || ev.uiBarId === 'railDock' || ev.uiBarId === 'sidebarRail') {
          return { x: ev.x, y: ev.y };
        }
        if (ev.uiBtnKey) {
          const btnEl = this._findAudioUiButtonByKey(ev.uiBtnKey, ev.uiBarId);
          if (btnEl && typeof btnEl.getBoundingClientRect === 'function') {
            const r = this._getStageElementRect(btnEl);
            if (r && r.width > 2 && r.height > 2 && r.left >= -2 && r.top >= -2 && r.right > 0 && r.bottom > 0) {
              const bnx = typeof ev.bnx === 'number' ? ev.bnx : 0.5;
              const bny = typeof ev.bny === 'number' ? ev.bny : 0.5;
              const pos = {
                x: r.left + bnx * r.width,
                y: r.top + bny * r.height
              };
              ev._lastResolvedPos = pos;
              return pos;
            }
          }
        }
        if (ev.uiBarId && typeof ev.unx === 'number' && typeof ev.uny === 'number') {
          const barEl = document.getElementById(ev.uiBarId);
          if (barEl && typeof barEl.getBoundingClientRect === 'function') {
            const br = this._getStageElementRect(barEl);
            if (br && br.width > 2 && br.height > 2 && br.left >= -2 && br.top >= -2 && br.right > 0 && br.bottom > 0) {
              const pos = {
                x: br.left + ev.unx * br.width,
                y: br.top + ev.uny * br.height
              };
              ev._lastResolvedPos = pos;
              return pos;
            }
          }
        }
        if (ev._lastResolvedPos) {
          return ev._lastResolvedPos;
        }
        return { x: ev.x, y: ev.y };
      }
      if (ev.cardKey && typeof ev.nx === 'number' && typeof ev.ny === 'number') {
        const cardEl = this.getCardElementByAudioKey(ev.cardKey);
        if (cardEl && cardEl.style.display !== 'none' && !cardEl.classList.contains('minimized')) {
          const bodyEl = cardEl.querySelector('.problem-card-body');
          if (bodyEl) {
            const r = this._getStageElementRect(bodyEl);
            if (r && r.width > 0 && r.height > 0) {
              return {
                x: r.left + ev.nx * r.width,
                y: r.top + ev.ny * r.height
              };
            }
          }
        }
      }
      return this._projectCanvasCursorAtEventCamera(ev);
    }

    _getInterpolatedCursorAt(playMs) {
      if (!this.audioSyncData || !Array.isArray(this.audioSyncData.timeline)) return null;
      this._expandAudioSyncData(this.audioSyncData);
      const timeline = this.audioSyncData.timeline;
      let prev = null;
      let next = null;
      for (let i = 0; i < timeline.length; i++) {
        const ev = timeline[i];
        if (!ev || ev.type !== 'cursor') continue;
        if (ev.t <= playMs) {
          prev = ev;
        } else {
          next = ev;
          break;
        }
      }
      if (!prev && !next) return null;
      if (prev && prev.hidden) return null;
      if (prev && next && next.hidden) {
        const p1 = this._resolveCursorEventScreenPos(prev);
        if (!p1) return null;
        return {
          x: p1.x,
          y: p1.y,
          color: prev.color || '#00d2d3',
          isDrawing: Boolean(prev.isDrawing),
          isLaser: Boolean(prev.isLaser),
          cursorKind: prev.cursorKind || (prev.isLaser ? 'laser' : 'pen'),
          uiScreen: Boolean(prev.uiScreen),
          uiBarId: prev.uiBarId || '',
          uiBtnKey: prev.uiBtnKey || ''
        };
      }
      if (prev && next && (next.t - prev.t) <= 800) {
        const p1 = this._resolveCursorEventScreenPos(prev);
        const p2 = this._resolveCursorEventScreenPos(next);
        if (!p1 || !p2) return null;
        const alpha = Math.max(0, Math.min(1, (playMs - prev.t) / Math.max(1, next.t - prev.t)));
        const activeMetaEv = (alpha > 0.72 && next.uiScreen) ? next : prev;
        return {
          x: p1.x + (p2.x - p1.x) * alpha,
          y: p1.y + (p2.y - p1.y) * alpha,
          color: prev.color || '#00d2d3',
          isDrawing: Boolean(prev.isDrawing),
          isLaser: Boolean(prev.isLaser),
          cursorKind: activeMetaEv.cursorKind || prev.cursorKind || (prev.isLaser ? 'laser' : 'pen'),
          uiScreen: Boolean(activeMetaEv.uiScreen || prev.uiScreen),
          uiBarId: activeMetaEv.uiBarId || prev.uiBarId || '',
          uiBtnKey: activeMetaEv.uiBtnKey || (alpha < 0.85 ? (prev.uiBtnKey || '') : '')
        };
      }
      if (prev && Math.abs(playMs - prev.t) <= 600) {
        const p1 = this._resolveCursorEventScreenPos(prev);
        if (!p1) return null;
        return {
          x: p1.x,
          y: p1.y,
          color: prev.color || '#00d2d3',
          isDrawing: Boolean(prev.isDrawing),
          isLaser: Boolean(prev.isLaser),
          cursorKind: prev.cursorKind || (prev.isLaser ? 'laser' : 'pen'),
          uiScreen: Boolean(prev.uiScreen),
          uiBarId: prev.uiBarId || '',
          uiBtnKey: prev.uiBtnKey || ''
        };
      }
      return null;
    }

    _renderAudioReplayCardLasers(playMs) {
      const allCardEls = [
        document.getElementById('problemCardWidget'),
        ...((this.extraProblemCards || []).map(c => c && c.el)),
        document.getElementById('graphCardWidget'),
        ...((this.extraGraphCards || []).map(c => c && c.el))
      ].filter(Boolean);

      const laserStrokes = (this.audioSyncData && Array.isArray(this.audioSyncData.laserStrokes))
        ? this.audioSyncData.laserStrokes
        : [];

      const FADE_MS = 750;
      const HOLD_MS = 1650;

      allCardEls.forEach(cardEl => {
        const bodyEl = cardEl.querySelector('.problem-card-body');
        const laserCanvas = bodyEl ? bodyEl.querySelector('.card-laser-canvas') : null;
        if (!bodyEl || !laserCanvas) return;
        const cardKey = this.getAudioCardKey(cardEl);
        const syncFn = cardEl._syncCardLaserSize;
        const { w, h, dpr } = (typeof syncFn === 'function')
          ? syncFn()
          : { w: Math.max(1, bodyEl.clientWidth || 520), h: Math.max(1, bodyEl.clientHeight || 360), dpr: window.devicePixelRatio || 2 };

        const ctx = laserCanvas.getContext('2d');
        if (!ctx) return;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const cardLasers = laserStrokes.filter(ls => ls && ls.cardKey === cardKey);
        for (let i = 0; i < cardLasers.length; i++) {
          const ls = cardLasers[i];
          const tStart = ls.tStart || 0;
          const tEnd = (typeof ls.tEnd === 'number' && ls.tEnd >= tStart) ? ls.tEnd : (tStart + 120);
          const holdUntil = (typeof ls.holdUntil === 'number' && ls.holdUntil >= tEnd) ? ls.holdUntil : (tEnd + HOLD_MS);
          if (playMs < tStart || playMs > holdUntil + FADE_MS) continue;

          let life = 1.0;
          if (playMs > holdUntil) {
            const fadeRatio = Math.min(1, (playMs - holdUntil) / FADE_MS);
            life = Math.pow(1 - fadeRatio, 1.45);
          }
          if (life <= 0.01) continue;

          const rep = this.getPartialStrokeForReplay(ls, playMs, 'video');
          if (!rep || !rep.stroke || !rep.stroke.points || rep.stroke.points.length === 0) continue;
          const pts = rep.stroke.points;

          if (rep.isCurrentlyWriting && rep.tipPoint) {
            const r = this._getStageElementRect(bodyEl);
            if (r && r.width > 0 && r.height > 0) {
              this._activeReplayTipScreen = {
                x: r.left + rep.tipPoint.nx * r.width,
                y: r.top + rep.tipPoint.ny * r.height,
                color: '#dc2626',
                isHighlighter: false,
                isLaser: true
              };
            }
          }

          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowBlur = 0;
          ctx.globalAlpha = life;
          ctx.strokeStyle = '#dc2626';
          ctx.fillStyle = '#dc2626';
          ctx.lineWidth = 2.5;

          if (pts.length === 1) {
            ctx.beginPath();
            ctx.arc(pts[0].nx * w, pts[0].ny * h, 1.3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(pts[0].nx * w, pts[0].ny * h);
            if (pts.length === 2) {
              ctx.lineTo(pts[1].nx * w, pts[1].ny * h);
            } else {
              const firstMx = ((pts[0].nx + pts[1].nx) * 0.5) * w;
              const firstMy = ((pts[0].ny + pts[1].ny) * 0.5) * h;
              ctx.lineTo(firstMx, firstMy);
              for (let k = 1; k < pts.length - 1; k++) {
                const cx = pts[k].nx * w;
                const cy = pts[k].ny * h;
                const mx = ((pts[k].nx + pts[k + 1].nx) * 0.5) * w;
                const my = ((pts[k].ny + pts[k + 1].ny) * 0.5) * h;
                ctx.quadraticCurveTo(cx, cy, mx, my);
              }
              const last = pts[pts.length - 1];
              ctx.lineTo(last.nx * w, last.ny * h);
            }
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.restore();
      });
    }

    positionReplayVirtualStylus(screenX, screenY, color = '#00d2d3', isDrawing = true, cursorKind = 'pen') {
      if (!this.virtualStylusEl) return;
      if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;

      const kind = cursorKind || 'pen';
      const svgs = {
        pen: this.stylusPenSvg || document.getElementById('stylusPenSvg'),
        highlighter: this.stylusHighlighterSvg || document.getElementById('stylusHighlighterSvg'),
        eraser: this.stylusEraserSvg || document.getElementById('stylusEraserSvg'),
        laser: this.stylusLaserSvg || document.getElementById('stylusLaserSvg'),
        arrow: this.stylusArrowSvg || document.getElementById('stylusArrowSvg'),
        pointer: this.stylusPointerSvg || document.getElementById('stylusPointerSvg'),
        grab: this.stylusGrabSvg || document.getElementById('stylusGrabSvg'),
        grabbing: this.stylusGrabbingSvg || document.getElementById('stylusGrabbingSvg'),
        crosshair: this.stylusCrosshairSvg || document.getElementById('stylusCrosshairSvg')
      };

      Object.keys(svgs).forEach(k => {
        if (svgs[k]) {
          svgs[k].style.display = (k === kind) ? 'block' : 'none';
        }
      });
      // 폴백: 만약 해당 SVG가 없으면 기본 펜 표시
      if (!svgs[kind] && svgs.pen) {
        svgs.pen.style.display = 'block';
      }

      // 마우스 클릭 / 그래프 핸들 잡기 시작 순간 ScreenStudio 스타일 클릭 파동(Click Ripple) 발동!
      const wasDrawing = Boolean(this._prevReplayIsDrawing);
      const prevKind = this._prevReplayCursorKind || 'pen';
      if ((!wasDrawing && isDrawing && kind !== 'pen' && kind !== 'highlighter') || (prevKind !== 'grabbing' && kind === 'grabbing')) {
        const rippleEl = this.stylusClickRippleEl || document.getElementById('stylusClickRipple');
        if (rippleEl) {
          rippleEl.classList.remove('pulse-active');
          void rippleEl.offsetWidth;
          rippleEl.classList.add('pulse-active');
        }
      }
      this._prevReplayIsDrawing = Boolean(isDrawing);
      this._prevReplayCursorKind = kind;
      this._currentReplayCursorKind = kind;

      this.virtualStylusEl.style.display = 'block';
      this.virtualStylusEl.classList.toggle('drawing', Boolean(isDrawing));
      const scale = (isDrawing && (kind === 'pen' || kind === 'highlighter' || kind === 'eraser')) ? 0.94 : 1.0;
      this.virtualStylusEl.style.transform = `translate3d(${Math.round(screenX * 10) / 10}px, ${Math.round(screenY * 10) / 10}px, 0) scale(${scale})`;
    }

    // 🌟 [핵심: 선이 한꺼번에 툭 튀어나오지 않고 펜 포인터를 따라 1점씩 부드럽게 그어지는 서브프레임 보간 슬라이서] 🌟
    getPartialStrokeForReplay(stroke, playMs, viewMode = this.audioReplayViewMode) {
      if (!stroke || !stroke.points || stroke.points.length === 0) return null;
      if (stroke.preExisting || stroke.tStart === undefined || stroke.tStart === null) {
        return {
          stroke,
          isCurrentlyWriting: false,
          isActiveHighlight: false,
          tipPoint: null
        };
      }

      const tStart = stroke.tStart;
      const tEnd = (typeof stroke.tEnd === 'number' && stroke.tEnd >= tStart) ? stroke.tEnd : (tStart + 180);
      const pts = stroke.points;
      const N = pts.length;

      // 영상 재생 중 아직 쓰이지 않은 미래 필기(playMs < tStart)는 렌더링하지 않음 (렉 유발 밑그림 및 필기 터치 점프 완전 제거!)
      if (playMs < tStart) {
        return null;
      }

      // 이미 쓰기가 끝난 과거의 필기(playMs >= tEnd)는 도형 스냅(shape) 포함 100% 온전하게 표시!
      const shapeSnapMs = (typeof stroke.shapeSnapAt === 'number') ? stroke.shapeSnapAt : tEnd;
      if (playMs >= tEnd && playMs >= shapeSnapMs) {
        return {
          stroke,
          isCurrentlyWriting: false,
          isActiveHighlight: false,
          tipPoint: null
        };
      }

      // 현재 선생님이 한 획 한 획 쓰고 있는 중인 스트로크 (tStart <= playMs < tEnd):
      // 점 배열을 playMs 시점까지만 슬라이싱하고, 인접한 두 점 사이를 선형 보간(Sub-frame Linear Interpolation)하여
      // 직선이든 곡선이든 숫자든 펜 끝을 따라 60~144fps로 매끄럽게 뻗어나가도록 생성!
      if (N === 1) {
        return {
          stroke: { ...stroke, shape: null, isShape: false },
          isCurrentlyWriting: true,
          isActiveHighlight: true,
          tipPoint: pts[0]
        };
      }

      const spanTotal = Math.max(1, tEnd - tStart);
      const getPtTime = (idx) => {
        const pt = pts[idx];
        if (pt && typeof pt.t === 'number') return pt.t;
        return tStart + spanTotal * (idx / (N - 1));
      };

      const slicedPts = [pts[0]];
      let interpTip = pts[0];

      for (let i = 0; i < N - 1; i++) {
        const pA = pts[i];
        const pB = pts[i + 1];
        const tA = getPtTime(i);
        const tB = Math.max(tA, getPtTime(i + 1));

        if (playMs >= tB) {
          slicedPts.push(pB);
          interpTip = pB;
          if (playMs === tB) break;
        } else if (playMs > tA) {
          const segSpan = Math.max(1, tB - tA);
          const alpha = Math.max(0, Math.min(1, (playMs - tA) / segSpan));
          if (pA.nx !== undefined) {
            interpTip = {
              nx: pA.nx + (pB.nx - pA.nx) * alpha,
              ny: pA.ny + (pB.ny - pA.ny) * alpha,
              p: (pA.p !== undefined ? pA.p : 0.5) + ((pB.p !== undefined ? pB.p : 0.5) - (pA.p !== undefined ? pA.p : 0.5)) * alpha,
              t: playMs
            };
          } else {
            interpTip = {
              x: pA.x + (pB.x - pA.x) * alpha,
              y: pA.y + (pB.y - pA.y) * alpha,
              p: (pA.p !== undefined ? pA.p : 0.5) + ((pB.p !== undefined ? pB.p : 0.5) - (pA.p !== undefined ? pA.p : 0.5)) * alpha,
              t: playMs
            };
          }
          slicedPts.push(interpTip);
          break;
        } else {
          break;
        }
      }

      // Draw & Hold 도형인 경우 shapeSnapMs에 도달하기 전까지는 손으로 그리는 궤적을 보여주고, 도달 순간 도형으로 스냅!
      const useSnappedShape = Boolean((stroke.shape || stroke.cardShape) && playMs >= shapeSnapMs);
      return {
        stroke: {
          ...stroke,
          points: slicedPts,
          shape: useSnappedShape ? stroke.shape : null,
          cardShape: useSnappedShape ? stroke.cardShape : null,
          isShape: useSnappedShape
        },
        isCurrentlyWriting: true,
        isActiveHighlight: true,
        tipPoint: interpTip
      };
    }

    _drawAudioReplayInkStrokes(ctx, filterTarget = null) {
      const playMs = this.audioPlayCurrentMs || 0;
      const viewMode = this.audioReplayViewMode || 'video';
      const activeErased = (viewMode === 'video' && this.audioSyncData && Array.isArray(this.audioSyncData.erasedStrokes))
        ? this.audioSyncData.erasedStrokes.filter(st => st && (typeof st.erasedAt !== 'number' || playMs < st.erasedAt))
        : [];
      const baseStrokes = [...(this.inkStrokes || []), ...activeErased];
      if (baseStrokes.length === 0) return;

      const candidates = filterTarget
        ? baseStrokes.filter(s => {
          if (!s) return false;
          const t = s.target || 'board';
          if (t !== filterTarget) return false;
          if (t === 'graph' && Boolean(s.onPdfBoard) !== Boolean(this.pdfPageBoardData)) return false;
          return true;
        })
        : baseStrokes.filter(Boolean);

      const completedReps = [];
      const writingReps = [];
      for (let i = 0; i < candidates.length; i++) {
        const rep = this.getPartialStrokeForReplay(candidates[i], playMs, viewMode);
        if (!rep || !rep.stroke) continue;
        if (rep.isCurrentlyWriting) {
          writingReps.push(rep);
          if (rep.tipPoint) {
            const isBoardInk = (rep.stroke.target || 'board') === 'board';
            const tipScreen = isBoardInk
              ? this.boardToScreen(rep.tipPoint.x, rep.tipPoint.y)
              : this.mathToScreen(rep.tipPoint.x, rep.tipPoint.y);
            this._activeReplayTipScreen = {
              x: tipScreen.x,
              y: tipScreen.y,
              color: rep.stroke.color || '#00d2d3',
              isHighlighter: Boolean(rep.stroke.isHighlighter)
            };
          }
        } else {
          completedReps.push(rep);
        }
      }

      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
      const isLight = curTheme.isLight || this.isMonochromeMode;
      const drawRepsBatch = (targetCtx, repsList) => {
        if (!repsList || repsList.length === 0) return;
        repsList.filter(r => r.stroke.isHighlighter).forEach(r => {
          this.renderSingleStroke(targetCtx, r.stroke, null, false);
        });
        repsList.filter(r => !r.stroke.isHighlighter).forEach(r => {
          this.renderSingleStroke(targetCtx, r.stroke, null, false);
        });
        if ((!filterTarget || filterTarget === 'board') && this.hasActiveProblemCard() && !isLight && !this.isMonochromeMode && this.problemCardRect) {
          const r = this.problemCardRect;
          const whiteReps = repsList.filter(item => {
            const s = item.stroke;
            if (!s || (s.target || 'board') !== 'board') return false;
            const c = (s.color || '').toLowerCase();
            return (c === '#ffffff' || c === '#fff');
          });
          if (whiteReps.length > 0) {
            targetCtx.save();
            targetCtx.beginPath();
            targetCtx.rect(r.x, r.y, r.w, r.h);
            targetCtx.clip();
            whiteReps.forEach(item => this.renderSingleStroke(targetCtx, item.stroke, '#0f172a', false));
            targetCtx.restore();
          }
        }
      };

      // 🌟 [리플레이 오프스크린 베이크 캐시]: 메인 캔버스와 100% 동일한 초고해상도 DPR(getCanvasDpr = 2.0~2.5x) 및 타깃별 독립 버퍼로 쓰기 완료 후에도 화질 저하 0%!
      if (ctx === this.ctx && completedReps.length > 0) {
        const targetSlot = filterTarget || 'all';
        const pRectKey = this.problemCardRect
          ? `${Math.round(this.problemCardRect.x)},${Math.round(this.problemCardRect.y)},${Math.round(this.problemCardRect.w)},${Math.round(this.problemCardRect.h)}`
          : 'none';
        const dpr = this.getCanvasDpr();
        const bw = (this.canvas && this.canvas.width > 0) ? this.canvas.width : Math.max(1, Math.round(this.screenWidth * dpr));
        const bh = (this.canvas && this.canvas.height > 0) ? this.canvas.height : Math.max(1, Math.round(this.screenHeight * dpr));
        const bakeKey = [
          targetSlot,
          completedReps.length,
          activeErased.length,
          Boolean(this.pdfPageBoardData),
          Math.round((this.panX || 0) * 10),
          Math.round((this.panY || 0) * 10),
          Math.round((this.zoomLevel || 1) * 1000),
          Math.round((this.boardPanX || 0) * 10),
          Math.round((this.boardPanY || 0) * 10),
          Math.round((this.boardZoom || 1) * 1000),
          bw,
          bh,
          this.currentThemeKey,
          Boolean(this.isMonochromeMode),
          pRectKey
        ].join('|');

        if (!this._replayInkBakeMap) {
          this._replayInkBakeMap = {};
        }
        if (!this._replayInkBakeMap[targetSlot]) {
          this._replayInkBakeMap[targetSlot] = {
            canvas: document.createElement('canvas'),
            key: ''
          };
        }
        const bakeEntry = this._replayInkBakeMap[targetSlot];
        const bakeCanvas = bakeEntry.canvas;

        if (bakeCanvas.width !== bw || bakeCanvas.height !== bh) {
          bakeCanvas.width = bw;
          bakeCanvas.height = bh;
          bakeEntry.key = '';
        }
        if (bakeEntry.key !== bakeKey) {
          const bCtx = bakeCanvas.getContext('2d');
          if (bCtx) {
            bCtx.save();
            bCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            bCtx.clearRect(0, 0, this.screenWidth, this.screenHeight);
            drawRepsBatch(bCtx, completedReps);
            bCtx.restore();
            bakeEntry.key = bakeKey;
          }
        }
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(bakeCanvas, 0, 0);
        ctx.restore();
      } else {
        drawRepsBatch(ctx, completedReps);
      }

      // 현재 실시간으로 쓰이고 있는 중인 단 1개의 획만 매 프레임 라이브로 렌더링!
      drawRepsBatch(ctx, writingReps);
    }

    _getActiveAudioSegmentAt(playMs) {
      if (!this.audioSyncData) return null;
      const segs = (Array.isArray(this.audioSyncData.audioSegments) && this.audioSyncData.audioSegments.length > 0)
        ? this.audioSyncData.audioSegments
        : null;
      if (!segs) {
        return this.audioSyncData.audioDataUrl ? {
          idx: 0,
          startMs: 0,
          endMs: this.audioSyncData.durationMs || 1000,
          durationMs: this.audioSyncData.durationMs || 1000,
          audioDataUrl: this.audioSyncData.audioDataUrl,
          nextSlideIdx: null,
          nextSlideStartMs: 0
        } : null;
      }
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (!s) continue;
        if (playMs < s.endMs || i === segs.length - 1) {
          return { ...s, idx: i };
        }
      }
      return null;
    }

    _syncAudioPlayerToPlayMs(playMs, shouldPlay = false) {
      if (!this.audioSyncData) return null;
      if (!this.audioPlayerEl) {
        this.audioPlayerEl = new Audio();
        this.audioPlayerEl.preload = 'auto';
      }
      const seg = this._getActiveAudioSegmentAt(playMs);
      if (!seg || !seg.audioDataUrl) return seg;
      const segChanged = (this._activeAudioSegmentIdx !== seg.idx || this.audioPlayerEl.src !== seg.audioDataUrl);
      if (segChanged) {
        this._activeAudioSegmentIdx = seg.idx;
        this.audioPlayerEl.src = seg.audioDataUrl;
      }
      try {
        this.audioPlayerEl.playbackRate = this.audioPlaybackRate || 1.0;
      } catch (e) { }
      const localSec = Math.max(0, (playMs - (seg.startMs || 0)) / 1000);
      if (segChanged && localSec <= 0.05) {
        try {
          if (this.audioPlayerEl.readyState >= 1) {
            this.audioPlayerEl.currentTime = 0;
          }
        } catch (e) { }
      } else if (segChanged || Math.abs((this.audioPlayerEl.currentTime || 0) - localSec) > 0.08) {
        try {
          if (this.audioPlayerEl.readyState >= 1) {
            this.audioPlayerEl.currentTime = localSec;
          } else if (localSec > 0.05) {
            const targetSec = localSec;
            const expectedSrc = seg.audioDataUrl;
            const onMeta = () => {
              this.audioPlayerEl.removeEventListener('loadedmetadata', onMeta);
              if (this.audioPlayerEl && this.audioPlayerEl.src === expectedSrc) {
                try { this.audioPlayerEl.currentTime = targetSec; } catch (e) { }
              }
            };
            this.audioPlayerEl.addEventListener('loadedmetadata', onMeta, { once: true });
          }
        } catch (e) { }
      }
      if (shouldPlay) {
        try {
          const playPromise = this.audioPlayerEl.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => { });
          }
        } catch (e) { }
      }
      return seg;
    }

    _clearAudioPlayerBarAutoHide() {
      if (this._audioBarAutoHideTimer) {
        clearTimeout(this._audioBarAutoHideTimer);
        this._audioBarAutoHideTimer = null;
      }
      const bar = document.getElementById('audioSyncFloatingBar');
      if (bar) {
        bar.classList.remove('player-bar-auto-hidden');
        bar.style.pointerEvents = '';
      }
    }

    showAudioPlayerBarTemporarily(delayMs = 2800) {
      const bar = document.getElementById('audioSyncFloatingBar');
      if (bar) {
        bar.classList.remove('player-bar-auto-hidden');
      }
      if (this._audioBarAutoHideTimer) {
        clearTimeout(this._audioBarAutoHideTimer);
        this._audioBarAutoHideTimer = null;
      }
      if (!this.isAudioPlaying || this.isAudioRecording) return;
      this._audioBarAutoHideTimer = setTimeout(() => {
        this._audioBarAutoHideTimer = null;
        if (!this.isAudioPlaying || this.isAudioRecording) return;
        if (this._isScrubbingAudioBar || this._isHoveringAudioBar) {
          this.showAudioPlayerBarTemporarily(delayMs);
          return;
        }
        const b = document.getElementById('audioSyncFloatingBar');
        if (b && b.style.display !== 'none') {
          b.classList.add('player-bar-auto-hidden');
        }
      }, delayMs);
    }

    playAudioSync(fromMs = null, forceMode = null) {
      if (!this.audioSyncData || !this.audioSyncData.durationMs) return;
      if (forceMode) {
        this.audioReplayViewMode = forceMode;
      }
      const dur = this.audioSyncData.durationMs;
      if (typeof fromMs === 'number') {
        this.audioPlayCurrentMs = Math.max(0, Math.min(dur, fromMs));
      } else if (this.audioPlayCurrentMs >= dur - 50) {
        this.audioPlayCurrentMs = 0;
      }

      this._isAudioSyncPlayerVisible = true;
      this._isAudioReplayActive = true;
      this.isAudioPlaying = true;
      this._lastAppliedAudioStateObj = null;
      document.body.classList.add('audio-replay-active');
      this._syncReplayFixedStageLayout();
      this.showAudioPlayerBarTemporarily(2800);

      this._activeAudioSegmentIdx = -1;
      this._syncAudioPlayerToPlayMs(this.audioPlayCurrentMs || 0, true);

      this._audioPlayWallStartMs = performance.now();
      this._audioPlayBaseOffsetMs = this.audioPlayCurrentMs || 0;

      if (this._audioReplayRafId) {
        cancelAnimationFrame(this._audioReplayRafId);
        this._audioReplayRafId = null;
      }

      const stepReplay = () => {
        if (!this.isAudioPlaying || !this.audioSyncData) return;
        const wallElapsed = (performance.now() - this._audioPlayWallStartMs) * (this.audioPlaybackRate || 1.0);
        let nextMs = this._audioPlayBaseOffsetMs + wallElapsed;

        const segs = (Array.isArray(this.audioSyncData.audioSegments) && this.audioSyncData.audioSegments.length > 0)
          ? this.audioSyncData.audioSegments
          : null;
        const curSegIdx = (typeof this._activeAudioSegmentIdx === 'number' && this._activeAudioSegmentIdx >= 0)
          ? this._activeAudioSegmentIdx
          : 0;
        const curSeg = segs && segs[curSegIdx] ? segs[curSegIdx] : null;

        if (
          this.audioPlayerEl &&
          !this.audioPlayerEl.paused &&
          Number.isFinite(this.audioPlayerEl.currentTime) &&
          this.audioPlayerEl.currentTime > 0
        ) {
          const segBaseMs = curSeg ? (curSeg.startMs || 0) : 0;
          const audioMs = segBaseMs + this.audioPlayerEl.currentTime * 1000;
          if (Math.abs(audioMs - nextMs) < 350) {
            nextMs = audioMs;
          }
        }

        // 🌟 [슬라이드 간 왕복(3번 ➔ 2번 ➔ 3번) 세그먼트 경계 자동 전환]:
        // 현재 세그먼트(curSeg)가 끝나는 시각(curSeg.endMs)에 도달했을 때,
        // 녹음 당시 다른 슬라이드(nextSlideIdx)로 넘어갔던 기록이 있으면 그 슬라이드의 이어진 시점(nextSlideStartMs)으로 즉시 점프!
        if (curSeg && nextMs >= curSeg.endMs) {
          if (
            this.isLessonPlaylistActive &&
            typeof curSeg.nextSlideIdx === 'number' &&
            curSeg.nextSlideIdx !== this.lessonPlaylistIndex &&
            Array.isArray(this.lessonPlaylistSlides) &&
            this.lessonPlaylistSlides[curSeg.nextSlideIdx] &&
            this.lessonPlaylistSlides[curSeg.nextSlideIdx].audioSyncData &&
            this.lessonPlaylistSlides[curSeg.nextSlideIdx].audioSyncData.durationMs > 0
          ) {
            this.audioPlayCurrentMs = curSeg.endMs;
            this._renderAudioReplayAtCurrentTime();
            const keepViewMode = this.audioReplayViewMode || 'video';
            const targetSlideIdx = curSeg.nextSlideIdx;
            const targetStartMs = typeof curSeg.nextSlideStartMs === 'number' ? curSeg.nextSlideStartMs : 0;
            this.pauseAudioPlayback(false);
            this.jumpToPlaylistSlide(targetSlideIdx);
            if (this._enteredAudioFromViewerSlideIdx !== null) {
              this._enteredAudioFromViewerSlideIdx = this.lessonPlaylistIndex;
            }
            this.playAudioSync(targetStartMs, keepViewMode);
            return;
          }
          if (segs && curSegIdx + 1 < segs.length) {
            this._syncAudioPlayerToPlayMs(nextMs, true);
            this._audioPlayWallStartMs = performance.now();
            this._audioPlayBaseOffsetMs = nextMs;
          }
        }

        const maxDur = this.audioSyncData.durationMs || 1000;
        if (nextMs >= maxDur) {
          this.audioPlayCurrentMs = maxDur;
          this._renderAudioReplayAtCurrentTime();
          // 🌟 다중 슬라이드 연속 강의인 경우: 현재 슬라이드 재생이 끝나면 다음 슬라이드로 자동 이동하여 끊김 없이 이어서 재생!
          const fallbackNextIdx = (curSeg && typeof curSeg.nextSlideIdx === 'number')
            ? curSeg.nextSlideIdx
            : (this.lessonPlaylistIndex + 1);
          const fallbackNextStartMs = (curSeg && typeof curSeg.nextSlideIdx === 'number' && typeof curSeg.nextSlideStartMs === 'number')
            ? curSeg.nextSlideStartMs
            : 0;
          if (
            this.isLessonPlaylistActive &&
            Array.isArray(this.lessonPlaylistSlides) &&
            fallbackNextIdx >= 0 &&
            fallbackNextIdx < this.lessonPlaylistSlides.length &&
            fallbackNextIdx !== this.lessonPlaylistIndex &&
            this.lessonPlaylistSlides[fallbackNextIdx] &&
            this.lessonPlaylistSlides[fallbackNextIdx].audioSyncData &&
            this.lessonPlaylistSlides[fallbackNextIdx].audioSyncData.durationMs > 0 &&
            (typeof (curSeg && curSeg.nextSlideIdx) === 'number' || fallbackNextIdx === this.lessonPlaylistIndex + 1)
          ) {
            const keepViewMode = this.audioReplayViewMode || 'video';
            this.pauseAudioPlayback(true);
            this.jumpToPlaylistSlide(fallbackNextIdx);
            if (this._enteredAudioFromViewerSlideIdx !== null) {
              this._enteredAudioFromViewerSlideIdx = this.lessonPlaylistIndex;
            }
            this.playAudioSync(fallbackNextStartMs, keepViewMode);
            return;
          }
          this.pauseAudioPlayback(true);
          return;
        }

        this.audioPlayCurrentMs = nextMs;
        this._renderAudioReplayAtCurrentTime();
        this.syncAudioRecordUI();
        this._audioReplayRafId = requestAnimationFrame(stepReplay);
      };

      this._renderAudioReplayAtCurrentTime();
      this.syncAudioRecordUI();
      this._audioReplayRafId = requestAnimationFrame(stepReplay);
    }

    _clearAudioReplaySmartUiState() {
      const managedBarIds = [
        'sidebarRail',
        'railDrawer',
        'inkFloatingToolbar',
        'rightActionToolbar',
        'quickPillRemote',
        'graphSnapFloatingBar',
        'pdfToGraphCropFloatingBar',
        'curveContextBar',
        'lassoActionFloatingBar',
        'pwRegionPopover'
      ];
      managedBarIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('replay-ui-smart-visible');
      });
      if (this._lastReplayHoveredBtnEl) {
        this._lastReplayHoveredBtnEl.classList.remove('replay-ui-btn-hover', 'replay-ui-btn-active');
        this._lastReplayHoveredBtnEl = null;
      }
      document.querySelectorAll('.replay-ui-btn-hover, .replay-ui-btn-active').forEach(el => {
        el.classList.remove('replay-ui-btn-hover', 'replay-ui-btn-active');
      });
      const canvasDraftEl = document.getElementById('replayCanvasStickerDraftBox');
      if (canvasDraftEl) canvasDraftEl.style.display = 'none';
      document.querySelectorAll('.replay-card-sticker-draft').forEach(el => {
        el.style.display = 'none';
      });
      const dragBox = document.getElementById('graphSnapDragBox');
      if (dragBox && !this.isGraphSnapDragging && !this.isPdfToGraphCropDragging) {
        dragBox.style.display = 'none';
      }
    }

    _syncAudioReplaySmartUiAt(playMs, hoverCursor = null) {
      // 🌟 [상시 노출 UI + 초경량 버튼 하이라이트]:
      // 메뉴바들의 투명도(opacity) 애니메이션을 완전히 제거하여 GPU 레이어 리컴포지팅 부하를 0으로 만들고,
      // 현재 포인터가 가리키는 버튼 단 1개에만 호버/클릭 하이라이트(.replay-ui-btn-hover / .replay-ui-btn-active)를 즉시 표시합니다!
      let nextBtnEl = (hoverCursor && hoverCursor.uiBtnKey)
        ? this._findAudioUiButtonByKey(hoverCursor.uiBtnKey, hoverCursor.uiBarId)
        : null;
      if (nextBtnEl && hoverCursor && typeof hoverCursor.x === 'number' && typeof hoverCursor.y === 'number') {
        const r = this._getStageElementRect(nextBtnEl);
        if (
          !r ||
          r.width <= 0 ||
          r.height <= 0 ||
          hoverCursor.x < r.left - 24 ||
          hoverCursor.x > r.right + 24 ||
          hoverCursor.y < r.top - 24 ||
          hoverCursor.y > r.bottom + 24
        ) {
          nextBtnEl = null;
        }
      }
      if (this._lastReplayHoveredBtnEl && this._lastReplayHoveredBtnEl !== nextBtnEl) {
        this._lastReplayHoveredBtnEl.classList.remove('replay-ui-btn-hover', 'replay-ui-btn-active');
        this._lastReplayHoveredBtnEl = null;
      }
      if (nextBtnEl) {
        nextBtnEl.classList.add('replay-ui-btn-hover');
        nextBtnEl.classList.toggle('replay-ui-btn-active', Boolean(hoverCursor && hoverCursor.isDrawing));
        this._lastReplayHoveredBtnEl = nextBtnEl;
      }
    }

    _renderAudioReplayAtCurrentTime() {
      const playMs = this.audioPlayCurrentMs || 0;
      this._activeReplayTipScreen = null;
      this._applyAudioTimelineStateAt(playMs);
      this._syncAudioReplaySmartUiAt(playMs, null);
      this.renderProblemCardCanvas();
      this.renderGraphCardCanvas();
      if (this.extraProblemCards) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el && typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
        });
      }
      if (this.extraGraphCards) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el && typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
        });
      }
      this._renderAudioReplayCardLasers(playMs);
      this.render();

      if (this._activeReplayTipScreen) {
        this._syncAudioReplaySmartUiAt(playMs, null);
        const tipKind = this._activeReplayTipScreen.isLaser
          ? 'laser'
          : (this._activeReplayTipScreen.isHighlighter ? 'highlighter' : 'pen');
        this.positionReplayVirtualStylus(
          this._activeReplayTipScreen.x,
          this._activeReplayTipScreen.y,
          this._activeReplayTipScreen.color,
          true,
          tipKind
        );
      } else {
        const hoverCursor = this._getInterpolatedCursorAt(playMs);
        this._syncAudioReplaySmartUiAt(playMs, hoverCursor);
        if (hoverCursor) {
          this.positionReplayVirtualStylus(
            hoverCursor.x,
            hoverCursor.y,
            hoverCursor.color,
            hoverCursor.isDrawing,
            hoverCursor.cursorKind || (hoverCursor.isLaser ? 'laser' : 'pen')
          );
        } else if (this.virtualStylusEl && this.isAudioPlaying) {
          this.virtualStylusEl.style.display = 'none';
        }
      }
    }

    pauseAudioPlayback(isEnded = false) {
      this.isAudioPlaying = false;
      this._clearAudioPlayerBarAutoHide();
      if (this._audioReplayRafId) {
        cancelAnimationFrame(this._audioReplayRafId);
        this._audioReplayRafId = null;
      }
      if (this.audioPlayerEl) {
        try { this.audioPlayerEl.pause(); } catch (e) { }
      }
      if (isEnded && this.audioSyncData && this.audioSyncData.finalState) {
        if (!this.isStudentAudioVideoOnlyMode) {
          this._isAudioReplayActive = false;
          document.body.classList.remove('audio-replay-active');
        }
        this._syncReplayFixedStageLayout();
        this._clearAudioReplaySmartUiState();
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        this._applyAudioWorkspaceKeyframe(this.audioSyncData.finalState);
        this.renderProblemCardCanvas();
        this.renderGraphCardCanvas();
        if (this.extraProblemCards) {
          this.extraProblemCards.forEach(c => {
            if (c && c.el && typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
          });
        }
        if (this.extraGraphCards) {
          this.extraGraphCards.forEach(c => {
            if (c && c.el && typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
          });
        }
        this.render();
      } else if (this._isAudioReplayActive) {
        this._syncReplayFixedStageLayout();
        this._renderAudioReplayAtCurrentTime();
      }
      this.syncAudioRecordUI();
    }

    stopAudioPlayback(restoreFinal = true) {
      const wasReplayActive = Boolean(this._isAudioReplayActive || this.isAudioPlaying);
      this._clearAudioPlayerBarAutoHide();
      this.pauseAudioPlayback(false);
      this._isAudioReplayActive = false;
      document.body.classList.remove('audio-replay-active');
      this._syncReplayFixedStageLayout();
      this._clearAudioReplaySmartUiState();
      if (restoreFinal) {
        this.audioPlayCurrentMs = 0;
      }
      if (this.virtualStylusEl) {
        this.virtualStylusEl.style.display = 'none';
      }
      if (wasReplayActive && restoreFinal && this.audioSyncData && this.audioSyncData.finalState) {
        this._applyAudioWorkspaceKeyframe(this.audioSyncData.finalState);
      }
      this._inkBakeDirty = true;
      this.renderProblemCardCanvas();
      this.renderGraphCardCanvas();
      if (this.extraProblemCards) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el && typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
        });
      }
      if (this.extraGraphCards) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el && typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
        });
      }
      this.render();
      this.syncAudioRecordUI();
    }

    seekAudioSync(targetMs, autoPlay = false) {
      if (!this.audioSyncData) return;
      const dur = this.audioSyncData.durationMs || 1000;
      this.audioPlayCurrentMs = Math.max(0, Math.min(dur, Number(targetMs) || 0));
      this._audioPlayWallStartMs = performance.now();
      this._audioPlayBaseOffsetMs = this.audioPlayCurrentMs;
      this._syncAudioPlayerToPlayMs(this.audioPlayCurrentMs, Boolean(this.isAudioPlaying));
      this._isAudioReplayActive = true;
      document.body.classList.add('audio-replay-active');
      this._syncReplayFixedStageLayout();
      this._renderAudioReplayAtCurrentTime();
      this.syncAudioRecordUI();
      this.showAudioPlayerBarTemporarily(2800);
      if (autoPlay && !this.isAudioPlaying) {
        this.playAudioSync(this.audioPlayCurrentMs);
      }
    }

    async enterAudioLectureFromViewer(slideIdx = 0, mode = 'video', startMs = 0) {
      if (!this._viewerPkg || !this._viewerPkg.playlistSlides || !this._viewerPkg.playlistSlides[slideIdx]) return;
      const btnWatch = document.getElementById('btnViewerWatchVideo');
      const prevHtml = btnWatch ? btnWatch.innerHTML : '';
      if (typeof this._ensureCloudShareAudioLoaded === 'function' && (this._viewerPkg._hasLazyAudio || (this._viewerPkg.playlistSlides[slideIdx].audioSyncData && this._viewerPkg.playlistSlides[slideIdx].audioSyncData._isLazyAudioStub))) {
        if (btnWatch) {
          btnWatch.disabled = true;
          btnWatch.innerHTML = '<span>⏳ 영상 불러오는 중...</span>';
        }
        try {
          await this._ensureCloudShareAudioLoaded(this._viewerPkg);
        } finally {
          if (btnWatch && prevHtml) {
            btnWatch.disabled = false;
            btnWatch.innerHTML = prevHtml;
          }
        }
      }
      await this.enterStudentAudioVideoOnlyMode({
        ...this._viewerPkg,
        currentIndex: slideIdx
      }, true, { startMs, mode });
    }

    // ============================================================================
    // ⌨️ [개인 로그인 계정 귀속 단축키 커스터마이징 엔진 (Shortcut Customization Engine)]
    // - 환경설정(⚙️) ➔ [⌨️ 단축키 설정] 모달 오픈
    // - 기능별 버튼 클릭 후 키 입력 (한/영 상태 무관 물리 키코드 인식)
    // - 중복 키 입력 시 기존 기능의 단축키를 자동으로 [미지정("")]으로 해제
    // - 반드시 하단 [💾 저장하기] 버튼을 눌러야 최종 반영 및 로그인 계정(user_preferences) 동기화
    // ============================================================================
    getShortcutDefinitions() {
      if (!this._shortcutDefinitions) {
        this._shortcutDefinitions = [
          // 1. ✒️ 판서 · 펜 도구 (ink)
          {
            id: 'ink_tool_pen',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '펜 도구',
            desc: '일반 필기 펜으로 즉시 전환',
            defaultKey: 'P',
            buttonIds: ['btnInkPen'],
            baseTitle: '펜'
          },
          {
            id: 'ink_tool_select',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '선택 / 이동 (✋ 조작) 도구',
            desc: '필기 중 그래프·카드·객체 이동 및 조작으로 전환',
            defaultKey: 'V',
            buttonIds: ['btnInkSelect'],
            baseTitle: '선택 / 이동'
          },
          {
            id: 'ink_toggle_mode',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '필기바 보이기 / 숨기기',
            desc: '상단 필기 도구 바 표시 또는 숨기기',
            defaultKey: '',
            buttonIds: ['btnInkMode'],
            baseTitle: '필기바 표시/숨김'
          },
          {
            id: 'ink_tool_highlighter',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '형광펜 도구 (펜↔형광펜)',
            desc: '반투명 형광펜 전환 (다시 누르면 펜으로 복귀)',
            defaultKey: '',
            buttonIds: ['btnInkHighlighter', 'btnPillHighlighter'],
            baseTitle: '형광펜'
          },
          {
            id: 'ink_tool_eraser',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '지우개 도구 (펜↔지우개)',
            desc: '필기 지우개 전환 (다시 누르면 펜으로 복귀)',
            defaultKey: 'E',
            buttonIds: ['btnInkEraser', 'btnPillEraser'],
            baseTitle: '지우개'
          },
          {
            id: 'ink_tool_lasso',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '올가미 선택 도구',
            desc: '필기 획을 묶어서 이동·복제·색상변경·삭제',
            defaultKey: 'L',
            buttonIds: ['btnInkLasso', 'btnPillLasso'],
            baseTitle: '올가미'
          },
          {
            id: 'ink_tool_laser',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '레이저 포인터',
            desc: '사르륵 사라지는 판서용 레이저 포인터 전환',
            defaultKey: '',
            buttonIds: ['btnInkLaser', 'btnPillLaser'],
            baseTitle: '레이저 포인터'
          },
          {
            id: 'ink_tool_sticker',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '가림막 스티커 도구',
            desc: '드래그하여 정답/풀이 가림막 스티커 생성',
            defaultKey: '',
            buttonIds: ['btnInkSticker', 'btnPillSticker'],
            baseTitle: '스티커 (가림막)'
          },
          {
            id: 'ink_size_down',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '펜 굵기 줄이기 (−)',
            desc: '필기 펜 굵기를 한 단계 가늘게 조절',
            defaultKey: '[',
            buttonIds: ['btnInkSizeDown'],
            baseTitle: '펜 굵기 줄이기'
          },
          {
            id: 'ink_size_up',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '펜 굵기 키우기 (+)',
            desc: '필기 펜 굵기를 한 단계 굵게 조절',
            defaultKey: ']',
            buttonIds: ['btnInkSizeUp'],
            baseTitle: '펜 굵기 키우기'
          },
          {
            id: 'ink_color_1',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '펜 색상 1번 (기본 검정/분필)',
            desc: '첫 번째 펜 색상 즉시 선택',
            defaultKey: ''
          },
          {
            id: 'ink_color_2',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '펜 색상 2번 (파랑/노랑)',
            desc: '두 번째 펜 색상 즉시 선택',
            defaultKey: ''
          },
          {
            id: 'ink_color_3',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '펜 색상 3번 (빨강/코랄)',
            desc: '세 번째 펜 색상 즉시 선택',
            defaultKey: ''
          },
          {
            id: 'ink_color_4',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '펜 색상 4번 (초록/스카이)',
            desc: '네 번째 펜 색상 즉시 선택',
            defaultKey: ''
          },
          {
            id: 'ink_color_5',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '펜 색상 5번 (보라/민트)',
            desc: '다섯 번째 펜 색상 즉시 선택',
            defaultKey: ''
          },
          {
            id: 'ink_clear_all',
            category: 'ink',
            categoryLabel: '✒️ 판서 · 펜 도구',
            name: '현재 칠판 필기 비우기',
            desc: '현재 슬라이드의 펜 필기만 모두 지우기',
            defaultKey: '',
            buttonIds: ['btnInkClearAll', 'btnPillClearAll'],
            baseTitle: '필기 비우기'
          },

          // 2. 📈 그래프 · 수학 도구 (graph)
          {
            id: 'graph_open_presets',
            category: 'graph',
            categoryLabel: '📈 그래프 · 수학 도구',
            name: '그래프 추가창 열기 / 닫기',
            desc: '개형 선택 창 토글 (열린 상태에서 숫자 11~64 연속 소환)',
            defaultKey: 'G',
            buttonIds: ['btnRailPresets'],
            baseTitle: '그래프 추가'
          },
          {
            id: 'graph_toggle_axes',
            category: 'graph',
            categoryLabel: '📈 그래프 · 수학 도구',
            name: '좌표축 표시 켜기 / 끄기',
            desc: '좌표평면(x·y축) ↔ 순수 빈 칠판 즉시 전환',
            defaultKey: 'A',
            buttonIds: ['btnInkToggleAxes'],
            baseTitle: '좌표축'
          },
          {
            id: 'graph_toggle_dropline',
            category: 'graph',
            categoryLabel: '📈 그래프 · 수학 도구',
            name: '보조 수선 도구 켜기 / 끄기',
            desc: '극점·교점에서 x축/y축으로 점선 수선 내리기',
            defaultKey: 'D',
            buttonIds: ['btnQuickDropLine'],
            baseTitle: '보조 수선'
          },
          {
            id: 'graph_toggle_text',
            category: 'graph',
            categoryLabel: '📈 그래프 · 수학 도구',
            name: '텍스트 입력 도구 켜기 / 끄기',
            desc: '칠판 원하는 위치에 수식·텍스트 라벨 추가',
            defaultKey: 'T',
            buttonIds: ['btnQuickText'],
            baseTitle: '텍스트'
          },
          {
            id: 'graph_toggle_intersections',
            category: 'graph',
            categoryLabel: '📈 그래프 · 수학 도구',
            name: '교점 표시 켜기 / 끄기',
            desc: '두 그래프 사이의 교점 마커 자동 탐색 표시',
            defaultKey: '',
            buttonIds: ['btnQuickIntersection'],
            baseTitle: '교점 표시'
          },
          {
            id: 'graph_add_piecewise',
            category: 'graph',
            categoryLabel: '📈 그래프 · 수학 도구',
            name: '구간 분할선 추가',
            desc: '구간별 함수(Piecewise) 세로 경계선 추가',
            defaultKey: '',
            buttonIds: ['btnRailPiecewise'],
            baseTitle: '구간 분할'
          },
          {
            id: 'graph_capture_card',
            category: 'graph',
            categoryLabel: '📈 그래프 · 수학 도구',
            name: '그래프 카드 캡처 (카드 추가)',
            desc: '현재 그래프 영역을 드래그 캡처하여 칠판 카드로 고정',
            defaultKey: '',
            buttonIds: ['btnTriggerGraphSnap'],
            baseTitle: '카드 추가'
          },

          // 3. 📄 슬라이드 · 뷰어 이동 (slide)
          {
            id: 'slide_prev',
            category: 'slide',
            categoryLabel: '📄 슬라이드 · 뷰어 이동',
            name: '이전 캔버스(슬라이드)로 이동',
            desc: '수업 캔버스 또는 PDF 칠판 이전 페이지로 이동',
            defaultKey: 'PageUp',
            buttonIds: ['btnPlaylistPrev', 'btnPdfBoardPrev'],
            baseTitle: '이전 캔버스'
          },
          {
            id: 'slide_next',
            category: 'slide',
            categoryLabel: '📄 슬라이드 · 뷰어 이동',
            name: '다음 캔버스(슬라이드)로 이동',
            desc: '수업 캔버스 또는 PDF 칠판 다음 페이지로 이동',
            defaultKey: 'PageDown',
            buttonIds: ['btnPlaylistNext', 'btnPdfBoardNext'],
            baseTitle: '다음 캔버스'
          },
          {
            id: 'slide_add_blank',
            category: 'slide',
            categoryLabel: '📄 슬라이드 · 뷰어 이동',
            name: '새 빈 캔버스 추가',
            desc: '현재 칠판을 보존하고 다음 빈 슬라이드 즉시 생성',
            defaultKey: '',
            buttonIds: ['btnPlaylistAddSlide'],
            baseTitle: '다음 문제 캡처 / 새 캔버스 추가'
          },
          {
            id: 'pdf_open_or_crop',
            category: 'slide',
            categoryLabel: '📄 슬라이드 · 뷰어 이동',
            name: 'PDF 시험지 열기 / 문제 캡처',
            desc: 'PDF 시험지 창을 열거나 문제 영역 캡처 모드 전환',
            defaultKey: 'C',
            buttonIds: ['btnPdfImport'],
            baseTitle: '파일 열기 (PDF · 이미지 · .graphly)'
          },
          {
            id: 'viewer_open_preview',
            category: 'slide',
            categoryLabel: '📄 슬라이드 · 뷰어 이동',
            name: '표준 뷰어 (시험지 미리보기) 열기',
            desc: '학생용 뷰어 화면으로 전환하여 전체 슬라이드·영상 확인',
            defaultKey: '',
            buttonIds: ['btnQuickOpenViewer'],
            baseTitle: '뷰어 (시험지 미리보기)'
          },
          {
            id: 'drawer_toggle',
            category: 'slide',
            categoryLabel: '📄 슬라이드 · 뷰어 이동',
            name: '좌측 사이드 메뉴 접기 / 펼치기',
            desc: '좌측 개형/설정 서랍 패널 열기 또는 닫기',
            defaultKey: '\\'
          },

          // 4. ⚡ 편집 · 녹화 · 시스템 (system)
          {
            id: 'sys_undo',
            category: 'system',
            categoryLabel: '⚡ 편집 · 녹화 · 시스템',
            name: '실행 취소 (Undo)',
            desc: '직전 필기 또는 그래프 조작 되돌리기',
            defaultKey: 'Ctrl+Z',
            buttonIds: ['btnUndo'],
            baseTitle: '실행 취소'
          },
          {
            id: 'sys_redo',
            category: 'system',
            categoryLabel: '⚡ 편집 · 녹화 · 시스템',
            name: '다시 실행 (Redo)',
            desc: '취소한 작업을 다시 복구하기',
            defaultKey: 'Ctrl+Y',
            buttonIds: ['btnRedo'],
            baseTitle: '다시 실행'
          },
          {
            id: 'sys_delete_selected',
            category: 'system',
            categoryLabel: '⚡ 편집 · 녹화 · 시스템',
            name: '선택 항목 삭제',
            desc: '선택된 그래프 곡선, 올가미 필기, 텍스트 라벨 삭제',
            defaultKey: 'Delete'
          },
          {
            id: 'sys_copy_image',
            category: 'system',
            categoryLabel: '⚡ 편집 · 녹화 · 시스템',
            name: '현재 화면 클립보드 이미지 복사',
            desc: '한글(HWP)·PPT에 바로 붙여넣을 수 있게 고화질 이미지 복사',
            defaultKey: 'Ctrl+C',
            buttonIds: ['btnCopy'],
            baseTitle: '한글/PPT에 1초 컷 붙여넣기'
          },
          {
            id: 'sys_record_toggle',
            category: 'system',
            categoryLabel: '⚡ 편집 · 녹화 · 시스템',
            name: '영상 녹화 시작 / 일시정지',
            desc: '음성·필기·그래프 동기화 해설 녹화 시작 또는 일시정지/재개',
            defaultKey: '',
            buttonIds: ['btnAudioRecordToggle', 'btnAudioPauseRecord'],
            baseTitle: '영상 녹화 시작 / 일시정지'
          },
          {
            id: 'sys_record_stop',
            category: 'system',
            categoryLabel: '⚡ 편집 · 녹화 · 시스템',
            name: '영상 녹화 종료',
            desc: '진행 중인 해설 녹화를 완료하고 저장',
            defaultKey: '',
            buttonIds: ['btnAudioStopRecord'],
            baseTitle: '녹화 종료'
          },
          {
            id: 'sys_fullscreen_toggle',
            category: 'system',
            categoryLabel: '⚡ 편집 · 녹화 · 시스템',
            name: '전체화면 켜기 / 끄기',
            desc: '브라우저 여백 없는 몰입형 전체화면 전환',
            defaultKey: '',
            buttonIds: ['btnFullscreen'],
            baseTitle: '전체화면'
          },
          {
            id: 'sys_toggle_hide_ui',
            category: 'system',
            categoryLabel: '⚡ 편집 · 녹화 · 시스템',
            name: '아이콘 모두 숨기기 / 보이기',
            desc: '화면의 모든 메뉴·툴바 아이콘을 숨기고 깔끔한 칠판만 표시',
            defaultKey: 'H',
            buttonIds: ['btnHideAllUI'],
            baseTitle: '아이콘 모두 숨기기'
          },
          {
            id: 'sys_open_cloud_hub',
            category: 'system',
            categoryLabel: '⚡ 편집 · 녹화 · 시스템',
            name: '클라우드 보관함 열기',
            desc: '내 클라우드 폴더 탐색기 및 저장/불러오기 창 열기',
            defaultKey: '',
            buttonIds: ['btnCloudHub'],
            baseTitle: '클라우드 보관함 (저장 & 불러오기)'
          }
        ];
      }
      return this._shortcutDefinitions;
    }

    toggleAllUIHidden(forceVal = null) {
      const nextVal = (typeof forceVal === 'boolean') ? forceVal : !this.isAllUIHidden;
      this.isAllUIHidden = nextVal;

      const restoreTab = document.getElementById('btnRestoreAllUITab');

      if (this._uiHiddenNoticeTimer) {
        clearTimeout(this._uiHiddenNoticeTimer);
        this._uiHiddenNoticeTimer = null;
      }

      if (nextVal) {
        if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
          this.closeDrawer();
        }
        if (this._isPdfCropChoiceMenuOpen && typeof this.cancelPdfBoardToGraphCrop === 'function') {
          this.cancelPdfBoardToGraphCrop();
        }
        document.body.classList.add('ui-all-hidden-mode');
        const eff = this._getEffectiveShortcutsMap(this.customShortcuts);
        const assignedKey = String(eff.sys_toggle_hide_ui || '').trim();
        const dispKey = assignedKey ? this.formatShortcutKeyForDisplay(assignedKey) : '';
        if (restoreTab) {
          restoreTab.classList.remove('peek-highlight');
          restoreTab.style.display = 'flex';
          restoreTab.title = dispKey ? `아이콘 다시 보이기 (${dispKey})` : '아이콘 다시 보이기';
          // 아이콘이 사라진 직후 우상단 자리에서 손잡이 탭이 쏙 나왔다가 1.2초 뒤 스르륵 연해지며 우측으로 은폐
          void restoreTab.offsetWidth;
          restoreTab.classList.add('peek-highlight');
          this._uiHiddenNoticeTimer = setTimeout(() => {
            restoreTab.classList.remove('peek-highlight');
            this._uiHiddenNoticeTimer = null;
          }, 1200);
        }
      } else {
        document.body.classList.remove('ui-all-hidden-mode');
        if (restoreTab) {
          restoreTab.classList.remove('peek-highlight');
          restoreTab.style.display = 'none';
        }
      }
      this._isAudioRecMenuOpen = false;
      if (typeof this.syncAudioRecordUI === 'function') {
        this.syncAudioRecordUI();
      }
    }

    initShortcutCustomization() {
      if (!this.customShortcuts || typeof this.customShortcuts !== 'object') {
        this.customShortcuts = {};
      }
      try {
        const uid = (this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'guest';
        const rawPrefs = localStorage.getItem(this._getUserPrefsStorageKey(uid));
        let loaded = null;
        if (rawPrefs) {
          const parsedPrefs = JSON.parse(rawPrefs);
          if (parsedPrefs && parsedPrefs.customShortcuts && typeof parsedPrefs.customShortcuts === 'object') {
            loaded = parsedPrefs.customShortcuts;
          }
        }
        if (!loaded) {
          const rawLocal = localStorage.getItem('graphly_custom_shortcuts_v1');
          if (rawLocal) {
            const parsedLocal = JSON.parse(rawLocal);
            if (parsedLocal && typeof parsedLocal === 'object') {
              loaded = parsedLocal;
            }
          }
        }
        if (loaded) {
          this.customShortcuts = { ...loaded };
        }
      } catch (_) { }

      this._draftShortcuts = null;
      this._recordingShortcutActionId = null;
      this._shortcutActiveCategory = 'all';
      this._shortcutSearchQuery = '';
      this._shortcutModalDirty = false;
      this.isAllUIHidden = false;

      const btnHideAllUI = document.getElementById('btnHideAllUI');
      const btnRestoreAllUITab = document.getElementById('btnRestoreAllUITab');
      if (btnHideAllUI) {
        btnHideAllUI.onclick = (e) => {
          e.stopPropagation();
          this.toggleAllUIHidden(true);
        };
      }
      if (btnRestoreAllUITab) {
        btnRestoreAllUITab.onpointerdown = (e) => {
          e.stopPropagation();
        };
        btnRestoreAllUITab.onclick = (e) => {
          e.stopPropagation();
          this.toggleAllUIHidden(false);
        };
      }

      const btnOpenSettings = document.getElementById('btnOpenShortcutSettings');
      const btnOpenFromGuide = document.getElementById('btnOpenShortcutSettingsFromGuide');
      const modal = document.getElementById('modalShortcutSettings');
      const btnClose = document.getElementById('btnCloseShortcutSettings');
      const btnCancel = document.getElementById('btnCancelShortcutSettings');
      const btnSave = document.getElementById('btnSaveShortcutSettings');
      const btnResetAll = document.getElementById('btnResetAllShortcuts');
      const catTabsWrap = document.getElementById('shortcutCategoryTabs');
      const searchInput = document.getElementById('inputShortcutSearch');

      if (btnOpenSettings) {
        btnOpenSettings.onclick = (e) => {
          e.stopPropagation();
          this.openShortcutSettingsModal();
        };
      }
      if (btnOpenFromGuide) {
        btnOpenFromGuide.onclick = (e) => {
          e.stopPropagation();
          const mGuide = document.getElementById('modalGuideNotice');
          if (mGuide) mGuide.classList.remove('show');
          this.openShortcutSettingsModal();
        };
      }
      if (btnClose) {
        btnClose.onclick = () => this.closeShortcutSettingsModal();
      }
      if (btnCancel) {
        btnCancel.onclick = () => this.closeShortcutSettingsModal();
      }
      if (modal) {
        modal.onclick = (e) => {
          if (e.target === modal && this._recordingShortcutActionId) {
            this._recordingShortcutActionId = null;
            this.renderShortcutSettingsModalList();
          }
        };
      }
      if (btnSave) {
        btnSave.onclick = () => this.saveShortcutSettingsFromModal();
      }
      if (btnResetAll) {
        btnResetAll.onclick = () => this.resetAllDraftShortcutsToDefault();
      }
      if (catTabsWrap) {
        catTabsWrap.querySelectorAll('.shortcut-cat-tab').forEach(tabBtn => {
          tabBtn.onclick = () => {
            this._shortcutActiveCategory = tabBtn.getAttribute('data-scat') || 'all';
            catTabsWrap.querySelectorAll('.shortcut-cat-tab').forEach(b => {
              b.classList.toggle('active', b === tabBtn);
            });
            this.renderShortcutSettingsModalList();
          };
        });
      }
      if (searchInput) {
        searchInput.oninput = (e) => {
          this._shortcutSearchQuery = String(e.target.value || '').trim();
          this.renderShortcutSettingsModalList();
        };
        searchInput.onkeydown = (e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            if (searchInput.value) {
              searchInput.value = '';
              this._shortcutSearchQuery = '';
              this.renderShortcutSettingsModalList();
            } else {
              searchInput.blur();
            }
          }
        };
      }

      // 모달 열림 중 키 입력 캡처 리스너 (키 바인딩 녹음 및 ESC 닫기)
      window.addEventListener('keydown', (e) => {
        if (!this.isShortcutSettingsModalOpen()) return;

        // 검색창 포커스 중이고 녹음 상태가 아니면 일반 타이핑 허용
        const isSearchFocused = (document.activeElement === searchInput);
        if (isSearchFocused && !this._recordingShortcutActionId) {
          return;
        }

        if (this._recordingShortcutActionId) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

          if (e.key === 'Escape') {
            const canceledDef = this.getShortcutDefinitions().find(d => d.id === this._recordingShortcutActionId);
            this._recordingShortcutActionId = null;
            this.setShortcutModalBanner(
              `ℹ️ [${canceledDef ? canceledDef.name : '기능'}] 단축키 입력을 취소했습니다.`,
              'normal'
            );
            this.renderShortcutSettingsModalList();
            return;
          }

          const normKey = this.normalizeShortcutEventToKey(e);
          if (!normKey) {
            // Ctrl, Shift, Alt 단독 입력 시 조합키 대기
            return;
          }

          if (normKey === 'F5' || normKey === 'Ctrl+R') {
            this.setShortcutModalBanner(
              `⚠️ [${this.formatShortcutKeyForDisplay(normKey)}] 키는 브라우저 새로고침 보호를 위해 사용할 수 없습니다.`,
              'warning'
            );
            return;
          }

          this.assignDraftShortcutKey(this._recordingShortcutActionId, normKey);
          return;
        }

        // 녹음 중이 아닐 때 ESC 누르면 모달 닫기 (저장 안 함)
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
          this.closeShortcutSettingsModal();
        }
      }, true);

      this.syncShortcutTooltipsAndGuideUI();
    }

    isShortcutSettingsModalOpen() {
      const modal = document.getElementById('modalShortcutSettings');
      return Boolean(modal && modal.classList.contains('show'));
    }

    normalizeShortcutEventToKey(e) {
      if (!e) return '';
      const rawKey = String(e.key || '');
      const code = String(e.code || '');

      // 수식키(Modifier) 단독 누름은 무시 (조합키 대기)
      if (['Control', 'Shift', 'Alt', 'Meta', 'OS', 'CapsLock', 'NumLock', 'ScrollLock', 'Process', 'Dead'].includes(rawKey)) {
        if (code.startsWith('Control') || code.startsWith('Shift') || code.startsWith('Alt') || code.startsWith('Meta')) {
          return '';
        }
      }

      let baseKey = '';
      if (/^Key([A-Z])$/.test(code)) {
        // 한/영 키 상태와 무관하게 물리 알파벳 키(KeyA~KeyZ)를 대문자 A~Z로 인식!
        baseKey = code.slice(3).toUpperCase();
      } else if (/^Digit([0-9])$/.test(code)) {
        baseKey = code.slice(5);
      } else if (/^Numpad([0-9])$/.test(code)) {
        baseKey = code.slice(6);
      } else if (/^F([1-9]|1[0-2])$/i.test(rawKey)) {
        baseKey = rawKey.toUpperCase();
      } else if (code === 'BracketLeft' || rawKey === '[') {
        baseKey = '[';
      } else if (code === 'BracketRight' || rawKey === ']') {
        baseKey = ']';
      } else if (code === 'Backslash' || rawKey === '\\') {
        baseKey = '\\';
      } else if (code === 'Slash' || rawKey === '/') {
        baseKey = '/';
      } else if (code === 'Period' || rawKey === '.') {
        baseKey = '.';
      } else if (code === 'Comma' || rawKey === ',') {
        baseKey = ',';
      } else if (code === 'Semicolon' || rawKey === ';') {
        baseKey = ';';
      } else if (code === 'Quote' || rawKey === "'") {
        baseKey = "'";
      } else if (code === 'Backquote' || rawKey === '`') {
        baseKey = '`';
      } else if (code === 'Minus' || code === 'NumpadSubtract' || rawKey === '-') {
        baseKey = '-';
      } else if (code === 'Equal' || code === 'NumpadAdd' || rawKey === '=' || rawKey === '+') {
        baseKey = '=';
      } else if (rawKey === 'PageUp' || code === 'PageUp') {
        baseKey = 'PageUp';
      } else if (rawKey === 'PageDown' || code === 'PageDown') {
        baseKey = 'PageDown';
      } else if (rawKey === 'Home' || code === 'Home') {
        baseKey = 'Home';
      } else if (rawKey === 'End' || code === 'End') {
        baseKey = 'End';
      } else if (rawKey === 'Insert' || code === 'Insert') {
        baseKey = 'Insert';
      } else if (rawKey === 'Delete' || code === 'Delete') {
        baseKey = 'Delete';
      } else if (rawKey === 'Backspace' || code === 'Backspace') {
        baseKey = 'Backspace';
      } else if (rawKey === 'Tab' || code === 'Tab') {
        baseKey = 'Tab';
      } else if (rawKey === 'Enter' || code === 'Enter' || code === 'NumpadEnter') {
        baseKey = 'Enter';
      } else if (rawKey === 'ArrowLeft' || code === 'ArrowLeft') {
        baseKey = 'ArrowLeft';
      } else if (rawKey === 'ArrowRight' || code === 'ArrowRight') {
        baseKey = 'ArrowRight';
      } else if (rawKey === 'ArrowUp' || code === 'ArrowUp') {
        baseKey = 'ArrowUp';
      } else if (rawKey === 'ArrowDown' || code === 'ArrowDown') {
        baseKey = 'ArrowDown';
      } else if (rawKey === ' ' || code === 'Space') {
        baseKey = 'Space';
      } else if (rawKey.length === 1 && /^[a-zA-Z0-9]$/.test(rawKey)) {
        baseKey = rawKey.toUpperCase();
      }

      if (!baseKey) return '';

      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      parts.push(baseKey);
      return parts.join('+');
    }

    formatShortcutKeyForDisplay(keyStr) {
      const clean = String(keyStr || '').trim();
      if (!clean) return '미지정';
      const labelMap = {
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'PageUp': 'PageUp',
        'PageDown': 'PageDown',
        'Delete': 'Delete',
        'Backspace': 'Backspace',
        'Space': 'Space',
        'Enter': 'Enter',
        'Tab': 'Tab'
      };
      return clean
        .split('+')
        .map(token => labelMap[token] || token)
        .join(' + ');
    }

    _getEffectiveShortcutsMap(customOverride = null) {
      const src = (customOverride && typeof customOverride === 'object')
        ? customOverride
        : (this.customShortcuts || {});
      const result = {};
      this.getShortcutDefinitions().forEach(def => {
        if (Object.prototype.hasOwnProperty.call(src, def.id) && typeof src[def.id] === 'string') {
          result[def.id] = src[def.id].trim();
        } else {
          result[def.id] = String(def.defaultKey || '').trim();
        }
      });
      // [구버전 단축키 프로필 자동 마이그레이션]: 기존에 ink_toggle_mode가 'P'로 저장되어 있고 ink_tool_pen이 비어 있던 계정은
      // 'P'를 즉시 펜 도구(ink_tool_pen)로 자동 승계하여 V ➔ P 전환 시 중간 화살표 상태 없이 바로 펜으로 전환!
      if (String(result.ink_toggle_mode || '').toUpperCase() === 'P' && !result.ink_tool_pen) {
        result.ink_tool_pen = 'P';
        result.ink_toggle_mode = '';
      }
      return result;
    }

    setShortcutModalBanner(htmlText, mode = 'normal') {
      const banner = document.getElementById('shortcutModalNoticeBanner');
      if (!banner) return;
      banner.innerHTML = htmlText;
      banner.classList.toggle('is-warning', mode === 'warning');
      banner.classList.toggle('is-recording', mode === 'recording');
    }

    openShortcutSettingsModal() {
      const modal = document.getElementById('modalShortcutSettings');
      if (!modal) return;
      if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }
      this._draftShortcuts = { ...this._getEffectiveShortcutsMap(this.customShortcuts) };
      this._recordingShortcutActionId = null;
      this._shortcutModalDirty = false;

      const badgeSync = document.getElementById('badgeShortcutAccountSync');
      if (badgeSync) {
        if (this.cloudUser && this.cloudUser.uid) {
          const emailOrName = this.cloudUser.displayName || this.cloudUser.email || '로그인 계정';
          badgeSync.textContent = `☁️ ${emailOrName} 계정 연동`;
          badgeSync.classList.remove('is-guest');
        } else {
          badgeSync.textContent = '💻 비로그인 (로그인 시 내 계정에 영구 귀속)';
          badgeSync.classList.add('is-guest');
        }
      }

      this.setShortcutModalBanner(
        '💡 기능 옆의 <strong>[단축키 버튼]</strong>을 클릭한 뒤 원하는 키를 누르세요. (중복 키 입력 시 기존 기능은 <strong>미지정</strong>으로 변경되며, 하단 <strong>[💾 저장하기]</strong>를 눌러야 최종 반영됩니다)',
        'normal'
      );
      this._syncShortcutSaveBtnState();
      this.renderShortcutSettingsModalList();
      modal.classList.add('show');
    }

    closeShortcutSettingsModal() {
      const modal = document.getElementById('modalShortcutSettings');
      if (modal) modal.classList.remove('show');
      this._recordingShortcutActionId = null;
      this._draftShortcuts = null;
      this._shortcutModalDirty = false;
    }

    _syncShortcutSaveBtnState() {
      const btnSave = document.getElementById('btnSaveShortcutSettings');
      if (!btnSave) return;
      btnSave.classList.toggle('has-unsaved-changes', Boolean(this._shortcutModalDirty));
      btnSave.textContent = this._shortcutModalDirty ? '💾 저장하기 (변경됨)' : '💾 저장하기';
    }

    assignDraftShortcutKey(actionId, newKey) {
      if (!this._draftShortcuts) return;
      const defs = this.getShortcutDefinitions();
      const targetDef = defs.find(d => d.id === actionId);
      if (!targetDef) return;

      const cleanKey = String(newKey || '').trim();
      let unassignedDef = null;

      if (cleanKey) {
        // 중복 키 검사: 이미 다른 기능에 동일한 키가 지정되어 있으면 기존 기능을 '미지정("")'으로 해제!
        defs.forEach(otherDef => {
          if (otherDef.id === actionId) return;
          const otherKey = String(this._draftShortcuts[otherDef.id] || '').trim();
          if (otherKey && otherKey.toUpperCase() === cleanKey.toUpperCase()) {
            this._draftShortcuts[otherDef.id] = '';
            unassignedDef = otherDef;
          }
        });
      }

      this._draftShortcuts[actionId] = cleanKey;
      this._recordingShortcutActionId = null;
      this._shortcutModalDirty = true;
      this._syncShortcutSaveBtnState();

      const dispKey = this.formatShortcutKeyForDisplay(cleanKey);
      if (unassignedDef) {
        this.setShortcutModalBanner(
          `⚠️ 기존 <strong>[${unassignedDef.name}]</strong>에 지정되어 있던 <strong>'${dispKey}'</strong> 단축키를 <strong>[미지정]</strong>으로 바꾸고, <strong>[${targetDef.name}]</strong>에 지정했습니다. (하단 <strong>[💾 저장하기]</strong>를 눌러야 최종 반영됩니다)`,
          'warning'
        );
      } else if (cleanKey) {
        this.setShortcutModalBanner(
          `✅ <strong>[${targetDef.name}]</strong> 단축키가 <strong>[${dispKey}]</strong>(으)로 지정되었습니다. 하단 <strong>[💾 저장하기]</strong>를 누르면 최종 반영됩니다.`,
          'normal'
        );
      } else {
        this.setShortcutModalBanner(
          `ℹ️ <strong>[${targetDef.name}]</strong> 단축키가 <strong>[미지정]</strong>으로 비워졌습니다. 하단 <strong>[💾 저장하기]</strong>를 누르면 최종 반영됩니다.`,
          'normal'
        );
      }

      this.renderShortcutSettingsModalList();
    }

    resetAllDraftShortcutsToDefault() {
      if (!this._draftShortcuts) return;
      this.getShortcutDefinitions().forEach(def => {
        this._draftShortcuts[def.id] = String(def.defaultKey || '').trim();
      });
      this._recordingShortcutActionId = null;
      this._shortcutModalDirty = true;
      this._syncShortcutSaveBtnState();
      this.setShortcutModalBanner(
        '🔄 모든 단축키가 초기 기본값으로 되돌려졌습니다. 하단 <strong>[💾 저장하기]</strong>를 누르면 최종 반영됩니다.',
        'normal'
      );
      this.renderShortcutSettingsModalList();
    }

    saveShortcutSettingsFromModal() {
      if (!this._draftShortcuts) {
        this.closeShortcutSettingsModal();
        return;
      }

      const nextCustom = {};
      this.getShortcutDefinitions().forEach(def => {
        const draftVal = String(this._draftShortcuts[def.id] ?? def.defaultKey ?? '').trim();
        const defVal = String(def.defaultKey || '').trim();
        if (draftVal !== defVal) {
          // 기본값에서 변경되었거나 기본값이 있었는데 미지정("")으로 비운 경우 모두 저장
          nextCustom[def.id] = draftVal;
        }
      });

      this.customShortcuts = nextCustom;
      try {
        localStorage.setItem('graphly_custom_shortcuts_v1', JSON.stringify(this.customShortcuts));
      } catch (_) { }

      // 로그인 계정 환경설정(localStorage + Firestore user_preferences)에 즉시 저장
      if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }

      this.syncShortcutTooltipsAndGuideUI();
      this.closeShortcutSettingsModal();
    }

    renderShortcutSettingsModalList() {
      const listEl = document.getElementById('shortcutSettingsList');
      if (!listEl) return;

      const draft = this._draftShortcuts || this._getEffectiveShortcutsMap(this.customShortcuts);
      const activeCat = this._shortcutActiveCategory || 'all';
      const query = String(this._shortcutSearchQuery || '').toLowerCase();

      const defs = this.getShortcutDefinitions().filter(def => {
        if (activeCat !== 'all' && def.category !== activeCat) return false;
        if (query) {
          const curKeyDisp = this.formatShortcutKeyForDisplay(draft[def.id] || '').toLowerCase();
          const matchName = def.name.toLowerCase().includes(query);
          const matchDesc = (def.desc || '').toLowerCase().includes(query);
          const matchKey = curKeyDisp.includes(query) || String(draft[def.id] || '').toLowerCase().includes(query);
          return matchName || matchDesc || matchKey;
        }
        return true;
      });

      listEl.innerHTML = '';

      if (defs.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.style.cssText = 'padding: 32px 16px; text-align: center; color: #64748b; font-size: 13px; font-weight: 600;';
        emptyEl.textContent = '검색 조건에 맞는 단축키 기능이 없습니다.';
        listEl.appendChild(emptyEl);
        return;
      }

      const categoriesOrder = ['ink', 'graph', 'slide', 'system'];
      categoriesOrder.forEach(catKey => {
        const catItems = defs.filter(d => d.category === catKey);
        if (catItems.length === 0) return;

        const secEl = document.createElement('div');
        secEl.className = 'shortcut-cat-section';

        const headerEl = document.createElement('div');
        headerEl.className = 'shortcut-cat-section-header';
        headerEl.innerHTML = `<span>${catItems[0].categoryLabel}</span><span style="font-size:11px; opacity:0.75;">${catItems.length}개 기능</span>`;
        secEl.appendChild(headerEl);

        catItems.forEach(def => {
          const curKey = String(draft[def.id] ?? '').trim();
          const defKey = String(def.defaultKey || '').trim();
          const isRecording = (this._recordingShortcutActionId === def.id);
          const isUnassigned = !curKey;
          const isCustomized = (curKey !== defKey);

          const row = document.createElement('div');
          row.className = 'shortcut-row' + (isRecording ? ' is-recording-row' : '');

          const infoWrap = document.createElement('div');
          infoWrap.className = 'shortcut-row-info';

          const titleEl = document.createElement('div');
          titleEl.className = 'shortcut-row-title';
          const nameSpan = document.createElement('span');
          nameSpan.textContent = def.name;
          titleEl.appendChild(nameSpan);

          if (isCustomized) {
            const customBadge = document.createElement('span');
            customBadge.className = 'shortcut-custom-dot';
            customBadge.textContent = isUnassigned ? '해제됨' : '맞춤';
            titleEl.appendChild(customBadge);
          }

          const descEl = document.createElement('div');
          descEl.className = 'shortcut-row-desc';
          const defaultDisp = defKey ? this.formatShortcutKeyForDisplay(defKey) : '미지정';
          descEl.textContent = `${def.desc} · (기본값: ${defaultDisp})`;

          infoWrap.appendChild(titleEl);
          infoWrap.appendChild(descEl);

          const ctrlWrap = document.createElement('div');
          ctrlWrap.className = 'shortcut-row-controls';

          const bindBtn = document.createElement('button');
          bindBtn.type = 'button';
          bindBtn.className = 'shortcut-bind-btn'
            + (isRecording ? ' is-recording' : '')
            + (!isRecording && isUnassigned ? ' is-unassigned' : '')
            + (!isRecording && !isUnassigned && isCustomized ? ' is-customized' : '');
          bindBtn.textContent = isRecording
            ? '⌨️ 키를 누르세요... (ESC 취소)'
            : this.formatShortcutKeyForDisplay(curKey);
          bindBtn.title = isRecording
            ? '원하는 단축키를 누르세요 (ESC: 취소)'
            : '클릭한 뒤 지정할 키보드를 누르세요';
          bindBtn.onclick = (e) => {
            e.stopPropagation();
            if (this._recordingShortcutActionId === def.id) {
              this._recordingShortcutActionId = null;
              this.setShortcutModalBanner(
                '💡 기능 옆의 <strong>[단축키 버튼]</strong>을 클릭한 뒤 원하는 키를 누르세요.',
                'normal'
              );
            } else {
              this._recordingShortcutActionId = def.id;
              this.setShortcutModalBanner(
                `⌨️ <strong>[${def.name}]</strong>에 지정할 키를 눌러주세요... (<strong>ESC</strong>: 취소 / 중복 키 입력 시 기존 단축키는 <strong>미지정</strong>으로 해제됩니다)`,
                'recording'
              );
            }
            this.renderShortcutSettingsModalList();
          };

          const clearBtn = document.createElement('button');
          clearBtn.type = 'button';
          clearBtn.className = 'shortcut-mini-icon-btn';
          clearBtn.textContent = '✕';
          clearBtn.title = '단축키 비우기 (미지정으로 변경)';
          clearBtn.disabled = isUnassigned;
          clearBtn.onclick = (e) => {
            e.stopPropagation();
            this.assignDraftShortcutKey(def.id, '');
          };

          const resetOneBtn = document.createElement('button');
          resetOneBtn.type = 'button';
          resetOneBtn.className = 'shortcut-mini-icon-btn is-reset-btn';
          resetOneBtn.textContent = '↺';
          resetOneBtn.title = `이 기능을 기본값(${defaultDisp})으로 복원`;
          resetOneBtn.disabled = !isCustomized;
          resetOneBtn.onclick = (e) => {
            e.stopPropagation();
            this.assignDraftShortcutKey(def.id, defKey);
          };

          ctrlWrap.appendChild(bindBtn);
          ctrlWrap.appendChild(clearBtn);
          ctrlWrap.appendChild(resetOneBtn);

          row.appendChild(infoWrap);
          row.appendChild(ctrlWrap);
          secEl.appendChild(row);
        });

        listEl.appendChild(secEl);
      });
    }

    syncShortcutTooltipsAndGuideUI() {
      const eff = this._getEffectiveShortcutsMap(this.customShortcuts);
      const defs = this.getShortcutDefinitions();

      // 1. 환경설정 패널의 [단축키 설정] 배지 업데이트
      const customCount = defs.filter(d => {
        const cur = String(eff[d.id] ?? '').trim();
        const def = String(d.defaultKey || '').trim();
        return cur !== def;
      }).length;
      const badgeSettings = document.getElementById('badgeShortcutCustomStatus');
      if (badgeSettings) {
        badgeSettings.textContent = customCount > 0 ? `${customCount}개 ▸` : '▸';
      }

      // 2. 툴바/메뉴 버튼의 마우스오버 툴팁(title)에 현재 단축키 실시간 반영
      defs.forEach(def => {
        if (!Array.isArray(def.buttonIds) || !def.baseTitle) return;
        const curKey = String(eff[def.id] || '').trim();
        const keyLabel = curKey ? ` (${this.formatShortcutKeyForDisplay(curKey)})` : '';
        def.buttonIds.forEach(btnId => {
          const el = document.getElementById(btnId);
          if (el) {
            el.title = `${def.baseTitle}${keyLabel}`;
          }
        });
      });

      // 3. [사용법 & 공지사항 ➔ 단축키 안내] 탭의 단축키 목록도 실시간 동기화
      const guideGrid = document.getElementById('guideShortcutDynamicGrid');
      if (guideGrid) {
        const assignedDefs = defs.filter(d => String(eff[d.id] || '').trim().length > 0);
        guideGrid.innerHTML = '';
        assignedDefs.forEach(def => {
          const item = document.createElement('div');
          item.className = 'guide-shortcut-item';
          const kbd = document.createElement('kbd');
          kbd.className = 'guide-kbd';
          kbd.textContent = this.formatShortcutKeyForDisplay(eff[def.id]);
          const desc = document.createElement('span');
          desc.className = 'guide-shortcut-desc';
          desc.textContent = `${def.name} — ${def.desc}`;
          item.appendChild(kbd);
          item.appendChild(desc);
          guideGrid.appendChild(item);
        });

        // 고정 마우스/터치 제스처 안내 추가
        const staticGuides = [
          { k: 'Space + 드래그', d: '캔버스 화면 이동 (Pan) · 마우스 휠 클릭 드래그도 동일' },
          { k: '마우스 휠 / 두 손가락 핀치', d: '화면 확대 · 축소 (Zoom)' },
          { k: 'Ctrl + V', d: '클립보드 캡처 이미지를 문제 카드로 즉시 붙여넣기' },
          { k: '선 긋고 0.4초 정지', d: '반듯한 직선 / 수평 밑줄로 자동 보정 (Draw & Hold)' }
        ];
        staticGuides.forEach(sg => {
          const item = document.createElement('div');
          item.className = 'guide-shortcut-item';
          const kbd = document.createElement('kbd');
          kbd.className = 'guide-kbd';
          kbd.textContent = sg.k;
          const desc = document.createElement('span');
          desc.className = 'guide-shortcut-desc';
          desc.textContent = sg.d;
          item.appendChild(kbd);
          item.appendChild(desc);
          guideGrid.appendChild(item);
        });
      }
    }

    handleCustomShortcutKeyDown(e) {
      if (!e || e.defaultPrevented) return false;
      if (this.isShortcutSettingsModalOpen()) return false;

      // 그래프 추가창(panelPresets)이 열려 있을 때 단독 숫자키(0~9)는 11~109 그래프 코드 연속 소환에 우선 양보!
      if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelPresets' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (/^[0-9]$/.test(e.key) || /^Digit[0-9]$/.test(e.code) || /^Numpad[0-9]$/.test(e.code)) {
          return false;
        }
      }

      const pressedKey = this.normalizeShortcutEventToKey(e);
      if (!pressedKey) return false;

      const eff = this._getEffectiveShortcutsMap(this.customShortcuts);
      const defs = this.getShortcutDefinitions();

      // 1. 정확히 일치하는 사용자/기본 단축키 탐색
      let matchedActionId = null;
      for (let i = 0; i < defs.length; i++) {
        const d = defs[i];
        const assigned = String(eff[d.id] || '').trim();
        if (assigned && assigned.toUpperCase() === pressedKey.toUpperCase()) {
          matchedActionId = d.id;
          break;
        }
      }

      // 2. 보조 호환 단축키 지원 (다른 기능에 배정되지 않았고 해당 기능이 기본값 상태일 때만)
      if (!matchedActionId) {
        if (pressedKey.toUpperCase() === 'CTRL+SHIFT+Z' && String(eff.sys_redo || '').toUpperCase() === 'CTRL+Y') {
          matchedActionId = 'sys_redo';
        } else if (pressedKey.toUpperCase() === 'BACKSPACE' && String(eff.sys_delete_selected || '').toUpperCase() === 'DELETE') {
          matchedActionId = 'sys_delete_selected';
        } else if (pressedKey.toUpperCase() === 'CTRL+B' && String(eff.drawer_toggle || '') === '\\') {
          matchedActionId = 'drawer_toggle';
        }
      }

      if (!matchedActionId) return false;

      const handled = this.executeShortcutAction(matchedActionId, e);
      if (handled) {
        e.preventDefault();
        return true;
      }
      return false;
    }

    executeShortcutAction(actionId, e) {
      switch (actionId) {
        case 'ink_toggle_mode': {
          this.toggleBottomInkBar();
          return true;
        }
        case 'ink_tool_select': {
          if (!this.isInkMode) this.toggleInkMode(true);
          this.setActiveInkTool('select');
          return true;
        }
        case 'ink_tool_pen': {
          if (!this.isInkMode) this.toggleInkMode(true);
          this.setActiveInkTool('pen');
          return true;
        }
        case 'ink_tool_highlighter': {
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'highlighter') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('highlighter');
          }
          return true;
        }
        case 'ink_tool_eraser': {
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'eraser') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('eraser');
          }
          return true;
        }
        case 'ink_tool_lasso': {
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'lasso') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('lasso');
          }
          return true;
        }
        case 'ink_tool_laser': {
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'laser') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('laser');
          }
          return true;
        }
        case 'ink_tool_sticker': {
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool === 'sticker') {
            this.setActiveInkTool('pen');
          } else {
            this.setActiveInkTool('sticker');
          }
          return true;
        }
        case 'ink_size_down': {
          const btn = document.getElementById('btnInkSizeDown');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        case 'ink_size_up': {
          const btn = document.getElementById('btnInkSizeUp');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        case 'ink_color_1':
        case 'ink_color_2':
        case 'ink_color_3':
        case 'ink_color_4':
        case 'ink_color_5': {
          const colorIdx = parseInt(actionId.replace('ink_color_', ''), 10) - 1;
          if (!this.isInkMode) this.toggleInkMode(true);
          if (this.activeInkTool !== 'pen' && this.activeInkTool !== 'highlighter') {
            this.setActiveInkTool('pen');
          }
          const dots = document.querySelectorAll('#inkFloatingToolbar .ink-color-dot');
          if (dots && dots[colorIdx]) {
            dots[colorIdx].click();
            return true;
          }
          return false;
        }
        case 'ink_clear_all': {
          const btn = document.getElementById('btnInkClearAll');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        case 'graph_open_presets': {
          if (this.isPdfModalOpen || (this.smartViewerState && this.smartViewerState.isOpen)) return false;
          if (this.isGraphCovered) {
            document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
            if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelPresets') {
              if (this._pipSessionOrigin === 'rail' && this._pipTargetCard === 'new') {
                this.closeDrawer();
              } else {
                this._pipTargetCard = 'new';
                this._pipSessionOrigin = 'rail';
                this.openDrawer('panelPresets');
                this.showToast('➕ 새 그래프 창 모드 — 선택하는 함수들이 새 창에 담깁니다.');
              }
            } else {
              this._pipTargetCard = 'new';
              this._pipSessionOrigin = 'rail';
              this.openDrawer('panelPresets');
            }
            return true;
          }
          if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelPresets') {
            this.closeDrawer();
          } else {
            this.openDrawer('panelPresets');
          }
          return true;
        }
        case 'graph_toggle_axes': {
          this.toggleAxes();
          return true;
        }
        case 'graph_toggle_dropline': {
          this.toggleDropLineMode();
          return true;
        }
        case 'graph_toggle_text': {
          this.toggleTextToolMode();
          return true;
        }
        case 'graph_toggle_intersections': {
          const btn = document.getElementById('btnQuickIntersection');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        case 'graph_add_piecewise': {
          this.addPiecewiseBoundary();
          return true;
        }
        case 'graph_capture_card': {
          this.toggleGraphSnapMode();
          return true;
        }
        case 'graph_open_smart_input': {
          const btn = document.getElementById('btnSmartInput');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        case 'slide_prev': {
          if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 1) {
            this.stepLessonPlaylist(-1);
            return true;
          }
          if (this.pdfPageBoardData && typeof this.stepPdfBoardPage === 'function') {
            this.stepPdfBoardPage(-1);
            return true;
          }
          return false;
        }
        case 'slide_next': {
          if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 1) {
            this.stepLessonPlaylist(1);
            return true;
          }
          if (this.pdfPageBoardData && typeof this.stepPdfBoardPage === 'function') {
            this.stepPdfBoardPage(1);
            return true;
          }
          return false;
        }
        case 'slide_add_blank': {
          if (typeof this.handleNewCanvasButtonClick === 'function') {
            this.handleNewCanvasButtonClick();
            return true;
          }
          return false;
        }
        case 'pdf_open_or_crop': {
          if (this.isAllUIHidden) return false;
          if (this.isPdfModalOpen) {
            this.togglePdfCropMode();
          } else if (this.pdfDoc) {
            this.openPdfModal();
          } else if (this.triggerLocalFileExplorer) {
            this.triggerLocalFileExplorer();
          } else {
            const fileInput = document.getElementById('pdfFileInput');
            if (fileInput) fileInput.click();
          }
          return true;
        }
        case 'viewer_open_preview': {
          if (this.isAllUIHidden) return false;
          const btn = document.getElementById('btnQuickOpenViewer');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        case 'drawer_toggle': {
          if (this.isAllUIHidden) {
            if (!this.isDrawerCollapsed) {
              this.closeDrawer();
              return true;
            }
            return false;
          }
          this.toggleDrawer();
          return true;
        }
        case 'sys_undo': {
          this.undo();
          return true;
        }
        case 'sys_redo': {
          this.redo();
          return true;
        }
        case 'sys_delete_selected': {
          if (this._activeCardLasso && Array.isArray(this._activeCardLasso.selectedStrokes) && this._activeCardLasso.selectedStrokes.length > 0) {
            this.deleteSelectedInkStrokes();
            return true;
          }
          if (this.isInkMode && this.selectedInkStrokes && this.selectedInkStrokes.length > 0) {
            this.deleteSelectedInkStrokes();
            return true;
          }
          if (this.isGraphCovered && typeof this._deleteSelectedGraphInPipCard === 'function' && this._deleteSelectedGraphInPipCard()) {
            return true;
          }
          if (this.selectedTextLabelId) {
            this.removeTextLabel(this.selectedTextLabelId);
            this.selectedTextLabelId = null;
            return true;
          }
          if (!this.isGraphCovered && this.activeGraphIdx >= 0 && this.activeGraphIdx < this.graphs.length) {
            const targetIdx = this.activeGraphIdx;
            this.selectedHandleIdx = null;
            this.isCurveSelected = false;
            this.removeGraph(targetIdx);
            return true;
          }
          return false;
        }
        case 'sys_copy_image': {
          const sel = (typeof window.getSelection === 'function') ? String(window.getSelection()) : '';
          if (sel && sel.trim().length > 0) return false;
          this.copyToClipboard();
          return true;
        }
        case 'sys_record_toggle': {
          if (this.isAudioRecording) {
            this._isAudioRecMenuOpen = false;
            this.togglePauseAudioRecording();
          } else {
            this._isAudioRecMenuOpen = false;
            this.startAudioRecording();
          }
          return true;
        }
        case 'sys_record_stop': {
          if (this.isAudioRecording) {
            this._isAudioRecMenuOpen = false;
            this.stopAudioRecording();
            return true;
          }
          return false;
        }
        case 'sys_fullscreen_toggle': {
          const btn = document.getElementById('btnFullscreen');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        case 'sys_toggle_hide_ui': {
          this.toggleAllUIHidden();
          return true;
        }
        case 'sys_open_cloud_hub': {
          if (this.isAllUIHidden) return false;
          const btn = document.getElementById('btnCloudHub');
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        }
        default:
          return false;
      }
    }

    showToast(message) {
      // [대표님 기획]: 캔버스 몰입감 극대화를 위해 하단 안내창(토스트) 팝업 완전 비활성화.
      // 단축키 및 기능 안내는 버튼 hover 툴팁(title)으로 제공하여 시각적 잡음 100% 제거.
      return;
    }
  }.prototype);
  delete _desc.constructor;
  Object.defineProperties(GraphApp.prototype, _desc);
}

// 브라우저 로딩 후 초기화
window.addEventListener('DOMContentLoaded', () => {
  window.graphApp = new GraphApp();
});
