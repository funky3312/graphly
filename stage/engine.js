/**
 * Graph Master Web - Core Mathematical Engine
 * 파이썬 v2.0의 고교 미적분/대수학 곡선 수치해석 엔진 1:1 웹 네이티브 포팅
 * (더블 클릭 file:// 실행 및 로컬 서버 실행 100% 양방향 완벽 호환)
 */

const FUNC_METADATA = {
  // 1. 다항함수 (1차 -> 2차 -> 3차 3종 -> 4차 5종: 판별식/극값 생성 진화 순서 정렬)
  "1st_linear": {
    name: "일차함수",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><line x1="4" y1="16" x2="20" y2="4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "기준점", x: 0.0, y: 0.0, type: "vertex" },
      { name: "기울기", x: 2.0, y: 2.0, type: "point" }
    ]
  },
  "2nd_quadratic": {
    name: "이차함수",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 5 Q12 21 20 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "꼭짓점", x: 0.0, y: 0.0, type: "vertex" },
      { name: "조절점", x: 1.0, y: 1.0, type: "point" }
    ]
  },
  "3rd_monotonic": {
    name: "삼차 (단조)",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 18 C7.5 12, 9.5 11.2, 12 10 C14.5 8.8, 16.5 8, 20 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "변곡점", x: 0.0, y: 0.0, type: "inflection" },
      { name: "조절점", x: 1.4, y: 2.2, type: "point" }
    ]
  },
  "3rd_basic_cubic": {
    name: "삼차 기본 (y=x³)",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 17 C9 17, 9.5 10, 12 10 C14.5 10, 15 3, 20 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "변곡점", x: 0.0, y: 0.0, type: "inflection" },
      { name: "조절점", x: 1.2, y: 1.7, type: "point" }
    ]
  },
  "3rd_normal": {
    name: "삼차함수",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 16 C7 3, 10 3, 12 10 C14 17, 17 17, 20 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "극대", x: -1.0, y: 2.0, type: "max" },
      { name: "극소", x: 1.0, y: -2.0, type: "min" },
      { name: "변곡점", x: 0.0, y: 0.0, type: "inflection" }
    ]
  },
  "4th_basic_bowl": {
    name: "사차 기본 (y=x⁴)",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 5 C7 19, 17 19, 20 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "극소", x: 0.0, y: -2.0, type: "min" },
      { name: "조절점", x: 1.4, y: 1.8, type: "point" }
    ]
  },
  "4th_skew": {
    name: "사차함수 1",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 4 C6 9, 8 10.2, 10 11.8 C12 13.4, 13.2 16.5, 15 16.5 C17 16.5, 18.5 10, 20 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "극소", x: 1.0, y: -2.0, type: "min" },
      { name: "굴곡점", x: -1.0, y: 1.0, type: "point" }
    ]
  },
  "4th_inflection": {
    name: "사차함수 2",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 5 C6 9.5 7.5 9.5 9.5 9.5 C11.5 9.5 12.5 16 14.5 16 C16.5 16 18 10 20 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "변곡점", x: -1.0, y: 1.0, type: "inflection" },
      { name: "극소", x: 1.0, y: -2.0, type: "min" }
    ]
  },
  "4th_symmetric": {
    name: "사차함수 3",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 5 Q6 17 8.5 11 Q12 6 15.5 11 Q18 17 20 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "극소", x: -1.5, y: -2.0, type: "min" },
      { name: "극대", x: 0.0, y: 1.0, type: "max" },
      { name: "극소", x: 1.5, y: -2.0, type: "min" }
    ]
  },
  "4th_asymmetric": {
    name: "사차함수 4",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 7 Q6.5 14 9 10 Q11 6 13 11 Q16 20 20 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "극소", x: -1.5, y: -1.8, type: "min" },
      { name: "극대", x: -0.1, y: 1.0, type: "max" },
      { name: "극소", x: 1.5, y: -3.0, type: "min" }
    ]
  },

  // 2. 지수·로그
  "exp_basic": {
    name: "지수함수",
    category: "📈 지수·로그",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 17 Q14 16 20 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "기준점", x: 0.0, y: 0.0, type: "center" },
      { name: "조절점", x: 1.0, y: 2.0, type: "point" }
    ]
  },
  "log_basic": {
    name: "로그함수",
    category: "📈 지수·로그",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M6 18 Q7 7 20 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "기준점", x: 0.0, y: 0.0, type: "center" },
      { name: "조절점", x: 2.0, y: 1.0, type: "point" }
    ]
  },

  // 3. 유리·무리
  "rational_basic": {
    name: "유리함수",
    category: "🔀 유리·무리",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 10 Q10 10 10 4 M14 18 Q14 12 20 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "대칭중심", x: 0.0, y: 0.0, type: "center" },
      { name: "조절점", x: 1.0, y: 1.0, type: "point" }
    ]
  },
  "sqrt_basic": {
    name: "무리함수",
    category: "🔀 유리·무리",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><circle cx="6" cy="14" r="1.8" fill="currentColor"/><path d="M6 14 Q10 6 20 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "시작점", x: 0.0, y: 0.0, type: "vertex" },
      { name: "조절점", x: 2.0, y: 2.0, type: "point" }
    ]
  },

  // 4. 삼각함수 (깔끔한 기본형)
  "sin_1period": {
    name: "sin(x)",
    category: "🌊 삼각함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 10 Q8 2 12 10 Q16 18 20 10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "대칭중심", x: 0.0, y: 0.0, type: "center" },
      { name: "조절점", x: 1.57, y: 1.5, type: "point" }
    ]
  },
  "cos_1period": {
    name: "cos(x)",
    category: "🌊 삼각함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 4 Q8 17 12 17 Q16 17 20 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "대칭중심", x: 0.0, y: 0.0, type: "center" },
      { name: "조절점", x: 6.28, y: 1.5, type: "point" }
    ]
  },
  "tan_1period": {
    name: "tan(x)",
    category: "🌊 삼각함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M6 18 Q12 10 18 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "대칭중심", x: 0.0, y: 0.0, type: "center" },
      { name: "조절점", x: 0.785, y: 1.5, type: "point" }
    ]
  },

  // 5. 🔥 수능 킬러 미적분 (수능 28~30번 단골 초월함수 4대 개형)
  "killer_frac_odd": {
    name: "ax/(x²+b)",
    category: "🔥 수능 킬러",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 10 C7 10 8 5 10 5 C12 5 12 15 14 15 C16 15 17 10 20 10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "대칭중심", x: 0.0, y: 0.0, type: "center" },
      { name: "극대", x: 1.5, y: 1.5, type: "max" }
    ]
  },
  "killer_exp_linear": {
    name: "ax·e⁻ᵇˣ",
    category: "🔥 수능 킬러",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 14 Q7 14 9 5 Q12 5 20 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "통과점(원점)", x: 0.0, y: 0.0, type: "vertex", hidden: true },
      { name: "극대", x: 1.5, y: 1.8, type: "max" }
    ]
  },
  "killer_exp_quad": {
    name: "ax²·e⁻ᵇˣ",
    category: "🔥 수능 킬러",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 14 C7 14 8 14 10 6 C12 6 14 13 20 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "원점 접점", x: 0.0, y: 0.0, type: "min", hidden: true },
      { name: "극대", x: 2.0, y: 1.8, type: "max" }
    ]
  },
  "killer_log_frac": {
    name: "a·lnx/x",
    category: "🔥 수능 킬러",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M5 18 Q6 6 10 6 Q14 6 20 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "기준점", x: 0.0, y: 0.0, type: "center" },
      { name: "극대", x: 2.718, y: 1.2, type: "max" }
    ]
  },

  // 6. 📐 평면도형 (수능/내신 기하 융합 3대 도형)
  "geom_circle": {
    name: "원",
    category: "📐 평면도형",
    isGeometry: true,
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><circle cx="12" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
    handles: [
      { name: "중심", x: 0.0, y: 0.0, type: "center" },
      { name: "반지름", x: 2.5, y: 0.0, type: "point" }
    ]
  },
  "geom_triangle": {
    name: "삼각형",
    category: "📐 평면도형",
    isGeometry: true,
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><polygon points="12,3 4,17 20,17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
    handles: [
      { name: "A", x: -2.0, y: -1.5, type: "vertex" },
      { name: "B", x: 2.0, y: -1.5, type: "vertex" },
      { name: "C", x: 0.0, y: 2.0, type: "vertex" }
    ]
  },
  "geom_quad": {
    name: "사각형",
    category: "📐 평면도형",
    isGeometry: true,
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><polygon points="5,5 19,5 17,16 7,16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
    handles: [
      { name: "A", x: -2.0, y: -1.5, type: "vertex" },
      { name: "B", x: 2.0, y: -1.5, type: "vertex" },
      { name: "C", x: 2.0, y: 1.5, type: "vertex" },
      { name: "D", x: -2.0, y: 1.5, type: "vertex" }
    ]
  },

  // 🌐 범용 수식 f(x) (Desmos 동등 임의 수식 렌더링 & 평행이동)
  "general_expr": {
    name: "범용 수식",
    category: "🌐 범용 수식",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 16 Q8 4 12 10 T20 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "중심", x: 0.0, y: 0.0, type: "center" }
    ]
  }
};

class GraphMathEngine {
  // 기본 핸들/특이점 X좌표 -> 변환(대칭·다단변환·평행이동) 반영 월드 X좌표
  static baseXToWorldX(g, baseX) {
    if (!g || typeof baseX !== 'number' || isNaN(baseX)) return baseX;
    let wx = baseX;
    if (g.transforms && g.transforms.length > 0) {
      for (let ti = 0; ti < g.transforms.length; ti++) {
        const t = g.transforms[ti];
        if (!t) continue;
        if (t.invertH) wx = -wx;
        if (t.offset && typeof t.offset.x === 'number') wx += t.offset.x;
      }
    }
    if (g.frozenInvertH) wx = -wx;
    const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    return wx + ox;
  }

  // 월드 X좌표 -> 내부 기본 함수 평가용 X좌표 (baseXToWorldX의 정확한 역변환)
  static worldXToBaseX(g, worldX) {
    if (!g || typeof worldX !== 'number' || isNaN(worldX)) return worldX;
    const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    let curX = worldX - ox;
    if (g.frozenInvertH) curX = -curX;
    if (g.transforms && g.transforms.length > 0) {
      for (let ti = g.transforms.length - 1; ti >= 0; ti--) {
        const t = g.transforms[ti];
        if (!t) continue;
        if (t.offset && typeof t.offset.x === 'number') curX -= t.offset.x;
        if (t.invertH) curX = -curX;
      }
    }
    return curX;
  }

  // 기본 함수 Y값(수평 점근선·도형 꼭짓점 등) -> 변환(절댓값·대칭·다단변환·평행이동) 반영 월드 Y좌표
  static baseYToWorldY(g, baseY, applyAbs = true) {
    if (!g || typeof baseY !== 'number' || isNaN(baseY) || !isFinite(baseY)) return NaN;
    let wy = baseY;
    if (applyAbs && g.isAbsolute) wy = Math.abs(wy);
    if (g.transforms && g.transforms.length > 0) {
      for (let ti = 0; ti < g.transforms.length; ti++) {
        const t = g.transforms[ti];
        if (!t) continue;
        if (t.offset && typeof t.offset.y === 'number') wy += t.offset.y;
        if (t.invertV) wy = -wy;
        if (applyAbs && t.abs) wy = Math.abs(wy);
      }
    }
    if (g.frozenInvertV) wy = -wy;
    const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    wy += oy;
    if (applyAbs && g.frozenAbsolute) wy = Math.abs(wy);
    return wy;
  }

  // 핸들(극점·중심·점근선·도형 꼭짓점)의 월드 (x, y) 좌표 통합 산출 (다단변환·대칭·절댓값·y=x 전치 완벽 호환)
  static getHandleWorldPos(g, h) {
    if (!g || !h) return { x: 0, y: 0 };
    const isGeom = typeof g.type === 'string' && g.type.startsWith('geom_');
    const isVertLine = g.type === '1st_linear' && Array.isArray(g.handles) && g.handles.length >= 2 &&
      Math.abs(g.handles[1].x - g.handles[0].x) < 1e-4;
    const paramPos = GraphMathEngine.baseXToWorldX(g, h.x);
    let valPos;
    if (isGeom) {
      valPos = GraphMathEngine.baseYToWorldY(g, h.y, true);
    } else if (isVertLine || h.type === 'center' || h.type === 'asymptote') {
      valPos = GraphMathEngine.baseYToWorldY(g, h.y, false);
    } else {
      valPos = GraphMathEngine.evaluatePipeline(g, paramPos);
      if (typeof valPos !== 'number' || isNaN(valPos) || !isFinite(valPos)) {
        valPos = GraphMathEngine.baseYToWorldY(g, h.y, true);
      }
    }
    if (g.isTransposedYX) {
      return { x: valPos, y: paramPos };
    }
    return { x: paramPos, y: valPos };
  }

  // JSON 직렬화 복원 후 범용 수식(general_expr) 컴파일 함수(fn) 자동 재수화 및 구버전 핸들 정규화
  static ensureCompiledFunctions(graphs) {
    if (!Array.isArray(graphs)) return;
    for (let i = 0; i < graphs.length; i++) {
      const g = graphs[i];
      if (!g || !Array.isArray(g.handles) || g.handles.length === 0) continue;
      if (g.type === '4th_skew' && g.handles.length > 2) {
        g.handles = g.handles.slice(0, 2);
        const isUp = g.handles[1].y >= g.handles[0].y;
        g.handles[0].type = isUp ? 'min' : 'max';
        g.handles[0].name = isUp ? '극소' : '극대';
      }
      if (g.type !== 'general_expr') continue;
      const h0 = g.handles[0];
      const exprSrc = h0.rawExpr || g.customExpr || '';
      if (typeof h0.fn !== 'function' && exprSrc && typeof SafeMathCompiler !== 'undefined') {
        const comp = SafeMathCompiler.compile(exprSrc);
        if (comp && comp.success && typeof comp.fn === 'function') {
          h0.fn = comp.fn;
          if (!h0.rawExpr) h0.rawExpr = exprSrc;
        }
      }
    }
  }

  // --- [❄️ 무한 다단 절댓값 & 형상 평행이동 계층형 파이프라인] ---
  static evaluatePipeline(g, x) {
    if (!g) return 0.0;
    if (typeof g._periodicEval === 'function') {
      return g._periodicEval(x);
    }
    if (!g.handles || g.handles.length === 0) return NaN;

    const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    const hasOuter = g.isFrozen || ox !== 0 || oy !== 0 || g.frozenInvertH || g.frozenInvertV || g.frozenAbsolute || (g.transforms && g.transforms.length > 0);

    if (!hasOuter) {
      // [순수 1차 기본 수식]
      let y = GraphMathEngine.evaluate(g.type, g.handles, x);
      if (isNaN(y) || !isFinite(y)) return NaN;
      if (g.isAbsolute) y = Math.abs(y);
      return y;
    }

    const evalX = GraphMathEngine.worldXToBaseX(g, x);
    const rawY = GraphMathEngine.evaluate(g.type, g.handles, evalX);
    if (isNaN(rawY) || !isFinite(rawY)) return NaN;
    return GraphMathEngine.baseYToWorldY(g, rawY);
  }

  // 사차함수 1 (극값 1개 + f'=0 허근 비대칭 U형: f'(x) = 4a(x-x0)[(x-x1)^2 + T*d^2], T > 0 고정 2핸들 직관형)
  static _solve4thSkewParams(handles) {
    const x0 = handles[0].x, y0 = handles[0].y;
    const h1 = (handles.length >= 2 && handles[1]) ? handles[1] : { x: x0 - 2.0, y: y0 + 3.0 };
    const x1 = h1.x, y1 = h1.y;
    let d = x1 - x0;
    if (Math.abs(d) < 1e-4) d = d >= 0 ? 1e-4 : -1e-4;
    let dy1 = y1 - y0;
    if (Math.abs(dy1) < 1e-4) dy1 = dy1 >= 0 ? 1e-4 : -1e-4;

    // 황금 허근 비율 고정 (0 < T < 1/3: 수평변곡과 확실히 구별되는 기울어진 변곡 어깨 유지 & 핸들 100% 직관 추종)
    const T = 0.085;
    const scaleDenom = Math.pow(d, 4) * (1.0 / 3.0 + 2.0 * T);
    let a = dy1 / Math.max(1e-8, scaleDenom);
    a = Math.max(-10000.0, Math.min(10000.0, a));
    return { x0, y0, d, dy1, T, a };
  }

