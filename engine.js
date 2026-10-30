/**
 * Graph Master Web - Core Mathematical Engine
 * 파이썬 v2.0의 고교 미적분/대수학 곡선 수치해석 엔진 1:1 웹 네이티브 포팅
 * (더블 클릭 file:// 실행 및 로컬 서버 실행 100% 양방향 완벽 호환)
 */

const FUNC_METADATA = {
  // 1. 다항함수 (1차 -> 2차 -> 3차 -> 4차 3종 순서 정렬)
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
  "3rd_basic_cubic": {
    name: "삼차 기본 (y=x³)",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 17 C10 17, 10 3, 20 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "변곡점", x: 0.0, y: 0.0, type: "inflection" },
      { name: "조절점", x: 1.2, y: 1.7, type: "point" }
    ]
  },
  "4th_symmetric": {
    name: "사차함수 1",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 5 Q6 17 8.5 11 Q12 6 15.5 11 Q18 17 20 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "극소", x: -1.5, y: -2.0, type: "min" },
      { name: "극대", x: 0.0, y: 1.0, type: "max" },
      { name: "극소", x: 1.5, y: -2.0, type: "min" }
    ]
  },
  "4th_asymmetric": {
    name: "사차함수 2",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 7 Q6.5 14 9 10 Q11 6 13 11 Q16 20 20 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "극소", x: -1.5, y: -1.8, type: "min" },
      { name: "극대", x: -0.1, y: 1.0, type: "max" },
      { name: "극소", x: 1.5, y: -3.0, type: "min" }
    ]
  },
  "4th_inflection": {
    name: "사차함수 3",
    category: "📐 다항함수",
    svg: `<svg viewBox="0 0 24 20" class="mini-func-icon"><path d="M4 5 C6 9.5 7.5 9.5 9.5 9.5 C11.5 9.5 12.5 16 14.5 16 C16.5 16 18 10 20 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    handles: [
      { name: "변곡점", x: -1.0, y: 1.0, type: "inflection" },
      { name: "극소", x: 1.0, y: -2.0, type: "min" }
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
  // --- [❄️ 무한 다단 절댓값 & 형상 평행이동 계층형 파이프라인] ---
  static evaluatePipeline(g, x) {
    if (!g) return 0.0;
    if (!g.handles || g.handles.length === 0) return NaN;

    const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    const hasOuter = g.isFrozen || ox !== 0 || oy !== 0 || g.frozenInvertH || g.frozenInvertV || g.frozenAbsolute || (g.transforms && g.transforms.length > 0);

    // 0. 무한 다단 변환 파이프라인(transforms)이 있는 경우 체이닝 연산
    if (g.transforms && g.transforms.length > 0) {
      let curX = x;
      let totalOx = ox;
      for (const t of g.transforms) {
        if (t.offset && typeof t.offset.x === 'number') totalOx += t.offset.x;
      }
      curX -= totalOx;

      let y = GraphMathEngine.evaluate(g.type, g.handles, curX);
      if (g.isAbsolute) y = Math.abs(y);

      for (const t of g.transforms) {
        if (t.offset && typeof t.offset.y === 'number') y += t.offset.y;
        if (t.invertV) y = -y;
        if (t.abs) y = Math.abs(y);
      }

      y += oy;
      if (g.frozenAbsolute) y = Math.abs(y);
      return y;
    }

    if (!hasOuter) {
      // [순수 1차 기본 수식]
      let y = GraphMathEngine.evaluate(g.type, g.handles, x);
      if (g.isAbsolute) y = Math.abs(y);
      return y;
    }

    // [평행이동/대칭/절댓값 계층 연산]
    let evalX = x - ox;
    if (g.frozenInvertH) evalX = -evalX;

    let y = GraphMathEngine.evaluate(g.type, g.handles, evalX);
    if (isNaN(y) || !isFinite(y)) return NaN;

    if (g.isAbsolute) y = Math.abs(y);
    if (g.frozenInvertV) y = -y;
    y += oy;
    if (g.frozenAbsolute) y = Math.abs(y);

    return y;
  }

  static evaluate(ftype, handles, x) {
    switch (ftype) {
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
        const sorted = [...handles].sort((a, b) => a.x - b.x);
        let [h1, h2, h3] = sorted;
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
        const sorted = [...handles.slice(0, 2)].sort((a, b) => a.x - b.x);
        const x1 = sorted[0].x, y1 = sorted[0].y;
        const x2 = sorted[1].x, y2 = sorted[1].y;
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
          if (x < x0) return NaN;
          return y0 + dy * Math.sqrt((x - x0) / dx);
        } else {
          if (x > x0) return NaN;
          return y0 + dy * Math.sqrt((x0 - x) / -dx);
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
        // y = a * ln(x) / x [x=x0+p/e 통과 후 x=x0+p에서 극대]
        const x0 = handles[0].x, y0 = handles[0].y;
        let p = handles[1].x - x0;
        let q = handles[1].y - y0;
        if (p <= 0.1) p = 0.1;
        const dx = x - x0;
        if (dx <= 1e-4) return NaN;
        return y0 + (p * q * Math.log((Math.E * dx) / p)) / dx;
      }

      // --- [🌐 범용 수식: y = a * f(b(x - h)) + k 임의 수식 초고속 평가] ---
      case "general_expr": {
        if (!handles || handles.length === 0) return NaN;
        const h = handles[0].x || 0.0;
        const k = handles[0].y || 0.0;
        const fn = handles[0].fn || null;
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
          // 로그 분수형은 x > 0 필수
          dx = Math.max(0.35, dx);
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
      // 극대/극소 성격 스왑
      if (h.type === "max") h.type = "min";
      else if (h.type === "min") h.type = "max";
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
  static findFunctionIntersections(g1, g2, rangeX, viewRect) {
    if (!g1 || !g1.handles || g1.handles.length === 0) return [];

    const evalG = (g, x) => {
      return GraphMathEngine.evaluatePipeline(g, x);
    };

    // 1. 일차함수 완전 수직선 특수 케이스 처리 (x = c)
    if (g1.type === '1st_linear' && g1.handles.length >= 2 && Math.abs(g1.handles[1].x - g1.handles[0].x) < 1e-4) {
      const vertX = g1.handles[0].x;
      const targetY = evalG(g2, vertX);
      if (!isNaN(targetY) && isFinite(targetY)) {
        return [{ x: vertX, y: targetY, type: 'cross' }];
      }
      return [];
    }
    if (g2 && g2.type === '1st_linear' && g2.handles.length >= 2 && Math.abs(g2.handles[1].x - g2.handles[0].x) < 1e-4) {
      const vertX = g2.handles[0].x;
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
    const allHandles = [...(g1.handles || []), ...(g2 ? g2.handles || [] : [])];
    if (allHandles.length > 0) {
      allHandles.forEach(h => {
        if (typeof h.x === 'number' && isFinite(h.x)) {
          minX = Math.min(minX, h.x - 8.0);
          maxX = Math.max(maxX, h.x + 8.0);
        }
      });
    }

    // [핵심 혁신]: 화각(Zoom)에 전혀 영향받지 않는 '초고밀도 고정 해상도(Fixed High-Resolution)' 스캐닝!
    // 가장 가까이서 들여다봤을 때와 100% 동일한 수학적 정밀도(dx <= 0.016)를 유지하여
    // 줌 인/아웃 시 교점이 사라지거나 튀는 현상을 원천 차단합니다.
    const targetDx = 0.016;
    const rawSpan = maxX - minX;
    const steps = Math.min(5000, Math.max(1200, Math.ceil(rawSpan / targetDx)));
    const dx = rawSpan / steps;

    // 0점 기준 그리드 정렬 (화면 Pan/Zoom 시 샘플링 위상 튐 원천 방지)
    const extMin = Math.floor(minX / dx) * dx;

    // A. 전체 구간 샘플링
    const xs = new Float64Array(steps + 1);
    const diffs = new Float64Array(steps + 1);
    const valid = new Uint8Array(steps + 1);

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
      }
    }

    const crossRoots = [];

    // B. 관통 교점 탐색 (부호 반전 & 20회 초정밀 이분법 수렴)
    for (let i = 0; i < steps; i++) {
      if (!valid[i] || !valid[i + 1]) continue;
      const d1 = diffs[i];
      const d2 = diffs[i + 1];

      // 점근선 점프(불연속) 필터링
      if (Math.abs(d2 - d1) > 40 && Math.sign(d1) !== Math.sign(d2)) continue;

      if (d1 * d2 <= 0) {
        let low = xs[i];
        let high = xs[i + 1];
        let lowDiff = d1;

        for (let iter = 0; iter < 20; iter++) {
          const mid = (low + high) / 2.0;
          const mDiff = evalG(g1, mid) - evalG(g2, mid);
          if (isNaN(mDiff) || !isFinite(mDiff)) break;
          if (lowDiff * mDiff <= 0) {
            high = mid;
          } else {
            low = mid;
            lowDiff = mDiff;
          }
        }

        const rX = (low + high) / 2.0;
        const rY = evalG(g1, rX);
        if (!isNaN(rY) && isFinite(rY)) {
          // 중복 추가 방지 (화각과 무관한 절대 고정 거리 0.012)
          const dedupDist = 0.012;
          if (!crossRoots.some(cr => Math.abs(cr.x - rX) < dedupDist)) {
            crossRoots.push({ x: rX, y: rY, type: 'cross' });
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

      // 국소 극소점: 이전/이후보다 차이가 작고, 접점 허용 임계치 이내일 때
      if (absCurr < absPrev && absCurr < absNext && absCurr < 0.06) {
        // 정밀 황금비 탐색 (Golden Section Search 25회: 오차 < 10^-6)
        let l = xs[i - 1], r = xs[i + 1];
        const phi = 0.618033988749895;
        let x1 = r - phi * (r - l);
        let x2 = l + phi * (r - l);
        let f1 = Math.abs(evalG(g1, x1) - evalG(g2, x1));
        let f2 = Math.abs(evalG(g1, x2) - evalG(g2, x2));

        for (let it = 0; it < 25; it++) {
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
        const bestDiff = Math.abs(evalG(g1, bestX) - evalG(g2, bestX));

        if (bestDiff <= 0.038) {
          // 이미 crossRoots에 있는 관통 교점과 충분히 떨어져 있는 경우에만 접점으로 등록
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
  static findIntersections(g1, g2, rangeX, viewRect) {
    const isGeom = (g) => !!g && typeof g.type === 'string' && g.type.startsWith('geom_');
    if (!isGeom(g1) && !isGeom(g2)) {
      return GraphMathEngine.findFunctionIntersections(g1, g2, rangeX, viewRect);
    }
    return GraphMathEngine.findShapeIntersections(g1, g2, rangeX, viewRect);
  }

  // 객체 → 비교용 기본 요소(primitive) 환원
  static _toPrimitive(g) {
    if (!g) return { kind: 'func', f: () => 0.0 }; // null = x축(y=0)
    const h = g.handles || [];
    if (g.type === 'geom_circle') {
      if (h.length < 2) return null;
      const r = Math.hypot(h[1].x - h[0].x, h[1].y - h[0].y);
      return { kind: 'circle', cx: h[0].x, cy: h[0].y, r };
    }
    if (g.type === 'geom_triangle' || g.type === 'geom_quad') {
      if (h.length < 3) return null;
      const segs = [];
      for (let i = 0; i < h.length; i++) {
        const a = h[i], b = h[(i + 1) % h.length];
        segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }
      return { kind: 'segs', segs };
    }
    // 완전 수직선 x = c (일차함수 특수 케이스) → 아주 긴 선분으로 환원
    if (g.type === '1st_linear' && h.length >= 2 && Math.abs(h[1].x - h[0].x) < 1e-4) {
      const c = h[0].x;
      return { kind: 'segs', segs: [{ x1: c, y1: -1e5, x2: c, y2: 1e5 }] };
    }
    if (h.length === 0) return null;
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
      // a, b 순서를 정규화: func < segs < circle
      const rank = { func: 0, segs: 1, circle: 2 };
      if (rank[a.kind] > rank[b.kind]) { const t = a; a = b; b = t; }
      if (a.kind === 'func' && b.kind === 'segs') {
        b.segs.forEach(s => raw.push(...GraphMathEngine._funcSegment(a.f, s, tol)));
      } else if (a.kind === 'func' && b.kind === 'circle') {
        raw.push(...GraphMathEngine._funcCircle(a.f, b, tol));
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
      [/파이/g, 'pi']
    ];
    for (const [pattern, replacement] of krMap) {
      s = s.replace(pattern, replacement);
    }

    // 지수 연산자 통일 (** -> ^)
    s = s.replace(/\*\*/g, '^');

    // 한국식 간편 거듭제곱: x2 -> x^2, x3 -> x^3, x4 -> x^4
    s = s.replace(/\bx(\d+)\b/gi, 'x^$1');

    // 괄호 없는 기본 함수 보정: sinx -> sin(x), cosx -> cos(x), sqrtx -> sqrt(x), lnx -> ln(x)
    s = s.replace(/\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|ln|log|sqrt|cbrt|abs)\s*x\b/gi, '$1(x)');

    return s;
  }

  static insertImplicitMul(s) {
    // 1. 숫자 + 변수/함수/상수/여는괄호: 2x -> 2*x, 3sin -> 3*sin, 4( -> 4*(
    s = s.replace(/(\d+(?:\.\d+)?)\s*([a-zA-Z(])/g, '$1*$2');

    // 2. 닫는괄호 + 숫자/변수/함수/여는괄호: )2 -> )*2, )x -> )*x, )( -> )*(
    s = s.replace(/\)\s*([a-zA-Z0-9(])/g, ')*$1');

    // 3. 변수 x + 여는괄호/상수/함수: x( -> x*(, x e -> x*e, x sin -> x*sin
    s = s.replace(/\bx\s*\(/gi, 'x*(');
    s = s.replace(/\bx\s*(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|ln|log|sqrt|cbrt|abs|pi|e)\b/gi, 'x*$1');

    // 4. 상수 pi 뒤 변수/함수/괄호
    s = s.replace(/\bpi\s*([x(])/gi, 'pi*$1');

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
        if (!prev || (prev.type === 'OP' && prev.value !== ')') || prev.type === 'UNARY_MINUS') {
          tokens.push({ type: 'UNARY_MINUS', value: 'neg' });
        } else {
          tokens.push({ type: 'OP', value: '-' });
        }
        i++;
        continue;
      }

      // 숫자
      if (/\d|\./.test(ch)) {
        let numStr = '';
        while (i < len && /[\d.]/.test(s[i])) {
          numStr += s[i];
          i++;
        }
        const n = parseFloat(numStr);
        if (isNaN(n)) return { error: `잘못된 숫자 형식: ${numStr}` };
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
      } else if (token.type === 'FUNC' || token.type === 'UNARY_MINUS') {
        opStack.push(token);
      } else if (token.type === 'OP') {
        const val = token.value;
        if (val === '(') {
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
          if (opStack.length > 0 && opStack[opStack.length - 1].type === 'FUNC') {
            output.push(opStack.pop());
          }
        } else {
          // 일반 이항 연산자 (+, -, *, /, ^)
          const prec = PRECEDENCE[val] || 0;
          const isRight = !!RIGHT_ASSOC[val];

          while (opStack.length > 0) {
            const top = opStack[opStack.length - 1];
            if (top.type === 'OP' && top.value === '(') break;

            const topPrec = (top.type === 'UNARY_MINUS') ? PRECEDENCE['neg'] : (PRECEDENCE[top.value] || 0);
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

    return { rpn: output };
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
              if (a < 0 && !Number.isInteger(b)) stack.push(NaN);
              else stack.push(Math.pow(a, b));
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

    // [유형 2-B: 지수함수 2^x, 2^(x-p) + q 등]
    const expMatch = norm.match(/^([+-]?\d*(?:\.\d+)?)?\*?2\^(?:\(?x([+-]\d*(?:\.\d+)?)?\)?)([+-]\d*(?:\.\d+)?)?$/);
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

        // 도함수: y' = 3a*x^2 + 2b*x + c = 0
        const disc = 4.0 * b * b - 12.0 * a * c;
        let xMax = -1.0, yMax = 2.0, xMin = 1.0, yMin = -2.0;

        if (disc > 0) {
          const r1 = (-2.0 * b - Math.sqrt(disc)) / (6.0 * a);
          const r2 = (-2.0 * b + Math.sqrt(disc)) / (6.0 * a);
          const f = (x) => a * Math.pow(x, 3) + b * Math.pow(x, 2) + c * x + d;
          const y1 = f(r1);
          const y2 = f(r2);

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
        } else {
          // 변곡점 중심 근사
          const xi = -b / (3.0 * a);
          const f = (x) => a * Math.pow(x, 3) + b * Math.pow(x, 2) + c * x + d;
          xMax = xi - 1.0; yMax = f(xMax);
          xMin = xi + 1.0; yMin = f(xMin);
        }

        const preview = `y = ${a !== 1 ? (a === -1 ? '-' : a) : ''}x³ ${b !== 0 ? (b > 0 ? `+ ${b}x²` : `- ${Math.abs(b)}x²`) : ''} ${c !== 0 ? (c > 0 ? `+ ${c}x` : `- ${Math.abs(c)}x`) : ''} ${d !== 0 ? (d > 0 ? `+ ${d}` : `- ${Math.abs(d)}`) : ''}`.trim();

        return {
          success: true,
          ftype: '3rd_normal',
          typeName: '삼차함수 (N자형)',
          preview,
          details: `극대: (${xMax.toFixed(2)}, ${yMax.toFixed(2)}), 극소: (${xMin.toFixed(2)}, ${yMin.toFixed(2)})`,
          handles: [
            { name: '극대', x: xMax, y: yMax, type: 'max' },
            { name: '극소', x: xMin, y: yMin, type: 'min' }
          ]
        };
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
    const graphs = (app.graphs || []).map(g => {
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
      if (g.quadMode) item.qm = g.quadMode;
      if (g.quadOriginCenter) item.qo = 1;
      if (g.isFrozen) {
        item.fz = 1;
        if (g.freezeOffset && (g.freezeOffset.x || g.freezeOffset.y)) {
          item.fzo = [Number((g.freezeOffset.x || 0).toFixed(2)), Number((g.freezeOffset.y || 0).toFixed(2))];
        }
        if (g.frozenInvertH) item.fzh = 1;
        if (g.frozenInvertV) item.fzv = 1;
        if (g.frozenAbsolute) item.fza = 1;
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

    if (app.usePiecewise) {
      opts.pw = 1;
      const bList = app.piecewiseBoundaries || [];
      opts.pwb = bList.length > 0 ? Number(bList[0].toFixed(2)) : Number((app.piecewiseBoundary || 0.0).toFixed(2));
      if (bList.length > 0) {
        opts.pwbs = bList.map(b => Number(b.toFixed(2)));
        opts.pwm = app.piecewiseFuncMap ? [...app.piecewiseFuncMap] : [];
      }
      opts.pwr = app.pwActiveRange || 'left';
      opts.pwg = app.showPiecewiseGhost ? 1 : 0;
    }

    if (app.useViewfinder) {
      opts.vf = 1;
      opts.vfa = app.vfAspectName || '4:3';
      opts.vfw = Math.round(app.vfScreenW || 680);
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
// [📱 순수 JS 초경량 QR 코드 생성기 (MiniQRCode)]
// - 외부 CDN 및 인터넷 통신 0% (오프라인 / file:// 완전 지원)
// - 스마트폰 기본 카메라 원터치 스캔 최적화
// =====================================================================
class MiniQRCode {
  static drawToCanvas(text, canvas, options = {}) {
    if (!canvas || !text) return false;
    const size = options.size || canvas.width || 180;
    const padding = options.padding != null ? options.padding : 12;
    const fgColor = options.fgColor || '#1e272e';
    const bgColor = options.bgColor || '#ffffff';

    let typeNum = 1;
    const capacities = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
    for (let i = 0; i < capacities.length; i++) {
      if (text.length <= capacities[i]) {
        typeNum = i + 1;
        break;
      }
    }
    if (text.length > capacities[capacities.length - 1]) typeNum = 10;

    const qr = new MiniQRCode.Model(typeNum);
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    const ctx = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    const drawSize = size - padding * 2;
    const cellSize = drawSize / count;

    ctx.fillStyle = fgColor;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(
            Math.round(padding + c * cellSize),
            Math.round(padding + r * cellSize),
            Math.ceil(cellSize),
            Math.ceil(cellSize)
          );
        }
      }
    }
    return true;
  }
}

// QR Code 내부 수학/블록 서브시스템
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
    RS_BLOCK_TABLE: [
      [1, 26, 19], [1, 44, 34], [1, 70, 55], [1, 100, 80], [1, 134, 108],
      [2, 86, 68], [2, 98, 78], [2, 121, 97], [2, 146, 116], [2, 86, 68]
    ],
    getRSBlocks: function(typeNumber) {
      var rsBlock = QRRSBlock.RS_BLOCK_TABLE[typeNumber - 1];
      var list = [];
      for (var i = 0; i < rsBlock[0]; i++) list.push({ totalCount: rsBlock[1], dataCount: rsBlock[2] });
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
    this.modules = null;
    this.moduleCount = 0;
    this.dataList = [];
  }
  QRCodeModel.prototype = {
    addData: function(data) { this.dataList.push(new QR8bitByte(data)); },
    isDark: function(row, col) { return this.modules[row][col]; },
    getModuleCount: function() { return this.moduleCount; },
    make: function() {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (var row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupTimingPattern();
      this.mapData(this.createData());
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
    createData: function() {
      var rsBlocks = QRRSBlock.getRSBlocks(this.typeNumber);
      var buffer = new QRBitBuffer();
      for (var i = 0; i < this.dataList.length; i++) {
        var data = this.dataList[i];
        buffer.put(data.mode, 4);
        buffer.put(data.getLength(), 8);
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
    mapData: function(data) {
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
              var mask = ((row + (col - c)) % 2 == 0);
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
