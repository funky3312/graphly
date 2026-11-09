/**
 * Graph Master Web - Main Coordinate System, Pointer/Touch Events, Render Pipeline, Curve Renderers & High-DPI Export (app-canvas.js)
 */
{
  const _desc = Object.getOwnPropertyDescriptors(class {
  // --- [수학적 1:1 정비율(Equal Aspect) 좌표계 변환 엔진] ---
  mathToScreen(mx, my) {
    const cx = this.screenWidth / 2 + this.panX;
    const cy = this.screenHeight / 2 + this.panY;
    const effSpanY = this.ySpan / this.zoomLevel;
    const unitScale = (this.screenHeight / 2) / effSpanY; // 픽셀 per 수학단위

    let scaleX, scaleY;
    if (this.lockAspect) {
      scaleX = unitScale;
      scaleY = unitScale;
    } else {
      const effSpanX = this.xSpan / this.zoomLevel;
      scaleX = (this.screenWidth / 2) / effSpanX;
      scaleY = unitScale;
    }

    return {
      x: cx + mx * scaleX,
      y: cy - my * scaleY
    };
  }

  screenToMath(sx, sy) {
    const cx = this.screenWidth / 2 + this.panX;
    const cy = this.screenHeight / 2 + this.panY;
    const effSpanY = this.ySpan / this.zoomLevel;
    const unitScale = (this.screenHeight / 2) / effSpanY;

    let scaleX, scaleY;
    if (this.lockAspect) {
      scaleX = unitScale;
      scaleY = unitScale;
    } else {
      const effSpanX = this.xSpan / this.zoomLevel;
      scaleX = (this.screenWidth / 2) / effSpanX;
      scaleY = unitScale;
    }

    return {
      x: (sx - cx) / scaleX,
      y: (cy - sy) / scaleY
    };
  }

  // --- [센터 고정 시네마틱 뷰파인더 연산 & 렌더링 엔진] ---
  // --- [센터 고정 시네마틱 뷰파인더 연산 & 렌더링 엔진] ---
  getVfScreenRect() {
    // 캔버스 화면 정중앙에 고정 배치 (마우스 휠 줌으로 그래프만 크기가 변하고 뷰파인더 화면 크기는 고정!)
    const sw = Math.max(160, Math.min(this.screenWidth - 40, this.vfScreenW));
    const sh = sw / this.vfAspect;
    const sx = (this.screenWidth - sw) / 2;
    const sy = (this.screenHeight - sh) / 2;
    return {
      x: sx,
      y: sy,
      w: sw,
      h: sh
    };
  }

  drawViewfinder(ctx) {
    if (!this.useViewfinder) return;
    const rect = this.getVfScreenRect();
    const { x, y, w, h } = rect;
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;

    ctx.save();

    // 1. 대표님 요청: 상시 켜두어도 판서에 1도 방해되지 않도록 라인만 보일 듯 말 듯 아주 연한 실선 테두리
    ctx.setLineDash([]);
    ctx.strokeStyle = curTheme.vfBorder; // 테마별 최적화된 은은한 극미세 실선
    ctx.lineWidth = 1.0;
    ctx.strokeRect(x, y, w, h);

    // 2. 네 코너 세련된 카메라 레티클 L자 꺽쇠 모서리 프레임 (모서리 잡기 인지용)
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#feca57';
    const cLen = Math.min(15, w * 0.15, h * 0.15);

    // 좌상
    ctx.beginPath();
    ctx.moveTo(x, y + cLen); ctx.lineTo(x, y); ctx.lineTo(x + cLen, y);
    ctx.stroke();
    // 우상
    ctx.beginPath();
    ctx.moveTo(x + w - cLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cLen);
    ctx.stroke();
    // 좌하
    ctx.beginPath();
    ctx.moveTo(x, y + h - cLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cLen, y + h);
    ctx.stroke();
    // 우하
    ctx.beginPath();
    ctx.moveTo(x + w - cLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cLen);
    ctx.stroke();

    // 2.5. [대표님 기획: 캔바 스타일 스마트 센터 가이드라인 & 자석 스냅 시각화]
    const midX = x + w / 2;
    const midY = y + h / 2;

    // 평상시: 정중앙을 가로지르는 보일 듯 말 듯 한 극미세 센터 기준선 (판서 방해 0%)
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = curTheme.isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.07)';

    // 중앙 세로 보조선
    ctx.beginPath();
    ctx.moveTo(midX, y);
    ctx.lineTo(midX, y + h);
    ctx.stroke();

    // 중앙 가로 보조선
    ctx.beginPath();
    ctx.moveTo(x, midY);
    ctx.lineTo(x + w, midY);
    ctx.stroke();
    ctx.restore();



    // 3. 상단 미니멀 플로팅 배지 (대표님 요청: '캡처영역'으로 명확화)
    const cmW = (this.vfTargetWIn * 2.54).toFixed(1);
    const cmH = ((this.vfTargetWIn / this.vfAspect) * 2.54).toFixed(1);
    const badgeText = `📷 캡처영역 [${this.vfAspectName}] | ${this.vfTargetWIn.toFixed(1)}in (${cmW}×${cmH}cm) | ${this.exportDPI} DPI`;
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeW = textWidth + 14;
    const badgeH = 18;
    const badgeX = x + (w - badgeW) / 2;
    const badgeY = Math.max(6, y - 24);

    ctx.fillStyle = curTheme.isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(20, 25, 30, 0.75)';
    ctx.strokeStyle = 'rgba(254, 202, 87, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = curTheme.isLight ? '#d97706' : '#feca57';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, badgeX + 7, badgeY + badgeH / 2);

    ctx.restore();
  }

  // --- [🧲 스마트 마그네틱 자석 스냅: 그래프별 수학적 특징점(극점·변곡점·꼭짓점·점근선) 도출 엔진] ---
  getGraphFeaturePoints(g) {
    const pts = [];   // [{ x, y, type, label }]
    const asymX = []; // [x1, x2, ...] 수직 점근선 x좌표
    const asymY = []; // [y1, y2, ...] 수평 점근선 y좌표

    if (!g || !g.handles || g.handles.length === 0) {
      return { pts, asymX, asymY };
    }

    const h = g.handles;

    switch (g.type) {
      case 'general_expr':
        if (h.length >= 1) {
          pts.push({ x: h[0].x, y: h[0].y, type: 'center', label: '중심점' });
        }
        break;

      case '1st_linear':
        if (h.length >= 1) {
          pts.push({ x: h[0].x, y: h[0].y, type: 'center', label: '정점' });
        }
        break;

      case '2nd_quadratic':
        if (h.length >= 1) {
          pts.push({ x: h[0].x, y: h[0].y, type: 'vertex', label: '꼭짓점' });
        }
        break;

      case '3rd_normal':
        if (h.length >= 2) {
          const sorted = [...h.slice(0, 2)].sort((a, b) => a.x - b.x);
          const y1 = sorted[0].y;
          const y2 = sorted[1].y;
          pts.push({ x: sorted[0].x, y: g.isAbsolute ? Math.abs(y1) : y1, type: 'max', label: '극점' });
          pts.push({ x: sorted[1].x, y: g.isAbsolute ? Math.abs(y2) : y2, type: 'min', label: '극점' });
        }
        break;

      case '4th_symmetric':
        if (h.length >= 3) {
          pts.push({ x: h[0].x, y: g.isAbsolute ? Math.abs(h[0].y) : h[0].y, type: 'min', label: '극소' });
          pts.push({ x: h[1].x, y: g.isAbsolute ? Math.abs(h[1].y) : h[1].y, type: 'max', label: '극대' });
          pts.push({ x: h[2].x, y: g.isAbsolute ? Math.abs(h[2].y) : h[2].y, type: 'min', label: '극소' });
        }
        break;

      case '4th_asymmetric':
        if (h.length >= 3) {
          h.forEach((handle) => {
            const lab = handle.type === 'max' ? '극대' : '극소';
            pts.push({ x: handle.x, y: g.isAbsolute ? Math.abs(handle.y) : handle.y, type: handle.type, label: lab });
          });
        }
        break;

      case '4th_inflection':
        if (h.length >= 2) {
          pts.push({ x: h[0].x, y: g.isAbsolute ? Math.abs(h[0].y) : h[0].y, type: 'inflection', label: '수평변곡점' });
          pts.push({ x: h[1].x, y: g.isAbsolute ? Math.abs(h[1].y) : h[1].y, type: 'min', label: '극소' });
        }
        break;

      case 'rational_basic':
        if (h.length >= 1) {
          pts.push({ x: h[0].x, y: h[0].y, type: 'center', label: '대칭중심' });
          asymX.push(h[0].x);
          asymY.push(h[0].y);
        }
        break;

      case 'exp_basic':
        if (h.length >= 1) {
          asymY.push(h[0].y);
          pts.push({ x: h[0].x, y: h[0].y, type: 'center', label: '점근선' });
        }
        break;

      case 'log_basic':
        if (h.length >= 1) {
          asymX.push(h[0].x);
          pts.push({ x: h[0].x, y: h[0].y, type: 'center', label: '점근선' });
        }
        break;

      case 'sqrt_basic':
        if (h.length >= 1) {
          pts.push({ x: h[0].x, y: h[0].y, type: 'vertex', label: '시작점' });
        }
        break;

      case 'sin_1period':
        if (h.length >= 1) {
          const x0 = h[0].x, y0 = h[0].y;
          pts.push({ x: x0, y: g.isAbsolute ? Math.abs(y0) : y0, type: 'center', label: '대칭중심' });
          if (h.length >= 2) {
            const dx = h[1].x - x0;
            const A = h[1].y - y0;
            const yPeak = y0 + A;
            const yValley = y0 - A;
            pts.push({ x: x0 + dx, y: g.isAbsolute ? Math.abs(yPeak) : yPeak, type: 'max', label: '극대' });
            pts.push({ x: x0 + 3 * dx, y: g.isAbsolute ? Math.abs(yValley) : yValley, type: 'min', label: '극소' });
          }
        }
        break;

      case 'cos_1period':
        if (h.length >= 1) {
          const x0 = h[0].x, y0 = h[0].y;
          pts.push({ x: x0, y: g.isAbsolute ? Math.abs(y0) : y0, type: 'center', label: '대칭중심' });
          if (h.length >= 2) {
            const dx = h[1].x - x0;
            const A = h[1].y - y0;
            const yPeak = y0 + A;
            const yValley = y0 - A;
            pts.push({ x: x0, y: g.isAbsolute ? Math.abs(yPeak) : yPeak, type: 'max', label: '극대' });
            pts.push({ x: x0 + dx * 0.5, y: g.isAbsolute ? Math.abs(yValley) : yValley, type: 'min', label: '극소' });
            pts.push({ x: x0 + dx, y: g.isAbsolute ? Math.abs(yPeak) : yPeak, type: 'max', label: '극대' });
          }
        }
        break;

      case 'tan_1period':
        if (h.length >= 1) {
          pts.push({ x: h[0].x, y: h[0].y, type: 'center', label: '중심' });
          const x0 = h[0].x;
          let dx = h.length >= 2 ? h[1].x - x0 : 0.785;
          if (Math.abs(dx) < 0.2) dx = dx >= 0 ? 0.2 : -0.2;
          const omega = Math.PI / (4.0 * Math.abs(dx));
          const halfPeriod = Math.PI / (2.0 * omega);
          asymX.push(x0 - halfPeriod);
          asymX.push(x0 + halfPeriod);
        }
        break;

      case 'killer_frac_odd':
        if (h.length >= 2) {
          const x0 = h[0].x, y0 = h[0].y;
          const p = h[1].x - x0, q = h[1].y - y0;
          pts.push({ x: x0, y: y0, type: 'inflection', label: '변곡점' });
          pts.push({ x: x0 + p, y: y0 + q, type: 'max', label: '극대' });
          pts.push({ x: x0 - p, y: y0 - q, type: 'min', label: '극소' });
          asymY.push(y0);
        }
        break;

      case 'killer_exp_linear':
        if (h.length >= 2) {
          const x0 = h[0].x, y0 = h[0].y;
          const p = h[1].x - x0, q = h[1].y - y0;
          pts.push({ x: x0, y: y0, type: 'vertex', label: '통과점' });
          pts.push({ x: x0 + p, y: y0 + q, type: 'max', label: '극대' });
          asymY.push(y0);
        }
        break;

      case 'killer_exp_quad':
        if (h.length >= 2) {
          const x0 = h[0].x, y0 = h[0].y;
          const p = h[1].x - x0, q = h[1].y - y0;
          pts.push({ x: x0, y: y0, type: 'min', label: '원점접점' });
          pts.push({ x: x0 + p, y: y0 + q, type: 'max', label: '극대' });
          asymY.push(y0);
        }
        break;

      case 'killer_log_frac':
        if (h.length >= 2) {
          const x0 = h[0].x, y0 = h[0].y;
          const p = h[1].x - x0, q = h[1].y - y0;
          pts.push({ x: x0 + p / Math.E, y: y0, type: 'point', label: '통과점' });
          pts.push({ x: x0 + p, y: y0 + q, type: 'max', label: '극대' });
          asymX.push(x0);
          asymY.push(y0);
        }
        break;

      default:
        if (h.length > 0) {
          pts.push({ x: h[0].x, y: h[0].y, type: 'center', label: '중심' });
        }
        break;
    }

    let ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    let oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    if (g.transforms && g.transforms.length > 0) {
      for (const t of g.transforms) {
        if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
        if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
      }
    }
    if (ox !== 0 || oy !== 0) {
      for (let i = 0; i < pts.length; i++) {
        pts[i].x += ox;
        pts[i].y += oy;
      }
      for (let i = 0; i < asymX.length; i++) asymX[i] += ox;
      for (let i = 0; i < asymY.length; i++) asymY[i] += oy;
    }

    return { pts, asymX, asymY };
  }

  // --- [다중 곡선 히트 테스트 (가장 가까운 곡선 인덱스 탐색)] ---
  hitTestAllCurves(pos, isTouch = false) {
    if (!this.graphs || this.graphs.length === 0) return null;
    const isPip = Boolean(this._isRenderingGraphSnapshot);
    const hitTolerancePx = isPip ? (isTouch ? 13 : 9.5) : (isTouch ? 24 : 14);
    const selectedBonus = isPip ? 3.0 : 10;
    let bestIdx = null;
    let minDistance = Infinity;

    // 유효한 활성 그래프 우선 검사, 그 후 역순 검사(최근 추가된 레이어 우선)
    const validActive = (this.activeGraphIdx >= 0 && this.activeGraphIdx < this.graphs.length) ? [this.activeGraphIdx] : [];
    const others = this.graphs.map((_, i) => i).filter(i => i !== this.activeGraphIdx);
    const order = [...validActive, ...others];

    order.forEach(gIdx => {
      const g = this.graphs[gIdx];
      if (!g) return;
      const dist = this.getCurveDist(g, pos, gIdx);
      // [대표님 핵심 규칙]: 전체화면에서는 선택된 곡선에 +10px 여유를 주되, 창모드(isPip)에서는 오클릭 방지를 위해 칼같이 좁힘!
      const tol = (gIdx === this.activeGraphIdx && this.isCurveSelected) ? (hitTolerancePx + selectedBonus) : hitTolerancePx;
      if (dist <= tol && dist < minDistance) {
        minDistance = dist;
        bestIdx = gIdx;
      }
    });

    return bestIdx;
  }

  hexToRgba(hex, alpha = 1.0) {
    if (!hex) return `rgba(255, 255, 255, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(255, 255, 255, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  distToSegment(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  getCurveDist(g, pos, gIdx = null) {
    if (!g) return Infinity;
    const m = this.screenToMath(pos.x, pos.y);

    // [✂️ 구간 분할 합성 스마트 히트 판정]:
    // 만약 현재 곡선이 활성화되어 점선이 보이는 상태가 아니라면, 화면에 실선으로 채택된 구간에서만 클릭 감지!
    // (보이지 않는 잘려나간 구역을 클릭했을 때 비활성 곡선이 잘못 잡히지 않고, 빈 공간 클릭 판독으로 연결!)
    if (this.usePiecewise && this.graphs.length >= 1 && !g.isIndependent && gIdx !== null) {
      const isSelectedWithGhost = (gIdx === this.activeGraphIdx && (this.isCurveSelected || this.selectedHandleIdx !== null));
      if (!isSelectedWithGhost) {
        if (!this.isInsidePiece(gIdx, m.x)) {
          return Infinity;
        }
      }
    }

    // 0. 평면도형 (원, 삼각형, 사각형) 히트 판정
    if (g.type === 'geom_circle' && g.handles.length >= 2) {
      const s0 = this.mathToScreen(g.handles[0].x, g.handles[0].y);
      const s1 = this.mathToScreen(g.handles[1].x, g.handles[1].y);
      const rPx = Math.hypot(s1.x - s0.x, s1.y - s0.y);
      const d = Math.hypot(pos.x - s0.x, pos.y - s0.y);
      if (d <= rPx + 14) return Math.min(Math.abs(d - rPx), 6);
      return Math.abs(d - rPx);
    }

    if ((g.type === 'geom_triangle' || g.type === 'geom_quad') && g.handles.length >= 3) {
      const pts = g.handles.map(h => this.mathToScreen(h.x, h.y));
      let minDist = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const dist = this.distToSegment(pos, p1, p2);
        if (dist < minDist) minDist = dist;
      }
      return minDist;
    }

    // 1. 일차함수 완전 수직선 특수 판정
    if (g.type === '1st_linear' && g.handles.length >= 2) {
      if (Math.abs(g.handles[1].x - g.handles[0].x) < 1e-4) {
        const sx = this.mathToScreen(g.handles[0].x, 0).x;
        return Math.abs(pos.x - sx);
      }
    }

    // 🌟 [Screen Polyline Distance 최적화: 가파른 삼차·사차함수 구간도 100% 칼스냅 판정] 🌟
    if (
      g._screenPts &&
      g._screenPts.length >= 2 &&
      (!g._screenPtsW || (g._screenPtsW === this.screenWidth && g._screenPtsH === this.screenHeight))
    ) {
      let minDist = Infinity;
      const pts = g._screenPts;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        if (!p1 || !p2) continue; // 점근선 분리 끊김 구간 건너뛰기

        // 1차 바운딩 박스 고속 필터링 (가로/세로 50px 범위 밖이면 생략)
        const minX = (p1.x < p2.x ? p1.x : p2.x) - 50;
        const maxX = (p1.x > p2.x ? p1.x : p2.x) + 50;
        const minY = (p1.y < p2.y ? p1.y : p2.y) - 50;
        const maxY = (p1.y > p2.y ? p1.y : p2.y) + 50;
        if (pos.x < minX || pos.x > maxX || pos.y < minY || pos.y > maxY) continue;

        const d = this.distToSegment(pos, p1, p2);
        if (d < minDist) minDist = d;
      }
      if (isFinite(minDist)) {
        return minDist;
      }
    }

    const effSpanX = this.xSpan / Math.max(0.01, this.zoomLevel);
    const pxToMathX = (effSpanX * 2) / Math.max(1, this.screenWidth);
    let minDistPx = Infinity;
    let prevSampleScreen = null;

    [-12, -9, -6, -3, 0, 3, 6, 9, 12].forEach(offsetPx => {
      const sampleX = m.x + offsetPx * pxToMathX;
      let evalX = sampleX;
      let yOffset = 0;
      if (this.usePiecewise && this.isPiecewisePeriodic && this.piecewiseBoundaries.length >= 2 && !g.isIndependent) {
        const b0 = this.piecewiseBoundaries[0];
        const bLast = this.piecewiseBoundaries[this.piecewiseBoundaries.length - 1];
        const T = bLast - b0;
        if (T > 1e-4) {
          const k = Math.floor((sampleX - b0) / T);
          let xBase = sampleX - k * T;
          if (xBase >= bLast - 1e-6) xBase = b0;
          if (xBase < b0) xBase = b0;
          evalX = xBase;
          yOffset = k * (this.periodicStepY || 0);
        }
      }
      const evalY = this.engine.evaluatePipeline(g, evalX) + yOffset;

      if (!isNaN(evalY) && isFinite(evalY) && Math.abs(evalY) < 150) {
        const s = this.mathToScreen(sampleX, evalY);
        const dist = prevSampleScreen
          ? this.distToSegment(pos, prevSampleScreen, s)
          : Math.hypot(pos.x - s.x, pos.y - s.y);
        if (dist < minDistPx) minDistPx = dist;
        prevSampleScreen = s;
      } else {
        prevSampleScreen = null;
      }
    });

    return minDistPx;
  }

  // --- [이벤트 바인딩] ---
  bindEvents() {
    // 🌟 [대표님 긴급 해결: 모달·리모컨·버튼·오버레이 위 조작 시 뒷창 캔버스 필기 간섭 100% 원천 차단 판별기] 🌟
    const isClickableUI = (target) => {
      if (!target || target === this.canvas) return false;
      return Boolean(
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'LABEL' ||
        target.tagName === 'A' ||
        (target.closest && target.closest('button, .rail-btn, .quick-fab-btn, .rail-dock, .sidebar-rail, .canvas-quick-toolbar, .curve-context-bar, .pw-region-popover, .drawer-panel, .rail-drawer, .modal, .smart-modal-backdrop, .smart-modal-card, .pdf-modal-backdrop, .pdf-modal-container, .n-axis-studio-backdrop, .n-axis-studio-card, .smart-note-viewer-overlay, .viewer-graph-touch-bar, .pdf-board-nav-bar, .lesson-playlist-nav-bar, .top-slide-bar-mini-tab, .quick-pill-remote, .ink-dock, .problem-card-widget, .graph-card-widget, .graph-snap-floating-bar, .ink-floating-toolbar, .lasso-action-floating-bar'))
      );
    };

    this._uiPointerIds = new Set();
    let _mCloud = null, _mShare = null, _mSmart = null, _mGuide = null, _mShortcut = null, _viewerEl = null;
    const isAnyModalOrOverlayBlockingCanvas = () => {
      if (this.isDraggingPillRemote) return true;
      if (this.isPdfModalOpen || this.isNAxisStudioOpen) return true;
      if (!_mCloud) _mCloud = document.getElementById('modalCloudHub');
      if (_mCloud && _mCloud.classList.contains('show')) return true;
      if (!_mShare) _mShare = document.getElementById('modalShare');
      if (_mShare && _mShare.classList.contains('show')) return true;
      if (!_mSmart) _mSmart = document.getElementById('modalSmartInput');
      if (_mSmart && _mSmart.classList.contains('show')) return true;
      if (!_mGuide) _mGuide = document.getElementById('modalGuideNotice');
      if (_mGuide && _mGuide.classList.contains('show')) return true;
      if (!_mShortcut) _mShortcut = document.getElementById('modalShortcutSettings');
      if (_mShortcut && _mShortcut.classList.contains('show')) return true;
      if (!_viewerEl) _viewerEl = document.getElementById('smartNoteViewerOverlay');
      if (_viewerEl && _viewerEl.style.display !== 'none' && !document.body.classList.contains('viewer-graph-touch-mode')) return true;
      return false;
    };

    // 1) 캔버스 및 UI 버튼 영역 우클릭 컨텍스트 메뉴 차단 (펜으로 살짝 길게 누를 때 우클릭 메뉴가 떠서 버튼 클릭이 씹히는 현상 원천 차단)
    const preventContextMenu = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
    };
    this.canvas.addEventListener('contextmenu', preventContextMenu);
    window.addEventListener('contextmenu', preventContextMenu);

    // 2) 캔버스 및 UI 위 Windows Pen & Touch 홀드 원형 애니메이션 차단
    const preventHoldVisual = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
    };
    ['MSHoldVisual', 'MSGestureHold'].forEach(evtName => {
      this.canvas.addEventListener(evtName, preventHoldVisual, { passive: false });
      window.addEventListener(evtName, preventHoldVisual, { passive: false });
    });

    window.addEventListener('resize', () => {
      if (typeof this._syncReplayFixedStageLayout === 'function' && this._isFixedReplayStageActive()) {
        this._syncReplayFixedStageLayout();
        this.updateCanvasRect();
        this.render();
        return;
      }
      this.updateCanvasRect();
      this.resizeCanvas();
      if (this._lastAppliedAudioStateObj && (this.isAudioPlaying || this.isStudentAudioVideoOnlyMode || this._isAudioReplayActive)) {
        const lastKf = this._lastAppliedAudioStateObj;
        this._lastAppliedAudioStateObj = null;
        this._applyAudioWorkspaceKeyframe(lastKf);
      }
      this.render();
    });
    window.addEventListener('scroll', () => {
      this.updateCanvasRect();
    }, { passive: true });

    const getPos = (e) => {
      let rect = this.canvasRect;
      if (!rect || !rect.width || !rect.height) {
        rect = this.updateCanvasRect() || (this.canvas ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 });
      }
      const clientX = e.touches ? (e.touches[0] ? e.touches[0].clientX : (e.changedTouches ? e.changedTouches[0].clientX : 0)) : e.clientX;
      const clientY = e.touches ? (e.touches[0] ? e.touches[0].clientY : (e.changedTouches ? e.changedTouches[0].clientY : 0)) : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const handleDown = (e) => {
      if (this.isStudentAudioVideoOnlyMode) return;
      this._lastPointerEvent = e;
      this._erasedInCurrentStroke = false;
      const isForceSpaceOrWheelPan = Boolean(this.isSpacePressed || (e && e.button === 1));
      // 🌟 [iCanScreen 급 0ms 초저지연]: 펜/형광펜/지우개 필기 및 스페이스+드래그 팬 이동 시에는 매 터치마다 전체 상태를 JSON.stringify 하는 무거운 스냅샷 생성을 100% 생략!
      const isInkFastPath = isForceSpaceOrWheelPan || (this.isInkMode && (this.activeInkTool === 'pen' || this.activeInkTool === 'highlighter' || this.activeInkTool === 'eraser')) || this.isStylusEraserEvent(e);
      if (this.isGraphCovered && typeof this.deselectAllPipGraphCards === 'function') {
        if (!isInkFastPath || this._activeCardLasso || this._isInteractingWithPipCard) {
          this.deselectAllPipGraphCards();
        }
      }
      this._preDragState = isInkFastPath ? null : this.getHistorySnapshot();
      if (!this.canvasRect) {
        this.updateCanvasRect();
      }
      const pos = getPos(e);
      if (isForceSpaceOrWheelPan) {
        if (this.isGraphCovered && !this.pdfPageBoardData) {
          this.isBoardPanning = true;
          this.boardPanStart = { x: pos.x - (this.boardPanX || 0), y: pos.y - (this.boardPanY || 0) };
        } else {
          this.isPanning = true;
          this.panStart = { x: pos.x - this.panX, y: pos.y - this.panY };
        }
        document.body.classList.add('space-pan-dragging');
        this.canvas.style.cursor = 'move';
        if (this.virtualStylusEl && !this.isAudioPlaying) {
          this.virtualStylusEl.style.display = 'none';
        }
        this.render();
        return;
      }
      const isTouch = Boolean((e.touches && e.touches.length > 0) || e.pointerType === 'touch' || e.pointerType === 'pen');
      // 🛡️ [아이패드 손날(touch) vs 펜슬/마우스(pen/mouse) 완벽 분리]:
      // 수선(📍), 텍스트(🔤), 영역캡처(📸) 등 정밀 도구 모드에서는 손날(e.pointerType === 'touch')이 닿아도
      // 절대 모드가 풀리거나 오작동하지 않고 오직 펜슬(pen)과 마우스(mouse)로만 작동합니다!
      const isRawTouchEvent = Boolean(e && (e.pointerType === 'touch' || (e.touches && e.touches.length > 0 && !e.pointerType)));
      const isWideCapacitiveFinger = Boolean(e && e.pointerType === 'touch' && ((e.width || 0) >= 32 || (e.height || 0) >= 32));
      const isFingerOrPalmTouch = isRawTouchEvent && (this.isStylusPalmRejectionActive() || isWideCapacitiveFinger);

      // 🌟 [필기 모드 가상 스타일러스 펜]: 터치/클릭 즉시 펜 위치 동기화
      if (this.isInkMode && !isFingerOrPalmTouch) {
        this.updateStylusPenPosition(pos.x, pos.y, e);
      }

      // 🌟 0순위: [📍 교재 보조 수선 도구 모드 (손날 100% 차단 + 터치&슬라이드 조준 후 pointerup 발사)] 🌟
      if (this.activeEditingLabel && !isFingerOrPalmTouch) {
        const inputRect = this.dropLineInputEl ? this.dropLineInputEl.getBoundingClientRect() : null;
        const eX = e.touches ? e.touches[0].clientX : e.clientX;
        const eY = e.touches ? e.touches[0].clientY : e.clientY;
        if (!inputRect || eX < inputRect.left || eX > inputRect.right || eY < inputRect.top || eY > inputRect.bottom) {
          this.commitEditingDropLineLabel();
        }
      }
      if (this.isDropLineMode && !isFingerOrPalmTouch) {
        // 1. 가위 ✂️ 클릭 -> 해당 수선 1초 컷 삭제
        const hitScissors = this.hitTestScissors(pos, isTouch);
        if (hitScissors) {
          this._isAimingDropLine = false;
          this.removeDropLine(hitScissors.id, hitScissors.which);
          return;
        }

        // 2. 축 좌표 라벨 클릭 -> 인라인 수식 편집
        const hitLabel = this.hitTestDropLineLabel(pos);
        if (hitLabel) {
          this._isAimingDropLine = false;
          this.startEditingDropLineLabel(hitLabel.id, hitLabel.which, hitLabel.screenPos, hitLabel.currentText);
          return;
        }

        // 3. 🌟 [아이패드 무호버 환경 & PC 겸용 '조준(Aim) ➔ 뗄 때(pointerup) 생성' 구조]:
        // 펜이 닿는 순간 바로 찍거나 모드를 해제하지 않고, 펜을 대고 곡선을 쓱 따라가며
        // 극대·극소·변곡점·y절편·교점 라벨을 눈으로 보고 원하는 지점에서 펜을 뗄 때(pointerup) 수선을 생성합니다!
        this._isAimingDropLine = true;
        this._dropLineAimStartPos = { x: pos.x, y: pos.y };
        this.dropLineHoverCandidate = this.findNearestDropLineTarget(pos, isTouch ? 36 : 24);
        this.render();
        return;
      }

      // 🌟 0.5순위: [🔤 캔버스 자유 수식 텍스트 라벨 모드 (손날 100% 차단)] 🌟
      if (this.activeEditingTextId && !isFingerOrPalmTouch) {
        const inputRect = this.canvasTextInputEl ? this.canvasTextInputEl.getBoundingClientRect() : null;
        const eX = e.touches ? e.touches[0].clientX : e.clientX;
        const eY = e.touches ? e.touches[0].clientY : e.clientY;
        if (!inputRect || eX < inputRect.left || eX > inputRect.right || eY < inputRect.top || eY > inputRect.bottom) {
          this.commitEditingTextLabel();
        }
      }

      // 🌟 [✂️ PDF 전체화면 판서 모드 ➔ 문제 영역 스샷 후 그래프 모드 진입 드래그 시작] 🌟
      if (this.isPdfToGraphCropMode && !isFingerOrPalmTouch) {
        if (e.preventDefault) e.preventDefault();
        this.isPdfToGraphCropDragging = true;
        const startMath = this.screenToMath(pos.x, pos.y);
        this.pdfToGraphCropStart = { x: pos.x, y: pos.y, clientX: e.clientX, clientY: e.clientY, mathX: startMath.x, mathY: startMath.y };
        const vw = Math.max(1, this.screenWidth || window.innerWidth || 1);
        const vh = Math.max(1, this.screenHeight || window.innerHeight || 1);
        const nx1 = +(pos.x / vw).toFixed(4);
        const ny1 = +(pos.y / vh).toFixed(4);
        const x1 = Math.round(pos.x * 10) / 10;
        const y1 = Math.round(pos.y * 10) / 10;
        this._activeSnapDragRect = {
          x1, y1, x2: x1, y2: y1,
          nx1, ny1, nx2: nx1, ny2: ny1,
          mx1: +startMath.x.toFixed(4), my1: +startMath.y.toFixed(4),
          mx2: +startMath.x.toFixed(4), my2: +startMath.y.toFixed(4),
          isPdfCrop: true
        };
        const dragBox = document.getElementById('graphSnapDragBox');
        if (dragBox) {
          dragBox.style.display = 'block';
          dragBox.style.left = `${pos.x}px`;
          dragBox.style.top = `${pos.y}px`;
          dragBox.style.width = '0px';
          dragBox.style.height = '0px';
        }
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        return;
      }
      // 🌟 [📸 실시간 그래프 영역 스샷 드래그 시작] 🌟
      if (this.isGraphSnapMode && !isFingerOrPalmTouch) {
        if (e.preventDefault) e.preventDefault();
        this.isGraphSnapDragging = true;
        const startMath = this.screenToMath(pos.x, pos.y);
        this.graphSnapStart = { x: pos.x, y: pos.y, clientX: e.clientX, clientY: e.clientY, mathX: startMath.x, mathY: startMath.y };
        const vw = Math.max(1, this.screenWidth || window.innerWidth || 1);
        const vh = Math.max(1, this.screenHeight || window.innerHeight || 1);
        const nx1 = +(pos.x / vw).toFixed(4);
        const ny1 = +(pos.y / vh).toFixed(4);
        const x1 = Math.round(pos.x * 10) / 10;
        const y1 = Math.round(pos.y * 10) / 10;
        this._activeSnapDragRect = {
          x1, y1, x2: x1, y2: y1,
          nx1, ny1, nx2: nx1, ny2: ny1,
          mx1: +startMath.x.toFixed(4), my1: +startMath.y.toFixed(4),
          mx2: +startMath.x.toFixed(4), my2: +startMath.y.toFixed(4),
          isPdfCrop: false
        };
        const dragBox = document.getElementById('graphSnapDragBox');
        if (dragBox) {
          dragBox.style.display = 'block';
          dragBox.style.left = `${pos.x}px`;
          dragBox.style.top = `${pos.y}px`;
          dragBox.style.width = '0px';
          dragBox.style.height = '0px';
        }
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        return;
      }

      // 🌟 [🔤 캔버스 자유 수식 텍스트 라벨: 클릭, 더블클릭 수정, ✕ 삭제, 드래그 이동 최우선 처리] 🌟
      if (!this.isGraphCovered && this.activeInkTool !== 'eraser' && this.activeInkTool !== 'lasso' && this.activeInkTool !== 'sticker' && this.activeInkTool !== 'laser' && !isFingerOrPalmTouch) {
        const hitText = this.hitTestTextLabel(pos);
        if (hitText) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          if (hitText.isClose) {
            this.removeTextLabel(hitText.id);
            return;
          }
          const now = Date.now();
          if (now - this.lastTextClickTime < 340 && this.selectedTextLabelId === hitText.id) {
            this.startEditingTextLabel(hitText.id, hitText.screenPos);
            return;
          }
          this.lastTextClickTime = now;
          this.selectedTextLabelId = hitText.id;
          const selItem = this.textLabels.find(t => t.id === hitText.id);
          if (selItem && selItem.fontSize) {
            const slText = document.getElementById('sliderTextLabelSize');
            const lblText = document.getElementById('lblTextLabelSize');
            if (slText) slText.value = selItem.fontSize;
            if (lblText) lblText.textContent = `${selItem.fontSize}`;
          }

          // 드래그 이동 시작
          this._preDragState = this.getHistorySnapshot();
          this.isDraggingTextLabel = true;
          this.draggedTextLabelId = hitText.id;
          const m = this.screenToMath(pos.x, pos.y);
          const item = this.textLabels.find(t => t.id === hitText.id);
          if (item) {
            this.draggedTextOffset = { dx: item.mathX - m.x, dy: item.mathY - m.y };
          }
          this.canvas.style.cursor = 'move';
          this.render();
          return;
        }
      }

      if (this.isTextToolMode && !isFingerOrPalmTouch) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        const m = this.screenToMath(pos.x, pos.y);
        this.toggleTextToolMode(false);
        this.addTextLabel(m.x, m.y);
        return;
      }

      // 🌟 [컴팩트 스테이지 우하단 컨트롤 [ ✥ | − | + | ◢ ] 인터랙션] 🌟
      // [대표님 액정 타블렛 특화 기획]: 미니 창의 [−], [+]는 창 크기가 아니라 내부 화면(그래프)을 확대/축소하는 줌 버튼!
      if (!this.isCleanView && this.hasActiveProblemCard() && this.graphs.length > 0 && e.button !== 1 && e.button !== 2) {
        const stageHandle = this.getCompactStageHandleAt(pos);
        if (stageHandle === 'zoomOut') {
          this.setZoomLevel(this.zoomLevel - 0.12);
          this.requestRender();
          return;
        } else if (stageHandle === 'zoomIn') {
          this.setZoomLevel(this.zoomLevel + 0.12);
          this.requestRender();
          return;
        } else if (stageHandle === 'resize') {
          const stage = this.getCompactGraphStage();
          this.isResizingStage = true;
          this.stageDragStart = {
            startX: pos.x,
            startY: pos.y,
            initW: stage.w,
            initH: stage.h,
            initX: stage.x,
            initY: stage.y
          };
          stage.isCustomized = true;
          this.render();
          return;
        } else if (stageHandle === 'move') {
          const stage = this.getCompactGraphStage();
          this.isMovingStage = true;
          this.stageDragStart = {
            startX: pos.x,
            startY: pos.y,
            initX: stage.x,
            initY: stage.y,
            initPanX: this.panX,
            initPanY: this.panY
          };
          stage.isCustomized = true;
          this.render();
          return;
        }
      }

      // 🌟 [화면 이동(Pan) 명시적 제스처 우선 트리거 감지] 🌟
      // 키보드 Shift/Space 키 누름, 우클릭, 휠클릭 시 즉시 화면 이동!
      // 단, 펜(pen)/형광펜(highlighter)/지우개(eraser) 등 필기 모드에서는
      // 꾹 누름(스타일러스 롱프레스 시 발생하는 우클릭 판정)이 필기를 가로채지 않도록 엄격 차단!
      const isStylusEraser = this.isStylusEraserEvent(e);
      const isWritingTool = (this.isInkMode && this.activeInkTool !== 'select');
      const isPrecisionTool = Boolean(this.isDropLineMode || this.isTextToolMode || this.isGraphSnapMode || this.isPdfToGraphCropMode);
      const isPenLongPress = (e.pointerType === 'pen' && e.button === 2);

      // ✋ [아이패드/태블릿 손가락 1개/손날 터치 원천 차단 (두 손가락 핀치/이동만 작동)]
      if ((isWritingTool || isPrecisionTool) && isFingerOrPalmTouch) {
        return;
      }

      // 🌟 [스페이스바+드래그 또는 마우스 휠 클릭 시 펜 모드에서도 즉시 화면/칠판 밀기 발동!]
      const isForceBoardPan = Boolean(this.isSpacePressed || e.button === 1);

      const isExplicitPan = !isPenLongPress && !isStylusEraser && (
        isForceBoardPan ||
        (!isWritingTool && Boolean(this.isShiftPressed || (e && e.shiftKey) || e.button === 2))
      );

      // 🌟 [액정 타블렛 펜 지우개 버튼 / 펜 꼬리 팁 즉각 발동] 🌟
      if (isStylusEraser) {
        this._isTemporaryStylusEraser = true;
        this.isDrawingInk = true;
        this.isStylusDrawing = true;
        if (this.virtualStylusEl) this.virtualStylusEl.classList.add('drawing');
        this.updateStylusPenPosition(pos.x, pos.y, e);
        this.eraseInkAtPoint(pos.x, pos.y);
        this.render();
        return;
      }

      if (isExplicitPan) {
        if (this.isGraphCovered && !this.pdfPageBoardData) {
          this.isBoardPanning = true;
          this.boardPanStart = { x: pos.x - (this.boardPanX || 0), y: pos.y - (this.boardPanY || 0) };
        } else {
          this.isPanning = true;
          this.panStart = { x: pos.x - this.panX, y: pos.y - this.panY };
        }
        this.canvas.style.cursor = 'move';
        this.render();
        return;
      }

      // 🌟 0.8순위: [✂️ 캔버스 N-구간 다중 분할선 및 영역 인터랙션 최우선 처리] 🌟
      // 핸들러나 곡선 몸통에 가로채이지 않고 넉넉한 22px 마진으로 선/알약 어디든 시원하게 드래그!
      // 🌟 [대표님 사활 피드백]: 펜(pen)/형광펜(highlighter)/지우개(eraser) 등 필기 모드에서는
      // 경계선 위 필기감 극대화와 ✕ 삭제/경계선 이동 오터치를 100% 원천 차단(Freezing)!
      // 오직 선택(select) 도구이거나 필기 모드가 꺼져 있을 때만 경계선/✕ 조작 허용!
      const canManipulatePw = !this.isGraphCovered && (!this.isInkMode || this.activeInkTool === 'select');
      if (canManipulatePw && this.usePiecewise && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) {
        // 1) 영역 함수 변경 칩 클릭인지 먼저 확인 (잠금 상태에서도 함수 전환 허용)
        const badgePad = isTouch ? 6 : 2;
        const hitRegionChip = this.pwRegionBadges
          ? this.pwRegionBadges.find(r =>
            pos.x >= r.chipX - badgePad && pos.x <= r.chipX + r.chipW + badgePad &&
            pos.y >= r.chipY - badgePad && pos.y <= r.chipY + r.chipH + badgePad
          )
          : null;
        if (hitRegionChip) {
          this.openRegionFuncMenu(hitRegionChip.regionIdx, hitRegionChip.chipX, hitRegionChip.chipY + hitRegionChip.chipH + 4);
          return;
        }

        // 1.5) 팝오버 외부 클릭 시 닫기
        const popover = document.getElementById('pwRegionPopover');
        if (popover && popover.style.display !== 'none') {
          const popRect = popover.getBoundingClientRect();
          const canvasRect = this.canvasRect || this.updateCanvasRect() || this.canvas.getBoundingClientRect();
          const px = pos.x + canvasRect.left;
          const py = pos.y + canvasRect.top;
          if (px < popRect.left || px > popRect.right || py < popRect.top || py > popRect.bottom) {
            popover.style.display = 'none';
            this._openPwRegionIdx = null;
          }
        }

        // 2) 2x2 정사각형 패드 좌상단: 잠금(🔒/🔓) 버튼 클릭 확인
        if (this.pwBoundaryBadges) {
          const hitLock = this.pwBoundaryBadges.find(b =>
            b.lockRect &&
            pos.x >= b.lockRect.x - badgePad && pos.x < b.sx &&
            pos.y >= b.lockRect.y - badgePad && pos.y <= b.lockRect.y + b.lockRect.h
          );
          if (hitLock) {
            this.togglePiecewiseLock();
            return;
          }
        }

        // 2.2) 2x2 정사각형 패드 우상단: 세로선 삭제 버튼(✕) 클릭 확인 (대표님 지시: 잠금 상태에서도 ✕ 삭제는 항상 작동!)
        if (this.pwBoundaryBadges) {
          const hitDel = this.pwBoundaryBadges.find(b =>
            b.delRect &&
            pos.x >= b.delRect.x && pos.x <= b.delRect.x + b.delRect.w + badgePad &&
            pos.y >= b.delRect.y - badgePad && pos.y <= b.delRect.y + b.delRect.h
          );
          if (hitDel) {
            this.removePiecewiseBoundary(hitDel.bIdx);
            return;
          }
        }

        // 2.5) 2x2 정사각형 패드 하단: 경계 포함 방향 토글(●/○) 클릭 확인 (잠금 아닐 때만)
        if (!this.isPiecewiseLocked && this.pwBoundaryBadges) {
          const hitToggle = this.pwBoundaryBadges.find(b =>
            b.toggleRect &&
            pos.x >= b.toggleRect.x - badgePad && pos.x <= b.toggleRect.x + b.toggleRect.w + badgePad &&
            pos.y >= b.toggleRect.y && pos.y <= b.toggleRect.y + b.toggleRect.h + badgePad
          );
          if (hitToggle) {
            this.pushHistoryState();
            if (!this.piecewiseInclusions) this.piecewiseInclusions = [];
            while (this.piecewiseInclusions.length < this.piecewiseBoundaries.length) {
              this.piecewiseInclusions.push('right');
            }
            const isLeftClick = (pos.x < hitToggle.sx);
            const nextDir = isLeftClick ? 'left' : 'right';
            this.piecewiseInclusions[hitToggle.bIdx] = nextDir;
            // 주기 반복 모드에서 양 끝 경계선(0 또는 n-1)을 토글하면 모든 주기 경계가 일관되게 동기화!
            if (this.isPiecewisePeriodic && this.piecewiseBoundaries.length >= 2) {
              const lastIdx = this.piecewiseBoundaries.length - 1;
              if (hitToggle.bIdx === 0 || hitToggle.bIdx === lastIdx) {
                this.piecewiseInclusions[0] = nextDir;
                this.piecewiseInclusions[lastIdx] = nextDir;
              }
            }
            this.showToast(isLeftClick ? '🎯 왼쪽 구간 포함 (● 왼쪽 / 오른쪽 ○)' : '🎯 오른쪽 구간 포함 (○ 왼쪽 / 오른쪽 ●)');
            this.updatePwDescBadge();
            this.render();
            return;
          }
        }

        // 2.8) 상단 전주기 반복 브래킷 클릭 확인 (테스트 호환용)
        if (this.pwPeriodBracketBadge) {
          const p = this.pwPeriodBracketBadge;
          if (pos.x >= p.pillX - badgePad && pos.x <= p.pillX + p.pillW + badgePad &&
            pos.y >= p.pillY - badgePad && pos.y <= p.pillY + p.pillH + badgePad) {
            if (this.isPiecewisePeriodic) {
              if (p.minusRect && pos.x >= p.minusRect.x - 4 && pos.x <= p.minusRect.x + p.minusRect.w + 4 &&
                pos.y >= p.minusRect.y - 4 && pos.y <= p.minusRect.y + p.minusRect.h + 4) {
                this.setPeriodicStep((this.periodicStepY || 0) - 1);
                return;
              }
              if (p.plusRect && pos.x >= p.plusRect.x - 4 && pos.x <= p.plusRect.x + p.plusRect.w + 4 &&
                pos.y >= p.plusRect.y - 4 && pos.y <= p.plusRect.y + p.plusRect.h + 4) {
                this.setPeriodicStep((this.periodicStepY || 0) + 1);
                return;
              }
              if (p.valRect && pos.x >= p.valRect.x - 4 && pos.x <= p.valRect.x + p.valRect.w + 4 &&
                pos.y >= p.valRect.y - 4 && pos.y <= p.valRect.y + p.valRect.h + 4) {
                this.setPeriodicStep(0);
                return;
              }
              this.togglePiecewisePeriodic(false);
              return;
            } else {
              this.togglePiecewisePeriodic(true);
              return;
            }
          }
        }
      }

      // 🌟 [필기 모드 완전 프리징 & 핸들러 최우선 판정 (세로 경계선 몸통 드래그보다 1순위!)] 🌟
      // 핸들러(동그라미 조절점)와 구간 분할 세로선이 겹쳐 있을 때 핸들러가 무조건 먼저 잡히도록 최우선 판정하며,
      // 경계선 잠금(isPiecewiseLocked) 상태에서도 핸들러를 통한 함수 개형 조절은 100% 열려 있습니다!
      const canManipulateHandles = !this.isGraphCovered && (!this.isInkMode || this.activeInkTool === 'select');
      const prioHitDist = isTouch ? 32 : 22;
      let prioHandleIdx = null;

      if (canManipulateHandles && this.activeGraph && this.activeGraph.handles) {
        let ox = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.x === 'number') ? this.activeGraph.freezeOffset.x : 0;
        let oy = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.y === 'number') ? this.activeGraph.freezeOffset.y : 0;
        if (this.activeGraph.transforms && this.activeGraph.transforms.length > 0) {
          for (const t of this.activeGraph.transforms) {
            if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
            if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
          }
        }
        this.activeGraph.handles.forEach((h, idx) => {
          if (h.hidden) return;
          if (!this.isCurveSelected && (h.type === 'center' || h.type === 'asymptote') && ["cos_1period", "rational_basic", "exp_basic", "log_basic"].includes(this.activeGraph.type)) return;
          let targetY = h.y;
          if (this.activeGraph.isAbsolute && ["max", "min", "point", "vertex", "inflection"].includes(h.type)) {
            targetY = Math.abs(h.y);
          }
          let evalY = (h.type === 'center' || h.type === 'asymptote')
            ? (targetY + oy)
            : this.engine.evaluatePipeline(this.activeGraph, h.x + ox);
          if (isNaN(evalY) || !isFinite(evalY)) {
            evalY = targetY + oy;
          }
          const s = this.mathToScreen(h.x + ox, evalY);
          const dist = Math.hypot(s.x - pos.x, s.y - pos.y);
          if (dist <= prioHitDist) {
            prioHandleIdx = idx;
          }
        });
      }

      if (canManipulateHandles && prioHandleIdx !== null) {
        if (!this.isCurveSelected) {
          // 🌟 [대표님 핵심 기획]: 비활성화(핸들러 꺼짐) 상태에서의 첫 터치는 오직 그래프 선택 & 핸들러 깨우기만 수행! (절대 미끄러지거나 변형되지 않음!)
          this.isCurveSelected = true;
          this.selectedHandleIdx = null;
          this.draggedHandleIdx = null;
          this.isDraggingCurve = false;
          this._curveDragEligible = false;
          this.downInfo = { x: pos.x, y: pos.y, hitHandleIdx: null, hitCurveIdx: this.activeGraphIdx, hitVfCorner: false };
          this.render();
          return;
        }
        this.draggedHandleIdx = prioHandleIdx;
        this.selectedHandleIdx = prioHandleIdx;
        this.canvas.style.cursor = 'pointer';
        this.render();
        return;
      }

      // 4) 세로선 몸통 드래그 확인 (그래프 핸들러가 아닐 때만 작동하며, 잠금 상태일 때는 고정!)
      if (canManipulatePw && this.usePiecewise && !this.isPiecewiseLocked && this.pwBoundaryBadges && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) {
        const hitMargin = isTouch ? 28 : 22;
        const hitBoundary = this.pwBoundaryBadges.find(b => {
          const isNearLine = Math.abs(pos.x - b.sx) <= hitMargin;
          return isNearLine;
        });
        if (hitBoundary) {
          this.activePwDragIdx = hitBoundary.bIdx;
          this.selectedPwBoundaryIdx = hitBoundary.bIdx;
          this.isCurveSelected = false;
          this.selectedHandleIdx = null;
          this.canvas.style.cursor = 'ew-resize';
          this.render();
          return;
        }
      }

      if (!canManipulateHandles) {
        this.draggedHandleIdx = null;
        this.selectedHandleIdx = null;
        this.isCurveSelected = false;
        if (this.pulseAnimId) {
          cancelAnimationFrame(this.pulseAnimId);
          this.pulseAnimId = null;
        }
      }

      // 🟨 [칠판 위 가림막 '스티커' 원터치 열림/닫힘 토글 & 연속 드래그 생성]
      if (!isFingerOrPalmTouch && this.activeInkTool !== 'eraser' && !this.isStylusEraserEvent(e)) {
        const hitSticker = this.findBoardStickerAtScreenPos(pos);
        if (hitSticker && hitSticker.sticker) {
          if (this.isInkMode && this.activeInkTool === 'sticker') {
            this._pendingStickerTap = hitSticker.sticker;
            this.isDrawingSticker = true;
            this.stickerDraftStart = { x: pos.x, y: pos.y };
            this.stickerDraftCurrent = { x: pos.x, y: pos.y };
            this.render();
            return;
          } else {
            this._tappingBoardSticker = {
              sticker: hitSticker.sticker,
              startX: pos.x,
              startY: pos.y,
              moved: false
            };
            return;
          }
        }
        if (this.isInkMode && this.activeInkTool === 'sticker') {
          this._pendingStickerTap = null;
          this.isDrawingSticker = true;
          this.stickerDraftStart = { x: pos.x, y: pos.y };
          this.stickerDraftCurrent = { x: pos.x, y: pos.y };
          this.render();
          return;
        }
      }

      // 🌟 [선택 도구(activeInkTool === 'select')의 스마트 인터랙션 라우팅] 🌟
      // 핸들러가 아닌 경우:
      // (1) 곡선 몸통을 터치했으면 -> 해당 곡선 선택 및 평행이동!
      // (2) 빈 공간을 터치했으면 -> 화면 이동 (미니창 내부면 내부 팬, 바깥이면 칠판 전체 이동!)
      if (this.isInkMode && this.activeInkTool === 'select') {
        const hitCurveIdx = !this.isGraphCovered ? this.hitTestAllCurves(pos, isTouch) : null;
        if (hitCurveIdx !== null) {
          const isPwGroupDrag = Boolean(this.usePiecewise && this.isPiecewiseLocked && this.graphs[hitCurveIdx] && !this.graphs[hitCurveIdx].isIndependent);
          const isAlreadySelected = isPwGroupDrag || (this.isCurveSelected && this.activeGraphIdx === hitCurveIdx);
          this.activeGraphIdx = hitCurveIdx;
          this.isCurveSelected = true;
          this.selectedHandleIdx = null;
          // 🌟 [대표님 핵심 기획: 프리징 깨우기 vs 조작 상태 즉각 무빙 (구간 잠금 시 즉시 전체 평행이동)] 🌟
          this.isDraggingCurve = isAlreadySelected;
          this._curveDragEligible = isAlreadySelected;
          if (isAlreadySelected) {
            this.canvas.style.cursor = 'move';
          }
          const m = this.screenToMath(pos.x, pos.y);
          this.curveDragStart = { mx: m.x, my: m.y, startScreenX: pos.x, startScreenY: pos.y };
          this.curveHandlesSnapshot = JSON.parse(JSON.stringify(this.activeGraph.handles));
          this.curveFreezeStart = {
            ox: (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.x === 'number') ? this.activeGraph.freezeOffset.x : 0,
            oy: (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.y === 'number') ? this.activeGraph.freezeOffset.y : 0
          };
          this.curveFeatsSnapshot = this.getGraphFeaturePoints({
            type: this.activeGraph.type,
            handles: this.curveHandlesSnapshot,
            isAbsolute: this.activeGraph.isAbsolute,
            freezeOffset: this.activeGraph.freezeOffset,
            transforms: this.activeGraph.transforms
          });
          if (isPwGroupDrag) {
            this._pwGroupBoundariesSnapshot = [...(this.piecewiseBoundaries || [])];
            this._pwGroupGraphsSnapshot = this.graphs.map(gItem => ({
              handles: JSON.parse(JSON.stringify(gItem.handles || [])),
              ox: (gItem.freezeOffset && typeof gItem.freezeOffset.x === 'number') ? gItem.freezeOffset.x : 0,
              oy: (gItem.freezeOffset && typeof gItem.freezeOffset.y === 'number') ? gItem.freezeOffset.y : 0
            }));
          } else {
            this._pwGroupBoundariesSnapshot = null;
            this._pwGroupGraphsSnapshot = null;
          }
          this.downInfo = { x: pos.x, y: pos.y, hitHandleIdx: null, hitCurveIdx, hitVfCorner: false };
          this.render();
          return;
        }

        // 🌟 [대표님 핵심 기획]:
        // 누르는 순간(pointerdown)이나 손날/손가락(touch) 접촉, 또는 화면 이동(드래그) 중에는 핸들러를 절대 끄지 않음!
        // 오직 펜슬(pen)이나 마우스(mouse)로 빈 공간을 이동 없이 '툭' 건드리고 뗐을 때(handleUp)만 핸들러 해제!
        const downPType = (e && e.pointerType) ? e.pointerType : (e && e.touches ? 'touch' : 'mouse');
        this.downInfo = { x: pos.x, y: pos.y, hitHandleIdx: null, hitCurveIdx: null, hitVfCorner: false, pointerType: downPType };

        if (this.isGraphCovered && !this.pdfPageBoardData) {
          this.isBoardPanning = true;
          this.boardPanStart = { x: pos.x - (this.boardPanX || 0), y: pos.y - (this.boardPanY || 0) };
        } else {
          this.isPanning = true;
          this.panStart = { x: pos.x - this.panX, y: pos.y - this.panY };
        }
        this.canvas.style.cursor = 'move';
        this.render();
        return;
      }

      // [✍️ 실시간 무한 칠판 필기 모드 인터랙션]
      if (this.isInkMode) {
        // 🛡️ [아이패드/스타일러스 태블릿 손가락 필기 100% 차단 vs 적외선 전자칠판(IR touch 펜) 필기 허용]:
        // 전용 스타일러스(pen)가 있는 태블릿에서는 손바닥/손가락(touch) 필기를 이중 잠금하고,
        // pen 신호 없이 플라스틱 펜을 touch로 보내는 전자칠판에서는 즉시 필기/형광펜/지우개/올가미가 작동합니다!
        if (isFingerOrPalmTouch) {
          return;
        }
        // [🪢 올가미(Lasso) 툴 인터랙션]
        if (this.activeInkTool === 'lasso') {
          const hasSelection = (this.selectedInkStrokes && this.selectedInkStrokes.length > 0) ||
            (this.selectedTextLabels && this.selectedTextLabels.length > 0);

          if (hasSelection) {
            const hitResize = this.getLassoResizeHandleAt(pos);
            if (hitResize) {
              this.isResizingLassoSelection = true;
              this._preDragState = this.getHistorySnapshot();
              const bbox = this.lassoBoundingBox;
              const pad = 10;
              const x1 = bbox.minX - pad, y1 = bbox.minY - pad;
              const x2 = bbox.maxX + pad, y2 = bbox.maxY + pad;
              const anchorMap = {
                br: { ax: x1, ay: y1, cx: x2, cy: y2 },
                tl: { ax: x2, ay: y2, cx: x1, cy: y1 },
                tr: { ax: x1, ay: y2, cx: x2, cy: y1 },
                bl: { ax: x2, ay: y1, cx: x1, cy: y2 }
              };
              const info = anchorMap[hitResize] || anchorMap.br;
              this.lassoResizeStart = {
                handle: hitResize,
                anchorX: info.ax,
                anchorY: info.ay,
                startCornerX: info.cx,
                startCornerY: info.cy,
                strokesSnap: (this.selectedInkStrokes || []).map(s => JSON.parse(JSON.stringify(s))),
                textsSnap: (this.selectedTextLabels || []).map(t => JSON.parse(JSON.stringify(t))),
                lassoPointsSnap: (this.lassoPoints || []).map(p => ({ x: p.x, y: p.y }))
              };
              this.canvas.style.cursor = (hitResize === 'br' || hitResize === 'tl') ? 'nwse-resize' : 'nesw-resize';
              this.syncLassoActionBarUI();
              this.render();
              return;
            }
            const hitSelection = this.isPointInLassoSelection(pos);
            if (hitSelection) {
              // 1. 점선 루프 내부 터치 -> 드래그 이동 시작!
              this.isDraggingLassoSelection = true;
              this._preDragState = this.getHistorySnapshot();
              this.lassoDragStart = {
                screenX: pos.x,
                screenY: pos.y,
                m: this.screenToMath(pos.x, pos.y)
              };
              this.canvas.style.cursor = 'move';
              this.render();
              return;
            } else {
              // 2. 🌟 [대표님 핵심 기획]: 올가미 바깥부분 터치 시 즉각 완전 해제 준비 (2손가락 핀치 시 복원용 백업 보관)!
              this._lassoPrePinchBackup = {
                strokes: this.selectedInkStrokes,
                texts: this.selectedTextLabels,
                bbox: this.lassoBoundingBox,
                points: this.lassoPoints
              };
              this.selectedInkStrokes = [];
              this.selectedTextLabels = [];
              this.lassoBoundingBox = null;
              this.isLassoSelecting = true;
              this._lassoStartPos = { x: pos.x, y: pos.y };
              this.lassoPoints = [{ x: pos.x, y: pos.y }];
              this.canvas.style.cursor = 'crosshair';
              this.canvas.classList.remove('is-hover-selection');
              this.render();
              return;
            }
          }

          // 선택이 없는 상태에서 터치 -> 새 올가미 점선 드로잉 시작!
          this.selectedInkStrokes = [];
          this.selectedTextLabels = [];
          this.lassoBoundingBox = null;
          this.isLassoSelecting = true;
          this._lassoStartPos = { x: pos.x, y: pos.y };
          this.lassoPoints = [{ x: pos.x, y: pos.y }];
          this.canvas.style.cursor = 'crosshair';
          this.render();
          return;
        }

        // 🌟 [대표님 기획]: 칠판을 터치하는 순간 그래프는 100% 프리징(그냥 보여주기)!
        // 핸들러 깜빡임 펄스 루프 즉시 종료 및 핸들러 선택 해제하여 리소스 100% 필기에 집중
        let hadSelectedGraphHandleOrCurve = false;
        if (this.selectedHandleIdx !== null || this.isCurveSelected || this.pulseAnimId) {
          this.selectedHandleIdx = null;
          this.isCurveSelected = false;
          hadSelectedGraphHandleOrCurve = true;
          if (this.pulseAnimId) {
            cancelAnimationFrame(this.pulseAnimId);
            this.pulseAnimId = null;
          }
        }
        if (this._idleInkCacheRebuildTimer) {
          clearTimeout(this._idleInkCacheRebuildTimer);
          this._idleInkCacheRebuildTimer = null;
        }

        const m = this.screenToMath(pos.x, pos.y);
        const hasRealHardwarePressure = (typeof e.pressure === 'number' && e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.01);
        this._strokeHasRealPressure = hasRealHardwarePressure;
        const pressure = this._mapInitialStrokePressure(e.pressure, this.inkPenStyle, hasRealHardwarePressure);
        this._lastPressure = pressure;

        if (this.activeInkTool === 'eraser') {
          this.isDrawingInk = true;
          this.isStylusDrawing = true;
          this._hasSceneFreeze = false;
          if (this.virtualStylusEl) this.virtualStylusEl.classList.add('drawing');
          this.updateStylusPenPosition(pos.x, pos.y, e);
          this.eraseInkAtPoint(pos.x, pos.y);
          return;
        }

        // 🔴 [전역 레이저 포인터 (칠판 바탕화면 위 그으면 1.65초 유지 후 0.75초 동안 사르륵 소멸!)]:
        if (this.activeInkTool === 'laser') {
          this.isDrawingInk = true;
          this.isStylusDrawing = true;
          this._hasSceneFreeze = false;
          if (this.virtualStylusEl) this.virtualStylusEl.classList.add('drawing');
          this.updateStylusPenPosition(pos.x, pos.y, e);

          if (!Array.isArray(this.mainLaserStrokes)) this.mainLaserStrokes = [];
          const nowPerf = performance.now();
          const HOLD_MS = 1650;
          // 연속 필기 시 이전 레이저 획들의 소멸 타이머도 함께 연장!
          this.mainLaserStrokes.forEach(st => {
            if (st && st.finished) st.finishedAt = nowPerf;
          });

          const isBoardTarget = Boolean(this.isGraphCovered && !this.pdfPageBoardData);
          const bPt0 = this.screenToBoard(pos.x, pos.y);
          const coord0 = isBoardTarget ? { x: bPt0.x, y: bPt0.y } : { x: m.x, y: m.y };
          const recT0 = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          let recLaserStroke = null;
          if (recT0 !== undefined) {
            if (!Array.isArray(this.audioLaserStrokes)) this.audioLaserStrokes = [];
            this.audioLaserStrokes.forEach(ls => {
              if (ls && ls.cardKey === 'main_canvas' && typeof ls.holdUntil === 'number' && recT0 <= ls.holdUntil + 200) {
                ls.holdUntil = recT0 + HOLD_MS;
              }
            });
            recLaserStroke = {
              cardKey: 'main_canvas',
              isBoard: isBoardTarget,
              tStart: recT0,
              tEnd: recT0,
              holdUntil: recT0 + HOLD_MS,
              points: [{ x: coord0.x, y: coord0.y, t: recT0 }]
            };
            this.audioLaserStrokes.push(recLaserStroke);
            this.recordAudioCursorPoint(pos.x, pos.y, '#dc2626', true, { isLaser: true, cursorKind: 'laser' });
          }

          this.currentMainLaserStroke = {
            isBoard: isBoardTarget,
            finished: false,
            finishedAt: 0,
            _recLaserStroke: recLaserStroke,
            _lastScreen: { x: pos.x, y: pos.y },
            points: [{ x: coord0.x, y: coord0.y, t: nowPerf }]
          };
          this.mainLaserStrokes.push(this.currentMainLaserStroke);
          this._ensureMainLaserLoop();
          return;
        }

        const isHighlighterStroke = (this.activeInkTool === 'highlighter');
        // 📄 [대표님 기획: PDF 통모드(페이지 모드) 바깥 베젤 영역 필기 시작 차단]
        if (this.isGraphCovered && this.pdfPageBoardData && this._lastPdfPageScreenRect) {
          const pr = this._lastPdfPageScreenRect;
          if (pos.x < pr.x || pos.x > pr.x + pr.width || pos.y < pr.y || pos.y > pr.y + pr.height) {
            return;
          }
        }
        // 🌟 [무렉(Zero-Stutter) 아키텍처]: 반투명 형광펜일 때만 씬 프리즈를 캡처하고,
        // 일반 펜(pen) 필기 시에는 pointerdown 입력 핸들러 내부에서 전체 render()나 rebuildInkCache()를 절대 동기 실행하지 않음!
        if (isHighlighterStroke) {
          if (hadSelectedGraphHandleOrCurve || this._inkBakeDirty) {
            this.isDrawingInk = false;
            this._hasSceneFreeze = false;
            this.render();
          }
          this.captureSceneFreeze();
        } else {
          this._hasSceneFreeze = false;
          if (hadSelectedGraphHandleOrCurve) {
            this._inkBakeDirty = true;
          }
        }

        this.isDrawingInk = true;
        this.isStylusDrawing = true;
        if (this.virtualStylusEl) this.virtualStylusEl.classList.add('drawing');
        this.updateStylusPenPosition(pos.x, pos.y, e);
        this._lastInkScreenPos = { x: pos.x, y: pos.y };
        this._prevRawInkScreenPos = null;
        this._lastRawInkScreenPos = { x: pos.x, y: pos.y };
        this._lastMoveEventScreenPos = { x: pos.x, y: pos.y };
        const downTs = (typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : null;
        this._lastInkSampleTs = downTs;
        this._lastInkAcceptedTs = downTs;
        this._liveBezierScreenPts = [{ x: pos.x, y: pos.y, p: pressure }];
        this._inkHoldDetected = false;
        this._inkHoldLastScreenPos = { x: pos.x, y: pos.y };
        this._lastSignificantMoveTime = Date.now();

        const useCoveredBoardLayer = Boolean(this.isGraphCovered && !this.pdfPageBoardData);
        const strokeTarget = useCoveredBoardLayer ? 'board' : 'graph';
        const isGraphTarget = !useCoveredBoardLayer;

        const bPt0 = this.screenToBoard(pos.x, pos.y);
        const recT0 = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
        if (recT0 !== undefined) {
          this.recordAudioCursorPoint(pos.x, pos.y, this.currentInkColor, true);
        }
        this.currentInkStroke = {
          id: 'ink_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          tool: this.activeInkTool,
          penStyle: isHighlighterStroke ? 'ballpen' : (this.inkPenStyle || 'ballpen'),
          softBlur: isHighlighterStroke ? 0 : (this.inkSoftBlur || 0),
          target: strokeTarget,
          onPdfBoard: Boolean(this.pdfPageBoardData && isGraphTarget),
          color: this.currentInkColor,
          size: isHighlighterStroke ? parseFloat(((this.currentHighlighterSize || 16) / 2.6).toFixed(2)) : this.currentInkSize,
          highlighterSize: isHighlighterStroke ? (this.currentHighlighterSize || 16) : undefined,
          zoom: this.zoomLevel,
          boardZoom: this.boardZoom || 1.0,
          isHighlighter: isHighlighterStroke,
          tStart: recT0,
          tEnd: recT0,
          points: isGraphTarget
            ? [{ x: m.x, y: m.y, p: pressure, t: recT0 }]
            : [{ x: bPt0.x, y: bPt0.y, p: pressure, t: recT0 }]
        };
        this.inkStrokes.push(this.currentInkStroke);
        this._startInkHoldTimer();
        if (isHighlighterStroke) {
          this.render();
        } else {
          this.drawLiveBezierStep(this._liveBezierScreenPts, this.currentInkStroke, false);
        }
        return;
      }


      // [🔤 캔버스 자유 수식 텍스트 라벨: 인라인 편집 중 바깥 클릭 시 커밋]
      if (this.activeEditingTextId) {
        const inputRect = this.canvasTextInputEl ? this.canvasTextInputEl.getBoundingClientRect() : null;
        const eX = e.touches ? e.touches[0].clientX : e.clientX;
        const eY = e.touches ? e.touches[0].clientY : e.clientY;
        if (!inputRect || eX < inputRect.left || eX > inputRect.right || eY < inputRect.top || eY > inputRect.bottom) {
          this.commitEditingTextLabel();
        }
      }

      // [🔤 캔버스 자유 수식 텍스트 라벨: 클릭, 더블클릭 수정, ✕ 삭제, 드래그 이동]
      const hitText = this.hitTestTextLabel(pos);
      if (hitText) {
        if (hitText.isClose) {
          this.removeTextLabel(hitText.id);
          return;
        }
        const now = Date.now();
        if (now - this.lastTextClickTime < 340 && this.selectedTextLabelId === hitText.id) {
          // 더블클릭 -> 인라인 텍스트 편집 진입!
          if (e.preventDefault) e.preventDefault();
          this.startEditingTextLabel(hitText.id, hitText.screenPos);
          return;
        }
        this.lastTextClickTime = now;
        this.selectedTextLabelId = hitText.id;
        const selItem = this.textLabels.find(t => t.id === hitText.id);
        if (selItem && selItem.fontSize) {
          const slText = document.getElementById('sliderTextLabelSize');
          const lblText = document.getElementById('lblTextLabelSize');
          if (slText) slText.value = selItem.fontSize;
          if (lblText) lblText.textContent = `${selItem.fontSize}`;
        }

        // 드래그 이동 시작
        this.isDraggingTextLabel = true;
        this.draggedTextLabelId = hitText.id;
        const m = this.screenToMath(pos.x, pos.y);
        const item = this.textLabels.find(t => t.id === hitText.id);
        if (item) {
          this.draggedTextOffset = { dx: item.mathX - m.x, dy: item.mathY - m.y };
        }
        this.render();
        return;
      }

      const m = this.screenToMath(pos.x, pos.y);
      const handleHitDist = isTouch ? 30 : 20;
      let hitHandleIdx = null;

      // 1. 현재 활성 그래프의 핸들 터치 여부 우선 확인 (그래프가 선택되어 활성화된 상태에서만 조작!)
      if (canManipulateHandles && this.isCurveSelected && this.activeGraph && this.activeGraph.handles) {
        let ox = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.x === 'number') ? this.activeGraph.freezeOffset.x : 0;
        let oy = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.y === 'number') ? this.activeGraph.freezeOffset.y : 0;
        if (this.activeGraph.transforms && this.activeGraph.transforms.length > 0) {
          for (const t of this.activeGraph.transforms) {
            if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
            if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
          }
        }
        this.activeGraph.handles.forEach((h, idx) => {
          if (h.hidden) return;
          let targetY = h.y;
          if (this.activeGraph.isAbsolute && ["max", "min", "point", "vertex", "inflection"].includes(h.type)) {
            targetY = Math.abs(h.y);
          }
          let evalY = (h.type === 'center' || h.type === 'asymptote')
            ? (targetY + oy)
            : this.engine.evaluatePipeline(this.activeGraph, h.x + ox);
          if (isNaN(evalY) || !isFinite(evalY)) {
            evalY = targetY + oy;
          }
          const s = this.mathToScreen(h.x + ox, evalY);
          const dist = Math.hypot(s.x - pos.x, s.y - pos.y);
          if (dist <= handleHitDist) {
            hitHandleIdx = idx;
          }
        });
      }

      // 2. 핸들을 터치하지 않았다면, 캔버스 위의 모든 곡선 몸통 히트 검사
      let hitCurveIdx = null;
      if (hitHandleIdx === null) {
        hitCurveIdx = this.hitTestAllCurves(pos, isTouch);
      }

      // 3. 핸들과 곡선이 안 잡혔고 뷰파인더가 켜져 있다면, 뷰파인더 코너 히트 검사 (화면 크기 조절)
      let hitVfCorner = false;
      if (this.useViewfinder && hitHandleIdx === null && hitCurveIdx === null) {
        const vfRect = this.getVfScreenRect();
        const corners = [
          { type: 'tl', x: vfRect.x, y: vfRect.y },
          { type: 'tr', x: vfRect.x + vfRect.w, y: vfRect.y },
          { type: 'bl', x: vfRect.x, y: vfRect.y + vfRect.h },
          { type: 'br', x: vfRect.x + vfRect.w, y: vfRect.y + vfRect.h }
        ];
        for (const c of corners) {
          if (Math.hypot(pos.x - c.x, pos.y - c.y) <= 22) {
            hitVfCorner = true;
            this.isResizingVf = true;
            this.vfResizeStart = {
              startX: pos.x,
              startY: pos.y,
              startW: this.vfScreenW,
              corner: c.type
            };
            break;
          }
        }
      }

      const downPTypeGen = (e && e.pointerType) ? e.pointerType : (e && e.touches ? 'touch' : 'mouse');
      this.downInfo = { x: pos.x, y: pos.y, hitHandleIdx, hitCurveIdx, hitVfCorner, pointerType: downPTypeGen };

      // [✂️ 구간 분할 인터랙션은 상단 최우선 블록에서 완벽 처리됨]

      // 다른 요소 클릭 시 분할선 선택 해제
      this.selectedPwBoundaryIdx = null;

      if (hitHandleIdx !== null) {
        // 활성 그래프의 핸들 드래그 (형태 변형)
        this.draggedHandleIdx = hitHandleIdx;
        this.isCurveSelected = true; // [대표님 규칙]: 핸들 조작 중에도 그래프 조작 상태 완벽 유지!
        this.canvas.style.cursor = 'pointer';
      } else if (hitCurveIdx !== null) {
        // [다중 그래프 선택 & 평행이동 분리 (구간 잠금 시 즉시 전체 통째 평행이동)]
        const isPwGroupDrag = Boolean(this.usePiecewise && this.isPiecewiseLocked && this.graphs[hitCurveIdx] && !this.graphs[hitCurveIdx].isIndependent);
        const isAlreadySelected = isPwGroupDrag || (this.isCurveSelected && this.activeGraphIdx === hitCurveIdx);
        this.activeGraphIdx = hitCurveIdx;
        this.isCurveSelected = true;
        this.selectedHandleIdx = null;
        // 🌟 [대표님 핵심 기획: 프리징 깨우기 vs 조작 상태 즉각 무빙] 🌟
        this.isDraggingCurve = isAlreadySelected;
        this._curveDragEligible = isAlreadySelected;
        if (isAlreadySelected) {
          this.canvas.style.cursor = 'move';
        }
        this.curveDragStart = { mx: m.x, my: m.y, startScreenX: pos.x, startScreenY: pos.y };
        this.curveHandlesSnapshot = JSON.parse(JSON.stringify(this.activeGraph.handles));
        this.curveFreezeStart = {
          ox: (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.x === 'number') ? this.activeGraph.freezeOffset.x : 0,
          oy: (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.y === 'number') ? this.activeGraph.freezeOffset.y : 0
        };
        if (isPwGroupDrag) {
          this._pwGroupBoundariesSnapshot = [...(this.piecewiseBoundaries || [])];
          this._pwGroupGraphsSnapshot = this.graphs.map(gItem => ({
            handles: JSON.parse(JSON.stringify(gItem.handles || [])),
            ox: (gItem.freezeOffset && typeof gItem.freezeOffset.x === 'number') ? gItem.freezeOffset.x : 0,
            oy: (gItem.freezeOffset && typeof gItem.freezeOffset.y === 'number') ? gItem.freezeOffset.y : 0
          }));
        } else {
          this._pwGroupBoundariesSnapshot = null;
          this._pwGroupGraphsSnapshot = null;
        }

        // 🚀 [초고속 최적화]: 드래그 중 반복 계산 방지용 특징점(극점·변곡점·점근선) 1회 사전 캐싱
        const snapshotGraph = {
          type: this.activeGraph.type,
          handles: this.curveHandlesSnapshot,
          isAbsolute: this.activeGraph.isAbsolute,
          freezeOffset: this.activeGraph.freezeOffset,
          transforms: this.activeGraph.transforms
        };
        this.curveFeatsSnapshot = this.getGraphFeaturePoints(snapshotGraph);

        const partner = this.getLinkedPartner(this.activeGraph);
        if (partner) {
          this.partnerHandlesSnapshot = JSON.parse(JSON.stringify(partner.handles));
          this.partnerFreezeStart = {
            ox: (partner.freezeOffset && typeof partner.freezeOffset.x === 'number') ? partner.freezeOffset.x : 0,
            oy: (partner.freezeOffset && typeof partner.freezeOffset.y === 'number') ? partner.freezeOffset.y : 0
          };
        } else {
          this.partnerHandlesSnapshot = null;
          this.partnerFreezeStart = null;
        }

        this.syncControls();
        this.renderLayerList();
        this.renderFuncList();
        this.render();
      } else if (hitVfCorner) {
        // 뷰파인더 코너 조절 상태
        this.isCurveSelected = false;
        this.selectedHandleIdx = null;
      } else {
        // 🌟 [대표님 핵심 기획]:
        // 누르는 순간(pointerdown)이나 손날/손가락(touch) 접촉, 화면 드래그 이동 중에는 핸들러를 절대 끄지 않음!
        // 오직 펜슬(pen)이나 마우스(mouse)로 빈 공간을 이동 없이 '툭' 건드리고 뗐을 때(handleUp)만 핸들러 해제!
        if (this.isGraphCovered && !this.pdfPageBoardData) {
          this.isBoardPanning = true;
          this.boardPanStart = { x: pos.x - (this.boardPanX || 0), y: pos.y - (this.boardPanY || 0) };
          this.canvas.style.cursor = 'move';
        } else {
          this.isPanning = true;
          this.panStart = { x: pos.x - this.panX, y: pos.y - this.panY };
          this.canvas.style.cursor = 'move';
        }
        this.render();
      }
    };

    const handleMove = (e) => {
      this._lastPointerEvent = e;
      // 🛡️ [포인터 상태 자가 치유 가드]: 카드나 툴바 위로 획이 지나가며 pointerup이 누락되어 마우스 버튼을 뗐는데도(e.buttons === 0)
      // 드로잉/패닝 상태가 고착되는 현상을 0.00ms 만에 자동 감지하여 즉시 해제!
      if (
        e &&
        (e.pointerType === 'mouse' || !e.pointerType) &&
        typeof e.buttons === 'number' &&
        e.buttons === 0 &&
        (this.isDrawingInk || this.isStylusDrawing || this.isPanning || this.isBoardPanning || this.isDraggingCurve || this.draggedHandleIdx !== null || this.isDraggingLassoSelection || this.isResizingLassoSelection || this.isLassoSelecting)
      ) {
        this.isPointerDownOnCanvas = false;
        handleUp(e);
      }
      const pos = getPos(e);

      // 🌟 [✂️ PDF 문제 스샷 후 그래프 모드 진입 드래그 중: 자동 스크롤/패닝 없이 한 화면에서 안정적 캡처] 🌟
      if (this.isPdfToGraphCropMode) {
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        if (this.canvas) this.canvas.style.cursor = 'crosshair';
        if (this.isPdfToGraphCropDragging && this.pdfToGraphCropStart) {
          const dragBox = document.getElementById('graphSnapDragBox');
          if (dragBox) {
            const x = Math.min(this.pdfToGraphCropStart.x, pos.x);
            const y = Math.min(this.pdfToGraphCropStart.y, pos.y);
            const w = Math.abs(pos.x - this.pdfToGraphCropStart.x);
            const h = Math.abs(pos.y - this.pdfToGraphCropStart.y);
            dragBox.style.left = `${x}px`;
            dragBox.style.top = `${y}px`;
            dragBox.style.width = `${w}px`;
            dragBox.style.height = `${h}px`;
          }
          const vw = Math.max(1, this.screenWidth || window.innerWidth || 1);
          const vh = Math.max(1, this.screenHeight || window.innerHeight || 1);
          const curMath = this.screenToMath(pos.x, pos.y);
          this._activeSnapDragRect = {
            x1: Math.round(this.pdfToGraphCropStart.x * 10) / 10,
            y1: Math.round(this.pdfToGraphCropStart.y * 10) / 10,
            x2: Math.round(pos.x * 10) / 10,
            y2: Math.round(pos.y * 10) / 10,
            nx1: +(this.pdfToGraphCropStart.x / vw).toFixed(4),
            ny1: +(this.pdfToGraphCropStart.y / vh).toFixed(4),
            nx2: +(pos.x / vw).toFixed(4),
            ny2: +(pos.y / vh).toFixed(4),
            mx1: +(typeof this.pdfToGraphCropStart.mathX === 'number' ? this.pdfToGraphCropStart.mathX : curMath.x).toFixed(4),
            my1: +(typeof this.pdfToGraphCropStart.mathY === 'number' ? this.pdfToGraphCropStart.mathY : curMath.y).toFixed(4),
            mx2: +curMath.x.toFixed(4),
            my2: +curMath.y.toFixed(4),
            isPdfCrop: true
          };
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(false);
          }
        }
        return;
      }
      // 🌟 [📦 그래프 보관 드래그 모드: 십자(+) 포인터 고정 & 가상 펜 숨김] 🌟
      if (this.isGraphSnapMode) {
        if (this.virtualStylusEl) this.virtualStylusEl.style.display = 'none';
        if (this.canvas) this.canvas.style.cursor = 'crosshair';
        if (this.isGraphSnapDragging && this.graphSnapStart) {
          const dragBox = document.getElementById('graphSnapDragBox');
          if (dragBox) {
            const x = Math.min(this.graphSnapStart.x, pos.x);
            const y = Math.min(this.graphSnapStart.y, pos.y);
            const w = Math.abs(pos.x - this.graphSnapStart.x);
            const h = Math.abs(pos.y - this.graphSnapStart.y);
            dragBox.style.left = `${x}px`;
            dragBox.style.top = `${y}px`;
            dragBox.style.width = `${w}px`;
            dragBox.style.height = `${h}px`;
          }
          const vw = Math.max(1, this.screenWidth || window.innerWidth || 1);
          const vh = Math.max(1, this.screenHeight || window.innerHeight || 1);
          const curMath = this.screenToMath(pos.x, pos.y);
          this._activeSnapDragRect = {
            x1: Math.round(this.graphSnapStart.x * 10) / 10,
            y1: Math.round(this.graphSnapStart.y * 10) / 10,
            x2: Math.round(pos.x * 10) / 10,
            y2: Math.round(pos.y * 10) / 10,
            nx1: +(this.graphSnapStart.x / vw).toFixed(4),
            ny1: +(this.graphSnapStart.y / vh).toFixed(4),
            nx2: +(pos.x / vw).toFixed(4),
            ny2: +(pos.y / vh).toFixed(4),
            mx1: +(typeof this.graphSnapStart.mathX === 'number' ? this.graphSnapStart.mathX : curMath.x).toFixed(4),
            my1: +(typeof this.graphSnapStart.mathY === 'number' ? this.graphSnapStart.mathY : curMath.y).toFixed(4),
            mx2: +curMath.x.toFixed(4),
            my2: +curMath.y.toFixed(4),
            isPdfCrop: false
          };
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(false);
          }
        }
        return;
      }

      if (this._tappingBoardSticker) {
        if (Math.hypot(pos.x - this._tappingBoardSticker.startX, pos.y - this._tappingBoardSticker.startY) > 10) {
          this._tappingBoardSticker.moved = true;
        }
        return;
      }
      if (this.isDrawingSticker && this.stickerDraftStart) {
        this.stickerDraftCurrent = { x: pos.x, y: pos.y };
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(false);
        }
        this.requestRender();
        return;
      }

      // 🌟 [필기 모드 가상 스타일러스 펜]: 랙 없는 144Hz 초고속 포인터 추종 (메뉴 위에서는 자동 숨김)
      if (this.isInkMode) {
        this.updateStylusPenPosition(pos.x, pos.y, e);
      }

      // 🌟 [초기 화면 / 캔버스 패닝 0.00ms 초고속 패스트패스]:
      // 단, 펜슬 필기 중(isDrawingInk)일 때는 절대 패닝이 필기를 가로채지 못하도록 최우선 보호!
      if (!this.isDrawingInk && !this._isTemporaryStylusEraser) {
        if (this.isPanning && this.panStart) {
          if (this.canvas.style.cursor !== 'move') {
            this.canvas.style.cursor = 'move';
          }
          if (this.inkStrokes && this.inkStrokes.length > 0) {
            this._inkBakeDirty = true;
          }
          this.panX = pos.x - this.panStart.x;
          this.panY = pos.y - this.panStart.y;
          this.snapActiveX = false;
          this.snapActiveY = false;
          this.requestRender();
          return;
        }

        if (this.isBoardPanning && this.boardPanStart) {
          this.canvas.style.cursor = 'move';
          this.boardPanX = Math.round(pos.x - this.boardPanStart.x);
          this.boardPanY = Math.round(pos.y - this.boardPanStart.y);
          this.updateProblemCardPosition(true);
          this._inkBakeDirty = true;
          this.requestRender();
          return;
        }
      }

      // 🌟 [🔤 캔버스 자유 수식 텍스트 라벨 실시간 드래그 이동 최우선 패스트패스]
      if (this.isDraggingTextLabel && this.draggedTextLabelId) {
        this.lastTextClickTime = 0;
        this.canvas.style.cursor = 'move';
        const m = this.screenToMath(pos.x, pos.y);
        const item = this.textLabels.find(t => t.id === this.draggedTextLabelId);
        if (item) {
          item.mathX = m.x + this.draggedTextOffset.dx;
          item.mathY = m.y + this.draggedTextOffset.dy;
        }
        this.requestRender();
        return;
      }

      // 🌟 [컴팩트 스테이지 리사이즈 및 이동 실시간 드래그 처리] 🌟
      if (this.isResizingStage && this.stageDragStart) {
        const stage = this.getCompactGraphStage();
        const dx = pos.x - this.stageDragStart.startX;
        const dy = pos.y - this.stageDragStart.startY;

        let newW = this.stageDragStart.initW + dx;
        let newH = this.stageDragStart.initH + dy;

        // [대표님 기획]: 꼭 정사각형에 국한되지 않고 가로길게 / 세로길게 자유 비율 지원! (Shift 누르면 1:1 비례 고정)
        if (e.shiftKey) {
          const maxDelta = Math.max(dx, dy);
          newW = this.stageDragStart.initW + maxDelta;
          newH = this.stageDragStart.initH + maxDelta;
        }

        const bPanX = this.boardPanX || 0;
        const bPanY = this.boardPanY || 0;
        stage.w = Math.max(160, Math.min(this.screenWidth - (stage.x + bPanX) - 10, newW));
        stage.h = Math.max(140, Math.min(this.screenHeight - (stage.y + bPanY) - 10, newH));
        this.canvas.style.cursor = 'nwse-resize';
        this.requestRender();
        return;
      }

      if (this.isMovingStage && this.stageDragStart) {
        const stage = this.getCompactGraphStage();
        const dx = pos.x - this.stageDragStart.startX;
        const dy = pos.y - this.stageDragStart.startY;

        const bPanX = this.boardPanX || 0;
        const bPanY = this.boardPanY || 0;
        stage.x = Math.max(16 - bPanX, Math.min(this.screenWidth - stage.w - 10 - bPanX, this.stageDragStart.initX + dx));
        stage.y = Math.max(40 - bPanY, Math.min(this.screenHeight - stage.h - 10 - bPanY, this.stageDragStart.initY + dy));

        // 스테이지 이동 시 원점(그래프)도 함께 자연스럽게 연동 이동!
        this.panX = Math.round(this.stageDragStart.initPanX + dx);
        this.panY = Math.round(this.stageDragStart.initPanY + dy);
        this._inkBakeDirty = true;
        this.canvas.style.cursor = 'move';
        this.requestRender();
        return;
      }

      // [🪢 올가미(Lasso) 툴 인터랙션]
      if (this.isInkMode && this.activeInkTool === 'lasso') {
        // 0. 모서리 핸들 드래그로 선택된 필기·도형·수식 비율 크기 조절!
        if (this.isResizingLassoSelection && this.lassoResizeStart) {
          const rs = this.lassoResizeStart;
          const initVx = rs.startCornerX - rs.anchorX;
          const initVy = rs.startCornerY - rs.anchorY;
          const curVx = pos.x - rs.anchorX;
          const curVy = pos.y - rs.anchorY;
          const denom = Math.max(100, initVx * initVx + initVy * initVy);
          const rawScale = (curVx * initVx + curVy * initVy) / denom;
          const scale = Math.max(0.22, Math.min(4.5, rawScale));

          const scaleScreenPt = (sp) => ({
            x: rs.anchorX + (sp.x - rs.anchorX) * scale,
            y: rs.anchorY + (sp.y - rs.anchorY) * scale
          });

          if (this.selectedInkStrokes && rs.strokesSnap) {
            this.selectedInkStrokes.forEach((stroke, idx) => {
              const snap = rs.strokesSnap[idx];
              if (!snap) return;
              const isBoard = (stroke.target || 'board') === 'board';
              const toScr = (pt) => isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y);
              const fromScr = (sp) => isBoard ? this.screenToBoard(sp.x, sp.y) : this.screenToMath(sp.x, sp.y);

              stroke.size = Math.max(1.0, Math.min(28.0, parseFloat(((snap.size || 4.2) * scale).toFixed(2))));

              if (snap.points && stroke.points) {
                stroke.points = snap.points.map(pt => {
                  const sp = scaleScreenPt(toScr(pt));
                  const np = fromScr(sp);
                  return { x: np.x, y: np.y, p: pt.p };
                });
              }

              if (snap.shape && stroke.shape) {
                if (snap.shape.type === 'line') {
                  stroke.shape.start = fromScr(scaleScreenPt(toScr(snap.shape.start)));
                  stroke.shape.end = fromScr(scaleScreenPt(toScr(snap.shape.end)));
                } else if (snap.shape.type === 'circle') {
                  stroke.shape.center = fromScr(scaleScreenPt(toScr(snap.shape.center)));
                  stroke.shape.radius = snap.shape.radius * scale;
                } else if (snap.shape.type === 'ellipse') {
                  stroke.shape.center = fromScr(scaleScreenPt(toScr(snap.shape.center)));
                  stroke.shape.rx = snap.shape.rx * scale;
                  stroke.shape.ry = snap.shape.ry * scale;
                } else if (snap.shape.type === 'rect') {
                  const p1 = fromScr(scaleScreenPt(toScr(snap.shape.min)));
                  const p2 = fromScr(scaleScreenPt(toScr(snap.shape.max)));
                  stroke.shape.min = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) };
                  stroke.shape.max = { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) };
                } else if (snap.shape.pts) {
                  stroke.shape.pts = snap.shape.pts.map(pt => fromScr(scaleScreenPt(toScr(pt))));
                }
              }
            });
          }

          if (this.selectedTextLabels && rs.textsSnap) {
            const curUnitScale = typeof this.getCurrentMathUnitScale === 'function' ? this.getCurrentMathUnitScale() : 90;
            this.selectedTextLabels.forEach((t, idx) => {
              const snapT = rs.textsSnap[idx];
              if (!snapT) return;
              const sp = scaleScreenPt(this.mathToScreen(snapT.mathX, snapT.mathY));
              const nm = this.screenToMath(sp.x, sp.y);
              t.mathX = nm.x;
              t.mathY = nm.y;
              t.fontSize = Math.round(Math.max(6, Math.min(96, (snapT.fontSize || 20) * scale)));
              t.baseUnitScale = snapT.baseUnitScale || curUnitScale;
            });
          }

          if (rs.lassoPointsSnap && rs.lassoPointsSnap.length > 0) {
            this.lassoPoints = rs.lassoPointsSnap.map(pt => scaleScreenPt(pt));
          }

          this.lassoBoundingBox = this.calculateStrokesBoundingBox(this.selectedInkStrokes, this.selectedTextLabels);
          this._inkBakeDirty = true;
          this.requestRender();
          return;
        }

        // 1. 선택된 필기 및 점선 루프 실시간 드래그 이동 ("점선 따라가는 걸로" 완벽 구현!)
        if (this.isDraggingLassoSelection && this.lassoDragStart) {
          const mCurrent = this.screenToMath(pos.x, pos.y);
          const deltaX = mCurrent.x - this.lassoDragStart.m.x;
          const deltaY = mCurrent.y - this.lassoDragStart.m.y;
          const deltaScreenX = pos.x - this.lassoDragStart.screenX;
          const deltaScreenY = pos.y - this.lassoDragStart.screenY;

          // (1) 필기 획 이동
          if (this.selectedInkStrokes) {
            const bz = this.boardZoom || 1.0;
            const deltaBoardX = deltaScreenX / bz;
            const deltaBoardY = deltaScreenY / bz;
            this.selectedInkStrokes.forEach(stroke => {
              const isBoard = (stroke.target || 'board') === 'board';
              if (stroke.shape) {
                if (stroke.shape.type === 'line') {
                  if (isBoard) {
                    stroke.shape.start.x += deltaBoardX; stroke.shape.start.y += deltaBoardY;
                    stroke.shape.end.x += deltaBoardX; stroke.shape.end.y += deltaBoardY;
                  } else {
                    stroke.shape.start.x += deltaX; stroke.shape.start.y += deltaY;
                    stroke.shape.end.x += deltaX; stroke.shape.end.y += deltaY;
                  }
                } else if (stroke.shape.type === 'circle' || stroke.shape.type === 'ellipse') {
                  if (isBoard) {
                    stroke.shape.center.x += deltaBoardX; stroke.shape.center.y += deltaBoardY;
                  } else {
                    stroke.shape.center.x += deltaX; stroke.shape.center.y += deltaY;
                  }
                } else if (stroke.shape.type === 'rect') {
                  if (isBoard) {
                    stroke.shape.min.x += deltaBoardX; stroke.shape.min.y += deltaBoardY;
                    stroke.shape.max.x += deltaBoardX; stroke.shape.max.y += deltaBoardY;
                  } else {
                    stroke.shape.min.x += deltaX; stroke.shape.min.y += deltaY;
                    stroke.shape.max.x += deltaX; stroke.shape.max.y += deltaY;
                  }
                } else if (stroke.shape.pts && stroke.shape.pts.length > 0) {
                  stroke.shape.pts.forEach(pt => {
                    if (isBoard) {
                      pt.x += deltaBoardX; pt.y += deltaBoardY;
                    } else {
                      pt.x += deltaX; pt.y += deltaY;
                    }
                  });
                }
              }
              if (stroke.points) {
                stroke.points.forEach(pt => {
                  if (isBoard) {
                    pt.x += deltaBoardX;
                    pt.y += deltaBoardY;
                  } else {
                    pt.x += deltaX;
                    pt.y += deltaY;
                  }
                });
              }
            });
          }

          // (2) 수식 텍스트 라벨 이동
          if (this.selectedTextLabels) {
            this.selectedTextLabels.forEach(t => {
              t.mathX += deltaX;
              t.mathY += deltaY;
            });
          }

          // (3) 🌟 올가미 점선 루프도 손을 따라 실시간 이동! ("점선 따라가는 걸로"!)
          if (this.lassoPoints && this.lassoPoints.length > 0) {
            this.lassoPoints.forEach(pt => {
              pt.x += deltaScreenX;
              pt.y += deltaScreenY;
            });
          }

          this.lassoDragStart.screenX = pos.x;
          this.lassoDragStart.screenY = pos.y;
          this.lassoDragStart.m = mCurrent;
          this.lassoBoundingBox = this.calculateStrokesBoundingBox(this.selectedInkStrokes, this.selectedTextLabels);
          this._inkBakeDirty = true;
          this.requestRender();
          return;
        }

        // 2. 올가미 점선 루프 드로잉: 점선이 펜을 따라 실시간으로 그려짐!
        if (this.isLassoSelecting) {
          this.lassoPoints.push({ x: pos.x, y: pos.y });
          if (this.isAudioRecording) {
            this._recordAudioWorkspaceStateIfNeeded(false);
          }
          this.requestRender();
          return;
        }

        // 3. 점선 루프 위 호버 시 커서 변경 (올가미 내부만 move, 바깥은 crosshair)
        const hasSelection = (this.selectedInkStrokes && this.selectedInkStrokes.length > 0) ||
          (this.selectedTextLabels && this.selectedTextLabels.length > 0);
        if (hasSelection) {
          const hitHandle = this.getLassoResizeHandleAt(pos);
          if (hitHandle) {
            this.canvas.style.cursor = (hitHandle === 'br' || hitHandle === 'tl') ? 'nwse-resize' : 'nesw-resize';
            this.canvas.classList.add('is-hover-selection');
          } else {
            const isOver = this.isPointInLassoSelection(pos);
            this.canvas.style.cursor = isOver ? 'move' : 'crosshair';
            this.canvas.classList.toggle('is-hover-selection', isOver);
          }
        }
      }

      // [✍️ 실시간 무한 칠판 필기 모드 인터랙션]
      if (this.isDrawingInk || this._isTemporaryStylusEraser) {
        const isStylusEraser = this.isStylusEraserEvent(e) || this._isTemporaryStylusEraser;
        if (this.activeInkTool === 'eraser' || isStylusEraser) {
          this.eraseInkAtPoint(pos.x, pos.y);
          this.requestRender();
          return;
        } else if (this.activeInkTool === 'laser' && this.currentMainLaserStroke) {
          const nowPerf = performance.now();
          const HOLD_MS = 1650;
          if (Array.isArray(this.mainLaserStrokes)) {
            this.mainLaserStrokes.forEach(st => {
              if (st && st.finished) st.finishedAt = nowPerf;
            });
          }
          const lastS = this.currentMainLaserStroke._lastScreen || pos;
          const stepD = Math.hypot(pos.x - lastS.x, pos.y - lastS.y);
          if (stepD >= 1.2) {
            const sx = lastS.x * 0.22 + pos.x * 0.78;
            const sy = lastS.y * 0.22 + pos.y * 0.78;
            this.currentMainLaserStroke._lastScreen = { x: sx, y: sy };
            const isBoardTarget = Boolean(this.currentMainLaserStroke.isBoard);
            const coord = isBoardTarget ? this.screenToBoard(sx, sy) : this.screenToMath(sx, sy);
            this.currentMainLaserStroke.points.push({ x: coord.x, y: coord.y, t: nowPerf });
            const recTMove = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
            if (recTMove !== undefined) {
              if (this.currentMainLaserStroke._recLaserStroke) {
                const rls = this.currentMainLaserStroke._recLaserStroke;
                rls.tEnd = recTMove;
                rls.holdUntil = recTMove + HOLD_MS;
                rls.points.push({ x: coord.x, y: coord.y, t: recTMove });
              }
              if (Array.isArray(this.audioLaserStrokes)) {
                this.audioLaserStrokes.forEach(ls => {
                  if (ls && ls.cardKey === 'main_canvas' && typeof ls.holdUntil === 'number' && recTMove <= ls.holdUntil + 200) {
                    ls.holdUntil = recTMove + HOLD_MS;
                  }
                });
              }
              this.recordAudioCursorPoint(sx, sy, '#dc2626', true, { isLaser: true, cursorKind: 'laser' });
            }
            this._ensureMainLaserLoop();
          }
          return;
        } else if (this.currentInkStroke) {
          // 🌟 Draw & Hold 기하 도형 인식 완료 상태에서 홀드 드래그 중: 동적 크기/각도 실시간 조절!
          if (this._inkHoldDetected && this.currentInkStroke.shape) {
            this._updateHeldShape(pos);
            this.requestRender();
            return;
          }

          // 🌟 [홀드 감지 정밀 앵커링]:
          // 작은 글씨(`3`, `ㄴ` 등)를 쓰는 도중에는 홀드 타이머가 확실히 리셋되도록 이동 임계값을 낮추고(stepDist > 1.5 || dHold > 5),
          // 완전히 멈춘 상태에서의 미세한 손떨림(stepDist <= 1.5px & dHold <= 5px)만 무시합니다!
          const prevMovePos = this._lastMoveEventScreenPos || pos;
          const stepDist = Math.hypot(pos.x - prevMovePos.x, pos.y - prevMovePos.y);
          this._lastMoveEventScreenPos = { x: pos.x, y: pos.y };
          if (this._inkHoldLastScreenPos) {
            const dHold = Math.hypot(pos.x - this._inkHoldLastScreenPos.x, pos.y - this._inkHoldLastScreenPos.y);
            if (stepDist > 1.5 || dHold > 5) {
              this._inkHoldLastScreenPos = { x: pos.x, y: pos.y };
              this._lastSignificantMoveTime = Date.now();
              if (!this._inkHoldTimer) {
                this._startInkHoldTimer();
              }
            }
          }

          // 🌟 [PC(액정타블렛·전자칠판) vs 아이패드(iPadOS WebKit) 이원화 샘플 수집 + 1차 EMA 스트림라인]:
          // - PC: 200~240Hz getCoalescedEvents() 중간 샘플 정식 수집으로 빠른 원 다각형 각짐 원천 해결
          // - 아이패드: 오염된 WebKit getCoalescedEvents()를 배제하고 단일 확정 이벤트([e]) + 역주행 차단을 적용해 원 2줄 현상 및 직선 굵기 꿀렁임 해결
          const inkProfile = this.getDeviceInkProfile();
          let events = [e];
          if (inkProfile.useCoalescedEvents && typeof e.getCoalescedEvents === 'function') {
            const coalesced = e.getCoalescedEvents();
            if (coalesced && coalesced.length > 0) {
              events = coalesced;
            }
          }
          const minRawDist = (e.pointerType === 'pen') ? inkProfile.minRawDistPen : inkProfile.minRawDistMouse;
          const prevInkPos = this._lastInkScreenPos || { x: pos.x, y: pos.y };
          const frameDx = pos.x - prevInkPos.x;
          const frameDy = pos.y - prevInkPos.y;
          const frameDist = Math.hypot(frameDx, frameDy);

          let addedPoints = 0;
          for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            const evTs = (typeof ev.timeStamp === 'number' && ev.timeStamp > 0) ? ev.timeStamp : 0;
            if (evTs > 0) {
              if (events.length > 1 && typeof this._lastInkSampleTs === 'number' && evTs <= this._lastInkSampleTs) {
                continue;
              }
              this._lastInkSampleTs = evTs;
            }
            const pPos = (ev === e && events.length === 1) ? pos : getPos(ev);

            // 다중 coalesced 샘플(PC)일 때 이전 프레임 중복/역주행 점 스킵
            if (events.length > 1 && i < events.length - 1 && frameDist > 1.5) {
              const curSaving = this._lastInkScreenPos || prevInkPos;
              const stepVx = pPos.x - curSaving.x;
              const stepVy = pPos.y - curSaving.y;
              if (stepVx * frameDx + stepVy * frameDy <= 0) continue;
            }

            const lastRaw = this._lastRawInkScreenPos;
            if (lastRaw) {
              const rawDist = Math.hypot(pPos.x - lastRaw.x, pPos.y - lastRaw.y);
              if (rawDist < minRawDist) continue;

              // 🛡️ [역주행 점프 컷오프 (Monotonic Forward Guard)]:
              // 진행 방향 대비 뒤로 튀는 패킷(cosAngle < forwardGuardMinCos)을 폐기하여 원 2줄 겹침 및 직선 왕복 두꺼워짐 차단
              if (this._prevRawInkScreenPos && rawDist < inkProfile.forwardGuardMaxDist) {
                const vxPrev = lastRaw.x - this._prevRawInkScreenPos.x;
                const vyPrev = lastRaw.y - this._prevRawInkScreenPos.y;
                const vxNew = pPos.x - lastRaw.x;
                const vyNew = pPos.y - lastRaw.y;
                const lenPrev = Math.hypot(vxPrev, vyPrev);
                if (lenPrev > 0.5) {
                  const cosAngle = (vxPrev * vxNew + vyPrev * vyNew) / (lenPrev * rawDist);
                  if (cosAngle < inkProfile.forwardGuardMinCos) {
                    continue;
                  }
                }
              }
            }
            this._prevRawInkScreenPos = lastRaw ? { x: lastRaw.x, y: lastRaw.y } : { x: pPos.x, y: pPos.y };
            this._lastRawInkScreenPos = { x: pPos.x, y: pPos.y };

            let sx = pPos.x;
            let sy = pPos.y;
            const liveLen = this._liveBezierScreenPts ? this._liveBezierScreenPts.length : 0;

            // 🌟 [기기별 맞춤 1차 EMA 스트림라인 (PC: 0.18 / 아이패드: 0.22, 고속 구간 0으로 자연 감쇠)]:
            if (!this.currentInkStroke.isHighlighter && liveLen >= 1) {
              const pPrev = this._liveBezierScreenPts[liveLen - 1];
              const stepD = Math.hypot(pPos.x - pPrev.x, pPos.y - pPrev.y);
              const weight = inkProfile.streamlineWeight * Math.max(0, 1 - stepD / inkProfile.streamlineDecayDist);
              if (weight > 0.005) {
                sx = pPos.x * (1 - weight) + pPrev.x * weight;
                sy = pPos.y * (1 - weight) + pPrev.y * weight;
              }
            }
            this._lastInkScreenPos = { x: sx, y: sy };

            let rawPressure = 0.5;
            if (typeof ev.pressure === 'number' && ev.pressure > 0) {
              rawPressure = ev.pressure;
              if (Math.abs(rawPressure - 0.5) > 0.01) {
                this._strokeHasRealPressure = true;
              }
            }
            const moveStepDist = lastRaw ? Math.hypot(pPos.x - lastRaw.x, pPos.y - lastRaw.y) : 0;
            const curPenStyle = (this.currentInkStroke && this.currentInkStroke.penStyle) || this.inkPenStyle || 'ballpen';
            const ptCount = this.currentInkStroke && this.currentInkStroke.points ? this.currentInkStroke.points.length : 1;
            const dtMs = (evTs > 0 && typeof this._lastInkAcceptedTs === 'number' && this._lastInkAcceptedTs > 0)
              ? (evTs - this._lastInkAcceptedTs)
              : null;
            if (evTs > 0) this._lastInkAcceptedTs = evTs;
            const pressure = this.computeDynamicStrokePressure(
              rawPressure,
              this._strokeHasRealPressure,
              moveStepDist,
              curPenStyle,
              this._lastPressure,
              ptCount,
              0,
              dtMs
            );
            this._lastPressure = pressure;
            const recTMove = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
            if (recTMove !== undefined) {
              this.currentInkStroke.tEnd = recTMove;
              this.recordAudioCursorPoint(sx, sy, this.currentInkStroke.color, true);
            }

            if (!this._liveBezierScreenPts) {
              this._liveBezierScreenPts = [];
            }

            if (this.currentInkStroke.target === 'graph') {
              const m = this.screenToMath(sx, sy);
              this.currentInkStroke.points.push({ x: m.x, y: m.y, p: pressure, t: recTMove });
            } else {
              const bPt = this.screenToBoard(sx, sy);
              this.currentInkStroke.points.push({ x: bPt.x, y: bPt.y, p: pressure, t: recTMove });
            }
            addedPoints++;

            this._liveBezierScreenPts.push({ x: sx, y: sy, p: pressure });

            if (!this.currentInkStroke.isHighlighter) {
              this.drawLiveBezierStep(this._liveBezierScreenPts, this.currentInkStroke, false);
            }
          }
          // 일반 펜 필기 중에는 전체 화면 재렌더링(requestRender)을 호출하지 않아 2360x1640 캔버스 복사 부하가 0.0%입니다!
          if (addedPoints > 0 && this.currentInkStroke.isHighlighter) {
            this.requestRender();
          }
        }
        return;
      }

      // [🔤 캔버스 자유 수식 텍스트 라벨 실시간 드래그 이동]
      if (this.isDraggingTextLabel && this.draggedTextLabelId) {
        this.lastTextClickTime = 0;
        this.canvas.style.cursor = 'move';
        const m = this.screenToMath(pos.x, pos.y);
        const item = this.textLabels.find(t => t.id === this.draggedTextLabelId);
        if (item) {
          item.mathX = m.x + this.draggedTextOffset.dx;
          item.mathY = m.y + this.draggedTextOffset.dy;
        }
        this.requestRender();
        return;
      }

      // [✂️ N-구간 다중 분할선 드래그 & 교점 마그네틱 자석 스냅 🧲]
      if (this.activePwDragIdx !== null && this.piecewiseBoundaries) {
        this.canvas.style.cursor = 'ew-resize';
        const currM = this.screenToMath(pos.x, pos.y);
        let newX = currM.x;

        // 인접 분할선 간 최소 간격 유지 (순서 보존 0.25 pt)
        const idx = this.activePwDragIdx;
        const minX = idx > 0 ? this.piecewiseBoundaries[idx - 1] + 0.25 : -this.xSpan * 2;
        const maxX = idx < this.piecewiseBoundaries.length - 1 ? this.piecewiseBoundaries[idx + 1] - 0.25 : this.xSpan * 2;
        newX = Math.max(minX, Math.min(maxX, newX));

        // 교점 자동 자석 스냅 (Alt키 누르면 연속 아날로그)
        this.snappedPoints = [];
        if (!e.altKey && this.graphs.length >= 2) {
          const leftIdx = (this.piecewiseFuncMap && this.piecewiseFuncMap[idx] !== undefined) ? this.piecewiseFuncMap[idx] : 0;
          const rightIdx = (this.piecewiseFuncMap && this.piecewiseFuncMap[idx + 1] !== undefined) ? this.piecewiseFuncMap[idx + 1] : 1;
          const gLeft = this.graphs[leftIdx] || this.graphs[0];
          const gRight = this.graphs[rightIdx] || this.graphs[1];

          const roots = (gLeft && gRight && gLeft !== gRight)
            ? this.engine.findIntersections(gLeft, gRight, { xmin: -15, xmax: 15 }, null)
            : [];

          if (roots && roots.length > 0) {
            const effSpanX = this.xSpan / this.zoomLevel;
            const unitScaleX = this.screenWidth / (effSpanX * 2);
            const snapDistMath = 14 / unitScaleX; // 약 14px 허용치

            let closestRoot = null;
            let minDiff = Infinity;
            roots.forEach(r => {
              if (r.x >= minX && r.x <= maxX) {
                const diff = Math.abs(r.x - newX);
                if (diff < snapDistMath && diff < minDiff) {
                  minDiff = diff;
                  closestRoot = r;
                }
              }
            });

            if (closestRoot !== null) {
              newX = closestRoot.x;
              this.snappedPoints.push({
                x: closestRoot.x,
                y: closestRoot.y,
                isContinuity: true,
                label: '교점 스냅'
              });
            }
          }
        }

        newX = parseFloat(newX.toFixed(2));
        this.piecewiseBoundaries[idx] = newX;
        if (idx === 0) this.pwK = newX;

        this.updatePwDescBadge();
        this.requestRender();
        return;
      }

      if (this.draggedHandleIdx !== null) {
        if (this.curveContextBar && !this.curveContextBar.classList.contains('dimmed')) {
          this.curveContextBar.classList.add('dimmed');
        }
        this.canvas.style.cursor = 'pointer';
        // 활성 그래프 핸들 개별 드래그
        let m = this.screenToMath(pos.x, pos.y);
        this.axisSnapActiveX = false;
        this.axisSnapActiveY = false;
        this.snappedPoints = [];

        // [대표님 기획: 🧲 스마트 마그네틱 자석 스냅 - 핸들 자체 x축/y축 찰칵!]
        if (this.useMagneticSnap && !e.altKey) {
          const effSpanY = this.ySpan / this.zoomLevel;
          const unitScale = (this.screenHeight / 2) / effSpanY;
          const snapDistMath = 11 / unitScale;

          // X축 (y=0) 스냅 (x축이 표시되어 있을 때만 반응)
          let snappedY = false;
          if (this.showXAxis !== false) {
            // 1) 기본: 드래그 중인 핸들 자체가 x축에 닿을 때 (극대점 자체 접함)
            if (Math.abs(m.y) < snapDistMath) {
              m.y = 0.0;
              this.axisSnapActiveY = true;
              this.snappedPoints.push({ x: m.x, y: 0.0, label: 'x축 밀착' });
              snappedY = true;
            }

            // 2) [대표님 핵심 기획]: 사차함수 중앙 극대점(idx=1) 평행이동 시 극소점이 x축(y=0)에 닿을 때 찰칵 자석 스냅!
            const g = this.activeGraph;
            if (!snappedY && g && g.type === '4th_symmetric' && this.draggedHandleIdx === 1 && g.handles.length >= 3) {
              const deltaY = g.handles[1].y - g.handles[0].y; // 극대-극소 높이차
              if (Math.abs(m.y - deltaY) < snapDistMath) {
                m.y = deltaY;
                this.axisSnapActiveY = true;
                let ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
                const dx = m.x - (g.handles[1].x + ox);
                this.snappedPoints.push({ x: g.handles[0].x + ox + dx, y: 0.0, isContinuity: true, label: '극소 x축 접함' });
                this.snappedPoints.push({ x: g.handles[2].x + ox + dx, y: 0.0, isContinuity: true, label: '극소 x축 접함' });
                snappedY = true;
              }
            }
          }

          // Y축 (x=0) 스냅 (y축이 표시되어 있을 때만 반응)
          if (this.showYAxis !== false && Math.abs(m.x) < snapDistMath) {
            m.x = 0.0;
            this.axisSnapActiveX = true;
            this.snappedPoints.push({ x: 0.0, y: m.y, label: 'y축 밀착' });
          }
        }

        let ox = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.x === 'number') ? this.activeGraph.freezeOffset.x : 0;
        let oy = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.y === 'number') ? this.activeGraph.freezeOffset.y : 0;
        if (this.activeGraph.transforms && this.activeGraph.transforms.length > 0) {
          for (const t of this.activeGraph.transforms) {
            if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
            if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
          }
        }
        this.dragActiveHandle(this.draggedHandleIdx, m.x - ox, m.y - oy, e.altKey);
        if (this.activeGraph && this.activeGraph.isAbsolute && this.activeGraph.isAbsPristine) {
          this.activeGraph.isAbsPristine = false;
          this.syncCurveContextBar();
          this.syncControls();
        }
        this.requestRender();
      } else if ((this.isDraggingCurve || (this.curveDragStart && this.curveHandlesSnapshot && this._curveDragEligible)) && this.curveHandlesSnapshot) {
        // 🌟 [대표님 핵심 기획]: 터치하자마자 미끄러지지 않도록, 이미 선택된 상태에서 6px 이상 확실히 끌었을 때만 드래그 시작!
        if (!this.isDraggingCurve && this.curveDragStart && this._curveDragEligible) {
          const dMove = Math.hypot(pos.x - (this.curveDragStart.startScreenX || pos.x), pos.y - (this.curveDragStart.startScreenY || pos.y));
          if (dMove >= 6) {
            this.isDraggingCurve = true;
            if (this.curveContextBar && !this.curveContextBar.classList.contains('dimmed')) {
              this.curveContextBar.classList.add('dimmed');
            }
          }
        }

        if (this.isDraggingCurve && this.curveDragStart) {
          this.canvas.style.cursor = 'move'; // 곡선 몸통 평행이동 십자화살표 ✥
          // 활성 곡선 통째로 평행이동!
          const currM = this.screenToMath(pos.x, pos.y);
          let deltaX = currM.x - this.curveDragStart.mx;
          let deltaY = currM.y - this.curveDragStart.my;

          this.axisSnapActiveX = false;
          this.axisSnapActiveY = false;
          this.snapActiveX = false;
          this.snapActiveY = false;
          this.snappedPoints = [];

          // [대표님 기획: 🧲 극점·변곡점·점근선 x축/y축 닿는대로 척척 달라붙는 마그네틱 스냅! (단, 구간잠금 통째 이동 시에는 개별 스냅 제외)]
          const isPwGroupDragMove = Boolean(this.usePiecewise && this.isPiecewiseLocked && this.activeGraph && !this.activeGraph.isIndependent);
          if (this.useMagneticSnap && !e.altKey && !isPwGroupDragMove) {
            const effSpanY = this.ySpan / this.zoomLevel;
            const unitScale = (this.screenHeight / 2) / effSpanY;
            const snapDistMath = 11 / unitScale;

            // 🚀 [초고속 캐시]: 드래그 중 매 프레임 수치해석 재계산 제거
            const feats = this.curveFeatsSnapshot || this.getGraphFeaturePoints({
              type: this.activeGraph.type,
              handles: this.curveHandlesSnapshot,
              isAbsolute: this.activeGraph.isAbsolute,
              freezeOffset: this.activeGraph.freezeOffset,
              transforms: this.activeGraph.transforms
            });

            // 1. Y축 스냅 (x=0 축 스냅 — y축이 표시되어 있을 때만 반응)
            let bestCandidateX = null;
            let minDiffX = Infinity;

            if (this.showYAxis !== false) {
              const allXCandidates = [
                ...feats.pts.map(p => ({ x: p.x, label: p.label, origY: p.y })),
                ...feats.asymX.map(ax => ({ x: ax, label: '점근선', origY: 0 }))
              ];

              allXCandidates.forEach(cand => {
                const proposedX = cand.x + deltaX;
                const diff = Math.abs(proposedX - 0); // x=0 과의 거리
                if (diff < snapDistMath && diff < minDiffX) {
                  minDiffX = diff;
                  bestCandidateX = { ...cand, snapDeltaX: -cand.x };
                }
              });
            }

            if (bestCandidateX) {
              deltaX = bestCandidateX.snapDeltaX;
              this.axisSnapActiveX = true;
              this.snappedPoints.push({
                x: 0,
                y: (bestCandidateX.origY !== undefined ? bestCandidateX.origY + deltaY : 0),
                label: `${bestCandidateX.label} y축 일치`
              });
            } else if (this.useViewfinder) {
              // Y축 스냅이 안 걸렸다면 캡처영역 중앙선 스냅 검사
              let symmetryCenterXMath = this.curveHandlesSnapshot[0].x;
              const g = this.activeGraph;
              if (g.type === '2nd_quadratic') symmetryCenterXMath = this.curveHandlesSnapshot[0].x;
              else if (g.type === '3rd_normal' && this.curveHandlesSnapshot.length >= 2) symmetryCenterXMath = (this.curveHandlesSnapshot[0].x + this.curveHandlesSnapshot[1].x) / 2.0;
              else if (g.type === '4th_symmetric' && this.curveHandlesSnapshot.length >= 2) symmetryCenterXMath = this.curveHandlesSnapshot[1].x;
              else if (g.type === 'rational_basic') symmetryCenterXMath = this.curveHandlesSnapshot[0].x;

              const proposedCenterX = this.mathToScreen(symmetryCenterXMath + deltaX, 0).x;
              const targetScreenX = this.screenWidth / 2;
              if (Math.abs(proposedCenterX - targetScreenX) < 11) {
                const snappedCenterMath = this.screenToMath(targetScreenX, 0).x;
                deltaX = snappedCenterMath - symmetryCenterXMath;
                this.snapActiveX = true;
              }
            }

            // 2. X축 스냅 (y=0 축 스냅 — x축이 표시되어 있을 때만 반응)
            let bestCandidateY = null;
            let minDiffY = Infinity;

            if (this.showXAxis !== false) {
              const allYCandidates = [
                ...feats.pts.map(p => ({ y: p.y, label: p.label, origX: p.x })),
                ...feats.asymY.map(ay => ({ y: ay, label: '점근선', origX: 0 }))
              ];

              allYCandidates.forEach(cand => {
                const proposedY = cand.y + deltaY;
                const diff = Math.abs(proposedY - 0); // y=0 과의 거리
                if (diff < snapDistMath && diff < minDiffY) {
                  minDiffY = diff;
                  bestCandidateY = { ...cand, snapDeltaY: -cand.y };
                }
              });
            }

            if (bestCandidateY) {
              deltaY = bestCandidateY.snapDeltaY;
              this.axisSnapActiveY = true;
              this.snappedPoints.push({
                x: (bestCandidateY.origX !== undefined ? bestCandidateY.origX + deltaX : 0),
                y: 0,
                label: `${bestCandidateY.label} x축 접함`
              });
            }

            // 3. [대표님 킬러 기획: ✂️ 구간 분할 경계선 연속(Continuity) 체결 자석 스냅 🧲]
            // 활성 함수를 위아래(또는 평행이동)로 움직일 때, 인접 구간 함수와 분할선 위치에서 높이가 같아지는(연속이 되는) 순간 자석처럼 찰칵 체결!
            if (this.usePiecewise && !this.isPiecewiseLocked && this.graphs.length >= 2 && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0 && !this.activeGraph.isIndependent) {
              const currIdx = this.activeGraphIdx;
              const boundaries = this.piecewiseBoundaries;
              const funcMap = this.piecewiseFuncMap || [];

              let bestContinuityY = null;
              let minDiffCont = Infinity;
              let snappedB = null;
              let snappedTargetY = null;

              for (let bIdx = 0; bIdx < boundaries.length; bIdx++) {
                const b = boundaries[bIdx];
                const leftIdx = funcMap[bIdx] !== undefined ? funcMap[bIdx] : 0;
                const rightIdx = funcMap[bIdx + 1] !== undefined ? funcMap[bIdx + 1] : 1;

                let partnerIdx = null;
                if (currIdx === leftIdx && rightIdx !== currIdx) {
                  partnerIdx = rightIdx;
                } else if (currIdx === rightIdx && leftIdx !== currIdx) {
                  partnerIdx = leftIdx;
                }

                if (partnerIdx !== null && this.graphs[partnerIdx]) {
                  const partnerGraph = this.graphs[partnerIdx];
                  const partnerY = this.engine.evaluatePipeline(partnerGraph, b);

                  if (!isNaN(partnerY) && isFinite(partnerY)) {
                    // 현재 활성 그래프가 x축 이동 deltaX를 반영했을 때 x=b에서의 기준 Y값
                    const tempGraphX = {
                      ...this.activeGraph,
                      handles: this.curveHandlesSnapshot.map(h => ({ ...h, x: h.x + deltaX })),
                      freezeOffset: this.curveFreezeStart ? {
                        x: (this.curveFreezeStart.ox || 0) + deltaX,
                        y: (this.curveFreezeStart.oy || 0)
                      } : { x: deltaX, y: 0 }
                    };
                    const currBaseY = this.engine.evaluatePipeline(tempGraphX, b);

                    if (!isNaN(currBaseY) && isFinite(currBaseY)) {
                      const neededDeltaY = partnerY - currBaseY;
                      const diff = Math.abs(deltaY - neededDeltaY);

                      // 연속 체결 스냅은 강사의 가장 중요한 목표이므로 넉넉한 자석 손맛(16px 허용) 제공
                      const contSnapDist = snapDistMath * 1.45;
                      if (diff < contSnapDist && diff < minDiffCont) {
                        minDiffCont = diff;
                        bestContinuityY = neededDeltaY;
                        snappedB = b;
                        snappedTargetY = partnerY;
                      }
                    }
                  }
                }
              }

              if (bestContinuityY !== null) {
                deltaY = bestContinuityY;
                this.axisSnapActiveY = true;
                this.snappedPoints = [{
                  x: snappedB,
                  y: snappedTargetY,
                  isContinuity: true,
                  label: '연속 결합'
                }];
              }
            }
          }

          // 🌟 [대표님 핵심 기획: 구간 잠금(🔒) 상태에서 함수 그래프를 잡고 끌면 경계선 + 모든 구간 참여 함수가 한 몸으로 통째 평행이동!] 🌟
          if (this.usePiecewise && this.isPiecewiseLocked && this.activeGraph && !this.activeGraph.isIndependent && this._pwGroupBoundariesSnapshot && this._pwGroupGraphsSnapshot) {
            this.piecewiseBoundaries = this._pwGroupBoundariesSnapshot.map(b => parseFloat((b + deltaX).toFixed(4)));
            if (this.piecewiseBoundaries.length > 0) {
              this.pwK = this.piecewiseBoundaries[0];
            }
            this.graphs.forEach((gItem, gIdx) => {
              if (!gItem || gItem.isIndependent) return;
              const snap = this._pwGroupGraphsSnapshot[gIdx];
              if (!snap) return;
              const gHasTransforms = gItem.isAbsolute || (gItem.transforms && gItem.transforms.length > 0) || gItem.isFrozen || snap.ox !== 0 || snap.oy !== 0;
              if (gHasTransforms) {
                if (!gItem.freezeOffset) gItem.freezeOffset = { x: 0, y: 0 };
                gItem.freezeOffset.x = Math.round((snap.ox + deltaX) * 100) / 100;
                gItem.freezeOffset.y = Math.round((snap.oy + deltaY) * 100) / 100;
              } else if (gItem.handles && snap.handles) {
                gItem.handles.forEach((h, hIdx) => {
                  if (snap.handles[hIdx]) {
                    h.x = snap.handles[hIdx].x + deltaX;
                    h.y = snap.handles[hIdx].y + deltaY;
                  }
                });
              }
            });
            this.updatePwDescBadge();
            this.requestRender();
            return;
          }

          const isShiftDrag = !!e.shiftKey;
          const ox = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.x === 'number') ? this.activeGraph.freezeOffset.x : 0;
          const oy = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.y === 'number') ? this.activeGraph.freezeOffset.y : 0;
          const hasTransforms = this.activeGraph.isAbsolute || (this.activeGraph.transforms && this.activeGraph.transforms.length > 0) || this.activeGraph.isFrozen || ox !== 0 || oy !== 0;

          if (isShiftDrag && this.activeGraph.isAbsolute) {
            // 💡 [Shift + 몸통 드래그]: 원함수 내부 핸들 이동 ➔ 실시간 접힘 모핑! (|f(x)-k|)
            this.activeGraph.handles.forEach((h, idx) => {
              h.x = this.curveHandlesSnapshot[idx].x + deltaX;
              h.y = this.curveHandlesSnapshot[idx].y + deltaY;
            });
            if (this.activeGraph.isAbsPristine && (Math.abs(deltaX) > 0.05 || Math.abs(deltaY) > 0.05)) {
              this.activeGraph.isAbsPristine = false;
              this.syncCurveContextBar();
              this.syncControls();
            }
            this.showShiftMorphHint();
          } else if (hasTransforms) {
            // 🚀 [기본 몸통 드래그]: 보이는 개형 그대로 통째 평행이동! (|f(x)| - k)
            if (!this.activeGraph.freezeOffset) this.activeGraph.freezeOffset = { x: 0, y: 0 };
            const initOx = (this.curveFreezeStart && typeof this.curveFreezeStart.ox === 'number') ? this.curveFreezeStart.ox : 0;
            const initOy = (this.curveFreezeStart && typeof this.curveFreezeStart.oy === 'number') ? this.curveFreezeStart.oy : 0;
            const newOx = Math.round((initOx + deltaX) * 100) / 100;
            const newOy = Math.round((initOy + deltaY) * 100) / 100;
            if (this.activeGraph.freezeOffset.x !== newOx || this.activeGraph.freezeOffset.y !== newOy) {
              this.activeGraph.freezeOffset.x = newOx;
              this.activeGraph.freezeOffset.y = newOy;
              // 🌟 [대표님 기획]: 절댓값 씌운 그래프를 움직이는 순간 상단 절댓값 테두리/색상 해제!
              if (this.activeGraph.isAbsolute && this.activeGraph.isAbsPristine) {
                this.activeGraph.isAbsPristine = false;
                this.syncCurveContextBar();
                this.syncControls();
              }
            }

            // 🔗 [역함수 대칭 연동: dx ↔ dy 스왑 평행이동]
            const partner = this.getLinkedPartner(this.activeGraph);
            if (partner && this.partnerFreezeStart) {
              if (!partner.freezeOffset) partner.freezeOffset = { x: 0, y: 0 };
              partner.freezeOffset.x = Math.round((this.partnerFreezeStart.ox + deltaY) * 100) / 100;
              partner.freezeOffset.y = Math.round((this.partnerFreezeStart.oy + deltaX) * 100) / 100;
            }
          } else if (this.isShapeCenterLocked(this.activeGraph)) {
            this.showCenterLockHint(); // 원점 중심 고정 중에는 통째 이동 불가
          } else {
            // 일반 함수: 핸들 전체 평행이동
            this.activeGraph.handles.forEach((h, idx) => {
              h.x = this.curveHandlesSnapshot[idx].x + deltaX;
              h.y = this.curveHandlesSnapshot[idx].y + deltaY;
            });

            // 🔗 [역함수 대칭 연동: 일반 함수 핸들 dx ↔ dy 스왑 평행이동]
            const partner = this.getLinkedPartner(this.activeGraph);
            if (partner && this.partnerHandlesSnapshot) {
              partner.handles.forEach((h, idx) => {
                if (this.partnerHandlesSnapshot[idx]) {
                  h.x = this.partnerHandlesSnapshot[idx].x + deltaY;
                  h.y = this.partnerHandlesSnapshot[idx].y + deltaX;
                }
              });
            }
          }
          // 🚀 [초고속 최적화]: 드래그 중 매 픽셀마다 DOM 전체를 뒤지던 syncControls 제거! handleUp에서 1회 수행
          this.requestRender();
        }
      } else if (this.isResizingVf && this.vfResizeStart) {
        // 모서리 드래그로 뷰파인더 화면 고정 크기(vfScreenW) 실시간 조절
        const deltaX = pos.x - this.vfResizeStart.startX;
        const deltaY = pos.y - this.vfResizeStart.startY;

        let deltaW = 0;
        // 각 코너별 당기는 방향에 맞게 자연스러운 크기 변화 (바깥쪽으로 당기면 커짐)
        if (this.vfResizeStart.corner === 'br') {
          deltaW = deltaX * 2;
        } else if (this.vfResizeStart.corner === 'tr') {
          deltaW = deltaX * 2;
        } else if (this.vfResizeStart.corner === 'tl') {
          deltaW = -deltaX * 2;
        } else if (this.vfResizeStart.corner === 'bl') {
          deltaW = -deltaX * 2;
        }

        const newW = Math.max(220, Math.min(this.screenWidth - 40, this.vfResizeStart.startW + deltaW));
        this.vfScreenW = Math.round(newW);

        const sl = document.getElementById('sliderVfWidth');
        if (sl) sl.value = this.vfScreenW;
        const lbl = document.getElementById('lblVfWidth');
        if (lbl) lbl.textContent = `${this.vfScreenW} px`;
        this.requestRender();
      } else if (this.isPanning) {
        this.canvas.style.cursor = 'move';
        this._inkBakeDirty = true;
        // [대표님 요청: 화면 전체 이동 시 중앙 걸림/덜그럭거림(센터 마그네틱 랙) 완전 제거 - 1:1 무저항 부드러운 패닝]
        this.panX = pos.x - this.panStart.x;
        this.panY = pos.y - this.panStart.y;
        this.snapActiveX = false;
        this.snapActiveY = false;
        this.requestRender();
      } else {
        // [✂️ 구간 분할 경계선 및 영역 칩 호버 커서 제어]
        const canManipulatePw = (!this.isInkMode || this.activeInkTool === 'select');
        let isOverPwBoundary = false;
        let isOverPwChip = false;
        let isOverPwToggle = false;
        let isOverPwPeriod = false;
        if (canManipulatePw && this.usePiecewise && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) {
          if (this.pwPeriodBracketBadge) {
            const p = this.pwPeriodBracketBadge;
            isOverPwPeriod = (pos.x >= p.pillX && pos.x <= p.pillX + p.pillW &&
              pos.y >= p.pillY && pos.y <= p.pillY + p.pillH);
          }
          if (this.pwBoundaryBadges) {
            var isOverPwLock = this.pwBoundaryBadges.some(b =>
              b.lockRect && pos.x >= b.lockRect.x - 2 && pos.x < b.sx &&
              pos.y >= b.lockRect.y - 2 && pos.y <= b.lockRect.y + b.lockRect.h + 2
            );
            var isOverPwDel = this.pwBoundaryBadges.some(b =>
              b.delRect && pos.x >= b.sx && pos.x <= b.delRect.x + b.delRect.w + 2 &&
              pos.y >= b.delRect.y - 2 && pos.y <= b.delRect.y + b.delRect.h + 2
            );
            isOverPwToggle = !this.isPiecewiseLocked && this.pwBoundaryBadges.some(b =>
              b.toggleRect && pos.x >= b.toggleRect.x - 2 && pos.x <= b.toggleRect.x + b.toggleRect.w + 2 &&
              pos.y >= b.toggleRect.y && pos.y <= b.toggleRect.y + b.toggleRect.h + 2
            );
            isOverPwBoundary = !this.isPiecewiseLocked && !isOverPwLock && !isOverPwDel && !isOverPwToggle &&
              this.pwBoundaryBadges.some(b => Math.abs(pos.x - b.sx) <= 22);
          }
          if (this.pwRegionBadges) {
            isOverPwChip = this.pwRegionBadges.some(r =>
              pos.x >= r.chipX && pos.x <= r.chipX + r.chipW &&
              pos.y >= r.chipY && pos.y <= r.chipY + r.chipH
            );
          }
        }

        // 호버 커서 제어: 핸들러 조절점 위 (필기 도구 활성 시에는 100% 동결/스킵)
        const canManipulateHandles = (!this.isInkMode || this.activeInkTool === 'select');
        let isOverHandle = false;
        if (canManipulateHandles && this.isCurveSelected && this.activeGraph && this.activeGraph.handles) {
          let ox = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.x === 'number') ? this.activeGraph.freezeOffset.x : 0;
          let oy = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.y === 'number') ? this.activeGraph.freezeOffset.y : 0;
          if (this.activeGraph.transforms && this.activeGraph.transforms.length > 0) {
            for (const t of this.activeGraph.transforms) {
              if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
              if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
            }
          }
          this.activeGraph.handles.forEach(h => {
            if (h.hidden) return;
            let targetY = h.y;
            if (this.activeGraph.isAbsolute && ["max", "min", "point", "vertex", "inflection"].includes(h.type)) {
              targetY = Math.abs(h.y);
            }
            let evalY = (h.type === 'center' || h.type === 'asymptote')
              ? (targetY + oy)
              : this.engine.evaluatePipeline(this.activeGraph, h.x + ox);
            if (isNaN(evalY) || !isFinite(evalY)) {
              evalY = targetY + oy;
            }
            const s = this.mathToScreen(h.x + ox, evalY);
            if (Math.hypot(s.x - pos.x, s.y - pos.y) <= 18) {
              isOverHandle = true;
            }
          });
        }

        // 호버 커서 제어: 그래프 곡선 몸통 위 (필기 도구 사용 중에는 곡선 호버 비활성화)
        const hoveredCurveIdx = (canManipulateHandles && this.graphs && this.graphs.length > 0) ? this.hitTestAllCurves(pos, false) : null;
        const isOverCurve = (hoveredCurveIdx !== null);

        // [🔤 캔버스 자유 수식 텍스트 라벨: 호버 감지]
        const hitText = (this.textLabels && this.textLabels.length > 0) ? this.hitTestTextLabel(pos) : null;
        const newTextId = hitText ? hitText.id : null;
        if (newTextId !== this.hoverTextLabelId) {
          this.hoverTextLabelId = newTextId;
          this.requestRender();
        }

        // [📍 교재 보조 수선: 가위 ✂️ 호버 감지 (수선 모드일 때만 활성화)]
        const overScissors = this.isDropLineMode ? this.hitTestScissors(pos) : null;
        if (overScissors !== this.dropLineHoverScissors) {
          this.dropLineHoverScissors = overScissors;
          this.requestRender();
        }

        // [📍 교재 보조 수선: 좌표 라벨 호버 감지]
        const overLabel = this.isDropLineMode ? this.hitTestDropLineLabel(pos) : null;
        if (overLabel !== this.dropLineHoverLabel) {
          this.dropLineHoverLabel = overLabel;
          this.requestRender();
        }

        // [📍 교재 보조 수선 모드: 특이점 및 일반 곡선 자석 스냅 타겟 탐색 (아이패드 손날 touch 제외, 전자칠판 허용)]
        if (this.isDropLineMode && (!e || e.pointerType !== 'touch' || !this.isStylusPalmRejectionActive())) {
          const snapRadius = (this._isAimingDropLine || (e && (e.pointerType === 'pen' || e.pointerType === 'touch'))) ? 32 : 24;
          const cand = this.findNearestDropLineTarget(pos, snapRadius);
          const prev = this.dropLineHoverCandidate;
          const changed = (Boolean(prev) !== Boolean(cand)) ||
            (prev && cand && (Math.abs(prev.x - cand.x) > 1e-6 || Math.abs(prev.y - cand.y) > 1e-6 || prev.name !== cand.name || prev.isCandidate !== cand.isCandidate));
          this.dropLineHoverCandidate = cand;
          if (changed) {
            this.requestRender();
          }
        } else if (!this.isDropLineMode && this.dropLineHoverCandidate) {
          this.dropLineHoverCandidate = null;
          this.requestRender();
        }

        const hitStickerHover = (!this.isDrawingInk && !this.isDrawingSticker && this.activeInkTool !== 'eraser')
          ? this.findBoardStickerAtScreenPos(pos)
          : null;
        const newHoverStickerId = hitStickerHover ? hitStickerHover.sticker.id : null;
        if (newHoverStickerId !== this._hoveredBoardStickerId) {
          this._hoveredBoardStickerId = newHoverStickerId;
          this.requestRender();
        }
        if (hitStickerHover && this.virtualStylusEl && !this.isAudioPlaying) {
          this.virtualStylusEl.style.display = 'none';
        }

        const stageHandle = (!this.isCleanView && this.hasActiveProblemCard() && this.graphs.length > 0) ? this.getCompactStageHandleAt(pos) : null;
        let nextCursor = 'default';
        if (hitStickerHover) {
          nextCursor = 'pointer';
        } else if (this.isInkMode && this.activeInkTool === 'sticker') {
          nextCursor = 'crosshair';
        } else if (stageHandle === 'zoomIn' || stageHandle === 'zoomOut') {
          nextCursor = 'pointer';
        } else if (stageHandle === 'resize') {
          nextCursor = 'nwse-resize';
        } else if (stageHandle === 'move') {
          nextCursor = 'move';
        } else if (hitText) {
          nextCursor = hitText.isClose ? 'pointer' : 'move'; // 텍스트 위에서는 이동 십자화살표 또는 삭제 ✕
        } else if (this.isTextToolMode) {
          nextCursor = 'text'; // 텍스트 도구 활성화 시 I-beam 🔤
        } else if (overScissors) {
          nextCursor = 'pointer'; // 가위 버튼 클릭 삭둑 ✂️
        } else if (overLabel) {
          nextCursor = 'text'; // 좌표 라벨 클릭 편집 ✍️
        } else if (this.isDropLineMode) {
          nextCursor = 'crosshair'; // 보조 수선 조준선 📍
        } else if (isOverPwLock || isOverPwDel || isOverPwToggle || isOverPwChip || isOverPwPeriod) {
          nextCursor = 'pointer'; // 클릭 가능한 자물쇠(🔒), 삭제(✕), 포함 토글(●/○) 및 함수 배정 칩
        } else if (isOverHandle) {
          nextCursor = 'pointer'; // 극점/조절점 핸들러 검은 테두리 손바닥 👆 (세로 분할선 몸통보다 최우선!)
        } else if (isOverPwBoundary) {
          nextCursor = 'ew-resize'; // 좌우 드래그 분할선 ↔
        } else if (isOverCurve) {
          const isHoveredCurveActiveSelected = Boolean(
            this.isCurveSelected &&
            (hoveredCurveIdx === this.activeGraphIdx || (this.usePiecewise && this.isPiecewiseLocked))
          );
          nextCursor = isHoveredCurveActiveSelected ? 'move' : 'pointer'; // 깨어있는 활성 곡선 위면 이동(move ✥), 비선택 곡선 위면 선택/깨우기(pointer 👆)
        } else if (this.useViewfinder) {
          const vfRect = this.getVfScreenRect();
          const corners = [
            { x: vfRect.x, y: vfRect.y, cursor: 'nwse-resize' },
            { x: vfRect.x + vfRect.w, y: vfRect.y, cursor: 'nesw-resize' },
            { x: vfRect.x, y: vfRect.y + vfRect.h, cursor: 'nesw-resize' },
            { x: vfRect.x + vfRect.w, y: vfRect.y + vfRect.h, cursor: 'nwse-resize' }
          ];
          const hitCorner = corners.find(c => Math.hypot(pos.x - c.x, pos.y - c.y) <= 22);
          nextCursor = hitCorner ? hitCorner.cursor : 'default';
        } else if (this.isSpacePressed || this.isShiftPressed || (e && e.shiftKey)) {
          nextCursor = 'move';
        } else if (this.isInkMode && this.activeInkTool === 'select') {
          nextCursor = 'default';
        } else if (this.isInkMode && !this.showVirtualStylus && (this.activeInkTool === 'pen' || this.activeInkTool === 'highlighter' || this.activeInkTool === 'eraser')) {
          nextCursor = 'crosshair';
        }
        if (this.canvas.style.cursor !== nextCursor) {
          this.canvas.style.cursor = nextCursor;
        }
      }
    };

    const handleUp = (e) => {
      if (this._tappingBoardSticker) {
        const tapInfo = this._tappingBoardSticker;
        this._tappingBoardSticker = null;
        if (!tapInfo.moved && tapInfo.sticker) {
          tapInfo.sticker.revealed = !tapInfo.sticker.revealed;
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
          this.render();
        }
        return;
      }
      if (this.isDrawingSticker && this.stickerDraftStart) {
        const upPos = getPos(e.touches ? (e.changedTouches ? e.changedTouches[0] : e.touches[0]) : e);
        const start = this.stickerDraftStart;
        const cur = (upPos && Number.isFinite(upPos.x)) ? upPos : (this.stickerDraftCurrent || start);
        const sx = Math.min(start.x, cur.x);
        const sy = Math.min(start.y, cur.y);
        const sw = Math.abs(cur.x - start.x);
        const sh = Math.abs(cur.y - start.y);
        const pendingTap = this._pendingStickerTap;

        this.isDrawingSticker = false;
        this.stickerDraftStart = null;
        this.stickerDraftCurrent = null;
        this._pendingStickerTap = null;

        if (sw >= 10 && sh >= 10) {
          const isBoardTarget = Boolean(this.isGraphCovered && !this.pdfPageBoardData);
          const p1 = isBoardTarget ? this.screenToBoard(sx, sy) : this.screenToMath(sx, sy);
          const p2 = isBoardTarget ? this.screenToBoard(sx + sw, sy + sh) : this.screenToMath(sx + sw, sy + sh);
          const recT = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          const newSticker = {
            id: 'stk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            target: isBoardTarget ? 'board' : 'graph',
            onPdfBoard: Boolean(this.pdfPageBoardData && !isBoardTarget),
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            color: '#facc15',
            revealed: false,
            tStart: recT
          };
          if (!Array.isArray(this.boardStickers)) this.boardStickers = [];
          this.boardStickers.push(newSticker);
          this.undoStack.push({ type: 'sticker_add', sticker: newSticker });
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];
          this.updateUndoRedoUI();
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
        } else if (pendingTap) {
          pendingTap.revealed = !pendingTap.revealed;
          if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
        }
        this.render();
        return;
      }
      // 🌟 [📍 교재 보조 수선 모드: 조준 후 펜/마우스를 뗄 때(pointerup) 수선 생성!] 🌟
      if (this.isDropLineMode && this._isAimingDropLine) {
        if (e && e.pointerType === 'touch' && this.isStylusPalmRejectionActive()) {
          return;
        }
        this._isAimingDropLine = false;
        const upPos = getPos(e);
        const aimStart = this._dropLineAimStartPos || upPos;
        const moveDist = Math.hypot(upPos.x - aimStart.x, upPos.y - aimStart.y);
        this._dropLineAimStartPos = null;
        const isPen = Boolean(e && (e.pointerType === 'pen' || (e.pointerType === 'touch' && !this.isStylusPalmRejectionActive())));
        const target = this.dropLineHoverCandidate || this.findNearestDropLineTarget(upPos, isPen ? 36 : 24);
        if (target) {
          this.addDropLineAtPoint(target.x, target.y, target);
          if (isPen) {
            this.dropLineHoverCandidate = null;
            this.render();
          }
          return;
        } else {
          // 곡선 밖 빈 공간에서 뗀 경우:
          // - 펜이나 마우스로 빈 공간을 드래그 없이 제자리에서 '툭' 친 경우(moveDist < 8px)에만 수선 모드 해제!
          // - 조준을 위해 드래그하다가 빈 공간에서 뗀 경우(moveDist >= 8px)에는 수선만 안 찍고 모드는 그대로 유지!
          if (moveDist < 8) {
            this.toggleDropLineMode(false);
          } else {
            this.dropLineHoverCandidate = null;
            this.render();
          }
          return;
        }
      }
      if (this.isPdfToGraphCropDragging && this.pdfToGraphCropStart) {
        this.isPdfToGraphCropDragging = false;
        this._activeSnapDragRect = null;
        const dragBox = document.getElementById('graphSnapDragBox');
        if (dragBox) dragBox.style.display = 'none';
        const pos = getPos(e);
        if (typeof this.pdfToGraphCropStart.mathX === 'number') {
          const sPt = this.mathToScreen(this.pdfToGraphCropStart.mathX, this.pdfToGraphCropStart.mathY);
          this.pdfToGraphCropStart.x = sPt.x;
          this.pdfToGraphCropStart.y = sPt.y;
        }
        const x = Math.min(this.pdfToGraphCropStart.x, pos.x);
        const y = Math.min(this.pdfToGraphCropStart.y, pos.y);
        const w = Math.abs(pos.x - this.pdfToGraphCropStart.x);
        const h = Math.abs(pos.y - this.pdfToGraphCropStart.y);
        const mathStart = (typeof this.pdfToGraphCropStart.mathX === 'number')
          ? { x: this.pdfToGraphCropStart.mathX, y: this.pdfToGraphCropStart.mathY }
          : this.screenToMath(this.pdfToGraphCropStart.x, this.pdfToGraphCropStart.y);
        const mathEnd = this.screenToMath(pos.x, pos.y);
        this.pdfToGraphCropStart = null;
        if (w >= 25 && h >= 25) {
          this.completePdfBoardToGraphCrop({ x, y, w, h, mathStart, mathEnd });
        } else {
          this.completePdfBoardToGraphCrop(null);
        }
        return;
      }
      if (this.isGraphSnapDragging && this.graphSnapStart) {
        this.isGraphSnapDragging = false;
        this._activeSnapDragRect = null;
        const dragBox = document.getElementById('graphSnapDragBox');
        if (dragBox) dragBox.style.display = 'none';
        const pos = getPos(e);
        const x = Math.min(this.graphSnapStart.x, pos.x);
        const y = Math.min(this.graphSnapStart.y, pos.y);
        const w = Math.abs(pos.x - this.graphSnapStart.x);
        const h = Math.abs(pos.y - this.graphSnapStart.y);
        this.graphSnapStart = null;
        if (w >= 30 && h >= 30) {
          this.captureGraphSnapshot({ x, y, w, h });
        } else {
          this.showToast('⚠️ 영역이 너무 작습니다. 사용할 그래프 영역을 조금 더 넓게 드래그해 주세요.');
        }
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        return;
      }
      // 🌟 [필기 모드 가상 스타일러스 펜]: 손을 떼었을 때 눌림 해제 & 마지막 위치에 펜 상시 보존
      if (this.isStylusDrawing) {
        this.isStylusDrawing = false;
        if (this.virtualStylusEl) this.virtualStylusEl.classList.remove('drawing');
        this.updateStylusPenPosition(this.stylusPenPos.x, this.stylusPenPos.y);
      }

      if (this._isTemporaryStylusEraser) {
        this._isTemporaryStylusEraser = false;
        this.isDrawingInk = false;
        this.requestRender();
      }

      // 🌟 [손날 롱프레스 해제 방지]: 손날을 대고 자세를 잡을 때(400ms 초과) 핸들러가 꺼지지 않도록 보호!

      // [🪢 올가미(Lasso) 툴 인터랙션]
      if (this.isInkMode && this.activeInkTool === 'lasso') {
        if (this.isResizingLassoSelection) {
          this.isResizingLassoSelection = false;
          this.lassoResizeStart = null;
          if (this._preDragState) {
            const afterSnap = this.getHistorySnapshot();
            if (this._preDragState !== afterSnap) {
              this.undoStack.push(this._preDragState);
              if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
              this.redoStack = [];
              this.updateUndoRedoUI();
            }
            this._preDragState = null;
          }
          this.canvas.style.cursor = 'move';
          this.syncLassoActionBarUI();
          this.render();
          return;
        }
        if (this.isDraggingLassoSelection) {
          this.isDraggingLassoSelection = false;
          this.lassoDragStart = null;
          if (this._preDragState) {
            const afterSnap = this.getHistorySnapshot();
            if (this._preDragState !== afterSnap) {
              this.undoStack.push(this._preDragState);
              if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
              this.redoStack = [];
              this.updateUndoRedoUI();
            }
            this._preDragState = null;
          }
          this.canvas.style.cursor = 'move';
          this.render();
          return;
        }

        if (this.isLassoSelecting) {
          this.isLassoSelecting = false;

          // 🌟 [대표님 핵심 기획]: 단순 탭/클릭(이동 거리 12px 미만)이면 올가미 그리기 없이 즉시 완전 해제!
          let isTap = true;
          if (this._lassoStartPos && this.lassoPoints && this.lassoPoints.length > 1) {
            let maxDist = 0;
            for (const pt of this.lassoPoints) {
              const d = Math.hypot(pt.x - this._lassoStartPos.x, pt.y - this._lassoStartPos.y);
              if (d > maxDist) maxDist = d;
            }
            if (maxDist >= 12) {
              isTap = false;
            }
          }
          this._lassoStartPos = null;
          this._lassoPrePinchBackup = null;

          if (isTap) {
            // 🌟 [굿노트급 올가미 자동 복귀]: 바깥 빈 공간을 펜/마우스로 '톡' 찍어 해제하면 즉시 필기(pen) 모드로 자동 복귀!
            // (아이패드 손바닥/손가락 터치는 isFingerOrPalmTouch에서 100% 사전 차단되어 절대 풀리지 않음)
            this.selectedInkStrokes = [];
            this.selectedTextLabels = [];
            this.lassoBoundingBox = null;
            this.lassoPoints = [];
            this.canvas.classList.remove('is-hover-selection');
            this.setActiveInkTool('pen');
            return;
          }

          // 드래그 거리 12px 이상 & 3점 이상인 유효한 올가미 루프 판정
          if (this.lassoPoints && this.lassoPoints.length >= 3) {
            const matchedStrokes = this.inkStrokes.filter(s => this.isStrokeInLasso(s, this.lassoPoints));
            const matchedTexts = (this.textLabels || []).filter(t => {
              const s = this.mathToScreen(t.mathX, t.mathY);
              return this.isPointInPolygon(s, this.lassoPoints);
            });

            if (matchedStrokes.length > 0 || matchedTexts.length > 0) {
              this.selectedInkStrokes = matchedStrokes;
              this.selectedTextLabels = matchedTexts;
              this.lassoBoundingBox = this.calculateStrokesBoundingBox(matchedStrokes, matchedTexts);
              this.canvas.style.cursor = 'move';
            } else {
              this.selectedInkStrokes = [];
              this.selectedTextLabels = [];
              this.lassoBoundingBox = null;
              this.lassoPoints = [];
              this.canvas.style.cursor = 'crosshair';
              this.canvas.classList.remove('is-hover-selection');
            }
          } else {
            this.selectedInkStrokes = [];
            this.selectedTextLabels = [];
            this.lassoBoundingBox = null;
            this.lassoPoints = [];
            this.canvas.style.cursor = 'crosshair';
            this.canvas.classList.remove('is-hover-selection');
          }
          this.render();
          return;
        }
      }

      if (this.isDrawingInk) {
        if (this._inkHoldTimer) {
          clearTimeout(this._inkHoldTimer);
          this._inkHoldTimer = null;
        }
        if (this.activeInkTool === 'laser' && this.currentMainLaserStroke) {
          const nowPerf = performance.now();
          const HOLD_MS = 1650;
          const recTUp = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
          if (recTUp !== undefined && this.currentMainLaserStroke._recLaserStroke) {
            this.currentMainLaserStroke._recLaserStroke.tEnd = recTUp;
            this.currentMainLaserStroke._recLaserStroke.holdUntil = recTUp + HOLD_MS;
          }
          if (Array.isArray(this.mainLaserStrokes)) {
            this.mainLaserStrokes.forEach(st => {
              if (st) {
                st.finished = true;
                st.finishedAt = nowPerf;
              }
            });
          }
          this.currentMainLaserStroke = null;
          this.isDrawingInk = false;
          this._hasSceneFreeze = false;
          this._ensureMainLaserLoop();
          return;
        }

        // 일반 필기 마감 시 마지막 펜 끝 좌표를 매끄럽게 마무리 (짧은 획 L===1 포함 100% 마감!)
        // (※ pointerup 시점의 220ms 강제 도형 인식 트리거는 작은 글씨 `3`, `ㄴ`을 떼는 순간 직선으로 둔갑시키므로 제거하고,
        //    펜을 떼지 않고 정식으로 홀드 타이머(_inkHoldTimer)가 만료되었을 때만 도형 인식이 작동하도록 통일!)
        const isCancelOrZero = !e || e.type === 'pointercancel' || (e.clientX === 0 && e.clientY === 0);
        if (!isCancelOrZero) {
          const upPos = getPos(e.touches ? (e.changedTouches ? e.changedTouches[0] : e.touches[0]) : e);
          if (upPos && Number.isFinite(upPos.x) && Number.isFinite(upPos.y)) {
            this._lastRawInkScreenPos = { x: upPos.x, y: upPos.y };
          }
        }
        if (!this._inkHoldDetected && this.currentInkStroke && !this.currentInkStroke.isShape && this._lastRawInkScreenPos && this._liveBezierScreenPts && this._liveBezierScreenPts.length >= 1) {
          const lastSmoothed = this._liveBezierScreenPts[this._liveBezierScreenPts.length - 1];
          const rawEnd = this._lastRawInkScreenPos;
          const curPenStyle = this.currentInkStroke.penStyle || 'ballpen';
          const tailDist = Math.hypot(rawEnd.x - lastSmoothed.x, rawEnd.y - lastSmoothed.y);
          if (tailDist >= 0.15) {
            const isShortStroke = (this._liveBezierScreenPts.length <= 2);
            const endX = (this.currentInkStroke.isHighlighter || isShortStroke) ? rawEnd.x : (lastSmoothed.x * 0.25 + rawEnd.x * 0.75);
            const endY = (this.currentInkStroke.isHighlighter || isShortStroke) ? rawEnd.y : (lastSmoothed.y * 0.25 + rawEnd.y * 0.75);
            let p = this._lastPressure || 0.5;
            if (curPenStyle === 'fountain') {
              p = Math.max(0.10, p * 0.55);
            } else if (curPenStyle === 'brush') {
              p = Math.max(0.06, p * 0.45);
            }
            this._liveBezierScreenPts.push({ x: endX, y: endY, p: p });
            const recTUp = this.isAudioRecording ? this.getAudioRecordElapsedMs() : undefined;
            if (recTUp !== undefined) {
              this.currentInkStroke.tEnd = recTUp;
            }
            if (this.currentInkStroke.target === 'graph') {
              const m = this.screenToMath(endX, endY);
              this.currentInkStroke.points.push({ x: m.x, y: m.y, p: p, t: recTUp });
            } else {
              const bPt = this.screenToBoard(endX, endY);
              this.currentInkStroke.points.push({ x: bPt.x, y: bPt.y, p: p, t: recTUp });
            }
            // 🌟 [핵심 버그 수정]: 꼬리 점(pC)을 추가했을 때는 먼저 직전 중점(mid1)에서 새 중점(mid2)까지의
            // 2차 베지어 구간(isFinalTail = false)을 반드시 이어준 뒤, 아래 마감 단계에서 mid2 -> pC(isFinalTail = true)를 그려야
            // 중간 구간(mid1~mid2)이 비면서 느낌표(!)처럼 끝점이 분리되는 현상이 100% 사라집니다!
            if (!this.currentInkStroke.isHighlighter) {
              this.drawLiveBezierStep(this._liveBezierScreenPts, this.currentInkStroke, false);
            }
          }
        }

        this._inkHoldDetected = false;
        this._prevRawInkScreenPos = null;
        this._lastRawInkScreenPos = null;
        this._lastMoveEventScreenPos = null;
        this._lastInkSampleTs = null;
        this._lastInkAcceptedTs = null;
        this._inkHoldLastScreenPos = null;
        this._lastSignificantMoveTime = 0;
        this.isDrawingInk = false;
        const hadSceneFreeze = Boolean(this._hasSceneFreeze && this.sceneFreezeCanvas);
        this._hasSceneFreeze = false;
        const wasOneShotEraser = (this.activeInkTool === 'eraser' && !this._isTemporaryStylusEraser);
        this._erasedInCurrentStroke = false;
        this._preDragState = null;
        const finishedStroke = this.currentInkStroke;
        if (finishedStroke && this.isAudioRecording) {
          finishedStroke.tEnd = this.getAudioRecordElapsedMs();
        }
        this.currentInkStroke = null;
        this._lastInkScreenPos = null;
        if (wasOneShotEraser) {
          this._liveBezierScreenPts = null;
          this.setActiveInkTool('pen');
          return;
        }

        // 🌟 [0ms 초고속 잉크 히스토리 푸시 & 비동기 증분 베이킹 (Zero-Blocking PointerUp)] 🌟
        if (finishedStroke && finishedStroke.points && finishedStroke.points.length > 0) {
          this.undoStack.push({ type: 'stroke_add', stroke: finishedStroke });
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];

          // 형광펜(isHighlighter) 획은 완료 즉시 하단 레이어(Pass 1)로 내려가 검은 글씨 뒤로 깔리도록 캐시 리빌드!
          if (finishedStroke.isHighlighter || finishedStroke.isShape) {
            this._inkBakeDirty = true;
          }

          // 🌟 [무렉(Zero-Stutter) 마감 & 단획·점 100% 즉시 반영]: 일반 펜 획은 pointerup 입력 핸들러 안에서
          // 절대 전체 화면 render(), rebuildInkCache(), 오프스크린 베이킹, DOM 버튼 갱신을 동기 실행하지 않고,
          // 현재 획 끝점만 즉시 캔버스에 그린 뒤(0.01ms) 증분 베이킹 큐에 위임하여 연속 필기(`ㄴ` 받침 등) 씹힘을 원천 차단합니다!
          if (!finishedStroke.isHighlighter && !finishedStroke.isShape && !this._inkBakeDirty) {
            if (this._liveBezierScreenPts && this._liveBezierScreenPts.length >= 1) {
              this.drawLiveBezierStep(this._liveBezierScreenPts, finishedStroke, true);
            } else {
              this.renderSingleStroke(this.ctx, finishedStroke, null, false);
            }
            this._liveBezierScreenPts = null;
            this._queueIncrementalStrokeBake(finishedStroke);
            return;
          }
          this.updateUndoRedoUI();
        }

        this._liveBezierScreenPts = null;
        this.render();
        return;
      }

      this.activePwDragIdx = null;
      this.draggingPwBoundary = null;
      this.snapActiveX = false;
      this.snapActiveY = false;
      this.axisSnapActiveX = false;
      this.axisSnapActiveY = false;
      this.snappedPoints = [];

      if (this.curveContextBar) {
        this.curveContextBar.classList.remove('dimmed');
      }

      if (this.isInkMode && this.activeInkTool !== 'select') {
        this.selectedHandleIdx = null;
        this.draggedHandleIdx = null;
        this.isCurveSelected = false;
        if (this.pulseAnimId) {
          cancelAnimationFrame(this.pulseAnimId);
          this.pulseAnimId = null;
        }
      } else if (this.downInfo) {
        const pos = getPos(e.touches ? (e.changedTouches ? e.changedTouches[0] : e.touches[0]) : e);
        const moveDist = Math.hypot(pos.x - this.downInfo.x, pos.y - this.downInfo.y);

        // [대표님 핵심 기획]: 핸들을 클릭했거나 드래그한 경우, 마우스를 뗀 후에도 해당 핸들을 확실하게 선택 상태로 유지!
        // 그래야 자석에 붙인 직후 곧바로 키보드 방향키(상하좌우)로 미세 조정 및 탈출이 100% 작동합니다.
        if (this.downInfo.hitHandleIdx !== null) {
          this.selectedHandleIdx = this.downInfo.hitHandleIdx;
          this.isCurveSelected = true;
          this.startPulseLoop();
        } else if (this.downInfo.hitCurveIdx !== null || this.isDraggingCurve) {
          // 🌟 [대표님 절대 규칙 100% 구현]:
          // 1. 선을 먼저 클릭하면 핸들러가 나온다.
          // 2. 조작 상태니 몸통을 움직이면 이동해야 한다. 이동 후에도 핸들러는 계속 유지된다!
          // 3. 오직 빈 화면을 클릭해야만 핸들러가 사라진다!
          this.isCurveSelected = true;
          this.selectedHandleIdx = null;
          this.renderLayerList();
          this.render();
        } else {
          // 🌟 [대표님 핵심 기획]:
          // 1) 손날이나 손가락(touch)으로 화면을 건드리거나 이동할 때는 핸들러가 절대 사라지지 않음!
          // 2) 펜슬(pen)이나 마우스(mouse)로도 화면을 드래그 이동(moveDist >= 8px)할 때는 핸들러 유지!
          // 3) 오직 펜슬(pen)이나 마우스(mouse)로 그래프 밖 빈 공간을 이동 없이 '툭' 건드렸을 때(moveDist < 8px)만 핸들러 해제!
          const upPType = (e && e.pointerType)
            ? e.pointerType
            : ((this.downInfo && this.downInfo.pointerType) ? this.downInfo.pointerType : (e && (e.touches || e.changedTouches) ? 'touch' : 'mouse'));
          if ((upPType === 'pen' || upPType === 'mouse' || (upPType === 'touch' && !this.isStylusPalmRejectionActive())) && moveDist < 8) {
            this.selectedHandleIdx = null;
            this.isCurveSelected = false;
            this.selectedPwBoundaryIdx = null;
            if (this.pulseAnimId) {
              cancelAnimationFrame(this.pulseAnimId);
              this.pulseAnimId = null;
            }
            this.renderLayerList();
          }
          this.render();
        }
      }

      if (this.isBoardPanning) {
        this.updateProblemCardPosition();
      }
      const prevDownInfo = this.downInfo;
      const wasDraggingHandle = (this.draggedHandleIdx !== null);
      const wasDraggingCurve = Boolean(this.isDraggingCurve);
      this.draggedHandleIdx = null;
      this.isDraggingCurve = false;
      this._curveDragEligible = false;
      this.isPanning = false;
      this.isBoardPanning = false;
      this.boardPanStart = null;
      document.body.classList.remove('space-pan-dragging');
      this.isDraggingVf = false;
      this.isResizingVf = false;
      this.isResizingStage = false;
      this.isMovingStage = false;
      this.stageDragStart = null;
      this.isDraggingTextLabel = false;
      this.draggedTextLabelId = null;
      this.downInfo = null;
      this.curveFeatsSnapshot = null;
      this.syncControls();

      if (this.isShiftPressed || this.isSpacePressed) {
        this.updateInkCursor();
        this.canvas.style.cursor = 'move';
      } else if (this.isInkMode && this.activeInkTool === 'select') {
        this.updateInkCursor();
        this.canvas.style.cursor = 'default';
      } else if (this.isInkMode) {
        this.updateInkCursor();
      } else if (this.isDropLineMode) {
        this.canvas.style.cursor = 'crosshair';
      } else if (wasDraggingHandle || (prevDownInfo && prevDownInfo.hitHandleIdx !== null && prevDownInfo.hitHandleIdx !== undefined)) {
        this.canvas.style.cursor = 'pointer';
      } else if (wasDraggingCurve || (prevDownInfo && prevDownInfo.hitCurveIdx !== null && prevDownInfo.hitCurveIdx !== undefined && this.isCurveSelected)) {
        this.canvas.style.cursor = 'move';
      } else {
        this.canvas.style.cursor = 'default';
      }

      // 마우스/터치 드래그로 상태가 실제로 변했으면 히스토리 스택에 푸시!
      if (this._preDragState) {
        const afterSnap = this.getHistorySnapshot();
        if (this._preDragState !== afterSnap) {
          this.undoStack.push(this._preDragState);
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];
          this.updateUndoRedoUI();
        }
        this._preDragState = null;
      }

      this.render();
    };

    let lastPointerDownTime = 0;
    let lastPointerMoveTime = 0;
    let lastPointerUpTime = 0;

    if (window.PointerEvent) {
      window.addEventListener('pointerdown', (e) => {
        if (this.isPdfModalOpen) return;
        // 🌟 캔버스에 손날(touch)이든 펜(pen)이든 닿는 즉시 e.preventDefault()를 실행해 Safari 기본 제스처 개입을 차단!
        if (e.target === this.canvas && e.cancelable !== false) {
          e.preventDefault();
        }
        const nowT = Date.now();
        if (e.pointerType === 'touch') {
          if (e.target === this.canvas) {
            if (this._uiPointerIds && e.pointerId !== undefined) this._uiPointerIds.delete(e.pointerId);
            return;
          }
          // 🌟 문제 카드·그래프 카드·스티커 위에서 두 손가락 터치(2-Finger Pan/Pinch)가 시작될 때도
          // 카드 개별 드래그를 즉시 취소하고 칠판 전체 2손가락 화면 이동/줌으로 매끄럽게 전환!
          const isCardOrStickerBodyTouch = Boolean(
            e.target &&
            e.target.closest &&
            e.target.closest('#problemCardWidget, #graphCardWidget, .extra-problem-card-widget, .extra-graph-card-widget, #workspaceStickerOverlay, .workspace-sticker-item') &&
            !e.target.closest('button, .card-btn, .problem-card-actions, .pip-header-curve-tools, .problem-card-resize-handle, .card-fold-triangle-btn, .card-title-fold-btn') &&
            !isAnyModalOrOverlayBlockingCanvas()
          );
          if (isCardOrStickerBodyTouch) {
            if (e.cancelable !== false) e.preventDefault();
            const ignoredOnCard = this._shouldIgnoreCanvasTouchPointer(e);
            if (ignoredOnCard || this._pinchState || (this.activePointers && this.activePointers.size >= 2)) {
              e.stopPropagation();
              if (this._uiPointerIds && e.pointerId !== undefined) this._uiPointerIds.delete(e.pointerId);
              return;
            }
          }
          if (e.pointerId !== undefined) {
            if (!this._uiPointerIds) this._uiPointerIds = new Set();
            this._uiPointerIds.add(e.pointerId);
          }
          return;
        }
        if (e.pointerType === 'pen') {
          this._markStylusPenDetected();
          this._lastPenActiveTime = nowT;
          if (this.activePointers) this.activePointers.clear();
          this._pinchState = null;
          this._pinchWasActiveInGesture = false;
          if (e.target === this.canvas && !this.isSpacePressed && e.button !== 1 && !isAnyModalOrOverlayBlockingCanvas()) {
            if (this._uiPointerIds && e.pointerId !== undefined) this._uiPointerIds.delete(e.pointerId);
            return;
          }
        }
        const isEffectivePenDown = (e.pointerType === 'pen');
        if (!this._uiPointerIds) this._uiPointerIds = new Set();
        const isNotCanvas = (e.target !== this.canvas);
        const isUI = isClickableUI(e.target);
        const isModal = isAnyModalOrOverlayBlockingCanvas();

        const isOnCardOrStickerSurface = Boolean(
          e.target &&
          e.target !== this.canvas &&
          e.target.closest &&
          e.target.closest('#problemCardWidget, #graphCardWidget, .extra-problem-card-widget, .extra-graph-card-widget, #workspaceStickerOverlay, .workspace-sticker-item')
        );
        if ((this.isSpacePressed || e.button === 1) && !isModal && (e.target === this.canvas || isOnCardOrStickerSurface)) {
          if (e.pointerId !== undefined) this._uiPointerIds.delete(e.pointerId);
          if (e.target !== this.canvas) {
            if (e.cancelable !== false) e.preventDefault();
            e.stopPropagation();
            lastPointerDownTime = nowT;
            this.isPointerDownOnCanvas = true;
            this._pointerDownStart = { time: nowT, x: e.clientX, y: e.clientY };
            this._activeDrawingPointerId = e.pointerId;
            this._activeDrawingPointerType = isEffectivePenDown ? 'pen' : (e.pointerType || 'mouse');
            handleDown(e);
            return;
          }
        }

        const shouldBlockAsUI = isEffectivePenDown
          ? (isUI || isModal || isOnCardOrStickerSurface)
          : (isNotCanvas || isUI || isModal);
        if (shouldBlockAsUI && !(this.isSpacePressed || e.button === 1)) {
          if (e.pointerId !== undefined) this._uiPointerIds.add(e.pointerId);
        } else {
          if (e.pointerId !== undefined) this._uiPointerIds.delete(e.pointerId);
        }
      }, { capture: true, passive: false });

      this.canvas.addEventListener('pointerdown', (e) => {
        if (this.isWaitingForFilePicker) {
          if (typeof this._finishWaitingForFilePicker === 'function') {
            this._finishWaitingForFilePicker();
          } else {
            this.isWaitingForFilePicker = false;
          }
        }
        if (this._needsInkCursorRefreshOnMove) {
          this._needsInkCursorRefreshOnMove = false;
          this.updateInkCursor();
        }
        if (e.cancelable !== false) {
          e.preventDefault();
        }
        if (e.pointerType === 'touch') {
          if (this._shouldIgnoreCanvasTouchPointer(e)) return;
        }
        if (isClickableUI(e.target) || isAnyModalOrOverlayBlockingCanvas()) {
          return;
        }
        if (this._uiPointerIds && e.pointerId !== undefined) {
          this._uiPointerIds.delete(e.pointerId);
        }
        const nowT = Date.now();
        lastPointerDownTime = nowT;
        const isEffectivePen = (e.pointerType === 'pen');

        if (e.pointerType === 'touch') {
          this.isPointerDownOnCanvas = true;
          this._pointerDownStart = { time: nowT, x: e.clientX, y: e.clientY };
          if (!this.isStylusPalmRejectionActive()) {
            this._activeDrawingPointerId = e.pointerId;
            this._activeDrawingPointerType = 'touch';
          }
          handleDown(e);
          return;
        }
        if (isEffectivePen || e.pointerType === 'mouse' || !e.pointerType) {
          if (e.cancelable !== false) {
            e.preventDefault();
          }
          if (isEffectivePen) {
            this._markStylusPenDetected();
            this._lastPenActiveTime = nowT;
          }
          if (this.activePointers) {
            this.activePointers.clear();
          }
          this._pinchWasActiveInGesture = false;
          if (this.isPanning || this.isBoardPanning || this._pinchState) {
            this.isPanning = false;
            this.isBoardPanning = false;
            this._pinchState = null;
            this._activePanPointerId = null;
          }
          this.isPointerDownOnCanvas = true;
          this._pointerDownStart = { time: nowT, x: e.clientX, y: e.clientY };
          this._activeDrawingPointerId = e.pointerId;
          this._activeDrawingPointerType = isEffectivePen ? 'pen' : (e.pointerType || 'mouse');
          handleDown(e);
          return;
        }
      }, { passive: false });

      window.addEventListener('pointermove', (e) => {
        if (this.isPdfModalOpen) return;
        if (e.target === this.canvas && e.cancelable !== false) {
          e.preventDefault();
        }
        // 🌟 [활성 펜 필기 중 0.001ms 직통 패스트패스]:
        // 현재 드로잉 중인 펜의 pointerId와 일치하는 이벤트는 메뉴/UI DOM 히트테스트를 100% 생략하고 즉시 handleMove로 직행합니다!
        if (
          (this.isDrawingInk || this.isStylusDrawing) &&
          this._activeDrawingPointerId !== null &&
          this._activeDrawingPointerId !== undefined &&
          e.pointerId === this._activeDrawingPointerId
        ) {
          const nowT = Date.now();
          lastPointerMoveTime = nowT;
          this._isPointerInsideWindow = true;
          this._lastPointerEvent = e;
          if (e.pointerType === 'pen') {
            this._lastPenActiveTime = nowT;
          }
          handleMove(e);
          return;
        }
        if (e.pointerType === 'touch') {
          const isUiTouchMove = Boolean(this._uiPointerIds && e.pointerId !== undefined && this._uiPointerIds.has(e.pointerId));
          const isCanvasOrPinchTouchMove = !isUiTouchMove || Boolean(this._pinchState) || Boolean(this.activePointers && this.activePointers.size >= 2);
          if (isCanvasOrPinchTouchMove && this._shouldIgnoreCanvasTouchPointer(e)) {
            if (e.cancelable !== false) e.preventDefault();
            if (this._pinchState || (this.activePointers && this.activePointers.size >= 2)) {
              e.stopPropagation();
            }
            return;
          }
        }
        const isEffectivePen = (e.pointerType === 'pen');
        this._isPointerInsideWindow = true;
        this._lastPointerEvent = e;
        if (this.isWaitingForFilePicker) {
          return;
        }

        if (this.isDraggingPillRemote || isAnyModalOrOverlayBlockingCanvas()) {
          if (this.virtualStylusEl && !this.isAudioPlaying) this.virtualStylusEl.style.display = 'none';
          return;
        }
        if (!this.isPanning && !this.isBoardPanning && this._uiPointerIds && e.pointerId !== undefined && this._uiPointerIds.has(e.pointerId) && !this.isDrawingSticker && !this._tappingBoardSticker) {
          const isHoveringWithoutButton = (e.pointerType === 'mouse' || !e.pointerType) && !e.buttons;
          const isPenOnCanvas = (isEffectivePen && e.target === this.canvas && !isClickableUI(e.target));
          if (isHoveringWithoutButton || isPenOnCanvas) {
            this._uiPointerIds.delete(e.pointerId);
          } else {
            if (isEffectivePen) {
              this._markStylusPenDetected();
              this._lastPenActiveTime = Date.now();
            }
            if (e.target && e.target.closest && e.target.closest('.problem-card-body') && !this.isPointerOverMenu(e)) {
              const cPos = getPos(e);
              this.updateStylusPenPosition(cPos.x, cPos.y, e);
              return;
            }
            if (this.virtualStylusEl && !this.isAudioPlaying) this.virtualStylusEl.style.display = 'none';
            return;
          }
        }
        if (
          !this.isDrawingInk &&
          !this.isStylusDrawing &&
          !this.isLassoSelecting &&
          !this.isDrawingSticker &&
          !this._tappingBoardSticker &&
          !this.isPanning &&
          !this.isBoardPanning &&
          !this.isDraggingCurve &&
          this.draggedHandleIdx === null &&
          !this.isDraggingLassoSelection &&
          !this.isResizingLassoSelection
        ) {
          const overMenuOrBlockedCard = this.isPointerOverMenu(e);
          if (overMenuOrBlockedCard) {
            if (this.virtualStylusEl && !this.isAudioPlaying) this.virtualStylusEl.style.display = 'none';
            return;
          }
          if (e.target && e.target.closest && e.target.closest('.problem-card-body')) {
            const cPos = getPos(e);
            this.updateStylusPenPosition(cPos.x, cPos.y, e);
            return;
          }
          if (isClickableUI(e.target)) {
            if (this.virtualStylusEl && !this.isAudioPlaying) this.virtualStylusEl.style.display = 'none';
            return;
          }
        }
        const nowT = Date.now();
        lastPointerMoveTime = nowT;

        if (isEffectivePen) {
          this._markStylusPenDetected();
          this._lastPenActiveTime = nowT;
        }

        if ((this.isDrawingInk || this.isStylusDrawing || this.isLassoSelecting || this.isDrawingSticker) && this._activeDrawingPointerId !== null && this._activeDrawingPointerId !== undefined) {
          if (e.pointerId !== undefined && e.pointerId !== this._activeDrawingPointerId) {
            return;
          }
        }
        if ((this.isPanning || this.isBoardPanning) && e.pointerType === 'touch' && this._activePanPointerId !== null && this._activePanPointerId !== undefined && e.pointerId !== this._activePanPointerId) {
          return;
        }

        if (this._needsInkCursorRefreshOnMove) {
          this._needsInkCursorRefreshOnMove = false;
          this.updateInkCursor();
        }
        handleMove(e);
      }, { capture: true, passive: false });

      const finishPointer = (e) => {
        const wasUiPointer = Boolean(this._uiPointerIds && e.pointerId !== undefined && this._uiPointerIds.has(e.pointerId));
        if (this._uiPointerIds && e.pointerId !== undefined) {
          this._uiPointerIds.delete(e.pointerId);
        }
        if (this.isPdfModalOpen) return;
        if (e.pointerType === 'touch') {
          if (wasUiPointer && !this._pinchState && !(this.activePointers && this.activePointers.has(e.pointerId))) {
            return;
          }
          if (this._shouldIgnoreCanvasTouchPointer(e)) return;
        }
        if (
          wasUiPointer &&
          !this.isDrawingInk &&
          !this.isStylusDrawing &&
          !this.isDrawingSticker &&
          !this._tappingBoardSticker &&
          !this.isPanning &&
          !this.isBoardPanning &&
          !this.isDraggingCurve &&
          this.draggedHandleIdx === null &&
          !this.isDraggingLassoSelection &&
          !this.isResizingLassoSelection &&
          !this.isLassoSelecting &&
          !this.isResizingStage &&
          !this.isMovingStage
        ) {
          return;
        }
        const isEffectivePen = (e.pointerType === 'pen');
        const nowT = Date.now();
        if (isEffectivePen) {
          this._lastPenActiveTime = nowT;
        }

        if ((this.isDrawingInk || this.isStylusDrawing || this.isLassoSelecting || this.isDrawingSticker) && this._activeDrawingPointerId !== null && this._activeDrawingPointerId !== undefined) {
          if (e.pointerId !== undefined && e.pointerId !== this._activeDrawingPointerId) {
            return;
          }
        }
        if ((this.isPanning || this.isBoardPanning) && e.pointerType === 'touch' && this._activePanPointerId !== null && this._activePanPointerId !== undefined && e.pointerId !== this._activePanPointerId) {
          return;
        }

        this.isPointerDownOnCanvas = false;
        this._activeDrawingPointerId = null;
        this._activeDrawingPointerType = null;
        this._activePanPointerId = null;

        if (e.pointerId !== undefined && this.canvas && this.canvas.releasePointerCapture) {
          try {
            if (!this.canvas.hasPointerCapture || this.canvas.hasPointerCapture(e.pointerId)) {
              this.canvas.releasePointerCapture(e.pointerId);
            }
          } catch (err) { }
        }

        lastPointerUpTime = nowT;
        if (this.isDrawingInk || this.isStylusDrawing || this.isDrawingSticker || this._tappingBoardSticker || this.isPanning || this.isBoardPanning || this.isDraggingCurve || this.draggedHandleIdx !== null || this.isDraggingLassoSelection || this.isResizingLassoSelection || this.isLassoSelecting || this.isResizingStage || this.isMovingStage || !isClickableUI(e.target)) {
          handleUp(e);
        }
      };

      window.addEventListener('pointerup', finishPointer, true);
      window.addEventListener('pointercancel', finishPointer, true);
    }

    // 마우스 이벤트 호환성 레이어 (PointerEvent 미지원 환경 및 MouseEvent 시뮬레이션 지원)
    this.canvas.addEventListener('mousedown', (e) => {
      if (!isClickableUI(e.target)) {
        e.preventDefault();
      }
      if (window.PointerEvent && e.isTrusted) return;
      if (isClickableUI(e.target)) return;
      if (Date.now() - lastPointerDownTime < 350) return;
      this.isPointerDownOnCanvas = true;
      this._pointerDownStart = { time: Date.now(), x: e.clientX, y: e.clientY };
      handleDown(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (window.PointerEvent && e.isTrusted) return;
      if (Date.now() - lastPointerMoveTime < 40) return;
      handleMove(e);
    });
    window.addEventListener('mouseup', (e) => {
      if (window.PointerEvent && e.isTrusted) return;
      this.isPointerDownOnCanvas = false;
      if (Date.now() - lastPointerUpTime < 350) return;
      if (this.isDrawingInk || this.isDrawingSticker || this._tappingBoardSticker || !isClickableUI(e.target)) {
        handleUp(e);
      }
    });

    // 🛡️ [캔버스 순수 TouchEvent 실드]:
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.target === this.canvas && e.cancelable !== false) {
        e.preventDefault();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      if (e.target === this.canvas && e.cancelable !== false) {
        e.preventDefault();
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.cancelable !== false) {
        e.preventDefault();
      }
    }, { passive: false });

    // 키보드 단축키: 개인 맞춤 단축키 엔진(handleCustomShortcutKeyDown), 스페이스/쉬프트 팬 이동, ESC 복귀, 방향키 미세조정
    window.addEventListener('keydown', (e) => {
      if (this.isShortcutSettingsModalOpen && this.isShortcutSettingsModalOpen()) {
        return;
      }

      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'color', 'file'].includes((activeEl.type || '').toLowerCase())) ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable
      );

      // 스페이스바 누름 감지 (필기 모드 중 팬 이동 지원 & 포커스된 버튼/슬라이더 자동 클릭·크기 축소 원천 차단)
      if ((e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (activeEl && activeEl !== document.body && typeof activeEl.blur === 'function') {
          try { activeEl.blur(); } catch (err) { }
        }
        if (!this.isSpacePressed) {
          this.isSpacePressed = true;
          document.body.classList.add('space-pan-ready');
          if (this.virtualStylusEl && !this.isAudioPlaying) {
            this.virtualStylusEl.style.display = 'none';
          }
          this.updateInkCursor();
        }
        return;
      }

      // Shift 키 누름 감지 (필기 모드 중 쉬프트 드래그로 쾌속 화면 이동 지원)
      if ((e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !isInput && !this.isShiftPressed) {
        this.isShiftPressed = true;
        if (this.isInkMode) {
          this.canvas.style.cursor = 'move';
        }
      }

      // ESC 키: 서랍(추가창) 닫기, 올가미 선택 해제 또는 PDF 크롭모드/모달 닫기
      if (e.key === 'Escape' && !isInput) {
        if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
          e.preventDefault();
          this.closeDrawer();
          return;
        }
        const mGuide = document.getElementById('modalGuideNotice');
        if (mGuide && mGuide.classList.contains('show')) {
          e.preventDefault();
          mGuide.classList.remove('show');
          return;
        }
        if (this.isPdfCropModeActive) {
          e.preventDefault();
          this.togglePdfCropMode(false);
          return;
        }
        if (this.isPdfModalOpen) {
          e.preventDefault();
          this.closePdfModal();
          return;
        }
        if (this.isInkMode && ((this.selectedInkStrokes && this.selectedInkStrokes.length > 0) || (this.selectedTextLabels && this.selectedTextLabels.length > 0))) {
          e.preventDefault();
          this.selectedInkStrokes = [];
          this.selectedTextLabels = [];
          this.lassoBoundingBox = null;
          this.lassoPoints = [];
          this.render();
          return;
        }
      }

      // PDF 모달 열림 시 전용 단축키: PageUp/PageDown (페이지 이동)
      if (this.isPdfModalOpen && !isInput) {
        if (e.key === 'PageUp' || e.key === '[') {
          e.preventDefault();
          this.scrollToPdfPage(this.pdfCurrentPage - 1);
          return;
        }
        if (e.key === 'PageDown' || e.key === ']') {
          e.preventDefault();
          this.scrollToPdfPage(this.pdfCurrentPage + 1);
          return;
        }
      }

      // Escape 키로 필기 모드 / 수선 모드 / 텍스트 모드 / N축 모드 / 판서 모드 원터치 빠져나오기
      if (e.key === 'Escape') {
        if (!isInput) {
          if (this.isPdfToGraphCropMode) {
            e.preventDefault();
            this.cancelPdfBoardToGraphCrop();
            return;
          }
          if (this.isGraphSnapMode) {
            e.preventDefault();
            this.toggleGraphSnapMode(false);
            return;
          }
          if (this.isDropLineMode) {
            e.preventDefault();
            this.toggleDropLineMode(false);
            return;
          }
          if (this.isTextToolMode) {
            e.preventDefault();
            this.toggleTextToolMode(false);
            return;
          }
        }
      }

      // 🪟 [창모드 그래프 카드 핸들/곡선 선택 중 키보드 방향키(↑↓←→) 미세조정 & Tab 핸들 전환 & Escape 해제 최우선]
      if (!isInput && typeof this._handlePipCardKeyDown === 'function' && this._handlePipCardKeyDown(e)) {
        return;
      }

      // ✂️ [구간 분할선 선택 중 키보드 좌우 화살표(←, →) 미세조정 우선]
      if (this.usePiecewise && this.selectedPwBoundaryIdx !== null && this.piecewiseBoundaries) {
        if (['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // 아래 구간 분할 미세조정 블록에서 처리
        } else if (!isInput && typeof this.handleCustomShortcutKeyDown === 'function' && this.handleCustomShortcutKeyDown(e)) {
          return;
        }
      } else if (this.activeGraph && (this.selectedHandleIdx !== null || this.isCurveSelected) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'Tab'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // 선택된 극점 핸들 또는 곡선 방향키 미세조정 우선
      } else if (!isInput && typeof this.handleCustomShortcutKeyDown === 'function' && this.handleCustomShortcutKeyDown(e)) {
        return;
      }

      // ✂️ [대표님 핵심 기획: 구간 분할선 키보드 좌우 화살표(←, →) 미세조정]
      if (this.usePiecewise && this.selectedPwBoundaryIdx !== null && this.piecewiseBoundaries) {
        if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          if (!this._arrowPreSnap) {
            this._arrowPreSnap = this.getHistorySnapshot();
          }
          const pwStep = e.shiftKey ? 0.2 : 0.05;
          const idx = this.selectedPwBoundaryIdx;
          if (idx >= 0 && idx < this.piecewiseBoundaries.length) {
            let newX = this.piecewiseBoundaries[idx] + (e.key === 'ArrowRight' ? pwStep : -pwStep);
            const minX = idx > 0 ? this.piecewiseBoundaries[idx - 1] + 0.25 : -this.xSpan * 2;
            const maxX = idx < this.piecewiseBoundaries.length - 1 ? this.piecewiseBoundaries[idx + 1] - 0.25 : this.xSpan * 2;
            newX = Math.max(minX, Math.min(maxX, newX));
            newX = parseFloat(newX.toFixed(2));
            this.piecewiseBoundaries[idx] = newX;
            if (idx === 0) this.pwK = newX;
            this.updatePwDescBadge();
            this.render();
            return;
          }
        } else if (e.key === 'Escape') {
          this.selectedPwBoundaryIdx = null;
          this.render();
          return;
        }
      }

      if (!this.activeGraph) return;

      if (e.key === 'Tab' && (this.selectedHandleIdx !== null || this.isCurveSelected) && Array.isArray(this.activeGraph.handles)) {
        const visibleIdxs = [];
        this.activeGraph.handles.forEach((h, idx) => {
          if (h && !h.hidden) visibleIdxs.push(idx);
        });
        if (visibleIdxs.length > 0) {
          e.preventDefault();
          const curPos = visibleIdxs.indexOf(this.selectedHandleIdx);
          const dir = e.shiftKey ? -1 : 1;
          const nextPos = curPos === -1 ? 0 : (curPos + dir + visibleIdxs.length) % visibleIdxs.length;
          this.selectedHandleIdx = visibleIdxs[nextPos];
          this.isCurveSelected = true;
          this.startPulseLoop();
          this.render();
          return;
        }
      }

      const step = e.shiftKey ? 0.2 : 0.04;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!this._arrowPreSnap) {
          this._arrowPreSnap = this.getHistorySnapshot();
        }
      }

      if (this.selectedHandleIdx !== null) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          const h = this.activeGraph.handles[this.selectedHandleIdx];
          if (!h) return;
          let newX = h.x;
          let newY = h.y;
          if (e.key === 'ArrowUp') newY += step;
          else if (e.key === 'ArrowDown') newY -= step;
          else if (e.key === 'ArrowLeft') newX -= step;
          else if (e.key === 'ArrowRight') newX += step;

          // [대표님 핵심 기획]: 키보드 방향키 조작 시에는 자석 효과 및 모핑을 100% 완전 바이패스!
          this.axisSnapActiveX = false;
          this.axisSnapActiveY = false;
          this.symmetrySnapActive = false;
          this.snapActiveX = false;
          this.snapActiveY = false;
          this.snappedPoints = [];

          this.dragActiveHandle(this.selectedHandleIdx, newX, newY, true, true);
          this.syncControls();
          this.render();
        } else if (e.key === 'Escape') {
          this.selectedHandleIdx = null;
          this.render();
        }
      } else if (this.isCurveSelected) {
        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy += step;
        else if (e.key === 'ArrowDown') dy -= step;
        else if (e.key === 'ArrowLeft') dx -= step;
        else if (e.key === 'ArrowRight') dx += step;
        else if (e.key === 'Escape') {
          this.isCurveSelected = false;
          this.render();
          return;
        }

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          // 키보드로 몸통 이동 시 자석 스냅 잔상 리셋
          this.axisSnapActiveX = false;
          this.axisSnapActiveY = false;
          this.symmetrySnapActive = false;
          this.snapActiveX = false;
          this.snapActiveY = false;
          this.snappedPoints = [];

          if (this.isShapeCenterLocked(this.activeGraph)) {
            this.showCenterLockHint();
          } else {
            const ox = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.x === 'number') ? this.activeGraph.freezeOffset.x : 0;
            const oy = (this.activeGraph.freezeOffset && typeof this.activeGraph.freezeOffset.y === 'number') ? this.activeGraph.freezeOffset.y : 0;
            const hasTransforms = this.activeGraph.isAbsolute || (this.activeGraph.transforms && this.activeGraph.transforms.length > 0) || this.activeGraph.isFrozen || ox !== 0 || oy !== 0;

            if (hasTransforms) {
              if (!this.activeGraph.freezeOffset) this.activeGraph.freezeOffset = { x: 0, y: 0 };
              this.activeGraph.freezeOffset.x = Math.round((this.activeGraph.freezeOffset.x + dx) * 100) / 100;
              this.activeGraph.freezeOffset.y = Math.round((this.activeGraph.freezeOffset.y + dy) * 100) / 100;
              if (this.activeGraph.isAbsolute && this.activeGraph.isAbsPristine) {
                this.activeGraph.isAbsPristine = false;
                this.syncCurveContextBar();
                this.syncControls();
              }

              // 🔗 [역함수 대칭 연동: dx ↔ dy 스왑 평행이동]
              const partner = this.getLinkedPartner(this.activeGraph);
              if (partner) {
                if (!partner.freezeOffset) partner.freezeOffset = { x: 0, y: 0 };
                partner.freezeOffset.x = Math.round((partner.freezeOffset.x + dy) * 100) / 100;
                partner.freezeOffset.y = Math.round((partner.freezeOffset.y + dx) * 100) / 100;
              }
            } else {
              this.activeGraph.handles.forEach(h => {
                h.x += dx;
                h.y += dy;
              });

              // 🔗 [역함수 대칭 연동: 일반 함수 핸들 dx ↔ dy 스왑 평행이동]
              const partner = this.getLinkedPartner(this.activeGraph);
              if (partner && partner.handles) {
                partner.handles.forEach(h => {
                  h.x += dy;
                  h.y += dx;
                });
              }
            }
          }
          this.syncControls();
          this.render();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        const activeEl = document.activeElement;
        const isTextInput = activeEl && (
          (activeEl.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'color', 'file'].includes((activeEl.type || '').toLowerCase())) ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable
        );
        if (!isTextInput) {
          e.preventDefault();
          if (activeEl && activeEl !== document.body && typeof activeEl.blur === 'function') {
            try { activeEl.blur(); } catch (err) { }
          }
        }
        this.isSpacePressed = false;
        document.body.classList.remove('space-pan-ready');
        if (!this.isPointerDownOnCanvas) {
          this.isPanning = false;
          this.isBoardPanning = false;
          document.body.classList.remove('space-pan-dragging');
        }
        this.updateInkCursor();
      }
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.isShiftPressed = false;
        if (this.isInkMode) {
          this.updateInkCursor();
        }
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && this._pipArrowModifiedCardRef) {
        const modifiedRef = this._pipArrowModifiedCardRef;
        this._pipArrowModifiedCardRef = null;
        const snap = this._getMutablePipCardSnapshot(modifiedRef);
        if (snap) {
          this._savePipCardSnapshot(modifiedRef, snap);
        }
        this.scheduleBakePipGraphCardToImg(modifiedRef, 120);
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && this._arrowPreSnap) {
        const afterSnap = this.getHistorySnapshot();
        if (this._arrowPreSnap !== afterSnap) {
          this.undoStack.push(this._arrowPreSnap);
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];
          this.updateUndoRedoUI();
        }
        this._arrowPreSnap = null;
      }
    });

    window.addEventListener('blur', () => {
      this.isSpacePressed = false;
      this.isShiftPressed = false;
      document.body.classList.remove('space-pan-ready', 'space-pan-dragging');
      this.updateInkCursor();
    });

    // 휠 줌 및 칠판 무한 패닝
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      // 🌟 [대표님 1층 vs 2층 레이어 철학]:
      // 2층(this.isGraphCovered === true, 그래프 스샷 찍고 넘어간 새 판서 레이어)일 때만 휠 굴림으로 칠판 전체 이동!
      // 1층(!this.isGraphCovered, 실시간 그래프 편집 레이어)에서는 휠을 굴리면 원래대로 그래프 좌표축이 확대/축소(Zoom)!
      if (this.isGraphCovered && !this.pdfPageBoardData) {
        // 🌟 [대표님 피드백 반영]: 판서 모드에서 휠을 굴리면 문제/그래프 카드는 그대로 두고 판서(글씨·도형)만 마우스 커서 기준으로 확대/축소!
        const pos = getPos(e);
        const factor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
        this._isWheelZooming = true;
        if (this._wheelZoomIdleTimer) clearTimeout(this._wheelZoomIdleTimer);
        this._wheelZoomIdleTimer = setTimeout(() => {
          this._wheelZoomIdleTimer = null;
          this._isWheelZooming = false;
          this.requestRender();
        }, 160);
        this.setBoardZoom((this.boardZoom || 1.0) * factor, pos.x, pos.y);
        this.requestRender();
        return;
      }

      if (this.isGraphCovered && !this.pdfPageBoardData) return;

      if (this.useViewfinder && e.shiftKey) {
        const delta = e.deltaY < 0 ? 30 : -30;
        this.vfScreenW = Math.max(220, Math.min(this.screenWidth - 40, this.vfScreenW + delta));
        const sl = document.getElementById('sliderVfWidth');
        if (sl) sl.value = this.vfScreenW;
        const lbl = document.getElementById('lblVfWidth');
        if (lbl) lbl.textContent = `${Math.round(this.vfScreenW)} px`;
        this.render();
        return;
      }

      const pos = getPos(e);
      this._zoomMousePos = { x: pos.x, y: pos.y };

      const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      if (this.targetZoom === undefined || this.targetZoom === null) {
        this.targetZoom = this.zoomLevel;
      }
      this.targetZoom = Math.max(0.25, Math.min(4.0, this.targetZoom * factor));

      if (!this._isZoomAnimating) {
        this._isZoomAnimating = true;

        const animateZoom = () => {
          const continuing = this.stepZoomLerp();
          if (continuing) {
            requestAnimationFrame(animateZoom);
          }
        };

        requestAnimationFrame(animateZoom);
      }
    }, { passive: false });
  }

  // 🌟 [피그마/지오지브라급 Zoom-to-Cursor 부드러운 Lerp 수렴 물리 엔진] 🌟
  stepZoomLerp() {
    if (!this._isZoomAnimating) return false;
    const diff = this.targetZoom - this.zoomLevel;
    if (Math.abs(diff) < 0.001) {
      // 수렴 완료
      const oldZoom = this.zoomLevel;
      const newZoom = this.targetZoom;
      if (this._zoomMousePos && oldZoom > 0) {
        const ratio = newZoom / oldZoom;
        const boardOffsetX = (this.hasActiveProblemCard() && this.graphs && this.graphs.length > 0) ? (this.boardPanX || 0) : 0;
        const boardOffsetY = (this.hasActiveProblemCard() && this.graphs && this.graphs.length > 0) ? (this.boardPanY || 0) : 0;
        const cx = this.screenWidth / 2 + this.panX + boardOffsetX;
        const cy = this.screenHeight / 2 + this.panY + boardOffsetY;
        const deltaX = (this._zoomMousePos.x - cx) * (1 - ratio);
        const deltaY = (this._zoomMousePos.y - cy) * (1 - ratio);
        this.panX += deltaX;
        this.panY += deltaY;
        this.panOffset = { x: this.panX, y: this.panY };
      }
      this.zoomLevel = this.targetZoom;
      this._isZoomAnimating = false;

      const slZoom = document.getElementById('sliderZoom');
      if (slZoom) slZoom.value = this.zoomLevel;
      const lblZoom = document.getElementById('lblZoom');
      if (lblZoom) lblZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
      const lblInkZoom = document.getElementById('lblInkZoom');
      if (lblInkZoom) lblInkZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
      const lblLeftZoom = document.getElementById('lblLeftZoom');
      if (lblLeftZoom) lblLeftZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
      this._inkBakeDirty = true;
      this.requestRender();
      return false;
    }

    const oldZoom = this.zoomLevel;
    const step = diff * 0.25;
    const newZoom = oldZoom + step;

    if (this._zoomMousePos && oldZoom > 0) {
      const ratio = newZoom / oldZoom;
      const boardOffsetX = (this.hasActiveProblemCard() && this.graphs && this.graphs.length > 0) ? (this.boardPanX || 0) : 0;
      const boardOffsetY = (this.hasActiveProblemCard() && this.graphs && this.graphs.length > 0) ? (this.boardPanY || 0) : 0;
      const cx = this.screenWidth / 2 + this.panX + boardOffsetX;
      const cy = this.screenHeight / 2 + this.panY + boardOffsetY;
      const deltaX = (this._zoomMousePos.x - cx) * (1 - ratio);
      const deltaY = (this._zoomMousePos.y - cy) * (1 - ratio);
      this.panX += deltaX;
      this.panY += deltaY;
      this.panOffset = { x: this.panX, y: this.panY };
    }

    this.zoomLevel = newZoom;

    const slZoom = document.getElementById('sliderZoom');
    if (slZoom) slZoom.value = this.zoomLevel;
    const lblZoom = document.getElementById('lblZoom');
    if (lblZoom) lblZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    const lblInkZoom = document.getElementById('lblInkZoom');
    if (lblInkZoom) lblInkZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    const lblLeftZoom = document.getElementById('lblLeftZoom');
    if (lblLeftZoom) lblLeftZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    this._inkBakeDirty = true;
    this.requestRender();
    return true;
  }

  // --- [🚀 초고속 60/144 FPS VSync 스케줄러: 드래그 랙 & 스터터링 100% 박멸] ---
  requestRender() {
    if (this._renderPending) return;
    this._renderPending = true;
    requestAnimationFrame(() => {
      this._renderPending = false;
      if (this._pinchState && this._pinchState._hasPendingMove) {
        this._applyPendingTwoFingerPinchStep();
      }
      this.render();
    });
  }

  // --- [초고속 무결점 렌더링 파이프라인 (5개 겹쳐도 0.1ms 미만)] ---
  render(targetCtx = this.ctx, width = this.screenWidth, height = this.screenHeight, isExport = false) {
    if (this.isPdfModalOpen && !isExport && !this._isRenderingGraphSnapshot && targetCtx === this.ctx) return;
    if (this.isGraphCovered && !isExport && !this._isRenderingGraphSnapshot && targetCtx === this.ctx) {
      this.updateProblemCardPosition(true);
    }
    const ctx = targetCtx;
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;

    // 🌟 [iCanScreen 급 0.01ms 초저지연 필기 패스트패스 (Scene Freeze Fast-Path)] 🌟
    // 펜이나 형광펜으로 실제 필기 드로잉 중인 동안에는:
    // 520단계 함수 수식 연산(drawAllCurves), 격자(drawGuides), 축(drawAxes), 수선(drawDropLines), 텍스트 라벨을 매 프레임 다시 계산하지 않고,
    // 펜이 닿는 순간 동결해 둔 `sceneFreezeCanvas` 텍스처를 0.01ms 만에 Blit한 뒤 현재 긋고 있는 단 1개의 획만 그립니다!
    if (
      this.isDrawingInk &&
      this._hasSceneFreeze &&
      this.sceneFreezeCanvas &&
      this.currentInkStroke &&
      !isExport &&
      !this._isRenderingGraphSnapshot &&
      targetCtx === this.ctx
    ) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.sceneFreezeCanvas, 0, 0);
      ctx.restore();

      const isPdfClip = Boolean(this.isGraphCovered && this.pdfPageBoardData && this._lastPdfPageScreenRect && this._lastPdfPageScreenRect.w > 2);
      if (isPdfClip) {
        ctx.save();
        ctx.beginPath();
        const pr = this._lastPdfPageScreenRect;
        ctx.rect(pr.x, pr.y, pr.w, pr.h);
        ctx.clip();
      }

      this.renderSingleStroke(ctx, this.currentInkStroke, null, true);

      if (isPdfClip) {
        ctx.restore();
      }

      // 다크 칠판 위 흰색 문제 카드 영역 스마트 오토 컨트라스트
      const isLight = curTheme.isLight || this.isMonochromeMode;
      if (
        (this.currentInkStroke.target || 'board') === 'board' &&
        this.hasActiveProblemCard() &&
        !isLight &&
        !this.isMonochromeMode &&
        this.problemCardRect
      ) {
        const c = (this.currentInkStroke.color || '').toLowerCase();
        if (c === '#ffffff' || c === '#fff') {
          const r = this.problemCardRect;
          ctx.save();
          ctx.beginPath();
          ctx.rect(r.x, r.y, r.w, r.h);
          ctx.clip();
          this.renderSingleStroke(ctx, this.currentInkStroke, '#0f172a', true);
          ctx.restore();
        }
      }
      return;
    }

    if (this.isAudioRecording && !isExport && !this._isRenderingGraphSnapshot && targetCtx === this.ctx) {
      this._recordAudioWorkspaceStateIfNeeded();
    }

    if (isExport) {
      if (this.exportTransparent) {
        ctx.clearRect(0, 0, width, height);
      } else {
        const bg = this.isMonochromeMode ? '#ffffff' : curTheme.bg;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      // 🌟 [대표님 긴급 해결: 화면 깜빡임 100% 원천 박멸 (Zero-Flicker Architecture)] 🌟
      // PDF 통모드(페이지 모드)일 때는 종이 바깥 영역을 책상 베젤 색상으로 구분하여 PDF 용지 경계를 선명하게 표시!
      const isPdfPageDesk = Boolean(this.isGraphCovered && this.pdfPageBoardData && !this._isRenderingGraphSnapshot);
      const bg = isPdfPageDesk
        ? ((curTheme.isLight || this.isMonochromeMode) ? '#e2e8f0' : '#0b0f19')
        : (this.isMonochromeMode ? '#ffffff' : curTheme.bg);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }

    // 0.4. [📋 칠판 배경 속지 레이어 (무지 / 모눈 / 가로줄 / 도트): 판서 모드에서 칠판 이동·줌과 1:1 연동!]
    if (this.isGraphCovered && !this.pdfPageBoardData && !this._isRenderingGraphSnapshot) {
      this.drawBoardPaperBackground(ctx, width, height, curTheme);
    }

    // 0.5. [📌 크롭된 PDF 문제 캔버스 내부 레이어 (2층): 그래프 및 펜/형광펜 필기 아래에 깔려 문제 위 자유 판서 100% 보장!]
    this.drawProblemCardLayer(ctx, isExport);

    const expFilter = (isExport && this._activeExportFilter)
      ? this._activeExportFilter
      : { includeProblem: true, includeGraph: true, includeInk: true };

    const isViewerGraphTouch = Boolean(typeof document !== 'undefined' && document.body && document.body.classList.contains('viewer-graph-touch-mode'));

    // 0.6. [📄 PDF 페이지 통째 칠판 레이어 (0.5층): 개념서/교재 페이지 위 자유 확대·축소·판서 및 실시간 그래프/스샷 카드 완벽 호환!]
    if (this.pdfPageBoardData && !this._isRenderingGraphSnapshot && !isViewerGraphTouch) {
      if (expFilter.includeProblem !== false) {
        this.drawPdfPageBoardLayer(ctx, isExport);
      } else {
        const { mathW, mathH } = this.pdfPageBoardData;
        const cx = this.pdfPageBoardData.centerX || 0;
        const cy = this.pdfPageBoardData.centerY || 0;
        const tl = this.mathToScreen(cx - mathW / 2, cy + mathH / 2);
        const br = this.mathToScreen(cx + mathW / 2, cy - mathH / 2);
        this._lastPdfPageScreenRect = {
          x: Math.min(tl.x, br.x),
          y: Math.min(tl.y, br.y),
          w: Math.abs(br.x - tl.x),
          h: Math.abs(br.y - tl.y)
        };
      }
    }

    // 🌟 [2-Layer 아키텍처 & 정사각형 좌표평면 (Square Coordinate Plane)] 🌟
    if (!isExport) {
      this.syncGraphSnapBarUI();
    }

    // 🌟 [칠판 덮개(isGraphCovered) 활성 시 밑의 실시간 그래프 작업실을 100% 덮고 백지 칠판/PDF 페이지만 표출!] 🌟
    // PDF 통모드(this.pdfPageBoardData)에서는 필기와 카드가 반드시 PDF 용지 영역(_lastPdfPageScreenRect) 내부로 클리핑됩니다!
    if (this.isGraphCovered && !this._isRenderingGraphSnapshot) {
      const pdfClipRect = (this.pdfPageBoardData && this._lastPdfPageScreenRect && this._lastPdfPageScreenRect.w > 2)
        ? this._lastPdfPageScreenRect
        : null;
      if (isExport && !this.useViewfinder) {
        if (pdfClipRect) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(pdfClipRect.x, pdfClipRect.y, pdfClipRect.w, pdfClipRect.h);
          ctx.clip();
        }
        this.drawFloatingCardsForExport(ctx, expFilter);
        if (expFilter.includeInk !== false) {
          if (this.pdfPageBoardData) {
            this.drawInkStrokes(ctx, true, 'graph');
          }
          this.drawInkStrokes(ctx, true, 'board');
          this.drawBoardStickers(ctx, true);
        }
        if (pdfClipRect) {
          ctx.restore();
        }
        return;
      }
      if (!isExport) {
        this.syncCurveContextBar();
        if (pdfClipRect) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(pdfClipRect.x, pdfClipRect.y, pdfClipRect.w, pdfClipRect.h);
          ctx.clip();
        }
        if (this.pdfPageBoardData) {
          this.drawInkStrokes(ctx, false, 'graph');
        }
        this.drawInkStrokes(ctx, false, 'board');
        this.drawBoardStickers(ctx, false);
        if (pdfClipRect) {
          ctx.restore();
        }
        this.drawMainLaserStrokes(ctx);
        this.drawLassoOverlay(ctx);
        return;
      }
    }

    // 🌟 실시간 그래프 작업 중에는 그 어떤 좌우/상하 잘림(막)도 없이 100% 전체화면 무제한 렌더링!
    // 오직 스샷 캡처 순간(_isRenderingGraphSnapshot)에만 드래그 박스 테두리에 맞춰 화살촉(▶, ▲)을 배치합니다.
    const squareBounds = this._isRenderingGraphSnapshot
      ? this._snapshotCropBounds
      : null;

    if (squareBounds) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(squareBounds.minX, squareBounds.minY, squareBounds.w, squareBounds.h);
      ctx.clip();
    }

    // 1. 점선 그리드 가이드 (정사각형 내부에만 단정하게 표시)
    if (this.showGuides && !this.isCleanView) {
      this.drawGuides(ctx);
    }

    // 1.5. y = x 항등직선 대칭 기준선 (역함수 모드)
    if (this.showInverseGuide && !this.isCleanView) {
      this.drawInverseGuide(ctx);
    }

    const hasGraphs = Boolean(this.graphs && this.graphs.length > 0);

    // 2. 점근선 렌더링 (모든 관련 그래프 점근선 표시)
    if (hasGraphs && this.showAsymptotes) {
      this.drawAllAsymptotes(ctx);
    }

    // 3. 좌표축 & 화살표 (정사각형 끝단에 화살촉 및 x·y 이름표 칼같이 배치!)
    if (this.showAxes) {
      this.drawAxes(ctx, squareBounds);
    }

    // 3.5. 그리드 눈금 숫자 표시 (확대·축소에 비례하여 크기가 함께 조절되는 단정한 좌표 숫자)
    if (this.showGridNumbers && !this.isCleanView) {
      this.drawGridNumbers(ctx, squareBounds);
    }

    // 4. 대칭의 중심 (활성 그래프 변곡점/점근선교점 등 은은한 십자선 마커)
    if (hasGraphs && !this.isCleanView) {
      this.drawSymmetryCenters(ctx, isExport);
    }

    // 5. 다중 곡선 렌더링 (정사각형 범위 내에서만 깔끔하게 렌더링되어 우측 판서 공간 침범 제로!)
    if (hasGraphs) {
      this.drawAllCurves(ctx, isExport);
    }

    // 5.2. [대표님 킬러 기획: ✂️ 구간별 합성 함수 (Piecewise) 경계선 가이드 & 끝점 동그라미(●/○)]
    if (this.usePiecewise) {
      this.drawPiecewiseBoundaries(ctx, isExport);
    }

    // 5.8. [📍 교재 보조 수선 & 축 좌표 라벨 시스템 - 1클릭 x·y 수선 & 가위 삭둑 & 수식 라벨]
    if ((this.dropLines && this.dropLines.length > 0) || this.isDropLineMode) {
      this.drawDropLines(ctx, isExport);
    }

    if (squareBounds) {
      ctx.restore(); // 정사각형 그래프 클리핑 해제 -> 이후 요소(교점, 수식 라벨, 필기, 핸들러)는 전체화면 무제한 렌더링!
    }

    // 5.5. [⚡ 실시간 교점판독기 - 교점/접점 반짝임 & 화면 밖 추적]
    if (hasGraphs && this.useIntersectionDetector) {
      if (!this.isDrawingInk) {
        this.updateIntersections();
      }
      this.drawIntersections(ctx, isExport);
    }

    // 5.9. [🔤 캔버스 자유 수식 텍스트 라벨 (함수 이름표 y=f(x) & 축 이름표)]
    if (this.textLabels && this.textLabels.length > 0) {
      this.drawTextLabels(ctx, isExport);
    }

    // 🌟 [실시간 그래프 작업실 및 뷰어 그래프 확대 조작 모드 전용 필기 렌더링 (PDF 페이지 위에서 그래프 스샷 캡처 순간에는 배경 필기 생략)] 🌟
    if (!(this._isRenderingGraphSnapshot && this.pdfPageBoardData) && (!isExport || expFilter.includeInk !== false)) {
      this.drawInkStrokes(ctx, isExport, 'graph');
      if (!isViewerGraphTouch) {
        this.drawBoardStickers(ctx, isExport);
      }
    }

    // 🌟 [내보내기/복사 시 화면에 떠 있는 문제 카드 & 그래프 카드 합성] 🌟
    if (isExport && !this._isRenderingGraphSnapshot && !this.useViewfinder) {
      this.drawFloatingCardsForExport(ctx, expFilter);
    }

    // 🌟 [전역 레이저 포인터 잔상 & 올가미(Lasso) 점선 오버레이 최상단 렌더링] 🌟
    if (!isExport && !this._isRenderingGraphSnapshot) {
      this.drawMainLaserStrokes(ctx);
      this.drawLassoOverlay(ctx);
    }

    // 6. 인터랙티브 조작 핸들 & 캡처영역 (내보내기 시, 스샷 촬영 시 및 클린뷰 시에는 숨김)
    if (!isExport && !this.isCleanView && !this._isRenderingGraphSnapshot) {
      // 🌟 [대표님 핵심 기획]: 필기 버튼(펜/형광펜/지우개)을 누르자마자 핸들러 즉시 증발!
      // 펜으로 글씨를 긋는 도중이거나 필기 도구가 켜져 있을 때는 조작 핸들을 화면에서 100% 프리징(숨김)!
      // 오직 선택 도구(select)이거나 일반 마우스 모드일 때만 그래프 선택 시 핸들러 노출!
      const isWritingTool = (this.isInkMode && this.activeInkTool !== 'select');
      if (isWritingTool) {
        this.selectedHandleIdx = null;
        this.draggedHandleIdx = null;
      }
      if (!this.isDrawingInk && !isWritingTool) {
        this.drawHandles(ctx);
        if (this.useViewfinder) {
          this.drawViewfinder(ctx);
        }
      }
      // 🌟 [우측 하단 작은 사이즈 조절기(◢) & 위치 이동(✥) 컨트롤 배지] 🌟
      this.drawCompactStageControls(ctx);
    }
  }

  _ensureMainLaserLoop() {
    if (this._mainLaserRafId) return;
    const step = () => {
      this._mainLaserRafId = null;
      this.render();
      const hasActiveLive = Array.isArray(this.mainLaserStrokes) && this.mainLaserStrokes.length > 0;
      if (hasActiveLive && !this._mainLaserRafId) {
        this._mainLaserRafId = requestAnimationFrame(step);
      }
    };
    this._mainLaserRafId = requestAnimationFrame(step);
  }

  drawMainLaserStrokes(ctx) {
    const HOLD_MS = 1650;
    const FADE_MS = 750;
    const nowPerf = performance.now();

    const drawSmoothScreenLaser = (screenPts, life) => {
      if (!screenPts || screenPts.length === 0 || life <= 0.01) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = life;
      ctx.strokeStyle = '#dc2626';
      ctx.fillStyle = '#dc2626';
      ctx.lineWidth = 2.6;
      if (screenPts.length === 1) {
        ctx.beginPath();
        ctx.arc(screenPts[0].x, screenPts[0].y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(screenPts[0].x, screenPts[0].y);
        if (screenPts.length === 2) {
          ctx.lineTo(screenPts[1].x, screenPts[1].y);
        } else {
          const firstMx = (screenPts[0].x + screenPts[1].x) * 0.5;
          const firstMy = (screenPts[0].y + screenPts[1].y) * 0.5;
          ctx.lineTo(firstMx, firstMy);
          for (let i = 1; i < screenPts.length - 1; i++) {
            const mx = (screenPts[i].x + screenPts[i + 1].x) * 0.5;
            const my = (screenPts[i].y + screenPts[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(screenPts[i].x, screenPts[i].y, mx, my);
          }
          const last = screenPts[screenPts.length - 1];
          ctx.lineTo(last.x, last.y);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    // 1) 음성/화면 재생 모드일 때 녹화된 메인 칠판 레이저 스트로크 재현
    if (this._isAudioReplayActive && this.audioSyncData && Array.isArray(this.audioSyncData.laserStrokes)) {
      const playMs = this.audioPlayCurrentMs || 0;
      const mainLasers = this.audioSyncData.laserStrokes.filter(ls => ls && ls.cardKey === 'main_canvas');
      for (let i = 0; i < mainLasers.length; i++) {
        const ls = mainLasers[i];
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
        const isBoard = Boolean(ls.isBoard);
        const sPts = rep.stroke.points.map(pt => isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y));
        if (rep.isCurrentlyWriting && rep.tipPoint) {
          const tipS = isBoard ? this.boardToScreen(rep.tipPoint.x, rep.tipPoint.y) : this.mathToScreen(rep.tipPoint.x, rep.tipPoint.y);
          this._activeReplayTipScreen = {
            x: tipS.x,
            y: tipS.y,
            color: '#dc2626',
            isHighlighter: false,
            isLaser: true
          };
        }
        drawSmoothScreenLaser(sPts, life);
      }
    }

    // 2) 실시간 메인 칠판 레이저 스트로크 렌더링 및 소멸 정리
    if (!Array.isArray(this.mainLaserStrokes) || this.mainLaserStrokes.length === 0) return;
    this.mainLaserStrokes = this.mainLaserStrokes.filter(st => {
      if (!st || !st.points || st.points.length === 0) return false;
      if (!st.finished) return true;
      return (nowPerf - (st.finishedAt || nowPerf)) < (HOLD_MS + FADE_MS);
    });

    this.mainLaserStrokes.forEach(st => {
      let life = 1.0;
      if (st.finished) {
        const elapsed = Math.max(0, nowPerf - (st.finishedAt || nowPerf));
        if (elapsed > HOLD_MS) {
          const t = Math.min(1, (elapsed - HOLD_MS) / FADE_MS);
          life = Math.pow(1 - t, 1.45);
        }
      }
      if (life <= 0.01) return;
      const isBoard = Boolean(st.isBoard);
      const sPts = st.points.map(pt => isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y));
      drawSmoothScreenLaser(sPts, life);
    });
  }

  // --- [⚡ 실시간 교점판독기: 교점 데이터 갱신 엔진] ---
  updateIntersections() {
    if (!this.useIntersectionDetector || this.isGraphCovered) {
      this.detectedIntersections = [];
      return;
    }

    const g1 = this.activeGraph;
    if (!g1 || !g1.handles || g1.handles.length === 0) {
      this.detectedIntersections = [];
      return;
    }

    // 🚀 [0.00ms 시그니처 캐싱]: 펄스 애니메이션(60fps)이나 단순 마우스 이동 시 그래프·카메라가 변하지 않았다면
    // 5000스텝 수치해석(findIntersections)을 재실행하지 않고 캐시를 즉시 반환!
    const sigParts = [
      Math.round(this.screenWidth || 0),
      Math.round(this.screenHeight || 0),
      Math.round((this.panX || 0) * 100),
      Math.round((this.panY || 0) * 100),
      Math.round((this.zoomLevel || 1) * 1000),
      Math.round((this.xSpan || 8.5) * 1000),
      Math.round((this.ySpan || 6.0) * 1000),
      this.activeGraphIdx,
      this.showXAxis !== false ? 1 : 0,
      this.usePiecewise ? 1 : 0,
      this.isPiecewisePeriodic ? 1 : 0,
      this.periodicStepY || 0,
      (this.piecewiseBoundaries || []).join(','),
      (this.piecewiseFuncMap || []).join(',')
    ];
    for (let i = 0; i < this.graphs.length; i++) {
      const g = this.graphs[i];
      if (!g) continue;
      const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
      const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
      const hSig = (g.handles || []).map(h => `${h.x.toFixed(4)}:${h.y.toFixed(4)}:${h.type}:${h.hidden ? 1 : 0}`).join(';');
      const tSig = (g.transforms || []).map(t => `${t.type || ''}:${t.offset ? t.offset.x : 0}:${t.offset ? t.offset.y : 0}:${t.invertH ? 1 : 0}:${t.invertV ? 1 : 0}:${t.absolute ? 1 : 0}`).join(';');
      sigParts.push(`${g.id}|${g.type}|${g.color}|${g.isAbsolute ? 1 : 0}|${g.isFrozen ? 1 : 0}|${g.frozenInvertH ? 1 : 0}|${g.frozenInvertV ? 1 : 0}|${g.frozenAbsolute ? 1 : 0}|${g.isIndependent ? 1 : 0}|${ox.toFixed(4)},${oy.toFixed(4)}|${hSig}|${tSig}`);
    }
    const cacheSig = sigParts.join('||');
    if (this._intersectionCacheSig === cacheSig && Array.isArray(this._intersectionCacheList)) {
      this.detectedIntersections = this._intersectionCacheList;
      return;
    }

    // [대표님 기획]: 교점판독기는 수업 시간 라이브 시연 도구이므로, 
    // 화면 밖 교점 판정은 뷰파인더(캡처영역)가 아닌 '실제 캔버스 전체 화면' 기준!
    // 또한 화면 끝(0px)에 딱 닿기 전 가장자리 근처(32px 마진)에 오면 화면 밖으로 판정하여 끝단 테두리 발광!
    const screenMargin = 32;
    const ptScreenMin = this.screenToMath(screenMargin, this.screenHeight - screenMargin);
    const ptScreenMax = this.screenToMath(this.screenWidth - screenMargin, screenMargin);

    const screenRect = {
      xmin: Math.min(ptScreenMin.x, ptScreenMax.x),
      xmax: Math.max(ptScreenMin.x, ptScreenMax.x),
      ymin: Math.min(ptScreenMin.y, ptScreenMax.y),
      ymax: Math.max(ptScreenMin.y, ptScreenMax.y)
    };

    const rangeX = { xmin: screenRect.xmin, xmax: screenRect.xmax };
    const allRoots = [];

    // 비교 대상: 다른 그래프 레이어들 (없으면 x축 y=0 기준선)
    const otherGraphs = this.graphs.filter((_, i) => i !== this.activeGraphIdx);

    if (otherGraphs.length > 0) {
      // [대표님 핵심 기획: 구간별 합성 함수 vs 독립 관찰 곡선(직선 등) 지능형 실시간 교점 탐색]
      const isPwActive = this.usePiecewise && this.graphs.length >= 1;
      const g1Idx = this.activeGraphIdx;
      const isG1Indep = Boolean(g1.isIndependent);

      // 이미 계산된 쌍을 추적하여 중복 방지
      const processedPairs = new Set();

      const checkAndAddRoots = (mainG, mainIdx, targetG, targetIdx) => {
        const pairKey = mainIdx < targetIdx ? `${mainIdx}-${targetIdx}` : `${targetIdx}-${mainIdx}`;
        if (processedPairs.has(pairKey)) return;
        processedPairs.add(pairKey);

        const roots = this.engine.findIntersections(mainG, targetG, rangeX, screenRect);
        roots.forEach(r => {
          if (isPwActive) {
            const isMainVisible = this.isInsidePiece(mainIdx, r.x);
            const isTargetVisible = this.isInsidePiece(targetIdx, r.x);
            if (!isMainVisible || !isTargetVisible) {
              return;
            }
          }
          r.targetName = this.meta[targetG.type]?.name || '함수';
          r.targetColor = targetG.color;
          allRoots.push(r);
        });
      };

      // 1. 기본: activeGraph(g1)와 다른 모든 otherG의 교점
      otherGraphs.forEach(otherG => {
        const otherGIdx = this.graphs.indexOf(otherG);
        checkAndAddRoots(g1, g1Idx, otherG, otherGIdx);
      });

      // 2. [에듀테크 킬러]: g1이 구간 참여 함수이고 화면에 독립 관찰 곡선(직선 등)이 존재하는 경우,
      //    구간을 함께 이루는 다른 형제 조각들(siblingG)과 해당 독립 곡선 사이의 교점도 자동 통합 수집!
      if (isPwActive && !isG1Indep) {
        const indepGraphs = this.graphs.filter(g => g.isIndependent);
        if (indepGraphs.length > 0) {
          const siblingGraphs = this.graphs.filter((g, i) => !g.isIndependent && i !== g1Idx);
          indepGraphs.forEach(indepG => {
            const indepIdx = this.graphs.indexOf(indepG);
            siblingGraphs.forEach(sibG => {
              const sibIdx = this.graphs.indexOf(sibG);
              checkAndAddRoots(sibG, sibIdx, indepG, indepIdx);
            });
          });
        }
      }
    } else if (this.showXAxis !== false) {
      // 단일 그래프일 때는 x축과의 교점(실근) 판독 (x축이 표시되어 있을 때만)
      const roots = this.engine.findIntersections(g1, null, rangeX, screenRect);
      roots.forEach(r => {
        if (this.usePiecewise && this.graphs.length >= 2) {
          if (!this.isInsidePiece(this.activeGraphIdx, r.x)) {
            return;
          }
        }
        r.targetName = 'x축';
        r.targetColor = '#ffffff';
        allRoots.push(r);
      });
    }

    // 중복 검출 제거 (화면 배율에 비례: 기본 가시폭 30 기준 0.025와 동일한 감도)
    const dedupeEps = Math.max(1e-6, (rangeX.xmax - rangeX.xmin) * 0.0008);
    const deduped = [];
    allRoots.forEach(r => {
      const exist = deduped.find(d => Math.abs(d.x - r.x) < dedupeEps && Math.abs(d.y - r.y) < dedupeEps);
      if (!exist) {
        deduped.push(r);
      } else {
        if (r.type === 'tangent' && exist.type !== 'overlap') exist.type = 'tangent';
        if (r.type === 'overlap') exist.type = 'overlap';
      }
    });

    this._intersectionCacheSig = cacheSig;
    this._intersectionCacheList = deduped;
    this.detectedIntersections = deduped;
  }

  // --- [⚡ 실시간 교점판독기: 반짝거리는 펄스 링, 화면 밖 끝단 지시자, 플로팅 카운터 렌더링] ---
  drawIntersections(ctx, isExport = false) {
    // [대표님 지침]: 스샷/내보내기(isExport)에서는 교점을 보여줄 필요 없음 (오직 실시간 수업용)
    if (!this.useIntersectionDetector || isExport) return;

    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
    const isLight = Boolean(curTheme.isLight || this.isMonochromeMode);
    const pulseFactor = 0.5 + 0.5 * Math.sin(this.intersectionAnimPhase); // 0.0 ~ 1.0 부드러운 맥동

    let onScreenCount = 0;
    let offScreenCount = 0;
    let tangentCount = 0;
    let overlapCount = 0;

    ctx.save();

    this.detectedIntersections.forEach(pt => {
      if (pt.type === 'tangent') tangentCount++;
      if (pt.type === 'overlap') overlapCount++;

      if (!pt.isOffscreen) {
        onScreenCount++;
        // --- [A. 화면 내부 교점: 반짝거리는 펄스 링 & 핀 마커 (테마별 고대비 컬러 자동 분기)] ---
        const s = this.mathToScreen(pt.x, pt.y);

        // 🌟 [대표님 피드백 반영]:
        // - 밝은(화이트) 바탕: 은은하고 세련된 아메시스트 보라(#7c3aed, 접점은 오키드 퍼플 #c026d3) + 화이트 마이크로 후광
        // - 어두운(다크) 바탕: 별처럼 반짝이는 골드 옐로우(#feca57, 접점은 네온 오렌지 #ff9f43)
        const mainColor = isLight
          ? (pt.type === 'tangent' ? '#c026d3' : '#7c3aed')
          : (pt.type === 'tangent' ? '#ff9f43' : '#feca57');
        const ringColor = isLight
          ? (pt.type === 'tangent' ? 'rgba(192, 38, 211, 0.78)' : 'rgba(124, 58, 237, 0.78)')
          : mainColor;
        const glowColor = isLight
          ? (pt.type === 'tangent' ? 'rgba(192, 38, 211, 0.35)' : 'rgba(139, 92, 246, 0.35)')
          : mainColor;

        // 1. 반짝이는 외부 펄스 링 (Twinkle Pulse Ring)
        const ringR = 5.0 + pulseFactor * 4.2; // 5.0 ~ 9.2px
        ctx.save();
        if (isLight) {
          // 밝은 배경에서는 은은한 라벤더 오라(Aura) 채우기를 살짝 깔아 시인성과 고급스러움 극대화
          ctx.fillStyle = pt.type === 'tangent'
            ? `rgba(192, 38, 211, ${0.10 + pulseFactor * 0.08})`
            : `rgba(124, 58, 237, ${0.10 + pulseFactor * 0.08})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = ringColor;
        ctx.fillStyle = mainColor;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isLight ? (3 + pulseFactor * 4) : (4 + pulseFactor * 5);
        ctx.lineWidth = isLight ? 1.5 : 1.3;

        ctx.beginPath();
        ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // 2. 내부 중심 마커 (접점은 다이아몬드, 관통은 원형 점)
        if (pt.type === 'tangent') {
          const dR = 3.2;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - dR);
          ctx.lineTo(s.x + dR, s.y);
          ctx.lineTo(s.x, s.y + dR);
          ctx.lineTo(s.x - dR, s.y);
          ctx.closePath();
          if (isLight) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.0;
            ctx.stroke();
          }
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(s.x, s.y, isLight ? 2.8 : 2.4, 0, Math.PI * 2);
          if (isLight) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.8;
            ctx.stroke();
          }
          ctx.fill();
        }
        ctx.restore();

      } else {
        offScreenCount++;
        // --- [B. 대표님 킬러 기획: 화면 가장자리/바깥 교점 -> 화면 끝단 테두리에서 반짝거림!] ---
        const borderScreen = this.mathToScreen(pt.borderX, pt.borderY);
        const pad = 20;
        const clampedX = Math.max(pad, Math.min(this.screenWidth - pad, borderScreen.x));
        const clampedY = Math.max(pad, Math.min(this.screenHeight - pad, borderScreen.y));

        const offAccent = isLight ? '#7c3aed' : '#ff6b6b';
        const offGlow = isLight ? 'rgba(124, 58, 237, 0.35)' : 'rgba(255, 107, 107, 0.6)';

        ctx.save();
        ctx.strokeStyle = offAccent;
        ctx.fillStyle = offAccent;
        ctx.shadowColor = offGlow;
        ctx.shadowBlur = 4 + pulseFactor * 5;

        // 끝단 펄스 링
        const ringR = 4.2 + pulseFactor * 4.0;
        ctx.beginPath();
        ctx.arc(clampedX, clampedY, ringR, 0, Math.PI * 2);
        ctx.lineWidth = isLight ? 1.4 : 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(clampedX, clampedY, 2.3, 0, Math.PI * 2);
        ctx.fill();

        // 방향 화살표 배지 (예: '◀ 화면 밖')
        let arrow = '◀';
        if (pt.side === 'right') arrow = '▶';
        else if (pt.side === 'top') arrow = '▲';
        else if (pt.side === 'bottom') arrow = '▼';

        const offLabel = `${arrow} 화면 밖`;
        ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
        const textW = ctx.measureText(offLabel).width;
        let bx = clampedX + (pt.side === 'right' ? -textW - 14 : 10);
        let by = clampedY - 8;
        if (bx < 10) bx = 10;
        if (bx + textW + 8 > this.screenWidth - 10) bx = this.screenWidth - textW - 18;

        ctx.fillStyle = isLight ? 'rgba(245, 243, 255, 0.96)' : 'rgba(28, 16, 22, 0.88)';
        ctx.strokeStyle = isLight ? 'rgba(124, 58, 237, 0.55)' : 'rgba(255, 107, 107, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, textW + 8, 16, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isLight ? '#6d28d9' : '#ff6b6b';
        ctx.textBaseline = 'middle';
        ctx.fillText(offLabel, bx + 4, by + 8);
        ctx.restore();
      }
    });

    ctx.restore();

    // [대표님 지침]: 수업 시선 분산 및 순간적 오차 방지를 위해 화면 상단 교점 개수 종합 플로팅 배지는 비활성화.
    // 강사가 캔버스 위의 반짝이는 교점 마커들을 직접 직관적으로 눈으로 판독하도록 함.
  }

  // 🌟 [문제 카드 활성 시: 경계선 없는 자유 비율 칠판 일체형 컴팩트 스테이지 계산] 🌟
  // 대표님 기획: 정사각형에 국한되지 않고 가로길게 / 세로길게 자유 비율 지원!
  // 문제가 플로팅되어 있으므로 그래프를 문제 바로 밑이나 문제 뒤로 겹쳐서 배치하는 것도 100% 완전 자유 허용!
  // 🌟 [교재 삽도형 정사각형 좌표평면 바운딩 엔진 (Square Graph Bounds)] 🌟
  // 창 테두리나 별도 윈도우(레이어) 없이, 좌표평면 중심(cx, cy) 기준으로
  // 가로·세로 1:1 정사각형 영역 안에서만 축과 그래프 선이 단정하게 그려지도록 바운딩을 제공합니다.
  // 🌟 [y축(원점) 기준 좌우 1:1 대칭 스팬 엔진 (Origin-Symmetric Horizontal Span)] 🌟
  // 상하(위아래)는 자르지 않아 답답한 '네모칸' 느낌을 100% 없애고,
  // 원점이 화면 중앙에 있을 때는 좌우 100% 전체화면(데스모스 스타일),
  // 그래프를 왼쪽이나 오른쪽으로 밀면 y축 기준 1:1 좌우 대칭 길이만큼만 x축(▶)과 곡선을 그려
  // 반대편에 광활하고 깨끗한 빈 판서 공간을 자동으로 열어줍니다!
  getSquareGraphBounds() {
    return {
      minX: 0,
      maxX: this.screenWidth,
      minY: 0,
      maxY: this.screenHeight,
      x: 0,
      y: 0,
      w: this.screenWidth,
      h: this.screenHeight,
      isCustomized: false
    };
  }

  getCompactGraphStage() {
    return this.getSquareGraphBounds();
  }

  isInsideCompactStage(pos) {
    if (!pos || !this.graphs || this.graphs.length === 0) return false;
    const sq = this.getSquareGraphBounds();
    return (
      pos.x >= sq.minX &&
      pos.x <= sq.maxX &&
      pos.y >= sq.minY &&
      pos.y <= sq.maxY
    );
  }

  // 🌟 [판서 모드 전용 좌표 변환 & 독립 줌 엔진: 문제/그래프 카드는 그대로 두고 판서 글씨·도형만 확대/축소!] 🌟
  boardToScreen(bx, by) {
    const bz = this.boardZoom || 1.0;
    return {
      x: bx * bz + (this.boardZoomOffsetX || 0) + (this.boardPanX || 0),
      y: by * bz + (this.boardZoomOffsetY || 0) + (this.boardPanY || 0)
    };
  }

  screenToBoard(sx, sy) {
    const bz = this.boardZoom || 1.0;
    return {
      x: (sx - (this.boardPanX || 0) - (this.boardZoomOffsetX || 0)) / bz,
      y: (sy - (this.boardPanY || 0) - (this.boardZoomOffsetY || 0)) / bz
    };
  }

  setBoardZoom(nextZoom, pivotScreenX = null, pivotScreenY = null) {
    const oldZoom = this.boardZoom || 1.0;
    const clamped = Math.max(0.25, Math.min(3.5, Math.round(nextZoom * 100) / 100));
    if (Math.abs(clamped - oldZoom) < 0.001) return clamped;
    const px = (typeof pivotScreenX === 'number') ? pivotScreenX : ((this.screenWidth || window.innerWidth) / 2);
    const py = (typeof pivotScreenY === 'number') ? pivotScreenY : ((this.screenHeight || window.innerHeight) / 2);
    const bx = (px - (this.boardPanX || 0) - (this.boardZoomOffsetX || 0)) / oldZoom;
    const by = (py - (this.boardPanY || 0) - (this.boardZoomOffsetY || 0)) / oldZoom;
    this.boardZoom = clamped;
    this.boardZoomOffsetX = px - (this.boardPanX || 0) - bx * clamped;
    this.boardZoomOffsetY = py - (this.boardPanY || 0) - by * clamped;
    this._inkBakeDirty = true;
    this._hasSceneFreeze = false;
    this.updateProblemCardPosition(true);
    return clamped;
  }

  _startCanvasTwoFingerPinch(p1, p2) {
    // 🛡️ 애플펜슬로 필기 중일 때는 어떤 경우에도 획을 취소(pop)하거나 핀치를 시작하지 않음!
    if (this.isDrawingInk || this.isStylusDrawing || this.isLassoSelecting) {
      return;
    }
    this.draggedHandleIdx = null;
    this.isDraggingCurve = false;
    this._curveDragEligible = false;
    this.activePwDragIdx = null;
    this.isDraggingTextLabel = false;
    this.draggedTextLabelId = null;
    this.isResizingStage = false;
    this.isMovingStage = false;
    this._isAimingDropLine = false;
    this.isPdfToGraphCropDragging = false;
    this.isGraphSnapDragging = false;
    this._preDragState = null;
    this.downInfo = null;
    this.isPanning = false;
    this.isBoardPanning = false;

    const cRect = this.canvasRect || (this.canvas ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 });
    const x1 = p1.x - cRect.left;
    const y1 = p1.y - cRect.top;
    const x2 = p2.x - cRect.left;
    const y2 = p2.y - cRect.top;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dist = Math.max(24, Math.hypot(x2 - x1, y2 - y1));
    this._pinchState = {
      id1: p1.id,
      id2: p2.id,
      panUnlocked: false,
      zoomUnlocked: false,
      initX1: x1,
      initY1: y1,
      initX2: x2,
      initY2: y2,
      initMidX: midX,
      initMidY: midY,
      initDist: dist,
      startDist: dist,
      smoothDist: dist,
      startZoom: this.zoomLevel || 1.0,
      startBoardZoom: this.boardZoom || 1.0,
      startBoardZoomOffsetX: this.boardZoomOffsetX || 0,
      startBoardZoomOffsetY: this.boardZoomOffsetY || 0,
      startMidX: midX,
      startMidY: midY,
      smoothMidX: midX,
      smoothMidY: midY,
      startPanX: this.panX || 0,
      startPanY: this.panY || 0,
      startBoardPanX: this.boardPanX || 0,
      startBoardPanY: this.boardPanY || 0,
      latestP1: { id: p1.id, x: p1.x, y: p1.y },
      latestP2: { id: p2.id, x: p2.x, y: p2.y },
      _hasPendingMove: false
    };
  }

  _moveCanvasTwoFingerPinch(p1, p2) {
    // 🛡️ _pinchState가 없거나 필기 중일 때는 절대 move 이벤트에서 핀치를 자동 생성하지 않음!
    if (!this._pinchState || this.isDrawingInk || this.isStylusDrawing || this.isLassoSelecting) {
      return;
    }
    // 포인터 배열 순서가 바뀌었더라도 ID 쌍이 같으면 정렬하고, 포인터 ID 자체가 바뀐 경우에만 기준점을 부드럽게 재설정!
    let ptA = p1;
    let ptB = p2;
    if (
      p1.id !== undefined && p2.id !== undefined &&
      this._pinchState.id1 !== undefined && this._pinchState.id2 !== undefined
    ) {
      if (p1.id === this._pinchState.id2 && p2.id === this._pinchState.id1) {
        ptA = p2;
        ptB = p1;
      } else if (p1.id !== this._pinchState.id1 || p2.id !== this._pinchState.id2) {
        this._startCanvasTwoFingerPinch(p1, p2);
        return;
      }
    }

    this._pinchState.latestP1 = { id: ptA.id, x: ptA.x, y: ptA.y };
    this._pinchState.latestP2 = { id: ptB.id, x: ptB.x, y: ptB.y };
    if (!this._pinchState.panUnlocked && !this._pinchState.zoomUnlocked) {
      const cRect = this.canvasRect || (this.canvas ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 });
      const midX = ((ptA.x - cRect.left) + (ptB.x - cRect.left)) * 0.5;
      const midY = ((ptA.y - cRect.top) + (ptB.y - cRect.top)) * 0.5;
      const dist = Math.max(24, Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y));
      if (Math.hypot(midX - this._pinchState.initMidX, midY - this._pinchState.initMidY) < 10 && Math.abs(dist - this._pinchState.initDist) < 16) {
        return;
      }
    }
    this._pinchState._hasPendingMove = true;
    this.requestRender();
  }

  _applyPendingTwoFingerPinchStep() {
    const st = this._pinchState;
    if (!st || !st._hasPendingMove || !st.latestP1 || !st.latestP2) return false;
    st._hasPendingMove = false;
    if (this.isDrawingInk || this.isStylusDrawing || this.isLassoSelecting) return false;
    if (this._pendingIncrementalBakeStrokes && this._pendingIncrementalBakeStrokes.length > 0 && typeof this._flushPendingIncrementalBakes === 'function') {
      this._flushPendingIncrementalBakes();
    }

    const cRect = this.canvasRect || (this.canvas ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 });
    const x1 = st.latestP1.x - cRect.left;
    const y1 = st.latestP1.y - cRect.top;
    const x2 = st.latestP2.x - cRect.left;
    const y2 = st.latestP2.y - cRect.top;
    const rawMidX = (x1 + x2) / 2;
    const rawMidY = (y1 + y2) / 2;
    const rawDist = Math.max(24, Math.hypot(x2 - x1, y2 - y1));

    const midX = rawMidX;
    const midY = rawMidY;

    // 10px 2점 이동 데드존: 손날이 두 지점에 닿은 채 미세하게 흔들릴 때는 패닝/캐시 더티(_inkBakeDirty)가 발동하지 않도록 보호
    if (!st.panUnlocked) {
      if (Math.hypot(midX - st.initMidX, midY - st.initMidY) >= 10) {
        st.panUnlocked = true;
        st.startMidX = midX;
        st.startMidY = midY;
        st.startPanX = this.panX || 0;
        st.startPanY = this.panY || 0;
        st.startBoardPanX = this.boardPanX || 0;
        st.startBoardPanY = this.boardPanY || 0;
      }
    }

    if (!st.zoomUnlocked) {
      if (Math.abs(rawDist - st.initDist) >= 16) {
        st.zoomUnlocked = true;
        st.panUnlocked = true;
        st.startDist = rawDist;
        st.smoothDist = rawDist;
        st.startMidX = midX;
        st.startMidY = midY;
        st.startZoom = this.zoomLevel || 1.0;
        st.startBoardZoom = this.boardZoom || 1.0;
        st.startBoardZoomOffsetX = this.boardZoomOffsetX || 0;
        st.startBoardZoomOffsetY = this.boardZoomOffsetY || 0;
        st.startPanX = this.panX || 0;
        st.startPanY = this.panY || 0;
        st.startBoardPanX = this.boardPanX || 0;
        st.startBoardPanY = this.boardPanY || 0;
      }
    }

    if (!st.panUnlocked && !st.zoomUnlocked) {
      return false;
    }
    this._pinchHadActiveMoveInGesture = true;

    const dx = midX - st.startMidX;
    const dy = midY - st.startMidY;

    let dampedRatio = 1.0;
    if (st.zoomUnlocked) {
      if (typeof st.smoothDist !== 'number') st.smoothDist = rawDist;
      const jitterDist = Math.abs(rawDist - st.smoothDist);
      const alphaDist = (jitterDist < 0.8) ? 0.35 : 0.72;
      st.smoothDist = st.smoothDist + (rawDist - st.smoothDist) * alphaDist;
      const rawRatio = Math.max(24, st.smoothDist) / Math.max(24, st.startDist);
      dampedRatio = Math.pow(rawRatio, 0.85);
    }

    if (this.isGraphCovered && !this.pdfPageBoardData) {
      // 2층 일반 판서 칠판: 두 손가락 이동(패닝) + 두 손가락 핀치(칠판·카드·필기 일체형 확대/축소)
      this.boardPanX = st.startBoardPanX + dx;
      this.boardPanY = st.startBoardPanY + dy;

      if (st.zoomUnlocked) {
        const oldBZ = st.startBoardZoom || 1.0;
        const nextBZ = Math.max(0.25, Math.min(3.5, oldBZ * dampedRatio));
        const startBx = (st.startMidX - st.startBoardPanX - (st.startBoardZoomOffsetX || 0)) / oldBZ;
        const startBy = (st.startMidY - st.startBoardPanY - (st.startBoardZoomOffsetY || 0)) / oldBZ;
        this.boardZoom = nextBZ;
        this.boardZoomOffsetX = midX - this.boardPanX - startBx * nextBZ;
        this.boardZoomOffsetY = midY - this.boardPanY - startBy * nextBZ;
      }

      this._inkBakeDirty = true;
    } else {
      // 1층 실시간 그래프 및 PDF 1페이지 보드: 두 손가락 이동(Pan) + 두 손가락 핀치 중심점 기준 서브픽셀 줌(Pinch-to-Zoom)
      const oldZoom = st.startZoom || 1.0;
      const nextZoom = st.zoomUnlocked
        ? Math.max(0.15, Math.min(3.5, oldZoom * dampedRatio))
        : oldZoom;

      if (st.zoomUnlocked) {
        this.zoomLevel = nextZoom;
        this.targetZoom = nextZoom;
        this._isZoomAnimating = false;
        const pct = Math.round(nextZoom * 100);
        if (st._lastDomZoomPct !== pct) {
          st._lastDomZoomPct = pct;
          const slZoom = document.getElementById('sliderZoom');
          const lblZoom = document.getElementById('lblZoom');
          const lblInkZoom = document.getElementById('lblInkZoom');
          const lblLeftZoom = document.getElementById('lblLeftZoom');
          if (slZoom) slZoom.value = nextZoom;
          if (lblZoom) lblZoom.textContent = `${pct}%`;
          if (lblInkZoom) lblInkZoom.textContent = `${pct}%`;
          if (lblLeftZoom) lblLeftZoom.textContent = `${pct}%`;
        }
      }

      const ratio = nextZoom / oldZoom;
      const cx = (this.screenWidth || window.innerWidth) / 2 + st.startPanX;
      const cy = (this.screenHeight || window.innerHeight) / 2 + st.startPanY;
      const zoomDeltaX = st.zoomUnlocked ? (st.startMidX - cx) * (1 - ratio) : 0;
      const zoomDeltaY = st.zoomUnlocked ? (st.startMidY - cy) * (1 - ratio) : 0;
      this.panX = st.startPanX + dx + zoomDeltaX;
      this.panY = st.startPanY + dy + zoomDeltaY;
      this._inkBakeDirty = true;
    }
    return true;
  }

  zoomByStep(delta) {
    if (this.isGraphCovered && !this.pdfPageBoardData) {
      this.setBoardZoom((this.boardZoom || 1.0) + delta);
      this.render();
      return;
    }
    this.setZoomLevel(this.zoomLevel + delta);
    this.render();
  }

  // 🌟 [통합 줌 배율 제어 및 UI 실시간 동기화] 🌟
  setZoomLevel(val) {
    this.zoomLevel = Math.max(0.15, Math.min(3.5, Math.round(val * 100) / 100));
    this.targetZoom = this.zoomLevel;
    this._inkBakeDirty = true;
    const slZoom = document.getElementById('sliderZoom');
    if (slZoom) slZoom.value = this.zoomLevel;
    const lblZoom = document.getElementById('lblZoom');
    if (lblZoom) lblZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    const lblInkZoom = document.getElementById('lblInkZoom');
    if (lblInkZoom) lblInkZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    const lblLeftZoom = document.getElementById('lblLeftZoom');
    if (lblLeftZoom) lblLeftZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
  }

  getCompactStageHandleAt(pos) {
    return null;
  }

  drawCompactStageControls(ctx) {
    // 2-Layer 아키텍처 전환으로 별도 미니창 테두리 및 우하단 배지([ ✥ | − | + | ◢ ]) 완전 제거
    return;
  }

  drawAxes(ctx, bounds = null) {
    const orig = this.mathToScreen(0, 0);
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
    const axisColor = this.isMonochromeMode ? '#000000' : curTheme.axis;
    const isPip = Boolean(this._isRenderingGraphSnapshot);
    const pipScale = isPip ? 0.78 : 1.0;
    // 🌟 [대표님 피드백 반영]: 데스모스 스타일의 샤프하고 세련된 축 두께 (창모드에서는 0.78배 축소)
    const rawAxisLw = (typeof this.axisLineWidth === 'number') ? this.axisLineWidth : 1.8;
    const axisLw = rawAxisLw * pipScale;

    // 컴팩트 바운딩 활성 시 축의 시작/끝 좌표를 컴팩트 영역으로 깔끔하게 재단!
    // 교재 제작 모드(bounds === null)일 때는 기존처럼 모니터 전체화면(0 ~ screenWidth/Height) 100% 유지!
    const xStart = bounds ? bounds.minX : 0;
    const xEnd = bounds ? bounds.maxX : this.screenWidth;
    const yBottom = bounds ? bounds.maxY : this.screenHeight;
    const yTop = bounds ? bounds.minY : 0;

    // [대표님 기획]: 수능·평가원 조판 표준 비율로 화살촉 크기를 슬림해진 축선에 맞추어 세련되게 계산
    const arrowSize = Math.max(isPip ? 9 : 12, Math.round((rawAxisLw * 3.4 + 5) * pipScale));
    const arrowHalfWidth = arrowSize * 0.44;

    ctx.save();
    ctx.lineCap = 'round';

    const showX = this.showXAxis !== false;
    const showY = this.showYAxis !== false;
    if (!showX && !showY) {
      ctx.restore();
      return;
    }

    // X축 (y=0)
    if (showX && orig.y >= yTop && orig.y <= yBottom && xEnd > xStart + 20) {
      ctx.beginPath();
      ctx.moveTo(xStart, orig.y);
      ctx.lineTo(xEnd, orig.y);
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = axisLw;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // X축 화살표 (재단된 우측 끝단 xEnd에 칼같이 부착!)
      if (this.showArrows) {
        ctx.fillStyle = axisColor;
        ctx.beginPath();
        ctx.moveTo(xEnd, orig.y);
        ctx.lineTo(xEnd - arrowSize, orig.y - arrowHalfWidth);
        ctx.lineTo(xEnd - arrowSize, orig.y + arrowHalfWidth);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Y축 (x=0)
    if (showY && orig.x >= xStart && orig.x <= xEnd && yBottom > yTop + 20) {
      ctx.beginPath();
      ctx.moveTo(orig.x, yBottom);
      ctx.lineTo(orig.x, yTop);
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = axisLw;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Y축 화살표 (재단된 상단 끝단 yTop에 칼같이 부착!)
      if (this.showArrows) {
        ctx.fillStyle = axisColor;
        ctx.beginPath();
        ctx.moveTo(orig.x, yTop);
        ctx.lineTo(orig.x - arrowHalfWidth, yTop + arrowSize);
        ctx.lineTo(orig.x + arrowHalfWidth, yTop + arrowSize);
        ctx.closePath();
        ctx.fill();
      }
    }

    // [수능·평가원 표준 축 이름표 (x/t, y, 원점 O) 렌더링 - 데스모스/교과서급 KaTeX Math 이탤릭 & Halo 외곽선 엔진]
    if (this.showAxisLabels) {
      let fontFam = '"KaTeX_Math", "Times New Roman", Georgia, serif';
      if (this.dropLineFontFamily === 'pretendard') fontFam = "'Pretendard', -apple-system, sans-serif";
      else if (this.dropLineFontFamily === 'batang') fontFam = "'KoPubWorld Batang', 'Batang', serif";

      const zRatio = Math.max(0.45, Math.min(2.2, this.zoomLevel || 1.0)) * pipScale;
      const fSize = Math.max(8, Math.round((this.axisLabelFontSize || 17) * zRatio * 10) / 10);
      const originFSize = Math.max(7.5, Math.round(fSize * 0.95 * 10) / 10);
      const axisPad = Math.max(3, Math.round(6 * zRatio));
      const haloLw = Math.max(2, Math.min(4.5, 3.5 * zRatio));
      const haloColor = this.isMonochromeMode ? '#ffffff' : (curTheme.isLight ? '#ffffff' : (curTheme.bg || '#1e1e2e'));

      // 1. X축 이름표 (예: x, t, k)
      if (showX && this.axisLabelX && orig.y >= yTop && orig.y <= yBottom) {
        ctx.save();
        ctx.font = `italic 600 ${fSize}px ${fontFam}`;
        ctx.fillStyle = axisColor;
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = haloLw;
        ctx.lineJoin = 'round';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        const labelXPos = xEnd - arrowSize - axisPad;
        const labelYPos = Math.min(yBottom - fSize - 4, Math.max(yTop + 4, orig.y + axisPad));
        ctx.strokeText(this.axisLabelX, labelXPos, labelYPos);
        ctx.fillText(this.axisLabelX, labelXPos, labelYPos);
        ctx.restore();
      }

      // 2. Y축 이름표 (예: y)
      if (showY && this.axisLabelY && orig.x >= xStart && orig.x <= xEnd) {
        ctx.save();
        ctx.font = `italic 600 ${fSize}px ${fontFam}`;
        ctx.fillStyle = axisColor;
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = haloLw;
        ctx.lineJoin = 'round';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        const labelXPos = Math.max(xStart + fSize, orig.x - axisPad);
        const labelYPos = yTop + arrowSize + Math.max(2, Math.round(4 * zRatio));
        ctx.strokeText(this.axisLabelY, labelXPos, labelYPos);
        ctx.fillText(this.axisLabelY, labelXPos, labelYPos);
        ctx.restore();
      }

      // 3. 원점 O (두 축이 모두 표시되어 교차할 때만 표시)
      if (showX && showY && orig.x >= xStart + 15 && orig.x <= xEnd - 15 && orig.y >= yTop + 15 && orig.y <= yBottom - 15) {
        ctx.save();
        ctx.font = `italic 600 ${originFSize}px ${fontFam}`;
        ctx.fillStyle = axisColor;
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = haloLw;
        ctx.lineJoin = 'round';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.strokeText('O', orig.x + axisPad, orig.y + axisPad);
        ctx.fillText('O', orig.x + axisPad, orig.y + axisPad);
        ctx.restore();
      }
    }

    // [대표님 지침]: 이동/조작 시 축 위에 찍히던 불필요한 하늘색 스냅 마커(◉) 렌더링 완전 제거

    ctx.restore();
  }

  drawGuides(ctx) {
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
    ctx.save();
    ctx.strokeStyle = this.isMonochromeMode ? 'rgba(0, 0, 0, 0.08)' : curTheme.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);

    const orig = this.mathToScreen(0, 0);
    const mLeft = this.screenToMath(0, 0).x;
    const mRight = this.screenToMath(this.screenWidth, 0).x;
    const mBottom = this.screenToMath(0, this.screenHeight).y;
    const mTop = this.screenToMath(0, 0).y;

    const spanX = mRight - mLeft;
    let step = 1;
    if (spanX > 90) step = 5;
    else if (spanX > 45) step = 2;

    const startX = Math.floor(mLeft / step) * step;
    const endX = Math.ceil(mRight / step) * step;

    // 1. 수직 격자선 단일 패스 배칭 & 원점 위상 고정 (모아레 진동 원천 차단)
    ctx.lineDashOffset = -(orig.y % 7);
    ctx.beginPath();
    for (let xVal = startX; xVal <= endX; xVal += step) {
      if (Math.abs(xVal) < 1e-4 && this.showYAxis !== false) continue; // y축이 그려질 때만 생략
      const s = this.mathToScreen(xVal, 0);
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, this.screenHeight);
    }
    ctx.stroke();

    const startY = Math.floor(mBottom / step) * step;
    const endY = Math.ceil(mTop / step) * step;

    // 2. 수평 격자선 단일 패스 배칭 & 원점 위상 고정
    ctx.lineDashOffset = -(orig.x % 7);
    ctx.beginPath();
    for (let yVal = startY; yVal <= endY; yVal += step) {
      if (Math.abs(yVal) < 1e-4 && this.showXAxis !== false) continue; // x축이 그려질 때만 생략
      const s = this.mathToScreen(0, yVal);
      ctx.moveTo(0, s.y);
      ctx.lineTo(this.screenWidth, s.y);
    }
    ctx.stroke();

    ctx.restore();
  }

  drawGridNumbers(ctx, bounds = null) {
    const orig = this.mathToScreen(0, 0);
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
    const isLight = curTheme.isLight || this.isMonochromeMode;
    const textColor = this.isMonochromeMode
      ? '#000000'
      : (isLight ? 'rgba(45, 52, 54, 0.78)' : 'rgba(255, 255, 255, 0.78)');
    const tickColor = this.isMonochromeMode
      ? '#000000'
      : (isLight ? 'rgba(45, 52, 54, 0.52)' : 'rgba(255, 255, 255, 0.52)');
    const haloColor = this.isMonochromeMode
      ? '#ffffff'
      : (isLight ? '#ffffff' : (curTheme.bg || '#1e272e'));

    const xStart = bounds ? bounds.minX : 0;
    const xEnd = bounds ? bounds.maxX : this.screenWidth;
    const yTop = bounds ? bounds.minY : 0;
    const yBottom = bounds ? bounds.maxY : this.screenHeight;

    const mLeft = this.screenToMath(xStart, 0).x;
    const mRight = this.screenToMath(xEnd, 0).x;
    const mBottom = this.screenToMath(0, yBottom).y;
    const mTop = this.screenToMath(0, yTop).y;

    const fullSpanX = this.screenToMath(this.screenWidth, 0).x - this.screenToMath(0, 0).x;
    let step = 1;
    if (fullSpanX > 90) step = 5;
    else if (fullSpanX > 45) step = 2;

    // 🌟 확대·축소(zoomLevel)에 비례하여 눈금 숫자 크기와 여백이 함께 커졌다 작아짐! (창모드에서는 0.82배 축소)
    const z = (this.zoomLevel || 1.0) * (this._isRenderingGraphSnapshot ? 0.82 : 1.0);
    const fontPx = Math.max(6.5, Math.min(26, 11 * z));
    const tickHalf = Math.max(2, Math.min(6, 3 * z));
    const offsetPx = Math.max(3, Math.min(11, 5 * z));
    const haloLw = Math.max(2, Math.min(4.5, 2.8 * z));

    const axisLw = (typeof this.axisLineWidth === 'number') ? this.axisLineWidth : 1.8;
    const arrowMargin = Math.max(16, Math.round(axisLw * 3.4 + 10));

    let fontFam = "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
    if (this.dropLineFontFamily === 'batang') fontFam = "'KoPubWorld Batang', 'Batang', serif";

    ctx.save();
    ctx.font = `500 ${fontPx.toFixed(1)}px ${fontFam}`;
    ctx.fillStyle = textColor;
    ctx.strokeStyle = haloColor;
    ctx.lineWidth = haloLw;
    ctx.lineJoin = 'round';

    const renderedX = [];
    const renderedY = [];

    const startX = Math.floor(mLeft / step) * step;
    const endX = Math.ceil(mRight / step) * step;

    // 1. X축 눈금 및 숫자 표시 (y = 0 축 아래쪽 — x축이 표시되어 있을 때만)
    if (this.showXAxis !== false && orig.y >= yTop && orig.y <= yBottom) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let xVal = startX; xVal <= endX; xVal += step) {
        if (Math.abs(xVal) < 1e-4) continue;
        const s = this.mathToScreen(xVal, 0);
        if (s.x < xStart + 10 || s.x > xEnd - arrowMargin) continue;

        ctx.save();
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(s.x, orig.y - tickHalf);
        ctx.lineTo(s.x, orig.y + tickHalf);
        ctx.stroke();
        ctx.restore();

        const labelStr = String(Math.round(xVal * 1000) / 1000);
        const labelY = orig.y + offsetPx;
        if (labelY + fontPx <= yBottom - 2) {
          ctx.strokeText(labelStr, s.x, labelY);
          ctx.fillText(labelStr, s.x, labelY);
          renderedX.push(Number(labelStr));
        }
      }
    }

    const startY = Math.floor(mBottom / step) * step;
    const endY = Math.ceil(mTop / step) * step;

    // 2. Y축 눈금 및 숫자 표시 (x = 0 축 왼쪽 — y축이 표시되어 있을 때만)
    if (this.showYAxis !== false && orig.x >= xStart && orig.x <= xEnd) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let yVal = startY; yVal <= endY; yVal += step) {
        if (Math.abs(yVal) < 1e-4) continue;
        const s = this.mathToScreen(0, yVal);
        if (s.y < yTop + arrowMargin || s.y > yBottom - 10) continue;

        ctx.save();
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(orig.x - tickHalf, s.y);
        ctx.lineTo(orig.x + tickHalf, s.y);
        ctx.stroke();
        ctx.restore();

        const labelStr = String(Math.round(yVal * 1000) / 1000);
        const labelX = orig.x - offsetPx;
        if (labelX - fontPx >= xStart + 2) {
          ctx.strokeText(labelStr, labelX, s.y);
          ctx.fillText(labelStr, labelX, s.y);
          renderedY.push(Number(labelStr));
        }
      }
    }

    this._lastRenderedGridNumbers = {
      fontPx: Number(fontPx.toFixed(2)),
      zoomLevel: z,
      step,
      xLabels: renderedX,
      yLabels: renderedY
    };

    ctx.restore();
  }

  // --- [🔄 y = x 대칭 역함수 엔진 & 대칭 가이드라인] ---
  drawInverseGuide(ctx) {
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
    const guideColor = this.isMonochromeMode ? 'rgba(0, 0, 0, 0.45)' : (curTheme.isLight ? 'rgba(108, 92, 231, 0.65)' : 'rgba(255, 234, 167, 0.65)');

    // 화면 네 모서리의 수학 좌표 범위 구하기
    const pBL = this.screenToMath(0, this.screenHeight);
    const pTR = this.screenToMath(this.screenWidth, 0);

    // y = x 직선의 시작점과 끝점 계산 (화면 밖 넉넉하게 확장)
    const minCoord = Math.min(pBL.x, pBL.y) - 5;
    const maxCoord = Math.max(pTR.x, pTR.y) + 5;

    const sStart = this.mathToScreen(minCoord, minCoord);
    const sEnd = this.mathToScreen(maxCoord, maxCoord);

    ctx.save();
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 5]);

    ctx.beginPath();
    ctx.moveTo(sStart.x, sStart.y);
    ctx.lineTo(sEnd.x, sEnd.y);
    ctx.stroke();

    ctx.restore();
  }

  // ========================================================
  // [📍 교재 보조 수선(Drop Lines) & 축 좌표 라벨 시스템 엔진]
  // ========================================================

  toggleDropLineMode(forceState) {
    if (this.showXAxis === false && this.showYAxis === false && forceState !== false) {
      this.showToast('💡 보조 수선을 사용하려면 설정에서 x축 또는 y축을 켜주세요.');
      return;
    }
    this.isDropLineMode = forceState !== undefined ? forceState : !this.isDropLineMode;
    if (!this.isDropLineMode) {
      this.dropLineHoverCandidate = null;
      this._isAimingDropLine = false;
    } else {
      if (this.isTextToolMode) {
        this.isTextToolMode = false;
        const btnTxt = document.getElementById('btnQuickText');
        if (btnTxt) btnTxt.classList.remove('active');
        const cEl = this.canvas && this.canvas.parentElement;
        if (cEl) cEl.classList.remove('text-tool-active');
      }
      if (this.isInkMode && this.activeInkTool !== 'select') {
        this.setActiveInkTool('select');
      }
    }
    const btn = document.getElementById('btnQuickDropLine');
    if (btn) btn.classList.toggle('active', this.isDropLineMode);
    const container = this.canvas.parentElement;
    if (container) container.classList.toggle('drop-line-active', this.isDropLineMode);
    this.updateInkCursor();
    this.render();
    this.showToast(this.isDropLineMode ? '📍 보조 수선 도구 켜짐 (극점·교점 클릭 시 수선 생성)' : '📍 보조 수선 도구 꺼짐');
  }

  sanitizeMathLabel(text) {
    if (!text) return '';
    let s = text.trim();

    // 1. LaTeX 매크로 치환 (\alpha, \beta, etc.)
    const latexGreek = [
      { pattern: /(?:\\{1,2})alpha\b/gi, sym: 'α' },
      { pattern: /(?:\\{1,2})beta\b/gi, sym: 'β' },
      { pattern: /(?:\\{1,2})gamma\b/gi, sym: 'γ' },
      { pattern: /(?:\\{1,2})delta\b/gi, sym: 'δ' },
      { pattern: /(?:\\{1,2})theta\b/gi, sym: 'θ' },
      { pattern: /(?:\\{1,2})pi\b/gi, sym: 'π' },
      { pattern: /(?:\\{1,2})phi\b/gi, sym: 'φ' },
      { pattern: /(?:\\{1,2})lambda\b/gi, sym: 'λ' },
      { pattern: /(?:\\{1,2})mu\b/gi, sym: 'μ' },
      { pattern: /(?:\\{1,2})sigma\b/gi, sym: 'σ' },
      { pattern: /(?:\\{1,2})omega\b/gi, sym: 'ω' },
      { pattern: /(?:\\{1,2})infty\b/gi, sym: '∞' },
      { pattern: /(?:\\{1,2})times\b/gi, sym: '×' }
    ];
    for (const item of latexGreek) {
      s = s.replace(item.pattern, item.sym);
    }

    // 2. 단독 영문자 매칭 (단어 경계)
    const wordGreek = [
      { pattern: /\balpha\b/gi, sym: 'α' },
      { pattern: /\bbeta\b/gi, sym: 'β' },
      { pattern: /\btheta\b/gi, sym: 'θ' },
      { pattern: /\bpi\b/gi, sym: 'π' },
      { pattern: /\bgamma\b/gi, sym: 'γ' },
      { pattern: /\bdelta\b/gi, sym: 'δ' },
      { pattern: /\blambda\b/gi, sym: 'λ' },
      { pattern: /\bphi\b/gi, sym: 'φ' },
      { pattern: /\bomega\b/gi, sym: 'ω' }
    ];
    for (const item of wordGreek) {
      s = s.replace(item.pattern, item.sym);
    }

    // 3. 기호 및 연산자 치환
    s = s.replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠');
    s = s.replace(/-/g, '−'); // 유니코드 정규 수학 마이너스 (U+2212)

    // 4. 아래첨자 치환 (_0 -> ₀ 등)
    s = s.replace(/_0/g, '₀').replace(/_1/g, '₁').replace(/_2/g, '₂').replace(/_3/g, '₃')
      .replace(/_k/g, 'ₖ').replace(/_n/g, 'ₙ').replace(/_t/g, 'ₜ').replace(/_x/g, 'ₓ');

    return s;
  }

  // [📍 화면 렌더링과 100% 동일한 구간분할/주기함수 반영 곡선 Y값 평가 헬퍼]
  evaluateGraphAtForScreen(g, gIdx, mx) {
    if (!g) return NaN;
    if (this.usePiecewise && this.graphs && this.graphs.length >= 1 && !g.isIndependent && gIdx !== null && gIdx !== undefined) {
      if (!this.isInsidePiece(gIdx, mx)) {
        return NaN;
      }
    }
    let evalX = mx;
    let yOffset = 0;
    if (this.usePiecewise && this.isPiecewisePeriodic && this.piecewiseBoundaries && this.piecewiseBoundaries.length >= 2 && !g.isIndependent) {
      const b0 = this.piecewiseBoundaries[0];
      const bLast = this.piecewiseBoundaries[this.piecewiseBoundaries.length - 1];
      const T = bLast - b0;
      if (T > 1e-4) {
        const curCycleK = Math.floor((mx - b0) / T);
        let xBase = mx - curCycleK * T;
        if (xBase >= bLast - 1e-6) xBase = b0;
        if (xBase < b0) xBase = b0;
        evalX = xBase;
        yOffset = curCycleK * (this.periodicStepY || 0);
      }
    }
    return this.engine.evaluatePipeline(g, evalX) + yOffset;
  }

  collectDropLineCandidates() {
    // 🚀 [0.00ms 초고속 캐싱]: 마우스 호버(pointermove) 때마다 5000스텝 수치해석(findIntersections)을 재실행하여
    // 포인터가 마우스를 뒤따라오며 렉이 걸리던 현상을 원천 차단!
    const mLeft = this.screenToMath(0, 0).x;
    const mRight = this.screenToMath(this.screenWidth || 1440, 0).x;
    const scanMinX = Math.min(-22, Math.min(mLeft, mRight) - 4);
    const scanMaxX = Math.max(22, Math.max(mLeft, mRight) + 4);

    const sigParts = [
      this.usePiecewise ? 1 : 0,
      this.isPiecewisePeriodic ? 1 : 0,
      this.periodicStepY || 0,
      (this.piecewiseBoundaries || []).join(','),
      (this.piecewiseFuncMap || []).join(','),
      this.currentThemeKey || '',
      this.isMonochromeMode ? 1 : 0,
      this.showXAxis !== false ? 1 : 0,
      this.showYAxis !== false ? 1 : 0,
      Math.round(scanMinX),
      Math.round(scanMaxX)
    ];
    if (this.graphs) {
      for (let i = 0; i < this.graphs.length; i++) {
        const g = this.graphs[i];
        if (!g) continue;
        const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
        const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
        const hSig = (g.handles || []).map(h => `${h.x.toFixed(4)}:${h.y.toFixed(4)}:${h.type}:${h.hidden ? 1 : 0}`).join(';');
        const tSig = (g.transforms || []).map(t => `${t.type || ''}:${t.offset ? t.offset.x : 0}:${t.offset ? t.offset.y : 0}:${t.invertH ? 1 : 0}:${t.invertV ? 1 : 0}:${t.absolute ? 1 : 0}`).join(';');
        sigParts.push(`${g.id}|${g.type}|${g.color}|${g.isAbsolute ? 1 : 0}|${g.isFrozen ? 1 : 0}|${g.frozenInvertH ? 1 : 0}|${g.frozenInvertV ? 1 : 0}|${g.frozenAbsolute ? 1 : 0}|${g.isIndependent ? 1 : 0}|${g.customExpr || ''}|${ox.toFixed(4)},${oy.toFixed(4)}|${hSig}|${tSig}`);
      }
    }
    const cacheSig = sigParts.join('||');
    if (this._dropLineCandCacheKey === cacheSig && this._dropLineCandCacheList) {
      return this._dropLineCandCacheList;
    }

    const candidates = [];
    const seen = new Set();
    const addCand = (x, y, name, color = '#00d2d3', layerId = null, handleIndex = null, candKey = null, extra = null) => {
      if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) return;
      const key = `${Math.round(x * 1000) / 1000},${Math.round(y * 1000) / 1000}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({
        x, y, name, color, layerId, handleIndex, candKey: candKey || key,
        type: 'candidate', isCandidate: true,
        isIntersection: Boolean(extra && extra.isIntersection),
        layerIds: (extra && extra.layerIds) ? extra.layerIds : (layerId ? [layerId] : [])
      });
    };

    const offCurveCenterTypes = new Set(['exp_basic', 'log_basic', 'rational_basic', 'killer_log_frac', 'geom_circle']);

    // 1. 모든 그래프의 실제 곡선 위 특이점 핸들러(극점, 변곡점, 꼭짓점, 시작점, 대칭중심 등)
    this.graphs.forEach((g, gIdx) => {
      if (!g || !g.handles) return;
      if (g.type === 'geom_circle' || g.type === 'geom_triangle' || g.type === 'geom_quad') return;
      const baseOx = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
      let ox = baseOx;
      let oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
      const hasTransforms = Boolean(g.transforms && g.transforms.length > 0);
      if (hasTransforms) {
        for (const t of g.transforms) {
          if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
          if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
        }
      }
      const mapInnerX = (innerX) => {
        if (hasTransforms) return innerX + ox;
        return g.frozenInvertH ? (baseOx - innerX) : (baseOx + innerX);
      };

      // 🌊 [삼각함수(sin, cos, tan) 주기별 모든 극대(최대)·극소(최소)·대칭중심 자석 스냅 지원]
      if ((g.type === 'sin_1period' || g.type === 'cos_1period') && g.handles.length >= 1) {
        const h0 = g.handles[0];
        const h1 = g.handles.length >= 2 ? g.handles[1] : null;
        let dx = h1 ? (h1.x - h0.x) : (g.type === 'sin_1period' ? (Math.PI / 2) : (2.0 * Math.PI));
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        const qStep = (g.type === 'sin_1period') ? dx : (dx / 4.0);
        if (Math.abs(qStep) >= 0.05) {
          const invMin = hasTransforms ? (scanMinX - ox) : (g.frozenInvertH ? (baseOx - scanMinX) : (scanMinX - baseOx));
          const invMax = hasTransforms ? (scanMaxX - ox) : (g.frozenInvertH ? (baseOx - scanMaxX) : (scanMaxX - baseOx));
          const kA = (invMin - h0.x) / qStep;
          const kB = (invMax - h0.x) / qStep;
          const kMin = Math.max(-80, Math.floor(Math.min(kA, kB)) - 1);
          const kMax = Math.min(80, Math.ceil(Math.max(kA, kB)) + 1);
          const eps = Math.max(0.01, Math.min(0.25, Math.abs(qStep) * 0.15));

          // (1) 마루(극대)·골(극소)을 먼저 등록하여 최우선 스냅 보장
          for (let pass = 0; pass < 2; pass++) {
            for (let k = kMin; k <= kMax; k++) {
              const isCrestOrTrough = (g.type === 'sin_1period')
                ? (Math.abs(k % 2) === 1)
                : (k % 2 === 0);
              if (pass === 0 && !isCrestOrTrough) continue;
              if (pass === 1 && isCrestOrTrough) continue;

              const candX = mapInnerX(h0.x + k * qStep);
              if (candX < scanMinX || candX > scanMaxX) continue;
              if (this.usePiecewise && !g.isIndependent && !this.isInsidePiece(gIdx, candX)) continue;

              const evalY = this.evaluateGraphAtForScreen(g, gIdx, candX);
              if (isNaN(evalY) || !isFinite(evalY) || Math.abs(evalY) > 100) continue;

              const yL = this.evaluateGraphAtForScreen(g, gIdx, candX - eps);
              const yR = this.evaluateGraphAtForScreen(g, gIdx, candX + eps);
              let labelName = '특이점';
              if (isCrestOrTrough) {
                if (!isNaN(yL) && !isNaN(yR)) {
                  const midNeighbor = (yL + yR) * 0.5;
                  if (Math.abs(evalY - midNeighbor) < 1e-5) {
                    labelName = '대칭중심';
                  } else {
                    labelName = (evalY >= midNeighbor) ? '극대' : '극소';
                  }
                } else {
                  labelName = '극점';
                }
              } else {
                // 중심선 교차점 (단, |f(x)| 절댓값 꺾임으로 인해 첨점 극소/극대가 된 경우 극소/극대로 표기)
                if (!isNaN(yL) && !isNaN(yR)) {
                  if (evalY < yL - 1e-4 && evalY < yR - 1e-4) {
                    labelName = '극소';
                  } else if (evalY > yL + 1e-4 && evalY > yR + 1e-4) {
                    labelName = '극대';
                  } else {
                    labelName = '대칭중심';
                  }
                } else {
                  labelName = '대칭중심';
                }
              }
              addCand(candX, evalY, labelName, g.color, g.id, null, `${g.id}_trig_q_${k}`);
            }
          }
        }
      } else if (g.type === 'tan_1period' && g.handles.length >= 1) {
        const h0 = g.handles[0];
        const h1 = g.handles.length >= 2 ? g.handles[1] : null;
        let dx = h1 ? (h1.x - h0.x) : 0.785;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        const pStep = dx * 4.0;
        if (Math.abs(pStep) >= 0.1) {
          const invMin = hasTransforms ? (scanMinX - ox) : (g.frozenInvertH ? (baseOx - scanMinX) : (scanMinX - baseOx));
          const invMax = hasTransforms ? (scanMaxX - ox) : (g.frozenInvertH ? (baseOx - scanMaxX) : (scanMaxX - baseOx));
          const kA = (invMin - h0.x) / pStep;
          const kB = (invMax - h0.x) / pStep;
          const kMin = Math.max(-60, Math.floor(Math.min(kA, kB)) - 1);
          const kMax = Math.min(60, Math.ceil(Math.max(kA, kB)) + 1);
          for (let k = kMin; k <= kMax; k++) {
            const candX = mapInnerX(h0.x + k * pStep);
            if (candX < scanMinX || candX > scanMaxX) continue;
            if (this.usePiecewise && !g.isIndependent && !this.isInsidePiece(gIdx, candX)) continue;
            const evalY = this.evaluateGraphAtForScreen(g, gIdx, candX);
            if (isNaN(evalY) || !isFinite(evalY) || Math.abs(evalY) > 100) continue;
            addCand(candX, evalY, '대칭중심', g.color, g.id, null, `${g.id}_tan_p_${k}`);
          }
        }
      } else {
        g.handles.forEach((h, hIdx) => {
          if (h.hidden || h.type === 'point' || h.type === 'asymptote') return;
          // 점근선 교점(곡선 밖 허공의 기준점)은 곡선 위 수선 타겟에서 제외하여 엉뚱한 허공으로 튀는 현상 방지!
          if (h.type === 'center' && offCurveCenterTypes.has(g.type)) return;

          const candX = mapInnerX(h.x);
          const evalY = this.evaluateGraphAtForScreen(g, gIdx, candX);
          if (isNaN(evalY) || !isFinite(evalY) || Math.abs(evalY) > 100) return;

          let labelName = h.name || '특이점';
          addCand(candX, evalY, labelName, g.color, g.id, hIdx, `${g.id}_h_${hIdx}`);
        });
      }

      // 기함수 분수형(ax/(x²+b))의 대칭 극소점 보강
      if (g.type === 'killer_frac_odd' && g.handles.length >= 2) {
        const symInnerX = 2.0 * g.handles[0].x - g.handles[1].x;
        const symX = mapInnerX(symInnerX);
        const symY = this.evaluateGraphAtForScreen(g, gIdx, symX);
        if (!isNaN(symY) && isFinite(symY)) {
          addCand(symX, symY, '극소', g.color, g.id, null, `${g.id}_sym_min`);
        }
      }

      // 2. y절편 f(0) (y축이 표시되어 있을 때만)
      if (this.showYAxis !== false) {
        try {
          const y0 = this.evaluateGraphAtForScreen(g, gIdx, 0);
          if (!isNaN(y0) && isFinite(y0) && Math.abs(y0) < 50) {
            addCand(0, y0, 'y절편', g.color, g.id, null, `${g.id}_y0`);
          }
        } catch (err) { }
      }

      // 3. x절편 (실근 f(x) = 0, x축이 표시되어 있을 때만)
      if (this.showXAxis !== false) {
        try {
          const roots = this.engine.findIntersections(g, null, { xmin: scanMinX, xmax: scanMaxX }, null);
          if (roots && roots.length > 0) {
            roots.forEach((r, rIdx) => {
              if (this.usePiecewise && !g.isIndependent && !this.isInsidePiece(gIdx, r.x)) return;
              addCand(r.x, 0, 'x절편', g.color, g.id, null, `${g.id}_root_${rIdx}`);
            });
          }
        } catch (err) { }
      }
    });

    // 4. 다중 그래프 간의 실시간 교점 (두 부모의 layerIds 모두 보존)
    if (this.graphs.length >= 2) {
      for (let i = 0; i < this.graphs.length; i++) {
        for (let j = i + 1; j < this.graphs.length; j++) {
          try {
            const roots = this.engine.findIntersections(this.graphs[i], this.graphs[j], { xmin: scanMinX, xmax: scanMaxX }, null);
            if (roots && roots.length > 0) {
              roots.forEach((r, rIdx) => {
                if (this.usePiecewise) {
                  if (!this.graphs[i].isIndependent && !this.isInsidePiece(i, r.x)) return;
                  if (!this.graphs[j].isIndependent && !this.isInsidePiece(j, r.x)) return;
                }
                addCand(
                  r.x, r.y, '교점', ((this.canvasThemes[this.currentThemeKey] || this.canvasThemes.white_paper).isLight || this.isMonochromeMode) ? '#7c3aed' : '#feca57', this.graphs[i].id, null,
                  `cross_${this.graphs[i].id}_${this.graphs[j].id}_${rIdx}`,
                  { isIntersection: true, layerIds: [this.graphs[i].id, this.graphs[j].id] }
                );
              });
            }
          } catch (err) { }
        }
      }
    }

    this._dropLineCandCacheKey = cacheSig;
    this._dropLineCandCacheList = candidates;
    return candidates;
  }

  findNearestDropLineCandidate(screenPos, maxDist = 11) {
    const candidates = this.collectDropLineCandidates();
    let best = null;
    let bestDist = maxDist;
    candidates.forEach(cand => {
      const s = this.mathToScreen(cand.x, cand.y);
      const d = Math.hypot(s.x - screenPos.x, s.y - screenPos.y);
      if (d < bestDist) {
        bestDist = d;
        best = { ...cand, screenX: s.x, screenY: s.y, dist: d };
      }
    });
    return best;
  }

  // [📍 특이점 또는 일반 그래프(곡선) 위의 2D 직교 최단거리 점 통합 탐색]
  findNearestDropLineTarget(screenPos, maxDist = 24) {
    if (!this.graphs || this.graphs.length === 0) return null;

    // 1단계: 극점·꼭짓점·절편·교점 등 캐싱된 특이점 자석 스냅을 최우선 검사 (0.005ms 초고속 즉시 반환!)
    const featureSnapRadius = Math.min(maxDist, (this._isAimingDropLine || maxDist > 28) ? 14 : 11);
    const cand = this.findNearestDropLineCandidate(screenPos, featureSnapRadius);
    if (cand) return cand;

    // 2단계: 화면 공간(Screen Space)에서 마우스 포인터와 곡선 사이의 '진짜 2D 직교 최단거리 점' 탐색 (2px 간격 샘플링 + 황금분할 정밀 보간)
    let bestCurvePoint = null;
    let bestCurveDist = maxDist;

    const evalScreenPoint = (g, gIdx, sx) => {
      const mx = this.screenToMath(sx, screenPos.y).x;
      const my = this.evaluateGraphAtForScreen(g, gIdx, mx);
      if (isNaN(my) || !isFinite(my) || Math.abs(my) > 100) return null;
      const s = this.mathToScreen(mx, my);
      const d = Math.hypot(s.x - screenPos.x, s.y - screenPos.y);
      return { mx, my, sx: s.x, sy: s.y, d };
    };

    const refineInterval = (g, gIdx, leftSx, rightSx) => {
      let a = leftSx;
      let b = rightSx;
      const phi = (Math.sqrt(5) - 1) / 2;
      let x1 = b - phi * (b - a);
      let x2 = a + phi * (b - a);
      let p1 = evalScreenPoint(g, gIdx, x1);
      let p2 = evalScreenPoint(g, gIdx, x2);
      for (let iter = 0; iter < 8; iter++) {
        const d1 = p1 ? p1.d : Infinity;
        const d2 = p2 ? p2.d : Infinity;
        if (d1 < d2) {
          b = x2;
          x2 = x1;
          p2 = p1;
          x1 = b - phi * (b - a);
          p1 = evalScreenPoint(g, gIdx, x1);
        } else {
          a = x1;
          x1 = x2;
          p1 = p2;
          x2 = a + phi * (b - a);
          p2 = evalScreenPoint(g, gIdx, x2);
        }
      }
      const mid = evalScreenPoint(g, gIdx, (a + b) * 0.5);
      let best = mid;
      if (p1 && (!best || p1.d < best.d)) best = p1;
      if (p2 && (!best || p2.d < best.d)) best = p2;
      return best;
    };

    const searchRadiusPx = Math.ceil(maxDist);
    this.graphs.forEach((g, gIdx) => {
      if (!g || g.type === 'geom_circle' || g.type === 'geom_triangle' || g.type === 'geom_quad') return;
      try {
        let localBest = null;
        let prevSample = null;
        const crossingIntervals = [];

        for (let dx = -searchRadiusPx; dx <= searchRadiusPx; dx += 2) {
          const sx = screenPos.x + dx;
          const pt = evalScreenPoint(g, gIdx, sx);
          if (pt) {
            if (!localBest || pt.d < localBest.d) {
              localBest = pt;
            }
            if (prevSample) {
              const dyPrev = prevSample.sy - screenPos.y;
              const dyCurr = pt.sy - screenPos.y;
              // 가파른 구간에서 마우스 높이를 가로지르는 경우(Zero-Crossing) 정밀 탐색 구간 추가
              if ((dyPrev * dyCurr <= 0) && Math.abs(prevSample.sy - pt.sy) < this.screenHeight * 1.5) {
                crossingIntervals.push([prevSample.sx, pt.sx]);
              }
            }
          }
          prevSample = pt;
        }

        if (localBest) {
          const refined = refineInterval(g, gIdx, localBest.sx - 2.2, localBest.sx + 2.2);
          if (refined && refined.d < localBest.d) {
            localBest = refined;
          }
        }
        for (let cIdx = 0; cIdx < crossingIntervals.length; cIdx++) {
          const [cLeft, cRight] = crossingIntervals[cIdx];
          const refinedCross = refineInterval(g, gIdx, cLeft, cRight);
          if (refinedCross && (!localBest || refinedCross.d < localBest.d)) {
            localBest = refinedCross;
          }
        }

        if (localBest && localBest.d < bestCurveDist) {
          bestCurveDist = localBest.d;
          bestCurvePoint = {
            x: localBest.mx,
            y: localBest.my,
            name: '곡선 점',
            color: g.color || '#00d2d3',
            layerId: g.id,
            handleIndex: null,
            candKey: `${g.id}_pt_${Math.round(localBest.mx * 100) / 100}`,
            type: 'curve',
            isCandidate: false,
            screenX: localBest.sx,
            screenY: localBest.sy,
            dist: localBest.d
          };
        }
      } catch (err) { }
    });

    // 곡선 위의 직교 최단거리 점이 특이점 바로 옆(9px 이내)이고 마우스도 곡선에 밀착해 있다면 특이점으로 매끄럽게 스냅
    if (bestCurvePoint && bestCurvePoint.dist <= 12) {
      const curveSnapCand = this.findNearestDropLineCandidate(
        { x: bestCurvePoint.screenX, y: bestCurvePoint.screenY },
        9
      );
      if (curveSnapCand) return curveSnapCand;
    }

    return bestCurvePoint;
  }

  // [📍 그래프 변형 시 수선 동적 추적 (Dynamic Tracking) 엔진]
  updateDropLinesTracking() {
    if (!this.dropLines || this.dropLines.length === 0) return;
    if (!this.graphs || this.graphs.length === 0) {
      this.dropLines = [];
      return;
    }

    // [📍 종속 보조 수선 자동 정화]: 원그래프 삭제 시 종속 수선 삭제, 단 교점은 남은 부모 그래프가 이어받기!
    this.dropLines = this.dropLines.filter(item => {
      if (!item.binding) return true;
      const b = item.binding;

      // 교점 수선인 경우
      if (b.isIntersection || b.name === '교점') {
        const ids = b.layerIds || (b.layerId ? [b.layerId] : []);
        const surviving = this.graphs.find(g => ids.includes(g.id));
        if (surviving) {
          // 남은 그래프로 바인딩 갱신
          if (b.layerId !== surviving.id) {
            b.layerId = surviving.id;
            b.type = 'curve';
            b.anchorX = item.sourceX;
          }
          return true;
        }
        return false; // 두 부모 모두 사라지면 제거
      }

      // 단독 종속 수선인 경우
      if (b.layerId && !this.graphs.some(g => g.id === b.layerId)) {
        return false;
      }
      return true;
    });

    const offCurveCenterTypes = new Set(['exp_basic', 'log_basic', 'rational_basic', 'killer_log_frac', 'geom_circle']);

    this.dropLines.forEach(item => {
      if (!item.binding) return;
      const b = item.binding;

      // 1. 바인딩된 그래프 탐색
      const g = this.graphs.find(graph => graph.id === b.layerId);
      if (!g) return;

      const baseOx = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
      let ox = baseOx;
      let oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
      const hasTransforms = Boolean(g.transforms && g.transforms.length > 0);
      if (hasTransforms) {
        for (const t of g.transforms) {
          if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
          if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
        }
      }
      const mapInnerX = (innerX) => {
        if (hasTransforms) return innerX + ox;
        return g.frozenInvertH ? (baseOx - innerX) : (baseOx + innerX);
      };

      // (A) 특정 핸들러(극점, 변곡점, 꼭짓점, 시작점 등)에 바인딩된 경우
      if (b.type === 'candidate' && b.handleIndex !== null && b.handleIndex !== undefined) {
        if (g.handles && g.handles[b.handleIndex]) {
          const h = g.handles[b.handleIndex];
          let targetY = h.y;
          if (g.isAbsolute && ["max", "min", "point", "vertex", "inflection"].includes(h.type)) {
            targetY = Math.abs(h.y);
          }
          const newX = mapInnerX(h.x);
          const isOffCurveCenter = (h.type === 'asymptote') || (h.type === 'center' && offCurveCenterTypes.has(g.type));
          let evalY = isOffCurveCenter
            ? (targetY + oy)
            : this.engine.evaluatePipeline(g, newX);
          if (isNaN(evalY) || !isFinite(evalY)) {
            evalY = targetY + oy;
          }
          item.sourceX = newX;
          item.sourceY = evalY;
        }
      }
      // (A-2) 삼각함수(sin, cos, tan) 주기별 극대·극소·대칭중심 및 기함수 분수형 대칭 극소점에 바인딩된 경우
      else if (b.type === 'candidate' && typeof b.candKey === 'string') {
        const trigMatch = b.candKey.match(/_trig_q_(-?\d+)$/);
        const tanMatch = b.candKey.match(/_tan_p_(-?\d+)$/);
        if (trigMatch && (g.type === 'sin_1period' || g.type === 'cos_1period') && g.handles && g.handles.length >= 1) {
          const k = parseInt(trigMatch[1], 10);
          const h0 = g.handles[0];
          const h1 = g.handles.length >= 2 ? g.handles[1] : null;
          let dx = h1 ? (h1.x - h0.x) : (g.type === 'sin_1period' ? (Math.PI / 2) : (2.0 * Math.PI));
          if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
          const qStep = (g.type === 'sin_1period') ? dx : (dx / 4.0);
          const newX = mapInnerX(h0.x + k * qStep);
          const evalY = this.engine.evaluatePipeline(g, newX);
          if (!isNaN(evalY) && isFinite(evalY)) {
            item.sourceX = newX;
            item.sourceY = evalY;
          }
        } else if (tanMatch && g.type === 'tan_1period' && g.handles && g.handles.length >= 1) {
          const k = parseInt(tanMatch[1], 10);
          const h0 = g.handles[0];
          const h1 = g.handles.length >= 2 ? g.handles[1] : null;
          let dx = h1 ? (h1.x - h0.x) : 0.785;
          if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
          const pStep = dx * 4.0;
          const newX = mapInnerX(h0.x + k * pStep);
          const evalY = this.engine.evaluatePipeline(g, newX);
          if (!isNaN(evalY) && isFinite(evalY)) {
            item.sourceX = newX;
            item.sourceY = evalY;
          }
        } else if (b.candKey.endsWith('_sym_min') && g.type === 'killer_frac_odd' && g.handles && g.handles.length >= 2) {
          const symInnerX = 2.0 * g.handles[0].x - g.handles[1].x;
          const newX = mapInnerX(symInnerX);
          const evalY = this.engine.evaluatePipeline(g, newX);
          if (!isNaN(evalY) && isFinite(evalY)) {
            item.sourceX = newX;
            item.sourceY = evalY;
          }
        } else if (b.name === 'y절편') {
          const y0 = this.engine.evaluatePipeline(g, 0);
          if (!isNaN(y0) && isFinite(y0)) {
            item.sourceX = 0;
            item.sourceY = y0;
          }
        }
      }
      // (B) 절편인 경우
      else if (b.type === 'candidate' && b.name === 'y절편') {
        const y0 = this.engine.evaluatePipeline(g, 0);
        if (!isNaN(y0) && isFinite(y0)) {
          item.sourceX = 0;
          item.sourceY = y0;
        }
      }
      // (C) 일반 곡선 위의 임의 점 또는 교점에서 이관된 점인 경우
      else if (b.type === 'curve') {
        const curAnchorX = (typeof b.anchorX === 'number' ? b.anchorX : item.sourceX);
        const newX = curAnchorX + ox;
        const evalY = this.engine.evaluatePipeline(g, newX);
        if (!isNaN(evalY) && isFinite(evalY)) {
          item.sourceX = newX;
          item.sourceY = evalY;
        }
      }
    });
  }

  addDropLineAtPoint(x, y, target = null) {
    const allowX = this.showXAxis !== false;
    const allowY = this.showYAxis !== false;
    if (!allowX && !allowY) return null;

    const existing = this.dropLines.find(dl => Math.hypot(dl.sourceX - x, dl.sourceY - y) < 0.001);
    if (existing) {
      if ((allowX && !existing.showX) || (allowY && !existing.showY)) {
        this.pushHistoryState();
        if (allowX) existing.showX = true;
        if (allowY) existing.showY = true;
        this.render();
        this.showToast('📍 보조 수선 복원 완료');
        return existing;
      }
      this.showToast('ℹ️ 이미 해당 위치에 보조 수선이 있습니다.');
      return existing;
    }

    this.pushHistoryState();
    const item = {
      id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sourceX: x,
      sourceY: y,
      showX: allowX,
      showY: allowY,
      labelX: '', // 대표님 기획: 수선 그리기 시 기본 좌표 라벨 숨김 (깔끔한 수선만 표시)
      labelY: '',
      style: this.dropLineStyle || 'dashed',
      binding: target ? {
        type: target.type || (target.handleIndex !== null && target.handleIndex !== undefined ? 'candidate' : 'curve'),
        layerId: target.layerId,
        layerIds: target.layerIds || (target.layerId ? [target.layerId] : []),
        isIntersection: Boolean(target.isIntersection || target.name === '교점'),
        handleIndex: target.handleIndex,
        name: target.name,
        candKey: target.candKey,
        anchorX: x
      } : null
    };
    this.dropLines.push(item);
    this.render();
    const toastMsg = (allowX && allowY)
      ? '📍 x·y축 보조 수선 생성 완료'
      : (allowX ? '📍 x축 보조 수선 생성 완료' : '📍 y축 보조 수선 생성 완료');
    this.showToast(toastMsg);
    return item;
  }

  removeDropLine(id, which) {
    const item = this.dropLines.find(dl => dl.id === id);
    if (!item) return;
    this.pushHistoryState();
    if (which === 'x') item.showX = false;
    if (which === 'y') item.showY = false;
    if ((!item.showX || this.showXAxis === false) && (!item.showY || this.showYAxis === false)) {
      this.dropLines = this.dropLines.filter(dl => dl.id !== id);
    }
    this.render();
    this.showToast('✂️ 수선 삭제 완료');
  }

  clearAllDropLines() {
    if (!this.dropLines || this.dropLines.length === 0) return;
    this.pushHistoryState();
    this.dropLines = [];
    this.render();
    this.showToast('🗑️ 보조 수선 전체 삭제 완료');
  }

  hitTestScissors(screenPos, isTouch = false) {
    if (!screenPos) return null;
    const isPip = Boolean(this._isRenderingGraphSnapshot);
    let list = (Array.isArray(this.renderedScissors) && this.renderedScissors.length > 0)
      ? this.renderedScissors
      : null;

    // 🌟 [아이패드 창모드 가위 터치 100% 보장]:
    // bakePipGraphCardToImg 등 오프스크린 스냅샷 렌더링 직후나 초기 상태에서 renderedScissors 캐시가 비어 있더라도,
    // 현재 dropLines에서 직접 가위 좌표((S + Fx)/2, (S + Fy)/2)를 즉시 산출하여 판정 누락을 원천 차단!
    if (!list && this.isDropLineMode && Array.isArray(this.dropLines) && this.dropLines.length > 0) {
      this.updateDropLinesTracking();
      list = [];
      const baseR = isPip ? 8.0 : 9.0;
      const allowX = this.showXAxis !== false;
      const allowY = this.showYAxis !== false;
      for (const item of this.dropLines) {
        if (!item || (!item.showX && !item.showY)) continue;
        const S = this.mathToScreen(item.sourceX, item.sourceY);
        if (item.showX && allowX) {
          const Fx = this.mathToScreen(item.sourceX, 0);
          list.push({ id: item.id, which: 'x', x: (S.x + Fx.x) / 2, y: (S.y + Fx.y) / 2, r: baseR });
        }
        if (item.showY && allowY) {
          const Fy = this.mathToScreen(0, item.sourceY);
          list.push({ id: item.id, which: 'y', x: (S.x + Fy.x) / 2, y: (S.y + Fy.y) / 2, r: baseR });
        }
      }
      this.renderedScissors = list;
    }
    if (!list || list.length === 0) return null;

    const hitPad = isTouch ? 11.0 : 4.5;
    let best = null;
    let bestDist = Infinity;
    for (const s of list) {
      const d = Math.hypot(s.x - screenPos.x, s.y - screenPos.y);
      const maxR = (typeof s.r === 'number' ? s.r : (isPip ? 8.0 : 9.0)) + hitPad;
      if (d <= maxR && d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  hitTestDropLineLabel(screenPos) {
    if (!this.renderedDropLineLabels || this.renderedDropLineLabels.length === 0) return null;
    for (const lb of this.renderedDropLineLabels) {
      const b = lb.box;
      if (screenPos.x >= b.x && screenPos.x <= b.x + b.w &&
        screenPos.y >= b.y && screenPos.y <= b.y + b.h) {
        return lb;
      }
    }
    return null;
  }

  startEditingDropLineLabel(id, which, screenPos, currentText) {
    this.activeEditingLabel = { id, which };
    if (!this.dropLineInputEl) {
      this.dropLineInputEl = document.getElementById('dropLineLabelInput');
    }
    if (!this.dropLineInputEl) return;
    const input = this.dropLineInputEl;
    input.value = currentText || '';
    input.style.left = `${screenPos.x}px`;
    input.style.top = `${screenPos.y}px`;
    input.style.display = 'block';
    input.focus();
    input.select();
  }

  commitEditingDropLineLabel() {
    if (!this.activeEditingLabel) return;
    const { id, which } = this.activeEditingLabel;
    const input = this.dropLineInputEl;
    const raw = (input ? input.value : '').trim();
    const clean = this.sanitizeMathLabel(raw);
    const item = this.dropLines.find(dl => dl.id === id);
    if (item) {
      const curVal = which === 'x' ? item.labelX : item.labelY;
      if (curVal !== clean) {
        this.pushHistoryState();
        if (which === 'x') item.labelX = clean;
        else if (which === 'y') item.labelY = clean;
      }
    }
    this.activeEditingLabel = null;
    if (input) input.style.display = 'none';
    this.render();
  }

  cancelEditingDropLineLabel() {
    this.activeEditingLabel = null;
    if (this.dropLineInputEl) this.dropLineInputEl.style.display = 'none';
    this.render();
  }

  drawDropLines(ctx, isExport = false) {
    // 🌟 [핵심 버그 수정]: bakePipGraphCardToImg 등에서 isExport = true로 호출될 때
    // 기존 화면에 렌더링된 가위 히트박스(this.renderedScissors)를 빈 배열([])로 덮어써서
    // 아이패드(무호버 환경)에서 0.26초 뒤 가위 터치가 먹통이 되던 현상을 원천 차단!
    if (!isExport) {
      this.renderedScissors = [];
      this.renderedDropLineLabels = [];
    }
    if (!this.dropLines) this.dropLines = [];

    // [📍 그래프 변형/이동 시 수선 위치 실시간 동적 추적]
    this.updateDropLinesTracking();

    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
    const isLight = curTheme.isLight || this.isMonochromeMode;

    // 수선 선 및 텍스트 색상 (교재 출판용 최고급 시인성)
    const lineColor = this.isMonochromeMode ? '#000000' : (isLight ? 'rgba(30, 41, 59, 0.88)' : 'rgba(241, 245, 249, 0.82)');
    const textColor = this.isMonochromeMode ? '#000000' : (isLight ? '#0f172a' : '#f8fafc');
    const scissorsBg = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.92)';
    const scissorsBorder = isLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.25)';

    // 폰트 스택 매핑
    let fontFam = '"KaTeX_Math", "Times New Roman", Georgia, serif';
    if (this.dropLineFontFamily === 'pretendard') {
      fontFam = "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
    } else if (this.dropLineFontFamily === 'batang') {
      fontFam = "'KoPubWorld Batang', 'Batang', serif";
    }
    const isPip = Boolean(this._isRenderingGraphSnapshot);
    const pipScale = isPip ? 0.78 : 1.0;
    const zDropRatio = Math.max(0.45, Math.min(2.2, this.zoomLevel || 1.0)) * pipScale;
    const fontSize = Math.max(7.5, Math.round((this.dropLineFontSize || 15) * zDropRatio * 10) / 10);
    const dropPad = Math.max(3, Math.round(7 * zDropRatio));
    const dropHaloLw = Math.max(2, Math.min(4.5, 3.5 * zDropRatio));
    const dlLw = isPip ? 1.1 : 1.35;
    const dlDash = isPip ? [3, 3] : [4, 4];

    ctx.save();

    const allowX = this.showXAxis !== false;
    const allowY = this.showYAxis !== false;
    if (!allowX && !allowY) {
      ctx.restore();
      return;
    }

    // 1. 각 수선 및 라벨 그리기
    this.dropLines.forEach(item => {
      const effShowX = Boolean(item.showX && allowX);
      const effShowY = Boolean(item.showY && allowY);
      if (!effShowX && !effShowY) return;

      const S = this.mathToScreen(item.sourceX, item.sourceY);
      const Fx = this.mathToScreen(item.sourceX, 0);
      const Fy = this.mathToScreen(0, item.sourceY);

      const isDashed = (item.style || this.dropLineStyle) !== 'solid';

      // (A) x축 수선: (x0, y0) -> (x0, 0)
      if (effShowX) {
        ctx.save();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = dlLw;
        if (isDashed) {
          ctx.setLineDash(dlDash);
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(S.x, S.y);
        ctx.lineTo(Fx.x, Fx.y);
        ctx.stroke();
        ctx.restore();

        // x축 발 좌표 라벨
        if (item.labelX) {
          const isNum = /^[−\-]?\d+(\.\d+)?$/.test(item.labelX);
          ctx.font = `${isNum ? 'normal' : 'italic'} 500 ${fontSize}px ${fontFam}`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const labelYPos = Fx.y + dropPad;
          const haloColor = this.isMonochromeMode ? '#ffffff' : (curTheme.isLight ? '#ffffff' : (curTheme.bg || '#1e1e2e'));
          ctx.save();
          ctx.strokeStyle = haloColor;
          ctx.lineWidth = dropHaloLw;
          ctx.lineJoin = 'round';
          ctx.strokeText(item.labelX, Fx.x, labelYPos);
          ctx.restore();
          ctx.fillText(item.labelX, Fx.x, labelYPos);

          const metrics = ctx.measureText(item.labelX);
          const textW = Math.max(14, metrics.width);
          const box = {
            x: Fx.x - textW / 2 - 4,
            y: labelYPos - 2,
            w: textW + 8,
            h: fontSize + 4
          };
          this.renderedDropLineLabels.push({
            id: item.id,
            which: 'x',
            box,
            screenPos: { x: Fx.x, y: labelYPos + fontSize / 2 },
            currentText: item.labelX
          });

          // 편집 모드 호버 하이라이트
          if (!isExport && this.dropLineHoverLabel && this.dropLineHoverLabel.id === item.id && this.dropLineHoverLabel.which === 'x') {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 210, 211, 0.18)';
            ctx.strokeStyle = '#00d2d3';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(box.x, box.y, box.w, box.h, 3);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }

        // x축 수선 중간 가위(✂️) 버튼 (오직 수선 그리기 모드 활성화 시에만 노출, 모드 해제 및 내보내기/클린뷰 100% 생략)
        if (!isExport && !this.isCleanView && this.isDropLineMode) {
          const mx = (S.x + Fx.x) / 2;
          const my = (S.y + Fx.y) / 2;
          const isScissorsHover = this.dropLineHoverScissors && this.dropLineHoverScissors.id === item.id && this.dropLineHoverScissors.which === 'x';
          const r = isPip ? (isScissorsHover ? 8.8 : 7.2) : (isScissorsHover ? 11 : 9);

          ctx.save();
          ctx.beginPath();
          ctx.arc(mx, my, r, 0, Math.PI * 2);
          ctx.fillStyle = isScissorsHover ? 'rgba(255, 107, 107, 0.95)' : scissorsBg;
          ctx.fill();
          ctx.strokeStyle = isScissorsHover ? '#ff4757' : scissorsBorder;
          ctx.lineWidth = isScissorsHover ? 1.5 : 1;
          ctx.stroke();

          // 가위 아이콘 (텍스트)
          ctx.font = `${isPip ? (isScissorsHover ? '9px' : '8px') : (isScissorsHover ? '11px' : '9.5px')} sans-serif`;
          ctx.fillStyle = isScissorsHover ? '#ffffff' : (isLight ? '#2d3436' : '#dfe6e9');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✂️', mx, my + 0.5);
          ctx.restore();

          this.renderedScissors.push({ id: item.id, which: 'x', x: mx, y: my, r });
        }
      }

      // (B) y축 수선: (x0, y0) -> (0, y0)
      if (effShowY) {
        ctx.save();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = dlLw;
        if (isDashed) {
          ctx.setLineDash(dlDash);
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(S.x, S.y);
        ctx.lineTo(Fy.x, Fy.y);
        ctx.stroke();
        ctx.restore();

        // y축 발 좌표 라벨
        if (item.labelY) {
          const isNum = /^[−\-]?\d+(\.\d+)?$/.test(item.labelY);
          ctx.font = `${isNum ? 'normal' : 'italic'} 500 ${fontSize}px ${fontFam}`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';

          const labelXPos = Fy.x - dropPad;
          const haloColor = this.isMonochromeMode ? '#ffffff' : (curTheme.isLight ? '#ffffff' : (curTheme.bg || '#1e1e2e'));
          ctx.save();
          ctx.strokeStyle = haloColor;
          ctx.lineWidth = dropHaloLw;
          ctx.lineJoin = 'round';
          ctx.strokeText(item.labelY, labelXPos, Fy.y);
          ctx.restore();
          ctx.fillText(item.labelY, labelXPos, Fy.y);

          const metrics = ctx.measureText(item.labelY);
          const textW = Math.max(14, metrics.width);
          const box = {
            x: labelXPos - textW - 4,
            y: Fy.y - fontSize / 2 - 2,
            w: textW + 8,
            h: fontSize + 4
          };
          this.renderedDropLineLabels.push({
            id: item.id,
            which: 'y',
            box,
            screenPos: { x: labelXPos - textW / 2, y: Fy.y },
            currentText: item.labelY
          });

          // 편집 모드 호버 하이라이트
          if (!isExport && this.dropLineHoverLabel && this.dropLineHoverLabel.id === item.id && this.dropLineHoverLabel.which === 'y') {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 210, 211, 0.18)';
            ctx.strokeStyle = '#00d2d3';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(box.x, box.y, box.w, box.h, 3);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }

        // y축 수선 중간 가위(✂️) 버튼 (오직 수선 그리기 모드 활성화 시에만 노출, 모드 해제 및 내보내기/클린뷰 100% 생략)
        if (!isExport && !this.isCleanView && this.isDropLineMode) {
          const nx = (S.x + Fy.x) / 2;
          const ny = (S.y + Fy.y) / 2;
          const isScissorsHover = this.dropLineHoverScissors && this.dropLineHoverScissors.id === item.id && this.dropLineHoverScissors.which === 'y';
          const r = isPip ? (isScissorsHover ? 8.8 : 7.2) : (isScissorsHover ? 11 : 9);

          ctx.save();
          ctx.beginPath();
          ctx.arc(nx, ny, r, 0, Math.PI * 2);
          ctx.fillStyle = isScissorsHover ? 'rgba(255, 107, 107, 0.95)' : scissorsBg;
          ctx.fill();
          ctx.strokeStyle = isScissorsHover ? '#ff4757' : scissorsBorder;
          ctx.lineWidth = isScissorsHover ? 1.5 : 1;
          ctx.stroke();

          // 가위 아이콘
          ctx.font = `${isPip ? (isScissorsHover ? '9px' : '8px') : (isScissorsHover ? '11px' : '9.5px')} sans-serif`;
          ctx.fillStyle = isScissorsHover ? '#ffffff' : (isLight ? '#2d3436' : '#dfe6e9');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✂️', nx, ny + 0.5);
          ctx.restore();

          this.renderedScissors.push({ id: item.id, which: 'y', x: nx, y: ny, r });
        }
      }

      // (C) 시작점 마커 (단정하고 깔끔한 포인트 점)
      if (effShowX || effShowY) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(S.x, S.y, isPip ? 2.0 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.restore();
      }
    });

    // 2. 자석 스냅 타겟 조준 링 & 십자선 (보조 수선 모드일 때만 표시)
    if (!isExport && this.isDropLineMode && this.dropLineHoverCandidate) {
      const cand = this.dropLineHoverCandidate;
      const cs = this.mathToScreen(cand.x, cand.y);
      const isFeature = cand.isCandidate !== false;
      const themeColor = isFeature ? '#00d2d3' : '#a29bfe';

      ctx.save();
      // 외부 원형 펄스 링
      ctx.beginPath();
      ctx.arc(cs.x, cs.y, isPip ? (isFeature ? 7 : 6) : (isFeature ? 9 : 8), 0, Math.PI * 2);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = isPip ? 1.5 : 1.8;
      ctx.shadowColor = themeColor;
      ctx.shadowBlur = isPip ? 5 : 8;
      ctx.stroke();

      // 내부 중심점
      ctx.beginPath();
      ctx.arc(cs.x, cs.y, isPip ? 2.1 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // 특이점인 경우 정밀 스나이퍼 십자선 가이드
      if (isFeature) {
        const cOuter = isPip ? 10 : 13;
        const cInner = isPip ? 4 : 5;
        ctx.beginPath();
        ctx.moveTo(cs.x - cOuter, cs.y);
        ctx.lineTo(cs.x - cInner, cs.y);
        ctx.moveTo(cs.x + cInner, cs.y);
        ctx.lineTo(cs.x + cOuter, cs.y);
        ctx.moveTo(cs.x, cs.y - cOuter);
        ctx.lineTo(cs.x, cs.y - cInner);
        ctx.moveTo(cs.x, cs.y + cInner);
        ctx.lineTo(cs.x, cs.y + cOuter);
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = isPip ? 1.0 : 1.2;
        ctx.stroke();
      }

      // 미니 정보 뱃지 (대표님 기획: 신속한 스케치를 위해 좌표 숫자는 제거하고 특이점/곡선점 명칭만 깔끔하게 노출)
      const badgeText = cand.name || (isFeature ? '특이점' : '곡선 점');
      ctx.font = isPip ? 'bold 9.5px system-ui, -apple-system, sans-serif' : 'bold 11px system-ui, -apple-system, sans-serif';
      const bW = ctx.measureText(badgeText).width + (isPip ? 11 : 14);
      const bH = isPip ? 17 : 20;
      const bX = cs.x + (isPip ? 9 : 12);
      const bY = cs.y - (isPip ? 20 : 24);

      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.white_paper;
      const isLight = curTheme.isLight || this.isMonochromeMode;

      ctx.save();
      if (isLight) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 1.5;
      }
      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.16)' : themeColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bX, bY, bW, bH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = isLight ? '#1e293b' : themeColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bX + 6, bY + bH / 2);
      ctx.restore();
    }

    ctx.restore();
  }

  // ========================================================
  // [🔤 캔버스 자유 수식 텍스트 라벨 (함수 이름표 & 축 이름표) 엔진]
  // ========================================================

  toggleTextToolMode(forceState) {
    this.isTextToolMode = forceState !== undefined ? forceState : !this.isTextToolMode;
    const btn = document.getElementById('btnQuickText');
    if (btn) btn.classList.toggle('active', this.isTextToolMode);
    const container = this.canvas.parentElement;
    if (container) container.classList.toggle('text-tool-active', this.isTextToolMode);

    // 보조 수선 모드와 상호 배타적 정리
    if (this.isTextToolMode && this.isDropLineMode) {
      this.toggleDropLineMode(false);
    }

    this.render();
    this.showToast(this.isTextToolMode ? '🔤 텍스트 도구 켜짐 (캔버스 클릭하여 이름표 추가)' : '🔤 텍스트 도구 꺼짐');
  }

  getCurrentMathUnitScale() {
    const h = this.screenHeight || window.innerHeight || 900;
    const effSpanY = Math.max(0.05, (this.ySpan || 5) / Math.max(0.05, this.zoomLevel || 1.0));
    return (h / 2) / effSpanY;
  }

  getEffectiveTextLabelFontSize(item) {
    const baseSize = (item && item.fontSize) ? item.fontSize : (this.textLabelFontSize || 16);
    if (!item) return baseSize;
    const curUnitScale = this.getCurrentMathUnitScale();
    if (!item.baseUnitScale || item.baseUnitScale <= 0) {
      item.baseUnitScale = curUnitScale;
    }
    const ratio = curUnitScale / item.baseUnitScale;
    return Math.max(4, Math.min(180, parseFloat((baseSize * ratio).toFixed(2))));
  }

  addTextLabel(mathX, mathY, defaultText = '', autoEdit = null) {
    this.pushHistoryState();
    const newId = 'txt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const cleanText = this.sanitizeMathLabel(defaultText);
    const item = {
      id: newId,
      mathX,
      mathY,
      text: cleanText,
      fontSize: this.textLabelFontSize || 16,
      baseUnitScale: this.getCurrentMathUnitScale(),
      color: null
    };
    this.textLabels.push(item);

    const shouldEdit = autoEdit !== null ? autoEdit : (!cleanText);
    if (shouldEdit) {
      const s = this.mathToScreen(mathX, mathY);
      this.startEditingTextLabel(newId, s);
    }
    this.render();
    return item;
  }

  removeTextLabel(id) {
    const idx = this.textLabels.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.pushHistoryState();
    this.textLabels.splice(idx, 1);
    this.render();
    this.showToast('🗑️ 텍스트 라벨 삭제 완료');
  }

  clearAllTextLabels() {
    if (!this.textLabels || this.textLabels.length === 0) return;
    this.pushHistoryState();
    this.textLabels = [];
    this.render();
    this.showToast('🗑️ 모든 텍스트 라벨 삭제 완료');
  }

  startEditingTextLabel(id, screenPos) {
    this.activeEditingTextId = id;
    this.isTextEditingJustStarted = true;
    setTimeout(() => {
      this.isTextEditingJustStarted = false;
    }, 450);

    if (!this.canvasTextInputEl) {
      this.canvasTextInputEl = document.getElementById('canvasTextInput');
    }
    if (!this.canvasTextInputEl) return;
    const input = this.canvasTextInputEl;
    const item = this.textLabels.find(t => t.id === id);
    const fSize = item ? this.getEffectiveTextLabelFontSize(item) : (this.textLabelFontSize || 20);
    input.value = item ? item.text : '';
    input.style.fontSize = `${fSize}px`;
    input.style.left = `${screenPos.x}px`;
    input.style.top = `${screenPos.y}px`;
    input.style.display = 'block';

    // 브라우저의 마우스 클릭 이벤트 사이클이 완전히 종료된 후 안정적으로 포커스 부여
    setTimeout(() => {
      input.focus();
      input.select();
    }, 25);
  }

  commitEditingTextLabel() {
    if (!this.activeEditingTextId) return;
    this.isTextEditingJustStarted = false;
    const id = this.activeEditingTextId;
    const input = this.canvasTextInputEl;
    const raw = (input ? input.value : '').trim();
    const clean = this.sanitizeMathLabel(raw);
    const item = this.textLabels.find(t => t.id === id);

    if (item) {
      if (!clean) {
        // 내용이 빈칸이면 라벨 자동 삭제
        this.textLabels = this.textLabels.filter(t => t.id !== id);
      } else if (item.text !== clean) {
        this.pushHistoryState();
        item.text = clean;
      }
    }

    this.activeEditingTextId = null;
    if (input) input.style.display = 'none';
    this.render();
  }

  cancelEditingTextLabel() {
    if (!this.activeEditingTextId) return;
    this.isTextEditingJustStarted = false;
    const id = this.activeEditingTextId;
    const item = this.textLabels.find(t => t.id === id);
    if (item && !item.text) {
      this.textLabels = this.textLabels.filter(t => t.id !== id);
    }
    this.activeEditingTextId = null;
    if (this.canvasTextInputEl) this.canvasTextInputEl.style.display = 'none';
    this.render();
  }

  hitTestTextLabel(screenPos) {
    if (!this.renderedTextLabels || this.renderedTextLabels.length === 0) return null;
    for (let i = this.renderedTextLabels.length - 1; i >= 0; i--) {
      const entry = this.renderedTextLabels[i];
      // 1. 우상단 ✕ 삭제 버튼 히트테스트
      const cb = entry.closeBox;
      if (cb) {
        const d = Math.hypot(screenPos.x - cb.x, screenPos.y - cb.y);
        if (d <= cb.r + 4) {
          return { id: entry.id, isClose: true };
        }
      }
      // 2. 텍스트 바운딩 박스 히트테스트
      const b = entry.box;
      if (screenPos.x >= b.x && screenPos.x <= b.x + b.w &&
        screenPos.y >= b.y && screenPos.y <= b.y + b.h) {
        return { id: entry.id, item: entry.item, box: entry.box, screenPos: entry.screenPos, isClose: false };
      }
    }
    return null;
  }

  drawTextLabels(ctx, isExport = false) {
    if (!isExport) this.renderedTextLabels = [];
    if (!this.textLabels || this.textLabels.length === 0) return;

    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
    const isLight = curTheme.isLight || this.isMonochromeMode;
    const defaultTextColor = this.isMonochromeMode ? '#000000' : (isLight ? '#0f172a' : '#f8fafc');
    const haloColor = this.isMonochromeMode ? '#ffffff' : (isLight ? '#ffffff' : (curTheme.bg || '#1e1e2e'));

    let fontFam = "'STIX Two Text', 'Times New Roman', 'Cambria Math', serif";
    if (this.dropLineFontFamily === 'pretendard') fontFam = "'Pretendard', -apple-system, sans-serif";
    else if (this.dropLineFontFamily === 'batang') fontFam = "'KoPubWorld Batang', 'Batang', serif";

    ctx.save();

    this.textLabels.forEach(item => {
      if (!item.text && item.id !== this.activeEditingTextId) return;

      const s = this.mathToScreen(item.mathX, item.mathY);
      const baseSize = item.fontSize || this.textLabelFontSize || 16;
      const fSize = this.getEffectiveTextLabelFontSize(item);
      const scaleRatio = fSize / Math.max(1, baseSize);

      // 현재 인라인 편집 중인 텍스트는 캔버스 렌더링 생략 (DOM 인풋이 표시)
      if (item.id === this.activeEditingTextId) return;

      ctx.save();
      ctx.font = `italic 500 ${fSize}px ${fontFam}`;
      ctx.fillStyle = this.isMonochromeMode ? '#000000' : (item.color || defaultTextColor);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // 외곽 헤일로(Halo) 후 텍스트 출력으로 시인성 극대화
      ctx.save();
      ctx.strokeStyle = haloColor;
      ctx.lineWidth = Math.max(2, Math.min(4.5, 3.2 * scaleRatio));
      ctx.lineJoin = 'round';
      ctx.strokeText(item.text, s.x, s.y);
      ctx.restore();
      ctx.fillText(item.text, s.x, s.y);

      const metrics = ctx.measureText(item.text);
      const textW = Math.max(14 * scaleRatio, metrics.width);
      const pad = Math.max(4, Math.round(10 * Math.min(1.2, scaleRatio)));
      const box = {
        x: s.x - pad,
        y: s.y - fSize / 2 - pad,
        w: textW + pad * 2,
        h: fSize + pad * 2
      };
      const closeBox = {
        x: box.x + box.w + 5,
        y: box.y + 4,
        r: 7
      };

      // 편집 화면 호버 하이라이트 (스샷/내보내기 시 100% 생략)
      if (!isExport && !this.isCleanView && this.hoverTextLabelId === item.id) {
        ctx.save();
        ctx.strokeStyle = 'rgba(162, 155, 254, 0.7)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(box.x, box.y, box.w, box.h);

        // 귀여운 ✕ 삭제 배지
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(closeBox.x, closeBox.y, closeBox.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 107, 107, 0.9)';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', closeBox.x, closeBox.y);
        ctx.restore();
      }

      if (!isExport) this.renderedTextLabels.push({
        id: item.id,
        item,
        box,
        closeBox,
        screenPos: s
      });

      ctx.restore();
    });

    ctx.restore();
  }

  getLinkedPartner(g) {
    if (!g || !g.linkedInverseId) return null;
    return this.graphs.find(other => other.id === g.linkedInverseId) || null;
  }

  findInverseCandidate(src) {
    const inverseMap = {
      'exp_basic': 'log_basic',
      'log_basic': 'exp_basic',
      '2nd_quadratic': 'sqrt_basic',
      'sqrt_basic': '2nd_quadratic',
      'rational_basic': 'rational_basic',
      '1st_linear': '1st_linear'
    };
    const targetType = inverseMap[src.type];
    if (!targetType) return null;
    return this.graphs.find(other => other !== src && other.type === targetType && !other.linkedInverseId) || null;
  }

  toggleInverseLink(idx = this.activeGraphIdx) {
    if (idx < 0 || idx >= this.graphs.length) return;
    const g = this.graphs[idx];
    this.pushHistoryState();

    if (g.linkedInverseId) {
      const partner = this.getLinkedPartner(g);
      if (partner) partner.linkedInverseId = null;
      g.linkedInverseId = null;
      this.showToast('🔓 원함수와 역함수의 연동이 해제되었습니다. 이제 각자 독립적으로 조작할 수 있습니다.');
    } else {
      const candidate = this.findInverseCandidate(g);
      if (candidate) {
        if (!g.id) g.id = Date.now();
        if (!candidate.id) candidate.id = Date.now() + 1;
        g.linkedInverseId = candidate.id;
        candidate.linkedInverseId = g.id;
        const gName = this.meta[g.type]?.name || '함수';
        const cName = this.meta[candidate.type]?.name || '역함수';
        this.showToast(`🔗 ${gName}와 ${cName}가 다시 대칭 연동되었습니다!`);
      } else {
        this.showToast('ℹ️ 연동할 상대 역함수가 없습니다. [🔄 역함수 복제]로 새로 생성하세요.');
      }
    }

    this.renderLayerList();
    this.syncControls();
    this.render();
  }

  cloneInverseGraph() {
    if (!this.activeGraph) {
      this.showToast('ℹ️ 역함수를 생성할 원본 그래프를 먼저 선택하세요.');
      return;
    }
    if (this.graphs.length >= 12) {
      this.showToast('⚠️ 그래프는 최대 12개까지 동시에 추가할 수 있습니다.');
      return;
    }

    const src = this.activeGraph;

    // 1) 고교 수학 대표 역함수 타입 스마트 1:1 매핑
    let targetType = null;
    if (src.type === 'exp_basic') {
      targetType = 'log_basic';
    } else if (src.type === 'log_basic') {
      targetType = 'exp_basic';
    } else if (src.type === '2nd_quadratic') {
      targetType = 'sqrt_basic';
    } else if (src.type === 'sqrt_basic') {
      targetType = '2nd_quadratic';
    } else if (src.type === 'rational_basic') {
      targetType = 'rational_basic';
    } else if (src.type === '1st_linear') {
      targetType = '1st_linear';
    }

    if (!targetType) {
      const srcName = this.meta[src.type]?.name || '함수';
      this.showToast(`ℹ️ 역함수 복제는 지수·로그, 이차·무리, 유리, 일차함수를 지원합니다. (${srcName})`);
      return;
    }

    this.pushHistoryState();

    // 2) 핸들러 좌표 y = x 대칭 (x ↔ y 스왑)
    const newHandles = (src.handles || []).map((h, i) => {
      let handleName = h.name;
      let isHidden = h.hidden;
      if (targetType === 'sqrt_basic' && i === 0) {
        handleName = '시작점';
        isHidden = false;
      } else if (targetType === '2nd_quadratic' && i === 0) {
        handleName = '꼭짓점';
        isHidden = false;
      }
      return {
        name: handleName,
        x: parseFloat(h.y.toFixed(3)),
        y: parseFloat(h.x.toFixed(3)),
        type: h.type,
        hidden: isHidden
      };
    });

    // 3) 평행이동(freezeOffset) 및 다단변환(transforms) y = x 대칭 (dx ↔ dy 스왑)
    const srcOx = (src.freezeOffset && typeof src.freezeOffset.x === 'number') ? src.freezeOffset.x : 0;
    const srcOy = (src.freezeOffset && typeof src.freezeOffset.y === 'number') ? src.freezeOffset.y : 0;
    const newFreezeOffset = { x: srcOy, y: srcOx };

    const newTransforms = (src.transforms || []).map(t => ({
      offset: {
        x: (t.offset && typeof t.offset.y === 'number') ? t.offset.y : 0,
        y: (t.offset && typeof t.offset.x === 'number') ? t.offset.x : 0
      },
      invertV: t.invertH || false,
      invertH: t.invertV || false,
      abs: t.abs || false
    }));

    // 4) 색상: 색상 고정 모드면 고정 색상, 자동 배색이면 원본과 구별되는 컬러 배정
    const palette = ['#ff7675', '#00cec9', '#a29bfe', '#ffeaa7', '#74b9ff', '#fd79a8', '#55efc4'];
    const filteredColors = palette.filter(c => c.toLowerCase() !== (src.color || '').toLowerCase());
    const nextColor = (this.graphColorMode === 'fixed' && this.fixedGraphColor)
      ? this.fixedGraphColor
      : filteredColors[this.graphs.length % filteredColors.length];

    // 5) 새 그래프 객체 생성 및 상호 대칭 연동 (Linked Inverse)
    if (!src.id) src.id = Date.now() - 1;
    const newId = Date.now() + Math.floor(Math.random() * 1000);

    const newGraph = {
      id: newId,
      type: targetType,
      category: this.meta[targetType]?.category || src.category,
      handles: newHandles,
      color: nextColor,
      lineWidth: src.lineWidth || 2.8,
      isAbsolute: Boolean(src.isAbsolute),
      shapeMode: 'free',
      originCenter: false,
      isFrozen: Boolean(src.isFrozen),
      freezeOffset: newFreezeOffset,
      transforms: newTransforms,
      frozenInvertH: Boolean(src.frozenInvertV),
      frozenInvertV: Boolean(src.frozenInvertH),
      frozenAbsolute: Boolean(src.frozenAbsolute),
      isIndependent: Boolean(this.usePiecewise),
      linkedInverseId: src.id
    };

    src.linkedInverseId = newId; // 원함수에도 역함수 ID 연동!

    this.graphs.push(newGraph);
    this.activeGraphIdx = this.graphs.length - 1;
    this.selectedHandleIdx = null;
    this.isCurveSelected = true;

    // y = x 대칭 기준선 자동 On!
    this.showInverseGuide = true;
    const chkInv = document.getElementById('chkInverseGuide');
    if (chkInv) chkInv.checked = true;

    this.syncControls();
    this.renderLayerList();
    this.renderFuncList();
    this.updateIntersections();
    this.render();

    const srcName = this.meta[src.type]?.name || '함수';
    const tgtName = this.meta[targetType]?.name || '역함수';
    this.showToast(`🔄 ${srcName}의 y=x 대칭 역함수 (${tgtName}) 생성 완료!`);
  }


  // 🌟 [대표님 기획: 상단 중앙 초슬림 캡슐바 및 핵심 변환 엔진]
  reflectXAxis() {
    if (!this.activeGraph) return;
    this.pushHistoryState();
    this._applyGraphSymmetry(this.activeGraph, 'x');
    this.showToast('↕️ x축 대칭 완료!');
    this.render();
  }

  reflectYAxis() {
    if (!this.activeGraph) return;
    this.pushHistoryState();
    this._applyGraphSymmetry(this.activeGraph, 'y');
    this.showToast('↔️ y축 대칭 완료!');
    this.render();
  }

  reflectOrigin() {
    if (!this.activeGraph) return;
    this.pushHistoryState();
    this._applyGraphSymmetry(this.activeGraph, 'origin');
    this.showToast('🎯 원점 대칭 완료!');
    this.render();
  }

  toggleAbsolute() {
    if (!this.activeGraph) {
      this.showToast('ℹ️ 절댓값을 적용할 그래프를 먼저 선택하세요.');
      return;
    }
    const g = this.activeGraph;
    this.pushHistoryState();
    const msg = this._applyGraphToggleAbsolute(g);
    this.syncControls();
    this.syncCurveContextBar();
    this.render();
    if (msg) this.showToast(msg);
  }


  // 🌟 [대표님 기획: 교재 캡처영역 프레임 원터치 토글 (저장 전 확인용)]
  toggleViewfinder(forceVal = null) {
    const nextVal = (forceVal !== null) ? Boolean(forceVal) : !this.useViewfinder;
    this.useViewfinder = nextVal;

    const btnRail = document.getElementById('btnRailToggleVf');
    if (btnRail) btnRail.classList.toggle('active', this.useViewfinder);

    const chkVf = document.getElementById('chkVf');
    if (chkVf) chkVf.checked = this.useViewfinder;

    // 캡처 프레임을 켤 때는 칠판 시야를 가리지 않도록 서랍 자동 닫기!
    if (this.useViewfinder && typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed) {
      this.closeDrawer();
    }

    this.showToast(this.useViewfinder
      ? '📷 교재 캡처 프레임 켜짐 (모서리를 드래그하여 조절하세요)'
      : '📷 교재 캡처 프레임 숨김 (전체 화면 캡처 모드)');
    this.render();
  }

  closeCurveContextSubPopovers() {
    const symPop = document.getElementById('ctxSymmetryPopover');
    const absPop = document.getElementById('ctxAbsPopover');
    const btnSymMenu = document.getElementById('ctxBtnSymmetryMenu');
    if (symPop) symPop.style.display = 'none';
    if (absPop) absPop.style.display = 'none';
    if (btnSymMenu) btnSymMenu.classList.remove('active');
  }

  initCurveContextBar() {
    this.curveContextBar = document.getElementById('curveContextBar');
    if (!this.curveContextBar) return;

    const btnSymMenu = document.getElementById('ctxBtnSymmetryMenu');
    const symPop = document.getElementById('ctxSymmetryPopover');
    const btnAbsMenu = document.getElementById('ctxBtnAbsMenu');
    const absPop = document.getElementById('ctxAbsPopover');

    if (btnSymMenu && symPop) {
      btnSymMenu.onclick = (e) => {
        e.stopPropagation();
        const isOpen = symPop.style.display !== 'none';
        this.closeCurveContextSubPopovers();
        if (!isOpen) {
          symPop.style.display = 'flex';
          btnSymMenu.classList.add('active');
        }
      };
    }

    if (btnAbsMenu && absPop) {
      btnAbsMenu.onclick = (e) => {
        e.stopPropagation();
        const isOpen = absPop.style.display !== 'none';
        this.closeCurveContextSubPopovers();
        if (!isOpen) {
          absPop.style.display = 'flex';
        }
      };
    }

    if (!this._boundCurveCtxPopoverDismiss) {
      this._boundCurveCtxPopoverDismiss = (e) => {
        if (!this.curveContextBar || this.curveContextBar.style.display === 'none') return;
        if (!this.curveContextBar.contains(e.target)) {
          this.closeCurveContextSubPopovers();
        }
      };
      document.addEventListener('pointerdown', this._boundCurveCtxPopoverDismiss);
    }

    const btnInvertV = document.getElementById('ctxBtnInvertV');
    if (btnInvertV) btnInvertV.onclick = () => {
      this.closeCurveContextSubPopovers();
      this.reflectXAxis();
    };

    const btnInvertH = document.getElementById('ctxBtnInvertH');
    if (btnInvertH) btnInvertH.onclick = () => {
      this.closeCurveContextSubPopovers();
      this.reflectYAxis();
    };

    const btnInvertOrigin = document.getElementById('ctxBtnInvertOrigin');
    if (btnInvertOrigin) btnInvertOrigin.onclick = () => {
      this.closeCurveContextSubPopovers();
      this.reflectOrigin();
    };

    const btnInverse = document.getElementById('ctxBtnInverse');
    if (btnInverse) btnInverse.onclick = () => {
      this.closeCurveContextSubPopovers();
      this.cloneInverseGraph();
    };

    const btnToggleLink = document.getElementById('ctxBtnToggleLink');
    if (btnToggleLink) btnToggleLink.onclick = () => {
      this.closeCurveContextSubPopovers();
      this.toggleInverseLink();
    };

    const btnToggleAbs = document.getElementById('ctxBtnToggleAbs');
    if (btnToggleAbs) btnToggleAbs.onclick = () => {
      this.closeCurveContextSubPopovers();
      this.toggleAbsolute();
    };

    const btnDuplicate = document.getElementById('ctxBtnDuplicate');
    if (btnDuplicate) btnDuplicate.onclick = () => {
      this.closeCurveContextSubPopovers();
      this.duplicateGraph();
    };

    const btnResetFz = document.getElementById('ctxBtnResetFz');
    if (btnResetFz) {
      btnResetFz.onclick = () => {
        this.closeCurveContextSubPopovers();
        if (!this.activeGraph) return;
        this.pushHistoryState();
        this.activeGraph.freezeOffset = { x: 0, y: 0 };
        this.activeGraph.transforms = [];
        this.syncControls();
        this.showToast('↺ 곡선 위치가 원위치로 리셋되었습니다.');
        this.render();
      };
    }

    const btnDelete = document.getElementById('ctxBtnDelete');
    if (btnDelete) {
      btnDelete.onclick = () => {
        this.closeCurveContextSubPopovers();
        if (this.activeGraphIdx >= 0) {
          const targetIdx = this.activeGraphIdx;
          this.isCurveSelected = false;
          this.selectedHandleIdx = null;
          this.removeGraph(targetIdx);
        }
      };
    }

    const btnClose = document.getElementById('ctxBtnClose');
    if (btnClose) {
      btnClose.onclick = () => {
        this.closeCurveContextSubPopovers();
        this.isCurveSelected = false;
        this.selectedHandleIdx = null;
        this.syncCurveContextBar();
        this.render();
      };
    }
  }

  syncCurveContextBar() {
    this._syncLineWidthSliderUI();
    if (document.body.classList.contains('viewer-graph-touch-mode')) {
      if (typeof this._renderViewerGraphCurveChips === 'function') {
        this._renderViewerGraphCurveChips();
      }
      if (this.curveContextBar) this.curveContextBar.style.display = 'none';
      return;
    }
    if (!this.curveContextBar) {
      this.curveContextBar = document.getElementById('curveContextBar');
    }
    if (!this.curveContextBar) return;

    // 🌟 [대표님 긴급 해결: 꾸욱 누르고 있는 동안(Down/Hold/Drag)에는 상단 캡슐 바가 절대 위에서 내려오지 않음] 🌟
    const shouldShow = Boolean(
      !this.isGraphCovered &&
      !this.isGraphSnapMode &&
      !this.isPointerDownOnCanvas &&
      this.isCurveSelected &&
      this.activeGraph &&
      (!this.isInkMode || this.activeInkTool === 'select')
    );

    if (!shouldShow) {
      const wasVisible = (this.curveContextBar.style.display !== 'none');
      this.closeCurveContextSubPopovers();
      this.curveContextBar.style.display = 'none';
      if (wasVisible && this.isAudioRecording && !this._isApplyingAudioTimelineState) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      return;
    }

    const wasHidden = (this.curveContextBar.style.display === 'none');
    this.curveContextBar.style.display = 'flex';
    if (wasHidden && this.isAudioRecording && !this._isApplyingAudioTimelineState) {
      this._recordAudioWorkspaceStateIfNeeded(true);
    }
    const g = this.activeGraph;

    const dot = document.getElementById('ctxBarDot');
    if (dot) dot.style.background = g.color || '#00d2d3';

    const name = document.getElementById('ctxBarName');
    if (name) {
      name.textContent = `f${this.activeGraphIdx + 1}`;
    }

    const isAbsActive = Boolean(g.isAbsolute && g.isAbsPristine);
    const btnAbsMenu = document.getElementById('ctxBtnAbsMenu');
    if (btnAbsMenu) {
      btnAbsMenu.classList.toggle('active', isAbsActive);
    }
    const btnAbs = document.getElementById('ctxBtnToggleAbs');
    if (btnAbs) {
      btnAbs.classList.toggle('active', isAbsActive);
      btnAbs.title = '';
    }

    const btnLink = document.getElementById('ctxBtnToggleLink');
    if (btnLink) {
      btnLink.style.display = g.linkedInverseId ? 'inline-flex' : 'none';
    }

  }

  duplicateGraph(idx = this.activeGraphIdx) {
    if (idx < 0 || idx >= this.graphs.length) return;
    if (this.graphs.length >= 12) {
      this.showToast('⚠️ 그래프는 최대 12개까지 동시에 추가할 수 있습니다.');
      return;
    }

    this.pushHistoryState();
    const src = this.graphs[idx];

    // 색상 팔레트 배정 (색상 고정 모드면 고정 색상 유지)
    const palette = ['#ffeaa7', '#00cec9', '#ff7675', '#a29bfe', '#74b9ff', '#fd79a8', '#55efc4'];
    const filteredColors = palette.filter(c => c.toLowerCase() !== (src.color || '').toLowerCase());
    const nextColor = (this.graphColorMode === 'fixed' && this.fixedGraphColor)
      ? this.fixedGraphColor
      : filteredColors[this.graphs.length % filteredColors.length];

    // 🌟 [대표님 기획: 복제 시 x축 평행이동 오프셋]: 원본과 겹치지 않게 x축 방향으로만 약간(+1.5) 평행이동 상태로 생성!
    // 일반 함수(및 연동 해제된 역함수: 로그·무리·유리 등)는 핸들 좌표를 직접 +1.5 이동시켜 곡선과 핸들·점근선이 100% 일치하게 생성!
    const srcOx = (src.freezeOffset && typeof src.freezeOffset.x === 'number') ? src.freezeOffset.x : 0;
    const srcOy = (src.freezeOffset && typeof src.freezeOffset.y === 'number') ? src.freezeOffset.y : 0;
    const hasOuterTransforms = Boolean(
      src.isAbsolute ||
      src.isFrozen ||
      src.frozenInvertH ||
      src.frozenInvertV ||
      src.frozenAbsolute ||
      (src.transforms && src.transforms.length > 0)
    );

    let newHandles;
    let newFreezeOffset;
    if (hasOuterTransforms) {
      newHandles = (src.handles || []).map(h => ({ ...h }));
      newFreezeOffset = { x: parseFloat((srcOx + 1.5).toFixed(3)), y: srcOy };
    } else {
      newHandles = (src.handles || []).map(h => ({
        ...h,
        x: parseFloat((h.x + srcOx + 1.5).toFixed(3)),
        y: parseFloat((h.y + srcOy).toFixed(3))
      }));
      newFreezeOffset = { x: 0, y: 0 };
    }

    const newGraph = {
      id: Date.now(),
      type: src.type,
      category: src.category,
      handles: newHandles,
      color: nextColor,
      lineWidth: src.lineWidth || 2.8,
      isAbsolute: Boolean(src.isAbsolute),
      shapeMode: src.shapeMode || 'free',
      originCenter: Boolean(src.originCenter),
      isFrozen: Boolean(src.isFrozen),
      freezeOffset: newFreezeOffset,
      transforms: (src.transforms || []).map(t => ({
        offset: { ...(t.offset || { x: 0, y: 0 }) },
        invertV: Boolean(t.invertV),
        invertH: Boolean(t.invertH),
        abs: Boolean(t.abs)
      })),
      frozenInvertH: Boolean(src.frozenInvertH),
      frozenInvertV: Boolean(src.frozenInvertV),
      frozenAbsolute: Boolean(src.frozenAbsolute),
      isIndependent: Boolean(this.usePiecewise),
      linkedInverseId: null
    };

    this.graphs.push(newGraph);
    this.activeGraphIdx = this.graphs.length - 1;
    this.selectedHandleIdx = null;
    this.isCurveSelected = true;

    this.syncControls();
    this.renderLayerList();
    this.renderFuncList();
    this.updateIntersections();
    this.render();

    const name = this.meta[src.type]?.name || '함수';
    this.showToast(`📋 f${idx + 1}(x) (${name}) 복제 완료!`);
  }

  drawAllAsymptotes(ctx) {
    this.graphs.forEach(g => {
      if (['exp_basic', 'log_basic', 'rational_basic', 'tan_1period'].includes(g.type)) {
        this.drawSingleAsymptote(ctx, g);
      }
    });
  }

  drawSingleAsymptote(ctx, g) {
    const isPip = Boolean(this._isRenderingGraphSnapshot);
    ctx.save();
    ctx.strokeStyle = this.isMonochromeMode ? '#000000' : g.color;
    ctx.globalAlpha = this.isMonochromeMode ? 0.75 : 0.55;
    ctx.lineWidth = isPip ? 1.0 : 1.2;
    ctx.setLineDash(isPip ? [4, 4] : [5, 5]);

    let ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    let oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    if (g.transforms && g.transforms.length > 0) {
      for (const t of g.transforms) {
        if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
        if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
      }
    }

    if (g.type === 'exp_basic') {
      const y0 = g.handles[0].y + oy;
      const s = this.mathToScreen(0, y0);
      ctx.beginPath();
      ctx.moveTo(0, s.y);
      ctx.lineTo(this.screenWidth, s.y);
      ctx.stroke();
    } else if (g.type === 'log_basic') {
      const x0 = g.handles[0].x + ox;
      const s = this.mathToScreen(x0, 0);
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, this.screenHeight);
      ctx.stroke();
    } else if (g.type === 'rational_basic') {
      const x0 = g.handles[0].x + ox;
      const y0 = g.handles[0].y + oy;
      const sx = this.mathToScreen(x0, 0).x;
      const sy = this.mathToScreen(0, y0).y;

      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, this.screenHeight);
      ctx.moveTo(0, sy);
      ctx.lineTo(this.screenWidth, sy);
      ctx.stroke();
    } else if (g.type === 'tan_1period') {
      const x0 = g.handles[0].x + ox;
      let dx = g.handles.length >= 2 ? (g.handles[1].x + ox) - x0 : 0.785;
      if (Math.abs(dx) < 0.2) dx = dx >= 0 ? 0.2 : -0.2;
      const omega = Math.PI / (4.0 * Math.abs(dx));
      const halfPeriod = Math.PI / (2.0 * omega);
      const period = Math.PI / omega;

      const mLeft = this.screenToMath(0, 0).x;
      const mRight = this.screenToMath(this.screenWidth, 0).x;

      const kMin = Math.floor((mLeft - x0 - halfPeriod) / period) - 1;
      const kMax = Math.ceil((mRight - x0 - halfPeriod) / period) + 1;

      for (let k = kMin; k <= kMax; k++) {
        const asyX = x0 + halfPeriod + k * period;
        if (asyX >= mLeft && asyX <= mRight) {
          const sx = this.mathToScreen(asyX, 0).x;
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, this.screenHeight);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  drawPillBadge(ctx, text, cx, cy, options = {}) {
    ctx.save();
    ctx.font = options.font || 'bold 11px system-ui, -apple-system, sans-serif';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const padX = options.padX !== undefined ? options.padX : 8;
    const pillH = options.height || 20;
    const pillW = textWidth + padX * 2;
    const radius = pillH / 2;
    const x = cx - pillW / 2;
    const y = cy - pillH / 2;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, pillW, pillH, radius);
    } else {
      ctx.rect(x, y, pillW, pillH);
    }
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.white_paper;
    const isLight = curTheme.isLight || this.isMonochromeMode;

    if (isLight || options.shadow) {
      ctx.shadowColor = isLight ? 'rgba(0, 0, 0, 0.16)' : 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }

    ctx.fillStyle = options.bg || (isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.88)');
    ctx.fill();
    ctx.strokeStyle = options.border || (isLight ? 'rgba(0, 0, 0, 0.16)' : 'rgba(0, 210, 211, 0.6)');
    ctx.lineWidth = options.borderWidth || 1.2;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = options.color || (isLight ? '#1e293b' : '#00d2d3');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  // --- [대칭의 중심: 모든 함수가 황금색 기준점 핸들(handles)로 일관되게 통합되어 기존 십자(+) 마커 제거] ---
  drawSymmetryCenters(ctx, isExport = false) {
    return;
  }

  // --- [다중 곡선 렌더링 (모든 레이어 중첩)] ---
  drawAllCurves(ctx, isExport = false) {
    this.graphs.forEach((g, idx) => {
      const isActive = (idx === this.activeGraphIdx);
      this.drawSingleCurve(ctx, g, isActive, isExport, idx);
    });
  }

  drawSingleCurve(ctx, g, isActive, isExport = false, gIdx = 0) {
    ctx.save();
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;
    let curveColor = this.isMonochromeMode ? '#000000' : (g.color || '#2563eb');
    // 밝은 배경(화이트/포스트잇)일 때 흰색 곡선을 다크로 스마트 시인성 보호!
    if (!this.isMonochromeMode && curTheme.isLight && (curveColor.toLowerCase() === '#ffffff' || curveColor.toLowerCase() === '#fff')) {
      curveColor = '#222f3e';
    }
    ctx.strokeStyle = curveColor;
    const isPip = Boolean(this._isRenderingGraphSnapshot);
    const baseCurveLw = (g.lineWidth || 2.8) * (isPip ? 0.78 : 1.0);
    ctx.lineWidth = (isActive && this.isCurveSelected && !isExport) ? baseCurveLw + (isPip ? 0.35 : 0.6) : baseCurveLw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const isDragging = !!(this.isDraggingCurve || this.draggedHandleIdx !== null || this.isPanning || this.activePwDragIdx !== null || this.isResizingVf);

    // 활성 곡선 선택 시 네온 글로우 발광 (드래그 중에는 저사양 PC 프레임 보존을 위해 블러 바이패스, 흑백 모드 시 블러 없음)
    if (!this.isMonochromeMode && isActive && this.isCurveSelected && !isExport && !isDragging) {
      ctx.shadowColor = curveColor;
      ctx.shadowBlur = isPip ? 6 : 10;
    } else {
      ctx.shadowBlur = 0;
    }

    // [📐 평면도형 특수 케이스: 원 (Circle)]
    if (g.type === 'geom_circle' && g.handles.length >= 2) {
      const s0 = this.mathToScreen(g.handles[0].x, g.handles[0].y);
      const s1 = this.mathToScreen(g.handles[1].x, g.handles[1].y);
      const rPx = Math.hypot(s1.x - s0.x, s1.y - s0.y);

      ctx.beginPath();
      ctx.arc(s0.x, s0.y, rPx, 0, Math.PI * 2);
      ctx.fillStyle = this.hexToRgba(curveColor, 0.08);
      ctx.fill();
      ctx.stroke();

      // 원 중심 십자 마커
      if (!isExport) {
        ctx.save();
        ctx.strokeStyle = this.hexToRgba(curveColor, 0.6);
        ctx.lineWidth = 1.2;
        const cs = 5;
        ctx.beginPath();
        ctx.moveTo(s0.x - cs, s0.y); ctx.lineTo(s0.x + cs, s0.y);
        ctx.moveTo(s0.x, s0.y - cs); ctx.lineTo(s0.x, s0.y + cs);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      return;
    }

    // [📐 평면도형 특수 케이스: 삼각형 (Triangle)]
    if (g.type === 'geom_triangle' && g.handles.length >= 3) {
      const pts = g.handles.map(h => this.mathToScreen(h.x, h.y));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.closePath();
      ctx.fillStyle = this.hexToRgba(curveColor, 0.08);
      ctx.fill();
      ctx.stroke();

      // 꼭짓점 라벨 (A, B, C)
      if (!isExport) {
        ctx.save();
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = curveColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labels = ['A', 'B', 'C'];
        pts.forEach((p, i) => {
          ctx.fillText(labels[i], p.x + (p.x >= pts[0].x ? 12 : -12), p.y - 12);
        });
        ctx.restore();
      }

      ctx.restore();
      return;
    }

    // [📐 평면도형 특수 케이스: 사각형 (Quadrilateral)]
    if (g.type === 'geom_quad' && g.handles.length >= 4) {
      const pts = g.handles.map(h => this.mathToScreen(h.x, h.y));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[3].x, pts[3].y);
      ctx.closePath();
      ctx.fillStyle = this.hexToRgba(curveColor, 0.08);
      ctx.fill();
      ctx.stroke();

      // 꼭짓점 라벨 (A, B, C, D)
      if (!isExport) {
        ctx.save();
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = curveColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labels = ['A', 'B', 'C', 'D'];
        pts.forEach((p, i) => {
          ctx.fillText(labels[i], p.x + (i === 1 || i === 2 ? 12 : -12), p.y + (i < 2 ? 12 : -12));
        });
        ctx.restore();
      }

      ctx.restore();
      return;
    }

    // [일차함수 특수 케이스: 완전 수직선 (x = x0)]
    if (g.type === '1st_linear' && g.handles.length >= 2) {
      if (Math.abs(g.handles[1].x - g.handles[0].x) < 1e-4) {
        const sx = this.mathToScreen(g.handles[0].x, 0).x;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, this.screenHeight);
        ctx.stroke();
        ctx.restore();
        return;
      }
    }

    const isPwActive = this.usePiecewise && this.graphs.length >= 1 && !g.isIndependent;

    // [대표님 킬러 기획: 선택된 바로 그 함수만 원래 숨겨진 개형을 은은한 점선(Ghost)으로 짠! 표시]
    // 캔버스 빈 공간을 클릭하여 선택 해제하면 점선이 싹 사라지고 깔끔한 완성본 삽도로 자동 복귀!
    const shouldShowGhost = !isExport && !this.isCleanView && isPwActive && (isActive && (this.isCurveSelected || this.selectedHandleIdx !== null));

    // [특수 고밀도 렌더러 공통 디스패처 (Piecewise 2-패스 완벽 통합)]
    const renderSpecialWithPiecewise = (rendererFn) => {
      if (!isPwActive) {
        rendererFn(null);
      } else {
        if (shouldShowGhost) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.globalAlpha = 0.28;
          ctx.lineWidth = Math.max(1.0, g.lineWidth * 0.85);
          rendererFn(false);
          ctx.restore();
        }
        ctx.save();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;
        rendererFn(true);
        ctx.restore();
      }
    };

    const hasComplexOuter = Boolean(
      g.isFrozen ||
      g.frozenInvertH ||
      g.frozenInvertV ||
      g.frozenAbsolute ||
      (g.transforms && g.transforms.length > 0)
    );

    const resetGraphScreenPts = (graphObj) => {
      if (!graphObj) return;
      if (!Object.prototype.hasOwnProperty.call(graphObj, '_screenPts') || Object.prototype.propertyIsEnumerable.call(graphObj, '_screenPts')) {
        try {
          Object.defineProperty(graphObj, '_screenPts', { value: [], writable: true, enumerable: false, configurable: true });
        } catch (e) { }
      } else {
        graphObj._screenPts = [];
      }
      try {
        Object.defineProperty(graphObj, '_screenPtsW', { value: this.screenWidth, writable: true, enumerable: false, configurable: true });
        Object.defineProperty(graphObj, '_screenPtsH', { value: this.screenHeight, writable: true, enumerable: false, configurable: true });
      } catch (e) {
        graphObj._screenPtsW = this.screenWidth;
        graphObj._screenPtsH = this.screenHeight;
      }
    };

    // [유리함수 특수 케이스: 프리징 아닐 때 상하단 화면 끝 관통 2-브랜치 렌더링 (주기함수 시 traceCurve 샘플러로 통일)]
    if (!this.isPiecewisePeriodic && !hasComplexOuter && g.type === 'rational_basic' && g.handles.length >= 2) {
      if (!isExport) resetGraphScreenPts(g);
      renderSpecialWithPiecewise((filter) => this.drawRationalCurve(ctx, g, gIdx, filter));
      ctx.restore();
      return;
    }

    // [로그함수 특수 케이스: 프리징 아닐 때 수직 점근선 상하단 관통 고밀도 렌더링 (주기함수 시 traceCurve 샘플러로 통일)]
    if (!this.isPiecewisePeriodic && !hasComplexOuter && g.type === 'log_basic' && g.handles.length >= 2) {
      if (!isExport) resetGraphScreenPts(g);
      renderSpecialWithPiecewise((filter) => this.drawLogCurve(ctx, g, gIdx, filter));
      ctx.restore();
      return;
    }

    // [탄젠트 특수 케이스: 프리징 아닐 때 주기별 점근선 상하단 관통 고밀도 렌더링 (주기함수 시 traceCurve 샘플러로 통일)]
    if (!this.isPiecewisePeriodic && !hasComplexOuter && g.type === 'tan_1period' && g.handles.length >= 1) {
      if (!isExport) resetGraphScreenPts(g);
      renderSpecialWithPiecewise((filter) => this.drawTangentCurve(ctx, g, gIdx, filter));
      ctx.restore();
      return;
    }

    // [무리함수 특수 케이스: 프리징 아닐 때 시작점 칼고정 고정밀 렌더링 (주기함수 시 traceCurve 샘플러로 통일)]
    if (!this.isPiecewisePeriodic && !hasComplexOuter && g.type === 'sqrt_basic' && g.handles.length >= 2) {
      if (!isExport) resetGraphScreenPts(g);
      renderSpecialWithPiecewise((filter) => this.drawSqrtCurve(ctx, g, gIdx, filter));
      ctx.restore();
      return;
    }

    // 🚀 [초고밀도 렌더링 & 절댓값 첨점(Cusp) 칼고정 엔진]:
    // 확대·축소 시 샘플 그리드가 이동하며 절댓값 꺾인 점(x축 접점)이나 극점이 들썩거리며 떨리는 현상을 0.000%로 원천 박멸!
    const steps = isExport ? 1500 : (isDragging ? 600 : 840);
    const mLeft = this.screenToMath(0, 0).x;
    const mRight = this.screenToMath(this.screenWidth, 0).x;
    const stepSize = (mRight - mLeft) / steps;

    if (!isExport) {
      resetGraphScreenPts(g);
    }

    const hasTransformAbs = Boolean(g.transforms && g.transforms.some(t => t && t.abs));
    const isAbsActive = Boolean(g.isAbsolute || (g.isFrozen && g.frozenAbsolute) || g.frozenAbsolute || hasTransformAbs);

    // 절댓값(Math.abs) 적용 직전의 '부호 있는(Signed) 내부 함수값 배열'을 반환하는 헬퍼:
    // 기존에는 evaluatePipeline()이 이미 Math.abs()를 씌운 양수(>= 0)만 반환했기 때문에
    // (prevRawY > 0 && rawY < 0) 부호 반전 조건이 영원히 false가 되어 x축 첨점 보정이 작동하지 않았던 문제를 완벽 해결!
    const getSignedFoldValues = (evalX) => {
      const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
      const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
      const folds = [];
      if (g.transforms && g.transforms.length > 0) {
        let curX = evalX;
        let totalOx = ox;
        for (const t of g.transforms) {
          if (t.offset && typeof t.offset.x === 'number') totalOx += t.offset.x;
        }
        curX -= totalOx;
        let y = this.engine.evaluate(g.type, g.handles, curX);
        if (g.isAbsolute) {
          folds.push(y);
          y = Math.abs(y);
        }
        for (const t of g.transforms) {
          if (t.offset && typeof t.offset.y === 'number') y += t.offset.y;
          if (t.invertV) y = -y;
          if (t.abs) {
            folds.push(y);
            y = Math.abs(y);
          }
        }
        y += oy;
        if (g.frozenAbsolute) {
          folds.push(y);
        }
        return folds;
      }
      let baseX = evalX - ox;
      if (g.frozenInvertH) baseX = -baseX;
      let y = this.engine.evaluate(g.type, g.handles, baseX);
      if (g.isAbsolute) {
        folds.push(y);
        y = Math.abs(y);
      }
      if (g.frozenInvertV) y = -y;
      y += oy;
      if (g.frozenAbsolute) {
        folds.push(y);
      }
      return folds;
    };

    const bisectFoldRoot = (xA, xB, fA, fB, stageIdx) => {
      let xLow = xA, xHigh = xB;
      let yLow = fA, yHigh = fB;
      const denom0 = Math.abs(yLow) + Math.abs(yHigh);
      let xZero = denom0 > 1e-14 ? (xLow + (Math.abs(yLow) / denom0) * (xHigh - xLow)) : (0.5 * (xLow + xHigh));
      for (let iter = 0; iter < 16; iter++) {
        const fArr = getSignedFoldValues(xZero);
        const yMid = fArr[stageIdx];
        if (yMid === undefined || isNaN(yMid) || Math.abs(yMid) < 1e-12) break;
        if ((yLow > 0 && yMid < 0) || (yLow < 0 && yMid > 0)) {
          xHigh = xZero;
          yHigh = yMid;
        } else {
          xLow = xZero;
          yLow = yMid;
        }
        const denom = Math.abs(yLow) + Math.abs(yHigh);
        const secant = denom > 1e-14 ? (xLow + (Math.abs(yLow) / denom) * (xHigh - xLow)) : (0.5 * (xLow + xHigh));
        xZero = (iter % 2 === 0 && secant > Math.min(xLow, xHigh) && secant < Math.max(xLow, xHigh))
          ? secant
          : (0.5 * (xLow + xHigh));
      }
      return xZero;
    };

    // 그래프의 극점·꼭짓점 등 핸들 X좌표도 샘플링에 고정하여 축소 시 극점이 들썩거리는 현상까지 원천 방지
    const pinnedHandleXs = [];
    if (g.handles && g.handles.length > 0 && !(this.usePiecewise && this.isPiecewisePeriodic && !g.isIndependent)) {
      let ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
      if (g.transforms && g.transforms.length > 0) {
        for (const t of g.transforms) {
          if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
        }
      }
      for (let hIdx = 0; hIdx < g.handles.length; hIdx++) {
        const hx = g.handles[hIdx].x + ox;
        if (hx > mLeft && hx < mRight) pinnedHandleXs.push(hx);
      }
    }

    const traceCurve = (filterInside = null) => {
      ctx.beginPath();
      let started = false;
      let prevRawY = null;
      let prevMx = null;
      let prevEvalX = null;
      let prevFolds = null;
      let prevCycleK = null;
      const collectPts = !isExport && (filterInside === null || filterInside === true);

      const emitScreenPoint = (targetMx, targetEvalX, yOff) => {
        const yVal = this.engine.evaluatePipeline(g, targetEvalX) + yOff;
        if (isNaN(yVal) || !isFinite(yVal) || Math.abs(yVal) > 100) return;
        const sp = this.mathToScreen(targetMx, yVal);
        ctx.lineTo(sp.x, sp.y);
        if (collectPts) g._screenPts.push({ x: sp.x, y: sp.y });
      };

      for (let i = 0; i <= steps; i++) {
        const mx = mLeft + i * stepSize;

        // Piecewise 구간 필터 적용
        if (filterInside !== null) {
          const inPiece = this.isInsidePiece(gIdx, mx);
          if (inPiece !== filterInside) {
            if (started && collectPts && g._screenPts.length > 0 && g._screenPts[g._screenPts.length - 1] !== null) {
              g._screenPts.push(null);
            }
            started = false;
            prevRawY = null;
            prevMx = null;
            prevEvalX = null;
            prevFolds = null;
            continue;
          }
        }

        // [❄️ 형상 프리징 & 계층형 2차 변환(대칭/2차 절댓값) 파이프라인 연산]
        let evalX = mx;
        let yOffset = 0;
        let curCycleK = 0;
        if (this.usePiecewise && this.isPiecewisePeriodic && this.piecewiseBoundaries.length >= 2 && !g.isIndependent) {
          const b0 = this.piecewiseBoundaries[0];
          const bLast = this.piecewiseBoundaries[this.piecewiseBoundaries.length - 1];
          const T = bLast - b0;
          if (T > 1e-4) {
            curCycleK = Math.floor((mx - b0) / T);
            let xBase = mx - curCycleK * T;
            if (xBase >= bLast - 1e-6) xBase = b0;
            if (xBase < b0) xBase = b0;
            evalX = xBase;
            yOffset = curCycleK * (this.periodicStepY || 0);
          }
        }

        if (started && prevCycleK !== null && curCycleK !== prevCycleK) {
          ctx.stroke();
          ctx.beginPath();
          if (collectPts && g._screenPts.length > 0 && g._screenPts[g._screenPts.length - 1] !== null) {
            g._screenPts.push(null);
          }
          started = false;
          prevRawY = null;
          prevMx = null;
          prevEvalX = null;
          prevFolds = null;
        }
        prevCycleK = curCycleK;

        const rawY = this.engine.evaluatePipeline(g, evalX) + yOffset;

        if (isNaN(rawY) || !isFinite(rawY) || Math.abs(rawY) > 100) {
          if (started && collectPts && g._screenPts.length > 0 && g._screenPts[g._screenPts.length - 1] !== null) {
            g._screenPts.push(null);
          }
          started = false;
          prevRawY = null;
          prevMx = null;
          prevEvalX = null;
          prevFolds = null;
          continue;
        }

        const curFolds = isAbsActive ? getSignedFoldValues(evalX) : null;

        // [점근선 유령선(Ghost Line) 분리: tan(x), 1/x 등 인접 샘플 간 급격한 도약 및 부호 반전 시 단절]
        if (started && prevRawY !== null) {
          const dy = rawY - prevRawY;
          const isAsymptoteJump = (Math.abs(dy) > this.ySpan * 1.5) && (Math.sign(prevRawY) !== Math.sign(rawY));
          if (isAsymptoteJump) {
            ctx.stroke();
            ctx.beginPath();
            if (collectPts && g._screenPts.length > 0 && g._screenPts[g._screenPts.length - 1] !== null) {
              g._screenPts.push(null);
            }
            started = false;
          }
        }

        // 🌟 [절댓값 부호 교차(Zero-Crossing) & 첨점(Cusp) 0.000% 칼밀착 엔진]:
        // 부호 있는(Signed) 내부 함수값(prevFolds ↔ curFolds)의 부호 반전을 추적하여,
        // 확대·축소 중 샘플 그리드가 어떻게 이동하든 x축 꺾인 점(첨점)을 1e-9 정밀도로 정확히 찾아 박아줍니다!
        if (started && prevMx !== null && prevEvalX !== null) {
          const extraEvalPoints = [];

          // (A) 구간 내 고정 핸들(극점·꼭짓점) 삽입
          for (let pIdx = 0; pIdx < pinnedHandleXs.length; pIdx++) {
            const hx = pinnedHandleXs[pIdx];
            if (hx > prevMx && hx < mx) {
              extraEvalPoints.push(hx);
            }
          }

          // (B) 절댓값 꺾인 점(Zero-Crossing) 정밀 탐색 및 전후 서브샘플링
          if (isAbsActive && prevFolds && curFolds && prevFolds.length === curFolds.length) {
            const dxEval = evalX - prevEvalX;
            if (Math.abs(dxEval) > 1e-9 && Math.abs(dxEval) < 2.0) {
              for (let k = 0; k < curFolds.length; k++) {
                const f1 = prevFolds[k];
                const f2 = curFolds[k];
                if (isNaN(f1) || isNaN(f2)) continue;
                if ((f1 > 0 && f2 < 0) || (f1 < 0 && f2 > 0)) {
                  const rEval = bisectFoldRoot(prevEvalX, evalX, f1, f2, k);
                  const rMx = prevMx + (rEval - prevEvalX);
                  extraEvalPoints.push(rMx);
                } else if (Math.abs(f1) < 0.6 && Math.abs(f2) < 0.6) {
                  // 한 스텝 안에서 x축 아래로 아주 살짝 내려갔다 올라오는 미세 이중근 구간 검사
                  const midEval = 0.5 * (prevEvalX + evalX);
                  const midFolds = getSignedFoldValues(midEval);
                  const fMid = midFolds[k];
                  if (fMid !== undefined && !isNaN(fMid) && ((f1 > 0 && fMid < 0) || (f1 < 0 && fMid > 0))) {
                    const rEval1 = bisectFoldRoot(prevEvalX, midEval, f1, fMid, k);
                    const rEval2 = bisectFoldRoot(midEval, evalX, fMid, f2, k);
                    extraEvalPoints.push(prevMx + (rEval1 - prevEvalX));
                    extraEvalPoints.push(prevMx + (midEval - prevEvalX));
                    extraEvalPoints.push(prevMx + (rEval2 - prevEvalX));
                  }
                }
              }
            }
          }

          if (extraEvalPoints.length > 0) {
            extraEvalPoints.sort((a, b) => a - b);
            for (let eIdx = 0; eIdx < extraEvalPoints.length; eIdx++) {
              const subMx = extraEvalPoints[eIdx];
              if (subMx <= prevMx + 1e-9 || subMx >= mx - 1e-9) continue;
              if (eIdx > 0 && Math.abs(subMx - extraEvalPoints[eIdx - 1]) < 1e-7) continue;
              const subEvalX = prevEvalX + (subMx - prevMx);
              emitScreenPoint(subMx, subEvalX, yOffset);
            }
          }
        }

        const s = this.mathToScreen(mx, rawY);

        if (!started) {
          ctx.moveTo(s.x, s.y);
          started = true;
        } else {
          ctx.lineTo(s.x, s.y);
        }
        if (collectPts) {
          g._screenPts.push({ x: s.x, y: s.y });
        }

        prevRawY = rawY;
        prevMx = mx;
        prevEvalX = evalX;
        prevFolds = curFolds;
      }

      ctx.stroke();
    };

    if (!isPwActive) {
      // 일반 단일 패스 렌더링
      traceCurve(null);
    } else {
      // ✂️ 구간 분할 합성 2-패스 렌더링
      if (shouldShowGhost) {
        // 패스 1: 버려진 구간 (Ghost 점선) - [대표님 킬러 기획]: 선택된 함수만 원래 숨겨진 개형을 은은한 점선으로 표시!
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = Math.max(1.0, g.lineWidth * 0.85);
        traceCurve(false);
        ctx.restore();
      }

      // 패스 2: 채택된 구간 (Active 메인 실선)
      ctx.save();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
      traceCurve(true);
      ctx.restore();
    }

    ctx.restore();
  }

  // --- [유리함수 전용 상하단 무한대 관통 2-브랜치 고밀도 렌더러 (Piecewise 완벽 호환)] ---
  drawRationalCurve(ctx, g, gIdx = null, filterInside = null) {
    const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    const x0 = g.handles[0].x + ox;
    const y0 = g.handles[0].y;
    const k = (g.handles[1].x - g.handles[0].x) * (g.handles[1].y - g.handles[0].y);

    const mLeft = this.screenToMath(0, 0).x;
    const mRight = this.screenToMath(this.screenWidth, 0).x;

    // 캔버스 화면 상하단 밖 60px로 안전 클램핑 (화면 끝까지 100% 관통!)
    const clampScreenY = (sy) => Math.max(-60, Math.min(this.screenHeight + 60, sy));

    // 브랜치 1: x < x0 (좌측 가지)
    if (mLeft < x0) {
      const endX = Math.min(x0 - 1e-4, mRight);
      const startX = mLeft;
      const steps = 400;

      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= steps; i++) {
        // 점근선 근처에서는 비선형 분포로 초고밀도 샘플링!
        const t = i / steps;
        const x = startX + (endX - startX) * Math.pow(t, 0.75);

        // Piecewise 구간 필터 적용
        if (filterInside !== null && gIdx !== null) {
          const inPiece = this.isInsidePiece(gIdx, x);
          if (inPiece !== filterInside) {
            started = false;
            continue;
          }
        }

        let y = y0 + k / (x - x0);
        if (g.isAbsolute) y = Math.abs(y);
        y += oy;

        const s = this.mathToScreen(x, y);
        const sy = clampScreenY(s.y);

        if (!started) {
          ctx.moveTo(s.x, sy);
          started = true;
        } else {
          ctx.lineTo(s.x, sy);
        }
      }
      ctx.stroke();
    }

    // 브랜치 2: x > x0 (우측 가지)
    if (mRight > x0) {
      const startX = Math.max(x0 + 1e-4, mLeft);
      const endX = mRight;
      const steps = 400;

      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= steps; i++) {
        // 점근선에서 멀어지는 방향으로 비선형 분포 샘플링!
        const t = i / steps;
        const x = startX + (endX - startX) * (1 - Math.pow(1 - t, 0.75));

        // Piecewise 구간 필터 적용
        if (filterInside !== null && gIdx !== null) {
          const inPiece = this.isInsidePiece(gIdx, x);
          if (inPiece !== filterInside) {
            started = false;
            continue;
          }
        }

        let y = y0 + k / (x - x0);
        if (g.isAbsolute) y = Math.abs(y);
        y += oy;

        const s = this.mathToScreen(x, y);
        const sy = clampScreenY(s.y);

        if (!started) {
          ctx.moveTo(s.x, sy);
          started = true;
        } else {
          ctx.lineTo(s.x, sy);
        }
      }
      ctx.stroke();
    }
  }

  // --- [로그함수 전용 상하단 무한대 관통 고밀도 렌더러 (Piecewise 완벽 호환)] ---
  drawLogCurve(ctx, g, gIdx = null, filterInside = null) {
    const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    const x0 = g.handles[0].x + ox;
    const y0 = g.handles[0].y;
    const x1 = g.handles[1].x + ox;
    const y1 = g.handles[1].y;
    const dx = x1 - x0;
    const dy = y1 - y0;

    const mLeft = this.screenToMath(0, 0).x;
    const mRight = this.screenToMath(this.screenWidth, 0).x;
    const clampScreenY = (sy) => Math.max(-60, Math.min(this.screenHeight + 60, sy));
    const steps = 400;

    if (dx > 0) {
      // 정의역: x > x0
      if (mRight <= x0) return;
      const startX = Math.max(x0 + 1e-4, mLeft);
      const endX = mRight;
      if (startX >= endX) return;

      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = startX + (endX - startX) * (1 - Math.pow(1 - t, 0.75));

        if (filterInside !== null && gIdx !== null) {
          const inPiece = this.isInsidePiece(gIdx, x);
          if (inPiece !== filterInside) {
            started = false;
            continue;
          }
        }

        const u = Math.max(1e-6, (x - x0) / dx);
        let y = y1 + dy * Math.log2(u);
        if (g.isAbsolute) y = Math.abs(y);
        y += oy;

        const s = this.mathToScreen(x, y);
        const sy = clampScreenY(s.y);
        if (!started) { ctx.moveTo(s.x, sy); started = true; }
        else ctx.lineTo(s.x, sy);
      }
      ctx.stroke();
    } else {
      // 정의역: x < x0
      if (mLeft >= x0) return;
      const startX = mLeft;
      const endX = Math.min(x0 - 1e-4, mRight);
      if (startX >= endX) return;

      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = startX + (endX - startX) * Math.pow(t, 0.75);

        if (filterInside !== null && gIdx !== null) {
          const inPiece = this.isInsidePiece(gIdx, x);
          if (inPiece !== filterInside) {
            started = false;
            continue;
          }
        }

        const u = Math.max(1e-6, (x0 - x) / -dx);
        let y = y1 + dy * Math.log2(u);
        if (g.isAbsolute) y = Math.abs(y);
        y += oy;

        const s = this.mathToScreen(x, y);
        const sy = clampScreenY(s.y);
        if (!started) { ctx.moveTo(s.x, sy); started = true; }
        else ctx.lineTo(s.x, sy);
      }
      ctx.stroke();
    }
  }

  // --- [탄젠트함수 전용 주기별 상하단 무한대 관통 고밀도 렌더러 (Piecewise 완벽 호환)] ---
  drawTangentCurve(ctx, g, gIdx = null, filterInside = null) {
    const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    const x0 = g.handles[0].x + ox;
    const y0 = g.handles[0].y;
    let dx = g.handles.length >= 2 ? (g.handles[1].x + ox) - x0 : 0.785;
    if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
    const A = g.handles.length >= 2 ? g.handles[1].y - y0 : 1.5;
    const omega = Math.PI / (4.0 * Math.abs(dx));
    const period = Math.PI / omega;
    const halfPeriod = period / 2.0;

    const mLeft = this.screenToMath(0, 0).x;
    const mRight = this.screenToMath(this.screenWidth, 0).x;
    const clampScreenY = (sy) => Math.max(-60, Math.min(this.screenHeight + 60, sy));

    const kMin = Math.floor((mLeft - x0 - halfPeriod) / period) - 1;
    const kMax = Math.ceil((mRight - x0 - halfPeriod) / period) + 1;
    const stepsPerBranch = 300;

    for (let k = kMin; k <= kMax; k++) {
      const asyLeft = x0 + halfPeriod + k * period;
      const asyRight = asyLeft + period;

      const bStart = Math.max(mLeft, asyLeft + 1e-4);
      const bEnd = Math.min(mRight, asyRight - 1e-4);
      if (bStart >= bEnd) continue;

      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= stepsPerBranch; i++) {
        const t = i / stepsPerBranch;
        const x = bStart + (bEnd - bStart) * t;

        if (filterInside !== null && gIdx !== null) {
          const inPiece = this.isInsidePiece(gIdx, x);
          if (inPiece !== filterInside) {
            started = false;
            continue;
          }
        }

        const cosVal = Math.cos(omega * (x - x0));
        if (Math.abs(cosVal) < 1e-4) continue;
        let y = y0 + A * Math.tan(omega * (x - x0));
        if (g.isAbsolute) y = Math.abs(y);
        y += oy;

        const s = this.mathToScreen(x, y);
        const sy = clampScreenY(s.y);

        if (!started) { ctx.moveTo(s.x, sy); started = true; }
        else ctx.lineTo(s.x, sy);
      }
      ctx.stroke();
    }
  }

  // --- [무리함수 전용 시작점 칼고정 & 들쭉날쭉 잘림 0% 고정밀 렌더러 (Piecewise 완벽 호환)] ---
  drawSqrtCurve(ctx, g, gIdx = null, filterInside = null) {
    const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    const x0 = g.handles[0].x + ox;
    const y0 = g.handles[0].y;
    const x1 = g.handles[1].x + ox;
    const y1 = g.handles[1].y;
    let dx = x1 - x0;
    if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
    const dy = y1 - y0;

    const mLeft = this.screenToMath(0, 0).x;
    const mRight = this.screenToMath(this.screenWidth, 0).x;
    const clampScreenY = (sy) => Math.max(-60, Math.min(this.screenHeight + 60, sy));
    const steps = 350;

    ctx.beginPath();
    let started = false;

    if (dx > 0) {
      // 1. 우측으로 뻗는 경우 (x >= x0)
      if (mRight < x0) return;
      const startX = Math.max(x0, mLeft);
      const endX = mRight;
      if (startX > endX) return;

      const isStartOnScreen = (x0 >= mLeft);

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let x;
        if (isStartOnScreen) {
          x = x0 + (endX - x0) * Math.pow(t, 1.8);
        } else {
          x = startX + (endX - startX) * t;
        }

        if (filterInside !== null && gIdx !== null) {
          const inPiece = this.isInsidePiece(gIdx, x);
          if (inPiece !== filterInside) {
            started = false;
            continue;
          }
        }

        let y = y0 + dy * Math.sqrt((x - x0) / dx);
        if (g.isAbsolute) y = Math.abs(y);
        y += oy;

        const s = this.mathToScreen(x, y);
        const sy = clampScreenY(s.y);

        if (!started) {
          ctx.moveTo(s.x, sy);
          started = true;
        } else {
          ctx.lineTo(s.x, sy);
        }
      }
      ctx.stroke();
    } else {
      // 2. 좌측으로 뻗는 경우 (x <= x0)
      if (mLeft > x0) return;
      const startX = mLeft;
      const endX = Math.min(x0, mRight);
      if (startX > endX) return;

      const isStartOnScreen = (x0 <= mRight);

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let x;
        if (isStartOnScreen) {
          x = startX + (x0 - startX) * (1 - Math.pow(1 - t, 1.8));
        } else {
          x = startX + (endX - startX) * t;
        }

        if (filterInside !== null && gIdx !== null) {
          const inPiece = this.isInsidePiece(gIdx, x);
          if (inPiece !== filterInside) {
            started = false;
            continue;
          }
        }

        let y = y0 + dy * Math.sqrt((x0 - x) / -dx);
        if (g.isAbsolute) y = Math.abs(y);
        y += oy;

        const s = this.mathToScreen(x, y);
        const sy = clampScreenY(s.y);

        if (!started) {
          ctx.moveTo(s.x, sy);
          started = true;
        } else {
          ctx.lineTo(s.x, sy);
        }
      }
      ctx.stroke();
    }
  }

  // --- [인터랙티브 조작 핸들 (오직 그래프가 선택되었을 때만 정갈하게 표시)] ---
  drawHandles(ctx) {
    if (this.isCleanView) return;
    // [대표님 기획]: 그래프가 명시적으로 선택되었거나(isCurveSelected) 핸들 조작 중일 때만 핸들 노출!
    if (!this.isCurveSelected && this.selectedHandleIdx === null && this.draggedHandleIdx === null) {
      return;
    }
    const g = this.activeGraph;
    if (!g || !g.handles) return;
    // 🔒 [구간 분할 잠금 상태에서도 핸들러는 그대로 표시하여 개별 함수 모양(극점·기울기) 조절 허용!]

    let ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    let oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    if (g.transforms && g.transforms.length > 0) {
      for (const t of g.transforms) {
        if (t.offset && typeof t.offset.x === 'number') ox += t.offset.x;
        if (t.offset && typeof t.offset.y === 'number') oy += t.offset.y;
      }
    }

    g.handles.forEach((h, idx) => {
      if (h.hidden) return; // 숨겨진 핸들은 노출하지 않음

      let targetY = h.y;
      if (g.isAbsolute && ["max", "min", "point", "vertex", "inflection"].includes(h.type)) {
        targetY = Math.abs(h.y);
      }
      let evalY = (h.type === 'center' || h.type === 'asymptote')
        ? (targetY + oy)
        : this.engine.evaluatePipeline(g, h.x + ox);
      if (isNaN(evalY) || !isFinite(evalY)) {
        evalY = targetY + oy;
      }

      const s = this.mathToScreen(h.x + ox, evalY);
      const isDragging = this.draggedHandleIdx === idx;
      const isPip = Boolean(this._isRenderingGraphSnapshot);
      const radius = isPip ? (isDragging ? 5.6 : 4.4) : (isDragging ? 8.5 : 6.5);

      // 선택된 점 깜빡임 펄스 링 (키보드 방향키 미세조정 상태)
      if (this.selectedHandleIdx === idx) {
        const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius + (isPip ? 3.5 : 5) + pulse * (isPip ? 4 : 6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(254, 202, 87, ${0.2 + pulse * 0.4})`;
        ctx.strokeStyle = '#feca57';
        ctx.lineWidth = isPip ? 1.5 : 2.0;
        ctx.fill();
        ctx.stroke();
      }

      // 🌟 [핸들 테마 연동: 라이트 모드 3D 엠보싱 링 & 다크 모드 네온 아우라] 🌟
      const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.white_paper;
      const isLight = curTheme.isLight || this.isMonochromeMode;

      ctx.save();

      const isTranslationAnchor = (h.type === 'center' || h.type === 'inflection' || h.type === 'vertex' || h.type === 'asymptote');
      let fillColor;
      if (isLight) {
        // [라이트 테마]: 고대비 3D 엠보싱 색상 (극대=딥레드, 극소=로열블루, 기준점/변곡/중심/꼭짓점=황금앰버)
        fillColor = isTranslationAnchor
          ? '#d97706'
          : (h.type === 'max'
            ? '#dc2626'
            : (h.type === 'min'
              ? '#2563eb'
              : '#ffffff'));
      } else {
        // [다크 테마]: 발광 네온 색상
        fillColor = isTranslationAnchor
          ? '#feca57'
          : (h.type === 'max'
            ? '#ff6b6b'
            : (h.type === 'min'
              ? '#54a0ff'
              : '#ffffff'));
      }

      if (isLight) {
        // 🌟 [라이트 모드 3D 엠보싱 렌더링]:
        // (1) 부드러운 드롭 섀도우 (종이 위에 볼록 솟아오른 물리적 핀 효과)
        ctx.shadowColor = 'rgba(15, 23, 42, 0.24)';
        ctx.shadowBlur = isPip ? (isDragging ? 5 : 3) : (isDragging ? 8 : 4.5);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = isPip ? (isDragging ? 2 : 1) : (isDragging ? 3 : 1.5);

        // (2) 외부 베이스 원 채우기
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();

        // (3) 순백색 내부 림 (또렷한 3D 입체감 부여)
        ctx.shadowColor = 'transparent';
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isPip ? (isDragging ? 2.1 : 1.7) : (isDragging ? 3.0 : 2.4);
        ctx.stroke();

        // (4) 외곽 윤곽선 (흰 종이 위에서도 핸들의 경계가 칼같이 선명하도록 보정)
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius + (isPip ? 0.9 : 1.2), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.42)';
        ctx.lineWidth = isPip ? 0.85 : 1.0;
        ctx.stroke();

        // (5) 호버 또는 드래그 시 반응형 외곽 후광 (Aura Ring)
        if (isDragging) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius + (isPip ? 4.2 : 6), 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
          ctx.lineWidth = isPip ? 1.2 : 1.5;
          ctx.stroke();
        }
      } else {
        // 🌟 [다크 모드 네온 렌더링]:
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius + (isPip ? (isDragging ? 4.2 : 2.8) : (isDragging ? 6 : 4)), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 210, 211, 0.22)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = isPip ? 1.8 : 2.5;
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // 3. 🌟 [대표님 특화: 극점 드래그 시 실시간 좌표 & 특이점 명칭 팝업 배지] 🌟
      if (isDragging) {
        const hName = (h.type === 'max')
          ? '극대'
          : ((h.type === 'min')
            ? '극소'
            : ((h.type === 'inflection')
              ? '변곡점'
              : ((h.type === 'center' || h.type === 'asymptote')
                ? (h.name || '대칭중심')
                : (h.type === 'vertex' ? (h.name || '꼭짓점') : '점'))));
        const coordText = `${hName} (${(h.x + ox).toFixed(2)}, ${evalY.toFixed(2)})`;
        const tipY = s.y - radius - (isPip ? 12 : 16);
        this.drawPillBadge(ctx, coordText, s.x, tipY, {
          font: isPip ? 'bold 9.5px system-ui, -apple-system, sans-serif' : 'bold 11px system-ui, -apple-system, sans-serif',
          height: isPip ? 18 : 22,
          padX: isPip ? 6.5 : 9,
          bg: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 23, 42, 0.94)',
          border: isLight ? 'rgba(37, 99, 235, 0.55)' : 'rgba(0, 210, 211, 0.7)',
          color: isLight ? '#1e293b' : '#ffffff',
          shadow: true
        });
      }
    });

    // [대표님 기획]: 사차함수 극소 높이 일치 시 수평 점선 가이드는 화면 간섭 및 오작동 방지를 위해 생략, 자석 스냅 손맛(철컥)만 유지
  }

  startPulseLoop() {
    if (this.pulseAnimId) return;
    const loop = () => {
      if (this.selectedHandleIdx !== null) {
        this.render();
        this.pulseAnimId = requestAnimationFrame(loop);
      } else {
        this.pulseAnimId = null;
        this.render();
      }
    };
    this.pulseAnimId = requestAnimationFrame(loop);
  }

  // --- [PNG 바이너리에 300/600 DPI (pHYs 청크) 주입 엔진] ---
  injectDpiToBlob(blob, dpi = this.exportDPI) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result;
        const bytes = new Uint8Array(buffer);

        // PNG 시그니처 확인 (8바이트: 89 50 4E 47 0D 0A 1A 0A)
        if (bytes.length < 33 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
          resolve(blob);
          return;
        }

        // 1 meter = 39.3701 inches -> pixels per meter (ppm)
        const ppm = Math.round(dpi / 0.0254);

        // pHYs 청크 데이터 (4바이트 type 'pHYs' + 9바이트 data)
        const physData = new Uint8Array(13);
        physData[0] = 0x70; physData[1] = 0x48; physData[2] = 0x59; physData[3] = 0x73; // 'pHYs'
        // ppmX (Big-endian)
        physData[4] = (ppm >>> 24) & 0xff;
        physData[5] = (ppm >>> 16) & 0xff;
        physData[6] = (ppm >>> 8) & 0xff;
        physData[7] = ppm & 0xff;
        // ppmY (Big-endian)
        physData[8] = (ppm >>> 24) & 0xff;
        physData[9] = (ppm >>> 16) & 0xff;
        physData[10] = (ppm >>> 8) & 0xff;
        physData[11] = ppm & 0xff;
        physData[12] = 1; // 1 = meter

        // CRC32 연산
        const crcTable = [];
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
          }
          crcTable[n] = c;
        }
        let crc = 0xffffffff;
        for (let i = 0; i < physData.length; i++) {
          crc = crcTable[(crc ^ physData[i]) & 0xff] ^ (crc >>> 8);
        }
        crc = (crc ^ 0xffffffff) >>> 0;

        // 전체 pHYs 청크 생성 (4 length + 13 data + 4 crc = 21바이트)
        const physChunk = new Uint8Array(21);
        physChunk[0] = 0; physChunk[1] = 0; physChunk[2] = 0; physChunk[3] = 9;
        physChunk.set(physData, 4);
        physChunk[17] = (crc >>> 24) & 0xff;
        physChunk[18] = (crc >>> 16) & 0xff;
        physChunk[19] = (crc >>> 8) & 0xff;
        physChunk[20] = crc & 0xff;

        // IHDR 청크 바로 뒤(33바이트 지점)에 pHYs 청크 삽입
        const insertPos = 33;
        const newBytes = new Uint8Array(bytes.length + physChunk.length);
        newBytes.set(bytes.subarray(0, insertPos), 0);
        newBytes.set(physChunk, insertPos);
        newBytes.set(bytes.subarray(insertPos), insertPos + physChunk.length);

        resolve(new Blob([newBytes], { type: 'image/png' }));
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  // --- [내보내기/복사 시 화면에 떠 있는 문제 카드 & 그래프 보관 카드 합성 엔진 (요소 필터 완벽 연동)] ---
  drawFloatingCardsForExport(ctx, filterOpts = null) {
    if (!ctx || typeof document === 'undefined') return;
    const effFilter = filterOpts || this._activeExportFilter || { includeProblem: true, includeGraph: true, includeInk: true };
    const incProb = effFilter.includeProblem !== false;
    const incGraph = effFilter.includeGraph !== false;
    const incInk = effFilter.includeInk !== false;

    const canvasRect = this.canvas ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const selectors = [];
    if (incProb) {
      selectors.push('#problemCardWidget', '.extra-problem-card-widget');
    }
    if (incGraph) {
      selectors.push('#graphCardWidget', '.extra-graph-card-widget');
    }
    if (selectors.length === 0) return;

    const cardEls = Array.from(document.querySelectorAll(selectors.join(', '))).filter(el => {
      if (!el || el.style.display === 'none') return false;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    if (cardEls.length === 0) return;

    cardEls.sort((a, b) => {
      const zA = parseInt(a.style.zIndex || window.getComputedStyle(a).zIndex, 10) || 150;
      const zB = parseInt(b.style.zIndex || window.getComputedStyle(b).zIndex, 10) || 150;
      return zA - zB;
    });

    const isLight = document.body.classList.contains('theme-light') || this.isMonochromeMode;

    cardEls.forEach(el => {
      const isMin = el.classList.contains('minimized');
      const titleEl = el.querySelector('.card-title-text');
      const titleText = titleEl ? titleEl.textContent.trim() : '';
      const headerEl = el.querySelector('.problem-card-header');
      const bodyEl = el.querySelector('.problem-card-body');
      const imgEl = el.querySelector('.problem-card-img');

      const offX = (this._exportCropOffset && this._exportCropOffset.x) || 0;
      const offY = (this._exportCropOffset && this._exportCropOffset.y) || 0;

      if (isMin && headerEl) {
        const hRect = headerEl.getBoundingClientRect();
        if (hRect.width > 0 && hRect.height > 0) {
          const hx = hRect.left - canvasRect.left - offX;
          const hy = hRect.top - canvasRect.top - offY;
          const hw = hRect.width;
          const hh = hRect.height;

          ctx.save();
          ctx.fillStyle = isLight ? '#f8fafc' : '#0f172a';
          ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(hx, hy, hw, hh, 8);
          else ctx.rect(hx, hy, hw, hh);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isLight ? '#1e293b' : '#f1f5f9';
          ctx.font = '700 12px "Pretendard", -apple-system, sans-serif';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText('▸ ' + titleText, hx + 10, hy + hh / 2);
          ctx.restore();
        }
      }

      const isGraphCard = Boolean(
        el.id === 'graphCardWidget' ||
        el.classList.contains('extra-graph-card-widget') ||
        el.classList.contains('graph-card-widget')
      );
      const liveGraphCvs = (isGraphCard && bodyEl)
        ? bodyEl.querySelector('.pip-graph-live-canvas')
        : null;
      const hasValidLiveGraphCvs = Boolean(liveGraphCvs && liveGraphCvs.width > 0 && liveGraphCvs.height > 0);
      const hasValidImg = Boolean(imgEl && imgEl.complete && imgEl.naturalWidth > 0);

      if (!isMin && bodyEl && (hasValidLiveGraphCvs || hasValidImg)) {
        const bRect = bodyEl.getBoundingClientRect();
        if (bRect.width > 0 && bRect.height > 0) {
          const bx = bRect.left - canvasRect.left - offX;
          const by = bRect.top - canvasRect.top - offY;
          const bw = bRect.width;
          const natAspect = hasValidLiveGraphCvs
            ? (bRect.height / bRect.width)
            : ((imgEl.naturalHeight > 0 && imgEl.naturalWidth > 0)
              ? (imgEl.naturalHeight / imgEl.naturalWidth)
              : (bRect.height / bRect.width));
          const bh = Math.max(1, Math.round(bw * natAspect));

          ctx.save();
          ctx.fillStyle = isGraphCard ? (isLight ? '#ffffff' : '#13151a') : '#ffffff';
          ctx.strokeStyle = isLight ? '#cbd5e1' : '#475569';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, isGraphCard ? 0 : 8);
          else ctx.rect(bx, by, bw, bh);
          if (!isGraphCard) {
            ctx.fill();
          }

          ctx.save();
          ctx.clip();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          const hiResSource = hasValidLiveGraphCvs
            ? liveGraphCvs
            : ((
              el.id === 'problemCardWidget' &&
              this.problemCardImage &&
              typeof HTMLCanvasElement !== 'undefined' &&
              this.problemCardImage instanceof HTMLCanvasElement &&
              this.problemCardImage.width > 0 &&
              this.problemCardImage.height > 0
            ) ? this.problemCardImage : (
              el.classList.contains('extra-problem-card-widget') &&
              Array.isArray(this.extraProblemCards)
                ? (() => {
                  const found = this.extraProblemCards.find(c => c && c.el === el && c.sourceCanvas && c.sourceCanvas.width > 0);
                  return (found && found.sourceCanvas) ? found.sourceCanvas : imgEl;
                })()
                : imgEl
            ));
          ctx.drawImage(hiResSource, bx, by, bw, bh);
          if (incInk) {
            const cardStrokes = (el.id === 'problemCardWidget')
              ? (this.problemInkStrokes || [])
              : (el.id === 'graphCardWidget'
                ? (this.graphInkStrokes || [])
                : (el._cardInkStrokes || []));
            if (Array.isArray(cardStrokes) && cardStrokes.length > 0) {
              const isProbCard = (el.id === 'problemCardWidget' || el.classList.contains('extra-problem-card-widget'));
              let sizeScale;
              if (isProbCard) {
                const refW = (el.id === 'problemCardWidget') ? 520 : 480;
                sizeScale = Math.max(0.6, bw / refW);
              } else {
                const exportCardRef = (el.id === 'graphCardWidget')
                  ? 'primary'
                  : (Array.isArray(this.extraGraphCards) ? this.extraGraphCards.find(c => c && c.el === el) : null);
                sizeScale = typeof this.getPipCardFinePenScale === 'function'
                  ? this.getPipCardFinePenScale(exportCardRef, bw, bh)
                  : 0.54;
              }
              cardStrokes.forEach(st => {
                if (!st || !st.points || st.points.length === 0) return;
                ctx.save();
                let col = st.color || '#1e293b';
                if (this.isMonochromeMode) {
                  col = st.isHighlighter ? '#cbd5e1' : '#000000';
                } else if (st.isHighlighter) {
                  col = this.resolveHighlighterStrokeColor(col, true);
                } else if (isProbCard && (col.toLowerCase() === '#ffffff' || col.toLowerCase() === '#fff')) {
                  col = '#0f172a';
                }
                ctx.strokeStyle = col;
                ctx.fillStyle = col;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                const baseSize = (st.size || 3.5) * sizeScale;
                const ghostMul = (typeof st._ghostAlpha === 'number') ? st._ghostAlpha : 1.0;
                ctx.globalAlpha = (st.isHighlighter ? 0.36 : 1.0) * ghostMul;
                const hlW = st.highlighterSize ? (st.highlighterSize * sizeScale) : Math.max(8, baseSize * 2.8);
                ctx.lineWidth = st.isHighlighter ? Math.max(3, hlW) : Math.max(isProbCard ? 1.5 : 0.85, baseSize);
                if (st.isShape && st.cardShape && this.drawCardRecognizedShape(ctx, st, bx, by, bw, bh, baseSize)) {
                  ctx.restore();
                  return;
                }
                const rawPts = st.points.map(pt => ({
                  x: bx + pt.nx * bw,
                  y: by + pt.ny * bh,
                  p: pt.p !== undefined ? pt.p : 0.5
                }));
                const pts = st.isShape ? rawPts : [rawPts[0]];
                if (!st.isShape && rawPts.length > 1) {
                  for (let i = 1; i < rawPts.length - 1; i++) {
                    const prev = pts[pts.length - 1];
                    const curr = rawPts[i];
                    pts.push({
                      x: prev.x * 0.28 + curr.x * 0.72,
                      y: prev.y * 0.28 + curr.y * 0.72,
                      p: prev.p * 0.28 + curr.p * 0.72
                    });
                  }
                  pts.push(rawPts[rawPts.length - 1]);
                }
                const penStyle = st.isHighlighter ? 'ballpen' : (st.penStyle || 'ballpen');
                this.drawPenStyledPointArray(ctx, pts, st.isHighlighter ? ctx.lineWidth : baseSize, penStyle, st.softBlur, Boolean(st.isHighlighter));
                ctx.restore();
              });
            }
          }
          if (!this._omitStickersForViewerSnapshot) {
            const cardStickers = this.getCardStickersArray(el);
            if (Array.isArray(cardStickers) && cardStickers.length > 0) {
              cardStickers.forEach(stk => {
                if (!stk || stk.revealed) return;
                const sx = bx + stk.nx * bw;
                const sy = by + stk.ny * bh;
                const sw = stk.nw * bw;
                const sh = stk.nh * bh;
                if (sw < 4 || sh < 4) return;
                ctx.save();
                const grad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
                grad.addColorStop(0, '#fef08a');
                grad.addColorStop(0.68, '#fde047');
                grad.addColorStop(1, '#facc15');
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(sx, sy, sw, sh, 6);
                else ctx.rect(sx, sy, sw, sh);
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.lineWidth = 1.4;
                ctx.strokeStyle = '#eab308';
                ctx.stroke();
                ctx.restore();
              });
            }
          }
          ctx.restore();

          if (!isGraphCard) {
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    });
  }

  // --- [📈 스캔된 직사각형 이미지 내부의 개별 그래프(#1, #2...) 터치 핫스팟 좌표 추출] ---
  extractGraphHotspotsForBounds(smartBounds = null, filterOpts = null) {
    const effFilter = filterOpts || this._activeExportFilter || { includeProblem: true, includeGraph: true, includeInk: true };
    if (effFilter.includeGraph === false) return [];

    const cropX = smartBounds ? smartBounds.x : 0;
    const cropY = smartBounds ? smartBounds.y : 0;
    const cropW = Math.max(1, smartBounds ? smartBounds.width : (this.screenWidth || window.innerWidth));
    const cropH = Math.max(1, smartBounds ? smartBounds.height : (this.screenHeight || window.innerHeight));
    const canvasRect = this.canvas ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 };

    const hotspots = [];

    // 1. 판서 모드에 떠 있는 기본 그래프 보관 카드
    const gWidget = document.getElementById('graphCardWidget');
    if (gWidget && gWidget.style.display !== 'none' && !gWidget.classList.contains('minimized')) {
      const bodyEl = gWidget.querySelector('.problem-card-body');
      const livePrimarySnap = typeof this._getMutablePipCardSnapshot === 'function'
        ? this._getMutablePipCardSnapshot('primary')
        : null;
      if (livePrimarySnap) {
        if (bodyEl) {
          const cw = Math.max(160, Math.round(parseFloat(gWidget.style.width) || bodyEl.clientWidth || 430));
          const ch = Math.max(120, Math.round(parseFloat(bodyEl.style.height) || bodyEl.clientHeight || (cw * (this.graphCardAspect || 0.82))));
          livePrimarySnap._isPipCardSnapshot = true;
          livePrimarySnap._pipCardW = cw;
          livePrimarySnap._pipCardH = ch;
        }
        if (typeof this._buildFullGraphInkStrokesFromPipCard === 'function') {
          livePrimarySnap.graphInkStrokes = (effFilter.includeInk === false)
            ? []
            : this._compactStrokesArray(this._buildFullGraphInkStrokesFromPipCard('primary'));
        }
        this._savePipCardSnapshot('primary', livePrimarySnap);
      }
      const snap = this.primaryGraphCardSnapshot || (this.graphCardData && this.graphCardData.graphSnapshot) || (this._coveredGraphStateBackup ? JSON.stringify(this._coveredGraphStateBackup) : null);
      if (bodyEl && snap) {
        const bRect = bodyEl.getBoundingClientRect();
        if (bRect.width > 0 && bRect.height > 0) {
          const left = bRect.left - canvasRect.left;
          const top = bRect.top - canvasRect.top;
          const right = bRect.right - canvasRect.left;
          const bottom = bRect.bottom - canvasRect.top;
          hotspots.push({
            id: 'graph_card_1',
            caseIdx: 1,
            label: '',
            nx: Math.max(0, Math.min(0.95, (left - cropX) / cropW)),
            ny: Math.max(0, Math.min(0.95, (top - cropY) / cropH)),
            nw: Math.max(0.05, Math.min(1.0, (right - left) / cropW)),
            nh: Math.max(0.05, Math.min(1.0, (bottom - top) / cropH)),
            graphSnapshot: typeof snap === 'string' ? snap : JSON.stringify(snap)
          });
        }
      }
    }

    // 2. 판서 모드에 떠 있는 추가 그래프 보관 카드
    if (Array.isArray(this.extraGraphCards) && this.extraGraphCards.length > 0) {
      this.extraGraphCards.forEach((c, idx) => {
        if (!c || !c.el || c.el.style.display === 'none' || c.isMin || c.el.classList.contains('minimized')) return;
        const bodyEl = c.el.querySelector('.problem-card-body');
        const liveExtraSnap = typeof this._getMutablePipCardSnapshot === 'function'
          ? this._getMutablePipCardSnapshot(c)
          : null;
        if (liveExtraSnap) {
          if (bodyEl) {
            const cw = Math.max(160, Math.round(parseFloat(c.el.style.width) || bodyEl.clientWidth || 430));
            const ch = Math.max(120, Math.round(parseFloat(bodyEl.style.height) || bodyEl.clientHeight || (cw * (c.aspect || 0.82))));
            liveExtraSnap._isPipCardSnapshot = true;
            liveExtraSnap._pipCardW = cw;
            liveExtraSnap._pipCardH = ch;
          }
          if (typeof this._buildFullGraphInkStrokesFromPipCard === 'function') {
            liveExtraSnap.graphInkStrokes = (effFilter.includeInk === false)
              ? []
              : this._compactStrokesArray(this._buildFullGraphInkStrokesFromPipCard(c));
          }
          this._savePipCardSnapshot(c, liveExtraSnap);
        }
        const snap = c.graphSnapshot;
        if (bodyEl && snap) {
          const bRect = bodyEl.getBoundingClientRect();
          if (bRect.width > 0 && bRect.height > 0) {
            const left = bRect.left - canvasRect.left;
            const top = bRect.top - canvasRect.top;
            const right = bRect.right - canvasRect.left;
            const bottom = bRect.bottom - canvasRect.top;
            hotspots.push({
              id: `graph_card_${c.caseIdx || idx + 2}`,
              caseIdx: c.caseIdx || idx + 2,
              label: '',
              nx: Math.max(0, Math.min(0.95, (left - cropX) / cropW)),
              ny: Math.max(0, Math.min(0.95, (top - cropY) / cropH)),
              nw: Math.max(0.05, Math.min(1.0, (right - left) / cropW)),
              nh: Math.max(0.05, Math.min(1.0, (bottom - top) / cropH)),
              graphSnapshot: typeof snap === 'string' ? snap : JSON.stringify(snap)
            });
          }
        }
      });
    }

    // 3. 실시간 그래프 모드(!isGraphCovered)에서 공유한 경우 전체 그래프 영역을 #1 핫스팟으로 등록
    if (hotspots.length === 0 && !this.isGraphCovered && this.graphs && this.graphs.length > 0) {
      hotspots.push({
        id: 'graph_live_1',
        caseIdx: 1,
        label: '#1',
        nx: 0.04,
        ny: 0.04,
        nw: 0.92,
        nh: 0.92,
        graphSnapshot: this.getPureGraphSnapshot()
      });
    }

    return hotspots;
  }

  // --- [🟨 스캔된 직사각형 이미지 내부의 가림막 스티커(칠판 + 문제/그래프 카드) 터치 핫스팟 추출] ---
  extractStickerHotspotsForBounds(smartBounds = null, filterOpts = null) {
    const effFilter = filterOpts || this._activeExportFilter || { includeProblem: true, includeGraph: true, includeInk: true };
    const incProb = effFilter.includeProblem !== false;
    const incGraph = effFilter.includeGraph !== false;

    const cropX = smartBounds ? smartBounds.x : 0;
    const cropY = smartBounds ? smartBounds.y : 0;
    const cropW = Math.max(1, smartBounds ? smartBounds.width : (this.screenWidth || window.innerWidth));
    const cropH = Math.max(1, smartBounds ? smartBounds.height : (this.screenHeight || window.innerHeight));
    const canvasRect = this.canvas ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 };

    const stickerHotspots = [];

    // 1. 칠판/그래프 캔버스 위 스티커
    if (Array.isArray(this.boardStickers) && this.boardStickers.length > 0) {
      this.boardStickers.forEach((stk) => {
        const r = this.getBoardStickerScreenRect(stk);
        if (!r || r.w < 4 || r.h < 4) return;
        stickerHotspots.push({
          id: stk.id,
          nx: Math.max(0, Math.min(0.99, (r.x - cropX) / cropW)),
          ny: Math.max(0, Math.min(0.99, (r.y - cropY) / cropH)),
          nw: Math.max(0.01, Math.min(1.0, r.w / cropW)),
          nh: Math.max(0.01, Math.min(1.0, r.h / cropH)),
          revealed: Boolean(stk.revealed),
          color: stk.color || '#facc15'
        });
      });
    }

    // 2. 문제 카드 및 그래프 보관 카드 위 스티커
    const selectors = [];
    if (incProb) selectors.push('#problemCardWidget', '.extra-problem-card-widget');
    if (incGraph && this.isGraphCovered) selectors.push('#graphCardWidget', '.extra-graph-card-widget');
    if (typeof document !== 'undefined' && selectors.length > 0) {
      const cardEls = Array.from(document.querySelectorAll(selectors.join(', '))).filter(el => {
        if (!el || el.style.display === 'none' || el.classList.contains('minimized')) return false;
        const cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      cardEls.forEach((el) => {
        const bodyEl = el.querySelector('.problem-card-body');
        if (!bodyEl) return;
        const bRect = bodyEl.getBoundingClientRect();
        if (bRect.width <= 0 || bRect.height <= 0) return;
        const arr = this.getCardStickersArray(el);
        if (!Array.isArray(arr) || arr.length === 0) return;
        const bx = bRect.left - canvasRect.left;
        const by = bRect.top - canvasRect.top;
        arr.forEach((stk) => {
          if (!stk) return;
          const sx = bx + stk.nx * bRect.width;
          const sy = by + stk.ny * bRect.height;
          const sw = stk.nw * bRect.width;
          const sh = stk.nh * bRect.height;
          stickerHotspots.push({
            id: stk.id,
            nx: Math.max(0, Math.min(0.99, (sx - cropX) / cropW)),
            ny: Math.max(0, Math.min(0.99, (sy - cropY) / cropH)),
            nw: Math.max(0.01, Math.min(1.0, sw / cropW)),
            nh: Math.max(0.01, Math.min(1.0, sh / cropH)),
            revealed: Boolean(stk.revealed),
            color: stk.color || '#facc15'
          });
        });
      });
    }

    return stickerHotspots;
  }

  // --- [📐 선택된 요소(문제·그래프·필기) 영역만 자동 감지하는 직사각형 바운딩 박스 계산 엔진] ---
  getSmartExportBounds(filterOpts = null) {
    // 🌟 [대표님 핵심 기획: PDF 통모드(페이지 모드)는 뷰어·내보내기 시 100% 원본 PDF 페이지 사이즈로 1:1 고정!] 🌟
    // 통모드에서 뷰어로 보거나 PNG/PDF로 저장할 때 페이지 바깥 여백이 붙거나 페이지마다 비율이 달라지지 않도록,
    // 무조건 원본 PDF 페이지 사각형(mathW × mathH) 그대로 스캔하여 정품 PDF와 100% 동일한 규격을 보장합니다!
    if (this.isGraphCovered && this.pdfPageBoardData && this.pdfPageBoardData.mathW && this.pdfPageBoardData.mathH) {
      const cx = this.pdfPageBoardData.centerX || 0;
      const cy = this.pdfPageBoardData.centerY || 0;
      const pTL = this.mathToScreen(cx - this.pdfPageBoardData.mathW / 2, cy + this.pdfPageBoardData.mathH / 2);
      const pBR = this.mathToScreen(cx + this.pdfPageBoardData.mathW / 2, cy - this.pdfPageBoardData.mathH / 2);
      const pageX = Math.round(Math.min(pTL.x, pBR.x));
      const pageY = Math.round(Math.min(pTL.y, pBR.y));
      const pageW = Math.max(10, Math.round(Math.abs(pBR.x - pTL.x)));
      const pageH = Math.max(10, Math.round(Math.abs(pBR.y - pTL.y)));
      return { x: pageX, y: pageY, width: pageW, height: pageH, w: pageW, h: pageH };
    }

    const effFilter = filterOpts || this._activeExportFilter || { includeProblem: true, includeGraph: true, includeInk: true };
    const incProb = effFilter.includeProblem !== false;
    const incGraph = effFilter.includeGraph !== false;
    const incInk = effFilter.includeInk !== false;

    const activeTarget = (this.isGraphCovered && !this.pdfPageBoardData) ? 'board' : 'graph';
    const activeStrokes = incInk ? (this.inkStrokes || []).filter(s => {
      if (!s) return false;
      if (this.pdfPageBoardData) return Boolean(s.onPdfBoard);
      if ((s.target || 'board') !== activeTarget) return false;
      if (activeTarget === 'graph' && Boolean(s.onPdfBoard)) return false;
      return true;
    }) : [];

    const canvasRect = this.canvas ? this.canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const selectors = [];
    if (incProb) selectors.push('#problemCardWidget', '.extra-problem-card-widget');
    if (incGraph) selectors.push('#graphCardWidget', '.extra-graph-card-widget');

    const cardEls = (typeof document !== 'undefined' && selectors.length > 0)
      ? Array.from(document.querySelectorAll(selectors.join(', '))).filter(el => {
        if (!el || el.style.display === 'none') return false;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      : [];

    const hasPdfBoard = Boolean(incProb && this.pdfPageBoardData);
    const hasLiveGraph = Boolean(incGraph && !this.isGraphCovered && this.graphs && this.graphs.length > 0);
    const activeBoardStickers = (this.boardStickers || []).filter(stk => Boolean(this.getBoardStickerScreenRect(stk)));

    if (activeStrokes.length === 0 && activeBoardStickers.length === 0 && cardEls.length === 0 && !hasPdfBoard && !hasLiveGraph) {
      return null;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const expand = (x, y, pad = 0) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x - pad < minX) minX = x - pad;
      if (y - pad < minY) minY = y - pad;
      if (x + pad > maxX) maxX = x + pad;
      if (y + pad > maxY) maxY = y + pad;
    };

    // 1. 선택된 필기 획 스캔
    const bz = this.boardZoom || 1.0;
    activeStrokes.forEach(s => {
      const isBoard = (s.target || 'board') === 'board';
      const pad = Math.max(8, (s.size || 4) * (s.isHighlighter ? 2.5 : 1.5));
      if (s.shape) {
        const sh = s.shape;
        if (sh.type === 'line' && sh.start && sh.end) {
          const s1 = isBoard ? this.boardToScreen(sh.start.x, sh.start.y) : this.mathToScreen(sh.start.x, sh.start.y);
          const s2 = isBoard ? this.boardToScreen(sh.end.x, sh.end.y) : this.mathToScreen(sh.end.x, sh.end.y);
          expand(s1.x, s1.y, pad);
          expand(s2.x, s2.y, pad);
        } else if (sh.type === 'circle' && sh.center) {
          const sc = isBoard ? this.boardToScreen(sh.center.x, sh.center.y) : this.mathToScreen(sh.center.x, sh.center.y);
          const sr = isBoard ? (sh.radius * bz) : Math.abs(this.mathToScreen(sh.center.x + sh.radius, sh.center.y).x - sc.x);
          expand(sc.x - sr, sc.y - sr, pad);
          expand(sc.x + sr, sc.y + sr, pad);
        } else if (sh.type === 'ellipse' && sh.center) {
          const sc = isBoard ? this.boardToScreen(sh.center.x, sh.center.y) : this.mathToScreen(sh.center.x, sh.center.y);
          const srx = isBoard ? (sh.rx * bz) : Math.abs(this.mathToScreen(sh.center.x + sh.rx, sh.center.y).x - sc.x);
          const sry = isBoard ? (sh.ry * bz) : Math.abs(this.mathToScreen(sh.center.x, sh.center.y + sh.ry).y - sc.y);
          expand(sc.x - srx, sc.y - sry, pad);
          expand(sc.x + srx, sc.y + sry, pad);
        } else if (sh.type === 'rect' && sh.min && sh.max) {
          const rs1 = isBoard ? this.boardToScreen(sh.min.x, sh.min.y) : this.mathToScreen(sh.min.x, sh.min.y);
          const rs2 = isBoard ? this.boardToScreen(sh.max.x, sh.max.y) : this.mathToScreen(sh.max.x, sh.max.y);
          expand(rs1.x, rs1.y, pad);
          expand(rs2.x, rs2.y, pad);
        } else if (sh.pts && sh.pts.length > 0) {
          sh.pts.forEach(pt => {
            const sp = isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y);
            expand(sp.x, sp.y, pad);
          });
        }
      }
      if (s.points && s.points.length > 0) {
        s.points.forEach(pt => {
          const sp = isBoard ? this.boardToScreen(pt.x, pt.y) : this.mathToScreen(pt.x, pt.y);
          expand(sp.x, sp.y, pad);
        });
      }
    });

    activeBoardStickers.forEach(stk => {
      const r = this.getBoardStickerScreenRect(stk);
      if (r && r.w > 0 && r.h > 0) {
        expand(r.x, r.y, 8);
        expand(r.x + r.w, r.y + r.h, 8);
      }
    });

    // 1.5. PDF 페이지 통째 칠판 모드가 활성화된 경우
    if (hasPdfBoard && this.pdfPageBoardData.mathW && this.pdfPageBoardData.mathH) {
      const cx = this.pdfPageBoardData.centerX || 0;
      const cy = this.pdfPageBoardData.centerY || 0;
      const pTL = this.mathToScreen(cx - this.pdfPageBoardData.mathW / 2, cy + this.pdfPageBoardData.mathH / 2);
      const pBR = this.mathToScreen(cx + this.pdfPageBoardData.mathW / 2, cy - this.pdfPageBoardData.mathH / 2);
      expand(pTL.x, pTL.y, 8);
      expand(pBR.x, pBR.y, 8);
    }

    // 2. 선택된 문제 카드 & 그래프 보관 카드 영역 스캔
    cardEls.forEach(el => {
      const isMin = el.classList.contains('minimized');
      const headerEl = el.querySelector('.problem-card-header');
      const bodyEl = el.querySelector('.problem-card-body');
      if (isMin && headerEl) {
        const hr = headerEl.getBoundingClientRect();
        if (hr.width > 0 && hr.height > 0) {
          expand(hr.left - canvasRect.left, hr.top - canvasRect.top, 4);
          expand(hr.right - canvasRect.left, hr.bottom - canvasRect.top, 4);
        }
      }
      if (!isMin && bodyEl) {
        const br = bodyEl.getBoundingClientRect();
        if (br.width > 0 && br.height > 0) {
          expand(br.left - canvasRect.left, br.top - canvasRect.top, 4);
          expand(br.right - canvasRect.left, br.bottom - canvasRect.top, 4);
        }
      }
    });

    // 3. 실시간 그래프 레이어일 때 함수 핸들/원점/구간경계/수선/라벨 포함
    if (incGraph && !this.isGraphCovered) {
      if (this.graphs && this.graphs.length > 0) {
        if (this.showAxes) {
          const orig = this.mathToScreen(0, 0);
          expand(orig.x, orig.y, 110);
        }
        this.graphs.forEach(g => {
          const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
          const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
          if (g.handles && g.handles.length > 0) {
            g.handles.forEach(h => {
              const s = this.mathToScreen(h.x + ox, h.y + oy);
              expand(s.x, s.y, 150);
            });
          }
        });
      }
      if (this.usePiecewise && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) {
        const origY = this.mathToScreen(0, 0).y;
        this.piecewiseBoundaries.forEach(bx => {
          const sx = this.mathToScreen(bx, 0).x;
          expand(sx, origY, 110);
        });
      }
      if (this.dropLines && this.dropLines.length > 0) {
        this.dropLines.forEach(dl => {
          const s = this.mathToScreen(dl.sourceX, dl.sourceY);
          const fx = this.mathToScreen(dl.sourceX, 0);
          const fy = this.mathToScreen(0, dl.sourceY);
          expand(s.x, s.y, 45);
          expand(fx.x, fx.y, 45);
          expand(fy.x, fy.y, 45);
        });
      }
      if (this.textLabels && this.textLabels.length > 0) {
        this.textLabels.forEach(tl => {
          const s = this.mathToScreen(tl.mathX, tl.mathY);
          expand(s.x, s.y, 60);
        });
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }

    const PAD = hasPdfBoard ? 14 : 36;
    const baseW = Math.max(800, Math.round(this.screenWidth || window.innerWidth || 1280));
    const baseH = Math.max(500, Math.round(this.screenHeight || window.innerHeight || 720));

    const contentLeft = Math.floor(minX - PAD);
    const contentTop = Math.floor(minY - PAD);
    const contentRight = Math.ceil(maxX + PAD);
    const contentBottom = Math.ceil(maxY + PAD);

    // 🌟 [통PDF 모드(hasPdfBoard)]: A4 세로 PDF 페이지(및 페이지 밖 필기/카드) 영역에 딱 맞춰 크롭하여
    //    모바일 세로 화면에서도 좌우 불필요한 모니터 여백 없이 100% 꽉 차게 보이도록 처리!
    if (hasPdfBoard) {
      const cropX = Math.floor(contentLeft);
      const cropY = Math.floor(contentTop);
      const cropW = Math.min(8000, Math.max(200, Math.ceil(contentRight - contentLeft)));
      const cropH = Math.min(8000, Math.max(200, Math.ceil(contentBottom - contentTop)));
      return { x: cropX, y: cropY, width: cropW, height: cropH, w: cropW, h: cropH };
    }

    // 🌟 [대표님 핵심 기획: 기본 캡처 최소 영역 = 모니터 화면 1개 크기 보장 + 화면 밖 필기 시 자동 확장]
    // 1) 좁은 영역에 조그만 원 하나만 그리더라도 그것만 잘려서 과도하게 확대되지 않도록,
    //    기본적으로 현재 모니터 화면 1개 크기(0 ~ baseW, 0 ~ baseH)를 최소 캡처 영역으로 유지합니다.
    // 2) 필기나 카드가 모니터 화면 영역을 넘어가서 작성된 경우에만 넘어간 만큼 캡처 영역을 자동 확장합니다.
    const overlapsScreenX = (contentRight >= 0 && contentLeft <= baseW);
    const overlapsScreenY = (contentBottom >= 0 && contentTop <= baseH);

    let cropLeft, cropRight, cropTop, cropBottom;
    if (overlapsScreenX) {
      cropLeft = Math.min(0, contentLeft);
      cropRight = Math.max(baseW, contentRight);
    } else {
      const spanW = contentRight - contentLeft;
      if (spanW < baseW) {
        const midX = (contentLeft + contentRight) / 2;
        cropLeft = Math.floor(midX - baseW / 2);
        cropRight = cropLeft + baseW;
      } else {
        cropLeft = contentLeft;
        cropRight = contentRight;
      }
    }

    if (overlapsScreenY) {
      cropTop = Math.min(0, contentTop);
      cropBottom = Math.max(baseH, contentBottom);
    } else {
      const spanH = contentBottom - contentTop;
      if (spanH < baseH) {
        const midY = (contentTop + contentBottom) / 2;
        cropTop = Math.floor(midY - baseH / 2);
        cropBottom = cropTop + baseH;
      } else {
        cropTop = contentTop;
        cropBottom = contentBottom;
      }
    }

    const cropX = Math.floor(cropLeft);
    const cropY = Math.floor(cropTop);
    const cropW = Math.min(8000, Math.max(baseW, Math.ceil(cropRight - cropLeft)));
    const cropH = Math.min(8000, Math.max(baseH, Math.ceil(cropBottom - cropTop)));

    return { x: cropX, y: cropY, width: cropW, height: cropH, w: cropW, h: cropH };
  }

  // --- [선택된 요소 직사각형 자동 스캔 오프스크린 렌더링 엔진] ---
  getExportCanvas(filterOpts = null, precomputedBounds = undefined, customScale = null) {
    const dpi = this.exportDPI;
    const exportCanvas = document.createElement('canvas');
    const prevFilter = this._activeExportFilter;
    this._activeExportFilter = filterOpts || this.exportFilter || { includeProblem: true, includeGraph: true, includeInk: true };

    try {
      const smartBounds = (precomputedBounds !== undefined)
        ? precomputedBounds
        : this.getSmartExportBounds(this._activeExportFilter);
      const scaleFactor = customScale || ((dpi >= 600) ? 3 : 2);
      const sw = smartBounds ? smartBounds.width : this.screenWidth;
      const sh = smartBounds ? smartBounds.height : this.screenHeight;
      const maxPx = 8192;
      const effScale = Math.min(scaleFactor, maxPx / Math.max(1, sw), maxPx / Math.max(1, sh));
      const pxW = Math.max(1, Math.round(sw * effScale));
      const pxH = Math.max(1, Math.round(sh * effScale));
      exportCanvas.width = pxW;
      exportCanvas.height = pxH;
      const expCtx = exportCanvas.getContext('2d');

      if (smartBounds) {
        const cropX = smartBounds.x;
        const cropY = smartBounds.y;
        const backup = {
          sw: this.screenWidth,
          sh: this.screenHeight,
          panX: this.panX,
          panY: this.panY,
          ySpan: this.ySpan,
          lockAspect: this.lockAspect,
          boardPanX: this.boardPanX,
          boardPanY: this.boardPanY,
          boardZoom: this.boardZoom,
          boardZoomOffsetX: this.boardZoomOffsetX,
          boardZoomOffsetY: this.boardZoomOffsetY,
          exportCropOffset: this._exportCropOffset
        };

        const origX = backup.sw / 2 + backup.panX;
        const origY = backup.sh / 2 + backup.panY;

        this.screenWidth = sw;
        this.screenHeight = sh;
        this.panX = (origX - cropX) - sw / 2;
        this.panY = (origY - cropY) - sh / 2;
        this.ySpan = backup.ySpan * (sh / Math.max(1, backup.sh));
        this.lockAspect = true;
        this.boardPanX = (backup.boardPanX || 0) - cropX;
        this.boardPanY = (backup.boardPanY || 0) - cropY;
        this._exportCropOffset = { x: cropX, y: cropY };

        expCtx.save();
        expCtx.scale(effScale, effScale);
        this.render(expCtx, sw, sh, true);
        expCtx.restore();

        this.screenWidth = backup.sw;
        this.screenHeight = backup.sh;
        this.panX = backup.panX;
        this.panY = backup.panY;
        this.ySpan = backup.ySpan;
        this.lockAspect = backup.lockAspect;
        this.boardPanX = backup.boardPanX;
        this.boardPanY = backup.boardPanY;
        this.boardZoom = backup.boardZoom;
        this.boardZoomOffsetX = backup.boardZoomOffsetX;
        this.boardZoomOffsetY = backup.boardZoomOffsetY;
        this._exportCropOffset = backup.exportCropOffset;
      } else {
        expCtx.save();
        expCtx.scale(effScale, effScale);
        this.render(expCtx, sw, sh, true);
        expCtx.restore();
      }

      return { canvas: exportCanvas, width: pxW, height: pxH, dpi };
    } finally {
      this._activeExportFilter = prevFilter;
    }
  }

  async copyToClipboard(filterOpts = null) {
    try {
      await this._waitForSlideImagesReady();
      const exp = this.getExportCanvas(filterOpts);
      return await new Promise((resolve) => {
        exp.canvas.toBlob(async (rawBlob) => {
          if (!rawBlob) { resolve(false); return; }
          try {
            const highDpiBlob = await this.injectDpiToBlob(rawBlob, exp.dpi);
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': highDpiBlob })
            ]);
            resolve(true);
          } catch (clipErr) {
            this.downloadPNG(filterOpts);
            resolve(false);
          }
        }, 'image/png');
      });
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  downloadPNG(filterOpts = null, customFileName = null) {
    const exp = this.getExportCanvas(filterOpts);
    return new Promise((resolve) => {
      exp.canvas.toBlob(async (rawBlob) => {
        if (!rawBlob) { resolve(false); return; }
        const highDpiBlob = await this.injectDpiToBlob(rawBlob, exp.dpi);
        const url = URL.createObjectURL(highDpiBlob);
        const link = document.createElement('a');
        link.download = customFileName || `Graphly_스캔_${Date.now()}.png`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve(true);
      }, 'image/png');
    });
  }

  // 🌟 [다중 슬라이드 단일 파일(Multi-Page PDF 1.4) 통합 빌더]:
  // 슬라이드 10장을 내보낼 때 낱장 PNG 10개로 흩어지지 않고, 모든 슬라이드를 1개의 고화질 다중 페이지 PDF 문서(.pdf)로 묶어줍니다!
  buildMultiPagePdfBlobFromCanvases(canvasItems = []) {
    if (!Array.isArray(canvasItems) || canvasItems.length === 0) return null;
    const encoder = new TextEncoder();
    const chunks = [];
    let offset = 0;

    const pushBytes = (bytes) => {
      chunks.push(bytes);
      offset += bytes.byteLength;
    };
    const pushStr = (str) => {
      pushBytes(encoder.encode(str));
    };

    // PDF 1.4 헤더 + 바이너리 마커
    pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

    const xrefOffsets = [0];
    // Object 1: Catalog
    xrefOffsets[1] = offset;
    pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    // Object 2: Pages
    const kidsRef = canvasItems.map((_, idx) => `${3 + idx * 3} 0 R`).join(' ');
    xrefOffsets[2] = offset;
    pushStr(`2 0 obj\n<< /Type /Pages /Kids [${kidsRef}] /Count ${canvasItems.length} >>\nendobj\n`);

    for (let idx = 0; idx < canvasItems.length; idx++) {
      const item = canvasItems[idx];
      const srcCanvas = item && item.canvas ? item.canvas : item;
      const pxW = Math.max(1, (srcCanvas && srcCanvas.width) || 1200);
      const pxH = Math.max(1, (srcCanvas && srcCanvas.height) || 800);
      const bgColor = (item && item.bgColor) ? item.bgColor : '#ffffff';

      // 투명 영역이 검게 변하지 않도록 배경색이 입혀진 합성 캔버스 생성 후 고화질 JPEG 바이트 추출
      const compCanvas = document.createElement('canvas');
      compCanvas.width = pxW;
      compCanvas.height = pxH;
      const compCtx = compCanvas.getContext('2d');
      compCtx.fillStyle = bgColor;
      compCtx.fillRect(0, 0, pxW, pxH);
      if (srcCanvas) {
        compCtx.drawImage(srcCanvas, 0, 0);
      }

      const jpegDataUrl = compCanvas.toDataURL('image/jpeg', 0.96);
      const b64 = jpegDataUrl.split(',')[1] || '';
      const binStr = atob(b64);
      const jpegBytes = new Uint8Array(binStr.length);
      for (let k = 0; k < binStr.length; k++) {
        jpegBytes[k] = binStr.charCodeAt(k);
      }

      const pageObjId = 3 + idx * 3;
      const contentObjId = 4 + idx * 3;
      const imgObjId = 5 + idx * 3;
      const ptW = Math.max(72, Math.round(pxW * 0.5));
      const ptH = Math.max(72, Math.round(pxH * 0.5));

      xrefOffsets[pageObjId] = offset;
      pushStr(
        `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] ` +
        `/Resources << /XObject << /Im0 ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\n` +
        `endobj\n`
      );

      const contentStream = `q\n${ptW} 0 0 ${ptH} 0 0 cm\n/Im0 Do\nQ\n`;
      const contentBytes = encoder.encode(contentStream);
      xrefOffsets[contentObjId] = offset;
      pushStr(`${contentObjId} 0 obj\n<< /Length ${contentBytes.byteLength} >>\nstream\n`);
      pushBytes(contentBytes);
      pushStr(`\nendstream\nendobj\n`);

      xrefOffsets[imgObjId] = offset;
      pushStr(
        `${imgObjId} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\n` +
        `stream\n`
      );
      pushBytes(jpegBytes);
      pushStr(`\nendstream\nendobj\n`);
    }

    const xrefStart = offset;
    const totalObjs = 2 + canvasItems.length * 3;
    pushStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
    for (let id = 1; id <= totalObjs; id++) {
      pushStr(`${String(xrefOffsets[id]).padStart(10, '0')} 00000 n \n`);
    }
    pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

    return new Blob(chunks, { type: 'application/pdf' });
  }

  async downloadViewerSlidesAsSinglePdf(pkg = this._viewerPkg) {
    if (!pkg || !Array.isArray(pkg.playlistSlides) || pkg.playlistSlides.length === 0) return false;
    const slides = pkg.playlistSlides;
    const canvasItems = [];
    for (let i = 0; i < slides.length; i++) {
      const sl = slides[i];
      let dataUrl = sl.viewerSnapshotDataUrl;
      if (!dataUrl) {
        this.deserializeFullSlideState(sl);
        await this._waitForSlideImagesReady();
        const snap = this.captureCurrentSlideViewerSnapshot(pkg.exportFilter || null, false);
        dataUrl = snap.dataUrl;
        sl.viewerSnapshotDataUrl = dataUrl;
      }
      if (dataUrl) {
        const c = await new Promise((resolve) => {
          const im = new Image();
          im.onload = () => {
            const off = document.createElement('canvas');
            off.width = Math.max(1, im.naturalWidth || 1200);
            off.height = Math.max(1, im.naturalHeight || 800);
            off.getContext('2d').drawImage(im, 0, 0);
            resolve(off);
          };
          im.onerror = () => resolve(null);
          im.src = dataUrl;
        });
        if (c) canvasItems.push({ canvas: c, bgColor: '#ffffff' });
      }
    }
    if (canvasItems.length === 0) return false;
    const pdfBlob = this.buildMultiPagePdfBlobFromCanvases(canvasItems);
    if (!pdfBlob) return false;
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.download = `Graphly_캔버스노트_${canvasItems.length}장_${Date.now()}.pdf`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.showToast(`📄 전체 캔버스(${canvasItems.length}장)가 단 하나의 통합 PDF 파일로 저장되었습니다!`);
    return true;
  }

  async downloadExportImages(scope = 'current', filterOpts = null) {
    const effScope = scope || this.exportScope || 'current';
    const effFilter = filterOpts || this.exportFilter || { includeProblem: true, includeGraph: true, includeInk: true };

    if (effScope === 'all') {
      const allSlides = this._getFilteredSlidesForExport('수업 노트', 'all', effFilter);
      if (allSlides.length > 1) {
        const backupCurrent = this.serializeFullSlideState('backup');
        const canvasItems = [];
        for (let i = 0; i < allSlides.length; i++) {
          this.deserializeFullSlideState(allSlides[i]);
          await this._waitForSlideImagesReady();
          const exp = this.getExportCanvas(effFilter);
          const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.white_paper;
          const bgColor = (!this.isMonochromeMode && curTheme && curTheme.bg) ? curTheme.bg : '#ffffff';
          canvasItems.push({ canvas: exp.canvas, bgColor });
        }
        this.deserializeFullSlideState(backupCurrent);
        const pdfBlob = this.buildMultiPagePdfBlobFromCanvases(canvasItems);
        if (pdfBlob) {
          const url = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.download = `Graphly_캔버스노트_${allSlides.length}장_${Date.now()}.pdf`;
          link.href = url;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          this.showToast(`📄 전체 캔버스(${allSlides.length}장)가 단 하나의 통합 PDF 파일로 저장되었습니다!`);
          return pdfBlob;
        }
      }
    }
    await this._waitForSlideImagesReady();
    await this.downloadPNG(effFilter, `Graphly_스캔_${Date.now()}.png`);
    return null;
  }
  }.prototype);
  delete _desc.constructor;
  Object.defineProperties(GraphApp.prototype, _desc);
}
