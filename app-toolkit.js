/**
 * Graphly Math Visualization Toolkit Hub & Visual N-Axis Composite Function Studio
 * - 본체 핵심 파일(app-core.js, app-canvas.js, engine.js) 무결성 100% 보존형 독립 모듈
 * - 캔버스 그래프 2개 이상 필수 연동 (카드 1장 = 가장 먼저 삽입된 대표 함수 1개, 기본 내장 프리셋 0개)
 * - 스튜디오 내 실시간 개형 핸들 드래그 & 극점 보조선 자석 스냅, 모든 해상도 하단 잘림 0px 보장
 * - [캔버스 삽입] 시 깨끗한 3개 그래프(겉함수 · 90° 회전 속함수 · 합성함수) + 좌표축을 1:1 정렬된 판서용 카드로 삽입
 */
(function () {
  if (typeof GraphApp === 'undefined') return;

  // 칠판에 삽입된 합성함수 카드(.n-axis-studio-board-card) 헤더 버튼 정리 및 일반 카드 100% 원복 보장
  if (typeof GraphApp.prototype.syncPipCardLockUI === 'function' && !GraphApp.prototype._nAxisLockWrapped) {
    const _origSyncPipCardLockUI = GraphApp.prototype.syncPipCardLockUI;
    GraphApp.prototype.syncPipCardLockUI = function (cardRef) {
      const res = _origSyncPipCardLockUI.call(this, cardRef);
      try {
        if (typeof this._getPipCardWidgetAndSnapRaw === 'function' && typeof this._getMutablePipCardSnapshot === 'function') {
          const { widget } = this._getPipCardWidgetAndSnapRaw(cardRef);
          const snap = this._getMutablePipCardSnapshot(cardRef);
          if (widget) {
            widget.classList.toggle('n-axis-studio-board-card', Boolean(snap && snap.isNAxisStudioCard));
          }
        }
      } catch (_) { }
      return res;
    };
    GraphApp.prototype._nAxisLockWrapped = true;
  }

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

  function deepCloneJson(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (_) {
      return null;
    }
  }

  function makeFallbackGraphObj() {
    return {
      id: 'st_fallback_linear',
      type: '1st_linear',
      isAbsolute: false,
      handles: [
        { name: '기준점', x: 0.0, y: 0.0, type: 'vertex' },
        { name: '기울기', x: 1.0, y: 1.0, type: 'point' }
      ]
    };
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
  // 1. 시각화 도구 메뉴바(#panelToolkit) & 확장형 스튜디오 모달 생명주기 허브
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
    if (typeof this.renderMathToolkitPanel === 'function') {
      this.renderMathToolkitPanel();
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
    if (this.isMathToolkitOpen || this.isNAxisStudioOpen || this._activeToolkitModalId) return;
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

  // 추후 추가될 별도 모달형 시각화 도구들을 위한 공통 모달 세션 시작/종료 헬퍼
  GraphApp.prototype.openToolkitModalSession = function (toolId, closeCallback = null) {
    if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
      this.closeDrawer();
    }
    this._pauseAudioForToolkitIfNeeded();
    this._activeToolkitModalId = toolId || 'custom_toolkit_modal';
    this._activeToolkitCloseFn = typeof closeCallback === 'function' ? closeCallback : null;
    this.isMathToolkitOpen = true;
  };

  GraphApp.prototype.closeToolkitModalSession = function (toolId = null) {
    if (toolId && this._activeToolkitModalId && this._activeToolkitModalId !== toolId) return;
    this._activeToolkitModalId = null;
    this._activeToolkitCloseFn = null;
    const noticeEl = document.getElementById('modalNAxisSetupNotice');
    const isNoticeOpen = Boolean(noticeEl && noticeEl.classList.contains('show'));
    this.isMathToolkitOpen = isNoticeOpen;
    this._resumeAudioAfterToolkitIfNeeded();
  };

  GraphApp.prototype.renderMathToolkitPanel = function () {
    const container = document.getElementById('toolkitDrawerGrid');
    if (!container) return;
    container.innerHTML = '';

    const tools = Array.isArray(this.mathToolkitRegistry) ? this.mathToolkitRegistry.filter(Boolean) : [];
    if (tools.length === 0) return;

    const chevronSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    const defaultIconSvg = `<svg viewBox="0 0 24 20" class="mini-func-icon" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="7" height="7" rx="1.5"/><polygon points="17.5 2 21 9 14 9"/><circle cx="6.5" cy="15" r="3"/><path d="M13 16c1.5-4 3-4 4 0 1 2.8 2.2 1 3.2-2.5"/></svg>`;

    let currentGrid = null;
    let currentCols = 0;

    tools.forEach((tool, idx) => {
      const targetCols = tool.cols === 2 ? 2 : 1;
      if (tool.dividerBefore && idx > 0) {
        const divLine = document.createElement('div');
        divLine.className = 'func-block-divider';
        container.appendChild(divLine);
        currentGrid = null;
      }
      if (!currentGrid || currentCols !== targetCols) {
        currentGrid = document.createElement('div');
        currentGrid.className = `func-cat-grid cols-${targetCols}`;
        currentCols = targetCols;
        container.appendChild(currentGrid);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'func-btn toolkit-tool-btn';
      btn.dataset.toolId = tool.id;
      if (tool.desc || tool.title) {
        btn.title = tool.title || '';
      }
      btn.innerHTML = `
        <span class="func-icon-wrap">${tool.iconSvg || defaultIconSvg}</span>
        <span class="func-name-text">${tool.title || ''}</span>
        <span class="toolkit-open-chevron" aria-hidden="true">${chevronSvg}</span>
      `;
      btn.onclick = () => {
        if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
          this.closeDrawer();
        }
        tool.open();
      };
      currentGrid.appendChild(btn);
    });
  };

  GraphApp.prototype.initMathToolkitHub = function () {
    if (this._mathToolkitHubInitialized) return;
    this._mathToolkitHubInitialized = true;
    this.isMathToolkitOpen = false;
    this._activeToolkitModalId = null;
    this._activeToolkitCloseFn = null;
    if (!Array.isArray(this.mathToolkitRegistry)) {
      this.mathToolkitRegistry = [];
    }

    // 1호 정식 도구 등록: 합성함수 스튜디오
    this.registerMathToolkitTool({
      id: 'n_axis_composite',
      title: '합성함수 스튜디오',
      desc: '캔버스에 준비된 그래프(#1, #2)를 연동해 합성 개형을 관찰하고 3개 그래프 판서 도면을 삽입합니다.',
      iconSvg: `<svg viewBox="0 0 24 20" class="mini-func-icon" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h4v4"/><path d="M4 17 20 3"/><path d="M20 13v4h-4"/><path d="M14 12l6 5"/><path d="M4 3l5 4.5"/></svg>`,
      open: () => this.openNAxisStudioModal()
    });

    const launcherModal = document.getElementById('modalMathToolkitLauncher');
    const btnClose = document.getElementById('btnCloseMathToolkit');

    // 그래프 2개 미설정 안내 모달 바인딩
    const noticeModal = document.getElementById('modalNAxisSetupNotice');
    const lblNoticeTitle = document.getElementById('lblNAxisNoticeTitle');
    const lblNoticeDesc = document.getElementById('lblNAxisNoticeDesc');
    const boxNoticeStatus = document.getElementById('boxNAxisNoticeStatus');
    const btnCloseNotice = document.getElementById('btnCloseNAxisNotice');
    const btnCancelNotice = document.getElementById('btnCancelNAxisNotice');
    const btnOpenDrawerFromNotice = document.getElementById('btnOpenGraphDrawerFromNotice');

    if (noticeModal) {
      noticeModal.addEventListener('pointerenter', () => {
        if (this.virtualStylusEl && !this.isAudioPlaying) {
          this.virtualStylusEl.style.display = 'none';
        }
      });
    }

    const closeSetupNotice = () => {
      if (noticeModal) {
        noticeModal.classList.remove('show');
        noticeModal.style.display = 'none';
      }
      this.isMathToolkitOpen = Boolean(this._activeToolkitModalId);
      this._resumeAudioAfterToolkitIfNeeded();
    };

    const openSetupNotice = (candidates = []) => {
      if (!noticeModal) {
        this.showToast('⚠️ 먼저 합성할 함수 그래프 1번·2번을 화면에 세팅한 뒤 다시 실행해 주세요.');
        return;
      }
      if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }
      this._pauseAudioForToolkitIfNeeded();

      const count = Array.isArray(candidates) ? candidates.length : 0;
      if (count === 0) {
        if (lblNoticeTitle) lblNoticeTitle.textContent = '함수 1·2번을 먼저 세팅해 주세요';
        if (lblNoticeDesc) {
          lblNoticeDesc.innerHTML = '합성함수 스튜디오는 내가 화면에 그린 그래프들의 합성 개형을 관찰하는 도구입니다.<br>먼저 그래프 2개(<b>#1</b>, <b>#2</b>)를 세팅한 뒤 다시 실행해 주세요.';
        }
        if (boxNoticeStatus) {
          boxNoticeStatus.textContent = '현재 세팅된 그래프: 0개 (최소 2개 필요)';
        }
        if (btnOpenDrawerFromNotice) {
          btnOpenDrawerFromNotice.textContent = '+ 그래프 추가 열기';
        }
      } else {
        const firstLabel = (candidates[0] && candidates[0].label) ? candidates[0].label : '#1 그래프';
        if (lblNoticeTitle) lblNoticeTitle.textContent = '두 번째 그래프(#2)가 아직 없습니다';
        if (lblNoticeDesc) {
          lblNoticeDesc.innerHTML = '합성함수를 관찰하려면 최소 2개의 그래프가 세팅되어 있어야 합니다.<br>두 번째 그래프를 추가하거나, 같은 함수를 합성하려면 카드 상단의 <b>[복제]</b> 버튼으로 2개를 만든 뒤 다시 실행해 주세요.';
        }
        if (boxNoticeStatus) {
          boxNoticeStatus.textContent = `현재 세팅됨: 📌 ${firstLabel} (1개 더 필요)`;
        }
        if (btnOpenDrawerFromNotice) {
          btnOpenDrawerFromNotice.textContent = '+ 두 번째 그래프 추가';
        }
      }

      this.isMathToolkitOpen = true;
      noticeModal.style.display = 'flex';
      noticeModal.classList.add('show');
    };

    this.openNAxisSetupNoticeModal = openSetupNotice;
    this.closeNAxisSetupNoticeModal = closeSetupNotice;

    if (btnCloseNotice) btnCloseNotice.onclick = closeSetupNotice;
    if (btnCancelNotice) btnCancelNotice.onclick = closeSetupNotice;
    if (noticeModal) {
      noticeModal.addEventListener('pointerdown', (e) => {
        if (e.target === noticeModal) closeSetupNotice();
      });
    }
    if (btnOpenDrawerFromNotice) {
      btnOpenDrawerFromNotice.onclick = () => {
        closeSetupNotice();
        // 판서 모드에서 기존 1번 카드에 겹쳐 들어가지 않고 새 카드(#2)로 생성되도록 새 창 타깃 지정
        if (this.isGraphCovered) {
          this._pipTargetCard = 'new';
          this._pipSessionOrigin = 'rail';
          document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
          if (typeof this.deselectAllPipGraphCards === 'function') {
            this.deselectAllPipGraphCards();
          }
        }
        if (typeof this.openDrawer === 'function') {
          this.openDrawer('panelPresets');
        } else {
          const btnPresets = document.getElementById('btnRailPresets');
          if (btnPresets && (this.isDrawerCollapsed || this.activeDrawerPanel !== 'panelPresets')) {
            btnPresets.click();
          }
        }
      };
    }

    const closeHub = () => {
      if (noticeModal && noticeModal.classList.contains('show')) {
        noticeModal.classList.remove('show');
        noticeModal.style.display = 'none';
      }
      if (typeof this._activeToolkitCloseFn === 'function') {
        const closeFn = this._activeToolkitCloseFn;
        this._activeToolkitModalId = null;
        this._activeToolkitCloseFn = null;
        closeFn();
      }
      this.isMathToolkitOpen = false;
      if (launcherModal) {
        launcherModal.classList.remove('show');
        launcherModal.style.display = 'none';
      }
      if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelToolkit' && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }
      this._resumeAudioAfterToolkitIfNeeded();
    };

    const openHub = () => {
      this.renderMathToolkitPanel();
      if (typeof this.openDrawer === 'function') {
        if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelToolkit') {
          this.closeDrawer();
        } else {
          this.openDrawer('panelToolkit');
        }
      }
    };

    this.openMathToolkitHub = openHub;
    this.closeMathToolkitHub = closeHub;

    if (btnClose) btnClose.onclick = closeHub;
    if (launcherModal) {
      launcherModal.addEventListener('pointerdown', (e) => {
        if (e.target === launcherModal) closeHub();
      });
    }

    this.renderMathToolkitPanel();
  };

  // =========================================================================
  // 2. 현재 캔버스 그래프 후보 읽기전용 스캔
  //    - 판서 모드: 카드 1장당 가장 먼저 삽입된 대표 함수 1개씩 수집 (#1, #2, #3...)
  //    - 카드의 세로 가시 범위(Visible Y-Range)를 함께 반영하여 양끝 발산 잘림 방지
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

    // 카드/캔버스 가로폭 중 실제로 세로 화면(yMin~yMax) 안에 그래프가 그려진 알짜 정의역 추출
    const refineVisibleDomain = (rawXMin, rawXMax, rawYMin, rawYMax, evalFn, graphForHandles = null, pwBoundaries = null) => {
      const base = clampDomain(rawXMin, rawXMax);
      if (typeof rawYMin !== 'number' || typeof rawYMax !== 'number' || !isFinite(rawYMin) || !isFinite(rawYMax)) {
        return base;
      }
      const yLo = Math.min(rawYMin, rawYMax);
      const yHi = Math.max(rawYMin, rawYMax);
      const ySpan = Math.max(1.6, yHi - yLo);
      const yPad = ySpan * 0.14;

      const xLo = base.viewXMin;
      const xHi = base.viewXMax;
      const N = 260;
      let visMin = Infinity;
      let visMax = -Infinity;

      for (let i = 0; i <= N; i++) {
        const x = xLo + (i / N) * (xHi - xLo);
        const y = evalFn(x);
        if (typeof y === 'number' && isFinite(y) && y >= yLo - yPad && y <= yHi + yPad) {
          if (x < visMin) visMin = x;
          if (x > visMax) visMax = x;
        }
      }

      if (graphForHandles && Array.isArray(graphForHandles.handles) && typeof GraphMathEngine !== 'undefined') {
        graphForHandles.handles.forEach(h => {
          if (!h || h.hidden) return;
          if (graphForHandles.type === 'cos_1period' && Math.abs(h.x) > 4.5) return;
          const wp = GraphMathEngine.getHandleWorldPos(graphForHandles, h);
          if (isFinite(wp.x) && wp.x >= xLo && wp.x <= xHi) {
            if (wp.x < visMin) visMin = wp.x;
            if (wp.x > visMax) visMax = wp.x;
          }
        });
      }
      if (Array.isArray(pwBoundaries)) {
        pwBoundaries.forEach(bx => {
          if (typeof bx === 'number' && isFinite(bx) && bx >= xLo && bx <= xHi) {
            if (bx < visMin) visMin = bx;
            if (bx > visMax) visMax = bx;
          }
        });
      }

      if (!isFinite(visMin) || !isFinite(visMax) || visMax <= visMin) {
        return base;
      }
      const visSpan = Math.max(1.4, visMax - visMin);
      const padX = visSpan * 0.06;
      const finalMin = Math.max(xLo, visMin - padX);
      const finalMax = Math.min(xHi, visMax + padX);
      return clampDomain(finalMin, finalMax);
    };

    const collectSingleRepresentativeFromSnap = (snapRaw, prefixLabel, cardW, cardH) => {
      if (!snapRaw || snapRaw.isNAxisStudioCard || !Array.isArray(snapRaw.graphs) || snapRaw.graphs.length === 0) return;
      const clonedSnap = deepCloneJson(snapRaw);
      if (!clonedSnap || !Array.isArray(clonedSnap.graphs)) return;

      if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
        GraphMathEngine.ensureCompiledFunctions(clonedSnap.graphs);
      }

      let rawXMin = -4.0, rawXMax = 4.0;
      let rawYMin = -4.0, rawYMax = 4.0;
      if (typeof this._withPipCardGraphState === 'function' && cardW && cardH) {
        try {
          this._withPipCardGraphState(clonedSnap, cardW, cardH, () => {
            rawXMin = this.screenToMath(0, 0).x;
            rawXMax = this.screenToMath(cardW, 0).x;
            rawYMax = this.screenToMath(0, 0).y;
            rawYMin = this.screenToMath(0, cardH).y;
          });
        } catch (_) {
          const effSpanX = (clonedSnap.xSpan || 6.2) / (clonedSnap.zoomLevel || 1.0);
          const effSpanY = (clonedSnap.ySpan || 4.5) / (clonedSnap.zoomLevel || 1.0);
          rawXMin = -effSpanX;
          rawXMax = effSpanX;
          rawYMin = -effSpanY;
          rawYMax = effSpanY;
        }
      }

      // 1) 구간분할 카드인 경우: 비독립 조각들을 묶은 구간함수 1개를 대표 함수로 채택 (없으면 먼저 삽입된 독립 그래프 1개)
      if (clonedSnap.usePiecewise) {
        const pwGraphs = clonedSnap.graphs.filter(g => g && !g.isIndependent && isValidFunctionGraph(g));
        if (pwGraphs.length > 0) {
          const bundle = {
            graphs: deepCloneJson(pwGraphs),
            boundaries: Array.isArray(clonedSnap.piecewiseBoundaries) ? [...clonedSnap.piecewiseBoundaries] : [],
            funcMap: Array.isArray(clonedSnap.piecewiseFuncMap) ? [...clonedSnap.piecewiseFuncMap] : [],
            inclusions: Array.isArray(clonedSnap.piecewiseInclusions) ? deepCloneJson(clonedSnap.piecewiseInclusions) : [],
            isPeriodic: Boolean(clonedSnap.isPiecewisePeriodic),
            stepY: typeof clonedSnap.periodicStepY === 'number' ? clonedSnap.periodicStepY : 0
          };
          if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
            GraphMathEngine.ensureCompiledFunctions(bundle.graphs);
          }
          const dom = refineVisibleDomain(
            rawXMin, rawXMax, rawYMin, rawYMax,
            (x) => evaluatePiecewiseBundleAt(bundle, x),
            null,
            bundle.boundaries
          );
          candidates.push({
            id: `canvas_pw_${prefixLabel}`,
            kind: 'canvas_piecewise',
            label: `${prefixLabel} 구간함수`,
            badgeColor: pwGraphs[0].color || '#2563eb',
            graph: null,
            piecewiseBundle: bundle,
            viewXMin: dom.viewXMin,
            viewXMax: dom.viewXMax
          });
          return;
        }
      }

      // 2) 일반 그래프 카드: 한 카드에 여러 그래프가 있어도 가장 먼저 삽입된(0번 인덱스) 유효 함수 1개만 대표로 채택!
      const validGraphs = clonedSnap.graphs.filter(isValidFunctionGraph);
      if (validGraphs.length === 0) return;

      const firstGraph = deepCloneJson(validGraphs[0]);
      if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
        GraphMathEngine.ensureCompiledFunctions([firstGraph]);
      }
      const dom = refineVisibleDomain(
        rawXMin, rawXMax, rawYMin, rawYMax,
        (x) => GraphMathEngine.evaluatePipeline(firstGraph, x),
        firstGraph,
        null
      );
      candidates.push({
        id: `canvas_${prefixLabel}_0`,
        kind: 'canvas_graph',
        label: `${prefixLabel} ${getFuncShortName(firstGraph)}`,
        badgeColor: firstGraph.color || '#2563eb',
        graph: firstGraph,
        piecewiseBundle: null,
        viewXMin: dom.viewXMin,
        viewXMax: dom.viewXMax
      });
    };

    if (this.isGraphCovered) {
      // 판서 모드: 화면에 떠 있는 창모드(PiP) 그래프 카드 순서대로 1장당 대표 함수 1개 스캔
      const primaryWidget = document.getElementById('graphCardWidget');
      if (this._hasPrimaryGraphCard && this.graphCardData && primaryWidget && primaryWidget.style.display !== 'none') {
        const snap1 = typeof this._getMutablePipCardSnapshot === 'function'
          ? this._getMutablePipCardSnapshot('primary')
          : null;
        if (snap1 && !snap1.isNAxisStudioCard) {
          const body1 = document.getElementById('graphCardBody');
          const cw1 = Math.max(160, Math.round(parseFloat(primaryWidget.style.width) || (body1 && body1.clientWidth) || 380));
          const ch1 = Math.max(120, Math.round((body1 && parseFloat(body1.style.height)) || cw1 * (this.graphCardAspect || 0.82)));
          collectSingleRepresentativeFromSnap(snap1, '#1', cw1, ch1);
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
          collectSingleRepresentativeFromSnap(snapExtra, cardTag, cw, ch);
        });
      }
    } else if (Array.isArray(this.graphs) && this.graphs.length > 0) {
      // 전체화면 그래프 모드: 먼저 삽입된 순서대로 수집
      const sw = Math.max(320, this.screenWidth || window.innerWidth || 1440);
      const sh = Math.max(240, this.screenHeight || window.innerHeight || 900);
      const rawXMin = typeof this.screenToMath === 'function' ? this.screenToMath(0, 0).x : -5;
      const rawXMax = typeof this.screenToMath === 'function' ? this.screenToMath(sw, 0).x : 5;
      const rawYMax = typeof this.screenToMath === 'function' ? this.screenToMath(0, 0).y : 4;
      const rawYMin = typeof this.screenToMath === 'function' ? this.screenToMath(0, sh).y : -4;

      if (this.usePiecewise) {
        const pwGraphs = this.graphs.filter(g => g && !g.isIndependent && isValidFunctionGraph(g));
        if (pwGraphs.length > 0) {
          const clonedPw = deepCloneJson(pwGraphs);
          if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
            GraphMathEngine.ensureCompiledFunctions(clonedPw);
          }
          const bundle = {
            graphs: clonedPw,
            boundaries: Array.isArray(this.piecewiseBoundaries) ? [...this.piecewiseBoundaries] : [],
            funcMap: Array.isArray(this.piecewiseFuncMap) ? [...this.piecewiseFuncMap] : [],
            inclusions: Array.isArray(this.piecewiseInclusions) ? deepCloneJson(this.piecewiseInclusions) : [],
            isPeriodic: Boolean(this.isPiecewisePeriodic),
            stepY: typeof this.periodicStepY === 'number' ? this.periodicStepY : 0
          };
          const dom = refineVisibleDomain(
            rawXMin, rawXMax, rawYMin, rawYMax,
            (x) => evaluatePiecewiseBundleAt(bundle, x),
            null,
            bundle.boundaries
          );
          candidates.push({
            id: 'canvas_full_pw',
            kind: 'canvas_piecewise',
            label: '#1 구간함수',
            badgeColor: clonedPw[0].color || '#2563eb',
            graph: null,
            piecewiseBundle: bundle,
            viewXMin: dom.viewXMin,
            viewXMax: dom.viewXMax
          });
        }
        const indepFull = this.graphs.filter(g => g && g.isIndependent && isValidFunctionGraph(g));
        indepFull.forEach((fg, idx) => {
          const gClone = deepCloneJson(fg);
          if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
            GraphMathEngine.ensureCompiledFunctions([gClone]);
          }
          const dom = refineVisibleDomain(
            rawXMin, rawXMax, rawYMin, rawYMax,
            (x) => GraphMathEngine.evaluatePipeline(gClone, x),
            gClone,
            null
          );
          const num = candidates.length + 1;
          candidates.push({
            id: `canvas_full_ind_${idx}`,
            kind: 'canvas_graph',
            label: `#${num} ${getFuncShortName(gClone)}`,
            badgeColor: gClone.color || '#2563eb',
            graph: gClone,
            piecewiseBundle: null,
            viewXMin: dom.viewXMin,
            viewXMax: dom.viewXMax
          });
        });
      } else {
        const validFull = this.graphs.filter(isValidFunctionGraph);
        validFull.forEach((fg, idx) => {
          const gClone = deepCloneJson(fg);
          if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
            GraphMathEngine.ensureCompiledFunctions([gClone]);
          }
          const dom = refineVisibleDomain(
            rawXMin, rawXMax, rawYMin, rawYMax,
            (x) => GraphMathEngine.evaluatePipeline(gClone, x),
            gClone,
            null
          );
          candidates.push({
            id: `canvas_full_${idx}`,
            kind: 'canvas_graph',
            label: `#${idx + 1} ${getFuncShortName(gClone)}`,
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
  // 3. 100% 개형 조작형 N축 합성함수 스튜디오
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

    // 각 사분면 여백 상수 (제목 및 축 화살표·라벨 잘림 0px 보장)
    const TOP_QUAD_PAD_TOP = 44;
    const TOP_QUAD_PAD_BOT = 36;
    const BOT_QUAD_PAD_TOP = 46;
    const BOT_QUAD_PAD_BOT = 40;
    const LEFT_QUAD_PAD_X = 48;
    const RIGHT_QUAD_PAD_X = 48;

    let xMin = -3.0, xMax = 3.0;
    let tMin = -3.5, tMax = 3.5;
    let yMin = -4.2, yMax = 4.2;
    let currentX = 0.0;
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

    let availableCanvasCandidates = [];

    function makeEmergencyFallbackSlot(label = '함수') {
      const g = makeFallbackGraphObj();
      if (typeof GraphMathEngine !== 'undefined' && typeof GraphMathEngine.ensureCompiledFunctions === 'function') {
        GraphMathEngine.ensureCompiledFunctions([g]);
      }
      return {
        kind: 'canvas_graph',
        sourceId: 'fallback_slot',
        presetKey: null,
        label,
        graph: g,
        piecewiseBundle: null,
        legacyExpr: null,
        _compiledFn: null,
        outScale: 1.0,
        outShift: 0.0,
        invertOut: false,
        absOut: false,
        viewXMin: -3.0,
        viewXMax: 3.0
      };
    }

    function makeSlotFromCanvasCandidate(cand) {
      if (!cand) return makeEmergencyFallbackSlot();
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
      if (!raw || typeof raw !== 'object') return makeEmergencyFallbackSlot();
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
      if (!raw.graph && !raw.piecewiseBundle && typeof raw._compiledFn !== 'function') {
        raw.graph = makeFallbackGraphObj();
      }
      if (typeof raw.outScale !== 'number' || !isFinite(raw.outScale)) raw.outScale = 1.0;
      if (typeof raw.outShift !== 'number' || !isFinite(raw.outShift)) raw.outShift = 0.0;
      raw.invertOut = Boolean(raw.invertOut);
      raw.absOut = Boolean(raw.absOut);
      return raw;
    }

    let slotG = makeEmergencyFallbackSlot('#1 속함수');
    let slotF = makeEmergencyFallbackSlot('#2 겉함수');

    let outerCriticalFeatures = []; // [{ t, y, label, kind }]
    let criticalSnapPoints = [];    // [{ x, label }]
    let activeSnapLabel = null;
    let activeGuideSnapInfo = null;

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
      const w = midX - LEFT_QUAD_PAD_X * 2;
      return LEFT_QUAD_PAD_X + ((t - tMin) / Math.max(1e-6, tMax - tMin)) * w;
    }
    function fromScreenT(sx) {
      const w = midX - LEFT_QUAD_PAD_X * 2;
      return tMin + ((sx - LEFT_QUAD_PAD_X) / Math.max(1, w)) * (tMax - tMin);
    }

    function toScreenY(y) {
      const h = midY - TOP_QUAD_PAD_TOP - TOP_QUAD_PAD_BOT;
      return TOP_QUAD_PAD_TOP + ((yMax - y) / Math.max(1e-6, yMax - yMin)) * h;
    }
    function fromScreenY(sy) {
      const h = midY - TOP_QUAD_PAD_TOP - TOP_QUAD_PAD_BOT;
      return yMax - ((sy - TOP_QUAD_PAD_TOP) / Math.max(1, h)) * (yMax - yMin);
    }

    function toScreenLeftX(x) {
      const h = (LOGICAL_H - midY) - BOT_QUAD_PAD_TOP - BOT_QUAD_PAD_BOT;
      return midY + BOT_QUAD_PAD_TOP + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * h;
    }
    function fromScreenLeftX(sy) {
      const h = (LOGICAL_H - midY) - BOT_QUAD_PAD_TOP - BOT_QUAD_PAD_BOT;
      return xMin + ((sy - (midY + BOT_QUAD_PAD_TOP)) / Math.max(1, h)) * (xMax - xMin);
    }

    function toScreenRightX(x) {
      const startX = midX + RIGHT_QUAD_PAD_X;
      const w = (LOGICAL_W - midX) - RIGHT_QUAD_PAD_X * 2;
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

      if (slotF.kind === 'canvas_piecewise' && slotF.piecewiseBundle && Array.isArray(slotF.piecewiseBundle.boundaries)) {
        slotF.piecewiseBundle.boundaries.forEach(b => {
          addFeat(b, '구간경계', 'boundary');
        });
      }

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

    let staticStudioDirty = true;
    const invalidateStaticStudioCache = () => {
      staticStudioDirty = true;
    };

    // --- 스마트 시야 맞춤 (속함수 치역 전 구간 + 겉함수 주요 극점 + 합성함수 치역 잘림 0px 수용!) ---
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

      const n = 240;
      const gRangeVals = [];
      for (let i = 0; i <= n; i++) {
        const x = xMin + (i / n) * (xMax - xMin);
        const t = evalG(x);
        if (isFinite(t) && Math.abs(t) < 40) gRangeVals.push(t);
      }

      const tCandidates = [...gRangeVals];
      if (slotF && slotF.graph && Array.isArray(slotF.graph.handles)) {
        slotF.graph.handles.forEach(h => {
          if (!h || h.hidden) return;
          if (slotF.graph.type === 'cos_1period' && Math.abs(h.x) > 4.5) return;
          const wp = GraphMathEngine.getHandleWorldPos(slotF.graph, h);
          if (isFinite(wp.x) && Math.abs(wp.x) < 25) tCandidates.push(wp.x);
        });
      } else if (slotF && typeof slotF.viewXMin === 'number' && typeof slotF.viewXMax === 'number') {
        tCandidates.push(slotF.viewXMin * 0.85, slotF.viewXMax * 0.85);
      }

      if (tCandidates.length > 0) {
        tCandidates.sort((a, b) => a - b);
        const isRationalG = Boolean(slotG && slotG.graph && slotG.graph.type && slotG.graph.type.startsWith('rational'));
        const loIdx = isRationalG ? Math.floor(tCandidates.length * 0.03) : 0;
        const hiIdx = isRationalG ? Math.min(tCandidates.length - 1, Math.ceil(tCandidates.length * 0.97)) : (tCandidates.length - 1);
        const minT = tCandidates[loIdx];
        const maxT = tCandidates[hiIdx];
        const spanT = Math.max(2.0, maxT - minT);
        tMin = Number((minT - spanT * 0.16).toFixed(2));
        tMax = Number((maxT + spanT * 0.16).toFixed(2));
        if (tMin > -0.8) tMin = -1.2;
        if (tMax < 0.8) tMax = 1.2;
      } else {
        tMin = -3.5;
        tMax = 3.5;
      }

      const yVals = [];
      // 1) 최종 합성함수 y = f(g(x)) 전 구간 포함 (우상단 상·하단 잘림 방지)
      for (let i = 0; i <= n; i++) {
        const x = xMin + (i / n) * (xMax - xMin);
        const y = evalComp(x);
        if (isFinite(y) && Math.abs(y) < 80) yVals.push(y);
      }
      // 2) 겉함수 핵심 정의역(여백 제외한 본체 구간) 및 핸들 y값 포함
      const coreTMin = tMin + (tMax - tMin) * 0.10;
      const coreTMax = tMax - (tMax - tMin) * 0.10;
      for (let i = 0; i <= n; i++) {
        const t = coreTMin + (i / n) * (coreTMax - coreTMin);
        const y = evalF(t);
        if (isFinite(y) && Math.abs(y) < 80) yVals.push(y);
      }
      if (slotF && slotF.graph && Array.isArray(slotF.graph.handles)) {
        slotF.graph.handles.forEach(h => {
          if (!h || h.hidden) return;
          const wp = GraphMathEngine.getHandleWorldPos(slotF.graph, h);
          if (isFinite(wp.y) && Math.abs(wp.y) < 60) yVals.push(wp.y);
        });
      }

      if (yVals.length > 0) {
        yVals.sort((a, b) => a - b);
        const isRationalF = Boolean(slotF && slotF.graph && slotF.graph.type && slotF.graph.type.startsWith('rational'));
        const loIdx = isRationalF ? Math.floor(yVals.length * 0.03) : 0;
        const hiIdx = isRationalF ? Math.min(yVals.length - 1, Math.ceil(yVals.length * 0.97)) : (yVals.length - 1);
        const minY = yVals[loIdx];
        const maxY = yVals[hiIdx];
        const spanY = Math.max(2.0, maxY - minY);
        yMin = Number((minY - spanY * 0.18).toFixed(2));
        yMax = Number((maxY + spanY * 0.18).toFixed(2));
        if (yMin > -0.8) yMin = -1.2;
        if (yMax < 0.8) yMax = 1.2;
      } else {
        yMin = -4.2;
        yMax = 4.2;
      }

      currentX = Math.max(xMin, Math.min(xMax, currentX));
      if (sliderX) sliderX.value = currentX;
      computeCriticalSnapPoints();
      invalidateStaticStudioCache();
    }

    // --- 각 슬롯(겉함수 F / 속함수 G)의 화면 조작 핸들 목록 생성 ---
    function getInteractiveHandlesForSlot(slot, role) {
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
        return sx >= 16 && sx <= midX - 16 && sy >= midY + 18 && sy <= LOGICAL_H - 18;
      };

      const list = [];

      if (canUseNativeHandles(slot)) {
        const g = slot.graph;
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
        const clampedSy = Math.max(24, Math.min(midY - 22, my));
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
        const clampedSx = Math.max(22, Math.min(midX - 22, mx));
        const clampedSy = Math.max(midY + 26, Math.min(LOGICAL_H - 22, my));
        targetV = fromScreenT(clampedSx);
        targetU = fromScreenLeftX(clampedSy);

        if (!altKey) {
          const snapTolT = Math.abs(fromScreenT(11) - fromScreenT(0));
          const snapTolX = Math.abs(fromScreenLeftX(midY + 55) - fromScreenLeftX(midY + 46));

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
          const deltaV = targetV - dragState.initV;
          slot.outShift = (dragState.initOutShift || 0) + deltaV;
        }
      }

      if (role === 'F') {
        computeOuterCriticalFeatures();
      }
      invalidateStaticStudioCache();
    }

    // --- 불연속 안전 곡선 드로잉 ---
    function drawSafeCurveOnCtx(targetCtx, points, maxJumpPx = 240) {
      targetCtx.beginPath();
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
          targetCtx.moveTo(pt.sx, pt.sy);
          started = true;
        } else {
          targetCtx.lineTo(pt.sx, pt.sy);
        }
        prevSx = pt.sx;
        prevSy = pt.sy;
      }
      targetCtx.stroke();
    }

    function drawArrowHeadOnCtx(targetCtx, x, y, dirX, dirY, size, color) {
      targetCtx.save();
      targetCtx.fillStyle = color;
      targetCtx.translate(x, y);
      targetCtx.rotate(Math.atan2(dirY, dirX));
      targetCtx.beginPath();
      targetCtx.moveTo(0, 0);
      targetCtx.lineTo(-size, -size * 0.55);
      targetCtx.lineTo(-size * 0.78, 0);
      targetCtx.lineTo(-size, size * 0.55);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.restore();
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

    // --- 정적 배경 오프스크린 캐시 & 무할당(Zero-Allocation) TypedArray 버퍼 ---
    const CURVE_STEPS = 480;
    const COMP_STEPS = 560;
    const bufSx = new Float32Array(CURVE_STEPS + 1);
    const bufSy = new Float32Array(CURVE_STEPS + 1);
    const bufValid = new Uint8Array(CURVE_STEPS + 1);
    const compSx = new Float32Array(COMP_STEPS + 1);
    const compSy = new Float32Array(COMP_STEPS + 1);
    const compValid = new Uint8Array(COMP_STEPS + 1);
    const staticBgCanvas = document.createElement('canvas');
    const staticBgCtx = staticBgCanvas.getContext('2d');
    let lastStaticCacheKey = '';
    let lastRenderedLblCurX = '';

    function drawSafeTypedCurveOnCtx(targetCtx, sxArr, syArr, validArr, count, maxJumpPx = 240, tipValid = false, tipSx = 0, tipSy = 0) {
      targetCtx.beginPath();
      let started = false;
      let prevSx = 0, prevSy = 0;
      for (let i = 0; i < count; i++) {
        if (!validArr[i]) {
          started = false;
          continue;
        }
        const sx = sxArr[i];
        const sy = syArr[i];
        if (started && Math.hypot(sx - prevSx, sy - prevSy) > maxJumpPx) {
          started = false;
        }
        if (!started) {
          targetCtx.moveTo(sx, sy);
          started = true;
        } else {
          targetCtx.lineTo(sx, sy);
        }
        prevSx = sx;
        prevSy = sy;
      }
      if (tipValid) {
        if (started && Math.hypot(tipSx - prevSx, tipSy - prevSy) <= maxJumpPx) {
          targetCtx.lineTo(tipSx, tipSy);
        } else {
          targetCtx.moveTo(tipSx, tipSy);
        }
      }
      targetCtx.stroke();
    }

    function drawQuadrantPillBadge(targetCtx, text, bx, by, pal) {
      targetCtx.save();
      targetCtx.font = '600 11.8px Pretendard, system-ui, -apple-system, sans-serif';
      const tw = targetCtx.measureText(text).width;
      const bw = Math.ceil(tw + 18);
      const bh = 23;
      targetCtx.fillStyle = pal.badgeBg;
      targetCtx.strokeStyle = pal.badgeBorder;
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      targetCtx.roundRect(bx, by, bw, bh, 6);
      targetCtx.fill();
      targetCtx.stroke();
      targetCtx.fillStyle = pal.badgeText;
      targetCtx.textAlign = 'left';
      targetCtx.textBaseline = 'middle';
      targetCtx.fillText(text, bx + 9, by + bh * 0.5 + 0.5);
      targetCtx.restore();
    }

    // --- 메인 4분할 스튜디오 렌더링 (오프스크린 정적 레이어 캐싱 적용: 자동 순항 <0.5ms/frame) ---
    function renderStudio() {
      if (!modal.classList.contains('show')) return;

      const dpr = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1));
      const targetBufW = Math.round(LOGICAL_W * dpr);
      const targetBufH = Math.round(LOGICAL_H * dpr);
      if (canvas.width !== targetBufW || canvas.height !== targetBufH) {
        canvas.width = targetBufW;
        canvas.height = targetBufH;
        staticStudioDirty = true;
      }

      const isLight = document.body.classList.contains('theme-light');
      const pal = isLight ? {
        bg: '#ffffff',
        quadBg3: '#ffffff',
        divider: '#e2e8f0',
        axis: '#cbd5e1',
        axisArrow: '#94a3b8',
        outerColor: '#dc2626',
        innerColor: '#2563eb',
        compColor: '#0f172a',
        compGhost: 'rgba(15, 23, 42, 0.15)',
        guideLine: 'rgba(220, 38, 38, 0.24)',
        guideLineSnap: '#dc2626',
        laserStroke: 'rgba(15, 23, 42, 0.40)',
        laserDropStroke: 'rgba(100, 116, 139, 0.34)',
        footDot: '#64748b',
        badgeBg: 'rgba(255, 255, 255, 0.94)',
        badgeBorder: '#e2e8f0',
        badgeText: '#334155',
        snapBg: 'rgba(248, 250, 252, 0.96)',
        snapBorder: '#1e293b',
        snapText: '#0f172a',
        textMain: '#0f172a',
        textMuted: '#64748b',
        dotStroke: '#ffffff',
        handleFill: '#ffffff'
      } : {
        bg: '#0b1120',
        quadBg3: '#0b1120',
        divider: 'rgba(148, 163, 184, 0.22)',
        axis: 'rgba(148, 163, 184, 0.38)',
        axisArrow: '#94a3b8',
        outerColor: '#f87171',
        innerColor: '#60a5fa',
        compColor: '#f8fafc',
        compGhost: 'rgba(248, 250, 252, 0.20)',
        guideLine: 'rgba(248, 113, 113, 0.26)',
        guideLineSnap: '#f87171',
        laserStroke: 'rgba(226, 232, 240, 0.46)',
        laserDropStroke: 'rgba(148, 163, 184, 0.36)',
        footDot: '#94a3b8',
        badgeBg: 'rgba(15, 23, 42, 0.88)',
        badgeBorder: 'rgba(148, 163, 184, 0.26)',
        badgeText: '#e2e8f0',
        snapBg: 'rgba(15, 23, 42, 0.95)',
        snapBorder: '#cbd5e1',
        snapText: '#f8fafc',
        textMain: '#f8fafc',
        textMuted: '#94a3b8',
        dotStroke: '#0f172a',
        handleFill: '#0f172a'
      };

      const topOriginY = Math.max(TOP_QUAD_PAD_TOP - 4, Math.min(midY - TOP_QUAD_PAD_BOT + 4, toScreenY(0)));
      const topOriginX = Math.max(LEFT_QUAD_PAD_X - 6, Math.min(midX - LEFT_QUAD_PAD_X + 6, toScreenT(0)));
      const botOriginX = topOriginX;
      const botOriginY = Math.max(midY + BOT_QUAD_PAD_TOP - 4, Math.min(LOGICAL_H - BOT_QUAD_PAD_BOT + 4, toScreenLeftX(0)));
      const rOriginX = Math.max(midX + RIGHT_QUAD_PAD_X - 6, Math.min(LOGICAL_W - RIGHT_QUAD_PAD_X + 6, toScreenRightX(0)));
      const rOriginY = topOriginY;

      const snapGuideKey = activeGuideSnapInfo ? `${activeGuideSnapInfo.quad}_${activeGuideSnapInfo.axis}_${activeGuideSnapInfo.val}` : '';
      const staticCacheKey = `${targetBufW}x${targetBufH}|${isLight ? 1 : 0}|${isAutoPlaying ? 1 : 0}|${xMin},${xMax},${tMin},${tMax},${yMin},${yMax}|${snapGuideKey}`;

      if (staticStudioDirty || staticCacheKey !== lastStaticCacheKey) {
        if (staticBgCanvas.width !== targetBufW || staticBgCanvas.height !== targetBufH) {
          staticBgCanvas.width = targetBufW;
          staticBgCanvas.height = targetBufH;
        }
        const sctx = staticBgCtx;
        sctx.save();
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sctx.fillStyle = pal.bg;
        sctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

        if (pal.quadBg3 !== pal.bg) {
          sctx.fillStyle = pal.quadBg3;
          sctx.fillRect(midX, 0, LOGICAL_W - midX, midY);
        }

        // 4분할 정밀 십자 점선 구분선
        sctx.strokeStyle = pal.divider;
        sctx.lineWidth = 1.2;
        sctx.setLineDash([4, 4]);
        sctx.beginPath();
        sctx.moveTo(midX, 0);
        sctx.lineTo(midX, LOGICAL_H);
        sctx.moveTo(0, midY);
        sctx.lineTo(LOGICAL_W, midY);
        sctx.stroke();
        sctx.setLineDash([]);

        // 좌상단 겉함수 극점/첨점에서 좌하단 속함수 치역 영역으로 내려오는 세로 매칭 보조선
        for (const feat of outerCriticalFeatures) {
          const gx = toScreenT(feat.t);
          if (gx < 20 || gx > midX - 20) continue;
          const isSnappedHere = Boolean(
            activeGuideSnapInfo &&
            activeGuideSnapInfo.axis === 't' &&
            Math.abs(activeGuideSnapInfo.val - feat.t) < 1e-3
          );
          sctx.save();
          sctx.strokeStyle = isSnappedHere ? pal.guideLineSnap : pal.guideLine;
          sctx.lineWidth = isSnappedHere ? 1.9 : 1.1;
          sctx.setLineDash(isSnappedHere ? [5, 3] : [3, 4]);
          const startSy = isFinite(feat.y) ? Math.max(22, Math.min(midY - 14, toScreenY(feat.y))) : 36;
          sctx.beginPath();
          sctx.moveTo(gx, startSy);
          sctx.lineTo(gx, LOGICAL_H - 22);
          sctx.stroke();
          sctx.restore();
        }

        // 1. 좌상단 (Quadrant 1): 겉함수 y = f(t)
        sctx.save();
        sctx.beginPath();
        sctx.rect(10, 35, midX - 20, midY - 43);
        sctx.clip();

        sctx.strokeStyle = pal.axis;
        sctx.lineWidth = 1.25;
        sctx.beginPath();
        sctx.moveTo(toScreenT(tMin) - 8, topOriginY);
        sctx.lineTo(toScreenT(tMax) + 12, topOriginY);
        sctx.moveTo(topOriginX, toScreenY(yMin) + 8);
        sctx.lineTo(topOriginX, toScreenY(yMax) - 8);
        sctx.stroke();
        drawArrowHeadOnCtx(sctx, toScreenT(tMax) + 14, topOriginY, 1, 0, 6.5, pal.axisArrow);
        drawArrowHeadOnCtx(sctx, topOriginX, toScreenY(yMax) - 10, 0, -1, 6.5, pal.axisArrow);

        for (let i = 0; i <= CURVE_STEPS; i++) {
          const t = tMin + (i / CURVE_STEPS) * (tMax - tMin);
          const y = evalF(t);
          if (isFinite(y)) {
            bufSx[i] = toScreenT(t);
            bufSy[i] = toScreenY(y);
            bufValid[i] = 1;
          } else {
            bufValid[i] = 0;
          }
        }
        sctx.strokeStyle = pal.outerColor;
        sctx.lineWidth = 2.6;
        sctx.lineJoin = 'round';
        sctx.lineCap = 'round';
        drawSafeTypedCurveOnCtx(sctx, bufSx, bufSy, bufValid, CURVE_STEPS + 1);
        sctx.restore();

        drawQuadrantPillBadge(sctx, '① 겉함수 y = f(t)', 14, 10, pal);
        sctx.font = 'italic 600 12.5px "STIX Two Text", "Times New Roman", serif';
        sctx.fillStyle = pal.textMuted;
        sctx.fillText('t', toScreenT(tMax) + 5, topOriginY + 15);
        sctx.fillText('y', topOriginX + 7, Math.max(41, toScreenY(yMax) - 2));

        // 2. 좌하단 (Quadrant 2): 90° 회전 속함수 t = g(x)
        sctx.save();
        sctx.beginPath();
        sctx.rect(10, midY + 35, midX - 20, LOGICAL_H - midY - 43);
        sctx.clip();

        sctx.strokeStyle = pal.axis;
        sctx.lineWidth = 1.25;
        sctx.beginPath();
        sctx.moveTo(toScreenT(tMin) - 8, botOriginY);
        sctx.lineTo(toScreenT(tMax) + 12, botOriginY);
        sctx.moveTo(botOriginX, toScreenLeftX(xMin) - 8);
        sctx.lineTo(botOriginX, toScreenLeftX(xMax) + 12);
        sctx.stroke();
        drawArrowHeadOnCtx(sctx, toScreenT(tMax) + 14, botOriginY, 1, 0, 6.5, pal.axisArrow);
        drawArrowHeadOnCtx(sctx, botOriginX, toScreenLeftX(xMax) + 14, 0, 1, 6.5, pal.axisArrow);

        for (let i = 0; i <= CURVE_STEPS; i++) {
          const x = xMin + (i / CURVE_STEPS) * (xMax - xMin);
          const t = evalG(x);
          if (isFinite(t)) {
            bufSx[i] = toScreenT(t);
            bufSy[i] = toScreenLeftX(x);
            bufValid[i] = 1;
          } else {
            bufValid[i] = 0;
          }
        }
        sctx.strokeStyle = pal.innerColor;
        sctx.lineWidth = 2.6;
        sctx.lineJoin = 'round';
        sctx.lineCap = 'round';
        drawSafeTypedCurveOnCtx(sctx, bufSx, bufSy, bufValid, CURVE_STEPS + 1);
        sctx.restore();

        drawQuadrantPillBadge(sctx, '② 속함수 (90° 회전) t = g(x)', 14, midY + 10, pal);
        sctx.font = '500 11px Pretendard, system-ui, sans-serif';
        sctx.fillStyle = pal.textMuted;
        sctx.fillText('치역 t →', toScreenT(tMax) - 36, botOriginY - 7);
        sctx.fillText('입력 x ↓', botOriginX + 8, LOGICAL_H - 11);

        // 3. 우상단 (Quadrant 3): 최종 합성함수 y = f(g(x))
        sctx.save();
        sctx.beginPath();
        sctx.rect(midX + 10, 35, LOGICAL_W - midX - 20, midY - 43);
        sctx.clip();

        sctx.strokeStyle = pal.axis;
        sctx.lineWidth = 1.25;
        sctx.beginPath();
        sctx.moveTo(toScreenRightX(xMin) - 8, rOriginY);
        sctx.lineTo(toScreenRightX(xMax) + 12, rOriginY);
        sctx.moveTo(rOriginX, toScreenY(yMin) + 8);
        sctx.lineTo(rOriginX, toScreenY(yMax) - 8);
        sctx.stroke();
        drawArrowHeadOnCtx(sctx, toScreenRightX(xMax) + 14, rOriginY, 1, 0, 6.5, pal.axisArrow);
        drawArrowHeadOnCtx(sctx, rOriginX, toScreenY(yMax) - 10, 0, -1, 6.5, pal.axisArrow);

        for (let i = 0; i <= COMP_STEPS; i++) {
          const x = xMin + (i / COMP_STEPS) * (xMax - xMin);
          const y = evalComp(x);
          if (isFinite(y)) {
            compSx[i] = toScreenRightX(x);
            compSy[i] = toScreenY(y);
            compValid[i] = 1;
          } else {
            compValid[i] = 0;
          }
        }

        sctx.lineJoin = 'round';
        sctx.lineCap = 'round';
        sctx.strokeStyle = isAutoPlaying ? pal.compGhost : pal.compColor;
        sctx.lineWidth = isAutoPlaying ? 2.1 : 2.9;
        drawSafeTypedCurveOnCtx(sctx, compSx, compSy, compValid, COMP_STEPS + 1);
        sctx.restore();

        drawQuadrantPillBadge(sctx, '③ 최종 합성함수 y = f(g(x))', midX + 14, 10, pal);
        sctx.font = 'italic 600 12.5px "STIX Two Text", "Times New Roman", serif';
        sctx.fillStyle = pal.textMuted;
        sctx.fillText('x', toScreenRightX(xMax) + 5, rOriginY + 15);
        sctx.fillText('y', rOriginX + 7, Math.max(41, toScreenY(yMax) - 2));

        sctx.restore();
        staticStudioDirty = false;
        lastStaticCacheKey = staticCacheKey;
      }

      // ====================================================================
      // 동적 레이어 합성 (정적 배경 1회 drawImage + 실시간 추적선·노드만 초고속 드로잉)
      // ====================================================================
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(staticBgCanvas, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const tVal = evalG(currentX);
      const yVal = evalF(tVal);

      if (isAutoPlaying) {
        const spanX = Math.max(1e-6, xMax - xMin);
        const ratio = Math.max(0, Math.min(1, (currentX - xMin) / spanX));
        const cutoffCount = Math.min(COMP_STEPS + 1, Math.floor(ratio * COMP_STEPS) + 1);
        const tipOk = isFinite(yVal);
        const tipSx = tipOk ? toScreenRightX(currentX) : 0;
        const tipSy = tipOk ? toScreenY(yVal) : 0;

        ctx.save();
        ctx.beginPath();
        ctx.rect(midX + 10, 35, LOGICAL_W - midX - 20, midY - 43);
        ctx.clip();
        ctx.strokeStyle = pal.compColor;
        ctx.lineWidth = 3.0;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        drawSafeTypedCurveOnCtx(ctx, compSx, compSy, compValid, cutoffCount, 240, tipOk, tipSx, tipSy);
        ctx.restore();
      }

      // 4. 1:1 직교 추적선 & 이동 점 렌더링 (무채색 슬레이트 점선 + 정밀 벡터 노드)
      if (isFinite(tVal) && isFinite(yVal) && !draggingHandleState) {
        const sxT = toScreenT(tVal);
        const syLeftX = toScreenLeftX(currentX);
        const syTopY = toScreenY(yVal);
        const sxRightX = toScreenRightX(currentX);

        ctx.save();
        ctx.beginPath();
        ctx.rect(8, 35, LOGICAL_W - 16, LOGICAL_H - 43);
        ctx.clip();

        ctx.setLineDash([3.5, 3.5]);
        ctx.lineWidth = 1.35;

        // 축 수선의 발 보조선 (입력 x축 -> g(x), 합성점 -> 우상단 x축)
        ctx.strokeStyle = pal.laserDropStroke;
        ctx.beginPath();
        ctx.moveTo(botOriginX, syLeftX);
        ctx.lineTo(sxT, syLeftX);
        ctx.moveTo(sxRightX, syTopY);
        ctx.lineTo(sxRightX, rOriginY);
        ctx.stroke();

        // 핵심 함수간 투영선 (g(x) -> f(t) -> f(g(x)))
        ctx.strokeStyle = pal.laserStroke;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sxT, syLeftX);
        ctx.lineTo(sxT, syTopY);
        ctx.lineTo(sxRightX, syTopY);
        ctx.stroke();
        ctx.setLineDash([]);

        const drawTrackDot = (px, py, color, r = 5.2, ringW = 1.8) => {
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          if (ringW > 0) {
            ctx.lineWidth = ringW;
            ctx.strokeStyle = pal.dotStroke;
            ctx.stroke();
          }
        };

        drawTrackDot(botOriginX, syLeftX, pal.footDot, 3.3, 1.2);
        drawTrackDot(sxRightX, rOriginY, pal.footDot, 3.3, 1.2);
        drawTrackDot(sxT, syLeftX, pal.innerColor, 5.0, 1.8);
        drawTrackDot(sxT, syTopY, pal.outerColor, 5.0, 1.8);
        drawTrackDot(sxRightX, syTopY, pal.compColor, 5.8, 2.0);

        if (activeSnapLabel) {
          const badgeText = `${activeSnapLabel}  (x = ${currentX.toFixed(2)})`;
          ctx.font = '600 11px Pretendard, system-ui, sans-serif';
          const tw = ctx.measureText(badgeText).width;
          const bw = tw + 16;
          const bh = 22;
          const bx = Math.max(midX + 14, Math.min(LOGICAL_W - bw - 14, sxRightX - bw / 2));
          const by = Math.max(38, Math.min(midY - bh - 10, syTopY - 30));
          ctx.fillStyle = pal.snapBg;
          ctx.strokeStyle = pal.snapBorder;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = pal.snapText;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, bx + bw / 2, by + bh / 2 + 0.5);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
        ctx.restore();
      }

      // 5. 개형 직접 조작 핸들 렌더링 (겉함수 F & 속함수 G)
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
          const rad = isDraggingThis ? 7.0 : (isHoveredThis ? 6.4 : 5.4);

          ctx.save();
          if (isDraggingThis || isHoveredThis) {
            ctx.beginPath();
            ctx.arc(h.sx, h.sy, rad + 4.5, 0, Math.PI * 2);
            ctx.fillStyle = h.slotRole === 'F' ? 'rgba(220, 38, 38, 0.16)' : 'rgba(37, 99, 235, 0.16)';
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(h.sx, h.sy, rad, 0, Math.PI * 2);
          ctx.fillStyle = isDraggingThis ? strokeCol : pal.handleFill;
          ctx.fill();
          ctx.lineWidth = 2.1;
          ctx.strokeStyle = strokeCol;
          ctx.stroke();

          if (isDraggingThis || isHoveredThis) {
            const tip = h.name || '조절점';
            ctx.font = '600 11px Pretendard, system-ui, sans-serif';
            const tw = ctx.measureText(tip).width + 12;
            const bx = Math.max(14, Math.min(midX - tw - 14, h.sx - tw / 2));
            const by = Math.max(14, h.sy - 26);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
            ctx.beginPath();
            ctx.roundRect(bx, by, tw, 19, 5);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tip, bx + tw / 2, by + 9.5);
          }
          ctx.restore();
        });

        if (draggingHandleState && activeGuideSnapInfo) {
          ctx.save();
          const msg = activeGuideSnapInfo.label;
          ctx.font = '600 11.5px Pretendard, system-ui, sans-serif';
          const tw = ctx.measureText(msg).width + 20;
          const bx = Math.max(18, Math.min(midX - tw - 18, (midX - tw) / 2));
          const by = activeGuideSnapInfo.quad === 'G' ? (midY + 38) : (midY - 32);
          ctx.fillStyle = pal.snapBg;
          ctx.strokeStyle = pal.snapBorder;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.roundRect(bx, by, tw, 23, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = pal.snapText;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(msg, bx + tw / 2, by + 11.5);
          ctx.restore();
        }
      }

      ctx.restore();

      const snapSuffix = activeSnapLabel ? ` (${activeSnapLabel})` : '';
      const nextCurXText = `x = ${currentX.toFixed(2)}${snapSuffix}`;
      if (lblCurX && nextCurXText !== lastRenderedLblCurX) {
        lblCurX.textContent = nextCurXText;
        lastRenderedLblCurX = nextCurXText;
      }
      if (!isAutoPlaying) {
        if (dispX) { dispX.style.color = pal.innerColor; dispX.textContent = currentX.toFixed(2); }
        if (dispT) { dispT.style.color = pal.textMuted; dispT.textContent = isFinite(tVal) ? tVal.toFixed(2) : '-'; }
        if (dispY) { dispY.style.color = pal.compColor; dispY.textContent = isFinite(yVal) ? yVal.toFixed(2) : '-'; }
      }
    }

    // --- [캔버스 삽입 전용]: 깨끗한 3개 그래프(겉함수 · 90° 속함수 · 합성함수) + 좌표축 판서용 다이어그램 렌더링 ---
    const renderCompositeThreeGraphBoardCardDataUrl = () => {
      const cardW = 1040;
      const cardH = 740;
      const cMidX = 520;
      const cMidY = 370;
      const dpr = 2;

      const offCv = document.createElement('canvas');
      offCv.width = cardW * dpr;
      offCv.height = cardH * dpr;
      const octx = offCv.getContext('2d');

      const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || null;
      const isLight = curTheme ? (curTheme.isLight !== false) : document.body.classList.contains('theme-light');
      const isMono = Boolean(this.isMonochromeMode);

      const bgCol = isMono ? '#ffffff' : ((curTheme && curTheme.bg) ? curTheme.bg : (isLight ? '#ffffff' : '#0f1e19'));
      const dividerCol = isMono ? 'rgba(15, 23, 42, 0.16)' : (isLight ? 'rgba(148, 163, 184, 0.42)' : 'rgba(148, 163, 184, 0.24)');
      const axisCol = isMono ? '#0f172a' : (isLight ? '#1e293b' : 'rgba(248, 250, 252, 0.85)');
      const outerCol = isMono ? '#0f172a' : (isLight ? '#dc2626' : '#ff6b6b');
      const innerCol = isMono ? '#0f172a' : (isLight ? '#2563eb' : '#54a0ff');
      const compCol = isMono ? '#0f172a' : (isLight ? '#0f172a' : '#f8fafc');

      const padX = 54;
      const padTop = 56;
      const padBot = 50;

      // 1:1 정밀 축 정렬 매핑 함수 (직선 도구로 수직·수평선 판서 시 오차 0.000px)
      const cMapT = (t) => padX + ((t - tMin) / Math.max(1e-6, tMax - tMin)) * (cMidX - padX * 2);
      const cMapY = (y) => padTop + ((yMax - y) / Math.max(1e-6, yMax - yMin)) * (cMidY - padTop - padBot);
      const cMapLeftX = (x) => cMidY + padTop + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * ((cardH - cMidY) - padTop - padBot);
      const cMapRightX = (x) => cMidX + padX + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * ((cardW - cMidX) - padX * 2);

      const tOriginX = Math.max(padX - 8, Math.min(cMidX - padX + 8, cMapT(0)));
      const yOriginY = Math.max(padTop - 8, Math.min(cMidY - padBot + 8, cMapY(0)));
      const gOriginY = Math.max(cMidY + padTop - 8, Math.min(cardH - padBot + 8, cMapLeftX(0)));
      const rOriginX = Math.max(cMidX + padX - 8, Math.min(cardW - padX + 8, cMapRightX(0)));

      const showX = this.showXAxis !== false;
      const showY = this.showYAxis !== false;
      const sampleSteps = 960;

      octx.save();
      octx.scale(dpr, dpr);
      octx.fillStyle = bgCol;
      octx.fillRect(0, 0, cardW, cardH);

      // 은은한 십자 구획선 (선생님의 필기·보조선을 방해하지 않는 최소 명암)
      octx.save();
      octx.strokeStyle = dividerCol;
      octx.lineWidth = 1.2;
      octx.setLineDash([5, 6]);
      octx.beginPath();
      octx.moveTo(cMidX, 18);
      octx.lineTo(cMidX, cardH - 18);
      octx.moveTo(18, cMidY);
      octx.lineTo(cardW - 18, cMidY);
      octx.stroke();
      octx.restore();

      // ------------------------------------------------------------------
      // (1) 좌상단: 겉함수 y = f(t)
      // ------------------------------------------------------------------
      octx.save();
      octx.beginPath();
      octx.rect(16, 36, cMidX - 28, cMidY - 48);
      octx.clip();

      octx.strokeStyle = axisCol;
      octx.lineWidth = 1.75;
      octx.beginPath();
      if (showX) {
        octx.moveTo(cMapT(tMin) - 10, yOriginY);
        octx.lineTo(cMapT(tMax) + 14, yOriginY);
      }
      if (showY) {
        octx.moveTo(tOriginX, cMapY(yMin) + 10);
        octx.lineTo(tOriginX, cMapY(yMax) - 10);
      }
      octx.stroke();
      if (showX) drawArrowHeadOnCtx(octx, cMapT(tMax) + 16, yOriginY, 1, 0, 8.5, axisCol);
      if (showY) drawArrowHeadOnCtx(octx, tOriginX, cMapY(yMax) - 12, 0, -1, 8.5, axisCol);

      const ptsF = [];
      for (let i = 0; i <= sampleSteps; i++) {
        const t = tMin + (i / sampleSteps) * (tMax - tMin);
        const y = evalF(t);
        ptsF.push(isFinite(y) ? { sx: cMapT(t), sy: cMapY(y) } : null);
      }
      octx.strokeStyle = outerCol;
      octx.lineWidth = 3.2;
      octx.lineJoin = 'round';
      octx.lineCap = 'round';
      drawSafeCurveOnCtx(octx, ptsF, 260);
      octx.restore();

      octx.fillStyle = axisCol;
      octx.font = 'italic 600 16px "STIX Two Text", "Times New Roman", serif';
      if (showX) octx.fillText('t', cMapT(tMax) + 8, yOriginY + 19);
      if (showY) octx.fillText('y', tOriginX + 9, Math.max(44, cMapY(yMax) - 4));
      if (showX && showY && tMin <= 0 && tMax >= 0 && yMin <= 0 && yMax >= 0) {
        octx.font = 'italic 500 14px "STIX Two Text", "Times New Roman", serif';
        octx.fillText('O', tOriginX - 16, yOriginY + 17);
      }
      octx.fillStyle = outerCol;
      octx.font = 'italic 700 15.5px "STIX Two Text", "Times New Roman", serif';
      octx.fillText('y = f(t)', 22, 26);

      // ------------------------------------------------------------------
      // (2) 좌하단: 90° 회전 속함수 t = g(x)
      // ------------------------------------------------------------------
      octx.save();
      octx.beginPath();
      octx.rect(16, cMidY + 36, cMidX - 28, cardH - cMidY - 50);
      octx.clip();

      octx.strokeStyle = axisCol;
      octx.lineWidth = 1.75;
      octx.beginPath();
      if (showY) {
        octx.moveTo(cMapT(tMin) - 10, gOriginY);
        octx.lineTo(cMapT(tMax) + 14, gOriginY);
      }
      if (showX) {
        octx.moveTo(tOriginX, cMapLeftX(xMin) - 10);
        octx.lineTo(tOriginX, cMapLeftX(xMax) + 12);
      }
      octx.stroke();
      if (showY) drawArrowHeadOnCtx(octx, cMapT(tMax) + 16, gOriginY, 1, 0, 8.5, axisCol);
      if (showX) drawArrowHeadOnCtx(octx, tOriginX, cMapLeftX(xMax) + 14, 0, 1, 8.5, axisCol);

      const ptsG = [];
      for (let i = 0; i <= sampleSteps; i++) {
        const x = xMin + (i / sampleSteps) * (xMax - xMin);
        const t = evalG(x);
        ptsG.push(isFinite(t) ? { sx: cMapT(t), sy: cMapLeftX(x) } : null);
      }
      octx.strokeStyle = innerCol;
      octx.lineWidth = 3.2;
      octx.lineJoin = 'round';
      octx.lineCap = 'round';
      drawSafeCurveOnCtx(octx, ptsG, 260);
      octx.restore();

      octx.fillStyle = axisCol;
      octx.font = 'italic 600 16px "STIX Two Text", "Times New Roman", serif';
      if (showY) octx.fillText('t', cMapT(tMax) + 8, gOriginY + 19);
      if (showX) octx.fillText('x', tOriginX + 10, Math.min(cardH - 12, cMapLeftX(xMax) + 18));
      if (showX && showY && tMin <= 0 && tMax >= 0 && xMin <= 0 && xMax >= 0) {
        octx.font = 'italic 500 14px "STIX Two Text", "Times New Roman", serif';
        octx.fillText('O', tOriginX - 16, gOriginY + 17);
      }
      octx.fillStyle = innerCol;
      octx.font = 'italic 700 15.5px "STIX Two Text", "Times New Roman", serif';
      octx.fillText('t = g(x)', 22, cMidY + 26);

      // ------------------------------------------------------------------
      // (3) 우상단: 최종 합성함수 y = f(g(x))
      // ------------------------------------------------------------------
      octx.save();
      octx.beginPath();
      octx.rect(cMidX + 12, 36, cardW - cMidX - 28, cMidY - 48);
      octx.clip();

      octx.strokeStyle = axisCol;
      octx.lineWidth = 1.75;
      octx.beginPath();
      if (showX) {
        octx.moveTo(cMapRightX(xMin) - 10, yOriginY);
        octx.lineTo(cMapRightX(xMax) + 14, yOriginY);
      }
      if (showY) {
        octx.moveTo(rOriginX, cMapY(yMin) + 10);
        octx.lineTo(rOriginX, cMapY(yMax) - 10);
      }
      octx.stroke();
      if (showX) drawArrowHeadOnCtx(octx, cMapRightX(xMax) + 16, yOriginY, 1, 0, 8.5, axisCol);
      if (showY) drawArrowHeadOnCtx(octx, rOriginX, cMapY(yMax) - 12, 0, -1, 8.5, axisCol);

      const ptsComp = [];
      for (let i = 0; i <= 1200; i++) {
        const x = xMin + (i / 1200) * (xMax - xMin);
        const y = evalComp(x);
        ptsComp.push(isFinite(y) ? { sx: cMapRightX(x), sy: cMapY(y) } : null);
      }
      octx.strokeStyle = compCol;
      octx.lineWidth = 3.4;
      octx.lineJoin = 'round';
      octx.lineCap = 'round';
      drawSafeCurveOnCtx(octx, ptsComp, 260);
      octx.restore();

      octx.fillStyle = axisCol;
      octx.font = 'italic 600 16px "STIX Two Text", "Times New Roman", serif';
      if (showX) octx.fillText('x', cMapRightX(xMax) + 8, yOriginY + 19);
      if (showY) octx.fillText('y', rOriginX + 9, Math.max(44, cMapY(yMax) - 4));
      if (showX && showY && xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0) {
        octx.font = 'italic 500 14px "STIX Two Text", "Times New Roman", serif';
        octx.fillText('O', rOriginX - 16, yOriginY + 17);
      }
      octx.fillStyle = compCol;
      octx.font = 'italic 700 15.5px "STIX Two Text", "Times New Roman", serif';
      octx.fillText('y = f(g(x))', cMidX + 20, 26);

      octx.restore();
      return {
        dataUrl: offCv.toDataURL('image/png'),
        offCanvas: offCv,
        aspect: cardH / cardW
      };
    };

    const ICON_STUDIO_PLAY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4" /></svg><span>자동 순항</span>`;
    const ICON_STUDIO_PAUSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg><span>정지</span>`;
    const ICON_CHIP_CHECK = `<svg class="n-axis-chip-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>`;

    const setStudioChipContent = (el, text, isActive) => {
      el.innerHTML = isActive ? ICON_CHIP_CHECK : '';
      const span = document.createElement('span');
      span.textContent = text;
      el.appendChild(span);
    };

    // --- 우하단 비주얼 슬롯 칩 UI 동기화 (기본 프리셋 0개, 캔버스 세팅 함수만 표출) ---
    function syncSlotControllerUI() {
      if (lblActiveG) lblActiveG.textContent = getSlotDisplayTitle(slotG);
      if (lblActiveF) lblActiveF.textContent = getSlotDisplayTitle(slotF);

      const renderChipsFor = (container, slot, isInner) => {
        if (!container) return;
        container.innerHTML = '';

        if (availableCanvasCandidates.length === 0) {
          // 보관된 카드 복원 시 현재 화면에 원본 카드가 없는 경우 현재 보관된 슬롯 정보 배지만 깔끔히 표출
          const badge = document.createElement('span');
          badge.className = 'n-axis-chip n-axis-canvas-chip active';
          badge.style.cursor = 'default';
          setStudioChipContent(badge, slot.label || '보관된 함수', true);
          container.appendChild(badge);
          return;
        }

        availableCanvasCandidates.forEach(cand => {
          const isActive = slot.sourceId === cand.id;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'n-axis-chip n-axis-canvas-chip' + (isActive ? ' active' : '');
          setStudioChipContent(btn, cand.label, isActive);
          btn.addEventListener('click', () => {
            const nextSlot = makeSlotFromCanvasCandidate(cand);
            if (isInner) {
              slotG = nextSlot;
              autoFitRange(true);
            } else {
              slotF = nextSlot;
              autoFitRange(false);
            }
            invalidateStaticStudioCache();
            syncSlotControllerUI();
            renderStudio();
          });
          container.appendChild(btn);
        });
      };

      renderChipsFor(chipsContainerG, slotG, true);
      renderChipsFor(chipsContainerF, slotF, false);
    }

    let lastAutoPlayTs = 0;
    function loopAutoPlay(now) {
      if (!isAutoPlaying) return;
      const ts = typeof now === 'number' ? now : performance.now();
      const rawDt = lastAutoPlayTs > 0 ? (ts - lastAutoPlayTs) / 1000 : (1 / 60);
      lastAutoPlayTs = ts;
      const dt = (rawDt > 0 && rawDt < 0.25) ? Math.min(rawDt, 0.05) : (1 / 60);

      const span = Math.max(0.5, xMax - xMin);
      currentX += (span / 7.0) * playSpeed * dt;
      activeSnapLabel = null;
      if (currentX > xMax) currentX = xMin + ((currentX - xMax) % span);
      if (sliderX) sliderX.value = currentX;
      renderStudio();
      autoPlayAnimId = requestAnimationFrame(loopAutoPlay);
    }

    const stopAutoPlay = () => {
      isAutoPlaying = false;
      lastAutoPlayTs = 0;
      if (autoPlayAnimId) {
        cancelAnimationFrame(autoPlayAnimId);
        autoPlayAnimId = null;
      }
      if (btnAutoPlay) {
        btnAutoPlay.classList.remove('is-playing');
        btnAutoPlay.innerHTML = ICON_STUDIO_PLAY;
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
        currentX: typeof currentX === 'number' ? currentX : 0.0,
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
      invalidateStaticStudioCache();
      return true;
    };

    const openModal = (studioState = null) => {
      stopAutoPlay();

      // 보관된 합성함수 카드에서 [크게 열기]로 진입했을 때 _editingGraphCardTarget 잔류 오염 원천 방지
      if (this._editingGraphCardTarget) {
        this._editingGraphCardTarget = null;
      }

      const isValidStateObj = Boolean(
        studioState &&
        typeof studioState === 'object' &&
        !(typeof Event !== 'undefined' && studioState instanceof Event) &&
        (studioState.slotG || typeof studioState.exprG === 'string' || typeof studioState.currentX === 'number')
      );

      availableCanvasCandidates = this.collectAvailableCanvasGraphs();

      // 보관 카드 복원이 아닐 때는 화면에 최소 2개의 함수 그래프(#1, #2)가 필수!
      if (!isValidStateObj && availableCanvasCandidates.length < 2) {
        if (typeof this.openNAxisSetupNoticeModal === 'function') {
          this.openNAxisSetupNoticeModal(availableCanvasCandidates);
        }
        return;
      }

      if (typeof this.closeNAxisSetupNoticeModal === 'function') {
        const noticeEl = document.getElementById('modalNAxisSetupNotice');
        if (noticeEl && noticeEl.classList.contains('show')) {
          noticeEl.classList.remove('show');
          noticeEl.style.display = 'none';
          this.isMathToolkitOpen = false;
        }
      }

      this._pauseAudioForToolkitIfNeeded();

      if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }

      this.isNAxisStudioOpen = true;
      modal.style.display = 'flex';
      modal.classList.add('show');

      if (isValidStateObj) {
        applyNAxisStudioState(studioState);
      } else {
        // 2개 이상(3개 이상 포함) 세팅 완료 시 기본 #1 = 속함수 g(x), #2 = 겉함수 f(t) 자동 세팅!
        slotG = makeSlotFromCanvasCandidate(availableCanvasCandidates[0]);
        slotF = makeSlotFromCanvasCandidate(availableCanvasCandidates[1]);
        currentX = (slotG.viewXMin + slotG.viewXMax) * 0.5;
        autoFitRange(true);
      }

      invalidateStaticStudioCache();
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

    // 좌측 레일 버튼(#btnRailNAxis)은 data-panel="panelToolkit"을 통해 initRailDrawer()에서 표준 서랍 토글로 제어
    if (btnRail && !btnRail.dataset.panel) btnRail.onclick = () => this.openMathToolkitHub();
    if (btnQuick) btnQuick.onclick = () => openModal();
    if (btnClose) btnClose.onclick = closeModal;

    // 🌟 [캔버스 삽입]: 깨끗한 3개 그래프(겉함수 · 90° 속함수 · 합성함수) + 좌표축을 판서용 카드로 삽입!
    if (btnArchive) {
      btnArchive.onclick = (e) => {
        e.stopPropagation();
        const exported = renderCompositeThreeGraphBoardCardDataUrl();
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
          this._pushWorkspaceUndoSnapshot('↺ 합성함수 다이어그램 삽입 취소됨', '↻ 합성함수 다이어그램 다시 삽입됨');
        }

        closeModal();

        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 800;
        const insertCardW = Math.round(Math.min(540, Math.max(340, vw * 0.40)));
        const insertCardH = Math.round(insertCardW * exported.aspect);
        const spawnScreenX = Math.round(Math.max(82, Math.min(vw - insertCardW - 36, vw * 0.50)));
        const spawnScreenY = Math.round(Math.max(64, Math.min(vh - insertCardH - 96, 72)));

        const createdRef = this.setGraphCard(
          exported.dataUrl,
          exported.offCanvas,
          insertCardW,
          { x: spawnScreenX, y: spawnScreenY, w: insertCardW, h: insertCardH },
          studioSnapshotStr,
          {
            alreadyInBoardMode: wasInBoardMode,
            cardW: insertCardW,
            aspect: exported.aspect,
            forceScreenPos: true
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
        this.showToast('합성함수 3-그래프 도면을 캔버스에 삽입했습니다. 펜이나 직선으로 보조선을 그어 필기해 보세요.');
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
        const clampedY = Math.max(midY + BOT_QUAD_PAD_TOP, Math.min(LOGICAL_H - BOT_QUAD_PAD_BOT, my));
        nextX = fromScreenLeftX(clampedY);
      } else if (mx >= midX && my <= midY) {
        const w = (LOGICAL_W - midX) - RIGHT_QUAD_PAD_X * 2;
        const clampedX = Math.max(midX + RIGHT_QUAD_PAD_X, Math.min(LOGICAL_W - RIGHT_QUAD_PAD_X, mx));
        nextX = xMin + ((clampedX - (midX + RIGHT_QUAD_PAD_X)) / Math.max(1, w)) * (xMax - xMin);
      } else if (mx < midX && my <= midY) {
        const targetT = fromScreenT(Math.max(LEFT_QUAD_PAD_X, Math.min(midX - LEFT_QUAD_PAD_X, mx)));
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
        invalidateStaticStudioCache();
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
          renderStudio();
        } else {
          isAutoPlaying = true;
          lastAutoPlayTs = performance.now();
          btnAutoPlay.classList.add('is-playing');
          btnAutoPlay.innerHTML = ICON_STUDIO_PAUSE;
          if (currentX >= xMax - (xMax - xMin) * 0.02) currentX = xMin;
          loopAutoPlay(lastAutoPlayTs);
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
        invalidateStaticStudioCache();
        syncSlotControllerUI();
        renderStudio();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const noticeModal = document.getElementById('modalNAxisSetupNotice');
        if (noticeModal && noticeModal.classList.contains('show') && typeof this.closeNAxisSetupNoticeModal === 'function') {
          e.preventDefault();
          this.closeNAxisSetupNoticeModal();
          return;
        }
        if (this.isNAxisStudioOpen) {
          e.preventDefault();
          closeModal();
          return;
        }
        if (typeof this._activeToolkitCloseFn === 'function') {
          e.preventDefault();
          const closeCustomFn = this._activeToolkitCloseFn;
          this.closeToolkitModalSession();
          closeCustomFn();
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