  static evaluate(ftype, handles, x) {
    switch (ftype) {
      case "4th_skew": {
        const { x0, y0, d, T, a } = GraphMathEngine._solve4thSkewParams(handles);
        const u = x - x0;
        const poly = Math.pow(u, 4) - (8.0 / 3.0) * d * Math.pow(u, 3) + 2.0 * (1.0 + T) * d * d * u * u;
        return y0 + a * poly;
      }

      case "4th_symmetric": {
        const x0 = handles[1].x;
        const p = Math.max(0.2, Math.abs(handles[2].x - x0));
        const y_min = handles[2].y;
        const y_max = handles[1].y;
        const denom = Math.max(1e-4, Math.pow(p, 4));
        let a = (y_max - y_min) / denom;
        a = Math.max(-500.0, Math.min(500.0, a));
        const diff = Math.pow(x - x0, 2) - Math.pow(p, 2);
        return a * Math.pow(diff, 2) + y_min;
      }

      case "4th_asymmetric": {
        let h1 = handles[0], h2 = handles[1], h3 = handles[2];
        if (h1.x > h2.x) { const tmp = h1; h1 = h2; h2 = tmp; }
        if (h2.x > h3.x) { const tmp = h2; h2 = h3; h3 = tmp; }
        if (h1.x > h2.x) { const tmp = h1; h1 = h2; h2 = tmp; }
        let x1 = h1.x, y1 = h1.y;
        let x2 = h2.x, y2 = h2.y;
        let x3 = h3.x;

        if (x2 - x1 < 0.2) x2 = x1 + 0.2;
        if (x3 - x2 < 0.2) x3 = x2 + 0.2;

        const s1 = x1 + x2 + x3;
        const s2 = x1 * x2 + x2 * x3 + x3 * x1;
        const s3 = x1 * x2 * x3;

        const F = (v) => Math.pow(v, 4) - (4.0 / 3.0) * s1 * Math.pow(v, 3) + 2.0 * s2 * Math.pow(v, 2) - 4.0 * s3 * v;
        let denom = F(x2) - F(x1);
        if (Math.abs(denom) < 1e-4) denom = denom >= 0 ? 1e-4 : -1e-4;
        let a = (y2 - y1) / denom;
        a = Math.max(-500.0, Math.min(500.0, a));
        const C = y2 - a * F(x2);
        return a * F(x) + C;
      }

      case "4th_inflection": {
        const x1 = handles[0].x, y1 = handles[0].y;
        const x2 = handles[1].x, y2 = handles[1].y;
        let dx = x2 - x1;
        if (Math.abs(dx) < 0.25) dx = dx >= 0 ? 0.25 : -0.25;
        const denom = Math.pow(dx, 4);
        let k = (y1 - y2) / denom;
        k = Math.max(-500.0, Math.min(500.0, k));
        return k * Math.pow(x - x1, 3) * (3.0 * x - 4.0 * x2 + x1) + y1;
      }

      case "4th_basic_bowl": {
        const x0 = handles[0].x, y0 = handles[0].y;
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = Math.abs(x1 - x0);
        if (dx < 1e-4) dx = 1e-4;
        let a = (y1 - y0) / Math.pow(dx, 4);
        a = Math.max(-500.0, Math.min(500.0, a));
        return a * Math.pow(x - x0, 4) + y0;
      }

      case "3rd_normal": {
        const hFirst = handles[0].x <= handles[1].x ? handles[0] : handles[1];
        const hSecond = handles[0].x <= handles[1].x ? handles[1] : handles[0];
        const x1 = hFirst.x, y1 = hFirst.y;
        const x2 = hSecond.x, y2 = hSecond.y;
        let p = (x2 - x1) / 2.0;
        if (Math.abs(p) < 0.2) p = 0.2;
        const x0 = (x1 + x2) / 2.0;
        const y0 = (y1 + y2) / 2.0;
        let denom = 4.0 * Math.pow(p, 3);
        if (Math.abs(denom) < 1e-4) denom = 1e-4;
        let a = (y1 - y2) / denom;
        a = Math.max(-500.0, Math.min(500.0, a));
        return a * Math.pow(x - x0, 3) - 3.0 * a * Math.pow(p, 2) * (x - x0) + y0;
      }

      case "3rd_basic_cubic": {
        const x0 = handles[0].x, y0 = handles[0].y;
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = x1 - x0;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        let a = (y1 - y0) / Math.pow(dx, 3);
        a = Math.max(-500.0, Math.min(500.0, a));
        return a * Math.pow(x - x0, 3) + y0;
      }

      case "3rd_monotonic": {
        const x0 = handles[0].x, y0 = handles[0].y;
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = x1 - x0;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        let dy = y1 - y0;
        if (Math.abs(dy) < 1e-4) dy = dy >= 0 ? 1e-4 : -1e-4;
        const alpha = 0.35;
        let m = alpha * (dy / dx);
        let a = (1.0 - alpha) * (dy / Math.pow(dx, 3));
        m = Math.max(-2000.0, Math.min(2000.0, m));
        a = Math.max(-2000.0, Math.min(2000.0, a));
        const u = x - x0;
        return y0 + a * Math.pow(u, 3) + m * u;
      }

      case "2nd_quadratic": {
        const x0 = handles[0].x, y0 = handles[0].y;
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = Math.abs(x1 - x0);
        if (dx < 1e-4) dx = 1e-4;
        let a = (y1 - y0) / (dx * dx);
        a = Math.max(-500.0, Math.min(500.0, a));
        return a * Math.pow(x - x0, 2) + y0;
      }

      case "1st_linear": {
        const x0 = handles[0].x, y0 = handles[0].y;
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = x1 - x0;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        const m = (y1 - y0) / dx;
        return m * (x - x0) + y0;
      }

      case "exp_basic": {
        const x0 = handles[0].x, y0 = handles[0].y;
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = x1 - x0;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        let dy = y1 - y0;
        if (Math.abs(dy) < 1e-4) dy = dy >= 0 ? 1e-4 : -1e-4;
        let expo = (x - x1) / dx;
        expo = Math.max(-15.0, Math.min(15.0, expo));
        return y0 + dy * Math.pow(2.0, expo);
      }

      case "log_basic": {
        const x0 = handles[0].x, y0 = handles[0].y;
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = x1 - x0;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        let dy = y1 - y0;
        if (Math.abs(dy) < 1e-4) dy = dy >= 0 ? 1e-4 : -1e-4;

        if (dx > 0) {
          if (x <= x0 + 1e-4) return NaN;
          const u = Math.max(1e-6, (x - x0) / dx);
          return y1 + dy * Math.log2(u);
        } else {
          if (x >= x0 - 1e-4) return NaN;
          const u = Math.max(1e-6, (x0 - x) / -dx);
          return y1 + dy * Math.log2(u);
        }
      }

      case "sqrt_basic": {
        const x0 = handles[0].x, y0 = handles[0].y;
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = x1 - x0;
        let dy = y1 - y0;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;

        if (dx > 0) {
          if (x < x0 - 1e-11) return NaN;
          return y0 + dy * Math.sqrt(Math.max(0.0, x - x0) / dx);
        } else {
          if (x > x0 + 1e-11) return NaN;
          return y0 + dy * Math.sqrt(Math.max(0.0, x0 - x) / -dx);
        }
      }

      case "rational_basic": {
        const x0 = handles[0].x, y0 = handles[0].y;
        const x1 = handles[1].x, y1 = handles[1].y;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const k = dx * dy;

        const diff = x - x0;
        if (Math.abs(diff) < 1e-4) return NaN;
        return y0 + k / diff;
      }

      case "sin_1period": {
        const x0 = handles[0].x, y0 = handles[0].y;
        if (handles.length < 2) return y0 + Math.sin(x - x0);
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = x1 - x0;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        const A = y1 - y0;
        const omega = Math.PI / (2.0 * dx);
        return y0 + A * Math.sin(omega * (x - x0));
      }

      case "cos_1period": {
        const x0 = handles[0].x, y0 = handles[0].y;
        if (handles.length < 2) return y0 + Math.cos(x - x0);
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = x1 - x0;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        const A = y1 - y0;
        const omega = (2.0 * Math.PI) / dx;
        return y0 + A * Math.cos(omega * (x - x0));
      }

      case "tan_1period": {
        const x0 = handles[0].x, y0 = handles[0].y;
        if (handles.length < 2) {
          const cosVal = Math.cos(x - x0);
          if (Math.abs(cosVal) < 1e-4) return NaN;
          return y0 + Math.tan(x - x0);
        }
        const x1 = handles[1].x, y1 = handles[1].y;
        let dx = x1 - x0;
        if (Math.abs(dx) < 1e-4) dx = dx >= 0 ? 1e-4 : -1e-4;
        const A = y1 - y0;
        const omega = Math.PI / (4.0 * dx);
        const cosVal = Math.cos(omega * (x - x0));
        if (Math.abs(cosVal) < 1e-4) return NaN;
        return y0 + A * Math.tan(omega * (x - x0));
      }

      // --- [🔥 수능 킬러 미적분 4대 개형] ---
      case "killer_frac_odd": {
        // y = ax / (x^2 + b) [원점 대칭 기함수, 극대점 (x0 + p, y0 + q)]
        const x0 = handles[0].x, y0 = handles[0].y;
        let p = handles[1].x - x0;
        let q = handles[1].y - y0;
        if (Math.abs(p) < 0.15) p = p >= 0 ? 0.15 : -0.15;
        const dx = x - x0;
        return y0 + (2.0 * p * q * dx) / (dx * dx + p * p);
      }

      case "killer_exp_linear": {
        // y = ax * e^(-bx) [원점 통과 후 극대 찍고 x축 점근선]
        const x0 = handles[0].x, y0 = handles[0].y;
        let p = handles[1].x - x0;
        let q = handles[1].y - y0;
        if (Math.abs(p) < 0.15) p = p >= 0 ? 0.15 : -0.15;
        const dx = x - x0;
        const u = dx / p;
        if (u < -6.0) return NaN;
        return y0 + q * Math.E * u * Math.exp(-u);
      }

      case "killer_exp_quad": {
        // y = ax^2 * e^(-bx) [원점 접하고 극대 찍고 x축 점근선]
        const x0 = handles[0].x, y0 = handles[0].y;
        let p = handles[1].x - x0;
        let q = handles[1].y - y0;
        if (Math.abs(p) < 0.15) p = p >= 0 ? 0.15 : -0.15;
        const dx = x - x0;
        const u = (2.0 * dx) / p;
        if (u < -8.0) return NaN;
        const factor = (dx / p) * (dx / p);
        return y0 + q * Math.E * Math.E * factor * Math.exp(-u);
      }

      case "killer_log_frac": {
        // y = a * ln(x) / x [x=x0+p/e 통과 후 x=x0+p에서 극대 (y축 대칭 p < 0 완벽 호환)]
        const x0 = handles[0].x, y0 = handles[0].y;
        let p = handles[1].x - x0;
        let q = handles[1].y - y0;
        if (Math.abs(p) < 0.1) p = p >= 0 ? 0.1 : -0.1;
        const dx = x - x0;
        const u = dx / p;
        if (u <= 1e-4) return NaN;
        return y0 + (q * Math.log(Math.E * u)) / u;
      }

      // --- [🌐 범용 수식: y = a * f(b(x - h)) + k 임의 수식 초고속 평가] ---
      case "general_expr": {
        if (!handles || handles.length === 0) return NaN;
        const h = handles[0].x || 0.0;
        const k = handles[0].y || 0.0;
        let fn = handles[0].fn || null;
        if ((!fn || typeof fn !== 'function') && handles[0].rawExpr && typeof SafeMathCompiler !== 'undefined') {
          const comp = SafeMathCompiler.compile(handles[0].rawExpr);
          if (comp && comp.success && typeof comp.fn === 'function') {
            handles[0].fn = comp.fn;
            fn = comp.fn;
          }
        }
        if (!fn || typeof fn !== 'function') return NaN;
        const refX = !!handles[0].reflectX;
        const refY = !!handles[0].reflectY;
        const curX = refY ? -(x - h) : (x - h);
        let val = fn(curX);
        if (isNaN(val) || !isFinite(val)) return NaN;
        if (refX) val = -val;
        return val + k;
      }

      default:
        return 0;
    }
  }

  static dragHandle(handles, ftype, idx, newX, newY, altKey = false, isKeyboard = false) {
    if (idx >= handles.length) return;

    if (ftype === "4th_symmetric") {
      const x0 = handles[1].x;
      const y0 = handles[1].y;
      if (idx === 1) {
        // [대표님 핵심 기획]: 중앙 극대점(idx=1) 드래그는 개형 변화가 아니라 곡선 전체 평행이동!
        const dx = newX - x0;
        const dy = newY - y0;
        handles[1].x = newX;
        handles[1].y = newY;
        handles[0].x += dx;
        handles[0].y += dy;
        handles[2].x += dx;
        handles[2].y += dy;
      } else if (idx === 2) {
        const p = Math.max(0.4, Math.min(6.0, newX - x0));
        handles[2].x = x0 + p;
        handles[2].y = newY;
        handles[0].x = x0 - p;
        handles[0].y = newY;
      } else if (idx === 0) {
        const p = Math.max(0.4, Math.min(6.0, x0 - newX));
        handles[0].x = x0 - p;
        handles[0].y = newY;
        handles[2].x = x0 + p;
        handles[2].y = newY;
      }
    } else if (ftype === "4th_asymmetric") {
      const minGap = 0.7;
      const x1 = handles[0].x;
      const x2 = handles[1].x;
      const x3 = handles[2].x;

      if (idx === 0) {
        // 좌측 극소 조작: 좌측 극소와 중앙 극대를 기준으로 a 계산 -> 우측 극소 y 자동 동기화
        const clampedX = Math.min(newX, handles[1].x - minGap);
        handles[0].x = clampedX;
        handles[0].y = newY;

        const s1 = clampedX + x2 + x3;
        const s2 = clampedX * x2 + x2 * x3 + x3 * clampedX;
        const s3 = clampedX * x2 * x3;
        const F = (v) => Math.pow(v, 4) - (4.0 / 3.0) * s1 * Math.pow(v, 3) + 2.0 * s2 * Math.pow(v, 2) - 4.0 * s3 * v;
        let denom = F(x2) - F(clampedX);
        if (Math.abs(denom) < 1e-4) denom = denom >= 0 ? 1e-4 : -1e-4;
        let a = (handles[1].y - newY) / denom;
        a = Math.max(-500.0, Math.min(500.0, a));
        const C = handles[1].y - a * F(x2);
        handles[2].y = a * F(x3) + C;
      } else if (idx === 1) {
        // 중앙 극대 조작: 중앙 극대와 좌측 극대를 기준으로 a 계산 -> 우측 극소 y 자동 동기화
        const clampedX = Math.max(handles[0].x + minGap, Math.min(newX, handles[2].x - minGap));
        handles[1].x = clampedX;
        handles[1].y = newY;

        const s1 = x1 + clampedX + x3;
        const s2 = x1 * clampedX + clampedX * x3 + x3 * x1;
        const s3 = x1 * clampedX * x3;
        const F = (v) => Math.pow(v, 4) - (4.0 / 3.0) * s1 * Math.pow(v, 3) + 2.0 * s2 * Math.pow(v, 2) - 4.0 * s3 * v;
        let denom = F(clampedX) - F(x1);
        if (Math.abs(denom) < 1e-4) denom = denom >= 0 ? 1e-4 : -1e-4;
        let a = (newY - handles[0].y) / denom;
        a = Math.max(-500.0, Math.min(500.0, a));
        const C = newY - a * F(clampedX);
        handles[2].y = a * F(x3) + C;
      } else if (idx === 2) {
        // 우측 극소 조작: 중앙 극대와 우측 극소를 기준으로 a 계산 -> 좌측 극소 y 자동 동기화!
        const clampedX = Math.max(newX, handles[1].x + minGap);
        handles[2].x = clampedX;
        handles[2].y = newY;

        const s1 = x1 + x2 + clampedX;
        const s2 = x1 * x2 + x2 * clampedX + clampedX * x1;
        const s3 = x1 * x2 * clampedX;
        const F = (v) => Math.pow(v, 4) - (4.0 / 3.0) * s1 * Math.pow(v, 3) + 2.0 * s2 * Math.pow(v, 2) - 4.0 * s3 * v;
        let denom = F(x2) - F(clampedX);
        if (Math.abs(denom) < 1e-4) denom = denom >= 0 ? 1e-4 : -1e-4;
        let a = (handles[1].y - newY) / denom;
        a = Math.max(-500.0, Math.min(500.0, a));
        const C = handles[1].y - a * F(x2);
        handles[0].y = a * F(x1) + C;
      }
    } else if (ftype === "4th_inflection") {
      const minGap = 0.4;
      const otherIdx = idx === 0 ? 1 : 0;
      const otherX = handles[otherIdx].x;
      if (newX < otherX) {
        handles[idx].x = Math.min(newX, otherX - minGap);
      } else {
        handles[idx].x = Math.max(newX, otherX + minGap);
      }
      handles[idx].y = newY;
    } else if (ftype === "3rd_normal") {
      const x0 = (handles[0].x + handles[1].x) / 2.0;
      const y0 = (handles[0].y + handles[1].y) / 2.0;
      if (idx === 2) {
        // 🌟 [변곡점(대칭중심) 핸들 드래그]: 개형은 그대로 유지한 채 변곡점을 목표 좌표로 평행이동!
        const shiftX = newX - x0;
        const shiftY = newY - y0;
        handles[0].x += shiftX;
        handles[0].y += shiftY;
        handles[1].x += shiftX;
        handles[1].y += shiftY;
        if (handles[2]) {
          handles[2].x = newX;
          handles[2].y = newY;
        }
      } else {
        // 변곡점(대칭 중심)을 기준점으로 고정하고 완벽한 점대칭 연동!
        const otherIdx = idx === 0 ? 1 : 0;
        let dx = newX - x0;
        let dy = newY - y0;
        if (Math.abs(dx) < 0.25) dx = dx >= 0 ? 0.25 : -0.25;

        handles[idx].x = x0 + dx;
        handles[idx].y = y0 + dy;

        // 반대쪽 극점은 변곡점 기준 180도 점대칭으로 동시 자동 연동!
        handles[otherIdx].x = x0 - dx;
        handles[otherIdx].y = y0 - dy;
        if (handles[2]) {
          handles[2].x = x0;
          handles[2].y = y0;
        }
      }
    } else if (ftype === "2nd_quadratic") {
      if (idx === 0) {
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        const x0 = handles[0].x;
        const minGap = 0.35;
        let dx = newX - x0;
        if (Math.abs(dx) < minGap) dx = dx >= 0 ? minGap : -minGap;
        handles[1].x = x0 + dx;
        handles[1].y = newY;
      }
    } else if (ftype === "3rd_monotonic") {
      if (idx === 0) {
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        const x0 = handles[0].x;
        const y0 = handles[0].y;
        const minGapX = 0.35;
        const minGapY = 0.25;
        let dx = newX - x0;
        let dy = newY - y0;
        if (Math.abs(dx) < minGapX) dx = dx >= 0 ? minGapX : -minGapX;
        if (Math.abs(dy) < minGapY) dy = dy >= 0 ? minGapY : -minGapY;
        const maxDy = Math.min(1950.0 * Math.abs(dx) / 0.35, 1950.0 * Math.pow(Math.abs(dx), 3) / 0.65);
        if (Math.abs(dy) > maxDy) dy = dy >= 0 ? maxDy : -maxDy;
        handles[1].x = x0 + dx;
        handles[1].y = y0 + dy;
      }
    } else if (ftype === "3rd_basic_cubic") {
      if (idx === 0) {
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        const x0 = handles[0].x;
        const minGap = 0.35;
        let dx = newX - x0;
        if (Math.abs(dx) < minGap) dx = dx >= 0 ? minGap : -minGap;
        handles[1].x = x0 + dx;
        handles[1].y = newY;
      }
    } else if (ftype === "4th_basic_bowl") {
      if (idx === 0) {
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        const x0 = handles[0].x;
        const minGap = 0.35;
        let dx = newX - x0;
        if (Math.abs(dx) < minGap) dx = dx >= 0 ? minGap : -minGap;
        handles[1].x = x0 + dx;
        handles[1].y = newY;
      }
    } else if (ftype === "4th_skew") {
      if (handles.length > 2) handles.length = 2;
      if (handles.length >= 2 && (idx === 0 || idx === 1)) {
        const minGap = 0.4;
        const otherIdx = idx === 0 ? 1 : 0;
        const otherX = handles[otherIdx].x;
        if (newX < otherX) {
          handles[idx].x = Math.min(newX, otherX - minGap);
        } else {
          handles[idx].x = Math.max(newX, otherX + minGap);
        }
        handles[idx].y = newY;
        const isUp = handles[1].y >= handles[0].y;
        handles[0].type = isUp ? "min" : "max";
        handles[0].name = isUp ? "극소" : "극대";
      }
    } else if (ftype === "1st_linear") {
      if (idx === 0) {
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        const x0 = handles[0].x;
        const y0 = handles[0].y;
        let finalX = newX;
        let finalY = newY;

        // [초정밀 스마트 각도 자석 스냅: 대표님 피드백 반영]
        // 수평선(0도), 수직선(90도), 그리고 수능 킬러의 꽃 y=x(45도), y=-x(-45도/135도)
        // 키보드 방향키 조작 시에는 100% 완전 바이패스하여 자석 갇힘 현상 원천 차단!
        if (!altKey && !isKeyboard) {
          const snapThreshold = 0.15; // 자연스럽고 세련되게 감기는 황금 자석 반경!
          const dx = newX - x0;
          const dy = newY - y0;

          if (Math.abs(dy) < snapThreshold) {
            // 1. 완벽 수평선 (y = y0, 상수함수)
            finalY = y0;
          } else if (Math.abs(dx) < snapThreshold) {
            // 2. 완벽 수직선 (x = x0)
            finalX = x0;
          } else if (Math.abs(Math.abs(dx) - Math.abs(dy)) < snapThreshold * 1.35) {
            // 3. 45도 / 135도 대각선 자석 스냅 (y = x, y = -x 완벽 45도 보존!)
            const avgDist = (Math.abs(dx) + Math.abs(dy)) / 2;
            finalX = x0 + Math.sign(dx) * avgDist;
            finalY = y0 + Math.sign(dy) * avgDist;
          }
        }

        handles[1].x = finalX;
        handles[1].y = finalY;
      }
    } else if (ftype === "rational_basic") {
      if (idx === 0) {
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        const x0 = handles[0].x;
        const y0 = handles[0].y;
        const minGap = 0.35; // 십자선에 너무 가까워져서 곡선과 분리되는 것을 원천 차단!

        let dx = newX - x0;
        let dy = newY - y0;

        if (Math.abs(dx) < minGap) {
          dx = dx >= 0 ? minGap : -minGap;
        }
        if (Math.abs(dy) < minGap) {
          dy = dy >= 0 ? minGap : -minGap;
        }

        handles[1].x = x0 + dx;
        handles[1].y = y0 + dy;
      }
    } else if (ftype === "exp_basic") {
      if (idx === 0) {
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        const x0 = handles[0].x;
        const y0 = handles[0].y;
        const minGapX = 0.35;
        const minGapY = 0.25;
        let dx = newX - x0;
        let dy = newY - y0;
        if (Math.abs(dx) < minGapX) dx = dx >= 0 ? minGapX : -minGapX;
        if (Math.abs(dy) < minGapY) dy = dy >= 0 ? minGapY : -minGapY;
        handles[1].x = x0 + dx;
        handles[1].y = y0 + dy;
      }
    } else if (ftype === "log_basic") {
      if (idx === 0) {
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        const x0 = handles[0].x;
        const y0 = handles[0].y;
        const minGapX = 0.35;
        const minGapY = 0.25;
        let dx = newX - x0;
        let dy = newY - y0;
        if (Math.abs(dx) < minGapX) dx = dx >= 0 ? minGapX : -minGapX;
        if (Math.abs(dy) < minGapY) dy = dy >= 0 ? minGapY : -minGapY;
        handles[1].x = x0 + dx;
        handles[1].y = y0 + dy;
      }
    } else if (ftype === "sqrt_basic") {
      if (idx === 0) {
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        const x0 = handles[0].x;
        const minGapX = 0.35;
        let dx = newX - x0;
        if (Math.abs(dx) < minGapX) dx = dx >= 0 ? minGapX : -minGapX;
        handles[1].x = x0 + dx;
        handles[1].y = newY;
      }
    } else if (["sin_1period", "cos_1period", "tan_1period"].includes(ftype)) {
      if (idx === 0) {
        // 중심점 이동: 진폭과 주기를 완벽히 유지한 채 전체 평행이동!
        if (handles.length >= 2) {
          const dx = handles[1].x - handles[0].x;
          const dy = handles[1].y - handles[0].y;
          handles[0].x = newX;
          handles[0].y = newY;
          handles[1].x = newX + dx;
          handles[1].y = newY + dy;
        } else {
          handles[0].x = newX;
          handles[0].y = newY;
        }
      } else if (idx === 1) {
        // 진폭·주기 조절점 이동: 중심점은 고정되고 진폭과 주기만 동시 제어!
        const x0 = handles[0].x;
        const minGapX = 0.35;
        let dx = newX - x0;
        if (Math.abs(dx) < minGapX) dx = dx >= 0 ? minGapX : -minGapX;
        handles[1].x = x0 + dx;
        handles[1].y = newY;
      }
    } else if (["killer_frac_odd", "killer_exp_linear", "killer_exp_quad", "killer_log_frac"].includes(ftype)) {
      if (idx === 0) {
        // 기준점/대칭중심 이동: 극점과의 상대 변위를 유지하며 전체 평행이동!
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        // 극대점 드래그: 기준점(원점)은 고정된 채 극대값 높이와 위치가 실시간 변경!
        const x0 = handles[0].x;
        const y0 = handles[0].y;
        const minGapX = 0.25;
        let dx = newX - x0;
        let dy = newY - y0;
        if (ftype === "killer_log_frac") {
          // 로그 분수형: 현재 방향(기본 우측 p > 0 또는 y축 대칭 좌측 p < 0) 기준 최소 간격 0.35 유지
          const prevSide = (handles[1].x - x0) < 0 ? -1 : 1;
          dx = prevSide > 0 ? Math.max(0.35, dx) : Math.min(-0.35, dx);
        } else {
          if (Math.abs(dx) < minGapX) dx = dx >= 0 ? minGapX : -minGapX;
        }
        handles[1].x = x0 + dx;
        handles[1].y = y0 + dy;
      }
    } else if (ftype === "geom_circle") {
      if (idx === 0) {
        // 원 중심 이동: 반지름 벡터(dx, dy)를 유지한 채 원 통째로 평행이동!
        const dx = handles[1].x - handles[0].x;
        const dy = handles[1].y - handles[0].y;
        handles[0].x = newX;
        handles[0].y = newY;
        handles[1].x = newX + dx;
        handles[1].y = newY + dy;
      } else if (idx === 1) {
        // 둘레 조절점 드래그: 반지름 크기 및 둘레점 위치 변경
        handles[1].x = newX;
        handles[1].y = newY;
      }
    } else if (ftype === "geom_triangle" || ftype === "geom_quad") {
      // 삼각형/사각형의 개별 꼭짓점 자유 드래그 (직사각형, 사다리꼴 등 무한 변형!)
      if (idx < handles.length) {
        handles[idx].x = newX;
        handles[idx].y = newY;
      }
    } else if (ftype === "general_expr") {
      // 범용 수식: 중심점 드래그 시 (h, k) 평행이동
      if (idx === 0 && handles.length > 0) {
        handles[0].x = newX;
        handles[0].y = newY;
      }
    }
  }

