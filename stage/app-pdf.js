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
      if (btnReturnToBoard) btnReturnToBoard.onclick = () => this.closePdfModal();

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

      // 모달 닫기 (캡처 없이 닫을 때는 _isReplacingViaNextCrop 초기화)
      const btnClose = document.getElementById('btnClosePdfModal');
      if (btnClose) {
        btnClose.onclick = () => {
          this._isReplacingViaNextCrop = false;
          this.closePdfModal();
        };
      }

      // ✂️ 영역 캡처 온/오프 토글 스위치 (기본 꺼짐=이동 모드 ⇄ 클릭 시 켜짐=영역 캡처 모드 ⇄ 재클릭 시 꺼짐=이동 모드)
      const btnCropToggle = document.getElementById('btnPdfCropToggle');
      if (btnCropToggle) {
        btnCropToggle.onclick = () => this.togglePdfCropMode();
      }

      // 📄 전체 페이지 캡처 버튼 (개념 설명 · 여러 문제 판서용: 해당 PDF 페이지 전체를 칠판 캔버스로 바로 삽입!)
      const btnOpenFullPage = document.getElementById('btnPdfOpenFullPage');
      if (btnOpenFullPage) {
        btnOpenFullPage.onclick = () => {
          this.setLessonTeachingMode('page');
          this.openPdfPageOnBoard(this.pdfCurrentPage || 1);
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
      if (btnBoardPrev) btnBoardPrev.onclick = () => this.navigatePdfBoardPage(-1);
      if (btnBoardNext) btnBoardNext.onclick = () => this.navigatePdfBoardPage(1);
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

      if (btnPrev) btnPrev.onclick = () => this.scrollToPdfPage(this.pdfCurrentPage - 1);
      if (btnNext) btnNext.onclick = () => this.scrollToPdfPage(this.pdfCurrentPage + 1);
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

      if (btnZoomIn) btnZoomIn.onclick = () => this.setPdfZoom(this.pdfZoom + 0.15);
      if (btnZoomOut) btnZoomOut.onclick = () => this.setPdfZoom(Math.max(0.6, this.pdfZoom - 0.15));
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
        const meta = this._loadPdfViewStateMeta();
        if (meta) {
          if (meta.fileName && !this.pdfFileName) this.pdfFileName = meta.fileName;
          if (typeof meta.currentPage === 'number' && meta.currentPage >= 1) this.pdfCurrentPage = meta.currentPage;
          if (typeof meta.scrollTop === 'number') this.savedPdfScrollTop = meta.scrollTop;
          if (typeof meta.scrollLeft === 'number') this.savedPdfScrollLeft = meta.scrollLeft;
          if (typeof meta.zoom === 'number' && meta.zoom >= 0.5) this.pdfZoom = meta.zoom;
        }
        const cachedRec = await this._loadLastPdfFromIndexedDB();
        if (cachedRec && cachedRec.bytes && (!this._cachedPdfBytes || !this._cachedPdfBytes.byteLength)) {
          const rawBytes = cachedRec.bytes;
          const normBytes = rawBytes instanceof Uint8Array
            ? rawBytes
            : (rawBytes instanceof ArrayBuffer ? new Uint8Array(rawBytes) : (rawBytes && rawBytes.buffer ? new Uint8Array(rawBytes.buffer) : null));
          if (normBytes && normBytes.byteLength > 0) {
            this._cachedPdfBytes = normBytes;
            if (cachedRec.fileName) this.pdfFileName = cachedRec.fileName;
            if (typeof cachedRec.currentPage === 'number' && cachedRec.currentPage >= 1 && !meta) {
              this.pdfCurrentPage = cachedRec.currentPage;
            }
            this.syncLessonPlaylistNavBarUI();
          }
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
        if (typeof meta.zoom === 'number' && meta.zoom >= 0.5) this.pdfZoom = meta.zoom;
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
            if (typeof cachedRec.zoom === 'number' && cachedRec.zoom >= 0.5) this.pdfZoom = cachedRec.zoom;
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
      const clonedBytes = new Uint8Array(arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer)).slice();
      this._cachedPdfBytes = clonedBytes;
      this.pdfFileName = fileName;
      const preserveScroll = Boolean(options && options.preserveScroll);
      if (!preserveScroll) {
        this.pdfCurrentPage = 1;
        this.savedPdfScrollTop = 0;
        this.savedPdfScrollLeft = 0;
      }
      if (!(options && options.skipIdbSave)) {
        if (this._deferredIdbSaveTimer) clearTimeout(this._deferredIdbSaveTimer);
        this._deferredIdbSaveTimer = setTimeout(() => {
          this._deferredIdbSaveTimer = null;
          this._saveLastPdfToIndexedDB(clonedBytes, fileName);
        }, 1500);
      }

      this.showToast('⏳ PDF 문서를 불러오는 중입니다...');
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
        this.showToast('❌ PDF 파일을 파싱하는 데 실패했습니다: ' + err.message);
        throw err;
      });
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
      const mode = this.lessonTeachingMode; // null (미정: 2개 모두 표시) | 'crop' | 'page'
      const showCropBtn = (mode !== 'page');
      const showPageBtn = (mode !== 'crop');
      const btnCropToggle = document.getElementById('btnPdfCropToggle');
      const btnOpenFullPage = document.getElementById('btnPdfOpenFullPage');
      if (btnCropToggle) {
        btnCropToggle.style.display = showCropBtn ? 'inline-flex' : 'none';
      }
      if (btnOpenFullPage) {
        btnOpenFullPage.style.display = showPageBtn ? 'inline-flex' : 'none';
      }
    }

    async appendNextPdfPageSlide() {
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
        // 🌟 [핵심: 다음 캡처 / PDF 모달 진입 순간 자동 녹화 컷 & 대기 엔진]:
        // 녹음 중 [다음 캡처]를 눌러 PDF 창에 들어가는 즉시 이전 슬라이드 녹화를 종료(저장)하고,
        // PDF에서 문제를 고르는 동안에는 음성 녹음과 포인터 추적을 100% 중단하여 허공 포인터/공백 녹음을 원천 차단합니다!
        if (this.isAudioRecording && !this.isAudioRecordPaused) {
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
        if (this._pdfPinchMoveRaf) {
          cancelAnimationFrame(this._pdfPinchMoveRaf);
          this._pdfPinchMoveRaf = null;
        }
        this._pdfPinchState = null;
        if (this._pdfTouchPointers) this._pdfTouchPointers.clear();
        modal.style.display = 'flex';
        document.body.classList.add('pdf-modal-open');
        this.isPdfModalOpen = true;
        this._lastPdfModalOpenAt = performance.now();
        this.syncPdfModalModeUI();

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
        this.togglePdfCropMode(allowCrop);
        if (this.pdfDoc && !isInitialLoad) {
          const container = document.getElementById('pdfPagesContainer');
          const viewport = document.getElementById('pdfViewport');
          if (!container || container.children.length === 0) {
            this.renderAllPdfPages(true);
          } else if (viewport) {
            // 🌟 [핵심 개선]: 다시 크롭을 눌렀을 때 문서 맨 처음으로 올라가지 않고 직전에 보던 스크롤 위치 그대로 100% 복원!
            const targetTop = (typeof this.savedPdfScrollTop === 'number') ? this.savedPdfScrollTop : viewport.scrollTop;
            const targetLeft = (typeof this.savedPdfScrollLeft === 'number') ? this.savedPdfScrollLeft : viewport.scrollLeft;
            viewport.scrollTop = targetTop;
            viewport.scrollLeft = targetLeft;
            requestAnimationFrame(() => {
              viewport.scrollTop = targetTop;
              viewport.scrollLeft = targetLeft;
            });
            this.renderVisiblePdfWindow(this.pdfCurrentPage || 1, false);
          }
        }
      }
    }

    closePdfModal() {
      this._stopPdfViewportInertia();
      if (this._pdfPinchMoveRaf) {
        cancelAnimationFrame(this._pdfPinchMoveRaf);
        this._pdfPinchMoveRaf = null;
      }
      this._pdfPinchState = null;
      if (this._pdfTouchPointers) this._pdfTouchPointers.clear();
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
        this.togglePdfCropMode(false);
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
      // 만약 PDF 창을 열었다가 자동 일시정지된 상태(_autoPausedByPdfModal)에서 돌아온 경우 즉시 녹화 재개!
      if (this.isAudioRecording && this._autoPausedByPdfModal) {
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

    _getPdfBoardCacheKey(pageNum, dataUrl = '') {
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

    _getPdfPageCanvasFromCache(pageNum, dataUrl = '') {
      if (!this._pdfPageCanvasCache) return null;
      const key = this._getPdfBoardCacheKey(pageNum, dataUrl);
      let cv = (key && this._pdfPageCanvasCache[key]) ||
        ((this._pdfPageCanvasCacheDoc && this.pdfDoc && this._pdfPageCanvasCacheDoc === this.pdfDoc && pageNum) ? this._pdfPageCanvasCache[pageNum] : null);
      if (!this._isValidPdfBoardCanvas(cv)) {
        if (key && this._pdfPageCanvasCache[key]) delete this._pdfPageCanvasCache[key];
        if (pageNum && this._pdfPageCanvasCache[pageNum] === cv) delete this._pdfPageCanvasCache[pageNum];
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

    _putPdfPageCanvasInCache(pageNum, pageCanvas, dataUrl = '') {
      if (!this._isValidPdfBoardCanvas(pageCanvas)) return;
      if (!this._pdfPageCanvasCache) this._pdfPageCanvasCache = {};
      if (!Array.isArray(this._pdfPageCanvasCacheOrder)) this._pdfPageCanvasCacheOrder = [];
      if (!pageCanvas._cachedDataUrl) {
        pageCanvas._cachedDataUrl = (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/'))
          ? dataUrl
          : this.encodeCanvasSmartWebP(pageCanvas, 0.88);
      }
      const key = this._getPdfBoardCacheKey(pageNum, pageCanvas._cachedDataUrl);
      if (!key) return;
      this._pdfPageCanvasCache[key] = pageCanvas;
      if (this._pdfPageCanvasCacheDoc && this.pdfDoc && this._pdfPageCanvasCacheDoc === this.pdfDoc && pageNum) {
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
      const cached = this._getPdfPageCanvasFromCache(pbd.pageNum, pbd.dataUrl);
      if (cached) {
        pbd.canvas = cached;
        return Promise.resolve(cached);
      }
      if (!pbd.dataUrl || typeof Image === 'undefined') {
        return Promise.resolve(null);
      }
      if (pbd._loadingPromise) return pbd._loadingPromise;
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
            this._putPdfPageCanvasInCache(pbd.pageNum, offC, pbd.dataUrl);
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
      const pageCanvas = this.pdfPageBoardData && (
        (this._isValidPdfBoardCanvas(this.pdfPageBoardData.canvas) ? this.pdfPageBoardData.canvas : null) ||
        (this.pdfPageBoardData.img && this.pdfPageBoardData.img.complete && this.pdfPageBoardData.img.naturalWidth > 0 ? this.pdfPageBoardData.img : null)
      );
      if (!this.pdfPageBoardData || !pageCanvas) {
        if (this.pdfPageBoardData && !this.pdfPageBoardData.canvas && this.pdfPageBoardData.dataUrl) {
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
      const isActivelyMovingCamera = !isExport && Boolean(this.isPanning || this._isZoomAnimating || this._pinchState);
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
        pageCanvas._mipCanvas &&
        pageCanvas._mipCanvas.width > 4 &&
        (drawW * effDpr) <= (pageCanvas._mipCanvas.width * 1.15)
      );
      const sourceTex = canUseMipWithoutBlur ? pageCanvas._mipCanvas : pageCanvas;

      if (isActivelyMovingCamera) {
        this._cancelPdfBoardHiResTilePending();
      }

      ctx.save();
      if (!isExport && !isActivelyMovingCamera) {
        ctx.shadowColor = isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(0, 0, 0, 0.50)';
        ctx.shadowBlur = isLight ? 20 : 26;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = isActivelyMovingCamera ? 'medium' : 'high';
      ctx.drawImage(sourceTex, drawX, drawY, drawW, drawH);

      // 🌟 [고배율(145%~350%) 정지 시 현재 화면 영역만 1:1 원본 벡터 타일로 선명화]:
      // 전체 페이지 캔버스(2,800px)는 그대로 유지해 저장 용량·메모리를 보호하면서,
      // 줌/패닝이 멈춘 즉시 화면에 보이는 교집합(최대 뷰포트 크기, ~3.8MP)만 pdf.js 벡터로 덮어 그려 350%에서도 인쇄물급 칼화질을 보장합니다!
      if (!isExport && !isActivelyMovingCamera && ctx === this.ctx && !this._isRenderingGraphSnapshot) {
        const docUid = (this.pdfDoc && this.pdfDoc._graphlyDocUid) || '';
        const hasLiveVectorDoc = Boolean(
          this.pdfDoc &&
          docUid &&
          this.pdfPageBoardData.pdfDocUid === docUid &&
          typeof this.pdfDoc.getPage === 'function'
        );
        const baseTexW = pageCanvas.width || pageCanvas.naturalWidth || 2800;
        if (hasLiveVectorDoc && (drawW * effDpr) > (baseTexW * 1.15)) {
          const sw = Math.max(1, this.screenWidth || window.innerWidth || 1280);
          const sh = Math.max(1, this.screenHeight || window.innerHeight || 720);
          const visL = Math.max(0, Math.floor(drawX));
          const visT = Math.max(0, Math.floor(drawY));
          const visR = Math.min(sw, Math.ceil(drawX + drawW));
          const visB = Math.min(sh, Math.ceil(drawY + drawH));
          const visW = visR - visL;
          const visH = visB - visT;
          if (visW > 8 && visH > 8) {
            const pageNum = this.pdfPageBoardData.pageNum || 1;
            const tileKey = `${docUid}|${pageNum}|${Math.round(drawX * 2)}|${Math.round(drawY * 2)}|${Math.round(drawW * 2)}|${Math.round(drawH * 2)}|${visL}|${visT}|${visW}|${visH}|${Math.round(effDpr * 100)}`;
            const readyTile = this._pdfBoardHiResTile;
            if (readyTile && readyTile.key === tileKey && readyTile.canvas && readyTile.canvas.width > 2 && readyTile.canvas.height > 2) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(drawX, drawY, drawW, drawH);
              ctx.clip();
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(readyTile.canvas, visL, visT, visW, visH);
              ctx.restore();
            } else {
              this._schedulePdfBoardHiResTile({
                key: tileKey,
                docUid,
                pageNum,
                drawX,
                drawY,
                drawW,
                drawH,
                visL,
                visT,
                visW,
                visH,
                effDpr
              });
            }
          }
        }
      }

      if (!isExport) {
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

    async openPdfPageOnBoard(pageNum, options = {}) {
      if (!this.pdfDoc) {
        this.showToast('⚠️ 먼저 PDF 문서를 열어주세요.');
        return;
      }
      this.setLessonTeachingMode('page');
      const total = this.pdfTotalPages || this.pdfDoc.numPages || 1;
      const targetPage = Math.max(1, Math.min(pageNum || this.pdfCurrentPage || 1, total));

      // 🌟 [대표님 핵심 기획: 슬라이드 완전 일원화 & 자동 다음 슬라이드 오픈]
      // 슬라이드를 미리 추가(+)하지 않고도 [PDF]를 눌러 [📄 전체 페이지 캡처]를 클릭하면,
      // 현재 슬라이드에 이미 내용이 있을 경우 자동으로 이전 슬라이드를 보관하고 깨끗한 다음 슬라이드에 삽입합니다!
      const hasExistingContent = !Boolean(options && options.skipArchiveCurrent) && this.hasAnyWorkspaceContent();
      const replaceMode = Boolean(this._isReplacingViaNextCrop || hasExistingContent);
      this._isReplacingViaNextCrop = false;
      if (replaceMode && typeof this.canAddMoreSlidesWithQuota === 'function' && !this.canAddMoreSlidesWithQuota(1)) {
        if (this.isAudioRecording) {
          this._isAudioWaitingForNextSlideSetup = false;
        }
        return;
      }
      if (this.isAudioRecording) {
        this._isAudioWaitingForNextSlideSetup = true;
      }
      if (replaceMode) {
        this._archiveCurrentBeforeNextCapture();
      }

      // 현재 캔버스의 이전 문제 카드·그래프 카드·필기·PDF 보드 데이터를 100% 깨끗하게 초기화하여 슬라이드 간 섞임 원천 차단!
      this.resetBoardAndProblemCardsForNext();

      // PDF 페이지 캡처모드급 초선명 마스터 세팅(가로 ~2800px / WebP 0.88 — 태블릿·PC 2.5x 확대 시 네이티브 PDF급 선명도!) 오프스크린 렌더링
      // + iOS/iPadOS WebKit 하드웨어 캔버스 한계(4096px / 16.77MP) 안전 클램프 + 1/2 Mipmap 가속 + LRU 캐시(iOS 2장 / PC 5장) 보호!
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
      let pageCanvas = this._getPdfPageCanvasFromCache(targetPage);
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

        pageCanvas._cachedDataUrl = this.encodeCanvasSmartWebP(pageCanvas, 0.88);
        this._putPdfPageCanvasInCache(targetPage, pageCanvas, pageCanvas._cachedDataUrl);
      } else if (!pageCanvas._cachedDataUrl) {
        pageCanvas._cachedDataUrl = this.encodeCanvasSmartWebP(pageCanvas, 0.88);
      }

      // 🌟 [대표님 피드백 반영: PDF 삽입 시 화면 거의 꽉 차게 확대 삽입 + 그래프 소환 시 아담한 비율 보장!] 🌟
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

      if (this.pdfDoc && !this.pdfDoc._graphlyDocUid) {
        this.pdfDoc._graphlyDocUid = `pdfdoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
      this._invalidatePdfBoardHiResTile(false);

      this.pdfPageBoardData = {
        pageNum: targetPage,
        totalPages: total,
        pdfDocUid: (this.pdfDoc && this.pdfDoc._graphlyDocUid) || '',
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

      this.updatePdfPageNavUI(targetPage);
      if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed) {
        this.closeDrawer();
      }
      if (!this.isInkMode) {
        this.toggleInkMode(true);
      }
      // 패드(두 손가락 이동)·액타(스페이스바 드래그) 중심 설계: 강제 이동 전환 없이 즉시 필기 가능하도록 펜(또는 형광펜) 유지!
      if (this.activeInkTool !== 'highlighter') {
        this.setActiveInkTool('pen');
      }

      if (replaceMode) {
        this._finalizeAppendedCaptureSlide('');
      } else {
        this._isAudioWaitingForNextSlideSetup = false;
        if (this.isAudioRecording) {
          if (!this.audioInitialState || (this.getAudioRecordElapsedMs() < 400 && (!this.audioTimeline || this.audioTimeline.length <= 1))) {
            this.audioInitialState = this._captureAudioWorkspaceKeyframe();
          }
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        if (this.isLessonPlaylistActive) {
          this.saveCurrentSlideIntoPlaylist();
          this.syncLessonPlaylistNavBarUI();
        } else {
          // PDF 한 페이지를 처음 불러왔을 때도 즉시 상단 슬라이드바(📑 1/1 + [PDF] 버튼)를 활성화하여 다음 페이지 추가가 원클릭으로 가능하도록!
          const firstSlide = this.serializeFullSlideState('1');
          this.lessonPlaylistSlides = [firstSlide];
          this.lessonPlaylistIndex = 0;
          this.isLessonPlaylistActive = true;
          this.syncLessonPlaylistNavBarUI();
        }
      }
      this.closePdfModal();

      this.syncControls();
      this.renderLayerList();
      this.renderFuncList();
      this.syncPdfBoardNavBarUI();
      this.syncGraphSnapBarUI();
      this.render();
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
      this._pdfBoardHiResTile = null;
      if (releaseBuffers) {
        for (const k of ['_pdfBoardHiResCanvasA', '_pdfBoardHiResCanvasB']) {
          const cv = this[k];
          if (cv) {
            try { cv.width = 1; cv.height = 1; } catch (e) { }
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

      this._pdfBoardHiResTileTimer = setTimeout(async () => {
        this._pdfBoardHiResTileTimer = null;
        if (
          this._pdfBoardHiResTileToken !== token ||
          this.isPdfModalOpen ||
          !this.pdfPageBoardData ||
          this.isPanning ||
          this._pinchState ||
          this._isZoomAnimating ||
          !this.pdfDoc ||
          this.pdfDoc._graphlyDocUid !== req.docUid ||
          (this.pdfPageBoardData.pageNum || 1) !== req.pageNum
        ) {
          if (this._pdfBoardHiResTileInFlightKey === req.key) {
            this._pdfBoardHiResTileInFlightKey = null;
          }
          return;
        }

        try {
          const page = await this.pdfDoc.getPage(req.pageNum);
          if (this._pdfBoardHiResTileToken !== token || !this.pdfPageBoardData) {
            if (this._pdfBoardHiResTileInFlightKey === req.key) {
              this._pdfBoardHiResTileInFlightKey = null;
            }
            return;
          }

          const baseVp = page.getViewport({ scale: 1.0 });
          let tileDpr = Math.min(2.5, Math.max(1.5, req.effDpr || 2.0));
          const maxSideScale = 3840 / Math.max(1, req.visW, req.visH);
          const maxAreaScale = Math.sqrt(12500000 / Math.max(1, req.visW * req.visH));
          tileDpr = Math.max(1.0, Math.min(tileDpr, maxSideScale, maxAreaScale));

          const tilePxW = Math.max(1, Math.round(req.visW * tileDpr));
          const tilePxH = Math.max(1, Math.round(req.visH * tileDpr));
          const vecScale = (req.drawW / Math.max(1, baseVp.width)) * tileDpr;
          const tileVp = page.getViewport({
            scale: vecScale,
            offsetX: (req.drawX - req.visL) * tileDpr,
            offsetY: (req.drawY - req.visT) * tileDpr
          });

          if (!this._pdfBoardHiResCanvasA) this._pdfBoardHiResCanvasA = document.createElement('canvas');
          if (!this._pdfBoardHiResCanvasB) this._pdfBoardHiResCanvasB = document.createElement('canvas');
          const activeCv = this._pdfBoardHiResTile && this._pdfBoardHiResTile.canvas;
          const stagingCv = (activeCv === this._pdfBoardHiResCanvasA)
            ? this._pdfBoardHiResCanvasB
            : this._pdfBoardHiResCanvasA;

          stagingCv.width = tilePxW;
          stagingCv.height = tilePxH;
          const tCtx = stagingCv.getContext('2d', { alpha: false }) || stagingCv.getContext('2d');
          if (!tCtx) {
            this._pdfBoardHiResTileInFlightKey = null;
            return;
          }
          tCtx.fillStyle = '#ffffff';
          tCtx.fillRect(0, 0, tilePxW, tilePxH);

          const renderTask = page.render({ canvasContext: tCtx, viewport: tileVp });
          this._pdfBoardHiResTileRenderTask = renderTask;
          await renderTask.promise;

          if (this._pdfBoardHiResTileToken !== token) return;
          this._pdfBoardHiResTileRenderTask = null;
          this._pdfBoardHiResTileInFlightKey = null;
          this._pdfBoardHiResTile = {
            key: req.key,
            visL: req.visL,
            visT: req.visT,
            visW: req.visW,
            visH: req.visH,
            canvas: stagingCv
          };
          this._hasSceneFreeze = false;
          if (this.isDrawingInk || this.isStylusDrawing || this._isDrawingCardInk) {
            this._needsRenderAfterInkStroke = true;
          } else {
            this.requestRender();
          }
        } catch (err) {
          if (this._pdfBoardHiResTileToken === token) {
            this._pdfBoardHiResTileRenderTask = null;
            this._pdfBoardHiResTileInFlightKey = null;
          }
        }
      }, 75);
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
    // [📑 순정 표준 PDF 뷰어 엔진: 단일 IntersectionObserver + 기본 <canvas> 단판 렌더링]
    // ==========================================================================
    _setupPdfPageObserver() {
      if (this._pdfPageObserver) {
        this._pdfPageObserver.disconnect();
        this._pdfPageObserver = null;
      }
      const viewport = document.getElementById('pdfViewport');
      if (!viewport || typeof IntersectionObserver === 'undefined') return;

      this._pdfPageObserver = new IntersectionObserver((entries) => {
        if (!this.pdfDoc || !this.isPdfModalOpen) return;
        for (const entry of entries) {
          const wrapper = entry.target;
          const pageNum = parseInt(wrapper.dataset.page, 10);
          if (!pageNum) continue;
          const canvas = document.getElementById(`pdfPageCanvas_${pageNum}`);
          if (!canvas) continue;

          if (entry.isIntersecting) {
            this.renderPdfPageToCanvas(pageNum, canvas, wrapper);
          } else {
            // 화면 밖으로 벗어난 페이지: 진행 중인 렌더링 즉시 취소 (renderTask.cancel)
            if (canvas._pdfRenderTask && typeof canvas._pdfRenderTask.cancel === 'function') {
              try { canvas._pdfRenderTask.cancel(); } catch (e) { }
              canvas._pdfRenderTask = null;
              canvas._isRenderingPdfPage = false;
            }
            // 멀리 벗어난 페이지(> 6장)는 캔버스를 비워 메모리 관리
            if (Math.abs(pageNum - (this.pdfCurrentPage || 1)) > 6 && this.pdfPageRenderStates[pageNum]) {
              canvas.width = 1;
              canvas.height = 1;
              canvas._renderedZoom = null;
              delete this.pdfPageRenderStates[pageNum];
            }
          }
        }
      }, {
        root: viewport,
        rootMargin: '100% 0px 100% 0px',
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
      const defW = Math.round(((this.pdfDefaultPageSize && this.pdfDefaultPageSize.width) || 595) * (this.pdfZoom || 1.75));
      const defH = Math.round(((this.pdfDefaultPageSize && this.pdfDefaultPageSize.height) || 842) * (this.pdfZoom || 1.75));
      this._cachedPdfPageCssH = defH;

      if (resetContainer || container.children.length !== this.pdfTotalPages) {
        if (this._pdfPageObserver) {
          this._pdfPageObserver.disconnect();
          this._pdfPageObserver = null;
        }
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

          frag.appendChild(wrapper);
        }
        container.appendChild(frag);
        this._setupPdfPageObserver();
        this.renderVisiblePdfWindow(currentPageToKeep, true);
        this.updatePdfPageNavUI(currentPageToKeep, true);
      } else {
        this._setupPdfPageObserver();
        this.renderVisiblePdfWindow(currentPageToKeep, true);
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
        const canvas = document.getElementById(`pdfPageCanvas_${p}`);
        const wrapper = document.getElementById(`pdfPageWrapper_${p}`);
        if (!canvas || !wrapper) continue;
        if (forceReRender) {
          canvas._renderedZoom = null;
        }
        this.renderPdfPageToCanvas(p, canvas, wrapper);
      }
    }

    renderPdfPageToCanvas(pageNum, canvas, wrapper, onComplete = null) {
      if (!this.pdfDoc || !canvas) {
        if (onComplete) onComplete();
        return;
      }
      const targetZoom = this.pdfZoom || 1.75;
      if (canvas._renderedZoom === targetZoom && (this.pdfPageRenderStates[pageNum] || canvas._isRenderingPdfPage)) {
        if (onComplete) onComplete();
        return;
      }

      if (canvas._pdfRenderTask && typeof canvas._pdfRenderTask.cancel === 'function') {
        try { canvas._pdfRenderTask.cancel(); } catch (e) { }
        canvas._pdfRenderTask = null;
      }
      canvas._isRenderingPdfPage = true;
      const renderToken = (canvas._renderToken || 0) + 1;
      canvas._renderToken = renderToken;

      this.pdfDoc.getPage(pageNum).then(page => {
        if (!this.pdfDoc || canvas._renderToken !== renderToken) {
          canvas._isRenderingPdfPage = false;
          return;
        }

        const baseVp = page.getViewport({ scale: 1.0 });
        const cssW = Math.round(baseVp.width * targetZoom);
        const cssH = Math.round(baseVp.height * targetZoom);
        this._cachedPdfPageCssH = cssH;

        // 표준 Retina 해상도 + iOS/iPadOS WebKit 하드웨어 캔버스 한계(4,032px / 15.5MP) 안전 클램프!
        const dpr = Math.min(2.0, Math.max(1.5, window.devicePixelRatio || 1.5));
        const desiredScale = targetZoom * dpr;
        const maxSideScale = 4032 / Math.max(1, baseVp.width, baseVp.height);
        const maxAreaScale = Math.sqrt(15500000 / Math.max(1, baseVp.width * baseVp.height));
        const renderScale = Math.max(1.0, Math.min(desiredScale, maxSideScale, maxAreaScale));
        const viewport = page.getViewport({ scale: renderScale });

        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        if (wrapper) {
          wrapper.style.width = `${cssW}px`;
          wrapper.style.height = `${cssH}px`;
          wrapper._basePdfW = baseVp.width;
          wrapper._basePdfH = baseVp.height;
        }

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({ canvasContext: ctx, viewport });
        canvas._pdfRenderTask = renderTask;

        renderTask.promise.then(() => {
          if (canvas._renderToken === renderToken) {
            canvas._pdfRenderTask = null;
            canvas._isRenderingPdfPage = false;
            canvas._renderedZoom = targetZoom;
            canvas._renderedScale = renderScale;
            this.pdfPageRenderStates[pageNum] = true;
          }
          if (onComplete) onComplete();
        }).catch(err => {
          if (canvas._renderToken === renderToken) {
            canvas._pdfRenderTask = null;
            canvas._isRenderingPdfPage = false;
          }
          if (err && err.name !== 'RenderingCancelledException') {
            console.error(`p.${pageNum} 렌더링 에러:`, err);
          }
        });
      }).catch(() => {
        if (canvas._renderToken === renderToken) {
          canvas._isRenderingPdfPage = false;
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
      }
      this.updatePdfPageNavUI(pageNum, false);
    }

    onPdfViewportScroll() {
      const viewport = document.getElementById('pdfViewport');
      if (!viewport || !this.pdfDoc) return;

      if (this.isPdfModalOpen) {
        this.savedPdfScrollTop = viewport.scrollTop;
        this.savedPdfScrollLeft = viewport.scrollLeft;
      }

      const pageH = this._cachedPdfPageCssH || Math.round(((this.pdfDefaultPageSize && this.pdfDefaultPageSize.height) || 842) * (this.pdfZoom || 1.75));
      const stride = Math.max(100, pageH + 28);
      const approxPage = Math.floor((viewport.scrollTop + viewport.clientHeight * 0.35 - 24) / stride) + 1;
      const currentVisiblePage = Math.max(1, Math.min(this.pdfTotalPages || 1, approxPage));

      if (currentVisiblePage !== this.pdfCurrentPage) {
        this.updatePdfPageNavUI(currentVisiblePage, true);
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
      const nextZoom = Math.max(0.5, Math.min(zoom, 4.0));
      const isFastPreview = Boolean(options && options.fastPreview);
      if (!isFastPreview && Math.abs(nextZoom - prevZoom) < 0.002) return;

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
        const c = w.querySelector('canvas');
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
          const newScrollLeft = Math.max(0, viewport.scrollLeft + (ptClientX - options.currentMidClientX));
          const newScrollTop = Math.max(0, viewport.scrollTop + (ptClientY - options.currentMidClientY));
          viewport.scrollTop = newScrollTop;
          viewport.scrollLeft = newScrollLeft;
          this.savedPdfScrollTop = newScrollTop;
          this.savedPdfScrollLeft = newScrollLeft;
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
      }

      this._cachedPdfPageCssH = Math.round(((this.pdfDefaultPageSize && this.pdfDefaultPageSize.height) || 842) * nextZoom);
      if (this._pdfPinchRenderTimer) {
        clearTimeout(this._pdfPinchRenderTimer);
        this._pdfPinchRenderTimer = null;
      }
      // 핀치 도중(isFastPreview: true)에는 무거운 PDF 전체 재렌더링 타이머를 돌리지 않고 손가락을 뗄 때(endPdfViewerPinch) 단 1회만 고화질 베이크!
      if (!isFastPreview) {
        this._pdfPinchRenderTimer = setTimeout(() => {
          this._pdfPinchRenderTimer = null;
          this.renderAllPdfPages(false);
        }, 110);
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

    togglePdfCropMode(forceVal = null) {
      this._stopPdfViewportInertia();
      if (this._pdfPinchMoveRaf) {
        cancelAnimationFrame(this._pdfPinchMoveRaf);
        this._pdfPinchMoveRaf = null;
      }
      this._pdfPinchState = null;
      if (this._pdfTouchPointers) this._pdfTouchPointers.clear();
      const prevState = Boolean(this.isPdfCropModeActive);
      let nextState = (forceVal !== null) ? Boolean(forceVal) : !prevState;
      if (this.lessonTeachingMode === 'page') {
        nextState = false;
      }
      this.isPdfCropModeActive = nextState;

      const btn = document.getElementById('btnPdfCropToggle');
      if (btn) {
        btn.classList.toggle('active', this.isPdfCropModeActive);
        btn.setAttribute('aria-pressed', this.isPdfCropModeActive ? 'true' : 'false');
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

      if (forceVal === null) {
        if (this.isPdfCropModeActive) {
          this.showToast('✂️ 영역 캡처 켜짐: 원하는 문제 영역을 네모로 드래그하세요');
        } else {
          this.showToast('✋ 영역 캡처 꺼짐: 드래그하여 PDF 화면을 이동할 수 있습니다');
        }
      } else if (this.isPdfCropModeActive) {
        this.showToast('✂️ 문제 영역을 네모로 드래그하세요');
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

      // 마우스 측면 뒤로가기 버튼(버튼 3, 4) 오작동 방지
      window.addEventListener('pointerdown', (e) => {
        if (this.isPdfModalOpen && (e.button === 3 || e.button === 4)) {
          e.preventDefault();
        }
      });

      // 🌟 [아이패드 / 태블릿 PDF 모달 뷰어(#pdfViewport) 두 손가락 핀치 줌 & 두 손가락 스크롤] 🌟
      this._pdfTouchPointers = new Map();
      this._pdfPinchState = null;
      this._pdfPinchMoveRaf = null;

      const capturePdfAnchorAtClientPoint = (midClientX, midClientY) => {
        let anchorPageEl = null;
        let bestDistY = Infinity;
        const wrappers = document.querySelectorAll('.pdf-page-wrapper');
        wrappers.forEach(w => {
          const r = w.getBoundingClientRect();
          const dy = (midClientY < r.top) ? (r.top - midClientY) : (midClientY > r.bottom ? (midClientY - r.bottom) : 0);
          if (dy < bestDistY) {
            bestDistY = dy;
            anchorPageEl = w;
          }
        });
        let anchorRelX = 0.5;
        let anchorRelY = 0.5;
        if (anchorPageEl) {
          const pRect = anchorPageEl.getBoundingClientRect();
          if (pRect.width > 0) anchorRelX = (midClientX - pRect.left) / pRect.width;
          if (pRect.height > 0) anchorRelY = (midClientY - pRect.top) / pRect.height;
        }
        return { anchorPageEl, anchorRelX, anchorRelY };
      };

      const startPdfViewerPinch = (p1, p2) => {
        this._stopPdfViewportInertia();
        if (this._pdfPinchMoveRaf) {
          cancelAnimationFrame(this._pdfPinchMoveRaf);
          this._pdfPinchMoveRaf = null;
        }
        this.isPdfCropping = false;
        this._isPdfViewportPanning = false;
        this._pdfViewportPanStart = null;
        viewport.classList.remove('panning-active');
        if (cropBox) cropBox.style.display = 'none';
        if (this.activeCropPointerId !== null && this.activeCropPointerId !== undefined) {
          try { viewport.releasePointerCapture(this.activeCropPointerId); } catch (err) { }
          this.activeCropPointerId = null;
        }
        const vRect = viewport.getBoundingClientRect();
        const midClientX = (p1.x + p2.x) / 2;
        const midClientY = (p1.y + p2.y) / 2;
        const midX = midClientX - vRect.left;
        const midY = midClientY - vRect.top;
        const dist = Math.max(24, Math.hypot(p2.x - p1.x, p2.y - p1.y));
        const { anchorPageEl, anchorRelX, anchorRelY } = capturePdfAnchorAtClientPoint(midClientX, midClientY);

        this._pdfPinchState = {
          id1: p1.id,
          id2: p2.id,
          zoomUnlocked: false,
          _parallelPanLocked: false,
          initDist: dist,
          initMidClientX: midClientX,
          initMidClientY: midClientY,
          startDist: dist,
          smoothDist: dist,
          startZoom: this.pdfZoom || 1.5,
          startMidX: midX,
          startMidY: midY,
          smoothMidClientX: midClientX,
          smoothMidClientY: midClientY,
          anchorPageEl,
          anchorRelX,
          anchorRelY,
          contentX: viewport.scrollLeft + midX,
          contentY: viewport.scrollTop + midY,
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
        const vRect = viewport.getBoundingClientRect();
        const rawMidClientX = (p1.x + p2.x) / 2;
        const rawMidClientY = (p1.y + p2.y) / 2;
        const rawDist = Math.max(24, Math.hypot(p2.x - p1.x, p2.y - p1.y));
        const panTravelFromInit = Math.hypot(rawMidClientX - st.initMidClientX, rawMidClientY - st.initMidClientY);
        const distDeltaFromInit = Math.abs(rawDist - st.initDist);

        if (!st.zoomUnlocked && panTravelFromInit >= 26 && distDeltaFromInit < 14) {
          st._parallelPanLocked = true;
        }

        // 🛡️ 중점·거리 위상 동기화 EMA 로우패스 필터
        const jitterMid = Math.hypot(rawMidClientX - st.smoothMidClientX, rawMidClientY - st.smoothMidClientY);
        const alphaMid = (jitterMid < 1.0) ? 0.32 : 0.68;
        st.smoothMidClientX = st.smoothMidClientX + (rawMidClientX - st.smoothMidClientX) * alphaMid;
        st.smoothMidClientY = st.smoothMidClientY + (rawMidClientY - st.smoothMidClientY) * alphaMid;

        if (!st.zoomUnlocked) {
          const unlockThreshold = st._parallelPanLocked ? 28 : 14;
          if (distDeltaFromInit >= unlockThreshold) {
            st.zoomUnlocked = true;
            st.startDist = rawDist;
            st.smoothDist = rawDist;
            st.startZoom = this.pdfZoom || 1.5;
            st.smoothMidClientX = rawMidClientX;
            st.smoothMidClientY = rawMidClientY;
            const anchored = capturePdfAnchorAtClientPoint(rawMidClientX, rawMidClientY);
            st.anchorPageEl = anchored.anchorPageEl;
            st.anchorRelX = anchored.anchorRelX;
            st.anchorRelY = anchored.anchorRelY;
            const midX0 = rawMidClientX - vRect.left;
            const midY0 = rawMidClientY - vRect.top;
            st.contentX = viewport.scrollLeft + midX0;
            st.contentY = viewport.scrollTop + midY0;
          } else {
            // 줌 임계값 도달 전 두 손가락 평행 이동: 페이지 리플로우 없이 스크롤 위치만 부드럽게 이동
            if (st.anchorPageEl) {
              const pRect = st.anchorPageEl.getBoundingClientRect();
              const ptClientX = pRect.left + st.anchorRelX * pRect.width;
              const ptClientY = pRect.top + st.anchorRelY * pRect.height;
              viewport.scrollLeft = Math.max(0, viewport.scrollLeft + (ptClientX - st.smoothMidClientX));
              viewport.scrollTop = Math.max(0, viewport.scrollTop + (ptClientY - st.smoothMidClientY));
              this.savedPdfScrollLeft = viewport.scrollLeft;
              this.savedPdfScrollTop = viewport.scrollTop;
            }
            return;
          }
        }

        const jitterDist = Math.abs(rawDist - st.smoothDist);
        const alphaDist = (jitterDist < 1.0) ? 0.32 : 0.68;
        st.smoothDist = st.smoothDist + (rawDist - st.smoothDist) * alphaDist;

        const nextZoom = (typeof this._computeStandardPinchZoom === 'function')
          ? this._computeStandardPinchZoom(st.smoothDist, st.startDist, st.startZoom, 0.6, 3.2, 1.0)
          : Math.max(0.6, Math.min(3.2, st.startZoom * Math.pow((st.smoothDist + 65) / (st.startDist + 65), 0.95)));
        const actualRatio = nextZoom / st.startZoom;
        const midX = st.smoothMidClientX - vRect.left;
        const midY = st.smoothMidClientY - vRect.top;

        this.setPdfZoom(nextZoom, {
          fastPreview: true,
          anchorPageEl: st.anchorPageEl,
          anchorRelX: st.anchorRelX,
          anchorRelY: st.anchorRelY,
          currentMidClientX: st.smoothMidClientX,
          currentMidClientY: st.smoothMidClientY,
          anchorContentX: st.contentX,
          anchorContentY: st.contentY,
          anchorRatio: actualRatio,
          currentMidX: midX,
          currentMidY: midY
        });
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

      const endPdfViewerPinch = () => {
        if (this._pdfPinchMoveRaf) {
          cancelAnimationFrame(this._pdfPinchMoveRaf);
          this._pdfPinchMoveRaf = null;
        }
        if (this._pdfPinchState) {
          if (this._pdfPinchState._hasPendingMove) {
            applyPdfViewerPinchStep();
          }
          const hadZoomChange = Boolean(this._pdfPinchState.zoomUnlocked);
          this._pdfPinchState = null;
          if (this._pdfPinchRenderTimer) {
            clearTimeout(this._pdfPinchRenderTimer);
            this._pdfPinchRenderTimer = null;
          }
          if (hadZoomChange) {
            this.renderAllPdfPages(false);
          }
        }
      };

      const hasNativeTouchEvents = ('ontouchstart' in window);

      // iOS / iPadOS Safari & Android TouchEvents 직결 지원:
      // touchstart는 passive: true로 등록하여 1손가락 터치 시 JS 대기(0ms) 없이 WebKit 120Hz UIScrollView 관성 스크롤이 즉시 출발하고,
      // 2손가락 이상 핀치 시에는 identifier 쌍을 잠그어 3번째 손가락/손날 스침에 의한 화면 튐을 0%로 방어합니다!
      viewport.addEventListener('touchstart', (e) => {
        this._stopPdfViewportInertia();
        if (e.touches && e.touches.length >= 2) {
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
        }
      }, { passive: true });

      viewport.addEventListener('touchmove', (e) => {
        if (!e.touches || e.touches.length < 2) return;
        if (e.cancelable) e.preventDefault();
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
      }, { passive: false });

      const onPdfTouchEnd = (e) => {
        if (!this.isPdfModalOpen) return;
        if (!e.touches || e.touches.length < 2) {
          if (!e.touches || e.touches.length === 0) {
            this._pdfTouchPointers.clear();
          }
          endPdfViewerPinch();
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
        // 손가락 터치는 브라우저 순정 하드웨어 관성 스크롤, 애플펜슬(pen)·마우스 드래그는 감속 관성 + 터치 즉시 정지(Touch-to-Stop) 지원!
        if (!this.isPdfCropModeActive) {
          if (e.pointerType === 'touch') return;
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
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
          const canvas = this.cropTargetWrapper.querySelector('canvas');
          if (canvas && rect.width > 0 && rect.height > 0) {
            const isAlreadyRendered = (canvas.width > 10 && canvas.height > 10);
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const sx = x * scaleX;
            const sy = y * scaleY;
            const sw = Math.max(1, Math.round(w * scaleX));
            const sh = Math.max(1, Math.round(h * scaleY));

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = sw;
            cropCanvas.height = sh;
            const ctx = cropCanvas.getContext('2d', { alpha: false }) || cropCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sw, sh);
            ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

            const dataUrl = this.encodeCanvasSmartWebP(cropCanvas, 0.88, true);
            const pageNum = this.cropTargetPageNum;
            const normCrop = {
              nx: x / rect.width,
              ny: y / rect.height,
              nw: w / rect.width,
              nh: h / rect.height
            };
            const targetCardWidth = Math.round(Math.max(480, Math.min(window.innerWidth * 0.65, w * 1.15)));

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
            this.setProblemCard(dataUrl, pageNum, cropCanvas, targetCardWidth);
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

            // ✂️ [뷰어 반응속도 100% 보존 + 축소 캡처 시 초고해상도(4.8x~6.0x) 벡터 자동 보강]:
            // PDF 뷰어에서는 가벼운 해상도로 쾌적한 스크롤 반응속도를 그대로 유지하고,
            // 캡처 창이 닫힌 직후 원본 PDF 벡터 페이지(baseVp)에서 크롭 영역(normCrop)만 직접 고배율로 추출하여
            // 축소 상태에서 긴 모의고사 문제를 캡처하더라도 칼같이 선명한 고해상도 이미지로 교체합니다!
            this._upgradeCroppedProblemCardToVectorUltraHD(pageNum, normCrop, placedTarget);

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

      // 마우스 휠은 passive: true로 등록하여 크롬/엣지 C++ 컴포지터 스레드가 JS 대기(0ms) 없이 144Hz로 즉시 스크롤하도록 보장!
      viewport.addEventListener('wheel', () => {
        this._stopPdfViewportInertia();
        if (this.isPdfCropping && typeof this._cropLastClientX === 'number') {
          requestAnimationFrame(() => {
            updateCropBoxFromPointer(this._cropLastClientX, this._cropLastClientY);
          });
        }
      }, { passive: true });

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
        ? Math.min(0.92, Math.max(0.82, quality + 0.06))
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

    async _upgradeCroppedProblemCardToVectorUltraHD(pageNum, normCrop, targetRef = null) {
      const prevUpgrade = this._pendingCropVectorUpgradePromise;
      const runUpgrade = async () => {
        if (prevUpgrade) {
          try { await prevUpgrade; } catch (_) { }
        }
        try {
          if (!this.pdfDoc || !normCrop || normCrop.nw <= 0 || normCrop.nh <= 0) return;
          const page = await this.pdfDoc.getPage(pageNum);
          const baseVp = page.getViewport({ scale: 1.0 });
          // 🌟 [뷰어 축소 배율(pdfZoom)과 무관한 4.0x~5.0x 통PDF급 초고해상도 벡터 캡처 보강]:
          // 2단 모의고사의 긴 문제를 한 화면에 담기 위해 PDF 뷰어를 축소(예: 50%~100%)한 상태에서 캡처하더라도,
          // 뷰어 반응속도는 100% 그대로 유지하고 칠판에 삽입되는 이미지만 원본 PDF 벡터 페이지(baseVp)에서
          // 크롭 영역(normCrop)만 직접 추출하여 최소 가로 1,900px 지향(최대 변 3,800px · WebP 0.88) 칼화질로 렌더링합니다!
          const rawCropW = Math.max(1, normCrop.nw * baseVp.width);
          const rawCropH = Math.max(1, normCrop.nh * baseVp.height);
          const desiredMinWidthPx = 1900;
          let ultraScale = Math.max(4.0, Math.min(5.0, desiredMinWidthPx / rawCropW));
          const maxDim = Math.max(rawCropW, rawCropH) * ultraScale;
          if (maxDim > 3800) {
            ultraScale = 3800 / Math.max(rawCropW, rawCropH);
          }
          const maxAreaPx = 14800000;
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
          if (targetW > 4032 || targetH > 4032) return;

          const vecCanvas = document.createElement('canvas');
          vecCanvas.width = targetW;
          vecCanvas.height = targetH;
          const vCtx = vecCanvas.getContext('2d', { alpha: false }) || vecCanvas.getContext('2d');
          vCtx.imageSmoothingEnabled = true;
          vCtx.imageSmoothingQuality = 'high';
          vCtx.fillStyle = '#ffffff';
          vCtx.fillRect(0, 0, targetW, targetH);
          await page.render({ canvasContext: vCtx, viewport: fullVp }).promise;

          const ultraAspect = (vecCanvas.width > 0 && vecCanvas.height > 0) ? (vecCanvas.height / vecCanvas.width) : null;
          const ultraDataUrl = await this.encodeCanvasSmartWebPAsync(vecCanvas, 0.88, true);
          vecCanvas._evicted = true;
          try {
            vecCanvas.width = 1;
            vecCanvas.height = 1;
          } catch (e) { }
          if (!ultraDataUrl) return;

        // 1x1로 비운 vecCanvas 대신 내보내기([Ctrl+C]/PNG/공유) 시 즉시 사용할 디코딩 완료 Image 객체 준비
        let decodedUltraImg = null;
        if (typeof Image !== 'undefined') {
          try {
            const preImg = new Image();
            preImg.decoding = 'async';
            preImg.src = ultraDataUrl;
            if (typeof preImg.decode === 'function') {
              await preImg.decode().catch(() => { });
            } else if (!preImg.complete) {
              await new Promise((res) => {
                preImg.onload = () => res();
                preImg.onerror = () => res();
                setTimeout(res, 120);
              });
            }
            decodedUltraImg = preImg;
          } catch (e) { }
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

        // 🌟 [핵심 핀셋 수정: 1페이지 캡처 직후 곧바로 필기하거나 다음 캔버스로 넘어가도 슬라이드 데이터에 초고해상도 벡터 이미지 100% 직결 반영!]
        if (targetRef && targetRef.slideRef) {
          const sRef = targetRef.slideRef;
          if (targetRef.type === 'primary' && sRef.primaryProblemCard) {
            sRef.primaryProblemCard.imgSrc = ultraDataUrl;
            if (ultraAspect) sRef.primaryProblemCard.problemCardAspect = ultraAspect;
          } else if (targetRef.type === 'extra' && Array.isArray(sRef.extraProblems)) {
            const eIdx = (typeof targetRef.extraIndex === 'number') ? targetRef.extraIndex : (sRef.extraProblems.length - 1);
            if (sRef.extraProblems[eIdx]) {
              sRef.extraProblems[eIdx].dataUrl = ultraDataUrl;
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

        // 🌟 [PDF 크롭 직후 문제 카드 필기 중 캔버스 리셋/리플로우 원천 차단]:
        // 선생님이 영역 캡처 직후 곧바로 문제 카드나 칠판 위에 필기를 시작했다면,
        // 획을 긋는 도중에는 DOM src 교체 및 syncProblemCardRectFromWidget() 호출을 유예하고 펜을 뗀 직후 무충격 적용합니다!
        const applyUltraDomSwapWhenIdle = () => {
          if (isBusyWritingNow()) {
            setTimeout(applyUltraDomSwapWhenIdle, 120);
            return;
          }
          if (targetRef && targetRef.stampedStroke && targetRef.stampedStroke.graphStamp) {
            targetRef.stampedStroke.graphStamp.dataUrl = ultraDataUrl;
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
        const dpr = this.getCanvasDpr();
        const targetW = Math.round(effW * dpr);
        const targetH = Math.round(h * dpr);
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

      const applyCardTransform = (el, baseX, baseY, savedAnchorOwner) => {
        if (!el || el.style.display === 'none') return;
        const isCardDragging = Boolean(
          el.classList &&
          el.classList.contains('is-dragging-card') &&
          typeof el._dragDomLeft === 'number' &&
          typeof el._dragDomTop === 'number'
        );
        const domLeft = isCardDragging ? el._dragDomLeft : baseX;
        const domTop = isCardDragging ? el._dragDomTop : baseY;
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
          el.style.transformOrigin = '0 0';
          if (isCardDragging) {
            el.style.transform = Math.abs(scaleRatio - 1.0) > 0.002
              ? `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0) scale(${scaleRatio.toFixed(4)})`
              : `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
          } else if (Math.abs(scaleRatio - 1.0) > 0.002) {
            el.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) scale(${scaleRatio.toFixed(4)})`;
          } else if (Math.round(tx) !== 0 || Math.round(ty) !== 0) {
            el.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
          } else {
            el.style.transform = '';
          }
        } else if (this.isGraphCovered) {
          const s = this.boardToScreen(baseX, baseY);
          const tx = s.x - domLeft;
          const ty = s.y - domTop;
          screenLeft = s.x;
          screenTop = s.y;
          effScale = bz;
          el.style.transformOrigin = '0 0';
          if (isCardDragging) {
            el.style.transform = Math.abs(bz - 1.0) > 0.002
              ? `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0) scale(${bz.toFixed(4)})`
              : `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
          } else if (Math.abs(bz - 1.0) > 0.002) {
            el.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px) scale(${bz.toFixed(4)})`;
          } else if (Math.round(tx) !== 0 || Math.round(ty) !== 0) {
            el.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
          } else {
            el.style.transform = '';
          }
        } else if (isCardDragging) {
          const tx = baseX - domLeft;
          const ty = baseY - domTop;
          el.style.transformOrigin = '0 0';
          el.style.transform = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
        } else {
          el.style.transformOrigin = '';
          el.style.transform = '';
        }

        if (el.classList && !el.classList.contains('minimized')) {
          const cssCardW = (isCardDragging && el._cachedDragW > 0)
            ? el._cachedDragW
            : (parseFloat(el.style.width) || el.offsetWidth || 480);
          const screenRight = screenLeft + cssCardW * effScale;
          const viewW = this.screenWidth || (typeof window !== 'undefined' ? window.innerWidth : 1440);
          const dockSpanPx = 42 * effScale;
          const flipLeft = (screenRight + dockSpanPx > viewW - 6) && (screenLeft >= dockSpanPx);
          if (el._probSideDockLeft !== flipLeft) {
            el._probSideDockLeft = flipLeft;
            el.classList.toggle('prob-side-dock-left', flipLeft);
          }
          if (!el.classList.contains('graph-card-widget')) {
            let dockTopPx = 0;
            if (screenTop < 0) {
              const bodyEl = el.querySelector('.problem-card-body');
              const rawBodyH = (bodyEl && (parseFloat(bodyEl.style.height) || bodyEl.offsetHeight)) || el.offsetHeight || 200;
              dockTopPx = Math.max(0, Math.min(Math.max(0, Math.round(rawBodyH - 64)), Math.round((4 - screenTop) / Math.max(0.2, effScale))));
            }
            if (el._probDockTopPx !== dockTopPx) {
              el._probDockTopPx = dockTopPx;
              const hdrEl = el.querySelector('.problem-card-header');
              if (hdrEl) {
                hdrEl.style.top = dockTopPx > 0 ? `${dockTopPx}px` : '';
              }
            }
          }
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
      if (!widget || (singleEl && singleEl !== widget)) return;
      if (!this.problemCardData || widget.style.display === 'none') {
        this.problemCardRect = null;
        if (!this.problemCardData) {
          widget.style.transform = '';
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
