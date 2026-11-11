/**
 * Graphly Math Visualization Toolkit Hub & Visual N-Axis Composite Function Studio
 * - 본체 핵심 파일(app-core.js, app-canvas.js, engine.js) 무결성 100% 보존형 독립 모듈
 * - 수식 입력창 제거 · 캔버스 개형 읽기전용 자동 연동 · 스튜디오 내 실시간 개형 핸들 드래그 & 극점 보조선 자석 스냅
 * - [캔버스 삽입] 시 최종 합성함수 y = f(g(x)) 단독 고화질 카드로 칠판 삽입 (카드에서 [크게 열기] 시 4분할 스튜디오 즉시 복원)
 */
(function () {
  if (typeof GraphApp === 'undefined') return;

  // --- 구버전 보관 카드(v55 이하 수식 기반) 복원 전용 안전 수식 컴파일러 (eval / new Function 0%) ---
  function compileLegacyExprSafe(exprStr) {
    if (!exprStr || typeof exprStr !== 'string') return () => 0;
    let s = exprStr.trim();
    if (!s) return () => 0;
    s = s.replace(/[−–—]/g, '-')
      .replace(/[×·]/g, '*')
      .replace(/÷/g, '/')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/⁴/g, '^4')
      .replace(/루트|√/g, 'sqrt')
      .replace(/파이|π/g, 'pi');
    let guard = 0;
    while (/\|[^|]+\|/.test(s) && guard < 10) {
      s = s.replace(/\|([^|]+)\|/g, 'abs($1)');
      guard++;
    }
    s = s.replace(/\s+/g, '');
    s = s.replace(/(asin|acos|atan|sqrt|floor|ceil|sin|cos|tan|abs|exp|ln|log)(-?\d*\.?\d*[xt])(?![a-zA-Z0-9_(])/gi, '$1($2)');
    s = s.replace(/([xt)])(\d+)(?![\d.])/gi, '$1^$2');
    s = s.replace(/(?<![a-zA-Z])log(?=\()/gi, 'log10');
    s = s.replace(/(?<![a-zA-Z])t(?![a-zA-Z])/g, 'x');
    if (typeof SafeMathCompiler !== 'undefined' && typeof SafeMathCompiler.compile === 'function') {
      const compiled = SafeMathCompiler.compile(s);
      if (compiled && compiled.success && typeof compiled.fn === 'function') {
        return (_v) => {
          const val = compiled.fn(_v);
          return (typeof val === 'number' && !isNaN(val) && isFinite(val)) ? val : NaN;
        };
      }
    }
    return () => 0;
  }

  // --- 스튜디오 내 기본 제공 대표 개형 생성기 (수식 없이 원클릭 소환 + 핸들 드래그 제어) ---
  const STUDIO_PRESET_DEFS = [
    {
      key: 'cubic',
      chipLabel: '삼차',
      fullName: '삼차함수',
      viewXMin: -2.8,
      viewXMax: 2.8,
      makeGraph: () => ({
        id: 'st_cubic',
        type: '3rd_normal',
        isAbsolute: false,
        handles: [
          { name: '극대', x: -1.0, y: 2.0, type: 'max' },
          { name: '극소', x: 1.0, y: -2.0, type: 'min' },
          { name: '변곡점', x: 0.0, y: 0.0, type: 'inflection' }
        ]
      })
    },
    {
      key: 'quad',
      chipLabel: '이차',
      fullName: '이차함수',
      viewXMin: -3.0,
      viewXMax: 3.0,
      makeGraph: () => ({
        id: 'st_quad',
        type: '2nd_quadratic',
        isAbsolute: false,
        handles: [
          { name: '꼭짓점', x: 0.0, y: -1.8, type: 'vertex' },
          { name: '조절점', x: 1.35, y: 0.0, type: 'point' }
        ]
      })
    },
    {
      key: 'quartic',
      chipLabel: '사차W',
      fullName: '사차함수',
      viewXMin: -2.8,
      viewXMax: 2.8,
      makeGraph: () => ({
        id: 'st_quartic',
        type: '4th_symmetric',
        isAbsolute: false,
        handles: [
          { name: '극소', x: -1.4, y: -2.0, type: 'min' },
          { name: '극대', x: 0.0, y: 1.2, type: 'max' },
          { name: '극소', x: 1.4, y: -2.0, type: 'min' }
        ]
      })
    },
    {
      key: 'linear',
      chipLabel: '일차',
      fullName: '일차함수',
      viewXMin: -3.0,
      viewXMax: 3.0,
      makeGraph: () => ({
        id: 'st_linear',
        type: '1st_linear',
        isAbsolute: false,
        handles: [
          { name: '기준점', x: 0.0, y: 0.0, type: 'vertex' },
          { name: '기울기', x: 1.5, y: 1.5, type: 'point' }
        ]
      })
    },
    {
      key: 'vline',
      chipLabel: '꺾인선',
      fullName: '절댓값 꺾인선',
      viewXMin: -3.0,
      viewXMax: 3.0,
      makeGraph: () => ({
        id: 'st_vline',
        type: '1st_linear',
        isAbsolute: true,
        freezeOffset: { x: 0.0, y: -1.5 },
        handles: [
          { name: '꺾인점', x: 0.0, y: 0.0, type: 'vertex' },
          { name: '기울기', x: 1.5, y: 1.5, type: 'point' }
        ]
      })
    },
    {
      key: 'sin',
      chipLabel: 'sin',
      fullName: 'sin 개형',
      viewXMin: -3.14,
      viewXMax: 3.14,
      makeGraph: () => ({
        id: 'st_sin',
        type: 'sin_1period',
        isAbsolute: false,
        handles: [
          { name: '중심', x: 0.0, y: 0.0, type: 'center' },
          { name: '봉우리', x: 1.57, y: 2.0, type: 'max' }
        ]
      })
    },
    {
      key: 'cos',
      chipLabel: 'cos',
      fullName: 'cos 개형',
      viewXMin: -3.14,
      viewXMax: 3.14,
      makeGraph: () => ({
        id: 'st_cos',
        type: 'cos_1period',
        isAbsolute: false,
        handles: [
          { name: '중심', x: 0.0, y: 0.0, type: 'center' },
          { name: '주기·진폭', x: 6.283, y: 2.0, type: 'max' }
        ]
      })
    },
    {
      key: 'rational',
      chipLabel: '유리',
      fullName: '유리함수',
      viewXMin: -3.2,
      viewXMax: 3.2,
      makeGraph: () => ({
        id: 'st_rational',
        type: 'rational_basic',
        isAbsolute: false,
        handles: [
          { name: '점근중심', x: 0.0, y: 0.0, type: 'center' },
          { name: '조절점', x: 1.0, y: 1.0, type: 'point' }
        ]
      })
    },
    {
      key: 'sqrt',
      chipLabel: '무리',
      fullName: '무리함수',
      viewXMin: -2.5,
      viewXMax: 3.5,
      makeGraph: () => ({
        id: 'st_sqrt',
        type: 'sqrt_basic',
        isAbsolute: false,
        handles: [
          { name: '시작점', x: -1.5, y: -1.2, type: 'vertex' },
          { name: '조절점', x: 0.5, y: 1.4, type: 'point' }
        ]
      })
    },
    {
      key: 'exp',
      chipLabel: '지수',
      fullName: '지수함수',
      viewXMin: -3.0,
      viewXMax: 3.0,
      makeGraph: () => ({
        id: 'st_exp',
        type: 'exp_basic',
        isAbsolute: false,
        handles: [
          { name: '점근선', x: 0.0, y: -1.5, type: 'center' },
          { name: '조절점', x: 1.0, y: 0.5, type: 'point' }
        ]
      })
    }
  ];

  function deepCloneJson(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (_) {
      return null;
    }
  }

  function isValidFunctionGraph(g) {
    if (!g || typeof g.type !== 'string') return false;
    if (g.type.startsWith('geom_')) return false;
    if (g.isTransposedYX) return false; // y=x 전치 비함수 곡선 제외
    if (g.type === '1st_linear' && Array.isArray(g.handles) && g.handles.length >= 2) {
      if (Math.abs((g.handles[1].x || 0) - (g.handles[0].x || 0)) < 1e-4) {
        return false; // 수직선 x = c 제외
      }
    }
    return true;
  }

  function evaluatePiecewiseBundleAt(bundle, mx) {
    if (!bundle || !Array.isArray(bundle.graphs) || bundle.graphs.length === 0) return NaN;
    const graphs = bundle.graphs;
    const boundaries = Array.isArray(bundle.boundaries) ? bundle.boundaries : [];
    const funcMap = Array.isArray(bundle.funcMap) ? bundle.funcMap : [];
    let evalX = mx;
    let yOffset = 0;

    if (bundle.isPeriodic && boundaries.length >= 2) {
      const b0 = boundaries[0];
      const bLast = boundaries[boundaries.length - 1];
      const T = bLast - b0;
      if (T > 1e-4) {
        const curCycleK = Math.floor((mx - b0) / T);
        let xBase = mx - curCycleK * T;
        if (xBase >= bLast - 1e-6) xBase = b0;
        if (xBase < b0) xBase = b0;
        evalX = xBase;
        yOffset = curCycleK * (bundle.stepY || 0);
      }
    }

    let regionIdx = 0;
    for (let i = 0; i < boundaries.length; i++) {
      if (evalX >= boundaries[i]) regionIdx = i + 1;
      else break;
    }
    const gIdx = (funcMap[regionIdx] !== undefined) ? funcMap[regionIdx] : Math.min(regionIdx, graphs.length - 1);
    const targetG = graphs[gIdx];
    if (!targetG || !isValidFunctionGraph(targetG)) return NaN;
    const rawY = GraphMathEngine.evaluatePipeline(targetG, evalX);
    if (typeof rawY !== 'number' || isNaN(rawY) || !isFinite(rawY)) return NaN;
    return rawY + yOffset;
  }

  // =========================================================================
  // 1. 시각화 도구 허브 (확장형 플러그인 레지스트리 — 미개발 더미 항목 0개 원칙)
  // =========================================================================
  GraphApp.prototype.registerMathToolkitTool = function (toolDef) {
    if (!toolDef || !toolDef.id || typeof toolDef.open !== 'function') return;
    if (!Array.isArray(this.mathToolkitRegistry)) {
      this.mathToolkitRegistry = [];
    }
    const existingIdx = this.mathToolkitRegistry.findIndex(t => t && t.id === toolDef.id);
    if (existingIdx >= 0) {
      this.mathToolkitRegistry[existingIdx] = toolDef;
    } else {
      this.mathToolkitRegistry.push(toolDef);
    }
  };

  GraphApp.prototype._pauseAudioForToolkitIfNeeded = function () {
    if (this.isAudioRecording && !this.isAudioRecordPaused) {
      this._autoPausedByToolkitModal = true;
      this.isAudioRecordPaused = true;
      this.audioRecordPauseStartMs = performance.now();
      if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'recording') {
        try { this.audioMediaRecorder.pause(); } catch (_) { }
      }
      if (typeof this.syncAudioRecordUI === 'function') this.syncAudioRecordUI();
    }
  };

  GraphApp.prototype._resumeAudioAfterToolkitIfNeeded = function () {
    if (this.isMathToolkitOpen || this.isNAxisStudioOpen) return;
    if (this.isAudioRecording && this._autoPausedByToolkitModal) {
      this._autoPausedByToolkitModal = false;
      if (this.isAudioRecordPaused) {
        const pausedDelta = Math.max(0, performance.now() - (this.audioRecordPauseStartMs || performance.now()));
        this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + pausedDelta;
        this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
        this.isAudioRecordPaused = false;
        this.audioRecordPauseStartMs = 0;
        if (this.audioMediaRecorder && this.audioMediaRecorder.state === 'paused') {
          try { this.audioMediaRecorder.resume(); } catch (_) { }
        }
      }
      if (typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      if (typeof this.syncAudioRecordUI === 'function') this.syncAudioRecordUI();
    }
  };

  GraphApp.prototype.initMathToolkitHub = function () {
    if (this._mathToolkitHubInitialized) return;
    this._mathToolkitHubInitialized = true;
    this.isMathToolkitOpen = false;
    if (!Array.isArray(this.mathToolkitRegistry)) {
      this.mathToolkitRegistry = [];
    }

    // 1호 정식 도구 등록: 합성함수 시각화
    this.registerMathToolkitTool({
      id: 'n_axis_composite',
      title: '합성함수 시각화',
      desc: '캔버스에 그린 개형을 불러와 치역·극점 매칭과 자동 순항을 시연하고 결과 그래프를 삽입합니다.',
      iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>`,
      open: () => this.openNAxisStudioModal()
    });

    const launcherModal = document.getElementById('modalMathToolkitLauncher');
    const gridEl = document.getElementById('mathToolkitGrid');
    const btnClose = document.getElementById('btnCloseMathToolkit');

    const closeHub = () => {
      this.isMathToolkitOpen = false;
      if (launcherModal) {
        launcherModal.classList.remove('show');
        launcherModal.style.display = 'none';
      }
      this._resumeAudioAfterToolkitIfNeeded();
    };

    const openHub = () => {
      const tools = Array.isArray(this.mathToolkitRegistry) ? this.mathToolkitRegistry.filter(Boolean) : [];
      if (tools.length === 0) return;

      const drawer = document.getElementById('railDrawer');
      if (drawer && drawer.classList.contains('open') && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }

      // 등록된 완성 도구가 1개일 때는 불필요한 중간 모달 없이 즉시 오픈 (추후 2개 이상 등록 시 자동으로 그리드 런처 표출!)
      if (tools.length === 1 || !launcherModal || !gridEl) {
        tools[0].open();
        return;
      }

      this._pauseAudioForToolkitIfNeeded();
      gridEl.innerHTML = '';
      tools.forEach(tool => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'math-toolkit-item-card';
        card.innerHTML = `
          <div class="math-toolkit-item-icon">${tool.iconSvg || ''}</div>
          <div class="math-toolkit-item-info">
            <div class="math-toolkit-item-title">${tool.title || ''}</div>
            <div class="math-toolkit-item-desc">${tool.desc || ''}</div>
          </div>
        `;
        card.addEventListener('click', () => {
          this.isMathToolkitOpen = false;
          launcherModal.classList.remove('show');
          launcherModal.style.display = 'none';
          tool.open();
        });
        gridEl.appendChild(card);
      });

      this.isMathToolkitOpen = true;
      launcherModal.style.display = 'flex';
      launcherModal.classList.add('show');
    };

    this.openMathToolkitHub = openHub;
    this.closeMathToolkitHub = closeHub;

    if (btnClose) btnClose.onclick = closeHub;
    if (launcherModal) {
      launcherModal.addEventListener('pointerdown', (e) => {
        if (e.target === launcherModal) closeHub();
      });
    }
  };

  // =========================================================================
  // 2. 현재 캔버스 그래프 후보 읽기전용 스캔 (원본 오염 0% Deep Clone + 화면 정의역 자동 스캔)
  // =========================================================================
  GraphApp.prototype.collectAvailableCanvasGraphs = function () {
    const candidates = [];
    const getFuncShortName = (g) => {
      if (!g) return '함수';
      const metaObj = (this.meta && this.meta[g.type]) || (typeof FUNC_METADATA !== 'undefined' && FUNC_METADATA[g.type]);
      let baseName = (metaObj && metaObj.name) ? metaObj.name : '함수';
      baseName = baseName.replace(/\s*\(.*?\)\s*/g, '').trim();
      const hasAbs = Boolean(g.isAbsolute || g.frozenAbsolute || (Array.isArray(g.transforms) && g.transforms.some(t => t && t.abs)));
      return hasAbs ? `|${baseName}|` : baseName;
    };

    const clampDomain = (xmin, xmax) => {
      let a = (typeof xmin === 'number' && isFinite(xmin)) ? xmin : -3.5;
      let b = (typeof xmax === 'number' && isFinite(xmax)) ? xmax : 3.5;
      if (b < a) { const tmp = a; a = b; b = tmp; }
      if (b - a < 0.8) {
        const mid = (a + b) * 0.5;
        a = mid - 1.5;
        b = mid + 1.5;
      }
      if (b - a > 40) {
        const mid = (a + b) * 0.5;
        a = mid - 20;
        b = mid + 20;
      }
      return {
        viewXMin: Number(a.toFixed(2)),
        viewXMax: Number(b.toFixed(2))
      };
    };

    const collectFromSnap = (snapRaw, prefixLabel, cardW, cardH) => {
      if (!snapRaw || snapRaw.isNAxisStudioCard || !Array.isArray(snapRaw.graphs) || snapRaw.graphs.length === 0) return;
      const clonedSnap = deepCloneJson(snapRaw);
      if (!clonedSnap || !Array.isArray(clonedSnap.graphs)) return;

      if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
        GraphMathEngine.ensureCompiledFunctions(clonedSnap.graphs);
      }

      let rawXMin = -4.0, rawXMax = 4.0;
      if (typeof this._withPipCardGraphState === 'function' && cardW && cardH) {
        try {
          this._withPipCardGraphState(clonedSnap, cardW, cardH, () => {
            rawXMin = this.screenToMath(0, 0).x;
            rawXMax = this.screenToMath(cardW, 0).x;
          });
        } catch (_) {
          const effSpanX = (clonedSnap.xSpan || 6.2) / (clonedSnap.zoomLevel || 1.0);
          rawXMin = -effSpanX;
          rawXMax = effSpanX;
        }
      }
      const dom = clampDomain(rawXMin, rawXMax);

      // 1) 구간분할 카드인 경우: 비독립 조각들을 하나의 구간함수로 묶어 추가
      if (clonedSnap.usePiecewise) {
        const pwGraphs = clonedSnap.graphs.filter(g => g && !g.isIndependent && isValidFunctionGraph(g));
        if (pwGraphs.length > 0) {
          candidates.push({
            id: `canvas_pw_${prefixLabel}`,
            kind: 'canvas_piecewise',
            label: `${prefixLabel} 구간함수`,
            badgeColor: pwGraphs[0].color || '#2563eb',
            graph: null,
            piecewiseBundle: {
              graphs: deepCloneJson(pwGraphs),
              boundaries: Array.isArray(clonedSnap.piecewiseBoundaries) ? [...clonedSnap.piecewiseBoundaries] : [],
              funcMap: Array.isArray(clonedSnap.piecewiseFuncMap) ? [...clonedSnap.piecewiseFuncMap] : [],
              inclusions: Array.isArray(clonedSnap.piecewiseInclusions) ? deepCloneJson(clonedSnap.piecewiseInclusions) : [],
              isPeriodic: Boolean(clonedSnap.isPiecewisePeriodic),
              stepY: typeof clonedSnap.periodicStepY === 'number' ? clonedSnap.periodicStepY : 0
            },
            viewXMin: dom.viewXMin,
            viewXMax: dom.viewXMax
          });
        }
        // 독립 그래프가 함께 있다면 별도 후보로 추가
        const indepGraphs = clonedSnap.graphs.filter(g => g && g.isIndependent && isValidFunctionGraph(g));
        indepGraphs.forEach((ig, idx) => {
          const gClone = deepCloneJson(ig);
          if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
            GraphMathEngine.ensureCompiledFunctions([gClone]);
          }
          candidates.push({
            id: `canvas_${prefixLabel}_ind_${idx}`,
            kind: 'canvas_graph',
            label: `${prefixLabel} ${getFuncShortName(gClone)}`,
            badgeColor: gClone.color || '#2563eb',
            graph: gClone,
            piecewiseBundle: null,
            viewXMin: dom.viewXMin,
            viewXMax: dom.viewXMax
          });
        });
        return;
      }

      // 2) 일반 그래프 카드인 경우
      const validGraphs = clonedSnap.graphs.filter(isValidFunctionGraph);
      validGraphs.forEach((vg, idx) => {
        const gClone = deepCloneJson(vg);
        if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
          GraphMathEngine.ensureCompiledFunctions([gClone]);
        }
        const subPrefix = validGraphs.length > 1 ? `${prefixLabel}-${idx + 1}` : prefixLabel;
        candidates.push({
          id: `canvas_${prefixLabel}_${idx}`,
          kind: 'canvas_graph',
          label: `${subPrefix} ${getFuncShortName(gClone)}`,
          badgeColor: gClone.color || '#2563eb',
          graph: gClone,
          piecewiseBundle: null,
          viewXMin: dom.viewXMin,
          viewXMax: dom.viewXMax
        });
      });
    };

    if (this.isGraphCovered) {
      // 판서 모드: 화면에 떠 있는 창모드(PiP) 그래프 카드 순서대로 스캔
      const primaryWidget = document.getElementById('graphCardWidget');
      if (this._hasPrimaryGraphCard && this.graphCardData && primaryWidget && primaryWidget.style.display !== 'none') {
        const snap1 = typeof this._getMutablePipCardSnapshot === 'function'
          ? this._getMutablePipCardSnapshot('primary')
          : null;
        if (snap1 && !snap1.isNAxisStudioCard) {
          const body1 = document.getElementById('graphCardBody');
          const cw1 = Math.max(160, Math.round(parseFloat(primaryWidget.style.width) || (body1 && body1.clientWidth) || 380));
          const ch1 = Math.max(120, Math.round((body1 && parseFloat(body1.style.height)) || cw1 * (this.graphCardAspect || 0.82)));
          collectFromSnap(snap1, '#1', cw1, ch1);
        }
      }
      if (Array.isArray(this.extraGraphCards)) {
        this.extraGraphCards.forEach((c, cIdx) => {
          if (!c || !c.el || c.el.style.display === 'none') return;
          const snapExtra = typeof this._getMutablePipCardSnapshot === 'function'
            ? this._getMutablePipCardSnapshot(c)
            : null;
          if (!snapExtra || snapExtra.isNAxisStudioCard) return;
          const titleEl = c.el.querySelector('.card-title-text');
          const cardTag = (titleEl && titleEl.textContent && titleEl.textContent.trim())
            ? titleEl.textContent.trim()
            : `#${c.caseIdx || (cIdx + 2)}`;
          const bodyEl = c.el.querySelector('.problem-card-body');
          const cw = Math.max(160, Math.round(parseFloat(c.el.style.width) || (bodyEl && bodyEl.clientWidth) || 380));
          const ch = Math.max(120, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || cw * (c.aspect || 0.82)));
          collectFromSnap(snapExtra, cardTag, cw, ch);
        });
      }
    } else if (Array.isArray(this.graphs) && this.graphs.length > 0) {
      // 전체화면 그래프 모드: 현재 화면 정의역과 그래프 배열 스캔
      const sw = Math.max(320, this.screenWidth || window.innerWidth || 1440);
      const dom = clampDomain(
        typeof this.screenToMath === 'function' ? this.screenToMath(0, 0).x : -5,
        typeof this.screenToMath === 'function' ? this.screenToMath(sw, 0).x : 5
      );

      if (this.usePiecewise) {
        const pwGraphs = this.graphs.filter(g => g && !g.isIndependent && isValidFunctionGraph(g));
        if (pwGraphs.length > 0) {
          const clonedPw = deepCloneJson(pwGraphs);
          if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
            GraphMathEngine.ensureCompiledFunctions(clonedPw);
          }
          candidates.push({
            id: 'canvas_full_pw',
            kind: 'canvas_piecewise',
            label: '캔버스 구간함수',
            badgeColor: clonedPw[0].color || '#2563eb',
            graph: null,
            piecewiseBundle: {
              graphs: clonedPw,
              boundaries: Array.isArray(this.piecewiseBoundaries) ? [...this.piecewiseBoundaries] : [],
              funcMap: Array.isArray(this.piecewiseFuncMap) ? [...this.piecewiseFuncMap] : [],
              inclusions: Array.isArray(this.piecewiseInclusions) ? deepCloneJson(this.piecewiseInclusions) : [],
              isPeriodic: Boolean(this.isPiecewisePeriodic),
              stepY: typeof this.periodicStepY === 'number' ? this.periodicStepY : 0
            },
            viewXMin: dom.viewXMin,
            viewXMax: dom.viewXMax
          });
        }
      } else {
        const validFull = this.graphs.filter(isValidFunctionGraph);
        validFull.forEach((fg, idx) => {
          const gClone = deepCloneJson(fg);
          if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
            GraphMathEngine.ensureCompiledFunctions([gClone]);
          }
          candidates.push({
            id: `canvas_full_${idx}`,
            kind: 'canvas_graph',
            label: `f${idx + 1} ${getFuncShortName(gClone)}`,
            badgeColor: gClone.color || '#2563eb',
            graph: gClone,
            piecewiseBundle: null,
            viewXMin: dom.viewXMin,
            viewXMax: dom.viewXMax
          });
        });
      }
    }

    return candidates;
  };

  // =========================================================================
  // 3. 100% 개형 조작형 N축 합성함수 스튜디오 (실시간 핸들 드래그 · 극점 보조선 스냅 · 결과 단독 삽입)
  // =========================================================================
  GraphApp.prototype.initNAxisStudioModal = function () {
    this.initMathToolkitHub();

    const modal = document.getElementById('modalNAxisStudio');
    const btnRail = document.getElementById('btnRailNAxis');
    const btnQuick = document.getElementById('btnQuickNAxis');
    const btnClose = document.getElementById('btnCloseNAxisStudio');
    const btnArchive = document.getElementById('btnNAxisArchiveToBoard');
    const canvas = document.getElementById('nAxisStudioCanvas');
    if (!modal || !canvas) return;

    const ctx = canvas.getContext('2d');
    const LOGICAL_W = 1140;
    const LOGICAL_H = 680;
    const midX = 560;
    const midY = 340;

    let xMin = -3.14, xMax = 3.14;
    let tMin = -3.5, tMax = 3.5;
    let yMin = -4.2, yMax = 4.2;
    let currentX = 0.40;
    let isAutoPlaying = false;
    let playSpeed = 1.0;
    let autoPlayAnimId = null;

    const sliderX = document.getElementById('sliderNAxisX');
    const lblCurX = document.getElementById('lblNAxisCurX');
    const dispX = document.getElementById('dispNAxisX');
    const dispT = document.getElementById('dispNAxisT');
    const dispY = document.getElementById('dispNAxisY');
    const btnAutoPlay = document.getElementById('btnNAxisAutoPlay');
    const btnAutoFit = document.getElementById('btnNAxisAutoFit');
    const btnSwap = document.getElementById('btnNAxisSwap');

    const lblActiveG = document.getElementById('lblNAxisActiveG');
    const lblActiveF = document.getElementById('lblNAxisActiveF');
    const chipsContainerG = document.getElementById('nAxisChipsG');
    const chipsContainerF = document.getElementById('nAxisChipsF');
    const btnAbsG = document.getElementById('btnNAxisAbsG');
    const btnFlipG = document.getElementById('btnNAxisFlipG');
    const btnAbsF = document.getElementById('btnNAxisAbsF');
    const btnFlipF = document.getElementById('btnNAxisFlipF');

    let availableCanvasCandidates = [];

    function makeSlotFromPreset(presetKey) {
      const def = STUDIO_PRESET_DEFS.find(p => p.key === presetKey) || STUDIO_PRESET_DEFS[0];
      return {
        kind: 'preset',
        sourceId: `preset_${def.key}`,
        presetKey: def.key,
        label: def.fullName,
        graph: def.makeGraph(),
        piecewiseBundle: null,
        legacyExpr: null,
        _compiledFn: null,
        outScale: 1.0,
        outShift: 0.0,
        invertOut: false,
        absOut: false,
        viewXMin: def.viewXMin,
        viewXMax: def.viewXMax
      };
    }

    function makeSlotFromCanvasCandidate(cand) {
      const clonedG = cand.graph ? deepCloneJson(cand.graph) : null;
      if (clonedG && typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
        GraphMathEngine.ensureCompiledFunctions([clonedG]);
      }
      const clonedPw = cand.piecewiseBundle ? deepCloneJson(cand.piecewiseBundle) : null;
      if (clonedPw && Array.isArray(clonedPw.graphs) && typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
        GraphMathEngine.ensureCompiledFunctions(clonedPw.graphs);
      }
      return {
        kind: cand.kind || 'canvas_graph',
        sourceId: cand.id,
        presetKey: null,
        label: cand.label || '캔버스 함수',
        graph: clonedG,
        piecewiseBundle: clonedPw,
        legacyExpr: null,
        _compiledFn: null,
        outScale: 1.0,
        outShift: 0.0,
        invertOut: false,
        absOut: false,
        viewXMin: typeof cand.viewXMin === 'number' ? cand.viewXMin : -3.5,
        viewXMax: typeof cand.viewXMax === 'number' ? cand.viewXMax : 3.5
      };
    }

    function cloneSlot(slot) {
      const raw = deepCloneJson({
        kind: slot.kind,
        sourceId: slot.sourceId,
        presetKey: slot.presetKey || null,
        label: slot.label,
        graph: slot.graph,
        piecewiseBundle: slot.piecewiseBundle,
        legacyExpr: slot.legacyExpr || null,
        outScale: typeof slot.outScale === 'number' ? slot.outScale : 1.0,
        outShift: typeof slot.outShift === 'number' ? slot.outShift : 0.0,
        invertOut: Boolean(slot.invertOut),
        absOut: Boolean(slot.absOut),
        viewXMin: typeof slot.viewXMin === 'number' ? slot.viewXMin : -3.2,
        viewXMax: typeof slot.viewXMax === 'number' ? slot.viewXMax : 3.2
      });
      return rehydrateSlot(raw);
    }

    function rehydrateSlot(raw) {
      if (!raw || typeof raw !== 'object') return makeSlotFromPreset('cubic');
      if (raw.graph && typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
        GraphMathEngine.ensureCompiledFunctions([raw.graph]);
      }
      if (raw.piecewiseBundle && Array.isArray(raw.piecewiseBundle.graphs) && typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
        GraphMathEngine.ensureCompiledFunctions(raw.piecewiseBundle.graphs);
      }
      if (raw.kind === 'legacy_expr' && typeof raw.legacyExpr === 'string') {
        raw._compiledFn = compileLegacyExprSafe(raw.legacyExpr);
      } else {
        raw._compiledFn = null;
      }
      if (typeof raw.outScale !== 'number' || !isFinite(raw.outScale)) raw.outScale = 1.0;
      if (typeof raw.outShift !== 'number' || !isFinite(raw.outShift)) raw.outShift = 0.0;
      raw.invertOut = Boolean(raw.invertOut);
      raw.absOut = Boolean(raw.absOut);
      return raw;
    }

    let slotG = makeSlotFromPreset('sin');
    let slotF = makeSlotFromPreset('cubic');

    let outerCriticalFeatures = []; // [{ t, y, label, kind }]
    let criticalSnapPoints = [];    // [{ x, label }]
    let activeSnapLabel = null;
    let activeGuideSnapInfo = null; // 핸들 드래그 중 자석 스냅된 보조선 정보 { axis: 't'|'y'|'x', val, label }

    // --- 슬롯 평가 파이프라인 ---
    function evalSlotRaw(slot, u) {
      if (!slot || !isFinite(u)) return NaN;
      if (slot.kind === 'canvas_piecewise' && slot.piecewiseBundle) {
        return evaluatePiecewiseBundleAt(slot.piecewiseBundle, u);
      }
      if (slot.kind === 'legacy_expr' && typeof slot._compiledFn === 'function') {
        return slot._compiledFn(u);
      }
      if (slot.graph && typeof GraphMathEngine !== 'undefined') {
        return GraphMathEngine.evaluatePipeline(slot.graph, u);
      }
      return NaN;
    }

    function evalSlot(slot, u) {
      let v = evalSlotRaw(slot, u);
      if (typeof v !== 'number' || isNaN(v) || !isFinite(v)) return NaN;
      v = v * (slot.outScale ?? 1.0) + (slot.outShift ?? 0.0);
      if (slot.invertOut) v = -v;
      if (slot.absOut) v = Math.abs(v);
      return v;
    }

    function evalG(x) { return evalSlot(slotG, x); }
    function evalF(t) { return isFinite(t) ? evalSlot(slotF, t) : NaN; }
    function evalComp(x) {
      const t = evalG(x);
      return isFinite(t) ? evalF(t) : NaN;
    }

    // --- 화면 좌표 <-> 수학 좌표 변환 ---
    function toScreenT(t) {
      const margin = 48;
      const w = midX - margin * 2;
      return margin + ((t - tMin) / Math.max(1e-6, tMax - tMin)) * w;
    }
    function fromScreenT(sx) {
      const margin = 48;
      const w = midX - margin * 2;
      return tMin + ((sx - margin) / Math.max(1, w)) * (tMax - tMin);
    }

    function toScreenY(y) {
      const pad = 38;
      const h = midY - pad * 2;
      return pad + ((yMax - y) / Math.max(1e-6, yMax - yMin)) * h;
    }
    function fromScreenY(sy) {
      const pad = 38;
      const h = midY - pad * 2;
      return yMax - ((sy - pad) / Math.max(1, h)) * (yMax - yMin);
    }

    function toScreenLeftX(x) {
      const pad = 38;
      const h = (LOGICAL_H - midY) - pad * 2;
      return midY + pad + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * h;
    }
    function fromScreenLeftX(sy) {
      const pad = 38;
      const h = (LOGICAL_H - midY) - pad * 2;
      return xMin + ((sy - (midY + pad)) / Math.max(1, h)) * (xMax - xMin);
    }

    function toScreenRightX(x) {
      const pad = 48;
      const startX = midX + pad;
      const w = (LOGICAL_W - midX) - pad * 2;
      return startX + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * w;
    }

    // --- 슬롯이 직접 네이티브 핸들 조작 가능한지 여부 ---
    function canUseNativeHandles(slot) {
      if (!slot || !slot.graph || (slot.kind !== 'preset' && slot.kind !== 'canvas_graph')) return false;
      const g = slot.graph;
      if (!Array.isArray(g.handles) || g.handles.length === 0) return false;
      if (g.type === 'general_expr') return false;
      if (slot.absOut || slot.invertOut) return false;
      if (Math.abs((slot.outScale ?? 1.0) - 1.0) > 1e-4 || Math.abs(slot.outShift ?? 0.0) > 1e-4) return false;
      if (g.isFrozen || g.frozenAbsolute || (Array.isArray(g.transforms) && g.transforms.length > 0)) return false;
      // 꺾인선(1st_linear + isAbsolute)은 전용 꼭짓점/기울기 네이티브 핸들 지원
      if (g.isAbsolute && g.type !== '1st_linear') return false;
      return true;
    }

    // --- 겉함수 f(t)의 극점·첨점·구간경계 세로 보조선 후보 추출 ---
    function computeOuterCriticalFeatures() {
      const feats = [];
      const addFeat = (tVal, label, kind = 'ext') => {
        if (!isFinite(tVal) || tVal < tMin - 1e-3 || tVal > tMax + 1e-3) return;
        const yVal = evalF(tVal);
        if (!isFinite(yVal) && kind !== 'boundary') return;
        const dup = feats.find(f => Math.abs(f.t - tVal) < Math.max(0.05, (tMax - tMin) * 0.028));
        if (!dup) {
          feats.push({ t: Number(tVal.toFixed(4)), y: isFinite(yVal) ? yVal : 0, label, kind });
        }
      };

      // 1) 네이티브 핸들 중 극대/극소/꼭짓점/꺾인점 우선 반영 (오차 0.000)
      if (canUseNativeHandles(slotF) && slotF.graph) {
        const g = slotF.graph;
        g.handles.forEach(h => {
          if (!h || h.hidden) return;
          if (h.type === 'max' || h.type === 'min' || h.type === 'vertex' || h.type === 'inflection') {
            const wp = GraphMathEngine.getHandleWorldPos(g, h);
            if (isFinite(wp.x)) {
              addFeat(wp.x, h.name || '특징점', h.type);
            }
          }
        });
      }

      // 2) 구간분할 경계선 반영
      if (slotF.kind === 'canvas_piecewise' && slotF.piecewiseBundle && Array.isArray(slotF.piecewiseBundle.boundaries)) {
        slotF.piecewiseBundle.boundaries.forEach(b => {
          addFeat(b, '구간경계', 'boundary');
        });
      }

      // 3) 수치 탐색으로 극점 및 첨점(|f(t)| 꺾인점 등) 보강
      const N = 360;
      const dt = (tMax - tMin) / N;
      for (let i = 1; i < N; i++) {
        const t0 = tMin + (i - 1) * dt;
        const t1 = tMin + i * dt;
        const t2 = tMin + (i + 1) * dt;
        const y0 = evalF(t0), y1 = evalF(t1), y2 = evalF(t2);
        if (!isFinite(y0) || !isFinite(y1) || !isFinite(y2)) continue;
        const d1 = y1 - y0;
        const d2 = y2 - y1;
        if ((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)) {
          // 포물선 보간으로 극점/첨점 정밀화
          const denom = (y0 - 2 * y1 + y2);
          let tPeak = t1;
          if (Math.abs(denom) > 1e-9) {
            const offset = 0.5 * (y0 - y2) / denom;
            if (Math.abs(offset) <= 1.0) tPeak = t1 + offset * dt;
          }
          addFeat(tPeak, d1 > 0 ? '극대' : '극소', 'ext');
        }
      }

      feats.sort((a, b) => a.t - b.t);
      outerCriticalFeatures = feats;
    }

    // --- 슬라이더·레이저 스크러빙용 입력 x 특징점 자석 스냅 계산 ---
    function computeCriticalSnapPoints() {
      computeOuterCriticalFeatures();
      const pts = [];
      if (0 >= xMin && 0 <= xMax) {
        pts.push({ x: 0, label: 'x = 0' });
      }
      const N = 320;
      const dx = (xMax - xMin) / N;
      const fCritT = outerCriticalFeatures.map(f => f.t);
      if (!fCritT.some(v => Math.abs(v) < 1e-3) && 0 >= tMin && 0 <= tMax) {
        fCritT.push(0);
      }

      for (let i = 1; i < N; i++) {
        const x0 = xMin + (i - 1) * dx;
        const x1 = xMin + i * dx;
        const x2 = xMin + (i + 1) * dx;
        const t0 = evalG(x0), t1 = evalG(x1), t2 = evalG(x2);
        if (!isFinite(t0) || !isFinite(t1) || !isFinite(t2)) continue;

        const d1 = t1 - t0, d2 = t2 - t1;
        if ((d1 > 1e-5 && d2 < -1e-5) || (d1 < -1e-5 && d2 > 1e-5)) {
          const denom = (t0 - 2 * t1 + t2);
          let xExt = x1;
          if (Math.abs(denom) > 1e-9) {
            const off = 0.5 * (t0 - t2) / denom;
            if (Math.abs(off) <= 1.0) xExt = x1 + off * dx;
          }
          pts.push({ x: Number(xExt.toFixed(3)), label: '속함수 극점' });
        }

        for (const ct of fCritT) {
          if ((t0 - ct) * (t1 - ct) <= 0 && Math.abs(t1 - t0) > 1e-6) {
            const ratio = (ct - t0) / (t1 - t0);
            const crossX = x0 + ratio * dx;
            const lbl = Math.abs(ct) < 1e-3 ? 'g(x) = 0' : '겉함수 극점선 도달';
            pts.push({ x: Number(crossX.toFixed(3)), label: lbl });
          }
        }
      }

      const unique = [];
      const minGap = (xMax - xMin) * 0.022;
      for (const p of pts) {
        if (!unique.some(u => Math.abs(u.x - p.x) < minGap)) {
          unique.push(p);
        }
      }
      criticalSnapPoints = unique;
    }

    function applyCriticalSnap(rawX) {
      const snapTol = (xMax - xMin) * 0.016;
      for (const cp of criticalSnapPoints) {
        if (Math.abs(rawX - cp.x) <= snapTol) {
          activeSnapLabel = cp.label;
          return cp.x;
        }
      }
      activeSnapLabel = null;
      return rawX;
    }

    // --- 스마트 시야 맞춤 (속함수 치역 + 겉함수 주요 극점을 동시에 한눈에 수용!) ---
    function autoFitRange(syncDomainFromSlotG = false) {
      if (syncDomainFromSlotG && typeof slotG.viewXMin === 'number' && typeof slotG.viewXMax === 'number' && slotG.viewXMax > slotG.viewXMin + 0.4) {
        xMin = slotG.viewXMin;
        xMax = slotG.viewXMax;
      }
      if (sliderX) {
        sliderX.min = xMin;
        sliderX.max = xMax;
        sliderX.step = Number(((xMax - xMin) / 600).toFixed(4)) || 0.01;
      }

      const n = 200;
      const tCandidates = [];
      for (let i = 0; i <= n; i++) {
        const x = xMin + (i / n) * (xMax - xMin);
        const t = evalG(x);
        if (isFinite(t) && Math.abs(t) < 60) tCandidates.push(t);
      }

      // 겉함수 f(t)의 핸들/기준 정의역도 함께 고려하여 극점이 화면 밖으로 잘리지 않도록 보장
      if (slotF && slotF.graph && Array.isArray(slotF.graph.handles)) {
        slotF.graph.handles.forEach(h => {
          if (!h || h.hidden) return;
          // cos_1period의 2π 주기 핸들처럼 너무 먼 핸들은 제외하고 중심/극점 위주 반영
          if (slotF.graph.type === 'cos_1period' && Math.abs(h.x) > 4.5) return;
          const wp = GraphMathEngine.getHandleWorldPos(slotF.graph, h);
          if (isFinite(wp.x) && Math.abs(wp.x) < 25) tCandidates.push(wp.x);
        });
      } else if (slotF && typeof slotF.viewXMin === 'number' && typeof slotF.viewXMax === 'number') {
        tCandidates.push(slotF.viewXMin * 0.75, slotF.viewXMax * 0.75);
      }

      if (tCandidates.length > 0) {
        tCandidates.sort((a, b) => a - b);
        const minT = tCandidates[Math.floor(tCandidates.length * 0.02)];
        const maxT = tCandidates[Math.min(tCandidates.length - 1, Math.ceil(tCandidates.length * 0.98))];
        const spanT = Math.max(2.0, maxT - minT);
        tMin = Math.floor((minT - spanT * 0.24) * 2) / 2;
        tMax = Math.ceil((maxT + spanT * 0.24) * 2) / 2;
        if (tMin > -0.8) tMin = -1.2;
        if (tMax < 0.8) tMax = 1.2;
      } else {
        tMin = -3.5;
        tMax = 3.5;
      }

      const yVals = [];
      for (let i = 0; i <= n; i++) {
        const t = tMin + (i / n) * (tMax - tMin);
        const y = evalF(t);
        if (isFinite(y) && Math.abs(y) < 65) yVals.push(y);
      }
      for (let i = 0; i <= n; i++) {
        const x = xMin + (i / n) * (xMax - xMin);
        const y = evalComp(x);
        if (isFinite(y) && Math.abs(y) < 65) yVals.push(y);
      }

      if (yVals.length > 0) {
        yVals.sort((a, b) => a - b);
        const minY = yVals[Math.floor(yVals.length * 0.03)];
        const maxY = yVals[Math.min(yVals.length - 1, Math.ceil(yVals.length * 0.97))];
        const spanY = Math.max(2.0, maxY - minY);
        yMin = Math.floor((minY - spanY * 0.22) * 2) / 2;
        yMax = Math.ceil((maxY + spanY * 0.22) * 2) / 2;
        if (yMin > -0.8) yMin = -1.2;
        if (yMax < 0.8) yMax = 1.2;
      } else {
        yMin = -4.2;
        yMax = 4.2;
      }

      currentX = Math.max(xMin, Math.min(xMax, currentX));
      if (sliderX) sliderX.value = currentX;
      computeCriticalSnapPoints();
    }

    // --- 각 슬롯(겉함수 F / 속함수 G)의 화면 조작 핸들 목록 생성 ---
    function getInteractiveHandlesForSlot(slot, role) {
      // role: 'F' (좌상단: u=t 가로, v=y 세로) | 'G' (좌하단 90° 회전: u=x 세로, v=t 가로)
      const uMin = role === 'F' ? tMin : xMin;
      const uMax = role === 'F' ? tMax : xMax;
      const vMin = role === 'F' ? yMin : tMin;
      const vMax = role === 'F' ? yMax : tMax;

      const project = (u, v) => {
        if (role === 'F') {
          return { sx: toScreenT(u), sy: toScreenY(v) };
        }
        return { sx: toScreenT(v), sy: toScreenLeftX(u) };
      };

      const isInsideQuad = (sx, sy) => {
        if (role === 'F') {
          return sx >= 16 && sx <= midX - 16 && sy >= 16 && sy <= midY - 16;
        }
        return sx >= 16 && sx <= midX - 16 && sy >= midY + 16 && sy <= LOGICAL_H - 16;
      };

      const list = [];

      if (canUseNativeHandles(slot)) {
        const g = slot.graph;
        // 꺾인선 (1st_linear + isAbsolute): 꼭짓점(중심 이동) + 오른쪽 날개(기울기)
        if (g.type === '1st_linear' && g.isAbsolute && g.handles.length >= 2) {
          const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
          const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
          const vx = g.handles[0].x + ox;
          const vy = Math.abs(g.handles[0].y) + oy;
          const p0 = project(vx, vy);
          if (isInsideQuad(p0.sx, p0.sy)) {
            list.push({ slotRole: role, mode: 'vline_vertex', idx: 0, u: vx, v: vy, sx: p0.sx, sy: p0.sy, name: '꺾인점' });
          }
          const armU = g.handles[1].x + ox;
          const armV = Math.abs(g.handles[1].y) + oy;
          const p1 = project(armU, armV);
          if (isInsideQuad(p1.sx, p1.sy)) {
            list.push({ slotRole: role, mode: 'vline_arm', idx: 1, u: armU, v: armV, sx: p1.sx, sy: p1.sy, name: '기울기' });
          }
          return list;
        }

        g.handles.forEach((h, idx) => {
          if (!h || h.hidden) return;
          const wp = GraphMathEngine.getHandleWorldPos(g, h);
          const sc = project(wp.x, wp.y);
          if (isInsideQuad(sc.sx, sc.sy)) {
            list.push({
              slotRole: role,
              mode: 'native',
              idx,
              u: wp.x,
              v: wp.y,
              sx: sc.sx,
              sy: sc.sy,
              name: h.name || '조절점'
            });
          }
        });

        // cos_1period에서 주기 핸들(x ≈ 6.28)이 화면 바깥에 있을 때, 화면 안(x = x0, y = y1)에 진폭 조절 핸들 노출!
        if (g.type === 'cos_1period' && g.handles.length >= 2 && !list.some(item => item.idx === 1)) {
          const wp0 = GraphMathEngine.getHandleWorldPos(g, g.handles[0]);
          const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
          const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
          const peakU = wp0.x;
          const peakV = g.handles[1].y + oy;
          const scPeak = project(peakU, peakV);
          if (isInsideQuad(scPeak.sx, scPeak.sy)) {
            list.push({
              slotRole: role,
              mode: 'cos_peak',
              idx: 1,
              u: peakU,
              v: peakV,
              sx: scPeak.sx,
              sy: scPeak.sy,
              name: '진폭 조절',
              extraOx: ox,
              extraOy: oy
            });
          }
        }

        if (list.length > 0) return list;
      }

      // 복합 절댓값(|f(x)|) · 구간분할 · 범용수식 그래프용 자동 치역(최대/최소) 엔벨로프 핸들
      const M = 240;
      let maxU = (uMin + uMax) * 0.5, maxV = -Infinity;
      let minU = (uMin + uMax) * 0.5, minV = Infinity;
      let maxRaw = -Infinity, minRaw = Infinity;

      for (let i = 0; i <= M; i++) {
        const u = uMin + (i / M) * (uMax - uMin);
        const v = evalSlot(slot, u);
        if (!isFinite(v) || v < vMin - (vMax - vMin) * 0.5 || v > vMax + (vMax - vMin) * 0.5) continue;
        if (v > maxV) { maxV = v; maxU = u; }
        if (v < minV) { minV = v; minU = u; }

        let baseVal = evalSlotRaw(slot, u);
        if (isFinite(baseVal)) {
          if (slot.invertOut) baseVal = -baseVal;
          if (slot.absOut) baseVal = Math.abs(baseVal);
          if (baseVal > maxRaw) maxRaw = baseVal;
          if (baseVal < minRaw) minRaw = baseVal;
        }
      }

      if (isFinite(maxV) && isFinite(minV)) {
        const pMax = project(maxU, maxV);
        if (isInsideQuad(pMax.sx, pMax.sy)) {
          list.push({
            slotRole: role,
            mode: 'env_max',
            idx: 0,
            u: maxU,
            v: maxV,
            sx: pMax.sx,
            sy: pMax.sy,
            name: '최댓값 조절',
            anchorMinV: minV,
            rawMin: minRaw,
            rawMax: maxRaw
          });
        }
        if (Math.abs(maxV - minV) > 0.15) {
          const pMin = project(minU, minV);
          if (isInsideQuad(pMin.sx, pMin.sy)) {
            list.push({
              slotRole: role,
              mode: 'env_min',
              idx: 1,
              u: minU,
              v: minV,
              sx: pMin.sx,
              sy: pMin.sy,
              name: '최솟값 조절',
              anchorMaxV: maxV,
              rawMin: minRaw,
              rawMax: maxRaw
            });
          }
        }
      }
      return list;
    }

    // --- 핸들 드래그 시 자석 스냅 & 슬롯 파라미터 실시간 반영 ---
    function applyHandleDragMove(dragState, mx, my, altKey) {
      const role = dragState.slotRole;
      const slot = role === 'F' ? slotF : slotG;
      activeGuideSnapInfo = null;

      let targetU, targetV;
      if (role === 'F') {
        const clampedSx = Math.max(22, Math.min(midX - 22, mx));
        const clampedSy = Math.max(22, Math.min(midY - 22, my));
        targetU = fromScreenT(clampedSx);
        targetV = fromScreenY(clampedSy);

        if (!altKey) {
          const snapTolT = Math.abs(fromScreenT(10) - fromScreenT(0));
          const snapTolY = Math.abs(fromScreenY(0) - fromScreenY(9));
          if (Math.abs(targetU) <= snapTolT) {
            targetU = 0;
            activeGuideSnapInfo = { quad: 'F', axis: 't', val: 0, label: 't = 0 축 일치' };
          }
          if (Math.abs(targetV) <= snapTolY) {
            targetV = 0;
            activeGuideSnapInfo = { quad: 'F', axis: 'y', val: 0, label: 'x축(y=0) 접함' };
          }
        }
      } else {
        // 속함수 G (90° 회전): 가로 mx -> 출력 t(targetV), 세로 my -> 입력 x(targetU)
        const clampedSx = Math.max(22, Math.min(midX - 22, mx));
        const clampedSy = Math.max(midY + 22, Math.min(LOGICAL_H - 22, my));
        targetV = fromScreenT(clampedSx);
        targetU = fromScreenLeftX(clampedSy);

        if (!altKey) {
          const snapTolT = Math.abs(fromScreenT(11) - fromScreenT(0));
          const snapTolX = Math.abs(fromScreenLeftX(midY + 47) - fromScreenLeftX(midY + 38));

          // 1순위: 위쪽 겉함수 극점/첨점 세로 보조선에 자석 스냅!
          let bestFeat = null;
          let bestDiff = snapTolT;
          for (const feat of outerCriticalFeatures) {
            const d = Math.abs(targetV - feat.t);
            if (d <= bestDiff) {
              bestDiff = d;
              bestFeat = feat;
            }
          }
          if (bestFeat) {
            targetV = bestFeat.t;
            activeGuideSnapInfo = {
              quad: 'G',
              axis: 't',
              val: bestFeat.t,
              label: `겉함수 ${bestFeat.label}선 일치 (t = ${bestFeat.t.toFixed(2)})`
            };
          } else if (Math.abs(targetV) <= snapTolT * 0.85) {
            targetV = 0;
            activeGuideSnapInfo = { quad: 'G', axis: 't', val: 0, label: 't = 0 축 일치' };
          }

          if (Math.abs(targetU) <= snapTolX) {
            targetU = 0;
          }
        }
      }

      if (dragState.mode === 'native' && slot.graph) {
        const g = slot.graph;
        let baseU = GraphMathEngine.worldXToBaseX(g, targetU);
        const fzOy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
        let baseV = targetV - fzOy;
        if (g.frozenInvertV) baseV = -baseV;
        if (g.type === '1st_linear' && dragState.idx === 1 && g.handles[0]) {
          let dxLin = baseU - g.handles[0].x;
          if (Math.abs(dxLin) < 0.25) dxLin = dxLin >= 0 ? 0.25 : -0.25;
          baseU = g.handles[0].x + dxLin;
          GraphMathEngine.dragHandle(g.handles, g.type, dragState.idx, baseU, baseV, true, false);
        } else {
          GraphMathEngine.dragHandle(g.handles, g.type, dragState.idx, baseU, baseV, Boolean(altKey), false);
        }
      } else if (dragState.mode === 'cos_peak' && slot.graph && slot.graph.handles[1]) {
        const oy = dragState.extraOy || 0;
        slot.graph.handles[1].y = targetV - oy;
      } else if (dragState.mode === 'vline_vertex' && slot.graph) {
        const g = slot.graph;
        const dxArm = g.handles[1].x - g.handles[0].x;
        const dyArm = g.handles[1].y - g.handles[0].y;
        g.handles[0].x = 0;
        g.handles[0].y = 0;
        g.handles[1].x = dxArm;
        g.handles[1].y = dyArm;
        g.freezeOffset = { x: targetU, y: targetV };
      } else if (dragState.mode === 'vline_arm' && slot.graph) {
        const g = slot.graph;
        const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
        const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
        let dx = targetU - ox;
        if (Math.abs(dx) < 0.25) dx = dx >= 0 ? 0.25 : -0.25;
        const dy = Math.max(0.2, targetV - oy);
        g.handles[1].x = dx;
        g.handles[1].y = dy;
      } else if (dragState.mode === 'env_max' || dragState.mode === 'env_min') {
        const rMin = dragState.rawMin;
        const rMax = dragState.rawMax;
        if (isFinite(rMin) && isFinite(rMax) && (rMax - rMin) > 1e-4 && !slot.absOut && !slot.invertOut) {
          if (dragState.mode === 'env_max') {
            const fixedMin = dragState.anchorMinV;
            const newMax = Math.max(fixedMin + 0.25, targetV);
            const scale = (newMax - fixedMin) / (rMax - rMin);
            const shift = fixedMin - scale * rMin;
            slot.outScale = Math.max(0.05, Math.min(20, scale));
            slot.outShift = Math.max(-30, Math.min(30, shift));
          } else {
            const fixedMax = dragState.anchorMaxV;
            const newMin = Math.min(fixedMax - 0.25, targetV);
            const scale = (fixedMax - newMin) / (rMax - rMin);
            const shift = newMin - scale * rMin;
            slot.outScale = Math.max(0.05, Math.min(20, scale));
            slot.outShift = Math.max(-30, Math.min(30, shift));
          }
        } else {
          // absOut / invertOut 활성 시에는 전체 높이 스케일 또는 시프트로 대응
          const deltaV = targetV - dragState.initV;
          slot.outShift = (dragState.initOutShift || 0) + deltaV;
        }
      }

      if (role === 'F') {
        computeOuterCriticalFeatures();
      }
    }

    // --- 불연속 안전 곡선 드로잉 ---
    function drawSafeCurve(points, maxJumpPx = 240) {
      ctx.beginPath();
      let started = false;
      let prevSx = 0, prevSy = 0;
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (!pt || !isFinite(pt.sx) || !isFinite(pt.sy)) {
          started = false;
          continue;
        }
        if (started && Math.hypot(pt.sx - prevSx, pt.sy - prevSy) > maxJumpPx) {
          started = false;
        }
        if (!started) {
          ctx.moveTo(pt.sx, pt.sy);
          started = true;
        } else {
          ctx.lineTo(pt.sx, pt.sy);
        }
        prevSx = pt.sx;
        prevSy = pt.sy;
      }
      ctx.stroke();
    }

    function drawArrowHead(x, y, dirX, dirY, size, color) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(dirY, dirX));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size * 0.55);
      ctx.lineTo(-size * 0.78, 0);
      ctx.lineTo(-size, size * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function getSlotDisplayTitle(slot) {
      if (!slot) return '함수';
      let name = slot.label || '함수';
      if (slot.invertOut) name = `-${name}`;
      if (slot.absOut) name = `|${name}|`;
      return name;
    }

    let hoveredHandleInfo = null;
    let draggingHandleState = null;

    // --- 메인 4분할 스튜디오 렌더링 ---
    function renderStudio() {
      if (!modal.classList.contains('show')) return;

      const dpr = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1));
      const targetBufW = Math.round(LOGICAL_W * dpr);
      const targetBufH = Math.round(LOGICAL_H * dpr);
      if (canvas.width !== targetBufW || canvas.height !== targetBufH) {
        canvas.width = targetBufW;
        canvas.height = targetBufH;
      }

      const isLight = document.body.classList.contains('theme-light');
      const pal = isLight ? {
        bg: '#ffffff',
        quadBg3: '#f8fafc',
        divider: '#cbd5e1',
        axis: 'rgba(30, 41, 59, 0.48)',
        outerColor: '#dc2626',
        innerColor: '#2563eb',
        compColor: '#7c3aed',
        compGhost: 'rgba(124, 58, 237, 0.22)',
        guideLine: 'rgba(217, 119, 6, 0.34)',
        guideLineSnap: '#d97706',
        laserV: '#d97706',
        laserH: '#059669',
        textMain: '#0f172a',
        textMuted: '#64748b',
        dotStroke: '#ffffff',
        handleFill: '#ffffff'
      } : {
        bg: '#0b1520',
        quadBg3: 'rgba(0, 210, 211, 0.035)',
        divider: 'rgba(148, 163, 184, 0.25)',
        axis: 'rgba(255, 255, 255, 0.42)',
        outerColor: '#ff6b6b',
        innerColor: '#54a0ff',
        compColor: '#00d2d3',
        compGhost: 'rgba(0, 210, 211, 0.23)',
        guideLine: 'rgba(254, 202, 87, 0.28)',
        guideLineSnap: '#feca57',
        laserV: '#feca57',
        laserH: '#00d2d3',
        textMain: '#f8fafc',
        textMuted: '#94a3b8',
        dotStroke: '#0f172a',
        handleFill: '#0f172a'
      };

      if (dispX) dispX.style.color = pal.innerColor;
      if (dispT) dispT.style.color = pal.laserV;
      if (dispY) dispY.style.color = pal.compColor;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // 우상단 합성함수 배경 하이라이트
      ctx.fillStyle = pal.quadBg3;
      ctx.fillRect(midX, 0, LOGICAL_W - midX, midY);

      // 4분할 십자 구분선
      ctx.strokeStyle = pal.divider;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(midX, 10);
      ctx.lineTo(midX, LOGICAL_H - 10);
      ctx.moveTo(10, midY);
      ctx.lineTo(LOGICAL_W - 10, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 🌟 [핵심 시각 가이드]: 좌상단 겉함수 극점/첨점에서 좌하단 속함수 치역 영역으로 내려오는 세로 매칭 보조선!
      for (const feat of outerCriticalFeatures) {
        const gx = toScreenT(feat.t);
        if (gx < 20 || gx > midX - 20) continue;
        const isSnappedHere = Boolean(
          activeGuideSnapInfo &&
          activeGuideSnapInfo.axis === 't' &&
          Math.abs(activeGuideSnapInfo.val - feat.t) < 1e-3
        );
        ctx.save();
        ctx.strokeStyle = isSnappedHere ? pal.guideLineSnap : pal.guideLine;
        ctx.lineWidth = isSnappedHere ? 2.2 : 1.25;
        ctx.setLineDash(isSnappedHere ? [6, 3] : [4, 5]);
        const startSy = isFinite(feat.y) ? Math.max(18, Math.min(midY - 14, toScreenY(feat.y))) : 24;
        ctx.beginPath();
        ctx.moveTo(gx, startSy);
        ctx.lineTo(gx, LOGICAL_H - 18);
        ctx.stroke();
        ctx.restore();
      }

      const topOriginY = Math.max(36, Math.min(midY - 28, toScreenY(0)));
      const topOriginX = Math.max(42, Math.min(midX - 32, toScreenT(0)));
      const steps = 420;

      // ====================================================================
      // 1. 좌상단 (Quadrant 1): 겉함수 y = f(t)
      // ====================================================================
      ctx.save();
      ctx.beginPath();
      ctx.rect(8, 8, midX - 16, midY - 16);
      ctx.clip();

      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toScreenT(tMin) - 6, topOriginY);
      ctx.lineTo(toScreenT(tMax) + 12, topOriginY);
      ctx.moveTo(topOriginX, toScreenY(yMin) + 6);
      ctx.lineTo(topOriginX, toScreenY(yMax) - 10);
      ctx.stroke();
      drawArrowHead(toScreenT(tMax) + 14, topOriginY, 1, 0, 7, pal.axis);
      drawArrowHead(topOriginX, toScreenY(yMax) - 12, 0, -1, 7, pal.axis);

      const ptsF = [];
      for (let i = 0; i <= steps; i++) {
        const t = tMin + (i / steps) * (tMax - tMin);
        const y = evalF(t);
        ptsF.push(isFinite(y) ? { sx: toScreenT(t), sy: toScreenY(y) } : null);
      }
      ctx.strokeStyle = pal.outerColor;
      ctx.lineWidth = 2.7;
      drawSafeCurve(ptsF);
      ctx.restore();

      ctx.font = 'bold 12.5px Pretendard, system-ui, sans-serif';
      ctx.fillStyle = pal.outerColor;
      ctx.fillText(`① 겉함수 y = f(t)  [${getSlotDisplayTitle(slotF)}]`, 20, 24);
      ctx.font = 'italic bold 13px "STIX Two Text", "Times New Roman", serif';
      ctx.fillStyle = pal.textMuted;
      ctx.fillText('t', toScreenT(tMax) + 4, topOriginY + 15);
      ctx.fillText('y', topOriginX + 7, toScreenY(yMax) - 2);

      // ====================================================================
      // 2. 좌하단 (Quadrant 2): 90° 회전 속함수 t = g(x)
      // ====================================================================
      const botOriginX = topOriginX;
      const botOriginY = Math.max(midY + 34, Math.min(LOGICAL_H - 28, toScreenLeftX(0)));

      ctx.save();
      ctx.beginPath();
      ctx.rect(8, midY + 8, midX - 16, LOGICAL_H - midY - 16);
      ctx.clip();

      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toScreenT(tMin) - 6, botOriginY);
      ctx.lineTo(toScreenT(tMax) + 12, botOriginY);
      ctx.moveTo(botOriginX, toScreenLeftX(xMin) - 6);
      ctx.lineTo(botOriginX, toScreenLeftX(xMax) + 12);
      ctx.stroke();
      drawArrowHead(toScreenT(tMax) + 14, botOriginY, 1, 0, 7, pal.axis);
      drawArrowHead(botOriginX, toScreenLeftX(xMax) + 14, 0, 1, 7, pal.axis);

      const ptsG = [];
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin);
        const t = evalG(x);
        ptsG.push(isFinite(t) ? { sx: toScreenT(t), sy: toScreenLeftX(x) } : null);
      }
      ctx.strokeStyle = pal.innerColor;
      ctx.lineWidth = 2.7;
      drawSafeCurve(ptsG);
      ctx.restore();

      ctx.font = 'bold 12.5px Pretendard, system-ui, sans-serif';
      ctx.fillStyle = pal.innerColor;
      ctx.fillText(`② 속함수 (90° 회전) t = g(x)  [${getSlotDisplayTitle(slotG)}]`, 20, midY + 23);
      ctx.font = 'bold 11px Pretendard, system-ui, sans-serif';
      ctx.fillStyle = pal.laserV;
      ctx.fillText('치역 t →', toScreenT(tMax) - 38, botOriginY - 7);
      ctx.fillStyle = pal.innerColor;
      ctx.fillText('입력 x ↓', botOriginX + 7, LOGICAL_H - 12);

      // ====================================================================
      // 3. 우상단 (Quadrant 3): 최종 합성함수 y = f(g(x))
      // ====================================================================
      const rOriginX = Math.max(midX + 40, Math.min(LOGICAL_W - 34, toScreenRightX(0)));
      const rOriginY = topOriginY;

      ctx.save();
      ctx.beginPath();
      ctx.rect(midX + 8, 8, LOGICAL_W - midX - 16, midY - 16);
      ctx.clip();

      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toScreenRightX(xMin) - 6, rOriginY);
      ctx.lineTo(toScreenRightX(xMax) + 12, rOriginY);
      ctx.moveTo(rOriginX, toScreenY(yMin) + 6);
      ctx.lineTo(rOriginX, toScreenY(yMax) - 10);
      ctx.stroke();
      drawArrowHead(toScreenRightX(xMax) + 14, rOriginY, 1, 0, 7, pal.axis);
      drawArrowHead(rOriginX, toScreenY(yMax) - 12, 0, -1, 7, pal.axis);

      const compSteps = 480;
      const ptsCompFull = [];
      const ptsCompActive = [];
      for (let i = 0; i <= compSteps; i++) {
        const x = xMin + (i / compSteps) * (xMax - xMin);
        const y = evalComp(x);
        const pt = isFinite(y) ? { sx: toScreenRightX(x), sy: toScreenY(y) } : null;
        ptsCompFull.push(pt);
        if (x <= currentX + 1e-4) {
          ptsCompActive.push(pt);
        }
      }

      if (isAutoPlaying) {
        ctx.strokeStyle = pal.compGhost;
        ctx.lineWidth = 2.2;
        drawSafeCurve(ptsCompFull);
        ctx.strokeStyle = pal.compColor;
        ctx.lineWidth = 3.2;
        drawSafeCurve(ptsCompActive);
      } else {
        ctx.strokeStyle = pal.compColor;
        ctx.lineWidth = 3.1;
        drawSafeCurve(ptsCompFull);
      }
      ctx.restore();

      ctx.font = 'bold 13px Pretendard, system-ui, sans-serif';
      ctx.fillStyle = pal.compColor;
      ctx.fillText('③ 최종 합성함수: y = f(g(x))', midX + 20, 24);
      ctx.font = 'italic bold 13px "STIX Two Text", "Times New Roman", serif';
      ctx.fillStyle = pal.textMuted;
      ctx.fillText('x', toScreenRightX(xMax) + 4, rOriginY + 15);
      ctx.fillText('y', rOriginX + 7, toScreenY(yMax) - 2);

      // ====================================================================
      // 4. 1:1 직각 레이저 추적선 & 이동 점 렌더링
      // ====================================================================
      const tVal = evalG(currentX);
      const yVal = evalF(tVal);

      if (isFinite(tVal) && isFinite(yVal) && !draggingHandleState) {
        const sxT = toScreenT(tVal);
        const syLeftX = toScreenLeftX(currentX);
        const syTopY = toScreenY(yVal);
        const sxRightX = toScreenRightX(currentX);

        ctx.save();
        ctx.beginPath();
        ctx.rect(8, 8, LOGICAL_W - 16, LOGICAL_H - 16);
        ctx.clip();

        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.9;

        // 속함수 점 -> 겉함수 점 수직 레이저
        ctx.strokeStyle = pal.laserV;
        ctx.beginPath();
        ctx.moveTo(botOriginX, syLeftX);
        ctx.lineTo(sxT, syLeftX);
        ctx.lineTo(sxT, syTopY);
        ctx.stroke();

        // 겉함수 점 -> 합성함수 점 수평 레이저
        ctx.strokeStyle = pal.laserH;
        ctx.beginPath();
        ctx.moveTo(sxT, syTopY);
        ctx.lineTo(sxRightX, syTopY);
        ctx.lineTo(sxRightX, rOriginY);
        ctx.stroke();
        ctx.setLineDash([]);

        const drawTrackDot = (px, py, color, r = 5.5) => {
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = pal.dotStroke;
          ctx.stroke();
        };

        drawTrackDot(botOriginX, syLeftX, pal.innerColor, 4.5);
        drawTrackDot(sxT, syLeftX, pal.laserV, 6);
        drawTrackDot(sxT, syTopY, pal.outerColor, 6);
        drawTrackDot(sxRightX, syTopY, pal.compColor, 7);

        if (activeSnapLabel) {
          const badgeText = `🧲 ${activeSnapLabel}  (x=${currentX.toFixed(2)})`;
          ctx.font = 'bold 11.5px Pretendard, system-ui, sans-serif';
          const tw = ctx.measureText(badgeText).width;
          const bw = tw + 18;
          const bh = 23;
          const bx = Math.max(midX + 14, Math.min(LOGICAL_W - bw - 14, sxRightX - bw / 2));
          const by = Math.max(32, Math.min(midY - bh - 10, syTopY - 32));
          ctx.fillStyle = isLight ? 'rgba(254, 243, 199, 0.96)' : 'rgba(30, 41, 59, 0.94)';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 11);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = isLight ? '#b45309' : '#fde68a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, bx + bw / 2, by + bh / 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
        ctx.restore();
      }

      // ====================================================================
      // 5. 개형 직접 조작 핸들 렌더링 (겉함수 F & 속함수 G)
      // ====================================================================
      if (!isAutoPlaying) {
        const handlesF = getInteractiveHandlesForSlot(slotF, 'F');
        const handlesG = getInteractiveHandlesForSlot(slotG, 'G');
        const allHandles = [...handlesF, ...handlesG];

        allHandles.forEach(h => {
          const isDraggingThis = Boolean(
            draggingHandleState &&
            draggingHandleState.slotRole === h.slotRole &&
            draggingHandleState.idx === h.idx &&
            draggingHandleState.mode === h.mode
          );
          const isHoveredThis = Boolean(
            !draggingHandleState &&
            hoveredHandleInfo &&
            hoveredHandleInfo.slotRole === h.slotRole &&
            hoveredHandleInfo.idx === h.idx &&
            hoveredHandleInfo.mode === h.mode
          );
          const strokeCol = h.slotRole === 'F' ? pal.outerColor : pal.innerColor;
          const rad = isDraggingThis ? 7.2 : (isHoveredThis ? 6.5 : 5.2);

          ctx.save();
          if (isDraggingThis || isHoveredThis) {
            ctx.beginPath();
            ctx.arc(h.sx, h.sy, rad + 5, 0, Math.PI * 2);
            ctx.fillStyle = h.slotRole === 'F' ? 'rgba(239, 68, 68, 0.22)' : 'rgba(59, 130, 246, 0.24)';
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(h.sx, h.sy, rad, 0, Math.PI * 2);
          ctx.fillStyle = isDraggingThis ? strokeCol : pal.handleFill;
          ctx.fill();
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = strokeCol;
          ctx.stroke();

          if (isDraggingThis || isHoveredThis) {
            const tip = h.name || '조절점';
            ctx.font = 'bold 11px Pretendard, system-ui, sans-serif';
            const tw = ctx.measureText(tip).width + 12;
            const bx = Math.max(14, Math.min(midX - tw - 14, h.sx - tw / 2));
            const by = Math.max(14, h.sy - 26);
            ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.88)' : 'rgba(15, 23, 42, 0.92)';
            ctx.beginPath();
            ctx.roundRect(bx, by, tw, 19, 6);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tip, bx + tw / 2, by + 9.5);
          }
          ctx.restore();
        });

        // 핸들 드래그 중 보조선 스냅 알림 배지
        if (draggingHandleState && activeGuideSnapInfo) {
          ctx.save();
          const msg = `🧲 ${activeGuideSnapInfo.label}`;
          ctx.font = 'bold 12px Pretendard, system-ui, sans-serif';
          const tw = ctx.measureText(msg).width + 22;
          const bx = Math.max(18, Math.min(midX - tw - 18, (midX - tw) / 2));
          const by = activeGuideSnapInfo.quad === 'G' ? (midY + 14) : (midY - 34);
          ctx.fillStyle = isLight ? '#fef3c7' : 'rgba(30, 41, 59, 0.95)';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(bx, by, tw, 24, 12);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = isLight ? '#b45309' : '#fde68a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(msg, bx + tw / 2, by + 12);
          ctx.restore();
        }
      }

      ctx.restore();

      const snapSuffix = activeSnapLabel ? ` (${activeSnapLabel})` : '';
      if (lblCurX) lblCurX.textContent = `x = ${currentX.toFixed(2)}${snapSuffix}`;
      if (dispX) dispX.textContent = currentX.toFixed(2);
      if (dispT) dispT.textContent = isFinite(tVal) ? tVal.toFixed(2) : '-';
      if (dispY) dispY.textContent = isFinite(yVal) ? yVal.toFixed(2) : '-';
    }

    // --- [📌 캔버스 삽입 전용]: 최종 합성함수 y = f(g(x)) 단독 대형 고화질 그래프 렌더링 ---
    const renderCompositeResultCardDataUrl = () => {
      const cardLogicalW = 920;
      const cardLogicalH = 640;
      const dpr = 2;
      const offCv = document.createElement('canvas');
      offCv.width = cardLogicalW * dpr;
      offCv.height = cardLogicalH * dpr;
      const octx = offCv.getContext('2d');

      const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || null;
      const isLight = curTheme ? (curTheme.isLight !== false) : document.body.classList.contains('theme-light');
      const bgCol = this.isMonochromeMode ? '#ffffff' : ((curTheme && curTheme.bg) ? curTheme.bg : (isLight ? '#ffffff' : '#0f1e19'));
      const axisCol = this.isMonochromeMode ? '#0f172a' : (isLight ? '#1e293b' : 'rgba(248, 250, 252, 0.86)');
      const curveCol = this.isMonochromeMode ? '#0f172a' : (isLight ? '#6d28d9' : '#2dd4bf');
      const badgeBg = isLight ? 'rgba(109, 40, 217, 0.08)' : 'rgba(45, 212, 191, 0.14)';
      const badgeBorder = isLight ? 'rgba(109, 40, 217, 0.24)' : 'rgba(45, 212, 191, 0.35)';

      octx.save();
      octx.scale(dpr, dpr);
      octx.fillStyle = bgCol;
      octx.fillRect(0, 0, cardLogicalW, cardLogicalH);

      const padX = 58;
      const padY = 52;
      const plotW = cardLogicalW - padX * 2;
      const plotH = cardLogicalH - padY * 2;

      // 결과 그래프 단독 시야를 합성함수 치역 기준으로 보기 좋게 타이트 보정
      let resYMin = yMin, resYMax = yMax;
      const sampleYs = [];
      for (let i = 0; i <= 300; i++) {
        const sxVal = xMin + (i / 300) * (xMax - xMin);
        const syVal = evalComp(sxVal);
        if (isFinite(syVal) && Math.abs(syVal) < 80) sampleYs.push(syVal);
      }
      if (sampleYs.length > 4) {
        sampleYs.sort((a, b) => a - b);
        const lo = sampleYs[Math.floor(sampleYs.length * 0.02)];
        const hi = sampleYs[Math.min(sampleYs.length - 1, Math.ceil(sampleYs.length * 0.98))];
        const sp = Math.max(1.6, hi - lo);
        resYMin = Math.min(0, lo) - sp * 0.20;
        resYMax = Math.max(0, hi) + sp * 0.20;
        if (resYMax - resYMin < 2.0) {
          const mid = (resYMin + resYMax) * 0.5;
          resYMin = mid - 1.2;
          resYMax = mid + 1.2;
        }
      }

      const mapX = (x) => padX + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * plotW;
      const mapY = (y) => padY + ((resYMax - y) / Math.max(1e-6, resYMax - resYMin)) * plotH;

      const ox = Math.max(padX + 10, Math.min(cardLogicalW - padX - 10, mapX(0)));
      const oy = Math.max(padY + 10, Math.min(cardLogicalH - padY - 10, mapY(0)));

      // 좌표축 렌더링
      const showX = this.showXAxis !== false;
      const showY = this.showYAxis !== false;
      octx.strokeStyle = axisCol;
      octx.lineWidth = 2.0;
      octx.beginPath();
      if (showX) {
        octx.moveTo(padX - 14, oy);
        octx.lineTo(cardLogicalW - padX + 16, oy);
      }
      if (showY) {
        octx.moveTo(ox, cardLogicalH - padY + 14);
        octx.lineTo(ox, padY - 16);
      }
      octx.stroke();

      const drawCardArrow = (ax, ay, dx, dy) => {
        octx.save();
        octx.fillStyle = axisCol;
        octx.translate(ax, ay);
        octx.rotate(Math.atan2(dy, dx));
        octx.beginPath();
        octx.moveTo(0, 0);
        octx.lineTo(-10, -5.2);
        octx.lineTo(-7.8, 0);
        octx.lineTo(-10, 5.2);
        octx.closePath();
        octx.fill();
        octx.restore();
      };
      if (showX) drawCardArrow(cardLogicalW - padX + 18, oy, 1, 0);
      if (showY) drawCardArrow(ox, padY - 18, 0, -1);

      octx.fillStyle = axisCol;
      octx.font = 'italic 600 20px "STIX Two Text", "Times New Roman", serif';
      if (showX) octx.fillText('x', cardLogicalW - padX + 12, oy + 24);
      if (showY) octx.fillText('y', ox + 11, padY - 10);
      if (showX && showY && xMin <= 0 && xMax >= 0 && resYMin <= 0 && resYMax >= 0) {
        octx.font = 'italic 500 17px "STIX Two Text", "Times New Roman", serif';
        octx.fillText('O', ox - 20, oy + 21);
      }

      // 고해상도 1200스텝 최종 합성함수 곡선
      octx.save();
      octx.beginPath();
      octx.rect(padX - 12, padY - 12, plotW + 24, plotH + 24);
      octx.clip();
      octx.strokeStyle = curveCol;
      octx.lineWidth = 3.8;
      octx.lineJoin = 'round';
      octx.lineCap = 'round';
      octx.beginPath();
      const N = 1200;
      let started = false;
      let prevPx = 0, prevPy = 0;
      for (let i = 0; i <= N; i++) {
        const x = xMin + (i / N) * (xMax - xMin);
        const y = evalComp(x);
        if (!isFinite(y)) {
          started = false;
          continue;
        }
        const px = mapX(x);
        const py = mapY(y);
        if (started && Math.hypot(px - prevPx, py - prevPy) > 220) {
          started = false;
        }
        if (!started) {
          octx.moveTo(px, py);
          started = true;
        } else {
          octx.lineTo(px, py);
        }
        prevPx = px;
        prevPy = py;
      }
      octx.stroke();
      octx.restore();

      // 좌상단 미니멀 수식 라벨 배지
      if (!this.isMonochromeMode) {
        const tagText = 'y = f(g(x))';
        octx.font = 'italic 700 17px "STIX Two Text", "Times New Roman", serif';
        const tw = octx.measureText(tagText).width + 24;
        octx.fillStyle = badgeBg;
        octx.strokeStyle = badgeBorder;
        octx.lineWidth = 1.3;
        octx.beginPath();
        octx.roundRect(18, 16, tw, 30, 8);
        octx.fill();
        octx.stroke();
        octx.fillStyle = curveCol;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillText(tagText, 18 + tw / 2, 31);
      }

      octx.restore();
      return {
        dataUrl: offCv.toDataURL('image/png'),
        offCanvas: offCv,
        aspect: cardLogicalH / cardLogicalW
      };
    };

    // --- 우하단 비주얼 슬롯 칩 UI 동기화 ---
    function syncSlotControllerUI() {
      if (lblActiveG) lblActiveG.textContent = getSlotDisplayTitle(slotG);
      if (lblActiveF) lblActiveF.textContent = getSlotDisplayTitle(slotF);
      if (btnAbsG) btnAbsG.classList.toggle('active', Boolean(slotG.absOut));
      if (btnFlipG) btnFlipG.classList.toggle('active', Boolean(slotG.invertOut));
      if (btnAbsF) btnAbsF.classList.toggle('active', Boolean(slotF.absOut));
      if (btnFlipF) btnFlipF.classList.toggle('active', Boolean(slotF.invertOut));

      const renderChipsFor = (container, slot, isInner) => {
        if (!container) return;
        container.innerHTML = '';

        // 1) 현재 캔버스에서 감지된 그래프 칩 (최우선 배치)
        availableCanvasCandidates.forEach(cand => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'n-axis-chip n-axis-canvas-chip' + (slot.sourceId === cand.id ? ' active' : '');
          btn.textContent = `📌 ${cand.label}`;
          btn.addEventListener('click', () => {
            const nextSlot = makeSlotFromCanvasCandidate(cand);
            if (isInner) {
              slotG = nextSlot;
              autoFitRange(true);
            } else {
              slotF = nextSlot;
              autoFitRange(false);
            }
            syncSlotControllerUI();
            renderStudio();
          });
          container.appendChild(btn);
        });

        // 2) 대표 기본 개형 칩
        STUDIO_PRESET_DEFS.forEach(def => {
          const pid = `preset_${def.key}`;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'n-axis-chip' + (slot.sourceId === pid ? ' active' : '');
          btn.textContent = def.chipLabel;
          btn.title = `${def.fullName} 소환 후 그래프 위의 점을 드래그해 조절하세요`;
          btn.addEventListener('click', () => {
            const nextSlot = makeSlotFromPreset(def.key);
            if (isInner) {
              slotG = nextSlot;
              autoFitRange(true);
            } else {
              slotF = nextSlot;
              autoFitRange(false);
            }
            syncSlotControllerUI();
            renderStudio();
          });
          container.appendChild(btn);
        });
      };

      renderChipsFor(chipsContainerG, slotG, true);
      renderChipsFor(chipsContainerF, slotF, false);
    }

    function loopAutoPlay() {
      if (!isAutoPlaying) return;
      const span = Math.max(0.5, xMax - xMin);
      const baseStep = span / 420;
      currentX += baseStep * playSpeed;
      activeSnapLabel = null;
      if (currentX > xMax) currentX = xMin;
      if (sliderX) sliderX.value = currentX;
      renderStudio();
      autoPlayAnimId = requestAnimationFrame(loopAutoPlay);
    }

    const stopAutoPlay = () => {
      isAutoPlaying = false;
      if (autoPlayAnimId) {
        cancelAnimationFrame(autoPlayAnimId);
        autoPlayAnimId = null;
      }
      if (btnAutoPlay) {
        btnAutoPlay.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align:-2px;margin-right:3px;"><polygon points="5 3 19 12 5 21 5 3" /></svg>자동 순항`;
      }
    };

    // --- 상태 직렬화 / 역직렬화 (칠판 카드 재진입 & 클라우드/파일 저장 100% 호환) ---
    const getNAxisStudioState = () => {
      const cleanSlot = (s) => ({
        kind: s.kind,
        sourceId: s.sourceId,
        presetKey: s.presetKey || null,
        label: s.label,
        graph: s.graph ? deepCloneJson(s.graph) : null,
        piecewiseBundle: s.piecewiseBundle ? deepCloneJson(s.piecewiseBundle) : null,
        legacyExpr: s.legacyExpr || null,
        outScale: s.outScale ?? 1.0,
        outShift: s.outShift ?? 0.0,
        invertOut: Boolean(s.invertOut),
        absOut: Boolean(s.absOut),
        viewXMin: s.viewXMin,
        viewXMax: s.viewXMax
      });
      return {
        version: 2,
        slotG: cleanSlot(slotG),
        slotF: cleanSlot(slotF),
        currentX: typeof currentX === 'number' ? currentX : 0.4,
        xMin,
        xMax,
        tMin,
        tMax,
        yMin,
        yMax,
        playSpeed: typeof playSpeed === 'number' ? playSpeed : 1.0,
        activeSnapLabel: activeSnapLabel || null
      };
    };

    const applyNAxisStudioState = (st) => {
      if (!st || typeof st !== 'object') return false;

      if (st.slotG && st.slotF) {
        slotG = rehydrateSlot(deepCloneJson(st.slotG));
        slotF = rehydrateSlot(deepCloneJson(st.slotF));
      } else if (typeof st.exprG === 'string' || typeof st.exprF === 'string') {
        // 구버전(v55 이하) 수식 보관 카드 하위 호환
        const eg = typeof st.exprG === 'string' ? st.exprG : '2 * sin(x)';
        const ef = typeof st.exprF === 'string' ? st.exprF : 't^3 - 3*t';
        slotG = rehydrateSlot({
          kind: 'legacy_expr',
          sourceId: 'legacy_g',
          label: eg,
          graph: null,
          piecewiseBundle: null,
          legacyExpr: eg,
          outScale: 1.0,
          outShift: 0.0,
          invertOut: false,
          absOut: false,
          viewXMin: typeof st.xMin === 'number' ? st.xMin : -3.2,
          viewXMax: typeof st.xMax === 'number' ? st.xMax : 3.2
        });
        slotF = rehydrateSlot({
          kind: 'legacy_expr',
          sourceId: 'legacy_f',
          label: ef,
          graph: null,
          piecewiseBundle: null,
          legacyExpr: ef,
          outScale: 1.0,
          outShift: 0.0,
          invertOut: false,
          absOut: false,
          viewXMin: -3.5,
          viewXMax: 3.5
        });
      }

      if (typeof st.xMin === 'number' && typeof st.xMax === 'number' && st.xMax > st.xMin) {
        xMin = st.xMin;
        xMax = st.xMax;
      }
      if (sliderX) {
        sliderX.min = xMin;
        sliderX.max = xMax;
        sliderX.step = Number(((xMax - xMin) / 600).toFixed(4)) || 0.01;
      }
      if (typeof st.tMin === 'number' && typeof st.tMax === 'number' && st.tMax > st.tMin &&
        typeof st.yMin === 'number' && typeof st.yMax === 'number' && st.yMax > st.yMin) {
        tMin = st.tMin;
        tMax = st.tMax;
        yMin = st.yMin;
        yMax = st.yMax;
        computeCriticalSnapPoints();
      } else {
        autoFitRange(false);
      }

      if (typeof st.currentX === 'number' && isFinite(st.currentX)) {
        currentX = Math.max(xMin, Math.min(xMax, st.currentX));
      }
      if (sliderX) sliderX.value = currentX;

      if (typeof st.playSpeed === 'number' && isFinite(st.playSpeed)) {
        playSpeed = st.playSpeed;
        modal.querySelectorAll('.n-axis-speed-btn').forEach(b => {
          b.classList.toggle('active', Math.abs(parseFloat(b.dataset.speed) - playSpeed) < 1e-3);
        });
      }
      activeSnapLabel = st.activeSnapLabel !== undefined ? st.activeSnapLabel : null;
      return true;
    };

    const openModal = (studioState = null) => {
      stopAutoPlay();
      this._pauseAudioForToolkitIfNeeded();

      const drawer = document.getElementById('railDrawer');
      if (drawer && drawer.classList.contains('open') && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }

      availableCanvasCandidates = this.collectAvailableCanvasGraphs();

      this.isNAxisStudioOpen = true;
      modal.style.display = 'flex';
      modal.classList.add('show');

      const isValidStateObj = Boolean(
        studioState &&
        typeof studioState === 'object' &&
        !(typeof Event !== 'undefined' && studioState instanceof Event) &&
        (studioState.slotG || typeof studioState.exprG === 'string' || typeof studioState.currentX === 'number')
      );

      if (isValidStateObj) {
        applyNAxisStudioState(studioState);
      } else if (availableCanvasCandidates.length >= 2) {
        // 캔버스에 함수가 2개 이상이면 자동으로 1번=속함수 g(x), 2번=겉함수 f(t) 세팅!
        slotG = makeSlotFromCanvasCandidate(availableCanvasCandidates[0]);
        slotF = makeSlotFromCanvasCandidate(availableCanvasCandidates[1]);
        currentX = (slotG.viewXMin + slotG.viewXMax) * 0.5;
        autoFitRange(true);
      } else if (availableCanvasCandidates.length === 1) {
        // 캔버스에 함수가 1개면 f(f(x)) 자기합성으로 즉시 세팅!
        slotG = makeSlotFromCanvasCandidate(availableCanvasCandidates[0]);
        slotF = makeSlotFromCanvasCandidate(availableCanvasCandidates[0]);
        currentX = (slotG.viewXMin + slotG.viewXMax) * 0.5;
        autoFitRange(true);
      } else {
        // 빈 캔버스에서 열었을 때는 기본 대표 개형(sin + 삼차) 세팅
        slotG = makeSlotFromPreset('sin');
        slotF = makeSlotFromPreset('cubic');
        currentX = 0.4;
        autoFitRange(true);
      }

      syncSlotControllerUI();
      renderStudio();
    };

    const closeModal = () => {
      stopAutoPlay();
      draggingHandleState = null;
      hoveredHandleInfo = null;
      activeGuideSnapInfo = null;
      this.isNAxisStudioOpen = false;
      modal.classList.remove('show');
      setTimeout(() => {
        if (!modal.classList.contains('show')) {
          modal.style.display = 'none';
        }
      }, 180);
      this._resumeAudioAfterToolkitIfNeeded();
    };

    this.openNAxisStudioModal = openModal;
    this.closeNAxisStudioModal = closeModal;
    this.getNAxisStudioState = getNAxisStudioState;

    // 좌측 레일 아이콘은 시각화 도구 허브를 통해 진입!
    if (btnRail) btnRail.onclick = () => this.openMathToolkitHub();
    if (btnQuick) btnQuick.onclick = () => openModal();
    if (btnClose) btnClose.onclick = closeModal;

    // 🌟 [캔버스 삽입]: 최종 합성함수 y = f(g(x)) 결과만 큼직하고 선명하게 칠판 카드로 삽입!
    if (btnArchive) {
      btnArchive.onclick = (e) => {
        e.stopPropagation();
        const exported = renderCompositeResultCardDataUrl();
        let studioSnapshotStr = null;
        try {
          const baseSnap = JSON.parse(this.getPureGraphSnapshot());
          baseSnap.isNAxisStudioCard = true;
          baseSnap.isPipLocked = true;
          baseSnap.graphs = [];
          baseSnap.nAxisStudioState = getNAxisStudioState();
          studioSnapshotStr = JSON.stringify(baseSnap);
        } catch (_) {
          studioSnapshotStr = JSON.stringify({
            isNAxisStudioCard: true,
            isPipLocked: true,
            graphs: [],
            nAxisStudioState: getNAxisStudioState()
          });
        }

        const wasInBoardMode = Boolean(this.isGraphCovered);
        if (typeof this._pushWorkspaceUndoSnapshot === 'function') {
          this._pushWorkspaceUndoSnapshot('↺ 합성함수 결과 카드 삽입 취소됨', '↻ 합성함수 결과 카드 다시 삽입됨');
        }

        closeModal();

        const createdRef = this.setGraphCard(
          exported.dataUrl,
          exported.offCanvas,
          340,
          { x: 460, y: 84, w: 340, h: Math.round(340 * exported.aspect) },
          studioSnapshotStr,
          {
            alreadyInBoardMode: wasInBoardMode,
            cardW: 340,
            aspect: exported.aspect
          }
        );

        if (typeof this.syncPipCardLockUI === 'function') {
          this.syncPipCardLockUI(createdRef || 'primary');
        }
        if (typeof this.renderPipGraphCard === 'function') {
          this.renderPipGraphCard(createdRef || 'primary');
        }
        if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        this.showToast('📌 합성함수 결과 그래프를 캔버스에 삽입했습니다! ([크게 열기]로 언제든 다시 조작)');
      };
    }

    // --- 포인터 조작: 개형 핸들 드래그 vs 입력 x 레이저 스크러빙 자동 분기 ---
    const getLogicalPointerPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (LOGICAL_W / Math.max(1, rect.width));
      const sy = (e.clientY - rect.top) * (LOGICAL_H / Math.max(1, rect.height));
      return { mx: sx, my: sy };
    };

    const hitTestStudioHandle = (mx, my, isTouch) => {
      if (isAutoPlaying) return null;
      const hitRadius = isTouch ? 20 : 14;
      const allHandles = [
        ...getInteractiveHandlesForSlot(slotF, 'F'),
        ...getInteractiveHandlesForSlot(slotG, 'G')
      ];
      let best = null;
      let bestDist = hitRadius;
      for (const h of allHandles) {
        const d = Math.hypot(mx - h.sx, my - h.sy);
        if (d <= bestDist) {
          bestDist = d;
          best = h;
        }
      }
      return best;
    };

    let isScrubbingCanvas = false;
    const scrubFromLogicalPos = (mx, my) => {
      if (isAutoPlaying) return;
      let nextX = null;
      if (mx < midX && my > midY) {
        const pad = 38;
        const h = (LOGICAL_H - midY) - pad * 2;
        const clampedY = Math.max(midY + pad, Math.min(LOGICAL_H - pad, my));
        nextX = xMin + ((clampedY - (midY + pad)) / Math.max(1, h)) * (xMax - xMin);
      } else if (mx >= midX && my <= midY) {
        const pad = 48;
        const w = (LOGICAL_W - midX) - pad * 2;
        const clampedX = Math.max(midX + pad, Math.min(LOGICAL_W - pad, mx));
        nextX = xMin + ((clampedX - (midX + pad)) / Math.max(1, w)) * (xMax - xMin);
      } else if (mx < midX && my <= midY) {
        const targetT = fromScreenT(Math.max(48, Math.min(midX - 48, mx)));
        let bestX = currentX, bestDiff = Infinity;
        const M = 240;
        for (let i = 0; i <= M; i++) {
          const candX = xMin + (i / M) * (xMax - xMin);
          const candT = evalG(candX);
          if (isFinite(candT)) {
            const d = Math.abs(candT - targetT) + Math.abs(candX - currentX) * 0.06;
            if (d < bestDiff) { bestDiff = d; bestX = candX; }
          }
        }
        nextX = bestX;
      }

      if (nextX !== null && isFinite(nextX)) {
        currentX = applyCriticalSnap(nextX);
        if (sliderX) sliderX.value = currentX;
        renderStudio();
      }
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType !== 'pen' && e.pointerType !== 'touch') return;
      if (isAutoPlaying) stopAutoPlay();

      const { mx, my } = getLogicalPointerPos(e);
      const hitH = hitTestStudioHandle(mx, my, e.pointerType === 'touch' || e.pointerType === 'pen');
      if (hitH) {
        const targetSlot = hitH.slotRole === 'F' ? slotF : slotG;
        draggingHandleState = {
          ...hitH,
          initU: hitH.u,
          initV: hitH.v,
          initOutScale: targetSlot.outScale ?? 1.0,
          initOutShift: targetSlot.outShift ?? 0.0
        };
        canvas.style.cursor = 'grabbing';
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
        renderStudio();
        return;
      }

      // 우하단 컨트롤 패드 여백 클릭 무시
      if (mx >= midX && my >= midY) return;

      isScrubbingCanvas = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
      scrubFromLogicalPos(mx, my);
    });

    canvas.addEventListener('pointermove', (e) => {
      const { mx, my } = getLogicalPointerPos(e);
      if (draggingHandleState) {
        applyHandleDragMove(draggingHandleState, mx, my, e.altKey);
        renderStudio();
        return;
      }
      if (isScrubbingCanvas) {
        scrubFromLogicalPos(mx, my);
        return;
      }
      if (!isAutoPlaying) {
        const hitH = hitTestStudioHandle(mx, my, false);
        const prevKey = hoveredHandleInfo ? `${hoveredHandleInfo.slotRole}_${hoveredHandleInfo.mode}_${hoveredHandleInfo.idx}` : '';
        const nextKey = hitH ? `${hitH.slotRole}_${hitH.mode}_${hitH.idx}` : '';
        if (prevKey !== nextKey) {
          hoveredHandleInfo = hitH;
          canvas.style.cursor = hitH ? 'grab' : 'crosshair';
          renderStudio();
        }
      }
    });

    const finishPointerInteraction = (e) => {
      if (draggingHandleState) {
        draggingHandleState = null;
        activeGuideSnapInfo = null;
        canvas.style.cursor = hoveredHandleInfo ? 'grab' : 'crosshair';
        computeCriticalSnapPoints();
        renderStudio();
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }
        return;
      }
      if (isScrubbingCanvas) {
        isScrubbingCanvas = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }
      }
    };
    canvas.addEventListener('pointerup', finishPointerInteraction);
    canvas.addEventListener('pointercancel', finishPointerInteraction);

    if (sliderX) {
      sliderX.addEventListener('input', (e) => {
        if (isAutoPlaying) stopAutoPlay();
        const rawX = parseFloat(e.target.value);
        if (isFinite(rawX)) {
          currentX = applyCriticalSnap(rawX);
          renderStudio();
        }
      });
    }

    if (btnAutoPlay) {
      btnAutoPlay.addEventListener('click', () => {
        if (isAutoPlaying) {
          stopAutoPlay();
        } else {
          isAutoPlaying = true;
          btnAutoPlay.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align:-2px;margin-right:3px;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>정지`;
          if (currentX >= xMax - (xMax - xMin) * 0.02) currentX = xMin;
          loopAutoPlay();
        }
      });
    }

    modal.querySelectorAll('.n-axis-speed-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const spd = parseFloat(e.currentTarget.dataset.speed);
        if (!isNaN(spd)) {
          playSpeed = spd;
          modal.querySelectorAll('.n-axis-speed-btn').forEach(b => b.classList.toggle('active', b === e.currentTarget));
        }
      });
    });

    if (btnAutoFit) {
      btnAutoFit.addEventListener('click', () => {
        autoFitRange(false);
        renderStudio();
      });
    }

    if (btnSwap) {
      btnSwap.addEventListener('click', () => {
        const prevG = cloneSlot(slotG);
        const prevF = cloneSlot(slotF);
        slotG = prevF;
        slotF = prevG;
        autoFitRange(true);
        syncSlotControllerUI();
        renderStudio();
      });
    }

    // 절댓값(|·|) 및 상하반전(↕) 미니 토글
    if (btnAbsG) {
      btnAbsG.addEventListener('click', () => {
        slotG.absOut = !slotG.absOut;
        computeCriticalSnapPoints();
        syncSlotControllerUI();
        renderStudio();
      });
    }
    if (btnFlipG) {
      btnFlipG.addEventListener('click', () => {
        slotG.invertOut = !slotG.invertOut;
        computeCriticalSnapPoints();
        syncSlotControllerUI();
        renderStudio();
      });
    }
    if (btnAbsF) {
      btnAbsF.addEventListener('click', () => {
        slotF.absOut = !slotF.absOut;
        computeCriticalSnapPoints();
        syncSlotControllerUI();
        renderStudio();
      });
    }
    if (btnFlipF) {
      btnFlipF.addEventListener('click', () => {
        slotF.invertOut = !slotF.invertOut;
        computeCriticalSnapPoints();
        syncSlotControllerUI();
        renderStudio();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isNAxisStudioOpen) {
          e.preventDefault();
          closeModal();
          return;
        }
        if (this.isMathToolkitOpen && typeof this.closeMathToolkitHub === 'function') {
          e.preventDefault();
          this.closeMathToolkitHub();
          return;
        }
      }
      if (e.code === 'Space' && this.isNAxisStudioOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
        if (tag !== 'BUTTON' && tag !== 'INPUT') {
          e.preventDefault();
          if (btnAutoPlay) btnAutoPlay.click();
        }
      }
    });
  };
})();