  // --- [수학적 x축 대칭: y -> -y (x축 기준 상하 대칭)] ---
  static reflectXAxis(handles, ftype) {
    if (!handles || handles.length === 0) return;

    if (ftype === "general_expr") {
      if (handles[0]) {
        handles[0].reflectX = !handles[0].reflectX;
        handles[0].y = -handles[0].y;
      }
      return;
    }

    // 모든 핸들의 y 좌표 부호 반전
    handles.forEach(h => {
      h.y = -h.y;
      // 극대/극소 성격 및 명칭 스왑
      if (h.type === "max") {
        h.type = "min";
        if (h.name === "극대") h.name = "극소";
      } else if (h.type === "min") {
        h.type = "max";
        if (h.name === "극소") h.name = "극대";
      }
    });
  }

  // --- [수학적 y축 대칭: x -> -x (y축 기준 좌우 대칭)] ---
  static reflectYAxis(handles, ftype) {
    if (!handles || handles.length === 0) return;

    if (ftype === "general_expr") {
      if (handles[0]) {
        handles[0].reflectY = !handles[0].reflectY;
        handles[0].x = -handles[0].x;
      }
      return;
    }

    // 1. 모든 핸들의 x 좌표 부호 반전
    handles.forEach(h => {
      h.x = -h.x;
    });

    // 2. x축 방향성(좌 -> 우) 핸들 정렬 및 성격 재정립
    if (ftype === "3rd_normal") {
      // 삼차함수: 왼쪽/오른쪽 극점(0, 1) 순서 재정렬 및 변곡점(2) 유지
      if (handles.length >= 2) {
        if (handles[0].x > handles[1].x) {
          const tmp = handles[0];
          handles[0] = handles[1];
          handles[1] = tmp;
        }
        if (handles[0].y > handles[1].y) {
          handles[0].type = "max";
          handles[1].type = "min";
        } else {
          handles[0].type = "min";
          handles[1].type = "max";
        }
        if (handles[2]) {
          handles[2].x = (handles[0].x + handles[1].x) / 2.0;
          handles[2].y = (handles[0].y + handles[1].y) / 2.0;
          handles[2].type = "inflection";
        }
      }
    } else if (ftype === "4th_symmetric") {
      // 사차 대칭: 중앙 극대/극소 핸들[1] 기준으로 좌우 대칭점 재정렬
      const p = Math.abs(handles[2].x - handles[0].x) / 2.0;
      const centerH = handles[1];
      const yMin = handles[0].y;
      handles[0].x = centerH.x - p;
      handles[0].y = yMin;
      handles[2].x = centerH.x + p;
      handles[2].y = yMin;
    } else if (ftype === "4th_asymmetric") {
      handles.sort((a, b) => a.x - b.x);
    }
  }

  // =====================================================================
  // [📐 사각형 모드 엔진] 꼭짓점 하나를 끌면 나머지가 제약을 지키며 따라옴
  //  mode: 'free' | 'parallelogram' | 'rectangle' | 'rhombus' | 'square'
  //  originCenter: true 이면 도형의 중심을 원점(0,0)에 고정 (점대칭)
  //  - 평행사변형/직사각형(비원점): 마주보는 꼭짓점을 고정한 채 리사이즈
  //  - 마름모/정사각형/원점 중심: 중심 고정, 꼭짓점을 끌면 회전+크기 변경
  //  - 기존 dragHandle(자유 드래그)은 건드리지 않고, 앱이 모드일 때만 이 함수를 호출
  // =====================================================================
  static _snapAngle(h, stepDeg, tolDeg) {
    const L = Math.hypot(h.x, h.y);
    if (L < 1e-9) return h;
    const ang = Math.atan2(h.y, h.x);
    const step = stepDeg * Math.PI / 180;
    const target = Math.round(ang / step) * step;
    if (Math.abs(ang - target) < tolDeg * Math.PI / 180) {
      const cl = (v) => (Math.abs(v) < 1e-12 ? 0 : v);
      return { x: cl(L * Math.cos(target)), y: cl(L * Math.sin(target)) };
    }
    return h;
  }

  static dragQuad(handles, idx, newX, newY, mode, originCenter, snap = true) {
    if (!handles || handles.length !== 4 || idx < 0 || idx > 3) return;
    const V = handles;
    const i = idx, i1 = (i + 1) % 4, i2 = (i + 2) % 4, i3 = (i + 3) % 4;
    const P = { x: newX, y: newY };
    let m = mode || 'free';
    if (m === 'free') {
      if (!originCenter) { V[i].x = newX; V[i].y = newY; return; }
      m = 'parallelogram'; // 자유 + 원점 중심 = 원점 대칭 평행사변형
    }
    const MIN = 0.1;
    const set = (k, x, y) => { V[k].x = x; V[k].y = y; };

    if (m === 'parallelogram') {
      // 다른 대각선의 반 벡터 w 를 유지
      const w = { x: (V[i1].x - V[i3].x) / 2, y: (V[i1].y - V[i3].y) / 2 };
      if (originCenter) {
        set(i, P.x, P.y); set(i2, -P.x, -P.y);
        set(i1, w.x, w.y); set(i3, -w.x, -w.y);
      } else {
        const Q = { x: V[i2].x, y: V[i2].y };
        const M = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
        set(i, P.x, P.y);
        set(i1, M.x + w.x, M.y + w.y);
        set(i3, M.x - w.x, M.y - w.y);
      }
      return;
    }

    if (m === 'rectangle') {
      // 현재 변 방향(u)과 수직 방향(v)을 유지 → 회전 없이 크기만 변경
      let ux = V[i1].x - V[i].x, uy = V[i1].y - V[i].y;
      let ul = Math.hypot(ux, uy);
      if (ul < 1e-9) { ux = 1; uy = 0; ul = 1; }
      ux /= ul; uy /= ul;
      let px = -uy, py = ux;
      if ((V[i3].x - V[i].x) * px + (V[i3].y - V[i].y) * py < 0) { px = -px; py = -py; }
      const clampLen = (v) => (Math.abs(v) < MIN ? (v < 0 ? -MIN : MIN) : v);

      if (originCenter) {
        const a = clampLen(P.x * ux + P.y * uy);
        const b = clampLen(P.x * px + P.y * py);
        const Px = a * ux + b * px, Py = a * uy + b * py;
        set(i, Px, Py); set(i2, -Px, -Py);
        set(i1, Px - 2 * a * ux, Py - 2 * a * uy);
        set(i3, Px - 2 * b * px, Py - 2 * b * py);
      } else {
        const Q = { x: V[i2].x, y: V[i2].y };
        const dx = Q.x - P.x, dy = Q.y - P.y;
        const a = clampLen(dx * ux + dy * uy);
        const b = clampLen(dx * px + dy * py);
        set(i, P.x, P.y);
        set(i1, P.x + a * ux, P.y + a * uy);
        set(i3, P.x + b * px, P.y + b * py);
        set(i2, P.x + a * ux + b * px, P.y + a * uy + b * py);
      }
      return;
    }

    // --- 마름모 / 정사각형: 중심 고정, 대각선이 서로 수직이등분 ---
    const C = originCenter
      ? { x: 0, y: 0 }
      : { x: (V[0].x + V[1].x + V[2].x + V[3].x) / 4, y: (V[0].y + V[1].y + V[2].y + V[3].y) / 4 };
    const hOld = { x: V[i].x - C.x, y: V[i].y - C.y };
    const oOld = { x: V[i1].x - C.x, y: V[i1].y - C.y };
    const sgn = (hOld.x * oOld.y - hOld.y * oOld.x) >= 0 ? 1 : -1; // 꼭짓점 회전 방향 유지

    let h = { x: P.x - C.x, y: P.y - C.y };
    if (snap) h = GraphMathEngine._snapAngle(h, m === 'square' ? 45 : 90, 3); // 축/대각선 방향 찰칵
    let L = Math.hypot(h.x, h.y);
    if (L < MIN) { // 중심에 겹쳐 붕괴되는 것 방지
      const ol = Math.hypot(hOld.x, hOld.y);
      const d = ol > 1e-9 ? { x: hOld.x / ol, y: hOld.y / ol } : { x: 1, y: 0 };
      h = { x: d.x * MIN, y: d.y * MIN };
      L = MIN;
    }
    const L2 = (m === 'square') ? L : Math.max(Math.hypot(oOld.x, oOld.y), MIN);
    const o = { x: sgn * (-h.y) / L * L2, y: sgn * h.x / L * L2 };

    set(i, C.x + h.x, C.y + h.y);
    set(i2, C.x - h.x, C.y - h.y);
    set(i1, C.x + o.x, C.y + o.y);
    set(i3, C.x - o.x, C.y - o.y);
  }

  // 모드 전환 시 현재 도형의 범위(bbox)를 기준으로 해당 모드의 '정석 모양'으로 정리
  static applyQuadMode(handles, mode, originCenter) {
    if (!handles || handles.length !== 4) return;
    if (!mode || mode === 'free') {
      if (originCenter) {
        GraphMathEngine.dragQuad(handles, 0, handles[0].x, handles[0].y, 'parallelogram', true, false);
      }
      return;
    }
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    handles.forEach(h => {
      xmin = Math.min(xmin, h.x); xmax = Math.max(xmax, h.x);
      ymin = Math.min(ymin, h.y); ymax = Math.max(ymax, h.y);
    });
    let cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    let hw = (xmax - xmin) / 2, hh = (ymax - ymin) / 2;
    if (originCenter) {
      cx = 0; cy = 0;
      hw = Math.max(Math.abs(xmin), Math.abs(xmax));
      hh = Math.max(Math.abs(ymin), Math.abs(ymax));
    }
    hw = Math.max(hw, 0.3); hh = Math.max(hh, 0.3);
    const set = (k, x, y) => { handles[k].x = x; handles[k].y = y; };

    if (mode === 'rectangle') {
      set(0, cx - hw, cy - hh); set(1, cx + hw, cy - hh); set(2, cx + hw, cy + hh); set(3, cx - hw, cy + hh);
    } else if (mode === 'square') {
      const s = (hw + hh) / 2;
      set(0, cx - s, cy - s); set(1, cx + s, cy - s); set(2, cx + s, cy + s); set(3, cx - s, cy + s);
    } else if (mode === 'rhombus') {
      set(0, cx + hw, cy); set(1, cx, cy + hh); set(2, cx - hw, cy); set(3, cx, cy - hh);
    } else if (mode === 'parallelogram') {
      const d = hw * 0.5;
      set(0, cx - hw, cy - hh); set(1, cx + hw - d, cy - hh); set(2, cx + hw, cy + hh); set(3, cx - hw + d, cy + hh);
    }
  }

  // 하위 호환 별칭
  static invertVertical(handles, ftype) {
    GraphMathEngine.reflectXAxis(handles, ftype);
  }
  static invertHorizontal(handles, ftype) {
    GraphMathEngine.reflectYAxis(handles, ftype);
  }

