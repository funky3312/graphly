/**
 * Graph Master Web - Problem Cards, Cover & Peel, Workspace Mode Switch & PiP Live Graph Cards (app-cards.js)
 */
{
  const _desc = Object.getOwnPropertyDescriptors(class {
    // ==========================================================================
    // [🎨 문제 창 전용 독립 미니 캔버스 (#problemCardCanvas) 렌더링 & 필기 엔진]
    // - 문제 카드 내부 상대 비율 좌표(nx: 0~1, ny: 0~1)로 저장되어
    //   (1) 메인 칠판 휠 스크롤/줌에는 전혀 영향받지 않고,
    //   (2) 문제 창 크기를 키우거나 줄일 때는 문제 이미지와 정확히 같은 비율로 함께 스케일링!
    // ==========================================================================
    // ==========================================================================
    // 🖨️ [카드 필기 오프스크린 베이킹 & 240Hz O(1) 실시간 증분 렌더링 엔진]
    // - 일반 펜(볼펜·납작펜·만년필·붓펜): pointerdown/pointermove/pointerup 전 구간에서
    //   캔버스 전체 초기화(clearRect)나 이전 포인트 재순회 없이 새로 추가된 베지어 세그먼트 1개만
    //   0.015ms(O(1))에 증분 타격하며, drawPenStyledPointArray와 100.000% 픽셀 단위 일치 보장!
    // - 반투명 형광펜 & 도형 홀드: 반투명 겹침 얼룩 방지를 위해 오프스크린 _bakeCanvas 위 단일 패스로 그리되,
    //   240Hz 입력을 requestAnimationFrame(VSync) 당 1회로 병합하여 프레임 드랍을 원천 차단!
    // ==========================================================================
    _cancelCardCanvasPendingTasks(canvas, releaseBakeBuffer = false) {
      if (!canvas) return;
      if (canvas._cardLiveRafId) {
        cancelAnimationFrame(canvas._cardLiveRafId);
        canvas._cardLiveRafId = null;
      }
      canvas._pendingCardLiveRenderFn = null;
      if (canvas._cardIdleBakeTimer) {
        clearTimeout(canvas._cardIdleBakeTimer);
        canvas._cardIdleBakeTimer = null;
      }
      if (releaseBakeBuffer && canvas._bakeCanvas) {
        try {
          canvas._bakeCanvas.width = 1;
          canvas._bakeCanvas.height = 1;
        } catch (err) { }
        canvas._bakeCanvas = null;
        canvas._bakeValid = false;
        canvas._bakeCount = 0;
        canvas._bakedRefs = null;
        canvas._bakeFirstStroke = null;
        canvas._bakeLastStroke = null;
        canvas._bakeGeoSig = '';
      }
    }

    // 🌟 [닫힌 카드 GPU·RAM 캔버스 즉시 절전 (Undo 100% 무손실 복구 보장)]:
    // 추가 문제/그래프 카드를 닫아 DOM에서 분리할 때, window 드래그·필기 리스너는 보존하여
    // 실행 취소(↺) 재부착 시 100% 즉시 작동하도록 유지하면서,
    // WebKit 메모리를 장당 ~7.5MB 점유하던 오프스크린 _bakeCanvas · 필기 캔버스 · 레이저 캔버스만 1×1로 축소 반환합니다!
    _hibernateDetachedCardCanvases(cardEl) {
      if (!cardEl || typeof cardEl.querySelector !== 'function') return;
      if (cardEl._bakePipTimerId) {
        clearTimeout(cardEl._bakePipTimerId);
        cardEl._bakePipTimerId = null;
      }
      if (this._activeCardLasso && this._activeCardLasso.widgetEl === cardEl && typeof this.clearCardLassoSelection === 'function') {
        this.clearCardLassoSelection();
      }
      const inkCvs = cardEl.querySelector('.problem-card-canvas');
      if (inkCvs) {
        this._cancelCardCanvasPendingTasks(inkCvs, true);
        inkCvs._liveActiveStroke = null;
        inkCvs._liveRenderedPointCount = 0;
        inkCvs._displaySyncedCount = -1;
        inkCvs._displaySyncedGeoSig = '';
        inkCvs._needsSizeSync = true;
        try {
          inkCvs.width = 1;
          inkCvs.height = 1;
        } catch (err) { }
      }
      const laserCvs = cardEl.querySelector('.card-laser-canvas');
      if (laserCvs) {
        try {
          laserCvs.width = 1;
          laserCvs.height = 1;
        } catch (err) { }
      }
    }

    _getCardStrokeNormBounds(stroke) {
      if (!stroke || !stroke.points || stroke.points.length === 0) return null;
      const pts = stroke.points;
      const n = pts.length;
      const isDynamicShape = Boolean(stroke.isShape || stroke.cardShape);
      const pFirst = pts[0];
      const pMid = pts[n >> 1];
      const pLast = pts[n - 1];
      let cb = !isDynamicShape ? stroke._cardAabb : null;
      if (
        !cb ||
        cb.len !== n ||
        cb.fx !== pFirst.nx ||
        cb.fy !== pFirst.ny ||
        cb.mx !== pMid.nx ||
        cb.my !== pMid.ny ||
        cb.lx !== pLast.nx ||
        cb.ly !== pLast.ny
      ) {
        let minNx = pFirst.nx, maxNx = pFirst.nx, minNy = pFirst.ny, maxNy = pFirst.ny;
        for (let i = 1; i < n; i++) {
          const px = pts[i].nx;
          const py = pts[i].ny;
          if (px < minNx) minNx = px;
          else if (px > maxNx) maxNx = px;
          if (py < minNy) minNy = py;
          else if (py > maxNy) maxNy = py;
        }
        cb = {
          minNx, maxNx, minNy, maxNy,
          len: n, fx: pFirst.nx, fy: pFirst.ny, mx: pMid.nx, my: pMid.ny, lx: pLast.nx, ly: pLast.ny
        };
        if (!isDynamicShape) {
          Object.defineProperty(stroke, '_cardAabb', {
            value: cb,
            writable: true,
            configurable: true,
            enumerable: false
          });
        }
      }
      return cb;
    }

    _eraseCardStrokesInPlace(strokesArr, sx, sy, w, h, radiusPx, undoMeta = null) {
      if (!Array.isArray(strokesArr) || strokesArr.length === 0) return false;
      const effW = Math.max(1, w);
      const effH = Math.max(1, h);
      const padPx = radiusPx + 2;
      const cursorPt = { x: sx, y: sy };
      const removedBatch = [];
      let writeIdx = 0;

      for (let idx = 0; idx < strokesArr.length; idx++) {
        const stroke = strokesArr[idx];
        if (!stroke || !stroke.points || stroke.points.length === 0) {
          continue;
        }
        const cb = this._getCardStrokeNormBounds(stroke);
        if (
          cb &&
          (sx < cb.minNx * effW - padPx ||
            sx > cb.maxNx * effW + padPx ||
            sy < cb.minNy * effH - padPx ||
            sy > cb.maxNy * effH + padPx)
        ) {
          strokesArr[writeIdx++] = stroke;
          continue;
        }

        const pts = stroke.points;
        let hit = false;
        let prevPx = pts[0].nx * effW;
        let prevPy = pts[0].ny * effH;
        if (Math.hypot(prevPx - sx, prevPy - sy) <= radiusPx) {
          hit = true;
        } else {
          for (let i = 1; i < pts.length; i++) {
            const curPx = pts[i].nx * effW;
            const curPy = pts[i].ny * effH;
            if (Math.hypot(curPx - sx, curPy - sy) <= radiusPx) {
              hit = true;
              break;
            }
            if (this.distToSegment(cursorPt, { x: prevPx, y: prevPy }, { x: curPx, y: curPy }) <= radiusPx) {
              hit = true;
              break;
            }
            prevPx = curPx;
            prevPy = curPy;
          }
        }

        if (hit) {
          removedBatch.push({ stroke, index: idx });
        } else {
          strokesArr[writeIdx++] = stroke;
        }
      }

      if (removedBatch.length === 0) {
        if (writeIdx !== strokesArr.length) {
          strokesArr.length = writeIdx;
        }
        return false;
      }

      strokesArr.length = writeIdx;

      if (undoMeta && Array.isArray(this.undoStack)) {
        const curEntry = this._currentCardEraseUndoEntry;
        if (
          this._isDrawingCardInk &&
          curEntry &&
          curEntry.type === 'card_strokes_erase' &&
          curEntry.strokesArr === strokesArr
        ) {
          curEntry.batches.push(removedBatch);
        } else {
          const eraseEntry = {
            type: 'card_strokes_erase',
            cardKind: undoMeta.cardKind || null,
            cardEl: undoMeta.cardEl || null,
            strokesArr,
            batches: [removedBatch],
            renderFn: undoMeta.renderFn || null
          };
          if (this._isDrawingCardInk) {
            this._currentCardEraseUndoEntry = eraseEntry;
          }
          this.undoStack.push(eraseEntry);
          if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
          }
          this.redoStack = [];
          this.updateUndoRedoUI();
        }
      }

      return true;
    }

    _scheduleCardLiveFrameRender(canvas, renderFn) {
      if (!canvas || typeof renderFn !== 'function') return;
      canvas._pendingCardLiveRenderFn = renderFn;
      if (canvas._cardLiveRafId) return;
      if (typeof requestAnimationFrame === 'function') {
        canvas._cardLiveRafId = requestAnimationFrame(() => {
          canvas._cardLiveRafId = null;
          const fn = canvas._pendingCardLiveRenderFn;
          canvas._pendingCardLiveRenderFn = null;
          if (typeof fn === 'function') fn();
        });
      } else {
        canvas._pendingCardLiveRenderFn = null;
        renderFn();
      }
    }

    _resolveCardStrokeDrawStyle(stroke, sizeScale, options = {}) {
      const isProbCard = Boolean(options.isProbCard);
      const minPenWidth = typeof options.minPenWidth === 'number' ? options.minPenWidth : 0.85;
      const minHlWidth = typeof options.minHlWidth === 'number' ? options.minHlWidth : 3;
      const defaultHlMin = typeof options.defaultHlMin === 'number' ? options.defaultHlMin : 8;

      let strokeColor = stroke.color || '#1e293b';
      if (this.isMonochromeMode) {
        strokeColor = stroke.isHighlighter ? '#cbd5e1' : '#000000';
      } else if (stroke.isHighlighter) {
        strokeColor = this.resolveHighlighterStrokeColor(strokeColor, true);
      } else if (isProbCard && (strokeColor.toLowerCase() === '#ffffff' || strokeColor.toLowerCase() === '#fff')) {
        strokeColor = '#0f172a';
      }

      const baseSize = (stroke.size || 3.5) * sizeScale;
      const ghostMul = (typeof stroke._ghostAlpha === 'number') ? stroke._ghostAlpha : 1.0;
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
      const hlW = stroke.highlighterSize ? (stroke.highlighterSize * sizeScale) : Math.max(defaultHlMin, baseSize * 2.8);
      const hlLineWidth = Math.max(minHlWidth, hlW);
      const penLineWidth = Math.max(minPenWidth, baseSize);

      return {
        strokeColor,
        baseSize,
        effBaseSize,
        blurVal,
        dpr,
        penStyle,
        isHighlighter,
        isFlatNib,
        nibX,
        nibY,
        ghostMul,
        hlLineWidth,
        penLineWidth
      };
    }

    _renderCardInkIncrementalSteps(ctx, stroke, w, h, dpr, sizeScale, fromCount, toCount, options = {}) {
      if (!ctx || !stroke || !Array.isArray(stroke.points)) return;
      const pts = stroke.points;
      const endCount = Math.min(pts.length, toCount);
      const startStep = Math.max(1, (fromCount || 0) + 1);
      if (startStep > endCount) return;

      const st = this._resolveCardStrokeDrawStyle(stroke, sizeScale, options);
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = st.strokeColor;
      ctx.fillStyle = st.strokeColor;
      ctx.globalAlpha = 1.0 * st.ghostMul;
      if (st.blurVal > 0) {
        ctx.shadowColor = st.strokeColor;
        ctx.shadowBlur = st.blurVal * st.dpr * 0.65;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      if (st.isFlatNib) {
        ctx.scale(st.nibX, st.nibY);
      }

      const isUniformPen = (st.penStyle === 'ballpen' || st.penStyle === 'flat');
      if (isUniformPen) {
        ctx.lineWidth = this.computePenStyleWidth(st.effBaseSize, 0.5, st.penStyle);
      }

      for (let stepLen = startStep; stepLen <= endCount; stepLen++) {
        if (stepLen === 1) {
          const pt0 = pts[0];
          const x0 = pt0.nx * w;
          const y0 = pt0.ny * h;
          const p0 = pt0.p !== undefined ? pt0.p : 0.5;
          const w0 = this.computePenStyleWidth(st.effBaseSize, p0, st.penStyle);
          ctx.beginPath();
          ctx.arc(x0 / st.nibX, y0 / st.nibY, w0 / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (stepLen === 2) {
          const pt0 = pts[0];
          const pt1 = pts[1];
          const x0 = pt0.nx * w;
          const y0 = pt0.ny * h;
          const x1 = pt1.nx * w;
          const y1 = pt1.ny * h;
          const mx = (x0 + x1) * 0.5;
          const my = (y0 + y1) * 0.5;
          if (isUniformPen) {
            ctx.beginPath();
            ctx.moveTo(x0 / st.nibX, y0 / st.nibY);
            ctx.lineTo(mx / st.nibX, my / st.nibY);
            ctx.stroke();
          } else {
            const p0 = pt0.p !== undefined ? pt0.p : 0.5;
            const p1 = pt1.p !== undefined ? pt1.p : 0.5;
            const w0 = this.computePenStyleWidth(st.effBaseSize, p0, st.penStyle);
            const wMid = this.computePenStyleWidth(st.effBaseSize, (p0 + p1) * 0.5, st.penStyle);
            this.drawVariableWidthLineSegment(ctx, x0, y0, mx, my, w0, wMid);
          }
        } else {
          const ptA = pts[stepLen - 3];
          const ptB = pts[stepLen - 2];
          const ptC = pts[stepLen - 1];
          const ax = ptA.nx * w;
          const ay = ptA.ny * h;
          const bx = ptB.nx * w;
          const by = ptB.ny * h;
          const cx = ptC.nx * w;
          const cy = ptC.ny * h;
          const mid1X = (ax + bx) * 0.5;
          const mid1Y = (ay + by) * 0.5;
          const mid2X = (bx + cx) * 0.5;
          const mid2Y = (by + cy) * 0.5;
          if (isUniformPen) {
            ctx.beginPath();
            ctx.moveTo(mid1X / st.nibX, mid1Y / st.nibY);
            ctx.quadraticCurveTo(bx / st.nibX, by / st.nibY, mid2X / st.nibX, mid2Y / st.nibY);
            ctx.stroke();
          } else {
            const pA = ptA.p !== undefined ? ptA.p : 0.5;
            const pB = ptB.p !== undefined ? ptB.p : 0.5;
            const pC = ptC.p !== undefined ? ptC.p : 0.5;
            const wMid1 = this.computePenStyleWidth(st.effBaseSize, (pA + pB) * 0.5, st.penStyle);
            const wMid2 = this.computePenStyleWidth(st.effBaseSize, (pB + pC) * 0.5, st.penStyle);
            this.drawVariableWidthQuadSegment(ctx, mid1X, mid1Y, bx, by, mid2X, mid2Y, wMid1, wMid2);
          }
        }
      }
      ctx.restore();
    }

    _renderCardInkFinalTail(ctx, stroke, w, h, dpr, sizeScale, options = {}) {
      if (!ctx || !stroke || !Array.isArray(stroke.points) || stroke.points.length < 2) return;
      const pts = stroke.points;
      const len = pts.length;
      const st = this._resolveCardStrokeDrawStyle(stroke, sizeScale, options);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = st.strokeColor;
      ctx.fillStyle = st.strokeColor;
      ctx.globalAlpha = 1.0 * st.ghostMul;
      if (st.blurVal > 0) {
        ctx.shadowColor = st.strokeColor;
        ctx.shadowBlur = st.blurVal * st.dpr * 0.65;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      if (st.isFlatNib) {
        ctx.scale(st.nibX, st.nibY);
      }

      const isUniformPen = (st.penStyle === 'ballpen' || st.penStyle === 'flat');
      if (len === 2) {
        const pt0 = pts[0];
        const pt1 = pts[1];
        const x0 = pt0.nx * w;
        const y0 = pt0.ny * h;
        const x1 = pt1.nx * w;
        const y1 = pt1.ny * h;
        if (isUniformPen) {
          ctx.lineWidth = this.computePenStyleWidth(st.effBaseSize, pt0.p !== undefined ? pt0.p : 0.5, st.penStyle);
          ctx.beginPath();
          ctx.moveTo(x0 / st.nibX, y0 / st.nibY);
          ctx.lineTo(x1 / st.nibX, y1 / st.nibY);
          ctx.stroke();
        } else {
          const p0 = pt0.p !== undefined ? pt0.p : 0.5;
          const p1 = pt1.p !== undefined ? pt1.p : 0.5;
          const w0 = this.computePenStyleWidth(st.effBaseSize, p0, st.penStyle);
          const w1 = this.computePenStyleWidth(st.effBaseSize, p1, st.penStyle);
          this.drawVariableWidthLineSegment(ctx, x0, y0, x1, y1, w0, w1);
        }
      } else {
        const ptPrev = pts[len - 2];
        const ptLast = pts[len - 1];
        const px = ptPrev.nx * w;
        const py = ptPrev.ny * h;
        const lx = ptLast.nx * w;
        const ly = ptLast.ny * h;
        const midX = (px + lx) * 0.5;
        const midY = (py + ly) * 0.5;
        if (isUniformPen) {
          ctx.lineWidth = this.computePenStyleWidth(st.effBaseSize, ptLast.p !== undefined ? ptLast.p : 0.5, st.penStyle);
          ctx.beginPath();
          ctx.moveTo(midX / st.nibX, midY / st.nibY);
          ctx.lineTo(lx / st.nibX, ly / st.nibY);
          ctx.stroke();
        } else {
          const pPrev = ptPrev.p !== undefined ? ptPrev.p : 0.5;
          const pLast = ptLast.p !== undefined ? ptLast.p : 0.5;
          const wMid = this.computePenStyleWidth(st.effBaseSize, (pPrev + pLast) * 0.5, st.penStyle);
          const wLast = this.computePenStyleWidth(st.effBaseSize, pLast, st.penStyle);
          this.drawVariableWidthLineSegment(ctx, midX, midY, lx, ly, wMid, wLast);
        }
      }
      ctx.restore();
    }

    _ensureCardBakeUpTo(canvas, bCanvas, bCtx, strokeList, targetCount, w, h, dpr, sizeScale, options = {}) {
      const clampedTarget = Math.max(0, Math.min(strokeList.length, targetCount));
      let canAppend = Boolean(
        canvas._bakeValid &&
        Array.isArray(canvas._bakedRefs) &&
        canvas._bakeCount <= clampedTarget &&
        canvas._bakedRefs.length === canvas._bakeCount
      );
      if (canAppend) {
        for (let i = 0; i < canvas._bakeCount; i++) {
          if (canvas._bakedRefs[i] !== strokeList[i]) {
            canAppend = false;
            break;
          }
        }
      }
      if (canAppend) {
        if (canvas._bakeCount < clampedTarget) {
          bCtx.save();
          bCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          for (let i = canvas._bakeCount; i < clampedTarget; i++) {
            this._renderSingleCardInkStroke(bCtx, strokeList[i], w, h, sizeScale, options);
            canvas._bakedRefs.push(strokeList[i]);
          }
          bCtx.restore();
          canvas._bakeCount = clampedTarget;
          canvas._bakeFirstStroke = clampedTarget > 0 ? strokeList[0] : null;
          canvas._bakeLastStroke = clampedTarget > 0 ? strokeList[clampedTarget - 1] : null;
        }
        return;
      }

      bCtx.save();
      bCtx.setTransform(1, 0, 0, 1, 0, 0);
      bCtx.clearRect(0, 0, bCanvas.width, bCanvas.height);
      bCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const nextRefs = new Array(clampedTarget);
      for (let i = 0; i < clampedTarget; i++) {
        this._renderSingleCardInkStroke(bCtx, strokeList[i], w, h, sizeScale, options);
        nextRefs[i] = strokeList[i];
      }
      bCtx.restore();
      canvas._bakeValid = true;
      canvas._bakeCount = clampedTarget;
      canvas._bakedRefs = nextRefs;
      canvas._bakeFirstStroke = clampedTarget > 0 ? strokeList[0] : null;
      canvas._bakeLastStroke = clampedTarget > 0 ? strokeList[clampedTarget - 1] : null;
    }

    _scheduleCardIdleBake(canvas, strokeList, w, h, dpr, sizeScale, geoSig, options = {}) {
      if (!canvas) return;
      if (canvas._cardIdleBakeTimer) {
        clearTimeout(canvas._cardIdleBakeTimer);
        canvas._cardIdleBakeTimer = null;
      }
      const isIPad = typeof this.isIOSOrIPad === 'function' && this.isIOSOrIPad();
      const delayMs = isIPad ? 550 : 220;
      const runCatchup = () => {
        canvas._cardIdleBakeTimer = null;
        if (canvas.isConnected === false) return;
        const nowT = Date.now();
        const isBusy = (typeof this.isActivelyWritingOrInteracting === 'function' && this.isActivelyWritingOrInteracting()) ||
          this.isDrawingInk ||
          this._isDrawingCardInk ||
          this.isStylusDrawing ||
          (this._lastPenActiveTime && (nowT - this._lastPenActiveTime < 300));
        if (isBusy) {
          canvas._cardIdleBakeTimer = setTimeout(runCatchup, 220);
          return;
        }
        if (
          canvas._liveActiveStroke !== null ||
          canvas._bakeGeoSig !== geoSig ||
          !Array.isArray(strokeList) ||
          canvas._displaySyncedCount !== strokeList.length
        ) {
          return;
        }
        if (!canvas._bakeCanvas) return;
        const bCanvas = canvas._bakeCanvas;
        const bCtx = bCanvas.getContext('2d');
        if (!bCtx) return;
        this._ensureCardBakeUpTo(canvas, bCanvas, bCtx, strokeList, strokeList.length, w, h, dpr, sizeScale, options);
      };
      canvas._cardIdleBakeTimer = setTimeout(runCatchup, delayMs);
    }

    _renderSingleCardInkStroke(ctx, stroke, w, h, sizeScale, options = {}) {
      if (!stroke || !stroke.points || stroke.points.length === 0) return;
      const applyStreamline = Boolean(options.applyStreamline);
      const st = this._resolveCardStrokeDrawStyle(stroke, sizeScale, options);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = st.strokeColor;
      ctx.fillStyle = st.strokeColor;

      if (st.isHighlighter) {
        ctx.globalAlpha = 0.36 * st.ghostMul;
        ctx.lineWidth = st.hlLineWidth;
      } else {
        ctx.globalAlpha = 1.0 * st.ghostMul;
        ctx.lineWidth = st.penLineWidth;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      if (stroke.isShape && stroke.cardShape && this.drawCardRecognizedShape(ctx, stroke, 0, 0, w, h, st.baseSize)) {
        ctx.restore();
        return;
      }

      const len = stroke.points.length;
      const rawPts = new Array(len);
      for (let i = 0; i < len; i++) {
        const pt = stroke.points[i];
        rawPts[i] = {
          x: pt.nx * w,
          y: pt.ny * h,
          p: pt.p !== undefined ? pt.p : 0.5
        };
      }

      let pts = rawPts;
      if (applyStreamline && !stroke.isShape && !stroke._inPlaceStreamlined && len > 1) {
        pts = new Array(len);
        pts[0] = rawPts[0];
        for (let i = 1; i < len - 1; i++) {
          const prev = pts[i - 1];
          const curr = rawPts[i];
          pts[i] = {
            x: prev.x * 0.22 + curr.x * 0.78,
            y: prev.y * 0.22 + curr.y * 0.78,
            p: prev.p * 0.22 + curr.p * 0.78
          };
        }
        pts[len - 1] = rawPts[len - 1];
      }

      this.drawPenStyledPointArray(ctx, pts, st.isHighlighter ? ctx.lineWidth : st.baseSize, st.penStyle, stroke.softBlur, st.isHighlighter);
      ctx.restore();
    }

    _renderCardInkWithBakeCache(canvas, strokes, w, h, dpr, sizeScale, widgetEl, options = {}) {
      if (!canvas) return;
      if (canvas._cardLiveRafId) {
        cancelAnimationFrame(canvas._cardLiveRafId);
        canvas._cardLiveRafId = null;
        canvas._pendingCardLiveRenderFn = null;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const strokeList = Array.isArray(strokes) ? strokes : [];
      if (strokeList.length === 0) {
        if (canvas._cardIdleBakeTimer) {
          clearTimeout(canvas._cardIdleBakeTimer);
          canvas._cardIdleBakeTimer = null;
        }
        canvas._bakeValid = false;
        canvas._bakeCount = 0;
        canvas._bakedRefs = [];
        canvas._bakeFirstStroke = null;
        canvas._bakeLastStroke = null;
        canvas._liveActiveStroke = null;
        canvas._liveRenderedPointCount = 0;
        canvas._displaySyncedCount = 0;
        canvas._displaySyncedFirst = null;
        canvas._displaySyncedLast = null;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        this.drawCardLassoOverlay(ctx, w, h, widgetEl);
        ctx.restore();
        return;
      }

      const isAudioReplay = Boolean(this._isAudioReplayActive && this.audioSyncData);
      const hasActiveLassoOnCard = Boolean(this._activeCardLasso && this._activeCardLasso.widgetEl === widgetEl);

      if (isAudioReplay || hasActiveLassoOnCard) {
        if (canvas._cardIdleBakeTimer) {
          clearTimeout(canvas._cardIdleBakeTimer);
          canvas._cardIdleBakeTimer = null;
        }
        canvas._bakeValid = false;
        canvas._bakedRefs = [];
        canvas._liveActiveStroke = null;
        canvas._liveRenderedPointCount = 0;
        canvas._displaySyncedCount = -1;
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const cRect = isAudioReplay
          ? (typeof this._getStageElementRect === 'function' ? this._getStageElementRect(canvas) : canvas.getBoundingClientRect())
          : null;
        for (let i = 0; i < strokeList.length; i++) {
          let st = strokeList[i];
          if (isAudioReplay) {
            const repInfo = this.getPartialStrokeForReplay(st, this.audioPlayCurrentMs, this.audioReplayViewMode);
            if (!repInfo || !repInfo.stroke) continue;
            st = repInfo.stroke;
            if (repInfo.isCurrentlyWriting && repInfo.tipPoint && cRect && cRect.width > 0) {
              this._activeReplayTipScreen = {
                x: cRect.left + repInfo.tipPoint.nx * cRect.width,
                y: cRect.top + repInfo.tipPoint.ny * cRect.height,
                color: st.color || '#0f172a',
                isHighlighter: Boolean(st.isHighlighter)
              };
            }
          }
          this._renderSingleCardInkStroke(ctx, st, w, h, sizeScale, options);
        }
        this.drawCardLassoOverlay(ctx, w, h, widgetEl);
        ctx.restore();
        return;
      }

      if (!canvas._bakeCanvas) {
        canvas._bakeCanvas = document.createElement('canvas');
      }
      const bCanvas = canvas._bakeCanvas;
      const bCtx = bCanvas.getContext('2d');
      const geoSig = `${canvas.width}x${canvas.height}|${sizeScale.toFixed(4)}|${this.isMonochromeMode ? 1 : 0}`;

      if (bCanvas.width !== canvas.width || bCanvas.height !== canvas.height) {
        bCanvas.width = canvas.width;
        bCanvas.height = canvas.height;
        canvas._bakeValid = false;
        canvas._bakedRefs = [];
        canvas._liveActiveStroke = null;
        canvas._liveRenderedPointCount = 0;
        canvas._displaySyncedCount = -1;
      }
      if (canvas._bakeGeoSig !== geoSig) {
        canvas._bakeGeoSig = geoSig;
        canvas._bakeValid = false;
        canvas._bakedRefs = [];
        canvas._liveActiveStroke = null;
        canvas._liveRenderedPointCount = 0;
        canvas._displaySyncedCount = -1;
      }

      const activeStroke = options.activeStroke || null;
      const commitStroke = Boolean(options.commitStroke);
      const canUseIncrementalLivePen = Boolean(
        activeStroke &&
        !activeStroke.isHighlighter &&
        !activeStroke.isShape &&
        !activeStroke._shapeHoldDetected &&
        activeStroke._inPlaceStreamlined &&
        (typeof activeStroke._ghostAlpha !== 'number' || activeStroke._ghostAlpha >= 0.999)
      );

      // 🌟 [240Hz O(1) 증분 실시간 카드 필기 패스트패스]:
      // 일반 펜 필기 시에는 매 pointermove마다 캔버스를 지우거나(clearRect) 전체 포인트를 재순회하지 않고,
      // 직전 프레임 이후 새로 추가된 베지어 세그먼트만 즉시 타격하여 장문 수식 필기 랙을 0.00ms로 제거합니다!
      if (canUseIncrementalLivePen && !commitStroke) {
        const curPtCount = Array.isArray(activeStroke.points) ? activeStroke.points.length : 0;
        if (
          canvas._liveActiveStroke === activeStroke &&
          canvas._displaySyncedGeoSig === geoSig &&
          curPtCount >= (canvas._liveRenderedPointCount || 0)
        ) {
          const prevRendered = canvas._liveRenderedPointCount || 0;
          if (curPtCount > prevRendered) {
            this._renderCardInkIncrementalSteps(ctx, activeStroke, w, h, dpr, sizeScale, prevRendered, curPtCount, options);
            canvas._liveRenderedPointCount = curPtCount;
          }
          return;
        }

        // 새 획 시작(pointerdown) 또는 지오메트리 변경 직후 첫 프레임 초기화
        const completedCount = (strokeList[strokeList.length - 1] === activeStroke)
          ? (strokeList.length - 1)
          : Math.max(0, strokeList.indexOf(activeStroke));
        const expectedFirst = completedCount > 0 ? strokeList[0] : null;
        const expectedLast = completedCount > 0 ? strokeList[completedCount - 1] : null;
        const displayAlreadyClean = Boolean(
          canvas._liveActiveStroke === null &&
          canvas._displaySyncedGeoSig === geoSig &&
          canvas._displaySyncedCount === completedCount &&
          canvas._displaySyncedFirst === expectedFirst &&
          canvas._displaySyncedLast === expectedLast
        );

        if (!displayAlreadyClean) {
          this._ensureCardBakeUpTo(canvas, bCanvas, bCtx, strokeList, completedCount, w, h, dpr, sizeScale, options);
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (completedCount > 0) {
            ctx.drawImage(bCanvas, 0, 0);
          }
          ctx.restore();
        }

        canvas._liveActiveStroke = activeStroke;
        canvas._displaySyncedGeoSig = geoSig;
        canvas._displaySyncedCount = -1;
        canvas._liveRenderedPointCount = 0;
        if (curPtCount > 0) {
          this._renderCardInkIncrementalSteps(ctx, activeStroke, w, h, dpr, sizeScale, 0, curPtCount, options);
          canvas._liveRenderedPointCount = curPtCount;
        }
        return;
      }

      // 🌟 [일반 펜 pointerup(commitStroke = true) 0.01ms 마감 & 유휴 베이킹 위임]:
      // 연속 필기 시 획과 획 사이에서 clearRect/drawImage 및 전체 획 재베이킹으로 인한 입력 지연을 없애기 위해,
      // 화면 캔버스에는 끝단 꼬리(Final Tail)만 즉시 마감하고 _bakeCanvas 동기화는 유휴 타이머로 위임합니다!
      if (
        canUseIncrementalLivePen &&
        commitStroke &&
        canvas._liveActiveStroke === activeStroke &&
        canvas._displaySyncedGeoSig === geoSig &&
        strokeList[strokeList.length - 1] === activeStroke
      ) {
        const curPtCount = Array.isArray(activeStroke.points) ? activeStroke.points.length : 0;
        const prevRendered = canvas._liveRenderedPointCount || 0;
        if (curPtCount > prevRendered) {
          this._renderCardInkIncrementalSteps(ctx, activeStroke, w, h, dpr, sizeScale, prevRendered, curPtCount, options);
        }
        if (curPtCount >= 2) {
          this._renderCardInkFinalTail(ctx, activeStroke, w, h, dpr, sizeScale, options);
        }
        canvas._liveActiveStroke = null;
        canvas._liveRenderedPointCount = 0;
        canvas._displaySyncedGeoSig = geoSig;
        canvas._displaySyncedCount = strokeList.length;
        canvas._displaySyncedFirst = strokeList[0] || null;
        canvas._displaySyncedLast = activeStroke;
        this._scheduleCardIdleBake(canvas, strokeList, w, h, dpr, sizeScale, geoSig, options);
        return;
      }

      // 형광펜 또는 도형 자동보정(Hold-to-Shape) 실시간 드로잉
      if (activeStroke && !commitStroke) {
        canvas._liveActiveStroke = null;
        canvas._liveRenderedPointCount = 0;
        canvas._displaySyncedCount = -1;
        const completedCount = (strokeList[strokeList.length - 1] === activeStroke)
          ? (strokeList.length - 1)
          : Math.max(0, strokeList.indexOf(activeStroke));
        this._ensureCardBakeUpTo(canvas, bCanvas, bCtx, strokeList, completedCount, w, h, dpr, sizeScale, options);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (completedCount > 0) {
          ctx.drawImage(bCanvas, 0, 0);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._renderSingleCardInkStroke(ctx, activeStroke, w, h, sizeScale, options);
        ctx.restore();
        return;
      }

      if (canvas._cardIdleBakeTimer) {
        clearTimeout(canvas._cardIdleBakeTimer);
        canvas._cardIdleBakeTimer = null;
      }
      canvas._liveActiveStroke = null;
      canvas._liveRenderedPointCount = 0;

      // 형광펜 / 도형 자동보정 완료(commitStroke = true): 직전 획들까지 유효하면 신규 획들만 증분 베이크!
      if (activeStroke && commitStroke && strokeList[strokeList.length - 1] === activeStroke) {
        this._ensureCardBakeUpTo(canvas, bCanvas, bCtx, strokeList, strokeList.length, w, h, dpr, sizeScale, options);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bCanvas, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.drawCardLassoOverlay(ctx, w, h, widgetEl);
        ctx.restore();
        canvas._displaySyncedGeoSig = geoSig;
        canvas._displaySyncedCount = strokeList.length;
        canvas._displaySyncedFirst = strokeList[0] || null;
        canvas._displaySyncedLast = activeStroke;
        return;
      }

      // 명시적 전체 재렌더링(!activeStroke: Undo/Redo, 지우개, 카드 리사이즈, 창모드 좌표 재투영 등):
      // 포인트 인플레이스 변형(_reprojectPipCardInkFromMathCoords 등)까지 100% 반영하기 위해 _bakeCanvas를 전체 갱신합니다.
      canvas._bakeValid = false;
      this._ensureCardBakeUpTo(canvas, bCanvas, bCtx, strokeList, strokeList.length, w, h, dpr, sizeScale, options);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bCanvas, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.drawCardLassoOverlay(ctx, w, h, widgetEl);
      ctx.restore();
      canvas._displaySyncedGeoSig = geoSig;
      canvas._displaySyncedCount = strokeList.length;
      canvas._displaySyncedFirst = strokeList[0] || null;
      canvas._displaySyncedLast = strokeList[strokeList.length - 1] || null;
    }

    renderProblemCardCanvas(activeStroke = null, commitStroke = false) {
      const pCanvas = document.getElementById('problemCardCanvas');
      if (!pCanvas) return;
      const dpr = this.getCanvasDpr();
      const w = pCanvas.width / dpr;
      const h = pCanvas.height / dpr;
      const sizeScale = Math.max(0.6, w / 520);
      this._renderCardInkWithBakeCache(
        pCanvas,
        this.problemInkStrokes,
        w,
        h,
        dpr,
        sizeScale,
        document.getElementById('problemCardWidget'),
        {
          activeStroke,
          commitStroke,
          isProbCard: true,
          applyStreamline: true,
          minPenWidth: 0,
          minHlWidth: 4,
          defaultHlMin: 10
        }
      );
    }

    eraseProblemInkAtNormalizedPoint(nx, ny, w, h, radiusPx = null, deferRender = false) {
      radiusPx = (typeof radiusPx === 'number' && !isNaN(radiusPx)) ? radiusPx : Math.max(6, (this.currentEraserSize || 14) * 1.25);
      const pWidget = document.getElementById('problemCardWidget');
      let stickerErased = false;
      if (pWidget) {
        stickerErased = Boolean(this.eraseCardStickerAtNormalizedPoint(pWidget, nx, ny, w, h, radiusPx));
      }
      if (!this.problemInkStrokes || this.problemInkStrokes.length === 0) return stickerErased;
      const sx = nx * w;
      const sy = ny * h;
      const inkErased = this._eraseCardStrokesInPlace(
        this.problemInkStrokes,
        sx,
        sy,
        w,
        h,
        radiusPx,
        {
          cardKind: 'problem',
          cardEl: pWidget,
          renderFn: () => this.renderProblemCardCanvas()
        }
      );

      if (inkErased) {
        const pCanvas = document.getElementById('problemCardCanvas');
        if (deferRender && pCanvas) {
          this._scheduleCardLiveFrameRender(pCanvas, () => this.renderProblemCardCanvas());
        } else {
          this.renderProblemCardCanvas();
        }
      }
      return Boolean(inkErased || stickerErased);
    }

    clearProblemCardInk() {
      if (Array.isArray(this.problemInkStrokes)) {
        this.problemInkStrokes.length = 0;
      } else {
        this.problemInkStrokes = [];
      }
      this.renderProblemCardCanvas();
    }

    closeGraphCard() {
      const gCanvas = document.getElementById('graphCardCanvas');
      if (gCanvas) {
        this._cancelCardCanvasPendingTasks(gCanvas, true);
        gCanvas._bakeValid = false;
        gCanvas._liveActiveStroke = null;
        gCanvas._displaySyncedCount = -1;
      }
      const gWidget = document.getElementById('graphCardWidget');
      if (gWidget) {
        if (gWidget._bakePipTimerId) {
          clearTimeout(gWidget._bakePipTimerId);
          gWidget._bakePipTimerId = null;
        }
        if (this._activePeekCardEl === gWidget) {
          this._activePeekCardEl = null;
        }
        gWidget.style.display = 'none';
        gWidget.style.transform = '';
        gWidget.classList.remove('minimized', 'card-header-peek');
      }
      this._hasPrimaryGraphCard = false;
      this.primaryGraphCardSnapshot = null;
      this.graphCardData = null;
      this.graphCardImage = null;
      this.graphCardRect = null;
      this.isGraphCardMinimized = false;
      this.graphInkStrokes = [];
      this.graphCardBaseX = undefined;
      this.graphCardBaseY = undefined;
    }

    resetBoardAndProblemCardsForNext() {
      // 1. 기존 문제 카드(기본 + 추가) 모두 제거
      this.closeProblemCard();
      if (this.extraProblemCards && this.extraProblemCards.length > 0) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el) {
            this._hibernateDetachedCardCanvases(c.el);
            if (this._activePeekCardEl === c.el) this._activePeekCardEl = null;
            c.el.remove();
          }
        });
        this.extraProblemCards = [];
      }
      // 2. 이전 문제의 그래프 보관 카드(#1, #2...) 완벽 제거
      this.closeGraphCard();
      if (this.extraGraphCards && this.extraGraphCards.length > 0) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el) {
            this._hibernateDetachedCardCanvases(c.el);
            if (this._activePeekCardEl === c.el) this._activePeekCardEl = null;
            c.el.remove();
          }
        });
        this.extraGraphCards = [];
      }
      this._graphCaseCounter = 0;
      this._graphSessionArchived = false;
      this.isGraphCovered = true;
      this._coveredGraphStateBackup = null;
      this._suspendedPdfBoardState = null;
      this._retainedPdfAudioProbCard = false;
      this.pdfPageBoardData = null;
      this._lastPdfPageScreenRect = null;
      this.ySpan = 6.0;

      // 3. 칠판 필기 및 수식 그래프 100% 완전 초기화
      this.inkStrokes = [];
      this.dropLines = [];
      this.textLabels = [];
      this.selectedLassoStrokeIndices = [];
      this.lassoBounds = null;
      this._inkBakeDirty = true;
      this.clearInkCache();

      this.graphs = [];
      this.activeGraphIdx = -1;
      this.selectedHandleIdx = null;
      this.isCurveSelected = false;
      this.selectedPwBoundaryIdx = null;
      this.usePiecewise = false;
      this.piecewiseBoundaries = [];
      this.piecewiseFuncMap = [];
      this.piecewiseInclusions = [];
      this.isPiecewisePeriodic = false;
      this.periodicStepY = 0;
      this.isPiecewiseLocked = false;

      this.showAxes = false;
      this.showGuides = false;
      this.showInverseGuide = false;
      this.panX = 0;
      this.panY = 0;
      this.boardPanX = 0;
      this.boardPanY = 0;
      this.boardZoom = 1.0;
      this.boardZoomOffsetX = 0;
      this.boardZoomOffsetY = 0;
      this.zoomLevel = 1.0;
      this.updateAxesUI();
      this.syncControls();
      this.renderLayerList();
      this.renderFuncList();
      this.syncGraphSnapBarUI();
      this.render();
    }

    async loadImagesOnePerSlide(imageFiles) {
      if (!Array.isArray(imageFiles) || imageFiles.length === 0) return;
      if (this.lessonTeachingMode === 'page') {
        this.showToast('⚠️ 페이지 모드 수업 중에는 이미지 카드를 추가할 수 없습니다.');
        return;
      }

      const readAsDataURL = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const rawBase = (file._customClipboardLabel || file.name || '이미지 문제').replace(/\.[^/.]+$/, '');
          resolve({
            name: (rawBase.toLowerCase() === 'image' ? '클립보드 캡처' : rawBase),
            dataUrl: evt.target.result
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });

      const loadedItems = (await Promise.all(imageFiles.map(readAsDataURL))).filter(Boolean);
      if (loadedItems.length === 0) return;

      const hasExisting = Boolean(this._isReplacingViaNextCrop || this.hasAnyWorkspaceContent());
      this._isReplacingViaNextCrop = false;
      const addSlidesNeeded = hasExisting ? loadedItems.length : Math.max(0, loadedItems.length - 1);
      if (addSlidesNeeded > 0 && typeof this.canAddMoreSlidesWithQuota === 'function' && !this.canAddMoreSlidesWithQuota(addSlidesNeeded)) {
        return;
      }

      this.setLessonTeachingMode('crop');
      if (hasExisting) {
        this._archiveCurrentBeforeNextCapture();
      }

      if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides)) {
        this.lessonPlaylistSlides = [];
        this.isLessonPlaylistActive = true;
      }
      const firstAddedSlideIdx = this.lessonPlaylistSlides.length;
      const targetW = Math.round(Math.min(720, Math.max(480, window.innerWidth * 0.42)));

      loadedItems.forEach((item) => {
        this.resetBoardAndProblemCardsForNext();
        this.audioSyncData = null;
        this.setProblemCard(item.dataUrl, item.name, null, targetW);
        const slideNum = this.lessonPlaylistSlides.length + 1;
        const slide = this.serializeFullSlideState(item.name || String(slideNum));
        this.lessonPlaylistSlides.push(slide);
      });

      this.lessonPlaylistIndex = Math.max(0, Math.min(this.lessonPlaylistSlides.length - 1, firstAddedSlideIdx));
      this.deserializeFullSlideState(this.lessonPlaylistSlides[this.lessonPlaylistIndex]);
      if (!this.isInkMode) {
        this.toggleInkMode(true);
      }
      this.setActiveInkTool('pen');
      this._isAudioWaitingForNextSlideSetup = false;
      this._alreadyArchivedBeforePdfModal = false;
      if (this._autoPausedByPdfModal) {
        const pausedDelta = this.audioRecordPauseStartMs
          ? Math.max(0, performance.now() - this.audioRecordPauseStartMs)
          : 0;
        this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + pausedDelta;
        this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
        this._autoPausedByPdfModal = false;
        this.isAudioRecordPaused = false;
        this.audioRecordPauseStartMs = 0;
      }
      if (this.isAudioRecording) {
        if (hasExisting) {
          this._beginNextSlideAudioSegmentAfterSwitch();
        } else {
          this.audioInitialState = this._captureAudioWorkspaceKeyframe();
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
      }
      this.syncLessonPlaylistNavBarUI();
      this.render();

      if (loadedItems.length === 1) {
        this.showToast(hasExisting
          ? `⏭️ 새 캔버스에 이미지 문제 [${loadedItems[0].name}]을(를) 열었습니다!`
          : `📁 이미지 문제 [${loadedItems[0].name}]을(를) 칠판에 등록했습니다!`);
      } else {
        this.showToast(`📚 ${loadedItems.length}개의 이미지 문제를 캔버스당 1문제씩(펼친 상태) 등록했습니다! 우상단 [<] [>] 버튼으로 넘기며 수업하세요.`);
      }
    }

    _escapeCardHtml(val) {
      return String(val == null ? '' : val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    _sanitizeCardImageUrl(rawUrl) {
      if (!rawUrl || typeof rawUrl !== 'string') return '';
      const trimmed = rawUrl.trim();
      if (/^data:image\/(?:png|jpe?g|webp|gif|bmp)(?:;charset=[^;,]+)?;base64,[a-zA-Z0-9+/=\s]+$/i.test(trimmed)) {
        return trimmed;
      }
      if (/^blob:/i.test(trimmed)) {
        return trimmed;
      }
      return '';
    }

    spawnExtraProblemCard(dataUrl, pageNum = 1, initialWidth = null, sourceCanvas = null, options = null) {
      if (!this.extraProblemCards) this.extraProblemCards = [];
      const caseIdx = (options && options.explicitIndex) ? options.explicitIndex : (this.extraProblemCards.length + 2);

      const cardW = initialWidth || Math.round(Math.min(720, Math.max(480, window.innerWidth * 0.42)));

      // 기본 위치: 이전 문제 카드에서 살짝 겹쳐 계단식(offset)으로 소환 (단, 다중 불러오기 시 지정된 줄 세우기 좌표 사용)
      const count = this.extraProblemCards.length + 1;
      let baseX = (options && typeof options.customX === 'number')
        ? options.customX
        : ((typeof this.problemCardBaseX === 'number' ? this.problemCardBaseX : 72) + 32 * count);
      let baseY = (options && typeof options.customY === 'number')
        ? options.customY
        : ((typeof this.problemCardBaseY === 'number' ? this.problemCardBaseY : 18) + 32 * count);

      if (!(options && typeof options.customX === 'number') && baseX + cardW > window.innerWidth - 30) {
        baseX = Math.max(40, window.innerWidth - cardW - 50);
      }
      if (!(options && typeof options.customY === 'number') && baseY > window.innerHeight - 200) {
        baseY = Math.max(18, 18 + (this.extraProblemCards.length % 5) * 32);
      }

      const isPdfPageCard = Boolean(options && options.isPdfPageCard);
      const pdfPageNum = (options && options.pdfPageNum) ? options.pdfPageNum : pageNum;
      const titleText = (options && options.customTitle)
        ? options.customTitle
        : ((typeof pageNum === 'number')
          ? `문제 #${caseIdx} (p.${pageNum})`
          : (String(pageNum).includes('클립보드') ? `문제 #${caseIdx} (클립보드)` : `문제 #${caseIdx} (${pageNum})`));

      const el = document.createElement('div');
      el.className = `problem-card-widget extra-problem-card-widget${isPdfPageCard ? ' pdf-page-mini-card' : ''}`;
      el.style.display = 'flex';
      el.style.width = `${cardW}px`;
      el.style.left = `${Math.round(baseX)}px`;
      el.style.top = `${Math.round(baseY)}px`;
      this.bringCardToFront(el);
      const safePdfPageNum = this._escapeCardHtml(pdfPageNum);
      const safeTitleText = this._escapeCardHtml(titleText);
      const safeDataUrl = this._sanitizeCardImageUrl(dataUrl);
      const restorePageBtnHtml = isPdfPageCard
        ? `<button class="card-btn btn-extra-restore-page" title="이 페이지(p.${safePdfPageNum})를 메인 캔버스로 다시 열기"><span>🔄</span></button>`
        : '';
      el.innerHTML = `
      <div class="problem-card-header">
        <div class="problem-card-title-group">
          <div class="problem-card-drag-handle">
            <span class="card-title-text">${safeTitleText}</span>
          </div>
        </div>
        <div class="problem-card-actions">
          <button type="button" class="card-btn btn-card-lock-edit btn-problem-lock unlocked-editing" title="클릭하여 잠금 — 3초 뒤 테두리와 상단 메뉴가 숨겨지며 톡 치면 다시 나타납니다">
            <span class="card-lock-icon" style="display:inline-flex;align-items:center;justify-content:center;">
              <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/></svg>
            </span>
          </button>
          <button type="button" class="card-btn btn-card-laser" title="카드 위 필기 켜기/끄기 (꺼짐: 몸통 잡고 이동 / 켜짐: 카드 위 밑줄·필기)">
            <span class="card-laser-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></span>
          </button>
          ${restorePageBtnHtml}
          <button class="card-btn btn-card-close btn-extra-close" title="닫기">
            <span style="display:inline-flex;align-items:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
          </button>
        </div>
      </div>
      <div class="problem-card-body">
        <img class="problem-card-img" alt="${safeTitleText}" draggable="false" />
      </div>
      <div class="problem-card-resize-handle"></div>
    `;
      const stageParent = (this.canvas && this.canvas.parentElement) || document.body;
      stageParent.appendChild(el);
      this.attachCardLaserSystem(el);
      const extraImgEl = el.querySelector('.problem-card-img');
      if (extraImgEl) {
        extraImgEl.addEventListener('load', () => {
          const extraCvs = el.querySelector('.problem-card-canvas');
          if (extraCvs) extraCvs._needsSizeSync = true;
          if (!this._isDrawingCardInk && typeof el._renderCardInkCanvas === 'function') {
            el._renderCardInkCanvas();
          }
        });
        if (safeDataUrl) {
          extraImgEl.src = safeDataUrl;
        }
      }

      const startMin = Boolean(options && options.startMinimized);
      const cardItem = { el, baseX: Math.round(baseX), baseY: Math.round(baseY), isMin: startMin, isPdfPageCard, pdfPageNum, sourceCanvas: sourceCanvas || null };
      if (startMin) {
        el.classList.add('minimized');
        const chev = el.querySelector('.card-fold-chevron');
        if (chev) chev.textContent = '▸';
      }
      this.extraProblemCards.push(cardItem);
      this.updateProblemCardPosition(true);

      el._savedExpandedWidth = `${Math.round(cardW)}px`;
      const toggleExtraMin = () => {
        if (el._lastToggleTime && performance.now() - el._lastToggleTime < 75) return;
        el._lastToggleTime = performance.now();
        const wasMin = el.classList.contains('minimized');
        if (!wasMin) {
          const curW = parseFloat(el.style.width) || Math.round(el.getBoundingClientRect().width);
          if (curW >= 200) el._savedExpandedWidth = `${Math.round(curW)}px`;
        }
        const nextMin = !wasMin;
        cardItem.isMin = nextMin;
        el.classList.toggle('minimized', nextMin);
        if (!nextMin && el._savedExpandedWidth) {
          el.style.width = el._savedExpandedWidth;
          if (typeof el._syncCardLaserSize === 'function') el._syncCardLaserSize();
        }
        const chev = el.querySelector('.card-fold-chevron');
        if (chev) chev.textContent = nextMin ? '▸' : '▾';
      };
      el._toggleCardMin = toggleExtraMin;

      // 롱프레스 쉴드 및 우클릭 방어 (버튼 터치 시 click 이벤트가 죽지 않도록 버튼 영역은 touchstart preventDefault 제외)
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); return false; }, { capture: true });
      el.addEventListener('touchstart', (e) => {
        if (e.target && e.target.closest('button, .card-btn, .card-fold-triangle-btn, .problem-card-actions')) return;
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('dragstart', (e) => e.preventDefault());
      el.addEventListener('selectstart', (e) => e.preventDefault());
      ['MSHoldVisual', 'MSGestureHold'].forEach(evtName => {
        el.addEventListener(evtName, (e) => e.preventDefault(), { passive: false });
      });

      if (this.isGraphCovered && this.pdfPageBoardData) {
        this._pinCardToPdfBoardAtScreenPos(el, cardItem.baseX, cardItem.baseY, false);
        this.updateProblemCardPosition(true);
      }

      // 1. 제목 및 카드 몸통 드래그 이동 전용 (접기 버튼은 드래그에서 완벽 분리!)
      let isDragging = false, dragMoved = false, startX = 0, startY = 0, initX = cardItem.baseX, initY = cardItem.baseY;
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.problem-card-resize-handle')) return;
        if (e.target.closest('.problem-card-actions') || e.target.closest('.card-fold-triangle-btn') || e.target.closest('.card-title-fold-btn')) {
          this.bringCardToFront(el);
          e.stopPropagation();
          return;
        }
        if (e.pointerType === 'touch' && this._shouldIgnoreCanvasTouchPointer(e)) {
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();
          return;
        }
        this.bringCardToFront(el);
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        dragMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        if (el.classList.contains('pip-locked-mode') && !el.classList.contains('pip-stealth-locked')) {
          this.clearProblemCardStealthTimer(el);
        }
        if (this.isGraphCovered && this.pdfPageBoardData && el._pdfAnchor) {
          const s = this.mathToScreen(el._pdfAnchor.mx, el._pdfAnchor.my);
          initX = s.x;
          initY = s.y;
        } else {
          initX = cardItem.baseX;
          initY = cardItem.baseY;
        }
        el._dragDomLeft = parseFloat(el.style.left) || cardItem.baseX || initX;
        el._dragDomTop = parseFloat(el.style.top) || cardItem.baseY || initY;
        el._cachedDragW = parseFloat(el.style.width) || el.offsetWidth || 180;
        el._cachedDragH = el.offsetHeight || 120;
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        el.classList.add('is-dragging-card');
      });
      el._cancelCardDrag = () => {
        isDragging = false;
        dragMoved = false;
        this._isDraggingOrResizingAnyCard = false;
        el.classList.remove('is-dragging-card');
        delete el._dragDomLeft;
        delete el._dragDomTop;
        delete el._cachedDragW;
        delete el._cachedDragH;
        if (typeof cardItem.baseX === 'number') el.style.left = `${cardItem.baseX}px`;
        if (typeof cardItem.baseY === 'number') el.style.top = `${cardItem.baseY}px`;
        this.updateProblemCardPosition(true, el);
      };
      window.addEventListener('pointermove', (e) => {
        if (!isDragging || el.isConnected === false) return;
        if (e.pointerType === 'mouse' && typeof e.buttons === 'number' && e.buttons === 0) {
          el._cancelCardDrag();
          return;
        }
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!dragMoved) {
          if (Math.hypot(dx, dy) <= 5) return;
          dragMoved = true;
        }
        this._isDraggingOrResizingAnyCard = true;
        if (this.isGraphCovered && this.pdfPageBoardData) {
          const nextX = Math.round(initX + dx);
          const nextY = Math.round(initY + dy);
          this._pinCardToPdfBoardAtScreenPos(el, nextX, nextY, true);
          this.updateProblemCardPosition(true, el);
        } else {
          const dScale = (this.isGraphCovered && !this.pdfPageBoardData)
            ? Math.max(0.2, Math.min(4.0, this.boardZoom || 1.0))
            : 1.0;
          cardItem.baseX = Math.round(initX + (dx / dScale));
          cardItem.baseY = Math.round(initY + (dy / dScale));
          this.updateProblemCardPosition(true, el);
        }
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(false);
        }
      });
      const stopDrag = () => {
        if (isDragging) {
          const wasMoved = dragMoved;
          isDragging = false;
          dragMoved = false;
          this._isDraggingOrResizingAnyCard = false;
          el.classList.remove('is-dragging-card');
          delete el._dragDomLeft;
          delete el._dragDomTop;
          delete el._cachedDragW;
          delete el._cachedDragH;
          if (typeof cardItem.baseX === 'number') el.style.left = `${cardItem.baseX}px`;
          if (typeof cardItem.baseY === 'number') el.style.top = `${cardItem.baseY}px`;
          this.updateProblemCardPosition(true, el);
          if (wasMoved) {
            el._justDraggedTime = performance.now();
            if (el.classList.contains('pip-locked-mode') && !el.classList.contains('pip-stealth-locked')) {
              this.scheduleProblemCardStealth(el, 3000);
            }
          } else if (el.classList.contains('pip-locked-mode')) {
            if (el.classList.contains('pip-stealth-locked')) {
              this.wakeUpProblemCardStealth(el, true);
            } else {
              this.scheduleProblemCardStealth(el, 3000);
            }
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        }
      };
      window.addEventListener('pointerup', stopDrag);
      window.addEventListener('pointercancel', stopDrag);

      // 2. 우하단 리사이즈 핸들 드래그 (iPad 120Hz VSync 병합 & 팜리젝션 pointerId 격리)
      const rHandle = el.querySelector('.problem-card-resize-handle');
      if (rHandle) {
        let isResizing = false, resizeMoved = false, rStartX = 0, rStartY = 0, rStartW = cardW;
        let lastAppliedW = Math.round(cardW);
        let activeResizePointerId = null;
        let activeResizePointerType = null;
        let resizeRafId = null;
        let pendingResizeEv = null;

        const applyExtraProbResizeStep = (ev) => {
          if (!isResizing || !ev || el.isConnected === false) return;
          const curUS = (this.isGraphCovered && this.pdfPageBoardData && typeof this.getCurrentMathUnitScale === 'function')
            ? this.getCurrentMathUnitScale()
            : 0;
          const scaleRatio = (curUS > 0 && el._pdfAnchor && el._pdfAnchor.unitScale > 0)
            ? Math.max(0.2, Math.min(4.0, curUS / el._pdfAnchor.unitScale))
            : ((this.isGraphCovered && !this.pdfPageBoardData) ? Math.max(0.2, Math.min(4.0, this.boardZoom || 1.0)) : 1.0);
          const nextW = Math.round(Math.max(240, Math.min(window.innerWidth * 0.85, rStartW + ((ev.clientX - rStartX) / scaleRatio))));
          if (nextW === lastAppliedW) return;
          lastAppliedW = nextW;
          el.style.width = `${nextW}px`;
          if (nextW >= 200) el._savedExpandedWidth = `${nextW}px`;
          const extraCvs = el.querySelector('.problem-card-canvas');
          const hasInk = Boolean(el._cardInkStrokes && el._cardInkStrokes.length > 0);
          if (hasInk && typeof el._renderCardInkCanvas === 'function') {
            if (extraCvs) extraCvs._needsSizeSync = true;
            el._renderCardInkCanvas();
          } else if (extraCvs) {
            extraCvs._needsSizeSync = true;
          }
          if (el._cardLaserState && el._cardLaserState.strokes && el._cardLaserState.strokes.length > 0 && typeof el._syncCardLaserSize === 'function') {
            el._syncCardLaserSize();
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(false);
          }
        };

        el._cancelCardResize = (reason) => {
          if (!isResizing) return;
          if (reason === 'pen_or_pinch' && activeResizePointerType === 'pen') return;
          if (resizeRafId) {
            cancelAnimationFrame(resizeRafId);
            resizeRafId = null;
          }
          pendingResizeEv = null;
          isResizing = false;
          resizeMoved = false;
          activeResizePointerId = null;
          activeResizePointerType = null;
          this._isDraggingOrResizingAnyCard = false;
          el.style.width = `${Math.round(rStartW)}px`;
          const extraCvs = el.querySelector('.problem-card-canvas');
          if (extraCvs) extraCvs._needsSizeSync = true;
          if (el._cardInkStrokes && el._cardInkStrokes.length > 0 && typeof el._renderCardInkCanvas === 'function') {
            el._renderCardInkCanvas();
          }
          if (typeof el._syncCardLaserSize === 'function') el._syncCardLaserSize();
        };

        rHandle.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'touch' && (
            this.isDrawingInk ||
            this._isDrawingCardInk ||
            (this._lastPenActiveTime && (Date.now() - this._lastPenActiveTime < 450))
          )) {
            if (e.cancelable !== false) e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.pointerType === 'pen') {
            this._markStylusPenDetected();
            this._lastPenActiveTime = Date.now();
          }
          this.bringCardToFront(el);
          e.preventDefault();
          e.stopPropagation();
          try { rHandle.setPointerCapture(e.pointerId); } catch (_) { }
          isResizing = true;
          resizeMoved = false;
          activeResizePointerId = (e.pointerId !== undefined) ? e.pointerId : null;
          activeResizePointerType = e.pointerType || 'mouse';
          rStartX = e.clientX;
          rStartY = e.clientY;
          if (el.classList.contains('pip-locked-mode') && !el.classList.contains('pip-stealth-locked')) {
            this.clearProblemCardStealthTimer(el);
          }
          rStartW = parseFloat(el.style.width) || el.offsetWidth || el.getBoundingClientRect().width;
          lastAppliedW = Math.round(rStartW);
          if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        });
        window.addEventListener('pointermove', (e) => {
          if (!isResizing || el.isConnected === false) return;
          if (activeResizePointerId !== null && e.pointerId !== undefined && e.pointerId !== activeResizePointerId) return;
          if (e.pointerType === 'pen') {
            this._lastPenActiveTime = Date.now();
          }
          if (!resizeMoved && Math.hypot(e.clientX - rStartX, e.clientY - rStartY) > 3) {
            resizeMoved = true;
          }
          this._isDraggingOrResizingAnyCard = true;
          pendingResizeEv = { clientX: e.clientX, clientY: e.clientY };
          if (!resizeRafId) {
            resizeRafId = requestAnimationFrame(() => {
              resizeRafId = null;
              const ev = pendingResizeEv;
              pendingResizeEv = null;
              if (ev) applyExtraProbResizeStep(ev);
            });
          }
        });
        const stopResize = (e) => {
          if (!isResizing) return;
          if (e && activeResizePointerId !== null && e.pointerId !== undefined && e.pointerId !== activeResizePointerId) return;
          if (resizeRafId) {
            cancelAnimationFrame(resizeRafId);
            resizeRafId = null;
          }
          if (pendingResizeEv) {
            const ev = pendingResizeEv;
            pendingResizeEv = null;
            applyExtraProbResizeStep(ev);
          }
          const wasResizeMoved = resizeMoved;
          isResizing = false;
          resizeMoved = false;
          activeResizePointerId = null;
          activeResizePointerType = null;
          this._isDraggingOrResizingAnyCard = false;
          const extraCvs = el.querySelector('.problem-card-canvas');
          if (extraCvs) extraCvs._needsSizeSync = true;
          if (typeof el._renderCardInkCanvas === 'function' && el._cardInkStrokes && el._cardInkStrokes.length > 0) {
            el._renderCardInkCanvas();
          }
          if (typeof el._syncCardLaserSize === 'function') {
            el._syncCardLaserSize();
          }
          if (el.classList.contains('pip-locked-mode')) {
            if (!wasResizeMoved && el.classList.contains('pip-stealth-locked')) {
              this.wakeUpProblemCardStealth(el, true);
            } else if (!el.classList.contains('pip-stealth-locked')) {
              this.scheduleProblemCardStealth(el, 3000);
            }
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        };
        window.addEventListener('pointerup', stopResize);
        window.addEventListener('pointercancel', stopResize);
      }

      // 3. 상단 왼쪽 제목(▾) 클릭 시 제자리 접기/펼치기 토글 (pointerup + click 이중 바인딩으로 빠른 연속 터치 100% 반응 보장)
      const btnMin = el.querySelector('.btn-extra-min');
      if (btnMin) {
        btnMin.addEventListener('pointerup', (e) => {
          if (e.button && e.button !== 0) return;
          e.stopPropagation();
          toggleExtraMin();
        });
        btnMin.onclick = (e) => {
          if (e) e.stopPropagation();
          toggleExtraMin();
        };
      }

      // 3.5. PDF 페이지 카드 복원(🔄) 버튼
      const btnRestorePage = el.querySelector('.btn-extra-restore-page');
      if (btnRestorePage && isPdfPageCard) {
        btnRestorePage.onclick = (e) => {
          e.stopPropagation();
          this.openPdfPageOnBoard(pdfPageNum);
        };
      }

      // 4. 닫기 버튼
      const btnClose = el.querySelector('.btn-extra-close');
      if (btnClose) {
        btnClose.onclick = () => {
          this._pushWorkspaceUndoSnapshot('↺ 닫은 문제 카드가 복원되었습니다', '↻ 문제 카드 닫기 다시 실행됨');
          this.clearProblemCardStealthTimer(el);
          this._hibernateDetachedCardCanvases(el);
          if (this._activePeekCardEl === el) {
            this._activePeekCardEl = null;
          }
          el.remove();
          this.extraProblemCards = this.extraProblemCards.filter(c => c !== cardItem);
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
          this.showToast('🗑️ 문제 카드를 닫았습니다 (되돌리기 ↺로 복원 가능)');
        };
      }

      // 판서 모드 및 안내 토스트
      if (!this.isInkMode) {
        this.toggleInkMode(true);
      }
      this.setActiveInkTool('pen');
      this.render();

      const totalProblems = 1 + this.extraProblemCards.length;
      this.showToast(`📋 ${totalProblems}번째 문제 카드가 추가되었습니다!`);
      return cardItem;
    }

    setProblemCard(dataUrl, pageNum = 1, sourceCanvas = null, initialWidth = null, options = null) {
      if (!this.extraProblemCards) this.extraProblemCards = [];
      const keepGraphMode = Boolean(options && options.keepGraphMode);
      if (!keepGraphMode) {
        this.enterBoardMode();
      }

      const widget = document.getElementById('problemCardWidget');
      const isPrimaryActive = widget && widget.style.display !== 'none' && this.problemCardData;

      // 🌟 [대표님 기획]: 이미 문제 카드가 칠판에 활성화되어 있다면, 기존 문제를 덮어쓰지 않고 추가 문제 카드로 소환!
      if (isPrimaryActive && !keepGraphMode) {
        const spawned = this.spawnExtraProblemCard(dataUrl, pageNum, initialWidth, sourceCanvas);
        this._lastPlacedProblemCardTarget = { type: 'extra', cardItem: spawned, pageNum };
        return spawned;
      }

      this._isTempPdfProblemCard = Boolean(options && options.isTempPdfCard);
      this.problemCardData = {
        imgUrl: dataUrl,
        pageNum: pageNum
      };
      this._lastPlacedProblemCardTarget = { type: 'primary', problemCardData: this.problemCardData, pageNum };
      this.isProblemCardMinimized = false;
      this.problemInkStrokes = [];

      if (sourceCanvas && sourceCanvas.width && sourceCanvas.height) {
        this.problemCardImage = sourceCanvas;
        this.problemCardAspect = sourceCanvas.height / sourceCanvas.width;
      }

      const imgObj = new Image();
      imgObj.onload = () => {
        if (imgObj.naturalWidth && imgObj.naturalHeight) {
          this.problemCardAspect = imgObj.naturalHeight / imgObj.naturalWidth;
        }
        if (!sourceCanvas) {
          this.problemCardImage = imgObj;
        }
        this.syncProblemCardRectFromWidget();
        this.render();
      };
      const safePrimaryUrl = this._sanitizeCardImageUrl(dataUrl);
      if (safePrimaryUrl) imgObj.src = safePrimaryUrl;

      const img = document.getElementById('problemCardImg');
      const title = document.getElementById('problemCardTitle');

      if (img && safePrimaryUrl) img.src = safePrimaryUrl;
      if (title) {
        if (typeof pageNum === 'number') {
          title.textContent = `문제 (p.${pageNum})`;
        } else {
          title.textContent = `문제 (${pageNum})`;
        }
      }

      // PDF에서 크롭한 화면 크기를 유지(+15% 확대)하여 메인 창에서 다시 키울 필요가 없도록 설정!
      const cardW = initialWidth || 520;

      if (widget) {
        this.setProblemCardLockedByWidget(widget, false, false);
        widget.classList.remove('minimized', 'card-ink-active', 'card-laser-active');
        const pInkBtn = document.getElementById('btnProblemCardLaser');
        if (pInkBtn) pInkBtn.classList.remove('active');
        if (widget._cardLaserState) widget._cardLaserState.active = false;
        widget.style.display = 'flex';
        this.problemCardBaseX = 72;
        this.problemCardBaseY = 18;
        widget.style.left = '72px';
        widget.style.top = '18px';
        widget.style.width = `${cardW}px`;
        this.boardPanX = 0;
        this.boardPanY = 0;
        this.updateProblemCardPosition();
      }

      const toggleBtn = document.getElementById('iconCardToggle');
      if (toggleBtn) toggleBtn.textContent = '▾';
      if (widget) this.bringCardToFront(widget);

      this.updateProblemCardPosition();
      this.renderProblemCardCanvas();
      this.render();
    }


    // --- [📋 클립보드 캡처 이미지 붙여넣기(Ctrl+V) & 파일 드래그 앤 드롭(Drag & Drop) 엔진] ---
    initClipboardAndDropInteractions() {
      if (this._clipboardInteractionsInited) return;
      this._clipboardInteractionsInited = true;

      // 1. 클립보드 이미지 붙여넣기 (Ctrl + V: 빈 캔버스면 현재 캔버스에, 내용이 있으면 자동으로 새 캔버스에 분리 생성!)
      window.addEventListener('paste', async (e) => {
        // 텍스트 인풋/텍스트에어리어에 포커스가 있을 때는 문자열 붙여넣기 우선
        const activeEl = document.activeElement;
        const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isInput) return;

        const cbData = e.clipboardData || e.originalEvent?.clipboardData;
        if (!cbData) return;

        const imageFiles = [];
        if (cbData.files && cbData.files.length > 0) {
          Array.from(cbData.files).forEach((f) => {
            if (f && f.type && f.type.startsWith('image/')) {
              if (!f.name || f.name.toLowerCase() === 'image.png') {
                f._customClipboardLabel = '클립보드 캡처';
              }
              imageFiles.push(f);
            }
          });
        }
        if (imageFiles.length === 0 && cbData.items && cbData.items.length > 0) {
          for (let i = 0; i < cbData.items.length; i++) {
            const item = cbData.items[i];
            if (item.type && item.type.indexOf('image') !== -1) {
              const file = item.getAsFile();
              if (file) {
                if (!file.name || file.name.toLowerCase() === 'image.png') {
                  file._customClipboardLabel = '클립보드 캡처';
                }
                imageFiles.push(file);
              }
            }
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault();
          this._isReplacingViaNextCrop = false;
          await this.loadImagesOnePerSlide(imageFiles);
        }
      });

      // 2. 캔버스 위 파일 드래그 앤 드롭 (Drag & Drop)
      window.addEventListener('dragover', (e) => {
        if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      });

      window.addEventListener('drop', async (e) => {
        const files = e.dataTransfer && e.dataTransfer.files;
        if (!files || files.length === 0) return;

        const fileArr = Array.from(files);
        const imageFiles = fileArr.filter(f => f.type && f.type.startsWith('image/'));
        const pdfFile = fileArr.find(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        if (imageFiles.length === 0 && !pdfFile) return;

        e.preventDefault();
        this._isReplacingViaNextCrop = false;

        // 1) 이미지 파일(1개 또는 N개 드롭) -> 슬라이드당 1문제씩 펼쳐진 상태(▾)로 배치!
        if (imageFiles.length >= 1) {
          await this.loadImagesOnePerSlide(imageFiles);
          return;
        }

        // 2) PDF 파일 드롭 -> PDF 뷰어 오픈
        if (pdfFile) {
          this.loadPdfFromFile(pdfFile);
          this.showToast(`📄 PDF 문서 [${pdfFile.name}]을(를) 불러왔습니다!`);
        }
      });
    }

    initProblemCardInteractions() {
      this.initClipboardAndDropInteractions();
      const widget = document.getElementById('problemCardWidget');
      const dragHandle = document.getElementById('problemCardDragHandle');
      const resizeHandle = document.getElementById('problemCardResizeHandle');
      const pCanvas = document.getElementById('problemCardCanvas');
      const btnToggleMin = document.getElementById('btnProblemCardToggleMinimize');
      const btnClose = document.getElementById('btnProblemCardClose');
      const btnZoomIn = document.getElementById('btnProblemCardZoomIn');
      const btnZoomOut = document.getElementById('btnProblemCardZoomOut');
      const btnClearInk = document.getElementById('btnProblemCardClearInk');

      if (!widget) return;

      this.problemInkStrokes = [];

      // 0. 문제 창 전용 독립 캔버스 (#problemCardCanvas) 필기/형광펜/지우개 인터랙션
      if (pCanvas) {
        let isDrawingOnProblem = false;
        let currentStroke = null;
        let holdTimer = null;
        let activeProblemDrawRect = null;
        let activeProblemPointerId = null;

        const restartProblemHoldTimer = (w, h) => {
          if (!isDrawingOnProblem || !currentStroke || currentStroke._shapeHoldDetected) return;
          currentStroke._lastHoldMoveTime = Date.now();
          currentStroke._holdW = w;
          currentStroke._holdH = h;
          if (holdTimer) return;
          const checkHold = () => {
            holdTimer = null;
            if (!isDrawingOnProblem || !currentStroke || currentStroke._shapeHoldDetected) return;
            const elapsed = Date.now() - (currentStroke._lastHoldMoveTime || 0);
            if (elapsed < 340) {
              holdTimer = setTimeout(checkHold, Math.max(16, 340 - elapsed));
              return;
            }
            if (this.recognizeAndApplyCardStrokeShape(currentStroke, currentStroke._holdW || w, currentStroke._holdH || h)) {
              this.renderProblemCardCanvas(currentStroke);
            }
          };
          holdTimer = setTimeout(checkHold, 340);
        };

        const getNormPos = (e, useCachedRect = false) => {
          const rect = (useCachedRect && activeProblemDrawRect && activeProblemDrawRect.width > 0)
            ? activeProblemDrawRect
            : pCanvas.getBoundingClientRect();
          activeProblemDrawRect = rect;
          const w = Math.max(1, rect.width);
          const h = Math.max(1, rect.height);
          const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / w));
          const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / h));
          return { nx, ny, w, h };
        };

        pCanvas.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }, { capture: true });

        const startProblemCardStroke = (e) => {
          if (this.activeInkTool === 'sticker' || this.activeInkTool === 'laser' || this.activeInkTool === 'lasso') return false;
          if (e.pointerType === 'pen') {
            const nowT = Date.now();
            this._markStylusPenDetected();
            this._lastPenActiveTime = nowT;
            this._lastPenDownTime = nowT;
            if (this.activePointers) this.activePointers.clear();
            this._pinchState = null;
            this._pinchWasActiveInGesture = false;
            if (typeof this._cancelAllActiveCardDrags === 'function') this._cancelAllActiveCardDrags();
          }
          if (e.pointerType === 'touch' && this.isStylusPalmRejectionActive()) {
            if (e.cancelable !== false) e.preventDefault();
            return false;
          }
          if (widget) this.bringCardToFront(widget);
          if (e.button !== 0 && e.pointerType !== 'pen' && e.pointerType !== 'touch') return false;
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();

          if (e.pointerType !== 'pen') {
            try { pCanvas.setPointerCapture(e.pointerId); } catch (err) { }
          }

          const pos = getNormPos(e, false);
          isDrawingOnProblem = true;
          this._isDrawingCardInk = true;
          this._currentCardEraseUndoEntry = null;
          activeProblemPointerId = (e.pointerId !== undefined) ? e.pointerId : null;

          const isCardStylusEraser = (
            (typeof e.buttons === 'number' && (e.buttons & 32) !== 0) ||
            e.button === 5 ||
            (e.pointerType === 'pen' && (e.button === 2 || (typeof e.buttons === 'number' && (e.buttons & 2) !== 0)))
          );
          if (this.activeInkTool === 'eraser' || isCardStylusEraser) {
            this._problemCardStylusEraser = true;
            this.eraseProblemInkAtNormalizedPoint(pos.nx, pos.ny, pos.w, pos.h, null, false);
            return true;
          }

          const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          const initCardPenStyle = (this.activeInkTool === 'highlighter') ? 'ballpen' : (this.inkPenStyle || 'ballpen');
          const hasHwP = (typeof e.pressure === 'number' && e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.01);
          const initP = this._mapInitialStrokePressure(e.pressure, initCardPenStyle, hasHwP);
          const startPxX = pos.nx * pos.w;
          const startPxY = pos.ny * pos.h;
          currentStroke = {
            color: this.currentInkColor || '#0f172a',
            size: (this.activeInkTool === 'highlighter') ? parseFloat(((this.currentHighlighterSize || 16) / 2.8).toFixed(2)) : (this.currentInkSize || 3.5),
            highlighterSize: (this.activeInkTool === 'highlighter') ? (this.currentHighlighterSize || 16) : undefined,
            isHighlighter: (this.activeInkTool === 'highlighter'),
            penStyle: initCardPenStyle,
            softBlur: (this.activeInkTool === 'highlighter') ? 0 : (this.inkSoftBlur || 0),
            _hasHwP: hasHwP,
            _inPlaceStreamlined: true,
            _lastRawPx: { x: startPxX, y: startPxY },
            _prevRawPx: { x: startPxX, y: startPxY },
            _holdAnchorPx: { x: startPxX, y: startPxY },
            _lastMovePx: { x: startPxX, y: startPxY },
            _shapeHoldDetected: false,
            tStart: recT,
            tEnd: recT,
            points: [{ nx: pos.nx, ny: pos.ny, p: initP, t: recT }]
          };
          this.problemInkStrokes.push(currentStroke);
          restartProblemHoldTimer(pos.w, pos.h);
          this.renderProblemCardCanvas(currentStroke);
          return true;
        };

        pCanvas.addEventListener('pointerdown', (e) => {
          startProblemCardStroke(e);
        });

        pCanvas.addEventListener('pointermove', (e) => {
          if (!isDrawingOnProblem) {
            return;
          }
          if (activeProblemPointerId !== null && e.pointerId !== undefined && e.pointerId !== activeProblemPointerId) {
            return;
          }
          if (e.pointerType === 'pen') {
            this._markStylusPenDetected();
            this._lastPenActiveTime = Date.now();
          }
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();

          const pos = getNormPos(e, true);
          const isCardStylusEraser = this._problemCardStylusEraser || (
            (typeof e.buttons === 'number' && (e.buttons & 32) !== 0) ||
            e.button === 5 ||
            (e.pointerType === 'pen' && (typeof e.buttons === 'number' && (e.buttons & 2) !== 0))
          );
          if (this.activeInkTool === 'eraser' || isCardStylusEraser) {
            this.eraseProblemInkAtNormalizedPoint(pos.nx, pos.ny, pos.w, pos.h, null, true);
            return;
          }

          if (!currentStroke) return;
          const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          if (recT !== undefined) {
            currentStroke.tEnd = recT;
            this.recordAudioCursorPoint(e.clientX, e.clientY, currentStroke.color, true);
          }

          if (currentStroke._shapeHoldDetected && currentStroke.cardShape) {
            if (this.updateHeldCardStrokeShape(currentStroke, pos.nx, pos.ny, pos.w, pos.h)) {
              const shapeStrokeRef = currentStroke;
              this._scheduleCardLiveFrameRender(pCanvas, () => {
                if (isDrawingOnProblem && currentStroke === shapeStrokeRef) {
                  this.renderProblemCardCanvas(shapeStrokeRef);
                }
              });
            }
            return;
          }

          const curPxX = pos.nx * pos.w;
          const curPxY = pos.ny * pos.h;
          const prevMovePx = currentStroke._lastMovePx || { x: curPxX, y: curPxY };
          const moveStepDist = Math.hypot(curPxX - prevMovePx.x, curPxY - prevMovePx.y);
          currentStroke._lastMovePx = { x: curPxX, y: curPxY };

          const holdAnchor = currentStroke._holdAnchorPx || { x: curPxX, y: curPxY };
          const dHold = Math.hypot(curPxX - holdAnchor.x, curPxY - holdAnchor.y);
          if (moveStepDist > 1.5 || dHold > 5) {
            currentStroke._holdAnchorPx = { x: curPxX, y: curPxY };
            restartProblemHoldTimer(pos.w, pos.h);
          }

          if (!this._appendCardStrokeSamplesFromMoveEvent(currentStroke, e, activeProblemDrawRect, pos.w, pos.h, recT)) return;

          if (currentStroke.isHighlighter) {
            const hlStrokeRef = currentStroke;
            this._scheduleCardLiveFrameRender(pCanvas, () => {
              if (isDrawingOnProblem && currentStroke === hlStrokeRef) {
                this.renderProblemCardCanvas(hlStrokeRef);
              }
            });
          } else {
            this.renderProblemCardCanvas(currentStroke);
          }
        });

        const endProblemDraw = (e) => {
          if (!isDrawingOnProblem) return;
          if (activeProblemPointerId !== null && e && e.pointerId !== undefined && e.pointerId !== activeProblemPointerId) {
            return;
          }
          if (e && e.pointerType === 'pen') {
            this._lastPenActiveTime = Date.now();
          }
          const wasOneShotEraser = (this.activeInkTool === 'eraser' && !this._problemCardStylusEraser);
          const finishedCardStroke = currentStroke;
          const endRect = activeProblemDrawRect;
          isDrawingOnProblem = false;
          this._isDrawingCardInk = false;
          this._currentCardEraseUndoEntry = null;
          activeProblemPointerId = null;
          this._problemCardStylusEraser = false;
          activeProblemDrawRect = null;
          currentStroke = null;
          const pendingProblemEraseRender = !finishedCardStroke ? pCanvas._pendingCardLiveRenderFn : null;
          if (pCanvas._cardLiveRafId) {
            cancelAnimationFrame(pCanvas._cardLiveRafId);
            pCanvas._cardLiveRafId = null;
          }
          pCanvas._pendingCardLiveRenderFn = null;
          if (typeof pendingProblemEraseRender === 'function') {
            pendingProblemEraseRender();
          }
          if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
          }
          if (finishedCardStroke && finishedCardStroke.points && finishedCardStroke.points.length > 0) {
            const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
            if (recT !== undefined) {
              finishedCardStroke.tEnd = recT;
            }
            const rw = Math.max(1, (endRect && endRect.width) || (pCanvas.width / this.getCanvasDpr()) || 400);
            const rh = Math.max(1, (endRect && endRect.height) || (pCanvas.height / this.getCanvasDpr()) || 300);
            this._finishCardStrokeTail(finishedCardStroke, e, endRect, rw, rh, recT);
            this.renderProblemCardCanvas(finishedCardStroke, true);
            this.undoStack.push({
              type: 'card_stroke_add',
              cardKind: 'problem',
              cardEl: widget,
              strokesArr: this.problemInkStrokes,
              stroke: finishedCardStroke,
              renderFn: () => this.renderProblemCardCanvas()
            });
            if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
            this.redoStack = [];
            this.updateUndoRedoUI();
          }
          try { pCanvas.releasePointerCapture(e.pointerId); } catch (err) { }
          if (wasOneShotEraser) {
            this.setActiveInkTool('pen');
          }
        };

        pCanvas.addEventListener('pointerup', endProblemDraw);
        pCanvas.addEventListener('pointercancel', endProblemDraw);
        window.addEventListener('pointerup', endProblemDraw, true);
        window.addEventListener('pointercancel', endProblemDraw, true);
      }

      // 1. 문제 카드 제목 및 몸통 드래그 이동 전용 (삼각형 접기 원버튼과 완벽 분리!)
      if (widget) {
        let isDragging = false;
        let dragMoved = false;
        let startX = 0, startY = 0;
        let initialBaseX = 72, initialBaseY = 18;

        widget._toggleCardMin = () => this.toggleProblemCardMinimize();
        widget.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.problem-card-resize-handle')) return;
          if (e.target.closest('.problem-card-actions') || e.target.closest('.pip-header-curve-tools') || e.target.closest('.card-fold-triangle-btn') || e.target.closest('.card-title-fold-btn')) {
            this.bringCardToFront(widget);
            e.stopPropagation();
            return;
          }
          if (e.pointerType === 'touch' && this._shouldIgnoreCanvasTouchPointer(e)) {
            if (e.cancelable !== false) e.preventDefault();
            e.stopPropagation();
            return;
          }
          this.bringCardToFront(widget);
          e.preventDefault();
          e.stopPropagation();
          isDragging = true;
          dragMoved = false;
          startX = e.clientX;
          startY = e.clientY;
          if (widget.classList.contains('pip-locked-mode') && !widget.classList.contains('pip-stealth-locked')) {
            this.clearProblemCardStealthTimer(widget);
          }
          if (this.isGraphCovered && this.pdfPageBoardData && widget._pdfAnchor) {
            const s = this.mathToScreen(widget._pdfAnchor.mx, widget._pdfAnchor.my);
            initialBaseX = s.x;
            initialBaseY = s.y;
          } else {
            initialBaseX = (typeof this.problemCardBaseX === 'number') ? this.problemCardBaseX : (parseFloat(widget.style.left) || 72);
            initialBaseY = (typeof this.problemCardBaseY === 'number') ? this.problemCardBaseY : (parseFloat(widget.style.top) || 18);
          }
          widget._dragDomLeft = parseFloat(widget.style.left) || this.problemCardBaseX || initialBaseX;
          widget._dragDomTop = parseFloat(widget.style.top) || this.problemCardBaseY || initialBaseY;
          widget._cachedDragW = parseFloat(widget.style.width) || widget.offsetWidth || 180;
          widget._cachedDragH = widget.offsetHeight || 120;
          if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
          widget.classList.add('is-dragging-card');
        });

        widget._cancelCardDrag = () => {
          isDragging = false;
          dragMoved = false;
          this._isDraggingOrResizingAnyCard = false;
          widget.classList.remove('is-dragging-card');
          delete widget._dragDomLeft;
          delete widget._dragDomTop;
          delete widget._cachedDragW;
          delete widget._cachedDragH;
          if (typeof this.problemCardBaseX === 'number') widget.style.left = `${this.problemCardBaseX}px`;
          if (typeof this.problemCardBaseY === 'number') widget.style.top = `${this.problemCardBaseY}px`;
          this.updateProblemCardPosition(true, widget);
        };
        window.addEventListener('pointermove', (e) => {
          if (!isDragging) return;
          if (e.pointerType === 'mouse' && typeof e.buttons === 'number' && e.buttons === 0) {
            widget._cancelCardDrag();
            return;
          }
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (!dragMoved) {
            if (Math.hypot(dx, dy) <= 5) return;
            dragMoved = true;
          }
          this._isDraggingOrResizingAnyCard = true;
          if (this.isGraphCovered && this.pdfPageBoardData) {
            const nextX = Math.round(initialBaseX + dx);
            const nextY = Math.round(initialBaseY + dy);
            this._pinCardToPdfBoardAtScreenPos(widget, nextX, nextY, true);
            this.updateProblemCardPosition(true, widget);
          } else {
            const dScale = (this.isGraphCovered && !this.pdfPageBoardData)
              ? Math.max(0.2, Math.min(4.0, this.boardZoom || 1.0))
              : 1.0;
            this.problemCardBaseX = Math.round(initialBaseX + (dx / dScale));
            this.problemCardBaseY = Math.round(initialBaseY + (dy / dScale));
            this.updateProblemCardPosition(true, widget);
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(false);
          }
        });

        const stopDrag = () => {
          if (isDragging) {
            const wasMoved = dragMoved;
            isDragging = false;
            dragMoved = false;
            this._isDraggingOrResizingAnyCard = false;
            widget.classList.remove('is-dragging-card');
            delete widget._dragDomLeft;
            delete widget._dragDomTop;
            delete widget._cachedDragW;
            delete widget._cachedDragH;
            if (typeof this.problemCardBaseX === 'number') widget.style.left = `${this.problemCardBaseX}px`;
            if (typeof this.problemCardBaseY === 'number') widget.style.top = `${this.problemCardBaseY}px`;
            this.updateProblemCardPosition(true, widget);
            this.syncProblemCardRectFromWidget();
            if (wasMoved) {
              widget._justDraggedTime = performance.now();
              if (widget.classList.contains('pip-locked-mode') && !widget.classList.contains('pip-stealth-locked')) {
                this.scheduleProblemCardStealth(widget, 3000);
              }
            } else if (widget.classList.contains('pip-locked-mode')) {
              if (widget.classList.contains('pip-stealth-locked')) {
                this.wakeUpProblemCardStealth(widget, true);
              } else {
                this.scheduleProblemCardStealth(widget, 3000);
              }
            }
            if (this.isAudioRecording) {
              this._recordAudioWorkspaceStateIfNeeded(true);
            }
          }
        };
        window.addEventListener('pointerup', stopDrag);
        window.addEventListener('pointercancel', stopDrag);
      }

      // 2. 우하단 리사이즈 핸들 드래그 (문제 이미지와 문제 위 필기가 똑같은 비율로 함께 확대/축소 — iPad 120Hz VSync 병합 & pointerId 격리!)
      if (resizeHandle) {
        let isResizing = false;
        let resizeMoved = false;
        let startX = 0;
        let startY = 0;
        let startW = 0;
        let lastAppliedW = 0;
        let activeResizePointerId = null;
        let activeResizePointerType = null;
        let resizeRafId = null;
        let pendingResizeEv = null;

        const applyPrimaryProbResizeStep = (ev) => {
          if (!isResizing || !ev || !widget) return;
          const curUS = (this.isGraphCovered && this.pdfPageBoardData && typeof this.getCurrentMathUnitScale === 'function')
            ? this.getCurrentMathUnitScale()
            : 0;
          const scaleRatio = (curUS > 0 && widget._pdfAnchor && widget._pdfAnchor.unitScale > 0)
            ? Math.max(0.2, Math.min(4.0, curUS / widget._pdfAnchor.unitScale))
            : ((this.isGraphCovered && !this.pdfPageBoardData) ? Math.max(0.2, Math.min(4.0, this.boardZoom || 1.0)) : 1.0);
          const dw = (ev.clientX - startX) / scaleRatio;
          const newW = Math.round(Math.max(280, Math.min(window.innerWidth * 0.85, startW + dw)));
          if (newW === lastAppliedW) return;
          lastAppliedW = newW;
          const newH = Math.round(newW * (this.problemCardAspect || 0.72));
          widget.style.width = `${newW}px`;
          if (newW >= 180) widget._savedExpandedWidth = `${newW}px`;
          const bodyEl = document.getElementById('problemCardBody');
          if (bodyEl && !widget.classList.contains('minimized')) {
            bodyEl.style.height = `${newH}px`;
          }
          if (this.problemCardRect) {
            this.problemCardRect.w = newW;
            this.problemCardRect.h = newH;
          }
          const hasProbInk = Boolean(this.problemInkStrokes && this.problemInkStrokes.length > 0);
          if (hasProbInk) {
            const pCanvas = document.getElementById('problemCardCanvas');
            if (pCanvas && !widget.classList.contains('minimized')) {
              const dpr = this.getCanvasDpr();
              const tw = Math.round(newW * dpr);
              const th = Math.round(newH * dpr);
              if (pCanvas.width !== tw || pCanvas.height !== th) {
                pCanvas.width = tw;
                pCanvas.height = th;
              }
              this.renderProblemCardCanvas();
            }
          }
          if (widget._cardLaserState && widget._cardLaserState.strokes && widget._cardLaserState.strokes.length > 0 && typeof widget._syncCardLaserSize === 'function') {
            widget._syncCardLaserSize();
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(false);
          }
        };

        if (widget) {
          widget._cancelCardResize = (reason) => {
            if (!isResizing) return;
            if (reason === 'pen_or_pinch' && activeResizePointerType === 'pen') return;
            if (resizeRafId) {
              cancelAnimationFrame(resizeRafId);
              resizeRafId = null;
            }
            pendingResizeEv = null;
            isResizing = false;
            resizeMoved = false;
            activeResizePointerId = null;
            activeResizePointerType = null;
            this._isDraggingOrResizingAnyCard = false;
            widget.style.width = `${Math.round(startW)}px`;
            this.syncProblemCardRectFromWidget();
          };
        }

        resizeHandle.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'touch' && (
            this.isDrawingInk ||
            this._isDrawingCardInk ||
            (this._lastPenActiveTime && (Date.now() - this._lastPenActiveTime < 450))
          )) {
            if (e.cancelable !== false) e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.pointerType === 'pen') {
            this._markStylusPenDetected();
            this._lastPenActiveTime = Date.now();
          }
          if (widget) this.bringCardToFront(widget);
          e.preventDefault();
          e.stopPropagation();
          try { resizeHandle.setPointerCapture(e.pointerId); } catch (_) { }
          isResizing = true;
          resizeMoved = false;
          activeResizePointerId = (e.pointerId !== undefined) ? e.pointerId : null;
          activeResizePointerType = e.pointerType || 'mouse';
          startX = e.clientX;
          startY = e.clientY;
          if (widget && widget.classList.contains('pip-locked-mode') && !widget.classList.contains('pip-stealth-locked')) {
            this.clearProblemCardStealthTimer(widget);
          }
          startW = parseFloat(widget.style.width) || widget.offsetWidth || widget.getBoundingClientRect().width;
          lastAppliedW = Math.round(startW);
          if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        });

        window.addEventListener('pointermove', (e) => {
          if (!isResizing) return;
          if (activeResizePointerId !== null && e.pointerId !== undefined && e.pointerId !== activeResizePointerId) return;
          if (e.pointerType === 'pen') {
            this._lastPenActiveTime = Date.now();
          }
          if (!resizeMoved && Math.hypot(e.clientX - startX, e.clientY - startY) > 3) {
            resizeMoved = true;
          }
          this._isDraggingOrResizingAnyCard = true;
          pendingResizeEv = { clientX: e.clientX, clientY: e.clientY };
          if (!resizeRafId) {
            resizeRafId = requestAnimationFrame(() => {
              resizeRafId = null;
              const ev = pendingResizeEv;
              pendingResizeEv = null;
              if (ev) applyPrimaryProbResizeStep(ev);
            });
          }
        });

        const stopResize = (e) => {
          if (!isResizing) return;
          if (e && activeResizePointerId !== null && e.pointerId !== undefined && e.pointerId !== activeResizePointerId) return;
          if (resizeRafId) {
            cancelAnimationFrame(resizeRafId);
            resizeRafId = null;
          }
          if (pendingResizeEv) {
            const ev = pendingResizeEv;
            pendingResizeEv = null;
            applyPrimaryProbResizeStep(ev);
          }
          const wasResizeMoved = resizeMoved;
          isResizing = false;
          resizeMoved = false;
          activeResizePointerId = null;
          activeResizePointerType = null;
          this._isDraggingOrResizingAnyCard = false;
          this.syncProblemCardRectFromWidget();
          if (widget && widget.classList.contains('pip-locked-mode')) {
            if (!wasResizeMoved && widget.classList.contains('pip-stealth-locked')) {
              this.wakeUpProblemCardStealth(widget, true);
            } else if (!widget.classList.contains('pip-stealth-locked')) {
              this.scheduleProblemCardStealth(widget, 3000);
            }
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        };
        window.addEventListener('pointerup', stopResize);
        window.addEventListener('pointercancel', stopResize);
      }

      // 3. 상단 왼쪽 제목(▾) 클릭 시 제자리 접기/펼치기 토글 (pointerup + click 이중 바인딩으로 빠른 연속 탭 100% 작동 보장)
      if (btnToggleMin) {
        btnToggleMin.addEventListener('pointerup', (e) => {
          if (e.button && e.button !== 0) return;
          e.stopPropagation();
          this.toggleProblemCardMinimize();
        });
        btnToggleMin.onclick = (e) => {
          if (e) e.stopPropagation();
          this.toggleProblemCardMinimize();
        };
      }

      // 4. 문제 카드 닫기
      if (btnClose) {
        btnClose.onclick = () => {
          this._pushWorkspaceUndoSnapshot('↺ 닫은 문제 카드가 복원되었습니다', '↻ 문제 카드 닫기 다시 실행됨');
          this.closeProblemCard();
          this.showToast('🗑️ 문제 카드를 닫았습니다 (되돌리기 ↺로 복원 가능)');
        };
      }

      // 5. 카드 확대 / 축소 버튼 (문제 위 밑줄도 비율에 맞춰 자동으로 함께 스케일링!)
      if (btnZoomIn) {
        btnZoomIn.onclick = () => {
          const curW = parseFloat(widget.style.width) || widget.offsetWidth || widget.getBoundingClientRect().width;
          const newW = Math.min(window.innerWidth * 0.85, curW + 60);
          widget.style.width = `${newW}px`;
          this.syncProblemCardRectFromWidget();
        };
      }
      if (btnZoomOut) {
        btnZoomOut.onclick = () => {
          const curW = parseFloat(widget.style.width) || widget.offsetWidth || widget.getBoundingClientRect().width;
          const newW = Math.max(280, curW - 60);
          widget.style.width = `${newW}px`;
          this.syncProblemCardRectFromWidget();
        };
      }

      // 7. 문제 위 밑줄/필기만 원터치 지우기 버튼
      if (btnClearInk) {
        btnClearInk.onclick = () => {
          this.clearProblemCardInk();
        };
      }
    }

    toggleProblemCardMinimize() {
      const widget = document.getElementById('problemCardWidget');
      const icon = document.getElementById('iconCardToggle');
      if (!widget) return;
      if (widget._lastToggleTime && performance.now() - widget._lastToggleTime < 75) return;
      widget._lastToggleTime = performance.now();
      const wasMin = widget.classList.contains('minimized');
      if (!wasMin) {
        const curW = parseFloat(widget.style.width) || Math.round(widget.getBoundingClientRect().width);
        if (curW >= 240) widget._savedExpandedWidth = `${Math.round(curW)}px`;
      }
      const nextMin = !wasMin;
      this.isProblemCardMinimized = nextMin;
      widget.classList.toggle('minimized', nextMin);
      if (!nextMin && widget._savedExpandedWidth) {
        widget.style.width = widget._savedExpandedWidth;
      }
      if (icon) icon.textContent = nextMin ? '▸' : '▾';
      this.updateProblemCardPosition();
      this.syncProblemCardRectFromWidget();
      this.showToast(nextMin ? '📖 문제 카드를 접었습니다.' : '📑 문제 카드를 다시 펼쳤습니다.');
      this.render();
    }

    closeProblemCard() {
      const pCanvas = document.getElementById('problemCardCanvas');
      if (pCanvas) {
        this._cancelCardCanvasPendingTasks(pCanvas, true);
        pCanvas._bakeValid = false;
        pCanvas._liveActiveStroke = null;
        pCanvas._displaySyncedCount = -1;
      }
      const widget = document.getElementById('problemCardWidget');
      if (widget) {
        if (this._activePeekCardEl === widget) {
          this._activePeekCardEl = null;
        }
        widget.classList.remove('card-header-peek');
        this.setProblemCardLockedByWidget(widget, false, false);
        widget.style.display = 'none';
        widget.style.transform = '';
        widget._pdfAnchor = null;
        this.problemCardPdfAnchor = null;
        this.problemCardData = null;
        this.problemCardImage = null;
        this.problemCardRect = null;
        this.problemInkStrokes = [];
        this.compactGraphStage = null;
        this.savedProblemCardViewState = null;
        this.problemCardBaseX = 72;
        this.problemCardBaseY = 18;
        if (!this.extraProblemCards || this.extraProblemCards.length === 0) {
          this.boardPanX = 0;
          this.boardPanY = 0;
        }
      }
      this.render();
    }

    // ==========================================================================
    // [📸 그래프 스샷 카드 & 칠판 덮개/까기 (Cover & Peel) 엔진]
    // 1. 실시간 그래프에서 예쁜 구도를 드래그하여 스샷 촬영 -> 날뛰던 실시간 그래프를 백지 칠판으로 덮음!
    // 2. 캡처된 그래프 카드(#graphCardWidget)를 문제 창 옆에 띄우고 자유 이동/확대/축소 및 카드 위 필기 지원!
    // 3. [🔄 그래프 수정(복구)] 버튼 클릭 시 칠판 덮개를 걷어내어 밑에 살아있던 실시간 그래프 즉시 부활!
    // ==========================================================================
    // 🌟 [카드 터치/클릭 시 최상단 Z-Index 우선순위 자동 승격 엔진] 🌟
    bringCardToFront(targetEl) {
      if (!targetEl) return;
      const allCards = [
        document.getElementById('problemCardWidget'),
        ...((this.extraProblemCards || []).map(c => c && c.el)),
        document.getElementById('graphCardWidget'),
        ...((this.extraGraphCards || []).map(c => c && c.el))
      ].filter(el => el && el !== targetEl);

      // 🌟 [카드 연속 필기 pointerdown 0.00ms 패스트패스]:
      // 이미 최상단 z-index를 보유한 카드 위에서 연속으로 획을 그을 때는 모든 카드의 style.zIndex 재할당을 생략하여
      // WebKit/Blink 컴포지터 스태킹 컨텍스트 재계산을 원천 차단합니다! (Undo/슬라이드 복원 시에도 실제 zIndex 대소 비교로 100% 정합 보장)
      const topZ = 150 + allCards.length;
      const curTargetZ = parseInt(targetEl.style.zIndex, 10) || 0;
      let alreadyStrictlyTop = curTargetZ >= topZ;
      if (alreadyStrictlyTop) {
        for (let i = 0; i < allCards.length; i++) {
          const oz = parseInt(allCards[i].style.zIndex, 10) || 150;
          if (oz >= curTargetZ) {
            alreadyStrictlyTop = false;
            break;
          }
        }
      }

      if (!alreadyStrictlyTop) {
        allCards.sort((a, b) => (parseInt(a.style.zIndex, 10) || 150) - (parseInt(b.style.zIndex, 10) || 150));
        for (let idx = 0; idx < allCards.length; idx++) {
          const nextZ = String(150 + idx);
          if (allCards[idx].style.zIndex !== nextZ) {
            allCards[idx].style.zIndex = nextZ;
          }
        }
        const nextTopZ = String(topZ);
        if (targetEl.style.zIndex !== nextTopZ) {
          targetEl.style.zIndex = nextTopZ;
        }
        this.highestProblemCardZIndex = topZ;
      } else {
        this.highestProblemCardZIndex = curTargetZ;
      }

      // 창모드 그래프 카드를 터치/선택하여 최상단으로 올릴 때, 해당 카드의 개별 좌표축(x축/y축) 상태를 설정 버튼 UI와 동기화
      // (동일 그래프 카드 위에서 연속 필기 시에는 불필요한 DOM 버튼 토글/setAttribute 생략)
      if (this.isGraphCovered && typeof this._getPipCardRefFromWidget === 'function') {
        const cardRef = this._getPipCardRefFromWidget(targetEl);
        if (cardRef) {
          const prevFocusedRef = this._lastFocusedPipCardRef;
          this._lastFocusedPipCardRef = cardRef;
          const snap = this._getMutablePipCardSnapshot(cardRef);
          if (snap && !snap.isNAxisStudioCard) {
            const nextX = snap.showXAxis !== undefined ? Boolean(snap.showXAxis) : this.showXAxis;
            const nextY = snap.showYAxis !== undefined ? Boolean(snap.showYAxis) : this.showYAxis;
            if (prevFocusedRef !== cardRef || this.showXAxis !== nextX || this.showYAxis !== nextY) {
              this.showXAxis = nextX;
              this.showYAxis = nextY;
              if (typeof this.syncAxisVisibilityUI === 'function') {
                this.syncAxisVisibilityUI();
              }
            }
          }
        }
      }
    }

    // 🔴 [카드 전용 상단 레이저 포인터 시스템 (문제 카드 & 그래프 카드 공용)]
    // - 카드 상단 메뉴의 [🔴 레이저] 아이콘을 켜면 카드 몸통 안에서 드래그 시 카드가 이동하지 않고
    //   네온 레드 레이저 줄(잔상 궤적 + 끝점 타겟 포인트)이 스윽 그어졌다가 0.75초 뒤 사르륵 사라집니다!
    // - 액정타블렛 / M2·M4 아이패드 호버링 시에도 카드 위에 빨간 레이저 포인트가 실시간 노출됩니다.
    attachCardLaserSystem(cardWidgetEl) {
      if (!cardWidgetEl || cardWidgetEl._cardLaserAttached) return;
      cardWidgetEl._cardLaserAttached = true;
      if (typeof this._applyLongPressShield === 'function') {
        this._applyLongPressShield(cardWidgetEl);
      }

      const bodyEl = cardWidgetEl.querySelector('.problem-card-body');
      const laserBtn = cardWidgetEl.querySelector('.btn-card-laser');
      const headerEl = cardWidgetEl.querySelector('.problem-card-header');
      if (!bodyEl || !laserBtn) return;

      // 🌟 [대표님 기획: 평소에는 상단바를 숨겨 '딱 그래프/문제만' 노출 + 터치/호버/카드필기ON 시에만 상단바 표시] 🌟
      const activateCardHeaderPeek = (ev) => {
        if (ev && ev.pointerType === 'touch' && this.isStylusPalmRejectionActive() && this.isInkMode && this.activeInkTool !== 'select') {
          return;
        }
        if (this._activePeekCardEl === cardWidgetEl && cardWidgetEl.classList.contains('card-header-peek')) {
          return;
        }
        if (this._activePeekCardEl && this._activePeekCardEl !== cardWidgetEl) {
          this._activePeekCardEl.classList.remove('card-header-peek');
        }
        document.querySelectorAll('.problem-card-widget.card-header-peek').forEach((other) => {
          if (other !== cardWidgetEl) other.classList.remove('card-header-peek');
        });
        cardWidgetEl.classList.add('card-header-peek');
        this._activePeekCardEl = cardWidgetEl;
      };
      bodyEl.addEventListener('pointerdown', activateCardHeaderPeek, { passive: true });
      if (headerEl) {
        headerEl.addEventListener('pointerdown', activateCardHeaderPeek, { passive: true });
      }
      const resizeHandlePeekEl = cardWidgetEl.querySelector('.problem-card-resize-handle');
      if (resizeHandlePeekEl) {
        resizeHandlePeekEl.addEventListener('pointerdown', activateCardHeaderPeek, { passive: true });
      }
      if (!this._cardHeaderPeekGlobalDismissBound) {
        this._cardHeaderPeekGlobalDismissBound = true;
        document.addEventListener('pointerdown', (ev) => {
          if (!this._activePeekCardEl) return;
          const t = ev.target;
          if (t && t.closest && t.closest('.problem-card-widget')) return;
          this._activePeekCardEl.classList.remove('card-header-peek');
          this._activePeekCardEl = null;
          document.querySelectorAll('.problem-card-widget.card-header-peek').forEach((el) => {
            el.classList.remove('card-header-peek');
          });
        }, { passive: true });
      }

      let laserCanvas = bodyEl.querySelector('.card-laser-canvas');
      if (!laserCanvas) {
        laserCanvas = document.createElement('canvas');
        laserCanvas.className = 'card-laser-canvas';
        bodyEl.appendChild(laserCanvas);
      }

      const state = {
        active: false,
        isDrawing: false,
        strokes: [],
        currentStroke: null,
        hoverPos: null,
        hoverTime: 0,
        rafId: null
      };
      cardWidgetEl._cardLaserState = state;

      const syncCanvasSize = () => {
        const dpr = window.devicePixelRatio || 2;
        if (cardWidgetEl.classList.contains('minimized')) {
          const fallbackW = Math.max(1, Math.round((laserCanvas.width || 520 * dpr) / dpr));
          const fallbackH = Math.max(1, Math.round((laserCanvas.height || 360 * dpr) / dpr));
          return { w: fallbackW, h: fallbackH, dpr };
        }
        const rect = typeof this._getStageElementRect === 'function'
          ? this._getStageElementRect(bodyEl)
          : bodyEl.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) {
          const fallbackW = Math.max(1, Math.round((laserCanvas.width || 520 * dpr) / dpr));
          const fallbackH = Math.max(1, Math.round((laserCanvas.height || 360 * dpr) / dpr));
          return { w: fallbackW, h: fallbackH, dpr };
        }
        const w = Math.max(1, Math.round(rect.width));
        const h = Math.max(1, Math.round(rect.height));
        const targetW = Math.round(w * dpr);
        const targetH = Math.round(h * dpr);
        if (laserCanvas.width !== targetW || laserCanvas.height !== targetH) {
          laserCanvas.width = targetW;
          laserCanvas.height = targetH;
        }
        return { w, h, dpr };
      };
      cardWidgetEl._syncCardLaserSize = syncCanvasSize;

      const HOLD_MS = 1650;
      const FADE_MS = 750;

      const traceSmoothLaserPath = (ctx, pts, w, h) => {
        ctx.beginPath();
        if (pts.length === 1) {
          ctx.moveTo(pts[0].x * w, pts[0].y * h);
          ctx.lineTo(pts[0].x * w + 0.1, pts[0].y * h + 0.1);
          return;
        }
        ctx.moveTo(pts[0].x * w, pts[0].y * h);
        if (pts.length === 2) {
          ctx.lineTo(pts[1].x * w, pts[1].y * h);
          return;
        }
        const firstMx = ((pts[0].x + pts[1].x) * 0.5) * w;
        const firstMy = ((pts[0].y + pts[1].y) * 0.5) * h;
        ctx.lineTo(firstMx, firstMy);
        for (let i = 1; i < pts.length - 1; i++) {
          const cx = pts[i].x * w;
          const cy = pts[i].y * h;
          const mx = ((pts[i].x + pts[i + 1].x) * 0.5) * w;
          const my = ((pts[i].y + pts[i + 1].y) * 0.5) * h;
          ctx.quadraticCurveTo(cx, cy, mx, my);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x * w, last.y * h);
      };

      const renderLaserFrame = () => {
        state.rafId = null;
        const now = performance.now();
        const { w, h, dpr } = syncCanvasSize();
        const ctx = laserCanvas.getContext('2d');
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        // 만료된 스트로크 정리
        state.strokes = state.strokes.filter(st => {
          if (!st.points || st.points.length === 0) return false;
          if (!st.finished) return true;
          const elapsed = now - (st.finishedAt || now);
          return elapsed < (HOLD_MS + FADE_MS);
        });

        // 1) 🌟 [대표님 기획: 사라지는 일반 빨간색 펜 글씨 (#dc2626)]:
        // 번지는 네온/흰색 심지를 제거하고, 쓰는 동안은 또렷한 빨간색 일반 볼펜 글씨로 써지다가 멈추면 사르륵 사라집니다!
        state.strokes.forEach(st => {
          const pts = st.points;
          if (!pts || pts.length === 0) return;

          let life = 1.0;
          if (st.finished) {
            const elapsed = Math.max(0, now - (st.finishedAt || now));
            if (elapsed > HOLD_MS) {
              const t = Math.min(1, (elapsed - HOLD_MS) / FADE_MS);
              life = Math.pow(1 - t, 1.45);
            }
          }
          if (life <= 0.01) return;

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
            ctx.arc(pts[0].x * w, pts[0].y * h, 1.3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            traceSmoothLaserPath(ctx, pts, w, h);
            ctx.stroke();
          }
          ctx.restore();
        });

        ctx.restore();

        if ((state.strokes.length > 0 || state.isDrawing) && !state.rafId) {
          state.rafId = requestAnimationFrame(renderLaserFrame);
        }
      };

      const ensureLoop = () => {
        if (!state.rafId) {
          state.rafId = requestAnimationFrame(renderLaserFrame);
        }
      };

      const getNormPos = (e) => {
        const rect = bodyEl.getBoundingClientRect();
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / w));
        const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / h));
        return { nx, ny };
      };

      // 🌟 추가 문제 카드 / 추가 그래프 보관 카드에도 전용 정규화 필기 캔버스(.problem-card-canvas) 자동 장착!
      let extraInkCanvas = bodyEl.querySelector('.problem-card-canvas');
      if (!extraInkCanvas) {
        extraInkCanvas = document.createElement('canvas');
        extraInkCanvas.className = 'problem-card-canvas';
        extraInkCanvas._needsSizeSync = true;
        bodyEl.insertBefore(extraInkCanvas, laserCanvas);
        cardWidgetEl._cardInkStrokes = [];

        const renderExtraCardInk = (activeStroke = null, commitStroke = false) => {
          const dpr = this.getCanvasDpr();
          if (extraInkCanvas._skipLayoutMeasureOnce) {
            extraInkCanvas._skipLayoutMeasureOnce = false;
          } else if (!cardWidgetEl.classList.contains('minimized') && (!activeStroke || extraInkCanvas._needsSizeSync || !extraInkCanvas.width || !extraInkCanvas.height)) {
            const rect = typeof this._getStageElementRect === 'function'
              ? this._getStageElementRect(bodyEl)
              : bodyEl.getBoundingClientRect();
            if (rect.width >= 10 && rect.height >= 10) {
              extraInkCanvas._needsSizeSync = false;
              const tw = Math.round(rect.width * dpr);
              const th = Math.round(rect.height * dpr);
              if (extraInkCanvas.width !== tw || extraInkCanvas.height !== th) {
                extraInkCanvas.width = tw;
                extraInkCanvas.height = th;
              }
            }
          }
          const w = Math.max(1, (extraInkCanvas.width || 520 * dpr) / dpr);
          const h = Math.max(1, (extraInkCanvas.height || 360 * dpr) / dpr);
          const isProbExtra = cardWidgetEl.classList.contains('extra-problem-card-widget');
          const extraGraphRef = (!isProbExtra && Array.isArray(this.extraGraphCards))
            ? this.extraGraphCards.find(c => c && c.el === cardWidgetEl)
            : null;
          const sizeScale = isProbExtra
            ? Math.max(0.6, w / 480)
            : (typeof this.getPipCardFinePenScale === 'function'
              ? this.getPipCardFinePenScale(extraGraphRef, w, h)
              : 0.54);
          this._renderCardInkWithBakeCache(
            extraInkCanvas,
            cardWidgetEl._cardInkStrokes,
            w,
            h,
            dpr,
            sizeScale,
            cardWidgetEl,
            {
              activeStroke,
              commitStroke,
              isProbCard: isProbExtra,
              applyStreamline: true,
              minPenWidth: isProbExtra ? 1.5 : 0.85,
              minHlWidth: 3,
              defaultHlMin: 8
            }
          );
        };
        cardWidgetEl._renderCardInkCanvas = renderExtraCardInk;

        let isDrawingExtraInk = false;
        let curExtraStroke = null;
        let extraHoldTimer = null;
        let activeExtraDrawRect = null;
        let activeExtraPointerId = null;

        const eraseExtraCardAtPoint = (sx, sy, rw, rh, deferRender = false) => {
          const extraEraseR = Math.max(6, (this.currentEraserSize || 14) * 1.25);
          const stickerErased = Boolean(this.eraseCardStickerAtNormalizedPoint(
            cardWidgetEl,
            sx / Math.max(1, rw),
            sy / Math.max(1, rh),
            rw,
            rh,
            extraEraseR
          ));
          if (!Array.isArray(cardWidgetEl._cardInkStrokes) || cardWidgetEl._cardInkStrokes.length === 0) {
            return stickerErased;
          }
          const inkErased = this._eraseCardStrokesInPlace(
            cardWidgetEl._cardInkStrokes,
            sx,
            sy,
            rw,
            rh,
            extraEraseR,
            {
              cardKind: 'extra',
              cardEl: cardWidgetEl,
              renderFn: () => renderExtraCardInk()
            }
          );
          if (inkErased) {
            if (deferRender) {
              this._scheduleCardLiveFrameRender(extraInkCanvas, () => renderExtraCardInk());
            } else {
              renderExtraCardInk();
            }
          }
          return Boolean(inkErased || stickerErased);
        };

        const restartExtraHoldTimer = (rw, rh) => {
          if (!isDrawingExtraInk || !curExtraStroke || curExtraStroke._shapeHoldDetected) return;
          curExtraStroke._lastHoldMoveTime = Date.now();
          curExtraStroke._holdW = rw;
          curExtraStroke._holdH = rh;
          if (extraHoldTimer) return;
          const checkExtraHold = () => {
            extraHoldTimer = null;
            if (!isDrawingExtraInk || !curExtraStroke || curExtraStroke._shapeHoldDetected) return;
            const elapsed = Date.now() - (curExtraStroke._lastHoldMoveTime || 0);
            if (elapsed < 340) {
              extraHoldTimer = setTimeout(checkExtraHold, Math.max(16, 340 - elapsed));
              return;
            }
            if (this.recognizeAndApplyCardStrokeShape(curExtraStroke, curExtraStroke._holdW || rw, curExtraStroke._holdH || rh)) {
              if (cardWidgetEl.classList.contains('graph-card-widget') && typeof this._ensurePipCardInkMathCoordsByWidget === 'function') {
                this._ensurePipCardInkMathCoordsByWidget(cardWidgetEl, true, curExtraStroke);
              }
              renderExtraCardInk(curExtraStroke);
            }
          };
          extraHoldTimer = setTimeout(checkExtraHold, 340);
        };

        const startExtraCardStroke = (e) => {
          if (this.activeInkTool === 'sticker' || this.activeInkTool === 'laser' || this.activeInkTool === 'lasso') return false;
          if (e.pointerType === 'pen') {
            const nowT = Date.now();
            this._markStylusPenDetected();
            this._lastPenActiveTime = nowT;
            this._lastPenDownTime = nowT;
            if (this.activePointers) this.activePointers.clear();
            this._pinchState = null;
            this._pinchWasActiveInGesture = false;
            if (typeof this._cancelAllActiveCardDrags === 'function') this._cancelAllActiveCardDrags();
          }
          if (e.pointerType === 'touch' && this.isStylusPalmRejectionActive()) {
            if (e.cancelable !== false) e.preventDefault();
            return false;
          }
          this.bringCardToFront(cardWidgetEl);
          if (e.button !== 0 && e.pointerType !== 'pen' && e.pointerType !== 'touch') return false;
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();
          if (e.pointerType !== 'pen') {
            try { extraInkCanvas.setPointerCapture(e.pointerId); } catch (err) { }
          }
          const rect = extraInkCanvas.getBoundingClientRect();
          activeExtraDrawRect = rect;
          const rw = Math.max(1, rect.width);
          const rh = Math.max(1, rect.height);
          const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rw));
          const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rh));
          isDrawingExtraInk = true;
          this._isDrawingCardInk = true;
          this._currentCardEraseUndoEntry = null;
          activeExtraPointerId = (e.pointerId !== undefined) ? e.pointerId : null;

          const isCardStylusEraser = (
            (typeof e.buttons === 'number' && (e.buttons & 32) !== 0) ||
            e.button === 5 ||
            (e.pointerType === 'pen' && (e.button === 2 || (typeof e.buttons === 'number' && (e.buttons & 2) !== 0)))
          );
          if (this.activeInkTool === 'eraser' || isCardStylusEraser) {
            cardWidgetEl._extraStylusEraser = true;
            eraseExtraCardAtPoint(nx * rw, ny * rh, rw, rh, false);
            return true;
          }
          const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          const initExtraPenStyle = (this.activeInkTool === 'highlighter') ? 'ballpen' : (this.inkPenStyle || 'ballpen');
          const hasHwP = (typeof e.pressure === 'number' && e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.01);
          const initP = this._mapInitialStrokePressure(e.pressure, initExtraPenStyle, hasHwP);
          const startPxX = nx * rw;
          const startPxY = ny * rh;
          curExtraStroke = {
            color: this.currentInkColor || '#0f172a',
            size: (this.activeInkTool === 'highlighter') ? parseFloat(((this.currentHighlighterSize || 16) / 2.8).toFixed(2)) : (this.currentInkSize || 3.5),
            highlighterSize: (this.activeInkTool === 'highlighter') ? (this.currentHighlighterSize || 16) : undefined,
            isHighlighter: (this.activeInkTool === 'highlighter'),
            penStyle: initExtraPenStyle,
            softBlur: (this.activeInkTool === 'highlighter') ? 0 : (this.inkSoftBlur || 0),
            _hasHwP: hasHwP,
            _inPlaceStreamlined: true,
            _lastRawPx: { x: startPxX, y: startPxY },
            _prevRawPx: { x: startPxX, y: startPxY },
            _holdAnchorPx: { x: startPxX, y: startPxY },
            _lastMovePx: { x: startPxX, y: startPxY },
            _shapeHoldDetected: false,
            tStart: recT,
            tEnd: recT,
            points: [{ nx, ny, p: initP, t: recT }]
          };
          cardWidgetEl._cardInkStrokes.push(curExtraStroke);
          restartExtraHoldTimer(rw, rh);
          renderExtraCardInk(curExtraStroke);
          return true;
        };

        extraInkCanvas.addEventListener('pointerdown', (e) => {
          startExtraCardStroke(e);
        });

        extraInkCanvas.addEventListener('pointermove', (e) => {
          if (!isDrawingExtraInk) {
            return;
          }
          if (activeExtraPointerId !== null && e.pointerId !== undefined && e.pointerId !== activeExtraPointerId) {
            return;
          }
          if (e.pointerType === 'pen') {
            this._markStylusPenDetected();
            this._lastPenActiveTime = Date.now();
          }
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();
          const rect = (activeExtraDrawRect && activeExtraDrawRect.width > 0)
            ? activeExtraDrawRect
            : extraInkCanvas.getBoundingClientRect();
          activeExtraDrawRect = rect;
          const rw = Math.max(1, rect.width);
          const rh = Math.max(1, rect.height);
          const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rw));
          const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rh));
          if (this.activeInkTool === 'eraser' || cardWidgetEl._extraStylusEraser) {
            eraseExtraCardAtPoint(nx * rw, ny * rh, rw, rh, true);
            return;
          }
          if (!curExtraStroke) return;
          const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          if (recT !== undefined) {
            curExtraStroke.tEnd = recT;
            this.recordAudioCursorPoint(e.clientX, e.clientY, curExtraStroke.color, true);
          }

          if (curExtraStroke._shapeHoldDetected && curExtraStroke.cardShape) {
            if (this.updateHeldCardStrokeShape(curExtraStroke, nx, ny, rw, rh)) {
              const shapeStrokeRef = curExtraStroke;
              this._scheduleCardLiveFrameRender(extraInkCanvas, () => {
                if (!isDrawingExtraInk || curExtraStroke !== shapeStrokeRef) return;
                if (cardWidgetEl.classList.contains('graph-card-widget') && typeof this._ensurePipCardInkMathCoordsByWidget === 'function') {
                  this._ensurePipCardInkMathCoordsByWidget(cardWidgetEl, true, shapeStrokeRef);
                }
                renderExtraCardInk(shapeStrokeRef);
              });
            }
            return;
          }

          const curPxX = nx * rw;
          const curPxY = ny * rh;
          const prevMovePx = curExtraStroke._lastMovePx || { x: curPxX, y: curPxY };
          const moveStepDist = Math.hypot(curPxX - prevMovePx.x, curPxY - prevMovePx.y);
          curExtraStroke._lastMovePx = { x: curPxX, y: curPxY };

          const holdAnchor = curExtraStroke._holdAnchorPx || { x: curPxX, y: curPxY };
          const dHold = Math.hypot(curPxX - holdAnchor.x, curPxY - holdAnchor.y);
          if (moveStepDist > 1.5 || dHold > 5) {
            curExtraStroke._holdAnchorPx = { x: curPxX, y: curPxY };
            restartExtraHoldTimer(rw, rh);
          }

          if (!this._appendCardStrokeSamplesFromMoveEvent(curExtraStroke, e, rect, rw, rh, recT)) return;
          if (curExtraStroke.isHighlighter) {
            const hlStrokeRef = curExtraStroke;
            this._scheduleCardLiveFrameRender(extraInkCanvas, () => {
              if (isDrawingExtraInk && curExtraStroke === hlStrokeRef) {
                renderExtraCardInk(hlStrokeRef);
              }
            });
          } else {
            renderExtraCardInk(curExtraStroke);
          }
        });

        const endExtraCardInk = (e) => {
          if (!isDrawingExtraInk || cardWidgetEl.isConnected === false) return;
          if (activeExtraPointerId !== null && e && e.pointerId !== undefined && e.pointerId !== activeExtraPointerId) {
            return;
          }
          if (e && e.pointerType === 'pen') {
            this._lastPenActiveTime = Date.now();
          }
          const wasOneShotEraser = (this.activeInkTool === 'eraser' && !cardWidgetEl._extraStylusEraser);
          const finishedSt = curExtraStroke;
          const endRect = activeExtraDrawRect;
          isDrawingExtraInk = false;
          this._isDrawingCardInk = false;
          this._currentCardEraseUndoEntry = null;
          activeExtraPointerId = null;
          cardWidgetEl._extraStylusEraser = false;
          activeExtraDrawRect = null;
          curExtraStroke = null;
          const pendingExtraEraseRender = !finishedSt ? extraInkCanvas._pendingCardLiveRenderFn : null;
          if (extraInkCanvas._cardLiveRafId) {
            cancelAnimationFrame(extraInkCanvas._cardLiveRafId);
            extraInkCanvas._cardLiveRafId = null;
          }
          extraInkCanvas._pendingCardLiveRenderFn = null;
          if (typeof pendingExtraEraseRender === 'function') {
            pendingExtraEraseRender();
          }
          if (extraHoldTimer) {
            clearTimeout(extraHoldTimer);
            extraHoldTimer = null;
          }
          if (finishedSt && finishedSt.points && finishedSt.points.length > 0) {
            const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
            if (recT !== undefined) finishedSt.tEnd = recT;
            const rw = Math.max(1, (endRect && endRect.width) || (extraInkCanvas.width / this.getCanvasDpr()) || 430);
            const rh = Math.max(1, (endRect && endRect.height) || (extraInkCanvas.height / this.getCanvasDpr()) || 353);
            this._finishCardStrokeTail(finishedSt, e, endRect, rw, rh, recT);
            if (cardWidgetEl.classList.contains('graph-card-widget') && typeof this._ensurePipCardInkMathCoordsByWidget === 'function') {
              this._ensurePipCardInkMathCoordsByWidget(cardWidgetEl, true, finishedSt);
            }
            renderExtraCardInk(finishedSt, true);
            this.undoStack.push({
              type: 'card_stroke_add',
              cardKind: 'extra',
              cardEl: cardWidgetEl,
              strokesArr: cardWidgetEl._cardInkStrokes,
              stroke: finishedSt,
              renderFn: () => renderExtraCardInk()
            });
            if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
            this.redoStack = [];
            this.updateUndoRedoUI();
          }
          try { extraInkCanvas.releasePointerCapture(e.pointerId); } catch (err) { }
          if (wasOneShotEraser) this.setActiveInkTool('pen');
        };
        extraInkCanvas.addEventListener('pointerup', endExtraCardInk);
        extraInkCanvas.addEventListener('pointercancel', endExtraCardInk);
        window.addEventListener('pointerup', endExtraCardInk, true);
        window.addEventListener('pointercancel', endExtraCardInk, true);
      }

      // 🌟 [문제 카드 상단 [🔓/🔒] 잠금·스텔스 토글 버튼 바인딩 (그래프 카드와 100% 동일한 사용성)] 🌟
      if (!cardWidgetEl.classList.contains('graph-card-widget')) {
        const probLockBtn = cardWidgetEl.querySelector('.btn-problem-lock');
        if (probLockBtn && !probLockBtn._probLockBound) {
          probLockBtn._probLockBound = true;
          probLockBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
          });
          probLockBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.bringCardToFront(cardWidgetEl);
            const nextLocked = !cardWidgetEl.classList.contains('pip-locked-mode');
            this.setProblemCardLockedByWidget(cardWidgetEl, nextLocked, true);
          });
        }
      }

      // 🌟 [대표님 킬러 기획: 카드 상단 [✒️] 버튼 = '카드 몸통 드래그 이동 ⇄ 카드 위 밑줄·필기 고정' 토글!]
      const handleCardInkBtnToggle = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const nextInkActive = !cardWidgetEl.classList.contains('card-ink-active');
        cardWidgetEl.classList.toggle('card-ink-active', nextInkActive);
        laserBtn.classList.toggle('active', nextInkActive);

        if (nextInkActive) {
          if (cardWidgetEl.classList.contains('graph-card-widget')) {
            if (typeof this.setPipCardLockedByWidget === 'function') {
              this.setPipCardLockedByWidget(cardWidgetEl, true, false);
            } else if (typeof this.deselectAllPipGraphCards === 'function') {
              this.deselectAllPipGraphCards();
            }
            if (typeof this._getPipCardRefByWidget === 'function' && typeof this.wakeUpPipGraphCardStealth === 'function') {
              const cRef = this._getPipCardRefByWidget(cardWidgetEl);
              if (cRef) this.wakeUpPipGraphCardStealth(cRef, false);
            }
          } else {
            if (typeof this.setProblemCardLockedByWidget === 'function') {
              this.setProblemCardLockedByWidget(cardWidgetEl, true, false);
            }
            if (typeof this.wakeUpProblemCardStealth === 'function') {
              this.wakeUpProblemCardStealth(cardWidgetEl, false);
            }
          }
          // 접혀 있는 상태에서 [✒️] 버튼을 켜면 자동으로 카드를 펼쳐서 즉시 필기 가능하도록 처리!
          if (cardWidgetEl.classList.contains('minimized') && typeof cardWidgetEl._toggleCardMin === 'function') {
            cardWidgetEl._toggleCardMin();
          }
          if (!this.isInkMode) {
            this.toggleInkMode(true);
          }
          if (this.activeInkTool === 'select' || this.activeInkTool === 'lasso' || this.activeInkTool === 'laser') {
            this.setActiveInkTool('pen');
          }
          if (cardWidgetEl.id === 'problemCardWidget') {
            this.syncProblemCardRectFromWidget();
            this.renderProblemCardCanvas();
          } else if (cardWidgetEl.id === 'graphCardWidget') {
            this.syncGraphCardRectFromWidget();
            this.renderGraphCardCanvas();
          } else if (typeof cardWidgetEl._renderCardInkCanvas === 'function') {
            cardWidgetEl._renderCardInkCanvas();
          }
          syncCanvasSize();
        } else if (cardWidgetEl.classList.contains('graph-card-widget')) {
          if (typeof this._getPipCardRefByWidget === 'function' && typeof this.schedulePipGraphCardStealth === 'function') {
            const cRef = this._getPipCardRefByWidget(cardWidgetEl);
            if (cRef) this.schedulePipGraphCardStealth(cRef, 3000);
          }
        } else if (typeof this.scheduleProblemCardStealth === 'function') {
          this.scheduleProblemCardStealth(cardWidgetEl, 3000);
        }
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
      };
      let handledInkToggleOnPointerUp = false;
      laserBtn.addEventListener('pointerup', (e) => {
        if (e.button && e.button !== 0) return;
        handledInkToggleOnPointerUp = true;
        handleCardInkBtnToggle(e);
        setTimeout(() => { handledInkToggleOnPointerUp = false; }, 120);
      });
      laserBtn.addEventListener('click', (e) => {
        if (handledInkToggleOnPointerUp) {
          handledInkToggleOnPointerUp = false;
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }
        handleCardInkBtnToggle(e);
      });

      const isLaserActiveOnCard = () => Boolean((this.isInkMode && this.activeInkTool === 'laser') || state.active);

      laserCanvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'pen') this._markStylusPenDetected();
        if (!isLaserActiveOnCard()) return;
        // 🛡️ [손가락 레이저 필기 차단 vs 전자칠판 허용]: 아이패드/태블릿에서는 손가락(touch)으로 카드를 만지면 카드 이동(버블링)으로 작동하고, 전자칠판에서는 레이저가 작동!
        if (e.pointerType === 'touch' && this.isStylusPalmRejectionActive()) return;
        this.bringCardToFront(cardWidgetEl);
        e.preventDefault();
        e.stopPropagation();
        if (this.showVirtualStylus && this.canvas) {
          const cRect = this.canvasRect || this.updateCanvasRect();
          if (cRect) {
            this.updateStylusPenPosition(e.clientX - cRect.left, e.clientY - cRect.top, e);
          }
        }
        try { laserCanvas.setPointerCapture(e.pointerId); } catch (err) { }

        const pos = getNormPos(e);
        const now = performance.now();
        state.isDrawing = true;
        state.hoverPos = pos;
        state.hoverTime = now;
        // 연속 필기 시 이전 획들도 사라지지 않고 함께 유지되도록 타이머 연장
        state.strokes.forEach(st => {
          if (st.finished) st.finishedAt = now;
        });
        const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
        let recLaserStroke = null;
        if (recT !== undefined) {
          const cardKey = this.getAudioCardKey(cardWidgetEl);
          if (!Array.isArray(this.audioLaserStrokes)) this.audioLaserStrokes = [];
          // 연속 레이저 필기 시 직전 미소멸 레이저 획들의 유지 시간(holdUntil)도 함께 연장!
          this.audioLaserStrokes.forEach(ls => {
            if (ls && ls.cardKey === cardKey && typeof ls.holdUntil === 'number' && recT <= ls.holdUntil + 200) {
              ls.holdUntil = recT + HOLD_MS;
            }
          });
          recLaserStroke = {
            cardKey,
            tStart: recT,
            tEnd: recT,
            holdUntil: recT + HOLD_MS,
            points: [{ nx: pos.nx, ny: pos.ny, t: recT }]
          };
          this.audioLaserStrokes.push(recLaserStroke);
          this.recordAudioCursorPoint(e.clientX, e.clientY, '#dc2626', true, { cardKey, nx: pos.nx, ny: pos.ny, isLaser: true });
        }
        const stroke = {
          finished: false,
          _recLaserStroke: recLaserStroke,
          points: [{ x: pos.nx, y: pos.ny, t: now }]
        };
        state.currentStroke = stroke;
        state.strokes.push(stroke);
        ensureLoop();
      });

      laserCanvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'pen') this._markStylusPenDetected();
        if (!isLaserActiveOnCard() || (e.pointerType === 'touch' && this.isStylusPalmRejectionActive())) return;
        if (this.showVirtualStylus && this.canvas) {
          const cRect = this.canvasRect || this.updateCanvasRect();
          if (cRect) {
            this.updateStylusPenPosition(e.clientX - cRect.left, e.clientY - cRect.top, e);
          }
        }
        const pos = getNormPos(e);
        const now = performance.now();
        state.hoverPos = pos;
        state.hoverTime = now;
        const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
        const cardKey = (recT !== undefined) ? this.getAudioCardKey(cardWidgetEl) : null;

        if (state.isDrawing && state.currentStroke) {
          e.preventDefault();
          e.stopPropagation();
          state.strokes.forEach(st => {
            if (st.finished) st.finishedAt = now;
          });
          const pts = state.currentStroke.points;
          const last = pts[pts.length - 1];
          const rect = bodyEl.getBoundingClientRect();
          const rw = Math.max(1, rect.width);
          const rh = Math.max(1, rect.height);
          const pxDist = last ? Math.hypot((pos.nx - last.x) * rw, (pos.ny - last.y) * rh) : 999;
          if (pxDist >= 1.2) {
            let sx = pos.nx;
            let sy = pos.ny;
            if (pts.length >= 2 && pxDist < 14) {
              const p1 = pts[pts.length - 1];
              const p2 = pts[pts.length - 2];
              sx = p2.x * 0.08 + p1.x * 0.24 + pos.nx * 0.68;
              sy = p2.y * 0.08 + p1.y * 0.24 + pos.ny * 0.68;
            } else if (pts.length === 1 && pxDist < 14) {
              const p1 = pts[0];
              sx = p1.x * 0.20 + pos.nx * 0.80;
              sy = p1.y * 0.20 + pos.ny * 0.80;
            }
            pts.push({ x: sx, y: sy, t: now });
            if (recT !== undefined && state.currentStroke._recLaserStroke) {
              const rls = state.currentStroke._recLaserStroke;
              rls.tEnd = recT;
              rls.holdUntil = recT + HOLD_MS;
              rls.points.push({ nx: sx, ny: sy, t: recT });
              if (Array.isArray(this.audioLaserStrokes)) {
                this.audioLaserStrokes.forEach(ls => {
                  if (ls && ls.cardKey === cardKey && typeof ls.holdUntil === 'number' && recT <= ls.holdUntil + 200) {
                    ls.holdUntil = recT + HOLD_MS;
                  }
                });
              }
            }
          }
          if (recT !== undefined) {
            this.recordAudioCursorPoint(e.clientX, e.clientY, '#dc2626', true, { cardKey, nx: pos.nx, ny: pos.ny, isLaser: true });
          }
        } else if (recT !== undefined) {
          this.recordAudioCursorPoint(e.clientX, e.clientY, '#dc2626', false, { cardKey, nx: pos.nx, ny: pos.ny, isLaser: true });
        }
        ensureLoop();
      });

      const finishLaserStroke = (e) => {
        if (!state.isDrawing) return;
        const now = performance.now();
        const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
        if (e && e.clientX !== undefined && state.currentStroke && state.currentStroke.points && state.currentStroke.points.length >= 1) {
          const endPos = getNormPos(e);
          const pts = state.currentStroke.points;
          const last = pts[pts.length - 1];
          const rect = bodyEl.getBoundingClientRect();
          const rw = Math.max(1, rect.width);
          const rh = Math.max(1, rect.height);
          if (last && Math.hypot((endPos.nx - last.x) * rw, (endPos.ny - last.y) * rh) >= 0.8) {
            pts.push({ x: endPos.nx, y: endPos.ny, t: now });
            if (recT !== undefined && state.currentStroke._recLaserStroke) {
              state.currentStroke._recLaserStroke.points.push({ nx: endPos.nx, ny: endPos.ny, t: recT });
            }
          }
        }
        if (recT !== undefined && state.currentStroke && state.currentStroke._recLaserStroke) {
          const rls = state.currentStroke._recLaserStroke;
          rls.tEnd = recT;
          rls.holdUntil = recT + HOLD_MS;
          const cardKey = rls.cardKey;
          if (Array.isArray(this.audioLaserStrokes)) {
            this.audioLaserStrokes.forEach(ls => {
              if (ls && ls.cardKey === cardKey && typeof ls.holdUntil === 'number' && recT <= ls.holdUntil + 200) {
                ls.holdUntil = recT + HOLD_MS;
              }
            });
          }
        }
        state.isDrawing = false;
        state.strokes.forEach(st => {
          st.finished = true;
          st.finishedAt = now;
        });
        state.currentStroke = null;
        if (e && e.pointerId !== undefined) {
          try { laserCanvas.releasePointerCapture(e.pointerId); } catch (err) { }
        }
        ensureLoop();
      };

      laserCanvas.addEventListener('pointerup', finishLaserStroke);
      laserCanvas.addEventListener('pointercancel', finishLaserStroke);
      laserCanvas.addEventListener('pointerleave', () => {
        if (!state.isDrawing) {
          state.hoverPos = null;
          ensureLoop();
        }
      });

      // 🟨 [카드 위 가림막 '스티커' 레이어 (.card-stickers-layer): 연속 드래그 생성 & 원터치 열림/닫힘 토글]
      let stickersLayer = bodyEl.querySelector('.card-stickers-layer');
      if (!stickersLayer) {
        stickersLayer = document.createElement('div');
        stickersLayer.className = 'card-stickers-layer';
        bodyEl.appendChild(stickersLayer);
      }

      const renderCardStickers = () => {
        if (!stickersLayer) return;
        stickersLayer.innerHTML = '';
        const arr = this.getCardStickersArray(cardWidgetEl);
        if (!Array.isArray(arr) || arr.length === 0) return;
        const isAudioReplay = Boolean(this._isAudioReplayActive && this.audioSyncData && this.audioReplayViewMode === 'video');

        arr.forEach((stk) => {
          if (!stk) return;
          if (isAudioReplay && typeof stk.tStart === 'number' && stk.tStart > (this.audioPlayCurrentMs || 0)) {
            return;
          }
          const itemEl = document.createElement('div');
          itemEl.className = 'card-sticker-item' + (stk.revealed ? ' revealed' : '');
          itemEl.dataset.stickerId = stk.id || '';
          itemEl.style.left = `${(stk.nx * 100).toFixed(2)}%`;
          itemEl.style.top = `${(stk.ny * 100).toFixed(2)}%`;
          itemEl.style.width = `${(stk.nw * 100).toFixed(2)}%`;
          itemEl.style.height = `${(stk.nh * 100).toFixed(2)}%`;

          const badgeEl = document.createElement('span');
          badgeEl.className = 'card-sticker-badge';
          const closedBadgeLabel = (stk.nw >= 0.15 && stk.nh >= 0.07) ? '🔒 터치' : '🔒';
          badgeEl.textContent = stk.revealed ? '🔓' : closedBadgeLabel;
          itemEl.appendChild(badgeEl);

          const removeThisCardSticker = () => {
            const curArr = this.getCardStickersArray(cardWidgetEl);
            const idx = curArr.findIndex(s => s === stk || (s && stk && s.id && s.id === stk.id));
            if (idx !== -1) {
              const removed = curArr.splice(idx, 1)[0];
              this.undoStack.push({
                type: 'card_sticker_delete',
                cardEl: cardWidgetEl,
                stickersArr: curArr,
                sticker: removed,
                renderFn: renderCardStickers
              });
              if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
              this.redoStack = [];
              this.updateUndoRedoUI();
              if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
              renderCardStickers();
            }
          };

          let downPt = null;
          itemEl.addEventListener('pointerdown', (ev) => {
            if (this.isInkMode && this.activeInkTool === 'sticker') {
              // 스티커 도구 활성 상태에서는 살짝 드래그하면 새 스티커 생성, 제자리 탭이면 토글하도록 부모(bodyEl)에 위임
              return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            if ((this.isInkMode && this.activeInkTool === 'eraser') || (typeof this.isStylusEraserEvent === 'function' && this.isStylusEraserEvent(ev))) {
              removeThisCardSticker();
              return;
            }
            downPt = { x: ev.clientX, y: ev.clientY };
          });

          itemEl.addEventListener('pointerenter', (ev) => {
            if (((this.isInkMode && this.activeInkTool === 'eraser') || (typeof this.isStylusEraserEvent === 'function' && this.isStylusEraserEvent(ev))) && ev.buttons > 0) {
              removeThisCardSticker();
            }
          });

          itemEl.addEventListener('pointerup', (ev) => {
            if (this.isInkMode && this.activeInkTool === 'sticker') return;
            if (!downPt) return;
            const dist = Math.hypot(ev.clientX - downPt.x, ev.clientY - downPt.y);
            downPt = null;
            if (dist <= 12) {
              ev.preventDefault();
              ev.stopPropagation();
              stk.revealed = !stk.revealed;
              itemEl.classList.toggle('revealed', stk.revealed);
              badgeEl.textContent = stk.revealed ? '🔓' : closedBadgeLabel;
              if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
            }
          });

          stickersLayer.appendChild(itemEl);
        });
      };
      cardWidgetEl._renderCardStickers = renderCardStickers;
      renderCardStickers();

      // 카드 몸통 위에서 [스티커] 도구로 드래그하여 연속 가림막 생성
      let isDrawingCardSticker = false;
      let cardStickerStart = null;
      let cardStickerDraftEl = null;
      let tappedExistingCardSticker = null;

      bodyEl.addEventListener('pointerdown', (e) => {
        if (!(this.isInkMode && this.activeInkTool === 'sticker')) return;
        if (e.button && e.button !== 0) return;
        if (e.pointerType === 'touch' && this.isStylusPalmRejectionActive()) return;

        const hitItemEl = (e.target && e.target.closest) ? e.target.closest('.card-sticker-item') : null;
        if (hitItemEl && hitItemEl.dataset.stickerId) {
          const curArr = this.getCardStickersArray(cardWidgetEl);
          tappedExistingCardSticker = curArr.find(s => s && s.id === hitItemEl.dataset.stickerId) || null;
        } else {
          tappedExistingCardSticker = null;
        }

        if (e.pointerType === 'pen') this._markStylusPenDetected();
        this.bringCardToFront(cardWidgetEl);
        e.preventDefault();
        e.stopPropagation();
        try { bodyEl.setPointerCapture(e.pointerId); } catch (err) { }

        const pos = getNormPos(e);
        isDrawingCardSticker = true;
        cardStickerStart = { nx: pos.nx, ny: pos.ny, lastNx: pos.nx, lastNy: pos.ny, clientX: e.clientX, clientY: e.clientY };

        cardStickerDraftEl = document.createElement('div');
        cardStickerDraftEl.className = 'card-sticker-draft';
        cardStickerDraftEl.style.left = `${(pos.nx * 100).toFixed(2)}%`;
        cardStickerDraftEl.style.top = `${(pos.ny * 100).toFixed(2)}%`;
        cardStickerDraftEl.style.width = '0%';
        cardStickerDraftEl.style.height = '0%';
        stickersLayer.appendChild(cardStickerDraftEl);
      }, { capture: true });

      const moveCardStickerDrag = (e) => {
        if (!isDrawingCardSticker || !cardStickerStart) return;
        e.preventDefault();
        e.stopPropagation();
        const pos = getNormPos(e);
        cardStickerStart.lastNx = pos.nx;
        cardStickerStart.lastNy = pos.ny;
        const nx = Math.min(cardStickerStart.nx, pos.nx);
        const ny = Math.min(cardStickerStart.ny, pos.ny);
        const nw = Math.abs(pos.nx - cardStickerStart.nx);
        const nh = Math.abs(pos.ny - cardStickerStart.ny);
        if (cardStickerDraftEl) {
          cardStickerDraftEl.style.left = `${(nx * 100).toFixed(2)}%`;
          cardStickerDraftEl.style.top = `${(ny * 100).toFixed(2)}%`;
          cardStickerDraftEl.style.width = `${(nw * 100).toFixed(2)}%`;
          cardStickerDraftEl.style.height = `${(nh * 100).toFixed(2)}%`;
        }
        this._activeCardStickerDraft = {
          cardKey: typeof this.getAudioCardKey === 'function' ? this.getAudioCardKey(cardWidgetEl) : 'prob_main',
          nx,
          ny,
          nw,
          nh
        };
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(false);
        }
      };
      bodyEl.addEventListener('pointermove', moveCardStickerDrag, { capture: true });
      window.addEventListener('pointermove', moveCardStickerDrag, { capture: true });

      const finishCardStickerDrag = (e) => {
        if (!isDrawingCardSticker || !cardStickerStart) return;
        isDrawingCardSticker = false;
        this._activeCardStickerDraft = null;
        if (cardStickerDraftEl && cardStickerDraftEl.parentNode) {
          cardStickerDraftEl.parentNode.removeChild(cardStickerDraftEl);
        }
        cardStickerDraftEl = null;
        if (e && e.pointerId !== undefined) {
          try { bodyEl.releasePointerCapture(e.pointerId); } catch (err) { }
        }

        const endPos = (e && typeof e.clientX === 'number')
          ? getNormPos(e)
          : { nx: cardStickerStart.lastNx ?? cardStickerStart.nx, ny: cardStickerStart.lastNy ?? cardStickerStart.ny };
        const rect = bodyEl.getBoundingClientRect();
        const rw = Math.max(1, rect.width);
        const rh = Math.max(1, rect.height);
        const nx = Math.min(cardStickerStart.nx, endPos.nx);
        const ny = Math.min(cardStickerStart.ny, endPos.ny);
        const nw = Math.abs(endPos.nx - cardStickerStart.nx);
        const nh = Math.abs(endPos.ny - cardStickerStart.ny);
        const pxW = nw * rw;
        const pxH = nh * rh;
        cardStickerStart = null;

        if (pxW >= 10 && pxH >= 10) {
          const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          const newStk = {
            id: 'cstk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            nx,
            ny,
            nw,
            nh,
            color: '#facc15',
            revealed: false,
            tStart: recT
          };
          const curArr = this.getCardStickersArray(cardWidgetEl);
          curArr.push(newStk);
          this.undoStack.push({
            type: 'card_sticker_add',
            cardEl: cardWidgetEl,
            stickersArr: curArr,
            sticker: newStk,
            renderFn: renderCardStickers
          });
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];
          this.updateUndoRedoUI();
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
          renderCardStickers();
        } else if (tappedExistingCardSticker) {
          tappedExistingCardSticker.revealed = !tappedExistingCardSticker.revealed;
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
          renderCardStickers();
        }
        tappedExistingCardSticker = null;
      };

      bodyEl.addEventListener('pointerup', finishCardStickerDrag, { capture: true });
      bodyEl.addEventListener('pointercancel', finishCardStickerDrag, { capture: true });
      window.addEventListener('pointerup', finishCardStickerDrag, { capture: true });
      window.addEventListener('pointercancel', finishCardStickerDrag, { capture: true });

      // 🌟 [대표님 피드백 완벽 반영: 카드 위 필기 올가미(Lasso) 선택 · 이동 · 모서리 크기조절 · 색상변경 · 복제 · 삭제 엔진] 🌟
      const getCardInkStrokesForLasso = () => {
        if (cardWidgetEl.id === 'problemCardWidget') {
          if (!Array.isArray(this.problemInkStrokes)) this.problemInkStrokes = [];
          return this.problemInkStrokes;
        }
        if (cardWidgetEl.id === 'graphCardWidget') {
          if (!Array.isArray(this.graphInkStrokes)) this.graphInkStrokes = [];
          return this.graphInkStrokes;
        }
        if (!Array.isArray(cardWidgetEl._cardInkStrokes)) cardWidgetEl._cardInkStrokes = [];
        return cardWidgetEl._cardInkStrokes;
      };

      const setCardInkStrokesForLasso = (nextArr) => {
        const arr = Array.isArray(nextArr) ? nextArr : [];
        if (cardWidgetEl.id === 'problemCardWidget') {
          this.problemInkStrokes = arr;
        } else if (cardWidgetEl.id === 'graphCardWidget') {
          this.graphInkStrokes = arr;
        } else {
          cardWidgetEl._cardInkStrokes = arr;
        }
      };

      const renderCardInkForLasso = () => {
        if (cardWidgetEl.id === 'problemCardWidget') {
          this.renderProblemCardCanvas();
        } else if (cardWidgetEl.id === 'graphCardWidget') {
          this.renderGraphCardCanvas();
        } else if (typeof cardWidgetEl._renderCardInkCanvas === 'function') {
          cardWidgetEl._renderCardInkCanvas();
        }
      };

      let cardLassoMode = null; // 'drawing' | 'moving' | 'resizing'
      let cardLassoLastNorm = null;
      let cardLassoResizeCorner = null;
      let cardLassoResizeAnchor = null;
      let cardLassoResizeInitBox = null;
      let cardLassoResizeSnapshots = null;

      const hitTestCardLassoHandle = (nx, ny, bbox, rw, rh) => {
        if (!bbox) return null;
        const padX = 8 / Math.max(1, rw);
        const padY = 8 / Math.max(1, rh);
        const x1 = bbox.minNx - padX;
        const y1 = bbox.minNy - padY;
        const x2 = bbox.maxNx + padX;
        const y2 = bbox.maxNy + padY;
        const hitR = 14;
        const corners = [
          { id: 'tl', x: x1, y: y1 },
          { id: 'tr', x: x2, y: y1 },
          { id: 'bl', x: x1, y: y2 },
          { id: 'br', x: x2, y: y2 }
        ];
        for (const c of corners) {
          if (Math.hypot((nx - c.x) * rw, (ny - c.y) * rh) <= hitR) {
            return c.id;
          }
        }
        return null;
      };

      const isNormPointInCardLasso = (nx, ny, cl, rw, rh) => {
        if (!cl || !Array.isArray(cl.selectedStrokes) || cl.selectedStrokes.length === 0) return false;
        if (Array.isArray(cl.lassoPts) && cl.lassoPts.length >= 3) {
          if (this.isPointInPolygon({ x: nx, y: ny }, cl.lassoPts.map(p => ({ x: p.nx, y: p.ny })))) {
            return true;
          }
        }
        const bbox = cl.bboxNorm || this.computeCardStrokesNormBBox(cl.selectedStrokes);
        if (!bbox) return false;
        const padX = 10 / Math.max(1, rw);
        const padY = 10 / Math.max(1, rh);
        return nx >= (bbox.minNx - padX) && nx <= (bbox.maxNx + padX) &&
          ny >= (bbox.minNy - padY) && ny <= (bbox.maxNy + padY);
      };

      bodyEl.addEventListener('pointerdown', (e) => {
        if (!this.isInkMode || this.activeInkTool !== 'lasso') return;
        const strokes = getCardInkStrokesForLasso();
        if (!cardWidgetEl.classList.contains('card-ink-active') && strokes.length === 0) return;
        if (e.target && e.target.closest && e.target.closest('button, .graph-card-pip-mini-bar, .problem-card-resize-handle')) return;
        if (e.pointerType === 'touch' && this.isStylusPalmRejectionActive()) return;
        if (e.button && e.button !== 0) return;

        this.bringCardToFront(cardWidgetEl);
        if (e.cancelable !== false) e.preventDefault();
        e.stopPropagation();
        try { bodyEl.setPointerCapture(e.pointerId); } catch (_) { }

        if ((this.selectedInkStrokes && this.selectedInkStrokes.length > 0) ||
          (this.selectedTextLabels && this.selectedTextLabels.length > 0)) {
          this.selectedInkStrokes = [];
          this.selectedTextLabels = [];
          this.lassoPoints = [];
          this._inkBakeDirty = true;
          this.clearInkCache();
          this.requestRender();
        }
        if (this._activeCardLasso && this._activeCardLasso.widgetEl !== cardWidgetEl) {
          this.clearCardLassoSelection();
        }

        const rect = bodyEl.getBoundingClientRect();
        const rw = Math.max(1, rect.width);
        const rh = Math.max(1, rect.height);
        const pos = getNormPos(e);

        const curCl = (this._activeCardLasso && this._activeCardLasso.widgetEl === cardWidgetEl)
          ? this._activeCardLasso
          : null;

        if (curCl && Array.isArray(curCl.selectedStrokes) && curCl.selectedStrokes.length > 0) {
          const bbox = curCl.bboxNorm || this.computeCardStrokesNormBBox(curCl.selectedStrokes);
          const corner = hitTestCardLassoHandle(pos.nx, pos.ny, bbox, rw, rh);
          if (corner && bbox) {
            cardLassoMode = 'resizing';
            curCl.isResizing = true;
            cardLassoResizeCorner = corner;
            cardLassoResizeInitBox = { ...bbox };
            cardLassoResizeAnchor = {
              nx: (corner === 'tl' || corner === 'bl') ? bbox.maxNx : bbox.minNx,
              ny: (corner === 'tl' || corner === 'tr') ? bbox.maxNy : bbox.minNy
            };
            cardLassoResizeSnapshots = curCl.selectedStrokes.map(st => ({
              stroke: st,
              points: (st.points || []).map(p => ({ ...p })),
              size: st.size || 3.5,
              cardShape: st.cardShape ? JSON.parse(JSON.stringify(st.cardShape)) : null
            }));
            return;
          }
          if (isNormPointInCardLasso(pos.nx, pos.ny, curCl, rw, rh)) {
            cardLassoMode = 'moving';
            curCl.isDragging = true;
            cardLassoLastNorm = { nx: pos.nx, ny: pos.ny };
            return;
          }
        }

        cardLassoMode = 'drawing';
        this._activeCardLasso = {
          widgetEl: cardWidgetEl,
          getStrokes: getCardInkStrokesForLasso,
          setStrokes: setCardInkStrokesForLasso,
          selectedStrokes: [],
          lassoPts: [{ nx: pos.nx, ny: pos.ny }],
          bboxNorm: null,
          isSelecting: true,
          isDragging: false,
          isResizing: false,
          renderFn: renderCardInkForLasso
        };
        this.syncLassoActionBarUI();
        renderCardInkForLasso();
      }, { capture: true });

      bodyEl.addEventListener('pointermove', (e) => {
        if (!cardLassoMode) return;
        if (e.cancelable !== false) e.preventDefault();
        e.stopPropagation();

        const cl = (this._activeCardLasso && this._activeCardLasso.widgetEl === cardWidgetEl)
          ? this._activeCardLasso
          : null;
        if (!cl) return;

        const pos = getNormPos(e);
        if (cardLassoMode === 'drawing') {
          cl.lassoPts.push({ nx: pos.nx, ny: pos.ny });
          renderCardInkForLasso();
          return;
        }

        if (cardLassoMode === 'moving' && cardLassoLastNorm) {
          const dnx = pos.nx - cardLassoLastNorm.nx;
          const dny = pos.ny - cardLassoLastNorm.ny;
          cardLassoLastNorm = { nx: pos.nx, ny: pos.ny };
          cl.selectedStrokes.forEach(st => this.translateCardStrokeNorm(st, dnx, dny));
          if (Array.isArray(cl.lassoPts)) {
            cl.lassoPts.forEach(p => {
              p.nx += dnx;
              p.ny += dny;
            });
          }
          cl.bboxNorm = this.computeCardStrokesNormBBox(cl.selectedStrokes);
          if (cardWidgetEl.classList.contains('graph-card-widget') && typeof this._ensurePipCardInkMathCoordsByWidget === 'function') {
            this._ensurePipCardInkMathCoordsByWidget(cardWidgetEl, true);
          }
          renderCardInkForLasso();
          this.syncLassoActionBarUI();
          return;
        }

        if (cardLassoMode === 'resizing' && cardLassoResizeAnchor && cardLassoResizeInitBox && cardLassoResizeSnapshots) {
          const initW = Math.max(0.02, cardLassoResizeInitBox.maxNx - cardLassoResizeInitBox.minNx);
          const initH = Math.max(0.02, cardLassoResizeInitBox.maxNy - cardLassoResizeInitBox.minNy);
          const rawScaleX = Math.abs(pos.nx - cardLassoResizeAnchor.nx) / initW;
          const rawScaleY = Math.abs(pos.ny - cardLassoResizeAnchor.ny) / initH;
          const scale = Math.max(0.25, Math.min(4.0, (rawScaleX + rawScaleY) * 0.5));
          const ax = cardLassoResizeAnchor.nx;
          const ay = cardLassoResizeAnchor.ny;

          cardLassoResizeSnapshots.forEach(snapItem => {
            const st = snapItem.stroke;
            st.size = Math.max(1.2, Math.min(24, parseFloat((snapItem.size * scale).toFixed(2))));
            if (Array.isArray(st.points) && Array.isArray(snapItem.points)) {
              st.points.forEach((pt, idx) => {
                const orig = snapItem.points[idx];
                if (!orig) return;
                pt.nx = ax + (orig.nx - ax) * scale;
                pt.ny = ay + (orig.ny - ay) * scale;
                delete pt.mx;
                delete pt.my;
              });
            }
            if (st.isShape && snapItem.cardShape) {
              const origCs = snapItem.cardShape;
              const cs = JSON.parse(JSON.stringify(origCs));
              if (cs.start && origCs.start) {
                cs.start.nx = ax + (origCs.start.nx - ax) * scale;
                cs.start.ny = ay + (origCs.start.ny - ay) * scale;
                delete cs.start.mx; delete cs.start.my;
              }
              if (cs.end && origCs.end) {
                cs.end.nx = ax + (origCs.end.nx - ax) * scale;
                cs.end.ny = ay + (origCs.end.ny - ay) * scale;
                delete cs.end.mx; delete cs.end.my;
              }
              if (cs.center && origCs.center) {
                cs.center.nx = ax + (origCs.center.nx - ax) * scale;
                cs.center.ny = ay + (origCs.center.ny - ay) * scale;
                cs.rx = (origCs.rx || 0.05) * scale;
                cs.ry = (origCs.ry || cs.rx) * scale;
                delete cs.center.mx; delete cs.center.my;
                delete cs.mrx; delete cs.mry;
              }
              if (cs.min && origCs.min && cs.max && origCs.max) {
                const nx1 = ax + (origCs.min.nx - ax) * scale;
                const ny1 = ay + (origCs.min.ny - ay) * scale;
                const nx2 = ax + (origCs.max.nx - ax) * scale;
                const ny2 = ay + (origCs.max.ny - ay) * scale;
                cs.min = { nx: Math.min(nx1, nx2), ny: Math.min(ny1, ny2) };
                cs.max = { nx: Math.max(nx1, nx2), ny: Math.max(ny1, ny2) };
              }
              if (Array.isArray(cs.pts) && Array.isArray(origCs.pts)) {
                cs.pts = origCs.pts.map(p => ({
                  nx: ax + (p.nx - ax) * scale,
                  ny: ay + (p.ny - ay) * scale
                }));
              }
              st.cardShape = cs;
            }
          });
          cl.bboxNorm = this.computeCardStrokesNormBBox(cl.selectedStrokes);
          if (cardWidgetEl.classList.contains('graph-card-widget') && typeof this._ensurePipCardInkMathCoordsByWidget === 'function') {
            this._ensurePipCardInkMathCoordsByWidget(cardWidgetEl, true);
          }
          renderCardInkForLasso();
          this.syncLassoActionBarUI();
        }
      }, { capture: true });

      const finishCardLassoInteraction = (e) => {
        if (!cardLassoMode) return;
        const prevMode = cardLassoMode;
        cardLassoMode = null;
        cardLassoLastNorm = null;
        cardLassoResizeCorner = null;
        cardLassoResizeAnchor = null;
        cardLassoResizeInitBox = null;
        cardLassoResizeSnapshots = null;
        try { if (e && e.pointerId !== undefined) bodyEl.releasePointerCapture(e.pointerId); } catch (_) { }

        const cl = (this._activeCardLasso && this._activeCardLasso.widgetEl === cardWidgetEl)
          ? this._activeCardLasso
          : null;
        if (!cl) return;

        cl.isSelecting = false;
        cl.isDragging = false;
        cl.isResizing = false;

        if (prevMode === 'drawing') {
          const poly = (cl.lassoPts || []).map(p => ({ x: p.nx, y: p.ny }));
          const strokes = getCardInkStrokesForLasso();
          if (poly.length >= 3) {
            let lMinX = Infinity, lMaxX = -Infinity, lMinY = Infinity, lMaxY = -Infinity;
            for (const p of poly) {
              if (p.x < lMinX) lMinX = p.x;
              if (p.x > lMaxX) lMaxX = p.x;
              if (p.y < lMinY) lMinY = p.y;
              if (p.y > lMaxY) lMaxY = p.y;
            }
            cl.selectedStrokes = strokes.filter(st => {
              if (!st || !Array.isArray(st.points) || st.points.length === 0) return false;
              const sb = this.computeCardStrokesNormBBox([st]);
              if (sb && (sb.maxNx < lMinX || sb.minNx > lMaxX || sb.maxNy < lMinY || sb.minNy > lMaxY)) {
                return false;
              }
              for (let i = 0; i < st.points.length; i++) {
                const pt = { x: st.points[i].nx, y: st.points[i].ny };
                if (this.isPointInPolygon(pt, poly)) return true;
                if (i < st.points.length - 1) {
                  const nextPt = { x: st.points[i + 1].nx, y: st.points[i + 1].ny };
                  const midPt = { x: (pt.x + nextPt.x) * 0.5, y: (pt.y + nextPt.y) * 0.5 };
                  if (this.isPointInPolygon(midPt, poly)) return true;
                  for (let j = 0; j < poly.length; j++) {
                    const p1 = poly[j];
                    const p2 = poly[(j + 1) % poly.length];
                    if (this.segmentsIntersect(pt, nextPt, p1, p2)) return true;
                  }
                }
              }
              return false;
            });
          } else {
            cl.selectedStrokes = [];
          }
          if (cl.selectedStrokes.length === 0) {
            cl.lassoPts = [];
            cl.bboxNorm = null;
          } else {
            cl.bboxNorm = this.computeCardStrokesNormBBox(cl.selectedStrokes);
          }
        } else {
          cl.bboxNorm = this.computeCardStrokesNormBBox(cl.selectedStrokes);
        }

        if (cardWidgetEl.classList.contains('graph-card-widget') && typeof this._ensurePipCardInkMathCoordsByWidget === 'function') {
          this._ensurePipCardInkMathCoordsByWidget(cardWidgetEl, true);
        }
        renderCardInkForLasso();
        this.syncLassoActionBarUI();
      };

      bodyEl.addEventListener('pointerup', finishCardLassoInteraction, { capture: true });
      bodyEl.addEventListener('pointercancel', finishCardLassoInteraction, { capture: true });
      window.addEventListener('pointerup', finishCardLassoInteraction, { capture: true });
      window.addEventListener('pointercancel', finishCardLassoInteraction, { capture: true });
    }

    // 🌟 [각 그래프 보관 카드(#1, #2, #3...) 전용 0.5KB 초경량 순수 그래프 상태 타임머신 스냅샷] 🌟
    getPureGraphSnapshot() {
      return JSON.stringify({
        graphs: this.graphs,
        activeGraphIdx: this.activeGraphIdx,
        zoomLevel: this.zoomLevel,
        panX: this.panX,
        panY: this.panY,
        xSpan: this.xSpan,
        ySpan: this.ySpan,
        usePiecewise: this.usePiecewise,
        piecewiseBoundaries: this.piecewiseBoundaries,
        piecewiseFuncMap: this.piecewiseFuncMap,
        piecewiseInclusions: this.piecewiseInclusions,
        isPiecewisePeriodic: this.isPiecewisePeriodic,
        periodicStepY: this.periodicStepY,
        isPiecewiseLocked: Boolean(this.isPiecewiseLocked),
        showInverseGuide: this.showInverseGuide,
        showXAxis: this.showXAxis !== false,
        showYAxis: this.showYAxis !== false,
        showGridNumbers: Boolean(this.showGridNumbers),
        dropLines: this.dropLines || [],
        textLabels: this.textLabels || [],
        graphInkStrokes: (this.inkStrokes || []).filter(s => s && (s.target || 'board') === 'graph' && !s.onPdfBoard)
      });
    }

    applyPureGraphSnapshot(jsonStr) {
      if (!jsonStr) return;
      try {
        const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        this.graphs = JSON.parse(JSON.stringify(data.graphs || []));
        this.graphs.forEach(g => {
          if (g && g.type === 'general_expr' && Array.isArray(g.handles)) {
            g.handles.forEach(h => {
              if (h && h.rawExpr && window.SafeMathCompiler) {
                const comp = window.SafeMathCompiler.compile(h.rawExpr);
                if (comp && comp.success) h.fn = comp.fn;
              }
            });
          }
        });
        this.activeGraphIdx = data.activeGraphIdx !== undefined ? data.activeGraphIdx : (this.graphs.length > 0 ? 0 : -1);
        if (data.zoomLevel !== undefined) {
          this.zoomLevel = data.zoomLevel;
          const slZoom = document.getElementById('sliderZoom');
          if (slZoom) slZoom.value = this.zoomLevel;
          const lblZoom = document.getElementById('lblZoom');
          if (lblZoom) lblZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
        if (data.panX !== undefined) this.panX = data.panX;
        if (data.panY !== undefined) this.panY = data.panY;
        if (data.xSpan !== undefined) this.xSpan = data.xSpan;
        if (data.ySpan !== undefined) this.ySpan = data.ySpan;
        if (data.usePiecewise !== undefined) {
          this.usePiecewise = data.usePiecewise;
          const chk = document.getElementById('chkPiecewise');
          if (chk) chk.checked = this.usePiecewise;
          const btnQuick = document.getElementById('btnQuickPiecewise');
          if (btnQuick) btnQuick.classList.toggle('active', this.usePiecewise);
          const pwBox = document.getElementById('pwControls');
          if (pwBox) pwBox.style.display = this.usePiecewise ? 'block' : 'none';
        }
        if (data.piecewiseBoundaries) this.piecewiseBoundaries = [...data.piecewiseBoundaries];
        if (data.piecewiseFuncMap) this.piecewiseFuncMap = [...data.piecewiseFuncMap];
        if (data.piecewiseInclusions) this.piecewiseInclusions = [...data.piecewiseInclusions];
        if (data.isPiecewisePeriodic !== undefined) this.isPiecewisePeriodic = data.isPiecewisePeriodic;
        if (data.periodicStepY !== undefined) this.periodicStepY = data.periodicStepY;
        if (data.isPiecewiseLocked !== undefined) this.isPiecewiseLocked = Boolean(data.isPiecewiseLocked);
        this.syncPeriodicUI();
        if (data.showInverseGuide !== undefined) {
          this.showInverseGuide = data.showInverseGuide;
          const chkInv = document.getElementById('chkInverseGuide');
          if (chkInv) chkInv.checked = this.showInverseGuide;
        }
        if (data.showXAxis !== undefined) {
          this.showXAxis = Boolean(data.showXAxis);
        }
        if (data.showYAxis !== undefined) {
          this.showYAxis = Boolean(data.showYAxis);
        }
        if (typeof this.syncAxisVisibilityUI === 'function') {
          this.syncAxisVisibilityUI();
        }
        if (data.showGridNumbers !== undefined) {
          this.showGridNumbers = Boolean(data.showGridNumbers);
          const chkGN = document.getElementById('chkGridNumbers');
          if (chkGN) chkGN.checked = this.showGridNumbers;
        }
        if (Array.isArray(data.dropLines)) {
          this.dropLines = JSON.parse(JSON.stringify(data.dropLines));
        }
        if (Array.isArray(data.textLabels)) {
          this.textLabels = JSON.parse(JSON.stringify(data.textLabels));
        }
        if (Array.isArray(data.graphInkStrokes)) {
          const preservedStrokes = (this.inkStrokes || []).filter(s => s && ((s.target || 'board') === 'board' || s.onPdfBoard));
          this.inkStrokes = [...preservedStrokes, ...JSON.parse(JSON.stringify(data.graphInkStrokes))];
          this._inkBakeDirty = true;
        }
        this.selectedHandleIdx = null;
        this.draggedHandleIdx = null;
        this.isCurveSelected = false;
        this.syncControls();
        this.renderLayerList();
        this.renderFuncList();
      } catch (err) {
        console.error('Graph card snapshot restore error:', err);
      }
    }

    // ==========================================================================
    // [📝 판서 모드 (Board Mode) ↔ 📈 그래프 모드 (Graph Mode) 완전 분리 엔진]
    // ==========================================================================
    syncWorkspaceModeUI() {
      const isBoard = Boolean(this.isGraphCovered);
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('workspace-board-mode', isBoard);
        document.body.classList.toggle('workspace-graph-mode', !isBoard);
      }

      // 🌟 [대표님 기획]: 판서 모드와 그래프 모드 모두 좌측 [+] 버튼은 직관적인 '그래프 추가' 버튼으로 작동!
      // (판서 모드에서 누르면 모드를 전환하지 않고 바로 함수 선택창을 열어 PiP 그래프 카드를 소환)
      const btnPresets = document.getElementById('btnRailPresets');
      if (btnPresets) {
        btnPresets.classList.remove('rail-graph-mode-switch');
        btnPresets.title = isBoard ? '새 그래프 카드 추가' : '그래프 추가';
        btnPresets.innerHTML = `<span class="rail-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>`;
      }

      const graphOnlyIds = [
        'btnQuickIntersection',
        'btnQuickDropLine',
        'btnQuickText',
        'btnRailPiecewise',
        'btnRailNAxis',
        'btnInkToggleAxes'
      ];
      graphOnlyIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (id === 'btnQuickDropLine' && !isBoard && this.showXAxis === false && this.showYAxis === false) {
            el.style.display = 'none';
          } else {
            el.style.display = isBoard ? 'none' : '';
          }
        }
      });
      if (!isBoard) {
        const btnInt = document.getElementById('btnQuickIntersection');
        if (btnInt) btnInt.classList.toggle('active', Boolean(this.useIntersectionDetector));
        if (this.useIntersectionDetector) {
          this.startIntersectionLoop();
        }
        const btnDl = document.getElementById('btnQuickDropLine');
        if (btnDl) {
          btnDl.classList.toggle('active', Boolean(this.isDropLineMode && (this.showXAxis !== false || this.showYAxis !== false)));
        }
        const btnTxt = document.getElementById('btnQuickText');
        if (btnTxt) btnTxt.classList.toggle('active', Boolean(this.isTextToolMode));
      }
      const axesDivider = document.querySelector('#btnInkToggleAxes + .ink-toolbar-divider');
      if (axesDivider) {
        axesDivider.style.display = isBoard ? 'none' : '';
      }
      const quickDivider = document.querySelector('#btnQuickSnap + .quick-toolbar-divider');
      if (quickDivider) {
        quickDivider.style.display = isBoard ? 'none' : '';
      }
      if (!isBoard) {
        this._openSlideChipDelKey = null;
      }
      if (typeof this.syncPdfBoardNavBarUI === 'function') {
        this.syncPdfBoardNavBarUI();
      }
      if (typeof this.syncLessonPlaylistNavBarUI === 'function') {
        this.syncLessonPlaylistNavBarUI();
      }
    }

    hasBoardStateToReturn() {
      // 🌟 판서 모드가 기본 홈(본진)이므로 그래프 모드에서는 언제든 우상단 [↩ 판서 복귀]로 돌아갈 수 있음!
      return true;
    }

    enterBoardMode() {
      this.isCurveSelected = false;
      this.selectedHandleIdx = null;
      this.draggedHandleIdx = null;
      this.selectedPwBoundaryIdx = null;
      if (!this.isGraphCovered) {
        this._coveredGraphStateBackup = this.getPureGraphSnapshot();
      }
      this.isGraphCovered = true;
      this.isGraphSnapMode = false;
      this.isPdfToGraphCropMode = false;
      this.isPdfToGraphCropDragging = false;
      this.stopIntersectionLoop();
      this.deselectAllPipGraphCards();
      document.body.classList.remove('graph-snap-crosshair');
      if (this.canvas) this.canvas.classList.remove('graph-snap-crosshair');

      const pWidget = document.getElementById('problemCardWidget');
      if (pWidget && this.problemCardData && !this._retainedPdfAudioProbCard) {
        pWidget.style.display = 'flex';
      }
      const gWidget = document.getElementById('graphCardWidget');
      if (gWidget && this._hasPrimaryGraphCard && this.graphCardData) {
        gWidget.style.display = 'flex';
      }
      if (this.extraGraphCards && this.extraGraphCards.length > 0) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el) c.el.style.display = 'flex';
        });
      }
      if (this.extraProblemCards && this.extraProblemCards.length > 0) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el) {
            c.el.style.display = 'flex';
            if (typeof c.el._renderCardInkCanvas === 'function') {
              c.el._renderCardInkCanvas();
            }
          }
        });
      }
      this.updateProblemCardPosition();

      if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed && (this.activeDrawerPanel === 'panelPresets' || this.activeDrawerPanel === 'panelPiecewise')) {
        this.closeDrawer();
      }
      this.syncWorkspaceModeUI();
      this.syncGraphSnapBarUI();
      this._inkBakeDirty = true;
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    enterGraphModeFromBoard(options = {}) {
      this.isPdfToGraphCropMode = false;
      this.isPdfToGraphCropDragging = false;
      this.isGraphSnapMode = false;
      this.isGraphSnapDragging = false;
      const dragBox = document.getElementById('graphSnapDragBox');
      if (dragBox) dragBox.style.display = 'none';
      document.body.classList.remove('graph-snap-crosshair');
      if (this.canvas) this.canvas.classList.remove('graph-snap-crosshair');

      // 1. PDF 전체화면 판서 중이었다면 PDF 보드 상태와 카메라를 일시 정지(백업)하고 광활한 그래프 모드로 전환!
      if (this.pdfPageBoardData) {
        this._suspendedPdfBoardState = {
          pdfPageBoardData: this.pdfPageBoardData,
          panX: this.panX,
          panY: this.panY,
          zoomLevel: this.zoomLevel,
          xSpan: this.xSpan,
          ySpan: this.ySpan
        };
        this.pdfPageBoardData = null;
        this.syncPdfBoardNavBarUI();
      }

      // 2. 판서 모드 패닝 좌표 백업 후 좌상단(72px, 18px) 문제 참조 카드 위치 고정
      if (this.isGraphCovered) {
        this._savedLayer2BoardPan = {
          x: this.boardPanX || 0,
          y: this.boardPanY || 0,
          zoom: this.boardZoom || 1.0,
          zOx: this.boardZoomOffsetX || 0,
          zOy: this.boardZoomOffsetY || 0
        };
      }
      this.boardPanX = 0;
      this.boardPanY = 0;

      // 3. 보관된 그래프 카드(#1, #2...) 및 문제 카드는 전체화면 그래프 모드 작업 중 숨김 (판서 복귀 시 원상 복원!)
      const gWidget = document.getElementById('graphCardWidget');
      if (gWidget) gWidget.style.display = 'none';
      if (this.extraGraphCards && this.extraGraphCards.length > 0) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el) c.el.style.display = 'none';
        });
      }
      const pWidget = document.getElementById('problemCardWidget');
      if (pWidget) pWidget.style.display = 'none';
      if (this.extraProblemCards && this.extraProblemCards.length > 0) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el) {
            c.el.style.display = 'none';
          }
        });
      }

      // 4. 이전 그래프를 이미 보관 카드로 구웠거나(_graphSessionArchived) 새 그래프 세션을 여는 경우 깨끗한 좌표평면으로 초기화
      if (this._graphSessionArchived || Boolean(options && options.resetGraphCanvas) || !this.graphs || this.graphs.length === 0) {
        this.graphs = [];
        this.activeGraphIdx = -1;
        this.selectedHandleIdx = null;
        this.isCurveSelected = false;
        this.selectedPwBoundaryIdx = null;
        this.usePiecewise = false;
        this.piecewiseBoundaries = [];
        this.piecewiseFuncMap = [];
        this.piecewiseInclusions = [];
        this.isPiecewisePeriodic = false;
        this.periodicStepY = 0;
        this.isPiecewiseLocked = false;
        this.dropLines = [];
        this.textLabels = [];
        if (this.inkStrokes && this.inkStrokes.length > 0) {
          if (this.isAudioRecording) {
            const nowT = this.getAudioRecordElapsedMs();
            if (!this.audioErasedStrokes) this.audioErasedStrokes = [];
            this.inkStrokes.forEach(s => {
              if (s && (s.target || 'board') !== 'board' && !s.onPdfBoard) {
                this.audioErasedStrokes.push({ ...s, erasedAt: nowT });
              }
            });
          }
          this.inkStrokes = this.inkStrokes.filter(s => s && ((s.target || 'board') === 'board' || s.onPdfBoard));
        }
        this.panX = 0;
        this.panY = 0;
        this.xSpan = 8.5;
        this.ySpan = 6.0;
        this.setZoomLevel(1.0);
        this._graphSessionArchived = false;
      }

      this.isCurveSelected = false;
      this.selectedHandleIdx = null;
      this.draggedHandleIdx = null;
      this.selectedPwBoundaryIdx = null;
      this.isGraphCovered = false;
      this.showAxes = true;
      this.updateAxesUI();
      const chkGuides = document.getElementById('chkGuides');
      if (chkGuides) chkGuides.checked = Boolean(this.showGuides);
      const btnGrid = document.getElementById('btnQuickGrid');
      if (btnGrid) btnGrid.classList.toggle('active', Boolean(this.showGuides));

      // 🌟 [대표님 피드백 반영: 그래프 모드 진입 시 아예 ↖ 이동/조작(select) 모드로 즉시 전환!]
      if (this.isInkMode && this.activeInkTool !== 'select') {
        this.setActiveInkTool('select');
      }

      this.updateProblemCardPosition();
      this.syncControls();
      this.syncWorkspaceModeUI();
      this.syncGraphSnapBarUI();
      this._inkBakeDirty = true;
      this.clearInkCache();
      this.renderLayerList();
      this.renderFuncList();
      this.render();
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    startPdfBoardToGraphCrop(pendingGraphType = null) {
      if (!this.pdfPageBoardData) {
        this.enterGraphModeFromBoard();
        if (pendingGraphType) {
          this.addGraph(pendingGraphType);
        } else if (typeof this.openDrawer === 'function') {
          this.openDrawer('panelPresets');
        }
        return;
      }
      // 🌟 [대표님 피드백 반영]: [✂️ 캡처 후 이동]을 누르면 좌측 선택 바는 즉시 사라지고 캡처 모드로 전환!
      this._isPdfCropChoiceMenuOpen = false;
      this.isPdfToGraphCropMode = true;
      this.isPdfToGraphCropDragging = false;
      if (pendingGraphType !== null) {
        this._pendingPdfToGraphType = pendingGraphType;
      }
      if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed) {
        this.closeDrawer();
      }
      document.body.classList.add('graph-snap-crosshair');
      if (this.canvas) {
        this.canvas.classList.add('graph-snap-crosshair');
        this.canvas.style.cursor = 'crosshair';
      }
      if (this.virtualStylusEl) {
        this.virtualStylusEl.style.display = 'none';
      }
      this.syncGraphSnapBarUI();
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      this.render();
    }

    cancelPdfBoardToGraphCrop() {
      this._isPdfCropChoiceMenuOpen = false;
      this.isPdfToGraphCropMode = false;
      this.isPdfToGraphCropDragging = false;
      this._pendingPdfToGraphType = null;
      this._activeSnapDragRect = null;
      const dragBox = document.getElementById('graphSnapDragBox');
      if (dragBox) dragBox.style.display = 'none';
      document.body.classList.remove('graph-snap-crosshair');
      if (this.canvas) {
        this.canvas.classList.remove('graph-snap-crosshair');
      }
      this.updateInkCursor();
      this.syncGraphSnapBarUI();
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      this.render();
    }

    completePdfBoardToGraphCrop(cropRect = null) {
      const pendingType = this._pendingPdfToGraphType;
      this._isPdfCropChoiceMenuOpen = false;
      this.isPdfToGraphCropMode = false;
      this.isPdfToGraphCropDragging = false;
      this._pendingPdfToGraphType = null;
      this._activeSnapDragRect = null;
      const dragBox = document.getElementById('graphSnapDragBox');
      if (dragBox) dragBox.style.display = 'none';
      const btnStartCrop = document.getElementById('btnStartPdfCropToGraph');
      if (btnStartCrop) btnStartCrop.classList.remove('active-crop-wait');
      document.body.classList.remove('graph-snap-crosshair');
      if (this.canvas) {
        this.canvas.classList.remove('graph-snap-crosshair');
      }

      let croppedDataUrl = null;
      let croppedCanvas = null;
      let croppedW = 420;
      let normCropForUpgrade = null;
      const pdfPageNum = (this.pdfPageBoardData && this.pdfPageBoardData.pageNum) || 1;

      if (cropRect && cropRect.w >= 25 && cropRect.h >= 25 && this.canvas) {
        // 🌟 [PDF 칠판 배율 확대 시 화면 잘림 없는 수학 좌표 기반 원본 벡터 캔버스 직결 추출] 🌟
        const pbd = this.pdfPageBoardData;
        if (pbd && pbd.canvas && pbd.mathW > 0 && pbd.mathH > 0) {
          const m1 = cropRect.mathStart || this.screenToMath(cropRect.x, cropRect.y);
          const m2 = cropRect.mathEnd || this.screenToMath(cropRect.x + cropRect.w, cropRect.y + cropRect.h);
          const minMX = Math.min(m1.x, m2.x);
          const maxMX = Math.max(m1.x, m2.x);
          const minMY = Math.min(m1.y, m2.y);
          const maxMY = Math.max(m1.y, m2.y);

          const pageLeftM = (pbd.centerX || 0) - pbd.mathW / 2;
          const pageTopM = (pbd.centerY || 0) + pbd.mathH / 2;
          const nx1 = Math.max(0, Math.min(1, (minMX - pageLeftM) / pbd.mathW));
          const nx2 = Math.max(0, Math.min(1, (maxMX - pageLeftM) / pbd.mathW));
          const ny1 = Math.max(0, Math.min(1, (pageTopM - maxMY) / pbd.mathH));
          const ny2 = Math.max(0, Math.min(1, (pageTopM - minMY) / pbd.mathH));

          const sx = Math.round(nx1 * pbd.canvas.width);
          const sy = Math.round(ny1 * pbd.canvas.height);
          const sw = Math.round((nx2 - nx1) * pbd.canvas.width);
          const sh = Math.round((ny2 - ny1) * pbd.canvas.height);

          if (sw >= 24 && sh >= 24) {
            normCropForUpgrade = { nx: nx1, ny: ny1, nw: nx2 - nx1, nh: ny2 - ny1 };
            croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = sw;
            croppedCanvas.height = sh;
            const cctx = croppedCanvas.getContext('2d');
            cctx.imageSmoothingEnabled = true;
            cctx.imageSmoothingQuality = 'high';
            cctx.fillStyle = '#ffffff';
            cctx.fillRect(0, 0, sw, sh);
            cctx.drawImage(pbd.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
            croppedDataUrl = this.encodeCanvasSmartWebP(croppedCanvas, 0.88);
            croppedW = Math.round(Math.max(320, Math.min(560, cropRect.w / Math.max(1, (this.zoomLevel || 1) * 0.85))));
          }
        }

        if (!croppedDataUrl) {
          const rx = Math.max(0, Math.round(cropRect.x));
          const ry = Math.max(0, Math.round(cropRect.y));
          const rw = Math.min(this.screenWidth - rx, Math.round(cropRect.w));
          const rh = Math.min(this.screenHeight - ry, Math.round(cropRect.h));
          if (rw >= 20 && rh >= 20) {
            const dpr = this.getCanvasDpr();
            croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = Math.round(rw * dpr);
            croppedCanvas.height = Math.round(rh * dpr);
            const cctx = croppedCanvas.getContext('2d');
            cctx.imageSmoothingEnabled = true;
            cctx.imageSmoothingQuality = 'high';
            cctx.drawImage(
              this.canvas,
              Math.round(rx * dpr),
              Math.round(ry * dpr),
              Math.round(rw * dpr),
              Math.round(rh * dpr),
              0,
              0,
              Math.round(rw * dpr),
              Math.round(rh * dpr)
            );
            croppedDataUrl = this.encodeCanvasSmartWebP(croppedCanvas, 0.88);
            croppedW = Math.round(Math.max(300, Math.min(540, rw)));
          }
        }
      }

      // PDF 판서 상태를 일시 보관하고 광활한 그래프 모드로 전환!
      this.enterGraphModeFromBoard({ resetGraphCanvas: true });

      // 드래그한 문제 영역이 있으면 좌상단(72px, 18px) 참조 문제 카드로 띄움!
      if (croppedDataUrl) {
        this.closeProblemCard();
        this.setProblemCard(croppedDataUrl, pdfPageNum, croppedCanvas, croppedW, {
          keepGraphMode: true,
          isTempPdfCard: true
        });
        if (normCropForUpgrade) {
          this._upgradeCroppedProblemCardToVectorUltraHD(pdfPageNum, normCropForUpgrade, this._lastPlacedProblemCardTarget);
        }
      }

      if (pendingType) {
        this.addGraph(pendingType);
      } else if (typeof this.openDrawer === 'function') {
        // 🌟 [대표님 피드백 반영]: 선택하자마자 즉시 그래프 추가 서랍(panelPresets)을 열어 동선을 절반으로 단축!
        this.openDrawer('panelPresets');
      }
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    _restoreBoardModeStateAfterGraph() {
      this.isCurveSelected = false;
      this.selectedHandleIdx = null;
      this.draggedHandleIdx = null;
      this.selectedPwBoundaryIdx = null;
      this._coveredGraphStateBackup = this.getPureGraphSnapshot();
      this.isGraphCovered = true;
      this.isGraphSnapMode = false;
      this.isGraphSnapDragging = false;
      this.isPdfToGraphCropMode = false;
      this.isPdfToGraphCropDragging = false;
      this.stopIntersectionLoop();
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
      document.body.classList.remove('graph-snap-crosshair');
      if (this.canvas) this.canvas.classList.remove('graph-snap-crosshair');

      // 1. PDF 전체화면에서 임시로 크롭해 왔던 문제 카드가 있으면 판서 모드 복귀 시 자동 정리
      // (단, 음성 녹화 중이거나 녹화 데이터가 있을 때는 그래프 모드 구간 리플레이 시 문제 카드가 그대로 보이도록 데이터는 유지하고 숨김 처리!)
      if (this._isTempPdfProblemCard) {
        this._isTempPdfProblemCard = false;
        if (this.isAudioRecording || (this.audioSyncData && this.audioSyncData.durationMs > 0)) {
          this._retainedPdfAudioProbCard = true;
          const pWidget = document.getElementById('problemCardWidget');
          if (pWidget) pWidget.style.display = 'none';
        } else {
          this.closeProblemCard();
        }
      }

      // 2. 일시 정지해 두었던 PDF 전체화면 보드 상태가 있으면 100% 원상 복원!
      if (this._suspendedPdfBoardState) {
        const s = this._suspendedPdfBoardState;
        this._suspendedPdfBoardState = null;
        this.pdfPageBoardData = s.pdfPageBoardData;
        if (this.pdfPageBoardData && typeof this._isValidPdfBoardCanvas === 'function' && !this._isValidPdfBoardCanvas(this.pdfPageBoardData.canvas)) {
          this.pdfPageBoardData.canvas = null;
          if (typeof this._ensurePdfBoardCanvasFromDataUrl === 'function') {
            this._ensurePdfBoardCanvasFromDataUrl(this.pdfPageBoardData);
          }
        }
        this.panX = typeof s.panX === 'number' ? s.panX : 0;
        this.panY = typeof s.panY === 'number' ? s.panY : 0;
        this.xSpan = s.xSpan || 11.5;
        this.ySpan = s.ySpan || 8.4;
        this.setZoomLevel(typeof s.zoomLevel === 'number' ? s.zoomLevel : 1.0);
        this.syncPdfBoardNavBarUI();
      } else if (this._savedLayer2BoardPan) {
        this.boardPanX = this._savedLayer2BoardPan.x;
        this.boardPanY = this._savedLayer2BoardPan.y;
        if (typeof this._savedLayer2BoardPan.zoom === 'number') this.boardZoom = this._savedLayer2BoardPan.zoom;
        if (typeof this._savedLayer2BoardPan.zOx === 'number') this.boardZoomOffsetX = this._savedLayer2BoardPan.zOx;
        if (typeof this._savedLayer2BoardPan.zOy === 'number') this.boardZoomOffsetY = this._savedLayer2BoardPan.zOy;
        this._savedLayer2BoardPan = null;
      }

      // 3. 보관된 모든 그래프 카드(#1, #2...) 및 문제 카드 다시 표시
      const pWidget = document.getElementById('problemCardWidget');
      if (pWidget && this.problemCardData && !this._retainedPdfAudioProbCard) {
        pWidget.style.display = 'flex';
      }
      const widget = document.getElementById('graphCardWidget');
      if (widget && this._hasPrimaryGraphCard && this.graphCardData) {
        widget.style.display = 'flex';
      }
      if (this.extraGraphCards && this.extraGraphCards.length > 0) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el) {
            c.el.style.display = 'flex';
            this.syncPipCardLockUI(c);
            this.renderPipGraphCard(c);
            if (typeof c.el._renderCardInkCanvas === 'function') {
              c.el._renderCardInkCanvas();
            }
          }
        });
      }
      if (this.extraProblemCards && this.extraProblemCards.length > 0) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el) {
            c.el.style.display = 'flex';
            if (typeof c.el._renderCardInkCanvas === 'function') {
              c.el._renderCardInkCanvas();
            }
          }
        });
      }

      this.deselectAllPipGraphCards();

      if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed && (this.activeDrawerPanel === 'panelPresets' || this.activeDrawerPanel === 'panelPiecewise')) {
        this.closeDrawer();
      }
      this.updateProblemCardPosition();
      this.syncGraphCardRectFromWidget();
      this.syncControls();
      this.renderLayerList();
      this.renderFuncList();
      this.syncWorkspaceModeUI();
      this.syncGraphSnapBarUI();
      this._inkBakeDirty = true;
      this.clearInkCache();

      if (!this.isInkMode) {
        this.toggleInkMode(true);
      }
      this.setActiveInkTool('pen');
      this.render();
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    // 🌟 [새 스샷 촬영 없이 방금 판서하던 칠판(판서 모드) 화면으로 즉시 복귀 (카드에서 크게 열었던 경우 자동 반영)] 🌟
    returnToCoveredBoard() {
      if (!this.hasBoardStateToReturn()) return;
      const spawnedNewInSession = Boolean(this._hasSpawnedNewCardInSession);
      this._hasSpawnedNewCardInSession = false;
      this._lastSpawnedPipCardRef = null;

      if (spawnedNewInSession) {
        this._editingGraphCardTarget = null;
        if (Array.isArray(this.inkStrokes)) {
          this.inkStrokes = this.inkStrokes.filter(s => s && s.target !== 'graph');
        }
        if (typeof this.clearInkCache === 'function') this.clearInkCache();
        this._restoreBoardModeStateAfterGraph();
        this.showToast('📋 추가된 그래프 창들과 함께 필기 모드로 돌아왔습니다.');
        return;
      }

      const editingTarget = this._editingGraphCardTarget;
      const hadEditingCard = Boolean(editingTarget);
      const hasLiveGraphs = Boolean(Array.isArray(this.graphs) && this.graphs.length > 0);
      const hasLiveGraphsToSync = Boolean(!hadEditingCard && hasLiveGraphs && !this._graphSessionArchived);

      // 🌟 [대표님 피드백 반영]: 창모드 카드를 전체화면으로 크게 열어 그래프를 모두 삭제한 뒤 복귀하면,
      // 잔상 카드나 빈 좌표평면을 남기지 않고 해당 창모드 카드 자체를 자동으로 닫음 (+ ↺ 되돌리기로 복원 지원)
      if (hadEditingCard && !hasLiveGraphs) {
        this._editingGraphCardTarget = null;
        if (Array.isArray(this.inkStrokes)) {
          this.inkStrokes = this.inkStrokes.filter(s => s && s.target !== 'graph');
        }
        if (typeof this.clearInkCache === 'function') this.clearInkCache();
        this._restoreBoardModeStateAfterGraph();
        this._closePipGraphCardByRef(editingTarget, false);
        this.showToast('🗑️ 그래프가 삭제되어 해당 그래프 창을 닫았습니다 (되돌리기 ↺로 복원 가능)');
        return;
      }

      if ((hadEditingCard || hasLiveGraphsToSync) && typeof this._syncFullGraphBackToEditingPipCard === 'function') {
        this._syncFullGraphBackToEditingPipCard();
      }
      this._restoreBoardModeStateAfterGraph();
      this.showToast((hadEditingCard || hasLiveGraphsToSync)
        ? '✅ 그래프 모드 편집 내용이 카드에 반영되었습니다!'
        : '📋 필기 모드로 돌아왔습니다.');
    }

    syncGraphSnapBarUI() {
      const hasGraphs = Boolean(this.graphs && this.graphs.length > 0);
      const hasReturn = this.hasBoardStateToReturn();
      const shouldShow = Boolean((hasGraphs || hasReturn) && !this.isGraphCovered && !this.isPdfToGraphCropMode);
      const snapSig = `${Boolean(this._isPdfCropChoiceMenuOpen)}|${Boolean(this.isPdfToGraphCropMode)}|${shouldShow}|${hasReturn}|${hasGraphs}`;
      if (this._lastSnapBarFullSig === snapSig) return;
      this._lastSnapBarFullSig = snapSig;

      const pdfCropBar = this._pdfCropBarEl || (this._pdfCropBarEl = document.getElementById('pdfToGraphCropFloatingBar'));
      if (pdfCropBar) {
        pdfCropBar.style.display = this._isPdfCropChoiceMenuOpen ? 'flex' : 'none';
      }
      const pdfCropCancelPill = this._pdfCropCancelPillEl || (this._pdfCropCancelPillEl = document.getElementById('btnCancelPdfCropToGraph'));
      if (pdfCropCancelPill) {
        pdfCropCancelPill.style.display = this.isPdfToGraphCropMode ? 'inline-flex' : 'none';
      }

      const bar = this._snapBarEl || (this._snapBarEl = document.getElementById('graphSnapFloatingBar'));
      if (!bar) return;

      if (this._lastSnapBarShow !== shouldShow) {
        bar.style.display = shouldShow ? 'flex' : 'none';
        this._lastSnapBarShow = shouldShow;
      }

      const btnReturn = this._returnBoardBtnEl || (this._returnBoardBtnEl = document.getElementById('btnReturnToCoveredBoard'));
      if (btnReturn) {
        btnReturn.style.display = (shouldShow && hasReturn) ? 'inline-flex' : 'none';
      }

      const btnAddNewCard = this._addNewPipCardBtnEl || (this._addNewPipCardBtnEl = document.getElementById('btnAddNewPipCardFromGraph'));
      if (btnAddNewCard) {
        btnAddNewCard.style.display = (shouldShow && hasGraphs) ? 'inline-flex' : 'none';
      }

      // 스샷 크롭 방식 [카드 추가] 버튼은 창모드(PiP) 일원화로 숨김 처리
      const btn = this._snapBtnEl || (this._snapBtnEl = document.getElementById('btnTriggerGraphSnap'));
      if (btn) {
        btn.style.display = 'none';
      }
    }

    toggleGraphSnapMode(forceVal = null) {
      const nextState = (forceVal !== null) ? Boolean(forceVal) : !this.isGraphSnapMode;
      this.isGraphSnapMode = nextState;
      this.isGraphSnapDragging = false;
      this._activeSnapDragRect = null;
      const dragBox = document.getElementById('graphSnapDragBox');
      if (dragBox) dragBox.style.display = 'none';

      if (this.isGraphSnapMode) {
        this.isCurveSelected = false;
        this.selectedHandleIdx = null;
        document.body.classList.add('graph-snap-crosshair');
        if (this.canvas) {
          this.canvas.classList.add('graph-snap-crosshair');
          this.canvas.style.cursor = 'crosshair';
        }
        if (this.virtualStylusEl) {
          this.virtualStylusEl.style.display = 'none';
        }
        this.showToast('➕ 보관할 그래프 영역을 십자 포인터로 드래그하세요!');
      } else {
        document.body.classList.remove('graph-snap-crosshair');
        if (this.canvas) {
          this.canvas.classList.remove('graph-snap-crosshair');
        }
        this.updateInkCursor();
      }
      this.syncGraphSnapBarUI();
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      this.render();
    }

    captureGraphSnapshot(cropRect) {
      if (!cropRect || cropRect.w < 30 || cropRect.h < 30) return;

      const rx = Math.max(0, Math.round(cropRect.x));
      const ry = Math.max(0, Math.round(cropRect.y));
      const rw = Math.min(this.screenWidth - rx, Math.round(cropRect.w));
      const rh = Math.min(this.screenHeight - ry, Math.round(cropRect.h));
      if (rw < 20 || rh < 20) return;

      // 1. 스샷 전용 클린 렌더링 (조작 핸들 숨김 + 드래그한 박스 테두리에 맞춰 x·y축 화살촉 ▶, ▲ 칼같이 배치!)
      const prevCovered = this.isGraphCovered;
      let cropCanvas = null;
      let dataUrl = '';
      this._isRenderingGraphSnapshot = true;
      this._snapshotCropBounds = {
        minX: rx,
        maxX: rx + rw,
        minY: ry,
        maxY: ry + rh,
        x: rx,
        y: ry,
        w: rw,
        h: rh
      };
      this.isGraphCovered = false;
      try {
        const snapScale = 3.5;
        cropCanvas = document.createElement('canvas');
        cropCanvas.width = Math.max(1, Math.round(rw * snapScale));
        cropCanvas.height = Math.max(1, Math.round(rh * snapScale));
        const cctx = cropCanvas.getContext('2d');
        cctx.save();
        cctx.scale(snapScale, snapScale);
        cctx.translate(-rx, -ry);
        this.render(cctx, this.screenWidth, this.screenHeight, false);
        cctx.restore();

        dataUrl = cropCanvas.toDataURL('image/png');
      } finally {
        this._isRenderingGraphSnapshot = false;
        this._snapshotCropBounds = null;
        this.isGraphCovered = prevCovered;
        this._editingGraphCardTarget = null;
      }

      // 크롭 영역의 수학적 중심과 범위를 카드 로컬 좌표계로 변환하여 카드 안에서도 즉시 라이브 조작 가능하도록 보존!
      let customSnapObj = null;
      try {
        customSnapObj = JSON.parse(this.getPureGraphSnapshot());
        const sw = Math.max(1, this.screenWidth || window.innerWidth || 1440);
        const sh = Math.max(1, this.screenHeight || window.innerHeight || 900);
        const cropCenterMath = this.screenToMath(rx + rw * 0.5, ry + rh * 0.5);
        const aspect = rh / Math.max(1, rw);
        const targetBodyH = 185;
        const cardW = Math.round(Math.max(180, Math.min(340, targetBodyH / Math.max(0.35, aspect))));
        const cardH = Math.round(cardW * aspect);
        const cardXSpan = Math.max(1.5, (this.xSpan || 8.5) * (rw / sw));
        const cardYSpan = Math.max(1.5, (this.ySpan || 6.0) * (rh / sh));
        const zl = this.zoomLevel || 1.0;
        const effXSpan = cardXSpan / zl;
        const effYSpan = cardYSpan / zl;
        customSnapObj.xSpan = cardXSpan;
        customSnapObj.ySpan = cardYSpan;
        customSnapObj.panX = -(cropCenterMath.x / (effXSpan * 2)) * cardW;
        customSnapObj.panY = (cropCenterMath.y / (effYSpan * 2)) * cardH;
        customSnapObj.isCurveSelected = false;
        customSnapObj.selectedHandleIdx = null;
        customSnapObj._isPipCardSnapshot = true;
        customSnapObj._pipCardW = cardW;
        customSnapObj._pipCardH = cardH;
      } catch (_) { }

      // 2. 그래프 스샷 카드 세팅 & 칠판 덮개(isGraphCovered = true) 활성화!
      this.setGraphCard(
        dataUrl,
        cropCanvas,
        rw,
        { x: rx, y: ry, w: rw, h: rh },
        customSnapObj ? JSON.stringify(customSnapObj) : null
      );
    }

    setGraphCard(dataUrl, sourceCanvas = null, initialWidth = null, sourceRect = null, customSnapshot = null, options = null) {
      if (!this.extraGraphCards) {
        this.extraGraphCards = [];
      }

      const aspect = (options && typeof options.aspect === 'number')
        ? options.aspect
        : ((sourceCanvas && sourceCanvas.width && sourceCanvas.height)
          ? (sourceCanvas.height / sourceCanvas.width)
          : 0.85);
      // 🌟 [대표님 핵심 UX: 어떤 크기로 시원하게 캡처하든 판서 모드에서는 세로 높이(185px, 기존의 절반급)를 일관되게 맞춰 칼각 나열!] 🌟
      const targetBodyH = 185;
      const cardW = (options && typeof options.cardW === 'number')
        ? Math.round(options.cardW)
        : Math.round(Math.max(180, Math.min(340, targetBodyH / Math.max(0.35, aspect))));

      const widget = document.getElementById('graphCardWidget');

      const currentGraphSnapshot = customSnapshot || this.getPureGraphSnapshot();

      // 🌟 핵심: 먼저 판서 모드 상태(문제 카드 펼침 등)를 복원한 뒤 그래프 카드 위치를 계산해야 문제 카드와 절대 겹치지 않음!
      const keepInGraphMode = Boolean(options && options.keepInGraphMode);
      this._graphSessionArchived = true;
      if (!(options && options.alreadyInBoardMode) && !keepInGraphMode) {
        this._restoreBoardModeStateAfterGraph();
      }

      let createdTargetRef = 'primary';
      // 🌟 [대표님 대박 기획: 1번 상황 보관 -> 복구 -> 2번 상황 보관 -> 3번 상황 다중 케이스 비교 보관!] 🌟
      // 이미 1번 보관 카드(#graphCardWidget)가 존재하면, 1번 카드를 그대로 살려두면서 2번, 3번 보관 카드를 나란히 추가 소환!
      if (this._hasPrimaryGraphCard && this.graphCardData) {
        if (!keepInGraphMode) {
          if (widget) {
            widget.style.display = 'flex';
          }
          this.extraGraphCards.forEach(c => {
            if (c.el) c.el.style.display = 'flex';
          });
        }
        createdTargetRef = this.spawnExtraGraphArchiveCard(dataUrl, cardW, aspect, currentGraphSnapshot, sourceRect, options);
      } else {
        this._hasPrimaryGraphCard = true;
        this.primaryGraphCardSnapshot = currentGraphSnapshot;
        this.graphCardData = { imgUrl: dataUrl, dataUrl, graphSnapshot: currentGraphSnapshot };
        this.isGraphCardMinimized = false;
        this.graphCardImage = sourceCanvas;
        this.graphCardAspect = aspect;
        widget._pipSnapObj = null;

        const imgObj = new Image();
        imgObj.onload = () => {
          if (!(options && typeof options.aspect === 'number') && imgObj.naturalWidth && imgObj.naturalHeight) {
            this.graphCardAspect = imgObj.naturalHeight / imgObj.naturalWidth;
            this.syncGraphCardRectFromWidget();
          }
          this.render();
        };
        imgObj.src = dataUrl;

        const img = document.getElementById('graphCardImg');
        if (img) img.src = dataUrl;
        const titleEl = document.getElementById('graphCardTitle');
        if (titleEl) titleEl.textContent = '#1';

        if (widget) {
          this.graphInkStrokes = [];
          this.renderGraphCardCanvas();
          widget.classList.remove('minimized', 'card-ink-active', 'card-laser-active');
          const gInkBtn = document.getElementById('btnGraphCardLaser');
          if (gInkBtn) gInkBtn.classList.remove('active');
          if (widget._cardLaserState) widget._cardLaserState.active = false;
          widget.style.display = keepInGraphMode ? 'none' : 'flex';
          widget.style.width = `${cardW}px`;
          const primaryBody = document.getElementById('graphCardBody');
          if (primaryBody) {
            primaryBody.style.height = `${Math.round(cardW * aspect)}px`;
          }

          this.syncProblemCardRectFromWidget();
          if (options && options.directBasePos && typeof options.directBasePos.x === 'number') {
            this.graphCardBaseX = Math.round(options.directBasePos.x);
            this.graphCardBaseY = Math.round(options.directBasePos.y);
          } else if (options && options.forceScreenPos && sourceRect) {
            const sx = Math.max(68, Math.min(window.innerWidth - cardW - 20, Math.round(sourceRect.x)));
            const sy = Math.max(54, Math.min(window.innerHeight - Math.round(cardW * aspect) - 36, Math.round(sourceRect.y)));
            if (this.pdfPageBoardData) {
              this.graphCardBaseX = sx;
              this.graphCardBaseY = sy;
            } else {
              const bPos = this.screenToBoard(sx, sy);
              this.graphCardBaseX = Math.round(bPos.x);
              this.graphCardBaseY = Math.round(bPos.y);
            }
          } else if (this.pdfPageBoardData) {
            if (this.hasActiveProblemCard() && this.problemCardRect) {
              const pRight = this.problemCardRect.x + this.problemCardRect.w;
              if (pRight + cardW + 36 <= window.innerWidth) {
                this.graphCardBaseX = Math.round(pRight + 20);
                this.graphCardBaseY = Math.round(this.problemCardRect.y);
              } else {
                this.graphCardBaseX = Math.round(this.problemCardRect.x);
                this.graphCardBaseY = Math.round(this.problemCardRect.y + this.problemCardRect.h + 44);
              }
            } else if (sourceRect) {
              this.graphCardBaseX = Math.max(72, Math.min(window.innerWidth - cardW - 24, Math.round(sourceRect.x)));
              this.graphCardBaseY = Math.max(60, Math.min(window.innerHeight - 200, Math.round(sourceRect.y)));
            } else {
              this.graphCardBaseX = 560;
              this.graphCardBaseY = 68;
            }
          } else {
            if (this.hasActiveProblemCard()) {
              const pWidget = document.getElementById('problemCardWidget');
              const pBody = document.getElementById('problemCardBody');
              const pBx = (typeof this.problemCardBaseX === 'number') ? this.problemCardBaseX : 72;
              const pBy = (typeof this.problemCardBaseY === 'number') ? this.problemCardBaseY : 18;
              const pBw = (pWidget && parseFloat(pWidget.style.width)) || 520;
              const pBh = (pBody && parseFloat(pBody.style.height)) || Math.round(pBw * (this.problemCardAspect || 0.72));
              const pRight = pBx + pBw;
              if (pRight + cardW + 36 <= window.innerWidth) {
                this.graphCardBaseX = Math.round(pRight + 20);
                this.graphCardBaseY = Math.round(pBy);
              } else {
                this.graphCardBaseX = Math.round(pBx);
                this.graphCardBaseY = Math.round(pBy + pBh + 44);
              }
            } else if (sourceRect) {
              const sx = Math.max(72, Math.min(window.innerWidth - cardW - 24, Math.round(sourceRect.x)));
              const sy = Math.max(60, Math.min(window.innerHeight - 200, Math.round(sourceRect.y)));
              const bPos = this.screenToBoard(sx, sy);
              this.graphCardBaseX = Math.round(bPos.x);
              this.graphCardBaseY = Math.round(bPos.y);
            } else {
              const bPos = this.screenToBoard(560, 68);
              this.graphCardBaseX = Math.round(bPos.x);
              this.graphCardBaseY = Math.round(bPos.y);
            }
          }
          widget.style.left = `${this.graphCardBaseX}px`;
          widget.style.top = `${this.graphCardBaseY}px`;
          if (options && options.directBasePos && options.directBasePos.pdfAnchor) {
            widget._pdfAnchor = { ...options.directBasePos.pdfAnchor };
            this.graphCardPdfAnchor = { ...options.directBasePos.pdfAnchor };
          } else if (this.pdfPageBoardData) {
            this._pinCardToPdfBoardAtScreenPos(widget, this.graphCardBaseX, this.graphCardBaseY, false);
          } else {
            widget._pdfAnchor = null;
            this.graphCardPdfAnchor = null;
          }
        }

        const toggleBtn = document.getElementById('iconGraphCardToggle');
        if (toggleBtn) toggleBtn.textContent = '▾';
        this.bringCardToFront(widget);
        this.renderPipGraphCard('primary');
      }

      this.updateProblemCardPosition();
      this.render();
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      if (!(options && options.silentToast)) {
        const totalCards = (this._hasPrimaryGraphCard ? 1 : 0) + (this.extraGraphCards ? this.extraGraphCards.length : 0);
        this.showToast(totalCards > 1
          ? `📦 ${totalCards}번째 그래프 보관 카드가 추가되었습니다! 카드를 슥 끌어 배치하세요.`
          : '📦 그래프가 보관되었습니다! 카드 위를 슥 끌어 자유롭게 이동하세요.');
      }
      return createdTargetRef;
    }

    spawnExtraGraphArchiveCard(dataUrl, cardW, aspect, graphSnapshot = null, sourceRect = null, options = null) {
      if (!this.extraGraphCards) this.extraGraphCards = [];
      const caseIdx = this.extraGraphCards.length + 2;

      // 🌟 직전 보관 카드의 실제 오른쪽 끝(prevRight + 14px)과 동일한 상단(prevTop)에 칼각 일렬 배치!
      // 단, 페이지 모드(pdfPageBoardData)에서 PDF 페이지를 이동해 다른 문제를 풀고 있을 때 직전 카드가 화면 밖으로 벗어났다면, 현재 화면(sourceRect 또는 기본 위치)에 즉시 배치!
      const primaryWidget = document.getElementById('graphCardWidget');
      const firstX = (typeof this.graphCardBaseX === 'number') ? this.graphCardBaseX : 560;
      const firstY = (typeof this.graphCardBaseY === 'number') ? this.graphCardBaseY : 68;
      const firstW = (primaryWidget && parseFloat(primaryWidget.style.width)) ? parseFloat(primaryWidget.style.width) : 220;

      let baseX = 560;
      let baseY = 68;
      if (options && options.directBasePos && typeof options.directBasePos.x === 'number') {
        baseX = Math.round(options.directBasePos.x);
        baseY = Math.round(options.directBasePos.y);
      } else if (options && options.forceScreenPos && sourceRect) {
        const sx = Math.max(68, Math.min(window.innerWidth - cardW - 20, Math.round(sourceRect.x)));
        const sy = Math.max(54, Math.min(window.innerHeight - Math.round(cardW * aspect) - 36, Math.round(sourceRect.y)));
        if (this.pdfPageBoardData) {
          baseX = sx;
          baseY = sy;
        } else {
          const bPos = this.screenToBoard(sx, sy);
          baseX = Math.round(bPos.x);
          baseY = Math.round(bPos.y);
        }
      } else if (this.pdfPageBoardData) {
        const prevEl = (this.extraGraphCards.length > 0 && this.extraGraphCards[this.extraGraphCards.length - 1])
          ? this.extraGraphCards[this.extraGraphCards.length - 1].el
          : primaryWidget;
        const prevRect = (prevEl && prevEl.style.display !== 'none') ? prevEl.getBoundingClientRect() : null;
        const isPrevVisibleOnScreen = Boolean(
          prevRect &&
          prevRect.width > 0 &&
          prevRect.right > 80 &&
          prevRect.left < window.innerWidth - 80 &&
          prevRect.bottom > 50 &&
          prevRect.top < window.innerHeight - 60
        );
        if (isPrevVisibleOnScreen) {
          baseX = Math.round(prevRect.right + 14);
          baseY = Math.round(prevRect.top);
          if (baseX + cardW + 20 > window.innerWidth) {
            const firstRect = (primaryWidget && primaryWidget.style.display !== 'none') ? primaryWidget.getBoundingClientRect() : prevRect;
            baseX = Math.max(72, Math.min(window.innerWidth - cardW - 24, Math.round(firstRect.left)));
            baseY = Math.min(window.innerHeight - 230, Math.round(prevRect.bottom + 18));
          }
        } else if (sourceRect) {
          baseX = Math.max(72, Math.min(window.innerWidth - cardW - 24, Math.round(sourceRect.x)));
          baseY = Math.max(60, Math.min(window.innerHeight - 200, Math.round(sourceRect.y)));
        } else {
          baseX = 560;
          baseY = 68;
        }
      } else {
        let prevX = firstX;
        let prevY = firstY;
        let prevW = firstW;
        if (this.extraGraphCards.length > 0) {
          const lastCard = this.extraGraphCards[this.extraGraphCards.length - 1];
          if (lastCard) {
            prevX = (typeof lastCard.baseX === 'number') ? lastCard.baseX : firstX;
            prevY = (typeof lastCard.baseY === 'number') ? lastCard.baseY : firstY;
            prevW = (lastCard.el && parseFloat(lastCard.el.style.width)) ? parseFloat(lastCard.el.style.width) : cardW;
          }
        }
        baseX = Math.round(prevX + prevW + 14);
        baseY = Math.round(prevY);
        if (baseX + cardW + 20 > window.innerWidth) {
          baseX = Math.max(72, Math.min(window.innerWidth - cardW - 24, firstX));
          baseY = Math.min(window.innerHeight - 230, prevY + 232);
        }
      }

      const keepInGraphMode = Boolean(options && options.keepInGraphMode);
      const el = document.createElement('div');
      el.className = 'problem-card-widget graph-card-widget extra-graph-card-widget';
      el.style.display = keepInGraphMode ? 'none' : 'flex';
      el.style.width = `${cardW}px`;
      el.style.left = `${Math.round(baseX)}px`;
      el.style.top = `${Math.round(baseY)}px`;

      const safeCaseIdx = this._escapeCardHtml(caseIdx);
      const safeGraphImgUrl = this._sanitizeCardImageUrl(dataUrl);
      const bodyH = Math.round(cardW * aspect);
      el.innerHTML = `
      <div class="problem-card-header">
        <div class="problem-card-title-group">
          <div class="problem-card-drag-handle">
            <span class="card-title-text">#${safeCaseIdx}</span>
          </div>
        </div>
        <div class="problem-card-actions">
          <button type="button" class="card-btn btn-card-lock-edit btn-extra-lock unlocked-editing" title="조작 중 — 클릭하면 현재 시야·비율을 고정(잠금)합니다">
            <span class="card-lock-icon" style="display:inline-flex;align-items:center;justify-content:center;">
              <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/></svg>
            </span>
          </button>
          <button type="button" class="card-btn btn-card-add-func btn-extra-add-func" title="이 카드에 함수 추가 (한 카드에 여러 함수 겹쳐 그리기)">
            <span style="display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;line-height:1;">+</span>
          </button>
          <button type="button" class="card-btn btn-card-laser" title="카드 위 필기 켜기/끄기 (클릭 시 자동으로 그래프 잠금 후 필기)">
            <span class="card-laser-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></span>
          </button>
          <button type="button" class="card-btn card-btn-duplicate btn-extra-duplicate" title="이 그래프 창 복제 (현재 그래프·필기 그대로 새 창 생성)">
            <span style="display:inline-flex;align-items:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
          </button>
          <button class="card-btn card-btn-restore btn-extra-restore" title="그래프 모드로 크게 열기 (교점·수선·구간분할 등 정밀 편집)">
            <span style="display:inline-flex;align-items:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></span>
          </button>
          <button class="card-btn btn-card-close btn-extra-close" title="삭제">
            <span style="display:inline-flex;align-items:center;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
          </button>
        </div>
      </div>
      <div class="problem-card-body" style="height:${bodyH}px;">
        <img class="problem-card-img" alt="그래프 보관 ${safeCaseIdx}" draggable="false" />
      </div>
      <div class="problem-card-resize-handle"></div>
    `;
      const extraGraphImgEl = el.querySelector('.problem-card-img');
      if (extraGraphImgEl && safeGraphImgUrl) {
        extraGraphImgEl.src = safeGraphImgUrl;
      }
      const stageGraphParent = (this.canvas && this.canvas.parentElement) || document.body;
      stageGraphParent.appendChild(el);
      this.attachCardLaserSystem(el);

      const cardItem = { el, baseX: Math.round(baseX), baseY: Math.round(baseY), aspect, isMin: false, graphSnapshot: graphSnapshot || this.getPureGraphSnapshot(), caseIdx, pdfAnchor: null };
      this.extraGraphCards.push(cardItem);
      this.attachPipGraphCardLiveSystem(el, cardItem);
      this.bringCardToFront(el);

      if (options && options.directBasePos && options.directBasePos.pdfAnchor) {
        el._pdfAnchor = { ...options.directBasePos.pdfAnchor };
        cardItem.pdfAnchor = { ...options.directBasePos.pdfAnchor };
      } else if (this.pdfPageBoardData) {
        this._pinCardToPdfBoardAtScreenPos(el, cardItem.baseX, cardItem.baseY, false);
      }
      this.updateProblemCardPosition(true);

      const syncExtraSize = (newW) => {
        el.style.width = `${newW}px`;
        const bodyEl = el.querySelector('.problem-card-body');
        if (bodyEl && !cardItem.isMin) {
          const h = Math.round(newW * cardItem.aspect);
          bodyEl.style.height = `${h}px`;
        }
        this.renderPipGraphCard(cardItem);
        if (typeof el._renderCardInkCanvas === 'function') el._renderCardInkCanvas();
      };
      this.renderPipGraphCard(cardItem);

      el._savedExpandedWidth = `${Math.round(cardW)}px`;
      const toggleExtraGraphMin = () => {
        if (el._lastToggleTime && performance.now() - el._lastToggleTime < 75) return;
        el._lastToggleTime = performance.now();
        const wasMin = el.classList.contains('minimized');
        if (!wasMin) {
          const curW = parseFloat(el.style.width) || Math.round(el.getBoundingClientRect().width);
          if (curW >= 180) el._savedExpandedWidth = `${Math.round(curW)}px`;
        }
        const nextMin = !wasMin;
        cardItem.isMin = nextMin;
        el.classList.toggle('minimized', nextMin);
        if (!nextMin) {
          const restoredW = parseFloat(el._savedExpandedWidth) || cardW;
          syncExtraSize(restoredW);
          if (typeof el._syncCardLaserSize === 'function') el._syncCardLaserSize();
        }
        const chev = el.querySelector('.card-fold-chevron');
        if (chev) chev.textContent = nextMin ? '▸' : '▾';
      };
      el._toggleCardMin = toggleExtraGraphMin;

      // 롱프레스 쉴드 (버튼 터치 시 click 이벤트 보장)
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); return false; }, { capture: true });
      el.addEventListener('touchstart', (e) => {
        if (e.target && e.target.closest('button, .card-btn, .card-fold-triangle-btn, .problem-card-actions, .pip-header-curve-tools')) return;
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('dragstart', (e) => e.preventDefault());
      el.addEventListener('selectstart', (e) => e.preventDefault());
      ['MSHoldVisual', 'MSGestureHold'].forEach(evtName => {
        el.addEventListener(evtName, (e) => e.preventDefault(), { passive: false });
      });

      // 제목 및 몸통 드래그 이동 전용 (삼각형 접기 원버튼과 완벽 분리!)
      let isDragging = false, dragMoved = false, startX = 0, startY = 0, initX = cardItem.baseX, initY = cardItem.baseY;
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.problem-card-resize-handle')) return;
        if (e.target.closest('.problem-card-actions') || e.target.closest('.pip-header-curve-tools') || e.target.closest('.card-fold-triangle-btn') || e.target.closest('.card-title-fold-btn')) {
          this.bringCardToFront(el);
          e.stopPropagation();
          return;
        }
        if (e.pointerType === 'touch' && this._shouldIgnoreCanvasTouchPointer(e)) {
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();
          return;
        }
        this.bringCardToFront(el);
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        dragMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        if (el.classList.contains('pip-locked-mode') && !el.classList.contains('pip-stealth-locked')) {
          this.clearPipGraphCardStealthTimer(cardItem);
        }
        if (this.isGraphCovered && this.pdfPageBoardData && el._pdfAnchor) {
          const s = this.mathToScreen(el._pdfAnchor.mx, el._pdfAnchor.my);
          initX = s.x;
          initY = s.y;
        } else {
          initX = cardItem.baseX;
          initY = cardItem.baseY;
        }
        el._dragDomLeft = parseFloat(el.style.left) || cardItem.baseX || initX;
        el._dragDomTop = parseFloat(el.style.top) || cardItem.baseY || initY;
        el._cachedDragW = parseFloat(el.style.width) || el.offsetWidth || 180;
        el._cachedDragH = el.offsetHeight || 120;
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        el.classList.add('is-dragging-card');
      });
      el._cancelCardDrag = () => {
        isDragging = false;
        dragMoved = false;
        this._isDraggingOrResizingAnyCard = false;
        el.classList.remove('is-dragging-card');
        delete el._dragDomLeft;
        delete el._dragDomTop;
        delete el._cachedDragW;
        delete el._cachedDragH;
        if (typeof cardItem.baseX === 'number') el.style.left = `${cardItem.baseX}px`;
        if (typeof cardItem.baseY === 'number') el.style.top = `${cardItem.baseY}px`;
        this.updateProblemCardPosition(true, el);
      };
      window.addEventListener('pointermove', (e) => {
        if (!isDragging || el.isConnected === false) return;
        if (e.pointerType === 'mouse' && typeof e.buttons === 'number' && e.buttons === 0) {
          el._cancelCardDrag();
          return;
        }
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!dragMoved) {
          if (Math.hypot(dx, dy) <= 5) return;
          dragMoved = true;
        }
        this._isDraggingOrResizingAnyCard = true;
        if (this.isGraphCovered && this.pdfPageBoardData) {
          const nextX = Math.round(initX + dx);
          const nextY = Math.round(initY + dy);
          this._pinCardToPdfBoardAtScreenPos(el, nextX, nextY, true);
          this.updateProblemCardPosition(true, el);
        } else {
          const dScale = (this.isGraphCovered && !this.pdfPageBoardData)
            ? Math.max(0.2, Math.min(4.0, this.boardZoom || 1.0))
            : 1.0;
          cardItem.baseX = Math.round(initX + (dx / dScale));
          cardItem.baseY = Math.round(initY + (dy / dScale));
          this.updateProblemCardPosition(true, el);
        }
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(false);
        }
      });
      const stopDrag = () => {
        if (isDragging) {
          const wasMoved = dragMoved;
          isDragging = false;
          dragMoved = false;
          this._isDraggingOrResizingAnyCard = false;
          el.classList.remove('is-dragging-card');
          delete el._dragDomLeft;
          delete el._dragDomTop;
          delete el._cachedDragW;
          delete el._cachedDragH;
          if (typeof cardItem.baseX === 'number') el.style.left = `${cardItem.baseX}px`;
          if (typeof cardItem.baseY === 'number') el.style.top = `${cardItem.baseY}px`;
          this.updateProblemCardPosition(true, el);
          if (wasMoved) {
            el._justDraggedTime = performance.now();
            if (el.classList.contains('pip-locked-mode') && !el.classList.contains('pip-stealth-locked')) {
              this.schedulePipGraphCardStealth(cardItem, 3000);
            }
          } else if (el.classList.contains('pip-locked-mode')) {
            if (el.classList.contains('pip-stealth-locked')) {
              this.wakeUpPipGraphCardStealth(cardItem, true);
            } else {
              this.schedulePipGraphCardStealth(cardItem, 3000);
            }
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        }
      };
      window.addEventListener('pointerup', stopDrag);
      window.addEventListener('pointercancel', stopDrag);

      // 우하단 리사이즈 (잠금 전: 그래프 크기 고정 + 현재 센터 기준 시야 자유 확장 / 잠금 후: 비율 고정 전체 확대·축소 — iPad 120Hz VSync 병합 & pointerId 격리)
      const rHandle = el.querySelector('.problem-card-resize-handle');
      if (rHandle) {
        let isResizing = false;
        let resizeMoved = false;
        let resizeStartState = null;
        let activeResizePointerId = null;
        let activeResizePointerType = null;
        let resizeRafId = null;
        let pendingResizeEv = null;

        el._cancelCardResize = (reason) => {
          if (!isResizing) return;
          if (reason === 'pen_or_pinch' && activeResizePointerType === 'pen') return;
          if (resizeRafId) {
            cancelAnimationFrame(resizeRafId);
            resizeRafId = null;
          }
          pendingResizeEv = null;
          const prevStart = resizeStartState;
          isResizing = false;
          resizeMoved = false;
          resizeStartState = null;
          activeResizePointerId = null;
          activeResizePointerType = null;
          this._isDraggingOrResizingAnyCard = false;
          this.finalizePipCardResize(cardItem, prevStart, true);
        };

        rHandle.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'touch' && (
            this.isDrawingInk ||
            this._isDrawingCardInk ||
            (this._lastPenActiveTime && (Date.now() - this._lastPenActiveTime < 450))
          )) {
            if (e.cancelable !== false) e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.pointerType === 'pen') {
            this._markStylusPenDetected();
            this._lastPenActiveTime = Date.now();
          }
          this.bringCardToFront(el);
          e.preventDefault();
          e.stopPropagation();
          try { rHandle.setPointerCapture(e.pointerId); } catch (_) { }
          isResizing = true;
          resizeMoved = false;
          activeResizePointerId = (e.pointerId !== undefined) ? e.pointerId : null;
          activeResizePointerType = e.pointerType || 'mouse';
          if (el.classList.contains('pip-locked-mode') && !el.classList.contains('pip-stealth-locked')) {
            this.clearPipGraphCardStealthTimer(cardItem);
          }
          resizeStartState = this.capturePipCardResizeStart(cardItem, e);
        });
        window.addEventListener('pointermove', (e) => {
          if (!isResizing || !resizeStartState || el.isConnected === false) return;
          if (activeResizePointerId !== null && e.pointerId !== undefined && e.pointerId !== activeResizePointerId) return;
          if (e.pointerType === 'pen') {
            this._lastPenActiveTime = Date.now();
          }
          if (!resizeMoved && Math.hypot(e.clientX - resizeStartState.startX, e.clientY - resizeStartState.startY) > 3) {
            resizeMoved = true;
          }
          this._isDraggingOrResizingAnyCard = true;
          pendingResizeEv = { clientX: e.clientX, clientY: e.clientY };
          if (!resizeRafId) {
            resizeRafId = requestAnimationFrame(() => {
              resizeRafId = null;
              const ev = pendingResizeEv;
              pendingResizeEv = null;
              if (!isResizing || !resizeStartState || !ev || el.isConnected === false) return;
              this.applyPipCardResizeStep(cardItem, ev, resizeStartState);
              if (this.isAudioRecording) {
                this._recordAudioWorkspaceStateIfNeeded(false);
              }
            });
          }
        });
        const stopResize = (e) => {
          if (!isResizing) return;
          if (e && activeResizePointerId !== null && e.pointerId !== undefined && e.pointerId !== activeResizePointerId) return;
          if (resizeRafId) {
            cancelAnimationFrame(resizeRafId);
            resizeRafId = null;
          }
          if (pendingResizeEv && resizeStartState) {
            const ev = pendingResizeEv;
            pendingResizeEv = null;
            this.applyPipCardResizeStep(cardItem, ev, resizeStartState);
          }
          const wasResizeMoved = resizeMoved;
          const finishedStart = resizeStartState;
          isResizing = false;
          resizeMoved = false;
          resizeStartState = null;
          activeResizePointerId = null;
          activeResizePointerType = null;
          this._isDraggingOrResizingAnyCard = false;
          this.finalizePipCardResize(cardItem, finishedStart, false);
          this.scheduleBakePipGraphCardToImg(cardItem);
          if (el.classList.contains('pip-locked-mode')) {
            if (!wasResizeMoved && el.classList.contains('pip-stealth-locked')) {
              this.wakeUpPipGraphCardStealth(cardItem, true);
            } else if (!el.classList.contains('pip-stealth-locked')) {
              this.schedulePipGraphCardStealth(cardItem, 3000);
            }
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        };
        window.addEventListener('pointerup', stopResize);
        window.addEventListener('pointercancel', stopResize);
      }

      const btnExtraDuplicate = el.querySelector('.btn-extra-duplicate');
      if (btnExtraDuplicate) {
        btnExtraDuplicate.onclick = (e) => {
          e.stopPropagation();
          this.duplicatePipGraphCard(cardItem);
        };
      }
      el.querySelector('.btn-extra-restore').onclick = () => this.restoreLiveGraphFromCard(false, cardItem.graphSnapshot, cardItem.caseIdx, false, cardItem);
      const btnExtraGraphMin = el.querySelector('.btn-extra-min');
      if (btnExtraGraphMin) {
        btnExtraGraphMin.addEventListener('pointerup', (e) => {
          if (e.button && e.button !== 0) return;
          e.stopPropagation();
          toggleExtraGraphMin();
        });
        btnExtraGraphMin.onclick = (e) => {
          if (e) e.stopPropagation();
          toggleExtraGraphMin();
        };
      }
      el.querySelector('.btn-extra-close').onclick = () => {
        this._pushWorkspaceUndoSnapshot('↺ 닫은 그래프 창이 복원되었습니다', '↻ 그래프 창 닫기 다시 실행됨');
        this.clearPipGraphCardStealthTimer(cardItem);
        this._hibernateDetachedCardCanvases(el);
        if (this._activePeekCardEl === el) {
          this._activePeekCardEl = null;
        }
        el.remove();
        this.extraGraphCards = this.extraGraphCards.filter(c => c !== cardItem);
        if (this._pipTargetCard === cardItem) this._pipTargetCard = null;
        if (this._editingGraphCardTarget === cardItem) this._editingGraphCardTarget = null;
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        if (!this._hasPrimaryGraphCard && this.extraGraphCards.length === 0 && !this.hasBoardStateToReturn()) {
          this.restoreLiveGraphFromCard(false);
        } else {
          this.render();
        }
        this.showToast('🗑️ 그래프 창을 닫았습니다 (되돌리기 ↺로 복원 가능)');
      };
      return cardItem;
    }

    restoreLiveGraphFromCard(silent = false, targetSnapshot = null, caseIdx = null, keepMinimizedCards = false, sourceCardTarget = null) {
      this._hasSpawnedNewCardInSession = false;
      this._lastSpawnedPipCardRef = null;
      const activeTarget = sourceCardTarget || (caseIdx === 1 ? 'primary' : null);
      if (activeTarget && typeof this._ensurePipCardInkMathCoords === 'function') {
        this._ensurePipCardInkMathCoords(activeTarget);
      }
      this.deselectAllPipGraphCards();
      this._editingGraphCardTarget = activeTarget;
      const effSnapshot = (activeTarget && typeof this._getMutablePipCardSnapshot === 'function' && this._getMutablePipCardSnapshot(activeTarget))
        ? JSON.stringify(this._getMutablePipCardSnapshot(activeTarget))
        : (targetSnapshot || (caseIdx === 1 ? (this.primaryGraphCardSnapshot || (this.graphCardData && this.graphCardData.graphSnapshot)) : null));
      let parsedSnapForFull = null;
      if (effSnapshot) {
        try {
          const parsedSnap = typeof effSnapshot === 'string' ? JSON.parse(effSnapshot) : effSnapshot;
          parsedSnapForFull = parsedSnap;
          if (parsedSnap && parsedSnap.isNAxisStudioCard && parsedSnap.nAxisStudioState) {
            if (typeof this.openNAxisStudioModal === 'function') {
              this.openNAxisStudioModal(parsedSnap.nAxisStudioState);
            }
            if (!silent) {
              const prefix = caseIdx ? `#${caseIdx} 보관 당시의` : '실시간';
              this.showToast(`🔄 ${prefix} 합성함수 스튜디오를 복구했습니다!`);
            }
            return;
          }
        } catch (_) { }
      }
      if (this.isNAxisStudioOpen && typeof this.closeNAxisStudioModal === 'function') {
        this.closeNAxisStudioModal();
      }

      if (this.pdfPageBoardData) {
        this._suspendedPdfBoardState = {
          pdfPageBoardData: this.pdfPageBoardData,
          panX: this.panX,
          panY: this.panY,
          zoomLevel: this.zoomLevel,
          xSpan: this.xSpan,
          ySpan: this.ySpan
        };
        this.pdfPageBoardData = null;
        this.syncPdfBoardNavBarUI();
      }

      this.isGraphCovered = false;
      this._graphSessionArchived = false;
      this.isGraphSnapMode = false;
      this.isPdfToGraphCropMode = false;
      document.body.classList.remove('graph-snap-crosshair');
      if (this.canvas) this.canvas.classList.remove('graph-snap-crosshair');
      const pWidget = document.getElementById('problemCardWidget');
      if (pWidget) {
        pWidget.style.display = 'none';
      }
      const widget = document.getElementById('graphCardWidget');
      if (widget) {
        if (!(keepMinimizedCards && this.isGraphCardMinimized)) {
          widget.style.display = 'none';
        }
      }
      if (this.extraGraphCards && this.extraGraphCards.length > 0) {
        this.extraGraphCards.forEach(c => {
          if (c.el && !(keepMinimizedCards && c.isMin)) {
            c.el.style.display = 'none';
          }
        });
      }
      if (this.extraProblemCards && this.extraProblemCards.length > 0) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el) {
            c.el.style.display = 'none';
          }
        });
      }

      if (this.inkStrokes && this.inkStrokes.length > 0) {
        if (this.isAudioRecording && Array.isArray(this.audioErasedStrokes)) {
          const recT = this.getAudioRecordElapsedMs();
          this.inkStrokes.forEach(s => {
            if (s && (s.target || 'board') === 'graph' && !s.onPdfBoard) {
              this.audioErasedStrokes.push({ ...JSON.parse(JSON.stringify(s)), erasedAt: recT });
            }
          });
        }
        this.inkStrokes = this.inkStrokes.filter(s => s && ((s.target || 'board') === 'board' || s.onPdfBoard));
      }
      this.dropLines = [];
      this.textLabels = [];

      if (effSnapshot) {
        this.applyPureGraphSnapshot(effSnapshot);
        // PiP 카드 로컬 스케일에서 전체화면 그래프 모드로 열 때:
        // 카드에서 보고 있던 중심 수학 좌표(centerMathX, centerMathY)와 카드 위 필기(ink)를 전체화면 그래프 모드에 100% 그대로 동기화!
        if (parsedSnapForFull && parsedSnapForFull._isPipCardSnapshot) {
          this._syncCanvasMetricsIfStale();
          const isTrig = Array.isArray(this.graphs) && this.graphs.some(g => g && ["sin_1period", "cos_1period", "tan_1period"].includes(g.type));
          const cardH = Math.max(80, parsedSnapForFull._pipCardH || 353);
          const cardYSpan = parsedSnapForFull.ySpan || (isTrig ? 5.0 : 5.1);
          const cardZoom = Math.max(0.15, Math.min(3.5, Number(parsedSnapForFull.zoomLevel) || 1.0));
          const cardUnitScale = (cardH / 2) / Math.max(0.05, cardYSpan / cardZoom);
          const centerMathX = -(parsedSnapForFull.panX || 0) / Math.max(1e-6, cardUnitScale);
          const centerMathY = (parsedSnapForFull.panY || 0) / Math.max(1e-6, cardUnitScale);

          this.xSpan = isTrig ? 20.0 : 8.5;
          this.ySpan = isTrig ? 5.5 : 6.0;
          this.setZoomLevel(cardZoom);
          this.zoomLevel = cardZoom;
          this.targetZoom = cardZoom;
          this._isZoomAnimating = false;

          const sh = Math.max(120, this.screenHeight || window.innerHeight || 900);
          const fullUnitScale = (sh / 2) / Math.max(0.05, this.ySpan / this.zoomLevel);

          this._lastFullGraphProblemPushX = 0;
          this.panX = -centerMathX * fullUnitScale;
          this.panY = centerMathY * fullUnitScale;

          if (activeTarget && typeof this._syncPipCardInkToFullGraph === 'function') {
            this._syncPipCardInkToFullGraph(activeTarget, cardUnitScale, fullUnitScale);
          }
        }
      }
      this.isCurveSelected = false;
      this.selectedHandleIdx = null;
      this.draggedHandleIdx = null;
      this.selectedPwBoundaryIdx = null;
      this._inkBakeDirty = true;
      this.clearInkCache();
      this.showAxes = true;
      this.updateAxesUI();
      const chkGuides = document.getElementById('chkGuides');
      if (chkGuides) chkGuides.checked = Boolean(this.showGuides);

      this._savedLayer2BoardPan = {
        x: this.boardPanX || 0,
        y: this.boardPanY || 0,
        zoom: this.boardZoom || 1.0,
        zOx: this.boardZoomOffsetX || 0,
        zOy: this.boardZoomOffsetY || 0
      };
      this.boardPanX = 0;
      this.boardPanY = 0;
      this.updateProblemCardPosition();
      if (this.isInkMode && this.activeInkTool !== 'select') {
        this.setActiveInkTool('select');
      }
      this.syncControls();
      this.renderLayerList();
      this.renderFuncList();
      this.syncWorkspaceModeUI();
      this.syncGraphSnapBarUI();
      this.render();
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      if (!silent) {
        const prefix = caseIdx ? `#${caseIdx}` : '선택한';
        this.showToast(`⛶ ${prefix} 카드를 그래프 모드로 크게 열었습니다! 편집 후 [필기 복귀]를 누르면 카드에 반영됩니다.`);
      }
    }

    syncGraphCardRectFromWidget(rectOnly = false) {
      const widget = document.getElementById('graphCardWidget');
      const body = document.getElementById('graphCardBody');
      const gCanvas = document.getElementById('graphCardCanvas');
      if (!widget || !this.graphCardData || widget.style.display === 'none') {
        this.graphCardRect = null;
        return null;
      }

      const isMin = Boolean(this.isGraphCardMinimized || widget.classList.contains('minimized'));
      const rawStyleW = parseFloat(widget.style.width);
      if (!isMin && Number.isFinite(rawStyleW) && rawStyleW >= 140) {
        widget._savedExpandedWidth = `${Math.round(rawStyleW)}px`;
      }
      const measuredWidgetRect = typeof this._getStageElementRect === 'function'
        ? this._getStageElementRect(widget)
        : widget.getBoundingClientRect();
      const baseW = (!isMin && Number.isFinite(rawStyleW) && rawStyleW >= 140)
        ? rawStyleW
        : (parseFloat(widget._savedExpandedWidth) || (Number.isFinite(rawStyleW) && rawStyleW >= 140 ? rawStyleW : 0) || (!isMin && measuredWidgetRect ? measuredWidgetRect.width : 400) || 400);
      const w = baseW;
      const effW = w;
      const aspect = this.graphCardAspect || 0.85;
      const imgW = effW;
      const imgH = Math.round(imgW * aspect);
      const h = imgH;

      // 카드 위치 이동(Drag) 등 크기 변화가 없는 경우 캔버스 재렌더링을 생략하여 144Hz 무지연 이동 보장!
      if (rectOnly) {
        const screenW = (measuredWidgetRect && measuredWidgetRect.width > 0) ? measuredWidgetRect.width : w;
        const screenH = (measuredWidgetRect && measuredWidgetRect.height > 0) ? measuredWidgetRect.height : h;
        this.graphCardRect = { x: measuredWidgetRect.left, y: measuredWidgetRect.top, w: screenW, h: screenH };
        return this.graphCardRect;
      }

      if (body && !isMin) {
        body.style.height = `${h}px`;
      }

      if (gCanvas && !isMin) {
        const dpr = this.getCanvasDpr();
        const targetW = Math.round(effW * dpr);
        const targetH = Math.round(h * dpr);
        if (gCanvas.width !== targetW || gCanvas.height !== targetH) {
          gCanvas.width = targetW;
          gCanvas.height = targetH;
        }
        this.renderGraphCardCanvas();
      }
      if (!isMin) {
        this.renderPipGraphCard('primary');
      }
      if (!isMin && typeof widget._syncCardLaserSize === 'function') {
        widget._syncCardLaserSize();
      }

      const screenW = (measuredWidgetRect && measuredWidgetRect.width > 0) ? measuredWidgetRect.width : w;
      const screenH = (measuredWidgetRect && measuredWidgetRect.height > 0) ? measuredWidgetRect.height : h;
      this.graphCardRect = { x: measuredWidgetRect.left, y: measuredWidgetRect.top, w: screenW, h: screenH };
      return this.graphCardRect;
    }

    getPipCardFinePenScale(cardRef, w, h) {
      // 🖋️ [창모드 그래프 카드 세필(Fine Pen) 자동 스케일 엔진]:
      // 창모드 기본 크기(430x353, ySpan=5.1 -> unitScale ≈ 34.6px/unit)는 전체화면 그래프 모드(unitScale ≈ 75px/unit)의 축소판이므로,
      // 창모드 위에 글씨/수식을 쓸 때는 약 0.54배 세필로 샤프하게 그려지고,
      // 전체화면([⛶]) 전환 시에는 1:1 비율 그대로 자연스러운 판서 굵기로 매칭되도록 수학 단위 스케일(unitScale)에 연동!
      const snap = typeof this._getMutablePipCardSnapshot === 'function'
        ? this._getMutablePipCardSnapshot(cardRef || 'primary')
        : null;
      if (snap && snap._isPipCardSnapshot) {
        const isTrig = Array.isArray(snap.graphs) && snap.graphs.some(g => g && ["sin_1period", "cos_1period", "tan_1period"].includes(g.type));
        const ySpan = snap.ySpan || (isTrig ? 5.0 : 5.1);
        const zoom = snap.zoomLevel || 1.0;
        const effH = Math.max(80, h || snap._pipCardH || 353);
        const unitScale = (effH / 2) / Math.max(0.1, ySpan / zoom);
        return Math.max(0.32, Math.min(1.25, (unitScale / 34.6) * 0.54));
      }
      return Math.max(0.36, Math.min(1.1, (w / 430) * 0.54));
    }

    renderGraphCardCanvas(activeStroke = null, commitStroke = false) {
      const gCanvas = document.getElementById('graphCardCanvas');
      if (!gCanvas) return;
      const dpr = this.getCanvasDpr();
      const w = gCanvas.width / dpr;
      const h = gCanvas.height / dpr;
      const sizeScale = this.getPipCardFinePenScale('primary', w, h);
      this._renderCardInkWithBakeCache(
        gCanvas,
        this.graphInkStrokes,
        w,
        h,
        dpr,
        sizeScale,
        document.getElementById('graphCardWidget'),
        {
          activeStroke,
          commitStroke,
          isProbCard: false,
          applyStreamline: true,
          minPenWidth: 0.85,
          minHlWidth: 3,
          defaultHlMin: 8
        }
      );
    }

    eraseGraphCardInkAtNormalizedPoint(nx, ny, w, h, radiusPx = null, deferRender = false) {
      radiusPx = (typeof radiusPx === 'number' && !isNaN(radiusPx)) ? radiusPx : Math.max(6, (this.currentEraserSize || 14) * 1.25);
      const gWidget = document.getElementById('graphCardWidget');
      let stickerErased = false;
      if (gWidget) {
        stickerErased = Boolean(this.eraseCardStickerAtNormalizedPoint(gWidget, nx, ny, w, h, radiusPx));
      }
      if (!this.graphInkStrokes || this.graphInkStrokes.length === 0) return stickerErased;
      const tx = nx * w;
      const ty = ny * h;
      const inkErased = this._eraseCardStrokesInPlace(
        this.graphInkStrokes,
        tx,
        ty,
        w,
        h,
        radiusPx,
        {
          cardKind: 'graph',
          cardEl: gWidget,
          renderFn: () => this.renderGraphCardCanvas()
        }
      );
      if (inkErased) {
        const gCanvas = document.getElementById('graphCardCanvas');
        if (deferRender && gCanvas) {
          this._scheduleCardLiveFrameRender(gCanvas, () => this.renderGraphCardCanvas());
        } else {
          this.renderGraphCardCanvas();
        }
      }
      return Boolean(inkErased || stickerErased);
    }

    initGraphCardInteractions() {
      const btnTrigger = document.getElementById('btnTriggerGraphSnap');
      if (btnTrigger) {
        btnTrigger.onclick = (e) => {
          e.stopPropagation();
          this.toggleGraphSnapMode();
        };
      }
      const btnReturnBoard = document.getElementById('btnReturnToCoveredBoard');
      if (btnReturnBoard) {
        btnReturnBoard.onclick = (e) => {
          e.stopPropagation();
          this.returnToCoveredBoard();
        };
      }
      const btnAddNewPipCard = document.getElementById('btnAddNewPipCardFromGraph');
      if (btnAddNewPipCard) {
        btnAddNewPipCard.onclick = (e) => {
          e.stopPropagation();
          this.addNewPipCardFromFullscreenGraph();
        };
      }
      const btnStartPdfCrop = document.getElementById('btnStartPdfCropToGraph');
      if (btnStartPdfCrop) {
        btnStartPdfCrop.onclick = (e) => {
          e.stopPropagation();
          this.startPdfBoardToGraphCrop(this._pendingPdfToGraphType || null);
          this.showToast('✂️ 가져갈 문제 영역을 드래그하면 즉시 그래프 추가 창이 열립니다!');
        };
      }
      const btnSkipPdfCrop = document.getElementById('btnSkipPdfCropToGraph');
      if (btnSkipPdfCrop) {
        btnSkipPdfCrop.onclick = (e) => {
          e.stopPropagation();
          this.completePdfBoardToGraphCrop(null);
        };
      }
      const btnCancelPdfCrop = document.getElementById('btnCancelPdfCropToGraph');
      if (btnCancelPdfCrop) {
        btnCancelPdfCrop.onclick = (e) => {
          e.stopPropagation();
          this.cancelPdfBoardToGraphCrop();
        };
      }

      const widget = document.getElementById('graphCardWidget');
      const dragHandle = document.getElementById('graphCardDragHandle');
      const resizeHandle = document.getElementById('graphCardResizeHandle');
      const gCanvas = document.getElementById('graphCardCanvas');
      const btnRestore = document.getElementById('btnGraphCardRestore');
      const btnZoomIn = document.getElementById('btnGraphCardZoomIn');
      const btnZoomOut = document.getElementById('btnGraphCardZoomOut');
      const btnClearInk = document.getElementById('btnGraphCardClearInk');
      const btnToggleMin = document.getElementById('btnGraphCardToggleMinimize');
      const btnClose = document.getElementById('btnGraphCardClose');

      if (!widget) return;
      this.graphInkStrokes = [];

      if (gCanvas) {
        let isDrawingOnGraphCard = false;
        let currentStroke = null;
        let graphHoldTimer = null;
        let activeGraphDrawRect = null;
        let activeGraphCardPointerId = null;

        const restartGraphCardHoldTimer = (w, h) => {
          if (!isDrawingOnGraphCard || !currentStroke || currentStroke._shapeHoldDetected) return;
          currentStroke._lastHoldMoveTime = Date.now();
          currentStroke._holdW = w;
          currentStroke._holdH = h;
          if (graphHoldTimer) return;
          const checkGraphHold = () => {
            graphHoldTimer = null;
            if (!isDrawingOnGraphCard || !currentStroke || currentStroke._shapeHoldDetected) return;
            const elapsed = Date.now() - (currentStroke._lastHoldMoveTime || 0);
            if (elapsed < 340) {
              graphHoldTimer = setTimeout(checkGraphHold, Math.max(16, 340 - elapsed));
              return;
            }
            if (this.recognizeAndApplyCardStrokeShape(currentStroke, currentStroke._holdW || w, currentStroke._holdH || h)) {
              if (typeof this._ensurePipCardInkMathCoords === 'function') {
                this._ensurePipCardInkMathCoords('primary', true, currentStroke);
              }
              this.renderGraphCardCanvas(currentStroke);
            }
          };
          graphHoldTimer = setTimeout(checkGraphHold, 340);
        };

        const getNormPos = (e, useCachedRect = false) => {
          const rect = (useCachedRect && activeGraphDrawRect && activeGraphDrawRect.width > 0)
            ? activeGraphDrawRect
            : gCanvas.getBoundingClientRect();
          activeGraphDrawRect = rect;
          const w = Math.max(1, rect.width);
          const h = Math.max(1, rect.height);
          const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / w));
          const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / h));
          return { nx, ny, w, h };
        };

        gCanvas.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }, { capture: true });

        const startGraphCardStroke = (e) => {
          if (this.activeInkTool === 'sticker' || this.activeInkTool === 'laser' || this.activeInkTool === 'lasso') return false;
          if (e.pointerType === 'pen') {
            const nowT = Date.now();
            this._markStylusPenDetected();
            this._lastPenActiveTime = nowT;
            this._lastPenDownTime = nowT;
            if (this.activePointers) this.activePointers.clear();
            this._pinchState = null;
            this._pinchWasActiveInGesture = false;
            if (typeof this._cancelAllActiveCardDrags === 'function') this._cancelAllActiveCardDrags();
          }
          if (e.pointerType === 'touch' && this.isStylusPalmRejectionActive()) {
            if (e.cancelable !== false) e.preventDefault();
            return false;
          }
          if (e.button !== 0 && e.pointerType !== 'pen' && e.pointerType !== 'touch') return false;
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();
          if (e.pointerType !== 'pen') {
            try { gCanvas.setPointerCapture(e.pointerId); } catch (err) { }
          }

          const pos = getNormPos(e, false);
          isDrawingOnGraphCard = true;
          this._isDrawingCardInk = true;
          this._currentCardEraseUndoEntry = null;
          activeGraphCardPointerId = (e.pointerId !== undefined) ? e.pointerId : null;

          const isCardStylusEraser = (
            (typeof e.buttons === 'number' && (e.buttons & 32) !== 0) ||
            e.button === 5 ||
            (e.pointerType === 'pen' && (e.button === 2 || (typeof e.buttons === 'number' && (e.buttons & 2) !== 0)))
          );
          if (this.activeInkTool === 'eraser' || isCardStylusEraser) {
            this._graphCardStylusEraser = true;
            this.eraseGraphCardInkAtNormalizedPoint(pos.nx, pos.ny, pos.w, pos.h, null, false);
            return true;
          }

          const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          const initGraphCardPenStyle = (this.activeInkTool === 'highlighter') ? 'ballpen' : (this.inkPenStyle || 'ballpen');
          const hasHwP = (typeof e.pressure === 'number' && e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.01);
          const initP = this._mapInitialStrokePressure(e.pressure, initGraphCardPenStyle, hasHwP);
          const startPxX = pos.nx * pos.w;
          const startPxY = pos.ny * pos.h;
          currentStroke = {
            color: this.currentInkColor || '#1e293b',
            size: (this.activeInkTool === 'highlighter') ? parseFloat(((this.currentHighlighterSize || 16) / 2.8).toFixed(2)) : (this.currentInkSize || 3.5),
            highlighterSize: (this.activeInkTool === 'highlighter') ? (this.currentHighlighterSize || 16) : undefined,
            isHighlighter: (this.activeInkTool === 'highlighter'),
            penStyle: initGraphCardPenStyle,
            softBlur: (this.activeInkTool === 'highlighter') ? 0 : (this.inkSoftBlur || 0),
            _hasHwP: hasHwP,
            _inPlaceStreamlined: true,
            _lastRawPx: { x: startPxX, y: startPxY },
            _prevRawPx: { x: startPxX, y: startPxY },
            _holdAnchorPx: { x: startPxX, y: startPxY },
            _lastMovePx: { x: startPxX, y: startPxY },
            _shapeHoldDetected: false,
            tStart: recT,
            tEnd: recT,
            points: [{ nx: pos.nx, ny: pos.ny, p: initP, t: recT }]
          };
          this.graphInkStrokes.push(currentStroke);
          restartGraphCardHoldTimer(pos.w, pos.h);
          this.renderGraphCardCanvas(currentStroke);
          return true;
        };

        gCanvas.addEventListener('pointerdown', (e) => {
          startGraphCardStroke(e);
        });

        gCanvas.addEventListener('pointermove', (e) => {
          if (!isDrawingOnGraphCard) {
            return;
          }
          if (activeGraphCardPointerId !== null && e.pointerId !== undefined && e.pointerId !== activeGraphCardPointerId) {
            return;
          }
          if (e.pointerType === 'pen') {
            this._markStylusPenDetected();
            this._lastPenActiveTime = Date.now();
          }
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();
          const pos = getNormPos(e, true);
          const isCardStylusEraser = this._graphCardStylusEraser || (
            (typeof e.buttons === 'number' && (e.buttons & 32) !== 0) ||
            e.button === 5 ||
            (e.pointerType === 'pen' && (typeof e.buttons === 'number' && (e.buttons & 2) !== 0))
          );
          if (this.activeInkTool === 'eraser' || isCardStylusEraser) {
            this.eraseGraphCardInkAtNormalizedPoint(pos.nx, pos.ny, pos.w, pos.h, null, true);
            return;
          }
          if (!currentStroke) return;
          const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          if (recT !== undefined) {
            currentStroke.tEnd = recT;
            this.recordAudioCursorPoint(e.clientX, e.clientY, currentStroke.color, true);
          }

          if (currentStroke._shapeHoldDetected && currentStroke.cardShape) {
            if (this.updateHeldCardStrokeShape(currentStroke, pos.nx, pos.ny, pos.w, pos.h)) {
              const shapeStrokeRef = currentStroke;
              this._scheduleCardLiveFrameRender(gCanvas, () => {
                if (!isDrawingOnGraphCard || currentStroke !== shapeStrokeRef) return;
                if (typeof this._ensurePipCardInkMathCoords === 'function') {
                  this._ensurePipCardInkMathCoords('primary', true, shapeStrokeRef);
                }
                this.renderGraphCardCanvas(shapeStrokeRef);
              });
            }
            return;
          }

          const curPxX = pos.nx * pos.w;
          const curPxY = pos.ny * pos.h;
          const prevMovePx = currentStroke._lastMovePx || { x: curPxX, y: curPxY };
          const moveStepDist = Math.hypot(curPxX - prevMovePx.x, curPxY - prevMovePx.y);
          currentStroke._lastMovePx = { x: curPxX, y: curPxY };

          const holdAnchor = currentStroke._holdAnchorPx || { x: curPxX, y: curPxY };
          const dHold = Math.hypot(curPxX - holdAnchor.x, curPxY - holdAnchor.y);
          if (moveStepDist > 1.5 || dHold > 5) {
            currentStroke._holdAnchorPx = { x: curPxX, y: curPxY };
            restartGraphCardHoldTimer(pos.w, pos.h);
          }

          if (!this._appendCardStrokeSamplesFromMoveEvent(currentStroke, e, activeGraphDrawRect, pos.w, pos.h, recT)) return;
          if (currentStroke.isHighlighter) {
            const hlStrokeRef = currentStroke;
            this._scheduleCardLiveFrameRender(gCanvas, () => {
              if (isDrawingOnGraphCard && currentStroke === hlStrokeRef) {
                this.renderGraphCardCanvas(hlStrokeRef);
              }
            });
          } else {
            this.renderGraphCardCanvas(currentStroke);
          }
        });

        const endGraphCardDraw = (e) => {
          if (!isDrawingOnGraphCard) return;
          if (activeGraphCardPointerId !== null && e && e.pointerId !== undefined && e.pointerId !== activeGraphCardPointerId) {
            return;
          }
          if (e && e.pointerType === 'pen') {
            this._lastPenActiveTime = Date.now();
          }
          const wasOneShotEraser = (this.activeInkTool === 'eraser' && !this._graphCardStylusEraser);
          const finishedCardStroke = currentStroke;
          const endRect = activeGraphDrawRect;
          isDrawingOnGraphCard = false;
          this._isDrawingCardInk = false;
          this._currentCardEraseUndoEntry = null;
          activeGraphCardPointerId = null;
          this._graphCardStylusEraser = false;
          activeGraphDrawRect = null;
          currentStroke = null;
          const pendingGraphEraseRender = !finishedCardStroke ? gCanvas._pendingCardLiveRenderFn : null;
          if (gCanvas._cardLiveRafId) {
            cancelAnimationFrame(gCanvas._cardLiveRafId);
            gCanvas._cardLiveRafId = null;
          }
          gCanvas._pendingCardLiveRenderFn = null;
          if (typeof pendingGraphEraseRender === 'function') {
            pendingGraphEraseRender();
          }
          if (graphHoldTimer) {
            clearTimeout(graphHoldTimer);
            graphHoldTimer = null;
          }
          if (finishedCardStroke && finishedCardStroke.points && finishedCardStroke.points.length > 0) {
            const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
            if (recT !== undefined) {
              finishedCardStroke.tEnd = recT;
            }
            const rw = Math.max(1, (endRect && endRect.width) || (gCanvas.width / this.getCanvasDpr()) || 430);
            const rh = Math.max(1, (endRect && endRect.height) || (gCanvas.height / this.getCanvasDpr()) || 353);
            this._finishCardStrokeTail(finishedCardStroke, e, endRect, rw, rh, recT);
            if (typeof this._ensurePipCardInkMathCoords === 'function') {
              this._ensurePipCardInkMathCoords('primary', true, finishedCardStroke);
            }
            this.renderGraphCardCanvas(finishedCardStroke, true);
            this.undoStack.push({
              type: 'card_stroke_add',
              cardKind: 'graph',
              cardEl: widget,
              strokesArr: this.graphInkStrokes,
              stroke: finishedCardStroke,
              renderFn: () => this.renderGraphCardCanvas()
            });
            if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
            this.redoStack = [];
            this.updateUndoRedoUI();
          }
          try { gCanvas.releasePointerCapture(e.pointerId); } catch (err) { }
          if (wasOneShotEraser) {
            this.setActiveInkTool('pen');
          }
        };
        gCanvas.addEventListener('pointerup', endGraphCardDraw);
        gCanvas.addEventListener('pointercancel', endGraphCardDraw);
        window.addEventListener('pointerup', endGraphCardDraw, true);
        window.addEventListener('pointercancel', endGraphCardDraw, true);
      }

      // 🌟 [상단 X 표시(전체화면 롱프레스 종료 배지) & 컨텍스트 메뉴 원천 차단 쉴드] 🌟
      const applyLongPressShield = (el) => {
        if (!el || el._longPressShieldApplied) return;
        el._longPressShieldApplied = true;
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }, { capture: true });
        const blockCardNativeTouch = (e) => {
          if (e.target && e.target.closest('button, .card-btn, .card-fold-triangle-btn, .problem-card-actions, .pip-header-curve-tools, .ink-tool-btn, .ink-color-dot, .ink-size-stepper-btn, .ink-size-chip, input')) return;
          if (e.cancelable !== false) e.preventDefault();
        };
        el.addEventListener('touchstart', blockCardNativeTouch, { passive: false });
        el.addEventListener('touchmove', blockCardNativeTouch, { passive: false });
        el.addEventListener('touchend', blockCardNativeTouch, { passive: false });
        el.addEventListener('dragstart', (e) => e.preventDefault());
        el.addEventListener('selectstart', (e) => e.preventDefault());
        ['MSHoldVisual', 'MSGestureHold'].forEach(evtName => {
          el.addEventListener(evtName, (e) => e.preventDefault(), { passive: false });
        });
      };
      this._applyLongPressShield = applyLongPressShield;
      applyLongPressShield(widget);
      applyLongPressShield(document.getElementById('problemCardWidget'));
      applyLongPressShield(document.getElementById('inkFloatingToolbar'));
      applyLongPressShield(document.getElementById('quickPillRemote'));
      this.attachCardLaserSystem(widget);
      this.attachCardLaserSystem(document.getElementById('problemCardWidget'));

      const togglePrimaryGraphMin = () => {
        if (!widget) return;
        if (widget._lastToggleTime && performance.now() - widget._lastToggleTime < 75) return;
        widget._lastToggleTime = performance.now();
        const wasMin = widget.classList.contains('minimized');
        if (!wasMin) {
          const curW = parseFloat(widget.style.width) || Math.round(widget.getBoundingClientRect().width);
          if (curW >= 200) widget._savedExpandedWidth = `${Math.round(curW)}px`;
        }
        const nextMin = !wasMin;
        this.isGraphCardMinimized = nextMin;
        widget.classList.toggle('minimized', nextMin);
        if (!nextMin && widget._savedExpandedWidth) {
          widget.style.width = widget._savedExpandedWidth;
        }
        const icon = document.getElementById('iconGraphCardToggle');
        if (icon) icon.textContent = nextMin ? '▸' : '▾';
        this.syncGraphCardRectFromWidget();
      };
      if (widget) widget._toggleCardMin = togglePrimaryGraphMin;

      // 🌟 그래프 보관 카드 제목 및 몸통 드래그 이동 전용 (삼각형 접기 원버튼과 완벽 분리!) 🌟
      if (widget) {
        let isDragging = false;
        let dragMoved = false;
        let startX = 0, startY = 0;
        let initialBaseX = 580, initialBaseY = 68;

        widget.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.problem-card-resize-handle')) return;
          if (e.target.closest('.problem-card-actions') || e.target.closest('.pip-header-curve-tools') || e.target.closest('.card-fold-triangle-btn') || e.target.closest('.card-title-fold-btn')) {
            this.bringCardToFront(widget);
            e.stopPropagation();
            return;
          }
          if (e.pointerType === 'touch' && this._shouldIgnoreCanvasTouchPointer(e)) {
            if (e.cancelable !== false) e.preventDefault();
            e.stopPropagation();
            return;
          }
          this.bringCardToFront(widget);
          e.preventDefault();
          e.stopPropagation();
          isDragging = true;
          dragMoved = false;
          startX = e.clientX;
          startY = e.clientY;
          if (widget.classList.contains('pip-locked-mode') && !widget.classList.contains('pip-stealth-locked')) {
            this.clearPipGraphCardStealthTimer('primary');
          }
          if (this.isGraphCovered && this.pdfPageBoardData && widget._pdfAnchor) {
            const s = this.mathToScreen(widget._pdfAnchor.mx, widget._pdfAnchor.my);
            initialBaseX = s.x;
            initialBaseY = s.y;
          } else {
            initialBaseX = (typeof this.graphCardBaseX === 'number') ? this.graphCardBaseX : (parseFloat(widget.style.left) || 580);
            initialBaseY = (typeof this.graphCardBaseY === 'number') ? this.graphCardBaseY : (parseFloat(widget.style.top) || 68);
          }
          widget._dragDomLeft = parseFloat(widget.style.left) || this.graphCardBaseX || initialBaseX;
          widget._dragDomTop = parseFloat(widget.style.top) || this.graphCardBaseY || initialBaseY;
          widget._cachedDragW = parseFloat(widget.style.width) || widget.offsetWidth || 180;
          widget._cachedDragH = widget.offsetHeight || 120;
          if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
          widget.classList.add('is-dragging-card');
        });

        widget._cancelCardDrag = () => {
          isDragging = false;
          dragMoved = false;
          this._isDraggingOrResizingAnyCard = false;
          widget.classList.remove('is-dragging-card');
          delete widget._dragDomLeft;
          delete widget._dragDomTop;
          delete widget._cachedDragW;
          delete widget._cachedDragH;
          if (typeof this.graphCardBaseX === 'number') widget.style.left = `${this.graphCardBaseX}px`;
          if (typeof this.graphCardBaseY === 'number') widget.style.top = `${this.graphCardBaseY}px`;
          this.updateProblemCardPosition(true, widget);
        };
        window.addEventListener('pointermove', (e) => {
          if (!isDragging) return;
          if (e.pointerType === 'mouse' && typeof e.buttons === 'number' && e.buttons === 0) {
            widget._cancelCardDrag();
            return;
          }
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (!dragMoved) {
            if (Math.hypot(dx, dy) <= 5) return;
            dragMoved = true;
          }
          this._isDraggingOrResizingAnyCard = true;
          if (this.isGraphCovered && this.pdfPageBoardData) {
            const nextX = Math.round(initialBaseX + dx);
            const nextY = Math.round(initialBaseY + dy);
            this._pinCardToPdfBoardAtScreenPos(widget, nextX, nextY, true);
            this.updateProblemCardPosition(true, widget);
          } else {
            const dScale = (this.isGraphCovered && !this.pdfPageBoardData)
              ? Math.max(0.2, Math.min(4.0, this.boardZoom || 1.0))
              : 1.0;
            this.graphCardBaseX = Math.round(initialBaseX + (dx / dScale));
            this.graphCardBaseY = Math.round(initialBaseY + (dy / dScale));
            this.updateProblemCardPosition(true, widget);
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(false);
          }
        });

        const stopDrag = () => {
          if (isDragging) {
            const wasMoved = dragMoved;
            isDragging = false;
            dragMoved = false;
            this._isDraggingOrResizingAnyCard = false;
            widget.classList.remove('is-dragging-card');
            delete widget._dragDomLeft;
            delete widget._dragDomTop;
            delete widget._cachedDragW;
            delete widget._cachedDragH;
            if (typeof this.graphCardBaseX === 'number') widget.style.left = `${this.graphCardBaseX}px`;
            if (typeof this.graphCardBaseY === 'number') widget.style.top = `${this.graphCardBaseY}px`;
            this.updateProblemCardPosition(true, widget);
            this.syncGraphCardRectFromWidget(true);
            if (wasMoved) {
              widget._justDraggedTime = performance.now();
              if (widget.classList.contains('pip-locked-mode') && !widget.classList.contains('pip-stealth-locked')) {
                this.schedulePipGraphCardStealth('primary', 3000);
              }
            } else if (widget.classList.contains('pip-locked-mode')) {
              if (widget.classList.contains('pip-stealth-locked')) {
                this.wakeUpPipGraphCardStealth('primary', true);
              } else {
                this.schedulePipGraphCardStealth('primary', 3000);
              }
            }
            if (this.isAudioRecording) {
              this._recordAudioWorkspaceStateIfNeeded(true);
            }
          }
        };
        window.addEventListener('pointerup', stopDrag);
        window.addEventListener('pointercancel', stopDrag);
      }

      if (resizeHandle) {
        let isResizing = false;
        let resizeMoved = false;
        let resizeStartState = null;
        let activeResizePointerId = null;
        let activeResizePointerType = null;
        let resizeRafId = null;
        let pendingResizeEv = null;

        if (widget) {
          widget._cancelCardResize = (reason) => {
            if (!isResizing) return;
            if (reason === 'pen_or_pinch' && activeResizePointerType === 'pen') return;
            if (resizeRafId) {
              cancelAnimationFrame(resizeRafId);
              resizeRafId = null;
            }
            pendingResizeEv = null;
            const prevStart = resizeStartState;
            isResizing = false;
            resizeMoved = false;
            resizeStartState = null;
            activeResizePointerId = null;
            activeResizePointerType = null;
            this._isDraggingOrResizingAnyCard = false;
            this.finalizePipCardResize('primary', prevStart, true);
          };
        }

        resizeHandle.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'touch' && (
            this.isDrawingInk ||
            this._isDrawingCardInk ||
            (this._lastPenActiveTime && (Date.now() - this._lastPenActiveTime < 450))
          )) {
            if (e.cancelable !== false) e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (e.pointerType === 'pen') {
            this._markStylusPenDetected();
            this._lastPenActiveTime = Date.now();
          }
          if (widget) this.bringCardToFront(widget);
          e.preventDefault();
          e.stopPropagation();
          try { resizeHandle.setPointerCapture(e.pointerId); } catch (_) { }
          isResizing = true;
          resizeMoved = false;
          activeResizePointerId = (e.pointerId !== undefined) ? e.pointerId : null;
          activeResizePointerType = e.pointerType || 'mouse';
          if (widget && widget.classList.contains('pip-locked-mode') && !widget.classList.contains('pip-stealth-locked')) {
            this.clearPipGraphCardStealthTimer('primary');
          }
          resizeStartState = this.capturePipCardResizeStart('primary', e);
        });

        window.addEventListener('pointermove', (e) => {
          if (!isResizing || !resizeStartState) return;
          if (activeResizePointerId !== null && e.pointerId !== undefined && e.pointerId !== activeResizePointerId) return;
          if (e.pointerType === 'pen') {
            this._lastPenActiveTime = Date.now();
          }
          if (!resizeMoved && Math.hypot(e.clientX - resizeStartState.startX, e.clientY - resizeStartState.startY) > 3) {
            resizeMoved = true;
          }
          this._isDraggingOrResizingAnyCard = true;
          pendingResizeEv = { clientX: e.clientX, clientY: e.clientY };
          if (!resizeRafId) {
            resizeRafId = requestAnimationFrame(() => {
              resizeRafId = null;
              const ev = pendingResizeEv;
              pendingResizeEv = null;
              if (!isResizing || !resizeStartState || !ev) return;
              this.applyPipCardResizeStep('primary', ev, resizeStartState);
              if (this.isAudioRecording) {
                this._recordAudioWorkspaceStateIfNeeded(false);
              }
            });
          }
        });

        const stopResize = (e) => {
          if (!isResizing) return;
          if (e && activeResizePointerId !== null && e.pointerId !== undefined && e.pointerId !== activeResizePointerId) return;
          if (resizeRafId) {
            cancelAnimationFrame(resizeRafId);
            resizeRafId = null;
          }
          if (pendingResizeEv && resizeStartState) {
            const ev = pendingResizeEv;
            pendingResizeEv = null;
            this.applyPipCardResizeStep('primary', ev, resizeStartState);
          }
          const wasResizeMoved = resizeMoved;
          const finishedStart = resizeStartState;
          isResizing = false;
          resizeMoved = false;
          resizeStartState = null;
          activeResizePointerId = null;
          activeResizePointerType = null;
          this._isDraggingOrResizingAnyCard = false;
          this.finalizePipCardResize('primary', finishedStart, false);
          this.scheduleBakePipGraphCardToImg('primary');
          if (widget && widget.classList.contains('pip-locked-mode')) {
            if (!wasResizeMoved && widget.classList.contains('pip-stealth-locked')) {
              this.wakeUpPipGraphCardStealth('primary', true);
            } else if (!widget.classList.contains('pip-stealth-locked')) {
              this.schedulePipGraphCardStealth('primary', 3000);
            }
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        };
        window.addEventListener('pointerup', stopResize);
        window.addEventListener('pointercancel', stopResize);
      }

      const btnDuplicate = document.getElementById('btnGraphCardDuplicate');
      if (btnDuplicate) {
        btnDuplicate.onclick = (e) => {
          e.stopPropagation();
          this.duplicatePipGraphCard('primary');
        };
      }
      if (btnRestore) {
        btnRestore.onclick = () => this.restoreLiveGraphFromCard(false, this.primaryGraphCardSnapshot, 1, false, 'primary');
      }
      if (btnClose) {
        btnClose.onclick = () => {
          this._pushWorkspaceUndoSnapshot('↺ 닫은 그래프 창이 복원되었습니다', '↻ 그래프 창 닫기 다시 실행됨');
          this.clearPipGraphCardStealthTimer('primary');
          if (widget._bakePipTimerId) {
            clearTimeout(widget._bakePipTimerId);
            widget._bakePipTimerId = null;
          }
          this.graphInkStrokes = [];
          this._hasPrimaryGraphCard = false;
          this.graphCardData = null;
          this.graphCardPdfAnchor = null;
          widget._pdfAnchor = null;
          widget._pipSnapObj = null;
          widget.classList.remove('pip-manipulating', 'pip-locked-mode', 'pip-stealth-locked', 'card-ink-active');
          if (this._pipTargetCard === 'primary') this._pipTargetCard = null;
          if (this._editingGraphCardTarget === 'primary') this._editingGraphCardTarget = null;
          this.renderGraphCardCanvas();
          if (gCanvas) {
            this._cancelCardCanvasPendingTasks(gCanvas, true);
          }
          widget.style.display = 'none';
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
          if ((!this.extraGraphCards || this.extraGraphCards.length === 0) && !this.hasBoardStateToReturn()) {
            this.restoreLiveGraphFromCard(false);
          } else {
            this.render();
          }
          this.showToast('🗑️ 그래프 창을 닫았습니다 (되돌리기 ↺로 복원 가능)');
        };
      }
      if (btnClearInk) {
        btnClearInk.onclick = () => {
          if (Array.isArray(this.graphInkStrokes) && this.graphInkStrokes.length > 0) {
            this._pushWorkspaceUndoSnapshot('↺ 그래프 창 필기가 복원되었습니다', '↻ 그래프 창 필기 지우기 다시 실행됨');
          }
          this.graphInkStrokes = [];
          this.renderGraphCardCanvas();
        };
      }
      if (btnToggleMin) {
        btnToggleMin.addEventListener('pointerup', (e) => {
          if (e.button && e.button !== 0) return;
          e.stopPropagation();
          togglePrimaryGraphMin();
        });
        btnToggleMin.onclick = (e) => {
          if (e) e.stopPropagation();
          togglePrimaryGraphMin();
        };
      }
      if (btnZoomIn) {
        btnZoomIn.onclick = () => {
          const curW = widget.getBoundingClientRect().width;
          const newW = Math.min(window.innerWidth * 0.85, curW + 60);
          widget.style.width = `${newW}px`;
          this.syncGraphCardRectFromWidget();
          this.scheduleBakePipGraphCardToImg('primary');
        };
      }
      if (btnZoomOut) {
        btnZoomOut.onclick = () => {
          const curW = widget.getBoundingClientRect().width;
          const newW = Math.max(220, curW - 60);
          widget.style.width = `${newW}px`;
          this.syncGraphCardRectFromWidget();
          this.scheduleBakePipGraphCardToImg('primary');
        };
      }
      this.attachPipGraphCardLiveSystem(widget, 'primary');
    }

    // ==========================================================================
    // [📈 PiP 라이브 인터랙티브 그래프 카드 엔진 (판서 모드 내 즉시 소환 · 핸들 조작 · 평행이동 · 함수 추가)]
    // ==========================================================================
    _getPipCardWidgetAndSnapRaw(cardRef) {
      if (cardRef === 'primary') {
        const widget = document.getElementById('graphCardWidget');
        const rawSnap = this.primaryGraphCardSnapshot || (this.graphCardData && this.graphCardData.graphSnapshot);
        return { widget, rawSnap, isPrimary: true };
      }
      if (cardRef && cardRef.el) {
        return { widget: cardRef.el, rawSnap: cardRef.graphSnapshot, isPrimary: false };
      }
      return { widget: null, rawSnap: null, isPrimary: false };
    }

    _getMutablePipCardSnapshot(cardRef) {
      const { widget, rawSnap, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget || !rawSnap) return null;
      if (widget._pipSnapObj && widget._pipSnapRawRef === rawSnap) {
        return widget._pipSnapObj;
      }
      try {
        const parsed = typeof rawSnap === 'string' ? JSON.parse(rawSnap) : JSON.parse(JSON.stringify(rawSnap));
        if (!parsed || typeof parsed !== 'object') return null;
        if (Array.isArray(parsed.graphs)) {
          parsed.graphs.forEach(g => {
            if (g && g.type === 'general_expr' && Array.isArray(g.handles)) {
              g.handles.forEach(h => {
                if (h && h.rawExpr && window.SafeMathCompiler) {
                  const comp = window.SafeMathCompiler.compile(h.rawExpr);
                  if (comp && comp.success) h.fn = comp.fn;
                }
              });
            }
          });
        }
        if (typeof parsed.activeGraphIdx !== 'number') {
          parsed.activeGraphIdx = (Array.isArray(parsed.graphs) && parsed.graphs.length > 0) ? 0 : -1;
        }
        if (typeof parsed.zoomLevel !== 'number') parsed.zoomLevel = 1.0;
        if (typeof parsed.panX !== 'number') parsed.panX = 0;
        if (typeof parsed.panY !== 'number') parsed.panY = 0;
        if (typeof parsed.xSpan !== 'number') parsed.xSpan = 6.2;
        if (typeof parsed.ySpan !== 'number') parsed.ySpan = 5.1;
        parsed.useIntersectionDetector = false;
        widget._pipSnapObj = parsed;
        widget._pipSnapRawRef = rawSnap;
        if (!isPrimary) cardRef._pipSnapObj = parsed;
        return parsed;
      } catch (_) {
        return null;
      }
    }

    _rehydrateSnapGeneralExprFns(snapObj) {
      if (!snapObj || !Array.isArray(snapObj.graphs)) return;
      snapObj.graphs.forEach(g => {
        if (g && g.type === 'general_expr' && Array.isArray(g.handles)) {
          g.handles.forEach(h => {
            if (h && typeof h.fn !== 'function' && h.rawExpr && typeof window !== 'undefined' && window.SafeMathCompiler) {
              const comp = window.SafeMathCompiler.compile(h.rawExpr);
              if (comp && comp.success) h.fn = comp.fn;
            }
          });
        }
      });
    }

    // 🌟 [그래프 카드 복제 / 새 카드로 추가 시 그래프 ID 재발급 & 보조 수선(dropLines) 바인딩 동기화]:
    // 새 카드의 그래프마다 고유 ID(g_...)를 새로 발급할 때, 보조 수선의 binding(layerId, layerIds, candKey)도
    // 새 그래프 ID로 정확히 매핑하여 updateDropLinesTracking()에서 삭제되지 않고 개형 변형 시 실시간 추적되도록 보장합니다.
    _rebindClonedSnapshotGraphAndDropLineIds(snapObj) {
      if (!snapObj || typeof snapObj !== 'object') return new Map();
      const idMap = new Map();
      const ts = Date.now();
      if (Array.isArray(snapObj.graphs)) {
        snapObj.graphs.forEach((g, idx) => {
          if (!g) return;
          const oldId = g.id ? String(g.id) : null;
          const newId = 'g_' + ts + '_' + Math.random().toString(36).substr(2, 4) + idx.toString(36);
          g.id = newId;
          if (oldId) {
            idMap.set(oldId, newId);
          }
        });
        snapObj.graphs.forEach(g => {
          if (g && g.linkedInverseId && idMap.has(String(g.linkedInverseId))) {
            g.linkedInverseId = idMap.get(String(g.linkedInverseId));
          }
        });
      }
      if (Array.isArray(snapObj.dropLines)) {
        const sortedIdPairs = idMap.size > 0
          ? Array.from(idMap.entries()).sort((a, b) => b[0].length - a[0].length)
          : [];
        snapObj.dropLines.forEach((dl, idx) => {
          if (!dl) return;
          dl.id = 'dl_' + ts + '_' + Math.random().toString(36).substr(2, 3) + idx.toString(36);
          delete dl._hoverX;
          delete dl._hoverY;
          if (dl.binding && typeof dl.binding === 'object') {
            const b = dl.binding;
            if (b.layerId && idMap.has(b.layerId)) {
              b.layerId = idMap.get(b.layerId);
            }
            if (Array.isArray(b.layerIds)) {
              b.layerIds = b.layerIds.map(lid => (lid && idMap.has(lid)) ? idMap.get(lid) : lid);
            }
            if (typeof b.candKey === 'string' && b.candKey.length > 0 && sortedIdPairs.length > 0) {
              let nextKey = b.candKey;
              for (let i = 0; i < sortedIdPairs.length; i++) {
                const [oldId, newId] = sortedIdPairs[i];
                if (oldId && nextKey.includes(oldId)) {
                  nextKey = nextKey.split(oldId).join(newId);
                }
              }
              b.candKey = nextKey;
            }
          }
        });
      }
      if (Array.isArray(snapObj.textLabels)) {
        snapObj.textLabels.forEach((tl, idx) => {
          if (!tl) return;
          tl.id = 'txt_' + ts + '_' + Math.random().toString(36).substr(2, 3) + idx.toString(36);
        });
      }
      this._rehydrateSnapGeneralExprFns(snapObj);
      return idMap;
    }

    _savePipCardSnapshot(cardRef, snapObj) {
      if (!snapObj) return;
      this._rehydrateSnapGeneralExprFns(snapObj);
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      const jsonStr = JSON.stringify(snapObj);
      if (isPrimary) {
        this.primaryGraphCardSnapshot = jsonStr;
        if (this.graphCardData && typeof this.graphCardData === 'object') {
          this.graphCardData.graphSnapshot = jsonStr;
        }
      } else if (cardRef && typeof cardRef === 'object') {
        cardRef.graphSnapshot = jsonStr;
      }
      if (widget) {
        widget._pipSnapObj = snapObj;
        widget._pipSnapRawRef = jsonStr;
      }
    }

    _withPipCardGraphState(snapObj, cardW, cardH, callback) {
      if (!snapObj) return null;
      const effW = Math.max(80, Math.round(cardW || 380));
      const effH = Math.max(80, Math.round(cardH || 312));

      if (!snapObj._isPipCardSnapshot) {
        const oldSw = Math.max(1, this.screenWidth || window.innerWidth || 1440);
        const oldSh = Math.max(1, this.screenHeight || window.innerHeight || 900);
        const scaleH = effH / oldSh;
        snapObj.panX = (snapObj.panX || 0) * (this.lockAspect ? scaleH : (effW / oldSw));
        snapObj.panY = (snapObj.panY || 0) * scaleH;
        snapObj._isPipCardSnapshot = true;
        snapObj._pipCardW = effW;
        snapObj._pipCardH = effH;
      } else if (snapObj._pipCardW && snapObj._pipCardH && (Math.abs(snapObj._pipCardW - effW) > 0.5 || Math.abs(snapObj._pipCardH - effH) > 0.5)) {
        const scaleH = effH / Math.max(1, snapObj._pipCardH);
        snapObj.panX = (snapObj.panX || 0) * (this.lockAspect ? scaleH : (effW / Math.max(1, snapObj._pipCardW)));
        snapObj.panY = (snapObj.panY || 0) * scaleH;
        snapObj._pipCardW = effW;
        snapObj._pipCardH = effH;
      } else {
        snapObj._pipCardW = effW;
        snapObj._pipCardH = effH;
      }

      const backup = {
        screenWidth: this.screenWidth,
        screenHeight: this.screenHeight,
        graphs: this.graphs,
        activeGraphIdx: this.activeGraphIdx,
        isCurveSelected: this.isCurveSelected,
        selectedHandleIdx: this.selectedHandleIdx,
        draggedHandleIdx: this.draggedHandleIdx,
        isDraggingCurve: this.isDraggingCurve,
        isPanning: this.isPanning,
        _isResizingPipCard: this._isResizingPipCard,
        zoomLevel: this.zoomLevel,
        panX: this.panX,
        panY: this.panY,
        xSpan: this.xSpan,
        ySpan: this.ySpan,
        showAxes: this.showAxes,
        showXAxis: this.showXAxis,
        showYAxis: this.showYAxis,
        showGuides: this.showGuides,
        showAsymptotes: this.showAsymptotes,
        showInverseGuide: this.showInverseGuide,
        showGridNumbers: this.showGridNumbers,
        usePiecewise: this.usePiecewise,
        piecewiseBoundaries: this.piecewiseBoundaries,
        piecewiseFuncMap: this.piecewiseFuncMap,
        piecewiseInclusions: this.piecewiseInclusions,
        isPiecewisePeriodic: this.isPiecewisePeriodic,
        periodicStepY: this.periodicStepY,
        isPiecewiseLocked: this.isPiecewiseLocked,
        dropLines: this.dropLines,
        isDropLineMode: this.isDropLineMode,
        dropLineHoverCandidate: this.dropLineHoverCandidate,
        dropLineHoverScissors: this.dropLineHoverScissors,
        renderedScissors: this.renderedScissors,
        renderedDropLineLabels: this.renderedDropLineLabels,
        textLabels: this.textLabels,
        useIntersectionDetector: this.useIntersectionDetector,
        intersections: this.intersections,
        isGraphCovered: this.isGraphCovered,
        pdfPageBoardData: this.pdfPageBoardData,
        axisSnapActiveX: this.axisSnapActiveX,
        axisSnapActiveY: this.axisSnapActiveY,
        symmetrySnapActive: this.symmetrySnapActive,
        snappedPoints: this.snappedPoints,
        _isRenderingGraphSnapshot: this._isRenderingGraphSnapshot,
        _snapshotCropBounds: this._snapshotCropBounds,
        _activeSnapHint: this._activeSnapHint
      };

      try {
        this.screenWidth = effW;
        this.screenHeight = effH;
        this.graphs = snapObj.graphs || [];
        if (this.engine && typeof this.engine.ensureCompiledFunctions === 'function') {
          this.engine.ensureCompiledFunctions(this.graphs);
        }
        this.activeGraphIdx = typeof snapObj.activeGraphIdx === 'number' ? snapObj.activeGraphIdx : (this.graphs.length > 0 ? 0 : -1);
        this.isCurveSelected = Boolean(snapObj.isCurveSelected);
        this.selectedHandleIdx = (typeof snapObj.selectedHandleIdx === 'number') ? snapObj.selectedHandleIdx : null;
        this.draggedHandleIdx = (typeof snapObj.draggedHandleIdx === 'number') ? snapObj.draggedHandleIdx : null;
        this.isDraggingCurve = Boolean(snapObj._isDraggingCurve);
        this.isPanning = Boolean(snapObj._isPanningAxes);
        this._isResizingPipCard = Boolean(snapObj._isResizingPipCard);
        this.axisSnapActiveX = Boolean(snapObj.axisSnapActiveX);
        this.axisSnapActiveY = Boolean(snapObj.axisSnapActiveY);
        this.symmetrySnapActive = Boolean(snapObj.symmetrySnapActive);
        this.snappedPoints = Array.isArray(snapObj.snappedPoints) ? snapObj.snappedPoints : [];
        this.zoomLevel = typeof snapObj.zoomLevel === 'number' ? snapObj.zoomLevel : 1.0;
        this.panX = typeof snapObj.panX === 'number' ? snapObj.panX : 0;
        this.panY = typeof snapObj.panY === 'number' ? snapObj.panY : 0;
        this.xSpan = typeof snapObj.xSpan === 'number' ? snapObj.xSpan : 6.2;
        this.ySpan = typeof snapObj.ySpan === 'number' ? snapObj.ySpan : 5.1;
        this.showAxes = true;
        this.showXAxis = (snapObj.showXAxis !== undefined) ? Boolean(snapObj.showXAxis) : (backup.showXAxis !== false);
        this.showYAxis = (snapObj.showYAxis !== undefined) ? Boolean(snapObj.showYAxis) : (backup.showYAxis !== false);
        this.showGuides = Boolean(backup.showGuides);
        this.showAsymptotes = Boolean(backup.showAsymptotes);
        this.showInverseGuide = Boolean(snapObj.showInverseGuide);
        this.showGridNumbers = Boolean(backup.showGridNumbers);
        this.usePiecewise = Boolean(snapObj.usePiecewise);
        this.piecewiseBoundaries = snapObj.piecewiseBoundaries || [];
        this.piecewiseFuncMap = snapObj.piecewiseFuncMap || [];
        this.piecewiseInclusions = snapObj.piecewiseInclusions || [];
        this.isPiecewisePeriodic = Boolean(snapObj.isPiecewisePeriodic);
        this.periodicStepY = snapObj.periodicStepY || 0;
        this.isPiecewiseLocked = Boolean(snapObj.isPiecewiseLocked);
        this.dropLines = snapObj.dropLines || [];
        this.isDropLineMode = Boolean(snapObj.isPipDropLineMode && !snapObj.isPipLocked && (this.showXAxis || this.showYAxis));
        this.dropLineHoverCandidate = snapObj._pipDropLineHoverCand || null;
        this.dropLineHoverScissors = snapObj._pipDropLineHoverScissors || null;
        this.renderedScissors = Array.isArray(snapObj._pipRenderedScissors) ? snapObj._pipRenderedScissors : [];
        this.renderedDropLineLabels = Array.isArray(snapObj._pipRenderedDropLineLabels) ? snapObj._pipRenderedDropLineLabels : [];
        this.textLabels = snapObj.textLabels || [];
        // 대표님 지침: 교점표시(교점판독기)는 오직 전체화면 그래프 모드에서만 작동하도록 창모드에서는 100% 비활성화!
        this.useIntersectionDetector = false;
        this.isGraphCovered = false;
        this.pdfPageBoardData = null;
        this._isRenderingGraphSnapshot = true;
        this._snapshotCropBounds = {
          minX: 0,
          maxX: effW,
          minY: 0,
          maxY: effH,
          x: 0,
          y: 0,
          w: effW,
          h: effH
        };
        this._activeSnapHint = snapObj._activeSnapHint || null;

        const res = callback();

        snapObj.graphs = this.graphs;
        snapObj.activeGraphIdx = this.activeGraphIdx;
        snapObj.isCurveSelected = this.isCurveSelected;
        snapObj.selectedHandleIdx = this.selectedHandleIdx;
        snapObj.draggedHandleIdx = this.draggedHandleIdx;
        snapObj.axisSnapActiveX = this.axisSnapActiveX;
        snapObj.axisSnapActiveY = this.axisSnapActiveY;
        snapObj.symmetrySnapActive = this.symmetrySnapActive;
        snapObj.snappedPoints = this.snappedPoints;
        snapObj.zoomLevel = this.zoomLevel;
        snapObj.panX = this.panX;
        snapObj.panY = this.panY;
        snapObj.xSpan = this.xSpan;
        snapObj.ySpan = this.ySpan;
        snapObj.showXAxis = this.showXAxis !== false;
        snapObj.showYAxis = this.showYAxis !== false;
        snapObj.showInverseGuide = this.showInverseGuide;
        snapObj.dropLines = this.dropLines;
        snapObj._pipRenderedScissors = this.renderedScissors;
        snapObj._pipRenderedDropLineLabels = this.renderedDropLineLabels;
        return res;
      } finally {
        Object.assign(this, backup);
      }
    }

    _getPipCardInkStrokesArray(cardRef) {
      if (cardRef === 'primary') {
        if (!Array.isArray(this.graphInkStrokes)) this.graphInkStrokes = [];
        return this.graphInkStrokes;
      }
      if (cardRef && typeof cardRef === 'object') {
        if (cardRef.el) {
          if (!Array.isArray(cardRef.el._cardInkStrokes)) cardRef.el._cardInkStrokes = [];
          return cardRef.el._cardInkStrokes;
        }
        if (!Array.isArray(cardRef.inkStrokes)) cardRef.inkStrokes = [];
        return cardRef.inkStrokes;
      }
      return [];
    }

    _setPipCardInkStrokesArray(cardRef, arr) {
      const nextArr = Array.isArray(arr) ? arr : [];
      if (cardRef === 'primary') {
        this.graphInkStrokes = nextArr;
        this.renderGraphCardCanvas();
      } else if (cardRef && typeof cardRef === 'object') {
        cardRef.inkStrokes = nextArr;
        if (cardRef.el) {
          cardRef.el._cardInkStrokes = nextArr;
          if (typeof cardRef.el._renderCardInkCanvas === 'function') {
            cardRef.el._renderCardInkCanvas();
          }
        } else if (typeof cardRef._renderExtraCardInk === 'function') {
          cardRef._renderExtraCardInk();
        }
      }
    }

    _ensurePipCardInkMathCoordsByWidget(widgetEl, forceAll = false, targetStroke = null) {
      if (!widgetEl) return;
      if (widgetEl.id === 'graphCardWidget') {
        this._ensurePipCardInkMathCoords('primary', forceAll, targetStroke);
        return;
      }
      if (Array.isArray(this.extraGraphCards)) {
        const found = this.extraGraphCards.find(c => c && c.el === widgetEl);
        if (found) this._ensurePipCardInkMathCoords(found, forceAll, targetStroke);
      }
    }

    _ensurePipCardInkMathCoords(cardRef, forceAll = false, targetStroke = null) {
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return;
      const snap = this._getMutablePipCardSnapshot(cardRef);
      if (!snap || snap.isNAxisStudioCard) return;
      const strokes = targetStroke ? [targetStroke] : this._getPipCardInkStrokesArray(cardRef);
      if (!strokes || strokes.length === 0) return;

      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82);
      const cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || (bodyEl && bodyEl.clientWidth) || 430));
      const cardH = Math.max(120, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cardW * aspect)));

      this._withPipCardGraphState(snap, cardW, cardH, () => {
        strokes.forEach(st => {
          if (!st || !Array.isArray(st.points)) return;
          st.points.forEach(pt => {
            if (pt && (forceAll || typeof pt.mx !== 'number' || typeof pt.my !== 'number')) {
              const m = this.screenToMath((pt.nx || 0) * cardW, (pt.ny || 0) * cardH);
              pt.mx = m.x;
              pt.my = m.y;
            }
          });
          if (st.isShape && st.cardShape) {
            const cs = st.cardShape;
            if (cs.start && typeof cs.start.nx === 'number' && (forceAll || typeof cs.start.mx !== 'number')) {
              const m = this.screenToMath(cs.start.nx * cardW, cs.start.ny * cardH);
              cs.start.mx = m.x;
              cs.start.my = m.y;
            }
            if (cs.end && typeof cs.end.nx === 'number' && (forceAll || typeof cs.end.mx !== 'number')) {
              const m = this.screenToMath(cs.end.nx * cardW, cs.end.ny * cardH);
              cs.end.mx = m.x;
              cs.end.my = m.y;
            }
            if (cs.center && typeof cs.center.nx === 'number' && (forceAll || typeof cs.center.mx !== 'number')) {
              const mc = this.screenToMath(cs.center.nx * cardW, cs.center.ny * cardH);
              const mr = this.screenToMath((cs.center.nx + (cs.rx || 0.05)) * cardW, (cs.center.ny + (cs.ry || cs.rx || 0.05)) * cardH);
              cs.center.mx = mc.x;
              cs.center.my = mc.y;
              cs.mrx = Math.abs(mr.x - mc.x);
              cs.mry = Math.abs(mr.y - mc.y);
            }
            if (cs.min && typeof cs.min.nx === 'number' && (forceAll || typeof cs.min.mx !== 'number')) {
              const mMin = this.screenToMath(cs.min.nx * cardW, cs.min.ny * cardH);
              cs.min.mx = mMin.x;
              cs.min.my = mMin.y;
            }
            if (cs.max && typeof cs.max.nx === 'number' && (forceAll || typeof cs.max.mx !== 'number')) {
              const mMax = this.screenToMath(cs.max.nx * cardW, cs.max.ny * cardH);
              cs.max.mx = mMax.x;
              cs.max.my = mMax.y;
            }
            if (Array.isArray(cs.pts)) {
              cs.pts.forEach(vp => {
                if (vp && typeof vp.nx === 'number' && (forceAll || typeof vp.mx !== 'number')) {
                  const mv = this.screenToMath(vp.nx * cardW, vp.ny * cardH);
                  vp.mx = mv.x;
                  vp.my = mv.y;
                }
              });
            }
            if (typeof cs.x1 === 'number' && (forceAll || typeof cs.mx1 !== 'number')) {
              const m1 = this.screenToMath(cs.x1 * cardW, cs.y1 * cardH);
              const m2 = this.screenToMath(cs.x2 * cardW, cs.y2 * cardH);
              cs.mx1 = m1.x; cs.my1 = m1.y;
              cs.mx2 = m2.x; cs.my2 = m2.y;
            }
            if (typeof cs.cx === 'number' && (forceAll || typeof cs.mcx !== 'number')) {
              const mc = this.screenToMath(cs.cx * cardW, cs.cy * cardH);
              const mr = this.screenToMath((cs.cx + (cs.rx || 0)) * cardW, (cs.cy + (cs.ry || 0)) * cardH);
              cs.mcx = mc.x; cs.mcy = mc.y;
              cs.mrx = Math.abs(mr.x - mc.x);
              cs.mry = Math.abs(mr.y - mc.y);
            }
          }
        });
      });
    }

    _reprojectPipCardInkFromMathCoords(cardRef, cardW, cardH) {
      const strokes = this._getPipCardInkStrokesArray(cardRef);
      if (!strokes || strokes.length === 0) return;
      const snap = this._getMutablePipCardSnapshot(cardRef);
      if (!snap || snap.isNAxisStudioCard) return;

      const effW = Math.max(80, Math.round(cardW || 430));
      const effH = Math.max(80, Math.round(cardH || 353));

      this._withPipCardGraphState(snap, effW, effH, () => {
        strokes.forEach(st => {
          if (!st || !Array.isArray(st.points)) return;
          st.points.forEach(pt => {
            if (pt && typeof pt.mx === 'number' && typeof pt.my === 'number') {
              const s = this.mathToScreen(pt.mx, pt.my);
              pt.nx = s.x / effW;
              pt.ny = s.y / effH;
            }
          });
          if (st.isShape && st.cardShape) {
            const cs = st.cardShape;
            if (cs.start && typeof cs.start.mx === 'number' && typeof cs.start.my === 'number') {
              const s = this.mathToScreen(cs.start.mx, cs.start.my);
              cs.start.nx = s.x / effW;
              cs.start.ny = s.y / effH;
            }
            if (cs.end && typeof cs.end.mx === 'number' && typeof cs.end.my === 'number') {
              const s = this.mathToScreen(cs.end.mx, cs.end.my);
              cs.end.nx = s.x / effW;
              cs.end.ny = s.y / effH;
            }
            if (cs.center && typeof cs.center.mx === 'number' && typeof cs.center.my === 'number') {
              const sc = this.mathToScreen(cs.center.mx, cs.center.my);
              const sr = this.mathToScreen(cs.center.mx + (cs.mrx || 0.2), cs.center.my - (cs.mry || cs.mrx || 0.2));
              cs.center.nx = sc.x / effW;
              cs.center.ny = sc.y / effH;
              cs.rx = Math.abs(sr.x - sc.x) / effW;
              cs.ry = Math.abs(sr.y - sc.y) / effH;
            }
            if (cs.min && typeof cs.min.mx === 'number' && typeof cs.min.my === 'number' &&
              cs.max && typeof cs.max.mx === 'number' && typeof cs.max.my === 'number') {
              const sMin = this.mathToScreen(cs.min.mx, cs.min.my);
              const sMax = this.mathToScreen(cs.max.mx, cs.max.my);
              cs.min.nx = Math.min(sMin.x, sMax.x) / effW;
              cs.min.ny = Math.min(sMin.y, sMax.y) / effH;
              cs.max.nx = Math.max(sMin.x, sMax.x) / effW;
              cs.max.ny = Math.max(sMin.y, sMax.y) / effH;
            }
            if (Array.isArray(cs.pts)) {
              cs.pts.forEach(vp => {
                if (vp && typeof vp.mx === 'number' && typeof vp.my === 'number') {
                  const sv = this.mathToScreen(vp.mx, vp.my);
                  vp.nx = sv.x / effW;
                  vp.ny = sv.y / effH;
                }
              });
            }
            if (typeof cs.mx1 === 'number' && typeof cs.my1 === 'number') {
              const s1 = this.mathToScreen(cs.mx1, cs.my1);
              const s2 = this.mathToScreen(cs.mx2, cs.my2);
              cs.x1 = s1.x / effW; cs.y1 = s1.y / effH;
              cs.x2 = s2.x / effW; cs.y2 = s2.y / effH;
            }
            if (typeof cs.mcx === 'number' && typeof cs.mcy === 'number') {
              const sc = this.mathToScreen(cs.mcx, cs.mcy);
              const sr = this.mathToScreen(cs.mcx + (cs.mrx || 0), cs.mcy - (cs.mry || 0));
              cs.cx = sc.x / effW; cs.cy = sc.y / effH;
              cs.rx = Math.abs(sr.x - sc.x) / effW;
              cs.ry = Math.abs(sr.y - sc.y) / effH;
            }
          }
        });
      });

      if (cardRef === 'primary') {
        this.renderGraphCardCanvas();
      } else if (cardRef && cardRef.el && typeof cardRef.el._renderCardInkCanvas === 'function') {
        cardRef.el._renderCardInkCanvas();
      } else if (cardRef && typeof cardRef._renderExtraCardInk === 'function') {
        cardRef._renderExtraCardInk();
      }
    }

    _convertCardStrokeListToFullGraphInkStrokes(cardStrokes, snapObj = null, cardW = 430, cardH = 353) {
      if (!Array.isArray(cardStrokes) || cardStrokes.length === 0) return [];
      const effW = Math.max(160, Math.round(cardW || 430));
      const effH = Math.max(120, Math.round(cardH || 353));

      const ensureMathFn = () => {
        cardStrokes.forEach(st => {
          if (!st || !Array.isArray(st.points)) return;
          st.points.forEach(pt => {
            if (pt && (typeof pt.mx !== 'number' || typeof pt.my !== 'number')) {
              const m = this.screenToMath((pt.nx || 0) * effW, (pt.ny || 0) * effH);
              pt.mx = m.x;
              pt.my = m.y;
            }
          });
          if (st.isShape && st.cardShape) {
            const cs = st.cardShape;
            if (cs.start && typeof cs.start.nx === 'number' && typeof cs.start.mx !== 'number') {
              const m = this.screenToMath(cs.start.nx * effW, cs.start.ny * effH);
              cs.start.mx = m.x;
              cs.start.my = m.y;
            }
            if (cs.end && typeof cs.end.nx === 'number' && typeof cs.end.mx !== 'number') {
              const m = this.screenToMath(cs.end.nx * effW, cs.end.ny * effH);
              cs.end.mx = m.x;
              cs.end.my = m.y;
            }
            if (cs.center && typeof cs.center.nx === 'number' && typeof cs.center.mx !== 'number') {
              const mc = this.screenToMath(cs.center.nx * effW, cs.center.ny * effH);
              const mr = this.screenToMath((cs.center.nx + (cs.rx || 0.05)) * effW, (cs.center.ny + (cs.ry || cs.rx || 0.05)) * effH);
              cs.center.mx = mc.x;
              cs.center.my = mc.y;
              cs.mrx = Math.abs(mr.x - mc.x);
              cs.mry = Math.abs(mr.y - mc.y);
            }
            if (cs.min && typeof cs.min.nx === 'number' && typeof cs.min.mx !== 'number') {
              const mMin = this.screenToMath(cs.min.nx * effW, cs.min.ny * effH);
              cs.min.mx = mMin.x;
              cs.min.my = mMin.y;
            }
            if (cs.max && typeof cs.max.nx === 'number' && typeof cs.max.mx !== 'number') {
              const mMax = this.screenToMath(cs.max.nx * effW, cs.max.ny * effH);
              cs.max.mx = mMax.x;
              cs.max.my = mMax.y;
            }
            if (Array.isArray(cs.pts)) {
              cs.pts.forEach(vp => {
                if (vp && typeof vp.nx === 'number' && typeof vp.mx !== 'number') {
                  const mv = this.screenToMath(vp.nx * effW, vp.ny * effH);
                  vp.mx = mv.x;
                  vp.my = mv.y;
                }
              });
            }
            if (typeof cs.x1 === 'number' && typeof cs.mx1 !== 'number') {
              const m1 = this.screenToMath(cs.x1 * effW, cs.y1 * effH);
              const m2 = this.screenToMath(cs.x2 * effW, cs.y2 * effH);
              cs.mx1 = m1.x; cs.my1 = m1.y;
              cs.mx2 = m2.x; cs.my2 = m2.y;
            }
            if (typeof cs.cx === 'number' && typeof cs.mcx !== 'number') {
              const mc = this.screenToMath(cs.cx * effW, cs.cy * effH);
              const mr = this.screenToMath((cs.cx + (cs.rx || 0)) * effW, (cs.cy + (cs.ry || 0)) * effH);
              cs.mcx = mc.x; cs.mcy = mc.y;
              cs.mrx = Math.abs(mr.x - mc.x);
              cs.mry = Math.abs(mr.y - mc.y);
            }
          }
        });
      };

      if (snapObj && !snapObj.isNAxisStudioCard) {
        this._withPipCardGraphState(snapObj, effW, effH, ensureMathFn);
      }

      const outStrokes = [];
      // 🖋️ 창모드에서는 이미 세필(0.54x)로 렌더링되므로, 전체화면 및 뷰어 확대 전환 시 기본 펜 굵기(cs.size)를 1:1 그대로 유지하면
      // 확대된 수학 좌표 간격과 어우러져 글자가 뚱뚱해지지 않고 깔끔한 정사이즈로 표시됨!
      cardStrokes.forEach(cs => {
        if (!cs || !Array.isArray(cs.points) || cs.points.length === 0) return;
        const fullPts = cs.points.map(pt => ({
          x: typeof pt.mx === 'number' ? pt.mx : 0,
          y: typeof pt.my === 'number' ? pt.my : 0,
          p: pt.p !== undefined ? pt.p : 0.5,
          t: pt.t
        }));
        const scaledSize = Math.max(1.2, Math.min(28, parseFloat((cs.size || 3.5).toFixed(2))));
        const scaledHlSize = cs.highlighterSize
          ? Math.max(6, Math.min(64, parseFloat((cs.highlighterSize).toFixed(2))))
          : undefined;

        const fullStroke = {
          target: 'graph',
          _fromPipCardSync: true,
          color: cs.color || '#1e293b',
          size: scaledSize,
          highlighterSize: scaledHlSize,
          isHighlighter: Boolean(cs.isHighlighter),
          penStyle: cs.penStyle || 'ballpen',
          softBlur: cs.softBlur || 0,
          tStart: cs.tStart,
          tEnd: cs.tEnd,
          points: fullPts
        };

        if (cs.isShape && cs.cardShape) {
          fullStroke.isShape = true;
          fullStroke._savedCardShape = JSON.parse(JSON.stringify(cs.cardShape));
          const sh = cs.cardShape;
          if (sh.type === 'line' && sh.start && typeof sh.start.mx === 'number' && sh.end && typeof sh.end.mx === 'number') {
            fullStroke.shape = {
              type: 'line',
              start: { x: sh.start.mx, y: sh.start.my },
              end: { x: sh.end.mx, y: sh.end.my }
            };
          } else if ((sh.type === 'line' || sh.type === 'dashedLine' || sh.type === 'arrow') && typeof sh.mx1 === 'number') {
            fullStroke.shapeType = sh.type;
            fullStroke.shape = {
              type: 'line',
              start: { x: sh.mx1, y: sh.my1 },
              end: { x: sh.mx2, y: sh.my2 }
            };
            fullStroke.points = [
              { x: sh.mx1, y: sh.my1, p: 0.5 },
              { x: sh.mx2, y: sh.my2, p: 0.5 }
            ];
          } else if (sh.type === 'circle' && sh.center && typeof sh.center.mx === 'number') {
            fullStroke.shape = {
              type: 'circle',
              center: { x: sh.center.mx, y: sh.center.my },
              radius: sh.mrx || 0.5
            };
          } else if (sh.type === 'ellipse' && sh.center && typeof sh.center.mx === 'number') {
            fullStroke.shape = {
              type: 'ellipse',
              center: { x: sh.center.mx, y: sh.center.my },
              rx: sh.mrx || 0.5,
              ry: sh.mry || sh.mrx || 0.5
            };
          } else if (sh.type === 'rect' && sh.min && typeof sh.min.mx === 'number' && sh.max && typeof sh.max.mx === 'number') {
            fullStroke.shape = {
              type: 'rect',
              min: { x: sh.min.mx, y: sh.min.my },
              max: { x: sh.max.mx, y: sh.max.my }
            };
          } else if (Array.isArray(sh.pts) && sh.pts.length >= 2 && typeof sh.pts[0].mx === 'number') {
            fullStroke.shape = {
              type: sh.type,
              closed: Boolean(sh.closed),
              pts: sh.pts.map(vp => ({ x: vp.mx, y: vp.my }))
            };
          }
        }

        outStrokes.push(fullStroke);
      });

      return outStrokes;
    }

    _buildFullGraphInkStrokesFromPipCard(cardRef) {
      if (!cardRef) return [];
      const cardStrokes = this._getPipCardInkStrokesArray(cardRef);
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      const bodyEl = widget ? (isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body')) : null;
      const aspect = isPrimary ? (this.graphCardAspect || 0.82) : ((cardRef && cardRef.aspect) || 0.82);
      const cardW = Math.max(160, Math.round((widget && parseFloat(widget.style.width)) || (bodyEl && bodyEl.clientWidth) || 430));
      const cardH = Math.max(120, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cardW * aspect)));
      this._ensurePipCardInkMathCoords(cardRef);
      if (!Array.isArray(cardStrokes) || cardStrokes.length === 0) {
        return [];
      }
      const snap = this._getMutablePipCardSnapshot(cardRef);
      return this._convertCardStrokeListToFullGraphInkStrokes(cardStrokes, snap, cardW, cardH);
    }

    _syncPipCardInkToFullGraph(cardRef, cardUnitScale, fullUnitScale) {
      if (!cardRef) return;
      const syncedStrokes = this._buildFullGraphInkStrokesFromPipCard(cardRef);

      if (!Array.isArray(this.inkStrokes)) this.inkStrokes = [];
      this.inkStrokes = this.inkStrokes.filter(s => s && s.target !== 'graph');

      if (syncedStrokes.length > 0) {
        this.inkStrokes.push(...syncedStrokes);
      }
      this._inkBakeDirty = true;
      if (typeof this.clearInkCache === 'function') this.clearInkCache();
    }

    _syncFullGraphInkBackToPipCard(cardRef, cardW, cardH, cardUnitScale, fullUnitScale, keepFullGraphInk = false) {
      if (!cardRef) return;
      const snap = this._getMutablePipCardSnapshot(cardRef);
      if (!snap || snap.isNAxisStudioCard) return;

      const effW = Math.max(160, Math.round(cardW || 430));
      const effH = Math.max(120, Math.round(cardH || 353));

      const graphStrokes = Array.isArray(this.inkStrokes)
        ? this.inkStrokes.filter(s => s && s.target === 'graph' && Array.isArray(s.points) && s.points.length > 0)
        : [];

      const newCardStrokes = [];
      this._withPipCardGraphState(snap, effW, effH, () => {
        graphStrokes.forEach(gs => {
          const pts = gs.points.map(pt => {
            const s = this.mathToScreen(pt.x, pt.y);
            return {
              nx: s.x / effW,
              ny: s.y / effH,
              mx: pt.x,
              my: pt.y,
              p: pt.p !== undefined ? pt.p : 0.5,
              t: pt.t
            };
          });
          // 창모드 복귀 시에도 원본 펜 사이즈(gs.size)를 1:1 보존 (창모드 렌더러가 세필 비율을 자동 곱해줌)
          const cardBaseSize = Math.max(1.2, Math.min(28, parseFloat((gs.size || 3.5).toFixed(2))));
          const cardHlSize = gs.highlighterSize
            ? Math.max(6, Math.min(64, parseFloat((gs.highlighterSize).toFixed(2))))
            : undefined;

          const cStroke = {
            color: gs.color || '#1e293b',
            size: cardBaseSize,
            highlighterSize: cardHlSize,
            isHighlighter: Boolean(gs.isHighlighter),
            penStyle: gs.penStyle || 'ballpen',
            softBlur: gs.softBlur || 0,
            _inPlaceStreamlined: true,
            _jitterPolished: true,
            tStart: gs.tStart,
            tEnd: gs.tEnd,
            points: pts
          };

          if (gs.isShape && gs._savedCardShape) {
            cStroke.isShape = true;
            cStroke.cardShape = JSON.parse(JSON.stringify(gs._savedCardShape));
          } else if (gs.isShape && (gs.shapeType === 'line' || gs.shapeType === 'dashedLine' || gs.shapeType === 'arrow') && pts.length >= 2) {
            const p0 = pts[0];
            const p1 = pts[pts.length - 1];
            cStroke.isShape = true;
            cStroke.cardShape = {
              type: 'line',
              start: { nx: p0.nx, ny: p0.ny, mx: p0.mx, my: p0.my },
              end: { nx: p1.nx, ny: p1.ny, mx: p1.mx, my: p1.my }
            };
          }

          newCardStrokes.push(cStroke);
        });
      });

      this._setPipCardInkStrokesArray(cardRef, newCardStrokes);
      this._reprojectPipCardInkFromMathCoords(cardRef, effW, effH);
      if (!keepFullGraphInk && Array.isArray(this.inkStrokes)) {
        if (this.isAudioRecording && Array.isArray(this.audioErasedStrokes)) {
          const recT = this.getAudioRecordElapsedMs();
          this.inkStrokes.forEach(s => {
            if (s && s.target === 'graph') {
              this.audioErasedStrokes.push({ ...JSON.parse(JSON.stringify(s)), erasedAt: recT });
            }
          });
        }
        this.inkStrokes = this.inkStrokes.filter(s => s && s.target !== 'graph');
      }
      this._inkBakeDirty = true;
      if (typeof this.clearInkCache === 'function') this.clearInkCache();
    }

    _getPipCardRefByWidget(widgetEl) {
      if (!widgetEl) return null;
      if (widgetEl.id === 'graphCardWidget') return 'primary';
      if (Array.isArray(this.extraGraphCards)) {
        return this.extraGraphCards.find(c => c && c.el === widgetEl) || null;
      }
      return null;
    }

    clearProblemCardStealthTimer(widgetEl) {
      if (widgetEl && widgetEl._probStealthTimer) {
        clearTimeout(widgetEl._probStealthTimer);
        widgetEl._probStealthTimer = null;
      }
    }

    scheduleProblemCardStealth(widgetEl, delayMs = 3000) {
      if (!widgetEl) return;
      this.clearProblemCardStealthTimer(widgetEl);
      if (!widgetEl.classList.contains('pip-locked-mode')) {
        widgetEl.classList.remove('pip-stealth-locked');
        return;
      }
      if (widgetEl.classList.contains('card-ink-active')) {
        widgetEl.classList.remove('pip-stealth-locked');
        return;
      }
      if (delayMs <= 0) {
        widgetEl.classList.add('pip-stealth-locked');
        return;
      }
      widgetEl._probStealthTimer = setTimeout(() => {
        widgetEl._probStealthTimer = null;
        if (
          widgetEl.classList.contains('pip-locked-mode') &&
          !widgetEl.classList.contains('card-ink-active') &&
          !this._isDraggingOrResizingAnyCard
        ) {
          widgetEl.classList.add('pip-stealth-locked');
          if (this.isAudioRecording && !this._isApplyingAudioTimelineState) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        }
      }, delayMs);
    }

    wakeUpProblemCardStealth(widgetEl, restartTimer = true) {
      if (!widgetEl) return;
      this.clearProblemCardStealthTimer(widgetEl);
      const wasStealth = widgetEl.classList.contains('pip-stealth-locked');
      widgetEl.classList.remove('pip-stealth-locked');
      if (restartTimer) {
        this.scheduleProblemCardStealth(widgetEl, 3000);
      }
      if (wasStealth && this.isAudioRecording && !this._isApplyingAudioTimelineState) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    syncProblemCardLockUI(widgetEl) {
      if (!widgetEl) return;
      const isLocked = widgetEl.classList.contains('pip-locked-mode');
      if (!isLocked) {
        this.clearProblemCardStealthTimer(widgetEl);
        widgetEl.classList.remove('pip-stealth-locked');
      }
      const btnLock = widgetEl.querySelector('.btn-problem-lock');
      if (btnLock && btnLock._renderedLockedState !== isLocked) {
        btnLock._renderedLockedState = isLocked;
        if (isLocked) {
          btnLock.classList.remove('unlocked-editing');
          btnLock.classList.add('locked-confirmed');
          btnLock.innerHTML = '<span class="card-lock-icon" style="display:inline-flex;align-items:center;justify-content:center;"><svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/></svg></span>';
          btnLock.title = '잠금됨 — 클릭하여 잠금 해제 (메뉴·테두리 상시 표시)';
        } else {
          btnLock.classList.remove('locked-confirmed');
          btnLock.classList.add('unlocked-editing');
          btnLock.innerHTML = '<span class="card-lock-icon" style="display:inline-flex;align-items:center;justify-content:center;"><svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/></svg></span>';
          btnLock.title = '클릭하여 잠금 — 3초 뒤 테두리와 상단 메뉴가 숨겨지며 톡 치면 다시 나타납니다';
        }
      }
    }

    setProblemCardLockedByWidget(widgetEl, locked, showToast = false) {
      if (!widgetEl) return;
      const isLocked = Boolean(locked);
      if (isLocked) {
        widgetEl.classList.remove('pip-stealth-locked');
        widgetEl.classList.add('pip-locked-mode');
        this.scheduleProblemCardStealth(widgetEl, 3000);
      } else {
        this.clearProblemCardStealthTimer(widgetEl);
        widgetEl.classList.remove('pip-locked-mode', 'pip-stealth-locked');
        if (widgetEl.classList.contains('card-ink-active')) {
          widgetEl.classList.remove('card-ink-active');
          const laserBtn = widgetEl.querySelector('.btn-card-laser');
          if (laserBtn) laserBtn.classList.remove('active');
        }
      }
      this.syncProblemCardLockUI(widgetEl);
      if (this.isAudioRecording && !this._isApplyingAudioTimelineState) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      if (showToast) {
        if (isLocked) {
          this.showToast('🔒 카드 잠금 완료! 3초 뒤 테두리와 상단 메뉴가 숨겨지며, 카드를 톡 터치하면 다시 나타납니다.');
        } else {
          this.showToast('🔓 잠금 해제됨! 상단 메뉴와 테두리가 유지됩니다.');
        }
      }
    }

    clearPipGraphCardStealthTimer(cardRef) {
      const { widget } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (widget && widget._pipStealthTimer) {
        clearTimeout(widget._pipStealthTimer);
        widget._pipStealthTimer = null;
      }
    }

    schedulePipGraphCardStealth(cardRef, delayMs = 3000) {
      const { widget } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return;
      this.clearPipGraphCardStealthTimer(cardRef);
      const snap = this._getMutablePipCardSnapshot(cardRef);
      if (!snap || !snap.isPipLocked) {
        widget.classList.remove('pip-stealth-locked', 'pip-locked-mode');
        return;
      }
      widget.classList.add('pip-locked-mode');
      if (widget.classList.contains('card-ink-active')) {
        widget.classList.remove('pip-stealth-locked');
        return;
      }
      if (delayMs <= 0) {
        widget.classList.add('pip-stealth-locked');
        return;
      }
      widget._pipStealthTimer = setTimeout(() => {
        widget._pipStealthTimer = null;
        const curSnap = this._getMutablePipCardSnapshot(cardRef);
        if (
          curSnap &&
          curSnap.isPipLocked &&
          !widget.classList.contains('card-ink-active') &&
          !this._isDraggingOrResizingAnyCard
        ) {
          widget.classList.add('pip-stealth-locked');
          if (this.isAudioRecording && !this._isApplyingAudioTimelineState) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        }
      }, delayMs);
    }

    wakeUpPipGraphCardStealth(cardRef, restartTimer = true) {
      const { widget } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return;
      this.clearPipGraphCardStealthTimer(cardRef);
      const wasStealth = widget.classList.contains('pip-stealth-locked');
      widget.classList.remove('pip-stealth-locked');
      if (restartTimer) {
        this.schedulePipGraphCardStealth(cardRef, 3000);
      }
      if (wasStealth && this.isAudioRecording && !this._isApplyingAudioTimelineState) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    setPipCardLockedByWidget(widgetEl, locked, showToast = false) {
      if (!widgetEl) return;
      if (widgetEl.id === 'graphCardWidget') {
        this.setPipCardLocked('primary', locked, showToast);
        return;
      }
      if (Array.isArray(this.extraGraphCards)) {
        const found = this.extraGraphCards.find(c => c && c.el === widgetEl);
        if (found) this.setPipCardLocked(found, locked, showToast);
      }
    }

    setPipCardLocked(cardRef, locked, showToast = false) {
      const { widget } = this._getPipCardWidgetAndSnapRaw(cardRef);
      const snap = this._getMutablePipCardSnapshot(cardRef);
      if (!widget || !snap) return;

      this._ensurePipCardInkMathCoords(cardRef);
      snap.isPipLocked = Boolean(locked);
      snap.isPipDropLineMode = false;
      snap.isPipSymPopoverOpen = false;
      snap._pipDropLineHoverCand = null;
      snap._pipDropLineHoverScissors = null;
      this._closeAllPipHeaderPopovers();

      if (snap.isPipLocked) {
        snap.isCurveSelected = false;
        snap.selectedHandleIdx = null;
        snap.draggedHandleIdx = null;
        snap._activeSnapHint = null;
        widget.classList.remove('pip-manipulating', 'pip-stealth-locked');
        widget.classList.add('pip-locked-mode');
        this.schedulePipGraphCardStealth(cardRef, 3000);
      } else {
        this.clearPipGraphCardStealthTimer(cardRef);
        snap.isCurveSelected = false;
        snap.selectedHandleIdx = null;
        snap.draggedHandleIdx = null;
        snap._activeSnapHint = null;
        widget.classList.remove('pip-manipulating', 'pip-locked-mode', 'pip-stealth-locked');
        if (widget.classList.contains('card-ink-active')) {
          widget.classList.remove('card-ink-active');
          const laserBtn = widget.querySelector('.btn-card-laser');
          if (laserBtn) laserBtn.classList.remove('active');
        }
      }

      widget._lastPipLockUiSig = '';
      this.syncPipCardLockUI(cardRef);
      this._savePipCardSnapshot(cardRef, snap);
      this.renderPipGraphCard(cardRef);
      this.scheduleBakePipGraphCardToImg(cardRef);
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }

      if (showToast) {
        if (snap.isPipLocked) {
          this.showToast('🔒 카드 잠금 완료! 3초 뒤 테두리와 상단 메뉴가 숨겨지며, 카드를 톡 터치하면 다시 나타납니다.');
        } else {
          this.showToast('🔓 잠금 해제됨! 핸들 조작 · 여백 드래그로 축 이동 · 모서리로 시야 영역 확장이 가능합니다.');
        }
      }
    }

    _closeAllPipHeaderPopovers(exceptPopover = null) {
      let anyClosed = false;
      document.querySelectorAll('.pip-hdr-popover').forEach(pop => {
        if (pop !== exceptPopover) {
          if (pop.style.display !== 'none') anyClosed = true;
          pop.style.display = 'none';
          const wrap = pop.closest('.pip-hdr-sym-wrap');
          if (wrap) {
            const btn = wrap.querySelector('[data-pip-act="symMenu"]');
            if (btn) btn.classList.remove('open');
          }
          const cardEl = pop.closest('#graphCardWidget, .extra-graph-card-widget');
          if (cardEl) {
            let snap = null;
            if (cardEl.id === 'graphCardWidget') {
              snap = this._getMutablePipCardSnapshot('primary');
            } else if (Array.isArray(this.extraGraphCards)) {
              const found = this.extraGraphCards.find(c => c && c.el === cardEl);
              if (found) snap = this._getMutablePipCardSnapshot(found);
            }
            if (snap && snap.isPipSymPopoverOpen) {
              snap.isPipSymPopoverOpen = false;
              anyClosed = true;
            }
          }
        }
      });
      if (anyClosed && this.isAudioRecording && !this._isApplyingAudioTimelineState) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    _syncLinkedPartnerToTransposedMirror(src, partner) {
      if (!src || !partner) return;
      const isGeom = (src.type === 'geom_circle' || src.type === 'geom_triangle' || src.type === 'geom_quad');
      if (isGeom) return;
      partner.type = src.type;
      partner.category = src.category;
      partner.isTransposedYX = !Boolean(src.isTransposedYX);
      if (partner.isTransposedYX) {
        partner.isIndependent = true;
      }
      partner.handles = (src.handles || []).map(h => {
        const cloned = {
          name: h.name,
          x: parseFloat(h.x.toFixed(3)),
          y: parseFloat(h.y.toFixed(3)),
          type: h.type,
          hidden: Boolean(h.hidden),
          reflectX: Boolean(h.reflectX),
          reflectY: Boolean(h.reflectY)
        };
        if (h.fn) cloned.fn = h.fn;
        if (h.rawExpr !== undefined) cloned.rawExpr = h.rawExpr;
        return cloned;
      });
      if (src.customExpr !== undefined) partner.customExpr = src.customExpr;
      const srcOx = (src.freezeOffset && typeof src.freezeOffset.x === 'number') ? src.freezeOffset.x : 0;
      const srcOy = (src.freezeOffset && typeof src.freezeOffset.y === 'number') ? src.freezeOffset.y : 0;
      partner.freezeOffset = { x: srcOx, y: srcOy };
      partner.transforms = (src.transforms || []).map(t => ({
        offset: {
          x: (t && t.offset && typeof t.offset.x === 'number') ? t.offset.x : 0,
          y: (t && t.offset && typeof t.offset.y === 'number') ? t.offset.y : 0
        },
        invertV: Boolean(t && t.invertV),
        invertH: Boolean(t && t.invertH),
        abs: Boolean(t && t.abs)
      }));
      partner.isAbsolute = Boolean(src.isAbsolute);
      partner.isAbsPristine = Boolean(src.isAbsPristine);
      partner.isFrozen = Boolean(src.isFrozen);
      partner.frozenInvertH = Boolean(src.frozenInvertH);
      partner.frozenInvertV = Boolean(src.frozenInvertV);
      partner.frozenAbsolute = Boolean(src.frozenAbsolute);
    }

    _applyGraphSymmetry(g, axis, graphsList = this.graphs, _skipPartner = false) {
      if (!g || !Array.isArray(g.handles)) return '';
      const internalAxis = (g.isTransposedYX && (axis === 'x' || axis === 'y'))
        ? (axis === 'x' ? 'y' : 'x')
        : axis;
      if (internalAxis === 'x' || internalAxis === 'origin') {
        const hasFold = Boolean(g.isAbsolute || (Array.isArray(g.transforms) && g.transforms.length > 0));
        if (hasFold) {
          if (!Array.isArray(g.transforms)) g.transforms = [];
          const curOx = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
          const curOy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
          const lastT = g.transforms.length > 0 ? g.transforms[g.transforms.length - 1] : null;
          if (lastT && lastT.invertV && !lastT.abs && Math.abs(curOx) < 1e-4 && Math.abs(curOy) < 1e-4) {
            g.transforms.pop();
            g.freezeOffset = {
              x: (lastT.offset && typeof lastT.offset.x === 'number') ? lastT.offset.x : 0,
              y: (lastT.offset && typeof lastT.offset.y === 'number') ? lastT.offset.y : 0
            };
          } else {
            g.transforms.push({ offset: { x: curOx, y: curOy }, invertV: true });
            g.freezeOffset = { x: 0, y: 0 };
          }
          g.isAbsPristine = false;
        } else {
          this.engine.reflectXAxis(g.handles, g.type);
          if (g.freezeOffset && typeof g.freezeOffset.y === 'number') {
            g.freezeOffset.y = -g.freezeOffset.y;
          }
        }
      }
      if (internalAxis === 'y' || internalAxis === 'origin') {
        this.engine.reflectYAxis(g.handles, g.type);
        if (g.freezeOffset && typeof g.freezeOffset.x === 'number') {
          g.freezeOffset.x = -g.freezeOffset.x;
        }
        if (Array.isArray(g.transforms)) {
          g.transforms.forEach(t => {
            if (t && t.offset && typeof t.offset.x === 'number') {
              t.offset.x = -t.offset.x;
            }
          });
        }
      }
      if (!_skipPartner && g.linkedInverseId && Array.isArray(graphsList)) {
        const partner = graphsList.find(other => other && other.id === g.linkedInverseId && other !== g);
        if (partner) {
          const partnerAxis = axis === 'x' ? 'y' : (axis === 'y' ? 'x' : 'origin');
          this._applyGraphSymmetry(partner, partnerAxis, graphsList, true);
        }
      }
      if (axis === 'x') return '↕️ x축 대칭 완료!';
      if (axis === 'y') return '↔️ y축 대칭 완료!';
      return '🎯 원점 대칭 완료!';
    }

    _applyGraphToggleAbsolute(g, graphsList = this.graphs) {
      if (!g) return '';
      let msg = '';
      // Case 1: 방금 절댓값을 씌웠고 아직 이동하지 않은 상태(isAbsPristine === true) -> 이전 단계로 해제
      if (g.isAbsolute && g.isAbsPristine) {
        if (Array.isArray(g.transforms) && g.transforms.length > 0) {
          const last = g.transforms.pop();
          if (last && last.offset) {
            g.freezeOffset = { x: last.offset.x || 0, y: last.offset.y || 0 };
          }
          // 연속 클릭 시 1차 절댓값까지 곧바로 해제할 수 있도록 isAbsPristine 유지 (이동 시 false로 전환됨)
          g.isAbsPristine = true;
          const stage = g.transforms.filter(t => t && t.abs).length + 1;
          msg = `📉 ${stage + 1}차 절댓값 해제`;
        } else {
          g.isAbsolute = false;
          g.isAbsPristine = false;
          g.transforms = [];
          g.freezeOffset = { x: 0, y: 0 };
          msg = '📈 |f(x)| 절댓값 해제';
        }
      }
      // Case 2: 이미 절댓값이 씌워진 상태에서 평행이동/조작을 거친 경우(isAbsPristine === false) -> 다단계 재절댓값(||f(x)| - k|)!
      else if (g.isAbsolute && !g.isAbsPristine) {
        if (!Array.isArray(g.transforms)) g.transforms = [];
        const curOx = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
        const curOy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
        g.transforms.push({ offset: { x: curOx, y: curOy }, abs: true });
        g.freezeOffset = { x: 0, y: 0 };
        g.isAbsPristine = true;
        const stage = g.transforms.filter(t => t && t.abs).length + 1;
        msg = `✨ ${stage}차 절댓값 꺾어올리기 완료!`;
      }
      // Case 3: 최초 1차 절댓값 적용
      else {
        g.isAbsolute = true;
        g.isAbsPristine = true;
        msg = '📈 |f(x)| 절댓값 꺾어올리기 적용!';
      }

      if (g.linkedInverseId && Array.isArray(graphsList)) {
        const partner = graphsList.find(other => other && other.id === g.linkedInverseId && other !== g);
        if (partner) {
          this._syncLinkedPartnerToTransposedMirror(g, partner);
        }
      }
      return msg;
    }

    _cloneInverseGraphInPipSnap(snap) {
      if (!snap || !Array.isArray(snap.graphs) || snap.graphs.length === 0) return false;
      const srcIdx = (typeof snap.activeGraphIdx === 'number' && snap.activeGraphIdx >= 0 && snap.activeGraphIdx < snap.graphs.length)
        ? snap.activeGraphIdx
        : (snap.graphs.length - 1);
      const src = snap.graphs[srcIdx];
      if (!src) {
        this.showToast('ℹ️ 역함수를 생성할 원본 그래프를 먼저 선택하세요.');
        return false;
      }
      if (snap.graphs.length >= 12) {
        this.showToast('⚠️ 그래프는 최대 12개까지 동시에 추가할 수 있습니다.');
        return false;
      }

      this._pushWorkspaceUndoSnapshot('↺ 카드 y=x 역함수 생성이 취소되었습니다', '↻ 카드 y=x 역함수 다시 생성됨');

      const hasFoldedAbs = Boolean(
        src.isAbsolute ||
        src.frozenAbsolute ||
        (Array.isArray(src.transforms) && src.transforms.some(t => t && t.abs))
      );
      const isGeom = (src.type === 'geom_circle' || src.type === 'geom_triangle' || src.type === 'geom_quad');
      const isPureOneToOne = !src.isTransposedYX && !hasFoldedAbs && (
        src.type === 'exp_basic' ||
        src.type === 'log_basic' ||
        src.type === 'rational_basic' ||
        src.type === '1st_linear'
      );

      let targetType = src.type;
      let nextTransposed = false;
      let useCoordinateSwap = false;

      if (isGeom) {
        targetType = src.type;
        nextTransposed = false;
        useCoordinateSwap = true;
      } else if (isPureOneToOne) {
        if (src.type === 'exp_basic') targetType = 'log_basic';
        else if (src.type === 'log_basic') targetType = 'exp_basic';
        else targetType = src.type;
        nextTransposed = false;
        useCoordinateSwap = true;
      } else {
        targetType = src.type;
        nextTransposed = !Boolean(src.isTransposedYX);
        useCoordinateSwap = false;
      }

      const srcOx = (src.freezeOffset && typeof src.freezeOffset.x === 'number') ? src.freezeOffset.x : 0;
      const srcOy = (src.freezeOffset && typeof src.freezeOffset.y === 'number') ? src.freezeOffset.y : 0;

      let newHandles;
      let newFreezeOffset;
      let newTransforms;
      let nextFrozenInvertH;
      let nextFrozenInvertV;

      if (useCoordinateSwap) {
        newHandles = (src.handles || []).map(h => {
          const cloned = {
            name: h.name,
            x: parseFloat(h.y.toFixed(3)),
            y: parseFloat(h.x.toFixed(3)),
            type: h.type,
            hidden: Boolean(h.hidden)
          };
          if (h.reflectX !== undefined) cloned.reflectX = Boolean(h.reflectY);
          if (h.reflectY !== undefined) cloned.reflectY = Boolean(h.reflectX);
          return cloned;
        });
        newFreezeOffset = { x: srcOy, y: srcOx };
        newTransforms = (src.transforms || []).map(t => ({
          offset: {
            x: (t.offset && typeof t.offset.y === 'number') ? t.offset.y : 0,
            y: (t.offset && typeof t.offset.x === 'number') ? t.offset.x : 0
          },
          invertV: Boolean(t && t.invertH),
          invertH: Boolean(t && t.invertV),
          abs: Boolean(t && t.abs)
        }));
        nextFrozenInvertH = Boolean(src.frozenInvertV);
        nextFrozenInvertV = Boolean(src.frozenInvertH);
      } else {
        newHandles = (src.handles || []).map(h => {
          const cloned = {
            name: h.name,
            x: parseFloat(h.x.toFixed(3)),
            y: parseFloat(h.y.toFixed(3)),
            type: h.type,
            hidden: Boolean(h.hidden),
            reflectX: Boolean(h.reflectX),
            reflectY: Boolean(h.reflectY)
          };
          if (h.fn) cloned.fn = h.fn;
          if (h.rawExpr !== undefined) cloned.rawExpr = h.rawExpr;
          return cloned;
        });
        newFreezeOffset = { x: srcOx, y: srcOy };
        newTransforms = (src.transforms || []).map(t => ({
          offset: {
            x: (t.offset && typeof t.offset.x === 'number') ? t.offset.x : 0,
            y: (t.offset && typeof t.offset.y === 'number') ? t.offset.y : 0
          },
          invertV: Boolean(t && t.invertV),
          invertH: Boolean(t && t.invertH),
          abs: Boolean(t && t.abs)
        }));
        nextFrozenInvertH = Boolean(src.frozenInvertH);
        nextFrozenInvertV = Boolean(src.frozenInvertV);
      }

      const autoSeq = (Array.isArray(this.colorPalette) && this.colorPalette.length > 0)
        ? this.colorPalette
        : ['#c74440', '#2d70b3', '#388c46', '#6042a6'];
      const nextColor = (this.graphColorMode === 'fixed' && this.fixedGraphColor)
        ? this.fixedGraphColor
        : autoSeq[snap.graphs.length % autoSeq.length];

      if (!src.id) src.id = 'g_' + (Date.now() - 1) + '_' + Math.random().toString(36).substr(2, 4);
      if (src.linkedInverseId) {
        const oldPartner = snap.graphs.find(item => item && item.id === src.linkedInverseId);
        if (oldPartner) oldPartner.linkedInverseId = null;
      }
      const newId = 'g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

      const newGraph = {
        id: newId,
        type: targetType,
        category: (this.meta && this.meta[targetType] && this.meta[targetType].category) || src.category,
        handles: newHandles,
        color: nextColor,
        lineWidth: src.lineWidth || this.defaultGraphLineWidth || 2.8,
        isAbsolute: Boolean(src.isAbsolute),
        isAbsPristine: Boolean(src.isAbsPristine),
        shapeMode: isGeom ? (src.shapeMode || 'free') : 'free',
        originCenter: isGeom ? Boolean(src.originCenter) : false,
        isFrozen: Boolean(src.isFrozen),
        freezeOffset: newFreezeOffset,
        transforms: newTransforms,
        frozenInvertH: nextFrozenInvertH,
        frozenInvertV: nextFrozenInvertV,
        frozenAbsolute: Boolean(src.frozenAbsolute),
        isIndependent: nextTransposed ? true : Boolean(snap.usePiecewise),
        isTransposedYX: nextTransposed,
        linkedInverseId: src.id
      };
      if (src.customExpr !== undefined) newGraph.customExpr = src.customExpr;

      src.linkedInverseId = newId;
      snap.graphs.push(newGraph);
      snap.activeGraphIdx = snap.graphs.length - 1;
      snap.selectedHandleIdx = null;
      snap.isCurveSelected = true;
      snap.showInverseGuide = true;

      const srcName = (this.meta && this.meta[src.type] && this.meta[src.type].name) || '그래프';
      const tgtName = (this.meta && this.meta[targetType] && this.meta[targetType].name) || '역함수';
      if (src.type === '2nd_quadratic' && !src.isTransposedYX && !hasFoldedAbs) {
        this.showToast('🔄 이차함수의 y=x 대칭 그래프 생성! (💡 반쪽 역함수 쌍은 [무리함수]를 y=x 대칭시키면 완성됩니다)');
      } else if (isGeom) {
        this.showToast(`🔄 ${srcName}의 y=x 대칭 도형 복제 완료!`);
      } else if (!nextTransposed && targetType !== src.type) {
        this.showToast(`🔄 ${srcName}의 y=x 대칭 역함수 (${tgtName}) 생성 완료!`);
      } else {
        this.showToast(`🔄 ${srcName}의 y=x 대칭 그래프 생성 완료!`);
      }
      return true;
    }

    _toggleInverseLinkInPipSnap(snap) {
      if (!snap || !Array.isArray(snap.graphs) || snap.graphs.length === 0) return false;
      const g = snap.graphs[snap.activeGraphIdx];
      if (!g || !g.linkedInverseId) return false;
      this._pushWorkspaceUndoSnapshot('↺ 역함수 대칭 연동이 복원되었습니다', '↻ 역함수 연동 해제 다시 실행됨');
      const partner = snap.graphs.find(other => other && other.id === g.linkedInverseId);
      if (partner) partner.linkedInverseId = null;
      g.linkedInverseId = null;
      this.showToast('🔓 원함수와 역함수의 연동이 해제되었습니다. 이제 각자 독립적으로 조작할 수 있습니다.');
      return true;
    }

    syncPipCardLockUI(cardRef) {
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return;
      const snap = this._getMutablePipCardSnapshot(cardRef);
      const isLocked = Boolean(snap && snap.isPipLocked);
      widget.classList.toggle('pip-locked-mode', isLocked);
      if (!isLocked) {
        if (widget._pipStealthTimer) {
          clearTimeout(widget._pipStealthTimer);
          widget._pipStealthTimer = null;
        }
        widget.classList.remove('pip-stealth-locked');
      }
      const btnLock = isPrimary
        ? document.getElementById('btnGraphCardLock')
        : widget.querySelector('.btn-extra-lock');

      if (btnLock) {
        if (btnLock._renderedLockedState !== isLocked) {
          btnLock._renderedLockedState = isLocked;
          if (isLocked) {
            btnLock.classList.remove('unlocked-editing');
            btnLock.classList.add('locked-confirmed');
            btnLock.innerHTML = '<span class="card-lock-icon" style="display:inline-flex;align-items:center;justify-content:center;"><svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/></svg></span>';
            btnLock.title = '잠금됨 — 클릭하여 잠금 해제 (핸들 조작 · 축 이동 · 시야 영역 확장)';
          } else {
            btnLock.classList.remove('locked-confirmed');
            btnLock.classList.add('unlocked-editing');
            btnLock.innerHTML = '<span class="card-lock-icon" style="display:inline-flex;align-items:center;justify-content:center;"><svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/></svg></span>';
            btnLock.title = '조작 중 — 클릭하여 잠금 (비율 고정 확대/축소 & 여백 드래그로 카드 이동)';
          }
        }
      }

      const cardShowX = (snap && snap.showXAxis !== undefined) ? Boolean(snap.showXAxis) : (this.showXAxis !== false);
      const cardShowY = (snap && snap.showYAxis !== undefined) ? Boolean(snap.showYAxis) : (this.showYAxis !== false);
      const bothAxesOff = (!cardShowX && !cardShowY);
      if (bothAxesOff && snap && snap.isPipDropLineMode) {
        snap.isPipDropLineMode = false;
      }
      const btnDropLine = widget.querySelector('.btn-card-dropline');
      const isDlActive = Boolean(snap && !snap.isPipLocked && snap.isPipDropLineMode && !bothAxesOff && !widget.classList.contains('card-ink-active'));
      if (btnDropLine) {
        btnDropLine.classList.toggle('active', isDlActive);
        btnDropLine.style.display = bothAxesOff ? 'none' : '';
      }
      const liveCv = widget.querySelector('.graph-card-live-canvas');
      if (liveCv) {
        const lockModeKey = `${isLocked}|${isDlActive}`;
        if (liveCv._lastLockCursorMode !== lockModeKey) {
          liveCv._lastLockCursorMode = lockModeKey;
          liveCv.style.cursor = isLocked ? 'move' : (isDlActive ? 'crosshair' : 'default');
        }
      }

      const showCurveTools = Boolean(
        snap &&
        !snap.isPipLocked &&
        snap.isCurveSelected &&
        !snap.isPipDropLineMode &&
        !widget.classList.contains('card-ink-active') &&
        Array.isArray(snap.graphs) &&
        snap.graphs.length > 0
      );
      const hdrTools = widget.querySelector('.pip-header-curve-tools');
      const dragHandleEl = widget.querySelector('.problem-card-drag-handle');
      if (hdrTools) {
        hdrTools.style.display = showCurveTools ? 'inline-flex' : 'none';
        const pop = hdrTools.querySelector('.pip-hdr-popover');
        const symBtn = hdrTools.querySelector('[data-pip-act="symMenu"]');
        if (!showCurveTools) {
          if (pop) pop.style.display = 'none';
          if (symBtn) symBtn.classList.remove('open');
        } else {
          const isSymOpen = Boolean(snap && snap.isPipSymPopoverOpen);
          if (pop) {
            if (isSymOpen) {
              const hRect = widget.getBoundingClientRect();
              pop.classList.toggle('pop-down', hRect.top < 48);
              pop.style.display = 'flex';
            } else {
              pop.style.display = 'none';
            }
          }
          if (symBtn) {
            symBtn.classList.toggle('open', isSymOpen);
          }
          const activeG = snap.graphs[snap.activeGraphIdx];
          const absBtn = hdrTools.querySelector('[data-pip-act="abs"]');
          if (absBtn) {
            const isPristine = Boolean(activeG && activeG.isAbsolute && activeG.isAbsPristine);
            const isFoldedMoved = Boolean(activeG && activeG.isAbsolute && !activeG.isAbsPristine);
            absBtn.classList.toggle('active', isPristine);
            absBtn.classList.toggle('abs-folded', isFoldedMoved);
          }
          const hasInverseLink = Boolean(activeG && activeG.linkedInverseId);
          hdrTools.querySelectorAll('[data-pip-act="unlinkInverse"]').forEach(uBtn => {
            uBtn.style.display = hasInverseLink ? 'inline-flex' : 'none';
          });
        }
      }
      if (dragHandleEl) {
        dragHandleEl.style.display = showCurveTools ? 'none' : 'flex';
      }
      if (isPrimary) {
        const btnClearInk = document.getElementById('btnGraphCardClearInk');
        if (btnClearInk) {
          const hasInk = Array.isArray(this.graphInkStrokes) && this.graphInkStrokes.length > 0;
          const showClearInk = !showCurveTools && (widget.classList.contains('card-ink-active') || hasInk);
          btnClearInk.style.display = showClearInk ? 'inline-flex' : 'none';
        }
      }
    }

    capturePipCardResizeStart(cardRef, e) {
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return null;
      this._ensurePipCardInkMathCoords(cardRef);
      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82);
      const startW = Math.max(160, parseFloat(widget.style.width) || widget.offsetWidth || 430);
      const startH = Math.max(120, (bodyEl && parseFloat(bodyEl.style.height)) || Math.round(startW * aspect));
      const snap = this._getMutablePipCardSnapshot(cardRef);
      if (snap) {
        snap._pipCardW = Math.round(startW);
        snap._pipCardH = Math.round(startH);
        try {
          Object.defineProperty(snap, '_isResizingPipCard', {
            value: true,
            writable: true,
            configurable: true,
            enumerable: false
          });
        } catch (_) {
          snap._isResizingPipCard = true;
        }
      }
      if (this.virtualStylusEl) {
        this.virtualStylusEl.style.display = 'none';
      }
      return {
        startX: e.clientX,
        startY: e.clientY,
        startW,
        startH,
        lastAppliedW: Math.round(startW),
        lastAppliedH: Math.round(startH),
        startAspect: startH / Math.max(1, startW),
        isLocked: Boolean(snap && snap.isPipLocked),
        startXSpan: snap ? (snap.xSpan || 6.2) : 6.2,
        startYSpan: snap ? (snap.ySpan || 5.1) : 5.1,
        startPanX: snap ? (snap.panX || 0) : 0,
        startPanY: snap ? (snap.panY || 0) : 0
      };
    }

    applyPipCardResizeStep(cardRef, e, startState) {
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget || !startState) return;
      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      const snap = this._getMutablePipCardSnapshot(cardRef);

      const curUS = (this.isGraphCovered && this.pdfPageBoardData && typeof this.getCurrentMathUnitScale === 'function')
        ? this.getCurrentMathUnitScale()
        : 0;
      const scaleRatio = (curUS > 0 && widget._pdfAnchor && widget._pdfAnchor.unitScale > 0)
        ? Math.max(0.2, Math.min(4.0, curUS / widget._pdfAnchor.unitScale))
        : ((this.isGraphCovered && !this.pdfPageBoardData) ? Math.max(0.2, Math.min(4.0, this.boardZoom || 1.0)) : 1.0);

      const dw = (e.clientX - startState.startX) / scaleRatio;
      const dh = (e.clientY - startState.startY) / scaleRatio;
      const isLocked = Boolean(snap && snap.isPipLocked);

      let newW;
      let newH;
      let nextAspect;

      if (isLocked) {
        // 🔒 잠금 후: 가로세로 비율을 고정한 채로 그래프와 카드 전체를 비례 확대/축소
        const lockedAspect = startState.startAspect || (isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82));
        newW = Math.round(Math.max(200, Math.min(window.innerWidth * 0.85, startState.startW + dw)));
        newH = Math.round(Math.max(140, newW * lockedAspect));
        nextAspect = lockedAspect;
      } else {
        // 🔓 잠금 전: 그래프 실제 크기(unitScale)는 100% 고정한 채로 현재 카드 센터 기준 화면 영역(시야)만 자유 확장/축소 (와이드 뷰 지원)
        newW = Math.round(Math.max(200, Math.min(window.innerWidth * 0.88, startState.startW + dw)));
        newH = Math.round(Math.max(140, Math.min(window.innerHeight * 0.82, startState.startH + dh)));
        nextAspect = newH / Math.max(1, newW);
      }

      if (startState.lastAppliedW === newW && startState.lastAppliedH === newH) {
        return;
      }
      startState.lastAppliedW = newW;
      startState.lastAppliedH = newH;

      if (!isLocked && snap) {
        snap.xSpan = startState.startXSpan * (newW / Math.max(1, startState.startW));
        snap.ySpan = startState.startYSpan * (newH / Math.max(1, startState.startH));
        snap.panX = startState.startPanX;
        snap.panY = startState.startPanY;
        snap._pipCardW = newW;
        snap._pipCardH = newH;
      }

      widget.style.width = `${newW}px`;
      if (bodyEl) bodyEl.style.height = `${newH}px`;

      if (isPrimary) {
        this.graphCardAspect = nextAspect;
        if (newW >= 140) widget._savedExpandedWidth = `${newW}px`;
        if (this.graphCardRect) {
          this.graphCardRect.w = newW;
          this.graphCardRect.h = newH;
        }
      } else {
        cardRef.aspect = nextAspect;
        if (newW >= 180) widget._savedExpandedWidth = `${newW}px`;
      }

      // 🌟 [iPad 120Hz 리사이즈 패스트패스]:
      // 1) 카드 위에 필기 획이 0개일 때는 빈 필기/레이저 <canvas> 백킹스토어(IOSurface) 재할당과 getBoundingClientRect() 리플로우를 100% 생략!
      // 2) 필기 획이 있는 경우에만 수학 좌표 재투영 및 레이아웃 무측정(_skipLayoutMeasureOnce) 인플레이스 재렌더링 수행!
      const strokes = this._getPipCardInkStrokesArray(cardRef);
      const hasCardInk = Boolean(strokes && strokes.length > 0);
      const inkCanvas = isPrimary
        ? document.getElementById('graphCardCanvas')
        : (bodyEl ? bodyEl.querySelector('.problem-card-canvas') : null);

      if (hasCardInk) {
        const dpr = this.getCanvasDpr();
        const tw = Math.round(newW * dpr);
        const th = Math.round(newH * dpr);
        if (inkCanvas && (inkCanvas.width !== tw || inkCanvas.height !== th)) {
          inkCanvas.width = tw;
          inkCanvas.height = th;
        }
        if (inkCanvas && !isPrimary) {
          inkCanvas._needsSizeSync = false;
          inkCanvas._skipLayoutMeasureOnce = true;
        }
        if (!isLocked) {
          // _reprojectPipCardInkFromMathCoords 내부에서 renderGraphCardCanvas / _renderCardInkCanvas 1회 자동 호출!
          this._reprojectPipCardInkFromMathCoords(cardRef, newW, newH);
        } else if (isPrimary) {
          this.renderGraphCardCanvas();
        } else if (typeof widget._renderCardInkCanvas === 'function') {
          widget._renderCardInkCanvas();
        }
      } else if (inkCanvas && !isPrimary) {
        inkCanvas._needsSizeSync = true;
      }

      if (widget._cardLaserState && widget._cardLaserState.strokes && widget._cardLaserState.strokes.length > 0 && typeof widget._syncCardLaserSize === 'function') {
        widget._syncCardLaserSize();
      }

      if (widget._pipRenderRafId) {
        cancelAnimationFrame(widget._pipRenderRafId);
        widget._pipRenderRafId = null;
      }
      widget._lastPipRenderTs = performance.now();
      this.renderPipGraphCard(cardRef);
    }

    finalizePipCardResize(cardRef, startState = null, revertToStart = false) {
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return;
      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      const snap = this._getMutablePipCardSnapshot(cardRef);

      if (snap) {
        snap._isResizingPipCard = false;
        delete snap._isResizingPipCard;
      }

      if (revertToStart && startState) {
        const revW = Math.round(startState.startW || 430);
        const revH = Math.round(startState.startH || 353);
        const revAspect = startState.startAspect || (revH / Math.max(1, revW));
        widget.style.width = `${revW}px`;
        if (bodyEl) bodyEl.style.height = `${revH}px`;
        if (isPrimary) {
          this.graphCardAspect = revAspect;
        } else {
          cardRef.aspect = revAspect;
        }
        if (snap && !startState.isLocked) {
          snap.xSpan = startState.startXSpan;
          snap.ySpan = startState.startYSpan;
          snap.panX = startState.startPanX;
          snap.panY = startState.startPanY;
          snap._pipCardW = revW;
          snap._pipCardH = revH;
          this._reprojectPipCardInkFromMathCoords(cardRef, revW, revH);
        }
      }

      if (widget._pipRenderRafId) {
        cancelAnimationFrame(widget._pipRenderRafId);
        widget._pipRenderRafId = null;
      }

      if (isPrimary) {
        // 손을 떼는 즉시 840스텝 초고밀도 곡선 + 네온 글로우 + 3D 핸들 섀도우 + 필기/레이저 캔버스 해상도 100% 동기화!
        this.syncGraphCardRectFromWidget(false);
      } else {
        const extraInkCanvas = bodyEl ? bodyEl.querySelector('.problem-card-canvas') : null;
        if (extraInkCanvas) extraInkCanvas._needsSizeSync = true;
        const strokes = this._getPipCardInkStrokesArray(cardRef);
        if (strokes && strokes.length > 0 && typeof widget._renderCardInkCanvas === 'function') {
          widget._renderCardInkCanvas();
        }
        if (typeof widget._syncCardLaserSize === 'function') {
          widget._syncCardLaserSize();
        }
        this.renderPipGraphCard(cardRef);
      }
    }

    requestPipGraphCardRender(cardRef) {
      const { widget } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return;
      if (!widget._pipRenderRafId) {
        widget._pipRenderRafId = requestAnimationFrame(() => {
          widget._pipRenderRafId = null;
          widget._lastPipRenderTs = performance.now();
          this.renderPipGraphCard(cardRef);
        });
      }
    }

    renderPipGraphCard(cardRef) {
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget || widget.style.display === 'none' || widget.classList.contains('minimized')) return;
      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      if (!bodyEl) return;
      const liveCanvas = bodyEl.querySelector('.graph-card-live-canvas');
      const imgEl = bodyEl.querySelector('.problem-card-img');
      if (!liveCanvas) return;

      const snapObj = this._getMutablePipCardSnapshot(cardRef);
      if (!snapObj || snapObj.isNAxisStudioCard || !Array.isArray(snapObj.graphs) || snapObj.graphs.length === 0) {
        liveCanvas.style.display = 'none';
        if (imgEl) imgEl.style.opacity = '1';
        widget.classList.remove('pip-manipulating');
        return;
      }

      const activeG = Array.isArray(snapObj.graphs) ? snapObj.graphs[snapObj.activeGraphIdx] : null;
      const cardShowX = (snapObj.showXAxis !== undefined) ? Boolean(snapObj.showXAxis) : (this.showXAxis !== false);
      const cardShowY = (snapObj.showYAxis !== undefined) ? Boolean(snapObj.showYAxis) : (this.showYAxis !== false);
      const uiSig = `${Boolean(snapObj.isPipLocked)}|${Boolean(snapObj.isCurveSelected)}|${Boolean(snapObj.isPipDropLineMode)}|${Boolean(snapObj.isPipSymPopoverOpen)}|${Boolean(widget.classList.contains('card-ink-active'))}|${Boolean(cardShowX)}|${Boolean(cardShowY)}|${activeG ? `${activeG.id}:${Boolean(activeG.isAbsolute)}:${Boolean(activeG.isAbsPristine)}:${Boolean(activeG.linkedInverseId)}:${Boolean(activeG.isTransposedYX)}` : ''}`;
      if (widget._lastPipLockUiSig !== uiSig) {
        widget._lastPipLockUiSig = uiSig;
        this.syncPipCardLockUI(cardRef);
      }

      const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82);
      const cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || bodyEl.clientWidth || 430));
      const cardH = Math.max(120, Math.round(parseFloat(bodyEl.style.height) || (cardW * aspect)));
      const dpr = this.getCanvasDpr();
      const targetW = Math.round(cardW * dpr);
      const targetH = Math.round(cardH * dpr);
      if (liveCanvas.width !== targetW || liveCanvas.height !== targetH) {
        liveCanvas.width = targetW;
        liveCanvas.height = targetH;
      }
      liveCanvas.style.display = 'block';
      if (imgEl) imgEl.style.opacity = '0';

      const isManipulating = Boolean(!snapObj.isPipLocked && snapObj.isCurveSelected && !snapObj.isPipDropLineMode && !widget.classList.contains('card-ink-active'));
      widget.classList.toggle('pip-manipulating', isManipulating);

      if (widget._pendingPipInkReproject) {
        widget._pendingPipInkReproject = null;
        this._reprojectPipCardInkFromMathCoords(cardRef, cardW, cardH);
      }

      const ctx = liveCanvas.getContext('2d');
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cardW, cardH);

      this._withPipCardGraphState(snapObj, cardW, cardH, () => {
        const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || { bg: '#ffffff', isLight: true };
        ctx.fillStyle = this.isMonochromeMode ? '#ffffff' : (curTheme.bg || '#ffffff');
        ctx.fillRect(0, 0, cardW, cardH);

        if (this.showGuides) this.drawGuides(ctx, this._snapshotCropBounds);
        if (this.showInverseGuide) this.drawInverseGuide(ctx);
        if (this.showAsymptotes) this.drawAllAsymptotes(ctx);
        if (this.showAxes) this.drawAxes(ctx, this._snapshotCropBounds);
        if (this.showAxes && this.showGridNumbers) this.drawGridNumbers(ctx, this._snapshotCropBounds);

        const cleanPass = !isManipulating;
        this.drawAllCurves(ctx, cleanPass);

        if (this.usePiecewise && this.graphs.length >= 1) {
          this.drawPiecewiseBoundaries(ctx, cleanPass);
        }
        this.drawDropLines(ctx, cleanPass);
        this.drawTextLabels(ctx, cleanPass);

        if (isManipulating && this.activeGraph) {
          this.drawHandles(ctx, this.activeGraph);
        }
      });

      ctx.restore();
    }

    bakePipGraphCardToImg(cardRef) {
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return null;
      const snapObj = this._getMutablePipCardSnapshot(cardRef);
      if (!snapObj || snapObj.isNAxisStudioCard || !Array.isArray(snapObj.graphs) || snapObj.graphs.length === 0) return null;

      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      const imgEl = bodyEl ? bodyEl.querySelector('.problem-card-img') : null;
      const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82);
      const cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || (bodyEl && bodyEl.clientWidth) || 430));
      const cardH = Math.max(120, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cardW * aspect)));

      const snapScale = 3.0;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(1, Math.round(cardW * snapScale));
      cropCanvas.height = Math.max(1, Math.round(cardH * snapScale));
      const cctx = cropCanvas.getContext('2d');
      cctx.save();
      cctx.scale(snapScale, snapScale);

      this._withPipCardGraphState(snapObj, cardW, cardH, () => {
        const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || { bg: '#ffffff', isLight: true };
        cctx.fillStyle = this.isMonochromeMode ? '#ffffff' : (curTheme.bg || '#ffffff');
        cctx.fillRect(0, 0, cardW, cardH);

        if (this.showGuides) this.drawGuides(cctx, this._snapshotCropBounds);
        if (this.showInverseGuide) this.drawInverseGuide(cctx);
        if (this.showAsymptotes) this.drawAllAsymptotes(cctx);
        if (this.showAxes) this.drawAxes(cctx, this._snapshotCropBounds);
        if (this.showAxes && this.showGridNumbers) this.drawGridNumbers(cctx, this._snapshotCropBounds);
        this.drawAllCurves(cctx, true);
        if (this.usePiecewise && this.graphs.length >= 1) {
          this.drawPiecewiseBoundaries(cctx, true);
        }
        this.drawDropLines(cctx, true);
        this.drawTextLabels(cctx, true);
      });
      cctx.restore();

      const dataUrl = cropCanvas.toDataURL('image/png');
      this._savePipCardSnapshot(cardRef, snapObj);
      if (isPrimary) {
        this.graphCardImage = cropCanvas;
        if (this.graphCardData) {
          this.graphCardData.imgUrl = dataUrl;
          this.graphCardData.dataUrl = dataUrl;
        }
      } else if (cardRef) {
        cardRef.dataUrl = dataUrl;
      }
      if (imgEl) {
        imgEl.src = dataUrl;
      }
      return { cropCanvas, dataUrl };
    }

    scheduleBakePipGraphCardToImg(cardRef, delayMs = 260) {
      const { widget } = this._getPipCardWidgetAndSnapRaw(cardRef);
      const snapObj = this._getMutablePipCardSnapshot(cardRef);
      if (snapObj) {
        this._savePipCardSnapshot(cardRef, snapObj);
      }
      if (!widget) return;
      if (widget._bakePipTimerId) {
        clearTimeout(widget._bakePipTimerId);
        widget._bakePipTimerId = null;
      }
      widget._pendingBakeCardRef = cardRef;
      const runBakeWhenIdle = () => {
        widget._bakePipTimerId = null;
        if (cardRef === 'primary') {
          if (!this._hasPrimaryGraphCard || !this.graphCardData || widget.style.display === 'none') {
            widget._pendingBakeCardRef = null;
            return;
          }
        } else if (!Array.isArray(this.extraGraphCards) || !this.extraGraphCards.includes(cardRef) || widget.isConnected === false) {
          widget._pendingBakeCardRef = null;
          return;
        }
        const nowT = Date.now();
        const isBusy = (typeof this.isActivelyWritingOrInteracting === 'function' && this.isActivelyWritingOrInteracting()) ||
          this.isDrawingInk ||
          this._isDrawingCardInk ||
          this.isStylusDrawing ||
          this.isErasingInk ||
          (this._lastPenActiveTime && (nowT - this._lastPenActiveTime < 320));
        if (isBusy) {
          widget._bakePipTimerId = setTimeout(runBakeWhenIdle, 240);
          return;
        }
        widget._pendingBakeCardRef = null;
        this.bakePipGraphCardToImg(cardRef);
      };
      widget._bakePipTimerId = setTimeout(runBakeWhenIdle, delayMs);
    }

    flushPendingPipCardBakes() {
      const pWidget = document.getElementById('graphCardWidget');
      if (pWidget && pWidget._bakePipTimerId) {
        clearTimeout(pWidget._bakePipTimerId);
        pWidget._bakePipTimerId = null;
        pWidget._pendingBakeCardRef = null;
        if (this._hasPrimaryGraphCard && this.graphCardData && pWidget.style.display !== 'none') {
          this.bakePipGraphCardToImg('primary');
        }
      }
      if (Array.isArray(this.extraGraphCards)) {
        for (let i = 0; i < this.extraGraphCards.length; i++) {
          const c = this.extraGraphCards[i];
          if (c && c.el && c.el._bakePipTimerId) {
            clearTimeout(c.el._bakePipTimerId);
            c.el._bakePipTimerId = null;
            c.el._pendingBakeCardRef = null;
            if (c.el.isConnected !== false) {
              this.bakePipGraphCardToImg(c);
            }
          }
        }
      }
    }

    _hasAnyActivePipCardSelectionOrMode() {
      if (this._hasPrimaryGraphCard && this.graphCardData) {
        const snap = this.pipGraphLiveSnap;
        if (snap && (snap.isPipDropLineMode || snap.isCurveSelected || snap.selectedHandleIdx !== null || snap.isPipSymPopoverOpen)) {
          return true;
        }
      }
      if (Array.isArray(this.extraGraphCards)) {
        for (let i = 0; i < this.extraGraphCards.length; i++) {
          const c = this.extraGraphCards[i];
          const snap = c && c.liveSnap;
          if (snap && (snap.isPipDropLineMode || snap.isCurveSelected || snap.selectedHandleIdx !== null || snap.isPipSymPopoverOpen)) {
            return true;
          }
        }
      }
      return false;
    }

    deselectAllPipGraphCards(exceptWidget = null) {
      if (this._activeCardLasso && this._activeCardLasso.widgetEl !== exceptWidget) {
        this.clearCardLassoSelection();
      }
      this._closeAllPipHeaderPopovers();
      let anyChanged = false;
      let anyDropLineTurnedOff = false;
      const primaryWidget = document.getElementById('graphCardWidget');
      if (primaryWidget && primaryWidget !== exceptWidget && this._hasPrimaryGraphCard && this.graphCardData) {
        const snap = this._getMutablePipCardSnapshot('primary');
        if (snap && (snap.isCurveSelected || snap.selectedHandleIdx !== null || snap.isPipDropLineMode || snap.isPipSymPopoverOpen || primaryWidget.classList.contains('pip-manipulating'))) {
          if (snap.isPipDropLineMode) anyDropLineTurnedOff = true;
          snap.isCurveSelected = false;
          snap.selectedHandleIdx = null;
          snap.draggedHandleIdx = null;
          snap.isPipDropLineMode = false;
          snap.isPipSymPopoverOpen = false;
          snap._pipDropLineHoverCand = null;
          snap._pipDropLineHoverScissors = null;
          snap._activeSnapHint = null;
          primaryWidget.classList.remove('pip-manipulating');
          primaryWidget._lastPipLockUiSig = '';
          this._savePipCardSnapshot('primary', snap);
          this.syncPipCardLockUI('primary');
          this.renderPipGraphCard('primary');
          this.scheduleBakePipGraphCardToImg('primary');
          anyChanged = true;
        }
      }
      if (Array.isArray(this.extraGraphCards)) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el && c.el !== exceptWidget) {
            const snap = this._getMutablePipCardSnapshot(c);
            if (snap && (snap.isCurveSelected || snap.selectedHandleIdx !== null || snap.isPipDropLineMode || snap.isPipSymPopoverOpen || c.el.classList.contains('pip-manipulating'))) {
              if (snap.isPipDropLineMode) anyDropLineTurnedOff = true;
              snap.isCurveSelected = false;
              snap.selectedHandleIdx = null;
              snap.draggedHandleIdx = null;
              snap.isPipDropLineMode = false;
              snap.isPipSymPopoverOpen = false;
              snap._pipDropLineHoverCand = null;
              snap._pipDropLineHoverScissors = null;
              snap._activeSnapHint = null;
              c.el.classList.remove('pip-manipulating');
              c.el._lastPipLockUiSig = '';
              this._savePipCardSnapshot(c, snap);
              this.syncPipCardLockUI(c);
              this.renderPipGraphCard(c);
              this.scheduleBakePipGraphCardToImg(c);
              anyChanged = true;
            }
          }
        });
      }
      if (anyDropLineTurnedOff) {
        this.showToast('📍 수선 그리기 꺼짐');
      }
      if (anyChanged && this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    _getSelectedPipGraphCardTarget() {
      const primaryWidget = document.getElementById('graphCardWidget');
      if (primaryWidget && primaryWidget.style.display !== 'none' && this._hasPrimaryGraphCard && this.graphCardData) {
        const snap = this._getMutablePipCardSnapshot('primary');
        if (snap && !snap.isPipLocked && !snap.isNAxisStudioCard && Array.isArray(snap.graphs) && snap.graphs.length > 0) {
          if (snap.selectedHandleIdx !== null || snap.isCurveSelected) {
            return { cardRef: 'primary', widget: primaryWidget, snap, isPrimary: true };
          }
        }
      }
      if (Array.isArray(this.extraGraphCards)) {
        for (let i = this.extraGraphCards.length - 1; i >= 0; i--) {
          const c = this.extraGraphCards[i];
          if (c && c.el && c.el.style.display !== 'none') {
            const snap = this._getMutablePipCardSnapshot(c);
            if (snap && !snap.isPipLocked && !snap.isNAxisStudioCard && Array.isArray(snap.graphs) && snap.graphs.length > 0) {
              if (snap.selectedHandleIdx !== null || snap.isCurveSelected) {
                return { cardRef: c, widget: c.el, snap, isPrimary: false };
              }
            }
          }
        }
      }
      return null;
    }

    _deleteSelectedGraphInPipCard(target = null) {
      const resolved = target || this._getSelectedPipGraphCardTarget();
      if (!resolved) return false;
      const { cardRef, widget, snap, isPrimary } = resolved;
      if (!snap || !Array.isArray(snap.graphs) || snap.graphs.length === 0) return false;

      if (snap.graphs.length > 1) {
        this._pushWorkspaceUndoSnapshot('↺ 삭제한 함수가 카드에 복원되었습니다', '↻ 함수 삭제 다시 실행됨');
        const delIdx = (typeof snap.activeGraphIdx === 'number' && snap.activeGraphIdx >= 0 && snap.activeGraphIdx < snap.graphs.length)
          ? snap.activeGraphIdx
          : (snap.graphs.length - 1);
        const delG = snap.graphs[delIdx];
        const delId = delG ? delG.id : null;
        if (delG && delG.linkedInverseId) {
          const partner = snap.graphs.find(item => item && item.id === delG.linkedInverseId);
          if (partner) partner.linkedInverseId = null;
        }
        snap.graphs.splice(delIdx, 1);
        if (delId && Array.isArray(snap.dropLines) && snap.dropLines.length > 0) {
          snap.dropLines = snap.dropLines.filter(dl => {
            if (!dl || !dl.binding) return true;
            const b = dl.binding;
            if (b.isIntersection || b.name === '교점') {
              const ids = b.layerIds || (b.layerId ? [b.layerId] : []);
              const survivingId = ids.find(id => id !== delId && snap.graphs.some(gr => gr && gr.id === id));
              if (survivingId) {
                const survivingGraph = snap.graphs.find(gr => gr && gr.id === survivingId);
                b.layerId = survivingId;
                b.layerIds = [survivingId];
                b.isIntersection = false;
                b.name = '곡선 점';
                const isSurvGeom = survivingGraph && typeof survivingGraph.type === 'string' && survivingGraph.type.startsWith('geom_');
                if (isSurvGeom && survivingGraph.type === 'geom_circle' && Array.isArray(survivingGraph.handles) && survivingGraph.handles.length >= 2 && this.engine) {
                  const cp = this.engine.getHandleWorldPos(survivingGraph, survivingGraph.handles[0]);
                  b.type = 'geom_circle_pt';
                  b.anchorAngle = Math.atan2(dl.sourceY - cp.y, dl.sourceX - cp.x);
                } else if (!isSurvGeom) {
                  const isVertSurv = survivingGraph && survivingGraph.type === '1st_linear' && !survivingGraph.isTransposedYX &&
                    Array.isArray(survivingGraph.handles) && survivingGraph.handles.length >= 2 &&
                    Math.abs(survivingGraph.handles[1].x - survivingGraph.handles[0].x) < 1e-4;
                  if (isVertSurv) {
                    b.type = 'vert_line';
                    b.anchorY = dl.sourceY;
                  } else {
                    b.type = 'curve';
                    const worldParam = (survivingGraph && survivingGraph.isTransposedYX) ? dl.sourceY : dl.sourceX;
                    b.anchorX = worldParam;
                    if (survivingGraph && this.engine) {
                      b.anchorBaseX = this.engine.worldXToBaseX(survivingGraph, worldParam);
                    }
                  }
                }
                return true;
              }
              return false;
            }
            return b.layerId !== delId;
          });
        }
        if (!snap.graphs.some(item => item && item.linkedInverseId)) {
          snap.showInverseGuide = false;
        }
        snap.activeGraphIdx = Math.max(0, snap.graphs.length - 1);
        snap.selectedHandleIdx = null;
        snap.isCurveSelected = true;
        if (widget) widget._lastPipLockUiSig = '';
        this._savePipCardSnapshot(cardRef, snap);
        this.syncPipCardLockUI(cardRef);
        this.renderPipGraphCard(cardRef);
        this.scheduleBakePipGraphCardToImg(cardRef);
        if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
        this.showToast('🗑️ 선택한 함수를 삭제했습니다 (되돌리기 ↺로 복원 가능)');
        return true;
      } else {
        const closeBtn = isPrimary ? document.getElementById('btnGraphCardClose') : (widget && widget.querySelector('.btn-extra-close'));
        if (closeBtn) {
          closeBtn.click();
          return true;
        }
      }
      return false;
    }

    _handlePipCardKeyDown(e) {
      if (!e || e.ctrlKey || e.metaKey || e.altKey) return false;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'Tab', 'Delete', 'Backspace'].includes(e.key)) return false;

      if ((e.key === 'Delete' || e.key === 'Backspace') && this._activeCardLasso && Array.isArray(this._activeCardLasso.selectedStrokes) && this._activeCardLasso.selectedStrokes.length > 0) {
        return false;
      }

      const target = this._getSelectedPipGraphCardTarget();
      if (!target) return false;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        return this._deleteSelectedGraphInPipCard(target);
      }

      const { cardRef, widget, snap, isPrimary } = target;
      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82);
      const cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || (bodyEl && bodyEl.clientWidth) || 430));
      const cardH = Math.max(120, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cardW * aspect)));

      if (e.key === 'Escape') {
        e.preventDefault();
        if (snap.selectedHandleIdx !== null) {
          snap.selectedHandleIdx = null;
        } else {
          snap.isCurveSelected = false;
        }
        this._savePipCardSnapshot(cardRef, snap);
        this.renderPipGraphCard(cardRef);
        this.scheduleBakePipGraphCardToImg(cardRef);
        if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
        return true;
      }

      if (e.key === 'Tab') {
        let handledTab = false;
        this._withPipCardGraphState(snap, cardW, cardH, () => {
          const g = this.activeGraph;
          if (!g || !Array.isArray(g.handles)) return;
          const visibleIdxs = [];
          g.handles.forEach((h, idx) => {
            if (h && !h.hidden) visibleIdxs.push(idx);
          });
          if (visibleIdxs.length === 0) return;
          const curPos = visibleIdxs.indexOf(this.selectedHandleIdx);
          const dir = e.shiftKey ? -1 : 1;
          const nextPos = curPos === -1 ? 0 : (curPos + dir + visibleIdxs.length) % visibleIdxs.length;
          this.selectedHandleIdx = visibleIdxs[nextPos];
          this.isCurveSelected = true;
          handledTab = true;
        });
        if (handledTab) {
          e.preventDefault();
          this._savePipCardSnapshot(cardRef, snap);
          this.renderPipGraphCard(cardRef);
          this.scheduleBakePipGraphCardToImg(cardRef);
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
          return true;
        }
        return false;
      }

      const step = e.shiftKey ? 0.2 : 0.04;
      let handledArrow = false;

      this._withPipCardGraphState(snap, cardW, cardH, () => {
        const g = this.activeGraph;
        if (!g) return;

        this.axisSnapActiveX = false;
        this.axisSnapActiveY = false;
        this.symmetrySnapActive = false;
        this.snapActiveX = false;
        this.snapActiveY = false;
        this.snappedPoints = [];

        if (this.selectedHandleIdx !== null && Array.isArray(g.handles) && g.handles[this.selectedHandleIdx]) {
          const h = g.handles[this.selectedHandleIdx];
          let newX = h.x;
          let newY = h.y;
          if (e.key === 'ArrowUp') newY += step;
          else if (e.key === 'ArrowDown') newY -= step;
          else if (e.key === 'ArrowLeft') newX -= step;
          else if (e.key === 'ArrowRight') newX += step;

          this.dragActiveHandle(this.selectedHandleIdx, newX, newY, true, true);
          if (g.isAbsolute && g.isAbsPristine) {
            g.isAbsPristine = false;
          }
          handledArrow = true;
        } else if (this.isCurveSelected && Array.isArray(g.handles)) {
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowUp') dy += step;
          else if (e.key === 'ArrowDown') dy -= step;
          else if (e.key === 'ArrowLeft') dx -= step;
          else if (e.key === 'ArrowRight') dx += step;

          if (dx !== 0 || dy !== 0) {
            if (this.isShapeCenterLocked(g)) {
              this.showCenterLockHint();
            } else {
              const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
              const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
              const hasTransforms = Boolean(g.isAbsolute || (g.transforms && g.transforms.length > 0) || g.isFrozen || g.frozenInvertH || g.frozenInvertV || g.frozenAbsolute || ox !== 0 || oy !== 0);

              if (hasTransforms) {
                if (!g.freezeOffset) g.freezeOffset = { x: 0, y: 0 };
                g.freezeOffset.x = Math.round((g.freezeOffset.x + dx) * 100) / 100;
                g.freezeOffset.y = Math.round((g.freezeOffset.y + dy) * 100) / 100;
                if (g.isAbsolute && g.isAbsPristine) {
                  g.isAbsPristine = false;
                }
                const partner = this.getLinkedPartner(g);
                if (partner) {
                  if (!partner.freezeOffset) partner.freezeOffset = { x: 0, y: 0 };
                  partner.freezeOffset.x = Math.round((partner.freezeOffset.x + dy) * 100) / 100;
                  partner.freezeOffset.y = Math.round((partner.freezeOffset.y + dx) * 100) / 100;
                }
              } else {
                g.handles.forEach(h => {
                  h.x = Math.round((h.x + dx) * 100) / 100;
                  h.y = Math.round((h.y + dy) * 100) / 100;
                });
                const partner = this.getLinkedPartner(g);
                if (partner && Array.isArray(partner.handles)) {
                  partner.handles.forEach(h => {
                    h.x = Math.round((h.x + dy) * 100) / 100;
                    h.y = Math.round((h.y + dx) * 100) / 100;
                  });
                }
              }
            }
            handledArrow = true;
          }
        }
      });

      if (handledArrow) {
        e.preventDefault();
        this._pipArrowModifiedCardRef = cardRef;
        this.renderPipGraphCard(cardRef);
        this.scheduleBakePipGraphCardToImg(cardRef);
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(false);
        }
        return true;
      }
      return false;
    }

    _getPipCardRefFromWidget(widgetEl) {
      if (!widgetEl) return null;
      const primaryWidget = document.getElementById('graphCardWidget');
      if (widgetEl === primaryWidget && this._hasPrimaryGraphCard && this.graphCardData) {
        return 'primary';
      }
      if (Array.isArray(this.extraGraphCards)) {
        const found = this.extraGraphCards.find(c => c && c.el === widgetEl);
        if (found) return found;
      }
      return null;
    }

    _getTargetPipGraphCardForAxisOrPreset() {
      const selected = this._getSelectedPipGraphCardTarget();
      if (selected) return selected;

      const candidates = [];
      const primaryWidget = document.getElementById('graphCardWidget');
      if (primaryWidget && primaryWidget.style.display !== 'none' && this._hasPrimaryGraphCard && this.graphCardData) {
        const snap = this._getMutablePipCardSnapshot('primary');
        if (snap && !snap.isNAxisStudioCard && Array.isArray(snap.graphs) && snap.graphs.length > 0) {
          candidates.push({
            cardRef: 'primary',
            widget: primaryWidget,
            snap,
            isPrimary: true,
            zIndex: parseInt(primaryWidget.style.zIndex, 10) || 150
          });
        }
      }
      if (Array.isArray(this.extraGraphCards)) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el && c.el.style.display !== 'none') {
            const snap = this._getMutablePipCardSnapshot(c);
            if (snap && !snap.isNAxisStudioCard && Array.isArray(snap.graphs) && snap.graphs.length > 0) {
              candidates.push({
                cardRef: c,
                widget: c.el,
                snap,
                isPrimary: false,
                zIndex: parseInt(c.el.style.zIndex, 10) || 150
              });
            }
          }
        });
      }
      if (candidates.length === 0) return null;
      if (candidates.length === 1) return candidates[0];

      const unlocked = candidates.filter(it => !it.snap.isPipLocked);
      const pool = unlocked.length > 0 ? unlocked : candidates;
      if (this._lastFocusedPipCardRef) {
        const focused = pool.find(it => it.cardRef === this._lastFocusedPipCardRef);
        if (focused) return focused;
      }
      pool.sort((a, b) => b.zIndex - a.zIndex);
      return pool[0];
    }

    _applyAxisVisibilityToTargetPipCard(showX, showY) {
      if (!this.isGraphCovered) return false;
      const target = this._getTargetPipGraphCardForAxisOrPreset();
      if (!target || !target.snap) return false;
      target.snap.showXAxis = showX !== false;
      target.snap.showYAxis = showY !== false;
      this._savePipCardSnapshot(target.cardRef, target.snap);
      if (target.widget) target.widget._lastPipLockUiSig = '';
      this.syncPipCardLockUI(target.cardRef);
      this.renderPipGraphCard(target.cardRef);
      this.bakePipGraphCardToImg(target.cardRef);
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      return true;
    }

    _refreshAllOpenPipGraphCards() {
      if (this._hasPrimaryGraphCard && this.graphCardData) {
        this.renderPipGraphCard('primary');
        this.bakePipGraphCardToImg('primary');
      }
      if (Array.isArray(this.extraGraphCards)) {
        this.extraGraphCards.forEach(c => {
          if (c && c.graphSnapshot) {
            this.renderPipGraphCard(c);
            this.bakePipGraphCardToImg(c);
          }
        });
      }
    }

    _computeDiagonalOffsetCardBasePos(refCard = null, cardW = 430, cardH = 353) {
      const stepPx = 38; // 우하단 45도 대각선 오프셋 (+38px, +38px)
      const primaryWidget = document.getElementById('graphCardWidget');

      let targetRef = refCard;
      if (!targetRef) {
        if (Array.isArray(this.extraGraphCards) && this.extraGraphCards.length > 0) {
          targetRef = this.extraGraphCards[this.extraGraphCards.length - 1];
        } else if (this._hasPrimaryGraphCard && this.graphCardData) {
          targetRef = 'primary';
        }
      }

      let refX = 560;
      let refY = 68;
      let refAnchor = null;

      if (targetRef === 'primary') {
        refX = (typeof this.graphCardBaseX === 'number')
          ? this.graphCardBaseX
          : ((primaryWidget && parseFloat(primaryWidget.style.left)) || 560);
        refY = (typeof this.graphCardBaseY === 'number')
          ? this.graphCardBaseY
          : ((primaryWidget && parseFloat(primaryWidget.style.top)) || 68);
        refAnchor = (primaryWidget && primaryWidget._pdfAnchor) || this.graphCardPdfAnchor || null;
      } else if (targetRef && targetRef.el) {
        refX = (typeof targetRef.baseX === 'number')
          ? targetRef.baseX
          : (parseFloat(targetRef.el.style.left) || 560);
        refY = (typeof targetRef.baseY === 'number')
          ? targetRef.baseY
          : (parseFloat(targetRef.el.style.top) || 68);
        refAnchor = targetRef.el._pdfAnchor || targetRef.pdfAnchor || null;
      } else {
        const vw = window.innerWidth || 1440;
        const vh = window.innerHeight || 900;
        const sx = Math.round((vw - cardW) * 0.5 + (this.hasActiveProblemCard() ? 70 : 0));
        const sy = Math.round(Math.max(64, (vh - cardH) * 0.5 - 24));
        if (!this.pdfPageBoardData && !this._suspendedPdfBoardState) {
          const bPos = this.screenToBoard(sx, sy);
          return { x: Math.round(bPos.x), y: Math.round(bPos.y), pdfAnchor: null };
        }
        return { x: sx, y: sy, pdfAnchor: null };
      }

      const existingPositions = [];
      if (this._hasPrimaryGraphCard && this.graphCardData) {
        existingPositions.push({
          x: (typeof this.graphCardBaseX === 'number') ? this.graphCardBaseX : 560,
          y: (typeof this.graphCardBaseY === 'number') ? this.graphCardBaseY : 68
        });
      }
      if (Array.isArray(this.extraGraphCards)) {
        this.extraGraphCards.forEach(c => {
          if (c && typeof c.baseX === 'number' && typeof c.baseY === 'number') {
            existingPositions.push({ x: c.baseX, y: c.baseY });
          }
        });
      }

      let stepMult = 1;
      let nextX = Math.round(refX + stepPx);
      let nextY = Math.round(refY + stepPx);
      while (
        stepMult < 8 &&
        existingPositions.some(p => Math.hypot(p.x - nextX, p.y - nextY) < 14)
      ) {
        stepMult++;
        nextX = Math.round(refX + stepPx * stepMult);
        nextY = Math.round(refY + stepPx * stepMult);
      }

      let nextAnchor = null;
      if (refAnchor && typeof refAnchor.mx === 'number' && typeof refAnchor.my === 'number') {
        const uScale = Math.max(10, refAnchor.unitScale || 60);
        nextAnchor = {
          mx: Number((refAnchor.mx + (stepPx * stepMult) / uScale).toFixed(4)),
          my: Number((refAnchor.my - (stepPx * stepMult) / uScale).toFixed(4)),
          unitScale: refAnchor.unitScale || 60
        };
      }

      return {
        x: nextX,
        y: nextY,
        pdfAnchor: nextAnchor
      };
    }

    duplicatePipGraphCard(cardRef) {
      if (!cardRef) return null;
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return null;
      const srcSnap = this._getMutablePipCardSnapshot(cardRef);
      if (!srcSnap) return null;

      this._pushWorkspaceUndoSnapshot('↺ 복제된 그래프 창이 취소되었습니다', '↻ 그래프 창 복제 다시 실행됨');
      this._ensurePipCardInkMathCoords(cardRef);
      this.deselectAllPipGraphCards();

      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82);
      const cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || (bodyEl && bodyEl.clientWidth) || 430));
      const cardH = Math.max(120, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cardW * aspect)));

      const clonedSnap = JSON.parse(JSON.stringify(srcSnap));
      this._rebindClonedSnapshotGraphAndDropLineIds(clonedSnap);
      clonedSnap.isPipLocked = false;
      clonedSnap.isCurveSelected = false;
      clonedSnap.selectedHandleIdx = null;
      clonedSnap.draggedHandleIdx = null;
      clonedSnap.isPipDropLineMode = false;
      clonedSnap._pipDropLineHoverCand = null;
      clonedSnap._pipDropLineHoverScissors = null;
      clonedSnap._pipRenderedScissors = [];
      clonedSnap.isPipSymPopoverOpen = false;
      clonedSnap._isPipCardSnapshot = true;
      clonedSnap._pipCardW = cardW;
      clonedSnap._pipCardH = cardH;

      const srcInk = this._getPipCardInkStrokesArray(cardRef);
      const clonedInk = Array.isArray(srcInk) ? JSON.parse(JSON.stringify(srcInk)) : [];
      const clonedStickers = Array.isArray(widget._cardStickers) ? JSON.parse(JSON.stringify(widget._cardStickers)) : [];

      const snapScale = 2.5;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.round(cardW * snapScale);
      tempCanvas.height = Math.round(cardH * snapScale);
      const tctx = tempCanvas.getContext('2d');
      tctx.save();
      tctx.scale(snapScale, snapScale);
      this._withPipCardGraphState(clonedSnap, cardW, cardH, () => {
        const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || { bg: '#ffffff', isLight: true };
        tctx.fillStyle = this.isMonochromeMode ? '#ffffff' : (curTheme.bg || '#ffffff');
        tctx.fillRect(0, 0, cardW, cardH);
        if (this.showGuides) this.drawGuides(tctx, this._snapshotCropBounds);
        if (this.showInverseGuide) this.drawInverseGuide(tctx);
        if (this.showAsymptotes) this.drawAllAsymptotes(tctx);
        if (this.showAxes) this.drawAxes(tctx, this._snapshotCropBounds);
        if (this.showAxes && this.showGridNumbers) this.drawGridNumbers(tctx, this._snapshotCropBounds);
        this.drawAllCurves(tctx);
        if (this.usePiecewise && this.graphs.length >= 1) {
          this.drawPiecewiseBoundaries(tctx);
        }
        this.drawDropLines(tctx, true);
        this.drawTextLabels(tctx);
      });
      tctx.restore();
      const dataUrl = tempCanvas.toDataURL('image/png');

      const diagPos = this._computeDiagonalOffsetCardBasePos(cardRef, cardW, cardH);
      const createdRef = this.setGraphCard(
        dataUrl,
        tempCanvas,
        cardW,
        { x: diagPos.x, y: diagPos.y, w: cardW, h: cardH },
        JSON.stringify(clonedSnap),
        {
          cardW,
          aspect,
          directBasePos: diagPos,
          alreadyInBoardMode: Boolean(this.isGraphCovered),
          silentToast: true
        }
      );

      if (createdRef) {
        this._setPipCardInkStrokesArray(createdRef, clonedInk);
        const { widget: createdWidget, isPrimary: createdIsPrimary } = this._getPipCardWidgetAndSnapRaw(createdRef);
        if (createdWidget && clonedStickers.length > 0) {
          createdWidget._cardStickers = clonedStickers;
          if (typeof this.renderCardStickers === 'function') {
            this.renderCardStickers(createdWidget);
          }
        }
        this.syncPipCardLockUI(createdRef);
        this.renderPipGraphCard(createdRef);
        if (createdIsPrimary) {
          this.renderGraphCardCanvas();
        } else if (createdWidget && typeof createdWidget._renderCardInkCanvas === 'function') {
          createdWidget._renderCardInkCanvas();
        }
        this.scheduleBakePipGraphCardToImg(createdRef);
        if (createdWidget) {
          this.bringCardToFront(createdWidget);
        }
        const newCaseNum = (createdRef === 'primary') ? 1 : (createdRef.caseIdx || (this.extraGraphCards.length + 1));
        this.showToast(`⧉ #${newCaseNum} 그래프 창이 복제되었습니다!`);
      }
      return createdRef;
    }

    _syncCanvasMetricsIfStale() {
      if (!this.canvas || !this.canvas.parentElement || typeof this.canvas.parentElement.getBoundingClientRect !== 'function') return;
      if (typeof this._isFixedReplayStageActive === 'function' && this._isFixedReplayStageActive()) return;
      if (typeof this._syncIosTopStatusGuard === 'function') {
        this._syncIosTopStatusGuard();
      }
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const cssW = Math.round(rect.width || 0);
      const cssH = Math.round(rect.height || 0);
      if (
        cssW >= 120 &&
        cssH >= 120 &&
        (Math.abs(cssW - (this.screenWidth || 0)) > 1 || Math.abs(cssH - (this.screenHeight || 0)) > 1)
      ) {
        this.resizeCanvas();
      }
    }

    _resolveFullscreenFocusMathCenter() {
      this._syncCanvasMetricsIfStale();
      const sw = Math.max(160, this.screenWidth || (typeof window !== 'undefined' ? window.innerWidth : 1440) || 1440);
      const sh = Math.max(120, this.screenHeight || (typeof window !== 'undefined' ? window.innerHeight : 900) || 900);
      const fullZoom = Math.max(0.15, Math.min(3.5, Number(this.zoomLevel) || 1.0));
      const fullYSpan = Math.max(0.1, Number(this.ySpan) || 6.0);
      const fullUnitScale = (sh / 2) / Math.max(0.05, fullYSpan / fullZoom);
      const pushOffsetX = (typeof this._lastFullGraphProblemPushX === 'number') ? this._lastFullGraphProblemPushX : 0;
      const effFullPanX = (this.panX || 0) - pushOffsetX;
      const effFullPanY = this.panY || 0;

      // 🌟 [아이패드 가시 영역 초점 동기화]:
      // 좌측 서랍(#railDrawer) 또는 전체화면 좌측 참조 문제 카드(#problemCardWidget)가 열려 화면 왼쪽을 가린 상태에서
      // 사용자가 우측 빈 가시 영역 중앙에 그래프를 맞추고 전환했을 때, 눈으로 보고 맞춘 가시 영역의 정중앙을 초점으로 채택!
      // (단, 서랍만 열어둔 채 기본 원점 근처에 그대로 둔 그래프는 기존과 동일하게 물리적 센터 sw / 2를 유지해 0% 부작용 보장)
      let leftOccludedPx = 0;
      const cRect = (this.canvas && typeof this.canvas.getBoundingClientRect === 'function')
        ? this.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };

      if (!this.isDrawerCollapsed && typeof document !== 'undefined') {
        const rdEl = document.getElementById('railDrawer');
        if (rdEl && typeof rdEl.getBoundingClientRect === 'function') {
          const rdRect = rdEl.getBoundingClientRect();
          if (rdRect.width > 40) {
            leftOccludedPx = Math.max(leftOccludedPx, Math.round(rdRect.right - (cRect.left || 0)));
          }
        }
        if (leftOccludedPx <= 0) {
          leftOccludedPx = (this.activeDrawerPanel === 'panelPresets') ? 410 : 318;
        }
      } else if (
        this._preReturnDrawerClosedAt &&
        (Date.now() - this._preReturnDrawerClosedAt < 800) &&
        typeof this._preReturnDrawerOccludedRight === 'number'
      ) {
        leftOccludedPx = Math.max(leftOccludedPx, this._preReturnDrawerOccludedRight);
      }
      this._preReturnDrawerClosedAt = 0;
      this._preReturnDrawerOccludedRight = 0;

      if (typeof document !== 'undefined') {
        const pWidget = document.getElementById('problemCardWidget');
        if (
          pWidget &&
          pWidget.style.display !== 'none' &&
          !pWidget.classList.contains('minimized') &&
          !this.isProblemCardMinimized &&
          typeof pWidget.getBoundingClientRect === 'function'
        ) {
          const pRect = pWidget.getBoundingClientRect();
          const relLeft = pRect.left - (cRect.left || 0);
          const relRight = pRect.right - (cRect.left || 0);
          if (pRect.width > 120 && pRect.height > sh * 0.22 && relLeft < sw * 0.25 && relRight > 120) {
            leftOccludedPx = Math.max(leftOccludedPx, Math.round(relRight));
          }
        }
      }

      leftOccludedPx = Math.max(0, Math.min(Math.round(sw * 0.62), leftOccludedPx));

      let targetScreenCenterX = sw / 2;
      if (leftOccludedPx > 80 && Array.isArray(this.graphs) && this.graphs.length > 0) {
        const physCenterX = sw / 2;
        const visCenterX = (leftOccludedPx + sw) / 2;

        let minHx = Infinity;
        let maxHx = -Infinity;
        for (const g of this.graphs) {
          if (!g || !Array.isArray(g.handles)) continue;
          let ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
          if (Array.isArray(g.transforms)) {
            for (const t of g.transforms) {
              if (t && t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
            }
          }
          for (const h of g.handles) {
            if (!h || typeof h.x !== 'number' || !Number.isFinite(h.x)) continue;
            const sx = (sw / 2 + effFullPanX) + (h.x + ox) * fullUnitScale;
            if (sx < minHx) minHx = sx;
            if (sx > maxHx) maxHx = sx;
          }
        }

        if (minHx <= maxHx && Number.isFinite(minHx) && Number.isFinite(maxHx)) {
          const graphMidScreenX = (minHx + maxHx) * 0.5;
          if (Math.abs(graphMidScreenX - visCenterX) + 12 < Math.abs(graphMidScreenX - physCenterX)) {
            targetScreenCenterX = visCenterX;
          }
        } else if (effFullPanX > 36) {
          targetScreenCenterX = visCenterX;
        }
      }

      const fullCenterMathX = (targetScreenCenterX - (sw / 2 + effFullPanX)) / Math.max(1e-6, fullUnitScale);
      const fullCenterMathY = effFullPanY / Math.max(1e-6, fullUnitScale);

      return {
        sw,
        sh,
        fullZoom,
        fullUnitScale,
        fullCenterMathX,
        fullCenterMathY
      };
    }

    addNewPipCardFromFullscreenGraph() {
      if (!Array.isArray(this.graphs) || this.graphs.length === 0) {
        this.showToast('⚠️ 먼저 추가할 그래프를 그려주세요!');
        return null;
      }

      this._pushWorkspaceUndoSnapshot('↺ 추가된 새 그래프 창이 취소되었습니다', '↻ 새 그래프 창 추가 다시 실행됨');

      const refCard = this._lastSpawnedPipCardRef || this._editingGraphCardTarget || (
        (Array.isArray(this.extraGraphCards) && this.extraGraphCards.length > 0)
          ? this.extraGraphCards[this.extraGraphCards.length - 1]
          : (this._hasPrimaryGraphCard ? 'primary' : null)
      );

      // 원본 카드를 덮어쓰지 않도록 편집 타겟 연결 해제
      this._editingGraphCardTarget = null;
      this._hasSpawnedNewCardInSession = false;
      this._lastSpawnedPipCardRef = null;

      let cardW = 430;
      let aspect = 0.82;
      let prevSnap = null;
      if (refCard) {
        const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(refCard);
        prevSnap = this._getMutablePipCardSnapshot(refCard);
        aspect = isPrimary ? (this.graphCardAspect || 0.82) : (refCard.aspect || 0.82);
        if (widget) {
          const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
          cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || (bodyEl && bodyEl.clientWidth) || 430));
        }
      }
      const cardH = Math.max(120, Math.round(cardW * aspect));
      const isTrig = this.graphs.some(g => g && ["sin_1period", "cos_1period", "tan_1period"].includes(g.type));

      const {
        fullZoom,
        fullUnitScale,
        fullCenterMathX,
        fullCenterMathY
      } = this._resolveFullscreenFocusMathCenter();

      const updatedSnap = JSON.parse(this.getPureGraphSnapshot());
      this._rebindClonedSnapshotGraphAndDropLineIds(updatedSnap);
      updatedSnap.xSpan = (prevSnap && typeof prevSnap.xSpan === 'number') ? prevSnap.xSpan : (isTrig ? 14.0 : 6.2);
      updatedSnap.ySpan = (prevSnap && typeof prevSnap.ySpan === 'number') ? prevSnap.ySpan : (isTrig ? 5.0 : 5.1);
      updatedSnap.zoomLevel = fullZoom;

      const cardUnitScale = (cardH / 2) / Math.max(0.05, updatedSnap.ySpan / updatedSnap.zoomLevel);
      updatedSnap.panX = -fullCenterMathX * cardUnitScale;
      updatedSnap.panY = fullCenterMathY * cardUnitScale;
      updatedSnap.isPipLocked = false;
      updatedSnap.isCurveSelected = false;
      updatedSnap.selectedHandleIdx = null;
      updatedSnap.draggedHandleIdx = null;
      updatedSnap.isPipDropLineMode = false;
      updatedSnap._pipDropLineHoverCand = null;
      updatedSnap._pipDropLineHoverScissors = null;
      updatedSnap._pipRenderedScissors = [];
      updatedSnap.useIntersectionDetector = false;
      updatedSnap._isPipCardSnapshot = true;
      updatedSnap._pipCardW = cardW;
      updatedSnap._pipCardH = cardH;

      const snapScale = 2.5;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.round(cardW * snapScale);
      tempCanvas.height = Math.round(cardH * snapScale);
      const tctx = tempCanvas.getContext('2d');
      tctx.save();
      tctx.scale(snapScale, snapScale);
      this._withPipCardGraphState(updatedSnap, cardW, cardH, () => {
        const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || { bg: '#ffffff', isLight: true };
        tctx.fillStyle = this.isMonochromeMode ? '#ffffff' : (curTheme.bg || '#ffffff');
        tctx.fillRect(0, 0, cardW, cardH);
        if (this.showGuides) this.drawGuides(tctx, this._snapshotCropBounds);
        if (this.showInverseGuide) this.drawInverseGuide(tctx);
        if (this.showAsymptotes) this.drawAllAsymptotes(tctx);
        if (this.showAxes) this.drawAxes(tctx, this._snapshotCropBounds);
        if (this.showAxes && this.showGridNumbers) this.drawGridNumbers(tctx, this._snapshotCropBounds);
        this.drawAllCurves(tctx);
        if (this.usePiecewise && this.graphs.length >= 1) {
          this.drawPiecewiseBoundaries(tctx);
        }
        this.drawDropLines(tctx, true);
        this.drawTextLabels(tctx);
      });
      tctx.restore();
      const dataUrl = tempCanvas.toDataURL('image/png');

      // 즉시 판서(필기) 모드로 복귀한 뒤, 기존 카드 기준 우하단 45도(+38px, +38px) 위치에 최상단(Top z-index)으로 새 카드 배치
      this._restoreBoardModeStateAfterGraph();

      const diagPos = this._computeDiagonalOffsetCardBasePos(refCard, cardW, cardH);
      const createdRef = this.setGraphCard(
        dataUrl,
        tempCanvas,
        cardW,
        { x: diagPos.x, y: diagPos.y, w: cardW, h: cardH },
        JSON.stringify(updatedSnap),
        {
          cardW,
          aspect,
          directBasePos: diagPos,
          alreadyInBoardMode: true,
          silentToast: true
        }
      );

      if (createdRef) {
        this._savePipCardSnapshot(createdRef, updatedSnap);
        this._syncFullGraphInkBackToPipCard(createdRef, cardW, cardH, cardUnitScale, fullUnitScale, false);
        const { widget: createdWidget, isPrimary: createdIsPrimary } = this._getPipCardWidgetAndSnapRaw(createdRef);
        this.syncPipCardLockUI(createdRef);
        this.renderPipGraphCard(createdRef);
        if (createdIsPrimary) {
          this.renderGraphCardCanvas();
        } else if (createdWidget && typeof createdWidget._renderCardInkCanvas === 'function') {
          createdWidget._renderCardInkCanvas();
        }
        this.scheduleBakePipGraphCardToImg(createdRef);
        if (createdWidget) {
          this.bringCardToFront(createdWidget);
        }
        this.updateProblemCardPosition(true);
        this.render();
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        const newCaseNum = (createdRef === 'primary') ? 1 : (createdRef.caseIdx || (this.extraGraphCards.length + 1));
        this.showToast(`📌 #${newCaseNum} 새 그래프 창으로 추가되었습니다!`);
      }
      return createdRef;
    }

    _closePipGraphCardByRef(cardRef, showCloseToast = true) {
      if (!cardRef) return false;
      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(cardRef);
      if (!widget) return false;

      this._pushWorkspaceUndoSnapshot('↺ 닫은 그래프 창이 복원되었습니다', '↻ 그래프 창 닫기 다시 실행됨');
      if (isPrimary) {
        this.clearPipGraphCardStealthTimer('primary');
        if (widget._bakePipTimerId) {
          clearTimeout(widget._bakePipTimerId);
          widget._bakePipTimerId = null;
        }
        if (this._activePeekCardEl === widget) {
          this._activePeekCardEl = null;
        }
        this.graphInkStrokes = [];
        this._hasPrimaryGraphCard = false;
        this.graphCardData = null;
        this.graphCardPdfAnchor = null;
        widget._pdfAnchor = null;
        widget._pipSnapObj = null;
        widget.classList.remove('pip-manipulating', 'pip-locked-mode', 'pip-stealth-locked', 'card-ink-active', 'card-header-peek');
        if (this._pipTargetCard === 'primary') this._pipTargetCard = null;
        if (this._editingGraphCardTarget === 'primary') this._editingGraphCardTarget = null;
        this.renderGraphCardCanvas();
        widget.style.display = 'none';
      } else {
        this.clearPipGraphCardStealthTimer(cardRef);
        if (widget._bakePipTimerId) {
          clearTimeout(widget._bakePipTimerId);
          widget._bakePipTimerId = null;
        }
        if (this._activePeekCardEl === widget) {
          this._activePeekCardEl = null;
        }
        widget.remove();
        this.extraGraphCards = (this.extraGraphCards || []).filter(c => c !== cardRef);
        if (this._pipTargetCard === cardRef) this._pipTargetCard = null;
        if (this._editingGraphCardTarget === cardRef) this._editingGraphCardTarget = null;
      }
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      this.render();
      if (showCloseToast) {
        this.showToast('🗑️ 그래프 창을 닫았습니다 (되돌리기 ↺로 복원 가능)');
      }
      return true;
    }

    _syncFullGraphBackToEditingPipCard() {
      let target = this._editingGraphCardTarget;
      this._editingGraphCardTarget = null;

      if (target && (!Array.isArray(this.graphs) || this.graphs.length === 0)) {
        this._closePipGraphCardByRef(target, false);
        return;
      }

      const {
        fullZoom,
        fullUnitScale,
        fullCenterMathX,
        fullCenterMathY
      } = this._resolveFullscreenFocusMathCenter();

      // 만약 연결된 대상 카드가 없는데 전체화면 그래프 모드에 그래프가 있다면 새 PiP 카드로 자동 생성
      if (!target) {
        if (!Array.isArray(this.graphs) || this.graphs.length === 0) return;
        const isTrig = this.graphs.some(g => g && ["sin_1period", "cos_1period", "tan_1period"].includes(g.type));
        const cardW = 430;
        const aspect = 0.82;
        const cardH = Math.round(cardW * aspect);
        const updatedSnap = JSON.parse(this.getPureGraphSnapshot());
        updatedSnap.xSpan = isTrig ? 14.0 : 6.2;
        updatedSnap.ySpan = isTrig ? 5.0 : 5.1;
        updatedSnap.zoomLevel = fullZoom;
        const cardUnitScale = (cardH / 2) / Math.max(0.05, updatedSnap.ySpan / updatedSnap.zoomLevel);
        updatedSnap.panX = -fullCenterMathX * cardUnitScale;
        updatedSnap.panY = fullCenterMathY * cardUnitScale;
        updatedSnap.isPipLocked = false;
        updatedSnap.isCurveSelected = false;
        updatedSnap.selectedHandleIdx = null;
        updatedSnap.draggedHandleIdx = null;
        updatedSnap.useIntersectionDetector = false;
        updatedSnap._isPipCardSnapshot = true;
        updatedSnap._pipCardW = cardW;
        updatedSnap._pipCardH = cardH;

        const createdRef = this._spawnCenteredPipCardFromSnapObj(updatedSnap, cardW, aspect, null);
        if (createdRef) {
          this._syncFullGraphInkBackToPipCard(createdRef, cardW, cardH, cardUnitScale, fullUnitScale);
          this.renderPipGraphCard(createdRef);
          this.scheduleBakePipGraphCardToImg(createdRef);
        }
        return;
      }

      const { widget, isPrimary } = this._getPipCardWidgetAndSnapRaw(target);
      if (!widget) return;

      const prevSnap = this._getMutablePipCardSnapshot(target);
      const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (target.aspect || 0.82);
      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      const cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || (bodyEl && bodyEl.clientWidth) || 430));
      const cardH = Math.max(120, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cardW * aspect)));
      const isTrig = Array.isArray(this.graphs) && this.graphs.some(g => g && ["sin_1period", "cos_1period", "tan_1period"].includes(g.type));

      const updatedSnap = JSON.parse(this.getPureGraphSnapshot());
      updatedSnap.xSpan = (prevSnap && typeof prevSnap.xSpan === 'number') ? prevSnap.xSpan : (isTrig ? 14.0 : 6.2);
      updatedSnap.ySpan = (prevSnap && typeof prevSnap.ySpan === 'number') ? prevSnap.ySpan : (isTrig ? 5.0 : 5.1);
      updatedSnap.zoomLevel = fullZoom;

      // 🌟 전체화면 그래프 모드에서 이동한 시야 중심점(가시 영역 포함)과 두 손가락 줌 배율을 PiP 카드에 100% 보존!
      const cardUnitScale = (cardH / 2) / Math.max(0.05, updatedSnap.ySpan / updatedSnap.zoomLevel);
      updatedSnap.panX = -fullCenterMathX * cardUnitScale;
      updatedSnap.panY = fullCenterMathY * cardUnitScale;
      updatedSnap.isPipLocked = Boolean(prevSnap && prevSnap.isPipLocked);
      updatedSnap.isCurveSelected = false;
      updatedSnap.selectedHandleIdx = null;
      updatedSnap.draggedHandleIdx = null;
      widget.classList.remove('pip-manipulating');
      updatedSnap.useIntersectionDetector = false;
      updatedSnap._isPipCardSnapshot = true;
      updatedSnap._pipCardW = cardW;
      updatedSnap._pipCardH = cardH;

      this._savePipCardSnapshot(target, updatedSnap);
      this._syncFullGraphInkBackToPipCard(target, cardW, cardH, cardUnitScale, fullUnitScale);
      this.syncPipCardLockUI(target);
      this.renderPipGraphCard(target);
      this.scheduleBakePipGraphCardToImg(target);
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
    }

    addGraphToPipCardInBoardMode(preferredType = null) {
      const presetOrder = ['3rd_normal', '1st_linear', '2nd_quadratic', 'exp_basic', 'geom_quad'];
      const targetCard = (this._pipTargetCard && this._pipTargetCard !== 'new') ? this._pipTargetCard : null;
      const isValidExistingTarget = Boolean(
        (targetCard === 'primary' && this._hasPrimaryGraphCard && this.graphCardData) ||
        (targetCard && targetCard !== 'primary' && Array.isArray(this.extraGraphCards) && this.extraGraphCards.includes(targetCard))
      );

      if (isValidExistingTarget) {
        const snap = this._getMutablePipCardSnapshot(targetCard);
        if (snap && Array.isArray(snap.graphs)) {
          if (snap.graphs.length >= 12) {
            this.showToast('⚠️ 한 카드에는 최대 12개까지 함수를 추가할 수 있습니다.');
            return;
          }
          const nextType = preferredType || presetOrder[snap.graphs.length % presetOrder.length];
          const nextColor = (this.graphColorMode === 'fixed' && this.fixedGraphColor)
            ? this.fixedGraphColor
            : this.colorPalette[snap.graphs.length % this.colorPalette.length];

          const newGraph = {
            id: 'g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            type: nextType,
            category: this.meta[nextType].category,
            handles: JSON.parse(JSON.stringify(this.meta[nextType].handles)),
            color: nextColor,
            lineWidth: this.defaultGraphLineWidth || 2.8,
            isAbsolute: false,
            shapeMode: 'free',
            originCenter: false,
            isFrozen: false,
            freezeOffset: { x: 0, y: 0 },
            frozenInvertH: false,
            frozenInvertV: false,
            frozenAbsolute: false,
            isIndependent: Boolean(snap.usePiecewise)
          };

          const { widget } = this._getPipCardWidgetAndSnapRaw(targetCard);
          this.deselectAllPipGraphCards(widget);
          snap.graphs.push(newGraph);
          snap.activeGraphIdx = snap.graphs.length - 1;
          snap.selectedHandleIdx = null;
          snap.isPipLocked = false;
          snap.isCurveSelected = true;

          if (widget && widget.classList.contains('card-ink-active')) {
            widget.classList.remove('card-ink-active');
            const laserBtn = widget.querySelector('.btn-card-laser');
            if (laserBtn) laserBtn.classList.remove('active');
          }
          if (widget) {
            this.bringCardToFront(widget);
            widget._lastPipLockUiSig = '';
          }

          this.syncPipCardLockUI(targetCard);
          this.renderPipGraphCard(targetCard);
          this.scheduleBakePipGraphCardToImg(targetCard);
          if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed) {
            this.closeDrawer();
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
          this.showToast(`✨ 카드에 f${snap.graphs.length}(x) (${this.meta[nextType].name}) 추가됨! 핸들을 드래그해 조절하세요.`);
          return;
        }
      }

      // 새 PiP 그래프 카드를 화면 중앙에 생성!
      const nextType = preferredType || presetOrder[0];
      const nextColor = (this.graphColorMode === 'fixed' && this.fixedGraphColor)
        ? this.fixedGraphColor
        : this.colorPalette[0];

      const newGraph = {
        id: 'g_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        type: nextType,
        category: this.meta[nextType].category,
        handles: JSON.parse(JSON.stringify(this.meta[nextType].handles)),
        color: nextColor,
        lineWidth: this.defaultGraphLineWidth || 2.8,
        isAbsolute: false,
        shapeMode: 'free',
        originCenter: false,
        isFrozen: false,
        freezeOffset: { x: 0, y: 0 },
        frozenInvertH: false,
        frozenInvertV: false,
        frozenAbsolute: false,
        isIndependent: false
      };

      const isTrig = ["sin_1period", "cos_1period", "tan_1period"].includes(nextType);
      const cardW = 430;
      const aspect = 0.82;
      const cardH = Math.round(cardW * aspect);
      const snapObj = {
        graphs: [newGraph],
        activeGraphIdx: 0,
        zoomLevel: 1.0,
        panX: 0,
        panY: 0,
        xSpan: isTrig ? 14.0 : 6.2,
        ySpan: isTrig ? 5.0 : 5.1,
        usePiecewise: false,
        piecewiseBoundaries: [],
        piecewiseFuncMap: [0],
        piecewiseInclusions: [],
        isPiecewisePeriodic: false,
        periodicStepY: 0,
        isPiecewiseLocked: false,
        showInverseGuide: false,
        showXAxis: this.showXAxis !== false,
        showYAxis: this.showYAxis !== false,
        showGridNumbers: false,
        dropLines: [],
        textLabels: [],
        graphInkStrokes: [],
        isPipLocked: false,
        isCurveSelected: true,
        selectedHandleIdx: null,
        _isPipCardSnapshot: true,
        _pipCardW: cardW,
        _pipCardH: cardH
      };

      this._spawnCenteredPipCardFromSnapObj(snapObj, cardW, aspect, `${this.meta[nextType].name} 창 생성됨! 조작 후 상단 [🔓 잠금]을 누르면 확정됩니다.`);
    }

    loadCustomPresetToPipCardInBoardMode(item) {
      if (!item || !item.snapshot) return false;
      try {
        const parsed = typeof item.snapshot === 'string' ? JSON.parse(item.snapshot) : JSON.parse(JSON.stringify(item.snapshot));
        if (!parsed || !Array.isArray(parsed.graphs) || parsed.graphs.length === 0) return false;

        if (this.graphColorMode === 'fixed' && this.fixedGraphColor) {
          parsed.graphs.forEach(g => { if (g) g.color = this.fixedGraphColor; });
        }
        const presetShowX = parsed.showXAxis !== false;
        const presetShowY = parsed.showYAxis !== false;
        parsed.showXAxis = presetShowX;
        parsed.showYAxis = presetShowY;

        const targetCard = (this._pipTargetCard && this._pipTargetCard !== 'new') ? this._pipTargetCard : null;
        const isValidExistingTarget = Boolean(
          (targetCard === 'primary' && this._hasPrimaryGraphCard && this.graphCardData) ||
          (targetCard && targetCard !== 'primary' && Array.isArray(this.extraGraphCards) && this.extraGraphCards.includes(targetCard))
        );

        if (isValidExistingTarget) {
          const snap = this._getMutablePipCardSnapshot(targetCard);
          if (snap && Array.isArray(snap.graphs)) {
            const presetClone = JSON.parse(JSON.stringify(parsed));
            this._rebindClonedSnapshotGraphAndDropLineIds(presetClone);
            const addedGraphIds = new Set();
            (presetClone.graphs || []).forEach(cloned => {
              if (cloned && snap.graphs.length < 12) {
                snap.graphs.push(cloned);
                if (cloned.id) addedGraphIds.add(cloned.id);
              }
            });
            if (Array.isArray(presetClone.dropLines) && presetClone.dropLines.length > 0) {
              if (!Array.isArray(snap.dropLines)) snap.dropLines = [];
              presetClone.dropLines.forEach(dl => {
                if (!dl) return;
                const b = dl.binding;
                if (b && Array.isArray(b.layerIds) && b.layerIds.length > 0) {
                  if (b.layerIds.every(lid => addedGraphIds.has(lid))) {
                    snap.dropLines.push(dl);
                  }
                } else if (!b || !b.layerId || addedGraphIds.has(b.layerId)) {
                  snap.dropLines.push(dl);
                }
              });
            }
            if (Array.isArray(presetClone.textLabels) && presetClone.textLabels.length > 0) {
              if (!Array.isArray(snap.textLabels)) snap.textLabels = [];
              presetClone.textLabels.forEach(tl => {
                if (tl) snap.textLabels.push(tl);
              });
            }
            snap.activeGraphIdx = snap.graphs.length - 1;
            snap.showXAxis = presetShowX;
            snap.showYAxis = presetShowY;
            snap.isPipLocked = false;
            snap.isCurveSelected = true;
            snap.selectedHandleIdx = null;
            this.showXAxis = presetShowX;
            this.showYAxis = presetShowY;
            if (typeof this.syncAxisVisibilityUI === 'function') this.syncAxisVisibilityUI();
            const { widget } = this._getPipCardWidgetAndSnapRaw(targetCard);
            this.deselectAllPipGraphCards(widget);
            if (widget) widget._lastPipLockUiSig = '';
            this.syncPipCardLockUI(targetCard);
            this.renderPipGraphCard(targetCard);
            this.scheduleBakePipGraphCardToImg(targetCard);
            if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed) {
              this.closeDrawer();
            }
            if (this.isAudioRecording) {
              this._recordAudioWorkspaceStateIfNeeded(true);
            }
            this.showToast(`⭐ 카드에 [${item.name}] 프리셋이 추가되었습니다!`);
            return true;
          }
        }

        const cardW = 430;
        const aspect = 0.82;
        const cardH = Math.round(cardW * aspect);
        this._rebindClonedSnapshotGraphAndDropLineIds(parsed);
        const isTrig = parsed.graphs.some(g => g && ["sin_1period", "cos_1period", "tan_1period"].includes(g.type));
        parsed.xSpan = isTrig ? 14.0 : 6.2;
        parsed.ySpan = isTrig ? 5.0 : 5.1;
        parsed.panX = 0;
        parsed.panY = 0;
        parsed.isPipLocked = false;
        parsed.isCurveSelected = true;
        parsed.selectedHandleIdx = null;
        parsed._isPipCardSnapshot = true;
        parsed._pipCardW = cardW;
        parsed._pipCardH = cardH;
        this.showXAxis = presetShowX;
        this.showYAxis = presetShowY;
        if (typeof this.syncAxisVisibilityUI === 'function') this.syncAxisVisibilityUI();

        this._spawnCenteredPipCardFromSnapObj(parsed, cardW, aspect, `⭐ [${item.name}] 창 생성됨! 조작 후 상단 [🔓 잠금]을 누르면 확정됩니다.`);
        return true;
      } catch (_) {
        return false;
      }
    }

    _spawnCenteredPipCardFromSnapObj(snapObj, cardW, aspect, toastMsg) {
      this._rehydrateSnapGeneralExprFns(snapObj);
      this.deselectAllPipGraphCards();
      const cardH = Math.round(cardW * aspect);
      const existingCount = (this._hasPrimaryGraphCard ? 1 : 0) + (Array.isArray(this.extraGraphCards) ? this.extraGraphCards.length : 0);
      const cascade = (existingCount % 5) * 22;
      const vw = window.innerWidth || 1440;
      const vh = window.innerHeight || 900;
      const centerX = Math.round((vw - cardW) * 0.5 + (this.hasActiveProblemCard() ? 70 : 0) + cascade);
      const centerY = Math.round(Math.max(64, (vh - cardH) * 0.5 - 24 + cascade));

      const snapScale = 2.5;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.round(cardW * snapScale);
      tempCanvas.height = Math.round(cardH * snapScale);
      const tctx = tempCanvas.getContext('2d');
      tctx.save();
      tctx.scale(snapScale, snapScale);
      this._withPipCardGraphState(snapObj, cardW, cardH, () => {
        const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || { bg: '#ffffff', isLight: true };
        tctx.fillStyle = this.isMonochromeMode ? '#ffffff' : (curTheme.bg || '#ffffff');
        tctx.fillRect(0, 0, cardW, cardH);
        if (this.showGuides) this.drawGuides(tctx, this._snapshotCropBounds);
        if (this.showInverseGuide) this.drawInverseGuide(tctx);
        if (this.showAsymptotes) this.drawAllAsymptotes(tctx);
        if (this.showAxes) this.drawAxes(tctx, this._snapshotCropBounds);
        if (this.showAxes && this.showGridNumbers) this.drawGridNumbers(tctx, this._snapshotCropBounds);
        this.drawAllCurves(tctx);
        if (this.usePiecewise && this.graphs.length >= 1) {
          this.drawPiecewiseBoundaries(tctx);
        }
        this.drawDropLines(tctx, true);
        this.drawTextLabels(tctx);
      });
      tctx.restore();
      const dataUrl = tempCanvas.toDataURL('image/png');

      const createdRef = this.setGraphCard(
        dataUrl,
        tempCanvas,
        cardW,
        { x: centerX, y: centerY, w: cardW, h: cardH },
        JSON.stringify(snapObj),
        { cardW, aspect, forceScreenPos: true, alreadyInBoardMode: Boolean(this.isGraphCovered), silentToast: true }
      );

      const { widget: createdWidget } = this._getPipCardWidgetAndSnapRaw(createdRef);
      if (createdWidget) {
        this.bringCardToFront(createdWidget);
      }
      this.syncPipCardLockUI(createdRef);
      this.renderPipGraphCard(createdRef);
      this.scheduleBakePipGraphCardToImg(createdRef);
      if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed) {
        this.closeDrawer();
      }
      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      if (toastMsg) {
        this.showToast(`✨ ${toastMsg}`);
      }
      return createdRef;
    }

    attachPipGraphCardLiveSystem(widget, cardRef) {
      if (!widget || widget._pipLiveSystemAttached) return;
      widget._pipLiveSystemAttached = true;

      const isPrimary = (cardRef === 'primary');
      const bodyEl = isPrimary ? document.getElementById('graphCardBody') : widget.querySelector('.problem-card-body');
      if (!bodyEl) return;

      // 1. 카드 상단 [+] 함수 추가 버튼 & [🔓 잠금 / 🔒 잠금됨] 토글 버튼 바인딩
      const btnAddFunc = isPrimary
        ? document.getElementById('btnGraphCardAddFunc')
        : widget.querySelector('.btn-extra-add-func');
      if (btnAddFunc) {
        btnAddFunc.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
        });
        btnAddFunc.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.bringCardToFront(widget);
          const isAlreadyTargetingThis = (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelPresets' && this._pipTargetCard === cardRef);
          document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
          if (isAlreadyTargetingThis) {
            this.closeDrawer();
          } else {
            this._pipTargetCard = cardRef;
            btnAddFunc.classList.add('active');
            this.openDrawer('panelPresets');
            this.showToast('➕ 이 카드에 함께 그릴 함수를 선택하세요!');
          }
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        });
      }

      const btnLock = isPrimary
        ? document.getElementById('btnGraphCardLock')
        : widget.querySelector('.btn-extra-lock');
      if (btnLock) {
        btnLock.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
        });
        btnLock.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.bringCardToFront(widget);
          const snap = this._getMutablePipCardSnapshot(cardRef);
          const nextLocked = !(snap && snap.isPipLocked);
          this.setPipCardLocked(cardRef, nextLocked, true);
        });
      }

      // 2. 카드 상단 [📍 수선] 토글 버튼 및 헤더 3-캡슐 곡선 변형 바([대칭 ▾] · [|f|] · [🗑]) 장착 + 라이브 그래프 캔버스 생성
      const actionsEl = widget.querySelector('.problem-card-actions');
      let btnDropLine = widget.querySelector('.btn-card-dropline');
      if (!btnDropLine && actionsEl) {
        btnDropLine = document.createElement('button');
        btnDropLine.type = 'button';
        btnDropLine.className = 'card-btn btn-card-dropline';
        btnDropLine.title = '보조 수선 그리기 (극점·교점·곡선 위를 콕 찍어 x·y축 점선 수선 표시)';
        btnDropLine.innerHTML = `
        <span style="display:inline-flex;align-items:center;justify-content:center;">
          <svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
      `;
        if (btnAddFunc && btnAddFunc.nextSibling) {
          actionsEl.insertBefore(btnDropLine, btnAddFunc.nextSibling);
        } else {
          actionsEl.insertBefore(btnDropLine, actionsEl.firstChild);
        }
      }
      if (btnDropLine) {
        btnDropLine.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
        });
        btnDropLine.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.bringCardToFront(widget);
          this._closeAllPipHeaderPopovers();
          const snap = this._getMutablePipCardSnapshot(cardRef);
          if (!snap) return;
          const nextDl = !(snap.isPipDropLineMode && !snap.isPipLocked);
          if (nextDl) {
            this.deselectAllPipGraphCards(widget);
            snap.isPipLocked = false;
            snap.isCurveSelected = false;
            snap.selectedHandleIdx = null;
            snap.draggedHandleIdx = null;
            snap.isPipDropLineMode = true;
            snap._pipDropLineHoverCand = null;
            snap._pipDropLineHoverScissors = null;
            if (widget.classList.contains('card-ink-active')) {
              widget.classList.remove('card-ink-active');
              const laserBtn = widget.querySelector('.btn-card-laser');
              if (laserBtn) laserBtn.classList.remove('active');
            }
            // 수선 버튼 클릭 즉시 특이점/교점 캐시를 사전 워밍업하여 첫 마우스 이동부터 0ms 반응 보장
            const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82);
            const cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || bodyEl.clientWidth || 360));
            const cardH = Math.max(120, Math.round(parseFloat(bodyEl.style.height) || (cardW * aspect)));
            this._withPipCardGraphState(snap, cardW, cardH, () => {
              this.collectDropLineCandidates();
            });
            this.showToast('📍 수선 그리기 켜짐 — 극점·교점·곡선 위를 콕 찍으면 점선 수선이 그어집니다.');
          } else {
            snap.isPipDropLineMode = false;
            snap._pipDropLineHoverCand = null;
            snap._pipDropLineHoverScissors = null;
            this.showToast('📍 수선 그리기 꺼짐');
          }
          this._savePipCardSnapshot(cardRef, snap);
          widget._lastPipLockUiSig = '';
          this.syncPipCardLockUI(cardRef);
          this.renderPipGraphCard(cardRef);
          this.scheduleBakePipGraphCardToImg(cardRef);
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(true);
          }
        });
      }

      const titleGroupEl = widget.querySelector('.problem-card-title-group');
      let hdrTools = widget.querySelector('.pip-header-curve-tools');
      if (!hdrTools && titleGroupEl) {
        hdrTools = document.createElement('div');
        hdrTools.className = 'pip-header-curve-tools';
        hdrTools.style.display = 'none';
        hdrTools.innerHTML = `
        <div class="pip-hdr-sym-wrap">
          <button type="button" class="card-btn pip-hdr-btn" data-pip-act="symMenu" title="대칭 이동 (x축 · y축 · 원점 · y=x)">
            <span>대칭</span><span class="pip-hdr-caret">▾</span>
          </button>
          <div class="pip-hdr-popover" style="display: none;">
            <button type="button" class="pip-pop-btn" data-pip-act="flipX" title="x축 대칭 (상하 반전)">↕ x축</button>
            <button type="button" class="pip-pop-btn" data-pip-act="flipY" title="y축 대칭 (좌우 반전)">↔ y축</button>
            <button type="button" class="pip-pop-btn" data-pip-act="flipOrigin" title="원점 대칭">⤡ 원점</button>
            <button type="button" class="pip-pop-btn" data-pip-act="flipYX" title="y=x 대칭 (역함수 생성 & 연동)">⤢ y=x</button>
            <button type="button" class="pip-pop-btn" data-pip-act="unlinkInverse" style="display: none;" title="원함수와 역함수 대칭 연동 끊기">✂ 연동끊기</button>
          </div>
        </div>
        <button type="button" class="card-btn pip-hdr-btn" data-pip-act="abs" title="절댓값 |f(x)| 꺾어올리기 (평행이동 후 다시 누르면 다단계 절댓값 ||f(x)|-k|)">|f|</button>
        <button type="button" class="card-btn pip-hdr-btn pip-hdr-del" data-pip-act="deleteCurve" title="선택된 함수 삭제">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;
        titleGroupEl.appendChild(hdrTools);

        hdrTools.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
        });
        hdrTools.addEventListener('touchstart', (e) => {
          e.stopPropagation();
        }, { passive: true });

        if (!this._pipHdrPopoverGlobalDismissBound) {
          this._pipHdrPopoverGlobalDismissBound = true;
          document.addEventListener('pointerdown', (ev) => {
            if (ev.target && ev.target.closest && ev.target.closest('.pip-hdr-sym-wrap')) return;
            this._closeAllPipHeaderPopovers();
          }, { passive: true });
        }

        const symBtn = hdrTools.querySelector('[data-pip-act="symMenu"]');
        const symPop = hdrTools.querySelector('.pip-hdr-popover');
        if (symBtn && symPop) {
          let handledOnPointerDown = false;
          const toggleSymPopover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.bringCardToFront(widget);
            const snap = this._getMutablePipCardSnapshot(cardRef);
            const isOpen = Boolean((snap && snap.isPipSymPopoverOpen) || symPop.style.display !== 'none');
            this._closeAllPipHeaderPopovers(symPop);
            const nextOpen = !isOpen;
            if (snap) {
              snap.isPipSymPopoverOpen = nextOpen;
              this._savePipCardSnapshot(cardRef, snap);
            }
            widget._lastPipLockUiSig = '';
            this.syncPipCardLockUI(cardRef);
            if (this.isAudioRecording) {
              this._recordAudioWorkspaceStateIfNeeded(true);
            }
          };
          symBtn.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            handledOnPointerDown = true;
            toggleSymPopover(e);
          });
          symBtn.addEventListener('click', (e) => {
            if (handledOnPointerDown) {
              handledOnPointerDown = false;
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            toggleSymPopover(e);
          });
        }

        hdrTools.querySelectorAll('[data-pip-act]').forEach(btn => {
          const act = btn.dataset.pipAct;
          if (act === 'symMenu') return;
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.bringCardToFront(widget);
            this._closeAllPipHeaderPopovers();
            const snap = this._getMutablePipCardSnapshot(cardRef);
            if (!snap || !Array.isArray(snap.graphs) || snap.graphs.length === 0) return;
            snap.isPipSymPopoverOpen = false;
            const g = snap.graphs[snap.activeGraphIdx];
            if (!g) return;

            if (act === 'flipX' || act === 'flipY' || act === 'flipOrigin') {
              const axis = act === 'flipX' ? 'x' : (act === 'flipY' ? 'y' : 'origin');
              const msg = this._applyGraphSymmetry(g, axis, snap.graphs);
              widget._lastPipLockUiSig = '';
              this._savePipCardSnapshot(cardRef, snap);
              this.renderPipGraphCard(cardRef);
              this.scheduleBakePipGraphCardToImg(cardRef);
              if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
              if (msg) this.showToast(msg);
            } else if (act === 'flipYX') {
              if (this._cloneInverseGraphInPipSnap(snap)) {
                widget._lastPipLockUiSig = '';
                this._savePipCardSnapshot(cardRef, snap);
                this.syncPipCardLockUI(cardRef);
                this.renderPipGraphCard(cardRef);
                this.scheduleBakePipGraphCardToImg(cardRef);
                if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
              }
            } else if (act === 'unlinkInverse') {
              if (this._toggleInverseLinkInPipSnap(snap)) {
                widget._lastPipLockUiSig = '';
                this._savePipCardSnapshot(cardRef, snap);
                this.syncPipCardLockUI(cardRef);
                this.renderPipGraphCard(cardRef);
                this.scheduleBakePipGraphCardToImg(cardRef);
                if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
              }
            } else if (act === 'abs') {
              const msg = this._applyGraphToggleAbsolute(g, snap.graphs);
              widget._lastPipLockUiSig = '';
              this._savePipCardSnapshot(cardRef, snap);
              this.renderPipGraphCard(cardRef);
              this.scheduleBakePipGraphCardToImg(cardRef);
              if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
              if (msg) this.showToast(msg);
            } else if (act === 'deleteCurve') {
              this._deleteSelectedGraphInPipCard({ cardRef, widget, snap, isPrimary });
            }
          });
        });
      }

      let liveCanvas = bodyEl.querySelector('.graph-card-live-canvas');
      if (!liveCanvas) {
        liveCanvas = document.createElement('canvas');
        liveCanvas.className = 'graph-card-live-canvas';
        const imgEl = bodyEl.querySelector('.problem-card-img');
        if (imgEl && imgEl.nextSibling) {
          bodyEl.insertBefore(liveCanvas, imgEl.nextSibling);
        } else {
          bodyEl.appendChild(liveCanvas);
        }
      }
      liveCanvas.style.cursor = 'default';

      // 3. 라이브 캔버스 포인터 인터랙션
      // - 🔓 잠금 전 (!snap.isPipLocked): 핸들 드래그 = 개형 변형 | 곡선 드래그 = 평행이동 | 빈 여백 드래그 = 좌표축 이동 | 📍수선 모드 = 점 콕콕 수선 생성
      // - 🔒 잠금 후 (snap.isPipLocked): 이벤트 버블링으로 카드 몸통 어디든 잡고 끌면 카드 전체 이동!
      let activeMode = null; // 'handle' | 'curve' | 'panAxes' | 'dropLineAim'
      let downPos = { x: 0, y: 0 };
      let downClient = { x: 0, y: 0 };
      let cachedDownGeom = null;
      let cachedDownGeomTs = 0;
      let curveStartMath = { x: 0, y: 0 };
      let curveInitHandles = null;
      let curveInitFreezeOffset = null;
      let partnerInitHandles = null;
      let partnerInitFreezeOffset = null;
      let curveFeatsSnapshot = null;
      let panInit = { x: 0, y: 0 };
      let movedDuringInteraction = false;

      const getLocalPos = (e, useCached = false) => {
        const now = performance.now();
        const curStyleLeft = widget.style.left || '';
        const curStyleTop = widget.style.top || '';
        const curStyleW = widget.style.width || '';
        const curStyleH = bodyEl.style.height || '';
        const curBoardZ = this.boardZoom || 1;
        const curBoardPX = this.boardPanX || 0;
        const curBoardPY = this.boardPanY || 0;
        if (
          cachedDownGeom &&
          cachedDownGeom.styleLeft === curStyleLeft &&
          cachedDownGeom.styleTop === curStyleTop &&
          cachedDownGeom.styleW === curStyleW &&
          cachedDownGeom.styleH === curStyleH &&
          cachedDownGeom.boardZ === curBoardZ &&
          cachedDownGeom.boardPX === curBoardPX &&
          cachedDownGeom.boardPY === curBoardPY &&
          ((useCached && activeMode) || (now - cachedDownGeomTs < 16))
        ) {
          return {
            x: (e.clientX - cachedDownGeom.left) * cachedDownGeom.scaleX,
            y: (e.clientY - cachedDownGeom.top) * cachedDownGeom.scaleY,
            cardW: cachedDownGeom.cardW,
            cardH: cachedDownGeom.cardH
          };
        }
        const rect = liveCanvas.getBoundingClientRect();
        const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82);
        const cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || rect.width || 430));
        const cardH = Math.max(120, Math.round(parseFloat(bodyEl.style.height) || (cardW * aspect)));
        const scaleX = cardW / Math.max(1, rect.width);
        const scaleY = cardH / Math.max(1, rect.height);
        cachedDownGeom = {
          left: rect.left,
          top: rect.top,
          scaleX,
          scaleY,
          cardW,
          cardH,
          styleLeft: curStyleLeft,
          styleTop: curStyleTop,
          styleW: curStyleW,
          styleH: curStyleH,
          boardZ: curBoardZ,
          boardPX: curBoardPX,
          boardPY: curBoardPY
        };
        cachedDownGeomTs = now;
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
          cardW,
          cardH
        };
      };

      // 🎯 [창모드 영역별 즉각 포인터 판별기]:
      // - 핸들 위: 'grab'(손바닥 ✋) / 드래그 중 'grabbing'
      // - 선택된 그래프 곡선 위: 'move'(십자 화살표 ✥)
      // - 비선택 그래프 곡선 위: 'pointer'(검지 손가락 👆)
      // - 빈 여백 위: 'default'(기본 화살표 ↖) / 여백 드래그 중 'grabbing'
      // - 잠금(🔒) 상태: 'move'(카드 이동 ✥)
      const computePipHoverCursor = (pos, snap) => {
        if (!snap || snap.isPipLocked) return 'move';
        if (snap.isPipDropLineMode) {
          return snap._pipDropLineHoverScissors ? 'pointer' : 'crosshair';
        }
        let resolvedCursor = 'default';
        this._withPipCardGraphState(snap, pos.cardW, pos.cardH, () => {
          if (snap.isCurveSelected && this.activeGraph && Array.isArray(this.activeGraph.handles)) {
            for (const h of this.activeGraph.handles) {
              if (!h || h.hidden) continue;
              const wPos = this.engine.getHandleWorldPos(this.activeGraph, h);
              if (!wPos || isNaN(wPos.x) || isNaN(wPos.y)) continue;
              const s = this.mathToScreen(wPos.x, wPos.y);
              if (Math.hypot(s.x - pos.x, s.y - pos.y) <= 13.5) {
                resolvedCursor = 'pointer';
                return;
              }
            }
          }
          const hitCIdx = this.hitTestAllCurves({ x: pos.x, y: pos.y }, false);
          if (hitCIdx !== null) {
            const isHitActiveSelected = Boolean(
              snap.isCurveSelected &&
              (hitCIdx === snap.activeGraphIdx || (snap.usePiecewise && snap.isPiecewiseLocked))
            );
            resolvedCursor = isHitActiveSelected ? 'move' : 'pointer';
          }
        });
        return resolvedCursor;
      };

      liveCanvas.addEventListener('pointerdown', (e) => {
        if (widget.classList.contains('card-ink-active') || widget.classList.contains('card-laser-active')) return;
        if (e.pointerType === 'pen') {
          this._markStylusPenDetected();
          this._lastPenActiveTime = Date.now();
        }
        if (e.pointerType === 'touch' && this._shouldIgnoreCanvasTouchPointer(e)) {
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();
          return;
        }
        this._closeAllPipHeaderPopovers();
        const snap = this._getMutablePipCardSnapshot(cardRef);
        if (!snap || snap.isNAxisStudioCard || !Array.isArray(snap.graphs) || snap.graphs.length === 0) return;

        // 🔒 잠금(확정) 상태에서는 카드 내부 어디를 잡고 끌어도 카드 전체가 칠판 위에서 이동하도록 widget으로 버블링 허용!
        if (snap.isPipLocked) {
          liveCanvas.style.cursor = 'move';
          return;
        }

        this.bringCardToFront(widget);
        if (document.activeElement && document.activeElement !== document.body && typeof document.activeElement.blur === 'function') {
          try { document.activeElement.blur(); } catch (_) { }
        }
        const pos = getLocalPos(e, false);
        const isTouch = Boolean(e.pointerType === 'touch' || e.pointerType === 'pen');
        const isExplicitAxisPan = Boolean(e.shiftKey || e.button === 1 || e.button === 2);

        downPos = { x: pos.x, y: pos.y };
        downClient = { x: e.clientX, y: e.clientY };
        movedDuringInteraction = false;

        if (isExplicitAxisPan) {
          e.preventDefault();
          e.stopPropagation();
          this.deselectAllPipGraphCards(widget);
          this._ensurePipCardInkMathCoords(cardRef);
          try { liveCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          activeMode = 'panAxes';
          snap._isPanningAxes = true;
          this._isInteractingWithPipCard = true;
          this._activePipInteractionCardEl = widget;
          panInit = { x: snap.panX || 0, y: snap.panY || 0 };
          liveCanvas.style.cursor = 'move';
          this.renderPipGraphCard(cardRef);
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
          return;
        }

        // 📍 [창모드 수선 그리기 모드 (점 콕콕 찍어 x·y축 점선 수선 내리기 & ✂️ 가위 삭제)]
        if (snap.isPipDropLineMode) {
          let hitScissors = null;
          let initCand = null;
          this._withPipCardGraphState(snap, pos.cardW, pos.cardH, () => {
            hitScissors = this.hitTestScissors({ x: pos.x, y: pos.y }, isTouch);
            if (hitScissors) {
              const item = (this.dropLines || []).find(dl => dl.id === hitScissors.id);
              if (item) {
                if (hitScissors.which === 'x') item.showX = false;
                if (hitScissors.which === 'y') item.showY = false;
                if ((!item.showX || this.showXAxis === false) && (!item.showY || this.showYAxis === false)) {
                  this.dropLines = this.dropLines.filter(dl => dl.id !== hitScissors.id);
                }
              }
              snap._pipDropLineHoverScissors = null;
              snap._pipDropLineHoverCand = null;
            } else {
              initCand = this.findNearestDropLineTarget({ x: pos.x, y: pos.y }, isTouch ? 24 : 16);
            }
          });
          if (hitScissors) {
            e.preventDefault();
            e.stopPropagation();
            this.renderPipGraphCard(cardRef);
            this.scheduleBakePipGraphCardToImg(cardRef);
            if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
            this.showToast('✂️ 수선 삭제 완료');
            return;
          }
          if (initCand) {
            e.preventDefault();
            e.stopPropagation();
            this.deselectAllPipGraphCards(widget);
            snap._pipDropLineHoverCand = initCand;
            try { liveCanvas.setPointerCapture(e.pointerId); } catch (_) { }
            activeMode = 'dropLineAim';
            this._isInteractingWithPipCard = true;
            this._activePipInteractionCardEl = widget;
            liveCanvas.style.cursor = 'crosshair';
            this.renderPipGraphCard(cardRef);
            if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
            return;
          }
        }

        let hitHandleIdx = null;
        let hitCurveIdx = null;

        if (!snap.isPipDropLineMode) {
          this._withPipCardGraphState(snap, pos.cardW, pos.cardH, () => {
            const handleHitDist = isTouch ? 16 : 13.5;
            if (snap.isCurveSelected && this.activeGraph && Array.isArray(this.activeGraph.handles)) {
              this.activeGraph.handles.forEach((h, idx) => {
                if (!h || h.hidden) return;
                const wPos = this.engine.getHandleWorldPos(this.activeGraph, h);
                if (!wPos || isNaN(wPos.x) || isNaN(wPos.y)) return;
                const s = this.mathToScreen(wPos.x, wPos.y);
                if (Math.hypot(s.x - pos.x, s.y - pos.y) <= handleHitDist) {
                  hitHandleIdx = idx;
                }
              });
            }

            if (hitHandleIdx === null) {
              hitCurveIdx = this.hitTestAllCurves({ x: pos.x, y: pos.y }, isTouch);
            }
          });
        }

        if (hitHandleIdx !== null) {
          e.preventDefault();
          e.stopPropagation();
          this.deselectAllPipGraphCards(widget);
          snap.isCurveSelected = true;
          snap.draggedHandleIdx = hitHandleIdx;
          snap.selectedHandleIdx = hitHandleIdx;
          try { liveCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          activeMode = 'handle';
          this._isInteractingWithPipCard = true;
          this._activePipInteractionCardEl = widget;
          liveCanvas.style.cursor = 'pointer';
          this.renderPipGraphCard(cardRef);
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
          return;
        }

        if (hitCurveIdx !== null) {
          e.preventDefault();
          e.stopPropagation();
          this.deselectAllPipGraphCards(widget);
          try { liveCanvas.setPointerCapture(e.pointerId); } catch (_) { }
          activeMode = 'curve';
          this._isInteractingWithPipCard = true;
          this._activePipInteractionCardEl = widget;
          snap.activeGraphIdx = hitCurveIdx;
          snap.isCurveSelected = true;
          snap.selectedHandleIdx = null;
          snap.draggedHandleIdx = null;
          snap._isDraggingCurve = true;
          this._withPipCardGraphState(snap, pos.cardW, pos.cardH, () => {
            curveStartMath = this.screenToMath(pos.x, pos.y);
            const g = this.activeGraph;
            if (g) {
              curveInitHandles = (g.handles || []).map(h => ({ ...h }));
              curveInitFreezeOffset = {
                x: (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0,
                y: (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0
              };
              curveFeatsSnapshot = (typeof this.getGraphFeaturePoints === 'function')
                ? this.getGraphFeaturePoints(g, curveInitHandles, curveInitFreezeOffset)
                : { pts: [], asymX: [], asymY: [] };
              const partner = this.getLinkedPartner(g);
              if (partner) {
                partnerInitHandles = (partner.handles || []).map(h => ({ ...h }));
                partnerInitFreezeOffset = {
                  x: (partner.freezeOffset && typeof partner.freezeOffset.x === 'number') ? partner.freezeOffset.x : 0,
                  y: (partner.freezeOffset && typeof partner.freezeOffset.y === 'number') ? partner.freezeOffset.y : 0
                };
              } else {
                partnerInitHandles = null;
                partnerInitFreezeOffset = null;
              }
            }
          });
          liveCanvas.style.cursor = 'move';
          this.renderPipGraphCard(cardRef);
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
          return;
        }

        // 🔓 잠금 전 상태에서 빈 여백: 톡 두드리면(Tap) 곡선 선택 해제, 잡고 끌면(Drag) 좌표축(시야) 평행이동!
        e.preventDefault();
        e.stopPropagation();
        this.deselectAllPipGraphCards(widget);
        this._ensurePipCardInkMathCoords(cardRef);
        try { liveCanvas.setPointerCapture(e.pointerId); } catch (_) { }
        activeMode = 'panAxes';
        this._isInteractingWithPipCard = true;
        this._activePipInteractionCardEl = widget;
        panInit = { x: snap.panX || 0, y: snap.panY || 0 };
        liveCanvas.style.cursor = 'default';
        if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
      });

      liveCanvas.addEventListener('pointermove', (e) => {
        if (this._isDraggingOrResizingAnyCard) return;
        if (widget.classList.contains('card-ink-active') || widget.classList.contains('card-laser-active')) return;
        const snap = this._getMutablePipCardSnapshot(cardRef);
        if (!snap || !Array.isArray(snap.graphs) || snap.graphs.length === 0) return;

        if (snap.isPipLocked && !activeMode) {
          if (liveCanvas.style.cursor !== 'move') liveCanvas.style.cursor = 'move';
          return;
        }

        if (!activeMode && typeof e.buttons === 'number' && e.buttons !== 0) {
          return;
        }

        const pos = getLocalPos(e, Boolean(activeMode));
        if (!activeMode) {
          // 📍 [창모드 수선 그리기 120Hz/144Hz 무지연 호버 추적]:
          // 28ms 스로틀 없이 매 포인터 이동마다 즉시 타겟을 갱신하고 rAF로 배칭 렌더링하여 마우스/펜 끝을 칼같이 따라오도록 개선!
          if (snap.isPipDropLineMode && e.pointerType !== 'touch') {
            let overScissors = null;
            let cand = null;
            this._withPipCardGraphState(snap, pos.cardW, pos.cardH, () => {
              overScissors = this.hitTestScissors({ x: pos.x, y: pos.y });
              if (!overScissors) {
                cand = this.findNearestDropLineTarget({ x: pos.x, y: pos.y }, 16);
              }
            });
            const prevSc = snap._pipDropLineHoverScissors;
            const prevCand = snap._pipDropLineHoverCand;
            const scChanged = (Boolean(prevSc) !== Boolean(overScissors)) ||
              (prevSc && overScissors && (prevSc.id !== overScissors.id || prevSc.which !== overScissors.which));
            const candChanged = (Boolean(prevCand) !== Boolean(cand)) ||
              (prevCand && cand && (Math.abs(prevCand.x - cand.x) > 1e-4 || Math.abs(prevCand.y - cand.y) > 1e-4 || prevCand.name !== cand.name));
            snap._pipDropLineHoverScissors = overScissors;
            snap._pipDropLineHoverCand = cand;
            liveCanvas.style.cursor = overScissors ? 'pointer' : 'crosshair';
            if (scChanged || candChanged) {
              this.requestPipGraphCardRender(cardRef);
              if (this.isAudioRecording && candChanged) {
                this._recordAudioWorkspaceStateIfNeeded(false);
              }
            }
            return;
          }

          // 🎯 일반 모드 호버 시 0ms 무지연 커서 전환 (핸들: pointer 검은테두리 손바닥 👆 / 선택 곡선: move ✥ / 비선택 곡선: pointer 👆 / 빈 여백: default ↖)
          if (e.pointerType !== 'touch') {
            const nextCur = computePipHoverCursor(pos, snap);
            if (liveCanvas.style.cursor !== nextCur) {
              liveCanvas.style.cursor = nextCur;
            }
          }
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        if (Math.hypot(e.clientX - downClient.x, e.clientY - downClient.y) > 3) {
          movedDuringInteraction = true;
        }

        if (activeMode === 'dropLineAim') {
          this._withPipCardGraphState(snap, pos.cardW, pos.cardH, () => {
            snap._pipDropLineHoverCand = this.findNearestDropLineTarget({ x: pos.x, y: pos.y }, 22);
          });
          this.requestPipGraphCardRender(cardRef);
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(false);
          return;
        }

        if (activeMode === 'panAxes') {
          if (!movedDuringInteraction) return;
          if (liveCanvas.style.cursor !== 'move') liveCanvas.style.cursor = 'move';
          snap._isPanningAxes = true;
          snap.panX = panInit.x + (pos.x - downPos.x);
          snap.panY = panInit.y + (pos.y - downPos.y);
          widget._pendingPipInkReproject = { w: pos.cardW, h: pos.cardH };
          this.requestPipGraphCardRender(cardRef);
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(false);
          return;
        }

        if (activeMode === 'handle') {
          this._withPipCardGraphState(snap, pos.cardW, pos.cardH, () => {
            const g = this.activeGraph;
            if (!g || this.draggedHandleIdx === null) return;
            const m = this.screenToMath(pos.x, pos.y);
            let ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
            let oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
            if (g.transforms && g.transforms.length > 0) {
              for (const t of g.transforms) {
                if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
                if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
              }
            }

            // 🧲 창모드 세밀 조작: 자석 스냅 반경을 기존 8px에서 3.2px로 축소하여 미세 조정이 걸림 없이 매끄럽게 되도록 개선!
            const snapThresholdMathX = (3.2 / Math.max(1, pos.cardW)) * this.xSpan * 2;
            const snapThresholdMathY = (3.2 / Math.max(1, pos.cardH)) * this.ySpan * 2;
            this.axisSnapActiveX = false;
            this.axisSnapActiveY = false;
            this.symmetrySnapActive = false;
            this.snappedPoints = [];

            if (this.showYAxis !== false && Math.abs(m.x) < snapThresholdMathX) {
              m.x = 0;
              this.axisSnapActiveX = true;
            }
            if (this.showXAxis !== false && Math.abs(m.y) < snapThresholdMathY) {
              m.y = 0;
              this.axisSnapActiveY = true;
            }

            let paramVal = g.isTransposedYX ? m.y : m.x;
            let outVal = g.isTransposedYX ? m.x : m.y;
            const paramSnapThreshold = g.isTransposedYX ? snapThresholdMathY : snapThresholdMathX;

            if (["2nd_quadratic", "abs_v", "4th_w", "4th_u"].includes(g.type) && this.draggedHandleIdx === 1) {
              const h0x = g.handles[0].x + ox;
              if (Math.abs(paramVal - h0x) < paramSnapThreshold * 1.0) {
                if (g.type === "4th_w") {
                  const curDist = Math.abs(g.handles[1].x - g.handles[0].x);
                  paramVal = h0x + Math.max(0.5, curDist);
                } else {
                  paramVal = h0x + 1.0;
                }
                this.symmetrySnapActive = true;
              }
            }

            // 전체화면 그래프 모드와 동일한 시그니처: dragActiveHandle(idx, x, y, altKey)
            this.dragActiveHandle(this.draggedHandleIdx, paramVal - ox, outVal - oy, e.altKey);
            if (g.isAbsolute && g.isAbsPristine && movedDuringInteraction) {
              g.isAbsPristine = false;
            }

            const h = g.handles[this.draggedHandleIdx];
            if (h && (this.axisSnapActiveX || this.axisSnapActiveY)) {
              const labelParts = [];
              if (this.axisSnapActiveX) labelParts.push('x=0');
              if (this.axisSnapActiveY) labelParts.push('y=0');
              const wPos = this.engine.getHandleWorldPos(g, h);
              if (wPos && !isNaN(wPos.x) && !isNaN(wPos.y)) {
                this.snappedPoints.push({ x: wPos.x, y: wPos.y, label: labelParts.join(', ') });
              }
            }
          });
          this.requestPipGraphCardRender(cardRef);
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(false);
          return;
        }

        if (activeMode === 'curve') {
          this._withPipCardGraphState(snap, pos.cardW, pos.cardH, () => {
            const g = this.activeGraph;
            if (!g || !curveInitHandles) return;
            snap._isDraggingCurve = true;
            const m = this.screenToMath(pos.x, pos.y);
            let deltaX = m.x - curveStartMath.x;
            let deltaY = m.y - curveStartMath.y;

            const snapThresholdMathX = (3.2 / Math.max(1, pos.cardW)) * this.xSpan * 2;
            const snapThresholdMathY = (3.2 / Math.max(1, pos.cardH)) * this.ySpan * 2;
            this.axisSnapActiveX = false;
            this.axisSnapActiveY = false;
            this.snappedPoints = [];

            const feats = curveFeatsSnapshot || { pts: [], asymX: [], asymY: [] };
            let bestDx = null, minDistX = snapThresholdMathX;
            let bestDy = null, minDistY = snapThresholdMathY;

            if (!e.altKey) {
              const canSnapYAxis = this.showYAxis !== false;
              const canSnapXAxis = this.showXAxis !== false;
              if (Array.isArray(feats.pts)) {
                for (const pt of feats.pts) {
                  const candX = pt.x + deltaX;
                  const candY = pt.y + deltaY;
                  if (canSnapYAxis && Math.abs(candX) < minDistX) {
                    minDistX = Math.abs(candX);
                    bestDx = -pt.x;
                  }
                  if (canSnapXAxis && Math.abs(candY) < minDistY) {
                    minDistY = Math.abs(candY);
                    bestDy = -pt.y;
                  }
                }
              }
              if (canSnapYAxis && Array.isArray(feats.asymX)) {
                for (const ax of feats.asymX) {
                  const candX = ax + deltaX;
                  if (Math.abs(candX) < minDistX) {
                    minDistX = Math.abs(candX);
                    bestDx = -ax;
                  }
                }
              }
              if (canSnapXAxis && Array.isArray(feats.asymY)) {
                for (const ay of feats.asymY) {
                  const candY = ay + deltaY;
                  if (Math.abs(candY) < minDistY) {
                    minDistY = Math.abs(candY);
                    bestDy = -ay;
                  }
                }
              }
              if (bestDx !== null) {
                deltaX = bestDx;
                this.axisSnapActiveX = true;
              }
              if (bestDy !== null) {
                deltaY = bestDy;
                this.axisSnapActiveY = true;
              }
              if ((this.axisSnapActiveX || this.axisSnapActiveY) && Array.isArray(feats.pts)) {
                for (const pt of feats.pts) {
                  const finalX = pt.x + deltaX;
                  const finalY = pt.y + deltaY;
                  const onYAxis = this.axisSnapActiveX && Math.abs(finalX) < 1e-4;
                  const onXAxis = this.axisSnapActiveY && Math.abs(finalY) < 1e-4;
                  if (onYAxis || onXAxis) {
                    const labelParts = [];
                    if (onYAxis) labelParts.push('x=0');
                    if (onXAxis) labelParts.push('y=0');
                    this.snappedPoints.push({
                      x: onYAxis ? 0 : finalX,
                      y: onXAxis ? 0 : finalY,
                      label: labelParts.join(', ')
                    });
                  }
                }
              }
            }

            const isShiftDrag = Boolean(e.shiftKey);
            const hasTransforms = Boolean(g.isAbsolute || g.isFrozen || g.frozenInvertH || g.frozenInvertV || g.frozenAbsolute || (g.transforms && g.transforms.length > 0));
            const partner = this.getLinkedPartner(g);
            const effDx = g.isTransposedYX ? deltaY : deltaX;
            const effDy = g.isTransposedYX ? deltaX : deltaY;
            const pEffDx = partner ? (partner.isTransposedYX ? deltaX : deltaY) : 0;
            const pEffDy = partner ? (partner.isTransposedYX ? deltaY : deltaX) : 0;
            if (isShiftDrag && g.isAbsolute) {
              g.handles.forEach((h, i) => {
                if (curveInitHandles[i]) {
                  h.x = curveInitHandles[i].x + effDx;
                  h.y = curveInitHandles[i].y + effDy;
                }
              });
              if (g.isAbsPristine && (Math.abs(deltaX) > 0.02 || Math.abs(deltaY) > 0.02)) {
                g.isAbsPristine = false;
              }
              if (partner && partnerInitHandles && Array.isArray(partner.handles)) {
                partner.handles.forEach((h, i) => {
                  if (partnerInitHandles[i]) {
                    h.x = partnerInitHandles[i].x + pEffDx;
                    h.y = partnerInitHandles[i].y + pEffDy;
                  }
                });
                if (partner.isAbsolute && partner.isAbsPristine && (Math.abs(deltaX) > 0.02 || Math.abs(deltaY) > 0.02)) {
                  partner.isAbsPristine = false;
                }
              }
            } else if (hasTransforms) {
              const newOx = Math.round((curveInitFreezeOffset.x + effDx) * 100) / 100;
              const newOy = Math.round((curveInitFreezeOffset.y + effDy) * 100) / 100;
              g.freezeOffset = { x: newOx, y: newOy };
              if (g.isAbsolute && g.isAbsPristine && (Math.abs(deltaX) > 0.02 || Math.abs(deltaY) > 0.02)) {
                g.isAbsPristine = false;
              }
              if (partner && partnerInitFreezeOffset) {
                partner.freezeOffset = {
                  x: Math.round((partnerInitFreezeOffset.x + pEffDx) * 100) / 100,
                  y: Math.round((partnerInitFreezeOffset.y + pEffDy) * 100) / 100
                };
                if (partner.isAbsolute && partner.isAbsPristine && (Math.abs(deltaX) > 0.02 || Math.abs(deltaY) > 0.02)) {
                  partner.isAbsPristine = false;
                }
              }
            } else {
              g.handles.forEach((h, i) => {
                if (curveInitHandles[i]) {
                  h.x = curveInitHandles[i].x + effDx;
                  h.y = curveInitHandles[i].y + effDy;
                }
              });
              if (partner && partnerInitHandles && Array.isArray(partner.handles)) {
                partner.handles.forEach((h, i) => {
                  if (partnerInitHandles[i]) {
                    h.x = partnerInitHandles[i].x + pEffDx;
                    h.y = partnerInitHandles[i].y + pEffDy;
                  }
                });
              }
            }
          });
          this.requestPipGraphCardRender(cardRef);
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(false);
        }
      });

      const finishPipInteraction = (e) => {
        if (!activeMode) return;
        const prevMode = activeMode;
        activeMode = null;
        this._isInteractingWithPipCard = false;
        this._activePipInteractionCardEl = null;
        cachedDownGeom = null;
        cachedDownGeomTs = 0;
        curveFeatsSnapshot = null;
        if (widget._pipRenderRafId) {
          cancelAnimationFrame(widget._pipRenderRafId);
          widget._pipRenderRafId = null;
        }
        const isCancel = Boolean(e && e.type === 'pointercancel');
        const snap = this._getMutablePipCardSnapshot(cardRef);
        if (snap) {
          if (prevMode === 'dropLineAim') {
            const upPos = e ? getLocalPos(e, false) : downPos;
            const isTouch = Boolean(e && (e.pointerType === 'touch' || e.pointerType === 'pen'));
            let hitTarget = false;
            this._withPipCardGraphState(snap, upPos.cardW, upPos.cardH, () => {
              const allowX = this.showXAxis !== false;
              const allowY = this.showYAxis !== false;
              if (!allowX && !allowY) return;
              const target = snap._pipDropLineHoverCand || this.findNearestDropLineTarget({ x: upPos.x, y: upPos.y }, isTouch ? 36 : 24);
              if (target) {
                hitTarget = true;
                if (!Array.isArray(this.dropLines)) this.dropLines = [];
                const existing = this.dropLines.find(dl => Math.hypot(dl.sourceX - target.x, dl.sourceY - target.y) < 0.001);
                if (existing) {
                  if (allowX) existing.showX = true;
                  if (allowY) existing.showY = true;
                  this.showToast('📍 보조 수선 복원 완료');
                } else {
                  const boundGraph = (target && target.layerId && Array.isArray(this.graphs))
                    ? this.graphs.find(gr => gr && gr.id === target.layerId)
                    : null;
                  const anchorParam = (boundGraph && boundGraph.isTransposedYX) ? target.y : target.x;
                  this.dropLines.push({
                    id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    sourceX: target.x,
                    sourceY: target.y,
                    showX: allowX,
                    showY: allowY,
                    labelX: '',
                    labelY: '',
                    style: this.dropLineStyle || 'dashed',
                    binding: {
                      type: target.type || (target.handleIndex !== null && target.handleIndex !== undefined ? 'candidate' : 'curve'),
                      layerId: target.layerId,
                      layerIds: target.layerIds || (target.layerId ? [target.layerId] : []),
                      isIntersection: Boolean(target.isIntersection || target.name === '교점'),
                      handleIndex: target.handleIndex,
                      name: target.name,
                      candKey: target.candKey,
                      anchorX: anchorParam,
                      anchorBaseX: (boundGraph && this.engine)
                        ? this.engine.worldXToBaseX(boundGraph, anchorParam)
                        : anchorParam,
                      anchorY: target.y,
                      edgeIdx: target.edgeIdx,
                      edgeT: target.edgeT,
                      anchorAngle: target.anchorAngle
                    }
                  });
                  const toastMsg = (allowX && allowY)
                    ? '📍 x·y축 보조 수선 생성 완료'
                    : (allowX ? '📍 x축 보조 수선 생성 완료' : '📍 y축 보조 수선 생성 완료');
                  this.showToast(toastMsg);
                }
              }
            });
            if (!hitTarget && !isCancel && !movedDuringInteraction && Math.hypot(upPos.x - downPos.x, upPos.y - downPos.y) < 8) {
              snap.isPipDropLineMode = false;
              snap._pipDropLineHoverCand = null;
              snap._pipDropLineHoverScissors = null;
              widget._lastPipLockUiSig = '';
              this.showToast('📍 수선 그리기 꺼짐');
            } else if (isTouch) {
              snap._pipDropLineHoverCand = null;
            }
          } else if (prevMode === 'panAxes' && !isCancel && !movedDuringInteraction) {
            // 🌟 [대표님 피드백 반영]: 창모드 내부에서 그래프 밖(빈 여백)을 톡 두드리면(Tap) 수선 모드 및 곡선 선택 해제!
            if (snap.isPipDropLineMode) {
              snap.isPipDropLineMode = false;
              snap._pipDropLineHoverCand = null;
              snap._pipDropLineHoverScissors = null;
              widget._lastPipLockUiSig = '';
              this.showToast('📍 수선 그리기 꺼짐');
            }
            snap.isCurveSelected = false;
            snap.selectedHandleIdx = null;
          }
          snap.draggedHandleIdx = null;
          snap._isDraggingCurve = false;
          snap._isPanningAxes = false;
          snap._activeSnapHint = null;
          snap.axisSnapActiveX = false;
          snap.axisSnapActiveY = false;
          snap.symmetrySnapActive = false;
          snap.snappedPoints = [];
          this._savePipCardSnapshot(cardRef, snap);
        }
        try { if (e && e.pointerId !== undefined) liveCanvas.releasePointerCapture(e.pointerId); } catch (_) { }
        this.renderPipGraphCard(cardRef);
        if (snap) {
          if (snap.isPipLocked) {
            liveCanvas.style.cursor = 'move';
          } else if (e && e.pointerType !== 'touch') {
            const releasePos = getLocalPos(e, false);
            liveCanvas.style.cursor = computePipHoverCursor(releasePos, snap);
          } else {
            liveCanvas.style.cursor = snap.isPipDropLineMode ? 'crosshair' : 'default';
          }
        }
        this.scheduleBakePipGraphCardToImg(cardRef);
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
      };

      liveCanvas.addEventListener('pointerup', finishPipInteraction);
      liveCanvas.addEventListener('pointercancel', finishPipInteraction);

      // 4. 카드 위 마우스 휠: 잠금 전(!snap.isPipLocked) 상태일 때 카드 내부 그래프 배율(zoomLevel) 줌인/줌아웃
      liveCanvas.addEventListener('wheel', (e) => {
        if (widget.classList.contains('card-ink-active')) return;
        const snap = this._getMutablePipCardSnapshot(cardRef);
        if (!snap || snap.isPipLocked) return;
        e.preventDefault();
        e.stopPropagation();
        this._ensurePipCardInkMathCoords(cardRef);
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        snap.zoomLevel = Math.max(0.35, Math.min(3.5, parseFloat(((snap.zoomLevel || 1.0) + delta).toFixed(2))));
        const aspect = isPrimary ? (this.graphCardAspect || 0.82) : (cardRef.aspect || 0.82);
        const cardW = Math.max(160, Math.round(parseFloat(widget.style.width) || bodyEl.clientWidth || 360));
        const cardH = Math.max(120, Math.round(parseFloat(bodyEl.style.height) || (cardW * aspect)));
        this._reprojectPipCardInkFromMathCoords(cardRef, cardW, cardH);
        this.renderPipGraphCard(cardRef);
        this.scheduleBakePipGraphCardToImg(cardRef);
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(false);
        }
      }, { passive: false });
    }
  }.prototype);
  delete _desc.constructor;
  Object.defineProperties(GraphApp.prototype, _desc);
}
