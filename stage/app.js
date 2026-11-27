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
      this._isStartingAudioRecording = false;
      this._stoppingAudioRecordingPromise = null;
      this.isAudioRecordPaused = false;
      this._autoPausedByAppBackground = false;
      this._hadBackgroundInterruptDuringPause = false;
      this._hadActiveMicInSession = false;
      this._confirmedSilentRecordInSession = false;
      this._isPromptingSlideAudioOverwrite = false;
      this._micTrackLostInSession = false;
      this._notifiedMicLostInSession = false;
      this._audioReplayBlobUrlMap = new Map();
      this._replaySavedLivePrimaryProb = null;
      this._audioWakeLockSentinel = null;
      this._pendingAudioResumePromise = null;
      this.isAudioMicMuted = false;
      this._pendingSlideAudioFinalizers = [];
      this._lastRecorderStopPromise = null;
      this._pendingSlideRecorderStarter = null;
      this._recorderBootHoldStartMs = 0;
      this._isPausedStandbyOnSlide = false;
      this._standbyExistingStrokeIds = null;
      this._standbyExistingStickers = null;
      this.audioRecordStartMs = 0;
      this.audioRecordPauseStartMs = 0;
      this.audioRecordTotalPausedMs = 0;
      this.audioMediaRecorder = null;
      this.audioMediaStream = null;
      this.audioRecordedChunks = [];
      this.audioTimeline = [];
      this.audioLaserStrokes = [];
      this.audioErasedStrokes = [];
      this.audioCardAssetPool = {};
      this.audioArchivedPdfBoards = {};
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
      this._audioPlayerGestureUnlocked = false;
      this._audioUnlockSeq = 0;
      this._notifiedAudioCodecUnsupported = false;
      this._audioReadyGateSeq = 0;
      this._audioReadyGate = null;
      this._pendingAudioMetaSeekCleanup = null;
      this._pllLargeDriftFrames = 0;
      this._pllLastAudioTimeSec = -1;
      this._pllLastAudioAdvancePerf = 0;
      this._preReplayLiveState = null;
      this._pendingAppendedSlideUid = '';
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
      const btnSeekBack10 = document.getElementById('btnAudioSeekBack10');
      const btnSeekFwd10 = document.getElementById('btnAudioSeekFwd10');
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
        // 창 내림(백그라운드 전환)으로 자동 일시정지된 상태에서 복귀 후 바로 칠판·카드 판서를 시작하면 첫 획부터 유실 없이 즉시 이어녹화!
        window.addEventListener('pointerdown', (e) => {
          if (!this.isAudioRecording || !this.isAudioRecordPaused || !this._autoPausedByAppBackground) return;
          if (this.isPdfModalOpen || this.isMathToolkitOpen || this.isNAxisStudioOpen || this._activeToolkitModalId) return;
          if (typeof e.button === 'number' && e.button !== 0 && e.pointerType === 'mouse') return;
          const t = e.target;
          if (!t || typeof t.closest !== 'function') return;
          if (t.closest(
            '#wrapAudioRecordToggle, #wrapStealthRecordDot, button, a, input, select, textarea, label, ' +
            '.modal-backdrop, .cloud-modal-backdrop, .n-axis-studio-backdrop, #sidebarRail, #railDrawer, ' +
            '#inkFloatingToolbar, #inkShapesPopover, #inkClipsPopover, #rightActionToolbar, #quickPillRemote, .problem-card-header, .card-btn'
          )) {
            return;
          }
          if (t.id === 'graphCanvas' || t.closest('#graphCanvas, .problem-card-body, .card-ink-canvas')) {
            this._isAudioRecMenuOpen = false;
            this.togglePauseAudioRecording(false);
          }
        }, { capture: true, passive: true });

        window.addEventListener('pointerdown', (e) => {
          if (!this._isAudioRecMenuOpen) return;
          if (this.isAudioRecording && this.isAudioRecordPaused && this._autoPausedByAppBackground) return;
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
            this._unlockAudioPlayerForMobileGesture(false);
            this.playAudioSync();
          }
        };
      }

      const seekByDeltaMs = (deltaMs) => {
        if (!this.audioSyncData) return;
        const dur = this.audioSyncData.durationMs || 1000;
        const nextMs = Math.max(0, Math.min(dur, (this.audioPlayCurrentMs || 0) + deltaMs));
        this.seekAudioSync(nextMs, false);
      };
      if (btnSeekBack10) {
        btnSeekBack10.onclick = (e) => {
          e.stopPropagation();
          seekByDeltaMs(-10000);
        };
      }
      if (btnSeekFwd10) {
        btnSeekFwd10.onclick = (e) => {
          e.stopPropagation();
          seekByDeltaMs(10000);
        };
      }

      if (scrubber) {
        const onScrubStart = () => {
          if (!this._isScrubbingAudioBar) {
            this._wasPlayingBeforeScrub = Boolean(this.isAudioPlaying);
            this._isScrubbingAudioBar = true;
            if (this._wasPlayingBeforeScrub) {
              this.isAudioPlaying = false;
              if (this._audioReplayRafId) {
                cancelAnimationFrame(this._audioReplayRafId);
                this._audioReplayRafId = null;
              }
              if (this.audioPlayerEl) {
                try { this.audioPlayerEl.pause(); } catch (_) { }
              }
            }
          }
          this.showAudioPlayerBarTemporarily(2800);
        };
        const onScrubEnd = () => {
          if (!this._isScrubbingAudioBar) return;
          const resumePlay = Boolean(this._wasPlayingBeforeScrub);
          this._isScrubbingAudioBar = false;
          this._wasPlayingBeforeScrub = false;
          const finalMs = Number(scrubber.value);
          const safeFinalMs = Number.isFinite(finalMs) ? finalMs : (this.audioPlayCurrentMs || 0);
          if (resumePlay) {
            this.playAudioSync(safeFinalMs);
          } else {
            this.seekAudioSync(safeFinalMs, false);
          }
          this.showAudioPlayerBarTemporarily(2800);
        };
        scrubber.addEventListener('input', (e) => {
          e.stopPropagation();
          const targetMs = Number(e.target.value) || 0;
          this.seekAudioSync(targetMs, false, { visualOnlyWhileScrubbing: Boolean(this._isScrubbingAudioBar) });
          this.showAudioPlayerBarTemporarily(2800);
        });
        scrubber.addEventListener('change', (e) => {
          e.stopPropagation();
          if (this._isScrubbingAudioBar) {
            onScrubEnd();
          }
        });
        scrubber.addEventListener('pointerdown', onScrubStart, { passive: true });
        scrubber.addEventListener('touchstart', onScrubStart, { passive: true });
        window.addEventListener('pointerup', onScrubEnd, { passive: true });
        window.addEventListener('pointercancel', onScrubEnd, { passive: true });
        window.addEventListener('touchend', onScrubEnd, { passive: true });
        window.addEventListener('touchcancel', onScrubEnd, { passive: true });
        window.addEventListener('blur', onScrubEnd, { passive: true });
      }

      if (btnSpeed) {
        const speeds = [1.0, 1.25, 1.5, 2.0, 0.8];
        btnSpeed.onclick = (e) => {
          e.stopPropagation();
          const idx = speeds.indexOf(this.audioPlaybackRate);
          const nextRate = speeds[(idx + 1) % speeds.length];
          if (this.isAudioPlaying) {
            const curMs = Math.max(0, Number(this.audioPlayCurrentMs) || 0);
            this._audioPlayBaseOffsetMs = curMs;
            this._audioPlayWallStartMs = performance.now();
            this._lastStepReplayMs = curMs;
          }
          this.audioPlaybackRate = nextRate;
          btnSpeed.textContent = `${this.audioPlaybackRate}x`;
          if (this.audioPlayerEl) {
            try {
              this.audioPlayerEl.defaultPlaybackRate = this.audioPlaybackRate;
              this.audioPlayerEl.playbackRate = this.audioPlaybackRate;
            } catch (_) { }
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
          if (typeof this._clearAudioEndingCountdown === 'function') {
            this._clearAudioEndingCountdown(true);
          }
          if (this.isAudioPlaying) {
            this.pauseAudioPlayback(false);
          } else if (this.audioPlayerEl && !this.audioPlayerEl.paused) {
            try { this.audioPlayerEl.pause(); } catch (e) { }
          } else if (!this.isAudioRecording) {
            this._releaseAudioRecordWakeLock();
          }
        };

        const pauseAudioRecordingOnBackground = () => {
          if (!this.isAudioRecording) return;
          this._hadBackgroundInterruptDuringPause = true;
          this._releaseAudioRecordWakeLock();
          if (!this.isAudioRecordPaused) {
            this._flushRecorderBootHoldIfActive(true, true);
            this._autoPausedByAppBackground = true;
            this._recordAudioWorkspaceStateIfNeeded(true);
            this.isAudioRecordPaused = true;
            this.audioRecordPauseStartMs = performance.now();
            if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'recording') {
              try {
                if (typeof this.audioMediaRecorder.requestData === 'function') {
                  this.audioMediaRecorder.requestData();
                }
              } catch (e) { }
              try { this.audioMediaRecorder.pause(); } catch (e) { }
            }
            this.syncAudioRecordUI();
          } else if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'paused') {
            try {
              if (typeof this.audioMediaRecorder.requestData === 'function') {
                this.audioMediaRecorder.requestData();
              }
            } catch (e) { }
          }
        };

        const onAppReturnedToForeground = () => {
          if (!this.isAudioRecording) {
            if (this.isStudentAudioVideoOnlyMode && this.isAudioPlaying) {
              this._acquireAudioRecordWakeLock();
            }
            return;
          }
          if (!this.isAudioRecordPaused) {
            this._acquireAudioRecordWakeLock();
            return;
          }
          if (
            this._autoPausedByAppBackground &&
            !this.isPdfModalOpen &&
            !this.isMathToolkitOpen &&
            !this.isNAxisStudioOpen &&
            !this._activeToolkitModalId
          ) {
            this._isAudioRecMenuOpen = true;
            this.syncAudioRecordUI();
          }
        };

        document.addEventListener('visibilitychange', () => {
          if (document.hidden || document.visibilityState === 'hidden') {
            pauseAudioOnAppBackground();
            pauseAudioRecordingOnBackground();
          } else {
            onAppReturnedToForeground();
          }
        });

        window.addEventListener('pagehide', () => {
          pauseAudioOnAppBackground();
          pauseAudioRecordingOnBackground();
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
          this.audioLaserStrokes = [];
          this.audioErasedStrokes = [];
          this.audioCardAssetPool = {};
          this.audioArchivedPdfBoards = {};
          this._isAudioSyncPlayerVisible = false;
          this._slideDirty = true;
          if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides[this.lessonPlaylistIndex] && typeof this.saveCurrentSlideIntoPlaylist === 'function') {
            this.saveCurrentSlideIntoPlaylist();
          }
          this.syncAudioRecordUI();
          this.render();
        };
      }

      const btnBackToViewer = document.getElementById('btnAudioBackToViewer');
      if (btnBackToViewer) {
        btnBackToViewer.onclick = async (e) => {
          e.stopPropagation();
          const curIdx = (this.isLessonPlaylistActive && typeof this.lessonPlaylistIndex === 'number')
            ? this.lessonPlaylistIndex
            : (this._viewerSlideIdx || 0);
          const curPlayMs = Number(this.audioPlayCurrentMs) || 0;
          const totalDurMs = Number(this.audioSyncData && this.audioSyncData.durationMs) || 0;
          const endingOv = document.getElementById('viewerAudioEndingOverlay');
          const isEndingShown = Boolean(endingOv && endingOv.style.display !== 'none');
          if (!isEndingShown && curPlayMs >= 800 && (totalDurMs <= 0 || curPlayMs < totalDurMs - 1200)) {
            this._setViewerSavedPlayMs(curIdx, curPlayMs);
          } else {
            this._setViewerSavedPlayMs(curIdx, 0);
          }
          this.stopAudioPlayback(true);
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

      const endingOverlay = document.getElementById('viewerAudioEndingOverlay');
      const btnEndingCurNote = document.getElementById('btnAudioEndingCurNote');
      const btnEndingNextNote = document.getElementById('btnAudioEndingNextNote');
      const btnEndingReplay = document.getElementById('btnAudioEndingReplay');
      const btnEndingNextVideo = document.getElementById('btnAudioEndingNextVideo');
      if (endingOverlay) {
        endingOverlay.onclick = (e) => {
          if (e.target === endingOverlay && typeof this.hideAudioLectureEndingOverlay === 'function') {
            e.stopPropagation();
            this.hideAudioLectureEndingOverlay();
            if (typeof this._clearAudioPlayerBarAutoHide === 'function') {
              this._clearAudioPlayerBarAutoHide();
            }
            if (typeof this.syncAudioRecordUI === 'function') {
              this.syncAudioRecordUI();
            }
          }
        };
      }
      if (btnEndingCurNote) {
        btnEndingCurNote.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof this.openNoteViewerFromEndingOverlay === 'function') {
            this.openNoteViewerFromEndingOverlay(0);
          }
        };
      }
      if (btnEndingNextNote) {
        btnEndingNextNote.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof this.openNoteViewerFromEndingOverlay === 'function') {
            this.openNoteViewerFromEndingOverlay(1);
          }
        };
      }
      if (btnEndingReplay) {
        btnEndingReplay.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._unlockAudioPlayerForMobileGesture(false);
          if (typeof this.replayFromAudioLectureEndingOverlay === 'function') {
            this.replayFromAudioLectureEndingOverlay();
          }
        };
      }
      if (btnEndingNextVideo) {
        btnEndingNextVideo.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._unlockAudioPlayerForMobileGesture(false);
          if (typeof this.advanceToNextVideoFromEndingOverlay === 'function') {
            this.advanceToNextVideoFromEndingOverlay(false);
          }
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
        const handleAudioPointerSample = (e, sampleMode = 'move') => {
          const forceClickDown = (sampleMode === 'down');
          const isPointerUp = (sampleMode === 'up');
          if (e.pointerType === 'pen') this._markStylusPenDetected();
          if (!this.isAudioRecording || this.isAudioRecordPaused || this.isPdfModalOpen || this._isAudioWaitingForNextSlideSetup) return;
          // WebKit pointercancel 및 합성 (0, 0) 오프셋 이벤트가 타임라인 커서를 화면 좌상단으로 튀게 하는 현상 차단
          if (e.type === 'pointercancel') return;
          if (sampleMode !== 'move' && e.clientX === 0 && e.clientY === 0) return;
          if (!isPointerUp && (this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser)) {
            this._lastAudioInkActivePerfMs = performance.now();
          }
          // 필기 또는 레이저 드로잉 중(move)에는 스트로크 자체 점 배열(pt.t)이 정밀 기록되므로 중복 호버 샘플링을 건너뛰어 녹화 중 필기 렉 0% 달성!
          // 단, 펜을 떼는 순간(up)에는 마지막 펜 끝 좌표를 1점 정확히 기록하여 다음 UI 터치/다음 필기로의 비행 시작점을 고정!
          if (sampleMode === 'move' && (this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser)) return;
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
          const rawPointerType = (e && typeof e.pointerType === 'string' && e.pointerType) ? e.pointerType : 'mouse';
          // 🌟 [창(카드) 드래그·리사이즈 중 최우선 포인터 잠금]:
          // window capture 리스너가 카드의 bubbling 이동 갱신보다 먼저 실행되므로, 빠른 드래그 시 마우스가 순간적으로
          // 32px 카드 헤더 밖(#graphCanvas·툴바)으로 벗어나더라도 ✏️펜/👆손가락으로 깜빡이지 않도록 최우선 고정!
          const activeDraggingCardEl = (typeof document !== 'undefined')
            ? document.querySelector('#problemCardWidget.is-dragging-card, #graphCardWidget.is-dragging-card, .extra-problem-card-widget.is-dragging-card, .extra-graph-card-widget.is-dragging-card')
            : null;
          if (activeDraggingCardEl) {
            this.recordAudioCursorPoint(
              e.clientX,
              e.clientY,
              this.currentInkColor || '#00d2d3',
              !isPointerUp,
              {
                uiBarId: this.getAudioCardKey(activeDraggingCardEl) || activeDraggingCardEl.id || '',
                cursorKind: isPointerUp ? 'grab' : 'grabbing',
                uiScreen: true,
                isRelease: isPointerUp,
                pointerType: rawPointerType
              }
            );
            return;
          }
          if (this._isDraggingOrResizingAnyCard && this._activeCardResizeEl) {
            const rzEl = this._activeCardResizeEl;
            this.recordAudioCursorPoint(
              e.clientX,
              e.clientY,
              this.currentInkColor || '#00d2d3',
              !isPointerUp,
              {
                uiBarId: this.getAudioCardKey(rzEl) || rzEl.id || '',
                cursorKind: 'nwse-resize',
                uiScreen: true,
                isRelease: isPointerUp,
                pointerType: rawPointerType
              }
            );
            return;
          }
          // 🌟 칠판 가림막 스티커(아직 열리지 않은 노란 가림막) 위에서는 손가락(pointer) 클릭 커서로 표시!
          const blindStickerHit = (!this.isInkMode || (this.activeInkTool !== 'sticker' && this.activeInkTool !== 'eraser'))
            ? (tEl && tEl.closest && tEl.closest('.workspace-sticker-item:not(.revealed), .card-sticker-item:not(.revealed)'))
            : null;
          if (blindStickerHit && !blindStickerHit.closest('#problemCardWidget, #graphCardWidget, .extra-problem-card-widget, .extra-graph-card-widget')) {
            const isDownSticker = isPointerUp ? false : Boolean(forceClickDown || (typeof e.buttons === 'number' && e.buttons > 0));
            const stPos = this._clientToStageCanvasPos(e.clientX, e.clientY);
            this.recordAudioCursorPoint(
              stPos.x,
              stPos.y,
              this.currentInkColor || '#00d2d3',
              isDownSticker,
              { cursorKind: 'pointer', isRelease: isPointerUp, pointerType: rawPointerType }
            );
            return;
          }
          // 🌟 [대표님 핵심 UX]: 메뉴바 / 슬라이드 선택바 / 툴바 / 서랍 / 서브 팝오버 위로 마우스가 올라가면 펜이 사라지고 손가락(pointer) 또는 화살표(arrow) 아이콘으로 즉시 전환 기록!
          // 단, PiP 그래프 카드 내부 핸들/곡선을 드래그 중인 경우(_isInteractingWithPipCard)에는 카드 밖 UI 위를 스쳐도 카드 드래그를 유지!
          let directUiHit = !(this._isInteractingWithPipCard && this._activePipInteractionCardEl) && Boolean(tEl && tEl.closest && (
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
            tEl.closest('#railAddTargetPopover') ||
            tEl.closest('#railResetBoardPopover') ||
            tEl.closest('.canvas-quick-toolbar') ||
            tEl.closest('#rightActionToolbar') ||
            tEl.closest('.quick-flyout-panel') ||
            tEl.closest('#panelQuickTheme') ||
            tEl.closest('#panelQuickExport') ||
            tEl.closest('.ink-floating-toolbar') ||
            tEl.closest('#inkFloatingToolbar') ||
            tEl.closest('#inkSizeFlyout') ||
            tEl.closest('.ink-size-flyout') ||
            tEl.closest('.lesson-playlist-nav-bar') ||
            tEl.closest('#lessonPlaylistNavBar') ||
            tEl.closest('#pdfBoardGridPopover') ||
            tEl.closest('#playlistGridPopover') ||
            tEl.closest('#playlistAddSlideMenu') ||
            tEl.closest('.curve-context-bar') ||
            tEl.closest('#curveContextBar') ||
            tEl.closest('#ctxSymmetryPopover') ||
            tEl.closest('#ctxAbsPopover') ||
            tEl.closest('.lasso-action-floating-bar') ||
            tEl.closest('#lassoActionFloatingBar') ||
            tEl.closest('#inkShapesPopover') ||
            tEl.closest('.ink-shapes-popover') ||
            tEl.closest('#inkClipsPopover') ||
            tEl.closest('.ink-clips-popover') ||
            tEl.closest('#modalSaveInkClip') ||
            tEl.closest('.graph-snap-floating-bar') ||
            tEl.closest('#graphSnapFloatingBar') ||
            tEl.closest('#pdfToGraphCropFloatingBar') ||
            tEl.closest('.pw-region-popover') ||
            tEl.closest('#pwRegionPopover') ||
            tEl.closest('#btnRestoreAllUITab') ||
            tEl.closest('#headerShowTab') ||
            tEl.closest('header')
          ));
          if (directUiHit) {
            const isDragHandle = Boolean(tEl && tEl.closest && tEl.closest('.ink-dock-drag-handle, .pill-drag-handle, .pill-remote-drag-handle'));
            const isInteractiveBtn = Boolean(tEl && tEl.closest && tEl.closest(
              'button, a, label, input, select, summary, [role="button"], .func-btn, .preset-card, .rail-btn, .ink-tool-btn, .ink-color-dot, .lasso-color-dot, .pill-mod-chip, .pill-remote-btn, .pill-color-dot, .pill-remote-swap-btn, .pill-remote-expand-btn, .pill-remote-close-btn, .theme-chip, .ink-size-btn, .single-line-step-btn, .quick-fab-btn, .slide-num-chip, .cat-tab-btn, .card-btn, .pip-pop-btn, .ctx-btn, .lasso-action-btn, .pw-popover-item, .custom-preset-chip, .export-preset-btn'
            ));
            const isDownUI = isPointerUp ? false : Boolean(forceClickDown || (typeof e.buttons === 'number' && e.buttons > 0));
            const uiCursorKind = isDragHandle
              ? (isDownUI ? 'grabbing' : 'grab')
              : (isInteractiveBtn ? 'pointer' : 'arrow');
            const uiMeta = this._extractAudioUiTargetMeta(tEl, e.clientX, e.clientY);
            this.recordAudioCursorPoint(
              e.clientX,
              e.clientY,
              this.currentInkColor || '#00d2d3',
              isDownUI,
              { ...uiMeta, cursorKind: uiCursorKind, uiScreen: true, isRelease: isPointerUp, pointerType: rawPointerType }
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
            const isDownCard = isPointerUp
              ? false
              : Boolean(forceClickDown || this._isInteractingWithPipCard || (typeof e.buttons === 'number' && e.buttons > 0));
            // 카드 우하단 리사이즈 핸들 위에서는 대각선 양방향 화살표(nwse-resize)!
            if (!this._isInteractingWithPipCard && tEl && tEl.closest && tEl.closest('.problem-card-resize-handle, .card-resize-handle')) {
              this.recordAudioCursorPoint(
                e.clientX,
                e.clientY,
                this.currentInkColor || '#00d2d3',
                isDownCard,
                { uiBarId: this.getAudioCardKey(cardEl) || cardEl.id || '', cursorKind: 'nwse-resize', uiScreen: true, isRelease: isPointerUp, pointerType: rawPointerType }
              );
              return;
            }
            // 카드 상단 버튼([대칭 ▾], [↕ x축 | ↔ y축 | ⤡ 원점], [|f|], [📍수선], [레이저], [⛶], [✕] 등) 위에서는 손가락(pointer) 아이콘!
            if (!this._isInteractingWithPipCard && tEl && tEl.closest && tEl.closest('button, .card-btn, .pip-pop-btn, .pip-hdr-popover, .problem-card-actions button')) {
              const uiMeta = this._extractAudioUiTargetMeta(tEl, e.clientX, e.clientY);
              this.recordAudioCursorPoint(
                e.clientX,
                e.clientY,
                this.currentInkColor || '#00d2d3',
                isDownCard,
                { ...uiMeta, cursorKind: 'pointer', uiScreen: true, isRelease: isPointerUp, pointerType: rawPointerType }
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
                  const isCardStickerClick = Boolean(
                    blindStickerHit &&
                    blindStickerHit.closest('.problem-card-body') === bodyEl
                  );
                  const isCardInkOn = Boolean(
                    cardEl.classList.contains('card-ink-active') &&
                    this.isInkMode &&
                    (this.activeInkTool === 'pen' || this.activeInkTool === 'highlighter' || this.activeInkTool === 'eraser' || this.activeInkTool === 'lasso' || this.activeInkTool === 'sticker')
                  );
                  let cardBodyKind = isDownCard ? 'grabbing' : 'grab';
                  if (isCardStickerClick) {
                    cardBodyKind = 'pointer';
                  } else if (isLaser) {
                    cardBodyKind = 'laser';
                  } else if (isCardInkOn) {
                    if (this.activeInkTool === 'sticker') {
                      cardBodyKind = 'crosshair';
                    } else if (this.activeInkTool === 'lasso') {
                      const lc = (cardEl.dataset && cardEl.dataset.lassoCursor) || 'crosshair';
                      cardBodyKind = lc === 'rotating'
                        ? 'grabbing'
                        : (lc === 'rotate' ? 'grab' : (lc === 'nwse' ? 'nwse-resize' : (lc === 'nesw' ? 'nesw-resize' : (lc === 'move' ? 'move' : 'crosshair'))));
                    } else {
                      cardBodyKind = this.activeInkTool;
                    }
                  }
                  this.recordAudioCursorPoint(
                    e.clientX,
                    e.clientY,
                    isLaser ? '#dc2626' : (this.currentInkColor || '#00d2d3'),
                    isDownCard,
                    { cardKey: this.getAudioCardKey(cardEl), nx, ny, isLaser, cursorKind: cardBodyKind, isRelease: isPointerUp, pointerType: rawPointerType }
                  );
                  return;
                }
              }
            }
            // 카드 헤더를 잡고 이동/조작하는 경우 손바닥(grab/grabbing) 아이콘!
            this.recordAudioCursorPoint(
              e.clientX,
              e.clientY,
              this.currentInkColor || '#00d2d3',
              isDownCard,
              { uiBarId: this.getAudioCardKey(cardEl) || cardEl.id || '', cursorKind: isDownCard ? 'grabbing' : 'grab', uiScreen: true, isRelease: isPointerUp, pointerType: rawPointerType }
            );
            return;
          }
          // 일반 캔버스 위 호버링 및 그래프 극점 드래그/조작 모두 포함!
          const isDown = isPointerUp
            ? false
            : Boolean(
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
          const cPos = this._clientToStageCanvasPos(e.clientX, e.clientY);
          this.recordAudioCursorPoint(
            cPos.x,
            cPos.y,
            this.currentInkColor || '#00d2d3',
            isDown,
            isPointerUp ? { isRelease: true, pointerType: rawPointerType } : { pointerType: rawPointerType }
          );
        };
        window.addEventListener('pointermove', (e) => handleAudioPointerSample(e, 'move'), { passive: true, capture: true });
        window.addEventListener('pointerdown', (e) => handleAudioPointerSample(e, 'down'), { passive: true, capture: true });
        window.addEventListener('pointerup', (e) => handleAudioPointerSample(e, 'up'), { passive: true, capture: true });
        document.addEventListener('scroll', (e) => {
          if (!this.isAudioRecording || this.isAudioRecordPaused || this.isPdfModalOpen || this._isApplyingAudioTimelineState) return;
          const tEl = e && e.target;
          if (tEl && typeof tEl.closest === 'function' && tEl.closest('#railDrawer')) {
            this._recordAudioWorkspaceStateIfNeeded(false);
          }
        }, { passive: true, capture: true });
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

    _flushRecorderBootHoldIfActive(applyToSlideClock = true, applyToSessionClock = true) {
      if (!this._recorderBootHoldStartMs || this._recorderBootHoldStartMs <= 0) return 0;
      const nowPerf = performance.now();
      const effectiveEnd = this.isAudioRecordPaused
        ? (this.audioRecordPauseStartMs || nowPerf)
        : nowPerf;
      const heldDelta = Math.max(0, effectiveEnd - this._recorderBootHoldStartMs);
      this._recorderBootHoldStartMs = 0;
      if (heldDelta > 0) {
        if (applyToSlideClock) {
          this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + heldDelta;
        }
        if (applyToSessionClock) {
          this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + heldDelta;
        }
      }
      return heldDelta;
    }

    _captureStandbyBaselineItems() {
      const strokeIds = new Set();
      const stickerSet = new Set();
      const collectStrokes = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(st => {
          if (!st) return;
          if (!st.id) {
            st.id = this._nextAudioStrokeId(st.isGraphStamp ? 'gstamp' : (st.isProblemStamp ? 'pstamp' : 'ink'));
          }
          strokeIds.add(st.id);
        });
      };
      const collectStickers = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(stk => {
          if (stk) stickerSet.add(stk);
        });
      };
      collectStrokes(this.inkStrokes);
      collectStrokes(this.problemInkStrokes);
      collectStrokes(this.graphInkStrokes);
      collectStickers(this.boardStickers);
      collectStickers(this.problemCardStickers);
      collectStickers(this.graphCardStickers);
      if (this.extraProblemCards) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el) {
            collectStrokes(c.el._cardInkStrokes);
            collectStickers(c.el._cardStickers);
          }
        });
      }
      if (this.extraGraphCards) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el) {
            collectStrokes(c.el._cardInkStrokes);
            collectStickers(c.el._cardStickers);
          }
        });
      }
      this._standbyExistingStrokeIds = strokeIds;
      this._standbyExistingStickers = stickerSet;
    }

    _normalizePausedStandbyMutations() {
      if (!this._isPausedStandbyOnSlide) return;
      const baseIds = this._standbyExistingStrokeIds instanceof Set ? this._standbyExistingStrokeIds : null;
      const baseStickers = this._standbyExistingStickers instanceof Set ? this._standbyExistingStickers : null;
      const normStrokes = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(st => {
          if (!st) return;
          if (!baseIds || !st.id || !baseIds.has(st.id)) {
            st.preExisting = true;
            delete st.tStart;
            delete st.tEnd;
            delete st.shapeSnapAt;
            delete st._lassoOpId;
            delete st._lassoOpStartMs;
          }
        });
      };
      const normStickers = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(stk => {
          if (stk && (!baseStickers || !baseStickers.has(stk)) && stk.tStart !== undefined) {
            delete stk.tStart;
          }
        });
      };
      normStrokes(this.inkStrokes);
      normStrokes(this.problemInkStrokes);
      normStrokes(this.graphInkStrokes);
      normStickers(this.boardStickers);
      normStickers(this.problemCardStickers);
      normStickers(this.graphCardStickers);
      if (this.extraProblemCards) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el) {
            normStrokes(c.el._cardInkStrokes);
            normStickers(c.el._cardStickers);
          }
        });
      }
      if (this.extraGraphCards) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el) {
            normStrokes(c.el._cardInkStrokes);
            normStickers(c.el._cardStickers);
          }
        });
      }
    }

    getAudioRecordElapsedMs() {
      if (!this.isAudioRecording || !this.audioRecordStartMs) return 0;
      const rawNow = performance.now();
      const bootHoldMs = (this._recorderBootHoldStartMs && this._recorderBootHoldStartMs > 0)
        ? this._recorderBootHoldStartMs
        : Infinity;
      const now = this.isAudioRecordPaused
        ? Math.min(this.audioRecordPauseStartMs || rawNow, bootHoldMs)
        : Math.min(rawNow, bootHoldMs);
      const pausedTotal = this.audioRecordTotalPausedMs || 0;
      return Math.max(0, Math.round(now - this.audioRecordStartMs - pausedTotal));
    }

    getAudioSessionElapsedMs() {
      if (!this.isAudioRecording || !this.audioSessionStartMs) return 0;
      const rawNow = performance.now();
      const bootHoldMs = (this._recorderBootHoldStartMs && this._recorderBootHoldStartMs > 0)
        ? this._recorderBootHoldStartMs
        : Infinity;
      const now = this.isAudioRecordPaused
        ? Math.min(this.audioRecordPauseStartMs || rawNow, bootHoldMs)
        : Math.min(rawNow, bootHoldMs);
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
      return (cfg && cfg.freeMaxRecordMs) ? cfg.freeMaxRecordMs : (5 * 60 * 1000);
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

    // 현재 1회 연속 녹화 세션의 경과 시간 반환 (요금제 기준: 1회 연속 녹화 무료 5분 / Pro·Premium 60분)
    getTotalLessonRecordedDurationMs() {
      return this.getAudioSessionElapsedMs();
    }

    _estimateOtherSlidesPayloadBytes() {
      const estimateAudioPayloadBytes = (rawUrl, durMs = 0) => {
        if (typeof rawUrl !== 'string' || rawUrl.length === 0) return 0;
        if (rawUrl.startsWith('data:')) {
          const commaIdx = rawUrl.indexOf(',');
          const b64Len = commaIdx >= 0 ? (rawUrl.length - commaIdx - 1) : 0;
          return b64Len > 0 ? Math.floor(b64Len * 0.75) : 0;
        }
        if (/^(?:blob:|https?:)/i.test(rawUrl)) {
          return Math.max(0, Math.round((Number(durMs) || 0) * 4.5));
        }
        return Math.floor(rawUrl.length * 0.75);
      };
      let totalBytes = 0;
      if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides)) {
        const curIdx = this.lessonPlaylistIndex || 0;
        for (let i = 0; i < this.lessonPlaylistSlides.length; i++) {
          if (i === curIdx) continue; // 현재 슬라이드는 재녹화 시 덮어쓰기되므로 제외
          const sl = this.lessonPlaylistSlides[i];
          const aud = sl && sl.audioSyncData;
          if (!aud) continue;
          if (Array.isArray(aud.audioSegments) && aud.audioSegments.length > 0) {
            for (let s = 0; s < aud.audioSegments.length; s++) {
              const seg = aud.audioSegments[s];
              if (seg && typeof seg.audioDataUrl === 'string' && seg.audioDataUrl.length > 0) {
                const segDur = Number(seg.durationMs) || Math.max(0, (Number(seg.endMs) || 0) - (Number(seg.startMs) || 0));
                totalBytes += estimateAudioPayloadBytes(seg.audioDataUrl, segDur);
              }
            }
          } else if (typeof aud.audioDataUrl === 'string' && aud.audioDataUrl.length > 0) {
            totalBytes += estimateAudioPayloadBytes(aud.audioDataUrl, aud.durationMs);
          } else if (typeof aud.audioBase64 === 'string' && aud.audioBase64.length > 0) {
            totalBytes += Math.floor(aud.audioBase64.length * 0.75);
          }
        }
      }
      if (this._pdfSourceRegistry && typeof this._pdfSourceRegistry === 'object') {
        const uids = Object.keys(this._pdfSourceRegistry);
        for (let k = 0; k < uids.length; k++) {
          const entry = this._pdfSourceRegistry[uids[k]];
          if (entry && entry.bytes && entry.bytes.byteLength > 0) {
            totalBytes += entry.bytes.byteLength;
          }
        }
      } else if (this._cachedPdfBytes && this._cachedPdfBytes.byteLength > 0) {
        totalBytes += this._cachedPdfBytes.byteLength;
      }
      return totalBytes;
    }

    _syncAudioRecPopupHudTime() {
      const timeStr = this.isAudioRecording
        ? this.formatAudioTimeMmSs(
          this.audioSessionStartMs
            ? this.getAudioSessionElapsedMs()
            : this.getAudioRecordElapsedMs()
        )
        : '00:00';
      const elMain = document.getElementById('lblAudioRecHudTime');
      if (elMain && elMain.textContent !== timeStr) elMain.textContent = timeStr;
      const elStealth = document.getElementById('lblStealthRecHudTime');
      if (elStealth && elStealth.textContent !== timeStr) elStealth.textContent = timeStr;
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
      const totalElapsed = this.getAudioSessionElapsedMs();

      // 제한 시간(비로그인·무료 5분 / Pro·Premium 60분) 도달 시 데이터 보호를 위해 안전하게 자동 마감
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

    async _acquireAudioRecordWakeLock() {
      try {
        if (!this.isAudioRecording || this.isAudioRecordPaused) return;
        if (typeof document !== 'undefined' && (document.hidden || document.visibilityState === 'hidden')) return;
        if (typeof navigator === 'undefined' || !navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
        if (this._audioWakeLockSentinel && !this._audioWakeLockSentinel.released) return;
        const sentinel = await navigator.wakeLock.request('screen');
        if (!this.isAudioRecording || this.isAudioRecordPaused || (typeof document !== 'undefined' && document.hidden)) {
          try { await sentinel.release(); } catch (_) { }
          return;
        }
        this._audioWakeLockSentinel = sentinel;
        try {
          sentinel.addEventListener('release', () => {
            if (this._audioWakeLockSentinel === sentinel) {
              this._audioWakeLockSentinel = null;
            }
          }, { once: true });
        } catch (_) { }
      } catch (_) { }
    }

    _releaseAudioRecordWakeLock() {
      const s = this._audioWakeLockSentinel;
      this._audioWakeLockSentinel = null;
      if (s) {
        try {
          if (!s.released && typeof s.release === 'function') {
            s.release().catch(() => { });
          }
        } catch (_) { }
      }
    }

    _isAudioRecordPipelineHealthy() {
      const rec = this.audioMediaRecorder;
      if (!rec || rec._brokenByError || rec.state === 'inactive') return false;
      if (!this.audioMediaStream || typeof this.audioMediaStream.getAudioTracks !== 'function') return false;
      const mediaTracks = this.audioMediaStream.getAudioTracks();
      if (!mediaTracks.length || !mediaTracks.some(tr => tr && tr.readyState === 'live')) return false;
      if (this.audioRawStream && typeof this.audioRawStream.getAudioTracks === 'function') {
        const rawTracks = this.audioRawStream.getAudioTracks();
        if (!rawTracks.length || !rawTracks.some(tr => tr && tr.readyState === 'live')) return false;
        if (this._hadBackgroundInterruptDuringPause && rawTracks.every(tr => tr && tr.muted)) return false;
      }
      if (this._audioVoiceContext && this._audioVoiceContext.state === 'closed') return false;
      return true;
    }

    _applyFinalizedAudioDataUrlToMatchingSegment(segUid, segSessionId, dataUrl, actualMime = '', extraSyncRef = null) {
      if (!segUid || !dataUrl) return;
      const applyUrl = (slideSync) => {
        if (!slideSync || typeof slideSync !== 'object') return;
        if (segSessionId && slideSync.sessionId && slideSync.sessionId !== segSessionId) return;
        if (!Array.isArray(slideSync.audioSegments)) return;
        for (let sIdx = 0; sIdx < slideSync.audioSegments.length; sIdx++) {
          const segObj = slideSync.audioSegments[sIdx];
          if (segObj && segObj.segUid === segUid) {
            segObj.audioDataUrl = dataUrl;
            if (actualMime) {
              segObj.mimeType = actualMime;
            }
            if (sIdx === 0) {
              slideSync.audioDataUrl = slideSync._compact ? '' : dataUrl;
              if (actualMime) {
                slideSync.mimeType = actualMime;
              }
            }
          }
        }
      };
      if (extraSyncRef) applyUrl(extraSyncRef);
      if (this.audioSyncData && this.audioSyncData !== extraSyncRef) applyUrl(this.audioSyncData);
      if (Array.isArray(this.lessonPlaylistSlides)) {
        this.lessonPlaylistSlides.forEach(sl => {
          if (sl && sl.audioSyncData && sl.audioSyncData !== extraSyncRef) applyUrl(sl.audioSyncData);
        });
      }
      if (
        (!segSessionId || !this._currentAudioRecordingSessionId || this._currentAudioRecordingSessionId === segSessionId) &&
        Array.isArray(this._priorSlideAudioSegments)
      ) {
        for (let pIdx = 0; pIdx < this._priorSlideAudioSegments.length; pIdx++) {
          const pSeg = this._priorSlideAudioSegments[pIdx];
          if (pSeg && pSeg.segUid === segUid) {
            pSeg.audioDataUrl = dataUrl;
            if (actualMime) {
              pSeg.mimeType = actualMime;
            }
          }
        }
      }
    }

    _notifyAudioRecordTrackLost(reasonMsg) {
      if (!this.isAudioRecording) return;
      this._micTrackLostInSession = true;
      this.syncAudioRecordUI();
      if (!this._notifiedMicLostInSession && !this.isAudioMicMuted && !this._confirmedSilentRecordInSession) {
        this._notifiedMicLostInSession = true;
        if (!this.isAudioRecordPaused && typeof this.togglePauseAudioRecording === 'function') {
          try { this.togglePauseAudioRecording(true); } catch (_) { }
        }
        if (typeof this.showImportantAlertModal === 'function') {
          this.showImportantAlertModal({
            title: '마이크 연결 끊김 안내',
            descHtml: '녹화 도중 마이크 연결이 끊어져 녹화가 자동 일시정지되었습니다.<br>마이크 연결 상태를 확인한 뒤 <b>[재개]</b> 또는 <b>[종료]</b>를 눌러 주세요.',
            isDanger: true
          });
        } else {
          this.showToast(reasonMsg || '⚠️ 마이크 연결이 끊어져 음성이 녹음되지 않고 있습니다! 녹화를 멈추고 마이크를 확인해 주세요.');
        }
      }
    }

    async _rolloverAudioRecorderInCurrentSlide() {
      if (!this.isAudioRecording) return false;
      this._flushRecorderBootHoldIfActive(true, true);
      const segStartMs = Math.max(0, Number(this._resumedSlideBaseOffsetMs) || 0);
      const splitMs = Math.max(segStartMs, this.getAudioRecordElapsedMs());
      const prevRecorder = this.audioMediaRecorder;
      const prevChunksRef = (prevRecorder && Array.isArray(prevRecorder._localChunks))
        ? prevRecorder._localChunks
        : (this.audioRecordedChunks ? [...this.audioRecordedChunks] : []);
      const prevMime = (this._audioMimeType && this._audioMimeType !== 'audio/wav') ? this._audioMimeType : 'audio/webm';
      const segSessionId = this._currentAudioRecordingSessionId || null;

      this.audioMediaRecorder = null;
      this.audioRecordedChunks = [];
      const segToken = (this._audioSegmentToken = (this._audioSegmentToken || 0) + 1);

      const needsStop = Boolean(prevRecorder && prevRecorder.state !== 'inactive');
      const hasPriorSpanOrAudio = Boolean(
        splitMs > segStartMs + 50 ||
        prevChunksRef.length > 0
      );

      let stopOnlyPromise = Promise.resolve();
      if (needsStop) {
        stopOnlyPromise = this._stopMediaRecorderSafely(prevRecorder, 1800);
        this._lastRecorderStopPromise = stopOnlyPromise;
        stopOnlyPromise.then(() => {
          if (this._lastRecorderStopPromise === stopOnlyPromise) {
            this._lastRecorderStopPromise = null;
          }
        });
      }

      if (hasPriorSpanOrAudio) {
        const safeEndMs = Math.max(segStartMs + 100, splitMs);
        const prevDurMs = Math.max(100, safeEndMs - segStartMs);
        const segUid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const fallbackSilentUrl = this._createSilentWavDataUrl(prevDurMs);
        if (!Array.isArray(this._priorSlideAudioSegments)) {
          this._priorSlideAudioSegments = [];
        }
        this._priorSlideAudioSegments.push({
          segUid,
          startMs: segStartMs,
          endMs: safeEndMs,
          durationMs: prevDurMs,
          audioDataUrl: fallbackSilentUrl,
          mimeType: 'audio/wav',
          nextSlideIdx: null,
          nextSlideStartMs: 0
        });
        this._resumedSlideBaseOffsetMs = safeEndMs;

        if (needsStop || prevChunksRef.length > 0) {
          if (!this._pendingSlideAudioFinalizers) this._pendingSlideAudioFinalizers = [];
          let finalizePromise = null;
          finalizePromise = stopOnlyPromise.then(async () => {
            try {
              const finalChunks = (prevRecorder && Array.isArray(prevRecorder._localChunks) && prevRecorder._localChunks.length > 0)
                ? prevRecorder._localChunks
                : prevChunksRef;
              if (finalChunks.length > 0) {
                const blob = new Blob(finalChunks, { type: prevMime });
                const dataUrl = await this._blobToDataUrlSafely(blob, 60000);
                if (dataUrl) {
                  this._applyFinalizedAudioDataUrlToMatchingSegment(segUid, segSessionId, dataUrl, prevMime);
                }
              }
            } catch (_) { }
          }).finally(() => {
            if (Array.isArray(this._pendingSlideAudioFinalizers) && finalizePromise) {
              const fIdx = this._pendingSlideAudioFinalizers.indexOf(finalizePromise);
              if (fIdx !== -1) this._pendingSlideAudioFinalizers.splice(fIdx, 1);
            }
          });
          this._pendingSlideAudioFinalizers.push(finalizePromise);
        }
      }

      try { await stopOnlyPromise; } catch (_) { }
      if (!this.isAudioRecording || this._audioSegmentToken !== segToken) return false;

      if (!window.MediaRecorder || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        return false;
      }

      try {
        const stream = await this._acquireProcessedAudioStream();
        if (!stream) throw new Error('no_audio_stream');
        if (!this.isAudioRecording || this._audioSegmentToken !== segToken) {
          this._cleanupProcessedAudioStream();
          return false;
        }
        this.audioMediaStream = stream;
        this.audioMediaStream.getAudioTracks().forEach(tr => {
          tr.enabled = !this.isAudioMicMuted;
        });

        // 마이크 재획득 대기 시간(예: 블루투스·iOS 세션 복구 지연)이 발생한 경우 무음 브릿지로 타임라인 싱크 오차 0ms 보정
        const actualStartMs = this.getAudioRecordElapsedMs();
        const curBaseMs = Math.max(0, Number(this._resumedSlideBaseOffsetMs) || 0);
        if (actualStartMs > curBaseMs + 80) {
          const gapDur = actualStartMs - curBaseMs;
          if (!Array.isArray(this._priorSlideAudioSegments)) {
            this._priorSlideAudioSegments = [];
          }
          this._priorSlideAudioSegments.push({
            segUid: `${Date.now()}_gap_${Math.random().toString(36).slice(2, 6)}`,
            startMs: curBaseMs,
            endMs: actualStartMs,
            durationMs: gapDur,
            audioDataUrl: this._createSilentWavDataUrl(gapDur),
            mimeType: 'audio/wav',
            nextSlideIdx: null,
            nextSlideStartMs: 0
          });
          this._resumedSlideBaseOffsetMs = actualStartMs;
        }

        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus'
        ];
        let chosenMime = (this._audioMimeType && this._audioMimeType !== 'audio/wav') ? this._audioMimeType : '';
        if (chosenMime && typeof MediaRecorder.isTypeSupported === 'function' && !MediaRecorder.isTypeSupported(chosenMime)) {
          chosenMime = '';
        }
        if (!chosenMime) {
          for (const m of candidates) {
            if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m)) {
              chosenMime = m;
              break;
            }
          }
        }
        this._audioMimeType = chosenMime || 'audio/webm';
        const targetBps = this._getTargetAudioBitsPerSecond(this._audioMimeType);
        const recOpts = chosenMime ? { mimeType: chosenMime, audioBitsPerSecond: targetBps } : { audioBitsPerSecond: targetBps };
        const localChunks = [];
        const recorder = new MediaRecorder(stream, recOpts);
        recorder._localChunks = localChunks;
        this.audioRecordedChunks = localChunks;
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            localChunks.push(ev.data);
          }
        };
        recorder.onerror = () => {
          recorder._brokenByError = true;
          this._notifyAudioRecordTrackLost('⚠️ 오디오 녹음기 오류가 발생하여 음성이 기록되지 않습니다. 녹화를 다시 시작해 주세요.');
        };
        recorder.start(250);
        if (this.isAudioRecordPaused && recorder.state === 'recording') {
          try { recorder.pause(); } catch (_) { }
        }
        this.audioMediaRecorder = recorder;
        this._hadActiveMicInSession = true;
        this._micTrackLostInSession = false;
        this.syncAudioRecordUI();
        return true;
      } catch (_) {
        this._cleanupProcessedAudioStream();
        this.audioMediaRecorder = null;
        if (this._hadActiveMicInSession) {
          this._notifyAudioRecordTrackLost('⚠️ 마이크 재연결에 실패하여 이후 구간이 무음으로 기록됩니다.');
        }
        return false;
      }
    }

    _resumeOrRolloverAudioRecorderAfterPause() {
      this._autoPausedByAppBackground = false;
      if (!this.isAudioRecording || this.isAudioRecordPaused) return Promise.resolve(false);
      this._acquireAudioRecordWakeLock();

      if (!this._hadActiveMicInSession) {
        this._hadBackgroundInterruptDuringPause = false;
        return Promise.resolve(true);
      }

      const ctx = this._audioVoiceContext;
      const ctxNeedsAsyncResume = Boolean(ctx && ctx.state !== 'running' && ctx.state !== 'closed');
      if (!ctxNeedsAsyncResume && this._isAudioRecordPipelineHealthy()) {
        try {
          if (this.audioMediaRecorder.state === 'paused') {
            this.audioMediaRecorder.resume();
          }
          if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'recording') {
            this._hadBackgroundInterruptDuringPause = false;
            return Promise.resolve(true);
          }
        } catch (_) { }
      }

      const resumeToken = (this._audioSegmentToken = (this._audioSegmentToken || 0) + 1);
      if (ctxNeedsAsyncResume && !this._recorderBootHoldStartMs) {
        this._recorderBootHoldStartMs = performance.now();
      }
      let resumePromise = null;
      resumePromise = (async () => {
        try {
          if (ctxNeedsAsyncResume && this._audioVoiceContext === ctx) {
            try { await ctx.resume(); } catch (_) { }
          }
          if (!this.isAudioRecording || this.isAudioRecordPaused || this._audioSegmentToken !== resumeToken) {
            if (this._audioSegmentToken === resumeToken) {
              this._flushRecorderBootHoldIfActive(true, true);
            }
            return false;
          }
          if (
            (!this._audioVoiceContext || this._audioVoiceContext.state === 'running') &&
            this._isAudioRecordPipelineHealthy()
          ) {
            try {
              if (this.audioMediaRecorder.state === 'paused') {
                this.audioMediaRecorder.resume();
              }
              if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'recording') {
                if (this._audioSegmentToken === resumeToken) {
                  this._flushRecorderBootHoldIfActive(true, true);
                }
                this._hadBackgroundInterruptDuringPause = false;
                return true;
              }
            } catch (_) { }
          }
          if (this._audioSegmentToken === resumeToken) {
            this._flushRecorderBootHoldIfActive(true, true);
          }
          this._hadBackgroundInterruptDuringPause = false;
          return await this._rolloverAudioRecorderInCurrentSlide();
        } finally {
          if (this._audioSegmentToken === resumeToken && this._recorderBootHoldStartMs > 0) {
            this._flushRecorderBootHoldIfActive(true, true);
          }
          if (this._pendingAudioResumePromise === resumePromise) {
            this._pendingAudioResumePromise = null;
          }
        }
      })();
      this._pendingAudioResumePromise = resumePromise;
      return resumePromise;
    }

    togglePauseAudioRecording(forcePause = null) {
      if (!this.isAudioRecording) return false;
      const nextPaused = (typeof forcePause === 'boolean') ? forcePause : !this.isAudioRecordPaused;
      if (nextPaused === this.isAudioRecordPaused) return this.isAudioRecordPaused;

      if (nextPaused) {
        this._flushRecorderBootHoldIfActive(true, true);
        this._autoPausedByAppBackground = false;
        this._releaseAudioRecordWakeLock();
        if (!this._isPausedStandbyOnSlide) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        this.isAudioRecordPaused = true;
        this.audioRecordPauseStartMs = performance.now();
        if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'recording') {
          try {
            if (typeof this.audioMediaRecorder.requestData === 'function') {
              this.audioMediaRecorder.requestData();
            }
          } catch (e) { }
          try { this.audioMediaRecorder.pause(); } catch (e) { }
        }
        this.showToast('⏸ 녹화가 일시정지되었습니다. [▶ 이어녹화]를 누르면 끊김 없이 이어집니다.');
      } else {
        const pausedDelta = Math.max(0, performance.now() - (this.audioRecordPauseStartMs || performance.now()));
        this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
        if (this._isPausedStandbyOnSlide) {
          this.isAudioRecordPaused = false;
          this.audioRecordPauseStartMs = 0;
          this._isPausedStandbyOnSlide = false;
          this._standbyExistingStrokeIds = null;
          this._standbyExistingStickers = null;
          this._autoPausedByAppBackground = false;
          this._beginNextSlideAudioSegmentAfterSwitch();
          this.showToast('▶ 녹화를 이어서 진행합니다!');
          this.syncAudioRecordUI();
          return this.isAudioRecordPaused;
        }
        this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + pausedDelta;
        this.isAudioRecordPaused = false;
        this.audioRecordPauseStartMs = 0;
        this._resumeOrRolloverAudioRecorderAfterPause();
        this._recordAudioWorkspaceStateIfNeeded(true);
        this.showToast('▶ 녹화를 이어서 진행합니다!');
      }
      this.syncAudioRecordUI();
      return this.isAudioRecordPaused;
    }

    _getTargetAudioBitsPerSecond(mimeType = '') {
      // 11.2kHz 로우패스 1채널 모노 강의 음성 기준 전 기기 36kbps 통일:
      // Opus/AAC 모두 변조 없이 깔끔한 해설 음질을 유지하면서 Firestore(Base64 청크) 용량·트래픽 증가 0% & 150MB 안전 가드 100% 보장
      return 36000;
    }

    async _ensureVoiceExpanderWorkletLoaded(ctx) {
      if (!ctx || !ctx.audioWorklet || typeof ctx.audioWorklet.addModule !== 'function' || typeof window.AudioWorkletNode !== 'function') {
        return false;
      }
      if (!this._voiceExpanderWorkletBlobUrl) {
        const workletCode = `
class GraphlyVoiceExpanderProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'thresholdDb', defaultValue: -43, minValue: -65, maxValue: -20, automationRate: 'k-rate' },
      { name: 'floorDb', defaultValue: -10.5, minValue: -24, maxValue: 0, automationRate: 'k-rate' }
    ];
  }
  constructor() {
    super();
    this._envLin = 0;
    this._gainLin = 1;
    this._holdSamples = 0;
    this._cachedSr = 0;
    this._envAtk = 0;
    this._envRel = 0;
    this._gainOpenCoeff = 0;
    this._gainCloseCoeff = 0;
    this._holdMax = 0;
  }
  _syncCoeffs(sr) {
    if (this._cachedSr === sr) return;
    this._cachedSr = sr;
    this._envAtk = Math.exp(-1 / (sr * 0.010));
    this._envRel = Math.exp(-1 / (sr * 0.025));
    this._gainOpenCoeff = Math.exp(-1 / (sr * 0.002));
    this._gainCloseCoeff = Math.exp(-1 / (sr * 0.115));
    this._holdMax = Math.round(sr * 0.040);
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output || input.length === 0 || output.length === 0) return true;
    const inChCount = input.length;
    const outChCount = output.length;
    const inCh0 = input[0];
    const frames = inCh0 ? inCh0.length : 0;
    if (frames === 0) return true;

    const sr = sampleRate || 48000;
    this._syncCoeffs(sr);

    const threshDb = parameters.thresholdDb[0];
    const floorDb = parameters.floorDb[0];
    const floorLin = Math.pow(10, floorDb / 20);

    const envAtk = this._envAtk;
    const envRel = this._envRel;
    const gainOpenCoeff = this._gainOpenCoeff;
    const gainCloseCoeff = this._gainCloseCoeff;
    const holdMax = this._holdMax;
    const ratio = 2.0;
    const kneeWidthDb = 8.0;
    const halfKnee = 4.0;
    const downmixToMono = (outChCount === 1 && inChCount > 1);
    const invInCh = downmixToMono ? (1 / inChCount) : 1;
    const copyChCount = Math.min(inChCount, outChCount);

    let env = this._envLin;
    let curGain = this._gainLin;
    let hold = this._holdSamples;

    for (let i = 0; i < frames; i++) {
      let absVal = 0;
      let monoSample = 0;
      if (downmixToMono) {
        let sum = 0;
        for (let c = 0; c < inChCount; c++) {
          sum += input[c][i];
        }
        monoSample = sum * invInCh;
        absVal = monoSample < 0 ? -monoSample : monoSample;
      } else {
        for (let c = 0; c < inChCount; c++) {
          const s = input[c][i];
          const a = s < 0 ? -s : s;
          if (a > absVal) absVal = a;
        }
      }

      if (absVal > env) {
        env = envAtk * env + (1 - envAtk) * absVal;
      } else {
        env = envRel * env + (1 - envRel) * absVal;
      }

      const levelDb = env > 1e-7 ? (20 * Math.log10(env)) : -140;
      let targetGain = 1.0;

      if (levelDb >= threshDb + halfKnee) {
        hold = holdMax;
        targetGain = 1.0;
      } else if (hold > 0) {
        hold--;
        targetGain = 1.0;
      } else {
        let attenDb = 0;
        if (levelDb > threshDb - halfKnee) {
          const diff = (threshDb + halfKnee) - levelDb;
          attenDb = -((ratio - 1) * diff * diff) / (2 * kneeWidthDb);
        } else {
          attenDb = -((ratio - 1) * (threshDb - levelDb));
        }
        if (attenDb < floorDb) attenDb = floorDb;
        targetGain = Math.pow(10, attenDb / 20);
        if (targetGain < floorLin) targetGain = floorLin;
      }

      if (targetGain > curGain) {
        curGain = gainOpenCoeff * curGain + (1 - gainOpenCoeff) * targetGain;
      } else {
        curGain = gainCloseCoeff * curGain + (1 - gainCloseCoeff) * targetGain;
      }

      if (downmixToMono) {
        output[0][i] = monoSample * curGain;
      } else {
        for (let c = 0; c < copyChCount; c++) {
          output[c][i] = input[c][i] * curGain;
        }
      }
    }

    this._envLin = env;
    this._gainLin = curGain;
    this._holdSamples = hold;
    return true;
  }
}
registerProcessor('graphly-voice-expander', GraphlyVoiceExpanderProcessor);
`;
        try {
          const blob = new Blob([workletCode], { type: 'application/javascript' });
          this._voiceExpanderWorkletBlobUrl = URL.createObjectURL(blob);
        } catch (e) {
          return false;
        }
      }
      try {
        const loadPromise = ctx.audioWorklet.addModule(this._voiceExpanderWorkletBlobUrl).then(() => true).catch(() => false);
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(false), 220));
        return await Promise.race([loadPromise, timeoutPromise]);
      } catch (e) {
        return false;
      }
    }

    // 🎙️✨ [대표님 기획: 표준 인강 스튜디오급 실시간 음성 자동 보정 파이프라인 (Web Audio API v2 — 원노브 스마트 오토 스튜디오)]
    // 손 안 대고 녹음만 눌러도 '저음 컷 + 무음 구간 소프트 잡음 게이트 + 방울림·펜 타격 클릭음 완화 + 발음 명료도 EQ + 컴프레서 + 브릭월 리미터' 자동 적용!
    async _acquireProcessedAudioStream() {
      this._cleanupProcessedAudioStream();
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        return null;
      }
      this._setIosAudioSessionMode('play-and-record');
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
      this._micTrackLostInSession = false;
      this._notifiedMicLostInSession = false;
      try {
        rawStream.getAudioTracks().forEach(tr => {
          tr.enabled = !this.isAudioMicMuted;
          tr.onended = () => {
            if (this.isAudioRecording && !this.isAudioRecordPaused && this.audioRawStream === rawStream) {
              this._notifyAudioRecordTrackLost('⚠️ 마이크 연결이 끊어져 음성이 녹음되지 않고 있습니다! 녹화를 멈추고 마이크를 확인해 주세요.');
            }
          };
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
          const gainPair = this._getAudioRecordGainPair();

          // 1. Low-Cut (High-Pass @ 95Hz): 에어컨·팬 소음 및 책상 진동·펜촉 둔탁한 '쿵/툭' 저음 제거
          const hpFilter = ctx.createBiquadFilter();
          hpFilter.type = 'highpass';
          hpFilter.frequency.value = 95;
          hpFilter.Q.value = 0.707;

          // 2. Soft Downward Expander (무음·판서 구간 바닥 잔소음·숨소리·AGC 펌핑 억제, 첫 자음 지연 0ms)
          let expanderNode = null;
          const workletReady = await this._ensureVoiceExpanderWorkletLoaded(ctx);
          if (workletReady) {
            try {
              expanderNode = new AudioWorkletNode(ctx, 'graphly-voice-expander', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: 1,
                channelCountMode: 'explicit',
                channelInterpretation: 'speakers',
                outputChannelCount: [1]
              });
              const thParam = expanderNode.parameters.get('thresholdDb');
              const flParam = expanderNode.parameters.get('floorDb');
              if (thParam) thParam.value = gainPair.expanderThresholdDb;
              if (flParam) flParam.value = gainPair.expanderFloorDb;
            } catch (_) {
              expanderNode = null;
            }
          }

          // 3. Anti-Boxiness & Warmth: 내장 마이크 특유의 먹먹한 방울림(265Hz) 억제 및 목소리 중심 톤(150Hz) 보강
          const mudFilter = ctx.createBiquadFilter();
          mudFilter.type = 'peaking';
          mudFilter.frequency.value = 265;
          mudFilter.Q.value = 1.15;
          mudFilter.gain.value = -2.2;

          const warmthFilter = ctx.createBiquadFilter();
          warmthFilter.type = 'peaking';
          warmthFilter.frequency.value = 150;
          warmthFilter.Q.value = 0.85;
          warmthFilter.gain.value = 1.3;

          // 4. Vocal Presence & Pen-Click Tamer: 한국어 자음 명료도(2.9kHz +1.8dB)는 살리고 강화유리 펜촉 클릭 대역(4.3kHz -1.8dB)은 부드럽게 정돈
          const presenceFilter = ctx.createBiquadFilter();
          presenceFilter.type = 'peaking';
          presenceFilter.frequency.value = 2900;
          presenceFilter.Q.value = 0.9;
          presenceFilter.gain.value = 1.8;

          const penClickTamer = ctx.createBiquadFilter();
          penClickTamer.type = 'peaking';
          penClickTamer.frequency.value = 4300;
          penClickTamer.Q.value = 1.6;
          penClickTamer.gain.value = -1.8;

          // 5. De-Harshness Low-Pass (11.2kHz): 귀 피로한 고주파 화이트노이즈 및 날카로운 치찰음 정돈
          const lpFilter = ctx.createBiquadFilter();
          lpFilter.type = 'lowpass';
          lpFilter.frequency.value = 11200;
          lpFilter.Q.value = 0.707;

          // 6. Smart Asymmetric Gain Staging + Broadcast Soft-Knee Compressor + Brickwall Limiter
          const preGain = ctx.createGain();
          preGain.gain.value = gainPair.preGain;

          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -22;
          compressor.knee.value = 14;
          compressor.ratio.value = 3.2;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.20;

          const makeupGain = ctx.createGain();
          makeupGain.gain.value = gainPair.makeupGain;

          const limiter = ctx.createDynamicsCompressor();
          limiter.threshold.value = -1.0;
          limiter.knee.value = 0;
          limiter.ratio.value = 20.0;
          limiter.attack.value = 0.001;
          limiter.release.value = 0.07;

          const dest = ctx.createMediaStreamDestination();
          source.connect(hpFilter);
          if (expanderNode) {
            hpFilter.connect(expanderNode);
            expanderNode.connect(mudFilter);
          } else {
            hpFilter.connect(mudFilter);
          }
          mudFilter.connect(warmthFilter);
          warmthFilter.connect(presenceFilter);
          presenceFilter.connect(penClickTamer);
          penClickTamer.connect(lpFilter);
          lpFilter.connect(preGain);
          preGain.connect(compressor);
          compressor.connect(makeupGain);
          makeupGain.connect(limiter);
          limiter.connect(dest);

          if (dest.stream && dest.stream.getAudioTracks().length > 0) {
            this._audioVoiceContext = ctx;
            this._audioExpanderNode = expanderNode;
            this._audioPreGainNode = preGain;
            this._audioMakeupGainNode = makeupGain;
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

    _getAudioRecordGainPair() {
      const num = Number(this.audioRecordVolume);
      const volPct = Math.max(10, Math.min(150, Number.isFinite(num) ? num : 100));
      const ratio = volPct / 100;
      const baseMakeup = 1.0;

      if (ratio < 1.0) {
        // [100% 미만 — 예: PC 마이크 95% + Graphly 70% / 50%]:
        // 컴프레서 앞단(preGain=1.0)은 표준 스튜디오 기준점 그대로 유지하여 컴프레서가 감소분을 도로 복구하는 현상을 원천 차단하고,
        // 컴프레서 뒷단(makeupGain)에서 인간 청각 데시벨 커브(ratio^1.66: 70%=-5.1dB, 50%=-10.0dB 절반 체감)로 정직하게 감쇠!
        // 동시에 주변 소음 과민 수음을 막기 위해 소프트 익스팬더 문턱을 부드럽게 상향(-43 -> -40dB)해 정숙도를 강화합니다.
        const attenCurve = Math.pow(ratio, 1.66);
        const normDown = (1.0 - ratio) / 0.9; // 0 (100%) ~ 1 (10%)
        return {
          preGain: 1.0,
          makeupGain: baseMakeup * attenCurve,
          expanderThresholdDb: -43 + (3.0 * normDown),
          expanderFloorDb: -10.5 - (2.0 * normDown)
        };
      }

      if (ratio > 1.0) {
        // [100% 초과 — 예: PC 마이크 60% + Graphly 140%]:
        // W3C DynamicsCompressorNode 내장 자동 게인(+6.19dB)을 감안해 과증폭·교실 소음 폭주·리미터 찌그러짐 없이
        // 전·후단 적정 분할 증폭(preGain=ratio^0.75, makeupGain=1.0*ratio^0.85, 150% 최대 +5.6dB) + 문턱 절제 하향(-43 -> -45dB) 적용!
        const normUp = (ratio - 1.0) / 0.5; // 0 (100%) ~ 1 (150%)
        return {
          preGain: Math.pow(ratio, 0.75),
          makeupGain: baseMakeup * Math.pow(ratio, 0.85),
          expanderThresholdDb: -43 - (2.0 * normUp),
          expanderFloorDb: -10.5
        };
      }

      return {
        preGain: 1.0,
        makeupGain: baseMakeup,
        expanderThresholdDb: -43,
        expanderFloorDb: -10.5
      };
    }

    _applyLiveAudioRecordVolume() {
      try {
        const pair = this._getAudioRecordGainPair();
        const ctx = this._audioVoiceContext;
        const canSmooth = Boolean(ctx && ctx.state === 'running' && Number.isFinite(ctx.currentTime));
        const nowT = canSmooth ? ctx.currentTime : 0;

        if (this._audioPreGainNode && this._audioPreGainNode.gain) {
          if (canSmooth && typeof this._audioPreGainNode.gain.setTargetAtTime === 'function') {
            this._audioPreGainNode.gain.setTargetAtTime(pair.preGain, nowT, 0.018);
          } else {
            this._audioPreGainNode.gain.value = pair.preGain;
          }
        }
        if (this._audioMakeupGainNode && this._audioMakeupGainNode.gain) {
          if (canSmooth && typeof this._audioMakeupGainNode.gain.setTargetAtTime === 'function') {
            this._audioMakeupGainNode.gain.setTargetAtTime(pair.makeupGain, nowT, 0.018);
          } else {
            this._audioMakeupGainNode.gain.value = pair.makeupGain;
          }
        }
        if (this._audioExpanderNode && this._audioExpanderNode.parameters) {
          const thParam = this._audioExpanderNode.parameters.get('thresholdDb');
          const flParam = this._audioExpanderNode.parameters.get('floorDb');
          if (thParam) {
            if (canSmooth && typeof thParam.setTargetAtTime === 'function') {
              thParam.setTargetAtTime(pair.expanderThresholdDb, nowT, 0.025);
            } else {
              thParam.value = pair.expanderThresholdDb;
            }
          }
          if (flParam) {
            if (canSmooth && typeof flParam.setTargetAtTime === 'function') {
              flParam.setTargetAtTime(pair.expanderFloorDb, nowT, 0.025);
            } else {
              flParam.value = pair.expanderFloorDb;
            }
          }
        }
      } catch (e) { }
    }

    _cleanupProcessedAudioStream() {
      if (this._audioExpanderNode) {
        try { this._audioExpanderNode.disconnect(); } catch (e) { }
        this._audioExpanderNode = null;
      }
      this._audioPreGainNode = null;
      this._audioMakeupGainNode = null;
      if (this.audioMediaStream) {
        try {
          this.audioMediaStream.getTracks().forEach(tr => tr.stop());
        } catch (e) { }
        this.audioMediaStream = null;
      }
      if (this.audioRawStream) {
        try {
          this.audioRawStream.getTracks().forEach(tr => {
            tr.onended = null;
            tr.stop();
          });
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
      if (!this.isAudioPlaying) {
        this._setIosAudioSessionMode('auto');
      }
    }

    toggleAudioMicMute(forceMuted = null) {
      if (this.isAudioRecording && forceMuted === null && (!this._hadActiveMicInSession || this._micTrackLostInSession)) {
        this.syncAudioRecordUI();
        this.showToast('⚠️ 마이크 권한이 없거나 연결이 끊어진 상태입니다. 녹화를 멈추고 마이크 설정을 확인해 주세요.');
        return true;
      }
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

    _stopMediaRecorderSafely(recorder, timeoutMs = 1800) {
      if (!recorder || recorder.state === 'inactive') {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        let settled = false;
        let timerId = null;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (timerId) {
            clearTimeout(timerId);
            timerId = null;
          }
          try {
            if (typeof recorder.removeEventListener === 'function') {
              recorder.removeEventListener('stop', finish);
              recorder.removeEventListener('error', finish);
            }
          } catch (e) { }
          resolve();
        };
        timerId = setTimeout(finish, Math.max(200, Number(timeoutMs) || 1800));
        try {
          if (typeof recorder.addEventListener === 'function') {
            recorder.addEventListener('stop', finish, { once: true });
            recorder.addEventListener('error', finish, { once: true });
          }
          recorder.onstop = finish;
          recorder.onerror = finish;
        } catch (e) { }
        try {
          if (recorder.state === 'paused' && typeof recorder.requestData === 'function') {
            try { recorder.requestData(); } catch (reqErr) { }
          }
          recorder.stop();
        } catch (e) {
          finish();
        }
      });
    }

    _blobToDataUrlSafely(blob, timeoutMs = 60000) {
      if (!blob || blob.size <= 0 || typeof FileReader === 'undefined') {
        return Promise.resolve('');
      }
      return new Promise((resolve) => {
        let settled = false;
        let timerId = null;
        let reader = null;
        const finish = (val) => {
          if (settled) return;
          settled = true;
          if (timerId) {
            clearTimeout(timerId);
            timerId = null;
          }
          resolve(typeof val === 'string' ? val : '');
        };
        timerId = setTimeout(() => {
          try {
            if (reader && reader.readyState === 1 && typeof reader.abort === 'function') {
              reader.abort();
            }
          } catch (e) { }
          finish('');
        }, Math.max(500, Number(timeoutMs) || 60000));
        try {
          reader = new FileReader();
          reader.onloadend = () => finish(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => finish('');
          reader.onabort = () => finish('');
          reader.readAsDataURL(blob);
        } catch (e) {
          finish('');
        }
      });
    }

    // 🌟 [원테이크 통째 강의 녹음 + 슬라이드별 자동 챕터 분할 & 왕복(3번➔2번➔3번) 이어녹음 엔진]:
    // 선생님이 녹음 버튼을 한 번 켜고 1번 ➔ 2번 ➔ ... ➔ 10번 슬라이드를 넘기거나,
    // 3번에서 2번으로 돌아갔다가 다시 3번으로 넘어오며 통째로 강의를 찍을 때,
    // 슬라이드를 넘기는 순간 이전 슬라이드의 음성·필기·그래프 타임라인 세그먼트를 누적 보존하고
    // 다음(또는 재방문한) 슬라이드 녹음을 0.00초 딜레이로 즉시 이어갑니다!
    _finalizeCurrentSlideAudioSegmentBeforeSwitch(nextSlideIdx = null, explicitNextStartMs = null, explicitNextSlideUid = '') {
      if (!this.isAudioRecording) return;
      if (this._isPausedStandbyOnSlide) {
        this._normalizePausedStandbyMutations();
        return;
      }
      this._flushRecorderBootHoldIfActive(true, true);
      if (this._activeRecLassoOp && typeof this._commitAudioLassoTransformOp === 'function') {
        try { this._commitAudioLassoTransformOp(); } catch (_) { }
      }
      const isManualOrBgPausedSwitch = Boolean(this.isAudioRecordPaused && !this._autoPausedByPdfModal);
      const effNextSlideIdx = isManualOrBgPausedSwitch ? null : nextSlideIdx;
      const effExplicitNextStartMs = isManualOrBgPausedSwitch ? 0 : explicitNextStartMs;
      let effNextSlideUid = isManualOrBgPausedSwitch ? '' : String(explicitNextSlideUid || '');
      if (!effNextSlideUid && typeof effNextSlideIdx === 'number' && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides[effNextSlideIdx]) {
        effNextSlideUid = (typeof this._ensureSlideHasUid === 'function')
          ? this._ensureSlideHasUid(this.lessonPlaylistSlides[effNextSlideIdx])
          : (this.lessonPlaylistSlides[effNextSlideIdx].slideUid || '');
      }

      const segStartMs = Math.max(0, Number(this._resumedSlideBaseOffsetMs) || 0);
      const durationMs = Math.max(segStartMs + 200, this.getAudioRecordElapsedMs());
      const segDurMs = Math.max(100, durationMs - segStartMs);
      this._recordAudioWorkspaceStateIfNeeded(true, true);
      const finalState = this._captureAudioWorkspaceKeyframe();
      const initialState = this.audioInitialState || finalState;
      const timeline = this.audioTimeline ? [...this.audioTimeline] : [];
      const laserStrokes = this.audioLaserStrokes ? [...this.audioLaserStrokes] : [];
      const erasedStrokes = this.audioErasedStrokes ? [...this.audioErasedStrokes] : [];
      const cardAssetPool = (this.audioCardAssetPool && typeof this.audioCardAssetPool === 'object')
        ? JSON.parse(JSON.stringify(this.audioCardAssetPool))
        : {};
      const archivedPdfBoards = (this.audioArchivedPdfBoards && typeof this.audioArchivedPdfBoards === 'object')
        ? JSON.parse(JSON.stringify(this.audioArchivedPdfBoards))
        : {};
      const recordedMime = (this._audioMimeType && this._audioMimeType !== 'audio/wav')
        ? this._audioMimeType
        : 'audio/webm';
      const fallbackSegSilentUrl = this._createSilentWavDataUrl(segDurMs);

      let resolvedNextStartMs = effExplicitNextStartMs;
      if (resolvedNextStartMs === null && typeof effNextSlideIdx === 'number' && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides[effNextSlideIdx]) {
        const targetSync = this.lessonPlaylistSlides[effNextSlideIdx].audioSyncData;
        const isSameSession = !this._currentAudioRecordingSessionId || !targetSync || !targetSync.sessionId || targetSync.sessionId === this._currentAudioRecordingSessionId;
        resolvedNextStartMs = (isSameSession && targetSync && typeof targetSync.durationMs === 'number' && targetSync.durationMs > 0)
          ? targetSync.durationMs
          : 0;
      }

      const priorSegs = Array.isArray(this._priorSlideAudioSegments)
        ? JSON.parse(JSON.stringify(this._priorSlideAudioSegments))
        : [];
      const segUid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newSeg = {
        segUid,
        startMs: segStartMs,
        endMs: durationMs,
        durationMs: segDurMs,
        audioDataUrl: fallbackSegSilentUrl,
        mimeType: 'audio/wav',
        nextSlideIdx: typeof effNextSlideIdx === 'number' ? effNextSlideIdx : null,
        nextSlideUid: effNextSlideUid || null,
        nextSlideStartMs: typeof resolvedNextStartMs === 'number' ? resolvedNextStartMs : 0
      };
      const audioSegments = [...priorSegs, newSeg];
      const primaryAudioUrl = (audioSegments[0] && audioSegments[0].audioDataUrl) || fallbackSegSilentUrl;
      const primaryMime = (audioSegments[0] && audioSegments[0].mimeType) || 'audio/wav';

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
        mimeType: primaryMime,
        audioDataUrl: primaryAudioUrl,
        audioSegments,
        initialState,
        finalState,
        timeline,
        laserStrokes,
        erasedStrokes,
        cardAssetPool,
        archivedPdfBoards
      };
      this.audioSyncData = segAudioSyncData;

      const prevRecorder = this.audioMediaRecorder;
      const prevChunksRef = (prevRecorder && Array.isArray(prevRecorder._localChunks))
        ? prevRecorder._localChunks
        : (this.audioRecordedChunks ? [...this.audioRecordedChunks] : []);
      const segSessionId = segAudioSyncData.sessionId;
      this.audioMediaRecorder = null;
      this.audioRecordedChunks = [];

      const needsStop = Boolean(prevRecorder && prevRecorder.state !== 'inactive');
      const hasBufferedChunks = Boolean(
        (prevRecorder && Array.isArray(prevRecorder._localChunks) && prevRecorder._localChunks.length > 0) ||
        prevChunksRef.length > 0
      );
      if (needsStop || hasBufferedChunks) {
        if (!this._pendingSlideAudioFinalizers) this._pendingSlideAudioFinalizers = [];
        // 1) 하드웨어/브라우저 MediaRecorder 정지 대기(최대 1800ms 안전 타임아웃)만 분리하여 마지막 문장·MP4 헤더 잘림 원천 차단!
        const stopOnlyPromise = needsStop
          ? this._stopMediaRecorderSafely(prevRecorder, 1800)
          : Promise.resolve();
        if (needsStop) {
          this._lastRecorderStopPromise = stopOnlyPromise;
          stopOnlyPromise.then(() => {
            if (this._lastRecorderStopPromise === stopOnlyPromise) {
              this._lastRecorderStopPromise = null;
            }
          });
        }
        // 2) 대용량 Blob ➔ Base64 DataURL 변환은 백그라운드 Finalizer 큐에서 비동기 마감 및 완료 즉시 참조 해제(RAM 보호)
        let finalizePromise = null;
        finalizePromise = stopOnlyPromise.then(async () => {
          try {
            const finalChunks = (prevRecorder && Array.isArray(prevRecorder._localChunks) && prevRecorder._localChunks.length > 0)
              ? prevRecorder._localChunks
              : prevChunksRef;
            if (finalChunks.length > 0) {
              const blob = new Blob(finalChunks, { type: recordedMime });
              const dataUrl = await this._blobToDataUrlSafely(blob, 60000);
              if (dataUrl) {
                this._applyFinalizedAudioDataUrlToMatchingSegment(segUid, segSessionId, dataUrl, recordedMime, segAudioSyncData);
              }
            }
          } catch (e) { }
        }).finally(() => {
          if (Array.isArray(this._pendingSlideAudioFinalizers) && finalizePromise) {
            const fIdx = this._pendingSlideAudioFinalizers.indexOf(finalizePromise);
            if (fIdx !== -1) {
              this._pendingSlideAudioFinalizers.splice(fIdx, 1);
            }
          }
        });
        this._pendingSlideAudioFinalizers.push(finalizePromise);
      }
    }

    _markSlideItemsPreExistingForAudio(forceReset = false) {
      const markStrokes = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(st => {
          if (!st) return;
          if (!st.id) {
            st.id = this._nextAudioStrokeId(st.isGraphStamp ? 'gstamp' : (st.isProblemStamp ? 'pstamp' : 'ink'));
          }
          if (forceReset) {
            st.preExisting = true;
            delete st.tStart;
            delete st.tEnd;
            delete st._lassoOpId;
            delete st._lassoOpStartMs;
          } else if (st.tStart === undefined) {
            st.preExisting = true;
          }
        });
      };
      const resetStickers = (arr) => {
        if (!forceReset || !Array.isArray(arr)) return;
        arr.forEach(stk => {
          if (stk && stk.tStart !== undefined) delete stk.tStart;
        });
      };
      markStrokes(this.inkStrokes);
      markStrokes(this.problemInkStrokes);
      markStrokes(this.graphInkStrokes);
      resetStickers(this.boardStickers);
      resetStickers(this.problemCardStickers);
      resetStickers(this.graphCardStickers);
      if (this.extraProblemCards) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el) {
            if (Array.isArray(c.el._cardInkStrokes)) markStrokes(c.el._cardInkStrokes);
            if (Array.isArray(c.el._cardStickers)) resetStickers(c.el._cardStickers);
          }
        });
      }
      if (this.extraGraphCards) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el) {
            if (Array.isArray(c.el._cardInkStrokes)) markStrokes(c.el._cardInkStrokes);
            if (Array.isArray(c.el._cardStickers)) resetStickers(c.el._cardStickers);
          }
        });
      }
    }

    _clearDanglingNextSlideJumpsFromSession(sessionId, cancelledTargetIdx = -1) {
      if (!sessionId || !Array.isArray(this.lessonPlaylistSlides)) return;
      const cancelledSlide = (cancelledTargetIdx >= 0 && this.lessonPlaylistSlides[cancelledTargetIdx])
        ? this.lessonPlaylistSlides[cancelledTargetIdx]
        : null;
      const cancelledUid = cancelledSlide && cancelledSlide.slideUid ? String(cancelledSlide.slideUid) : '';
      for (let i = 0; i < this.lessonPlaylistSlides.length; i++) {
        if (i === cancelledTargetIdx) continue;
        const sl = this.lessonPlaylistSlides[i];
        const aud = sl && sl.audioSyncData;
        if (!aud || aud.sessionId !== sessionId || !Array.isArray(aud.audioSegments)) continue;
        for (let k = 0; k < aud.audioSegments.length; k++) {
          const seg = aud.audioSegments[k];
          if (!seg) continue;
          const matchesTarget = (cancelledUid && seg.nextSlideUid === cancelledUid) ||
            (cancelledTargetIdx >= 0 && seg.nextSlideIdx === cancelledTargetIdx);
          if (matchesTarget) {
            seg.nextSlideIdx = null;
            seg.nextSlideStartMs = 0;
            delete seg.nextSlideUid;
          }
        }
      }
    }

    async _promptOverwriteExistingSlideRecordingOnEnter() {
      if (this._isPromptingSlideAudioOverwrite || !this.isAudioRecording) return;
      this._isPromptingSlideAudioOverwrite = true;
      const promptSlideIdx = typeof this.lessonPlaylistIndex === 'number' ? this.lessonPlaylistIndex : -1;
      const promptSessionId = this._currentAudioRecordingSessionId || null;
      try {
        let okOverwrite = false;
        if (typeof this.promptCloudConfirmDialog === 'function') {
          okOverwrite = await this.promptCloudConfirmDialog({
            title: '기존 녹화 덮어쓰기 확인',
            descHtml: '이 캔버스에는 이미 녹화된 영상이 있습니다.<br>기존 영상을 덮어쓰고 계속 녹화하시겠습니까?',
            confirmLabel: '덮어쓰기',
            cancelLabel: '녹화 종료',
            isDanger: true,
            defaultFocus: 'cancel'
          });
        }
        if (!this.isAudioRecording || (promptSessionId && this._currentAudioRecordingSessionId !== promptSessionId)) {
          return;
        }
        if (!okOverwrite) {
          this._clearDanglingNextSlideJumpsFromSession(promptSessionId, promptSlideIdx);
          await this.stopAudioRecording({ silentToast: true });
          return;
        }
        if (promptSlideIdx >= 0 && this.isLessonPlaylistActive && this.lessonPlaylistIndex !== promptSlideIdx) {
          return;
        }
        const pausedDelta = this.audioRecordPauseStartMs
          ? Math.max(0, performance.now() - this.audioRecordPauseStartMs)
          : 0;
        this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
        this.isAudioRecordPaused = false;
        this.audioRecordPauseStartMs = 0;
        this._isPausedStandbyOnSlide = false;
        this._standbyExistingStrokeIds = null;
        this._standbyExistingStickers = null;
        this._autoPausedByAppBackground = false;
        this._beginNextSlideAudioSegmentAfterSwitch({ forceOverwriteExisting: true });
        this.syncAudioRecordUI();
      } finally {
        this._isPromptingSlideAudioOverwrite = false;
      }
    }

    _beginNextSlideAudioSegmentAfterSwitch(options = null) {
      if (!this.isAudioRecording) return;
      const forceOverwrite = Boolean(options && options.forceOverwriteExisting);
      if (this.isAudioRecordPaused) {
        this._flushRecorderBootHoldIfActive(true, true);
        this._isPausedStandbyOnSlide = true;
        this._autoPausedByAppBackground = false;
        this._captureStandbyBaselineItems();
        this.syncAudioRecordUI();
        return;
      }

      const hasExistingAudio = Boolean(
        this.audioSyncData &&
        typeof this.audioSyncData.durationMs === 'number' &&
        this.audioSyncData.durationMs > 0
      );
      const isSameSession = Boolean(
        hasExistingAudio &&
        this._currentAudioRecordingSessionId &&
        this.audioSyncData.sessionId &&
        this.audioSyncData.sessionId === this._currentAudioRecordingSessionId
      );

      // 이전 세션에서 이미 녹화해 둔 캔버스에 진입한 경우: 0ms 즉시 파괴하지 않고 안전 스탠바이 상태로 보호 후 [녹화 종료 / 덮어쓰기] 확인!
      if (hasExistingAudio && !isSameSession && !forceOverwrite && typeof this.promptCloudConfirmDialog === 'function') {
        this._flushRecorderBootHoldIfActive(true, true);
        this.isAudioRecordPaused = true;
        this.audioRecordPauseStartMs = performance.now();
        this._isPausedStandbyOnSlide = true;
        this._autoPausedByAppBackground = false;
        this._releaseAudioRecordWakeLock();
        this._captureStandbyBaselineItems();
        this.syncAudioRecordUI();
        this._promptOverwriteExistingSlideRecordingOnEnter();
        return;
      }

      this._isPausedStandbyOnSlide = false;
      this._standbyExistingStrokeIds = null;
      this._standbyExistingStickers = null;
      this._flushRecorderBootHoldIfActive(false, true);

      const prevSync = (isSameSession && hasExistingAudio)
        ? this._expandAudioSyncData(this.audioSyncData)
        : null;
      this._markSlideItemsPreExistingForAudio(!prevSync);

      const localChunks = [];
      this.audioSyncData = null;
      this.audioRecordedChunks = localChunks;
      const segToken = (this._audioSegmentToken = (this._audioSegmentToken || 0) + 1);
      const shouldHoldClockUntilRecorderStart = Boolean(
        window.MediaRecorder &&
        (this._hadActiveMicInSession || this.audioMediaStream || this.audioRawStream)
      );
      const switchPerfNow = performance.now();
      this._recorderBootHoldStartMs = shouldHoldClockUntilRecorderStart ? switchPerfNow : 0;

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
        this.audioCardAssetPool = (prevSync.cardAssetPool && typeof prevSync.cardAssetPool === 'object')
          ? JSON.parse(JSON.stringify(prevSync.cardAssetPool))
          : {};
        this.audioArchivedPdfBoards = (prevSync.archivedPdfBoards && typeof prevSync.archivedPdfBoards === 'object')
          ? JSON.parse(JSON.stringify(prevSync.archivedPdfBoards))
          : {};
        this.audioRecordStartMs = switchPerfNow - baseOffsetMs;
        this.audioRecordPauseStartMs = 0;
        this.audioRecordTotalPausedMs = 0;
        this._lastAudioCursorRecordMs = baseOffsetMs - 100;
        this._lastAudioStateRecordMs = baseOffsetMs - 100;
        this._lastAudioStateCheckMs = baseOffsetMs - 100;
        this._wasActivelyDraggingGraph = false;
        this._lastRecordedStateHash = '';
        this._recordAudioWorkspaceStateIfNeeded(true);
      } else {
        this._resumedSlideBaseOffsetMs = 0;
        this._priorSlideAudioSegments = [];
        this.audioTimeline = [];
        this.audioLaserStrokes = [];
        this.audioErasedStrokes = [];
        this.audioCardAssetPool = {};
        this.audioArchivedPdfBoards = {};
        this.audioRecordStartMs = switchPerfNow;
        this.audioRecordPauseStartMs = 0;
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
        let starterPromise = null;
        const startNextRecorder = async () => {
          if (this._lastRecorderStopPromise) {
            try { await this._lastRecorderStopPromise; } catch (e) { }
          }
          if (!this.isAudioRecording || this._audioSegmentToken !== segToken) return;
          try {
            const hasLiveRawTrack = !this.audioRawStream || (
              typeof this.audioRawStream.getAudioTracks === 'function' &&
              this.audioRawStream.getAudioTracks().some(tr => tr.readyState === 'live') &&
              !(this._hadBackgroundInterruptDuringPause && this.audioRawStream.getAudioTracks().every(tr => tr && tr.muted))
            );
            const hasLiveTrack = Boolean(
              hasLiveRawTrack &&
              (!this._audioVoiceContext || this._audioVoiceContext.state !== 'closed') &&
              this.audioMediaStream &&
              typeof this.audioMediaStream.getAudioTracks === 'function' &&
              this.audioMediaStream.getAudioTracks().some(tr => tr.readyState === 'live')
            );
            if (hasLiveTrack && this._audioVoiceContext && this._audioVoiceContext.state !== 'running') {
              try { await this._audioVoiceContext.resume(); } catch (_) { }
            }
            const ctxHealthy = !this._audioVoiceContext || this._audioVoiceContext.state === 'running';
            if ((!hasLiveTrack || !ctxHealthy) && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
              try {
                this.audioMediaStream = await this._acquireProcessedAudioStream();
              } catch (micReacqErr) {
                this._cleanupProcessedAudioStream();
                if (this._hadActiveMicInSession) {
                  this._notifyAudioRecordTrackLost('⚠️ 마이크 연결이 끊어져 이후 슬라이드가 무음으로 기록됩니다.');
                }
              }
            }
            this._hadBackgroundInterruptDuringPause = false;
            if (!this.isAudioRecording || this._audioSegmentToken !== segToken || !this.audioMediaStream) return;
            this.audioMediaStream.getAudioTracks().forEach(tr => {
              tr.enabled = !this.isAudioMicMuted;
            });
            const chosenMime = this._audioMimeType && this._audioMimeType !== 'audio/wav' ? this._audioMimeType : '';
            const targetBps = this._getTargetAudioBitsPerSecond(chosenMime || this._audioMimeType);
            const recOpts = chosenMime ? { mimeType: chosenMime, audioBitsPerSecond: targetBps } : { audioBitsPerSecond: targetBps };
            const recorder = new MediaRecorder(this.audioMediaStream, recOpts);
            recorder._localChunks = localChunks;
            recorder.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) {
                localChunks.push(ev.data);
              }
            };
            recorder.onerror = () => {
              recorder._brokenByError = true;
              this._notifyAudioRecordTrackLost('⚠️ 오디오 녹음기 오류가 발생하여 음성이 기록되지 않습니다. 녹화를 다시 시작해 주세요.');
            };
            recorder.start(250);
            if (this._audioSegmentToken === segToken) {
              this._flushRecorderBootHoldIfActive(true, true);
            }
            if (this.isAudioRecordPaused && recorder.state === 'recording') {
              try { recorder.pause(); } catch (e) { }
            }
            this.audioMediaRecorder = recorder;
            this._hadActiveMicInSession = true;
            this._micTrackLostInSession = false;
            this.syncAudioRecordUI();
          } catch (e) {
            this.audioMediaRecorder = null;
            if (this._hadActiveMicInSession) {
              this._notifyAudioRecordTrackLost('⚠️ 오디오 녹음기 시작에 실패하여 무음으로 기록됩니다.');
            }
          }
        };
        starterPromise = startNextRecorder().finally(() => {
          if (this._audioSegmentToken === segToken && this._recorderBootHoldStartMs > 0) {
            this._flushRecorderBootHoldIfActive(true, true);
          }
          if (this._pendingSlideRecorderStarter === starterPromise) {
            this._pendingSlideRecorderStarter = null;
          }
        });
        this._pendingSlideRecorderStarter = starterPromise;
      } else if (this._recorderBootHoldStartMs > 0) {
        this._recorderBootHoldStartMs = 0;
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

    // ==========================================================================
    // [🎬 Step 1: 비파괴 필기 시간축(Non-Destructive Ink Timeline) & 올가미 실시간 리플레이 헬퍼]
    // ==========================================================================
    _nextAudioStrokeId(prefix = 'ink') {
      this._audioStrokeSeq = (this._audioStrokeSeq || 0) + 1;
      return `${prefix}_${Date.now()}_${this._audioStrokeSeq.toString(36)}`;
    }

    _stampStrokeAppearedAtRecordingTime(st, recT = null) {
      if (!st || typeof st !== 'object') return st;
      const tNow = (typeof recT === 'number' && Number.isFinite(recT))
        ? Math.max(0, Math.round(recT))
        : Math.max(0, Math.round(this.getAudioRecordElapsedMs()));
      st.id = this._nextAudioStrokeId(st.isGraphStamp ? 'gstamp' : (st.isProblemStamp ? 'pstamp' : 'ink'));
      delete st.preExisting;
      delete st.erasedAt;
      delete st._lassoOpId;
      delete st._lassoOpStartMs;
      st.tStart = tNow;
      st.tEnd = tNow;
      if (st.isShape && (st.shape || st.cardShape)) {
        st.shapeSnapAt = tNow;
        if (st.shape && st.shape.endTrack) {
          delete st.shape.endTrack;
        }
      } else {
        delete st.shapeSnapAt;
      }
      return st;
    }

    _archiveStrokeRemovedDuringRecording(st, recT = null, extraMeta = null) {
      if (!this.isAudioRecording || this._isPausedStandbyOnSlide || !st || typeof st !== 'object') return;
      try {
        const tNow = (typeof recT === 'number' && Number.isFinite(recT))
          ? Math.max(0, Math.round(recT))
          : Math.max(0, Math.round(this.getAudioRecordElapsedMs()));
        if (!st.preExisting && typeof st.tStart === 'number' && st.tStart >= tNow) {
          return;
        }
        if (!Array.isArray(this.audioErasedStrokes)) {
          this.audioErasedStrokes = [];
        }
        const cloned = JSON.parse(JSON.stringify(st));
        if (!cloned.id) {
          cloned.id = this._nextAudioStrokeId('era');
        }
        cloned.erasedAt = tNow;
        if (extraMeta && typeof extraMeta === 'object') {
          Object.assign(cloned, extraMeta);
        }
        this.audioErasedStrokes.push(cloned);
      } catch (_) { }
    }

    _computeAudioStrokeVisualSig(st) {
      if (!st || typeof st !== 'object') return '';
      const pts = Array.isArray(st.points) ? st.points : [];
      const n = pts.length;
      const fmtPt = (pt) => {
        if (!pt) return '';
        if (pt.nx !== undefined) return `${Math.round(pt.nx * 10000)},${Math.round(pt.ny * 10000)}`;
        return `${Math.round((pt.x || 0) * 100)},${Math.round((pt.y || 0) * 100)}`;
      };
      const p0 = n > 0 ? fmtPt(pts[0]) : '';
      const pM = n > 2 ? fmtPt(pts[n >> 1]) : '';
      const pL = n > 1 ? fmtPt(pts[n - 1]) : '';
      let shapeSig = '';
      if (st.shape) {
        const sh = st.shape;
        if (sh.type === 'line' && sh.start && sh.end) {
          shapeSig = `L:${fmtPt(sh.start)}>${fmtPt(sh.end)}`;
        } else if ((sh.type === 'circle' || sh.type === 'ellipse') && sh.center) {
          shapeSig = `C:${fmtPt(sh.center)}:${Math.round((sh.radius || sh.rx || 0) * 100)},${Math.round((sh.ry || 0) * 100)}`;
        } else if (sh.type === 'rect' && sh.min && sh.max) {
          shapeSig = `R:${fmtPt(sh.min)}>${fmtPt(sh.max)}`;
        } else if (Array.isArray(sh.pts)) {
          shapeSig = `P:${sh.pts.length}:${fmtPt(sh.pts[0])}>${fmtPt(sh.pts[sh.pts.length - 1])}`;
        } else {
          shapeSig = sh.type || 'shape';
        }
      } else if (st.cardShape) {
        shapeSig = JSON.stringify(st.cardShape);
      }
      return [
        st.target || 'board',
        Boolean(st.onPdfBoard) ? 1 : 0,
        (st.color || '').toLowerCase(),
        Math.round((st.size || 0) * 100),
        Math.round((st.highlighterSize || 0) * 100),
        Math.round((st.softBlur || 0) * 100),
        st.penStyle || 'ballpen',
        Boolean(st.isHighlighter) ? 1 : 0,
        Boolean(st.isDashed) ? 1 : 0,
        Boolean(st.isShape) ? 1 : 0,
        Boolean(st.isGraphStamp) ? 1 : 0,
        Boolean(st.isProblemStamp) ? 1 : 0,
        n,
        p0,
        pM,
        pL,
        shapeSig
      ].join('|');
    }

    _snapshotInkListForReconcile(strokesArr) {
      if (!this.isAudioRecording || !Array.isArray(strokesArr) || strokesArr.length === 0) return [];
      try {
        const out = [];
        for (let i = 0; i < strokesArr.length; i++) {
          const st = strokesArr[i];
          if (!st) continue;
          if (!st.id) {
            st.id = this._nextAudioStrokeId(st.isGraphStamp ? 'gstamp' : (st.isProblemStamp ? 'pstamp' : 'ink'));
          }
          out.push({
            id: st.id,
            sig: this._computeAudioStrokeVisualSig(st),
            clone: JSON.parse(JSON.stringify(st))
          });
        }
        return out;
      } catch (_) {
        return [];
      }
    }

    _reconcileInkStrokesForAudioRecording(prevEntries, nextStrokes, recT = null, cardKey = null) {
      if (!this.isAudioRecording) return;
      try {
        const tNow = (typeof recT === 'number' && Number.isFinite(recT))
          ? Math.max(0, Math.round(recT))
          : Math.max(0, Math.round(this.getAudioRecordElapsedMs()));
        const prevList = Array.isArray(prevEntries) ? prevEntries : [];
        const nextList = Array.isArray(nextStrokes) ? nextStrokes : [];
        const usedPrev = new Uint8Array(prevList.length);

        for (let i = 0; i < nextList.length; i++) {
          const nSt = nextList[i];
          if (!nSt) continue;
          const nSig = this._computeAudioStrokeVisualSig(nSt);
          let matchedIdx = -1;
          if (nSt.id) {
            for (let j = 0; j < prevList.length; j++) {
              if (!usedPrev[j] && prevList[j].id === nSt.id && prevList[j].sig === nSig) {
                matchedIdx = j;
                break;
              }
            }
          }
          if (matchedIdx === -1) {
            for (let j = 0; j < prevList.length; j++) {
              if (!usedPrev[j] && prevList[j].sig === nSig) {
                matchedIdx = j;
                break;
              }
            }
          }
          if (matchedIdx !== -1) {
            usedPrev[matchedIdx] = 1;
            const pClone = prevList[matchedIdx].clone;
            nSt.id = pClone.id;
            if (pClone.preExisting) {
              nSt.preExisting = true;
              delete nSt.tStart;
              delete nSt.tEnd;
            } else {
              delete nSt.preExisting;
              nSt.tStart = pClone.tStart;
              nSt.tEnd = pClone.tEnd;
            }
            if (pClone.shapeSnapAt !== undefined) nSt.shapeSnapAt = pClone.shapeSnapAt;
            else delete nSt.shapeSnapAt;
            if (pClone.shape && Array.isArray(pClone.shape.endTrack) && nSt.shape) {
              nSt.shape.endTrack = JSON.parse(JSON.stringify(pClone.shape.endTrack));
            }
          } else {
            this._stampStrokeAppearedAtRecordingTime(nSt, tNow);
          }
        }

        const extraMeta = cardKey ? { cardKey } : null;
        for (let j = 0; j < prevList.length; j++) {
          if (!usedPrev[j] && prevList[j] && prevList[j].clone) {
            this._archiveStrokeRemovedDuringRecording(prevList[j].clone, tNow, extraMeta);
          }
        }
      } catch (_) { }
    }

    _beginAudioLassoTransformOp(mode, meta = {}) {
      if (!this.isAudioRecording) return;
      try {
        if (this._activeRecLassoOp) {
          this._commitAudioLassoTransformOp();
        }
        const selected = Array.isArray(this.selectedInkStrokes) ? this.selectedInkStrokes : [];
        const recT = Math.max(0, Math.round(this.getAudioRecordElapsedMs()));
        selected.forEach(st => {
          if (st && !st.id) {
            st.id = this._nextAudioStrokeId('ink');
          }
        });
        const allowedModes = new Set(['move', 'resize', 'rotate', 'flipX', 'flipY']);
        const resolvedMode = allowedModes.has(mode) ? mode : 'move';
        const r1Init = (v) => Math.round((Number(v) || 0) * 10) / 10;
        this._lassoOpSeq = (this._lassoOpSeq || 0) + 1;
        this._activeRecLassoOp = {
          opId: `lop_${Date.now()}_${this._lassoOpSeq.toString(36)}`,
          mode: resolvedMode,
          startMs: recT,
          startScreenX: Number(meta.startScreenX) || 0,
          startScreenY: Number(meta.startScreenY) || 0,
          curDx: 0,
          curDy: 0,
          anchorX: Number(meta.anchorX) || 0,
          anchorY: Number(meta.anchorY) || 0,
          curScale: 1,
          curAngle: 0,
          curFlipScale: 1,
          initBBox: (Array.isArray(meta.initBBox) && meta.initBBox.length >= 4)
            ? meta.initBBox.slice(0, 4).map(r1Init)
            : null,
          origStrokes: selected.map(st => JSON.parse(JSON.stringify(st)))
        };
        this._lastCompletedLassoEndOp = null;
        this._recordAudioWorkspaceStateIfNeeded(true);
      } catch (_) { }
    }

    _updateAudioLassoTransformOp(meta = {}) {
      if (!this.isAudioRecording || !this._activeRecLassoOp) return;
      try {
        const op = this._activeRecLassoOp;
        if (op.mode === 'move') {
          if (typeof meta.screenX === 'number') op.curDx = meta.screenX - op.startScreenX;
          if (typeof meta.screenY === 'number') op.curDy = meta.screenY - op.startScreenY;
        } else if (op.mode === 'resize') {
          if (typeof meta.scale === 'number' && Number.isFinite(meta.scale)) {
            op.curScale = meta.scale;
          }
        } else if (op.mode === 'rotate') {
          if (typeof meta.angle === 'number' && Number.isFinite(meta.angle)) {
            op.curAngle = meta.angle;
          }
        } else if (op.mode === 'flipX' || op.mode === 'flipY') {
          if (typeof meta.flipScale === 'number' && Number.isFinite(meta.flipScale)) {
            op.curFlipScale = meta.flipScale;
          }
        }
        this._recordAudioWorkspaceStateIfNeeded(false);
      } catch (_) { }
    }

    _commitAudioLassoTransformOp() {
      const op = this._activeRecLassoOp;
      this._activeRecLassoOp = null;
      if (!op || !this.isAudioRecording) return;
      try {
        const endRecT = Math.max(op.startMs, Math.round(this.getAudioRecordElapsedMs()));
        let changed = false;
        if (op.mode === 'move') {
          changed = Math.hypot(op.curDx || 0, op.curDy || 0) >= 0.4;
        } else if (op.mode === 'resize') {
          changed = Math.abs((op.curScale || 1) - 1) >= 0.002;
        } else if (op.mode === 'rotate') {
          changed = Math.abs(op.curAngle || 0) >= 0.005;
        } else if (op.mode === 'flipX' || op.mode === 'flipY') {
          op.curFlipScale = -1;
          changed = true;
        }
        if (changed) {
          const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
          const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
          this._lastCompletedLassoEndOp = {
            opId: op.opId,
            mode: op.mode,
            dx: r1(op.curDx || 0),
            dy: r1(op.curDy || 0),
            ax: r1(op.anchorX || 0),
            ay: r1(op.anchorY || 0),
            scale: r3(op.curScale || 1),
            angle: r3(op.curAngle || 0),
            flipScale: r3(typeof op.curFlipScale === 'number' ? op.curFlipScale : 1),
            initBBox: op.initBBox || undefined
          };
          if (Array.isArray(op.origStrokes)) {
            op.origStrokes.forEach(origSt => {
              this._archiveStrokeRemovedDuringRecording(origSt, endRecT, {
                _lassoOpId: op.opId,
                _lassoOpStartMs: op.startMs
              });
            });
          }
          if (Array.isArray(this.selectedInkStrokes)) {
            this.selectedInkStrokes.forEach(st => {
              this._stampStrokeAppearedAtRecordingTime(st, endRecT);
            });
          }
        }
        this._recordAudioWorkspaceStateIfNeeded(true);
        this._lastCompletedLassoEndOp = null;
      } catch (_) {
        this._lastCompletedLassoEndOp = null;
      }
    }

    _captureCompactLassoStateForAudio() {
      if (!this.isInkMode || this.activeInkTool !== 'lasso') return null;
      const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
      const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
      if (this.isLassoSelecting && Array.isArray(this.lassoPoints) && this.lassoPoints.length > 1) {
        const rawPts = this.lassoPoints;
        const compactPts = [[r1(rawPts[0].x), r1(rawPts[0].y)]];
        let lastX = rawPts[0].x;
        let lastY = rawPts[0].y;
        const stride = rawPts.length > 120 ? Math.ceil(rawPts.length / 72) : 1;
        for (let i = 1; i < rawPts.length - 1; i += stride) {
          const p = rawPts[i];
          if (!p) continue;
          if (Math.hypot(p.x - lastX, p.y - lastY) >= 3.2) {
            compactPts.push([r1(p.x), r1(p.y)]);
            lastX = p.x;
            lastY = p.y;
          }
        }
        const tail = rawPts[rawPts.length - 1];
        if (tail) {
          compactPts.push([r1(tail.x), r1(tail.y)]);
        }
        return {
          selecting: true,
          pts: compactPts,
          bbox: null,
          showBar: false,
          opId: null
        };
      }
      const hasSelection = (Array.isArray(this.selectedInkStrokes) && this.selectedInkStrokes.length > 0) ||
        (Array.isArray(this.selectedTextLabels) && this.selectedTextLabels.length > 0);
      const bboxObj = hasSelection
        ? (typeof this._ensureFreshLassoBoundingBox === 'function' ? this._ensureFreshLassoBoundingBox() : this.lassoBoundingBox)
        : null;
      if (!bboxObj) return null;
      const bbox = [r1(bboxObj.minX), r1(bboxObj.minY), r1(bboxObj.maxX), r1(bboxObj.maxY)];
      const op = this._activeRecLassoOp;
      const isBusy = Boolean(
        this.isLassoSelecting ||
        this.isDraggingLassoSelection ||
        this.isResizingLassoSelection ||
        this.isRotatingLassoSelection ||
        this._lassoFlipAnim ||
        op
      );
      const out = {
        selecting: false,
        pts: null,
        bbox,
        showBar: !isBusy,
        opId: op ? op.opId : null
      };
      if (op) {
        out.mode = op.mode;
        out.dx = r1(op.curDx || 0);
        out.dy = r1(op.curDy || 0);
        out.ax = r1(op.anchorX || 0);
        out.ay = r1(op.anchorY || 0);
        out.scale = r3(op.curScale || 1);
        out.angle = r3(op.curAngle || 0);
        out.flipScale = r3(typeof op.curFlipScale === 'number' ? op.curFlipScale : 1);
        if (op.initBBox) out.initBBox = op.initBBox;
      } else if (this._lastCompletedLassoEndOp) {
        out.endOp = { ...this._lastCompletedLassoEndOp };
      }
      return out;
    }

    _archivePdfBoardForAudioRecording(pbd) {
      if (!this.isAudioRecording || this._isPausedStandbyOnSlide || !pbd) return;
      try {
        if (!this.audioArchivedPdfBoards || typeof this.audioArchivedPdfBoards !== 'object') {
          this.audioArchivedPdfBoards = {};
        }
        const pNum = pbd.pageNum || 1;
        const hasLiveVec = Boolean(typeof this._hasLivePdfSourceForBoard === 'function' && this._hasLivePdfSourceForBoard(pbd));
        const dataUrl = pbd.dataUrl ||
          (pbd.canvas && pbd.canvas._cachedDataUrl) ||
          (!hasLiveVec && pbd.canvas && !pbd.canvas._evicted && pbd.canvas.width > 4 && typeof this.encodeCanvasSmartWebP === 'function'
            ? (pbd.dataUrl = (pbd.canvas._cachedDataUrl = this.encodeCanvasSmartWebP(pbd.canvas, 0.88)))
            : '');
        this.audioArchivedPdfBoards[pNum] = {
          pageNum: pNum,
          pdfSourcePageNum: pbd.pdfSourcePageNum || pNum,
          totalPages: pbd.totalPages || 1,
          dataUrl: dataUrl || '',
          pixelW: pbd.pixelW || (pbd.canvas && pbd.canvas.width) || 1200,
          pixelH: pbd.pixelH || (pbd.canvas && pbd.canvas.height) || 1680,
          aspect: pbd.aspect || 1.4,
          mathW: pbd.mathW || 8.5,
          mathH: pbd.mathH || 12.0,
          centerX: pbd.centerX || 0,
          centerY: pbd.centerY || 0,
          baseYSpan: pbd.baseYSpan || 6.0,
          pdfDocUid: pbd.pdfDocUid || ''
        };
      } catch (_) { }
    }

    _archiveCurrentWorkspaceBeforeInPlaceClear(options = null) {
      if (
        !this.isAudioRecording ||
        this._isPausedStandbyOnSlide ||
        this._isAudioWaitingForNextSlideSetup ||
        this._isBuildingBatchCropSlide ||
        this._isDeserializingSlide ||
        this._isApplyingAudioTimelineState
      ) {
        return;
      }
      const opts = (options && typeof options === 'object') ? options : {};
      const includeProblemCards = opts.includeProblemCards !== false;
      const includeGraphCards = opts.includeGraphCards !== false;
      const includePdfBoard = opts.includePdfBoard !== false;
      const includeBoardInk = opts.includeBoardInk !== false;
      try {
        this._ensureLiveCardsHaveUids();
        if (this._activeRecLassoOp) {
          this._activeRecLassoOp = null;
        }
        if (includePdfBoard && this.pdfPageBoardData) {
          this._archivePdfBoardForAudioRecording(this.pdfPageBoardData);
        }
        if (includeProblemCards) {
          if (this.problemCardData) {
            this._archiveCardAssetForAudioRecording('prob', 'primary');
          }
          if (Array.isArray(this.extraProblemCards)) {
            this.extraProblemCards.forEach(c => {
              if (c && c.el) this._archiveCardAssetForAudioRecording('prob', c);
            });
          }
        }
        if (includeGraphCards) {
          if (this._hasPrimaryGraphCard && this.graphCardData) {
            this._archiveCardAssetForAudioRecording('graph', 'primary');
          }
          if (Array.isArray(this.extraGraphCards)) {
            this.extraGraphCards.forEach(c => {
              if (c && c.el) this._archiveCardAssetForAudioRecording('graph', c);
            });
          }
        }
        if (includeBoardInk && Array.isArray(this.inkStrokes) && this.inkStrokes.length > 0) {
          const recT = Math.max(0, Math.round(this.getAudioRecordElapsedMs()));
          for (let i = 0; i < this.inkStrokes.length; i++) {
            const st = this.inkStrokes[i];
            if (st) this._archiveStrokeRemovedDuringRecording(st, recT);
          }
        }
      } catch (_) { }
    }

    _ensureLiveCardsHaveUids() {
      const pWidget = typeof document !== 'undefined' ? document.getElementById('problemCardWidget') : null;
      if (pWidget && this.problemCardData && !this.problemCardData._tempFromProblemStamp) {
        if (!this.problemCardUid || !String(this.problemCardUid).startsWith('problem_')) {
          this.problemCardUid = (pWidget._cardUid && String(pWidget._cardUid).startsWith('problem_'))
            ? pWidget._cardUid
            : this._nextAudioStrokeId('problem_uid');
        }
        pWidget._cardUid = this.problemCardUid;
      }
      const gWidget = typeof document !== 'undefined' ? document.getElementById('graphCardWidget') : null;
      if (gWidget && this._hasPrimaryGraphCard && this.graphCardData) {
        if (!this.graphCardUid || !String(this.graphCardUid).startsWith('graph_')) {
          this.graphCardUid = (gWidget._cardUid && String(gWidget._cardUid).startsWith('graph_'))
            ? gWidget._cardUid
            : this._nextAudioStrokeId('graph_uid');
        }
        gWidget._cardUid = this.graphCardUid;
      }
      if (Array.isArray(this.extraProblemCards)) {
        this.extraProblemCards.forEach(c => {
          if (!c) return;
          if (!c.cardUid || !String(c.cardUid).startsWith('problem_')) {
            c.cardUid = (c.el && c.el._cardUid && String(c.el._cardUid).startsWith('problem_'))
              ? c.el._cardUid
              : this._nextAudioStrokeId('problem_uid');
          }
          if (c.el) c.el._cardUid = c.cardUid;
        });
      }
      if (Array.isArray(this.extraGraphCards)) {
        this.extraGraphCards.forEach(c => {
          if (!c) return;
          if (!c.cardUid || !String(c.cardUid).startsWith('graph_')) {
            c.cardUid = (c.el && c.el._cardUid && String(c.el._cardUid).startsWith('graph_'))
              ? c.el._cardUid
              : this._nextAudioStrokeId('graph_uid');
          }
          if (c.el) c.el._cardUid = c.cardUid;
        });
      }
    }

    _archiveCardAssetForAudioRecording(kind, cardRef = 'primary', opts = null) {
      if (!this.isAudioRecording || this._isPausedStandbyOnSlide || this._isDeserializingSlide || this._isApplyingAudioTimelineState) return;
      try {
        this._ensureLiveCardsHaveUids();
        if (!this.audioCardAssetPool || typeof this.audioCardAssetPool !== 'object') {
          this.audioCardAssetPool = {};
        }
        if (kind === 'prob') {
          const isPrimary = (cardRef === 'primary');
          const widget = isPrimary
            ? (typeof document !== 'undefined' ? document.getElementById('problemCardWidget') : null)
            : (cardRef && cardRef.el);
          if (!widget) return;
          if (isPrimary && !this.problemCardData) return;
          const uid = isPrimary
            ? (this.problemCardUid || widget._cardUid || this._nextAudioStrokeId('problem_uid'))
            : ((cardRef && cardRef.cardUid) || widget._cardUid || this._nextAudioStrokeId('problem_uid'));
          const existing = this.audioCardAssetPool[uid];
          const stampRefId = (opts && opts.stampStrokeId) || (existing && existing.stampRefId) || null;
          const imgEl = isPrimary
            ? (typeof document !== 'undefined' ? document.getElementById('problemCardImg') : null)
            : widget.querySelector('.problem-card-img');
          const titleEl = isPrimary
            ? (typeof document !== 'undefined' ? document.getElementById('problemCardTitle') : null)
            : widget.querySelector('.card-title-text');
          const rawUrl = (imgEl && imgEl.src) || (isPrimary && this.problemCardData && this.problemCardData.imgUrl) || '';
          const rawCropRef = isPrimary
            ? (this.problemCardData && this.problemCardData.pdfCropRef)
            : (cardRef && (cardRef.pdfCropRef || (widget && widget._pdfCropRef)));
          const strokes = isPrimary ? (this.problemInkStrokes || []) : (widget._cardInkStrokes || []);
          this.audioCardAssetPool[uid] = {
            uid,
            kind: 'prob',
            stampRefId,
            dataUrl: stampRefId ? '' : rawUrl,
            pdfCropRef: (rawCropRef && typeof rawCropRef === 'object') ? { ...rawCropRef } : null,
            aspect: isPrimary ? (this.problemCardAspect || 0.65) : 0.65,
            cardW: parseFloat(widget.style.width) || 480,
            titleText: titleEl ? titleEl.textContent : '문제',
            isPdfPageCard: Boolean(!isPrimary && cardRef && cardRef.isPdfPageCard),
            pdfPageNum: isPrimary
              ? ((this.problemCardData && this.problemCardData.pageNum) || 1)
              : ((cardRef && cardRef.pdfPageNum) || 1),
            cardStrokes: JSON.parse(JSON.stringify(strokes))
          };
        } else if (kind === 'graph') {
          const isPrimary = (cardRef === 'primary');
          const widget = isPrimary
            ? (typeof document !== 'undefined' ? document.getElementById('graphCardWidget') : null)
            : (cardRef && cardRef.el);
          if (!widget) return;
          if (isPrimary && (!this._hasPrimaryGraphCard || !this.graphCardData)) return;
          const uid = isPrimary
            ? (this.graphCardUid || widget._cardUid || this._nextAudioStrokeId('graph_uid'))
            : ((cardRef && cardRef.cardUid) || widget._cardUid || this._nextAudioStrokeId('graph_uid'));
          const imgEl = isPrimary
            ? (typeof document !== 'undefined' ? document.getElementById('graphCardImg') : null)
            : widget.querySelector('.problem-card-img');
          const titleEl = isPrimary
            ? (typeof document !== 'undefined' ? document.getElementById('graphCardTitle') : null)
            : widget.querySelector('.card-title-text');
          const aspect = isPrimary ? (this.graphCardAspect || 0.82) : ((cardRef && cardRef.aspect) || 0.82);
          const cardW = parseFloat(widget.style.width) || 360;
          const pipSnap = this._extractCompactPipSnapForAudio(isPrimary ? 'primary' : cardRef, cardW, aspect);
          const rawSnap = typeof this._getMutablePipCardSnapshot === 'function'
            ? this._getMutablePipCardSnapshot(isPrimary ? 'primary' : cardRef)
            : null;
          const isStudio = Boolean(rawSnap && rawSnap.isNAxisStudioCard);
          const strokes = isPrimary ? (this.graphInkStrokes || []) : (widget._cardInkStrokes || []);
          this.audioCardAssetPool[uid] = {
            uid,
            kind: 'graph',
            aspect,
            cardW,
            caseIdx: isPrimary ? 1 : ((cardRef && cardRef.caseIdx) || 2),
            titleText: titleEl ? titleEl.textContent : (isPrimary ? '#1' : `#${(cardRef && cardRef.caseIdx) || 2}`),
            isNAxisStudioCard: isStudio,
            dataUrl: isStudio && imgEl ? imgEl.src : '',
            pipSnap,
            cardStrokes: JSON.parse(JSON.stringify(strokes))
          };
        }
      } catch (_) { }
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
        const h = r1(raw._pipCardH || Math.max(60, Math.round(w * aspect)));
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
          showXAxis: raw.showXAxis !== false,
          showYAxis: raw.showYAxis !== false,
          showGuides: Boolean(raw.showGuides),
          showInverseGuide: Boolean(raw.showInverseGuide),
          showGridNumbers: Boolean(raw.showGridNumbers),
          showAsymptotes: raw.showAsymptotes !== false,
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
          isNAxisStudioCard: Boolean(raw.isNAxisStudioCard),
          nAxisStudioState: (raw.isNAxisStudioCard && raw.nAxisStudioState)
            ? JSON.parse(JSON.stringify(raw.nAxisStudioState))
            : undefined,
          _isPipCardSnapshot: true,
          _pipCardW: w,
          _pipCardH: h
        };
      } catch (_) {
        return null;
      }
    }

    _applyReplayVisualThemeAndPaper(themeKey, paperType, isMono) {
      let visualChanged = false;
      if (typeof isMono === 'boolean' && this.isMonochromeMode !== isMono) {
        this.isMonochromeMode = isMono;
        visualChanged = true;
      }
      if (themeKey && this.canvasThemes && this.canvasThemes[themeKey] && this.currentThemeKey !== themeKey) {
        this.currentThemeKey = themeKey;
        visualChanged = true;
      }
      if (paperType && ['blank', 'grid', 'lined', 'dot'].includes(paperType) && this.boardPaperType !== paperType) {
        this.boardPaperType = paperType;
        visualChanged = true;
      }
      if (!visualChanged) return;

      const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || null;
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('mode-monochrome', Boolean(this.isMonochromeMode));
        const effLight = Boolean(this.isMonochromeMode || (curTheme && curTheme.isLight));
        document.body.classList.toggle('theme-light', effLight);
        const effBg = this.isMonochromeMode ? '#ffffff' : ((curTheme && curTheme.bg) || '#ffffff');
        if (document.documentElement && document.documentElement.style) {
          document.documentElement.style.setProperty('--app-root-bg', effBg);
          document.documentElement.style.backgroundColor = effBg;
        }
        if (document.body.style) {
          document.body.style.setProperty('--app-root-bg', effBg);
          document.body.style.backgroundColor = effBg;
        }
        if (this.canvas && this.canvas.parentElement && this.canvas.parentElement.style) {
          this.canvas.parentElement.style.backgroundColor = effBg;
        }
        document.querySelectorAll('.theme-chip').forEach(c => {
          c.classList.toggle('active', Boolean(c.dataset && c.dataset.theme === this.currentThemeKey));
        });
        document.querySelectorAll('.board-paper-chip').forEach(btn => {
          btn.classList.toggle('active', Boolean(btn.dataset && btn.dataset.paper === this.boardPaperType));
        });
        const btnMono = document.getElementById('btnMonochromeMode');
        if (btnMono) btnMono.classList.toggle('active', Boolean(this.isMonochromeMode));
      }
      if (typeof this._syncIosTopGuardColor === 'function') {
        this._syncIosTopGuardColor();
      }
      if (this.inkPalettes && typeof this.updateInkPaletteUI === 'function') {
        try { this.updateInkPaletteUI(); } catch (_) { }
      }
      this._inkBakeDirty = true;
      this._hasSceneFreeze = false;
    }

    _captureAudioWorkspaceKeyframe() {
      this._ensureLiveCardsHaveUids();
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
          uid: (c && (c.cardUid || (c.el && c.el._cardUid))) || null,
          z: (c && c.el) ? (parseInt(c.el.style.zIndex, 10) || 150) : 150,
          baseX: r1(c && typeof c.baseX === 'number' ? c.baseX : 560),
          baseY: r1(c && typeof c.baseY === 'number' ? c.baseY : 68),
          pdfAnchor: (c && (c.el && c.el._pdfAnchor || c.pdfAnchor)) ? { ...(c.el && c.el._pdfAnchor || c.pdfAnchor) } : null,
          w: cw,
          aspect: cAspect,
          min: Boolean(c && (c.isMin || (c.el && c.el.classList.contains('minimized')))),
          inkActive: Boolean(c && c.el && c.el.classList.contains('card-ink-active')),
          stealth: Boolean(c && c.el && c.el.classList.contains('pip-stealth-locked')),
          pipSnap: c ? this._extractCompactPipSnapForAudio(c, cw, cAspect) : null,
          stickers: cloneArr(c && c.el && c.el._cardStickers)
        };
      });
      const extraProbStates = (this.extraProblemCards || []).map(c => ({
        uid: (c && (c.cardUid || (c.el && c.el._cardUid))) || null,
        z: (c && c.el) ? (parseInt(c.el.style.zIndex, 10) || 150) : 150,
        baseX: r1(c && typeof c.baseX === 'number' ? c.baseX : 72),
        baseY: r1(c && typeof c.baseY === 'number' ? c.baseY : 120),
        pdfAnchor: (c && (c.el && c.el._pdfAnchor || c.pdfAnchor)) ? { ...(c.el && c.el._pdfAnchor || c.pdfAnchor) } : null,
        w: r1((c && c.el) ? (parseFloat(c.el.style.width) || c.el.offsetWidth || 480) : 480),
        min: Boolean(c && (c.isMin || (c.el && c.el.classList.contains('minimized')))),
        inkActive: Boolean(c && c.el && c.el.classList.contains('card-ink-active')),
        locked: Boolean(c && c.el && c.el.classList.contains('pip-locked-mode')),
        stealth: Boolean(c && c.el && c.el.classList.contains('pip-stealth-locked')),
        stickers: cloneArr(c && c.el && c.el._cardStickers)
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
      const drawerSubContainer = document.getElementById('drawerSubpanelsContainer');
      const funcGridEl = document.getElementById('funcGrid');
      const drawerScrollTop = drawerOpen && drawerSubContainer ? Math.round(drawerSubContainer.scrollTop || 0) : 0;
      const funcGridScrollTop = drawerOpen && funcGridEl ? Math.round(funcGridEl.scrollTop || 0) : 0;
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
      const ctxSymPopEl = document.getElementById('ctxSymmetryPopover');
      const ctxAbsPopEl = document.getElementById('ctxAbsPopover');
      const railResetPopEl = document.getElementById('railResetBoardPopover');
      const inkSizeFlyoutEl = document.getElementById('inkSizeFlyout');
      const inkShapesPopEl = document.getElementById('inkShapesPopover');
      const quickThemeEl = document.getElementById('panelQuickTheme');
      const railAddPopEl = document.getElementById('railAddTargetPopover');
      const ctxSymPopOpen = Boolean(ctxSymPopEl && ctxSymPopEl.style.display !== 'none');
      const ctxAbsPopOpen = Boolean(ctxAbsPopEl && ctxAbsPopEl.style.display !== 'none');
      const railResetPopOpen = Boolean(railResetPopEl && railResetPopEl.style.display !== 'none');
      const inkSizeFlyoutOpen = Boolean(inkSizeFlyoutEl && inkSizeFlyoutEl.style.display !== 'none');
      const inkShapesPopOpen = Boolean(inkShapesPopEl && inkShapesPopEl.style.display !== 'none');
      const quickShapeMode = this.quickShapeMode || null;
      const quickThemeOpen = Boolean(quickThemeEl && (quickThemeEl.classList.contains('open') || quickThemeEl.style.display === 'block' || quickThemeEl.style.display === 'flex'));
      const unrenderedPopupKind = this._detectActiveUnrenderedPopupKind();
      const railAddTargetPop = (railAddPopEl && railAddPopEl.style.display !== 'none')
        ? {
          top: Math.round(parseFloat(railAddPopEl.style.top) || 12),
          labels: Array.from(railAddPopEl.querySelectorAll('button')).map(b => b.textContent || '')
        }
        : null;
      const allUIHidden = Boolean(
        this.isAllUIHidden ||
        (typeof document !== 'undefined' && document.body && document.body.classList && document.body.classList.contains('ui-all-hidden-mode'))
      );
      const snapDragRect = this._activeSnapDragRect ? { ...this._activeSnapDragRect } : null;
      const lassoState = this._captureCompactLassoStateForAudio();
      const stickerDraft = (this.isDrawingSticker && this.stickerDraftStart && this.stickerDraftCurrent)
        ? {
          screenPx: true,
          x1: r1(this.stickerDraftStart.x),
          y1: r1(this.stickerDraftStart.y),
          x2: r1(this.stickerDraftCurrent.x),
          y2: r1(this.stickerDraftCurrent.y)
        }
        : null;
      const activePdfBoard = this.pdfPageBoardData || (this._suspendedPdfBoardState && this._suspendedPdfBoardState.pdfPageBoardData) || null;
      const pdfBoardLayout = activePdfBoard
        ? {
          pageNum: activePdfBoard.pageNum || 1,
          cx: r4(activePdfBoard.centerX || 0),
          cy: r4(activePdfBoard.centerY || 0),
          mw: r4(activePdfBoard.mathW || 8.5),
          mh: r4(activePdfBoard.mathH || 12.0)
        }
        : null;
      const cardStickerDraft = this._activeCardStickerDraft ? { ...this._activeCardStickerDraft } : null;
      const pillRemoteEl = document.getElementById('quickPillRemote');
      const pillRemoteOpen = Boolean(this.isQuickPillRemoteOpen || (pillRemoteEl && pillRemoteEl.style.display !== 'none'));
      const pillModSig = this.pillModules
        ? `${Boolean(this.pillModules.tools)}|${Boolean(this.pillModules.shapes)}|${Boolean(this.pillModules.zoom)}|${Boolean(this.pillModules.color)}|${Boolean(this.pillModules.extra)}`
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
        allUIHidden,
        keepInkOnHide: Boolean(this.keepInkBarOnHide),
        keepSlideOnHide: Boolean(this.keepSlideBarOnHide),
        themeKey: this.currentThemeKey || 'white_paper',
        boardPaperType: this.boardPaperType || 'blank',
        isMonochromeMode: Boolean(this.isMonochromeMode),
        drawerOpen,
        activeDrawerPanel: this.activeDrawerPanel || '',
        activePresetCat,
        drawerScrollTop,
        funcGridScrollTop,
        inkMode: Boolean(this.isInkMode),
        inkBarHidden: Boolean(this.isBottomInkBarHidden),
        inkDockPos: this.inkDockPosition || 'bottom',
        activeInkTool: this.activeInkTool || 'pen',
        isPenDashed: Boolean(this.isPenDashed),
        inkPenStyle: this.inkPenStyle || 'ballpen',
        currentInkSize: r1(this.currentInkSize || 3.0),
        currentHighlighterSize: r1(this.currentHighlighterSize || 16),
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
        ctxSymPopOpen,
        ctxAbsPopOpen,
        railResetPopOpen,
        inkSizeFlyoutOpen,
        inkShapesPopOpen,
        quickShapeMode,
        quickThemeOpen,
        unrenderedPopupKind,
        railAddTargetPop,
        snapDragRect,
        lassoState,
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
        showInverseGuide: Boolean(this.showInverseGuide),
        useIntersectionDetector: Boolean(this.useIntersectionDetector),
        showGridNumbers: Boolean(this.showGridNumbers),
        showAsymptotes: this.showAsymptotes !== false,
        showAxisLabels: Boolean(this.showAxisLabels),
        axisLabelX: this.axisLabelX !== undefined ? String(this.axisLabelX) : 'x',
        axisLabelY: this.axisLabelY !== undefined ? String(this.axisLabelY) : 'y',
        axisLabelFontSize: Number(this.axisLabelFontSize) || 17,
        isTextToolMode: Boolean(this.isTextToolMode),
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
        pdfBoardLayout,
        probCardVisible: Boolean(pWidget && pWidget.style.display !== 'none' && this.problemCardData),
        probCardUid: (pWidget && pWidget.style.display !== 'none' && this.problemCardData) ? (this.problemCardUid || pWidget._cardUid || null) : null,
        probCardZ: pWidget ? (parseInt(pWidget.style.zIndex, 10) || 150) : 150,
        probCardMin: Boolean(this.isProblemCardMinimized),
        probCardInkActive: Boolean(pWidget && pWidget.classList.contains('card-ink-active')),
        probCardLocked: Boolean(pWidget && pWidget.classList.contains('pip-locked-mode')),
        probCardStealth: Boolean(pWidget && pWidget.classList.contains('pip-stealth-locked')),
        probCardBaseX: typeof this.problemCardBaseX === 'number' ? r1(this.problemCardBaseX) : this.problemCardBaseX,
        probCardBaseY: typeof this.problemCardBaseY === 'number' ? r1(this.problemCardBaseY) : this.problemCardBaseY,
        probCardPdfAnchor: (pWidget && pWidget._pdfAnchor || this.problemCardPdfAnchor) ? { ...(pWidget && pWidget._pdfAnchor || this.problemCardPdfAnchor) } : null,
        probCardW: r1(probW),
        graphCardVisible: Boolean(gWidget && gWidget.style.display !== 'none' && this._hasPrimaryGraphCard && this.graphCardData),
        graphCardUid: (gWidget && gWidget.style.display !== 'none' && this._hasPrimaryGraphCard && this.graphCardData) ? (this.graphCardUid || gWidget._cardUid || null) : null,
        graphCardZ: gWidget ? (parseInt(gWidget.style.zIndex, 10) || 150) : 150,
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

    _ensureReplayLiveCardsBackup() {
      if (this._replayLiveCardsBackup) return this._replayLiveCardsBackup;
      this._ensureLiveCardsHaveUids();
      const pWidget = typeof document !== 'undefined' ? document.getElementById('problemCardWidget') : null;
      const pImgEl = typeof document !== 'undefined' ? document.getElementById('problemCardImg') : null;
      const pTitleEl = typeof document !== 'undefined' ? document.getElementById('problemCardTitle') : null;
      const gWidget = typeof document !== 'undefined' ? document.getElementById('graphCardWidget') : null;
      const gImgEl = typeof document !== 'undefined' ? document.getElementById('graphCardImg') : null;
      const gTitleEl = typeof document !== 'undefined' ? document.getElementById('graphCardTitle') : null;

      const primaryProb = {
        uid: this.problemCardUid || (pWidget && pWidget._cardUid) || null,
        problemCardData: (this.problemCardData && !this.problemCardData._tempFromProblemStamp) ? this.problemCardData : null,
        problemCardAspect: this.problemCardAspect,
        problemCardImage: this.problemCardImage,
        problemInkStrokes: Array.isArray(this.problemInkStrokes) ? JSON.parse(JSON.stringify(this.problemInkStrokes)) : [],
        problemCardStickers: Array.isArray(this.problemCardStickers) ? JSON.parse(JSON.stringify(this.problemCardStickers)) : [],
        imgSrc: pImgEl ? pImgEl.src : '',
        titleText: pTitleEl ? pTitleEl.textContent : '문제',
        zIndex: pWidget ? (pWidget.style.zIndex || '') : ''
      };
      this._replaySavedLivePrimaryProb = primaryProb;

      const primaryGraphSnap = typeof this._getMutablePipCardSnapshot === 'function'
        ? this._getMutablePipCardSnapshot('primary')
        : null;
      const primaryGraph = {
        uid: this.graphCardUid || (gWidget && gWidget._cardUid) || null,
        hasPrimaryGraphCard: Boolean(this._hasPrimaryGraphCard && this.graphCardData),
        graphCardData: this.graphCardData ? JSON.parse(JSON.stringify(this.graphCardData)) : null,
        graphCardAspect: this.graphCardAspect,
        primaryGraphCardSnapshot: this.primaryGraphCardSnapshot,
        pipSnapObj: primaryGraphSnap ? JSON.parse(JSON.stringify(primaryGraphSnap)) : null,
        graphInkStrokes: Array.isArray(this.graphInkStrokes) ? JSON.parse(JSON.stringify(this.graphInkStrokes)) : [],
        graphCardStickers: Array.isArray(this.graphCardStickers) ? JSON.parse(JSON.stringify(this.graphCardStickers)) : [],
        imgSrc: gImgEl ? gImgEl.src : '',
        titleText: gTitleEl ? gTitleEl.textContent : '#1',
        zIndex: gWidget ? (gWidget.style.zIndex || '') : ''
      };

      const extraProbs = (this.extraProblemCards || []).filter(c => c && !c._tempFromProblemStamp && c.el).map(c => {
        const imgEl = c.el.querySelector('.problem-card-img');
        const tEl = c.el.querySelector('.card-title-text');
        const rawRef = c.pdfCropRef || c.el._pdfCropRef || null;
        return {
          uid: c.cardUid || c.el._cardUid || null,
          dataUrl: imgEl ? imgEl.src : '',
          cardW: parseFloat(c.el.style.width) || 480,
          titleText: tEl ? tEl.textContent : '문제',
          baseX: c.baseX,
          baseY: c.baseY,
          pdfAnchor: (c.el._pdfAnchor || c.pdfAnchor) ? { ...(c.el._pdfAnchor || c.pdfAnchor) } : null,
          pdfCropRef: (rawRef && typeof this._normalizePdfCropRef === 'function') ? this._normalizePdfCropRef(rawRef) : rawRef,
          isMin: Boolean(c.isMin),
          pipStealth: Boolean(c.el.classList.contains('pip-stealth-locked')),
          isPdfPageCard: Boolean(c.isPdfPageCard),
          pdfPageNum: c.pdfPageNum || 1,
          zIndex: c.el.style.zIndex || '',
          cardStrokes: JSON.parse(JSON.stringify(c.el._cardInkStrokes || [])),
          cardStickers: JSON.parse(JSON.stringify(c.el._cardStickers || []))
        };
      });

      const extraGraphs = (this.extraGraphCards || []).filter(c => c && !c._tempReplayGraphCard && c.el).map(c => {
        const imgEl = c.el.querySelector('.problem-card-img');
        const tEl = c.el.querySelector('.card-title-text');
        const snap = typeof this._getMutablePipCardSnapshot === 'function' ? this._getMutablePipCardSnapshot(c) : null;
        return {
          uid: c.cardUid || c.el._cardUid || null,
          dataUrl: imgEl ? imgEl.src : '',
          cardW: parseFloat(c.el.style.width) || 360,
          aspect: c.aspect || 0.82,
          caseIdx: c.caseIdx || 2,
          titleText: tEl ? tEl.textContent : `#${c.caseIdx || 2}`,
          baseX: c.baseX,
          baseY: c.baseY,
          pdfAnchor: (c.el._pdfAnchor || c.pdfAnchor) ? { ...(c.el._pdfAnchor || c.pdfAnchor) } : null,
          isMin: Boolean(c.isMin),
          zIndex: c.el.style.zIndex || '',
          isNAxisStudioCard: Boolean(snap && snap.isNAxisStudioCard),
          pipSnap: snap ? JSON.parse(JSON.stringify(snap)) : null,
          graphSnapshot: c.graphSnapshot,
          cardStrokes: JSON.parse(JSON.stringify(c.el._cardInkStrokes || [])),
          cardStickers: JSON.parse(JSON.stringify(c.el._cardStickers || []))
        };
      });

      const allSt = [
        ...(this.inkStrokes || []),
        ...((this.audioSyncData && Array.isArray(this.audioSyncData.erasedStrokes)) ? this.audioSyncData.erasedStrokes : [])
      ];
      const stampById = new Map();
      allSt.forEach(s => {
        if (s && s.id && s.isProblemStamp && s.graphStamp && s.graphStamp.dataUrl) {
          stampById.set(s.id, s);
        }
      });

      const byUid = {};
      const pool = (this.audioSyncData && this.audioSyncData.cardAssetPool && typeof this.audioSyncData.cardAssetPool === 'object')
        ? this.audioSyncData.cardAssetPool
        : (this.audioCardAssetPool || {});
      Object.keys(pool).forEach(uid => {
        const item = pool[uid];
        if (!item) return;
        const resolved = { ...item };
        if (!resolved.dataUrl && resolved.stampRefId && stampById.has(resolved.stampRefId)) {
          const stRef = stampById.get(resolved.stampRefId);
          resolved.dataUrl = stRef.graphStamp.dataUrl;
          if ((!resolved.cardStrokes || resolved.cardStrokes.length === 0) && Array.isArray(stRef.graphStamp.cardStrokes)) {
            resolved.cardStrokes = JSON.parse(JSON.stringify(stRef.graphStamp.cardStrokes));
          }
        }
        byUid[uid] = resolved;
      });
      if (primaryProb.uid && primaryProb.problemCardData) {
        byUid[primaryProb.uid] = {
          uid: primaryProb.uid,
          kind: 'prob',
          dataUrl: primaryProb.imgSrc || primaryProb.problemCardData.imgUrl || '',
          pdfCropRef: primaryProb.problemCardData.pdfCropRef || null,
          aspect: primaryProb.problemCardAspect || 0.65,
          titleText: primaryProb.titleText || '문제',
          pdfPageNum: primaryProb.problemCardData.pageNum || 1,
          cardStrokes: primaryProb.problemInkStrokes
        };
      }
      extraProbs.forEach(ep => {
        if (ep.uid) {
          byUid[ep.uid] = {
            uid: ep.uid,
            kind: 'prob',
            dataUrl: ep.dataUrl,
            pdfCropRef: ep.pdfCropRef || null,
            cardW: ep.cardW,
            titleText: ep.titleText,
            isPdfPageCard: ep.isPdfPageCard,
            pdfPageNum: ep.pdfPageNum,
            cardStrokes: ep.cardStrokes
          };
        }
      });
      if (primaryGraph.uid && primaryGraph.hasPrimaryGraphCard) {
        byUid[primaryGraph.uid] = {
          uid: primaryGraph.uid,
          kind: 'graph',
          aspect: primaryGraph.graphCardAspect || 0.82,
          titleText: primaryGraph.titleText || '#1',
          isNAxisStudioCard: Boolean(primaryGraph.pipSnapObj && primaryGraph.pipSnapObj.isNAxisStudioCard),
          dataUrl: primaryGraph.imgSrc || '',
          pipSnap: primaryGraph.pipSnapObj,
          cardStrokes: primaryGraph.graphInkStrokes
        };
      }
      extraGraphs.forEach(eg => {
        if (eg.uid) {
          byUid[eg.uid] = {
            uid: eg.uid,
            kind: 'graph',
            cardW: eg.cardW,
            aspect: eg.aspect,
            caseIdx: eg.caseIdx,
            titleText: eg.titleText,
            isNAxisStudioCard: eg.isNAxisStudioCard,
            dataUrl: eg.dataUrl,
            pipSnap: eg.pipSnap,
            cardStrokes: eg.cardStrokes
          };
        }
      });

      this._replayLiveCardsBackup = {
        primaryProb,
        primaryGraph,
        extraProbs,
        extraGraphs,
        pdfPageBoardData: this.pdfPageBoardData,
        pdfOrigMetrics: this.pdfPageBoardData ? {
          centerX: this.pdfPageBoardData.centerX,
          centerY: this.pdfPageBoardData.centerY,
          mathW: this.pdfPageBoardData.mathW,
          mathH: this.pdfPageBoardData.mathH
        } : null,
        suspendedPdfBoardState: this._suspendedPdfBoardState,
        byUid
      };
      return this._replayLiveCardsBackup;
    }

    _restoreTempReplayProblemCards() {
      const fullBk = this._replayLiveCardsBackup;
      this._replayLiveCardsBackup = null;
      this._replaySavedLivePrimaryProb = null;
      this._replayArchivedPdfCache = null;

      if (fullBk) {
        // 1) PDF 보드 원본 복구
        this.pdfPageBoardData = fullBk.pdfPageBoardData || null;
        if (this.pdfPageBoardData && fullBk.pdfOrigMetrics) {
          this.pdfPageBoardData.centerX = fullBk.pdfOrigMetrics.centerX;
          this.pdfPageBoardData.centerY = fullBk.pdfOrigMetrics.centerY;
          this.pdfPageBoardData.mathW = fullBk.pdfOrigMetrics.mathW;
          this.pdfPageBoardData.mathH = fullBk.pdfOrigMetrics.mathH;
        }
        this._suspendedPdfBoardState = fullBk.suspendedPdfBoardState || null;

        // 2) 기본 문제 카드 복구
        const bkP = fullBk.primaryProb;
        const pWidget = typeof document !== 'undefined' ? document.getElementById('problemCardWidget') : null;
        const pImgEl = typeof document !== 'undefined' ? document.getElementById('problemCardImg') : null;
        const pTitleEl = typeof document !== 'undefined' ? document.getElementById('problemCardTitle') : null;
        const pCanvas = typeof document !== 'undefined' ? document.getElementById('problemCardCanvas') : null;
        this.problemCardUid = bkP.uid;
        this.problemCardData = bkP.problemCardData;
        this.problemCardAspect = bkP.problemCardAspect;
        this.problemCardImage = bkP.problemCardImage;
        this.problemInkStrokes = JSON.parse(JSON.stringify(bkP.problemInkStrokes || []));
        this.problemCardStickers = JSON.parse(JSON.stringify(bkP.problemCardStickers || []));
        if (pCanvas) {
          pCanvas._bakeValid = false;
          pCanvas._displaySyncedCount = -1;
        }
        if (pWidget) {
          pWidget._cardUid = bkP.uid;
          pWidget._replayBoundUid = null;
          if (bkP.zIndex) pWidget.style.zIndex = bkP.zIndex;
          if (typeof pWidget._renderCardStickers === 'function') pWidget._renderCardStickers();
        }
        if (pImgEl) pImgEl.src = bkP.imgSrc || '';
        if (pTitleEl && typeof bkP.titleText === 'string') pTitleEl.textContent = bkP.titleText;
        if (!this.problemCardData) {
          this.problemCardRect = null;
          if (pWidget) pWidget.style.display = 'none';
        }

        // 3) 기본 그래프 카드 복구
        const bkG = fullBk.primaryGraph;
        const gWidget = typeof document !== 'undefined' ? document.getElementById('graphCardWidget') : null;
        const gImgEl = typeof document !== 'undefined' ? document.getElementById('graphCardImg') : null;
        const gTitleEl = typeof document !== 'undefined' ? document.getElementById('graphCardTitle') : null;
        const gCanvas = typeof document !== 'undefined' ? document.getElementById('graphCardCanvas') : null;
        this.graphCardUid = bkG.uid;
        this._hasPrimaryGraphCard = bkG.hasPrimaryGraphCard;
        this.graphCardData = bkG.graphCardData;
        this.graphCardAspect = bkG.graphCardAspect;
        this.primaryGraphCardSnapshot = bkG.primaryGraphCardSnapshot;
        this.graphInkStrokes = JSON.parse(JSON.stringify(bkG.graphInkStrokes || []));
        this.graphCardStickers = JSON.parse(JSON.stringify(bkG.graphCardStickers || []));
        if (gCanvas) {
          gCanvas._bakeValid = false;
          gCanvas._displaySyncedCount = -1;
        }
        if (gWidget) {
          gWidget._cardUid = bkG.uid;
          gWidget._replayBoundUid = null;
          gWidget._pipSnapObj = bkG.pipSnapObj ? JSON.parse(JSON.stringify(bkG.pipSnapObj)) : null;
          if (bkG.zIndex) gWidget.style.zIndex = bkG.zIndex;
          if (typeof gWidget._renderCardStickers === 'function') gWidget._renderCardStickers();
          if (!bkG.hasPrimaryGraphCard) gWidget.style.display = 'none';
        }
        if (gImgEl && bkG.imgSrc !== undefined) gImgEl.src = bkG.imgSrc || '';
        if (gTitleEl && typeof bkG.titleText === 'string') gTitleEl.textContent = bkG.titleText;

        // 4) 추가 문제 카드 복구
        if (Array.isArray(this.extraProblemCards)) {
          this.extraProblemCards.forEach(c => {
            if (c && c.el) {
              if (typeof this.clearProblemCardStealthTimer === 'function') this.clearProblemCardStealthTimer(c.el);
              if (typeof this._hibernateDetachedCardCanvases === 'function') this._hibernateDetachedCardCanvases(c.el);
              if (this._activePeekCardEl === c.el) this._activePeekCardEl = null;
              c.el.remove();
            }
          });
          this.extraProblemCards = [];
        }
        if (typeof this.spawnExtraProblemCard === 'function') {
          fullBk.extraProbs.forEach(ep => {
            const sp = this.spawnExtraProblemCard(ep.dataUrl, ep.pdfPageNum || 1, ep.cardW || 480, null, {
              customX: ep.baseX,
              customY: ep.baseY,
              customTitle: ep.titleText,
              startMinimized: ep.isMin,
              isPdfPageCard: ep.isPdfPageCard,
              pdfPageNum: ep.pdfPageNum,
              pdfCropRef: ep.pdfCropRef || null,
              cardUid: ep.uid,
              silentToast: true
            });
            if (sp && sp.el) {
              sp.cardUid = ep.uid;
              sp.el._cardUid = ep.uid;
              sp.pdfAnchor = ep.pdfAnchor ? { ...ep.pdfAnchor } : null;
              sp.el._pdfAnchor = ep.pdfAnchor ? { ...ep.pdfAnchor } : null;
              if (ep.zIndex) sp.el.style.zIndex = ep.zIndex;
              sp.el._cardInkStrokes = JSON.parse(JSON.stringify(ep.cardStrokes || []));
              sp.el._cardStickers = JSON.parse(JSON.stringify(ep.cardStickers || []));
              if (typeof sp.el._renderCardInkCanvas === 'function') sp.el._renderCardInkCanvas();
              if (typeof sp.el._renderCardStickers === 'function') sp.el._renderCardStickers();
            }
          });
        }

        // 5) 추가 그래프 카드 복구
        if (Array.isArray(this.extraGraphCards)) {
          this.extraGraphCards.forEach(c => {
            if (c && c.el) {
              if (typeof this.clearPipGraphCardStealthTimer === 'function') this.clearPipGraphCardStealthTimer(c);
              if (typeof this._hibernateDetachedCardCanvases === 'function') this._hibernateDetachedCardCanvases(c.el);
              if (this._activePeekCardEl === c.el) this._activePeekCardEl = null;
              c.el.remove();
            }
          });
          this.extraGraphCards = [];
        }
        if (typeof this.spawnExtraGraphArchiveCard === 'function') {
          fullBk.extraGraphs.forEach(eg => {
            const spG = this.spawnExtraGraphArchiveCard(
              eg.dataUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
              eg.cardW || 360,
              eg.aspect || 0.82,
              eg.graphSnapshot || (eg.pipSnap ? JSON.stringify(eg.pipSnap) : null),
              null,
              {
                directBasePos: { x: eg.baseX, y: eg.baseY },
                cardUid: eg.uid
              }
            );
            if (spG && spG.el) {
              spG.cardUid = eg.uid;
              spG.el._cardUid = eg.uid;
              spG.caseIdx = eg.caseIdx || spG.caseIdx;
              const tEl = spG.el.querySelector('.card-title-text');
              if (tEl && eg.titleText) tEl.textContent = eg.titleText;
              if (eg.zIndex) spG.el.style.zIndex = eg.zIndex;
              spG.pdfAnchor = eg.pdfAnchor ? { ...eg.pdfAnchor } : null;
              spG.el._pdfAnchor = eg.pdfAnchor ? { ...eg.pdfAnchor } : null;
              spG.el._cardInkStrokes = JSON.parse(JSON.stringify(eg.cardStrokes || []));
              spG.el._cardStickers = JSON.parse(JSON.stringify(eg.cardStickers || []));
              if (eg.isMin) {
                spG.isMin = true;
                spG.el.classList.add('minimized');
              }
              if (typeof spG.el._renderCardInkCanvas === 'function') spG.el._renderCardInkCanvas();
              if (typeof spG.el._renderCardStickers === 'function') spG.el._renderCardStickers();
            }
          });
        }
        return;
      }

      if (this.problemCardData && this.problemCardData._tempFromProblemStamp) {
        this.problemCardData = null;
        this.problemCardImage = null;
        this.problemCardRect = null;
        this.problemInkStrokes = [];
        const pWidget = typeof document !== 'undefined' ? document.getElementById('problemCardWidget') : null;
        if (pWidget) pWidget.style.display = 'none';
      }
      if (Array.isArray(this.extraProblemCards) && this.extraProblemCards.some(c => c && c._tempFromProblemStamp)) {
        this.extraProblemCards = this.extraProblemCards.filter(c => {
          if (c && c._tempFromProblemStamp) {
            if (c.el) {
              if (typeof this.clearProblemCardStealthTimer === 'function') this.clearProblemCardStealthTimer(c.el);
              if (typeof this._hibernateDetachedCardCanvases === 'function') this._hibernateDetachedCardCanvases(c.el);
              if (this._activePeekCardEl === c.el) this._activePeekCardEl = null;
              c.el.remove();
            }
            return false;
          }
          return true;
        });
      }
    }

    _syncReplayProblemCardsFromStamps(kf) {
      const isReplayMode = Boolean(this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode);
      if (!isReplayMode || !kf) {
        this._restoreTempReplayProblemCards();
        return;
      }
      const bk = this._ensureReplayLiveCardsBackup();
      const playMs = Math.max(0, Number(this.audioPlayCurrentMs) || 0);
      const allSt = [
        ...(this.inkStrokes || []),
        ...((this.audioSyncData && Array.isArray(this.audioSyncData.erasedStrokes)) ? this.audioSyncData.erasedStrokes : [])
      ];

      // 0) PDF 보드 좌표계(rebase 보호) 및 닫힌 PDF 보드 복원
      if (kf.pdfBoardLayout !== undefined) {
        if (kf.pdfBoardLayout === null) {
          if (this.pdfPageBoardData || (this._suspendedPdfBoardState && this._suspendedPdfBoardState.pdfPageBoardData)) {
            this.pdfPageBoardData = null;
            this._suspendedPdfBoardState = null;
            this._inkBakeDirty = true;
          }
        } else {
          const pl = kf.pdfBoardLayout;
          let targetPbd = this.pdfPageBoardData || (this._suspendedPdfBoardState && this._suspendedPdfBoardState.pdfPageBoardData) || null;
          if (!targetPbd || (pl.pageNum && targetPbd.pageNum !== pl.pageNum)) {
            const archMap = (this.audioSyncData && this.audioSyncData.archivedPdfBoards) || this.audioArchivedPdfBoards || {};
            const archEntry = archMap[pl.pageNum || 1];
            if (archEntry) {
              if (!this._replayArchivedPdfCache) this._replayArchivedPdfCache = {};
              if (!this._replayArchivedPdfCache[pl.pageNum || 1]) {
                const clonedPbd = { ...archEntry };
                if ((clonedPbd.dataUrl || clonedPbd.pdfDocUid) && typeof this._ensurePdfBoardCanvasFromDataUrl === 'function') {
                  this._ensurePdfBoardCanvasFromDataUrl(clonedPbd);
                } else if (clonedPbd.dataUrl && typeof Image !== 'undefined') {
                  const imgObj = new Image();
                  imgObj.onload = () => {
                    const offC = document.createElement('canvas');
                    offC.width = imgObj.naturalWidth || clonedPbd.pixelW || 1200;
                    offC.height = imgObj.naturalHeight || clonedPbd.pixelH || 1680;
                    const oCtx = offC.getContext('2d');
                    if (oCtx) oCtx.drawImage(imgObj, 0, 0);
                    clonedPbd.canvas = offC;
                    this.requestRender();
                  };
                  imgObj.src = clonedPbd.dataUrl;
                  clonedPbd.img = imgObj;
                }
                this._replayArchivedPdfCache[pl.pageNum || 1] = clonedPbd;
              }
              targetPbd = this._replayArchivedPdfCache[pl.pageNum || 1];
            } else if (bk.pdfPageBoardData) {
              targetPbd = bk.pdfPageBoardData;
            }
          }
          if (targetPbd) {
            if (typeof pl.cx === 'number') targetPbd.centerX = pl.cx;
            if (typeof pl.cy === 'number') targetPbd.centerY = pl.cy;
            if (typeof pl.mw === 'number' && pl.mw > 0) targetPbd.mathW = pl.mw;
            if (typeof pl.mh === 'number' && pl.mh > 0) targetPbd.mathH = pl.mh;
            if (this.isGraphCovered) {
              if (this.pdfPageBoardData !== targetPbd) {
                this.pdfPageBoardData = targetPbd;
                this._inkBakeDirty = true;
              }
            } else {
              this._suspendedPdfBoardState = { ...(this._suspendedPdfBoardState || {}), pdfPageBoardData: targetPbd };
              if (this.pdfPageBoardData) {
                this.pdfPageBoardData = null;
                this._inkBakeDirty = true;
              }
            }
          }
        }
      }

      // 1) 기본 문제 카드(#problemCardWidget): UID 에셋 풀 우선 바인딩 + 레거시 스탬프 폴백
      const pWidget = typeof document !== 'undefined' ? document.getElementById('problemCardWidget') : null;
      if (kf.probCardVisible) {
        const uidAsset = (kf.probCardUid && bk.byUid[kf.probCardUid]) ? bk.byUid[kf.probCardUid] : null;
        if (uidAsset && uidAsset.dataUrl) {
          if (!pWidget || pWidget._replayBoundUid !== kf.probCardUid || !this.problemCardData) {
            this.problemCardUid = kf.probCardUid;
            if (pWidget) {
              pWidget._cardUid = kf.probCardUid;
              pWidget._replayBoundUid = kf.probCardUid;
            }
            this.problemCardData = { imgUrl: uidAsset.dataUrl, pageNum: uidAsset.pdfPageNum || 1, _tempFromProblemStamp: kf.probCardUid };
            this.problemCardAspect = uidAsset.aspect || 0.65;
            this.problemInkStrokes = Array.isArray(uidAsset.cardStrokes) ? JSON.parse(JSON.stringify(uidAsset.cardStrokes)) : [];
            const pCanvas = typeof document !== 'undefined' ? document.getElementById('problemCardCanvas') : null;
            if (pCanvas) {
              pCanvas._bakeValid = false;
              pCanvas._displaySyncedCount = -1;
            }
            const pTitleEl = typeof document !== 'undefined' ? document.getElementById('problemCardTitle') : null;
            if (pTitleEl && uidAsset.titleText) pTitleEl.textContent = uidAsset.titleText;
            const pImgEl = typeof document !== 'undefined' ? document.getElementById('problemCardImg') : null;
            if (pImgEl && pImgEl.src !== uidAsset.dataUrl) {
              pImgEl.onload = () => {
                if (this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode) {
                  if (pImgEl.naturalWidth > 0 && pImgEl.naturalHeight > 0) {
                    this.problemCardAspect = pImgEl.naturalHeight / pImgEl.naturalWidth;
                  }
                  this.syncProblemCardRectFromWidget();
                  this.requestRender();
                }
              };
              pImgEl.src = uidAsset.dataUrl;
            }
          }
        } else {
          let matchedPrimaryStamp = null;
          let bestT = Infinity;
          for (let i = 0; i < allSt.length; i++) {
            const s = allSt[i];
            if (!s || !s.isProblemStamp || !s.graphStamp || !s.graphStamp.dataUrl) continue;
            const gs = s.graphStamp;
            if (gs.isExtraProblemCard || gs.refCardW === 480) continue;
            const tSt = (typeof s.tStart === 'number') ? s.tStart : Infinity;
            if (tSt > playMs && (s.erasedAt === undefined || s.erasedAt > playMs || !this.problemCardData || this.problemCardData._tempFromProblemStamp)) {
              if (tSt < bestT) {
                bestT = tSt;
                matchedPrimaryStamp = s;
              }
            }
          }
          if (matchedPrimaryStamp) {
            const gs = matchedPrimaryStamp.graphStamp;
            const stampTag = matchedPrimaryStamp.id || `${matchedPrimaryStamp.tStart || 0}_${gs.logicalW || 0}`;
            if (!this.problemCardData || this.problemCardData._tempFromProblemStamp !== stampTag) {
              this.problemCardData = { imgUrl: gs.dataUrl, _tempFromProblemStamp: stampTag };
              this.problemCardAspect = (gs.logicalW > 0 && gs.logicalH > 0) ? (gs.logicalH / gs.logicalW) : 0.65;
              this.problemCardImage = (matchedPrimaryStamp._stampCache && matchedPrimaryStamp._stampCache.img) || null;
              this.problemInkStrokes = Array.isArray(gs.cardStrokes) ? JSON.parse(JSON.stringify(gs.cardStrokes)) : [];
              const pCanvas = typeof document !== 'undefined' ? document.getElementById('problemCardCanvas') : null;
              if (pCanvas) {
                pCanvas._bakeValid = false;
                pCanvas._displaySyncedCount = -1;
              }
              const pImgEl = typeof document !== 'undefined' ? document.getElementById('problemCardImg') : null;
              if (pImgEl && pImgEl.src !== gs.dataUrl) {
                pImgEl.onload = () => {
                  if (this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode) {
                    this.syncProblemCardRectFromWidget();
                    this.requestRender();
                  }
                };
                pImgEl.src = gs.dataUrl;
              }
            }
          } else if (bk.primaryProb.problemCardData && (!this.problemCardData || this.problemCardData._tempFromProblemStamp)) {
            this.problemCardData = bk.primaryProb.problemCardData;
            this.problemCardAspect = bk.primaryProb.problemCardAspect;
            this.problemCardImage = bk.primaryProb.problemCardImage;
            this.problemInkStrokes = JSON.parse(JSON.stringify(bk.primaryProb.problemInkStrokes || []));
            if (pWidget) pWidget._replayBoundUid = null;
          }
        }
      } else if (pWidget) {
        pWidget.style.display = 'none';
        this.problemCardRect = null;
      }

      // 2) 기본 그래프 카드(#graphCardWidget): 닫혔던 그래프/합성함수 스튜디오 카드 에셋 및 필기 복원
      const gWidget = typeof document !== 'undefined' ? document.getElementById('graphCardWidget') : null;
      if (kf.graphCardVisible && kf.graphCardUid && bk.byUid[kf.graphCardUid] && gWidget) {
        const gAsset = bk.byUid[kf.graphCardUid];
        if (gWidget._replayBoundUid !== kf.graphCardUid) {
          this.graphCardUid = kf.graphCardUid;
          gWidget._cardUid = kf.graphCardUid;
          gWidget._replayBoundUid = kf.graphCardUid;
          this._hasPrimaryGraphCard = true;
          this.graphCardData = {
            dataUrl: gAsset.dataUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
          };
          this.graphInkStrokes = Array.isArray(gAsset.cardStrokes) ? JSON.parse(JSON.stringify(gAsset.cardStrokes)) : [];
          const gCanvas = typeof document !== 'undefined' ? document.getElementById('graphCardCanvas') : null;
          if (gCanvas) {
            gCanvas._bakeValid = false;
            gCanvas._displaySyncedCount = -1;
          }
          const gTitleEl = typeof document !== 'undefined' ? document.getElementById('graphCardTitle') : null;
          if (gTitleEl && gAsset.titleText) gTitleEl.textContent = gAsset.titleText;
          const gImgEl = typeof document !== 'undefined' ? document.getElementById('graphCardImg') : null;
          if (gImgEl && gAsset.isNAxisStudioCard && gAsset.dataUrl && gImgEl.src !== gAsset.dataUrl) {
            gImgEl.src = gAsset.dataUrl;
          }
        }
      }

      // 3) 추가 문제 카드(extraProblemCards): UID 정밀 매칭 (인덱스 밀림 원천 차단) + 레거시 폴백
      const hasUidExtraProbs = Array.isArray(kf.extraProbStates) && kf.extraProbStates.some(s => s && s.uid);
      if (hasUidExtraProbs && typeof this.spawnExtraProblemCard === 'function') {
        const desiredStates = kf.extraProbStates;
        const desiredSig = desiredStates.map(s => (s && s.uid) || '').join('|');
        const curSig = (this.extraProblemCards || []).map(c => (c && (c.cardUid || (c.el && c.el._cardUid))) || '').join('|');
        if (desiredSig !== curSig) {
          const existingByUid = new Map();
          (this.extraProblemCards || []).forEach(c => {
            const u = c && (c.cardUid || (c.el && c.el._cardUid));
            if (u) existingByUid.set(u, c);
          });
          const desiredSet = new Set(desiredStates.map(s => s && s.uid).filter(Boolean));
          (this.extraProblemCards || []).forEach(c => {
            const u = c && (c.cardUid || (c.el && c.el._cardUid));
            if (!u || !desiredSet.has(u)) {
              if (c && c.el) {
                if (typeof this.clearProblemCardStealthTimer === 'function') this.clearProblemCardStealthTimer(c.el);
                if (typeof this._hibernateDetachedCardCanvases === 'function') this._hibernateDetachedCardCanvases(c.el);
                if (this._activePeekCardEl === c.el) this._activePeekCardEl = null;
                c.el.remove();
              }
            }
          });
          const nextArr = [];
          for (let i = 0; i < desiredStates.length; i++) {
            const st = desiredStates[i];
            if (!st || !st.uid) continue;
            if (existingByUid.has(st.uid)) {
              nextArr.push(existingByUid.get(st.uid));
            } else {
              const pAsset = bk.byUid[st.uid];
              if (!pAsset || !pAsset.dataUrl) continue;
              this.extraProblemCards = nextArr;
              const spawned = this.spawnExtraProblemCard(
                pAsset.dataUrl,
                pAsset.pdfPageNum || 1,
                typeof st.w === 'number' ? st.w : (pAsset.cardW || 480),
                null,
                {
                  customX: typeof st.baseX === 'number' ? st.baseX : 104,
                  customY: typeof st.baseY === 'number' ? st.baseY : 50,
                  customTitle: pAsset.titleText || '문제',
                  startMinimized: Boolean(st.min),
                  isPdfPageCard: Boolean(pAsset.isPdfPageCard),
                  pdfPageNum: pAsset.pdfPageNum || 1,
                  pdfCropRef: pAsset.pdfCropRef || null,
                  cardUid: st.uid,
                  silentToast: true
                }
              );
              if (spawned) {
                spawned.cardUid = st.uid;
                spawned._tempFromProblemStamp = st.uid;
                if (spawned.el) {
                  spawned.el._cardUid = st.uid;
                  spawned.el._cardInkStrokes = Array.isArray(pAsset.cardStrokes) ? JSON.parse(JSON.stringify(pAsset.cardStrokes)) : [];
                }
              }
            }
          }
          this.extraProblemCards = nextArr;
        }
      } else {
        const targetExtraProbCount = typeof kf.extraProbsCount === 'number'
          ? kf.extraProbsCount
          : (Array.isArray(kf.extraProbStates) ? kf.extraProbStates.length : 0);
        if (Array.isArray(this.extraProblemCards)) {
          this.extraProblemCards = this.extraProblemCards.filter((c, idx) => {
            if (c && c._tempFromProblemStamp) {
              const stRef = c._tempStampRef;
              const expired = !stRef || (typeof stRef.tStart === 'number' && stRef.tStart <= playMs) || idx >= targetExtraProbCount;
              if (expired) {
                if (c.el) {
                  if (typeof this.clearProblemCardStealthTimer === 'function') this.clearProblemCardStealthTimer(c.el);
                  if (typeof this._hibernateDetachedCardCanvases === 'function') this._hibernateDetachedCardCanvases(c.el);
                  if (this._activePeekCardEl === c.el) this._activePeekCardEl = null;
                  c.el.remove();
                }
                return false;
              }
            }
            return true;
          });
        }
        const curExtraLen = Array.isArray(this.extraProblemCards) ? this.extraProblemCards.length : 0;
        if (targetExtraProbCount > curExtraLen && typeof this.spawnExtraProblemCard === 'function') {
          const extraCands = allSt.filter(s => {
            if (!s || !s.isProblemStamp || !s.graphStamp || !s.graphStamp.dataUrl) return false;
            const gs = s.graphStamp;
            if (!gs.isExtraProblemCard && gs.refCardW !== 480) return false;
            return typeof s.tStart === 'number' && s.tStart > playMs;
          }).sort((a, b) => (a.tStart || 0) - (b.tStart || 0));
          const usedIds = new Set((this.extraProblemCards || []).map(c => c && c._tempFromProblemStamp).filter(Boolean));
          for (let i = 0; i < extraCands.length && (this.extraProblemCards ? this.extraProblemCards.length : 0) < targetExtraProbCount; i++) {
            const eSt = extraCands[i];
            const eTag = eSt.id || `${eSt.tStart}_${i}`;
            if (usedIds.has(eTag)) continue;
            const gs = eSt.graphStamp;
            const stCfg = (Array.isArray(kf.extraProbStates) && kf.extraProbStates[(this.extraProblemCards || []).length]) || null;
            const spawned = this.spawnExtraProblemCard(
              gs.dataUrl,
              (this.extraProblemCards ? this.extraProblemCards.length : 0) + 2,
              (stCfg && typeof stCfg.w === 'number') ? stCfg.w : (gs.logicalW || 480),
              null,
              {
                customX: stCfg && typeof stCfg.baseX === 'number' ? stCfg.baseX : 104,
                customY: stCfg && typeof stCfg.baseY === 'number' ? stCfg.baseY : 50,
                startMinimized: Boolean(stCfg && stCfg.min),
                pdfCropRef: gs.pdfCropRef || null,
                silentToast: true
              }
            );
            if (spawned) {
              spawned._tempFromProblemStamp = eTag;
              spawned._tempStampRef = eSt;
              if (spawned.el) {
                spawned.el._cardInkStrokes = Array.isArray(gs.cardStrokes) ? JSON.parse(JSON.stringify(gs.cardStrokes)) : [];
              }
              usedIds.add(eTag);
            }
          }
        }
      }

      // 4) 추가 그래프 카드(extraGraphCards): UID 정밀 매칭 (인덱스 밀림·필기 뒤바뀜·닫은 카드 증발 완전 해결)
      const hasUidExtraGraphs = Array.isArray(kf.extraGraphStates) && kf.extraGraphStates.some(s => s && s.uid);
      if (hasUidExtraGraphs && typeof this.spawnExtraGraphArchiveCard === 'function') {
        const desiredGStates = kf.extraGraphStates;
        const desiredGSig = desiredGStates.map(s => (s && s.uid) || '').join('|');
        const curGSig = (this.extraGraphCards || []).map(c => (c && (c.cardUid || (c.el && c.el._cardUid))) || '').join('|');
        if (desiredGSig !== curGSig) {
          const existingGByUid = new Map();
          (this.extraGraphCards || []).forEach(c => {
            const u = c && (c.cardUid || (c.el && c.el._cardUid));
            if (u) existingGByUid.set(u, c);
          });
          const desiredGSet = new Set(desiredGStates.map(s => s && s.uid).filter(Boolean));
          (this.extraGraphCards || []).forEach(c => {
            const u = c && (c.cardUid || (c.el && c.el._cardUid));
            if (!u || !desiredGSet.has(u)) {
              if (c && c.el) {
                if (typeof this.clearPipGraphCardStealthTimer === 'function') this.clearPipGraphCardStealthTimer(c);
                if (typeof this._hibernateDetachedCardCanvases === 'function') this._hibernateDetachedCardCanvases(c.el);
                if (this._activePeekCardEl === c.el) this._activePeekCardEl = null;
                c.el.remove();
              }
            }
          });
          const nextGArr = [];
          for (let i = 0; i < desiredGStates.length; i++) {
            const st = desiredGStates[i];
            if (!st || !st.uid) continue;
            if (existingGByUid.has(st.uid)) {
              nextGArr.push(existingGByUid.get(st.uid));
            } else {
              const gAsset = bk.byUid[st.uid] || null;
              this.extraGraphCards = nextGArr;
              const initUrl = (gAsset && gAsset.isNAxisStudioCard && gAsset.dataUrl)
                ? gAsset.dataUrl
                : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
              const initSnap = st.pipSnap
                ? JSON.parse(JSON.stringify(st.pipSnap))
                : (gAsset && gAsset.pipSnap ? JSON.parse(JSON.stringify(gAsset.pipSnap)) : null);
              const spawnedG = this.spawnExtraGraphArchiveCard(
                initUrl,
                typeof st.w === 'number' ? st.w : ((gAsset && gAsset.cardW) || 360),
                typeof st.aspect === 'number' ? st.aspect : ((gAsset && gAsset.aspect) || 0.82),
                initSnap,
                null,
                {
                  directBasePos: {
                    x: typeof st.baseX === 'number' ? st.baseX : 560,
                    y: typeof st.baseY === 'number' ? st.baseY : 68
                  },
                  cardUid: st.uid
                }
              );
              if (spawnedG) {
                spawnedG.cardUid = st.uid;
                spawnedG._tempReplayGraphCard = true;
                if (gAsset && gAsset.caseIdx) spawnedG.caseIdx = gAsset.caseIdx;
                if (spawnedG.el) {
                  spawnedG.el._cardUid = st.uid;
                  const tEl = spawnedG.el.querySelector('.card-title-text');
                  if (tEl && gAsset && gAsset.titleText) tEl.textContent = gAsset.titleText;
                  spawnedG.el._cardInkStrokes = (gAsset && Array.isArray(gAsset.cardStrokes))
                    ? JSON.parse(JSON.stringify(gAsset.cardStrokes))
                    : [];
                }
              }
            }
          }
          this.extraGraphCards = nextGArr;
        }
      }
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
        if (kf.themeKey !== undefined || kf.boardPaperType !== undefined || kf.isMonochromeMode !== undefined) {
          this._applyReplayVisualThemeAndPaper(kf.themeKey, kf.boardPaperType, kf.isMonochromeMode);
        }
        if (kf.allUIHidden !== undefined) {
          const nextHidden = Boolean(kf.allUIHidden);
          const effKeepInk = Boolean(kf.keepInkOnHide);
          const effKeepSlide = Boolean(kf.keepSlideOnHide);
          this.isAllUIHidden = nextHidden;
          if (typeof document !== 'undefined' && document.body) {
            document.body.classList.toggle('ui-all-hidden-mode', nextHidden);
            document.body.classList.toggle('ui-hide-keep-ink', effKeepInk);
            document.body.classList.toggle('ui-hide-keep-slide', effKeepSlide);
            const restoreTab = document.getElementById('btnRestoreAllUITab');
            if (restoreTab) {
              restoreTab.style.display = nextHidden ? 'flex' : 'none';
            }
          }
        }
        this.graphs = JSON.parse(JSON.stringify(kf.graphs || []));
        if (this.engine && typeof this.engine.ensureCompiledFunctions === 'function') {
          this.engine.ensureCompiledFunctions(this.graphs);
        }
        if (kf.showInverseGuide !== undefined) {
          this.showInverseGuide = Boolean(kf.showInverseGuide);
        }
        if (kf.useIntersectionDetector !== undefined) {
          this.useIntersectionDetector = Boolean(kf.useIntersectionDetector);
        }
        if (kf.showGridNumbers !== undefined) {
          this.showGridNumbers = Boolean(kf.showGridNumbers);
        }
        if (kf.showAsymptotes !== undefined) {
          this.showAsymptotes = Boolean(kf.showAsymptotes);
        }
        if (kf.showAxisLabels !== undefined) {
          this.showAxisLabels = Boolean(kf.showAxisLabels);
        }
        if (kf.axisLabelX !== undefined) {
          this.axisLabelX = String(kf.axisLabelX);
        }
        if (kf.axisLabelY !== undefined) {
          this.axisLabelY = String(kf.axisLabelY);
        }
        if (typeof kf.axisLabelFontSize === 'number') {
          this.axisLabelFontSize = kf.axisLabelFontSize;
        }
        if (kf.isTextToolMode !== undefined) {
          this.isTextToolMode = Boolean(kf.isTextToolMode);
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

        this._syncReplayProblemCardsFromStamps(kf);
        const pWidget = document.getElementById('problemCardWidget');
        if (pWidget && this.problemCardData) {
          pWidget.style.display = kf.probCardVisible ? 'flex' : 'none';
          if (typeof kf.probCardZ === 'number') {
            pWidget.style.zIndex = String(kf.probCardZ);
          }
          if (!kf.probCardVisible) {
            this.problemCardRect = null;
          }
          pWidget.classList.toggle('minimized', Boolean(kf.probCardMin));
          this.isProblemCardMinimized = Boolean(kf.probCardMin);
          if (kf.probCardInkActive !== undefined) {
            pWidget.classList.remove('card-ink-active');
            const btnPInk = pWidget.querySelector('.btn-card-laser');
            if (btnPInk) btnPInk.classList.remove('active');
          }
          pWidget.classList.add('pip-locked-mode');
          if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(pWidget);
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
            if (typeof kf.graphCardZ === 'number') {
              gWidget.style.zIndex = String(kf.graphCardZ);
            }
            gWidget.classList.toggle('minimized', Boolean(kf.graphCardMin));
            this.isGraphCardMinimized = Boolean(kf.graphCardMin);
            if (kf.graphCardInkActive !== undefined) {
              gWidget.classList.remove('card-ink-active');
              const btnInk = gWidget.querySelector('.btn-card-ink');
              if (btnInk) btnInk.classList.remove('active');
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
            if (typeof kf.graphCardAspect === 'number' && kf.graphCardAspect > 0.05) {
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
              if (typeof clonedPipSnap.aspect === 'number' && clonedPipSnap.aspect > 0.05) {
                this.graphCardAspect = clonedPipSnap.aspect;
              }
              const effAspect = this.graphCardAspect || 0.82;
              const targetCardH = Math.max(60, Math.round(targetCardW * effAspect));
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
              if (!kf.graphCardMin && typeof this.renderPipGraphCard === 'function') {
                this.renderPipGraphCard('primary');
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
        const hasUidInExtraGraphKf = Array.isArray(kf.extraGraphStates) && kf.extraGraphStates.some(s => s && s.uid);
        if (!hasUidInExtraGraphKf && targetExtraGraphCount > (this.extraGraphCards ? this.extraGraphCards.length : 0) && Array.isArray(kf.extraGraphStates)) {
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
                  c.el.classList.remove('card-ink-active');
                  const btnInk = c.el.querySelector('.btn-card-ink');
                  if (btnInk) btnInk.classList.remove('active');
                }
                if (typeof st.aspect === 'number' && st.aspect > 0.05) {
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
                  if (typeof clonedExtraSnap.aspect === 'number' && clonedExtraSnap.aspect > 0.05) {
                    c.aspect = clonedExtraSnap.aspect;
                  }
                  const effAspect = c.aspect || 0.82;
                  const ch = Math.max(60, Math.round(cw * effAspect));
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
                if (typeof st.z === 'number') {
                  c.el.style.zIndex = String(st.z);
                }
                if (Array.isArray(st.stickers)) {
                  const stkJson = JSON.stringify(st.stickers);
                  if (c.el._lastReplayStickersJson !== stkJson) {
                    c.el._lastReplayStickersJson = stkJson;
                    c.el._cardStickers = JSON.parse(stkJson);
                    if (typeof c.el._renderCardStickers === 'function') c.el._renderCardStickers();
                  }
                }
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
                c.el.classList.remove('card-ink-active');
                const btnEInk = c.el.querySelector('.btn-card-laser');
                if (btnEInk) btnEInk.classList.remove('active');
              }
              c.el.classList.add('pip-locked-mode');
              if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(c.el);
              if (st.stealth !== undefined) {
                if (typeof this.clearProblemCardStealthTimer === 'function') this.clearProblemCardStealthTimer(c.el);
                c.el.classList.toggle('pip-stealth-locked', Boolean(st.stealth));
              }
              c.isMin = Boolean(st.min);
              c.el.classList.toggle('minimized', Boolean(st.min));
              if (typeof st.z === 'number') {
                c.el.style.zIndex = String(st.z);
              }
              if (Array.isArray(st.stickers)) {
                const stkJson = JSON.stringify(st.stickers);
                if (c.el._lastReplayStickersJson !== stkJson) {
                  c.el._lastReplayStickersJson = stkJson;
                  c.el._cardStickers = JSON.parse(stkJson);
                  if (typeof c.el._renderCardStickers === 'function') c.el._renderCardStickers();
                }
              }
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
              : ((this._lastKnownPillRemoteSize && this._lastKnownPillRemoteSize.w) || 94);
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
            const topGuard = (!isFixedStage && typeof this._getIosTopGuardPx === 'function') ? this._getIosTopGuardPx() : 0;
            const minReplayPillL = (this.isAllUIHidden && Boolean(kf.keepInkOnHide)) ? 8 : 58;
            targetL = Math.max(minReplayPillL, Math.min(vw - remW - 8, targetL));
            targetT = Math.max(12 + topGuard, Math.min(vh - remH - 12, targetT));
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
        this.isPenDashed = Boolean(kf.isPenDashed && (kf.activeInkTool || this.activeInkTool) === 'pen');
        if (typeof this.syncPenDashUI === 'function') {
          this.syncPenDashUI();
        }
        if (typeof this.syncQuickPillRemoteUI === 'function') {
          this.syncQuickPillRemoteUI();
        }
        if (kf.inkPenStyle) {
          this.inkPenStyle = kf.inkPenStyle;
          document.querySelectorAll('[data-pen-style]').forEach(b => {
            b.classList.toggle('active', b.dataset.penStyle === kf.inkPenStyle);
          });
        }
        if (typeof kf.currentInkSize === 'number' && kf.currentInkSize > 0) {
          this.currentInkSize = kf.currentInkSize;
          const slInk = document.getElementById('sliderInkSize');
          if (slInk) slInk.value = String(kf.currentInkSize);
          const lblInk = document.getElementById('lblCurrentInkSize');
          if (lblInk) lblInk.textContent = String(kf.currentInkSize);
        }
        if (typeof kf.currentHighlighterSize === 'number' && kf.currentHighlighterSize > 0) {
          this.currentHighlighterSize = kf.currentHighlighterSize;
          const slHl = document.getElementById('sliderHighlighterSize');
          if (slHl) slHl.value = String(kf.currentHighlighterSize);
          const lblHl = document.getElementById('lblCurrentHighlighterSize');
          if (lblHl) lblHl.textContent = String(kf.currentHighlighterSize);
        }
        if (kf.currentInkColor) {
          this.currentInkColor = kf.currentInkColor;
          document.querySelectorAll('#inkFloatingToolbar .ink-color-dot[data-color]').forEach(dot => {
            dot.classList.toggle('active', (dot.dataset.color || '').toLowerCase() === String(kf.currentInkColor).toLowerCase());
          });
        }
        if ((kf.activeInkTool || kf.currentInkColor) && typeof this._applyCurrentToolColorUI === 'function' && this.currentInkColor) {
          this._applyCurrentToolColorUI(this.currentInkColor);
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
          if (railDrawerEl) {
            railDrawerEl.dataset.activePanel = activePanelId;
          }
          if (activePanelId === 'panelToolkit' && typeof this.renderMathToolkitPanel === 'function') {
            this.renderMathToolkitPanel();
          }
          if (activePanelId === 'panelPiecewise' && typeof this.syncPeriodicUI === 'function') {
            this.syncPeriodicUI();
          }
          const panelTitles = {
            panelPresets: '그래프 추가',
            panelTransform: '변환 & 대칭',
            panelPiecewise: '구간 분할',
            panelToolkit: '시각화 도구',
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
          if (isOpen) {
            const drawerSubContainer = document.getElementById('drawerSubpanelsContainer');
            if (drawerSubContainer && typeof kf.drawerScrollTop === 'number') {
              drawerSubContainer.scrollTop = Math.max(0, Math.round(kf.drawerScrollTop));
            }
            const funcGridEl = document.getElementById('funcGrid');
            if (funcGridEl && typeof kf.funcGridScrollTop === 'number') {
              funcGridEl.scrollTop = Math.max(0, Math.round(kf.funcGridScrollTop));
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

        const railResetPopEl = document.getElementById('railResetBoardPopover');
        if (railResetPopEl && kf.railResetPopOpen !== undefined) {
          railResetPopEl.style.display = kf.railResetPopOpen ? 'block' : 'none';
        }
        const inkSizeFlyoutEl = document.getElementById('inkSizeFlyout');
        if (inkSizeFlyoutEl && kf.inkSizeFlyoutOpen !== undefined) {
          inkSizeFlyoutEl.style.display = kf.inkSizeFlyoutOpen ? 'block' : 'none';
        }
        const quickThemeEl = document.getElementById('panelQuickTheme');
        if (quickThemeEl && kf.quickThemeOpen !== undefined) {
          quickThemeEl.classList.toggle('open', Boolean(kf.quickThemeOpen));
          if (!kf.quickThemeOpen && (quickThemeEl.style.display === 'block' || quickThemeEl.style.display === 'flex')) {
            quickThemeEl.style.display = 'none';
          } else if (kf.quickThemeOpen && quickThemeEl.style.display === 'none') {
            quickThemeEl.style.display = 'block';
          }
        }
        const railAddPopEl = document.getElementById('railAddTargetPopover');
        const sidebarRailElForPop = document.getElementById('sidebarRail');
        if (railAddPopEl) {
          if (kf.railAddTargetPop && Array.isArray(kf.railAddTargetPop.labels) && kf.railAddTargetPop.labels.length > 0) {
            const listEl = document.getElementById('railAddTargetList') || railAddPopEl;
            const sig = kf.railAddTargetPop.labels.join('|');
            if ((this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode) && listEl._replayLabelsSig !== sig) {
              listEl._replayLabelsSig = sig;
              listEl.innerHTML = '';
              kf.railAddTargetPop.labels.forEach((lbl, idx) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = idx === 0
                  ? 'settings-clean-btn rail-add-target-btn rail-add-target-new'
                  : 'settings-clean-btn rail-add-target-btn rail-add-target-card';
                b.textContent = lbl;
                listEl.appendChild(b);
              });
            }
            if (typeof kf.railAddTargetPop.top === 'number') {
              railAddPopEl.style.top = `${Math.round(kf.railAddTargetPop.top)}px`;
            }
            railAddPopEl.style.display = 'block';
            if (sidebarRailElForPop) sidebarRailElForPop.classList.add('has-add-target-popover');
          } else if (kf.railAddTargetPop !== undefined) {
            railAddPopEl.style.display = 'none';
            if (sidebarRailElForPop) sidebarRailElForPop.classList.remove('has-add-target-popover');
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

        // 🌟 [카드 내부 블라인드 스티커 드래그 프리뷰 박스 재현 (기본 + 추가 문제/그래프 카드 전수 지원)]
        const csd = kf.cardStickerDraft;
        const allReplayCardEntries = [
          { el: document.getElementById('problemCardWidget'), legacyKey: 'problem_main' },
          { el: document.getElementById('graphCardWidget'), legacyKey: 'graph_main' },
          ...((this.extraProblemCards || []).map((c, idx) => ({ el: c && c.el, legacyKey: `problem_extra_${idx}` }))),
          ...((this.extraGraphCards || []).map((c, idx) => ({ el: c && c.el, legacyKey: `graph_extra_${idx}` })))
        ];
        allReplayCardEntries.forEach(entry => {
          const cEl = entry.el;
          const bodyEl = cEl ? cEl.querySelector('.problem-card-body') : null;
          if (!bodyEl) return;
          const curKey = this.getAudioCardKey(cEl);
          const isMatched = Boolean(
            csd &&
            typeof csd.nw === 'number' &&
            csd.nw > 0.005 &&
            (csd.cardKey === curKey || csd.cardKey === entry.legacyKey)
          );
          let draftEl = bodyEl.querySelector('.replay-card-sticker-draft');
          if (isMatched) {
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
          const p1 = sd.screenPx
            ? { x: sd.x1, y: sd.y1 }
            : (sd.isBoard ? this.boardToScreen(sd.x1, sd.y1) : this.mathToScreen(sd.x1, sd.y1));
          const p2 = sd.screenPx
            ? { x: sd.x2, y: sd.y2 }
            : (sd.isBoard ? this.boardToScreen(sd.x2, sd.y2) : this.mathToScreen(sd.x2, sd.y2));
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
        const ctxSymPopEl = document.getElementById('ctxSymmetryPopover');
        const ctxAbsPopEl = document.getElementById('ctxAbsPopover');
        const btnSymMenu = document.getElementById('ctxBtnSymmetryMenu');
        const curveBarVisible = Boolean(this.curveContextBar && this.curveContextBar.style.display !== 'none');
        if (ctxSymPopEl && kf.ctxSymPopOpen !== undefined) {
          const openSym = Boolean(curveBarVisible && kf.ctxSymPopOpen);
          ctxSymPopEl.style.display = openSym ? 'flex' : 'none';
          if (btnSymMenu) btnSymMenu.classList.toggle('active', openSym);
        }
        if (ctxAbsPopEl && kf.ctxAbsPopOpen !== undefined) {
          ctxAbsPopEl.style.display = Boolean(curveBarVisible && kf.ctxAbsPopOpen) ? 'flex' : 'none';
        }
        if (typeof this.syncLassoActionBarUI === 'function') {
          this.syncLassoActionBarUI();
        }
        if (!this.isGraphCovered) {
          this.updateIntersections();
        }
      } finally {
        this._isApplyingAudioTimelineState = false;
      }
    }

    _detectActiveUnrenderedPopupKind() {
      if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return null;
      const saveClipModal = document.getElementById('modalSaveInkClip');
      if (saveClipModal && saveClipModal.style.display !== 'none') return 'saveClip';
      const inkClipsPop = document.getElementById('inkClipsPopover');
      if (inkClipsPop && inkClipsPop.style.display !== 'none') {
        const btnPill = document.getElementById('btnPillClips');
        const fromPill = Boolean((btnPill && btnPill.classList && btnPill.classList.contains('is-popover-open')) || this.isQuickPillRemoteOpen);
        return fromPill ? 'inkClips_pill' : 'inkClips';
      }
      const quickExportEl = document.getElementById('panelQuickExport');
      if (quickExportEl && (quickExportEl.classList.contains('open') || quickExportEl.style.display === 'block' || quickExportEl.style.display === 'flex')) {
        return 'quickExport';
      }
      const pdfGridPop = document.getElementById('pdfBoardGridPopover');
      const playGridPop = document.getElementById('playlistGridPopover');
      const playAddMenu = document.getElementById('playlistAddSlideMenu');
      if ((pdfGridPop && pdfGridPop.style.display !== 'none') ||
          (playGridPop && playGridPop.style.display !== 'none') ||
          (playAddMenu && playAddMenu.style.display !== 'none')) {
        return 'slideGrid';
      }
      if (typeof document.getElementsByClassName === 'function') {
        const backdrops = document.getElementsByClassName('smart-modal-backdrop');
        for (let i = 0; i < backdrops.length; i++) {
          const bd = backdrops[i];
          if (!bd) continue;
          if (bd.classList && bd.classList.contains('show') && bd.style.display !== 'none') return 'modal';
          if (bd.style && (bd.style.display === 'flex' || bd.style.display === 'block')) return 'modal';
        }
      }
      return null;
    }

    _recordAudioWorkspaceStateIfNeeded(force = false, allowWhilePaused = false) {
      if (!this.isAudioRecording || this._isPausedStandbyOnSlide || (this.isAudioRecordPaused && !allowWhilePaused) || this.isPdfModalOpen || this._isAudioWaitingForNextSlideSetup || this._isApplyingAudioTimelineState) return;
      if (this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser) {
        this._lastAudioInkActivePerfMs = performance.now();
      }
      // 필기/레이저 드로잉 중에는 무거운 JSON.stringify 상태 스냅샷을 건너뛰어 녹화 중 필기 렉을 0%로 원천 차단!
      if (!force && (this.isDrawingInk || this._isDrawingCardInk || this.isStylusDrawing || this.isDrawingLaser)) return;
      const t = this.getAudioRecordElapsedMs();
      const sidebarRailEl = document.getElementById('sidebarRail');
      const curDrawerOpen = Boolean(!this.isDrawerCollapsed && (!sidebarRailEl || !sidebarRailEl.classList.contains('drawer-collapsed')));
      const hasLassoSel = Boolean((this.selectedInkStrokes && this.selectedInkStrokes.length > 0) || (this.selectedTextLabels && this.selectedTextLabels.length > 0));
      const ctxSymPopEl = document.getElementById('ctxSymmetryPopover');
      const ctxAbsPopEl = document.getElementById('ctxAbsPopover');
      const railAddPopEl = document.getElementById('railAddTargetPopover');
      const railResetPopEl = document.getElementById('railResetBoardPopover');
      const inkSizeFlyoutEl = document.getElementById('inkSizeFlyout');
      const inkShapesPopEl = document.getElementById('inkShapesPopover');
      const quickThemeEl = document.getElementById('panelQuickTheme');
      const popBits = `${Boolean(ctxSymPopEl && ctxSymPopEl.style.display !== 'none') ? 1 : 0}${Boolean(ctxAbsPopEl && ctxAbsPopEl.style.display !== 'none') ? 1 : 0}${Boolean(railAddPopEl && railAddPopEl.style.display !== 'none') ? 1 : 0}${Boolean(railResetPopEl && railResetPopEl.style.display !== 'none') ? 1 : 0}${Boolean(inkSizeFlyoutEl && inkSizeFlyoutEl.style.display !== 'none') ? 1 : 0}${Boolean(inkShapesPopEl && inkShapesPopEl.style.display !== 'none') ? 1 : 0}${Boolean(quickThemeEl && (quickThemeEl.classList.contains('open') || quickThemeEl.style.display === 'block' || quickThemeEl.style.display === 'flex')) ? 1 : 0}:${this._detectActiveUnrenderedPopupKind() || ''}`;
      const uiDiscreteSig = `${Boolean(this.isGraphCovered)}|${Boolean(this.isAllUIHidden)}|${Boolean(this.keepInkBarOnHide)}|${Boolean(this.keepSlideBarOnHide)}|${this.currentThemeKey || ''}|${this.boardPaperType || ''}|${Boolean(this.isMonochromeMode)}|${curDrawerOpen}|${this.activeDrawerPanel || ''}|${this._currentCat || ''}|${Boolean(this.isInkMode)}|${Boolean(this.isBottomInkBarHidden)}|${this.inkDockPosition || 'bottom'}|${this.activeInkTool || ''}|${this.quickShapeMode || ''}|${Boolean(this.isPenDashed)}|${this.inkPenStyle || ''}|${Boolean(this.isQuickPillRemoteOpen)}|${Boolean(this.isGraphSnapMode)}|${Boolean(this.isPdfToGraphCropMode)}|${Boolean(this._isPdfCropChoiceMenuOpen)}|${Boolean(this.isCurveSelected)}|${Boolean(this.useIntersectionDetector)}|${Boolean(this.showGridNumbers)}|${Boolean(this.showInverseGuide)}|${this._openPwRegionIdx ?? ''}|${popBits}|${hasLassoSel}|${Boolean(this.isLassoSelecting)}|${Boolean(this.isDraggingLassoSelection)}|${Boolean(this.isResizingLassoSelection)}|${Boolean(this.isRotatingLassoSelection)}|${Boolean(this._lassoFlipAnim)}`;
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
        this.isLassoSelecting ||
        this.isDraggingLassoSelection ||
        this.isResizingLassoSelection ||
        this.isRotatingLassoSelection ||
        Boolean(this._lassoFlipAnim) ||
        this.isDraggingTextLabel
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
        kf.allUIHidden,
        kf.themeKey,
        kf.boardPaperType,
        kf.isMonochromeMode,
        kf.drawerOpen,
        kf.activeDrawerPanel,
        kf.activePresetCat,
        kf.drawerScrollTop,
        kf.funcGridScrollTop,
        kf.inkMode,
        kf.inkBarHidden,
        kf.inkDockPos,
        kf.activeInkTool,
        kf.inkPenStyle,
        kf.currentInkSize,
        kf.currentHighlighterSize,
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
        kf.ctxSymPopOpen,
        kf.ctxAbsPopOpen,
        kf.railResetPopOpen,
        kf.inkSizeFlyoutOpen,
        kf.inkShapesPopOpen,
        kf.quickShapeMode,
        kf.quickThemeOpen,
        kf.unrenderedPopupKind,
        kf.railAddTargetPop,
        kf.snapDragRect,
        kf.lassoState,
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
        kf.showInverseGuide,
        kf.useIntersectionDetector,
        kf.showGridNumbers,
        kf.showAsymptotes,
        kf.showAxisLabels,
        kf.axisLabelX,
        kf.axisLabelY,
        kf.axisLabelFontSize,
        kf.isTextToolMode,
        Math.round(kf.boardPanX),
        Math.round(kf.boardPanY),
        kf.boardZoom,
        Math.round(kf.boardZoomOffsetX || 0),
        Math.round(kf.boardZoomOffsetY || 0),
        kf.usePiecewise,
        kf.piecewiseBoundaries,
        kf.piecewiseFuncMap,
        kf.piecewiseInclusions,
        kf.isPiecewisePeriodic,
        kf.periodicStepY,
        kf.isPiecewiseLocked,
        kf.isDropLineMode,
        kf.dropLineHoverCandidate ? `${Math.round(kf.dropLineHoverCandidate.x * 100)},${Math.round(kf.dropLineHoverCandidate.y * 100)}` : '',
        kf.dropLines,
        kf.textLabels,
        kf.pdfBoardLayout,
        kf.probCardVisible,
        kf.probCardUid,
        kf.probCardZ,
        kf.probCardMin,
        kf.probCardBaseX,
        kf.probCardBaseY,
        kf.probCardPdfAnchor,
        Math.round(kf.probCardW || 0),
        kf.probCardStealth,
        kf.graphCardVisible,
        kf.graphCardUid,
        kf.graphCardZ,
        kf.graphCardMin,
        kf.graphCardBaseX,
        kf.graphCardBaseY,
        kf.graphCardPdfAnchor,
        Math.round(kf.graphCardW || 0),
        kf.graphCardAspect,
        kf.graphCardInkActive,
        kf.graphCardStealth,
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
      if (cardEl._cardUid) return cardEl._cardUid;
      if (cardEl.id === 'problemCardWidget') return this.problemCardUid || 'problem_main';
      if (cardEl.id === 'graphCardWidget') return this.graphCardUid || 'graph_main';
      if (Array.isArray(this.extraGraphCards)) {
        const gIdx = this.extraGraphCards.findIndex(c => c && c.el === cardEl);
        if (gIdx >= 0) return this.extraGraphCards[gIdx].cardUid || `graph_extra_${gIdx}`;
      }
      if (Array.isArray(this.extraProblemCards)) {
        const pIdx = this.extraProblemCards.findIndex(c => c && c.el === cardEl);
        if (pIdx >= 0) return this.extraProblemCards[pIdx].cardUid || `problem_extra_${pIdx}`;
      }
      if (cardEl.id) return cardEl.id;
      return null;
    }

    getCardElementByAudioKey(cardKey) {
      if (!cardKey) return null;
      const pWidget = document.getElementById('problemCardWidget');
      if (cardKey === 'problem_main' || (pWidget && (pWidget._cardUid === cardKey || this.problemCardUid === cardKey))) {
        return pWidget;
      }
      const gWidget = document.getElementById('graphCardWidget');
      if (cardKey === 'graph_main' || (gWidget && (gWidget._cardUid === cardKey || this.graphCardUid === cardKey))) {
        return gWidget;
      }
      if (Array.isArray(this.extraGraphCards)) {
        const matchedG = this.extraGraphCards.find(c => c && (c.cardUid === cardKey || (c.el && c.el._cardUid === cardKey)));
        if (matchedG && matchedG.el) return matchedG.el;
      }
      if (Array.isArray(this.extraProblemCards)) {
        const matchedP = this.extraProblemCards.find(c => c && (c.cardUid === cardKey || (c.el && c.el._cardUid === cardKey)));
        if (matchedP && matchedP.el) return matchedP.el;
      }
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

      const isRelease = Boolean(extraMeta && extraMeta.isRelease);
      const isManipulatingBoardOrGraph = !isRelease && Boolean(
        this.draggedHandleIdx !== null ||
        this.isDraggingCurve ||
        this.activePwDragIdx !== null ||
        this.isPanning ||
        this.isBoardPanning ||
        this._isInteractingWithPipCard ||
        this.isMovingStage ||
        this.isResizingStage
      );
      if (isManipulatingBoardOrGraph) return 'grabbing';
      if (!isRelease && this.isSpacePressed) return 'grab';

      const isDraggingNow = isRelease ? false : Boolean(isDrawing);

      if (this.isInkMode) {
        if (this.activeInkTool === 'eraser' || this._isTemporaryStylusEraser) return 'eraser';
        if (this.activeInkTool === 'laser') return 'laser';
        if (this.activeInkTool === 'highlighter') return 'highlighter';
        if (this.activeInkTool === 'sticker') return 'crosshair';
        if (this.activeInkTool === 'lasso') {
          const cCls = this.canvas && this.canvas.classList;
          const cCur = (this.canvas && this.canvas.style && this.canvas.style.cursor) || '';
          if (this.isRotatingLassoSelection || (cCls && cCls.contains('is-rotating')) || cCur === 'grabbing') return 'grabbing';
          if ((cCls && cCls.contains('is-hover-rotate')) || cCur === 'grab') return 'grab';
          if ((cCls && cCls.contains('is-hover-resize-nwse')) || cCur === 'nwse-resize') return 'nwse-resize';
          if ((cCls && cCls.contains('is-hover-resize-nesw')) || cCur === 'nesw-resize') return 'nesw-resize';
          if (this.isDraggingLassoSelection || (cCls && cCls.contains('is-hover-selection')) || cCur === 'move') return 'move';
          return 'crosshair';
        }
        if (this.activeInkTool === 'pen') return this.isPenDashed ? 'pen_dashed' : 'pen';
        // select 모드
        if (isDraggingNow) return 'grabbing';
        const curStyle = (this.canvas && this.canvas.style && this.canvas.style.cursor) || 'default';
        if (curStyle === 'nwse-resize') return 'nwse-resize';
        if (curStyle === 'nesw-resize') return 'nesw-resize';
        if (curStyle === 'grab' || curStyle === 'move' || curStyle === 'pointer' || curStyle === 'ew-resize') return 'grab';
        return 'arrow';
      }

      // 순수 그래프 조작 모드 (!this.isInkMode)
      if (isDraggingNow) return 'grabbing';
      const curStyle = (this.canvas && this.canvas.style && this.canvas.style.cursor) || 'default';
      if (curStyle === 'nwse-resize') return 'nwse-resize';
      if (curStyle === 'nesw-resize') return 'nesw-resize';
      if (curStyle === 'grab' || curStyle === 'move' || curStyle === 'pointer' || curStyle === 'ew-resize') return 'grab';
      return 'arrow';
    }

    _resolveAudioUiBarElement(uiBarId) {
      if (!uiBarId || typeof uiBarId !== 'string') return null;
      const byId = document.getElementById(uiBarId);
      if (byId) return byId;
      if (typeof this.getCardElementByAudioKey === 'function') {
        const cardEl = this.getCardElementByAudioKey(uiBarId);
        if (cardEl) return cardEl;
      }
      return null;
    }

    _extractAudioUiTargetMeta(targetEl, clientX, clientY) {
      if (!targetEl || typeof targetEl.closest !== 'function') return {};
      const barSelectors = [
        { id: 'railAddTargetPopover', sel: '#railAddTargetPopover' },
        { id: 'railResetBoardPopover', sel: '#railResetBoardPopover' },
        { id: 'railDrawer', sel: '#railDrawer, .rail-drawer' },
        { id: 'railDock', sel: '#railDock, .rail-dock' },
        { id: 'sidebarRail', sel: '#sidebarRail, .sidebar-rail' },
        { id: 'inkShapesPopover', sel: '#inkShapesPopover, .ink-shapes-popover' },
        { id: 'inkClipsPopover', sel: '#inkClipsPopover, .ink-clips-popover' },
        { id: 'modalSaveInkClip', sel: '#modalSaveInkClip, .ink-clip-save-backdrop' },
        { id: 'panelAudioRecordActions', sel: '#panelAudioRecordActions, #panelStealthRecordActions, #wrapStealthRecordDot' },
        { id: 'inkSizeFlyout', sel: '#inkSizeFlyout, .ink-size-flyout' },
        { id: 'inkFloatingToolbar', sel: '#inkFloatingToolbar, .ink-floating-toolbar' },
        { id: 'panelQuickTheme', sel: '#panelQuickTheme' },
        { id: 'panelQuickExport', sel: '#panelQuickExport' },
        { id: 'rightActionToolbar', sel: '#rightActionToolbar, .canvas-quick-toolbar' },
        { id: 'quickPillRemote', sel: '#quickPillRemote' },
        { id: 'graphSnapFloatingBar', sel: '#graphSnapFloatingBar, .graph-snap-floating-bar' },
        { id: 'pdfToGraphCropFloatingBar', sel: '#pdfToGraphCropFloatingBar' },
        { id: 'ctxSymmetryPopover', sel: '#ctxSymmetryPopover' },
        { id: 'ctxAbsPopover', sel: '#ctxAbsPopover' },
        { id: 'curveContextBar', sel: '#curveContextBar, .curve-context-bar' },
        { id: 'lassoActionFloatingBar', sel: '#lassoActionFloatingBar, .lasso-action-floating-bar' },
        { id: 'pwRegionPopover', sel: '#pwRegionPopover, .pw-region-popover' },
        { id: 'pdfBoardGridPopover', sel: '#pdfBoardGridPopover' },
        { id: 'playlistGridPopover', sel: '#playlistGridPopover' },
        { id: 'playlistAddSlideMenu', sel: '#playlistAddSlideMenu' },
        { id: 'lessonPlaylistNavBar', sel: '#lessonPlaylistNavBar, .lesson-playlist-nav-bar' },
        { id: 'btnRestoreAllUITab', sel: '#btnRestoreAllUITab' },
        { id: 'headerShowTab', sel: '#headerShowTab' },
        { id: 'appHeader', sel: '#appHeader, header' },
        { id: 'smartModalBackdrop', sel: '.smart-modal-backdrop, .n-axis-studio-backdrop' },
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
        if (extraCard) {
          uiBarId = extraCard.id || (typeof this.getAudioCardKey === 'function' ? this.getAudioCardKey(extraCard) : '');
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
        'button, a, label, [role="button"], .preset-card, .func-btn, .rail-btn, .ink-tool-btn, .ink-color-dot, .lasso-color-dot, .pill-mod-chip, .pill-primary-btn, .pill-remote-btn, .pill-color-dot, .pill-remote-swap-btn, .pill-remote-expand-btn, .pill-remote-close-btn, .theme-chip, .ink-size-btn, .single-line-step-btn, .quick-fab-btn, .slide-num-chip, .cat-tab-btn, .card-btn, .pip-pop-btn, .ctx-btn, .lasso-action-btn, .pw-popover-item, .custom-preset-chip, .export-preset-btn'
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
        } else if (ds.theme) {
          uiBtnKey = `theme:${ds.theme}`;
        } else if (ds.size) {
          uiBtnKey = `size:${ds.size}`;
        } else if (ds.penStyle) {
          uiBtnKey = `penStyle:${ds.penStyle}`;
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
          const allBtns = Array.from(barEl.querySelectorAll('button, .preset-card, .func-btn, .rail-btn, .ink-tool-btn, .ink-color-dot, .lasso-color-dot, .pill-color-dot, .theme-chip, .card-btn, .pip-pop-btn, .ctx-btn'));
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
      const barScope = uiBarId ? this._resolveAudioUiBarElement(uiBarId) : null;
      if (uiBtnKey.startsWith('id:')) {
        const idStr = uiBtnKey.slice(3);
        const directEl = document.getElementById(idStr);
        if (directEl) return directEl;
        if (idStr === 'btnPillSwapPenSelect') {
          return document.getElementById('btnPillPen') || document.getElementById('btnPillSelect');
        }
        return null;
      }
      if (uiBtnKey.startsWith('pipAct:')) {
        const sel = `[data-pip-act="${uiBtnKey.slice(7)}"]`;
        return (barScope && barScope.querySelector(sel)) || document.querySelector(sel);
      }
      if (uiBtnKey.startsWith('tool:')) {
        const sel = `[data-tool="${uiBtnKey.slice(5)}"]`;
        return (barScope && barScope.querySelector(sel))
          || document.querySelector(`#inkFloatingToolbar ${sel}`)
          || document.querySelector(`#quickPillRemote ${sel}`)
          || document.querySelector(sel);
      }
      if (uiBtnKey.startsWith('color:')) {
        const sel = `[data-color="${uiBtnKey.slice(6)}"]`;
        return (barScope && barScope.querySelector(sel))
          || document.querySelector(`#inkFloatingToolbar ${sel}`)
          || document.querySelector(`#quickPillRemote ${sel}`)
          || document.querySelector(`#lassoActionFloatingBar ${sel}`)
          || document.querySelector(sel);
      }
      if (uiBtnKey.startsWith('theme:')) {
        const sel = `[data-theme="${uiBtnKey.slice(6)}"]`;
        return (barScope && barScope.querySelector(sel)) || document.querySelector(sel);
      }
      if (uiBtnKey.startsWith('size:')) {
        const sel = `[data-size="${uiBtnKey.slice(5)}"]`;
        return (barScope && barScope.querySelector(sel)) || document.querySelector(sel);
      }
      if (uiBtnKey.startsWith('penStyle:')) {
        const sel = `[data-pen-style="${uiBtnKey.slice(9)}"]`;
        return (barScope && barScope.querySelector(sel)) || document.querySelector(sel);
      }
      if (uiBtnKey.startsWith('panel:')) {
        const sel = `[data-panel="${uiBtnKey.slice(6)}"]`;
        return (barScope && barScope.querySelector(sel))
          || document.querySelector(`#sidebarRail ${sel}`)
          || document.querySelector(`#railDock ${sel}`)
          || document.querySelector(sel);
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
        const sel = `[data-action="${uiBtnKey.slice(7)}"]`;
        return (barScope && barScope.querySelector(sel)) || document.querySelector(sel);
      }
      if (uiBtnKey.startsWith('slide:')) {
        const sel = `[data-slide-idx="${uiBtnKey.slice(6)}"]`;
        return (barScope && barScope.querySelector(sel))
          || document.querySelector(`#lessonPlaylistNavBar ${sel}`)
          || document.querySelector(sel);
      }
      if (uiBtnKey.startsWith('idx:')) {
        const lastColon = uiBtnKey.lastIndexOf(':');
        const bId = lastColon > 4 ? uiBtnKey.slice(4, lastColon) : '';
        const idx = lastColon > 4 ? parseInt(uiBtnKey.slice(lastColon + 1), 10) : NaN;
        const barEl = bId ? this._resolveAudioUiBarElement(bId) : barScope;
        if (barEl && Number.isFinite(idx) && idx >= 0) {
          const allBtns = barEl.querySelectorAll('button, .preset-card, .func-btn, .rail-btn, .ink-tool-btn, .ink-color-dot, .lasso-color-dot, .pill-color-dot, .theme-chip, .card-btn, .pip-pop-btn, .ctx-btn');
          return allBtns[idx] || null;
        }
      }
      return null;
    }

    _clientToStageCanvasPos(clientX, clientY) {
      let rect = this.canvasRect;
      if (!rect || !rect.width || !rect.height) {
        rect = (typeof this.updateCanvasRect === 'function' && this.updateCanvasRect())
          || (this.canvas && typeof this.canvas.getBoundingClientRect === 'function'
            ? this.canvas.getBoundingClientRect()
            : { left: 0, top: 0 });
      } else if (typeof document !== 'undefined' && document.body && document.body.classList.contains('ios-top-guard-active') && rect.top <= 0 && this.canvas && typeof this.canvas.getBoundingClientRect === 'function') {
        rect = this.updateCanvasRect() || this.canvas.getBoundingClientRect();
      }
      return {
        x: clientX - (rect ? (rect.left || 0) : 0),
        y: clientY - (rect ? (rect.top || 0) : 0)
      };
    }

    recordAudioCursorPoint(screenX, screenY, color = null, isDrawing = false, extraMeta = null) {
      if (!this.isAudioRecording || this.isAudioRecordPaused || this.isPdfModalOpen || this._isAudioWaitingForNextSlideSetup) return;
      const t = this.getAudioRecordElapsedMs();
      const cursorKind = this._detectCurrentAudioCursorKind(isDrawing, extraMeta);
      const effColor = color || this.currentInkColor || '#00d2d3';
      const uiBtnKey = (extraMeta && extraMeta.uiBtnKey) ? extraMeta.uiBtnKey : '';
      const uiBarId = (extraMeta && extraMeta.uiBarId) ? extraMeta.uiBarId : '';
      const rawPt = (extraMeta && extraMeta.pointerType) || '';
      const ptCode = rawPt === 'pen' ? 'p' : (rawPt === 'touch' ? 't' : 'm');
      const isMousePt = (ptCode === 'm');
      const kindChanged = (
        cursorKind !== this._lastRecordedCursorKind ||
        effColor !== (this._lastRecordedCursorColor || '') ||
        uiBtnKey !== (this._lastRecordedUiBtnKey || '') ||
        uiBarId !== (this._lastRecordedUiBarId || '') ||
        ptCode !== (this._lastRecordedCursorPt || '') ||
        Boolean(isDrawing) !== Boolean(this._lastRecordedCursorIsDrawing)
      );
      // PC 마우스 호버는 실제 화면녹화 영상과 동일한 16ms(60fps) + 0.5px 초정밀 샘플링, 펜/터치는 28ms + 1.2px 경량 샘플링
      const minHoverInterval = isMousePt ? 16 : 28;
      const minHoverDist = isMousePt ? 0.5 : 1.2;
      if (!kindChanged && !isDrawing && (t - this._lastAudioCursorRecordMs < minHoverInterval)) return;
      if (!kindChanged && isDrawing && (t - this._lastAudioCursorRecordMs < 14)) return;
      if (!kindChanged && !isDrawing && this._lastRecordedCursorPos && Math.hypot(screenX - this._lastRecordedCursorPos.x, screenY - this._lastRecordedCursorPos.y) < minHoverDist) return;
      this._lastRecordedCursorPos = { x: screenX, y: screenY };
      this._lastAudioCursorRecordMs = t;
      this._lastRecordedCursorKind = cursorKind;
      this._lastRecordedCursorColor = effColor;
      this._lastRecordedUiBtnKey = uiBtnKey;
      this._lastRecordedUiBarId = uiBarId;
      this._lastRecordedCursorPt = ptCode;
      this._lastRecordedCursorIsDrawing = Boolean(isDrawing);

      const entry = {
        t,
        type: 'cursor',
        x: Math.round(screenX * 10) / 10,
        y: Math.round(screenY * 10) / 10,
        color: effColor,
        isDrawing: Boolean(isDrawing),
        cursorKind,
        pt: ptCode
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

    async startAudioRecording(options = {}) {
      if (this._stoppingAudioRecordingPromise) {
        try { await this._stoppingAudioRecordingPromise; } catch (e) { }
      }
      if (this.isAudioRecording || this._isStartingAudioRecording) return;
      this._isStartingAudioRecording = true;
      try {
        // 단일 수업 노트 클라우드/공유 상한(150MB) 보호를 위한 누적 용량 사전 안내 가드 (125MB 도달 시 안내 -> 60분 풀타임 +20MB 녹화 후에도 덮어쓰기 100% 보장)
        const SAFE_PRE_RECORD_MAX_BYTES = 125 * 1024 * 1024;
        const estimatedPriorBytes = this._estimateOtherSlidesPayloadBytes();
        if (estimatedPriorBytes >= SAFE_PRE_RECORD_MAX_BYTES) {
          if (typeof this.showImportantAlertModal === 'function') {
            this.showImportantAlertModal({
              title: '노트 녹화 용량 한도 안내',
              descHtml: '현재 노트의 누적 용량이 가득 차 추가 녹화 시 저장·공유 한도(150MB)를 초과합니다.<br>새 노트에서 이어서 녹화해 주세요.',
              isDanger: true
            });
          } else {
            this.showToast('⚠️ 현재 노트의 누적 용량이 가득 차 추가 녹화 시 저장 한도(150MB)를 초과합니다. 새 노트에서 이어가 주세요.');
          }
          return;
        }

        // 이미 녹화된 영상이 있는 캔버스에서 녹화 시작 클릭 시 덮어쓰기 의사 사전 확인
        const hasExistingSlideVideo = Boolean(this.audioSyncData && Number(this.audioSyncData.durationMs) > 0);
        if (hasExistingSlideVideo && !(options && options.skipOverwriteConfirm) && typeof this.promptCloudConfirmDialog === 'function') {
          const okOverwrite = await this.promptCloudConfirmDialog({
            title: '기존 녹화 덮어쓰기 확인',
            descHtml: '이 캔버스에는 이미 녹화된 영상이 있습니다.<br>새로 녹화하여 기존 영상을 덮어쓰시겠습니까?',
            confirmLabel: '덮어쓰기',
            cancelLabel: '취소',
            isDanger: true,
            defaultFocus: 'cancel'
          });
          if (!okOverwrite) return;
        }

        this.stopAudioPlayback(true);
        this._sessionBasePriorRecordedMs = 0;
        this._warnedEndingSoonInSession = false;

        this.audioRecordedChunks = [];
        this.audioTimeline = [];
        this.audioLaserStrokes = [];
        this.audioErasedStrokes = [];
        this.audioCardAssetPool = {};
        this.audioArchivedPdfBoards = {};
        this.audioMediaStream = null;
        this.audioMediaRecorder = null;
        this._lastRecorderStopPromise = null;
        this._pendingSlideRecorderStarter = null;
        this._pendingAudioResumePromise = null;
        this._recorderBootHoldStartMs = 0;
        this._isPausedStandbyOnSlide = false;
        this._standbyExistingStrokeIds = null;
        this._standbyExistingStickers = null;
        this._hadActiveMicInSession = false;
        this._confirmedSilentRecordInSession = false;
        this._isPromptingSlideAudioOverwrite = false;
        this._micTrackLostInSession = false;
        this._notifiedMicLostInSession = false;
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
            const targetBps = this._getTargetAudioBitsPerSecond(this._audioMimeType);
            const recOpts = chosenMime ? { mimeType: chosenMime, audioBitsPerSecond: targetBps } : { audioBitsPerSecond: targetBps };
            const recorder = new MediaRecorder(stream, recOpts);
            const localChunks = [];
            recorder._localChunks = localChunks;
            this.audioRecordedChunks = localChunks;
            recorder.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) {
                localChunks.push(ev.data);
              }
            };
            recorder.onerror = () => {
              recorder._brokenByError = true;
              this._notifyAudioRecordTrackLost('⚠️ 오디오 녹음기 오류가 발생하여 음성이 기록되지 않습니다. 녹화를 다시 시작해 주세요.');
            };
            recorder.start(250);
            this.audioMediaRecorder = recorder;
            this._hadActiveMicInSession = true;
          } catch (micErr) {
            this._cleanupProcessedAudioStream();
            this.audioMediaRecorder = null;
            this._hadActiveMicInSession = false;
          }
        }

        const isHeadlessAutomated = Boolean(typeof navigator !== 'undefined' && navigator.webdriver === true);
        if (!this._hadActiveMicInSession && !this.isAudioMicMuted && !isHeadlessAutomated && !(options && options.allowSilentWithoutPrompt) && typeof this.promptCloudConfirmDialog === 'function') {
          const proceedSilent = await this.promptCloudConfirmDialog({
            title: '마이크를 사용할 수 없음',
            descHtml: '연결된 마이크가 없거나 마이크 권한이 차단되어 음성이 녹음되지 않습니다.<br>음성 없이 필기 영상만 녹화하시겠습니까?',
            confirmLabel: '음성 없이 녹화',
            cancelLabel: '취소',
            isDanger: false,
            defaultFocus: 'cancel'
          });
          if (!proceedSilent) {
            this._cleanupProcessedAudioStream();
            this.audioMediaRecorder = null;
            return;
          }
          this._confirmedSilentRecordInSession = true;
        }

        // 모든 취소 가능 모달을 통과한 시점에 기존 그려져 있던 스트로크·스티커를 배경 요소(preExisting: true)로 확정 마킹
        this._markSlideItemsPreExistingForAudio(true);

        this.isAudioRecording = true;
        this._currentAudioRecordingSessionId = Date.now();
        this.isAudioRecordPaused = false;
        this._autoPausedByAppBackground = false;
        this._hadBackgroundInterruptDuringPause = false;
        this._isAudioRecMenuOpen = false;
        this._isRecBarStealthHidden = true;
        this._isAudioWaitingForNextSlideSetup = false;
        this._alreadyArchivedBeforePdfModal = false;
        this._autoPausedByPdfModal = false;
        this._acquireAudioRecordWakeLock();
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
          if (!isActivelyDrawingNow) {
            if (lblTimer) {
              const elapsed = this.getAudioRecordElapsedMs();
              const nextTimeStr = this.formatAudioTimeMmSs(elapsed);
              if (lblTimer.textContent !== nextTimeStr) {
                lblTimer.textContent = nextTimeStr;
              }
            }
            if (this._isAudioRecMenuOpen) {
              this._syncAudioRecPopupHudTime();
            }
          }
          this._updateAudioRecordProgressRings(false);
          this._recordAudioWorkspaceStateIfNeeded(false);
        }, 200);

        this.syncAudioRecordUI();
        if (!this._hadActiveMicInSession && !this.isAudioMicMuted) {
          this.showToast('⚠️ 마이크 권한이 없거나 장치를 찾을 수 없어 [무음(필기만)]으로 녹화됩니다.');
        } else {
          this.showToast('🎬 영상 녹화가 시작되었습니다. (다시 누르면 일시정지 / 종료)');
        }
      } finally {
        this._isStartingAudioRecording = false;
      }
    }

    stopAudioRecording(options = {}) {
      if (this._stoppingAudioRecordingPromise) {
        return this._stoppingAudioRecordingPromise;
      }
      if (!this.isAudioRecording) return Promise.resolve(null);

      // 1) 진행 중인 비동기 레코더 부팅/롤오버 토큰 즉시 무효화 및 시계 홀드 정산
      this._audioSegmentToken = (this._audioSegmentToken || 0) + 1;
      this._flushRecorderBootHoldIfActive(true, true);

      const wasPausedStandby = Boolean(this._isPausedStandbyOnSlide);
      const activeRec = this.audioMediaRecorder;
      const recChunks = (activeRec && Array.isArray(activeRec._localChunks))
        ? activeRec._localChunks
        : (this.audioRecordedChunks ? [...this.audioRecordedChunks] : []);
      const recordedMime = (this._audioMimeType && this._audioMimeType !== 'audio/wav')
        ? this._audioMimeType
        : 'audio/webm';
      const segSessionId = this._currentAudioRecordingSessionId || null;

      let segUid = '';
      let committedSyncData = null;

      if (wasPausedStandby) {
        // 일시정지 상태로 다른 슬라이드를 열람하던 중 종료한 경우:
        // 직전 녹화 슬라이드는 이동 시점에 이미 마감·저장되었으므로 현재 슬라이드의 기존 audioSyncData를 100% 보존!
        this._normalizePausedStandbyMutations();
        committedSyncData = this.audioSyncData || null;
      } else {
        // 2) [0ms 동기식 즉시 커밋]: 종료 직후 슬라이드를 넘기더라도 엉뚱한 슬라이드에 덮어씌워지지 않도록
        //    비동기 인코더 대기 전 현재 슬라이드에 타임라인·키프레임·카드에셋·세그먼트 슬롯을 즉시 확정 저장!
        const segStartMs = Math.max(0, Number(this._resumedSlideBaseOffsetMs) || 0);
        const durationMs = Math.max(segStartMs + 300, this.getAudioRecordElapsedMs());
        const segDurMs = Math.max(100, durationMs - segStartMs);
        try {
          if (this._activeRecLassoOp && typeof this._commitAudioLassoTransformOp === 'function') {
            this._commitAudioLassoTransformOp();
          }
          this._recordAudioWorkspaceStateIfNeeded(true, true);
          this.audioFinalState = this._captureAudioWorkspaceKeyframe();
        } catch (e) { }

        const fallbackSilentUrl = this._createSilentWavDataUrl(segDurMs);
        const priorSegs = Array.isArray(this._priorSlideAudioSegments)
          ? JSON.parse(JSON.stringify(this._priorSlideAudioSegments))
          : [];
        segUid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newSeg = {
          segUid,
          startMs: segStartMs,
          endMs: durationMs,
          durationMs: segDurMs,
          audioDataUrl: fallbackSilentUrl,
          mimeType: 'audio/wav',
          nextSlideIdx: null,
          nextSlideStartMs: 0
        };
        const audioSegments = [...priorSegs, newSeg];
        const primaryAudioUrl = (audioSegments[0] && audioSegments[0].audioDataUrl) || fallbackSilentUrl;
        const primaryMime = (audioSegments[0] && audioSegments[0].mimeType) || 'audio/wav';

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

        committedSyncData = {
          version: '1.2',
          sessionId: segSessionId,
          createdAt: Date.now(),
          stageW: recordedStageW,
          stageH: recordedStageH,
          durationMs,
          mimeType: primaryMime,
          audioDataUrl: primaryAudioUrl,
          audioSegments,
          initialState: this.audioInitialState || this.audioFinalState,
          finalState: this.audioFinalState,
          timeline: this.audioTimeline ? [...this.audioTimeline] : [],
          laserStrokes: this.audioLaserStrokes ? [...this.audioLaserStrokes] : [],
          erasedStrokes: this.audioErasedStrokes ? [...this.audioErasedStrokes] : [],
          cardAssetPool: (this.audioCardAssetPool && typeof this.audioCardAssetPool === 'object')
            ? JSON.parse(JSON.stringify(this.audioCardAssetPool))
            : {},
          archivedPdfBoards: (this.audioArchivedPdfBoards && typeof this.audioArchivedPdfBoards === 'object')
            ? JSON.parse(JSON.stringify(this.audioArchivedPdfBoards))
            : {}
        };
        this.audioSyncData = committedSyncData;
        this.audioPlayCurrentMs = durationMs;
        this._isAudioSyncPlayerVisible = false;
        this.audioReplayViewMode = 'video';
      }

      // 3) 녹화 플래그 동기 해제 및 현재 슬라이드 즉시 직렬화 백업
      this.isAudioRecording = false;
      this.isAudioRecordPaused = false;
      this._isPausedStandbyOnSlide = false;
      this._standbyExistingStrokeIds = null;
      this._standbyExistingStickers = null;
      this._recorderBootHoldStartMs = 0;
      this._autoPausedByAppBackground = false;
      this._hadBackgroundInterruptDuringPause = false;
      this._hadActiveMicInSession = false;
      this._confirmedSilentRecordInSession = false;
      this._isPromptingSlideAudioOverwrite = false;
      this._micTrackLostInSession = false;
      this._notifiedMicLostInSession = false;
      this._releaseAudioRecordWakeLock();
      this._isAudioRecMenuOpen = false;
      this.audioRecordPauseStartMs = 0;
      this.audioRecordTotalPausedMs = 0;
      this.audioSessionTotalPausedMs = 0;
      this._resumedSlideBaseOffsetMs = 0;
      this._priorSlideAudioSegments = [];
      this.audioMediaRecorder = null;
      this.audioRecordedChunks = [];

      if (this._audioRecordTimerId) {
        clearInterval(this._audioRecordTimerId);
        this._audioRecordTimerId = null;
      }

      if (!wasPausedStandby && this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides[this.lessonPlaylistIndex]) {
        this._slideDirty = true;
        this.saveCurrentSlideIntoPlaylist();
      }
      this.syncAudioRecordUI();

      // 4) 백그라운드 비동기 오디오 인코더 마감(최대 3000ms) 및 segUid 정밀 주입
      let stopTask = null;
      stopTask = (async () => {
        if (this._lastRecorderStopPromise) {
          await this._lastRecorderStopPromise.catch(() => { });
        }
        if (this._pendingSlideRecorderStarter) {
          await this._pendingSlideRecorderStarter.catch(() => { });
          this._pendingSlideRecorderStarter = null;
        }
        if (this._pendingAudioResumePromise) {
          await this._pendingAudioResumePromise.catch(() => { });
          this._pendingAudioResumePromise = null;
        }

        const latestRec = (activeRec && activeRec.state !== 'inactive') ? activeRec : this.audioMediaRecorder;
        if (latestRec && latestRec.state !== 'inactive') {
          await this._stopMediaRecorderSafely(latestRec, 3000);
        }
        this._cleanupProcessedAudioStream();
        this.audioMediaRecorder = null;

        if (!wasPausedStandby && segUid) {
          const finalRecChunks = (activeRec && Array.isArray(activeRec._localChunks) && activeRec._localChunks.length > 0)
            ? activeRec._localChunks
            : recChunks;
          if (finalRecChunks && finalRecChunks.length > 0) {
            const blob = new Blob(finalRecChunks, { type: recordedMime });
            const dataUrl = await this._blobToDataUrlSafely(blob, 60000);
            if (dataUrl) {
              this._applyFinalizedAudioDataUrlToMatchingSegment(segUid, segSessionId, dataUrl, recordedMime, committedSyncData);
            }
          }
        }

        if (Array.isArray(this._pendingSlideAudioFinalizers) && this._pendingSlideAudioFinalizers.length > 0) {
          const otherFinalizers = this._pendingSlideAudioFinalizers.filter(p => p && p !== stopTask);
          if (otherFinalizers.length > 0) {
            await Promise.all(otherFinalizers).catch(() => { });
          }
        }

        if (!options || !options.silentToast) {
          this.showToast('⏹ 영상 녹화가 완료되었습니다.');
        }
        return committedSyncData || this.audioSyncData;
      })().finally(() => {
        if (Array.isArray(this._pendingSlideAudioFinalizers) && stopTask) {
          const sIdx = this._pendingSlideAudioFinalizers.indexOf(stopTask);
          if (sIdx !== -1) {
            this._pendingSlideAudioFinalizers.splice(sIdx, 1);
          }
        }
        if (this._stoppingAudioRecordingPromise === stopTask) {
          this._stoppingAudioRecordingPromise = null;
        }
      });

      this._stoppingAudioRecordingPromise = stopTask;
      if (!this._pendingSlideAudioFinalizers) this._pendingSlideAudioFinalizers = [];
      this._pendingSlideAudioFinalizers.push(stopTask);
      return stopTask;
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
        sideMenu.classList.toggle('is-paused', Boolean(this.isAudioRecording && isPaused));
        sideMenu.style.display = (this.isAudioRecording && !isHiddenUI && this._isAudioRecMenuOpen) ? 'flex' : 'none';
      }
      if (wrapStealthDot) {
        wrapStealthDot.style.display = (this.isAudioRecording && isHiddenUI) ? 'flex' : 'none';
      }
      if (btnStealthDot) {
        btnStealthDot.classList.toggle('is-paused', Boolean(this.isAudioRecording && isPaused));
        btnStealthDot.title = isPaused
          ? '녹화 일시정지됨'
          : '녹화 중';
      }
      if (stealthSideMenu) {
        stealthSideMenu.classList.toggle('is-paused', Boolean(this.isAudioRecording && isPaused));
        stealthSideMenu.style.display = (this.isAudioRecording && isHiddenUI && this._isAudioRecMenuOpen) ? 'flex' : 'none';
      }
      const hudStatusMain = document.getElementById('lblAudioRecHudStatus');
      if (hudStatusMain) hudStatusMain.textContent = isPaused ? 'PAUSED' : 'REC';
      const hudStatusStealth = document.getElementById('lblStealthRecHudStatus');
      if (hudStatusStealth) hudStatusStealth.textContent = isPaused ? 'PAUSED' : 'REC';
      this._syncAudioRecPopupHudTime();

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
          hintEl.textContent = '';
        }
        const nextIconState = isPaused ? 'play' : 'pause';
        const nextIconSvg = isPaused
          ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 4.6c0-.8.88-1.28 1.56-.85l11.2 7.4c.62.41.62 1.29 0 1.7l-11.2 7.4c-.68.43-1.56-.05-1.56-.85V4.6Z"/></svg>'
          : '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4.5" height="16" rx="1.2"/><rect x="14.5" y="4" width="4.5" height="16" rx="1.2"/></svg>';
        if (btnPauseRec) btnPauseRec.classList.toggle('is-paused', isPaused);
        if (iconPauseRec && iconPauseRec.dataset.iconState !== nextIconState) {
          iconPauseRec.dataset.iconState = nextIconState;
          iconPauseRec.innerHTML = nextIconSvg;
        }
        if (lblPauseRec) lblPauseRec.textContent = isPaused ? '재개' : '일시정지';
        if (btnStealthPauseRec) btnStealthPauseRec.classList.toggle('is-paused', isPaused);
        if (iconStealthPauseRec && iconStealthPauseRec.dataset.iconState !== nextIconState) {
          iconStealthPauseRec.dataset.iconState = nextIconState;
          iconStealthPauseRec.innerHTML = nextIconSvg;
        }
        if (lblStealthPauseRec) lblStealthPauseRec.textContent = isPaused ? '재개' : '일시정지';

        const btnMic = document.getElementById('btnAudioMicMuteToggle');
        const iconMic = document.getElementById('iconAudioMicMute');
        const lblMic = document.getElementById('lblAudioMicMute');
        const micUnavailable = Boolean(!this._hadActiveMicInSession || this._micTrackLostInSession);
        const isMuted = Boolean(this.isAudioMicMuted || micUnavailable);
        if (btnMic) btnMic.classList.toggle('is-muted', isMuted);
        if (iconMic) iconMic.textContent = isMuted ? '🔇' : '🎤';
        if (lblMic) {
          lblMic.textContent = (micUnavailable && !this.isAudioMicMuted)
            ? '마이크 없음(무음)'
            : (isMuted ? '무음 녹화' : '마이크 ON');
        }
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

    _getIosTopGuardPx() {
      if (typeof document === 'undefined' || !document.body || !document.body.classList.contains('ios-top-guard-active')) {
        return 0;
      }
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        const raw = window.getComputedStyle(document.body).getPropertyValue('--ios-top-safe-guard');
        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      return 36;
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
          if (typeof this._syncIosTopGuardColor === 'function') this._syncIosTopGuardColor();
          this.resizeCanvas();
          if (typeof this.syncProblemCardRectFromWidget === 'function') this.syncProblemCardRectFromWidget();
          if (typeof this.syncGraphCardRectFromWidget === 'function') this.syncGraphCardRectFromWidget();
        }
        return;
      }

      const wasFixedStage = document.body.classList.contains('replay-fixed-stage');
      document.body.classList.add('replay-fixed-stage');
      if (!wasFixedStage && typeof this._syncIosTopGuardColor === 'function') {
        this._syncIosTopGuardColor();
      }
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

      const topGuard = (typeof this._getIosTopGuardPx === 'function') ? this._getIosTopGuardPx() : 0;
      const vw = Math.max(240, window.innerWidth || 1280);
      const rawVh = Math.max(200, window.innerHeight || 720);
      const availH = Math.max(200, rawVh - topGuard);
      const fitScale = Math.min(vw / stageW, availH / stageH);
      const userZoom = Math.max(1.0, Math.min(4.5, Number(this._replayViewerZoom) || 1.0));
      this._replayViewerZoom = userZoom;
      const totalScale = fitScale * userZoom;
      this._replayStageFitScale = fitScale;
      this._replayStageTotalScale = totalScale;

      const scaledW = stageW * totalScale;
      const scaledH = stageH * totalScale;
      const baseX = (vw - scaledW) * 0.5;
      const baseY = topGuard + (availH - scaledH) * 0.5;

      if (userZoom <= 1.005) {
        this._replayViewerPanX = 0;
        this._replayViewerPanY = 0;
      } else {
        const maxPanX = Math.max(60, Math.max(0, scaledW - vw) * 0.5 + vw * 0.35);
        const maxPanY = Math.max(60, Math.max(0, scaledH - availH) * 0.5 + availH * 0.35);
        this._replayViewerPanX = Math.max(-maxPanX, Math.min(maxPanX, Number(this._replayViewerPanX) || 0));
        this._replayViewerPanY = Math.max(-maxPanY, Math.min(maxPanY, Number(this._replayViewerPanY) || 0));
      }

      const tx = baseX + (this._replayViewerPanX || 0);
      const ty = baseY + (this._replayViewerPanY || 0);
      this._replayStageTranslateX = tx;
      this._replayStageTranslateY = ty;

      if (wsEl) {
        if (userZoom > 1.005) {
          wsEl.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${totalScale.toFixed(5)})`;
        } else {
          wsEl.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) scale(${totalScale.toFixed(5)})`;
        }
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
      const topGuard = (typeof this._getIosTopGuardPx === 'function') ? this._getIosTopGuardPx() : 0;
      const vw = Math.max(240, window.innerWidth || 1280);
      const rawVh = Math.max(200, window.innerHeight || 720);
      const availH = Math.max(200, rawVh - topGuard);
      const centerY = topGuard + availH * 0.5;
      const fx = (typeof focalClientX === 'number') ? focalClientX : (vw * 0.5);
      const fy = (typeof focalClientY === 'number') ? focalClientY : centerY;

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
      this._replayViewerPanY = (fy - centerY) * (1 - ratio) + curPanY * ratio;
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
          target.closest('#viewerAudioEndingOverlay') ||
          target.closest('#lessonPlaylistNavBar') ||
          target.closest('#topSlideBarMiniTab') ||
          target.closest('.slide-grid-popover') ||
          target.closest('.smart-modal-backdrop')
        );
      };

      // 1. PC 마우스 휠 / 트랙패드 확대/축소 (커서 위치 기준 줌, 가로 스와이프 deltaY===0 오작동 방어)
      window.addEventListener('wheel', (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        if (!e.deltaY) return;
        const isSmoothTrackpad = (e.deltaMode === 0 && Math.abs(e.deltaY) < 40);
        const factor = isSmoothTrackpad
          ? Math.exp(-e.deltaY * (e.ctrlKey || e.metaKey ? 0.01 : 0.0045))
          : (e.deltaY < 0 ? 1.14 : (1 / 1.14));
        this.zoomReplayStageAtPoint((this._replayViewerZoom || 1.0) * factor, e.clientX, e.clientY);
      }, { passive: false, capture: true });

      // 2. 모바일/태블릿 두 손가락 핀치 줌 & 패닝 + 확대 시 한 손가락 드래그 이동 + 더블탭 줌 토글
      let isPanningStage = false;
      let panStartX = 0;
      let panStartY = 0;
      let panBaseX = 0;
      let panBaseY = 0;
      let isPinchingStage = false;
      let pinchId1 = null;
      let pinchId2 = null;
      let pinchInitDist = 0;
      let pinchInitMidX = 0;
      let pinchInitMidY = 0;
      let pinchZoomUnlocked = false;
      let pinchParallelPanLocked = false;
      let pinchStartDist = 0;
      let pinchSmoothDist = 0;
      let pinchStartZoom = 1.0;
      let pinchSmoothMidX = 0;
      let pinchSmoothMidY = 0;
      let pinchPrevMidX = 0;
      let pinchPrevMidY = 0;
      let lastTapMs = 0;
      let lastTapX = 0;
      let lastTapY = 0;

      const startReplayPinch = (t0, t1) => {
        isPanningStage = false;
        isPinchingStage = true;
        pinchId1 = t0.identifier;
        pinchId2 = t1.identifier;
        const initD = Math.max(24, Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY));
        const initMX = (t0.clientX + t1.clientX) * 0.5;
        const initMY = (t0.clientY + t1.clientY) * 0.5;
        pinchInitDist = initD;
        pinchInitMidX = initMX;
        pinchInitMidY = initMY;
        pinchZoomUnlocked = false;
        pinchParallelPanLocked = false;
        pinchStartDist = initD;
        pinchSmoothDist = initD;
        pinchStartZoom = this._replayViewerZoom || 1.0;
        pinchSmoothMidX = initMX;
        pinchSmoothMidY = initMY;
        pinchPrevMidX = initMX;
        pinchPrevMidY = initMY;
      };

      window.addEventListener('touchstart', (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        e.stopPropagation();
        if (e.touches && e.touches.length >= 2) {
          if (isPinchingStage && pinchId1 !== null && pinchId2 !== null) {
            let has1 = false;
            let has2 = false;
            for (let i = 0; i < e.touches.length; i++) {
              if (e.touches[i].identifier === pinchId1) has1 = true;
              if (e.touches[i].identifier === pinchId2) has2 = true;
            }
            if (has1 && has2) return;
          }
          startReplayPinch(e.touches[0], e.touches[1]);
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
        if (isPinchingStage && e.touches && e.touches.length >= 2) {
          e.preventDefault();
          let t1 = null;
          let t2 = null;
          for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            if (t.identifier === pinchId1) t1 = t;
            else if (t.identifier === pinchId2) t2 = t;
          }
          if (!t1 || !t2) {
            startReplayPinch(e.touches[0], e.touches[1]);
            return;
          }
          const rawDist = Math.max(24, Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY));
          const rawMidX = (t1.clientX + t2.clientX) * 0.5;
          const rawMidY = (t1.clientY + t2.clientY) * 0.5;
          const panTravel = Math.hypot(rawMidX - pinchInitMidX, rawMidY - pinchInitMidY);
          const distDelta = Math.abs(rawDist - pinchInitDist);
          if (!pinchZoomUnlocked && panTravel >= 26 && distDelta < 14) {
            pinchParallelPanLocked = true;
          }
          const jitterMid = Math.hypot(rawMidX - pinchSmoothMidX, rawMidY - pinchSmoothMidY);
          const alphaMid = (jitterMid < 1.0) ? 0.32 : 0.68;
          pinchSmoothMidX = pinchSmoothMidX + (rawMidX - pinchSmoothMidX) * alphaMid;
          pinchSmoothMidY = pinchSmoothMidY + (rawMidY - pinchSmoothMidY) * alphaMid;

          this._replayViewerPanX = (this._replayViewerPanX || 0) + (pinchSmoothMidX - pinchPrevMidX);
          this._replayViewerPanY = (this._replayViewerPanY || 0) + (pinchSmoothMidY - pinchPrevMidY);
          pinchPrevMidX = pinchSmoothMidX;
          pinchPrevMidY = pinchSmoothMidY;

          if (!pinchZoomUnlocked) {
            const unlockThreshold = pinchParallelPanLocked ? 28 : 14;
            if (distDelta >= unlockThreshold) {
              pinchZoomUnlocked = true;
              pinchStartDist = rawDist;
              pinchSmoothDist = rawDist;
              pinchStartZoom = this._replayViewerZoom || 1.0;
            } else {
              this._syncReplayFixedStageLayout();
              return;
            }
          }
          const jitterDist = Math.abs(rawDist - pinchSmoothDist);
          const alphaDist = (jitterDist < 1.0) ? 0.32 : 0.68;
          pinchSmoothDist = pinchSmoothDist + (rawDist - pinchSmoothDist) * alphaDist;
          const nextZoom = (typeof this._computeStandardPinchZoom === 'function')
            ? this._computeStandardPinchZoom(pinchSmoothDist, pinchStartDist, pinchStartZoom, 1.0, 4.5, 1.0)
            : Math.max(1.0, Math.min(4.5, pinchStartZoom * Math.pow((pinchSmoothDist + 65) / (pinchStartDist + 65), 0.95)));
          this.zoomReplayStageAtPoint(nextZoom, pinchSmoothMidX, pinchSmoothMidY);
        } else if (isPanningStage && e.touches && e.touches.length === 1) {
          e.preventDefault();
          const t0 = e.touches[0];
          this._replayViewerPanX = panBaseX + (t0.clientX - panStartX);
          this._replayViewerPanY = panBaseY + (t0.clientY - panStartY);
          this._syncReplayFixedStageLayout();
        }
      }, { passive: false, capture: true });

      const onReplayTouchEnd = (e) => {
        if (!this._isFixedReplayStageActive()) return;
        if (isOuterReplayControl(e.target)) return;
        e.stopPropagation();
        if (!e.touches || e.touches.length < 2) {
          isPinchingStage = false;
          pinchId1 = null;
          pinchId2 = null;
        }
        if (!e.touches || e.touches.length === 0) {
          isPanningStage = false;
        }
      };
      window.addEventListener('touchend', onReplayTouchEnd, { passive: true, capture: true });
      window.addEventListener('touchcancel', onReplayTouchEnd, { passive: true, capture: true });

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
      window.addEventListener('pointercancel', () => {
        isMousePanningStage = false;
      }, { capture: true });

      const resetReplayGestureState = () => {
        isPanningStage = false;
        isPinchingStage = false;
        isMousePanningStage = false;
        pinchId1 = null;
        pinchId2 = null;
      };
      window.addEventListener('blur', resetReplayGestureState);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) resetReplayGestureState();
      });

      // 4. 영상/음성 리플레이 전용 키보드 컨트롤러 (Space 재생/정지 · ←/→ ±5초 · 0/+/- 줌 · Esc)
      window.addEventListener('keydown', (e) => {
        if (!this.isStudentAudioVideoOnlyMode && !this._isAudioReplayActive) return;
        if (typeof this._isSmartNoteViewerOverlayOpen === 'function' && this._isSmartNoteViewerOverlayOpen()) return;
        if (document.body && document.body.classList.contains('viewer-graph-touch-mode')) return;
        const nAxisModal = document.getElementById('modalNAxisStudio');
        if (this.isNAxisStudioOpen || (nAxisModal && nAxisModal.style.display !== 'none')) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (this.isAudioPlaying) {
            this.pauseAudioPlayback(false);
          } else {
            this._unlockAudioPlayerForMobileGesture(false);
            this.playAudioSync();
          }
          this.showAudioPlayerBarTemporarily(2800);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (!this.audioSyncData) return;
          e.preventDefault();
          e.stopPropagation();
          const dur = this.audioSyncData.durationMs || 1000;
          const delta = e.key === 'ArrowLeft' ? -5000 : 5000;
          const nextMs = Math.max(0, Math.min(dur, (this.audioPlayCurrentMs || 0) + delta));
          this.seekAudioSync(nextMs, false);
        } else if (e.key === '0') {
          e.preventDefault();
          e.stopPropagation();
          this.resetReplayViewerZoom();
          this.showAudioPlayerBarTemporarily(2800);
        } else if (e.key === '+' || e.key === '=') {
          if (!this._isFixedReplayStageActive()) return;
          e.preventDefault();
          e.stopPropagation();
          this.zoomReplayStageAtPoint((this._replayViewerZoom || 1.0) * 1.18, window.innerWidth / 2, window.innerHeight / 2);
          this.showAudioPlayerBarTemporarily(2800);
        } else if (e.key === '-' || e.key === '_') {
          if (!this._isFixedReplayStageActive()) return;
          e.preventDefault();
          e.stopPropagation();
          this.zoomReplayStageAtPoint((this._replayViewerZoom || 1.0) / 1.18, window.innerWidth / 2, window.innerHeight / 2);
          this.showAudioPlayerBarTemporarily(2800);
        } else if (e.key === 'Escape') {
          const endOv = document.getElementById('viewerAudioEndingOverlay');
          if (endOv && endOv.style.display !== 'none' && typeof this.hideAudioLectureEndingOverlay === 'function') {
            e.preventDefault();
            e.stopPropagation();
            this.hideAudioLectureEndingOverlay();
            if (typeof this._clearAudioPlayerBarAutoHide === 'function') {
              this._clearAudioPlayerBarAutoHide();
            }
            if (typeof this.syncAudioRecordUI === 'function') {
              this.syncAudioRecordUI();
            }
            return;
          }
          if ((this._replayViewerZoom || 1.0) > 1.01) {
            e.preventDefault();
            e.stopPropagation();
            this.resetReplayViewerZoom();
            return;
          }
          if (!this.isStudentAudioVideoOnlyMode) {
            e.preventDefault();
            e.stopPropagation();
            this.stopAudioPlayback(true);
            return;
          }
          const btnBack = document.getElementById('btnAudioBackToViewer');
          if (btnBack && btnBack.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            btnBack.click();
          }
        }
      });

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
      const lerpPdfAnchor = (ancA, ancB) => {
        if (!ancA || !ancB) return ancA || ancB || null;
        if (typeof ancA.mx !== 'number' || typeof ancB.mx !== 'number') return ancA;
        return {
          ...ancA,
          mx: lerp(ancA.mx, ancB.mx),
          my: lerp(ancA.my, ancB.my),
          unitScale: (typeof ancA.unitScale === 'number' && typeof ancB.unitScale === 'number')
            ? lerp(ancA.unitScale, ancB.unitScale)
            : ancA.unitScale
        };
      };
      merged.probCardBaseX = lerp(kfA.probCardBaseX, kfB.probCardBaseX);
      merged.probCardBaseY = lerp(kfA.probCardBaseY, kfB.probCardBaseY);
      merged.probCardPdfAnchor = lerpPdfAnchor(kfA.probCardPdfAnchor, kfB.probCardPdfAnchor);
      merged.probCardW = lerp(kfA.probCardW || 520, kfB.probCardW || 520);
      merged.graphCardBaseX = lerp(kfA.graphCardBaseX, kfB.graphCardBaseX);
      merged.graphCardBaseY = lerp(kfA.graphCardBaseY, kfB.graphCardBaseY);
      merged.graphCardPdfAnchor = lerpPdfAnchor(kfA.graphCardPdfAnchor, kfB.graphCardPdfAnchor);
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
      if (kfA.drawerOpen && kfB.drawerOpen && kfA.activeDrawerPanel === kfB.activeDrawerPanel) {
        if (typeof kfA.drawerScrollTop === 'number' && typeof kfB.drawerScrollTop === 'number') {
          merged.drawerScrollTop = lerp(kfA.drawerScrollTop, kfB.drawerScrollTop);
        }
        if (kfA.activePresetCat === kfB.activePresetCat && typeof kfA.funcGridScrollTop === 'number' && typeof kfB.funcGridScrollTop === 'number') {
          merged.funcGridScrollTop = lerp(kfA.funcGridScrollTop, kfB.funcGridScrollTop);
        }
      }
      if (Array.isArray(kfA.extraGraphStates) && Array.isArray(kfB.extraGraphStates) && kfA.extraGraphStates.length === kfB.extraGraphStates.length) {
        merged.extraGraphStates = kfA.extraGraphStates.map((stA, idx) => {
          const stB = stA && stA.uid
            ? (kfB.extraGraphStates.find(cand => cand && cand.uid === stA.uid) || null)
            : (kfB.extraGraphStates[idx] || stA);
          if (!stB) return stA;
          return {
            ...stA,
            baseX: lerp(stA.baseX, stB.baseX),
            baseY: lerp(stA.baseY, stB.baseY),
            pdfAnchor: lerpPdfAnchor(stA.pdfAnchor, stB.pdfAnchor),
            w: lerp(stA.w || 260, stB.w || 260),
            aspect: (typeof stA.aspect === 'number' && typeof stB.aspect === 'number') ? lerp(stA.aspect, stB.aspect) : stA.aspect,
            pipSnap: (stA.pipSnap && stB.pipSnap) ? this._interpolatePipSnapForAudio(stA.pipSnap, stB.pipSnap, alpha, lerp) : stA.pipSnap
          };
        });
      }
      if (Array.isArray(kfA.extraProbStates) && Array.isArray(kfB.extraProbStates) && kfA.extraProbStates.length === kfB.extraProbStates.length) {
        merged.extraProbStates = kfA.extraProbStates.map((stA, idx) => {
          const stB = stA && stA.uid
            ? (kfB.extraProbStates.find(cand => cand && cand.uid === stA.uid) || null)
            : (kfB.extraProbStates[idx] || stA);
          if (!stB) return stA;
          return {
            ...stA,
            baseX: lerp(stA.baseX, stB.baseX),
            baseY: lerp(stA.baseY, stB.baseY),
            pdfAnchor: lerpPdfAnchor(stA.pdfAnchor, stB.pdfAnchor),
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
      if (
        kfA.stickerDraft &&
        kfB.stickerDraft &&
        Boolean(kfA.stickerDraft.screenPx) === Boolean(kfB.stickerDraft.screenPx) &&
        Boolean(kfA.stickerDraft.isBoard) === Boolean(kfB.stickerDraft.isBoard)
      ) {
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
      if (kfA.lassoState && kfB.lassoState) {
        const lsA = kfA.lassoState;
        const lsB = kfB.lassoState;
        const targetOpB = (lsA.opId && lsB.opId === lsA.opId)
          ? lsB
          : ((lsA.opId && lsB.endOp && lsB.endOp.opId === lsA.opId) ? lsB.endOp : null);
        if (targetOpB) {
          merged.lassoState = {
            ...lsA,
            bbox: (Array.isArray(lsA.bbox) && Array.isArray(lsB.bbox) && lsA.bbox.length === 4 && lsB.bbox.length === 4)
              ? lsA.bbox.map((v, idx) => lerp(v, lsB.bbox[idx]))
              : lsA.bbox,
            showBar: false,
            dx: lerp(lsA.dx || 0, targetOpB.dx || 0),
            dy: lerp(lsA.dy || 0, targetOpB.dy || 0),
            ax: typeof lsA.ax === 'number' ? lsA.ax : (targetOpB.ax || 0),
            ay: typeof lsA.ay === 'number' ? lsA.ay : (targetOpB.ay || 0),
            scale: lerp(lsA.scale || 1, targetOpB.scale || 1),
            angle: lerp(lsA.angle || 0, targetOpB.angle || 0),
            flipScale: lerp(
              typeof lsA.flipScale === 'number' ? lsA.flipScale : 1,
              typeof targetOpB.flipScale === 'number' ? targetOpB.flipScale : 1
            ),
            initBBox: lsA.initBBox || targetOpB.initBBox || undefined
          };
        } else if (
          !lsA.selecting &&
          !lsB.selecting &&
          !lsA.opId &&
          !lsB.opId &&
          Array.isArray(lsA.bbox) &&
          Array.isArray(lsB.bbox) &&
          lsA.bbox.length === 4 &&
          lsB.bbox.length === 4 &&
          Math.hypot(lsB.bbox[0] - lsA.bbox[0], lsB.bbox[1] - lsA.bbox[1]) < 90
        ) {
          merged.lassoState = {
            ...lsA,
            bbox: lsA.bbox.map((v, idx) => lerp(v, lsB.bbox[idx]))
          };
        }
      }
      if (Array.isArray(kfA.textLabels) && Array.isArray(kfB.textLabels) && kfA.textLabels.length > 0 && kfA.textLabels.length === kfB.textLabels.length) {
        merged.textLabels = kfA.textLabels.map((tA, idx) => {
          const tB = kfB.textLabels[idx];
          if (!tA || !tB || (tA.id && tB.id && tA.id !== tB.id)) return tA;
          return {
            ...tA,
            mathX: lerp(tA.mathX, tB.mathX),
            mathY: lerp(tA.mathY, tB.mathY),
            fontSize: (typeof tA.fontSize === 'number' && typeof tB.fontSize === 'number') ? lerp(tA.fontSize, tB.fontSize) : tA.fontSize
          };
        });
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

    // =========================================================================
    // 🎬 [순정 무변형 기반 최소 보정 리플레이 엔진 (Raw Video-Grade Replay Engine)]
    //   1) 원본 키프레임·포인터 궤적 인공 스무딩/포물선/디밍 0% (실제 손·마우스 동선 100% 직결 보존)
    //   2) 창(카드) 이동·리사이즈 중 손바닥·리사이즈 커서 0.00px 동기 고정 + PDF 앵커 서브픽셀 보간
    //   3) 도형 팝오버(#inkShapesPopover)·스텔스 잠금 카드 헤더·대칭 메뉴 선행 자동 오픈
    //   4) 비노출 보조 서랍(#inkClipsPopover·#modalSaveInkClip·슬라이드/내보내기 모달 등) 조작 시
    //      오디오 무중단 유지 + Stitch B-1 Pure Ink Charcoal '돋보기 + 플로팅 점 3개' 탐색 포인터 표시
    // =========================================================================
    _classifyReplaySpecialUiEvent(ev, cardMotionSpans, isNearShapesSpanFn) {
      if (!ev || !ev.uiScreen) return 'normal';
      const barId = ev.uiBarId || '';
      const btnKey = ev.uiBtnKey || '';
      const isStudent = Boolean(this.isStudentAudioVideoOnlyMode);

      // A) 녹화 제어용 히든 팝업(일시정지·녹화종료 등): 화면에 노출되지 않으며 종료 직전 돌진 노이즈이므로 조용히 생략
      if (barId === 'panelAudioRecordActions') return 'record_ctrl';
      const RECORD_CTRL_BTNS = {
        'id:btnAudioPauseRecord': true,
        'id:btnAudioStopRecord': true,
        'id:btnStealthRecordDot': true,
        'id:btnStealthPauseRecord': true,
        'id:btnStealthStopRecord': true,
        'id:btnAudioReRecord': true,
        'id:btnAudioSyncDelete': true,
        'id:btnAudioSyncCloseBar': true,
        'id:btnAudioShowFinalNote': true
      };
      if (btnKey && RECORD_CTRL_BTNS[btnKey]) return 'record_ctrl';

      // B) 리플레이 화면에 렌더링되지 않는 보조 서랍·모달(내 클립, 클립 저장창, 페이지 그리드, 알림 모달 등):
      //    허공 클릭 대신 진입 버튼 옆에서 B-1 돋보기 탐색 포인터(search)로 자연스럽게 안내!
      const SEARCH_POPUP_BARS = {
        inkClipsPopover: true,
        modalSaveInkClip: true,
        pdfBoardGridPopover: true,
        playlistGridPopover: true,
        playlistAddSlideMenu: true,
        panelQuickExport: true,
        smartModalBackdrop: true
      };
      if (barId && SEARCH_POPUP_BARS[barId]) return 'search_popup';

      const SEARCH_POPUP_BTNS = {
        'id:btnCloseSaveInkClip': true,
        'id:btnConfirmSaveInkClip': true,
        'id:btnInkClipsDeleteMode': true,
        'id:btnInkClipsPin': true,
        'id:btnInkClipsClose': true,
        'id:btnInkClipsUndoDelete': true,
        'id:inputInkClipsSearch': true
      };
      if (btnKey && SEARCH_POPUP_BTNS[btnKey]) return 'search_popup';

      if (isStudent && btnKey) {
        const STUDENT_HIDDEN_BTNS = {
          'id:btnPlaylistAddSlide': true,
          'id:btnPlaylistNextPdfPage': true,
          'id:btnPlaylistOpenPdf': true,
          'id:btnPlaylistDeleteCurrent': true,
          'id:btnPlaylistHideBar': true,
          'id:btnPlaylistClose': true,
          'id:btnPlaylistClearAll': true,
          'id:btnPlaylistToggleSelectMode': true,
          'id:btnPlaylistConfirmSelectedDelete': true
        };
        if (STUDENT_HIDDEN_BTNS[btnKey]) return 'search_popup';
      }

      const evT = typeof ev.t === 'number' ? ev.t : 0;
      const inCardMotion = Array.isArray(cardMotionSpans) && cardMotionSpans.some(
        sp => sp && evT >= sp.tStart - 120 && evT <= sp.tEnd + 120
      );
      if (isStudent && ev.cursorKind === 'nwse-resize' && !inCardMotion) {
        return 'record_ctrl';
      }

      return 'normal';
    }

    _findNearestRawStateAt(syncData, tMs) {
      if (!syncData) return null;
      let kf = syncData.initialState || null;
      const tl = syncData.timeline || [];
      for (let i = 0; i < tl.length; i++) {
        const item = tl[i];
        if (!item || item.type !== 'state' || !item.state) continue;
        if (item.t <= tMs + 60) {
          kf = item.state;
        } else {
          break;
        }
      }
      return kf;
    }

    _resolveSearchSpanParkPos(sp) {
      const sw = this.screenWidth || window.innerWidth || 1440;
      const sh = this.screenHeight || window.innerHeight || 900;
      const clampStage = (x, y) => ({
        x: Math.max(24, Math.min(sw - 46, x)),
        y: Math.max(48, Math.min(sh - 46, y))
      });
      if (sp && sp.anchorBtnKey) {
        const btnEl = this._findAudioUiButtonByKey(sp.anchorBtnKey, sp.anchorBarId || '');
        if (btnEl && !this._isElementHiddenForReplayCursor(btnEl) && typeof btnEl.getBoundingClientRect === 'function') {
          const br = this._getStageElementRect(btnEl);
          if (br && br.width > 4 && br.height > 4) {
            let px = br.left + br.width * 0.5 - 8;
            let py = br.top - 36;
            if (br.top > sh * 0.62) {
              px = br.left + br.width * 0.5 - 8;
              py = br.top - 36;
            } else if (br.left < sw * 0.22) {
              px = br.right + 16;
              py = br.top + br.height * 0.5 - 10;
            } else if (br.right > sw * 0.78) {
              px = br.left - 38;
              py = br.top + br.height * 0.5 - 10;
            } else {
              px = br.left + br.width * 0.5 - 8;
              py = br.bottom + 14;
            }
            return clampStage(px, py);
          }
        }
      }
      const fx = (sp && typeof sp.fallbackX === 'number') ? sp.fallbackX : (sw * 0.5);
      const fy = (sp && typeof sp.fallbackY === 'number') ? sp.fallbackY : (sh * 0.5);
      return clampStage(fx, fy);
    }

    _ensurePlanBReplayData(syncData = this.audioSyncData) {
      if (!syncData || !Array.isArray(syncData.timeline)) return null;
      if (typeof this._expandAudioSyncData === 'function') {
        this._expandAudioSyncData(syncData);
      }
      const tl = syncData.timeline;
      const cacheKey = `vidraw4_${tl.length}_${Boolean(this.isStudentAudioVideoOnlyMode)}`;
      if (syncData._planBCache && syncData._planBCache.key === cacheKey) {
        return syncData._planBCache;
      }

      // 1. 원본 상태 키프레임 100% 무변형 추출 및 창(카드) 이동·리사이즈 구간(cardMotionSpans) 검출
      const stateEvents = [];
      if (syncData.initialState) {
        stateEvents.push({ t: 0, state: syncData.initialState });
      }
      for (let i = 0; i < tl.length; i++) {
        const ev = tl[i];
        if (ev && ev.type === 'state' && ev.state && typeof ev.t === 'number') {
          stateEvents.push({ t: ev.t, state: ev.state });
        }
      }

      const cardTracks = new Map();
      const pushTrackSample = (trackKey, meta, sIdx, t, sample) => {
        if (!cardTracks.has(trackKey)) {
          cardTracks.set(trackKey, { trackKey, ...meta, samples: [] });
        }
        cardTracks.get(trackKey).samples.push({ sIdx, t, ...sample });
      };

      for (let sIdx = 0; sIdx < stateEvents.length; sIdx++) {
        const { t, state: kf } = stateEvents[sIdx];
        if (!kf) continue;
        pushTrackSample('prob_main', { kind: 'prob_main', cardKey: kf.probCardUid || 'problemCardWidget' }, sIdx, t, {
          vis: Boolean(kf.probCardVisible && !kf.probCardMin),
          covered: Boolean(kf.isGraphCovered),
          x: kf.probCardBaseX,
          y: kf.probCardBaseY,
          mx: kf.probCardPdfAnchor ? kf.probCardPdfAnchor.mx : null,
          my: kf.probCardPdfAnchor ? kf.probCardPdfAnchor.my : null,
          w: kf.probCardW || 480
        });
        pushTrackSample('graph_main', { kind: 'graph_main', cardKey: kf.graphCardUid || 'graphCardWidget' }, sIdx, t, {
          vis: Boolean(kf.graphCardVisible && kf.isGraphCovered && !kf.graphCardMin),
          covered: Boolean(kf.isGraphCovered),
          x: kf.graphCardBaseX,
          y: kf.graphCardBaseY,
          mx: kf.graphCardPdfAnchor ? kf.graphCardPdfAnchor.mx : null,
          my: kf.graphCardPdfAnchor ? kf.graphCardPdfAnchor.my : null,
          w: kf.graphCardW || 360
        });
        if (Array.isArray(kf.extraGraphStates)) {
          kf.extraGraphStates.forEach((st, idx) => {
            if (!st) return;
            const tk = st.uid ? `eg_uid_${st.uid}` : `eg_idx_${idx}`;
            pushTrackSample(tk, { kind: 'extra_graph', uid: st.uid || null, idx, cardKey: st.uid || `graph_extra_${idx}` }, sIdx, t, {
              vis: Boolean(kf.isGraphCovered && !st.min),
              covered: Boolean(kf.isGraphCovered),
              x: st.baseX,
              y: st.baseY,
              mx: st.pdfAnchor ? st.pdfAnchor.mx : null,
              my: st.pdfAnchor ? st.pdfAnchor.my : null,
              w: st.w || 360
            });
          });
        }
        if (Array.isArray(kf.extraProbStates)) {
          kf.extraProbStates.forEach((st, idx) => {
            if (!st) return;
            const tk = st.uid ? `ep_uid_${st.uid}` : `ep_idx_${idx}`;
            pushTrackSample(tk, { kind: 'extra_prob', uid: st.uid || null, idx, cardKey: st.uid || `problem_extra_${idx}` }, sIdx, t, {
              vis: Boolean(kf.isGraphCovered && !st.min),
              covered: Boolean(kf.isGraphCovered),
              x: st.baseX,
              y: st.baseY,
              mx: st.pdfAnchor ? st.pdfAnchor.mx : null,
              my: st.pdfAnchor ? st.pdfAnchor.my : null,
              w: st.w || 480
            });
          });
        }
      }

      const cardMotionSpans = [];
      cardTracks.forEach(track => {
        const arr = track.samples;
        if (arr.length < 2) return;
        const rawSegs = [];
        for (let i = 1; i < arr.length; i++) {
          const a = arr[i - 1];
          const b = arr[i];
          const dt = b.t - a.t;
          if (!a.vis || !b.vis || a.covered !== b.covered || dt <= 0 || dt > 620) continue;
          const dx = (typeof a.x === 'number' && typeof b.x === 'number') ? (b.x - a.x) : 0;
          const dy = (typeof a.y === 'number' && typeof b.y === 'number') ? (b.y - a.y) : 0;
          const dmx = (typeof a.mx === 'number' && typeof b.mx === 'number') ? (b.mx - a.mx) * 95 : 0;
          const dmy = (typeof a.my === 'number' && typeof b.my === 'number') ? (b.my - a.my) * 95 : 0;
          const dw = Math.abs((b.w || 0) - (a.w || 0));
          const posMove = Math.max(Math.hypot(dx, dy), Math.hypot(dmx, dmy));
          if (posMove >= 0.75 || dw >= 1.1) {
            rawSegs.push({ i0: i - 1, i1: i, t0: a.t, t1: b.t, isResize: dw >= 1.5, isDrag: posMove >= 0.75 });
          }
        }
        for (let s = 0; s < rawSegs.length; s++) {
          const cur = { ...rawSegs[s] };
          while (s + 1 < rawSegs.length) {
            const nxt = rawSegs[s + 1];
            const pauseGap = nxt.t0 - cur.t1;
            const mergedDur = nxt.t1 - cur.t0;
            if (pauseGap <= 95 && mergedDur <= 4000 && arr[cur.i1].covered === arr[nxt.i0].covered) {
              cur.i1 = nxt.i1;
              cur.t1 = nxt.t1;
              cur.isResize = cur.isResize || nxt.isResize;
              cur.isDrag = cur.isDrag || nxt.isDrag;
              s++;
            } else {
              break;
            }
          }
          const sub = arr.slice(cur.i0, cur.i1 + 1);
          let pathLen = 0;
          for (let k = 1; k < sub.length; k++) {
            const pA = sub[k - 1];
            const pB = sub[k];
            const stepPx = (typeof pA.mx === 'number' && typeof pB.mx === 'number')
              ? Math.hypot((pB.mx - pA.mx) * 95, (pB.my - pA.my) * 95)
              : Math.hypot((pB.x || 0) - (pA.x || 0), (pB.y || 0) - (pA.y || 0));
            pathLen += stepPx;
          }
          const firstS = sub[0];
          const lastS = sub[sub.length - 1];
          const netPx = (typeof firstS.mx === 'number' && typeof lastS.mx === 'number')
            ? Math.hypot((lastS.mx - firstS.mx) * 95, (lastS.my - firstS.my) * 95)
            : Math.hypot((lastS.x || 0) - (firstS.x || 0), (lastS.y || 0) - (firstS.y || 0));
          const netW = Math.abs((lastS.w || 0) - (firstS.w || 0));
          if (pathLen < 2 && netW < 2) continue;

          cardMotionSpans.push({
            trackKey: track.trackKey,
            kind: track.kind,
            uid: track.uid || null,
            idx: typeof track.idx === 'number' ? track.idx : -1,
            cardKey: track.cardKey,
            tStart: cur.t0,
            tEnd: cur.t1,
            isResize: Boolean(netW >= 6 && cur.isResize && netPx < netW * 1.35),
            isDrag: Boolean(cur.isDrag || netPx >= 4),
            gripRx: null,
            gripOffsetY: null,
            _lastLiveCursorPos: null
          });
        }
      });

      // 2. 도형 팝오버(#inkShapesPopover)·스텔스 카드 헤더·카드 대칭 메뉴 선행 표시 구간 컴파일
      const rawCursors = [];
      for (let i = 0; i < tl.length; i++) {
        const ev = tl[i];
        if (ev && ev.type === 'cursor' && typeof ev.t === 'number') {
          rawCursors.push(ev);
        }
      }

      const mergeTimeSpans = (spans, mergeGap = 420) => {
        if (!spans.length) return [];
        const sorted = spans.slice().sort((a, b) => {
          const ka = a.targetKey || '';
          const kb = b.targetKey || '';
          if (ka !== kb) return ka < kb ? -1 : 1;
          return a.tStart - b.tStart;
        });
        const out = [{ ...sorted[0] }];
        for (let i = 1; i < sorted.length; i++) {
          const prev = out[out.length - 1];
          const cur = sorted[i];
          if ((prev.targetKey || '') === (cur.targetKey || '') && cur.tStart <= prev.tEnd + mergeGap) {
            prev.tEnd = Math.max(prev.tEnd, cur.tEnd);
            if (cur.anchorX && !prev.anchorX) {
              prev.anchorX = cur.anchorX;
              prev.anchorY = cur.anchorY;
            }
          } else {
            out.push({ ...cur });
          }
        }
        return out;
      };

      const rawShapesSpans = [];
      for (let i = 0; i < rawCursors.length; i++) {
        const ev = rawCursors[i];
        if (ev.uiBarId === 'inkShapesPopover' || (ev.uiBtnKey && ev.uiBtnKey.startsWith('id:btnShapePop'))) {
          rawShapesSpans.push({ tStart: Math.max(0, ev.t - 230), tEnd: ev.t + 170, anchorX: ev.x, anchorY: ev.y });
        }
      }
      for (let i = 0; i < stateEvents.length; i++) {
        const se = stateEvents[i];
        if (se.state && se.state.inkShapesPopOpen) {
          const nextT = (i + 1 < stateEvents.length) ? stateEvents[i + 1].t : (se.t + 320);
          rawShapesSpans.push({ tStart: Math.max(0, se.t - 160), tEnd: nextT + 80 });
        }
      }
      const shapesPopoverSpans = mergeTimeSpans(rawShapesSpans, 420);
      const isNearShapesSpan = (tMs) => shapesPopoverSpans.some(sp => tMs >= sp.tStart - 80 && tMs <= sp.tEnd + 80);

      const rawPeekSpans = [];
      const rawCardSymSpans = [];
      cardMotionSpans.forEach(sp => {
        rawPeekSpans.push({ targetKey: sp.cardKey || 'any', tStart: Math.max(0, sp.tStart - 240), tEnd: sp.tEnd + 280 });
      });
      for (let i = 0; i < rawCursors.length; i++) {
        const ev = rawCursors[i];
        if (!ev.uiScreen) continue;
        const barId = ev.uiBarId || '';
        const btnKey = ev.uiBtnKey || '';
        const isCardBar = Boolean(
          barId === 'problemCardWidget' ||
          barId === 'graphCardWidget' ||
          barId === 'problem_main' ||
          barId === 'graph_main' ||
          barId.startsWith('prob_') ||
          barId.startsWith('graph_') ||
          barId.startsWith('extra-')
        );
        const isCardBtn = Boolean(
          btnKey.startsWith('pipAct:') ||
          btnKey.startsWith('id:btnProblemCard') ||
          btnKey.startsWith('id:btnGraphCard') ||
          btnKey.startsWith('id:problemCard') ||
          btnKey.startsWith('id:graphCard')
        );
        const matchedMotion = !barId
          ? cardMotionSpans.find(sp => ev.t >= sp.tStart - 100 && ev.t <= sp.tEnd + 100)
          : null;
        const isLegacyCardHdr = Boolean(
          !barId &&
          !isNearShapesSpan(ev.t) &&
          (ev.cursorKind === 'grab' || ev.cursorKind === 'grabbing' || ev.cursorKind === 'nwse-resize') &&
          this._classifyReplaySpecialUiEvent(ev, cardMotionSpans, isNearShapesSpan) === 'normal'
        );
        if (isCardBar || isCardBtn || isLegacyCardHdr) {
          rawPeekSpans.push({
            targetKey: barId || (matchedMotion && matchedMotion.cardKey) || 'any',
            tStart: Math.max(0, ev.t - 250),
            tEnd: ev.t + 300,
            anchorX: ev.x,
            anchorY: ev.y
          });
        }
        if (
          btnKey === 'pipAct:flipX' ||
          btnKey === 'pipAct:flipY' ||
          btnKey === 'pipAct:flipOrigin' ||
          btnKey === 'pipAct:flipYX' ||
          btnKey === 'pipAct:unlinkInverse' ||
          btnKey === 'pipAct:symMenu'
        ) {
          rawCardSymSpans.push({
            targetKey: barId || 'any_graph',
            tStart: Math.max(0, ev.t - 230),
            tEnd: ev.t + 160
          });
        }
      }
      const cardHeaderPeekSpans = mergeTimeSpans(rawPeekSpans, 480);
      const cardSymPopoverSpans = mergeTimeSpans(rawCardSymSpans, 380);

      // 카드 드래그 시점의 초기 그립 위치(헤더/바디 상대 위치) 추출
      cardMotionSpans.forEach(sp => {
        for (let i = 0; i < rawCursors.length; i++) {
          const ev = rawCursors[i];
          if (ev.t < sp.tStart - 80) continue;
          if (ev.t > sp.tEnd + 60) break;
          if (ev.cardKey && typeof ev.nx === 'number' && typeof ev.ny === 'number' && (ev.cursorKind === 'grabbing' || ev.cursorKind === 'grab' || ev.isDrawing)) {
            sp.gripBodyNx = Math.max(0.05, Math.min(0.95, ev.nx));
            sp.gripBodyNy = Math.max(0.04, Math.min(0.96, ev.ny));
            break;
          }
          if (ev.uiScreen && (ev.cursorKind === 'grabbing' || ev.cursorKind === 'grab')) {
            const kf = this._findNearestRawStateAt(syncData, ev.t);
            let cLeft = null;
            let cTop = null;
            let cW = 380;
            if (kf) {
              if (sp.kind === 'prob_main') { cLeft = kf.probCardBaseX; cTop = kf.probCardBaseY; cW = kf.probCardW || 480; }
              else if (sp.kind === 'graph_main') { cLeft = kf.graphCardBaseX; cTop = kf.graphCardBaseY; cW = kf.graphCardW || 360; }
              else if (sp.kind === 'extra_graph' && Array.isArray(kf.extraGraphStates)) {
                const st = sp.uid ? kf.extraGraphStates.find(c => c && c.uid === sp.uid) : kf.extraGraphStates[sp.idx];
                if (st) { cLeft = st.baseX; cTop = st.baseY; cW = st.w || 360; }
              } else if (sp.kind === 'extra_prob' && Array.isArray(kf.extraProbStates)) {
                const st = sp.uid ? kf.extraProbStates.find(c => c && c.uid === sp.uid) : kf.extraProbStates[sp.idx];
                if (st) { cLeft = st.baseX; cTop = st.baseY; cW = st.w || 480; }
              }
            }
            if (typeof cLeft === 'number' && typeof cTop === 'number' && cW > 80) {
              sp.gripRx = Math.max(0.12, Math.min(0.88, (ev.x - cLeft) / cW));
              sp.gripOffsetY = Math.max(8, Math.min(30, ev.y - cTop));
            }
            break;
          }
        }
      });

      // 3. 순정 무변형 커서 파이프라인 + 비노출 보조 서랍 진입 시 B-1 돋보기 탐색 포인터(search) 변환:
      //    - 실제 캔버스/서랍/툴바/카드 위 이동 샘플은 좌표 변형 0%, 생략 0%로 원본 그대로 유지!
      //    - 비노출 보조 서랍(#inkClipsPopover·#modalSaveInkClip·슬라이드 그리드·내보내기·알림 모달)은
      //      (A) 상태 키프레임(unrenderedPopupKind: 비로그인/아이패드 무커서/단축키 K 오픈 포함) 및
      //      (B) 팝업 내부 커서 샘플(search_popup: 구버전 녹화본 및 핀 고정 재진입 포함) 양쪽에서 검출하여
      //      진입 버튼 옆에 정박하는 돋보기 탐색 웨이포인트로 치환!
      const POPUP_TRIGGER_BTNS = {
        'id:btnInkClips': true,
        'id:btnPillClips': true,
        'id:btnLassoSaveClip': true,
        'id:btnQuickExport': true
      };
      const rawPopupIntervals = [];

      // 3-A) 상태 키프레임 기반 팝업 오픈 구간 추출 (비로그인 빈 내 클립·펜슬 무호버 대응 + 핀 고정 중 캔버스 필기 시 자동 종료)
      let activeStatePop = null;
      for (let i = 0; i < stateEvents.length; i++) {
        const se = stateEvents[i];
        const pKind = (se && se.state && se.state.unrenderedPopupKind) || null;
        if (pKind) {
          if (!activeStatePop) {
            activeStatePop = { kind: pKind, tOpen: se.t };
          } else if (activeStatePop.kind !== pKind) {
            rawPopupIntervals.push({ kind: activeStatePop.kind, tOpen: activeStatePop.tOpen, tClose: se.t, fromState: true });
            activeStatePop = { kind: pKind, tOpen: se.t };
          }
        } else if (activeStatePop) {
          rawPopupIntervals.push({ kind: activeStatePop.kind, tOpen: activeStatePop.tOpen, tClose: se.t, fromState: true });
          activeStatePop = null;
        }
      }
      if (activeStatePop) {
        const fallbackEnd = Math.max(activeStatePop.tOpen + 400, Number(syncData.durationMs) || 0);
        rawPopupIntervals.push({ kind: activeStatePop.kind, tOpen: activeStatePop.tOpen, tClose: fallbackEnd, fromState: true });
      }
      for (let i = rawPopupIntervals.length - 1; i >= 0; i--) {
        const iv = rawPopupIntervals[i];
        for (let c = 0; c < rawCursors.length; c++) {
          const cev = rawCursors[c];
          if (!cev || cev.t <= iv.tOpen + 80) continue;
          if (cev.t >= iv.tClose - 20) break;
          if (!cev.isDrawing) continue;
          if (cev.uiBtnKey && POPUP_TRIGGER_BTNS[cev.uiBtnKey]) continue;
          const cCls = this._classifyReplaySpecialUiEvent(cev, cardMotionSpans, isNearShapesSpan);
          if (cCls === 'normal') {
            iv.tClose = cev.t - 20;
            break;
          }
        }
        if (iv.tClose - iv.tOpen < 160) {
          rawPopupIntervals.splice(i, 1);
        }
      }

      // 3-B) 커서 기반 search_popup 연속 구간 추출 (구버전 녹화본 호환 및 핀 고정된 내 클립 재방문 대응)
      let scanIdx = 0;
      while (scanIdx < rawCursors.length) {
        const ev = rawCursors[scanIdx];
        const cls = this._classifyReplaySpecialUiEvent(ev, cardMotionSpans, isNearShapesSpan);
        if (cls !== 'search_popup') {
          scanIdx++;
          continue;
        }
        const runStart = scanIdx;
        let runEnd = scanIdx;
        let hasClick = Boolean(ev.isDrawing);
        let pBarId = ev.uiBarId || '';
        let pBtnKey = ev.uiBtnKey || '';
        scanIdx++;
        while (scanIdx < rawCursors.length) {
          const nxt = rawCursors[scanIdx];
          const nxtCls = this._classifyReplaySpecialUiEvent(nxt, cardMotionSpans, isNearShapesSpan);
          if (nxtCls === 'search_popup') {
            runEnd = scanIdx;
            if (nxt.isDrawing) hasClick = true;
            if (!pBarId && nxt.uiBarId) pBarId = nxt.uiBarId;
            if (!pBtnKey && nxt.uiBtnKey) pBtnKey = nxt.uiBtnKey;
            scanIdx++;
          } else if (nxtCls === 'record_ctrl') {
            scanIdx++;
          } else {
            break;
          }
        }
        let prevNormalT = rawCursors[runStart].t;
        for (let p = runStart - 1; p >= 0; p--) {
          if (this._classifyReplaySpecialUiEvent(rawCursors[p], cardMotionSpans, isNearShapesSpan) === 'normal') {
            prevNormalT = rawCursors[p].t;
            break;
          }
        }
        const nextNormalT = scanIdx < rawCursors.length ? rawCursors[scanIdx].t : (rawCursors[runEnd].t + 400);
        if (!hasClick && (nextNormalT - prevNormalT) < 240) continue;

        let inferredKind = 'modal';
        if (pBarId === 'inkClipsPopover' || (pBtnKey && pBtnKey.indexOf('InkClips') !== -1)) {
          const nearKf = this._findNearestRawStateAt(syncData, rawCursors[runStart].t);
          inferredKind = (nearKf && (nearKf.unrenderedPopupKind === 'inkClips_pill' || nearKf.pillRemoteOpen)) ? 'inkClips_pill' : 'inkClips';
        } else if (pBarId === 'modalSaveInkClip' || (pBtnKey && pBtnKey.indexOf('SaveInkClip') !== -1)) {
          inferredKind = 'saveClip';
        } else if (pBarId === 'panelQuickExport') {
          inferredKind = 'quickExport';
        } else if (pBarId === 'pdfBoardGridPopover' || pBarId === 'playlistGridPopover' || pBarId === 'playlistAddSlideMenu') {
          inferredKind = 'slideGrid';
        }
        rawPopupIntervals.push({
          kind: inferredKind,
          tOpen: rawCursors[runStart].t,
          tClose: Math.max(rawCursors[runEnd].t, Math.min(nextNormalT - 40, rawCursors[runStart].t + 320)),
          fromState: false
        });
      }

      rawPopupIntervals.sort((a, b) => a.tOpen - b.tOpen);
      const mergedPopupIntervals = [];
      for (let i = 0; i < rawPopupIntervals.length; i++) {
        const cur = rawPopupIntervals[i];
        const last = mergedPopupIntervals.length > 0 ? mergedPopupIntervals[mergedPopupIntervals.length - 1] : null;
        if (last && cur.tOpen <= last.tClose + 140) {
          last.tClose = Math.max(last.tClose, cur.tClose);
          if (last.kind === 'modal' && cur.kind !== 'modal') last.kind = cur.kind;
          if (cur.kind === 'inkClips_pill') last.kind = 'inkClips_pill';
        } else {
          mergedPopupIntervals.push({ ...cur });
        }
      }

      const cursorEvents = [];
      const searchSpans = [];
      let cIdx = 0;
      const pushNormalCursorIfValid = (ev) => {
        const cls = this._classifyReplaySpecialUiEvent(ev, cardMotionSpans, isNearShapesSpan);
        if (cls === 'record_ctrl' || cls === 'search_popup') return;
        cursorEvents.push(ev);
      };

      for (let pIdx = 0; pIdx < mergedPopupIntervals.length; pIdx++) {
        const iv = mergedPopupIntervals[pIdx];
        while (cIdx < rawCursors.length) {
          const ev = rawCursors[cIdx];
          const isLateTriggerPress = Boolean(
            ev.t <= iv.tOpen + 45 &&
            ev.isDrawing &&
            ev.uiBtnKey &&
            POPUP_TRIGGER_BTNS[ev.uiBtnKey]
          );
          if (ev.t < iv.tOpen || isLateTriggerPress) {
            pushNormalCursorIfValid(ev);
            cIdx++;
          } else {
            break;
          }
        }

        let firstAbsorbedEv = null;
        while (cIdx < rawCursors.length && rawCursors[cIdx].t <= iv.tClose) {
          if (!firstAbsorbedEv) firstAbsorbedEv = rawCursors[cIdx];
          cIdx++;
        }

        let nextVisEv = null;
        for (let look = cIdx; look < rawCursors.length; look++) {
          const cand = rawCursors[look];
          const candCls = this._classifyReplaySpecialUiEvent(cand, cardMotionSpans, isNearShapesSpan);
          if (candCls === 'normal') {
            nextVisEv = cand;
            break;
          }
        }

        const prevVisEv = cursorEvents.length > 0 ? cursorEvents[cursorEvents.length - 1] : null;
        let anchorBtnKey = '';
        let anchorBarId = '';
        if (iv.kind === 'inkClips_pill') {
          anchorBtnKey = 'id:btnPillClips';
          anchorBarId = 'quickPillRemote';
        } else if (iv.kind === 'inkClips') {
          if (prevVisEv && prevVisEv.uiBtnKey === 'id:btnPillClips') {
            anchorBtnKey = 'id:btnPillClips';
            anchorBarId = 'quickPillRemote';
          } else {
            anchorBtnKey = 'id:btnInkClips';
            anchorBarId = 'inkFloatingToolbar';
          }
        } else if (iv.kind === 'saveClip') {
          anchorBtnKey = 'id:btnLassoSaveClip';
          anchorBarId = 'lassoActionFloatingBar';
        } else if (iv.kind === 'quickExport') {
          anchorBtnKey = 'id:btnQuickExport';
          anchorBarId = 'rightActionToolbar';
        } else if (prevVisEv && prevVisEv.uiScreen && prevVisEv.uiBtnKey) {
          anchorBtnKey = prevVisEv.uiBtnKey;
          anchorBarId = prevVisEv.uiBarId || '';
        }

        const fallbackX = (prevVisEv && typeof prevVisEv.x === 'number')
          ? prevVisEv.x
          : ((firstAbsorbedEv && typeof firstAbsorbedEv.x === 'number') ? firstAbsorbedEv.x : 720);
        const fallbackY = (prevVisEv && typeof prevVisEv.y === 'number')
          ? (prevVisEv.y - 28)
          : ((firstAbsorbedEv && typeof firstAbsorbedEv.y === 'number') ? firstAbsorbedEv.y : 450);

        const prevT = (prevVisEv && typeof prevVisEv.t === 'number') ? prevVisEv.t : iv.tOpen;
        const rawOpenBase = Math.max(prevT, iv.tOpen);
        const spanStart = (iv.tClose - rawOpenBase >= 220)
          ? Math.min(iv.tClose - 60, rawOpenBase + 135)
          : Math.max(prevT + 40, iv.tOpen);

        const hasCloseNextVis = Boolean(nextVisEv && typeof nextVisEv.t === 'number' && (nextVisEv.t - iv.tClose) <= 520);
        let spanEnd = iv.tClose;
        if (hasCloseNextVis) {
          spanEnd = Math.max(spanStart, Math.min(iv.tClose, nextVisEv.t - 340));
        } else {
          spanEnd = Math.max(spanStart + 160, iv.tClose);
        }

        const spObj = {
          tStart: spanStart,
          tEnd: spanEnd,
          anchorBtnKey,
          anchorBarId,
          fallbackX,
          fallbackY
        };
        searchSpans.push(spObj);
        const ptTag = (prevVisEv && prevVisEv.pt) || (firstAbsorbedEv && firstAbsorbedEv.pt) || (nextVisEv && nextVisEv.pt) || 'm';
        const baseColor = (prevVisEv && prevVisEv.color) || '#0f172a';

        cursorEvents.push({
          t: spanStart,
          type: 'cursor',
          x: fallbackX,
          y: fallbackY,
          color: baseColor,
          isDrawing: false,
          cursorKind: 'search',
          uiScreen: true,
          isSearchAnchor: true,
          searchSpan: spObj,
          pt: ptTag
        });
        if (spanEnd > spanStart + 16) {
          cursorEvents.push({
            t: spanEnd,
            type: 'cursor',
            x: fallbackX,
            y: fallbackY,
            color: baseColor,
            isDrawing: false,
            cursorKind: 'search',
            uiScreen: true,
            isSearchAnchor: true,
            searchSpan: spObj,
            pt: ptTag
          });
        }

        // 팝업이 닫힌 뒤 한참(>520ms) 동안 후속 커서 이동이 없는 경우(ESC 닫기·클립 소환 후 설명 등):
        // 돋보기가 허공에 계속 남아 있지 않도록 닫힘 직후 기본 포인터로 자연스럽게 복귀!
        if (!hasCloseNextVis) {
          const maxSettleT = (nextVisEv && typeof nextVisEv.t === 'number') ? (nextVisEv.t - 80) : ((Number(syncData.durationMs) || (spanEnd + 400)));
          const settleT = Math.min(maxSettleT, spanEnd + 240);
          if (settleT > spanEnd + 60) {
            const closeKf = this._findNearestRawStateAt(syncData, iv.tClose + 30);
            let settleKind = 'arrow';
            let settleColor = (closeKf && closeKf.currentInkColor) || baseColor;
            const settleOnUi = Boolean(prevVisEv && prevVisEv.uiScreen);
            if (!settleOnUi && closeKf && closeKf.inkMode) {
              const tlTool = closeKf.activeInkTool || 'pen';
              if (tlTool === 'eraser') settleKind = 'eraser';
              else if (tlTool === 'highlighter') settleKind = 'highlighter';
              else if (tlTool === 'laser') settleKind = 'laser';
              else if (tlTool === 'lasso' || tlTool === 'sticker') settleKind = 'crosshair';
              else if (tlTool === 'pen') settleKind = closeKf.isPenDashed ? 'pen_dashed' : 'pen';
            }
            cursorEvents.push({
              t: settleT,
              type: 'cursor',
              x: (prevVisEv && typeof prevVisEv.x === 'number') ? prevVisEv.x : fallbackX,
              y: (prevVisEv && typeof prevVisEv.y === 'number') ? prevVisEv.y : (fallbackY + 28),
              color: settleColor,
              isDrawing: false,
              cursorKind: settleKind,
              uiScreen: settleOnUi,
              uiBarId: settleOnUi ? ((prevVisEv && prevVisEv.uiBarId) || '') : '',
              uiBtnKey: '',
              pt: ptTag
            });
          }
        }
      }

      while (cIdx < rawCursors.length) {
        pushNormalCursorIfValid(rawCursors[cIdx]);
        cIdx++;
      }

      const cache = {
        key: cacheKey,
        stateEvents,
        cursorEvents,
        searchSpans,
        cardMotionSpans,
        shapesPopoverSpans,
        cardHeaderPeekSpans,
        cardSymPopoverSpans
      };
      try {
        Object.defineProperty(syncData, '_planBCache', {
          value: cache,
          configurable: true,
          writable: true,
          enumerable: false
        });
      } catch (_) { }
      return cache;
    }

    _getLiveCardElementForMotionSpan(sp) {
      if (!sp || typeof document === 'undefined') return null;
      if (sp.kind === 'prob_main') return document.getElementById('problemCardWidget');
      if (sp.kind === 'graph_main') return document.getElementById('graphCardWidget');
      if (sp.kind === 'extra_graph' && Array.isArray(this.extraGraphCards)) {
        const hit = sp.uid
          ? this.extraGraphCards.find(c => c && (c.cardUid === sp.uid || (c.el && c.el._cardUid === sp.uid)))
          : this.extraGraphCards[sp.idx];
        return (hit && hit.el) || null;
      }
      if (sp.kind === 'extra_prob' && Array.isArray(this.extraProblemCards)) {
        const hit = sp.uid
          ? this.extraProblemCards.find(c => c && (c.cardUid === sp.uid || (c.el && c.el._cardUid === sp.uid)))
          : this.extraProblemCards[sp.idx];
        return (hit && hit.el) || null;
      }
      return this.getCardElementByAudioKey(sp.cardKey);
    }

    _resolvePlanBActiveCardDragCursorAt(playMs) {
      const cache = this._ensurePlanBReplayData(this.audioSyncData);
      if (!cache || !Array.isArray(cache.cardMotionSpans) || cache.cardMotionSpans.length === 0) return null;
      const cList = Array.isArray(cache.cursorEvents) ? cache.cursorEvents : [];
      let nearCur = null;
      for (let i = 0; i < cList.length; i++) {
        const ev = cList[i];
        if (!ev) continue;
        if (ev.t <= playMs + 24) nearCur = ev;
        else break;
      }
      const isActivelyGrabbing = Boolean(
        nearCur &&
        Math.abs(playMs - nearCur.t) <= 220 &&
        nearCur.isDrawing &&
        (nearCur.cursorKind === 'grabbing' || nearCur.cursorKind === 'grab' || nearCur.cursorKind === 'nwse-resize')
      );
      if (!isActivelyGrabbing) return null;

      for (let i = 0; i < cache.cardMotionSpans.length; i++) {
        const sp = cache.cardMotionSpans[i];
        if (!sp || playMs < sp.tStart || playMs > sp.tEnd) continue;
        const cardEl = this._getLiveCardElementForMotionSpan(sp);
        if (!cardEl || cardEl.style.display === 'none') continue;
        const r = this._getStageElementRect(cardEl);
        if (!r || r.width < 20 || r.height < 20) continue;

        let cx = r.left + r.width * 0.5;
        let cy = r.top + 16;
        let kind = 'grabbing';

        if (sp.isResize) {
          cx = r.right - 5;
          cy = r.bottom - 5;
          kind = 'nwse-resize';
        } else if (typeof sp.gripBodyNx === 'number' && typeof sp.gripBodyNy === 'number' && !cardEl.classList.contains('minimized')) {
          const bodyEl = cardEl.querySelector('.problem-card-body');
          const br = bodyEl ? this._getStageElementRect(bodyEl) : null;
          if (br && br.width > 10 && br.height > 10) {
            cx = br.left + sp.gripBodyNx * br.width;
            cy = br.top + sp.gripBodyNy * br.height;
          }
        } else {
          const hdrEl = cardEl.querySelector('.problem-card-header');
          const hr = hdrEl ? this._getStageElementRect(hdrEl) : null;
          const rx = typeof sp.gripRx === 'number' ? sp.gripRx : 0.42;
          if (hr && hr.width > 20 && hr.height > 8) {
            cx = hr.left + rx * hr.width;
            cy = hr.top + hr.height * 0.5;
          } else {
            cx = r.left + rx * r.width;
            cy = r.top + (typeof sp.gripOffsetY === 'number' ? sp.gripOffsetY : 16);
          }
        }

        sp._lastLiveCursorPos = { x: cx, y: cy, t: playMs };
        return {
          x: cx,
          y: cy,
          color: this.currentInkColor || '#00d2d3',
          isDrawing: true,
          isLaser: false,
          cursorKind: kind,
          uiScreen: true,
          uiBarId: sp.cardKey || '',
          uiBtnKey: ''
        };
      }
      return null;
    }

    _syncPlanBReplayContextPopoversAt(playMs) {
      if (typeof document === 'undefined') return;
      const cache = this._ensurePlanBReplayData(this.audioSyncData);
      const kf = this._currentAppliedAudioKeyframe || null;

      // 1) 도형 5종 팝오버(#inkShapesPopover) 자동 오픈 및 정밀 위치 동기화
      const shapesPop = document.getElementById('inkShapesPopover');
      const btnShapes = document.getElementById('btnInkShapes');
      const activeShapeSpan = cache && Array.isArray(cache.shapesPopoverSpans)
        ? cache.shapesPopoverSpans.find(sp => playMs >= sp.tStart && playMs <= sp.tEnd)
        : null;
      if (shapesPop) {
        if (activeShapeSpan) {
          const dockPos = (kf && kf.inkDockPos) || this.inkDockPosition || 'bottom';
          const isVerticalDock = (dockPos === 'left' || dockPos === 'right');
          shapesPop.classList.toggle('is-vertical-stream', isVerticalDock);
          const curShape = (kf && kf.quickShapeMode) || this.quickShapeMode || null;
          shapesPop.querySelectorAll('.ink-shape-pop-btn[data-shape]').forEach(b => {
            b.classList.toggle('active', Boolean(curShape && b.dataset.shape === curShape));
          });
          shapesPop.style.display = 'flex';
          shapesPop._replayShapesForcedOpen = true;
          if (btnShapes) btnShapes.classList.add('is-popover-open');

          const isFixedStage = this._isFixedReplayStageActive();
          const sw = isFixedStage ? (this.screenWidth || 1440) : (window.innerWidth || this.screenWidth || 1440);
          const sh = isFixedStage ? (this.screenHeight || 900) : (window.innerHeight || this.screenHeight || 900);
          const popRect = this._getStageElementRect(shapesPop);
          const popW = (popRect && popRect.width > 20) ? popRect.width : (isVerticalDock ? 44 : 196);
          const popH = (popRect && popRect.height > 20) ? popRect.height : (isVerticalDock ? 196 : 44);
          let left = (typeof activeShapeSpan.anchorX === 'number') ? (activeShapeSpan.anchorX - popW * 0.5) : ((sw - popW) * 0.5);
          let top = (typeof activeShapeSpan.anchorY === 'number') ? (activeShapeSpan.anchorY - popH * 0.5) : (sh - popH - 80);

          if (btnShapes && !this._isElementHiddenForReplayCursor(btnShapes)) {
            const br = this._getStageElementRect(btnShapes);
            if (br && br.width > 4 && br.height > 4) {
              if (dockPos === 'left') {
                left = br.right + 10;
                top = br.top + br.height * 0.5 - popH * 0.5;
              } else if (dockPos === 'right') {
                left = br.left - popW - 10;
                top = br.top + br.height * 0.5 - popH * 0.5;
              } else {
                left = br.left + br.width * 0.5 - popW * 0.5;
                top = br.top - popH - 10;
              }
            }
          }
          left = Math.max(10, Math.min(sw - popW - 10, left));
          top = Math.max(52, Math.min(sh - popH - 10, top));
          shapesPop.style.left = `${Math.round(left)}px`;
          shapesPop.style.top = `${Math.round(top)}px`;
        } else if (shapesPop._replayShapesForcedOpen) {
          shapesPop._replayShapesForcedOpen = false;
          shapesPop.style.display = 'none';
          if (btnShapes) btnShapes.classList.remove('is-popover-open');
        }
      }

      // 2) 스텔스 잠금 카드 헤더(.pip-stealth-locked) 선행 기상 & 카드 대칭 팝오버(.pip-hdr-popover) 연동
      const cardEntries = [
        {
          el: document.getElementById('problemCardWidget'),
          keys: ['problemCardWidget', 'problem_main', kf && kf.probCardUid].filter(Boolean),
          baseStealth: Boolean(kf && kf.probCardStealth),
          isGraph: false
        },
        {
          el: document.getElementById('graphCardWidget'),
          keys: ['graphCardWidget', 'graph_main', kf && kf.graphCardUid].filter(Boolean),
          baseStealth: Boolean(kf && kf.graphCardStealth),
          isGraph: true
        },
        ...((this.extraProblemCards || []).map((c, idx) => {
          const st = (kf && Array.isArray(kf.extraProbStates))
            ? (c && c.cardUid ? kf.extraProbStates.find(s => s && s.uid === c.cardUid) : kf.extraProbStates[idx])
            : null;
          return {
            el: c && c.el,
            keys: [`problem_extra_${idx}`, c && c.cardUid, c && c.el && c.el.id].filter(Boolean),
            baseStealth: Boolean(st && st.stealth),
            isGraph: false
          };
        })),
        ...((this.extraGraphCards || []).map((c, idx) => {
          const st = (kf && Array.isArray(kf.extraGraphStates))
            ? (c && c.cardUid ? kf.extraGraphStates.find(s => s && s.uid === c.cardUid) : kf.extraGraphStates[idx])
            : null;
          return {
            el: c && c.el,
            keys: [`graph_extra_${idx}`, c && c.cardUid, c && c.el && c.el.id].filter(Boolean),
            baseStealth: Boolean(st && st.stealth),
            isGraph: true
          };
        }))
      ];

      cardEntries.forEach(entry => {
        const el = entry.el;
        if (!el || el.style.display === 'none') return;
        const shouldPeek = Boolean(cache && Array.isArray(cache.cardHeaderPeekSpans) && cache.cardHeaderPeekSpans.some(sp => {
          if (playMs < sp.tStart || playMs > sp.tEnd) return false;
          if (entry.keys.includes(sp.targetKey)) return true;
          if (sp.targetKey === 'any' && typeof sp.anchorX === 'number' && typeof sp.anchorY === 'number') {
            const cr = this._getStageElementRect(el);
            return Boolean(cr && sp.anchorX >= cr.left - 18 && sp.anchorX <= cr.right + 18 && sp.anchorY >= cr.top - 12 && sp.anchorY <= cr.top + 44);
          }
          return false;
        }));

        if (shouldPeek) {
          if (el.classList.contains('pip-stealth-locked')) {
            el._replayPeekForcedOpen = true;
            el.classList.remove('pip-stealth-locked');
          }
        } else if (el._replayPeekForcedOpen) {
          el._replayPeekForcedOpen = false;
          el.classList.toggle('pip-stealth-locked', entry.baseStealth);
        }

        if (entry.isGraph) {
          const symPop = el.querySelector('.pip-hdr-popover');
          const symBtn = el.querySelector('[data-pip-act="symMenu"]');
          if (symPop) {
            const shouldOpenSym = Boolean(cache && Array.isArray(cache.cardSymPopoverSpans) && cache.cardSymPopoverSpans.some(sp => {
              if (playMs < sp.tStart || playMs > sp.tEnd) return false;
              return sp.targetKey === 'any_graph' || entry.keys.includes(sp.targetKey);
            }));
            if (shouldOpenSym) {
              symPop._replaySymForcedOpen = true;
              symPop.classList.add('is-open');
              symPop.style.display = 'flex';
              if (symBtn) symBtn.classList.add('active');
            } else if (symPop._replaySymForcedOpen) {
              symPop._replaySymForcedOpen = false;
              symPop.classList.remove('is-open');
              symPop.style.display = 'none';
              if (symBtn) symBtn.classList.remove('active');
            }
          }
        }
      });
    }

    _isPlanBUiTargetCurrentlyHidden(ev) {
      if (!ev || !ev.uiScreen || ev.isSearchAnchor) return false;
      if (ev.uiBtnKey) {
        const btnEl = this._findAudioUiButtonByKey(ev.uiBtnKey, ev.uiBarId);
        if (btnEl && this._isElementHiddenForReplayCursor(btnEl)) {
          return true;
        }
      }
      if (ev.uiBarId) {
        const barEl = this._resolveAudioUiBarElement(ev.uiBarId);
        if (barEl && this._isElementHiddenForReplayCursor(barEl)) {
          return true;
        }
      }
      return false;
    }

    _applyAudioTimelineStateAt(playMs) {
      if (!this.audioSyncData) return;
      const cache = this._ensurePlanBReplayData(this.audioSyncData);
      const states = (cache && Array.isArray(cache.stateEvents) && cache.stateEvents.length > 0)
        ? cache.stateEvents
        : (this.audioSyncData.initialState ? [{ t: 0, state: this.audioSyncData.initialState }] : []);
      let prevEv = states.length > 0 ? states[0] : null;
      let nextEv = null;
      for (let i = 0; i < states.length; i++) {
        const ev = states[i];
        if (ev && ev.state) {
          if (ev.t <= playMs) {
            prevEv = ev;
          } else {
            nextEv = ev;
            break;
          }
        }
      }
      const inCardMotion = Boolean(
        cache &&
        Array.isArray(cache.cardMotionSpans) &&
        cache.cardMotionSpans.some(sp => playMs >= sp.tStart - 16 && playMs <= sp.tEnd + 16)
      );
      const maxInterpGap = inCardMotion ? 900 : 450;
      if (prevEv && nextEv && (nextEv.t - prevEv.t) > 0 && (nextEv.t - prevEv.t) <= maxInterpGap) {
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

    _isElementHiddenForReplayCursor(el) {
      let cur = el;
      let depth = 0;
      while (cur && depth < 5) {
        if (cur.style && cur.style.display === 'none') return true;
        if (cur.classList && (cur.classList.contains('minimized') || cur.classList.contains('drawer-collapsed'))) {
          if (cur.id !== 'sidebarRail') return true;
        }
        if (cur.id === 'railDrawer') {
          const rail = document.getElementById('sidebarRail');
          if (rail && rail.classList && rail.classList.contains('drawer-collapsed')) return true;
        }
        cur = cur.parentElement || null;
        depth++;
      }
      return false;
    }

    _resolveCursorEventScreenPos(ev) {
      if (!ev) return null;
      if (ev.isSearchAnchor && ev.searchSpan) {
        return this._resolveSearchSpanParkPos(ev.searchSpan);
      }
      if (ev.uiScreen) {
        // 1순위: 시맨틱 버튼 식별자(uiBtnKey)가 기록되어 있고 해당 버튼이 현재 화면에 표시 중이면,
        // 학생 뷰어 리플로우(#lessonPlaylistNavBar 편집 버튼 숨김 등), 툴바/미니리모컨/카드 이동, 향후 아이콘 배치 변경 시에도
        // 실제 버튼의 현재 정밀 위치로 100% 자동 추적!
        if (ev.uiBtnKey) {
          const btnEl = this._findAudioUiButtonByKey(ev.uiBtnKey, ev.uiBarId);
          if (btnEl && !this._isElementHiddenForReplayCursor(btnEl) && typeof btnEl.getBoundingClientRect === 'function') {
            const r = this._getStageElementRect(btnEl);
            if (r && r.width > 2 && r.height > 2 && r.left >= -2 && r.top >= -2 && r.right > 0 && r.bottom > 0) {
              const isActiveCls = Boolean(btnEl.classList && btnEl.classList.contains('replay-ui-btn-active'));
              const cssScale = isActiveCls ? 0.96 : 1.0;
              const baseW = r.width / cssScale;
              const baseH = r.height / cssScale;
              const cx = r.left + r.width * 0.5;
              const cy = r.top + r.height * 0.5;
              const bnx = typeof ev.bnx === 'number' ? ev.bnx : 0.5;
              const bny = typeof ev.bny === 'number' ? ev.bny : 0.5;
              const pos = {
                x: cx + (bnx - 0.5) * baseW,
                y: cy + (bny - 0.5) * baseH
              };
              ev._lastResolvedPos = pos;
              return pos;
            }
          }
        }
        // 2순위: 좌측 고정 레일/서랍 내부 여백(버튼 외부 배경)은 좌상단 고정 픽셀이므로 원본 스테이지 좌표 유지
        if (
          (ev.uiBarId === 'railDrawer' || ev.uiBarId === 'railDock' || ev.uiBarId === 'sidebarRail') &&
          this._isFixedReplayStageActive() &&
          this.audioSyncData &&
          this.audioSyncData.stageW &&
          this.audioSyncData.stageH
        ) {
          return { x: ev.x, y: ev.y };
        }
        // 3순위: 이동형/가변형 UI 바(#quickPillRemote, #inkFloatingToolbar, #lessonPlaylistNavBar, 카드 헤더, 팝오버 등) 내부 상대 좌표 추적
        if (ev.uiBarId && typeof ev.unx === 'number' && typeof ev.uny === 'number') {
          const barEl = this._resolveAudioUiBarElement(ev.uiBarId);
          if (barEl && !this._isElementHiddenForReplayCursor(barEl) && typeof barEl.getBoundingClientRect === 'function') {
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

    _findLatestCompletedStrokeTipBefore(playMs, minExclusiveMs = -1) {
      if (!this.audioSyncData) return null;
      let bestEv = null;
      let bestT = minExclusiveMs;

      const considerCanvasStroke = (s, forceLaser = false) => {
        if (!s || s.preExisting || s.isGraphStamp || s.isProblemStamp || s._duplicatedInAudio) return;
        if (typeof s.tStart !== 'number') return;
        const tEnd = (typeof s.tEnd === 'number' && s.tEnd >= s.tStart) ? s.tEnd : (s.tStart + 180);
        if (typeof s.tAppeared === 'number' && s.tAppeared > tEnd + 30) return;

        let effTipTime = tEnd;
        let lastPt = null;
        // 호/곡선(B): 1단계 선분 완성 직후 ~ 가운데 핸들(●) 조작 전 구간에서는 선분 끝점(endTrack 마지막)을 유지
        if (
          s.shape &&
          Array.isArray(s.shape.arcTrack) &&
          s.shape.arcTrack.length > 0 &&
          playMs < tEnd
        ) {
          const eTrack = Array.isArray(s.shape.endTrack) ? s.shape.endTrack : null;
          const lineEndMs = (typeof s.arcLineEndAt === 'number')
            ? s.arcLineEndAt
            : ((eTrack && eTrack.length >= 2 && typeof eTrack[eTrack.length - 1].t === 'number') ? eTrack[eTrack.length - 1].t : -1);
          const arcEditMs = (typeof s.arcEditStartAt === 'number')
            ? s.arcEditStartAt
            : (typeof s.shape.arcTrack[0].t === 'number' ? s.shape.arcTrack[0].t : tEnd);
          if (lineEndMs >= s.tStart && playMs >= lineEndMs && playMs < arcEditMs) {
            effTipTime = lineEndMs;
            lastPt = (eTrack && eTrack.length > 0) ? eTrack[eTrack.length - 1] : (s.shape.end || null);
          } else {
            return;
          }
        } else {
          if (tEnd > playMs) return;
          // 사각형·원·타원·삼각형은 완성 시 s.points가 닫힌 폐곡선으로 재생성되어 s.points[last]가 시작점이 되므로
          // 반드시 arcTrack / endTrack(실제 드래그 종료점)을 최우선 사용하여 도형 완성 직후 시작점으로 튀는 현상을 원천 차단!
          if (s.shape && Array.isArray(s.shape.arcTrack) && s.shape.arcTrack.length > 0) {
            lastPt = s.shape.arcTrack[s.shape.arcTrack.length - 1];
          } else if (s.shape && Array.isArray(s.shape.endTrack) && s.shape.endTrack.length > 0) {
            lastPt = s.shape.endTrack[s.shape.endTrack.length - 1];
          } else if (Array.isArray(s.points) && s.points.length > 0) {
            lastPt = s.points[s.points.length - 1];
          } else if (s.shape && s.shape.end) {
            lastPt = s.shape.end;
          }
        }
        if (effTipTime <= bestT || effTipTime > playMs) return;
        if (!lastPt || typeof lastPt.x !== 'number' || typeof lastPt.y !== 'number') return;
        const isBoard = (s.target || 'board') === 'board';
        bestT = effTipTime;
        bestEv = {
          t: effTipTime,
          type: 'cursor',
          color: forceLaser ? '#dc2626' : (s.color || '#00d2d3'),
          isDrawing: false,
          isLaser: forceLaser,
          cursorKind: forceLaser ? 'laser' : (s.isHighlighter ? 'highlighter' : (s.isDashed ? 'pen_dashed' : 'pen')),
          isBoard,
          bx: isBoard ? lastPt.x : undefined,
          by: isBoard ? lastPt.y : undefined,
          mx: !isBoard ? lastPt.x : undefined,
          my: !isBoard ? lastPt.y : undefined,
          x: lastPt.x,
          y: lastPt.y
        };
      };

      const considerCardStroke = (s, cardKey, forceLaser = false) => {
        if (!s || !cardKey || s.preExisting) return;
        if (typeof s.tStart !== 'number') return;
        const tEnd = (typeof s.tEnd === 'number' && s.tEnd >= s.tStart) ? s.tEnd : (s.tStart + 150);
        if (tEnd <= bestT || tEnd > playMs) return;
        const lastPt = (s.cardShape && s.cardShape.type === 'line' && s.cardShape.end && typeof s.cardShape.end.nx === 'number')
          ? s.cardShape.end
          : ((Array.isArray(s.points) && s.points.length > 0) ? s.points[s.points.length - 1] : null);
        if (!lastPt || typeof lastPt.nx !== 'number' || typeof lastPt.ny !== 'number') return;
        bestT = tEnd;
        bestEv = {
          t: tEnd,
          type: 'cursor',
          cardKey,
          nx: lastPt.nx,
          ny: lastPt.ny,
          color: forceLaser ? '#dc2626' : (s.color || '#0f172a'),
          isDrawing: false,
          isLaser: forceLaser,
          cursorKind: forceLaser ? 'laser' : (s.isHighlighter ? 'highlighter' : (s.isDashed ? 'pen_dashed' : 'pen'))
        };
      };

      const liveStrokes = Array.isArray(this.inkStrokes) ? this.inkStrokes : [];
      for (let i = 0; i < liveStrokes.length; i++) considerCanvasStroke(liveStrokes[i], false);
      const erasedStrokes = Array.isArray(this.audioSyncData.erasedStrokes) ? this.audioSyncData.erasedStrokes : [];
      for (let i = 0; i < erasedStrokes.length; i++) {
        const es = erasedStrokes[i];
        if (!es) continue;
        if (es.cardKey) considerCardStroke(es, es.cardKey, false);
        else considerCanvasStroke(es, false);
      }
      const laserStrokes = Array.isArray(this.audioSyncData.laserStrokes) ? this.audioSyncData.laserStrokes : [];
      for (let i = 0; i < laserStrokes.length; i++) {
        const ls = laserStrokes[i];
        if (!ls) continue;
        if (ls.cardKey) considerCardStroke(ls, ls.cardKey, true);
        else considerCanvasStroke(ls, true);
      }

      if (this.problemCardData && Array.isArray(this.problemCardData.cardStrokes)) {
        const pEl = document.getElementById('problemCardWidget');
        const pKey = pEl ? this.getAudioCardKey(pEl) : 'problemCardWidget';
        for (let i = 0; i < this.problemCardData.cardStrokes.length; i++) {
          considerCardStroke(this.problemCardData.cardStrokes[i], pKey, false);
        }
      }
      if (this.graphCardData && Array.isArray(this.graphCardData.cardStrokes)) {
        const gEl = document.getElementById('graphCardWidget');
        const gKey = gEl ? this.getAudioCardKey(gEl) : 'graphCardWidget';
        for (let i = 0; i < this.graphCardData.cardStrokes.length; i++) {
          considerCardStroke(this.graphCardData.cardStrokes[i], gKey, false);
        }
      }
      if (Array.isArray(this.extraProblemCards)) {
        for (let cIdx = 0; cIdx < this.extraProblemCards.length; cIdx++) {
          const c = this.extraProblemCards[cIdx];
          if (c && c.el && Array.isArray(c.cardStrokes)) {
            const cKey = this.getAudioCardKey(c.el);
            for (let i = 0; i < c.cardStrokes.length; i++) considerCardStroke(c.cardStrokes[i], cKey, false);
          }
        }
      }
      if (Array.isArray(this.extraGraphCards)) {
        for (let cIdx = 0; cIdx < this.extraGraphCards.length; cIdx++) {
          const c = this.extraGraphCards[cIdx];
          if (c && c.el && Array.isArray(c.cardStrokes)) {
            const cKey = this.getAudioCardKey(c.el);
            for (let i = 0; i < c.cardStrokes.length; i++) considerCardStroke(c.cardStrokes[i], cKey, false);
          }
        }
      }

      return bestEv;
    }

    _findNextUpcomingStrokeStartAfter(playMs, maxFutureMs = 450) {
      if (!this.audioSyncData) return null;
      const maxAllowedT = playMs + Math.max(0, Number(maxFutureMs) || 450);
      let bestEv = null;
      let bestT = Infinity;

      const considerCanvasStroke = (s, forceLaser = false) => {
        if (!s || s.preExisting || s.isGraphStamp || s.isProblemStamp || s._duplicatedInAudio) return;
        if (typeof s.tStart !== 'number') return;
        const tStart = s.tStart;
        if (tStart <= playMs || tStart > maxAllowedT || tStart >= bestT) return;
        if (typeof s.tAppeared === 'number' && s.tAppeared > tStart + 30) return;
        let firstPt = null;
        if (s.shape && Array.isArray(s.shape.endTrack) && s.shape.endTrack.length > 0 && s.shape.endTrack[0]) {
          firstPt = s.shape.endTrack[0];
        } else if (Array.isArray(s.points) && s.points.length > 0) {
          firstPt = s.points[0];
        } else if (s.shape && s.shape.start) {
          firstPt = s.shape.start;
        }
        if (!firstPt || typeof firstPt.x !== 'number' || typeof firstPt.y !== 'number') return;
        const isBoard = (s.target || 'board') === 'board';
        bestT = tStart;
        bestEv = {
          t: tStart,
          type: 'cursor',
          color: forceLaser ? '#dc2626' : (s.color || '#00d2d3'),
          isDrawing: false,
          isLaser: forceLaser,
          cursorKind: forceLaser ? 'laser' : (s.isHighlighter ? 'highlighter' : (s.isDashed ? 'pen_dashed' : 'pen')),
          isBoard,
          bx: isBoard ? firstPt.x : undefined,
          by: isBoard ? firstPt.y : undefined,
          mx: !isBoard ? firstPt.x : undefined,
          my: !isBoard ? firstPt.y : undefined,
          x: firstPt.x,
          y: firstPt.y
        };
      };

      const considerCardStroke = (s, cardKey, forceLaser = false) => {
        if (!s || !cardKey || s.preExisting) return;
        if (typeof s.tStart !== 'number') return;
        const tStart = s.tStart;
        if (tStart <= playMs || tStart > maxAllowedT || tStart >= bestT) return;
        if (!Array.isArray(s.points) || s.points.length === 0) return;
        const firstPt = s.points[0];
        if (!firstPt || typeof firstPt.nx !== 'number' || typeof firstPt.ny !== 'number') return;
        bestT = tStart;
        bestEv = {
          t: tStart,
          type: 'cursor',
          cardKey,
          nx: firstPt.nx,
          ny: firstPt.ny,
          color: forceLaser ? '#dc2626' : (s.color || '#0f172a'),
          isDrawing: false,
          isLaser: forceLaser,
          cursorKind: forceLaser ? 'laser' : (s.isHighlighter ? 'highlighter' : (s.isDashed ? 'pen_dashed' : 'pen'))
        };
      };

      const liveStrokes = Array.isArray(this.inkStrokes) ? this.inkStrokes : [];
      for (let i = 0; i < liveStrokes.length; i++) considerCanvasStroke(liveStrokes[i], false);
      const erasedStrokes = Array.isArray(this.audioSyncData.erasedStrokes) ? this.audioSyncData.erasedStrokes : [];
      for (let i = 0; i < erasedStrokes.length; i++) {
        const es = erasedStrokes[i];
        if (!es) continue;
        if (es.cardKey) considerCardStroke(es, es.cardKey, false);
        else considerCanvasStroke(es, false);
      }
      const laserStrokes = Array.isArray(this.audioSyncData.laserStrokes) ? this.audioSyncData.laserStrokes : [];
      for (let i = 0; i < laserStrokes.length; i++) {
        const ls = laserStrokes[i];
        if (!ls) continue;
        if (ls.cardKey) considerCardStroke(ls, ls.cardKey, true);
        else considerCanvasStroke(ls, true);
      }
      if (this.problemCardData && Array.isArray(this.problemCardData.cardStrokes)) {
        const pEl = document.getElementById('problemCardWidget');
        const pKey = pEl ? this.getAudioCardKey(pEl) : 'problemCardWidget';
        for (let i = 0; i < this.problemCardData.cardStrokes.length; i++) {
          considerCardStroke(this.problemCardData.cardStrokes[i], pKey, false);
        }
      }
      if (this.graphCardData && Array.isArray(this.graphCardData.cardStrokes)) {
        const gEl = document.getElementById('graphCardWidget');
        const gKey = gEl ? this.getAudioCardKey(gEl) : 'graphCardWidget';
        for (let i = 0; i < this.graphCardData.cardStrokes.length; i++) {
          considerCardStroke(this.graphCardData.cardStrokes[i], gKey, false);
        }
      }
      if (Array.isArray(this.extraProblemCards)) {
        for (let cIdx = 0; cIdx < this.extraProblemCards.length; cIdx++) {
          const c = this.extraProblemCards[cIdx];
          if (c && c.el && Array.isArray(c.cardStrokes)) {
            const cKey = this.getAudioCardKey(c.el);
            for (let i = 0; i < c.cardStrokes.length; i++) considerCardStroke(c.cardStrokes[i], cKey, false);
          }
        }
      }
      if (Array.isArray(this.extraGraphCards)) {
        for (let cIdx = 0; cIdx < this.extraGraphCards.length; cIdx++) {
          const c = this.extraGraphCards[cIdx];
          if (c && c.el && Array.isArray(c.cardStrokes)) {
            const cKey = this.getAudioCardKey(c.el);
            for (let i = 0; i < c.cardStrokes.length; i++) considerCardStroke(c.cardStrokes[i], cKey, false);
          }
        }
      }

      return bestEv;
    }

    _getInterpolatedCursorAt(playMs) {
      if (!this.audioSyncData || !Array.isArray(this.audioSyncData.timeline)) return null;
      const cache = this._ensurePlanBReplayData(this.audioSyncData);

      // 🌟 [창(카드) 드래그·리사이즈 중 손바닥·리사이즈 커서 강체 고정 (0.00px 미끄러짐 방지)]
      const lockedCardCursor = this._resolvePlanBActiveCardDragCursorAt(playMs);
      if (lockedCardCursor) {
        return lockedCardCursor;
      }

      const cursorList = (cache && Array.isArray(cache.cursorEvents))
        ? cache.cursorEvents
        : this.audioSyncData.timeline.filter(ev => ev && ev.type === 'cursor');

      // 🌟 [연속 필기 획 간 0.00px 무결점 브리지]:
      // 숫자 1·2·3·4, 수식, 한글 등 연속 필기 중 펜을 잠깐 들어 다음 획으로 이동하는 짧은 공중 구간(<= 380ms)에서는
      // 아이패드 펜슬 틸트 호버 노이즈 및 구버전 상단 가드 오프셋 샘플을 배제하고 직전 획 끝점 ➔ 다음 획 시작점을 직결 보간!
      const latestTipForBridge = this._findLatestCompletedStrokeTipBefore(playMs, -1);
      const upcomingStartForBridge = latestTipForBridge
        ? this._findNextUpcomingStrokeStartAfter(playMs, 380)
        : null;
      if (
        latestTipForBridge &&
        upcomingStartForBridge &&
        (upcomingStartForBridge.t - latestTipForBridge.t) <= 380 &&
        Boolean(latestTipForBridge.cardKey) === Boolean(upcomingStartForBridge.cardKey) &&
        (!latestTipForBridge.cardKey || latestTipForBridge.cardKey === upcomingStartForBridge.cardKey)
      ) {
        let hasInterveningUiOrDrag = false;
        for (let i = 0; i < cursorList.length; i++) {
          const ev = cursorList[i];
          if (!ev || typeof ev.t !== 'number') continue;
          if (ev.t <= latestTipForBridge.t) continue;
          if (ev.t >= upcomingStartForBridge.t) break;
          if (
            ev.uiScreen ||
            ev.cursorKind === 'pointer' ||
            ev.cursorKind === 'grabbing' ||
            ev.cursorKind === 'move' ||
            ev.cursorKind === 'nwse-resize' ||
            ev.cursorKind === 'nesw-resize' ||
            ev.cursorKind === 'eraser'
          ) {
            hasInterveningUiOrDrag = true;
            break;
          }
        }
        if (!hasInterveningUiOrDrag) {
          const bP1 = this._resolveCursorEventScreenPos(latestTipForBridge);
          const bP2 = this._resolveCursorEventScreenPos(upcomingStartForBridge);
          if (bP1 && bP2) {
            const bGap = Math.max(1, upcomingStartForBridge.t - latestTipForBridge.t);
            const bU = Math.max(0, Math.min(1, (playMs - latestTipForBridge.t) / bGap));
            const bRatio = bU * bU * (3 - 2 * bU);
            const useNextStyle = bU >= 0.65;
            return {
              x: bP1.x + (bP2.x - bP1.x) * bRatio,
              y: bP1.y + (bP2.y - bP1.y) * bRatio,
              color: (useNextStyle ? upcomingStartForBridge.color : latestTipForBridge.color) || '#00d2d3',
              isDrawing: false,
              isLaser: Boolean(useNextStyle ? upcomingStartForBridge.isLaser : latestTipForBridge.isLaser),
              cursorKind: (useNextStyle ? upcomingStartForBridge.cursorKind : latestTipForBridge.cursorKind) || 'pen',
              uiScreen: false,
              uiBarId: '',
              uiBtnKey: ''
            };
          }
        }
      }

      let prev = null;
      let next = null;
      let recentUiClickEv = null;
      for (let i = 0; i < cursorList.length; i++) {
        const ev = cursorList[i];
        if (!ev) continue;
        // 주의: 미래 시점(ev.t > playMs)의 UI 이벤트를 현재(playMs) 시점의 DOM display 상태로 걸러내면
        // 서랍·팝오버가 열리기 직전 이동 경로가 통째로 생략되므로 절대 미래 이벤트를 스킵하지 않음!
        if (ev.t <= playMs) {
          if (ev.uiScreen && (playMs - ev.t) <= 80 && this._isPlanBUiTargetCurrentlyHidden(ev)) continue;
          prev = ev;
          if (ev.isDrawing && (ev.uiScreen || ev.cursorKind === 'pointer') && (playMs - ev.t) <= 115) {
            recentUiClickEv = ev;
          }
        } else {
          next = ev;
          break;
        }
      }

      // 방금 종료된 카드 드래그/리사이즈가 있다면 그 최종 라이브 그립 위치에서 매끄럽게 출발
      if (cache && Array.isArray(cache.cardMotionSpans)) {
        for (let i = 0; i < cache.cardMotionSpans.length; i++) {
          const sp = cache.cardMotionSpans[i];
          if (sp && sp._lastLiveCursorPos && sp.tEnd <= playMs && (!prev || sp.tEnd >= prev.t - 40)) {
            prev = {
              t: sp.tEnd,
              type: 'cursor',
              x: sp._lastLiveCursorPos.x,
              y: sp._lastLiveCursorPos.y,
              color: (prev && prev.color) || this.currentInkColor || '#00d2d3',
              isDrawing: false,
              cursorKind: sp.isResize ? 'nwse-resize' : 'grab',
              uiScreen: true,
              uiBarId: sp.cardKey || '',
              _lastResolvedPos: { x: sp._lastLiveCursorPos.x, y: sp._lastLiveCursorPos.y }
            };
          }
        }
      }

      // 필기/레이저 스트로크가 prev 이후(또는 리프팅 직후 36ms 이내)에 종료된 경우,
      // 실제 마지막 획의 정밀 펜 끝 좌표를 prev로 고정하여 펜을 떼는 순간의 좌표 튐을 원천 차단!
      const strokeTipMinMs = prev
        ? ((prev.uiScreen || prev.cursorKind === 'pointer') ? prev.t : (prev.t - 36))
        : -1;
      const strokeTipEv = this._findLatestCompletedStrokeTipBefore(playMs, strokeTipMinMs);
      if (strokeTipEv) {
        if (!strokeTipEv.pt && prev && prev.pt) {
          strokeTipEv.pt = prev.pt;
        }
        prev = strokeTipEv;
      }

      // 다음 필기 시작 직전(36ms 이내)의 착지 오프셋 커서 샘플이 있다면 실제 첫 획 좌표로 정밀 정렬!
      const upcomingStrokeNear = this._findNextUpcomingStrokeStartAfter(playMs, 480);
      if (
        upcomingStrokeNear &&
        (!next || (!next.uiScreen && next.cursorKind !== 'pointer' && upcomingStrokeNear.t <= next.t + 36))
      ) {
        if (!next || upcomingStrokeNear.t <= next.t || (upcomingStrokeNear.t - next.t) <= 36) {
          if (!upcomingStrokeNear.pt) {
            upcomingStrokeNear.pt = (next && next.pt) || (prev && prev.pt) || '';
          }
          next = upcomingStrokeNear;
        }
      }

      if (!prev && !next) return null;
      if (!prev) return null;
      if (prev.hidden) return null;

      const ContinuousDragKinds = {
        grabbing: true,
        move: true,
        'nwse-resize': true,
        'nesw-resize': true
      };
      const resolveHoldIsDrawing = (ev) => {
        if (
          recentUiClickEv &&
          (playMs - recentUiClickEv.t) <= 115 &&
          (!ev.uiBtnKey || !recentUiClickEv.uiBtnKey || ev.uiBtnKey === recentUiClickEv.uiBtnKey)
        ) {
          return true;
        }
        if (!ev || !ev.isDrawing) return false;
        const dt = playMs - (ev.t || 0);
        if (dt <= 115) return true;
        if (next && next.isDrawing && (next.t - ev.t) <= 1200 && ContinuousDragKinds[ev.cursorKind]) {
          return true;
        }
        return false;
      };

      const buildStaticCursor = (ev, pos) => ({
        x: pos.x,
        y: pos.y,
        color: ev.color || '#00d2d3',
        isDrawing: resolveHoldIsDrawing(ev),
        isLaser: Boolean(ev.isLaser),
        cursorKind: ev.cursorKind || (ev.isLaser ? 'laser' : 'pen'),
        uiScreen: Boolean(ev.uiScreen),
        uiBarId: ev.uiBarId || '',
        uiBtnKey: ev.uiBtnKey || ''
      });

      const p1 = this._resolveCursorEventScreenPos(prev);
      if (!p1) return null;

      if (!next || next.hidden) {
        return buildStaticCursor(prev, p1);
      }

      const p2 = this._resolveCursorEventScreenPos(next);
      if (!p2) {
        return buildStaticCursor(prev, p1);
      }

      const gap = Math.max(1, next.t - prev.t);
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const minJerk = (uVal) => {
        const u2 = uVal * uVal;
        const u3 = u2 * uVal;
        return u3 * (10 - 15 * uVal + 6 * u2);
      };
      // 비대칭 Fitts'-Law 손목 리치 곡선: 등속 로봇감 없이 0속도·0가속도로 부드럽게 이륙해 초반(u≈0.40)에 시원하게 이동한 뒤 목표 지점 앞에서 차분히 감속 조준!
      const fittsReach = (uVal) => minJerk(uVal * (1.28 - 0.28 * uVal));

      // 🌟 [비노출 보조 서랍 탐색 포인터(search) 구간 전용 연결]:
      // 돋보기 정박 구간([tStart, tEnd]) 내부에서는 흔들림 없이 제자리 유지(내부 CSS 살랑 모션 동작),
      // 진입/이탈 시에는 부드럽게 가감속하며 돋보기 ⇄ 실제 도구로 자연스럽게 전환!
      if (prev.cursorKind === 'search' && next.cursorKind === 'search') {
        return buildStaticCursor(prev, p1);
      }
      if (prev.cursorKind !== 'search' && next.cursorKind === 'search') {
        const enterDur = Math.min(gap, Math.max(120, Math.min(240, Math.round(100 + dist * 0.32))));
        const enterStart = next.t - enterDur;
        if (playMs < enterStart) {
          return buildStaticCursor(prev, p1);
        }
        const uEnter = Math.max(0, Math.min(1, (playMs - enterStart) / Math.max(1, enterDur)));
        const rEnter = minJerk(uEnter);
        const showSearch = (uEnter >= 0.72);
        return {
          x: p1.x + (p2.x - p1.x) * rEnter,
          y: p1.y + (p2.y - p1.y) * rEnter,
          color: prev.color || '#00d2d3',
          isDrawing: false,
          isLaser: false,
          cursorKind: showSearch ? 'search' : (prev.cursorKind || 'pointer'),
          uiScreen: true,
          uiBarId: showSearch ? '' : (prev.uiBarId || ''),
          uiBtnKey: showSearch ? '' : (prev.uiBtnKey || '')
        };
      }
      if (prev.cursorKind === 'search' && next.cursorKind !== 'search') {
        const exitDur = Math.min(gap, Math.max(200, Math.min(480, Math.round(165 + dist * 0.34))));
        const exitStart = next.t - exitDur;
        if (playMs < exitStart) {
          return buildStaticCursor(prev, p1);
        }
        const uExit = Math.max(0, Math.min(1, (playMs - exitStart) / Math.max(1, exitDur)));
        const rExit = minJerk(uExit);
        const switched = (uExit >= 0.16);
        return {
          x: p1.x + (p2.x - p1.x) * rExit,
          y: p1.y + (p2.y - p1.y) * rExit,
          color: (switched ? next.color : prev.color) || '#00d2d3',
          isDrawing: false,
          isLaser: Boolean(switched && next.isLaser),
          cursorKind: switched ? (next.cursorKind || (next.isLaser ? 'laser' : 'pen')) : 'search',
          uiScreen: Boolean(switched && next.uiScreen),
          uiBarId: (switched && uExit >= 0.70) ? (next.uiBarId || '') : '',
          uiBtnKey: (switched && uExit >= 0.70) ? (next.uiBtnKey || '') : ''
        };
      }

      // 🌟 [기기별 순정 이동 vs 공중 점프 분리]:
      // 1) PC 마우스(pt === 'm'): 60fps(16ms) 연속 궤적을 왜곡 없이 1:1 선형 직결!
      //    정지 후 재출발(gap > 140ms, dist <= 64px) 시 미리 기어가지 않도록 출발 직전까지 p1에 정지 후 실제 프레임(28ms) 이동.
      // 2) 아이패드 펜슬/터치(pt === 'p' | 't') 또는 구버전 원거리 점프:
      //    펜을 뗀 공중 구간에서도 포인터를 숨기지 않고 유지하다가 실제 사람 손목 가감속(Minimum-Jerk, 280~680ms)으로 자연스럽게 연결!
      const nextPt = next.pt || prev.pt || '';
      const isExplicitMouse = (nextPt === 'm');
      let u = 0;
      let interpRatio = 0;
      let interpIsDrawing = false;

      if (isExplicitMouse) {
        if (gap <= 140 || (prev.isDrawing && next.isDrawing && ContinuousDragKinds[prev.cursorKind])) {
          u = Math.max(0, Math.min(1, (playMs - prev.t) / gap));
          interpRatio = u;
          interpIsDrawing = Boolean((prev.isDrawing && next.isDrawing) || resolveHoldIsDrawing(prev));
        } else if (dist <= 64) {
          const stepMs = Math.min(gap, 28);
          const stepStart = next.t - stepMs;
          if (playMs < stepStart) {
            return buildStaticCursor(prev, p1);
          }
          u = Math.max(0, Math.min(1, (playMs - stepStart) / Math.max(1, stepMs)));
          interpRatio = u;
          interpIsDrawing = false;
        } else {
          const flightMs = Math.min(gap, Math.max(220, Math.min(520, Math.round(160 + dist * 0.34))));
          const flightStartMs = next.t - flightMs;
          if (playMs < flightStartMs) {
            return buildStaticCursor(prev, p1);
          }
          u = Math.max(0, Math.min(1, (playMs - flightStartMs) / Math.max(1, flightMs)));
          interpRatio = minJerk(u);
          interpIsDrawing = false;
        }
      } else if (gap <= 180) {
        u = Math.max(0, Math.min(1, (playMs - prev.t) / gap));
        interpRatio = u;
        interpIsDrawing = Boolean((prev.isDrawing && next.isDrawing) || resolveHoldIsDrawing(prev));
      } else if (dist <= 28 && nextPt === '') {
        // 구버전(pt 미기록) 녹화본에서 마우스 정지 후 미세 출발 시 조기 미끄러짐 방지
        const stepMs = Math.min(gap, 42);
        const stepStart = next.t - stepMs;
        if (playMs < stepStart) {
          return buildStaticCursor(prev, p1);
        }
        u = Math.max(0, Math.min(1, (playMs - stepStart) / Math.max(1, stepMs)));
        interpRatio = u;
        interpIsDrawing = false;
      } else if (gap <= 420 && prev.isDrawing && next.isDrawing && ContinuousDragKinds[prev.cursorKind]) {
        u = Math.max(0, Math.min(1, (playMs - prev.t) / gap));
        interpRatio = u;
        interpIsDrawing = true;
      } else {
        const distFactor = Math.min(1, dist / 280);
        const gapBonus = Math.min(240, Math.max(0, gap - 550) * 0.15) * distFactor;
        const idealFlight = Math.max(380, Math.min(1180, Math.round(350 + dist * 0.68 + gapBonus)));
        const flightMs = (gap <= idealFlight * 1.28) ? Math.max(1, gap - 28) : Math.min(gap, idealFlight);
        const flightStartMs = next.t - flightMs;
        if (playMs < flightStartMs) {
          return buildStaticCursor(prev, p1);
        }
        u = Math.max(0, Math.min(1, (playMs - flightStartMs) / Math.max(1, flightMs)));
        interpRatio = fittsReach(u);
        interpIsDrawing = false;
      }

      let activeCursorKind = prev.cursorKind || (prev.isLaser ? 'laser' : 'pen');
      let activeColor = prev.color || '#00d2d3';
      let activeIsLaser = Boolean(prev.isLaser);
      let activeUiScreen = Boolean(prev.uiScreen);
      let activeUiBarId = prev.uiBarId || '';
      let activeUiBtnKey = prev.uiBtnKey || '';

      if (prev.uiScreen && !next.uiScreen) {
        if (u >= 0.18) {
          activeCursorKind = next.cursorKind || (next.isLaser ? 'laser' : 'pen');
          activeColor = next.color || activeColor;
          activeIsLaser = Boolean(next.isLaser);
          activeUiScreen = false;
          activeUiBarId = '';
          activeUiBtnKey = '';
        }
      } else if (!prev.uiScreen && next.uiScreen) {
        if (u >= 0.72) {
          activeCursorKind = next.cursorKind || 'pointer';
          activeColor = next.color || activeColor;
          activeIsLaser = false;
          activeUiScreen = true;
          activeUiBarId = next.uiBarId || '';
          activeUiBtnKey = next.uiBtnKey || '';
        } else {
          activeUiBtnKey = '';
        }
      } else if (prev.uiScreen && next.uiScreen) {
        if (u >= 0.72) {
          activeCursorKind = next.cursorKind || activeCursorKind;
          activeUiBarId = next.uiBarId || activeUiBarId;
          activeUiBtnKey = next.uiBtnKey || '';
        } else if (u >= 0.22 && prev.uiBtnKey !== next.uiBtnKey) {
          activeCursorKind = next.cursorKind || activeCursorKind;
          activeUiBarId = next.uiBarId || activeUiBarId;
          activeUiBtnKey = '';
        }
      } else if (u >= 0.76) {
        activeCursorKind = next.cursorKind || activeCursorKind;
        activeColor = next.color || activeColor;
        activeIsLaser = Boolean(next.isLaser);
      }

      return {
        x: p1.x + (p2.x - p1.x) * interpRatio,
        y: p1.y + (p2.y - p1.y) * interpRatio,
        color: activeColor,
        isDrawing: interpIsDrawing,
        isLaser: activeIsLaser,
        cursorKind: activeCursorKind,
        uiScreen: activeUiScreen,
        uiBarId: activeUiBarId,
        uiBtnKey: activeUiBtnKey
      };
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
      const isDashedPen = (kind === 'pen_dashed');
      const baseKind = isDashedPen ? 'pen' : kind;
      const svgs = {
        pen: this.stylusPenSvg || document.getElementById('stylusPenSvg'),
        highlighter: this.stylusHighlighterSvg || document.getElementById('stylusHighlighterSvg'),
        eraser: this.stylusEraserSvg || document.getElementById('stylusEraserSvg'),
        laser: this.stylusLaserSvg || document.getElementById('stylusLaserSvg'),
        arrow: this.stylusArrowSvg || document.getElementById('stylusArrowSvg'),
        pointer: this.stylusPointerSvg || document.getElementById('stylusPointerSvg'),
        grab: this.stylusGrabSvg || document.getElementById('stylusGrabSvg'),
        grabbing: this.stylusGrabbingSvg || document.getElementById('stylusGrabbingSvg'),
        crosshair: this.stylusCrosshairSvg || document.getElementById('stylusCrosshairSvg'),
        move: this.stylusMoveSvg || document.getElementById('stylusMoveSvg'),
        'nwse-resize': this.stylusNwseResizeSvg || document.getElementById('stylusNwseResizeSvg'),
        'nesw-resize': this.stylusNeswResizeSvg || document.getElementById('stylusNeswResizeSvg'),
        search: this.stylusSearchSvg || document.getElementById('stylusSearchSvg')
      };

      Object.keys(svgs).forEach(k => {
        if (svgs[k]) {
          const wantDisp = (k === baseKind) ? 'block' : 'none';
          if (svgs[k].style.display !== wantDisp) {
            svgs[k].style.display = wantDisp;
          }
        }
      });
      // 폴백: 만약 해당 SVG가 없으면 기본 펜 표시
      if (!svgs[baseKind] && svgs.pen && svgs.pen.style.display !== 'block') {
        svgs.pen.style.display = 'block';
      }

      if ((baseKind === 'pen' || baseKind === 'highlighter') && typeof this._syncStylusTipColors === 'function') {
        this._syncStylusTipColors(color, baseKind);
      }
      if (baseKind === 'pen' && typeof this._syncStylusPenDashVisual === 'function') {
        this._syncStylusPenDashVisual(isDashedPen);
      }

      // 마우스 클릭 / 그래프 핸들 / 올가미 이동·크기조절 시작 순간 ScreenStudio 스타일 클릭 파동(Click Ripple) 발동!
      const wasDrawing = Boolean(this._prevReplayIsDrawing);
      const prevKind = this._prevReplayCursorKind || 'pen';
      const prevBaseKind = (prevKind === 'pen_dashed') ? 'pen' : prevKind;
      if ((!wasDrawing && isDrawing && baseKind !== 'pen' && baseKind !== 'highlighter' && baseKind !== 'search') || (prevBaseKind !== 'grabbing' && baseKind === 'grabbing')) {
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
      this._lastVirtualStylusKind = null;

      if (this.virtualStylusEl.style.display !== 'block') {
        this.virtualStylusEl.style.display = 'block';
      }
      if (this.virtualStylusEl.style.opacity !== '1') {
        this.virtualStylusEl.style.opacity = '1';
      }
      this.virtualStylusEl.classList.toggle('drawing', Boolean(isDrawing));
      const scale = (isDrawing && (baseKind === 'pen' || baseKind === 'highlighter' || baseKind === 'eraser')) ? 0.94 : 1.0;
      this.virtualStylusEl.style.transform = `translate3d(${Math.round(screenX * 100) / 100}px, ${Math.round(screenY * 100) / 100}px, 0) scale(${scale})`;
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

      if (stroke.isGraphStamp) {
        return {
          stroke,
          isCurrentlyWriting: false,
          isActiveHighlight: false,
          tipPoint: null
        };
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

      // 호/곡선(B) 가운데 핸들 실시간 변형 구간 및 단축키 즉시 도형(endTrack[0].q) / Draw & Hold 직선 드래그 구간(shapeSnapMs <= playMs < tEnd):
      if (
        playMs >= shapeSnapMs &&
        playMs < tEnd &&
        stroke.shape &&
        Array.isArray(stroke.shape.arcTrack) &&
        stroke.shape.arcTrack.length >= 1 &&
        typeof this._computeArcShapeFromScreenHandle === 'function'
      ) {
        const atr = stroke.shape.arcTrack;
        const eTrack = Array.isArray(stroke.shape.endTrack) ? stroke.shape.endTrack : null;
        const lineEndMs = (typeof stroke.arcLineEndAt === 'number')
          ? stroke.arcLineEndAt
          : ((eTrack && eTrack.length >= 2 && typeof eTrack[eTrack.length - 1].t === 'number') ? eTrack[eTrack.length - 1].t : shapeSnapMs);
        const arcEditMs = (typeof stroke.arcEditStartAt === 'number')
          ? stroke.arcEditStartAt
          : (typeof atr[0].t === 'number' ? atr[0].t : lineEndMs);

        if (playMs >= lineEndMs) {
          const isBoardArcRep = (stroke.target || 'board') === 'board';
          const shapePArcRep = (typeof stroke.shapePressure === 'number')
            ? stroke.shapePressure
            : ((stroke.shape && typeof stroke.shape.p === 'number') ? stroke.shape.p : 0.5);
          let coordA = stroke.shape.start || null;
          let coordB = stroke.shape.end || null;
          if ((!coordA || !coordB) && Array.isArray(stroke.shape.pts) && stroke.shape.pts.length >= 2) {
            coordA = stroke.shape.pts[0];
            coordB = stroke.shape.pts[stroke.shape.pts.length - 1];
          }
          if (coordA && coordB) {
            if (playMs < arcEditMs) {
              return {
                stroke: {
                  ...stroke,
                  shape: {
                    type: 'line',
                    start: { x: coordA.x, y: coordA.y },
                    end: { x: coordB.x, y: coordB.y },
                    snapped: null,
                    p: shapePArcRep
                  },
                  isShape: true
                },
                isCurrentlyWriting: false,
                isActiveHighlight: false,
                tipPoint: null
              };
            }
            let hx = atr[atr.length - 1].x;
            let hy = atr[atr.length - 1].y;
            let altBit = atr[atr.length - 1].a || 0;
            if (playMs <= atr[0].t) {
              hx = atr[0].x;
              hy = atr[0].y;
              altBit = atr[0].a || 0;
            } else {
              for (let k = 0; k < atr.length - 1; k++) {
                const a0 = atr[k];
                const a1 = atr[k + 1];
                const t0 = typeof a0.t === 'number' ? a0.t : arcEditMs;
                const t1 = Math.max(t0, typeof a1.t === 'number' ? a1.t : tEnd);
                if (playMs <= t1) {
                  const seg = Math.max(1, t1 - t0);
                  const u = Math.max(0, Math.min(1, (playMs - t0) / seg));
                  hx = a0.x + (a1.x - a0.x) * u;
                  hy = a0.y + (a1.y - a0.y) * u;
                  altBit = a1.a || 0;
                  break;
                }
              }
            }
            const sA = isBoardArcRep ? this.boardToScreen(coordA.x, coordA.y) : this.mathToScreen(coordA.x, coordA.y);
            const sB = isBoardArcRep ? this.boardToScreen(coordB.x, coordB.y) : this.mathToScreen(coordB.x, coordB.y);
            const sH = isBoardArcRep ? this.boardToScreen(hx, hy) : this.mathToScreen(hx, hy);
            const liveArcRes = this._computeArcShapeFromScreenHandle(sA, sB, sH, isBoardArcRep, shapePArcRep, Boolean(altBit));
            return {
              stroke: {
                ...stroke,
                shape: (liveArcRes && liveArcRes.shape) ? liveArcRes.shape : stroke.shape,
                isShape: true
              },
              isCurrentlyWriting: true,
              isActiveHighlight: true,
              tipPoint: { x: hx, y: hy, t: playMs }
            };
          }
        }
      }

      // 단축키 즉시 도형(endTrack[0].q) 실시간 드래그 구간 및 Draw & Hold 직선(line) 스냅 후 끝점 드래그 구간(shapeSnapMs <= playMs < tEnd):
      if (
        playMs >= shapeSnapMs &&
        playMs < tEnd &&
        stroke.shape &&
        Array.isArray(stroke.shape.endTrack) &&
        stroke.shape.endTrack.length >= 2
      ) {
        const track = stroke.shape.endTrack;
        const firstEp = track[0];
        if (firstEp && firstEp.q && typeof this._computeInstantMainShape === 'function') {
          let ex = track[track.length - 1].x;
          let ey = track[track.length - 1].y;
          let modMask = track[track.length - 1].m || 0;
          if (playMs <= firstEp.t) {
            ex = firstEp.x;
            ey = firstEp.y;
            modMask = track[1].m || 0;
          } else {
            for (let k = 0; k < track.length - 1; k++) {
              const eA = track[k];
              const eB = track[k + 1];
              const tA = typeof eA.t === 'number' ? eA.t : shapeSnapMs;
              const tB = Math.max(tA, typeof eB.t === 'number' ? eB.t : tEnd);
              if (playMs <= tB) {
                const seg = Math.max(1, tB - tA);
                const a = Math.max(0, Math.min(1, (playMs - tA) / seg));
                ex = eA.x + (eB.x - eA.x) * a;
                ey = eA.y + (eB.y - eA.y) * a;
                modMask = eB.m || 0;
                break;
              }
            }
          }
          const isBoardReplay = (stroke.target || 'board') === 'board';
          const sStart = isBoardReplay
            ? this.boardToScreen(firstEp.x, firstEp.y)
            : this.mathToScreen(firstEp.x, firstEp.y);
          const sCur = isBoardReplay
            ? this.boardToScreen(ex, ey)
            : this.mathToScreen(ex, ey);
          const shapePReplay = (typeof stroke.shapePressure === 'number')
            ? stroke.shapePressure
            : ((stroke.shape && typeof stroke.shape.p === 'number') ? stroke.shape.p : 0.5);
          const liveQuickShape = this._computeInstantMainShape(
            firstEp.q,
            sStart,
            sCur,
            isBoardReplay,
            (modMask & 1) !== 0,
            (modMask & 2) !== 0,
            shapePReplay,
            null,
            (modMask & 4) !== 0,
            (modMask & 8) !== 0,
            (modMask & 16) === 0
          );
          return {
            stroke: {
              ...stroke,
              shape: liveQuickShape || stroke.shape,
              isShape: true
            },
            isCurrentlyWriting: true,
            isActiveHighlight: true,
            tipPoint: { x: ex, y: ey, t: playMs }
          };
        }
        if (stroke.shape.type === 'line') {
          let ex = track[track.length - 1].x;
          let ey = track[track.length - 1].y;
          if (playMs <= track[0].t) {
            ex = track[0].x;
            ey = track[0].y;
          } else {
            for (let k = 0; k < track.length - 1; k++) {
              const eA = track[k];
              const eB = track[k + 1];
              const tA = typeof eA.t === 'number' ? eA.t : shapeSnapMs;
              const tB = Math.max(tA, typeof eB.t === 'number' ? eB.t : tEnd);
              if (playMs <= tB) {
                const seg = Math.max(1, tB - tA);
                const a = Math.max(0, Math.min(1, (playMs - tA) / seg));
                ex = eA.x + (eB.x - eA.x) * a;
                ey = eA.y + (eB.y - eA.y) * a;
                break;
              }
            }
          }
          return {
            stroke: {
              ...stroke,
              shape: { ...stroke.shape, end: { x: ex, y: ey } },
              isShape: true
            },
            isCurrentlyWriting: true,
            isActiveHighlight: true,
            tipPoint: { x: ex, y: ey, t: playMs }
          };
        }
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
      const rawTimes = new Array(N);
      for (let i = 0; i < N; i++) {
        const pt = pts[i];
        const rawT = (pt && typeof pt.t === 'number')
          ? pt.t
          : (tStart + spanTotal * (i / (N - 1)));
        rawTimes[i] = i === 0 ? rawT : Math.max(rawTimes[i - 1], rawT);
      }
      if (rawTimes[N - 1] < tEnd) {
        rawTimes[N - 1] = tEnd;
      }
      // 🌟 [WebKit 이벤트 배칭(0~4ms 묶음 도착) & 스트로크 끝단 플러시 호길이(Arc-Length) 시간 정칙화]:
      // 동일 프레임에 몰려 도착해 0~4ms 간격으로 반올림된 연속 점들을 실제 이동 거리 비율에 맞춰 분배하여 획 중간 튐을 0.0px로 제거!
      const ptDist = (a, b) => {
        if (!a || !b) return 0;
        if (a.nx !== undefined && b.nx !== undefined) return Math.hypot(b.nx - a.nx, b.ny - a.ny);
        return Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
      };
      let rIdx = 0;
      while (rIdx < N - 1) {
        if ((rawTimes[rIdx + 1] - rawTimes[rIdx]) < 5) {
          let sIdx = rIdx;
          let eIdx = rIdx + 1;
          while (eIdx < N - 1 && (rawTimes[eIdx] - rawTimes[sIdx]) < 8) {
            eIdx++;
          }
          while ((rawTimes[eIdx] - rawTimes[sIdx]) < 5 && sIdx > 0) {
            sIdx--;
          }
          const t0 = rawTimes[sIdx];
          const t1 = Math.max(t0, rawTimes[eIdx]);
          const winSpan = t1 - t0;
          if (winSpan > 0 && eIdx - sIdx >= 2) {
            const cum = new Array(eIdx - sIdx + 1);
            cum[0] = 0;
            for (let k = sIdx + 1; k <= eIdx; k++) {
              cum[k - sIdx] = cum[k - sIdx - 1] + ptDist(pts[k - 1], pts[k]);
            }
            const totalLen = cum[cum.length - 1];
            for (let k = sIdx + 1; k < eIdx; k++) {
              const ratio = totalLen > 1e-6
                ? (cum[k - sIdx] / totalLen)
                : ((k - sIdx) / (eIdx - sIdx));
              rawTimes[k] = t0 + winSpan * ratio;
            }
          }
          rIdx = eIdx;
        } else {
          rIdx++;
        }
      }

      const slicedPts = [pts[0]];
      let interpTip = pts[0];

      for (let i = 0; i < N - 1; i++) {
        const pA = pts[i];
        const pB = pts[i + 1];
        const tA = rawTimes[i];
        const tB = Math.max(tA, rawTimes[i + 1]);

        if (playMs >= tB) {
          slicedPts.push(pB);
          interpTip = pB;
        } else if (playMs > tA) {
          const segSpan = Math.max(0.001, tB - tA);
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
      // Shift + 드래그 즉시 직선(shapeSnapAt <= tStart + 1)인 경우 재생 중 끝점이 보간된 펜촉(interpTip)을 실시간 추종!
      const useSnappedShape = Boolean((stroke.shape || stroke.cardShape) && playMs >= shapeSnapMs);
      const isInstantLineShape = Boolean(
        useSnappedShape &&
        typeof stroke.shapeSnapAt === 'number' &&
        stroke.shapeSnapAt <= tStart + 1
      );
      const liveShape = (isInstantLineShape && stroke.shape && stroke.shape.type === 'line' && interpTip && interpTip.x !== undefined)
        ? { ...stroke.shape, end: { x: interpTip.x, y: interpTip.y } }
        : (useSnappedShape ? stroke.shape : null);
      const liveCardShape = (isInstantLineShape && stroke.cardShape && stroke.cardShape.type === 'line' && interpTip && interpTip.nx !== undefined)
        ? { ...stroke.cardShape, end: { nx: interpTip.nx, ny: interpTip.ny } }
        : (useSnappedShape ? stroke.cardShape : null);
      return {
        stroke: {
          ...stroke,
          points: slicedPts,
          shape: liveShape,
          cardShape: liveCardShape,
          isShape: useSnappedShape
        },
        isCurrentlyWriting: true,
        isActiveHighlight: true,
        tipPoint: interpTip
      };
    }

    _releaseAudioReplayInkCanvases() {
      if (!this._replayInkBakeMap || typeof this._replayInkBakeMap !== 'object') {
        this._replayInkBakeMap = null;
        return;
      }
      Object.keys(this._replayInkBakeMap).forEach((slot) => {
        const entry = this._replayInkBakeMap[slot];
        if (entry && entry.canvas) {
          try {
            entry.canvas.width = 1;
            entry.canvas.height = 1;
          } catch (_) { }
          entry.canvas = null;
        }
      });
      this._replayInkBakeMap = null;
    }

    _drawAudioReplayInkStrokes(ctx, filterTarget = null) {
      const playMs = this.audioPlayCurrentMs || 0;
      const viewMode = this.audioReplayViewMode || 'video';
      const activeErased = (viewMode === 'video' && this.audioSyncData && Array.isArray(this.audioSyncData.erasedStrokes))
        ? this.audioSyncData.erasedStrokes.filter(st => st && !st.cardKey && (typeof st.erasedAt !== 'number' || playMs < st.erasedAt))
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

      const curLassoState = (viewMode === 'video' && this._currentAppliedAudioKeyframe && this._currentAppliedAudioKeyframe.lassoState)
        ? this._currentAppliedAudioKeyframe.lassoState
        : null;
      const activeLassoOpId = (curLassoState && curLassoState.opId) ? curLassoState.opId : null;

      const completedReps = [];
      const transformingReps = [];
      const writingReps = [];
      for (let i = 0; i < candidates.length; i++) {
        const cand = candidates[i];
        const rep = this.getPartialStrokeForReplay(cand, playMs, viewMode);
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
              isHighlighter: Boolean(rep.stroke.isHighlighter),
              isDashed: Boolean(rep.stroke.isDashed)
            };
          }
        } else if (
          activeLassoOpId &&
          cand._lassoOpId === activeLassoOpId &&
          (typeof cand._lassoOpStartMs !== 'number' || playMs >= cand._lassoOpStartMs)
        ) {
          transformingReps.push(rep);
        } else {
          completedReps.push(rep);
        }
      }

      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
      const isLight = curTheme.isLight || this.isMonochromeMode;
      const applyLassoOpTransform = (targetCtx) => {
        if (!curLassoState || !activeLassoOpId) return;
        const ax = Number(curLassoState.ax) || 0;
        const ay = Number(curLassoState.ay) || 0;
        if (curLassoState.mode === 'resize') {
          const sc = Math.max(0.1, Number(curLassoState.scale) || 1);
          targetCtx.translate(ax, ay);
          targetCtx.scale(sc, sc);
          targetCtx.translate(-ax, -ay);
        } else if (curLassoState.mode === 'rotate') {
          const ang = Number(curLassoState.angle) || 0;
          targetCtx.translate(ax, ay);
          targetCtx.rotate(ang);
          targetCtx.translate(-ax, -ay);
        } else if (curLassoState.mode === 'flipX' || curLassoState.mode === 'flipY') {
          const rawFs = typeof curLassoState.flipScale === 'number' ? curLassoState.flipScale : 1;
          const fs = Math.abs(rawFs) < 0.04 ? (rawFs < 0 ? -0.04 : 0.04) : rawFs;
          targetCtx.translate(ax, ay);
          if (curLassoState.mode === 'flipX') targetCtx.scale(fs, 1);
          else targetCtx.scale(1, fs);
          targetCtx.translate(-ax, -ay);
        } else {
          targetCtx.translate(Number(curLassoState.dx) || 0, Number(curLassoState.dy) || 0);
        }
      };
      const drawRepsBatch = (targetCtx, repsList, useLassoTransform = false) => {
        if (!repsList || repsList.length === 0) return;
        targetCtx.save();
        if (useLassoTransform) applyLassoOpTransform(targetCtx);
        for (let pass = 0; pass < 4; pass++) {
          for (let i = 0; i < repsList.length; i++) {
            const st = repsList[i] && repsList[i].stroke;
            if (!st) continue;
            const stPass = (typeof this._getStrokeRenderPass === 'function')
              ? this._getStrokeRenderPass(st)
              : (st.isHighlighter ? 1 : 3);
            if (stPass !== pass) continue;
            this.renderSingleStroke(targetCtx, st, null, false);
          }
        }
        targetCtx.restore();
        if ((!filterTarget || filterTarget === 'board') && !isLight && !this.isMonochromeMode) {
          const cardRects = (typeof this._getVisibleWhiteProblemCardScreenRects === 'function')
            ? this._getVisibleWhiteProblemCardScreenRects(false)
            : [];
          if (cardRects.length > 0) {
            const whiteReps = repsList.filter(item => {
              const s = item.stroke;
              if (!s || s.isGraphStamp || s.isHighlighter || (s.target || 'board') !== 'board') return false;
              const c = (s.color || '').toLowerCase();
              return (c === '#ffffff' || c === '#fff');
            });
            if (whiteReps.length > 0) {
              targetCtx.save();
              targetCtx.beginPath();
              for (let rIdx = 0; rIdx < cardRects.length; rIdx++) {
                const r = cardRects[rIdx];
                targetCtx.rect(r.x, r.y, r.w, r.h);
              }
              targetCtx.clip();
              if (useLassoTransform) applyLassoOpTransform(targetCtx);
              whiteReps.forEach(item => this.renderSingleStroke(targetCtx, item.stroke, '#0f172a', false));
              targetCtx.restore();
            }
          }
        }
      };

      // 🌟 [리플레이 오프스크린 베이크 캐시]: 메인 캔버스와 100% 동일한 초고해상도 DPR(getCanvasDpr = 2.0~2.5x) + 오버스캔 아핀 패닝 + Pass-3 증분 베이킹!
      if (ctx === this.ctx && completedReps.length > 0) {
        const targetSlot = filterTarget || 'all';
        const replayCardRects = (!isLight && !this.isMonochromeMode && typeof this._getVisibleWhiteProblemCardScreenRects === 'function')
          ? this._getVisibleWhiteProblemCardScreenRects(false)
          : [];
        const pRectKey = replayCardRects.length > 0
          ? replayCardRects.map(r => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`).join(';')
          : 'none';
        const dpr = this.getCanvasDpr();
        const sw = Math.max(1, this.screenWidth || (this.canvas ? Math.round(this.canvas.width / dpr) : 1280) || 1280);
        const sh = Math.max(1, this.screenHeight || (this.canvas ? Math.round(this.canvas.height / dpr) : 720) || 720);
        const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
        let padCss = (targetSlot === 'board' || targetSlot === 'graph')
          ? (isIOS ? Math.min(160, Math.round(Math.min(sw, sh) * 0.20)) : Math.min(260, Math.round(Math.min(sw, sh) * 0.30)))
          : 0;
        const maxSidePx = Math.max(Math.round(sw * dpr) + 64, Math.round(sh * dpr) + 64, isIOS ? 3200 : 3840);
        if (Math.round((sw + padCss * 2) * dpr) > maxSidePx || Math.round((sh + padCss * 2) * dpr) > maxSidePx) {
          padCss = Math.max(0, Math.floor((maxSidePx / dpr - Math.max(sw, sh)) * 0.5));
        }
        const maxTotalPx = isIOS ? 6000000 : 11000000;
        let bw = Math.max(1, Math.round((sw + padCss * 2) * dpr));
        let bh = Math.max(1, Math.round((sh + padCss * 2) * dpr));
        if (bw * bh > maxTotalPx && padCss > 0) {
          const scale = Math.sqrt(maxTotalPx / (bw * bh));
          padCss = Math.max(0, Math.floor((Math.min(bw, bh) * scale / dpr - Math.min(sw, sh)) * 0.5));
          bw = Math.max(1, Math.round((sw + padCss * 2) * dpr));
          bh = Math.max(1, Math.round((sh + padCss * 2) * dpr));
        }

        if (!this._replayInkBakeMap) {
          this._replayInkBakeMap = {};
        }
        if (!this._replayInkBakeMap[targetSlot]) {
          this._replayInkBakeMap[targetSlot] = {
            canvas: document.createElement('canvas'),
            metaKey: '',
            count: 0,
            rollHash: 0,
            cam: null,
            lastSeenCamSig: '',
            lastCamMovePerf: 0
          };
        }
        const bakeEntry = this._replayInkBakeMap[targetSlot];
        const bakeCanvas = bakeEntry.canvas;
        if (bakeCanvas.width !== bw || bakeCanvas.height !== bh) {
          bakeCanvas.width = bw;
          bakeCanvas.height = bh;
          bakeEntry.metaKey = '';
          bakeEntry.count = 0;
          bakeEntry.cam = null;
        }

        const prevCount = bakeEntry.count || 0;
        let strokesRollHash = 2166136261;
        let prefixHashAtPrevCount = 0;
        for (let rIdx = 0; rIdx < completedReps.length; rIdx++) {
          const st = completedReps[rIdx] && completedReps[rIdx].stroke;
          if (st) {
            const sc = (st.isGraphStamp && st.graphStamp && st.graphStamp.kind === 'image') ? st._stampCache : null;
            const stampImgTag = sc
              ? ((sc.img && sc.img.complete && sc.img.naturalWidth > 0)
                ? `${sc.img.naturalWidth}x${sc.img.naturalHeight}:${sc.imgUrl ? sc.imgUrl.length : 0}`
                : ((sc.liveDrawable && ((sc.liveDrawable.width > 4 && !sc.liveDrawable._evicted) || (sc.liveDrawable.complete && sc.liveDrawable.naturalWidth > 0))) ? 'live' : '0'))
              : ((st.isGraphStamp && st.graphStamp && st.graphStamp.kind === 'image') ? '0' : '');
            const token = `${st.id || st.tStart || rIdx}:${st.points ? st.points.length : 0}:${st.shape ? (st.shape.type || '1') : ''}:${st.isDashed ? 1 : 0}:${st.color || ''}:${Math.round((st.size || 0) * 10)}:${Math.round((st.softBlur || 0) * 10)}:${stampImgTag}`;
            for (let cIdx = 0; cIdx < token.length; cIdx++) {
              strokesRollHash ^= token.charCodeAt(cIdx);
              strokesRollHash = Math.imul(strokesRollHash, 16777619) >>> 0;
            }
          }
          if (rIdx + 1 === prevCount) {
            prefixHashAtPrevCount = strokesRollHash >>> 0;
          }
        }
        strokesRollHash = strokesRollHash >>> 0;

        const metaKey = [
          targetSlot,
          Boolean(this.pdfPageBoardData),
          bw,
          bh,
          padCss,
          this.currentThemeKey,
          Boolean(this.isMonochromeMode),
          pRectKey
        ].join('|');
        const curCam = {
          panX: this.panX || 0,
          panY: this.panY || 0,
          zoomLevel: this.zoomLevel || 1.0,
          boardPanX: this.boardPanX || 0,
          boardPanY: this.boardPanY || 0,
          boardZoom: this.boardZoom || 1.0,
          boardZoomOffsetX: this.boardZoomOffsetX || 0,
          boardZoomOffsetY: this.boardZoomOffsetY || 0,
          padCss
        };
        const curCamSig = (targetSlot === 'board')
          ? `${Math.round((curCam.boardPanX + curCam.boardZoomOffsetX) * 10)}:${Math.round((curCam.boardPanY + curCam.boardZoomOffsetY) * 10)}:${Math.round(curCam.boardZoom * 1000)}`
          : `${Math.round(curCam.panX * 10)}:${Math.round(curCam.panY * 10)}:${Math.round(curCam.zoomLevel * 1000)}`;
        const nowPerf = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
        if (bakeEntry.lastSeenCamSig !== curCamSig) {
          bakeEntry.lastSeenCamSig = curCamSig;
          bakeEntry.lastCamMovePerf = nowPerf;
        }

        const calcAffineFromBakedCam = (cam) => {
          if (!cam) return null;
          if (targetSlot === 'board') {
            const bz0 = cam.boardZoom || 1.0;
            const bz1 = curCam.boardZoom || 1.0;
            const s = bz1 / bz0;
            const tx = (curCam.boardPanX + curCam.boardZoomOffsetX) - (cam.boardPanX + cam.boardZoomOffsetX) * s;
            const ty = (curCam.boardPanY + curCam.boardZoomOffsetY) - (cam.boardPanY + cam.boardZoomOffsetY) * s;
            return { s, tx, ty, pad: cam.padCss || 0 };
          }
          if (targetSlot === 'graph') {
            const z0 = cam.zoomLevel || 1.0;
            const z1 = curCam.zoomLevel || 1.0;
            const s = z1 / z0;
            const tx = (sw * 0.5 + curCam.panX) - (sw * 0.5 + cam.panX) * s;
            const ty = (sh * 0.5 + curCam.panY) - (sh * 0.5 + cam.panY) * s;
            return { s, tx, ty, pad: cam.padCss || 0 };
          }
          return null;
        };

        const aff = (bakeEntry.metaKey === metaKey && bakeEntry.cam) ? calcAffineFromBakedCam(bakeEntry.cam) : null;
        const isExactCam = Boolean(aff && Math.abs(aff.s - 1) < 1e-4 && Math.abs(aff.tx) < 0.05 && Math.abs(aff.ty) < 0.05);
        const canAffineCoverScreen = Boolean(
          aff &&
          !isExactCam &&
          this.isAudioPlaying &&
          (nowPerf - (bakeEntry.lastCamMovePerf || 0) < 120) &&
          aff.pad > 0 &&
          aff.s >= 0.85 &&
          aff.s <= 1.18 &&
          (aff.tx - aff.pad * aff.s) <= 1 &&
          (aff.ty - aff.pad * aff.s) <= 1 &&
          (aff.tx + (sw + aff.pad) * aff.s) >= (sw - 1) &&
          (aff.ty + (sh + aff.pad) * aff.s) >= (sh - 1)
        );

        const sameStrokes = (bakeEntry.metaKey === metaKey && bakeEntry.count === completedReps.length && bakeEntry.rollHash === strokesRollHash);
        let didIncremental = false;
        if (
          !sameStrokes &&
          isExactCam &&
          bakeEntry.metaKey === metaKey &&
          prevCount > 0 &&
          completedReps.length > prevCount &&
          (completedReps.length - prevCount) <= 4 &&
          prefixHashAtPrevCount === bakeEntry.rollHash
        ) {
          let allNewTopPass = true;
          for (let k = prevCount; k < completedReps.length; k++) {
            const nSt = completedReps[k] && completedReps[k].stroke;
            const nPass = nSt
              ? ((typeof this._getStrokeRenderPass === 'function') ? this._getStrokeRenderPass(nSt) : (nSt.isHighlighter ? 1 : 3))
              : -1;
            if (nPass !== 3) {
              allNewTopPass = false;
              break;
            }
          }
          if (allNewTopPass) {
            const bCtx = bakeCanvas.getContext('2d');
            if (bCtx) {
              bCtx._isReplayBakeCtx = true;
              bCtx._cullPadX = padCss;
              bCtx._cullPadY = padCss;
              bCtx.save();
              bCtx.setTransform(dpr, 0, 0, dpr, padCss * dpr, padCss * dpr);
              drawRepsBatch(bCtx, completedReps.slice(prevCount), false);
              bCtx.restore();
              bakeEntry.count = completedReps.length;
              bakeEntry.rollHash = strokesRollHash;
              didIncremental = true;
            }
          }
        }

        const needFullRebake = !didIncremental && !(sameStrokes && (isExactCam || canAffineCoverScreen));
        if (needFullRebake) {
          const bCtx = bakeCanvas.getContext('2d');
          if (bCtx) {
            bCtx._isReplayBakeCtx = true;
            bCtx._cullPadX = padCss;
            bCtx._cullPadY = padCss;
            bCtx.save();
            bCtx.setTransform(dpr, 0, 0, dpr, padCss * dpr, padCss * dpr);
            bCtx.clearRect(-padCss, -padCss, sw + padCss * 2, sh + padCss * 2);
            drawRepsBatch(bCtx, completedReps, false);
            bCtx.restore();
            bakeEntry.metaKey = metaKey;
            bakeEntry.count = completedReps.length;
            bakeEntry.rollHash = strokesRollHash;
            bakeEntry.cam = curCam;
          }
        }

        const blitAff = (bakeEntry.cam && bakeEntry.cam !== curCam) ? calcAffineFromBakedCam(bakeEntry.cam) : null;
        ctx.save();
        if (blitAff && (Math.abs(blitAff.s - 1) >= 1e-4 || Math.abs(blitAff.tx) >= 0.05 || Math.abs(blitAff.ty) >= 0.05)) {
          ctx.setTransform(blitAff.s, 0, 0, blitAff.s, (blitAff.tx - blitAff.pad * blitAff.s) * dpr, (blitAff.ty - blitAff.pad * blitAff.s) * dpr);
        } else {
          const bPad = (bakeEntry.cam && typeof bakeEntry.cam.padCss === 'number') ? bakeEntry.cam.padCss : padCss;
          ctx.setTransform(1, 0, 0, 1, -bPad * dpr, -bPad * dpr);
        }
        ctx.drawImage(bakeCanvas, 0, 0);
        ctx.restore();
      } else {
        drawRepsBatch(ctx, completedReps, false);
      }

      // 올가미 드래그 이동 / 4모퉁이 리사이즈 중인 선택 획들을 실시간 아핀 변환으로 60~144fps 렌더링!
      if (transformingReps.length > 0) {
        drawRepsBatch(ctx, transformingReps, true);
      }

      // 현재 실시간으로 쓰이고 있는 중인 단 1개의 획만 매 프레임 라이브로 렌더링!
      drawRepsBatch(ctx, writingReps, false);
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

    _setIosAudioSessionMode(mode) {
      if (typeof navigator === 'undefined' || !navigator.audioSession) return;
      try {
        if (navigator.audioSession.type !== mode) {
          navigator.audioSession.type = mode;
        }
      } catch (_) { }
    }

    _ensureAudioPlayerElement() {
      if (!this.audioPlayerEl) {
        this.audioPlayerEl = new Audio();
        this.audioPlayerEl.preload = 'auto';
        this.audioPlayerEl.playsInline = true;
        try {
          this.audioPlayerEl.setAttribute('playsinline', '');
          this.audioPlayerEl.setAttribute('webkit-playsinline', '');
        } catch (_) { }
      }
      return this.audioPlayerEl;
    }

    _unlockAudioPlayerForMobileGesture(needsAsyncPrime = false) {
      if (this.isAudioRecording) return;
      this._setIosAudioSessionMode('playback');
      const player = this._ensureAudioPlayerElement();
      if (!needsAsyncPrime || this._audioPlayerGestureUnlocked || this.isAudioPlaying) return;
      const seq = (this._audioUnlockSeq = (this._audioUnlockSeq || 0) + 1);
      this._audioPlayerGestureUnlocked = true;
      this._activeAudioSegmentIdx = -1;
      try {
        player.src = this._createSilentWavDataUrl(40);
        const p = player.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            if (this._audioUnlockSeq === seq && !this.isAudioPlaying && this.audioPlayerEl === player) {
              try { player.pause(); } catch (_) { }
            }
          }).catch((err) => {
            if (this._audioUnlockSeq === seq && (!err || err.name !== 'AbortError')) {
              this._audioPlayerGestureUnlocked = false;
            }
          });
        }
      } catch (_) {
        this._audioPlayerGestureUnlocked = false;
      }
    }

    _isSilentStubAudioSegment(seg) {
      if (!seg || !seg.audioDataUrl) return true;
      if (seg.mimeType === 'audio/wav') return true;
      if (typeof seg.audioDataUrl === 'string' && seg.audioDataUrl.startsWith('data:audio/wav')) return true;
      return false;
    }

    _resolvePlayableAudioUrlForSegment(seg) {
      if (!seg || typeof seg.audioDataUrl !== 'string' || !seg.audioDataUrl) return '';
      const rawUrl = seg.audioDataUrl;
      if (this._isSilentStubAudioSegment(seg) || !rawUrl.startsWith('data:') || rawUrl.length <= 2048) {
        return rawUrl;
      }
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof atob !== 'function') {
        return rawUrl;
      }
      if (!(this._audioReplayBlobUrlMap instanceof Map)) {
        this._audioReplayBlobUrlMap = new Map();
      }
      const cacheKey = `${seg.segUid || 'seg'}_${rawUrl.length}_${rawUrl.slice(-36)}`;
      const existingBlobUrl = this._audioReplayBlobUrlMap.get(cacheKey);
      if (existingBlobUrl) {
        return existingBlobUrl;
      }
      try {
        const commaIdx = rawUrl.indexOf(',');
        if (commaIdx < 0) return rawUrl;
        const header = rawUrl.slice(5, commaIdx);
        const isBase64 = header.includes(';base64');
        if (!isBase64) return rawUrl;
        const mime = (seg.mimeType && seg.mimeType !== 'audio/wav')
          ? seg.mimeType
          : (header.split(';')[0] || 'audio/webm');
        const b64 = rawUrl.slice(commaIdx + 1);
        const binStr = atob(b64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        if (this._audioReplayBlobUrlMap.size >= 24) {
          const curActiveSrc = this.audioPlayerEl ? this.audioPlayerEl.src : '';
          for (const [oldKey, oldUrl] of this._audioReplayBlobUrlMap.entries()) {
            if (oldUrl !== curActiveSrc) {
              try { URL.revokeObjectURL(oldUrl); } catch (_) { }
              this._audioReplayBlobUrlMap.delete(oldKey);
              break;
            }
          }
        }
        this._audioReplayBlobUrlMap.set(cacheKey, blobUrl);
        return blobUrl;
      } catch (_) {
        return rawUrl;
      }
    }

    _revokeAudioReplayObjectUrls() {
      this._clearPendingAudioMetaSeek();
      if (!(this._audioReplayBlobUrlMap instanceof Map) || this._audioReplayBlobUrlMap.size === 0) return;
      if (this.audioPlayerEl && typeof this.audioPlayerEl.src === 'string' && this.audioPlayerEl.src.startsWith('blob:')) {
        try {
          this.audioPlayerEl.pause();
          this.audioPlayerEl.removeAttribute('src');
          this.audioPlayerEl.load();
        } catch (_) { }
        this._activeAudioSegmentIdx = -1;
      }
      for (const blobUrl of this._audioReplayBlobUrlMap.values()) {
        try { URL.revokeObjectURL(blobUrl); } catch (_) { }
      }
      this._audioReplayBlobUrlMap.clear();
    }

    _clearPendingAudioMetaSeek() {
      if (typeof this._pendingAudioMetaSeekCleanup === 'function') {
        const cleanupFn = this._pendingAudioMetaSeekCleanup;
        this._pendingAudioMetaSeekCleanup = null;
        try { cleanupFn(); } catch (_) { }
      }
    }

    _syncAudioPlayerToPlayMs(playMs, shouldPlay = false) {
      if (!this.audioSyncData) return null;
      this._ensureAudioPlayerElement();
      const seg = this._getActiveAudioSegmentAt(playMs);
      if (!seg || !seg.audioDataUrl) {
        this._clearPendingAudioMetaSeek();
        this._audioReadyGate = null;
        this._pllLargeDriftFrames = 0;
        return seg;
      }
      const isSilentStub = this._isSilentStubAudioSegment(seg);
      const playableUrl = this._resolvePlayableAudioUrlForSegment(seg);
      const srcChanged = (this.audioPlayerEl.src !== playableUrl);
      const segChanged = (this._activeAudioSegmentIdx !== seg.idx || srcChanged);
      if (segChanged) {
        this._activeAudioSegmentIdx = seg.idx;
      }
      if (srcChanged) {
        this._clearPendingAudioMetaSeek();
        this.audioPlayerEl.src = playableUrl;
      }
      try {
        const effRate = this.audioPlaybackRate || 1.0;
        this.audioPlayerEl.defaultPlaybackRate = effRate;
        this.audioPlayerEl.playbackRate = effRate;
      } catch (e) { }
      const localSec = Math.max(0, (playMs - (seg.startMs || 0)) / 1000);
      const needSeekAdjust = Boolean(srcChanged || segChanged || Math.abs((this.audioPlayerEl.currentTime || 0) - localSec) > 0.08);
      if (needSeekAdjust) {
        this._clearPendingAudioMetaSeek();
      }
      const gateToken = (this._audioReadyGateSeq = (this._audioReadyGateSeq || 0) + 1);
      let pendingMetaSeek = false;
      const playSeq = shouldPlay ? (this._audioUnlockSeq = (this._audioUnlockSeq || 0) + 1) : (this._audioUnlockSeq || 0);

      const handlePlayError = (err) => {
        if (this._audioUnlockSeq !== playSeq || !this.isAudioPlaying) return;
        if (err && err.name === 'NotAllowedError') {
          this._audioReadyGate = null;
          this.pauseAudioPlayback(false);
          this.showAudioPlayerBarTemporarily(6000);
          this.showToast('🔊 화면 하단의 [▶] 재생 버튼을 한 번 눌러 음성을 켜주세요.');
        } else if (err && err.name === 'NotSupportedError' && !this._notifiedAudioCodecUnsupported) {
          this._audioReadyGate = null;
          this._notifiedAudioCodecUnsupported = true;
          if (typeof this.showImportantAlertModal === 'function') {
            this.showImportantAlertModal({
              title: '음성 코덱 지원 안내',
              descHtml: '현재 기기 브라우저의 버전이 낮아 음성 재생이 지원되지 않습니다.<br>필기 영상은 정상 재생되며, 음성을 들으시려면 기기 OS 업데이트 또는 크롬·PC 환경에서 시청해 주세요.',
              isDanger: false
            });
          } else {
            this.showToast('ℹ️ 현재 기기 브라우저에서 음성 코덱이 제한되어 필기 영상으로 재생됩니다.');
          }
        } else {
          this._audioReadyGate = null;
        }
      };

      const startElementPlayNow = () => {
        if (!shouldPlay || !this.audioPlayerEl || this._audioUnlockSeq !== playSeq || !this.isAudioPlaying) return;
        this._setIosAudioSessionMode('playback');
        try {
          const playPromise = this.audioPlayerEl.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => {
              this._audioPlayerGestureUnlocked = true;
            }).catch(handlePlayError);
          }
        } catch (e) {
          this._audioReadyGate = null;
        }
      };

      if (srcChanged && localSec <= 0.05) {
        try {
          if (this.audioPlayerEl.readyState >= 1) {
            this.audioPlayerEl.currentTime = 0;
          }
        } catch (e) { }
      } else if (needSeekAdjust) {
        try {
          const targetSec = localSec;
          const expectedSrc = playableUrl;
          let canceled = false;
          let metaFallbackTimer = null;

          const clearMetaStageOnly = () => {
            if (metaFallbackTimer) {
              clearTimeout(metaFallbackTimer);
              metaFallbackTimer = null;
            }
            if (this.audioPlayerEl) {
              this.audioPlayerEl.removeEventListener('loadedmetadata', onMeta);
              this.audioPlayerEl.removeEventListener('error', onErr);
            }
            if (this._audioReadyGate && this._audioReadyGate.token === gateToken) {
              this._audioReadyGate.pendingMetaSeek = false;
              this._audioReadyGate.postSeekSampleSec = null;
            }
          };

          const clearAllPending = () => {
            canceled = true;
            clearMetaStageOnly();
            if (this.audioPlayerEl) {
              this.audioPlayerEl.removeEventListener('canplay', onCanPlayVerify);
            }
            if (this._pendingAudioMetaSeekCleanup === clearAllPending) {
              this._pendingAudioMetaSeekCleanup = null;
            }
          };

          const onCanPlayVerify = () => {
            if (this._pendingAudioMetaSeekCleanup === clearAllPending) {
              this._pendingAudioMetaSeekCleanup = null;
            }
            if (canceled) return;
            if (this.audioPlayerEl && this.audioPlayerEl.src === expectedSrc && Math.abs((this.audioPlayerEl.currentTime || 0) - targetSec) > 0.6) {
              try { this.audioPlayerEl.currentTime = targetSec; } catch (_) { }
              if (this._audioReadyGate && this._audioReadyGate.token === gateToken) {
                this._audioReadyGate.postSeekSampleSec = null;
              }
            }
          };

          let playTriggeredAfterMeta = false;
          const onMeta = () => {
            if (canceled) return;
            clearMetaStageOnly();
            if (this.audioPlayerEl && this.audioPlayerEl.src === expectedSrc) {
              try { this.audioPlayerEl.currentTime = targetSec; } catch (e) { }
              if (this.audioPlayerEl.readyState < 3) {
                this.audioPlayerEl.addEventListener('canplay', onCanPlayVerify, { once: true });
              } else {
                onCanPlayVerify();
              }
            } else if (this._pendingAudioMetaSeekCleanup === clearAllPending) {
              this._pendingAudioMetaSeekCleanup = null;
            }
            if (shouldPlay && !playTriggeredAfterMeta) {
              playTriggeredAfterMeta = true;
              startElementPlayNow();
            }
          };

          const onErr = () => {
            if (canceled) return;
            clearAllPending();
            if (shouldPlay && !playTriggeredAfterMeta) {
              playTriggeredAfterMeta = true;
              startElementPlayNow();
            }
          };

          if (this.audioPlayerEl.readyState >= 1) {
            this.audioPlayerEl.currentTime = targetSec;
            if (targetSec > 0.05 && this.audioPlayerEl.readyState < 3) {
              this._pendingAudioMetaSeekCleanup = clearAllPending;
              this.audioPlayerEl.addEventListener('canplay', onCanPlayVerify, { once: true });
            }
          } else if (targetSec > 0.05) {
            pendingMetaSeek = true;
            this._pendingAudioMetaSeekCleanup = clearAllPending;
            this.audioPlayerEl.addEventListener('loadedmetadata', onMeta, { once: true });
            this.audioPlayerEl.addEventListener('error', onErr, { once: true });
            if (shouldPlay) {
              metaFallbackTimer = setTimeout(() => {
                metaFallbackTimer = null;
                if (canceled) return;
                if (!playTriggeredAfterMeta && this._audioUnlockSeq === playSeq && this.isAudioPlaying) {
                  playTriggeredAfterMeta = true;
                  if (this.audioPlayerEl && this.audioPlayerEl.src === expectedSrc && this.audioPlayerEl.readyState >= 1) {
                    try { this.audioPlayerEl.currentTime = targetSec; } catch (_) { }
                  }
                  startElementPlayNow();
                }
              }, 450);
            }
          }
        } catch (e) { }
      }

      if (isSilentStub) {
        this._audioReadyGate = null;
        this._pllLargeDriftFrames = 0;
      } else if ((shouldPlay || this.isAudioPlaying) && needSeekAdjust) {
        const readyNow = Boolean(!pendingMetaSeek && !this.audioPlayerEl.seeking && this.audioPlayerEl.readyState >= 2);
        this._audioReadyGate = {
          token: gateToken,
          active: true,
          startedAt: performance.now(),
          segIdx: seg.idx,
          segStartMs: seg.startMs || 0,
          targetLocalSec: localSec,
          pendingMetaSeek,
          retriedSeek: false,
          postSeekSampleSec: readyNow ? Number(this.audioPlayerEl.currentTime || 0) : null
        };
        this._pllLargeDriftFrames = 0;
      }

      if (shouldPlay && !pendingMetaSeek) {
        startElementPlayNow();
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

    _resolveValidNextSlideJump(curSeg) {
      if (!curSeg || !this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides)) {
        return null;
      }
      let targetIdx = -1;
      if (typeof curSeg.nextSlideUid === 'string' && curSeg.nextSlideUid) {
        targetIdx = this.lessonPlaylistSlides.findIndex(sl => sl && sl.slideUid === curSeg.nextSlideUid);
        if (targetIdx < 0) return null;
      } else if (typeof curSeg.nextSlideIdx === 'number') {
        targetIdx = curSeg.nextSlideIdx;
      } else {
        return null;
      }

      if (targetIdx < 0 || targetIdx >= this.lessonPlaylistSlides.length || targetIdx === this.lessonPlaylistIndex) {
        return null;
      }
      const targetSlide = this.lessonPlaylistSlides[targetIdx];
      const targetSync = targetSlide && targetSlide.audioSyncData;
      if (!targetSync || !(Number(targetSync.durationMs) > 0)) {
        return null;
      }
      const curSessionId = this.audioSyncData && this.audioSyncData.sessionId;
      const targetSessionId = targetSync.sessionId;
      if (curSessionId && targetSessionId && curSessionId !== targetSessionId) {
        return null;
      }
      const rawStartMs = typeof curSeg.nextSlideStartMs === 'number' ? Math.max(0, curSeg.nextSlideStartMs) : 0;
      if (rawStartMs > 0 && rawStartMs >= Number(targetSync.durationMs) - 20) {
        return null;
      }
      return { targetSlideIdx: targetIdx, targetStartMs: rawStartMs };
    }

    playAudioSync(fromMs = null, forceMode = null) {
      if (this._stoppingAudioRecordingPromise) {
        this._unlockAudioPlayerForMobileGesture(true);
        const pendingStop = this._stoppingAudioRecordingPromise;
        pendingStop.then(() => {
          if (!this.isAudioRecording && this.audioSyncData && this.audioSyncData.durationMs > 0) {
            this.playAudioSync(fromMs, forceMode);
          }
        }).catch(() => { });
        return;
      }
      if (!this.audioSyncData || !this.audioSyncData.durationMs) return;
      if (!this.isStudentAudioVideoOnlyMode && !this._isAudioReplayActive && !this._preReplayLiveState) {
        try {
          this._preReplayLiveState = this._captureAudioWorkspaceKeyframe();
        } catch (_) { }
      }
      if (typeof this.hideAudioLectureEndingOverlay === 'function') {
        this.hideAudioLectureEndingOverlay();
      }
      if (forceMode) {
        this.audioReplayViewMode = forceMode;
      }
      const dur = this.audioSyncData.durationMs;
      if (typeof fromMs === 'number') {
        this.audioPlayCurrentMs = Math.max(0, Math.min(dur, fromMs));
      } else if (this.audioPlayCurrentMs >= dur - 50) {
        this.audioPlayCurrentMs = 0;
      }

      if (typeof this.closeInkShapesPopover === 'function') this.closeInkShapesPopover();
      if (typeof this.closeInkClipsPopover === 'function') this.closeInkClipsPopover();
      this._isAudioSyncPlayerVisible = true;
      this._isAudioReplayActive = true;
      this.isAudioPlaying = true;
      this._lastAppliedAudioStateObj = null;
      document.body.classList.add('audio-replay-active');
      if (this.isStudentAudioVideoOnlyMode) {
        this._acquireAudioRecordWakeLock();
      }
      this._syncReplayFixedStageLayout();
      this.showAudioPlayerBarTemporarily(2800);

      this._syncAudioPlayerToPlayMs(this.audioPlayCurrentMs || 0, true);

      this._audioPlayWallStartMs = performance.now();
      this._audioPlayBaseOffsetMs = this.audioPlayCurrentMs || 0;
      this._lastStepReplayMs = this._audioPlayBaseOffsetMs;
      this._replayStationaryAnchor = null;
      if (this.virtualStylusEl) this.virtualStylusEl.style.opacity = '1';

      if (this._audioReplayRafId) {
        cancelAnimationFrame(this._audioReplayRafId);
        this._audioReplayRafId = null;
      }

      const stepReplay = () => {
        if (!this.isAudioPlaying || !this.audioSyncData) return;
        const nowPerf = performance.now();

        const segs = (Array.isArray(this.audioSyncData.audioSegments) && this.audioSyncData.audioSegments.length > 0)
          ? this.audioSyncData.audioSegments
          : null;
        const curSegIdx = (typeof this._activeAudioSegmentIdx === 'number' && this._activeAudioSegmentIdx >= 0)
          ? this._activeAudioSegmentIdx
          : 0;
        const curSeg = segs && segs[curSegIdx]
          ? segs[curSegIdx]
          : this._getActiveAudioSegmentAt(this._audioPlayBaseOffsetMs || 0);
        const isSilentStubSeg = this._isSilentStubAudioSegment(curSeg);
        const maxDur = this.audioSyncData.durationMs || 1000;
        const segBaseMs = curSeg ? (curSeg.startMs || 0) : 0;
        const segMaxMs = curSeg ? curSeg.endMs : maxDur;
        const el = this.audioPlayerEl;

        if (el && Number.isFinite(el.currentTime)) {
          if (Math.abs(el.currentTime - (this._pllLastAudioTimeSec ?? -1)) > 0.0005) {
            this._pllLastAudioTimeSec = el.currentTime;
            this._pllLastAudioAdvancePerf = nowPerf;
          }
        }

        // 🌟 [오디오 디코딩·시크 실제 전진 감지 게이트]:
        // 초기 재생·배속 재생·스크러빙·왕복 복귀 시 <audio>가 목표 지점 시크를 끝내고 실제 샘플을 출력하기 전까지
        // 벽시계 선행 출발을 최대 1100ms 홀드하여 초반부터 영구 싱크가 벌어지는 현상을 원천 차단합니다.
        // (0.20초 무음 WAV 스텁, 파일 끝 도달, 코덱 미지원/에러 시에는 즉시 해제하여 멈춤 가능성 0% 보장)
        const gate = this._audioReadyGate;
        if (gate && gate.active) {
          const gateTimedOut = (nowPerf - (gate.startedAt || nowPerf)) > 1100;
          if (
            isSilentStubSeg ||
            !el ||
            el.ended ||
            el.error ||
            this._notifiedAudioCodecUnsupported ||
            gateTimedOut
          ) {
            gate.active = false;
            this._audioPlayWallStartMs = nowPerf;
          } else if (!gate.pendingMetaSeek && !el.seeking && el.readyState >= 2 && !el.paused && Number.isFinite(el.currentTime)) {
            const targetLocalSec = Number(gate.targetLocalSec) || 0;
            const isTargetReached = (targetLocalSec <= 0.15) || (Math.abs(el.currentTime - targetLocalSec) <= 1.2);
            if (!isTargetReached) {
              if (!gate.retriedSeek) {
                gate.retriedSeek = true;
                gate.postSeekSampleSec = null;
                try { el.currentTime = targetLocalSec; } catch (_) { }
              }
              this._audioPlayWallStartMs = nowPerf;
            } else if (typeof gate.postSeekSampleSec !== 'number') {
              gate.postSeekSampleSec = el.currentTime;
              this._audioPlayWallStartMs = nowPerf;
            } else if (el.currentTime > gate.postSeekSampleSec + 0.002) {
              gate.active = false;
              const readyAudioMs = segBaseMs + el.currentTime * 1000;
              const clampedReadyMs = Math.max(segBaseMs, Math.min(segMaxMs, readyAudioMs));
              this._audioPlayBaseOffsetMs = clampedReadyMs;
              this._audioPlayWallStartMs = nowPerf;
              this._pllLastAudioTimeSec = el.currentTime;
              this._pllLastAudioAdvancePerf = nowPerf;
              if (!(typeof this._lastStepReplayMs === 'number' && clampedReadyMs < this._lastStepReplayMs && (this._lastStepReplayMs - clampedReadyMs) < 480)) {
                this._lastStepReplayMs = clampedReadyMs;
                this._lastAppliedAudioStateObj = null;
              }
            } else {
              this._audioPlayWallStartMs = nowPerf;
            }
          } else {
            this._audioPlayWallStartMs = nowPerf;
          }
        }

        const wallElapsed = (nowPerf - this._audioPlayWallStartMs) * (this.audioPlaybackRate || 1.0);
        let nextMs = this._audioPlayBaseOffsetMs + wallElapsed;

        // 🌟 [120Hz 단조 증가 2단 PLL 오디오-비주얼 클럭 (Soft PLL + Hard Re-lock)]:
        // 1) 무음 WAV 폴백 스텁(0.20초 고정) 구간에서는 PLL을 완전히 끄고 순수 120Hz 벽시계로만 재생
        // 2) 실제 음성 구간에서 평소(±55ms 이내)는 120Hz 벽시계를 유지하고, 55~550ms 오차는 부드럽게 위상 보정(Soft PLL)
        // 3) 1.5~2배속·중간 시크·OS 스톨 등으로 오차가 550ms 이상 3프레임 연속 벌어지면 즉시 하드 재동기화(Hard Re-lock)!
        const isAudioActivelyAdvancing = (nowPerf - (this._pllLastAudioAdvancePerf || 0)) < 350;
        if (
          !(gate && gate.active) &&
          !isSilentStubSeg &&
          el &&
          !el.paused &&
          !el.ended &&
          !el.seeking &&
          el.readyState >= 2 &&
          Number.isFinite(el.currentTime) &&
          el.currentTime > 0.03 &&
          isAudioActivelyAdvancing
        ) {
          const audioMs = segBaseMs + el.currentTime * 1000;
          if (audioMs >= segBaseMs - 50 && audioMs <= segMaxMs + 300) {
            const drift = audioMs - nextMs;
            const absDrift = Math.abs(drift);
            if (absDrift >= 550) {
              this._pllLargeDriftFrames = (this._pllLargeDriftFrames || 0) + 1;
              if (this._pllLargeDriftFrames >= 3) {
                this._pllLargeDriftFrames = 0;
                const hardTargetMs = Math.max(segBaseMs, Math.min(segMaxMs, audioMs));
                this._audioPlayBaseOffsetMs = hardTargetMs;
                this._audioPlayWallStartMs = nowPerf;
                nextMs = hardTargetMs;
                this._lastStepReplayMs = hardTargetMs;
                this._lastAppliedAudioStateObj = null;
              }
            } else {
              this._pllLargeDriftFrames = 0;
              if (absDrift > 55) {
                const nudge = drift * 0.12;
                this._audioPlayBaseOffsetMs += nudge;
                nextMs += nudge;
              }
            }
          }
        } else {
          this._pllLargeDriftFrames = 0;
        }
        if (
          typeof this._lastStepReplayMs === 'number' &&
          nextMs < this._lastStepReplayMs &&
          (this._lastStepReplayMs - nextMs) < 480
        ) {
          nextMs = this._lastStepReplayMs;
        }
        this._lastStepReplayMs = nextMs;

        // 🌟 [슬라이드 간 왕복(3번 ➔ 2번 ➔ 3번) 세그먼트 경계 자동 전환 (학생 뷰어는 슬라이드별 개별 엔딩 보장을 위해 제외)]:
        if (curSeg && nextMs >= curSeg.endMs) {
          const validSegJump = !this.isStudentAudioVideoOnlyMode
            ? this._resolveValidNextSlideJump(curSeg)
            : null;
          if (validSegJump) {
            this.audioPlayCurrentMs = curSeg.endMs;
            this._renderAudioReplayAtCurrentTime();
            const keepViewMode = this.audioReplayViewMode || 'video';
            const targetSlideIdx = validSegJump.targetSlideIdx;
            const targetStartMs = validSegJump.targetStartMs;
            this.pauseAudioPlayback(false);
            this._replayViewerZoom = 1.0;
            this._replayViewerPanX = 0;
            this._replayViewerPanY = 0;
            this._isAutoAdvancingAudioSlide = true;
            try {
              this.jumpToPlaylistSlide(targetSlideIdx);
            } finally {
              this._isAutoAdvancingAudioSlide = false;
            }
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
            this._lastStepReplayMs = nextMs;
          }
        }

        if (nextMs >= maxDur) {
          this.audioPlayCurrentMs = maxDur;
          this._renderAudioReplayAtCurrentTime();
          const validEndJump = !this.isStudentAudioVideoOnlyMode
            ? this._resolveValidNextSlideJump(curSeg)
            : null;
          const hasExplicitNextSlide = Boolean(validEndJump);
          // 🌟 학생 뷰어 모드에서는 연속 촬영(nextSlideIdx) 여부와 무관하게 매 슬라이드 영상 종료 시마다 인터미션 오버레이(배너 + 2×2 버튼 + 3초 카운트)를 띄웁니다.
          const fallbackNextIdx = validEndJump
            ? validEndJump.targetSlideIdx
            : (this.lessonPlaylistIndex + 1);
          const fallbackNextStartMs = validEndJump
            ? validEndJump.targetStartMs
            : 0;
          if (
            !this.isStudentAudioVideoOnlyMode &&
            this.isLessonPlaylistActive &&
            Array.isArray(this.lessonPlaylistSlides) &&
            fallbackNextIdx >= 0 &&
            fallbackNextIdx < this.lessonPlaylistSlides.length &&
            fallbackNextIdx !== this.lessonPlaylistIndex &&
            this.lessonPlaylistSlides[fallbackNextIdx] &&
            this.lessonPlaylistSlides[fallbackNextIdx].audioSyncData &&
            this.lessonPlaylistSlides[fallbackNextIdx].audioSyncData.durationMs > 0 &&
            (hasExplicitNextSlide || fallbackNextIdx === this.lessonPlaylistIndex + 1)
          ) {
            const keepViewMode = this.audioReplayViewMode || 'video';
            this.pauseAudioPlayback(false);
            this._replayViewerZoom = 1.0;
            this._replayViewerPanX = 0;
            this._replayViewerPanY = 0;
            this._isAutoAdvancingAudioSlide = true;
            try {
              this.jumpToPlaylistSlide(fallbackNextIdx);
            } finally {
              this._isAutoAdvancingAudioSlide = false;
            }
            if (this._enteredAudioFromViewerSlideIdx !== null) {
              this._enteredAudioFromViewerSlideIdx = this.lessonPlaylistIndex;
            }
            this.playAudioSync(fallbackNextStartMs, keepViewMode);
            return;
          }
          this.pauseAudioPlayback(true);
          if (this.isStudentAudioVideoOnlyMode && typeof this.showAudioLectureEndingOverlay === 'function') {
            this.showAudioLectureEndingOverlay();
          }
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
      ['ctxSymmetryPopover', 'ctxAbsPopover', 'railResetBoardPopover', 'railAddTargetPopover', 'inkSizeFlyout', 'inkShapesPopover'].forEach(pId => {
        const popEl = document.getElementById(pId);
        if (popEl) {
          popEl.style.display = 'none';
          popEl._replayShapesForcedOpen = false;
        }
      });
      const sidebarRailReplayEl = document.getElementById('sidebarRail');
      if (sidebarRailReplayEl) sidebarRailReplayEl.classList.remove('has-add-target-popover');
      const btnShapes = document.getElementById('btnInkShapes');
      if (btnShapes) btnShapes.classList.remove('is-popover-open');
      document.querySelectorAll('.pip-hdr-popover').forEach(popEl => {
        if (popEl._replaySymForcedOpen) {
          popEl._replaySymForcedOpen = false;
          popEl.classList.remove('is-open');
          popEl.style.display = 'none';
        }
      });
      document.querySelectorAll('#problemCardWidget, #graphCardWidget, .extra-problem-card-widget, .extra-graph-card-widget').forEach(cEl => {
        cEl._replayPeekForcedOpen = false;
      });
      this._replayStationaryAnchor = null;
      this._replayBtnDwellCandEl = null;
      this._replayBtnDwellStartMs = 0;
      if (this.virtualStylusEl) {
        this.virtualStylusEl.style.opacity = '1';
      }
      const quickThemeEl = document.getElementById('panelQuickTheme');
      if (quickThemeEl) {
        quickThemeEl.classList.remove('open');
        if (quickThemeEl.style.display === 'block' || quickThemeEl.style.display === 'flex') {
          quickThemeEl.style.display = 'none';
        }
      }
    }

    _syncAudioReplaySmartUiAt(playMs, hoverCursor = null) {
      // 🌟 [실제 화면녹화급 네이티브 버튼 호버 & 클릭 피드백]:
      // 과한 네온 외곽선/확대(scale 1.05)를 걷어내고 실제 앱 호버 톤을 그대로 재현하므로,
      // 인위적인 75ms 지연 없이 포인터가 닿은 버튼을 1:1 실시간으로 자연스럽게 표시합니다.
      let nextBtnEl = (hoverCursor && hoverCursor.uiBtnKey && hoverCursor.cursorKind !== 'search')
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

      const isClickNow = Boolean(hoverCursor && hoverCursor.isDrawing);
      if (this._lastReplayHoveredBtnEl && this._lastReplayHoveredBtnEl !== nextBtnEl) {
        this._lastReplayHoveredBtnEl.classList.remove('replay-ui-btn-hover', 'replay-ui-btn-active');
        this._lastReplayHoveredBtnEl = null;
      }
      if (nextBtnEl) {
        nextBtnEl.classList.add('replay-ui-btn-hover');
        nextBtnEl.classList.toggle('replay-ui-btn-active', isClickNow);
        this._lastReplayHoveredBtnEl = nextBtnEl;
      }
    }

    _renderAudioReplayAtCurrentTime() {
      const playMs = this.audioPlayCurrentMs || 0;
      this._activeReplayTipScreen = null;
      this._applyAudioTimelineStateAt(playMs);
      this._syncPlanBReplayContextPopoversAt(playMs);
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
          : (this._activeReplayTipScreen.isHighlighter
            ? 'highlighter'
            : (this._activeReplayTipScreen.isDashed ? 'pen_dashed' : 'pen'));
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
      this._audioReadyGate = null;
      this._pllLargeDriftFrames = 0;
      if (!this.isAudioRecording) {
        this._releaseAudioRecordWakeLock();
      }
      this._clearAudioPlayerBarAutoHide();
      if (this._audioReplayRafId) {
        cancelAnimationFrame(this._audioReplayRafId);
        this._audioReplayRafId = null;
      }
      if (this.audioPlayerEl) {
        try { this.audioPlayerEl.pause(); } catch (e) { }
      }
      if (isEnded && this.audioSyncData && (this.audioSyncData.finalState || this._preReplayLiveState)) {
        const restoreState = (!this.isStudentAudioVideoOnlyMode && this._preReplayLiveState)
          ? this._preReplayLiveState
          : this.audioSyncData.finalState;
        if (!this.isStudentAudioVideoOnlyMode) {
          this._preReplayLiveState = null;
          this._isAudioReplayActive = false;
          document.body.classList.remove('audio-replay-active');
        }
        this._syncReplayFixedStageLayout();
        this._clearAudioReplaySmartUiState();
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        this._restoreTempReplayProblemCards();
        if (restoreState) {
          this._applyAudioWorkspaceKeyframe(restoreState);
        }
        if (!this._isAudioReplayActive) {
          this._currentAppliedAudioKeyframe = null;
          this._releaseAudioReplayInkCanvases();
          if (typeof this.syncLassoActionBarUI === 'function') this.syncLassoActionBarUI();
          if (!this.isStudentAudioVideoOnlyMode && typeof this.syncHideUiKeepUI === 'function') {
            this.syncHideUiKeepUI();
          }
        }
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
      if (!this._isAudioReplayActive && typeof this._syncStylusTipColors === 'function') {
        this._syncStylusTipColors();
      }
      this.syncAudioRecordUI();
    }

    stopAudioPlayback(restoreFinal = true) {
      if (typeof this.hideAudioLectureEndingOverlay === 'function') {
        this.hideAudioLectureEndingOverlay();
      }
      const wasReplayActive = Boolean(this._isAudioReplayActive || this.isAudioPlaying);
      const savedPreReplay = this._preReplayLiveState;
      this._preReplayLiveState = null;
      this._clearAudioPlayerBarAutoHide();
      this._clearPendingAudioMetaSeek();
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
      this._restoreTempReplayProblemCards();
      if (wasReplayActive && restoreFinal) {
        const restoreState = (!this.isStudentAudioVideoOnlyMode && savedPreReplay)
          ? savedPreReplay
          : (this.audioSyncData && this.audioSyncData.finalState ? this.audioSyncData.finalState : null);
        if (restoreState) {
          this._applyAudioWorkspaceKeyframe(restoreState);
        }
      }
      this._currentAppliedAudioKeyframe = null;
      this._releaseAudioReplayInkCanvases();
      if (restoreFinal) {
        this._revokeAudioReplayObjectUrls();
      }
      if (typeof this.syncLassoActionBarUI === 'function') {
        this.syncLassoActionBarUI();
      }
      if (!this.isStudentAudioVideoOnlyMode && typeof this.syncHideUiKeepUI === 'function') {
        this.syncHideUiKeepUI();
      }
      if (typeof this._syncStylusTipColors === 'function') {
        this._syncStylusTipColors();
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

    seekAudioSync(targetMs, autoPlay = false, options = null) {
      if (!this.audioSyncData) return;
      if (!this.isStudentAudioVideoOnlyMode && !this._isAudioReplayActive && !this._preReplayLiveState) {
        try {
          this._preReplayLiveState = this._captureAudioWorkspaceKeyframe();
        } catch (_) { }
      }
      if (typeof this.hideAudioLectureEndingOverlay === 'function') {
        this.hideAudioLectureEndingOverlay();
      }
      const dur = this.audioSyncData.durationMs || 1000;
      this.audioPlayCurrentMs = Math.max(0, Math.min(dur, Number(targetMs) || 0));
      this._audioPlayWallStartMs = performance.now();
      this._audioPlayBaseOffsetMs = this.audioPlayCurrentMs;
      this._lastStepReplayMs = this.audioPlayCurrentMs;
      const visualOnly = Boolean(options && options.visualOnlyWhileScrubbing);
      if (!visualOnly) {
        this._syncAudioPlayerToPlayMs(this.audioPlayCurrentMs, Boolean(this.isAudioPlaying));
      }
      if (typeof this.closeInkShapesPopover === 'function') this.closeInkShapesPopover();
      if (typeof this.closeInkClipsPopover === 'function') this.closeInkClipsPopover();
      this._isAudioReplayActive = true;
      document.body.classList.add('audio-replay-active');
      this._syncReplayFixedStageLayout();
      this._renderAudioReplayAtCurrentTime();
      this.syncAudioRecordUI();
      this.showAudioPlayerBarTemporarily(2800);
      if (!visualOnly && autoPlay && !this.isAudioPlaying) {
        this.playAudioSync(this.audioPlayCurrentMs);
      }
    }

    _getViewerSlideResumeKey(slideIdx = 0) {
      const pkgId = (this._viewerPkg && this._viewerPkg.id) ? String(this._viewerPkg.id) : 'active_pkg';
      return `${pkgId}::${Math.max(0, Number(slideIdx) || 0)}`;
    }

    _setViewerSavedPlayMs(slideIdx = 0, playMs = 0) {
      if (!this._viewerSavedPlayMsBySlide) {
        this._viewerSavedPlayMsBySlide = Object.create(null);
      }
      const key = this._getViewerSlideResumeKey(slideIdx);
      const safeMs = Math.max(0, Math.round(Number(playMs) || 0));
      if (safeMs > 0) {
        this._viewerSavedPlayMsBySlide[key] = safeMs;
      } else {
        delete this._viewerSavedPlayMsBySlide[key];
      }
    }

    _getViewerSavedPlayMs(slideIdx = 0) {
      if (!this._viewerSavedPlayMsBySlide) return 0;
      const key = this._getViewerSlideResumeKey(slideIdx);
      return Math.max(0, Number(this._viewerSavedPlayMsBySlide[key]) || 0);
    }

    async enterAudioLectureFromViewer(slideIdx = 0, mode = 'video', startMs = null) {
      if (!this._viewerPkg || !this._viewerPkg.playlistSlides || !this._viewerPkg.playlistSlides[slideIdx]) return;
      this._unlockAudioPlayerForMobileGesture(true);
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
      const postLoadSlide = this._viewerPkg && this._viewerPkg.playlistSlides ? this._viewerPkg.playlistSlides[slideIdx] : null;
      if (postLoadSlide && postLoadSlide.audioSyncData && postLoadSlide.audioSyncData._isLazyAudioStub) {
        if (typeof this.showImportantAlertModal === 'function') {
          this.showImportantAlertModal({
            title: '영상 불러오기 실패',
            descHtml: '네트워크 연결이 불안정하여 해설 영상 데이터를 불러오지 못했습니다.<br>연결 상태를 확인한 뒤 다시 시도해 주세요.',
            isDanger: true
          });
        }
        return;
      }
      const resolvedStartMs = (typeof startMs === 'number' && Number.isFinite(startMs))
        ? startMs
        : this._getViewerSavedPlayMs(slideIdx);
      await this.enterStudentAudioVideoOnlyMode({
        ...this._viewerPkg,
        currentIndex: slideIdx
      }, true, { startMs: resolvedStartMs, mode });
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
            categoryLabel: '필기 · 펜 도구',
            name: '펜 도구',
            desc: '실선 필기 펜으로 전환',
            defaultKey: 'P',
            buttonIds: ['btnInkPen', 'btnPillPen'],
            baseTitle: '펜'
          },
          {
            id: 'ink_tool_dashed_pen',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '점선 펜 도구',
            desc: '점선 펜 전환 (다시 누르거나 P 입력 시 실선 복귀)',
            defaultKey: '.'
          },
          {
            id: 'ink_shape_line',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '직선 그리기',
            desc: '즉시 직선 연속 작도 (Shift: 15° 스냅 · Ctrl: 중심 양방향 · P/ESC: 펜 복귀)',
            defaultKey: 'Q',
            buttonIds: ['btnShapePopLine', 'btnPillShapeLine'],
            baseTitle: '직선'
          },
          {
            id: 'ink_shape_arc',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '호 / 곡선 그리기',
            desc: '직선 작도 후 가운데 핸들 드래그로 원호 · 사분원 · 반원 · 타원호 생성 (P/ESC: 펜 복귀)',
            defaultKey: 'B',
            buttonIds: ['btnShapePopArc', 'btnPillShapeArc'],
            baseTitle: '호 · 반원'
          },
          {
            id: 'ink_shape_rect',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '사각형 그리기',
            desc: '즉시 사각형 연속 작도 (Shift: 정사각형 · Ctrl: 중심 고정 · P/ESC: 펜 복귀)',
            defaultKey: 'F',
            buttonIds: ['btnShapePopRect', 'btnPillShapeRect'],
            baseTitle: '사각형'
          },
          {
            id: 'ink_shape_circle',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '원 그리기',
            desc: '즉시 원/타원 연속 작도 (Shift: 정원 · Ctrl: 중심 정원 · P/ESC: 펜 복귀)',
            defaultKey: 'W',
            buttonIds: ['btnShapePopCircle', 'btnPillShapeCircle'],
            baseTitle: '원'
          },
          {
            id: 'ink_shape_triangle',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '삼각형 그리기',
            desc: '즉시 삼각형 연속 작도 (Shift: 정삼각형 · Ctrl: 직각삼각형 · P/ESC: 펜 복귀)',
            defaultKey: 'R',
            buttonIds: ['btnShapePopTriangle', 'btnPillShapeTriangle'],
            baseTitle: '삼각형'
          },
          {
            id: 'ink_tool_select',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '선택 / 이동 도구',
            desc: '그래프·카드·객체 이동 및 조작으로 전환',
            defaultKey: 'V',
            buttonIds: ['btnInkSelect', 'btnPillSelect'],
            baseTitle: '선택 / 이동'
          },
          {
            id: 'ink_toggle_mode',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '필기바 표시 / 숨김',
            desc: '필기 도구 바 표시 또는 숨김',
            defaultKey: '',
            buttonIds: ['btnInkMode'],
            baseTitle: '필기'
          },
          {
            id: 'ink_tool_highlighter',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '형광펜 도구',
            desc: '형광펜으로 전환',
            defaultKey: '',
            buttonIds: ['btnInkHighlighter', 'btnPillHighlighter'],
            baseTitle: '형광펜'
          },
          {
            id: 'ink_tool_eraser',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '지우개 도구',
            desc: '지우개로 전환',
            defaultKey: 'E',
            buttonIds: ['btnInkEraser', 'btnPillEraser'],
            baseTitle: '지우개'
          },
          {
            id: 'ink_tool_lasso',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '올가미 선택 도구',
            desc: '필기 획을 선택하여 이동·복제·색상 변경·삭제',
            defaultKey: 'L',
            buttonIds: ['btnInkLasso', 'btnPillLasso'],
            baseTitle: '올가미'
          },
          {
            id: 'ink_tool_laser',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '레이저 포인터',
            desc: '일정 시간 후 사라지는 레이저 포인터 전환',
            defaultKey: '',
            buttonIds: ['btnInkLaser', 'btnPillLaser'],
            baseTitle: '레이저 포인터'
          },
          {
            id: 'ink_tool_sticker',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '가림막 스티커',
            desc: '드래그하여 가림막 스티커 생성',
            defaultKey: '',
            buttonIds: ['btnInkSticker', 'btnPillSticker'],
            baseTitle: '가림막 스티커'
          },
          {
            id: 'ink_open_clips',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '내 클립 열기 / 닫기',
            desc: '저장한 손글씨·도형 클립 보관함을 커서 옆에 열거나 닫기',
            defaultKey: 'K',
            buttonIds: ['btnInkClips', 'btnPillClips'],
            baseTitle: '내 클립'
          },
          {
            id: 'ink_size_down',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '펜 굵기 줄이기 (−)',
            desc: '펜 굵기를 한 단계 가늘게 조절',
            defaultKey: '[',
            buttonIds: ['btnInkSizeDown'],
            baseTitle: '펜 굵기 줄이기'
          },
          {
            id: 'ink_size_up',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '펜 굵기 키우기 (+)',
            desc: '펜 굵기를 한 단계 굵게 조절',
            defaultKey: ']',
            buttonIds: ['btnInkSizeUp'],
            baseTitle: '펜 굵기 키우기'
          },
          {
            id: 'ink_color_1',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '펜 색상 1번',
            desc: '첫 번째 펜 색상 선택',
            defaultKey: ''
          },
          {
            id: 'ink_color_2',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '펜 색상 2번',
            desc: '두 번째 펜 색상 선택',
            defaultKey: ''
          },
          {
            id: 'ink_color_3',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '펜 색상 3번',
            desc: '세 번째 펜 색상 선택',
            defaultKey: ''
          },
          {
            id: 'ink_color_4',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '펜 색상 4번',
            desc: '네 번째 펜 색상 선택',
            defaultKey: ''
          },
          {
            id: 'ink_color_5',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '펜 색상 5번',
            desc: '다섯 번째 펜 색상 선택',
            defaultKey: ''
          },
          {
            id: 'ink_clear_all',
            category: 'ink',
            categoryLabel: '필기 · 펜 도구',
            name: '필기 비우기',
            desc: '현재 캔버스의 펜 필기만 모두 삭제',
            defaultKey: '',
            buttonIds: ['btnInkClearAll', 'btnPillClearAll'],
            baseTitle: '필기 비우기'
          },

          // 2. 📈 그래프 · 수학 도구 (graph)
          {
            id: 'graph_open_presets',
            category: 'graph',
            categoryLabel: '그래프 · 수학 도구',
            name: '그래프 추가창 열기 / 닫기',
            desc: '함수 선택창 열기 또는 닫기',
            defaultKey: 'G',
            buttonIds: ['btnRailPresets'],
            baseTitle: '그래프 추가'
          },
          {
            id: 'graph_toggle_axes',
            category: 'graph',
            categoryLabel: '그래프 · 수학 도구',
            name: '좌표축 표시 켜기 / 끄기',
            desc: '좌표평면(x·y축) 표시 또는 숨김',
            defaultKey: 'A',
            buttonIds: [],
            baseTitle: '좌표축'
          },
          {
            id: 'graph_toggle_dropline',
            category: 'graph',
            categoryLabel: '그래프 · 수학 도구',
            name: '보조 수선 도구 켜기 / 끄기',
            desc: '극점·교점에서 x축/y축으로 점선 수선 표시',
            defaultKey: 'D',
            buttonIds: ['btnQuickDropLine'],
            baseTitle: '보조 수선'
          },
          {
            id: 'graph_toggle_text',
            category: 'graph',
            categoryLabel: '그래프 · 수학 도구',
            name: '텍스트 입력 도구 켜기 / 끄기',
            desc: '캔버스 원하는 위치에 수식·텍스트 라벨 추가',
            defaultKey: 'T',
            buttonIds: ['btnQuickText'],
            baseTitle: '텍스트'
          },
          {
            id: 'graph_toggle_intersections',
            category: 'graph',
            categoryLabel: '그래프 · 수학 도구',
            name: '교점 표시 켜기 / 끄기',
            desc: '두 그래프 사이의 교점 마커 표시',
            defaultKey: '',
            buttonIds: ['btnQuickIntersection'],
            baseTitle: '교점 표시'
          },
          {
            id: 'graph_add_piecewise',
            category: 'graph',
            categoryLabel: '그래프 · 수학 도구',
            name: '구간 분할선 추가',
            desc: '구간별 함수 세로 경계선 추가',
            defaultKey: '',
            buttonIds: ['btnRailPiecewise'],
            baseTitle: '구간 분할'
          },
          {
            id: 'graph_capture_card',
            category: 'graph',
            categoryLabel: '그래프 · 수학 도구',
            name: '그래프 카드 추가',
            desc: '현재 그래프 영역을 캡처하여 카드로 추가',
            defaultKey: '',
            buttonIds: ['btnTriggerGraphSnap'],
            baseTitle: '카드 추가'
          },
          {
            id: 'card_stamp_active',
            category: 'graph',
            categoryLabel: '그래프 · 수학 도구',
            name: '캔버스에 고정',
            desc: '선택한 그래프 창 또는 문제 카드를 캔버스에 고정',
            defaultKey: 'S'
          },
          {
            id: 'graph_open_toolkit',
            category: 'graph',
            categoryLabel: '그래프 · 수학 도구',
            name: '시각화 도구창 열기 / 닫기',
            desc: '합성함수 스튜디오 등 시각화 도구창 열기 또는 닫기',
            defaultKey: '',
            buttonIds: ['btnRailNAxis'],
            baseTitle: '시각화 도구'
          },

          // 3. 📄 슬라이드 · 뷰어 이동 (slide)
          {
            id: 'slide_prev',
            category: 'slide',
            categoryLabel: '슬라이드 · 뷰어 이동',
            name: '이전 캔버스로 이동',
            desc: '이전 캔버스 또는 PDF 이전 페이지로 이동',
            defaultKey: 'PageUp',
            buttonIds: ['btnPlaylistPrev', 'btnPdfBoardPrev'],
            baseTitle: '이전 캔버스'
          },
          {
            id: 'slide_next',
            category: 'slide',
            categoryLabel: '슬라이드 · 뷰어 이동',
            name: '다음 캔버스로 이동',
            desc: '다음 캔버스 또는 PDF 다음 페이지로 이동',
            defaultKey: 'PageDown',
            buttonIds: ['btnPlaylistNext', 'btnPdfBoardNext'],
            baseTitle: '다음 캔버스'
          },
          {
            id: 'slide_add_blank',
            category: 'slide',
            categoryLabel: '슬라이드 · 뷰어 이동',
            name: '새 캔버스 추가',
            desc: '현재 캔버스를 유지하고 새 빈 캔버스 추가',
            defaultKey: '',
            buttonIds: ['btnPlaylistAddSlide'],
            baseTitle: '캔버스 추가'
          },
          {
            id: 'pdf_open_or_crop',
            category: 'slide',
            categoryLabel: '슬라이드 · 뷰어 이동',
            name: '파일 열기 / 영역 캡처',
            desc: '파일을 열거나 PDF 영역 캡처 모드로 전환',
            defaultKey: 'C',
            buttonIds: ['btnPdfImport'],
            baseTitle: '파일 열기'
          },
          {
            id: 'viewer_open_preview',
            category: 'slide',
            categoryLabel: '슬라이드 · 뷰어 이동',
            name: '뷰어 미리보기 열기',
            desc: '뷰어 화면으로 전환하여 전체 캔버스·영상 확인',
            defaultKey: '',
            buttonIds: ['btnQuickOpenViewer'],
            baseTitle: '뷰어 미리보기'
          },
          {
            id: 'drawer_toggle',
            category: 'slide',
            categoryLabel: '슬라이드 · 뷰어 이동',
            name: '좌측 사이드 패널 열기 / 닫기',
            desc: '좌측 서랍 패널 열기 또는 닫기',
            defaultKey: '\\'
          },

          // 4. ⚡ 편집 · 녹화 · 시스템 (system)
          {
            id: 'sys_undo',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '실행 취소',
            desc: '직전 작업 되돌리기',
            defaultKey: 'Ctrl+Z',
            buttonIds: ['btnUndo'],
            baseTitle: '실행 취소'
          },
          {
            id: 'sys_redo',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '다시 실행',
            desc: '취소한 작업 다시 실행',
            defaultKey: 'Ctrl+Y',
            buttonIds: ['btnRedo'],
            baseTitle: '다시 실행'
          },
          {
            id: 'sys_delete_selected',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '선택 항목 삭제',
            desc: '선택된 그래프 곡선, 올가미 필기, 텍스트 라벨 삭제',
            defaultKey: 'Delete'
          },
          {
            id: 'sys_copy_image',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '그래프 이미지 복사',
            desc: '선택한 그래프 창의 순수 그래프만 고화질 이미지로 복사',
            defaultKey: 'Ctrl+C'
          },
          {
            id: 'sys_record_toggle',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '영상 녹화 시작 / 일시정지',
            desc: '음성·필기·그래프 동기화 녹화 시작 또는 일시정지/재개',
            defaultKey: '',
            buttonIds: ['btnAudioRecordToggle', 'btnAudioPauseRecord'],
            baseTitle: '녹화 시작 / 일시정지'
          },
          {
            id: 'sys_record_stop',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '영상 녹화 종료',
            desc: '진행 중인 녹화를 완료하고 저장',
            defaultKey: '',
            buttonIds: ['btnAudioStopRecord'],
            baseTitle: '녹화 종료'
          },
          {
            id: 'sys_zoom_in',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '화면 확대 (+)',
            desc: '현재 캔버스 화면을 한 단계 확대',
            defaultKey: '=',
            buttonIds: ['btnRailZoomIn', 'btnQuickZoomIn', 'btnInkZoomIn', 'btnPillZoomIn'],
            baseTitle: '확대'
          },
          {
            id: 'sys_zoom_out',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '화면 축소 (−)',
            desc: '현재 캔버스 화면을 한 단계 축소',
            defaultKey: '-',
            buttonIds: ['btnRailZoomOut', 'btnQuickZoomOut', 'btnInkZoomOut', 'btnPillZoomOut'],
            baseTitle: '축소'
          },
          {
            id: 'sys_fullscreen_toggle',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '전체화면 전환',
            desc: '전체화면 켜기 또는 끄기',
            defaultKey: '',
            buttonIds: ['btnFullscreen'],
            baseTitle: '전체화면'
          },
          {
            id: 'sys_toggle_hide_ui',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '메뉴 숨기기 / 표시',
            desc: '화면의 모든 메뉴·툴바를 숨기고 캔버스만 표시',
            defaultKey: 'H',
            buttonIds: ['btnHideAllUI'],
            baseTitle: '메뉴 숨기기'
          },
          {
            id: 'sys_open_cloud_hub',
            category: 'system',
            categoryLabel: '편집 · 녹화 · 시스템',
            name: '클라우드 보관함 열기',
            desc: '클라우드 보관함 열기',
            defaultKey: '',
            buttonIds: ['btnCloudHub'],
            baseTitle: '클라우드 보관함'
          }
        ];
      }
      return this._shortcutDefinitions;
    }

    toggleAllUIHidden(forceVal = null) {
      // 스크린 판서 모드에서는 전체 숨김을 차단하여 최소 필기바(복귀 동선)를 항상 보장
      if (this.isScreenAnnotateMode) {
        if (forceVal !== false) {
          return;
        }
      }

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
        if (typeof this.closeRailResetPopover === 'function') {
          this.closeRailResetPopover();
        }
        if (typeof this.closeRailAddTargetPopover === 'function') {
          this.closeRailAddTargetPopover();
        }
        const pwPopOnHide = document.getElementById('pwRegionPopover');
        if (pwPopOnHide && pwPopOnHide.style.display !== 'none') {
          pwPopOnHide.style.display = 'none';
          this._openPwRegionIdx = null;
        }
        if (this._isPdfCropChoiceMenuOpen && typeof this.cancelPdfBoardToGraphCrop === 'function') {
          this.cancelPdfBoardToGraphCrop();
        }
        if (!this.keepInkBarOnHide) {
          const inkSizeFlyout = document.getElementById('inkSizeFlyout');
          const btnInkSizePicker = document.getElementById('btnInkSizePicker');
          if (inkSizeFlyout && inkSizeFlyout.style.display !== 'none') inkSizeFlyout.style.display = 'none';
          if (btnInkSizePicker) btnInkSizePicker.classList.remove('open');
          if (typeof this.closeInkShapesPopover === 'function') this.closeInkShapesPopover();
          if (!this.isInkClipsPinned && typeof this.closeInkClipsPopover === 'function') this.closeInkClipsPopover();
        }
        if (!this.keepSlideBarOnHide) {
          const plGrid = document.getElementById('playlistGridPopover');
          const plAddMenu = document.getElementById('playlistAddSlideMenu');
          const pdfGrid = document.getElementById('pdfBoardGridPopover');
          if (plGrid) plGrid.style.display = 'none';
          if (plAddMenu) plAddMenu.style.display = 'none';
          if (pdfGrid) pdfGrid.style.display = 'none';
          const navBar = document.getElementById('lessonPlaylistNavBar');
          if (navBar) navBar.classList.remove('is-grid-open');
        }
        document.body.classList.toggle('ui-hide-keep-ink', Boolean(this.keepInkBarOnHide));
        document.body.classList.toggle('ui-hide-keep-slide', Boolean(this.keepSlideBarOnHide));
        document.body.classList.add('ui-all-hidden-mode');
        const eff = this._getEffectiveShortcutsMap(this.customShortcuts);
        const assignedKey = String(eff.sys_toggle_hide_ui || '').trim();
        const dispKey = assignedKey ? this.formatShortcutKeyForDisplay(assignedKey) : '';
        if (restoreTab) {
          restoreTab.classList.remove('peek-highlight');
          restoreTab.style.display = 'flex';
          restoreTab.title = dispKey ? `메뉴 표시 (${dispKey})` : '메뉴 표시';
          // 아이콘이 사라진 직후 제자리에서 3회 깜빡인 뒤 서서히 완전 투명(opacity: 0)으로 소멸
          void restoreTab.offsetWidth;
          restoreTab.classList.add('peek-highlight');
          this._uiHiddenNoticeTimer = setTimeout(() => {
            restoreTab.classList.remove('peek-highlight');
            this._uiHiddenNoticeTimer = null;
          }, 2550);
        }
      } else {
        document.body.classList.remove('ui-all-hidden-mode');
        if (this.isScreenAnnotateMode && this._activeScreenAnnotateUiLayout === 'hidden') {
          // 모두 숨김 모드로 진입했다가 복귀 탭/H를 누르면 전체 아이콘을 깨워 조작·종료 가능하게 전환
          this._activeScreenAnnotateUiLayout = 'all';
          document.body.classList.remove('screen-annotate-ui-inkbar');
        }
        if (restoreTab) {
          restoreTab.classList.remove('peek-highlight');
          restoreTab.style.display = 'none';
        }
      }
      if (typeof this.syncScreenAnnotateButtonsUI === 'function') {
        this.syncScreenAnnotateButtonsUI();
      }
      if (this.isQuickPillRemoteOpen && typeof this._applyPillRemotePositionToDom === 'function') {
        this._applyPillRemotePositionToDom();
      }
      this._isAudioRecMenuOpen = false;
      if (typeof this.syncAudioRecordUI === 'function') {
        this.syncAudioRecordUI();
      }
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        this._recordAudioWorkspaceStateIfNeeded(true);
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
      this._pcCaptureState = {
        supported: Boolean(typeof window !== 'undefined' && window.__GRAPHLY_DESKTOP__ && window.__GRAPHLY_DESKTOP__.isDesktopApp),
        hotkey: 'F8',
        hotkeyRegistered: true,
        autoStamp: false,
        autoStart: false
      };
      this._draftPcCapture = null;
      this._pcCaptureDirty = false;
      this._draftPcScreenHotkey = null;
      this._pcScreenHotkeyDirty = false;
      this._draftPcScreenToggleHotkey = null;
      this._pcScreenToggleHotkeyDirty = false;
      this.isAllUIHidden = false;

      // PC 전용 스크린 판서 설정 로드 (기본값: 전체 표시 'all' / 시작·종료 'F9' / 필기⇄배경 전환 'F10')
      this.isScreenAnnotateMode = false;
      this._activeScreenAnnotateUiLayout = 'all';
      this._screenAnnotateBackup = null;
      this._screenAnnotateSavedThemeKey = null;
      this._lastScreenAnnotateToggleAt = 0;
      this.screenAnnotateUiMode = 'all';
      this.pcScreenAnnotateHotkey = 'F9';
      this.pcScreenToggleInkHotkey = 'F10';
      try {
        const savedSaUi = localStorage.getItem('graphly_screen_annotate_ui_v1');
        if (savedSaUi === 'inkbar' || savedSaUi === 'hidden') {
          this.screenAnnotateUiMode = 'inkbar';
        } else if (savedSaUi === 'all') {
          this.screenAnnotateUiMode = 'all';
        }
        const savedSaHk = localStorage.getItem('graphly_pc_screen_annotate_hotkey_v1');
        if (savedSaHk !== null) {
          this.pcScreenAnnotateHotkey = String(savedSaHk).trim();
        }
        const savedSaToggleHk = localStorage.getItem('graphly_pc_screen_toggle_ink_hotkey_v1');
        if (savedSaToggleHk !== null) {
          this.pcScreenToggleInkHotkey = String(savedSaToggleHk).trim();
        }
      } catch (_) { }

      const btnHideAllUI = document.getElementById('btnHideAllUI');
      const btnRestoreAllUITab = document.getElementById('btnRestoreAllUITab');
      if (btnHideAllUI) {
        btnHideAllUI.onclick = (e) => {
          e.stopPropagation();
          this.toggleAllUIHidden(true);
        };
      }
      if (btnRestoreAllUITab) {
        let _restorePtrId = null;
        let _restoreDownX = 0;
        let _restoreDownY = 0;
        let _lastRestoreTriggerAt = 0;
        const armRestoreGhostClickShield = () => {
          const shieldUntil = Date.now() + 320;
          const clearShield = () => {
            window.removeEventListener('click', swallowLateClick, true);
            window.removeEventListener('pointerdown', clearShield, true);
          };
          const swallowLateClick = (ce) => {
            if (Date.now() > shieldUntil) {
              clearShield();
              return;
            }
            if (ce && ce.detail > 0 && ce.clientX >= window.innerWidth - 64 && ce.clientY <= 170) {
              ce.stopPropagation();
              if (ce.cancelable !== false) ce.preventDefault();
              clearShield();
            }
          };
          window.addEventListener('click', swallowLateClick, true);
          window.addEventListener('pointerdown', clearShield, true);
          setTimeout(clearShield, 340);
        };
        const triggerRestoreFromTab = (ev, fromPointerOrTouch = false) => {
          if (ev) {
            ev.stopPropagation();
            if (fromPointerOrTouch && ev.cancelable !== false) {
              ev.preventDefault();
            }
          }
          const now = Date.now();
          if (now - _lastRestoreTriggerAt < 400) return;
          if (!this.isAllUIHidden) return;
          _lastRestoreTriggerAt = now;
          if (fromPointerOrTouch) {
            armRestoreGhostClickShield();
          }
          this.toggleAllUIHidden(false);
        };
        btnRestoreAllUITab.onpointerdown = (e) => {
          e.stopPropagation();
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          _restorePtrId = e.pointerId;
          _restoreDownX = e.clientX;
          _restoreDownY = e.clientY;
          if (e.pointerType === 'touch' || e.pointerType === 'pen') {
            try {
              if (btnRestoreAllUITab.setPointerCapture) {
                btnRestoreAllUITab.setPointerCapture(e.pointerId);
              }
            } catch (_) { }
          }
        };
        btnRestoreAllUITab.onpointerup = (e) => {
          e.stopPropagation();
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          if (_restorePtrId !== null && e.pointerId !== undefined && e.pointerId !== _restorePtrId) return;
          const hadDown = (_restorePtrId !== null);
          const movedDist = hadDown ? Math.hypot(e.clientX - _restoreDownX, e.clientY - _restoreDownY) : 0;
          _restorePtrId = null;
          try {
            if (e.pointerId !== undefined && btnRestoreAllUITab.hasPointerCapture && btnRestoreAllUITab.hasPointerCapture(e.pointerId)) {
              btnRestoreAllUITab.releasePointerCapture(e.pointerId);
            }
          } catch (_) { }
          if (!hadDown || movedDist <= 36) {
            triggerRestoreFromTab(e, e.pointerType === 'touch' || e.pointerType === 'pen');
          }
        };
        btnRestoreAllUITab.onpointercancel = (e) => {
          if (_restorePtrId !== null && (!e || e.pointerId === undefined || e.pointerId === _restorePtrId)) {
            _restorePtrId = null;
          }
        };
        if (!btnRestoreAllUITab._iosOneTapBound) {
          btnRestoreAllUITab._iosOneTapBound = true;
          btnRestoreAllUITab.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            if (this.isAllUIHidden && e.touches && e.touches.length === 1) {
              _restoreDownX = e.touches[0].clientX;
              _restoreDownY = e.touches[0].clientY;
              // iPadOS Safari가 opacity:0 요소 첫 탭을 :hover 표시로 소비하며 click을 씹는 현상 원천 차단
              if (e.cancelable !== false) e.preventDefault();
            }
          }, { passive: false });
          btnRestoreAllUITab.addEventListener('touchend', (e) => {
            e.stopPropagation();
            if (!this.isAllUIHidden) return;
            const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
            const movedDist = t ? Math.hypot(t.clientX - _restoreDownX, t.clientY - _restoreDownY) : 0;
            if (movedDist <= 36) {
              triggerRestoreFromTab(e, true);
            }
          }, { passive: false });
        }
        btnRestoreAllUITab.onclick = (e) => {
          triggerRestoreFromTab(e, false);
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
            if (this._recordingShortcutActionId === '__pc_quick_capture__') {
              this._recordingShortcutActionId = null;
              this.setShortcutModalBanner(
                '[외부 화면 빠른 캡처] 단축키 입력을 취소했습니다.',
                'normal'
              );
              this.renderShortcutSettingsModalList();
              return;
            }
            if (this._recordingShortcutActionId === '__pc_screen_annotate__') {
              this._recordingShortcutActionId = null;
              this.setShortcutModalBanner(
                '[스크린 판서 시작 / 종료] 단축키 입력을 취소했습니다.',
                'normal'
              );
              this.renderShortcutSettingsModalList();
              return;
            }
            if (this._recordingShortcutActionId === '__pc_screen_toggle_ink__') {
              this._recordingShortcutActionId = null;
              this.setShortcutModalBanner(
                '[스크린 판서: 필기 ⇄ 배경 조작] 단축키 입력을 취소했습니다.',
                'normal'
              );
              this.renderShortcutSettingsModalList();
              return;
            }
            const canceledDef = this.getShortcutDefinitions().find(d => d.id === this._recordingShortcutActionId);
            this._recordingShortcutActionId = null;
            this.setShortcutModalBanner(
              `[${canceledDef ? canceledDef.name : '기능'}] 단축키 입력을 취소했습니다.`,
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
              `[${this.formatShortcutKeyForDisplay(normKey)}] 키는 브라우저 새로고침 보호를 위해 사용할 수 없습니다.`,
              'warning'
            );
            return;
          }

          if (this._recordingShortcutActionId === '__pc_quick_capture__') {
            this.assignDraftPcQuickCaptureHotkey(normKey);
            return;
          }
          if (this._recordingShortcutActionId === '__pc_screen_annotate__') {
            this.assignDraftPcScreenAnnotateHotkey(normKey);
            return;
          }
          if (this._recordingShortcutActionId === '__pc_screen_toggle_ink__') {
            this.assignDraftPcScreenToggleInkHotkey(normKey);
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

      // Windows에서 PrintScreen은 OS 특성상 keyup 시점에만 전달되는 경우가 많으므로 보조 캡처
      window.addEventListener('keyup', (e) => {
        if (!this.isShortcutSettingsModalOpen()) return;
        if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
          if (this._recordingShortcutActionId === '__pc_quick_capture__') {
            e.preventDefault();
            e.stopPropagation();
            this.assignDraftPcQuickCaptureHotkey('PrintScreen');
          } else if (this._recordingShortcutActionId === '__pc_screen_annotate__') {
            e.preventDefault();
            e.stopPropagation();
            this.assignDraftPcScreenAnnotateHotkey('PrintScreen');
          } else if (this._recordingShortcutActionId === '__pc_screen_toggle_ink__') {
            e.preventDefault();
            e.stopPropagation();
            this.assignDraftPcScreenToggleInkHotkey('PrintScreen');
          }
        }
      }, true);

      // 트레이 메뉴에서 설정을 바꾼 뒤 Graphly 창으로 돌아왔을 때 실시간 동기화
      window.addEventListener('graphly-desktop-focus', () => {
        if (this.isShortcutSettingsModalOpen() && !this._pcCaptureDirty && !this._recordingShortcutActionId) {
          this.refreshDesktopCaptureConfigState(true);
        } else if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelSettings' && this._activeSettingsSubTab === 'pc') {
          this.syncPcExclusiveSettingsPanelUI(true);
        }
      });

      this.initPcExclusiveSettingsAndScreenAnnotate();
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
      } else if (code === 'Period' || code === 'NumpadDecimal' || rawKey === '.') {
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
      } else if (rawKey === 'PrintScreen' || code === 'PrintScreen') {
        baseKey = 'PrintScreen';
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
      // [기존 커스텀 'S' 지정 계정 충돌 방지]: 이미 다른 기능에 'S'를 직접 배정해 둔 계정은 기존 설정을 보존하고 신규 스탬프 기본값('S')은 미지정으로 양보
      if (!Object.prototype.hasOwnProperty.call(src, 'card_stamp_active') && String(result.card_stamp_active || '').toUpperCase() === 'S') {
        const hasOtherCustomS = Object.keys(result).some(id => id !== 'card_stamp_active' && String(result[id] || '').trim().toUpperCase() === 'S');
        if (hasOtherCustomS) {
          result.card_stamp_active = '';
        }
      }
      // [기존 커스텀 '.' 지정 계정 충돌 방지]: 이미 다른 기능에 '.'을 직접 배정해 둔 계정은 기존 설정을 보존하고 신규 점선 펜 기본값('.')은 미지정으로 양보
      if (!Object.prototype.hasOwnProperty.call(src, 'ink_tool_dashed_pen') && String(result.ink_tool_dashed_pen || '').trim() === '.') {
        const hasOtherCustomPeriod = Object.keys(result).some(id => id !== 'ink_tool_dashed_pen' && String(result[id] || '').trim() === '.');
        if (hasOtherCustomPeriod) {
          result.ink_tool_dashed_pen = '';
        }
      }
      // [신규 도형 단축키 기본값('Q','F','W','R') 기존 커스텀 계정 충돌 방지]: 이미 다른 기능에 해당 키를 직접 지정해 둔 계정은 기존 설정을 100% 보존
      const quickShapeIds = ['ink_shape_line', 'ink_shape_arc', 'ink_shape_rect', 'ink_shape_circle', 'ink_shape_triangle'];
      for (let qi = 0; qi < quickShapeIds.length; qi++) {
        const sid = quickShapeIds[qi];
        const defVal = String(result[sid] || '').trim().toUpperCase();
        if (!defVal || Object.prototype.hasOwnProperty.call(src, sid)) continue;
        const hasConflict = Object.keys(result).some(id => id !== sid && String(result[id] || '').trim().toUpperCase() === defVal);
        if (hasConflict) {
          result[sid] = '';
        }
      }
      return result;
    }

    getStampButtonTooltipText(isGraphCard = false) {
      const eff = this._getEffectiveShortcutsMap(this.customShortcuts);
      const assignedKey = String(eff.card_stamp_active || '').trim();
      const keyBadge = assignedKey ? ` (${this.formatShortcutKeyForDisplay(assignedKey)})` : '';
      return `캔버스에 고정${keyBadge}`;
    }

    setShortcutModalBanner(htmlText, mode = 'normal') {
      const banner = document.getElementById('shortcutModalNoticeBanner');
      if (!banner) return;
      banner.innerHTML = htmlText;
      banner.classList.toggle('is-warning', mode === 'warning');
      banner.classList.toggle('is-recording', mode === 'recording');
    }

    _getPcShortcutSectionEnvMode() {
      const dBridge = (typeof window !== 'undefined' && window.__GRAPHLY_DESKTOP__ && window.__GRAPHLY_DESKTOP__.isDesktopApp)
        ? window.__GRAPHLY_DESKTOP__
        : null;
      if (dBridge) {
        return (this._pcCaptureState && this._pcCaptureState.supported === false) ? 'desktop-mac' : 'desktop-win';
      }
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
      const isMobileOrTablet = /iPhone|iPad|iPod|Android/i.test(ua)
        || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 1);
      return isMobileOrTablet ? 'mobile-tablet' : 'web-desktop';
    }

    initPcExclusiveSettingsAndScreenAnnotate() {
      const isDesktopApp = Boolean(
        typeof window !== 'undefined' &&
        window.__GRAPHLY_DESKTOP__ &&
        window.__GRAPHLY_DESKTOP__.isDesktopApp
      );

      // 1. 우측 [스크린 판서] 아이콘: 오직 PC 설치 버전에서만 노출 (웹버전은 영구 숨김)
      const btnSa = document.getElementById('btnScreenAnnotate');
      const btnExitSa = document.getElementById('btnExitScreenAnnotate');
      if (btnSa) {
        btnSa.style.display = isDesktopApp ? '' : 'none';
        btnSa.onclick = (e) => {
          e.stopPropagation();
          this.toggleScreenAnnotateMode();
        };
      }
      if (btnExitSa) {
        btnExitSa.onpointerdown = (e) => e.stopPropagation();
        btnExitSa.onclick = (e) => {
          e.stopPropagation();
          this.exitScreenAnnotateMode();
        };
      }

      // 2. 환경 설정 > [PC 전용] 탭 컨트롤 바인딩
      const flashPcPromoCard = () => {
        const promoCard = document.getElementById('settingsPcPromoCard');
        if (!promoCard || promoCard.style.display === 'none') return;
        promoCard.classList.remove('promo-attention-pulse');
        void promoCard.offsetWidth;
        promoCard.classList.add('promo-attention-pulse');
        if (this._pcPromoPulseTimer) clearTimeout(this._pcPromoPulseTimer);
        this._pcPromoPulseTimer = setTimeout(() => {
          promoCard.classList.remove('promo-attention-pulse');
          this._pcPromoPulseTimer = null;
        }, 900);
      };

      const uiGroup = document.getElementById('screenAnnotateUiGroup');
      if (uiGroup) {
        uiGroup.querySelectorAll('.screen-annotate-ui-chip').forEach(chip => {
          chip.onclick = (e) => {
            e.stopPropagation();
            const envMode = this._getPcShortcutSectionEnvMode();
            if (envMode !== 'desktop-win' && envMode !== 'desktop-mac') {
              flashPcPromoCard();
              return;
            }
            const nextUi = chip.getAttribute('data-sa-ui') || 'all';
            this.setScreenAnnotateUiMode(nextUi, true, true);
          };
        });
      }

      const chkAutoStamp = document.getElementById('chkPcAutoStamp');
      const chkAutoStart = document.getElementById('chkPcAutoStart');
      const handlePcCaptureToggle = (fieldKey, chkEl, labelText) => {
        if (!chkEl) return;
        chkEl.onchange = (e) => {
          e.stopPropagation();
          const envMode = this._getPcShortcutSectionEnvMode();
          if (envMode !== 'desktop-win') {
            chkEl.checked = Boolean(this._pcCaptureState && this._pcCaptureState[fieldKey]);
            flashPcPromoCard();
            return;
          }
          const nextVal = Boolean(chkEl.checked);
          this._pcCaptureState[fieldKey] = nextVal;
          const dBridge = (typeof window !== 'undefined' && window.__GRAPHLY_DESKTOP__ && typeof window.__GRAPHLY_DESKTOP__.setCaptureConfig === 'function')
            ? window.__GRAPHLY_DESKTOP__
            : null;
          if (dBridge) {
            const payload = {};
            payload[fieldKey] = nextVal;
            dBridge.setCaptureConfig(payload).then((res) => {
              if (res && res.ok) {
                this._pcCaptureState = {
                  supported: res.supported !== false,
                  hotkey: String(res.hotkey == null ? '' : res.hotkey).trim(),
                  hotkeyRegistered: res.hotkeyRegistered !== false,
                  autoStamp: Boolean(res.autoStamp),
                  autoStart: Boolean(res.autoStart)
                };
                this.syncPcExclusiveSettingsPanelUI(false);
              }
            }).catch(() => { });
          }
          if (typeof this.showToast === 'function') {
            this.showToast(`✅ ${labelText}: ${nextVal ? '켜짐' : '꺼짐'}`);
          }
        };
      };
      handlePcCaptureToggle('autoStamp', chkAutoStamp, '캡처 후 캔버스에 자동 고정');
      handlePcCaptureToggle('autoStart', chkAutoStart, 'Windows 시작 시 자동 실행');

      const btnOpenPcSc = document.getElementById('btnOpenPcShortcutSettings');
      if (btnOpenPcSc) {
        btnOpenPcSc.onclick = (e) => {
          e.stopPropagation();
          this.openShortcutSettingsModal('pc');
        };
      }

      const btnTopMacDl = document.getElementById('btnSettingsTopMacDownload');
      if (btnTopMacDl) {
        btnTopMacDl.onclick = (e) => {
          e.stopPropagation();
          if (typeof this.showToast === 'function') {
            this.showToast('Mac 전용 버전은 현재 출시 준비 중입니다.');
          }
        };
      }

      const bindEdgeDownloadHint = (anchorEl) => {
        if (!anchorEl) return;
        anchorEl.addEventListener('click', () => {
          const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
          if (/Edg\//i.test(ua) && typeof this.showToast === 'function') {
            this.showToast('Edge 다운로드 차단 시 우측 상단 [⋯ → 유지]를 누르거나 Chrome에서 받아주세요.');
          }
        });
      };
      bindEdgeDownloadHint(document.getElementById('linkSettingsTopWinDownload'));
      bindEdgeDownloadHint(document.getElementById('linkSettingsPcDownload'));

      this.setScreenAnnotateUiMode(this.screenAnnotateUiMode || 'all', false, false);
      this.syncPcExclusiveSettingsPanelUI(isDesktopApp);
      this.syncScreenAnnotateButtonsUI();
      if (isDesktopApp && window.__GRAPHLY_DESKTOP__) {
        if (typeof window.__GRAPHLY_DESKTOP__.setScreenAnnotateHotkey === 'function') {
          window.__GRAPHLY_DESKTOP__.setScreenAnnotateHotkey(this.pcScreenAnnotateHotkey || '').catch(() => { });
        }
        if (typeof window.__GRAPHLY_DESKTOP__.setScreenToggleInkHotkey === 'function') {
          window.__GRAPHLY_DESKTOP__.setScreenToggleInkHotkey(this.pcScreenToggleInkHotkey || '').catch(() => { });
        }
      }
    }

    setScreenAnnotateUiMode(mode, showToastMsg = false, savePref = true) {
      const cleanMode = (mode === 'inkbar' || mode === 'hidden') ? 'inkbar' : 'all';
      this.screenAnnotateUiMode = cleanMode;
      try {
        localStorage.setItem('graphly_screen_annotate_ui_v1', cleanMode);
      } catch (_) { }

      const uiGroup = document.getElementById('screenAnnotateUiGroup');
      if (uiGroup) {
        uiGroup.querySelectorAll('.screen-annotate-ui-chip').forEach(chip => {
          chip.classList.toggle('active', chip.getAttribute('data-sa-ui') === cleanMode);
        });
      }

      if (this.isScreenAnnotateMode) {
        this._applyScreenAnnotateUiPreset(cleanMode);
      }

      if (savePref && !this._isApplyingUserPrefs && typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }

      if (showToastMsg && typeof this.showToast === 'function') {
        const modeLabels = {
          all: '전체 표시 (아이콘 + 필기바)',
          inkbar: '필기바만 표시'
        };
        this.showToast(`🖥️ 스크린 판서 화면: ${modeLabels[cleanMode]}`);
      }
    }

    _applyScreenAnnotateUiPreset(mode) {
      const cleanMode = (mode === 'inkbar' || mode === 'hidden') ? 'inkbar' : 'all';
      this._activeScreenAnnotateUiLayout = cleanMode;
      if (typeof document === 'undefined' || !document.body) return;

      if (cleanMode === 'inkbar') {
        if (this.isAllUIHidden) {
          this.toggleAllUIHidden(false);
        }
        if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
          this.closeDrawer();
        }
        document.body.classList.add('screen-annotate-ui-inkbar');
        if (!this.isInkMode && typeof this.toggleInkMode === 'function') {
          this.toggleInkMode(true);
        }
        if (this.isBottomInkBarHidden && !this.isQuickPillRemoteOpen && typeof this.toggleBottomInkBar === 'function') {
          this.toggleBottomInkBar();
        }
      } else {
        document.body.classList.remove('screen-annotate-ui-inkbar');
        if (this.isAllUIHidden) {
          this.toggleAllUIHidden(false);
        }
        if (!this.isInkMode && typeof this.toggleInkMode === 'function') {
          this.toggleInkMode(true);
        }
        if (this.isBottomInkBarHidden && !this.isQuickPillRemoteOpen && typeof this.toggleBottomInkBar === 'function') {
          this.toggleBottomInkBar();
        }
      }
      this.syncScreenAnnotateButtonsUI();
    }

    syncScreenAnnotateButtonsUI() {
      const isDesktopApp = Boolean(
        typeof window !== 'undefined' &&
        window.__GRAPHLY_DESKTOP__ &&
        window.__GRAPHLY_DESKTOP__.isDesktopApp
      );
      const btnSa = document.getElementById('btnScreenAnnotate');
      const iconEnter = document.getElementById('iconScreenAnnotateEnter');
      const iconExit = document.getElementById('iconScreenAnnotateExit');
      const btnExitSa = document.getElementById('btnExitScreenAnnotate');

      const saKey = String(this.pcScreenAnnotateHotkey || '').trim();
      const saKeyDisp = saKey ? this.formatShortcutKeyForDisplay(saKey) : '';

      if (btnSa) {
        btnSa.style.display = isDesktopApp ? '' : 'none';
        btnSa.classList.toggle('active', Boolean(this.isScreenAnnotateMode));
        if (iconEnter) iconEnter.style.display = this.isScreenAnnotateMode ? 'none' : '';
        if (iconExit) iconExit.style.display = this.isScreenAnnotateMode ? '' : 'none';
        if (this.isScreenAnnotateMode) {
          btnSa.title = saKeyDisp ? `스크린 판서 종료 (ESC / ${saKeyDisp})` : '스크린 판서 종료 (ESC)';
        } else {
          btnSa.title = saKeyDisp ? `스크린 판서 (${saKeyDisp})` : '스크린 판서';
        }
      }

      if (btnExitSa) {
        const showSoloExit = Boolean(
          isDesktopApp &&
          this.isScreenAnnotateMode &&
          this._activeScreenAnnotateUiLayout === 'inkbar' &&
          !this.isAllUIHidden
        );
        btnExitSa.style.display = showSoloExit ? 'flex' : 'none';
        btnExitSa.title = saKeyDisp ? `스크린 판서 종료 (ESC / ${saKeyDisp})` : '스크린 판서 종료 (ESC)';
      }
    }

    syncPcExclusiveSettingsPanelUI(fetchRemote = false) {
      const envMode = this._getPcShortcutSectionEnvMode();
      const isDesktopApp = (envMode === 'desktop-win' || envMode === 'desktop-mac');
      const isDesktopWin = (envMode === 'desktop-win');
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
      const isMacHost = /Macintosh|Mac OS X/i.test(ua)
        && (typeof navigator === 'undefined' || Number(navigator.maxTouchPoints || 0) <= 1);

      const topDlBar = document.getElementById('settingsTopDesktopDownloadBar');
      const pcMacPane = document.getElementById('settingsTabContentPc');
      const macBlock = document.getElementById('settingsMacPlatformBlock');
      const promoCard = document.getElementById('settingsPcPromoCard');
      const promoText = document.getElementById('lblSettingsPcPromoText');
      const promoSubHint = document.getElementById('lblSettingsPcPromoSubHint');
      const dlLink = document.getElementById('linkSettingsPcDownload');
      const controlsWrap = document.getElementById('settingsPcControlsWrap');
      const capSec = document.getElementById('settingsPcQuickCaptureSection');

      if (topDlBar) {
        topDlBar.style.display = (envMode === 'web-desktop') ? 'flex' : 'none';
      }
      if (pcMacPane) {
        pcMacPane.classList.toggle('is-mac-host', !isDesktopWin && isMacHost);
      }
      if (macBlock) {
        macBlock.style.display = isDesktopApp ? 'none' : 'flex';
      }

      if (promoCard) {
        if (isDesktopApp) {
          promoCard.style.display = 'none';
        } else {
          promoCard.style.display = 'flex';
          if (envMode === 'mobile-tablet') {
            if (promoText) {
              promoText.textContent = 'Windows PC에서 graphly.net에 접속해 설치하시면 아래 기능을 모두 사용할 수 있습니다.';
            }
            if (dlLink) dlLink.style.display = 'none';
            if (promoSubHint) promoSubHint.style.display = 'none';
          } else {
            if (promoText) {
              promoText.textContent = '바탕화면·한글·PPT 위 스크린 판서와 빠른 캡처(F8)를 바로 사용할 수 있습니다.';
            }
            if (dlLink) dlLink.style.display = 'inline-flex';
            if (promoSubHint) promoSubHint.style.display = 'block';
          }
        }
      }

      if (controlsWrap) {
        controlsWrap.classList.toggle('is-pc-preview-only', !isDesktopApp);
      }
      if (capSec) {
        capSec.classList.toggle('is-mac-unsupported', envMode === 'desktop-mac');
      }

      const uiGroup = document.getElementById('screenAnnotateUiGroup');
      if (uiGroup) {
        const curUi = this.screenAnnotateUiMode || 'all';
        uiGroup.querySelectorAll('.screen-annotate-ui-chip').forEach(chip => {
          chip.classList.toggle('active', chip.getAttribute('data-sa-ui') === curUi);
        });
      }

      const chkAutoStamp = document.getElementById('chkPcAutoStamp');
      const chkAutoStart = document.getElementById('chkPcAutoStart');
      if (chkAutoStamp) {
        chkAutoStamp.checked = Boolean(isDesktopWin && this._pcCaptureState && this._pcCaptureState.autoStamp);
      }
      if (chkAutoStart) {
        chkAutoStart.checked = Boolean(isDesktopWin && this._pcCaptureState && this._pcCaptureState.autoStart);
      }

      const lblKeys = document.getElementById('lblPcShortcutSummaryKeys');
      if (lblKeys) {
        const capHk = isDesktopApp
          ? String((this._pcCaptureState && this._pcCaptureState.hotkey) || '').trim()
          : 'F8';
        const saHk = isDesktopApp
          ? String(this.pcScreenAnnotateHotkey || '').trim()
          : 'F9';
        const toggleHk = isDesktopApp
          ? String(this.pcScreenToggleInkHotkey || '').trim()
          : 'F10';
        const parts = [];
        if (capHk && envMode !== 'desktop-mac') parts.push(this.formatShortcutKeyForDisplay(capHk));
        if (saHk) parts.push(this.formatShortcutKeyForDisplay(saHk));
        if (toggleHk) parts.push(this.formatShortcutKeyForDisplay(toggleHk));
        lblKeys.textContent = parts.length > 0 ? parts.join(' · ') : '미지정';
      }

      if (fetchRemote && isDesktopWin) {
        this.refreshDesktopCaptureConfigState(false).then(() => {
          this.syncPcExclusiveSettingsPanelUI(false);
        });
      }
    }

    async toggleScreenAnnotateMode(forceEnable = null) {
      const now = Date.now();
      if (now - (this._lastScreenAnnotateToggleAt || 0) < 220) return false;
      this._lastScreenAnnotateToggleAt = now;

      const wantEnable = (typeof forceEnable === 'boolean') ? forceEnable : !this.isScreenAnnotateMode;
      if (wantEnable) {
        return this.enterScreenAnnotateMode();
      }
      return this.exitScreenAnnotateMode();
    }

    async enterScreenAnnotateMode() {
      if (this.isScreenAnnotateMode) return true;

      const dBridge = (typeof window !== 'undefined' && window.__GRAPHLY_DESKTOP__ && window.__GRAPHLY_DESKTOP__.isDesktopApp)
        ? window.__GRAPHLY_DESKTOP__
        : null;
      if (!dBridge) {
        if (typeof this.showToast === 'function') {
          this.showToast('💻 스크린 판서는 Graphly PC 버전 전용 기능입니다.');
        }
        return false;
      }

      if (this.isAudioRecording) {
        if (typeof this.showToast === 'function') {
          this.showToast('⚠️ 음성 노트 녹화 중에는 스크린 판서를 켤 수 없습니다.');
        }
        return false;
      }
      if (typeof this._isViewerOrReplayBlockingEdit === 'function' && this._isViewerOrReplayBlockingEdit()) {
        return false;
      }

      // 열려 있는 모달·서랍 정리
      if (typeof window !== 'undefined' && window.graphlyIntroTour && window.graphlyIntroTour.isOpen && typeof window.graphlyIntroTour.close === 'function') {
        try { window.graphlyIntroTour.close(); } catch (_) { }
      }
      if (this.isShortcutSettingsModalOpen()) this.closeShortcutSettingsModal();
      if (this.isPdfModalOpen && typeof this.closePdfModal === 'function') this.closePdfModal();
      if (this.isNAxisStudioOpen && typeof this.closeNAxisStudio === 'function') this.closeNAxisStudio();
      if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') this.closeDrawer();
      ['modalGuideNotice', 'modalShare', 'modalProPricing', 'modalPricingLoginNotice'].forEach(mId => {
        const el = document.getElementById(mId);
        if (el) el.classList.remove('show');
      });

      // 1. 기존 칠판 전체 상태(다중 슬라이드·통PDF·카드·Undo/Redo·테마·도구) 100% 무손실 백업
      this._screenAnnotateBackup = {
        workspaceSnap: this._captureFullWorkspaceSnapshot(),
        undoStack: Array.isArray(this.undoStack) ? [...this.undoStack] : [],
        redoStack: Array.isArray(this.redoStack) ? [...this.redoStack] : [],
        themeKey: this.currentThemeKey || 'white_paper',
        savedPenColor: this.savedPenColor || '#1e293b',
        savedHighlighterColor: this.savedHighlighterColor || '#1e293b',
        currentInkColor: this.currentInkColor || '#1e293b',
        isInkMode: Boolean(this.isInkMode),
        activeInkTool: this.activeInkTool || 'pen',
        isAllUIHidden: Boolean(this.isAllUIHidden),
        isBottomInkBarHidden: Boolean(this.isBottomInkBarHidden),
        isQuickPillRemoteOpen: Boolean(this.isQuickPillRemoteOpen)
      };
      this._screenAnnotateSavedThemeKey = this.currentThemeKey || 'white_paper';
      const prevThemeObj = (this.canvasThemes && this.canvasThemes[this._screenAnnotateSavedThemeKey]) || { bg: '#ffffff' };
      const prevBgColor = this.isMonochromeMode ? '#ffffff' : (prevThemeObj.bg || '#ffffff');

      // 시네마틱 스르륵 전환: 창 리사이즈·클리어 전 현재 칠판 배경색 베일을 먼저 덮어 깜빡임을 0%로 차단
      if (typeof dBridge.prepareScreenFadeVeil === 'function') {
        try { dBridge.prepareScreenFadeVeil(prevBgColor); } catch (_) { }
      }

      // 2. 투명 스크린 판서 전용 클린 보드 초기화 (흰 배경 그래프 창 보장을 위해 라이트 테마 기반 구동)
      this._isApplyingUserPrefs = true;
      try {
        this.isScreenAnnotateMode = true;
        if (this.currentThemeKey !== 'white_paper' && typeof this.setCanvasTheme === 'function') {
          this.setCanvasTheme('white_paper', false);
        }
        const curPenLower = String(this.savedPenColor || '').toLowerCase();
        if (curPenLower === '#ffffff' || curPenLower === '#fff') {
          this.savedPenColor = '#1e293b';
          this.currentInkColor = '#1e293b';
        }

        // 기존 카드·슬라이드·통PDF 숨김 및 임시 보드 클리어
        if (typeof this.closeProblemCard === 'function') this.closeProblemCard();
        if (typeof this.closeGraphCard === 'function') this.closeGraphCard();
        if (Array.isArray(this.extraProblemCards) && this.extraProblemCards.length > 0) {
          this.extraProblemCards.forEach(c => { if (c && c.el) c.el.remove(); });
          this.extraProblemCards = [];
        }
        if (Array.isArray(this.extraGraphCards) && this.extraGraphCards.length > 0) {
          this.extraGraphCards.forEach(c => { if (c && c.el) c.el.remove(); });
          this.extraGraphCards = [];
        }

        this.isLessonPlaylistActive = false;
        this.lessonPlaylistSlides = [];
        this.lessonPlaylistIndex = 0;
        this.pdfPageBoardData = null;
        this._suspendedPdfBoardState = null;
        this._coveredGraphStateBackup = null;
        this._graphCaseCounter = 0;
        this._graphSessionArchived = false;
        this.isGraphCovered = true;
        this.graphs = [];
        this.activeGraphIdx = -1;
        this.selectedHandleIdx = null;
        this.isCurveSelected = false;
        this.dropLines = [];
        this.textLabels = [];
        this.inkStrokes = [];
        this.boardStickers = [];
        this.undoStack = [];
        this.redoStack = [];
        this.boardPanX = 0;
        this.boardPanY = 0;
        this.boardZoom = 1.0;
        this.boardZoomOffsetX = 0;
        this.boardZoomOffsetY = 0;
        if (typeof this._clearMainLassoSelectionSilent === 'function') {
          this._clearMainLassoSelectionSilent();
        }
        if (typeof this.renderBoardStickersDOM === 'function') {
          this.renderBoardStickersDOM();
        }
        this.updateUndoRedoUI();
      } finally {
        this._isApplyingUserPrefs = false;
      }

      if (typeof document !== 'undefined') {
        document.documentElement.classList.add('screen-annotate-html');
        if (document.body) {
          document.body.classList.add('screen-annotate-mode');
        }
      }

      // 3. 기본 펜 도구 활성화 및 사용자 설정 UI 프리셋(전체 표시 / 필기바만 / 모두 숨김) 적용
      if (!this.isInkMode && typeof this.toggleInkMode === 'function') {
        this.toggleInkMode(true);
      }
      this.setActiveInkTool('pen');
      this._applyScreenAnnotateUiPreset(this.screenAnnotateUiMode || 'all');

      // 4. 네이티브 OS 투명 최상단 창 전환 호출
      if (typeof dBridge.enterScreenAnnotate === 'function') {
        try {
          await dBridge.enterScreenAnnotate({ prevBg: prevBgColor });
        } catch (_) { }
      }

      this.clearInkCache();
      this._hasSceneFreeze = false;
      if (typeof this.resizeCanvas === 'function') this.resizeCanvas();
      this.render();

      // 5. 창 전환 및 투명 캔버스 준비 완료 직후 베일을 스르륵 페이드 아웃하여 뒷배경 노출
      if (typeof dBridge.fadeOutScreenVeil === 'function') {
        try { dBridge.fadeOutScreenVeil(); } catch (_) { }
      }
      return true;
    }

    async exitScreenAnnotateMode() {
      if (!this.isScreenAnnotateMode) return false;

      const dBridge = (typeof window !== 'undefined' && window.__GRAPHLY_DESKTOP__ && window.__GRAPHLY_DESKTOP__.isDesktopApp)
        ? window.__GRAPHLY_DESKTOP__
        : null;

      const savedThemeKey = this._screenAnnotateSavedThemeKey || 'white_paper';
      const savedThemeObj = (this.canvasThemes && this.canvasThemes[savedThemeKey]) || { bg: '#ffffff' };
      const restoreBgColor = this.isMonochromeMode ? '#ffffff' : (savedThemeObj.bg || '#ffffff');

      // 복귀 시에도 원래 칠판 배경색 베일을 부드럽게 페이드 인하여 창 복원 중 깜빡임 차단
      if (dBridge && typeof dBridge.fadeInScreenVeil === 'function') {
        try { await dBridge.fadeInScreenVeil(restoreBgColor); } catch (_) { }
      }

      // 스크린 판서 중 생성된 임시 카드·필기 전량 정리(휘발)
      this.isDrawingInk = false;
      this.currentInkStroke = null;
      if (typeof this._clearMainLassoSelectionSilent === 'function') {
        this._clearMainLassoSelectionSilent();
      }
      if (typeof this.closeProblemCard === 'function') this.closeProblemCard();
      if (typeof this.closeGraphCard === 'function') this.closeGraphCard();
      if (Array.isArray(this.extraProblemCards) && this.extraProblemCards.length > 0) {
        this.extraProblemCards.forEach(c => { if (c && c.el) c.el.remove(); });
        this.extraProblemCards = [];
      }
      if (Array.isArray(this.extraGraphCards) && this.extraGraphCards.length > 0) {
        this.extraGraphCards.forEach(c => { if (c && c.el) c.el.remove(); });
        this.extraGraphCards = [];
      }
      if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }

      this.isScreenAnnotateMode = false;
      this._activeScreenAnnotateUiLayout = 'all';

      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('screen-annotate-html');
        if (document.body) {
          document.body.classList.remove('screen-annotate-mode', 'screen-annotate-ui-inkbar');
        }
      }

      // 네이티브 OS 원래 창 크기·배경 복원 호출
      if (dBridge && typeof dBridge.exitScreenAnnotate === 'function') {
        try {
          await dBridge.exitScreenAnnotate();
        } catch (_) { }
      }

      // 백업해 둔 원래 칠판 작업 상태 100% 무손실 복원
      const backup = this._screenAnnotateBackup;
      this._screenAnnotateBackup = null;
      this._screenAnnotateSavedThemeKey = null;

      if (backup) {
        this._isApplyingUserPrefs = true;
        try {
          if (backup.themeKey && typeof this.setCanvasTheme === 'function') {
            this.setCanvasTheme(backup.themeKey, false);
          }
          this.savedPenColor = backup.savedPenColor || '#1e293b';
          this.savedHighlighterColor = backup.savedHighlighterColor || '#1e293b';
          this.currentInkColor = backup.currentInkColor || this.savedPenColor;

          if (backup.workspaceSnap) {
            this._restoreFullWorkspaceSnapshot(backup.workspaceSnap);
          }
          this.undoStack = Array.isArray(backup.undoStack) ? [...backup.undoStack] : [];
          this.redoStack = Array.isArray(backup.redoStack) ? [...backup.redoStack] : [];
          this.updateUndoRedoUI();

          if (Boolean(this.isInkMode) !== Boolean(backup.isInkMode) && typeof this.toggleInkMode === 'function') {
            this.toggleInkMode(Boolean(backup.isInkMode));
          }
          if (backup.isInkMode && backup.activeInkTool) {
            this.setActiveInkTool(backup.activeInkTool);
          }
          this.isBottomInkBarHidden = Boolean(backup.isBottomInkBarHidden);
          this.isQuickPillRemoteOpen = Boolean(backup.isQuickPillRemoteOpen);
          if (typeof this.syncInkUiVisibility === 'function') {
            this.syncInkUiVisibility({ clampPillPosition: Boolean(this.isQuickPillRemoteOpen) });
          }
          this.toggleAllUIHidden(Boolean(backup.isAllUIHidden));
        } finally {
          this._isApplyingUserPrefs = false;
        }
      }

      this.syncScreenAnnotateButtonsUI();
      this.clearInkCache();
      this._hasSceneFreeze = false;
      if (typeof this.resizeCanvas === 'function') this.resizeCanvas();
      this.render();
      if (dBridge && typeof dBridge.hideScreenFadeVeil === 'function') {
        try { dBridge.hideScreenFadeVeil(); } catch (_) { }
      }
      return true;
    }

    refreshDesktopCaptureConfigState(reRenderIfOpen = false) {
      const dBridge = (typeof window !== 'undefined' && window.__GRAPHLY_DESKTOP__ && typeof window.__GRAPHLY_DESKTOP__.getCaptureConfig === 'function')
        ? window.__GRAPHLY_DESKTOP__
        : null;
      if (!dBridge) return Promise.resolve(null);

      return dBridge.getCaptureConfig().then((cfg) => {
        if (cfg && cfg.ok) {
          this._pcCaptureState = {
            supported: cfg.supported !== false,
            hotkey: String(cfg.hotkey == null ? 'F8' : cfg.hotkey).trim(),
            hotkeyRegistered: cfg.hotkeyRegistered !== false,
            autoStamp: Boolean(cfg.autoStamp),
            autoStart: Boolean(cfg.autoStart)
          };
          if (!this._pcCaptureDirty && this._draftPcCapture) {
            this._draftPcCapture = { ...this._pcCaptureState };
          }
          if (reRenderIfOpen && this.isShortcutSettingsModalOpen()) {
            this.renderShortcutSettingsModalList();
          }
          this.syncPcExclusiveSettingsPanelUI(false);
        }
        return this._pcCaptureState;
      }).catch(() => null);
    }

    _validatePcGlobalHotkeyCandidate(cleanKey) {
      if (!cleanKey) return true;
      const upper = cleanKey.toUpperCase();
      if (upper === 'F11') {
        this.setShortcutModalBanner(
          '[F11] 키는 전체화면 전환 전용 키이므로 다른 단축키를 입력해 주세요.',
          'warning'
        );
        return false;
      }
      const reservedSys = ['CTRL+C', 'CTRL+V', 'CTRL+X', 'CTRL+Z', 'CTRL+A', 'CTRL+S', 'ALT+F4', 'ALT+TAB'];
      if (reservedSys.includes(upper)) {
        this.setShortcutModalBanner(
          `[${this.formatShortcutKeyForDisplay(cleanKey)}] 키는 OS 기본 편집·창 제어 단축키이므로 사용할 수 없습니다.`,
          'warning'
        );
        return false;
      }

      const isFunctionOrPrintKey = /^F([1-9]|1[0-2])$/i.test(cleanKey) || upper === 'PRINTSCREEN';
      const hasCtrlOrAlt = upper.includes('CTRL+') || upper.includes('ALT+');
      if (!isFunctionOrPrintKey && !hasCtrlOrAlt) {
        this.setShortcutModalBanner(
          '외부 문서 타이핑 방해를 막기 위해 <strong>F1~F10 · PrintScreen</strong> 또는 <strong>Ctrl · Alt 조합키</strong>로 입력해 주세요.',
          'warning'
        );
        return false;
      }
      return true;
    }

    assignDraftPcQuickCaptureHotkey(newKey) {
      if (!this._draftPcCapture) return;
      const cleanKey = String(newKey || '').trim();
      if (!this._validatePcGlobalHotkeyCandidate(cleanKey)) return;

      let clearedOther = '';
      if (cleanKey && this._draftPcScreenHotkey && this._draftPcScreenHotkey.toUpperCase() === cleanKey.toUpperCase()) {
        this._draftPcScreenHotkey = '';
        this._pcScreenHotkeyDirty = true;
        clearedOther = '스크린 판서 시작 / 종료';
      }
      if (cleanKey && this._draftPcScreenToggleHotkey && this._draftPcScreenToggleHotkey.toUpperCase() === cleanKey.toUpperCase()) {
        this._draftPcScreenToggleHotkey = '';
        this._pcScreenToggleHotkeyDirty = true;
        clearedOther = clearedOther || '스크린 판서: 필기 ⇄ 배경 조작';
      }

      this._draftPcCapture.hotkey = cleanKey;
      this._draftPcCapture.hotkeyRegistered = true;
      this._recordingShortcutActionId = null;
      this._pcCaptureDirty = true;
      this._syncShortcutSaveBtnState();

      if (clearedOther) {
        this.setShortcutModalBanner(
          `기존 <strong>${clearedOther}</strong> 단축키가 해제되고 <strong>외부 화면 빠른 캡처</strong>에 <strong>${this.formatShortcutKeyForDisplay(cleanKey)}</strong> 키가 지정되었습니다.`,
          'warning'
        );
      } else if (cleanKey) {
        this.setShortcutModalBanner(
          `<strong>외부 화면 빠른 캡처</strong> 단축키가 <strong>${this.formatShortcutKeyForDisplay(cleanKey)}</strong> 키로 지정되었습니다.`,
          'normal'
        );
      } else {
        this.setShortcutModalBanner(
          '<strong>외부 화면 빠른 캡처</strong> 단축키가 해제되었습니다.',
          'normal'
        );
      }
      this.renderShortcutSettingsModalList();
    }

    assignDraftPcScreenAnnotateHotkey(newKey) {
      const cleanKey = String(newKey || '').trim();
      if (!this._validatePcGlobalHotkeyCandidate(cleanKey)) return;

      let clearedOther = '';
      if (cleanKey && this._draftPcCapture && this._draftPcCapture.hotkey && this._draftPcCapture.hotkey.toUpperCase() === cleanKey.toUpperCase()) {
        this._draftPcCapture.hotkey = '';
        this._pcCaptureDirty = true;
        clearedOther = '외부 화면 빠른 캡처';
      }
      if (cleanKey && this._draftPcScreenToggleHotkey && this._draftPcScreenToggleHotkey.toUpperCase() === cleanKey.toUpperCase()) {
        this._draftPcScreenToggleHotkey = '';
        this._pcScreenToggleHotkeyDirty = true;
        clearedOther = clearedOther || '스크린 판서: 필기 ⇄ 배경 조작';
      }
      if (cleanKey && this._draftShortcuts) {
        this.getShortcutDefinitions().forEach(def => {
          const otherKey = String(this._draftShortcuts[def.id] || '').trim();
          if (otherKey && otherKey.toUpperCase() === cleanKey.toUpperCase()) {
            this._draftShortcuts[def.id] = '';
            this._shortcutModalDirty = true;
          }
        });
      }

      this._draftPcScreenHotkey = cleanKey;
      this._recordingShortcutActionId = null;
      this._pcScreenHotkeyDirty = true;
      this._syncShortcutSaveBtnState();

      if (clearedOther) {
        this.setShortcutModalBanner(
          `기존 <strong>${clearedOther}</strong> 단축키가 해제되고 <strong>스크린 판서 시작 / 종료</strong>에 <strong>${this.formatShortcutKeyForDisplay(cleanKey)}</strong> 키가 지정되었습니다.`,
          'warning'
        );
      } else if (cleanKey) {
        this.setShortcutModalBanner(
          `<strong>스크린 판서 시작 / 종료</strong> 단축키가 <strong>${this.formatShortcutKeyForDisplay(cleanKey)}</strong> 키로 지정되었습니다.`,
          'normal'
        );
      } else {
        this.setShortcutModalBanner(
          '<strong>스크린 판서 시작 / 종료</strong> 단축키가 해제되었습니다.',
          'normal'
        );
      }
      this.renderShortcutSettingsModalList();
    }

    assignDraftPcScreenToggleInkHotkey(newKey) {
      const cleanKey = String(newKey || '').trim();
      if (!this._validatePcGlobalHotkeyCandidate(cleanKey)) return;

      let clearedOther = '';
      if (cleanKey && this._draftPcCapture && this._draftPcCapture.hotkey && this._draftPcCapture.hotkey.toUpperCase() === cleanKey.toUpperCase()) {
        this._draftPcCapture.hotkey = '';
        this._pcCaptureDirty = true;
        clearedOther = '외부 화면 빠른 캡처';
      }
      if (cleanKey && this._draftPcScreenHotkey && this._draftPcScreenHotkey.toUpperCase() === cleanKey.toUpperCase()) {
        this._draftPcScreenHotkey = '';
        this._pcScreenHotkeyDirty = true;
        clearedOther = clearedOther || '스크린 판서 시작 / 종료';
      }
      if (cleanKey && this._draftShortcuts) {
        this.getShortcutDefinitions().forEach(def => {
          const otherKey = String(this._draftShortcuts[def.id] || '').trim();
          if (otherKey && otherKey.toUpperCase() === cleanKey.toUpperCase()) {
            this._draftShortcuts[def.id] = '';
            this._shortcutModalDirty = true;
          }
        });
      }

      this._draftPcScreenToggleHotkey = cleanKey;
      this._recordingShortcutActionId = null;
      this._pcScreenToggleHotkeyDirty = true;
      this._syncShortcutSaveBtnState();

      if (clearedOther) {
        this.setShortcutModalBanner(
          `기존 <strong>${clearedOther}</strong> 단축키가 해제되고 <strong>스크린 판서: 필기 ⇄ 배경 조작</strong>에 <strong>${this.formatShortcutKeyForDisplay(cleanKey)}</strong> 키가 지정되었습니다.`,
          'warning'
        );
      } else if (cleanKey) {
        this.setShortcutModalBanner(
          `<strong>스크린 판서: 필기 ⇄ 배경 조작</strong> 단축키가 <strong>${this.formatShortcutKeyForDisplay(cleanKey)}</strong> 키로 지정되었습니다.`,
          'normal'
        );
      } else {
        this.setShortcutModalBanner(
          '<strong>스크린 판서: 필기 ⇄ 배경 조작</strong> 단축키가 해제되었습니다.',
          'normal'
        );
      }
      this.renderShortcutSettingsModalList();
    }

    openShortcutSettingsModal(initialCategory = null) {
      const modal = document.getElementById('modalShortcutSettings');
      if (!modal) return;
      if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }
      if (initialCategory && ['all', 'ink', 'graph', 'slide', 'system', 'pc'].includes(initialCategory)) {
        this._shortcutActiveCategory = initialCategory;
        const catTabsWrap = document.getElementById('shortcutCategoryTabs');
        if (catTabsWrap) {
          catTabsWrap.querySelectorAll('.shortcut-cat-tab').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-scat') === initialCategory);
          });
        }
      }
      this._draftShortcuts = { ...this._getEffectiveShortcutsMap(this.customShortcuts) };
      this._draftPcCapture = { ...this._pcCaptureState };
      this._draftPcScreenHotkey = String(this.pcScreenAnnotateHotkey == null ? 'F9' : this.pcScreenAnnotateHotkey).trim();
      this._draftPcScreenToggleHotkey = String(this.pcScreenToggleInkHotkey == null ? 'F10' : this.pcScreenToggleInkHotkey).trim();
      this._recordingShortcutActionId = null;
      this._shortcutModalDirty = false;
      this._pcCaptureDirty = false;
      this._pcScreenHotkeyDirty = false;
      this._pcScreenToggleHotkeyDirty = false;

      const badgeSync = document.getElementById('badgeShortcutAccountSync');
      if (badgeSync) {
        if (this.cloudUser && this.cloudUser.uid) {
          const emailOrName = this.cloudUser.displayName || this.cloudUser.email || '로그인 계정';
          badgeSync.textContent = `${emailOrName} · 계정 동기화`;
          badgeSync.classList.remove('is-guest');
        } else {
          badgeSync.textContent = '로그인 시 계정 동기화';
          badgeSync.classList.add('is-guest');
        }
      }

      this.setShortcutModalBanner(
        '변경할 기능의 단축키를 클릭한 뒤 새 키를 입력해 주세요.',
        'normal'
      );
      this._syncShortcutSaveBtnState();
      this.renderShortcutSettingsModalList();
      modal.classList.add('show');
      this.refreshDesktopCaptureConfigState(true);
    }

    closeShortcutSettingsModal() {
      const modal = document.getElementById('modalShortcutSettings');
      if (modal) modal.classList.remove('show');
      this._recordingShortcutActionId = null;
      this._draftShortcuts = null;
      this._draftPcCapture = null;
      this._draftPcScreenHotkey = null;
      this._draftPcScreenToggleHotkey = null;
      this._shortcutModalDirty = false;
      this._pcCaptureDirty = false;
      this._pcScreenHotkeyDirty = false;
      this._pcScreenToggleHotkeyDirty = false;
    }

    _syncShortcutSaveBtnState() {
      const btnSave = document.getElementById('btnSaveShortcutSettings');
      if (!btnSave) return;
      const hasChanges = Boolean(this._shortcutModalDirty || this._pcCaptureDirty || this._pcScreenHotkeyDirty || this._pcScreenToggleHotkeyDirty);
      btnSave.classList.toggle('has-unsaved-changes', hasChanges);
      btnSave.textContent = hasChanges ? '변경사항 저장' : '저장하기';
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
        if (this._draftPcScreenHotkey && this._draftPcScreenHotkey.toUpperCase() === cleanKey.toUpperCase()) {
          this._draftPcScreenHotkey = '';
          this._pcScreenHotkeyDirty = true;
        }
        if (this._draftPcScreenToggleHotkey && this._draftPcScreenToggleHotkey.toUpperCase() === cleanKey.toUpperCase()) {
          this._draftPcScreenToggleHotkey = '';
          this._pcScreenToggleHotkeyDirty = true;
        }
      }

      this._draftShortcuts[actionId] = cleanKey;
      this._recordingShortcutActionId = null;
      this._shortcutModalDirty = true;
      this._syncShortcutSaveBtnState();

      const dispKey = this.formatShortcutKeyForDisplay(cleanKey);
      if (unassignedDef) {
        this.setShortcutModalBanner(
          `기존 <strong>${unassignedDef.name}</strong>의 단축키가 해제되고 <strong>${targetDef.name}</strong>에 <strong>${dispKey}</strong> 키가 지정되었습니다.`,
          'warning'
        );
      } else if (cleanKey) {
        this.setShortcutModalBanner(
          `<strong>${targetDef.name}</strong> 단축키가 <strong>${dispKey}</strong> 키로 지정되었습니다.`,
          'normal'
        );
      } else {
        this.setShortcutModalBanner(
          `<strong>${targetDef.name}</strong> 단축키가 해제되었습니다.`,
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
      const envMode = this._getPcShortcutSectionEnvMode();
      if (envMode === 'desktop-win' && this._draftPcCapture) {
        if (this._draftPcCapture.hotkey !== 'F8') {
          this._draftPcCapture.hotkey = 'F8';
          this._draftPcCapture.hotkeyRegistered = true;
          this._pcCaptureDirty = true;
        }
      }
      if ((envMode === 'desktop-win' || envMode === 'desktop-mac') && this._draftPcScreenHotkey !== 'F9') {
        this._draftPcScreenHotkey = 'F9';
        this._pcScreenHotkeyDirty = true;
      }
      if ((envMode === 'desktop-win' || envMode === 'desktop-mac') && this._draftPcScreenToggleHotkey !== 'F10') {
        this._draftPcScreenToggleHotkey = 'F10';
        this._pcScreenToggleHotkeyDirty = true;
      }
      this._recordingShortcutActionId = null;
      this._shortcutModalDirty = true;
      this._syncShortcutSaveBtnState();
      this.setShortcutModalBanner(
        '모든 단축키가 기본값으로 초기화되었습니다.',
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

      const pendingScreenHk = this._pcScreenHotkeyDirty
        ? String(this._draftPcScreenHotkey == null ? '' : this._draftPcScreenHotkey).trim()
        : null;
      if (pendingScreenHk !== null) {
        this.pcScreenAnnotateHotkey = pendingScreenHk;
        try {
          localStorage.setItem('graphly_pc_screen_annotate_hotkey_v1', pendingScreenHk);
        } catch (_) { }
      }

      const pendingToggleHk = this._pcScreenToggleHotkeyDirty
        ? String(this._draftPcScreenToggleHotkey == null ? '' : this._draftPcScreenToggleHotkey).trim()
        : null;
      if (pendingToggleHk !== null) {
        this.pcScreenToggleInkHotkey = pendingToggleHk;
        try {
          localStorage.setItem('graphly_pc_screen_toggle_ink_hotkey_v1', pendingToggleHk);
        } catch (_) { }
      }

      // 로그인 계정 환경설정(localStorage + Firestore user_preferences)에 0ms 즉시 저장
      if (typeof this.flushSaveUserPreferencesNow === 'function') {
        this.flushSaveUserPreferencesNow();
      } else if (typeof this.scheduleSaveUserPreferences === 'function') {
        this.scheduleSaveUserPreferences();
      }

      // PC 버전 실행 중일 경우 트레이 도우미 빠른 캡처 단축키 및 스크린 판서 전역 단축키 즉시 동기화 반영
      const pendingPcCfg = (this._pcCaptureDirty && this._draftPcCapture) ? { ...this._draftPcCapture } : null;
      const dBridge = (typeof window !== 'undefined' && window.__GRAPHLY_DESKTOP__ && window.__GRAPHLY_DESKTOP__.isDesktopApp)
        ? window.__GRAPHLY_DESKTOP__
        : null;

      this.syncShortcutTooltipsAndGuideUI();
      this.syncScreenAnnotateButtonsUI();
      this.syncPcExclusiveSettingsPanelUI(false);
      this.closeShortcutSettingsModal();

      if (pendingScreenHk !== null && dBridge && typeof dBridge.setScreenAnnotateHotkey === 'function') {
        dBridge.setScreenAnnotateHotkey(pendingScreenHk).catch(() => { });
      }
      if (pendingToggleHk !== null && dBridge && typeof dBridge.setScreenToggleInkHotkey === 'function') {
        dBridge.setScreenToggleInkHotkey(pendingToggleHk).catch(() => { });
      }

      if (pendingPcCfg && dBridge && typeof dBridge.setCaptureConfig === 'function') {
        dBridge.setCaptureConfig({
          hotkey: pendingPcCfg.hotkey
        }).then((res) => {
          if (res && res.ok) {
            this._pcCaptureState = {
              supported: res.supported !== false,
              hotkey: String(res.hotkey == null ? '' : res.hotkey).trim(),
              hotkeyRegistered: res.hotkeyRegistered !== false,
              autoStamp: Boolean(res.autoStamp),
              autoStart: Boolean(res.autoStart)
            };
            this.syncPcExclusiveSettingsPanelUI(false);
            if (res.hotkeyRegistered === false && pendingPcCfg.hotkey) {
              if (typeof this.showToast === 'function') {
                this.showToast(`⚠️ [${this.formatShortcutKeyForDisplay(pendingPcCfg.hotkey)}] 단축키는 다른 프로그램이 사용 중입니다. 다른 키로 변경해 주세요.`);
              }
            }
          }
        }).catch(() => { });
      }
    }

    _decomposeHangulForShortcutSearch(str, choseongOnly = false) {
      const CHOSEONG = [
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
        'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
      ];
      const JUNGSEONG = [
        'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ',
        'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'
      ];
      const JONGSEONG = [
        '', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ',
        'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ',
        'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
      ];
      const COMPAT_MAP = {
        'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ',
        'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
        'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ'
      };
      let out = '';
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        const code = ch.charCodeAt(0);
        if (code >= 0xAC00 && code <= 0xD7A3) {
          const offset = code - 0xAC00;
          const cho = CHOSEONG[Math.floor(offset / 588)];
          if (choseongOnly) {
            out += cho;
          } else {
            const jung = JUNGSEONG[Math.floor((offset % 588) / 28)];
            const jong = JONGSEONG[offset % 28];
            out += cho + jung + jong;
          }
        } else if (!choseongOnly && COMPAT_MAP[ch]) {
          out += COMPAT_MAP[ch];
        } else {
          out += ch;
        }
      }
      return out;
    }

    _matchesShortcutSearchQuery(targetText, rawQuery) {
      if (!rawQuery) return true;
      const query = String(rawQuery).normalize('NFC').toLowerCase();
      const target = String(targetText || '').normalize('NFC').toLowerCase();
      if (!target) return false;
      if (target.includes(query)) return true;

      const qCompact = query.replace(/\s+/g, '');
      if (!qCompact) return true;
      const tCompact = target.replace(/\s+/g, '');
      if (tCompact.includes(qCompact)) return true;

      if (!/[\u3131-\u3163\uAC00-\uD7A3]/.test(qCompact)) return false;

      // 1) 순수 초성 검색 (예: 'ㅈㅇㄱ' -> '지우개', 'ㅎㄱㅍ' -> '형광펜')
      if (/^[ㄱ-ㅎ]+$/.test(qCompact)) {
        const tCho = this._decomposeHangulForShortcutSearch(tCompact, true);
        if (tCho.includes(qCompact)) return true;
      }

      // 2) 한글 조합 중 자모/받침 전이 대응 (예: 'ㅈ'->'지'->'징'->'지우'->'지욱'->'지우개', '글'->'그래프')
      // 음절 시작 경계에서만 prefix 매칭하여 이전 글자 받침 오매칭('ㄱ' 검색 시 '직선' 매칭 등) 원천 차단
      const qJamo = this._decomposeHangulForShortcutSearch(qCompact, false);
      for (let i = 0; i < tCompact.length; i++) {
        const subJamo = this._decomposeHangulForShortcutSearch(tCompact.slice(i, i + qCompact.length + 2), false);
        if (subJamo.startsWith(qJamo)) return true;
      }
      return false;
    }

    _buildPcExclusiveShortcutSection(activeCat, query) {
      if (activeCat !== 'all' && activeCat !== 'pc') return null;

      const envMode = this._getPcShortcutSectionEnvMode();
      const isDesktopWin = (envMode === 'desktop-win');
      const isDesktopApp = (envMode === 'desktop-win' || envMode === 'desktop-mac');
      const pcDraft = this._draftPcCapture || this._pcCaptureState || {
        hotkey: 'F8',
        hotkeyRegistered: true,
        autoStamp: false,
        autoStart: false
      };

      const curCapHotkey = String(pcDraft.hotkey ?? 'F8').trim();
      const curCapDisp = this.formatShortcutKeyForDisplay(curCapHotkey).toLowerCase();
      const curSaHotkey = String(
        (this._draftPcScreenHotkey !== null && this._draftPcScreenHotkey !== undefined)
          ? this._draftPcScreenHotkey
          : (this.pcScreenAnnotateHotkey ?? 'F9')
      ).trim();
      const curSaDisp = this.formatShortcutKeyForDisplay(curSaHotkey).toLowerCase();
      const curToggleHotkey = String(
        (this._draftPcScreenToggleHotkey !== null && this._draftPcScreenToggleHotkey !== undefined)
          ? this._draftPcScreenToggleHotkey
          : (this.pcScreenToggleInkHotkey ?? 'F10')
      ).trim();
      const curToggleDisp = this.formatShortcutKeyForDisplay(curToggleHotkey).toLowerCase();

      // [자동 고정 · 자동 실행 토글은 환경설정 > PC 전용 탭으로 이관 완료 — 단축키 창에는 순수 단축키 3개(F8·F9·F10) 유지]
      const pcItemsMeta = [
        {
          id: 'pc_quick_capture',
          name: '외부 화면 빠른 캡처',
          desc: '한글(HWP)·웹 등 외부 화면을 드래그해 칠판에 즉시 삽입 · (기본값: F8)',
          defaultKey: 'F8',
          curKey: curCapHotkey,
          curDisp: curCapDisp,
          recId: '__pc_quick_capture__',
          editable: isDesktopWin,
          keywords: '빠른 캡처 외부 화면 pc 버전 전용 f8 printscreen'
        },
        {
          id: 'pc_screen_annotate',
          name: '스크린 판서 시작 / 종료',
          desc: '바탕화면·한글·PPT 위에 바로 판서하고 그래프 창 표시 · 종료는 ESC도 가능 · (기본값: F9)',
          defaultKey: 'F9',
          curKey: curSaHotkey,
          curDisp: curSaDisp,
          recId: '__pc_screen_annotate__',
          editable: isDesktopApp,
          keywords: '스크린 판서 투명 화면 필기 오버레이 pc 버전 전용 f9 esc'
        },
        {
          id: 'pc_screen_toggle_ink',
          name: '스크린 판서: 필기 ⇄ 배경 조작',
          desc: '스크린 판서 중 필기 모드와 뒷배경(웹·문서) 조작 모드를 즉시 전환 · (기본값: F10)',
          defaultKey: 'F10',
          curKey: curToggleHotkey,
          curDisp: curToggleDisp,
          recId: '__pc_screen_toggle_ink__',
          editable: isDesktopApp,
          keywords: '스크린 판서 필기 펜 배경 조작 선택 이동 전환 토글 복귀 pc 버전 전용 f10'
        }
      ];

      const matchedItems = pcItemsMeta.filter(item => {
        if (!query) return true;
        return this._matchesShortcutSearchQuery(item.name, query)
          || this._matchesShortcutSearchQuery(item.desc, query)
          || this._matchesShortcutSearchQuery(item.keywords, query)
          || item.curDisp.includes(query)
          || item.curKey.toLowerCase().includes(query);
      });

      if (matchedItems.length === 0) return null;

      const secEl = document.createElement('div');
      secEl.className = 'shortcut-cat-section';

      const headerEl = document.createElement('div');
      headerEl.className = 'shortcut-cat-section-header';
      headerEl.innerHTML = `<span>PC 전용 단축키<span class="shortcut-pc-only-pill">PC버전 전용</span></span><span style="font-size:11px; opacity:0.75;">${matchedItems.length}개 기능</span>`;
      secEl.appendChild(headerEl);

      // 웹 브라우저 또는 아이패드/모바일 접속 시 상단 안내/다운로드 바 표시
      if (!isDesktopApp) {
        const promoBar = document.createElement('div');
        promoBar.className = 'shortcut-pc-promo-bar';

        const promoText = document.createElement('div');
        promoText.className = 'shortcut-pc-promo-text';

        if (envMode === 'mobile-tablet') {
          promoText.textContent = 'Windows PC에서 graphly.net에 접속해 Graphly PC 버전을 설치하시면 아래 단축키 기능을 모두 사용할 수 있습니다.';
          promoBar.appendChild(promoText);
        } else {
          promoText.textContent = 'Graphly PC 버전을 설치하시면 바탕화면·한글·PPT 위 스크린 판서와 빠른 캡처(F8)를 바로 사용할 수 있습니다.';
          const dlLink = document.createElement('a');
          dlLink.href = 'downloads/GraphlySetup_Windows_x64.exe?v=1.2.5';
          dlLink.setAttribute('download', 'GraphlySetup_Windows_x64.exe');
          dlLink.className = 'shortcut-pc-download-btn';
          dlLink.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>PC버전 다운로드</span>';
          promoBar.appendChild(promoText);
          promoBar.appendChild(dlLink);
        }

        secEl.appendChild(promoBar);
      }

      matchedItems.forEach(item => {
        const isCaptureKeyRow = (item.id === 'pc_quick_capture');
        const isRecording = item.editable && (this._recordingShortcutActionId === item.recId);

        const row = document.createElement('div');
        row.className = 'shortcut-row' + (isRecording ? ' is-recording-row' : '');

        const infoWrap = document.createElement('div');
        infoWrap.className = 'shortcut-row-info';

        const titleEl = document.createElement('div');
        titleEl.className = 'shortcut-row-title';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        titleEl.appendChild(nameSpan);

        const pcBadge = document.createElement('span');
        pcBadge.className = 'shortcut-pc-only-pill';
        pcBadge.textContent = 'PC버전 전용';
        titleEl.appendChild(pcBadge);

        if (item.editable) {
          const isUnassigned = !item.curKey;
          const isCustomized = (item.curKey.toUpperCase() !== item.defaultKey.toUpperCase());
          if (isCustomized) {
            const customBadge = document.createElement('span');
            customBadge.className = 'shortcut-custom-dot';
            customBadge.textContent = isUnassigned ? '해제됨' : '맞춤';
            titleEl.appendChild(customBadge);
          }
          if (isCaptureKeyRow && !isUnassigned && pcDraft.hotkeyRegistered === false) {
            const conflictBadge = document.createElement('span');
            conflictBadge.className = 'shortcut-pc-conflict-pill';
            conflictBadge.textContent = '키 중복(변경 필요)';
            titleEl.appendChild(conflictBadge);
          }
        }

        const descEl = document.createElement('div');
        descEl.className = 'shortcut-row-desc';
        descEl.textContent = item.desc;

        infoWrap.appendChild(titleEl);
        infoWrap.appendChild(descEl);

        const ctrlWrap = document.createElement('div');
        ctrlWrap.className = 'shortcut-row-controls';

        if (!item.editable) {
          const roPill = document.createElement('span');
          roPill.className = 'shortcut-pc-readonly-pill';
          roPill.textContent = (envMode === 'desktop-mac' && isCaptureKeyRow)
            ? 'Windows 전용'
            : `기본 단축키: ${item.defaultKey}`;
          ctrlWrap.appendChild(roPill);
        } else {
          const isUnassigned = !item.curKey;
          const isCustomized = (item.curKey.toUpperCase() !== item.defaultKey.toUpperCase());

          const bindBtn = document.createElement('button');
          bindBtn.type = 'button';
          bindBtn.className = 'shortcut-bind-btn'
            + (isRecording ? ' is-recording' : '')
            + (!isRecording && isUnassigned ? ' is-unassigned' : '')
            + (!isRecording && !isUnassigned && isCustomized ? ' is-customized' : '');
          bindBtn.textContent = isRecording
            ? '키 입력 대기 · ESC 취소'
            : this.formatShortcutKeyForDisplay(item.curKey);
          bindBtn.title = isRecording
            ? '새 단축키 입력 (ESC: 취소)'
            : `${item.name} 단축키 변경`;
          bindBtn.onclick = (e) => {
            e.stopPropagation();
            if (this._recordingShortcutActionId === item.recId) {
              this._recordingShortcutActionId = null;
              this.setShortcutModalBanner(
                '변경할 기능의 단축키를 클릭한 뒤 새 키를 입력해 주세요.',
                'normal'
              );
            } else {
              this._recordingShortcutActionId = item.recId;
              this.setShortcutModalBanner(
                `<strong>${item.name}</strong>에 지정할 키(F1~F10, PrintScreen 또는 Ctrl·Alt 조합키)를 입력해 주세요. (취소: ESC)`,
                'recording'
              );
            }
            this.renderShortcutSettingsModalList();
          };

          const clearBtn = document.createElement('button');
          clearBtn.type = 'button';
          clearBtn.className = 'shortcut-mini-icon-btn';
          clearBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
          clearBtn.title = '단축키 해제';
          clearBtn.disabled = isUnassigned;
          clearBtn.onclick = (e) => {
            e.stopPropagation();
            if (isCaptureKeyRow) {
              this.assignDraftPcQuickCaptureHotkey('');
            } else if (item.id === 'pc_screen_toggle_ink') {
              this.assignDraftPcScreenToggleInkHotkey('');
            } else {
              this.assignDraftPcScreenAnnotateHotkey('');
            }
          };

          const resetOneBtn = document.createElement('button');
          resetOneBtn.type = 'button';
          resetOneBtn.className = 'shortcut-mini-icon-btn is-reset-btn';
          resetOneBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
          resetOneBtn.title = `기본값 복원 (${item.defaultKey})`;
          resetOneBtn.disabled = !isCustomized;
          resetOneBtn.onclick = (e) => {
            e.stopPropagation();
            if (isCaptureKeyRow) {
              this.assignDraftPcQuickCaptureHotkey(item.defaultKey);
            } else if (item.id === 'pc_screen_toggle_ink') {
              this.assignDraftPcScreenToggleInkHotkey(item.defaultKey);
            } else {
              this.assignDraftPcScreenAnnotateHotkey(item.defaultKey);
            }
          };

          ctrlWrap.appendChild(bindBtn);
          ctrlWrap.appendChild(clearBtn);
          ctrlWrap.appendChild(resetOneBtn);
        }

        row.appendChild(infoWrap);
        row.appendChild(ctrlWrap);
        secEl.appendChild(row);
      });

      return secEl;
    }

    renderShortcutSettingsModalList() {
      const listEl = document.getElementById('shortcutSettingsList');
      if (!listEl) return;

      const draft = this._draftShortcuts || this._getEffectiveShortcutsMap(this.customShortcuts);
      const activeCat = this._shortcutActiveCategory || 'all';
      const query = String(this._shortcutSearchQuery || '').toLowerCase();

      const defs = (activeCat === 'pc')
        ? []
        : this.getShortcutDefinitions().filter(def => {
            if (activeCat !== 'all' && def.category !== activeCat) return false;
            if (query) {
              const curKeyDisp = this.formatShortcutKeyForDisplay(draft[def.id] || '').toLowerCase();
              const matchName = this._matchesShortcutSearchQuery(def.name, query);
              const matchDesc = this._matchesShortcutSearchQuery(def.desc || '', query);
              const matchKey = curKeyDisp.includes(query) || String(draft[def.id] || '').toLowerCase().includes(query);
              return matchName || matchDesc || matchKey;
            }
            return true;
          });

      const pcSectionEl = this._buildPcExclusiveShortcutSection(activeCat, query);

      listEl.innerHTML = '';

      if (defs.length === 0 && !pcSectionEl) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'shortcut-empty-state';
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
            ? '키 입력 대기 · ESC 취소'
            : this.formatShortcutKeyForDisplay(curKey);
          bindBtn.title = isRecording
            ? '새 단축키 입력 (ESC: 취소)'
            : '단축키 변경';
          bindBtn.onclick = (e) => {
            e.stopPropagation();
            if (this._recordingShortcutActionId === def.id) {
              this._recordingShortcutActionId = null;
              this.setShortcutModalBanner(
                '변경할 기능의 단축키를 클릭한 뒤 새 키를 입력해 주세요.',
                'normal'
              );
            } else {
              this._recordingShortcutActionId = def.id;
              this.setShortcutModalBanner(
                `<strong>${def.name}</strong>에 지정할 키를 입력해 주세요. (취소: ESC)`,
                'recording'
              );
            }
            this.renderShortcutSettingsModalList();
          };

          const clearBtn = document.createElement('button');
          clearBtn.type = 'button';
          clearBtn.className = 'shortcut-mini-icon-btn';
          clearBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
          clearBtn.title = '단축키 해제';
          clearBtn.disabled = isUnassigned;
          clearBtn.onclick = (e) => {
            e.stopPropagation();
            this.assignDraftShortcutKey(def.id, '');
          };

          const resetOneBtn = document.createElement('button');
          resetOneBtn.type = 'button';
          resetOneBtn.className = 'shortcut-mini-icon-btn is-reset-btn';
          resetOneBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
          resetOneBtn.title = `기본값 복원 (${defaultDisp})`;
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

      if (pcSectionEl) {
        listEl.appendChild(pcSectionEl);
      }
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
        const chevronSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="9 18 15 12 9 6"/></svg>';
        badgeSettings.innerHTML = customCount > 0
          ? `<span class="settings-shortcut-count-text">${customCount}개 변경</span>${chevronSvg}`
          : chevronSvg;
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

      if (typeof document !== 'undefined') {
        const penKeyRaw = String(eff.ink_tool_pen || '').trim();
        const dashKeyRaw = String(eff.ink_tool_dashed_pen || '').trim();
        const penKeyDisp = penKeyRaw ? this.formatShortcutKeyForDisplay(penKeyRaw) : '';
        const dashKeyDisp = dashKeyRaw ? this.formatShortcutKeyForDisplay(dashKeyRaw) : '';
        const penHintParts = [];
        if (penKeyDisp) penHintParts.push(penKeyDisp);
        penHintParts.push(dashKeyDisp ? `점선 ${dashKeyDisp} · 길게 누름` : '길게 눌러 점선');
        const penFullTitle = `펜 (${penHintParts.join(' / ')})`;
        ['btnInkPen', 'btnPillPen'].forEach(btnId => {
          const el = document.getElementById(btnId);
          if (el) el.title = penFullTitle;
        });
      }

      // 2-1. 그래프 창 · 문제 카드 헤더의 동적 스탬프 버튼(.btn-card-stamp) 툴팁 실시간 동기화
      if (typeof document !== 'undefined') {
        const graphTip = this.getStampButtonTooltipText(true);
        const probTip = this.getStampButtonTooltipText(false);
        const seenStampBtns = new Set();
        const applyStampBtnTip = (btnEl, widgetEl) => {
          if (!btnEl || seenStampBtns.has(btnEl)) return;
          seenStampBtns.add(btnEl);
          const isGraphWidget = Boolean(widgetEl && widgetEl.classList && widgetEl.classList.contains('graph-card-widget'));
          btnEl.title = isGraphWidget ? graphTip : probTip;
        };
        document.querySelectorAll('.problem-card-widget:not(.problem-stamp-ghost-fx) .btn-card-stamp').forEach(btnEl => {
          applyStampBtnTip(btnEl, btnEl.closest('.problem-card-widget'));
        });
        if (Array.isArray(this.extraProblemCards)) {
          this.extraProblemCards.forEach(c => {
            if (c && c.el) applyStampBtnTip(c.el.querySelector('.btn-card-stamp'), c.el);
          });
        }
        if (Array.isArray(this.extraGraphCards)) {
          this.extraGraphCards.forEach(c => {
            if (c && c.el) applyStampBtnTip(c.el.querySelector('.btn-card-stamp'), c.el);
          });
        }
      }

      // 2-2. [사용법 및 문의] 모달 내 인라인 단축키 배지 실시간 동기화
      if (typeof document !== 'undefined') {
        const inlineMap = [
          ['guideKbdCopyGraph', 'sys_copy_image', 'Ctrl + C'],
          ['guideKbdStampCard', 'card_stamp_active', 'S'],
          ['guideKbdHideUI', 'sys_toggle_hide_ui', 'H']
        ];
        inlineMap.forEach(([elId, actId, fallbackText]) => {
          const kbdEl = document.getElementById(elId);
          if (!kbdEl) return;
          const rawAssigned = String(eff[actId] || '').trim();
          kbdEl.textContent = rawAssigned ? this.formatShortcutKeyForDisplay(rawAssigned) : fallbackText;
        });
      }

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
      if (typeof this.isSaveInkClipModalOpen === 'function' && this.isSaveInkClipModalOpen()) return false;
      if (this.isNAxisStudioOpen || this.isMathToolkitOpen || this._activeToolkitModalId) return false;
      if (this.activeEditingTextId || this.activeEditingLabel) return false;
      if (typeof this._isViewerOrReplayBlockingEdit === 'function' && this._isViewerOrReplayBlockingEdit()) return false;
      const targetEl = e.target;
      if (targetEl) {
        const tag = targetEl.tagName ? targetEl.tagName.toUpperCase() : '';
        if (
          (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'color', 'file'].includes(String(targetEl.type || '').toLowerCase())) ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          targetEl.isContentEditable
        ) {
          return false;
        }
      }

      const pressedKey = this.normalizeShortcutEventToKey(e);
      if (!pressedKey) return false;

      // 0. [PC 설치 버전 전용]: 스크린 판서 시작 / 종료 단축키 (기본 F9)
      if (
        typeof window !== 'undefined' &&
        window.__GRAPHLY_DESKTOP__ &&
        window.__GRAPHLY_DESKTOP__.isDesktopApp &&
        this.pcScreenAnnotateHotkey &&
        pressedKey.toUpperCase() === String(this.pcScreenAnnotateHotkey).trim().toUpperCase()
      ) {
        e.preventDefault();
        if (!e.repeat) {
          this.toggleScreenAnnotateMode();
        }
        return true;
      }

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
        } else if (pressedKey.toUpperCase() === 'SHIFT+=' && String(eff.sys_zoom_in || '') === '=') {
          matchedActionId = 'sys_zoom_in';
        } else if (pressedKey.toUpperCase() === 'SHIFT+-' && String(eff.sys_zoom_out || '') === '-') {
          matchedActionId = 'sys_zoom_out';
        } else if (pressedKey.toUpperCase().startsWith('SHIFT+') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const strippedShiftKey = pressedKey.slice(6).toUpperCase();
          const shapeActionIds = ['ink_shape_line', 'ink_shape_arc', 'ink_shape_rect', 'ink_shape_circle', 'ink_shape_triangle'];
          for (let si = 0; si < shapeActionIds.length; si++) {
            const sid = shapeActionIds[si];
            if (String(eff[sid] || '').trim().toUpperCase() === strippedShiftKey) {
              matchedActionId = sid;
              break;
            }
          }
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
          if (e && e.repeat) return true;
          if (!this.isInkMode) this.toggleInkMode(true);
          this.setActiveInkTool('select');
          return true;
        }
        case 'ink_tool_pen': {
          if (e && e.repeat) return true;
          this.handlePenToolTrigger();
          return true;
        }
        case 'ink_tool_dashed_pen': {
          if (e && e.repeat) return true;
          this.handleDashedPenToolTrigger();
          return true;
        }
        case 'ink_shape_line': {
          if (e && e.repeat) return true;
          this.handleQuickShapeTrigger('line');
          return true;
        }
        case 'ink_shape_arc': {
          if (e && e.repeat) return true;
          this.handleQuickShapeTrigger('arc');
          return true;
        }
        case 'ink_shape_rect': {
          if (e && e.repeat) return true;
          this.handleQuickShapeTrigger('rect');
          return true;
        }
        case 'ink_shape_circle': {
          if (e && e.repeat) return true;
          this.handleQuickShapeTrigger('circle');
          return true;
        }
        case 'ink_shape_triangle': {
          if (e && e.repeat) return true;
          this.handleQuickShapeTrigger('triangle');
          return true;
        }
        case 'ink_tool_highlighter': {
          if (e && e.repeat) return true;
          if (!this.isInkMode) this.toggleInkMode(true);
          this.setActiveInkTool('highlighter');
          return true;
        }
        case 'ink_tool_eraser': {
          if (e && e.repeat) return true;
          if (!this.isInkMode) this.toggleInkMode(true);
          this.setActiveInkTool('eraser');
          return true;
        }
        case 'ink_tool_lasso': {
          if (e && e.repeat) return true;
          if (!this.isInkMode) this.toggleInkMode(true);
          this.setActiveInkTool('lasso');
          return true;
        }
        case 'ink_tool_laser': {
          if (e && e.repeat) return true;
          if (!this.isInkMode) this.toggleInkMode(true);
          this.setActiveInkTool('laser');
          return true;
        }
        case 'ink_tool_sticker': {
          if (e && e.repeat) return true;
          if (!this.isInkMode) this.toggleInkMode(true);
          this.setActiveInkTool('sticker');
          return true;
        }
        case 'ink_open_clips': {
          if (e && e.repeat) return true;
          if (
            this.isScreenAnnotateMode ||
            this.isPdfModalOpen ||
            (typeof this._isViewerOrReplayBlockingEdit === 'function' && this._isViewerOrReplayBlockingEdit())
          ) {
            return false;
          }
          if (typeof this.toggleInkClipsPopover === 'function') {
            this.toggleInkClipsPopover({ atCursor: true });
            return true;
          }
          return false;
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
          const hasLassoSel = (typeof this._hasActiveAnyLassoSelection === 'function') && this._hasActiveAnyLassoSelection();
          if (!hasLassoSel && this.activeInkTool !== 'pen' && this.activeInkTool !== 'highlighter') {
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
          if (this.isPdfModalOpen || (typeof this._isViewerOrReplayBlockingEdit === 'function' && this._isViewerOrReplayBlockingEdit())) return false;
          if (typeof this.handleRailPresetsTrigger === 'function') {
            this.handleRailPresetsTrigger();
            return true;
          }
          if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelPresets') {
            this.closeDrawer();
            return true;
          }
          if (this.isGraphCovered) {
            document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
            this._pipTargetCard = 'new';
            this._pipSessionOrigin = 'rail';
          }
          this.openDrawer('panelPresets');
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
        case 'card_stamp_active': {
          if (typeof this.stampTopmostActiveCardToBoard === 'function') {
            return Boolean(this.stampTopmostActiveCardToBoard(e));
          }
          return false;
        }
        case 'graph_open_toolkit': {
          if (this.isPdfModalOpen || (typeof this._isViewerOrReplayBlockingEdit === 'function' && this._isViewerOrReplayBlockingEdit())) return false;
          if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelToolkit') {
            this.closeDrawer();
          } else {
            this.openDrawer('panelToolkit');
          }
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
          if (this.isPdfModalOpen) {
            if (this._isPdfBatchCropMode || (Array.isArray(this._pdfBatchSessionRecords) && this._pdfBatchSessionRecords.length > 0)) {
              if (typeof this.handleBatchPdfCropButtonClick === 'function') {
                this.handleBatchPdfCropButtonClick();
              } else {
                this.togglePdfCropMode();
              }
            } else if (typeof this.handleSinglePdfCropButtonClick === 'function') {
              this.handleSinglePdfCropButtonClick();
            } else {
              this.togglePdfCropMode();
            }
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
          if (this.isInkMode && ((this.selectedInkStrokes && this.selectedInkStrokes.length > 0) || (this.selectedTextLabels && this.selectedTextLabels.length > 0))) {
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
          if (typeof this.copyActiveGraphToClipboard === 'function') {
            return Boolean(this.copyActiveGraphToClipboard(e));
          }
          return false;
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
        case 'sys_zoom_in':
        case 'sys_zoom_out': {
          if (typeof document !== 'undefined' && document.querySelector('.smart-modal-backdrop.show')) return false;
          if (e && e.repeat && this._lastZoomKeyRepeatAt && (performance.now() - this._lastZoomKeyRepeatAt) < 75) {
            return true;
          }
          this._lastZoomKeyRepeatAt = performance.now();
          const isZoomIn = (actionId === 'sys_zoom_in');
          if (this.isPdfModalOpen) {
            const btnPdf = document.getElementById(isZoomIn ? 'btnPdfZoomIn' : 'btnPdfZoomOut');
            if (btnPdf) {
              btnPdf.click();
              return true;
            }
            return false;
          }
          if (typeof this.zoomByStep === 'function') {
            this.zoomByStep(isZoomIn ? 0.12 : -0.12);
            return true;
          }
          return false;
        }
        case 'sys_fullscreen_toggle': {
          if (typeof document !== 'undefined' && document.body && document.body.classList.contains('ios-standalone-pwa')) {
            return false;
          }
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

    showToast(message, options = null) {
      // [대표님 기획]: 수업·화면공유 몰입감을 위해 일상 조작 토스트 및 녹화 시간 제한/자동종료 알림은 차단하고,
      // 파일 열기 실패·용량/쿼터 한도·권한 오류 등 무반응으로 오해될 수 있는 필수 경고 알림만 선별 표출합니다.
      const text = typeof message === 'string' ? message.trim() : '';
      if (!text) return;
      if (/녹화\s*제한\s*시간|녹화가\s*(?:안전하게\s*)?자동\s*완료/u.test(text)) {
        return;
      }
      const isExplicitImportant = Boolean(options && typeof options === 'object' && options.important);
      const isImportantAlert = isExplicitImportant ||
        /^(?:⚠️|❌|🛡️)/u.test(text) ||
        /^🔒\s*(?:암호|다른 기기|Pro 플랜|무료 버전|오늘 비로그인)/u.test(text) ||
        /^📄\s*마지막 페이지/u.test(text) ||
        /(?:티켓 발급|서버 업로드|서버 저장|파싱하는 데)에?\s*실패했습니다/u.test(text);
      if (!isImportantAlert) return;

      const el = document.getElementById('toastMsg');
      if (!el) return;
      if (this._toastHideTimer) {
        clearTimeout(this._toastHideTimer);
        this._toastHideTimer = null;
      }
      el.textContent = text;
      el.classList.add('show');
      const durationMs = (options && typeof options === 'object' && Number(options.durationMs) > 0)
        ? Number(options.durationMs)
        : 2600;
      this._toastHideTimer = setTimeout(() => {
        this._toastHideTimer = null;
        el.classList.remove('show');
      }, durationMs);
    }
  }.prototype);
  delete _desc.constructor;
  Object.defineProperties(GraphApp.prototype, _desc);
}

// 브라우저 로딩 후 초기화
window.addEventListener('DOMContentLoaded', () => {
  window.graphApp = new GraphApp();
});