  // --- [⚡ 실시간 교점판독기: 초고속 수치해석 실근 & 접점 탐색 및 화면 밖 추적 엔진] ---
  static _findMixedTransposedIntersections(gNorm, gTrans, rangeX, viewRect, isFastDrag = false) {
    const rangeY = (viewRect && typeof viewRect.ymin === 'number' && typeof viewRect.ymax === 'number')
      ? { xmin: viewRect.ymin, xmax: viewRect.ymax }
      : rangeX;

    // 1. gNorm이 수직선(x = vertX)인 경우
    if (!gNorm._periodicEval && gNorm.type === '1st_linear' && gNorm.handles && gNorm.handles.length >= 2 &&
        Math.abs(gNorm.handles[1].x - gNorm.handles[0].x) < 1e-4) {
      const vertX = GraphMathEngine.baseXToWorldX(gNorm, gNorm.handles[0].x);
      if (!gTrans._periodicEval && gTrans.type === '1st_linear' && gTrans.handles && gTrans.handles.length >= 2 &&
          Math.abs(gTrans.handles[1].x - gTrans.handles[0].x) < 1e-4) {
        const horizY = GraphMathEngine.baseXToWorldX(gTrans, gTrans.handles[0].x);
        const out = [{ x: vertX, y: horizY, type: 'cross' }];
        GraphMathEngine._annotateOffscreen(out, viewRect);
        return out;
      }
      const nTrans = { ...gTrans, isTransposedYX: false };
      const horizDummy = { type: '1st_linear', isTransposedYX: false, handles: [{ x: 0, y: vertX }, { x: 1, y: vertX }] };
      const sub = GraphMathEngine.findFunctionIntersections(nTrans, horizDummy, rangeY, null, isFastDrag);
      const out = sub.map(r => ({ x: vertX, y: r.x, type: r.type })).sort((a, b) => a.x - b.x || a.y - b.y);
      GraphMathEngine._annotateOffscreen(out, viewRect);
      return out;
    }

    // 2. gTrans가 수평선(내부 수직 h[0].x === h[1].x -> 화면 y = horizY)인 경우
    if (!gTrans._periodicEval && gTrans.type === '1st_linear' && gTrans.handles && gTrans.handles.length >= 2 &&
        Math.abs(gTrans.handles[1].x - gTrans.handles[0].x) < 1e-4) {
      const horizY = GraphMathEngine.baseXToWorldX(gTrans, gTrans.handles[0].x);
      const horizNorm = { type: '1st_linear', isTransposedYX: false, handles: [{ x: 0, y: horizY }, { x: 1, y: horizY }] };
      return GraphMathEngine.findFunctionIntersections(gNorm, horizNorm, rangeX, viewRect, isFastDrag);
    }

    const evalNorm = (x) => GraphMathEngine.evaluatePipeline(gNorm, x);
    const evalTrans = (y) => GraphMathEngine.evaluatePipeline(gTrans, y);

    // 3. Y 탐색 범위 산출
    let minY = -18.0;
    let maxY = 18.0;
    if (viewRect && typeof viewRect.ymin === 'number' && typeof viewRect.ymax === 'number') {
      const spanY = (viewRect.ymax - viewRect.ymin) || 10.0;
      minY = Math.min(minY, viewRect.ymin - spanY * 0.7);
      maxY = Math.max(maxY, viewRect.ymax + spanY * 0.7);
    } else if (rangeX && typeof rangeX.xmin === 'number' && typeof rangeX.xmax === 'number') {
      const spanX = (rangeX.xmax - rangeX.xmin) || 10.0;
      minY = Math.min(minY, rangeX.xmin - spanX * 0.7);
      maxY = Math.max(maxY, rangeX.xmax + spanX * 0.7);
    }
    if (Array.isArray(gTrans.handles)) {
      gTrans.handles.forEach(h => {
        const wy = GraphMathEngine.baseXToWorldX(gTrans, h.x);
        if (typeof wy === 'number' && isFinite(wy)) {
          minY = Math.min(minY, wy - 8.0);
          maxY = Math.max(maxY, wy + 8.0);
        }
      });
    }
    if (Array.isArray(gNorm.handles)) {
      gNorm.handles.forEach(h => {
        const wp = GraphMathEngine.getHandleWorldPos(gNorm, h);
        if (wp && typeof wp.y === 'number' && isFinite(wp.y)) {
          minY = Math.min(minY, wp.y - 8.0);
          maxY = Math.max(maxY, wp.y + 8.0);
        }
      });
    }

    const targetDy = isFastDrag ? 0.045 : 0.016;
    const rawSpan = maxY - minY;
    const baseSteps = isFastDrag
      ? Math.min(1400, Math.max(480, Math.ceil(rawSpan / targetDy)))
      : Math.min(5000, Math.max(1200, Math.ceil(rawSpan / targetDy)));
    const dy = rawSpan / baseSteps;
    const extMinY = Math.floor(minY / dy) * dy;

    // 4. 적응형 아크길이 보강 샘플링 (|ΔF(y)| 급증 구간 자동 세분화)
    const ys = [];
    const fxs = [];
    const diffs = [];
    const valid = [];
    const maxTotalSamples = isFastDrag ? 4500 : 14000;
    const maxSub = isFastDrag ? 8 : 24;

    const pushSample = (curY, preFx) => {
      const fx = (preFx !== undefined) ? preFx : evalTrans(curY);
      if (isNaN(fx) || !isFinite(fx) || Math.abs(fx) > 1e5) {
        ys.push(curY); fxs.push(NaN); diffs.push(0); valid.push(0);
        return;
      }
      const gy = evalNorm(fx);
      if (isNaN(gy) || !isFinite(gy)) {
        ys.push(curY); fxs.push(fx); diffs.push(0); valid.push(0);
      } else {
        ys.push(curY); fxs.push(fx); diffs.push(gy - curY); valid.push(1);
      }
    };

    let prevGridY = extMinY;
    let prevGridFx = evalTrans(prevGridY);
    pushSample(prevGridY, prevGridFx);

    for (let i = 1; i <= baseSteps; i++) {
      const curY = extMinY + i * dy;
      const curFx = evalTrans(curY);
      if (
        ys.length < maxTotalSamples &&
        isFinite(prevGridFx) && isFinite(curFx) &&
        Math.abs(curFx - prevGridFx) > targetDy * 2.0 &&
        Math.abs(curFx - prevGridFx) < 35.0
      ) {
        const subN = Math.min(maxSub, Math.ceil(Math.abs(curFx - prevGridFx) / (targetDy * 1.5)));
        for (let s = 1; s < subN && ys.length < maxTotalSamples; s++) {
          const subY = prevGridY + (curY - prevGridY) * (s / subN);
          pushSample(subY);
        }
      }
      pushSample(curY, curFx);
      prevGridY = curY;
      prevGridFx = curFx;
    }

    const nSamples = ys.length;
    let validCnt = 0;
    let zeroCnt = 0;
    for (let i = 0; i < nSamples; i++) {
      if (valid[i]) {
        validCnt++;
        if (Math.abs(diffs[i]) < 1e-6) zeroCnt++;
      }
    }
    // 자기역함수 직선(예: y = -x + 2) 등 완전 일치 곡선 중복 점 폭주 방지
    if (validCnt > 20 && zeroCnt >= validCnt * 0.65) {
      return [];
    }

    const evalDiff = (yVal) => {
      const fx = evalTrans(yVal);
      if (isNaN(fx) || !isFinite(fx)) return NaN;
      const gy = evalNorm(fx);
      if (isNaN(gy) || !isFinite(gy)) return NaN;
      return gy - yVal;
    };

    const estimateNormSlope = (fx) => {
      const eps = 1e-5;
      const gp = evalNorm(fx + eps);
      const gm = evalNorm(fx - eps);
      if (isFinite(gp) && isFinite(gm)) return Math.abs(gp - gm) / (2.0 * eps);
      if (isFinite(gp)) {
        const g0 = evalNorm(fx);
        if (isFinite(g0)) return Math.abs(gp - g0) / eps;
      }
      if (isFinite(gm)) {
        const g0 = evalNorm(fx);
        if (isFinite(g0)) return Math.abs(g0 - gm) / eps;
      }
      return 1.0;
    };

    const crossRoots = [];
    const dedupDist = 0.012;
    const addRoot = (rx, ry, rType) => {
      if (!isFinite(rx) || !isFinite(ry)) return;
      const exist = crossRoots.find(cr => Math.hypot(cr.x - rx, cr.y - ry) < dedupDist);
      if (!exist) {
        crossRoots.push({ x: rx, y: ry, type: rType });
      } else if (rType === 'tangent') {
        exist.type = 'tangent';
      }
    };

    // 5. 닫힌 정의역 경계 끝점 교점 탐색 (예: y = sqrt(x - a) + a 와 그 y=x 대칭 반포물선의 시작점 교점)
    const pureAsymptoteCutoffTypes = new Set(['log_basic', 'rational_basic', 'tan_1period', 'killer_log_frac']);
    const mayHaveClosedDomainEdge = !pureAsymptoteCutoffTypes.has(gTrans.type) || !pureAsymptoteCutoffTypes.has(gNorm.type);
    if (mayHaveClosedDomainEdge) {
      for (let i = 0; i < nSamples - 1; i++) {
        if (valid[i] === valid[i + 1]) continue;
        const vIdx = valid[i] ? i : (i + 1);
        const uIdx = valid[i] ? (i + 1) : i;
        if (Math.abs(diffs[vIdx]) > 2.0) continue;
        let yV = ys[vIdx], yU = ys[uIdx];
        for (let b = 0; b < 36; b++) {
          const ym = 0.5 * (yV + yU);
          const dm = evalDiff(ym);
          if (isFinite(dm)) yV = ym;
          else yU = ym;
        }
        const fxEdge = evalTrans(yV);
        const gyEdge = isFinite(fxEdge) ? evalNorm(fxEdge) : NaN;
        if (!isFinite(gyEdge)) continue;
        const yInner = yV + (ys[vIdx] - yV) * 0.05;
        const fxInner = evalTrans(yInner);
        if (!isFinite(fxInner) || Math.abs(fxEdge - fxInner) > 0.25) continue;
        const slopeG = estimateNormSlope(fxEdge);
        const perpErr = Math.abs(gyEdge - yV) / Math.hypot(1.0, slopeG);
        if (perpErr < (isFastDrag ? 2.5e-3 : 1.2e-3)) {
          addRoot(fxEdge, 0.5 * (gyEdge + yV), 'cross');
        }
      }
    }

    // 6. 관통 교점 및 격자 정렬 접점 탐색
    const bisectIters = isFastDrag ? 20 : 28;
    for (let i = 0; i < nSamples - 1; i++) {
      if (!valid[i] || !valid[i + 1]) continue;
      const d1 = diffs[i];
      const d2 = diffs[i + 1];

      if ((Math.abs(d2 - d1) > 40 || Math.abs(fxs[i + 1] - fxs[i]) > 40) && Math.sign(d1) !== Math.sign(d2)) continue;

      if (d1 * d2 <= 0) {
        let low = ys[i];
        let high = ys[i + 1];
        let lowDiff = d1;
        let highDiff = d2;
        let aborted = false;

        for (let iter = 0; iter < bisectIters; iter++) {
          const mid = 0.5 * (low + high);
          const mDiff = evalDiff(mid);
          if (isNaN(mDiff) || !isFinite(mDiff)) {
            aborted = true;
            break;
          }
          if (lowDiff * mDiff <= 0) {
            high = mid;
            highDiff = mDiff;
          } else {
            low = mid;
            lowDiff = mDiff;
          }
        }
        if (aborted) continue;

        const midY = 0.5 * (low + high);
        const midDiff = evalDiff(midY);
        if (isNaN(midDiff) || !isFinite(midDiff)) continue;

        let rY = midY;
        let bestAbs = Math.abs(midDiff);
        if (Math.abs(lowDiff) < bestAbs) { bestAbs = Math.abs(lowDiff); rY = low; }
        if (Math.abs(highDiff) < bestAbs) { bestAbs = Math.abs(highDiff); rY = high; }

        const fxLow = evalTrans(low);
        const fxHigh = evalTrans(high);
        if (!isFinite(fxLow) || !isFinite(fxHigh) || Math.abs(fxHigh - fxLow) > 1.0) continue;

        const rX = evalTrans(rY);
        if (isNaN(rX) || !isFinite(rX)) continue;
        const slopeG = estimateNormSlope(rX);
        const perpResid = bestAbs / Math.hypot(1.0, slopeG);
        const residLimit = isFastDrag ? 2e-3 : 2e-4;
        if (perpResid > residLimit || (Math.abs(highDiff - lowDiff) / Math.hypot(1.0, slopeG)) > 2.0) continue;

        const gAtRx = evalNorm(rX);
        if (!isFinite(gAtRx)) continue;

        let rootType = 'cross';
        const probeEps = 1.5e-3;
        const dLeft = evalDiff(rY - probeEps);
        const dRight = evalDiff(rY + probeEps);
        if (
          isFinite(dLeft) && isFinite(dRight) &&
          Math.abs(dLeft) > 1e-12 && Math.abs(dRight) > 1e-12 &&
          Math.sign(dLeft) === Math.sign(dRight)
        ) {
          rootType = 'tangent';
        }
        addRoot(rX, 0.5 * (gAtRx + rY), rootType);
      }
    }

    // 7. 비격자 접점(중근) 황금분할 탐색 (수직 거리 정규화)
    const tangentRoots = [];
    const goldenIters = isFastDrag ? 18 : 28;
    const phi = 0.618033988749895;
    for (let i = 1; i < nSamples - 1; i++) {
      if (!valid[i - 1] || !valid[i] || !valid[i + 1]) continue;
      const dPrev = diffs[i - 1];
      const dCurr = diffs[i];
      const dNext = diffs[i + 1];
      if (Math.sign(dPrev) !== Math.sign(dNext) || Math.sign(dPrev) === 0) continue;

      const absPrev = Math.abs(dPrev);
      const absCurr = Math.abs(dCurr);
      const absNext = Math.abs(dNext);
      const roughSlope = estimateNormSlope(fxs[i]);
      const perpCurr = absCurr / Math.hypot(1.0, roughSlope);

      if (absCurr < absPrev && absCurr <= absNext && perpCurr < 0.06) {
        let l = ys[i - 1], r = ys[i + 1];
        let y1 = r - phi * (r - l);
        let y2 = l + phi * (r - l);
        let f1 = Math.abs(evalDiff(y1));
        let f2 = Math.abs(evalDiff(y2));

        for (let it = 0; it < goldenIters; it++) {
          if (f1 < f2) {
            r = y2; y2 = y1; f2 = f1;
            y1 = r - phi * (r - l);
            f1 = Math.abs(evalDiff(y1));
          } else {
            l = y1; y1 = y2; f1 = f2;
            y2 = l + phi * (r - l);
            f2 = Math.abs(evalDiff(y2));
          }
        }

        const bestY = 0.5 * (l + r);
        const rawBest = evalDiff(bestY);
        if (isNaN(rawBest) || !isFinite(rawBest)) continue;
        const bestFx = evalTrans(bestY);
        const bestGy = isFinite(bestFx) ? evalNorm(bestFx) : NaN;
        if (!isFinite(bestGy)) continue;

        const slopeG = estimateNormSlope(bestFx);
        const normFactor = Math.hypot(1.0, slopeG);
        const bestPerp = Math.abs(rawBest) / normFactor;
        const localVar = Math.max(Math.abs(dPrev - dCurr), Math.abs(dNext - dCurr)) / normFactor;
        const tanTol = Math.min(isFastDrag ? 1.5e-3 : 5e-4, Math.max(1e-5, localVar * 1.5e-2));

        if (bestPerp <= tanTol) {
          const minCrossSep = 0.025;
          const isNearCross = crossRoots.some(cr => Math.hypot(cr.x - bestFx, cr.y - bestGy) < minCrossSep);
          const isNearTangent = tangentRoots.some(tr => Math.hypot(tr.x - bestFx, tr.y - bestGy) < minCrossSep);
          if (!isNearCross && !isNearTangent) {
            tangentRoots.push({ x: bestFx, y: 0.5 * (bestGy + bestY), type: 'tangent' });
          }
        }
      }
    }

    const allRoots = [...crossRoots, ...tangentRoots].sort((a, b) => a.x - b.x || a.y - b.y);
    const merged = [];
    for (const r of allRoots) {
      if (!merged.some(m => Math.hypot(m.x - r.x, m.y - r.y) < dedupDist)) {
        merged.push(r);
      }
    }
    GraphMathEngine._annotateOffscreen(merged, viewRect);
    return merged;
  }

  static findFunctionIntersections(g1, g2, rangeX, viewRect, isFastDrag = false) {
    if (!g1 || !g1.handles || g1.handles.length === 0) return [];

    // [🔄 y=x 좌표축 전치(isTransposedYX) 그래프 교점 라우팅 — 순수 표준 그래프 쌍은 기존 고속 경로 100% 보존]
    const t1 = Boolean(g1 && g1.isTransposedYX);
    const t2 = Boolean(g2 && g2.isTransposedYX);
    if (t1 || t2) {
      // (A) 전치 그래프 vs x축(y = 0)
      if (!g2) {
        if (!g1._periodicEval && g1.type === '1st_linear' && g1.handles.length >= 2 &&
            Math.abs(g1.handles[1].x - g1.handles[0].x) < 1e-4) {
          return [];
        }
        const x0 = GraphMathEngine.evaluatePipeline(g1, 0.0);
        if (!isNaN(x0) && isFinite(x0)) {
          const out = [{ x: x0, y: 0.0, type: 'cross' }];
          GraphMathEngine._annotateOffscreen(out, viewRect);
          return out;
        }
        return [];
      }
      // (B) 전치 그래프 vs 전치 그래프: (y, x) 공간에서 기존 엔진 재사용 후 좌표 복원
      if (t1 && t2) {
        const rangeY = (viewRect && typeof viewRect.ymin === 'number' && typeof viewRect.ymax === 'number')
          ? { xmin: viewRect.ymin, xmax: viewRect.ymax }
          : rangeX;
        const n1 = { ...g1, isTransposedYX: false };
        const n2 = { ...g2, isTransposedYX: false };
        const sub = GraphMathEngine.findFunctionIntersections(n1, n2, rangeY, null, isFastDrag);
        const swapped = sub.map(r => ({ x: r.y, y: r.x, type: r.type })).sort((a, b) => a.x - b.x || a.y - b.y);
        GraphMathEngine._annotateOffscreen(swapped, viewRect);
        return swapped;
      }
      // (C) 표준 함수 y = G(x) vs 전치 함수 x = F(y)
      const gNorm = t1 ? g2 : g1;
      const gTrans = t1 ? g1 : g2;
      return GraphMathEngine._findMixedTransposedIntersections(gNorm, gTrans, rangeX, viewRect, isFastDrag);
    }

    const evalG = (g, x) => {
      return GraphMathEngine.evaluatePipeline(g, x);
    };

    // 1. 일차함수 완전 수직선 특수 케이스 처리 (x = c, 평행이동/대칭 반영)
    if (!g1._periodicEval && g1.type === '1st_linear' && g1.handles.length >= 2 && Math.abs(g1.handles[1].x - g1.handles[0].x) < 1e-4) {
      const vertX = GraphMathEngine.baseXToWorldX(g1, g1.handles[0].x);
      if (g2 && !g2._periodicEval && g2.type === '1st_linear' && g2.handles.length >= 2 && Math.abs(g2.handles[1].x - g2.handles[0].x) < 1e-4) {
        return [];
      }
      const targetY = evalG(g2, vertX);
      if (!isNaN(targetY) && isFinite(targetY)) {
        return [{ x: vertX, y: targetY, type: 'cross' }];
      }
      return [];
    }
    if (g2 && !g2._periodicEval && g2.type === '1st_linear' && g2.handles.length >= 2 && Math.abs(g2.handles[1].x - g2.handles[0].x) < 1e-4) {
      const vertX = GraphMathEngine.baseXToWorldX(g2, g2.handles[0].x);
      const targetY = evalG(g1, vertX);
      if (!isNaN(targetY) && isFinite(targetY)) {
        return [{ x: vertX, y: targetY, type: 'cross' }];
      }
      return [];
    }

    // 2. 탐색 범위 설정 (수학적 코어 영역 기본 보장 및 화면 가시/외곽 영역 완벽 포괄)
    let minX = -18.0;
    let maxX = 18.0;
    if (rangeX && typeof rangeX.xmin === 'number' && typeof rangeX.xmax === 'number') {
      const spanX = (rangeX.xmax - rangeX.xmin) || 10.0;
      minX = Math.min(minX, rangeX.xmin - spanX * 0.7);
      maxX = Math.max(maxX, rangeX.xmax + spanX * 0.7);
    }
    const expandByHandles = (gObj) => {
      if (!gObj || !Array.isArray(gObj.handles)) return;
      gObj.handles.forEach(h => {
        if (typeof h.x === 'number' && isFinite(h.x)) {
          const wx = GraphMathEngine.baseXToWorldX(gObj, h.x);
          if (typeof wx === 'number' && isFinite(wx)) {
            minX = Math.min(minX, wx - 8.0);
            maxX = Math.max(maxX, wx + 8.0);
          }
        }
      });
    };
    expandByHandles(g1);
    expandByHandles(g2);

    // [핵심 혁신]: 화각(Zoom)에 전혀 영향받지 않는 '초고밀도 고정 해상도(Fixed High-Resolution)' 스캐닝!
    // 가장 가까이서 들여다봤을 때와 100% 동일한 수학적 정밀도(dx <= 0.016)를 유지하여
    // 줌 인/아웃 시 교점이 사라지거나 튀는 현상을 원천 차단합니다.
    // (실시간 드래그 중에는 화면 오차 < 0.01px를 유지하면서 연산량을 1/4로 줄이는 고속 해상도 적용, 손을 떼는 순간 5000스텝 정밀 확정)
    const targetDx = isFastDrag ? 0.045 : 0.016;
    const rawSpan = maxX - minX;
    const steps = isFastDrag
      ? Math.min(1400, Math.max(480, Math.ceil(rawSpan / targetDx)))
      : Math.min(5000, Math.max(1200, Math.ceil(rawSpan / targetDx)));
    const dx = rawSpan / steps;

    // 0점 기준 그리드 정렬 (화면 Pan/Zoom 시 샘플링 위상 튐 원천 방지)
    const extMin = Math.floor(minX / dx) * dx;

    // A. 전체 구간 샘플링
    const xs = new Float64Array(steps + 1);
    const diffs = new Float64Array(steps + 1);
    const valid = new Uint8Array(steps + 1);

    let validCnt = 0;
    let zeroCnt = 0;
    for (let i = 0; i <= steps; i++) {
      const curX = extMin + i * dx;
      xs[i] = curX;
      const y1 = evalG(g1, curX);
      const y2 = evalG(g2, curX);
      if (isNaN(y1) || isNaN(y2) || !isFinite(y1) || !isFinite(y2)) {
        valid[i] = 0;
        diffs[i] = 0;
      } else {
        valid[i] = 1;
        diffs[i] = y1 - y2;
        validCnt++;
        if (Math.abs(diffs[i]) < 1e-6) zeroCnt++;
      }
    }
    // 자기역함수(y = x, y = -x + k, y = 1/x 등) 완전 일치 곡선의 5000개 중복 가짜 교점 폭주 원천 차단
    if (validCnt > 20 && zeroCnt >= validCnt * 0.65) {
      return [];
    }

    const crossRoots = [];

    // B. 관통 교점 및 격자 정렬 접점 탐색 (부호 반전 & 초정밀 이분법 + 불연속/점근선 완전 소거)
    for (let i = 0; i < steps; i++) {
      if (!valid[i] || !valid[i + 1]) continue;
      const d1 = diffs[i];
      const d2 = diffs[i + 1];
      if (Math.abs(d1) < 1e-10 && Math.abs(d2) < 1e-10) continue;

      // 점근선 점프(불연속) 1차 필터링
      if (Math.abs(d2 - d1) > 40 && Math.sign(d1) !== Math.sign(d2)) continue;

      if (d1 * d2 <= 0) {
        let low = xs[i];
        let high = xs[i + 1];
        let lowDiff = d1;
        let highDiff = d2;
        let aborted = false;

        const bisectIters = isFastDrag ? 16 : 22;
        for (let iter = 0; iter < bisectIters; iter++) {
          const mid = (low + high) / 2.0;
          const mDiff = evalG(g1, mid) - evalG(g2, mid);
          if (isNaN(mDiff) || !isFinite(mDiff)) {
            aborted = true;
            break;
          }
          if (lowDiff * mDiff <= 0) {
            high = mid;
            highDiff = mDiff;
          } else {
            low = mid;
            lowDiff = mDiff;
          }
        }
        if (aborted) continue;

        const midX = (low + high) / 2.0;
        const midDiff = evalG(g1, midX) - evalG(g2, midX);
        if (isNaN(midDiff) || !isFinite(midDiff)) continue;

        let rX = midX;
        let bestAbs = Math.abs(midDiff);
        if (Math.abs(lowDiff) < bestAbs) { bestAbs = Math.abs(lowDiff); rX = low; }
        if (Math.abs(highDiff) < bestAbs) { bestAbs = Math.abs(highDiff); rX = high; }

        // 연속성 정밀 검증: 계단함수 점프(floor/sign) 및 미세 진폭 탄젠트 점근선(0.05*tan) 가짜 근 원천 제거
        const residLimit = isFastDrag ? 2e-3 : 2e-4;
        if (bestAbs > residLimit || Math.abs(highDiff - lowDiff) > 2.0) continue;

        const rY = evalG(g1, rX);
        if (!isNaN(rY) && isFinite(rY)) {
          // 격자점에 정확히 걸린 짝수차 접점(y=x^2 vs y=0 등) 부호 유지 판별
          let rootType = 'cross';
          const probeEps = 1.5e-3;
          const dLeft = evalG(g1, rX - probeEps) - evalG(g2, rX - probeEps);
          const dRight = evalG(g1, rX + probeEps) - evalG(g2, rX + probeEps);
          if (
            isFinite(dLeft) && isFinite(dRight) &&
            Math.abs(dLeft) > 1e-12 && Math.abs(dRight) > 1e-12 &&
            Math.sign(dLeft) === Math.sign(dRight)
          ) {
            rootType = 'tangent';
          }

          // 중복 추가 방지 (화각과 무관한 절대 고정 거리 0.012)
          const dedupDist = 0.012;
          const existCross = crossRoots.find(cr => Math.abs(cr.x - rX) < dedupDist);
          if (!existCross) {
            crossRoots.push({ x: rX, y: rY, type: rootType });
          } else if (rootType === 'tangent') {
            existCross.type = 'tangent';
          }
        }
      }
    }

    // C. 접점(중근) 초정밀 탐색: 황금비 국소 최적화 (Golden Section Search)
    const tangentRoots = [];
    for (let i = 1; i < steps; i++) {
      if (!valid[i - 1] || !valid[i] || !valid[i + 1]) continue;
      const dPrev = diffs[i - 1];
      const dCurr = diffs[i];
      const dNext = diffs[i + 1];

      // 접점은 부호가 바뀌지 않는 국소 극소점이므로 양옆의 부호가 같아야 함
      if (Math.sign(dPrev) !== Math.sign(dNext) || Math.sign(dPrev) === 0) continue;

      const absPrev = Math.abs(dPrev);
      const absCurr = Math.abs(dCurr);
      const absNext = Math.abs(dNext);

      // 국소 극소점: 이전/이후보다 차이가 작고, 접점 후보 범위 이내일 때
      if (absCurr < absPrev && absCurr < absNext && absCurr < 0.06) {
        let l = xs[i - 1], r = xs[i + 1];
        const phi = 0.618033988749895;
        let x1 = r - phi * (r - l);
        let x2 = l + phi * (r - l);
        let f1 = Math.abs(evalG(g1, x1) - evalG(g2, x1));
        let f2 = Math.abs(evalG(g1, x2) - evalG(g2, x2));

        const goldenIters = isFastDrag ? 18 : 28;
        for (let it = 0; it < goldenIters; it++) {
          if (f1 < f2) {
            r = x2;
            x2 = x1;
            f2 = f1;
            x1 = r - phi * (r - l);
            f1 = Math.abs(evalG(g1, x1) - evalG(g2, x1));
          } else {
            l = x1;
            x1 = x2;
            f1 = f2;
            x2 = l + phi * (r - l);
            f2 = Math.abs(evalG(g1, x2) - evalG(g2, x2));
          }
        }

        const bestX = (l + r) / 2.0;
        const rawBest = evalG(g1, bestX) - evalG(g2, bestX);
        if (isNaN(rawBest) || !isFinite(rawBest)) continue;
        const bestDiff = Math.abs(rawBest);

        // 국소 변화량 비례 정밀 임계치: 만나지 않는 허공 곡선(예: x^2 + 0.03 vs 0)의 유령 접점 100% 차단!
        const localVar = Math.max(Math.abs(dPrev - dCurr), Math.abs(dNext - dCurr));
        const tanTol = Math.min(isFastDrag ? 1.5e-3 : 5e-4, Math.max(1e-5, localVar * 1e-2));

        if (bestDiff <= tanTol) {
          const minCrossSep = 0.025;
          const isNearCross = crossRoots.some(cr => Math.abs(cr.x - bestX) < minCrossSep);
          const isNearTangent = tangentRoots.some(tr => Math.abs(tr.x - bestX) < minCrossSep);
          if (!isNearCross && !isNearTangent) {
            const tY = evalG(g1, bestX);
            if (!isNaN(tY) && isFinite(tY)) {
              tangentRoots.push({ x: bestX, y: tY, type: 'tangent' });
            }
          }
        }
      }
    }

    // D. 최종 실근 리스트 통합 & 정렬 & 근접 근 중복 병합 (수학적 절대 고정 거리)
    const allRoots = [...crossRoots, ...tangentRoots].sort((a, b) => a.x - b.x);
    const merged = [];
    const minRootSep = 0.012;
    for (const r of allRoots) {
      if (merged.length === 0 || Math.abs(r.x - merged[merged.length - 1].x) >= minRootSep) {
        merged.push(r);
      }
    }

    // E. 화면 안 / 화면 밖 판정 및 화면 가장자리(끝단) 투영 좌표 계산
    if (viewRect) {
      const { xmin, xmax, ymin, ymax } = viewRect;
      merged.forEach(pt => {
        const isOffX = pt.x < xmin || pt.x > xmax;
        const isOffY = pt.y < ymin || pt.y > ymax;
        pt.isOffscreen = isOffX || isOffY;

        if (pt.isOffscreen) {
          // 화면 가장자리(끝단) 투영점 계산 (대표님 기획: 그래프 끝에서 반짝거림!)
          let bX = pt.x;
          let bY = pt.y;
          let side = 'right';

          if (pt.x < xmin) {
            bX = xmin;
            side = 'left';
          } else if (pt.x > xmax) {
            bX = xmax;
            side = 'right';
          }

          if (pt.y < ymin) {
            bY = ymin;
            if (pt.x >= xmin && pt.x <= xmax) side = 'bottom';
          } else if (pt.y > ymax) {
            bY = ymax;
            if (pt.x >= xmin && pt.x <= xmax) side = 'top';
          }

          pt.borderX = bX;
          pt.borderY = bY;
          pt.side = side;
        }
      });
    }

    return merged;
  }

