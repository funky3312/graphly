/**
 * Graph Master Web - PDF Textbook Viewer, 2-Column Problem Crop & PDF Board Mode Engine (app-pdf.js)
 */
{
  const _desc = Object.getOwnPropertyDescriptors(class {
    // ==========================================================================
    // [📑 닥줌(DocZoom)형 PDF 교재 연속 세로 뷰어 & 2단 문제 박스 크롭 엔진]
    // ==========================================================================
    initPdfEngine() {
      if (window.pdfjsLib) {
        if (!window.pdfjsWorker) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
        }
      }

      const btnImport = document.getElementById('btnPdfImport');
      const fileInput = document.getElementById('pdfFileInput');
      const btnQuick = document.getElementById('btnQuickPdfCrop');
      const btnOpenAnother = document.getElementById('btnPdfOpenAnother');
      const btnReturnToBoard = document.getElementById('btnReturnToBoard');

      const prewarmDefaultCursorOnButtonHover = () => {
        if (this.virtualStylusEl && !this.isAudioPlaying) {
          this.virtualStylusEl.style.display = 'none';
        }
        if (this.canvas) {
          this.canvas.classList.remove(
            'ink-cursor-pen',
            'ink-cursor-highlighter',
            'ink-cursor-eraser'
          );
          this.canvas.style.cursor = 'default';
        }
        this._needsInkCursorRefreshOnMove = true;
      };
      this._prewarmDefaultCursorOnButtonHover = prewarmDefaultCursorOnButtonHover;

      const restoreDefaultCursorForFilePicker = () => {
        if (this._uiPointerIds) this._uiPointerIds.clear();
        if (document.body) {
          document.body.classList.add('file-picker-open');
        }
        prewarmDefaultCursorOnButtonHover();
        // OS 파일 탐색기 창이 떠 있는 동안 뒤쪽 캔버스 애니메이션 루프 일시정지 (GPU/CPU 경합 방지)
        if (this.pulseAnimId) {
          cancelAnimationFrame(this.pulseAnimId);
          this.pulseAnimId = null;
        }
        if (this.intersectionAnimId) {
          cancelAnimationFrame(this.intersectionAnimId);
          this.intersectionAnimId = null;
        }
        if (this._mainLaserRafId) {
          cancelAnimationFrame(this._mainLaserRafId);
          this._mainLaserRafId = null;
        }
        if (document.body) {
          void document.body.offsetHeight;
        }
      };
      this._restoreDefaultCursorForFilePicker = restoreDefaultCursorForFilePicker;

      const finishWaitingForFilePicker = () => {
        this.isWaitingForFilePicker = false;
        if (this._uiPointerIds) this._uiPointerIds.clear();
        if (document.body) {
          document.body.classList.remove('file-picker-open');
        }
        // 파일창 닫힌 직후 마우스를 움직이기 전까지는 OS 기본 화살표 커서를 유지하고,
        // 캔버스 위로 마우스가 움직이는 즉시(pointermove) 가상 펜 커서로 자연스럽게 전환합니다.
        this._needsInkCursorRefreshOnMove = true;
        if (this.canvas) {
          this.canvas.classList.remove(
            'ink-cursor-pen',
            'ink-cursor-highlighter',
            'ink-cursor-eraser'
          );
          this.canvas.style.cursor = 'default';
        }
      };
      this._finishWaitingForFilePicker = finishWaitingForFilePicker;

      const triggerFileOpen = (preserveReplaceFlag = false) => {
        if (fileInput) {
          if (!preserveReplaceFlag) {
            this._isReplacingViaNextCrop = false;
          }
          // 🌟 [대표님 기획]: 파일 선택창 열리며 전체화면 풀리는 현상 방어 + Windows 파일 열기 창 cursor:none 상속 증발 원천 차단
          this.wasFullscreenBeforeFile = document.body.classList.contains('fullscreen-mode') || Boolean(document.fullscreenElement);
          this.isWaitingForFilePicker = true;
          this._filePickerOpenedAt = performance.now();
          restoreDefaultCursorForFilePicker();
          if (typeof this._syncGraphlyFileInputAcceptForDevice === 'function') {
            this._syncGraphlyFileInputAcceptForDevice(fileInput, '.pdf,.png,.jpg,.jpeg,.webp,.graphly');
          }
          fileInput.value = '';
          fileInput.click();
        }
      };
      this.triggerLocalFileExplorer = triggerFileOpen;

      if (btnImport) {
        btnImport.addEventListener('pointerenter', prewarmDefaultCursorOnButtonHover);
        btnImport.addEventListener('pointerdown', prewarmDefaultCursorOnButtonHover);
        btnImport.onclick = () => {
          if (this.lessonTeachingMode === 'crop' || this.lessonTeachingMode === 'page') {
            this._showLockedFileImportHint();
            return;
          }
          this._isReplacingViaNextCrop = false;
          triggerFileOpen();
        };
      }

      if (btnQuick) {
        btnQuick.onclick = () => {
          this._isReplacingViaNextCrop = false;
          if (this.pdfDoc) {
            this.openPdfModal();
          } else {
            this.loadSamplePdf();
          }
        };
      }

      const btnSample = document.getElementById('btnPdfOpenSample');
      if (btnSample) {
        btnSample.onclick = () => this.loadSamplePdf();
      }

      const btnDropSample = document.getElementById('btnDropOpenSample');
      if (btnDropSample) {
        btnDropSample.onclick = () => {
          const overlay = document.getElementById('pdfDropOverlay');
          if (overlay) overlay.style.display = 'none';
          this.loadSamplePdf();
        };
      }

      if (btnOpenAnother) {
        btnOpenAnother.addEventListener('pointerenter', prewarmDefaultCursorOnButtonHover);
        btnOpenAnother.addEventListener('pointerdown', prewarmDefaultCursorOnButtonHover);
        btnOpenAnother.onclick = (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          // [다음 캡처] 클릭으로 PDF 모달이 열리는 순간 같은 좌표에 위치한 [다른 파일 열기]가 고스트 클릭/더블탭으로 눌리는 현상 원천 차단!
          if (this._lastPdfModalOpenAt && (performance.now() - this._lastPdfModalOpenAt < 650)) {
            return;
          }
          triggerFileOpen(Boolean(this._isReplacingViaNextCrop));
        };
      }
      if (btnReturnToBoard) btnReturnToBoard.onclick = () => this.finishPdfBatchCropOrClose();

      if (fileInput) {
        fileInput.addEventListener('cancel', () => {
          finishWaitingForFilePicker();
        });
        fileInput.onchange = async (e) => {
          finishWaitingForFilePicker();
          const rawFiles = e.target.files ? Array.from(e.target.files) : [];
          if (rawFiles.length === 0) {
            return;
          }
          const modalCloud = document.getElementById('modalCloudHub');
          if (modalCloud) modalCloud.classList.remove('show');

          // 🌟 [대표님 기획]: 파일 선택 완료 즉시 전체화면 100% 복귀
          if (this.wasFullscreenBeforeFile) {
            try {
              const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
              if (!fsEl && document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => { return document.documentElement.requestFullscreen(); });
              }
            } catch (err) { }
            this.syncFullscreenButtonUI(true);
          }

          const imageFiles = rawFiles.filter(f => (f.type && f.type.startsWith('image/')) || (f.name && /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)));
          // 1) 이미지 파일(1개 또는 N개 선택) 불러오기 -> 슬라이드당 1문제씩 펼쳐진 상태(▾)로 즉시 배치!
          if (imageFiles.length >= 1) {
            await this.loadImagesOnePerSlide(imageFiles);
            return;
          }

          // 2.5) .graphly 전용 수업 파일 불러오기
          const graphlyFile = rawFiles.find(f => f && (typeof this._isGraphlyFileName === 'function'
            ? this._isGraphlyFileName(f.name)
            : (f.name && /\.graphly$/i.test(f.name.trim()))));
          if (graphlyFile) {
            if (this.isPdfModalOpen && typeof this.closePdfModal === 'function') {
              this.closePdfModal();
            }
            await this.importGraphlyDeckFile(graphlyFile);
            return;
          }

          // 3) PDF 파일 불러오기
          const pdfFile = rawFiles.find(f => f.type === 'application/pdf' || (f.name && f.name.toLowerCase().endsWith('.pdf')));
          if (pdfFile) {
            if (this._pendingImportLessonMode) {
              this.setLessonTeachingMode(this._pendingImportLessonMode);
              this._pendingImportLessonMode = null;
            }
            this.loadPdfFromFile(pdfFile);
            return;
          }

          this.showToast('⚠️ PDF, 이미지 또는 Graphly 파일(.graphly)만 열 수 있습니다.');
        };
      }

      // 파일 선택창 취소 시에도 상태 보호 및 커서 복원
      window.addEventListener('focus', () => {
        if (this._uiPointerIds) this._uiPointerIds.clear();
        if (this.isWaitingForFilePicker && (performance.now() - (this._filePickerOpenedAt || 0) > 250)) {
          setTimeout(() => {
            finishWaitingForFilePicker();
            if (this.wasFullscreenBeforeFile && !document.fullscreenElement) {
              this.syncFullscreenButtonUI(true);
            }
          }, 120);
        }
      });

      // 모달 닫기 (연속 캡처로 추가된 슬라이드가 있으면 첫 추가 슬라이드로 복귀, 없으면 기존과 동일하게 닫기)
      const btnClose = document.getElementById('btnClosePdfModal');
      if (btnClose) {
        btnClose.onclick = () => {
          this.finishPdfBatchCropOrClose();
        };
      }

      // ✂️ 영역 캡처 온/오프 토글 스위치 (단건 즉시 이동 모드)
      const btnCropToggle = document.getElementById('btnPdfCropToggle');
      if (btnCropToggle) {
        btnCropToggle.onclick = () => this.handleSinglePdfCropButtonClick();
      }

      // 📑 연속 영역 캡처 컨트롤 (연속 캡처 토글 · 직전 취소 · 캔버스로 이동)
      const btnBatchCropToggle = document.getElementById('btnPdfBatchCropToggle');
      if (btnBatchCropToggle) {
        btnBatchCropToggle.onclick = () => this.handleBatchPdfCropButtonClick();
      }
      const btnBatchUndo = document.getElementById('btnPdfBatchUndo');
      if (btnBatchUndo) {
        btnBatchUndo.onclick = () => this.undoLastPdfBatchCrop();
      }
      const btnBatchGoBoard = document.getElementById('btnPdfBatchGoBoard');
      if (btnBatchGoBoard) {
        btnBatchGoBoard.onclick = () => this.finishPdfBatchCropOrClose();
      }

      // 📄 페이지 삽입 그룹 (빈칸: 현재 페이지 삽입 ⇄ 입력 시: N페이지 일괄 삽입)
      const inputRangeSpec = document.getElementById('inputPdfPageRangeSpec');
      if (inputRangeSpec) {
        inputRangeSpec.addEventListener('input', () => {
          this.syncPdfPageRangeInsertUI();
        });
        inputRangeSpec.addEventListener('focus', () => {
          if (this.isPdfCropModeActive) {
            this.togglePdfCropMode(false);
          }
          this.syncPdfPageRangeInsertUI();
        });
        inputRangeSpec.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            if (inputRangeSpec.value.trim()) {
              e.preventDefault();
              e.stopPropagation();
              inputRangeSpec.value = '';
              this.syncPdfPageRangeInsertUI();
              return;
            }
            return;
          }
          e.stopPropagation();
          if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            this.handlePdfInsertPagesAction();
          }
        });
      }

      const btnOpenFullPage = document.getElementById('btnPdfOpenFullPage');
      if (btnOpenFullPage) {
        btnOpenFullPage.onclick = () => {
          this.handlePdfInsertPagesAction();
        };
      }

      // 📄 PDF 페이지 통째 칠판 모드 상단 미니 네비게이션 바
      const btnBoardPrev = document.getElementById('btnPdfBoardPrev');
      const btnBoardNext = document.getElementById('btnPdfBoardNext');
      const btnBoardInfo = document.getElementById('btnPdfBoardPageInfo');
      const btnBoardOpenModal = document.getElementById('btnPdfBoardOpenModal');
      const btnBoardDelCur = document.getElementById('btnPdfBoardDeleteCurrent');
      const btnBoardClose = document.getElementById('btnPdfBoardClose');
      const btnBoardClearAll = document.getElementById('btnPdfBoardClearAll');
      const btnBoardHideBar = document.getElementById('btnPdfBoardHideBar');
      this.bindRepeatableStepButton(btnBoardPrev, () => this.navigatePdfBoardPage(-1), { minIntervalMs: 105 });
      this.bindRepeatableStepButton(btnBoardNext, () => this.navigatePdfBoardPage(1), { minIntervalMs: 105 });
      if (btnBoardInfo) {
        btnBoardInfo.onclick = (e) => {
          e.stopPropagation();
          this.toggleSlideGridPopover();
        };
      }
      if (btnBoardOpenModal) btnBoardOpenModal.onclick = () => this.openPdfModal();
      if (btnBoardDelCur) {
        btnBoardDelCur.onclick = (e) => {
          e.stopPropagation();
          const curP = (this.pdfPageBoardData && this.pdfPageBoardData.pageNum) || 1;
          this.deletePdfPageSlide(curP);
        };
      }
      if (btnBoardClose) btnBoardClose.onclick = () => this.closePdfPageBoard();
      if (btnBoardClearAll) btnBoardClearAll.onclick = () => this.clearAllSlidesAndReset();
      if (btnBoardHideBar) btnBoardHideBar.onclick = () => this.toggleTopSlideBarHidden(true);

      // 페이지 네비게이션
      const btnPrev = document.getElementById('btnPdfPrevPage');
      const btnNext = document.getElementById('btnPdfNextPage');
      const inputPage = document.getElementById('inputPdfCurrentPage');

      this.bindRepeatableStepButton(btnPrev, () => this.scrollToPdfPage(this.pdfCurrentPage - 1), { minIntervalMs: 105 });
      this.bindRepeatableStepButton(btnNext, () => this.scrollToPdfPage(this.pdfCurrentPage + 1), { minIntervalMs: 105 });
      if (inputPage) {
        inputPage.onchange = () => {
          const p = parseInt(inputPage.value, 10);
          if (!isNaN(p)) this.scrollToPdfPage(p);
        };
        inputPage.onkeydown = (e) => {
          if (e.key === 'Enter') {
            const p = parseInt(inputPage.value, 10);
            if (!isNaN(p)) this.scrollToPdfPage(p);
          }
        };
      }

      // 줌 컨트롤
      const btnZoomIn = document.getElementById('btnPdfZoomIn');
      const btnZoomOut = document.getElementById('btnPdfZoomOut');
      const btnZoomFit = document.getElementById('btnPdfZoomFit');

      this.bindRepeatableStepButton(btnZoomIn, () => this.setPdfZoom(this.pdfZoom + 0.15), { minIntervalMs: 85 });
      this.bindRepeatableStepButton(btnZoomOut, () => this.setPdfZoom(Math.max(0.6, this.pdfZoom - 0.15)), { minIntervalMs: 85 });
      if (btnZoomFit) btnZoomFit.onclick = () => this.fitPdfWidth();

      // 뷰포트 스크롤 감지: 현재 화면 중앙에 있는 페이지 번호 실시간 계산 (passive: true로 브라우저 C++ 컴포지터 스레드 100% 직결)
      const viewport = document.getElementById('pdfViewport');
      if (viewport) {
        viewport.addEventListener('scroll', () => {
          this.onPdfViewportScroll();
        }, { passive: true });
      }

      // PDF 파일 드래그 앤 드롭
      const dropOverlay = document.getElementById('pdfDropOverlay');
      let dragCounter = 0;
      this._resetPdfDropOverlayState = () => {
        dragCounter = 0;
        if (dropOverlay) dropOverlay.style.display = 'none';
      };

      window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (typeof this._isViewerOrReplayBlockingEdit === 'function' && this._isViewerOrReplayBlockingEdit()) return;
        const modalCloud = document.getElementById('modalCloudHub');
        if (modalCloud && modalCloud.classList.contains('show')) return;
        dragCounter++;
        if (dropOverlay) dropOverlay.style.display = 'flex';
      });

      window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0 && dropOverlay) {
          dropOverlay.style.display = 'none';
          dragCounter = 0;
        }
      });

      window.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        if (dropOverlay) dropOverlay.style.display = 'none';
        if (typeof this._isViewerOrReplayBlockingEdit === 'function' && this._isViewerOrReplayBlockingEdit()) return;
        const modalCloud = document.getElementById('modalCloudHub');
        if (modalCloud && modalCloud.classList.contains('show')) return;
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const droppedArr = Array.from(e.dataTransfer.files);
          const file = droppedArr[0];
          if ((file.name && file.name.toLowerCase().endsWith('.pdf')) || file.type === 'application/pdf') {
            this.loadPdfFromFile(file);
            return;
          }
          const hasPdf = droppedArr.some(f => f && (f.type === 'application/pdf' || (f.name && f.name.toLowerCase().endsWith('.pdf'))));
          const hasImage = droppedArr.some(f => f && ((f.type && f.type.startsWith('image/')) || (f.name && /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name))));
          if (!hasPdf && !hasImage) {
            this.showToast('⚠️ PDF, 이미지 또는 Graphly 파일(.graphly)만 열 수 있습니다.');
          }
        }
      });

      // 크롭 드래그 인터랙션 & 문제 카드 초기화
      this.initPdfCropInteractions();
      this.initProblemCardInteractions();
      this.initGraphCardInteractions();
      this._preloadLastPdfFromIndexedDBOnBoot();
    }

    loadSamplePdf() {
      this.showToast('⏳ 2025 수능 수학 샘플 시험지를 여는 중입니다...');
      try {
        const b64 = 'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgL0YyIDYgMCBSID4+ID4+ID4+CmVuZG9iago0IDAgb2JqCjw8IC9MZW5ndGggMjA4OCA+PgpzdHJlYW0KCnEKMC45IDAuOSAwLjkgcmcKMC41IHcKMzAgODA1IDUzNSAwLjUgcmUgZgozMCAzNSA1MzUgMC41IHJlIGYKUQoKQlQKL0YxIDE1IFRmCjAuMSAwLjEgMC4xIHJnCjMwIDgxNSBUZAooMjAyNSBDb2xsZWdlIFNjaG9sYXN0aWMgQWJpbGl0eSBUZXN0IC0gTWF0aGVtYXRpY3MgKE1vY2sgRXhhbSkpIFRqCkVUCgpCVAovRjEgMTAgVGYKMC4zIDAuMyAwLjMgcmcKNTEwIDgxNSBUZAooUGFnZSAxIC8gMSkgVGoKRVQKCnEKMC44IDAuOCAwLjggcmcKMC41IHcKMjk3IDUwIDAuNSA3MzAgcmUgZgpRCgolIExlZnQgQ29sdW1uOiBQcm9ibGVtIDE0CkJUCi9GMiAxMyBUZgowIDAgMCByZwozNSA3NzAgVGQKKFtQcm9ibGVtIDE0XSBDdWJpYyBGdW5jdGlvbiAmIFJhdGlvIEd1aWRlKSBUagpFVAoKQlQKL0YxIDEwLjUgVGYKMC4xNSAwLjE1IDAuMTUgcmcKMzUgNzQ1IFRkCihMZXQgZih4KSA9IHheMyAtIDN4IGJlIGEgY3ViaWMgZnVuY3Rpb24uKSBUagpFVAoKQlQKL0YxIDEwLjUgVGYKMzUgNzI1IFRkCihGaW5kIHRoZSBsb2NhbCBtYXhpbXVtLCBsb2NhbCBtaW5pbXVtLCBhbmQgaW5mbGVjdGlvbiBwb2ludHMuKSBUagpFVAoKQlQKL0YxIDEwLjUgVGYKMzUgNzA1IFRkCihEZXRlcm1pbmUgdGhlIG51bWJlciBvZiByZWFsIHJvb3RzIG9mIGVxdWF0aW9uIGYoeCkgPSB0LikgVGoKRVQKCkJUCi9GMSAxMCBUZgowLjI1IDAuMjUgMC4yNSByZwozNSA2NzAgVGQKKCgxKSBMb2NhbCBtYXhpbXVtIGF0IHggPSAtMSwgeSA9IDIpIFRqCkVUCgpCVAovRjEgMTAgVGYKMzUgNjUwIFRkCigoMikgTG9jYWwgbWluaW11bSBhdCB4ID0gMSwgeSA9IC0yKSBUagpFVAoKQlQKL0YxIDEwIFRmCjM1IDYzMCBUZAooKDMpIFN5bW1ldHJ5IGNlbnRlciAoaW5mbGVjdGlvbikgYXQgKDAsIDApKSBUagpFVAoKQlQKL0YxIDEwIFRmCjM1IDYxMCBUZAooKDQpIDI6MSBhbmQgMTpzcXJ0KDMpIHJhdGlvIHByb3BlcnRpZXMgaG9sZCBzdHJpY3RseS4pIFRqCkVUCgolIFJpZ2h0IENvbHVtbjogUHJvYmxlbSAyMiAoS2lsbGVyKQpCVAovRjIgMTMgVGYKMCAwIDAgcmcKMzE1IDc3MCBUZAooW1Byb2JsZW0gMjJdIFF1YXJ0aWMgRnVuY3Rpb24gJiBTeW1tZXRyeSkgVGoKRVQKCkJUCi9GMSAxMC41IFRmCjAuMTUgMC4xNSAwLjE1IHJnCjMxNSA3NDUgVGQKKExldCBnKHgpID0geF40IC0gMnheMiBiZSBhIHN5bW1ldHJpYyBXLXNoYXBlIHF1YXJ0aWMuKSBUagpFVAoKQlQKL0YxIDEwLjUgVGYKMzE1IDcyNSBUZAooRGV0ZXJtaW5lIHRoZSB2YWx1ZXMgb2YgdCBmb3Igd2hpY2ggfGcoeCkgLSB0fCBpcykgVGoKRVQKCkJUCi9GMSAxMC41IFRmCjMxNSA3MDUgVGQKKGRpZmZlcmVudGlhYmxlIGZvciBhbGwgcmVhbCBudW1iZXJzIGV4Y2VwdCBhdCBleGFjdGx5IDIgcG9pbnRzLikgVGoKRVQKCkJUCi9GMSAxMCBUZgowLjI1IDAuMjUgMC4yNSByZwozMTUgNjcwIFRkCigoQSkgSGVpZ2h0IGRpZmZlcmVuY2U6IERlbHRhIHkgPSBhICogcF40KSBUagpFVAoKQlQKL0YxIDEwIFRmCjMxNSA2NTAgVGQKKChCKSAxOnNxcnQoMikgcmF0aW8gZ3VpZGUgYmV0d2VlbiBleHRyZW1hIGFuZCByb290cy4pIFRqCkVUCgpCVAovRjEgMTAgVGYKMzE1IDYzMCBUZAooKEMpIEhvcml6b250YWwgdGFuZ2VudCBzbmFwIGFuZCAzRCBoYW5kbGUgY29udHJvbHMuKSBUagpFVAoKJSBEZWNvcmF0aXZlIEJveCBmb3IgUHJvYmxlbSAxNApxCjAuOTYgMC45NyAwLjk5IHJnCjAuNSAwLjYgMC44IFJHCjEgdwozNSA0ODAgMjM1IDEwMCByZSBCClEKCkJUCi9GMiAxMSBUZgowLjEgMC4zIDAuNiByZwo0NSA1NjAgVGQKKFtIaW50IENhcmQ6IEdyYXBoIE1hc3RlciBDcm9wXSkgVGoKRVQKCkJUCi9GMSA5LjUgVGYKMC4yIDAuMiAwLjIgcmcKNDUgNTM1IFRkCihEcmFnIGEgYm94IGFyb3VuZCB0aGlzIHByb2JsZW0gY2FyZCB0byBjcm9wISkgVGoKRVQKCkJUCi9GMSA5LjUgVGYKNDUgNTE1IFRkCihJdCB3aWxsIGltbWVkaWF0ZWx5IHBpbiB0byB0aGUgdG9wLWxlZnQgYmxhY2tib2FyZC4pIFRqCkVUCgpCVAovRjEgOS41IFRmCjQ1IDQ5NSBUZAooMS1zZWNvbmQgY3JvcCAmIGluZmluaXRlIGJsYWNrYm9hcmQgcGVuIHRlYWNoaW5nISkgVGoKRVQKCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCjYgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhLUJvbGQgPj4KZW5kb2JqCnhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI1MSAwMDAwMCBuIAowMDAwMDAyMzkxIDAwMDAwIG4gCjAwMDAwMDI0NjEgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA3IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgoyNTM2CiUlRU9GCg==';
        const binaryStr = atob(b64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return this.loadPdfFromArrayBuffer(bytes.buffer, '2025_수능_수학_모의고사.pdf');
      } catch (err) {
        console.error('샘플 PDF 파싱 실패:', err);
        const fileInput = document.getElementById('pdfFileInput');
        if (fileInput) fileInput.click();
        return Promise.reject(err);
      }
    }

    loadPdfFromFile(file) {
      if (!file) return;
      this.pdfFileName = file.name;
      const titleEl = document.getElementById('pdfFileName');
      if (titleEl) { titleEl.textContent = file.name; titleEl.title = file.name; }

      const reader = new FileReader();
      reader.onload = () => {
        this.loadPdfFromArrayBuffer(reader.result, file.name);
      };
      reader.readAsArrayBuffer(file);
    }

    _savePdfViewStateMeta() {
      try {
        const meta = {
          fileName: this.pdfFileName || '교재.pdf',
          currentPage: this.pdfCurrentPage || 1,
          scrollTop: typeof this.savedPdfScrollTop === 'number' ? this.savedPdfScrollTop : 0,
          scrollLeft: typeof this.savedPdfScrollLeft === 'number' ? this.savedPdfScrollLeft : 0,
          zoom: typeof this.pdfZoom === 'number' ? this.pdfZoom : 1.75,
          savedAt: Date.now()
        };
        localStorage.setItem('graphly_last_pdf_view_state_v1', JSON.stringify(meta));
      } catch (err) { }
    }

    _loadPdfViewStateMeta() {
      try {
        const raw = localStorage.getItem('graphly_last_pdf_view_state_v1');
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        return null;
      }
    }

    async _preloadLastPdfFromIndexedDBOnBoot() {
      try {
        if (typeof this._isSharedUrlViewActive === 'function' && this._isSharedUrlViewActive()) {
          return;
        }
        // 🛡️ [아이패드 Safari 부팅 메모리 보호]: 새로고침/초기 부팅 시에는 가벼운 뷰 메타데이터만 복원하고,
        // 수십~수백 MB 원본 PDF 바이트는 실제 이어 열기(resumeOrOpenCurrentPdf / appendNextPdfPageSlide) 시점에 온디맨드로 로드합니다.
        const meta = this._loadPdfViewStateMeta();
        if (meta) {
          if (meta.fileName && !this.pdfFileName) this.pdfFileName = meta.fileName;
          if (typeof meta.currentPage === 'number' && meta.currentPage >= 1) this.pdfCurrentPage = meta.currentPage;
          if (typeof meta.scrollTop === 'number') this.savedPdfScrollTop = meta.scrollTop;
          if (typeof meta.scrollLeft === 'number') this.savedPdfScrollLeft = meta.scrollLeft;
          if (typeof meta.zoom === 'number' && meta.zoom >= 0.5) this.pdfZoom = Math.min(5.0, meta.zoom);
        }
      } catch (err) { }
    }

    _saveLastPdfToIndexedDB(uint8Bytes, fileName) {
      this._savePdfViewStateMeta();
      const p = new Promise((resolve) => {
        try {
          if (!window.indexedDB || !uint8Bytes) return resolve(false);
          const req = window.indexedDB.open('graphly_pdf_cache_db', 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('last_pdf')) {
              db.createObjectStore('last_pdf');
            }
          };
          req.onsuccess = (e) => {
            try {
              const db = e.target.result;
              const tx = db.transaction('last_pdf', 'readwrite');
              tx.objectStore('last_pdf').put({
                bytes: uint8Bytes,
                fileName: fileName || '교재.pdf',
                currentPage: this.pdfCurrentPage || 1,
                scrollTop: this.savedPdfScrollTop || 0,
                scrollLeft: this.savedPdfScrollLeft || 0,
                zoom: this.pdfZoom || 1.75,
                savedAt: Date.now()
              }, 'current');
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => resolve(false);
            } catch (err) {
              resolve(false);
            }
          };
          req.onerror = () => resolve(false);
        } catch (err) {
          resolve(false);
        }
      });
      this._lastPdfIdbSavePromise = p;
      return p;
    }

    _loadLastPdfFromIndexedDB() {
      return new Promise((resolve) => {
        try {
          if (!window.indexedDB) return resolve(null);
          const req = window.indexedDB.open('graphly_pdf_cache_db', 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('last_pdf')) {
              db.createObjectStore('last_pdf');
            }
          };
          req.onsuccess = (e) => {
            try {
              const db = e.target.result;
              const tx = db.transaction('last_pdf', 'readonly');
              const getReq = tx.objectStore('last_pdf').get('current');
              getReq.onsuccess = () => resolve(getReq.result || null);
              getReq.onerror = () => resolve(null);
            } catch (err) {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      });
    }

    async resumeOrOpenCurrentPdf(isNextCaptureSlide = false, options = null) {
      if (isNextCaptureSlide && typeof this.canAddMoreSlidesWithQuota === 'function' && !this.canAddMoreSlidesWithQuota(1)) {
        this._isReplacingViaNextCrop = false;
        return false;
      }
      this._isReplacingViaNextCrop = Boolean(isNextCaptureSlide);
      // 🌟 [대표님 핵심 지침]: 어디서든 PDF를 열면 먼저 캡처할 문제 위치로 화면을 이동시켜야 하므로 무조건 [✋ 이동] 모드가 기본 우선!
      const autoCrop = Boolean(options && options.startInCropMode);
      if (this.pdfDoc) {
        this._isReplacingViaNextCrop = Boolean(isNextCaptureSlide);
        this.openPdfModal(false, autoCrop);
        return true;
      }
      if (this._lastPdfIdbSavePromise) {
        try { await this._lastPdfIdbSavePromise; } catch (e) { }
      }
      const meta = this._loadPdfViewStateMeta();
      if (meta) {
        if (typeof meta.currentPage === 'number' && meta.currentPage >= 1) this.pdfCurrentPage = meta.currentPage;
        if (typeof meta.scrollTop === 'number') this.savedPdfScrollTop = meta.scrollTop;
        if (typeof meta.scrollLeft === 'number') this.savedPdfScrollLeft = meta.scrollLeft;
        if (typeof meta.zoom === 'number' && meta.zoom >= 0.5) this.pdfZoom = Math.min(5.0, meta.zoom);
      } else if (this.problemCardData && typeof this.problemCardData.pageNum === 'number' && this.problemCardData.pageNum >= 1) {
        this.pdfCurrentPage = this.problemCardData.pageNum;
      }
      if (this._cachedPdfBytes && this._cachedPdfBytes.byteLength > 0) {
        this._isReplacingViaNextCrop = Boolean(isNextCaptureSlide);
        await this.loadPdfFromArrayBuffer(this._cachedPdfBytes, this.pdfFileName || (meta && meta.fileName) || '문서.pdf', { preserveScroll: true, skipIdbSave: true });
        this._isReplacingViaNextCrop = Boolean(isNextCaptureSlide);
        this.togglePdfCropMode(autoCrop);
        return true;
      }
      const cachedRec = await this._loadLastPdfFromIndexedDB();
      if (cachedRec && cachedRec.bytes) {
        const rawBytes = cachedRec.bytes;
        const normBytes = rawBytes instanceof Uint8Array
          ? rawBytes
          : (rawBytes instanceof ArrayBuffer ? new Uint8Array(rawBytes) : (rawBytes && rawBytes.buffer ? new Uint8Array(rawBytes.buffer) : null));
        if (normBytes && normBytes.byteLength > 0) {
          if (!meta) {
            if (typeof cachedRec.currentPage === 'number' && cachedRec.currentPage >= 1) this.pdfCurrentPage = cachedRec.currentPage;
            if (typeof cachedRec.scrollTop === 'number') this.savedPdfScrollTop = cachedRec.scrollTop;
            if (typeof cachedRec.scrollLeft === 'number') this.savedPdfScrollLeft = cachedRec.scrollLeft;
            if (typeof cachedRec.zoom === 'number' && cachedRec.zoom >= 0.5) this.pdfZoom = Math.min(5.0, cachedRec.zoom);
          }
          this._isReplacingViaNextCrop = Boolean(isNextCaptureSlide);
          await this.loadPdfFromArrayBuffer(normBytes, cachedRec.fileName || '문서.pdf', { preserveScroll: true, skipIdbSave: true });
          this._isReplacingViaNextCrop = Boolean(isNextCaptureSlide);
          this.togglePdfCropMode(autoCrop);
          return true;
        }
      }
      if (this.triggerLocalFileExplorer) {
        this._isReplacingViaNextCrop = Boolean(isNextCaptureSlide);
        this.triggerLocalFileExplorer(Boolean(isNextCaptureSlide));
      }
      return false;
    }

    loadPdfFromArrayBuffer(arrayBuffer, fileName = '문서.pdf', options = null) {
      if (!window.pdfjsLib) {
        this.showToast('⚠️ PDF.js 라이브러리를 불러오지 못했습니다.');
        return Promise.reject(new Error('PDF.js not loaded'));
      }

      // PDF.js Worker가 ArrayBuffer를 transfer(detach)해도 원본이 손실되지 않도록 안전 복제본 보관
      const srcView = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
      const clonedBytes = srcView.slice();
      this._cachedPdfBytes = clonedBytes;
      this.pdfFileName = fileName;
      const preserveScroll = Boolean(options && options.preserveScroll);
      if (!preserveScroll) {
        this.pdfCurrentPage = 1;
        this.savedPdfScrollTop = 0;
        this.savedPdfScrollLeft = 0;
      }
      if (!(options && options.skipIdbSave)) {
        this._pendingPdfIdbSavePayload = { bytes: clonedBytes, fileName };
        if (this._deferredIdbSaveTimer) clearTimeout(this._deferredIdbSaveTimer);
        this._deferredIdbSaveTimer = setTimeout(() => {
          this._deferredIdbSaveTimer = null;
          this._flushPendingPdfIdbSaveIfIdle(false);
        }, 8000);
      } else {
        this._pendingPdfIdbSavePayload = null;
      }

      this.showToast('⏳ PDF 문서를 불러오는 중입니다...');
      const { cMapUrl, standardFontDataUrl } = this._getPdfJsFontResourceUrls();
      const loadingTask = window.pdfjsLib.getDocument({
        data: clonedBytes.slice(),
        cMapUrl,
        cMapPacked: true,
        standardFontDataUrl
      });

      return loadingTask.promise.then(async pdf => {
        if (pdf && !pdf._graphlyDocUid) {
          pdf._graphlyDocUid = `pdfdoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }
        if (pdf && pdf._graphlyDocUid) {
          this._registerPdfBytesForDocUid(pdf._graphlyDocUid, clonedBytes, pdf);
        }
        this._invalidatePdfBoardHiResTile(true);
        this.pdfDoc = pdf;
        this.pdfTotalPages = pdf.numPages;
        if (!preserveScroll) {
          this.pdfCurrentPage = 1;
          this.savedPdfScrollTop = 0;
          this.savedPdfScrollLeft = 0;
        } else {
          this.pdfCurrentPage = Math.max(1, Math.min(pdf.numPages, this.pdfCurrentPage || 1));
        }

        const totalEl = document.getElementById('lblPdfTotalPages');
        if (totalEl) totalEl.textContent = pdf.numPages;
        this.syncPdfPageRangeInsertUI();

        const titleEl = document.getElementById('pdfFileName');
        if (titleEl) { titleEl.textContent = fileName; titleEl.title = fileName; }

        // 처음 열 때도 무조건 [✋ 이동] 모드로 먼저 열려 원하는 문제 위치로 자유롭게 이동한 뒤 [✂️ 영역 캡처]를 누를 수 있도록 통일!
        this.openPdfModal(true, false);
        try {
          const firstPage = await pdf.getPage(1);
          const unscaledVp = firstPage.getViewport({ scale: 1.0 });
          this.pdfDefaultPageSize = { width: unscaledVp.width || 595, height: unscaledVp.height || 842 };
          if (!preserveScroll || typeof this.pdfZoom !== 'number' || this.pdfZoom < 0.5) {
            const viewportEl = document.getElementById('pdfViewport');
            const availW = (viewportEl && viewportEl.clientWidth > 200) ? (viewportEl.clientWidth - 64) : (window.innerWidth * 0.90);
            const autoZoom = Math.max(1.5, Math.min(2.4, (availW * 0.86) / (unscaledVp.width || 600)));
            this.pdfZoom = Math.round(autoZoom * 20) / 20;
          }
        } catch (e) {
          this.pdfDefaultPageSize = { width: 595, height: 842 };
          if (!preserveScroll || typeof this.pdfZoom !== 'number') this.pdfZoom = 1.75;
        }
        const lbl = document.getElementById('lblPdfZoom');
        if (lbl) lbl.textContent = `${Math.round(this.pdfZoom * 100)}%`;

        this.renderAllPdfPages(true);
        if (preserveScroll) {
          const viewport = document.getElementById('pdfViewport');
          if (viewport) {
            if (typeof this.savedPdfScrollTop === 'number' && this.savedPdfScrollTop > 0) {
              const targetTop = this.savedPdfScrollTop;
              const targetLeft = typeof this.savedPdfScrollLeft === 'number' ? this.savedPdfScrollLeft : 0;
              viewport.scrollTop = targetTop;
              viewport.scrollLeft = targetLeft;
              requestAnimationFrame(() => {
                viewport.scrollTop = targetTop;
                viewport.scrollLeft = targetLeft;
              });
            } else if (this.pdfCurrentPage > 1) {
              this.scrollToPdfPage(this.pdfCurrentPage);
            }
          }
        }
        this._savePdfViewStateMeta();
        this.syncPdfModalModeUI();
        this.syncLessonPlaylistNavBarUI();
        if (this.lessonTeachingMode === 'page') {
          this.showToast(`📄 ${fileName} (총 ${pdf.numPages}페이지) 로드 완료! 시작할 페이지에서 [📄 전체 페이지 캡처]를 눌러주세요.`);
        } else if (this.lessonTeachingMode === 'crop') {
          this.showToast(`📑 ${fileName} (총 ${pdf.numPages}페이지) 로드 완료! 화면을 이동한 뒤 [✂️ 영역 캡처]를 눌러주세요.`);
        } else {
          this.showToast(`📑 ${fileName} (총 ${pdf.numPages}페이지) 로드 완료! 상단에서 [✂️ 영역 캡처] 또는 [📄 전체 페이지 캡처]를 선택해 수업을 시작하세요.`);
        }
        return pdf;
      }).catch(err => {
        console.error('PDF 로드 실패:', err);
        const errMsg = String((err && err.message) || '');
        if ((err && err.name === 'PasswordException') || /password/i.test(errMsg)) {
          this.showToast('🔒 암호가 설정된 PDF 파일은 지원하지 않습니다. 암호를 해제한 뒤 열어주세요.');
        } else {
          this.showToast('❌ PDF 파일을 파싱하는 데 실패했습니다: ' + errMsg);
        }
        throw err;
      });
    }

    _getPdfJsFontResourceUrls() {
      const isFileProtocol = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
      const pdfLibScriptEl = (!isFileProtocol && typeof document !== 'undefined')
        ? document.querySelector('script[src*="lib/pdf.min.js"]')
        : null;
      const pdfLibBaseHref = (pdfLibScriptEl && pdfLibScriptEl.src)
        ? pdfLibScriptEl.src
        : ((typeof window !== 'undefined' && window.location) ? new URL('lib/', window.location.href).href : 'lib/');
      const cMapUrl = isFileProtocol
        ? 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/'
        : new URL('cmaps/', pdfLibBaseHref).href;
      const standardFontDataUrl = isFileProtocol
        ? 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
        : new URL('standard_fonts/', pdfLibBaseHref).href;
      if (!isFileProtocol && typeof window !== 'undefined' && window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        try {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.js', pdfLibBaseHref).href;
        } catch (_) { }
      }
      return { isFileProtocol, pdfLibBaseHref, cMapUrl, standardFontDataUrl };
    }

    _uint8ArrayToBase64Fast(bytes) {
      if (!bytes || !bytes.length) return '';
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const CHUNK = 0x8000;
      const parts = [];
      for (let i = 0; i < u8.length; i += CHUNK) {
        parts.push(String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK)));
      }
      return btoa(parts.join(''));
    }

    _base64ToUint8ArrayFast(b64) {
      if (!b64 || typeof b64 !== 'string') return null;
      const commaIdx = b64.indexOf(',');
      const clean = commaIdx >= 0 ? b64.slice(commaIdx + 1).trim() : b64.trim();
      if (!clean) return null;
      const bin = atob(clean);
      const len = bin.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        u8[i] = bin.charCodeAt(i);
      }
      return u8;
    }

    _normalizePdfCropRef(ref) {
      if (!ref || typeof ref !== 'object' || !ref.pdfDocUid) return null;
      const nc = ref.normCrop;
      if (!nc || typeof nc !== 'object') return null;
      const nx = Math.max(0, Math.min(1, Number(nc.nx) || 0));
      const ny = Math.max(0, Math.min(1, Number(nc.ny) || 0));
      const nw = Math.max(0.001, Math.min(1 - nx, Number(nc.nw) || 0));
      const nh = Math.max(0.001, Math.min(1 - ny, Number(nc.nh) || 0));
      if (!(nw > 0 && nh > 0)) return null;
      const out = {
        pdfDocUid: String(ref.pdfDocUid),
        pageNum: Math.max(1, Math.floor(Number(ref.pageNum) || 1)),
        normCrop: {
          nx: +nx.toFixed(6),
          ny: +ny.toFixed(6),
          nw: +nw.toFixed(6),
          nh: +nh.toFixed(6)
        }
      };
      if (typeof ref.aspect === 'number' && ref.aspect > 0) {
        out.aspect = +ref.aspect.toFixed(5);
      }
      if (typeof ref._embeddedPdfBase64 === 'string' && ref._embeddedPdfBase64.length > 32) {
        out._embeddedPdfBase64 = ref._embeddedPdfBase64;
      }
      return out;
    }

    _forEachPdfCropRefInSlide(slide, visitor) {
      if (!slide || typeof slide !== 'object' || typeof visitor !== 'function') return;
      if (slide.primaryProblemCard && typeof slide.primaryProblemCard === 'object') {
        const pc = slide.primaryProblemCard;
        const ref = pc.pdfCropRef || (pc.problemCardData && pc.problemCardData.pdfCropRef);
        if (ref && ref.pdfDocUid) {
          visitor(ref, pc, 'primary');
        }
      }
      if (Array.isArray(slide.extraProblems)) {
        for (let i = 0; i < slide.extraProblems.length; i++) {
          const ep = slide.extraProblems[i];
          if (ep && ep.pdfCropRef && ep.pdfCropRef.pdfDocUid) {
            visitor(ep.pdfCropRef, ep, 'extra');
          }
        }
      }
      const isStrHist = Boolean(slide.historyJson && typeof slide.historyJson === 'string');
      const hObj = isStrHist
        ? (() => { try { return JSON.parse(slide.historyJson); } catch (_) { return null; } })()
        : slide.historyJson;
      if (hObj && Array.isArray(hObj.inkStrokes)) {
        let touchedStrHist = false;
        for (let i = 0; i < hObj.inkStrokes.length; i++) {
          const st = hObj.inkStrokes[i];
          if (st && st.isProblemStamp && st.graphStamp && st.graphStamp.pdfCropRef && st.graphStamp.pdfCropRef.pdfDocUid) {
            visitor(st.graphStamp.pdfCropRef, st.graphStamp, 'stamp');
            touchedStrHist = true;
          }
        }
        if (isStrHist && touchedStrHist) {
          slide.historyJson = JSON.stringify(hObj);
        }
      }
      if (slide.audioSyncData && typeof slide.audioSyncData === 'object') {
        const pool = slide.audioSyncData.cardAssetPool;
        if (pool && typeof pool === 'object') {
          Object.values(pool).forEach((item) => {
            if (item && item.pdfCropRef && item.pdfCropRef.pdfDocUid) {
              visitor(item.pdfCropRef, item, 'audioPool');
            }
          });
        }
        if (Array.isArray(slide.audioSyncData.strokes)) {
          for (let i = 0; i < slide.audioSyncData.strokes.length; i++) {
            const st = slide.audioSyncData.strokes[i];
            if (st && st.isProblemStamp && st.graphStamp && st.graphStamp.pdfCropRef && st.graphStamp.pdfCropRef.pdfDocUid) {
              visitor(st.graphStamp.pdfCropRef, st.graphStamp, 'audioStamp');
            }
          }
        }
        if (Array.isArray(slide.audioSyncData.erasedStrokes)) {
          for (let i = 0; i < slide.audioSyncData.erasedStrokes.length; i++) {
            const st = slide.audioSyncData.erasedStrokes[i];
            if (st && st.isProblemStamp && st.graphStamp && st.graphStamp.pdfCropRef && st.graphStamp.pdfCropRef.pdfDocUid) {
              visitor(st.graphStamp.pdfCropRef, st.graphStamp, 'audioErasedStamp');
            }
          }
        }
      }
    }

    _getCropRefCacheKey(ref) {
      const norm = this._normalizePdfCropRef(ref);
      if (!norm) return '';
      const nc = norm.normCrop;
      return `${norm.pdfDocUid}|${norm.pageNum}|${nc.nx},${nc.ny},${nc.nw},${nc.nh}`;
    }

    async _canvasToRuntimeCropBlobUrl(canvas, quality = 0.94) {
      if (!canvas || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return canvas ? this.encodeCanvasSmartWebP(canvas, quality, true) : '';
      }
      const canWebP = typeof this._canEncodeCanvasWebP === 'function' && this._canEncodeCanvasWebP();
      const mime = canWebP ? 'image/webp' : 'image/jpeg';
      const effQ = (mime === 'image/jpeg') ? Math.min(0.95, Math.max(0.82, quality)) : quality;
      if (typeof canvas.toBlob === 'function') {
        try {
          const blob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b || null), mime, effQ);
          });
          if (blob && blob.size > 0) {
            return URL.createObjectURL(blob);
          }
        } catch (_) { }
      }
      return this.encodeCanvasSmartWebP(canvas, quality, true);
    }

    async _ensureProblemCropBlobUrlFromRef(rawRef, opts = null) {
      const norm = this._normalizePdfCropRef(rawRef);
      if (!norm) return null;
      if (!this._cropBlobUrlCache) this._cropBlobUrlCache = new Map();
      if (!this._cropBlobInFlightMap) this._cropBlobInFlightMap = new Map();
      const reqMinW = (opts && opts.targetMinWidthPx > 0) ? Math.round(opts.targetMinWidthPx) : 0;
      const isIOSCheck = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
      const checkSideCap = (opts && opts.maxSideCap > 0) ? opts.maxSideCap : (isIOSCheck ? 2560 : 3072);
      const checkAreaCap = (opts && opts.maxAreaCap > 0) ? opts.maxAreaCap : (isIOSCheck ? 4600000 : 6800000);
      const isHitSufficient = (h) => Boolean(
        h &&
        h.blobUrl &&
        (!reqMinW ||
          (h.pxW || 0) >= reqMinW * 0.92 ||
          h.hitScaleCap ||
          Math.max(h.pxW || 0, h.pxH || 0) >= (checkSideCap - 4) ||
          ((h.pxW || 0) * (h.pxH || 0)) >= (checkAreaCap * 0.95))
      );
      const cacheKey = this._getCropRefCacheKey(norm);
      if (cacheKey && this._cropBlobUrlCache.has(cacheKey)) {
        const hit = this._cropBlobUrlCache.get(cacheKey);
        if (isHitSufficient(hit)) {
          this._cropBlobUrlCache.delete(cacheKey);
          this._cropBlobUrlCache.set(cacheKey, hit);
          return hit;
        }
      }
      if (cacheKey && this._cropBlobInFlightMap.has(cacheKey)) {
        const inflightRes = await this._cropBlobInFlightMap.get(cacheKey);
        if (isHitSufficient(inflightRes)) {
          return inflightRes;
        }
      }

      const buildTask = (async () => {
        // 이미 열려 있는 단일 PDF 문서(this.pdfDoc)를 그대로 재사용 (이중 로드 0회)
        const liveDoc = await this._getOrWaitLivePdfDocForUid(norm.pdfDocUid);
        if (!liveDoc || typeof liveDoc.getPage !== 'function') return null;

        // 동시 오프스크린 <canvas> 생성을 무조건 1개로 직렬화하여 iPad Safari VRAM 피크 원천 차단
        const prevChain = this._cropBlobRenderChain || Promise.resolve();
        let releaseSlot = null;
        this._cropBlobRenderChain = new Promise((r) => { releaseSlot = r; });
        await prevChain.catch(() => { });

        let blobUrl = '';
        let aspect = 0.72;
        let targetW = 0;
        let targetH = 0;
        let hitScaleCap = false;
        try {
          const safeP = Math.max(1, Math.min(liveDoc.numPages || 1, norm.pageNum));
          const page = await liveDoc.getPage(safeP);
          const baseVp = page.getViewport({ scale: 1.0 });
          const nc = norm.normCrop;
          const rawCropW = Math.max(1, nc.nw * baseVp.width);
          const rawCropH = Math.max(1, nc.nh * baseVp.height);
          const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
          const desiredMinWidthPx = reqMinW > 0 ? reqMinW : (isIOS ? 2000 : 2300);
          const maxSideCap = (opts && opts.maxSideCap > 0) ? opts.maxSideCap : (isIOS ? 2560 : 3072);
          const maxAreaCap = (opts && opts.maxAreaCap > 0) ? opts.maxAreaCap : (isIOS ? 4600000 : 6800000);
          const maxVecScale = 20.0;
          let renderScale = Math.max(2.6, Math.min(maxVecScale, desiredMinWidthPx / rawCropW));
          if (Math.max(rawCropW, rawCropH) * renderScale > maxSideCap) {
            renderScale = maxSideCap / Math.max(rawCropW, rawCropH);
          }
          if ((rawCropW * renderScale) * (rawCropH * renderScale) > maxAreaCap) {
            renderScale = Math.sqrt(maxAreaCap / Math.max(1, rawCropW * rawCropH));
          }
          targetW = Math.max(2, Math.round(rawCropW * renderScale));
          targetH = Math.max(2, Math.round(rawCropH * renderScale));
          hitScaleCap = Boolean(renderScale >= (maxVecScale - 0.05));
          const cropVp = page.getViewport({
            scale: renderScale,
            offsetX: -nc.nx * baseVp.width * renderScale,
            offsetY: -nc.ny * baseVp.height * renderScale
          });
          const vecCanvas = document.createElement('canvas');
          vecCanvas.width = targetW;
          vecCanvas.height = targetH;
          const vCtx = vecCanvas.getContext('2d', { alpha: false }) || vecCanvas.getContext('2d');
          if (!vCtx) {
            try { vecCanvas.width = 0; vecCanvas.height = 0; } catch (_) { }
            return null;
          }
          vCtx.imageSmoothingEnabled = true;
          vCtx.imageSmoothingQuality = 'high';
          vCtx.fillStyle = '#ffffff';
          vCtx.fillRect(0, 0, targetW, targetH);
          await page.render({ canvasContext: vCtx, viewport: cropVp }).promise;
          aspect = +(targetH / Math.max(1, targetW)).toFixed(5);
          blobUrl = await this._canvasToRuntimeCropBlobUrl(vecCanvas, 0.94);
          vecCanvas._evicted = true;
          try { vecCanvas.width = 1; vecCanvas.height = 1; } catch (_) { }
        } finally {
          if (releaseSlot) releaseSlot();
        }
        if (!blobUrl) return null;

        let decodedImg = null;
        if (typeof Image !== 'undefined') {
          try {
            const preImg = new Image();
            preImg.decoding = 'async';
            preImg.src = blobUrl;
            if (typeof preImg.decode === 'function') {
              await preImg.decode().catch(() => { });
            } else if (!preImg.complete) {
              await new Promise((res) => {
                preImg.onload = () => res();
                preImg.onerror = () => res();
                setTimeout(res, 120);
              });
            }
            decodedImg = preImg;
          } catch (_) { }
        }

        const entry = { blobUrl, aspect, img: decodedImg, pxW: targetW, pxH: targetH, hitScaleCap };
        if (cacheKey && this._cropBlobUrlCache.has(cacheKey)) {
          const prevEntry = this._cropBlobUrlCache.get(cacheKey);
          this._cropBlobUrlCache.delete(cacheKey);
          if (prevEntry && prevEntry.blobUrl && prevEntry.blobUrl !== blobUrl && String(prevEntry.blobUrl).startsWith('blob:')) {
            if (!Array.isArray(this._retiredCropBlobUrls)) this._retiredCropBlobUrls = [];
            this._retiredCropBlobUrls.push(prevEntry.blobUrl);
            while (this._retiredCropBlobUrls.length > 24) {
              const expiredUrl = this._retiredCropBlobUrls.shift();
              try { URL.revokeObjectURL(expiredUrl); } catch (_) { }
            }
          }
        }
        while (this._cropBlobUrlCache.size >= 80) {
          const oldestK = this._cropBlobUrlCache.keys().next().value;
          if (oldestK === undefined) break;
          const oldVal = this._cropBlobUrlCache.get(oldestK);
          this._cropBlobUrlCache.delete(oldestK);
          if (oldVal && typeof oldVal.blobUrl === 'string' && oldVal.blobUrl.startsWith('blob:')) {
            try { URL.revokeObjectURL(oldVal.blobUrl); } catch (_) { }
          }
        }
        this._cropBlobUrlCache.set(cacheKey, entry);
        return entry;
      })().catch(() => null).finally(() => {
        if (cacheKey) this._cropBlobInFlightMap.delete(cacheKey);
      });

      if (cacheKey) this._cropBlobInFlightMap.set(cacheKey, buildTask);
      return await buildTask;
    }

    async _hydrateCurrentWorkspacePdfCropRefs() {
      const tasks = [];
      if (this.problemCardData && this.problemCardData.pdfCropRef) {
        const curUrl = this.problemCardData.imgUrl || '';
        const pImg = (typeof document !== 'undefined') ? document.getElementById('problemCardImg') : null;
        const hasLoaded = Boolean(curUrl && pImg && pImg.src && pImg.complete && pImg.naturalWidth > 4);
        if (!hasLoaded) {
          const capturedData = this.problemCardData;
          tasks.push(this._ensureProblemCropBlobUrlFromRef(capturedData.pdfCropRef).then((res) => {
            if (!res || !res.blobUrl || this.problemCardData !== capturedData) return;
            capturedData.imgUrl = res.blobUrl;
            if (res.aspect > 0) this.problemCardAspect = res.aspect;
            const liveImg = (typeof document !== 'undefined') ? document.getElementById('problemCardImg') : null;
            if (liveImg && liveImg.src !== res.blobUrl) liveImg.src = res.blobUrl;
            this.problemCardImage = res.img || liveImg || null;
            this.syncProblemCardRectFromWidget();
            this.renderProblemCardCanvas();
            this.requestRender();
          }));
        }
      }
      if (Array.isArray(this.extraProblemCards)) {
        for (let i = 0; i < this.extraProblemCards.length; i++) {
          const c = this.extraProblemCards[i];
          const ref = c && (c.pdfCropRef || (c.el && c.el._pdfCropRef));
          if (!ref || !c.el) continue;
          const imgEl = c.el.querySelector('.problem-card-img');
          const hasLoaded = Boolean(imgEl && imgEl.getAttribute('src') && imgEl.complete && imgEl.naturalWidth > 4);
          if (!hasLoaded) {
            tasks.push(this._ensureProblemCropBlobUrlFromRef(ref).then((res) => {
              if (!res || !res.blobUrl || !c.el) return;
              const liveImg = c.el.querySelector('.problem-card-img');
              if (liveImg && liveImg.src !== res.blobUrl) liveImg.src = res.blobUrl;
              const extraCvs = c.el.querySelector('.problem-card-canvas');
              if (extraCvs) extraCvs._needsSizeSync = true;
              if (typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
              this.requestRender();
            }));
          }
        }
      }
      if (Array.isArray(this.inkStrokes)) {
        for (let i = 0; i < this.inkStrokes.length; i++) {
          const st = this.inkStrokes[i];
          if (!st || !st.isProblemStamp || !st.graphStamp || !st.graphStamp.pdfCropRef) continue;
          const hasLoaded = Boolean(
            st.graphStamp.dataUrl &&
            st._stampCache &&
            st._stampCache.img &&
            st._stampCache.img.complete &&
            st._stampCache.img.naturalWidth > 4
          );
          if (!hasLoaded) {
            tasks.push(this._ensureProblemCropBlobUrlFromRef(st.graphStamp.pdfCropRef).then((res) => {
              if (!res || !res.blobUrl || !st.graphStamp) return;
              st.graphStamp.dataUrl = res.blobUrl;
              if (!st._stampCache && typeof document !== 'undefined') {
                try {
                  Object.defineProperty(st, '_stampCache', {
                    value: { canvas: document.createElement('canvas'), key: '', img: null, imgUrl: '' },
                    writable: true,
                    configurable: true,
                    enumerable: false
                  });
                } catch (_) { }
              }
              if (st._stampCache) {
                st._stampCache.key = '';
                if (res.img) {
                  st._stampCache.img = res.img;
                  st._stampCache.imgUrl = res.blobUrl;
                }
              }
              this._inkBakeDirty = true;
              this.requestRender();
            }));
          }
        }
      }
      if (this.audioSyncData && typeof this.audioSyncData === 'object') {
        const pool = this.audioSyncData.cardAssetPool;
        if (pool && typeof pool === 'object') {
          Object.values(pool).forEach((item) => {
            if (item && item.pdfCropRef && !item.dataUrl) {
              tasks.push(this._ensureProblemCropBlobUrlFromRef(item.pdfCropRef).then((res) => {
                if (res && res.blobUrl) item.dataUrl = res.blobUrl;
              }));
            }
          });
        }
        for (const strokeArr of [this.audioSyncData.strokes, this.audioSyncData.erasedStrokes]) {
          if (Array.isArray(strokeArr)) {
            strokeArr.forEach((st) => {
              if (st && st.isProblemStamp && st.graphStamp && st.graphStamp.pdfCropRef && !st.graphStamp.dataUrl) {
                tasks.push(this._ensureProblemCropBlobUrlFromRef(st.graphStamp.pdfCropRef).then((res) => {
                  if (res && res.blobUrl) st.graphStamp.dataUrl = res.blobUrl;
                }));
              }
            });
          }
        }
      }
      if (tasks.length > 0) {
        await Promise.all(tasks);
      }
    }

    _collectProtectedPdfDocUids() {
      const keep = new Set();
      if (this.pdfDoc && this.pdfDoc._graphlyDocUid) keep.add(this.pdfDoc._graphlyDocUid);
      if (this.pdfPageBoardData && this.pdfPageBoardData.pdfDocUid) keep.add(this.pdfPageBoardData.pdfDocUid);
      if (this._suspendedPdfBoardState && this._suspendedPdfBoardState.pdfPageBoardData && this._suspendedPdfBoardState.pdfPageBoardData.pdfDocUid) {
        keep.add(this._suspendedPdfBoardState.pdfPageBoardData.pdfDocUid);
      }
      if (this.problemCardData && this.problemCardData.pdfCropRef && this.problemCardData.pdfCropRef.pdfDocUid) {
        keep.add(this.problemCardData.pdfCropRef.pdfDocUid);
      }
      if (Array.isArray(this.extraProblemCards)) {
        for (let i = 0; i < this.extraProblemCards.length; i++) {
          const c = this.extraProblemCards[i];
          const ref = c && (c.pdfCropRef || (c.el && c.el._pdfCropRef));
          if (ref && ref.pdfDocUid) keep.add(ref.pdfDocUid);
        }
      }
      if (Array.isArray(this.inkStrokes)) {
        for (let i = 0; i < this.inkStrokes.length; i++) {
          const st = this.inkStrokes[i];
          if (st && st.isProblemStamp && st.graphStamp && st.graphStamp.pdfCropRef && st.graphStamp.pdfCropRef.pdfDocUid) {
            keep.add(st.graphStamp.pdfCropRef.pdfDocUid);
          }
        }
      }
      const scanSlides = (arr) => {
        if (!Array.isArray(arr)) return;
        for (let i = 0; i < arr.length; i++) {
          const s = arr[i];
          if (!s) continue;
          if (s.pdfPageBoardData && s.pdfPageBoardData.pdfDocUid) keep.add(s.pdfPageBoardData.pdfDocUid);
          if (s.suspendedPdfBoardState && s.suspendedPdfBoardState.pdfPageBoardData && s.suspendedPdfBoardState.pdfPageBoardData.pdfDocUid) {
            keep.add(s.suspendedPdfBoardState.pdfPageBoardData.pdfDocUid);
          }
          this._forEachPdfCropRefInSlide(s, (ref) => {
            if (ref && ref.pdfDocUid) keep.add(ref.pdfDocUid);
          });
        }
      };
      scanSlides(this.lessonPlaylistSlides);
      if (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides)) {
        scanSlides(this._viewerPkg.playlistSlides);
      }
      return keep;
    }

    _registerPdfBytesForDocUid(docUid, bytes, pdfDocProxy = null) {
      if (!docUid || !bytes) return;
      if (!this._pdfBytesByDocUid) this._pdfBytesByDocUid = new Map();
      if (!this._embeddedPdfDocs) this._embeddedPdfDocs = new Map();
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      this._pdfBytesByDocUid.delete(docUid);
      this._pdfBytesByDocUid.set(docUid, u8);
      if (pdfDocProxy) {
        pdfDocProxy._graphlyDocUid = docUid;
        this._embeddedPdfDocs.delete(docUid);
        this._embeddedPdfDocs.set(docUid, pdfDocProxy);
      }
      if (this._pdfBytesByDocUid.size > 10) {
        const keep = this._collectProtectedPdfDocUids();
        keep.add(docUid);
        for (const k of Array.from(this._pdfBytesByDocUid.keys())) {
          if (this._pdfBytesByDocUid.size <= 8) break;
          if (keep.has(k)) continue;
          this._pdfBytesByDocUid.delete(k);
          const oldDoc = this._embeddedPdfDocs.get(k);
          this._embeddedPdfDocs.delete(k);
          if (oldDoc && oldDoc !== this.pdfDoc && typeof oldDoc.destroy === 'function') {
            try { oldDoc.destroy(); } catch (_) { }
          }
        }
      }
    }

    _getLivePdfDocForUid(docUid) {
      if (!docUid) return null;
      if (this.pdfDoc && this.pdfDoc._graphlyDocUid === docUid && typeof this.pdfDoc.getPage === 'function') {
        return this.pdfDoc;
      }
      if (this._embeddedPdfDocs && this._embeddedPdfDocs.has(docUid)) {
        const emb = this._embeddedPdfDocs.get(docUid);
        if (emb && typeof emb.getPage === 'function') return emb;
      }
      return null;
    }

    _hasLivePdfSourceForBoard(pbd) {
      if (!pbd || !pbd.pdfDocUid) return false;
      const uid = pbd.pdfDocUid;
      if (this._getLivePdfDocForUid(uid)) return true;
      if (this._pdfBytesByDocUid && this._pdfBytesByDocUid.has(uid)) return true;
      if (this._embeddedPdfDocPromises && this._embeddedPdfDocPromises.has(uid)) return true;
      return false;
    }

    async _mountEmbeddedPdfBytes(docUid, rawBytes) {
      if (!docUid || !rawBytes || typeof window === 'undefined' || !window.pdfjsLib) return null;
      const existing = this._getLivePdfDocForUid(docUid);
      if (existing) {
        this._registerPdfBytesForDocUid(docUid, rawBytes, existing);
        return existing;
      }
      if (!this._embeddedPdfDocPromises) this._embeddedPdfDocPromises = new Map();
      if (this._embeddedPdfDocPromises.has(docUid)) {
        return this._embeddedPdfDocPromises.get(docUid);
      }
      const u8 = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
      this._registerPdfBytesForDocUid(docUid, u8, null);
      const { cMapUrl, standardFontDataUrl } = this._getPdfJsFontResourceUrls();
      const mountPromise = window.pdfjsLib.getDocument({
        data: u8.slice(),
        cMapUrl,
        cMapPacked: true,
        standardFontDataUrl
      }).promise.then((pdf) => {
        if (pdf) {
          pdf._graphlyDocUid = docUid;
          if (!this._embeddedPdfDocs) this._embeddedPdfDocs = new Map();
          this._embeddedPdfDocs.set(docUid, pdf);
        }
        return pdf || null;
      }).catch((err) => {
        console.warn('내장 PDF 마운트 실패:', err);
        return null;
      }).finally(() => {
        if (this._embeddedPdfDocPromises) this._embeddedPdfDocPromises.delete(docUid);
      });
      this._embeddedPdfDocPromises.set(docUid, mountPromise);
      return mountPromise;
    }

    async _getOrWaitLivePdfDocForUid(docUid) {
      if (!docUid) return null;
      const live = this._getLivePdfDocForUid(docUid);
      if (live) return live;
      if (this._embeddedPdfDocPromises && this._embeddedPdfDocPromises.has(docUid)) {
        return await this._embeddedPdfDocPromises.get(docUid);
      }
      if (this._pdfBytesByDocUid && this._pdfBytesByDocUid.has(docUid)) {
        return await this._mountEmbeddedPdfBytes(docUid, this._pdfBytesByDocUid.get(docUid));
      }
      return null;
    }

    _extractAndQueueEmbeddedPdfFromSlidesSync(slides) {
      if (!Array.isArray(slides) || !slides.length) return;
      const inspectCarrier = (carrier) => {
        if (!carrier || typeof carrier !== 'object') return;
        if (typeof carrier._embeddedPdfBase64 === 'string' && carrier._embeddedPdfBase64.length > 32 && carrier.pdfDocUid) {
          try {
            if (!this._pdfBytesByDocUid || !this._pdfBytesByDocUid.has(carrier.pdfDocUid)) {
              const u8 = this._base64ToUint8ArrayFast(carrier._embeddedPdfBase64);
              if (u8 && u8.byteLength > 64) {
                this._registerPdfBytesForDocUid(carrier.pdfDocUid, u8, null);
                this._mountEmbeddedPdfBytes(carrier.pdfDocUid, u8);
              }
            } else if (!this._getLivePdfDocForUid(carrier.pdfDocUid)) {
              this._mountEmbeddedPdfBytes(carrier.pdfDocUid, this._pdfBytesByDocUid.get(carrier.pdfDocUid));
            }
            delete carrier._embeddedPdfBase64;
          } catch (_) { }
        } else if (carrier.pdfDocUid && this._pdfBytesByDocUid && this._pdfBytesByDocUid.has(carrier.pdfDocUid) && !this._getLivePdfDocForUid(carrier.pdfDocUid)) {
          this._mountEmbeddedPdfBytes(carrier.pdfDocUid, this._pdfBytesByDocUid.get(carrier.pdfDocUid));
        }
      };
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (!s) continue;
        inspectCarrier(s.pdfPageBoardData);
        if (s.suspendedPdfBoardState && s.suspendedPdfBoardState.pdfPageBoardData) {
          inspectCarrier(s.suspendedPdfBoardState.pdfPageBoardData);
        }
        this._forEachPdfCropRefInSlide(s, (ref) => {
          inspectCarrier(ref);
        });
      }
    }

    async _mountEmbeddedPdfFromSlidesIfPresent(slides) {
      if (!Array.isArray(slides) || !slides.length) return;
      this._extractAndQueueEmbeddedPdfFromSlidesSync(slides);
      const uids = new Set();
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (!s) continue;
        if (s.pdfPageBoardData && s.pdfPageBoardData.pdfDocUid) uids.add(s.pdfPageBoardData.pdfDocUid);
        if (s.suspendedPdfBoardState && s.suspendedPdfBoardState.pdfPageBoardData && s.suspendedPdfBoardState.pdfPageBoardData.pdfDocUid) {
          uids.add(s.suspendedPdfBoardState.pdfPageBoardData.pdfDocUid);
        }
        this._forEachPdfCropRefInSlide(s, (ref) => {
          if (ref && ref.pdfDocUid) uids.add(ref.pdfDocUid);
        });
      }
      if (uids.size > 0) {
        await Promise.all(Array.from(uids).map((u) => this._getOrWaitLivePdfDocForUid(u)));
      }
    }

    async _ensurePdfLibLoaded() {
      if (typeof window !== 'undefined' && window.PDFLib && window.PDFLib.PDFDocument) {
        return window.PDFLib;
      }
      if (this._pdfLibLoadPromise) return this._pdfLibLoadPromise;
      const { isFileProtocol, pdfLibBaseHref } = this._getPdfJsFontResourceUrls();
      const scriptUrl = isFileProtocol
        ? 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.11.1/dist/pdf-lib.min.js'
        : new URL('pdf-lib.min.js', pdfLibBaseHref).href;
      this._pdfLibLoadPromise = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = scriptUrl;
        sc.async = true;
        sc.onload = () => {
          if (window.PDFLib && window.PDFLib.PDFDocument) resolve(window.PDFLib);
          else reject(new Error('PDFLib_MISSING'));
        };
        sc.onerror = () => reject(new Error('PDFLib_LOAD_FAILED'));
        document.head.appendChild(sc);
      }).catch((err) => {
        this._pdfLibLoadPromise = null;
        throw err;
      });
      return this._pdfLibLoadPromise;
    }

    async _renderPdfDocPageToCanvas(pdfDocProxy, srcPageNum, targetMinPxW = 2800) {
      if (!pdfDocProxy || typeof pdfDocProxy.getPage !== 'function') return null;
      const safePage = Math.max(1, Math.min(pdfDocProxy.numPages || 1, Number(srcPageNum) || 1));
      const page = await pdfDocProxy.getPage(safePage);
      const baseVp = page.getViewport({ scale: 1.0 });
      const maxSidePx = 4032;
      const maxAreaPx = 15500000;
      const rawScale = Math.max(2.0, Math.min(4.7, targetMinPxW / Math.max(1, baseVp.width)));
      const maxSideScale = maxSidePx / Math.max(1, baseVp.width, baseVp.height);
      const maxAreaScale = Math.sqrt(maxAreaPx / Math.max(1, baseVp.width * baseVp.height));
      const renderScale = Math.max(1.0, Math.min(rawScale, maxSideScale, maxAreaScale));
      const vp = page.getViewport({ scale: renderScale });
      const offC = document.createElement('canvas');
      offC.width = Math.round(vp.width);
      offC.height = Math.round(vp.height);
      const ctx = offC.getContext('2d', { alpha: false }) || offC.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offC.width, offC.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      }
      return offC;
    }

    async _embedSubsetPdfIntoSlidesIfAvailable(slides, effFilter = null) {
      if (!Array.isArray(slides) || !slides.length) return slides;
      if (effFilter && effFilter.includeProblem === false) return slides;
      this._extractAndQueueEmbeddedPdfFromSlidesSync(slides);

      const pbdTargets = [];
      const cropTargets = [];
      let carrierPbd = null;
      let carrierCropRef = null;
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (!s) continue;
        const addIfBacked = (pbd, allowCarrier) => {
          if (!pbd || !pbd.pdfDocUid) return;
          if (!this._pdfBytesByDocUid || !this._pdfBytesByDocUid.has(pbd.pdfDocUid)) return;
          pbdTargets.push(pbd);
          if (allowCarrier && !carrierPbd) carrierPbd = pbd;
        };
        addIfBacked(s.pdfPageBoardData, true);
        if (s.suspendedPdfBoardState && s.suspendedPdfBoardState.pdfPageBoardData) {
          addIfBacked(s.suspendedPdfBoardState.pdfPageBoardData, !carrierPbd);
        }
        if (s.audioSyncData && s.audioSyncData.archivedPdfBoards && typeof s.audioSyncData.archivedPdfBoards === 'object') {
          Object.values(s.audioSyncData.archivedPdfBoards).forEach((ap) => addIfBacked(ap, false));
        }
        this._forEachPdfCropRefInSlide(s, (ref, owner, kind) => {
          if (!ref || !ref.pdfDocUid) return;
          if (!this._pdfBytesByDocUid || !this._pdfBytesByDocUid.has(ref.pdfDocUid)) return;
          cropTargets.push({ ref, owner, kind });
          if (!carrierCropRef && (kind === 'primary' || kind === 'extra' || kind === 'stamp')) {
            carrierCropRef = ref;
          }
        });
      }
      const carrierTarget = carrierPbd || carrierCropRef;
      if ((!pbdTargets.length && !cropTargets.length) || !carrierTarget) return slides;

      try {
        const PDFLib = await this._ensurePdfLibLoaded();
        const subDoc = await PDFLib.PDFDocument.create();
        const loadedSrcDocs = new Map();
        const pageMap = new Map(); // `${uid}:${srcPage}` -> 1-based page in subDoc
        const orderedRequests = [];

        const enqueuePageReq = (uid, srcPageRaw) => {
          const srcPage = Math.max(1, Number(srcPageRaw) || 1);
          const mapKey = `${uid}:${srcPage}`;
          if (!pageMap.has(mapKey)) {
            pageMap.set(mapKey, 0);
            orderedRequests.push({ uid, srcPage, mapKey });
          }
        };

        for (let i = 0; i < pbdTargets.length; i++) {
          const pbd = pbdTargets[i];
          enqueuePageReq(pbd.pdfDocUid, pbd.pdfSourcePageNum || pbd.pageNum || 1);
        }
        for (let i = 0; i < cropTargets.length; i++) {
          const ct = cropTargets[i];
          enqueuePageReq(ct.ref.pdfDocUid, ct.ref.pageNum || 1);
        }

        let nextSubPageNum = 1;
        // 동일 원본 문서 단위로 묶어 copyPages 배치 실행
        const byUid = new Map();
        for (let i = 0; i < orderedRequests.length; i++) {
          const req = orderedRequests[i];
          if (!byUid.has(req.uid)) byUid.set(req.uid, []);
          byUid.get(req.uid).push(req);
        }

        for (const [uid, reqList] of byUid.entries()) {
          const srcBytes = this._pdfBytesByDocUid.get(uid);
          if (!srcBytes) throw new Error('MISSING_SRC_PDF_BYTES');
          let srcDoc = loadedSrcDocs.get(uid);
          if (!srcDoc) {
            srcDoc = await PDFLib.PDFDocument.load(srcBytes, { password: '', ignoreEncryption: true });
            loadedSrcDocs.set(uid, srcDoc);
          }
          const maxP = srcDoc.getPageCount();
          const zeroBasedIndices = reqList.map((r) => Math.max(0, Math.min(maxP - 1, r.srcPage - 1)));
          const copiedPages = await subDoc.copyPages(srcDoc, zeroBasedIndices);
          for (let j = 0; j < copiedPages.length; j++) {
            subDoc.addPage(copiedPages[j]);
            pageMap.set(reqList[j].mapKey, nextSubPageNum++);
          }
        }

        const subBytes = await subDoc.save();
        if (!subBytes || subBytes.byteLength < 64) throw new Error('EMPTY_SUBSET_PDF');

        const newSubDocUid = `pdfsub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        // 저장 전 PDF.js 파싱 가능 여부 자가 검증 (무결성 100% 보장)
        const verifiedProxy = await this._mountEmbeddedPdfBytes(newSubDocUid, subBytes);
        if (!verifiedProxy || !verifiedProxy.numPages) throw new Error('SUBSET_VERIFY_FAILED');
        const testPage1 = await verifiedProxy.getPage(1);
        if (!testPage1) throw new Error('SUBSET_PAGE1_FAILED');

        const b64Str = this._uint8ArrayToBase64Fast(subBytes);
        for (let i = 0; i < pbdTargets.length; i++) {
          const pbd = pbdTargets[i];
          const oldKey = `${pbd.pdfDocUid}:${Math.max(1, Number(pbd.pdfSourcePageNum) || Number(pbd.pageNum) || 1)}`;
          const mappedSubPage = pageMap.get(oldKey) || 1;
          pbd.pdfDocUid = newSubDocUid;
          pbd.pdfSourcePageNum = mappedSubPage;
          pbd.dataUrl = '';
          delete pbd._embeddedPdfBase64;
        }
        for (let i = 0; i < cropTargets.length; i++) {
          const { ref, owner, kind } = cropTargets[i];
          const oldKey = `${ref.pdfDocUid}:${Math.max(1, Number(ref.pageNum) || 1)}`;
          const mappedSubPage = pageMap.get(oldKey) || 1;
          ref.pdfDocUid = newSubDocUid;
          ref.pageNum = mappedSubPage;
          delete ref._embeddedPdfBase64;
          if (owner && typeof owner === 'object') {
            if (kind === 'primary') {
              owner.pdfCropRef = ref;
              if (owner.problemCardData && typeof owner.problemCardData === 'object') {
                owner.problemCardData.pdfCropRef = { ...ref };
              }
              owner.imgSrc = '';
            } else if (kind === 'extra' || kind === 'stamp' || kind === 'audioPool' || kind === 'audioStamp') {
              owner.dataUrl = '';
            }
          }
        }
        carrierTarget._embeddedPdfBase64 = b64Str;
        return slides;
      } catch (err) {
        console.warn('PDF 벡터 발췌 폴백(고해상도 이미지 저장 전환):', err);
        for (let i = 0; i < pbdTargets.length; i++) {
          const pbd = pbdTargets[i];
          if (pbd.dataUrl && !String(pbd.dataUrl).startsWith('blob:')) continue;
          const liveDoc = await this._getOrWaitLivePdfDocForUid(pbd.pdfDocUid);
          if (liveDoc) {
            const cv = await this._renderPdfDocPageToCanvas(liveDoc, pbd.pdfSourcePageNum || pbd.pageNum || 1, 2800);
            if (cv) {
              pbd.dataUrl = this.encodeCanvasSmartWebP(cv, 0.88, true);
              try { cv.width = 1; cv.height = 1; } catch (_) { }
            }
          }
        }
        for (let i = 0; i < cropTargets.length; i++) {
          const { ref, owner, kind } = cropTargets[i];
          if (!owner) continue;
          const curStr = (kind === 'primary') ? (owner.imgSrc || '') : (owner.dataUrl || '');
          if (curStr && curStr.startsWith('data:image/')) continue;
          const liveDoc = await this._getOrWaitLivePdfDocForUid(ref.pdfDocUid);
          if (liveDoc) {
            const page = await liveDoc.getPage(Math.max(1, Math.min(liveDoc.numPages || 1, ref.pageNum || 1))).catch(() => null);
            if (page && ref.normCrop) {
              const baseVp = page.getViewport({ scale: 1.0 });
              const nc = ref.normCrop;
              const sc = Math.min(3.5, 1800 / Math.max(1, nc.nw * baseVp.width));
              const vp = page.getViewport({ scale: sc, offsetX: -nc.nx * baseVp.width * sc, offsetY: -nc.ny * baseVp.height * sc });
              const cv = document.createElement('canvas');
              cv.width = Math.max(2, Math.round(nc.nw * baseVp.width * sc));
              cv.height = Math.max(2, Math.round(nc.nh * baseVp.height * sc));
              const cctx = cv.getContext('2d', { alpha: false }) || cv.getContext('2d');
              if (cctx) {
                cctx.fillStyle = '#ffffff';
                cctx.fillRect(0, 0, cv.width, cv.height);
                await page.render({ canvasContext: cctx, viewport: vp }).promise.catch(() => { });
                const fallbackUrl = this.encodeCanvasSmartWebP(cv, 0.88, true);
                if (kind === 'primary') owner.imgSrc = fallbackUrl;
                else owner.dataUrl = fallbackUrl;
              }
              try { cv.width = 1; cv.height = 1; } catch (_) { }
            }
          }
        }
        return slides;
      }
    }

    setLessonTeachingMode(mode) {
      if (mode === 'page' || mode === 'crop') {
        this.lessonTeachingMode = mode;
      } else {
        this.lessonTeachingMode = null;
      }
      if (this.lessonTeachingMode === 'page') {
        if (this.isPdfCropModeActive) {
          this.togglePdfCropMode(false);
        }
      }
      this.syncCloudHubRailLockUI();
      this.syncPdfModalModeUI();
      this.syncLessonPlaylistNavBarUI();
    }

    _hideLockedFileImportHint() {
      const pill = (typeof document !== 'undefined') ? document.getElementById('lockedImportHintPill') : null;
      if (!pill) return;
      if (pill._hideTimer) {
        clearTimeout(pill._hideTimer);
        pill._hideTimer = null;
      }
      pill.classList.remove('show');
    }

    _showLockedFileImportHint() {
      if (typeof document === 'undefined' || !document.body) return;
      const btnImport = document.getElementById('btnPdfImport');
      if (!btnImport) return;
      let pill = document.getElementById('lockedImportHintPill');
      if (!pill) {
        pill = document.createElement('div');
        pill.id = 'lockedImportHintPill';
        pill.className = 'locked-import-hint-pill';
        pill.setAttribute('aria-live', 'polite');
        document.body.appendChild(pill);
        window.addEventListener('pointerdown', (ev) => {
          if (!pill.classList.contains('show')) return;
          if (ev.target && ev.target.closest && ev.target.closest('#btnPdfImport')) return;
          this._hideLockedFileImportHint();
        }, { passive: true, capture: true });
      }
      pill.textContent = (this.lessonTeachingMode === 'page')
        ? '페이지 추가는 우상단 [+] · 새 파일은 초기화 후 열기'
        : '문제 추가는 우상단 [+] · 새 파일은 초기화 후 열기';
      const rect = btnImport.getBoundingClientRect();
      pill.style.left = `${Math.round(rect.right + 10)}px`;
      pill.style.top = `${Math.round(rect.top + rect.height * 0.5)}px`;
      if (pill._hideTimer) clearTimeout(pill._hideTimer);
      pill.classList.remove('show');
      void pill.offsetWidth;
      pill.classList.add('show');
      pill._hideTimer = setTimeout(() => {
        pill._hideTimer = null;
        pill.classList.remove('show');
      }, 1800);
    }

    syncCloudHubRailLockUI() {
      const btnImport = document.getElementById('btnPdfImport');
      const btnCloudHub = document.getElementById('btnCloudHub');
      const isLocked = (this.lessonTeachingMode === 'crop' || this.lessonTeachingMode === 'page');
      if (!isLocked) {
        this._hideLockedFileImportHint();
      }
      if (btnImport) {
        btnImport.classList.toggle('rail-btn-locked-disabled', isLocked);
        btnImport.title = isLocked
          ? '상단 바에서 페이지를 추가하거나 초기화 후 새 파일을 열 수 있습니다'
          : '파일 열기';
      }
      if (btnCloudHub) {
        btnCloudHub.classList.remove('rail-btn-locked-disabled');
        btnCloudHub.title = '클라우드 보관함';
      }
    }

    syncPdfModalModeUI() {
      const mode = this.lessonTeachingMode; // null (미정: 초기 2개 표시) | 'crop' | 'page'
      const batchAddedCount = Array.isArray(this._pdfBatchSessionRecords) ? this._pdfBatchSessionRecords.length : 0;
      const isBatchMode = Boolean(this._isPdfBatchCropMode);
      const isCropActive = Boolean(this.isPdfCropModeActive);
      const isInCropFlow = (mode === 'crop') || isCropActive || isBatchMode || (batchAddedCount > 0);

      // 단건 [영역 캡처] 버튼: 통PDF('page')가 아니고, 아직 연속 캡처 슬라이드가 쌓이기 전(0개)일 때 노출
      const showSingleCropBtn = (mode !== 'page') && (batchAddedCount === 0);
      // [연속 캡처] 그룹: 통PDF('page')가 아니고, 영역 캡처를 눌렀거나 이미 crop 흐름에 들어왔을 때 [페이지 삽입] 자리와 맞교대 노출
      const showBatchGroup = (mode !== 'page') && isInCropFlow;
      // [페이지 삽입] 그룹: 영역 캡처 흐름이 아닐 때만 노출 (첫 진입 시 [영역 캡처] 클릭 순간 즉시 숨겨져 246px 공간 확보)
      const showPageBtn = (mode !== 'crop') && !isInCropFlow;

      const btnCropToggle = document.getElementById('btnPdfCropToggle');
      const batchGroup = document.getElementById('pdfBatchCropGroup');
      const btnBatchToggle = document.getElementById('btnPdfBatchCropToggle');
      const btnBatchUndo = document.getElementById('btnPdfBatchUndo');
      const btnBatchGoBoard = document.getElementById('btnPdfBatchGoBoard');
      const lblBatchGoBoard = document.getElementById('lblPdfBatchGoBoard');
      const insertGroup = document.getElementById('pdfPageInsertGroup');
      const btnOpenFullPage = document.getElementById('btnPdfOpenFullPage');

      const singleBtnActive = Boolean(isCropActive && !isBatchMode);
      const batchBtnActive = Boolean(isCropActive && isBatchMode);

      if (btnCropToggle) {
        btnCropToggle.style.display = showSingleCropBtn ? 'inline-flex' : 'none';
        btnCropToggle.classList.toggle('active', singleBtnActive);
        btnCropToggle.setAttribute('aria-pressed', singleBtnActive ? 'true' : 'false');
      }
      if (batchGroup) {
        batchGroup.style.display = showBatchGroup ? 'inline-flex' : 'none';
      }
      if (btnBatchToggle) {
        btnBatchToggle.classList.toggle('active', batchBtnActive);
        btnBatchToggle.setAttribute('aria-pressed', batchBtnActive ? 'true' : 'false');
      }
      if (btnBatchUndo) {
        btnBatchUndo.style.display = (batchAddedCount > 0) ? 'inline-flex' : 'none';
      }
      if (btnBatchGoBoard) {
        btnBatchGoBoard.style.display = (batchAddedCount > 0) ? 'inline-flex' : 'none';
      }
      if (lblBatchGoBoard && batchAddedCount > 0) {
        lblBatchGoBoard.textContent = `캔버스로 (${batchAddedCount})`;
      }
      if (insertGroup) {
        insertGroup.style.display = showPageBtn ? 'inline-flex' : 'none';
      } else if (btnOpenFullPage) {
        btnOpenFullPage.style.display = showPageBtn ? 'inline-flex' : 'none';
      }
      this.syncPdfPageRangeInsertUI();
    }

    handleSinglePdfCropButtonClick() {
      if (this.lessonTeachingMode === 'page') return;
      if (this._isPdfBatchCropMode && (!Array.isArray(this._pdfBatchSessionRecords) || this._pdfBatchSessionRecords.length === 0)) {
        // 아직 0개 캡처 상태에서 [연속 캡처] 켜짐 -> [영역 캡처] 클릭 시 단건 캡처 모드로 전환
        this._isPdfBatchCropMode = false;
        this.togglePdfCropMode(true, { silentToast: true });
        this.showToast('✂️ 단건 영역 캡처: 1개 드래그 즉시 캔버스로 이동합니다');
        return;
      }
      this._isPdfBatchCropMode = false;
      this.togglePdfCropMode();
    }

    handleBatchPdfCropButtonClick() {
      if (this.lessonTeachingMode === 'page') return;
      const addedCount = Array.isArray(this._pdfBatchSessionRecords) ? this._pdfBatchSessionRecords.length : 0;
      if (!this._isPdfBatchCropMode) {
        this._isPdfBatchCropMode = true;
        this.togglePdfCropMode(true, { silentToast: true });
        this.showToast('📑 연속 캡처 켜짐: 드래그마다 슬라이드로 추가되고 이동 상태로 전환됩니다 (단축키 X)');
        return;
      }
      if (this.isPdfCropModeActive) {
        // 드래그 대기 중에 다시 누르면 이동 상태로 전환 (이미 추가한 슬라이드가 없으면 초기 상태로 복귀)
        if (addedCount === 0) {
          this._isPdfBatchCropMode = false;
        }
        this.togglePdfCropMode(false, { silentToast: true });
        this.showToast(addedCount > 0
          ? '✋ 이동 상태: 다음 문제로 옮긴 뒤 [연속 캡처 (X)]를 눌러 계속 추가하세요'
          : '✋ 연속 캡처 꺼짐: 드래그하여 PDF 화면을 이동할 수 있습니다');
      } else {
        this.togglePdfCropMode(true, { silentToast: true });
        this.showToast('📑 문제 영역을 드래그하면 다음 슬라이드로 자동 추가됩니다');
      }
    }

    _clearPdfBatchCropOverlays() {
      const container = (typeof document !== 'undefined') ? document.getElementById('pdfPagesContainer') : null;
      if (!container) return;
      container.querySelectorAll('.pdf-batch-captured-mark').forEach((el) => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }

    _renderPdfBatchCropOverlays() {
      this._clearPdfBatchCropOverlays();
      const recs = Array.isArray(this._pdfBatchSessionRecords) ? this._pdfBatchSessionRecords : [];
      if (recs.length === 0 || !this.pdfDoc) return;
      const curDocUid = this.pdfDoc._graphlyDocUid || '';
      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i];
        if (!rec || !rec.normCrop || !rec.pageNum) continue;
        if (curDocUid && rec.pdfDocUid && rec.pdfDocUid !== curDocUid) continue;
        const wrapper = document.getElementById(`pdfPageWrapper_${rec.pageNum}`);
        if (!wrapper) continue;
        const mark = document.createElement('div');
        mark.className = 'pdf-batch-captured-mark';
        mark.style.left = `${(rec.normCrop.nx * 100).toFixed(3)}%`;
        mark.style.top = `${(rec.normCrop.ny * 100).toFixed(3)}%`;
        mark.style.width = `${(rec.normCrop.nw * 100).toFixed(3)}%`;
        mark.style.height = `${(rec.normCrop.nh * 100).toFixed(3)}%`;
        const badge = document.createElement('span');
        badge.className = 'pdf-batch-captured-badge';
        badge.textContent = `✓ #${rec.slideNum}`;
        mark.appendChild(badge);
        wrapper.appendChild(mark);
      }
    }

    undoLastPdfBatchCrop() {
      const recs = Array.isArray(this._pdfBatchSessionRecords) ? this._pdfBatchSessionRecords : [];
      if (recs.length === 0) return false;
      const removed = recs.pop();
      if (Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0) {
        if (removed && typeof removed.slideIdx === 'number' && removed.slideIdx >= 0 && removed.slideIdx < this.lessonPlaylistSlides.length) {
          this.lessonPlaylistSlides.splice(removed.slideIdx, 1);
        } else {
          this.lessonPlaylistSlides.pop();
        }
        this._renumberDefaultPlaylistSlideTitles();
        if (typeof this._remapPlaylistAudioNextSlideIndices === 'function') {
          this._remapPlaylistAudioNextSlideIndices(this.lessonPlaylistSlides);
        }
      }

      if (recs.length === 0 && this._pdfBatchPreSessionState) {
        const pre = this._pdfBatchPreSessionState;
        if (!pre.audioSegmentFinalized) {
          this.lessonTeachingMode = pre.prevTeachingMode;
          this._isReplacingViaNextCrop = Boolean(pre.prevReplacingFlag);
          this.isLessonPlaylistActive = Boolean(pre.wasPlaylistActive);
          this.lessonPlaylistSlides = Array.isArray(pre.prevSlides) ? this._fastCloneSlideValue(pre.prevSlides) : [];
          this.lessonPlaylistIndex = pre.prevPlaylistIndex || 0;
          if (pre.initialWorkspaceSlide) {
            this.deserializeFullSlideState(pre.initialWorkspaceSlide);
          }
          this._pdfBatchPreSessionState = null;
        } else {
          // 녹음 중 기존 슬라이드가 이미 아카이브 마감된 경우 원래 작업하던 슬라이드 인덱스로 정확히 복원
          const maxValidIdx = Math.max(0, (this.lessonPlaylistSlides ? this.lessonPlaylistSlides.length : 1) - 1);
          const fallbackIdx = (typeof pre.prevPlaylistIndex === 'number') ? pre.prevPlaylistIndex : maxValidIdx;
          this.lessonPlaylistIndex = Math.max(0, Math.min(maxValidIdx, fallbackIdx));
          if (this.lessonPlaylistSlides && this.lessonPlaylistSlides[this.lessonPlaylistIndex]) {
            this.deserializeFullSlideState(this.lessonPlaylistSlides[this.lessonPlaylistIndex]);
          }
        }
        this.syncCloudHubRailLockUI();
      } else if (Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0) {
        this.lessonPlaylistIndex = Math.max(0, this.lessonPlaylistSlides.length - 1);
      }

      this._renderPdfBatchCropOverlays();
      this.syncLessonPlaylistNavBarUI();
      this.syncPdfModalModeUI();
      this.showToast(`↩ 방금 캡처한 #${removed ? removed.slideNum : ''} 슬라이드를 취소했습니다`);
      return true;
    }

    finishPdfBatchCropOrClose() {
      const recs = Array.isArray(this._pdfBatchSessionRecords) ? this._pdfBatchSessionRecords.slice() : [];
      const pre = this._pdfBatchPreSessionState || null;
      const hadFinalizedInModal = Boolean(
        this.isAudioRecording &&
        ((pre && pre.audioSegmentFinalized) || this._alreadyArchivedBeforePdfModal)
      );
      const shouldAutoUnpause = Boolean(this._autoPausedByPdfModal || this._autoPausedByAppBackground);
      const archivedPrevIdx = (pre && typeof pre.prevPlaylistIndex === 'number')
        ? pre.prevPlaylistIndex
        : (typeof this._lastPdfModalArchivedSlideIdx === 'number' ? this._lastPdfModalArchivedSlideIdx : null);

      this._isPdfBatchCropMode = false;
      this._pdfBatchSessionRecords = [];
      this._pdfBatchPreSessionState = null;
      this._clearPdfBatchCropOverlays();

      if (recs.length === 0) {
        // 녹음 중 1번째 캡처로 아카이브했다가 Ctrl+Z로 취소하고 나가는 예외 케이스 보호
        this._isReplacingViaNextCrop = false;
        this._isAudioWaitingForNextSlideSetup = false;
        this._alreadyArchivedBeforePdfModal = false;
        this._lastPdfModalArchivedSlideIdx = null;
        if (hadFinalizedInModal) {
          if (typeof archivedPrevIdx === 'number' && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0) {
            const restoredIdx = Math.max(0, Math.min(this.lessonPlaylistSlides.length - 1, archivedPrevIdx));
            if (this.lessonPlaylistIndex !== restoredIdx) {
              this.lessonPlaylistIndex = restoredIdx;
              if (this.lessonPlaylistSlides[restoredIdx]) {
                this.deserializeFullSlideState(this.lessonPlaylistSlides[restoredIdx]);
              }
            }
          }
          if (shouldAutoUnpause) {
            const pausedDelta = (this.isAudioRecordPaused && this.audioRecordPauseStartMs)
              ? Math.max(0, performance.now() - this.audioRecordPauseStartMs)
              : 0;
            this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + pausedDelta;
            this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
            this._autoPausedByPdfModal = false;
            this._autoPausedByAppBackground = false;
            this._isAudioRecMenuOpen = false;
            this.isAudioRecordPaused = false;
            this.audioRecordPauseStartMs = 0;
          }
          this.closePdfModal({ skipAutoResumeAudio: true });
          if (typeof this._beginNextSlideAudioSegmentAfterSwitch === 'function') {
            this._beginNextSlideAudioSegmentAfterSwitch();
          }
          this.syncLessonPlaylistNavBarUI();
          this.render();
          return;
        }
        this.closePdfModal();
        return;
      }

      this._isReplacingViaNextCrop = false;
      const firstRec = recs[0];
      const targetIdx = (Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0)
        ? Math.max(0, Math.min(this.lessonPlaylistSlides.length - 1, firstRec.slideIdx))
        : 0;
      this.lessonPlaylistIndex = targetIdx;
      this.isLessonPlaylistActive = true;

      if (Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides[targetIdx]) {
        this.deserializeFullSlideState(this.lessonPlaylistSlides[targetIdx]);
      }

      if (hadFinalizedInModal) {
        const isManualPaused = Boolean(this.isAudioRecordPaused && !shouldAutoUnpause);
        if (!isManualPaused && typeof archivedPrevIdx === 'number' && Array.isArray(this.lessonPlaylistSlides)) {
          const prevSlide = this.lessonPlaylistSlides[archivedPrevIdx];
          const tgtSlide = this.lessonPlaylistSlides[targetIdx];
          if (prevSlide && prevSlide.audioSyncData && Array.isArray(prevSlide.audioSyncData.audioSegments) && prevSlide.audioSyncData.audioSegments.length > 0 && tgtSlide) {
            const tgtUid = (typeof this._ensureSlideHasUid === 'function')
              ? this._ensureSlideHasUid(tgtSlide)
              : (tgtSlide.slideUid || '');
            const lastSeg = prevSlide.audioSyncData.audioSegments[prevSlide.audioSyncData.audioSegments.length - 1];
            if (lastSeg && archivedPrevIdx !== targetIdx) {
              lastSeg.nextSlideIdx = targetIdx;
              lastSeg.nextSlideUid = tgtUid;
              lastSeg.nextSlideStartMs = 0;
            }
          }
        }
        if (shouldAutoUnpause) {
          const pausedDelta = (this.isAudioRecordPaused && this.audioRecordPauseStartMs)
            ? Math.max(0, performance.now() - this.audioRecordPauseStartMs)
            : 0;
          this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + pausedDelta;
          this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
          this._autoPausedByPdfModal = false;
          this._autoPausedByAppBackground = false;
          this._isAudioRecMenuOpen = false;
          this.isAudioRecordPaused = false;
          this.audioRecordPauseStartMs = 0;
        }
      }

      this.closePdfModal({ skipAutoResumeAudio: hadFinalizedInModal });

      this._isAudioWaitingForNextSlideSetup = false;
      this._alreadyArchivedBeforePdfModal = false;
      this._lastPdfModalArchivedSlideIdx = null;
      if (hadFinalizedInModal && typeof this._beginNextSlideAudioSegmentAfterSwitch === 'function') {
        this._beginNextSlideAudioSegmentAfterSwitch();
      }

      if (!this.isInkMode && typeof this.toggleInkMode === 'function') {
        this.toggleInkMode(true);
      }
      this.setActiveInkTool('pen');
      this.syncLessonPlaylistNavBarUI();
      this.render();

      if (recs.length === 1) {
        this.showToast(`✂️ p.${firstRec.pageNum} 문제가 고정되었습니다! 문제 위나 빈 캔버스 어디든 바로 필기하세요.`);
      } else {
        this.showToast(`📑 ${recs.length}개 문제를 슬라이드로 추가했습니다! [${targetIdx + 1}번 캔버스]부터 바로 수업하세요.`);
      }
    }

    handlePdfModalKeyDown(e) {
      if (!e || !this.isPdfModalOpen) return false;
      const batchAddedCount = Array.isArray(this._pdfBatchSessionRecords) ? this._pdfBatchSessionRecords.length : 0;

      // 0. PC 설치 버전 스크린 판서 단축키(기본 F9) 호환 유지
      if (
        typeof window !== 'undefined' &&
        window.__GRAPHLY_DESKTOP__ &&
        window.__GRAPHLY_DESKTOP__.isDesktopApp &&
        this.pcScreenAnnotateHotkey &&
        typeof this.normalizeShortcutEventToKey === 'function'
      ) {
        const deskKey = this.normalizeShortcutEventToKey(e);
        if (deskKey && deskKey.toUpperCase() === String(this.pcScreenAnnotateHotkey).trim().toUpperCase()) {
          e.preventDefault();
          if (!e.repeat && typeof this.toggleScreenAnnotateMode === 'function') {
            this.toggleScreenAnnotateMode();
          }
          return true;
        }
      }

      // 1. Escape: 드래그 취소 -> 캡처 대기 해제 -> 모달 닫기(연속 캡처분이 있으면 첫 추가 슬라이드로 복귀)
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.isPdfCropping) {
          this.isPdfCropping = false;
          const cropBox = document.getElementById('pdfCropBox');
          if (cropBox) cropBox.style.display = 'none';
          return true;
        }
        if (this.isPdfCropModeActive) {
          if (batchAddedCount === 0) {
            this._isPdfBatchCropMode = false;
          }
          this.togglePdfCropMode(false, { keepBatchMode: batchAddedCount > 0 });
          return true;
        }
        this.finishPdfBatchCropOrClose();
        return true;
      }

      // 2. Enter: 연속 캡처한 슬라이드가 1개 이상 있을 때 즉시 캔버스로 이동 (헤더 버튼 포커스 중복 클릭 차단)
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (batchAddedCount > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) {
            this.finishPdfBatchCropOrClose();
          }
          return true;
        }
        return false;
      }

      // 3. Ctrl+Z / Cmd+Z: 방금 추가한 연속 캡처 슬라이드 취소 (뒤쪽 칠판 Undo 오작동 원천 차단)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (!e.repeat && batchAddedCount > 0) {
          this.undoLastPdfBatchCrop();
        }
        return true;
      }

      // 4. 페이지 이동: PageUp / PageDown / [ / ]
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'PageUp' || e.key === '[') {
          e.preventDefault();
          this.scrollToPdfPage((this.pdfCurrentPage || 1) - 1);
          return true;
        }
        if (e.key === 'PageDown' || e.key === ']') {
          e.preventDefault();
          this.scrollToPdfPage((this.pdfCurrentPage || 1) + 1);
          return true;
        }
      }

      // 5. X 키: PDF 창 전용 [연속 캡처] 즉시 켜기 / 전환 (한/영 상태 무관 물리 키코드 인식)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.code === 'KeyX' || e.key === 'x' || e.key === 'X')) {
        if (this.lessonTeachingMode !== 'page') {
          e.preventDefault();
          if (!e.repeat) {
            this.handleBatchPdfCropButtonClick();
          }
          return true;
        }
      }

      // 6. C 키(또는 사용자 지정 파일열기/캡처 키) 및 줌(+ / -) / 전체화면 단축키 연동
      const pressedKey = (typeof this.normalizeShortcutEventToKey === 'function')
        ? this.normalizeShortcutEventToKey(e)
        : '';
      if (pressedKey) {
        const eff = (typeof this._getEffectiveShortcutsMap === 'function')
          ? this._getEffectiveShortcutsMap(this.customShortcuts)
          : null;
        const pUpper = pressedKey.toUpperCase();
        const cropKey = String((eff && eff.pdf_open_or_crop) || 'C').trim().toUpperCase();
        const zoomInKey = String((eff && eff.sys_zoom_in) || '=').trim().toUpperCase();
        const zoomOutKey = String((eff && eff.sys_zoom_out) || '-').trim().toUpperCase();
        const fsKey = String((eff && eff.sys_fullscreen_toggle) || '').trim().toUpperCase();

        if (cropKey && pUpper === cropKey && this.lessonTeachingMode !== 'page') {
          e.preventDefault();
          if (!e.repeat) {
            if (this._isPdfBatchCropMode || batchAddedCount > 0) {
              this.handleBatchPdfCropButtonClick();
            } else {
              this.handleSinglePdfCropButtonClick();
            }
          }
          return true;
        }

        const isZoomIn = (zoomInKey && pUpper === zoomInKey) || (pUpper === 'SHIFT+=' && zoomInKey === '=');
        const isZoomOut = (zoomOutKey && pUpper === zoomOutKey) || (pUpper === 'SHIFT+-' && zoomOutKey === '-');
        if (isZoomIn || isZoomOut) {
          e.preventDefault();
          if (e.repeat && this._lastZoomKeyRepeatAt && (performance.now() - this._lastZoomKeyRepeatAt) < 75) {
            return true;
          }
          this._lastZoomKeyRepeatAt = performance.now();
          const btnPdf = document.getElementById(isZoomIn ? 'btnPdfZoomIn' : 'btnPdfZoomOut');
          if (btnPdf) btnPdf.click();
          return true;
        }

        if (fsKey && pUpper === fsKey) {
          if (!(typeof document !== 'undefined' && document.body && document.body.classList.contains('ios-standalone-pwa'))) {
            const btnFs = document.getElementById('btnFullscreen');
            if (btnFs) {
              e.preventDefault();
              if (!e.repeat) btnFs.click();
              return true;
            }
          }
        }
      }

      // 7. 스페이스바 입력 시 포커스된 헤더 버튼이 의도치 않게 재클릭되는 현상만 방지하고 부드럽게 뷰포트 스크롤 지원
      if ((e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeEl = (typeof document !== 'undefined') ? document.activeElement : null;
        if (activeEl && activeEl.tagName === 'BUTTON') {
          try { activeEl.blur(); } catch (_) { }
        }
        const vp = (typeof document !== 'undefined') ? document.getElementById('pdfViewport') : null;
        if (vp) {
          e.preventDefault();
          const dir = e.shiftKey ? -1 : 1;
          vp.scrollTop += Math.round(vp.clientHeight * 0.72) * dir;
          this.savedPdfScrollTop = vp.scrollTop;
        }
        return true;
      }

      return false;
    }

    async appendNextPdfPageSlide() {
      if (!this.pdfDoc && (!this._cachedPdfBytes || !this._cachedPdfBytes.byteLength)) {
        const cachedRec = await this._loadLastPdfFromIndexedDB();
        if (cachedRec && cachedRec.bytes) {
          const rawBytes = cachedRec.bytes;
          const normBytes = rawBytes instanceof Uint8Array
            ? rawBytes
            : (rawBytes instanceof ArrayBuffer ? new Uint8Array(rawBytes) : (rawBytes && rawBytes.buffer ? new Uint8Array(rawBytes.buffer) : null));
          if (normBytes && normBytes.byteLength > 0) {
            this._cachedPdfBytes = normBytes;
            if (cachedRec.fileName && !this.pdfFileName) this.pdfFileName = cachedRec.fileName;
          }
        }
      }
      if (!this.pdfDoc && this._cachedPdfBytes && this._cachedPdfBytes.byteLength > 0) {
        await this.loadPdfFromArrayBuffer(this._cachedPdfBytes, this.pdfFileName || '교재.pdf', { preserveScroll: true, skipIdbSave: true });
        this.closePdfModal();
      }
      if (!this.pdfDoc) {
        this.showToast('⚠️ 먼저 PDF 문서를 열어주세요.');
        return;
      }
      this.setLessonTeachingMode('page');
      let basePage = 0;
      const activePdfBoard = this.pdfPageBoardData || (this._suspendedPdfBoardState && this._suspendedPdfBoardState.pdfPageBoardData) || null;
      if (activePdfBoard && typeof activePdfBoard.pageNum === 'number') {
        basePage = activePdfBoard.pageNum;
      } else if (Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0) {
        for (let i = Math.min(this.lessonPlaylistIndex, this.lessonPlaylistSlides.length - 1); i >= 0; i--) {
          const s = this.lessonPlaylistSlides[i];
          if (s && s.pdfPageBoardData && typeof s.pdfPageBoardData.pageNum === 'number') {
            basePage = s.pdfPageBoardData.pageNum;
            break;
          }
        }
        if (!basePage) {
          for (let i = this.lessonPlaylistSlides.length - 1; i >= 0; i--) {
            const s = this.lessonPlaylistSlides[i];
            if (s && s.pdfPageBoardData && typeof s.pdfPageBoardData.pageNum === 'number') {
              basePage = s.pdfPageBoardData.pageNum;
              break;
            }
          }
        }
      }
      if (!basePage) {
        basePage = this.pdfCurrentPage || 1;
      }
      const total = this.pdfTotalPages || this.pdfDoc.numPages || 1;
      const nextPage = basePage + 1;
      if (nextPage > total) {
        this.showToast(`📄 마지막 페이지(p.${total})입니다.`);
        return;
      }
      if (typeof this.canAddMoreSlidesWithQuota === 'function' && (this.isLessonPlaylistActive || this.hasAnyWorkspaceContent()) && !this.canAddMoreSlidesWithQuota(1)) {
        return;
      }
      this._isReplacingViaNextCrop = true;
      await this.openPdfPageOnBoard(nextPage);
      this.showToast(`📄 새 캔버스에 다음 페이지(p.${nextPage})를 열었습니다!`);
    }

    openPdfModal(isInitialLoad = false, autoCropMode = false) {
      const modal = document.getElementById('modalPdfViewer');
      if (modal) {
        const wasAlreadyOpen = Boolean(this.isPdfModalOpen);
        // 닫혀 있다가 새로 열리는 세션이면 연속 캡처 기록을 초기화하고,
        // 이미 열린 상태에서 [다른 파일 열기]로 이어 여는 경우에는 진행 중인 연속 캡처 기록을 보존합니다.
        if (!wasAlreadyOpen) {
          this._isPdfBatchCropMode = false;
          this._pdfBatchSessionRecords = [];
          this._pdfBatchPreSessionState = null;
          this._alreadyArchivedBeforePdfModal = false;
          this._lastPdfModalArchivedSlideIdx = null;
          this._clearPdfBatchCropOverlays();
        } else if (!Array.isArray(this._pdfBatchSessionRecords) || this._pdfBatchSessionRecords.length === 0) {
          this._isPdfBatchCropMode = false;
          this._clearPdfBatchCropOverlays();
        }
        // 🌟 [핵심: 다음 캡처 / PDF 모달 진입 순간 자동 녹화 컷 & 대기 엔진]:
        // 녹음 중 [다음 캡처]를 눌러 PDF 창에 들어가는 즉시 이전 슬라이드 녹화를 종료(저장)하고,
        // PDF에서 문제를 고르는 동안에는 음성 녹음과 포인터 추적을 100% 중단하여 허공 포인터/공백 녹음을 원천 차단합니다!
        if (this.isAudioRecording && !this.isAudioRecordPaused) {
          if (typeof this._flushRecorderBootHoldIfActive === 'function') {
            this._flushRecorderBootHoldIfActive(true, true);
          }
          if (!this.isPdfModalOpen && !this._isPausedStandbyOnSlide && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
          this._autoPausedByPdfModal = true;
          if (typeof this._releaseAudioRecordWakeLock === 'function') this._releaseAudioRecordWakeLock();
          this.isAudioRecordPaused = true;
          this.audioRecordPauseStartMs = performance.now();
          if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'recording') {
            try {
              if (typeof this.audioMediaRecorder.requestData === 'function') this.audioMediaRecorder.requestData();
            } catch (e) { }
            try { this.audioMediaRecorder.pause(); } catch (e) { }
          }
          this.syncAudioRecordUI();
        }
        this._stopPdfViewportInertia();
        this._clearPdfViewerPinchPreviewTransforms();
        if (this._pdfTouchPointers) this._pdfTouchPointers.clear();
        modal.style.display = 'flex';
        document.body.classList.add('pdf-modal-open');
        this.isPdfModalOpen = true;
        this._lastPdfModalOpenAt = performance.now();
        const inputRangeSpec = document.getElementById('inputPdfPageRangeSpec');
        if (inputRangeSpec) {
          inputRangeSpec.value = '';
        }

        // 🛑 [백그라운드 메인 칠판/그래프 루프 100% 일시정지 (Freeze)]:
        // PDF 뷰어가 열려 있는 동안에는 뒤쪽 칠판의 requestAnimationFrame 루프를 즉시 정지시켜 CPU/GPU 자원을 100% 뷰어에 집중!
        if (this.pulseAnimId) {
          cancelAnimationFrame(this.pulseAnimId);
          this.pulseAnimId = null;
        }
        if (this.intersectionAnimId) {
          cancelAnimationFrame(this.intersectionAnimId);
          this.intersectionAnimId = null;
        }
        if (this._mainLaserRafId) {
          cancelAnimationFrame(this._mainLaserRafId);
          this._mainLaserRafId = null;
        }

        const allowCrop = (this.lessonTeachingMode !== 'page') && Boolean(autoCropMode);
        this.togglePdfCropMode(allowCrop, {
          silentToast: !allowCrop,
          keepBatchMode: Boolean(wasAlreadyOpen && this._isPdfBatchCropMode)
        });
        this.syncPdfModalModeUI();
        if (this.pdfDoc && !isInitialLoad) {
          const container = document.getElementById('pdfPagesContainer');
          const viewport = document.getElementById('pdfViewport');
          if (!container || container.children.length === 0) {
            this.renderAllPdfPages(true);
          } else if (viewport) {
            this._renderPdfBatchCropOverlays();
            // 🌟 [핵심 개선]: 다시 크롭을 눌렀을 때 문서 맨 처음으로 올라가지 않고 직전에 보던 스크롤 위치 그대로 100% 복원!
            const targetTop = (typeof this.savedPdfScrollTop === 'number') ? this.savedPdfScrollTop : viewport.scrollTop;
            const targetLeft = (typeof this.savedPdfScrollLeft === 'number') ? this.savedPdfScrollLeft : viewport.scrollLeft;
            viewport.scrollTop = targetTop;
            viewport.scrollLeft = targetLeft;
            requestAnimationFrame(() => {
              viewport.scrollTop = targetTop;
              viewport.scrollLeft = targetLeft;
              if (typeof this._schedulePdfModalHiResTile === 'function') {
                this._schedulePdfModalHiResTile(90);
              }
            });
            this.renderVisiblePdfWindow(this.pdfCurrentPage || 1, false);
          }
        }
      }
    }

    _flushPendingPdfIdbSaveIfIdle(forceNow = false) {
      const payload = this._pendingPdfIdbSavePayload;
      if (!payload || !payload.bytes) return;
      if (
        !forceNow &&
        this.isPdfModalOpen &&
        (this._pdfPinchState || this._isPdfModalFastScrolling || this._isPdfViewportPanning || this._pdfViewportInertiaRaf)
      ) {
        if (this._deferredIdbSaveTimer) clearTimeout(this._deferredIdbSaveTimer);
        this._deferredIdbSaveTimer = setTimeout(() => {
          this._deferredIdbSaveTimer = null;
          this._flushPendingPdfIdbSaveIfIdle(false);
        }, 3000);
        return;
      }
      this._pendingPdfIdbSavePayload = null;
      if (this._deferredIdbSaveTimer) {
        clearTimeout(this._deferredIdbSaveTimer);
        this._deferredIdbSaveTimer = null;
      }
      this._saveLastPdfToIndexedDB(payload.bytes, payload.fileName);
    }

    _clearPdfViewerPinchPreviewTransforms() {
      if (this._pdfPinchMoveRaf) {
        cancelAnimationFrame(this._pdfPinchMoveRaf);
        this._pdfPinchMoveRaf = null;
      }
      const st = this._pdfPinchState;
      this._pdfPinchState = null;
      if (st && Array.isArray(st.previewItems)) {
        for (let i = 0; i < st.previewItems.length; i++) {
          const el = st.previewItems[i] && st.previewItems[i].el;
          if (el) {
            el.style.transform = '';
            el.style.transformOrigin = '';
            el.style.willChange = '';
          }
        }
      }
      const vp = (typeof document !== 'undefined') ? document.getElementById('pdfViewport') : null;
      if (vp) vp.classList.remove('pinching-gpu');
    }

    _cancelAndTrimHiddenPdfModalPages() {
      if (typeof this._cancelActivePdfModalRenderJob === 'function') {
        this._cancelActivePdfModalRenderJob(true);
      }
      if (typeof this._invalidatePdfModalHiResTile === 'function') {
        this._invalidatePdfModalHiResTile(true);
      }
      const container = (typeof document !== 'undefined') ? document.getElementById('pdfPagesContainer') : null;
      if (!container) return;
      const keepCenter = this.pdfCurrentPage || 1;
      // 통PDF('page') 모드 진입 시에는 편집 화면 Safari VRAM 보호를 위해 전체 해제하고,
      // 영역 캡처('crop'/미정) 동선에서는 현재 보던 페이지 딱 1장만 유지하여 재진입 백지 랙·깜빡임 차단!
      const releaseAllHidden = Boolean(this.lessonTeachingMode === 'page');
      const canvases = container.querySelectorAll('.pdf-page-canvas');
      for (let i = 0; i < canvases.length; i++) {
        const cv = canvases[i];
        if (!cv) continue;
        if (cv._pdfRenderTask && typeof cv._pdfRenderTask.cancel === 'function') {
          try { cv._pdfRenderTask.cancel(); } catch (e) { }
          cv._pdfRenderTask = null;
        }
        if (cv._pdfStagingCanvas) {
          try {
            cv._pdfStagingCanvas.width = 0;
            cv._pdfStagingCanvas.height = 0;
          } catch (e) { }
          cv._pdfStagingCanvas = null;
        }
        cv._isRenderingPdfPage = false;
        cv._renderingZoom = null;

        const pNum = parseInt((cv.id || '').replace('pdfPageCanvas_', ''), 10);
        const shouldTrim = releaseAllHidden ? Boolean(pNum) : Boolean(pNum && Math.abs(pNum - keepCenter) > 0);
        if (shouldTrim && (cv.width > 4 || (this.pdfPageRenderStates && this.pdfPageRenderStates[pNum]))) {
          try {
            cv.width = 1;
            cv.height = 1;
          } catch (e) { }
          cv._renderedZoom = null;
          cv._renderedScale = null;
          cv._hitMaxCap = false;
          if (this.pdfPageRenderStates) delete this.pdfPageRenderStates[pNum];
        }
      }
    }

    closePdfModal(options = null) {
      const skipAutoResumeAudio = Boolean(options && options.skipAutoResumeAudio);
      const hadPendingFinalizedBeforeClose = Boolean(
        !skipAutoResumeAudio &&
        this.isAudioRecording &&
        ((this._pdfBatchPreSessionState && this._pdfBatchPreSessionState.audioSegmentFinalized) || this._alreadyArchivedBeforePdfModal)
      );
      this._stopPdfViewportInertia();
      this._clearPdfViewerPinchPreviewTransforms();
      if (this._pdfTouchPointers) this._pdfTouchPointers.clear();
      this._isPdfBatchCropMode = false;
      this._pdfBatchSessionRecords = [];
      this._pdfBatchPreSessionState = null;
      if (!skipAutoResumeAudio) {
        this._isAudioWaitingForNextSlideSetup = false;
        this._alreadyArchivedBeforePdfModal = false;
        this._lastPdfModalArchivedSlideIdx = null;
      }
      this._clearPdfBatchCropOverlays();
      const viewport = document.getElementById('pdfViewport');
      if (viewport && this.isPdfModalOpen) {
        this.savedPdfScrollTop = viewport.scrollTop;
        this.savedPdfScrollLeft = viewport.scrollLeft;
      }
      this._savePdfViewStateMeta();
      const modal = document.getElementById('modalPdfViewer');
      if (modal) {
        modal.style.display = 'none';
        this.isPdfModalOpen = false;
        document.body.classList.remove('pdf-modal-open');
        this.togglePdfCropMode(false, { silentToast: true });
      }
      this._cancelAndTrimHiddenPdfModalPages();
      if (this._pendingPdfIdbSavePayload) {
        if (this._deferredIdbSaveTimer) clearTimeout(this._deferredIdbSaveTimer);
        this._deferredIdbSaveTimer = setTimeout(() => {
          this._deferredIdbSaveTimer = null;
          this._flushPendingPdfIdbSaveIfIdle(true);
        }, 350);
      }
      if (this._uiPointerIds) this._uiPointerIds.clear();
      this.updateInkCursor();
      // PDF 뷰어 닫힘 즉시 메인 칠판 루프 및 화면 복원
      if (this.useIntersectionDetector) {
        this.startIntersectionLoop();
      }
      if (this.selectedHandleIdx !== null) {
        this.startPulseLoop();
      }
      this.requestRender();
      if (hadPendingFinalizedBeforeClose) {
        const shouldAutoUnpauseDirect = Boolean(this._autoPausedByPdfModal || this._autoPausedByAppBackground);
        if (shouldAutoUnpauseDirect) {
          const pausedDelta = (this.isAudioRecordPaused && this.audioRecordPauseStartMs)
            ? Math.max(0, performance.now() - this.audioRecordPauseStartMs)
            : 0;
          this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + pausedDelta;
          this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
          this._autoPausedByPdfModal = false;
          this._autoPausedByAppBackground = false;
          this._isAudioRecMenuOpen = false;
          this.isAudioRecordPaused = false;
          this.audioRecordPauseStartMs = 0;
        }
        if (typeof this._beginNextSlideAudioSegmentAfterSwitch === 'function') {
          this._beginNextSlideAudioSegmentAfterSwitch();
        }
        return;
      }
      // 만약 PDF 창을 열었다가 자동 일시정지된 상태(_autoPausedByPdfModal)에서 돌아온 경우 즉시 녹화 재개!
      if (!skipAutoResumeAudio && this.isAudioRecording && this._autoPausedByPdfModal) {
        this._autoPausedByPdfModal = false;
        if (this.isAudioRecordPaused) {
          const pausedDelta = Math.max(0, performance.now() - (this.audioRecordPauseStartMs || performance.now()));
          this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + pausedDelta;
          this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
          this.isAudioRecordPaused = false;
          this.audioRecordPauseStartMs = 0;
          if (typeof this._resumeOrRolloverAudioRecorderAfterPause === 'function') {
            this._resumeOrRolloverAudioRecorderAfterPause();
          } else if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'paused') {
            try { this.audioMediaRecorder.resume(); } catch (e) { }
          }
        }
        const canInitInitialState = !this.audioInitialState || (
          this.getAudioRecordElapsedMs() < 400 &&
          (!this.audioTimeline || this.audioTimeline.length <= 1) &&
          (this._resumedSlideBaseOffsetMs || 0) === 0
        );
        if (canInitInitialState) {
          this.audioInitialState = this._captureAudioWorkspaceKeyframe();
        }
        this._recordAudioWorkspaceStateIfNeeded(true);
        this.syncAudioRecordUI();
      }
    }

    // ==========================================================================
    // [📄 PDF 페이지 통째 칠판 모드 (Concept Page Board Mode) & 좌상단 p.N 자동 접기 엔진]
    // ==========================================================================
    syncPdfBoardNavBarUI() {
      // 🌟 [상단 슬라이드 바 100% 일원화]:
      // PDF 한 페이지 통째 삽입 시에도 별도의 #pdfBoardNavBar(📄 p.1/10)를 띄우지 않고,
      // 모든 슬라이드(문제 캡처, PDF 통째 페이지, 백지/그래프)를 단일 #lessonPlaylistNavBar(📑 1 / 2)로 일원화합니다!
      const bar = document.getElementById('pdfBoardNavBar');
      if (bar) bar.style.display = 'none';
      const gridPop = document.getElementById('pdfBoardGridPopover');
      if (gridPop) gridPop.style.display = 'none';
      if (typeof this.syncLessonPlaylistNavBarUI === 'function') {
        this.syncLessonPlaylistNavBarUI();
      } else {
        this._syncTopSlideMiniTabUI();
      }
    }

    // 🛡️ [아이패드 Safari RAM 보호용 고해상도 PDF 캔버스 최대 6장 LRU 캐시 엔진]
    _isValidPdfBoardCanvas(cv) {
      return Boolean(cv && typeof cv.getContext === 'function' && !cv._evicted && cv.width > 4 && cv.height > 4);
    }

    _getPdfBoardCacheKey(pageNum, dataUrl = '', pdfDocUid = '', srcPageNum = 0) {
      if (pdfDocUid) {
        return `uid_${pdfDocUid}_${srcPageNum || pageNum || 1}`;
      }
      if (this._pdfPageCanvasCacheDoc && this.pdfDoc && this._pdfPageCanvasCacheDoc === this.pdfDoc && pageNum) {
        return `doc_${pageNum}`;
      }
      if (typeof dataUrl === 'string' && dataUrl.length > 64) {
        return `url_${dataUrl.length}_${dataUrl.slice(-48)}`;
      }
      if (pageNum) {
        return `page_${pageNum}`;
      }
      return '';
    }

    _getPdfPageCanvasFromCache(pageNum, dataUrl = '', pdfDocUid = '', srcPageNum = 0) {
      if (!this._pdfPageCanvasCache) return null;
      const key = this._getPdfBoardCacheKey(pageNum, dataUrl, pdfDocUid, srcPageNum);
      let cv = (key && this._pdfPageCanvasCache[key]) ||
        ((!pdfDocUid && this._pdfPageCanvasCacheDoc && this.pdfDoc && this._pdfPageCanvasCacheDoc === this.pdfDoc && pageNum) ? this._pdfPageCanvasCache[pageNum] : null);
      if (!this._isValidPdfBoardCanvas(cv)) {
        if (key && this._pdfPageCanvasCache[key]) delete this._pdfPageCanvasCache[key];
        if (!pdfDocUid && pageNum && this._pdfPageCanvasCache[pageNum] === cv) delete this._pdfPageCanvasCache[pageNum];
        return null;
      }
      if (key) {
        if (!Array.isArray(this._pdfPageCanvasCacheOrder)) this._pdfPageCanvasCacheOrder = [];
        const existingIdx = this._pdfPageCanvasCacheOrder.indexOf(key);
        if (existingIdx !== -1) this._pdfPageCanvasCacheOrder.splice(existingIdx, 1);
        this._pdfPageCanvasCacheOrder.push(key);
      }
      return cv;
    }

    _putPdfPageCanvasInCache(pageNum, pageCanvas, dataUrl = '', pdfDocUid = '', srcPageNum = 0) {
      if (!this._isValidPdfBoardCanvas(pageCanvas)) return;
      if (!this._pdfPageCanvasCache) this._pdfPageCanvasCache = {};
      if (!Array.isArray(this._pdfPageCanvasCacheOrder)) this._pdfPageCanvasCacheOrder = [];
      const hasLiveVec = Boolean(pdfDocUid && this._hasLivePdfSourceForBoard({ pdfDocUid }));
      if (!pageCanvas._cachedDataUrl) {
        pageCanvas._cachedDataUrl = (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/'))
          ? dataUrl
          : (hasLiveVec ? '' : this.encodeCanvasSmartWebP(pageCanvas, 0.88));
      }
      const key = this._getPdfBoardCacheKey(pageNum, pageCanvas._cachedDataUrl, pdfDocUid, srcPageNum);
      if (!key) return;
      this._pdfPageCanvasCache[key] = pageCanvas;
      if (this._pdfPageCanvasCacheDoc && this.pdfDoc && this._pdfPageCanvasCacheDoc === this.pdfDoc && (!pdfDocUid || this.pdfDoc._graphlyDocUid === pdfDocUid) && pageNum) {
        this._pdfPageCanvasCache[pageNum] = pageCanvas;
      }
      const existingIdx = this._pdfPageCanvasCacheOrder.indexOf(key);
      if (existingIdx !== -1) this._pdfPageCanvasCacheOrder.splice(existingIdx, 1);
      this._pdfPageCanvasCacheOrder.push(key);

      const isIOSDevice = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
      const MAX_CACHED_PDF_CANVASES = isIOSDevice ? 2 : 5;
      const activeCv = (this.pdfPageBoardData && this.pdfPageBoardData.canvas) || null;
      const suspendedCv = (this._suspendedPdfBoardState && this._suspendedPdfBoardState.pdfPageBoardData && this._suspendedPdfBoardState.pdfPageBoardData.canvas) || null;
      let guard = 0;
      while (this._pdfPageCanvasCacheOrder.length > MAX_CACHED_PDF_CANVASES && guard < 24) {
        guard++;
        let evictIdx = 0;
        for (let i = 0; i < this._pdfPageCanvasCacheOrder.length; i++) {
          const candidateKey = this._pdfPageCanvasCacheOrder[i];
          const candidateCv = this._pdfPageCanvasCache[candidateKey];
          if (candidateKey !== key && candidateCv !== activeCv && candidateCv !== suspendedCv) {
            evictIdx = i;
            break;
          }
        }
        const evictKey = this._pdfPageCanvasCacheOrder.splice(evictIdx, 1)[0];
        if (!evictKey || evictKey === key) continue;
        const oldCv = this._pdfPageCanvasCache[evictKey];
        delete this._pdfPageCanvasCache[evictKey];
        if (oldCv) {
          Object.keys(this._pdfPageCanvasCache).forEach((k) => {
            if (this._pdfPageCanvasCache[k] === oldCv) delete this._pdfPageCanvasCache[k];
          });
          if (oldCv !== activeCv && oldCv !== suspendedCv) {
            oldCv._evicted = true;
            if (oldCv._mipCanvas) {
              try {
                oldCv._mipCanvas.width = 1;
                oldCv._mipCanvas.height = 1;
              } catch (e) { }
              oldCv._mipCanvas = null;
            }
            try {
              oldCv.width = 1;
              oldCv.height = 1;
            } catch (e) { }
          }
        }
      }
    }

    _ensurePdfBoardCanvasFromDataUrl(pbd) {
      if (!pbd) return Promise.resolve(null);
      if (this._isValidPdfBoardCanvas(pbd.canvas)) {
        return Promise.resolve(pbd.canvas);
      }
      pbd.canvas = null;
      const srcPageNum = pbd.pdfSourcePageNum || pbd.pageNum || 1;
      const cached = this._getPdfPageCanvasFromCache(pbd.pageNum, pbd.dataUrl, pbd.pdfDocUid || '', srcPageNum);
      if (cached) {
        pbd.canvas = cached;
        return Promise.resolve(cached);
      }
      if (pbd._loadingPromise) return pbd._loadingPromise;

      if (pbd.pdfDocUid && this._hasLivePdfSourceForBoard(pbd)) {
        const inflightKey = `uid_${pbd.pdfDocUid}_${srcPageNum}`;
        if (!this._pdfPageInflightRenderMap) this._pdfPageInflightRenderMap = new Map();
        pbd._loadingPromise = (async () => {
          try {
            let sharedPromise = this._pdfPageInflightRenderMap.get(inflightKey);
            if (!sharedPromise) {
              sharedPromise = (async () => {
                const liveDoc = await this._getOrWaitLivePdfDocForUid(pbd.pdfDocUid);
                if (!liveDoc) return null;
                const existingCv = this._getPdfPageCanvasFromCache(pbd.pageNum, pbd.dataUrl, pbd.pdfDocUid || '', srcPageNum);
                if (existingCv) return existingCv;
                const offC = await this._renderPdfDocPageToCanvas(liveDoc, srcPageNum, 2800);
                if (offC) {
                  offC._cachedDataUrl = pbd.dataUrl || '';
                  try {
                    const mipC = document.createElement('canvas');
                    mipC.width = Math.max(1, Math.round(offC.width * 0.5));
                    mipC.height = Math.max(1, Math.round(offC.height * 0.5));
                    const mipCtx = mipC.getContext('2d');
                    if (mipCtx) {
                      mipCtx.imageSmoothingEnabled = true;
                      mipCtx.imageSmoothingQuality = 'high';
                      mipCtx.drawImage(offC, 0, 0, mipC.width, mipC.height);
                    }
                    offC._mipCanvas = mipC;
                  } catch (_) { }
                  this._putPdfPageCanvasInCache(pbd.pageNum, offC, pbd.dataUrl || '', pbd.pdfDocUid || '', srcPageNum);
                }
                return offC || null;
              })().finally(() => {
                if (this._pdfPageInflightRenderMap) this._pdfPageInflightRenderMap.delete(inflightKey);
              });
              this._pdfPageInflightRenderMap.set(inflightKey, sharedPromise);
            }
            const resolvedCv = await sharedPromise;
            if (resolvedCv && !this._isValidPdfBoardCanvas(pbd.canvas)) {
              pbd.canvas = resolvedCv;
              pbd.pixelW = resolvedCv.width;
              pbd.pixelH = resolvedCv.height;
            }
            this.requestRender();
            return pbd.canvas || null;
          } finally {
            pbd._loadingPromise = null;
          }
        })();
        return pbd._loadingPromise;
      }

      if (!pbd.dataUrl || typeof Image === 'undefined') {
        return Promise.resolve(null);
      }
      pbd._loadingPromise = new Promise((resolve) => {
        const imgObj = new Image();
        imgObj.onload = () => {
          pbd._loadingPromise = null;
          if (!this._isValidPdfBoardCanvas(pbd.canvas)) {
            const offC = document.createElement('canvas');
            offC.width = imgObj.naturalWidth || pbd.pixelW || 1200;
            offC.height = imgObj.naturalHeight || pbd.pixelH || 1680;
            const offCtx = offC.getContext('2d');
            if (offCtx) {
              offCtx.drawImage(imgObj, 0, 0);
            }
            offC._cachedDataUrl = pbd.dataUrl;
            try {
              const mipC = document.createElement('canvas');
              mipC.width = Math.max(1, Math.round(offC.width * 0.5));
              mipC.height = Math.max(1, Math.round(offC.height * 0.5));
              const mipCtx = mipC.getContext('2d');
              if (mipCtx) {
                mipCtx.imageSmoothingEnabled = true;
                mipCtx.imageSmoothingQuality = 'high';
                mipCtx.drawImage(offC, 0, 0, mipC.width, mipC.height);
              }
              offC._mipCanvas = mipC;
            } catch (e) { }
            pbd.canvas = offC;
            pbd.pixelW = offC.width;
            pbd.pixelH = offC.height;
            this._putPdfPageCanvasInCache(pbd.pageNum, offC, pbd.dataUrl, pbd.pdfDocUid || '', srcPageNum);
          }
          this.requestRender();
          resolve(pbd.canvas);
        };
        imgObj.onerror = () => {
          pbd._loadingPromise = null;
          resolve(null);
        };
        imgObj.src = pbd.dataUrl;
        pbd.img = imgObj;
      });
      return pbd._loadingPromise;
    }

    drawPdfPageBoardLayer(ctx, isExport = false) {
      if (this.pdfPageBoardData && this.pdfPageBoardData.canvas && !this._isValidPdfBoardCanvas(this.pdfPageBoardData.canvas)) {
        this.pdfPageBoardData.canvas = null;
        this._ensurePdfBoardCanvasFromDataUrl(this.pdfPageBoardData);
      }
      const hasExportOverride = Boolean(
        isExport &&
        this._exportPdfHiResOverride &&
        this._exportPdfHiResOverride.canvas &&
        this._exportPdfHiResOverride.canvas.width > 2
      );
      const pageCanvas = this.pdfPageBoardData && (
        (this._isValidPdfBoardCanvas(this.pdfPageBoardData.canvas) ? this.pdfPageBoardData.canvas : null) ||
        (this.pdfPageBoardData.img && this.pdfPageBoardData.img.complete && this.pdfPageBoardData.img.naturalWidth > 0 ? this.pdfPageBoardData.img : null)
      );
      if (!this.pdfPageBoardData || (!pageCanvas && !hasExportOverride)) {
        if (this.pdfPageBoardData && !this.pdfPageBoardData.canvas && (this.pdfPageBoardData.dataUrl || this.pdfPageBoardData.pdfDocUid)) {
          this._ensurePdfBoardCanvasFromDataUrl(this.pdfPageBoardData);
        }
        this._lastPdfPageScreenRect = null;
        return;
      }
      const { mathW, mathH } = this.pdfPageBoardData;
      const cx = this.pdfPageBoardData.centerX || 0;
      const cy = this.pdfPageBoardData.centerY || 0;
      const tl = this.mathToScreen(cx - mathW / 2, cy + mathH / 2);
      const br = this.mathToScreen(cx + mathW / 2, cy - mathH / 2);
      const x = Math.min(tl.x, br.x);
      const y = Math.min(tl.y, br.y);
      const w = Math.abs(br.x - tl.x);
      const h = Math.abs(br.y - tl.y);
      if (w < 2 || h < 2) {
        this._lastPdfPageScreenRect = null;
        return;
      }
      this._lastPdfPageScreenRect = { x, y, w, h };

      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.white_paper;
      const isLight = Boolean(curTheme.isLight || this.isMonochromeMode);

      // 🚀 [구형 내장그래픽(Intel HD/UHD) 60fps 무손실 가속 & 정지 시 캡처모드급 초고화질 렌더링]:
      // 카메라가 이동·줌인 중일 때만 경량 Mipmap 텍스처 + 하드웨어 이중선형 보간('medium')으로 랙을 0%로 방어하며,
      // 이동이 멈추는 즉시(정지·판서·내보내기 시) 0.00초 만에 원본 초고해상도(3.4x~4.2x) 캔버스 + 최고 화질('high')로 복원합니다!
      const isActivelyMovingCamera = !isExport && Boolean(
        this.isPanning ||
        this.isBoardPanning ||
        this._isZoomAnimating ||
        this._pinchState ||
        this._isWheelZooming
      );
      const isActivelyInkingAny = !isExport && Boolean(this.isDrawingInk || this.isStylusDrawing || this._isDrawingCardInk);
      const snapToCssPixel = !isExport && !isActivelyMovingCamera;
      const drawX = snapToCssPixel ? Math.round(x) : x;
      const drawY = snapToCssPixel ? Math.round(y) : y;
      const drawW = snapToCssPixel ? Math.round(w) : w;
      const drawH = snapToCssPixel ? Math.round(h) : h;
      const effDpr = (typeof this.getCanvasDpr === 'function')
        ? this.getCanvasDpr()
        : Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 2.0));
      const canUseMipWithoutBlur = Boolean(
        isActivelyMovingCamera &&
        pageCanvas &&
        pageCanvas._mipCanvas &&
        pageCanvas._mipCanvas.width > 4 &&
        (drawW * effDpr) <= (pageCanvas._mipCanvas.width * 1.15)
      );
      const sourceTex = canUseMipWithoutBlur ? pageCanvas._mipCanvas : pageCanvas;

      if (isActivelyMovingCamera || isActivelyInkingAny) {
        this._cancelPdfBoardHiResTilePending();
      }

      const isLiveMainCanvas = Boolean(!isExport && ctx === this.ctx && !this._isRenderingGraphSnapshot);
      const sw = Math.max(1, this.screenWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280) || 1280);
      const sh = Math.max(1, this.screenHeight || (typeof window !== 'undefined' ? window.innerHeight : 720) || 720);
      const visL = isLiveMainCanvas ? Math.max(0, drawX) : drawX;
      const visT = isLiveMainCanvas ? Math.max(0, drawY) : drawY;
      const visR = isLiveMainCanvas ? Math.min(sw, drawX + drawW) : (drawX + drawW);
      const visB = isLiveMainCanvas ? Math.min(sh, drawY + drawH) : (drawY + drawH);
      if (isLiveMainCanvas && (visR <= visL || visB <= visT)) {
        return;
      }

      let hasMatchingDocTile = false;
      let readyTile = null;
      let needsHiResZoom = false;
      let docUid = '';
      let pageNum = 1;
      let srcPageNum = 1;
      let tileCoversVisiblePaper = false;

      if (isLiveMainCanvas) {
        docUid = this.pdfPageBoardData.pdfDocUid || '';
        pageNum = this.pdfPageBoardData.pageNum || 1;
        srcPageNum = this.pdfPageBoardData.pdfSourcePageNum || pageNum;
        const liveVecDoc = docUid ? this._getLivePdfDocForUid(docUid) : null;
        const hasLiveVectorDoc = Boolean(liveVecDoc && typeof liveVecDoc.getPage === 'function');
        const baseTexW = (pageCanvas && (pageCanvas.width || pageCanvas.naturalWidth)) || 2800;
        needsHiResZoom = Boolean(hasLiveVectorDoc && (this.zoomLevel || 1.0) > 1.32 && (drawW * effDpr) > (baseTexW * 1.28));
        if (!needsHiResZoom) {
          if (this._pdfBoardHiResTile || this._pdfBoardHiResTileTimer || this._pdfBoardHiResTileRenderTask) {
            this._invalidatePdfBoardHiResTile(true);
          }
        } else {
          readyTile = this._pdfBoardHiResTile;
          hasMatchingDocTile = Boolean(
            readyTile &&
            readyTile.docUid === docUid &&
            readyTile.srcPageNum === srcPageNum &&
            readyTile.canvas &&
            readyTile.canvas.width > 2 &&
            readyTile.canvas.height > 2
          );
          if (hasMatchingDocTile) {
            const tileL = drawX + readyTile.uL * drawW;
            const tileT = drawY + readyTile.uT * drawH;
            const tileR = tileL + readyTile.uW * drawW;
            const tileB = tileT + readyTile.uH * drawH;
            tileCoversVisiblePaper = Boolean(
              tileL <= visL + 0.5 &&
              tileT <= visT + 0.5 &&
              tileR >= visR - 0.5 &&
              tileB >= visB - 0.5
            );
          }
        }
      }

      const allEdgesOffscreen = Boolean(
        isLiveMainCanvas &&
        drawX <= -32 &&
        drawY <= -32 &&
        (drawX + drawW) >= sw + 32 &&
        (drawY + drawH) >= sh + 32
      );
      const isManipulatingLasso = !isExport && Boolean(
        this.isDraggingLassoSelection ||
        this.isResizingLassoSelection ||
        this.isRotatingLassoSelection ||
        this._lassoFlipAnim
      );
      const usePaperShadow = Boolean(!isExport && !isActivelyMovingCamera && !isManipulatingLasso && !allEdgesOffscreen);

      ctx.save();
      if (usePaperShadow) {
        ctx.shadowColor = isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(0, 0, 0, 0.50)';
        ctx.shadowBlur = isLight ? 20 : 26;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      } else if (!tileCoversVisiblePaper) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(visL, visT, visR - visL, visB - visT);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = (isActivelyMovingCamera || isManipulatingLasso) ? 'medium' : 'high';
      if (sourceTex && !tileCoversVisiblePaper) {
        const texW = sourceTex.width || sourceTex.naturalWidth || 0;
        const texH = sourceTex.height || sourceTex.naturalHeight || 0;
        if (isLiveMainCanvas && texW > 16 && texH > 16 && (drawW > sw * 1.18 || drawH > sh * 1.18)) {
          const padCss = 4;
          const cL = Math.max(drawX, visL - padCss);
          const cT = Math.max(drawY, visT - padCss);
          const cR = Math.min(drawX + drawW, visR + padCss);
          const cB = Math.min(drawY + drawH, visB + padCss);
          const sx0 = Math.max(0, Math.floor(((cL - drawX) / drawW) * texW));
          const sy0 = Math.max(0, Math.floor(((cT - drawY) / drawH) * texH));
          const sx1 = Math.min(texW, Math.ceil(((cR - drawX) / drawW) * texW));
          const sy1 = Math.min(texH, Math.ceil(((cB - drawY) / drawH) * texH));
          const sW = sx1 - sx0;
          const sH = sy1 - sy0;
          if (sW > 0 && sH > 0) {
            const dx0 = drawX + (sx0 / texW) * drawW;
            const dy0 = drawY + (sy0 / texH) * drawH;
            const dW = (sW / texW) * drawW;
            const dH = (sH / texH) * drawH;
            ctx.drawImage(sourceTex, sx0, sy0, sW, sH, dx0, dy0, dW, dH);
          }
        } else {
          ctx.drawImage(sourceTex, drawX, drawY, drawW, drawH);
        }
      }

      if (isExport && this._exportPdfHiResOverride && this._exportPdfHiResOverride.canvas && this._exportPdfHiResOverride.canvas.width > 2) {
        const ov = this._exportPdfHiResOverride;
        ctx.save();
        ctx.beginPath();
        ctx.rect(drawX, drawY, drawW, drawH);
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          ov.canvas,
          drawX + ov.normL * drawW,
          drawY + ov.normT * drawH,
          ov.normW * drawW,
          ov.normH * drawH
        );
        ctx.restore();
      }

      // 🌟 [고배율(132%~350%) 정지 시 현재 화면 영역만 1:1 원본 벡터 타일로 선명화 & 사파리 메모리 즉시 반환]:
      if (isLiveMainCanvas && needsHiResZoom) {
        if (hasMatchingDocTile) {
          ctx.save();
          if (!allEdgesOffscreen) {
            ctx.beginPath();
            ctx.rect(drawX, drawY, drawW, drawH);
            ctx.clip();
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = isActivelyMovingCamera ? 'medium' : 'high';
          ctx.drawImage(
            readyTile.canvas,
            drawX + readyTile.uL * drawW,
            drawY + readyTile.uT * drawH,
            readyTile.uW * drawW,
            readyTile.uH * drawH
          );
          ctx.restore();
        }

        if (!isActivelyMovingCamera && !isActivelyInkingAny) {
          const strictL = Math.max(0, Math.floor(-drawX));
          const strictT = Math.max(0, Math.floor(-drawY));
          const strictR = Math.min(Math.ceil(drawW), Math.ceil(sw - drawX));
          const strictB = Math.min(Math.ceil(drawH), Math.ceil(sh - drawY));
          if ((strictR - strictL) > 8 && (strictB - strictT) > 8) {
            const zoomCloseEnough = Boolean(
              hasMatchingDocTile &&
              readyTile.renderedDrawW > 0 &&
              Math.abs(drawW - readyTile.renderedDrawW) <= Math.max(2, drawW * 0.035)
            );
            const coversStrictViewport = Boolean(
              zoomCloseEnough &&
              (readyTile.uL * drawW) <= (strictL + 1.5) &&
              (readyTile.uT * drawH) <= (strictT + 1.5) &&
              ((readyTile.uL + readyTile.uW) * drawW) >= (strictR - 1.5) &&
              ((readyTile.uT + readyTile.uH) * drawH) >= (strictB - 1.5)
            );
            if (!coversStrictViewport) {
              const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
              const pad = isIOS ? 96 : 160;
              const localL = Math.max(0, Math.floor(-pad - drawX));
              const localT = Math.max(0, Math.floor(-pad - drawY));
              const localR = Math.min(Math.ceil(drawW), Math.ceil(sw + pad - drawX));
              const localB = Math.min(Math.ceil(drawH), Math.ceil(sh + pad - drawY));
              const localW = localR - localL;
              const localH = localB - localT;
              if (localW > 8 && localH > 8) {
                const tileKey = `${docUid}|${srcPageNum}|${Math.round(drawW)}|${localL},${localT},${localW},${localH}|${Math.round(effDpr * 100)}`;
                this._schedulePdfBoardHiResTile({
                  key: tileKey,
                  docUid,
                  pageNum,
                  srcPageNum,
                  drawW,
                  drawH,
                  localL,
                  localT,
                  localW,
                  localH,
                  effDpr
                });
              }
            }
          }
        }
      }

      if (!isExport && !allEdgesOffscreen) {
        ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.55)' : 'rgba(255, 255, 255, 0.24)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(drawX, drawY, drawW, drawH);
      }
      ctx.restore();
    }

    async deletePdfPageSlide(pageNum) {
      if (!Array.isArray(this.pdfWorkedPages)) return;
      const idx = this.pdfWorkedPages.indexOf(pageNum);
      if (idx === -1) return;

      this.pdfWorkedPages.splice(idx, 1);
      if (this.pdfSavedPageStates) {
        delete this.pdfSavedPageStates[pageNum];
      }

      if (this.pdfWorkedPages.length === 0) {
        this.resetNewCanvas();
        return;
      }

      if (this.pdfPageBoardData && this.pdfPageBoardData.pageNum === pageNum) {
        const nextTarget = this.pdfWorkedPages[Math.min(idx, this.pdfWorkedPages.length - 1)];
        await this.openPdfPageOnBoard(nextTarget, { skipArchiveCurrent: true });
      } else {
        this.syncPdfBoardNavBarUI();
      }
      this.showToast(`🗑️ p.${pageNum} 캔버스를 삭제했습니다.`);
    }

    parsePdfPageSelectionSpec(specStr, totalPages = 1) {
      const maxPage = Math.max(1, Math.floor(Number(totalPages) || 1));
      const raw = (typeof specStr === 'string') ? specStr.trim() : '';
      if (!raw) {
        return { pages: [], hasInput: false, hasInvalidToken: false };
      }

      if (/^(전체|all|\*)$/i.test(raw)) {
        const allPages = [];
        for (let p = 1; p <= maxPage; p++) allPages.push(p);
        return { pages: allPages, hasInput: true, hasInvalidToken: false };
      }

      // 공백 포함 구간("3 - 8", "3 ~ 8") 및 전각 기호 정규화
      const normalized = raw
        .replace(/[，、；;]/g, ',')
        .replace(/[～〜–—−]/g, '-')
        .replace(/(\d+)\s*[-~]\s*(\d+)/g, '$1-$2')
        .replace(/(\d+)\s*[-~]\s*(?=,|$)/g, '$1-');

      const tokens = normalized.split(/[,\s]+/).filter(Boolean);
      const pages = [];
      const seen = new Set();
      let hasInvalidToken = false;

      const pushValid = (p) => {
        if (p >= 1 && p <= maxPage && !seen.has(p)) {
          seen.add(p);
          pages.push(p);
        }
      };

      for (let i = 0; i < tokens.length; i++) {
        const tk = tokens[i];
        if (/^\d+$/.test(tk)) {
          const num = parseInt(tk, 10);
          if (num >= 1 && num <= maxPage) {
            pushValid(num);
          } else {
            hasInvalidToken = true;
          }
          continue;
        }
        // 타이핑 도중 미완성 하이픈("3-")은 시작 페이지가 유효하면 에러 깜빡임 없이 시작 페이지만 인정
        const trailingMatch = tk.match(/^(\d+)[-~]$/);
        if (trailingMatch) {
          const startNum = parseInt(trailingMatch[1], 10);
          if (startNum >= 1 && startNum <= maxPage) {
            pushValid(startNum);
          } else {
            hasInvalidToken = true;
          }
          continue;
        }
        const rangeMatch = tk.match(/^(\d+)[-~](\d+)$/);
        if (rangeMatch) {
          const a = parseInt(rangeMatch[1], 10);
          const b = parseInt(rangeMatch[2], 10);
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          if (hi < 1 || lo > maxPage) {
            hasInvalidToken = true;
          } else {
            const clampedLo = Math.max(1, lo);
            const clampedHi = Math.min(maxPage, hi);
            for (let p = clampedLo; p <= clampedHi; p++) {
              pushValid(p);
            }
          }
          continue;
        }
        hasInvalidToken = true;
      }

      return { pages, hasInput: true, hasInvalidToken };
    }

    syncPdfPageRangeInsertUI() {
      const inputEl = document.getElementById('inputPdfPageRangeSpec');
      const groupEl = document.getElementById('pdfPageInsertGroup');
      const btnEl = document.getElementById('btnPdfOpenFullPage');
      const lblEl = document.getElementById('lblPdfOpenFullPage') || (btnEl && btnEl.querySelector('.open-page-btn-text'));
      const total = this.pdfTotalPages || (this.pdfDoc && this.pdfDoc.numPages) || 1;
      const rawVal = inputEl ? inputEl.value : '';
      const { pages, hasInput } = this.parsePdfPageSelectionSpec(rawVal, total);

      const maxSlides = (typeof this.getMaxLessonSlidesLimit === 'function') ? this.getMaxLessonSlidesLimit() : 100;
      const replaceMode = Boolean(this._isReplacingViaNextCrop || this.hasAnyWorkspaceContent());
      const existingPlaylistLen = (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0)
        ? this.lessonPlaylistSlides.length
        : 0;
      const occupiedBefore = replaceMode
        ? Math.max(1, existingPlaylistLen)
        : (existingPlaylistLen > 1 ? (existingPlaylistLen - 1) : 0);
      const isOverQuota = Boolean(hasInput && pages.length > 0 && (occupiedBefore + pages.length > maxSlides));
      const isInvalid = Boolean((hasInput && pages.length === 0) || isOverQuota);
      const isValidSelection = Boolean(hasInput && pages.length > 0 && !isOverQuota);

      if (inputEl) {
        inputEl.title = rawVal.trim()
          ? (isOverQuota
            ? `최대 ${maxSlides}장 제한 초과 (현재 선택: ${pages.length}장)`
            : `선택 입력: ${rawVal.trim()} (${pages.length}페이지 인식됨)`)
          : `비워두면 현재 페이지 1장 삽입 · 구간(예: 1-5) 또는 낱장(예: 3,5,8) 입력 가능`;
      }

      if (groupEl) {
        groupEl.classList.toggle('has-invalid-range', isInvalid);
      }
      if (btnEl) {
        btnEl.classList.toggle('has-range-selection', isValidSelection);
        btnEl.classList.toggle('has-invalid-range', isInvalid);
      }
      if (lblEl) {
        if (!hasInput) {
          lblEl.textContent = '현재 페이지 삽입';
        } else if (isOverQuota) {
          lblEl.textContent = `${maxSlides}장 초과 (${pages.length})`;
        } else if (pages.length > 0) {
          lblEl.textContent = `${pages.length}페이지 삽입`;
        } else {
          lblEl.textContent = '범위 확인';
        }
      }
    }

    async handlePdfInsertPagesAction() {
      if (!this.pdfDoc) {
        this.showToast('⚠️ 먼저 PDF 문서를 열어주세요.');
        return;
      }
      this._isPdfBatchCropMode = false;
      if (this.isPdfCropModeActive) {
        this.togglePdfCropMode(false, { silentToast: true });
      }
      const total = this.pdfTotalPages || this.pdfDoc.numPages || 1;
      const inputEl = document.getElementById('inputPdfPageRangeSpec');
      const rawVal = inputEl ? inputEl.value : '';
      const { pages, hasInput } = this.parsePdfPageSelectionSpec(rawVal, total);

      if (!hasInput) {
        await this.openMultiplePdfPagesOnBoard([this.pdfCurrentPage || 1]);
        return;
      }
      if (pages.length === 0) {
        this.showToast(`⚠️ 유효한 페이지 번호(1~${total})를 입력해 주세요. (예: 1-5, 8)`);
        if (inputEl) inputEl.focus();
        return;
      }
      await this.openMultiplePdfPagesOnBoard(pages);
    }

    _renumberDefaultPlaylistSlideTitles() {
      if (!Array.isArray(this.lessonPlaylistSlides)) return;
      for (let i = 0; i < this.lessonPlaylistSlides.length; i++) {
        const s = this.lessonPlaylistSlides[i];
        if (!s) continue;
        if (!s.title || /^\d+$/.test(String(s.title).trim())) {
          s.title = String(i + 1);
        }
        if (!s.slideTitle || /^\d+$/.test(String(s.slideTitle).trim())) {
          s.slideTitle = String(i + 1);
        }
      }
    }

    _scheduleNextPdfSlidePrefetch() {
      if (this._nextPdfSlidePrefetchTimer) {
        clearTimeout(this._nextPdfSlidePrefetchTimer);
        this._nextPdfSlidePrefetchTimer = null;
      }
      // iPad/iOS는 WebKit <canvas> 메모리 한도 보호를 위해 온디맨드 단일 로드만 유지하고, PC에서만 다음 1장을 유휴 프리페치
      if (typeof this.isIOSOrIPad === 'function' && this.isIOSOrIPad()) return;
      if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides)) return;
      const nextIdx = (this.lessonPlaylistIndex || 0) + 1;
      if (nextIdx < 0 || nextIdx >= this.lessonPlaylistSlides.length) return;
      const nextSlide = this.lessonPlaylistSlides[nextIdx];
      const nextPbd = nextSlide && (nextSlide.pdfPageBoardData || (nextSlide.suspendedPdfBoardState && nextSlide.suspendedPdfBoardState.pdfPageBoardData));
      if (!nextPbd || !nextPbd.pdfDocUid) return;
      const srcPageNum = nextPbd.pdfSourcePageNum || nextPbd.pageNum || 1;
      if (this._getPdfPageCanvasFromCache(nextPbd.pageNum, nextPbd.dataUrl || '', nextPbd.pdfDocUid, srcPageNum)) return;

      this._nextPdfSlidePrefetchTimer = setTimeout(() => {
        this._nextPdfSlidePrefetchTimer = null;
        if (this.isPdfModalOpen || this.isDrawingInk || this.isPanning || this.isBoardPanning) return;
        if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides)) return;
        const curNext = this.lessonPlaylistSlides[(this.lessonPlaylistIndex || 0) + 1];
        const pbd = curNext && (curNext.pdfPageBoardData || (curNext.suspendedPdfBoardState && curNext.suspendedPdfBoardState.pdfPageBoardData));
        if (pbd && pbd.pdfDocUid && typeof this._ensurePdfBoardCanvasFromDataUrl === 'function') {
          this._ensurePdfBoardCanvasFromDataUrl(pbd).catch(() => null);
        }
      }, 180);
    }

    async openPdfPageOnBoard(pageNum, options = {}) {
      const target = pageNum || this.pdfCurrentPage || 1;
      return this.openMultiplePdfPagesOnBoard([target], options);
    }

    async openMultiplePdfPagesOnBoard(pageNumbers, options = {}) {
      if (!this.pdfDoc) {
        this.showToast('⚠️ 먼저 PDF 문서를 열어주세요.');
        return false;
      }
      const total = this.pdfTotalPages || this.pdfDoc.numPages || 1;
      const rawList = Array.isArray(pageNumbers) ? pageNumbers : [pageNumbers];
      const validPages = [];
      const seenPages = new Set();
      for (let i = 0; i < rawList.length; i++) {
        const p = Math.round(Number(rawList[i]));
        if (Number.isFinite(p) && p >= 1 && p <= total && !seenPages.has(p)) {
          seenPages.add(p);
          validPages.push(p);
        }
      }
      if (validPages.length === 0) {
        this.showToast(`⚠️ 유효한 페이지 번호(1~${total})를 입력해 주세요.`);
        return false;
      }

      const skipArchive = Boolean(options && options.skipArchiveCurrent);
      const hasExistingContent = !skipArchive && this.hasAnyWorkspaceContent();
      const replaceMode = Boolean(this._isReplacingViaNextCrop || hasExistingContent);
      const maxSlides = (typeof this.getMaxLessonSlidesLimit === 'function') ? this.getMaxLessonSlidesLimit() : 100;
      const existingPlaylistLen = (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0)
        ? this.lessonPlaylistSlides.length
        : 0;
      const occupiedBefore = replaceMode
        ? Math.max(1, existingPlaylistLen)
        : (existingPlaylistLen > 1 ? (existingPlaylistLen - 1) : 0);

      if (occupiedBefore + validPages.length > maxSlides) {
        const remain = Math.max(0, maxSlides - occupiedBefore);
        const msg = remain > 0
          ? `한 파일에는 최대 ${maxSlides}장까지 저장할 수 있습니다. (현재 ${remain}장 더 삽입 가능)`
          : `한 파일에는 최대 ${maxSlides}장까지 저장할 수 있습니다. 추가 내용은 새 파일에서 이어서 작성해 주세요.`;
        this.showToast(remain > 0
          ? `⚠️ 최대 ${maxSlides}장 제한: 현재 ${remain}장까지 추가할 수 있습니다.`
          : `⚠️ 한 파일에는 최대 ${maxSlides}장까지 추가할 수 있습니다.`);
        if (typeof this.showTossPaymentResultModal === 'function') {
          this.showTossPaymentResultModal({
            status: 'warning',
            title: `캔버스는 최대 ${maxSlides}장까지 추가할 수 있습니다`,
            message: msg
          });
        }
        return false;
      }

      this.setLessonTeachingMode('page');
      this._isReplacingViaNextCrop = false;

      let insertStartIdx = 0;
      if (replaceMode) {
        if (this.isAudioRecording) {
          this._isAudioWaitingForNextSlideSetup = true;
          this._archiveCurrentBeforeNextCapture();
          insertStartIdx = this.lessonPlaylistSlides.length;
        } else {
          if (this._isAudioReplayActive || this.isAudioPlaying) {
            this.stopAudioPlayback(true);
          }
          if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0) {
            const firstExisting = this.serializeFullSlideState('1');
            this.lessonPlaylistSlides = [firstExisting];
            this.lessonPlaylistIndex = 0;
            this.isLessonPlaylistActive = true;
          } else {
            this.saveCurrentSlideIntoPlaylist();
          }
          insertStartIdx = Math.min(this.lessonPlaylistSlides.length, (this.lessonPlaylistIndex || 0) + 1);
        }
      } else if (this.isAudioRecording) {
        this._isAudioWaitingForNextSlideSetup = true;
      }

      // 현재 캔버스의 이전 문제 카드·그래프 카드·필기·PDF 보드 데이터를 100% 깨끗하게 초기화하여 슬라이드 간 섞임 원천 차단!
      this.resetBoardAndProblemCardsForNext();

      if (this._pdfPageCanvasCacheDoc !== this.pdfDoc) {
        if (this._pdfPageCanvasCache) {
          Object.keys(this._pdfPageCanvasCache).forEach((k) => {
            const oldCv = this._pdfPageCanvasCache[k];
            if (oldCv && typeof oldCv === 'object') {
              oldCv._evicted = true;
              if (oldCv._mipCanvas) {
                try { oldCv._mipCanvas.width = 1; oldCv._mipCanvas.height = 1; } catch (e) { }
                oldCv._mipCanvas = null;
              }
              try { oldCv.width = 1; oldCv.height = 1; } catch (e) { }
            }
          });
        }
        this._pdfPageCanvasCacheDoc = this.pdfDoc;
        this._pdfPageCanvasCache = {};
        this._pdfPageCanvasCacheOrder = [];
      }
      if (this.pdfDoc && !this.pdfDoc._graphlyDocUid) {
        this.pdfDoc._graphlyDocUid = `pdfdoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      const activeDocUid = (this.pdfDoc && this.pdfDoc._graphlyDocUid) || '';
      if (activeDocUid && this._cachedPdfBytes && this._cachedPdfBytes.byteLength > 0 && (!this._pdfBytesByDocUid || !this._pdfBytesByDocUid.has(activeDocUid))) {
        this._registerPdfBytesForDocUid(activeDocUid, this._cachedPdfBytes, this.pdfDoc);
      }
      const hasBackedVecPdf = Boolean(activeDocUid && this._hasLivePdfSourceForBoard({ pdfDocUid: activeDocUid }));

      // 🌟 [초고속 온디맨드 설계]: 첫 번째 선택 페이지(validPages[0]) 딱 1장만 즉시 렌더링하고, 나머지 N-1장은 0MB 메타데이터로만 세팅!
      const targetPage = validPages[0];
      let pageCanvas = this._getPdfPageCanvasFromCache(targetPage, '', activeDocUid, targetPage);
      if (!pageCanvas) {
        const page = await this.pdfDoc.getPage(targetPage);
        const baseVp = page.getViewport({ scale: 1.0 });
        const targetMinPxW = 2800;
        const maxSidePx = 4032;
        const maxAreaPx = 15500000;
        const rawScale = Math.max(2.0, Math.min(4.7, targetMinPxW / Math.max(1, baseVp.width)));
        const maxSideScale = maxSidePx / Math.max(1, baseVp.width, baseVp.height);
        const maxAreaScale = Math.sqrt(maxAreaPx / Math.max(1, baseVp.width * baseVp.height));
        const renderScale = Math.max(1.0, Math.min(rawScale, maxSideScale, maxAreaScale));
        const vp = page.getViewport({ scale: renderScale });
        pageCanvas = document.createElement('canvas');
        pageCanvas.width = Math.round(vp.width);
        pageCanvas.height = Math.round(vp.height);
        const pCtx = pageCanvas.getContext('2d');
        pCtx.imageSmoothingEnabled = true;
        pCtx.imageSmoothingQuality = 'high';
        pCtx.fillStyle = '#ffffff';
        pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        await page.render({ canvasContext: pCtx, viewport: vp }).promise;

        try {
          const mipCanvas = document.createElement('canvas');
          mipCanvas.width = Math.max(1, Math.round(pageCanvas.width * 0.5));
          mipCanvas.height = Math.max(1, Math.round(pageCanvas.height * 0.5));
          const mipCtx = mipCanvas.getContext('2d');
          mipCtx.imageSmoothingEnabled = true;
          mipCtx.imageSmoothingQuality = 'high';
          mipCtx.drawImage(pageCanvas, 0, 0, mipCanvas.width, mipCanvas.height);
          pageCanvas._mipCanvas = mipCanvas;
        } catch (e) { }

        pageCanvas._cachedDataUrl = hasBackedVecPdf ? '' : this.encodeCanvasSmartWebP(pageCanvas, 0.88);
        this._putPdfPageCanvasInCache(targetPage, pageCanvas, pageCanvas._cachedDataUrl, activeDocUid, targetPage);
      } else if (!pageCanvas._cachedDataUrl && !hasBackedVecPdf) {
        pageCanvas._cachedDataUrl = this.encodeCanvasSmartWebP(pageCanvas, 0.88);
      }

      const baseYSpan = 8.4;
      this.ySpan = baseYSpan;
      this.xSpan = 11.5;
      this._suspendedPdfBoardState = null;
      this._isTempPdfProblemCard = false;
      this.enterBoardMode();
      this.panX = 0;
      this.panY = 0;
      this.setZoomLevel(1.0);

      const aspect = pageCanvas.height / Math.max(1, pageCanvas.width);
      const sw = Math.max(360, this.screenWidth || window.innerWidth || 1920);
      const sh = Math.max(360, this.screenHeight || window.innerHeight || 1080);
      const unitScale = (sh / 2) / baseYSpan;
      const isCompactTabletWidth = sw <= 1440;
      const sideClearancePx = isCompactTabletWidth ? 112 : 148;
      const widthRatio = isCompactTabletWidth ? 0.91 : 0.84;
      const targetScreenW = Math.min(sw - sideClearancePx, Math.max(sw * widthRatio, sh * 1.18));
      const mathW = targetScreenW / unitScale;
      const mathH = mathW * aspect;

      const topMarginPx = 58;
      const yTopMath = (sh / 2 - topMarginPx) / unitScale;
      const centerX = 0;
      const centerY = yTopMath - mathH / 2;

      this._invalidatePdfBoardHiResTile(true);

      this.pdfPageBoardData = {
        pageNum: targetPage,
        pdfSourcePageNum: targetPage,
        totalPages: total,
        pdfDocUid: activeDocUid,
        canvas: pageCanvas,
        dataUrl: pageCanvas._cachedDataUrl || '',
        pixelW: pageCanvas.width,
        pixelH: pageCanvas.height,
        aspect,
        mathW,
        mathH,
        centerX,
        centerY,
        baseYSpan
      };

      if (!this.graphs || this.graphs.length === 0) {
        this.showAxes = false;
        this.updateAxesUI();
      }

      this._inkBakeDirty = true;

      this.updatePdfPageNavUI(targetPage, true);
      if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed) {
        this.closeDrawer();
      }
      if (!this.isInkMode) {
        this.toggleInkMode(true);
      }
      if (this.activeInkTool !== 'highlighter') {
        this.setActiveInkTool('pen');
      }

      // 나머지 2..K번 슬라이드 경량 메타데이터 생성 (<canvas> 할당 및 page.render 0회!)
      const buildRestSlides = async (templateSlide) => {
        if (validPages.length <= 1) return [];
        const restPages = validPages.slice(1);
        const restVps = await Promise.all(restPages.map((pNum) =>
          this.pdfDoc.getPage(pNum).then((pg) => pg.getViewport({ scale: 1.0 })).catch(() => null)
        ));
        return restPages.map((pNum, idx) => {
          const vp1 = restVps[idx];
          const aspect_i = (vp1 && vp1.width > 0) ? (vp1.height / vp1.width) : aspect;
          const mathW_i = targetScreenW / unitScale;
          const mathH_i = mathW_i * aspect_i;
          const centerY_i = yTopMath - mathH_i / 2;
          const cloned = this._fastCloneSlideValue(templateSlide);
          cloned.slideUid = (typeof this._allocateSlideUid === 'function') ? this._allocateSlideUid() : `sl_pdf_${Date.now()}_${idx}`;
          cloned.audioSyncData = null;
          cloned.pdfPageBoardData = {
            pageNum: pNum,
            pdfSourcePageNum: pNum,
            totalPages: total,
            pdfDocUid: activeDocUid,
            canvas: null,
            dataUrl: '',
            pixelW: 0,
            pixelH: 0,
            aspect: aspect_i,
            mathW: mathW_i,
            mathH: mathH_i,
            centerX: 0,
            centerY: centerY_i,
            baseYSpan
          };
          return cloned;
        });
      };

      if (replaceMode) {
        if (this.isAudioRecording) {
          this._finalizeAppendedCaptureSlide('');
          const firstInsertedSlide = this.lessonPlaylistSlides[this.lessonPlaylistIndex];
          const restSlides = await buildRestSlides(firstInsertedSlide);
          if (restSlides.length > 0) {
            this.lessonPlaylistSlides.push(...restSlides);
            this._renumberDefaultPlaylistSlideTitles();
            this.syncLessonPlaylistNavBarUI();
          }
        } else {
          if (typeof this._ensurePlaylistSlideUids === 'function') {
            this._ensurePlaylistSlideUids(this.lessonPlaylistSlides, true);
          }
          this.audioSyncData = null;
          const firstInsertedSlide = this.serializeFullSlideState(String(insertStartIdx + 1));
          const restSlides = await buildRestSlides(firstInsertedSlide);
          this.lessonPlaylistSlides.splice(insertStartIdx, 0, firstInsertedSlide, ...restSlides);
          if (typeof this._remapPlaylistAudioNextSlideIndices === 'function') {
            this._remapPlaylistAudioNextSlideIndices(this.lessonPlaylistSlides);
          }
          this.lessonPlaylistIndex = insertStartIdx;
          this.isLessonPlaylistActive = true;
          this._renumberDefaultPlaylistSlideTitles();
          this._isAudioWaitingForNextSlideSetup = false;
          this._alreadyArchivedBeforePdfModal = false;
          this.syncLessonPlaylistNavBarUI();
        }
      } else {
        this._isAudioWaitingForNextSlideSetup = false;
        if (this.isAudioRecording) {
          if (!this.audioInitialState || (this.getAudioRecordElapsedMs() < 400 && (!this.audioTimeline || this.audioTimeline.length <= 1))) {
            this.audioInitialState = this._captureAudioWorkspaceKeyframe();
          }
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        const firstSlide = this.serializeFullSlideState('1');
        const restSlides = await buildRestSlides(firstSlide);
        if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 1) {
          const curIdx = Math.max(0, Math.min(this.lessonPlaylistSlides.length - 1, this.lessonPlaylistIndex || 0));
          this.lessonPlaylistSlides.splice(curIdx, 1, firstSlide, ...restSlides);
          this.lessonPlaylistIndex = curIdx;
          this._renumberDefaultPlaylistSlideTitles();
        } else {
          this.lessonPlaylistSlides = [firstSlide, ...restSlides];
          this.lessonPlaylistIndex = 0;
          this.isLessonPlaylistActive = true;
          this._renumberDefaultPlaylistSlideTitles();
        }
        this.syncLessonPlaylistNavBarUI();
      }

      this.closePdfModal();

      this.syncControls();
      this.renderLayerList();
      this.renderFuncList();
      this.syncPdfBoardNavBarUI();
      this.syncGraphSnapBarUI();
      this.render();
      this._scheduleNextPdfSlidePrefetch();

      if (validPages.length >= 2 && !(options && options.silentToast)) {
        this.showToast(`📑 선택한 ${validPages.length}페이지를 슬라이드로 삽입했습니다!`);
      }
      return true;
    }

    // 🌟 [PDF 페이지 위에서 패닝/줌 후 첫 그래프 소환 시: 화면 속 PDF·필기는 0px도 움직이지 않고 현재 화면 중앙에 아담한 그래프 소환!] 🌟
    rebasePdfBoardOriginToScreenCenter() {
      if (!this.pdfPageBoardData) return;
      const z0 = this.zoomLevel || 1.0;
      const hasCameraShift = (Math.abs(this.panX || 0) > 0.5 || Math.abs(this.panY || 0) > 0.5 || Math.abs(z0 - 1.0) > 0.01);
      if (!hasCameraShift) return;

      const centerMath = this.screenToMath(this.screenWidth / 2, this.screenHeight / 2);
      const mx0 = centerMath.x;
      const my0 = centerMath.y;

      const tx = (x) => (x - mx0) * z0;
      const ty = (y) => (y - my0) * z0;

      // 1. PDF 페이지 보드 중심 좌표 및 크기 흡수
      const cx = this.pdfPageBoardData.centerX || 0;
      const cy = this.pdfPageBoardData.centerY || 0;
      this.pdfPageBoardData.centerX = tx(cx);
      this.pdfPageBoardData.centerY = ty(cy);
      this.pdfPageBoardData.mathW = this.pdfPageBoardData.mathW * z0;
      this.pdfPageBoardData.mathH = this.pdfPageBoardData.mathH * z0;

      // 2. 기존 PDF 위 개념 필기(target === 'graph') 좌표 및 줌 흡수
      const prevPdfInkSnap = (this.isAudioRecording && typeof this._snapshotInkListForReconcile === 'function')
        ? this._snapshotInkListForReconcile(this.inkStrokes)
        : null;
      if (this.inkStrokes && this.inkStrokes.length > 0) {
        this.inkStrokes.forEach(s => {
          if (!s || (s.target || 'board') === 'board') return;
          s.zoom = (s.zoom || 1.0) / z0;
          if (s.points && s.points.length > 0) {
            s.points.forEach(pt => {
              pt.x = tx(pt.x);
              pt.y = ty(pt.y);
            });
          }
          if (s.shape) {
            const sh = s.shape;
            if (sh.start && sh.end) {
              sh.start = { x: tx(sh.start.x), y: ty(sh.start.y) };
              sh.end = { x: tx(sh.end.x), y: ty(sh.end.y) };
            }
            if (sh.center) {
              sh.center = { x: tx(sh.center.x), y: ty(sh.center.y) };
              if (typeof sh.radius === 'number') sh.radius *= z0;
              if (typeof sh.rx === 'number') sh.rx *= z0;
              if (typeof sh.ry === 'number') sh.ry *= z0;
            }
            if (sh.min && sh.max) {
              sh.min = { x: tx(sh.min.x), y: ty(sh.min.y) };
              sh.max = { x: tx(sh.max.x), y: ty(sh.max.y) };
            }
            if (sh.pts && sh.pts.length > 0) {
              sh.pts = sh.pts.map(pt => ({ x: tx(pt.x), y: ty(pt.y) }));
            }
          }
        });
      }

      this.panX = 0;
      this.panY = 0;
      this.setZoomLevel(1.0);
      if (prevPdfInkSnap && this.isAudioRecording && typeof this._reconcileInkStrokesForAudioRecording === 'function') {
        this._reconcileInkStrokesForAudioRecording(prevPdfInkSnap, this.inkStrokes);
      }
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      this._inkBakeDirty = true;
      this.clearInkCache();
    }

    async navigatePdfBoardPage(delta) {
      if (!this.pdfDoc) return;
      if (this._suspendedPdfBoardState && !this.pdfPageBoardData) {
        this._restoreBoardModeStateAfterGraph();
      }
      const cur = (this.pdfPageBoardData && this.pdfPageBoardData.pageNum) || this.pdfCurrentPage || 1;
      const total = this.pdfTotalPages || this.pdfDoc.numPages || 1;
      const nextP = cur + delta;
      if (nextP < 1 || nextP > total) return;
      await this.openPdfPageOnBoard(nextP);
    }

    _cancelPdfBoardHiResTilePending() {
      if (this._pdfBoardHiResTileTimer) {
        clearTimeout(this._pdfBoardHiResTileTimer);
        this._pdfBoardHiResTileTimer = null;
      }
      if (this._pdfBoardHiResTileRenderTask && typeof this._pdfBoardHiResTileRenderTask.cancel === 'function') {
        try { this._pdfBoardHiResTileRenderTask.cancel(); } catch (e) { }
      }
      this._pdfBoardHiResTileRenderTask = null;
      this._pdfBoardHiResTileInFlightKey = null;
    }

    _invalidatePdfBoardHiResTile(releaseBuffers = false) {
      this._cancelPdfBoardHiResTilePending();
      const prevTile = this._pdfBoardHiResTile;
      this._pdfBoardHiResTile = null;
      if (prevTile && prevTile.canvas) {
        try { prevTile.canvas.width = 0; prevTile.canvas.height = 0; } catch (e) { }
      }
      if (releaseBuffers) {
        for (const k of ['_pdfBoardHiResCanvasA', '_pdfBoardHiResCanvasB']) {
          const cv = this[k];
          if (cv) {
            try { cv.width = 0; cv.height = 0; } catch (e) { }
            this[k] = null;
          }
        }
      }
    }

    _schedulePdfBoardHiResTile(req) {
      if (!req || !req.key) return;
      if (this._pdfBoardHiResTile && this._pdfBoardHiResTile.key === req.key) return;
      if (this._pdfBoardHiResTileInFlightKey === req.key) return;

      this._cancelPdfBoardHiResTilePending();
      this._pdfBoardHiResTileInFlightKey = req.key;
      const token = (this._pdfBoardHiResTileToken || 0) + 1;
      this._pdfBoardHiResTileToken = token;

      const runTileWhenQuiet = () => {
        this._pdfBoardHiResTileTimer = null;
        if (this._pdfBoardHiResTileToken !== token) return;
        const sincePenMs = this._lastPenActiveTime ? (Date.now() - this._lastPenActiveTime) : 99999;
        if (
          this.isDrawingInk ||
          this.isStylusDrawing ||
          this._isDrawingCardInk ||
          sincePenMs < 380
        ) {
          this._pdfBoardHiResTileTimer = setTimeout(runTileWhenQuiet, 260);
          return;
        }
        (async () => {
          const liveVecDoc = req.docUid ? this._getLivePdfDocForUid(req.docUid) : null;
          if (
            this._pdfBoardHiResTileToken !== token ||
            this.isPdfModalOpen ||
            !this.pdfPageBoardData ||
            this.isPanning ||
            this.isBoardPanning ||
            this._pinchState ||
            this._isZoomAnimating ||
            this._isWheelZooming ||
            this.isDrawingInk ||
            !liveVecDoc ||
            this.pdfPageBoardData.pdfDocUid !== req.docUid ||
            (this.pdfPageBoardData.pageNum || 1) !== req.pageNum
          ) {
            if (this._pdfBoardHiResTileInFlightKey === req.key) {
              this._pdfBoardHiResTileInFlightKey = null;
            }
            return;
          }

          let stagingCv = null;
          try {
            const page = await liveVecDoc.getPage(req.srcPageNum || req.pageNum || 1);
            if (this._pdfBoardHiResTileToken !== token || !this.pdfPageBoardData || this.isDrawingInk) {
              if (this._pdfBoardHiResTileInFlightKey === req.key) {
                this._pdfBoardHiResTileInFlightKey = null;
              }
              return;
            }

            const baseVp = page.getViewport({ scale: 1.0 });
            const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
            let tileDpr = Math.min(isIOS ? 2.1 : 2.4, Math.max(1.5, req.effDpr || 2.0));
            const maxSideScale = (isIOS ? 2880 : 3584) / Math.max(1, req.localW, req.localH);
            const maxAreaScale = Math.sqrt((isIOS ? 6800000 : 10500000) / Math.max(1, req.localW * req.localH));
            tileDpr = Math.max(1.0, Math.min(tileDpr, maxSideScale, maxAreaScale));

            const tilePxW = Math.max(2, Math.round(req.localW * tileDpr));
            const tilePxH = Math.max(2, Math.round(req.localH * tileDpr));
            const effTileDpr = tilePxW / Math.max(1, req.localW);
            const vecScale = (req.drawW / Math.max(1, baseVp.width)) * effTileDpr;
            const tileVp = page.getViewport({
              scale: vecScale,
              offsetX: -req.localL * effTileDpr,
              offsetY: -req.localT * effTileDpr
            });

            stagingCv = document.createElement('canvas');
            stagingCv.width = tilePxW;
            stagingCv.height = tilePxH;
            const tCtx = stagingCv.getContext('2d', { alpha: false }) || stagingCv.getContext('2d');
            if (!tCtx) {
              try { stagingCv.width = 0; stagingCv.height = 0; } catch (_) { }
              stagingCv = null;
              this._pdfBoardHiResTileInFlightKey = null;
              return;
            }
            tCtx.fillStyle = '#ffffff';
            tCtx.fillRect(0, 0, tilePxW, tilePxH);

            const renderTask = page.render({ canvasContext: tCtx, viewport: tileVp });
            this._pdfBoardHiResTileRenderTask = renderTask;
            await renderTask.promise;

            if (this._pdfBoardHiResTileToken !== token || !this.pdfPageBoardData) {
              try { stagingCv.width = 0; stagingCv.height = 0; } catch (_) { }
              stagingCv = null;
              return;
            }
            this._pdfBoardHiResTileRenderTask = null;
            this._pdfBoardHiResTileInFlightKey = null;

            const oldTile = this._pdfBoardHiResTile;
            const promotedCv = stagingCv;
            stagingCv = null;
            this._pdfBoardHiResTile = {
              key: req.key,
              docUid: req.docUid,
              srcPageNum: req.srcPageNum,
              renderedDrawW: req.drawW,
              uL: req.localL / Math.max(1, req.drawW),
              uT: req.localT / Math.max(1, req.drawH),
              uW: req.localW / Math.max(1, req.drawW),
              uH: req.localH / Math.max(1, req.drawH),
              canvas: promotedCv
            };
            if (oldTile && oldTile.canvas && oldTile.canvas !== promotedCv) {
              try { oldTile.canvas.width = 0; oldTile.canvas.height = 0; } catch (_) { }
            }
            this._hasSceneFreeze = false;
            if (!this.isDrawingInk && !this.isStylusDrawing && !this._isDrawingCardInk) {
              this.requestRender();
            }
          } catch (err) {
            if (stagingCv) {
              try { stagingCv.width = 0; stagingCv.height = 0; } catch (_) { }
              stagingCv = null;
            }
            if (this._pdfBoardHiResTileToken === token) {
              this._pdfBoardHiResTileRenderTask = null;
              this._pdfBoardHiResTileInFlightKey = null;
            }
          }
        })();
      };

      this._pdfBoardHiResTileTimer = setTimeout(runTileWhenQuiet, 220);
    }

    closePdfPageBoard() {
      this._invalidatePdfBoardHiResTile(true);
      if (!this.pdfPageBoardData) return;
      if (this.isAudioRecording) {
        if (typeof this._archivePdfBoardForAudioRecording === 'function') {
          this._archivePdfBoardForAudioRecording(this.pdfPageBoardData);
        }
        if (Array.isArray(this.inkStrokes) && typeof this._archiveStrokeRemovedDuringRecording === 'function') {
          const recT = Math.max(0, Math.round(this.getAudioRecordElapsedMs()));
          this.inkStrokes.forEach(s => {
            if (s && s.onPdfBoard) {
              this._archiveStrokeRemovedDuringRecording(s, recT);
            }
          });
          this.inkStrokes = this.inkStrokes.filter(s => s && !s.onPdfBoard);
        }
      }
      this.pdfPageBoardData = null;
      this._suspendedPdfBoardState = null;
      this._lastPdfPageScreenRect = null;
      this.ySpan = 6.0;
      this.syncPdfBoardNavBarUI();
      if (!this.hasBoardStateToReturn()) {
        this.isGraphCovered = false;
        this.showAxes = true;
        this.updateAxesUI();
      }
      this.syncWorkspaceModeUI();
      this.syncGraphSnapBarUI();
      if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      this.render();
    }

    // 🌟 [무결점 더블 버퍼링(Double-Buffered) 단일 순차 PDF 렌더링 큐 & 순정 스크롤 보호 엔진] 🌟
    // 1) 화질: 모니터 물리 픽셀 밀도에 맞춘 선명한 Retina/HiDPI 표준 배율(dpr = 1.5 ~ 2.0) 복원!
    // 2) 떨림 원천 제거:
    //    - 화면에 보이는 DOM <canvas>에 직접 page.render()를 그리지 않고 오프스크린 버퍼(_pdfOffscreenRenderCanvas)에 완성한 뒤
    //      단 1프레임(ctx.drawImage)에 복사하여 렌더링 도중 캔버스 리사이즈/흰 화면 깜빡임/스크롤 떨림을 0.00%로 차단!
    //    - 동시에 여러 페이지의 page.render()가 겹쳐 실행되지 않도록 1장씩 순차 큐(_pdfRenderQueue)로만 처리!
    // 3) 스크롤 최우선 양보:
    //    - 스크롤이 발생하는 즉시 백그라운드 페이지 렌더 작업을 취소(_cancelCurrentPdfRenderJob)하여 메인 스레드를 100% 스크롤에 양보하고,
    //    - 마우스 휠 스무스 스크롤 애니메이션(약 180ms)이 완전히 멈춘 뒤(220ms)에만 조용히 다음 페이지를 준비합니다!
    // ==========================================================================
    // [📑 PDF 모달 뷰어 엔진: 중앙 우선 단일 순차 Zero-Copy 렌더링 큐 & iPad VRAM 안전 가드]
    // ==========================================================================
    _cancelActivePdfModalRenderJob(clearQueue = false) {
      if (clearQueue) {
        this._pdfModalRenderQueue = [];
      }
      if (this._pdfFastScrollSettleTimer && clearQueue) {
        clearTimeout(this._pdfFastScrollSettleTimer);
        this._pdfFastScrollSettleTimer = null;
        this._isPdfModalFastScrolling = false;
      }
      const job = this._activePdfModalRenderJob;
      if (!job) return;
      this._activePdfModalRenderJob = null;
      if (job.renderTask && typeof job.renderTask.cancel === 'function') {
        try { job.renderTask.cancel(); } catch (e) { }
      }
      if (job.stagingCanvas && job.stagingCanvas !== job.frontCanvas) {
        try {
          job.stagingCanvas.width = 0;
          job.stagingCanvas.height = 0;
        } catch (e) { }
      }
      if (job.frontCanvas) {
        job.frontCanvas._pdfRenderTask = null;
        job.frontCanvas._pdfStagingCanvas = null;
        job.frontCanvas._isRenderingPdfPage = false;
        job.frontCanvas._renderingZoom = null;
      }
    }

    _trimFarPdfModalCanvases() {
      if (!this.pdfPageRenderStates) return;
      const center = this.pdfCurrentPage || 1;
      const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
      // 기본 페이지 해상도를 칠판급(3584px / 11.5MP)으로 복원하는 대신 아이패드 고배율 시 현재·앞·뒤(±1장, 최대 3장)만 유지해 VRAM 안전 확보
      const keepRadius = isIOS ? ((this.pdfZoom || 1.75) < 1.15 ? 2 : 1) : 3;
      const renderedKeys = Object.keys(this.pdfPageRenderStates);
      for (let i = 0; i < renderedKeys.length; i++) {
        const pNum = parseInt(renderedKeys[i], 10);
        if (!pNum || Math.abs(pNum - center) <= keepRadius) continue;
        const w = document.getElementById(`pdfPageWrapper_${pNum}`);
        if (w && w._hiResTileInfo && w._hiResTileInfo.canvas) {
          const oldT = w._hiResTileInfo.canvas;
          w._hiResTileInfo = null;
          if (oldT.parentNode === w) {
            try { w.removeChild(oldT); } catch (_) { }
          }
          try { oldT.width = 0; oldT.height = 0; } catch (_) { }
        }
        const cv = (w && w._canvasEl) || document.getElementById(`pdfPageCanvas_${pNum}`);
        if (cv) {
          if (cv._pdfRenderTask && typeof cv._pdfRenderTask.cancel === 'function') {
            try { cv._pdfRenderTask.cancel(); } catch (e) { }
            cv._pdfRenderTask = null;
          }
          if (cv._pdfStagingCanvas) {
            try { cv._pdfStagingCanvas.width = 0; cv._pdfStagingCanvas.height = 0; } catch (e) { }
            cv._pdfStagingCanvas = null;
          }
          cv._isRenderingPdfPage = false;
          cv._renderingZoom = null;
          try {
            cv.width = 1;
            cv.height = 1;
          } catch (e) { }
          cv._renderedZoom = null;
          cv._renderedScale = null;
          cv._hitMaxCap = false;
        }
        delete this.pdfPageRenderStates[pNum];
      }
    }

    _cancelPdfModalHiResTilePending() {
      if (this._pdfModalHiResTileTimer) {
        clearTimeout(this._pdfModalHiResTileTimer);
        this._pdfModalHiResTileTimer = null;
      }
      if (this._pdfModalHiResTileRenderTask && typeof this._pdfModalHiResTileRenderTask.cancel === 'function') {
        try { this._pdfModalHiResTileRenderTask.cancel(); } catch (_) { }
      }
      this._pdfModalHiResTileRenderTask = null;
      if (this._pdfModalHiResStagingCv) {
        try {
          this._pdfModalHiResStagingCv.width = 0;
          this._pdfModalHiResStagingCv.height = 0;
        } catch (_) { }
        this._pdfModalHiResStagingCv = null;
      }
      this._pdfModalHiResToken = (this._pdfModalHiResToken || 0) + 1;
    }

    _releaseWrapperModalHiResTile(wrapper) {
      if (!wrapper || !wrapper._hiResTileInfo) return;
      const info = wrapper._hiResTileInfo;
      wrapper._hiResTileInfo = null;
      if (info.canvas) {
        if (info.canvas.parentNode === wrapper) {
          try { wrapper.removeChild(info.canvas); } catch (_) { }
        }
        try {
          info.canvas.width = 0;
          info.canvas.height = 0;
        } catch (_) { }
      }
    }

    _invalidatePdfModalHiResTile(releaseAll = true, keepPagesSet = null) {
      this._cancelPdfModalHiResTilePending();
      if (!releaseAll && !keepPagesSet) return;
      const container = (typeof document !== 'undefined') ? document.getElementById('pdfPagesContainer') : null;
      if (!container) return;
      const wrappers = container.querySelectorAll('.pdf-page-wrapper');
      for (let i = 0; i < wrappers.length; i++) {
        const w = wrappers[i];
        if (!w || !w._hiResTileInfo) continue;
        const p = parseInt(w.dataset.page, 10);
        if (releaseAll || !keepPagesSet || !keepPagesSet.has(p)) {
          this._releaseWrapperModalHiResTile(w);
        }
      }
    }

    _schedulePdfModalHiResTile(delayMs = 90) {
      if (!this.isPdfModalOpen || !this.pdfDoc) return;
      if (this._pdfModalHiResTileTimer) {
        clearTimeout(this._pdfModalHiResTileTimer);
        this._pdfModalHiResTileTimer = null;
      }
      const token = (this._pdfModalHiResToken || 0) + 1;
      this._pdfModalHiResToken = token;

      this._pdfModalHiResTileTimer = setTimeout(() => {
        this._pdfModalHiResTileTimer = null;
        if (this._pdfModalHiResToken !== token || !this.isPdfModalOpen || !this.pdfDoc) return;
        if (this._pdfPinchState || this._isPdfModalFastScrolling || this._isPdfViewportPanning || this._pdfViewportInertiaRaf || this._activePdfModalRenderJob) {
          this._schedulePdfModalHiResTile(95);
          return;
        }
        const viewport = document.getElementById('pdfViewport');
        if (!viewport) return;
        const vRect = viewport.getBoundingClientRect();
        if (vRect.width < 20 || vRect.height < 20) return;

        const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
        const dpr = Math.min(2.0, Math.max(1.5, window.devicePixelRatio || 1.5));
        const center = this.pdfCurrentPage || 1;
        const total = this.pdfTotalPages || 1;
        const loP = Math.max(1, center - 1);
        const hiP = Math.min(total, center + 1);

        const neededSpecs = [];
        const keepPages = new Set();

        for (let p = loP; p <= hiP; p++) {
          const w = document.getElementById(`pdfPageWrapper_${p}`);
          if (!w) continue;
          const wRect = w.getBoundingClientRect();
          if (wRect.bottom <= vRect.top + 2 || wRect.top >= vRect.bottom - 2 || wRect.right <= vRect.left + 2 || wRect.left >= vRect.right - 2) {
            continue;
          }
          const drawW = parseFloat(w.style.width) || wRect.width;
          const drawH = parseFloat(w.style.height) || wRect.height;
          const baseCv = w._canvasEl || w.querySelector('.pdf-page-canvas');
          const basePxW = (baseCv && baseCv.width > 10) ? baseCv.width : 0;
          if (!basePxW || (drawW * dpr) <= (basePxW * 1.06)) {
            this._releaseWrapperModalHiResTile(w);
            continue;
          }

          keepPages.add(p);
          const strictL = Math.max(0, Math.floor(vRect.left - wRect.left));
          const strictT = Math.max(0, Math.floor(vRect.top - wRect.top));
          const strictR = Math.min(Math.ceil(drawW), Math.ceil(vRect.right - wRect.left));
          const strictB = Math.min(Math.ceil(drawH), Math.ceil(vRect.bottom - wRect.top));
          if ((strictR - strictL) <= 8 || (strictB - strictT) <= 8) continue;

          const ready = w._hiResTileInfo;
          const zoomMatches = Boolean(
            ready &&
            ready.canvas &&
            ready.canvas.width > 2 &&
            Math.abs(drawW - ready.renderedDrawW) <= Math.max(2, drawW * 0.03)
          );
          const coversStrict = Boolean(
            zoomMatches &&
            (ready.uL * drawW) <= (strictL + 1.5) &&
            (ready.uT * drawH) <= (strictT + 1.5) &&
            ((ready.uL + ready.uW) * drawW) >= (strictR - 1.5) &&
            ((ready.uT + ready.uH) * drawH) >= (strictB - 1.5)
          );
          if (coversStrict) continue;

          const pad = isIOS ? 96 : 144;
          const localL = Math.max(0, Math.floor((vRect.left - pad) - wRect.left));
          const localT = Math.max(0, Math.floor((vRect.top - pad) - wRect.top));
          const localR = Math.min(Math.ceil(drawW), Math.ceil((vRect.right + pad) - wRect.left));
          const localB = Math.min(Math.ceil(drawH), Math.ceil((vRect.bottom + pad) - wRect.top));
          const localW = localR - localL;
          const localH = localB - localT;
          if (localW > 8 && localH > 8) {
            neededSpecs.push({ pageNum: p, wrapper: w, drawW, drawH, localL, localT, localW, localH, dpr, isIOS });
          }
        }

        // 화면 밖이거나 저배율로 복귀한 페이지들의 기존 고해상도 타일 즉시 회수
        this._invalidatePdfModalHiResTile(false, keepPages);
        // 주의: _invalidatePdfModalHiResTile 내부에서 token이 증가하므로 새 실행 토큰 재고정
        const runToken = (this._pdfModalHiResToken || 0) + 1;
        this._pdfModalHiResToken = runToken;

        if (neededSpecs.length === 0) return;

        (async () => {
          for (let i = 0; i < neededSpecs.length; i++) {
            const spec = neededSpecs[i];
            if (this._pdfModalHiResToken !== runToken || !this.isPdfModalOpen || !this.pdfDoc || this._pdfPinchState || this._isPdfModalFastScrolling) {
              return;
            }
            let stagingCv = null;
            try {
              const page = await this.pdfDoc.getPage(spec.pageNum);
              if (this._pdfModalHiResToken !== runToken || !this.isPdfModalOpen || this._pdfPinchState) return;

              const baseVp = page.getViewport({ scale: 1.0 });
              const maxSideScale = (spec.isIOS ? 2880 : 3584) / Math.max(1, spec.localW, spec.localH);
              const maxAreaScale = Math.sqrt((spec.isIOS ? 6800000 : 10500000) / Math.max(1, spec.localW * spec.localH));
              const effTileDpr = Math.max(1.0, Math.min(spec.dpr, maxSideScale, maxAreaScale));
              const tilePxW = Math.max(2, Math.round(spec.localW * effTileDpr));
              const tilePxH = Math.max(2, Math.round(spec.localH * effTileDpr));
              const actualDpr = tilePxW / Math.max(1, spec.localW);
              const vecScale = (spec.drawW / Math.max(1, baseVp.width)) * actualDpr;
              const tileVp = page.getViewport({
                scale: vecScale,
                offsetX: -spec.localL * actualDpr,
                offsetY: -spec.localT * actualDpr
              });

              stagingCv = document.createElement('canvas');
              stagingCv.width = tilePxW;
              stagingCv.height = tilePxH;
              this._pdfModalHiResStagingCv = stagingCv;
              const tCtx = stagingCv.getContext('2d', { alpha: false }) || stagingCv.getContext('2d');
              if (!tCtx) {
                try { stagingCv.width = 0; stagingCv.height = 0; } catch (_) { }
                this._pdfModalHiResStagingCv = null;
                return;
              }
              tCtx.fillStyle = '#ffffff';
              tCtx.fillRect(0, 0, tilePxW, tilePxH);

              const rTask = page.render({ canvasContext: tCtx, viewport: tileVp });
              this._pdfModalHiResTileRenderTask = rTask;
              await rTask.promise;
              this._pdfModalHiResTileRenderTask = null;
              this._pdfModalHiResStagingCv = null;

              if (this._pdfModalHiResToken !== runToken || !this.isPdfModalOpen || !spec.wrapper.isConnected) {
                try { stagingCv.width = 0; stagingCv.height = 0; } catch (_) { }
                return;
              }

              const uL = spec.localL / Math.max(1, spec.drawW);
              const uT = spec.localT / Math.max(1, spec.drawH);
              const uW = spec.localW / Math.max(1, spec.drawW);
              const uH = spec.localH / Math.max(1, spec.drawH);

              stagingCv.className = 'pdf-modal-hires-tile';
              stagingCv.style.left = `${(uL * 100).toFixed(4)}%`;
              stagingCv.style.top = `${(uT * 100).toFixed(4)}%`;
              stagingCv.style.width = `${(uW * 100).toFixed(4)}%`;
              stagingCv.style.height = `${(uH * 100).toFixed(4)}%`;
              stagingCv.setAttribute('draggable', 'false');

              const prevInfo = spec.wrapper._hiResTileInfo;
              if (prevInfo && prevInfo.canvas && prevInfo.canvas.parentNode === spec.wrapper) {
                spec.wrapper.replaceChild(stagingCv, prevInfo.canvas);
                try { prevInfo.canvas.width = 0; prevInfo.canvas.height = 0; } catch (_) { }
              } else {
                spec.wrapper.appendChild(stagingCv);
                if (prevInfo && prevInfo.canvas) {
                  try { prevInfo.canvas.width = 0; prevInfo.canvas.height = 0; } catch (_) { }
                }
              }
              spec.wrapper._hiResTileInfo = {
                canvas: stagingCv,
                renderedDrawW: spec.drawW,
                uL, uT, uW, uH,
                actualDpr
              };
              stagingCv = null;
            } catch (err) {
              this._pdfModalHiResTileRenderTask = null;
              this._pdfModalHiResStagingCv = null;
              if (stagingCv) {
                try { stagingCv.width = 0; stagingCv.height = 0; } catch (_) { }
              }
            }
          }
        })();
      }, Math.max(20, delayMs));
    }

    _setupPdfPageObserver() {
      if (this._pdfPageObserver) {
        this._pdfPageObserver.disconnect();
        this._pdfPageObserver = null;
      }
      const viewport = document.getElementById('pdfViewport');
      if (!viewport || typeof IntersectionObserver === 'undefined') return;
      const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();

      this._pdfPageObserver = new IntersectionObserver((entries) => {
        if (!this.pdfDoc || !this.isPdfModalOpen) return;
        for (const entry of entries) {
          const wrapper = entry.target;
          wrapper._isIntersectingPdfViewport = Boolean(entry.isIntersecting);
          const pageNum = parseInt(wrapper.dataset.page, 10);
          if (!pageNum) continue;
          const canvas = wrapper._canvasEl || document.getElementById(`pdfPageCanvas_${pageNum}`);
          if (!canvas) continue;

          if (entry.isIntersecting) {
            if (!this._pdfPinchState && !this._isPdfModalFastScrolling) {
              this.renderPdfPageToCanvas(pageNum, canvas, wrapper);
            }
          } else {
            if (this._pdfModalRenderQueue && this._pdfModalRenderQueue.length > 0) {
              const qIdx = this._pdfModalRenderQueue.indexOf(pageNum);
              if (qIdx !== -1 && Math.abs(pageNum - (this.pdfCurrentPage || 1)) > 1) {
                this._pdfModalRenderQueue.splice(qIdx, 1);
              }
            }
            if (this._activePdfModalRenderJob && this._activePdfModalRenderJob.pageNum === pageNum && Math.abs(pageNum - (this.pdfCurrentPage || 1)) > 1) {
              this._cancelActivePdfModalRenderJob(false);
            }
            this._trimFarPdfModalCanvases();
          }
        }
        if (!this._pdfPinchState && !this._isPdfModalFastScrolling) {
          this._drainPdfModalRenderQueue();
        }
      }, {
        root: viewport,
        rootMargin: isIOS ? '50% 0px 50% 0px' : '85% 0px 85% 0px',
        threshold: 0.01
      });

      document.querySelectorAll('.pdf-page-wrapper').forEach((w) => {
        this._pdfPageObserver.observe(w);
      });
    }

    renderAllPdfPages(resetContainer = false) {
      if (!this.pdfDoc) return;
      const container = document.getElementById('pdfPagesContainer');
      if (!container) return;

      const currentPageToKeep = this.pdfCurrentPage || 1;
      const zoomNow = this.pdfZoom || 1.75;
      const defW = (((this.pdfDefaultPageSize && this.pdfDefaultPageSize.width) || 595) * zoomNow).toFixed(2);
      const defH = (((this.pdfDefaultPageSize && this.pdfDefaultPageSize.height) || 842) * zoomNow).toFixed(2);
      this._cachedPdfPageCssH = Math.round(parseFloat(defH));

      if (resetContainer || container.children.length !== this.pdfTotalPages) {
        this._cancelActivePdfModalRenderJob(true);
        this._invalidatePdfModalHiResTile(true);
        if (this._pdfPageObserver) {
          this._pdfPageObserver.disconnect();
          this._pdfPageObserver = null;
        }
        // WebKit/iPadOS IOSurface VRAM 즉시 반환: DOM 제거 전 기존 캔버스 및 스테이징 버퍼 명시적 0×0 해제
        container.querySelectorAll('.pdf-page-canvas').forEach((oldCv) => {
          if (oldCv._pdfRenderTask && typeof oldCv._pdfRenderTask.cancel === 'function') {
            try { oldCv._pdfRenderTask.cancel(); } catch (e) { }
            oldCv._pdfRenderTask = null;
          }
          if (oldCv._pdfStagingCanvas) {
            try { oldCv._pdfStagingCanvas.width = 0; oldCv._pdfStagingCanvas.height = 0; } catch (e) { }
            oldCv._pdfStagingCanvas = null;
          }
          try { oldCv.width = 0; oldCv.height = 0; } catch (e) { }
        });
        container.innerHTML = '';
        this.pdfPageRenderStates = {};

        const frag = document.createDocumentFragment();
        for (let p = 1; p <= this.pdfTotalPages; p++) {
          const wrapper = document.createElement('div');
          wrapper.className = 'pdf-page-wrapper';
          wrapper.id = `pdfPageWrapper_${p}`;
          wrapper.dataset.page = p;
          wrapper.style.width = `${defW}px`;
          wrapper.style.height = `${defH}px`;

          const tag = document.createElement('div');
          tag.className = 'pdf-page-number-tag';
          tag.textContent = `p.${p}`;
          wrapper.appendChild(tag);

          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page-canvas';
          canvas.id = `pdfPageCanvas_${p}`;
          canvas.style.width = `${defW}px`;
          canvas.style.height = `${defH}px`;
          canvas.setAttribute('draggable', 'false');
          canvas.addEventListener('dragstart', (e) => e.preventDefault());
          wrapper.appendChild(canvas);
          wrapper._canvasEl = canvas;

          frag.appendChild(wrapper);
        }
        container.appendChild(frag);
        this._renderPdfBatchCropOverlays();
        this._setupPdfPageObserver();
        this.renderVisiblePdfWindow(currentPageToKeep, true);
        this.updatePdfPageNavUI(currentPageToKeep, true);
      } else {
        if (!this._pdfPageObserver) {
          this._setupPdfPageObserver();
        }
        if (this._activePdfModalRenderJob && this._activePdfModalRenderJob.targetZoom !== zoomNow) {
          this._cancelActivePdfModalRenderJob(true);
        }
        this._trimFarPdfModalCanvases();
        this.renderVisiblePdfWindow(currentPageToKeep, false);
        container.querySelectorAll('.pdf-page-wrapper').forEach((w) => {
          if (!w._isIntersectingPdfViewport) return;
          const p = parseInt(w.dataset.page, 10);
          if (!p) return;
          const c = w._canvasEl || document.getElementById(`pdfPageCanvas_${p}`);
          if (c) this.renderPdfPageToCanvas(p, c, w);
        });
        this.updatePdfPageNavUI(currentPageToKeep, true);
      }
    }

    renderVisiblePdfWindow(centerPage = 1, forceReRender = false) {
      if (!this.pdfDoc) return;
      const total = this.pdfTotalPages || 1;
      centerPage = Math.max(1, Math.min(total, centerPage || 1));

      const candidates = [centerPage, centerPage + 1, centerPage - 1];
      for (const p of candidates) {
        if (p < 1 || p > total) continue;
        const wrapper = document.getElementById(`pdfPageWrapper_${p}`);
        const canvas = (wrapper && wrapper._canvasEl) || document.getElementById(`pdfPageCanvas_${p}`);
        if (!canvas || !wrapper) continue;
        if (forceReRender) {
          canvas._renderedZoom = null;
        }
        this.renderPdfPageToCanvas(p, canvas, wrapper);
      }
    }

    renderPdfPageToCanvas(pageNum, canvas, wrapper, onComplete = null) {
      if (!this.pdfDoc || !pageNum || (!this.isPdfModalOpen && !onComplete)) {
        if (onComplete) onComplete();
        return;
      }
      const targetZoom = this.pdfZoom || 1.75;
      const liveWrapper = wrapper || document.getElementById(`pdfPageWrapper_${pageNum}`);
      const liveCanvas = (liveWrapper && liveWrapper._canvasEl) || canvas || document.getElementById(`pdfPageCanvas_${pageNum}`);
      if (!liveCanvas) {
        if (onComplete) onComplete();
        return;
      }
      if (this.pdfPageRenderStates && this.pdfPageRenderStates[pageNum] && !liveCanvas._isRenderingPdfPage && liveCanvas.width > 10) {
        const dprCheck = Math.min(2.0, Math.max(1.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1.5));
        const alreadyAtMaxCap = Boolean(liveCanvas._hitMaxCap && liveCanvas._renderedScale && (targetZoom * dprCheck) >= (liveCanvas._renderedScale - 0.02));
        if (liveCanvas._renderedZoom === targetZoom || alreadyAtMaxCap) {
          liveCanvas._renderedZoom = targetZoom;
          this._schedulePdfModalHiResTile(35);
          if (onComplete) onComplete();
          return;
        }
      }
      if (this._activePdfModalRenderJob && this._activePdfModalRenderJob.pageNum === pageNum && this._activePdfModalRenderJob.targetZoom === targetZoom) {
        if (onComplete) {
          this._activePdfModalRenderJob.callbacks.push(onComplete);
        }
        return;
      }
      if (!Array.isArray(this._pdfModalRenderQueue)) {
        this._pdfModalRenderQueue = [];
      }
      if (!this._pdfModalRenderCallbacks) {
        this._pdfModalRenderCallbacks = {};
      }
      if (onComplete) {
        if (!Array.isArray(this._pdfModalRenderCallbacks[pageNum])) {
          this._pdfModalRenderCallbacks[pageNum] = [];
        }
        this._pdfModalRenderCallbacks[pageNum].push(onComplete);
      }
      if (this._pdfModalRenderQueue.indexOf(pageNum) === -1) {
        this._pdfModalRenderQueue.push(pageNum);
      }
      if (!this._pdfPinchState && (!this._isPdfModalFastScrolling || onComplete)) {
        this._drainPdfModalRenderQueue();
      }
    }

    _drainPdfModalRenderQueue() {
      if (!this.pdfDoc || this._activePdfModalRenderJob) return;
      if (this._pdfPinchState) return;
      if (!Array.isArray(this._pdfModalRenderQueue) || this._pdfModalRenderQueue.length === 0) return;

      const center = this.pdfCurrentPage || 1;
      const targetZoom = this.pdfZoom || 1.75;
      const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
      const maxDist = isIOS ? 1 : 3;

      // 현재 보고 있는 중앙 페이지를 1순위로, 그다음 아래쪽(+1)·위쪽(-1) 순으로 정렬
      this._pdfModalRenderQueue.sort((a, b) => {
        const da = Math.abs(a - center);
        const db = Math.abs(b - center);
        if (da !== db) return da - db;
        return b - a;
      });

      let nextPageNum = null;
      let nextWrapper = null;
      let nextCanvas = null;
      while (this._pdfModalRenderQueue.length > 0) {
        const candidate = this._pdfModalRenderQueue.shift();
        const cbs = (this._pdfModalRenderCallbacks && this._pdfModalRenderCallbacks[candidate]) || null;
        const hasExplicitCb = Boolean(cbs && cbs.length > 0);
        if (!this.isPdfModalOpen && !hasExplicitCb) {
          if (cbs) {
            delete this._pdfModalRenderCallbacks[candidate];
            cbs.forEach((fn) => { try { fn(); } catch (_) { } });
          }
          continue;
        }
        const w = document.getElementById(`pdfPageWrapper_${candidate}`);
        const c = (w && w._canvasEl) || document.getElementById(`pdfPageCanvas_${candidate}`);
        if (!w || !c) {
          if (cbs) {
            delete this._pdfModalRenderCallbacks[candidate];
            cbs.forEach((fn) => { try { fn(); } catch (_) { } });
          }
          continue;
        }
        if (!hasExplicitCb && Math.abs(candidate - center) > maxDist && !w._isIntersectingPdfViewport) {
          continue;
        }
        if (this.pdfPageRenderStates && this.pdfPageRenderStates[candidate] && c.width > 10) {
          const dprCheck = Math.min(2.0, Math.max(1.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1.5));
          const alreadyAtMaxCap = Boolean(c._hitMaxCap && c._renderedScale && (targetZoom * dprCheck) >= (c._renderedScale - 0.02));
          if (c._renderedZoom === targetZoom || alreadyAtMaxCap) {
            c._renderedZoom = targetZoom;
            this._schedulePdfModalHiResTile(35);
            if (cbs) {
              delete this._pdfModalRenderCallbacks[candidate];
              cbs.forEach((fn) => { try { fn(); } catch (_) { } });
            }
            continue;
          }
        }
        nextPageNum = candidate;
        nextWrapper = w;
        nextCanvas = c;
        break;
      }

      if (!nextPageNum || !nextCanvas) return;

      const callbacks = (this._pdfModalRenderCallbacks && this._pdfModalRenderCallbacks[nextPageNum]) || [];
      if (this._pdfModalRenderCallbacks) delete this._pdfModalRenderCallbacks[nextPageNum];
      const finishCallbacks = () => {
        for (let i = 0; i < callbacks.length; i++) {
          try { callbacks[i](); } catch (_) { }
        }
      };

      const jobToken = (this._pdfModalJobTokenSeq || 0) + 1;
      this._pdfModalJobTokenSeq = jobToken;
      const job = {
        token: jobToken,
        pageNum: nextPageNum,
        targetZoom,
        frontCanvas: nextCanvas,
        wrapper: nextWrapper,
        stagingCanvas: null,
        renderTask: null,
        callbacks
      };
      this._activePdfModalRenderJob = job;
      nextCanvas._isRenderingPdfPage = true;
      nextCanvas._renderingZoom = targetZoom;

      this.pdfDoc.getPage(nextPageNum).then(page => {
        if (!this.pdfDoc || this._activePdfModalRenderJob !== job || (!this.isPdfModalOpen && callbacks.length === 0)) {
          if (this._activePdfModalRenderJob === job) {
            this._activePdfModalRenderJob = null;
          }
          nextCanvas._isRenderingPdfPage = false;
          nextCanvas._renderingZoom = null;
          finishCallbacks();
          this._drainPdfModalRenderQueue();
          return;
        }

        const baseVp = page.getViewport({ scale: 1.0 });
        const cssW = (baseVp.width * targetZoom).toFixed(2);
        const cssH = (baseVp.height * targetZoom).toFixed(2);
        this._cachedPdfPageCssH = Math.round(baseVp.height * targetZoom);

        // 칠판급 선명도 복원(iPad 3584px / 11.5MP ≈ 46MB, ±1장 최대 3장 유지 ≈ 138MB) + 고배율 시 보이는 화면만 1:1 벡터 타일 보강
        const dpr = Math.min(2.0, Math.max(1.5, window.devicePixelRatio || 1.5));
        const desiredScale = targetZoom * dpr;
        const maxSideScale = (isIOS ? 3584 : 4032) / Math.max(1, baseVp.width, baseVp.height);
        const maxAreaScale = Math.sqrt((isIOS ? 11500000 : 15500000) / Math.max(1, baseVp.width * baseVp.height));
        const renderScale = Math.max(1.0, Math.min(desiredScale, maxSideScale, maxAreaScale));
        const hitMaxCap = renderScale < (desiredScale - 0.02);
        const viewport = page.getViewport({ scale: renderScale });
        const targetPxW = Math.max(1, Math.round(viewport.width));
        const targetPxH = Math.max(1, Math.round(viewport.height));

        nextCanvas.style.width = `${cssW}px`;
        nextCanvas.style.height = `${cssH}px`;
        if (nextWrapper) {
          nextWrapper.style.width = `${cssW}px`;
          nextWrapper.style.height = `${cssH}px`;
          nextWrapper._basePdfW = baseVp.width;
          nextWrapper._basePdfH = baseVp.height;
        }

        // 🌟 [Zero-Copy 무깜빡임 원자적 캔버스 스왑]:
        // 빈 페이지는 직접 렌더링하고, 이미 그려진 페이지의 배율 재렌더링은 단 1장의 오프스크린 캔버스에 완성한 뒤
        // drawImage(20MB 복사)나 프론트 캔버스 리사이즈 없이 replaceChild로 0.00ms 교체 후 구 버퍼를 즉시 0×0 반환!
        const hasExistingBitmap = Boolean(this.pdfPageRenderStates && this.pdfPageRenderStates[nextPageNum] && nextCanvas.width > 10 && nextCanvas.height > 10);
        const targetSurface = hasExistingBitmap ? document.createElement('canvas') : nextCanvas;
        if (hasExistingBitmap) {
          job.stagingCanvas = targetSurface;
          nextCanvas._pdfStagingCanvas = targetSurface;
        }
        targetSurface.width = targetPxW;
        targetSurface.height = targetPxH;

        const releaseUnusedStaging = () => {
          if (!hasExistingBitmap || !job.stagingCanvas) return;
          try {
            job.stagingCanvas.width = 0;
            job.stagingCanvas.height = 0;
          } catch (e) { }
          job.stagingCanvas = null;
          nextCanvas._pdfStagingCanvas = null;
        };

        const renderCtx = targetSurface.getContext('2d', { alpha: false }) || targetSurface.getContext('2d');
        if (!renderCtx) {
          releaseUnusedStaging();
          if (this._activePdfModalRenderJob === job) {
            this._activePdfModalRenderJob = null;
          }
          nextCanvas._pdfRenderTask = null;
          nextCanvas._isRenderingPdfPage = false;
          nextCanvas._renderingZoom = null;
          finishCallbacks();
          this._drainPdfModalRenderQueue();
          return;
        }
        renderCtx.fillStyle = '#ffffff';
        renderCtx.fillRect(0, 0, targetPxW, targetPxH);

        const renderTask = page.render({ canvasContext: renderCtx, viewport });
        job.renderTask = renderTask;
        nextCanvas._pdfRenderTask = renderTask;

        renderTask.promise.then(() => {
          if (this._activePdfModalRenderJob === job) {
            this._activePdfModalRenderJob = null;
            let activeDomCanvas = nextCanvas;
            if (hasExistingBitmap && nextWrapper && nextCanvas.parentNode === nextWrapper) {
              targetSurface.className = 'pdf-page-canvas';
              targetSurface.id = `pdfPageCanvas_${nextPageNum}`;
              targetSurface.style.width = `${cssW}px`;
              targetSurface.style.height = `${cssH}px`;
              targetSurface.setAttribute('draggable', 'false');
              targetSurface.addEventListener('dragstart', (e) => e.preventDefault());
              nextWrapper.replaceChild(targetSurface, nextCanvas);
              nextWrapper._canvasEl = targetSurface;
              job.stagingCanvas = null;
              nextCanvas._pdfStagingCanvas = null;
              nextCanvas._pdfRenderTask = null;
              nextCanvas._isRenderingPdfPage = false;
              nextCanvas._renderingZoom = null;
              try {
                nextCanvas.width = 0;
                nextCanvas.height = 0;
              } catch (e) { }
              activeDomCanvas = targetSurface;
            } else {
              releaseUnusedStaging();
            }
            activeDomCanvas._pdfRenderTask = null;
            activeDomCanvas._isRenderingPdfPage = false;
            activeDomCanvas._renderingZoom = null;
            activeDomCanvas._renderedZoom = targetZoom;
            activeDomCanvas._renderedScale = renderScale;
            activeDomCanvas._hitMaxCap = hitMaxCap;
            if (!this.pdfPageRenderStates) this.pdfPageRenderStates = {};
            this.pdfPageRenderStates[nextPageNum] = true;
            if (hitMaxCap) {
              this._schedulePdfModalHiResTile(45);
            } else if (nextWrapper) {
              this._releaseWrapperModalHiResTile(nextWrapper);
            }
            this._trimFarPdfModalCanvases();
          } else {
            releaseUnusedStaging();
            nextCanvas._pdfRenderTask = null;
            nextCanvas._isRenderingPdfPage = false;
            nextCanvas._renderingZoom = null;
          }
          finishCallbacks();
          if (!this._pdfPinchState && !this._isPdfModalFastScrolling) {
            this._drainPdfModalRenderQueue();
          }
        }).catch(err => {
          releaseUnusedStaging();
          if (this._activePdfModalRenderJob === job) {
            this._activePdfModalRenderJob = null;
          }
          nextCanvas._pdfRenderTask = null;
          nextCanvas._isRenderingPdfPage = false;
          nextCanvas._renderingZoom = null;
          if (err && err.name !== 'RenderingCancelledException') {
            console.error(`p.${nextPageNum} 렌더링 에러:`, err);
          }
          finishCallbacks();
          if (!this._pdfPinchState && !this._isPdfModalFastScrolling) {
            this._drainPdfModalRenderQueue();
          }
        });
      }).catch(() => {
        if (this._activePdfModalRenderJob === job) {
          this._activePdfModalRenderJob = null;
        }
        nextCanvas._isRenderingPdfPage = false;
        nextCanvas._renderingZoom = null;
        finishCallbacks();
        if (!this._pdfPinchState && !this._isPdfModalFastScrolling) {
          this._drainPdfModalRenderQueue();
        }
      });
    }

    _stopPdfViewportInertia() {
      const wasActive = Boolean(this._pdfViewportInertiaRaf);
      if (this._pdfViewportInertiaRaf) {
        cancelAnimationFrame(this._pdfViewportInertiaRaf);
        this._pdfViewportInertiaRaf = null;
      }
      this._pdfViewportInertiaVx = 0;
      this._pdfViewportInertiaVy = 0;
      return wasActive;
    }

    _computePdfPanReleaseVelocity(samples, nowUp) {
      if (!Array.isArray(samples) || samples.length < 2) return { vx: 0, vy: 0 };
      const last = samples[samples.length - 1];
      if (!last || (nowUp - last.t) > 65) return { vx: 0, vy: 0 };
      for (let i = samples.length - 2; i >= 0; i--) {
        const s = samples[i];
        if ((last.t - s.t) >= 32) {
          if (Math.hypot(last.x - s.x, last.y - s.y) < 2.5) {
            return { vx: 0, vy: 0 };
          }
          break;
        }
      }
      let anchor = samples[samples.length - 2];
      for (let i = 0; i < samples.length - 1; i++) {
        const dtCandidate = last.t - samples[i].t;
        if (dtCandidate >= 14 && dtCandidate <= 85) {
          anchor = samples[i];
          break;
        }
      }
      const dt = last.t - anchor.t;
      if (dt < 6) return { vx: 0, vy: 0 };
      let vx = -(last.x - anchor.x) / dt;
      let vy = -(last.y - anchor.y) / dt;
      const mag = Math.hypot(vx, vy);
      const maxSpeed = 4.2;
      if (mag > maxSpeed) {
        vx = (vx / mag) * maxSpeed;
        vy = (vy / mag) * maxSpeed;
      }
      return { vx, vy };
    }

    _startPdfViewportInertia(viewport, initVx, initVy) {
      this._stopPdfViewportInertia();
      if (!viewport || !this.isPdfModalOpen || this.isPdfCropModeActive) return;
      let vx = Number(initVx) || 0;
      let vy = Number(initVy) || 0;
      const mag = Math.hypot(vx, vy);
      if (mag < 0.18) return;
      const maxSpeed = 4.2;
      if (mag > maxSpeed) {
        vx = (vx / mag) * maxSpeed;
        vy = (vy / mag) * maxSpeed;
      }
      this._pdfViewportInertiaVx = vx;
      this._pdfViewportInertiaVy = vy;
      let posLeft = viewport.scrollLeft;
      let posTop = viewport.scrollTop;
      let prevT = performance.now();

      const step = (now) => {
        if (!this.isPdfModalOpen || this.isPdfCropModeActive || this._isPdfViewportPanning || this._pdfPinchState) {
          this._stopPdfViewportInertia();
          return;
        }
        const dt = Math.min(34, Math.max(6, now - prevT));
        prevT = now;
        const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

        if (maxLeft <= 0.5) {
          posLeft = 0;
          vx = 0;
        } else {
          posLeft += vx * dt;
          if (posLeft <= 0) {
            posLeft = 0;
            vx = 0;
          } else if (posLeft >= maxLeft) {
            posLeft = maxLeft;
            vx = 0;
          }
        }

        if (maxTop <= 0.5) {
          posTop = 0;
          vy = 0;
        } else {
          posTop += vy * dt;
          if (posTop <= 0) {
            posTop = 0;
            vy = 0;
          } else if (posTop >= maxTop) {
            posTop = maxTop;
            vy = 0;
          }
        }

        viewport.scrollLeft = posLeft;
        viewport.scrollTop = posTop;
        this.savedPdfScrollLeft = viewport.scrollLeft;
        this.savedPdfScrollTop = viewport.scrollTop;

        const decay = Math.pow(0.925, dt / 16.667);
        vx *= decay;
        vy *= decay;
        this._pdfViewportInertiaVx = vx;
        this._pdfViewportInertiaVy = vy;

        if (Math.hypot(vx, vy) < 0.05) {
          this._stopPdfViewportInertia();
          return;
        }
        this._pdfViewportInertiaRaf = requestAnimationFrame(step);
      };

      this._pdfViewportInertiaRaf = requestAnimationFrame(step);
    }

    scrollToPdfPage(pageNum) {
      this._stopPdfViewportInertia();
      if (!this.pdfDoc) return;
      pageNum = Math.max(1, Math.min(pageNum, this.pdfTotalPages));
      const target = document.getElementById(`pdfPageWrapper_${pageNum}`);
      const viewport = document.getElementById('pdfViewport');
      if (target && viewport) {
        viewport.scrollTop = Math.max(0, target.offsetTop - 20);
        this.savedPdfScrollTop = viewport.scrollTop;
        this._lastPdfScrollSampleTop = viewport.scrollTop;
        this._lastPdfScrollSampleLeft = viewport.scrollLeft;
        this._lastPdfScrollSampleT = performance.now();
      }
      this.updatePdfPageNavUI(pageNum, false);
    }

    onPdfViewportScroll() {
      const viewport = document.getElementById('pdfViewport');
      if (!viewport || !this.pdfDoc) return;

      const curTop = viewport.scrollTop;
      const curLeft = viewport.scrollLeft;
      if (this.isPdfModalOpen) {
        this.savedPdfScrollTop = curTop;
        this.savedPdfScrollLeft = curLeft;
      }

      const nowS = performance.now();
      const prevT = this._lastPdfScrollSampleT || 0;
      const prevTop = (typeof this._lastPdfScrollSampleTop === 'number') ? this._lastPdfScrollSampleTop : curTop;
      const prevLeft = (typeof this._lastPdfScrollSampleLeft === 'number') ? this._lastPdfScrollSampleLeft : curLeft;
      const dt = nowS - prevT;
      this._lastPdfScrollSampleT = nowS;
      this._lastPdfScrollSampleTop = curTop;
      this._lastPdfScrollSampleLeft = curLeft;

      const pageH = this._cachedPdfPageCssH || Math.round(((this.pdfDefaultPageSize && this.pdfDefaultPageSize.height) || 842) * (this.pdfZoom || 1.75));
      const stride = Math.max(100, pageH + 28);
      const approxPage = Math.floor((curTop + viewport.clientHeight * 0.35 - 24) / stride) + 1;
      const currentVisiblePage = Math.max(1, Math.min(this.pdfTotalPages || 1, approxPage));

      if (currentVisiblePage !== this.pdfCurrentPage) {
        this.updatePdfPageNavUI(currentVisiblePage, true);
      }

      // 고속 플릭 스크롤 중(> 1.8px/ms)에는 스쳐 지나가는 페이지들의 헛렌더링을 유예하고 감속 즉시 중앙 페이지부터 렌더링
      if (!this._pdfPinchState && dt > 4 && dt < 120) {
        const speed = Math.hypot(curTop - prevTop, curLeft - prevLeft) / dt;
        if (speed > 1.8) {
          this._isPdfModalFastScrolling = true;
          this._cancelPdfModalHiResTilePending();
          if (this._activePdfModalRenderJob && Math.abs(this._activePdfModalRenderJob.pageNum - currentVisiblePage) > 1) {
            this._cancelActivePdfModalRenderJob(false);
          }
          if (this._pdfFastScrollSettleTimer) {
            clearTimeout(this._pdfFastScrollSettleTimer);
          }
          this._pdfFastScrollSettleTimer = setTimeout(() => {
            this._pdfFastScrollSettleTimer = null;
            this._isPdfModalFastScrolling = false;
            if (!this.isPdfModalOpen || !this.pdfDoc || this._pdfPinchState) return;
            this._trimFarPdfModalCanvases();
            this.renderVisiblePdfWindow(this.pdfCurrentPage || 1, false);
            this._drainPdfModalRenderQueue();
            this._schedulePdfModalHiResTile(65);
          }, 85);
          return;
        }
      }
      if (!this._pdfPinchState && !this._isPdfModalFastScrolling && (this.pdfZoom || 1.75) > 1.6) {
        this._schedulePdfModalHiResTile(95);
      }
    }

    updatePdfPageNavUI(pageNum, fromScroll = false) {
      const prevPage = this.pdfCurrentPage;
      this.pdfCurrentPage = pageNum;
      const input = document.getElementById('inputPdfCurrentPage');
      if (input) input.value = pageNum;

      const btnPrev = document.getElementById('btnPdfPrevPage');
      const btnNext = document.getElementById('btnPdfNextPage');
      if (btnPrev) btnPrev.disabled = (pageNum <= 1);
      if (btnNext) btnNext.disabled = (pageNum >= this.pdfTotalPages);

      if (!fromScroll && prevPage !== pageNum) {
        this.renderVisiblePdfWindow(pageNum, false);
      }
    }

    setPdfZoom(zoom, options = null) {
      this._stopPdfViewportInertia();
      const prevZoom = this.pdfZoom || 1.5;
      const nextZoom = Math.max(0.5, Math.min(zoom, 5.0));
      const isFastPreview = Boolean(options && options.fastPreview);
      const isImmediateCommit = Boolean(options && options.immediateCommit);
      if (!isFastPreview && !isImmediateCommit && Math.abs(nextZoom - prevZoom) < 0.002) return;

      const viewport = document.getElementById('pdfViewport');
      const ratio = nextZoom / prevZoom;
      const prevScrollTop = viewport ? viewport.scrollTop : 0;
      const prevScrollLeft = viewport ? viewport.scrollLeft : 0;
      const prevCenterOffset = viewport ? (prevScrollTop + viewport.clientHeight / 2) : 0;
      const prevCenterOffsetX = viewport ? (prevScrollLeft + viewport.clientWidth / 2) : 0;

      this.pdfZoom = nextZoom;
      const lbl = document.getElementById('lblPdfZoom');
      if (lbl) lbl.textContent = `${Math.round(this.pdfZoom * 100)}%`;

      // 기존 페이지 래퍼 크기를 즉시 비례 스케일링하여 스크롤 위치가 첫 페이지로 튀지 않게 고정!
      document.querySelectorAll('.pdf-page-wrapper').forEach(w => {
        const c = w._canvasEl || w.querySelector('.pdf-page-canvas');
        if (!w._basePdfW || !w._basePdfH) {
          const curW = parseFloat(w.style.width) || w.offsetWidth;
          const curH = parseFloat(w.style.height) || w.offsetHeight;
          if (curW > 0 && curH > 0) {
            w._basePdfW = curW / prevZoom;
            w._basePdfH = curH / prevZoom;
          }
        }
        if (w._basePdfW && w._basePdfH) {
          const nw = (w._basePdfW * nextZoom).toFixed(2);
          const nh = (w._basePdfH * nextZoom).toFixed(2);
          w.style.width = `${nw}px`;
          w.style.height = `${nh}px`;
          if (c) {
            c.style.width = `${nw}px`;
            c.style.height = `${nh}px`;
          }
        } else {
          const curW = parseFloat(w.style.width) || w.offsetWidth;
          const curH = parseFloat(w.style.height) || w.offsetHeight;
          if (curW > 0 && curH > 0) {
            const nw = (curW * ratio).toFixed(2);
            const nh = (curH * ratio).toFixed(2);
            w.style.width = `${nw}px`;
            w.style.height = `${nh}px`;
            if (c) {
              c.style.width = `${nw}px`;
              c.style.height = `${nh}px`;
            }
          }
        }
      });

      if (viewport) {
        if (options && options.anchorPageEl && typeof options.anchorRelX === 'number' && typeof options.anchorRelY === 'number') {
          // 🎯 페이지 래퍼의 실제 화면 좌표(margin: 0 auto 중앙 정렬 여백 및 페이지 간 gap: 28px 자동 반영)를 기준으로 0.0px 오차 보정!
          const newRect = options.anchorPageEl.getBoundingClientRect();
          const ptClientX = newRect.left + options.anchorRelX * newRect.width;
          const ptClientY = newRect.top + options.anchorRelY * newRect.height;
          const newScrollLeft = (viewport.scrollWidth > viewport.clientWidth)
            ? Math.max(0, viewport.scrollLeft + (ptClientX - options.currentMidClientX))
            : 0;
          const newScrollTop = Math.max(0, viewport.scrollTop + (ptClientY - options.currentMidClientY));
          viewport.scrollTop = newScrollTop;
          viewport.scrollLeft = newScrollLeft;
          this.savedPdfScrollTop = viewport.scrollTop;
          this.savedPdfScrollLeft = viewport.scrollLeft;
        } else if (options && typeof options.anchorContentY === 'number' && typeof options.anchorRatio === 'number') {
          const newScrollTop = Math.max(0, options.anchorContentY * options.anchorRatio - options.currentMidY);
          const newScrollLeft = Math.max(0, options.anchorContentX * options.anchorRatio - options.currentMidX);
          viewport.scrollTop = newScrollTop;
          viewport.scrollLeft = newScrollLeft;
          this.savedPdfScrollTop = newScrollTop;
          this.savedPdfScrollLeft = newScrollLeft;
        } else {
          if (prevScrollTop > 0 || ratio > 1) {
            const newScrollTop = Math.max(0, Math.round(prevCenterOffset * ratio - viewport.clientHeight / 2));
            viewport.scrollTop = newScrollTop;
            this.savedPdfScrollTop = newScrollTop;
          }
          if (viewport.scrollWidth > viewport.clientWidth) {
            const newScrollLeft = Math.max(0, Math.round(prevCenterOffsetX * ratio - viewport.clientWidth / 2));
            viewport.scrollLeft = newScrollLeft;
            this.savedPdfScrollLeft = newScrollLeft;
          } else {
            viewport.scrollLeft = 0;
            this.savedPdfScrollLeft = 0;
          }
        }
        this._lastPdfScrollSampleTop = viewport.scrollTop;
        this._lastPdfScrollSampleLeft = viewport.scrollLeft;
        this._lastPdfScrollSampleT = performance.now();
        this._isPdfModalFastScrolling = false;
        if (this._pdfFastScrollSettleTimer) {
          clearTimeout(this._pdfFastScrollSettleTimer);
          this._pdfFastScrollSettleTimer = null;
        }
      }

      this._cachedPdfPageCssH = Math.round(((this.pdfDefaultPageSize && this.pdfDefaultPageSize.height) || 842) * nextZoom);
      if (nextZoom <= 1.4) {
        this._invalidatePdfModalHiResTile(true);
      } else {
        this._cancelPdfModalHiResTilePending();
      }
      if (this._pdfPinchRenderTimer) {
        clearTimeout(this._pdfPinchRenderTimer);
        this._pdfPinchRenderTimer = null;
      }
      if (isImmediateCommit) {
        this.onPdfViewportScroll();
        this.renderAllPdfPages(false);
        if (nextZoom > 1.4) this._schedulePdfModalHiResTile(45);
      } else if (!isFastPreview) {
        this._pdfPinchRenderTimer = setTimeout(() => {
          this._pdfPinchRenderTimer = null;
          this.renderAllPdfPages(false);
          if (this.pdfZoom > 1.4) this._schedulePdfModalHiResTile(45);
        }, 95);
      }
    }

    fitPdfWidth() {
      const viewport = document.getElementById('pdfViewport');
      if (!viewport || !this.pdfDoc) return;

      this.pdfDoc.getPage(1).then(page => {
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const availableWidth = viewport.clientWidth - 64;
        const newZoom = Math.max(0.8, Math.min(2.8, (availableWidth * 0.88) / unscaledViewport.width));
        this.setPdfZoom(newZoom);
      });
    }

    togglePdfCropMode(forceVal = null, options = null) {
      const silentToast = Boolean(options && options.silentToast);
      const keepBatchMode = Boolean(options && options.keepBatchMode);
      this._stopPdfViewportInertia();
      this._clearPdfViewerPinchPreviewTransforms();
      if (this._pdfTouchPointers) this._pdfTouchPointers.clear();
      const prevState = Boolean(this.isPdfCropModeActive);
      let nextState = (forceVal !== null) ? Boolean(forceVal) : !prevState;
      if (this.lessonTeachingMode === 'page') {
        nextState = false;
      }
      this.isPdfCropModeActive = nextState;

      if (!nextState && !keepBatchMode && (!Array.isArray(this._pdfBatchSessionRecords) || this._pdfBatchSessionRecords.length === 0)) {
        this._isPdfBatchCropMode = false;
      }

      const viewport = document.getElementById('pdfViewport');
      if (viewport) viewport.classList.toggle('crop-mode', this.isPdfCropModeActive);

      const statusText = document.getElementById('pdfCropStatusText');
      if (statusText) {
        if (this.isPdfCropModeActive) {
          statusText.innerHTML = '<b>문제 영역을 네모로 드래그하세요</b>';
        } else {
          statusText.innerHTML = '';
        }
      }

      this.syncPdfModalModeUI();

      if (!silentToast) {
        if (forceVal === null) {
          if (this.isPdfCropModeActive) {
            this.showToast(this._isPdfBatchCropMode
              ? '📑 연속 캡처: 문제 영역을 드래그하면 슬라이드로 자동 추가됩니다'
              : '✂️ 영역 캡처 켜짐: 원하는 문제 영역을 네모로 드래그하세요 (연속 추가는 옆 [연속 캡처])');
          } else {
            this.showToast('✋ 영역 캡처 꺼짐: 드래그하여 PDF 화면을 이동할 수 있습니다');
          }
        } else if (this.isPdfCropModeActive) {
          this.showToast('✂️ 문제 영역을 네모로 드래그하세요');
        }
      }

      const cropBox = document.getElementById('pdfCropBox');
      if (cropBox) cropBox.style.display = 'none';
      this.isPdfCropping = false;
    }

    initPdfCropInteractions() {
      const viewport = document.getElementById('pdfViewport');
      const cropBox = document.getElementById('pdfCropBox');
      if (!viewport || !cropBox) return;

      window.addEventListener('dragstart', (e) => {
        if (this.isPdfCropModeActive || this.isPdfCropping) {
          e.preventDefault();
        }
      });

      viewport.addEventListener('dragstart', (e) => e.preventDefault());

      // Safari 고유 멀티터치 제스처(탭 개요 창 축소 / 페이지 줌) 최상위 캡처 단계 원천 차단 & 트랙패드 핀치 지원
      this._lastPdfNativeTouchTs = 0;
      let trackpadGestureBaseZoom = null;
      let trackpadWheelCommitTimer = null;
      const schedulePdfTrackpadZoomCommit = () => {
        if (trackpadWheelCommitTimer) clearTimeout(trackpadWheelCommitTimer);
        trackpadWheelCommitTimer = setTimeout(() => {
          trackpadWheelCommitTimer = null;
          if (!this.isPdfModalOpen || !this.pdfDoc || this._pdfPinchState) return;
          this.onPdfViewportScroll();
          this.renderAllPdfPages(false);
          if ((this.pdfZoom || 1.5) > 1.4) this._schedulePdfModalHiResTile(45);
        }, 110);
      };

      const onDocPdfSafariGestureStart = (e) => {
        if (!this.isPdfModalOpen) return;
        if (e.cancelable !== false) e.preventDefault();
        const isRecentTouch = (performance.now() - (this._lastPdfNativeTouchTs || 0)) < 450;
        if (!isRecentTouch && !this._pdfPinchState && viewport.contains(e.target)) {
          trackpadGestureBaseZoom = this.pdfZoom || 1.5;
        } else {
          trackpadGestureBaseZoom = null;
        }
      };
      const onDocPdfSafariGestureChange = (e) => {
        if (!this.isPdfModalOpen) return;
        if (e.cancelable !== false) e.preventDefault();
        const isRecentTouch = (performance.now() - (this._lastPdfNativeTouchTs || 0)) < 450;
        if (
          !isRecentTouch &&
          !this._pdfPinchState &&
          typeof trackpadGestureBaseZoom === 'number' &&
          typeof e.scale === 'number' &&
          Number.isFinite(e.scale) &&
          e.scale > 0
        ) {
          const targetZoom = Math.max(0.6, Math.min(5.0, trackpadGestureBaseZoom * e.scale));
          const vRect = viewport.getBoundingClientRect();
          const cx = (typeof e.clientX === 'number' && e.clientX > 0) ? e.clientX : (vRect.left + vRect.width * 0.5);
          const cy = (typeof e.clientY === 'number' && e.clientY > 0) ? e.clientY : (vRect.top + vRect.height * 0.5);
          const { anchorPageEl, anchorRelX, anchorRelY } = capturePdfAnchorAtClientPoint(cx, cy);
          this.setPdfZoom(targetZoom, {
            anchorPageEl,
            anchorRelX,
            anchorRelY,
            currentMidClientX: cx,
            currentMidClientY: cy,
            fastPreview: true
          });
          schedulePdfTrackpadZoomCommit();
        }
      };
      const onDocPdfSafariGestureEnd = (e) => {
        if (!this.isPdfModalOpen) return;
        if (e.cancelable !== false) e.preventDefault();
        if (trackpadGestureBaseZoom !== null) {
          trackpadGestureBaseZoom = null;
          schedulePdfTrackpadZoomCommit();
        }
      };
      document.addEventListener('gesturestart', onDocPdfSafariGestureStart, { capture: true, passive: false });
      document.addEventListener('gesturechange', onDocPdfSafariGestureChange, { capture: true, passive: false });
      document.addEventListener('gestureend', onDocPdfSafariGestureEnd, { capture: true, passive: false });

      // 모달 헤더·테두리·백드롭에 손가락이 걸친 멀티터치 핀치도 최상위 캡처 단계에서 브라우저 전달 차단
      const blockPdfModalMultiTouch = (e) => {
        if (!this.isPdfModalOpen) return;
        if (e.touches && e.touches.length >= 2) {
          this._lastPdfNativeTouchTs = performance.now();
          if (e.cancelable !== false) e.preventDefault();
        }
      };
      document.addEventListener('touchstart', blockPdfModalMultiTouch, { capture: true, passive: false });
      document.addEventListener('touchmove', blockPdfModalMultiTouch, { capture: true, passive: false });

      // 마우스 측면 뒤로가기 버튼(버튼 3, 4) 오작동 방지
      window.addEventListener('pointerdown', (e) => {
        if (this.isPdfModalOpen && (e.button === 3 || e.button === 4)) {
          e.preventDefault();
        }
      });

      // 🌟 [아이패드 / 태블릿 PDF 모달 뷰어(#pdfViewport) 120Hz 무리플로우 GPU 핀치 줌 & 2손가락 이동] 🌟
      this._pdfTouchPointers = new Map();
      this._pdfPinchState = null;
      this._pdfPinchMoveRaf = null;

      const capturePdfAnchorAtClientPoint = (midClientX, midClientY) => {
        let anchorPageEl = null;
        let bestDistY = Infinity;
        const centerP = this.pdfCurrentPage || 1;
        const totalP = this.pdfTotalPages || 1;
        const loP = Math.max(1, centerP - 5);
        const hiP = Math.min(totalP, centerP + 5);
        for (let p = loP; p <= hiP; p++) {
          const w = document.getElementById(`pdfPageWrapper_${p}`);
          if (!w) continue;
          const r = w.getBoundingClientRect();
          const dy = (midClientY < r.top) ? (r.top - midClientY) : (midClientY > r.bottom ? (midClientY - r.bottom) : 0);
          if (dy < bestDistY) {
            bestDistY = dy;
            anchorPageEl = w;
          }
        }
        if (!anchorPageEl) {
          document.querySelectorAll('.pdf-page-wrapper').forEach(w => {
            const r = w.getBoundingClientRect();
            const dy = (midClientY < r.top) ? (r.top - midClientY) : (midClientY > r.bottom ? (midClientY - r.bottom) : 0);
            if (dy < bestDistY) {
              bestDistY = dy;
              anchorPageEl = w;
            }
          });
        }
        let anchorRelX = 0.5;
        let anchorRelY = 0.5;
        if (anchorPageEl) {
          const pRect = anchorPageEl.getBoundingClientRect();
          if (pRect.width > 0) anchorRelX = (midClientX - pRect.left) / pRect.width;
          if (pRect.height > 0) anchorRelY = (midClientY - pRect.top) / pRect.height;
        }
        return { anchorPageEl, anchorRelX, anchorRelY };
      };

      const endPdfViewerPinch = (opts = null) => {
        if (this._pdfPinchMoveRaf) {
          cancelAnimationFrame(this._pdfPinchMoveRaf);
          this._pdfPinchMoveRaf = null;
        }
        const st = this._pdfPinchState;
        if (!st) return;
        if (st._hasPendingMove) {
          applyPdfViewerPinchStep();
        }
        this._pdfPinchState = null;

        if (Array.isArray(st.previewItems)) {
          for (let i = 0; i < st.previewItems.length; i++) {
            const el = st.previewItems[i].el;
            if (el) {
              el.style.transform = '';
              el.style.transformOrigin = '';
              el.style.willChange = '';
            }
          }
        }
        viewport.classList.remove('pinching-gpu');

        if (this._pdfPinchRenderTimer) {
          clearTimeout(this._pdfPinchRenderTimer);
          this._pdfPinchRenderTimer = null;
        }

        const skipReRender = Boolean(opts && opts.skipReRender);
        if (st.hadZoomChange) {
          this.setPdfZoom(st.previewZoom, {
            anchorPageEl: st.anchorPageEl,
            anchorRelX: st.anchorRelX,
            anchorRelY: st.anchorRelY,
            currentMidClientX: st.smoothMidClientX,
            currentMidClientY: st.smoothMidClientY,
            immediateCommit: !skipReRender
          });
        } else if (st.hadPanChange && st.anchorPageEl) {
          const pRect = st.anchorPageEl.getBoundingClientRect();
          const ptClientX = pRect.left + st.anchorRelX * pRect.width;
          const ptClientY = pRect.top + st.anchorRelY * pRect.height;
          if (viewport.scrollWidth > viewport.clientWidth) {
            viewport.scrollLeft = Math.max(0, viewport.scrollLeft + (ptClientX - st.smoothMidClientX));
          }
          viewport.scrollTop = Math.max(0, viewport.scrollTop + (ptClientY - st.smoothMidClientY));
          this.savedPdfScrollLeft = viewport.scrollLeft;
          this.savedPdfScrollTop = viewport.scrollTop;
          if (!skipReRender) {
            this.onPdfViewportScroll();
            this._drainPdfModalRenderQueue();
            this._schedulePdfModalHiResTile(65);
          }
        } else if (!skipReRender) {
          this._drainPdfModalRenderQueue();
          this._schedulePdfModalHiResTile(85);
        }
      };

      const startPdfViewerPinch = (p1, p2) => {
        if (this._pdfPinchState) {
          endPdfViewerPinch({ skipReRender: true });
        }
        this._stopPdfViewportInertia();
        this._cancelActivePdfModalRenderJob(false);
        this._cancelPdfModalHiResTilePending();
        this.isPdfCropping = false;
        if (this._pdfViewportPanStart && this._pdfViewportPanStart.pointerId !== undefined) {
          try { viewport.releasePointerCapture(this._pdfViewportPanStart.pointerId); } catch (_) { }
        }
        this._isPdfViewportPanning = false;
        this._pdfViewportPanStart = null;
        viewport.classList.remove('panning-active');
        if (cropBox) cropBox.style.display = 'none';
        if (this.activeCropPointerId !== null && this.activeCropPointerId !== undefined) {
          try { viewport.releasePointerCapture(this.activeCropPointerId); } catch (err) { }
          this.activeCropPointerId = null;
        }

        // UIScrollView 잔여 관성을 레이아웃 변경 없이 즉시 브레이크
        const initScrollTop = viewport.scrollTop;
        const initScrollLeft = viewport.scrollLeft;
        viewport.scrollTop = initScrollTop;
        viewport.scrollLeft = initScrollLeft;

        const vRect = viewport.getBoundingClientRect();
        const midClientX = (p1.x + p2.x) * 0.5;
        const midClientY = (p1.y + p2.y) * 0.5;
        const midX = midClientX - vRect.left;
        const midY = midClientY - vRect.top;
        const dist = Math.max(24, Math.hypot(p2.x - p1.x, p2.y - p1.y));
        const { anchorPageEl, anchorRelX, anchorRelY } = capturePdfAnchorAtClientPoint(midClientX, midClientY);

        const anchorPageNum = (anchorPageEl && parseInt(anchorPageEl.dataset.page, 10)) || this.pdfCurrentPage || 1;
        const totalP = this.pdfTotalPages || 1;
        const loP = Math.max(1, anchorPageNum - 4);
        const hiP = Math.min(totalP, anchorPageNum + 4);
        const previewItems = [];
        for (let p = loP; p <= hiP; p++) {
          const w = document.getElementById(`pdfPageWrapper_${p}`);
          if (!w) continue;
          const r = w.getBoundingClientRect();
          w.style.transformOrigin = '0 0';
          w.style.willChange = 'transform';
          previewItems.push({
            el: w,
            initLeft: r.left - vRect.left,
            initTop: r.top - vRect.top
          });
        }
        viewport.classList.add('pinching-gpu');

        const startZoom = this.pdfZoom || 1.5;
        this._pdfPinchState = {
          id1: p1.id,
          id2: p2.id,
          startDist: dist,
          smoothDist: dist,
          startZoom,
          previewZoom: startZoom,
          hadZoomChange: false,
          hadPanChange: false,
          vRectLeft: vRect.left,
          vRectTop: vRect.top,
          initScrollLeft,
          initScrollTop,
          startMidX: midX,
          startMidY: midY,
          smoothMidClientX: midClientX,
          smoothMidClientY: midClientY,
          anchorPageEl,
          anchorRelX,
          anchorRelY,
          previewItems,
          lblEl: document.getElementById('lblPdfZoom'),
          latestP1: { id: p1.id, x: p1.x, y: p1.y },
          latestP2: { id: p2.id, x: p2.x, y: p2.y },
          _hasPendingMove: false
        };
      };

      const applyPdfViewerPinchStep = () => {
        const st = this._pdfPinchState;
        if (!st || !st._hasPendingMove || !st.latestP1 || !st.latestP2) return;
        st._hasPendingMove = false;
        const p1 = st.latestP1;
        const p2 = st.latestP2;
        const rawMidClientX = (p1.x + p2.x) * 0.5;
        const rawMidClientY = (p1.y + p2.y) * 0.5;
        const rawDist = Math.max(24, Math.hypot(p2.x - p1.x, p2.y - p1.y));

        // 정지 상태 미세 정전식 노이즈만 흡수하고 이동 시 손가락 끝을 1:1 즉각 추종
        const jitterMid = Math.hypot(rawMidClientX - st.smoothMidClientX, rawMidClientY - st.smoothMidClientY);
        const alphaMid = (jitterMid < 0.8) ? 0.45 : 0.88;
        st.smoothMidClientX += (rawMidClientX - st.smoothMidClientX) * alphaMid;
        st.smoothMidClientY += (rawMidClientY - st.smoothMidClientY) * alphaMid;

        const jitterDist = Math.abs(rawDist - st.smoothDist);
        const alphaDist = (jitterDist < 0.8) ? 0.45 : 0.88;
        st.smoothDist += (rawDist - st.smoothDist) * alphaDist;

        const distDelta = st.smoothDist - st.startDist;
        const deadzonePx = 2.5;
        const effDelta = Math.abs(distDelta) <= deadzonePx
          ? 0
          : (distDelta - Math.sign(distDelta) * deadzonePx);
        const effDist = Math.max(24, st.startDist + effDelta);
        const nextZoom = Math.max(0.6, Math.min(5.0, st.startZoom * (effDist / st.startDist)));
        const scaleRatio = nextZoom / st.startZoom;

        st.previewZoom = nextZoom;
        if (Math.abs(nextZoom - st.startZoom) > 0.002) {
          st.hadZoomChange = true;
        }
        const curMidX = st.smoothMidClientX - st.vRectLeft;
        const curMidY = st.smoothMidClientY - st.vRectTop;
        if (Math.hypot(curMidX - st.startMidX, curMidY - st.startMidY) > 1.5) {
          st.hadPanChange = true;
        }

        if (st.lblEl) {
          st.lblEl.textContent = `${Math.round(nextZoom * 100)}%`;
        }

        const scrollDriftX = viewport.scrollLeft - st.initScrollLeft;
        const scrollDriftY = viewport.scrollTop - st.initScrollTop;
        const panShiftX = (curMidX - st.startMidX) + scrollDriftX;
        const panShiftY = (curMidY - st.startMidY) + scrollDriftY;
        const scaleMinusOne = scaleRatio - 1;
        const scaleStr = scaleRatio.toFixed(5);

        const items = st.previewItems;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const dx = panShiftX + (item.initLeft - st.startMidX) * scaleMinusOne;
          const dy = panShiftY + (item.initTop - st.startMidY) * scaleMinusOne;
          item.el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${scaleStr})`;
        }
      };

      const movePdfViewerPinch = (p1, p2) => {
        if (!this._pdfPinchState) {
          startPdfViewerPinch(p1, p2);
          return;
        }
        let ptA = p1;
        let ptB = p2;
        if (
          p1.id !== undefined && p2.id !== undefined &&
          this._pdfPinchState.id1 !== undefined && this._pdfPinchState.id2 !== undefined
        ) {
          if (p1.id === this._pdfPinchState.id2 && p2.id === this._pdfPinchState.id1) {
            ptA = p2;
            ptB = p1;
          } else if (p1.id !== this._pdfPinchState.id1 || p2.id !== this._pdfPinchState.id2) {
            startPdfViewerPinch(p1, p2);
            return;
          }
        }
        this._pdfPinchState.latestP1 = { id: ptA.id, x: ptA.x, y: ptA.y };
        this._pdfPinchState.latestP2 = { id: ptB.id, x: ptB.x, y: ptB.y };
        this._pdfPinchState._hasPendingMove = true;
        if (!this._pdfPinchMoveRaf) {
          this._pdfPinchMoveRaf = requestAnimationFrame(() => {
            this._pdfPinchMoveRaf = null;
            applyPdfViewerPinchStep();
          });
        }
      };

      const hasNativeTouchEvents = ('ontouchstart' in window);

      // iOS / iPadOS Safari & Android TouchEvents 직결 지원:
      // #graphCanvas · #smartNoteViewerOverlay와 동일하게 첫 손가락 touchstart부터 즉시 preventDefault()를 수행하여
      // Safari 네이티브 '탭 개요 보기(Tab Overview)' 창 전체 축소 제스처 선점을 100% 원천 차단하고,
      // 1손가락 이동은 120Hz 직결 패닝 + 관성 플링(_startPdfViewportInertia) + 0ms Touch-to-Stop으로 구동!
      viewport.addEventListener('touchstart', (e) => {
        this._lastPdfNativeTouchTs = performance.now();
        this._stopPdfViewportInertia();
        if (e.cancelable !== false) e.preventDefault();
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && typeof ae.blur === 'function') {
          ae.blur();
        }
        if (e.touches && e.touches.length >= 2) {
          if (this._isPdfViewportPanning) {
            if (this._pdfViewportPanStart && this._pdfViewportPanStart.pointerId !== undefined) {
              try { viewport.releasePointerCapture(this._pdfViewportPanStart.pointerId); } catch (_) { }
            }
            this._isPdfViewportPanning = false;
            this._pdfViewportPanStart = null;
            viewport.classList.remove('panning-active');
          }
          if (this._pdfPinchState && this._pdfPinchState.id1 !== undefined && this._pdfPinchState.id2 !== undefined) {
            let has1 = false;
            let has2 = false;
            for (let i = 0; i < e.touches.length; i++) {
              if (e.touches[i].identifier === this._pdfPinchState.id1) has1 = true;
              if (e.touches[i].identifier === this._pdfPinchState.id2) has2 = true;
            }
            if (has1 && has2) return;
          }
          startPdfViewerPinch(
            { id: e.touches[0].identifier, x: e.touches[0].clientX, y: e.touches[0].clientY },
            { id: e.touches[1].identifier, x: e.touches[1].clientX, y: e.touches[1].clientY }
          );
          return;
        }
        if (e.touches && e.touches.length === 1 && !this.isPdfCropModeActive && !this._pdfPinchState) {
          const t0 = e.touches[0];
          const nowT = performance.now();
          this._isPdfViewportPanning = true;
          this._pdfViewportPanStart = {
            clientX: t0.clientX,
            clientY: t0.clientY,
            scrollLeft: viewport.scrollLeft,
            scrollTop: viewport.scrollTop,
            touchId: t0.identifier,
            isTouchPan: true,
            samples: [{ x: t0.clientX, y: t0.clientY, t: nowT }]
          };
          viewport.classList.add('panning-active');
        }
      }, { passive: false });

      viewport.addEventListener('touchmove', (e) => {
        this._lastPdfNativeTouchTs = performance.now();
        if (!e.touches || e.touches.length === 0) return;
        if (e.cancelable !== false) e.preventDefault();
        if (e.touches.length >= 2) {
          if (this._isPdfViewportPanning) {
            this._isPdfViewportPanning = false;
            this._pdfViewportPanStart = null;
            viewport.classList.remove('panning-active');
          }
          let t1 = null;
          let t2 = null;
          if (this._pdfPinchState && this._pdfPinchState.id1 !== undefined && this._pdfPinchState.id2 !== undefined) {
            for (let i = 0; i < e.touches.length; i++) {
              const t = e.touches[i];
              if (t.identifier === this._pdfPinchState.id1) t1 = t;
              else if (t.identifier === this._pdfPinchState.id2) t2 = t;
            }
          }
          if (!t1 || !t2) {
            t1 = e.touches[0];
            t2 = e.touches[1];
          }
          movePdfViewerPinch(
            { id: t1.identifier, x: t1.clientX, y: t1.clientY },
            { id: t2.identifier, x: t2.clientX, y: t2.clientY }
          );
          return;
        }
        if (
          !this.isPdfCropModeActive &&
          !this._pdfPinchState &&
          this._isPdfViewportPanning &&
          this._pdfViewportPanStart &&
          this._pdfViewportPanStart.isTouchPan
        ) {
          let t0 = e.touches[0];
          if (this._pdfViewportPanStart.touchId !== undefined) {
            for (let i = 0; i < e.touches.length; i++) {
              if (e.touches[i].identifier === this._pdfViewportPanStart.touchId) {
                t0 = e.touches[i];
                break;
              }
            }
          }
          const nowM = performance.now();
          const samples = this._pdfViewportPanStart.samples;
          if (Array.isArray(samples)) {
            samples.push({ x: t0.clientX, y: t0.clientY, t: nowM });
            while (samples.length > 2 && (nowM - samples[0].t) > 100) {
              samples.shift();
            }
          }
          const dx = t0.clientX - this._pdfViewportPanStart.clientX;
          const dy = t0.clientY - this._pdfViewportPanStart.clientY;
          viewport.scrollLeft = this._pdfViewportPanStart.scrollLeft - dx;
          viewport.scrollTop = this._pdfViewportPanStart.scrollTop - dy;
          this.savedPdfScrollLeft = viewport.scrollLeft;
          this.savedPdfScrollTop = viewport.scrollTop;
        }
      }, { passive: false });

      const onPdfTouchEnd = (e) => {
        if (!this.isPdfModalOpen) return;
        this._lastPdfNativeTouchTs = performance.now();
        if (this._pdfPinchState) {
          this._isPdfViewportPanning = false;
          this._pdfViewportPanStart = null;
          viewport.classList.remove('panning-active');
          if (!e.touches || e.touches.length < 2) {
            if (!e.touches || e.touches.length === 0) {
              this._pdfTouchPointers.clear();
            }
            endPdfViewerPinch();
          }
          return;
        }
        if (!e.touches || e.touches.length === 0) {
          this._pdfTouchPointers.clear();
          if (
            this._isPdfViewportPanning &&
            this._pdfViewportPanStart &&
            this._pdfViewportPanStart.isTouchPan
          ) {
            const panState = this._pdfViewportPanStart;
            this._isPdfViewportPanning = false;
            this._pdfViewportPanStart = null;
            viewport.classList.remove('panning-active');
            if (e && e.type === 'touchend' && Array.isArray(panState.samples)) {
              const nowUp = performance.now();
              const ct = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
              const lastS = panState.samples[panState.samples.length - 1];
              if (ct && lastS && (nowUp - lastS.t) <= 28) {
                if (Math.hypot(ct.clientX - lastS.x, ct.clientY - lastS.y) >= 1.5) {
                  panState.samples.push({ x: ct.clientX, y: ct.clientY, t: nowUp });
                }
              }
              const { vx, vy } = this._computePdfPanReleaseVelocity(panState.samples, nowUp);
              if (Math.hypot(vx, vy) >= 0.18) {
                this._startPdfViewportInertia(viewport, vx, vy);
              }
            }
          }
        }
      };
      viewport.addEventListener('touchend', onPdfTouchEnd, { passive: true });
      viewport.addEventListener('touchcancel', onPdfTouchEnd, { passive: true });
      window.addEventListener('touchend', onPdfTouchEnd, { passive: true });
      window.addEventListener('touchcancel', onPdfTouchEnd, { passive: true });

      const clearPdfTouchPointerCapture = (e) => {
        if (!e || e.pointerType !== 'touch') return;
        if (this._pdfTouchPointers && this._pdfTouchPointers.has(e.pointerId)) {
          this._pdfTouchPointers.delete(e.pointerId);
          if (this._pdfTouchPointers.size < 2) {
            endPdfViewerPinch();
          }
        }
      };
      window.addEventListener('pointerup', clearPdfTouchPointerCapture, { capture: true, passive: true });
      window.addEventListener('pointercancel', clearPdfTouchPointerCapture, { capture: true, passive: true });

      viewport.addEventListener('pointerdown', (e) => {
        this._stopPdfViewportInertia();
        if (e.pointerType === 'touch') {
          const nowP = performance.now();
          // W3C PointerEvent 불변식: touch의 isPrimary === true는 화면에 닿는 첫 번째 손가락일 때만 참이므로 이전 잔류 유령 포인터를 0ms 즉시 소거!
          if (e.isPrimary) {
            this._pdfTouchPointers.clear();
            endPdfViewerPinch();
          } else {
            for (const [pid, pt] of this._pdfTouchPointers.entries()) {
              if (nowP - (pt.t || 0) > 1200) this._pdfTouchPointers.delete(pid);
            }
          }
          if (
            !hasNativeTouchEvents &&
            this._pdfPinchState &&
            this._pdfPinchState.id1 !== undefined &&
            this._pdfPinchState.id2 !== undefined &&
            this._pdfTouchPointers.has(this._pdfPinchState.id1) &&
            this._pdfTouchPointers.has(this._pdfPinchState.id2) &&
            e.pointerId !== this._pdfPinchState.id1 &&
            e.pointerId !== this._pdfPinchState.id2
          ) {
            e.preventDefault();
            return;
          }
          this._pdfTouchPointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY, t: nowP });
          // TouchEvent 지원 기기(iPad/Android)의 이동 모드에서는 1손가락 터치를 100% 브라우저 순정 관성 스크롤에 위임
          if (hasNativeTouchEvents && !this.isPdfCropModeActive) {
            return;
          }
          if (this._pdfTouchPointers.size >= 2) {
            e.preventDefault();
            if (!hasNativeTouchEvents) {
              const pts = Array.from(this._pdfTouchPointers.values());
              startPdfViewerPinch(pts[0], pts[1]);
            } else {
              this.isPdfCropping = false;
              if (cropBox) cropBox.style.display = 'none';
            }
            return;
          }
        }
        // ✋ [이동 모드(!this.isPdfCropModeActive)]:
        // TouchEvent 기기(iPad/Android)는 위 touchstart/touchmove 직결 경로가 담당하고, 비-TouchEvent 환경 및 애플펜슬(pen)·마우스 드래그는 PointerEvent 감속 관성 + 터치 즉시 정지(Touch-to-Stop) 지원!
        if (!this.isPdfCropModeActive) {
          if (hasNativeTouchEvents && e.pointerType === 'touch') return;
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          if (e.pointerType === 'mouse' || e.pointerType === 'pen' || e.pointerType === 'touch') {
            e.preventDefault();
          }
          try {
            viewport.setPointerCapture(e.pointerId);
          } catch (_) { }
          const nowP = performance.now();
          this._isPdfViewportPanning = true;
          this._pdfViewportPanStart = {
            clientX: e.clientX,
            clientY: e.clientY,
            scrollLeft: viewport.scrollLeft,
            scrollTop: viewport.scrollTop,
            pointerId: e.pointerId,
            samples: [{ x: e.clientX, y: e.clientY, t: nowP }]
          };
          viewport.classList.add('panning-active');
          return;
        }
        if (e.button !== 0) return;

        // 네이티브 드래그 / 텍스트 선택 / 브라우저 제스처 원천 차단
        e.preventDefault();
        e.stopPropagation();

        // 포인터 캡처: 브라우저 밖으로 나가도 100% 드래그 추적 보장
        try {
          viewport.setPointerCapture(e.pointerId);
        } catch (err) { }
        this.activeCropPointerId = e.pointerId;

        // 클릭 위치 기준 페이지 탐색 (여백이나 그림자 클릭 시에도 현재 페이지로 자동 연결)
        let pageWrapper = e.target.closest('.pdf-page-wrapper');
        if (!pageWrapper) {
          const wrappers = Array.from(document.querySelectorAll('.pdf-page-wrapper'));
          for (const w of wrappers) {
            const r = w.getBoundingClientRect();
            if (e.clientY >= r.top - 40 && e.clientY <= r.bottom + 40) {
              pageWrapper = w;
              break;
            }
          }
          if (!pageWrapper && wrappers.length > 0) {
            const curId = `pdfPageWrapper_${this.pdfCurrentPage || 1}`;
            pageWrapper = document.getElementById(curId) || wrappers[0];
          }
        }
        if (!pageWrapper) return;

        const rect = pageWrapper.getBoundingClientRect();
        const startX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const startY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

        this.isPdfCropping = true;
        this.cropTargetWrapper = pageWrapper;
        this.cropTargetRect = rect;
        this.cropTargetPageNum = parseInt(pageWrapper.dataset.page, 10);
        this.pdfCropStart = { x: startX, y: startY };
        this._cropLastClientX = e.clientX;
        this._cropLastClientY = e.clientY;

        // 🌟 [독립 투명 오버레이 레이어 분리]:
        // 크롭 박스를 무거운 PDF 페이지(pageWrapper) 내부에 넣지 않고 모달 최상단 독립 고정 레이어(position: fixed)로 분리하여
        // 드래그 도중 PDF 캔버스의 리플로우/리페인트를 0.00%로 원천 차단합니다!
        const modalEl = document.getElementById('modalPdfViewer');
        if (modalEl && cropBox.parentElement !== modalEl) {
          modalEl.appendChild(cropBox);
        }
        cropBox.style.position = 'fixed';
        cropBox.style.display = 'none';
        cropBox.style.left = '0px';
        cropBox.style.top = '0px';
        cropBox.style.transform = `translate3d(${Math.round(rect.left + startX)}px, ${Math.round(rect.top + startY)}px, 0)`;
        cropBox.style.width = '0px';
        cropBox.style.height = '0px';
      }, { passive: false });

      const updateCropBoxFromPointer = (clientX, clientY) => {
        if (!this.isPdfCropping || !this.cropTargetWrapper || !this.pdfCropStart) return;
        const rect = this.cropTargetRect || this.cropTargetWrapper.getBoundingClientRect();
        const curX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const curY = Math.max(0, Math.min(rect.height, clientY - rect.top));

        const x = Math.min(this.pdfCropStart.x, curX);
        const y = Math.min(this.pdfCropStart.y, curY);
        const w = Math.abs(curX - this.pdfCropStart.x);
        const h = Math.abs(curY - this.pdfCropStart.y);

        if (w > 3 || h > 3) {
          cropBox.style.display = 'block';
          cropBox.style.transform = `translate3d(${Math.round(rect.left + x)}px, ${Math.round(rect.top + y)}px, 0)`;
          cropBox.style.width = `${Math.round(w)}px`;
          cropBox.style.height = `${Math.round(h)}px`;
        }
      };

      // 🌟 [대표님 피드백 반영: 영역 캡처 드래그 중 자동 스크롤 전면 비활성화 (한 화면에 맞춘 안정적 캡처 보장)] 🌟
      const stopCropEdgeAutoScroll = () => {
        if (this._cropEdgeScrollRaf) {
          cancelAnimationFrame(this._cropEdgeScrollRaf);
          this._cropEdgeScrollRaf = null;
        }
      };

      const handleCropMove = (e) => {
        if (!this.isPdfModalOpen) return;
        if (hasNativeTouchEvents && e.pointerType === 'touch' && !this.isPdfCropping) return;
        if (!this.isPdfCropping && !this._isPdfViewportPanning && (!this._pdfTouchPointers || this._pdfTouchPointers.size === 0)) return;
        if (e._pdfCropMoveHandled) return;
        e._pdfCropMoveHandled = true;
        if (e.pointerType === 'touch' && this._pdfTouchPointers && this._pdfTouchPointers.has(e.pointerId)) {
          this._pdfTouchPointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() });
          if (this._pdfTouchPointers.size >= 2) {
            e.preventDefault();
            if (!hasNativeTouchEvents) {
              const pts = Array.from(this._pdfTouchPointers.values());
              movePdfViewerPinch(pts[0], pts[1]);
            }
            return;
          }
        }
        if (this._isPdfViewportPanning && this._pdfViewportPanStart && (!this._pdfTouchPointers || this._pdfTouchPointers.size < 2)) {
          if (e.pointerId !== undefined && e.pointerId !== this._pdfViewportPanStart.pointerId) return;
          // 마우스 버튼을 이미 뗀 상태(buttons === 0)면 즉시 패닝 종료 (애플펜슬은 가벼운 접촉 시 buttons=0 오탐 방지를 위해 pointerup으로만 종료)
          if (e.pointerType === 'mouse' && typeof e.buttons === 'number' && e.buttons === 0) {
            try { viewport.releasePointerCapture(this._pdfViewportPanStart.pointerId); } catch (_) { }
            this._isPdfViewportPanning = false;
            this._pdfViewportPanStart = null;
            viewport.classList.remove('panning-active');
            return;
          }
          const nowM = performance.now();
          const samples = this._pdfViewportPanStart.samples;
          if (Array.isArray(samples)) {
            samples.push({ x: e.clientX, y: e.clientY, t: nowM });
            while (samples.length > 2 && (nowM - samples[0].t) > 100) {
              samples.shift();
            }
          }
          const dx = e.clientX - this._pdfViewportPanStart.clientX;
          const dy = e.clientY - this._pdfViewportPanStart.clientY;
          viewport.scrollLeft = this._pdfViewportPanStart.scrollLeft - dx;
          viewport.scrollTop = this._pdfViewportPanStart.scrollTop - dy;
          this.savedPdfScrollLeft = viewport.scrollLeft;
          this.savedPdfScrollTop = viewport.scrollTop;
          return;
        }
        if (this._isPdfViewportPanning) {
          if (this._pdfViewportPanStart && this._pdfViewportPanStart.pointerId !== undefined) {
            try { viewport.releasePointerCapture(this._pdfViewportPanStart.pointerId); } catch (_) { }
          }
          this._isPdfViewportPanning = false;
          this._pdfViewportPanStart = null;
          viewport.classList.remove('panning-active');
        }
        if (!this.isPdfCropping || !this.cropTargetWrapper || !this.pdfCropStart) return;
        e.preventDefault();

        this._cropLastClientX = e.clientX;
        this._cropLastClientY = e.clientY;
        if (!this._cropBoxRaf) {
          this._cropBoxRaf = requestAnimationFrame(() => {
            this._cropBoxRaf = null;
            if (this.isPdfCropping && typeof this._cropLastClientX === 'number') {
              updateCropBoxFromPointer(this._cropLastClientX, this._cropLastClientY);
            }
          });
        }
      };

      viewport.addEventListener('pointermove', handleCropMove, { passive: false });
      window.addEventListener('pointermove', handleCropMove, { passive: false });

      const handleCropUp = (e) => {
        stopCropEdgeAutoScroll();
        if (this._cropBoxRaf) {
          cancelAnimationFrame(this._cropBoxRaf);
          this._cropBoxRaf = null;
        }
        if (e && this._pdfTouchPointers && this._pdfTouchPointers.has(e.pointerId)) {
          this._pdfTouchPointers.delete(e.pointerId);
          if (this._pdfTouchPointers.size < 2) {
            endPdfViewerPinch();
          }
        }
        if (this._isPdfViewportPanning) {
          const panState = this._pdfViewportPanStart;
          if (!e || e.pointerId === undefined || !panState || e.pointerId === panState.pointerId) {
            if (panState && panState.pointerId !== undefined) {
              try { viewport.releasePointerCapture(panState.pointerId); } catch (_) { }
            }
            this._isPdfViewportPanning = false;
            this._pdfViewportPanStart = null;
            viewport.classList.remove('panning-active');
            if (e && e.type === 'pointerup' && panState && Array.isArray(panState.samples)) {
              const nowUp = performance.now();
              const lastS = panState.samples[panState.samples.length - 1];
              if (lastS && (nowUp - lastS.t) <= 28 && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
                if (Math.hypot(e.clientX - lastS.x, e.clientY - lastS.y) >= 1.5) {
                  panState.samples.push({ x: e.clientX, y: e.clientY, t: nowUp });
                }
              }
              const { vx, vy } = this._computePdfPanReleaseVelocity(panState.samples, nowUp);
              if (Math.hypot(vx, vy) >= 0.18) {
                this._startPdfViewportInertia(viewport, vx, vy);
              }
            }
          }
        }
        if (!this.isPdfCropping || !this.cropTargetWrapper || !this.pdfCropStart) return;
        this.isPdfCropping = false;

        if (this.activeCropPointerId !== null && this.activeCropPointerId !== undefined) {
          try {
            viewport.releasePointerCapture(this.activeCropPointerId);
          } catch (err) { }
          this.activeCropPointerId = null;
        }

        if (e && (e.type === 'pointercancel' || e.type === 'blur')) {
          cropBox.style.display = 'none';
          return;
        }

        const clientX = (e && typeof e.clientX === 'number') ? e.clientX : (this._cropLastClientX || 0);
        const clientY = (e && typeof e.clientY === 'number') ? e.clientY : (this._cropLastClientY || 0);
        const rect = this.cropTargetRect || this.cropTargetWrapper.getBoundingClientRect();
        const curX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const curY = Math.max(0, Math.min(rect.height, clientY - rect.top));

        const x = Math.min(this.pdfCropStart.x, curX);
        const y = Math.min(this.pdfCropStart.y, curY);
        const w = Math.abs(curX - this.pdfCropStart.x);
        const h = Math.abs(curY - this.pdfCropStart.y);

        cropBox.style.display = 'none';

        // ✂️ [0.01초 즉시 캡처 추출 (Direct Canvas Slicing)]:
        // 무거운 재렌더링이나 동기 PNG 압축 대기 없이, 이미 화면에 선명하게 그려진 PDF <canvas>에서
        // 드래그한 좌표(sx, sy, sw, sh)만 ctx.drawImage()로 즉시 오려내어 0.01초 만에 칠판에 꽂습니다!
        if (w >= 20 && h >= 20) {
          const canvas = this.cropTargetWrapper._canvasEl || this.cropTargetWrapper.querySelector('.pdf-page-canvas');
          if (canvas && rect.width > 0 && rect.height > 0) {
            const tileInfo = this.cropTargetWrapper._hiResTileInfo;
            const hasHiResTile = Boolean(tileInfo && tileInfo.canvas && tileInfo.canvas.width > 10 && tileInfo.uW > 0 && tileInfo.uH > 0);
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const hiResDpr = hasHiResTile ? Math.min(2.4, Math.max(1.0, tileInfo.actualDpr || 1.5)) : 0;
            const outScaleX = Math.max(scaleX, hiResDpr);
            const outScaleY = Math.max(scaleY, hiResDpr);

            const sx = x * scaleX;
            const sy = y * scaleY;
            const baseSw = Math.max(1, w * scaleX);
            const baseSh = Math.max(1, h * scaleY);
            const sw = Math.max(1, Math.min(2600, Math.round(w * outScaleX)));
            const sh = Math.max(1, Math.min(2600, Math.round(h * outScaleY)));

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = sw;
            cropCanvas.height = sh;
            const ctx = cropCanvas.getContext('2d', { alpha: false }) || cropCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sw, sh);
            ctx.drawImage(canvas, sx, sy, baseSw, baseSh, 0, 0, sw, sh);

            if (hasHiResTile) {
              const tileL = tileInfo.uL * rect.width;
              const tileT = tileInfo.uT * rect.height;
              const tileW = tileInfo.uW * rect.width;
              const tileH = tileInfo.uH * rect.height;
              const ix0 = Math.max(x, tileL);
              const iy0 = Math.max(y, tileT);
              const ix1 = Math.min(x + w, tileL + tileW);
              const iy1 = Math.min(y + h, tileT + tileH);
              if (ix1 > ix0 + 1 && iy1 > iy0 + 1) {
                const tsx = ((ix0 - tileL) / tileW) * tileInfo.canvas.width;
                const tsy = ((iy0 - tileT) / tileH) * tileInfo.canvas.height;
                const tsw = ((ix1 - ix0) / tileW) * tileInfo.canvas.width;
                const tsh = ((iy1 - iy0) / tileH) * tileInfo.canvas.height;
                const tdx = ((ix0 - x) / w) * sw;
                const tdy = ((iy0 - y) / h) * sh;
                const tdw = ((ix1 - ix0) / w) * sw;
                const tdh = ((iy1 - iy0) / h) * sh;
                ctx.drawImage(tileInfo.canvas, tsx, tsy, tsw, tsh, tdx, tdy, tdw, tdh);
              }
            }

            const dataUrl = this.encodeCanvasSmartWebP(cropCanvas, 0.88, true);
            const pageNum = this.cropTargetPageNum;
            const normCrop = {
              nx: x / rect.width,
              ny: y / rect.height,
              nw: w / rect.width,
              nh: h / rect.height
            };
            const activeDocUid = (this.pdfDoc && this.pdfDoc._graphlyDocUid) ? this.pdfDoc._graphlyDocUid : '';
            const pdfCropRef = activeDocUid
              ? this._normalizePdfCropRef({
                pdfDocUid: activeDocUid,
                pageNum,
                normCrop,
                aspect: sh / Math.max(1, sw)
              })
              : null;
            const targetCardWidth = Math.round(Math.max(480, Math.min(window.innerWidth * 0.65, w * 1.15)));

            // 📑 [연속 영역 캡처 분기]: 모달을 닫지 않고 백그라운드 슬라이드에 즉시 적재 후 [이동 상태]로 자동 복귀!
            const isBatchCapture = Boolean(
              this._isPdfBatchCropMode ||
              (Array.isArray(this._pdfBatchSessionRecords) && this._pdfBatchSessionRecords.length > 0)
            );
            if (isBatchCapture) {
              if (!Array.isArray(this._pdfBatchSessionRecords)) {
                this._pdfBatchSessionRecords = [];
              }
              const isFirstInBatch = (this._pdfBatchSessionRecords.length === 0);
              const existingFinalizedPre = (this._pdfBatchPreSessionState && this._pdfBatchPreSessionState.audioSegmentFinalized)
                ? this._pdfBatchPreSessionState
                : null;
              const hadExistingBeforeBatch = isFirstInBatch
                ? Boolean(existingFinalizedPre || this._isReplacingViaNextCrop || this.hasAnyWorkspaceContent())
                : true;

              if (hadExistingBeforeBatch && typeof this.canAddMoreSlidesWithQuota === 'function' && !this.canAddMoreSlidesWithQuota(1)) {
                cropCanvas._evicted = true;
                try { cropCanvas.width = 1; cropCanvas.height = 1; } catch (_) { }
                return;
              }

              if (isFirstInBatch) {
                if (existingFinalizedPre) {
                  // Ctrl+Z로 첫 연속 캡처를 취소한 직후 다시 재캡처하는 경우: 이미 마감된 이전 슬라이드를 중복 마감하지 않고 다음 슬라이드 UID만 재연결!
                  if (this.isAudioRecording) {
                    this._archiveCurrentBeforeNextCapture();
                  }
                } else {
                  const wasPlaylistBefore = Boolean(this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0);
                  const prevIdxBefore = this.lessonPlaylistIndex || 0;
                  const prevModeBefore = this.lessonTeachingMode;
                  const prevReplaceBefore = Boolean(this._isReplacingViaNextCrop);
                  if (wasPlaylistBefore && !this.isAudioRecording) {
                    this.saveCurrentSlideIntoPlaylist();
                  }
                  const curExistingTitle = (wasPlaylistBefore && this.lessonPlaylistSlides[prevIdxBefore] && this.lessonPlaylistSlides[prevIdxBefore].slideTitle)
                    ? this.lessonPlaylistSlides[prevIdxBefore].slideTitle
                    : '1';
                  const preSnapSlide = this.serializeFullSlideState(curExistingTitle);
                  this._pdfBatchPreSessionState = {
                    wasPlaylistActive: Boolean(this.isLessonPlaylistActive),
                    prevSlides: wasPlaylistBefore
                      ? this._fastCloneSlideValue(this.lessonPlaylistSlides)
                      : null,
                    prevPlaylistIndex: prevIdxBefore,
                    prevTeachingMode: prevModeBefore,
                    prevReplacingFlag: prevReplaceBefore,
                    hadExistingContent: hadExistingBeforeBatch,
                    audioSegmentFinalized: false,
                    initialWorkspaceSlide: preSnapSlide
                  };

                  if (hadExistingBeforeBatch) {
                    if (this.isAudioRecording) {
                      this._archiveCurrentBeforeNextCapture();
                      this._pdfBatchPreSessionState.audioSegmentFinalized = true;
                    } else {
                      if (this._isAudioReplayActive || this.isAudioPlaying) {
                        this.stopAudioPlayback(true);
                      }
                      if (!wasPlaylistBefore) {
                        this.lessonPlaylistSlides = [preSnapSlide];
                        this.lessonPlaylistIndex = 0;
                        this.isLessonPlaylistActive = true;
                      }
                    }
                  } else {
                    if (this._isAudioReplayActive || this.isAudioPlaying) {
                      this.stopAudioPlayback(true);
                    }
                    this.lessonPlaylistSlides = [];
                    this.lessonPlaylistIndex = 0;
                    this.isLessonPlaylistActive = true;
                  }
                }
              }

              this.setLessonTeachingMode('crop');
              this._isReplacingViaNextCrop = false;
              if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed) {
                this.closeDrawer();
              }

              this._isBuildingBatchCropSlide = true;
              let newSlideObj = null;
              try {
                this.resetBoardAndProblemCardsForNext();
                this.audioSyncData = null;
                this.setProblemCard(dataUrl, pageNum, cropCanvas, targetCardWidth, { pdfCropRef });
                const nextSlideNum = (Array.isArray(this.lessonPlaylistSlides) ? this.lessonPlaylistSlides.length : 0) + 1;
                newSlideObj = this.serializeFullSlideState(String(nextSlideNum));
              } finally {
                this._isBuildingBatchCropSlide = false;
              }

              cropCanvas._evicted = true;
              try { cropCanvas.width = 1; cropCanvas.height = 1; } catch (_) { }
              if (this.problemCardImage === cropCanvas) {
                this.problemCardImage = document.getElementById('problemCardImg') || null;
              }

              if (!Array.isArray(this.lessonPlaylistSlides)) {
                this.lessonPlaylistSlides = [];
              }
              this.lessonPlaylistSlides.push(newSlideObj);
              this.isLessonPlaylistActive = true;
              const insertedIdx = this.lessonPlaylistSlides.length - 1;
              const insertedSlideNum = insertedIdx + 1;
              this.lessonPlaylistIndex = insertedIdx;

              this._pdfBatchSessionRecords.push({
                slideIdx: insertedIdx,
                slideNum: insertedSlideNum,
                pageNum,
                pdfDocUid: activeDocUid,
                normCrop: { ...normCrop }
              });

              this._isPdfBatchCropMode = true;
              this.togglePdfCropMode(false, { silentToast: true, keepBatchMode: true });
              this._renderPdfBatchCropOverlays();
              this.syncLessonPlaylistNavBarUI();
              this.syncPdfModalModeUI();

              const totalBatch = this._pdfBatchSessionRecords.length;
              if (totalBatch === 1) {
                this.showToast(`✓ #${insertedSlideNum} 슬라이드 추가됨! 이동 후 [연속 캡처 (X)]로 다음 문제를 추가하세요`);
              } else {
                this.showToast(`✓ #${insertedSlideNum} 슬라이드 추가됨 (연속 ${totalBatch}개 · Enter로 캔버스 이동)`);
              }
              return;
            }

            this.setLessonTeachingMode('crop');
            const replaceMode = Boolean(this._isReplacingViaNextCrop || this.hasAnyWorkspaceContent());
            this._isReplacingViaNextCrop = false;

            if (replaceMode && typeof this.canAddMoreSlidesWithQuota === 'function' && !this.canAddMoreSlidesWithQuota(1)) {
              return;
            }

            if (replaceMode) {
              this._archiveCurrentBeforeNextCapture();
              this.resetBoardAndProblemCardsForNext();
            }

            // 좌측 서랍이 열려있으면 문제 카드를 가리지 않도록 자동 접기
            if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed) {
              this.closeDrawer();
            }

            // 문제 카드 고정 (일반 진입/새 캔버스 진입 시 현재 슬라이드에 추가/배치, [다음 캡처]로 진입 시 새 슬라이드 캔버스에 고정!)
            this.setProblemCard(dataUrl, pageNum, cropCanvas, targetCardWidth, { pdfCropRef });
            const placedTarget = this._lastPlacedProblemCardTarget || null;

            if (replaceMode) {
              this._finalizeAppendedCaptureSlide('');
            } else if (this.isLessonPlaylistActive) {
              this.saveCurrentSlideIntoPlaylist();
              this.syncLessonPlaylistNavBarUI();
            } else {
              const firstSlide = this.serializeFullSlideState('1');
              this.lessonPlaylistSlides = [firstSlide];
              this.lessonPlaylistIndex = 0;
              this.isLessonPlaylistActive = true;
              this.syncLessonPlaylistNavBarUI();
            }
            if (placedTarget && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides[this.lessonPlaylistIndex]) {
              placedTarget.slideRef = this.lessonPlaylistSlides[this.lessonPlaylistIndex];
              if (placedTarget.type === 'extra' && Array.isArray(this.extraProblemCards)) {
                placedTarget.extraIndex = Math.max(0, this.extraProblemCards.indexOf(placedTarget.cardItem));
              }
            }
            this.closePdfModal();
            this.togglePdfCropMode(false);

            // ✂️ [벡터 참조(pdfCropRef) + 런타임 경량 blob: URL 자동 보강]:
            this._upgradeCroppedProblemCardToVectorUltraHD(pageNum, normCrop, placedTarget, activeDocUid);

            // 6. 필기 펜 모드 자동 켜기
            if (!this.isInkMode) {
              this.toggleInkMode(true);
            }
            this.setActiveInkTool('pen');
            this.render();
            this.showToast(`✂️ p.${pageNum} 문제가 고정되었습니다! 문제 위나 빈 캔버스 어디든 바로 필기하세요.`);
          }
        }
      };

      viewport.addEventListener('pointerup', handleCropUp);
      window.addEventListener('pointerup', handleCropUp);
      window.addEventListener('pointercancel', handleCropUp);
      window.addEventListener('blur', handleCropUp);

      // 일반 마우스 휠은 preventDefault 없이 네이티브 스크롤에 위임하고, Ctrl/Cmd + 휠(트랙패드 핀치 포함)만 커서 중심 PDF 줌으로 직결!
      viewport.addEventListener('wheel', (e) => {
        this._stopPdfViewportInertia();
        if (e.ctrlKey || e.metaKey) {
          if (e.cancelable !== false) e.preventDefault();
          if (!e.deltaY) return;
          const isSmoothPinch = (e.deltaMode === 0 && Math.abs(e.deltaY) < 40);
          const factor = isSmoothPinch
            ? Math.exp(-e.deltaY * 0.01)
            : (e.deltaY < 0 ? 1.09 : (1 / 1.09));
          const targetZoom = Math.max(0.6, Math.min(5.0, (this.pdfZoom || 1.5) * factor));
          const { anchorPageEl, anchorRelX, anchorRelY } = capturePdfAnchorAtClientPoint(e.clientX, e.clientY);
          this.setPdfZoom(targetZoom, {
            anchorPageEl,
            anchorRelX,
            anchorRelY,
            currentMidClientX: e.clientX,
            currentMidClientY: e.clientY,
            fastPreview: true
          });
          schedulePdfTrackpadZoomCommit();
          return;
        }
        if (this.isPdfCropping && typeof this._cropLastClientX === 'number') {
          requestAnimationFrame(() => {
            updateCropBoxFromPointer(this._cropLastClientX, this._cropLastClientY);
          });
        }
      }, { passive: false });

      const handleCropCancel = (e) => {
        if (e && this._pdfTouchPointers && e.pointerId !== undefined) {
          this._pdfTouchPointers.delete(e.pointerId);
        }
        if (!this._pdfTouchPointers || this._pdfTouchPointers.size < 2) {
          endPdfViewerPinch();
        }
        if (this._isPdfViewportPanning) {
          if (this._pdfViewportPanStart && this._pdfViewportPanStart.pointerId !== undefined) {
            try { viewport.releasePointerCapture(this._pdfViewportPanStart.pointerId); } catch (_) { }
          }
          this._isPdfViewportPanning = false;
          this._pdfViewportPanStart = null;
          viewport.classList.remove('panning-active');
        }
        this.isPdfCropping = false;
        if (this.activeCropPointerId !== null && this.activeCropPointerId !== undefined) {
          try {
            viewport.releasePointerCapture(this.activeCropPointerId);
          } catch (err) { }
          this.activeCropPointerId = null;
        }
        cropBox.style.display = 'none';
      };

      viewport.addEventListener('pointercancel', handleCropCancel);
      window.addEventListener('pointercancel', handleCropCancel);
    }

    // 🚀 [구형 CPU 메인 스레드 블로킹 0.00ms 보장 & 아이패드 Safari WebP 미지원 시 고화질 JPEG 자동 폴백 인코더]
    async encodeCanvasSmartWebPAsync(canvas, quality = 0.92, allowJpegFallback = true) {
      if (!canvas) return '';
      const isLossy = (typeof quality === 'number' && quality < 0.99);
      const canWebP = isLossy && typeof this._canEncodeCanvasWebP === 'function' && this._canEncodeCanvasWebP();
      const mime = !isLossy
        ? 'image/png'
        : (canWebP ? 'image/webp' : (allowJpegFallback !== false ? 'image/jpeg' : 'image/png'));
      const effQuality = (mime === 'image/jpeg')
        ? Math.min(0.80, Math.max(0.74, quality - 0.12))
        : quality;
      if (typeof canvas.toBlob === 'function' && typeof FileReader !== 'undefined') {
        try {
          const dataUrl = await new Promise((resolve) => {
            canvas.toBlob((blob) => {
              if (!blob || (mime !== 'image/png' && blob.type && blob.type !== mime)) {
                resolve('');
                return;
              }
              const reader = new FileReader();
              reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
              reader.onerror = () => resolve('');
              reader.readAsDataURL(blob);
            }, mime, effQuality);
          });
          if (dataUrl && dataUrl.startsWith(`data:${mime}`)) {
            return dataUrl;
          }
        } catch (err) { }
      }
      return this.encodeCanvasSmartWebP(canvas, quality, allowJpegFallback);
    }

    async _upgradeCroppedProblemCardToVectorUltraHD(pageNum, normCrop, targetRef = null, explicitDocUid = '') {
      const prevUpgrade = this._pendingCropVectorUpgradePromise;
      const runUpgrade = async () => {
        if (prevUpgrade) {
          try { await prevUpgrade; } catch (_) { }
        }
        try {
          if (!normCrop || normCrop.nw <= 0 || normCrop.nh <= 0) return;
          const resolvedUid = explicitDocUid || (this.pdfDoc && this.pdfDoc._graphlyDocUid) || '';
          const cropRef = resolvedUid
            ? this._normalizePdfCropRef({ pdfDocUid: resolvedUid, pageNum, normCrop })
            : null;

          let ultraDataUrl = '';
          let ultraAspect = null;
          let decodedUltraImg = null;

          if (cropRef) {
            const hydrated = await this._ensureProblemCropBlobUrlFromRef(cropRef);
            if (hydrated && hydrated.blobUrl) {
              ultraDataUrl = hydrated.blobUrl;
              ultraAspect = hydrated.aspect || null;
              decodedUltraImg = hydrated.img || null;
              if (ultraAspect) cropRef.aspect = ultraAspect;
            }
          }

          if (!ultraDataUrl) {
            if (!this.pdfDoc) return;
            const page = await this.pdfDoc.getPage(pageNum);
            const baseVp = page.getViewport({ scale: 1.0 });
            const rawCropW = Math.max(1, normCrop.nw * baseVp.width);
            const rawCropH = Math.max(1, normCrop.nh * baseVp.height);
            const desiredMinWidthPx = 2200;
            let ultraScale = Math.max(2.6, Math.min(20.0, desiredMinWidthPx / rawCropW));
            const maxDim = Math.max(rawCropW, rawCropH) * ultraScale;
            if (maxDim > 2880) {
              ultraScale = 2880 / Math.max(rawCropW, rawCropH);
            }
            const maxAreaPx = 6200000;
            if ((rawCropW * ultraScale) * (rawCropH * ultraScale) > maxAreaPx) {
              ultraScale = Math.sqrt(maxAreaPx / Math.max(1, rawCropW * rawCropH));
            }
            const fullVp = page.getViewport({
              scale: ultraScale,
              offsetX: -normCrop.nx * baseVp.width * ultraScale,
              offsetY: -normCrop.ny * baseVp.height * ultraScale
            });
            const targetW = Math.max(1, Math.round(rawCropW * ultraScale));
            const targetH = Math.max(1, Math.round(rawCropH * ultraScale));
            const vecCanvas = document.createElement('canvas');
            vecCanvas.width = targetW;
            vecCanvas.height = targetH;
            const vCtx = vecCanvas.getContext('2d', { alpha: false }) || vecCanvas.getContext('2d');
            vCtx.imageSmoothingEnabled = true;
            vCtx.imageSmoothingQuality = 'high';
            vCtx.fillStyle = '#ffffff';
            vCtx.fillRect(0, 0, targetW, targetH);
            await page.render({ canvasContext: vCtx, viewport: fullVp }).promise;
            ultraAspect = (vecCanvas.width > 0 && vecCanvas.height > 0) ? (vecCanvas.height / vecCanvas.width) : null;
            ultraDataUrl = await this._canvasToRuntimeCropBlobUrl(vecCanvas, 0.94);
            vecCanvas._evicted = true;
            try { vecCanvas.width = 1; vecCanvas.height = 1; } catch (_) { }
            if (!ultraDataUrl) return;
            if (typeof Image !== 'undefined') {
              try {
                const preImg = new Image();
                preImg.decoding = 'async';
                preImg.src = ultraDataUrl;
                if (typeof preImg.decode === 'function') {
                  await preImg.decode().catch(() => { });
                }
                decodedUltraImg = preImg;
              } catch (_) { }
            }
          }

          const releaseTempCropCanvas = (cv) => {
            if (cv && typeof cv.getContext === 'function' && cv.width > 1) {
              cv._evicted = true;
              try {
                cv.width = 1;
                cv.height = 1;
              } catch (e) { }
            }
          };

          if (targetRef && targetRef.slideRef) {
            const sRef = targetRef.slideRef;
            if (targetRef.type === 'primary' && sRef.primaryProblemCard) {
              sRef.primaryProblemCard.imgSrc = ultraDataUrl;
              if (cropRef) {
                sRef.primaryProblemCard.pdfCropRef = { ...cropRef };
                if (sRef.primaryProblemCard.problemCardData) {
                  sRef.primaryProblemCard.problemCardData.pdfCropRef = { ...cropRef };
                }
              }
              if (ultraAspect) sRef.primaryProblemCard.problemCardAspect = ultraAspect;
            } else if (targetRef.type === 'extra' && Array.isArray(sRef.extraProblems)) {
              const eIdx = (typeof targetRef.extraIndex === 'number') ? targetRef.extraIndex : (sRef.extraProblems.length - 1);
              if (sRef.extraProblems[eIdx]) {
                sRef.extraProblems[eIdx].dataUrl = ultraDataUrl;
                if (cropRef) sRef.extraProblems[eIdx].pdfCropRef = { ...cropRef };
              }
            }
            delete sRef.viewerSnapshotDataUrl;
          }

          const isBusyWritingNow = () => Boolean(
            (typeof this.isActivelyWritingOrInteracting === 'function' && this.isActivelyWritingOrInteracting()) ||
            this.isDrawingInk ||
            this._isDrawingCardInk ||
            this.isStylusDrawing ||
            this.isErasingInk
          );

          const syncPlaylistIdle = () => {
            if (isBusyWritingNow()) {
              setTimeout(syncPlaylistIdle, 160);
              return;
            }
            if (this.isLessonPlaylistActive) {
              const curSlide = Array.isArray(this.lessonPlaylistSlides) ? this.lessonPlaylistSlides[this.lessonPlaylistIndex] : null;
              if (!targetRef || !targetRef.slideRef || curSlide === targetRef.slideRef) {
                this.saveCurrentSlideIntoPlaylist();
              }
            }
          };
          const schedulePlaylistSync = () => {
            if (!this.isLessonPlaylistActive) return;
            if (typeof window.requestIdleCallback === 'function') {
              window.requestIdleCallback(syncPlaylistIdle, { timeout: 300 });
            } else {
              setTimeout(syncPlaylistIdle, 80);
            }
          };

          const applyUltraDomSwapWhenIdle = () => {
            if (isBusyWritingNow()) {
              setTimeout(applyUltraDomSwapWhenIdle, 120);
              return;
            }
            if (targetRef && targetRef.stampedStroke && targetRef.stampedStroke.graphStamp) {
              targetRef.stampedStroke.graphStamp.dataUrl = ultraDataUrl;
              if (cropRef) targetRef.stampedStroke.graphStamp.pdfCropRef = { ...cropRef };
              if (targetRef.stampedStroke._stampCache) {
                targetRef.stampedStroke._stampCache.key = '';
                if (decodedUltraImg) {
                  targetRef.stampedStroke._stampCache.img = decodedUltraImg;
                  targetRef.stampedStroke._stampCache.imgUrl = ultraDataUrl;
                  targetRef.stampedStroke._stampCache.liveDrawable = null;
                }
              }
              this._inkBakeDirty = true;
            }
            if (targetRef && targetRef.type === 'extra' && targetRef.cardItem) {
              const extraCard = targetRef.cardItem;
              if (extraCard && extraCard.el) {
                if (cropRef) {
                  extraCard.pdfCropRef = { ...cropRef };
                  extraCard.el._pdfCropRef = { ...cropRef };
                }
                const imgEl = extraCard.el.querySelector('.problem-card-img');
                if (imgEl) imgEl.src = ultraDataUrl;
                releaseTempCropCanvas(extraCard.sourceCanvas);
                extraCard.sourceCanvas = null;
                if (extraCard.el.isConnected !== false || (targetRef && targetRef.stampedStroke)) {
                  schedulePlaylistSync();
                  if (!isBusyWritingNow()) this.requestRender();
                }
                return;
              }
            } else if (!targetRef && this.extraProblemCards && this.extraProblemCards.length > 0) {
              const lastExtra = this.extraProblemCards[this.extraProblemCards.length - 1];
              if (lastExtra && lastExtra.el && !lastExtra.isPdfPageCard) {
                if (cropRef) {
                  lastExtra.pdfCropRef = { ...cropRef };
                  lastExtra.el._pdfCropRef = { ...cropRef };
                }
                const imgEl = lastExtra.el.querySelector('.problem-card-img');
                if (imgEl) imgEl.src = ultraDataUrl;
                releaseTempCropCanvas(lastExtra.sourceCanvas);
                lastExtra.sourceCanvas = null;
                if (lastExtra.el.isConnected !== false) {
                  schedulePlaylistSync();
                  if (!isBusyWritingNow()) this.requestRender();
                }
                return;
              }
            }
            const isMatchingPrimary = targetRef && targetRef.problemCardData
              ? (this.problemCardData === targetRef.problemCardData)
              : Boolean(this.problemCardData && this.problemCardData.pageNum === pageNum);
            if (isMatchingPrimary && this.problemCardData) {
              this.problemCardData.imgUrl = ultraDataUrl;
              if (cropRef) this.problemCardData.pdfCropRef = { ...cropRef };
              releaseTempCropCanvas(this.problemCardImage);
              if (ultraAspect) this.problemCardAspect = ultraAspect;
              const pImg = document.getElementById('problemCardImg');
              if (pImg) pImg.src = ultraDataUrl;
              this.problemCardImage = decodedUltraImg || pImg || null;
              this.syncProblemCardRectFromWidget();
              schedulePlaylistSync();
              if (!isBusyWritingNow()) this.requestRender();
            } else if (targetRef && targetRef.stampedStroke) {
              schedulePlaylistSync();
              if (!isBusyWritingNow()) this.requestRender();
            }
          };
          applyUltraDomSwapWhenIdle();
        } catch (err) {
          // 벡터 보강 실패 시 기존 크롭 이미지 유지
        }
      };
      const task = runUpgrade();
      this._pendingCropVectorUpgradePromise = task;
      try {
        await task;
      } finally {
        if (this._pendingCropVectorUpgradePromise === task) {
          this._pendingCropVectorUpgradePromise = null;
        }
      }
    }

    hasActiveProblemCard() {
      return Boolean(this.problemCardData && !this.isProblemCardMinimized);
    }

    syncProblemCardRectFromWidget() {
      const widget = document.getElementById('problemCardWidget');
      const body = document.getElementById('problemCardBody');
      const pCanvas = document.getElementById('problemCardCanvas');
      if (!widget || !this.problemCardData || widget.style.display === 'none') {
        this.problemCardRect = null;
        return null;
      }

      const isMin = Boolean(this.isProblemCardMinimized || widget.classList.contains('minimized'));
      const rawStyleW = parseFloat(widget.style.width);
      if (!isMin && Number.isFinite(rawStyleW) && rawStyleW >= 180) {
        widget._savedExpandedWidth = `${Math.round(rawStyleW)}px`;
      }
      const measuredWidgetRect = typeof this._getStageElementRect === 'function'
        ? this._getStageElementRect(widget)
        : widget.getBoundingClientRect();
      const w = (!isMin && Number.isFinite(rawStyleW) && rawStyleW >= 180)
        ? rawStyleW
        : (parseFloat(widget._savedExpandedWidth) || (Number.isFinite(rawStyleW) && rawStyleW >= 180 ? rawStyleW : 0) || (!isMin && measuredWidgetRect ? measuredWidgetRect.width : 520) || 520);
      const effW = w;
      const aspect = this.problemCardAspect || 0.72;
      const imgW = effW;
      const imgH = Math.round(imgW * aspect);
      const h = imgH;

      if (body && !isMin) {
        body.style.height = `${h}px`;
      }

      if (pCanvas && !isMin) {
        const dpr = (typeof this._getEffectiveCardRenderDpr === 'function')
          ? this._getEffectiveCardRenderDpr(widget, effW, h)
          : this.getCanvasDpr();
        const targetW = Math.round(effW * dpr);
        const targetH = Math.round(h * dpr);
        pCanvas._logicalW = effW;
        pCanvas._logicalH = h;
        pCanvas._renderDpr = dpr;
        if (pCanvas.width !== targetW || pCanvas.height !== targetH) {
          pCanvas.width = targetW;
          pCanvas.height = targetH;
        }
        this.renderProblemCardCanvas();
      }
      if (!isMin && typeof widget._syncCardLaserSize === 'function') {
        widget._syncCardLaserSize();
      }

      if (!this.canvas) return null;
      const isFixedStage = typeof this._isFixedReplayStageActive === 'function' && this._isFixedReplayStageActive();
      const canvasRect = isFixedStage ? { left: 0, top: 0 } : this.canvas.getBoundingClientRect();
      const widgetRect = typeof this._getStageElementRect === 'function'
        ? this._getStageElementRect(widget)
        : widget.getBoundingClientRect();

      const x = widgetRect.left - canvasRect.left;
      const y = widgetRect.top - canvasRect.top;
      const screenW = (widgetRect && widgetRect.width > 0) ? widgetRect.width : w;
      const screenH = (widgetRect && widgetRect.height > 0) ? widgetRect.height : h;

      this.problemCardRect = {
        x,
        y,
        w: screenW,
        h: screenH,
        imgX: x + 10,
        imgY: y + 10,
        imgW: screenW,
        imgH: screenH
      };
      return this.problemCardRect;
    }

    // 🌟 [페이지 모드(pdfPageBoardData) 전용: 카드 위젯을 PDF 페이지 수학 좌표(_pdfAnchor)에 핀처럼 고정!] 🌟
    _pinCardToPdfBoardAtScreenPos(el, screenX, screenY, keepExistingScale = false) {
      if (!el || !this.pdfPageBoardData) return null;
      let sx = Math.round(screenX);
      let sy = Math.round(screenY);
      if (this.pdfPageBoardData.mathW && this.pdfPageBoardData.mathH) {
        const cx = this.pdfPageBoardData.centerX || 0;
        const cy = this.pdfPageBoardData.centerY || 0;
        const tl = this.mathToScreen(cx - this.pdfPageBoardData.mathW / 2, cy + this.pdfPageBoardData.mathH / 2);
        const br = this.mathToScreen(cx + this.pdfPageBoardData.mathW / 2, cy - this.pdfPageBoardData.mathH / 2);
        const pageLeft = Math.min(tl.x, br.x);
        const pageRight = Math.max(tl.x, br.x);
        const pageTop = Math.min(tl.y, br.y);
        const pageBottom = Math.max(tl.y, br.y);
        const isDraggingThisCard = Boolean(el.classList && el.classList.contains('is-dragging-card'));
        const cardW = (isDraggingThisCard && el._cachedDragW > 0)
          ? el._cachedDragW
          : (parseFloat(el.style.width) || el.offsetWidth || 180);
        const cardH = (isDraggingThisCard && el._cachedDragH > 0)
          ? el._cachedDragH
          : (el.offsetHeight || 120);
        const minX = pageLeft + 4;
        const maxX = Math.max(minX, pageRight - cardW - 4);
        const minY = pageTop + 4;
        const maxY = Math.max(minY, pageBottom - Math.min(cardH, Math.max(40, pageBottom - pageTop - 8)) - 4);
        sx = Math.round(Math.max(minX, Math.min(maxX, sx)));
        sy = Math.round(Math.max(minY, Math.min(maxY, sy)));
      }
      const m = this.screenToMath(sx, sy);
      const curUS = (typeof this.getCurrentMathUnitScale === 'function') ? this.getCurrentMathUnitScale() : 60;
      const prevUS = (keepExistingScale && el._pdfAnchor && el._pdfAnchor.unitScale > 0)
        ? el._pdfAnchor.unitScale
        : (curUS > 0 ? curUS : 60);
      const anchor = {
        mx: Number(m.x.toFixed(4)),
        my: Number(m.y.toFixed(4)),
        unitScale: Number(prevUS.toFixed(4))
      };
      el._pdfAnchor = anchor;
      if (!(el.classList && el.classList.contains('is-dragging-card') && typeof el._dragDomLeft === 'number')) {
        el.style.left = `${sx}px`;
        el.style.top = `${sy}px`;
      }
      if (el.id === 'graphCardWidget') {
        this.graphCardBaseX = sx;
        this.graphCardBaseY = sy;
        this.graphCardPdfAnchor = { ...anchor };
      } else if (el.id === 'problemCardWidget') {
        this.problemCardBaseX = sx;
        this.problemCardBaseY = sy;
        this.problemCardPdfAnchor = { ...anchor };
      } else {
        const eg = (this.extraGraphCards || []).find(c => c && c.el === el);
        if (eg) {
          eg.baseX = sx;
          eg.baseY = sy;
          eg.pdfAnchor = { ...anchor };
        }
        const ep = (this.extraProblemCards || []).find(c => c && c.el === el);
        if (ep) {
          ep.baseX = sx;
          ep.baseY = sy;
          ep.pdfAnchor = { ...anchor };
        }
      }
      return anchor;
    }

    // 🌟 [문제 창 + 그래프 창 + 칠판/PDF 페이지 위치 및 줌 100% 동기화] 🌟
    // - 캡처 판서 모드(isGraphCovered && !pdfPageBoardData): 칠판 좌표계(boardToScreen)와 줌(boardZoom)에 맞춰 필기와 100% 한 몸으로 이동·확대/축소!
    // - 페이지 모드(isGraphCovered && pdfPageBoardData): PDF 페이지 수학 좌표(_pdfAnchor)에 핀을 박듯 고정되어 PDF 이동(panX, panY) 및 줌(zoomLevel)과 100% 한 몸으로 이동·스케일링!
    updateProblemCardPosition(transformOnly = false, singleEl = null) {
      const isPdfBoard = Boolean(this.isGraphCovered && this.pdfPageBoardData);
      const curUS = (isPdfBoard && typeof this.getCurrentMathUnitScale === 'function')
        ? this.getCurrentMathUnitScale()
        : 60;
      const bz = Math.max(0.2, Math.min(4.0, this.boardZoom || 1.0));
      const isLassoBusy = Boolean(
        this.isDraggingLassoSelection ||
        this.isResizingLassoSelection ||
        this.isRotatingLassoSelection ||
        this.isLassoSelecting ||
        this._lassoFlipAnim
      );
      const isCameraMovingLive = Boolean(
        this._pinchState ||
        this.isPanning ||
        this.isBoardPanning ||
        this._isZoomAnimating ||
        this._isWheelZooming
      );
      let needCardHiDpiSchedule = false;
      if (!singleEl && !isLassoBusy && !(transformOnly && isCameraMovingLive) && Array.isArray(this.inkStrokes) && this.inkStrokes.length > 0) {
        let stampSpanSum = 0;
        let hasRefStamp = false;
        for (let si = 0; si < this.inkStrokes.length; si++) {
          const st = this.inkStrokes[si];
          if (st && st.isProblemStamp && st.graphStamp && st.graphStamp.pdfCropRef && Array.isArray(st.points) && st.points.length >= 2) {
            hasRefStamp = true;
            stampSpanSum += Math.abs((st.points[1].x || 0) - (st.points[0].x || 0));
          }
        }
        if (hasRefStamp) {
          const curStageZoom = isPdfBoard ? (this.zoomLevel || 1.0) : bz;
          const prevStageZ = this._settledProblemStampStageZoom || 1.0;
          const prevSpanSum = this._settledProblemStampSpanSum || 0;
          if (curStageZoom > prevStageZ + 0.05 || stampSpanSum > prevSpanSum * 1.04) {
            needCardHiDpiSchedule = true;
          }
        }
      }

      const setCardTransformCached = (el, nextOrigin, nextTransform) => {
        if (el._lastCardOriginStr !== nextOrigin) {
          el._lastCardOriginStr = nextOrigin;
          el.style.transformOrigin = nextOrigin;
        }
        if (el._lastCardTransformStr !== nextTransform || el.style.transform !== nextTransform) {
          el._lastCardTransformStr = nextTransform;
          el.style.transform = nextTransform;
        }
      };

      const applyCardTransform = (el, baseX, baseY, savedAnchorOwner) => {
        if (!el || el.style.display === 'none') return;
        const isCardDragging = Boolean(
          el.classList &&
          el.classList.contains('is-dragging-card') &&
          typeof el._dragDomLeft === 'number' &&
          typeof el._dragDomTop === 'number'
        );
        const isSmoothReplay = Boolean(this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode);
        const useSubpixelGpuTransform = Boolean(isSmoothReplay || isCameraMovingLive);
        const domLeft = isCardDragging ? el._dragDomLeft : (isSmoothReplay ? Math.round(baseX) : baseX);
        const domTop = isCardDragging ? el._dragDomTop : (isSmoothReplay ? Math.round(baseY) : baseY);
        let screenLeft = baseX;
        let screenTop = baseY;
        let effScale = 1.0;
        if (isPdfBoard) {
          let anchor = el._pdfAnchor || (savedAnchorOwner && savedAnchorOwner.pdfAnchor) || null;
          if (!anchor || typeof anchor.mx !== 'number' || typeof anchor.my !== 'number') {
            anchor = this._pinCardToPdfBoardAtScreenPos(el, baseX, baseY, false);
          } else {
            el._pdfAnchor = anchor;
            if (savedAnchorOwner) savedAnchorOwner.pdfAnchor = anchor;
          }
          const s = this.mathToScreen(anchor.mx, anchor.my);
          const tx = s.x - domLeft;
          const ty = s.y - domTop;
          const scaleRatio = (anchor.unitScale > 0 && curUS > 0)
            ? Math.max(0.2, Math.min(4.0, curUS / anchor.unitScale))
            : 1.0;
          screenLeft = s.x;
          screenTop = s.y;
          effScale = scaleRatio;
          let nextTf = '';
          if (isCardDragging) {
            nextTf = Math.abs(scaleRatio - 1.0) > 0.002
              ? `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0) scale(${scaleRatio.toFixed(4)})`
              : `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
          } else if (Math.abs(scaleRatio - 1.0) > 0.002) {
            nextTf = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scaleRatio.toFixed(4)})`;
          } else if (useSubpixelGpuTransform) {
            if (Math.abs(tx) > 0.005 || Math.abs(ty) > 0.005) {
              nextTf = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
            }
          } else if (Math.round(tx) !== 0 || Math.round(ty) !== 0) {
            nextTf = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
          }
          setCardTransformCached(el, '0 0', nextTf);
        } else if (this.isGraphCovered) {
          const s = this.boardToScreen(baseX, baseY);
          const tx = s.x - domLeft;
          const ty = s.y - domTop;
          screenLeft = s.x;
          screenTop = s.y;
          effScale = bz;
          let nextTf = '';
          if (isCardDragging) {
            nextTf = Math.abs(bz - 1.0) > 0.002
              ? `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0) scale(${bz.toFixed(4)})`
              : `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
          } else if (Math.abs(bz - 1.0) > 0.002) {
            nextTf = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${bz.toFixed(4)})`;
          } else if (useSubpixelGpuTransform) {
            if (Math.abs(tx) > 0.005 || Math.abs(ty) > 0.005) {
              nextTf = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
            }
          } else if (Math.round(tx) !== 0 || Math.round(ty) !== 0) {
            nextTf = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
          }
          setCardTransformCached(el, '0 0', nextTf);
        } else if (isCardDragging) {
          const tx = baseX - domLeft;
          const ty = baseY - domTop;
          setCardTransformCached(el, '0 0', `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`);
        } else if (isSmoothReplay) {
          const tx = baseX - domLeft;
          const ty = baseY - domTop;
          if (Math.abs(tx) > 0.005 || Math.abs(ty) > 0.005) {
            setCardTransformCached(el, '0 0', `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`);
          } else {
            setCardTransformCached(el, '', '');
          }
        } else {
          setCardTransformCached(el, '', '');
        }

        if (el.classList && !el.classList.contains('minimized')) {
          if (el._cachedLastWidthStr !== el.style.width) {
            el._cachedLastWidthStr = el.style.width;
            el._cachedCssW = 0;
            el._cachedRawBodyH = 0;
          }
          const cssCardW = (isCardDragging && el._cachedDragW > 0)
            ? el._cachedDragW
            : (parseFloat(el.style.width) || el._cachedCssW || (el._cachedCssW = el.offsetWidth) || 480);
          const screenRight = screenLeft + cssCardW * effScale;
          const viewW = this.screenWidth || (typeof window !== 'undefined' ? window.innerWidth : 1440);
          const viewH = this.screenHeight || (typeof window !== 'undefined' ? window.innerHeight : 900);
          const desiredBoost = (this.isGraphCovered && screenRight >= -40 && screenLeft <= viewW + 40 && screenTop <= viewH + 40)
            ? Math.max(1.0, Math.min(3.5, Math.round(effScale * 20) / 20))
            : 1.0;
          if (Math.abs((el._settledZoomBoost || 1.0) - desiredBoost) > 0.04) {
            needCardHiDpiSchedule = true;
          }
          const dockSpanPx = 42 * effScale;
          const flipLeft = (screenRight + dockSpanPx > viewW - 6) && (screenLeft >= dockSpanPx);
          if (el._probSideDockLeft !== flipLeft) {
            el._probSideDockLeft = flipLeft;
            el.classList.toggle('prob-side-dock-left', flipLeft);
          }
          if (!el.classList.contains('graph-card-widget')) {
            const bodyEl = el._cachedBodyEl || (el._cachedBodyEl = el.querySelector('.problem-card-body'));
            const styleBodyH = bodyEl ? parseFloat(bodyEl.style.height) : 0;
            const rawBodyH = (styleBodyH > 0)
              ? styleBodyH
              : (el._cachedRawBodyH || (el._cachedRawBodyH = (bodyEl && bodyEl.offsetHeight) || el.offsetHeight || 200));
            if (styleBodyH > 0) el._cachedRawBodyH = styleBodyH;
            const hdrEl = el._cachedHdrEl || (el._cachedHdrEl = el.querySelector('.problem-card-header'));
            const hdrCssH = (typeof el._cachedHdrCssH === 'number')
              ? el._cachedHdrCssH
              : (el._cachedHdrCssH = (hdrEl && hdrEl.offsetHeight) || 0);
            el._cachedScreenBodyRect = {
              x: screenLeft,
              y: screenTop + hdrCssH * effScale,
              w: cssCardW * effScale,
              h: rawBodyH * effScale
            };
            let dockTopPx = 0;
            if (screenTop < 0) {
              dockTopPx = Math.max(0, Math.min(Math.max(0, Math.round(rawBodyH - 64)), Math.round((4 - screenTop) / Math.max(0.2, effScale))));
            }
            if (el._probDockTopPx !== dockTopPx) {
              el._probDockTopPx = dockTopPx;
              if (hdrEl) {
                hdrEl.style.top = dockTopPx > 0 ? `${dockTopPx}px` : '';
              }
            }
          }
        } else if (el) {
          el._cachedScreenBodyRect = null;
        }
      };

      const gWidget = document.getElementById('graphCardWidget');
      if (gWidget && (!singleEl || singleEl === gWidget) && this.graphCardData && gWidget.style.display !== 'none') {
        const gx = (typeof this.graphCardBaseX === 'number') ? this.graphCardBaseX : (parseFloat(gWidget.style.left) || 560);
        const gy = (typeof this.graphCardBaseY === 'number') ? this.graphCardBaseY : (parseFloat(gWidget.style.top) || 68);
        if (isPdfBoard && !gWidget._pdfAnchor && this.graphCardPdfAnchor) {
          gWidget._pdfAnchor = this.graphCardPdfAnchor;
        }
        applyCardTransform(gWidget, gx, gy, null);
        if (gWidget._pdfAnchor) this.graphCardPdfAnchor = gWidget._pdfAnchor;
        if (!transformOnly) this.syncGraphCardRectFromWidget();
        if (singleEl === gWidget) return;
      }
      if (this.extraGraphCards && this.extraGraphCards.length > 0) {
        for (let i = 0; i < this.extraGraphCards.length; i++) {
          const c = this.extraGraphCards[i];
          if (c && c.el && (!singleEl || singleEl === c.el) && c.el.style.display !== 'none') {
            const cx = (typeof c.baseX === 'number') ? c.baseX : (parseFloat(c.el.style.left) || 560);
            const cy = (typeof c.baseY === 'number') ? c.baseY : (parseFloat(c.el.style.top) || 68);
            applyCardTransform(c.el, cx, cy, c);
            if (singleEl === c.el) return;
          }
        }
      }
      if (this.extraProblemCards && this.extraProblemCards.length > 0) {
        for (let i = 0; i < this.extraProblemCards.length; i++) {
          const c = this.extraProblemCards[i];
          if (c && c.el && (!singleEl || singleEl === c.el) && c.el.style.display !== 'none') {
            const cx = (typeof c.baseX === 'number') ? c.baseX : (parseFloat(c.el.style.left) || 72);
            const cy = (typeof c.baseY === 'number') ? c.baseY : (parseFloat(c.el.style.top) || 120);
            applyCardTransform(c.el, cx, cy, c);
            if (singleEl === c.el) return;
          }
        }
      }
      const widget = document.getElementById('problemCardWidget');
      if (!widget || (singleEl && singleEl !== widget)) {
        if (needCardHiDpiSchedule && !singleEl) {
          this._scheduleSettledCardHiDpiRefresh();
        }
        return;
      }
      if (!this.problemCardData || widget.style.display === 'none') {
        this.problemCardRect = null;
        if (!this.problemCardData) {
          widget.style.transform = '';
        }
        if (needCardHiDpiSchedule && !singleEl) {
          this._scheduleSettledCardHiDpiRefresh();
        }
        return;
      }
      const px = (typeof this.problemCardBaseX === 'number') ? this.problemCardBaseX : (parseFloat(widget.style.left) || 72);
      const py = (typeof this.problemCardBaseY === 'number') ? this.problemCardBaseY : (parseFloat(widget.style.top) || 18);
      if (isPdfBoard && !widget._pdfAnchor && this.problemCardPdfAnchor) {
        widget._pdfAnchor = this.problemCardPdfAnchor;
      }
      applyCardTransform(widget, px, py, null);
      if (widget._pdfAnchor) this.problemCardPdfAnchor = widget._pdfAnchor;
      if (!transformOnly) this.syncProblemCardRectFromWidget();
      if (needCardHiDpiSchedule && !singleEl) {
        this._scheduleSettledCardHiDpiRefresh();
      }
    }

    _scheduleSettledCardHiDpiRefresh() {
      if (this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode || this._isDeserializingSlide) return;
      const hasRefStamp = Array.isArray(this.inkStrokes) && this.inkStrokes.some(
        (st) => st && st.isProblemStamp && st.graphStamp && st.graphStamp.pdfCropRef
      );
      if (
        !this.graphCardData &&
        !this.problemCardData &&
        !hasRefStamp &&
        !(Array.isArray(this.extraGraphCards) && this.extraGraphCards.length > 0) &&
        !(Array.isArray(this.extraProblemCards) && this.extraProblemCards.length > 0)
      ) {
        return;
      }
      if (typeof this._isSmartNoteViewerOverlayOpen === 'function' && this._isSmartNoteViewerOverlayOpen()) return;
      if (
        this._settledCardHiDpiTimer &&
        (this.isPanning || this.isBoardPanning || this._pinchState || this._isZoomAnimating || this._isWheelZooming || this.isDraggingLassoSelection || this.isResizingLassoSelection || this.isRotatingLassoSelection || this.isLassoSelecting)
      ) {
        return;
      }
      if (this._settledCardHiDpiTimer) {
        clearTimeout(this._settledCardHiDpiTimer);
        this._settledCardHiDpiTimer = null;
      }
      this._settledCardHiDpiTimer = setTimeout(() => {
        this._settledCardHiDpiTimer = null;
        if (this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode || this._isDeserializingSlide) return;
        if (typeof this._isSmartNoteViewerOverlayOpen === 'function' && this._isSmartNoteViewerOverlayOpen()) return;
        const isBusy = Boolean(
          this.isPanning ||
          this.isBoardPanning ||
          this._pinchState ||
          this._isZoomAnimating ||
          this._isWheelZooming ||
          this._isDraggingOrResizingAnyCard ||
          this.isDrawingInk ||
          this.isDraggingLassoSelection ||
          this.isResizingLassoSelection ||
          this.isRotatingLassoSelection ||
          this.isLassoSelecting ||
          this._lassoFlipAnim
        );
        if (isBusy) {
          this._scheduleSettledCardHiDpiRefresh();
          return;
        }
        const viewW = this.screenWidth || (typeof window !== 'undefined' ? window.innerWidth : 1440);
        const viewH = this.screenHeight || (typeof window !== 'undefined' ? window.innerHeight : 900);
        const updateOne = (el, onChanged) => {
          if (!el || el.style.display === 'none' || el.classList.contains('minimized')) return;
          const r = el.getBoundingClientRect();
          const inView = r.width > 4 && r.height > 4 && r.right >= -40 && r.left <= viewW + 40 && r.bottom >= -40 && r.top <= viewH + 40;
          const rawScale = (typeof this._getCardCurrentStageScale === 'function')
            ? this._getCardCurrentStageScale(el)
            : 1.0;
          const desired = (this.isGraphCovered && inView)
            ? Math.max(1.0, Math.min(3.5, Math.round(rawScale * 20) / 20))
            : 1.0;
          if (Math.abs((el._settledZoomBoost || 1.0) - desired) <= 0.03) return;
          el._settledZoomBoost = desired;
          onChanged();
        };

        const gWidget = document.getElementById('graphCardWidget');
        if (gWidget && this.graphCardData) {
          updateOne(gWidget, () => {
            this.syncGraphCardRectFromWidget();
          });
        }
        if (Array.isArray(this.extraGraphCards)) {
          this.extraGraphCards.forEach((c) => {
            if (!c || !c.el) return;
            updateOne(c.el, () => {
              this.renderPipGraphCard(c);
              const extraCvs = c.el.querySelector('.problem-card-canvas');
              if (extraCvs) extraCvs._needsSizeSync = true;
              if (c.el._cardInkStrokes && c.el._cardInkStrokes.length > 0 && typeof c.el._renderCardInkCanvas === 'function') {
                c.el._renderCardInkCanvas();
              }
            });
          });
        }
        const pWidget = document.getElementById('problemCardWidget');
        if (pWidget && this.problemCardData) {
          updateOne(pWidget, () => {
            if (this.problemInkStrokes && this.problemInkStrokes.length > 0) {
              this.syncProblemCardRectFromWidget();
            }
          });
        }
        if (Array.isArray(this.extraProblemCards)) {
          this.extraProblemCards.forEach((c) => {
            if (!c || !c.el) return;
            updateOne(c.el, () => {
              const extraCvs = c.el.querySelector('.problem-card-canvas');
              if (extraCvs) extraCvs._needsSizeSync = true;
              if (c.el._cardInkStrokes && c.el._cardInkStrokes.length > 0 && typeof c.el._renderCardInkCanvas === 'function') {
                c.el._renderCardInkCanvas();
              }
            });
          });
        }
        this._refreshVisibleBoardPdfCropsWhenSettled(viewW, viewH);
      }, 150);
    }

    _refreshVisibleBoardPdfCropsWhenSettled(viewW, viewH) {
      if (this.isPdfModalOpen || this._isAudioReplayActive || this.isStudentAudioVideoOnlyMode || this._isDeserializingSlide) return;
      if (typeof this._isSmartNoteViewerOverlayOpen === 'function' && this._isSmartNoteViewerOverlayOpen()) return;
      if (
        this.isPanning ||
        this.isBoardPanning ||
        this._pinchState ||
        this._isZoomAnimating ||
        this._isWheelZooming ||
        this._isDraggingOrResizingAnyCard ||
        this.isDrawingInk ||
        this.isStylusDrawing ||
        this._isDrawingCardInk ||
        this.isDraggingLassoSelection ||
        this.isResizingLassoSelection ||
        this.isRotatingLassoSelection ||
        this.isLassoSelecting ||
        this._lassoFlipAnim
      ) {
        return;
      }

      const isPdfBoard = Boolean(this.isGraphCovered && this.pdfPageBoardData);
      const bz = Math.max(0.2, Math.min(4.0, this.boardZoom || 1.0));
      this._settledProblemStampStageZoom = isPdfBoard ? (this.zoomLevel || 1.0) : bz;
      if (Array.isArray(this.inkStrokes)) {
        let spanSum = 0;
        for (let i = 0; i < this.inkStrokes.length; i++) {
          const st = this.inkStrokes[i];
          if (st && st.isProblemStamp && st.graphStamp && st.graphStamp.pdfCropRef && Array.isArray(st.points) && st.points.length >= 2) {
            spanSum += Math.abs((st.points[1].x || 0) - (st.points[0].x || 0));
          }
        }
        this._settledProblemStampSpanSum = spanSum;
      }

      const isIOS = (typeof this.isIOSOrIPad === 'function') && this.isIOSOrIPad();
      const dpr = Math.min(2.0, Math.max(1.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1.5));
      const maxZoomSideCap = isIOS ? 3072 : 3584;
      const maxZoomAreaCap = isIOS ? 6200000 : 8800000;
      const jobs = [];

      const pWidget = (typeof document !== 'undefined') ? document.getElementById('problemCardWidget') : null;
      if (
        pWidget &&
        pWidget.style.display !== 'none' &&
        !pWidget.classList.contains('minimized') &&
        this.problemCardData &&
        this.problemCardData.pdfCropRef
      ) {
        const r = pWidget.getBoundingClientRect();
        const inView = r.width > 8 && r.height > 8 && r.right >= -40 && r.left <= viewW + 40 && r.bottom >= -40 && r.top <= viewH + 40;
        if (inView) {
          const pImg = document.getElementById('problemCardImg');
          const curNatW = (pImg && pImg.naturalWidth) || (this.problemCardImage && this.problemCardImage.naturalWidth) || 0;
          const reqPxW = Math.min(maxZoomSideCap, Math.round(r.width * dpr));
          if (curNatW > 0 && reqPxW > curNatW * 1.14) {
            jobs.push({ kind: 'primary', ref: this.problemCardData.pdfCropRef, reqPxW, pData: this.problemCardData });
          }
        }
      }

      if (Array.isArray(this.extraProblemCards)) {
        for (let i = 0; i < this.extraProblemCards.length; i++) {
          const c = this.extraProblemCards[i];
          const ref = c && (c.pdfCropRef || (c.el && c.el._pdfCropRef));
          if (!c || !c.el || !ref || c.el.style.display === 'none' || c.el.classList.contains('minimized')) continue;
          const r = c.el.getBoundingClientRect();
          const inView = r.width > 8 && r.height > 8 && r.right >= -40 && r.left <= viewW + 40 && r.bottom >= -40 && r.top <= viewH + 40;
          if (!inView) continue;
          const imgEl = c.el.querySelector('.problem-card-img');
          const curNatW = (imgEl && imgEl.naturalWidth) || 0;
          const reqPxW = Math.min(maxZoomSideCap, Math.round(r.width * dpr));
          if (curNatW > 0 && reqPxW > curNatW * 1.14) {
            jobs.push({ kind: 'extra', ref, reqPxW, card: c });
          }
        }
      }

      if (Array.isArray(this.inkStrokes)) {
        for (let i = 0; i < this.inkStrokes.length; i++) {
          const st = this.inkStrokes[i];
          if (!st || !st.isProblemStamp || !st.graphStamp || !st.graphStamp.pdfCropRef || !Array.isArray(st.points) || st.points.length < 2) continue;
          if (Boolean(st.onPdfBoard) !== isPdfBoard) continue;
          const p0 = isPdfBoard
            ? (typeof this.mathToScreen === 'function' ? this.mathToScreen(st.points[0].x, st.points[0].y) : null)
            : (typeof this.boardToScreen === 'function' ? this.boardToScreen(st.points[0].x, st.points[0].y) : null);
          const p1 = isPdfBoard
            ? (typeof this.mathToScreen === 'function' ? this.mathToScreen(st.points[1].x, st.points[1].y) : null)
            : (typeof this.boardToScreen === 'function' ? this.boardToScreen(st.points[1].x, st.points[1].y) : null);
          if (!p0 || !p1) continue;
          const minX = Math.min(p0.x, p1.x);
          const maxX = Math.max(p0.x, p1.x);
          const minY = Math.min(p0.y, p1.y);
          const maxY = Math.max(p0.y, p1.y);
          const sw = maxX - minX;
          const sh = maxY - minY;
          if (!(sw > 8 && sh > 8 && maxX >= -40 && minX <= viewW + 40 && maxY >= -40 && minY <= viewH + 40)) continue;
          const curNatW = (st._stampCache && st._stampCache.img && st._stampCache.img.naturalWidth) || 0;
          const reqPxW = Math.min(maxZoomSideCap, Math.round(sw * dpr));
          if (curNatW > 0 && reqPxW > curNatW * 1.14) {
            jobs.push({ kind: 'stamp', ref: st.graphStamp.pdfCropRef, reqPxW, stroke: st });
          }
        }
      }

      if (jobs.length === 0) return;

      const token = (this._boardCropHiResToken || 0) + 1;
      this._boardCropHiResToken = token;

      (async () => {
        let stampUpdated = false;
        for (let i = 0; i < jobs.length; i++) {
          const job = jobs[i];
          if (this._boardCropHiResToken !== token || this.isPdfModalOpen || this.isDrawingInk || this.isStylusDrawing || this._isDrawingCardInk) {
            break;
          }
          const res = await this._ensureProblemCropBlobUrlFromRef(job.ref, {
            targetMinWidthPx: job.reqPxW,
            maxSideCap: maxZoomSideCap,
            maxAreaCap: maxZoomAreaCap
          });
          if (!res || !res.blobUrl || this._boardCropHiResToken !== token) continue;

          if (job.kind === 'primary' && this.problemCardData === job.pData) {
            this.problemCardData.imgUrl = res.blobUrl;
            const liveImg = (typeof document !== 'undefined') ? document.getElementById('problemCardImg') : null;
            if (liveImg && liveImg.src !== res.blobUrl) liveImg.src = res.blobUrl;
            if (res.img) this.problemCardImage = res.img;
          } else if (job.kind === 'extra' && job.card && job.card.el && job.card.el.isConnected !== false) {
            const liveImg = job.card.el.querySelector('.problem-card-img');
            if (liveImg && liveImg.src !== res.blobUrl) liveImg.src = res.blobUrl;
          } else if (job.kind === 'stamp' && job.stroke && job.stroke.graphStamp) {
            job.stroke.graphStamp.dataUrl = res.blobUrl;
            if (job.stroke._stampCache) {
              job.stroke._stampCache.key = '';
              if (res.img) {
                job.stroke._stampCache.img = res.img;
                job.stroke._stampCache.imgUrl = res.blobUrl;
                job.stroke._stampCache.liveDrawable = null;
              }
            }
            stampUpdated = true;
          }
        }
        if (stampUpdated && !this.isDrawingInk && !this.isStylusDrawing && !this._isDrawingCardInk) {
          this._inkBakeDirty = true;
          this.requestRender();
        }
      })();
    }

    // 문제 카드는 이제 전용 독립 캔버스(#problemCardCanvas)를 가진 독립 위젯으로 렌더링되므로
    // 메인 칠판 캔버스에는 그리지 않아 메인 칠판 스크롤/줌과 100% 완벽 분리!
    drawProblemCardLayer(ctx, isExport = false) {
      return;
    }
  }.prototype);
  delete _desc.constructor;
  Object.defineProperties(GraphApp.prototype, _desc);
}