  // =====================================================================
  // [📐 도형 교점 엔진] 함수↔도형, 도형↔도형 교점을 하나의 방식으로 계산
  //  - 모든 객체를 '함수(func) / 선분 묶음(segs) / 원(circle)' 3종으로 환원
  //  - 꼭짓점 중복 카운트 방지(dedupe), 접점(tangent) 판정, 변 겹침(overlap) 판정
  //  - 기존 함수↔함수 로직(findFunctionIntersections)은 그대로 보존
  // =====================================================================

  // 입구: 도형이 하나라도 끼면 도형 엔진, 아니면 기존 함수 엔진
  static findIntersections(g1, g2, rangeX, viewRect, isFastDrag = false) {
    const isGeom = (g) => !!g && typeof g.type === 'string' && g.type.startsWith('geom_');
    if (!isGeom(g1) && !isGeom(g2)) {
      return GraphMathEngine.findFunctionIntersections(g1, g2, rangeX, viewRect, isFastDrag);
    }
    return GraphMathEngine.findShapeIntersections(g1, g2, rangeX, viewRect);
  }

  // 객체 → 비교용 기본 요소(primitive) 환원
  static _toPrimitive(g) {
    if (!g) return { kind: 'func', f: () => 0.0 }; // null = x축(y=0)
    if (typeof g._periodicEval === 'function') {
      return { kind: 'func', f: (x) => g._periodicEval(x) };
    }
    const h = g.handles || [];
    if (g.type === 'geom_circle') {
      if (h.length < 2) return null;
      const cx = GraphMathEngine.baseXToWorldX(g, h[0].x);
      const cy = GraphMathEngine.baseYToWorldY(g, h[0].y);
      const r = Math.hypot(h[1].x - h[0].x, h[1].y - h[0].y);
      return { kind: 'circle', cx, cy, r };
    }
    if (g.type === 'geom_triangle' || g.type === 'geom_quad') {
      if (h.length < 3) return null;
      const segs = [];
      for (let i = 0; i < h.length; i++) {
        const a = h[i], b = h[(i + 1) % h.length];
        segs.push({
          x1: GraphMathEngine.baseXToWorldX(g, a.x),
          y1: GraphMathEngine.baseYToWorldY(g, a.y),
          x2: GraphMathEngine.baseXToWorldX(g, b.x),
          y2: GraphMathEngine.baseYToWorldY(g, b.y)
        });
      }
      return { kind: 'segs', segs };
    }
    // 완전 수직선 x = c (일차함수 특수 케이스) → 아주 긴 선분으로 환원 (전치 시 수평선 y = c)
    if (g.type === '1st_linear' && h.length >= 2 && Math.abs(h[1].x - g.handles[0].x) < 1e-4) {
      const c = GraphMathEngine.baseXToWorldX(g, h[0].x);
      if (g.isTransposedYX) {
        return { kind: 'func', f: () => c };
      }
      return { kind: 'segs', segs: [{ x1: c, y1: -1e5, x2: c, y2: 1e5 }] };
    }
    if (h.length === 0) return null;
    if (g.isTransposedYX) {
      const tf = (y) => GraphMathEngine.evaluatePipeline(g, y);
      return { kind: 'tfunc', f: tf };
    }
    const f = (x) => {
      return GraphMathEngine.evaluatePipeline(g, x);
    };
    return { kind: 'func', f };
  }

  // 1차원 스캔: diff(x)=0 인 관통 근(cross)과 접점 후보(tangent)를 탐색
  //  - overlap: 표본의 절반 이상이 0이면 '완전 겹침'으로 판정
  static _scanRoots(diff, lo, hi, steps, tol) {
    const res = { roots: [], overlap: false };
    if (!(hi > lo)) return res;
    const dx = (hi - lo) / steps;
    const xs = new Float64Array(steps + 1);
    const ds = new Float64Array(steps + 1);
    let zeroCnt = 0;
    for (let i = 0; i <= steps; i++) {
      xs[i] = lo + i * dx;
      const d = diff(xs[i]);
      ds[i] = (typeof d === 'number' && isFinite(d)) ? d : NaN;
      if (Math.abs(ds[i]) < 1e-6) zeroCnt++;
    }
    if (zeroCnt >= (steps + 1) * 0.5) {
      res.overlap = true;
      return res;
    }

    // A. 관통 근: 부호 반전 → 이분법 50회 (점근선 가짜 근은 잔차 검증으로 제거)
    for (let i = 0; i < steps; i++) {
      const a = ds[i], b = ds[i + 1];
      if (isNaN(a) || isNaN(b)) continue;
      if (a * b > 0) continue;
      let l = xs[i], r = xs[i + 1], fl = a;
      for (let it = 0; it < 50; it++) {
        const m = (l + r) / 2;
        const fm = diff(m);
        if (typeof fm !== 'number' || !isFinite(fm)) break;
        if (fl * fm <= 0) { r = m; } else { l = m; fl = fm; }
      }
      const rx = (l + r) / 2;
      const rd = diff(rx);
      if (typeof rd === 'number' && isFinite(rd) && Math.abs(rd) < 1e-3) {
        // 근 좌우 부호가 같으면 '닿기만 한' 접점, 다르면 관통
        const dl = diff(rx - dx * 0.25), dr = diff(rx + dx * 0.25);
        const touch = (typeof dl === 'number' && typeof dr === 'number' && isFinite(dl) && isFinite(dr) && dl * dr > 0);
        res.roots.push({ x: rx, type: touch ? 'tangent' : 'cross' });
      }
    }

    // B. 접점: 부호가 바뀌지 않는데 |diff|가 tol 이내로 파고드는 국소 극소점
    for (let i = 1; i < steps; i++) {
      const a = ds[i - 1], b = ds[i], c = ds[i + 1];
      if (isNaN(a) || isNaN(b) || isNaN(c)) continue;
      if (!((a > 0 && b > 0 && c > 0) || (a < 0 && b < 0 && c < 0))) continue;
      const aa = Math.abs(a), bb = Math.abs(b), cc = Math.abs(c);
      if (!(bb < aa && bb <= cc && bb < tol * 4)) continue;
      let l = xs[i - 1], r = xs[i + 1];
      for (let it = 0; it < 60; it++) {
        const m1 = l + (r - l) / 3, m2 = r - (r - l) / 3;
        if (Math.abs(diff(m1)) < Math.abs(diff(m2))) r = m2; else l = m1;
      }
      const tx = (l + r) / 2;
      const td = diff(tx);
      if (typeof td === 'number' && isFinite(td) && Math.abs(td) < tol) {
        res.roots.push({ x: tx, type: 'tangent' });
      }
    }
    return res;
  }

  // 함수 ↔ 선분
  static _funcSegment(f, s, tol) {
    const { x1, y1, x2, y2 } = s;
    const out = [];
    if (Math.abs(x2 - x1) < 1e-9) { // 수직 변
      const fy = f(x1);
      if (typeof fy !== 'number' || !isFinite(fy)) return out;
      const e = 1e-7;
      if (fy >= Math.min(y1, y2) - e && fy <= Math.max(y1, y2) + e) {
        out.push({ x: x1, y: fy, type: 'cross' });
      }
      return out;
    }
    const m = (y2 - y1) / (x2 - x1);
    const norm = Math.sqrt(1 + m * m);
    const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
    const diff = (x) => (f(x) - (y1 + m * (x - x1))) / norm; // 수직 거리로 정규화
    const r = GraphMathEngine._scanRoots(diff, lo, hi, 600, tol);
    if (r.overlap) {
      const mx = (lo + hi) / 2;
      out.push({ x: mx, y: y1 + m * (mx - x1), type: 'overlap' });
      return out;
    }
    r.roots.forEach(p => {
      const py = f(p.x);
      if (typeof py === 'number' && isFinite(py)) out.push({ x: p.x, y: py, type: p.type });
    });
    return out;
  }

  // 함수 ↔ 원
  static _funcCircle(f, c, tol) {
    const out = [];
    if (!(c.r > 1e-9)) return out;
    const diff = (x) => {
      const y = f(x);
      if (typeof y !== 'number' || !isFinite(y)) return NaN;
      return Math.hypot(x - c.cx, y - c.cy) - c.r;
    };
    const pad = c.r * 1e-4;
    const r = GraphMathEngine._scanRoots(diff, c.cx - c.r - pad, c.cx + c.r + pad, 900, tol);
    if (r.overlap) return out;
    r.roots.forEach(p => {
      const py = f(p.x);
      if (typeof py === 'number' && isFinite(py)) out.push({ x: p.x, y: py, type: p.type });
    });
    return out;
  }

  // 선분 ↔ 선분 (평행 겹침 포함)
  static _segSeg(a, b) {
    const out = [];
    const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1;
    const d2x = b.x2 - b.x1, d2y = b.y2 - b.y1;
    const len1 = Math.hypot(d1x, d1y), len2 = Math.hypot(d2x, d2y);
    if (len1 < 1e-12 || len2 < 1e-12) return out;
    const det = d1x * d2y - d1y * d2x;
    const wx = b.x1 - a.x1, wy = b.y1 - a.y1;
    if (Math.abs(det) < 1e-10 * len1 * len2) { // 평행
      const dist = Math.abs(wx * d1y - wy * d1x) / len1;
      if (dist > 1e-7) return out;
      // 공선: a 위 매개변수 t로 겹침 구간 계산
      const t3 = (wx * d1x + wy * d1y) / (len1 * len1);
      const t4 = ((b.x2 - a.x1) * d1x + (b.y2 - a.y1) * d1y) / (len1 * len1);
      const lo = Math.max(0, Math.min(t3, t4)), hi = Math.min(1, Math.max(t3, t4));
      if (hi < lo - 1e-9) return out;
      const t = (lo + hi) / 2;
      out.push({ x: a.x1 + t * d1x, y: a.y1 + t * d1y, type: (hi - lo) > 1e-7 ? 'overlap' : 'cross' });
      return out;
    }
    const t = (wx * d2y - wy * d2x) / det;
    const u = (wx * d1y - wy * d1x) / det;
    const e = 1e-9;
    if (t >= -e && t <= 1 + e && u >= -e && u <= 1 + e) {
      out.push({ x: a.x1 + t * d1x, y: a.y1 + t * d1y, type: 'cross' });
    }
    return out;
  }

  // 선분 ↔ 원 (접선 허용 오차 tol 포함)
  static _segCircle(s, c, tol) {
    const out = [];
    if (!(c.r > 1e-9)) return out;
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const A = dx * dx + dy * dy;
    if (A < 1e-18) return out;
    const fx = s.x1 - c.cx, fy = s.y1 - c.cy;
    const len = Math.sqrt(A);
    const t0 = -(fx * dx + fy * dy) / A;
    const perp = Math.abs(fx * dy - fy * dx) / len;
    if (Math.abs(perp - c.r) < tol && t0 >= 0 && t0 <= 1) {
      out.push({ x: s.x1 + t0 * dx, y: s.y1 + t0 * dy, type: 'tangent' });
      return out;
    }
    const B = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - c.r * c.r;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return out;
    const sq = Math.sqrt(disc);
    const e = 1e-9;
    [(-B - sq) / (2 * A), (-B + sq) / (2 * A)].forEach(t => {
      if (t >= -e && t <= 1 + e) out.push({ x: s.x1 + t * dx, y: s.y1 + t * dy, type: 'cross' });
    });
    return out;
  }

  // 원 ↔ 원
  static _circleCircle(c1, c2, tol) {
    const out = [];
    const dx = c2.cx - c1.cx, dy = c2.cy - c1.cy;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) {
      if (Math.abs(c1.r - c2.r) < 1e-9) out.push({ x: c1.cx + c1.r, y: c1.cy, type: 'overlap' });
      return out;
    }
    const ux = dx / d, uy = dy / d;
    const outer = c1.r + c2.r, inner = Math.abs(c1.r - c2.r);
    if (Math.abs(d - outer) < tol) {
      out.push({ x: c1.cx + ux * c1.r, y: c1.cy + uy * c1.r, type: 'tangent' });
      return out;
    }
    if (Math.abs(d - inner) < tol && inner > 1e-9) {
      const sgn = c1.r >= c2.r ? 1 : -1;
      out.push({ x: c1.cx + sgn * ux * c1.r, y: c1.cy + sgn * uy * c1.r, type: 'tangent' });
      return out;
    }
    if (d > outer || d < inner) return out;
    const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
    const h2 = c1.r * c1.r - a * a;
    if (h2 < 0) return out;
    const h = Math.sqrt(h2);
    const mx = c1.cx + ux * a, my = c1.cy + uy * a;
    out.push({ x: mx - uy * h, y: my + ux * h, type: 'cross' });
    out.push({ x: mx + uy * h, y: my - ux * h, type: 'cross' });
    return out;
  }

  // 화면 안/밖 판정 및 끝단 투영 좌표 주석
  static _annotateOffscreen(merged, viewRect) {
    if (!viewRect) return;
    const { xmin, xmax, ymin, ymax } = viewRect;
    merged.forEach(pt => {
      const isOffX = pt.x < xmin || pt.x > xmax;
      const isOffY = pt.y < ymin || pt.y > ymax;
      pt.isOffscreen = isOffX || isOffY;
      if (pt.isOffscreen) {
        let bX = pt.x, bY = pt.y, side = 'right';
        if (pt.x < xmin) { bX = xmin; side = 'left'; }
        else if (pt.x > xmax) { bX = xmax; side = 'right'; }
        if (pt.y < ymin) { bY = ymin; if (pt.x >= xmin && pt.x <= xmax) side = 'bottom'; }
        else if (pt.y > ymax) { bY = ymax; if (pt.x >= xmin && pt.x <= xmax) side = 'top'; }
        pt.borderX = bX; pt.borderY = bY; pt.side = side;
      }
    });
  }

  // 도형 교점 본체
  static findShapeIntersections(g1, g2, rangeX, viewRect) {
    const p1 = GraphMathEngine._toPrimitive(g1);
    const p2 = GraphMathEngine._toPrimitive(g2);
    if (!p1 || !p2) return [];

    const spanX = ((rangeX && (rangeX.xmax - rangeX.xmin)) || 10.0);
    const tol = spanX * 0.0016;           // 접점 허용 오차 (화면 배율에 비례)
    const mergeEps = Math.max(1e-6, spanX * 0.002); // 중복(꼭짓점 이중 카운트) 병합 거리

    const raw = [];
    const pair = (a, b) => {
      // a, b 순서를 정규화: func/tfunc < segs < circle
      const rank = { func: 0, tfunc: 0, segs: 1, circle: 2 };
      if (rank[a.kind] > rank[b.kind]) { const t = a; a = b; b = t; }
      if (a.kind === 'func' && b.kind === 'segs') {
        b.segs.forEach(s => raw.push(...GraphMathEngine._funcSegment(a.f, s, tol)));
      } else if (a.kind === 'func' && b.kind === 'circle') {
        raw.push(...GraphMathEngine._funcCircle(a.f, b, tol));
      } else if (a.kind === 'tfunc' && b.kind === 'segs') {
        b.segs.forEach(s => {
          const sSwap = { x1: s.y1, y1: s.x1, x2: s.y2, y2: s.x2 };
          GraphMathEngine._funcSegment(a.f, sSwap, tol).forEach(p => {
            raw.push({ x: p.y, y: p.x, type: p.type });
          });
        });
      } else if (a.kind === 'tfunc' && b.kind === 'circle') {
        const cSwap = { cx: b.cy, cy: b.cx, r: b.r };
        GraphMathEngine._funcCircle(a.f, cSwap, tol).forEach(p => {
          raw.push({ x: p.y, y: p.x, type: p.type });
        });
      } else if (a.kind === 'segs' && b.kind === 'segs') {
        a.segs.forEach(sa => b.segs.forEach(sb => raw.push(...GraphMathEngine._segSeg(sa, sb))));
      } else if (a.kind === 'segs' && b.kind === 'circle') {
        a.segs.forEach(s => raw.push(...GraphMathEngine._segCircle(s, b, tol)));
      } else if (a.kind === 'circle' && b.kind === 'circle') {
        raw.push(...GraphMathEngine._circleCircle(a, b, tol));
      }
    };
    pair(p1, p2);

    // 중복 병합: 같은 점이 인접한 두 변에서 이중으로 잡히는 경우(꼭짓점) 하나로
    const prio = { overlap: 3, tangent: 2, cross: 1 };
    const merged = [];
    raw.forEach(r => {
      if (!isFinite(r.x) || !isFinite(r.y)) return;
      const ex = merged.find(m => Math.hypot(m.x - r.x, m.y - r.y) < mergeEps);
      if (!ex) merged.push({ x: r.x, y: r.y, type: r.type });
      else if (prio[r.type] > prio[ex.type]) ex.type = r.type;
    });
    merged.sort((a, b) => a.x - b.x || a.y - b.y);

    GraphMathEngine._annotateOffscreen(merged, viewRect);
    return merged;
  }
}

// =====================================================================
// [🌐 순수 JS 초경량·안전 수식 컴파일러 (SafeMathCompiler)]
// - eval() / new Function() 0% 사용 (보안 취약점 원천 차단)
// - Shunting-yard 토크나이징 & RPN 가상머신 스택 평가 엔진
// - 사칙연산, 거듭제곱(^), 삼각·지수·로그·무리·절댓값 지원
// - 암시적 곱셈(2x, xsinx, 3(x+1)) 및 한국어 자연어 완전 지원
// =====================================================================
class SafeMathCompiler {
  static get FUNCS() {
    return {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      sinh: Math.sinh,
      cosh: Math.cosh,
      tanh: Math.tanh,
      exp: Math.exp,
      ln: Math.log,
      log: Math.log, // 한국 고교 교육과정 및 공학계산기 표준 (자연로그)
      log10: Math.log10,
      log2: Math.log2,
      sqrt: Math.sqrt,
      cbrt: Math.cbrt,
      abs: Math.abs,
      round: Math.round,
      floor: Math.floor,
      ceil: Math.ceil,
      sign: Math.sign
    };
  }

  static sanitize(expr) {
    if (!expr || typeof expr !== 'string') return '';
    let s = expr.trim();
    // y = 또는 f(x) = 또는 g(x) = 제거
    s = s.replace(/^(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\))\s*=\s*/i, '');

    // 한국어 구어체 자연어 치환
    const krMap = [
      [/엑스/g, 'x'],
      [/세제곱|3승/g, '^3'],
      [/네제곱|4승/g, '^4'],
      [/제곱|2승/g, '^2'],
      [/루트|제곱근/g, 'sqrt'],
      [/플러스|더하기/g, '+'],
      [/마이너스|빼기/g, '-'],
      [/곱하기/g, '*'],
      [/나누기/g, '/'],
      [/사인/g, 'sin'],
      [/코사인/g, 'cos'],
      [/탄젠트/g, 'tan'],
      [/파이|π/g, 'pi'],
      [/[−–—]/g, '-'],
      [/[×·]/g, '*'],
      [/÷/g, '/'],
      [/√/g, 'sqrt']
    ];
    for (const [pattern, replacement] of krMap) {
      s = s.replace(pattern, replacement);
    }

    // 1. 가우스 기호 [expr] -> floor(expr) (안쪽부터 순차 치환)
    let bracketGuard = 0;
    while (/\[[^\[\]]+\]/.test(s) && bracketGuard < 10) {
      s = s.replace(/\[([^\[\]]+)\]/g, 'floor($1)');
      bracketGuard++;
    }

    // 2. 중첩·연속 절댓값 |...| -> abs(...) 결정론적 스택 파서 (|2|x| - 3|, |x + |x - 1||, ||x| - 2| 완벽 지원)
    if (s.includes('|')) {
      s = SafeMathCompiler._convertPipeAbs(s);
    }

    // 지수 연산자 통일 (** -> ^)
    s = s.replace(/\*\*/g, '^');

    // 3. 역삼각함수 표기: sin^-1(x), sin^(-1)(x) -> asin(x) 등
    s = s.replace(/\b(sin|cos|tan)\s*\^\s*(?:\(\s*-1\s*\)|-1)\b/gi, (_, fn) => 'a' + fn.toLowerCase());

    // 4. 밑 지정 로그 및 함수 거듭제곱 표기: log_2(x), log_3(x), sin^2(x), cos^2 x 등
    s = SafeMathCompiler._rewriteLogBasesAndFuncPowers(s);

    // 한국식 간편 거듭제곱: x2 -> x^2, x3 -> x^3, x4 -> x^4
    s = s.replace(/\bx(\d+)\b/gi, 'x^$1');

    // 괄호 없는 기본 함수 보정: sinx -> sin(x), cosx -> cos(x) (단, sin x^2처럼 뒤에 ^가 오면 보존하여 sin(x^2)로 해석)
    s = s.replace(/\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|ln|log10|log2|log|sqrt|cbrt|abs|floor|ceil|round|sign)\s*x\b(?!\s*\^)/gi, '$1(x)');

    return s;
  }

  static _convertPipeAbs(s) {
    let totalPipes = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '|') totalPipes++;
    }
    if (totalPipes === 0 || totalPipes % 2 !== 0) return s;

    let out = '';
    let depth = 0;
    let pipesSeen = 0;
    let prevWasOpenDelim = true;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t') {
        out += ch;
        continue;
      }
      if (ch !== '|') {
        out += ch;
        prevWasOpenDelim = '(+-*/^,'.includes(ch);
        continue;
      }

      const remainingPipes = totalPipes - pipesSeen;
      pipesSeen++;

      let nextNonSpace = '';
      for (let k = i + 1; k < s.length; k++) {
        if (s[k] !== ' ' && s[k] !== '\t') {
          nextNonSpace = s[k];
          break;
        }
      }

      let isOpen = false;
      if (depth === 0) {
        isOpen = true;
      } else if (remainingPipes <= depth) {
        isOpen = false;
      } else if (prevWasOpenDelim) {
        isOpen = true;
      } else if (!nextNonSpace || '+-*/^),|'.includes(nextNonSpace)) {
        isOpen = false;
      } else {
        isOpen = true;
      }

      if (isOpen) {
        out += 'abs(';
        depth++;
        prevWasOpenDelim = true;
      } else {
        out += ')';
        depth--;
        prevWasOpenDelim = false;
      }
    }
    return depth === 0 ? out : s;
  }

  static _findMatchingParen(str, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  static _rewriteLogBasesAndFuncPowers(str) {
    let s = str;
    s = s.replace(/\blog_\{?10\}?(?=\s*[\(a-zA-Z0-9])/gi, 'log10');
    s = s.replace(/\blog_\{?2\}?(?=\s*[\(a-zA-Z0-9])/gi, 'log2');
    s = s.replace(/\blog_\{?e\}?(?=\s*[\(a-zA-Z0-9])/gi, 'ln');

    // 일반 밑 로그: log_a(expr) -> (ln(expr)/ln(a))
    let logGuard = 0;
    const genLogRe = /\blog_\{?(\d+(?:\.\d+)?)\}?\s*\(/i;
    while (logGuard < 12) {
      const m = genLogRe.exec(s);
      if (!m) break;
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = SafeMathCompiler._findMatchingParen(s, openIdx);
      if (closeIdx < 0) break;
      const baseStr = m[1];
      const inner = s.slice(openIdx + 1, closeIdx);
      s = s.slice(0, m.index) + `(ln(${inner})/ln(${baseStr}))` + s.slice(closeIdx + 1);
      logGuard++;
    }

    // 삼각·로그 거듭제곱: sin^2(expr) -> (sin(expr))^2 및 sin^2 x -> (sin(x))^2
    let powGuard = 0;
    const fnPowParenRe = /\b(sin|cos|tan|sinh|cosh|tanh|ln|log10|log2|log)\s*\^\s*(\d+(?:\.\d+)?)\s*\(/i;
    while (powGuard < 16) {
      const m = fnPowParenRe.exec(s);
      if (!m) break;
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = SafeMathCompiler._findMatchingParen(s, openIdx);
      if (closeIdx < 0) break;
      const fnName = m[1];
      const expStr = m[2];
      const inner = s.slice(openIdx + 1, closeIdx);
      s = s.slice(0, m.index) + `(${fnName}(${inner}))^${expStr}` + s.slice(closeIdx + 1);
      powGuard++;
    }
    s = s.replace(/\b(sin|cos|tan|sinh|cosh|tanh|ln|log10|log2|log)\s*\^\s*(\d+(?:\.\d+)?)\s*x\b/gi, '($1(x))^$2');
    return s;
  }

  static insertImplicitMul(s) {
    // 1. 숫자 + 변수/함수/상수/여는괄호: 2x -> 2*x, 3sin -> 3*sin, 4( -> 4*(
    //    (단, log2/log10 같은 식별자 내부 숫자와 1e-3 과학적 표기는 보존!)
    s = s.replace(/(?<![a-zA-Z0-9_.])(\d+(?:\.\d+)?)(?![eE][+-]?\d+\b(?!\s*\^))\s*([a-zA-Z(])/g, '$1*$2');

    // 2. 닫는괄호 + 숫자/변수/함수/여는괄호: )2 -> )*2, )x -> )*x, )( -> )*(
    s = s.replace(/\)\s*([a-zA-Z0-9(])/g, ')*$1');

    // 3. 변수 x + 여는괄호/상수/함수: x( -> x*(, x e -> x*e, x sin -> x*sin
    s = s.replace(/\bx\s*\(/gi, 'x*(');
    s = s.replace(/\bx\s*(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|ln|log10|log2|log|sqrt|cbrt|abs|floor|ceil|round|sign|pi|e)\b/gi, 'x*$1');

    // 4. 상수 pi, e 뒤 여는괄호/변수/함수: pi(x+1) -> pi*(x+1), e(x+1) -> e*(x+1)
    s = s.replace(/\b(pi|e)\s*\(/gi, '$1*(');
    s = s.replace(/\b(pi|e)\s+(x|sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|ln|log10|log2|log|sqrt|cbrt|abs|floor|ceil|round|sign|pi|e)\b/gi, '$1*$2');
    s = s.replace(/\bpi\s*x\b/gi, 'pi*x');

    return s;
  }

  static tokenize(raw) {
    let s = SafeMathCompiler.sanitize(raw);
    s = SafeMathCompiler.insertImplicitMul(s);

    const tokens = [];
    let i = 0;
    const len = s.length;

    while (i < len) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t') {
        i++;
        continue;
      }

      // 연산자 및 괄호
      if ('+*/^()'.includes(ch)) {
        tokens.push({ type: 'OP', value: ch });
        i++;
        continue;
      }

      // 마이너스 (-) : 이항 뺄셈 vs 단항 음수 판별
      if (ch === '-') {
        const prev = tokens[tokens.length - 1];
        if (!prev || (prev.type === 'OP' && prev.value !== ')') || prev.type === 'UNARY_MINUS' || prev.type === 'FUNC') {
          tokens.push({ type: 'UNARY_MINUS', value: 'neg' });
        } else {
          tokens.push({ type: 'OP', value: '-' });
        }
        i++;
        continue;
      }

      // 숫자 (과학적 표기 1e-3, 2.5e+4 포함 — 단, 2e^x는 지수 연산이므로 분리)
      if (/\d|\./.test(ch)) {
        let numStr = '';
        while (i < len && /[\d.]/.test(s[i])) {
          numStr += s[i];
          i++;
        }
        if (i < len && (s[i] === 'e' || s[i] === 'E')) {
          const sciMatch = s.slice(i).match(/^[eE]([+-]?\d+)\b(?!\s*\^)/);
          if (sciMatch) {
            numStr += sciMatch[0];
            i += sciMatch[0].length;
          }
        }
        const n = Number(numStr);
        if (numStr === '.' || isNaN(n)) return { error: `잘못된 숫자 형식: ${numStr}` };
        tokens.push({ type: 'NUM', value: n });
        continue;
      }

      // 식별자 (변수, 함수, 상수)
      if (/[a-zA-Z_]/.test(ch)) {
        let idStr = '';
        while (i < len && /[a-zA-Z0-9_]/.test(s[i])) {
          idStr += s[i];
          i++;
        }
        const lower = idStr.toLowerCase();

        if (lower === 'x') {
          tokens.push({ type: 'VAR', value: 'x' });
        } else if (lower === 'pi') {
          tokens.push({ type: 'CONST', value: Math.PI });
        } else if (lower === 'e') {
          tokens.push({ type: 'CONST', value: Math.E });
        } else if (SafeMathCompiler.FUNCS[lower]) {
          tokens.push({ type: 'FUNC', value: lower });
        } else {
          return { error: `알 수 없는 식별자 또는 함수: '${idStr}'` };
        }
        continue;
      }

      return { error: `지원하지 않는 기호: '${ch}'` };
    }

    return { tokens, cleanExpr: s };
  }

  static toRPN(tokens) {
    const output = [];
    const opStack = [];

    const PRECEDENCE = {
      '+': 2,
      '-': 2,
      'func_noparen': 2.5,
      '*': 3,
      '/': 3,
      'neg': 4,
      '^': 5
    };
    const RIGHT_ASSOC = {
      'neg': true,
      '^': true
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.type === 'NUM' || token.type === 'CONST' || token.type === 'VAR') {
        output.push(token);
      } else if (token.type === 'FUNC') {
        const nextTok = tokens[i + 1];
        if (!nextTok || (nextTok.type === 'OP' && nextTok.value === ')')) {
          return { error: `함수 '${token.value}'의 인자가 비어 있습니다.` };
        }
        const hasParen = Boolean(nextTok.type === 'OP' && nextTok.value === '(');
        opStack.push({ ...token, hasParen });
      } else if (token.type === 'UNARY_MINUS') {
        opStack.push(token);
      } else if (token.type === 'OP') {
        const val = token.value;
        if (val === '(') {
          const nextTok = tokens[i + 1];
          if (nextTok && nextTok.type === 'OP' && nextTok.value === ')') {
            return { error: '빈 괄호 ()는 사용할 수 없습니다.' };
          }
          opStack.push(token);
        } else if (val === ')') {
          let foundParen = false;
          while (opStack.length > 0) {
            const top = opStack.pop();
            if (top.type === 'OP' && top.value === '(') {
              foundParen = true;
              break;
            }
            output.push(top);
          }
          if (!foundParen) {
            return { error: '괄호의 짝이 맞지 않습니다.' };
          }
          if (opStack.length > 0 && opStack[opStack.length - 1].type === 'FUNC' && opStack[opStack.length - 1].hasParen) {
            output.push(opStack.pop());
          }
        } else {
          // 일반 이항 연산자 (+, -, *, /, ^)
          const prec = PRECEDENCE[val] || 0;
          const isRight = !!RIGHT_ASSOC[val];

          while (opStack.length > 0) {
            const top = opStack[opStack.length - 1];
            if (top.type === 'OP' && top.value === '(') break;
            if (top.type === 'FUNC' && top.hasParen) break;

            const topPrec = (top.type === 'UNARY_MINUS')
              ? PRECEDENCE['neg']
              : (top.type === 'FUNC' ? PRECEDENCE['func_noparen'] : (PRECEDENCE[top.value] || 0));
            if ((!isRight && topPrec >= prec) || (isRight && topPrec > prec)) {
              output.push(opStack.pop());
            } else {
              break;
            }
          }
          opStack.push(token);
        }
      }
    }

    while (opStack.length > 0) {
      const top = opStack.pop();
      if (top.type === 'OP' && (top.value === '(' || top.value === ')')) {
        return { error: '괄호의 짝이 맞지 않습니다.' };
      }
      output.push(top);
    }

    // 정적 RPN 스택 아리티(Arity) 검증: 2 + * 3, sin() 등 불완전 수식을 컴파일 시점에 즉시 검출!
    let simDepth = 0;
    for (let j = 0; j < output.length; j++) {
      const it = output[j];
      if (it.type === 'NUM' || it.type === 'CONST' || it.type === 'VAR') {
        simDepth += 1;
      } else if (it.type === 'UNARY_MINUS' || it.type === 'FUNC') {
        if (simDepth < 1) return { error: '수식 구문이 올바르지 않습니다.' };
      } else if (it.type === 'OP') {
        if (simDepth < 2) return { error: `연산자 '${it.value}' 앞뒤의 항을 확인해 주세요.` };
        simDepth -= 1;
      }
    }
    if (simDepth !== 1) {
      return { error: '수식 구문이 완성되지 않았습니다.' };
    }

    return { rpn: output };
  }

  static _evalRealPower(a, b) {
    if (isNaN(a) || isNaN(b)) return NaN;
    if (a >= 0 || Number.isInteger(b)) {
      return Math.pow(a, b);
    }
    // 음수 밑의 유리수 지수 a^(p/q): 홀수 분모 q (예: x^(1/3), x^(2/3)) 실수 거듭제곱근 지원!
    for (let q = 3; q <= 15; q += 2) {
      const pRound = Math.round(b * q);
      if (Math.abs(b * q - pRound) < 1e-9) {
        const root = Math.pow(-a, 1.0 / q);
        const mag = Math.pow(root, Math.abs(pRound));
        const signed = (Math.abs(pRound) % 2 === 1) ? -mag : mag;
        return pRound < 0 ? (Math.abs(signed) < 1e-15 ? NaN : (1.0 / signed)) : signed;
      }
    }
    return NaN;
  }

  static compile(raw) {
    if (!raw || typeof raw !== 'string') {
      return { success: false, error: '수식을 입력해 주세요.' };
    }
    const tokenRes = SafeMathCompiler.tokenize(raw);
    if (tokenRes.error) {
      return { success: false, error: tokenRes.error };
    }
    if (!tokenRes.tokens || tokenRes.tokens.length === 0) {
      return { success: false, error: '수식을 입력해 주세요.' };
    }

    const rpnRes = SafeMathCompiler.toRPN(tokenRes.tokens);
    if (rpnRes.error) {
      return { success: false, error: rpnRes.error };
    }

    const rpn = rpnRes.rpn;
    const funcs = SafeMathCompiler.FUNCS;

    // 평가 클로저 함수 생성 (eval 0%, 100% 안전한 스택 평가)
    const fn = (xVal) => {
      const stack = [];
      const len = rpn.length;
      for (let j = 0; j < len; j++) {
        const item = rpn[j];
        if (item.type === 'NUM' || item.type === 'CONST') {
          stack.push(item.value);
        } else if (item.type === 'VAR') {
          stack.push(xVal);
        } else if (item.type === 'UNARY_MINUS') {
          if (stack.length < 1) return NaN;
          stack.push(-stack.pop());
        } else if (item.type === 'FUNC') {
          if (stack.length < 1) return NaN;
          const arg = stack.pop();
          const f = funcs[item.value];
          stack.push(f ? f(arg) : NaN);
        } else if (item.type === 'OP') {
          if (stack.length < 2) return NaN;
          const b = stack.pop();
          const a = stack.pop();
          switch (item.value) {
            case '+': stack.push(a + b); break;
            case '-': stack.push(a - b); break;
            case '*': stack.push(a * b); break;
            case '/':
              if (Math.abs(b) < 1e-14) stack.push(NaN);
              else stack.push(a / b);
              break;
            case '^':
              stack.push(SafeMathCompiler._evalRealPower(a, b));
              break;
            default: stack.push(NaN);
          }
        }
      }
      return stack.length === 1 ? stack[0] : NaN;
    };

    // 정합성 검증: 임의의 3개 점(x = 0, 1, -1)에서 에러 없이 계산되는지 가볍게 테스트
    try {
      fn(0);
      fn(1);
      fn(-1);
    } catch (e) {
      return { success: false, error: `수식 계산 오류: ${e.message}` };
    }

    return {
      success: true,
      fn,
      cleanExpr: tokenRes.cleanExpr,
      rpn
    };
  }
}

// --- [스마트 자연어 수식 파서 (인간 친화형 프리스타일 수식 해석 & 핸들러 역산 엔진)] ---
class SmartMathParser {
  static normalize(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.trim().toLowerCase();

    // 0. y= 또는 f(x)=, g(x)= 제거
    s = s.replace(/^(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\))\s*=\s*/, '');

    // 1. 한국어 구어체 자연어 치환
    const krMap = [
      [/엑스/g, 'x'],
      [/세제곱|3승/g, '^3'],
      [/네제곱|4승/g, '^4'],
      [/제곱|2승/g, '^2'],
      [/루트|제곱근/g, 'sqrt'],
      [/플러스|더하기/g, '+'],
      [/마이너스|빼기/g, '-'],
      [/곱하기/g, '*'],
      [/나누기/g, '/'],
      [/사인/g, 'sin'],
      [/코사인/g, 'cos'],
      [/탄젠트/g, 'tan'],
      [/로그/g, 'log']
    ];
    for (const [pattern, replacement] of krMap) {
      s = s.replace(pattern, replacement);
    }

    // 공백 제거
    s = s.replace(/\s+/g, '');

    // 2. 꺾쇠 없는 거듭제곱 자동 보정: x2 -> x^2, x3 -> x^3, x4 -> x^4
    s = s.replace(/x(\d+)/g, 'x^$1');

    // 3. 괄호 없는 함수 자동 보정: sqrtx -> sqrt(x), sinx -> sin(x), etc.
    s = s.replace(/(sqrt|sin|cos|tan|log|ln)x/g, '$1(x)');

    // 4. 암시적 곱셈 보정: 2x -> 2*x, 3sqrt -> 3*sqrt, 2(x -> 2*(x
    s = s.replace(/(\d)(x|sqrt|sin|cos|tan|log|\()/g, '$1*$2');
    s = s.replace(/(\))(x|\()/g, '$1*$2');

    return s;
  }

  static parse(raw) {
    const norm = this.normalize(raw);
    if (!norm) {
      return { success: false, error: '수식을 입력해 주세요.' };
    }

    // [유형 1: 유리함수 k / (x - p) + q 또는 k/x]
    const ratMatch1 = norm.match(/^([+-]?\d*(?:\.\d+)?)\/x([+-]\d*(?:\.\d+)?)?$/);
    const ratMatch2 = norm.match(/^([+-]?\d*(?:\.\d+)?)\/\(x([+-]\d*(?:\.\d+)?)\)([+-]\d*(?:\.\d+)?)?$/);
    if (ratMatch1 || ratMatch2) {
      let k = 1.0, p = 0.0, q = 0.0;
      if (ratMatch1) {
        const kStr = ratMatch1[1];
        k = (kStr === '' || kStr === '+') ? 1.0 : (kStr === '-' ? -1.0 : parseFloat(kStr));
        if (ratMatch1[2]) q = parseFloat(ratMatch1[2]);
      } else {
        const kStr = ratMatch2[1];
        k = (kStr === '' || kStr === '+') ? 1.0 : (kStr === '-' ? -1.0 : parseFloat(kStr));
        if (ratMatch2[2]) p = -parseFloat(ratMatch2[2]); // (x-p) => p is positive
        if (ratMatch2[3]) q = parseFloat(ratMatch2[3]);
      }

      const qSign = q >= 0 ? `+ ${q}` : `- ${Math.abs(q)}`;
      const pText = p !== 0 ? (p > 0 ? `(x - ${p})` : `(x + ${Math.abs(p)})`) : 'x';
      const preview = `y = ${k} / ${pText} ${q !== 0 ? qSign : ''}`.trim();

      return {
        success: true,
        ftype: 'rational_basic',
        typeName: '유리함수 (쌍곡선)',
        preview,
        details: `대칭 중심 / 점근선 교점: (${p.toFixed(1)}, ${q.toFixed(1)}), 곡률 k = ${k.toFixed(1)}`,
        handles: [
          { name: '대칭 중심점', x: p, y: q, type: 'center', hidden: true },
          { name: '곡률 조절점', x: p + 1.0, y: q + k, type: 'point' }
        ]
      };
    }

    // [유형 2: 무리함수 a*sqrt(x - p) + q 또는 sqrt(x)]
    const sqrtMatch = norm.match(/^([+-]?\d*(?:\.\d+)?)?\*?sqrt\((?:x([+-]\d*(?:\.\d+)?)?)\)([+-]\d*(?:\.\d+)?)?$/);
    if (sqrtMatch) {
      const aStr = sqrtMatch[1];
      const a = (!aStr || aStr === '+') ? 1.0 : (aStr === '-' ? -1.0 : parseFloat(aStr));
      const p = sqrtMatch[2] ? -parseFloat(sqrtMatch[2]) : 0.0;
      const q = sqrtMatch[3] ? parseFloat(sqrtMatch[3]) : 0.0;

      const qSign = q >= 0 ? `+ ${q}` : `- ${Math.abs(q)}`;
      const pText = p !== 0 ? (p > 0 ? `x - ${p}` : `x + ${Math.abs(p)}`) : 'x';
      const preview = `y = ${a !== 1 ? a : ''}√(${pText}) ${q !== 0 ? qSign : ''}`.trim();

      return {
        success: true,
        ftype: 'sqrt_basic',
        typeName: '무리함수',
        preview,
        details: `시작점: (${p.toFixed(1)}, ${q.toFixed(1)}), 곡률 a = ${a.toFixed(1)}`,
        handles: [
          { name: '시작점', x: p, y: q, type: 'vertex' },
          { name: '방향/두께', x: p + 2.0, y: q + a * Math.sqrt(2.0), type: 'point' }
        ]
      };
    }

    // [유형 2-B: 지수함수 2^x, 2^(x-p) + q 등 (괄호 없는 2^x - 3 과 2^(x-3) 엄격 구분!)]
    const expMatch = norm.match(/^([+-]?\d*(?:\.\d+)?)?\*?2\^(?:\(x([+-]\d*(?:\.\d+)?)?\)|x)([+-]\d*(?:\.\d+)?)?$/);
    if (expMatch) {
      const aStr = expMatch[1];
      const a = (!aStr || aStr === '+') ? 1.0 : (aStr === '-' ? -1.0 : parseFloat(aStr));
      const p = expMatch[2] ? -parseFloat(expMatch[2]) : 0.0;
      const q = expMatch[3] ? parseFloat(expMatch[3]) : 0.0;

      const qSign = q >= 0 ? `+ ${q}` : `- ${Math.abs(q)}`;
      const pText = p !== 0 ? (p > 0 ? `x - ${p}` : `x + ${Math.abs(p)}`) : 'x';
      const preview = `y = ${a !== 1 ? a : ''}2^(${pText}) ${q !== 0 ? qSign : ''}`.trim();

      return {
        success: true,
        ftype: 'exp_basic',
        typeName: '지수함수 (밑 2)',
        preview,
        details: `수평 점근선: y = ${q.toFixed(1)}, 지수 성장`,
        handles: [
          { name: '점근선 기준점', x: p, y: q, type: 'asymptote', hidden: true },
          { name: '성장 조절점', x: p + 1.0, y: q + a * 2.0, type: 'point' }
        ]
      };
    }

    // [유형 3: 삼각함수 A*sin(w*x) + q 등]
    const trigMatch = norm.match(/^([+-]?\d*(?:\.\d+)?)?\*?(sin|cos|tan)\(x([+-]\d*(?:\.\d+)?)?\)([+-]\d*(?:\.\d+)?)?$/);
    if (trigMatch) {
      const aStr = trigMatch[1];
      const A = (!aStr || aStr === '+') ? 1.0 : (aStr === '-' ? -1.0 : parseFloat(aStr));
      const fn = trigMatch[2];
      const p = trigMatch[3] ? -parseFloat(trigMatch[3]) : 0.0;
      const q = trigMatch[4] ? parseFloat(trigMatch[4]) : 0.0;

      const ftypeMap = { sin: 'sin_1period', cos: 'cos_1period', tan: 'tan_1period' };
      const nameMap = { sin: 'sin(x) 삼각함수', cos: 'cos(x) 삼각함수', tan: 'tan(x) 삼각함수' };

      let handle1X = 1.57;
      if (fn === 'cos') handle1X = 6.28;
      else if (fn === 'tan') handle1X = 0.785;

      return {
        success: true,
        ftype: ftypeMap[fn],
        typeName: nameMap[fn],
        preview: `y = ${A !== 1 ? A : ''}${fn}(x${p !== 0 ? (p > 0 ? ` - ${p}` : ` + ${Math.abs(p)}`) : ''}) ${q !== 0 ? (q > 0 ? `+ ${q}` : `- ${Math.abs(q)}`) : ''}`.trim(),
        details: `진폭: ${Math.abs(A).toFixed(1)}, 중심 Y: ${q.toFixed(1)}`,
        handles: [
          { name: '중심 이동점', x: p, y: q, type: 'center', hidden: true },
          { name: '진폭·주기 조절', x: p + handle1X, y: q + A, type: 'point' }
        ]
      };
    }

    // [유형 4: 다항함수 (일차, 이차, 삼차 다항식)]
    const poly = this.parsePolynomial(norm);
    if (poly) {
      const degs = Object.keys(poly).map(Number).sort((a, b) => b - a);
      const maxDeg = degs.length > 0 ? degs[0] : 0;

      // 일차함수 y = mx + n
      if (maxDeg === 1) {
        const m = poly[1] || 0.0;
        const n = poly[0] || 0.0;
        const nSign = n >= 0 ? `+ ${n}` : `- ${Math.abs(n)}`;
        const preview = `y = ${m}x ${n !== 0 ? nSign : ''}`.trim();

        return {
          success: true,
          ftype: '1st_linear',
          typeName: '일차함수 (직선)',
          preview,
          details: `기울기 m = ${m.toFixed(2)}, Y절편 = ${n.toFixed(2)}`,
          handles: [
            { name: '기준점', x: 0.0, y: n, type: 'vertex' },
            { name: '기울기', x: 2.0, y: n + 2.0 * m, type: 'point' }
          ]
        };
      }

      // 이차함수 y = ax^2 + bx + c
      if (maxDeg === 2) {
        const a = poly[2] || 0.0;
        const b = poly[1] || 0.0;
        const c = poly[0] || 0.0;

        const xv = -b / (2.0 * a);
        const yv = c - (b * b) / (4.0 * a);
        const preview = `y = ${a !== 1 ? (a === -1 ? '-' : a) : ''}x² ${b !== 0 ? (b > 0 ? `+ ${b}x` : `- ${Math.abs(b)}x`) : ''} ${c !== 0 ? (c > 0 ? `+ ${c}` : `- ${Math.abs(c)}`) : ''}`.trim();

        return {
          success: true,
          ftype: '2nd_quadratic',
          typeName: '이차함수 포물선',
          preview,
          details: `꼭짓점: (${xv.toFixed(2)}, ${yv.toFixed(2)}), ${a > 0 ? '아래로 볼록' : '위로 볼록'}`,
          handles: [
            { name: '꼭짓점', x: xv, y: yv, type: 'vertex' },
            { name: '조절점', x: xv + 1.5, y: yv + a * 2.25, type: 'point' }
          ]
        };
      }

      // 삼차함수 y = ax^3 + bx^2 + cx + d
      if (maxDeg === 3) {
        const a = poly[3] || 0.0;
        const b = poly[2] || 0.0;
        const c = poly[1] || 0.0;
        const d = poly[0] || 0.0;
        const f = (x) => a * Math.pow(x, 3) + b * Math.pow(x, 2) + c * x + d;
        const preview = `y = ${a !== 1 ? (a === -1 ? '-' : a) : ''}x³ ${b !== 0 ? (b > 0 ? `+ ${b}x²` : `- ${Math.abs(b)}x²`) : ''} ${c !== 0 ? (c > 0 ? `+ ${c}x` : `- ${Math.abs(c)}x`) : ''} ${d !== 0 ? (d > 0 ? `+ ${d}` : `- ${Math.abs(d)}`) : ''}`.trim();

        // 도함수: y' = 3a*x^2 + 2b*x + c = 0
        const disc = 4.0 * b * b - 12.0 * a * c;

        if (disc > 1e-9) {
          const r1 = (-2.0 * b - Math.sqrt(disc)) / (6.0 * a);
          const r2 = (-2.0 * b + Math.sqrt(disc)) / (6.0 * a);
          let xMax, yMax, xMin, yMin;
          if (a > 0) {
            xMax = Math.min(r1, r2);
            yMax = f(xMax);
            xMin = Math.max(r1, r2);
            yMin = f(xMin);
          } else {
            xMin = Math.min(r1, r2);
            yMin = f(xMin);
            xMax = Math.max(r1, r2);
            yMax = f(xMax);
          }
          const xInf = (xMax + xMin) / 2.0;
          const yInf = (yMax + yMin) / 2.0;

          return {
            success: true,
            ftype: '3rd_normal',
            typeName: '삼차함수 (N자형)',
            preview,
            details: `극대: (${xMax.toFixed(2)}, ${yMax.toFixed(2)}), 극소: (${xMin.toFixed(2)}, ${yMin.toFixed(2)})`,
            handles: [
              { name: '극대', x: xMax, y: yMax, type: 'max' },
              { name: '극소', x: xMin, y: yMin, type: 'min' },
              { name: '변곡점', x: xInf, y: yInf, type: 'inflection' }
            ]
          };
        } else if (Math.abs(disc) <= 1e-9) {
          // 삼중근/변곡 접선 기울기 0인 순수 삼차형: y = a(x - xi)^3 + yi -> 3rd_basic_cubic 정밀 매핑!
          const xi = -b / (3.0 * a);
          const yi = f(xi);
          return {
            success: true,
            ftype: '3rd_basic_cubic',
            typeName: '삼차 기본형 (변곡)',
            preview,
            details: `변곡점: (${xi.toFixed(2)}, ${yi.toFixed(2)}), 계수 a = ${a.toFixed(2)}`,
            handles: [
              { name: '변곡점', x: xi, y: yi, type: 'inflection' },
              { name: '곡률 조절점', x: xi + 1.0, y: yi + a, type: 'point' }
            ]
          };
        }
        // disc < 0 (예: y = x^3 + x 등 접선 기울기가 양/음으로 유지되는 단조 삼차함수)는
        // 가짜 극대·극소가 생기지 않도록 아래 SafeMathCompiler 범용 수식(general_expr)으로 정확히 폴백!
      }
    }

    // [🌐 유형 폴백: 고교 템플릿에 없는 임의 수식은 범용 모드 SafeMathCompiler로 자동 승급 컴파일!]
    const compRes = SafeMathCompiler.compile(raw);
    if (compRes.success) {
      return {
        success: true,
        ftype: 'general_expr',
        typeName: '범용 수식 f(x)',
        preview: `y = ${compRes.cleanExpr}`,
        details: '임의 수식 렌더링 | 평행이동 & 대칭 지원',
        expr: compRes.cleanExpr,
        handles: [
          { name: '중심', x: 0.0, y: 0.0, type: 'center', fn: compRes.fn, rawExpr: compRes.cleanExpr }
        ]
      };
    }

    return {
      success: false,
      error: compRes.error || `수식을 이해하지 못했습니다. (예: x2+2x-3, x*sin(x), 1/x, e^(-x^2) 등)`
    };
  }

  static parsePolynomial(expr) {
    // x^2+2*x-3, -x^2+4, 2*x^3-6*x, 2*x+1 등 파싱
    const s = expr.replace(/-/g, '+-');
    const terms = s.split('+').filter(t => t.length > 0);
    const poly = {};

    for (let term of terms) {
      term = term.trim();
      if (!term) continue;

      const mPow = term.match(/^([+-]?\d*(?:\.\d+)?)\*?x\^(\d+)$/);
      const mLinear = term.match(/^([+-]?\d*(?:\.\d+)?)\*?x$/);
      const mConst = term.match(/^([+-]?\d+(?:\.\d+)?)$/);

      if (mPow) {
        const cStr = mPow[1];
        const deg = parseInt(mPow[2], 10);
        let c = 1.0;
        if (cStr === '-' || cStr === '-1') c = -1.0;
        else if (cStr && cStr !== '+') c = parseFloat(cStr);
        poly[deg] = (poly[deg] || 0.0) + c;
      } else if (mLinear) {
        const cStr = mLinear[1];
        let c = 1.0;
        if (cStr === '-' || cStr === '-1') c = -1.0;
        else if (cStr && cStr !== '+') c = parseFloat(cStr);
        poly[1] = (poly[1] || 0.0) + c;
      } else if (mConst) {
        poly[0] = (poly[0] || 0.0) + parseFloat(mConst[1]);
      } else {
        return null;
      }
    }
    return poly;
  }
}

// =====================================================================
// [🔗 상태 직렬화 & 초경량 압축 복원 엔진 (GraphStateSerializer)]
// - 레이어, 핸들 위치, 색상, 테마, 뷰포트, 구간 분할 등을 초소형 JSON으로 압축
// - URL-Safe Base64 인코딩으로 서버 0원 영구 복원
// =====================================================================
class GraphStateSerializer {
  static serialize(app, isStudentMode = false) {
    if (!app) return '';
    const graphsList = app.graphs || [];
    const graphs = graphsList.map((g, gIdx) => {
      const item = {
        t: g.type,
        c: g.color,
        w: g.lineWidth,
        a: g.isAbsolute ? 1 : 0,
        h: (g.handles || []).map(h => {
          const pt = [Number(h.x.toFixed(3)), Number(h.y.toFixed(3))];
          if (h.rawExpr) pt.push(h.rawExpr);
          else if (h.reflectX || h.reflectY) pt.push('');
          if (h.reflectX) pt.push(1);
          else if (h.reflectY) pt.push(0);
          if (h.reflectY) pt.push(1);
          return pt;
        })
      };
      if (g.isTransposedYX) item.tyx = 1;
      if (g.linkedInverseId !== undefined && g.linkedInverseId !== null) {
        const pIdx = graphsList.findIndex(cand => cand && cand.id === g.linkedInverseId);
        if (pIdx >= 0 && pIdx !== gIdx) item.li = pIdx;
      }
      const qm = (g.shapeMode && g.shapeMode !== 'free') ? g.shapeMode : g.quadMode;
      if (qm) item.qm = qm;
      if (g.originCenter || g.quadOriginCenter) item.qo = 1;
      if (g.isIndependent) item.ind = 1;
      if (g.isFrozen) item.fz = 1;
      if (g.freezeOffset && (g.freezeOffset.x || g.freezeOffset.y)) {
        item.fzo = [Number((g.freezeOffset.x || 0).toFixed(3)), Number((g.freezeOffset.y || 0).toFixed(3))];
      }
      if (g.frozenInvertH) item.fzh = 1;
      if (g.frozenInvertV) item.fzv = 1;
      if (g.frozenAbsolute) item.fza = 1;
      if (Array.isArray(g.transforms) && g.transforms.length > 0) {
        item.tr = g.transforms.map(tr => ({
          ox: Number(((tr.offset && tr.offset.x) || 0).toFixed(3)),
          oy: Number(((tr.offset && tr.offset.y) || 0).toFixed(3)),
          ih: tr.invertH ? 1 : 0,
          iv: tr.invertV ? 1 : 0,
          ab: tr.abs ? 1 : 0
        }));
      }
      return item;
    });

    const opts = {
      th: app.currentThemeKey || 'chalkboard',
      ax: app.showAxes ? 1 : 0,
      ar: app.showArrows ? 1 : 0,
      as: app.showAsymptotes ? 1 : 0,
      gd: app.showGuides ? 1 : 0,
      zm: Number((app.zoomLevel || 1.0).toFixed(2)),
      int: app.useIntersectionDetector ? 1 : 0
    };
    if (app.panX) opts.px = Number(app.panX.toFixed(1));
    if (app.panY) opts.py = Number(app.panY.toFixed(1));
    if (app.showInverseGuide) opts.ig = 1;

    if (app.usePiecewise) {
      opts.pw = 1;
      const bList = app.piecewiseBoundaries || [];
      opts.pwb = bList.length > 0 ? Number(bList[0].toFixed(2)) : Number((app.piecewiseBoundary || 0.0).toFixed(2));
      if (bList.length > 0) {
        opts.pwbs = bList.map(b => Number(b.toFixed(2)));
        opts.pwm = app.piecewiseFuncMap ? [...app.piecewiseFuncMap] : [];
      }
      if (Array.isArray(app.piecewiseInclusions) && app.piecewiseInclusions.length > 0) {
        opts.pwi = [...app.piecewiseInclusions];
      }
      if (app.isPiecewisePeriodic) {
        opts.pwp = 1;
        if (app.periodicStepY) opts.pws = Number(app.periodicStepY.toFixed(3));
      }
      if (app.isPiecewiseLocked) opts.pwl = 1;
      opts.pwr = app.pwActiveRange || 'left';
      opts.pwg = app.showPiecewiseGhost ? 1 : 0;
    }

    if (app.useViewfinder) {
      opts.vf = 1;
      opts.vfa = app.vfAspectName || '4:3';
      opts.vfw = Math.round(app.vfScreenW || 680);
      if (app.vfTargetWIn) opts.vfti = Number(app.vfTargetWIn.toFixed(2));
    }
    if (Array.isArray(app.dropLines) && app.dropLines.length > 0) {
      opts.dl = app.dropLines;
    }
    if (Array.isArray(app.textLabels) && app.textLabels.length > 0) {
      opts.tl = app.textLabels;
    }

    const payload = {
      v: 1,
      g: graphs,
      o: opts
    };
    if (isStudentMode) payload.s = 1;

    try {
      const jsonStr = JSON.stringify(payload);
      return GraphStateSerializer.toUrlSafeBase64(jsonStr);
    } catch (e) {
      console.error('직렬화 실패:', e);
      return '';
    }
  }

  static deserialize(hashStr) {
    if (!hashStr || typeof hashStr !== 'string') return null;
    let raw = hashStr.trim();
    if (raw.startsWith('#')) raw = raw.substring(1);

    // #share=... 또는 #student=... 형식 지원
    let isStudent = false;
    if (raw.startsWith('student=')) {
      isStudent = true;
      raw = raw.replace(/^student=/, '');
    } else if (raw.startsWith('share=')) {
      raw = raw.replace(/^share=/, '');
    }

    if (!raw) return null;

    try {
      const jsonStr = GraphStateSerializer.fromUrlSafeBase64(raw);
      const data = JSON.parse(jsonStr);
      if (!data || !data.g) return null;
      if (data.s) isStudent = true;
      data.isStudentMode = isStudent;
      return data;
    } catch (e) {
      console.error('역직렬화 실패:', e);
      return null;
    }
  }

  static toUrlSafeBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  static fromUrlSafeBase64(b64) {
    let str = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return decodeURIComponent(Array.prototype.map.call(atob(str), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  }
}

// =====================================================================
// [📱 순수 JS 초경량 QR 코드 생성기 (MiniQRCode — ISO/IEC 18004 정식 규격)]
// - 외부 CDN 및 인터넷 통신 0% (오프라인 / file:// 완전 지원)
// - Format Info(BCH 15,5) + Alignment Pattern + 4-Module Quiet Zone 완벽 준수
// =====================================================================
class MiniQRCode {
  static drawToCanvas(text, canvas, options = {}) {
    if (!canvas || !text) return false;
    const reqSize = options.size || canvas.width || 240;
    const fgColor = options.fgColor || '#0f172a';
    const bgColor = options.bgColor || '#ffffff';

    const utf8Bytes = MiniQRCode.toUtf8ByteString(String(text));

    // Version 1 ~ 14 (Error Correction Level L 기준 바이트 용량)
    const capacities = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858, 929, 1003, 1091, 1171, 1273];
    let typeNum = capacities.length;
    for (let i = 0; i < capacities.length; i++) {
      const extraLenBytes = (i + 1) < 10 ? 0 : 1;
      if (utf8Bytes.length + extraLenBytes <= capacities[i]) {
        typeNum = i + 1;
        break;
      }
    }

    const qr = new MiniQRCode.Model(typeNum);
    qr.addData(utf8Bytes);
    qr.make();

    const count = qr.getModuleCount();
    const quietZoneModules = 4; // ISO/IEC 18004 표준 4모듈 여백
    const totalModules = count + quietZoneModules * 2;
    const minCellPx = Math.max(6, Math.ceil(reqSize / totalModules));
    const actualSize = totalModules * minCellPx;

    const ctx = canvas.getContext('2d');
    canvas.width = actualSize;
    canvas.height = actualSize;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, actualSize, actualSize);

    const offsetPx = quietZoneModules * minCellPx;
    ctx.fillStyle = fgColor;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(
            offsetPx + c * minCellPx,
            offsetPx + r * minCellPx,
            minCellPx,
            minCellPx
          );
        }
      }
    }
    return true;
  }

  static toUtf8ByteString(str) {
    try {
      if (typeof TextEncoder !== 'undefined') {
        const bytes = new TextEncoder().encode(str);
        let out = '';
        for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
        return out;
      }
    } catch (e) { }
    return unescape(encodeURIComponent(str));
  }
}

// QR Code 내부 수학/블록 서브시스템 (ISO/IEC 18004 완전체)
(function() {
  function QR8bitByte(data) {
    this.mode = 4;
    this.data = data;
  }
  QR8bitByte.prototype = {
    getLength: function() { return this.data.length; },
    write: function(buf) {
      for (var i = 0; i < this.data.length; i++) buf.put(this.data.charCodeAt(i), 8);
    }
  };

  var QRUtil = {
    PATTERN_POSITION_TABLE: [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110]
    ],
    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
    getBCHDigit: function(data) {
      var digit = 0;
      while (data != 0) {
        digit++;
        data >>>= 1;
      }
      return digit;
    },
    getBCHTypeInfo: function(data) {
      var d = data << 10;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
        d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
      }
      return ((data << 10) | d) ^ QRUtil.G15_MASK;
    },
    getBCHTypeNumber: function(data) {
      var d = data << 12;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
        d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
      }
      return (data << 12) | d;
    },
    getPatternPosition: function(typeNumber) {
      return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1] || [];
    },
    getMask: function(maskPattern, i, j) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 == 0;
        case 1: return i % 2 == 0;
        case 2: return j % 3 == 0;
        case 3: return (i + j) % 3 == 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
        case 5: return (i * j) % 2 + (i * j) % 3 == 0;
        case 6: return ((i * j) % 2 + (i * j) % 3) % 2 == 0;
        case 7: return ((i * j) % 3 + (i + j) % 2) % 2 == 0;
        default: return (i + j) % 2 == 0;
      }
    },
    getLostPoint: function(qrCode) {
      var moduleCount = qrCode.getModuleCount();
      var lostPoint = 0;
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          var sameCount = 0;
          var dark = qrCode.isDark(row, col);
          for (var r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (var c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r == 0 && c == 0) continue;
              if (dark == qrCode.isDark(row + r, col + c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }
      for (var row = 0; row < moduleCount - 1; row++) {
        for (var col = 0; col < moduleCount - 1; col++) {
          var count = 0;
          if (qrCode.isDark(row, col)) count++;
          if (qrCode.isDark(row + 1, col)) count++;
          if (qrCode.isDark(row, col + 1)) count++;
          if (qrCode.isDark(row + 1, col + 1)) count++;
          if (count == 0 || count == 4) lostPoint += 3;
        }
      }
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount - 6; col++) {
          if (qrCode.isDark(row, col) && !qrCode.isDark(row, col + 1) && qrCode.isDark(row, col + 2) && qrCode.isDark(row, col + 3) && qrCode.isDark(row, col + 4) && !qrCode.isDark(row, col + 5) && qrCode.isDark(row, col + 6)) {
            lostPoint += 40;
          }
        }
      }
      for (var col = 0; col < moduleCount; col++) {
        for (var row = 0; row < moduleCount - 6; row++) {
          if (qrCode.isDark(row, col) && !qrCode.isDark(row + 1, col) && qrCode.isDark(row + 2, col) && qrCode.isDark(row + 3, col) && qrCode.isDark(row + 4, col) && !qrCode.isDark(row + 5, col) && qrCode.isDark(row + 6, col)) {
            lostPoint += 40;
          }
        }
      }
      var darkCount = 0;
      for (var col = 0; col < moduleCount; col++) {
        for (var row = 0; row < moduleCount; row++) {
          if (qrCode.isDark(row, col)) darkCount++;
        }
      }
      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;
      return lostPoint;
    }
  };

  var QRPolynomial = function(num, shift) {
    var offset = 0;
    while (offset < num.length && num[offset] == 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  };
  QRPolynomial.prototype = {
    get: function(index) { return this.num[index]; },
    getLength: function() { return this.num.length; },
    multiply: function(e) {
      var num = new Array(this.getLength() + e.getLength() - 1);
      for (var i = 0; i < this.getLength(); i++) {
        for (var j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    },
    mod: function(e) {
      if (this.getLength() - e.getLength() < 0) return this;
      var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      var num = new Array(this.getLength());
      for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (var i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  var QRMath = {
    glog: function(n) { return QRMath.LOG_TABLE[n]; },
    gexp: function(n) {
      while (n < 0) n += 255;
      while (n >= 255) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };
  for (var i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (var i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  for (var i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  var QRRSBlock = {
    // Version 1 ~ 14 Error Correction Level L (ISO/IEC 18004)
    RS_BLOCK_TABLE: [
      [1, 26, 19],
      [1, 44, 34],
      [1, 70, 55],
      [1, 100, 80],
      [1, 134, 108],
      [2, 86, 68],
      [2, 98, 78],
      [2, 121, 97],
      [2, 146, 116],
      [2, 86, 68, 2, 87, 69],
      [4, 101, 81],
      [2, 116, 92, 2, 117, 93],
      [4, 133, 107],
      [3, 145, 115, 1, 146, 116],
      [5, 109, 87, 1, 110, 88],
      [5, 122, 98, 1, 123, 99],
      [1, 135, 107, 5, 136, 108],
      [5, 150, 120, 1, 151, 121],
      [3, 141, 113, 4, 142, 114],
      [3, 135, 107, 5, 136, 108],
      [4, 144, 116, 4, 145, 117],
      [2, 139, 111, 7, 140, 112],
      [4, 151, 121, 5, 152, 122],
      [6, 147, 117, 4, 148, 118],
      [8, 132, 106, 4, 133, 107]
    ],
    getRSBlocks: function(typeNumber) {
      var rsBlock = QRRSBlock.RS_BLOCK_TABLE[typeNumber - 1] || QRRSBlock.RS_BLOCK_TABLE[0];
      var list = [];
      for (var i = 0; i < rsBlock.length / 3; i++) {
        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];
        for (var j = 0; j < count; j++) {
          list.push({ totalCount: totalCount, dataCount: dataCount });
        }
      }
      return list;
    }
  };

  function QRBitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype = {
    get: function(index) { return ((this.buffer[Math.floor(index / 8)] >>> (7 - index % 8)) & 1) == 1; },
    put: function(num, length) {
      for (var i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) == 1);
    },
    putBit: function(bit) {
      var bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  function QRCodeModel(typeNumber) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = 1; // Level L (format indicator 01)
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  QRCodeModel.prototype = {
    addData: function(data) {
      this.dataList.push(new QR8bitByte(data));
      this.dataCache = null;
    },
    isDark: function(row, col) { return Boolean(this.modules[row][col]); },
    getModuleCount: function() { return this.moduleCount; },
    make: function() {
      this.makeImpl(false, this.getBestMaskPattern());
    },
    makeImpl: function(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (var row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
        for (var col = 0; col < this.moduleCount; col++) {
          this.modules[row][col] = null;
        }
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      if (this.typeNumber >= 7) {
        this.setupTypeNumber(test);
      }
      if (this.dataCache == null) {
        this.dataCache = this.createData();
      }
      this.mapData(this.dataCache, maskPattern);
    },
    getBestMaskPattern: function() {
      var minLostPoint = 0;
      var pattern = 0;
      for (var i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        var lostPoint = QRUtil.getLostPoint(this);
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    },
    setupPositionProbePattern: function(row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },
    setupPositionAdjustPattern: function() {
      var pos = QRUtil.getPatternPosition(this.typeNumber);
      for (var i = 0; i < pos.length; i++) {
        for (var j = 0; j < pos.length; j++) {
          var row = pos[i];
          var col = pos[j];
          if (this.modules[row][col] != null) continue;
          for (var r = -2; r <= 2; r++) {
            for (var c = -2; c <= 2; c++) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    },
    setupTimingPattern: function() {
      for (var r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] != null) continue;
        this.modules[r][6] = (r % 2 == 0);
      }
      for (var c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] != null) continue;
        this.modules[6][c] = (c % 2 == 0);
      }
    },
    setupTypeNumber: function(test) {
      var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
      for (var i = 0; i < 18; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    },
    setupTypeInfo: function(test, maskPattern) {
      var data = (this.errorCorrectLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);
      for (var i = 0; i < 15; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 6) {
          this.modules[i][8] = mod;
        } else if (i < 8) {
          this.modules[i + 1][8] = mod;
        } else {
          this.modules[this.moduleCount - 15 + i][8] = mod;
        }
      }
      for (var i = 0; i < 15; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 8) {
          this.modules[8][this.moduleCount - i - 1] = mod;
        } else if (i < 9) {
          this.modules[8][15 - i - 1 + 1] = mod;
        } else {
          this.modules[8][15 - i - 1] = mod;
        }
      }
      this.modules[this.moduleCount - 8][8] = (!test);
    },
    createData: function() {
      var rsBlocks = QRRSBlock.getRSBlocks(this.typeNumber);
      var buffer = new QRBitBuffer();
      var lengthBits = this.typeNumber < 10 ? 8 : 16;
      for (var i = 0; i < this.dataList.length; i++) {
        var data = this.dataList[i];
        buffer.put(data.mode, 4);
        buffer.put(data.getLength(), lengthBits);
        data.write(buffer);
      }
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
      if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
      while (buffer.length % 8 != 0) buffer.putBit(false);
      while (true) {
        if (buffer.length >= totalDataCount * 8) break;
        buffer.put(0xec, 8);
        if (buffer.length >= totalDataCount * 8) break;
        buffer.put(0x11, 8);
      }
      return this.createBytes(buffer, rsBlocks);
    },
    createBytes: function(buffer, rsBlocks) {
      var offset = 0;
      var maxDcCount = 0;
      var maxEcCount = 0;
      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);
      for (var r = 0; r < rsBlocks.length; r++) {
        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = new Array(dcCount);
        for (var i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
        offset += dcCount;
        var rsPoly = new QRPolynomial([1], 0);
        for (var i = 0; i < ecCount; i++) rsPoly = rsPoly.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
        var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i++) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
        }
      }
      var data = [];
      for (var i = 0; i < maxDcCount; i++) {
        for (var r = 0; r < rsBlocks.length; r++) if (i < dcdata[r].length) data.push(dcdata[r][i]);
      }
      for (var i = 0; i < maxEcCount; i++) {
        for (var r = 0; r < rsBlocks.length; r++) if (i < ecdata[r].length) data.push(ecdata[r][i]);
      }
      return data;
    },
    mapData: function(data, maskPattern) {
      var inc = -1;
      var row = this.moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      for (var col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            if (this.modules[row][col - c] == null) {
              var dark = false;
              if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
              var mask = QRUtil.getMask(maskPattern, row, col - c);
              this.modules[row][col - c] = mask ? !dark : dark;
              bitIndex--;
              if (bitIndex == -1) { byteIndex++; bitIndex = 7; }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
        }
      }
    }
  };

  MiniQRCode.Model = QRCodeModel;
})();

// 브라우저 전역 및 ES 모듈 동시 지원
window.FUNC_METADATA = FUNC_METADATA;
window.GraphMathEngine = GraphMathEngine;
window.SmartMathParser = SmartMathParser;
window.SafeMathCompiler = SafeMathCompiler;
window.GraphStateSerializer = GraphStateSerializer;
window.MiniQRCode = MiniQRCode;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FUNC_METADATA,
    GraphMathEngine,
    SmartMathParser,
    SafeMathCompiler,
    GraphStateSerializer,
    MiniQRCode
  };
}
